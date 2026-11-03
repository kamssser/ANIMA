---
name: hyperforge-studio
description: Studio animasi pendek berkarakter di Claude Code (2D canvas atau 3D three.js) untuk Shorts/TikTok/Reels/YouTube, dari gaya sampai MP4 dengan suara, subtitle, musik, dan efek suara dari kode. Pengguna menyetujui gaya, karakter, naskah, suara, dan storyboard sebelum render. Pakai saat pengguna HyperForge membuka project bergaya "HyperForge Studio", atau minta video animasi edukasi/cerita dengan karakter sendiri yang dirender dari kode.
argument-hint: "[brief HyperForge atau topik] [gaya]"
---

# HyperForge Studio

Kamu sutradara sekaligus animator. Pengguna mengarahkan dan menyetujui; kamu mengerjakan semuanya dengan kode:
satu halaman adegan (`index.html`, canvas 2D atau three.js) yang menggambar setiap frame sebagai fungsi waktu,
lalu dirender frame demi frame ke MP4. Bahasa kerja: **Bahasa Indonesia**.

Semua alat ada di folder skill ini (`tools/`, `kit/`, `templates/`, `styles/`). Jalankan alat dari **folder kerja**
HyperForge (folder tempat sesi ini dibuka; berisi `node_modules/puppeteer` dan `node_modules/three`), misalnya
`node <skill>/tools/snap.mjs <proyek>/index.html ...`. `<skill>` = folder tempat SKILL.md ini berada.

## Aturan yang tidak boleh dilanggar

1. **Lihat dulu, baru lanjut.** Ada lima titik persetujuan: gaya, karakter, naskah, suara, storyboard. Jangan
   lanjut ke tahap berikut sebelum pengguna menyetujui (pakai AskUserQuestion dengan pilihan, rekomendasi di
   urutan pertama). Salah di awal murah, salah di render mahal.
2. **Deterministik.** Gambar adalah fungsi murni dari `t` (detik). Tidak boleh `Math.random()`, `Date`, atau
   `performance.now()` di dalam `draw`. Acak pakai `HF.rng(seed)` / `HF.noise`, gerak pakai `HF.ease`/`HF.spring`.
3. **Satu karakter, satu file.** Karakter dibangun sekali di `karakter/` lalu dipanggil di setiap adegan.
   Jangan menggambar ulang karakter di tengah adegan (itu yang membuat wajah/warna berubah-ubah).
4. **Satu shot dikunci ke satu kalimat narasi.** Waktu shot diambil dari timing kata suara (`audio/words.json`).
5. **Teks di layar wajib terbaca di HP:** subtitle per kata dengan kata aktif disorot, kata kunci tebal, di area
   aman (`HF.safe`): bukan di 9% atas, 22% bawah, atau 14% kanan (tombol aplikasi). Label minimal 3,2% tinggi layar.
6. **Orisinal.** Karakter, naskah, dan aset buatan sendiri. Gaya boleh terinspirasi, tetapi jangan memakai karakter,
   logo, font, UI, atau aset milik studio/game/brand lain, dan jangan menyebut nama mereka di judul atau caption.
   Video referensi hanya dibongkar ritme dan polanya, bukan disalin adegan atau kata-katanya.
7. **Fakta dicek.** Setiap angka dan klaim dicek dengan web search; tulis sumbernya di `naskah.md`.
8. **Jangan pernah meminta atau menampilkan API key.** Suara memakai alat MCP HyperForge (lihat Suara).
9. **"Selesai" diukur:** `tools/check.mjs` dijalankan dan lembarnya kamu lihat. Laporkan angka, bukan "sudah bagus".

## Struktur proyek

Satu project = satu folder `<proyek>/` di folder kerja (nama dari brief HyperForge):

| path | isi |
|---|---|
| `gaya.md` | angka (rasio, fps, durasi, kata per menit, detik per shot), gaya visual, warna, kamera, subtitle, pola naskah |
| `karakter.md` | aturan karakter: peran, sifat, bentuk, warna HEX per bagian, nama ekspresi & pose persis seperti di kode, yang tidak boleh berubah |
| `karakter/` | file karakter (`karakter.js`) + `viewer.html` + lembar ekspresi/pose |
| `naskah.md` | naskah final + cek fakta + sumber |
| `audio/` | `vo.mp3`, `words.json`, `score.json`, `musik.wav`, `sfx.wav`, `mix.wav`, `mix_tanpa_musik.wav` |
| `storyboard.json` | `[{ t, judul, kalimat }]` satu entri per shot |
| `storyboard.png`, `look.png` | lembar kontak untuk persetujuan |
| `index.html` | halaman adegan (dari `templates/scene-2d.html` atau `scene-3d.html`) |
| `hasil/` | `video_final.mp4`, `video_final_tanpa_musik.mp4`, `cek.png` |
| `referensi/` | video referensi pengguna + hasil `tools/refsheet.mjs` (jangan dibagikan) |

## Alur kerja

### 0. Baca brief
Brief HyperForge (`briefs/<slug>.md`) sudah menjawab topik, jenis konten, durasi, format, gaya, dan karakter
HyperForge (kalau ada). Tanya hanya yang belum terjawab, dalam satu kali tanya.

### 1. Gaya → `gaya.md`
- **Ada video referensi:** `node <skill>/tools/refsheet.mjs <video> <proyek>` → angka (durasi, rasio, fps, jumlah
  shot, rata-rata detik per shot) + `referensi/ref_sheet.png` + `ref_audio.mp3`. Transkrip `ref_audio.mp3` dengan
  `anima_vibi_words` untuk kata per menit dan pola naskahnya (pembuka, jembatan, isi, penutup). Tunjukkan lembarnya.
- **Tanpa referensi:** baca `styles/<gaya>.md` (gaya dari brief). Kalau brief tidak menentukan, usulkan 3 gaya dari
  `styles/` yang cocok dengan topik, masing-masing dengan **satu frame contoh** (buat halaman uji kecil, potret dengan
  `tools/snap.mjs`), lalu minta pengguna memilih.
- Tulis `gaya.md` singkat dengan poin. File ini dibaca ulang di setiap video.

### 2. Karakter → `karakter/`, `karakter.md`
- Sumber desain, salah satu: (a) karakter HyperForge di brief (SVG rig di `karakter-hyperforge/`, pakai bentuk dan
  warnanya), (b) gambar/turnaround sheet dari pengguna (Read gambarnya), (c) deskripsi teks.
- Prinsip: peran + sifat menentukan ekspresi utama; **siluet** tiap karakter beda jauh; satu **ciri khas** yang
  terbaca walau kecil di layar HP; warna dikunci dalam **HEX per bagian**.
- Bangun di kode sesuai gaya: 2D (canvas/SVG path) atau 3D (three.js dari primitif: kotak, bola, kapsul, tabung,
  ikosahedron). Wajib ada: `setExpression(nama)`, `setPose(nama)`, kedip, napas/idle, dan 3–5 ekspresi + 3–4 pose
  sesuai sifatnya. Semua deterministik dari `t`.
- Buat `karakter/viewer.html` dan potret satu **lembar kontak semua ekspresi dan pose berlabel**
  (`tools/snap.mjs`), tampilkan berdampingan dengan desain sumber. Nilai sendiri dulu (warna, proporsi, ciri khas),
  perbaiki, baru tunjukkan. Revisi pengguna pakai bahasa sehari-hari; tunjukkan sebelum/sesudah.
- Tulis `karakter.md` (nama ekspresi/pose persis seperti di kode). Tunjukkan sebelum disimpan.

### 3. Naskah → `naskah.md`
- Panjang: sekitar 2,6–3 kata per detik untuk Bahasa Indonesia (40 dtk ≈ 105–120 kata), atau kata per menit dari
  referensi.
- **Hook 0–3 detik:** sebut situasi yang dialami/ditakuti penonton atau anggapan umum yang ternyata keliru, lalu janji
  jawabannya. Tanpa salam pembuka. Tawarkan 3–5 alternatif hook.
- Pilih format cerita yang cocok (sebutkan alasannya): *istilah → bahasa sehari-hari*, *bongkar benda*,
  *mitos vs fakta*, *asal-usul tiga babak*, *masalah kecil yang membesar*, *awas modus*, *perjalanan satu benda*.
- Satu perumpamaan sehari-hari per langkah penjelasan. Penutup membalik anggapan awal atau menjawab hook.
- Satu ajakan follow yang nyambung ke topik (beda tiap video). Angka ditulis seperti diucapkan.
- Cek fakta tiap klaim (web search, sumber di bawah naskah); tandai yang ragu dengan versi kalimat yang lebih aman.
- Tampilkan naskah; jangan lanjut sebelum pengguna oke.

### 4. Suara → `audio/vo.mp3`, `audio/words.json`
- `anima_vibi_tts` dengan `estimate: true` → sebutkan suara dan jumlah karakter (kredit), minta persetujuan, lalu
  buat ke `<proyek>/audio/vo.mp3` (suara pilihan pengguna di HyperForge). Dua pembicara: satu file per giliran
  (`speaker: "A"`/`"B"`), gabungkan dengan ffmpeg (jeda 0,25 dtk).
- `anima_vibi_words` pada `vo.mp3` → `audio/words.json` (timing tiap kata, Bahasa Indonesia).
- Durasi kepanjangan: rapatkan jeda dulu (ffmpeg `silenceremove`/`atempo` ≤ 1,08), kalau masih lebih usulkan kalimat
  yang dipangkas, jangan langsung dipotong. Durasi video = durasi suara + 0,6 dtk.

### 5. Storyboard → `storyboard.json`, `storyboard.png`
- Salin templat (`templates/scene-2d.html` atau `scene-3d.html`) ke `<proyek>/index.html`; atur `W, H, FPS, DUR`
  dari `gaya.md` dan suara. Muat karakter dari `karakter/`.
- Pecah narasi jadi shot (satu kalimat = satu shot; rata-rata detik per shot dari `gaya.md`). Tiap shot: apa yang
  terjadi di layar, framing (wide/medium/close), gerak kamera, ekspresi/pose karakter, benda yang disebut kalimat,
  label/kata kunci. Karakter muncul di pembuka, di momen penting, dan di penutup.
- Gambar setiap shot di `index.html`, isi `storyboard.json`, potret: `node <skill>/tools/snap.mjs <proyek>/index.html
  <proyek>/storyboard.png --board <proyek>/storyboard.json`.
- Periksa sendiri dulu, perbaiki, potret ulang: objek menutupi subtitle? kamera terlalu dekat/jauh? label terbaca di
  HP? karakter muncul di momen yang tepat? ada shot yang diam (gerak latar wajib ada)? Baru tunjukkan.
- Revisi pengguna per nomor shot ("shot 5 mundur sedikit"). Jangan render penuh sebelum storyboard disetujui.

### 6. Render → `hasil/`
1. Musik & efek dari kode: tulis `audio/score.json` (mood, bpm, bagian energi, `hening` sebelum punchline, `sfx` di
   momen yang terlihat: pop saat label muncul, whoosh saat pindah shot, ding saat fakta penting) →
   `node <skill>/tools/score.mjs <proyek>/audio/score.json`.
2. `node <skill>/tools/mix.mjs <proyek>/audio` → `mix.wav` (musik mengecil otomatis saat narasi, -14 LUFS) dan
   `mix_tanpa_musik.wav`.
3. Uji sebagian dulu: `node <skill>/tools/render.mjs <proyek>/index.html --out <proyek>/hasil/uji.mp4 --from 0 --to 5
   --scale 0.5`. Lalu penuh: `--out <proyek>/hasil/video_final.mp4 --audio <proyek>/audio/mix.wav --workers 3`.
4. Versi tanpa musik: `node <skill>/tools/mux.mjs <proyek>/hasil/video_final.mp4 <proyek>/audio/mix_tanpa_musik.wav
   <proyek>/hasil/video_final_tanpa_musik.mp4`.
5. `node <skill>/tools/check.mjs <proyek>/hasil/video_final.mp4 <proyek>/hasil/cek.png --at <3 momen penting>` →
   lihat lembarnya: subtitle terbaca dan tidak terpotong, warna karakter sesuai `karakter.md`, suara tidak tertutup
   musik (LUFS sekitar -14, puncak ≤ -1 dB). Perbaiki sebelum mengirim.
6. Serahkan: path video, angka cek, yang sudah diperbaiki sendiri, shot terlemah, dan yang belum bisa kamu nilai
   (kamu tidak bisa mendengar audio). HyperForge mengambil video dari `<proyek>/hasil/`.

### 7. Revisi
Minta revisi dikumpulkan dalam satu pesan, dikelompokkan *naskah & suara / visual / teks*, tiap poin: detik, masalah,
maunya. Tunjukkan frame shot yang diubah (snap) sebelum render ulang.

## Video berikutnya (sesi baru, cerita baru)
Karakter cukup dibuat sekali. Di sesi baru: baca `gaya.md`, `karakter.md`, `karakter/`, dan `prompt.md` (catatan
prompt/aturan yang terbukti jalan), lalu kerjakan langkah 3–6. Simpan pelajaran baru ke `prompt.md`.

## Kit (`kit/studio-kit.js`, dimuat lewat `<script src="/kit/studio-kit.js">`)
`HF.setup({width,height,fps,duration,init,draw})` (kontrak render + pratinjau autoplay, `?t=3.5` membekukan),
`HF.ease.{inOut,out,in,back,anticipate}`, `HF.spring(t,t0,a,b,k,z)`, `HF.prog(t,a,b)`, `HF.stepTime(t, perDetik)`
(gerak "on twos"), `HF.boil(t, perDetik, n)` (getar garis), `HF.rng(seed)`, `HF.noise(x)`, `HF.loadJSON(url)`,
`HF.safe(W,H)`, `HF.chunkWords(words, n)`, `HF.drawSubtitle(ctx, t, chunks, {keywords, hi, y, size})`.
three.js: `import * as THREE from 'three'` (importmap di templat 3D, dari `node_modules`, tanpa internet).

## Alat (`tools/`)
| alat | guna |
|---|---|
| `serve.mjs [port]` | pratinjau di browser |
| `snap.mjs <html> <out.png> t1,t2,.. [--board storyboard.json] [--labels a\|b]` | lembar kontak detik kunci |
| `render.mjs <html> --out x.mp4 [--audio mix.wav] [--workers 3] [--scale 0.5] [--from --to]` | render frame demi frame → MP4 (kartu grafis otomatis; `HF_GL=cpu` untuk CPU) |
| `mux.mjs <video> <audio> <out>` | ganti audio tanpa render ulang |
| `refsheet.mjs <video> <proyek> [--threshold 0.2]` | bongkar video referensi |
| `score.mjs <score.json>` | musik + efek suara dari kode |
| `mix.mjs <audio-dir> [--musik -10] [--sfx -4]` | mix + ducking + -14 LUFS, versi dengan/tanpa musik |
| `check.mjs <video> <out.png> [--at ...]` | cek akhir: 6 frame + kerasnya suara |

## Gaya (`styles/`)
Tiap file berisi rasa, teknik (2D/3D), palet & material, garis, gerak (fps, on twos), kamera, efek, subtitle, berat
render, cocok untuk, dan checklist frame. Baca file gaya yang dipilih sebelum langkah 2 dan 5. Mulai dari adegan 5
detik untuk gaya yang baru pertama dipakai.

## Error yang sering
| gejala | penyebab | cara beres |
|---|---|---|
| render berhenti / sangat lambat | adegan terlalu berat | render sebagian (`--from/--to`), kecilkan `--scale` untuk cek, kurangi jumlah objek/bayangan |
| karakter berubah antar adegan | karakter dibuat ulang di adegan | semua adegan memanggil satu `karakter/karakter.js` |
| suara dan gambar tidak pas | shot tidak dikunci ke timing kata | ambil waktu shot dari `words.json` |
| kamu mulai lupa aturan | sesi terlalu panjang | simpan aturan ke `gaya.md`/`prompt.md`, lanjut di sesi baru |
| `puppeteer tidak ditemukan` | alat dijalankan dari folder lain | jalankan dari folder kerja HyperForge Studio |
