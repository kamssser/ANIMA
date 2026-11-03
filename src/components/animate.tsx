// Style animate: skill cth9191/animate (MIT) dijalankan utuh di Claude Code. Di sini: pengaturan kebutuhan,
// galeri style, panel project (buka sesi Claude + ambil video hasil).
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ExternalLink, FolderOpen, Loader2, Play, Sparkles, Terminal, Wand2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Progress } from '@/components/ui/misc';
import { createJob, updateJob } from '@/lib/api';
import { buildAnimateBrief } from '@/lib/content';
import { visualStyle } from '@/lib/styles';
import { cleanErr, runTask, setValue, usePersisted, useTask, useTaskFinished } from '@/lib/tasks';
import type { AnimateCheck, Project } from '@/lib/types';
import { cn, formatDate, slugify } from '@/lib/utils';

const ready = (c: AnimateCheck | null) => Boolean(c && c.skill.installed && c.playwright && c.chromium && c.ffmpeg && c.claude && c.node);

let samplesCache: Record<string, string> | null = null;
/** Gambar contoh tiap style dari skill (sample.png). */
export function useAnimateSamples() {
  const [s, setS] = useState<Record<string, string> | null>(samplesCache);
  useEffect(() => {
    if (samplesCache) return;
    window.anima.animateSamples().then((r) => {
      samplesCache = r;
      setS(r);
    });
  }, []);
  return s ?? {};
}

function useAnimateCheck() {
  const [c, setC] = useState<AnimateCheck | null>(null);
  const refresh = () => window.anima.animateCheck().then(setC);
  useEffect(() => {
    refresh();
  }, []);
  return [c, refresh] as const;
}

function Row({ ok, label, detail, optional }: { ok: boolean; label: string; detail?: string; optional?: boolean }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      {ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /> : <XCircle className={cn('mt-0.5 size-4 shrink-0', optional ? 'text-muted-foreground' : 'text-warning')} />}
      <span className="min-w-0">
        <span className="font-medium">{label}</span>
        {detail && <span className="block truncate text-xs text-muted-foreground" title={detail}>{detail}</span>}
      </span>
    </div>
  );
}

/** Pengaturan > Animate. */
export function AnimateSettings() {
  const [c, refresh] = useAnimateCheck();
  const task = useTask('animate-setup');
  const busy = Boolean(task?.running);
  const [whisper, setWhisper] = usePersisted('animate:whisper', true);
  const samples = useAnimateSamples();
  useTaskFinished('animate-setup', () => refresh());

  function setup() {
    runTask('animate-setup', { label: 'Menyiapkan Animate', href: '/settings', step: 'Mulai' }, () => window.anima.animateSetup({ withWhisper: whisper })).then(
      () => toast.success('Animate siap dipakai'),
      (e) => toast.error('Gagal menyiapkan Animate', { description: cleanErr(e), duration: 15000 }),
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Animate (skill cth9191/animate)</CardTitle>
          <CardDescription>
            Animasi kanvas dengan 7 style bawaan atau style dari referensimu. Skill dipakai utuh di Claude Code: kamu menyetujui story, look, dan storyboard sebelum Claude menganimasikan, lalu video dirender
            dan diperiksa oleh alat skill itu sendiri.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {!c ? (
            <Loader2 className="animate-spin text-muted-foreground" />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              <Row ok={c.skill.installed} label="Skill animate" detail={c.skill.installed ? `~/.claude/skills/animate (commit ${c.commit.slice(0, 7)})` : c.skill.foreign ? 'Ada skill animate lain: akan disimpan sebagai cadangan' : 'Belum dipasang'} />
              <Row ok={c.claude} label="Claude Code" detail={c.claude ? undefined : 'Install Claude Code lalu login'} />
              <Row ok={c.node} label="Node.js" />
              <Row ok={c.playwright} label="Playwright" detail="npm i -g playwright" />
              <Row ok={c.chromium} label="Chromium untuk Playwright" detail="sekitar 150 MB" />
              <Row ok={Boolean(c.ffmpeg)} label="ffmpeg lengkap" detail={c.ffmpeg ?? 'dipasang lewat winget (Gyan.FFmpeg)'} />
              <Row ok={Boolean(c.whisper)} optional label="faster-whisper (opsional)" detail={c.whisper ? `versi ${c.whisper}: timing kata dari suara` : 'tanpa ini timing kata diperkirakan'} />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={setup} disabled={busy || !c}>
              {busy ? <Loader2 className="animate-spin" /> : <Wand2 />} {ready(c) ? 'Pasang ulang / perbarui' : 'Siapkan otomatis'}
            </Button>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-primary" checked={whisper} onChange={(e) => setWhisper(e.target.checked)} disabled={busy} />
              Ikut pasang faster-whisper (sekitar 200 MB)
            </label>
          </div>
          {busy && task && (
            <div className="grid gap-1 rounded-md border p-3 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{task.step}...</span>
              {task.log.at(-1) && task.log.at(-1) !== task.step && <span className="truncate font-mono">{task.log.at(-1)}</span>}
              <Progress value={undefined} />
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Folder kerja: <span className="font-mono">{c?.workDir ?? '~/anima-animate'}</span>. Skill dari{' '}
            <button className="text-primary hover:underline" onClick={() => window.anima.openExternal('https://github.com/cth9191/animate')}>
              github.com/cth9191/animate <ExternalLink className="inline size-3" />
            </button>{' '}
            (lisensi MIT), tidak diubah.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Style bawaan skill</CardTitle>
          <CardDescription>Pilih di halaman project (Style video). "Dari referensi saya" membuat style baru dari video/gambar yang kamu berikan.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-4 gap-3 lg:grid-cols-7">
          {Object.entries(samples).map(([k, src]) => (
            <figure key={k} className="grid gap-1">
              <img src={src} alt={k} className="aspect-[9/16] w-full rounded-md border object-cover" />
              <figcaption className="text-center text-[11px] text-muted-foreground">{k}</figcaption>
            </figure>
          ))}
        </CardContent>
      </Card>
    </>
  );
}

/** Panel di tab Brief untuk project style animate. */
export function AnimatePanel({ project, beforeRun }: { project: Project; beforeRun: () => Promise<Project> }) {
  const navigate = useNavigate();
  const [c] = useAnimateCheck();
  const [opening, setOpening] = useState(false);
  const st = visualStyle(project.visual_style);
  const samples = useAnimateSamples();
  const slug = slugify(project.title);

  async function open() {
    setOpening(true);
    try {
      const fresh = await beforeRun();
      await window.anima.animateOpen({ slug, title: fresh.title, brief: buildAnimateBrief(fresh, slug) });
      toast.success('Jendela Claude Code dibuka', { description: 'Jawab check-in story, look, dan storyboard di jendela itu. Video jadi muncul di tab Render.', duration: 10000 });
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
          Dibuat dengan skill animate di jendela Claude Code. Claude akan bertanya beberapa hal, lalu meminta persetujuanmu untuk <b>story</b>, <b>look</b> (2-4 frame contoh), dan <b>storyboard</b> sebelum
          menganimasikan dan merender.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {st.skillStyle && samples[st.skillStyle] && <img src={samples[st.skillStyle]} alt={st.skillStyle} className="mx-auto max-h-56 rounded-md border" />}
        {c && !ready(c) && (
          <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
            Animate belum siap di laptop ini.{' '}
            <button
              className="text-primary underline"
              onClick={() => {
                setValue('settings:section', 'animate');
                navigate('/settings');
              }}
            >
              Buka Pengaturan &gt; Animate
            </button>{' '}
            lalu klik Siapkan otomatis.
          </div>
        )}
        <Button onClick={open} disabled={opening || !ready(c)}>
          {opening ? <Loader2 className="animate-spin" /> : <Terminal />} Buka di Claude Code
        </Button>
        <p className="text-xs text-muted-foreground">
          Brief (topik, jenis konten, durasi, format, style, suara vibi.pro) dikirim otomatis. Suara memakai Suara A{project.content_type === 'dialog' || project.content_type === 'film' ? ' dan B' : ''} dari Pengaturan;
          Claude menyebutkan jumlah kreditnya dulu sebelum membuat suara.
        </p>
      </CardContent>
    </Card>
  );
}

/** Tab Render untuk project animate: video hasil skill -> masuk daftar render project. */
export function AnimateRenders({ project, onImported }: { project: Project; onImported: () => void }) {
  const slug = slugify(project.title);
  const [st, setSt] = useState<Awaited<ReturnType<typeof window.anima.animateStatus>> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => window.anima.animateStatus(slug).then((r) => alive && setSt(r));
    load();
    const id = setInterval(load, 5000); // skill merender di jendela lain: cek berkala
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [slug]);

  async function importVideo(file: string) {
    setBusy(file);
    try {
      const job = await createJob(project.id, { kind: 'animate', source: file });
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
            <div className="font-medium">Video dari skill animate</div>
            <div className="mt-1 text-muted-foreground">
              Render dilakukan skill di jendela Claude Code (frame, audio, review). Video jadi muncul di sini otomatis dari <span className="font-mono">pieces/{slug}/renders/</span>.
            </div>
          </div>
          <Button variant="outline" onClick={() => window.anima.animateOpenFolder(slug)}>
            <FolderOpen /> Buka folder
          </Button>
        </div>
        {!st ? (
          <Loader2 className="animate-spin text-muted-foreground" />
        ) : st.videos.length === 0 ? (
          <p className="text-sm text-muted-foreground">{st.exists ? 'Piece sudah dibuat, video belum dirender.' : 'Belum ada piece. Mulai dari tab Brief & Script > Buka di Claude Code.'}</p>
        ) : (
          <div className="grid gap-2">
            {st.videos.map((v) => (
              <div key={v.file} className="flex flex-wrap items-center gap-3 rounded-md border p-2.5 text-sm">
                <span className="font-mono">{v.name}</span>
                {v.name === 'share.mp4' && <Badge variant="success">untuk diunggah</Badge>}
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
