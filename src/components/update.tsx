import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Download, Loader2, RefreshCw, Rocket } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/misc';
import type { UpdateState } from '@/lib/types';
import { cn, formatDate } from '@/lib/utils';

// Satu sumber status update untuk seluruh aplikasi.
let shared: UpdateState = { state: 'idle' };
const subs = new Set<(u: UpdateState) => void>();
let wired = false;
let manualCheck = false;

function wire() {
  if (wired) return;
  wired = true;
  window.anima.updateState().then((u) => {
    shared = { ...shared, ...u };
    subs.forEach((f) => f(shared));
  });
  window.anima.onUpdateEvent((e) => {
    shared = { ...shared, ...e };
    subs.forEach((f) => f(shared));
  });
}

export function useUpdate() {
  const [u, setU] = useState<UpdateState>(shared);
  useEffect(() => {
    wire();
    subs.add(setU);
    setU(shared);
    return () => {
      subs.delete(setU);
    };
  }, []);
  return u;
}

/** Cek update manual (tombol). Hasil "sudah terbaru" / "gagal" ditampilkan sebagai notifikasi. */
export function checkForUpdate() {
  if (shared.state === 'dev') {
    toast.info('Cek update hanya aktif di versi yang di-install', { description: 'Mode pengembangan tidak memakai update otomatis.' });
    return;
  }
  manualCheck = true;
  window.anima.checkUpdate();
}

/**
 * Dialog update global: muncul saat update ditemukan (proses unduh di dalam aplikasi),
 * lalu bertanya "Restart sekarang?" saat siap dipasang.
 */
export function UpdateDialog() {
  const u = useUpdate();
  const [open, setOpen] = useState(false);
  const dismissedFor = useRef<string | null>(null);
  const prev = useRef<UpdateState['state']>(u.state);

  useEffect(() => {
    const was = prev.current;
    prev.current = u.state;
    if (u.state === was) return;
    // Update ditemukan / siap: buka dialog (kecuali user sudah klik "Nanti" untuk versi ini).
    if ((u.state === 'downloading' || u.state === 'ready') && dismissedFor.current !== `${u.version}-${u.state}`) setOpen(true);
    if (manualCheck && u.state === 'latest') {
      manualCheck = false;
      toast.success('Sudah versi terbaru', { description: `HyperForge v${u.current ?? ''}` });
    }
    if (manualCheck && u.state === 'error') {
      manualCheck = false;
      toast.error('Gagal mengecek update', { description: u.error ?? undefined });
    }
  }, [u.state, u.version, u.current, u.error]);

  const later = () => {
    dismissedFor.current = `${u.version}-${u.state}`;
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : later())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 grid size-12 place-items-center rounded-xl bg-primary/15 text-primary">
            {u.state === 'ready' ? <Rocket className="size-6" /> : <Download className="size-6" />}
          </div>
          <DialogTitle>{u.state === 'ready' ? `HyperForge ${u.version} siap dipasang` : `Update ${u.version ?? ''} ditemukan`}</DialogTitle>
          <DialogDescription>
            {u.state === 'ready'
              ? 'Restart sekarang untuk memasang update? Aplikasi akan tertutup sebentar lalu terbuka lagi. Project dan pengaturanmu tetap aman.'
              : 'Sedang mengunduh update di dalam aplikasi. Kamu boleh tetap bekerja; dialog ini bisa ditutup.'}
          </DialogDescription>
        </DialogHeader>

        {u.state === 'downloading' && (
          <div className="grid gap-2">
            <Progress value={u.percent ?? 0} />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Loader2 className="size-3.5 animate-spin" /> Mengunduh...
              </span>
              <span className="tabular-nums">{u.percent ?? 0}%</span>
            </div>
          </div>
        )}

        <DialogFooter>
          {u.state === 'ready' ? (
            <>
              <Button variant="outline" onClick={later}>
                Tidak, nanti saja
              </Button>
              <Button onClick={() => window.anima.installUpdate()}>
                <RefreshCw /> Ya, restart sekarang
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={later}>
              Sembunyikan
            </Button>
          )}
        </DialogFooter>
        {u.state === 'ready' && (
          <p className="text-xs text-muted-foreground">Kalau memilih "nanti", update otomatis terpasang saat aplikasi ditutup.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Kotak kecil di sidebar: versi + tombol Cek update (selalu terlihat). */
export function SidebarUpdate() {
  const u = useUpdate();
  const busy = u.state === 'checking' || u.state === 'downloading';
  return (
    <div className="mx-3 mb-2 flex items-center justify-between gap-2 rounded-lg border border-sidebar-border px-3 py-2">
      <div className="min-w-0">
        <div className="text-xs font-medium text-foreground">v{u.current ?? '-'}</div>
        <div className={cn('truncate text-[11px]', u.state === 'ready' ? 'text-primary' : 'text-muted-foreground')}>
          {u.state === 'checking'
            ? 'Mengecek...'
            : u.state === 'downloading'
              ? `Mengunduh ${u.percent ?? 0}%`
              : u.state === 'ready'
                ? `${u.version} siap dipasang`
                : u.state === 'latest'
                  ? 'Versi terbaru'
                  : u.state === 'error'
                    ? 'Gagal dicek'
                    : 'HyperForge'}
        </div>
      </div>
      {u.state === 'ready' ? (
        <Button size="sm" className="h-7 px-2.5 text-xs" onClick={() => window.anima.installUpdate()}>
          Restart
        </Button>
      ) : (
        <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" disabled={busy} onClick={checkForUpdate}>
          <RefreshCw className={cn('size-3.5', busy && 'animate-spin')} /> Cek update
        </Button>
      )}
    </div>
  );
}

/** Banner tipis di atas aplikasi saat update diunduh / siap (setelah dialog ditutup). */
export function UpdateBanner() {
  const u = useUpdate();
  if (u.state !== 'downloading' && u.state !== 'ready') return null;
  return (
    <div className="flex items-center gap-4 border-b border-primary/30 bg-primary/10 px-8 py-2 text-sm">
      {u.state === 'ready' ? <Rocket className="size-4 shrink-0 text-primary" /> : <Download className="size-4 shrink-0 text-primary" />}
      <span className="flex-1">
        {u.state === 'ready' ? (
          <>
            <b>HyperForge {u.version}</b> siap dipasang.
          </>
        ) : (
          <>
            Mengunduh update <b>{u.version}</b>... {u.percent ?? 0}%
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

/** Kartu di Pengaturan > Tampilan & update. */
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
          <Button size="sm" variant="outline" disabled={u.state === 'checking' || u.state === 'downloading'} onClick={checkForUpdate}>
            <RefreshCw /> Cek update
          </Button>
        )}
      </div>
      {u.state === 'downloading' && <Progress value={u.percent ?? 0} />}
      <p className="text-xs text-muted-foreground">Update dicek otomatis setiap aplikasi dibuka dan setiap 4 jam.</p>
    </div>
  );
}
