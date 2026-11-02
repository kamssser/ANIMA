import React from 'react';
import { Composition } from 'remotion';
import { BridgeShort, BRIDGE_FRAMES } from './videos/bridge/Bridge';
import { TestBox } from './TestBox';
import { GpuInfo } from './GpuInfo';

// Setiap video baru: salin src/videos/bridge ke src/videos/<nama>, lalu daftarkan komposisinya di sini
// (lihat SKILL.md langkah 4). Nama komposisi = kolom "Nama komposisi Remotion" di ANIMA Studio.
export const Root: React.FC = () => (
  <>
    <Composition id="BridgeShort" component={BridgeShort} durationInFrames={BRIDGE_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="TestBox" component={TestBox} durationInFrames={60} fps={30} width={1080} height={1920} />
    <Composition id="GpuInfo" component={GpuInfo} durationInFrames={1} fps={30} width={64} height={64} />
  </>
);
