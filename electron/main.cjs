// Proses utama Electron: jendela aplikasi, penyimpanan pengaturan, dan antrean render lokal.
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { spawn, execFile } = require('node:child_process');

const isDev = !app.isPackaged && process.argv.includes('--dev');

// Nama aplikasi sekarang HyperForge, tapi data (pengaturan, sesi MCP, riwayat uji) tetap di folder lama
// "ANIMA Studio" supaya tidak hilang. Harus diset sebelum app ready.
app.setName('HyperForge');
app.setPath('userData', path.join(app.getPath('appData'), 'ANIMA Studio'));

// Laptop low-spec: GPU lama (Quadro K1100M / HD 4600) lebih stabil tanpa akselerasi,
// dan dashboard tidak butuh WebGL.
app.disableHardwareAcceleration();

/** @type {BrowserWindow | null} */
let win = null;

// ---------- Pengaturan (disimpan di %APPDATA%/ANIMA Studio/settings.json) ----------

const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');

// Bawaan installer (URL + publishable key Supabase bersama). Bukan rahasia: data dilindungi RLS per akun.
// Jangan taruh secret key / API key vibi.pro di sini.
const appDefaults = () => {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'app-defaults.json'), 'utf8'));
  } catch {
    return {};
  }
};

const defaultSettings = () => ({
  supabaseUrl: '',
  supabaseAnonKey: '',
  ...appDefaults(),
  remotionProjectPath: '',
  remotionEntry: 'src/index.ts',
  defaultComposition: 'Main',
  outputDir: path.join(app.getPath('videos'), 'ANIMA'),
  tempDir: path.join(app.getPath('temp'), 'anima-remotion'),
  // 1 = 1080x1920 (hemat). 1.3333 = 1440x2560 (2K, jauh lebih lama).
  scale: 1,
  // 1 proses render agar RAM dan CPU laptop tidak penuh.
  concurrency: 1,
  crf: 18,
  frameTimeoutMs: 300000,
  // 'draft' mematikan efek berat skill (ink, lens blur, bloom): ~2x lebih cepat di laptop i7-4710MQ.
  renderQuality: 'full',
  // 'angle' = WebGL di kartu grafis (Direct3D). Tanpa flag, Chrome render memakai SwiftShader (CPU) yang jauh lebih lambat.
  // 'swiftshader' = cadangan kalau GPU/driver bermasalah.
  gl: 'angle',
  benchFrame: 400,
  // Suara narasi lewat vibi.pro (https://vibi.pro/docs).
  vibiApiKey: '',
  vibiProvider: 'elevenlabs',
  vibiModel: 'eleven_multilingual_v2',
  vibiVoiceId: '',
  vibiVoiceName: '',
  vibiLanguage: 'id',
  vibiSpeed: 1,
  // Suara B untuk dialog/film: default MiniMax supaya modelnya beda dari suara A (ElevenLabs).
  vibi2Provider: 'minimax',
  vibi2Model: 'speech-2.8-turbo',
  vibi2VoiceId: '',
  vibi2VoiceName: '',
  vibi2Language: 'Indonesian',
  vibi2Speed: 1,
  wordTimestamps: true,
  // Pipeline audio skill: <proyek Remotion>/voice (input) dan /audio (mix.py).
  voiceDir: 'voice',
  audioDir: 'audio',
  pythonPath: 'python',
  runMix: true,
  muxAudio: true,
});

function readSettings() {
  try {
    return { ...defaultSettings(), ...JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) };
  } catch {
    return defaultSettings();
  }
}

function writeSettings(next) {
  const merged = { ...readSettings(), ...next };
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify(merged, null, 2));
  return merged;
}

// ---------- Jendela ----------

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: 'HyperForge',
    backgroundColor: '#0b0d12',
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  win.once('ready-to-show', () => win && win.show());

  // Skala otomatis: tampilan dirancang untuk lebar 1366 px. Saat jendela diperkecil/diperbesar,
  // semua elemen ikut mengecil/membesar proporsional (75%-135%) supaya tata letak tetap sama.
  const BASE_WIDTH = 1366;
  let fitTimer = null;
  const fitZoom = () => {
    if (!win || win.isDestroyed()) return;
    const [w] = win.getContentSize();
    win.webContents.setZoomFactor(Math.min(1.35, Math.max(0.75, w / BASE_WIDTH)));
  };
  win.webContents.on('did-finish-load', fitZoom);
  win.on('resize', () => {
    clearTimeout(fitTimer);
    fitTimer = setTimeout(fitZoom, 80);
  });
  win.on('maximize', fitZoom);
  win.on('unmaximize', fitZoom);

  // Link luar (mis. dashboard Supabase) dibuka di browser, bukan di dalam aplikasi.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

// ---------- Render lokal (Remotion CLI) ----------

/** @type {{ jobId: string, composition: string, props: object, fileName: string }[]} */
const queue = [];
/** @type {{ jobId: string, child: import('node:child_process').ChildProcess, cancelled: boolean } | null} */
let current = null;

function emit(event) {
  if (win && !win.isDestroyed()) win.webContents.send('render:event', event);
}

const quote = (s) => `"${String(s).replace(/"/g, '\\"')}"`;

// Saklar efek template bridge (getInputProps().post). Grade tetap nyala supaya warna mirip hasil akhir.
const DRAFT_POST = { ink: false, lens: false, pre: false, bloom: false, grade: true, grain: false };
const withQuality = (s, props) => (s.renderQuality === 'draft' ? { ...props, post: DRAFT_POST } : props);
const glArg = (s) => `--gl=${s.gl === 'swiftshader' ? 'swiftshader' : 'angle'}`;

function remotionBin(projectPath) {
  const bin = path.join(projectPath, 'node_modules', '.bin', process.platform === 'win32' ? 'remotion.cmd' : 'remotion');
  return fs.existsSync(bin) ? bin : null;
}

async function freeGb(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const s = await fs.promises.statfs(dir);
    return (s.bavail * s.bsize) / 1024 ** 3;
  } catch {
    return null;
  }
}

const anima2d = require('./comic2d.cjs');

/**
 * Satu proses Remotion CLI. Progress "Rendered/Encoded x/y" dipetakan ke rentang [from, to] persen.
 * Hasil: { code, tail }.
 */
function remotionRun(s, job, bin, args, from, to) {
  return new Promise((resolve) => {
    // .cmd di Windows wajib lewat shell.
    const child = spawn(quote(bin), args, {
      cwd: s.remotionProjectPath,
      shell: true,
      windowsHide: true,
      // Bundle Remotion (salinan public/) ditulis ke TEMP dan tidak pernah dihapus (SKILL.md "Disk"),
      // jadi arahkan TEMP/TMP ke folder sementara ANIMA yang bisa dibersihkan.
      env: { ...process.env, REMOTION_TMP: s.tempDir, TEMP: s.tempDir, TMP: s.tempDir, FORCE_COLOR: '0' },
    });
    if (current) current.child = child;
    const tail = [];
    let lastPct = -1;
    const onData = (buf) => {
      for (const line of buf.toString().split(/\r?\n|\r/)) {
        const t = line.trim();
        if (!t) continue;
        tail.push(t);
        if (tail.length > 30) tail.shift();
        // Remotion mencetak "Rendered 120/2010" dan "Encoded 120/2010". Render frame = 90% rentang, encode = 10%.
        const m = t.match(/(Rendered|Encoded|Stitched)[^\d]*(\d+)\s*\/\s*(\d+)/i);
        if (m) {
          const stage = m[1].toLowerCase();
          const ratio = Number(m[2]) / Math.max(1, Number(m[3]));
          const span = to - from;
          const pct = Math.floor(from + (stage === 'rendered' ? ratio * span * 0.9 : span * 0.9 + ratio * span * 0.1));
          if (pct !== lastPct) {
            lastPct = pct;
            emit({ jobId: job.jobId, type: 'progress', progress: pct, stage });
          }
        }
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', (e) => resolve({ code: -1, tail: [...tail, e.message] }));
    child.on('close', (code) => resolve({ code, tail }));
  });
}

const commonArgs = (s) => [
  `--concurrency=${Number(s.concurrency) || 1}`,
  '--codec=h264',
  `--crf=${Number(s.crf) || 18}`,
  glArg(s),
  // Scene three.js + post-processing bisa > 30 detik per frame di GPU lama (default Remotion 30 dtk).
  `--timeout=${Number(s.frameTimeoutMs) || 300000}`,
];

/**
 * job.kind:
 *  - '3d' (bawaan): komposisi buatan pengguna (job.composition) + lapisan teks wajib (job.overlay), lalu mix audio skill.
 *  - '2d': mesin AnimaComic2D (job.comic, tanpa kode per video), lalu gabung suara narasi/dialog.
 */
async function runNext() {
  if (current || queue.length === 0) return;
  const job = queue.shift();
  const s = readSettings();
  current = { jobId: job.jobId, child: null, cancelled: false };
  const cleanups = [];

  const finish = (event) => {
    for (const c of cleanups) {
      try {
        c();
      } catch {
        /* sudah terhapus */
      }
    }
    cleanBundles(s.tempDir);
    const cancelled = current && current.cancelled;
    current = null;
    emit(cancelled || !event ? { jobId: job.jobId, type: 'cancelled' } : event);
    runNext();
  };
  const failWith = (error) => finish({ jobId: job.jobId, type: 'failed', error });
  const failLog = (tail, code) => {
    const log = tail.slice(-12).join('\n') || `Remotion keluar dengan kode ${code}`;
    const gpuHint =
      s.gl !== 'swiftshader' && /webgl|context lost|gpu|angle/i.test(log)
        ? '\n\nKemungkinan kartu grafis bermasalah. Coba Pengaturan > Render > Kartu grafis: "CPU (cadangan)".'
        : '';
    failWith(log + gpuHint);
  };

  if (!s.remotionProjectPath || !fs.existsSync(s.remotionProjectPath)) return failWith('Folder proyek Remotion belum diatur. Buka Pengaturan.');
  const bin = remotionBin(s.remotionProjectPath);
  if (!bin) return failWith('Remotion tidak ditemukan. Jalankan "npm install" di folder proyek Remotion terlebih dahulu.');
  const free = await freeGb(s.tempDir);
  if (free !== null && free < 5) return failWith(`Ruang disk tinggal ${free.toFixed(1)} GB. Render butuh minimal 5 GB kosong.`);

  fs.mkdirSync(s.outputDir, { recursive: true });
  fs.mkdirSync(s.tempDir, { recursive: true });
  const outFile = path.join(s.outputDir, job.fileName);
  const voiceDir = job.slug ? voiceOutDir(s, job.slug) : path.join(s.remotionProjectPath, s.voiceDir);
  const propsFile = path.join(s.tempDir, `props-${job.jobId}.json`);
  cleanups.push(() => fs.rmSync(propsFile, { force: true }));
  emit({ jobId: job.jobId, type: 'started', outFile });

  let entry;
  try {
    entry = anima2d.syncAnima(s.remotionProjectPath);
  } catch (e) {
    return failWith(`Gagal menyiapkan mesin video di folder Remotion: ${e.message}`);
  }

  if (job.kind === '2d') {
    const pub = anima2d.smallPublicDir(s.tempDir, job.jobId);
    cleanups.push(pub.cleanup);
    fs.writeFileSync(propsFile, JSON.stringify(anima2d.build2DProps(job.comic, voiceDir)));
    const r = await remotionRun(s, job, bin, ['render', quote(entry), 'AnimaComic2D', quote(outFile), `--props=${quote(propsFile)}`, `--public-dir=${quote(pub.dir)}`, ...commonArgs(s)], 0, 92);
    if (current.cancelled) return finish(null);
    if (r.code !== 0 || !fs.existsSync(outFile)) return failLog(r.tail, r.code);
    const voice = anima2d.voiceFile(voiceDir);
    let warning = '';
    if (!voice) warning = 'Suara belum dibuat, video tanpa audio. Buat suara di tab Render lalu render ulang.';
    else if (s.muxAudio) {
      emit({ jobId: job.jobId, type: 'progress', progress: 95, stage: 'mux' });
      const tmp = outFile.replace(/\.mp4$/i, '.audio.mp4');
      // apad + shortest: audio diperpanjang hening sampai video selesai.
      const m = await ffmpeg(s, ['-y', '-i', outFile, '-i', voice, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-af', 'apad', '-shortest', tmp], { trackJob: true });
      if (m.ok && fs.existsSync(tmp)) fs.renameSync(tmp, outFile);
      else warning = `Gagal menggabung suara:\n${m.log.split('\n').slice(-4).join('\n')}`;
    }
    return finish({ jobId: job.jobId, type: 'done', outFile, warning });
  }

  // 3D: komposisi buatan pengguna dari entry pengguna (seperti sebelumnya), lalu lapisan teks lewat mesin aplikasi.
  fs.writeFileSync(propsFile, JSON.stringify(withQuality(s, job.props)));
  const withText = Boolean(job.overlay && job.overlay.shots?.some((x) => x.text));
  const raw3d = withText ? path.join(s.tempDir, `video3d-${job.jobId}.mp4`) : outFile;
  if (withText) cleanups.push(() => fs.rmSync(raw3d, { force: true }));
  const r = await remotionRun(
    s,
    job,
    bin,
    ['render', quote(s.remotionEntry), quote(job.composition || s.defaultComposition), quote(raw3d), `--props=${quote(propsFile)}`, `--scale=${Number(s.scale) || 1}`, ...commonArgs(s)],
    0,
    withText ? 78 : 88,
  );
  if (current.cancelled) return finish(null);
  if (r.code !== 0 || !fs.existsSync(raw3d)) return failLog(r.tail, r.code);

  if (withText) {
    // Lapisan teks wajib: video 3D + teks per kata, render ringan tanpa scene 3D.
    const pub = anima2d.smallPublicDir(s.tempDir, job.jobId);
    cleanups.push(pub.cleanup);
    const scale = Number(s.scale) || 1;
    const props = anima2d.buildOverlayProps(pub.dir, raw3d, { ...job.overlay, width: Math.round(1080 * scale), height: Math.round(1920 * scale) }, voiceDir);
    const overlayProps = path.join(s.tempDir, `props-text-${job.jobId}.json`);
    fs.writeFileSync(overlayProps, JSON.stringify(props));
    cleanups.push(() => fs.rmSync(overlayProps, { force: true }));
    const t = await remotionRun(s, job, bin, ['render', quote(entry), 'AnimaTextOverlay', quote(outFile), `--props=${quote(overlayProps)}`, `--public-dir=${quote(pub.dir)}`, ...commonArgs(s)], 78, 88);
    if (current.cancelled) return finish(null);
    if (t.code !== 0 || !fs.existsSync(outFile)) return failLog(t.tail, t.code);
  }
  const warning = await finishAudio(job.jobId, s, outFile);
  finish({ jobId: job.jobId, type: 'done', outFile, warning });
}

/** Hapus sisa bundle Remotion di folder sementara ANIMA (hanya folder buatan Remotion/puppeteer). */
function cleanBundles(dir) {
  try {
    for (const d of fs.readdirSync(dir)) {
      if (/^(remotion-webpack-bundle-|remotion-v\d|puppeteer_dev_chrome_profile-)/.test(d)) {
        fs.rm(path.join(dir, d), { recursive: true, force: true }, () => {});
      }
    }
  } catch {
    /* folder belum ada */
  }
}

// ---------- Audio: mix SFX + musik (Python) lalu gabung ke MP4 ----------

/** Jalankan proses panjang dan kumpulkan 20 baris terakhir log-nya. */
function runLong(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const isCmd = /\.cmd$/i.test(cmd);
    const child = spawn(isCmd ? quote(cmd) : cmd, isCmd ? args.map(quote) : args, {
      windowsHide: true,
      shell: isCmd,
      ...opts,
    });
    if (current && opts.trackJob) current.child = child;
    const tail = [];
    const onData = (b) => {
      for (const l of b.toString().split(/\r?\n|\r/)) if (l.trim()) (tail.push(l.trim()), tail.length > 20 && tail.shift());
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', (err) => resolve({ ok: false, log: err.message }));
    child.on('close', (code) => resolve({ ok: code === 0, log: tail.join('\n') }));
  });
}

/** ffmpeg: pakai bawaan Remotion (`remotion ffmpeg`), kalau tidak ada pakai ffmpeg sistem. */
async function ffmpeg(s, args, opts) {
  const bin = s.remotionProjectPath && remotionBin(s.remotionProjectPath);
  if (bin) return runLong(bin, ['ffmpeg', ...args], { cwd: s.remotionProjectPath, ...opts });
  const sys = await which('ffmpeg');
  if (sys) return runLong(sys, args, opts);
  return { ok: false, log: 'ffmpeg tidak ditemukan (butuh proyek Remotion atau ffmpeg terpasang).' };
}

/** Mengembalikan pesan peringatan (string) kalau ada langkah audio yang dilewati/gagal. */
async function finishAudio(jobId, s, outFile) {
  const audioDir = path.join(s.remotionProjectPath, s.audioDir);
  const mixPy = path.join(audioDir, 'mix.py');
  const mixWav = path.join(audioDir, 'mix.wav');
  const voiceWav = path.join(s.remotionProjectPath, s.voiceDir, 'voice.wav');

  if (s.runMix) {
    if (!fs.existsSync(mixPy)) return `mix.py tidak ada di ${audioDir}, video tanpa audio.`;
    if (!fs.existsSync(voiceWav)) return 'voice/voice.wav belum ada. Buat suara dulu di tab Render, lalu render ulang.';
    emit({ jobId, type: 'progress', progress: 90, stage: 'mix' });
    const r = await runLong(s.pythonPath || 'python', ['mix.py'], {
      cwd: audioDir,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      trackJob: true,
    });
    if (current && current.cancelled) return 'Dibatalkan saat mix audio.';
    if (!r.ok) return `mix.py gagal:\n${r.log.split('\n').slice(-6).join('\n')}`;
  }

  if (s.muxAudio) {
    if (!fs.existsSync(mixWav)) return s.runMix ? 'mix.wav tidak dihasilkan.' : '';
    emit({ jobId, type: 'progress', progress: 96, stage: 'mux' });
    const tmp = outFile.replace(/\.mp4$/i, '.audio.mp4');
    // Remotion menulis track audio kosong; ambil video dari render, audio dari mix.wav.
    const r = await ffmpeg(
      s,
      ['-y', '-i', outFile, '-i', mixWav, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', tmp],
      { trackJob: true },
    );
    if (!r.ok || !fs.existsSync(tmp)) return `Gagal menggabung audio:\n${r.log.split('\n').slice(-4).join('\n')}`;
    fs.renameSync(tmp, outFile);
  }
  return '';
}

// ---------- Siapkan proyek Remotion (untuk teman yang baru install) ----------

// Template ikut di dalam aplikasi (folder remotion-template, dirakit dari mromidev/claude-animated-shorts).
const templateDir = () => path.join(__dirname, '..', 'remotion-template');

ipcMain.handle('remotion:setup', async () => {
  const say = (step, line) => win && !win.isDestroyed() && win.webContents.send('setup:event', { step, line });
  const npm = await which(process.platform === 'win32' ? 'npm.cmd' : 'npm');
  if (!npm) throw new Error('Node.js belum terpasang. Install Node.js LTS dari nodejs.org, lalu buka ulang ANIMA.');

  const target = path.join(os.homedir(), 'anima-remotion');
  if (fs.existsSync(path.join(target, 'package.json'))) {
    say('Folder anima-remotion sudah ada, file video kamu tidak ditimpa');
  } else {
    say(`Menyalin template ke ${target}`);
    fs.cpSync(templateDir(), target, { recursive: true });
  }

  say('Memasang Remotion + three.js (npm install, 3-10 menit)');
  const run = (cmd, args) =>
    new Promise((resolve) => {
      const child = spawn(quote(cmd), args, { cwd: target, shell: true, windowsHide: true, env: { ...process.env, FORCE_COLOR: '0' } });
      const tail = [];
      const onData = (b) => {
        for (const l of b.toString().split(/\r?\n|\r/)) {
          const t = l.trim();
          if (!t) continue;
          tail.push(t);
          if (tail.length > 10) tail.shift();
          say(null, t.slice(0, 160));
        }
      };
      child.stdout.on('data', onData);
      child.stderr.on('data', onData);
      child.on('error', (err) => resolve({ ok: false, log: err.message }));
      child.on('close', (code) => resolve({ ok: code === 0, log: tail.join('\n') }));
    });

  const inst = await run(npm, ['install', '--no-fund', '--no-audit']);
  if (!inst.ok) throw new Error(`npm install gagal:\n${inst.log}`);

  say('Mengunduh Chrome untuk render (~100 MB)');
  const bin = remotionBin(target);
  const br = await run(bin, ['browser', 'ensure']);
  if (!br.ok) throw new Error(`Gagal mengunduh Chrome render:\n${br.log}`);

  writeSettings({ remotionProjectPath: target, remotionEntry: 'src/index.ts', defaultComposition: 'BridgeShort' });
  say('Selesai');
  return { path: target };
});

// ---------- Uji render (Pengaturan): 1 frame atau kecepatan 10 frame ----------

const benchFile = () => path.join(app.getPath('userData'), 'bench.json');
const readBench = () => readJson(benchFile()) || [];
// Video skill contoh = 2025 frame (67,5 dtk @ 30 fps); dipakai untuk perkiraan lama render 1 video.
const VIDEO_FRAMES = 2025;

ipcMain.handle('bench:list', () => readBench());

ipcMain.handle('bench:run', (_e, kind) => runBench(readSettings(), kind, {}));

/**
 * Uji otomatis: bandingkan 1 proses vs N proses paralel (N dari jumlah thread & RAM perangkat ini),
 * lalu sarankan yang tercepat. Di laptop 4 core biasanya 1 proses menang; di PC 8+ core paralel menang.
 */
ipcMain.handle('bench:auto', async () => {
  const s = readSettings();
  const threads = os.cpus().length;
  const ramGb = os.totalmem() / 1024 ** 3;
  // ~2 GB RAM per proses render (Chrome + scene three.js), sisakan 3 GB untuk Windows.
  const n = Math.max(1, Math.min(16, Math.floor(threads / 2), Math.floor((ramGb - 3) / 2)));
  const results = [await runBench(s, 'speed', { concurrency: 1, frames: 10, label: 'auto' })];
  if (n > 1) results.push(await runBench(s, 'speed', { concurrency: n, frames: Math.max(10, n * 5), label: 'auto' }));
  const best = results.reduce((a, b) => (b.secPerFrame < a.secPerFrame ? b : a));
  return { results, best: best.concurrency, candidates: results.map((r) => r.concurrency), threads, ramGb };
});

async function runBench(s, kind, { concurrency, frames: nFrames }) {
  if (current) throw new Error('Sedang ada render berjalan. Tunggu selesai dulu.');
  const bin = s.remotionProjectPath && remotionBin(s.remotionProjectPath);
  if (!bin) throw new Error('Proyek Remotion belum diatur atau belum "npm install".');

  fs.mkdirSync(s.tempDir, { recursive: true });
  const outDir = path.join(s.outputDir, '_uji');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = Date.now();
  const propsFile = path.join(s.tempDir, `props-bench-${stamp}.json`);
  fs.writeFileSync(propsFile, JSON.stringify(withQuality(s, {})));
  const frame = Math.max(0, Number(s.benchFrame) || 0);
  const frames = kind === 'still' ? 1 : nFrames || 10;
  const conc = concurrency || Number(s.concurrency) || 1;
  const out = path.join(outDir, kind === 'still' ? `frame-${frame}-${stamp}.png` : `kecepatan-${stamp}.mp4`);
  const common = [`--scale=${Number(s.scale) || 1}`, glArg(s), `--timeout=${Number(s.frameTimeoutMs) || 300000}`, `--props=${quote(propsFile)}`];
  const args =
    kind === 'still'
      ? ['still', quote(s.remotionEntry), quote(s.defaultComposition), quote(out), `--frame=${frame}`, ...common]
      : ['render', quote(s.remotionEntry), quote(s.defaultComposition), quote(out), `--frames=${frame}-${frame + frames - 1}`,
         `--concurrency=${conc}`, '--codec=h264', ...common];

  const tag = kind === 'speed' ? ` (${conc} proses)` : '';
  const say = (e) => win && !win.isDestroyed() && win.webContents.send('bench:event', { ...e, step: e.step + tag });
  const t0 = Date.now();
  say({ step: 'Menyiapkan bundle', progress: 0 });

  const r = await new Promise((resolve) => {
    const child = spawn(quote(bin), args, {
      cwd: s.remotionProjectPath,
      shell: true,
      windowsHide: true,
      env: { ...process.env, REMOTION_TMP: s.tempDir, TEMP: s.tempDir, TMP: s.tempDir, FORCE_COLOR: '0' },
    });
    current = { jobId: 'bench', child, cancelled: false };
    const tail = [];
    const onData = (b) => {
      for (const line of b.toString().split(/\r?\n|\r/)) {
        const t = line.trim();
        if (!t) continue;
        tail.push(t);
        if (tail.length > 20) tail.shift();
        const m = t.match(/Rendered[^\d]*(\d+)\s*\/\s*(\d+)/i);
        if (m) say({ step: `Merender frame ${m[1]}/${m[2]}`, progress: Math.round((Number(m[1]) / Number(m[2])) * 100) });
        else if (/Bundling/i.test(t)) say({ step: 'Menyiapkan bundle', progress: 0 });
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('close', (code) => resolve({ ok: code === 0 && fs.existsSync(out), cancelled: current?.cancelled, log: tail.join('\n') }));
  });
  current = null;
  fs.rm(propsFile, { force: true }, () => {});
  cleanBundles(s.tempDir);
  runNext();

  if (r.cancelled) throw new Error('Uji dibatalkan.');
  if (!r.ok) throw new Error(r.log.split('\n').filter((l) => !/kenney|404/.test(l)).slice(-4).join('\n') || 'Render uji gagal.');

  const seconds = (Date.now() - t0) / 1000;
  const secPerFrame = seconds / frames;
  const result = {
    id: String(stamp),
    kind,
    date: new Date().toISOString(),
    composition: s.defaultComposition,
    frame,
    frames,
    width: Math.round(1080 * (Number(s.scale) || 1)),
    height: Math.round(1920 * (Number(s.scale) || 1)),
    quality: s.renderQuality,
    gl: s.gl === 'swiftshader' ? 'swiftshader' : 'angle',
    concurrency: kind === 'still' ? 1 : conc,
    seconds,
    secPerFrame,
    // Termasuk waktu persiapan (bundle + bangun scene), jadi ini batas atas.
    estVideoHours: kind === 'speed' ? (secPerFrame * VIDEO_FRAMES) / 3600 : null,
    file: out,
  };
  fs.writeFileSync(benchFile(), JSON.stringify([result, ...readBench()].slice(0, 20), null, 1));
  const preview = kind === 'still' ? `data:image/png;base64,${fs.readFileSync(out).toString('base64')}` : null;
  return { ...result, preview };
}

ipcMain.handle('bench:cancel', () => {
  if (current && current.jobId === 'bench') {
    current.cancelled = true;
    execFile('taskkill', ['/pid', String(current.child.pid), '/T', '/F'], () => {});
    return true;
  }
  return false;
});

// ---------- Suara narasi: vibi.pro TTS + timing per kata (STT) ----------

const VIBI = 'https://api.vibi.pro';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function vibi(s, p, init = {}) {
  if (!s.vibiApiKey) throw new Error('API key vibi.pro belum diisi di Pengaturan.');
  const res = await fetch(VIBI + p, { ...init, headers: { 'xi-api-key': s.vibiApiKey, ...(init.headers || {}) } });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  if (!res.ok) throw new Error(`vibi.pro ${res.status}: ${body.error || body.detail || body.message || text.slice(0, 200)}`);
  return body;
}

/** Polling tugas vibi sampai selesai (maks ~6 menit). */
async function vibiPoll(s, p, onProgress) {
  for (let i = 0; i < 180; i++) {
    await sleep(2000);
    const t = await vibi(s, p);
    if (t.status === 'completed') return t;
    if (t.status === 'failed') throw new Error(t.error || t.detail_error || 'Tugas vibi.pro gagal');
    if (onProgress) onProgress(t.progress ?? 0);
  }
  throw new Error('vibi.pro terlalu lama merespons.');
}

const voiceOutDir = (s, slug) => path.join(s.outputDir, slug);

/**
 * Daftar suara per provider. indo = hanya suara penutur asli bahasa Indonesia:
 * - ElevenLabs: voice library (shared-voices) dengan required_languages=id. Suara bawaan (default-voices)
 *   semuanya penutur Inggris, jadi bahasa Indonesianya berlogat asing.
 * - MiniMax: system voices language=Indonesian.  - CapCut: system voices language=id.
 */
ipcMain.handle('vibi:voices', async (_e, arg) => {
  const s = readSettings();
  const { provider = 'elevenlabs', search = '', indo = true } = typeof arg === 'object' && arg ? arg : { search: arg };
  const q = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== '' && v != null)).toString();

  if (provider === 'minimax') {
    const r = await vibi(s, `/v1/minimax/system-voices?${q({ page: 1, page_size: 50, search, language: indo ? 'Indonesian' : '' })}`);
    return (r.voice_list || []).map((v) => ({
      id: v.uniq_id || v.voice_id,
      name: v.voice_name,
      description: v.description,
      gender: (v.tag_list || []).find((t) => /^(male|female)$/i.test(t)),
      accent: (v.tag_list || []).filter((t) => !/^(male|female)$/i.test(t)).join(', '),
      preview: v.sample_audio,
    }));
  }
  if (provider === 'capcut') {
    const r = await vibi(s, `/v1/capcut/system-voices?${q({ page: 1, page_size: 50, search, language: indo ? 'id' : '' })}`);
    return (r.voice_list || []).map((v) => ({
      id: v.voice_id,
      name: v.name,
      description: (v.tags || []).join(', '),
      gender: v.gender,
      accent: v.language,
      // Contoh suara CapCut lewat api.vibi.pro butuh header API key, jadi tidak bisa diputar langsung.
      preview: null,
    }));
  }
  if (!indo) {
    const r = await vibi(s, `/v1/default-voices?${q({ page_size: 50, search })}`);
    return (r.voices || []).map((v) => ({ id: v.voice_id, name: v.name, description: v.description, gender: v.gender, accent: v.accent, preview: v.preview_url }));
  }
  const r = await vibi(s, `/v1/shared-voices?${q({ page_size: 50, search, required_languages: 'id', sort: 'usage_character_count_1y' })}`);
  return (r.voices || []).map((v) => {
    const idLang = (v.verified_languages || []).find((l) => l.language_id === 'id');
    return {
      id: v.voice_id,
      name: v.name,
      description: v.description,
      gender: v.gender,
      accent: idLang ? [idLang.language, idLang.accent].filter(Boolean).join(' ') : v.accent,
      // Contoh dalam bahasa Indonesia kalau ada.
      preview: idLang?.preview_url || v.preview_url,
    };
  });
});

ipcMain.handle('voice:status', (_e, slug) => {
  const s = readSettings();
  const dir = voiceOutDir(s, slug);
  const mp3 = path.join(dir, 'voice.mp3');
  const words = path.join(dir, 'words.json');
  return {
    mp3: fs.existsSync(mp3) ? mp3 : null,
    words: fs.existsSync(words) ? JSON.parse(fs.readFileSync(words, 'utf8')).length : null,
    updatedAt: fs.existsSync(mp3) ? fs.statSync(mp3).mtime.toISOString() : null,
  };
});

/** Satu kali TTS vibi.pro dengan konfigurasi suara tertentu; hasilnya ditulis ke file mp3. */
async function vibiTts(s, voice, text, outFile, onProgress) {
  const isEleven = voice.provider === 'elevenlabs';
  const task = await vibi(s, `/v1/text-to-speech/${encodeURIComponent(voice.voiceId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      provider: voice.provider,
      ...(voice.provider !== 'capcut' && voice.model ? { model_id: voice.model } : {}),
      language_code: voice.language,
      voice_settings: isEleven
        ? { stability: 0.5, similarity_boost: 0.75, speed: Number(voice.speed) || 1 }
        : { speed: Number(voice.speed) || 1, pitch: 0 },
    }),
  });
  const done = await vibiPoll(s, `/v1/history/${task.id}`, onProgress);
  const audioUrl = done.result?.audio_url;
  if (!audioUrl) throw new Error('vibi.pro tidak mengembalikan audio_url.');
  const res = await fetch(audioUrl, audioUrl.startsWith(VIBI) ? { headers: { 'xi-api-key': s.vibiApiKey } } : {});
  if (!res.ok) throw new Error(`Gagal mengunduh audio (${res.status})`);
  fs.writeFileSync(outFile, Buffer.from(await res.arrayBuffer()));
  return done.credits_deducted ?? 0;
}

const voiceA = (s) => ({ provider: s.vibiProvider, model: s.vibiModel, voiceId: s.vibiVoiceId, language: s.vibiLanguage, speed: s.vibiSpeed });
const voiceB = (s) => ({ provider: s.vibi2Provider, model: s.vibi2Model, voiceId: s.vibi2VoiceId, language: s.vibi2Language, speed: s.vibi2Speed });

/**
 * payload.text  : satu narator (suara A).
 * payload.lines : dialog/film [{ speaker: 'A'|'B', text }] -> tiap giliran pakai suara A atau B
 *                 (boleh beda provider/model), digabung dengan jeda 0,3 detik.
 */
ipcMain.handle('voice:generate', async (_e, { slug, text, lines }) => {
  const s = readSettings();
  const say = (step, progress) => win && !win.isDestroyed() && win.webContents.send('voice:event', { slug, step, progress });
  if (!s.vibiVoiceId) throw new Error('Pilih suara A dulu di Pengaturan > Suara & audio.');
  const dialog = Array.isArray(lines) && lines.some((l) => l.speaker === 'B');
  if (dialog && !s.vibi2VoiceId) throw new Error('Jenis ini memakai 2 suara. Pilih suara B dulu di Pengaturan > Suara & audio.');
  if (!dialog && !String(text || '').trim()) throw new Error('Script masih kosong.');

  const dir = voiceOutDir(s, slug);
  fs.mkdirSync(dir, { recursive: true });
  const mp3 = path.join(dir, 'voice.mp3');
  const notes = [];
  let credits = 0;
  const hasRemotion = s.remotionProjectPath && fs.existsSync(s.remotionProjectPath);
  const vdir = hasRemotion ? path.join(s.remotionProjectPath, s.voiceDir) : null;
  if (vdir) fs.mkdirSync(vdir, { recursive: true });

  if (!dialog) {
    // 1. Satu narator: TTS sekali, lalu konversi ke voice.wav 48 kHz (format yang diminta mix.py skill).
    say('Membuat suara', 0);
    credits += await vibiTts(s, voiceA(s), text, mp3, (p) => say('Membuat suara', p));
    if (vdir) {
      say('Konversi ke WAV 48 kHz', 100);
      const r = await ffmpeg(s, ['-y', '-i', mp3, '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s24le', path.join(vdir, 'voice.wav')]);
      if (!r.ok) notes.push(`Konversi WAV gagal: ${r.log.split('\n').slice(-2).join(' ')}`);
    } else {
      notes.push('Folder Remotion belum diatur, voice.wav belum dibuat.');
    }
  } else {
    // 1. Dialog/film: TTS per giliran dengan suara A/B, samakan format, gabung dengan jeda.
    const parts = path.join(dir, 'parts');
    fs.rmSync(parts, { recursive: true, force: true });
    fs.mkdirSync(parts, { recursive: true });
    const turns = lines.filter((l) => String(l.text || '').trim());
    const list = [];
    const gap = path.join(parts, 'gap.wav');
    const g = await ffmpeg(s, ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono', '-t', '0.3', '-c:a', 'pcm_s24le', gap]);
    if (!g.ok) throw new Error(`ffmpeg tidak bisa dipakai: ${g.log.split('\n').slice(-2).join(' ')}`);
    for (let i = 0; i < turns.length; i++) {
      const t = turns[i];
      const who = t.speaker === 'B' ? 'B' : 'A';
      const label = `Suara ${who}: giliran ${i + 1}/${turns.length}`;
      say(label, Math.round((i / turns.length) * 100));
      const partMp3 = path.join(parts, `${String(i).padStart(3, '0')}-${who}.mp3`);
      credits += await vibiTts(s, who === 'B' ? voiceB(s) : voiceA(s), t.text, partMp3, () => {});
      const partWav = partMp3.replace(/\.mp3$/, '.wav');
      const r = await ffmpeg(s, ['-y', '-i', partMp3, '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s24le', partWav]);
      if (!r.ok) throw new Error(`Konversi giliran ${i + 1} gagal: ${r.log.split('\n').slice(-2).join(' ')}`);
      if (list.length) list.push(gap);
      list.push(partWav);
    }
    say('Menggabungkan dua suara', 100);
    const listFile = path.join(parts, 'list.txt');
    fs.writeFileSync(listFile, list.map((f) => `file '${f.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'));
    const fullWav = path.join(dir, 'voice.wav');
    const c = await ffmpeg(s, ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c:a', 'pcm_s24le', fullWav]);
    if (!c.ok) throw new Error(`Gagal menggabungkan suara: ${c.log.split('\n').slice(-2).join(' ')}`);
    await ffmpeg(s, ['-y', '-i', fullWav, '-c:a', 'libmp3lame', '-b:a', '160k', mp3]);
    if (vdir) fs.copyFileSync(fullWav, path.join(vdir, 'voice.wav'));
    else notes.push('Folder Remotion belum diatur, voice.wav belum disalin.');
  }

  // 3. Timing per kata lewat speech-to-text, disimpan sebagai words.json [{s, e, text}].
  let wordCount = null;
  if (s.wordTimestamps) {
    say('Membuat timing per kata', 0);
    const form = new FormData();
    form.append('file', new Blob([fs.readFileSync(mp3)], { type: 'audio/mpeg' }), 'voice.mp3');
    // STT butuh kode ISO ("id"); MiniMax memakai nama bahasa ("Indonesian").
    const lang = String(s.vibiLanguage || 'id');
    form.append('language_code', /^indonesia/i.test(lang) ? 'id' : lang.length <= 3 ? lang : 'id');
    form.append('timestamps_granularity', 'word');
    form.append('tag_audio_events', 'false');
    const stt = await vibi(s, '/v1/speech-to-text', { method: 'POST', body: form });
    const tid = stt.task_id || stt.id;
    const tr = await vibiPoll(s, `/v1/speech-to-text/${tid}`, (p) => say('Membuat timing per kata', p));
    const words = (tr.result?.words || [])
      .filter((w) => w.type === 'word')
      .map((w) => ({ s: w.start, e: w.end, text: w.text }));
    const json = JSON.stringify(words, null, 1);
    fs.writeFileSync(path.join(dir, 'words.json'), json);
    if (s.remotionProjectPath && fs.existsSync(s.remotionProjectPath)) {
      fs.writeFileSync(path.join(s.remotionProjectPath, s.voiceDir, 'words.json'), json);
    }
    wordCount = words.length;
  }

  say('Selesai', 100);
  return { mp3, words: wordCount, credits, notes };
});

// ---------- Python (numpy + scipy untuk SFX & musik skill) ----------

ipcMain.handle('python:check', async () => {
  const s = readSettings();
  const r = await runLong(s.pythonPath || 'python', ['-c', 'import sys, numpy, scipy; print(sys.version.split()[0], numpy.__version__, scipy.__version__)']);
  if (r.ok) {
    const [py, np, sp] = r.log.trim().split(/\s+/);
    return { ok: true, python: py, numpy: np, scipy: sp };
  }
  const v = await runLong(s.pythonPath || 'python', ['--version']);
  return { ok: false, python: v.ok ? v.log.replace(/^Python\s*/i, '') : null, error: r.log.split('\n').slice(-1)[0] };
});

ipcMain.handle('python:install', async () => {
  const s = readSettings();
  const r = await runLong(s.pythonPath || 'python', ['-m', 'pip', 'install', '--user', '--disable-pip-version-check', 'numpy', 'scipy']);
  return { ok: r.ok, log: r.log.split('\n').slice(-4).join('\n') };
});

// ---------- IPC ----------

ipcMain.handle('settings:get', () => readSettings());
ipcMain.handle('settings:save', (_e, next) => writeSettings(next));

ipcMain.handle('dialog:pickFolder', async (_e, title) => {
  const r = await dialog.showOpenDialog(win, { title, properties: ['openDirectory', 'createDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});

ipcMain.handle('system:info', async () => {
  const s = readSettings();
  return {
    cpu: os.cpus()[0]?.model?.trim() ?? 'unknown',
    threads: os.cpus().length,
    ramGb: os.totalmem() / 1024 ** 3,
    freeRamGb: os.freemem() / 1024 ** 3,
    tempFreeGb: await freeGb(s.tempDir),
    outputFreeGb: await freeGb(s.outputDir),
    remotionFound: s.remotionProjectPath ? Boolean(remotionBin(s.remotionProjectPath)) : false,
    version: require('../package.json').version,
  };
});

ipcMain.handle('render:start', (_e, job) => {
  queue.push(job);
  emit({ jobId: job.jobId, type: 'queued', position: queue.length + (current ? 1 : 0) });
  runNext();
  return true;
});

ipcMain.handle('render:cancel', (_e, jobId) => {
  const i = queue.findIndex((j) => j.jobId === jobId);
  if (i >= 0) {
    queue.splice(i, 1);
    emit({ jobId, type: 'cancelled' });
    return true;
  }
  if (current && current.jobId === jobId) {
    current.cancelled = true;
    // Matikan seluruh pohon proses (shell -> node -> chrome headless).
    if (process.platform === 'win32') {
      if (current.child) execFile('taskkill', ['/pid', String(current.child.pid), '/T', '/F'], () => {});
    } else if (current.child) {
      current.child.kill('SIGTERM');
    }
    return true;
  }
  return false;
});

ipcMain.handle('render:active', () => ({ current: current?.jobId ?? null, queued: queue.map((j) => j.jobId) }));

// ---------- Integrasi Claude (deteksi + pasang MCP) ----------

const os = require('node:os');

const run = (file, args) =>
  new Promise((resolve) => {
    execFile(file, args, { windowsHide: true, timeout: 20000 }, (err, stdout, stderr) =>
      resolve({ ok: !err, out: String(stdout || '').trim(), err: String(stderr || err?.message || '').trim() }),
    );
  });

async function which(cmd) {
  const r = await run(process.platform === 'win32' ? 'where.exe' : 'which', [cmd]);
  return r.ok ? r.out.split(/\r?\n/)[0].trim() : null;
}

const readJson = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
};

const mcpServerPath = () => path.join(__dirname, '..', 'mcp', 'server.mjs');
const mcpSessionFile = () => path.join(app.getPath('userData'), 'mcp-session.json');

/** Lokasi config Claude Desktop: versi installer biasa dan versi Microsoft Store (MSIX). */
function desktopConfigPaths() {
  const out = [];
  const roaming = path.join(app.getPath('appData'), 'Claude');
  if (fs.existsSync(roaming)) out.push(path.join(roaming, 'claude_desktop_config.json'));
  const pkgs = path.join(os.homedir(), 'AppData', 'Local', 'Packages');
  try {
    for (const d of fs.readdirSync(pkgs)) {
      if (!/^Claude_/i.test(d)) continue;
      const dir = path.join(pkgs, d, 'LocalCache', 'Roaming', 'Claude');
      if (fs.existsSync(dir)) out.push(path.join(dir, 'claude_desktop_config.json'));
    }
  } catch {
    /* tidak ada folder Packages */
  }
  return out;
}

async function claudeCodePath() {
  const found = await which('claude');
  if (found) return found;
  const local = path.join(os.homedir(), '.local', 'bin', process.platform === 'win32' ? 'claude.exe' : 'claude');
  return fs.existsSync(local) ? local : null;
}

ipcMain.handle('claude:detect', async () => {
  const codePath = await claudeCodePath();
  let codeVersion = null;
  if (codePath) {
    const r = await run(codePath, ['--version']);
    codeVersion = r.ok ? r.out : null;
  }
  const codeCfg = readJson(path.join(os.homedir(), '.claude.json'));
  const desktopPaths = desktopConfigPaths();
  return {
    node: await which('node'),
    code: {
      installed: Boolean(codePath),
      path: codePath,
      version: codeVersion,
      connected: Boolean(codeCfg?.mcpServers?.anima),
    },
    desktop: {
      installed: desktopPaths.length > 0,
      configPaths: desktopPaths,
      connected: desktopPaths.some((p) => Boolean(readJson(p)?.mcpServers?.anima)),
    },
    sessionSaved: fs.existsSync(mcpSessionFile()),
  };
});

ipcMain.handle('claude:install', async (_e, { session, targets }) => {
  const s = readSettings();
  const node = await which('node');
  if (!node) return { ok: false, message: 'Node.js tidak ditemukan. Install Node.js LTS dulu.' };

  // Sesi khusus MCP (bukan password). Server MCP memperbaruinya sendiri saat kedaluwarsa.
  fs.writeFileSync(
    mcpSessionFile(),
    JSON.stringify({
      url: s.supabaseUrl,
      anonKey: s.supabaseAnonKey,
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
    }),
  );
  const entry = { command: node, args: [mcpServerPath()], env: { ANIMA_SESSION_FILE: mcpSessionFile() } };
  const results = [];

  if (targets.includes('code')) {
    const claude = await claudeCodePath();
    if (!claude) {
      results.push('Claude Code: tidak ditemukan');
    } else {
      await run(claude, ['mcp', 'remove', 'anima', '-s', 'user']);
      const r = await run(claude, ['mcp', 'add-json', 'anima', JSON.stringify({ type: 'stdio', ...entry }), '-s', 'user']);
      results.push(r.ok ? 'Claude Code: tersambung' : `Claude Code: gagal (${r.err || r.out})`);
    }
  }

  if (targets.includes('desktop')) {
    const paths = desktopConfigPaths();
    if (paths.length === 0) results.push('Claude Desktop: tidak ditemukan');
    for (const p of paths) {
      let cfg = {};
      if (fs.existsSync(p)) {
        cfg = readJson(p);
        // Jangan menimpa config yang rusak; biarkan user memperbaikinya.
        if (!cfg) {
          results.push(`Claude Desktop: config tidak valid, tidak diubah (${p})`);
          continue;
        }
        fs.copyFileSync(p, `${p}.bak`);
      }
      cfg.mcpServers = { ...(cfg.mcpServers || {}), anima: entry };
      fs.writeFileSync(p, JSON.stringify(cfg, null, 2));
      results.push('Claude Desktop: tersambung (tutup lalu buka lagi Claude Desktop)');
    }
  }

  return { ok: results.every((r) => !/gagal|tidak/.test(r)), message: results.join('\n') };
});

// ---------- Generate brief/script/shot langsung dari aplikasi (Claude Code headless) ----------
// Memakai login Claude Code pengguna (langganan Pro/Max), tanpa API key. Claude memanggil tool MCP ANIMA
// untuk membaca aturan jenis konten lalu menyimpan hook + script + shot; WebSearch/WebFetch untuk riset sumber.

/** @type {import('node:child_process').ChildProcess | null} */
let genChild = null;

ipcMain.handle('claude:generate', async (_e, { projectId, prompt, session, style }) => {
  if (genChild) throw new Error('Claude sedang menulis project lain. Tunggu selesai dulu.');
  const claude = await claudeCodePath();
  if (!claude) throw new Error('Claude Code tidak ditemukan. Install Claude Code lalu login, atau pakai tombol Salin prompt.');
  const node = await which('node');
  if (!node) throw new Error('Node.js tidak ditemukan.');
  if (!session?.access_token) throw new Error('Sesi login tidak ditemukan. Keluar lalu masuk lagi.');

  // Sesi pinjaman dari login aplikasi, khusus untuk generate ini: hanya access token (tanpa refresh token,
  // jadi tidak bentrok dengan sesi aplikasi) dan dihapus setelah selesai. Tidak butuh "Sambungkan".
  const s0 = readSettings();
  const genSession = path.join(app.getPath('userData'), 'mcp-session-gen.json');
  fs.writeFileSync(
    genSession,
    JSON.stringify({ url: s0.supabaseUrl, anonKey: s0.supabaseAnonKey, access_token: session.access_token, expires_at: session.expires_at, refresh_token: null }),
  );
  const cleanup = () => fs.rm(genSession, { force: true }, () => {});

  // Style 2D: siapkan potongan referensi gaya supaya Claude bisa melihatnya saat menggambar latar.
  if (style) {
    try {
      await require('./references.cjs').ensureStyleReferences(refDir(), style, (l) => win && !win.isDestroyed() && win.webContents.send('claude:event', { projectId, line: l }));
    } catch {
      /* offline: tetap jalan tanpa referensi */
    }
  }
  const mcpConfig = JSON.stringify({
    mcpServers: { anima: { type: 'stdio', command: node, args: [mcpServerPath()], env: { ANIMA_SESSION_FILE: genSession, ANIMA_REF_DIR: refDir() } } },
  });
  const tools = [
    'mcp__anima__anima_get_project',
    'mcp__anima__anima_save_story',
    'mcp__anima__anima_patch_shot',
    // style 2D: latar SVG + foto referensi Wikimedia (sejarah/fakta)
    'mcp__anima__anima_save_background',
    'mcp__anima__anima_find_photos',
    'mcp__anima__anima_view_photo',
    'mcp__anima__anima_style_references',
    'WebSearch',
    'WebFetch',
  ];
  const args = ['-p', prompt, '--output-format', 'stream-json', '--verbose', '--mcp-config', mcpConfig, '--allowedTools', ...tools];
  const say = (line) => win && !win.isDestroyed() && win.webContents.send('claude:event', { projectId, line });
  say('Menyiapkan Claude...');

  return await new Promise((resolve, reject) => {
    const child = spawn(claude, args, { cwd: app.getPath('userData'), windowsHide: true, env: { ...process.env } });
    genChild = child;
    let buf = '';
    let result = null;
    let saved = false;
    const errTail = [];
    // Style 2D ikut menggambar latar, jadi bisa lebih lama.
    const timer = setTimeout(() => child.kill(), 40 * 60 * 1000);

    child.stdout.on('data', (b) => {
      buf += b.toString();
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        let ev;
        try {
          ev = JSON.parse(line);
        } catch {
          continue;
        }
        if (ev.type === 'assistant') {
          for (const c of ev.message?.content || []) {
            if (c.type !== 'tool_use') continue;
            const n = String(c.name);
            if (n.endsWith('get_project')) say('Membaca brief & aturan jenis konten...');
            else if (n === 'WebSearch') say(`Mencari sumber: ${c.input?.query ?? ''}`);
            else if (n === 'WebFetch') say(`Membaca sumber: ${c.input?.url ?? ''}`);
            else if (n.endsWith('find_photos')) say(`Mencari foto referensi: ${c.input?.query ?? ''}`);
            else if (n.endsWith('view_photo')) say('Melihat foto referensi...');
            else if (n.endsWith('save_background')) say(`Menggambar latar: ${c.input?.bgId ?? ''}`);
            else if (n.endsWith('style_references')) say('Melihat potongan referensi gaya...');
            else if (n.endsWith('save_story')) {
              say('Menyimpan hook, script, dan shot...');
              saved = true;
            }
          }
        } else if (ev.type === 'result') {
          result = ev;
        }
      }
    });
    child.stderr.on('data', (b) => {
      errTail.push(b.toString().trim());
      if (errTail.length > 10) errTail.shift();
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      genChild = null;
      cleanup();
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      genChild = null;
      cleanup();
      if (result && !result.is_error && saved) {
        say('Selesai');
        resolve({ ok: true, summary: String(result.result || '').slice(0, 400) });
      } else if (result && !result.is_error) {
        reject(new Error(`Claude selesai tapi tidak menyimpan story. Jawaban Claude: ${String(result.result || '').slice(0, 300)}`));
      } else {
        const msg = result?.result || errTail.join('\n') || `Claude Code keluar dengan kode ${code}`;
        reject(new Error(/login|auth|credential/i.test(msg) ? 'Claude Code belum login. Buka terminal, jalankan "claude", lalu login.' : String(msg).slice(0, 400)));
      }
    });
  });
});

ipcMain.handle('claude:cancel', () => {
  if (!genChild) return false;
  if (process.platform === 'win32') execFile('taskkill', ['/pid', String(genChild.pid), '/T', '/F'], () => {});
  else genChild.kill();
  return true;
});

ipcMain.handle('claude:remove', async () => {
  const results = [];
  const claude = await claudeCodePath();
  if (claude) {
    const r = await run(claude, ['mcp', 'remove', 'anima', '-s', 'user']);
    if (r.ok) results.push('Claude Code: dilepas');
  }
  for (const p of desktopConfigPaths()) {
    const cfg = readJson(p);
    if (cfg?.mcpServers?.anima) {
      fs.copyFileSync(p, `${p}.bak`);
      delete cfg.mcpServers.anima;
      fs.writeFileSync(p, JSON.stringify(cfg, null, 2));
      results.push('Claude Desktop: dilepas');
    }
  }
  fs.rmSync(mcpSessionFile(), { force: true });
  return { ok: true, message: results.join('\n') || 'Tidak ada yang perlu dilepas' };
});

ipcMain.handle('shell:openPath', (_e, p) => shell.openPath(p));
ipcMain.handle('shell:showItem', (_e, p) => shell.showItemInFolder(p));
ipcMain.handle('shell:openExternal', (_e, url) => /^https?:\/\//.test(url) && shell.openExternal(url));

// ---------- Update otomatis (GitHub Releases kamssser/ANIMA) ----------
// Teman cukup buka aplikasi: update dicek, diunduh di latar belakang, lalu muncul tombol "Restart & update".

let updateState = { state: 'idle' };
const sendUpdate = (next) => {
  updateState = { ...updateState, ...next };
  if (win && !win.isDestroyed()) win.webContents.send('update:event', updateState);
};

function setupAutoUpdate() {
  if (!app.isPackaged) {
    updateState = { state: 'dev', message: 'Update otomatis hanya aktif di versi yang di-install.' };
    return;
  }
  const { autoUpdater } = require('electron-updater');
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('checking-for-update', () => sendUpdate({ state: 'checking', error: null }));
  // Catatan rilis dari GitHub (bisa HTML atau daftar per versi) -> teks biasa untuk dialog "Yang baru".
  const plainNotes = (n) => {
    const raw = Array.isArray(n) ? n.map((x) => x.note || '').join('\n') : String(n || '');
    return raw
      .replace(/<\/(li|p|h\d)>|<br\s*\/?>/gi, '\n')
      .replace(/<li>/gi, '- ')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\*\*/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };
  autoUpdater.on('update-available', (i) =>
    sendUpdate({ state: 'downloading', version: i.version, percent: 0, notes: plainNotes(i.releaseNotes) }),
  );
  autoUpdater.on('update-not-available', () => sendUpdate({ state: 'latest', checkedAt: new Date().toISOString() }));
  autoUpdater.on('download-progress', (p) => sendUpdate({ state: 'downloading', percent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', (i) =>
    sendUpdate({ state: 'ready', version: i.version, percent: 100, notes: plainNotes(i.releaseNotes) || updateState.notes }),
  );
  autoUpdater.on('error', (err) => {
    const msg = String(err?.message || err);
    // Belum ada release di GitHub = belum ada update, bukan error yang perlu ditampilkan.
    if (/404|Unable to find latest version|No published versions/i.test(msg)) {
      sendUpdate({ state: 'latest', checkedAt: new Date().toISOString() });
    } else if (/ENOTFOUND|ETIMEDOUT|ECONNRESET|net::ERR_/i.test(msg)) {
      sendUpdate({ state: 'error', error: 'Tidak ada koneksi internet.' });
    } else {
      sendUpdate({ state: 'error', error: msg.split('\n')[0].slice(0, 160) });
    }
  });

  const check = () => autoUpdater.checkForUpdates().catch(() => {});
  setTimeout(check, 8000);
  setInterval(check, 4 * 60 * 60 * 1000);

  ipcMain.handle('update:check', () => {
    check();
    return updateState;
  });
  ipcMain.handle('update:install', () => {
    // Hentikan render yang berjalan supaya installer bisa mengganti file aplikasi.
    if (current?.child && process.platform === 'win32') execFile('taskkill', ['/pid', String(current.child.pid), '/T', '/F'], () => {});
    setImmediate(() => autoUpdater.quitAndInstall(false, true));
  });
}

// Versi dari package.json (app.getVersion() bisa berisi versi Electron kalau dijalankan lewat skrip lain).
const APP_VERSION = require('../package.json').version;
// Potongan referensi gaya (storyboard video referensi) disimpan di sini, tidak ikut installer.
const refDir = () => path.join(app.getPath('userData'), 'references');

/** Render SVG ke PNG lewat jendela tersembunyi (untuk diperiksa Claude terhadap referensi). */
async function renderSvgPng(svg, width, height, outFile) {
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const w = new BrowserWindow({ show: false, width, height, useContentSize: true, webPreferences: { offscreen: true, javascript: false } });
  try {
    const body = svg.replace(/<svg([^>]*)>/, (_m, a) => `<svg${a.replace(/\s(width|height|preserveAspectRatio)="[^"]*"/g, '')} width="${width}" height="${height}" preserveAspectRatio="xMidYMax meet">`);
    await w.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<html><body style="margin:0;background:#eef1f4;overflow:hidden">${body}</body></html>`)}`);
    await new Promise((r) => setTimeout(r, 300));
    const img = await w.webContents.capturePage();
    fs.writeFileSync(outFile, img.toPNG());
    return outFile;
  } finally {
    w.destroy();
  }
}

// Karakter 2D: digambar Claude sebagai SVG ber-rig (electron/characters.cjs).
require('./characters.cjs').register({ ipcMain, getWin: () => win, claudeCodePath, cwd: app.getPath('userData'), refDir: refDir(), renderSvgPng });

ipcMain.handle('update:state', () => ({ ...updateState, current: APP_VERSION }));
if (!app.isPackaged) {
  ipcMain.handle('update:check', () => updateState);
  ipcMain.handle('update:install', () => {});
}

// ---------- Siklus hidup ----------

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  app.whenReady().then(() => {
    createWindow();
    setupAutoUpdate();
  });
}

app.on('before-quit', () => {
  if (current?.child && process.platform === 'win32') {
    execFile('taskkill', ['/pid', String(current.child.pid), '/T', '/F'], () => {});
  }
});

app.on('window-all-closed', () => app.quit());
