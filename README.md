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

## 4. Suara (vibi.pro) dan SFX + musik (Python)

Alurnya mengikuti skill cartoon-3d-short:

1. **Suara:** tab **Render > Buat suara**. Script dikirim ke vibi.pro (`POST /v1/text-to-speech/{voice_id}`),
   hasil MP3 dikonversi ke `<proyek Remotion>/voice/voice.wav` (48 kHz, sesuai syarat `mix.py`).
2. **Timing kata (opsional):** speech-to-text vibi.pro menghasilkan `voice/words.json` (`[{ "s", "e", "text" }]`),
   yang dipakai `mix.py` untuk menurunkan musik saat narasi berbicara.
3. **SFX + musik:** setelah video dirender, ANIMA menjalankan `python mix.py` di folder `audio/`
   (butuh numpy + scipy; tombol pasangnya ada di Pengaturan).
4. **Gabung:** `audio/mix.wav` digabung ke MP4 dengan ffmpeg bawaan Remotion.

Atur API key, pilihan suara, provider (ElevenLabs / MiniMax / CapCut), bahasa, dan kecepatan di
**Pengaturan > Suara narasi**. Setiap pembuatan suara memakai kredit vibi.pro.

Catatan: waktu SFX di template skill ditulis manual di `timeline.py` dan `sfx.py` untuk cerita contoh
(67,5 detik). Untuk cerita baru, Claude (lewat skill) perlu menyesuaikan file itu sebelum render.

## 5. Menyambungkan Claude (otomatis)

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

## 6. Membagikan ke teman (tinggal install)

Buat installer dengan `npm run dist`, lalu kirim file `release/ANIMA Studio Setup x.y.z.exe`.

Yang dilakukan teman:

1. Install **Node.js LTS** dari nodejs.org (sekali saja, dibutuhkan untuk render dan MCP).
2. Jalankan installer ANIMA Studio, lalu klik **Daftar** dengan email sendiri. Supabase sudah terisi dari
   `app-defaults.json`; data tiap akun terpisah berkat RLS.
3. **Pengaturan > Proyek Remotion > Siapkan otomatis** (sekitar 600 MB, 3-10 menit).
4. **Pengaturan > Uji render > Uji otomatis & pilih paralel**, lalu klik **Terapkan saran ini**.
   ANIMA membandingkan 1 proses vs beberapa proses paralel di perangkat itu dan memilih yang tercepat.
5. Opsional: isi API key vibi.pro sendiri (suara), klik **Pasang numpy & scipy** (SFX), lalu **Sambungkan** Claude.

`app-defaults.json` hanya boleh berisi URL dan **publishable** key Supabase. Jangan pernah menaruh secret key
atau API key vibi.pro di sana, karena file itu ikut ke installer.

## 7. Mengirim update ke teman (otomatis lewat aplikasi)

Update disimpan di **GitHub Releases** repo `kamssser/ANIMA` (publik). Teman tidak perlu membuka GitHub:
aplikasi mengecek update setiap dibuka dan setiap 4 jam, mengunduhnya di latar belakang, lalu menampilkan
tombol **Restart & update** di bagian atas.

Persiapan sekali saja (di laptop pembuat):

```powershell
setx GH_TOKEN "github_pat_..."   # token fine-grained: repo ANIMA, Contents = Read and write
```

Setiap kali mau merilis:

1. Naikkan `version` di `package.json` (mis. `0.3.1` -> `0.3.2`). Versi harus lebih tinggi dari yang terpasang.
2. Tulis catatan update di `CHANGELOG.md` (`## 0.3.2 - YYYY-MM-DD`). Wajib: tanpa ini `npm run release` menolak jalan.
   Catatan ini muncul di halaman Releases GitHub dan di dialog update aplikasi teman ("Yang baru").
3. Commit + push, buka terminal baru (supaya `GH_TOKEN` terbaca), lalu jalankan `npm run release`.
4. Installer + `latest.yml` terunggah ke Releases; aplikasi teman menerima notifikasi saat dibuka berikutnya.

Memperbaiki catatan rilis yang sudah terbit: edit `CHANGELOG.md`, lalu `node scripts/release.mjs --notes-only`.

`npm run dist` membuat installer lokal saja tanpa mengunggah.

## 8. Pindah ke laptop lain (untuk mengembangkan & merilis update)

Semua kode ada di GitHub, jadi folder ini **tidak perlu di-zip**. Di laptop baru:

1. Install **Git**, **Node.js LTS**, **Python 3** (untuk SFX), dan **Claude Code**.
2. Ambil kode dan pasang paketnya:

   ```powershell
   cd $HOME\Documents
   git clone https://github.com/kamssser/ANIMA.git
   cd ANIMA
   npm install
   ```

3. Simpan token GitHub (buat token baru di GitHub; boleh satu token per laptop):

   ```powershell
   setx GH_TOKEN "github_pat_..."
   ```

4. Buka Claude Code di folder `ANIMA`. Claude otomatis membaca `CLAUDE.md` (aturan rilis, catatan update, dll).
5. Coba jalankan: `npm run build` lalu `npm start`, login dengan akun yang sama.
6. Di aplikasi: **Pengaturan > Proyek Remotion > Siapkan otomatis**, isi lagi API key vibi.pro, lalu
   **Sambungkan** Claude.

| Ada di GitHub (ikut `git clone`) | Tidak ikut (dibuat ulang di laptop baru) |
| --- | --- |
| Kode aplikasi, `CLAUDE.md`, `CHANGELOG.md`, template Remotion, skrip rilis | `node_modules` (`npm install`) |
| Logo, ikon, banner | `GH_TOKEN` (`setx`) |
| Skema Supabase | Pengaturan aplikasi + API key vibi.pro (diisi di aplikasi) |
| | Proyek Remotion `anima-remotion` (tombol **Siapkan otomatis**) |

**Data project, shot, dan riwayat render tidak hilang**: semuanya di Supabase (cloud), jadi tinggal login.
File MP4 hasil render ada di laptop lama (`Videos\ANIMA`); pindahkan manual kalau masih dibutuhkan.

Selalu `git pull` sebelum mulai bekerja dan `git push` setelah selesai, terutama kalau memakai lebih dari satu laptop.

## Struktur folder

```
electron/       proses utama Windows: jendela, pengaturan, antrean render
src/            tampilan React + shadcn/ui
  pages/        Overview, Project, Detail project, Antrean Render, Pengaturan
  lib/          Supabase, API, penghubung render
supabase/       schema.sql untuk dijalankan di Supabase
mcp/            server MCP untuk Claude Code / Claude Desktop
remotion-template/  proyek Remotion skill (versi paket dikunci), disalin oleh "Siapkan otomatis"
server/         skrip uji kecepatan render untuk server Linux
```
