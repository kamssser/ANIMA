// Riset internet lewat Agent Reach (https://github.com/Panniantong/agent-reach, MIT): CLI `agent-reach` yang membaca
// YouTube (subtitle), Reddit, X/Twitter, GitHub, Bilibili, web, dll. Dipasang dengan uv sesuai docs/install.md
// repo itu (BUKAN dari PyPI: paket bernama sama di PyPI bukan proyek ini). Skill-nya dipasang oleh `agent-reach setup`.
// HyperForge hanya: memasang, menampilkan status, dan mengizinkan sesi Claude memakai `agent-reach`.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const isWin = process.platform === 'win32';
const HOME = os.homedir();
const LOCAL_BIN = path.join(HOME, '.local', 'bin');
const ZIP = 'https://github.com/Panniantong/Agent-Reach/releases/latest/download/agent-reach.zip';

const BRIEF_NOTE = [
  '## Riset (Agent Reach)',
  '- `agent-reach` terpasang di laptop ini (read-only): boleh dipakai untuk riset bahan video, mis. `agent-reach read <link>`, `agent-reach youtube search "<topik>"`, subtitle YouTube, Reddit, GitHub, web. Cek dulu `agent-reach channels`.',
  '- Pakai bila WebSearch/WebFetch tidak cukup (subtitle video, forum, platform yang butuh login). Jangan login atau meminta kata sandi atas nama pengguna; hanya membaca.',
].join('\n');

function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const c = spawn(cmd, args, { windowsHide: true, ...opts });
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

const exe = (n) => (isWin ? `${n}.exe` : n);
async function findBin(which, name) {
  const local = path.join(LOCAL_BIN, exe(name));
  if (fs.existsSync(local)) return local;
  return (await which(name)) || null;
}
const findReach = (which) => findBin(which, 'agent-reach');

/** Ambil JSON satu baris dari output agent-reach (versi 1.6+ mencetak satu objek JSON). */
function lastJson(out) {
  const lines = String(out).trim().split(/\r?\n/).reverse();
  for (const l of lines) {
    try {
      return JSON.parse(l);
    } catch {
      /* bukan JSON */
    }
  }
  try {
    return JSON.parse(out);
  } catch {
    return null;
  }
}

function register({ ipcMain, getWin, which }) {
  const say = (step, line) => {
    const w = getWin();
    if (w && !w.isDestroyed()) w.webContents.send('skill:event', { engine: 'reach', step, line });
  };
  const env = () => ({ ...process.env, PATH: [LOCAL_BIN, process.env.PATH].join(path.delimiter), PYTHONIOENCODING: 'utf-8' });

  ipcMain.handle('reach:status', async () => {
    const [uv, bin] = await Promise.all([findBin(which, 'uv'), findReach(which)]);
    let version = null;
    let doctor = '';
    if (bin) {
      const v = await run(bin, ['version'], { env: env() });
      const j = lastJson(v.out);
      version = j?.result?.version || j?.version || v.out.trim().split(/\r?\n/)[0] || null;
      const d = await run(bin, ['doctor', '--text'], { env: env() });
      doctor = d.out.trim().slice(0, 6000);
    }
    const skill = fs.existsSync(path.join(HOME, '.claude', 'skills', 'agent-reach', 'SKILL.md'));
    return { uv, bin, version, doctor, skill, url: 'https://github.com/Panniantong/agent-reach' };
  });

  /** Pasang / perbarui: uv (kalau belum) -> uv tool install <zip rilis> -> agent-reach setup. */
  ipcMain.handle('reach:install', async () => {
    let uv = await findBin(which, 'uv');
    if (!uv) {
      say('Memasang uv (alat pemasang program, tanpa admin)');
      const r = isWin
        ? await run('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', 'irm https://astral.sh/uv/install.ps1 | iex'], { onLine: (l) => say('Memasang uv', l.trim().slice(-160)) })
        : await run('sh', ['-c', 'curl -LsSf https://astral.sh/uv/install.sh | sh'], { onLine: (l) => say('Memasang uv', l.trim().slice(-160)) });
      uv = await findBin(which, 'uv');
      if (!uv) throw new Error(`Gagal memasang uv:\n${r.out.split('\n').slice(-4).join('\n')}`);
    }
    say('Memasang Agent Reach');
    const i = await run(uv, ['tool', 'install', '--force', ZIP], { env: env(), onLine: (l) => say('Memasang Agent Reach', l.trim().slice(-160)) });
    if (!i.ok) throw new Error(`Gagal memasang Agent Reach:\n${i.out.split('\n').slice(-6).join('\n')}`);
    const bin = await findReach(which);
    if (!bin) throw new Error('agent-reach terpasang tapi tidak ditemukan. Tutup lalu buka ulang HyperForge.');
    say('Menyiapkan kanal bawaan Agent Reach (setup)');
    const s = await run(bin, ['setup'], { env: env(), onLine: (l) => say('Menyiapkan kanal bawaan Agent Reach (setup)', l.trim().slice(-160)) });
    const j = lastJson(s.out);
    if (j && j.ok === false) throw new Error(j.error?.hint || j.error?.message || 'agent-reach setup gagal');
    say('Selesai');
    return { report: j?.result?.installation_report?.markdown || '' };
  });
}

module.exports = { register, findReach, BRIEF_NOTE };
