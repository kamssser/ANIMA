import { toast } from 'sonner';
import { buildRenderProps, createJob, listCharacters, listShots, updateJob, updateProject } from './api';
import { is2D, styleId } from './styles';
import { sb } from './supabase';
import type { Character, Comic2DRequest, Project, ProjectStatus, RenderEvent, Shot, Stage2D } from './types';
import { slugify } from './utils';

type Listener = (e: RenderEvent) => void;
const listeners = new Set<Listener>();
let wired = false;

/**
 * Satu-satunya penerima event render dari Electron. Menyimpan status ke Supabase
 * (progress dicatat tiap 5% agar hemat request) lalu meneruskan ke komponen yang mendengar.
 */
export function wireRenderEvents() {
  if (wired) return;
  wired = true;
  const lastSaved = new Map<string, number>();

  window.anima.onRenderEvent(async (e) => {
    listeners.forEach((l) => l(e));
    try {
      switch (e.type) {
        case 'started':
          await updateJob(e.jobId, { status: 'running', started_at: new Date().toISOString(), output_path: e.outFile });
          break;
        case 'progress': {
          const prev = lastSaved.get(e.jobId) ?? -5;
          if (e.progress - prev >= 5) {
            lastSaved.set(e.jobId, e.progress);
            await updateJob(e.jobId, { progress: e.progress });
          }
          break;
        }
        case 'done':
          await updateJob(e.jobId, { status: 'done', progress: 100, output_path: e.outFile, finished_at: new Date().toISOString() });
          await setProjectStatusFromJob(e.jobId, 'done');
          {
            const qaNote = e.qa
              ? e.qa.errors
                ? `Pemeriksaan otomatis menemukan ${e.qa.errors} masalah. Klik tombol merah di tabel render untuk melihat.`
                : e.qa.warnings
                  ? `Pemeriksaan otomatis: ${e.qa.warnings} catatan (tombol kuning di tabel render).`
                  : 'Lolos pemeriksaan otomatis.'
              : '';
            const bad = Boolean(e.warning || e.qa?.errors);
            (bad ? toast.warning : toast.success)(e.warning ? 'Video selesai, audio belum lengkap' : e.qa?.errors ? 'Render selesai, ada masalah' : 'Render selesai', {
              description: [e.warning, qaNote].filter(Boolean).join(' ') || undefined,
              duration: bad ? 15000 : 6000,
              action: { label: 'Buka folder', onClick: () => window.anima.showItem(e.outFile) },
            });
          }
          break;
        case 'failed':
          await updateJob(e.jobId, { status: 'failed', error: e.error, finished_at: new Date().toISOString() });
          await setProjectStatusFromJob(e.jobId, 'ready');
          toast.error('Render gagal', { description: e.error.split('\n').slice(-1)[0] });
          break;
        case 'cancelled':
          await updateJob(e.jobId, { status: 'cancelled', finished_at: new Date().toISOString() });
          await setProjectStatusFromJob(e.jobId, 'ready');
          break;
      }
    } catch (err) {
      console.error('Gagal menyimpan status render', err);
    }
  });
}

async function setProjectStatusFromJob(jobId: string, status: ProjectStatus) {
  const { data } = await sb().from('render_jobs').select('project_id').eq('id', jobId).single();
  if (data) await updateProject(data.project_id, { status });
}

export function onRender(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Susun data video 2D dari shot (penataan di shots.world), karakter akun, dan latar project. */
export function buildComic2D(project: Project, shots: Shot[], characters: Character[]): Comic2DRequest {
  const used = new Set<string>();
  const main = characters.find((c) => c.is_main);
  const out = shots.map((s) => {
    const st = (s.world ?? {}) as Stage2D;
    let cast = (st.cast ?? []).filter((m) => characters.some((c) => c.key === m.char));
    // Shot tanpa penataan: tampilkan karakter yang disebut di shot, atau karakter utama.
    if (!cast.length) {
      const named = characters.filter((c) => s.characters.some((n) => [c.key, c.name, c.nickname].map((x) => x.toLowerCase()).includes(n.toLowerCase())));
      const pick = named.length ? named.slice(0, 3) : main ? [main] : [];
      cast = pick.map((c, i) => ({ char: c.key, x: pick.length === 1 ? 0.5 : 0.28 + (0.44 * i) / (pick.length - 1), flip: i > 0 && i === pick.length - 1 }));
    }
    cast.forEach((m) => used.add(m.char));
    const speaker = st.speaker ?? (s.speaker === 'B' ? cast[1]?.char : s.speaker === 'A' ? cast[0]?.char : undefined);
    return { durationInFrames: s.duration_frames, bg: st.bg ?? '', camera: st.camera, framing: st.framing, cast, speaker, text: s.narration_text };
  });
  const chars: Comic2DRequest['characters'] = {};
  for (const c of characters) if (used.has(c.key) && c.svg) chars[c.key] = { name: c.nickname || c.name, svg: c.svg };
  const bgs: Comic2DRequest['backgrounds'] = {};
  for (const [k, b] of Object.entries(project.assets?.backgrounds ?? {})) bgs[k] = { svg: b.svg };
  return { style: styleId(project.visual_style), format: project.format === '16:9' ? '16:9' : '9:16', characters: chars, backgrounds: bgs, shots: out };
}

export async function queueRender(project: Project) {
  const shots = await listShots(project.id);
  if (shots.length === 0) throw new Error('Belum ada shot. Tambahkan minimal 1 shot sebelum render.');
  const two = is2D(project.visual_style);
  let comic: Comic2DRequest | undefined;
  if (two) {
    const characters = await listCharacters();
    if (!characters.some((c) => c.is_main && c.svg)) throw new Error('Style 2D butuh karakter utama. Buat dulu di Pengaturan > Karakter.');
    comic = buildComic2D(project, shots, characters);
    if (!Object.keys(comic.characters).length) throw new Error('Tidak ada karakter yang tampil di shot. Generate ulang story atau atur pemeran shot.');
  }
  const settings = await window.anima.getSettings();
  const job = await createJob(project.id, { scale: settings.scale, concurrency: settings.concurrency, crf: settings.crf, kind: two ? '2d' : '3d' });
  await updateProject(project.id, { status: 'rendering' });
  await window.anima.startRender({
    jobId: job.id,
    kind: two ? '2d' : '3d',
    slug: slugify(project.title),
    composition: project.composition || settings.defaultComposition,
    fileName: `${slugify(project.title)}-${job.id.slice(0, 8)}.mp4`,
    props: buildRenderProps(project, shots),
    overlay: two ? undefined : { shots: shots.map((s) => ({ durationInFrames: s.duration_frames, text: s.narration_text })), look: 'manhwa' },
    comic,
  });
  return job;
}
