// Format data video 2D HyperForge. Dikirim aplikasi sebagai inputProps (file --props), tanpa kode per video.
// Folder src/anima/ dikelola aplikasi: disalin ulang setiap render, jangan diedit manual.

export type StyleId = 'manhwa' | 'drama' | 'komedi' | 'indie';
export type Format = '9:16' | '16:9';
export type Framing = 'wide' | 'medium' | 'close';
export type Camera = 'static' | 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'shake' | 'push-speaker';

/** Karakter: SVG ber-rig (lihat rig.ts untuk aturan data-part). */
export interface CharacterAsset {
  name: string;
  svg: string;
}

/** Latar: SVG bebas, viewBox sesuai format (1080x1920 atau 1920x1080). */
export interface BackgroundAsset {
  svg: string;
}

export interface CastMember {
  /** kunci di characters */
  char: string;
  /** posisi horizontal 0 (kiri) - 1 (kanan), titik tengah kaki */
  x: number;
  /** 1 = tinggi karakter 62% tinggi frame */
  scale?: number;
  flip?: boolean;
  /** ekspresi: nama data-expr di SVG (mis. "senang", "marah"). Kosong = bawaan. */
  expr?: string;
}

export interface Shot2D {
  durationInFrames: number;
  bg: string;
  camera?: Camera;
  /** wide = seluruh badan, medium = pinggang ke atas (bawaan), close = kepala-bahu */
  framing?: Framing;
  cast: CastMember[];
  /** karakter yang bicara di shot ini (mulut bergerak), '' = narator */
  speaker?: string;
  /** teks di layar untuk shot ini (dipakai kalau tidak ada words) */
  text: string;
}

export interface Word {
  word: string;
  /** detik dari awal video */
  start: number;
  end: number;
}

export type Comic2DProps = {
  style: StyleId;
  format: Format;
  characters: Record<string, CharacterAsset>;
  backgrounds: Record<string, BackgroundAsset>;
  shots: Shot2D[];
  /** timing per kata dari voice/words.json (opsional) */
  words?: Word[];
  /** judul kecil di pojok (opsional) */
  watermark?: string;
};

export const FPS = 30;
export const sizeOf = (f: Format) => (f === '16:9' ? { width: 1920, height: 1080 } : { width: 1080, height: 1920 });
