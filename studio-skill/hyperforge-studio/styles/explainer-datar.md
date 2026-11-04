# Explainer datar

| teknik | berat render | cocok untuk |
|---|---|---|
| 2D (canvas) + pustaka `kit/explainer-datar.js` | ringan | explainer edukasi & isu sosial/ekonomi, sejarah singkat, "kenapa bisa begitu", video YouTube 3–5 menit |

- **Rasa:** penjelasan yang ramah dan rapi: tokoh sederhana yang mudah disukai, dunia flat, informasi muncul sebagai
  label dan peta. Bukan garis tinta, bukan tekstur kertas: bentuk bersih dengan bayangan sabit lembut.

## Wajib: pakai pustaka gaya (supaya gambar tidak melenceng)

Muat `<script src="/kit/explainer-datar.js"></script>` setelah `studio-kit.js`. **Jangan menggambar tokoh dari nol**,
dan jangan membuat versi tokoh sendiri "yang mirip". Semua tokoh = `XD.tokoh(...)` dengan parameter; semua benda =
fungsi `XD.*` atau benda baru yang dibangun dari `XD.bentuk`. Contoh lengkap: `samples/explainer-datar.html`.

| fungsi | guna |
|---|---|
| `XD.tokoh(ctx, x, y, s, o)` | tokoh; (x, y) = titik kaki di tanah, s = 1 tinggi ±330 px. Mengembalikan posisi tangan `{kanan, kiri}` untuk menempel benda |
| `XD.emas` `koin` `uang` `kotak` `batu` (`bijih:true`) `permata` `rumah` `pohon` `gedung` `pin` `panah` `peta` | benda siap pakai `(ctx, x, y, s, o)`; `o.rim` = garis tepi terang |
| `XD.label(ctx, x, y, teks, {muncul})` | pil aksen dengan bibir bawah gelap (angka/fakta); `muncul` 0..1 dari `HF.spring` |
| `XD.chip(ctx, x, y, teks)` | chip kecil biru (simbol, istilah pendek) |
| `XD.langit` `XD.cahaya` `XD.kota` `XD.tanah` | latar: gradasi, cahaya lembut, siluet kota pudar, tanah |
| `XD.bentuk(ctx, path, warna, {sd})` + `XD.poly` `XD.squircle` `XD.ellipse` `XD.rect` | membangun benda baru dengan aturan bayangan yang sama |
| `XD.denganTepi(ctx, rim, off, gambar)` | memberi garis tepi terang pada benda buatan sendiri |
| `XD.rimUntuk(warnaLatar)` | warna garis tepi yang cocok untuk latar adegan |
| `XD.pembawa(ctx, x, y, s, o)` | **tokoh tetap Raka** (`XD.PEMBAWA`); hanya pose/ekspresi/gerak yang berubah |
| `XD.penutup(ctx, t, o)` | kartu penutup "Terima kasih sudah menonton! / Sampai jumpa!" (lihat Penutup) |
| `XD.judulBesar(ctx, x, y, baris, o)` | teks judul thumbnail tebal bergaris tepi, `*kata*` disorot (lihat Thumbnail) |

Opsi tokoh (`o`): `t`, `id` (angka unik per tokoh), `kulit`, `rambut`, `gayaRambut` (`pendek` `cepak` `keriting` `bob`
`kuncir` `panjang` `botak`), `topi` (`helm` `peci` `topi` `kerudung`), `warnaTopi`, `lampuNyala`, `baju`, `kerah`
(`v` `kemeja`), `dasi`, `overall`, `celana`, `kumis`, `ekspresi` (`netral` `senang` `senyum` `sedih` `kaget` `marah`
`ragu` `mantap`), `pose` (`diam` `tunjuk` `lambai` `pegang` `kepala` `garuk` `tanya` `hitung` `sedekap`), `bicara`
(mulut bergerak saat tokoh itu yang berbicara), `lihat` (-1..1), `hadap` (1 / -1), `rim`. Warna kulit/rambut/baju dari
`XD.palet`.

## Tokoh tetap: Raka (WAJIB, sama di semua video gaya ini)

Semua video explainer datar dibawakan tokoh yang **sama**: **Raka** = `XD.PEMBAWA` (kulit sawo matang, rambut pendek
hitam, **kacamata bulat**, kemeja biru muda berkerah, celana biru gelap). Panggil `XD.pembawa(ctx, x, y, s, { t, pose,
ekspresi, bicara, lihat, hadap, rim })`: hanya pose, ekspresi, arah, dan gerak yang boleh berubah. **Jangan** mengganti
warna, rambut, pakaian, atau kacamatanya, jangan membuat "versi lain" Raka, dan jangan menawarkan desain pembawa baru di
langkah karakter. Langkah 2 (karakter) untuk gaya ini cukup: tunjukkan lembar ekspresi/pose Raka + tokoh cerita.
- Raka muncul di pembuka, di momen penting, dan di penutup. Raka = suara A (1 suara: Raka sekaligus narator; 2 suara: Raka berbicara sebagai dirinya, narator = suara B).
- **Tokoh cerita** (penambang, pedagang, tokoh sejarah, suara B) boleh berbeda per video, dibuat sebagai preset
  `XD.tokoh` di `karakter/karakter.js` (`const PENAMBANG = { id: 2, ... }`), lalu dipanggil `{ ...PENAMBANG, t, pose,
  ekspresi }`. Tokoh cerita yang muncul lagi di video lain (seri) disimpan sekali dan dipakai ulang tanpa diubah.
- Kalau brief membawa karakter HyperForge (SVG), itu hanya untuk gaya lain: di gaya ini pembawanya tetap Raka.

## Aturan gambar (dipegang pustaka; ikuti juga untuk benda baru)

- **Proporsi tokoh:** kepala squircle lebar (±55% tinggi badan) menempel langsung ke badan tanpa leher; badan pendek
  trapesium dengan bahu membulat; lengan tabung; tangan bulat; kaki pendek. Wajah di bagian bawah kepala: **mata dua
  titik kecil**, alis garis pendek, mulut kecil atau tidak ada. Tanpa hidung, tanpa outline hitam.
- **Cahaya satu arah: dari kiri-atas.** Setiap bentuk = 1 warna dasar + **1 bayangan sabit di kanan-bawah** (warna sama
  ±14% lebih gelap, sedikit ke ungu-cokelat). **Garis tepi terang** = siluet bergeser ke kiri-atas (`o.rim`) untuk
  tokoh dan benda penting, supaya terpisah dari latar. Bayangan jatuh = elips samar di bawah.
- **Benda:** tampak depan, sedikit dari atas (permukaan atas terlihat tipis), 3–6 bentuk sederhana dengan sudut
  membulat, tanpa garis/tekstur. Ukuran benda sebanding tokoh (emas batangan ±setengah lebar kepala).
- **Benda baru:** tulis sebagai fungsi kecil di `<proyek>/benda.js` memakai `XD.bentuk` + `XD.poly/squircle/ellipse`
  dan `XD.denganTepi`, dengan aturan cahaya yang sama. Benda nyata (bangunan terkenal, alat, kendaraan, bentuk peta):
  cari foto/peta referensi dulu, ambil siluet dan 2–3 ciri yang paling dikenali, lalu sederhanakan. Peta wilayah nyata
  = 10–20 titik garis pantai dari peta referensi, `XD.peta(..., { daratan: titik })`.
- **Palet:** hangat dan agak redup (krem, oker, cokelat muda, abu-biru, hijau zaitun) dengan **satu aksen kuat** untuk
  informasi (merah koral `XD.palet.aksen` untuk label angka, kuning emas untuk benda berharga). Latar gelap untuk suasana
  muram (tambang, malam), pastel terang untuk suasana normal. Benda latar ±20% lebih pudar dari tokoh.
- **Latar:** gradasi dua warna + siluet bangunan/alat dengan detail minimum + satu sumber cahaya lembut (`XD.cahaya`).

## Lembar tokoh & benda (WAJIB sebelum storyboard)

Buat `<proyek>/benda.html`: semua tokoh proyek (ekspresi + pose yang akan dipakai) dan semua benda cerita di latar
proyek, lalu potret ke `benda.png` (`tools/snap.mjs`). Bandingkan dengan lembar referensi gaya (kalau ada) dan
`samples/explainer-datar.html`. Periksa sendiri sebelum ditunjukkan:
- [ ] tokoh hanya dari `XD.tokoh`; bentuk kepala/badan tidak diubah
- [ ] semua bayangan di kanan-bawah, semua garis tepi terang di kiri-atas (tidak ada yang terbalik)
- [ ] benda terbaca jelas walau kecil di layar HP; skala benda masuk akal terhadap tokoh
- [ ] tidak ada outline hitam, tekstur, atau gradasi di dalam bentuk (gradasi hanya untuk latar & cahaya)
- [ ] benda nyata cocok dengan foto/peta referensinya (siluet & ciri utama)
Tunjukkan `benda.png` bersama frame contoh saat persetujuan karakter. Benda yang ditambahkan nanti ikut lembar ini.

## Informasi di layar
- Label angka: `XD.label` (pil aksen, teks putih tebal), muncul dengan pegas. Maksimal dua tingkat teks (angka besar +
  label); subtitle tetap ada di bawah.
- Peta: `XD.peta` dengan wilayah aksen + label nama tempat. Daftar/unsur: `XD.chip` muncul satu per satu.

## Gerak & ritme
- 24 fps; tokoh "on twos" (sudah di pustaka) dengan pose kunci jelas, kedip, napas. Kamera halus tiap frame (zoom pelan
  1.00 → 1.06, geser kecil). Transisi: potong langsung, geser (slide/whip) ke "dunia" berikutnya, atau zoom ke peta/benda.
- Satu kalimat narasi = satu perubahan visual; adegan 3–6 detik. Video 3–5 menit dibagi per bab
  (pembuka → konteks → masalah → penjelasan bertahap → dampak → penutup), tiap bab punya warna latar sendiri.
- Subtitle: sans tebal putih dengan bayangan gelap; kata kunci diberi warna aksen.
- Format: paling cocok 16:9 (YouTube). Untuk 9:16, tokoh lebih besar di tengah dan label di sepertiga atas.

## Penutup: cerita selesai, lalu terima kasih & sampai jumpa (WAJIB)

Video gaya ini **selalu selesai tuntas**. Penonton harus mendapat jawaban lengkap di video ini juga.
- **Jangan** menutup dengan teaser atau pertanyaan menggantung ("di video berikutnya...", "nantikan...", "tapi
  ternyata ada yang lebih aneh..."). Tidak ada cliffhanger.
- Urutan akhir: **payoff** (jawab hook pembuka sampai tuntas) → **satu kalimat kesimpulan** (pesan/makna cerita) →
  **ucapan terima kasih + salam** yang hangat dan pendek. Contoh: "Jadi, di balik sebatang emas ada kerja keras yang
  jarang terlihat. Terima kasih sudah menonton, sampai jumpa!" Ajakan follow/subscribe paling banyak satu frasa
  pendek di kalimat yang sama, boleh juga tidak ada.
- **Visual:** 4–8 detik terakhir memakai `XD.penutup(ctx, t, { t0, ringkasan })`: Raka melambai, label "Terima kasih
  sudah menonton!", "Sampai jumpa!", dan (opsional) `ringkasan` = kalimat kesimpulan. Teks boleh diganti selama isinya
  tetap terima kasih + salam.
- **Dua suara:** A (Raka) menyimpulkan, B menanggapi singkat (mis. "Ternyata begitu, ya!"), lalu keduanya pamit.
- Tulis di `naskah.md` sebagai bagian **Penutup**; cek di persetujuan naskah bahwa ceritanya sudah selesai.

## Thumbnail + judul hook (WAJIB, setelah video disetujui)

Setiap video punya **foto thumbnail** dan **judul** yang membuat orang ingin mengklik, dan isinya dijawab video
(jujur, bukan menipu). Contoh: `samples/explainer-datar-thumbnail.html`.

1. **Judul:** tawarkan 5 pasangan **judul video + teks thumbnail** ke pengguna (pakai pilihan, rekomendasi di urutan
   pertama). Teknik: angka spesifik yang mengejutkan ("Rp32 ribu"), kontras/ironi ("Emas Rp1 juta, upahnya Rp32
   ribu?"), "kenapa/kok bisa", rahasia yang dibongkar, akibat yang dekat dengan penonton. Judul video ≤ 60 karakter,
   kata kunci topik di depan, tanpa huruf kapital semua. **Teks thumbnail ≠ judul**: 2–6 kata yang melengkapi judul,
   maksimal 2 baris, satu kata/angka disorot.
2. **Gambar** `<proyek>/thumbnail.html` (`HF.setup` 1280x720, durasi 1): latar adegan paling kuat, **Raka** besar
   dengan ekspresi kuat (kaget/senang/sedih) di satu sisi, satu benda kunci, `XD.judulBesar` di sisi lain, boleh satu
   `XD.label` kecil. Kontras tinggi, tanpa subtitle, tanpa teks kecil. Untuk 9:16 buat juga `cover.html` 1080x1920
   (judul di sepertiga atas, Raka di tengah).
3. `node <skill>/tools/thumb.mjs <proyek>/thumbnail.html <proyek>/hasil/thumbnail.jpg` (YouTube ≤ 2 MB). Lihat
   `thumbnail_kecil.jpg`: judul dan wajah harus terbaca di ukuran 320 px. Perbaiki dulu kalau tidak.
4. Tulis `<proyek>/hasil/judul.txt`: judul YouTube terpilih, 4 cadangan, judul Shorts/TikTok, deskripsi 2–3 kalimat,
   5 hashtag. Tunjukkan thumbnail + judul ke pengguna.

## Checklist frame
- [ ] pembawa = Raka (`XD.pembawa`), tokoh cerita dari `XD.tokoh`; tanpa outline hitam
- [ ] bayangan sabit di kanan-bawah, garis tepi terang di kiri-atas, latar lebih pudar dari tokoh
- [ ] satu warna aksen dipakai untuk informasi penting saja
- [ ] angka/label terbaca di layar HP, maksimal dua tingkat teks
- [ ] cerita selesai tuntas; 4–8 detik terakhir kartu terima kasih & sampai jumpa (tanpa teaser)
- [ ] gaya terinspirasi referensi, tetapi tokoh, adegan, logo, dan teks buatan sendiri
