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
  world: z.record(z.string(), z.unknown()).default({}).describe('Setting/props/cahaya dalam bentuk objek bebas'),
  speaker: z.enum(['A', 'B', '']).default('').describe("Untuk jenis dialog/film: 'A' atau 'B' (siapa yang bicara di shot ini)"),
});

// Aturan per jenis konten (sama dengan yang dipakai aplikasi).
const CONTENT = JSON.parse(fs.readFileSync(new URL('../shared/content-types.json', import.meta.url), 'utf8'));
const typeOf = (id) => CONTENT.types.find((t) => t.id === id) ?? CONTENT.types.find((t) => t.id === 'karangan');

const server = new McpServer({ name: 'anima', version: '0.4.0' });

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
      const { data: p, error } = await db.from('projects').select('id,title,topic,target_seconds,script,status,content_type,hook').eq('id', id).single();
      if (error) return fail(error.message);
      const t = typeOf(p.content_type);
      const guide = {
        type: t.label,
        hook: CONTENT.hookRules,
        rules: t.rules,
        sourcesRequired: t.needsSources,
        twoSpeakers: t.twoVoices,
        targetWords: Math.round(p.target_seconds * 3.7),
      };
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
      const { data: p, error: pe } = await db.from('projects').select('content_type').eq('id', id).single();
      if (pe) return fail(pe.message);
      const t = typeOf(p.content_type);
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
