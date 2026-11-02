import { useEffect, useState } from 'react';
import { FolderOpen } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout';
import { ClaudeIntegration } from '@/components/claude-integration';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Label, Skeleton } from '@/components/ui/misc';
import type { Settings, SystemInfo } from '@/lib/types';

function FolderField({ id, label, value, onChange, hint }: { id: string; label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} />
        <Button
          variant="outline"
          size="icon"
          title="Pilih folder"
          onClick={async () => {
            const p = await window.anima.pickFolder(label);
            if (p) onChange(p);
          }}
        >
          <FolderOpen />
        </Button>
      </div>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

export default function SettingsPage({ onSaved }: { onSaved: (s: Settings) => void }) {
  const [s, setS] = useState<Settings | null>(null);
  const [sys, setSys] = useState<SystemInfo | null>(null);
  const [hemat, setHemat] = useState(() => document.documentElement.classList.contains('hemat'));

  useEffect(() => {
    window.anima.getSettings().then(setS);
    window.anima.systemInfo().then(setSys);
  }, []);

  if (!s) return <Skeleton className="m-6 h-40" />;

  async function save() {
    const next = await window.anima.saveSettings(s!);
    onSaved(next);
    setSys(await window.anima.systemInfo());
    toast.success('Pengaturan tersimpan');
  }

  return (
    <>
      <PageHeader title="Pengaturan" actions={<Button onClick={save}>Simpan</Button>} />
      <div className="grid max-w-3xl gap-4 p-6">
        <ClaudeIntegration />
        <Card>
          <CardHeader>
            <CardTitle>Proyek Remotion (skill kamu)</CardTitle>
            <CardDescription>
              Folder yang berisi package.json Remotion dan template skill cartoon-3d-short. Jalankan "npm install" di folder itu sekali.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <FolderField
              id="rp"
              label="Folder proyek Remotion"
              value={s.remotionProjectPath}
              onChange={(v) => setS({ ...s, remotionProjectPath: v })}
              hint={sys ? (sys.remotionFound ? 'Remotion ditemukan.' : 'Remotion belum ditemukan di folder ini.') : undefined}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="entry">File entry</Label>
                <Input id="entry" value={s.remotionEntry} onChange={(e) => setS({ ...s, remotionEntry: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="comp">Komposisi default</Label>
                <Input id="comp" value={s.defaultComposition} onChange={(e) => setS({ ...s, defaultComposition: e.target.value })} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Kualitas render</CardTitle>
            <CardDescription>Laptop ini 4 core / 8 thread. Pengaturan hemat disarankan.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="scale">Resolusi</Label>
              <NativeSelect id="scale" value={String(s.scale)} onChange={(e) => setS({ ...s, scale: Number(e.target.value) })}>
                <option value="0.5">540x960 (uji cepat)</option>
                <option value="1">1080x1920 (hemat)</option>
                <option value="1.3333">1440x2560 (2K, sangat lama)</option>
              </NativeSelect>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="conc">Proses paralel</Label>
              <NativeSelect id="conc" value={String(s.concurrency)} onChange={(e) => setS({ ...s, concurrency: Number(e.target.value) })}>
                <option value="1">1 (aman)</option>
                <option value="2">2</option>
                <option value="3">3 (laptop panas)</option>
              </NativeSelect>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="crf">Kualitas (CRF)</Label>
              <NativeSelect id="crf" value={String(s.crf)} onChange={(e) => setS({ ...s, crf: Number(e.target.value) })}>
                <option value="16">16 (terbaik, file besar)</option>
                <option value="18">18 (seimbang)</option>
                <option value="23">23 (file kecil)</option>
              </NativeSelect>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Folder</CardTitle>
            <CardDescription>
              Disk kosong saat ini: folder sementara {sys?.tempFreeGb?.toFixed(1) ?? '?'} GB, folder hasil {sys?.outputFreeGb?.toFixed(1) ?? '?'} GB.
              Butuh minimal 5 GB kosong untuk render.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <FolderField id="out" label="Folder hasil video" value={s.outputDir} onChange={(v) => setS({ ...s, outputDir: v })} />
            <FolderField
              id="tmp"
              label="Folder sementara render"
              value={s.tempDir}
              onChange={(v) => setS({ ...s, tempDir: v })}
              hint="Remotion menyalin aset (sekitar 1.3 GB) ke sini tiap render. Pakai drive yang paling lega."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tampilan & akun</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={hemat}
                onChange={(e) => {
                  setHemat(e.target.checked);
                  document.documentElement.classList.toggle('hemat', e.target.checked);
                  try {
                    localStorage.setItem('anima-hemat', e.target.checked ? '1' : '0');
                  } catch {
                    /* abaikan */
                  }
                }}
              />
              Mode Hemat: matikan semua animasi tampilan
            </label>
            <div className="text-sm text-muted-foreground">Supabase: {s.supabaseUrl}</div>
            {sys && <div className="text-xs text-muted-foreground">ANIMA Studio v{sys.version}</div>}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
