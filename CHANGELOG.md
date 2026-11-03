# Catatan update HyperForge

Setiap versi yang dirilis WAJIB punya bagian di sini. Isinya dipakai sebagai catatan rilis di
GitHub Releases dan ditampilkan di dialog update aplikasi. Tulis untuk pengguna (bahasa sederhana),
bukan untuk programmer.

Format: `## <versi> - <tanggal YYYY-MM-DD>`, lalu poin-poin di bawah judul **Baru**, **Perbaikan**, atau **Perubahan**.

## 0.15.0 - 2026-11-03

**Baru**
- **Pustaka Video** di menu samping: semua video yang sudah jadi dalam satu halaman, dari render HyperForge dan dari skill (Studio, Animate, Bang Motion, Animantra). Tiap video tampil dengan gambar mini, judul project, ukuran, tanggal, dan **lokasi foldernya**. Klik foldernya (atau tombol **Buka folder**) untuk langsung membuka Explorer dengan video itu terpilih. Klik gambar untuk memutar. Ada pencarian, filter per sumber, dan tombol salin lokasi file.
- **Style Animantra (12 pilihan)** untuk pemilik paket **Animantra: Vector**: Kita Bongkar (3D dan 2.5D), Tur Lingkungan, Story, POV "Jadi Si...", Tutorial, Mitos vs Fakta, A vs B, Top List, Apa Jadinya Kalau, Evolusi, dan Kuis. Video 9:16 bergaya bedah 3D flat-toon dikerjakan Claude di tab Claude persis seperti skillnya (riset, naskah, suara, model 3D, cek mutu, render, cover, versi kecil, caption). Siapkan di **Pengaturan > Skill video > Animantra: Vector**.
  - Skill ini **tidak disertakan** di HyperForge karena lisensinya melarang dibagikan ulang. HyperForge memakai paket yang sudah kamu miliki: ekstrak `animantra-vector.zip` ke folder Downloads, lalu klik **Siapkan otomatis**.

## 0.14.0 - 2026-11-03

**Baru**
- **Semua jenis konten bisa memakai 2 suara** (A & B bergantian), tidak hanya Dialog dan Film. Pilih **1 suara** atau **2 suara** saat membuat project baru, atau ubah nanti di tab Brief. Untuk sejarah, fakta, tutorial, dan lainnya, suara A menjadi narator dan suara B menjadi tokoh kedua yang bertanya, menyanggah, atau bereaksi.
- Gaya **Studio: explainer datar** sekarang **ditutup dengan salam pamit dan hook ke video berikutnya**: pertanyaan atau fakta setengah yang membuat penonton penasaran, plus kartu penutup "Video berikutnya" (tokoh melambai dan cuplikan video selanjutnya). Claude menanyakan topik video berikutnya saat kamu menyetujui naskah.

**Perbaikan**
- Gambar tokoh dan benda di gaya **Studio: explainer datar** dipoles supaya tidak melenceng dari gayanya: kepala besar dengan mata titik, bayangan dan garis tepi terang yang selalu searah, serta pose, rambut, topi/helm/peci/kerudung, dan benda (emas, uang, kotak, batu, peta, rumah, dan lainnya) yang bentuknya sama di setiap video. Claude juga wajib menunjukkan lembar tokoh & benda sebelum storyboard. Gambar contoh gayanya ikut diperbarui.

**Perubahan**
- **Pengaturan > Suara**: suara A dan B sekarang memakai **satu provider** yang sama, dengan model dan suara masing-masing (bawaan ElevenLabs: A eleven_multilingual_v2, B eleven_v3). Kalau sebelumnya suara B memakai provider lain, pilih ulang suara B.

## 0.13.1 - 2026-11-03

**Baru**
- **Pengaturan > Log**: catatan lengkap setiap sesi Claude per project (perintah yang dijalankan, hasilnya, dan error), diperbarui otomatis, bisa disalin. Berguna saat Claude terasa lama atau macet.
- Tombol **Lihat log** di tab Claude untuk melihat log sesi project itu langsung.

**Perbaikan**
- Tab Claude tidak lagi hanya menulis "Claude sedang berpikir..." saat Claude menjalankan pekerjaan panjang (mis. render frame demi frame). Sekarang tampil langkah yang sedang berjalan dan sudah berapa lama, plus penjelasan kalau langkahnya memang lama.

## 0.13.0 - 2026-11-03

**Baru**
- Gaya **Studio: explainer datar**: 2D datar ala video explainer edukasi (tokoh berkepala bulat dengan mata titik, bayangan lembut, garis tepi terang tipis, palet hangat, label pil dan peta infografis). Cocok untuk video YouTube 3 sampai 5 menit.
- **Frame referensi gaya** di tab Claude: sebelum klik Mulai, pilih folder berisi frame/screenshot video yang gayanya mau ditiru. HyperForge mengambil 24 frame yang tersebar merata, membuat lembar kontak, dan Claude memakainya sebagai acuan (sekitar 90% mirip) dengan tokoh dan adegan tetap orisinal. Frame hanya disimpan di laptopmu; folder terakhir diingat per style.
- **Durasi video sampai 5 menit** untuk semua style (sebelumnya maks 3 menit untuk 2D dan 1,5 menit untuk 3D). Batas jumlah shot, waktu Generate, tunggu suara, dan panjang naskah suara ikut dinaikkan. Untuk Kartun 3D, form menampilkan perkiraan lama render.
- HyperForge Studio membagi video panjang per bab (storyboard dan render uji per bab).

## 0.12.0 - 2026-11-03

**Baru**
- **Animate, Bang Motion, dan HyperForge Studio sekarang dikerjakan di dalam aplikasi**, tanpa jendela terminal. Project bergaya skill punya tab **Claude**: klik Mulai, lalu pertanyaan dan persetujuan skill muncul sebagai **tombol pilihan**, gambar contoh (frame gaya, storyboard, lembar karakter) tampil langsung, dan revisi cukup diketik. Langkah kerja Claude terlihat ringkas dan bisa dibuka. Prosesnya tetap jalan walau kamu pindah halaman, riwayat obrolan tersimpan per project, dan ada tombol Hentikan serta Percakapan baru.
- **Semua style punya gambar contoh** (30 style), jadi kamu bisa melihat tampilannya sebelum memilih. Gaya HyperForge Studio digambar ulang dengan maskot yang sama supaya perbedaan gayanya jelas.
- Kartu project di daftar Project menampilkan gambar style-nya.

**Perubahan**
- **Project baru dibuat dalam 3 langkah** (jenis konten, style video, detail) dengan tombol Kembali / Lanjut, tidak lagi semua isian di satu popup.
- Pemilih style memakai kartu bergambar yang dikelompokkan (2D cepat, HyperForge Studio, Animate, Bang Motion, Kartun 3D). Di halaman project, style diganti lewat tombol **Ganti style** yang membuka pemilihnya sendiri.
- Jendela terminal Claude Code tetap tersedia sebagai pilihan cadangan di kartu style pada tab Brief.

## 0.11.0 - 2026-11-03

**Baru**
- **HyperForge Studio**: skill animasi buatan HyperForge sendiri untuk Claude Code, dengan **10 gaya**: low-poly cerah, kartun 3D lembut, anime cel, clay stop motion, kertas guntingan, wayang bayangan, pixel retro, papan tulis kapur, cat air lembut, dan kartun karet retro.
- Alurnya 7 tahap dengan persetujuanmu di setiap tahap: **gaya** (bisa membongkar video referensi: durasi, jumlah shot, detik per shot, kecepatan narasi), **karakter** (dibangun di kode dari karakter HyperForge, gambar, atau deskripsi, lengkap dengan ekspresi dan pose), **naskah** (hook + cek fakta), **suara**, **storyboard** satu frame per shot, **render**, dan revisi.
- Video jadi dengan **subtitle per kata** mengikuti suara, **musik dan efek suara dari kode** (aman lisensi, musik mengecil otomatis saat narasi), versi **dengan dan tanpa musik**, dan pemeriksaan akhir (frame + kerasnya suara).
- Karakter dari Pengaturan > Karakter ikut dikirim ke Claude sebagai desain sumber.
- Timing per kata Bahasa Indonesia lewat vibi.pro (juga dipakai untuk menghitung kecepatan narasi video referensi).
- Render memakai kartu grafis secara otomatis: sekitar 0,06 detik per frame di 1080x1920 (video 40 detik sekitar 1,5 menit), otomatis pindah ke CPU kalau kartu grafis tidak mendukung.
- Kartu **HyperForge Studio** di Pengaturan > Skill video dengan tombol Siapkan otomatis.

## 0.10.0 - 2026-11-03

**Baru**
- **7 style "Bang Motion"** dari skill bang-motion karya Bang Tutorial (github.com/bangtutorial/bang-motion, dipakai utuh tanpa diubah): kartun kolase, jurnalisme visual, katalog putih, sketsa vintage, aksi kontinu, kartun panggung, dan opener/promo (opener, bumper, intro kanal, kinetic typography). Motion graphic yang bergerak seperti video, bukan slide.
- Sama seperti Animate: tombol **Buka di Claude Code** di project, lalu kamu menyetujui **style brief dan rundown** di jendela Claude sebelum dibangun. Claude memeriksa frame dan mengekspor MP4; video yang jadi tinggal dimasukkan ke daftar render dari tab Render.
- Suara VO Bang Motion memakai **Suara A/B dari Pengaturan (vibi.pro)**; Claude menyebutkan jumlah karakter (kredit) dulu sebelum membuatnya.

**Perubahan**
- Menu Pengaturan **Animate** menjadi **Skill video**, berisi Animate dan Bang Motion dengan tombol **Siapkan otomatis** masing-masing (Bang Motion memasang Puppeteer + Chrome sekitar 170 MB).
- Gambar contoh style di form project baru dibuat lebih kecil supaya daftar style tidak terlalu panjang.

## 0.9.0 - 2026-11-03

**Baru**
- **8 style "Animate"** dari skill animate (github.com/cth9191/animate, dipakai utuh tanpa diubah): kertas sobek, tinta arsir, cetak riso, buku sketsa, matematika, piksel, isometrik, dan **dari referensi saya** (skill membuat style baru dari video/gambar yang kamu berikan). Gambar contoh tiap style tampil saat membuat project.
- Project dengan style Animate punya tombol **Buka di Claude Code**: brief project (topik, jenis konten, durasi, format, style, suara) dikirim otomatis, lalu kamu menjawab check-in **story**, **look**, dan **storyboard** di jendela Claude persis seperti skill aslinya sebelum video dianimasikan dan dirender.
- Suara narasi Animate memakai **Suara A/B dari Pengaturan (vibi.pro)**, satu file per kalimat. Claude menyebutkan jumlah karakter (kredit) dulu sebelum membuat suara.
- Tab Render project Animate menampilkan video yang sudah jadi; klik **Masukkan ke daftar render** supaya masuk ke tabel render dan ikut diperiksa otomatis.
- Menu **Pengaturan > Animate**: cek dan **Siapkan otomatis** semua kebutuhan (skill, Playwright + Chromium, ffmpeg lengkap, faster-whisper opsional).

**Catatan**
- Timing per kata di dalam kalimat untuk narasi Bahasa Indonesia sebagian diperkirakan (alat timing skill memakai pengenal suara bahasa Inggris); awal dan akhir setiap kalimat tetap tepat.
- Pertama kali memakai Animate di laptop baru butuh internet untuk mengunduh Chromium dan ffmpeg (sekitar 250 MB).

## 0.8.0 - 2026-11-03

**Baru**
- **Benda cerita di video 2D.** Claude sekarang menggambar benda, kendaraan, hewan, dokumen, dan angka tahun yang disebut narasi (mis. kereta uap, peta 1901, ayam), lalu menaruhnya di shot yang menyebutnya. Benda bisa melintas, muncul, jatuh, atau melayang. Benda yang digambar tampil di kartu Latar pada halaman project.
- **Shot sisipan**: close-up peta, dokumen, atau benda tanpa karakter, supaya video tidak hanya karakter berdiri di depan latar.
- **Gerakan karakter lebih hidup**, memakai prinsip animasi kartun: pose (menunjuk, menjelaskan, melambai, angkat bahu, bersorak, berpikir) dengan ancang-ancang dan gerak lanjutan, masuk dari samping/bawah atau "muncul", berjalan, mengangguk mengikuti kata, efek memantul (squash & stretch). Karakter bergerak "on twos" seperti anime TV, kamera tetap mulus.
- **Transisi antar-shot**: geser, whip, zoom, kilat putih, dan fade.
- Claude membuat storyboard dulu dan memakai latar berbeda untuk setiap tempat dan zaman, lalu ditolak otomatis kalau terlalu sedikit benda cerita atau ada 3 shot yang sama persis.

**Perbaikan**
- Error **"EBUSY: resource busy or locked ... voice.mp3"** saat membuat ulang suara. Tombol **Dengar** sekarang memutar suara di dalam aplikasi (tidak membuka Windows Media Player yang mengunci file). Kalau file tetap dikunci program lain, muncul pesan yang jelas.
- Suara di **editor timing kata** (0.7.0) tidak berbunyi di aplikasi yang terpasang.
- Pratinjau latar di halaman project sekarang terpotong rapi sesuai kotaknya.

**Perubahan**
- Karakter baru wajib punya lengan terpisah yang digambar lurus ke bawah, supaya bisa berpose. **Karakter lama sebaiknya digambar ulang** (Pengaturan > Karakter > Ubah > Gambar ulang dari awal) agar pose terlihat benar.
- Kecepatan render 2D tetap sama (diukur: selisih sekitar 1,5%), walau ada benda dan gerakan tambahan.

## 0.7.0 - 2026-11-03

**Baru**
- **Pemeriksaan otomatis setelah render.** Setiap video yang selesai dirender langsung dicek: layar hitam, gambar diam lebih dari 3 detik, bagian tanpa suara, dan kerasnya suara. Hasilnya muncul sebagai tombol hijau/kuning/merah di tabel render, lengkap dengan **lembar ringkasan frame** (satu gambar setiap beberapa detik) supaya seluruh video bisa dicek sekilas tanpa diputar. Video lama bisa diperiksa lewat tombol kaca pembesar.
- **Editor timing kata** (tab Render > Timing kata): lihat gelombang suara, geser kotak kata atau tarik ujungnya, klik untuk mendengar kata itu, ketik angka detiknya langsung, atau geser semua kata sekaligus kalau teks di layar terasa terlalu cepat/lambat.
- Tanda **"Perlu dibuat ulang"** di panel suara kalau script atau narasi shot diubah setelah suara dibuat. Tombol Render meminta konfirmasi kalau suara belum cocok atau belum ada.
- Tanda di tab Render kalau video terakhir dibuat sebelum suara atau timing kata diubah.

## 0.6.2 - 2026-11-03

**Perbaikan**
- Render style 2D tidak lagi **macet di 95%** saat menggabung suara ke video. Langkah ini sekarang selesai dalam beberapa detik.
- Kalau langkah menggabung audio tetap macet, aplikasi menghentikannya sendiri setelah 10 menit, jadi antrean render tidak tertahan selamanya.

## 0.6.1 - 2026-11-03

**Perbaikan**
- Proses yang sedang berjalan **tidak hilang lagi saat pindah halaman**. Generate hook + script + shot, menggambar karakter, membuat suara, uji render, Siapkan Remotion, dan pasang numpy/scipy tetap jalan dan tetap terlihat waktu kamu kembali ke halamannya. Tidak muncul lagi pesan "Claude sedang menulis project lain" untuk project yang sama.
- Hasil gambar karakter yang selesai saat kamu sedang di halaman lain tetap masuk ke editor karakter, beserta isian yang sudah diketik.
- Halaman Pengaturan dan tab project mengingat bagian yang terakhir dibuka.

**Baru**
- Daftar **"Sedang berjalan"** di sidebar kiri. Klik salah satunya untuk kembali ke halaman proses itu.

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
