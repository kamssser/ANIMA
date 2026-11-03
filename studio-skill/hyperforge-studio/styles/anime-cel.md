# Anime cel

| teknik | berat render | cocok untuk |
|---|---|---|
| 2D (canvas) | sedang | drama lebay, reaksi, cerita perjuangan, komedi |

- **Rasa:** serial animasi TV: warna datar dua tingkat, garis tinta, reaksi besar.
- **Teknik:** canvas 2D. Karakter dari path dengan isi warna datar + **satu** warna bayangan (lebih gelap ke arah
  ungu-biru, bukan hitam) sebagai bentuk tegas, tanpa gradasi. Garis tinta 6–10 px di siluet, 3–4 px di garis dalam.
- **Latar:** langit dilukis (gradasi biru pekat + awan besar bertepi terang tegas), bangunan/pohon sebagai bidang
  datar; latar tanpa garis tinta supaya karakter menonjol.
- **Gerak:** 24 fps, karakter `HF.stepTime(t, 12)` (on twos), kamera tiap frame. Pose kunci jelas, in-between sedikit.
- **Efek:** speed lines saat lari, focus lines (garis radial) di momen penting, 2 frame kilat hitam-putih saat benturan,
  keringat/tetes air mata bergaya, kilau di mata.
- **Kamera:** potong cepat antar framing, zoom tiba-tiba ke wajah untuk reaksi, sedikit getar saat kaget.
- **Subtitle:** tebal, kuning untuk kata aktif, garis tepi hitam tebal.

## Checklist frame
- [ ] tidak ada gradasi di karakter, bayangan satu tingkat
- [ ] garis tinta hanya di karakter dan benda penting
- [ ] reaksi punya efek (focus lines / speed lines / impact)
- [ ] karakter on twos, kamera mulus
