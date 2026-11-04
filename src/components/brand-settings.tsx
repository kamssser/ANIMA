// Pengaturan > Branding: nama kanal YouTube / akun sosmed yang tampil kecil di tengah paling bawah setiap video.
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Label } from '@/components/ui/misc';
import { Input } from '@/components/ui/input';
import type { Settings } from '@/lib/types';

const EXAMPLES = ['@namakanal', 'YouTube: Nama Kanal', '@namakanal · TikTok & IG @namaakun'];

export function BrandSettings({ s, setS }: { s: Settings; setS: (s: Settings) => void }) {
  const text = (s.brandText || '').trim();
  const on = Boolean(s.brandOn);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Branding kanal</CardTitle>
        <CardDescription>
          Nama kanal YouTube atau akun sosmed kamu ditulis kecil di tengah paling bawah setiap video, sepanjang video. Berlaku untuk video yang dibuat setelah disimpan
          (render 2D/3D HyperForge dan semua style skill Claude).
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 md:grid-cols-[1fr_auto]">
        <div className="grid content-start gap-4">
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" className="size-4 accent-primary" checked={on} onChange={(e) => setS({ ...s, brandOn: e.target.checked })} />
            Tampilkan branding di setiap video
          </label>
          <div className="grid gap-2">
            <Label htmlFor="brand">Teks branding</Label>
            <Input id="brand" maxLength={80} value={s.brandText || ''} placeholder="@namakanal" onChange={(e) => setS({ ...s, brandText: e.target.value })} />
            <span className="text-xs text-muted-foreground">Maks 80 huruf. Contoh: {EXAMPLES.join('  |  ')}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((x) => (
              <button key={x} type="button" className="rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-accent" onClick={() => setS({ ...s, brandText: x, brandOn: true })}>
                {x}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Klik Simpan di atas setelah mengubah. Video yang sudah jadi tidak berubah; render ulang atau buat video baru.</p>
        </div>

        {/* Pratinjau 9:16 */}
        <div className="relative mx-auto h-72 w-[162px] overflow-hidden rounded-lg border bg-gradient-to-b from-slate-700 to-slate-900">
          <div className="absolute inset-x-3 top-1/3 h-20 rounded-md bg-white/10" />
          <div className="absolute inset-x-0 bottom-[9%] text-center text-[11px] font-bold text-white [text-shadow:0_1px_2px_#000]">
            contoh <span className="text-yellow-300">subtitle</span> di sini
          </div>
          {on && text && (
            <div className="absolute inset-x-0 bottom-[1.8%] truncate px-1 text-center text-[6.5px] font-semibold tracking-wide text-white/75 [text-shadow:0_1px_2px_rgba(0,0,0,.8)]">{text}</div>
          )}
          {!(on && text) && <div className="absolute inset-x-0 bottom-[1.8%] text-center text-[7px] text-white/30">branding mati</div>}
        </div>
      </CardContent>
    </Card>
  );
}
