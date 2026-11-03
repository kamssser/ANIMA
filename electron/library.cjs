// Pustaka Video: kumpulkan semua MP4 jadi dari folder render HyperForge dan folder kerja skill
// (Animate, Bang Motion, HyperForge Studio), plus gambar mini dan tombol "buka folder".
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { shell } = require('electron');
const { ENGINES, listMp4, slugOk } = require('./skills.cjs');

/** Folder proyek skill di dalam folder kerja (bukan folder alat/brief). */
function projectDirs(root) {
  try {
    return fs
      .readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory() && slugOk(d.name) && !/^(briefs|node_modules|tools|pieces)$/.test(d.name))
      .map((d) => d.name);
  } catch {
    return [];
  }
}

function scan(s) {
  const out = new Map();
  const add = (v, source, slug) => {
    if (!out.has(v.file)) out.set(v.file, { ...v, name: path.basename(v.file), folder: path.dirname(v.file), source, slug });
  };
  // Render HyperForge (Kartun 3D & style 2D): <outputDir>/<slug>-<id job>.mp4
  if (s.outputDir) {
    for (const v of listMp4(s.outputDir, 0)) add(v, 'render', path.basename(v.file).replace(/\.mp4$/i, '').replace(/-[0-9a-f]{8}([-.].*)?$/i, ''));
  }
  // Skill: satu folder per project (slug).
  for (const e of Object.values(ENGINES)) {
    const root = e.id === 'animate' ? path.join(e.work, 'pieces') : e.work;
    for (const slug of projectDirs(root)) for (const v of e.findVideos(slug)) add(v, e.id, slug);
  }
  return [...out.values()].sort((a, b) => b.mtime.localeCompare(a.mtime));
}

function register({ ipcMain, readSettings, ffmpeg, cacheDir }) {
  ipcMain.handle('library:scan', () => scan(readSettings()));

  // Gambar mini: satu frame (detik ke-1) disimpan di cache; antrean 1 proses supaya laptop tidak berat.
  const thumbDir = path.join(cacheDir, 'thumbs');
  let chain = Promise.resolve();
  ipcMain.handle('library:thumb', (_e, file) => {
    if (!/\.mp4$/i.test(String(file)) || !fs.existsSync(file)) return null;
    const st = fs.statSync(file);
    const key = crypto.createHash('sha1').update(`${file}|${st.size}|${st.mtimeMs}`).digest('hex').slice(0, 20);
    const jpg = path.join(thumbDir, `${key}.jpg`);
    const read = () => (fs.existsSync(jpg) ? `data:image/jpeg;base64,${fs.readFileSync(jpg).toString('base64')}` : null);
    if (fs.existsSync(jpg)) return read();
    const job = chain.then(async () => {
      if (fs.existsSync(jpg)) return read();
      fs.mkdirSync(thumbDir, { recursive: true });
      const s = readSettings();
      let r = await ffmpeg(s, ['-y', '-ss', '1', '-i', file, '-frames:v', '1', '-vf', 'scale=480:-2', '-q:v', '5', jpg], { timeoutMs: 30000 });
      // Video lebih pendek dari 1 detik: ambil frame pertama.
      if (!r.ok || !fs.existsSync(jpg)) r = await ffmpeg(s, ['-y', '-i', file, '-frames:v', '1', '-vf', 'scale=480:-2', '-q:v', '5', jpg], { timeoutMs: 30000 });
      return read();
    });
    chain = job.catch(() => null);
    return job.catch(() => null);
  });

  // Buka Explorer langsung di folder video dengan file-nya terpilih.
  ipcMain.handle('library:showFile', (_e, file) => {
    if (!fs.existsSync(file)) throw new Error('File sudah tidak ada (dipindah atau dihapus).');
    shell.showItemInFolder(path.normalize(file));
    return true;
  });
}

module.exports = { register, scan };
