import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Cpu, HardDrive, MemoryStick } from 'lucide-react';
import { PageHeader } from '@/components/layout';
import { JobBadge } from '@/components/status';
import { Card, CardContent, CardHeader, CardTitle, Progress, Skeleton, TBody, TD, TH, THead, TR, Table } from '@/components/ui/misc';
import { listJobs, stats } from '@/lib/api';
import { onRender } from '@/lib/render';
import type { RenderJob, SystemInfo } from '@/lib/types';
import { formatDate } from '@/lib/utils';

export default function OverviewPage() {
  const [s, setS] = useState<Awaited<ReturnType<typeof stats>> | null>(null);
  const [jobs, setJobs] = useState<RenderJob[] | null>(null);
  const [sys, setSys] = useState<SystemInfo | null>(null);

  useEffect(() => {
    const load = () => {
      stats().then(setS).catch(() => {});
      listJobs().then((j) => setJobs(j.slice(0, 6))).catch(() => setJobs([]));
    };
    load();
    window.anima.systemInfo().then(setSys);
    // Muat ulang hanya saat status berubah, bukan tiap progress.
    return onRender((e) => {
      if (e.type === 'progress') {
        setJobs((js) => js?.map((j) => (j.id === e.jobId ? { ...j, progress: e.progress, status: 'running' } : j)) ?? js);
      } else {
        setTimeout(load, 500);
      }
    });
  }, []);

  const tiles = [
    { label: 'Project', value: s?.projects },
    { label: 'Render aktif', value: s?.active },
    { label: 'Video selesai bulan ini', value: s?.doneThisMonth },
    { label: 'Render gagal', value: s?.failed },
  ];

  const lowDisk = sys && sys.tempFreeGb !== null && sys.tempFreeGb < 10;

  return (
    <>
      <PageHeader title="Overview" description="Ringkasan produksi video dan kondisi laptop." />
      <div className="flex flex-col gap-6 p-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {tiles.map((t) => (
            <Card key={t.label}>
              <CardContent className="p-5">
                <div className="text-sm text-muted-foreground">{t.label}</div>
                <div className="mt-1 text-2xl font-semibold tabular-nums">{t.value ?? <Skeleton className="h-8 w-12" />}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {sys && (
          <Card>
            <CardHeader>
              <CardTitle>Kondisi laptop</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
              <div className="flex items-center gap-2">
                <Cpu className="size-4 text-muted-foreground" />
                <span className="truncate" title={sys.cpu}>
                  {sys.threads} thread
                </span>
              </div>
              <div className="flex items-center gap-2">
                <MemoryStick className="size-4 text-muted-foreground" />
                RAM {sys.ramGb.toFixed(0)} GB (kosong {sys.freeRamGb.toFixed(1)} GB)
              </div>
              <div className="flex items-center gap-2">
                <HardDrive className="size-4 text-muted-foreground" />
                Disk render kosong {sys.tempFreeGb?.toFixed(1) ?? '?'} GB
              </div>
              {lowDisk && (
                <div className="flex items-start gap-2 rounded-md bg-warning/15 p-3 text-warning sm:col-span-3">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  Ruang disk di bawah 10 GB. Render bisa gagal di tengah jalan. Kosongkan drive atau pindahkan folder
                  sementara ke drive lain di Pengaturan.
                </div>
              )}
              {!sys.remotionFound && (
                <div className="flex items-start gap-2 rounded-md bg-muted p-3 text-muted-foreground sm:col-span-3">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  Proyek Remotion belum diatur, jadi tombol Render belum bisa dipakai. Atur di&nbsp;
                  <Link to="/settings" className="text-primary underline">
                    Pengaturan
                  </Link>
                  .
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Render terbaru</CardTitle>
          </CardHeader>
          <CardContent>
            {!jobs ? (
              <Skeleton className="h-24" />
            ) : jobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada render.</p>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Project</TH>
                    <TH>Status</TH>
                    <TH className="w-48">Progres</TH>
                    <TH>Dibuat</TH>
                  </TR>
                </THead>
                <TBody>
                  {jobs.map((j) => (
                    <TR key={j.id}>
                      <TD>
                        <Link to={`/projects/${j.project_id}`} className="hover:underline">
                          {j.projects?.title ?? '-'}
                        </Link>
                      </TD>
                      <TD>
                        <JobBadge status={j.status} />
                      </TD>
                      <TD>
                        <div className="flex items-center gap-2">
                          <Progress value={j.progress} />
                          <span className="w-9 text-right text-xs tabular-nums">{j.progress}%</span>
                        </div>
                      </TD>
                      <TD className="text-muted-foreground">{formatDate(j.created_at)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
