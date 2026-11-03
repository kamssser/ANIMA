// Pemeriksaan otomatis setelah render (mirip short_qa.py di skill): layar hitam, gambar diam terlalu lama,
// bagian tanpa suara, kerasnya suara (LUFS), lalu lembar ringkasan frame (contact sheet) untuk dicek sekilas.
//
// ffmpeg bawaan Remotion versinya ringkas (tanpa blackdetect/freezedetect/fps/tile), jadi ffmpeg hanya
// dipakai untuk mengambil frame kecil (PNG, 2 per detik) dan mengukur audio (silencedetect + loudnorm);
// analisis gambar dan penyusunan lembar ringkasan dikerjakan di sini dengan nativeImage Electron.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

/** Target kerasnya suara untuk Shorts/TikTok/Reels. */
const LUFS_TARGET = -14;
/** Frame per detik yang diperiksa. */
const RATE = 2;

/** Jalankan ffmpeg langsung (bukan lewat .cmd) dan kumpulkan stderr. */
function ff(bin, args, timeoutMs = 10 * 60 * 1000) {
  return new Promise((resolve) => {
    const c = spawn(bin, args, { windowsHide: true });
    let log = '';
    c.stderr.on('data', (b) => (log += b.toString()));
    c.stdout.on('data', () => {});
    const timer = setTimeout(() => c.kill('SIGKILL'), timeoutMs);
    c.on('error', (e) => (clearTimeout(timer), resolve({ code: -1, log: e.message })));
    c.on('close', (code) => (clearTimeout(timer), resolve({ code, log })));
  });
}

const clock = (x) => `${Math.floor(x / 60)}:${String(Math.floor(x % 60)).padStart(2, '0')}`;

/** Gabungkan frame berurutan yang memenuhi syarat menjadi rentang [awal, akhir] dalam detik. */
function spans(flags, minSec) {
  const out = [];
  let start = -1;
  for (let i = 0; i <= flags.length; i++) {
    if (i < flags.length && flags[i]) {
      if (start < 0) start = i;
    } else if (start >= 0) {
      if ((i - start) / RATE >= minSec) out.push([start / RATE, i / RATE]);
      start = -1;
    }
  }
  return out;
}

/**
 * @param {{ ffmpegBin: string, file: string, outDir: string, id: string, nativeImage: import('electron').NativeImage }} o
 */
async function checkVideo({ ffmpegBin, file, outDir, id, nativeImage }) {
  fs.mkdirSync(outDir, { recursive: true });
  const issues = [];

  // 1. Info dasar dari header (ffmpeg -i tanpa output selalu keluar dengan kode 1, itu normal).
  const head = (await ff(ffmpegBin, ['-hide_banner', '-i', file])).log;
  const dm = head.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
  const duration = dm ? Number(dm[1]) * 3600 + Number(dm[2]) * 60 + Number(dm[3]) : 0;
  const size = head.match(/Video:.*?\b(\d{2,5})x(\d{2,5})\b/);
  const width = size ? Number(size[1]) : 0;
  const height = size ? Number(size[2]) : 0;
  const hasAudio = /Stream #.*Audio:/.test(head);
  if (!duration || !width) return save(outDir, id, { ok: false, duration, width, height, lufs: null, peak: null, issues: [{ level: 'error', kind: 'file', text: 'Video tidak bisa dibaca.' }], sheet: null });
  if (!hasAudio) issues.push({ level: 'error', kind: 'audio', text: 'Video tidak punya suara.' });

  // 2. Audio: bagian tanpa suara + kerasnya suara.
  let lufs = null;
  let peak = null;
  if (hasAudio) {
    const a = (await ff(ffmpegBin, ['-hide_banner', '-nostats', '-i', file, '-vn', '-af', 'silencedetect=n=-45dB:d=2,loudnorm=print_format=json', '-c:a', 'pcm_s16le', '-f', 'null', '-'])).log;
    const silStarts = [...a.matchAll(/silence_start:\s*([\d.]+)/g)].map((m) => Number(m[1]));
    const silEnds = [...a.matchAll(/silence_end:\s*([\d.]+)/g)].map((m) => Number(m[1]));
    silStarts.forEach((s, i) => {
      const e = silEnds[i] ?? duration;
      if (s > duration - 3) return; // sisa hening di ujung video wajar
      issues.push({ level: 'warn', kind: 'silence', at: s, text: `Tidak ada suara ${(e - s).toFixed(1)} dtk di ${clock(s)}.` });
    });
    try {
      const j = JSON.parse(a.slice(a.lastIndexOf('{'), a.lastIndexOf('}') + 1));
      lufs = Number(j.input_i);
      peak = Number(j.input_tp);
    } catch {
      /* loudnorm tidak mengeluarkan JSON */
    }
    if (!Number.isFinite(lufs) || lufs < -70) lufs = null;
    if (!Number.isFinite(peak)) peak = null;
    if (lufs != null && lufs < LUFS_TARGET - 5) issues.push({ level: 'warn', kind: 'loudness', text: `Suara agak pelan (${lufs.toFixed(1)} LUFS, idealnya sekitar ${LUFS_TARGET}).` });
    if (lufs != null && lufs > LUFS_TARGET + 3) issues.push({ level: 'warn', kind: 'loudness', text: `Suara terlalu keras (${lufs.toFixed(1)} LUFS, idealnya sekitar ${LUFS_TARGET}).` });
    if (peak != null && peak > -0.5) issues.push({ level: 'warn', kind: 'peak', text: `Suara bisa pecah (puncak ${peak.toFixed(1)} dB).` });
  }

  // 3. Gambar: semua frame dalam ukuran sangat kecil (waktu tiap frame pasti tepat), diperiksa 2 per detik.
  const landscape = width > height;
  const fps = Number(head.match(/,\s*([\d.]+)\s*fps/)?.[1]) || 30;
  const every = Math.max(1, Math.round(fps / RATE));
  const tw = landscape ? 240 : 135;
  const th = Math.round((tw * height) / width / 2) * 2;
  const aw = landscape ? 64 : 36;
  const ah = Math.round((aw * height) / width / 2) * 2;
  const tmp = path.join(outDir, `${id}-frames`);
  const tiny = path.join(tmp, 'a');
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tiny, { recursive: true });
  let sheet = null;
  let step = 2;
  let cols = landscape ? 6 : 8;
  try {
    const x = await ff(ffmpegBin, ['-hide_banner', '-v', 'error', '-i', file, '-map', '0:v:0', '-vf', `scale=${aw}:${ah}`, '-fps_mode', 'passthrough', '-c:v', 'png', '-f', 'image2', path.join(tiny, '%06d.png')]);
    const all = fs.readdirSync(tiny).filter((f) => f.endsWith('.png')).sort();
    if (x.code !== 0 && !all.length) throw new Error(x.log.split('\n').slice(-2).join(' '));
    const files = all.filter((_, i) => i % every === 0);

    const black = [];
    const still = [];
    let prev = null;
    for (const f of files) {
      const bmp = nativeImage.createFromPath(path.join(tiny, f)).toBitmap(); // BGRA
      const n = bmp.length / 4;
      let lum = 0;
      let diff = 0;
      for (let p = 0; p < bmp.length; p += 4) {
        lum += 0.114 * bmp[p] + 0.587 * bmp[p + 1] + 0.299 * bmp[p + 2];
        if (prev) diff += Math.abs(bmp[p] - prev[p]) + Math.abs(bmp[p + 1] - prev[p + 1]) + Math.abs(bmp[p + 2] - prev[p + 2]);
      }
      black.push(lum / n < 18);
      // Rata-rata perubahan per piksel < 0,15 (dari 255) dibanding setengah detik sebelumnya = praktis tidak bergerak.
      still.push(prev ? diff / (n * 3) < 0.15 : false);
      prev = bmp;
    }
    for (const [a, b] of spans(black, 0.5)) {
      if (a < 0.3 || b > duration - 0.5) continue; // fade di awal/akhir wajar
      issues.push({ level: 'error', kind: 'black', at: a, text: `Layar hitam ${(b - a).toFixed(1)} dtk di ${clock(a)}.` });
    }
    // Frame yang "diam" dibanding sebelumnya berarti diamnya mulai setengah detik lebih awal.
    for (const [a, b] of spans(still, 2.5)) {
      const a0 = Math.max(0, a - 1 / RATE);
      issues.push({ level: 'warn', kind: 'frozen', at: a0, text: `Gambar diam ${(b - a0).toFixed(1)} dtk di ${clock(a0)}.` });
    }
    fs.rmSync(tiny, { recursive: true, force: true });

    // 4. Lembar ringkasan: maks 48 cuplikan berjarak sama, disusun jadi satu JPEG.
    step = Math.max(2, Math.ceil(duration / 48));
    const big = path.join(tmp, 'b');
    fs.mkdirSync(big, { recursive: true });
    // Satu ffmpeg per cuplikan dengan -ss (tepat di detiknya), 4 sekaligus.
    const times = [];
    for (let t = 0; t < duration - 0.1; t += step) times.push(t);
    for (let i = 0; i < times.length; i += 4) {
      await Promise.all(
        times.slice(i, i + 4).map((t, k) =>
          ff(ffmpegBin, ['-hide_banner', '-v', 'error', '-ss', t.toFixed(3), '-i', file, '-map', '0:v:0', '-frames:v', '1', '-vf', `scale=${tw}:${th}`, '-c:v', 'png', '-f', 'image2', path.join(big, `${String(i + k).padStart(5, '0')}.png`)]),
        ),
      );
    }
    const picks = fs.readdirSync(big).filter((f) => f.endsWith('.png')).sort();
    if (!picks.length) throw new Error('tidak ada frame untuk lembar ringkasan');
    cols = Math.min(cols, picks.length);
    const rows = Math.ceil(picks.length / cols);
    const pad = 4;
    const W = cols * tw + (cols + 1) * pad;
    const H = rows * th + (rows + 1) * pad;
    const canvas = Buffer.alloc(W * H * 4);
    for (let p = 3; p < canvas.length; p += 4) canvas[p] = 255; // latar hitam pekat
    picks.forEach((f, k) => {
      const bmp = nativeImage.createFromPath(path.join(big, f)).toBitmap();
      const ox = pad + (k % cols) * (tw + pad);
      const oy = pad + Math.floor(k / cols) * (th + pad);
      for (let yy = 0; yy < th; yy++) bmp.copy(canvas, ((oy + yy) * W + ox) * 4, yy * tw * 4, (yy + 1) * tw * 4);
    });
    sheet = path.join(outDir, `${id}.jpg`);
    fs.writeFileSync(sheet, nativeImage.createFromBitmap(canvas, { width: W, height: H }).toJPEG(78));
  } catch (e) {
    issues.push({ level: 'warn', kind: 'check', text: `Pemeriksaan gambar dilewati: ${String(e.message || e).slice(0, 200)}` });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  issues.sort((a, b) => (a.at ?? -1) - (b.at ?? -1));
  return save(outDir, id, { ok: !issues.some((i) => i.level === 'error'), duration, width, height, lufs, peak, issues, sheet, sheetStep: step, sheetCols: cols });
}

function save(outDir, id, report) {
  const r = { checkedAt: new Date().toISOString(), ...report };
  fs.writeFileSync(path.join(outDir, `${id}.json`), JSON.stringify(r, null, 1));
  return r;
}

/** Laporan + lembar ringkasan sebagai data URL (untuk ditampilkan di aplikasi). */
function readReport(outDir, id) {
  const f = path.join(outDir, `${id}.json`);
  if (!fs.existsSync(f)) return null;
  const report = JSON.parse(fs.readFileSync(f, 'utf8'));
  const sheet = report.sheet && fs.existsSync(report.sheet) ? `data:image/jpeg;base64,${fs.readFileSync(report.sheet).toString('base64')}` : null;
  return { ...report, sheet };
}

/** ffmpeg yang dipakai: bawaan Remotion (biner langsung), kalau tidak ada pakai ffmpeg sistem. */
function findFfmpeg(remotionProjectPath) {
  const exe = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  const plat = process.platform === 'win32' ? `win32-${process.arch}-msvc` : process.platform === 'darwin' ? `darwin-${process.arch}` : `linux-${process.arch}-gnu`;
  if (remotionProjectPath) {
    const p = path.join(remotionProjectPath, 'node_modules', '@remotion', `compositor-${plat}`, exe);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

module.exports = { checkVideo, readReport, findFfmpeg, LUFS_TARGET };
