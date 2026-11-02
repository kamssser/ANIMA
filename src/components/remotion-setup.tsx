import { useEffect, useState } from 'react';
import { CheckCircle2, Download, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

/** Satu klik: salin template skill, npm install, unduh Chrome render, lalu isi Pengaturan. */
export function RemotionSetup({ found, onDone }: { found: boolean; onDone: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState('');
  const [line, setLine] = useState('');
  const [needNode, setNeedNode] = useState(false);

  useEffect(
    () =>
      window.anima.onSetupEvent((e) => {
        if (e.step) setStep(e.step);
        if (e.line) setLine(e.line);
      }),
    [],
  );

  async function setup() {
    setBusy(true);
    setNeedNode(false);
    setStep('Mulai');
    setLine('');
    try {
      const r = await window.anima.setupRemotion();
      toast.success('Proyek Remotion siap', { description: r.path });
      await onDone();
    } catch (e) {
      const msg = (e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
      if (/Node\.js/.test(msg)) setNeedNode(true);
      toast.error('Gagal menyiapkan', { description: msg.split('\n').slice(-3).join('\n') });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2 rounded-md border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {found ? <CheckCircle2 className="size-5 text-success" /> : <Download className="size-5 text-warning" />}
          {found ? 'Proyek Remotion siap dipakai.' : 'Belum ada proyek Remotion. Siapkan otomatis (butuh Node.js dan internet, sekitar 600 MB).'}
        </div>
        <Button size="sm" variant={found ? 'outline' : 'default'} onClick={setup} disabled={busy}>
          {busy ? 'Menyiapkan...' : found ? 'Pasang ulang paket' : 'Siapkan otomatis'}
        </Button>
      </div>
      {busy && (
        <div className="grid gap-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{step}...</span>
          <span className="truncate font-mono">{line}</span>
        </div>
      )}
      {needNode && (
        <Button size="sm" variant="link" className="h-auto w-fit p-0" onClick={() => window.anima.openExternal('https://nodejs.org/en/download')}>
          Unduh Node.js LTS <ExternalLink />
        </Button>
      )}
    </div>
  );
}
