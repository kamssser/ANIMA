/* Kamal kit (browser, canvas 2D). Dimuat SETELAH studio-kit.js:
 *   <script src="/kit/studio-kit.js"></script><script src="/kit/kamal-kit.js"></script>
 * Dua varian gaya Kamal (lihat styles/gelap.md dan styles/terang.md):
 *   - GELAP : panggung gelap, tokoh garis, lampu sorot, benda penting menyala kuning, judul atas dengan kata kunci kuning.
 *   - TERANG: kertas krem, judul tebal editorial, kata kunci di kotak marun, kartu berbayang keras, angka berhitung, diagram cabang.
 * Ukuran acuan 1080x1920 (9:16). Semua fungsi murni dari t (detik). Tidak ada Math.random / Date di draw.
 */
(function () {
  const HF = window.HF;
  const K = {};
  const D2R = Math.PI / 180;

  // ---------- huruf ----------
  K.FONT = '"Kamal Sans", "Plus Jakarta Sans", "Segoe UI", Arial, sans-serif';
  /** Muat Plus Jakarta Sans (OFL) dari /kit/fonts. Panggil di init() sebelum menggambar teks. */
  K.loadFonts = async () => {
    const list = [
      [500, 'plus-jakarta-sans-latin-500-normal.woff2'],
      [700, 'plus-jakarta-sans-latin-700-normal.woff2'],
      [800, 'plus-jakarta-sans-latin-800-normal.woff2'],
    ];
    await Promise.all(
      list.map(async ([w, f]) => {
        try {
          const ff = new FontFace('Kamal Sans', `url(/kit/fonts/${f})`, { weight: String(w) });
          document.fonts.add(await ff.load());
        } catch (e) {
          console.warn('font gagal dimuat', f, e);
        }
      }),
    );
  };
  K.font = (weight, size) => `${weight} ${Math.round(size)}px ${K.FONT}`;

  // ---------- palet ----------
  K.GELAP = {
    bgTop: '#2a2e35', bgMid: '#1d2026', bgBottom: '#121418',
    floor: '#16181c', ink: '#15161a',
    hero: '#ece7dc', other: '#8d9097', otherDark: '#6f727a',
    glow: '#ffb627', glowSoft: 'rgba(255,182,39,0.55)',
    text: '#f1efe9', textDim: 'rgba(241,239,233,0.5)', key: '#ffb627',
    wood: '#6d6258', woodDark: '#4c443d',
  };
  K.TERANG = {
    bg: '#f3f0ea', ink: '#161616', ghost: '#cfcac1', sub: '#5d5a55', faint: '#8e8a83',
    maroon: '#8b1111', maroonDark: '#5e0a0a', card: '#fffdf8', chip: '#e4e0d8', green: '#18a957',
  };

  // ---------- kamera ----------
  /** Dorong pelan (push-in) di sekitar titik fokus. Bungkus gambar adegan: K.camera(ctx, s, cx, cy, () => {...}) */
  K.camera = (ctx, scale, cx, cy, fn) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);
    fn();
    ctx.restore();
  };
  /** goyang kecil saat benturan: kembalikan offset {x,y} yang meredam dari t0 */
  K.shake = (t, t0, amp = 10, dur = 0.35) => {
    const u = HF.prog(t, t0, t0 + dur);
    if (u <= 0 || u >= 1) return { x: 0, y: 0 };
    const a = amp * (1 - u) * (1 - u);
    return { x: Math.sin((t - t0) * 90) * a, y: Math.cos((t - t0) * 77) * a * 0.6 };
  };

  // =====================================================================
  //                                GELAP
  // =====================================================================
  /** Latar panggung gelap + lantai mengkilap. floorY = garis lantai (acuan 1300 di 1080x1920). */
  K.stage = (ctx, W, H, floorY = H * 0.677) => {
    const P = K.GELAP;
    const g = ctx.createLinearGradient(0, 0, 0, floorY);
    g.addColorStop(0, P.bgTop);
    g.addColorStop(0.55, P.bgMid);
    g.addColorStop(1, '#1a1c21');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, floorY);
    const f = ctx.createLinearGradient(0, floorY, 0, H);
    f.addColorStop(0, '#202329');
    f.addColorStop(0.12, P.floor);
    f.addColorStop(1, P.bgBottom);
    ctx.fillStyle = f;
    ctx.fillRect(0, floorY, W, H - floorY);
    // garis lantai lembut
    const l = ctx.createLinearGradient(0, 0, W, 0);
    l.addColorStop(0, 'rgba(255,255,255,0)');
    l.addColorStop(0.5, 'rgba(255,255,255,0.07)');
    l.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = l;
    ctx.fillRect(0, floorY - 1, W, 2);
    // vinyet
    const v = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.2, W / 2, H * 0.45, H * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  };

  /**
   * Gambar sesuatu + pantulannya di lantai (terbalik, pudar). fn(ctx) menggambar dengan koordinat dunia biasa.
   * strength 0..1 (acuan 0.22).
   */
  K.withReflection = (ctx, floorY, fn, strength = 0.22) => {
    fn(ctx);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, floorY, ctx.canvas.width, ctx.canvas.height - floorY);
    ctx.clip();
    ctx.globalAlpha = strength;
    ctx.translate(0, floorY * 2);
    ctx.scale(1, -1);
    fn(ctx);
    ctx.restore();
    // pudarkan pantulan ke bawah
    const W = ctx.canvas.width;
    const g = ctx.createLinearGradient(0, floorY, 0, floorY + 260);
    g.addColorStop(0, 'rgba(22,24,28,0)');
    g.addColorStop(1, 'rgba(22,24,28,0.9)');
    ctx.fillStyle = g;
    ctx.fillRect(0, floorY + 2, W, 260);
  };

  /** Lampu sorot dari atas ke lantai. on 0..1 (nyalakan dengan HF.prog). */
  K.spotlight = (ctx, x, floorY, { top = -40, spreadTop = 40, spreadFloor = 190, on = 1 } = {}) => {
    if (on <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(0, top, 0, floorY);
    g.addColorStop(0, `rgba(255,255,255,${0.02 * on})`);
    g.addColorStop(0.5, `rgba(255,255,255,${0.07 * on})`);
    g.addColorStop(1, `rgba(255,255,255,${0.13 * on})`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - spreadTop, top);
    ctx.lineTo(x + spreadTop, top);
    ctx.lineTo(x + spreadFloor, floorY);
    ctx.lineTo(x - spreadFloor, floorY);
    ctx.closePath();
    ctx.fill();
    const e = ctx.createRadialGradient(x, floorY, 0, x, floorY, spreadFloor * 1.15);
    e.addColorStop(0, `rgba(255,255,255,${0.2 * on})`);
    e.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = e;
    ctx.beginPath();
    ctx.ellipse(x, floorY, spreadFloor * 1.15, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  /** Gambar dengan pendar (glow). fn(ctx) menggambar bentuknya. */
  K.glow = (ctx, color, blur, fn, passes = 2) => {
    ctx.save();
    ctx.shadowColor = color;
    for (let i = 0; i < passes; i++) {
      ctx.shadowBlur = blur * (i + 1);
      fn(ctx);
    }
    ctx.restore();
    fn(ctx);
  };

  // ---------- tokoh garis ----------
  /**
   * Pose = sudut dalam derajat. 0 = lurus ke bawah, positif = ke arah hadap tokoh.
   *   torso: condong badan; head: angguk; aF/aB = [bahu, siku] lengan depan/belakang; lF/lB = [pinggul, lutut] kaki.
   */
  K.POSE = {
    berdiri: { torso: 0, head: 0, aF: [10, -8], aB: [-8, 6], lF: [5, -3], lB: [-5, 3] },
    santai: { torso: -2, head: -4, aF: [4, 0], aB: [-4, 0], lF: [4, 0], lB: [-4, 0] },
    kerja: { torso: 14, head: 12, aF: [62, 38], aB: [50, 46], lF: [6, -4], lB: [-6, 4] },
    angkat: { torso: 0, head: -12, aF: [168, 8], aB: [-168, -8], lF: [12, -10], lB: [-12, 10] },
    sorak: { torso: -4, head: -10, aF: [150, 20], aB: [-150, -20], lF: [8, 0], lB: [-8, 0] },
    bawa: { torso: 0, head: 0, aF: [12, 0], aB: [-10, 4], lF: [5, -3], lB: [-5, 3] },
    tunjuk: { torso: 2, head: 0, aF: [88, 0], aB: [-6, 4], lF: [6, -3], lB: [-6, 3] },
    lesu: { torso: 18, head: 32, aF: [6, 0], aB: [2, 0], lF: [4, -6], lB: [-4, 6] },
    tertekan: { torso: 10, head: 22, aF: [158, 30], aB: [-150, -34], lF: [34, -62], lB: [-30, 58] },
    pikir: { torso: 0, head: 8, aF: [40, 120], aB: [-6, 4], lF: [4, -2], lB: [-4, 2] },
    terkejut: { torso: -8, head: -10, aF: [120, 40], aB: [-120, -40], lF: [10, 0], lB: [-10, 0] },
  };
  /** Campur dua pose (u 0..1). */
  K.mix = (a, b, u) => {
    const m = (x, y) => (Array.isArray(x) ? x.map((v, i) => HF.lerp(v, y[i], u)) : HF.lerp(x, y, u));
    const o = {};
    for (const k of Object.keys(a)) o[k] = m(a[k], b[k] ?? a[k]);
    return o;
  };
  /** Pose jalan pada waktu t (siklus kaki). speed = langkah per detik. */
  K.walk = (t, speed = 1.6) => {
    const p = t * speed * Math.PI * 2;
    const s = Math.sin(p);
    return {
      torso: 4, head: 0,
      aF: [-22 * s, -14], aB: [22 * s, -14],
      lF: [26 * s, -Math.max(0, -Math.cos(p)) * 40 - 4], lB: [-26 * s, -Math.max(0, Math.cos(p)) * 40 - 4],
      bob: Math.abs(Math.cos(p)) * 6,
    };
  };

  /**
   * Gambar tokoh garis. Kaki terbawah selalu menapak di y (lantai) kecuali grounded:false.
   * o: { x, y, s (skala, 1 = tinggi ±350px), face (1 kanan / -1 kiri), pose, color, outline, extra(ctx, joints) }
   * Kembalikan sendi dunia { head, neck, hip, handF, handB, footF, footB } untuk menaruh benda di tangan.
   */
  K.figure = (ctx, o) => {
    const P = K.GELAP;
    const s = o.s ?? 1;
    const f = o.face ?? 1;
    const pose = { ...K.POSE.berdiri, ...(o.pose || {}) };
    const col = o.color ?? P.hero;
    const out = o.outline ?? P.ink;
    const limbW = 26 * s;
    const ow = 7 * s;
    const UL = 80 * s, LL = 78 * s, UA = 64 * s, FA = 62 * s, TOR = 118 * s, HR = 40 * s;
    const dir = (deg) => ({ x: Math.sin(deg * D2R) * f, y: Math.cos(deg * D2R) });
    // hitung relatif pinggul (0,0)
    const tdir = dir(180 + pose.torso); // ke atas
    const neck = { x: tdir.x * TOR, y: tdir.y * TOR };
    const shoulder = { x: neck.x * 0.88, y: neck.y * 0.88 };
    const hdir = dir(180 + pose.torso + pose.head);
    const head = { x: neck.x + hdir.x * (HR + 6 * s), y: neck.y + hdir.y * (HR + 6 * s) };
    const limb = (base, a1, a2, l1, l2) => {
      const d1 = dir(a1);
      const j = { x: base.x + d1.x * l1, y: base.y + d1.y * l1 };
      const d2 = dir(a1 + a2);
      return [j, { x: j.x + d2.x * l2, y: j.y + d2.y * l2 }];
    };
    const [kF, ftF] = limb({ x: 0, y: 0 }, pose.lF[0], pose.lF[1], UL, LL);
    const [kB, ftB] = limb({ x: 0, y: 0 }, pose.lB[0], pose.lB[1], UL, LL);
    const [eF, hF] = limb(shoulder, pose.aF[0] + pose.torso, pose.aF[1], UA, FA);
    const [eB, hB] = limb(shoulder, pose.aB[0] + pose.torso, pose.aB[1], UA, FA);
    const lowest = Math.max(ftF.y, ftB.y) + 6 * s;
    const ox = o.x;
    const oy = (o.grounded === false ? o.y : o.y - lowest) - (pose.bob ?? 0) * s;
    const W = (p) => ({ x: ox + p.x, y: oy + p.y });
    const seg = (pts, c, w) => {
      ctx.strokeStyle = c;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(ox + pts[0].x, oy + pts[0].y);
      for (const p of pts.slice(1)) ctx.lineTo(ox + p.x, oy + p.y);
      ctx.stroke();
    };
    const limbDraw = (pts, c) => {
      seg(pts, out, limbW + ow * 2);
      seg(pts, c, limbW);
    };
    const shade = o.shade ?? shadeOf(col, -0.16);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    limbDraw([shoulder, eB, hB], shade);
    limbDraw([{ x: 0, y: 0 }, kB, ftB], shade);
    // badan: kapsul tebal
    seg([{ x: 0, y: 0 }, shoulder], out, limbW * 1.35 + ow * 2);
    seg([{ x: 0, y: 0 }, shoulder], col, limbW * 1.35);
    limbDraw([{ x: 0, y: 0 }, kF, ftF], col);
    // kepala
    ctx.fillStyle = col;
    ctx.strokeStyle = out;
    ctx.lineWidth = ow;
    ctx.beginPath();
    ctx.arc(ox + head.x, oy + head.y, HR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const joints = { head: W(head), neck: W(neck), hip: W({ x: 0, y: 0 }), shoulder: W(shoulder), handF: W(hF), handB: W(hB), footF: W(ftF), footB: W(ftB), s, face: f };
    if (o.behindArm) o.behindArm(ctx, joints);
    limbDraw([shoulder, eF, hF], col);
    if (o.extra) o.extra(ctx, joints);
    ctx.restore();
    return joints;
  };
  function shadeOf(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const c = (v) => Math.max(0, Math.min(255, Math.round(v + 255 * amt)));
    return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
  }
  K.shade = shadeOf;

  // ---------- properti panggung ----------
  /** Jam dinding; jarum berputar mengikuti t (speed = putaran jarum panjang per detik). */
  K.clock = (ctx, x, y, r, t, speed = 0.15) => {
    ctx.save();
    ctx.fillStyle = '#e9e6df';
    ctx.strokeStyle = '#1b1c20';
    ctx.lineWidth = r * 0.12;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#1b1c20';
    ctx.lineCap = 'round';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.lineWidth = r * 0.05;
      ctx.beginPath();
      ctx.moveTo(x + Math.sin(a) * r * 0.72, y - Math.cos(a) * r * 0.72);
      ctx.lineTo(x + Math.sin(a) * r * 0.82, y - Math.cos(a) * r * 0.82);
      ctx.stroke();
    }
    const am = t * speed * Math.PI * 2;
    const ah = am / 12 + 1.9;
    ctx.lineWidth = r * 0.1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.sin(ah) * r * 0.45, y - Math.cos(ah) * r * 0.45);
    ctx.stroke();
    ctx.lineWidth = r * 0.07;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.sin(am) * r * 0.68, y - Math.cos(am) * r * 0.68);
    ctx.stroke();
    ctx.restore();
  };
  /** Meja kayu sederhana; y = lantai. Kembalikan y permukaan meja. */
  K.desk = (ctx, x, y, w = 300, h = 150) => {
    const P = K.GELAP;
    ctx.save();
    ctx.fillStyle = P.woodDark;
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 5;
    for (const lx of [x - w / 2 + 14, x + w / 2 - 30]) {
      ctx.beginPath();
      ctx.rect(lx, y - h + 22, 16, h - 22);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = P.wood;
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - h, w, 24, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = P.woodDark;
    ctx.fillRect(x - w / 2 + 8, y - h + 24, w - 16, 10);
    ctx.restore();
    return y - h;
  };
  /** Tas kerja. glow 0..1 membuatnya menyala kuning (benda penting). */
  K.briefcase = (ctx, x, y, s = 1, glow = 0) => {
    const P = K.GELAP;
    const body = glow > 0 ? mixColor('#5d5f66', P.glow, glow) : '#5d5f66';
    const draw = (c) => {
      c.fillStyle = body;
      c.strokeStyle = P.ink;
      c.lineWidth = 5 * s;
      c.beginPath();
      c.roundRect(x - 44 * s, y - 64 * s, 88 * s, 62 * s, 8 * s);
      c.fill();
      c.stroke();
      c.beginPath();
      c.roundRect(x - 16 * s, y - 78 * s, 32 * s, 16 * s, 5 * s);
      c.stroke();
      c.beginPath();
      c.moveTo(x - 44 * s, y - 40 * s);
      c.lineTo(x + 44 * s, y - 40 * s);
      c.stroke();
      c.fillStyle = P.ink;
      c.fillRect(x - 6 * s, y - 46 * s, 12 * s, 12 * s);
    };
    if (glow > 0) K.glow(ctx, P.glowSoft, 22 * glow, draw);
    else draw(ctx);
  };
  /** Kotak/kardus generik (glow seperti briefcase). */
  K.box = (ctx, x, y, w, h, glow = 0, base = '#7a6f62') => {
    const P = K.GELAP;
    const draw = (c) => {
      c.fillStyle = glow > 0 ? mixColor(base, P.glow, glow) : base;
      c.strokeStyle = P.ink;
      c.lineWidth = 5;
      c.beginPath();
      c.roundRect(x - w / 2, y - h, w, h, 6);
      c.fill();
      c.stroke();
      c.beginPath();
      c.moveTo(x - w / 2, y - h + h * 0.28);
      c.lineTo(x + w / 2, y - h + h * 0.28);
      c.stroke();
    };
    if (glow > 0) K.glow(ctx, P.glowSoft, 22 * glow, draw);
    else draw(ctx);
  };
  /** Medali bintang kecil (mis. di dada tokoh "bos"). */
  K.medal = (ctx, x, y, r = 14) => {
    ctx.save();
    ctx.strokeStyle = '#3b3f48';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.7, y - r * 2.4);
    ctx.lineTo(x, y - r);
    ctx.lineTo(x + r * 0.7, y - r * 2.4);
    ctx.stroke();
    ctx.fillStyle = '#d9dbe3';
    ctx.strokeStyle = '#2a2d33';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#7d8190';
    star(ctx, x, y, r * 0.62, r * 0.27);
    ctx.fill();
    ctx.restore();
  };
  function star(ctx, x, y, R, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 ? r : R;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
  }
  K.star = star;
  /** Garis-garis "kejut" kecil di sekitar titik (efek reaksi), muncul di t0. */
  K.burst = (ctx, x, y, t, t0, { r = 50, n = 3, color = '#f1efe9', side = 1 } = {}) => {
    const u = HF.prog(t, t0, t0 + 0.35);
    if (u <= 0 || t > t0 + 1.2) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 1 - HF.prog(t, t0 + 0.8, t0 + 1.2);
    for (let i = 0; i < n; i++) {
      const a = (-50 + (i * 50) / Math.max(1, n - 1)) * D2R;
      const r0 = r * (0.7 + 0.3 * u);
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * r0 * side, y + Math.sin(a) * r0);
      ctx.lineTo(x + Math.cos(a) * (r0 + 24) * side, y + Math.sin(a) * (r0 + 24));
      ctx.stroke();
    }
    ctx.restore();
  };
  function mixColor(a, b, u) {
    const pa = parseInt(a.slice(1), 16);
    const pb = parseInt(b.slice(1), 16);
    const c = (sh) => Math.round(HF.lerp((pa >> sh) & 255, (pb >> sh) & 255, HF.clamp(u)));
    return `rgb(${c(16)},${c(8)},${c(0)})`;
  }
  K.mixColor = mixColor;

  /** Label kecil huruf kapital berjarak (mis. "KANTOR", "BOS", "HASILNYA"). */
  K.label = (ctx, text, x, y, { size = 24, color = 'rgba(241,239,233,0.6)', spacing = 0.32, align = 'center', alpha = 1, weight = 700 } = {}) => {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.font = K.font(weight, size);
    ctx.letterSpacing = `${size * spacing}px`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(String(text).toUpperCase(), x, y);
    ctx.restore();
  };

  /**
   * Judul atas gaya GELAP: baris putih, kata bertanda *bintang* berwarna kuning.
   * lines: [{ t0, text: 'Hasil kerjamu bisa diambil.' }, { t0, text: '*Kemampuanmu* nggak.' }]
   * o: { y, size, out (waktu hilang), lineGap }
   */
  K.caption = (ctx, t, lines, o = {}) => {
    const P = K.GELAP;
    const W = ctx.canvas.width;
    const size = o.size ?? 58;
    const y0 = o.y ?? 430;
    const gap = o.lineGap ?? size * 1.3;
    const outU = o.out != null ? HF.prog(t, o.out, o.out + 0.3) : 0;
    ctx.save();
    ctx.textBaseline = 'middle';
    lines.forEach((ln, i) => {
      const u = HF.ease.out(HF.prog(t, ln.t0, ln.t0 + 0.35));
      if (u <= 0) return;
      const parts = parseMarks(ln.text);
      ctx.font = K.font(800, size);
      ctx.letterSpacing = `${-size * 0.01}px`;
      const widths = parts.map((p) => ctx.measureText(p.text).width);
      const total = widths.reduce((a, b) => a + b, 0);
      let x = W / 2 - total / 2;
      const y = y0 + i * gap + (1 - u) * 18 - outU * 20;
      ctx.globalAlpha = u * (1 - outU);
      parts.forEach((p, k) => {
        ctx.fillStyle = p.mark ? (o.key ?? P.key) : (o.color ?? P.text);
        ctx.fillText(p.text, x, y);
        x += widths[k];
      });
    });
    ctx.restore();
  };
  /** "a *b* c" -> [{text:'a ', mark:false}, {text:'b', mark:true}, {text:' c', mark:false}] */
  function parseMarks(s) {
    const out = [];
    String(s)
      .split(/(\*[^*]+\*)/)
      .filter(Boolean)
      .forEach((p) => out.push(p.startsWith('*') ? { text: p.slice(1, -1), mark: true } : { text: p, mark: false }));
    return out;
  }
  K.parseMarks = parseMarks;

  /** Tanda kanal kecil di bawah lantai (nama kanal pengguna; kosongkan bila tidak ada). */
  K.watermark = (ctx, text, y, dark = true) => {
    if (!text) return;
    K.label(ctx, text, ctx.canvas.width / 2, y, { size: 22, spacing: 0.42, color: dark ? 'rgba(241,239,233,0.28)' : 'rgba(22,22,22,0.35)' });
  };

  // =====================================================================
  //                                TERANG
  // =====================================================================
  K.paper = (ctx, W, H) => {
    ctx.fillStyle = K.TERANG.bg;
    ctx.fillRect(0, 0, W, H);
  };

  /**
   * Judul editorial: kata muncul sebagai bayangan abu (ghost) lalu menebal hitam satu per satu.
   * lines: [{ text, t0, t1, box?: true }]  — box = baris kata kunci di kotak marun (teks putih).
   * o: { x, y, size, show (waktu baris bayangan muncul), out (waktu hilang), align }
   */
  K.headline = (ctx, t, lines, o = {}) => {
    const P = K.TERANG;
    const x0 = o.x ?? 80;
    // ukuran mengecil otomatis supaya baris terpanjang (termasuk kotak marun) muat sampai margin kanan
    let size = o.size ?? 84;
    const maxW = (o.maxWidth ?? ctx.canvas.width - x0 * 2) - size * 0.3;
    ctx.save();
    ctx.font = K.font(800, size);
    ctx.letterSpacing = `${-size * 0.035}px`;
    const longest = Math.max(...lines.map((l) => ctx.measureText(l.text).width));
    ctx.restore();
    if (longest > maxW) size = Math.floor((size * maxW) / longest);
    const y0 = o.y ?? 330;
    const lh = size * 1.12;
    const show = o.show ?? Math.min(...lines.map((l) => l.t0)) - 0.25;
    const appear = HF.ease.out(HF.prog(t, show, show + 0.3));
    if (appear <= 0) return;
    const outU = o.out != null ? HF.ease.inOut(HF.prog(t, o.out, o.out + 0.35)) : 0;
    if (outU >= 1) return;
    ctx.save();
    ctx.globalAlpha = appear * (1 - outU);
    ctx.textBaseline = 'alphabetic';
    ctx.font = K.font(800, size);
    ctx.letterSpacing = `${-size * 0.035}px`;
    lines.forEach((ln, i) => {
      const y = y0 + i * (lh + (ln.box ? 14 : 0)) - outU * 30;
      const words = String(ln.text).split(' ');
      const ws = words.map((w) => ctx.measureText(w + ' ').width);
      const full = ctx.measureText(ln.text).width;
      const dur = Math.max(0.05, (ln.t1 ?? ln.t0 + 0.5) - ln.t0);
      if (ln.box) {
        const bu = HF.ease.out(HF.prog(t, ln.t0, ln.t0 + 0.3));
        if (bu > 0) {
          const pad = size * 0.16;
          const bx = x0 - pad;
          const by = y - size * 0.86;
          const bw = (full + pad * 2) * bu;
          const bh = size * 1.12;
          ctx.fillStyle = P.ink;
          ctx.fillRect(bx + 6, by + 6, bw, bh);
          ctx.fillStyle = P.maroon;
          ctx.fillRect(bx, by, bw, bh);
        }
      }
      let x = x0;
      words.forEach((w, k) => {
        const wu = HF.prog(t, ln.t0 + (k / words.length) * dur, ln.t0 + ((k + 1) / words.length) * dur);
        let c;
        if (ln.box) c = wu > 0 ? '#ffffff' : P.ghost;
        else c = mixColor(P.ghost, P.ink, HF.ease.out(wu));
        ctx.fillStyle = c;
        ctx.fillText(w, x, y);
        x += ws[k];
      });
    });
    ctx.restore();
  };

  /** Pop-in skala dengan pantulan (0 sebelum t0, 1 sesudah ±0.4 dtk). */
  K.pop = (t, t0, d = 0.4) => HF.ease.back(HF.prog(t, t0, t0 + d), 1.6);

  /** Kartu putih bergaris tebal dengan bayangan keras. fn(ctx) menggambar isi (koordinat dunia). */
  K.card = (ctx, x, y, w, h, { scale = 1, r = 22, border = 4.5, shadow = 7, fill, stroke, fn } = {}) => {
    const P = K.TERANG;
    if (scale <= 0.001) return;
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.scale(scale, scale);
    ctx.translate(-(x + w / 2), -(y + h / 2));
    ctx.fillStyle = P.ink;
    ctx.beginPath();
    ctx.roundRect(x + shadow, y + shadow, w, h, r);
    ctx.fill();
    ctx.fillStyle = fill ?? P.card;
    ctx.strokeStyle = stroke ?? P.ink;
    ctx.lineWidth = border;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
    ctx.stroke();
    if (fn) fn(ctx);
    ctx.restore();
  };

  /** Angka berhitung dari a ke b antara t0..t1 (bulat). */
  K.count = (t, t0, t1, a, b) => Math.round(HF.lerp(a, b, HF.ease.out(HF.prog(t, t0, t1))));

  /** Teks rata tengah sederhana. */
  K.text = (ctx, s, x, y, { size = 40, weight = 700, color = K.TERANG.ink, align = 'center', base = 'middle', spacing = -0.02, alpha = 1 } = {}) => {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.font = K.font(weight, size);
    ctx.letterSpacing = `${size * spacing}px`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = base;
    ctx.fillText(s, x, y);
    ctx.restore();
  };

  /**
   * Pil (chip) berbayang. variant: 'putih' (garis hitam) | 'marun' (isi marun, teks putih) | 'abu' (latar abu, tanpa garis).
   * o: { size, scale, blur (motion blur px saat bergeser), icon: (ctx, cx, cy, r) => {} }
   * Kembalikan lebar pil.
   */
  K.pill = (ctx, text, cx, cy, { variant = 'putih', size = 38, scale = 1, blur = 0, icon, iconRight } = {}) => {
    const P = K.TERANG;
    ctx.save();
    ctx.font = K.font(700, size);
    ctx.letterSpacing = `${-size * 0.02}px`;
    const tw = ctx.measureText(text).width;
    const ir = icon || iconRight ? size * 0.62 : 0;
    const padX = size * 0.6;
    const w = tw + padX * 2 + (icon ? ir * 2 + size * 0.3 : 0) + (iconRight ? ir * 2 + size * 0.3 : 0);
    const h = size * 1.75;
    if (scale <= 0.001) {
      ctx.restore();
      return w;
    }
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    if (blur > 0) ctx.filter = `blur(${blur}px)`;
    const x = -w / 2;
    const y = -h / 2;
    if (variant !== 'abu') {
      ctx.fillStyle = P.ink;
      ctx.beginPath();
      ctx.roundRect(x + 5, y + 5, w, h, h / 2);
      ctx.fill();
    }
    ctx.fillStyle = variant === 'marun' ? P.maroon : variant === 'abu' ? P.chip : P.card;
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, h / 2);
    ctx.fill();
    if (variant !== 'abu') ctx.stroke();
    let tx = x + padX;
    if (icon) {
      icon(ctx, tx + ir, 0, ir);
      tx += ir * 2 + size * 0.3;
    }
    ctx.fillStyle = variant === 'marun' ? '#ffffff' : variant === 'abu' ? P.sub : P.ink;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, tx, size * 0.04);
    if (iconRight) iconRight(ctx, tx + tw + size * 0.3 + ir, 0, ir);
    ctx.restore();
    return w;
  };

  /** Ikon bulat marun dengan huruf/simbol putih (pengganti logo; jangan meniru logo brand lain). */
  K.dotIcon = (ch = '', color = K.TERANG.maroon) => (ctx, cx, cy, r) => {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    if (ch) {
      ctx.fillStyle = '#fff';
      ctx.font = K.font(800, r * 1.15);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ch, cx, cy + r * 0.05);
    }
    ctx.restore();
  };
  /** Ikon gelembung chat hijau sederhana. */
  K.chatIcon = (ctx, cx, cy, r) => {
    ctx.save();
    ctx.fillStyle = K.TERANG.green;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.75, cy + r * 0.45);
    ctx.lineTo(cx - r * 1.05, cy + r * 1.05);
    ctx.lineTo(cx - r * 0.25, cy + r * 0.85);
    ctx.fill();
    ctx.fillStyle = '#fff';
    for (const dx of [-0.42, 0, 0.42]) {
      ctx.beginPath();
      ctx.arc(cx + dx * r, cy, r * 0.13, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  /** Pil merek kanal di kiri atas (nama kanal pengguna + ikon huruf awal). */
  K.brand = (ctx, name, x = 80, y = 132, scale = 1) => {
    if (!name) return;
    ctx.save();
    ctx.font = K.font(800, 40);
    const w = ctx.measureText(name).width + 150;
    ctx.restore();
    K.pill(ctx, name, x + w / 2, y, { size: 40, scale, icon: K.dotIcon(name[0]?.toUpperCase()) });
  };

  /**
   * Garis cabang ortogonal dari satu titik ke beberapa titik (diagram pohon), digambar progresif u 0..1.
   * from {x,y}; tos [{x,y}]; o: { color, width, dots, midY }
   */
  K.tree = (ctx, from, tos, u, { color = K.TERANG.ink, width = 6, dots = true, midY } = {}) => {
    if (u <= 0) return;
    const my = midY ?? (from.y + Math.min(...tos.map((p) => p.y))) / 2;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const p of tos) {
      const pts = [from, { x: from.x, y: my }, { x: p.x, y: my }, p];
      partialPath(ctx, pts, u);
      if (dots && u >= 1) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, width * 1.25, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  };
  function partialPath(ctx, pts, u) {
    const lens = [];
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      const l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      lens.push(l);
      total += l;
    }
    let left = total * HF.clamp(u);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length && left > 0; i++) {
      const k = Math.min(1, left / Math.max(1e-6, lens[i - 1]));
      ctx.lineTo(HF.lerp(pts[i - 1].x, pts[i].x, k), HF.lerp(pts[i - 1].y, pts[i].y, k));
      left -= lens[i - 1];
    }
    ctx.stroke();
  }
  K.partialPath = partialPath;

  /** Catatan kecil abu di bawah (sumber / keterangan). */
  K.note = (ctx, text, x, y, alpha = 1) => K.text(ctx, text, x, y, { size: 30, weight: 500, color: K.TERANG.sub, align: 'left', alpha, spacing: 0 });
  /** Chip abu kecil ("Ilustrasi · data contoh"). */
  K.chip = (ctx, text, x, y, alpha = 1) => {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.font = K.font(500, 27);
    const w = ctx.measureText(text).width + 36;
    ctx.fillStyle = K.TERANG.chip;
    ctx.beginPath();
    ctx.roundRect(x, y - 24, w, 48, 24);
    ctx.fill();
    ctx.fillStyle = K.TERANG.sub;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + 18, y + 1);
    ctx.restore();
  };

  /**
   * Benda kecil jatuh menumpuk (mis. pesan menumpuk di satu kartu). Deterministik dari seed.
   * o: { n (jumlah yang sudah jatuh pada waktu t, boleh pecahan), x, floorY, w (lebar tumpukan), size, seed }
   */
  K.pile = (ctx, t, { n, x, floorY, w = 160, size = 30, seed = 7, color = K.TERANG.card } = {}) => {
    const rnd = HF.rng(seed);
    const cols = Math.max(1, Math.floor(w / (size * 1.15)));
    const count = Math.floor(n);
    for (let i = 0; i < count + 1; i++) {
      const jitter = (rnd() - 0.5) * size * 0.3;
      const rot = (rnd() - 0.5) * 0.5;
      if (i >= count) break;
      const col = i % cols;
      const row = Math.floor(i / cols);
      const px = x - w / 2 + size * 0.6 + col * size * 1.15 + jitter;
      const py = floorY - size * 0.4 - row * size * 0.72;
      const fall = i === count - 1 ? HF.ease.out(n - count + 1 > 1 ? 1 : n - count + 1) : 1;
      ctx.save();
      ctx.translate(px, py - (1 - fall) * 220);
      ctx.rotate(rot * (1 - fall * 0.6));
      ctx.fillStyle = color;
      ctx.strokeStyle = K.TERANG.ink;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(-size * 0.55, -size * 0.36, size * 1.1, size * 0.72, size * 0.2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  };

  window.K = K;
})();
