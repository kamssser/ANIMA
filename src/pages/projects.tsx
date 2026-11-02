import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Clock, Film, FolderKanban, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { PageBody, PageHeader } from '@/components/layout';
import { ProjectBadge } from '@/components/status';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
import { Badge, Label, Skeleton } from '@/components/ui/misc';
import { CONTENT_TYPES, contentType, type ContentTypeId } from '@/lib/content';
import { VISUAL_STYLES, is2D, visualStyle, type VisualStyleId } from '@/lib/styles';
import { cn } from '@/lib/utils';
import { createProject, listProjects } from '@/lib/api';
import type { Project } from '@/lib/types';
import { formatDate } from '@/lib/utils';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    listProjects()
      .then(setProjects)
      .catch((e) => {
        toast.error(e.message);
        setProjects([]);
      });
  }, []);

  const shown = projects?.filter((p) => `${p.title} ${p.topic}`.toLowerCase().includes(filter.toLowerCase()));

  return (
    <>
      <PageHeader title="Project" description="Satu project = satu video pendek." actions={<NewProjectDialog />} />
      <PageBody>
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Cari judul atau topik..." value={filter} onChange={(e) => setFilter(e.target.value)} className="pl-9" />
        </div>
        {!shown ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <div className="grid place-items-center gap-3 rounded-xl border border-dashed py-16 text-center">
            <FolderKanban className="size-10 text-muted-foreground/50" />
            <div>
              <div className="font-medium">{filter ? 'Tidak ada yang cocok' : 'Belum ada project'}</div>
              <div className="text-sm text-muted-foreground">{filter ? 'Coba kata kunci lain.' : 'Klik "Project baru" untuk mulai video pertamamu.'}</div>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((p) => (
              <Link
                key={p.id}
                to={`/projects/${p.id}`}
                className="group flex flex-col rounded-xl border bg-card p-5 transition-colors hover:border-primary/60 hover:bg-accent/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
                    <Film className="size-5" />
                  </div>
                  <ProjectBadge status={p.status} />
                </div>
                <div className="mt-4 text-[11px] font-semibold tracking-wider text-primary uppercase">
                  {contentType(p.content_type).label} · {visualStyle(p.visual_style).label}
                  {is2D(p.visual_style) && p.format === '16:9' ? ' · 16:9' : ''}
                </div>
                <div className="mt-1 line-clamp-1 font-semibold group-hover:text-primary">{p.title}</div>
                <div className="mt-1 line-clamp-2 min-h-10 text-sm text-muted-foreground">{p.topic || 'Tanpa topik'}</div>
                <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Clock className="size-3.5" /> {p.target_seconds} detik
                  </span>
                  <span>{formatDate(p.updated_at)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </PageBody>
    </>
  );
}

function NewProjectDialog() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [seconds, setSeconds] = useState(60);
  const [kind, setKind] = useState<ContentTypeId>('karangan');
  const [style, setStyle] = useState<VisualStyleId>('kartun-3d');
  const [format, setFormat] = useState<'9:16' | '16:9'>('9:16');
  const [busy, setBusy] = useState(false);
  const two = is2D(style);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const p = await createProject({
        title: title.trim(),
        topic: topic.trim(),
        target_seconds: Math.min(seconds, two ? 180 : 90),
        content_type: kind,
        // Kolom style/format baru ada setelah migrasi 003; project 3D 9:16 tidak perlu mengirimnya.
        ...(style !== 'kartun-3d' || format !== '9:16' ? { visual_style: style, format: two ? format : '9:16' } : {}),
      });
      setOpen(false);
      navigate(`/projects/${p.id}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Project baru
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Project baru</DialogTitle>
            <DialogDescription>Pilih jenis konten dan isi ide singkat. Hook, script, dan shot nanti dibuat Claude.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label>Jenis konten</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {CONTENT_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setKind(t.id)}
                  className={cn(
                    'flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors hover:border-primary/60',
                    kind === t.id && 'border-primary bg-primary/10 ring-1 ring-primary/40',
                  )}
                >
                  <span className="text-sm font-medium">{t.label}</span>
                  <span className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">{t.description}</span>
                  <span className="mt-auto flex flex-wrap gap-1 pt-1">
                    {t.needsSources && <Badge variant="warning">Wajib sumber</Badge>}
                    {t.twoVoices && <Badge variant="secondary">2 suara</Badge>}
                  </span>
                </button>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">Semua jenis otomatis dibuatkan hook di 3 detik pertama supaya penonton bertahan sampai habis.</span>
          </div>
          <div className="grid gap-2">
            <Label>Style video</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {VISUAL_STYLES.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setStyle(v.id)}
                  className={cn(
                    'flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors hover:border-primary/60',
                    style === v.id && 'border-primary bg-primary/10 ring-1 ring-primary/40',
                  )}
                >
                  <span className="text-sm font-medium">{v.label}</span>
                  <span className="mt-auto pt-1">
                    <Badge variant={v.kind === '3d' ? 'warning' : 'success'}>{v.kind === '3d' ? 'Render lama' : 'Render cepat'}</Badge>
                  </span>
                </button>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">
              {visualStyle(style).description}
              {two && ' Memakai karakter dari Pengaturan > Karakter.'}
            </span>
          </div>
          {two && (
            <div className="grid gap-2">
              <Label>Format</Label>
              <div className="flex gap-2">
                {(['9:16', '16:9'] as const).map((f) => (
                  <Button key={f} type="button" variant={format === f ? 'default' : 'outline'} onClick={() => setFormat(f)}>
                    {f === '9:16' ? 'Tegak 9:16 (Shorts/TikTok/Reels)' : 'Landscape 16:9 (YouTube)'}
                  </Button>
                ))}
              </div>
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="title">Judul</Label>
            <Input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="The Bridge That Fell for a Song" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="topic">Topik / ide cerita</Label>
            <Textarea id="topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Jembatan tua yang jatuh cinta pada lagu pengamen..." />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sec">Durasi target: {Math.min(seconds, two ? 180 : 90)} detik</Label>
            <input
              id="sec"
              type="range"
              min={30}
              max={two ? 180 : 90}
              step={5}
              value={Math.min(seconds, two ? 180 : 90)}
              onChange={(e) => setSeconds(Number(e.target.value))}
              className="accent-primary"
            />
            <span className="text-xs text-muted-foreground">
              {two ? 'Video 2D bisa sampai 3 menit.' : 'Skill cartoon-3d-short ideal di 55 sampai 70 detik.'}
            </span>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy || !title.trim()}>
              {busy ? 'Membuat...' : 'Buat project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
