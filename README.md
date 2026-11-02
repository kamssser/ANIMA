# ANIMA Studio

Aplikasi Windows untuk mengelola produksi video pendek 3D yang dibuat oleh Claude + skill
[cartoon-3d-short](https://github.com/mromidev/claude-animated-shorts).

- **Tampilan:** React + shadcn/ui di dalam Electron (aplikasi Windows, bukan web).
- **Data & login:** Supabase (gratis).
- **Render:** di laptop ini, lewat Remotion milik skill kamu, mode hemat (1 proses).
- **Claude:** lewat server MCP lokal, jadi script dan shot tidak perlu ditempel bolak-balik di chat.

Target minimum: laptop 4 core / 8 thread, RAM 16 GB (HP ZBook 15 G2). Aplikasinya sendiri memakai sekitar 270 MB RAM.

---

## 1. Menjalankan aplikasi (pertama kali)

Buka PowerShell di folder ini, lalu:

```powershell
npm install
npm run build
npm start
```

Saat mengembangkan (tampilan berubah otomatis waktu kode diedit):

```powershell
npm run dev
```

Membuat installer `.exe` (hasilnya ada di folder `release/`):

```powershell
npm run dist
```

## 2. Menyiapkan Supabase (sekali saja, sekitar 5 menit)

1. Daftar di <https://supabase.com>, klik **New project**, pilih region **Singapore**, lalu simpan password database-nya.
2. Buka menu **SQL Editor**, klik **New query**, tempel seluruh isi file `supabase/schema.sql`, lalu klik **Run**.
3. Buka **Project Settings > API**, lalu salin **Project URL** dan **anon public key**.
4. Buka ANIMA Studio, tempel keduanya di layar pertama, lalu klik **Daftar** untuk membuat akun.
   - Kalau diminta konfirmasi email dan kamu tidak ingin repot: di Supabase buka
     **Authentication > Sign In / Providers > Email**, lalu matikan **Confirm email**.

## 3. Menyiapkan proyek Remotion (untuk tombol Render)

1. Siapkan folder proyek Remotion yang berisi template skill kamu, lalu jalankan `npm install` di folder itu.
2. Di ANIMA Studio, buka **Pengaturan**, pilih folder tersebut, lalu isi nama komposisi (mis. `Main`).
3. Komposisi harus membaca data dari ANIMA. ANIMA mengirim data lewat `--props` dengan bentuk ini:

```ts
{
  title: string; topic: string; script: string;
  fps: 30; durationInFrames: number;
  shots: { idx: number; durationInFrames: number; camera: string;
           characters: string[]; world: Record<string, unknown>; narration: string }[];
}
```

Contoh di `Root.tsx`, supaya durasi video mengikuti jumlah shot:

```tsx
<Composition
  id="Main"
  component={Story}
  fps={30}
  width={1080}
  height={1920}
  durationInFrames={300}
  defaultProps={{ title: '', topic: '', script: '', fps: 30, durationInFrames: 300, shots: [] }}
  calculateMetadata={({ props }) => ({ durationInFrames: props.durationInFrames })}
/>
```

Template skill aslinya membaca cerita dari `story.ts`. Ubah bagian itu supaya memakai `props.shots`.

**Catatan laptop ini:** sisakan minimal 5 GB kosong di drive folder sementara, karena Remotion menyalin
`public/` (sekitar 1,3 GB) setiap kali render. Mulailah dengan resolusi **540x960 (uji cepat)**.

## 4. Menyambungkan Claude (otomatis)

Buka **Pengaturan > Integrasi Claude**. ANIMA mendeteksi sendiri **Claude Code** dan **Claude Desktop**
yang terpasang. Ketik password akun ANIMA sekali, lalu klik **Sambungkan**.

- Claude Code: server MCP didaftarkan lewat `claude mcp add-json anima ... -s user`.
- Claude Desktop: entri `anima` ditambahkan ke `claude_desktop_config.json` (file lama dicadangkan ke `.bak`).
  Tutup lalu buka lagi Claude Desktop.
- Password **tidak disimpan**. Yang disimpan hanya token sesi khusus MCP di
  `%APPDATA%\ANIMA Studio\mcp-session.json`, dan server MCP memperbaruinya sendiri.

Setelah itu, di halaman project ANIMA klik **Salin prompt**, lalu tempel ke Claude.

| Tool | Fungsi |
| --- | --- |
| `anima_list_projects` | Daftar project |
| `anima_get_project` | Ambil brief (shot hanya kalau diminta) |
| `anima_save_story` | Simpan script + semua shot |
| `anima_patch_shot` | Revisi satu shot saja (hemat token) |
| `anima_job_status` | Status render terakhir |

## Struktur folder

```
electron/       proses utama Windows: jendela, pengaturan, antrean render
src/            tampilan React + shadcn/ui
  pages/        Overview, Project, Detail project, Antrean Render, Pengaturan
  lib/          Supabase, API, penghubung render
supabase/       schema.sql untuk dijalankan di Supabase
mcp/            server MCP untuk Claude Desktop
```
