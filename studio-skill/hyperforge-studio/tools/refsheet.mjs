#!/usr/bin/env node
// Bongkar video referensi: angka (durasi, rasio, fps, jumlah potongan, rata-rata detik per shot) +
// lembar kontak satu gambar per shot + audio untuk dihitung kecepatan narasinya.
//   node tools/refsheet.mjs <referensi.mp4> <proyek> [--threshold 0.2] [--max 40]
// Hasil: <proyek>/referensi/ref_sheet.png, ref_stats.json, ref_audio.mp3
// Kecepatan narasi: transkrip ref_audio.mp3 dengan alat MCP anima_vibi_words, lalu kata per menit = kata / durasi * 60.
import fs from 'node:fs';
import path from 'node:path';
import { args, launchBrowser, contactSheet, ffmpeg, fmtT, loadPuppeteer } from './_lib.mjs';

const { pos, opt } = args();
const [video, proj] = pos;
if (!video || !proj || !fs.existsSync(video)) {
  console.error('pakai: node tools/refsheet.mjs <referensi.mp4> <proyek> [--threshold 0.2] [--max 40]');
  process.exit(2);
}
const out = path.join(proj, 'referensi');
fs.mkdirSync(out, { recursive: true });

const head = ffmpeg(['-i', video]).stderr;
const dm = head.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
const duration = dm ? Number(dm[1]) * 3600 + Number(dm[2]) * 60 + Number(dm[3]) : 0;
const vm = head.match(/Video:.*?(\d{2,5})x(\d{2,5})/);
const fps = Number(head.match(/([\d.]+)\s*fps/)?.[1]) || null;
const width = vm ? Number(vm[1]) : 0;
const height = vm ? Number(vm[2]) : 0;

// potongan shot: perubahan gambar besar antar frame
const th = Number(opt.threshold) || 0.2;
const sc = ffmpeg(['-i', video, '-vf', `scale=320:-2,select='gt(scene,${th})',showinfo`, '-an', '-f', 'null', '-']).stderr;
const cuts = [...sc.matchAll(/pts_time:([\d.]+)/g)].map((m) => Number(m[1])).filter((t, i, a) => i === 0 || t - a[i - 1] > 0.25);
const starts = [0, ...cuts];
const shots = starts.map((s, i) => ({ dari: +s.toFixed(2), sampai: +(starts[i + 1] ?? duration).toFixed(2) }));
const lens = shots.map((s) => s.sampai - s.dari);

// lembar kontak: tengah tiap shot (maks --max)
const max = Number(opt.max) || 40;
const pick = shots.length > max ? shots.filter((_, i) => i % Math.ceil(shots.length / max) === 0) : shots;
const imgs = [];
for (const s of pick) {
  const t = (s.dari + s.sampai) / 2;
  const r = ffmpeg(['-v', 'error', '-ss', t.toFixed(3), '-i', video, '-frames:v', '1', '-vf', `scale=${width > height ? 400 : 240}:-2`, '-f', 'image2pipe', '-c:v', 'png', '-'], { encoding: 'buffer' });
  if (r.stdout?.length) imgs.push({ b: r.stdout, label: `${fmtT(s.dari)} (${(s.sampai - s.dari).toFixed(1)}s)` });
}
const puppeteer = loadPuppeteer();
const browser = await launchBrowser(puppeteer);
try {
  await contactSheet(browser, imgs.map((x) => x.b), imgs.map((x) => x.label), path.join(out, 'ref_sheet.png'), {
    cols: width > height ? 4 : 8,
    cellWidth: width > height ? 300 : 150,
    title: `${path.basename(video)} · ${duration.toFixed(1)} dtk · ${shots.length} shot`,
  });
} finally {
  await browser.close();
}

// audio untuk transkrip (kecepatan narasi + pola naskah)
ffmpeg(['-v', 'error', '-i', video, '-vn', '-ac', '1', '-ar', '22050', '-b:a', '64k', path.join(out, 'ref_audio.mp3')]);

const stats = {
  file: path.basename(video),
  durasi: +duration.toFixed(2),
  ukuran: `${width}x${height}`,
  rasio: width && height ? (width > height ? '16:9' : width === height ? '1:1' : '9:16') : null,
  fps,
  jumlahShot: shots.length,
  rataDetikPerShot: +(lens.reduce((a, b) => a + b, 0) / Math.max(1, lens.length)).toFixed(2),
  shotTerpendek: +Math.min(...lens).toFixed(2),
  shotTerpanjang: +Math.max(...lens).toFixed(2),
  shots,
};
fs.writeFileSync(path.join(out, 'ref_stats.json'), JSON.stringify(stats, null, 1));
console.log(JSON.stringify({ ...stats, shots: `${shots.length} shot (lihat ref_stats.json)` }, null, 1));
console.log(`lembar kontak: ${path.join(out, 'ref_sheet.png')}\naudio: ${path.join(out, 'ref_audio.mp3')} (transkrip dengan anima_vibi_words untuk kata per menit)`);
