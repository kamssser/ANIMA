# Kamal Terang

Editorial bersih di atas kertas krem: judul hitam sangat tebal, satu baris kata kunci di kotak marun, kartu putih
bergaris tebal dengan bayangan keras, angka besar yang berhitung, diagram cabang. Jelas, cepat, meyakinkan.

## Angka
- 1080x1920 (9:16), 30 fps. Bagian 3-6 detik. Margin kiri/kanan 80 px.
- Zona: pil kanal y = 132 (kiri atas); judul y = 330 (2 baris); visual utama 560-1300; catatan + chip di bawah visual;
  1500 ke bawah kosong (area tombol aplikasi).

## Palet (`K.TERANG`)
- Kertas #f3f0ea, tinta #161616, bayangan judul (belum diucapkan) #cfcac1, teks kecil #5d5a55.
- Satu aksen: marun #8b1111 (kotak kata kunci, pil aktif, angka/kartu bermasalah). Hijau #18a957 hanya untuk ikon kecil.
- Kartu #fffdf8, garis 4,5 px, bayangan keras 7 px ke kanan-bawah, sudut 22 px.

## Teks
- Judul: Plus Jakarta Sans 800, 84 px (mengecil otomatis), rapat (-3,5%). Baris 1 hitam; baris 2 = kata kunci di kotak
  marun teks putih. Kata yang belum diucapkan tampil sebagai bayangan abu lalu menghitam kata demi kata.
- Angka kartu 150 px 800. Label kartu 32-34 px 700-800. Catatan 30 px 500 abu. Chip "Ilustrasi · data contoh" bila angka contoh.
- Pil kanal kiri atas: ikon huruf awal dalam bulatan marun + nama kanal pengguna (jangan meniru logo merek lain).

## Visual (satu per bagian)
- **Kartu angka** (2-3 kartu sejajar) dengan `K.count`; kartu bermasalah bergaris marun + angka marun.
- **Tumpukan** (`K.pile`) untuk "menumpuk/terlalu banyak".
- **Diagram cabang** (`K.tree`) dari satu pil sumber ke beberapa kartu; pil pilihan (`K.pill` putih) dengan pilihan aktif marun;
  pilihan yang ditinggalkan bergeser keluar dengan blur gerak.
- **Kartu tautan/ajakan** di penutup: kartu besar berkepala marun + teks ajakan + alamat/nama kanal.
- Elemen lama tetap di layar dan berubah (angka berhitung ulang, kartu turun memberi ruang), bukan diganti total.

## Gerak
- Muncul: `K.pop` (skala dengan pantulan), berurutan 0,12 dtk. Pindah posisi: `HF.ease.inOut` 0,5-0,7 dtk.
- Judul lama keluar (`out`) memudar naik, judul baru masuk sebagai bayangan lalu menghitam mengikuti narasi.
- Garis diagram tergambar progresif 0,6 dtk. Tidak ada kamera goyang; latar diam, isi yang bergerak.

## Suara (score.json)
- mood "ceria" atau "tenang", bpm 96-110, energi sedang; sfx `pop` saat kartu/pil muncul, `klik` angka berhitung,
  `swoosh-up` judul berganti, `ding` di hasil akhir.

## Checklist frame
- [ ] Satu aksen marun.  [ ] Judul <= 2 baris, tidak menyentuh margin kanan.  [ ] Satu visual utama per bagian.
- [ ] Kartu sejajar rapi (jarak 24 px).  [ ] Angka contoh diberi chip.  [ ] Area bawah 1500+ kosong.
