#!/usr/bin/env node
// Render frame demi frame (tanpa drop frame) lalu jadi MP4.
//   node tools/render.mjs <proyek>/index.html --out <proyek>/hasil/video.mp4 [--audio <proyek>/audio/mix.wav]
//        [--workers 3] [--scale 1] [--from 0 --to 5] [--crf 18]
// --scale 0.5 untuk uji cepat. --from/--to untuk merender sebagian (cek sebelum render penuh).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { args, launchBrowser, ffmpeg, loadPuppeteer, openScene, pageUrl, seek, serve } from './_lib.mjs';

const { pos, opt } = args();
const html = pos[0];
if (!html || !opt.out) {
  console.error('pakai: node tools/render.mjs <proyek>/index.html --out hasil/video.mp4 [--audio mix.wav] [--workers 3] [--scale 1] [--from s --to s]');
  process.exit(2);
}
const out = path.resolve(opt.out);
const scale = Number(opt.scale) || 1;
const workers = Math.max(1, Math.min(8, Number(opt.workers) || Math.min(3, Math.max(1, os.cpus().length >> 2))));
const puppeteer = loadPuppeteer();
const srv = await serve();
const url = pageUrl(srv.url, html, '?render=1');
const t0 = Date.now();

const browser = await launchBrowser(puppeteer);
const extra = [];
let info;
try {
  const first = await openScene(browser, url, scale);
  info = first.info;
  const from = Math.max(0, Number(opt.from) || 0);
  const to = Math.min(info.duration, opt.to !== undefined ? Number(opt.to) : info.duration);
  const total = Math.max(1, Math.round((to - from) * info.fps));
  const frames = path.join(path.dirname(out), `.frames-${path.basename(out, '.mp4')}`);
  fs.rmSync(frames, { recursive: true, force: true });
  fs.mkdirSync(frames, { recursive: true });
  console.log(`${total} frame @ ${info.fps} fps (${from}-${to}s), ${Math.round(info.width * scale)}x${Math.round(info.height * scale)}, ${workers} proses`);

  // satu browser per proses: tiap halaman tetap "terlihat" sehingga gambar selalu diperbarui
  const pages = [first.page];
  for (let i = 1; i < workers; i++) {
    const b = await launchBrowser(puppeteer);
    extra.push(b);
    pages.push((await openScene(b, url, scale)).page);
  }
  let done = 0;
  await Promise.all(
    pages.map(async (page, w) => {
      for (let i = w; i < total; i += workers) {
        await seek(page, from + i / info.fps);
        await page.screenshot({ path: path.join(frames, `f${String(i).padStart(5, '0')}.png`), type: 'png' });
        done++;
        if (done % info.fps === 0) process.stdout.write(`\r${done}/${total}`);
      }
    }),
  );
  process.stdout.write(`\r${total}/${total} frame dalam ${((Date.now() - t0) / 1000).toFixed(1)} dtk\n`);

  fs.mkdirSync(path.dirname(out), { recursive: true });
  const audio = opt.audio ? path.resolve(opt.audio) : null;
  const a = audio && fs.existsSync(audio) ? ['-ss', String(from), '-t', String(to - from), '-i', audio] : [];
  const r = ffmpeg([
    '-framerate', String(info.fps), '-i', path.join(frames, 'f%05d.png'), ...a,
    '-c:v', 'libx264', '-crf', String(opt.crf ?? 18), '-preset', 'medium', '-pix_fmt', 'yuv420p',
    ...(a.length ? ['-c:a', 'aac', '-b:a', '192k', '-map', '0:v:0', '-map', '1:a:0', '-af', 'apad', '-t', String(to - from)] : []),
    '-movflags', '+faststart', out,
  ]);
  if (r.status !== 0) {
    console.error(r.stderr.split('\n').slice(-6).join('\n'));
    process.exit(1);
  }
  if (!opt.keep) fs.rmSync(frames, { recursive: true, force: true });
  if (audio && !a.length) console.warn(`audio tidak ditemukan: ${audio} (video tanpa suara)`);
  console.log(`selesai: ${out} (${((Date.now() - t0) / 1000).toFixed(1)} dtk total)`);
} finally {
  await Promise.all([browser, ...extra].map((b) => b.close()));
  srv.close();
}
