import { sb } from './supabase';
import type { Character, JobStatus, Project, RenderJob, RenderProps, Shot } from './types';
import { FPS } from './utils';

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) {
    // Kolom 0.4 (jenis konten, hook, sumber, pembicara) belum ada: migrasi 002 belum dijalankan.
    if (/content_type|hook|sources|speaker/.test(res.error.message) && /column|schema cache/i.test(res.error.message)) {
      throw new Error('Database belum diperbarui. Pemilik Supabase perlu menjalankan supabase/migrations/002_content_types.sql di SQL Editor.');
    }
    // 0.5: style visual, format, aset, tabel karakter.
    if (/visual_style|format|assets|characters/.test(res.error.message) && /column|schema cache|relation|does not exist/i.test(res.error.message)) {
      throw new Error('Database belum diperbarui. Pemilik Supabase perlu menjalankan supabase/migrations/003_styles_characters.sql di SQL Editor.');
    }
    // 0.18.1: durasi sampai 5 menit; database lama masih membatasi 180 detik.
    if (/target_seconds_check/.test(res.error.message)) {
      throw new Error('Durasi ditolak database. Batasnya: portrait 9:16 maks 5 menit, landscape 16:9 maks 15 menit. Kalau durasimu sudah di dalam batas itu, pemilik Supabase perlu menjalankan supabase/migrations/004_durasi_panjang.sql di SQL Editor (sementara itu pilih 180 detik atau kurang).');
    }
    throw new Error(res.error.message);
  }
  return res.data as T;
}

// ---------- Projects ----------

export async function listProjects() {
  return check<Project[]>(await sb().from('projects').select('*').order('updated_at', { ascending: false }));
}

export async function getProject(id: string) {
  return check<Project>(await sb().from('projects').select('*').eq('id', id).single());
}

export async function createProject(input: Pick<Project, 'title' | 'topic' | 'target_seconds' | 'content_type'> & Partial<Pick<Project, 'visual_style' | 'format' | 'assets'>>) {
  const { defaultComposition } = await window.anima.getSettings();
  return check<Project>(
    await sb()
      .from('projects')
      .insert({ ...input, composition: defaultComposition || 'Main' })
      .select()
      .single(),
  );
}

export async function updateProject(id: string, patch: Partial<Project>) {
  return check<Project>(await sb().from('projects').update(patch).eq('id', id).select().single());
}

export async function deleteProject(id: string) {
  check(await sb().from('projects').delete().eq('id', id));
}

// ---------- Shots ----------

export async function listShots(projectId: string) {
  return check<Shot[]>(await sb().from('shots').select('*').eq('project_id', projectId).order('idx'));
}

export async function addShot(projectId: string, idx: number) {
  return check<Shot>(
    await sb()
      .from('shots')
      .insert({ project_id: projectId, idx, duration_frames: 5 * FPS })
      .select()
      .single(),
  );
}

export async function updateShot(id: string, patch: Partial<Shot>) {
  return check<Shot>(await sb().from('shots').update(patch).eq('id', id).select().single());
}

export async function deleteShot(id: string) {
  check(await sb().from('shots').delete().eq('id', id));
}

/** Tukar urutan dua shot. Pakai idx sementara agar constraint unique tidak bentrok. */
export async function swapShots(a: Shot, b: Shot) {
  await updateShot(a.id, { idx: -1 });
  await updateShot(b.id, { idx: a.idx });
  await updateShot(a.id, { idx: b.idx });
}

// ---------- Karakter (maks 10 per akun, 1 utama wajib) ----------

export const MAX_CHARACTERS = 10;

export async function listCharacters() {
  return check<Character[]>(await sb().from('characters').select('*').order('is_main', { ascending: false }).order('created_at'));
}

export async function saveCharacter(c: Partial<Character> & Pick<Character, 'key' | 'name'>) {
  const row = { ...c };
  delete (row as Partial<Character>).updated_at;
  if (c.id) return check<Character>(await sb().from('characters').update(row).eq('id', c.id).select().single());
  return check<Character>(await sb().from('characters').insert(row).select().single());
}

export async function deleteCharacter(id: string) {
  check(await sb().from('characters').delete().eq('id', id));
}

// ---------- Render jobs ----------

export async function listJobs(projectId?: string) {
  let q = sb().from('render_jobs').select('*, projects(title)').order('created_at', { ascending: false }).limit(100);
  if (projectId) q = q.eq('project_id', projectId);
  return check<RenderJob[]>(await q);
}

export async function createJob(projectId: string, settings: Record<string, unknown>) {
  return check<RenderJob>(await sb().from('render_jobs').insert({ project_id: projectId, settings }).select().single());
}

export async function updateJob(id: string, patch: Partial<RenderJob> & { status?: JobStatus }) {
  check(await sb().from('render_jobs').update(patch).eq('id', id));
}

/** Job yang masih "queued/running" saat aplikasi dibuka berarti terputus (aplikasi ditutup). */
export async function markOrphanJobs(activeIds: string[]) {
  const rows = check<{ id: string }[]>(
    await sb().from('render_jobs').select('id').in('status', ['queued', 'running']),
  );
  const orphans = rows.map((r) => r.id).filter((id) => !activeIds.includes(id));
  if (orphans.length) {
    check(
      await sb()
        .from('render_jobs')
        .update({ status: 'failed', error: 'Terputus: aplikasi ditutup saat render.', finished_at: new Date().toISOString() })
        .in('id', orphans),
    );
  }
}

export async function stats() {
  const [projects, jobs] = await Promise.all([
    check<{ id: string; status: string }[]>(await sb().from('projects').select('id,status')),
    check<{ status: string; created_at: string }[]>(await sb().from('render_jobs').select('status,created_at')),
  ]);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  return {
    projects: projects.length,
    active: jobs.filter((j) => j.status === 'queued' || j.status === 'running').length,
    doneThisMonth: jobs.filter((j) => j.status === 'done' && new Date(j.created_at) >= monthStart).length,
    failed: jobs.filter((j) => j.status === 'failed').length,
  };
}

export function buildRenderProps(project: Project, shots: Shot[]): RenderProps {
  return {
    title: project.title,
    topic: project.topic,
    script: project.script,
    fps: FPS,
    durationInFrames: shots.reduce((n, s) => n + s.duration_frames, 0),
    shots: shots.map((s) => ({
      idx: s.idx,
      durationInFrames: s.duration_frames,
      camera: s.camera,
      characters: s.characters,
      world: s.world,
      narration: s.narration_text,
      speaker: s.speaker ?? '',
    })),
  };
}
