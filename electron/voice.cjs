// Suara narasi lewat vibi.pro: TTS (suara A/B), timing per kata (STT), daftar suara. Dipisah dari main.cjs.
const path = require('node:path');
const fs = require('node:fs');

/** Folder hasil suara satu project (di folder output). */
const voiceOutDir = (s, slug) => path.join(s.outputDir, slug);

function register({ ipcMain, getWin, readSettings, ffmpeg }) {
  const VIBI = 'https://api.vibi.pro';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function vibi(s, p, init = {}) {
    if (!s.vibiApiKey) throw new Error('API key vibi.pro belum diisi di Pengaturan.');
    const res = await fetch(VIBI + p, { ...init, headers: { 'xi-api-key': s.vibiApiKey, ...(init.headers || {}) } });
    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
    if (!res.ok) throw new Error(`vibi.pro ${res.status}: ${body.error || body.detail || body.message || text.slice(0, 200)}`);
    return body;
  }

  /** Polling tugas vibi sampai selesai (maks ~6 menit). */
  async function vibiPoll(s, p, onProgress) {
    // sampai 15 menit: suara video 5 menit bisa lama diproses
    for (let i = 0; i < 450; i++) {
      await sleep(2000);
      const t = await vibi(s, p);
      if (t.status === 'completed') return t;
      if (t.status === 'failed') throw new Error(t.error || t.detail_error || 'Tugas vibi.pro gagal');
      if (onProgress) onProgress(t.progress ?? 0);
    }
    throw new Error('vibi.pro terlalu lama merespons.');
  }


  /**
   * Daftar suara per provider. indo = hanya suara penutur asli bahasa Indonesia:
   * - ElevenLabs: voice library (shared-voices) dengan required_languages=id. Suara bawaan (default-voices)
   *   semuanya penutur Inggris, jadi bahasa Indonesianya berlogat asing.
   * - MiniMax: system voices language=Indonesian.  - CapCut: system voices language=id.
   */
  ipcMain.handle('vibi:voices', async (_e, arg) => {
    const s = readSettings();
    const { provider = 'elevenlabs', search = '', indo = true } = typeof arg === 'object' && arg ? arg : { search: arg };
    const q = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== '' && v != null)).toString();

    if (provider === 'minimax') {
      const r = await vibi(s, `/v1/minimax/system-voices?${q({ page: 1, page_size: 50, search, language: indo ? 'Indonesian' : '' })}`);
      return (r.voice_list || []).map((v) => ({
        id: v.uniq_id || v.voice_id,
        name: v.voice_name,
        description: v.description,
        gender: (v.tag_list || []).find((t) => /^(male|female)$/i.test(t)),
        accent: (v.tag_list || []).filter((t) => !/^(male|female)$/i.test(t)).join(', '),
        preview: v.sample_audio,
      }));
    }
    if (provider === 'capcut') {
      const r = await vibi(s, `/v1/capcut/system-voices?${q({ page: 1, page_size: 50, search, language: indo ? 'id' : '' })}`);
      return (r.voice_list || []).map((v) => ({
        id: v.voice_id,
        name: v.name,
        description: (v.tags || []).join(', '),
        gender: v.gender,
        accent: v.language,
        // Contoh suara CapCut lewat api.vibi.pro butuh header API key, jadi tidak bisa diputar langsung.
        preview: null,
      }));
    }
    if (!indo) {
      const r = await vibi(s, `/v1/default-voices?${q({ page_size: 50, search })}`);
      return (r.voices || []).map((v) => ({ id: v.voice_id, name: v.name, description: v.description, gender: v.gender, accent: v.accent, preview: v.preview_url }));
    }
    const r = await vibi(s, `/v1/shared-voices?${q({ page_size: 50, search, required_languages: 'id', sort: 'usage_character_count_1y' })}`);
    return (r.voices || []).map((v) => {
      const idLang = (v.verified_languages || []).find((l) => l.language_id === 'id');
      return {
        id: v.voice_id,
        name: v.name,
        description: v.description,
        gender: v.gender,
        accent: idLang ? [idLang.language, idLang.accent].filter(Boolean).join(' ') : v.accent,
        // Contoh dalam bahasa Indonesia kalau ada.
        preview: idLang?.preview_url || v.preview_url,
      };
    });
  });

  ipcMain.handle('voice:status', (_e, slug) => {
    const s = readSettings();
    const dir = voiceOutDir(s, slug);
    const mp3 = path.join(dir, 'voice.mp3');
    const words = path.join(dir, 'words.json');
    const metaFile = path.join(dir, 'meta.json');
    let meta = {};
    try {
      meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
    } catch {
      /* suara lama (sebelum 0.7.0) belum punya meta */
    }
    return {
      mp3: fs.existsSync(mp3) ? mp3 : null,
      words: fs.existsSync(words) ? JSON.parse(fs.readFileSync(words, 'utf8')).length : null,
      updatedAt: fs.existsSync(mp3) ? fs.statSync(mp3).mtime.toISOString() : null,
      // Teks yang dipakai saat suara dibuat; aplikasi membandingkannya dengan script sekarang.
      textKey: meta.textKey ?? null,
      wordsEditedAt: meta.wordsEditedAt ?? null,
    };
  });

  const readMeta = (dir) => {
    try {
      return JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
    } catch {
      return {};
    }
  };
  const writeMeta = (dir, patch) => fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ ...readMeta(dir), ...patch }, null, 1));

  /** Untuk editor timing kata: daftar kata + audio mp3 (bytes). */
  ipcMain.handle('voice:words', (_e, slug) => {
    const s = readSettings();
    const dir = voiceOutDir(s, slug);
    const mp3 = path.join(dir, 'voice.mp3');
    const words = path.join(dir, 'words.json');
    if (!fs.existsSync(mp3)) throw new Error('Suara belum dibuat.');
    return {
      words: fs.existsSync(words) ? JSON.parse(fs.readFileSync(words, 'utf8')) : [],
      audio: new Uint8Array(fs.readFileSync(mp3)),
    };
  });

  /** Simpan timing kata hasil edit (dipakai render berikutnya untuk teks di layar dan panjang shot). */
  ipcMain.handle('voice:saveWords', (_e, { slug, words }) => {
    if (!Array.isArray(words) || !words.length) throw new Error('Daftar kata kosong.');
    const clean = words.map((w, i) => {
      const a = Math.round(Number(w.s) * 1000) / 1000;
      const b = Math.round(Number(w.e) * 1000) / 1000;
      if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b < a) throw new Error(`Waktu kata ke-${i + 1} ("${w.text}") tidak valid.`);
      return { s: a, e: b, text: String(w.text ?? '') };
    });
    clean.sort((x, y) => x.s - y.s);
    const s = readSettings();
    const dir = voiceOutDir(s, slug);
    const json = JSON.stringify(clean, null, 1);
    fs.writeFileSync(path.join(dir, 'words.json'), json);
    if (s.remotionProjectPath && fs.existsSync(path.join(s.remotionProjectPath, s.voiceDir))) {
      fs.writeFileSync(path.join(s.remotionProjectPath, s.voiceDir, 'words.json'), json);
    }
    writeMeta(dir, { wordsEditedAt: new Date().toISOString() });
    return { count: clean.length };
  });


  /**
   * Rapikan teks sebelum TTS supaya tidak ada kata yang terjeda/terpisah: baris baru dan spasi ganda jadi satu spasi,
   * "..." / "--" (sering jadi jeda panjang di tengah kalimat) jadi koma, tag arahan [..] dibuang, isi kurung jadi sisipan berkoma, markdown dibuang,
   * tanda baca ganda dirapikan, dan tidak ada spasi sebelum tanda baca.
   */
  function cleanTtsText(text) {
    return String(text || '')
      .replace(/\[[^\]]*\]/g, ' ')
      .replace(/\(([^)]*)\)/g, ', $1, ')
      .replace(/[*_#`~]+/g, '')
      .replace(/\s*(\.{2,}|…|--|—|–)\s*/g, ', ')
      .replace(/\s+/g, ' ')
      .replace(/\s+([,.!?;:])/g, '$1')
      .replace(/([,;:])\s*(?=[,.!?;:])/g, '')
      .replace(/([!?.]){2,}/g, '$1')
      .replace(/^[,\s]+/, '')
      .trim();
  }

  /**
   * Pengaturan suara yang lebih ekspresif/natural. ElevenLabs v2/turbo/flash: stabilitas sedikit lebih rendah
   * (intonasi hidup), style ringan, speaker boost. eleven_v3 hanya menerima stabilitas 0 / 0,5 / 1 (0,5 = Natural).
   * plain=true: pengaturan lama (cadangan kalau vibi.pro menolak field tambahan).
   */
  function voiceSettings(provider, model, speed, plain = false) {
    const sp = Number(speed) || 1;
    if (provider !== 'elevenlabs') return { speed: sp, pitch: 0 };
    if (plain) return { stability: 0.5, similarity_boost: 0.75, speed: sp };
    if (/v3/.test(String(model || ''))) return { stability: 0.5, similarity_boost: 0.8, use_speaker_boost: true, speed: sp };
    return { stability: 0.45, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true, speed: sp };
  }

  /** Satu kali TTS vibi.pro dengan konfigurasi suara tertentu; hasilnya ditulis ke file mp3. */
  async function vibiTts(s, voice, text, outFile, onProgress) {
    const clean = cleanTtsText(text);
    const post = (plain) =>
      vibi(s, `/v1/text-to-speech/${encodeURIComponent(voice.voiceId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: clean,
          provider: voice.provider,
          ...(voice.provider !== 'capcut' && voice.model ? { model_id: voice.model } : {}),
          language_code: voice.language,
          voice_settings: voiceSettings(voice.provider, voice.model, voice.speed, plain),
        }),
      });
    const task = await post(false).catch((e) => (/vibi.pro (400|422)/.test(e.message) ? post(true) : Promise.reject(e)));
    const done = await vibiPoll(s, `/v1/history/${task.id}`, onProgress);
    const audioUrl = done.result?.audio_url;
    if (!audioUrl) throw new Error('vibi.pro tidak mengembalikan audio_url.');
    const res = await fetch(audioUrl, audioUrl.startsWith(VIBI) ? { headers: { 'xi-api-key': s.vibiApiKey } } : {});
    if (!res.ok) throw new Error(`Gagal mengunduh audio (${res.status})`);
    await writeReplacing(outFile, Buffer.from(await res.arrayBuffer()));
    return done.credits_deducted ?? 0;
  }

  /**
   * Tulis file lewat file sementara lalu ganti file lama. Di Windows file yang sedang dibuka pemutar musik
   * (mis. Windows Media Player dari tombol Dengar versi lama) terkunci: coba lagi beberapa kali, lalu beri
   * pesan yang jelas daripada "EBUSY: resource busy or locked".
   */
  async function writeReplacing(file, data) {
    const tmp = `${file}.baru`;
    fs.writeFileSync(tmp, data);
    for (let i = 0; ; i++) {
      try {
        fs.rmSync(file, { force: true });
        fs.renameSync(tmp, file);
        return;
      } catch (e) {
        if (!/EBUSY|EPERM|EACCES/.test(e.code || e.message) || i >= 10) {
          fs.rmSync(tmp, { force: true });
          if (/EBUSY|EPERM|EACCES/.test(e.code || e.message)) {
            throw new Error(`File ${path.basename(file)} sedang dibuka program lain (mis. Windows Media Player). Tutup pemutarnya, lalu klik Buat ulang suara lagi.`);
          }
          throw e;
        }
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  }

  const voiceA = (s) => ({ provider: s.vibiProvider, model: s.vibiModel, voiceId: s.vibiVoiceId, language: s.vibiLanguage, speed: s.vibiSpeed });
  const voiceB = (s) => ({ provider: s.vibiProvider, model: s.vibi2Model, voiceId: s.vibi2VoiceId, language: s.vibi2Language, speed: s.vibi2Speed });

  /**
   * payload.text  : satu narator (suara A).
   * payload.lines : project 2 suara [{ speaker: 'A'|'B', text }] -> tiap giliran pakai suara A atau B
   *                 (provider sama, model/suara beda), digabung dengan jeda 0,3 detik.
   */
  ipcMain.handle('voice:generate', async (_e, { slug, text, lines, textKey }) => {
    const s = readSettings();
    const say = (step, progress) => {
      const win = getWin();
      if (win && !win.isDestroyed()) win.webContents.send('voice:event', { slug, step, progress });
    };
    if (!s.vibiVoiceId) throw new Error('Pilih suara A dulu di Pengaturan > Suara & audio.');
    const dialog = Array.isArray(lines) && lines.some((l) => l.speaker === 'B');
    if (dialog && !s.vibi2VoiceId) throw new Error('Project ini memakai 2 suara. Pilih suara B dulu di Pengaturan > Suara & audio.');
    if (!dialog && !String(text || '').trim()) throw new Error('Script masih kosong.');

    const dir = voiceOutDir(s, slug);
    fs.mkdirSync(dir, { recursive: true });
    const mp3 = path.join(dir, 'voice.mp3');
    const notes = [];
    let credits = 0;
    const hasRemotion = s.remotionProjectPath && fs.existsSync(s.remotionProjectPath);
    const vdir = hasRemotion ? path.join(s.remotionProjectPath, s.voiceDir) : null;
    if (vdir) fs.mkdirSync(vdir, { recursive: true });

    if (!dialog) {
      // 1. Satu narator: TTS sekali, lalu konversi ke voice.wav 48 kHz (format yang diminta mix.py skill).
      say('Membuat suara', 0);
      credits += await vibiTts(s, voiceA(s), text, mp3, (p) => say('Membuat suara', p));
      if (vdir) {
        say('Konversi ke WAV 48 kHz', 100);
        const r = await ffmpeg(s, ['-y', '-i', mp3, '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s24le', path.join(vdir, 'voice.wav')]);
        if (!r.ok) notes.push(`Konversi WAV gagal: ${r.log.split('\n').slice(-2).join(' ')}`);
      } else {
        notes.push('Folder Remotion belum diatur, voice.wav belum dibuat.');
      }
    } else {
      // 1. Dialog/film: TTS per giliran dengan suara A/B, samakan format, gabung dengan jeda.
      const parts = path.join(dir, 'parts');
      fs.rmSync(parts, { recursive: true, force: true });
      fs.mkdirSync(parts, { recursive: true });
      const turns = lines.filter((l) => String(l.text || '').trim());
      const list = [];
      const gap = path.join(parts, 'gap.wav');
      const g = await ffmpeg(s, ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono', '-t', '0.3', '-c:a', 'pcm_s24le', gap]);
      if (!g.ok) throw new Error(`ffmpeg tidak bisa dipakai: ${g.log.split('\n').slice(-2).join(' ')}`);
      for (let i = 0; i < turns.length; i++) {
        const t = turns[i];
        const who = t.speaker === 'B' ? 'B' : 'A';
        const label = `Suara ${who}: giliran ${i + 1}/${turns.length}`;
        say(label, Math.round((i / turns.length) * 100));
        const partMp3 = path.join(parts, `${String(i).padStart(3, '0')}-${who}.mp3`);
        credits += await vibiTts(s, who === 'B' ? voiceB(s) : voiceA(s), t.text, partMp3, () => {});
        const partWav = partMp3.replace(/\.mp3$/, '.wav');
        const r = await ffmpeg(s, ['-y', '-i', partMp3, '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s24le', partWav]);
        if (!r.ok) throw new Error(`Konversi giliran ${i + 1} gagal: ${r.log.split('\n').slice(-2).join(' ')}`);
        if (list.length) list.push(gap);
        list.push(partWav);
      }
      say('Menggabungkan dua suara', 100);
      const listFile = path.join(parts, 'list.txt');
      fs.writeFileSync(listFile, list.map((f) => `file '${f.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'));
      const fullWav = path.join(dir, 'voice.wav');
      const c = await ffmpeg(s, ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c:a', 'pcm_s24le', fullWav]);
      if (!c.ok) throw new Error(`Gagal menggabungkan suara: ${c.log.split('\n').slice(-2).join(' ')}`);
      await ffmpeg(s, ['-y', '-i', fullWav, '-c:a', 'libmp3lame', '-b:a', '160k', mp3]);
      if (vdir) fs.copyFileSync(fullWav, path.join(vdir, 'voice.wav'));
      else notes.push('Folder Remotion belum diatur, voice.wav belum disalin.');
    }

    // 3. Timing per kata lewat speech-to-text, disimpan sebagai words.json [{s, e, text}].
    let wordCount = null;
    if (s.wordTimestamps) {
      say('Membuat timing per kata', 0);
      const form = new FormData();
      form.append('file', new Blob([fs.readFileSync(mp3)], { type: 'audio/mpeg' }), 'voice.mp3');
      // STT butuh kode ISO ("id"); MiniMax memakai nama bahasa ("Indonesian").
      const lang = String(s.vibiLanguage || 'id');
      form.append('language_code', /^indonesia/i.test(lang) ? 'id' : lang.length <= 3 ? lang : 'id');
      form.append('timestamps_granularity', 'word');
      form.append('tag_audio_events', 'false');
      const stt = await vibi(s, '/v1/speech-to-text', { method: 'POST', body: form });
      const tid = stt.task_id || stt.id;
      const tr = await vibiPoll(s, `/v1/speech-to-text/${tid}`, (p) => say('Membuat timing per kata', p));
      const words = (tr.result?.words || [])
        .filter((w) => w.type === 'word')
        .map((w) => ({ s: w.start, e: w.end, text: w.text }));
      const json = JSON.stringify(words, null, 1);
      fs.writeFileSync(path.join(dir, 'words.json'), json);
      if (s.remotionProjectPath && fs.existsSync(s.remotionProjectPath)) {
        fs.writeFileSync(path.join(s.remotionProjectPath, s.voiceDir, 'words.json'), json);
      }
      wordCount = words.length;
    }

    // Catat teks yang dipakai: kalau script/narasi diubah sesudah ini, aplikasi memberi tanda "perlu dibuat ulang".
    writeMeta(dir, { textKey: textKey ?? null, createdAt: new Date().toISOString(), wordsEditedAt: null });

    say('Selesai', 100);
    return { mp3, words: wordCount, credits, notes };
  });
}

module.exports = { register, voiceOutDir };
