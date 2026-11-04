#!/usr/bin/env node
// Foto detik-detik kunci jadi satu lembar kontak (untuk look check dan storyboard).
//   node tools/snap.mjs <proyek>/index.html <out.png> 1,3.5,8 [--labels "Shot 1|Shot 2|Shot 3"] [--cols 4] [--scale 0.5]
// Waktu bisa juga diambil dari storyboard: --board <proyek>/storyboard.json  ([{ t, judul }]).
import fs from 'node:fs';
import { args, launchBrowser, contactSheet, fmtT, loadPuppeteer, openScene, pageUrl, seek, serve } from './_lib.mjs';

const { pos, opt } = args();
const [html, out, times0] = pos;
if (!html || !out || (!times0 && !opt.board)) {
  console.error('pakai: node tools/snap.mjs <proyek>/index.html <out.png> 1,3.5,8 [--labels "a|b|c"] [--board storyboard.json] [--cols 4] [--scale 0.5]');
  process.exit(2);
}
let times = times0 ? String(times0).split(',').map(Number) : [];
let labels = opt.labels ? String(opt.labels).split('|') : [];
if (opt.board) {
  const b = JSON.parse(fs.readFileSync(opt.board, 'utf8'));
  times = b.map((x) => Number(x.t));
  labels = b.map((x, i) => `${i + 1}. ${x.judul ?? x.title ?? ''} · ${fmtT(Number(x.t))}`);
}
const puppeteer = loadPuppeteer();
const srv = await serve();
const browser = await launchBrowser(puppeteer);
try {
  const { page, info, errors } = await openScene(browser, pageUrl(srv.url, html, '?render=1'), Number(opt.scale) || 0.5);
  const shots = [];
  for (const t of times) {
    await seek(page, Math.min(t, info.duration - 1 / info.fps));
    shots.push(await page.screenshot({ type: 'png' }));
  }
  const cellWidth = info.width > info.height ? 420 : 240;
  await contactSheet(browser, shots, times.map((t, i) => labels[i] ?? fmtT(t)), out, { cols: Number(opt.cols) || (info.width > info.height ? 3 : 5), cellWidth });
  console.log(`lembar kontak: ${out} (${times.length} frame, ${info.width}x${info.height}, ${info.duration}s @ ${info.fps} fps)`);
  if (errors.length) console.warn('peringatan dari halaman:\n  ' + errors.slice(0, 5).join('\n  '));
} finally {
  await browser.close();
  srv.close();
}
