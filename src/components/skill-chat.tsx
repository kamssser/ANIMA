// Panel obrolan Claude untuk project bergaya skill (Animate, Bang Motion, HyperForge Studio), di dalam aplikasi.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, ChevronDown, ChevronRight, FolderOpen, Loader2, Play, RotateCcw, Send, Sparkles, Square, Terminal, User, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/input';
import { Badge, Card, CardContent } from '@/components/ui/misc';
import { listCharacters } from '@/lib/api';
import { buildAnimateBrief, buildBangBrief, buildStudioBrief } from '@/lib/content';
import { chatKey, loadChat, type ChatState } from '@/lib/skillchat';
import { visualStyle } from '@/lib/styles';
import { cleanErr, runTask, usePersisted } from '@/lib/tasks';
import type { ChatMessage, Project, SkillEngine } from '@/lib/types';
import { cn, slugify } from '@/lib/utils';
import { ENGINE_INFO } from '@/components/skill-video';

const imgCache = new Map<string, string>();

function ChatImage({ engine, file, onOpen }: { engine: SkillEngine; file: string; onOpen: (src: string) => void }) {
  const [src, setSrc] = useState<string | null | undefined>(imgCache.get(`${engine}:${file}`));
  useEffect(() => {
    if (src) return;
    window.anima.skillChatImage({ engine, file }).then((r) => {
      if (r) imgCache.set(`${engine}:${file}`, r.url);
      setSrc(r ? r.url : null);
    });
  }, [engine, file, src]);
  if (src === null) return <span className="text-xs text-muted-foreground">(gambar tidak ditemukan: {file})</span>;
  if (!src) return <div className="h-32 w-48 animate-pulse rounded-md bg-muted" />;
  return <img src={src} alt={file} onClick={() => onOpen(src)} className="max-h-80 max-w-full cursor-zoom-in rounded-md border bg-black object-contain" />;
}

/** Teks sederhana: **tebal**, `kode`, baris baru. */
function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <div className="text-sm leading-relaxed whitespace-pre-wrap">
      {parts.map((p, i) =>
        p.startsWith('**') ? <b key={i}>{p.slice(2, -2)}</b> : p.startsWith('`') ? <code key={i} className="rounded bg-muted px-1 font-mono text-[12px]">{p.slice(1, -1)}</code> : p,
      )}
    </div>
  );
}

function Question({ q, disabled, onAnswer }: { q: NonNullable<ChatMessage['question']>; disabled: boolean; onAnswer: (text: string) => void }) {
  const [sel, setSel] = useState<string[]>([]);
  return (
    <div className="mt-2 grid gap-2 rounded-lg border border-primary/40 bg-primary/5 p-3">
      {q.pertanyaan && <div className="text-sm font-medium">{q.pertanyaan}</div>}
      <div className="flex flex-wrap gap-2">
        {q.pilihan.map((p, i) =>
          q.multi ? (
            <label key={i} className={cn('flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm', sel.includes(p) && 'border-primary bg-primary/15')}>
              <input type="checkbox" className="accent-primary" disabled={disabled} checked={sel.includes(p)} onChange={(e) => setSel((s) => (e.target.checked ? [...s, p] : s.filter((x) => x !== p)))} />
              {p}
            </label>
          ) : (
            <Button key={i} size="sm" variant={i === 0 ? 'default' : 'outline'} disabled={disabled} onClick={() => onAnswer(p)} className="h-auto py-1.5 text-left whitespace-normal">
              {p}
            </Button>
          ),
        )}
      </div>
      {q.multi && (
        <div>
          <Button size="sm" disabled={disabled || !sel.length} onClick={() => onAnswer(sel.join('; '))}>
            Kirim pilihan
          </Button>
        </div>
      )}
    </div>
  );
}

/** Kelompokkan pesan alat berturut-turut supaya obrolan tetap rapi. */
type Block = { kind: 'msg'; m: ChatMessage } | { kind: 'tools'; items: ChatMessage[] };
function blocks(ms: ChatMessage[]): Block[] {
  const out: Block[] = [];
  for (const m of ms) {
    const last = out[out.length - 1];
    if (m.role === 'tool') {
      if (last?.kind === 'tools') last.items.push(m);
      else out.push({ kind: 'tools', items: [m] });
    } else out.push({ kind: 'msg', m });
  }
  return out;
}

function ToolGroup({ engine, items, live, onOpen }: { engine: SkillEngine; items: ChatMessage[]; live: boolean; onOpen: (s: string) => void }) {
  const [open, setOpen] = useState(false);
  const imgs = items.flatMap((m) => m.images ?? []);
  return (
    <div className="pl-9">
      <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground" onClick={() => setOpen((o) => !o)}>
        {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        {live ? <Loader2 className="size-3.5 animate-spin" /> : <Wrench className="size-3.5" />}
        {live ? items[items.length - 1].text : `${items.length} langkah kerja`}
      </button>
      {open && (
        <div className="mt-1 grid gap-0.5 border-l pl-3 font-mono text-[11px] text-muted-foreground">
          {items.map((m) => (
            <div key={m.id} className="truncate">
              {m.text}
            </div>
          ))}
        </div>
      )}
      {/* Gambar yang sedang dilihat Claude hanya tampil selama bekerja; hasil akhirnya ada di pesan Claude. */}
      {live && imgs.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {[...new Set(imgs)].slice(-1).map((f) => (
            <ChatImage key={f} engine={engine} file={f} onOpen={onOpen} />
          ))}
        </div>
      )}
    </div>
  );
}

export function SkillChat({ project, beforeRun }: { project: Project; beforeRun: () => Promise<Project> }) {
  const st = visualStyle(project.visual_style);
  const engine = (st.engine ?? 'animate') as SkillEngine;
  const info = ENGINE_INFO[engine];
  const slug = slugify(project.title);
  const key = chatKey(engine, slug);
  const [chat] = usePersisted<ChatState>(key, { loaded: false, messages: [], running: false, hasSession: false });
  const [text, setText] = useState('');
  const [big, setBig] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  // Folder frame referensi gaya (opsional), diingat per style di laptop ini.
  const refKey = `hf-ref:${st.id}`;
  const [refDir, setRefDir] = useState<string>(() => localStorage.getItem(refKey) || '');
  const end = useRef<HTMLDivElement | null>(null);
  const busy = chat.running || sending;

  useEffect(() => {
    loadChat(engine, slug);
  }, [engine, slug]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [chat.messages.length, chat.running]);
  // Tetap menempel ke bawah saat gambar selesai dimuat (kalau pengguna memang sedang di bawah).
  const scroller = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const inner = el.firstElementChild;
    if (!inner) return;
    let last = el.scrollHeight;
    const ro = new ResizeObserver(() => {
      const nearBottom = last - el.scrollTop - el.clientHeight < 200;
      if (nearBottom) el.scrollTop = el.scrollHeight;
      last = el.scrollHeight;
    });
    ro.observe(inner);
    return () => ro.disconnect();
  }, [chat.loaded, chat.messages.length > 0]);

  const lastAssistant = useMemo(() => [...chat.messages].reverse().find((m) => m.role === 'assistant' || m.role === 'user'), [chat.messages]);

  async function send(msg?: string) {
    const t = (msg ?? text).trim();
    if (!chat.hasSession && !msg && !t) return start();
    if (!t) return;
    setText('');
    setSending(true);
    try {
      await runTask(`${key}:turn`, { label: `Claude: ${project.title}`, href: `/projects/${project.id}`, step: 'Bekerja...' }, () => window.anima.skillChatSend({ engine, slug, title: project.title, text: t }));
    } catch (e) {
      toast.error('Gagal mengirim ke Claude', { description: cleanErr(e) });
    } finally {
      setSending(false);
    }
  }

  async function start() {
    setSending(true);
    try {
      const fresh = await beforeRun();
      let brief: string;
      const files: Record<string, string> = {};
      if (engine === 'studio') {
        const chars = await listCharacters().catch(() => []);
        for (const c of chars) if (c.svg) files[`karakter-hyperforge/${c.key}.svg`] = c.svg;
        brief = buildStudioBrief(fresh, slug, chars.map((c) => ({ key: c.key, name: c.name, nickname: c.nickname, is_main: c.is_main, personality: c.personality, appearance: c.appearance, hasSvg: Boolean(c.svg) })));
      } else brief = engine === 'bang-motion' ? buildBangBrief(fresh, slug) : buildAnimateBrief(fresh, slug);
      await runTask(`${key}:turn`, { label: `Claude: ${fresh.title}`, href: `/projects/${project.id}`, step: 'Memulai skill...' }, () =>
        window.anima.skillChatSend({ engine, slug, title: fresh.title, brief, files, refDir: refDir || undefined }),
      );
    } catch (e) {
      toast.error('Gagal memulai', { description: cleanErr(e), duration: 12000 });
    } finally {
      setSending(false);
    }
  }

  async function reset() {
    if (!window.confirm('Mulai percakapan baru? Riwayat obrolan ini dihapus (file proyek dan video tetap ada).')) return;
    try {
      await window.anima.skillChatReset({ engine, slug });
      await loadChat(engine, slug);
    } catch (e) {
      toast.error(cleanErr(e));
    }
  }

  async function playVideo(file: string) {
    const p = await window.anima.skillChatResolve({ engine, file });
    if (p) window.anima.openPath(p);
    else toast.error('Video tidak ditemukan', { description: file });
  }

  const bl = blocks(chat.messages);

  return (
    <Card className="flex h-[calc(100vh-15rem)] min-h-[520px] flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <Sparkles className="size-4 text-primary" />
        <span className="text-sm font-medium">
          {st.label} <span className="font-normal text-muted-foreground">· skill {info.title}</span>
        </span>
        {busy && (
          <Badge variant="secondary" className="gap-1">
            <Loader2 className="size-3 animate-spin" /> Claude bekerja
          </Badge>
        )}
        <span className="ml-auto flex gap-1">
          {busy && (
            <Button size="sm" variant="outline" onClick={() => window.anima.skillChatStop({ engine, slug })}>
              <Square /> Hentikan
            </Button>
          )}
          {chat.hasSession && !busy && (
            <Button size="sm" variant="ghost" onClick={reset} title="Percakapan baru">
              <RotateCcw /> Percakapan baru
            </Button>
          )}
        </span>
      </div>

      <CardContent ref={scroller} className="flex-1 overflow-y-auto p-4">
        {!chat.loaded ? (
          <Loader2 className="animate-spin text-muted-foreground" />
        ) : chat.messages.length === 0 ? (
          <div className="mx-auto grid max-w-md justify-items-center gap-3 py-10 text-center">
            <Bot className="size-10 text-primary" />
            <div className="font-medium">Kerjakan video ini bersama Claude</div>
            <p className="text-sm text-muted-foreground">{info.flow} Semua pertanyaan dan gambar contoh muncul di sini; kamu tinggal klik pilihan atau mengetik revisi.</p>
            <div className="grid w-full gap-1.5 rounded-lg border bg-muted/30 p-3 text-left text-xs">
              <span className="font-medium text-foreground">Frame referensi gaya (opsional)</span>
              <span className="text-muted-foreground">
                Folder berisi frame/screenshot video yang gayanya mau ditiru. Claude melihatnya sebagai acuan (sekitar 90% mirip), tokoh dan adegan tetap orisinal. Hanya disimpan di laptop ini.
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={async () => {
                    const d = await window.anima.pickFolder('Pilih folder frame referensi gaya');
                    if (!d) return;
                    setRefDir(d);
                    localStorage.setItem(refKey, d);
                  }}
                >
                  <FolderOpen /> {refDir ? 'Ganti folder' : 'Pilih folder'}
                </Button>
                {refDir && (
                  <>
                    <span className="min-w-0 truncate font-mono" title={refDir}>
                      {refDir}
                    </span>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setRefDir('');
                        localStorage.removeItem(refKey);
                      }}
                    >
                      hapus
                    </button>
                  </>
                )}
              </div>
            </div>
            <Button onClick={start} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Play />} Mulai
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {bl.map((b, i) =>
              b.kind === 'tools' ? (
                <ToolGroup key={b.items[0].id} engine={engine} items={b.items} live={busy && i === bl.length - 1} onOpen={setBig} />
              ) : (
                <div key={b.m.id} className={cn('flex gap-3', b.m.role === 'user' && 'flex-row-reverse')}>
                  <div className={cn('grid size-7 shrink-0 place-items-center rounded-full', b.m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                    {b.m.role === 'user' ? <User className="size-4" /> : b.m.role === 'system' ? <Terminal className="size-4" /> : <Bot className="size-4" />}
                  </div>
                  <div
                    className={cn(
                      'min-w-0 max-w-[85%] rounded-xl px-3.5 py-2.5',
                      b.m.role === 'user' ? 'bg-primary/15' : b.m.role === 'system' ? (b.m.error ? 'bg-destructive/10 text-destructive' : 'bg-muted/50 text-muted-foreground') : 'bg-muted/60',
                    )}
                  >
                    {b.m.text && <RichText text={b.m.text} />}
                    {(b.m.images?.length ?? 0) > 0 && (
                      <div className="mt-2 grid gap-2">
                        {b.m.images!.map((f) => (
                          <ChatImage key={f} engine={engine} file={f} onOpen={setBig} />
                        ))}
                      </div>
                    )}
                    {(b.m.videos?.length ?? 0) > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {b.m.videos!.map((f) => (
                          <Button key={f} size="sm" variant="outline" onClick={() => playVideo(f)}>
                            <Play /> {f.split(/[\\/]/).pop()}
                          </Button>
                        ))}
                      </div>
                    )}
                    {b.m.question && <Question q={b.m.question} disabled={busy || b.m !== lastAssistant} onAnswer={(t) => send(t)} />}
                  </div>
                </div>
              ),
            )}
            {busy && bl[bl.length - 1]?.kind !== 'tools' && (
              <div className="flex items-center gap-2 pl-10 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> Claude sedang berpikir...
              </div>
            )}
            <div ref={end} />
          </div>
        )}
      </CardContent>

      {chat.messages.length > 0 && (
        <div className="flex gap-2 border-t p-3">
          <Textarea
            rows={2}
            value={text}
            placeholder={busy ? 'Claude sedang bekerja... (pesan bisa dikirim setelah selesai)' : 'Ketik jawaban atau revisi, mis. "shot 5 kameranya mundur sedikit". Enter = kirim, Shift+Enter = baris baru'}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!busy) send();
              }
            }}
            className="min-h-0 flex-1 resize-none"
          />
          <Button onClick={() => send()} disabled={busy || !text.trim()} className="self-end">
            <Send /> Kirim
          </Button>
        </div>
      )}

      <Dialog open={Boolean(big)} onOpenChange={(o) => !o && setBig(null)}>
        <DialogContent className="max-h-[94vh] overflow-auto sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle>Pratinjau</DialogTitle>
          </DialogHeader>
          {big && <img src={big} alt="" className="w-full rounded-md" />}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
