// Log sesi Claude untuk project bergaya skill: perintah yang dijalankan, hasilnya, dan error (dari electron/skillchat.cjs).
import { useEffect, useRef, useState } from 'react';
import { Copy, FolderOpen, Loader2, RefreshCw, ScrollText } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/misc';
import type { SkillEngine } from '@/lib/types';
import { cn, formatDate } from '@/lib/utils';

const ENGINES: SkillEngine[] = ['studio', 'animate', 'bang-motion'];
const ENGINE_LABEL: Record<SkillEngine, string> = { studio: 'HyperForge Studio', animate: 'Animate', 'bang-motion': 'Bang Motion' };

/** Isi log satu sesi, diperbarui tiap 2 detik selama terbuka. */
export function LogView({ engine, slug, className }: { engine: SkillEngine; slug: string; className?: string }) {
  const [text, setText] = useState<string | null>(null);
  const [follow, setFollow] = useState(true);
  const box = useRef<HTMLPreElement | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => window.anima.skillChatLogTail({ engine, slug }).then((t) => alive && setText(t));
    load();
    const id = setInterval(load, 2000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [engine, slug]);
  useEffect(() => {
    if (follow && box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [text, follow]);
  return (
    <div className={cn('grid gap-2', className)}>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" className="accent-primary" checked={follow} onChange={(e) => setFollow(e.target.checked)} /> Ikuti baris terbaru
        </label>
        <span className="ml-auto flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              navigator.clipboard.writeText(text ?? '');
              toast.success('Log disalin');
            }}
          >
            <Copy /> Salin
          </Button>
          <Button size="sm" variant="ghost" onClick={() => window.anima.skillOpenFolder({ engine, slug })}>
            <FolderOpen /> Folder proyek
          </Button>
        </span>
      </div>
      <pre ref={box} className="h-[55vh] overflow-auto rounded-md border bg-black/80 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-zinc-200">
        {text === null ? 'Memuat...' : text || 'Belum ada log untuk sesi ini.'}
      </pre>
      <p className="text-[11px] text-muted-foreground">
        MULAI/SESI = awal giliran · ALAT = perintah yang dijalankan Claude · HASIL = keluarannya · ERROR/STDERR = masalah · SELESAI/KELUAR = akhir giliran. Render panjang memang hanya
        menulis HASIL setelah selesai.
      </p>
    </div>
  );
}

/** Pengaturan > Log. */
export function LogSettings() {
  const [list, setList] = useState<Awaited<ReturnType<typeof window.anima.skillChatLogs>> | null>(null);
  const [sel, setSel] = useState<{ engine: SkillEngine; slug: string } | null>(null);
  const load = () =>
    window.anima.skillChatLogs(ENGINES).then((l) => {
      setList(l);
      setSel((s) => s ?? (l[0] ? { engine: l[0].engine, slug: l[0].slug } : null));
    });
  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ScrollText className="size-5" /> Log sesi Claude
        </CardTitle>
        <CardDescription>Catatan lengkap pekerjaan Claude di tab Claude (Animate, Bang Motion, HyperForge Studio): perintah, hasil, dan error. Berguna saat Claude terasa lama atau macet.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-[240px_1fr]">
        <div className="grid content-start gap-1">
          <Button size="sm" variant="ghost" className="justify-start" onClick={load}>
            <RefreshCw /> Muat ulang
          </Button>
          {!list ? (
            <Loader2 className="animate-spin text-muted-foreground" />
          ) : list.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada sesi.</p>
          ) : (
            list.map((l) => (
              <button
                key={`${l.engine}:${l.slug}`}
                onClick={() => setSel({ engine: l.engine, slug: l.slug })}
                className={cn('grid gap-0.5 rounded-md px-2.5 py-2 text-left text-xs hover:bg-accent/60', sel?.engine === l.engine && sel.slug === l.slug && 'bg-primary/15 ring-1 ring-primary/30')}
              >
                <span className="flex items-center gap-1.5 truncate font-medium text-foreground">
                  {l.running && <Loader2 className="size-3 shrink-0 animate-spin text-primary" />}
                  <span className="truncate">{l.slug}</span>
                </span>
                <span className="text-muted-foreground">
                  {ENGINE_LABEL[l.engine]} · {formatDate(l.mtime)}
                </span>
              </button>
            ))
          )}
        </div>
        <div className="min-w-0">
          {sel ? (
            <>
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                {sel.slug} <Badge variant="secondary">{ENGINE_LABEL[sel.engine]}</Badge>
              </div>
              <LogView key={`${sel.engine}:${sel.slug}`} engine={sel.engine} slug={sel.slug} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Pilih sesi di kiri.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
