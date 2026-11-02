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
  drama: {
    label: 'Drama Indonesia',
    fallbackBg: 'linear-gradient(#e9d7c0, #b98f6a)',
    vignette: true,
    grade: 'linear-gradient(rgba(255,220,180,0.12), rgba(60,40,30,0.15))',
    onTwos: false,
    bounce: false,
    lineBoil: false,
    subtitle: { font: '700 {s}px "Segoe UI", Arial, sans-serif', color: '#ffffff', highlight: '#ffd34d', stroke: '#000', box: null, uppercase: false, bottom: 0.08 },
  },
  komedi: {
    label: 'Komedi garis tebal',
    fallbackBg: 'linear-gradient(#bfe9ff, #fff6c9)',
    vignette: false,
    onTwos: true,
    bounce: true,
    lineBoil: false,
    subtitle: { font: '900 {s}px "Comic Sans MS", "Segoe UI", Arial, sans-serif', color: '#ffffff', highlight: '#ffdd00', stroke: '#1b1720', box: null, uppercase: true, bottom: 0.08 },
  },
  indie: {
    label: 'Indie animasi',
    fallbackBg: 'linear-gradient(#5a6a86, #2c3345)',
    vignette: true,
    grade: 'linear-gradient(rgba(120,140,200,0.15), rgba(200,120,140,0.12))',
    onTwos: true,
    bounce: false,
    lineBoil: true,
    subtitle: { font: '700 {s}px "Trebuchet MS", "Segoe UI", Arial, sans-serif', color: '#ffffff', highlight: '#ff8fa3', stroke: 'transparent', box: 'rgba(20,20,30,0.72)', uppercase: false, bottom: 0.08 },
  },
};
