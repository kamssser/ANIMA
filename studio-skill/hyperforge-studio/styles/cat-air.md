# Cat air lembut

| teknik | berat render | cocok untuk |
|---|---|---|
| 2D (canvas) | ringan | cerita hangat, refleksi, dongeng sebelum tidur, alam |

- **Rasa:** buku cerita bergambar cat air.
- **Teknik:** canvas 2D. Warna dioleskan berlapis transparan (alpha 0.25–0.5) dengan tepi yang "merembes": tiap bidang
  digambar 3–4 kali dengan path sedikit bergeser (`HF.noise`) dan `globalCompositeOperation = 'multiply'`.
- **Kertas:** tekstur kertas cat air (butir halus ber-seed) di seluruh frame; area putih kertas dibiarkan bernapas.
- **Garis:** garis pensil tipis cokelat tua hanya di bagian penting, sebagian sengaja putus.
- **Gerak:** 24 fps, karakter on twos (`HF.stepTime(t, 12)`), latar bergerak pelan (awan, daun, cahaya).
- **Cahaya:** matahari rendah hangat dari samping, warna sedikit pudar.
- **Subtitle:** serif lembut cokelat tua di atas sapuan cat terang tipis.

## Checklist frame
- [ ] warna transparan berlapis, tepi merembes
- [ ] tekstur kertas terlihat
- [ ] palet lembut, tidak ada warna neon
- [ ] gerak tenang, ada detail kecil yang hidup
