# Low-poly cerah

| teknik | berat render | cocok untuk |
|---|---|---|
| 3D (three.js) | ringan | explainer teknologi, cara kerja benda, edukasi cepat |

- **Rasa:** rapi, ceria, mainan meja. Bentuk dari sedikit bidang, setiap bidang satu warna.
- **Teknik:** three.js, `MeshStandardMaterial({ flatShading: true, roughness: 0.85, metalness: 0 })`. Geometri
  sederhana dengan sedikit segmen (`IcosahedronGeometry(r, 1)`, `CylinderGeometry(.., 6..8 sisi)`, `BoxGeometry`).
- **Palet:** 1 warna utama karakter, 1 warna latar lembut (krem/biru muda), 1 aksen kontras untuk hal yang sedang
  dibahas. Bagian yang dibahas boleh "menyala" (emissive) agar mata langsung ke sana.
- **Cahaya:** HemisphereLight + satu DirectionalLight dengan bayangan lembut (PCFSoft, mapSize 1024). Tanpa kabut gelap.
- **Gerak:** 30 fps. Karakter `HF.stepTime(t, 15)` (on twos) supaya terasa dianimasikan; kamera tiap frame.
  Pop-in benda pakai `HF.spring` (overshoot kecil), tidak muncul begitu saja.
- **Kamera:** dorong pelan ke bagian yang dibahas (medium → close), orbit kecil maks 15°. Potongan "dibelah"
  (cutaway) untuk menunjukkan isi benda: setengah cangkang bergeser keluar.
- **Label:** pil kecil (rounded rect) berwarna aksen di canvas UI, muncul dengan pop + `sfx pop`.
- **Subtitle:** putih tebal dengan garis tepi gelap tipis, kata aktif kuning.

## Checklist frame
- [ ] tiap bidang satu warna, tidak ada tekstur foto
- [ ] bagian yang dibahas paling terang/kontras di frame
- [ ] bayangan ada dan lembut; latar tidak hitam
- [ ] label pil terbaca di 1/3 lebar layar
