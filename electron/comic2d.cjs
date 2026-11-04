// Persiapan render HyperForge di folder Remotion pengguna:
// - salin mesin src/anima/ (milik aplikasi) dari template ke proyek pengguna setiap render
// - susun props video 2D: durasi shot diselaraskan dengan timing kata dari suara (words.json)
// - props lapisan teks untuk video 3D
const fs = require('node:fs');
const path = require('node:path');
const { sanitizeSvg } = require('./svg.cjs');

const FPS = 30;
const templateAnima = () => path.join(__dirname, '..', 'remotion-template', 'src', 'anima');

/** Ganti src/anima/ di proyek pengguna dengan versi aplikasi ini (folder ini tidak untuk diedit manual). */
function syncAnima(projectPath) {
  const dst = path.join(projectPath, 'src', 'anima');
  fs.rmSync(dst, { recursive: true, force: true });
  fs.cpSync(templateAnima(), dst, { recursive: true });
  return 'src/anima/index.ts';
}

/** words.json aplikasi ([{s,e,text}]) -> [{word,start,end}] */
function readWords(dir) {
  const f = path.join(dir, 'words.json');
  if (!fs.existsSync(f)) return null;
  try {
    const w = JSON.parse(fs.readFileSync(f, 'utf8'));
    return Array.isArray(w) && w.length ? w.map((x) => ({ word: String(x.text ?? x.word ?? '').trim(), start: Number(x.s ?? x.start), end: Number(x.e ?? x.end) })).filter((x) => x.word) : null;
  } catch {
    return null;
  }
}

const tokens = (t) => String(t || '').split(/\s+/).filter(Boolean);

/**
 * Durasi shot mengikuti suara: shot k mulai saat kata pertamanya diucapkan (dihitung dari jumlah kata
 * teks shot, berurutan), berakhir saat shot berikutnya mulai. Shot tanpa teks tetap memakai durasinya sendiri.
 */
function alignShots(shots, words) {
  if (!words || !words.length) return shots;
  let wi = 0;
  const starts = shots.map((s) => {
    const n = tokens(s.text).length;
    if (!n || wi >= words.length) return null;
    const st = words[wi].start;
    wi += n;
    return st;
  });
  const end = words[words.length - 1].end + 0.6;
  const out = [];
  let t = 0;
  for (let i = 0; i < shots.length; i++) {
    // batas akhir shot i = awal shot bertimestamp berikutnya, atau akhir suara
    let next = null;
    for (let k = i + 1; k < shots.length; k++) if (starts[k] != null) { next = starts[k]; break; }
    const own = shots[i].durationInFrames / FPS;
    const stop = starts[i] != null ? (next ?? end) : t + own;
    const dur = Math.max(0.8, stop - t);
    out.push({ ...shots[i], durationInFrames: Math.round(dur * FPS) });
    t += dur;
  }
  return out;
}

/** comic = Comic2DProps tanpa words (dari aplikasi). Hasil siap ditulis ke file props. */
function build2DProps(comic, voiceDir) {
  const words = readWords(voiceDir);
  const characters = {};
  for (const [k, c] of Object.entries(comic.characters || {})) characters[k] = { name: c.name, svg: sanitizeSvg(c.svg) };
  const backgrounds = {};
  for (const [k, b] of Object.entries(comic.backgrounds || {})) backgrounds[k] = { svg: sanitizeSvg(b.svg) };
  return { ...comic, characters, backgrounds, shots: alignShots(comic.shots, words), words: words || undefined };
}

/** File suara untuk digabung ke video 2D. */
function voiceFile(voiceDir) {
  for (const f of ['voice.wav', 'voice.mp3']) {
    const p = path.join(voiceDir, f);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Folder public kecil khusus satu render (--public-dir). Render 2D dan lapisan teks tidak butuh aset 3D
 * di public/ proyek (~1,3 GB) yang kalau tidak begitu ikut disalin Remotion setiap render.
 */
function smallPublicDir(tempDir, jobId) {
  const dir = path.join(tempDir, `anima-public-${jobId}`);
  fs.mkdirSync(dir, { recursive: true });
  return { dir, cleanup: () => fs.rm(dir, { recursive: true, force: true }, () => {}) };
}

/** Props lapisan teks 3D: video 3D disalin ke folder public kecil supaya bisa dibaca Remotion. */
function buildOverlayProps(publicDir, video3d, { shots, width, height, look, brand }, voiceDir) {
  fs.copyFileSync(video3d, path.join(publicDir, 'video3d.mp4'));
  const durationInFrames = shots.reduce((n, s) => n + s.durationInFrames, 0);
  return { video: 'video3d.mp4', durationInFrames, width, height, shots, words: readWords(voiceDir) || undefined, look, brand: brand || undefined };
}

module.exports = { syncAnima, build2DProps, buildOverlayProps, smallPublicDir, voiceFile, alignShots, readWords };
