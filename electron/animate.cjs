// Style "animate": skill pihak ketiga https://github.com/cth9191/animate (MIT), disalin utuh di animate-skill/animate.
// HyperForge TIDAK mengubah skill-nya. Yang dilakukan aplikasi:
//   1. memasang skill ke ~/.claude/skills/animate + kebutuhannya (Playwright + Chromium, ffmpeg lengkap, faster-whisper);
//   2. menyiapkan folder kerja (~/anima-animate) dan brief dari project;
//   3. membuka jendela Claude Code interaktif dengan /animate, supaya check-in story / look / storyboard
//      dijawab pengguna persis seperti skill aslinya;
//   4. membaca hasil (pieces/<slug>/renders/*.mp4) untuk dimasukkan ke daftar render project.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, execFile } = require('node:child_process');

const SKILL_COMMIT = '7e5eb56feb2dd573f890e1b7b34748af43d58263';
const SKILL_SRC = path.join(__dirname, '..', 'animate-skill', 'animate');
const SKILL_DST = path.join(os.homedir(), '.claude', 'skills', 'animate');
const MARKER = path.join(os.homedir(), '.claude', 'skills', '.hyperforge-animate.json');
const WORK = path.join(os.homedir(), 'anima-animate');
const isWin = process.platform === 'win32';

/** Style bawaan skill (urutan seperti README skill). */
const STYLES = ['cut-paper', 'crosshatch', 'riso', 'sketchbook', 'math', 'pixel', 'isometric'];

function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const isCmd = /\.cmd$/i.test(cmd);
    const c = spawn(isCmd ? `"${cmd}"` : cmd, isCmd ? args.map((a) => (/\s/.test(a) ? `"${a}"` : a)) : args, {
      windowsHide: true,
      shell: isCmd,
      ...opts,
    });
    let out = '';
    c.stdout?.on('data', (b) => {
      out += b;
      opts.onLine?.(String(b));
    });
    c.stderr?.on('data', (b) => {
      out += b;
      opts.onLine?.(String(b));
    });
    c.on('error', (e) => resolve({ ok: false, out: e.message }));
    c.on('close', (code) => resolve({ ok: code === 0, out }));
  });
}

/** ffmpeg LENGKAP (punya filter tile/ebur128 dan muxer rawvideo yang dipakai alat skill). */
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
    const links = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Links', 'ffmpeg.exe');
    if (fs.existsSync(links)) cands.push(links);
  }
  for (const exe of cands) {
    const r = await run(exe, ['-hide_banner', '-filters']);
    if (r.ok && /\btile\b/.test(r.out) && /\bebur128\b/.test(r.out)) return exe;
  }
  return null;
}

async function npmGlobalRoot(which) {
  const npm = await which(isWin ? 'npm.cmd' : 'npm');
  if (!npm) return null;
  const r = await run(npm, ['root', '-g']);
  return r.ok ? r.out.trim().split(/\r?\n/).pop() : null;
}

function chromiumInstalled() {
  const base = isWin ? path.join(process.env.LOCALAPPDATA || '', 'ms-playwright') : path.join(os.homedir(), isWin ? '' : process.platform === 'darwin' ? 'Library/Caches/ms-playwright' : '.cache/ms-playwright');
  try {
    return fs.readdirSync(base).some((n) => /^chromium(_headless_shell)?-\d+/.test(n));
  } catch {
    return false;
  }
}

function skillState() {
  let marker = null;
  try {
    marker = JSON.parse(fs.readFileSync(MARKER, 'utf8'));
  } catch {
    /* belum dipasang HyperForge */
  }
  const exists = fs.existsSync(path.join(SKILL_DST, 'SKILL.md'));
  return { installed: exists && marker?.commit === SKILL_COMMIT, exists, foreign: exists && !marker };
}

const slugOk = (s) => /^[a-z0-9][a-z0-9-]{0,63}$/.test(String(s));
const pieceDir = (slug) => path.join(WORK, 'pieces', slug);

function register({ ipcMain, getWin, which, claudeCodePath, mcpServerPath, settingsFile }) {
  const say = (step, line) => {
    const w = getWin();
    if (w && !w.isDestroyed()) w.webContents.send('animate:event', { step, line });
  };

  async function check() {
    const [node, claude, ffmpeg, npmRoot] = await Promise.all([which('node'), claudeCodePath(), findFullFfmpeg(which), npmGlobalRoot(which)]);
    const playwright = Boolean(npmRoot && fs.existsSync(path.join(npmRoot, 'playwright', 'package.json')));
    const py = await run('python', ['-c', 'import faster_whisper; print(faster_whisper.__version__)']);
    return {
      node: Boolean(node),
      claude: Boolean(claude),
      playwright,
      chromium: chromiumInstalled(),
      ffmpeg,
      whisper: py.ok ? py.out.trim() : null,
      python: (await run('python', ['--version'])).ok,
      skill: skillState(),
      workDir: WORK,
      commit: SKILL_COMMIT,
    };
  }

  ipcMain.handle('animate:check', check);

  /** Pasang semua kebutuhan. withWhisper = ikut pasang faster-whisper (timing kata, ~200 MB). */
  ipcMain.handle('animate:setup', async (_e, { withWhisper } = {}) => {
    const st = await check();
    if (!st.node) throw new Error('Node.js belum terpasang. Install Node.js LTS dari nodejs.org, lalu buka ulang HyperForge.');

    // 1. Skill (utuh). Skill lain bernama sama yang bukan dari HyperForge disimpan dulu, tidak dihapus.
    say('Memasang skill animate');
    if (st.skill.foreign) {
      const bak = `${SKILL_DST}.backup-${Date.now()}`;
      fs.renameSync(SKILL_DST, bak);
      say('Memasang skill animate', `Skill animate lama dipindah ke ${bak}`);
    }
    fs.rmSync(SKILL_DST, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(SKILL_DST), { recursive: true });
    fs.cpSync(SKILL_SRC, SKILL_DST, { recursive: true });
    fs.writeFileSync(MARKER, JSON.stringify({ commit: SKILL_COMMIT, installedAt: new Date().toISOString(), by: 'HyperForge' }, null, 1));

    // 2. Playwright + Chromium (perintah yang diminta skill: npm i -g playwright && npx playwright install chromium).
    const npm = await which(isWin ? 'npm.cmd' : 'npm');
    const npx = await which(isWin ? 'npx.cmd' : 'npx');
    if (!st.playwright) {
      say('Memasang Playwright');
      const r = await run(npm, ['i', '-g', 'playwright'], { onLine: (l) => say('Memasang Playwright', l.trim().slice(-160)) });
      if (!r.ok) throw new Error(`Gagal memasang Playwright:\n${r.out.split('\n').slice(-4).join('\n')}`);
    }
    // Selalu dijalankan: memastikan versi Chromium cocok dengan Playwright (cepat kalau sudah ada).
    {
      say('Mengunduh Chromium (sekitar 150 MB)');
      const r = await run(npx, ['playwright', 'install', 'chromium'], { onLine: (l) => say('Mengunduh Chromium (sekitar 150 MB)', l.trim().slice(-160)) });
      if (!r.ok) throw new Error(`Gagal mengunduh Chromium:\n${r.out.split('\n').slice(-4).join('\n')}`);
    }

    // 3. ffmpeg lengkap (ffmpeg bawaan Remotion terlalu ringkas untuk alat skill).
    if (!st.ffmpeg) {
      if (!isWin) throw new Error('ffmpeg belum terpasang. Pasang ffmpeg (mis. brew install ffmpeg), lalu klik Siapkan lagi.');
      say('Memasang ffmpeg (winget)');
      const r = await run('winget', ['install', '--id', 'Gyan.FFmpeg', '-e', '--accept-source-agreements', '--accept-package-agreements', '--disable-interactivity'], {
        onLine: (l) => say('Memasang ffmpeg (winget)', l.trim().slice(-160)),
      });
      if (!(await findFullFfmpeg(which))) throw new Error(`Gagal memasang ffmpeg lewat winget:\n${r.out.split('\n').slice(-4).join('\n')}\nPasang manual dari https://www.gyan.dev/ffmpeg/builds/ lalu klik Siapkan lagi.`);
    }

    // 4. faster-whisper (opsional): timing kata dari suara. Tanpa ini skill memperkirakan dari jumlah huruf.
    if (withWhisper && !st.whisper) {
      if (!st.python) throw new Error('Python belum terpasang, faster-whisper dilewati. Pasang Python 3 dulu.');
      say('Memasang faster-whisper');
      const r = await run('python', ['-m', 'pip', 'install', '--user', '--disable-pip-version-check', 'faster-whisper'], { onLine: (l) => say('Memasang faster-whisper', l.trim().slice(-160)) });
      if (!r.ok) throw new Error(`Gagal memasang faster-whisper:\n${r.out.split('\n').slice(-4).join('\n')}`);
    }
    fs.mkdirSync(path.join(WORK, 'pieces'), { recursive: true });
    say('Selesai');
    return check();
  });

  /** Gambar contoh tiap style (sample.png dari skill) untuk galeri di aplikasi. */
  ipcMain.handle('animate:samples', () => {
    const out = {};
    for (const s of STYLES) {
      const f = path.join(SKILL_SRC, 'styles', s, 'sample.png');
      if (fs.existsSync(f)) out[s] = `data:image/png;base64,${fs.readFileSync(f).toString('base64')}`;
    }
    return out;
  });

  /**
   * Tulis brief project lalu buka jendela Claude Code dengan /animate.
   * payload: { slug, title, brief (markdown dari aplikasi) }
   */
  ipcMain.handle('animate:open', async (_e, { slug, title, brief }) => {
    if (!slugOk(slug)) throw new Error('Judul project tidak bisa dijadikan nama folder. Ganti judulnya.');
    const st = await check();
    const missing = [!st.skill.installed && 'skill animate', !st.playwright && 'Playwright', !st.chromium && 'Chromium', !st.ffmpeg && 'ffmpeg lengkap', !st.claude && 'Claude Code'].filter(Boolean);
    if (missing.length) throw new Error(`Belum siap: ${missing.join(', ')}. Buka Pengaturan > Animate lalu klik Siapkan otomatis.`);

    fs.mkdirSync(path.join(WORK, 'pieces'), { recursive: true });
    fs.mkdirSync(path.join(WORK, 'briefs'), { recursive: true });
    const briefFile = path.join(WORK, 'briefs', `${slug}.md`);
    fs.writeFileSync(briefFile, brief);

    // MCP HyperForge hanya untuk suara vibi.pro (anima_vibi_voice): baca kunci vibi dari pengaturan aplikasi.
    const node = await which('node');
    const mcpFile = path.join(WORK, 'briefs', '.hyperforge-mcp.json');
    fs.writeFileSync(
      mcpFile,
      JSON.stringify({ mcpServers: { anima: { type: 'stdio', command: node, args: [mcpServerPath()], env: { ANIMA_SETTINGS_FILE: settingsFile(), ANIMA_ANIMATE_DIR: WORK } } } }, null, 1),
    );

    const claude = await claudeCodePath();
    const ffDir = path.dirname(st.ffmpeg);
    const npmRoot = await npmGlobalRoot(which);
    // Tanpa tanda kutip / karakter khusus cmd di dalam prompt (prompt diapit "..." di file .cmd).
    const cleanTitle = String(title).replace(/["%^&|<>()!]/g, '').slice(0, 80);
    const prompt = `/animate Kerjakan brief HyperForge di briefs/${slug}.md untuk project: ${cleanTitle}. Nama piece: ${slug}, folder pieces/${slug}/.`;
    const allowed = ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebSearch', 'WebFetch', 'Bash(node:*)', 'Bash(ffmpeg:*)', 'Bash(ffprobe:*)', 'Bash(python:*)', 'mcp__anima__anima_vibi_voice'];

    if (isWin) {
      // Peluncur .cmd: PATH berisi ffmpeg lengkap + modul global npm (untuk require('playwright') di alat skill).
      const launcher = path.join(WORK, 'briefs', `${slug}.cmd`);
      fs.writeFileSync(
        launcher,
        [
          '@echo off',
          'chcp 65001 >nul',
          `title HyperForge Animate - ${slug}`,
          `cd /d "${WORK}"`,
          `set "PATH=${ffDir};%PATH%"`,
          npmRoot ? `set "NODE_PATH=${npmRoot}"` : '',
          'echo HyperForge: Claude Code + skill animate. Jawab check-in story, look, dan storyboard di jendela ini.',
          'echo Video jadi ada di pieces\\' + slug + '\\renders\\share.mp4. Lalu di HyperForge: tab Render, klik Masukkan ke daftar render.',
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
      const c = spawn('cmd.exe', ['/c', 'start', `HyperForge Animate ${slug}`, '/D', WORK, launcher], { detached: true, stdio: 'ignore', windowsHide: false });
      c.unref();
    } else {
      throw new Error('Jendela Claude otomatis baru tersedia di Windows. Jalankan manual di terminal: cd ~/anima-animate && claude "' + prompt + '"');
    }
    return { workDir: WORK, briefFile };
  });

  /** Hasil piece: video di renders/ (share.mp4 = untuk diunggah, final*.mp4 = kualitas penuh). */
  ipcMain.handle('animate:status', (_e, slug) => {
    if (!slugOk(slug)) return { exists: false, videos: [] };
    const dir = pieceDir(slug);
    const renders = path.join(dir, 'renders');
    let videos = [];
    try {
      videos = fs
        .readdirSync(renders)
        .filter((f) => /\.mp4$/i.test(f) && !/^(audio|stem)/i.test(f))
        .map((f) => {
          const st = fs.statSync(path.join(renders, f));
          return { file: path.join(renders, f), name: f, size: st.size, mtime: st.mtime.toISOString() };
        })
        .sort((a, b) => (a.name === 'share.mp4' ? -1 : b.name === 'share.mp4' ? 1 : b.mtime.localeCompare(a.mtime)));
    } catch {
      /* belum ada render */
    }
    return { exists: fs.existsSync(dir), dir, videos, hasBrief: fs.existsSync(path.join(WORK, 'briefs', `${slug}.md`)) };
  });

  ipcMain.handle('animate:openFolder', (_e, slug) => {
    const dir = slugOk(slug) && fs.existsSync(pieceDir(slug)) ? pieceDir(slug) : WORK;
    fs.mkdirSync(dir, { recursive: true });
    execFile(isWin ? 'explorer.exe' : 'xdg-open', [dir]);
    return dir;
  });
}

module.exports = { register, STYLES, WORK, SKILL_COMMIT };
