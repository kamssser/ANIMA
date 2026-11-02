# anima-remotion

Proyek Remotion untuk skill **cartoon-3d-short**, dirakit dari
[mromidev/claude-animated-shorts](https://github.com/mromidev/claude-animated-shorts) (MIT, lihat
`LICENSE-claude-animated-shorts`). Dipakai oleh ANIMA Studio untuk render.

| Folder | Isi |
| --- | --- |
| `src/videos/bridge/` | Template scene jembatan (komposisi `BridgeShort`, 1080x1920, 30 fps) |
| `src/anima/` | Mesin video HyperForge (AnimaComic2D untuk style 2D, AnimaTextOverlay untuk teks di atas video 3D). **Dikelola aplikasi**: disalin ulang setiap render, jangan diedit |
| `src/Root.tsx` | Daftar komposisi. Video baru = salin `src/videos/bridge` ke `src/videos/<nama>` lalu daftarkan di sini |
| `audio/` | SFX + musik sintetis + mix (Python, numpy + scipy). Jalankan `python mix.py` |
| `voice/` | `voice.wav` (48 kHz) + `words.json`, dibuat ANIMA dari vibi.pro |
| `scripts/` | Alat bantu skill (stills, QA, merge sandbox) |
| `public/bridge/kenney/` | Opsional: model `.glb` dari Kenney Nature Kit (CC0). Tanpa ini, scene tetap jalan tanpa pohon/props |

## Catatan penting

- **`@react-three/postprocessing` dikunci di 3.0.4.** Versi 3.2.x membuat composer secara asinkron,
  sehingga di Remotion (yang menggambar tepat satu kali per frame) hasilnya canvas kosong.
  Jangan upgrade sebelum dicek ulang dengan `npx remotion still src/index.ts TestBox out/t.png --props=out/composer.json`.
- **Timeout per frame** harus dinaikkan (`--timeout=300000`). Scene + post-processing butuh lebih dari 30 detik per frame di GPU lama.
- **Disk:** setiap render menyalin `public/` ke folder TEMP. ANIMA mengarahkannya ke `%TEMP%\anima-remotion` dan membersihkannya sesudah render.

## Perintah

```powershell
npm run studio     # buka Remotion Studio di browser
npm run still      # render 1 frame uji ke out/still.png
npm run typecheck
```
