# Kartun karet hitam-putih

| teknik | berat render | cocok untuk |
|---|---|---|
| 2D (canvas) | ringan | musik & joget, nostalgia, iklan retro, komedi |

- **Rasa:** kartun hitam-putih era awal: semua bergoyang mengikuti musik.
- **Teknik:** canvas 2D, hitam-putih-abu saja. Isi warna datar dengan garis tinta tebal.
- **Anatomi karet:** tangan dan kaki melengkung seperti selang tanpa siku (kurva bezier), sarung tangan putih besar,
  sepatu bulat, mata hitam dengan potongan segitiga kecil.
- **Ritme:** semua mengikuti ketukan musik (BPM dari `score.json`, mis. 120): squash di setiap ketukan, benda di
  sekitar ikut bergoyang, not balok melayang.
- **Efek film tua:** grain kasar, debu dan garis gores vertikal ber-seed per gambar, flicker kecerahan, gambar sedikit
  bergoyang (gate weave), vignette gelap.
- **Pembuka/penutup:** iris-in dan iris-out (lingkaran hitam) ke wajah karakter, lalu kartu judul berbingkai.
- **Gerak:** 24 fps on twos.
- **Subtitle:** huruf serif tebal putih dengan bingkai hitam, seperti kartu teks film bisu.

## Checklist frame
- [ ] hanya hitam/putih/abu
- [ ] semua bergoyang mengikuti ketukan
- [ ] efek film tua ada tapi subtitle tetap terbaca
- [ ] desain karakter sendiri, bukan tokoh kartun klasik yang dikenal
