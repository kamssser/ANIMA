// Video 2D HyperForge: latar + karakter ber-rig + kamera + teks wajib, semuanya dari inputProps.
import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import { fitSvg, RigSvg } from './rig';
import { Subtitles } from './Subtitles';
import { STYLES } from './styles';
import type { CastMember, Comic2DProps, Framing, Shot2D } from './types';
import { FPS } from './types';

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/** Apakah speaker sedang mengucapkan kata pada detik t (pakai words kalau ada). */
function talkingAt(p: Comic2DProps, shotStartSec: number, shot: Shot2D, t: number) {
  if (!shot.speaker) return false;
  if (p.words?.length) return p.words.some((w) => t >= w.start && t <= w.end);
  const local = t - shotStartSec;
  return local > 0.15 && local < shot.durationInFrames / FPS - 0.35;
}

// framing: wide = seluruh badan, medium = dari pinggang ke atas, close = kepala dan bahu.
// [pembesaran, bagian bawah karakter yang terpotong di bawah frame (fraksi tinggi karakter)]
const FRAMING: Record<Framing, [number, number]> = { wide: [1, 0], medium: [1.65, 0.45], close: [2.7, 0.64] };

const Character: React.FC<{ m: CastMember; svg: string; talking: boolean; frame: number; width: number; height: number; bounce: boolean; framing: Framing }> = ({
  m,
  svg,
  talking,
  frame: f,
  width: W,
  height: H,
  bounce,
  framing,
}) => {
  const seed = hash(m.char) % 97;
  const [zoom, crop] = FRAMING[framing] ?? FRAMING.wide;
  // 9:16: seluruh badan ~62% tinggi frame; 16:9 lebih besar
  const h = H * (W > H ? 0.9 : 0.62) * zoom * (m.scale ?? 1);
  const w = h / 2;
  const blink = (f + seed * 13) % 115 < 4;
  const mouthOpen = talking && Math.floor(f / 3) % 2 === 0;
  const tilt = Math.sin((f + seed * 7) / 38) * (talking ? 3 : 1.5);
  const breathe = 1 + Math.sin((f + seed * 11) / 24) * 0.007;
  const hop = bounce && talking ? Math.abs(Math.sin(f / 4)) * h * 0.012 : 0;
  return (
    <RigSvg
      svg={svg}
      state={{ blink, mouthOpen, headTilt: tilt, armL: Math.sin((f + seed) / 30) * 2, armR: -Math.sin((f + seed) / 33) * 2, expr: m.expr }}
      style={{
        position: 'absolute',
        left: m.x * W - w / 2,
        bottom: hop - crop * h,
        width: w,
        height: h,
        transform: `scaleX(${m.flip ? -1 : 1}) scaleY(${breathe})`,
        transformOrigin: 'bottom center',
      }}
    />
  );
};

const ShotView: React.FC<{ p: Comic2DProps; shot: Shot2D; startSec: number }> = ({ p, shot, startSec }) => {
  const raw = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const st = STYLES[p.style] ?? STYLES.manhwa;
  const f = st.onTwos ? Math.floor(raw / 2) * 2 : raw;
  const t = startSec + raw / FPS;
  const u = Math.min(1, raw / Math.max(1, shot.durationInFrames - 1));
  const ease = u * u * (3 - 2 * u);

  // kamera
  const speakerX = shot.cast.find((c) => c.char === shot.speaker)?.x ?? 0.5;
  let zoom = 1.04, px = 0, py = 0;
  switch (shot.camera ?? 'static') {
    case 'zoom-in': zoom = 1.02 + 0.12 * ease; break;
    case 'zoom-out': zoom = 1.14 - 0.12 * ease; break;
    case 'pan-left': px = 0.04 - 0.08 * ease; zoom = 1.1; break;
    case 'pan-right': px = -0.04 + 0.08 * ease; zoom = 1.1; break;
    case 'shake': zoom = 1.08; px = Math.sin(raw * 2.1) * 0.006; py = Math.cos(raw * 1.7) * 0.006; break;
    case 'push-speaker': zoom = 1.04 + 0.16 * ease; px = (0.5 - speakerX) * 0.5 * ease; break;
    default: zoom = 1.03 + 0.02 * ease;
  }
  const bg = p.backgrounds[shot.bg]?.svg;
  const boil = st.lineBoil ? `url(#boil${Math.floor(raw / 3) % 3})` : undefined;

  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: '#111' }}>
      {st.lineBoil && (
        <svg width="0" height="0" style={{ position: 'absolute' }}>
          {[0, 1, 2].map((i) => (
            <filter key={i} id={`boil${i}`}>
              <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed={i + 1} />
              <feDisplacementMap in="SourceGraphic" scale="4" />
            </filter>
          ))}
        </svg>
      )}
      {/* latar: bergerak lebih pelan dari karakter (paralaks) */}
      <AbsoluteFill style={{ transform: `scale(${1 + (zoom - 1) * 0.6}) translate(${px * 0.5 * W}px, ${py * H}px)`, filter: st.bgFilter }}>
        {bg ? <div style={{ width: '100%', height: '100%' }} dangerouslySetInnerHTML={{ __html: fitSvg(bg, 'xMidYMid slice') }} /> : <AbsoluteFill style={{ background: st.fallbackBg }} />}
      </AbsoluteFill>
      <AbsoluteFill style={{ transform: `scale(${zoom}) translate(${px * W}px, ${py * H}px)`, transformOrigin: '50% 85%', filter: boil }}>
        {shot.cast.map((m, i) => {
          const c = p.characters[m.char];
          if (!c) return null;
          return <Character key={`${m.char}-${i}`} m={m} svg={c.svg} talking={m.char === shot.speaker && talkingAt(p, startSec, shot, t)} frame={f} width={W} height={H} bounce={st.bounce} framing={shot.framing ?? 'medium'} />;
        })}
      </AbsoluteFill>
      {st.vignette && <AbsoluteFill style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.35) 100%)' }} />}
      {st.grade && <AbsoluteFill style={{ background: st.grade, mixBlendMode: 'soft-light' }} />}
    </AbsoluteFill>
  );
};

export const Comic2D: React.FC<Comic2DProps> = (p) => {
  let at = 0;
  const starts = p.shots.map((s) => {
    const a = at;
    at += s.durationInFrames;
    return a;
  });
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {p.shots.map((s, i) => (
        <Sequence key={i} from={starts[i]} durationInFrames={s.durationInFrames}>
          <ShotView p={p} shot={s} startSec={starts[i] / FPS} />
        </Sequence>
      ))}
      <Subtitles words={p.words} shots={p.shots} starts={starts} look={(STYLES[p.style] ?? STYLES.manhwa).subtitle} />
      {p.watermark && (
        <div style={{ position: 'absolute', top: 36, right: 40, font: '700 30px Arial, sans-serif', color: 'rgba(255,255,255,0.85)', textShadow: '0 2px 4px rgba(0,0,0,0.6)' }}>{p.watermark}</div>
      )}
    </AbsoluteFill>
  );
};

export const comic2DDuration = (p: Comic2DProps) => Math.max(1, p.shots.reduce((n, s) => n + s.durationInFrames, 0));
