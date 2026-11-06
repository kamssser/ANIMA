#!/usr/bin/env node
// Musik latar + efek suara dibuat dari kode (aman lisensi). Deterministik.
//   node tools/score.mjs <proyek>/audio/score.json
// score.json:
// {
//   "durasi": 40, "bpm": 96, "kunci": "D", "mood": "tenang" | "ceria" | "tegang" | "misteri" | "hangat",
//   "bagian": [ { "dari": 0, "sampai": 6, "energi": 0.3 }, { "dari": 6, "sampai": 34, "energi": 0.6 }, { "dari": 34, "sampai": 40, "energi": 0.9 } ],
//   "hening": [ { "dari": 31.5, "sampai": 32.4 } ],        // jeda sebelum punchline (opsional)
//   "sfx": [ { "t": 1.2, "jenis": "pop" }, { "t": 8.0, "jenis": "whoosh" } ]
//      jenis: pop | whoosh | ding | klik | thud | sparkle | riser | swoosh-up | boing | tik | hembus
//      hembus = desir udara lembut tanpa bunyi "srek" (untuk transisi yang memang perlu suara)
//   HOROR ("mood": "horor"): musik diganti dengung rendah + nada sumbang + kotak musik jarang + gong rendah.
//      jenis sfx horor: detak | stinger | dengung | derit | langkah | ketuk | bisik | angin | jangkrik | tokek | gong | guntur
//                       | jerit | jerit-cowo | tawa-cowo (genderuwo)
//                       | tawa (kuntilanak) | napas (panik) | gesek (biola sumbang, sebelum kejutan) | lolong (anjing) | gemuruh (sub-bass)
//   "suaraHantu": [ { "file": "vo.mp3", "dari": 12.7, "sampai": 14.7, "t": 14.8, "gain": 0.5, "pan": -0.7, "nada": 1.12,
//                     "suara": "cewe" | "cowo", "jerit": true, "tJerit": 17.2, "gainJerit": 0.45 } ]
//      file boleh juga dialog hantu dari anima_vibi_tts speaker hantu-cewe/hantu-cowo (pakai "nada": 1).
//      Setiap suara hantu otomatis diikuti jeritan (jerit / jerit-cowo) kecuali "jerit": false.
//      potongan suara diolah jadi bisikan hantu bergema (butuh ffmpeg)
//   "jantung": [ { "dari": 20, "sampai": 31.5, "bpm0": 70, "bpm1": 140, "gain": 0.6 } ]   // detak jantung makin cepat
//   "ambien": [ { "dari": 0, "sampai": 40, "jenis": "malam" | "hujan" | "angin", "gain": 0.5 } ]  // suasana latar
//   HOROR ("mood": "horor"): musik diganti dengung rendah + nada sumbang + kotak musik jarang + gong rendah.
//      jenis sfx horor: detak | stinger | dengung | derit | langkah | ketuk | bisik | angin | jangkrik | tokek | gong | guntur
//   "jantung": [ { "dari": 20, "sampai": 31.5, "bpm0": 70, "bpm1": 140, "gain": 0.6 } ]   // detak jantung makin cepat
//   "ambien": [ { "dari": 0, "sampai": 40, "jenis": "malam" | "hujan" | "angin", "gain": 0.5 } ]  // suasana latar
//   "transisi": { "jedaMin": 30, "gainMaks": 0.18 }   // opsional: efek transisi (whoosh/swoosh-up/hembus)
//      yang jaraknya < jedaMin detik dari efek transisi sebelumnya dibuang, volumenya dibatasi gainMaks
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

const HOROR = S.mood === 'horor';
if (!HOROR) {
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
}

// ---------- efek suara ----------
// derau halus deterministik untuk getaran suara
const HF_noise = (x) => {
  const i = Math.floor(x);
  const f = x - i;
  const h = (n) => {
    let v = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
    v ^= v >>> 13;
    return (Math.imul(v, 0xc2b2ae35) >>> 0) / 4294967296;
  };
  return h(i) * (1 - f) + h(i + 1) * f;
};
function sfx(kind) {
  const len = { jerit: 1.6, 'jerit-cowo': 1.4, 'tawa-cowo': 1.9, tawa: 2.0, napas: 3.2, gesek: 3.2, lolong: 3.4, gemuruh: 4, detak: 0.5, stinger: 2.6, dengung: 3.2, derit: 1.5, langkah: 0.32, ketuk: 0.95, bisik: 1.9, angin: 4, jangkrik: 2.2, tokek: 0.9, gong: 4.5, guntur: 4.5, pop: 0.18, hembus: 0.9, whoosh: 0.6, ding: 1.2, klik: 0.05, thud: 0.4, sparkle: 0.9, riser: 1.6, 'swoosh-up': 0.5, boing: 0.6, tik: 0.04 }[kind] ?? 0.3;
  const n = Math.floor(len * SR);
  const s = new Float32Array(n);
  let lp = 0;
  let hp = 0;
  let bl = 0;
  let bb = 0;
  let ph = 0;
  const svf = () => {
    let l = 0;
    let b = 0;
    return (x, fc, q) => {
      const f = 2 * Math.sin((Math.PI * Math.min(fc, SR / 6)) / SR);
      l += f * b;
      const h = x - l - q * b;
      b += f * h;
      return b;
    };
  };
  const F1 = svf();
  const F2 = svf();
  const F3 = svf();
  const F4 = svf();
  // band-pass sederhana (state variable filter) untuk bisik
  const bp = (x, fc, q) => {
    const f = 2 * Math.sin((Math.PI * Math.min(fc, SR / 6)) / SR);
    bl += f * bb;
    const h = x - bl - q * bb;
    bb += f * h;
    return bb;
  };
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
      case 'jerit':
      case 'jerit-cowo': {
        // jeritan: nada tinggi bergetar kasar, vokal "aaa", naik lalu turun pecah (cowo: lebih rendah & serak)
        const cw = kind === 'jerit';
        const base = cw ? 1050 : 380;
        const kontur = 1 + 0.28 * Math.sin(Math.PI * Math.min(1, u * 1.6)) - 0.35 * Math.max(0, u - 0.6);
        const getar = 1 + 0.045 * Math.sin(2 * Math.PI * 9 * t) + 0.02 * (HF_noise(t * 40) - 0.5);
        const f0 = base * kontur * getar;
        ph += f0 / SR;
        const saw = ((ph % 1) * 2 - 1);
        const src = Math.sign(saw) * Math.pow(Math.abs(saw), cw ? 0.8 : 0.6) + w * (cw ? 0.18 : 0.35);
        const vok = F1(src, cw ? 950 : 700, 0.25) * 1.0 + F2(src, cw ? 1500 : 1150, 0.2) * 0.8 + F3(src, cw ? 3000 : 2500, 0.25) * 0.45;
        const env = Math.min(1, t / 0.04) * (u < 0.7 ? 1 : Math.pow(1 - (u - 0.7) / 0.3, 1.5));
        s[j] = vok * env * 0.8;
        break;
      }
      case 'tawa-cowo': {
        // tawa berat "ho-ho-ho" (genderuwo): suku kata rendah, vokal "o"
        const t0 = t - 0.05;
        const k = Math.floor(t0 / 0.28);
        const x = t0 - k * 0.28;
        if (t0 < 0 || k >= 6) { s[j] = 0; break; }
        const f0 = (150 - k * 6) * (1 + 0.03 * Math.sin(2 * Math.PI * 6 * t));
        ph += f0 / SR;
        const src = ((ph % 1) * 2 - 1) + w * 0.2;
        const hEnv = x < 0.05 ? Math.sin((Math.PI * x) / 0.05) : 0;
        const vEnv = x >= 0.04 && x < 0.24 ? Math.min(1, (x - 0.04) / 0.02) * Math.exp(-(x - 0.04) * 6) : 0;
        const voiced = F1(src, 480, 0.3) * 1.0 + F2(src, 850, 0.25) * 0.7 + F3(src, 2400, 0.3) * 0.2;
        s[j] = (voiced * vEnv + F4(w, 1200, 0.5) * hEnv * 0.4) * 0.9;
        break;
      }
      case 'tawa': {
        // tawa kuntilanak "hi-hi-hi": suku kata "h" (desah) + "i" melengking bergetar, makin turun dan melambat
        const t0 = t - 0.05;
        const per = 0.2 + 0.012 * Math.max(0, Math.floor(t0 / 0.2));
        const k = Math.floor(t0 / 0.2);
        const x = t0 - k * 0.2;
        if (t0 < 0 || k >= 8) { s[j] = 0; break; }
        const f0 = (980 - k * 38) * (1 + 0.035 * Math.sin(2 * Math.PI * 7.5 * t));
        ph += f0 / SR;
        const src = ((ph % 1) * 2 - 1) * 0.8 + w * 0.12;
        const hEnv = x < 0.035 ? Math.sin((Math.PI * x) / 0.035) : 0;
        const vEnv = x >= 0.03 && x < per - 0.04 ? Math.min(1, (x - 0.03) / 0.015) * Math.exp(-(x - 0.03) * 9) : 0;
        const voiced = F1(src, 380, 0.4) * 0.5 + F2(src, 2600, 0.12) * 1.1 + F3(src, 3400, 0.2) * 0.5;
        s[j] = (voiced * vEnv + F4(w, 2400, 0.4) * hEnv * 0.5) * (1 - k * 0.07) * 0.9;
        break;
      }
      case 'napas': {
        // napas panik: tarik (desis naik) - hembus (desis turun), siklus 0,5 dtk, makin cepat
        const per = 0.62 - 0.22 * u;
        const ph2 = (t % per) / per;
        const tarik = ph2 < 0.42 ? Math.sin((Math.PI * ph2) / 0.42) : 0;
        const hembus = ph2 >= 0.48 && ph2 < 0.92 ? Math.sin((Math.PI * (ph2 - 0.48)) / 0.44) : 0;
        s[j] = (F1(w, 1300 + 500 * ph2, 0.5) * tarik * 0.9 + F2(w, 750, 0.6) * hembus * 0.7) * Math.min(1, t / 0.3) * Math.min(1, (len - t) / 0.2) * 1.6;
        break;
      }
      case 'gesek': {
        // biola sumbang menjerit (cluster nada tinggi + derau busur), makin keras lalu putus: pasang tepat sebelum hening
        let v = 0;
        [1046, 1108, 1174, 1244, 1318].forEach((f, i) => {
          const ff = f * (1 + 0.004 * Math.sin(2 * Math.PI * (5.3 + i * 0.4) * t + i));
          v += ((ff * t + i * 0.13) % 1) * 2 - 1;
        });
        lp += 0.25 * (v - lp);
        const busur = F1(w, 3200, 0.3) * 0.6;
        s[j] = (lp * 0.22 + busur) * Math.pow(u, 2.4) * (u > 0.985 ? (1 - u) / 0.015 : 1);
        break;
      }
      case 'lolong': {
        // anjing melolong di kejauhan
        const f = (480 + 300 * Math.sin(Math.PI * Math.min(1, u * 1.3))) * (1 + 0.012 * Math.sin(2 * Math.PI * 5 * t));
        ph += f / SR;
        const x = Math.sin(2 * Math.PI * ph) + 0.35 * Math.sin(4 * Math.PI * ph) + 0.15 * Math.sin(6 * Math.PI * ph);
        lp += 0.12 * (x - lp);
        s[j] = lp * Math.min(1, t / 0.35) * Math.min(1, (len - t) / 0.6) * 0.6;
        break;
      }
      case 'gemuruh': {
        // gemuruh rendah yang terasa di dada (sub-bass berdenyut pelan)
        const f = 32 + 4 * Math.sin(2 * Math.PI * 0.3 * t);
        s[j] = Math.sin(2 * Math.PI * f * t) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 1.1 * t)) * Math.sin(Math.PI * u);
        break;
      }
      case 'detak': {
        // lub-dub: dua dentum rendah, yang kedua lebih pelan
        const thump = (x, f0) => (x < 0 ? 0 : Math.exp(-x * 22) * Math.sin(2 * Math.PI * (f0 + 50 * Math.exp(-x * 40)) * x));
        s[j] = (thump(t, 48) + 0.65 * thump(t - 0.16, 42)) * 1.3 + 0.5 * (t < 0.3 ? Math.exp(-t * 14) * Math.sin(2 * Math.PI * 32 * t) : 0);
        break;
      }
      case 'stinger': {
        // kejutan: dentum besar + semburan derau + gesek sumbang tinggi
        const boom = Math.exp(-t * 2.2) * Math.sin(2 * Math.PI * (38 + 90 * Math.exp(-t * 9)) * t);
        lp += 0.3 * (w - lp);
        const burst = lp * Math.exp(-t * 7);
        const vib = 1 + 0.01 * Math.sin(2 * Math.PI * 7 * t);
        const screech = Math.exp(-t * 1.6) * Math.min(1, t / 0.03) * (Math.sin(2 * Math.PI * 1180 * vib * t) + Math.sin(2 * Math.PI * 1250 * vib * t) + 0.6 * Math.sin(2 * Math.PI * 1873 * t));
        s[j] = boom * 1.1 + burst * 0.8 + screech * 0.18;
        break;
      }
      case 'dengung': {
        // dengung yang makin keras lalu putus (sebelum kejutan / hening)
        const f = 55 * (1 + 0.08 * u);
        const saw = ((f * t) % 1) * 2 - 1;
        const saw2 = ((f * 1.012 * t) % 1) * 2 - 1;
        lp += 0.03 * (saw + saw2 - lp);
        s[j] = lp * Math.pow(u, 2.2) * (u > 0.97 ? (1 - u) / 0.03 : 1) * 0.9;
        break;
      }
      case 'derit': {
        // pintu kayu berderit: getaran gesek dengan nada naik-turun tidak rata
        const f = 170 + 110 * Math.sin(2 * Math.PI * 0.7 * u) + 40 * Math.sin(2 * Math.PI * 3.1 * t) + 25 * w;
        ph += f / SR;
        const x = Math.sin(2 * Math.PI * ph);
        s[j] = Math.sign(x) * Math.pow(Math.abs(x), 0.25) * Math.sin(Math.PI * u) * 0.28 * (0.6 + 0.4 * Math.sin(2 * Math.PI * 11 * t));
        break;
      }
      case 'langkah': {
        lp += 0.15 * (w - lp);
        s[j] = Math.exp(-t * 30) * Math.sin(2 * Math.PI * (70 + 60 * Math.exp(-t * 50)) * t) + lp * Math.exp(-t * 45) * 0.8;
        break;
      }
      case 'ketuk': {
        // tiga ketukan di pintu kayu
        let v = 0;
        for (const k0 of [0, 0.3, 0.6]) {
          const x = t - k0;
          if (x >= 0) v += Math.exp(-x * 45) * (Math.sin(2 * Math.PI * 180 * x) + 0.5 * Math.sin(2 * Math.PI * 410 * x)) + w * Math.exp(-x * 120) * 0.5;
        }
        s[j] = v * 0.8;
        break;
      }
      case 'bisik': {
        // desis berformant seperti suku kata bisikan (tanpa kata nyata)
        const syl = Math.pow(Math.max(0, Math.sin(2 * Math.PI * 4.3 * t + Math.sin(2 * Math.PI * 1.1 * t))), 2);
        const fc = 1800 + 900 * Math.sin(2 * Math.PI * 2.1 * t);
        s[j] = bp(w, fc, 0.35) * syl * Math.sin(Math.PI * u) * 1.4;
        break;
      }
      case 'angin': {
        const fc = 0.006 + 0.02 * (0.5 + 0.5 * Math.sin(2 * Math.PI * 0.35 * t + 1.3 * Math.sin(2 * Math.PI * 0.11 * t)));
        lp += fc * (w - lp);
        hp += 0.5 * (lp - hp);
        s[j] = hp * Math.sin(Math.PI * u) * 4;
        break;
      }
      case 'jangkrik': {
        // kerikan jangkrik: denyut cepat 4,4 kHz dalam kelompok
        const grup = (t % 0.55) < 0.22 ? 1 : 0;
        const pulse = Math.pow(Math.max(0, Math.sin(2 * Math.PI * 32 * t)), 6);
        s[j] = Math.sin(2 * Math.PI * 4400 * t) * pulse * grup * 0.35 * Math.min(1, (len - t) / 0.2);
        break;
      }
      case 'tokek': {
        // "to-kek": suku pertama pendek, kedua lebih panjang dan serak
        const to = t < 0.12 ? Math.exp(-t * 30) * Math.sin(2 * Math.PI * (520 - 400 * t) * t) : 0;
        const x = t - 0.22;
        const kek = x > 0 ? Math.exp(-x * 9) * Math.min(1, x / 0.01) * (Math.sin(2 * Math.PI * 780 * x) * (0.6 + 0.4 * Math.sign(Math.sin(2 * Math.PI * 60 * x))) + 0.3 * w) : 0;
        s[j] = (to + kek) * 0.6;
        break;
      }
      case 'gong': {
        const f = 55;
        s[j] = Math.exp(-t * 0.9) * Math.min(1, t / 0.02) * (Math.sin(2 * Math.PI * f * t) + 0.5 * Math.sin(2 * Math.PI * f * 2.76 * t) * Math.exp(-t * 1.5) + 0.3 * Math.sin(2 * Math.PI * (f * 1.006) * t)) * 0.7;
        break;
      }
      case 'guntur': {
        lp += 0.02 * (w - lp);
        hp += 0.25 * (w - hp);
        const crack = t < 0.25 ? hp * Math.exp(-t * 18) : 0;
        const roll = lp * Math.exp(-t * 0.8) * (0.7 + 0.3 * Math.sin(2 * Math.PI * 1.7 * t)) * 5;
        s[j] = crack * 0.9 + roll;
        break;
      }
      case 'hembus': {
        // derau disaring dua kali (sangat gelap) + selubung halus: terdengar seperti napas udara, bukan gesekan kertas
        lp += 0.02 * (w - lp);
        hp += 0.08 * (lp - hp);
        const env = Math.pow(Math.sin(Math.PI * u), 2);
        s[j] = hp * env * 3.2;
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
  return GEMA[kind] ? gema(s, GEMA[kind][0], GEMA[kind][1]) : s;
}
// gema ruang sederhana (Schroeder: 4 comb + 2 allpass) untuk efek seram supaya tidak "kering"
function gema(dry, mix = 0.4, dekay = 0.8) {
  const n = dry.length + Math.floor(1.8 * SR);
  const out = new Float32Array(n);
  const wet = new Float32Array(n);
  for (const ms of [29.7, 37.1, 41.1, 43.7]) {
    const d = Math.floor((ms / 1000) * SR);
    const buf = new Float32Array(d);
    let i0 = 0;
    for (let i = 0; i < n; i++) {
      const y = buf[i0];
      buf[i0] = (i < dry.length ? dry[i] : 0) + y * dekay;
      i0 = (i0 + 1) % d;
      wet[i] += y * 0.25;
    }
  }
  for (const ms of [5.0, 1.7]) {
    const d = Math.floor((ms / 1000) * SR);
    const buf = new Float32Array(d);
    let i0 = 0;
    for (let i = 0; i < n; i++) {
      const x = wet[i];
      const y = buf[i0];
      const v = x + y * 0.7;
      buf[i0] = v;
      wet[i] = y - v * 0.7;
      i0 = (i0 + 1) % d;
    }
  }
  for (let i = 0; i < n; i++) out[i] = (i < dry.length ? dry[i] : 0) * (1 - mix) + wet[i] * mix;
  return out;
}
const GEMA = { jerit: [0.4, 0.82], 'jerit-cowo': [0.4, 0.8], 'tawa-cowo': [0.45, 0.82], tawa: [0.45, 0.82], bisik: [0.35, 0.78], lolong: [0.55, 0.84], stinger: [0.3, 0.8], ketuk: [0.3, 0.75], derit: [0.25, 0.75], gesek: [0.3, 0.8] };

// ---------- musik HOROR: dengung rendah, nada sumbang saat tegang, kotak musik jarang, gong rendah ----------
// Tanpa ketukan drum: rasa takut datang dari dengung, sunyi, dan detak jantung (lihat "jantung").
const TAU = 2 * Math.PI;
if (HOROR) {
  const f1 = hz(root - 12);
  const f2 = hz(root - 12 + 6); // tritone: interval paling "tidak tenang"
  const fh1 = hz(root + 25);
  const fh2 = hz(root + 26); // sekon kecil di nada tinggi = gesekan sumbang
  let n1 = 0;
  let n2 = 0;
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const e = energyAt(t);
    const lfo = 0.5 + 0.5 * Math.sin(TAU * 0.06 * t);
    const drone = Math.sin(TAU * f1 * t) + 0.6 * Math.sin(TAU * f1 * 1.004 * t) + 0.35 * (0.3 + e) * Math.sin(TAU * f2 * t + 0.4 * Math.sin(TAU * 0.13 * t));
    n1 += 0.004 * (rnd() * 2 - 1 - n1); // desau gelap
    n2 += 0.05 * (n1 - n2);
    const naik = Math.max(0, e - 0.45) / 0.55;
    const sumbang = naik > 0 ? naik * (Math.sin(TAU * fh1 * t) + Math.sin(TAU * fh2 * t * (1 + 0.002 * Math.sin(TAU * 5 * t)))) : 0;
    const sub = Math.sin(TAU * hz(root - 24) * t) * (0.5 + 0.5 * Math.sin(TAU * 0.17 * t));
    const v = 0.075 * drone * (0.55 + 0.45 * lfo) + 0.05 * sub * (0.4 + e) + n2 * 2.6 * (0.4 + e) + 0.016 * sumbang;
    L[i] += v * (1 + 0.15 * Math.sin(TAU * 0.05 * t));
    R[i] += v * (1 - 0.15 * Math.sin(TAU * 0.05 * t));
  }
  // kotak musik: satu nada tiap 1-3 ketuk, hanya saat energi rendah-sedang (sunyi yang "manis tapi salah")
  const skala = [0, 2, 3, 7, 8, 11];
  const r2 = (k) => {
    let x = Math.imul(k + 1, 2654435761) >>> 0;
    x ^= x >>> 13;
    x = Math.imul(x, 1274126177) >>> 0;
    return x / 4294967296;
  };
  for (let t = 1, k = 0; t < DUR - 2; t += beat * (1 + Math.floor(r2(k) * 3)), k++) {
    const e = energyAt(t);
    if (e > 0.7 || silentAt(t) || r2(k + 99) < 0.35) continue;
    const f = hz(root + 36 + skala[Math.floor(r2(k + 7) * skala.length)]) * (1 + 0.006 * (r2(k + 3) - 0.5)); // sedikit fals
    const n = Math.floor(2.4 * SR);
    const s = new Float32Array(n);
    for (let j = 0; j < n; j++) {
      const tt = j / SR;
      s[j] = Math.exp(-tt * 2.2) * (Math.sin(TAU * f * tt) + 0.25 * Math.sin(TAU * f * 4.2 * tt) * Math.exp(-tt * 6));
    }
    add(L, R, t, s, 0.045, (r2(k + 5) - 0.5) * 0.6);
  }
  // gong rendah tiap 4 bar saat energi sedang ke atas
  for (let t = 0; t < DUR - 1; t += beat * 16) {
    if (energyAt(t) < 0.35 || silentAt(t)) continue;
    add(L, R, t, sfx('gong'), 0.22, 0);
  }
}


const TRANSISI = new Set(['whoosh', 'swoosh-up', 'hembus']);
const TR = S.transisi || null;
let lastTr = -Infinity;
let dibuang = 0;
for (const x of [...(S.sfx || [])].sort((a, b) => (Number(a.t) || 0) - (Number(b.t) || 0))) {
  const t = Number(x.t) || 0;
  let gain = Number(x.gain ?? 0.5);
  if (TR && TRANSISI.has(x.jenis)) {
    if (t - lastTr < Number(TR.jedaMin ?? 0)) { dibuang++; continue; }
    lastTr = t;
    if (TR.gainMaks != null) gain = Math.min(gain, Number(TR.gainMaks));
  }
  add(FL, FR, t, sfx(x.jenis), gain, Number(x.pan ?? 0));
}
// detak jantung panjang: bpm naik dari bpm0 ke bpm1 (lengkung ease-in). Algoritma sama dengan HR.ketukanJantung di kit.
for (const jt of S.jantung || []) {
  const a = Number(jt.dari) || 0;
  const b = Number(jt.sampai) || a;
  const b0 = Number(jt.bpm0 ?? 70);
  const b1 = Number(jt.bpm1 ?? b0);
  const g0 = Number(jt.gain ?? 0.6);
  const beatS = sfx('detak');
  for (let t = a; t < b; ) {
    const u = (t - a) / Math.max(1e-6, b - a);
    add(FL, FR, t, beatS, g0 * (0.6 + 0.4 * u), 0);
    t += 60 / (b0 + (b1 - b0) * u * u);
  }
}
// suasana latar (masuk ke musik, jadi ikut mengecil saat narasi dan ikut "hening")
for (const am of S.ambien || []) {
  const a = Number(am.dari) || 0;
  const b = Math.min(DUR, Number(am.sampai) || DUR);
  const g0 = Number(am.gain ?? 0.5);
  if (am.jenis === 'malam') {
    for (let t = a, k = 0; t < b - 2.2; t += 2.6 + ((k * 7919) % 13) / 10, k++) add(L, R, t, sfx('jangkrik'), 0.12 * g0, ((k % 5) - 2) * 0.3);
    for (let t = a + 1.5; t < b - 4; t += 4) add(L, R, t, sfx('angin'), 0.08 * g0, 0);
  } else if (am.jenis === 'angin') {
    for (let t = a; t < b - 4; t += 3.2) add(L, R, t, sfx('angin'), 0.35 * g0, Math.sin(t) * 0.5);
  } else if (am.jenis === 'hujan') {
    let h1 = 0;
    const i0 = Math.floor(a * SR);
    const i1 = Math.floor(b * SR);
    for (let i = i0; i < i1 && i < N; i++) {
      const w = rnd() * 2 - 1;
      h1 += 0.35 * (w - h1);
      const fade = Math.min(1, (i - i0) / SR / 1.5) * Math.min(1, (i1 - i) / SR / 1.5);
      const drop = rnd() > 0.9993 ? 0.6 : 0;
      const v = ((w - h1) * 0.05 + drop * w) * g0 * fade;
      L[i] += v;
      R[i] += v * 0.9;
    }
  }
}
// suara hantu: potongan file suara (mis. narasi "Dimas... Dimas...") diolah jadi bisikan bergema dari satu sisi
import { execFileSync } from 'node:child_process';
for (const g of S.suaraHantu || []) {
  const src = path.resolve(path.dirname(file), g.file || 'vo.mp3');
  if (!fs.existsSync(src)) { console.warn('suaraHantu: tidak ada ' + src); continue; }
  const naik = Number(g.nada ?? 1.12);
  const af = [
    `atrim=${Number(g.dari) || 0}:${Number(g.sampai) || 9999}`, 'asetpts=PTS-STARTPTS', 'aresample=48000', `asetrate=${Math.round(48000 * naik)}`, 'aresample=48000',
    'highpass=f=350', 'lowpass=f=6000', 'aecho=0.8:0.75:140|310|520:0.35|0.22|0.12', 'apad=pad_dur=1.5',
  ].join(',');
  const raw = execFileSync('ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', '-i', src, '-af', af, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
  const smp = new Float32Array(raw.buffer, raw.byteOffset, Math.floor(raw.length / 4));
  add(FL, FR, Number(g.t) || 0, Float32Array.from(smp), Number(g.gain ?? 0.5), Number(g.pan ?? -0.7));
  // setiap suara hantu/panggilan diikuti jeritan (kecuali "jerit": false): cewe = jerit, cowo = jerit-cowo
  if (g.jerit !== false) {
    const tj = g.tJerit != null ? Number(g.tJerit) : (Number(g.t) || 0) + Math.max(0.3, (Number(g.sampai) || 0) - (Number(g.dari) || 0)) + 0.25;
    add(FL, FR, tj, sfx(g.suara === 'cowo' ? 'jerit-cowo' : 'jerit'), Number(g.gainJerit ?? 0.45), Number(g.pan ?? -0.7) * 0.5);
  }
}
if (dibuang) console.log(`${dibuang} efek transisi dilewati (terlalu rapat, jedaMin ${TR.jedaMin}s)`);

// fade in/out musik + hening
for (let i = 0; i < N; i++) {
  const t = i / SR;
  let g = Math.min(1, t / 1.0) * Math.min(1, (DUR - t) / 1.5);
  if (silentAt(t)) g *= 0.05;
  L[i] *= g;
  R[i] *= g;
}
// "hening" juga membungkam efek (termasuk ekor gema) dengan landai 30 ms: sebelum kejutan harus benar-benar sunyi
for (const h of S.hening || []) {
  const a = Math.floor(h.dari * SR);
  const b = Math.floor(h.sampai * SR);
  const ramp = Math.floor(0.03 * SR);
  for (let i = Math.max(0, a - ramp); i < Math.min(N, b); i++) {
    const g = i < a ? 1 - (i - (a - ramp)) / ramp : 0;
    FL[i] *= g;
    FR[i] *= g;
  }
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
