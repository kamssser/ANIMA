import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, Save, ZoomIn, ZoomOut } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/misc';
import { cleanErr, usePersisted } from '@/lib/tasks';
import type { Word } from '@/lib/types';
import { cn } from '@/lib/utils';

const MIN_LEN = 0.04;
const r3 = (x: number) => Math.round(x * 1000) / 1000;
const fmt = (x: number) => x.toFixed(2);

/**
 * Editor timing per kata: gelombang suara + kotak per kata (geser / tarik ujung), putar per kata, geser semua.
 * Perubahan yang belum disimpan tetap ada walau dialog ditutup atau pindah halaman.
 */
export function WordTimingDialog({ slug, open, onOpenChange, onSaved }: { slug: string; open: boolean; onOpenChange: (o: boolean) => void; onSaved?: () => void }) {
  const [original, setOriginal] = useState<Word[] | null>(null);
  const [draft, setDraft] = usePersisted<Word[] | null>(`word-timing:${slug}`, null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [peaks, setPeaks] = useState<{ data: Float32Array; rate: number; duration: number } | null>(null);
  const [zoom, setZoom] = useState(120); // piksel per detik
  const [sel, setSel] = useState(0);
  const [now, setNow] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [shiftMs, setShiftMs] = useState('50');
  const audio = useRef<HTMLAudioElement | null>(null);
  const stopAt = useRef<number | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const [view, setView] = useState({ left: 0, width: 800 });

  const words = draft ?? original ?? [];
  const dirty = Boolean(draft && original && JSON.stringify(draft) !== JSON.stringify(original));

  // Muat kata + audio saat dialog dibuka.
  useEffect(() => {
    if (!open) return;
    let url: string | null = null;
    let alive = true;
    window.anima
      .voiceWords(slug)
      .then(async (r) => {
        if (!alive) return;
        setOriginal(r.words);
        const blob = new Blob([r.audio as BlobPart], { type: 'audio/mpeg' });
        url = URL.createObjectURL(blob);
        setAudioUrl(url);
        // Puncak gelombang: 200 nilai per detik (cukup untuk zoom maksimum).
        const ctx = new AudioContext();
        const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
        ctx.close();
        const ch = buf.getChannelData(0);
        const rate = 200;
        const per = Math.max(1, Math.floor(buf.sampleRate / rate));
        const data = new Float32Array(Math.ceil(ch.length / per));
        for (let i = 0; i < data.length; i++) {
          let m = 0;
          for (let j = i * per, end = Math.min(ch.length, j + per); j < end; j++) m = Math.max(m, Math.abs(ch[j]));
          data[i] = m;
        }
        if (alive) setPeaks({ data, rate, duration: buf.duration });
      })
      .catch((e) => toast.error('Gagal membuka timing kata', { description: cleanErr(e) }));
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
      audio.current?.pause();
      setPlaying(false);
    };
  }, [open, slug]);

  const duration = peaks?.duration ?? (words.length ? words[words.length - 1].e + 1 : 10);
  const total = Math.max(1, Math.ceil(duration * zoom));

  // Gambar gelombang hanya untuk bagian yang terlihat.
  useEffect(() => {
    const c = canvas.current;
    if (!c || !peaks) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = view.width * dpr;
    c.height = 96 * dpr;
    const g = c.getContext('2d')!;
    g.scale(dpr, dpr);
    g.clearRect(0, 0, view.width, 96);
    g.fillStyle = getComputedStyle(c).color;
    for (let x = 0; x < view.width; x++) {
      const t0 = (view.left + x) / zoom;
      const i0 = Math.floor(t0 * peaks.rate);
      const i1 = Math.max(i0 + 1, Math.floor(((view.left + x + 1) / zoom) * peaks.rate));
      let m = 0;
      for (let i = i0; i < i1 && i < peaks.data.length; i++) m = Math.max(m, peaks.data[i]);
      const h = Math.max(1, m * 44);
      g.fillRect(x, 48 - h, 1, h * 2);
    }
  }, [peaks, zoom, view]);

  useEffect(() => {
    const el = scroller.current;
    if (!el || !open) return;
    const upd = () => setView({ left: el.scrollLeft, width: el.clientWidth });
    upd();
    const ro = new ResizeObserver(upd);
    ro.observe(el);
    el.addEventListener('scroll', upd, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', upd);
    };
  }, [open, peaks]);

  // Kursor putar + berhenti di akhir kata.
  useEffect(() => {
    if (!playing) return;
    let id = 0;
    const tick = () => {
      const a = audio.current;
      if (!a) return;
      setNow(a.currentTime);
      if (stopAt.current != null && a.currentTime >= stopAt.current) {
        a.pause();
        stopAt.current = null;
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [playing]);

  const activeIdx = useMemo(() => (playing ? words.findIndex((w) => now >= w.s && now < w.e) : -1), [playing, now, words]);

  function play(from: number, to?: number) {
    const a = audio.current;
    if (!a) return;
    a.currentTime = from;
    stopAt.current = to ?? null;
    a.play();
  }
  function playWord(i: number) {
    setSel(i);
    const w = words[i];
    if (w) play(w.s, w.e);
  }
  function toggle() {
    const a = audio.current;
    if (!a) return;
    if (a.paused) play(a.currentTime >= duration - 0.05 ? 0 : a.currentTime);
    else a.pause();
  }

  const update = (fn: (ws: Word[]) => Word[]) => setDraft((d) => fn([...(d ?? original ?? [])]));
  function setWord(i: number, patch: Partial<Word>) {
    update((ws) => {
      const w = { ...ws[i], ...patch };
      const lo = i > 0 ? ws[i - 1].e : 0;
      const hi = i < ws.length - 1 ? ws[i + 1].s : duration;
      w.s = r3(Math.min(Math.max(lo, w.s), hi - MIN_LEN));
      w.e = r3(Math.max(Math.min(hi, w.e), w.s + MIN_LEN));
      ws[i] = w;
      return ws;
    });
  }
  function shiftAll(sec: number) {
    update((ws) => {
      const min = Math.min(...ws.map((w) => w.s));
      const d = Math.max(sec, -min);
      return ws.map((w) => ({ ...w, s: r3(w.s + d), e: r3(Math.min(duration, w.e + d)) }));
    });
  }

  // Tarik kotak kata: tengah = geser, ujung = ubah awal/akhir.
  function startDrag(e: React.PointerEvent, i: number, mode: 'move' | 's' | 'e') {
    e.preventDefault();
    e.stopPropagation();
    setSel(i);
    const x0 = e.clientX;
    const w0 = words[i];
    const move = (ev: PointerEvent) => {
      const dt = (ev.clientX - x0) / zoom;
      if (mode === 'move') {
        const len = w0.e - w0.s;
        setWord(i, { s: w0.s + dt, e: w0.s + dt + len });
      } else if (mode === 's') setWord(i, { s: w0.s + dt });
      else setWord(i, { e: w0.e + dt });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      const r = await window.anima.saveVoiceWords({ slug, words: draft });
      setOriginal(draft);
      setDraft(null);
      toast.success(`Timing ${r.count} kata disimpan`, { description: 'Render ulang supaya teks di layar mengikuti timing baru.' });
      onSaved?.();
    } catch (e) {
      toast.error('Gagal menyimpan timing', { description: cleanErr(e) });
    } finally {
      setSaving(false);
    }
  }

  // Ikuti kata yang dipilih di gelombang.
  useEffect(() => {
    const el = scroller.current;
    const w = words[sel];
    if (!el || !w) return;
    const x = w.s * zoom;
    if (x < el.scrollLeft || x > el.scrollLeft + el.clientWidth - 80) el.scrollLeft = Math.max(0, x - el.clientWidth / 3);
  }, [sel, zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) audio.current?.pause();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-hidden sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Timing per kata {dirty && <Badge variant="warning">Belum disimpan</Badge>}
          </DialogTitle>
          <DialogDescription>
            Atur kapan tiap kata muncul di layar. Tarik kotak kata untuk menggeser, tarik ujung kiri/kanannya untuk mengubah awal/akhir, klik untuk mendengar kata itu.
          </DialogDescription>
        </DialogHeader>

        {audioUrl && <audio ref={audio} src={audioUrl} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />}

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={toggle} disabled={!audioUrl}>
            {playing ? <Pause /> : <Play />} {playing ? 'Jeda' : 'Putar'}
          </Button>
          <span className="w-20 font-mono text-xs tabular-nums text-muted-foreground">{fmt(now)} dtk</span>
          <Button size="icon" variant="ghost" className="size-8" title="Perkecil" onClick={() => setZoom((z) => Math.max(30, Math.round(z / 1.5)))}>
            <ZoomOut />
          </Button>
          <Button size="icon" variant="ghost" className="size-8" title="Perbesar" onClick={() => setZoom((z) => Math.min(600, Math.round(z * 1.5)))}>
            <ZoomIn />
          </Button>
          <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            Geser semua kata
            <Input className="h-8 w-16 text-xs" value={shiftMs} onChange={(e) => setShiftMs(e.target.value.replace(/[^\d]/g, ''))} aria-label="Milidetik" />
            ms
            <Button size="sm" variant="outline" onClick={() => shiftAll(-(Number(shiftMs) || 0) / 1000)} title="Teks muncul lebih awal">
              Lebih awal
            </Button>
            <Button size="sm" variant="outline" onClick={() => shiftAll((Number(shiftMs) || 0) / 1000)} title="Teks muncul lebih lambat">
              Lebih lambat
            </Button>
          </div>
        </div>

        {/* Gelombang + kotak kata */}
        <div
          ref={scroller}
          className="relative h-36 overflow-x-auto overflow-y-hidden rounded-md border bg-muted/40"
          onClick={(e) => {
            const el = scroller.current!;
            const t = (e.clientX - el.getBoundingClientRect().left + el.scrollLeft) / zoom;
            if (audio.current) audio.current.currentTime = t;
            setNow(t);
          }}
        >
          <div className="relative h-full" style={{ width: total }}>
            <canvas ref={canvas} className="pointer-events-none sticky left-0 top-2 h-24 text-primary/50" style={{ width: view.width }} />
            {words.map((w, i) => {
              const x = w.s * zoom;
              const wd = Math.max(3, (w.e - w.s) * zoom);
              if (x + wd < view.left - 50 || x > view.left + view.width + 50) return null;
              return (
                <div
                  key={i}
                  onPointerDown={(e) => startDrag(e, i, 'move')}
                  onClick={(e) => {
                    e.stopPropagation();
                    playWord(i);
                  }}
                  className={cn(
                    'absolute top-4 flex h-20 cursor-grab items-end overflow-hidden rounded-sm border text-[11px] leading-tight select-none',
                    i === sel ? 'border-primary bg-primary/30 text-foreground' : 'border-primary/30 bg-primary/10 text-muted-foreground',
                    i === activeIdx && 'bg-warning/40',
                  )}
                  style={{ left: x, width: wd }}
                  title={`${w.text}  ${fmt(w.s)}–${fmt(w.e)}`}
                >
                  <span className="truncate px-1 pb-0.5">{w.text}</span>
                  <span className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize hover:bg-primary/60" onPointerDown={(e) => startDrag(e, i, 's')} />
                  <span className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize hover:bg-primary/60" onPointerDown={(e) => startDrag(e, i, 'e')} />
                </div>
              );
            })}
            <div className="pointer-events-none absolute inset-y-0 w-px bg-warning" style={{ left: now * zoom }} />
          </div>
        </div>

        {/* Daftar kata */}
        <div className="grid max-h-64 grid-cols-1 gap-x-4 overflow-y-auto rounded-md border p-2 sm:grid-cols-2 lg:grid-cols-3">
          {words.map((w, i) => (
            <div key={i} className={cn('flex items-center gap-1.5 rounded px-1 py-0.5', i === sel && 'bg-primary/10', i === activeIdx && 'bg-warning/20')}>
              <span className="w-7 text-right text-[10px] tabular-nums text-muted-foreground">{i + 1}</span>
              <button type="button" className="min-w-0 flex-1 truncate text-left text-sm hover:text-primary" onClick={() => playWord(i)} title="Putar kata ini">
                {w.text}
              </button>
              <NumField value={w.s} onChange={(v) => setWord(i, { s: v })} label={`Mulai ${w.text}`} />
              <NumField value={w.e} onChange={(v) => setWord(i, { e: v })} label={`Selesai ${w.text}`} />
            </div>
          ))}
          {!words.length && <p className="p-3 text-sm text-muted-foreground">Belum ada timing kata. Aktifkan "Buat timing per kata" di Pengaturan &gt; Suara &amp; audio, lalu buat ulang suara.</p>}
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={save} disabled={!dirty || saving}>
            <Save /> Simpan timing
          </Button>
          <Button variant="ghost" onClick={() => setDraft(null)} disabled={!dirty || saving}>
            <RotateCcw /> Kembalikan
          </Button>
          <span className="ml-auto text-xs text-muted-foreground">{words.length} kata · Setelah disimpan, render ulang video.</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Angka detik yang bisa diketik; disimpan saat keluar dari kotak atau tekan Enter. */
function NumField({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const [text, setText] = useState(fmt(value));
  useEffect(() => setText(fmt(value)), [value]);
  const commit = () => {
    const v = Number(text.replace(',', '.'));
    if (Number.isFinite(v)) onChange(v);
    else setText(fmt(value));
  };
  return (
    <Input
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
      className="h-6 w-14 px-1 font-mono text-[11px] tabular-nums"
      aria-label={label}
    />
  );
}
