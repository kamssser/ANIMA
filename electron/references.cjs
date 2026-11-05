// Potongan referensi gaya (seperti references/frames di mromidev/claude-animated-shorts):
// lembar pratinjau frame (storyboard) dari video YouTube referensi tiap style, diunduh ke laptop pengguna
// saat dibutuhkan (tidak ikut installer), lalu dilihat Claude saat menggambar dan saat memeriksa hasil.
const fs = require('node:fs');
const path = require('node:path');
const { appFile } = require('./paths.cjs');

const STYLES = () => JSON.parse(fs.readFileSync(appFile('shared', 'visual-styles.json'), 'utf8'));
const SHEETS_PER_VIDEO = 3;

function styleDef(id) {
  const all = STYLES();
  const real = all.aliases?.[id] ?? id;
  return all.styles.find((s) => s.id === real) || null;
}

/** Unduh beberapa lembar storyboard (grid frame kecil) dari satu video. */
async function fetchStoryboard(videoId, outDir) {
  const html = await (
    await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en`, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en' } })
  ).text();
  const m = html.match(/"playerStoryboardSpecRenderer":\{"spec":"([^"]+)"/);
  if (!m) return [];
  const parts = m[1].replace(/\\u0026/g, '&').split('|');
  const base = parts[0];
  const levels = parts.slice(1).map((p, i) => {
    const [w, h, count, cols, rows, , name, sigh] = p.split('#');
    return { L: i, w: +w, h: +h, count: +count, cols: +cols, rows: +rows, name, sigh };
  });
  const lv = levels[levels.length - 1]; // resolusi terbesar
  const sheets = Math.max(1, Math.ceil(lv.count / (lv.cols * lv.rows)));
  const pick = Math.min(sheets, SHEETS_PER_VIDEO);
  const out = [];
  for (let k = 0; k < pick; k++) {
    // sebar merata, lewati lembar pertama (biasanya judul) kalau lembarnya cukup banyak
    const n = sheets > pick ? Math.floor(((k + 0.5) * sheets) / pick) : k;
    const b = base.replace('$L', lv.L).replace('$N', lv.name).replace('$M', n);
    const r = await fetch(b + (b.includes('?') ? '&' : '?') + 'sigh=' + lv.sigh);
    if (!r.ok) continue;
    const f = path.join(outDir, `${videoId}_${String(n).padStart(2, '0')}.jpg`);
    fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
    out.push(f);
  }
  return out;
}

/**
 * Pastikan potongan referensi style sudah ada di <baseDir>/<styleId>/. Hasil: daftar file (maks 6).
 * Gagal unduh (offline) tidak menghentikan proses: Claude tetap menggambar dari aturan teks.
 */
async function ensureStyleReferences(baseDir, styleId, say = () => {}) {
  const st = styleDef(styleId);
  if (!st || !st.references?.length) return [];
  const dir = path.join(baseDir, st.id);
  fs.mkdirSync(dir, { recursive: true });
  for (const vid of st.references) {
    if (fs.readdirSync(dir).some((f) => f.startsWith(`${vid}_`))) continue;
    say(`Mengambil potongan referensi gaya ${st.label}...`);
    try {
      await fetchStoryboard(vid, dir);
    } catch {
      /* offline: lanjut tanpa referensi video ini */
    }
  }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jpg')).map((f) => path.join(dir, f));
  // ambil merata dari tiap video
  const byVid = {};
  for (const f of files) (byVid[path.basename(f).split('_')[0]] ||= []).push(f);
  const lists = Object.values(byVid);
  const out = [];
  for (let i = 0; out.length < 6 && lists.some((l) => l[i]); i++) for (const l of lists) if (l[i] && out.length < 6) out.push(l[i]);
  return out;
}

module.exports = { ensureStyleReferences, styleDef };
