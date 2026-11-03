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
| `XD.penutup(ctx, t, o)` | kartu penutup "Video berikutnya" (lihat Penutup) |

Opsi tokoh (`o`): `t`, `id` (angka unik per tokoh), `kulit`, `rambut`, `gayaRambut` (`pendek` `cepak` `keriting` `bob`
`kuncir` `panjang` `botak`), `topi` (`helm` `peci` `topi` `kerudung`), `warnaTopi`, `lampuNyala`, `baju`, `kerah`
(`v` `kemeja`), `dasi`, `overall`, `celana`, `kumis`, `ekspresi` (`netral` `senang` `senyum` `sedih` `kaget` `marah`
`ragu` `mantap`), `pose` (`diam` `tunjuk` `lambai` `pegang` `kepala` `garuk` `tanya` `hitung` `sedekap`), `bicara`
(mulut bergerak saat tokoh itu yang berbicara), `lihat` (-1..1), `hadap` (1 / -1), `rim`. Warna kulit/rambut/baju dari
`XD.palet`.

Karakter proyek ditulis sekali di `karakter/karakter.js` sebagai **preset opsi** `XD.tokoh` (mis.
`const RAKA = { id: 1, kulit: ..., gayaRambut: 'keriting', topi: 'helm', baju: ..., overall: ... }`), lalu setiap
adegan memanggil `XD.tokoh(ctx, x, y, s, { ...RAKA, t, pose, ekspresi })`. Ciri khas tokoh dibedakan lewat rambut/topi,
warna baju, dan aksesori, bukan dengan mengubah bentuk kepala/badan.

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

## Penutup: pamit + hook ke video berikutnya (WAJIB)

Video gaya ini **selalu** ditutup dengan salam pamit yang memancing penonton menonton video lain. Ini menggantikan
"ajakan follow" biasa di langkah naskah.

1. **Payoff dulu:** jawab hook pembuka dengan tuntas (penonton harus puas dengan video ini).
2. **Jembatan + teaser (1–2 kalimat):** buka rasa penasaran baru yang **masih nyambung** dengan topik, berupa pertanyaan
   atau fakta setengah yang jawabannya ada di video berikutnya. Spesifik, bukan "nantikan video selanjutnya".
3. **Pamit hangat (1 kalimat pendek)** lalu ajakan menonton: "...kita bongkar di video berikutnya. Sampai jumpa!"
4. **Visual:** 6–10 detik terakhir memakai `XD.penutup` (tokoh pembawa melambai + kotak cuplikan + teaser di layar).
   Isi kotak cuplikan dengan adegan kecil dari topik berikutnya (pustaka yang sama), bukan teks saja. Pada 16:9 kotak
   ini sekaligus tempat elemen layar akhir YouTube (layar akhir butuh 5–20 detik di ujung video).

Pola kalimat (buat versi sendiri sesuai topik, jangan dipakai mentah):
- *Pertanyaan lanjutan:* "Emasnya sudah keluar dari tambang. Tapi kenapa harganya bisa naik sepuluh kali lipat begitu
  sampai di toko? Itu cerita di video berikutnya. Sampai jumpa!"
- *Fakta setengah:* "Ternyata ada satu kota yang hampir seluruh warganya hidup dari sampah elektronik. Kota apa, dan
  bagaimana bisa begitu? Tonton video berikutnya, ya. Dadah!"
- *Balik sudut pandang:* "Kita sudah lihat dari sisi pekerja. Bagaimana kalau dari sisi pembeli? Jawabannya bikin
  kaget. Sampai ketemu di video berikutnya!"

Aturan:
- Topik video berikutnya **ditanyakan ke pengguna saat persetujuan naskah** (tawarkan 3 usulan yang nyambung). Jangan
  menjanjikan judul yang tidak akan dibuat; kalau pengguna belum tahu, pakai teaser yang mengarah ke "video lain di
  kanal ini" dengan pertanyaan yang tetap spesifik.
- Teaser tidak boleh membocorkan jawabannya dan tidak boleh memakai klaim yang belum dicek.
- **Dua suara:** B (tokoh kedua) melontarkan pertanyaan lanjutan dengan penasaran, A menjawab "itu kita bahas di video
  berikutnya" lalu keduanya pamit. Satu suara: narator melakukan semuanya.
- Panjang penutup ±8–12 detik dari durasi total; tulis di `naskah.md` sebagai bagian **Penutup** tersendiri.

## Checklist frame
- [ ] tokoh dari `XD.tokoh` (kepala squircle besar, mata titik, tanpa outline hitam)
- [ ] bayangan sabit di kanan-bawah, garis tepi terang di kiri-atas, latar lebih pudar dari tokoh
- [ ] satu warna aksen dipakai untuk informasi penting saja
- [ ] angka/label terbaca di layar HP, maksimal dua tingkat teks
- [ ] 6–10 detik terakhir: kartu penutup dengan teaser video berikutnya
- [ ] gaya terinspirasi referensi, tetapi tokoh, adegan, logo, dan teks buatan sendiri
