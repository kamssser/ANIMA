import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, AudioLines, Mic, Play, Square } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, Progress } from '@/components/ui/misc';
import type { Project, Shot, VoiceStatus } from '@/lib/types';
import { WORDS_PER_SECOND, countWords, formatDate, slugify } from '@/lib/utils';
import { usesTwoVoices } from '@/lib/content';
import { cleanErr, runTask, useTask } from '@/lib/tasks';
import { WordTimingDialog } from '@/components/word-timing';

/** Teks narasi: script project, atau gabungan narasi per shot kalau script kosong. */
export function narrationText(project: Project, shots: Shot[]) {
  return project.script.trim() || shots.map((s) => s.narration_text.trim()).filter(Boolean).join(' ');
}

/** Teks yang dibacakan + kunci pembanding (untuk tahu apakah script berubah setelah suara dibuat). */
export function voiceInput(project: Project, shots: Shot[]) {
  const two = usesTwoVoices(project);
  // Project 2 suara: satu giliran per shot dengan pembicara A/B (kosong dianggap A).
  const lines = two ? shots.filter((s) => s.narration_text.trim()).map((s) => ({ speaker: s.speaker === 'B' ? 'B' : 'A', text: s.narration_text })) : undefined;
  const text = two ? lines!.map((l) => l.text).join(' ') : narrationText(project, shots);
  const key = two ? JSON.stringify(lines!.map((l) => [l.speaker, l.text.trim()])) : text.trim().replace(/\s+/g, ' ');
  return { two, lines, text, key };
}

/**
 * Status suara project + apakah perlu dibuat ulang (script/narasi berubah sejak suara dibuat).
 * Dibaca ulang setiap kali pembuatan suara selesai.
 */
export function useVoiceStatus(project: Project, shots: Shot[]) {
  const slug = slugify(project.title);
  const [status, setStatus] = useState<VoiceStatus | null>(null);
  const finishedAt = useTask(`voice:${slug}`)?.finishedAt;
  const refresh = useCallback(() => window.anima.voiceStatus(slug).then(setStatus), [slug]);
  useEffect(() => {
    refresh();
  }, [refresh, finishedAt]);
  const { key } = voiceInput(project, shots);
  // Suara lama (sebelum 0.7.0) belum mencatat teksnya: dianggap cocok.
  const stale = Boolean(status?.mp3 && status.textKey != null && status.textKey !== key);
  return { slug, status, refresh, stale };
}

export function VoicePanel({ project, shots, voice }: { project: Project; shots: Shot[]; voice: ReturnType<typeof useVoiceStatus> }) {
  const { slug, status, refresh, stale } = voice;
  // Status pembuatan suara disimpan global: tetap terlihat saat pindah halaman lalu kembali.
  const task = useTask(`voice:${slug}`);
  const step = task?.running ? { step: task.step, progress: task.progress ?? 0 } : null;
  const [voiceName, setVoiceName] = useState('');
  const [voiceBName, setVoiceBName] = useState('');
  const [timingOpen, setTimingOpen] = useState(false);
  const { two, lines, text, key } = voiceInput(project, shots);
  const words = countWords(text);

  useEffect(() => {
    window.anima.getSettings().then((s) => {
      setVoiceName(s.vibiVoiceName || s.vibiVoiceId);
      setVoiceBName(s.vibi2VoiceName || s.vibi2VoiceId);
    });
  }, []);

  // Putar di dalam aplikasi: pemutar luar (Windows Media Player) mengunci voice.mp3 sehingga suara tidak bisa dibuat ulang.
  const [playing, setPlaying] = useState(false);
  const player = useRef<HTMLAudioElement | null>(null);
  useEffect(
    () => () => {
      player.current?.pause();
      if (player.current?.src) URL.revokeObjectURL(player.current.src);
    },
    [],
  );
  async function listen() {
    if (playing && player.current) {
      player.current.pause();
      return;
    }
    try {
      const { audio } = await window.anima.voiceWords(slug);
      if (player.current?.src) URL.revokeObjectURL(player.current.src);
      const a = new Audio(URL.createObjectURL(new Blob([audio as BlobPart], { type: 'audio/mpeg' })));
      a.onplay = () => setPlaying(true);
      a.onpause = () => setPlaying(false);
      a.onended = () => setPlaying(false);
      player.current = a;
      await a.play();
    } catch (e) {
      toast.error('Gagal memutar suara', { description: cleanErr(e) });
    }
  }

  function generate() {
    player.current?.pause();
    if (status?.mp3 && !window.confirm('Suara sudah ada. Buat ulang? Ini memakai kredit vibi.pro lagi.')) return;
    const title = project.title;
    runTask(`voice:${slug}`, { label: `Suara: ${title}`, href: `/projects/${project.id}`, step: 'Mulai' }, () => window.anima.generateVoice({ slug, text, lines, textKey: key })).then(
      (r) =>
        toast.success(`Suara "${title}" selesai`, {
          description: [r.credits != null && `${r.credits} kredit`, r.words != null && `${r.words} kata ber-timing`, ...r.notes].filter(Boolean).join(' · '),
        }),
      (e) => toast.error('Gagal membuat suara', { description: cleanErr(e) }),
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-sm">
            <div className="font-medium">{two ? 'Suara dialog (2 pembicara)' : 'Suara narasi'}</div>
            <div className="mt-1 text-muted-foreground">
              {words} kata, perkiraan {Math.round(words / WORDS_PER_SECOND)} dtk · suara A: {voiceName || 'belum dipilih'}
              {two && <> · suara B: {voiceBName || 'belum dipilih'}</>}
            </div>
            {two && (
              <div className="mt-1 text-muted-foreground">
                {lines!.filter((l) => l.speaker === 'A').length} giliran A, {lines!.filter((l) => l.speaker === 'B').length} giliran B
              </div>
            )}
            {status?.mp3 && (
              <div className="mt-1 text-muted-foreground">
                Terakhir dibuat {formatDate(status.updatedAt)}
                {status.words != null && ` · ${status.words} kata ber-timing`}
                {status.wordsEditedAt && ' · timing diedit'}
              </div>
            )}
            {stale && (
              <div className="mt-2 flex items-start gap-1.5 rounded-md border border-warning/40 bg-warning/10 p-2 text-xs">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
                <span>
                  <b>Perlu dibuat ulang.</b> Script atau narasi shot sudah berubah sejak suara ini dibuat, jadi suara, teks di layar, dan panjang shot tidak akan cocok.
                </span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {status?.mp3 && (
              <Button variant="outline" onClick={listen} disabled={Boolean(step)}>
                {playing ? <Square /> : <Play />} {playing ? 'Berhenti' : 'Dengar'}
              </Button>
            )}
            {status?.mp3 && status.words != null && (
              <Button variant="outline" onClick={() => setTimingOpen(true)} disabled={Boolean(step)} title="Atur kapan tiap kata muncul di layar">
                <AudioLines /> Timing kata
              </Button>
            )}
            <Button onClick={generate} disabled={Boolean(step) || words === 0} variant={status?.mp3 && !stale ? 'outline' : 'default'}>
              <Mic /> {status?.mp3 ? 'Buat ulang suara' : 'Buat suara'}
            </Button>
          </div>
        </div>
        {step && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="w-48 shrink-0">{step.step}...</span>
            <Progress value={step.progress} />
          </div>
        )}
      </CardContent>
      {status?.mp3 && <WordTimingDialog slug={slug} open={timingOpen} onOpenChange={setTimingOpen} onSaved={refresh} />}
    </Card>
  );
}
