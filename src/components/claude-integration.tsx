import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, CircleDashed, RefreshCw, XCircle } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Label } from '@/components/ui/misc';
import { sb } from '@/lib/supabase';
import type { ClaudeDetect } from '@/lib/types';

function Row({ name, installed, connected, detail }: { name: string; installed: boolean; connected: boolean; detail?: string | null }) {
  const Icon = !installed ? XCircle : connected ? CheckCircle2 : CircleDashed;
  const tone = !installed ? 'text-muted-foreground' : connected ? 'text-success' : 'text-warning';
  return (
    <div className="flex items-center gap-3 rounded-md border p-3">
      <Icon className={`size-5 shrink-0 ${tone}`} />
      <div className="min-w-0 flex-1">
        <div className="font-medium">{name}</div>
        <div className="truncate text-xs text-muted-foreground">{detail}</div>
      </div>
      <span className={`text-xs font-medium ${tone}`}>{!installed ? 'Tidak terpasang' : connected ? 'Tersambung' : 'Belum tersambung'}</span>
    </div>
  );
}

/** Deteksi Claude Code & Claude Desktop, lalu pasang server MCP ANIMA ke keduanya. */
export function ClaudeIntegration() {
  const [d, setD] = useState<ClaudeDetect | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const detect = () => window.anima.detectClaude().then(setD);
  useEffect(() => {
    detect();
  }, []);

  async function connect(e: FormEvent) {
    e.preventDefault();
    if (!d) return;
    setBusy(true);
    try {
      const settings = await window.anima.getSettings();
      const { data: user } = await sb().auth.getUser();
      const email = user.user?.email;
      if (!email) throw new Error('Belum login.');
      // Sesi terpisah khusus MCP, supaya sesi aplikasi tidak ikut terganggu. Password tidak disimpan.
      const side = createClient(settings.supabaseUrl, settings.supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false, storageKey: 'anima-mcp-tmp' },
      });
      const { data, error } = await side.auth.signInWithPassword({ email, password });
      if (error || !data.session) throw new Error(error?.message ?? 'Login gagal');
      const targets = [d.code.installed && 'code', d.desktop.installed && 'desktop'].filter(Boolean) as ('code' | 'desktop')[];
      const r = await window.anima.installClaude({
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at ?? 0,
        },
        targets,
      });
      (r.ok ? toast.success : toast.warning)('Integrasi Claude', { description: r.message });
      setPassword('');
      detect();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const none = d && !d.code.installed && !d.desktop.installed;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle>Integrasi Claude</CardTitle>
            <CardDescription className="mt-1.5">
              Claude bisa membaca brief dan menyimpan script + shot langsung ke HyperForge lewat MCP, tanpa copy-paste panjang.
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" title="Deteksi ulang" onClick={detect}>
            <RefreshCw />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        {!d ? (
          <div className="text-sm text-muted-foreground">Mendeteksi...</div>
        ) : (
          <>
            <Row name="Claude Code" installed={d.code.installed} connected={d.code.connected} detail={d.code.version ?? d.code.path} />
            <Row
              name="Claude Desktop"
              installed={d.desktop.installed}
              connected={d.desktop.connected}
              detail={d.desktop.configPaths[0] ?? 'Install dari claude.ai/download'}
            />
            {!d.node && <div className="text-sm text-destructive">Node.js tidak ditemukan di PATH. MCP butuh Node.js.</div>}
            {none ? (
              <div className="text-sm text-muted-foreground">Claude Code maupun Claude Desktop tidak ditemukan di laptop ini.</div>
            ) : (
              <form onSubmit={connect} className="flex flex-wrap items-end gap-2">
                <div className="grid flex-1 gap-2">
                  <Label htmlFor="mcp-pw">Password akun HyperForge (sekali saja, tidak disimpan)</Label>
                  <Input id="mcp-pw" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" disabled={busy || !d.node}>
                  {busy ? 'Menyambungkan...' : d.code.connected || d.desktop.connected ? 'Sambungkan ulang' : 'Sambungkan'}
                </Button>
              </form>
            )}
            {(d.code.connected || d.desktop.connected) && (
              <Button
                variant="link"
                className="h-auto w-fit p-0 text-muted-foreground"
                onClick={async () => {
                  const r = await window.anima.removeClaude();
                  toast.success(r.message);
                  detect();
                }}
              >
                Lepas integrasi
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
