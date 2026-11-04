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
const reach = require('./reach.cjs');

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
// ---------- Python ----------
// Windows punya "python.exe" palsu (alias Microsoft Store di WindowsApps) yang hanya mencetak "Python was not found;
// run without arguments to install from the Microsoft Store". Folder Python asli ditaruh di depan PATH proses utama
// (ikut ke semua proses anak, termasuk sesi Claude), dan Python dipasang otomatis bila belum ada.
function pythonDirs() {
  if (!isWin) return [];
  const bases = [path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python'), process.env.PROGRAMFILES || 'C:\\Program Files'];
  const out = [];
  for (const b of bases) {
    try {
      for (const n of fs.readdirSync(b).filter((x) => /^Python3\d+$/i.test(x)).sort((a, c) => Number(c.slice(7)) - Number(a.slice(7)))) {
        const d = path.join(b, n);
        if (fs.existsSync(path.join(d, 'python.exe'))) out.push(d);
      }
    } catch {
      /* folder tidak ada */
    }
  }
  return out;
}
function usePythonPath() {
  const d = pythonDirs()[0];
  if (!d) return false;
  const parts = (process.env.PATH || '').split(path.delimiter);
  if (parts[0] !== d) process.env.PATH = [d, path.join(d, 'Scripts'), ...parts.filter((p) => p !== d && p !== path.join(d, 'Scripts'))].join(path.delimiter);
  return true;
}
usePythonPath();
const pyOk = async () => {
  const r = await run('python', ['-c', 'import sys; print(sys.version_info[0]); sys.exit(sys.version_info < (3, 9))']);
  return r.ok && /^3\s*$/m.test(r.out);
};
/** Pastikan Python 3 asli tersedia; di Windows pasang Python 3.12 (per pengguna, tanpa admin) lewat winget. */
async function ensurePython(say) {
  if (await pyOk()) return true;
  if (usePythonPath() && (await pyOk())) return true;
  if (!isWin) throw new Error('Python 3 belum terpasang. Pasang Python 3.11+ lalu klik Siapkan lagi.');
  const label = 'Memasang Python 3.12 (winget, sekali saja)';
  say(label);
  const r = await run('winget', ['install', '--id', 'Python.Python.3.12', '-e', '--scope', 'user', '--accept-source-agreements', '--accept-package-agreements', '--disable-interactivity'], {
    onLine: (l) => say(label, l.trim().slice(-160)),
  });
  if (usePythonPath() && (await pyOk())) return true;
  throw new Error(`Python belum bisa dipasang otomatis:\n${tail(r.out)}\nPasang Python 3.12 dari https://www.python.org/downloads/ (centang "Add python.exe to PATH"), lalu klik Siapkan lagi.`);
}
/** pip install --user; kembalikan pesan gagal (null = berhasil). */
async function pipInstall(pkgs, say, label) {
  await ensurePython(say);
  say(label);
  const r = await run('python', ['-m', 'pip', 'install', '--user', '--disable-pip-version-check', ...pkgs], { onLine: (l) => say(label, l.trim().slice(-160)) });
  return r.ok ? null : tail(r.out);
}
const pyHas = async (code) => (await pyOk()) && (await run('python', ['-c', code])).ok;

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
        // PyAV 17+ menghapus opsi yang masih dipakai faster-whisper 1.2: kunci di bawah 17. Opsional: gagal = peringatan.
        const err = await pipInstall(['faster-whisper', 'av>=14,<17'], say, 'Memasang faster-whisper').catch((e) => e.message);
        if (err) say('faster-whisper dilewati (opsional)', err.slice(-300));
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
        // Opsional (hanya kartun panggung): gagal = peringatan, Bang Motion tetap siap dipakai.
        const err = await pipInstall(['opencv-python', 'pillow', 'numpy'], say, 'Memasang opencv + Pillow').catch((e) => e.message);
        if (err) say('opencv + Pillow dilewati (opsional)', err.slice(-300));
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
      { id: 'edu', label: 'Skill edu-motion-studio (riset & naskah edukasi)', ok: skillState(EDU_SKILL).installed, optional: true, detail: 'dipasang otomatis bersama HyperForge Studio' },
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
    ensureEduSkill(say);
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

// edu-motion-studio (milik pemilik HyperForge): "otak redaksi" explainer edukasi (riset, hook, naskah, storyboard).
// Dipasang bersama HyperForge Studio; dipakai penuh oleh style Explainer Datar (aturan HyperForge di brief menang).
const EDU_SKILL = {
  name: 'edu-motion-studio',
  src: path.join(__dirname, '..', 'edu-skill', 'edu-motion-studio'),
  dst: path.join(SKILLS_DIR, 'edu-motion-studio'),
  marker: path.join(SKILLS_DIR, '.hyperforge-edu-motion-studio.json'),
};
EDU_SKILL.commit = dirHash(EDU_SKILL.src);
/** Pasang/perbarui edu-motion-studio bila perlu (tidak pernah melempar error). */
function ensureEduSkill(say) {
  try {
    if (!skillState(EDU_SKILL).installed) installSkill(EDU_SKILL, say || (() => {}));
    return true;
  } catch (err) {
    if (say) say('Skill edu-motion-studio belum terpasang', String(err.message || err).slice(0, 200));
    return false;
  }
}

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

// ---------- Skill yang diambil dari GitHub pada commit tetap (dipakai utuh, tidak disalin ke repo HyperForge) ----------
const HF_HOME = path.join(HOME, '.hyperforge');
/** Folder berisi python3 -> python (Windows tidak punya python3; skrip skill memanggil python3). */
const SHIM_DIR = path.join(HF_HOME, 'bin');
function ensureShims() {
  if (!isWin) return;
  fs.mkdirSync(SHIM_DIR, { recursive: true });
  fs.writeFileSync(path.join(SHIM_DIR, 'python3'), '#!/bin/sh\nexec python "$@"\n');
  fs.writeFileSync(path.join(SHIM_DIR, 'python3.cmd'), '@python %*\r\n');
}
const shimDirs = () => (isWin && fs.existsSync(path.join(SHIM_DIR, 'python3')) ? [SHIM_DIR] : []);

/** sh.exe dari Git for Windows (skrip .sh skill). */
async function findSh(which) {
  const c = [];
  if (process.env.CLAUDE_CODE_GIT_BASH_PATH) c.push(path.join(path.dirname(process.env.CLAUDE_CODE_GIT_BASH_PATH), 'sh.exe'), process.env.CLAUDE_CODE_GIT_BASH_PATH);
  if (!isWin) c.push('/bin/sh');
  for (const base of [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], path.join(process.env.LOCALAPPDATA || '', 'Programs')].filter(Boolean)) {
    c.push(path.join(base, 'Git', 'bin', 'sh.exe'), path.join(base, 'Git', 'usr', 'bin', 'sh.exe'));
  }
  const git = await which('git');
  if (git) {
    let d = path.dirname(git);
    for (let i = 0; i < 3; i++, d = path.dirname(d)) c.push(path.join(d, 'bin', 'sh.exe'), path.join(d, 'usr', 'bin', 'sh.exe'));
  }
  return c.find((p) => fs.existsSync(p)) || null;
}

/**
 * Ambil repo GitHub pada commit tertentu ke ~/.hyperforge/src/<nama> (sparse bila perlu), tanpa riwayat.
 * Mengembalikan folder hasil checkout.
 */
async function gitCheckout(which, { repo, commit, name, sparse }, say, label) {
  const git = await which('git');
  if (!git) throw new Error('git belum terpasang. Install Git for Windows (git-scm.com), lalu klik Siapkan lagi.');
  const dir = path.join(HF_HOME, 'src', name);
  const g = (args, opts) => run(git, ['-C', dir, ...args], opts);
  if (!fs.existsSync(path.join(dir, '.git'))) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const r = await run(git, ['init', '-q', dir]);
    if (!r.ok) throw new Error(`git init gagal:\n${tail(r.out)}`);
    await g(['remote', 'add', 'origin', repo]);
  }
  if (sparse) {
    await g(['config', 'core.sparseCheckout', 'true']);
    await g(['sparse-checkout', 'set', '--no-cone', ...sparse]);
  }
  say(label);
  const f = await g(['fetch', '-q', '--depth', '1', '--filter=blob:none', 'origin', commit], { onLine: (l) => say(label, l.trim().slice(-160)) });
  if (!f.ok) throw new Error(`Gagal mengunduh ${repo}:\n${tail(f.out)}`);
  const c = await g(['checkout', '-q', '--force', 'FETCH_HEAD']);
  if (!c.ok) throw new Error(`Gagal checkout ${repo}:\n${tail(c.out)}`);
  return dir;
}

/** Pasang skill dari GitHub (commit tetap) ke ~/.claude/skills/<nama>, isi persis seperti repo aslinya. */
async function gitInstallSkill(e, which, say) {
  const src = await gitCheckout(which, { repo: e.git.repo, commit: e.commit, name: e.name, sparse: e.git.sparse }, say, `Mengunduh skill ${e.name}`);
  say('Memasang skill ' + e.name);
  const st = skillState(e);
  if (st.foreign) {
    const bak = `${e.dst}.backup-${Date.now()}`;
    fs.renameSync(e.dst, bak);
    say('Memasang skill ' + e.name, `Skill lama dipindah ke ${bak}`);
  }
  fs.rmSync(e.dst, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(e.dst), { recursive: true });
  const from = path.join(src, e.git.sub || '');
  fs.cpSync(from, e.dst, { recursive: true, filter: (p) => !p.slice(from.length).split(/[\\/]/).includes('.git') });
  fs.writeFileSync(e.marker, JSON.stringify({ commit: e.commit, installedAt: new Date().toISOString(), by: 'HyperForge', repo: e.git.repo }, null, 1));
}

const chromeExe = () =>
  isWin
    ? [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA]
        .filter(Boolean)
        .map((d) => path.join(d, 'Google', 'Chrome', 'Application', 'chrome.exe'))
        .find((p) => fs.existsSync(p)) || null
    : ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/opt/google/chrome/chrome', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p)) || null;

// Lemo-Opuscar (LemoLab, MIT): skill kecil yang mengunduh pustaka 66 style ke ~/lemo-opuscar.
const LEMO_LIB = path.join(HOME, 'lemo-opuscar');
/** Path untuk skrip sh (Git Bash): C:\Users\x -> /c/Users/x. */
const posix = (p) => (isWin ? p.replace(/^([A-Za-z]):/, (_m, d) => `/${d.toLowerCase()}`).split(path.sep).join('/') : p);
ENGINES.lemo = {
  id: 'lemo',
  name: 'lemo-opuscar',
  commit: 'bebbbe1aa92a3cb4bb6f83500e61b23a17d1aa00',
  git: { repo: 'https://github.com/lemomo-ai/lemo-opuscar.git', sub: 'plugin/skills/lemo-opuscar', sparse: ['/plugin/skills/lemo-opuscar/'] },
  src: null,
  dst: path.join(SKILLS_DIR, 'lemo-opuscar'),
  marker: path.join(SKILLS_DIR, '.hyperforge-lemo-opuscar.json'),
  work: path.join(HOME, 'anima-lemo'),
  url: 'https://github.com/lemomo-ai/lemo-opuscar',
  license: 'MIT, contoh film CC BY 4.0',
  voiceTools: ['mcp__anima__anima_vibi_tts', 'mcp__anima__anima_vibi_words'],
  extraTools: ['Bash(sh:*)', 'Bash(cd:*)', 'Bash(bash:*)'],
  samples: {},
  pathDirs: shimDirs,
  async deps({ which }) {
    const py = path.join(LEMO_LIB, '.venv', isWin ? 'Scripts' : 'bin', isWin ? 'python.exe' : 'python');
    return [
      { id: 'git', label: 'Git + sh (Git for Windows)', ok: Boolean((await which('git')) && (await findSh(which))), detail: 'untuk skrip setup.sh skill' },
      { id: 'lib', label: 'Pustaka style (~/lemo-opuscar)', ok: fs.existsSync(path.join(LEMO_LIB, 'AGENTS.md')), detail: 'diunduh setup.sh skill (git sparse)' },
      { id: 'node', label: 'Paket Node + browser render', ok: fs.existsSync(path.join(LEMO_LIB, 'node_modules', '.lemo-ok')), detail: 'playwright-core, three, chromium-headless-shell' },
      { id: 'py', label: 'Python 3.11+ (venv pustaka)', ok: fs.existsSync(py) && fs.existsSync(path.join(LEMO_LIB, '.venv', '.lemo-core')), detail: 'numpy, scipy, soundfile, pillow (SFX, mix, subtitle)' },
    ];
  },
  async setup({ which, say }) {
    ensureShims();
    const sh = await findSh(which);
    if (!sh) throw new Error('sh.exe (Git for Windows) tidak ditemukan. Install Git for Windows lalu klik Siapkan lagi.');
    const env = { ...process.env, LEMO_OPUSCAR_HOME: posix(LEMO_LIB), PATH: [...shimDirs(), process.env.PATH].join(path.delimiter) };
    const script = path.join(this.dst, 'scripts', 'setup.sh');
    let label = 'Mengunduh pustaka style Lemo-Opuscar';
    say(label);
    let r = await run(sh, [script], { cwd: HOME, env, onLine: (l) => say(label, l.trim().slice(-160)) });
    if (!r.ok || !/LIB=/.test(r.out)) throw new Error(`setup.sh gagal:\n${tail(r.out, 6)}`);
    if (isWin) {
      // setup.sh memakai .venv/bin/python (gaya Linux/macOS). Di Windows venv ada di .venv/Scripts: buat venv lalu
      // junction .venv/bin -> .venv/Scripts supaya skrip skill berjalan apa adanya.
      const venv = path.join(LEMO_LIB, '.venv');
      if (!fs.existsSync(path.join(venv, 'Scripts', 'python.exe'))) {
        await ensurePython(say);
        say('Membuat Python venv pustaka');
        fs.rmSync(venv, { recursive: true, force: true });
        const v = await run('python', ['-m', 'venv', venv]);
        if (!v.ok) throw new Error(`Gagal membuat venv (butuh Python 3.11+ di PATH):\n${tail(v.out)}`);
      }
      const bin = path.join(venv, 'bin');
      if (!fs.existsSync(bin)) fs.symlinkSync(path.join(venv, 'Scripts'), bin, 'junction');
    }
    label = 'Memasang paket Lemo-Opuscar (Node, browser, Python) beberapa menit';
    say(label);
    r = await run(sh, [script, 'deps'], { cwd: HOME, env, onLine: (l) => say(label, l.trim().slice(-160)) });
    if (!r.ok) throw new Error(`setup.sh deps gagal:\n${tail(r.out, 6)}`);
    fs.mkdirSync(this.work, { recursive: true });
  },
  optionalLabel: '',
  prompt: (slug, title) => `/lemo-opuscar Kerjakan brief HyperForge di briefs/${slug}.md untuk project: ${title}. Folder proyek: ${slug}/.`,
  videoDir: (slug) => path.join(ENGINES.lemo.work, slug),
  findVideos(slug) {
    return listMp4(this.videoDir(slug), 1);
  },
  env: (work) => ({ ANIMA_WORK_DIR: work, LEMO_OPUSCAR_HOME: posix(LEMO_LIB) }),
};

// motionmaxxing (Tejash Makwana, Apache-2.0): motion graphic promo / kinetic type.
ENGINES.motionmaxxing = {
  id: 'motionmaxxing',
  name: 'motionmaxxing',
  commit: '8c8ec0f2a6f6c9a0da15cd24f7b1298ab298368c',
  // docs/media (video perbandingan merek, 20 MB) tidak ikut, sama seperti install.sh --copy skill ini.
  git: { repo: 'https://github.com/Tejashmakwana/motionmaxxing.git', sub: '', sparse: ['/*', '!/docs/media/'] },
  src: null,
  dst: path.join(SKILLS_DIR, 'motionmaxxing'),
  marker: path.join(SKILLS_DIR, '.hyperforge-motionmaxxing.json'),
  work: path.join(HOME, 'anima-motionmaxxing'),
  url: 'https://github.com/Tejashmakwana/motionmaxxing',
  license: 'Apache-2.0',
  voiceTools: ['mcp__anima__anima_vibi_tts', 'mcp__anima__anima_vibi_words'],
  extraTools: ['Bash(bash:*)', 'Bash(sh:*)', 'Bash(python3:*)', 'Bash(cd:*)'],
  samples: {},
  pathDirs: shimDirs,
  async deps({ which }) {
    const nodeV = Number(process.versions.node.split('.')[0]);
    return [
      { id: 'sh', label: 'Git Bash (skrip .sh)', ok: Boolean(await findSh(which)), detail: 'Git for Windows' },
      { id: 'python', label: 'Python 3.9+ (python3)', ok: await pyHas('import sys; sys.exit(sys.version_info < (3, 9))'), detail: 'look.py, mix.py, voice.py' },
      { id: 'chrome', label: 'Google Chrome (render)', ok: Boolean(chromeExe()), detail: 'Chrome terpasang' },
      { id: 'nodever', label: 'Node.js 22+', ok: nodeV >= 22 || Boolean(await which('node')), optional: true, detail: 'skill meminta Node 22+' },
    ];
  },
  async setup({ say }) {
    await ensurePython(say);
    ensureShims();
    fs.mkdirSync(this.work, { recursive: true });
  },
  optionalLabel: '',
  prompt: (slug, title) => `/motionmaxxing Kerjakan brief HyperForge di briefs/${slug}.md untuk project: ${title}. Folder proyek: ${slug}/.`,
  videoDir: (slug) => path.join(ENGINES.motionmaxxing.work, slug),
  findVideos(slug) {
    return listMp4(this.videoDir(slug), 1).filter((v) => !/draft/i.test(v.name));
  },
  env: (work) => ({ ANIMA_WORK_DIR: work, CHROME_PATH: chromeExe() || '' }),
};

// Google Flow (Veo) lewat google-flow-browser-mcp (TMSSS05, MIT): video + SFX dari Flow, naskah dari Claude,
// suara dari vibi.pro. Chrome khusus (profil terpisah, port CDP sendiri) supaya akun Google pengguna tetap aman.
const FLOW_WORK = path.join(HOME, 'anima-flow');
const FLOW_MCP = path.join(FLOW_WORK, 'mcp');
const FLOW_HOME = path.join(FLOW_WORK, 'chrome-home');
const FLOW_UDD = path.join(FLOW_HOME, '.config', 'google-chrome');
const FLOW_DL = path.join(FLOW_WORK, 'unduhan');
const FLOW_PORT = 9333;
const FLOW_URL = 'https://labs.google/fx/tools/flow';
const FLOW_COMMIT = '0c8e80ae4acb4475f8d7ba3b8c4e3b92c6b64b6a';
// Playwright MCP (Microsoft, Apache-2.0): Claude membaca & mengklik halaman Flow sendiri lewat CDP, apa pun bahasa UI-nya.
const FLOW_PW = path.join(FLOW_WORK, 'pwmcp');
const FLOW_PW_VER = '0.0.83';
const FLOW_PW_CLI = path.join(FLOW_PW, 'node_modules', '@playwright', 'mcp', 'cli.js');
const FLOW_PW_OUT = path.join(FLOW_WORK, 'pw-out');

async function flowChromeUp() {
  try {
    const r = await fetch(`http://127.0.0.1:${FLOW_PORT}/json/version`, { signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch {
    return false;
  }
}
/** Buka Chrome khusus Google Flow (profil sendiri + port CDP). Unduhan masuk ~/anima-flow/unduhan. */
/** Chrome Flow sudah jalan: tampilkan tab Flow yang ada (atau buka tab baru di jendela yang sama). */
async function focusFlowChrome(url) {
  const base = `http://127.0.0.1:${FLOW_PORT}`;
  try {
    const tabs = await (await fetch(`${base}/json/list`, { signal: AbortSignal.timeout(2000) })).json();
    const tab = tabs.find((t) => t.type === 'page' && /labs\.google|flow\.google|accounts\.google/.test(t.url));
    if (tab) await fetch(`${base}/json/activate/${tab.id}`, { signal: AbortSignal.timeout(2000) });
    else await fetch(`${base}/json/new?${url}`, { method: 'PUT', signal: AbortSignal.timeout(4000) });
  } catch {
    /* tetap anggap terbuka */
  }
}

/** Ada Chrome berprofil Flow yang jalan TANPA port kendali (mis. dibuka ulang dari taskbar)? */
function flowChromeWithoutPort() {
  if (process.platform !== 'win32') return Promise.resolve(false);
  return new Promise((res) => {
    const ps = spawn('powershell', ['-NoProfile', '-Command', "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | ForEach-Object { $_.CommandLine }"], { windowsHide: true });
    let out = '';
    ps.stdout.on('data', (b) => (out += b));
    ps.on('close', () => res(out.toLowerCase().includes(FLOW_UDD.toLowerCase())));
    ps.on('error', () => res(false));
  });
}

async function launchFlowChrome(url = FLOW_URL) {
  if (await flowChromeUp()) {
    await focusFlowChrome(url);
    return { already: true };
  }
  if (await flowChromeWithoutPort())
    throw new Error('Jendela Chrome Google Flow terbuka tanpa sambungan HyperForge (mungkin dibuka ulang dari taskbar). Tutup semua jendela Chrome Google Flow itu, lalu klik tombol ini lagi.');
  const exe = chromeExe();
  if (!exe) throw new Error('Google Chrome belum terpasang. Install Chrome dulu.');
  const prof = path.join(FLOW_UDD, 'Profile 3');
  fs.mkdirSync(prof, { recursive: true });
  fs.mkdirSync(FLOW_DL, { recursive: true });
  const prefFile = path.join(prof, 'Preferences');
  let pref = {};
  try {
    pref = JSON.parse(fs.readFileSync(prefFile, 'utf8'));
  } catch {
    /* profil baru */
  }
  pref.download = { ...(pref.download || {}), default_directory: FLOW_DL, prompt_for_download: false, directory_upgrade: true };
  pref.savefile = { ...(pref.savefile || {}), default_directory: FLOW_DL };
  fs.writeFileSync(prefFile, JSON.stringify(pref));
  spawn(exe, [`--user-data-dir=${FLOW_UDD}`, '--profile-directory=Profile 3', `--remote-debugging-port=${FLOW_PORT}`, '--no-first-run', '--no-default-browser-check', url], {
    detached: true,
    stdio: 'ignore',
  }).unref();
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await flowChromeUp()) return { already: false };
  }
  throw new Error('Chrome Google Flow tidak merespons. Tutup semua jendela Chrome Google Flow lalu coba lagi.');
}

// Skill prompt tambahan untuk style Google Flow (dipasang persis dari GitHub, commit tetap; dibaca Claude, tidak diubah).
const STICK_COMMIT = '8ced4737b8d2aa7e8e371a493e6b6add9885c0da';
const STICK_SKILL = {
  name: 'directing-stickman-videos',
  commit: STICK_COMMIT,
  git: { repo: 'https://github.com/kaomei/stickman-video-director.git', sub: 'skills/directing-stickman-videos', sparse: ['/skills/directing-stickman-videos/'] },
  dst: path.join(SKILLS_DIR, 'directing-stickman-videos'),
  marker: path.join(SKILLS_DIR, '.hyperforge-directing-stickman-videos.json'),
};
const HAND_SKILL = {
  name: 'hand-drawn-video-prompts',
  commit: '72e64cd8962f107360bdca23010af78f65b4e8f5',
  git: { repo: 'https://github.com/kaomei/hand-drawn-video-prompts.git', sub: 'hand-drawn-video-prompts', sparse: ['/hand-drawn-video-prompts/'] },
  dst: path.join(SKILLS_DIR, 'hand-drawn-video-prompts'),
  marker: path.join(SKILLS_DIR, '.hyperforge-hand-drawn-video-prompts.json'),
};

// human-voice (zircote, MIT): skill pemeriksa pola tulisan "khas AI" untuk naskah suara SEMUA style. Dipasang persis
// dari GitHub (commit tetap), opsional: gagal pasang tidak menghalangi style apa pun.
const VOICE_SKILL = {
  name: 'human-voice',
  commit: '9095b0427447e75b19ec174db4a6c4b92428eb76',
  git: { repo: 'https://github.com/zircote/human-voice.git', sub: 'skills/human-voice', sparse: ['/skills/human-voice/'] },
  dst: path.join(SKILLS_DIR, 'human-voice'),
  marker: path.join(SKILLS_DIR, '.hyperforge-human-voice.json'),
};
let voiceSkillTry = null;
/** Pasang human-voice sekali bila belum ada (tidak pernah melempar error). */
function ensureVoiceSkill(which, say) {
  if (skillState(VOICE_SKILL).installed) return Promise.resolve(true);
  voiceSkillTry ||= gitInstallSkill(VOICE_SKILL, which, say || (() => {}))
    .then(() => true)
    .catch((err) => {
      voiceSkillTry = null;
      if (say) say('Skill human-voice belum terpasang (opsional)', String(err.message || err).slice(0, 200));
      return false;
    });
  return voiceSkillTry;
}

ENGINES.flow = {
  id: 'flow',
  name: 'hyperforge-flow',
  src: path.join(__dirname, '..', 'flow-skill', 'hyperforge-flow'),
  dst: path.join(SKILLS_DIR, 'hyperforge-flow'),
  marker: path.join(SKILLS_DIR, '.hyperforge-flow.json'),
  work: FLOW_WORK,
  url: 'https://github.com/TMSSS05/google-flow-browser-mcp',
  license: 'MIT',
  mcpCommit: FLOW_COMMIT,
  voiceTools: ['mcp__anima__anima_vibi_tts', 'mcp__anima__anima_vibi_words'],
  extraTools: ['mcp__flow', 'mcp__browser', 'Bash(cd:*)', 'Bash(mv:*)', 'Bash(cp:*)'],
  samples: {},
  async deps() {
    return [
      { id: 'chrome', label: 'Google Chrome', ok: Boolean(chromeExe()), detail: 'dipakai lewat profil khusus HyperForge' },
      { id: 'mcp', label: 'google-flow-browser-mcp', ok: fs.existsSync(path.join(FLOW_MCP, 'node_modules', 'playwright', 'package.json')), detail: `commit ${FLOW_COMMIT.slice(0, 7)} di ${FLOW_MCP}` },
      { id: 'pwmcp', label: 'Playwright MCP (Claude mengoperasikan Flow)', ok: fs.existsSync(FLOW_PW_CLI), detail: `@playwright/mcp ${FLOW_PW_VER} di ${FLOW_PW}` },
      { id: 'config', label: 'Konfigurasi Flow', ok: fs.existsSync(path.join(FLOW_MCP, 'config', 'flow.config.json')), detail: `Chrome port ${FLOW_PORT}, unduhan ke ${FLOW_DL}` },
      { id: 'stick', label: 'Skill directing-stickman-videos (style Stickman Flow)', ok: skillState(STICK_SKILL).installed, detail: `kaomei/stickman-video-director commit ${STICK_COMMIT.slice(0, 7)}` },
      { id: 'hand', label: 'Skill hand-drawn-video-prompts (style Crayon Flow)', ok: skillState(HAND_SKILL).installed, detail: `kaomei/hand-drawn-video-prompts commit ${HAND_SKILL.commit.slice(0, 7)}` },
      { id: 'login', label: 'Login Google di Chrome Flow', ok: fs.existsSync(path.join(FLOW_UDD, 'Profile 3', 'Cookies')) || fs.existsSync(path.join(FLOW_UDD, 'Profile 3', 'Network', 'Cookies')), optional: true, detail: 'klik "Buka Google Flow", login sekali dengan akun Google yang punya langganan Flow' },
    ];
  },
  async setup({ which, say }) {
    const npm = await which(isWin ? 'npm.cmd' : 'npm');
    const src = await gitCheckout(which, { repo: 'https://github.com/TMSSS05/google-flow-browser-mcp.git', commit: FLOW_COMMIT, name: 'google-flow-browser-mcp' }, say, 'Mengunduh google-flow-browser-mcp');
    // Salinan persis repo (tanpa .git) ke folder kerja; config/flow.config.json milik HyperForge ditulis terpisah.
    fs.rmSync(path.join(FLOW_MCP, 'src'), { recursive: true, force: true });
    fs.mkdirSync(FLOW_MCP, { recursive: true });
    fs.cpSync(src, FLOW_MCP, { recursive: true, filter: (p) => !p.slice(src.length).split(/[\\/]/).includes('.git') });
    say('Memasang paket google-flow-browser-mcp (Playwright)');
    const r = await run(npm, ['i', '--omit=dev', '--no-audit', '--no-fund'], { cwd: FLOW_MCP, env: { ...process.env, PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1' }, onLine: (l) => say('Memasang paket google-flow-browser-mcp (Playwright)', l.trim().slice(-160)) });
    if (!r.ok) throw new Error(`Gagal npm install google-flow-browser-mcp:\n${tail(r.out)}`);
    const ex = JSON.parse(fs.readFileSync(path.join(FLOW_MCP, 'config', 'flow.config.example.json'), 'utf8'));
    const cfg = { ...ex, flowHome: FLOW_MCP, flowUrl: FLOW_URL, expectedAccount: '', chromeProfile: 'Profile 3', chromeUserDataDir: FLOW_UDD, cdpPort: FLOW_PORT, headless: false, locale: 'en' };
    fs.writeFileSync(path.join(FLOW_MCP, 'config', 'flow.config.json'), JSON.stringify(cfg, null, 2));
    fs.mkdirSync(path.join(FLOW_UDD, 'Profile 3'), { recursive: true });
    fs.mkdirSync(FLOW_DL, { recursive: true });
    say('Memasang Playwright MCP');
    fs.mkdirSync(FLOW_PW, { recursive: true });
    if (!fs.existsSync(path.join(FLOW_PW, 'package.json'))) fs.writeFileSync(path.join(FLOW_PW, 'package.json'), JSON.stringify({ name: 'anima-flow-pwmcp', private: true }));
    const r2 = await run(npm, ['i', '--omit=dev', '--no-audit', '--no-fund', `@playwright/mcp@${FLOW_PW_VER}`], { cwd: FLOW_PW, env: { ...process.env, PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1' }, onLine: (l) => say('Memasang Playwright MCP', l.trim().slice(-160)) });
    if (!r2.ok) throw new Error(`Gagal memasang Playwright MCP:
${tail(r2.out)}`);
    for (const sk of [STICK_SKILL, HAND_SKILL]) if (!skillState(sk).installed) await gitInstallSkill(sk, which, say);
  },
  optionalLabel: '',
  /** Server MCP tambahan untuk sesi: alat flow_* (HOME diarahkan ke profil Chrome khusus). */
  extraMcp: (node) => ({
    flow: { type: 'stdio', command: node, args: [path.join(FLOW_MCP, 'src', 'index.js')], env: { HOME: FLOW_HOME, USERPROFILE: process.env.USERPROFILE || HOME } },
    ...(fs.existsSync(FLOW_PW_CLI) ? { browser: { type: 'stdio', command: node, args: [FLOW_PW_CLI, '--cdp-endpoint', `http://127.0.0.1:${FLOW_PORT}`, '--output-dir', FLOW_PW_OUT] } } : {}),
  }),
  /** Chrome Flow harus sudah jalan (port CDP) sebelum Claude memanggil flow_connect. */
  async beforeSession() {
    await launchFlowChrome();
  },
  prompt: (slug, title) => `/hyperforge-flow Kerjakan brief HyperForge di briefs/${slug}.md untuk project: ${title}. Folder proyek: ${slug}/.`,
  videoDir: (slug) => path.join(FLOW_WORK, slug),
  findVideos(slug) {
    return listMp4(path.join(this.videoDir(slug), 'hasil'), 0);
  },
  env: (work) => ({ ANIMA_WORK_DIR: work, ANIMA_FLOW_DOWNLOADS: FLOW_DL, ANIMA_FLOW_PW_OUT: FLOW_PW_OUT }),
};
ENGINES.flow.commit = dirHash(ENGINES.flow.src);

// Kamal (skill buatan HyperForge, MIT): dua gaya dari referensi pemilik, dirender dari kode (canvas -> MP4) dengan
// alat render yang sama seperti HyperForge Studio. GELAP = panggung gelap tokoh garis + lampu sorot; TERANG = editorial krem.
ENGINES.kamal = {
  id: 'kamal',
  name: 'kamal',
  src: path.join(__dirname, '..', 'kamal-skill', 'kamal'),
  dst: path.join(SKILLS_DIR, 'kamal'),
  marker: path.join(SKILLS_DIR, '.hyperforge-kamal.json'),
  work: path.join(HOME, 'anima-kamal'),
  url: 'https://github.com/kamssser/ANIMA/tree/main/kamal-skill/kamal',
  voiceTools: ['mcp__anima__anima_vibi_tts', 'mcp__anima__anima_vibi_words'],
  samples: {},
  async deps() {
    const nm = (m) => fs.existsSync(path.join(this.work, 'node_modules', m, 'package.json'));
    return [{ id: 'puppeteer', label: 'Puppeteer + Chrome', ok: nm('puppeteer') && hasDir(path.join(HOME, '.cache', 'puppeteer'), /^chrome/), detail: `npm i puppeteer di ${this.work}` }];
  },
  async setup({ which, say }) {
    const npm = await which(isWin ? 'npm.cmd' : 'npm');
    fs.mkdirSync(this.work, { recursive: true });
    const pkg = path.join(this.work, 'package.json');
    if (!fs.existsSync(pkg)) fs.writeFileSync(pkg, JSON.stringify({ name: 'anima-kamal', private: true, description: 'Folder kerja HyperForge untuk skill kamal' }, null, 2));
    say('Memasang Puppeteer + Chrome');
    const r = await run(npm, ['i', 'puppeteer', '--no-audit', '--no-fund'], { cwd: this.work, onLine: (l) => say('Memasang Puppeteer + Chrome', l.trim().slice(-160)) });
    if (!r.ok) throw new Error(`Gagal memasang Puppeteer:
${tail(r.out)}`);
  },
  optionalLabel: '',
  prompt: (slug, title) => `/kamal Kerjakan brief HyperForge di briefs/${slug}.md untuk project: ${title}. Folder proyek: ${slug}/.`,
  videoDir: (slug) => path.join(ENGINES.kamal.work, slug),
  findVideos(slug) {
    return listMp4(path.join(this.videoDir(slug), 'hasil'), 0);
  },
  env: (work) => ({ ANIMA_WORK_DIR: work }),
};
ENGINES.kamal.commit = dirHash(ENGINES.kamal.src);

// Stickman (kaomei/stickman-video-director, MIT) mode B Autopilot: video stickman dirender lokal (@napi-rs/canvas + ffmpeg).
// Suara dari vibi.pro (bukan Gemini), timing kata dari anima_vibi_words -> perintah captions skill.
ENGINES.stickman = {
  id: 'stickman',
  ...STICK_SKILL,
  src: null,
  work: path.join(HOME, 'anima-stickman'),
  url: 'https://github.com/kaomei/stickman-video-director',
  license: 'MIT',
  voiceTools: ['mcp__anima__anima_vibi_tts', 'mcp__anima__anima_vibi_words'],
  extraTools: ['Bash(cd:*)', 'Bash(npm:*)'],
  samples: {},
  async deps() {
    return [{ id: 'canvas', label: 'Paket render (@napi-rs/canvas)', ok: fs.existsSync(path.join(STICK_SKILL.dst, 'node_modules', '@napi-rs', 'canvas', 'package.json')), detail: `npm ci di ${STICK_SKILL.dst}` }];
  },
  async setup({ which, say }) {
    const npm = await which(isWin ? 'npm.cmd' : 'npm');
    say('Memasang paket render stickman');
    const r = await run(npm, ['ci', '--no-audit', '--no-fund'], { cwd: STICK_SKILL.dst, onLine: (l) => say('Memasang paket render stickman', l.trim().slice(-160)) });
    if (!r.ok) throw new Error(`Gagal npm ci skill stickman:
${tail(r.out)}`);
    fs.mkdirSync(this.work, { recursive: true });
  },
  optionalLabel: '',
  prompt: (slug, title) => `/directing-stickman-videos Kerjakan brief HyperForge di briefs/${slug}.md untuk project: ${title}. Folder proyek: ${slug}/.`,
  videoDir: (slug) => path.join(ENGINES.stickman.work, slug),
  findVideos(slug) {
    return listMp4(path.join(this.videoDir(slug), 'output'), 1);
  },
  env: (work) => ({ ANIMA_WORK_DIR: work }),
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
  if (e.id === 'studio') ensureEduSkill();
  // Skill human-voice untuk memeriksa naskah (opsional; pengguna lama mendapatkannya tanpa Siapkan otomatis ulang).
  await Promise.race([ensureVoiceSkill(which), new Promise((r) => setTimeout(r, 20000))]);
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
  // Riset Agent Reach (opsional): kalau terpasang, sesi boleh memakainya dan brief menyebutnya.
  const reachBin = await reach.findReach(which);
  if (brief && reachBin && !/## Riset \(Agent Reach\)/.test(brief)) fs.appendFileSync(briefFile, `\n${reach.BRIEF_NOTE}\n`);
  const node = await which('node');
  const mcpFile = path.join(e.work, 'briefs', '.hyperforge-mcp.json');
  const servers = { anima: { type: 'stdio', command: node, args: [mcpServerPath()], env: { ANIMA_SETTINGS_FILE: settingsFile(), ...e.env(e.work) } }, ...(e.extraMcp ? e.extraMcp(node) : {}) };
  fs.writeFileSync(mcpFile, JSON.stringify({ mcpServers: servers }, null, 1));
  if (e.beforeSession) await e.beforeSession();
  const claude = await claudeCodePath();
  const ff = (e.ffmpegPath && e.ffmpegPath()) || (await findFullFfmpeg(which));
  const ffDir = ff ? path.dirname(ff) : '';
  // PATH tambahan untuk sesi: folder ffmpeg + folder Node/Python milik skill + agent-reach (kalau ada).
  const pathPrefix = [ffDir, ...(e.pathDirs ? e.pathDirs() : []), reachBin ? path.dirname(reachBin) : ''].filter(Boolean).join(path.delimiter);
  const npmRoot = await npmGlobalRoot(which);
  // Tanpa tanda kutip / karakter khusus cmd di dalam prompt (prompt diapit "..." di file .cmd).
  const cleanTitle = String(title || slug).replace(/["%^&|<>()!]/g, '').slice(0, 80);
  const prompt = e.prompt(slug, cleanTitle);
  const allowed = ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebSearch', 'WebFetch', 'Skill', 'Bash(node:*)', 'Bash(ffmpeg:*)', 'Bash(ffprobe:*)', 'Bash(python:*)', 'Bash(ls:*)', 'Bash(mkdir:*)', 'Bash(cp:*)', ...e.voiceTools, ...(e.extraTools || []), ...(reachBin ? ['Bash(agent-reach:*)'] : [])];
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
      { id: 'humanvoice', label: 'Skill human-voice (naskah terdengar manusia)', ok: skillState(VOICE_SKILL).installed, optional: true, detail: `zircote/human-voice commit ${VOICE_SKILL.commit.slice(0, 7)}, dipasang otomatis` },
    ];
    return { engine: e.id, ready: items.every((i) => i.ok || i.optional), items, workDir: e.work, commit: e.commit, url: e.url, optionalLabel: e.optionalLabel, license: e.license || 'MIT' };
  }

  ipcMain.handle('skill:check', (_e, id) => check(id));
  const deps = { which, claudeCodePath, mcpServerPath, settingsFile, check };
  // Panel obrolan Claude di dalam aplikasi (pengganti jendela terminal).
  const chat = require('./skillchat.cjs').register({ ipcMain, getWin, engineOf, prepareSession: (e, p) => prepareSession(e, p, deps) });

  ipcMain.handle('skill:setup', async (_e, { engine, optional }) => {
    const e = engineOf(engine);
    const say = sayFor(engine);
    if (!(await which('node'))) throw new Error('Node.js belum terpasang. Install Node.js LTS dari nodejs.org, lalu buka ulang HyperForge.');
    // Skill eksternal dipasang oleh installer paketnya sendiri (di e.setup), bukan disalin dari aplikasi.
    if (e.src) installSkill(e, say);
    else if (e.git) await gitInstallSkill(e, which, say);
    await e.setup({ which, say, optional });
    await ensureVoiceSkill(which, say);
    if (!e.ffmpegPath) await installFfmpeg(which, say);
    fs.mkdirSync(path.join(e.work, 'briefs'), { recursive: true });
    say('Selesai');
    return check(engine);
  });

  /** Buka Chrome khusus Google Flow (login sekali, lalu dipakai sesi). */
  ipcMain.handle('flow:openChrome', () => launchFlowChrome());
  ipcMain.handle('flow:status', async () => ({ running: await flowChromeUp(), downloads: FLOW_DL, port: FLOW_PORT }));

  // Storyboard cerita + teks suara (<proyek>/cerita.json): ditulis Claude, diedit pengguna di aplikasi sebelum render.
  const storyFile = (engine, slug) => {
    if (!slugOk(slug)) throw new Error('Nama proyek tidak valid');
    return path.join(engineOf(engine).videoDir(slug), 'cerita.json');
  };
  ipcMain.handle('story:read', (_e, { engine, slug }) => {
    const f = storyFile(engine, slug);
    if (!fs.existsSync(f)) return { exists: false, file: f };
    try {
      return { exists: true, file: f, mtime: fs.statSync(f).mtimeMs, data: JSON.parse(fs.readFileSync(f, 'utf8')) };
    } catch (err) {
      return { exists: true, file: f, error: `cerita.json tidak bisa dibaca: ${err.message}` };
    }
  });
  ipcMain.handle('story:write', (_e, { engine, slug, data }) => {
    const f = storyFile(engine, slug);
    if (!data || !Array.isArray(data.adegan)) throw new Error('Format storyboard tidak valid');
    const clean = {
      ...data,
      adegan: data.adegan.map((a, i) => ({
        ...a,
        no: i + 1,
        visual: String(a.visual ?? ''),
        teks_layar: String(a.teks_layar ?? ''),
        suara: a.suara === 'B' ? 'B' : 'A',
        narasi: String(a.narasi ?? ''),
      })),
      diedit_pengguna: new Date().toISOString(),
    };
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, JSON.stringify(clean, null, 2));
    return { ok: true, mtime: fs.statSync(f).mtimeMs };
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
  return chat;
}

module.exports = { register, ENGINES, listMp4, slugOk, findSh };
