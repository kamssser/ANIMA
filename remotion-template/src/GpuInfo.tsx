// Diagnostik: cetak GPU yang dipakai WebGL saat render (lihat log --log=verbose).
import React, { useEffect } from 'react';
import { AbsoluteFill } from 'remotion';

export const GpuInfo: React.FC = () => {
  useEffect(() => {
    const gl = document.createElement('canvas').getContext('webgl2') as WebGL2RenderingContext | null;
    if (!gl) {
      console.log('ANIMA_GPU: WebGL2 tidak tersedia');
      return;
    }
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const vendor = ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
    const renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    console.log(`ANIMA_GPU: ${vendor} | ${renderer}`);
  }, []);
  return <AbsoluteFill style={{ background: '#000' }} />;
};
