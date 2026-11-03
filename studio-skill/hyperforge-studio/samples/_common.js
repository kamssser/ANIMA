// Bersama untuk adegan contoh gaya (samples/*.html): maskot "Bulu" (bola dengan mata besar + antena) dan teks contoh.
// Contoh ini juga rujukan cara menerjemahkan SATU karakter ke tiap gaya tanpa mengubah bentuk dan warnanya.
window.SAMPLE = {
  W: 1080,
  H: 1920,
  text: [
    { s: 0.2, e: 0.7, text: 'Kenapa' },
    { s: 0.7, e: 1.1, text: 'langit' },
    { s: 1.1, e: 2.4, text: 'biru?' },
  ],
  warna: { badan: '#ffb703', pipi: '#fb8500', mata: '#1d1d1f', aksen: '#219ebc' },
  /** subtitle contoh di t (dipanggil di akhir draw) */
  sub(ctx, t, o = {}) {
    HF.drawSubtitle(ctx, t, HF.chunkWords(window.SAMPLE.text, 4), { keywords: new Set(['langit']), ...o });
  },
};
