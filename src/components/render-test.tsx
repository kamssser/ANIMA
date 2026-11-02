import { useEffect, useState } from 'react';
import { Gauge, Image as ImageIcon, Wand2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Label, Progress, TBody, TD, TH, THead, TR, Table } from '@/components/ui/misc';
import type { BenchResult, Settings } from '@/lib/types';
import { formatDate } from '@/lib/utils';

const cleanError = (e: unknown) => (e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '');

function hours(h: number) {
  if (h < 1) return `${Math.round(h * 60)} menit`;
  return `${h.toFixed(1)} jam`;
}

/**
 * Uji render di laptop ini memakai pengaturan yang sedang dipilih (resolusi, kualitas, proses paralel).
 * `beforeRun` menyimpan pengaturan dulu supaya uji memakai nilai terbaru.
 */
export function RenderTest({ s, setS, beforeRun }: { s: Settings; setS: (s: Settings) => void; beforeRun: () => Promise<void> }) {
  const [results, setResults] = useState<BenchResult[]>([]);
  const [running, setRunning] = useState<null | 'still' | 'speed'>(null);
  const [step, setStep] = useState<{ step: string; progress: number } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    window.anima.benchList().then(setResults);
    return window.anima.onBenchEvent(setStep);
  }, []);

  useEffect(() => {
    if (!running) return;
    const t0 = Date.now();
    const id = setInterval(() => setElapsed(Math.round((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(id);
  }, [running]);

  const [auto, setAuto] = useState<Awaited<ReturnType<typeof window.anima.benchAuto>> | null>(null);

  async function runAuto() {
    setRunning('speed');
    setElapsed(0);
    setAuto(null);
    setStep({ step: 'Menyimpan pengaturan', progress: 0 });
    try {
      await beforeRun();
      const r = await window.anima.benchAuto();
      setAuto(r);
      setResults(await window.anima.benchList());
    } catch (e) {
      toast.error('Uji otomatis gagal', { description: cleanError(e) });
    } finally {
      setRunning(null);
      setStep(null);
    }
  }

  async function run(kind: 'still' | 'speed') {
    setRunning(kind);
    setElapsed(0);
    setStep({ step: 'Menyimpan pengaturan', progress: 0 });
    try {
      await beforeRun();
      const r = await window.anima.benchRun(kind);
      if (r.preview) setPreview(r.preview);
      setResults(await window.anima.benchList());
      toast.success(
        kind === 'still'
          ? `1 frame selesai dalam ${Math.round(r.seconds)} detik`
          : `Kecepatan: ${r.secPerFrame.toFixed(1)} detik/frame, 1 video sekitar ${hours(r.estVideoHours ?? 0)}`,
      );
    } catch (e) {
      toast.error('Uji render gagal', { description: cleanError(e) });
    } finally {
      setRunning(null);
      setStep(null);
    }
  }

  const latestSpeed = results.find((r) => r.kind === 'speed');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Uji render di laptop ini</CardTitle>
        <CardDescription>
          Memakai pengaturan Kualitas render di atas. "Uji 1 frame" untuk melihat tampilan; "Uji kecepatan" merender 10 frame untuk memperkirakan lama render 1 video (67 detik, 2025 frame).
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-2">
            <Label htmlFor="bf">Frame yang diuji</Label>
            <Input id="bf" type="number" min={0} className="w-28" value={s.benchFrame} onChange={(e) => setS({ ...s, benchFrame: Number(e.target.value) })} />
          </div>
          <Button variant="outline" onClick={() => run('still')} disabled={Boolean(running)}>
            <ImageIcon /> Uji 1 frame
          </Button>
          <Button variant="outline" onClick={() => run('speed')} disabled={Boolean(running)}>
            <Gauge /> Uji kecepatan (10 frame)
          </Button>
          <Button onClick={runAuto} disabled={Boolean(running)}>
            <Wand2 /> Uji otomatis & pilih paralel
          </Button>
          {running && (
            <Button variant="ghost" onClick={() => window.anima.benchCancel()}>
              <X /> Batalkan
            </Button>
          )}
        </div>

        {running && step && (
          <div className="grid gap-2 rounded-md border p-3 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>{step.step}...</span>
              <span className="tabular-nums">{elapsed} dtk</span>
            </div>
            <Progress value={step.progress} />
            <span className="text-xs text-muted-foreground">
              {running === 'still' ? 'Biasanya 1-2 menit.' : 'Uji kecepatan 3-5 menit; uji otomatis bisa 10-20 menit.'} Komputer akan terasa berat selama uji.
            </span>
          </div>
        )}

        {auto && !running && (
          <div className="grid gap-3 rounded-md border border-primary/40 bg-primary/5 p-4 text-sm">
            <div className="font-medium">
              Saran untuk perangkat ini ({auto.threads} thread, {Math.round(auto.ramGb)} GB RAM):{' '}
              {auto.best === 1 ? 'render 1 proses (tanpa paralel)' : `render paralel ${auto.best} proses`}
            </div>
            <div className="grid gap-1">
              {auto.results.map((r) => (
                <div key={r.id} className="flex justify-between tabular-nums">
                  <span>
                    {r.concurrency === 1 ? 'Tanpa paralel (1 proses)' : `Paralel ${r.concurrency} proses`}
                    {r.concurrency === auto.best && <b className="ml-2 text-primary">tercepat</b>}
                  </span>
                  <span>
                    {r.secPerFrame.toFixed(1)} dtk/frame · 1 video ~{hours(r.estVideoHours ?? 0)}
                  </span>
                </div>
              ))}
            </div>
            {auto.candidates.length === 1 && (
              <span className="text-xs text-muted-foreground">RAM/CPU perangkat ini terlalu kecil untuk diuji paralel.</span>
            )}
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={s.concurrency === auto.best}
                onClick={async () => {
                  setS({ ...s, concurrency: auto.best });
                  await window.anima.saveSettings({ concurrency: auto.best });
                  toast.success(auto.best === 1 ? 'Diterapkan: tanpa paralel' : `Diterapkan: paralel ${auto.best} proses`);
                }}
              >
                {s.concurrency === auto.best ? 'Sudah diterapkan' : 'Terapkan saran ini'}
              </Button>
            </div>
          </div>
        )}

        {latestSpeed && !running && !auto && (
          <div className="rounded-md bg-muted p-3 text-sm">
            Hasil terakhir: <b>{latestSpeed.secPerFrame.toFixed(1)} detik/frame</b> ({latestSpeed.width}x{latestSpeed.height},{' '}
            {latestSpeed.quality === 'draft' ? 'draft' : 'efek lengkap'}). Perkiraan 1 video: <b>{hours(latestSpeed.estVideoHours ?? 0)}</b>.
            <span className="block text-xs text-muted-foreground">
              Angka ini sudah termasuk waktu persiapan, jadi render video sungguhan biasanya sedikit lebih cepat per frame.
            </span>
          </div>
        )}

        {preview && (
          <div className="flex justify-center rounded-md border bg-black/80 p-2">
            <img src={preview} alt="Hasil uji 1 frame" className="max-h-96 rounded" />
          </div>
        )}

        {results.length > 0 && (
          <Table>
            <THead>
              <TR>
                <TH>Waktu uji</TH>
                <TH>Jenis</TH>
                <TH>Resolusi</TH>
                <TH>Kualitas</TH>
                <TH className="text-right">Lama</TH>
                <TH className="text-right">Detik/frame</TH>
                <TH className="text-right">1 video</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {results.map((r) => (
                <TR key={r.id}>
                  <TD className="text-muted-foreground">{formatDate(r.date)}</TD>
                  <TD>{r.kind === 'still' ? `1 frame (#${r.frame})` : `10 frame, ${r.concurrency} proses`}</TD>
                  <TD className="tabular-nums">
                    {r.width}x{r.height}
                  </TD>
                  <TD>
                    {r.quality === 'draft' ? 'Draft' : 'Lengkap'}, {r.gl === 'angle' ? 'GPU' : 'CPU'}
                  </TD>
                  <TD className="text-right tabular-nums">{Math.round(r.seconds)} dtk</TD>
                  <TD className="text-right tabular-nums">{r.secPerFrame.toFixed(1)}</TD>
                  <TD className="text-right tabular-nums">{r.estVideoHours != null ? hours(r.estVideoHours) : '-'}</TD>
                  <TD className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => window.anima.showItem(r.file)}>
                      Buka
                    </Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
