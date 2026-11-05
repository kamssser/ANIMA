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
  'Demi keamanan, izin perintah dibatasi (node, python, ffmpeg, dan skrip milik skill). Kalau sebuah perintah ditolak izin, cari cara lain dengan alat yang diizinkan; jangan meminta pengguna mematikan pembatasan.',
  'Jangan meminta pengguna membuka terminal atau menjalankan perintah; jalankan sendiri. Jangan menampilkan isi file panjang atau kode di balasan kecuali diminta. SELALU Bahasa Indonesia untuk semua teks yang kamu tulis ke pengguna, termasuk kalimat pendek di sela pekerjaan. Ringkas.',
].join('\n');

const IMG = /\.(png|jpe?g|webp|gif)$/i;

/**
 * Frame referensi gaya dari folder pengguna -> <proyek>/referensi/gaya/ (maks 24, tersebar merata) + 2 lembar kontak.
 * Hanya di laptop pengguna; tidak pernah diunggah. Mengembalikan teks tambahan untuk brief.
 */
function copyStyleRefs(srcDir, projDir, ffDir) {
  if (!srcDir || !fs.existsSync(srcDir)) return '';
  const all = fs.readdirSync(srcDir).filter((f) => IMG.test(f)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (!all.length) return '';
  const n = Math.min(24, all.length);
  const pick = Array.from({ length: n }, (_, i) => all[Math.floor((i * all.length) / n)]);
  const out = path.join(projDir, 'referensi', 'gaya');
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  pick.forEach((f, i) => fs.copyFileSync(path.join(srcDir, f), path.join(out, `ref_${String(i).padStart(3, '0')}${path.extname(f).toLowerCase()}`)));
  const ext = path.extname(pick[0]).toLowerCase();
  const same = pick.every((f) => path.extname(f).toLowerCase() === ext);
  if (same) {
    const ff = path.join(ffDir, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
    require('node:child_process').spawnSync(ff, ['-v', 'error', '-y', '-start_number', '0', '-i', path.join(out, `ref_%03d${ext}`), '-vf', 'scale=480:-2,tile=4x3:padding=6:color=black', path.join(out, 'lembar_%02d.jpg')], { windowsHide: true });
  }
  const sheets = fs.readdirSync(out).filter((f) => f.startsWith('lembar_'));
  return [
    '',
    '## Frame referensi gaya dari pengguna',
    `- ${n} frame dari video referensi ada di \`${path.relative(path.dirname(projDir), out).replace(/\\/g, '/')}/\` (${sheets.length ? `lembar kontak: ${sheets.join(', ')}` : 'ref_000 ...'}).`,
    '- LIHAT lembar kontaknya (Read) sebelum menentukan gaya dan menggambar karakter. Tiru ~90% cara gambarnya: bentuk tokoh, proporsi, palet, bayangan, latar, tipografi label/infografis, gerak kamera, dan ritme potongan.',
    '- JANGAN menyalin tokoh, wajah, logo, nama channel, teks, atau adegan dari referensi; buat semuanya orisinal. Jangan menyebut nama channel referensi di video.',
    '- Tunjukkan satu lembar kontak referensi berdampingan dengan frame contohmu saat meminta persetujuan gaya.',
  ].join('\n');
}

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

function register({ ipcMain, getWin, engineOf, slugOk, prepareSession }) {
  /** key "engine:slug" -> { child, stopped } */
  const running = new Map();
  /** File riwayat/sesi/log satu proyek. Slug dari tampilan divalidasi dulu (sama seperti storage.cjs), jadi tidak bisa keluar dari folder briefs. */
  const files = (e, slug) => {
    if (!slugOk(slug)) throw new Error('Nama proyek tidak valid');
    return {
      hist: path.join(e.work, 'briefs', `${slug}.chat.json`),
      sess: path.join(e.work, 'briefs', `${slug}.session`),
      log: path.join(e.work, 'briefs', `${slug}.log`),
    };
  };
  /** Log lengkap sesi (perintah, hasil, error) untuk Pengaturan > Log. Dipotong kalau > 4 MB. */
  const logTo = (file) => (kind, text) => {
    try {
      if (fs.existsSync(file) && fs.statSync(file).size > 4 * 1024 * 1024) {
        const keep = fs.readFileSync(file, 'utf8').slice(-2 * 1024 * 1024);
        fs.writeFileSync(file, keep);
      }
      const t = new Date().toLocaleTimeString('id-ID', { hour12: false });
      fs.appendFileSync(file, `[${t}] ${kind.padEnd(7)} ${String(text).replace(/\r/g, '')}\n`);
    } catch {
      /* log gagal ditulis: abaikan */
    }
  };
  const clip = (s, n) => (String(s).length > n ? `${String(s).slice(0, n)} …(${String(s).length - n} karakter lagi)` : String(s));
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
  ipcMain.handle('skillchat:send', async (_ev, { engine, slug, title, brief, files: extra, text, refDir }) => {
    const e = engineOf(engine);
    const key = `${engine}:${slug}`;
    if (running.has(key)) throw new Error('Claude masih bekerja di giliran ini. Tunggu atau klik Hentikan.');
    const f = files(e, slug);
    const sid = fs.existsSync(f.sess) ? fs.readFileSync(f.sess, 'utf8').trim() : null;
    const prep = await prepareSession(e, { slug, title, brief: sid ? null : brief, files: sid ? null : extra });
    if (!sid && refDir) {
      const add = copyStyleRefs(refDir, e.videoDir(slug), prep.ffDir);
      if (add) fs.appendFileSync(prep.briefFile, add + '\n');
    }
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

    const isCmd = /\.cmd$/i.test(prep.claude);
    // Lewat cmd.exe (claude.cmd), aturan izin bertanda kutip rawan pecah: dilewati (perintah itu lalu ditolak, bukan diizinkan).
    const allowed = isCmd ? prep.allowed.filter((a) => !a.includes('"')) : prep.allowed;
    const args = ['-p', '--output-format', 'stream-json', '--verbose', '--mcp-config', prep.mcpFile, '--append-system-prompt', SYSTEM, '--disallowedTools', 'AskUserQuestion', ...prep.denied, ...(sid ? ['--resume', sid] : []), '--allowedTools', ...allowed];
    const env = { ...process.env, PATH: prep.pathPrefix ? `${prep.pathPrefix}${path.delimiter}${process.env.PATH}` : process.env.PATH, ...(prep.npmRoot ? { NODE_PATH: prep.npmRoot } : {}) };
    const child = spawn(isCmd ? `"${prep.claude}"` : prep.claude, isCmd ? args.map((a) => (/[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a)) : args, { cwd: e.work, env, windowsHide: true, shell: isCmd });
    const state = { child, stopped: false };
    running.set(key, state);
    const log = logTo(f.log);
    log('MULAI', `giliran ${sid ? 'lanjutan' : 'pertama'} · ${e.name} · ${slug}\n${clip(prompt, 2000)}`);
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
          if (ev.type === 'system' && ev.subtype === 'init' && ev.session_id) {
            fs.writeFileSync(f.sess, ev.session_id);
            log('SESI', `${ev.session_id} · model ${ev.model || '-'}`);
          } else if (ev.type === 'user') {
            // hasil alat (output perintah, isi file): ke log + kabar aktivitas ke panel
            for (const c of ev.message?.content || []) {
              if (c.type !== 'tool_result') continue;
              const body = Array.isArray(c.content) ? c.content.map((x) => (x.type === 'text' ? x.text : `[${x.type}]`)).join('\n') : String(c.content ?? '');
              log(c.is_error ? 'ERROR' : 'HASIL', clip(body, 4000));
              emit({ engine, slug, type: 'activity', text: c.is_error ? 'Perintah gagal, Claude memperbaiki...' : 'Langkah selesai, lanjut...', at: Date.now() });
            }
          } else if (ev.type === 'assistant') {
            for (const c of ev.message?.content || []) {
              if (c.type === 'tool_use') log('ALAT', `${c.name} ${clip(JSON.stringify(c.input), 1500)}`);
              else if (c.type === 'text' && c.text.trim()) log('CLAUDE', clip(c.text, 3000));
              if (c.type === 'text' && c.text.trim()) {
                const p = parseAssistant(c.text);
                if (p.text || p.question || p.images.length || p.videos.length) push({ role: 'assistant', ...p });
              } else if (c.type === 'tool_use') {
                const t = toolLine(c);
                if (t) push({ role: 'tool', ...t });
              }
            }
          } else if (ev.type === 'result') {
            result = ev;
            log('SELESAI', `${ev.is_error ? 'error' : 'ok'} · ${Math.round((ev.duration_ms || 0) / 1000)} dtk · ${ev.num_turns ?? '-'} langkah${ev.is_error ? `\n${clip(ev.result, 2000)}` : ''}`);
          }
        }
      });
      child.stderr.on('data', (b) => {
        log('STDERR', clip(b.toString().trim(), 2000));
        errTail.push(b.toString().trim());
        if (errTail.length > 8) errTail.shift();
      });
      const done = (code) => {
        running.delete(key);
        log('KELUAR', `kode ${code}${state.stopped ? ' (dihentikan pengguna)' : ''}`);
        if (state.stopped) push({ role: 'system', text: 'Dihentikan.' });
        else if (result?.is_error || (!result && code !== 0)) {
          const msg = String(result?.result || errTail.join('\n') || `Claude Code keluar dengan kode ${code}`);
          push({ role: 'system', error: true, text: /login|auth|credential|401|403/i.test(msg) ? (process.env.ANTHROPIC_BASE_URL ? `Otak custom menolak permintaan (cek API key, base URL, dan model di Pengaturan > Otak AI): ${msg.slice(0, 200)}` : 'Claude Code belum login. Buka terminal, jalankan "claude", lalu login.') : msg.slice(0, 600) });
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

  /** Semua log sesi (Pengaturan > Log), terbaru dulu. */
  ipcMain.handle('skillchat:logs', (_e, engines) => {
    const out = [];
    for (const id of engines) {
      const e = engineOf(id);
      const dir = path.join(e.work, 'briefs');
      let names = [];
      try {
        names = fs.readdirSync(dir).filter((n) => n.endsWith('.log'));
      } catch {
        continue;
      }
      for (const n of names) {
        const st = fs.statSync(path.join(dir, n));
        const slug = n.replace(/\.log$/, '');
        out.push({ engine: id, slug, size: st.size, mtime: st.mtime.toISOString(), running: running.has(`${id}:${slug}`) });
      }
    }
    return out.sort((a, b) => b.mtime.localeCompare(a.mtime));
  });

  /** Bagian akhir log satu sesi. */
  ipcMain.handle('skillchat:logtail', (_e, { engine, slug, kb = 200 }) => {
    const e = engineOf(engine);
    const p = files(e, slug).log;
    if (!fs.existsSync(p)) return '';
    const size = fs.statSync(p).size;
    const n = Math.min(size, kb * 1024);
    const fd = fs.openSync(p, 'r');
    const buf = Buffer.alloc(n);
    fs.readSync(fd, buf, 0, n, size - n);
    fs.closeSync(fd);
    return (size > n ? '…\n' : '') + buf.toString('utf8');
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

  return { isRunning: (engine, slug) => running.has(`${engine}:${slug}`) };
}

module.exports = { register, parseAssistant, copyStyleRefs };
