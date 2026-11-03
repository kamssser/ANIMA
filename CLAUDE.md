# HyperForge (repo ANIMA)

Aplikasi Windows (Electron + React + shadcn/ui) untuk produksi video pendek 3D dengan skill
cartoon-3d-short (Remotion + three.js). Pemilik: kamssser. Pengguna: pemilik dan teman-temannya
(dibagikan lewat installer + update otomatis). Bahasa UI dan komunikasi: Indonesia.

## Aturan rilis update (WAJIB)

Setiap kali mengubah aplikasi lalu merilis versi baru:

1. Naikkan `version` di `package.json` (semver: perbaikan = patch 0.3.1 -> 0.3.2, fitur = minor 0.3.x -> 0.4.0).
2. **Tulis catatan update di `CHANGELOG.md`** dengan judul `## <versi> - <YYYY-MM-DD>` di paling atas
   (di bawah pembuka). Bahasa Indonesia sederhana untuk pengguna, kelompokkan ke **Baru** / **Perbaikan** /
   **Perubahan**. Jangan menulis detail teknis internal. `scripts/release.mjs` menolak rilis kalau bagian
   untuk versi itu belum ada; catatan ini dipakai sebagai catatan rilis GitHub dan tampil di dialog update aplikasi.
3. `npm run build` harus lolos (tsc + vite) dan cek tampilan yang diubah sebelum rilis.
4. Commit (pesan commit dari file, lihat catatan PowerShell di bawah) lalu `git push origin main`.
5. `npm run release` (butuh env `GH_TOKEN`). Skrip membuat tag `v<versi>`, release GitHub berisi catatan
   dari CHANGELOG, lalu mengunggah installer, `.blockmap`, dan `latest.yml`.
6. Verifikasi: `https://github.com/kamssser/ANIMA/releases/latest/download/latest.yml` menunjukkan versi baru.
7. Beri tahu pemilik link unduh dan ringkasan catatan update.

Memperbaiki/menambah catatan rilis yang sudah terbit tanpa build ulang: `node scripts/release.mjs --notes-only`
(menyinkronkan semua bagian CHANGELOG ke release GitHub yang tag-nya sudah ada).

## Jangan pernah

- Commit rahasia: `GH_TOKEN`, API key vibi.pro, secret key Supabase. `app-defaults.json` hanya boleh berisi
  URL + **publishable** key Supabase (ikut ke installer).
- Upgrade `@react-three/postprocessing` di `remotion-template/` melewati 3.0.4 tanpa uji: 3.2.x membuat frame
  render kosong di Remotion (lihat `remotion-template/README.md`).
- Mengganti `app.setPath('userData', ...ANIMA Studio)` di `electron/main.cjs`: data pengguna lama ada di sana.
- Mengedit isi `bang-motion-skill/bang-motion/` (salinan utuh https://github.com/bangtutorial/bang-motion, MIT, sama:
  dipakai "persis"; perbarui dengan menyalin ulang + ganti commit di `SOURCE.md` dan `electron/skills.cjs`).
- Menyalin isi paket **Animantra: Vector** (skill `animantra-vector`, file contoh, patokan, huruf, installer) ke repo atau
  installer: paket berbayar, `LISENSI.md`-nya melarang dibagikan ulang. HyperForge hanya memakai skill yang dipasang
  pengguna di `~/.claude/skills/animantra-vector` (mesin `animantra` di `electron/skills.cjs`); skill dipakai persis, jangan
  diedit.
- Mengedit isi `animate-skill/animate/`: salinan utuh skill https://github.com/cth9191/animate (MIT). Pemilik minta
  dipakai "persis 100%". Untuk memperbarui: salin ulang dari repo aslinya, ganti commit di `animate-skill/SOURCE.md` dan
  `commit` mesin animate di `electron/skills.cjs`.

## Catatan teknis

- Windows PowerShell 5.1: pesan commit multi-baris lewat file (`git commit -F <file>`), bukan here-string.
- Proyek Remotion untuk render ada di luar repo (`%USERPROFILE%\anima-remotion`), dibuat dari
  `remotion-template/` lewat Pengaturan > Proyek Remotion > Siapkan otomatis.
- Laptop pemilik: i7-4710MQ, 16 GB RAM, tanpa GPU kuat. Render lengkap 540x960 sekitar 28 detik/frame;
  paralel justru lebih lambat. Uji kecepatan ada di Pengaturan > Render.
- `studio-skill/hyperforge-studio/` = skill buatan HyperForge sendiri (MIT, boleh diedit). Dibuat ORIGINAL: jangan
  memasukkan isi "Guide Studio Animasi AI" (PDF berbayar milik pemilik, "jangan disebarluaskan"; `*.pdf` di-ignore).
  Penanda pemasangan = hash isi skill, jadi perubahan apa pun otomatis terpasang ulang lewat Siapkan otomatis.
- Struktur: `electron/` (proses utama, render, update, MCP install; `skills.cjs` = style dari skill animate & bang-motion), `src/` (UI), `mcp/` (server MCP),
  `supabase/schema.sql`, `scripts/release.mjs`, `remotion-template/`, `server/bench.sh`.
