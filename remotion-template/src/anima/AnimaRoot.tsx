// Komposisi milik aplikasi saja (berdiri sendiri, tidak memuat src/Root.tsx pengguna):
// AnimaComic2D (video 2D dari data) dan AnimaTextOverlay (teks wajib di atas video 3D).
// Video 3D tetap dirender dari entry pengguna (src/index.ts) seperti biasa.
import React from 'react';
import { Composition } from 'remotion';
import { Comic2D, comic2DDuration } from './Comic2D';
import { TextOverlay, type TextOverlayProps } from './TextOverlay';
import { DEMO } from './demo';
import { FPS, sizeOf, type Comic2DProps } from './types';

export const AnimaRoot: React.FC = () => (
  <>
    <Composition
      id="AnimaComic2D"
      component={Comic2D}
      fps={FPS}
      width={1080}
      height={1920}
      durationInFrames={comic2DDuration(DEMO)}
      defaultProps={DEMO}
      calculateMetadata={({ props }: { props: Comic2DProps }) => ({ durationInFrames: comic2DDuration(props), ...sizeOf(props.format) })}
    />
    <Composition
      id="AnimaTextOverlay"
      component={TextOverlay}
      fps={FPS}
      width={1080}
      height={1920}
      durationInFrames={60}
      defaultProps={{ video: '', durationInFrames: 60, width: 1080, height: 1920, shots: [{ durationInFrames: 60, text: 'Contoh teks di layar' }] } as TextOverlayProps}
      calculateMetadata={({ props }: { props: TextOverlayProps }) => ({ durationInFrames: props.durationInFrames, width: props.width, height: props.height })}
    />
  </>
);
