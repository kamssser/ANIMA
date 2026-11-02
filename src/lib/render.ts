import { toast } from 'sonner';
import { buildRenderProps, createJob, listShots, updateJob, updateProject } from './api';
import { sb } from './supabase';
import type { Project, ProjectStatus, RenderEvent } from './types';
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
          toast.success('Render selesai', {
            action: { label: 'Buka folder', onClick: () => window.anima.showItem(e.outFile) },
          });
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

export async function queueRender(project: Project) {
  const shots = await listShots(project.id);
  if (shots.length === 0) throw new Error('Belum ada shot. Tambahkan minimal 1 shot sebelum render.');
  const settings = await window.anima.getSettings();
  const job = await createJob(project.id, { scale: settings.scale, concurrency: settings.concurrency, crf: settings.crf });
  await updateProject(project.id, { status: 'rendering' });
  await window.anima.startRender({
    jobId: job.id,
    composition: project.composition || settings.defaultComposition,
    fileName: `${slugify(project.title)}-${job.id.slice(0, 8)}.mp4`,
    props: buildRenderProps(project, shots),
  });
  return job;
}
