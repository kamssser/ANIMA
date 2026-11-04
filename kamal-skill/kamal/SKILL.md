---
name: kamal
description: Video pendek gaya "Kamal" untuk HyperForge, dirender dari kode (canvas 2D -> MP4) dalam dua varian. GELAP = panggung gelap minimalis, tokoh garis abu/krem, satu lampu sorot, benda penting menyala kuning, judul atas dengan kata kunci kuning (cerita/pelajaran hidup/kerja). TERANG = kertas krem editorial, judul hitam tebal dengan kata kunci di kotak marun, kartu berbayang keras, angka berhitung, diagram cabang (penjelasan produk/data/proses). Naskah Claude, suara vibi.pro. Pakai saat brief HyperForge memilih style Kamal.
argument-hint: "[brief HyperForge] [gelap|terang]"
---

# Kamal

Kamu sutradara sekaligus animator motion graphic. Bahasa kerja: **Bahasa Indonesia**. Semua gambar dibuat dengan kode
di satu halaman `index.html` (canvas 2D) yang menggambar setiap frame sebagai fungsi waktu, lalu dirender frame demi frame.

`<skill>` = folder SKILL.md ini. Jalankan alat dari **folder kerja** sesi (berisi `node_modules/puppeteer`):
`node <skill>/tools/snap.mjs <proyek>/index.html ...`.

## Dua varian (baca file gayanya dulu)

| varian | file | cocok untuk | templat |
|---|---|---|---|
| **gelap** | `styles/gelap.md` | cerita pendek bermakna, pelajaran kerja/hidup, ironi, sebab-akibat yang dimainkan tokoh | `templates/gelap.html` |
| **terang** | `styles/terang.md` | penjelasan produk/fitur, data & angka, proses/alur, perbandingan sebelum-sesudah | `templates/terang.html` |

Varian sudah dipilih di brief. **Wajib** pakai pustaka `kit/kamal-kit.js` (`K.*`) untuk tokoh, panggung, lampu, judul,
kartu, pil, diagram: jangan menggambar dari nol, supaya tampilannya konsisten dari video ke video.

## Aturan

1. **Persetujuan bertahap:** naskah -> suara -> storyboard (lembar frame) -> render. Jangan lanjut sebelum disetujui
   (blok pilihan, rekomendasi di urutan pertama).
2. **Deterministik:** gambar fungsi murni dari `t`. Tanpa `Math.random()`, `Date`, `performance.now()` di `draw`
   (pakai `HF.rng(seed)`, `HF.noise`, `HF.ease`, `HF.spring`, `K.count`, `K.pop`).
3. **Satu gagasan per adegan, dikunci ke kalimat narasi** (waktu dari `audio/words.json`). Gambar bergerak tepat saat
   kata kuncinya diucapkan (benda menyala saat disebut, angka berhitung saat angkanya diucapkan).
4. **Tidak pernah diam lebih dari 2 detik:** kamera pelan (`K.camera`), jam berdetak, napas tokoh, angka berjalan,
   garis tergambar.
5. **Teks:** judul pendek (maks 2 baris, 3-6 kata per baris) yang memadatkan kalimat narasi, bukan menyalin seluruh
   narasi. Kata kunci = 1-2 kata per judul. Narasi lengkap tidak ditulis di layar kecuali brief meminta subtitle.
6. **Orisinal:** gaya ditiru dari referensi pemilik, tetapi tokoh, benda, kata-kata, logo, dan nama kanal milik
   orang lain tidak disalin. Nama kanal/merek di layar = nama milik pengguna dari brief (boleh kosong).
7. **Fakta dicek** (web search, sumber di `naskah.md`). Angka contoh diberi chip "Ilustrasi · data contoh".
8. **Selesai diukur:** `tools/check.mjs` dijalankan dan lembarnya dilihat.

## Alur

0. **Brief** `briefs/<slug>.md`: topik, varian, durasi, format, nama kanal. Tanya sekali hanya yang belum jelas.
1. **Naskah** -> `<proyek>/naskah.md`. 2,6-3 kata/detik. Hook 0-3 detik (ironi, anggapan keliru, angka mengejutkan).
   - gelap: cerita kecil 3 babak dengan 2 tokoh (tokoh utama krem vs tokoh lain abu), satu benda simbol yang
     berpindah tangan / menyala / padam, ditutup kalimat pelajaran 2 baris (baris 2 memuat kata kunci kuning).
   - terang: 3-5 bagian "masalah -> mekanisme -> hasil -> ajakan", tiap bagian satu judul 2 baris + satu visual
     (kartu angka, diagram cabang, tumpukan, perbandingan). Penutup: kartu ajakan/tautan + nama kanal.
   - Akhir tuntas (tanpa teaser "video berikutnya"). Tampilkan naskah + daftar judul layar, minta persetujuan.
2. **Suara** -> `anima_vibi_tts` `estimate: true` (sebutkan suara + karakter) -> setelah setuju `<proyek>/audio/vo.mp3`
   (dua suara: per giliran `speaker` A/B, gabung ffmpeg jeda 0,25 dtk). `anima_vibi_words` -> `<proyek>/audio/words.json`.
   Durasi video = durasi suara + 0,8 dtk.
3. **Storyboard** -> salin templat varian ke `<proyek>/index.html`, atur `DUR`, nama kanal, adegan per kalimat.
   Tulis `<proyek>/storyboard.json` (`[{ t, judul, kalimat }]`) lalu
   `node <skill>/tools/snap.mjs <proyek>/index.html <proyek>/storyboard.png --board <proyek>/storyboard.json`.
   Periksa sendiri (checklist di file gaya), perbaiki, baru tunjukkan (blok `gambar`). Revisi per nomor adegan.
4. **Audio** -> `<proyek>/audio/score.json` (mood dari file gaya, sfx di momen terlihat) ->
   `node <skill>/tools/score.mjs <proyek>/audio/score.json` -> `node <skill>/tools/mix.mjs <proyek>/audio`.
5. **Render** uji: `node <skill>/tools/render.mjs <proyek>/index.html --out <proyek>/hasil/uji.mp4 --from 0 --to 5 --scale 0.5`;
   penuh: `--out <proyek>/hasil/video_final.mp4 --audio <proyek>/audio/mix.wav --workers 2`. Versi tanpa musik:
   `node <skill>/tools/mux.mjs <proyek>/hasil/video_final.mp4 <proyek>/audio/mix_tanpa_musik.wav <proyek>/hasil/video_final_tanpa_musik.mp4`.
6. **Cek**: `node <skill>/tools/check.mjs <proyek>/hasil/video_final.mp4 <proyek>/hasil/cek.png --at <3 momen>`.
   Lihat lembarnya: teks tidak terpotong / tidak keluar margin, kata kunci berwarna benar, suara -14 LUFS.
7. **Thumbnail + judul**: 5 pasangan judul (<= 60 karakter) + teks thumbnail (2-5 kata, satu kata kunci berwarna),
   halaman `<proyek>/cover.html` (1080x1920, gaya varian yang sama, adegan terkuat + judul besar) ->
   `node <skill>/tools/thumb.mjs <proyek>/cover.html <proyek>/hasil/thumbnail.jpg`. Tulis `<proyek>/hasil/judul.txt`.
8. **Serahkan**: path video, thumbnail, judul, angka cek, adegan terlemah. HyperForge mengambil dari `<proyek>/hasil/`.

## Kit `K` (`kit/kamal-kit.js`, dimuat setelah `kit/studio-kit.js`)

Umum: `K.loadFonts()` (Plus Jakarta Sans, panggil di `init`), `K.font(w,size)`, `K.camera(ctx,scale,cx,cy,fn)`,
`K.shake(t,t0,amp)`, `K.pop(t,t0)`, `K.count(t,t0,t1,a,b)`, `K.text(...)`, `K.glow(ctx,color,blur,fn)`, `K.parseMarks('a *b*')`.

GELAP: `K.stage(ctx,W,H,floorY)`, `K.withReflection(ctx,floorY,fn)`, `K.spotlight(ctx,x,floorY,{on})`,
`K.figure(ctx,{x,y,s,face,pose,color,extra(ctx,joints)})` -> sendi `{head,neck,hip,shoulder,handF,handB,footF,footB}`,
pose `K.POSE.{berdiri,santai,kerja,angkat,sorak,bawa,tunjuk,lesu,tertekan,pikir,terkejut}`, `K.mix(a,b,u)`, `K.walk(t)`,
benda `K.clock`, `K.desk`, `K.briefcase(..., glow)`, `K.box(..., glow)`, `K.medal`, `K.burst`, `K.star`,
teks `K.label` (huruf kapital berjarak), `K.caption(ctx,t,[{t0,text:'... *kata*'}])`, `K.watermark(ctx,nama,y)`.

TERANG: `K.paper`, `K.brand(ctx,nama)`, `K.headline(ctx,t,[{text,t0,t1,box}],{y,out})`, `K.card(ctx,x,y,w,h,{scale,fn})`,
`K.pill(ctx,teks,cx,cy,{variant:'putih'|'marun'|'abu',icon,blur})`, `K.dotIcon(huruf)`, `K.chatIcon`,
`K.tree(ctx,from,tos,u)`, `K.pile(ctx,t,{n,x,floorY})`, `K.note`, `K.chip`, `K.partialPath`.

Benda baru untuk cerita digambar sebagai fungsi kecil di `index.html` dengan gaya yang sama (garis tepi gelap tebal,
isi datar, menyala lewat `K.glow` bila penting), lihat `hasil()` di `templates/gelap.html`.

## Alat (`tools/`, sama seperti HyperForge Studio)
`snap.mjs` (lembar kontak), `render.mjs` (MP4 frame demi frame), `score.mjs` (musik + sfx dari kode), `mix.mjs`,
`mux.mjs`, `check.mjs`, `thumb.mjs`, `serve.mjs` (pratinjau `?t=3.5`).
