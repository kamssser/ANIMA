# Clay stop motion

| teknik | berat render | cocok untuk |
|---|---|---|
| 3D (three.js) | berat | kuliner, resep, slapstick, konten anak |

- **Rasa:** boneka plastisin di set miniatur, ada jejak jari.
- **Teknik:** three.js `MeshStandardMaterial` roughness 0.45 (agak mengilap seperti lilin). Permukaan "penyok": geser
  vertex dengan `HF.noise` kecil (amplitudo 1–2% ukuran). **Boil:** ganti seed noise setiap gambar
  (`HF.boil(t, 12, 3)`) supaya permukaan sedikit berubah seperti disentuh animator.
- **Gerak:** 12 gambar per detik (`HF.stepTime(t, 12)` untuk SEMUA, termasuk kamera), video tetap 24 fps. Tanpa
  motion blur. Kecerahan berkedip ±2% per gambar.
- **Set:** bahan nyata versi miniatur: kayu, kain kotak-kotak, keramik, kertas. Lampu studio hangat, bayangan lembut,
  ruang tajam sempit (latar sedikit buram).
- **Mata & mulut:** mata manik bulat mengilap; mulut potongan yang diganti-ganti (bukan morph halus).
- **Efek:** uap dari bentuk kapas, cipratan dari tetesan bulat.
- **Subtitle:** putih tebal membulat dengan garis tepi cokelat tua.

## Checklist frame
- [ ] semua bergerak 12 gambar/detik (termasuk kamera)
- [ ] permukaan tidak mulus sempurna dan "boil" antar gambar
- [ ] set dari "bahan nyata", bukan warna datar
- [ ] uji 5 detik dulu (berat)
