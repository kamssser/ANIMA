// Preset tampilan per style 2D. Gaya gambar (garis, warna, proporsi) ditentukan saat Claude menggambar
// karakter/latar (lihat shared/styles.json di aplikasi); di sini hanya cara menampilkan dan teks.
import type { StyleId } from './types';

export interface SubtitleLook {
  font: string;
  color: string;
  highlight: string;
  stroke: string;
  /** kotak latar teks (null = hanya outline) */
  box: string | null;
  uppercase: boolean;
  /** posisi vertikal dari bawah, fraksi tinggi frame */
  bottom: number;
}

export interface StyleLook {
  label: string;
  bgFilter?: string;
  fallbackBg: string;
  vignette: boolean;
  grade?: string;
  onTwos: boolean;
  bounce: boolean;
  lineBoil: boolean;
  subtitle: SubtitleLook;
}

export const STYLES: Record<StyleId, StyleLook> = {
  manhwa: {
    label: 'Motion comic (manhwa)',
    bgFilter: 'blur(5px) saturate(1.05)',
    fallbackBg: 'linear-gradient(#f4b183, #8fb3d9)',
    vignette: true,
    grade: 'linear-gradient(rgba(255,190,140,0.18), rgba(90,120,200,0.18))',
    onTwos: false,
    bounce: false,
    lineBoil: false,
    subtitle: { font: '700 {s}px "Segoe UI", Arial, sans-serif', color: '#ffffff', highlight: '#ffe27a', stroke: '#000', box: null, uppercase: false, bottom: 0.08 },
  },
  // Indie sinematik: latar tajam, cahaya hangat dramatis, animasi on twos, teks kuning miring kecil seperti subtitle film.
  sinema: {
    label: 'Indie sinematik',
    fallbackBg: 'linear-gradient(#2b2f5c, #c96f4a)',
    vignette: true,
    grade: 'linear-gradient(rgba(255,170,90,0.16), rgba(70,50,140,0.18))',
    onTwos: true,
    bounce: false,
    lineBoil: false,
    subtitle: { font: 'italic 600 {s}px "Segoe UI", Arial, sans-serif', color: '#ffe17a', highlight: '#ffffff', stroke: '#1a1410', box: null, uppercase: false, bottom: 0.07 },
  },
  // Sketsa muram: garis bergetar (line boil), warna sedikit kusam, on twos.
  sketsa: {
    label: 'Sketsa muram',
    bgFilter: 'saturate(0.85)',
    fallbackBg: 'linear-gradient(#9fb3a4, #6f7f74)',
    vignette: true,
    grade: 'linear-gradient(rgba(150,180,150,0.10), rgba(40,50,45,0.18))',
    onTwos: true,
    bounce: false,
    lineBoil: true,
    subtitle: { font: '700 {s}px "Trebuchet MS", "Segoe UI", Arial, sans-serif', color: '#f2efe6', highlight: '#e0473b', stroke: '#141414', box: null, uppercase: false, bottom: 0.08 },
  },
  // Pastel lembut: tanpa blur, cahaya terang lembut, gerak halus 30 fps, teks putih lembut.
  pastel: {
    label: 'Pastel lembut',
    fallbackBg: 'linear-gradient(#cfe9e4, #f3ead8)',
    vignette: false,
    grade: 'linear-gradient(rgba(255,250,235,0.14), rgba(160,210,190,0.12))',
    onTwos: false,
    bounce: false,
    lineBoil: false,
    subtitle: { font: '700 {s}px "Segoe UI", Arial, sans-serif', color: '#ffffff', highlight: '#f6d64a', stroke: '#3f6f5c', box: null, uppercase: false, bottom: 0.08 },
  },
};

/** Style 0.5.0 yang diganti (drama, komedi, indie) memakai tampilan pengganti. */
const ALIASES: Record<string, StyleId> = { drama: 'sinema', komedi: 'pastel', indie: 'sinema' };
export const styleLook = (id: string) => STYLES[(ALIASES[id] ?? id) as StyleId] ?? STYLES.manhwa;
