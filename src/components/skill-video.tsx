// Style dari skill Claude pihak ketiga (animate oleh cth9191, bang-motion oleh Bang Tutorial), dipakai utuh di
// Claude Code. Di sini: Pengaturan > Skill video (kebutuhan + galeri), panel project (buka sesi Claude),
// dan tab Render (ambil video hasil ke daftar render).
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ExternalLink, FolderOpen, Loader2, Play, Sparkles, Terminal, Wand2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Progress } from '@/components/ui/misc';
import { createJob, updateJob } from '@/lib/api';
import { buildAnimateBrief, buildBangBrief, buildStudioBrief } from '@/lib/content';
import { listCharacters } from '@/lib/api';
import { visualStyle } from '@/lib/styles';
import { cleanErr, runTask, setValue, usePersisted, useTask, useTaskFinished } from '@/lib/tasks';
import type { Project, SkillCheck, SkillEngine } from '@/lib/types';
import { cn, formatDate, slugify } from '@/lib/utils';

export const ENGINE_INFO: Record<SkillEngine, { title: string; by: string; flow: string; samplesTitle: string }> = {
  animate: {
    title: 'Animate',
    by: 'cth9191',
    flow: 'Claude bertanya beberapa hal, lalu meminta persetujuanmu untuk story, look (2-4 frame contoh), dan storyboard sebelum menganimasikan dan merender.',
    samplesTitle: '7 style bawaan + "dari referensi saya"',
  },
  'bang-motion': {
    title: 'Bang Motion',
    by: 'Bang Tutorial',
    flow: 'Claude menanyakan yang belum jelas, lalu menunjukkan style brief dan rundown adegan untuk kamu setujui sebelum membangun, memeriksa frame, dan mengekspor MP4.',
    samplesTitle: '6 gaya explainer + opener/promo',
  },
  studio: {
    title: 'HyperForge Studio',
    by: 'HyperForge',
    flow: 'Claude meminta persetujuanmu untuk gaya, karakter, naskah, suara, dan storyboard (satu frame per shot) sebelum merender video dengan subtitle, musik, dan efek suara dari kode.',
    samplesTitle: '10 gaya',
  },
};

const samplesCache: Partial<Record<SkillEngine, Record<string, string>>> = {};
/** Gambar contoh tiap style dari skill. */
export function useSkillSamples(engine: SkillEngine | undefined) {
  const [s, setS] = useState<Record<string, string> | undefined>(engine ? samplesCache[engine] : undefined);
  useEffect(() => {
    if (!engine || samplesCache[engine]) return setS(engine ? samplesCache[engine] : undefined);
    window.anima.skillSamples(engine).then((r) => {
      samplesCache[engine] = r;
      setS(r);
    });
  }, [engine]);
  return s ?? {};
}
/** Gambar contoh semua mesin, kunci "<engine>:<style>". */
export function useAllSkillSamples() {
  const a = useSkillSamples('animate');
  const b = useSkillSamples('bang-motion');
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(a)) out[`animate:${k}`] = v;
  for (const [k, v] of Object.entries(b)) out[`bang-motion:${k}`] = v;
  return out;
}

function useSkillCheck(engine: SkillEngine | undefined) {
  const [c, setC] = useState<SkillCheck | null>(null);
  const refresh = () => (engine ? window.anima.skillCheck(engine).then(setC) : Promise.resolve());
  useEffect(() => {
    setC(null);
    refresh();
  }, [engine]); // eslint-disable-line react-hooks/exhaustive-deps
  return [c, refresh] as const;
}

/** Pengaturan > Skill video: satu kartu per mesin. */
export function SkillSettings() {
  return (
    <>
      <EngineSettings engine="animate" />
      <EngineSettings engine="bang-motion" />
      <EngineSettings engine="studio" />
    </>
  );
}

function EngineSettings({ engine }: { engine: SkillEngine }) {
  const info = ENGINE_INFO[engine];
  const [c, refresh] = useSkillCheck(engine);
  const key = `skill-setup:${engine}`;
  const task = useTask(key);
  const busy = Boolean(task?.running);
  const [optional, setOptional] = usePersisted(`skill:optional:${engine}`, true);
  const samples = useSkillSamples(engine);
  useTaskFinished(key, () => refresh());

  function setup() {
    runTask(key, { label: `Menyiapkan ${info.title}`, href: '/settings', step: 'Mulai' }, () => window.anima.skillSetup({ engine, optional })).then(
      () => toast.success(`${info.title} siap dipakai`),
      (e) => toast.error(`Gagal menyiapkan ${info.title}`, { description: cleanErr(e), duration: 15000 }),
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {info.title} <span className="text-sm font-normal text-muted-foreground">oleh {info.by}</span>
        </CardTitle>
        <CardDescription>
          Skill dipakai utuh di Claude Code. {info.flow}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {!c ? (
          <Loader2 className="animate-spin text-muted-foreground" />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {c.items.map((i) => (
              <div key={i.id} className="flex items-start gap-2 text-sm">
                {i.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /> : <XCircle className={cn('mt-0.5 size-4 shrink-0', i.optional ? 'text-muted-foreground' : 'text-warning')} />}
                <span className="min-w-0">
                  <span className="font-medium">{i.label}</span>
                  {i.detail && (
                    <span className="block truncate text-xs text-muted-foreground" title={i.detail}>
                      {i.detail}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={setup} disabled={busy || !c}>
            {busy ? <Loader2 className="animate-spin" /> : <Wand2 />} {c?.ready ? 'Pasang ulang / perbarui' : 'Siapkan otomatis'}
          </Button>
          {c && c.optionalLabel && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-primary" checked={optional} onChange={(e) => setOptional(e.target.checked)} disabled={busy} />
              {c.optionalLabel}
            </label>
          )}
        </div>
        {busy && task && (
          <div className="grid gap-1 rounded-md border p-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{task.step}...</span>
            {task.log.at(-1) && task.log.at(-1) !== task.step && <span className="truncate font-mono">{task.log.at(-1)}</span>}
            <Progress value={undefined} />
          </div>
        )}
        {Object.keys(samples).length > 0 && (
          <div className="grid gap-1">
            <span className="text-xs text-muted-foreground">{info.samplesTitle} (pilih di Style video project)</span>
            <div className="grid grid-cols-4 gap-2 lg:grid-cols-7">
              {Object.entries(samples).map(([k, src]) => (
                <figure key={k} className="grid gap-1">
                  <img src={src} alt={k} className={cn('w-full rounded-md border object-cover', engine === 'animate' ? 'aspect-[9/16]' : 'aspect-video')} />
                  <figcaption className="truncate text-center text-[11px] text-muted-foreground">{k}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        )}
        {c && (
          <p className="text-xs text-muted-foreground">
            Folder kerja: <span className="font-mono">{c.workDir}</span>. Sumber{' '}
            <button className="text-primary hover:underline" onClick={() => window.anima.openExternal(c.url)}>
              {c.url.replace('https://', '')} <ExternalLink className="inline size-3" />
            </button>{' '}
            (lisensi MIT, commit {c.commit.slice(0, 7)}), tidak diubah.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** Panel di tab Brief untuk project style skill. */
export function SkillPanel({ project, beforeRun }: { project: Project; beforeRun: () => Promise<Project> }) {
  const navigate = useNavigate();
  const st = visualStyle(project.visual_style);
  const engine = st.engine ?? 'animate';
  const info = ENGINE_INFO[engine];
  const [c] = useSkillCheck(engine);
  const [opening, setOpening] = useState(false);
  const samples = useSkillSamples(engine);
  const slug = slugify(project.title);
  const two = project.content_type === 'dialog' || project.content_type === 'film';

  async function open() {
    setOpening(true);
    try {
      const fresh = await beforeRun();
      let brief: string;
      const files: Record<string, string> = {};
      if (engine === 'studio') {
        // Karakter HyperForge ikut sebagai desain sumber (SVG rig dari Pengaturan > Karakter).
        const chars = await listCharacters().catch(() => []);
        for (const c of chars) if (c.svg) files[`karakter-hyperforge/${c.key}.svg`] = c.svg;
        brief = buildStudioBrief(
          fresh,
          slug,
          chars.map((c) => ({ key: c.key, name: c.name, nickname: c.nickname, is_main: c.is_main, personality: c.personality, appearance: c.appearance, hasSvg: Boolean(c.svg) })),
        );
      } else brief = engine === 'bang-motion' ? buildBangBrief(fresh, slug) : buildAnimateBrief(fresh, slug);
      await window.anima.skillOpen({ engine, slug, title: fresh.title, brief, files });
      toast.success('Jendela Claude Code dibuka', { description: 'Jawab pertanyaan dan persetujuan skill di jendela itu. Video jadi muncul di tab Render.', duration: 10000 });
    } catch (e) {
      toast.error('Gagal membuka Claude Code', { description: cleanErr(e), duration: 12000 });
    } finally {
      setOpening(false);
    }
  }

  return (
    <Card className="border-primary/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Sparkles className="size-4 text-primary" /> {st.label}
        </CardTitle>
        <CardDescription>
          Dibuat dengan skill {info.title} ({info.by}) di tab Claude, langsung di aplikasi. {info.flow}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {st.skillStyle && samples[st.skillStyle] && <img src={samples[st.skillStyle]} alt={st.skillStyle} className="mx-auto max-h-56 rounded-md border" />}
        {c && !c.ready && (
          <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
            {info.title} belum siap di laptop ini.{' '}
            <button
              className="text-primary underline"
              onClick={() => {
                setValue('settings:section', 'skills');
                navigate('/settings');
              }}
            >
              Buka Pengaturan &gt; Skill video
            </button>{' '}
            lalu klik Siapkan otomatis.
          </div>
        )}
        <Button
          onClick={async () => {
            await beforeRun();
            setValue(`project-tab:${project.id}`, 'claude');
          }}
          disabled={!c?.ready}
        >
          <Sparkles /> Kerjakan bersama Claude
        </Button>
        <button className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50" onClick={open} disabled={opening || !c?.ready}>
          {opening ? <Loader2 className="size-3 animate-spin" /> : <Terminal className="size-3" />} atau buka di jendela terminal Claude Code
        </button>
        <p className="text-xs text-muted-foreground">
          Brief (topik, jenis konten, durasi, format, style, suara vibi.pro) dikirim otomatis. Suara memakai Suara A{two ? ' dan B' : ''} dari Pengaturan; Claude menyebutkan jumlah kreditnya dulu
          sebelum membuat suara.
        </p>
      </CardContent>
    </Card>
  );
}

/** Tab Render untuk project style skill: video hasil skill -> masuk daftar render project. */
export function SkillRenders({ project, onImported }: { project: Project; onImported: () => void }) {
  const engine = visualStyle(project.visual_style).engine ?? 'animate';
  const slug = slugify(project.title);
  const [st, setSt] = useState<Awaited<ReturnType<typeof window.anima.skillStatus>> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => window.anima.skillStatus({ engine, slug }).then((r) => alive && setSt(r));
    load();
    const id = setInterval(load, 5000); // skill merender di jendela lain: cek berkala
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [engine, slug]);

  async function importVideo(file: string) {
    setBusy(file);
    try {
      const job = await createJob(project.id, { kind: engine, source: file });
      const now = new Date().toISOString();
      await updateJob(job.id, { status: 'done', progress: 100, output_path: file, started_at: now, finished_at: now });
      // Pemeriksaan HyperForge (layar hitam, gambar diam, suara) untuk tabel render.
      window.anima.runRenderQa({ jobId: job.id, file }).catch(() => {});
      toast.success('Video dimasukkan ke daftar render');
      onImported();
    } catch (e) {
      toast.error('Gagal memasukkan video', { description: cleanErr(e) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            <div className="font-medium">Video dari skill {ENGINE_INFO[engine].title}</div>
            <div className="mt-1 text-muted-foreground">
              Render dilakukan skill di jendela Claude Code. Video MP4 yang jadi muncul di sini otomatis dari <span className="font-mono">{st?.dir ?? '...'}</span>.
            </div>
          </div>
          <Button variant="outline" onClick={() => window.anima.skillOpenFolder({ engine, slug })}>
            <FolderOpen /> Buka folder
          </Button>
        </div>
        {!st ? (
          <Loader2 className="animate-spin text-muted-foreground" />
        ) : st.videos.length === 0 ? (
          <p className="text-sm text-muted-foreground">{st.exists ? 'Folder proyek sudah dibuat, video MP4 belum ada.' : 'Belum ada. Mulai dari tab Brief & Script > Buka di Claude Code.'}</p>
        ) : (
          <div className="grid gap-2">
            {st.videos.map((v) => (
              <div key={v.file} className="flex flex-wrap items-center gap-3 rounded-md border p-2.5 text-sm">
                <span className="font-mono">{v.name}</span>
                {v.name.endsWith('share.mp4') && <Badge variant="success">untuk diunggah</Badge>}
                <span className="text-xs text-muted-foreground">
                  {(v.size / 1024 / 1024).toFixed(1)} MB · {formatDate(v.mtime)}
                </span>
                <span className="ml-auto flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => window.anima.openPath(v.file)} title="Putar">
                    <Play />
                  </Button>
                  <Button size="sm" onClick={() => importVideo(v.file)} disabled={busy === v.file}>
                    {busy === v.file ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Masukkan ke daftar render
                  </Button>
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
