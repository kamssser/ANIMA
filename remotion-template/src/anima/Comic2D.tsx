// Video 2D HyperForge: latar + benda cerita + karakter ber-rig (pose, masuk, berjalan) + kamera + transisi
// + teks wajib, semuanya dari inputProps.
import React, { useMemo } from 'react';
import { AbsoluteFill, Sequence, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { fitSvg, RigSvg, scopeSvg } from './rig';
import { Subtitles } from './Subtitles';
import { Brand } from './Brand';
import { styleLook } from './styles';
import type { CastMember, Comic2DProps, Framing, Pose, PropPlacement, Shot2D } from './types';
import { FPS } from './types';

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const easeOut = (u: number) => 1 - Math.pow(1 - clamp01(u), 3);
const easeInOut = (u: number) => {
  const x = clamp01(u);
  return x * x * (3 - 2 * x);
};
/** Slow out + follow-through: melewati target ~10% lalu kembali (overshoot). */
const easeOutBack = (u: number) => {
  const x = clamp01(u);
  const c = 1.9;
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
};
/** Anticipation: mundur sedikit ke arah berlawanan dulu, lalu bergerak dengan follow-through. */
const anticipate = (u: number) => {
  if (u <= 0) return 0;
  if (u < 0.25) return -0.18 * Math.sin((u / 0.25) * Math.PI);
  return easeOutBack((u - 0.25) / 0.75);
};

/** Apakah speaker sedang mengucapkan kata pada detik t, dan berapa detik sejak kata terakhir mulai. */
function speechAt(p: Comic2DProps, shotStartSec: number, shot: Shot2D, t: number) {
  if (!shot.speaker) return { talking: false, sinceWord: 99 };
  if (p.words?.length) {
    let since = 99;
    let talking = false;
    for (const w of p.words) {
      if (w.start > t) break;
      since = t - w.start;
      talking = t <= w.end;
    }
    return { talking, sinceWord: since };
  }
  const local = t - shotStartSec;
  const talking = local > 0.15 && local < shot.durationInFrames / FPS - 0.35;
  return { talking, sinceWord: talking ? local % 0.5 : 99 };
}

// framing: wide = seluruh badan, medium = dari pinggang ke atas, close = kepala dan bahu.
// [pembesaran, bagian bawah karakter yang terpotong di bawah frame (fraksi tinggi karakter)]
const FRAMING: Record<Framing, [number, number]> = { wide: [1, 0], medium: [1.65, 0.45], close: [2.7, 0.64] };

// Sudut lengan [arm-l, arm-r] dalam derajat. Lengan digambar lurus ke bawah; arm-l di sisi kiri layar.
// Positif memutar searah jarum jam: arm-l positif = terangkat ke luar, arm-r negatif = terangkat ke luar.
const POSES: Record<Pose, [number, number]> = {
  idle: [5, -5],
  point: [6, -100],
  wave: [6, -150],
  explain: [32, -42],
  shrug: [38, -38],
  cheer: [150, -150],
  think: [12, -28],
};

const ENTER_FRAMES = 14;

const Character: React.FC<{
  m: CastMember;
  svg: string;
  talking: boolean;
  sinceWord: number;
  frame: number;
  dur: number;
  width: number;
  height: number;
  bounce: boolean;
  framing: Framing;
}> = ({ m, svg, talking, sinceWord, frame: f, dur, width: W, height: H, bounce, framing }) => {
  const { fps } = useVideoConfig();
  const seed = hash(m.char) % 97;
  const [zoom, crop] = FRAMING[framing] ?? FRAMING.wide;
  // 9:16: seluruh badan ~62% tinggi frame; 16:9 lebih besar
  const h = H * (W > H ? 0.9 : 0.62) * zoom * (m.scale ?? 1);
  const w = h / 2;

  // Posisi: berjalan dari x ke toX, atau masuk dari samping/bawah.
  const enter = m.enter ?? 'none';
  let x = m.x;
  let walking = false;
  if (typeof m.toX === 'number') {
    const u = f / Math.max(1, dur - 1);
    x = m.x + (m.toX - m.x) * easeInOut(u);
    walking = u > 0.04 && u < 0.96;
  }
  const eu = easeOut(f / ENTER_FRAMES);
  let ox = 0;
  let oy = 0;
  let pop = 1;
  if (enter === 'left') ox = -(1 - eu) * (x * W + w);
  if (enter === 'right') ox = (1 - eu) * ((1 - x) * W + w);
  // arcs: jalur masuk melengkung, bukan garis lurus
  if ((enter === 'left' || enter === 'right') && f < ENTER_FRAMES) oy = -Math.sin(eu * Math.PI) * h * 0.04;
  if (enter === 'bottom') oy = (1 - eu) * h * 0.7;
  if (enter === 'pop') pop = spring({ frame: f, fps, config: { damping: 11, stiffness: 160 } });
  if ((enter === 'left' || enter === 'right') && f < ENTER_FRAMES) walking = true;
  const settled = enter === 'none' ? 0 : ENTER_FRAMES;

  // Pose lengan: dari santai ke pose dalam 8 frame setelah masuk, lalu gerak kecil saat bicara.
  const pose = POSES[m.pose ?? 'idle'] ?? POSES.idle;
  // key pose santai -> pose shot: anticipation (turun sedikit) lalu naik melewati target dan kembali
  const pu = anticipate((f - settled) / 12);
  let armL = POSES.idle[0] + (pose[0] - POSES.idle[0]) * pu;
  let armR = POSES.idle[1] + (pose[1] - POSES.idle[1]) * pu;
  if (m.pose === 'wave') armR += Math.sin(f / 3) * 16 * pu;
  if (m.pose === 'cheer') {
    armL += Math.sin(f / 4) * 8;
    armR -= Math.sin(f / 4) * 8;
  }
  const gest = talking ? 1 : 0.25;
  armL += Math.sin((f + seed) / 9) * 6 * gest;
  armR -= Math.sin((f + seed) / 7) * 9 * gest;
  if (walking) {
    armL += Math.sin(f / 3) * 14;
    armR += Math.sin(f / 3) * 14;
  }

  // Kepala: goyang pelan + mengangguk tiap awal kata + miring saat angkat bahu/berpikir.
  const nod = talking ? Math.exp(-sinceWord * 9) * 5 : 0;
  const headTilt =
    Math.sin((f + seed * 7) / 38) * (talking ? 3 : 1.6) + nod + (m.pose === 'shrug' ? 7 * pu : 0) + (m.pose === 'think' ? -9 * pu : 0);

  const blink = (f + seed * 13) % 115 < 4;
  const mouthOpen = talking && Math.floor(f / 3) % 2 === 0;
  const breathe = 1 + Math.sin((f + seed * 11) / 24) * 0.008;
  const sway = Math.sin((f + seed * 5) / 45) * 0.8 + (walking ? Math.sin(f / 3) * 2 : 0);
  const step = walking ? Math.abs(Math.sin(f / 3)) * h * 0.02 : 0;
  const hopWave = Math.abs(Math.sin(f / 4));
  const hop = (bounce && talking ? hopWave * h * 0.012 : 0) + (m.pose === 'cheer' ? hopWave * h * 0.025 : 0);
  // squash & stretch: memanjang saat di udara, gepeng saat menyentuh tanah / saat muncul
  let squash = 0;
  if (m.pose === 'cheer') squash = hopWave > 0.15 ? 0.03 * hopWave : -0.05;
  if (enter === 'pop') squash += (pop - 1) * 0.6;
  if (enter === 'bottom' && f < ENTER_FRAMES + 6) squash += f < ENTER_FRAMES ? 0.04 * (1 - eu) : -0.04 * Math.sin(((f - ENTER_FRAMES) / 6) * Math.PI);
  const sy = breathe * (1 + squash);
  const sx = 1 - squash * 0.6;
  return (
    <RigSvg
      svg={svg}
      state={{ blink, mouthOpen, headTilt, armL, armR, expr: m.expr }}
      style={{
        position: 'absolute',
        left: x * W - w / 2 + ox,
        bottom: hop + step - crop * h - oy,
        width: w,
        height: h,
        transform: `scaleX(${m.flip ? -1 : 1}) rotate(${sway.toFixed(2)}deg) scale(${Math.min(pop, 1.08)}) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`,
        transformOrigin: 'bottom center',
      }}
    />
  );
};

/** Rasio viewBox SVG (lebar/tinggi). */
function aspectOf(svg: string) {
  const m = svg.match(/viewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*"/);
  return m ? Number(m[1]) / Number(m[2]) || 1 : 1;
}

const PropView: React.FC<{ pl: PropPlacement; svg: string; id: string; frame: number; dur: number; width: number; height: number }> = ({
  pl,
  svg,
  id,
  frame: f,
  dur,
  width: W,
  height: H,
}) => {
  const { fps } = useVideoConfig();
  const html = useMemo(() => fitSvg(scopeSvg(svg, `${id}-`), 'xMidYMid meet'), [svg, id]);
  const ar = useMemo(() => aspectOf(svg), [svg]);
  const w = Math.max(0.03, Math.min(1.5, pl.size || 0.3)) * W;
  const h = w / ar;
  const lf = f - Math.round((pl.delay ?? 0) * FPS);
  const anim = pl.anim ?? 'none';
  if (lf < 0 && anim !== 'none' && anim !== 'float' && anim !== 'bob' && anim !== 'pulse' && anim !== 'spin' && anim !== 'shake') return null;
  let x = pl.x * W;
  let y = pl.y * H;
  let rot = 0;
  let sc = 1;
  let op = 1;
  const u = easeOut(lf / 12);
  switch (anim) {
    case 'float':
      y += Math.sin(f / 18) * H * 0.008;
      break;
    case 'bob':
      rot = Math.sin(f / 10) * 4;
      break;
    case 'pop':
      sc = spring({ frame: lf, fps, config: { damping: 10, stiffness: 170 } });
      break;
    case 'drop':
      y = -h + (y + h) * spring({ frame: lf, fps, config: { damping: 9, stiffness: 120 } });
      break;
    case 'slide-left':
      x = W + w + (x - W - w) * u;
      break;
    case 'slide-right':
      x = -w + (x + w) * u;
      break;
    case 'across-left': {
      const a = clamp01(lf / Math.max(1, dur - (pl.delay ?? 0) * FPS));
      x = W + w / 2 - (W + w) * a;
      y += Math.sin(f / 2.5) * H * 0.0015;
      break;
    }
    case 'across-right': {
      const a = clamp01(lf / Math.max(1, dur - (pl.delay ?? 0) * FPS));
      x = -w / 2 + (W + w) * a;
      y += Math.sin(f / 2.5) * H * 0.0015;
      break;
    }
    case 'spin':
      rot = f * 3;
      break;
    case 'pulse':
      sc = 1 + Math.sin(f / 6) * 0.04;
      break;
    case 'shake':
      rot = Math.sin(f * 1.9) * 3;
      x += Math.sin(f * 2.3) * W * 0.003;
      break;
  }
  if (anim === 'slide-left' || anim === 'slide-right') op = clamp01(lf / 4);
  return (
    <div
      style={{
        position: 'absolute',
        left: x - w / 2,
        top: y - h / 2,
        width: w,
        height: h,
        opacity: op,
        transform: `scaleX(${pl.flip ? -1 : 1}) rotate(${rot.toFixed(2)}deg) scale(${sc})`,
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

const TRANSITION_FRAMES = 9;

const ShotView: React.FC<{ p: Comic2DProps; shot: Shot2D; startSec: number; index: number }> = ({ p, shot, startSec, index }) => {
  const raw = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const st = styleLook(p.style);
  // Seperti anime TV: karakter & benda "on twos" (15 gambar/detik), kamera tetap mulus tiap frame.
  // Style dengan onTwos (sinema) memakai "on threes" (10 gambar/detik) supaya lebih terasa gambar tangan.
  const f = st.onTwos ? Math.floor(raw / 3) * 3 : Math.floor(raw / 2) * 2;
  const t = startSec + raw / FPS;
  const dur = shot.durationInFrames;
  const u = Math.min(1, raw / Math.max(1, dur - 1));
  const ease = u * u * (3 - 2 * u);
  const insert = shot.cast.length === 0;

  // kamera (shot sisipan tanpa karakter: zoom pelan supaya tetap hidup)
  const speakerX = shot.cast.find((c) => c.char === shot.speaker)?.x ?? 0.5;
  let zoom = 1.04,
    px = 0,
    py = 0;
  switch (shot.camera ?? (insert ? 'zoom-in' : 'static')) {
    case 'zoom-in':
      zoom = 1.02 + 0.12 * ease;
      break;
    case 'zoom-out':
      zoom = 1.14 - 0.12 * ease;
      break;
    case 'pan-left':
      px = 0.04 - 0.08 * ease;
      zoom = 1.1;
      break;
    case 'pan-right':
      px = -0.04 + 0.08 * ease;
      zoom = 1.1;
      break;
    case 'shake':
      zoom = 1.08;
      px = Math.sin(raw * 2.1) * 0.006;
      py = Math.cos(raw * 1.7) * 0.006;
      break;
    case 'push-speaker':
      zoom = 1.04 + 0.16 * ease;
      px = (0.5 - speakerX) * 0.5 * ease;
      break;
    default:
      zoom = 1.03 + 0.02 * ease;
  }

  // Transisi masuk (shot pertama tidak).
  const tr = index === 0 ? 'cut' : shot.transition ?? 'cut';
  const tu = easeOut(raw / TRANSITION_FRAMES);
  let wrapTransform = '';
  let wrapFilter = '';
  let wrapOpacity = 1;
  let flash = 0;
  if (tr === 'cut') wrapTransform = `scale(${1 + 0.05 * (1 - easeOut(raw / 6))})`; // potong dengan sedikit "punch-in"
  if (tr === 'fade') wrapOpacity = tu;
  if (tr === 'slide') wrapTransform = `translateX(${(1 - tu) * 100}%)`;
  if (tr === 'zoom') {
    wrapTransform = `scale(${1 + 0.35 * (1 - tu)})`;
    wrapOpacity = clamp01(raw / 4);
  }
  if (tr === 'whip') {
    wrapTransform = `translateX(${(1 - tu) * 35}%)`;
    wrapFilter = raw < TRANSITION_FRAMES ? `blur(${((1 - tu) * 22).toFixed(1)}px)` : '';
  }
  if (tr === 'flash') flash = 1 - clamp01(raw / 7);

  const bg = p.backgrounds[shot.bg]?.svg;
  const boil = st.lineBoil ? `url(#boil${Math.floor(raw / 3) % 3})` : undefined;
  const speech = speechAt(p, startSec, shot, t);
  const props = shot.props ?? [];
  const propsOn = (layer: 'back' | 'front') =>
    props
      .map((pl, i) => ({ pl, i }))
      .filter(({ pl }) => (pl.layer ?? 'back') === layer && p.props?.[pl.prop]?.svg)
      .map(({ pl, i }) => <PropView key={`${pl.prop}-${i}`} pl={pl} svg={p.props![pl.prop].svg} id={`s${index}p${i}`} frame={f} dur={dur} width={W} height={H} />);

  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: '#000' }}>
      <AbsoluteFill style={{ transform: wrapTransform || undefined, filter: wrapFilter || undefined, opacity: wrapOpacity }}>
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
        {/* latar + benda belakang: bergerak lebih pelan dari karakter (paralaks) */}
        <AbsoluteFill style={{ transform: `scale(${1 + (zoom - 1) * 0.6}) translate(${px * 0.5 * W}px, ${py * H}px)`, filter: st.bgFilter }}>
          {bg ? <div style={{ width: '100%', height: '100%' }} dangerouslySetInnerHTML={{ __html: fitSvg(bg, 'xMidYMid slice') }} /> : <AbsoluteFill style={{ background: st.fallbackBg }} />}
          {propsOn('back')}
        </AbsoluteFill>
        <AbsoluteFill style={{ transform: `scale(${zoom}) translate(${px * W}px, ${py * H}px)`, transformOrigin: '50% 85%', filter: boil }}>
          {shot.cast.map((m, i) => {
            const c = p.characters[m.char];
            if (!c) return null;
            const isSpeaker = m.char === shot.speaker;
            return (
              <Character
                key={`${m.char}-${i}`}
                m={m}
                svg={c.svg}
                talking={isSpeaker && speech.talking}
                sinceWord={isSpeaker ? speech.sinceWord : 99}
                frame={f}
                dur={dur}
                width={W}
                height={H}
                bounce={st.bounce}
                framing={shot.framing ?? 'medium'}
              />
            );
          })}
          {propsOn('front')}
        </AbsoluteFill>
        {st.vignette && <AbsoluteFill style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.35) 100%)' }} />}
        {st.grade && <AbsoluteFill style={{ background: st.grade, mixBlendMode: 'soft-light' }} />}
      </AbsoluteFill>
      {flash > 0 && <AbsoluteFill style={{ background: '#fff', opacity: flash }} />}
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
          <ShotView p={p} shot={s} startSec={starts[i] / FPS} index={i} />
        </Sequence>
      ))}
      <Subtitles words={p.words} shots={p.shots} starts={starts} look={styleLook(p.style).subtitle} />
      <Brand text={p.watermark} />
    </AbsoluteFill>
  );
};

export const comic2DDuration = (p: Comic2DProps) => Math.max(1, p.shots.reduce((n, s) => n + s.durationInFrames, 0));
