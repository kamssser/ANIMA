import { CheckCircle2, Download, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cleanErr, runTask, useTask, useTaskFinished } from '@/lib/tasks';

/** Satu klik: salin template skill, npm install, unduh Chrome render, lalu isi Pengaturan. */
export function RemotionSetup({ found, onDone }: { found: boolean; onDone: () => Promise<void> }) {
  // Status disimpan global supaya tetap terlihat saat pindah halaman (npm install bisa beberapa menit).
  const task = useTask('setup');
  const busy = Boolean(task?.running);
  const step = task?.step ?? '';
  const line = task?.log.at(-1) ?? '';
  const needNode = Boolean(task && !task.running && task.error && /Node\.js/.test(task.error));

  useTaskFinished('setup', (t) => !t.error && onDone().catch(() => {}));

  function setup() {
    runTask('setup', { label: 'Menyiapkan Remotion', href: '/settings', step: 'Mulai' }, () => window.anima.setupRemotion()).then(
      (r) => toast.success('Proyek Remotion siap', { description: r.path }),
      (e) => toast.error('Gagal menyiapkan', { description: cleanErr(e).split('\n').slice(-3).join('\n') }),
    );
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
          {line !== step && <span className="truncate font-mono">{line}</span>}
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
