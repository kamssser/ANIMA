# Catatan update HyperForge

Setiap versi yang dirilis WAJIB punya bagian di sini. Isinya dipakai sebagai catatan rilis di
GitHub Releases dan ditampilkan di dialog update aplikasi. Tulis untuk pengguna (bahasa sederhana),
bukan untuk programmer.

Format: `## <versi> - <tanggal YYYY-MM-DD>`, lalu poin-poin di bawah judul **Baru**, **Perbaikan**, atau **Perubahan**.

## 0.6.0 - 2026-11-03

**Baru**
- **3 style baru** menggantikan Drama Indonesia, Komedi, dan Indie animasi:
  - **Indie sinematik**: garis tipis rapi, warna hangat, cahaya dramatis seperti film pendek animasi.
  - **Sketsa muram**: garis sketsa yang sedikit bergetar, warna kusam kehijauan dengan satu aksen merah.
  - **Pastel lembut**: hampir tanpa garis, warna pastel seperti cat air, suasana tenang dan imut.
- Setiap style 2D sekarang memakai **potongan frame dari video referensi**. Claude melihat potongan itu sebelum menggambar karakter dan latar. Setelah gambar karakter jadi, Claude **memeriksa hasilnya terhadap referensi** dan memperbaikinya sendiri. Potongan referensi diunduh ke laptop saat pertama dipakai.

**Perubahan**
- Project dan karakter yang memakai style lama otomatis pindah ke style pengganti: Drama dan Indie menjadi Indie sinematik, Komedi menjadi Pastel lembut.
- Membuat karakter sekarang sedikit lebih lama (sekitar 2 sampai 3 menit) karena ada pemeriksaan terhadap referensi.

## 0.5.1 - 2026-11-03

**Perbaikan**
- Generate style 2D sekarang langsung memberi tahu kalau belum ada **karakter utama yang tersimpan**, tidak lagi menunggu lama lalu gagal tanpa mengisi hook, script, dan shot.
- Di Pengaturan > Karakter muncul tanda **"Belum disimpan"** setelah gambar jadi, dan menutup editor meminta konfirmasi kalau karakter belum disimpan.

## 0.5.0 - 2026-11-03

**Baru**
- **4 style video 2D baru**: Motion comic (manhwa), Drama Indonesia, Komedi garis tebal, dan Indie animasi. Render jauh lebih cepat dari Kartun 3D (1 video sekitar 3 sampai 5 menit).
- **Format video per project**: tegak 9:16 (Shorts/TikTok/Reels) atau landscape 16:9 (YouTube) untuk style 2D.
- Menu **Pengaturan > Karakter**: wajib 1 karakter utama, bisa sampai 10 karakter dengan nama panggilan dan sifat sendiri. Karakter digambar Claude (tanpa biaya gambar), bisa direvisi sampai cocok lalu disimpan. Mengubah karakter yang sudah disimpan meminta konfirmasi "Yakin / Tidak yakin".
- Karakter 2D bisa berkedip, bicara mengikuti suara, dan tampil seluruh badan, setengah badan, atau close-up.
- **Teks di layar wajib di semua style**, termasuk Kartun 3D: muncul per kata mengikuti suara dan menyorot kata yang sedang diucapkan.
- Sejarah & Fakta (style 2D): Claude mencari **foto referensi** bebas pakai dari Wikimedia, lalu menggambar tempat atau bangunan yang bentuk dan posisinya mirip foto itu. Foto yang dipakai tercatat di project.
- Pilihan **Kartu grafis: GPU / CPU** di Pengaturan > Render.

**Perbaikan**
- Render Kartun 3D sekitar **6 kali lebih cepat**: sekarang memakai kartu grafis, sebelumnya selalu memakai CPU. Hasil gambarnya sama.
- **Suara bahasa Indonesia asli**: pencarian suara sekarang menampilkan penutur asli bahasa Indonesia dari ElevenLabs, MiniMax, dan CapCut (centang "Hanya suara asli bahasa Indonesia"), tidak lagi suara penutur asing yang berlogat bule.
- Timing per kata tetap jalan saat suara A memakai MiniMax.

**Perubahan**
- Pemilik Supabase perlu menjalankan pembaruan database sekali (`supabase/migrations/003_styles_characters.sql`).

## 0.4.0 - 2026-11-02

**Baru**
- Tombol **Generate dengan Claude** langsung di aplikasi: Claude menulis hook, script, dan shot sendiri (memakai langganan Claude kamu, tanpa API key).
- **7 jenis konten**: Sejarah, Fakta, Dongeng, Cerita karangan, Tutorial, Dialog, dan Film.
- Sejarah & Fakta **wajib riset dan mencantumkan minimal 2 sumber**; daftar sumber tampil di project.
- Semua jenis konten otomatis dibuatkan **hook di 3 detik pertama** dan alur yang membuat penonton bertahan sampai habis.
- Dialog & Film memakai **2 suara dengan model berbeda** (Suara A dan Suara B); tiap shot punya pembicara A/B.
- Pengaturan suara sekarang punya slot Suara A dan Suara B.

**Perbaikan**
- Tombol **Keluar** tidak lagi memutus sambungan Claude.
- Generate dari aplikasi tidak perlu "Sambungkan Claude" lebih dulu; cukup login dan punya Claude Code.

**Perubahan**
- Pemilik Supabase perlu menjalankan pembaruan database sekali (`supabase/migrations/002_content_types.sql`).

## 0.3.1 - 2026-11-02

**Baru**
- Tombol **Cek update** dan nomor versi selalu terlihat di sidebar kiri bawah.
- Saat ada versi baru, update diunduh di dalam aplikasi lalu muncul pertanyaan **"Restart sekarang?"** (Ya / Nanti).
- Notifikasi "Sudah versi terbaru" saat cek update manual.

**Perbaikan**
- Proses rilis update lebih andal (tidak lagi gagal di tengah unggah).

## 0.3.0 - 2026-11-02

**Baru**
- Nama dan logo baru: **HyperForge**, dengan tema hitam-biru dan tata letak baru.
- Tampilan menyesuaikan ukuran jendela secara otomatis (diperkecil/diperbesar).
- Banner Overview baru dan Project tampil sebagai kartu.
- Pengaturan dibagi per bagian: Claude & akun, Proyek Remotion, Suara & audio, Render, Tampilan & update.
- Suara narasi lewat **vibi.pro** (pilih suara, dengar contoh, timing per kata).
- SFX dan musik otomatis lewat Python setelah render, lalu digabung ke MP4.
- **Siapkan otomatis** proyek Remotion (tanpa setting manual).
- **Uji render**: 1 frame, uji kecepatan, dan uji otomatis untuk memilih jumlah proses paralel terbaik.
- Mode **Draft** (sekitar 2x lebih cepat) untuk cek timing.
- Sambungkan Claude Code / Claude Desktop otomatis (password tidak disimpan).
- **Update otomatis**: aplikasi mengecek dan memasang versi baru sendiri.

## 0.1.0 - 2026-11-02

**Baru**
- Versi pertama: project, script, shot, antrean render lokal, dan login Supabase.
