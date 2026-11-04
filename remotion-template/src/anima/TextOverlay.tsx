// Lapisan teks wajib untuk video 3D: video hasil render 3D (disalin aplikasi ke public/anima-tmp/)
// ditimpa teks per kata. Render tahap kedua ini ringan (~0,1 dtk/frame), jadi scene 3D tidak dirender ulang.
import React from 'react';
import { AbsoluteFill, OffthreadVideo, staticFile } from 'remotion';
import { Subtitles } from './Subtitles';
import { Brand } from './Brand';
import { styleLook } from './styles';
import type { Word } from './types';

export type TextOverlayProps = {
  /** path relatif terhadap public/, mis. "anima-tmp/video.mp4" */
  video: string;
  durationInFrames: number;
  width: number;
  height: number;
  words?: Word[];
  shots: { durationInFrames: number; text: string }[];
  look?: string;
  /** teks branding pengguna (nama kanal), kecil di tengah bawah */
  brand?: string;
};

export const TextOverlay: React.FC<TextOverlayProps> = ({ video, words, shots, look, brand }) => {
  let at = 0;
  const starts = shots.map((s) => {
    const a = at;
    at += s.durationInFrames;
    return a;
  });
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {video && <OffthreadVideo src={staticFile(video)} muted />}
      <Subtitles words={words} shots={shots} starts={starts} look={styleLook(look ?? 'manhwa').subtitle} />
      <Brand text={brand} />
    </AbsoluteFill>
  );
};
