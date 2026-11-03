import { useEffect, useState } from 'react';
import { Crown, Pencil, Plus, Sparkles, Trash2, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Label, Skeleton } from '@/components/ui/misc';
import { MAX_CHARACTERS, deleteCharacter, listCharacters, saveCharacter } from '@/lib/api';
import { RigPreview } from '@/lib/rig-preview';
import { STYLES_2D, visualStyle } from '@/lib/styles';
import type { Character } from '@/lib/types';
import { cn } from '@/lib/utils';
import { cleanErr, runTask, setValue, usePersisted, useTask } from '@/lib/tasks';

/** kunci pendek dari nama: "Budi Santoso" -> "budi-santoso" */
const keyOf = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24) || 'tokoh';

type Draft = Omit<Character, 'id' | 'version' | 'updated_at'> & { id?: string; version?: number };

const emptyDraft = (isMain: boolean): Draft => ({
  key: '',
  name: '',
  nickname: '',
  is_main: isMain,
  personality: '',
  appearance: '',
  visual_style: 'sinema',
  svg: '',
});

type EditorState = { initial: Draft; d: Draft; feedback: string; sessionId?: string; problems: string[] };
/** Isian editor disimpan global supaya tidak hilang saat pindah halaman (termasuk hasil gambar yang belum disimpan). */
const EDITOR = 'characters:editor';
const startEditor = (initial: Draft): EditorState => ({ initial, d: initial, feedback: '', problems: [] });

function Editor({ others, onClose, onSaved }: { others: Character[]; onClose: () => void; onSaved: () => void }) {
  const [ed, setEd] = usePersisted<EditorState | null>(EDITOR, null);
  const task = useTask('character');
  const generating = Boolean(task?.running);
  const [saving, setSaving] = useState(false);
  const busy = generating || saving;
  const step = generating ? task!.step : '';
  const [talking, setTalking] = useState(false);
  if (!ed) return null;
  const { initial, d, feedback, sessionId, problems } = ed;
  const unsaved = Boolean(d.svg) && JSON.stringify(d) !== JSON.stringify(initial);
  const close = () => {
    if (unsaved && !window.confirm('Karakter belum disimpan. Tutup dan buang perubahan?')) return;
    onClose();
  };
  const set = (p: Partial<Draft>) => setEd((x) => (x ? { ...x, d: { ...x.d, ...p } } : x));
  const setFeedback = (feedback: string) => setEd((x) => (x ? { ...x, feedback } : x));

  function generate(withFeedback: boolean) {
    if (!d.name.trim()) {
      toast.error('Isi nama karakter dulu.');
      return;
    }
    const name = d.name.trim();
    runTask('character', { label: `Menggambar ${name}`, href: '/settings', step: 'Menyiapkan Claude...' }, () =>
      window.anima.generateCharacter({
        id: 'editor',
        character: { name: d.name, nickname: d.nickname, is_main: d.is_main, personality: d.personality, appearance: d.appearance, visual_style: d.visual_style },
        feedback: withFeedback ? feedback.trim() : undefined,
        sessionId: withFeedback ? sessionId : undefined,
      }),
    ).then(
      (r) => {
        // Ditulis ke store, bukan state komponen: hasil tetap masuk walau halaman Pengaturan sedang ditutup.
        setValue<EditorState | null>(EDITOR, (x) =>
          x ? { ...x, d: { ...x.d, svg: r.svg }, sessionId: r.sessionId, problems: r.problems ?? [], feedback: withFeedback ? '' : x.feedback } : x,
        );
        if (r.problems?.length) toast.warning(`Gambar ${name} jadi, tapi ada bagian animasi yang kurang`, { description: r.problems.join(' ') });
        else toast.success(`Gambar ${name} jadi`, { description: 'Buka Pengaturan > Karakter. Kalau sudah cocok, klik "Simpan karakter".' });
      },
      (e) => toast.error('Gagal menggambar', { description: cleanErr(e) }),
    );
  }

  async function save() {
    if (!d.name.trim()) return toast.error('Nama wajib diisi.');
    if (!d.svg) return toast.error('Generate gambar karakter dulu sampai cocok, baru simpan.');
    const key = d.key || keyOf(d.nickname || d.name);
    if (others.some((o) => o.key === key && o.id !== d.id)) return toast.error(`Nama panggilan "${key}" sudah dipakai karakter lain.`);
    setSaving(true);
    try {
      await saveCharacter({ ...d, key, name: d.name.trim(), nickname: d.nickname.trim(), version: (d.version ?? 0) + (d.id ? 1 : 0) || 1 });
      toast.success(`Karakter ${d.name} disimpan`);
      onSaved();
    } catch (e) {
      toast.error('Gagal menyimpan', { description: cleanErr(e) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{d.id ? `Ubah karakter: ${initial.name}` : d.is_main ? 'Karakter utama baru' : 'Karakter baru'}</CardTitle>
        <CardDescription>Claude menggambar karakter sebagai kode (gratis, memakai langganan Claude). Revisi sampai cocok, lalu Simpan.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 md:grid-cols-[1fr_260px]">
        <div className="grid content-start gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="cn">Nama</Label>
              <Input id="cn" value={d.name} placeholder="mis. Budi Santoso" onChange={(e) => set({ name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cnick">Nama panggilan</Label>
              <Input id="cnick" value={d.nickname} placeholder="mis. Budi" onChange={(e) => set({ nickname: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cp">Sifat</Label>
            <Textarea id="cp" rows={2} value={d.personality} placeholder="mis. ceroboh tapi baik hati, suka bercanda, gampang panik" onChange={(e) => set({ personality: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ca">Penampilan (opsional)</Label>
            <Textarea id="ca" rows={2} value={d.appearance} placeholder="mis. laki-laki 25 tahun, rambut cepak, kaos ungu, celana jeans" onChange={(e) => set({ appearance: e.target.value })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="cs">Gaya gambar</Label>
              <NativeSelect id="cs" value={visualStyle(d.visual_style).id} onChange={(e) => set({ visual_style: e.target.value })}>
                {STYLES_2D.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={d.is_main}
                disabled={initial.is_main || others.some((o) => o.is_main && o.id !== d.id)}
                onChange={(e) => set({ is_main: e.target.checked })}
              />
              Karakter utama
            </label>
          </div>
          <span className="-mt-2 text-xs text-muted-foreground">{visualStyle(d.visual_style).description}</span>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => generate(false)} disabled={busy}>
              <Sparkles /> {d.svg ? 'Gambar ulang dari awal' : 'Generate gambar'}
            </Button>
            {busy && (
              <Button variant="outline" onClick={() => window.anima.cancelCharacter()}>
                Batal
              </Button>
            )}
          </div>

          {d.svg && (
            <div className="grid gap-2 rounded-md border p-3">
              <Label htmlFor="cf">Revisi (tulis apa yang mau diubah)</Label>
              <Textarea id="cf" rows={2} value={feedback} placeholder="mis. rambutnya lebih panjang, bajunya warna hijau, wajahnya lebih ramah" onChange={(e) => setFeedback(e.target.value)} />
              <div>
                <Button variant="outline" onClick={() => generate(true)} disabled={busy || !feedback.trim()}>
                  <Wand2 /> Revisi gambar
                </Button>
              </div>
            </div>
          )}

          {step && <p className="text-sm text-muted-foreground">{step}</p>}

          <div className="flex gap-2 border-t pt-4">
            <Button onClick={save} disabled={busy || !d.svg}>
              Simpan karakter
            </Button>
            <Button variant="ghost" onClick={close} disabled={busy}>
              Tutup
            </Button>
            {unsaved && !busy && <Badge variant="warning" className="self-center">Belum disimpan, klik Simpan karakter</Badge>}
          </div>
        </div>

        <div className="grid content-start gap-2">
          <div className="flex aspect-[1/2] items-end justify-center overflow-hidden rounded-lg border bg-gradient-to-b from-sky-100 to-amber-50">
            {busy && !d.svg ? (
              <Skeleton className="size-full" />
            ) : d.svg ? (
              <RigPreview svg={d.svg} talking={talking} className={cn('size-full', busy && 'opacity-50')} />
            ) : (
              <span className="m-auto px-4 text-center text-sm text-muted-foreground">Gambar karakter muncul di sini</span>
            )}
          </div>
          {d.svg && (
            <Button size="sm" variant="outline" onClick={() => setTalking((t) => !t)}>
              {talking ? 'Hentikan bicara' : 'Coba bicara'}
            </Button>
          )}
          {problems.length > 0 && <p className="text-xs text-warning">{problems.join(' ')}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

/** Pengaturan > Karakter: 1 utama wajib, maks 10, digambar Claude. */
export function CharacterSettings() {
  const [list, setList] = useState<Character[] | null>(null);
  const [editing, setEditing] = usePersisted<EditorState | null>(EDITOR, null);
  const [confirm, setConfirm] = useState<Character | null>(null);
  const [toDelete, setToDelete] = useState<Character | null>(null);

  const load = () =>
    listCharacters()
      .then(setList)
      .catch((e) => {
        setList([]);
        toast.error(cleanErr(e));
      });
  useEffect(() => {
    load();
  }, []);

  const hasMain = list?.some((c) => c.is_main);
  const full = (list?.length ?? 0) >= MAX_CHARACTERS;

  if (editing) {
    return (
      <Editor
        others={list ?? []}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          load();
        }}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Karakter</CardTitle>
        <CardDescription>
          Dipakai style 2D (Motion comic, Indie sinematik, Sketsa muram, Pastel lembut). Wajib 1 karakter utama, bisa ditambah sampai {MAX_CHARACTERS} karakter dengan sifat dan nama panggilan sendiri.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {list === null ? (
          <Skeleton className="h-32" />
        ) : (
          <>
            {!hasMain && (
              <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
                Belum ada karakter utama. Buat dulu 1 karakter utama sebelum membuat video 2D.
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((c) => (
                <div key={c.id} className="flex gap-3 rounded-lg border p-3">
                  <div className="h-28 w-14 shrink-0 overflow-hidden rounded-md bg-gradient-to-b from-sky-100 to-amber-50">
                    {c.svg && <RigPreview svg={c.svg} className="size-full" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 font-medium">
                      <span className="truncate">{c.name}</span>
                      {c.is_main && (
                        <Badge variant="warning">
                          <Crown className="size-3" /> Utama
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {c.nickname ? `"${c.nickname}" · ` : ''}
                      {visualStyle(c.visual_style).label}
                    </div>
                    {c.personality && <div className="mt-1 line-clamp-2 text-xs">{c.personality}</div>}
                    <div className="mt-2 flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => setConfirm(c)}>
                        <Pencil /> Ubah
                      </Button>
                      {!c.is_main && (
                        <Button size="sm" variant="ghost" title="Hapus" onClick={() => setToDelete(c)}>
                          <Trash2 />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div>
              <Button onClick={() => setEditing(startEditor(emptyDraft(!hasMain)))} disabled={full}>
                <Plus /> {hasMain ? 'Tambah karakter' : 'Buat karakter utama'}
              </Button>
              {full && <span className="ml-3 text-sm text-muted-foreground">Sudah {MAX_CHARACTERS} karakter (maksimal).</span>}
            </div>
          </>
        )}
      </CardContent>

      <Dialog open={Boolean(confirm)} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yakin mau mengubah {confirm?.name}?</DialogTitle>
            <DialogDescription>
              Karakter ini sudah disimpan. Kalau diubah, semua video yang memakai {confirm?.nickname || confirm?.name} akan memakai tampilan baru saat dirender ulang.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              Tidak yakin
            </Button>
            <Button
              onClick={() => {
                if (confirm) setEditing(startEditor({ ...confirm }));
                setConfirm(null);
              }}
            >
              Yakin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(toDelete)} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus {toDelete?.name}?</DialogTitle>
            <DialogDescription>Karakter yang dihapus tidak bisa dikembalikan.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToDelete(null)}>
              Tidak yakin
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                const c = toDelete;
                setToDelete(null);
                if (!c) return;
                try {
                  await deleteCharacter(c.id);
                  load();
                } catch (e) {
                  toast.error(cleanErr(e));
                }
              }}
            >
              Yakin, hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
