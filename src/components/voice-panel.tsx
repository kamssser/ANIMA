import { useEffect, useState } from 'react';
import { Mic, Play } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, Progress } from '@/components/ui/misc';
import type { Project, Shot, VoiceStatus } from '@/lib/types';
import { WORDS_PER_SECOND, countWords, formatDate, slugify } from '@/lib/utils';

/** Teks narasi: script project, atau gabungan narasi per shot kalau script kosong. */
export function narrationText(project: Project, shots: Shot[]) {
  return project.script.trim() || shots.map((s) => s.narration_text.trim()).filter(Boolean).join(' ');
}

export function VoicePanel({ project, shots }: { project: Project; shots: Shot[] }) {
  const slug = slugify(project.title);
  const [status, setStatus] = useState<VoiceStatus | null>(null);
  const [step, setStep] = useState<{ step: string; progress: number } | null>(null);
  const [voiceName, setVoiceName] = useState('');

  const text = narrationText(project, shots);
  const words = countWords(text);

  useEffect(() => {
    window.anima.voiceStatus(slug).then(setStatus);
    window.anima.getSettings().then((s) => setVoiceName(s.vibiVoiceName || s.vibiVoiceId));
    return window.anima.onVoiceEvent((e) => e.slug === slug && setStep(e));
  }, [slug]);

  async function generate() {
    if (status?.mp3 && !window.confirm('Suara sudah ada. Buat ulang? Ini memakai kredit vibi.pro lagi.')) return;
    setStep({ step: 'Mulai', progress: 0 });
    try {
      const r = await window.anima.generateVoice({ slug, text });
      toast.success('Suara narasi selesai', {
        description: [r.credits != null && `${r.credits} kredit`, r.words != null && `${r.words} kata ber-timing`, ...r.notes]
          .filter(Boolean)
          .join(' · '),
      });
      setStatus(await window.anima.voiceStatus(slug));
    } catch (e) {
      toast.error('Gagal membuat suara', { description: (e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') });
    } finally {
      setStep(null);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-sm">
            <div className="font-medium">Suara narasi</div>
            <div className="mt-1 text-muted-foreground">
              {words} kata, perkiraan {Math.round(words / WORDS_PER_SECOND)} dtk · suara: {voiceName || 'belum dipilih (Pengaturan)'}
            </div>
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
