import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, BookOpen, Bot, Clapperboard, Copy, FileText, Film, Image, Loader2, Sparkles, Trash2, X, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { PageBody, PageHeader } from '@/components/layout';
import { ProjectBadge } from '@/components/status';
import { ShotEditor } from '@/components/shot-editor';
import { JobTable } from '@/components/job-table';
import { VoicePanel, useVoiceStatus } from '@/components/voice-panel';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/misc';
import { deleteProject, getProject, listCharacters, listJobs, listShots, updateProject } from '@/lib/api';
import { onRender, queueRender } from '@/lib/render';
import { sb } from '@/lib/supabase';
import type { Project, ProjectStatus, RenderJob, Shot } from '@/lib/types';
import { WORDS_PER_SECOND, cn, countWords, formatSeconds, framesToSeconds } from '@/lib/utils';
import { CONTENT_TYPES, buildPrompt, contentType } from '@/lib/content';
import { is2D, isSkill, styleImage, visualStyle, type VisualStyleId } from '@/lib/styles';
import { StylePicker } from '@/components/style-picker';
import { SkillPanel, SkillRenders } from '@/components/skill-video';
import { SkillChat } from '@/components/skill-chat';
import { cleanErr, runTask, usePersisted, useRunningTasks, useTask, useTaskFinished } from '@/lib/tasks';

export default function ProjectDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  // Tab terakhir per project tetap diingat saat pindah halaman lalu kembali.
  const [tab, setTab] = usePersisted(`project-tab:${id}`, 'brief');

  const reloadShots = useCallback(() => listShots(id).then(setShots).catch((e) => toast.error(e.message)), [id]);

  useEffect(() => {
    getProject(id)
      .then(setProject)
      .catch((e) => {
        toast.error(e.message);
        navigate('/projects');
      });
    reloadShots();
  }, [id, navigate, reloadShots]);

  if (!project) return <Skeleton className="m-6 h-40" />;

  return (
    <>
      <PageHeader
        title={project.title}
        description={`${contentType(project.content_type).label} · ${visualStyle(project.visual_style).label}${is2D(project.visual_style) || isSkill(project.visual_style) ? ` ${project.format || '9:16'}` : ''} · ${project.topic || 'Tanpa topik'}`}
        actions={
          <>
            <ProjectBadge status={project.status} />
            <Button
              variant="ghost"
              size="icon"
              title="Hapus project"
              onClick={async () => {
                if (!window.confirm(`Hapus project "${project.title}" beserta semua shot dan riwayat render?`)) return;
                await deleteProject(project.id);
                toast.success('Project dihapus');
                navigate('/projects');
              }}
            >
              <Trash2 />
            </Button>
          </>
        }
      />
      <PageBody>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="brief">
            <FileText /> Brief & Script
          </TabsTrigger>
          {isSkill(project.visual_style) ? (
            <TabsTrigger value="claude">
              <Bot /> Claude
            </TabsTrigger>
          ) : (
            <TabsTrigger value="shots">
              <Film /> Shot ({shots.length})
            </TabsTrigger>
          )}
          <TabsTrigger value="render">
            <Clapperboard /> Render
          </TabsTrigger>
        </TabsList>
        <TabsContent value="brief">
          <BriefTab
            project={project}
            onSaved={setProject}
            onGenerated={async () => {
              setProject(await getProject(project.id));
              await reloadShots();
            }}
          />
        </TabsContent>
        {isSkill(project.visual_style) && (
          <TabsContent value="claude">
            <SkillChat project={project} beforeRun={async () => project} />
          </TabsContent>
        )}
        <TabsContent value="shots">
          <ShotEditor projectId={project.id} shots={shots} onChange={reloadShots} twoVoices={contentType(project.content_type).twoVoices} />
        </TabsContent>
        <TabsContent value="render">
          <RenderTab project={project} shots={shots} onProject={setProject} />
        </TabsContent>
      </Tabs>
      </PageBody>
    </>
  );
}

function GeneratePanel({ project, onDone, beforeRun }: { project: Project; onDone: () => Promise<void>; beforeRun: () => Promise<Project> }) {
  // Status generate disimpan global: tetap terlihat walau pengguna pindah halaman lalu kembali.
  const key = `claude:${project.id}`;
  const task = useTask(key);
  const running = Boolean(task?.running);
  const log = task?.log ?? [];
  const other = useRunningTasks().find(([k]) => k.startsWith('claude:') && k !== key)?.[1];
  const t = contentType(project.content_type);

  // Muat ulang hook/script/shot saat generate selesai (juga kalau selesai ketika halaman ini sedang ditutup).
  useTaskFinished(key, (t) => !t.error && onDone().catch(() => {}));

  async function run() {
    if (other) {
      toast.error('Claude sedang menulis project lain', { description: `"${String(other.data)}". Tunggu selesai dulu, atau batalkan di project itu.` });
      return;
    }
    if (is2D(project.visual_style)) {
      // Style 2D wajib punya karakter utama tersimpan; cek dulu supaya Claude tidak bekerja sia-sia.
      const chars = await listCharacters().catch(() => []);
      if (!chars.some((c) => c.is_main && c.svg)) {
        toast.error('Belum ada karakter utama yang tersimpan', {
          description: 'Buka Pengaturan > Karakter, generate karakter utama, lalu klik "Simpan karakter". Setelah itu Generate lagi.',
          duration: 10000,
        });
        return;
      }
    }
    if (project.script.trim() && !window.confirm('Script dan shot yang sekarang akan diganti hasil baru dari Claude. Lanjutkan?')) return;
    const title = project.title;
    runTask(key, { label: `Claude menulis: ${title}`, href: `/projects/${project.id}`, step: 'Menyiapkan...', data: title }, async () => {
      // Simpan perubahan brief dulu (jenis konten, topik, durasi) supaya Claude membaca versi terbaru.
      const fresh = await beforeRun();
      // Pinjamkan sesi login aplikasi ke Claude; perpanjang dulu kalau sisa umurnya < 30 menit.
      let { data } = await sb().auth.getSession();
      if (!data.session || (data.session.expires_at ?? 0) * 1000 < Date.now() + 30 * 60 * 1000) {
        data = (await sb().auth.refreshSession()).data;
      }
      if (!data.session) throw new Error('Sesi login habis. Keluar lalu masuk lagi.');
      return window.anima.generateWithClaude({
        projectId: fresh.id,
        prompt: buildPrompt(fresh),
        style: is2D(fresh.visual_style) ? visualStyle(fresh.visual_style).id : undefined,
        session: { access_token: data.session.access_token, expires_at: data.session.expires_at ?? 0 },
      });
    }).then(
      () => toast.success(`Claude selesai menulis "${title}"`, { description: 'Hook, script, dan shot sudah tersimpan.' }),
      (e) => toast.error(`Generate "${title}" gagal`, { description: cleanErr(e) }),
    );
  }

  const prompt = buildPrompt(project);

  return (
    <Card className="border-primary/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Sparkles className="size-4 text-primary" /> Generate dengan Claude
        </CardTitle>
        <CardDescription>
          Claude menulis hook, script, dan shot sesuai jenis <b>{t.label}</b>
          {t.needsSources ? ', setelah riset sumber di web' : ''}
          {t.twoVoices ? ', dengan dua pembicara (A & B)' : ''}. Memakai langganan Claude kamu, tanpa API key.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {other && !running && (
          <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
            Claude sedang menulis project lain: <b>{String(other.data)}</b>. Tombol Generate aktif lagi setelah itu selesai.
          </div>
        )}
        <Button onClick={run} disabled={running || Boolean(other)}>
          {running ? <Loader2 className="animate-spin" /> : <Sparkles />} {running ? 'Claude sedang menulis...' : 'Generate hook + script + shot'}
        </Button>
        {running && (
          <>
            <div className="grid gap-1 rounded-md bg-muted p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
              {(log.length ? log : ['Menyiapkan...']).map((l, i) => (
                <div key={i} className={cn('truncate', i === log.length - 1 && 'text-foreground')}>
                  {l}
                </div>
              ))}
            </div>
            <Button variant="ghost" size="sm" onClick={() => window.anima.cancelGenerate()}>
              <X /> Batalkan
            </Button>
          </>
        )}
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none">Pakai Claude Desktop / manual (salin prompt)</summary>
          <p className="mt-2 rounded-md bg-muted p-3 font-mono leading-relaxed whitespace-pre-line">{prompt}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => {
              navigator.clipboard.writeText(prompt);
              toast.success('Prompt disalin');
            }}
          >
            <Copy /> Salin prompt
          </Button>
        </details>
      </CardContent>
    </Card>
  );
}

function BriefTab({ project, onSaved, onGenerated }: { project: Project; onSaved: (p: Project) => void; onGenerated: () => Promise<void> }) {
  const [draft, setDraft] = useState(project);
  const [busy, setBusy] = useState(false);
  useEffect(() => setDraft(project), [project]);

  const words = countWords(draft.script);
  const estSeconds = words / WORDS_PER_SECOND;
  const dirty = JSON.stringify(draft) !== JSON.stringify(project);
  const t = contentType(draft.content_type);

  async function persist() {
    const saved = await updateProject(project.id, {
      title: draft.title,
      topic: draft.topic,
      target_seconds: draft.target_seconds,
      composition: draft.composition,
      script: draft.script,
      status: draft.status,
      content_type: draft.content_type || 'karangan',
      hook: draft.hook ?? '',
      // Kolom style/format ada setelah migrasi 003 (project lama tanpa kolom ini tidak mengirimnya).
      ...(project.visual_style !== undefined || draft.visual_style ? { visual_style: draft.visual_style || 'kartun-3d', format: draft.format || '9:16' } : {}),
    });
    onSaved(saved);
    return saved;
  }

  async function save() {
    setBusy(true);
    try {
      await persist();
      toast.success('Tersimpan');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <Card>
        <CardContent className="flex flex-col gap-4 p-5">
          <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
            <div className="grid gap-2">
              <Label htmlFor="t">Judul</Label>
              <Input id="t" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ct">Jenis konten</Label>
              <NativeSelect id="ct" value={t.id} onChange={(e) => setDraft({ ...draft, content_type: e.target.value })}>
                {CONTENT_TYPES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                    {c.needsSources ? ' (wajib sumber)' : ''}
                    {c.twoVoices ? ' (2 suara)' : ''}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="topic">Topik / ide cerita</Label>
            <Textarea id="topic" value={draft.topic} onChange={(e) => setDraft({ ...draft, topic: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="hook" className="flex items-center gap-2">
              <Zap className="size-4 text-primary" /> Hook (0-3 detik pertama)
            </Label>
            <Textarea
              id="hook"
              className="min-h-14"
              placeholder="Diisi otomatis oleh Claude: kalimat pembuka yang membuat penonton bertahan sampai habis."
              value={draft.hook ?? ''}
              onChange={(e) => setDraft({ ...draft, hook: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="script">Script narasi</Label>
              <span className={`text-xs tabular-nums ${Math.abs(estSeconds - draft.target_seconds) > 8 ? 'text-warning' : 'text-muted-foreground'}`}>
                {words} kata, perkiraan {Math.round(estSeconds)} dtk dari target {draft.target_seconds} dtk
              </span>
            </div>
            <Textarea id="script" className="min-h-64 font-mono text-[13px]" value={draft.script} onChange={(e) => setDraft({ ...draft, script: e.target.value })} />
          </div>
          {(t.needsSources || (project.sources?.length ?? 0) > 0) && (
            <div className="grid gap-2">
              <Label className="flex items-center gap-2">
                <BookOpen className="size-4 text-primary" /> Sumber
                {t.needsSources && <Badge variant="warning">Wajib untuk {t.label}</Badge>}
              </Label>
              {project.sources?.length ? (
                <ul className="grid gap-1 rounded-md border p-3 text-sm">
                  {project.sources.map((src, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-muted-foreground">{i + 1}.</span>
                      <button className="truncate text-left text-primary hover:underline" title={src.url} onClick={() => window.anima.openExternal(src.url)}>
                        {src.title || src.url}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  Belum ada sumber. Claude wajib riset dan mengisi minimal 2 sumber saat generate.
                </p>
              )}
            </div>
          )}
          <div className="flex justify-end">
            <Button onClick={save} disabled={busy || !dirty}>
              {busy ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        {isSkill(draft.visual_style) ? <SkillPanel project={draft} beforeRun={persist} /> : <GeneratePanel project={draft} onDone={onGenerated} beforeRun={persist} />}
        <Card>
          <CardContent className="flex flex-col gap-4 p-5">
            <div className="grid gap-2">
              <Label>Style video</Label>
              <StyleField value={draft.visual_style || 'kartun-3d'} onChange={(v) => setDraft({ ...draft, visual_style: v })} />
            </div>
            {(is2D(draft.visual_style) || isSkill(draft.visual_style)) && (
              <div className="grid gap-2">
                <Label htmlFor="fmt">Format</Label>
                <NativeSelect id="fmt" value={draft.format || '9:16'} onChange={(e) => setDraft({ ...draft, format: e.target.value as '9:16' | '16:9' })}>
                  <option value="9:16">Tegak 9:16 (Shorts/TikTok/Reels)</option>
                  <option value="16:9">Landscape 16:9 (YouTube)</option>
                </NativeSelect>
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="sec">Durasi target (detik)</Label>
              <Input id="sec" type="number" min={15} max={180} value={draft.target_seconds} onChange={(e) => setDraft({ ...draft, target_seconds: Number(e.target.value) })} />
            </div>
            {!is2D(draft.visual_style) && !isSkill(draft.visual_style) && (
              <div className="grid gap-2">
                <Label htmlFor="comp">Nama komposisi Remotion</Label>
                <Input id="comp" value={draft.composition} onChange={(e) => setDraft({ ...draft, composition: e.target.value })} />
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="st">Status</Label>
              <NativeSelect id="st" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as ProjectStatus })}>
                <option value="draft">Draft</option>
                <option value="ready">Siap render</option>
                <option value="rendering">Merender</option>
                <option value="done">Selesai</option>
              </NativeSelect>
            </div>
          </CardContent>
        </Card>
        {is2D(project.visual_style) && <AssetsCard project={project} />}
      </div>
    </div>
  );
}

/** Style project: kartu bergambar + popup pemilih tersendiri (tidak menumpuk dengan isian lain). */
function StyleField({ value, onChange }: { value: string; onChange: (v: VisualStyleId) => void }) {
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState(value);
  const st = visualStyle(value);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setPick(value);
          setOpen(true);
        }}
        className="flex items-center gap-3 rounded-lg border p-2 text-left transition-colors hover:border-primary/60"
      >
        {styleImage(st.id) && <img src={styleImage(st.id)} alt="" className="h-16 w-12 shrink-0 rounded object-cover" />}
        <span className="min-w-0">
          <span className="block text-sm font-medium">{st.label}</span>
          <span className="line-clamp-2 text-xs text-muted-foreground">{st.description}</span>
          <span className="text-xs text-primary">Ganti style</span>
        </span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[92vh] flex-col sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Ganti style video</DialogTitle>
            <DialogDescription>Perubahan tersimpan setelah kamu klik Simpan di kartu Brief.</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <StylePicker value={pick} onChange={setPick} />
          </div>
          <DialogFooter className="border-t pt-3">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={() => {
                onChange(pick as VisualStyleId);
                setOpen(false);
              }}
            >
              Pakai style ini
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Style 2D: latar yang digambar Claude + foto referensi yang dipakai (sejarah/fakta). */
function AssetsCard({ project }: { project: Project }) {
  const bgs = Object.entries(project.assets?.backgrounds ?? {});
  const refs = project.assets?.references ?? [];
  const props = Object.entries(project.assets?.props ?? {});
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-5">
        <Label className="flex items-center gap-2">
          <Image className="size-4 text-primary" /> Latar ({bgs.length})
        </Label>
        {bgs.length === 0 ? (
          <p className="text-xs text-muted-foreground">Belum ada latar. Latar digambar Claude saat Generate.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {bgs.map(([k, b]) => (
              <div key={k} title={b.description} className="grid gap-1">
                <div
                  className={cn('overflow-hidden rounded-md border bg-muted [&>svg]:size-full', project.format === '16:9' ? 'aspect-video' : 'aspect-[9/16]')}
                  dangerouslySetInnerHTML={{ __html: b.svg.replace(/<svg\b/, '<svg preserveAspectRatio="xMidYMid slice"') }}
                />
                <span className="truncate text-[11px] text-muted-foreground">{k}</span>
              </div>
            ))}
          </div>
        )}
        {props.length > 0 && (
          <>
            <Label className="mt-2">Benda cerita ({props.length})</Label>
            <div className="grid grid-cols-4 gap-2">
              {props.map(([k, b]) => (
                <div key={k} title={b.description} className="grid gap-1">
                  <div className="aspect-square overflow-hidden rounded-md border bg-muted p-1 [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: b.svg }} />
                  <span className="truncate text-[11px] text-muted-foreground">{k}</span>
                </div>
              ))}
            </div>
          </>
        )}
        {refs.length > 0 && (
          <>
            <Label className="mt-2">Foto referensi</Label>
            <ul className="grid gap-1 text-xs">
              {refs.map((r, i) => (
                <li key={i}>
                  <button className="truncate text-left text-primary hover:underline" title={r.url} onClick={() => window.anima.openExternal(r.url)}>
                    {r.title}
                  </button>
                  {r.license && <span className="text-muted-foreground"> · {r.license}</span>}
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function RenderTab({ project, shots, onProject }: { project: Project; shots: Shot[]; onProject: (p: Project) => void }) {
  const [jobs, setJobs] = useState<RenderJob[]>([]);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => listJobs(project.id).then(setJobs).catch(() => {}), [project.id]);

  useEffect(() => {
    load();
    return onRender((e) => {
      if (e.type === 'progress') {
        setJobs((js) => js.map((j) => (j.id === e.jobId ? { ...j, progress: e.progress, status: 'running' } : j)));
      } else {
        setTimeout(() => {
          load();
          getProject(project.id).then(onProject).catch(() => {});
        }, 500);
      }
    });
  }, [load, project.id, onProject]);

  const totalSec = framesToSeconds(shots.reduce((n, s) => n + s.duration_frames, 0));
  const active = jobs.some((j) => j.status === 'queued' || j.status === 'running');
  const voice = useVoiceStatus(project, shots);
  // Video terakhir lebih lama dari suara / timing kata: perlu render ulang supaya ikut berubah.
  const lastDone = jobs.find((j) => j.status === 'done' && j.finished_at);
  const voiceChangedAt = Math.max(Date.parse(voice.status?.updatedAt ?? '') || 0, Date.parse(voice.status?.wordsEditedAt ?? '') || 0);
  const videoOld = Boolean(lastDone && voiceChangedAt > Date.parse(lastDone.finished_at!));

  async function start() {
    if (!voice.status?.mp3 && !window.confirm('Suara belum dibuat, jadi video akan tanpa suara dan teks tidak mengikuti ucapan. Tetap render?')) return;
    if (voice.stale && !window.confirm('Suara belum mengikuti script terbaru (script atau narasi shot berubah setelah suara dibuat). Suara, teks di layar, dan panjang shot tidak akan cocok. Tetap render?')) return;
    setBusy(true);
    try {
      await queueRender(project);
      toast.success('Masuk antrean render');
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (isSkill(project.visual_style)) {
    return (
      <div className="flex flex-col gap-4">
        <SkillRenders project={project} onImported={load} />
        <Card>
          <CardContent className="p-0">
            <JobTable jobs={jobs} onChanged={load} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <VoicePanel project={project} shots={shots} voice={voice} />
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="text-sm">
            <div>
              <span className="font-medium">{shots.length} shot</span>, total {formatSeconds(totalSec)} (target {project.target_seconds} dtk)
            </div>
            <div className="mt-1 text-muted-foreground">
              Render berjalan di laptop ini dengan mode hemat (1 proses). Laptop boleh dipakai ringan, tapi akan terasa lebih lambat.
            </div>
            {videoOld && !active && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-warning">
                <AlertTriangle className="size-3.5" /> Video terakhir dibuat sebelum suara atau timing kata diubah. Render ulang supaya ikut berubah.
              </div>
            )}
          </div>
          <Button onClick={start} disabled={busy || active || shots.length === 0}>
            <Clapperboard /> {active ? 'Sedang dirender' : 'Render sekarang'}
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <JobTable jobs={jobs} onChanged={load} />
        </CardContent>
      </Card>
    </div>
  );
}
