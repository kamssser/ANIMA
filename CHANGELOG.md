# Catatan update HyperForge

Setiap versi yang dirilis WAJIB punya bagian di sini. Isinya dipakai sebagai catatan rilis di
GitHub Releases dan ditampilkan di dialog update aplikasi. Tulis untuk pengguna (bahasa sederhana),
bukan untuk programmer.

Format: `## <versi> - <tanggal YYYY-MM-DD>`, lalu poin-poin di bawah judul **Baru**, **Perbaikan**, atau **Perubahan**.

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
