import data from '../../shared/visual-styles.json';

export type VisualStyleId = 'kartun-3d' | 'manhwa' | 'drama' | 'komedi' | 'indie';

export interface VisualStyle {
  id: VisualStyleId;
  label: string;
  kind: '3d' | '2d';
  description: string;
  draw: string[];
}

export const VISUAL_STYLES = data.styles as VisualStyle[];
export const STYLES_2D = VISUAL_STYLES.filter((s) => s.kind === '2d');

export const visualStyle = (id: string | null | undefined): VisualStyle => VISUAL_STYLES.find((s) => s.id === id) ?? VISUAL_STYLES[0];
export const is2D = (id: string | null | undefined) => visualStyle(id).kind === '2d';
