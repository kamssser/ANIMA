# Wayang bayangan

| teknik | berat render | cocok untuk |
|---|---|---|
| 2D (canvas) | ringan | cerita rakyat, sejarah, budaya, hari besar |

- **Rasa:** pertunjukan bayangan di layar kain yang diterangi lampu minyak.
- **Teknik:** canvas 2D. Layar kain hangat (krem-oranye) dengan pusat paling terang di tengah atas dan pinggir gelap;
  kecerahan berkedip pelan (`HF.noise(t*3)` ±6%) seperti api.
- **Tokoh:** dari samping (profil), siluet gelap dengan ukiran berlubang (pola titik, garis, sulur) yang ditembus
  cahaya. Lengan panjang bersendi di bahu dan siku, dengan tongkat kendali tipis di tiap tangan.
- **Jarak ke lampu:** tokoh dekat layar = bayangan tajam; ditarik ke lampu = membesar dan buram (`filter: blur`).
- **Pembuka/penutup:** bentuk gunungan (siluet runcing berukir) bergetar lalu menyingkir/menutup.
- **Balik arah:** tokoh dicerminkan (`scale(-1,1)`), ukirannya ikut terbalik.
- **Gerak:** 12 gambar per detik. Tokoh sedikit bergoyang seperti dipegang tangan.
- **Subtitle:** serif hangat warna krem dengan bayangan gelap, di bawah area tokoh.

## Checklist frame
- [ ] tokoh selalu profil, ukiran tembus cahaya terlihat
- [ ] cahaya berkedip pelan, pinggir layar gelap
- [ ] pembuka/penutup pakai gunungan
- [ ] karakter HyperForge diterjemahkan jadi siluet profil (warna jadi pola ukiran)
