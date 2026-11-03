// Style video dari skill Claude Code pihak ketiga, dipakai UTUH (tidak diubah):
//   animate      https://github.com/cth9191/animate       (MIT) di animate-skill/animate
//   bang-motion  https://github.com/bangtutorial/bang-motion (MIT) di bang-motion-skill/bang-motion
//   animantra-vector  paket berbayar milik pengguna. Lisensinya MELARANG dibagikan ulang, jadi TIDAK ikut repo/installer:
//                     HyperForge hanya memakai skill yang sudah dipasang pengguna dari paketnya sendiri
//                     (~/.claude/skills/animantra-vector) dan menjalankan installer paket itu bila ada di laptop.
// Yang dilakukan aplikasi untuk tiap mesin:
//   1. memasang skill ke ~/.claude/skills/<nama> + kebutuhannya (browser headless, ffmpeg lengkap, alat opsional);
//   2. menyiapkan folder kerja dan brief dari project;
//   3. membuka jendela Claude Code interaktif dengan /<nama>, supaya check-in skill (story/look/storyboard,
//      style brief/rundown) dijawab pengguna persis seperti skill aslinya;
//   4. membaca video hasil untuk dimasukkan ke daftar render project.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, execFile } = require('node:child_process');

const crypto = require('node:crypto');

const isWin = process.platform === 'win32';

/** Hash isi folder (untuk skill buatan sendiri: berubah setiap kali skill diperbarui). */
function dirHash(dir) {
  const h = crypto.createHash('sha1');
  const walk = (d) => {
    for (const n of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(d, n.name);
      if (n.isDirectory()) walk(p);
      else h.update(path.relative(dir, p)).update(fs.readFileSync(p));
    }
  };
  try {
    walk(dir);
  } catch {
    /* folder tidak ada */
  }
  return h.digest('hex');
}
const HOME = os.homedir();
const SKILLS_DIR = path.join(HOME, '.claude', 'skills');

function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const isCmd = /\.cmd$/i.test(cmd);
    const c = spawn(isCmd ? `"${cmd}"` : cmd, isCmd ? args.map((a) => (/\s/.test(a) ? `"${a}"` : a)) : args, { windowsHide: true, shell: isCmd, ...opts });
    let out = '';
    const on = (b) => {
      out += b;
      opts.onLine?.(String(b));
    };
    c.stdout?.on('data', on);
    c.stderr?.on('data', on);
    c.on('error', (e) => resolve({ ok: false, out: e.message }));
    c.on('close', (code) => resolve({ ok: code === 0, out }));
  });
}
const tail = (out, n = 4) => out.split('\n').slice(-n).join('\n');

/** ffmpeg LENGKAP (filter tile/ebur128, muxer rawvideo); ffmpeg bawaan Remotion terlalu ringkas. */
async function findFullFfmpeg(which) {
  const cands = [];
  const onPath = await which('ffmpeg');
  if (onPath) cands.push(onPath);
  if (isWin) {
    const wg = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages');
    try {
      for (const d of fs.readdirSync(wg).filter((n) => /ffmpeg/i.test(n))) {
        for (const sub of fs.readdirSync(path.join(wg, d))) {
          const exe = path.join(wg, d, sub, 'bin', 'ffmpeg.exe');
          if (fs.existsSync(exe)) cands.push(exe);
        }
      }
    } catch {
      /* winget belum pernah dipakai */
    }
  }
  for (const exe of cands) {
    const r = await run(exe, ['-hide_banner', '-filters']);
    if (r.ok && /\btile\b/.test(r.out) && /\bebur128\b/.test(r.out)) return exe;
  }
  return null;
}

async function installFfmpeg(which, say) {
  if (await findFullFfmpeg(which)) return;
  if (!isWin) throw new Error('ffmpeg belum terpasang. Pasang ffmpeg (mis. brew install ffmpeg), lalu klik Siapkan lagi.');
  say('Memasang ffmpeg (winget)');
  const r = await run('winget', ['install', '--id', 'Gyan.FFmpeg', '-e', '--accept-source-agreements', '--accept-package-agreements', '--disable-interactivity'], {
    onLine: (l) => say('Memasang ffmpeg (winget)', l.trim().slice(-160)),
  });
  if (!(await findFullFfmpeg(which))) throw new Error(`Gagal memasang ffmpeg lewat winget:\n${tail(r.out)}\nPasang manual dari https://www.gyan.dev/ffmpeg/builds/ lalu klik Siapkan lagi.`);
}

async function npmGlobalRoot(which) {
  const npm = await which(isWin ? 'npm.cmd' : 'npm');
  if (!npm) return null;
  const r = await run(npm, ['root', '-g']);
  return r.ok ? r.out.trim().split(/\r?\n/).pop() : null;
}

const hasDir = (base, re) => {
  try {
    return fs.readdirSync(base).some((n) => re.test(n));
  } catch {
    return false;
  }
};
const pyHas = async (code) => (await run('python', ['-c', code])).ok;

/** Pasang skill utuh. Folder lain bernama sama yang bukan dari HyperForge dipindah sebagai cadangan. */
function installSkill(e, say) {
  say('Memasang skill ' + e.name);
  const st = skillState(e);
  if (st.foreign) {
    const bak = `${e.dst}.backup-${Date.now()}`;
    fs.renameSync(e.dst, bak);
    say('Memasang skill ' + e.name, `Skill lama dipindah ke ${bak}`);
  }
  fs.rmSync(e.dst, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(e.dst), { recursive: true });
  fs.cpSync(e.src, e.dst, { recursive: true });
  fs.writeFileSync(e.marker, JSON.stringify({ commit: e.commit, installedAt: new Date().toISOString(), by: 'HyperForge' }, null, 1));
}

function skillState(e) {
  // Skill eksternal (paket pengguna): cukup terpasang, tidak ada penanda HyperForge.
  if (e.external) {
    const exists = fs.existsSync(path.join(e.dst, 'SKILL.md'));
    return { installed: exists, exists, foreign: false };
  }
  let marker = null;
  try {
    marker = JSON.parse(fs.readFileSync(e.marker, 'utf8'));
  } catch {
    /* belum dipasang HyperForge */
  }
  const exists = fs.existsSync(path.join(e.dst, 'SKILL.md'));
  return { installed: exists && marker?.commit === e.commit, exists, foreign: exists && !marker };
}

// ---------- mesin ----------

const ENGINES = {
  animate: {
    id: 'animate',
    name: 'animate',
    commit: '7e5eb56feb2dd573f890e1b7b34748af43d58263',
    src: path.join(__dirname, '..', 'animate-skill', 'animate'),
    dst: path.join(SKILLS_DIR, 'animate'),
    marker: path.join(SKILLS_DIR, '.hyperforge-animate.json'),
    work: path.join(HOME, 'anima-animate'),
    url: 'https://github.com/cth9191/animate',
    voiceTools: ['mcp__anima__anima_vibi_voice'],
    /** galeri: style -> file gambar di dalam skill */
    samples: Object.fromEntries(['cut-paper', 'crosshatch', 'riso', 'sketchbook', 'math', 'pixel', 'isometric'].map((s) => [s, `styles/${s}/sample.png`])),
    async deps({ which }) {
      const npmRoot = await npmGlobalRoot(which);
      const base = isWin ? path.join(process.env.LOCALAPPDATA || '', 'ms-playwright') : path.join(HOME, process.platform === 'darwin' ? 'Library/Caches/ms-playwright' : '.cache/ms-playwright');
      return [
        { id: 'playwright', label: 'Playwright', ok: Boolean(npmRoot && fs.existsSync(path.join(npmRoot, 'playwright', 'package.json'))), detail: 'npm i -g playwright' },
        { id: 'chromium', label: 'Chromium untuk Playwright', ok: hasDir(base, /^chromium(_headless_shell)?-\d+/), detail: 'sekitar 150 MB' },
        { id: 'whisper', label: 'faster-whisper (opsional)', ok: await pyHas('import faster_whisper'), optional: true, detail: 'timing kata dari suara; tanpa ini diperkirakan' },
      ];
    },
    async setup({ which, say, optional }) {
      const npm = await which(isWin ? 'npm.cmd' : 'npm');
      const npx = await which(isWin ? 'npx.cmd' : 'npx');
      const npmRoot = await npmGlobalRoot(which);
      if (!npmRoot || !fs.existsSync(path.join(npmRoot, 'playwright', 'package.json'))) {
        say('Memasang Playwright');
        const r = await run(npm, ['i', '-g', 'playwright'], { onLine: (l) => say('Memasang Playwright', l.trim().slice(-160)) });
        if (!r.ok) throw new Error(`Gagal memasang Playwright:\n${tail(r.out)}`);
      }
      // Selalu: memastikan versi Chromium cocok dengan Playwright (cepat kalau sudah ada).
      say('Mengunduh Chromium (sekitar 150 MB)');
      const c = await run(npx, ['playwright', 'install', 'chromium'], { onLine: (l) => say('Mengunduh Chromium (sekitar 150 MB)', l.trim().slice(-160)) });
      if (!c.ok) throw new Error(`Gagal mengunduh Chromium:\n${tail(c.out)}`);
      if (optional && !(await pyHas('import faster_whisper'))) {
        say('Memasang faster-whisper');
        // PyAV 17+ menghapus opsi yang masih dipakai faster-whisper 1.2: kunci di bawah 17.
        const r = await run('python', ['-m', 'pip', 'install', '--user', '--disable-pip-version-check', 'faster-whisper', 'av>=14,<17'], { onLine: (l) => say('Memasang faster-whisper', l.trim().slice(-160)) });
        if (!r.ok) throw new Error(`Gagal memasang faster-whisper:\n${tail(r.out)}`);
      }
      fs.mkdirSync(path.join(this.work, 'pieces'), { recursive: true });
    },
    optionalLabel: 'Ikut pasang faster-whisper (sekitar 200 MB)',
    prompt: (slug, title) => `/animate Kerjakan brief HyperForge di briefs/${slug}.md untuk project: ${title}. Nama piece: ${slug}, folder pieces/${slug}/.`,
    videoDir: (slug) => path.join(ENGINES.animate.work, 'pieces', slug),
    findVideos(slug) {
      return listMp4(path.join(this.videoDir(slug), 'renders'), 0);
    },
    env: (work) => ({ ANIMA_ANIMATE_DIR: work }),
  },

  'bang-motion': {
    id: 'bang-motion',
    name: 'bang-motion',
    commit: 'c1aa65e921c970d858705fcb4a53a8294d1a4131',
    src: path.join(__dirname, '..', 'bang-motion-skill', 'bang-motion'),
    dst: path.join(SKILLS_DIR, 'bang-motion'),
    marker: path.join(SKILLS_DIR, '.hyperforge-bang-motion.json'),
    work: path.join(HOME, 'anima-bangmotion'),
    url: 'https://github.com/bangtutorial/bang-motion',
    voiceTools: ['mcp__anima__anima_vibi_tts'],
    samples: {
      'kartun-kolase': 'docs/gallery/11-cartoon-collage.jpg',
      jurnalisme: 'docs/gallery/09-visual-journalism.jpg',
      katalog: 'docs/gallery/08-white-catalog.jpg',
      'sketsa-vintage': 'docs/gallery/10-vintage-sketch.jpg',
      'aksi-kontinu': 'docs/gallery/05-continuous-action.jpg',
      'kartun-panggung': 'docs/gallery/06-cartoon-stage.jpg',
      opener: 'docs/gallery/02-kinetic-colorblock.jpg',
    },
    async deps() {
      const nm = path.join(this.work, 'node_modules', 'puppeteer', 'package.json');
      const cache = path.join(HOME, '.cache', 'puppeteer');
      return [
        { id: 'puppeteer', label: 'Puppeteer + Chrome', ok: fs.existsSync(nm) && (hasDir(cache, /^chrome/) || hasDir(path.join(this.work, 'node_modules', 'puppeteer', '.local-chromium'), /./)), detail: `npm i puppeteer di ${this.work} (sekitar 170 MB)` },
        { id: 'tools', label: 'Skrip skill di folder kerja', ok: fs.existsSync(path.join(this.work, 'tools', 'snap.mjs')), detail: 'salinan scripts/ (snap, export-frames, vo-pauses)' },
        { id: 'opencv', label: 'Python opencv + Pillow (opsional)', ok: await pyHas('import cv2, PIL, numpy'), optional: true, detail: 'untuk scripts/kepala-ekspresi.py (kartun panggung)' },
      ];
    },
    async setup({ which, say, optional }) {
      const npm = await which(isWin ? 'npm.cmd' : 'npm');
      fs.mkdirSync(this.work, { recursive: true });
      // Skrip skill (import 'puppeteer') mencari modul dari letak skripnya: salin scripts/ utuh ke folder kerja
      // yang punya node_modules sendiri. Folder skill di ~/.claude/skills tetap tidak disentuh.
      say('Menyalin skrip skill ke folder kerja');
      fs.rmSync(path.join(this.work, 'tools'), { recursive: true, force: true });
      fs.cpSync(path.join(this.src, 'scripts'), path.join(this.work, 'tools'), { recursive: true });
      const pkg = path.join(this.work, 'package.json');
      if (!fs.existsSync(pkg)) fs.writeFileSync(pkg, JSON.stringify({ name: 'anima-bangmotion', private: true, description: 'Folder kerja HyperForge untuk skill bang-motion' }, null, 2));
      say('Memasang Puppeteer + Chrome (sekitar 170 MB)');
      const r = await run(npm, ['i', 'puppeteer', '--no-audit', '--no-fund'], { cwd: this.work, onLine: (l) => say('Memasang Puppeteer + Chrome (sekitar 170 MB)', l.trim().slice(-160)) });
      if (!r.ok) throw new Error(`Gagal memasang Puppeteer:\n${tail(r.out)}`);
      if (optional && !(await pyHas('import cv2, PIL, numpy'))) {
        say('Memasang opencv + Pillow');
        const p = await run('python', ['-m', 'pip', 'install', '--user', '--disable-pip-version-check', 'opencv-python', 'pillow', 'numpy'], { onLine: (l) => say('Memasang opencv + Pillow', l.trim().slice(-160)) });
        if (!p.ok) throw new Error(`Gagal memasang opencv/Pillow:\n${tail(p.out)}`);
      }
    },
    optionalLabel: 'Ikut pasang opencv + Pillow untuk kartun panggung (sekitar 80 MB)',
    prompt: (slug, title) => `/bang-motion Kerjakan brief HyperForge di briefs/${slug}.md untuk project: ${title}. Folder proyek: ${slug}/.`,
    videoDir: (slug) => path.join(ENGINES['bang-motion'].work, slug),
    findVideos(slug) {
      return listMp4(this.videoDir(slug), 2);
    },
    env: (work) => ({ ANIMA_BANG_DIR: work }),
  },
};

ENGINES.studio = {
  id: 'studio',
  name: 'hyperforge-studio',
  src: path.join(__dirname, '..', 'studio-skill', 'hyperforge-studio'),
  dst: path.join(SKILLS_DIR, 'hyperforge-studio'),
  marker: path.join(SKILLS_DIR, '.hyperforge-studio.json'),
  work: path.join(HOME, 'anima-studio'),
  url: 'https://github.com/kamssser/ANIMA/tree/main/studio-skill/hyperforge-studio',
  voiceTools: ['mcp__anima__anima_vibi_tts', 'mcp__anima__anima_vibi_words'],
  samples: {},
  async deps() {
    const nm = (m) => fs.existsSync(path.join(this.work, 'node_modules', m, 'package.json'));
    const cache = path.join(HOME, '.cache', 'puppeteer');
    return [
      { id: 'puppeteer', label: 'Puppeteer + Chrome', ok: nm('puppeteer') && hasDir(cache, /^chrome/), detail: `npm i puppeteer di ${this.work} (sekitar 170 MB)` },
      { id: 'three', label: 'three.js (3D tanpa internet)', ok: nm('three'), detail: `npm i three di ${this.work}` },
    ];
  },
  async setup({ which, say }) {
    const npm = await which(isWin ? 'npm.cmd' : 'npm');
    fs.mkdirSync(this.work, { recursive: true });
    const pkg = path.join(this.work, 'package.json');
    if (!fs.existsSync(pkg)) fs.writeFileSync(pkg, JSON.stringify({ name: 'anima-studio', private: true, description: 'Folder kerja HyperForge untuk skill hyperforge-studio' }, null, 2));
    say('Memasang Puppeteer + Chrome dan three.js');
    const r = await run(npm, ['i', 'puppeteer', 'three', '--no-audit', '--no-fund'], { cwd: this.work, onLine: (l) => say('Memasang Puppeteer + Chrome dan three.js', l.trim().slice(-160)) });
    if (!r.ok) throw new Error(`Gagal memasang Puppeteer/three.js:
${tail(r.out)}`);
  },
  optionalLabel: '',
  prompt: (slug, title) => `/hyperforge-studio Kerjakan brief HyperForge di briefs/${slug}.md untuk project: ${title}. Folder proyek: ${slug}/.`,
  videoDir: (slug) => path.join(ENGINES.studio.work, slug),
  findVideos(slug) {
    return listMp4(path.join(this.videoDir(slug), 'hasil'), 0);
  },
  env: (work) => ({ ANIMA_STUDIO_DIR: work }),
};
// Skill buatan sendiri: "commit" = hash isi skill, jadi pembaruan skill di rilis berikutnya terpasang ulang otomatis.
ENGINES.studio.commit = dirHash(ENGINES.studio.src);

// ---------- Animantra: Vector (paket milik pengguna, dipakai utuh, tidak disalin HyperForge) ----------
const AV_DST = path.join(SKILLS_DIR, 'animantra-vector');
/** Folder Node + Python yang dipasang installer paket (micromamba, tanpa admin). */
function avEnvDirs() {
  const env = path.join(process.env.LOCALAPPDATA || path.join(HOME, 'AppData', 'Local'), 'animantra-vector', 'env');
  return [env, path.join(env, 'Scripts'), path.join(env, 'Library', 'bin')].filter((d) => fs.existsSync(d));
}
/** Folder paket hasil ekstrak animantra-vector.zip (berisi installer) di tempat yang umum. */
function avPackageDir() {
  for (const base of ['Downloads', 'Desktop', 'Documents']) {
    for (const name of ['animantra-vector', path.join('animantra-vector', 'animantra-vector')]) {
      const d = path.join(HOME, base, name);
      if (fs.existsSync(path.join(d, isWin ? 'install.ps1' : 'install.sh')) && fs.existsSync(path.join(d, 'skills', 'animantra-vector', 'SKILL.md'))) return d;
    }
  }
  return null;
}
const avAlat = () => {
  try {
    return JSON.parse(fs.readFileSync(path.join(AV_DST, 'engine', 'alat.json'), 'utf8'));
  } catch {
    return null;
  }
};

ENGINES.animantra = {
  id: 'animantra',
  name: 'animantra-vector',
  external: true,
  commit: 'paket milikmu',
  src: null,
  dst: AV_DST,
  marker: null,
  work: path.join(HOME, 'anima-animantra'),
  url: '',
  // Suara: vibi.pro milik pengguna lewat MCP HyperForge (pengganti gen_vo.mjs; hasilnya vo/take.wav untuk skill).
  voiceTools: ['mcp__anima__anima_vibi_tts'],
  extraTools: ['Bash(cd:*)', 'Bash(curl:*)'],
  /** Gambar patokan mutu dari skill yang terpasang (dibaca saat aplikasi berjalan, tidak ikut repo). */
  samplesRoot: AV_DST,
  samples: {
    bongkar: 'reference/patokan/kunci_1.jpg',
    'bongkar-25d': 'reference/patokan/pulpen_2.jpg',
    tur: 'reference/patokan/generator_1.jpg',
    story: 'reference/patokan/korek_2.jpg',
    pov: 'reference/patokan/korek_1.jpg',
    tutorial: 'reference/patokan/kunci_2.jpg',
    mitos: 'reference/patokan/generator_2.jpg',
    versus: 'reference/patokan/pulpen_1.jpg',
    toplist: 'reference/patokan/toplist_1.jpg',
    kalau: 'reference/patokan/generator_2.jpg',
    evolusi: 'reference/patokan/pulpen_2.jpg',
    kuis: 'reference/patokan/toplist_2.jpg',
  },
  ffmpegPath: () => avAlat()?.ffmpeg || null,
  pathDirs: avEnvDirs,
  async deps() {
    const K = AV_DST;
    const venv = path.join(K, 'engine', '.venv');
    const whisper = [path.join(venv, 'Lib', 'site-packages', 'faster_whisper'), ...(() => {
      try {
        return fs.readdirSync(path.join(venv, 'lib')).map((p) => path.join(venv, 'lib', p, 'site-packages', 'faster_whisper'));
      } catch {
        return [];
      }
    })()].some((p) => fs.existsSync(p));
    const chrome = isWin
      ? [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean).some((d) => fs.existsSync(path.join(d, 'Google', 'Chrome', 'Application', 'chrome.exe')))
      : fs.existsSync('/Applications/Google Chrome.app');
    const pwBase = isWin ? path.join(process.env.LOCALAPPDATA || '', 'ms-playwright') : path.join(HOME, process.platform === 'darwin' ? 'Library/Caches/ms-playwright' : '.cache/ms-playwright');
    const pkg = avPackageDir();
    return [
      { id: 'engine', label: 'Mesin three.js + perekam', ok: fs.existsSync(path.join(K, 'engine', 'node_modules', 'three')), detail: 'dipasang oleh installer paket Animantra' },
      { id: 'python', label: 'Python + faster-whisper (waktu tiap kata)', ok: whisper, detail: 'engine/.venv milik skill' },
      { id: 'alat', label: 'ffmpeg milik skill', ok: Boolean(avAlat()?.ffmpeg), detail: 'engine/alat.json' },
      { id: 'chrome', label: 'Google Chrome / Chromium (perekam)', ok: chrome || hasDir(pwBase, /^chromium/), detail: 'Chrome terpasang, atau Chromium diunduh installer' },
      { id: 'paket', label: 'Folder paket (untuk memasang/memperbarui)', ok: Boolean(pkg), optional: true, detail: pkg || 'ekstrak animantra-vector.zip milikmu di Downloads' },
    ];
  },
  async setup({ say }) {
    const pkg = avPackageDir();
    if (pkg) {
      // Installer resmi paket (aman diulang): Node + Python, skill, mesin, model pengenal suara.
      const label = 'Menjalankan installer Animantra: Vector (5-10 menit)';
      say(label);
      const r = isWin
        ? await run('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(pkg, 'install.ps1')], { cwd: pkg, onLine: (l) => say(label, l.trim().slice(-160)) })
        : await run('bash', [path.join(pkg, 'install.sh')], { cwd: pkg, onLine: (l) => say(label, l.trim().slice(-160)) });
      if (!r.ok || !/Selesai\./.test(r.out)) throw new Error(`Installer Animantra gagal:\n${tail(r.out, 6)}`);
    } else if (fs.existsSync(path.join(AV_DST, 'setup.mjs'))) {
      say('Menyiapkan mesin Animantra (setup.mjs)');
      const env = { ...process.env, PATH: [...avEnvDirs(), process.env.PATH].join(path.delimiter) };
      const r = await run('node', [path.join(AV_DST, 'setup.mjs')], { cwd: AV_DST, env, onLine: (l) => say('Menyiapkan mesin Animantra (setup.mjs)', l.trim().slice(-160)) });
      if (!r.ok) throw new Error(`setup.mjs gagal:\n${tail(r.out, 6)}`);
    } else {
      throw new Error('Skill Animantra: Vector belum terpasang dan paketnya tidak ditemukan. Ekstrak animantra-vector.zip milikmu ke folder Downloads, lalu klik Siapkan otomatis lagi. (HyperForge tidak menyertakan skill ini karena lisensinya melarang dibagikan ulang.)');
    }
    fs.mkdirSync(this.work, { recursive: true });
  },
  optionalLabel: '',
  prompt: (slug, title) => `/animantra-vector Kerjakan brief HyperForge di briefs/${slug}.md untuk project: ${title}. Nama proyek: ${slug}. Folder sesi = folder kerja ini.`,
  videoDir: (slug) => path.join(ENGINES.animantra.work, slug),
  findVideos(slug) {
    return listMp4(this.videoDir(slug), 0);
  },
  env: (work) => ({ KB_DIR: work, ANIMA_ANIMANTRA_DIR: work }),
};

/** File .mp4 di folder (sampai kedalaman depth), tanpa audio/stem/frame. */
function listMp4(dir, depth) {
  const out = [];
  const walk = (d, left) => {
    let names = [];
    try {
      names = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const n of names) {
      const p = path.join(d, n.name);
      if (n.isDirectory()) {
        if (left > 0 && !/^(frames|node_modules|\.)/i.test(n.name)) walk(p, left - 1);
      } else if (/\.mp4$/i.test(n.name) && !/^(audio|stem)/i.test(n.name)) {
        const st = fs.statSync(p);
        out.push({ file: p, name: path.relative(dir, p).replace(/\\/g, '/'), size: st.size, mtime: st.mtime.toISOString() });
      }
    }
  };
  walk(dir, depth);
  return out.sort((a, b) => (a.name.endsWith('share.mp4') ? -1 : b.name.endsWith('share.mp4') ? 1 : b.mtime.localeCompare(a.mtime)));
}

const slugOk = (s) => /^[a-z0-9][a-z0-9-]{0,63}$/.test(String(s));
const engineOf = (id) => {
  const e = ENGINES[id];
  if (!e) throw new Error(`Mesin skill tidak dikenal: ${id}`);
  return e;
};

/**
 * Siapkan sesi skill untuk satu project: cek kebutuhan, tulis brief + file pendukung + konfigurasi MCP.
 * Dipakai jendela terminal (skill:open) dan panel obrolan di aplikasi (skillchat.cjs).
 */
async function prepareSession(e, { slug, title, brief, files }, { which, claudeCodePath, mcpServerPath, settingsFile, check }) {
  if (!slugOk(slug)) throw new Error('Judul project tidak bisa dijadikan nama folder. Ganti judulnya.');
  const st = await check(e.id);
  const missing = st.items.filter((i) => !i.ok && !i.optional).map((i) => i.label);
  if (missing.length) throw new Error(`Belum siap: ${missing.join(', ')}. Buka Pengaturan > Skill video lalu klik Siapkan otomatis.`);
  fs.mkdirSync(path.join(e.work, 'briefs'), { recursive: true });
  const briefFile = path.join(e.work, 'briefs', `${slug}.md`);
  if (brief) fs.writeFileSync(briefFile, brief);
  // File pendukung dari aplikasi (mis. SVG karakter HyperForge) ke folder proyek; nama file dibatasi.
  for (const [rel, content] of Object.entries(files || {})) {
    if (!/^[\w-]+(\/[\w.-]+)?$/.test(rel) || rel.includes('..')) continue;
    const f = path.join(e.videoDir(slug), rel);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, String(content));
  }
  // MCP HyperForge hanya untuk suara vibi.pro: membaca kunci vibi dari pengaturan aplikasi.
  const node = await which('node');
  const mcpFile = path.join(e.work, 'briefs', '.hyperforge-mcp.json');
  fs.writeFileSync(mcpFile, JSON.stringify({ mcpServers: { anima: { type: 'stdio', command: node, args: [mcpServerPath()], env: { ANIMA_SETTINGS_FILE: settingsFile(), ...e.env(e.work) } } } }, null, 1));
  const claude = await claudeCodePath();
  const ff = (e.ffmpegPath && e.ffmpegPath()) || (await findFullFfmpeg(which));
  const ffDir = ff ? path.dirname(ff) : '';
  // PATH tambahan untuk sesi: folder ffmpeg + folder Node/Python milik skill (kalau ada).
  const pathPrefix = [ffDir, ...(e.pathDirs ? e.pathDirs() : [])].filter(Boolean).join(path.delimiter);
  const npmRoot = await npmGlobalRoot(which);
  // Tanpa tanda kutip / karakter khusus cmd di dalam prompt (prompt diapit "..." di file .cmd).
  const cleanTitle = String(title || slug).replace(/["%^&|<>()!]/g, '').slice(0, 80);
  const prompt = e.prompt(slug, cleanTitle);
  const allowed = ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebSearch', 'WebFetch', 'Skill', 'Bash(node:*)', 'Bash(ffmpeg:*)', 'Bash(ffprobe:*)', 'Bash(python:*)', 'Bash(ls:*)', 'Bash(mkdir:*)', 'Bash(cp:*)', ...e.voiceTools, ...(e.extraTools || [])];
  return { mcpFile, ffDir, pathPrefix, npmRoot, claude, prompt, allowed, briefFile };
}

function register({ ipcMain, getWin, which, claudeCodePath, mcpServerPath, settingsFile }) {
  const sayFor = (engine) => (step, line) => {
    const w = getWin();
    if (w && !w.isDestroyed()) w.webContents.send('skill:event', { engine, step, line });
  };

  async function check(id) {
    const e = engineOf(id);
    const [node, claude, ffmpeg] = await Promise.all([which('node'), claudeCodePath(), e.ffmpegPath ? null : findFullFfmpeg(which)]);
    const extra = await e.deps({ which });
    const skill = skillState(e);
    const items = [
      {
        id: 'skill',
        label: `Skill ${e.name}`,
        ok: skill.installed,
        detail: e.external
          ? skill.installed
            ? `~/.claude/skills/${e.name} (dari paket milikmu)`
            : 'Belum dipasang: butuh paket milikmu (tidak disertakan HyperForge)'
          : skill.installed
            ? `~/.claude/skills/${e.name} (commit ${e.commit.slice(0, 7)})`
            : skill.foreign
              ? `Ada skill ${e.name} lain: akan disimpan sebagai cadangan`
              : 'Belum dipasang',
      },
      { id: 'claude', label: 'Claude Code', ok: Boolean(claude), detail: claude ? undefined : 'Install Claude Code lalu login' },
      { id: 'node', label: 'Node.js', ok: Boolean(node) },
      // Skill dengan ffmpeg sendiri (Animantra) tidak butuh ffmpeg lengkap sistem.
      ...(e.ffmpegPath ? [] : [{ id: 'ffmpeg', label: 'ffmpeg lengkap', ok: Boolean(ffmpeg), detail: ffmpeg ?? 'dipasang lewat winget (Gyan.FFmpeg)' }]),
      ...extra,
    ];
    return { engine: e.id, ready: items.every((i) => i.ok || i.optional), items, workDir: e.work, commit: e.commit, url: e.url, optionalLabel: e.optionalLabel };
  }

  ipcMain.handle('skill:check', (_e, id) => check(id));
  const deps = { which, claudeCodePath, mcpServerPath, settingsFile, check };
  // Panel obrolan Claude di dalam aplikasi (pengganti jendela terminal).
  require('./skillchat.cjs').register({ ipcMain, getWin, engineOf, prepareSession: (e, p) => prepareSession(e, p, deps) });

  ipcMain.handle('skill:setup', async (_e, { engine, optional }) => {
    const e = engineOf(engine);
    const say = sayFor(engine);
    if (!(await which('node'))) throw new Error('Node.js belum terpasang. Install Node.js LTS dari nodejs.org, lalu buka ulang HyperForge.');
    // Skill eksternal dipasang oleh installer paketnya sendiri (di e.setup), bukan disalin dari aplikasi.
    if (e.src) installSkill(e, say);
    await e.setup({ which, say, optional });
    if (!e.ffmpegPath) await installFfmpeg(which, say);
    fs.mkdirSync(path.join(e.work, 'briefs'), { recursive: true });
    say('Selesai');
    return check(engine);
  });

  /** Gambar contoh tiap style dari skill (untuk galeri di aplikasi). */
  ipcMain.handle('skill:samples', (_e, id) => {
    const e = engineOf(id);
    const out = {};
    for (const [k, rel] of Object.entries(e.samples)) {
      const f = path.join(e.samplesRoot ?? e.src, rel);
      if (fs.existsSync(f)) out[k] = `data:image/${/\.png$/i.test(f) ? 'png' : 'jpeg'};base64,${fs.readFileSync(f).toString('base64')}`;
    }
    return out;
  });

  /** Tulis brief lalu buka jendela Claude Code dengan /<skill>. payload: { engine, slug, title, brief } */
  ipcMain.handle('skill:open', async (_e, { engine, slug, title, brief, files }) => {
    const e = engineOf(engine);
    const { mcpFile, pathPrefix, npmRoot, claude, prompt, allowed, briefFile } = await prepareSession(e, { slug, title, brief, files }, deps);
    if (!isWin) throw new Error(`Jendela Claude otomatis baru tersedia di Windows. Jalankan manual: cd ${e.work} && claude "${prompt}"`);

    // Peluncur .cmd: PATH berisi ffmpeg lengkap; NODE_PATH = modul global npm.
    const launcher = path.join(e.work, 'briefs', `${slug}.cmd`);
    fs.writeFileSync(
      launcher,
      [
        '@echo off',
        'chcp 65001 >nul',
        `title HyperForge ${e.name} - ${slug}`,
        `cd /d "${e.work}"`,
        pathPrefix ? `set "PATH=${pathPrefix};%PATH%"` : '',
        npmRoot ? `set "NODE_PATH=${npmRoot}"` : '',
        `echo HyperForge: Claude Code + skill ${e.name}. Jawab pertanyaan dan persetujuan skill di jendela ini.`,
        'echo Setelah video MP4 jadi: di HyperForge buka tab Render, klik Masukkan ke daftar render.',
        'echo.',
        // prompt di depan: --allowedTools menerima banyak nilai, jadi harus di akhir
        `"${claude}" "${prompt}" --mcp-config "${mcpFile}" --allowedTools ${allowed.map((a) => `"${a}"`).join(' ')}`,
        'echo.',
        'echo Sesi Claude selesai. Tekan tombol apa saja untuk menutup.',
        'pause >nul',
      ]
        .filter(Boolean)
        .join('\r\n'),
    );
    spawn('cmd.exe', ['/c', 'start', `HyperForge ${e.name} ${slug}`, '/D', e.work, launcher], { detached: true, stdio: 'ignore', windowsHide: false }).unref();
    return { workDir: e.work, briefFile };
  });

  ipcMain.handle('skill:status', (_e, { engine, slug }) => {
    const e = engineOf(engine);
    if (!slugOk(slug)) return { exists: false, videos: [] };
    const dir = e.videoDir(slug);
    return { exists: fs.existsSync(dir), dir, videos: e.findVideos(slug), hasBrief: fs.existsSync(path.join(e.work, 'briefs', `${slug}.md`)) };
  });

  ipcMain.handle('skill:openFolder', (_e, { engine, slug }) => {
    const e = engineOf(engine);
    const dir = slugOk(slug) && fs.existsSync(e.videoDir(slug)) ? e.videoDir(slug) : e.work;
    fs.mkdirSync(dir, { recursive: true });
    execFile(isWin ? 'explorer.exe' : 'xdg-open', [dir]);
    return dir;
  });
}

module.exports = { register, ENGINES, listMp4, slugOk };
