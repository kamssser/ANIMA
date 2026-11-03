import { Link } from 'react-router-dom';
import { FolderOpen, Play, X } from 'lucide-react';
import { JobBadge } from '@/components/status';
import { QaButton } from '@/components/qa-report';
import { Button } from '@/components/ui/button';
import { Progress, TBody, TD, TH, THead, TR, Table } from '@/components/ui/misc';
import type { RenderJob } from '@/lib/types';
import { formatDate, formatSeconds } from '@/lib/utils';

function duration(j: RenderJob) {
  if (!j.started_at) return '-';
  const end = j.finished_at ? new Date(j.finished_at) : new Date();
  return formatSeconds((end.getTime() - new Date(j.started_at).getTime()) / 1000);
}

export function JobTable({ jobs, showProject, onChanged }: { jobs: RenderJob[]; showProject?: boolean; onChanged?: () => void }) {
  if (jobs.length === 0) return <p className="p-6 text-sm text-muted-foreground">Belum ada render.</p>;

  return (
    <Table>
      <THead>
        <TR>
          {showProject && <TH>Project</TH>}
          <TH>Status</TH>
          <TH className="w-48">Progres</TH>
          <TH>Lama</TH>
          <TH>Dibuat</TH>
          <TH className="text-right">Aksi</TH>
        </TR>
      </THead>
      <TBody>
        {jobs.map((j) => (
          <TR key={j.id}>
            {showProject && (
              <TD className="font-medium">
                <Link to={`/projects/${j.project_id}`} className="hover:underline">
                  {j.projects?.title ?? '-'}
                </Link>
              </TD>
            )}
            <TD>
              <JobBadge status={j.status} />
              {j.status === 'failed' && j.error && (
                <div className="mt-1 max-w-xs truncate text-xs text-destructive" title={j.error}>
                  {j.error.split('\n').slice(-1)[0]}
                </div>
              )}
            </TD>
            <TD>
              <div className="flex items-center gap-2">
                <Progress value={j.progress} />
                <span className="w-9 text-right text-xs tabular-nums">{j.progress}%</span>
              </div>
            </TD>
            <TD className="tabular-nums text-muted-foreground">{duration(j)}</TD>
            <TD className="text-muted-foreground">{formatDate(j.created_at)}</TD>
            <TD className="text-right">
              <div className="flex justify-end gap-1">
                {j.status === 'done' && j.output_path && (
                  <>
                    <QaButton job={j} />
                    <Button size="sm" variant="ghost" onClick={() => window.anima.openPath(j.output_path!)} title="Putar video">
                      <Play />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => window.anima.showItem(j.output_path!)} title="Buka folder">
                      <FolderOpen />
                    </Button>
                  </>
                )}
                {(j.status === 'queued' || j.status === 'running') && (
                  <Button
                    size="sm"
                    variant="ghost"
                    title="Batalkan"
                    onClick={async () => {
                      await window.anima.cancelRender(j.id);
                      onChanged?.();
                    }}
                  >
                    <X />
                  </Button>
                )}
              </div>
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
