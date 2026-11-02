import { useEffect, useState } from 'react';
import { CheckCircle2, Download, RefreshCw, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/misc';
import type { UpdateState } from '@/lib/types';
import { formatDate } from '@/lib/utils';

export function useUpdate() {
  const [u, setU] = useState<UpdateState>({ state: 'idle' });
  useEffect(() => {
    window.anima.updateState().then(setU);
    return window.anima.onUpdateEvent((e) => setU((prev) => ({ ...prev, ...e })));
  }, []);
  return u;
}

/** Banner di atas aplikasi: muncul hanya saat update sedang diunduh atau siap dipasang. */
export function UpdateBanner() {
  const u = useUpdate();
  if (u.state !== 'downloading' && u.state !== 'ready') return null;
  return (
    <div className="flex items-center gap-4 border-b border-primary/30 bg-primary/10 px-8 py-2.5 text-sm">
      {u.state === 'ready' ? <Rocket className="size-4 shrink-0 text-primary" /> : <Download className="size-4 shrink-0 text-primary" />}
      <span className="flex-1">
        {u.state === 'ready' ? (
          <>
            <b>HyperForge {u.version}</b> siap dipasang. Aplikasi akan ditutup sebentar lalu terbuka lagi.
          </>
        ) : (
          <>
            Mengunduh update <b>{u.version}</b> di latar belakang... {u.percent ?? 0}%
          </>
        )}
      </span>
      {u.state === 'downloading' ? (
        <Progress value={u.percent ?? 0} className="w-40" />
      ) : (
        <Button size="sm" onClick={() => window.anima.installUpdate()}>
          <RefreshCw /> Restart & update
        </Button>
      )}
    </div>
  );
}

/** Kartu di Pengaturan > Tampilan: versi sekarang + tombol cek update. */
export function UpdatePanel({ version }: { version?: string }) {
  const u = useUpdate();
  const label: Record<UpdateState['state'], string> = {
    idle: 'Belum dicek.',
    dev: u.message ?? 'Update otomatis hanya aktif di versi yang di-install.',
    checking: 'Mengecek update...',
    latest: `Sudah versi terbaru${u.checkedAt ? ` (dicek ${formatDate(u.checkedAt)})` : ''}.`,
    downloading: `Mengunduh versi ${u.version}... ${u.percent ?? 0}%`,
    ready: `Versi ${u.version} siap dipasang.`,
    error: `Gagal mengecek update: ${u.error ?? 'tidak diketahui'}`,
  };
  return (
    <div className="grid gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">HyperForge v{version ?? u.current ?? '-'}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            {u.state === 'latest' && <CheckCircle2 className="size-3.5 text-success" />}
            {label[u.state]}
          </div>
        </div>
        {u.state === 'ready' ? (
          <Button size="sm" onClick={() => window.anima.installUpdate()}>
            <RefreshCw /> Restart & update
          </Button>
        ) : (
          <Button size="sm" variant="outline" disabled={u.state === 'checking' || u.state === 'downloading' || u.state === 'dev'} onClick={() => window.anima.checkUpdate()}>
            <RefreshCw /> Cek update
          </Button>
        )}
      </div>
      {u.state === 'downloading' && <Progress value={u.percent ?? 0} />}
      <p className="text-xs text-muted-foreground">Update dicek otomatis setiap aplikasi dibuka dan setiap 4 jam, lalu diunduh di latar belakang.</p>
    </div>
  );
}
