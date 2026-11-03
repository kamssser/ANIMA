#!/usr/bin/env node
// Potret satu frame halaman dalam resolusi penuh (thumbnail / cover), plus versi kecil untuk cek keterbacaan.
//   node tools/thumb.mjs <proyek>/thumbnail.html <proyek>/hasil/thumbnail.png [--t 0] [--jpg]
// Halaman memakai HF.setup seperti adegan biasa (ukuran = width/height di HF.setup; YouTube 1280x720, cover 1080x1920).
// Hasil tambahan: <out>_kecil.png (lebar 320 px) = kira-kira sebesar thumbnail di daftar video HP. Lihat yang kecil:
// judul harus tetap terbaca dan wajah tokoh tetap jelas.
import fs from 'node:fs';
import { args, launchBrowser, loadPuppeteer, openScene, pageUrl, seek, serve } from './_lib.mjs';

const { pos, opt } = args();
const [html, out] = pos;
if (!html || !out) {
  console.error('pakai: node tools/thumb.mjs <proyek>/thumbnail.html <out.png> [--t 0] [--jpg]');
  process.exit(2);
}
const puppeteer = loadPuppeteer();
const srv = await serve();
const browser = await launchBrowser(puppeteer);
try {
  const { page, info, errors } = await openScene(browser, pageUrl(srv.url, html, '?render=1'), 1);
  await seek(page, Number(opt.t) || 0);
  const jpg = Boolean(opt.jpg) || /\.jpe?g$/i.test(out);
  fs.mkdirSync(out.replace(/[\\/][^\\/]+$/, '') || '.', { recursive: true });
  await page.screenshot({ path: out, type: jpg ? 'jpeg' : 'png', ...(jpg ? { quality: 92 } : {}) });
  // versi kecil untuk cek keterbacaan
  await page.setViewport({ width: 320, height: Math.round((320 * info.height) / info.width), deviceScaleFactor: 1 });
  const small = out.replace(/(\.\w+)$/, '_kecil$1');
  await page.evaluate((w, h) => {
    const c = document.querySelector('canvas');
    if (c) Object.assign(c.style, { width: `${w}px`, height: `${h}px` });
  }, 320, Math.round((320 * info.height) / info.width));
  await page.screenshot({ path: small, type: jpg ? 'jpeg' : 'png' });
  const kb = Math.round(fs.statSync(out).size / 1024);
  console.log(`thumbnail: ${out} (${info.width}x${info.height}, ${kb} KB) + cek kecil: ${small}`);
  if (kb > 2000 && /youtube|thumbnail/i.test(out)) console.warn('peringatan: YouTube membatasi thumbnail 2 MB; simpan sebagai .jpg (--jpg)');
  if (errors.length) console.warn('peringatan dari halaman:\n  ' + errors.slice(0, 5).join('\n  '));
} finally {
  await browser.close();
  srv.close();
}
