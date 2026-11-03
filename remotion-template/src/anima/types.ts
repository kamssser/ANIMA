// Format data video 2D HyperForge. Dikirim aplikasi sebagai inputProps (file --props), tanpa kode per video.
// Folder src/anima/ dikelola aplikasi: disalin ulang setiap render, jangan diedit manual.

export type StyleId = 'manhwa' | 'sinema' | 'sketsa' | 'pastel';
export type Format = '9:16' | '16:9';
export type Framing = 'wide' | 'medium' | 'close';
export type Camera = 'static' | 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'shake' | 'push-speaker';
/** Pose lengan (butuh data-part arm-l / arm-r, lengan digambar lurus ke bawah). */
export type Pose = 'idle' | 'point' | 'wave' | 'explain' | 'shrug' | 'cheer' | 'think';
/** Cara karakter masuk di awal shot. */
export type Enter = 'none' | 'left' | 'right' | 'bottom' | 'pop';
/** Transisi di awal shot (dari shot sebelumnya). */
export type Transition = 'cut' | 'fade' | 'slide' | 'zoom' | 'flash' | 'whip';
export type PropAnim = 'none' | 'float' | 'bob' | 'pop' | 'drop' | 'slide-left' | 'slide-right' | 'across-left' | 'across-right' | 'spin' | 'pulse' | 'shake';

/** Benda/objek cerita (kereta, peta, ayam, papan nama...). SVG bebas dengan viewBox. */
export interface PropAsset {
  svg: string;
}

export interface PropPlacement {
  /** kunci di props */
  prop: string;
  /** titik tengah benda: x 0 (kiri) - 1 (kanan), y 0 (atas) - 1 (bawah) */
  x: number;
  y: number;
  /** lebar benda sebagai fraksi lebar frame (0.05 - 1.2) */
  size: number;
  anim?: PropAnim;
  /** detik setelah shot mulai sebelum benda muncul (untuk pop/drop/slide) */
  delay?: number;
  /** back = di belakang karakter, front = di depan (bawaan back) */
  layer?: 'back' | 'front';
  flip?: boolean;
}

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
  pose?: Pose;
  enter?: Enter;
  /** berjalan dari x ke toX selama shot */
  toX?: number;
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
  /** benda cerita di shot ini */
  props?: PropPlacement[];
  transition?: Transition;
}

export interface Word {
  word: string;
  /** detik dari awal video */
  start: number;
  end: number;
}

export type Comic2DProps = {
  /** StyleId, atau id lama 0.5.0 (drama/komedi/indie) yang dipetakan styleLook */
  style: string;
  format: Format;
  characters: Record<string, CharacterAsset>;
  backgrounds: Record<string, BackgroundAsset>;
  /** benda cerita (opsional) */
  props?: Record<string, PropAsset>;
  shots: Shot2D[];
  /** timing per kata dari voice/words.json (opsional) */
  words?: Word[];
  /** judul kecil di pojok (opsional) */
  watermark?: string;
};

export const FPS = 30;
export const sizeOf = (f: Format) => (f === '16:9' ? { width: 1920, height: 1080 } : { width: 1080, height: 1920 });
