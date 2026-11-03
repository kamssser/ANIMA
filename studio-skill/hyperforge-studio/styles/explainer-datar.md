# Explainer datar

| teknik | berat render | cocok untuk |
|---|---|---|
| 2D (canvas) | ringan | explainer edukasi & isu sosial/ekonomi, sejarah singkat, "kenapa bisa begitu", video YouTube 3–5 menit |

- **Rasa:** penjelasan yang ramah dan rapi: tokoh sederhana yang mudah disukai, dunia flat, informasi muncul sebagai
  label dan peta. Bukan garis tinta, bukan tekstur kertas: bentuk bersih dengan bayangan lembut.
- **Tokoh:** kepala besar membulat (sekitar 40% tinggi badan), **mata dua titik hitam kecil**, alis tipis, mulut garis
  pendek/oval kecil, tanpa hidung atau hanya lengkung kecil. Badan sederhana (trapesium/kapsul) dengan lengan kurus
  yang menekuk lembut, tangan bulat. Rambut atau topi sebagai **satu bentuk solid** penanda tokoh. Tidak ada outline
  hitam; tepi dibedakan oleh warna, ditambah **garis tepi terang tipis** (2–4 px, warna lebih terang dari latar,
  opasitas 40–60%) di sekeliling siluet tokoh dan benda penting supaya terpisah dari latar gelap.
- **Shading:** tiap bentuk 1 warna dasar + **1 bayangan lembut** (warna yang sama 12–18% lebih gelap, sedikit ke arah
  ungu/cokelat) di satu sisi, dan kadang 1 highlight tipis. Bayangan jatuh berupa elips samar di bawah tokoh/benda.
- **Palet:** hangat dan agak redup: krem, oker, cokelat muda, abu-biru, hijau zaitun, dengan **satu aksen kuat** untuk
  informasi (merah koral untuk label angka/peringatan, kuning emas untuk benda berharga). Latar gelap dipakai untuk
  suasana muram (tambang, malam), latar terang pastel untuk suasana normal.
- **Latar:** gradasi halus dua warna + siluet bangunan/alat dengan detail minimum; benda latar sedikit lebih pudar
  (desaturasi 20%) daripada tokoh supaya tokoh menonjol. Cahaya dari satu arah (mis. lampu tambang, matahari terbenam)
  sebagai lingkaran glow lembut.
- **Informasi di layar:**
  - Label angka berbentuk **pil/kotak membulat berwarna aksen** dengan teks putih tebal (mis. "Rp32.000 per hari").
  - Peta: bentuk wilayah flat dengan warna aksen untuk area yang dibahas + label kecil nama tempat.
  - Daftar/unsur: kotak kecil berlabel yang muncul satu per satu (pop dengan pegas kecil).
  - Teks di layar maks dua tingkat (angka besar + label); subtitle tetap ada di bawah.
- **Gerak:** 24 fps, tokoh `HF.stepTime(t, 12)` (on twos) dengan pose kunci jelas, kedip, gerak tangan menunjuk/
  menghitung; kamera halus tiap frame (zoom pelan 1.00 → 1.06, geser kecil). Transisi: potong langsung, geser
  (slide/whip) ke "dunia" berikutnya, atau zoom ke peta/benda. Benda informasi masuk dengan pop/slide, keluar cepat.
- **Ritme:** satu kalimat narasi = satu perubahan visual; adegan 3–6 detik. Video 3–5 menit dibagi per bab
  (pembuka → konteks → masalah → penjelasan bertahap → dampak → penutup), tiap bab punya warna latar sendiri.
- **Subtitle:** sans tebal putih dengan bayangan lembut gelap; kata kunci diberi warna aksen.
- **Format:** paling cocok 16:9 (YouTube). Untuk 9:16, tokoh lebih besar di tengah dan label di sepertiga atas.

## Checklist frame
- [ ] tokoh berkepala bulat dengan mata titik, tanpa outline hitam
- [ ] tiap bentuk punya satu bayangan lembut, latar lebih pudar dari tokoh
- [ ] satu warna aksen dipakai untuk informasi penting saja
- [ ] angka/label terbaca di layar HP, maksimal dua tingkat teks
- [ ] gaya terinspirasi referensi, tetapi tokoh, adegan, logo, dan teks buatan sendiri
