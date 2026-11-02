// Uji cepat: apakah three.js + Remotion (dan EffectComposer) bisa menggambar di laptop ini.
// Props { composer: true } menambahkan EffectComposer + tone mapping seperti template bridge.
import React from 'react';
import { AbsoluteFill, getInputProps, useCurrentFrame } from 'remotion';
import { ThreeCanvas } from '@remotion/three';
import { EffectComposer, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';

export const TestBox: React.FC = () => {
  const f = useCurrentFrame();
  const composer = Boolean((getInputProps() as { composer?: boolean }).composer);
  return (
    <AbsoluteFill style={{ background: '#cfe3f2' }}>
      <ThreeCanvas width={1080} height={1920} camera={{ fov: 40, position: [0, 0, 6] }} gl={{ preserveDrawingBuffer: true }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 5, 4]} intensity={1.5} />
        <mesh rotation={[0.5, f * 0.05, 0]}>
          <boxGeometry args={[2, 2, 2]} />
          <meshStandardMaterial color="#e5533d" />
        </mesh>
        {composer && (
          <EffectComposer multisampling={4}>
            <ToneMapping mode={ToneMappingMode.NEUTRAL} />
          </EffectComposer>
        )}
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
