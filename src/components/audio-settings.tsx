import { useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, Play, Search, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect } from '@/components/ui/input';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Label } from '@/components/ui/misc';
import type { PythonCheck, Settings, VibiVoice } from '@/lib/types';
import { cn } from '@/lib/utils';

type Props = { s: Settings; setS: (s: Settings) => void };
type Provider = Settings['vibiProvider'];

const MODELS: Record<Provider, string[]> = {
  elevenlabs: ['eleven_multilingual_v2', 'eleven_v3', 'eleven_flash_v2_5', 'eleven_turbo_v2_5'],
  minimax: ['speech-2.8-turbo'],
  capcut: ['capcut'],
};

// Kunci pengaturan per slot suara: A = narator/tokoh 1, B = tokoh 2 (dialog & film).
const KEYS = {
  A: { provider: 'vibiProvider', model: 'vibiModel', voiceId: 'vibiVoiceId', voiceName: 'vibiVoiceName', language: 'vibiLanguage', speed: 'vibiSpeed' },
  B: { provider: 'vibi2Provider', model: 'vibi2Model', voiceId: 'vibi2VoiceId', voiceName: 'vibi2VoiceName', language: 'vibi2Language', speed: 'vibi2Speed' },
} as const;

const cleanErr = (e: unknown) => (e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '');

function VoiceSlot({ s, setS, slot }: Props & { slot: 'A' | 'B' }) {
  const k = KEYS[slot];
  const provider = s[k.provider] as Provider;
  const [search, setSearch] = useState('');
  const [voices, setVoices] = useState<VibiVoice[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [audio] = useState(() => new Audio());
  useEffect(() => () => audio.pause(), [audio]);

  const set = (patch: Partial<Settings>) => setS({ ...s, ...patch });

  async function load() {
    if (!s.vibiApiKey) {
      toast.error('Isi API key vibi.pro dulu.');
      return;
    }
    setBusy(true);
    try {
      await window.anima.saveSettings({ vibiApiKey: s.vibiApiKey });
      setVoices(await window.anima.vibiVoices(search.trim() || undefined));
    } catch (e) {
      toast.error(cleanErr(e));
    } finally {
      setBusy(false);
    }
  }

  const other = KEYS[slot === 'A' ? 'B' : 'A'];
  const sameAsOther = s[k.provider] === s[other.provider] && s[k.model] === s[other.model];

  return (
    <div className="grid gap-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn('grid size-7 place-items-center rounded-md text-sm font-bold', slot === 'A' ? 'bg-primary/20 text-primary' : 'bg-cyan/20 text-cyan')}>
          {slot}
        </span>
        <div>
          <div className="text-sm font-medium">{slot === 'A' ? 'Suara A (narator / tokoh 1)' : 'Suara B (tokoh 2)'}</div>
          <div className="text-xs text-muted-foreground">
            {slot === 'A' ? 'Dipakai semua jenis konten.' : 'Hanya untuk Dialog dan Film. Sebaiknya provider/model berbeda dari suara A.'}
          </div>
        </div>
        {slot === 'B' && sameAsOther && <Badge variant="warning">Model sama dengan suara A</Badge>}
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="grid gap-2">
          <Label>Provider</Label>
          <NativeSelect
            value={provider}
            onChange={(e) => {
              const p = e.target.value as Provider;
              set({ [k.provider]: p, [k.model]: MODELS[p][0], [k.language]: p === 'minimax' ? 'Indonesian' : 'id' } as Partial<Settings>);
            }}
          >
            <option value="elevenlabs">ElevenLabs</option>
            <option value="minimax">MiniMax</option>
            <option value="capcut">CapCut</option>
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label>Model</Label>
          <Input list={`vibi-models-${slot}`} value={s[k.model] as string} onChange={(e) => set({ [k.model]: e.target.value } as Partial<Settings>)} />
          <datalist id={`vibi-models-${slot}`}>
            {MODELS[provider].map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>
        <div className="grid gap-2">
          <Label>Bahasa</Label>
          <Input value={s[k.language] as string} onChange={(e) => set({ [k.language]: e.target.value } as Partial<Settings>)} />
        </div>
        <div className="grid gap-2">
          <Label>Kecepatan</Label>
          <Input
            type="number"
            step={0.05}
            min={0.5}
            max={2}
            value={s[k.speed] as number}
            onChange={(e) => set({ [k.speed]: Number(e.target.value) } as Partial<Settings>)}
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label>Suara terpilih</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            className="max-w-xs"
            placeholder="voice_id"
            value={s[k.voiceId] as string}
            onChange={(e) => set({ [k.voiceId]: e.target.value.trim(), [k.voiceName]: '' } as Partial<Settings>)}
          />
          {(s[k.voiceName] as string) && <span className="text-sm text-muted-foreground">{s[k.voiceName] as string}</span>}
        </div>
        {provider === 'elevenlabs' ? (
          <div className="flex gap-2">
            <Input placeholder="Cari suara (mis. narrator, female)..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} />
            <Button variant="outline" onClick={load} disabled={busy}>
              <Search /> {busy ? 'Memuat...' : 'Cari suara'}
            </Button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Untuk {provider}, salin voice_id dari dashboard vibi.pro.</span>
        )}
      </div>

      {voices && (
        <div className="max-h-64 overflow-y-auto rounded-md border">
          {voices.length === 0 && <p className="p-3 text-sm text-muted-foreground">Tidak ada suara.</p>}
          {voices.map((v) => (
            <div key={v.id} className={cn('flex items-center gap-3 border-b px-3 py-2 last:border-0', s[k.voiceId] === v.id && 'bg-accent')}>
              {v.preview && (
                <Button
                  size="icon"
                  variant="ghost"
                  title="Dengar contoh"
                  onClick={() => {
                    audio.src = v.preview!;
                    audio.play().catch(() => toast.error('Contoh suara tidak bisa diputar'));
                  }}
                >
                  <Play />
                </Button>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{v.name}</div>
                <div className="truncate text-xs text-muted-foreground">{[v.gender, v.accent, v.description].filter(Boolean).join(' · ')}</div>
              </div>
              <Button size="sm" variant={s[k.voiceId] === v.id ? 'default' : 'outline'} onClick={() => set({ [k.voiceId]: v.id, [k.voiceName]: v.name } as Partial<Settings>)}>
                {s[k.voiceId] === v.id ? 'Dipilih' : 'Pilih'}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Suara lewat vibi.pro: API key + suara A + suara B. Disimpan dengan tombol Simpan di Pengaturan. */
export function VoiceSettings({ s, setS }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Suara (vibi.pro)</CardTitle>
        <CardDescription>
          Script diubah jadi suara oleh vibi.pro lalu disimpan sebagai voice/voice.wav 48 kHz untuk skill. Dialog & Film memakai dua suara (A dan B). Memakai kredit vibi.pro.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="vk">API key vibi.pro</Label>
          <div className="flex gap-2">
            <Input id="vk" type="password" value={s.vibiApiKey} onChange={(e) => setS({ ...s, vibiApiKey: e.target.value.trim() })} />
            <Button variant="outline" onClick={() => window.anima.openExternal('https://vibi.pro/docs')}>
              Ambil key <ExternalLink />
            </Button>
          </div>
        </div>
        <VoiceSlot s={s} setS={setS} slot="A" />
        <VoiceSlot s={s} setS={setS} slot="B" />
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" className="size-4 accent-primary" checked={s.wordTimestamps} onChange={(e) => setS({ ...s, wordTimestamps: e.target.checked })} />
          Buat timing per kata (words.json) lewat speech-to-text. Dipakai skill untuk menurunkan musik saat narasi; memakai kredit tambahan.
        </label>
      </CardContent>
    </Card>
  );
}

/** Mix SFX + musik lewat skrip Python skill (audio/mix.py), lalu digabung ke MP4. */
export function AudioMixSettings({ s, setS }: Props) {
  const [py, setPy] = useState<PythonCheck | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    window.anima.pythonCheck().then(setPy);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>SFX & musik (Python)</CardTitle>
        <CardDescription>
          Setelah video dirender, HyperForge menjalankan audio/mix.py dari skill (SFX + musik sintetis + suara), lalu menggabungkan mix.wav ke MP4.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap items-center gap-3 rounded-md border p-3 text-sm">
          {py?.ok ? <CheckCircle2 className="size-5 text-success" /> : <XCircle className="size-5 text-warning" />}
          <div className="flex-1">
            {!py
              ? 'Mengecek Python...'
              : py.ok
                ? `Python ${py.python}, numpy ${py.numpy}, scipy ${py.scipy}`
                : py.python
                  ? `Python ${py.python} ada, tapi numpy/scipy belum lengkap.`
                  : 'Python tidak ditemukan.'}
          </div>
          {py && !py.ok && py.python && (
            <Button
              size="sm"
              disabled={installing}
              onClick={async () => {
                setInstalling(true);
                const r = await window.anima.pythonInstall();
                setInstalling(false);
                (r.ok ? toast.success : toast.error)(r.ok ? 'numpy & scipy terpasang' : 'Gagal memasang', { description: r.ok ? undefined : r.log });
                setPy(await window.anima.pythonCheck());
              }}
            >
              {installing ? 'Memasang (1-3 menit)...' : 'Pasang numpy & scipy'}
            </Button>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="py">Perintah Python</Label>
            <Input id="py" value={s.pythonPath} onChange={(e) => setS({ ...s, pythonPath: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="vd">Folder suara</Label>
            <Input id="vd" value={s.voiceDir} onChange={(e) => setS({ ...s, voiceDir: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ad">Folder audio (mix.py)</Label>
            <Input id="ad" value={s.audioDir} onChange={(e) => setS({ ...s, audioDir: e.target.value })} />
          </div>
        </div>
        <span className="-mt-2 text-xs text-muted-foreground">Kedua folder relatif terhadap folder proyek Remotion.</span>

        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" className="size-4 accent-primary" checked={s.runMix} onChange={(e) => setS({ ...s, runMix: e.target.checked })} />
          Jalankan mix.py setelah render
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" className="size-4 accent-primary" checked={s.muxAudio} onChange={(e) => setS({ ...s, muxAudio: e.target.checked })} />
          Gabungkan mix.wav ke MP4 (ffmpeg bawaan Remotion)
        </label>
      </CardContent>
    </Card>
  );
}
