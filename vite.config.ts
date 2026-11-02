import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

// CSP hanya di build: saat dev, React Fast Refresh butuh script inline.
const csp = {
  name: 'anima-csp',
  apply: 'build' as const,
  transformIndexHtml: (html: string) =>
    html.replace(
      '<meta charset="UTF-8" />',
      `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co" />`,
    ),
};

export default defineConfig({
  // Path relatif supaya dist/index.html bisa dibuka Electron lewat file://
  base: './',
  plugins: [react(), tailwindcss(), csp],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  server: { port: 5173, strictPort: true },
  build: {
    target: 'chrome120',
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 600,
  },
});
