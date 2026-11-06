import { useEffect, useState } from 'react';
import { BadgeCheck, Bot, Brain, Clapperboard, FolderOpen, Globe, HardDrive, Mic, Palette, Save, ScrollText, Sparkles, Users, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { PageBody, PageHeader } from '@/components/layout';
import { ClaudeIntegration } from '@/components/claude-integration';
import { CharacterSettings } from '@/components/characters';
import { SkillSettings } from '@/components/skill-video';
import { LogSettings } from '@/components/skill-logs';
import { AudioMixSettings, GhostVoiceSettings, VoiceSettings } from '@/components/audio-settings';
import { RenderTest } from '@/components/render-test';
import { RemotionSetup } from '@/components/remotion-setup';
import { UpdatePanel } from '@/components/update';
import { BrainSettings } from '@/components/brain-settings';
import { StorageSettings } from '@/components/storage-settings';
import { ReachSettings } from '@/components/reach-settings';
import { BrandSettings } from '@/components/brand-settings';
import { getTheme, setTheme, type Theme } from '@/lib/theme';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Label, Skeleton } from '@/components/ui/misc';
import type { Settings, SystemInfo } from '@/lib/types';
import { cn } from '@/lib/utils';
import { usePersisted } from '@/lib/tasks';

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

const SECTIONS = [
  { id: 'claude', label: 'Claude & akun', icon: Bot, hint: 'MCP untuk Claude Code / Desktop' },
  { id: 'brain', label: 'Otak AI', icon: Brain, hint: 'Claude bawaan atau API custom' },
  { id: 'remotion', label: 'Proyek Remotion', icon: Wrench, hint: 'Template skill & folder' },
  { id: 'characters', label: 'Karakter', icon: Users, hint: 'Tokoh video 2D (maks 10)' },
  { id: 'skills', label: 'Skill video', icon: Sparkles, hint: 'Studio, Kamal, Stickman, Lemo, Google Flow, ...' },
  { id: 'reach', label: 'Riset internet', icon: Globe, hint: 'Agent Reach untuk riset Claude' },
  { id: 'logs', label: 'Log', icon: ScrollText, hint: 'Log sesi Claude per project' },
  { id: 'audio', label: 'Suara & audio', icon: Mic, hint: 'vibi.pro, SFX, musik' },
  { id: 'brand', label: 'Branding', icon: BadgeCheck, hint: 'Nama kanal / sosmed di video' },
  { id: 'render', label: 'Render', icon: Clapperboard, hint: 'Kualitas, paralel, uji' },
  { id: 'storage', label: 'Penyimpanan', icon: HardDrive, hint: 'Bersihkan hasil & cache' },
  { id: 'look', label: 'Tampilan & update', icon: Palette, hint: 'Tema, mode hemat, versi' },
] as const;
type Section = (typeof SECTIONS)[number]['id'];

export default function SettingsPage({ onSaved }: { onSaved: (s: Settings) => void }) {
  const [s, setS] = useState<Settings | null>(null);
  const [sys, setSys] = useState<SystemInfo | null>(null);
  const [hemat, setHemat] = useState(() => document.documentElement.classList.contains('hemat'));
  const [theme, setThemeState] = useState<Theme>(getTheme);
  const [section, setSection] = usePersisted<Section>('settings:section', 'claude');

  useEffect(() => {
    window.anima.getSettings().then(setS);
    window.anima.systemInfo().then(setSys);
  }, []);

  if (!s) return <Skeleton className="m-8 h-40" />;

  async function save() {
    // Persetujuan risiko Google Flow diatur langsung di panel Flow; jangan ditimpa nilai lama halaman ini.
    const { flowRiskAccepted: _flow, ...rest } = s!;
    const next = await window.anima.saveSettings(rest);
    onSaved(next);
    setSys(await window.anima.systemInfo());
    toast.success('Pengaturan tersimpan');
  }

  return (
    <>
      <PageHeader
        title="Pengaturan"
        description="Disimpan di laptop ini. Klik Simpan setelah mengubah isian."
        actions={
          <Button onClick={save}>
            <Save /> Simpan
          </Button>
        }
      />
      <PageBody className="flex-row items-start gap-8">
        {/* Menu bagian */}
        <nav className="sticky top-28 flex w-56 shrink-0 flex-col gap-1">
          {SECTIONS.map((sec) => (
            <button
              key={sec.id}
              onClick={() => setSection(sec.id)}
              className={cn(
                'flex items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent/60',
                section === sec.id && 'bg-primary/15 ring-1 ring-primary/30 ring-inset',
              )}
            >
              <sec.icon className={cn('mt-0.5 size-4 shrink-0', section === sec.id ? 'text-primary' : 'text-muted-foreground')} />
              <span className="min-w-0">
                <span className={cn('block text-sm', section === sec.id ? 'font-medium text-foreground' : 'text-muted-foreground')}>{sec.label}</span>
                <span className="block truncate text-xs text-muted-foreground/70">{sec.hint}</span>
              </span>
            </button>
          ))}
        </nav>

        {/* Isi bagian */}
        <div className="grid min-w-0 flex-1 gap-6">
          {section === 'claude' && <ClaudeIntegration />}

          {section === 'brain' && <BrainSettings s={s} setS={setS} />}

          {section === 'reach' && <ReachSettings s={s} setS={setS} />}

          {section === 'storage' && <StorageSettings />}

          {section === 'remotion' && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Proyek Remotion (skill kamu)</CardTitle>
                  <CardDescription>Folder berisi package.json Remotion dan template skill cartoon-3d-short.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <RemotionSetup
                    found={Boolean(sys?.remotionFound)}
                    onDone={async () => {
                      const next = await window.anima.getSettings();
                      setS(next);
                      onSaved(next);
                      setSys(await window.anima.systemInfo());
                    }}
                  />
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
                  <CardTitle>Folder</CardTitle>
                  <CardDescription>
                    Disk kosong: folder sementara {sys?.tempFreeGb?.toFixed(1) ?? '?'} GB, folder hasil {sys?.outputFreeGb?.toFixed(1) ?? '?'} GB. Render butuh
                    minimal 5 GB kosong.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <FolderField id="out" label="Folder hasil video" value={s.outputDir} onChange={(v) => setS({ ...s, outputDir: v })} />
                  <FolderField
                    id="tmp"
                    label="Folder sementara render"
                    value={s.tempDir}
                    onChange={(v) => setS({ ...s, tempDir: v })}
                    hint="Remotion menyalin aset ke sini tiap render dan dibersihkan sesudahnya. Pakai drive yang paling lega."
                  />
                </CardContent>
              </Card>
            </>
          )}

          {section === 'characters' && <CharacterSettings />}

          {section === 'skills' && <SkillSettings />}

          {section === 'logs' && <LogSettings />}

          {section === 'audio' && (
            <>
              <VoiceSettings s={s} setS={setS} />
              <GhostVoiceSettings s={s} setS={setS} />
              <AudioMixSettings s={s} setS={setS} />
            </>
          )}

          {section === 'brand' && <BrandSettings s={s} setS={setS} />}

          {section === 'render' && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Kualitas render</CardTitle>
                  <CardDescription>
                    Belum yakin? Pakai "Uji otomatis & pilih paralel" di bawah, lalu klik Terapkan. Hasil uji di laptop i7-6820HQ (efek lengkap 540x960):
                    GPU sekitar 1,6 detik/frame, CPU sekitar 11 detik/frame. Gambar hasil GPU dan CPU sama.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="quality">Kualitas</Label>
                    <NativeSelect id="quality" value={s.renderQuality} onChange={(e) => setS({ ...s, renderQuality: e.target.value as Settings['renderQuality'] })}>
                      <option value="full">Lengkap (final)</option>
                      <option value="draft">Draft (~2x lebih cepat)</option>
                    </NativeSelect>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="scale">Resolusi</Label>
                    <NativeSelect id="scale" value={String(s.scale)} onChange={(e) => setS({ ...s, scale: Number(e.target.value) })}>
                      <option value="0.25">270x480 (draft)</option>
                      <option value="0.5">540x960 (laptop low-spec)</option>
                      <option value="1">1080x1920 (Full HD)</option>
                      <option value="1.3333">1440x2560 (2K)</option>
                    </NativeSelect>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="conc">Proses paralel</Label>
                    <NativeSelect id="conc" value={String(s.concurrency)} onChange={(e) => setS({ ...s, concurrency: Number(e.target.value) })}>
                      <option value="1">Tanpa paralel (1 proses)</option>
                      {[2, 3, 4, 6, 8, 10, 12, 16].map((n) => (
                        <option key={n} value={n}>
                          Paralel {n} proses
                        </option>
                      ))}
                      {![1, 2, 3, 4, 6, 8, 10, 12, 16].includes(s.concurrency) && <option value={s.concurrency}>Paralel {s.concurrency} proses</option>}
                    </NativeSelect>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="gl">Kartu grafis</Label>
                    <NativeSelect id="gl" value={s.gl} onChange={(e) => setS({ ...s, gl: e.target.value as Settings['gl'] })}>
                      <option value="angle">GPU (disarankan, jauh lebih cepat)</option>
                      <option value="swiftshader">CPU (cadangan kalau GPU error)</option>
                    </NativeSelect>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="crf">Ukuran file (CRF)</Label>
                    <NativeSelect id="crf" value={String(s.crf)} onChange={(e) => setS({ ...s, crf: Number(e.target.value) })}>
                      <option value="16">16 (terbaik, file besar)</option>
                      <option value="18">18 (seimbang)</option>
                      <option value="23">23 (file kecil)</option>
                    </NativeSelect>
                  </div>
                </CardContent>
              </Card>
              <RenderTest s={s} setS={setS} beforeRun={save} />
            </>
          )}

          {section === 'look' && (
            <Card>
              <CardHeader>
                <CardTitle>Tampilan & update</CardTitle>
                <CardDescription>Langsung berlaku, tanpa perlu Simpan.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5">
                <div className="grid max-w-xs gap-2">
                  <Label htmlFor="theme">Tema</Label>
                  <NativeSelect
                    id="theme"
                    value={theme}
                    onChange={(e) => {
                      const t = e.target.value as Theme;
                      setThemeState(t);
                      setTheme(t);
                    }}
                  >
                    <option value="dark">Gelap (hitam-biru)</option>
                    <option value="light">Terang</option>
                    <option value="system">Ikuti Windows</option>
                  </NativeSelect>
                </div>
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
                  Mode Hemat: matikan semua animasi dan efek cahaya
                </label>
                <UpdatePanel version={sys?.version} />
                <div className="text-xs text-muted-foreground">Server data: {s.supabaseUrl}</div>
              </CardContent>
            </Card>
          )}
        </div>
      </PageBody>
    </>
  );
}
