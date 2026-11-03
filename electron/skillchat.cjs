// Panel obrolan Claude di dalam aplikasi untuk style dari skill (animate, bang-motion, hyperforge-studio).
// Skill tetap dipakai utuh; yang berubah hanya "layar"-nya: setiap giliran menjalankan Claude Code headless dengan
// sesi yang sama (--resume), dan pertanyaan/persetujuan skill tampil sebagai tombol di aplikasi.
//
// Protokol (lewat --append-system-prompt): AskUserQuestion dimatikan; Claude menulis blok ```pilihan {json}``` lalu
// mengakhiri giliran. Gambar untuk pengguna: ```gambar <path>```, video: ```video <path>```.
const fs = require('node:fs');
const path = require('node:path');
const { spawn, execFile } = require('node:child_process');

const SYSTEM = [
  'Kamu berjalan di dalam aplikasi HyperForge (panel obrolan), bukan di terminal. Pengguna tidak melihat terminal, output perintah, atau isi file; dia hanya melihat teks balasanmu dan gambar yang kamu tunjukkan.',
  'Alat AskUserQuestion TIDAK tersedia. Setiap kali skill memintamu bertanya atau meminta persetujuan: tulis penjelasan singkat, lalu SATU blok kode berbahasa "pilihan" berisi JSON {"pertanyaan": "...", "pilihan": ["opsi 1 (disarankan)", "opsi 2", ...], "multi": false} (multi true kalau boleh pilih lebih dari satu), lalu AKHIRI giliranmu dan tunggu jawaban. Pengguna juga bisa mengetik jawaban sendiri.',
  'Untuk menunjukkan gambar (lembar kontak, contoh frame, storyboard, lembar karakter, galeri gaya): tulis blok kode berbahasa "gambar" berisi path file (satu path per baris, relatif ke folder kerja atau absolut). Untuk video: blok berbahasa "video" berisi path file. Tunjukkan gambar setiap kali meminta persetujuan visual.',
  'Jangan meminta pengguna membuka terminal atau menjalankan perintah; jalankan sendiri. Jangan menampilkan isi file panjang atau kode di balasan kecuali diminta. SELALU Bahasa Indonesia untuk semua teks yang kamu tulis ke pengguna, termasuk kalimat pendek di sela pekerjaan. Ringkas.',
].join('\n');

const IMG = /\.(png|jpe?g|webp|gif)$/i;

/** Pecah teks asisten jadi teks biasa + pertanyaan + gambar + video. */
function parseAssistant(text) {
  const out = { text: '', question: null, images: [], videos: [] };
  out.text = String(text)
    .replace(/```pilihan\s*\n([\s\S]*?)```/g, (_m, body) => {
      try {
        const q = JSON.parse(body.trim());
        if (q && Array.isArray(q.pilihan)) out.question = { pertanyaan: String(q.pertanyaan || ''), pilihan: q.pilihan.map(String).slice(0, 12), multi: Boolean(q.multi) };
      } catch {
        /* JSON rusak: biarkan sebagai teks */
        return body;
      }
      return '';
    })
    .replace(/```(gambar|video)\s*\n([\s\S]*?)```/g, (_m, kind, body) => {
      for (const l of body.split(/\r?\n/).map((x) => x.trim()).filter(Boolean)) (kind === 'video' ? out.videos : out.images).push(l);
      return '';
    })
    .trim();
  return out;
}

/** Ringkasan satu pemakaian alat untuk ditampilkan kecil di obrolan. */
function toolLine(c) {
  const i = c.input || {};
  const n = String(c.name || '');
  const short = (x, k = 110) => (String(x).length > k ? String(x).slice(0, k) + '…' : String(x));
  if (n === 'Bash') return { text: `Menjalankan: ${short(i.description || i.command)}` };
  if (n === 'Read') return IMG.test(i.file_path || '') ? { text: `Melihat gambar ${path.basename(i.file_path)}`, images: [i.file_path] } : { text: `Membaca ${short(i.file_path, 80)}` };
  if (n === 'Write') return { text: `Menulis ${short(i.file_path, 80)}` };
  if (n === 'Edit') return { text: `Mengubah ${short(i.file_path, 80)}` };
  if (n === 'WebSearch') return { text: `Mencari di web: ${short(i.query)}` };
  if (n === 'WebFetch') return { text: `Membaca sumber: ${short(i.url)}` };
  if (n === 'Skill') return { text: `Memuat skill ${i.skill || i.command || ''}` };
  if (/vibi_tts|vibi_voice/.test(n)) return { text: i.estimate ? 'Menghitung kredit suara' : 'Membuat suara (vibi.pro)' };
  if (/vibi_words/.test(n)) return { text: 'Mengambil timing per kata' };
  if (n === 'Glob' || n === 'Grep') return { text: `Mencari file: ${short(i.pattern)}` };
  if (n === 'TodoWrite') return null;
  return { text: `Memakai ${n}` };
}

function register({ ipcMain, getWin, engineOf, prepareSession }) {
  /** key "engine:slug" -> { child, stopped } */
  const running = new Map();
  const files = (e, slug) => ({ hist: path.join(e.work, 'briefs', `${slug}.chat.json`), sess: path.join(e.work, 'briefs', `${slug}.session`) });
  const readHist = (e, slug) => {
    try {
      return JSON.parse(fs.readFileSync(files(e, slug).hist, 'utf8'));
    } catch {
      return [];
    }
  };
  const emit = (payload) => {
    const w = getWin();
    if (w && !w.isDestroyed()) w.webContents.send('skillchat:event', payload);
  };

  ipcMain.handle('skillchat:history', (_e, { engine, slug }) => {
    const e = engineOf(engine);
    return { messages: readHist(e, slug), running: running.has(`${engine}:${slug}`), hasSession: fs.existsSync(files(e, slug).sess) };
  });

  /**
   * Kirim satu giliran. Giliran pertama (belum ada sesi): siapkan brief lalu kirim perintah skill.
   * payload: { engine, slug, title, brief?, files?, text? }
   */
  ipcMain.handle('skillchat:send', async (_ev, { engine, slug, title, brief, files: extra, text }) => {
    const e = engineOf(engine);
    const key = `${engine}:${slug}`;
    if (running.has(key)) throw new Error('Claude masih bekerja di giliran ini. Tunggu atau klik Hentikan.');
    const f = files(e, slug);
    const sid = fs.existsSync(f.sess) ? fs.readFileSync(f.sess, 'utf8').trim() : null;
    const prep = await prepareSession(e, { slug, title, brief: sid ? null : brief, files: sid ? null : extra });
    const prompt = sid ? String(text || '').trim() : `${prep.prompt.replace(/^\/([\w-]+)\s*/, 'Pakai skill $1. ')}${text ? `\n\n${text}` : ''}`;
    if (!prompt) throw new Error('Pesan kosong.');

    const hist = readHist(e, slug);
    const push = (m) => {
      const msg = { id: `${Date.now()}-${hist.length}`, at: new Date().toISOString(), ...m };
      hist.push(msg);
      fs.writeFileSync(f.hist, JSON.stringify(hist, null, 1));
      emit({ engine, slug, type: 'message', message: msg });
      return msg;
    };
    push({ role: 'user', text: sid ? prompt : text || `Mulai project "${title}" dengan skill ${e.name}.` });

    const args = ['-p', '--output-format', 'stream-json', '--verbose', '--mcp-config', prep.mcpFile, '--append-system-prompt', SYSTEM, '--disallowedTools', 'AskUserQuestion', ...(sid ? ['--resume', sid] : []), '--allowedTools', ...prep.allowed];
    const env = { ...process.env, PATH: `${prep.ffDir}${path.delimiter}${process.env.PATH}`, ...(prep.npmRoot ? { NODE_PATH: prep.npmRoot } : {}) };
    const isCmd = /\.cmd$/i.test(prep.claude);
    const child = spawn(isCmd ? `"${prep.claude}"` : prep.claude, isCmd ? args.map((a) => (/[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a)) : args, { cwd: e.work, env, windowsHide: true, shell: isCmd });
    const state = { child, stopped: false };
    running.set(key, state);
    emit({ engine, slug, type: 'status', running: true });
    child.stdin.end(prompt);

    return await new Promise((resolve) => {
      let buf = '';
      const errTail = [];
      let result = null;
      child.stdout.on('data', (b) => {
        buf += b.toString();
        let nl;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          let ev;
          try {
            ev = JSON.parse(line);
          } catch {
            continue;
          }
          if (ev.type === 'system' && ev.subtype === 'init' && ev.session_id) fs.writeFileSync(f.sess, ev.session_id);
          else if (ev.type === 'assistant') {
            for (const c of ev.message?.content || []) {
              if (c.type === 'text' && c.text.trim()) {
                const p = parseAssistant(c.text);
                if (p.text || p.question || p.images.length || p.videos.length) push({ role: 'assistant', ...p });
              } else if (c.type === 'tool_use') {
                const t = toolLine(c);
                if (t) push({ role: 'tool', ...t });
              }
            }
          } else if (ev.type === 'result') result = ev;
        }
      });
      child.stderr.on('data', (b) => {
        errTail.push(b.toString().trim());
        if (errTail.length > 8) errTail.shift();
      });
      const done = (code) => {
        running.delete(key);
        if (state.stopped) push({ role: 'system', text: 'Dihentikan.' });
        else if (result?.is_error || (!result && code !== 0)) {
          const msg = String(result?.result || errTail.join('\n') || `Claude Code keluar dengan kode ${code}`);
          push({ role: 'system', error: true, text: /login|auth|credential/i.test(msg) ? 'Claude Code belum login. Buka terminal, jalankan "claude", lalu login.' : msg.slice(0, 600) });
        }
        emit({ engine, slug, type: 'status', running: false });
        resolve({ ok: !state.stopped && !result?.is_error });
      };
      child.on('error', (err) => {
        errTail.push(err.message);
        done(-1);
      });
      child.on('close', done);
    });
  });

  ipcMain.handle('skillchat:stop', (_e, { engine, slug }) => {
    const st = running.get(`${engine}:${slug}`);
    if (!st) return false;
    st.stopped = true;
    if (process.platform === 'win32') execFile('taskkill', ['/pid', String(st.child.pid), '/T', '/F'], () => {});
    else st.child.kill();
    return true;
  });

  /** Mulai percakapan baru (sesi & riwayat lama dihapus; file proyek tetap). */
  ipcMain.handle('skillchat:reset', (_e, { engine, slug }) => {
    const e = engineOf(engine);
    if (running.has(`${engine}:${slug}`)) throw new Error('Hentikan dulu giliran yang sedang berjalan.');
    const f = files(e, slug);
    fs.rmSync(f.hist, { force: true });
    fs.rmSync(f.sess, { force: true });
    return true;
  });

  /** Gambar dari folder kerja / skill sebagai data URL (untuk ditampilkan di obrolan). */
  ipcMain.handle('skillchat:image', (_e, { engine, file }) => {
    const e = engineOf(engine);
    const p = path.resolve(e.work, String(file));
    const allowed = [path.resolve(e.work) + path.sep, path.resolve(e.dst) + path.sep];
    if (!allowed.some((a) => p.startsWith(a)) || !IMG.test(p) || !fs.existsSync(p)) return null;
    const st = fs.statSync(p);
    if (st.size > 15 * 1024 * 1024) return null;
    const ext = path.extname(p).slice(1).toLowerCase().replace('jpg', 'jpeg');
    return { url: `data:image/${ext};base64,${fs.readFileSync(p).toString('base64')}`, mtime: st.mtimeMs };
  });

  /** Path file di folder kerja (untuk tombol Putar video). */
  ipcMain.handle('skillchat:resolve', (_e, { engine, file }) => {
    const e = engineOf(engine);
    const p = path.resolve(e.work, String(file));
    return p.startsWith(path.resolve(e.work) + path.sep) && fs.existsSync(p) ? p : null;
  });
}

module.exports = { register, parseAssistant };
