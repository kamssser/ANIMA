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
import { NARRATION_RULES, usesTwoVoices, buildAnimantraBrief, buildAnimateBrief, buildBangBrief, buildFlowBrief, buildKamalBrief, buildLemoBrief, buildMotionBrief, buildStickmanBrief, buildStudioBrief } from '@/lib/content';
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
  animantra: {
    title: 'Animantra: Vector',
    by: 'paket Animantra milikmu',
    flow: 'Claude mengerjakan persis seperti skill Animantra: riset fakta, naskah (ditunjukkan lalu lanjut kecuali kamu minta ubah), suara narasi, model 3D, lembar cuplikan dan gerbang mutu, lalu render, cover, versi kecil, dan caption.',
    samplesTitle: 'Patokan mutu gaya bedah',
  },
  lemo: {
    title: 'Lemo-Opuscar',
    by: 'LemoLab',
    flow: 'Claude menulis treatment, menunjukkan frame gaya untuk kamu setujui, lalu menyutradarai, menggambar, memberi musik, dan mengemas film dengan kode dari pustaka 66 gaya.',
    samplesTitle: '66 gaya film',
  },
  motionmaxxing: {
    title: 'Motionmaxxing',
    by: 'Tejash Makwana',
    flow: 'Claude mencari satu ide khas brand/topik, membangun dunianya, menganimasikan dengan gerak terukur, lalu memeriksa render dengan skrip (gate G0-G5) dan menulis NOTE.md.',
    samplesTitle: 'Promo & kinetic type',
  },
  flow: {
    title: 'Google Flow',
    by: 'google-flow-browser-mcp (TMSSS05) + HyperForge',
    flow: 'Claude menulis naskah dan daftar shot, suara dibuat vibi.pro, lalu Claude sendiri mengetik prompt, menekan Generate, dan mengunduh tiap shot di Google Flow (memakai kredit Flow-mu, kamu setujui sekali di awal), dan klip + SFX dirakit jadi MP4 bersubtitle.',
    samplesTitle: 'Gaya klip',
  },
  kamal: {
    title: 'Kamal',
    by: 'HyperForge',
    flow: 'Claude menulis naskah dan judul layar, suara dibuat vibi.pro, lalu menunjukkan storyboard (lembar frame) untuk kamu setujui sebelum merender video gaya Kamal (gelap atau terang) dari kode.',
    samplesTitle: 'Varian',
  },
  stickman: {
    title: 'Stickman',
    by: 'kaomei (stickman-video-director)',
    flow: 'Claude menulis naskah, suara dibuat vibi.pro, lalu menyusun adegan stickman dan merender contoh sekitar 20 detik untuk kamu setujui sebelum video penuh dirender di laptop (Autopilot).',
    samplesTitle: 'Gaya',
  },
};

/** Aturan storyboard cerita + teks suara yang bisa diedit pengguna di HyperForge sebelum suara & render. */
function storyRule(engine: SkillEngine, slug: string, two: boolean) {
  const dir = engine === 'animate' ? `pieces/${slug}` : slug;
  return [
    '',
    '## Storyboard cerita & teks suara (WAJIB, bisa diedit pengguna)',
    `- Setelah naskah/rencana adegan jadi dan SEBELUM membuat suara atau merender, tulis \`${dir}/cerita.json\` (Bahasa Indonesia):`,
    '  `{ "judul": "...", "status": "menunggu_edit", "adegan": [{ "no": 1, "visual": "apa yang terlihat: tokoh, aksi, benda, kamera", "teks_layar": "judul/kata kunci di layar atau kosong", "suara": "A", "narasi": "kalimat persis yang diucapkan" }] }`',
    two ? '  `suara`: "A" = karakter utama pengguna, "B" = narator (jenis Dialog: tokoh kedua).' : '  `suara` selalu "A" (karakter utama pengguna sekaligus narator).',
    '- Lalu beri tahu pengguna: storyboard & teks suara bisa diedit di HyperForge (tombol **Storyboard & naskah** di atas obrolan), dan TUNGGU. Jangan lanjut ke suara/render sebelum pengguna menyetujui.',
    '- Setiap kali pengguna menyetujui atau menyuruh lanjut: BACA ULANG cerita.json (pengguna mungkin mengubah, menambah, menghapus, atau mengurutkan ulang adegan). Pakai `narasi` PERSIS kata per kata untuk suara (dan naskah/subtitle), `visual` + `teks_layar` untuk adegan/storyboard/render. Setelah itu ubah `status` menjadi "disetujui" (isi lain dibiarkan).',
    '- Kalau pengguna mengedit cerita.json setelah suara dibuat, buat ulang suara HANYA untuk adegan yang narasinya berubah, lalu sesuaikan timing.',
    '- File format skill sendiri (naskah.md, storyboard.json, script.json, shots.json, dst.) tetap dibuat seperti biasa, isinya mengikuti cerita.json.',
  ].join('\n');
}

/** Naskah suara mudah dipahami + suara natural: berlaku untuk semua style. */
function narrationRule() {
  return [
    '',
    '## Naskah suara: mudah dipahami & natural (WAJIB, semua style)',
    ...NARRATION_RULES.map((r) => `- ${r}`),
    '- Suara dibuat dengan pengaturan ekspresif dari HyperForge. Buat suara per kalimat/adegan bila skill mendukung, supaya jeda dan intonasi tiap kalimat alami. Cek hasilnya (timing kata): kalau ada kata yang salah ucap atau terdengar datar, ubah ejaan/tanda bacanya lalu buat ulang kalimat itu saja.',
  ].join('\n');
}

/** Branding pengguna (Pengaturan > Branding): teks kecil di tengah paling bawah setiap video. */
function brandRule(engine: SkillEngine, text: string) {
  if (!text) return '';
  const how =
    engine === 'flow'
      ? `isi "brand": ${JSON.stringify(text)} di rakit.json; tools/rakit.mjs menulisnya otomatis.`
      : engine === 'kamal'
        ? 'gambar di setiap frame dengan K.label/ctx.fillText di x = tengah, y = tinggi video x 0,975 (di bawah caption).'
        : 'gambar di dalam komposisi/kanvas video (lapisan paling atas, setiap frame). Kalau video akhir dirakit dengan ffmpeg dan komposisi tidak bisa diubah, tambahkan dengan filter drawtext/subtitles saat perakitan akhir.';
  return [
    '',
    '## Branding kanal (WAJIB)',
    `- Setiap video menampilkan teks ${JSON.stringify(text)} persis (nama kanal/akun sosmed pengguna) sepanjang video, KECIL di TENGAH PALING BAWAH: tinggi huruf sekitar 2,4% sisi pendek video (~26 px di 1080x1920), tebal sedang, putih ~75% dengan bayangan tipis gelap (di latar terang: gelap ~70%), jarak ~1,8% tinggi video dari tepi bawah, tanpa animasi berlebihan.`,
    '- Tidak boleh menabrak subtitle/caption: subtitle tetap di atasnya. Jangan menambah logo, ikon, atau teks lain.',
    `- Cara: ${how}`,
    '- Periksa satu frame hasil akhir: teks branding terbaca, kecil, dan di tengah bawah.',
  ].join('\n');
}

/** Brief + file pendukung untuk sesi skill sebuah project (dipakai panel obrolan dan jendela terminal). */
export async function buildSkillBrief(engine: SkillEngine, fresh: Project, slug: string) {
  const r = await buildSkillBriefBase(engine, fresh, slug);
  const s = await window.anima.getSettings().catch(() => null);
  const brand = s?.brandOn ? String(s.brandText || '').trim() : '';
  const extra = [narrationRule(), brandRule(engine, brand), storyRule(engine, slug, usesTwoVoices(fresh))].filter(Boolean).join('\n');
  return { ...r, brief: r.brief.trimEnd() + '\n' + extra + '\n' };
}

async function buildSkillBriefBase(engine: SkillEngine, fresh: Project, slug: string) {
  const files: Record<string, string> = {};
  if (engine === 'studio') {
    // Karakter HyperForge ikut sebagai desain sumber (SVG rig dari Pengaturan > Karakter).
    const chars = await listCharacters().catch(() => []);
    for (const c of chars) if (c.svg) files[`karakter-hyperforge/${c.key}.svg`] = c.svg;
    const brief = buildStudioBrief(
      fresh,
      slug,
      chars.map((c) => ({ key: c.key, name: c.name, nickname: c.nickname, is_main: c.is_main, personality: c.personality, appearance: c.appearance, hasSvg: Boolean(c.svg) })),
    );
    return { brief, files };
  }
  if (engine === 'animantra') return { brief: buildAnimantraBrief(fresh, slug, (await window.anima.skillCheck('animantra')).workDir), files };
  if (engine === 'lemo') return { brief: buildLemoBrief(fresh, slug), files };
  if (engine === 'motionmaxxing') return { brief: buildMotionBrief(fresh, slug), files };
  if (engine === 'flow') return { brief: buildFlowBrief(fresh, slug), files };
  if (engine === 'kamal') return { brief: buildKamalBrief(fresh, slug), files };
  if (engine === 'stickman') return { brief: buildStickmanBrief(fresh, slug), files };
  return { brief: engine === 'bang-motion' ? buildBangBrief(fresh, slug) : buildAnimateBrief(fresh, slug), files };
}

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
      <EngineSettings engine="kamal" />
      <EngineSettings engine="stickman" />
      <EngineSettings engine="animantra" />
      <EngineSettings engine="lemo" />
      <EngineSettings engine="motionmaxxing" />
      <EngineSettings engine="flow" />
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
        {engine === 'flow' && <FlowChrome />}
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
              {Object.entries(samples)
                // gambar yang sama dipakai beberapa style (Animantra): tampilkan sekali
                .filter(([, src], i, all) => all.findIndex(([, s]) => s === src) === i)
                .map(([k, src]) => (
                <figure key={k} className="grid gap-1">
                  <img src={src} alt={k} className={cn('w-full rounded-md border object-cover', engine === 'animate' || engine === 'animantra' ? 'aspect-[9/16]' : 'aspect-video')} />
                  <figcaption className="truncate text-center text-[11px] text-muted-foreground">{k}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        )}
        {c && !c.url && (
          <p className="text-xs text-muted-foreground">
            Folder kerja: <span className="font-mono">{c.workDir}</span>. Skill ini dari <b>paket milikmu</b> dan dipakai apa adanya. Lisensinya melarang dibagikan ulang, jadi HyperForge tidak
            menyertakannya: <b>Siapkan otomatis</b> menjalankan installer dari folder paket hasil ekstrak (Downloads/animantra-vector). Teman yang ingin memakainya perlu paket sendiri.
          </p>
        )}
        {c && c.url && (
          <p className="text-xs text-muted-foreground">
            Folder kerja: <span className="font-mono">{c.workDir}</span>. Sumber{' '}
            <button className="text-primary hover:underline" onClick={() => window.anima.openExternal(c.url)}>
              {c.url.replace('https://', '')} <ExternalLink className="inline size-3" />
            </button>{' '}
            (lisensi {c.license ?? 'MIT'}{engine === 'flow' || engine === 'studio' || engine === 'kamal' ? '' : `, commit ${c.commit.slice(0, 7)}`}), tidak diubah.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** Tombol buka Chrome khusus Google Flow (login sekali dengan akun Google yang punya akses Flow). */
export function FlowChrome() {
  const [st, setSt] = useState<{ running: boolean; downloads: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => window.anima.flowStatus().then(setSt).catch(() => {});
  useEffect(() => {
    load();
  }, []);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-dashed p-3 text-sm">
      <Button
        variant="outline"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await window.anima.flowOpenChrome();
            toast.success(r.already ? 'Chrome Google Flow sudah terbuka' : 'Chrome Google Flow dibuka', { description: 'Login sekali dengan akun Google yang punya akses Flow. Jendela ini dipakai Claude saat membuat klip.' });
          } catch (e) {
            toast.error('Gagal membuka Chrome', { description: cleanErr(e) });
          } finally {
            setBusy(false);
            load();
          }
        }}
      >
        {busy ? <Loader2 className="animate-spin" /> : <ExternalLink />} Buka Google Flow di Chrome
      </Button>
      <span className="text-xs text-muted-foreground">
        {st?.running ? 'Chrome Flow sedang terbuka.' : 'Chrome Flow belum terbuka.'} Profil Chrome terpisah (akun utamamu tidak tersentuh). Unduhan klip: <span className="font-mono">{st?.downloads ?? '...'}</span>
      </span>
    </div>
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
      const { brief, files } = await buildSkillBrief(engine, fresh, slug);
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
        {engine === 'flow' && c?.ready && <FlowChrome />}
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
