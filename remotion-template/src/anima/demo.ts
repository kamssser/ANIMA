// Contoh data untuk Remotion Studio + uji render. Karakter mengikuti aturan rig (rig.tsx).
import type { Comic2DProps } from './types';

const INK = '#1b1720';

export const DEMO_BUDI = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 1200">
<g stroke="${INK}" stroke-width="9" stroke-linejoin="round" stroke-linecap="round">
  <path d="M170 1200 L185 900 L415 900 L430 1200 Z" fill="#3b4a6b"/>
  <path d="M140 920 Q130 600 300 560 Q470 600 460 920 Z" fill="#7b4fb3"/>
  <g data-part="arm-l" data-pivot="170 640"><path d="M170 640 Q100 760 120 900" fill="none"/><circle cx="122" cy="905" r="28" fill="#f2b38c"/></g>
  <g data-part="arm-r" data-pivot="430 640"><path d="M430 640 Q500 760 480 900" fill="none"/><circle cx="478" cy="905" r="28" fill="#f2b38c"/></g>
  <path d="M260 560 L265 500 L335 500 L340 560" fill="#f2b38c"/>
  <g data-part="head" data-pivot="300 520">
    <ellipse cx="300" cy="330" rx="165" ry="180" fill="#f2b38c"/>
    <path d="M135 300 Q135 140 300 140 Q455 140 465 290 Q400 220 330 232 Q230 190 135 300 Z" fill="#4a3426"/>
    <g data-part="eyes-open">
      <ellipse cx="235" cy="300" rx="44" ry="50" fill="#fff"/><ellipse cx="365" cy="300" rx="44" ry="50" fill="#fff"/>
      <circle cx="244" cy="310" r="14" fill="${INK}" stroke="none"/><circle cx="356" cy="310" r="14" fill="${INK}" stroke="none"/>
    </g>
    <g data-part="eyes-closed"><path d="M195 305 h80"/><path d="M325 305 h80"/></g>
    <path d="M300 330 Q420 360 395 420 Q350 440 305 410" fill="#e89a76"/>
    <path data-part="mouth-closed" d="M235 445 Q300 470 365 445" fill="none"/>
    <path data-part="mouth-open" d="M230 440 Q300 520 370 440 Q300 465 230 440 Z" fill="#8c2b2b"/>
  </g>
</g></svg>`;

export const DEMO_SARI = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 1200">
<defs>
  <linearGradient id="skin" x1="0" x2="1"><stop offset="0" stop-color="#f7dcc6"/><stop offset="1" stop-color="#e7bb9c"/></linearGradient>
  <linearGradient id="hair" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2a22"/><stop offset="1" stop-color="#1a1210"/></linearGradient>
  <linearGradient id="top" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6c7d6"/><stop offset="1" stop-color="#d996ae"/></linearGradient>
</defs>
<g stroke="${INK}" stroke-width="4" stroke-linejoin="round">
  <path d="M195 1200 L205 930 L395 930 L405 1200 Z" fill="#8fb1d6"/>
  <path d="M150 960 Q140 650 240 600 L300 585 L360 600 Q460 650 450 960 Z" fill="url(#top)"/>
  <g data-part="arm-l" data-pivot="185 650"><path d="M185 650 Q140 800 160 940 L195 935 Q185 800 215 700 Z" fill="url(#top)"/></g>
  <g data-part="arm-r" data-pivot="415 650"><path d="M415 650 Q460 800 440 940 L405 935 Q415 800 385 700 Z" fill="url(#top)"/></g>
  <path d="M262 470 L258 600 Q300 625 342 600 L338 470 Z" fill="#e2b393"/>
  <g data-part="head" data-pivot="300 560">
    <path d="M150 230 Q130 520 200 720 L250 600 Z" fill="url(#hair)"/>
    <path d="M450 230 Q470 520 400 720 L350 600 Z" fill="url(#hair)"/>
    <path d="M190 260 Q186 420 245 495 Q300 540 355 495 Q414 420 410 260 Q300 215 190 260 Z" fill="url(#skin)"/>
    <path d="M170 300 Q160 130 300 120 Q440 130 432 300 Q400 220 330 205 Q300 260 230 240 Q200 280 170 300 Z" fill="url(#hair)"/>
  </g>
</g>
<g data-part="head" data-pivot="300 560" stroke="${INK}" stroke-linecap="round" fill="none">
  <path d="M215 305 Q245 292 272 302" stroke-width="7"/><path d="M328 302 Q355 292 385 305" stroke-width="7"/>
  <g data-part="eyes-open">
    <path d="M218 338 Q245 322 272 338" stroke-width="5"/><path d="M328 338 Q355 322 382 338" stroke-width="5"/>
    <ellipse cx="246" cy="345" rx="13" ry="15" fill="#3a2b25" stroke="none"/><ellipse cx="354" cy="345" rx="13" ry="15" fill="#3a2b25" stroke="none"/>
    <circle cx="250" cy="340" r="4" fill="#fff" stroke="none"/><circle cx="358" cy="340" r="4" fill="#fff" stroke="none"/>
  </g>
  <g data-part="eyes-closed"><path d="M220 344 Q245 354 272 344" stroke-width="4"/><path d="M328 344 Q355 354 380 344" stroke-width="4"/></g>
  <path d="M302 360 L296 405 Q302 410 310 406" stroke-width="3" stroke="#a9745b"/>
  <path data-part="mouth-closed" d="M278 448 Q300 456 322 448" stroke-width="4" stroke="#8a4a42"/>
  <path data-part="mouth-open" d="M276 444 Q300 474 324 444 Q300 452 276 444 Z" stroke-width="3" stroke="#8a4a42" fill="#7a3434"/>
  <ellipse cx="225" cy="400" rx="22" ry="10" fill="#f2a6a0" opacity="0.35" stroke="none"/><ellipse cx="375" cy="400" rx="22" ry="10" fill="#f2a6a0" opacity="0.35" stroke="none"/>
</g></svg>`;

const shelves = (side: 0 | 1) => {
  const colors = ['#e94f37', '#f6c445', '#3f88c5', '#44bba4', '#f18f01', '#c73e1d', '#8e5572', '#ffffff'];
  let s = `<g${side ? ' transform="translate(1080 0) scale(-1 1)"' : ''}><polygon points="0,90 330,330 330,1530 0,1820" fill="#7f8c99" stroke="${INK}" stroke-width="5"/>`;
  for (let i = 0; i < 6; i++) {
    const y0 = 160 + i * 270, y1 = 380 + i * 195;
    for (let j = 0; j < 9; j++) {
      const u = j / 9, x = u * 320, yy = y0 + (y1 - y0) * u, sz = 70 - u * 34;
      s += `<rect x="${(x + 6).toFixed(0)}" y="${(yy - sz).toFixed(0)}" width="${(sz * 0.7).toFixed(0)}" height="${sz.toFixed(0)}" rx="4" fill="${colors[(i * 3 + j) % colors.length]}" stroke="${INK}" stroke-width="3"/>`;
    }
    s += `<line x1="0" y1="${y0 + 4}" x2="330" y2="${y1 + 4}" stroke="${INK}" stroke-width="7"/>`;
  }
  return s + '</g>';
};

export const DEMO_SHOP = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920">
<rect width="1080" height="1920" fill="#bfe6f2"/><rect y="1480" width="1080" height="440" fill="#f4f1de"/>
<path d="M0 1480 L1080 1480" stroke="${INK}" stroke-width="5"/>
${shelves(0)}${shelves(1)}
<rect x="430" y="470" width="220" height="1010" fill="#5c6b7a" stroke="${INK}" stroke-width="5"/>
<rect x="455" y="500" width="170" height="380" fill="#9fd3e6" stroke="${INK}" stroke-width="4"/>
</svg>`;

export const DEMO: Comic2DProps = {
  style: 'sinema',
  format: '9:16',
  characters: { budi: { name: 'Budi', svg: DEMO_BUDI }, sari: { name: 'Sari', svg: DEMO_SARI } },
  backgrounds: { toko: { svg: DEMO_SHOP } },
  shots: [
    { durationInFrames: 90, bg: 'toko', camera: 'zoom-in', framing: 'wide', speaker: 'budi', cast: [{ char: 'budi', x: 0.3 }, { char: 'sari', x: 0.72, flip: true }], text: 'Sari, kamu lihat dompetku nggak?' },
    { durationInFrames: 90, bg: 'toko', camera: 'push-speaker', speaker: 'sari', cast: [{ char: 'budi', x: 0.3 }, { char: 'sari', x: 0.72, flip: true }], text: 'Lho, bukannya tadi kamu titip ke aku?' },
    { durationInFrames: 75, bg: 'toko', camera: 'shake', framing: 'close', speaker: 'budi', cast: [{ char: 'budi', x: 0.5 }], text: 'Terus yang bayar siapa dong?!' },
  ],
};
