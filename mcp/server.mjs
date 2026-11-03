#!/usr/bin/env node
// Server MCP lokal ANIMA untuk Claude Desktop.
// Claude memanggil tool ini untuk membaca brief dan menyimpan story/shot langsung ke Supabase,
// jadi script dan shot tidak perlu ditempel bolak-balik di chat (hemat token).
//
// Dipasang otomatis dari ANIMA Studio (Pengaturan > Integrasi Claude), yang mengisi env
// ANIMA_SESSION_FILE: file berisi URL Supabase + token sesi khusus MCP (bukan password).

import fs from 'node:fs';
import path from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { createRequire } from 'node:module';

const { sanitizeSvg, checkBackgroundSvg, checkPropSvg, extractSvg } = createRequire(import.meta.url)('../electron/svg.cjs');

const SESSION_FILE = process.env.ANIMA_SESSION_FILE;
// Sesi skill animate / bang-motion (dibuka dari HyperForge) tidak butuh login Supabase: hanya alat suara vibi.
if ((!SESSION_FILE || !fs.existsSync(SESSION_FILE)) && !process.env.ANIMA_ANIMATE_DIR && !process.env.ANIMA_BANG_DIR && !process.env.ANIMA_STUDIO_DIR) {
  console.error('ANIMA MCP: sesi tidak ditemukan. Buka ANIMA Studio > Pengaturan > Integrasi Claude > Sambungkan.');
  process.exit(1);
}

const noAuth = { persistSession: false, autoRefreshToken: false };

/**
 * Klien Supabase yang sudah login. Token dibaca dari file tiap panggilan, jadi Claude Code dan
 * Claude Desktop (atau beberapa jendela Claude) bisa memakai sesi yang sama tanpa saling menimpa.
 */
let db;
async function auth() {
  if (!SESSION_FILE || !fs.existsSync(SESSION_FILE)) throw new Error('Alat ini butuh sesi HyperForge (Pengaturan > Claude & akun > Sambungkan).');
  let s = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
  if (!s.expires_at || s.expires_at * 1000 < Date.now() + 60_000) {
    // Sesi pinjaman dari tombol Generate di aplikasi tidak punya refresh token.
    if (!s.refresh_token) throw new Error('Sesi generate sudah habis. Ulangi Generate dari aplikasi HyperForge.');
    const c = createClient(s.url, s.anonKey, { auth: noAuth });
    const { data, error } = await c.auth.refreshSession({ refresh_token: s.refresh_token });
    if (error || !data.session) {
      throw new Error('Sesi MCP kedaluwarsa. Buka ANIMA Studio > Pengaturan > Integrasi Claude > Sambungkan ulang.');
    }
    s = {
      ...s,
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
    };
    fs.writeFileSync(SESSION_FILE, JSON.stringify(s));
  }
  db = createClient(s.url, s.anonKey, {
    auth: noAuth,
    global: { headers: { Authorization: `Bearer ${s.access_token}` } },
  });
}

// Balasan dibuat sependek mungkin supaya hemat token.
const ok = (obj) => ({ content: [{ type: 'text', text: typeof obj === 'string' ? obj : JSON.stringify(obj) }] });
const fail = (msg) => ({ content: [{ type: 'text', text: msg }], isError: true });

const shotSchema = z.object({
  durationSeconds: z.number().min(0.5).max(60).describe('Durasi shot dalam detik (30 fps)'),
  camera: z.string().describe('Gerak/sudut kamera, mis. "dolly in", "close-up"'),
  characters: z.array(z.string()).default([]),
  narration: z.string().default('').describe('Kalimat narasi pada shot ini'),
  world: z
    .record(z.string(), z.unknown())
    .default({})
    .describe(
      'Style 3D: setting/props/cahaya bebas. Style 2D WAJIB: { bg: "<id latar>", camera: "static|zoom-in|zoom-out|pan-left|pan-right|shake|push-speaker", framing: "wide|medium|close", transition: "cut|fade|slide|zoom|flash|whip", cast: [{ char: "<key karakter>", x: 0..1, flip?: bool, expr?: "normal|senang|sedih|marah|kaget", pose?: "idle|point|wave|explain|shrug|cheer|think", enter?: "none|left|right|bottom|pop", toX?: 0..1 }], speaker: "<key karakter yang bicara>", props: [{ prop: "<id benda>", x: 0..1, y: 0..1, size: 0.05..1.2, anim?: "none|float|bob|pop|drop|slide-left|slide-right|across-left|across-right|spin|pulse|shake", delay?: detik, layer?: "back|front" }] }. cast boleh [] untuk shot sisipan (close-up benda/peta) asal ada props.',
    ),
  speaker: z.enum(['A', 'B', '']).default('').describe("Untuk jenis dialog/film: 'A' atau 'B' (siapa yang bicara di shot ini)"),
});

// Aturan per jenis konten (sama dengan yang dipakai aplikasi).
const CONTENT = JSON.parse(fs.readFileSync(new URL('../shared/content-types.json', import.meta.url), 'utf8'));
const typeOf = (id) => CONTENT.types.find((t) => t.id === id) ?? CONTENT.types.find((t) => t.id === 'karangan');
const VISUAL = JSON.parse(fs.readFileSync(new URL('../shared/visual-styles.json', import.meta.url), 'utf8'));
const styleOf = (id) => VISUAL.styles.find((x) => x.id === (VISUAL.aliases?.[id] ?? id)) ?? VISUAL.styles[0];

// Aturan menata video 2D (latar SVG + pemeran per shot). Dikirim di guide untuk project ber-style 2D.
const STAGE_RULES = [
  'Pikirkan seperti storyboard: untuk SETIAP shot, tanya "apa yang sedang diceritakan kalimat ini?" lalu TUNJUKKAN di layar (latar yang tepat + benda cerita), jangan hanya karakter berdiri di depan latar.',
  'Pakai HANYA karakter dari daftar characters (field key). Karakter utama (is_main) tampil di sebagian besar shot sebagai pembawa cerita.',
  'Setiap shot wajib isi world: { bg, camera, framing, transition, cast, speaker, props }. cast maks 3 karakter, x 0.2-0.8, karakter kanan biasanya flip:true supaya saling menghadap.',
  'BENDA CERITA (props): setiap benda, kendaraan, hewan, dokumen, angka tahun penting, atau papan nama yang disebut narasi WAJIB digambar dengan anima_save_prop lalu ditaruh di shot itu. Contoh: "kereta uap mulai singgah" -> prop lokomotif anim across-left; "peta tahun 1901" -> shot sisipan peta; "memotong ayam" -> prop ayam + golok. Minimal sepertiga shot punya props.',
  'SHOT SISIPAN: untuk peta, dokumen, foto lama, tanggal, atau benda yang perlu dilihat jelas, buat shot dengan cast [] dan props besar (size 0.6-0.95, x 0.5, y 0.45, anim pop/drop). Selipkan 2-4 per video supaya tidak monoton.',
  'GERAK KARAKTER: pilih pose sesuai kalimat (point saat menunjuk benda/fakta, explain saat menjelaskan, shrug saat bingung/ironi, cheer saat senang/punchline, wave saat menyapa, think saat bertanya). Jangan pakai pose yang sama 3 shot berturut-turut. Pakai enter left/right/pop saat karakter baru muncul, toX untuk berjalan ke tempat/benda.',
  'framing: medium untuk menjelaskan, close untuk emosi/punchline, wide untuk tempat dan saat ada benda besar. Variasikan kamera dan transition (cut paling sering; whip/slide untuk pindah tempat atau waktu, flash untuk kejutan, zoom untuk masuk ke detail, fade untuk lompatan tahun).',
  'Taruh benda di area yang tidak tertutup karakter: y 0.25-0.5 untuk benda di belakang, atau di samping karakter (x 0.15-0.3 / 0.7-0.85). Subtitle ada di sekitar y 0.75-0.85, jangan taruh benda penting di sana.',
  'speaker = key karakter yang mengucapkan narration shot itu. Untuk narator (bukan tokoh) kosongkan speaker.',
  'Setiap id bg dan prop yang dipakai WAJIB digambar (anima_save_background / anima_save_prop) SEBELUM anima_save_story. Buat latar berbeda untuk setiap tempat DAN zaman yang disebut (stasiun 1873 beda dengan stasiun sekarang), biasanya 4-8 latar per video.',
  'Teks narration tampil di layar sebagai subtitle; tulis kalimat lisan pendek.',
];
const PROP_RULES = [
  'Satu benda per SVG dengan viewBox sesuai bentuknya (mis. "0 0 900 420" untuk kereta, "0 0 400 400" untuk ayam). Latar TRANSPARAN (jangan isi kotak latar), tanpa tokoh.',
  'Gambar dengan gaya yang sama dengan karakter dan latar (garis, warna, bayangan sesuai guide.style.draw). Bentuk mengikuti zaman cerita (lokomotif uap 1873, bukan KRL modern).',
  'Boleh <text> pendek untuk angka tahun, nama tempat, atau label peta (font-family Arial, sans-serif, tebal). Tanpa <script>, <image>, <style>.',
  'Ukuran usahakan di bawah 30 KB.',
];
const BG_RULES = [
  'Satu file SVG utuh, viewBox "0 0 1080 1920" untuk format 9:16 atau "0 0 1920 1080" untuk 16:9. Tanpa <script>, <image>, <style>, teks, atau font.',
  'Latar saja (tanpa tokoh utama). Bagian bawah 40% frame akan tertutup karakter: taruh detail penting di tengah-atas.',
  'Perspektif dan kedalaman: lapisan jauh-tengah-dekat. Ukuran usahakan di bawah 60 KB (pakai pola/pengulangan, bukan ribuan titik).',
];

const server = new McpServer({ name: 'anima', version: '0.8.0' });

server.tool('anima_list_projects', 'Daftar project ANIMA (id, judul, status). Maks 20 terbaru.', {}, async () => {
  try {
    await auth();
    const { data, error } = await db.from('projects').select('id,title,status,target_seconds').order('updated_at', { ascending: false }).limit(20);
    if (error) return fail(error.message);
    return ok(data);
  } catch (e) {
    return fail(e.message);
  }
});

server.tool(
  'anima_get_project',
  'Ambil brief satu project beserta ATURAN WAJIB jenis kontennya (guide). Baca guide sebelum menulis. includeShots=true untuk ikut shot list.',
  { id: z.string().uuid(), includeShots: z.boolean().default(false) },
  async ({ id, includeShots }) => {
    try {
      await auth();
      let { data: p, error } = await db.from('projects').select('id,title,topic,target_seconds,script,status,content_type,hook,visual_style,format').eq('id', id).single();
      // Database sebelum migrasi 003: kolom style belum ada -> anggap 3D.
      if (error && /visual_style|format/.test(error.message)) ({ data: p, error } = await db.from('projects').select('id,title,topic,target_seconds,script,status,content_type,hook').eq('id', id).single());
      if (error) return fail(error.message);
      const t = typeOf(p.content_type);
      const st = styleOf(p.visual_style);
      const guide = {
        type: t.label,
        hook: CONTENT.hookRules,
        rules: t.rules,
        sourcesRequired: t.needsSources,
        twoSpeakers: t.twoVoices,
        targetWords: Math.round(p.target_seconds * 3.7),
        onScreenText: 'Teks narasi WAJIB tampil di layar (subtitle otomatis per kata), jadi setiap shot yang berbicara harus punya narration.',
      };
      if (st.kind === '2d') {
        const { data: chars, error: ce } = await db.from('characters').select('key,name,nickname,is_main,personality,svg').order('is_main', { ascending: false });
        if (ce) return fail(`Gagal membaca karakter: ${ce.message}`);
        // Berhenti di awal (sebelum menggambar latar) kalau belum ada karakter tersimpan.
        if (!chars?.some((c) => c.is_main && c.svg)) {
          return fail('BERHENTI: akun ini belum punya karakter utama yang tersimpan. Jangan menulis atau menggambar apa pun. Beri tahu pengguna: buka Pengaturan > Karakter, generate karakter utama, lalu klik "Simpan karakter", kemudian Generate lagi.');
        }
        for (const c of chars) delete c.svg;
        Object.assign(guide, {
          style: { id: st.id, label: st.label, kind: '2d', draw: st.draw },
          format: p.format || '9:16',
          characters: chars || [],
          stage: STAGE_RULES,
          props: PROP_RULES,
          background: [...BG_RULES, 'Panggil anima_style_references dulu dan tiru gaya potongan referensinya (~90%) saat menggambar latar.'],
          referencePhotos: t.needsSources
            ? 'Untuk tempat/bangunan/benda nyata: cari foto dengan anima_find_photos, lihat dengan anima_view_photo, lalu gambar latar yang bentuk dan posisinya MIRIP foto itu. Simpan foto yang dipakai lewat field reference di anima_save_background.'
            : undefined,
        });
      } else {
        guide.style = { id: st.id, label: st.label, kind: '3d' };
      }
      if (!includeShots) return ok({ ...p, guide });
      const { data: shots } = await db.from('shots').select('idx,duration_frames,camera,characters,narration_text,world,speaker').eq('project_id', id).order('idx');
      return ok({ ...p, guide, shots });
    } catch (e) {
      return fail(e.message);
    }
  },
);

server.tool(
  'anima_save_story',
  'Simpan hook + script + SELURUH shot list sebuah project (shot lama diganti). Untuk sejarah/fakta wajib isi sources; untuk dialog/film wajib isi speaker A/B tiap shot.',
  {
    id: z.string().uuid(),
    hook: z.string().min(1).describe('Kalimat hook 0-3 detik pertama'),
    script: z.string(),
    sources: z
      .array(z.object({ title: z.string(), url: z.string() }))
      .default([])
      .describe('Sumber yang dibaca (wajib untuk sejarah & fakta)'),
    shots: z.array(shotSchema).min(1).max(60),
  },
  async ({ id, hook, script, sources, shots }) => {
    try {
      await auth();
      let { data: p, error: pe } = await db.from('projects').select('content_type,visual_style,assets').eq('id', id).single();
      if (pe && /visual_style|assets/.test(pe.message)) ({ data: p, error: pe } = await db.from('projects').select('content_type').eq('id', id).single());
      if (pe) return fail(pe.message);
      const t = typeOf(p.content_type);
      if (styleOf(p.visual_style).kind === '2d') {
        const bgs = Object.keys(p.assets?.backgrounds ?? {});
        const propIds = Object.keys(p.assets?.props ?? {});
        const { data: chars } = await db.from('characters').select('key');
        const keys = (chars || []).map((c) => c.key);
        let withProps = 0;
        for (const [i, sh] of shots.entries()) {
          const w = sh.world || {};
          if (!w.bg || !bgs.includes(w.bg)) return fail(`Shot ${i + 1}: world.bg "${w.bg ?? ''}" belum digambar. Latar yang ada: ${bgs.join(', ') || '(belum ada)'}. Gambar dulu dengan anima_save_background.`);
          const cast = Array.isArray(w.cast) ? w.cast : [];
          const props = Array.isArray(w.props) ? w.props : [];
          const badProp = props.find((x) => !propIds.includes(x?.prop));
          if (badProp) return fail(`Shot ${i + 1}: benda "${badProp?.prop}" belum digambar. Benda yang ada: ${propIds.join(', ') || '(belum ada)'}. Gambar dulu dengan anima_save_prop.`);
          if (props.length) withProps++;
          if (!cast.length && !props.length) return fail(`Shot ${i + 1}: cast dan props kosong. Isi karakter dari daftar (${keys.join(', ')}) atau jadikan shot sisipan dengan props.`);
          const bad = cast.find((m) => !keys.includes(m?.char));
          if (bad) return fail(`Shot ${i + 1}: karakter "${bad?.char}" tidak ada. Pakai key: ${keys.join(', ')}.`);
        }
        if (shots.length >= 4 && withProps < Math.ceil(shots.length / 3)) {
          return fail(`Baru ${withProps} dari ${shots.length} shot yang punya benda cerita (props). Minimal ${Math.ceil(shots.length / 3)}: gambar benda/kendaraan/dokumen/angka yang disebut narasi dengan anima_save_prop, taruh di shot yang menyebutnya (atau buat shot sisipan), lalu simpan ulang.`);
        }
        // Hindari monoton: latar + karakter + pose sama tiga shot berturut-turut tanpa benda.
        const sig = (k) => {
          const w = shots[k].world || {};
          return `${w.bg}|${(w.cast || []).map((m) => `${m.char}:${m.pose || 'idle'}`).join(',')}|${(w.props || []).length}`;
        };
        for (let i = 2; i < shots.length; i++) {
          if (sig(i) === sig(i - 1) && sig(i) === sig(i - 2) && !(shots[i].world?.props || []).length) {
            return fail(`Shot ${i - 1}-${i + 1} sama persis (latar, karakter, pose, tanpa benda). Variasikan: ganti pose/framing, tambahkan benda yang disebut narasi, atau pindah latar.`);
          }
        }
      }
      if (t.needsSources && sources.filter((s) => /^https?:\/\//.test(s.url)).length < 2) {
        return fail(`Jenis "${t.label}" wajib minimal 2 sumber (judul + URL) yang benar-benar dibaca. Riset dulu lalu simpan ulang.`);
      }
      if (t.twoVoices) {
        const bad = shots.findIndex((s) => s.speaker !== 'A' && s.speaker !== 'B');
        if (bad >= 0) return fail(`Jenis "${t.label}" wajib isi speaker 'A' atau 'B' di setiap shot (shot ${bad + 1} kosong).`);
        if (!shots.some((s) => s.speaker === 'B')) return fail(`Jenis "${t.label}" butuh dua pembicara: belum ada shot dengan speaker 'B'.`);
      }
      const up = await db.from('projects').update({ script, hook, sources, status: 'ready' }).eq('id', id);
      if (up.error) return fail(up.error.message);
      const del = await db.from('shots').delete().eq('project_id', id);
      if (del.error) return fail(del.error.message);
      const rows = shots.map((s, i) => ({
        project_id: id,
        idx: i + 1,
        duration_frames: Math.round(s.durationSeconds * 30),
        camera: s.camera,
        characters: s.characters,
        narration_text: s.narration,
        world: s.world,
        speaker: s.speaker,
      }));
      const ins = await db.from('shots').insert(rows);
      if (ins.error) return fail(ins.error.message);
      const total = rows.reduce((n, r) => n + r.duration_frames, 0) / 30;
      return ok(`tersimpan: ${rows.length} shot, ${total.toFixed(1)} dtk`);
    } catch (e) {
      return fail(e.message);
    }
  },
);

server.tool(
  'anima_patch_shot',
  'Revisi SATU shot (berdasarkan nomor urut idx). Kirim hanya field yang berubah.',
  {
    id: z.string().uuid().describe('ID project'),
    idx: z.number().int().min(1),
    patch: shotSchema.partial(),
  },
  async ({ id, idx, patch }) => {
    try {
      await auth();
      const row = {};
      if (patch.durationSeconds !== undefined) row.duration_frames = Math.round(patch.durationSeconds * 30);
      if (patch.camera !== undefined) row.camera = patch.camera;
      if (patch.characters !== undefined) row.characters = patch.characters;
      if (patch.narration !== undefined) row.narration_text = patch.narration;
      if (patch.world !== undefined) row.world = patch.world;
      if (patch.speaker !== undefined) row.speaker = patch.speaker;
      const { data, error } = await db.from('shots').update(row).eq('project_id', id).eq('idx', idx).select('idx');
      if (error) return fail(error.message);
      if (!data?.length) return fail(`shot ${idx} tidak ada`);
      return ok(`shot ${idx} diperbarui`);
    } catch (e) {
      return fail(e.message);
    }
  },
);

server.tool(
  'anima_style_references',
  'Style 2D: lihat potongan frame referensi gaya (lembar storyboard dari video referensi style ini). Panggil SEBELUM menggambar latar, lalu tiru gayanya ~90% tanpa menyalin tokoh/adegan.',
  { style: z.string().describe('id style project (guide.style.id)') },
  async ({ style }) => {
    try {
      const base = process.env.ANIMA_REF_DIR;
      const st = styleOf(style);
      const dir = base ? path.join(base, st.id) : null;
      const files = dir && fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.jpg')).sort() : [];
      if (!files.length) return ok('Belum ada potongan referensi (offline). Gambar mengikuti guide.style.draw saja.');
      // ambil merata maks 4 lembar supaya hemat token
      const pick = files.filter((_f, i) => i % Math.ceil(files.length / 4) === 0).slice(0, 4);
      return {
        content: [
          { type: 'text', text: `${pick.length} lembar referensi gaya ${st.label}. ${(VISUAL.referenceRules || []).join(' ')}` },
          ...pick.map((f) => ({ type: 'image', data: fs.readFileSync(path.join(dir, f)).toString('base64'), mimeType: 'image/jpeg' })),
        ],
      };
    } catch (e) {
      return fail(e.message);
    }
  },
);

server.tool(
  'anima_save_background',
  'Style 2D: simpan SATU latar (SVG) untuk project. id pendek (mis. "warung", "jembatan-malam"). Simpan ulang dengan id sama untuk mengganti. Untuk tempat nyata isi reference dengan foto yang dipakai.',
  {
    id: z.string().uuid().describe('ID project'),
    bgId: z.string().regex(/^[a-z0-9-]{1,32}$/).describe('id latar, huruf kecil/angka/strip'),
    description: z.string().describe('Deskripsi singkat latar'),
    svg: z.string().describe('SVG lengkap, viewBox 0 0 1080 1920 (9:16) atau 0 0 1920 1080 (16:9)'),
    reference: z.object({ title: z.string(), url: z.string(), image: z.string(), license: z.string().optional() }).optional(),
  },
  async ({ id, bgId, description, svg, reference }) => {
    try {
      await auth();
      const clean = sanitizeSvg(extractSvg(svg) || svg);
      const problems = checkBackgroundSvg(clean);
      if (problems.length) return fail(`Latar belum valid: ${problems.join(' ')}`);
      const { data: p, error } = await db.from('projects').select('assets').eq('id', id).single();
      if (error) return fail(error.message);
      const assets = p.assets || {};
      assets.backgrounds = { ...(assets.backgrounds || {}), [bgId]: { description, svg: clean } };
      if (reference) assets.references = [...(assets.references || []).filter((r) => r.image !== reference.image), reference];
      const up = await db.from('projects').update({ assets }).eq('id', id);
      if (up.error) return fail(up.error.message);
      return ok(`latar "${bgId}" tersimpan (${Math.round(clean.length / 1024)} KB). Latar project: ${Object.keys(assets.backgrounds).join(', ')}`);
    } catch (e) {
      return fail(e.message);
    }
  },
);

server.tool(
  'anima_save_prop',
  'Style 2D: simpan SATU benda cerita (SVG transparan) untuk project, mis. "lokomotif-uap", "peta-1901", "ayam". Simpan ulang dengan id sama untuk mengganti. Lalu taruh di world.props shot yang menyebutnya.',
  {
    id: z.string().uuid().describe('ID project'),
    propId: z.string().regex(/^[a-z0-9-]{1,32}$/).describe('id benda, huruf kecil/angka/strip'),
    description: z.string().describe('Deskripsi singkat benda'),
    svg: z.string().describe('SVG lengkap dengan viewBox sesuai bentuk benda, latar transparan'),
  },
  async ({ id, propId, description, svg }) => {
    try {
      await auth();
      const clean = sanitizeSvg(extractSvg(svg) || svg);
      const problems = checkPropSvg(clean);
      if (problems.length) return fail(`Benda belum valid: ${problems.join(' ')}`);
      const { data: p, error } = await db.from('projects').select('assets').eq('id', id).single();
      if (error) return fail(error.message);
      const assets = p.assets || {};
      assets.props = { ...(assets.props || {}), [propId]: { description, svg: clean } };
      const up = await db.from('projects').update({ assets }).eq('id', id);
      if (up.error) return fail(up.error.message);
      return ok(`benda "${propId}" tersimpan (${Math.round(clean.length / 1024)} KB). Benda project: ${Object.keys(assets.props).join(', ')}`);
    } catch (e) {
      return fail(e.message);
    }
  },
);

// ---------- Skill animate: take suara per kalimat lewat vibi.pro (pengganti konektor ElevenLabs di skill) ----------

const VIBI = 'https://api.vibi.pro';
function hyperforgeSettings() {
  const f = process.env.ANIMA_SETTINGS_FILE;
  if (!f || !fs.existsSync(f)) throw new Error('Pengaturan HyperForge tidak ditemukan (buka sesi ini dari tombol "Buka di Claude Code" di HyperForge).');
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}
async function vibiCall(s, p, init = {}) {
  if (!s.vibiApiKey) throw new Error('API key vibi.pro belum diisi di HyperForge > Pengaturan > Suara & audio.');
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
/** Suara A (bawaan) atau B (pembicara kedua) dari pengaturan HyperForge. */
const voiceOf = (s, who) =>
  who === 'B'
    ? { provider: s.vibi2Provider, model: s.vibi2Model, voiceId: s.vibi2VoiceId, name: s.vibi2VoiceName, language: s.vibi2Language, speed: s.vibi2Speed }
    : { provider: s.vibiProvider, model: s.vibiModel, voiceId: s.vibiVoiceId, name: s.vibiVoiceName, language: s.vibiLanguage, speed: s.vibiSpeed };

async function vibiLine(s, v, text, outFile) {
  const provider = v.provider || 'elevenlabs';
  const task = await vibiCall(s, `/v1/text-to-speech/${encodeURIComponent(v.voiceId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      provider,
      ...(provider !== 'capcut' && v.model ? { model_id: v.model } : {}),
      language_code: v.language,
      voice_settings: provider === 'elevenlabs' ? { stability: 0.5, similarity_boost: 0.75, speed: Number(v.speed) || 1 } : { speed: Number(v.speed) || 1, pitch: 0 },
    }),
  });
  for (let i = 0; i < 180; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const t = await vibiCall(s, `/v1/history/${task.id}`);
    if (t.status === 'failed') throw new Error(t.error || t.detail_error || 'tugas vibi.pro gagal');
    if (t.status !== 'completed') continue;
    const url = t.result?.audio_url;
    if (!url) throw new Error('vibi.pro tidak mengembalikan audio_url');
    const res = await fetch(url, url.startsWith(VIBI) ? { headers: { 'xi-api-key': s.vibiApiKey } } : {});
    if (!res.ok) throw new Error(`gagal mengunduh audio (${res.status})`);
    fs.writeFileSync(outFile, Buffer.from(await res.arrayBuffer()));
    return t.credits_deducted ?? 0;
  }
  throw new Error('vibi.pro terlalu lama merespons');
}

server.tool(
  'anima_vibi_voice',
  'Skill animate, voice-over: buat take suara per kalimat dengan suara yang dipilih pengguna di HyperForge (Suara A, vibi.pro). Ini "rekaman milik pengguna, satu file per kalimat" untuk tools/voice.mjs. Membaca <piece>/voice/script.json, menyimpan voice/<id>.mp3, mengisi "file" di setiap kalimat. Panggil dulu dengan estimate=true untuk melihat suara dan jumlah karakter (kredit), sebutkan ke pengguna, lalu jalankan.',
  {
    piece: z.string().describe('folder piece relatif ke folder kerja, mis. "pieces/kereta-api"'),
    only: z.array(z.string()).optional().describe('id kalimat yang dibuat (ulang). Kosong = semua kalimat yang belum punya file.'),
    estimate: z.boolean().default(false).describe('true = hanya tampilkan suara + jumlah karakter, tanpa membuat suara'),
  },
  async ({ piece, only, estimate }) => {
    try {
      const base = process.env.ANIMA_ANIMATE_DIR;
      if (!base) return fail('Alat ini hanya untuk sesi animate yang dibuka dari HyperForge.');
      const root = path.resolve(base, piece);
      if (!root.startsWith(path.resolve(base) + path.sep)) return fail('Folder piece harus di dalam folder kerja animate.');
      const scriptFile = path.join(root, 'voice', 'script.json');
      if (!fs.existsSync(scriptFile)) return fail(`Belum ada ${path.relative(base, scriptFile)}. Tulis script.json dulu (SKILL.md > Voice-over langkah 1).`);
      const script = JSON.parse(fs.readFileSync(scriptFile, 'utf8'));
      const s = hyperforgeSettings();
      if (!s.vibiVoiceId) return fail('Suara A belum dipilih di HyperForge > Pengaturan > Suara & audio.');
      const lines = (script.lines || []).filter((l) => l?.id && String(l.text || '').trim());
      if (lines.some((l) => l.speaker === 'B') && !s.vibi2VoiceId) return fail('Ada kalimat speaker "B" tapi Suara B belum dipilih di HyperForge > Pengaturan > Suara & audio.');
      const label = (v) => `${v.name || v.voiceId} (${v.provider || 'elevenlabs'}${v.model ? `, ${v.model}` : ''})`;
      const voice = lines.some((l) => l.speaker === 'B') ? { A: label(voiceOf(s, 'A')), B: label(voiceOf(s, 'B')) } : label(voiceOf(s, 'A'));
      const todo = lines.filter((l) => (only?.length ? only.includes(l.id) : !(l.file && fs.existsSync(path.join(root, 'voice', l.file)))));
      const chars = todo.reduce((n, l) => n + String(l.text).length, 0);
      if (estimate) return ok({ voice, lines: todo.length, characters: chars, note: 'Kredit vibi.pro kira-kira sebanding jumlah karakter.' });
      if (!todo.length) return ok('Semua kalimat sudah punya file. Jalankan node tools/voice.mjs <piece> lalu build ulang.');
      let credits = 0;
      const done = [];
      for (const l of todo) {
        const id = String(l.id).replace(/[^\w-]/g, '_');
        credits += await vibiLine(s, voiceOf(s, l.speaker), String(l.text), path.join(root, 'voice', `${id}.mp3`));
        l.file = `${id}.mp3`;
        done.push(l.id);
        fs.writeFileSync(scriptFile, JSON.stringify(script, null, 2));
      }
      return ok({ voice, made: done, credits, next: 'Jalankan: node <skill>/tools/voice.mjs ' + piece + ' --model small (multibahasa, untuk bahasa Indonesia), lalu build ulang.' });
    } catch (e) {
      return fail(e.message);
    }
  },
);

/** Folder kerja sesi skill yang boleh ditulisi alat suara. */
const voBase = () => process.env.ANIMA_STUDIO_DIR || process.env.ANIMA_BANG_DIR || null;

server.tool(
  'anima_vibi_words',
  'Timing per kata dari file suara (speech-to-text vibi.pro, Bahasa Indonesia). Hasil JSON [{ s, e, text }] (detik) untuk subtitle dan mengunci shot ke kalimat; juga untuk menghitung kata per menit video referensi. Memakai sedikit kredit vibi.pro.',
  {
    audio: z.string().describe('file audio (mp3/wav/m4a) relatif ke folder kerja, mis. "kereta/audio/vo.mp3"'),
    out: z.string().describe('file JSON hasil relatif ke folder kerja, mis. "kereta/audio/words.json"'),
    language: z.string().default('id'),
  },
  async ({ audio, out, language }) => {
    try {
      const base = voBase();
      if (!base) return fail('Alat ini hanya untuk sesi skill yang dibuka dari HyperForge.');
      const root = path.resolve(base) + path.sep;
      const a = path.resolve(base, audio);
      const o = path.resolve(base, out);
      if (!a.startsWith(root) || !o.startsWith(root) || !/\.json$/i.test(o)) return fail('File harus di dalam folder kerja, hasil berakhiran .json.');
      if (!fs.existsSync(a)) return fail(`Tidak ada: ${audio}`);
      const s = hyperforgeSettings();
      const form = new FormData();
      form.append('file', new Blob([fs.readFileSync(a)]), path.basename(a));
      form.append('language_code', language);
      form.append('timestamps_granularity', 'word');
      form.append('tag_audio_events', 'false');
      const stt = await vibiCall(s, '/v1/speech-to-text', { method: 'POST', body: form });
      const tid = stt.task_id || stt.id;
      let tr = null;
      for (let i = 0; i < 180; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const t = await vibiCall(s, `/v1/speech-to-text/${tid}`);
        if (t.status === 'failed') return fail(t.error || 'speech-to-text gagal');
        if (t.status === 'completed') {
          tr = t;
          break;
        }
      }
      if (!tr) return fail('speech-to-text terlalu lama');
      const words = (tr.result?.words || []).filter((w) => w.type === 'word').map((w) => ({ s: w.start, e: w.end, text: w.text }));
      fs.mkdirSync(path.dirname(o), { recursive: true });
      fs.writeFileSync(o, JSON.stringify(words, null, 1));
      const dur = words.length ? words[words.length - 1].e - words[0].s : 0;
      return ok({ file: path.relative(base, o).replace(/\\/g, '/'), words: words.length, detik: +dur.toFixed(2), kataPerMenit: dur ? Math.round((words.length / dur) * 60) : null, teks: words.map((w) => w.text).join(' ').slice(0, 1500) });
    } catch (e) {
      return fail(e.message);
    }
  },
);

server.tool(
  'anima_vibi_tts',
  'Skill bang-motion / HyperForge Studio: buat file VO dari naskah dengan suara yang dipilih pengguna di HyperForge (vibi.pro), sebagai "VO dari layanan TTS pilihan pengguna". Panggil dulu dengan estimate=true untuk menyebutkan suara dan jumlah karakter (kredit) ke pengguna, lalu jalankan setelah disetujui. Satu panggilan = satu file mp3.',
  {
    file: z.string().describe('path file mp3 relatif ke folder kerja, mis. "sejarah-kereta/vo.mp3"'),
    text: z.string().min(1).max(5000).describe('naskah VO, angka ditulis dengan kata'),
    speaker: z.enum(['A', 'B']).default('A').describe('Suara A (bawaan) atau B (pembicara kedua)'),
    estimate: z.boolean().default(false),
  },
  async ({ file, text, speaker, estimate }) => {
    try {
      const base = voBase();
      if (!base) return fail('Alat ini hanya untuk sesi bang-motion / HyperForge Studio yang dibuka dari HyperForge.');
      const out = path.resolve(base, file);
      if (!out.startsWith(path.resolve(base) + path.sep) || !/\.mp3$/i.test(out)) return fail('File harus .mp3 di dalam folder kerja.');
      const s = hyperforgeSettings();
      const v = voiceOf(s, speaker);
      if (!v.voiceId) return fail(`Suara ${speaker} belum dipilih di HyperForge > Pengaturan > Suara & audio.`);
      const voice = `${v.name || v.voiceId} (${v.provider || 'elevenlabs'}${v.model ? `, ${v.model}` : ''})`;
      if (estimate) return ok({ voice, characters: text.length, note: 'Kredit vibi.pro kira-kira sebanding jumlah karakter.' });
      fs.mkdirSync(path.dirname(out), { recursive: true });
      const credits = await vibiLine(s, v, text, out);
      return ok({ voice, file: path.relative(base, out).replace(/\\/g, '/'), credits, next: 'HyperForge Studio: ambil timing kata dengan anima_vibi_words. bang-motion: retime ke VO ini (silencedetect / tools/vo-pauses.html).' });
    } catch (e) {
      return fail(e.message);
    }
  },
);

const UA = { 'User-Agent': 'HyperForge/0.5 (video edukasi; https://github.com/kamssser/ANIMA)' };

server.tool(
  'anima_find_photos',
  'Cari foto referensi bebas pakai (Wikimedia Commons) untuk tempat/bangunan/benda nyata, mis. "Jembatan Merah Surabaya". Hasil: judul, halaman, url gambar kecil, lisensi.',
  { query: z.string().min(2), limit: z.number().int().min(1).max(10).default(6) },
  async ({ query, limit }) => {
    try {
      const q = new URLSearchParams({
        action: 'query', format: 'json', generator: 'search', gsrsearch: `filetype:bitmap ${query}`, gsrnamespace: '6', gsrlimit: String(limit),
        prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '800', origin: '*',
      });
      const r = await fetch(`https://commons.wikimedia.org/w/api.php?${q}`, { headers: UA });
      const j = await r.json();
      const pages = Object.values(j.query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
      const out = pages.map((pg) => {
        const ii = pg.imageinfo?.[0] ?? {};
        const md = ii.extmetadata ?? {};
        return {
          title: String(pg.title).replace(/^File:/, ''),
          url: ii.descriptionurl,
          image: ii.thumburl || ii.url,
          license: md.LicenseShortName?.value,
          artist: String(md.Artist?.value ?? '').replace(/<[^>]+>/g, '').slice(0, 80),
        };
      });
      return ok(out.length ? out : 'tidak ada foto. Coba kata kunci lain (nama resmi, kota, bahasa Inggris).');
    } catch (e) {
      return fail(e.message);
    }
  },
);

server.tool(
  'anima_view_photo',
  'Lihat satu foto referensi (url gambar dari anima_find_photos) supaya bisa menggambar latar yang bentuk dan posisinya mirip.',
  { image: z.string().url() },
  async ({ image }) => {
    try {
      if (!/^https:\/\/(upload|thumb)\.wikimedia\.org\//.test(image)) return fail('Hanya foto dari Wikimedia (hasil anima_find_photos).');
      const r = await fetch(image, { headers: UA });
      if (!r.ok) return fail(`Gagal mengunduh foto (${r.status})`);
      const type = (r.headers.get('content-type') || 'image/jpeg').split(';')[0];
      if (!/^image\/(jpeg|png|webp|gif)$/.test(type)) return fail(`Bukan foto (${type})`);
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > 4_000_000) return fail('Foto terlalu besar, pakai versi kecil (thumburl).');
      return { content: [{ type: 'image', data: buf.toString('base64'), mimeType: type }] };
    } catch (e) {
      return fail(e.message);
    }
  },
);

server.tool('anima_job_status', 'Status render terakhir sebuah project.', { id: z.string().uuid() }, async ({ id }) => {
  try {
    await auth();
    const { data, error } = await db
      .from('render_jobs')
      .select('status,progress,error,created_at')
      .eq('project_id', id)
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) return fail(error.message);
    return ok(data?.[0] ?? 'belum pernah dirender');
  } catch (e) {
    return fail(e.message);
  }
});

await server.connect(new StdioServerTransport());
