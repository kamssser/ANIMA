#!/usr/bin/env node
// Musik latar + efek suara dibuat dari kode (aman lisensi). Deterministik.
//   node tools/score.mjs <proyek>/audio/score.json
// score.json:
// {
//   "durasi": 40, "bpm": 96, "kunci": "D", "mood": "tenang" | "ceria" | "tegang" | "misteri" | "hangat",
//   "bagian": [ { "dari": 0, "sampai": 6, "energi": 0.3 }, { "dari": 6, "sampai": 34, "energi": 0.6 }, { "dari": 34, "sampai": 40, "energi": 0.9 } ],
//   "hening": [ { "dari": 31.5, "sampai": 32.4 } ],        // jeda sebelum punchline (opsional)
//   "sfx": [ { "t": 1.2, "jenis": "pop" }, { "t": 8.0, "jenis": "whoosh" } ]
//      jenis: pop | whoosh | ding | klik | thud | sparkle | riser | swoosh-up | boing | tik
// }
// Hasil di folder yang sama: musik.wav, sfx.wav (48 kHz stereo). Gabungkan dengan tools/mix.mjs.
import fs from 'node:fs';
import path from 'node:path';

const file = process.argv[2];
if (!file || !fs.existsSync(file)) {
  console.error('pakai: node tools/score.mjs <proyek>/audio/score.json');
  process.exit(2);
}
const S = JSON.parse(fs.readFileSync(file, 'utf8'));
const SR = 48000;
const DUR = Number(S.durasi) || 30;
const N = Math.ceil(DUR * SR);
const L = new Float32Array(N);
const R = new Float32Array(N);
const FL = new Float32Array(N);
const FR = new Float32Array(N);

let seed = 12345;
const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const root = 48 + (NOTE[S.kunci] ?? 2); // oktaf bawah
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const MOODS = {
  tenang: { scale: [0, 2, 4, 7, 9], prog: [[0, 4, 7], [-3, 0, 4], [5, 9, 12], [7, 11, 14]], pluck: 0.5, pad: 0.6 },
  ceria: { scale: [0, 2, 4, 5, 7, 9, 11], prog: [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]], pluck: 0.8, pad: 0.4 },
  hangat: { scale: [0, 2, 4, 7, 9], prog: [[0, 4, 7, 11], [5, 9, 12, 16], [-3, 0, 4, 7], [7, 11, 14, 17]], pluck: 0.6, pad: 0.7 },
  tegang: { scale: [0, 2, 3, 7, 8], prog: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -1, 2]], pluck: 0.7, pad: 0.6 },
  misteri: { scale: [0, 1, 3, 7, 8], prog: [[0, 3, 7], [1, 5, 8], [-4, 0, 3], [-2, 1, 5]], pluck: 0.4, pad: 0.8 },
};
const M = MOODS[S.mood] ?? MOODS.tenang;
const bpm = Number(S.bpm) || 96;
const beat = 60 / bpm;
const energyAt = (t) => (S.bagian || []).find((b) => t >= b.dari && t < b.sampai)?.energi ?? 0.5;
const silentAt = (t) => (S.hening || []).some((h) => t >= h.dari && t < h.sampai);

function add(buf, buf2, start, samples, gain = 1, pan = 0) {
  const i0 = Math.floor(start * SR);
  const gl = gain * Math.cos(((pan + 1) * Math.PI) / 4);
  const gr = gain * Math.sin(((pan + 1) * Math.PI) / 4);
  for (let i = 0; i < samples.length; i++) {
    const j = i0 + i;
    if (j < 0 || j >= N) continue;
    buf[j] += samples[i] * gl;
    buf2[j] += samples[i] * gr;
  }
}
const env = (n, a, d) => (i) => Math.min(1, i / Math.max(1, a * SR)) * Math.exp(-i / Math.max(1, d * SR));

// pad: akord per 2 bar, sinus + sedikit detune, attack lambat
const bar = beat * 4;
for (let k = 0, t = 0; t < DUR; k++, t += bar * 2) {
  const ch = M.prog[k % M.prog.length];
  const len = Math.min(bar * 2 + 0.5, DUR - t + 0.5);
  const n = Math.floor(len * SR);
  const s = new Float32Array(n);
  for (const iv of ch) {
    const f = hz(root + 12 + iv);
    for (let i = 0; i < n; i++) {
      const tt = i / SR;
      const a = Math.min(1, tt / 0.8) * Math.min(1, (len - tt) / 0.6);
      s[i] += a * 0.06 * (Math.sin(2 * Math.PI * f * tt) + 0.5 * Math.sin(2 * Math.PI * f * 1.003 * tt) + 0.25 * Math.sin(2 * Math.PI * f * 2 * tt));
    }
  }
  add(L, R, t, s, M.pad, 0);
  // bass akar
  const fb = hz(root + ch[0]);
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const tt = i / SR;
    b[i] = 0.12 * Math.min(1, tt / 0.05) * Math.min(1, (len - tt) / 0.3) * Math.sin(2 * Math.PI * fb * tt);
  }
  add(L, R, t, b, 0.8, 0);
}
// pluck arpeggio per 8th, makin rapat saat energi tinggi
for (let t = 0, i = 0; t < DUR; t += beat / 2, i++) {
  const e = energyAt(t);
  if (e < 0.25 || silentAt(t) || (e < 0.5 && i % 2)) continue;
  const ch = M.prog[Math.floor(t / (bar * 2)) % M.prog.length];
  const m = root + 24 + ch[i % ch.length] + (i % 8 >= 6 ? 12 : 0);
  const f = hz(m);
  const n = Math.floor(0.5 * SR);
  const s = new Float32Array(n);
  const e1 = env(n, 0.004, 0.18);
  for (let j = 0; j < n; j++) {
    const tt = j / SR;
    s[j] = e1(j) * (Math.sin(2 * Math.PI * f * tt) + 0.3 * Math.sin(2 * Math.PI * 2 * f * tt) * Math.exp(-tt * 8));
  }
  add(L, R, t, s, 0.07 * M.pluck * (0.6 + e * 0.6), ((i % 4) - 1.5) * 0.25);
}
// ketukan lembut saat energi tinggi
for (let t = 0, i = 0; t < DUR; t += beat, i++) {
  const e = energyAt(t);
  if (silentAt(t)) continue;
  if (e >= 0.55) {
    const n = Math.floor(0.25 * SR);
    const s = new Float32Array(n);
    for (let j = 0; j < n; j++) {
      const tt = j / SR;
      s[j] = Math.exp(-tt * 18) * Math.sin(2 * Math.PI * (50 + 90 * Math.exp(-tt * 30)) * tt);
    }
    add(L, R, t, s, 0.35 * e, 0);
  }
  if (e >= 0.75) {
    for (const off of [0, beat / 2]) {
      const n = Math.floor(0.06 * SR);
      const s = new Float32Array(n);
      for (let j = 0; j < n; j++) s[j] = (rnd() * 2 - 1) * Math.exp(-(j / SR) * 60);
      add(L, R, t + off + beat / 4, s, 0.05 * e, 0.3);
    }
  }
}

// ---------- efek suara ----------
function sfx(kind) {
  const len = { pop: 0.18, whoosh: 0.6, ding: 1.2, klik: 0.05, thud: 0.4, sparkle: 0.9, riser: 1.6, 'swoosh-up': 0.5, boing: 0.6, tik: 0.04 }[kind] ?? 0.3;
  const n = Math.floor(len * SR);
  const s = new Float32Array(n);
  let lp = 0;
  for (let j = 0; j < n; j++) {
    const t = j / SR;
    const u = t / len;
    const w = rnd() * 2 - 1;
    switch (kind) {
      case 'pop': s[j] = Math.exp(-t * 30) * Math.sin(2 * Math.PI * (900 - 600 * u) * t); break;
      case 'whoosh': case 'swoosh-up': {
        const c = kind === 'whoosh' ? 0.05 + 0.25 * Math.sin(Math.PI * u) : 0.03 + 0.3 * u;
        lp += c * (w - lp);
        s[j] = lp * Math.sin(Math.PI * u) * 1.6;
        break;
      }
      case 'ding': s[j] = Math.exp(-t * 4) * (Math.sin(2 * Math.PI * 1320 * t) + 0.4 * Math.sin(2 * Math.PI * 2640 * t)) * 0.6; break;
      case 'klik': case 'tik': s[j] = w * Math.exp(-t * (kind === 'tik' ? 300 : 150)); break;
      case 'thud': s[j] = Math.exp(-t * 12) * Math.sin(2 * Math.PI * (40 + 80 * Math.exp(-t * 25)) * t); break;
      case 'sparkle': s[j] = Math.exp(-t * 5) * [2093, 2637, 3136, 4186].reduce((a, f, k) => a + (t > k * 0.08 ? Math.sin(2 * Math.PI * f * t) * Math.exp(-(t - k * 0.08) * 9) : 0), 0) * 0.3; break;
      case 'riser': lp += 0.02 * (w - lp); s[j] = (lp * 2 + 0.3 * Math.sin(2 * Math.PI * (200 + 800 * u * u) * t)) * u * u; break;
      case 'boing': s[j] = Math.exp(-t * 6) * Math.sin(2 * Math.PI * (300 + 120 * Math.sin(2 * Math.PI * 9 * t)) * t); break;
      default: s[j] = 0;
    }
  }
  return s;
}
for (const x of S.sfx || []) add(FL, FR, Number(x.t) || 0, sfx(x.jenis), Number(x.gain ?? 0.5), Number(x.pan ?? 0));

// fade in/out musik + hening
for (let i = 0; i < N; i++) {
  const t = i / SR;
  let g = Math.min(1, t / 1.0) * Math.min(1, (DUR - t) / 1.5);
  if (silentAt(t)) g *= 0.05;
  L[i] *= g;
  R[i] *= g;
}

function writeWav(out, l, r) {
  let peak = 1e-9;
  for (let i = 0; i < l.length; i++) peak = Math.max(peak, Math.abs(l[i]), Math.abs(r[i]));
  const k = peak > 0.89 ? 0.89 / peak : 1;
  const buf = Buffer.alloc(44 + l.length * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + l.length * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(l.length * 4, 40);
  for (let i = 0; i < l.length; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, l[i] * k)) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, r[i] * k)) * 32767), 46 + i * 4);
  }
  fs.writeFileSync(out, buf);
}
const dir = path.dirname(file);
writeWav(path.join(dir, 'musik.wav'), L, R);
writeWav(path.join(dir, 'sfx.wav'), FL, FR);
console.log(`musik.wav + sfx.wav (${DUR}s, ${bpm} BPM, ${S.mood ?? 'tenang'}, ${(S.sfx || []).length} efek) di ${dir}`);
