# Papan tulis kapur

| teknik | berat render | cocok untuk |
|---|---|---|
| 2D (canvas) | ringan | pelajaran, diagram, rumus, kuis |

- **Rasa:** guru menggambar di papan tulis hijau tua.
- **Teknik:** canvas 2D. Papan hijau tua dengan noda hapusan samar (bercak ber-seed, opasitas 5–8%) dan bingkai kayu.
- **Garis kapur:** stroke putih/kuning/merah muda pucat dengan tekstur butir (gambar banyak titik kecil di sepanjang
  path, atau pakai `ctx.setLineDash` acak ber-seed) dan tepi tidak rata.
- **Tulis-masuk (write-on):** garis dan huruf muncul mengikuti arah gambar (potong path berdasar panjang, progres dari
  `HF.prog`), disertai sfx `tik` kecil.
- **Karakter:** digambar dengan kapur juga (garis + arsiran kapur), ekspresi diganti per gambar.
- **Gerak:** 12 gambar per detik untuk kapur yang "bergetar" (`HF.boil`); hapusan dengan sapuan penghapus.
- **Subtitle:** tulisan kapur kuning di bawah, kata aktif digarisbawahi.

## Checklist frame
- [ ] garis bertekstur kapur, bukan vektor mulus
- [ ] penjelasan "ditulis" mengikuti narasi, bukan muncul sekaligus
- [ ] maks 3 warna kapur
- [ ] diagram terbaca di layar HP
