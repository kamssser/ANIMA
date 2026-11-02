// Pratinjau karakter ber-rig di aplikasi (kedip + bicara), aturan sama dengan remotion-template/src/anima/rig.tsx.
import { useEffect, useMemo, useState } from 'react';

let seq = 0;

const scope = (svg: string, p: string) =>
  svg
    .replace(/\bid="([^"]+)"/g, `id="${p}$1"`)
    .replace(/url\(#([^)]+)\)/g, `url(#${p}$1)`)
    .replace(/(xlink:)?href="#([^"]+)"/g, (_m, x = '', id) => `${x}href="#${p}${id}"`)
    .replace(/<svg\b([^>]*)>/, (_m, a: string) => `<svg${a.replace(/\s(width|height|preserveAspectRatio)="[^"]*"/g, '')} width="100%" height="100%" preserveAspectRatio="xMidYMax meet">`);

export function RigPreview({ svg, animate = true, talking = false, className }: { svg: string; animate?: boolean; talking?: boolean; className?: string }) {
  const [cls] = useState(() => `rp${++seq}`);
  const html = useMemo(() => scope(svg, `${cls}-`), [svg, cls]);
  const [f, setF] = useState(0);
  useEffect(() => {
    if (!animate) return;
    const t = setInterval(() => setF((n) => n + 1), 100);
    return () => clearInterval(t);
  }, [animate]);
  const blink = animate && f % 35 < 2;
  const mouth = talking && f % 2 === 0;
  const css = [
    `.${cls} [data-part="eyes-closed"]{display:${blink ? 'inline' : 'none'}}`,
    `.${cls} [data-part="eyes-open"]{display:${blink ? 'none' : 'inline'}}`,
    `.${cls} [data-part="mouth-open"]{display:${mouth ? 'inline' : 'none'}}`,
    `.${cls} [data-part="mouth-closed"]{display:${mouth ? 'none' : 'inline'}}`,
    /data-expr=/.test(svg) ? `.${cls} [data-expr]{display:none}.${cls} [data-expr="normal"]{display:inline}` : '',
  ].join('');
  return (
    <div className={`${cls} ${className ?? ''}`}>
      <style>{css}</style>
      <div className="size-full" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
