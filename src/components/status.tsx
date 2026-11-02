import { Badge } from '@/components/ui/misc';
import type { JobStatus, ProjectStatus } from '@/lib/types';

const jobMap: Record<JobStatus, { label: string; variant: 'secondary' | 'warning' | 'success' | 'destructive' | 'outline' }> = {
  queued: { label: 'Antre', variant: 'secondary' },
  running: { label: 'Merender', variant: 'warning' },
  done: { label: 'Selesai', variant: 'success' },
  failed: { label: 'Gagal', variant: 'destructive' },
  cancelled: { label: 'Dibatalkan', variant: 'outline' },
};

const projectMap: Record<ProjectStatus, { label: string; variant: 'secondary' | 'warning' | 'success' | 'outline' }> = {
  draft: { label: 'Draft', variant: 'outline' },
  ready: { label: 'Siap render', variant: 'secondary' },
  rendering: { label: 'Merender', variant: 'warning' },
  done: { label: 'Selesai', variant: 'success' },
};

export function JobBadge({ status }: { status: JobStatus }) {
  const s = jobMap[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

export function ProjectBadge({ status }: { status: ProjectStatus }) {
  const s = projectMap[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}
