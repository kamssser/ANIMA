import { useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, Play, Search, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { runTask, useTask, useTaskFinished } from '@/lib/tasks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Label } from '@/components/ui/misc';
import type { PythonCheck, Settings, VibiVoice } from '@/lib/types';
import { cn } from '@/lib/utils';

type Props = { s: Settings; setS: (s: Settings) => void };
type Provider = Settings['vibiProvider'];

// Model per provider. Urutan: [bawaan suara A, bawaan suara B, ...lainnya].
const MODELS: Record<Provider, string[]> = {
  elevenlabs: ['eleven_multilingual_v2', 'eleven_v3', 'eleven_flash_v2_5', 'eleven_turbo_v2_5'],
  minimax: ['speech-2.8-turbo', 'speech-2.8-hd'],
  capcut: ['capcut'],
};
const PROVIDERS: { id: Provider; label: string }[] = [
  { id: 'elevenlabs', label: 'ElevenLabs' },
  { id: 'minimax', label: 'MiniMax' },
  { id: 'capcut', label: 'CapCut' },
];

// Kunci pengaturan per slot suara: A = karakter utama pengguna (1 suara: sekaligus narator), B = narator (project 2 suara).
const KEYS = {
  A: { provider: 'vibiProvider', model: 'vibiModel', voiceId: 'vibiVoiceId', voiceName: 'vibiVoiceName', language: 'vibiLanguage', speed: 'vibiSpeed' },
  B: { provider: 'vibi2Provider', model: 'vibi2Model', voiceId: 'vibi2VoiceId', voiceName: 'vibi2VoiceName', language: 'vibi2Language', speed: 'vibi2Speed' },
} as const;

const cleanErr = (e: unknown) => (e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '');

function VoiceSlot({ s, setS, slot }: Props & { slot: 'A' | 'B' }) {
  const k = KEYS[slot];
  // Satu provider untuk kedua suara (provider suara A).
  const provider = s.vibiProvider;
  const [search, setSearch] = useState('');
  const [indo, setIndo] = useState(true);
  const [voices, setVoices] = useState<VibiVoice[] | null>(null);
  // Daftar suara milik provider lain tidak berlaku lagi.
  useEffect(() => setVoices(null), [provider]);
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
      setVoices(await window.anima.vibiVoices({ provider, search: search.trim() || undefined, indo }));
    } catch (e) {
      toast.error(cleanErr(e));
    } finally {
      setBusy(false);
    }
  }

  const other = KEYS[slot === 'A' ? 'B' : 'A'];
  const sameModel = s[k.model] === s[other.model] && MODELS[provider].length > 1;
  const sameVoice = Boolean(s[k.voiceId]) && s[k.voiceId] === s[other.voiceId];

  return (
    <div className="grid gap-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn('grid size-7 place-items-center rounded-md text-sm font-bold', slot === 'A' ? 'bg-primary/20 text-primary' : 'bg-cyan/20 text-cyan')}>
          {slot}
        </span>
        <div>
          <div className="text-sm font-medium">{slot === 'A' ? 'Suara A (karakter utama kamu)' : 'Suara B (narator)'}</div>
          <div className="text-xs text-muted-foreground">
            {slot === 'A' ? 'Suara karakter utama yang kamu buat di Pengaturan > Karakter. Project 1 suara: karakter ini sekaligus menjadi narator.' : 'Narator untuk project 2 suara (jenis Dialog: lawan bicara). Pilih model dan suara yang berbeda dari suara A.'}
          </div>
        </div>
        {slot === 'B' && sameModel && <Badge variant="warning">Model sama dengan suara A</Badge>}
        {slot === 'B' && sameVoice && <Badge variant="warning">Suara sama dengan suara A</Badge>}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label>Model</Label>
          {provider === 'capcut' ? (
            <Input value="capcut" disabled />
          ) : (
            <>
              <Input list={`vibi-models-${slot}`} value={s[k.model] as string} onChange={(e) => set({ [k.model]: e.target.value } as Partial<Settings>)} />
              <datalist id={`vibi-models-${slot}`}>
                {MODELS[provider].map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </>
          )}
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
        <div className="flex gap-2">
          <Input placeholder="Cari suara (kosongkan untuk semua)..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} />
          <Button variant="outline" onClick={load} disabled={busy}>
            <Search /> {busy ? 'Memuat...' : 'Cari suara'}
          </Button>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-primary" checked={indo} onChange={(e) => setIndo(e.target.checked)} />
          Hanya suara asli bahasa Indonesia (logat lokal, bukan penutur asing)
        </label>
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

/** Suara lewat vibi.pro: API key + satu provider + suara A + suara B. Disimpan dengan tombol Simpan di Pengaturan. */
export function VoiceSettings({ s, setS }: Props) {
  // Ganti provider: kedua suara ikut pindah, model bawaan A dan B dibuat berbeda, suara dipilih ulang
  // (ID suara hanya berlaku di provider asalnya).
  function setProvider(p: Provider) {
    if (p === s.vibiProvider && p === s.vibi2Provider) return;
    const lang = p === 'minimax' ? 'Indonesian' : 'id';
    setS({
      ...s,
      vibiProvider: p,
      vibi2Provider: p,
      vibiModel: MODELS[p][0],
      vibi2Model: MODELS[p][1] ?? MODELS[p][0],
      vibiLanguage: lang,
      vibi2Language: lang,
      vibiVoiceId: '',
      vibiVoiceName: '',
      vibi2VoiceId: '',
      vibi2VoiceName: '',
    });
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Suara (vibi.pro)</CardTitle>
        <CardDescription>
          Script diubah jadi suara oleh vibi.pro. Semua jenis konten bisa memakai dua suara (A dan B): keduanya dari satu provider, dengan model dan suara berbeda. Memakai kredit vibi.pro.
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
        <div className="grid gap-2">
          <Label>Provider (untuk suara A dan B)</Label>
          <div className="flex flex-wrap gap-2">
            {PROVIDERS.map((p) => (
              <Button key={p.id} type="button" variant={s.vibiProvider === p.id ? 'default' : 'outline'} onClick={() => setProvider(p.id)}>
                {p.label}
              </Button>
            ))}
          </div>
          <span className="text-xs text-muted-foreground">
            {s.vibiProvider === 'capcut'
              ? 'CapCut hanya punya satu model: bedakan suara A dan B lewat pilihan suaranya.'
              : 'Ganti provider akan mengosongkan pilihan suara A dan B (pilih ulang di bawah).'}
          </span>
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
  const installing = Boolean(useTask('python')?.running);

  useEffect(() => {
    window.anima.pythonCheck().then(setPy);
  }, []);
  useTaskFinished('python', () => window.anima.pythonCheck().then(setPy));

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
              onClick={() =>
                runTask('python', { label: 'Memasang numpy & scipy', href: '/settings', step: '1-3 menit' }, () => window.anima.pythonInstall()).then(
                  (r) => (r.ok ? toast.success : toast.error)(r.ok ? 'numpy & scipy terpasang' : 'Gagal memasang', { description: r.ok ? undefined : r.log }),
                  (e) => toast.error('Gagal memasang', { description: cleanErr(e) }),
                )
              }
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
