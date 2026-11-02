// Teks wajib di layar. Dengan words (timing per kata dari suara): potongan maks 4 kata, kata yang sedang
// diucapkan disorot. Tanpa words: teks shot dibagi rata sepanjang durasi shot.
import React, { useMemo } from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import type { SubtitleLook } from './styles';
import type { Word } from './types';
import { FPS } from './types';

interface Chunk {
  start: number;
  end: number;
  words: Word[];
}

const MAX_WORDS = 4;
const GAP = 0.45;

export function chunkWords(words: Word[]): Chunk[] {
  const out: Chunk[] = [];
  let cur: Word[] = [];
  for (const w of words) {
    const prev = cur[cur.length - 1];
    const breakHere = cur.length >= MAX_WORDS || (prev && (w.start - prev.end > GAP || /[.!?,;:]$/.test(prev.word)));
    if (breakHere && cur.length) {
      out.push({ start: cur[0].start, end: cur[cur.length - 1].end, words: cur });
      cur = [];
    }
    cur.push(w);
  }
  if (cur.length) out.push({ start: cur[0].start, end: cur[cur.length - 1].end, words: cur });
  // tahan potongan sampai potongan berikutnya mulai (maks 0,6 dtk) supaya teks tidak berkedip
  for (let i = 0; i < out.length; i++) {
    const next = out[i + 1]?.start ?? out[i].end + 0.6;
    out[i].end = Math.min(next, out[i].end + 0.6);
  }
  return out;
}

/** Tanpa timing: pecah teks shot jadi potongan MAX_WORDS kata, dibagi rata sepanjang shot. */
export function wordsFromShots(shots: { durationInFrames: number; text: string }[], starts: number[]): Word[] {
  const out: Word[] = [];
  shots.forEach((s, i) => {
    const toks = s.text.split(/\s+/).filter(Boolean);
    if (!toks.length) return;
    const a = starts[i] / FPS + 0.1;
    const b = (starts[i] + s.durationInFrames) / FPS - 0.2;
    const step = (b - a) / toks.length;
    toks.forEach((w, k) => out.push({ word: w, start: a + k * step, end: a + (k + 1) * step - 0.02 }));
  });
  return out;
}

export const Subtitles: React.FC<{
  words?: Word[];
  shots: { durationInFrames: number; text: string }[];
  starts: number[];
  look: SubtitleLook;
}> = ({ words, shots, starts, look }) => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const chunks = useMemo(() => chunkWords(words?.length ? words : wordsFromShots(shots, starts)), [words, shots, starts]);
  const t = f / FPS;
  const c = chunks.find((k) => t >= k.start && t < k.end);
  if (!c) return null;
  // 9:16: ~72 px di 1080x1920; 16:9: ~58 px di 1920x1080
  const size = Math.round(width < height ? height * 0.0375 : height * 0.054);
  const pop = Math.min(1, (t - c.start) / 0.12);
  const strokeW = Math.max(2, Math.round(size * 0.09));
  return (
    <div
      style={{
        position: 'absolute',
        left: width < height ? '8%' : '15%',
        right: width < height ? '8%' : '15%',
        bottom: `${look.bottom * 100}%`,
        textAlign: 'center',
        transform: `scale(${0.92 + 0.08 * pop})`,
      }}
    >
      <span
        style={{
          font: look.font.replace('{s}', String(size)),
          lineHeight: 1.25,
          color: look.color,
          textTransform: look.uppercase ? 'uppercase' : 'none',
          WebkitTextStroke: look.stroke === 'transparent' ? undefined : `${strokeW}px ${look.stroke}`,
          paintOrder: 'stroke fill',
          textShadow: look.box ? 'none' : `0 ${Math.round(size * 0.06)}px ${Math.round(size * 0.12)}px rgba(0,0,0,0.55)`,
          background: look.box ?? undefined,
          padding: look.box ? `${size * 0.15}px ${size * 0.35}px` : undefined,
          borderRadius: look.box ? size * 0.25 : undefined,
          boxDecorationBreak: 'clone',
          WebkitBoxDecorationBreak: 'clone',
        }}
      >
        {c.words.map((w, i) => (
          <span key={i} style={{ color: t >= w.start && t <= w.end + 0.05 ? look.highlight : undefined }}>
            {w.word}
            {i < c.words.length - 1 ? ' ' : ''}
          </span>
        ))}
      </span>
    </div>
  );
};
