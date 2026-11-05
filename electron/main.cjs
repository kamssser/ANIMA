// Proses utama Electron: jendela aplikasi, penyimpanan pengaturan, dan antrean render lokal.
const { app, BrowserWindow, ipcMain, dialog, shell, nativeImage } = require('electron');
const path = require('node:path');
const { appFile } = require('./paths.cjs');
const fs = require('node:fs');
const { spawn, execFile } = require('node:child_process');
const brain = require('./brain.cjs');

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

// ---------- Pengaturan: electron/settings.cjs ----------

const { settingsFile, readSettings, writeSettings, migrateSecrets } = require('./settings.cjs');

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
/** Teks branding aktif ('' kalau mati). */
const brandOf = (s) => (s.brandOn ? String(s.brandText || '').trim().slice(0, 80) : '');

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
    const props2d = { ...anima2d.build2DProps(job.comic, voiceDir), watermark: brandOf(s) || undefined };
    fs.writeFileSync(propsFile, JSON.stringify(props2d));
    // Panjang video = jumlah frame semua shot (sama dengan comic2DDuration di Comic2D.tsx), 30 fps.
    const videoSec = (Math.max(1, props2d.shots.reduce((n, x) => n + x.durationInFrames, 0)) / 30).toFixed(3);
    const r = await remotionRun(s, job, bin, ['render', quote(entry), 'AnimaComic2D', quote(outFile), `--props=${quote(propsFile)}`, `--public-dir=${quote(pub.dir)}`, ...commonArgs(s)], 0, 92);
    if (current.cancelled) return finish(null);
    if (r.code !== 0 || !fs.existsSync(outFile)) return failLog(r.tail, r.code);
    const voice = anima2d.voiceFile(voiceDir);
    let warning = '';
    if (!voice) warning = 'Suara belum dibuat, video tanpa audio. Buat suara di tab Render lalu render ulang.';
    else if (s.muxAudio) {
      emit({ jobId: job.jobId, type: 'progress', progress: 95, stage: 'mux' });
      const tmp = outFile.replace(/\.mp4$/i, '.audio.mp4');
      // Audio diperpanjang hening sampai tepat sepanjang video. Jangan pakai `apad` tanpa batas + -shortest:
      // dengan video -c:v copy ffmpeg bisa tidak pernah berhenti (render macet di 95%).
      const m = await ffmpeg(
        s,
        ['-y', '-i', outFile, '-i', voice, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-af', `apad=whole_dur=${videoSec}`, '-t', videoSec, tmp],
        { trackJob: true },
      );
      if (m.ok && fs.existsSync(tmp)) fs.renameSync(tmp, outFile);
      else warning = `Gagal menggabung suara:\n${m.log.split('\n').slice(-4).join('\n')}`;
    }
    return finish({ jobId: job.jobId, type: 'done', outFile, warning, qa: await qaAfterRender(s, job.jobId, outFile) });
  }

  // 3D: komposisi buatan pengguna dari entry pengguna (seperti sebelumnya), lalu lapisan teks lewat mesin aplikasi.
  fs.writeFileSync(propsFile, JSON.stringify(withQuality(s, job.props)));
  const brand = brandOf(s);
  // Lapisan teks juga dipakai untuk branding (tanpa teks narasi pun).
  const withText = Boolean(job.overlay && (brand || job.overlay.shots?.some((x) => x.text)));
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
    const props = anima2d.buildOverlayProps(pub.dir, raw3d, { ...job.overlay, brand, width: Math.round(1080 * scale), height: Math.round(1920 * scale) }, voiceDir);
    const overlayProps = path.join(s.tempDir, `props-text-${job.jobId}.json`);
    fs.writeFileSync(overlayProps, JSON.stringify(props));
    cleanups.push(() => fs.rmSync(overlayProps, { force: true }));
    const t = await remotionRun(s, job, bin, ['render', quote(entry), 'AnimaTextOverlay', quote(outFile), `--props=${quote(overlayProps)}`, `--public-dir=${quote(pub.dir)}`, ...commonArgs(s)], 78, 88);
    if (current.cancelled) return finish(null);
    if (t.code !== 0 || !fs.existsSync(outFile)) return failLog(t.tail, t.code);
  }
  const warning = await finishAudio(job.jobId, s, outFile);
  if (current.cancelled) return finish(null);
  finish({ jobId: job.jobId, type: 'done', outFile, warning, qa: await qaAfterRender(s, job.jobId, outFile) });
}

// ---------- Pemeriksaan otomatis setelah render (lihat electron/qa.cjs) ----------

const qa = require('./qa.cjs');
const qaDir = () => path.join(app.getPath('userData'), 'qa');

/** Ringkasan untuk event 'done'; laporan lengkap + lembar ringkasan disimpan di userData/qa/<jobId>. */
async function qaAfterRender(s, jobId, outFile) {
  const bin = qa.findFfmpeg(s.remotionProjectPath) || (await which('ffmpeg'));
  if (!bin || !fs.existsSync(outFile)) return undefined;
  emit({ jobId, type: 'progress', progress: 98, stage: 'qa' });
  try {
    const r = await qa.checkVideo({ ffmpegBin: bin, file: outFile, outDir: qaDir(), id: jobId, nativeImage });
    return { ok: r.ok, errors: r.issues.filter((i) => i.level === 'error').length, warnings: r.issues.filter((i) => i.level === 'warn').length };
  } catch {
    return undefined; // pemeriksaan gagal tidak boleh menggagalkan render
  }
}

ipcMain.handle('render:qa', (_e, jobId) => qa.readReport(qaDir(), String(jobId).replace(/[^\w-]/g, '')));
/** Periksa ulang (atau periksa video lama yang belum punya laporan). */
ipcMain.handle('render:qaRun', async (_e, { jobId, file }) => {
  const s = readSettings();
  const id = String(jobId).replace(/[^\w-]/g, '');
  const bin = qa.findFfmpeg(s.remotionProjectPath) || (await which('ffmpeg'));
  if (!bin) throw new Error('ffmpeg tidak ditemukan. Siapkan proyek Remotion dulu di Pengaturan.');
  if (!file || !fs.existsSync(file)) throw new Error('File video tidak ada di laptop ini.');
  await qa.checkVideo({ ffmpegBin: bin, file, outDir: qaDir(), id, nativeImage });
  return qa.readReport(qaDir(), id);
});

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
    // Batas waktu (opsional): proses yang macet dihentikan beserta anak prosesnya.
    let timedOut = false;
    const timer =
      opts.timeoutMs &&
      setTimeout(() => {
        timedOut = true;
        if (process.platform === 'win32') execFile('taskkill', ['/pid', String(child.pid), '/T', '/F'], () => {});
        else child.kill('SIGKILL');
      }, opts.timeoutMs);
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ ok: false, log: err.message });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) tail.push(`Dihentikan: lebih dari ${Math.round(opts.timeoutMs / 60000)} menit tanpa selesai.`);
      resolve({ ok: code === 0 && !timedOut, log: tail.join('\n') });
    });
  });
}

/** ffmpeg: pakai bawaan Remotion (`remotion ffmpeg`), kalau tidak ada pakai ffmpeg sistem. */
async function ffmpeg(s, args, opts) {
  // Menggabung audio biasanya beberapa detik; 10 menit berarti macet.
  opts = { timeoutMs: 10 * 60 * 1000, ...opts };
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
const templateDir = () => appFile('remotion-template');

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

// ---------- Suara narasi (vibi.pro): electron/voice.cjs ----------

const { voiceOutDir } = require('./voice.cjs');
require('./voice.cjs').register({ ipcMain, getWin: () => win, readSettings, ffmpeg: (...a) => ffmpeg(...a) });

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
ipcMain.handle('settings:save', (_e, next) => {
  const merged = writeSettings(next);
  brain.applyBrainEnv(merged);
  return merged;
});

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

const mcpServerPath = () => appFile('mcp', 'server.mjs');
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

/**
 * Setelah update, lokasi server MCP bisa pindah (mis. resources/app -> resources/app.asar.unpacked). Sambungan
 * "anima" yang sudah dipasang di Claude Code / Claude Desktop diarahkan ulang ke lokasi baru tanpa perlu Sambungkan lagi.
 */
function fixMcpPaths() {
  const want = mcpServerPath();
  for (const p of [path.join(os.homedir(), '.claude.json'), ...desktopConfigPaths()]) {
    try {
      const cfg = readJson(p);
      const entry = cfg?.mcpServers?.anima;
      const cur = entry?.args?.[0];
      if (!cur || cur === want || !/[\\/]mcp[\\/]server\.mjs$/.test(cur) || fs.existsSync(cur)) continue;
      entry.args[0] = want;
      const tmp = `${p}.hyperforge-tmp`;
      fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2));
      fs.renameSync(tmp, p);
    } catch {
      /* config tidak terbaca: biarkan */
    }
  }
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
    'mcp__anima__anima_save_prop',
    'mcp__anima__anima_find_photos',
    'mcp__anima__anima_view_photo',
    'mcp__anima__anima_style_references',
    'WebSearch',
    'WebFetch',
  ];
  // Riset Agent Reach (kalau terpasang): subtitle YouTube, Reddit, X, GitHub, dll. (hanya membaca)
  const reachBin = await require('./reach.cjs').findReach(which);
  if (reachBin) tools.push('Bash(agent-reach:*)');
  if (reachBin) prompt += '\n\nRiset tambahan boleh memakai perintah agent-reach (read-only), mis. `agent-reach read <link>` atau `agent-reach youtube search "<topik>"`, bila WebSearch/WebFetch tidak cukup.';
  const args = ['-p', prompt, '--output-format', 'stream-json', '--verbose', '--mcp-config', mcpConfig, '--allowedTools', ...tools];
  const say = (line) => win && !win.isDestroyed() && win.webContents.send('claude:event', { projectId, line });
  say('Menyiapkan Claude...');

  return await new Promise((resolve, reject) => {
    const child = spawn(claude, args, { cwd: app.getPath('userData'), windowsHide: true, env: reachBin ? { ...process.env, PATH: `${path.dirname(reachBin)}${path.delimiter}${process.env.PATH}` } : { ...process.env } });
    genChild = child;
    let buf = '';
    let result = null;
    let saved = false;
    const errTail = [];
    // Style 2D ikut menggambar latar, jadi bisa lebih lama.
    const timer = setTimeout(() => child.kill(), 75 * 60 * 1000);

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
            else if (n.endsWith('save_prop')) say(`Menggambar benda: ${c.input?.propId ?? ''}`);
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
        reject(new Error(/login|auth|credential|401|403/i.test(msg) ? (process.env.ANTHROPIC_BASE_URL ? `Otak custom menolak permintaan (cek API key, base URL, dan model di Pengaturan > Otak AI): ${String(msg).slice(0, 200)}` : 'Claude Code belum login. Buka terminal, jalankan "claude", lalu login.') : String(msg).slice(0, 400)));
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

// ---------- Update otomatis: electron/updater.cjs ----------

// Versi dari package.json (app.getVersion() bisa berisi versi Electron kalau dijalankan lewat skrip lain).
const APP_VERSION = require('../package.json').version;
// Potongan referensi gaya (storyboard video referensi) disimpan di sini, tidak ikut installer.
const refDir = () => path.join(app.getPath('userData'), 'references');

/** Render SVG ke PNG lewat jendela tersembunyi (untuk diperiksa Claude terhadap referensi). */
async function renderSvgPng(svg, width, height, outFile) {
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const w = new BrowserWindow({ show: false, width, height, useContentSize: true, webPreferences: { offscreen: true, javascript: false } });
  try {
    const body = svg.replace(/<svg\b([^>]*)>/, (_m, a) => `<svg${a.replace(/\s(width|height|preserveAspectRatio)="[^"]*"/g, '')} width="${width}" height="${height}" preserveAspectRatio="xMidYMax meet">`);
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
// Style dari skill Claude pihak ketiga (animate, bang-motion; utuh): pasang, buka Claude Code interaktif, baca hasil.
const skillChat = require('./skills.cjs').register({ ipcMain, getWin: () => win, which, claudeCodePath, mcpServerPath, settingsFile, readSettings, writeSettings });
require('./reach.cjs').register({ ipcMain, getWin: () => win, which });
require('./brain.cjs').register({ ipcMain });
require('./storage.cjs').register({ ipcMain, readSettings, userData: app.getPath('userData'), isBusy: (engine, slug) => skillChat.isRunning(engine, slug) });
// Pustaka Video: semua MP4 jadi (render + skill), gambar mini, buka folder.
require('./library.cjs').register({ ipcMain, readSettings, ffmpeg, cacheDir: app.getPath('userData') });

const updater = require('./updater.cjs').register({
  ipcMain,
  getWin: () => win,
  version: APP_VERSION,
  // Hentikan render yang berjalan supaya installer bisa mengganti file aplikasi.
  beforeInstall: () => {
    if (current?.child && process.platform === 'win32') execFile('taskkill', ['/pid', String(current.child.pid), '/T', '/F'], () => {});
  },
});

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
    migrateSecrets();
    if (app.isPackaged) fixMcpPaths();
    brain.applyBrainEnv(readSettings());
    createWindow();
    updater.start();
  });
}

app.on('before-quit', () => {
  if (current?.child && process.platform === 'win32') {
    execFile('taskkill', ['/pid', String(current.child.pid), '/T', '/F'], () => {});
  }
  // Chrome Google Flow (port kendali terbuka) tidak dibiarkan menyala setelah HyperForge ditutup.
  require('./flow-chrome.cjs').closeChromeSync();
});

app.on('window-all-closed', () => app.quit());
