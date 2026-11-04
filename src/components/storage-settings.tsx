// Pengaturan > Penyimpanan: berapa besar hasil generate HyperForge dan cache, lalu bersihkan.
import { useEffect, useState } from 'react';
import { Eraser, FolderOpen, HardDrive, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/misc';
import { cleanErr } from '@/lib/tasks';
import type { StorageScan } from '@/lib/types';
import { formatDate } from '@/lib/utils';

const SOURCE: Record<string, string> = {
  render: 'Render HyperForge',
  studio: 'HyperForge Studio',
  animate: 'Animate',
  'bang-motion': 'Bang Motion',
  animantra: 'Animantra',
  lemo: 'Lemo-Opuscar',
  motionmaxxing: 'Motionmaxxing',
  flow: 'Google Flow',
  kamal: 'Kamal',
  stickman: 'Stickman',
};

export const fmtBytes = (b: number) =>
  b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(2)} GB` : b >= 1024 ** 2 ? `${(b / 1024 ** 2).toFixed(1)} MB` : b >= 1024 ? `${Math.round(b / 1024)} KB` : `${b} B`;

export function StorageSettings() {
  const [scan, setScan] = useState<StorageScan | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set(['app', 'thumbs', 'tempDir', 'flowShots']));

  async function load() {
    setLoading(true);
    try {
      setScan(await window.anima.storageScan());
    } catch (e) {
      toast.error('Gagal menghitung penyimpanan', { description: cleanErr(e) });
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function clean(key: string, payload: Parameters<typeof window.anima.storageClean>[0], confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(key);
    try {
      const r = await window.anima.storageClean(payload);
      toast.success(`Selesai, ${fmtBytes(r.freed)} dibebaskan`);
      await load();
    } catch (e) {
      toast.error('Gagal membersihkan', { description: cleanErr(e), duration: 12000 });
    } finally {
      setBusy(null);
    }
  }

  const tempTotal = scan?.projects.reduce((a, p) => a + p.tempBytes, 0) ?? 0;
  const cacheTotal = scan?.caches.filter((c) => picked.has(c.id)).reduce((a, c) => a + c.bytes, 0) ?? 0;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="size-5 text-primary" /> Penyimpanan
          </CardTitle>
          <CardDescription>
            Hasil generate (proyek skill, render, klip) dan cache HyperForge di laptop ini. Hapus yang tidak dipakai supaya disk lega. Yang dihapus tidak bisa dikembalikan.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-2xl font-semibold tabular-nums">{scan ? fmtBytes(scan.total) : '...'}</div>
            <span className="text-sm text-muted-foreground">dipakai HyperForge</span>
            <Button variant="outline" size="sm" className="ml-auto" onClick={load} disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />} Hitung ulang
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 p-3">
            <div className="min-w-0 flex-1 text-sm">
              <div className="font-medium">File sementara render ({fmtBytes(tempTotal)})</div>
              <div className="text-xs text-muted-foreground">Folder frames/, tmp/, cache/ di dalam proyek skill. Video jadi, naskah, suara, dan gambar tetap ada; dibuat ulang otomatis kalau render lagi.</div>
            </div>
            <Button onClick={() => clean('temp', { kind: 'temp' })} disabled={!tempTotal || busy !== null}>
              {busy === 'temp' ? <Loader2 className="animate-spin" /> : <Eraser />} Bersihkan file sementara
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cache</CardTitle>
          <CardDescription>Aman dihapus: dibuat atau diunduh ulang saat dibutuhkan.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {!scan ? (
            <Loader2 className="animate-spin text-muted-foreground" />
          ) : (
            scan.caches.map((c) => (
              <label key={c.id} className="flex items-center gap-3 rounded-md border p-2.5 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={picked.has(c.id)}
                  onChange={(e) => {
                    const n = new Set(picked);
                    if (e.target.checked) n.add(c.id);
                    else n.delete(c.id);
                    setPicked(n);
                  }}
                />
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{c.label}</span>
                  {c.hint && <span className="block truncate text-xs text-muted-foreground" title={c.path}>{c.hint}</span>}
                </span>
                <span className="tabular-nums text-muted-foreground">{fmtBytes(c.bytes)}</span>
              </label>
            ))
          )}
          <div className="mt-2 flex justify-end">
            <Button onClick={() => clean('cache', { kind: 'cache', ids: [...picked] })} disabled={!picked.size || busy !== null}>
              {busy === 'cache' ? <Loader2 className="animate-spin" /> : <Eraser />} Bersihkan cache terpilih ({fmtBytes(cacheTotal)})
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hasil generate per proyek</CardTitle>
          <CardDescription>
            Urut dari yang paling besar. "File sementara" hanya membuang frame render; "Hapus" membuang seluruh folder proyek termasuk video jadinya (project di aplikasi tetap ada).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {!scan ? (
            <Loader2 className="animate-spin text-muted-foreground" />
          ) : scan.projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada hasil generate di laptop ini.</p>
          ) : (
            scan.projects.map((p) => {
              const key = `${p.engine}:${p.slug}`;
              return (
                <div key={key} className="flex flex-wrap items-center gap-3 rounded-md border p-2.5 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium" title={p.slug}>
                      {p.slug}
                    </span>
                    <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary">{SOURCE[p.engine] ?? p.engine}</Badge>
                      {p.videos} video · {formatDate(p.mtime)}
                      {p.tempBytes > 0 && <span>· sementara {fmtBytes(p.tempBytes)}</span>}
                      {p.busy && <span className="text-warning">· Claude sedang bekerja</span>}
                    </span>
                  </span>
                  <span className="w-20 text-right font-medium tabular-nums">{fmtBytes(p.bytes)}</span>
                  <span className="flex gap-1">
                    {p.kind === 'skill' && (
                      <Button size="sm" variant="ghost" title="Buka folder" onClick={() => window.anima.openPath(`${p.dir}`)}>
                        <FolderOpen />
                      </Button>
                    )}
                    {p.tempBytes > 0 && (
                      <Button size="sm" variant="outline" disabled={p.busy || busy !== null} onClick={() => clean(key + ':temp', { kind: 'project', engine: p.engine, slug: p.slug, mode: 'temp' })}>
                        {busy === key + ':temp' ? <Loader2 className="animate-spin" /> : <Eraser />} File sementara
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      disabled={p.busy || busy !== null}
                      onClick={() =>
                        clean(
                          key,
                          p.kind === 'render' ? { kind: 'render', slug: p.slug } : { kind: 'project', engine: p.engine, slug: p.slug, mode: 'all' },
                          `Hapus semua file "${p.slug}" (${fmtBytes(p.bytes)}), termasuk ${p.videos} video jadinya? Tidak bisa dikembalikan.`,
                        )
                      }
                    >
                      {busy === key ? <Loader2 className="animate-spin" /> : <Trash2 />} Hapus
                    </Button>
                  </span>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </>
  );
}
