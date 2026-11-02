import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Clapperboard, Copy, FileText, Film, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageBody, PageHeader } from '@/components/layout';
import { ProjectBadge } from '@/components/status';
import { ShotEditor } from '@/components/shot-editor';
import { JobTable } from '@/components/job-table';
import { VoicePanel } from '@/components/voice-panel';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import {
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
import { deleteProject, getProject, listJobs, listShots, updateProject } from '@/lib/api';
import { onRender, queueRender } from '@/lib/render';
import type { Project, ProjectStatus, RenderJob, Shot } from '@/lib/types';
import { WORDS_PER_SECOND, countWords, formatSeconds, framesToSeconds } from '@/lib/utils';

export default function ProjectDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);

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
        description={project.topic || 'Tanpa topik'}
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
      <Tabs defaultValue="brief">
        <TabsList>
          <TabsTrigger value="brief">
            <FileText /> Brief & Script
          </TabsTrigger>
          <TabsTrigger value="shots">
            <Film /> Shot ({shots.length})
          </TabsTrigger>
          <TabsTrigger value="render">
            <Clapperboard /> Render
          </TabsTrigger>
        </TabsList>
        <TabsContent value="brief">
          <BriefTab project={project} onSaved={setProject} />
        </TabsContent>
        <TabsContent value="shots">
          <ShotEditor projectId={project.id} shots={shots} onChange={reloadShots} />
        </TabsContent>
        <TabsContent value="render">
          <RenderTab project={project} shots={shots} onProject={setProject} />
        </TabsContent>
      </Tabs>
      </PageBody>
    </>
  );
}

function BriefTab({ project, onSaved }: { project: Project; onSaved: (p: Project) => void }) {
  const [draft, setDraft] = useState(project);
  const [busy, setBusy] = useState(false);
  useEffect(() => setDraft(project), [project]);

  const words = countWords(draft.script);
  const estSeconds = words / WORDS_PER_SECOND;
  const dirty = JSON.stringify(draft) !== JSON.stringify(project);

  async function save() {
    setBusy(true);
    try {
      onSaved(
        await updateProject(project.id, {
          title: draft.title,
          topic: draft.topic,
          target_seconds: draft.target_seconds,
          composition: draft.composition,
          script: draft.script,
          status: draft.status,
        }),
      );
      toast.success('Tersimpan');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Prompt pendek: Claude cukup diberi ID project, detailnya diambil sendiri lewat MCP (hemat token).
  const prompt = `Pakai skill cartoon-3d-short. Ambil brief dengan tool anima_get_project id "${project.id}", tulis script ${project.target_seconds} detik (~${Math.round(
    project.target_seconds * WORDS_PER_SECOND,
  )} kata) dan shot list, lalu simpan dengan anima_save_story. Balas cukup "selesai" + jumlah shot.`;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Card>
        <CardContent className="flex flex-col gap-4 p-5">
          <div className="grid gap-2">
            <Label htmlFor="t">Judul</Label>
            <Input id="t" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="topic">Topik / ide cerita</Label>
            <Textarea id="topic" value={draft.topic} onChange={(e) => setDraft({ ...draft, topic: e.target.value })} />
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
          <div className="flex justify-end">
            <Button onClick={save} disabled={busy || !dirty}>
              {busy ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        <Card>
          <CardContent className="flex flex-col gap-4 p-5">
            <div className="grid gap-2">
              <Label htmlFor="sec">Durasi target (detik)</Label>
              <Input id="sec" type="number" min={15} max={180} value={draft.target_seconds} onChange={(e) => setDraft({ ...draft, target_seconds: Number(e.target.value) })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="comp">Nama komposisi Remotion</Label>
              <Input id="comp" value={draft.composition} onChange={(e) => setDraft({ ...draft, composition: e.target.value })} />
            </div>
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
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Prompt untuk Claude</CardTitle>
            <CardDescription>
              Tempel di Claude Code atau Claude Desktop yang sudah tersambung (Pengaturan &gt; Integrasi Claude). Pendek supaya hemat token.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="rounded-md bg-muted p-3 font-mono text-xs leading-relaxed">{prompt}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(prompt);
                toast.success('Prompt disalin');
              }}
            >
              <Copy /> Salin prompt
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
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

  async function start() {
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

  return (
    <div className="flex flex-col gap-4">
      <VoicePanel project={project} shots={shots} />
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="text-sm">
            <div>
              <span className="font-medium">{shots.length} shot</span>, total {formatSeconds(totalSec)} (target {project.target_seconds} dtk)
            </div>
            <div className="mt-1 text-muted-foreground">
              Render berjalan di laptop ini dengan mode hemat (1 proses). Laptop boleh dipakai ringan, tapi akan terasa lebih lambat.
            </div>
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
