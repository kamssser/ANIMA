// Storyboard cerita + teks suara (<proyek>/cerita.json). Claude menulisnya setelah naskah jadi dan menunggu;
// pengguna mengedit di sini (visual, teks layar, suara A/B, narasi) lalu menyuruh Claude lanjut dengan versi ini.
import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Loader2, Plus, RefreshCw, Save, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/misc';
import { cleanErr } from '@/lib/tasks';
import type { SkillEngine, Story, StoryScene } from '@/lib/types';
import { WORDS_PER_SECOND } from '@/lib/utils';

const blank = (): StoryScene => ({ visual: '', teks_layar: '', suara: 'A', narasi: '' });
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

export const ASK_STORY =
  'Tulis dulu storyboard cerita + teks suara ke cerita.json (lihat bagian "Storyboard cerita & teks suara" di brief), lalu berhenti dan tunggu saya mengeditnya di HyperForge.';
export const CONTINUE_STORY =
  'Storyboard & teks suara sudah saya periksa/edit di HyperForge (cerita.json). Baca ulang cerita.json sekarang, pakai narasi PERSIS seperti di file (jangan diubah) dan visual tiap adegan, lalu lanjutkan ke tahap berikutnya.';

export function StoryEditor({ engine, slug, twoVoices, busy, onSend, onClose }: { engine: SkillEngine; slug: string; twoVoices: boolean; busy: boolean; onSend: (text: string) => void; onClose: () => void }) {
  const [story, setStory] = useState<Story | null>(null);
  const [state, setState] = useState<{ loading: boolean; exists: boolean; error?: string; file?: string }>({ loading: true, exists: false });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    setState((s) => ({ ...s, loading: true }));
    try {
      const r = await window.anima.storyRead({ engine, slug });
      setState({ loading: false, exists: r.exists, error: r.error, file: r.file });
      const adegan = Array.isArray(r.data?.adegan) ? r.data!.adegan.map((a) => ({ ...blank(), ...a, suara: a.suara === 'B' ? ('B' as const) : ('A' as const) })) : [];
      setStory(r.data ? { ...r.data, adegan } : null);
      setDirty(false);
    } catch (e) {
      setState({ loading: false, exists: false, error: cleanErr(e) });
    }
  }
  useEffect(() => {
    load();
  }, [engine, slug]);

  const scenes = story?.adegan ?? [];
  const update = (next: StoryScene[]) => {
    setStory((s) => ({ ...(s ?? {}), adegan: next }));
    setDirty(true);
  };
  const patch = (i: number, p: Partial<StoryScene>) => update(scenes.map((a, k) => (k === i ? { ...a, ...p } : a)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= scenes.length) return;
    const next = [...scenes];
    [next[i], next[j]] = [next[j], next[i]];
    update(next);
  };

  async function save(thenContinue: boolean) {
    if (!story) return;
    setSaving(true);
    try {
      await window.anima.storyWrite({ engine, slug, data: { ...story, adegan: scenes } });
      setDirty(false);
      toast.success('Storyboard disimpan');
      if (thenContinue) {
        onSend(CONTINUE_STORY);
        onClose();
      }
    } catch (e) {
      toast.error('Gagal menyimpan storyboard', { description: cleanErr(e) });
    } finally {
      setSaving(false);
    }
  }

  const total = scenes.reduce((n, a) => n + words(a.narasi), 0);

  if (state.loading) return <Loader2 className="m-6 animate-spin text-muted-foreground" />;

  if (!state.exists || !story) {
    return (
      <div className="grid justify-items-center gap-3 px-4 py-10 text-center">
        <div className="font-medium">{state.error ?? 'Storyboard belum ada'}</div>
        <p className="max-w-md text-sm text-muted-foreground">
          Claude menulis storyboard cerita dan teks suara setelah naskah jadi, lalu menunggu kamu mengeditnya di sini sebelum membuat suara dan merender. Kalau sesinya sudah berjalan, kamu juga
          bisa memintanya sekarang.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load}>
            <RefreshCw /> Muat ulang
          </Button>
          <Button
            disabled={busy}
            onClick={() => {
              onSend(ASK_STORY);
              onClose();
            }}
          >
            <Send /> Minta Claude membuat storyboard
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setStory({ status: 'menunggu_edit', adegan: [blank()] });
              setState((s) => ({ ...s, exists: true }));
              setDirty(true);
            }}
          >
            <Plus /> Tulis sendiri
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex max-h-[75vh] flex-col">
      <div className="flex flex-wrap items-center gap-2 pb-3 text-xs text-muted-foreground">
        <Badge variant={story.status === 'disetujui' ? 'success' : 'secondary'}>{story.status === 'disetujui' ? 'Disetujui' : 'Menunggu diedit'}</Badge>
        <span>
          {scenes.length} adegan · {total} kata · perkiraan {Math.round(total / WORDS_PER_SECOND)} dtk suara
        </span>
        {dirty && <Badge variant="warning">Belum disimpan</Badge>}
        <span className="ml-auto truncate font-mono" title={state.file}>
          {state.file?.split(/[\\/]/).slice(-2).join('/')}
        </span>
      </div>

      <div className="grid flex-1 gap-3 overflow-y-auto pr-1">
        {scenes.map((a, i) => (
          <div key={i} className="grid gap-2 rounded-lg border bg-muted/20 p-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Adegan {i + 1}</span>
              <span className="text-xs text-muted-foreground">
                {words(a.narasi)} kata · ±{Math.max(1, Math.round(words(a.narasi) / WORDS_PER_SECOND))} dtk
              </span>
              {twoVoices && (
                <NativeSelect className="ml-2 h-8 w-auto text-xs" value={a.suara} onChange={(e) => patch(i, { suara: e.target.value === 'B' ? 'B' : 'A' })}>
                  <option value="A">Suara A (karakter)</option>
                  <option value="B">Suara B (narator)</option>
                </NativeSelect>
              )}
              <span className="ml-auto flex gap-0.5">
                <Button size="icon" variant="ghost" className="size-7" title="Naik" disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp />
                </Button>
                <Button size="icon" variant="ghost" className="size-7" title="Turun" disabled={i === scenes.length - 1} onClick={() => move(i, 1)}>
                  <ArrowDown />
                </Button>
                <Button size="icon" variant="ghost" className="size-7" title="Gandakan" onClick={() => update([...scenes.slice(0, i + 1), { ...a }, ...scenes.slice(i + 1)])}>
                  <Copy />
                </Button>
                <Button size="icon" variant="ghost" className="size-7" title="Tambah adegan di bawah" onClick={() => update([...scenes.slice(0, i + 1), blank(), ...scenes.slice(i + 1)])}>
                  <Plus />
                </Button>
                <Button size="icon" variant="ghost" className="size-7 text-destructive" title="Hapus adegan" onClick={() => update(scenes.filter((_, k) => k !== i))}>
                  <Trash2 />
                </Button>
              </span>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <label className="grid gap-1 text-xs font-medium">
                Teks suara (diucapkan persis)
                <Textarea rows={3} className="text-sm" value={a.narasi} onChange={(e) => patch(i, { narasi: e.target.value })} placeholder="Kalimat narasi adegan ini" />
              </label>
              <label className="grid gap-1 text-xs font-medium">
                Visual / adegan
                <Textarea rows={3} className="text-sm" value={a.visual} onChange={(e) => patch(i, { visual: e.target.value })} placeholder="Apa yang terlihat: tokoh, aksi, benda, kamera" />
              </label>
            </div>
            <label className="grid gap-1 text-xs font-medium">
              Teks di layar (opsional)
              <Input className="h-8 text-sm" value={a.teks_layar} onChange={(e) => patch(i, { teks_layar: e.target.value })} placeholder="Judul / kata kunci di layar" />
            </label>
          </div>
        ))}
        <Button variant="outline" onClick={() => update([...scenes, blank()])}>
          <Plus /> Tambah adegan
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t pt-3">
        <Button variant="ghost" onClick={load} disabled={saving}>
          <RefreshCw /> Muat ulang
        </Button>
        <span className="text-xs text-muted-foreground">Ubah teks suara setelah suara dibuat = suara adegan itu dibuat ulang (memakai kredit vibi.pro).</span>
        <span className="ml-auto flex gap-2">
          <Button variant="outline" onClick={() => save(false)} disabled={saving || !dirty}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />} Simpan
          </Button>
          <Button onClick={() => save(true)} disabled={saving || busy}>
            <Send /> Simpan & lanjutkan dengan Claude
          </Button>
        </span>
      </div>
    </div>
  );
}
