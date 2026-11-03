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
  | 'animate-custom';

export interface VisualStyle {
  id: VisualStyleId;
  label: string;
  /** animate = skill cth9191/animate di Claude Code (canvas, render sendiri) */
  kind: '3d' | '2d' | 'animate';
  /** nama style di skill animate (cut-paper, crosshatch, ...; custom = dari referensi) */
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
export const isAnimate = (id: string | null | undefined) => visualStyle(id).kind === 'animate';
export const STYLES_ANIMATE = VISUAL_STYLES.filter((s) => s.kind === 'animate');
