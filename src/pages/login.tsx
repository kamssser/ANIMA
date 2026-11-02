import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { sb } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Label } from '@/components/ui/misc';

export function LoginPage({ onResetConfig }: { onResetConfig: () => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === 'login') {
        const { error } = await sb().auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await sb().auth.signUp({ email, password });
        if (error) throw error;
        if (!data.session) {
          toast.success('Akun dibuat. Cek email untuk konfirmasi, lalu login.');
          setMode('login');
        }
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-full place-items-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-lg">{mode === 'login' ? 'Masuk' : 'Buat akun'}</CardTitle>
          <CardDescription>Akun Supabase project kamu sendiri.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? 'Memproses...' : mode === 'login' ? 'Masuk' : 'Daftar'}
            </Button>
            <button
              type="button"
              className="text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            >
              {mode === 'login' ? 'Belum punya akun? Daftar' : 'Sudah punya akun? Masuk'}
            </button>
            <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={onResetConfig}>
              Ganti project Supabase
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
