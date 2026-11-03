import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight, Clock, Film, FolderKanban, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { PageBody, PageHeader } from '@/components/layout';
import { ProjectBadge } from '@/components/status';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
import { Badge, Label, Skeleton } from '@/components/ui/misc';
import { CONTENT_TYPES, contentType, type ContentTypeId } from '@/lib/content';
import { is2D, isSkill, styleImage, visualStyle, type VisualStyleId } from '@/lib/styles';
import { StylePicker } from '@/components/style-picker';
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
                className="group flex flex-col overflow-hidden rounded-xl border bg-card transition-colors hover:border-primary/60 hover:bg-accent/30"
              >
                <div className="relative h-28 overflow-hidden bg-muted">
                  {styleImage(p.visual_style) ? (
                    <img src={styleImage(p.visual_style)} alt="" loading="lazy" className="size-full object-cover object-center opacity-90 transition-transform duration-300 group-hover:scale-105" />
                  ) : (
                    <Film className="m-auto mt-9 size-8 text-muted-foreground" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-card/10 to-transparent" />
                  <div className="absolute top-2.5 right-2.5">
                    <ProjectBadge status={p.status} />
                  </div>
                </div>
                <div className="flex flex-1 flex-col px-5 pb-5">
                <div className="mt-1 text-[11px] font-semibold tracking-wider text-primary uppercase">
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
                </div>
              </Link>
            ))}
          </div>
        )}
      </PageBody>
    </>
  );
}

const STEPS = ['Jenis konten', 'Style video', 'Detail'] as const;

/** Project baru dalam 3 langkah, supaya isian tidak menumpuk di satu popup. */
function NewProjectDialog() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [seconds, setSeconds] = useState(60);
  const [kind, setKind] = useState<ContentTypeId>('karangan');
  const [style, setStyle] = useState<VisualStyleId>('sinema');
  const [format, setFormat] = useState<'9:16' | '16:9'>('9:16');
  const [busy, setBusy] = useState(false);
  const two = is2D(style) || isSkill(style);
  // Semua style sampai 5 menit; Kartun 3D tetap paling lama dirender.
  const max = 300;
  const st = visualStyle(style);

  function reset(o: boolean) {
    setOpen(o);
    if (o) setStep(0);
  }

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (step < STEPS.length - 1) return setStep(step + 1);
    if (!title.trim()) return toast.error('Judul wajib diisi.');
    setBusy(true);
    try {
      const p = await createProject({
        title: title.trim(),
        topic: topic.trim(),
        target_seconds: Math.min(seconds, max),
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
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Project baru
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[92vh] flex-col sm:max-w-3xl">
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Project baru</DialogTitle>
            <DialogDescription>
              Langkah {step + 1} dari 3 · {STEPS[step]}
            </DialogDescription>
          </DialogHeader>
          <ol className="flex items-center gap-2">
            {STEPS.map((label, i) => (
              <li key={label} className="flex flex-1 items-center gap-2">
                <button
                  type="button"
                  disabled={i > step}
                  onClick={() => setStep(i)}
                  className={cn(
                    'grid size-7 shrink-0 place-items-center rounded-full border text-xs font-bold',
                    i < step ? 'border-primary bg-primary text-primary-foreground' : i === step ? 'border-primary text-primary' : 'text-muted-foreground',
                  )}
                >
                  {i < step ? <Check className="size-4" /> : i + 1}
                </button>
                <span className={cn('truncate text-xs', i === step ? 'font-medium text-foreground' : 'text-muted-foreground')}>{label}</span>
                {i < STEPS.length - 1 && <span className={cn('h-px flex-1', i < step ? 'bg-primary' : 'bg-border')} />}
              </li>
            ))}
          </ol>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {step === 0 && (
              <div className="grid gap-2">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {CONTENT_TYPES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setKind(t.id)}
                      className={cn('flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors hover:border-primary/60', kind === t.id && 'border-primary bg-primary/10 ring-1 ring-primary/40')}
                    >
                      <span className="text-sm font-medium">{t.label}</span>
                      <span className="line-clamp-3 text-[11px] leading-snug text-muted-foreground">{t.description}</span>
                      <span className="mt-auto flex flex-wrap gap-1 pt-1">
                        {t.needsSources && <Badge variant="warning">Wajib sumber</Badge>}
                        {t.twoVoices && <Badge variant="secondary">2 suara</Badge>}
                      </span>
                    </button>
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">Semua jenis otomatis dibuatkan hook di 3 detik pertama supaya penonton bertahan sampai habis.</span>
              </div>
            )}

            {step === 1 && <StylePicker value={style} onChange={setStyle} />}

            {step === 2 && (
              <div className="grid gap-4">
                <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-2.5 text-sm">
                  {styleImage(style) && <img src={styleImage(style)} alt="" className="h-14 w-11 rounded object-cover" />}
                  <div className="min-w-0">
                    <div className="font-medium">
                      {contentType(kind).label} · {st.label}
                    </div>
                    <button type="button" className="text-xs text-primary hover:underline" onClick={() => setStep(1)}>
                      Ganti style
                    </button>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="title">Judul</Label>
                  <Input id="title" autoFocus required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="mis. Kenapa langit berwarna biru" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="topic">Topik / ide cerita</Label>
                  <Textarea id="topic" rows={3} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Ceritakan singkat isinya, sudut pandang, atau hal yang wajib ada..." />
                </div>
                {two && (
                  <div className="grid gap-2">
                    <Label>Format</Label>
                    <div className="flex flex-wrap gap-2">
                      {(['9:16', '16:9'] as const).map((f) => (
                        <Button key={f} type="button" variant={format === f ? 'default' : 'outline'} onClick={() => setFormat(f)}>
                          {f === '9:16' ? 'Tegak 9:16 (Shorts/TikTok/Reels)' : 'Landscape 16:9 (YouTube)'}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid gap-2">
                  <Label htmlFor="sec">Durasi target: {Math.min(seconds, max)} detik</Label>
                  <input id="sec" type="range" min={20} max={max} step={5} value={Math.min(seconds, max)} onChange={(e) => setSeconds(Number(e.target.value))} className="accent-primary" />
                  <span className="text-xs text-muted-foreground">{Math.min(seconds, max) > 60 ? `${Math.floor(Math.min(seconds, max) / 60)} menit ${Math.min(seconds, max) % 60 ? `${Math.min(seconds, max) % 60} detik ` : ''}cocok untuk YouTube; Shorts/Reels maksimal 60 detik (TikTok sampai 3 menit). ` : 'Untuk Shorts/Reels/TikTok, 30 sampai 60 detik paling aman. '}{two ? 'Video panjang butuh lebih banyak kredit suara dan waktu Claude.' : `Kartun 3D paling lama dirender (perkiraan ${Math.max(1, Math.round((Math.min(seconds, max) * 30 * 1.6) / 60))} menit di laptop ini).`}</span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 border-t pt-3">
            {step > 0 && (
              <Button type="button" variant="ghost" onClick={() => setStep(step - 1)}>
                <ChevronLeft /> Kembali
              </Button>
            )}
            <Button type="submit" disabled={busy || (step === 2 && !title.trim())}>
              {step < 2 ? (
                <>
                  Lanjut <ChevronRight />
                </>
              ) : busy ? (
                'Membuat...'
              ) : (
                'Buat project'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
