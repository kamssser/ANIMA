// Pengaturan > Otak AI: semua sesi Claude Code dari HyperForge memakai login Claude bawaan, atau API custom
// (base URL kompatibel Anthropic + API key + model yang diambil otomatis dari server).
import { useMemo, useState } from 'react';
import { CheckCircle2, Eye, EyeOff, Loader2, RefreshCw, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Label } from '@/components/ui/misc';
import { cleanErr } from '@/lib/tasks';
import type { Settings } from '@/lib/types';
import { cn } from '@/lib/utils';

const PRESETS: { id: string; label: string; url: string; auth: Settings['brainAuth']; hint: string }[] = [
  { id: 'custom', label: 'Custom (isi sendiri)', url: '', auth: 'bearer', hint: 'Server apa saja yang kompatibel Anthropic Messages API (/v1/messages).' },
  { id: 'openrouter', label: 'OpenRouter', url: 'https://openrouter.ai/api', auth: 'bearer', hint: 'Banyak model (Claude, GPT, Gemini, Qwen, dll.) dengan satu key.' },
  { id: 'deepseek', label: 'DeepSeek', url: 'https://api.deepseek.com/anthropic', auth: 'bearer', hint: 'Endpoint Anthropic resmi DeepSeek.' },
  { id: 'zai', label: 'Z.ai (GLM)', url: 'https://api.z.ai/api/anthropic', auth: 'bearer', hint: 'Model GLM lewat endpoint Anthropic Z.ai.' },
  { id: 'moonshot', label: 'Moonshot (Kimi)', url: 'https://api.moonshot.ai/anthropic', auth: 'bearer', hint: 'Model Kimi lewat endpoint Anthropic Moonshot.' },
  { id: 'anthropic', label: 'Anthropic API key', url: 'https://api.anthropic.com', auth: 'x-api-key', hint: 'Pakai API key Anthropic (bayar per pemakaian), bukan langganan.' },
  { id: 'local', label: 'Server lokal / proxy (LiteLLM, router)', url: 'http://localhost:4000', auth: 'bearer', hint: 'Proxy di laptop sendiri yang meneruskan ke model lain.' },
];

export function BrainSettings({ s, setS }: { s: Settings; setS: (s: Settings) => void }) {
  const [models, setModels] = useState<{ id: string; name?: string; context?: number | null }[]>([]);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [show, setShow] = useState(false);
  const [filter, setFilter] = useState('');
  const custom = s.brainMode === 'custom';
  const preset = PRESETS.find((p) => p.id === s.brainPreset) ?? PRESETS[0];
  const shown = useMemo(() => models.filter((m) => `${m.id} ${m.name ?? ''}`.toLowerCase().includes(filter.toLowerCase())).slice(0, 300), [models, filter]);

  async function fetchModels() {
    if (!s.brainBaseUrl || !s.brainApiKey) return toast.error('Isi base URL dan API key dulu');
    setLoading(true);
    try {
      const r = await window.anima.brainModels({ baseUrl: s.brainBaseUrl, apiKey: s.brainApiKey, auth: s.brainAuth });
      setModels(r.models);
      toast.success(`${r.models.length} model ditemukan`);
      if (!s.brainModel && r.models[0]) setS({ ...s, brainModel: r.models[0].id });
    } catch (e) {
      toast.error('Gagal mengambil model', { description: cleanErr(e), duration: 12000 });
    } finally {
      setLoading(false);
    }
  }

  async function test() {
    if (!s.brainModel) return toast.error('Pilih model dulu');
    setTesting(true);
    try {
      const r = await window.anima.brainTest({ baseUrl: s.brainBaseUrl, apiKey: s.brainApiKey, auth: s.brainAuth, model: s.brainModel });
      toast.success(`Tersambung (${(r.ms / 1000).toFixed(1)} dtk)`, { description: `Jawaban model: ${r.reply || '(kosong)'}` });
    } catch (e) {
      toast.error('Uji gagal', { description: cleanErr(e), duration: 15000 });
    } finally {
      setTesting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Otak AI</CardTitle>
        <CardDescription>
          Model yang menulis naskah, menggambar, dan menjalankan skill di semua sesi Claude Code dari HyperForge (Generate dengan Claude, tab Claude, Karakter). Klik Simpan setelah mengubah; berlaku
          untuk sesi berikutnya.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ['claude', 'Claude bawaan', 'Login Claude Code di laptop ini (langganan Pro/Max). Paling stabil untuk semua skill.'],
              ['custom', 'API custom', 'Base URL + API key sendiri, model dipilih dari daftar server.'],
            ] as const
          ).map(([id, label, hint]) => (
            <button
              key={id}
              type="button"
              onClick={() => setS({ ...s, brainMode: id })}
              className={cn('rounded-lg border p-3 text-left transition-colors hover:border-primary/60', s.brainMode === id && 'border-primary bg-primary/10 ring-1 ring-primary/40')}
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                {s.brainMode === id && <CheckCircle2 className="size-4 text-primary" />} {label}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
            </button>
          ))}
        </div>

        {custom && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="bp">Penyedia</Label>
                <NativeSelect
                  id="bp"
                  value={preset.id}
                  onChange={(e) => {
                    const p = PRESETS.find((x) => x.id === e.target.value) ?? PRESETS[0];
                    setModels([]);
                    setS({ ...s, brainPreset: p.id, brainBaseUrl: p.url || s.brainBaseUrl, brainAuth: p.auth, brainModel: '', brainSmallModel: '' });
                  }}
                >
                  {PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </NativeSelect>
                <span className="text-xs text-muted-foreground">{preset.hint}</span>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bauth">Cara kirim key</Label>
                <NativeSelect id="bauth" value={s.brainAuth} onChange={(e) => setS({ ...s, brainAuth: e.target.value as Settings['brainAuth'] })}>
                  <option value="bearer">Authorization: Bearer (umum)</option>
                  <option value="x-api-key">x-api-key (Anthropic asli)</option>
                </NativeSelect>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="burl">Base URL</Label>
              <Input id="burl" placeholder="https://contoh.com/api/anthropic" value={s.brainBaseUrl} onChange={(e) => setS({ ...s, brainBaseUrl: e.target.value.trim() })} />
              <span className="text-xs text-muted-foreground">Tanpa /v1/messages di belakang. Server harus menerima format Anthropic (Claude Code tidak bisa langsung ke format OpenAI; pakai proxy bila perlu).</span>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bkey">API key</Label>
              <div className="flex gap-2">
                <Input id="bkey" type={show ? 'text' : 'password'} value={s.brainApiKey} onChange={(e) => setS({ ...s, brainApiKey: e.target.value.trim() })} placeholder="sk-..." />
                <Button variant="outline" size="icon" title={show ? 'Sembunyikan' : 'Tampilkan'} onClick={() => setShow(!show)}>
                  {show ? <EyeOff /> : <Eye />}
                </Button>
              </div>
              <span className="text-xs text-muted-foreground">Disimpan hanya di laptop ini (settings.json), tidak diunggah.</span>
            </div>

            <div className="grid gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label>Model</Label>
                <Button size="sm" variant="outline" onClick={fetchModels} disabled={loading}>
                  {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />} Ambil daftar model
                </Button>
              </div>
              {models.length > 0 && (
                <>
                  <Input placeholder={`Cari di ${models.length} model...`} value={filter} onChange={(e) => setFilter(e.target.value)} />
                  <div className="grid max-h-56 gap-1 overflow-y-auto rounded-md border p-1">
                    {shown.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setS({ ...s, brainModel: m.id })}
                        className={cn('flex items-center justify-between gap-3 rounded px-2 py-1.5 text-left text-sm hover:bg-accent/60', s.brainModel === m.id && 'bg-primary/15 font-medium')}
                      >
                        <span className="truncate font-mono text-xs">{m.id}</span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {m.name && m.name !== m.id ? m.name : ''}
                          {m.context ? ` · ${Math.round(m.context / 1000)}k` : ''}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <span className="text-xs text-muted-foreground">Model utama (dipilih / ketik manual)</span>
                  <Input list="brain-models" value={s.brainModel} onChange={(e) => setS({ ...s, brainModel: e.target.value.trim() })} placeholder="mis. anthropic/claude-sonnet-4.5" />
                </div>
                <div className="grid gap-1.5">
                  <span className="text-xs text-muted-foreground">Model ringan (opsional, untuk tugas kecil)</span>
                  <Input list="brain-models" value={s.brainSmallModel} onChange={(e) => setS({ ...s, brainSmallModel: e.target.value.trim() })} placeholder="kosong = sama dengan model utama" />
                </div>
              </div>
              <datalist id="brain-models">
                {models.map((m) => (
                  <option key={m.id} value={m.id} />
                ))}
              </datalist>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={test} disabled={testing || !s.brainBaseUrl || !s.brainApiKey}>
                {testing ? <Loader2 className="animate-spin" /> : <Zap />} Uji koneksi
              </Button>
              <span className="text-xs text-muted-foreground">
                Catatan: model selain Claude bisa kurang patuh pada skill panjang, dan WebSearch bawaan Claude Code mungkin tidak tersedia di server lain.
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
