# Dongeng horor (cerita karangan, kartun 3D)

Cerita hantu Indonesia **karangan sendiri** yang dibawakan seperti dongeng seram di pos ronda. Tampilan, pustaka
`kit/horor-3d.js`, dan aturan suara: **[horor-3d.md](horor-3d.md)** (wajib dibaca juga).

## Bahan: makhluk & kepercayaan rakyat (milik bersama, boleh dipakai)
Ciri di bawah adalah versi yang **paling umum** diceritakan; asal-usulnya berbeda-beda antardaerah. Di dalam cerita
karangan boleh dipakai bebas, tetapi jangan menyebut satu versi asal-usul sebagai "fakta".

| makhluk | ciri yang dikenal penonton | cara memunculkan rasa takut |
|---|---|---|
| Kuntilanak | perempuan bergaun putih, rambut panjang menutupi wajah, tawa melengking, wangi bunga lalu bau busuk; konon di pohon besar | tawa jauh → dekat, wangi melati, gaun putih di sela pohon |
| Pocong | terbungkus kain kafan terikat, melompat; konon tali kafan yang lupa dilepas | bayangan putih berdiri diam di ujung jalan, bunyi "tuk" lompatan |
| Genderuwo | sosok besar, berbulu hitam, mata merah, di pohon besar/batu/bangunan tua; konon bisa menyerupai orang dekat | dua titik merah di gelap, suara berat, "orang yang kita kenal" bersikap aneh |
| Wewe gombel | perempuan tua yang menyembunyikan anak yang keluar saat maghrib | anak hilang saat azan maghrib, panggilan yang tidak dijawab |
| Tuyul | anak kecil botak yang mencuri uang | uang di dompet berkurang sedikit demi sedikit, jejak kaki kecil |
| Sundel bolong | perempuan bergaun putih dengan punggung berlubang (jangan digambar; cukup disebut/siluet) | dari depan cantik, saat berbalik… potong ke hitam |
| Banaspati | bola api terbang | cahaya oranye melayang di sawah malam hari |
| Leak (Bali), palasik (Minang), kolong wewe, babi ngepet | hantu/ilmu hitam daerah | gunakan dengan hormat pada budaya asalnya |

**Pantangan & tanda yang dikenal penonton Indonesia** (bagus untuk hook dan "aturan yang dilanggar"): jangan bersiul
malam hari, jangan menyahut panggilan yang tidak kelihatan orangnya, anak masuk rumah saat maghrib, jangan menunjuk
kuburan, malam Jumat Kliwon, suara tokek tengah malam, anjing melolong, wangi melati tanpa bunga, kentongan ronda yang
tiba-tiba berhenti, kursi goyang bergerak sendiri, panggilan nama dari luar jendela.

**Latar khas:** kampung dengan pohon beringin, kuburan desa, sumur tua, rumah kosong, kos-kosan, pos ronda, jalan
sawah tanpa lampu, sekolah malam hari, rumah nenek di desa, lokasi KKN, rumah sakit tua, pasar malam yang sudah tutup.

## Struktur cerita (60–180 dtk)
1. **Hook (0–3 dtk):** pantangan atau kalimat yang membuat merinding, langsung di tengah suasana.
   ("Kata nenek, kalau ada yang memanggil namamu tengah malam… jangan menjawab.")
2. **Normal yang hangat:** tokoh biasa dengan alasan masuk akal untuk ada di tempat itu (pulang les, ronda, KKN, jaga warung).
3. **Pelanggaran:** tokoh melanggar pantangan, sengaja atau tidak (penonton tahu, tokoh tidak).
4. **Tanda bertingkat (aturan tiga):** tanda 1 kecil dan bisa dijelaskan → tanda 2 lebih dekat → tanda 3 tidak bisa
   dijelaskan. Di antaranya **lega palsu** (ternyata cuma kucing / teman).
5. **Puncak:** detak jantung naik → hening → kejutan (lihat pola suara di horor-3d.md).
6. **Resolusi:** tokoh selamat lewat cara yang masuk akal dalam cerita (lari ke pos ronda, ditolong warga, berdoa
   dengan khusyuk, mematuhi pantangan). Cerita **selesai**.
7. **Sentuhan akhir dingin** (satu kalimat/gambar): detail kecil yang membuat merinding lagi (wangi melati di kamar,
   jejak kaki kecil di lantai). Lalu kartu `HR.penutup` + terima kasih. **Bukan** teaser "bersambung".

Boleh menyisipkan **pesan** ringan di akhir (hormati pantangan orang tua, jangan sembarangan di tempat asing), tanpa
menggurui.

## Aturan menulis
- **Tunjukkan lewat indra:** bunyi, bau, dingin, cahaya; jangan langsung menyebut "hantu" di awal.
- Kalimat pendek saat tegang; detail konkret (jam dinding 00.13, sandal jepit di depan pintu, lampu bohlam kuning).
- Tokoh punya nama Indonesia biasa dan tujuan sederhana, supaya penonton peduli sebelum takut.
- **Orisinal:** jangan menyalin alur/tokoh/judul dari film, novel, atau thread horor terkenal (KKN di Desa Penari,
  Sewu Dino, Pengabdi Setan, dll.). Makhluk folklor boleh, cerita harus buatanmu.
- **Hormat:** jangan mengejek agama, suku, profesi (ustaz, dukun, perawat), atau penyandang disabilitas. Doa/ibadah
  boleh jadi penyelamat, ditampilkan dengan hormat (tanpa ayat tertulis di layar).
- Tanpa gore, bunuh diri, atau kekerasan yang digambarkan (lihat batas aman di horor-3d.md).
- Tulis di `naskah.md`: logline 1 kalimat, pantangan yang dilanggar, 3 tanda, momen kejutan (detik), akhir dingin.

## Storyboard
Tandai di `storyboard.json` tiap shot dengan `"tegang": 0..1` dan shot kejutan dengan `"kejutan": true`. Dari situ
buat `audio/score.json` (bagian energi, `jantung`, `hening`, `stinger`) dan `HR.ketukanJantung` dari array `jantung`
yang sama. Tunjukkan lembar storyboard + rencana suara (tabel waktu: tanda/detak/hening/kejutan) sebelum render.

## Thumbnail & judul
Wajah tokoh ketakutan (mata besar, pupil kecil) di satu sisi, siluet hantu samar/mata merah di gelap sisi lain, teks
2–4 kata ("JANGAN MENJAWAB", "SIAPA YANG MENGETUK?"). Judul jujur: cerita fiksi boleh diberi label "cerita horor" /
"dongeng seram", **jangan** ditulis "kisah nyata".
