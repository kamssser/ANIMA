# Pixel retro

| teknik | berat render | cocok untuk |
|---|---|---|
| 2D (canvas kecil diperbesar) | paling ringan | teknologi, gaming, nostalgia, sejarah komputer |

- **Rasa:** game 8/16-bit.
- **Teknik:** gambar di canvas kecil (9:16: 108×192; 16:9: 192×108), lalu salin ke canvas besar dengan
  `imageSmoothingEnabled = false` (perbesar 10×). Tanpa anti-alias sama sekali; posisi dibulatkan ke piksel.
- **Sprite:** karakter sekitar 16–20 × 24–28 piksel, garis tepi gelap 1 piksel, frame: diam, jalan/lari 4 frame,
  lompat, senang, kalah. Ekspresi diganti per frame sprite.
- **Palet:** maks 32 warna; langit pakai pita warna (tanpa gradasi halus).
- **Level:** tile 8 atau 16 piksel; latar paralaks 2–3 lapis.
- **Gerak:** video 30 fps, sprite 10 gambar/detik (`HF.stepTime(t, 10)`); kamera dibulatkan ke piksel.
- **UI & transisi:** HUD dan huruf piksel buatan sendiri (gambar huruf di kisi 5×7), transisi fade bertahap 3 langkah.
- **Subtitle:** huruf piksel buatan sendiri, putih dengan bayangan 1 piksel.

## Checklist frame
- [ ] tidak ada piksel setengah/blur
- [ ] palet terbatas, langit berpita
- [ ] sprite 10 gambar/detik, kamera tidak "melayang" sub-piksel
- [ ] huruf dan UI buatan sendiri, bukan meniru game tertentu
