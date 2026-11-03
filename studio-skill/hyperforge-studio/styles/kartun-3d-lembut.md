# Kartun 3D lembut

| teknik | berat render | cocok untuk |
|---|---|---|
| 3D (three.js) | berat | cerita premium, drama keluarga, iklan brand |

- **Rasa:** seperti film animasi layar lebar versi mini: material halus, cahaya jendela yang hangat.
- **Teknik:** three.js `MeshPhysicalMaterial` (kulit: `sheen` tipis, roughness 0.55; kain: roughness 0.9; mata:
  clearcoat 1). Geometri halus (segmen tinggi). `renderer.toneMapping = ACESFilmicToneMapping`, exposure 1.0–1.2.
- **Cahaya:** key light kuat dari samping (jendela), fill hangat redup, rim light dingin di siluet. Partikel debu
  kecil di berkas cahaya (titik sprite bergerak pelan dari `HF.noise`).
- **Gerak:** 30 fps, pose tiap frame (bukan on twos). Wajib squash & stretch saat lompat/benturan, ancang-ancang
  (`HF.ease.anticipate`) sebelum gerak besar, follow-through rambut/kain (lag 2–4 frame).
- **Kamera:** lensa sempit (FOV 28–35), gerak halus, "fokus" dengan membuat latar sedikit buram (render latar ke
  layer terpisah + CSS `filter: blur()`) atau kabut ringan.
- **Grading:** kontras lembut, warna hangat, sedikit bloom di area terang (UnrealBloomPass ringan atau glow sprite).
- **Subtitle:** putih bersih tanpa kotak, bayangan lembut.

## Checklist frame
- [ ] ada key, fill, dan rim light; siluet karakter terpisah dari latar
- [ ] gerak besar punya ancang-ancang dan follow-through
- [ ] latar lebih lembut/buram daripada karakter
- [ ] render uji 5 detik dulu (gaya ini berat)
