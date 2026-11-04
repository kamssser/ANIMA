#!/usr/bin/env node
// Cek video jadi sebelum dikirim: 6 frame (awal, tengah, akhir + 3 momen) + kerasnya suara.
//   node tools/check.mjs <video.mp4> <out.png> [--at 5.2,14,27.5]
import fs from 'node:fs';
import { args, launchBrowser, contactSheet, ffmpeg, fmtT, loadPuppeteer } from './_lib.mjs';

const { pos, opt } = args();
const [video, out] = pos;
if (!video || !out || !fs.existsSync(video)) {
  console.error('pakai: node tools/check.mjs <video.mp4> <out.png> [--at 5.2,14,27.5]');
  process.exit(2);
}
const head = ffmpeg(['-i', video]).stderr;
const dm = head.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
const dur = dm ? Number(dm[1]) * 3600 + Number(dm[2]) * 60 + Number(dm[3]) : 0;
const vm = head.match(/Video:.*?(\d{2,5})x(\d{2,5})/);
const wide = vm && Number(vm[1]) > Number(vm[2]);
const at = opt.at ? String(opt.at).split(',').map(Number) : [dur * 0.3, dur * 0.55, dur * 0.8];
const times = [0.3, ...at, dur / 2, dur - 0.4].filter((t, i, a) => a.indexOf(t) === i).sort((a, b) => a - b).slice(0, 6);
const imgs = times.map((t) => ffmpeg(['-v', 'error', '-ss', t.toFixed(3), '-i', video, '-frames:v', '1', '-vf', `scale=${wide ? 480 : 270}:-2`, '-f', 'image2pipe', '-c:v', 'png', '-'], { encoding: 'buffer' }).stdout);
const loud = ffmpeg(['-nostats', '-i', video, '-vn', '-af', 'loudnorm=print_format=json', '-f', 'null', '-']).stderr;
let lufs = null;
let peak = null;
try {
  const j = JSON.parse(loud.slice(loud.lastIndexOf('{'), loud.lastIndexOf('}') + 1));
  lufs = Number(j.input_i);
  peak = Number(j.input_tp);
} catch {
  /* tanpa audio */
}
const puppeteer = loadPuppeteer();
const browser = await launchBrowser(puppeteer);
try {
  await contactSheet(browser, imgs.filter(Boolean), times.map(fmtT), out, { cols: wide ? 3 : 6, cellWidth: wide ? 400 : 220, title: `${video} · ${dur.toFixed(1)} dtk · ${lufs != null ? `${lufs.toFixed(1)} LUFS, puncak ${peak.toFixed(1)} dB` : 'tanpa audio'}` });
} finally {
  await browser.close();
}
console.log(`durasi ${dur.toFixed(1)} dtk; suara ${lufs != null ? `${lufs.toFixed(1)} LUFS (target -14), puncak ${peak.toFixed(1)} dB (aman <= -1)` : 'TIDAK ADA'}; lembar: ${out}`);
console.log('Lihat lembarnya: subtitle terbaca dan tidak tertutup area tombol, tidak ada yang terpotong, warna karakter sesuai karakter.md.');
