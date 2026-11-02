// Proses utama Electron: jendela aplikasi, penyimpanan pengaturan, dan antrean render lokal.
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { spawn, execFile } = require('node:child_process');

const isDev = !app.isPackaged && process.argv.includes('--dev');

// Laptop low-spec: GPU lama (Quadro K1100M / HD 4600) lebih stabil tanpa akselerasi,
// dan dashboard tidak butuh WebGL.
app.disableHardwareAcceleration();

/** @type {BrowserWindow | null} */
let win = null;

// ---------- Pengaturan (disimpan di %APPDATA%/ANIMA Studio/settings.json) ----------

const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');

const defaultSettings = () => ({
  supabaseUrl: '',
  supabaseAnonKey: '',
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
    title: 'ANIMA Studio',
    backgroundColor: '#18181b',
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

async function runNext() {
  if (current || queue.length === 0) return;
  const job = queue.shift();
  const s = readSettings();

  const fail = (error) => {
    emit({ jobId: job.jobId, type: 'failed', error });
    current = null;
    runNext();
  };

  if (!s.remotionProjectPath || !fs.existsSync(s.remotionProjectPath)) {
    return fail('Folder proyek Remotion belum diatur. Buka Pengaturan.');
  }
  const bin = remotionBin(s.remotionProjectPath);
  if (!bin) {
    return fail('Remotion tidak ditemukan. Jalankan "npm install" di folder proyek Remotion terlebih dahulu.');
  }
  const free = await freeGb(s.tempDir);
  if (free !== null && free < 5) {
    return fail(`Ruang disk tinggal ${free.toFixed(1)} GB. Render butuh minimal 5 GB kosong.`);
  }

  fs.mkdirSync(s.outputDir, { recursive: true });
  fs.mkdirSync(s.tempDir, { recursive: true });
  const propsFile = path.join(s.tempDir, `props-${job.jobId}.json`);
  fs.writeFileSync(propsFile, JSON.stringify(job.props));
  const outFile = path.join(s.outputDir, job.fileName);

  const args = [
    'render',
    quote(s.remotionEntry),
    quote(job.composition || s.defaultComposition),
    quote(outFile),
    `--props=${quote(propsFile)}`,
    `--concurrency=${Number(s.concurrency) || 1}`,
    '--codec=h264',
    `--crf=${Number(s.crf) || 18}`,
    `--scale=${Number(s.scale) || 1}`,
  ];

  // .cmd di Windows wajib lewat shell.
  const child = spawn(quote(bin), args, {
    cwd: s.remotionProjectPath,
    shell: true,
    windowsHide: true,
    env: { ...process.env, REMOTION_TMP: s.tempDir, FORCE_COLOR: '0' },
  });
  current = { jobId: job.jobId, child, cancelled: false };
  emit({ jobId: job.jobId, type: 'started', outFile });

  const tail = [];
  let lastPct = -1;
  const onData = (buf) => {
    for (const line of buf.toString().split(/\r?\n|\r/)) {
      const t = line.trim();
      if (!t) continue;
      tail.push(t);
      if (tail.length > 30) tail.shift();
      // Remotion mencetak "Rendered 120/2010" dan "Encoded 120/2010".
      const m = t.match(/(Rendered|Encoded|Stitched)[^\d]*(\d+)\s*\/\s*(\d+)/i);
      if (m) {
        const stage = m[1].toLowerCase();
        const ratio = Number(m[2]) / Math.max(1, Number(m[3]));
        // Render frame = 0-90%, encode = 90-100%.
        const pct = Math.floor(stage === 'rendered' ? ratio * 90 : 90 + ratio * 10);
        if (pct !== lastPct) {
          lastPct = pct;
          emit({ jobId: job.jobId, type: 'progress', progress: pct, stage });
        }
      }
    }
  };
  child.stdout.on('data', onData);
  child.stderr.on('data', onData);

  child.on('close', (code) => {
    const wasCancelled = current && current.cancelled;
    current = null;
    fs.rm(propsFile, { force: true }, () => {});
    if (wasCancelled) {
      emit({ jobId: job.jobId, type: 'cancelled' });
    } else if (code === 0 && fs.existsSync(outFile)) {
      emit({ jobId: job.jobId, type: 'done', outFile });
    } else {
      emit({ jobId: job.jobId, type: 'failed', error: tail.slice(-12).join('\n') || `Remotion keluar dengan kode ${code}` });
    }
    runNext();
  });
}

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
    version: app.getVersion(),
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
      execFile('taskkill', ['/pid', String(current.child.pid), '/T', '/F'], () => {});
    } else {
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
  app.whenReady().then(createWindow);
}

app.on('before-quit', () => {
  if (current && process.platform === 'win32') {
    execFile('taskkill', ['/pid', String(current.child.pid), '/T', '/F'], () => {});
  }
});

app.on('window-all-closed', () => app.quit());
