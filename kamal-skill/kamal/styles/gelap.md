# Kamal Gelap

Panggung gelap minimalis, seperti teater kecil. Dua tokoh garis memerankan satu ide; satu benda simbol menyala kuning.
Tenang, sinis-lembut, "pelajaran hidup" dalam 10-40 detik.

## Angka
- 1080x1920 (9:16), 30 fps. Adegan 3-6 detik, satu ide per adegan. Lantai di y = 1300 (`FLOOR`).
- Zona: label tempat y = 350; judul atas y = 430 (2 baris, jarak 75); tokoh & benda 900-1300; tanda kanal y = FLOOR + 140.

## Palet (`K.GELAP`)
- Latar gradasi #2a2e35 -> #1d2026, lantai #16181c mengkilap (pantulan 22%), vinyet.
- Tokoh utama krem #ece7dc, tokoh lain abu #8d9097, garis tepi #15161a tebal (7 px), lengan kaki tebal membulat.
- Satu warna aksen saja: kuning #ffb627 untuk benda penting (menyala, `K.glow`) dan kata kunci judul.
- Kayu meja #6d6258. Teks putih #f1efe9.

## Tokoh
- `K.figure` saja (kepala bulat polos tanpa wajah, badan kapsul, sendi siku/lutut). Ekspresi lewat pose & condong
  badan (`lesu`, `tertekan`, `terkejut`, `sorak`), bukan wajah.
- Ukuran tokoh `s = 1` (tinggi +-350 px). Tokoh selalu menapak lantai dan punya pantulan (`K.withReflection`).
- Penanda peran kecil: medali (`K.medal`) untuk atasan, label kecil huruf kapital di atas kepala ("BOS", "KAMU").

## Cahaya & benda
- Satu lampu sorot (`K.spotlight`) menandai siapa yang "mendapat sorotan"; nyalakan saat momen balik.
- Benda simbol (hasil kerja, tas kemampuan, uang, piala...) datar bergaris tepi gelap; menyala kuning saat bernilai,
  padam jadi abu saat nilainya hilang (dramatis). Label kapital kecil di dekat benda ("HASILNYA", "KEMAMPUAN").
- Properti latar sedikit saja: jam dinding (waktu berjalan), meja, pintu. Maksimal 4 benda di layar.

## Gerak
- Kamera dorong pelan 3-4% sepanjang video; goyang kecil (`K.shake`) saat benturan/beban jatuh.
- Tokoh: jalan (`K.walk`), transisi pose `K.mix` 0,3-0,5 dtk dengan `HF.ease.back`. Garis kejut (`K.burst`) saat kaget.
- Benda berpindah tangan lewat sendi (`extra(ctx, joints)` -> `joints.handF`).
- Judul muncul baris demi baris (fade + naik 18 px) saat kalimatnya diucapkan; label lama memudar.

## Teks
- Judul: 800, 58 px, putih, kata kunci kuning (`*kata*`). Maks 2 baris, kalimat pendek seperti kutipan.
- Label: 700, 22-24 px, huruf kapital, jarak huruf lebar, 60% putih.
- Tanpa subtitle karaoke; bila brief minta subtitle, taruh di y ~ 1500 kecil dan tipis.

## Suara (score.json)
- mood "misteri" atau "tenang", bpm 70-84, energi rendah naik di momen balik; `hening` 0,4 dtk sebelum kalimat pelajaran.
- sfx: `tik` jam, `thud` saat beban/benda jatuh, `ding` saat benda menyala, `whoosh` pindah adegan.

## Checklist frame
- [ ] Satu aksen kuning saja, sisanya abu/krem.  [ ] Tokoh menapak lantai + pantulan.  [ ] Maks 4 benda.
- [ ] Judul tidak keluar margin 80 px.  [ ] Ada gerak setiap <= 2 dtk.  [ ] Lampu sorot hanya satu.
