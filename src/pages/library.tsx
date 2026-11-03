import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Film, FolderOpen, Loader2, Play, RefreshCw, Search } from 'lucide-react';
import { toast } from 'sonner';
import { PageBody, PageHeader } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge, Skeleton } from '@/components/ui/misc';
import { listProjects } from '@/lib/api';
import { cleanErr } from '@/lib/tasks';
import type { Project } from '@/lib/types';
import { cn, formatDate, slugify } from '@/lib/utils';

type Video = Awaited<ReturnType<typeof window.anima.libraryScan>>[number];

const SOURCES: Record<string, string> = {
  render: 'Render HyperForge',
  studio: 'HyperForge Studio',
  animate: 'Animate',
  'bang-motion': 'Bang Motion',
  animantra: 'Animantra',
};

/** Gambar mini dibuat sekali lalu diingat selama aplikasi terbuka. */
const thumbCache = new Map<string, Promise<string | null>>();
const thumbOf = (v: Video) => {
  const key = `${v.file}|${v.mtime}|${v.thumbnail ?? ''}`;
  if (!thumbCache.has(key)) thumbCache.set(key, window.anima.libraryThumb(v.file).catch(() => null));
  return thumbCache.get(key)!;
};

export default function LibraryPage() {
  const [videos, setVideos] = useState<Video[] | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [filter, setFilter] = useState('');
  const [source, setSource] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setVideos(await window.anima.libraryScan());
    } catch (e) {
      toast.error('Gagal membaca folder video', { description: cleanErr(e) });
      setVideos([]);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    load();
    listProjects().then(setProjects).catch(() => {});
  }, [load]);

  // Video dicocokkan ke project lewat nama folder/file (slug judul project).
  const bySlug = useMemo(() => new Map(projects.map((p) => [slugify(p.title), p])), [projects]);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const v of videos ?? []) c[v.source] = (c[v.source] ?? 0) + 1;
    return c;
  }, [videos]);
  const shown = videos?.filter((v) => {
    if (source && v.source !== source) return false;
    const p = bySlug.get(v.slug);
    return `${p?.title ?? ''} ${v.slug} ${v.name} ${v.folder}`.toLowerCase().includes(filter.toLowerCase());
  });
  const totalMb = (videos ?? []).reduce((n, v) => n + v.size, 0) / 1024 / 1024;

  return (
    <>
      <PageHeader
        title="Pustaka Video"
        description="Semua video yang sudah jadi, dari render HyperForge dan dari skill (Studio, Animate, Bang Motion, Animantra). Klik folder untuk langsung membukanya di Explorer."
        actions={
          <Button variant="outline" onClick={load} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />} Muat ulang
          </Button>
        }
      />
      <PageBody>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Cari judul, nama file, atau folder..." value={filter} onChange={(e) => setFilter(e.target.value)} className="pl-9" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {['', ...Object.keys(SOURCES)].map((k) =>
              k && !counts[k] ? null : (
                <Button key={k || 'semua'} size="sm" variant={source === k ? 'default' : 'outline'} onClick={() => setSource(k)}>
                  {k ? SOURCES[k] : 'Semua'} <span className="opacity-70">{k ? counts[k] : (videos?.length ?? 0)}</span>
                </Button>
              ),
            )}
          </div>
          {videos && videos.length > 0 && <span className="ml-auto text-xs text-muted-foreground">Total {totalMb >= 1024 ? `${(totalMb / 1024).toFixed(1)} GB` : `${totalMb.toFixed(0)} MB`}</span>}
        </div>

        {!shown ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <div className="grid place-items-center gap-3 rounded-xl border border-dashed py-16 text-center">
            <Film className="size-10 text-muted-foreground/50" />
            <div>
              <div className="font-medium">{videos?.length ? 'Tidak ada yang cocok' : 'Belum ada video jadi'}</div>
              <div className="text-sm text-muted-foreground">{videos?.length ? 'Coba kata kunci atau sumber lain.' : 'Video muncul di sini setelah render atau skill selesai membuat MP4.'}</div>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((v) => (
              <VideoCard key={v.file} v={v} project={bySlug.get(v.slug)} />
            ))}
          </div>
        )}
      </PageBody>
    </>
  );
}

function VideoCard({ v, project }: { v: Video; project?: Project }) {
  const [thumb, setThumb] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    thumbOf(v).then((t) => alive && setThumb(t));
    return () => {
      alive = false;
    };
  }, [v]);

  const showFolder = () => window.anima.libraryShowFile(v.file).catch((e) => toast.error(cleanErr(e)));

  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border bg-card">
      <button type="button" title="Putar video" onClick={() => window.anima.openPath(v.file)} className="relative aspect-video overflow-hidden bg-muted">
        {thumb ? (
          <img src={thumb} alt="" className="size-full object-contain transition-transform duration-300 group-hover:scale-105" />
        ) : thumb === undefined ? (
          <Loader2 className="absolute inset-0 m-auto size-6 animate-spin text-muted-foreground" />
        ) : (
          <Film className="absolute inset-0 m-auto size-8 text-muted-foreground" />
        )}
        <span className="absolute inset-0 grid place-items-center bg-black/0 opacity-0 transition group-hover:bg-black/35 group-hover:opacity-100">
          <span className="grid size-12 place-items-center rounded-full bg-primary text-primary-foreground">
            <Play className="size-5" />
          </span>
        </span>
      </button>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary">{SOURCES[v.source] ?? v.source}</Badge>
          {v.name === 'share.mp4' && <Badge variant="success">untuk diunggah</Badge>}
          {/tanpa_musik/i.test(v.name) && <Badge variant="outline">tanpa musik</Badge>}
          {/^uji/i.test(v.name) && <Badge variant="warning">render uji</Badge>}
          {v.thumbnail && (
            <button type="button" title={`Buka thumbnail: ${v.thumbnail}`} onClick={() => window.anima.openPath(v.thumbnail!)}>
              <Badge variant="success">ada thumbnail</Badge>
            </button>
          )}
        </div>
        <div className="min-w-0">
          {project ? (
            <Link to={`/projects/${project.id}`} className="line-clamp-1 font-semibold hover:text-primary">
              {project.title}
            </Link>
          ) : (
            <div className="line-clamp-1 font-semibold">{v.slug}</div>
          )}
          <div className="truncate font-mono text-xs text-muted-foreground" title={v.name}>
            {v.name}
          </div>
        </div>
        <button
          type="button"
          onClick={showFolder}
          title={`Buka folder: ${v.folder}`}
          className={cn('flex items-start gap-2 rounded-md border bg-muted/40 p-2 text-left text-xs transition-colors hover:border-primary/60 hover:bg-accent/40')}
        >
          <FolderOpen className="mt-0.5 size-4 shrink-0 text-primary" />
          <span className="line-clamp-2 font-mono break-all text-muted-foreground">{v.folder}</span>
        </button>
        <div className="mt-auto flex items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
          <span>
            {(v.size / 1024 / 1024).toFixed(1)} MB · {formatDate(v.mtime)}
          </span>
          <span className="flex gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="size-8"
              title="Salin lokasi file"
              onClick={() => {
                navigator.clipboard.writeText(v.file);
                toast.success('Lokasi file disalin');
              }}
            >
              <Copy />
            </Button>
            <Button size="sm" variant="outline" onClick={showFolder}>
              <FolderOpen /> Buka folder
            </Button>
          </span>
        </div>
      </div>
    </div>
  );
}
