import { useEffect, useState } from 'react';
import { Mic, Play } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, Progress } from '@/components/ui/misc';
import type { Project, Shot, VoiceStatus } from '@/lib/types';
import { WORDS_PER_SECOND, countWords, formatDate, slugify } from '@/lib/utils';
import { contentType } from '@/lib/content';
import { cleanErr, runTask, useTask, useTaskFinished } from '@/lib/tasks';

/** Teks narasi: script project, atau gabungan narasi per shot kalau script kosong. */
export function narrationText(project: Project, shots: Shot[]) {
  return project.script.trim() || shots.map((s) => s.narration_text.trim()).filter(Boolean).join(' ');
}

export function VoicePanel({ project, shots }: { project: Project; shots: Shot[] }) {
  const slug = slugify(project.title);
  const [status, setStatus] = useState<VoiceStatus | null>(null);
  // Status pembuatan suara disimpan global: tetap terlihat saat pindah halaman lalu kembali.
  const task = useTask(`voice:${slug}`);
  const step = task?.running ? { step: task.step, progress: task.progress ?? 0 } : null;
  const [voiceName, setVoiceName] = useState('');

  const two = contentType(project.content_type).twoVoices;
  // Dialog/film: satu giliran per shot dengan pembicara A/B (kosong dianggap A).
  const lines = two ? shots.filter((s) => s.narration_text.trim()).map((s) => ({ speaker: s.speaker === 'B' ? 'B' : 'A', text: s.narration_text })) : undefined;
  const text = two ? lines!.map((l) => l.text).join(' ') : narrationText(project, shots);
  const words = countWords(text);
  const [voiceBName, setVoiceBName] = useState('');

  useEffect(() => {
    window.anima.voiceStatus(slug).then(setStatus);
    window.anima.getSettings().then((s) => {
      setVoiceName(s.vibiVoiceName || s.vibiVoiceId);
      setVoiceBName(s.vibi2VoiceName || s.vibi2VoiceId);
    });
  }, [slug]);

  useTaskFinished(`voice:${slug}`, () => window.anima.voiceStatus(slug).then(setStatus));

  function generate() {
    if (status?.mp3 && !window.confirm('Suara sudah ada. Buat ulang? Ini memakai kredit vibi.pro lagi.')) return;
    const title = project.title;
    runTask(`voice:${slug}`, { label: `Suara: ${title}`, href: `/projects/${project.id}`, step: 'Mulai' }, () => window.anima.generateVoice({ slug, text, lines })).then(
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
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {status?.mp3 && (
              <Button variant="outline" onClick={() => window.anima.openPath(status.mp3!)}>
                <Play /> Dengar
              </Button>
            )}
            <Button onClick={generate} disabled={Boolean(step) || words === 0}>
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
    </Card>
  );
}
