// Pengaturan > Riset internet: Agent Reach (Panniantong/agent-reach, MIT). Claude memakainya untuk riset bahan video
// (subtitle YouTube, Reddit, X, GitHub, web) bila WebSearch/WebFetch tidak cukup. Hanya membaca.
import { useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, Loader2, ShieldAlert, Wand2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Progress } from '@/components/ui/misc';
import { cleanErr, runTask, useTask, useTaskFinished } from '@/lib/tasks';
import type { Settings } from '@/lib/types';

type Status = Awaited<ReturnType<typeof window.anima.reachStatus>>;

export function ReachSettings({ s, setS }: { s: Settings; setS: (s: Settings) => void }) {
  const [st, setSt] = useState<Status | null>(null);
  const [report, setReport] = useState('');
  const key = 'skill-setup:reach';
  const task = useTask(key);
  const busy = Boolean(task?.running);
  const load = () => window.anima.reachStatus().then(setSt).catch(() => setSt({ uv: null, bin: null, version: null, doctor: '', skill: false, url: '' }));
  useEffect(() => {
    load();
  }, []);
  useTaskFinished(key, () => load());

  function install() {
    runTask(key, { label: 'Memasang Agent Reach', href: '/settings', step: 'Mulai' }, () => window.anima.reachInstall()).then(
      (r) => {
        setReport((r as { report?: string })?.report || '');
        toast.success('Agent Reach siap dipakai Claude');
      },
      (e) => toast.error('Gagal memasang Agent Reach', { description: cleanErr(e), duration: 15000 }),
    );
  }

  const rows = st
    ? [
        { label: 'uv (pemasang program)', ok: Boolean(st.uv), detail: st.uv ?? 'dipasang otomatis, tanpa admin' },
        { label: 'agent-reach', ok: Boolean(st.bin), detail: st.bin ? `${st.version ?? ''} ${st.bin}`.trim() : 'belum terpasang' },
        { label: 'Skill agent-reach untuk Claude', ok: st.skill, detail: '~/.claude/skills/agent-reach' },
      ]
    : [];

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>Riset internet di sesi skill</CardTitle>
        <CardDescription>
          Sesi skill (tab Claude) boleh menjalankan perintah di laptop ini untuk merender video. Kalau sesi yang sama juga membaca web, teks jahat di sebuah halaman bisa menyuruh Claude
          menjalankan perintah berbahaya (prompt injection). Karena itu riset internet secara bawaan hanya dikerjakan di tahap <b>Generate dengan Claude</b>, yang tidak boleh menjalankan
          perintah.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" className="size-4 accent-primary" checked={Boolean(s.skillWebResearch)} onChange={(e) => setS({ ...s, skillWebResearch: e.target.checked })} />
          Izinkan sesi skill membaca web (WebSearch, WebFetch, Agent Reach)
        </label>
        {s.skillWebResearch && (
          <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-xs">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" />
            <span>
              Hati-hati: dengan ini menyala, Claude membaca halaman web sambil boleh menjalankan perintah (node, python, ffmpeg) tanpa bertanya. Nyalakan hanya saat perlu, beri topik dari
              sumber yang kamu percaya, dan matikan lagi setelah selesai.
            </span>
          </div>
        )}
        <p className="text-xs text-muted-foreground">Klik Simpan di atas setelah mengubah. Berlaku untuk sesi skill berikutnya.</p>
      </CardContent>
    </Card>
    <Card>
      <CardHeader>
        <CardTitle>
          Riset internet: Agent Reach <span className="text-sm font-normal text-muted-foreground">oleh Panniantong</span>
        </CardTitle>
        <CardDescription>
          Memberi Claude akses baca ke platform yang sulit dijangkau WebSearch: subtitle YouTube, Reddit, X/Twitter, GitHub, Bilibili, dan halaman web. Setelah terpasang, Generate dengan Claude boleh
          memakainya untuk riset bahan video (tab Claude hanya kalau riset internet di sesi skill dinyalakan di atas). Hanya membaca, tidak pernah memposting atau login atas namamu.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {!st ? (
          <Loader2 className="animate-spin text-muted-foreground" />
        ) : (
          <div className="grid gap-2 sm:grid-cols-3">
            {rows.map((r) => (
              <div key={r.label} className="flex items-start gap-2 text-sm">
                {r.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-warning" />}
                <span className="min-w-0">
                  <span className="font-medium">{r.label}</span>
                  <span className="block truncate text-xs text-muted-foreground" title={r.detail}>
                    {r.detail}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={install} disabled={busy || !st}>
            {busy ? <Loader2 className="animate-spin" /> : <Wand2 />} {st?.bin ? 'Perbarui / pasang ulang' : 'Pasang otomatis'}
          </Button>
          <button className="text-xs text-primary hover:underline" onClick={() => window.anima.openExternal('https://github.com/Panniantong/agent-reach')}>
            github.com/Panniantong/agent-reach <ExternalLink className="inline size-3" />
          </button>
        </div>
        {busy && task && (
          <div className="grid gap-1 rounded-md border p-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{task.step}...</span>
            {task.log.at(-1) && task.log.at(-1) !== task.step && <span className="truncate font-mono">{task.log.at(-1)}</span>}
            <Progress value={undefined} />
          </div>
        )}
        {(report || st?.doctor) && (
          <pre className="max-h-64 overflow-auto rounded-md border bg-muted/30 p-3 text-xs whitespace-pre-wrap">{report || st?.doctor}</pre>
        )}
        <p className="text-xs text-muted-foreground">
          Platform yang butuh login (Reddit, X, Xiaohongshu, dll.) bisa ditambahkan nanti dengan meminta Claude "tambahkan kanal Reddit di Agent Reach"; login selalu kamu lakukan sendiri di
          jendela yang dibuka Agent Reach. Disarankan memakai akun cadangan.
        </p>
      </CardContent>
    </Card>
    </>
  );
}
