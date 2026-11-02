import { useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, Play, Search, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Label } from '@/components/ui/misc';
import type { PythonCheck, Settings, VibiVoice } from '@/lib/types';
import { cn } from '@/lib/utils';

type Props = { s: Settings; setS: (s: Settings) => void };

const MODELS: Record<Settings['vibiProvider'], string[]> = {
  elevenlabs: ['eleven_multilingual_v2', 'eleven_v3', 'eleven_flash_v2_5', 'eleven_turbo_v2_5'],
  minimax: ['speech-2.8-turbo'],
  capcut: ['capcut'],
};

/** Suara narasi lewat vibi.pro. Disimpan bersama tombol Simpan di halaman Pengaturan. */
export function VoiceSettings({ s, setS }: Props) {
  const [search, setSearch] = useState('');
  const [voices, setVoices] = useState<VibiVoice[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [audio] = useState(() => new Audio());

  useEffect(() => () => audio.pause(), [audio]);

  async function load() {
    if (!s.vibiApiKey) {
      toast.error('Isi API key vibi.pro dulu.');
      return;
    }
    setBusy(true);
    try {
      // Key baru harus tersimpan dulu supaya proses utama bisa memakainya.
      await window.anima.saveSettings({ vibiApiKey: s.vibiApiKey });
      setVoices(await window.anima.vibiVoices(search.trim() || undefined));
    } catch (e) {
      toast.error((e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Suara narasi (vibi.pro)</CardTitle>
        <CardDescription>
          Script diubah jadi suara oleh vibi.pro, lalu disimpan sebagai voice/voice.wav 48 kHz untuk skill. Memakai kredit vibi.pro.
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

        <div className="grid gap-4 sm:grid-cols-4">
          <div className="grid gap-2">
            <Label htmlFor="vp">Provider</Label>
            <NativeSelect
              id="vp"
              value={s.vibiProvider}
              onChange={(e) => {
                const p = e.target.value as Settings['vibiProvider'];
                setS({ ...s, vibiProvider: p, vibiModel: MODELS[p][0], vibiLanguage: p === 'minimax' ? 'Indonesian' : 'id' });
              }}
            >
              <option value="elevenlabs">ElevenLabs</option>
              <option value="minimax">MiniMax</option>
              <option value="capcut">CapCut</option>
            </NativeSelect>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="vm">Model</Label>
            <Input id="vm" list="vibi-models" value={s.vibiModel} onChange={(e) => setS({ ...s, vibiModel: e.target.value })} />
            <datalist id="vibi-models">
              {MODELS[s.vibiProvider].map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="vl">Bahasa</Label>
            <Input id="vl" value={s.vibiLanguage} onChange={(e) => setS({ ...s, vibiLanguage: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="vs">Kecepatan</Label>
            <Input id="vs" type="number" step={0.05} min={0.5} max={2} value={s.vibiSpeed} onChange={(e) => setS({ ...s, vibiSpeed: Number(e.target.value) })} />
          </div>
        </div>

        <div className="grid gap-2">
          <Label>Suara terpilih</Label>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="max-w-xs"
              placeholder="voice_id"
              value={s.vibiVoiceId}
              onChange={(e) => setS({ ...s, vibiVoiceId: e.target.value.trim(), vibiVoiceName: '' })}
            />
            {s.vibiVoiceName && <span className="text-sm text-muted-foreground">{s.vibiVoiceName}</span>}
          </div>
          {s.vibiProvider === 'elevenlabs' ? (
            <div className="flex gap-2">
              <Input placeholder="Cari suara (mis. narrator, female)..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} />
              <Button variant="outline" onClick={load} disabled={busy}>
                <Search /> {busy ? 'Memuat...' : 'Cari suara'}
              </Button>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">Untuk {s.vibiProvider}, salin voice_id dari dashboard vibi.pro.</span>
          )}
        </div>

        {voices && (
          <div className="max-h-72 overflow-y-auto rounded-md border">
            {voices.length === 0 && <p className="p-3 text-sm text-muted-foreground">Tidak ada suara.</p>}
            {voices.map((v) => (
              <div
                key={v.id}
                className={cn('flex items-center gap-3 border-b px-3 py-2 last:border-0', s.vibiVoiceId === v.id && 'bg-accent')}
              >
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
                  <div className="truncate text-xs text-muted-foreground">
                    {[v.gender, v.accent, v.description].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <Button size="sm" variant={s.vibiVoiceId === v.id ? 'default' : 'outline'} onClick={() => setS({ ...s, vibiVoiceId: v.id, vibiVoiceName: v.name })}>
                  {s.vibiVoiceId === v.id ? 'Dipilih' : 'Pilih'}
                </Button>
              </div>
            ))}
          </div>
        )}

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
