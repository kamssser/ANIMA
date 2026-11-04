---
name: hyperforge-flow
description: Video pendek dengan klip dari Google Flow (Veo) untuk pengguna HyperForge. Naskah ditulis Claude, suara narasi dari vibi.pro (alat anima_vibi_tts), Google Flow hanya membuat klip video beserta efek suara (SFX) yang dioperasikan Claude sendiri di Chrome lewat Playwright MCP (alat browser_*), lalu klip dirakit dengan ffmpeg menjadi MP4 bersubtitle. Pakai saat brief HyperForge meminta style "Google Flow".
---

# HyperForge Flow

Pembagian kerja (jangan ditukar):

| Bagian | Dibuat oleh |
|---|---|
| Riset, naskah, daftar shot, prompt video | **Claude** (kamu) |
| Suara narasi | **vibi.pro** lewat `anima_vibi_tts` (suara pilihan pengguna di HyperForge) |
| Timing kata (subtitle) | `anima_vibi_words` |
| Klip video + SFX (suara lingkungan/benda) | **Google Flow** (Veo), dioperasikan kamu lewat alat `browser_*` |
| Rakit akhir (potong, susun, mix, subtitle) | `node <skill>/tools/rakit.mjs` |

Google Flow **tidak** membuat narasi, dialog, atau musik latar untuk video ini. Setiap prompt video menyebut: tanpa dialog, tanpa orang berbicara, tanpa musik, tanpa teks/watermark di gambar.

`<skill>` = folder file ini. Folder kerja = folder sesi. Proyek di `<slug>/` (nama dari brief).

## Aturan Google Flow (penting)

- Chrome khusus Google Flow sudah dibuka HyperForge (profil terpisah, port CDP 9333). Alat `browser_*` (Playwright MCP) tersambung ke Chrome itu: kamu sendiri yang membaca halaman (`browser_snapshot`), mengetik prompt (`browser_type` / `browser_fill_form`), mengklik (`browser_click`), menunggu (`browser_wait_for`), dan melihat layar (`browser_take_screenshot`). **Jangan menyuruh pengguna menyalin-tempel prompt** selama alat ini bekerja.
- Bahasa tampilan Flow bisa apa saja (Indonesia, Inggris, Prancis, ...). Cari elemen dari snapshot, bukan dari teks yang kamu tebak. Petunjuk yang stabil: kotak prompt = `textbox` ("Apa yang ingin Anda buat?" / "What do you want to create?"); tombol kirim = ikon `arrow_forward` ("Mulai pembuatan" / "Create"); setelan = ikon `tune`; panel agen Flow ("Agen"/"Agent") boleh ditutup kalau menghalangi.
- Alat `flow_*` (google-flow-browser-mcp) hanya cadangan: `flow_generate_video` sengaja tidak menekan Generate dan tombolnya hanya dikenali dalam bahasa Prancis/Inggris. Jangan bergantung padanya.
- Generate memakai **kredit Google Flow milik pengguna**. Sebelum shot pertama, sebutkan jumlah klip, model, dan perkiraan kredit, lalu minta persetujuan SEKALI (blok pilihan). Setelah disetujui, kamu yang menekan Generate untuk setiap shot. Jangan generate ulang otomatis lebih dari 1 kali per shot tanpa bertanya.
- Pertama kali: pengguna harus **login Google** di jendela itu. Kalau snapshot menunjukkan halaman login, captcha, atau verifikasi: berhenti dan minta pengguna menyelesaikannya di jendela Chrome. Jangan pernah mengetik kata sandi.
- Unduhan: file dari tombol Download bisa masuk `unduhan/` (folder unduhan Chrome) atau `pw-out/` (folder Playwright MCP; hasil alat menyebut lokasinya). Keduanya di folder kerja sesi. Ambil file mp4 terbaru dari sana.
- Kalau setelah 2 kali coba suatu langkah tetap gagal: ambil screenshot, tunjukkan, dan baru minta pengguna melakukan langkah itu manual.

## Alur

1. **Brief.** Baca `briefs/<slug>.md`. Tanya sekali (satu blok pilihan) hanya yang belum jelas: gaya visual klip (mis. sinematik realistis, animasi 3D kartun, stop-motion, anime), model Flow (Veo 3.1 Fast = hemat, Quality = terbaik), dan apakah perlu subtitle.
2. **Naskah.** Riset bila jenis konten butuh fakta (minimal 2 sumber). Tulis `<slug>/naskah.md`: hook 0-3 detik, narasi lengkap (angka ditulis dengan kata), penutup tuntas. Tunjukkan dan minta persetujuan.
3. **Suara.** `anima_vibi_tts` dengan `estimate: true` -> sebutkan suara + jumlah karakter -> setelah setuju buat `<slug>/audio/vo.mp3` (2 suara: per giliran `speaker` A/B lalu gabung dengan ffmpeg, jeda 0,3 dtk). Lalu `anima_vibi_words` -> `<slug>/audio/words.json`.
4. **Kunci tampilan (WAJIB, sebelum daftar shot).** Video dari teks saja membuat tokoh dan gaya berganti-ganti antar klip. Tulis `<slug>/gaya.json`:
   ```json
   {
     "gaya": "Anime style, hand-drawn 2D cel-shaded animation, clean black line art, flat cel shadows, soft painterly backgrounds, warm muted palette, vertical 9:16 frame.",
     "larangan": "Not 3D, not CGI, not Pixar style, not photorealistic. Same character design in every shot.",
     "tokoh": {
       "MEI": { "nama": "Mei Lin", "deskripsi": "12-year-old Chinese girl, small and child-proportioned, round face, big dark eyes, black hair in two side buns tied with red ribbons, jade-green cotton tunic with frog buttons, dark trousers, black cloth shoes", "ref": "ref/mei.png" }
     },
     "tempat": { "BENGKEL": "old mask workshop: dark wooden walls, shelves of painted masks, lattice window, warm lamp light" }
   }
   ```
   - `gaya` dan `larangan` disalin **persis kata per kata** di awal dan akhir setiap prompt (jangan diparafrasekan, jangan diganti "anime style" saja di satu shot dan "3D" di shot lain).
   - Setiap tokoh yang muncul di shot: salin `deskripsi`-nya **persis** (umur, rambut, pakaian, warna). Jangan menambah sifat baru (mis. "beautiful young woman") yang mengubah umur/rupa. Hindari shot kilas balik/masa depan dengan rupa tokoh berbeda kecuali naskah memintanya.
   - **Gambar referensi:** buat dulu di Flow (mode Gambar, Nano Banana, rasio sama) satu lembar tokoh per tokoh utama (seluruh badan, menghadap depan, latar polos) dan satu bingkai gaya (tempat utama). Unduh ke `<slug>/ref/`, tunjukkan ke pengguna (blok `gambar`) dan minta persetujuan sekali. Gambar biasanya jauh lebih murah dari video.
   - **Pakai referensi saat generate video**, urutan pilihan (pakai yang tersedia di Flow saat itu, cek lewat snapshot):
     1. **Karakter Flow** (menu "Karakter"/"Characters"): buat karakter dari gambar referensi, lalu panggil dengan `@nama` di setiap prompt yang memuat tokoh itu.
     2. **Bahan/ingredients** (tombol `+` "Tambahkan bahan ke kotak perintah" / "Add ingredients"): lampirkan gambar referensi tokoh (+ tempat) ke setiap shot yang memuat tokoh itu (`browser_file_upload` atau pilih dari media project).
     3. **Bingkai awal** (Frames to video): buat gambar awal shot dari referensi (Nano Banana + gambar ref sebagai bahan), lalu animasikan gambar itu.
   - Pakai **model video yang sama** untuk semua shot (jangan campur Fast/Quality/Omni).
   **Daftar shot.** Dari `words.json`, bagi narasi menjadi shot 4-8 detik yang mengikuti kalimat. Tulis `<slug>/shots.json`:
   ```json
   [{ "id": "shot_01", "mulai": 0.0, "selesai": 6.4, "kalimat": "...", "tokoh": ["MEI"], "tempat": "BENGKEL", "prompt": "...", "sfx": "..." }]
   ```
   Prompt bahasa Inggris, satu adegan per shot: `<gaya>` + adegan (tokoh dengan deskripsi persis / `@nama`, tempat dari `gaya.json`, aksi, kamera) + `<larangan>` + `Audio: <sfx shot ini>. No dialogue, no speech, no voice-over, no music, no on-screen text, no subtitles, no watermark.` Durasi klip Flow (4/6/8 dtk) >= durasi shot. Rasio dari brief (9:16 atau 16:9).
   Tunjukkan tabel shot (kalimat + ringkasan adegan) dan minta persetujuan.
5. **Generate per shot** (urut, satu per satu):
   - `browser_tabs` -> pilih tab flow.google.com (buka `https://labs.google/fx/tools/flow` bila belum ada). Buat/buka satu project Flow untuk video ini (nama = slug) dan pakai project itu untuk semua shot.
   - Atur setelan video sekali: mode **Video**, model sesuai persetujuan (Veo 3.1 Fast = hemat, Quality = terbaik), rasio dari brief (9:16 / 16:9), durasi klip (8 dtk bila tersedia), jumlah output **1**. Cek dengan snapshot/screenshot bahwa pilihannya benar.
   - Isi kotak prompt dengan prompt shot itu, klik tombol kirim/Generate. Kalau Flow (mode agen) meminta konfirmasi, konfirmasi.
   - Tunggu klip selesai (`browser_wait_for` beberapa kali, mis. 30 dtk; Veo biasanya 1-3 menit). Jangan memanggil snapshot terus-menerus.
   - Unduh klip terbaru (menu/ikon download di klip itu, pilih kualitas asli/720p/1080p). Pindahkan file baru ke `<slug>/klip/<id>.mp4` (`mv`). Periksa dengan `ffprobe` (durasi, ada audio?) dan lihat 1 frame (`ffmpeg -ss 1 -i ... -frames:v 1 <slug>/klip/<id>.jpg`) sebelum lanjut.
   - **Cek konsistensi tiap klip** sebelum lanjut: bandingkan frame klip dengan gambar di `<slug>/ref/`. Tokoh harus sama (umur, wajah, rambut, pakaian, warna) dan gaya sama (mis. tetap 2D anime, bukan 3D). Kalau melenceng jelas: generate ulang shot itu SEKALI dengan referensi/`@nama` dan deskripsi persis; kalau masih melenceng, catat dan tanya pengguna (pakai saja / ulangi / lewati).
   - Setelah semua klip jadi, buat lembar kontak semua klip (`ffmpeg ... tile`) dan periksa sekali lagi bahwa semuanya terlihat seperti satu film.
   - Laporkan singkat per shot ("shot 2/6 jadi"), tidak perlu minta persetujuan per shot kecuali klipnya jelas salah.
6. **Rakit.** Tulis `<slug>/rakit.json` lalu jalankan `node <skill>/tools/rakit.mjs <slug>`:
   ```json
   {
     "format": "9:16",
     "suara": "audio/vo.mp3",
     "words": "audio/words.json",
     "subtitle": true,
     "sfx": 0.55,
     "musik": null,
     "musikGain": 0.18,
     "shot": [{ "klip": "klip/shot_01.mp4", "mulai": 0.0, "selesai": 6.4, "dari": 0.3 }]
   }
   ```
   `mulai`/`selesai` = waktu di narasi; `dari` = detik awal yang dipakai dari klip (lewati awal klip yang kaku). Klip yang lebih pendek dari shot diperlambat sedikit (maks 1,25x), bukan diulang. Hasil: `<slug>/hasil/<slug>.mp4` (+ `<slug>/hasil/<slug>_tanpa_subtitle.mp4`).
7. **Cek & serahkan.** Lihat 4-6 frame hasil (lembar kontak: `ffmpeg -i hasil/<slug>.mp4 -vf "fps=1/3,scale=320:-2,tile=4x2" -frames:v 1 hasil/kontak.jpg`), dengar ulang awal & akhir (cek suara tidak terpotong). Tunjukkan video (blok `video`). Lalu thumbnail + judul hook sesuai brief (`hasil/thumbnail.jpg`, `hasil/judul.txt`).

## Catatan

- Satu klip yang jelek boleh diganti tanpa mengulang yang lain: generate ulang shot itu saja, lalu rakit lagi.
- Jangan menaruh narasi atau teks di dalam prompt Flow; teks di layar = subtitle dari rakit.mjs.
- Ringkas di obrolan; pengguna awam.
