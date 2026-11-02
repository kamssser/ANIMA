// Rig karakter SVG. Aturan untuk Claude saat menggambar (juga ada di shared/character-rig.md aplikasi):
//   <svg viewBox="0 0 600 1200"> ; kaki di bawah (y=1200), badan di tengah (x=300).
//   data-part="head"          kepala (ikut miring), pivot leher lewat data-pivot="300 430"
//   data-part="eyes-open"     mata terbuka        data-part="eyes-closed"  mata terpejam (disembunyikan saat tidak kedip)
//   data-part="mouth-closed"  mulut diam          data-part="mouth-open"   mulut bicara
//   data-part="arm-l" / "arm-r" (opsional) lengan, dengan data-pivot di bahu
//   data-expr="<nama>" (opsional) grup ekspresi; hanya ekspresi yang dipilih shot yang tampil
// Semua id di dalam SVG diberi awalan unik per karakter supaya gradient/clipPath tidak bentrok.
import React, { useMemo } from 'react';

let seq = 0;

/** Awali semua id (dan rujukannya) dengan prefix supaya beberapa karakter bisa tampil bersama. */
export function scopeSvg(svg: string, prefix: string) {
  return svg
    .replace(/\bid="([^"]+)"/g, `id="${prefix}$1"`)
    .replace(/url\(#([^)]+)\)/g, `url(#${prefix}$1)`)
    .replace(/(xlink:)?href="#([^"]+)"/g, (_m, x = '', id) => `${x}href="#${prefix}${id}"`);
}

/** Ganti width/height/preserveAspectRatio di tag <svg> paling luar supaya mengisi kotaknya. */
export function fitSvg(svg: string, aspect: string) {
  return svg.replace(/<svg\b([^>]*)>/, (_m, attrs: string) =>
    `<svg${attrs.replace(/\s(width|height|preserveAspectRatio)="[^"]*"/g, '')} width="100%" height="100%" preserveAspectRatio="${aspect}">`,
  );
}

export interface RigState {
  blink: boolean;
  mouthOpen: boolean;
  headTilt: number; // derajat
  armL: number;
  armR: number;
  expr?: string;
}

/** CSS per frame untuk satu karakter: kedip, mulut, miring kepala, lengan, ekspresi. */
function rigCss(cls: string, st: RigState, pivots: Record<string, string>) {
  const p = (part: string, fallback: string) => pivots[part] || fallback;
  const rot = (part: string, deg: number, fb: string) =>
    `.${cls} [data-part="${part}"]{transform-box:view-box;transform-origin:${p(part, fb).replace(' ', 'px ')}px;transform:rotate(${deg.toFixed(2)}deg)}`;
  return [
    `.${cls} [data-part="eyes-closed"]{display:${st.blink ? 'inline' : 'none'}}`,
    `.${cls} [data-part="eyes-open"]{display:${st.blink ? 'none' : 'inline'}}`,
    `.${cls} [data-part="mouth-open"]{display:${st.mouthOpen ? 'inline' : 'none'}}`,
    `.${cls} [data-part="mouth-closed"]{display:${st.mouthOpen ? 'none' : 'inline'}}`,
    rot('head', st.headTilt, '300 430'),
    rot('arm-l', st.armL, '200 520'),
    rot('arm-r', st.armR, '400 520'),
    // ekspresi: sembunyikan semua grup data-expr kecuali yang dipilih (atau "normal")
    `.${cls} [data-expr]{display:none}`,
    `.${cls} [data-expr="${st.expr || 'normal'}"]{display:inline}`,
  ].join('\n');
}

export const RigSvg: React.FC<{ svg: string; state: RigState; style?: React.CSSProperties }> = ({ svg, state, style }) => {
  const { cls, html, pivots, hasExpr } = useMemo(() => {
    const c = `rig${++seq}`;
    const pv: Record<string, string> = {};
    for (const m of svg.matchAll(/data-part="([^"]+)"[^>]*?data-pivot="([\d.]+[ ,]+[\d.]+)"/g)) pv[m[1]] = m[2].replace(',', ' ').replace(/\s+/, ' ');
    for (const m of svg.matchAll(/data-pivot="([\d.]+[ ,]+[\d.]+)"[^>]*?data-part="([^"]+)"/g)) pv[m[2]] = m[1].replace(',', ' ').replace(/\s+/, ' ');
    return { cls: c, html: scopeSvg(svg, `${c}-`), pivots: pv, hasExpr: /data-expr=/.test(svg) };
  }, [svg]);
  let css = rigCss(cls, state, pivots);
  if (!hasExpr) css = css.split('\n').filter((l) => !l.includes('data-expr')).join('\n');
  return (
    <div className={cls} style={style}>
      <style>{css}</style>
      <div style={{ width: '100%', height: '100%' }} dangerouslySetInnerHTML={{ __html: fitSvg(html, 'xMidYMax meet') }} />
    </div>
  );
};
