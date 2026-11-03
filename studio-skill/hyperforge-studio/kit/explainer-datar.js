/* HyperForge Studio: pustaka gambar gaya "Explainer datar" (canvas 2D). Dimuat SETELAH studio-kit.js:
 *   <script src="/kit/studio-kit.js"></script><script src="/kit/explainer-datar.js"></script>
 *
 * Tujuannya satu: tokoh dan benda selalu tergambar dengan aturan yang sama (proporsi, arah cahaya, bayangan,
 * garis tepi terang), jadi tidak "melenceng" dari gaya. JANGAN menggambar tokoh dari nol: panggil XD.tokoh dengan
 * parameter. Benda baru dibuat dengan XD.bentuk (isi + bayangan sabit) supaya ikut aturan yang sama.
 *
 * Aturan cahaya: cahaya dari KIRI-ATAS. Bayangan sabit selalu di sisi KANAN-BAWAH tiap bentuk, garis tepi terang
 * (siluet bergeser) di KIRI-ATAS. Semua ukuran dalam satuan lokal; (x, y) = titik tumpu di tanah, s = skala.
 * Semua deterministik dari t (detik).
 */
(function () {
  const XD = {};

  // ---------- warna ----------
  const hex2rgb = (h) => {
    const n = parseInt(String(h).replace('#', ''), 16);
    return [n >> 16, (n >> 8) & 255, n & 255];
  };
  const rgb2hex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  /** campur dua warna HEX, u = 0..1 menuju b */
  XD.mix = (a, b, u) => {
    const A = hex2rgb(a);
    const B = hex2rgb(b);
    return rgb2hex(A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u, A[2] + (B[2] - A[2]) * u);
  };
  /** warna bayangan: lebih gelap 14% dan sedikit ke ungu-cokelat (bukan hitam/abu) */
  XD.gelap = (c, k = 0.86) => {
    const [r, g, b] = hex2rgb(c);
    return XD.mix(rgb2hex(r * k, g * k, b * k), '#4b3550', 0.1);
  };
  XD.terang = (c, u = 0.22) => XD.mix(c, '#fff8e8', u);
  /** warna garis tepi terang untuk latar tertentu */
  XD.rimUntuk = (latar) => XD.mix(latar, '#fff1cf', 0.38);

  /** Palet bawaan (hangat, agak redup) + satu aksen informasi. */
  XD.palet = {
    kulit: ['#f6d7b8', '#e9b98f', '#d39a6a', '#b97b4b', '#8f5a35'],
    rambut: ['#2b2320', '#3d2b22', '#5a4030', '#7a5a3a', '#d9d2c6'],
    baju: ['#e88f7a', '#7fa7c4', '#9fb47a', '#e2b45a', '#c9a6d6', '#f1ece0', '#3e4a5c'],
    celana: ['#3e4a5c', '#5a4a3e', '#6b7a8f', '#2f2a28'],
    aksen: '#e2534a',
    emas: '#f2c14e',
    biru: '#5b9bd5',
    hijau: '#7cc576',
    tinta: '#1f1a17',
  };

  // ---------- jalur ----------
  /** Superelips (kotak membulat yang "gemuk"), taper = mengecil di atas. Bentuk kepala & benda bulat. */
  XD.squircle = (cx, cy, rx, ry, n = 2.6, taper = 0.08) => {
    const p = new Path2D();
    for (let i = 0; i <= 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const k = 1 - taper * Math.max(0, -s);
      const x = cx + rx * k * Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
      const y = cy + ry * Math.sign(s) * Math.pow(Math.abs(s), 2 / n);
      i ? p.lineTo(x, y) : p.moveTo(x, y);
    }
    p.closePath();
    return p;
  };
  XD.ellipse = (cx, cy, rx, ry, rot = 0) => {
    const p = new Path2D();
    p.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
    return p;
  };
  XD.rect = (x, y, w, h, r = 0) => {
    const p = new Path2D();
    p.roundRect(x, y, w, h, r);
    return p;
  };
  /** poligon dengan sudut dibulatkan (radius r) dari titik [[x,y],...] */
  XD.poly = (pts, r = 0) => {
    const p = new Path2D();
    const n = pts.length;
    if (!r) {
      pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
      p.closePath();
      return p;
    }
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const start = mid(pts[n - 1], pts[0]);
    p.moveTo(start[0], start[1]);
    for (let i = 0; i < n; i++) {
      const c = pts[i];
      const nx = mid(c, pts[(i + 1) % n]);
      p.arcTo(c[0], c[1], nx[0], nx[1], r);
    }
    p.closePath();
    return p;
  };

  // ---------- mode siluet (garis tepi terang) ----------
  let SIL = null;
  /**
   * Isi bentuk dengan warna dasar + bayangan sabit di kanan-bawah (sd = lebar sabit, satuan lokal;
   * k = seberapa gelap bayangan). Dalam mode siluet hanya mengisi warna siluet.
   */
  XD.bentuk = (ctx, path, warna, o = {}) => {
    const rule = o.evenodd ? 'evenodd' : 'nonzero';
    if (SIL) {
      ctx.fillStyle = SIL;
      ctx.fill(path, rule);
      return;
    }
    const sd = o.sd ?? 10;
    ctx.fillStyle = sd > 0 ? o.bayangan ?? XD.gelap(warna, o.k ?? 0.86) : warna;
    ctx.fill(path, rule);
    if (sd <= 0) return;
    ctx.save();
    ctx.clip(path, rule);
    ctx.translate(-sd, -sd * 0.45);
    ctx.fillStyle = warna;
    ctx.fill(path, rule);
    ctx.restore();
  };
  /** Garis tebal (lengan, tali) dengan bayangan sabit. */
  XD.garis = (ctx, pts, lebar, warna, o = {}) => {
    const p = new Path2D();
    pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = lebar;
    if (SIL) {
      ctx.strokeStyle = SIL;
      ctx.stroke(p);
      ctx.restore();
      return;
    }
    const sd = o.sd ?? lebar * 0.22;
    ctx.strokeStyle = XD.gelap(warna, o.k ?? 0.86);
    ctx.stroke(p);
    ctx.translate(-sd, -sd * 0.5);
    ctx.lineWidth = lebar - sd * 0.6;
    ctx.strokeStyle = warna;
    ctx.stroke(p);
    ctx.restore();
  };
  /**
   * Gambar sesuatu dengan garis tepi terang: gambar(ctx) dipanggil dua kali, sekali sebagai siluet
   * (warna rim, bergeser ke kiri-atas sejauh off) lalu normal.
   */
  XD.denganTepi = (ctx, rim, off, gambar) => {
    if (rim) {
      ctx.save();
      ctx.translate(-off, -off * 0.8);
      SIL = rim;
      try {
        gambar(ctx);
      } finally {
        SIL = null;
      }
      ctx.restore();
    }
    gambar(ctx);
  };
  XD.siluet = () => Boolean(SIL);

  /** bayangan jatuh lembut di tanah */
  XD.bayanganTanah = (ctx, x, y, rx, a = 0.2) => {
    if (SIL) return;
    ctx.save();
    ctx.fillStyle = `rgba(30,18,10,${a})`;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, rx * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  // ---------- tokoh ----------
  // Proporsi (satuan lokal, s = 1): tinggi total ~330, kepala lebar 208 x tinggi 180 (~55% tinggi),
  // kepala menempel langsung ke badan (tanpa leher), badan pendek, kaki pendek.
  const KEPALA = { cy: -232, rx: 104, ry: 90 };
  const BAHU = { x: 60, y: -136 };
  const LENGAN = { atas: 60, bawah: 56, tebal: 30, tangan: 16 };

  /** Pose = sudut lengan [atas, bawah] dalam derajat (0 = lurus ke bawah, + = menjauh dari badan, 180 = ke atas).
   *  depan: lengan digambar di depan kepala. */
  XD.POSE = {
    diam: { k: [12, 6], i: [12, 6] },
    tunjuk: { k: [125, 100], i: [12, 6] },
    lambai: { k: [108, (t) => 162 + 20 * Math.sin(t * 9)], i: [12, 6] },
    pegang: { k: [18, -78], i: [18, -78], depan: true },
    kepala: { k: [118, 172], i: [118, 172], depan: true },
    garuk: { k: [118, 172], i: [12, 6], depan: true },
    tanya: { k: [45, 118], i: [45, 118] },
    hitung: { k: [30, 158], i: [12, 6], depan: true },
    sedekap: { k: [22, -95], i: [22, -88], depan: true },
  };
  XD.EKSPRESI = ['netral', 'senang', 'senyum', 'sedih', 'kaget', 'marah', 'ragu', 'mantap'];

  function lengan(ctx, sisi, pose, t, warnaLengan, kulit) {
    const def = pose[sisi > 0 ? 'k' : 'i'];
    const val = (v) => (typeof v === 'function' ? v(t) : v);
    const a1 = (val(def[0]) * Math.PI) / 180;
    const a2 = (val(def[1]) * Math.PI) / 180;
    const sx = BAHU.x * sisi;
    const sy = BAHU.y;
    const ex = sx + sisi * Math.sin(a1) * LENGAN.atas;
    const ey = sy + Math.cos(a1) * LENGAN.atas;
    const hx = ex + sisi * Math.sin(a2) * LENGAN.bawah;
    const hy = ey + Math.cos(a2) * LENGAN.bawah;
    XD.garis(ctx, [[sx, sy], [ex, ey], [hx, hy]], LENGAN.tebal, warnaLengan);
    XD.bentuk(ctx, XD.ellipse(hx, hy, LENGAN.tangan, LENGAN.tangan), kulit, { sd: 4 });
    return [hx, hy];
  }

  function rambutBelakang(ctx, gaya, c) {
    const { cy, rx, ry } = KEPALA;
    if (gaya === 'bob' || gaya === 'panjang') {
      const panjang = gaya === 'panjang' ? 1.25 : 0.95;
      XD.bentuk(ctx, XD.rect(-rx - 16, cy - ry - 6, 2 * (rx + 16), ry * (1 + panjang), [rx, rx, 34, 34]), c, { sd: 12 });
    } else if (gaya === 'kuncir') {
      XD.bentuk(ctx, XD.rect(-rx - 10, cy - ry - 4, 2 * (rx + 10), ry * 1.55, [rx, rx, 30, 30]), c, { sd: 10 });
      XD.bentuk(ctx, XD.ellipse(-rx * 0.62, cy - ry - 4, 36, 34), c, { sd: 8 });
    }
  }

  function rambutDepan(ctx, gaya, c) {
    const { cy, rx, ry } = KEPALA;
    if (gaya === 'botak' || !gaya) return;
    const p = new Path2D();
    const R = rx + 7;
    const RY = ry + 7;
    // tepi atas mengikuti kepala
    for (let i = 0; i <= 36; i++) {
      const a = Math.PI + (i / 36) * Math.PI;
      const cs = Math.cos(a);
      const sn = Math.sin(a);
      const k = 1 - 0.08 * Math.max(0, -sn);
      const x = R * k * Math.sign(cs) * Math.pow(Math.abs(cs), 2 / 2.6);
      const y = cy - 6 + RY * Math.sign(sn) * Math.pow(Math.abs(sn), 2 / 2.6);
      i ? p.lineTo(x, y) : p.moveTo(x, y);
    }
    if (gaya === 'bob' || gaya === 'kuncir' || gaya === 'panjang') {
      // poni rata
      p.lineTo(R - 2, cy + 12);
      p.quadraticCurveTo(rx * 0.75, cy - 34, rx * 0.2, cy - 38);
      p.quadraticCurveTo(-rx * 0.5, cy - 40, -R + 2, cy + 12);
    } else if (gaya === 'cepak') {
      p.lineTo(R - 6, cy - 34);
      p.quadraticCurveTo(0, cy - 70, -R + 6, cy - 34);
    } else {
      // pendek / keriting: belahan samping + cambang
      p.lineTo(R - 2, cy + 8);
      p.lineTo(rx - 10, cy + 6);
      p.quadraticCurveTo(rx * 0.5, cy - 52, -rx * 0.12, cy - 50);
      p.quadraticCurveTo(-rx * 0.62, cy - 46, -rx + 10, cy + 6);
      p.lineTo(-R + 2, cy + 8);
    }
    p.closePath();
    XD.bentuk(ctx, p, c, { sd: 9 });
    if (gaya === 'keriting') {
      for (const sx of [-1, 1]) for (let j = 0; j < 4; j++) XD.bentuk(ctx, XD.ellipse(sx * (rx + 2 - j * 4), cy - 16 + j * 15, 14, 13), c, { sd: 4 });
    }
  }

  function topi(ctx, jenis, o) {
    const { cy, rx, ry } = KEPALA;
    if (!jenis) return;
    if (jenis === 'helm') {
      const w = o.warnaTopi ?? '#e7b04a';
      const dome = new Path2D();
      dome.ellipse(0, cy - ry * 0.28, rx + 14, ry * 0.95, 0, Math.PI, Math.PI * 2);
      dome.closePath();
      XD.bentuk(ctx, dome, w, { sd: 12 });
      XD.bentuk(ctx, XD.rect(-rx - 34, cy - ry * 0.28 - 8, 2 * (rx + 34), 26, 13), w, { sd: 6, k: 0.8 });
      // lampu
      XD.bentuk(ctx, XD.ellipse(0, cy - ry * 0.7, 24, 24), '#e9e3cf', { sd: 4 });
      if (!SIL) {
        ctx.fillStyle = '#fff4bf';
        ctx.beginPath();
        ctx.arc(-2, cy - ry * 0.7 - 1, 13, 0, Math.PI * 2);
        ctx.fill();
        if (o.lampuNyala) {
          const g = ctx.createRadialGradient(0, cy - ry * 0.7, 6, 0, cy - ry * 0.7, 90);
          g.addColorStop(0, 'rgba(255,240,170,0.55)');
          g.addColorStop(1, 'rgba(255,240,170,0)');
          ctx.fillStyle = g;
          ctx.fillRect(-90, cy - ry * 0.7 - 90, 180, 180);
        }
      }
    } else if (jenis === 'peci') {
      const w = o.warnaTopi ?? '#2a2522';
      XD.bentuk(ctx, XD.poly([[-rx * 0.8, cy - ry * 0.52], [rx * 0.8, cy - ry * 0.52], [rx * 0.7, cy - ry - 30], [-rx * 0.7, cy - ry - 30]], 10), w, { sd: 10, k: 0.75 });
    } else if (jenis === 'topi') {
      const w = o.warnaTopi ?? '#e2534a';
      const dome = new Path2D();
      dome.ellipse(0, cy - ry * 0.42, rx + 6, ry * 0.8, 0, Math.PI, Math.PI * 2);
      dome.closePath();
      XD.bentuk(ctx, dome, w, { sd: 10 });
      XD.bentuk(ctx, XD.rect(-rx * 0.2, cy - ry * 0.42 - 6, rx * 1.55, 20, 10), w, { sd: 5, k: 0.8 });
    } else if (jenis === 'kerudung') {
      // bingkai depan: menutup dahi dan sisi wajah, wajah terlihat di lubang oval
      const w = o.warnaTopi ?? '#c9a6d6';
      const p = XD.squircle(0, cy - 6, rx + 18, ry + 18);
      p.addPath(XD.ellipse(0, cy + 22, rx * 0.74, ry * 0.7));
      XD.bentuk(ctx, p, w, { sd: 12, evenodd: true });
    }
  }

  /** Bagian kerudung di belakang kepala: menjuntai menutup leher sampai bahu. */
  function kerudungBelakang(ctx, o) {
    const { cy, rx, ry } = KEPALA;
    const w = o.warnaTopi ?? '#c9a6d6';
    XD.bentuk(ctx, XD.poly([[-rx - 10, cy], [rx + 10, cy], [rx - 6, cy + ry + 36], [-rx + 6, cy + ry + 36]], 36), w, { sd: 14 });
  }

  function wajah(ctx, o, t) {
    if (SIL) return;
    const { cy, rx } = KEPALA;
    const ink = XD.palet.tinta;
    const lx = (o.lihat ?? 0) * 12;
    const ey = cy + 20;
    const ex = 42;
    const ek = o.ekspresi ?? 'netral';
    const id = o.id ?? 1;
    const tt = HF.stepTime(t, 12);
    const per = 3.1 + (id % 5) * 0.37;
    const kedip = o.kedip !== false && ((tt + id * 0.77) % per) < 0.12;
    ctx.save();
    ctx.fillStyle = ink;
    ctx.strokeStyle = ink;
    ctx.lineCap = 'round';
    // mata
    for (const sx of [-1, 1]) {
      const x = sx * ex + lx;
      if (kedip) {
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(x - 9, ey);
        ctx.lineTo(x + 9, ey);
        ctx.stroke();
      } else if (ek === 'senang') {
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(x, ey + 4, 10, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
      } else {
        const r = ek === 'kaget' ? 11 : 8.5;
        ctx.beginPath();
        ctx.arc(x, ey, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // alis
    const alis = { netral: 0, senang: 0, senyum: 0, sedih: -0.45, kaget: 0, marah: 0.5, ragu: [0.35, -0.3], mantap: 0.15 }[ek] ?? 0;
    const naik = ek === 'kaget' ? -10 : 0;
    ctx.lineWidth = 5;
    for (const sx of [-1, 1]) {
      const a = Array.isArray(alis) ? alis[sx < 0 ? 0 : 1] : alis;
      const x = sx * ex + lx;
      const y = ey - 26 + naik;
      ctx.save();
      ctx.translate(x, y);
      // a > 0: ujung dalam turun (marah); a < 0: ujung dalam naik (sedih)
      ctx.rotate(-sx * a);
      ctx.beginPath();
      ctx.moveTo(-9, 0);
      ctx.lineTo(9, 0);
      ctx.stroke();
      ctx.restore();
    }
    // mulut (kecil; bicara = membuka-menutup)
    const my = ey + 34;
    const mx = lx * 0.7;
    ctx.lineWidth = 4.5;
    if (o.bicara) {
      const buka = 2 + 8 * HF.noise(tt * 9, id);
      ctx.beginPath();
      ctx.ellipse(mx, my, 8, buka, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (ek === 'senang' || ek === 'senyum') {
      ctx.beginPath();
      ctx.arc(mx, my - 6, 9, Math.PI * 0.2, Math.PI * 0.8);
      ctx.stroke();
    } else if (ek === 'sedih') {
      ctx.beginPath();
      ctx.arc(mx, my + 6, 8, Math.PI * 1.2, Math.PI * 1.8);
      ctx.stroke();
    } else if (ek === 'kaget') {
      ctx.beginPath();
      ctx.ellipse(mx, my, 6, 8, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (ek === 'marah' || ek === 'ragu') {
      ctx.beginPath();
      ctx.moveTo(mx - 8, my);
      ctx.lineTo(mx + 8, my + (ek === 'ragu' ? -3 : 0));
      ctx.stroke();
    }
    // pipi merona
    if (ek === 'senang' || ek === 'senyum') {
      ctx.fillStyle = 'rgba(232,110,110,0.22)';
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(sx * (ex + 22) + lx, ey + 18, 13, 8, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // kumis (opsional)
    if (o.kumis) {
      ctx.fillStyle = o.rambut ?? ink;
      ctx.beginPath();
      ctx.ellipse(mx - 12, my - 10, 14, 6, 0.25, 0, Math.PI * 2);
      ctx.ellipse(mx + 12, my - 10, 14, 6, -0.25, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    void rx;
  }

  function badan(ctx, o, napas) {
    const baju = o.baju ?? XD.palet.baju[1];
    const celana = o.celana ?? XD.palet.celana[0];
    const sepatu = o.sepatu ?? '#2f2a28';
    // kaki
    for (const sx of [-1, 1]) {
      XD.bentuk(ctx, XD.rect(sx > 0 ? 8 : -56, -48, 48, 42, 10), celana, { sd: 6 });
      XD.bentuk(ctx, XD.ellipse(sx * 34, -6, 30, 12), sepatu, { sd: 5 });
    }
    // badan (trapesium, bahu membulat)
    const top = -154 - napas;
    const p = XD.poly([[-62, top], [62, top], [76, -38], [-76, -38]], 26);
    XD.bentuk(ctx, p, baju, { sd: 16 });
    if (SIL) return;
    if (o.kerah === 'v' || o.kerah === undefined) {
      XD.bentuk(ctx, XD.poly([[-22, top + 2], [22, top + 2], [0, top + 34]], 4), o.warnaKerah ?? XD.terang(baju, 0.75), { sd: 4 });
    } else if (o.kerah === 'kemeja') {
      XD.bentuk(ctx, XD.poly([[-30, top + 2], [-2, top + 2], [-4, top + 30]], 4), '#f4f0e6', { sd: 3 });
      XD.bentuk(ctx, XD.poly([[30, top + 2], [2, top + 2], [4, top + 30]], 4), '#f4f0e6', { sd: 3 });
      if (o.dasi) XD.bentuk(ctx, XD.poly([[-7, top + 18], [7, top + 18], [9, top + 70], [0, top + 82], [-9, top + 70]], 3), o.dasi, { sd: 3 });
    }
    if (o.overall) {
      XD.bentuk(ctx, XD.rect(-44, top + 40, 88, -38 - (top + 40), 10), o.overall, { sd: 10 });
      XD.garis(ctx, [[-40, top + 44], [-50, top + 4]], 12, o.overall);
      XD.garis(ctx, [[40, top + 44], [50, top + 4]], 12, o.overall);
      ctx.fillStyle = XD.terang(o.overall, 0.5);
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(sx * 36, top + 50, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /**
   * Tokoh explainer. (x, y) = titik tumpu di tanah, s = skala (s=1 tinggi ~330 px).
   * o = {
   *   t, id (angka unik per tokoh: kedip tidak serempak),
   *   kulit, rambut, gayaRambut: 'pendek'|'cepak'|'keriting'|'bob'|'kuncir'|'panjang'|'botak',
   *   topi: null|'helm'|'peci'|'topi'|'kerudung', warnaTopi, lampuNyala,
   *   baju, kerah: 'v'|'kemeja'|'bulat', dasi, overall, celana, sepatu, kumis,
   *   ekspresi: XD.EKSPRESI, pose: kunci XD.POSE, bicara: bool, lihat: -1..1, hadap: 1|-1,
   *   rim: warna garis tepi terang (XD.rimUntuk(latar)), napas: true
   * }
   * Mengembalikan posisi tangan kanan & kiri di layar ({kanan:[x,y], kiri:[x,y]}) untuk menempel benda.
   */
  XD.tokoh = (ctx, x, y, s, o = {}) => {
    const t = o.t ?? 0;
    const tt = HF.stepTime(t, 12);
    const pose = XD.POSE[o.pose ?? 'diam'] ?? XD.POSE.diam;
    const kulit = o.kulit ?? XD.palet.kulit[1];
    const rambut = o.rambut ?? XD.palet.rambut[0];
    const napas = o.napas === false ? 0 : 1.5 + 1.5 * Math.sin(tt * 2.4 + (o.id ?? 1));
    const tangan = {};
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s * (o.hadap === -1 ? -1 : 1), s);
    XD.bayanganTanah(ctx, 0, 0, 120, 0.2);
    const gambar = (c) => {
      const lenganWarna = o.lengan ?? o.baju ?? XD.palet.baju[1];
      if (!pose.depan) {
        tangan.kanan = lengan(c, 1, pose, tt, lenganWarna, kulit);
        tangan.kiri = lengan(c, -1, pose, tt, lenganWarna, kulit);
      }
      badan(c, o, napas);
      c.save();
      c.translate(0, -napas * 0.6);
      if (o.topi !== 'kerudung') rambutBelakang(c, o.gayaRambut ?? 'pendek', rambut);
      else kerudungBelakang(c, o);
      // telinga kecil (tertutup rambut panjang)
      if (!['bob', 'panjang', 'kuncir'].includes(o.gayaRambut) && o.topi !== 'kerudung') {
        for (const sx of [-1, 1]) XD.bentuk(c, XD.ellipse(sx * (KEPALA.rx - 2), KEPALA.cy + 14, 16, 20), kulit, { sd: 4 });
      }
      XD.bentuk(c, XD.squircle(0, KEPALA.cy, KEPALA.rx, KEPALA.ry), kulit, { sd: 16 });
      if (o.topi !== 'kerudung') rambutDepan(c, o.gayaRambut ?? 'pendek', rambut);
      if (o.topi) topi(c, o.topi, o);
      wajah(c, { ...o, rambut }, t);
      c.restore();
      if (pose.depan) {
        tangan.kanan = lengan(c, 1, pose, tt, lenganWarna, kulit);
        tangan.kiri = lengan(c, -1, pose, tt, lenganWarna, kulit);
      }
    };
    XD.denganTepi(ctx, o.rim, 6, gambar);
    ctx.restore();
    const ke = (p) => (p ? [x + p[0] * s * (o.hadap === -1 ? -1 : 1), y + p[1] * s] : null);
    return { kanan: ke(tangan.kanan), kiri: ke(tangan.kiri) };
  };

  // ---------- benda (tampak depan sedikit dari atas; cahaya kiri-atas) ----------
  function benda(ctx, x, y, s, o, fn) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(o.rot ?? 0);
    ctx.scale(s, s);
    if (o.tanah !== false) XD.bayanganTanah(ctx, 0, 0, o.lebarBayangan ?? 90, 0.18);
    XD.denganTepi(ctx, o.rim, 5, fn);
    ctx.restore();
  }

  /** Batang emas (tumpuk: jumlah baris, mis. 3 -> 3-2-1). */
  XD.emas = (ctx, x, y, s = 1, o = {}) =>
    benda(ctx, x, y, s, { lebarBayangan: 85 * (o.tumpuk ?? 1), ...o }, (c) => {
      const w = o.warna ?? XD.palet.emas;
      const rows = o.tumpuk ?? 1;
      for (let r = 0; r < rows; r++) {
        const n = rows - r;
        for (let i = 0; i < n; i++) {
          const bx = (i - (n - 1) / 2) * 150;
          const by = -r * 52;
          XD.bentuk(c, XD.poly([[bx - 62, by - 52], [bx + 62, by - 52], [bx + 50, by - 70], [bx - 50, by - 70]], 4), XD.terang(w, 0.3), { sd: 3 });
          XD.bentuk(c, XD.poly([[bx - 74, by], [bx + 74, by], [bx + 62, by - 52], [bx - 62, by - 52]], 5), w, { sd: 12 });
          if (!SIL) {
            c.fillStyle = 'rgba(255,255,255,0.35)';
            c.fillRect(bx - 50, by - 44, 34, 6);
          }
        }
      }
    });

  /** Koin (tampak sedikit miring). */
  XD.koin = (ctx, x, y, s = 1, o = {}) =>
    benda(ctx, x, y, s, { lebarBayangan: 50, ...o }, (c) => {
      const w = o.warna ?? XD.palet.emas;
      XD.bentuk(c, XD.ellipse(0, -46, 50, 50), XD.gelap(w, 0.78), { sd: 0 });
      XD.bentuk(c, XD.ellipse(-5, -50, 48, 48), w, { sd: 8 });
      if (!SIL) {
        c.strokeStyle = XD.terang(w, 0.35);
        c.lineWidth = 5;
        c.beginPath();
        c.arc(-5, -50, 32, 0, Math.PI * 2);
        c.stroke();
        c.fillStyle = XD.gelap(w, 0.85);
        c.beginPath();
        c.arc(-5, -50, 12, 0, Math.PI * 2);
        c.fill();
      }
    });

  /** Lembar uang (generik, bukan mata uang asli). Dipegang: XD.uang(ctx, tangan.kanan[0], ..., {tanah:false}). */
  XD.uang = (ctx, x, y, s = 1, o = {}) =>
    benda(ctx, x, y, s, { tanah: false, ...o }, (c) => {
      const w = o.warna ?? XD.palet.hijau;
      XD.bentuk(c, XD.rect(-110, -55, 220, 110, 10), w, { sd: 8 });
      if (SIL) return;
      c.strokeStyle = XD.terang(w, 0.45);
      c.lineWidth = 5;
      c.strokeRect(-96, -42, 192, 84);
      c.fillStyle = XD.gelap(w, 0.8);
      c.beginPath();
      c.arc(0, 0, 26, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = XD.terang(w, 0.5);
      c.beginPath();
      c.arc(0, 0, 14, 0, Math.PI * 2);
      c.fill();
      for (const sx of [-1, 1]) c.fillRect(sx * 70 - 10, -24, 20, 48);
    });

  /** Kardus. */
  XD.kotak = (ctx, x, y, s = 1, o = {}) =>
    benda(ctx, x, y, s, { lebarBayangan: 100, ...o }, (c) => {
      const w = o.warna ?? '#d2a46c';
      XD.bentuk(c, XD.poly([[-80, -120], [80, -120], [64, -146], [-64, -146]], 4), XD.terang(w, 0.25), { sd: 3 });
      XD.bentuk(c, XD.rect(-80, -120, 160, 120, 6), w, { sd: 14 });
      if (SIL) return;
      c.fillStyle = XD.terang(w, 0.4);
      c.fillRect(-14, -146, 28, 70);
    });

  /** Batu / bijih (bijih: true = bintik emas). seed = bentuk berbeda. */
  XD.batu = (ctx, x, y, s = 1, o = {}) =>
    benda(ctx, x, y, s, { lebarBayangan: 80, ...o }, (c) => {
      const w = o.warna ?? '#8a8378';
      const r = HF.rng(o.seed ?? 3);
      const pts = [];
      for (let i = 0; i < 7; i++) {
        const a = Math.PI + (i / 6) * Math.PI;
        const rr = 60 + r() * 22;
        pts.push([Math.cos(a) * rr * 1.2, Math.sin(a) * rr * 0.95]);
      }
      XD.bentuk(c, XD.poly(pts, 12), w, { sd: 14 });
      if (SIL || !o.bijih) return;
      c.fillStyle = XD.palet.emas;
      for (let i = 0; i < 6; i++) {
        c.beginPath();
        c.arc(-40 + r() * 80, -50 + r() * 40, 5 + r() * 5, 0, Math.PI * 2);
        c.fill();
      }
    });

  /** Permata (berlian sederhana). */
  XD.permata = (ctx, x, y, s = 1, o = {}) =>
    benda(ctx, x, y, s, { lebarBayangan: 50, ...o }, (c) => {
      const w = o.warna ?? '#3fd0c9';
      XD.bentuk(c, XD.poly([[-50, -80], [50, -80], [70, -58], [0, 0], [-70, -58]], 3), w, { sd: 10 });
      if (SIL) return;
      c.fillStyle = XD.terang(w, 0.45);
      c.beginPath();
      c.moveTo(-50, -80);
      c.lineTo(-20, -58);
      c.lineTo(-70, -58);
      c.closePath();
      c.fill();
      c.fillStyle = XD.terang(w, 0.25);
      c.beginPath();
      c.moveTo(-20, -58);
      c.lineTo(20, -58);
      c.lineTo(0, -4);
      c.closePath();
      c.fill();
    });

  /** Gedung (latar / kota). w, h dalam satuan lokal. */
  XD.gedung = (ctx, x, y, s = 1, o = {}) =>
    benda(ctx, x, y, s, { tanah: false, ...o }, (c) => {
      const w = o.lebar ?? 160;
      const h = o.tinggi ?? 320;
      const warna = o.warna ?? '#b9a48c';
      XD.bentuk(c, XD.rect(-w / 2, -h, w, h, 8), warna, { sd: 14 });
      if (SIL) return;
      c.fillStyle = o.jendela ?? XD.mix(warna, '#fff1cf', 0.4);
      const cols = Math.max(2, Math.round(w / 50));
      const rows = Math.max(2, Math.round(h / 60));
      for (let i = 0; i < cols; i++)
        for (let j = 0; j < rows - 1; j++) {
          const jx = -w / 2 + ((i + 0.5) * w) / cols - 10;
          const jy = -h + 24 + j * ((h - 40) / rows);
          c.beginPath();
          c.roundRect(jx, jy, 20, 26, 4);
          c.fill();
        }
    });

  /** Rumah sederhana. */
  XD.rumah = (ctx, x, y, s = 1, o = {}) =>
    benda(ctx, x, y, s, { lebarBayangan: 130, ...o }, (c) => {
      const dinding = o.warna ?? '#efe2c8';
      const atap = o.atap ?? '#c8644e';
      XD.bentuk(c, XD.rect(-110, -150, 220, 150, 6), dinding, { sd: 14 });
      XD.bentuk(c, XD.poly([[-140, -146], [140, -146], [0, -250]], 10), atap, { sd: 14 });
      if (SIL) return;
      XD.bentuk(c, XD.rect(-26, -96, 52, 96, [20, 20, 0, 0]), XD.gelap(dinding, 0.6), { sd: 6 });
      XD.bentuk(c, XD.rect(52, -112, 40, 40, 6), '#9cc3d5', { sd: 5 });
    });

  /** Pohon bulat. */
  XD.pohon = (ctx, x, y, s = 1, o = {}) =>
    benda(ctx, x, y, s, { lebarBayangan: 70, ...o }, (c) => {
      const daun = o.warna ?? '#7d9a52';
      XD.bentuk(c, XD.rect(-14, -120, 28, 120, 8), '#7a5a3a', { sd: 6 });
      XD.bentuk(c, XD.ellipse(-36, -150, 56, 50), daun, { sd: 10 });
      XD.bentuk(c, XD.ellipse(34, -146, 54, 48), daun, { sd: 10 });
      XD.bentuk(c, XD.ellipse(0, -196, 62, 56), daun, { sd: 12 });
    });

  /** Penanda lokasi di peta. */
  XD.pin = (ctx, x, y, s = 1, o = {}) =>
    benda(ctx, x, y, s, { tanah: false, ...o }, (c) => {
      const w = o.warna ?? XD.palet.aksen;
      const p = new Path2D();
      p.moveTo(0, 0);
      p.bezierCurveTo(-18, -26, -40, -46, -40, -72);
      p.arc(0, -72, 40, Math.PI, 0);
      p.bezierCurveTo(40, -46, 18, -26, 0, 0);
      XD.bentuk(c, p, w, { sd: 8 });
      if (SIL) return;
      c.fillStyle = '#fff6ea';
      c.beginPath();
      c.arc(-3, -74, 15, 0, Math.PI * 2);
      c.fill();
    });

  /** Panah tebal (arah: radian). */
  XD.panah = (ctx, x, y, s = 1, o = {}) =>
    benda(ctx, x, y, s, { tanah: false, rot: o.arah ?? 0, ...o }, (c) => {
      XD.bentuk(c, XD.poly([[-90, -18], [30, -18], [30, -44], [90, 0], [30, 44], [30, 18], [-90, 18]], 6), o.warna ?? XD.palet.aksen, { sd: 6 });
    });

  /**
   * Peta datar: kartu air + daratan (dari seed) + wilayah yang disorot. o.wilayah = [{x,y,r,label}] (satuan lokal,
   * pusat kartu = 0,0, kartu 520x380). Untuk peta nyata, gambar daratannya dari foto/peta referensi (bentuk mirip),
   * lalu sederhanakan jadi 10-20 titik dengan XD.poly(..., 18).
   */
  XD.peta = (ctx, x, y, s = 1, o = {}) =>
    benda(ctx, x, y, s, { tanah: false, ...o }, (c) => {
      const air = o.air ?? '#8fc4c9';
      const darat = o.darat ?? '#a9b25d';
      XD.bentuk(c, XD.rect(-260, -190, 520, 380, 22), air, { sd: 10 });
      if (SIL) return;
      const pts = o.daratan ?? (() => {
        const out = [];
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2;
          const r = 120 + 50 * HF.noise(i * 0.9, o.seed ?? 5);
          out.push([Math.cos(a) * r * 1.35, Math.sin(a) * r]);
        }
        return out;
      })();
      // tepi pantai terang
      c.save();
      c.strokeStyle = XD.terang(air, 0.45);
      c.lineWidth = 16;
      c.lineJoin = 'round';
      c.stroke(XD.poly(pts, 18));
      c.restore();
      XD.bentuk(c, XD.poly(pts, 18), darat, { sd: 8 });
      for (const w of o.wilayah ?? []) {
        const a = w.nyala ?? 1;
        c.globalAlpha = a;
        XD.bentuk(c, XD.ellipse(w.x, w.y, w.r * 1.2, w.r, w.rot ?? 0.3), w.warna ?? XD.palet.aksen, { sd: 5 });
        c.globalAlpha = 1;
        if (w.label) {
          c.fillStyle = XD.palet.tinta;
          c.font = '800 22px "Segoe UI", Arial, sans-serif';
          c.textAlign = 'center';
          c.fillText(w.label.toUpperCase(), w.x, w.y + w.r + 26);
        }
      }
    });

  // ---------- teks informasi ----------
  const FONT = '"Segoe UI", "Arial Rounded MT Bold", Arial, sans-serif';
  /**
   * Label pil aksen dengan bibir bawah lebih gelap (mis. "Rp32.000 per hari"). Pusat (x, y).
   * o = { warna, ukuran (px huruf, bawaan 46), muncul: 0..1 (skala pop; pakai HF.spring) }
   */
  XD.label = (ctx, x, y, teks, o = {}) => {
    const u = o.muncul ?? 1;
    if (u <= 0.01) return;
    const size = o.ukuran ?? 46;
    const w0 = o.warna ?? XD.palet.aksen;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(u, u);
    ctx.font = `800 ${size}px ${FONT}`;
    const w = ctx.measureText(teks).width + size * 1.4;
    const h = size * 1.55;
    ctx.fillStyle = 'rgba(20,10,5,0.22)';
    ctx.beginPath();
    ctx.roundRect(-w / 2 + 6, -h / 2 + 12, w, h, size * 0.22);
    ctx.fill();
    ctx.fillStyle = XD.gelap(w0, 0.78);
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2 + 7, w, h, size * 0.22);
    ctx.fill();
    ctx.fillStyle = w0;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, size * 0.22);
    ctx.fill();
    ctx.fillStyle = o.warnaTeks ?? '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(teks, 0, 2);
    ctx.restore();
  };
  /** Chip kecil (simbol/istilah pendek, mis. "Hg"), pusat (x, y). */
  XD.chip = (ctx, x, y, teks, o = {}) => {
    const u = o.muncul ?? 1;
    if (u <= 0.01) return;
    const size = o.ukuran ?? 30;
    const w0 = o.warna ?? XD.palet.biru;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(u, u);
    ctx.font = `800 ${size}px ${FONT}`;
    const w = Math.max(size * 1.8, ctx.measureText(teks).width + size * 0.9);
    const h = size * 1.6;
    ctx.fillStyle = XD.terang(w0, 0.55);
    ctx.beginPath();
    ctx.roundRect(-w / 2 - 4, -h / 2 - 4, w + 8, h + 8, 10);
    ctx.fill();
    ctx.fillStyle = w0;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(teks, 0, 2);
    ctx.restore();
  };

  // ---------- latar ----------
  /** Gradasi vertikal dua warna (atas -> bawah). */
  XD.langit = (ctx, W, H, atas, bawah) => {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, atas);
    g.addColorStop(1, bawah);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  };
  /** Cahaya lembut (lampu, matahari). */
  XD.cahaya = (ctx, x, y, r, warna = '255,214,140', a = 0.5) => {
    const g = ctx.createRadialGradient(x, y, r * 0.05, x, y, r);
    g.addColorStop(0, `rgba(${warna},${a})`);
    g.addColorStop(1, `rgba(${warna},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  /** Siluet kota pudar sepanjang lebar layar (dasar di y). */
  XD.kota = (ctx, W, y, warna, seed = 7, skala = 1) => {
    const r = HF.rng(seed);
    let x = -40;
    ctx.save();
    ctx.fillStyle = warna;
    while (x < W + 40) {
      const w = (90 + r() * 120) * skala;
      const h = (160 + r() * 340) * skala;
      ctx.beginPath();
      ctx.roundRect(x, y - h, w - 14 * skala, h, [10 * skala, 10 * skala, 0, 0]);
      ctx.fill();
      x += w;
    }
    ctx.restore();
  };
  /** Tanah datar di bawah (y = garis tanah). */
  XD.tanah = (ctx, W, H, y, warna) => {
    ctx.fillStyle = warna;
    ctx.fillRect(0, y, W, H - y);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(0, y, W, 6);
  };

  // ---------- penutup ----------
  /**
   * Kartu penutup "video berikutnya" (dipakai di 6-12 detik terakhir). Tokoh pembawa melambai di kiri,
   * kotak cuplikan video berikutnya di kanan (digambar oleh o.cuplikan(ctx, w, h, t) dengan gaya yang sama),
   * judul teaser di atas kotak. Kotak cuplikan juga menjadi area elemen layar akhir YouTube (16:9).
   * o = { t0 (mulai), judul ("Video berikutnya"), teaser (pertanyaan pemancing), tokoh: {...opsi XD.tokoh},
   *       latarAtas, latarBawah, aksen, cuplikan }
   */
  XD.penutup = (ctx, t, o = {}) => {
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    const lk = W > H;
    const u = HF.prog(t, o.t0 ?? 0, (o.t0 ?? 0) + 0.6);
    const atas = o.latarAtas ?? '#f3e4cc';
    const bawah = o.latarBawah ?? '#e6cfae';
    XD.langit(ctx, W, H, atas, bawah);
    XD.cahaya(ctx, W * 0.3, H * 0.3, H * 0.7, '255,240,210', 0.5);
    const rim = XD.rimUntuk(atas);
    // tokoh pembawa melambai
    // 9:16: tokoh berdiri di atas area subtitle (subtitle di ~70% tinggi layar)
    const ts = lk ? H / 620 : W / 880;
    const tx = lk ? W * 0.24 : W * 0.5;
    const ty = lk ? H * 0.86 : H * 0.685;
    XD.tokoh(ctx, tx, ty + (1 - HF.ease.out(u)) * H * 0.3, ts, { pose: 'lambai', ekspresi: 'senyum', bicara: Boolean(o.bicara), rim, t, ...o.tokoh });
    // kotak cuplikan
    const bw = lk ? W * 0.44 : W * 0.78;
    const bh = bw * 9 / 16;
    const bx = lk ? W * 0.5 : (W - bw) / 2;
    const by = lk ? H * 0.3 : H * 0.14;
    const pop = HF.spring(t, (o.t0 ?? 0) + 0.25, 0, 1, 14, 0.5);
    ctx.save();
    ctx.translate(bx + bw / 2, by + bh / 2);
    ctx.scale(Math.max(0, pop), Math.max(0, pop));
    ctx.translate(-bw / 2, -bh / 2);
    ctx.fillStyle = 'rgba(40,20,10,0.25)';
    ctx.beginPath();
    ctx.roundRect(10, 16, bw, bh, 26);
    ctx.fill();
    ctx.fillStyle = '#fffaf0';
    ctx.beginPath();
    ctx.roundRect(-10, -10, bw + 20, bh + 20, 32);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(0, 0, bw, bh, 24);
    ctx.clip();
    if (o.cuplikan) o.cuplikan(ctx, bw, bh, t);
    else {
      XD.langit(ctx, bw, bh, '#7fa7c4', '#3e4a5c');
      ctx.fillStyle = '#fff';
      ctx.font = `900 ${bh * 0.45}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', bw / 2, bh / 2);
    }
    ctx.restore();
    // tombol putar
    ctx.fillStyle = o.aksen ?? XD.palet.aksen;
    ctx.beginPath();
    ctx.arc(bw / 2, bh / 2, bh * 0.13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(bw / 2 - bh * 0.04, bh / 2 - bh * 0.065);
    ctx.lineTo(bw / 2 + bh * 0.07, bh / 2);
    ctx.lineTo(bw / 2 - bh * 0.04, bh / 2 + bh * 0.065);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // judul + teaser
    const lu = HF.spring(t, (o.t0 ?? 0) + 0.1, 0, 1, 16, 0.55);
    XD.label(ctx, bx + bw / 2, by - (lk ? H * 0.1 : H * 0.04), o.judul ?? 'Video berikutnya', { muncul: Math.max(0, lu), ukuran: lk ? H * 0.04 : W * 0.05, warna: o.aksen });
    if (o.teaser) {
      const a = HF.prog(t, (o.t0 ?? 0) + 0.7, (o.t0 ?? 0) + 1.1);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = '#3a2a22';
      ctx.font = `800 ${lk ? H * 0.036 : W * 0.045}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(o.teaser, bx + bw / 2, by + bh + (lk ? H * 0.05 : H * 0.03));
      ctx.restore();
    }
  };

  window.XD = XD;
})();
