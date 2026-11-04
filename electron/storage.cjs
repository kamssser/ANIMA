// Pengaturan > Penyimpanan: ukuran dan pembersihan hasil generate HyperForge + cache.
// Yang bisa dihapus:
//   - file sementara proyek skill (folder frames/, tmp/, .cache/ ... yang dibuat ulang saat render);
//   - satu proyek skill utuh (folder proyek di folder kerja mesin) atau render HyperForge per judul;
//   - cache aplikasi (cache tampilan, gambar mini, laporan QA, potongan referensi gaya, folder sementara render).
// Hanya di dalam folder milik HyperForge; nama folder proyek divalidasi (slug) supaya tidak menyentuh file lain.
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { session } = require('electron');
const { ENGINES, slugOk } = require('./skills.cjs');

/** Folder sementara di dalam proyek skill: aman dihapus, dibuat ulang saat render berikutnya. */
const TEMP_RE = /^(frames?([-_]?\w+)?|_frames|\.frames|tmp|temp|\.tmp|\.cache|cache|scratch|frames_tmp)$/i;
/** Folder alat / bukan proyek di folder kerja mesin. */
const NOT_PROJECT = /^(briefs|node_modules|tools|pieces|mcp|pwmcp|pw-out|chrome-home|unduhan|scratch)$/;

async function sizeOf(p) {
  let total = 0;
  let files = 0;
  const walk = async (d) => {
    let dir;
    try {
      dir = await fsp.opendir(d);
    } catch {
      try {
        const st = await fsp.stat(d);
        total += st.size;
        files++;
      } catch {
        /* tidak ada */
      }
      return;
    }
    for await (const n of dir) {
      const f = path.join(d, n.name);
      if (n.isDirectory()) await walk(f);
      else if (n.isFile()) {
        try {
          total += (await fsp.stat(f)).size;
          files++;
        } catch {
          /* terkunci */
        }
      }
    }
  };
  await walk(p);
  return { bytes: total, files };
}

/** Folder sementara di dalam proyek (sampai kedalaman 3). */
function tempDirsIn(dir, depth = 3) {
  const out = [];
  const walk = (d, left) => {
    let names = [];
    try {
      names = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const n of names) {
      if (!n.isDirectory() || n.name === 'node_modules') continue;
      const p = path.join(d, n.name);
      if (TEMP_RE.test(n.name)) out.push(p);
      else if (left > 0) walk(p, left - 1);
    }
  };
  walk(dir, depth);
  return out;
}

const rootOf = (e) => (e.id === 'animate' ? path.join(e.work, 'pieces') : e.work);
function projectDirs(root) {
  try {
    return fs
      .readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory() && slugOk(d.name) && !NOT_PROJECT.test(d.name))
      .map((d) => d.name);
  } catch {
    return [];
  }
}

/** Render HyperForge di folder hasil: <slug>-<8 hex>[...].mp4 (+ folder <slug>/ berisi voice/words). */
function renderGroups(outputDir) {
  const groups = new Map();
  let names = [];
  try {
    names = fs.readdirSync(outputDir, { withFileTypes: true });
  } catch {
    return [];
  }
  for (const n of names) {
    if (!n.isFile()) continue;
    const m = /^([a-z0-9][a-z0-9-]*?)-[0-9a-f]{8}([-.][\w.-]*)?\.mp4$/i.exec(n.name);
    if (!m) continue;
    const g = groups.get(m[1]) || { slug: m[1], files: [], folder: null };
    g.files.push(path.join(outputDir, n.name));
    groups.set(m[1], g);
  }
  for (const n of names) {
    if (!n.isDirectory() || !slugOk(n.name)) continue;
    const d = path.join(outputDir, n.name);
    // hanya folder suara buatan HyperForge (voice.mp3 / words.json / meta.json), bukan folder lain di sana
    const own = ['voice.mp3', 'words.json', 'meta.json'].some((f) => fs.existsSync(path.join(d, f)));
    const extra = fs.readdirSync(d).every((f) => /^(voice|words|meta|lines?|vo)[\w.-]*\.(mp3|wav|json)$/i.test(f) || /^voice$/i.test(f));
    if (!own || !extra) continue;
    const g = groups.get(n.name) || { slug: n.name, files: [], folder: null };
    g.folder = d;
    groups.set(n.name, g);
  }
  return [...groups.values()];
}

function cacheItems(s, userData) {
  const items = [
    { id: 'thumbs', label: 'Gambar mini Pustaka Video', path: path.join(userData, 'thumbs'), hint: 'dibuat ulang otomatis' },
    { id: 'qa', label: 'Laporan pemeriksaan render (QA)', path: path.join(userData, 'qa'), hint: 'laporan lama di tabel render hilang' },
    { id: 'references', label: 'Potongan referensi gaya 2D', path: path.join(userData, 'references'), hint: 'diunduh ulang saat dibutuhkan' },
    { id: 'tempDir', label: 'Folder sementara render Remotion', path: s.tempDir, hint: 'sisa render yang terhenti' },
    { id: 'flowShots', label: 'Tangkapan layar Google Flow', path: path.join(ENGINES.flow.work, 'mcp', 'screenshots-debug'), hint: 'hanya untuk memeriksa' },
    { id: 'flowDownloads', label: 'Unduhan mentah Google Flow', path: path.join(ENGINES.flow.work, 'unduhan'), hint: 'klip yang sudah dipindah ke proyek aman dihapus' },
    { id: 'flowPw', label: 'Unduhan & log Playwright (Google Flow)', path: path.join(ENGINES.flow.work, 'pw-out'), hint: 'klip yang sudah dipindah ke proyek aman dihapus' },
    { id: 'logs', label: 'Log sesi Claude', paths: Object.values(ENGINES).map((e) => path.join(e.work, 'briefs')), match: /\.log$/, hint: 'riwayat obrolan tetap ada' },
  ];
  if (s.remotionProjectPath) items.push({ id: 'remotionOut', label: 'Folder out proyek Remotion', path: path.join(s.remotionProjectPath, 'out'), keep: ['.gitkeep'], hint: 'hasil uji render' });
  return items;
}

async function cacheSize(it) {
  if (it.match) {
    let bytes = 0;
    let files = 0;
    for (const d of it.paths) {
      let names = [];
      try {
        names = fs.readdirSync(d);
      } catch {
        continue;
      }
      for (const n of names.filter((x) => it.match.test(x))) {
        try {
          bytes += fs.statSync(path.join(d, n)).size;
          files++;
        } catch {
          /* abaikan */
        }
      }
    }
    return { bytes, files };
  }
  return it.path && fs.existsSync(it.path) ? sizeOf(it.path) : { bytes: 0, files: 0 };
}

/** Hapus isi folder (bukan foldernya). File yang sedang dipakai dilewati. */
function emptyDir(dir, keep = []) {
  let freed = 0;
  let names = [];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return 0;
  }
  for (const n of names) {
    if (keep.includes(n)) continue;
    const p = path.join(dir, n);
    try {
      const st = fs.statSync(p);
      freed += st.isDirectory() ? 0 : st.size;
      fs.rmSync(p, { recursive: true, force: true, maxRetries: 2 });
    } catch {
      /* terkunci */
    }
  }
  return freed;
}

function register({ ipcMain, readSettings, userData, isBusy }) {
  ipcMain.handle('storage:scan', async () => {
    const s = readSettings();
    const projects = [];
    for (const e of Object.values(ENGINES)) {
      const root = rootOf(e);
      for (const slug of projectDirs(root)) {
        const dir = path.join(root, slug);
        const [all, temps] = await Promise.all([sizeOf(dir), Promise.all(tempDirsIn(dir).map(sizeOf))]);
        projects.push({
          kind: 'skill',
          engine: e.id,
          slug,
          dir,
          bytes: all.bytes,
          tempBytes: temps.reduce((a, b) => a + b.bytes, 0),
          videos: e.findVideos(slug).length,
          mtime: fs.statSync(dir).mtime.toISOString(),
          busy: isBusy(e.id, slug),
        });
      }
    }
    for (const g of renderGroups(s.outputDir)) {
      let bytes = 0;
      let mtime = 0;
      for (const f of g.files) {
        const st = fs.statSync(f);
        bytes += st.size;
        mtime = Math.max(mtime, st.mtimeMs);
      }
      if (g.folder) bytes += (await sizeOf(g.folder)).bytes;
      projects.push({ kind: 'render', engine: 'render', slug: g.slug, dir: s.outputDir, bytes, tempBytes: 0, videos: g.files.length, mtime: new Date(mtime || Date.now()).toISOString(), busy: false });
    }
    projects.sort((a, b) => b.bytes - a.bytes);
    const caches = [];
    for (const it of cacheItems(s, userData)) caches.push({ id: it.id, label: it.label, hint: it.hint, path: it.path || it.paths?.[0] || '', ...(await cacheSize(it)) });
    let appCache = 0;
    try {
      appCache = await session.defaultSession.getCacheSize();
    } catch {
      /* abaikan */
    }
    caches.unshift({ id: 'app', label: 'Cache tampilan aplikasi (Chromium)', hint: 'cache web & shader HyperForge', path: userData, bytes: appCache, files: 0 });
    return { projects, caches, total: projects.reduce((a, p) => a + p.bytes, 0) + caches.reduce((a, c) => a + c.bytes, 0) };
  });

  /**
   * payload:
   *   { kind: 'temp' }                                   semua file sementara semua proyek skill
   *   { kind: 'cache', ids: [...] }                      cache terpilih
   *   { kind: 'project', engine, slug, mode: 'temp'|'all' }
   *   { kind: 'render', slug }                           render HyperForge satu judul
   */
  ipcMain.handle('storage:clean', async (_e, p) => {
    const s = readSettings();
    let freed = 0;
    const rm = async (target) => {
      const { bytes } = await sizeOf(target);
      fs.rmSync(target, { recursive: true, force: true, maxRetries: 3 });
      freed += bytes;
    };
    if (p.kind === 'temp') {
      for (const e of Object.values(ENGINES)) {
        const root = rootOf(e);
        for (const slug of projectDirs(root)) {
          if (isBusy(e.id, slug)) continue;
          for (const d of tempDirsIn(path.join(root, slug))) await rm(d);
        }
      }
    } else if (p.kind === 'project') {
      const e = ENGINES[p.engine];
      if (!e || !slugOk(p.slug)) throw new Error('Proyek tidak dikenal.');
      if (isBusy(e.id, p.slug)) throw new Error('Claude masih bekerja di proyek ini. Hentikan dulu.');
      const dir = path.join(rootOf(e), p.slug);
      if (!fs.existsSync(dir)) return { freed: 0 };
      if (p.mode === 'all') {
        await rm(dir);
        // riwayat obrolan & sesi proyek ikut dihapus supaya mulai bersih
        for (const ext of ['.chat.json', '.session', '.log', '.md', '.cmd']) fs.rmSync(path.join(e.work, 'briefs', p.slug + ext), { force: true });
      } else for (const d of tempDirsIn(dir)) await rm(d);
    } else if (p.kind === 'render') {
      if (!slugOk(p.slug)) throw new Error('Nama tidak valid.');
      const g = renderGroups(s.outputDir).find((x) => x.slug === p.slug);
      if (!g) return { freed: 0 };
      for (const f of g.files) await rm(f);
      if (g.folder) await rm(g.folder);
    } else if (p.kind === 'cache') {
      for (const id of p.ids || []) {
        if (id === 'app') {
          try {
            const before = await session.defaultSession.getCacheSize();
            await session.defaultSession.clearCache();
            await session.defaultSession.clearCodeCaches({});
            await session.defaultSession.clearStorageData({ storages: ['shadercache', 'cachestorage'] });
            freed += before;
          } catch {
            /* abaikan */
          }
          continue;
        }
        const it = cacheItems(s, userData).find((x) => x.id === id);
        if (!it) continue;
        if (it.match) {
          for (const d of it.paths) {
            let names = [];
            try {
              names = fs.readdirSync(d).filter((x) => it.match.test(x));
            } catch {
              continue;
            }
            for (const n of names) {
              const slug = n.replace(/\.log$/, '');
              const eng = Object.values(ENGINES).find((e) => path.join(e.work, 'briefs') === d);
              if (eng && isBusy(eng.id, slug)) continue;
              try {
                freed += fs.statSync(path.join(d, n)).size;
                fs.rmSync(path.join(d, n), { force: true });
              } catch {
                /* terkunci */
              }
            }
          }
        } else if (it.path && fs.existsSync(it.path)) {
          const before = (await sizeOf(it.path)).bytes;
          emptyDir(it.path, it.keep);
          freed += before - (await sizeOf(it.path)).bytes;
        }
      }
    }
    return { freed };
  });

}

module.exports = { register };
