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
  | 'bang-opener';

export interface VisualStyle {
  id: VisualStyleId;
  label: string;
  /** skill = dibuat skill Claude pihak ketiga (animate / bang-motion) di Claude Code, render sendiri */
  kind: '3d' | '2d' | 'skill';
  /** mesin skill untuk kind skill */
  engine?: 'animate' | 'bang-motion';
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
