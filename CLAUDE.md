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

- Mengubah isi skill/alat yang diambil dari GitHub pada commit tetap (tidak ada di repo, dipasang lewat Siapkan otomatis):
  `lemo-opuscar` (lemomo-ai/lemo-opuscar, MIT; contoh film CC BY 4.0), `motionmaxxing` (Tejashmakwana/motionmaxxing,
  Apache-2.0), dan `google-flow-browser-mcp` (TMSSS05, MIT), `directing-stickman-videos` (kaomei/stickman-video-director, MIT),
  `hand-drawn-video-prompts` (kaomei, MIT). Juga `human-voice` (zircote/human-voice, MIT, `VOICE_SKILL`), dipasang opsional untuk semua style. Untuk memperbarui: ganti `commit` di `electron/skills.cjs`.
  Agent Reach dipasang dengan uv dari rilis GitHub-nya (bukan PyPI; paket PyPI bernama sama bukan proyek itu).

## Catatan teknis

- Windows PowerShell 5.1: pesan commit multi-baris lewat file (`git commit -F <file>`), bukan here-string.
- Proyek Remotion untuk render ada di luar repo (`%USERPROFILE%\anima-remotion`), dibuat dari
  `remotion-template/` lewat Pengaturan > Proyek Remotion > Siapkan otomatis.
- Laptop pemilik: i7-4710MQ, 16 GB RAM, tanpa GPU kuat. Render lengkap 540x960 sekitar 28 detik/frame;
  paralel justru lebih lambat. Uji kecepatan ada di Pengaturan > Render.
- `studio-skill/hyperforge-studio/` = skill buatan HyperForge sendiri (MIT, boleh diedit). Dibuat ORIGINAL: jangan
  memasukkan isi "Guide Studio Animasi AI" (PDF berbayar milik pemilik, "jangan disebarluaskan"; `*.pdf` di-ignore).
  Penanda pemasangan = hash isi skill, jadi perubahan apa pun otomatis terpasang ulang lewat Siapkan otomatis.
- `flow-skill/hyperforge-flow/` = skill buatan HyperForge (MIT, boleh diedit) untuk style Google Flow: naskah Claude,
  suara vibi.pro, klip + SFX dari Flow yang dioperasikan Claude lewat Playwright MCP (`@playwright/mcp` versi tetap di `electron/skills.cjs`,
  tersambung ke Chrome Flow port 9333), `tools/rakit.mjs` merakit MP4.
- Explainer Datar v2: tokoh tetap **Tora** (`XD.tora`, `XD.TORA`; `XD.pembawa` kini menggambar Tora), pendamping `XD.chibi`, `XD.lapisan` (blur/tepi cahaya), `XD.kamera`, `XD.grade`, kartu istilah/lokasi, `XD.bicara` di `studio-skill/hyperforge-studio/kit/explainer-datar.js`; aturan di `styles/explainer-datar.md`. Gaya diambil dari referensi pemilik (kanal edukasi), jangan menyalin nama/logo kanal referensi.
- `edu-skill/edu-motion-studio/` = skill milik pemilik (boleh dibagikan), dipasang bersama HyperForge Studio (`EDU_SKILL`), dipakai Explainer Datar; aturan HyperForge menang.
- `kamal-skill/kamal/` = skill buatan HyperForge (MIT, boleh diedit) untuk style Kamal (gelap/terang) dari video referensi
  pemilik. Alat render disalin dari hyperforge-studio; pustaka gaya `kit/kamal-kit.js`; huruf Plus Jakarta Sans (OFL) di
  `kit/fonts/`. Jangan menyalin nama/logo kanal referensi (Garis Hidup, Dalekta) ke skill.
- Stickman: mesin `stickman` = skill kaomei/stickman-video-director (MIT, commit tetap `STICK_COMMIT`) mode B Autopilot,
  suara vibi.pro. Style Google Flow stickman/crayon membaca skill itu dan kaomei/hand-drawn-video-prompts (dipasang oleh
  Siapkan Google Flow); catatan per style ada di `skillNote` di `shared/visual-styles.json`.
- Storyboard cerita + teks suara: semua brief skill mendapat aturan `storyRule` (src/components/skill-video.tsx): Claude menulis
  `<proyek>/cerita.json` lalu menunggu; pengguna mengedit di dialog **Storyboard & naskah** (src/components/story-editor.tsx,
  IPC story:read/story:write di electron/skills.cjs).
- Branding (Pengaturan > Branding, `brandOn`/`brandText`): render 2D/3D lewat `remotion-template/src/anima/Brand.tsx` (Comic2D watermark, TextOverlay brand); skill lewat `brandRule` di brief (src/components/skill-video.tsx); Flow lewat `brand` di rakit.json. Aturan naskah suara semua style: `narrationRules` di shared/content-types.json. Suara ElevenLabs ekspresif: `voiceSettings` (electron/main.cjs, mcp/server.mjs), mundur ke pengaturan lama kalau vibi.pro menolak (400/422).
- Python: `ensurePython` di electron/skills.cjs melewati alias Microsoft Store dan memasang Python 3.12 via winget; paket pip
  opsional yang gagal hanya peringatan.
- Otak custom (`electron/brain.cjs`): env ANTHROPIC_* diset di process.env proses utama, jadi semua proses `claude`
  ikut. Penyimpanan: `electron/storage.cjs`. Riset: `electron/reach.cjs`.
- Struktur: `electron/` (proses utama, render, update, MCP install; `skills.cjs` = style dari skill animate & bang-motion), `src/` (UI), `mcp/` (server MCP),
  `supabase/schema.sql`, `scripts/release.mjs`, `remotion-template/`, `server/bench.sh`.
