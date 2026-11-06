# Horor nyata (cerita dari sumber, kartun 3D)

Kisah seram yang **benar-benar beredar dan bisa ditelusuri sumbernya** (legenda tempat, kejadian yang diberitakan,
kesaksian yang dipublikasikan), diceritakan ulang dengan visual kartun 3D. Tampilan, pustaka `kit/horor-3d.js`, dan
aturan suara: **[horor-3d.md](horor-3d.md)** (wajib dibaca juga). Tambahan visual: `HR.overlay(..., { vhs: true })`
untuk adegan "arsip/rekaman", kartu tempat + tahun (`HR.kartu`) di awal setiap bagian.

## "Nyata" artinya apa
Yang nyata = **ceritanya benar-benar beredar** dan **fakta di sekitarnya benar** (tempat, tahun, sejarah). Kejadian
gaibnya sendiri **tidak bisa dibuktikan**, jadi naskah tidak boleh menyajikannya sebagai fakta.

## Riset (WAJIB, sebelum naskah)
1. Cari dengan web search: minimal **2 sumber yang bisa dicek** untuk ceritanya (media nasional/daerah, arsip koran,
   buku, jurnal folklor/budaya, situs resmi pengelola tempat, wawancara yang dipublikasikan). Blog/konten ulang tanpa
   sumber hanya boleh jadi petunjuk, bukan dasar.
2. Pisahkan di `naskah.md` dalam tiga kolom:
   - **Fakta tercatat** (tahun bangunan berdiri, fungsi di masa lalu, peristiwa sejarah yang diberitakan),
   - **Kisah yang beredar** (versi cerita, siapa yang menceritakan, sejak kapan, variasinya),
   - **Penjelasan lain** (sejarah, sains, psikologi: akustik bangunan tua, infrasound, sugesti) bila ada.
3. Catat versi yang saling bertentangan, jangan dipilih diam-diam. Tulis daftar sumber (judul + URL) di bawah naskah
   dan di `hasil/judul.txt` (deskripsi video).

Contoh hasil riset (untuk pola, cek ulang sebelum dipakai):
- **Lawang Sewu (Semarang):** dibangun 1907 sebagai kantor pusat perusahaan kereta api NIS; masa pendudukan Jepang
  dipakai militer, dan ruang bawah tanahnya disebut-sebut jadi tempat tahanan. Banyak sumber menyebut ruang bawah tanah
  itu awalnya sistem drainase. Detail seperti "penjara jongkok berisi sembilan orang" ditulis "konon". Namanya
  berarti "seribu pintu", tetapi jumlah pintunya tidak sampai seribu.
- **Si Manis Jembatan Ancol (Jakarta):** asal-usulnya banyak versi (gadis bernama Ariah/Mariam di abad ke-19, atau
  versi lain); ada sumber yang menyebut koran tahun 1950 memberitakannya. Sebut sebagai legenda dengan beberapa versi.
- **KKN di Desa Penari:** berasal dari thread Twitter akun SimpleMan (2019), diklaim kisah nyata dari kenalan; lokasi
  dan nama disamarkan; kebenarannya diperdebatkan. Cerita ini kini **buku dan film berhak cipta**: boleh dibahas
  sebagai fenomena (asal thread, kontroversi, dampaknya), **tidak boleh** diceritakan ulang adegan demi adegan.

## Aturan yang tidak boleh dilanggar
- **Bahasa jujur:** "menurut kisah yang beredar…", "warga setempat percaya…", "saksi mengaku…", "konon…". Jangan
  pernah "ini benar-benar terjadi" untuk kejadian gaib. Fakta sejarah boleh tegas.
- **Kartu pembuka** (2–3 dtk, `HR.kartu`): "Berdasarkan kisah yang beredar di <tempat>." + "Sebagian nama
  disamarkan. Visual adalah ilustrasi." bila ada tokoh nyata.
- **Privasi:** jangan menyebut nama lengkap orang biasa (saksi, korban, keluarga) atau alamat rumah pribadi; samarkan.
  Tempat umum/bersejarah boleh disebut. Jangan mengajak penonton masuk ke tempat tertutup/terlarang.
- **Tragedi nyata** (kecelakaan, bencana, pembunuhan, korban perang/penjajahan): ceritakan dengan **hormat**, sebut
  korban sebagai manusia, bukan bahan seram; jangan memparodikan, jangan menggambar kematian, jangan memakai tragedi
  yang baru terjadi (keluarga masih berduka). Bila ragu, pilih cerita lain dan beri tahu pengguna.
- **Hak cipta:** cerita dari buku/film/thread/podcast orang lain hanya **diringkas dengan kata sendiri** + sebut
  sumbernya. Jangan menyalin kalimat panjang atau seluruh alur karya berhak cipta.
- Tanpa gore (batas aman di horor-3d.md).

## Struktur cerita (60–300 dtk)
1. **Hook (0–3 dtk):** fakta nyata yang janggal ("Gedung ini disebut punya seribu pintu. Tapi yang membuat orang takut
   bukan pintunya.").
2. **Kartu pembuka** + konteks: tempat, tahun, sejarah singkat (fakta tercatat, terasa nyata).
3. **Kisah yang beredar:** dibawakan sebagai adegan kartun dari sudut saksi (nama disamarkan), dengan gelombang
   ketegangan + detak jantung + kejutan (horor-3d.md). Pakai `HR.bayangan` bila sosoknya tidak jelas dalam kesaksian.
4. **Versi lain / penjelasan lain:** jujur dan singkat, tanpa mengejek yang percaya.
5. **Penutup:** kembali ke tempat itu hari ini (sudah jadi museum, jalan ramai, dll.) + satu kalimat dingin
   ("Tapi sampai sekarang, sebagian penjaga masih enggan berjaga sendirian di lantai bawah.") → `HR.penutup` +
   terima kasih. Cerita selesai, tanpa teaser.

## Thumbnail & judul
Siluet tempat nyata (digambar ulang, bukan foto orang lain) + satu sosok/mata merah samar + teks 2–4 kata. Judul boleh
"kisah nyata" **hanya** dengan maksud "kisah yang benar-benar beredar"; lebih aman: "Legenda…", "Misteri…",
"Kisah yang beredar tentang…". Sumber dicantumkan di deskripsi.
