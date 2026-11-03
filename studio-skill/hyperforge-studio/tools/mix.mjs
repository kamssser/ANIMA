#!/usr/bin/env node
// Gabung suara narasi + musik (mengecil otomatis saat narasi) + efek suara, lalu normalkan untuk HP (-14 LUFS).
//   node tools/mix.mjs <proyek>/audio [--vo vo.mp3] [--musik -10] [--sfx -4]
// Hasil: mix.wav (lengkap) dan mix_tanpa_musik.wav (narasi + efek saja) di folder audio.
import fs from 'node:fs';
import path from 'node:path';
import { args, ffmpeg } from './_lib.mjs';

const { pos, opt } = args();
const dir = pos[0];
if (!dir || !fs.existsSync(dir)) {
  console.error('pakai: node tools/mix.mjs <proyek>/audio [--vo vo.mp3] [--musik -10] [--sfx -4]');
  process.exit(2);
}
const f = (n) => path.join(dir, n);
const vo = f(opt.vo || 'vo.mp3');
const hasVo = fs.existsSync(vo);
const hasM = fs.existsSync(f('musik.wav'));
const hasS = fs.existsSync(f('sfx.wav'));
if (!hasVo && !hasM) {
  console.error('Tidak ada vo.mp3 maupun musik.wav di folder audio.');
  process.exit(2);
}
const mdb = Number(opt.musik ?? -10);
const sdb = Number(opt.sfx ?? -4);
const norm = 'loudnorm=I=-14:TP=-1.5:LRA=9';

function mix(out, withMusic) {
  const inputs = [];
  const labels = [];
  let g = '';
  if (hasVo) {
    inputs.push('-i', vo);
    g += `[${inputs.length / 2 - 1}:a]aresample=48000,aformat=channel_layouts=stereo,asplit=2[vo][key];`;
  }
  if (withMusic && hasM) {
    inputs.push('-i', f('musik.wav'));
    const i = inputs.length / 2 - 1;
    g += hasVo
      ? `[${i}:a]volume=${mdb}dB[m0];[m0][key]sidechaincompress=threshold=0.03:ratio=6:attack=40:release=450[m];`
      : `[${i}:a]volume=${mdb}dB[m];`;
    labels.push('[m]');
  } else if (hasVo) g += '[key]anullsink;';
  if (hasS) {
    inputs.push('-i', f('sfx.wav'));
    g += `[${inputs.length / 2 - 1}:a]volume=${sdb}dB[s];`;
    labels.push('[s]');
  }
  if (hasVo) labels.unshift('[vo]');
  g += `${labels.join('')}amix=inputs=${labels.length}:duration=longest:normalize=0,${norm}[o]`;
  const r = ffmpeg([...inputs, '-filter_complex', g, '-map', '[o]', '-ar', '48000', '-ac', '2', out]);
  if (r.status !== 0) {
    console.error(r.stderr.split('\n').slice(-6).join('\n'));
    process.exit(1);
  }
}
mix(f('mix.wav'), true);
if (hasVo) mix(f('mix_tanpa_musik.wav'), false);
console.log(`mix.wav${hasVo ? ' + mix_tanpa_musik.wav' : ''} di ${dir} (musik ${mdb} dB${hasVo ? ', mengecil saat narasi' : ''}, efek ${sdb} dB, -14 LUFS)`);
