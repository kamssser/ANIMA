// Teks branding pengguna (nama kanal/akun sosmed) kecil di tengah paling bawah, sepanjang video.
import React from 'react';
import { useVideoConfig } from 'remotion';

export const Brand: React.FC<{ text?: string }> = ({ text }) => {
  const { width, height } = useVideoConfig();
  if (!text || !text.trim()) return null;
  const s = Math.min(width, height);
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: Math.round(height * 0.018),
        textAlign: 'center',
        font: `600 ${Math.round(s * 0.024)}px "Segoe UI", Arial, sans-serif`,
        letterSpacing: '0.02em',
        color: 'rgba(255,255,255,0.78)',
        textShadow: '0 1px 3px rgba(0,0,0,0.75)',
        whiteSpace: 'nowrap',
      }}
    >
      {text.trim()}
    </div>
  );
};
