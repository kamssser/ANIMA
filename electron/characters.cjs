// Karakter digambar Claude sebagai SVG ber-rig (tanpa AI gambar berbayar). Memakai Claude Code headless
// dengan login pengguna. Revisi melanjutkan sesi Claude yang sama (--resume), jadi Claude ingat gambar sebelumnya.
const fs = require('node:fs');
const path = require('node:path');
const { spawn, execFile } = require('node:child_process');
const { extractSvg, sanitizeSvg, checkCharacterSvg } = require('./svg.cjs');

const STYLES = () => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'shared', 'visual-styles.json'), 'utf8'));

function characterPrompt(c) {
  const all = STYLES();
  const st = all.styles.find((x) => x.id === c.visual_style && x.kind === '2d') || all.styles.find((x) => x.id === 'komedi');
  return [
    'Kamu ilustrator karakter kartun. Gambar SATU karakter orisinal sebagai kode SVG ber-rig untuk animasi 2D.',
    '',
    `Nama: ${c.name}${c.nickname ? ` (panggilan: ${c.nickname})` : ''}`,
    `Peran: ${c.is_main ? 'karakter utama' : 'karakter pendukung'}`,
    c.personality ? `Sifat: ${c.personality} (tunjukkan lewat pose, alis, dan ekspresi bawaan)` : '',
    c.appearance ? `Penampilan: ${c.appearance}` : 'Penampilan: tentukan sendiri yang cocok dengan sifatnya, orang Indonesia.',
    '',
    `Gaya gambar "${st.label}":`,
    ...st.draw.map((d) => `- ${d}`),
    '',
    'Aturan teknis (WAJIB):',
    ...all.rig.map((r) => `- ${r}`),
    '- Jangan pakai <style> atau class; tulis warna langsung di atribut fill/stroke.',
    '- Karakter harus orisinal: jangan meniru tokoh, logo, atau merek yang sudah ada.',
    '',
    'Balas HANYA dengan kode SVG lengkap (dimulai <svg dan diakhiri </svg>), tanpa penjelasan, tanpa membuat file.',
  ]
    .filter((l) => l !== '')
    .join('\n');
}

function register({ ipcMain, getWin, claudeCodePath, cwd }) {
  /** @type {import('node:child_process').ChildProcess | null} */
  let child = null;
  const say = (id, line) => {
    const w = getWin();
    if (w && !w.isDestroyed()) w.webContents.send('character:event', { id, line });
  };

  /** Satu panggilan Claude Code headless. Hasil: { text, sessionId }. */
  function ask(claude, prompt, sessionId, id) {
    return new Promise((resolve, reject) => {
      // Prompt lewat stdin: argumen multi-baris rusak kalau claude terpasang sebagai .cmd (lewat shell).
      const args = ['-p', '--output-format', 'json', ...(sessionId ? ['--resume', sessionId] : [])];
      const t0 = Date.now();
      const tick = setInterval(() => say(id, `Claude sedang menggambar... ${Math.round((Date.now() - t0) / 1000)} dtk`), 2000);
      const isCmd = /\.cmd$/i.test(claude);
      child = spawn(isCmd ? `"${claude}"` : claude, args, { cwd, windowsHide: true, shell: isCmd, env: { ...process.env } });
      child.stdin.end(prompt);
      let out = '';
      const err = [];
      const timer = setTimeout(() => child && child.kill(), 10 * 60 * 1000);
      child.stdout.on('data', (b) => (out += b.toString()));
      child.stderr.on('data', (b) => err.push(b.toString()));
      child.on('error', (e) => {
        clearInterval(tick);
        clearTimeout(timer);
        child = null;
        reject(e);
      });
      child.on('close', (code) => {
        clearInterval(tick);
        clearTimeout(timer);
        child = null;
        let r = null;
        try {
          r = JSON.parse(out.trim().split('\n').pop());
        } catch {
          /* bukan JSON */
        }
        if (r && !r.is_error) return resolve({ text: String(r.result || ''), sessionId: r.session_id });
        const msg = r?.result || err.join('').trim() || `Claude Code keluar dengan kode ${code}`;
        reject(new Error(/login|auth|credential/i.test(msg) ? 'Claude Code belum login. Buka terminal, jalankan "claude", lalu login.' : String(msg).slice(0, 400)));
      });
    });
  }

  /**
   * payload: { id (untuk event), character: {name, nickname, is_main, personality, appearance, visual_style},
   *            feedback?: string, sessionId?: string }
   * Tanpa feedback = gambar baru. Dengan feedback + sessionId = revisi dari gambar terakhir di sesi itu.
   */
  ipcMain.handle('character:generate', async (_e, { id, character, feedback, sessionId }) => {
    if (child) throw new Error('Claude sedang menggambar karakter lain. Tunggu selesai dulu.');
    const claude = await claudeCodePath();
    if (!claude) throw new Error('Claude Code tidak ditemukan. Install Claude Code lalu login.');

    let prompt = feedback && sessionId
      ? `Revisi karakter tadi sesuai masukan ini: ${feedback}\nTetap ikuti semua aturan teknis sebelumnya. Balas HANYA dengan SVG lengkap.`
      : characterPrompt(character) + (feedback ? `\n\nPermintaan tambahan: ${feedback}` : '');
    let sid = feedback && sessionId ? sessionId : undefined;

    // Maks 2 percobaan perbaikan otomatis kalau rig belum lengkap.
    for (let attempt = 0; attempt < 3; attempt++) {
      say(id, attempt ? 'Memperbaiki bagian yang kurang...' : 'Claude mulai menggambar...');
      const r = await ask(claude, prompt, sid, id);
      sid = r.sessionId || sid;
      const raw = extractSvg(r.text);
      if (!raw) {
        prompt = 'Jawabanmu tidak berisi SVG. Balas HANYA dengan kode SVG lengkap (<svg ...>...</svg>).';
        continue;
      }
      const svg = sanitizeSvg(raw);
      const problems = checkCharacterSvg(svg);
      if (!problems.length) {
        say(id, 'Selesai');
        return { svg, sessionId: sid };
      }
      prompt = `SVG belum memenuhi aturan rig:\n- ${problems.join('\n- ')}\nPerbaiki dan balas HANYA dengan SVG lengkap.`;
      if (attempt === 2) return { svg, sessionId: sid, problems };
    }
    throw new Error('Claude tidak menghasilkan SVG yang valid. Coba lagi.');
  });

  ipcMain.handle('character:cancel', () => {
    if (!child) return false;
    if (process.platform === 'win32') execFile('taskkill', ['/pid', String(child.pid), '/T', '/F'], () => {});
    else child.kill();
    return true;
  });
}

module.exports = { register, characterPrompt };
