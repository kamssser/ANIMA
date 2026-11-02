#!/usr/bin/env node
// Server MCP lokal ANIMA untuk Claude Desktop.
// Claude memanggil tool ini untuk membaca brief dan menyimpan story/shot langsung ke Supabase,
// jadi script dan shot tidak perlu ditempel bolak-balik di chat (hemat token).
//
// Dipasang otomatis dari ANIMA Studio (Pengaturan > Integrasi Claude), yang mengisi env
// ANIMA_SESSION_FILE: file berisi URL Supabase + token sesi khusus MCP (bukan password).

import fs from 'node:fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { createRequire } from 'node:module';

const { sanitizeSvg, checkBackgroundSvg, extractSvg } = createRequire(import.meta.url)('../electron/svg.cjs');

const SESSION_FILE = process.env.ANIMA_SESSION_FILE;
if (!SESSION_FILE || !fs.existsSync(SESSION_FILE)) {
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
      'Style 3D: setting/props/cahaya bebas. Style 2D WAJIB: { bg: "<id latar>", camera: "static|zoom-in|zoom-out|pan-left|pan-right|shake|push-speaker", framing: "wide|medium|close", cast: [{ char: "<key karakter>", x: 0..1, flip?: bool, expr?: "normal|senang|sedih|marah|kaget" }], speaker: "<key karakter yang bicara>" }',
    ),
  speaker: z.enum(['A', 'B', '']).default('').describe("Untuk jenis dialog/film: 'A' atau 'B' (siapa yang bicara di shot ini)"),
});

// Aturan per jenis konten (sama dengan yang dipakai aplikasi).
const CONTENT = JSON.parse(fs.readFileSync(new URL('../shared/content-types.json', import.meta.url), 'utf8'));
const typeOf = (id) => CONTENT.types.find((t) => t.id === id) ?? CONTENT.types.find((t) => t.id === 'karangan');
const VISUAL = JSON.parse(fs.readFileSync(new URL('../shared/visual-styles.json', import.meta.url), 'utf8'));
const styleOf = (id) => VISUAL.styles.find((x) => x.id === id) ?? VISUAL.styles[0];

// Aturan menata video 2D (latar SVG + pemeran per shot). Dikirim di guide untuk project ber-style 2D.
const STAGE_RULES = [
  'Pakai HANYA karakter dari daftar characters (field key). Karakter utama (is_main) wajib tampil di sebagian besar shot.',
  'Setiap shot wajib isi world: { bg, camera, framing, cast, speaker }. cast maks 3 karakter, x 0.2-0.8, karakter kanan biasanya flip:true supaya saling menghadap.',
  'framing: medium (pinggang ke atas) untuk percakapan, close untuk emosi/punchline, wide untuk pembuka tempat. Variasikan kamera.',
  'speaker = key karakter yang mengucapkan narration shot itu. Untuk narator (bukan tokoh) kosongkan speaker.',
  'Setiap id bg yang dipakai WAJIB digambar dengan anima_save_background SEBELUM anima_save_story. Pakai ulang latar yang sama untuk tempat yang sama (biasanya 2-5 latar per video).',
  'Teks narration tampil di layar sebagai subtitle; tulis kalimat lisan pendek.',
];
const BG_RULES = [
  'Satu file SVG utuh, viewBox "0 0 1080 1920" untuk format 9:16 atau "0 0 1920 1080" untuk 16:9. Tanpa <script>, <image>, <style>, teks, atau font.',
  'Latar saja (tanpa tokoh utama). Bagian bawah 40% frame akan tertutup karakter: taruh detail penting di tengah-atas.',
  'Perspektif dan kedalaman: lapisan jauh-tengah-dekat. Ukuran usahakan di bawah 60 KB (pakai pola/pengulangan, bukan ribuan titik).',
];

const server = new McpServer({ name: 'anima', version: '0.5.1' });

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
          background: BG_RULES,
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
        const { data: chars } = await db.from('characters').select('key');
        const keys = (chars || []).map((c) => c.key);
        for (const [i, sh] of shots.entries()) {
          const w = sh.world || {};
          if (!w.bg || !bgs.includes(w.bg)) return fail(`Shot ${i + 1}: world.bg "${w.bg ?? ''}" belum digambar. Latar yang ada: ${bgs.join(', ') || '(belum ada)'}. Gambar dulu dengan anima_save_background.`);
          const cast = Array.isArray(w.cast) ? w.cast : [];
          if (!cast.length) return fail(`Shot ${i + 1}: world.cast kosong. Isi minimal 1 karakter dari daftar: ${keys.join(', ')}.`);
          const bad = cast.find((m) => !keys.includes(m?.char));
          if (bad) return fail(`Shot ${i + 1}: karakter "${bad?.char}" tidak ada. Pakai key: ${keys.join(', ')}.`);
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
