import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Clapperboard, Cpu, Film, FolderKanban, Gauge, HardDrive, MemoryStick, Plus, TriangleAlert } from 'lucide-react';
import hero from '@/assets/hero.webp';
import { PageBody } from '@/components/layout';
import { JobBadge } from '@/components/status';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, Progress, Skeleton } from '@/components/ui/misc';
import { listJobs, stats } from '@/lib/api';
import { onRender } from '@/lib/render';
import type { RenderJob, SystemInfo } from '@/lib/types';
import { cn, formatDate } from '@/lib/utils';

function Meter({ label, icon: Icon, value, max, unit, warn }: { label: string; icon: typeof Cpu; value: number; max: number; unit: string; warn?: boolean }) {
  const pct = Math.min(100, Math.round((value / Math.max(max, 1)) * 100));
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-muted-foreground">
          <Icon className="size-4" /> {label}
        </span>
        <span className={cn('font-medium tabular-nums', warn && 'text-warning')}>
          {value.toFixed(1)} / {max.toFixed(0)} {unit}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full', warn ? 'bg-warning' : 'bg-primary')} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

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
    { label: 'Project', value: s?.projects, icon: FolderKanban },
    { label: 'Render aktif', value: s?.active, icon: Clapperboard },
    { label: 'Video bulan ini', value: s?.doneThisMonth, icon: Film },
    { label: 'Render gagal', value: s?.failed, icon: TriangleAlert },
  ];

  const lowDisk = sys && sys.tempFreeGb !== null && sys.tempFreeGb < 10;

  return (
    <PageBody className="py-8">
      {/* Banner sambutan: gambar dikunci ke kanan (robot selalu terlihat), teks di sisi kiri yang gelap */}
      <section
        className="relative flex h-[224px] items-center overflow-hidden rounded-2xl border border-primary/30 bg-[#03060f] bg-no-repeat px-8 text-white"
        // Gambar setinggi banner & menempel kanan: robot selalu utuh, sisi kiri menyatu dengan latar hitam.
        style={{ backgroundImage: `url(${hero})`, backgroundSize: 'auto 100%', backgroundPosition: 'right center' }}
      >
        {/* Lebar gambar di tinggi 224 px = 224 x (1958/803) ~ 546 px; haluskan tepi kirinya ke latar hitam. */}
        <div className="pointer-events-none absolute inset-y-0 right-0 w-[546px] bg-gradient-to-r from-[#03060f] to-transparent to-45%" />
        <div className="relative max-w-md">
          <div className="text-xs font-semibold tracking-widest text-[#7fb0ff] uppercase">HyperForge Studio</div>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Dari ide jadi video 3D.</h1>
          <p className="mt-2 text-sm text-white/70">Cerita oleh Claude, suara oleh vibi.pro, animasi oleh HyperForge.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild className="bg-white text-[#0b1020] hover:bg-white/90">
              <Link to="/projects">
                <Plus /> Project baru
              </Link>
            </Button>
            <Button asChild variant="outline" className="border-white/25 bg-white/5 text-white hover:bg-white/15 hover:text-white">
              <Link to="/settings">
                <Gauge /> Uji render
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Statistik */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label} className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t.label}</span>
              <span className="grid size-8 place-items-center rounded-lg bg-primary/15 text-primary">
                <t.icon className="size-4" />
              </span>
            </div>
            <div className="mt-3 text-3xl font-bold tabular-nums">{t.value ?? <Skeleton className="h-9 w-12" />}</div>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Render terbaru */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Render terbaru</CardTitle>
            <Link to="/renders" className="flex items-center gap-1 text-sm text-primary hover:underline">
              Lihat semua <ArrowRight className="size-3.5" />
            </Link>
          </CardHeader>
          <CardContent>
            {!jobs ? (
              <Skeleton className="h-24" />
            ) : jobs.length === 0 ? (
              <div className="grid place-items-center gap-2 rounded-lg border border-dashed py-10 text-center">
                <Clapperboard className="size-8 text-muted-foreground/60" />
                <p className="text-sm text-muted-foreground">Belum ada render. Buka project lalu klik Render.</p>
              </div>
            ) : (
              <div className="flex flex-col divide-y">
                {jobs.map((j) => (
                  <div key={j.id} className="flex items-center gap-4 py-3">
                    <div className="min-w-0 flex-1">
                      <Link to={`/projects/${j.project_id}`} className="block truncate font-medium hover:underline">
                        {j.projects?.title ?? '-'}
                      </Link>
                      <div className="text-xs text-muted-foreground">{formatDate(j.created_at)}</div>
                    </div>
                    <div className="hidden w-40 items-center gap-2 sm:flex">
                      <Progress value={j.progress} />
                      <span className="w-9 text-right text-xs tabular-nums">{j.progress}%</span>
                    </div>
                    <JobBadge status={j.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Kondisi laptop */}
        <Card>
          <CardHeader>
            <CardTitle>Kondisi laptop</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            {!sys ? (
              <Skeleton className="h-24" />
            ) : (
              <>
                <div className="flex items-start gap-2 text-sm">
                  <Cpu className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    <span className="text-foreground">{sys.threads} thread</span> · {sys.cpu}
                  </span>
                </div>
                <Meter label="RAM terpakai" icon={MemoryStick} value={sys.ramGb - sys.freeRamGb} max={sys.ramGb} unit="GB" />
                {sys.tempFreeGb !== null && (
                  <Meter
                    label="Disk render kosong"
                    icon={HardDrive}
                    value={sys.tempFreeGb}
                    max={Math.max(sys.tempFreeGb, 50)}
                    unit="GB"
                    warn={Boolean(lowDisk)}
                  />
                )}
                {lowDisk && (
                  <div className="flex items-start gap-2 rounded-lg bg-warning/10 p-3 text-xs text-warning">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    Ruang disk di bawah 10 GB, render bisa gagal. Kosongkan drive atau pindahkan folder sementara.
                  </div>
                )}
                {!sys.remotionFound && (
                  <div className="flex items-start gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    <span>
                      Proyek Remotion belum siap.{' '}
                      <Link to="/settings" className="text-primary underline">
                        Siapkan di Pengaturan
                      </Link>
                    </span>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </PageBody>
  );
}
