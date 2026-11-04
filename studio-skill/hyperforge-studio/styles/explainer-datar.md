# Explainer datar (v2: sinematik lembut, tokoh tetap Tora)

| teknik | berat render | cocok untuk |
|---|---|---|
| 2D (canvas) + pustaka `kit/explainer-datar.js` | ringan-sedang | explainer edukasi & isu sosial/ekonomi, sains, sejarah singkat, "kenapa bisa begitu", video YouTube 3–15 menit |

- **Rasa:** explainer edukasi yang hangat dan nyaman di mata: tokoh chibi lembut (kepala besar kotak-membulat, mata titik),
  dunia 2D datar bergradasi halus, **kamera dekat dengan latar buram**, cahaya hangat berpendar, dan informasi editorial
  yang rapi. Bukan garis tinta, bukan tekstur kertas, tanpa outline hitam.
- **Otak redaksi:** riset, hook, naskah, dan storyboard mengikuti skill **edu-motion-studio** (kalau terpasang); aturan
  HyperForge di brief dan di file ini menang bila bertentangan.

## Wajib: pakai pustaka gaya (supaya gambar tidak melenceng)

Muat `<script src="/kit/explainer-datar.js"></script>` setelah `studio-kit.js`. **Jangan menggambar tokoh dari nol** dan
jangan membuat versi tokoh sendiri "yang mirip". Contoh lengkap 6 adegan: `samples/explainer-datar.html`.

| fungsi | guna |
|---|---|
| `XD.tora(ctx, x, y, s, o)` | **tokoh tetap Tora** (s = 1 tinggi ±480 px); hanya pose/ekspresi/gerak/arah yang berubah |
| `XD.chibi(ctx, x, y, s, o)` | tokoh pendamping/cerita dengan gaya & proporsi yang sama (`kulit`, `rambut`, `gayaRambut: bob/cepak/jambul`, `baju`, `celana`, `sepatu`) |
| `XD.lapisan(ctx, fn, { blur, tepi, tebal })` | gambar satu lapisan utuh: **blur** untuk latar/latar depan di luar fokus, **tepi** = garis cahaya krem di sekeliling benda penting |
| `XD.kamera(ctx, W, H, t, { t0, t1, zoom, geser, fokus })` | dolly pelan + paralaks: `lapis(0.2..1.6)` sebelum tiap lapisan, `lapis(null)` sebelum teks |
| `XD.grade(ctx, W, H, { glow, hangat, kabut })` | penilaian warna akhir (hangat, kontras rendah, pendar). Panggil **setelah semua gambar, sebelum teks** |
| `XD.bokeh` `XD.vinyet` `XD.sinar` `XD.cahaya` `XD.kabut` | titik cahaya, pinggir gelap halus, berkas matahari, cahaya lembut, kabut cakrawala |
| `XD.langit` `XD.awan` `XD.bukit` `XD.semak` `XD.ranting` `XD.pohon` `XD.rumah` `XD.gedung` `XD.kota` | latar luar: awan bergaya lukis, bukit, semak, pohon, bangunan |
| `XD.kartuIstilah(ctx, x, y, { kecil, judul, isi, muncul })` | kartu istilah kiri atas: istilah asli kecil miring, judul KAPITAL tebal, 1–2 baris penjelasan |
| `XD.kartuLokasi(ctx, x, y, { judul, isi, atas, tag })` | lokasi/waktu: `tag:true` = kotak merah (nama tempat + tanggal) |
| `XD.angkaBesar(ctx, x, y, { judul, isi })` | angka/fakta besar di tengah (">34°C", "525.000 HEKTAR") + keterangan |
| `XD.penanda(ctx, x, y, teks)` | penanda waktu tebal kiri bawah ("HARI 1", "PUKUL 11.30") |
| `XD.bicara(ctx, x, y, teks, { ekor })` | gelembung bicara putih (ekor ke mulut pembicara, `\n` = baris baru) |
| `XD.mataBenda(ctx, x, y, s, { t })` | dua mata titik untuk benda/organ/hewan kecil supaya hidup (termometer, sel, benih) |
| `XD.gelembung(ctx, W, H, u)` `XD.sapuan(ctx, W, H, u, warna)` | transisi: gelembung warna dan sapuan miring penuh layar |
| `XD.label` `XD.chip` `XD.peta` `XD.pin` `XD.panah` `XD.emas` `XD.koin` `XD.uang` ... | label/benda v1 (masih boleh dipakai, beri `XD.lapisan(..., { tepi })` agar serasi) |
| `XD.penutup(ctx, t, o)` | kartu penutup terima kasih dengan Tora melambai (lihat Penutup) |
| `XD.judulBesar(ctx, x, y, baris, o)` | judul thumbnail (lihat Thumbnail) |

Opsi Tora/chibi: `t`, `pose` (`diam` `tunjuk` `lambai` `garuk` `kepala` `tanya` `pinggang` `angkat` `pegang` `sedekap`
`hitung`), `ekspresi` (`netral` `senang` `tenang` `sedih` `kaget` `marah` `ragu` `bingung` `malu`), `bicara`, `lihat`
(-1..1), `hadap` (1/-1), `dari: 'belakang'`, `keringat`, `merona`, `blur` (tokoh di luar fokus), `tepi: false`.
`XD.tokoh`/`XD.pembawa` lama tetap ada untuk proyek lama; `XD.pembawa` sekarang menggambar Tora.

## Tokoh tetap: Tora (WAJIB, sama di semua video gaya ini)

Semua video explainer datar dibawakan tokoh yang **sama**: **Tora** = `XD.TORA`: kepala kotak-membulat besar, kulit krem
persik, **rambut hitam tebal dengan jambul runcing**, **hoodie kuning mustard bertali**, celana hijau zaitun, sepatu putih.
Panggil `XD.tora(ctx, x, y, s, { t, pose, ekspresi, bicara, lihat, hadap, dari })`. **Jangan** mengganti warna, rambut,
pakaian, atau proporsinya, jangan membuat "versi lain" Tora, dan jangan menawarkan desain pembawa baru di langkah
karakter. Langkah 2 (karakter) untuk gaya ini cukup: lembar ekspresi/pose Tora + tokoh cerita.
- Tora muncul di pembuka, di momen penting, dan di penutup. Tora = suara A (1 suara: Tora sekaligus narator; 2 suara:
  Tora berbicara sebagai dirinya, narator = suara B).
- **Tokoh cerita** (teman, orang tua, ilmuwan, tokoh sejarah) = `XD.chibi` dengan preset di `karakter/karakter.js`
  (`const SARI = { kulit, rambut, gayaRambut: 'bob', baju, celana }`), dipakai ulang tanpa diubah di seluruh video.
- Kalau brief membawa karakter HyperForge (SVG), itu hanya untuk gaya lain: di gaya ini pembawanya tetap Tora.

## Tampilan v2 (yang membuat gaya ini terasa)

- **Kamera dekat & sinematik.** Sering medium/close-up: tokoh setinggi 60–120% layar, boleh terpotong bingkai; sudut dari
  belakang/bahu (`dari:'belakang'`) saat tokoh memandang dunia; benda penting di depan tajam dengan tokoh buram di belakang.
- **Kedalaman = blur.** Latar belakang SELALU `XD.lapisan(..., { blur: 6–10 })` saat tokoh/benda di depan menjadi fokus;
  latar depan (daun, tiang, semak) blur 16–22. Hanya subjek fokus yang tajam.
- **Tepi cahaya krem** tipis di sekeliling tokoh (otomatis di `XD.tora`/`XD.chibi`) dan benda penting
  (`XD.lapisan(..., { tepi: 'rgba(255,236,205,0.85)', tebal: 4 })`).
- **Tokoh:** proporsi dari pustaka (kepala ±45% tinggi, badan ramping, kaki panjang, lengan tipis); wajah di bawah
  kepala: mata titik kecil, **tanpa alis/mulut** kecuali ekspresi kuat atau sedang bicara; gradasi halus, tanpa outline.
- **Dunia:** interior hangat yang hidup (dinding kuning/krem, jendela terang bercahaya, rak buku, sofa merah, lemari
  kayu, lantai abu-hijau) dan luar ruangan bergaya lukis (awan bergumpal dengan bayangan biru, bukit, pepohonan bulat).
  Benda nyata (bangunan terkenal, alat, peta): cari foto/peta referensi dulu, ambil siluet + 2–3 ciri, sederhanakan.
- **Warna:** hangat, kontras rendah, sedikit pudar; satu aksen kuat untuk informasi (merah `#e0384c` untuk tag/gelembung
  transisi, kuning untuk kata kunci subtitle). Adegan konsep/abstrak boleh latar gelap biru tua dengan objek menyala
  (seperti benda di luar angkasa). Akhiri setiap frame dengan `XD.vinyet` + `XD.grade`.
- **Teks editorial:** kartu istilah & lokasi di kiri atas, angka besar di tengah, penanda waktu kiri bawah, gelembung
  bicara pendek (≤ 3 kata per baris). Maksimal satu kartu per adegan. Huruf sans tebal putih dengan bayangan lembut.
- **Layar terbelah** untuk perbandingan (dulu vs sekarang, kota vs desa): garis putih tipis di tengah + keterangan
  kiri bawah tiap sisi (judul tebal + 1 baris kecil).
- **Benda hidup:** benda/organ/sel yang dijelaskan boleh diberi `XD.mataBenda` supaya terasa seperti tokoh.

## Lembar tokoh & benda (WAJIB sebelum storyboard)

Buat `<proyek>/benda.html`: Tora + semua tokoh cerita (ekspresi + pose yang akan dipakai) dan semua benda cerita, lalu
potret ke `benda.png` (`tools/snap.mjs`). Bandingkan dengan `samples/explainer-datar.html`. Periksa sendiri:
- [ ] Tora dari `XD.tora`, tokoh lain dari `XD.chibi`; proporsi tidak diubah
- [ ] tepi cahaya krem ada di tokoh & benda penting; tidak ada outline hitam
- [ ] benda terbaca jelas walau kecil di layar HP; skala benda masuk akal terhadap tokoh
- [ ] benda nyata cocok dengan foto/peta referensinya (siluet & ciri utama)
Tunjukkan `benda.png` bersama frame contoh saat persetujuan karakter.

## Gaya narator & cara bercerita (WAJIB)

Naratornya seperti teman pintar yang asyik ngobrol, bukan guru atau pembaca berita. Santai, lucu sedikit, tapi
faktanya tetap akurat dan bersumber.
- **Bahasa:** Indonesia lisan sehari-hari yang santai dan sopan: "kita", "kamu", "emang", "kayak", "gara-gara",
  "banget", "ngga", "liat", "denger", "pengen". Hindari bahasa baku kaku ("adalah merupakan", "oleh karena itu",
  "sebagaimana"). Tidak pakai "gue/lo" dan tidak kasar.
- **Pembuka:** mulai dari pengalaman atau keluhan yang akrab dengan penonton ("Kita mungkin sering denger ...",
  "Pernah ngga sih kamu ..."), boleh disambung peribahasa/ungkapan populer yang dipelesetkan ringan, lalu lempar satu
  pertanyaan besar yang jadi judul video ("Tapi emang bener ...?").
- **Alur bertanya-jawab:** narator memecah topik jadi pertanyaan kecil yang dijawab satu per satu. Pola:
  pertanyaan → jawaban sederhana → contoh/perbandingan sehari-hari → "Nah, masalahnya ..." / "Tapi tunggu dulu ...".
  Penghubung lisan: "Jadi", "Nah", "Ternyata", "Bayangin aja", "Gampangnya gini", "Kenapa begitu?".
- **Angka & data:** satu angka per kalimat, langsung diterjemahkan ke hal yang kebayang ("itu kira-kira sama dengan
  ..."). Sebut sumbernya singkat dengan bahasa lisan ("menurut laporan PBB tahun ini ..."). Istilah sulit langsung
  dijelaskan ("PDB, gampangnya, total nilai barang dan jasa yang dibuat satu negara").
- **Humor ringan:** sesekali celetukan pendek atau perbandingan lucu yang nyambung dengan visual (1 tiap 20–40 detik),
  tidak mengejek kelompok mana pun dan tidak mengganggu fakta. Tora boleh bereaksi (kaget, bingung, keringetan).
- **Sudut pandang adil:** kalau topiknya pro-kontra, tampilkan dua sisi lalu simpulkan dengan jujur ("jawabannya:
  tergantung ...").
- **Tempo:** sekitar 2,2–2,6 kata per detik (santai dan mudah didengar). Jangan memadatkan naskah demi durasi.
- **Akhir:** kembali ke pertanyaan pembuka, jawab tuntas, satu kalimat refleksi yang dekat dengan penonton, lalu
  terima kasih + sampai jumpa (lihat Penutup). Tidak menutup dengan pertanyaan menggantung.
- **Ritme suara:** kalimat pendek-sedang, tanda tanya dan koma untuk jeda alami, tanda seru hanya untuk kaget atau
  lucu. Suara harus terdengar seperti orang ngobrol yang antusias, bukan membaca.
- Contoh nada (jangan disalin mentah, sesuaikan topik): "Kita mungkin sering denger orang bilang, hidup di luar
  negeri itu enak banget. Ya, kayak kata pepatah, rumput tetangga emang keliatan lebih hijau. Tapi emang bener
  begitu? Nah, buat jawabnya, kita perlu tahu dulu: 'enak' itu diukur pakai apa sih?"

## Gerak & ritme
- 24 fps; tokoh "on twos" (sudah di pustaka) dengan pose kunci jelas, kedip, napas. Kamera selalu bergerak pelan
  (`XD.kamera`: zoom 0,04–0,08 per adegan, geser kecil, paralaks antarlapisan).
- Satu kalimat narasi = satu perubahan visual; adegan 4–7 detik. Video panjang dibagi per bab
  (pembuka → konteks → masalah → penjelasan bertahap → dampak → penutup).
- Transisi: potong langsung (paling sering), `XD.gelembung` (pergantian topik), `XD.sapuan` (pindah tempat/waktu),
  zoom menembus objek.
- Subtitle: sans tebal putih dengan bayangan lembut; kata yang sedang diucapkan kuning.
- Format: paling cocok 16:9 (YouTube, bisa sampai 15 menit). Untuk 9:16, tokoh lebih besar di tengah, kartu di sepertiga atas.

## Penutup: cerita selesai, lalu terima kasih & sampai jumpa (WAJIB)

Video gaya ini **selalu selesai tuntas**. Penonton harus mendapat jawaban lengkap di video ini juga.
- **Jangan** menutup dengan teaser atau pertanyaan menggantung ("di video berikutnya...", "nantikan..."). Tidak ada cliffhanger.
- Urutan akhir: **payoff** (jawab hook pembuka sampai tuntas) → **satu kalimat kesimpulan** → **ucapan terima kasih +
  salam** yang hangat dan pendek. Ajakan follow/subscribe paling banyak satu frasa pendek, boleh juga tidak ada.
- **Visual:** 4–8 detik terakhir memakai `XD.penutup(ctx, t, { t0, ringkasan })`: Tora melambai, "Terima kasih sudah
  menonton!", "Sampai jumpa!", dan (opsional) `ringkasan`.
- **Dua suara:** A (Tora) menyimpulkan, B menanggapi singkat (mis. "Ternyata begitu, ya!"), lalu keduanya pamit.
- Tulis di `naskah.md` sebagai bagian **Penutup**; cek di persetujuan naskah bahwa ceritanya sudah selesai.

## Thumbnail + judul hook (WAJIB, setelah video disetujui)

Setiap video punya **foto thumbnail** dan **judul** yang membuat orang ingin mengklik, dan isinya dijawab video
(jujur, bukan menipu). Contoh: `samples/explainer-datar-thumbnail.html`.

1. **Judul:** tawarkan 5 pasangan **judul video + teks thumbnail** ke pengguna (rekomendasi di urutan pertama). Teknik:
   angka spesifik yang mengejutkan, kontras/ironi, "kenapa bisa begitu", rahasia yang dibongkar, akibat yang dekat dengan
   penonton. Judul video ≤ 60 karakter, kata kunci topik di depan. **Teks thumbnail ≠ judul**: 2–6 kata, maksimal 2
   baris, satu kata/angka disorot.
2. **Gambar** `<proyek>/thumbnail.html` (`HF.setup` 1280x720, durasi 1): latar adegan paling kuat (buram), **Tora**
   besar dengan ekspresi kuat di satu sisi, satu benda kunci, `XD.judulBesar` di sisi lain. Kontras tinggi, tanpa
   subtitle. Untuk 9:16 buat juga `cover.html` 1080x1920 (judul di sepertiga atas, Tora di tengah).
3. `node <skill>/tools/thumb.mjs <proyek>/thumbnail.html <proyek>/hasil/thumbnail.jpg` (YouTube ≤ 2 MB). Lihat
   `thumbnail_kecil.jpg`: judul dan wajah harus terbaca di ukuran 320 px.
4. Tulis `<proyek>/hasil/judul.txt`: judul YouTube terpilih, 4 cadangan, judul Shorts/TikTok, deskripsi 2–3 kalimat,
   5 hashtag. Tunjukkan thumbnail + judul ke pengguna.

## Checklist frame
- [ ] pembawa = Tora (`XD.tora`), tokoh lain dari `XD.chibi`; tanpa outline hitam; tepi cahaya krem ada
- [ ] subjek fokus tajam, latar belakang & latar depan buram; kamera bergerak pelan
- [ ] `XD.vinyet` + `XD.grade` di akhir frame (hangat, kontras rendah)
- [ ] satu kartu teks per adegan paling banyak; angka/label terbaca di layar HP
- [ ] cerita selesai tuntas; 4–8 detik terakhir kartu terima kasih & sampai jumpa (tanpa teaser)
- [ ] gaya terinspirasi referensi, tetapi tokoh, adegan, logo, dan teks buatan sendiri (jangan menyalin nama/logo kanal referensi)
