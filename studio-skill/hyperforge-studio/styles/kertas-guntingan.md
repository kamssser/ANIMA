# Kertas guntingan

| teknik | berat render | cocok untuk |
|---|---|---|
| 2D (canvas) | ringan | dongeng, edukasi anak, kampanye sosial |

- **Rasa:** boneka kertas yang digeser tangan di atas meja.
- **Teknik:** canvas 2D. Tiap bagian karakter = potongan kertas warna datar dengan tepi sedikit tidak rata (path
  bergelombang dari `HF.noise`) dan garis tepi pucat tipis (sisa guntingan). Sendi bahu/siku/pinggul diberi "paku"
  bulat kecil; bagian berputar pada sendi itu.
- **Tekstur:** serat kertas halus (pola titik/garis acak ber-seed, opasitas 6–10%) di atas setiap potongan.
- **Kedalaman:** bayangan jatuh lembut di bawah tiap lapisan (`shadowBlur` 12–20, offset 6–10 px).
- **Gerak:** 12 gambar per detik; tiap gambar potongan bergeser 1–2 px acak ber-seed (`HF.boil`) seperti digeser tangan.
- **Cuaca & efek** juga dari kertas: awan sobek, hujan potongan garis, riak lingkaran kertas.
- **Subtitle:** label kertas putih yang ditempel (sedikit miring), teks gelap.

## Checklist frame
- [ ] tepi potongan tidak sempurna, ada serat kertas
- [ ] setiap lapisan punya bayangan
- [ ] gerak 12 gambar/detik dengan getar kecil
- [ ] subtitle terlihat seperti label tempel
