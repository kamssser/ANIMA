import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, ScanSearch, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cleanErr } from '@/lib/tasks';
import type { QaReport, RenderJob } from '@/lib/types';
import { cn } from '@/lib/utils';

const KIND: Record<string, string> = {
  black: 'Layar hitam',
  frozen: 'Gambar diam',
  silence: 'Tanpa suara',
  loudness: 'Kerasnya suara',
  peak: 'Suara pecah',
  audio: 'Audio',
  file: 'File',
  check: 'Pemeriksaan',
};

const cache = new Map<string, QaReport | null>();

/** Tombol kecil di tabel render: status pemeriksaan + buka laporan. */
export function QaButton({ job }: { job: RenderJob }) {
  const [report, setReport] = useState<QaReport | null | undefined>(cache.get(job.id));
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (cache.has(job.id) && cache.get(job.id)) return;
    window.anima.renderQa(job.id).then((r) => {
      cache.set(job.id, r);
      setReport(r);
    });
  }, [job.id, job.finished_at]);

  async function rerun() {
    if (!job.output_path) return;
    setBusy(true);
    try {
      const r = await window.anima.runRenderQa({ jobId: job.id, file: job.output_path });
      cache.set(job.id, r);
      setReport(r);
      setOpen(true);
    } catch (e) {
      toast.error('Gagal memeriksa video', { description: cleanErr(e) });
    } finally {
      setBusy(false);
    }
  }

  if (report === undefined) return null;
  if (!report) {
    return (
      <Button size="sm" variant="ghost" onClick={rerun} disabled={busy} title="Periksa video ini (layar hitam, gambar diam, suara)">
        {busy ? <Loader2 className="animate-spin" /> : <ScanSearch />}
      </Button>
    );
  }
  const errors = report.issues.filter((i) => i.level === 'error').length;
  const warns = report.issues.length - errors;
  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setOpen(true)}
        title={errors ? `${errors} masalah` : warns ? `${warns} catatan` : 'Lolos pemeriksaan'}
        className={cn(errors ? 'text-destructive' : warns ? 'text-warning' : 'text-success')}
      >
        {errors ? <XCircle /> : warns ? <AlertTriangle /> : <CheckCircle2 />}
        <span className="text-xs">{errors || warns || 'OK'}</span>
      </Button>
      <QaDialog report={report} open={open} onOpenChange={setOpen} onRerun={rerun} busy={busy} />
    </>
  );
}

export function QaDialog({ report, open, onOpenChange, onRerun, busy }: { report: QaReport; open: boolean; onOpenChange: (o: boolean) => void; onRerun?: () => void; busy?: boolean }) {
  const errors = report.issues.filter((i) => i.level === 'error');
  const warns = report.issues.filter((i) => i.level === 'warn');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {errors.length ? <XCircle className="size-5 text-destructive" /> : warns.length ? <AlertTriangle className="size-5 text-warning" /> : <CheckCircle2 className="size-5 text-success" />}
            {errors.length ? `${errors.length} masalah ditemukan` : warns.length ? `Lolos, dengan ${warns.length} catatan` : 'Lolos pemeriksaan'}
          </DialogTitle>
          <DialogDescription>
            Diperiksa otomatis setelah render: layar hitam, gambar diam terlalu lama, bagian tanpa suara, dan kerasnya suara.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 text-sm sm:grid-cols-4">
          <Stat label="Durasi" value={`${report.duration.toFixed(1)} dtk`} />
          <Stat label="Ukuran" value={`${report.width}x${report.height}`} />
          <Stat label="Kerasnya suara" value={report.lufs != null ? `${report.lufs.toFixed(1)} LUFS` : '-'} hint="ideal sekitar -14" />
          <Stat label="Puncak suara" value={report.peak != null ? `${report.peak.toFixed(1)} dB` : '-'} hint="aman di bawah -0,5" />
        </div>

        {report.issues.length > 0 && (
          <div className="grid gap-1 rounded-md border p-3">
            {report.issues.map((i, k) => (
              <div key={k} className="flex items-start gap-2 text-sm">
                {i.level === 'error' ? <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />}
                <span className="w-28 shrink-0 text-muted-foreground">{KIND[i.kind] ?? i.kind}</span>
                <span>{i.text}</span>
              </div>
            ))}
            {report.issues.some((i) => i.kind === 'frozen') && (
              <p className="mt-1 text-xs text-muted-foreground">
                Gambar diam tidak selalu salah (mis. adegan tenang), tapi lebih dari 3 detik biasanya membuat penonton menggeser video.
              </p>
            )}
          </div>
        )}

        {report.sheet && (
          <div className="grid gap-1">
            <span className="text-xs text-muted-foreground">Ringkasan frame: satu gambar setiap {report.sheetStep ?? 2} detik, dari kiri ke kanan.</span>
            <img src={report.sheet} alt="Ringkasan frame video" className="w-full rounded-md border bg-black" />
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Diperiksa {new Date(report.checkedAt).toLocaleString('id-ID')}</span>
          {onRerun && (
            <Button size="sm" variant="outline" onClick={onRerun} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />} Periksa ulang
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md bg-muted p-2.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium tabular-nums">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
