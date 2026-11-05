// Chrome khusus Google Flow: profil terpisah (akun Google utama tidak tersentuh) + port CDP supaya Claude bisa
// mengoperasikan halaman Flow lewat Playwright MCP.
//
// Keamanan:
// - Port CDP ACAK setiap kali Chrome dibuka (bukan 9333 tetap), hanya di 127.0.0.1, disimpan di chrome-port.json.
// - Hanya dibuka setelah pengguna menyetujui risiko akun Google (pengaturan flowRiskAccepted).
// - Ditutup lewat tombol "Tutup Chrome Flow" dan otomatis saat HyperForge ditutup.
const fs = require('node:fs');
const os = require('node:os');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');

const isWin = process.platform === 'win32';
const HOME = os.homedir();
const FLOW_WORK = path.join(HOME, 'anima-flow');
const FLOW_MCP = path.join(FLOW_WORK, 'mcp');
const FLOW_HOME = path.join(FLOW_WORK, 'chrome-home');
const FLOW_UDD = path.join(FLOW_HOME, '.config', 'google-chrome');
const FLOW_DL = path.join(FLOW_WORK, 'unduhan');
const FLOW_URL = 'https://labs.google/fx/tools/flow';
const PORT_FILE = path.join(FLOW_WORK, 'chrome-port.json');
const FLOW_CONFIG = path.join(FLOW_MCP, 'config', 'flow.config.json');

const RISK_TEXT =
  'Claude akan mengklik Generate di Google Flow memakai akun Google-mu. Ketentuan Google umumnya melarang akses otomatis, jadi akun bisa dibatasi. Pakai akun cadangan bila bisa. Selama Chrome Flow terbuka, program lain di laptop ini secara teknis bisa mengendalikan profil Chrome itu; tutup Chrome Flow setelah selesai.';

const chromeExe = () =>
  isWin
    ? [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA]
        .filter(Boolean)
        .map((d) => path.join(d, 'Google', 'Chrome', 'Application', 'chrome.exe'))
        .find((p) => fs.existsSync(p)) || null
    : ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/opt/google/chrome/chrome', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p)) || null;

/** Port CDP Chrome Flow yang terakhir dibuka (0 = belum pernah). */
function currentPort() {
  try {
    const p = Number(JSON.parse(fs.readFileSync(PORT_FILE, 'utf8')).port);
    return Number.isInteger(p) && p > 1024 && p < 65536 ? p : 0;
  } catch {
    return 0;
  }
}

/** Port acak yang sedang kosong di 127.0.0.1. */
function freePort() {
  return new Promise((resolve, reject) => {
    const tryOnce = (left) => {
      const port = 20000 + Math.floor(Math.random() * 40000);
      const srv = net.createServer();
      srv.once('error', () => (left > 0 ? tryOnce(left - 1) : reject(new Error('Tidak menemukan port kosong untuk Chrome Flow.'))));
      srv.listen(port, '127.0.0.1', () => srv.close(() => resolve(port)));
    };
    tryOnce(20);
  });
}

async function chromeUp(port = currentPort()) {
  if (!port) return false;
  try {
    const r = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch {
    return false;
  }
}

/** Chrome Flow sudah jalan: tampilkan tab Flow yang ada (atau buka tab baru di jendela yang sama). */
async function focusChrome(url) {
  const base = `http://127.0.0.1:${currentPort()}`;
  try {
    const tabs = await (await fetch(`${base}/json/list`, { signal: AbortSignal.timeout(2000) })).json();
    const tab = tabs.find((t) => t.type === 'page' && /labs\.google|flow\.google|accounts\.google/.test(t.url));
    if (tab) await fetch(`${base}/json/activate/${tab.id}`, { signal: AbortSignal.timeout(2000) });
    else await fetch(`${base}/json/new?${url}`, { method: 'PUT', signal: AbortSignal.timeout(4000) });
  } catch {
    /* tetap anggap terbuka */
  }
}

/** Proses chrome.exe yang memakai profil Flow (PID). */
function flowChromePids() {
  if (!isWin) return Promise.resolve([]);
  return new Promise((res) => {
    const ps = spawn('powershell', ['-NoProfile', '-Command', "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | ForEach-Object { \"$($_.ProcessId)`t$($_.CommandLine)\" }"], { windowsHide: true });
    let out = '';
    ps.stdout.on('data', (b) => (out += b));
    ps.on('close', () =>
      res(
        out
          .split(/\r?\n/)
          .filter((l) => l.toLowerCase().includes(FLOW_UDD.toLowerCase()))
          .map((l) => Number(l.split('\t')[0]))
          .filter(Boolean),
      ),
    );
    ps.on('error', () => res([]));
  });
}

/** Port baru juga ditulis ke konfigurasi google-flow-browser-mcp (dibaca saat sesi Claude dimulai). */
function writeMcpPort(port) {
  try {
    const cfg = JSON.parse(fs.readFileSync(FLOW_CONFIG, 'utf8'));
    if (cfg.cdpPort !== port) fs.writeFileSync(FLOW_CONFIG, JSON.stringify({ ...cfg, cdpPort: port }, null, 2));
  } catch {
    /* belum dipasang: ditulis oleh Siapkan otomatis */
  }
}

/** Buka Chrome khusus Google Flow (profil sendiri + port CDP acak). Unduhan masuk ~/anima-flow/unduhan. */
async function launchChrome({ accepted, url = FLOW_URL }) {
  if (!accepted) throw new Error('Setujui dulu risiko otomatisasi Google Flow di Pengaturan > Skill video > Google Flow.');
  if (await chromeUp()) {
    writeMcpPort(currentPort());
    await focusChrome(url);
    return { already: true, port: currentPort() };
  }
  if ((await flowChromePids()).length)
    throw new Error('Jendela Chrome Google Flow terbuka tanpa sambungan HyperForge (mungkin dibuka ulang dari taskbar). Klik "Tutup Chrome Flow" atau tutup semua jendela Chrome Google Flow, lalu coba lagi.');
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
  const port = await freePort();
  fs.writeFileSync(PORT_FILE, JSON.stringify({ port, at: new Date().toISOString() }));
  writeMcpPort(port);
  spawn(
    exe,
    [`--user-data-dir=${FLOW_UDD}`, '--profile-directory=Profile 3', '--remote-debugging-address=127.0.0.1', `--remote-debugging-port=${port}`, '--no-first-run', '--no-default-browser-check', url],
    { detached: true, stdio: 'ignore' },
  ).unref();
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await chromeUp(port)) return { already: false, port };
  }
  throw new Error('Chrome Google Flow tidak merespons. Klik "Tutup Chrome Flow" lalu coba lagi.');
}

/** Tutup Chrome Flow: rapi lewat CDP (Browser.close, cookie login tersimpan), lalu paksa kalau masih ada. */
async function closeChrome() {
  const port = currentPort();
  if (port && (await chromeUp(port)) && typeof WebSocket === 'function') {
    try {
      const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(1500) })).json();
      await new Promise((resolve) => {
        const ws = new WebSocket(webSocketDebuggerUrl);
        const done = () => resolve();
        ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: 'Browser.close' }));
        ws.onclose = done;
        ws.onerror = done;
        setTimeout(done, 3000);
      });
    } catch {
      /* lanjut ke cara paksa */
    }
  }
  for (let i = 0; i < 10 && (await chromeUp(port)); i++) await new Promise((r) => setTimeout(r, 300));
  const pids = await flowChromePids();
  for (const pid of pids) {
    try {
      process.kill(pid);
    } catch {
      /* sudah tertutup */
    }
  }
  fs.rmSync(PORT_FILE, { force: true });
  return { closed: true };
}

/** Versi sinkron untuk saat HyperForge ditutup: minta Chrome Flow menutup diri (taskkill tanpa /F = tutup rapi). */
function closeChromeSync() {
  if (!isWin || !fs.existsSync(PORT_FILE)) return;
  try {
    const { spawnSync } = require('node:child_process');
    const ps = spawnSync('powershell', ['-NoProfile', '-Command', "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | ForEach-Object { \"$($_.ProcessId)`t$($_.CommandLine)\" }"], { encoding: 'utf8', windowsHide: true, timeout: 8000 });
    const pids = String(ps.stdout || '')
      .split(/\r?\n/)
      .filter((l) => l.toLowerCase().includes(FLOW_UDD.toLowerCase()))
      .map((l) => l.split('\t')[0])
      .filter(Boolean);
    if (pids.length) spawnSync('taskkill', pids.flatMap((p) => ['/PID', p]), { windowsHide: true, timeout: 8000 });
    fs.rmSync(PORT_FILE, { force: true });
  } catch {
    /* abaikan */
  }
}

module.exports = {
  closeChromeSync, FLOW_WORK, FLOW_MCP, FLOW_HOME, FLOW_UDD, FLOW_DL, FLOW_URL, RISK_TEXT, chromeExe, currentPort, chromeUp, launchChrome, closeChrome };
