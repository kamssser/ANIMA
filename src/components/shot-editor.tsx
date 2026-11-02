import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Card, CardContent, Label } from '@/components/ui/misc';
import { addShot, deleteShot, swapShots, updateShot } from '@/lib/api';
import type { Shot } from '@/lib/types';
import { FPS, cn, formatSeconds, framesToSeconds } from '@/lib/utils';

const CAMERA_PRESETS = ['wide establishing', 'medium', 'close-up', 'over-the-shoulder', 'dolly in', 'dolly out', 'pan left', 'pan right', 'crane up', 'orbit'];

export function ShotEditor({ projectId, shots, onChange }: { projectId: string; shots: Shot[]; onChange: () => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = shots.find((s) => s.id === selectedId) ?? shots[0] ?? null;
  const total = framesToSeconds(shots.reduce((n, s) => n + s.duration_frames, 0));

  async function add() {
    try {
      const nextIdx = shots.length ? Math.max(...shots.map((s) => s.idx)) + 1 : 1;
      const s = await addShot(projectId, nextIdx);
      setSelectedId(s.id);
      onChange();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function move(i: number, dir: -1 | 1) {
    const a = shots[i];
    const b = shots[i + dir];
    if (!a || !b) return;
    try {
      await swapShots(a, b);
      onChange();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <Card>
        <CardContent className="flex flex-col gap-1 p-2">
          <div className="flex items-center justify-between px-2 py-1 text-xs text-muted-foreground">
            <span>Total {formatSeconds(total)}</span>
            <Button size="sm" variant="ghost" onClick={add}>
              <Plus /> Shot
            </Button>
          </div>
          {shots.length === 0 && <p className="p-3 text-sm text-muted-foreground">Belum ada shot. Tambah manual atau minta Claude membuatkan lewat MCP.</p>}
          {shots.map((s, i) => (
            <div
              key={s.id}
              className={cn(
                'group flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent',
                selected?.id === s.id && 'bg-accent',
              )}
              onClick={() => setSelectedId(s.id)}
            >
              <span className="w-6 text-xs text-muted-foreground tabular-nums">{s.idx}</span>
              <span className="flex-1 truncate">{s.camera || s.narration_text || 'Shot kosong'}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{framesToSeconds(s.duration_frames).toFixed(1)}d</span>
              <div className="hidden gap-0.5 group-hover:flex">
                <button className="rounded p-0.5 hover:bg-background" title="Naik" onClick={(e) => (e.stopPropagation(), move(i, -1))}>
                  <ArrowUp className="size-3.5" />
                </button>
                <button className="rounded p-0.5 hover:bg-background" title="Turun" onClick={(e) => (e.stopPropagation(), move(i, 1))}>
                  <ArrowDown className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      {selected ? (
        <ShotForm key={selected.id} shot={selected} onChange={onChange} />
      ) : (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Pilih atau tambah shot.</CardContent>
        </Card>
      )}
    </div>
  );
}

function ShotForm({ shot, onChange }: { shot: Shot; onChange: () => void }) {
  const [seconds, setSeconds] = useState(framesToSeconds(shot.duration_frames));
  const [camera, setCamera] = useState(shot.camera);
  const [characters, setCharacters] = useState(shot.characters.join(', '));
  const [narration, setNarration] = useState(shot.narration_text);
  const [world, setWorld] = useState(JSON.stringify(shot.world, null, 2));
  const [notes, setNotes] = useState(shot.notes);
  const [busy, setBusy] = useState(false);
  const [worldError, setWorldError] = useState('');

  useEffect(() => {
    try {
      JSON.parse(world || '{}');
      setWorldError('');
    } catch {
      setWorldError('Format JSON tidak valid');
    }
  }, [world]);

  async function save() {
    setBusy(true);
    try {
      await updateShot(shot.id, {
        duration_frames: Math.max(15, Math.round(seconds * FPS)),
        camera: camera.trim(),
        characters: characters
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean),
        narration_text: narration,
        world: JSON.parse(world || '{}'),
        notes,
      });
      toast.success(`Shot ${shot.idx} tersimpan`);
      onChange();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Hapus shot ${shot.idx}?`)) return;
    await deleteShot(shot.id);
    onChange();
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Shot {shot.idx}</h3>
          <Button variant="ghost" size="sm" onClick={remove}>
            <Trash2 /> Hapus
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="dur">Durasi (detik, {FPS} fps)</Label>
            <Input id="dur" type="number" min={0.5} step={0.5} value={seconds} onChange={(e) => setSeconds(Number(e.target.value))} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cam">Kamera</Label>
            <Input id="cam" list="camera-presets" value={camera} onChange={(e) => setCamera(e.target.value)} placeholder="dolly in" />
            <datalist id="camera-presets">
              {CAMERA_PRESETS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="chars">Karakter (pisahkan dengan koma)</Label>
          <Input id="chars" value={characters} onChange={(e) => setCharacters(e.target.value)} placeholder="Bridge, Busker" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="nar">Narasi</Label>
          <Textarea id="nar" value={narration} onChange={(e) => setNarration(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="world">Dunia / setting (JSON)</Label>
          <Textarea id="world" className="min-h-28 font-mono text-xs" value={world} onChange={(e) => setWorld(e.target.value)} />
          {worldError && <span className="text-xs text-destructive">{worldError}</span>}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="notes">Catatan</Label>
          <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Catatan revisi untuk diri sendiri atau Claude" />
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={busy || Boolean(worldError)}>
            {busy ? 'Menyimpan...' : 'Simpan shot'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
