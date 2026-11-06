# Horor kartun 3D (tampilan + suara bersama)

Dipakai oleh dua style: [Dongeng horor](horor-dongeng.md) (cerita karangan) dan [Horor nyata](horor-nyata.md)
(cerita dari sumber). Baca file ini **dan** file style-nya.

| teknik | berat render | cocok untuk |
|---|---|---|
| 3D (three.js) + `kit/horor-3d.js` | sedang–berat | cerita hantu Indonesia, legenda tempat angker, kisah mistis |

## Rasa
Kartun 3D yang lucu bentuknya (kepala besar, mata besar), tetapi dunianya **gelap, berkabut, dan sunyi**. Seramnya
datang dari **cahaya, siluet, waktu, dan suara**, bukan dari darah atau luka. Penonton harus merasa "ada yang salah"
sebelum melihat apa pun.

## Pustaka `kit/horor-3d.js` (WAJIB dipakai)
Muat setelah `studio-kit.js`: `<script src="/kit/horor-3d.js"></script>`, lalu `HR.pakai(THREE)`. Contoh lengkap siap
jalan: `samples/horor-3d.html` (8 detik: sepi → lampu berkedip → detak jantung → padam → hening → kuntilanak + kilat).

| fungsi | isi |
|---|---|
| `HR.suasana(scene, renderer, { rapat, kabut, kilat: [t...] })` | malam biru tua, kabut, cahaya bulan, tone mapping; `.update(t)` mengembalikan kekuatan kilat |
| `HR.lentera({ kuat, padam: [[a,b]] })` | lampu/obor berkedip deterministik; `padam` = mati total (sebelum kejutan) |
| `HR.kuntilanak()` `HR.pocong()` `HR.genderuwo()` `HR.bayangan()` | hantu kartun; `.update(t, { muncul, nyala, raih })` |
| `HR.orang({ baju, kulit, rambut, hijab, sarung, senter })` | tokoh manusia kartun; `.update(t, { takut 0..1, lihat, jalan })` (pupil mengecil, alis naik, gemetar saat takut) |
| `HR.beringin()` `HR.rumah()` `HR.nisan()` `HR.tanah({ jalan })` `HR.kabutTanah()` | latar kampung malam |
| `HR.kameraGoyang(cam, t, amp)` `HR.dekati(t, a, b)` | kamera genggam & dolly-in pelan |
| `HR.ketukanJantung(jantung)` `HR.denyut(t, beats)` | detak jantung **yang sama persis** dengan `score.json` → vinyet berdenyut merah tepat di setiap detak |
| `HR.overlay(ctx, t, { denyut, gelap, butir, vhs })` | vinyet, butiran film, layar gelap, garis rekaman (horor nyata) |
| `HR.kartu(ctx, t, { t0, t1, judul, sub })` `HR.penutup(ctx, t, { t0, kalimat })` | kartu tempat/tahun, penutup gelap + terima kasih |
| `HR.SUB` | opsi subtitle: putih, kata aktif merah pucat |

Hantu lain (tuyul, wewe gombel, banaspati, sundel bolong, leak, palasik, dll.) dibangun dari primitif dengan pola
yang sama: siluet jelas, mata menyala, tanpa luka/darah. Simpan di `karakter/` dan pakai ulang.

## Tampilan
- **Cahaya:** satu sumber utama yang bercerita (bulan, senter tokoh, lentera, layar HP, jendela rumah). Sisanya gelap.
  Biru dingin untuk dunia, kuning kusam untuk "aman", merah hanya untuk mata hantu dan kata kunci subtitle.
- **Kabut** selalu ada (`HR.suasana` + `HR.kabutTanah`). Jauh = hilang di kabut; hantu sering muncul dari sana.
- **Komposisi:** sering dari balik bahu tokoh; sisakan **ruang kosong gelap** di bingkai (penonton akan mencari-cari).
  Hantu pertama kali terlihat **kecil/samar di latar** sebelum muncul dekat. Tokoh tidak boleh menutupi hantu saat
  kejutan (cek di storyboard).
- **Kamera:** dolly-in pelan selama ketegangan, goyang halus (`amp` 0,01), goyang keras sebentar saat kejutan (0,05
  meluruh). Shot lebih panjang dari explainer (5–9 dtk) supaya ketegangan sempat tumbuh.
- **Lapisan akhir:** `HR.overlay` di setiap frame (vinyet + butiran). Layar hitam penuh 0,4–0,8 dtk tepat sebelum kejutan.
- **Subtitle:** `HF.drawSubtitle(ctx, t, chunks, HR.SUB)`; saat kejutan subtitle boleh hilang 1 dtk (biar gambar bicara).
- **Batas aman (YouTube/TikTok umum):** tanpa darah, luka, mayat realistis, bunuh diri, atau penyiksaan yang
  digambarkan. Kematian/kejadian tragis cukup disebut di narasi dan disimbolkan (lampu padam, kursi kosong).
  **Bukan konten anak:** jangan menandai "untuk anak", jangan memakai judul/tag yang menyasar anak.

## Suara: membuat hati berdetak (WAJIB)
Skor dari `tools/score.mjs` dengan `"mood": "horor"` (dengung rendah, nada sumbang saat tegang, kotak musik fals yang
jarang, gong rendah; tanpa drum). Pola ketegangan **gelombang**, bukan kaget terus:

1. **Tenang yang janggal** (energi 0,25–0,35): `ambien` malam (jangkrik + angin) atau hujan, `langkah` mengikuti
   kaki tokoh, `tokek`, `lolong` (anjing melolong jauh, gain 0,2–0,3).
2. **Tanda pertama** (kecil, jauh): `tawa` kuntilanak samar (gain 0,25–0,35, pan ke sisi asal suara), `derit`,
   `ketuk`, atau `bisik`. Lalu lega palsu.
3. **Tanda kedua** lebih dekat: **suara hantu** memanggil nama tokoh: `"suaraHantu": [{ "file": "vo.mp3", "dari",
   "sampai", "t", "gain": 0,5–0,6, "pan": -0,7 }]` mengolah potongan narasi (mis. "Dimas… Dimas…") jadi bisikan
   bergema bernada lain dari satu sisi. Energi 0,5–0,6. `gemuruh` (sub-bass) di bawahnya.
4. **Detak jantung naik** 8–15 dtk sebelum puncak: `"jantung": [{ "dari", "sampai", "bpm0": 65–75, "bpm1": 140–150,
   "gain": 0,7–0,8 }]`. 3–4 dtk terakhir ditumpuk: `napas` (panik), `gesek` (biola sumbang menjerit) + `dengung`,
   semuanya putus tepat di awal hening. Kamera mendekat, vinyet berdenyut (`HR.denyut` dari array yang sama).
5. **Hening total** 0,5–1 dtk (`"hening"` + layar gelap): musik **dan** efek (termasuk ekor gema) dibungkam otomatis.
6. **Kejutan:** `stinger` (gain 0,9–0,95) tepat saat hantu muncul + `tawa` dekat (gain 0,7–0,8) 0,2 dtk sesudahnya,
   bisa ditambah `guntur` + `HR.suasana({ kilat })`.
7. **Reda:** energi turun, angin/gong, satu tanda kecil terakhir (ketukan, tawa jauh) untuk sentuhan akhir dingin.

Efek seram (tawa, bisik, lolong, stinger, ketuk, derit, gesek, jerit) sudah diberi gema ruang otomatis.

### Suara hantu + jeritan (WAJIB bila hantu bicara atau ada suara memanggil)
- **Dialog hantu memakai suara hantu**, bukan suara narator: `anima_vibi_tts` dengan `speaker: "hantu-cewe"`
  (kuntilanak, sundel bolong, wewe gombel, perempuan yang memanggil) atau `speaker: "hantu-cowo"` (genderuwo, pocong,
  sosok laki-laki). Keduanya ElevenLabs `eleven_multilingual_v2`, dipilih pengguna di Pengaturan > Suara & audio > Suara
  hantu. Belum dipilih → minta pengguna memilihnya, jangan diganti suara lain. Satu file per kalimat hantu
  (`audio/hantu-01.mp3`, ...), kalimat pendek (2–6 kata: "Dimas… sini…", "Kembalikan…").
- Masukkan ke `score.json` lewat `"suaraHantu": [{ "file": "hantu-01.mp3", "t", "gain": 0,6–0,7, "pan", "nada": 1,
  "suara": "cewe" | "cowo" }]` supaya diberi gema dan arah; potongan narasi yang memanggil nama juga boleh
  (`"file": "vo.mp3", "dari", "sampai", "nada": 1,12`).
- **Setiap suara hantu/panggilan otomatis diikuti jeritan** (`jerit` untuk cewe, `jerit-cowo` untuk cowo), 0,25 dtk
  setelah suaranya selesai. Atur waktunya dengan `"tJerit"` (mis. tepat saat hantu muncul) dan kerasnya dengan
  `"gainJerit"` (0,4–0,7); `"jerit": false` hanya bila jeritan merusak momen (mis. bisikan sangat pelan sebelum hening).
- Efek pendukung: `tawa` (kuntilanak), `tawa-cowo` (genderuwo, "ho-ho-ho" berat).

- Paling banyak **1 kejutan besar per 45–60 dtk** (video 60 dtk: 1 besar + 1–2 kecil). Detak jantung hanya di bagian
  menegangkan, jangan sepanjang video (melelahkan, kehilangan efek).
- Tanpa whoosh di setiap pindah shot: pindah shot = potong langsung atau pudar ke hitam yang sunyi.
- Mix: `node tools/mix.mjs <proyek>/audio --musik -5 --sfx -2 --seram`. `--seram`: narator sedikit lebih berat +
  gema ruang, musik tidak terlalu mengecil saat narasi, rentang dinamis lebar (sunyi benar-benar sunyi, kejutan keras).
- Narasi boleh diberi jeda (potong `vo.mp3` per kalimat lalu susun ulang dengan ffmpeg `adelay`) supaya ada ruang untuk
  efek dan hening; geser `words.json` dengan jeda yang sama.
- Cek: lihat `audio/spec.png` (ffmpeg `showspectrumpic`) atau gelombang: detak harus makin rapat, celah hening terlihat,
  stinger tepat di frame hantu muncul.

## Narator
Suara rendah, pelan, dekat (seperti bercerita di pos ronda tengah malam): 2,0–2,4 kata/detik, kalimat pendek, jeda
sebelum kalimat penting. Pilih suara vibi.pro yang berat/tenang. Kata seru hanya di momen kaget.

## Checklist frame
- [ ] satu sumber cahaya utama yang jelas; kabut ada; merah hanya di mata hantu/kata kunci
- [ ] hantu terbaca siluetnya dan tidak tertutup tokoh/subtitle saat kejutan
- [ ] tanpa darah/luka/mayat realistis
- [ ] `HR.overlay` dipakai; denyut vinyet pas dengan detak di `score.json`
- [ ] gelombang ketegangan: tenang → tanda → detak naik → hening → kejutan → reda
