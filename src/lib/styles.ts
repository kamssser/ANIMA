import data from '../../shared/visual-styles.json';

export type VisualStyleId =
  | 'kartun-3d'
  | 'manhwa'
  | 'sinema'
  | 'sketsa'
  | 'pastel'
  | 'animate-cut-paper'
  | 'animate-crosshatch'
  | 'animate-riso'
  | 'animate-sketchbook'
  | 'animate-math'
  | 'animate-pixel'
  | 'animate-isometric'
  | 'animate-custom'
  | 'bang-kartun-kolase'
  | 'bang-jurnalisme'
  | 'bang-katalog'
  | 'bang-sketsa-vintage'
  | 'bang-aksi-kontinu'
  | 'bang-kartun-panggung'
  | 'bang-opener'
  | 'studio-explainer-datar'
  | 'studio-low-poly'
  | 'studio-kartun-3d-lembut'
  | 'studio-anime-cel'
  | 'studio-clay'
  | 'studio-kertas-guntingan'
  | 'studio-wayang'
  | 'studio-pixel'
  | 'studio-papan-kapur'
  | 'studio-cat-air'
  | 'studio-karet-retro'
  | 'av-bongkar'
  | 'av-bongkar-25d'
  | 'av-tur'
  | 'av-story'
  | 'av-pov'
  | 'av-tutorial'
  | 'av-mitos'
  | 'av-versus'
  | 'av-toplist'
  | 'av-kalau'
  | 'av-evolusi'
  | 'av-kuis';

export interface VisualStyle {
  id: VisualStyleId;
  label: string;
  /** skill = dibuat skill Claude pihak ketiga (animate / bang-motion) di Claude Code, render sendiri */
  kind: '3d' | '2d' | 'skill';
  /** mesin skill untuk kind skill */
  engine?: 'animate' | 'bang-motion' | 'studio' | 'animantra';
  /** nama style di skill (animate: cut-paper ... custom; bang-motion: kartun-kolase ... opener) */
  skillStyle?: string;
  description: string;
  draw: string[];
  /** id video YouTube yang potongan frame-nya dipakai sebagai referensi gaya */
  references?: string[];
}

export const VISUAL_STYLES = data.styles as VisualStyle[];
export const STYLES_2D = VISUAL_STYLES.filter((s) => s.kind === '2d');

const ALIASES = (data as { aliases?: Record<string, string> }).aliases ?? {};
/** Style lama (0.5.0: drama, komedi, indie) dipetakan ke style pengganti. */
export const styleId = (id: string | null | undefined) => (id && ALIASES[id]) || id || 'kartun-3d';
export const visualStyle = (id: string | null | undefined): VisualStyle => VISUAL_STYLES.find((s) => s.id === styleId(id)) ?? VISUAL_STYLES[0];
export const is2D = (id: string | null | undefined) => visualStyle(id).kind === '2d';
export const isSkill = (id: string | null | undefined) => visualStyle(id).kind === 'skill';
export const STYLES_SKILL = VISUAL_STYLES.filter((s) => s.kind === 'skill');

// ---------- gambar contoh & kelompok style (kartu pemilih style) ----------
const IMAGES = import.meta.glob('../assets/styles/*.jpg', { eager: true, import: 'default' }) as Record<string, string>;
/** Gambar contoh style (src/assets/styles/<id>.jpg). */
export const styleImage = (id: string | null | undefined) => IMAGES[`../assets/styles/${styleId(id)}.jpg`];

export type StyleGroup = 'cepat' | '3d' | 'animate' | 'bang-motion' | 'studio' | 'animantra';
export const STYLE_GROUPS: { id: StyleGroup; label: string; hint: string }[] = [
  { id: 'cepat', label: '2D cepat', hint: 'Generate & render langsung di aplikasi, beberapa menit per video' },
  { id: 'studio', label: 'HyperForge Studio', hint: 'Bersama Claude di tab Claude: gaya, karakter, naskah, suara, storyboard' },
  { id: 'animate', label: 'Animate', hint: 'Skill animate (cth9191): kanvas bergaya, story/look/storyboard disetujui dulu' },
  { id: 'bang-motion', label: 'Bang Motion', hint: 'Skill bang-motion (Bang Tutorial): motion graphic & explainer seperti video' },
  { id: 'animantra', label: 'Animantra', hint: 'Skill Animantra: Vector (paket milikmu): video 9:16 bedah 3D flat-toon, 11 format, dikerjakan Claude persis seperti skillnya' },
  { id: '3d', label: 'Kartun 3D', hint: 'Dunia 3D skill cartoon-3d-short, render paling lama' },
];
export const styleGroup = (s: VisualStyle): StyleGroup => (s.kind === '3d' ? '3d' : s.kind === '2d' ? 'cepat' : (s.engine ?? 'animate'));
/** Berat render singkat untuk lencana kartu. */
export const styleSpeed = (s: VisualStyle) =>
  s.kind === '3d' ? 'Render lama' : s.kind === '2d' ? 'Render cepat' : /berat/i.test(s.description) ? 'Render berat' : /ringan/i.test(s.description) ? 'Render ringan' : 'Bersama Claude';
