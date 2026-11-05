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
      `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' https: blob:; connect-src 'self' https://*.supabase.co wss://*.supabase.co" />`,
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
    // Pustaka besar dipisah dari kode aplikasi: bundle utama kecil, dan update aplikasi tidak mengubah file vendor.
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'vendor-react', test: /node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/, priority: 3 },
            { name: 'vendor-supabase', test: /node_modules[\\/](@supabase|iceberg-js|tslib)[\\/]/, priority: 2 },
            { name: 'vendor-ui', test: /node_modules[\\/](@radix-ui|radix-ui|sonner|lucide-react|tailwind-merge|clsx|class-variance-authority|react-remove-scroll[\w-]*)[\\/]/, priority: 1 },
          ],
        },
      },
    },
  },
});
