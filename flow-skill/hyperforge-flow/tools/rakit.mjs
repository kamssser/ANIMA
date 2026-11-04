#!/usr/bin/env node
// Rakit video HyperForge Flow: klip Google Flow (video + SFX) + narasi vibi.pro + subtitle -> MP4.
//   node rakit.mjs <folder-proyek>        (membaca <folder-proyek>/rakit.json, lihat SKILL.md langkah 6)
// Hasil: <proyek>/hasil/<nama>.mp4 dan <proyek>/hasil/<nama>_tanpa_subtitle.mp4
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const proj = path.resolve(process.argv[2] || '.');
const name = path.basename(proj);
const cfgFile = path.join(proj, 'rakit.json');
if (!fs.existsSync(cfgFile)) die(`Tidak ada ${cfgFile}`);
const cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
const [W, H] = cfg.format === '16:9' ? [1920, 1080] : [1080, 1920];
const FPS = cfg.fps || 30;
const tmp = path.join(proj, 'hasil', '_rakit');
fs.mkdirSync(tmp, { recursive: true });

function die(msg) {
  console.error(`rakit: ${msg}`);
  process.exit(1);
}
function ff(args, label) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { cwd: proj, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) die(`${label} gagal:\n${(r.stderr || r.error?.message || '').slice(-1500)}`);
}
function probe(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type', '-of', 'json', file], { cwd: proj, encoding: 'utf8' });
  if (r.status !== 0) die(`ffprobe ${file}: ${r.stderr}`);
  const j = JSON.parse(r.stdout);
  return { dur: Number(j.format?.duration || 0), audio: (j.streams || []).some((s) => s.codec_type === 'audio') };
}
const rel = (p) => path.relative(proj, path.resolve(proj, p)).replace(/\\/g, '/');

// ---------- 1. potong tiap shot ke durasinya ----------
const voice = cfg.suara ? rel(cfg.suara) : null;
if (voice && !fs.existsSync(path.join(proj, voice))) die(`Suara tidak ada: ${voice}`);
const voDur = voice ? probe(voice).dur : 0;
const shots = [...(cfg.shot || [])].sort((a, b) => a.mulai - b.mulai);
if (!shots.length) die('rakit.json tidak punya shot');
const end = Math.max(voDur + 0.5, shots.at(-1).selesai);
const segs = [];
shots.forEach((s, i) => {
  const start = i === 0 ? 0 : s.mulai;
  const stop = i === shots.length - 1 ? end : shots[i + 1].mulai;
  const dur = Math.max(0.3, stop - start);
  const clip = rel(s.klip);
  if (!fs.existsSync(path.join(proj, clip))) die(`Klip tidak ada: ${clip}`);
  const info = probe(clip);
  const from = Math.max(0, Math.min(Number(s.dari || 0), Math.max(0, info.dur - 0.5)));
  const avail = Math.max(0.1, info.dur - from);
  // klip pendek: perlambat sedikit (maks 1,25x), sisanya tahan frame terakhir
  const f = avail < dur ? Math.min(1.25, dur / avail) : 1;
  const v = `[0:v]trim=start=${from},setpts=(PTS-STARTPTS)*${f.toFixed(4)},scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${FPS},setsar=1,tpad=stop_mode=clone:stop_duration=${dur.toFixed(3)},trim=duration=${dur.toFixed(3)},format=yuv420p[v]`;
  const a = info.audio
    ? `[0:a]atrim=start=${from},asetpts=PTS-STARTPTS${f !== 1 ? `,atempo=${(1 / f).toFixed(4)}` : ''},aformat=sample_rates=48000:channel_layouts=stereo,apad,atrim=duration=${dur.toFixed(3)}[a]`
    : `[1:a]atrim=duration=${dur.toFixed(3)}[a]`;
  const out = `hasil/_rakit/seg_${String(i).padStart(3, '0')}.mp4`;
  ff(['-i', clip, ...(info.audio ? [] : ['-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo']), '-filter_complex', `${v};${a}`, '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '17', '-r', String(FPS), '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', out], `shot ${s.id || i + 1}`);
  segs.push(out);
  console.log(`shot ${i + 1}/${shots.length}: ${clip} ${dur.toFixed(2)} dtk${f !== 1 ? ` (diperlambat ${f.toFixed(2)}x)` : ''}`);
});
fs.writeFileSync(path.join(tmp, 'daftar.txt'), segs.map((s) => `file '${path.basename(s)}'`).join('\n'));
ff(['-f', 'concat', '-safe', '0', '-i', 'hasil/_rakit/daftar.txt', '-c', 'copy', 'hasil/_rakit/badan.mp4'], 'gabung shot');

// ---------- 2. subtitle dari words.json ----------
let subs = null;
if (cfg.subtitle !== false && cfg.words && fs.existsSync(path.join(proj, cfg.words))) {
  const words = JSON.parse(fs.readFileSync(path.join(proj, cfg.words), 'utf8'));
  const chunks = [];
  let cur = [];
  for (const w of words) {
    // jeda panjang (napas/pindah kalimat): tutup potongan sebelumnya dulu
    if (cur.length && (w.s - cur.at(-1).e > 0.6 || w.e - cur[0].s > 2.2)) {
      chunks.push(cur);
      cur = [];
    }
    cur.push(w);
    const text = cur.map((x) => x.text).join(' ');
    if (cur.length >= 4 || w.e - cur[0].s > 1.8 || /[.,!?;:]$/.test(w.text) || text.length > 26) {
      chunks.push(cur);
      cur = [];
    }
  }
  if (cur.length) chunks.push(cur);
  const t = (x) => {
    const h = Math.floor(x / 3600);
    const m = Math.floor((x % 3600) / 60);
    const s = (x % 60).toFixed(2).padStart(5, '0');
    return `${h}:${String(m).padStart(2, '0')}:${s}`;
  };
  const size = cfg.format === '16:9' ? 66 : 82;
  const marginV = cfg.format === '16:9' ? 90 : 560;
  const esc = (s) => String(s).replace(/[{}\\]/g, '');
  const lines = chunks.map((c, i) => {
    const s = c[0].s;
    const e = Math.max(c.at(-1).e, (chunks[i + 1]?.[0].s ?? c.at(-1).e + 0.4) - 0.02);
    // kata yang sedang diucapkan disorot kuning (karaoke \k per kata)
    const body = c.map((w, j) => `{\\k${Math.max(1, Math.round(((c[j + 1]?.s ?? w.e) - w.s) * 100))}}${esc(w.text)}`).join(' ');
    return `Dialogue: 0,${t(s)},${t(e)},Kata,,0,0,0,,${body}`;
  });
  subs = 'hasil/_rakit/subtitle.ass';
  fs.writeFileSync(
    path.join(proj, subs),
    [
      '[Script Info]',
      'ScriptType: v4.00+',
      `PlayResX: ${W}`,
      `PlayResY: ${H}`,
      'WrapStyle: 0',
      '',
      '[V4+ Styles]',
      'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
      // Primary = sudah diucapkan (kuning), Secondary = belum (putih)
      `Style: Kata,Arial,${size},&H0000E5FF,&H00FFFFFF,&H00101010,&H80000000,-1,0,0,0,100,100,0,0,1,6,2,2,80,80,${marginV},1`,
      '',
      '[Events]',
      'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
      ...lines,
      '',
    ].join('\n'),
  );
}

// ---------- 3. mix: SFX klip (diredam saat narasi) + narasi + musik opsional ----------
const music = cfg.musik ? rel(cfg.musik) : null;
const inputs = ['-i', 'hasil/_rakit/badan.mp4'];
if (voice) inputs.push('-i', voice);
if (music) inputs.push('-stream_loop', '-1', '-i', music);
const sfx = Number(cfg.sfx ?? 0.55);
const mg = Number(cfg.musikGain ?? 0.18);
let fc;
if (voice) {
  fc = `[1:a]aformat=sample_rates=48000:channel_layouts=stereo,apad,atrim=duration=${end.toFixed(3)},asplit=2[vo][key];[0:a]volume=${sfx}[s0];[s0][key]sidechaincompress=threshold=0.04:ratio=5:attack=25:release=350[s]`;
  if (music) fc += `;[2:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=duration=${end.toFixed(3)},volume=${mg},afade=t=in:d=0.8,afade=t=out:st=${Math.max(0, end - 1.6).toFixed(2)}:d=1.5[m];[s][vo][m]amix=inputs=3:normalize=0:duration=first,alimiter=limit=0.95[a]`;
  else fc += `;[s][vo]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.95[a]`;
} else fc = `[0:a]volume=${sfx},alimiter=limit=0.95[a]`;
fs.mkdirSync(path.join(proj, 'hasil'), { recursive: true });
const enc = ['-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-t', end.toFixed(3)];
const plain = `hasil/${name}_tanpa_subtitle.mp4`;
ff([...inputs, '-filter_complex', fc, '-map', '0:v', '-map', '[a]', ...enc, plain], 'mix suara');
if (subs) {
  ff(['-i', plain, '-vf', `subtitles=${subs}`, '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', `hasil/${name}.mp4`], 'subtitle');
} else fs.copyFileSync(path.join(proj, plain), path.join(proj, 'hasil', `${name}.mp4`));
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`Selesai: ${path.join(proj, 'hasil', `${name}.mp4`)} (${end.toFixed(1)} dtk, ${shots.length} shot${subs ? ', subtitle' : ''})`);
