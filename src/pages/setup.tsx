import { useState } from 'react';
import { toast } from 'sonner';
import { ExternalLink } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { BrandScreen } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Label } from '@/components/ui/misc';
import type { Settings } from '@/lib/types';

/** Layar pertama kali: menempel URL + anon key Supabase. */
export function SetupPage({ onSaved }: { onSaved: (s: Settings) => void }) {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    const cleanUrl = url.trim().replace(/\/+$/, '');
    if (!/^https:\/\/.+\.supabase\.co$/.test(cleanUrl)) {
      toast.error('URL harus seperti https://xxxx.supabase.co');
      return;
    }
    setBusy(true);
    try {
      // Uji koneksi + cek tabel sudah dibuat dari supabase/schema.sql.
      const test = createClient(cleanUrl, key.trim(), { auth: { persistSession: false } });
      const { error } = await test.from('projects').select('id', { head: true, count: 'exact' });
      if (error && /relation|does not exist|schema cache/i.test(error.message)) {
        toast.error('Tabel belum ada. Jalankan file supabase/schema.sql di SQL Editor Supabase dulu.');
        return;
      }
      if (error && /Invalid API key|JWT/i.test(error.message)) {
        toast.error('Key salah. Pakai publishable key, bukan secret key.');
        return;
      }
      onSaved(await window.anima.saveSettings({ supabaseUrl: cleanUrl, supabaseAnonKey: key.trim() }));
      toast.success('Tersambung ke Supabase');
    } catch (e) {
      toast.error(`Tidak bisa tersambung: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <BrandScreen>
      <Card className="brand-glow w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-lg">Selamat datang di HyperForge</CardTitle>
          <CardDescription>Sambungkan ke Supabase sekali saja. Datanya tersimpan di laptop ini.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Buat project gratis di supabase.com.</li>
            <li>Buka SQL Editor, tempel isi file supabase/schema.sql, klik Run.</li>
            <li>Buka Project Settings, lalu API Keys. Salin Project URL dan publishable key ke bawah.</li>
          </ol>
          <Button variant="outline" size="sm" className="w-fit" onClick={() => window.anima.openExternal('https://supabase.com/dashboard')}>
            Buka Supabase <ExternalLink />
          </Button>
          <div className="grid gap-2">
            <Label htmlFor="url">Project URL</Label>
            <Input id="url" placeholder="https://abcdefgh.supabase.co" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="key">Publishable key (atau anon public key)</Label>
            <Input id="key" placeholder="sb_publishable_... atau eyJhbGciOi..." value={key} onChange={(e) => setKey(e.target.value)} />
          </div>
          <Button onClick={save} disabled={busy || !url || !key}>
            {busy ? 'Mengecek...' : 'Simpan dan lanjut'}
          </Button>
        </CardContent>
      </Card>
    </BrandScreen>
  );
}
