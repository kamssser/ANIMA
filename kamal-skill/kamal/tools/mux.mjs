#!/usr/bin/env node
// Ganti / tambah audio sebuah video tanpa render ulang gambar.
//   node tools/mux.mjs <video.mp4> <audio.wav|mp3> <out.mp4>
import fs from 'node:fs';
import { ffmpeg } from './_lib.mjs';

const [video, audio, out] = process.argv.slice(2);
if (!video || !audio || !out || !fs.existsSync(video) || !fs.existsSync(audio)) {
  console.error('pakai: node tools/mux.mjs <video.mp4> <audio> <out.mp4>');
  process.exit(2);
}
const probe = ffmpeg(['-i', video]).stderr.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
const dur = probe ? Number(probe[1]) * 3600 + Number(probe[2]) * 60 + Number(probe[3]) : null;
const r = ffmpeg(['-i', video, '-i', audio, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-af', 'apad', ...(dur ? ['-t', String(dur)] : []), '-movflags', '+faststart', out]);
if (r.status !== 0) {
  console.error(r.stderr.split('\n').slice(-6).join('\n'));
  process.exit(1);
}
console.log(`selesai: ${out}`);
