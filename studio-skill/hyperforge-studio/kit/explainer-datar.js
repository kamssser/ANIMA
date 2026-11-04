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

  /**
   * (LAMA, v1) Preset "Raka". Sejak v2 tokoh tetap gaya ini adalah TORA (XD.tora); XD.pembawa kini menggambar Tora.
   * Preset ini hanya disimpan untuk proyek lama yang memakai XD.tokoh({...XD.PEMBAWA}) langsung.
   * kulit sawo matang, rambut pendek hitam, kacamata bulat, kemeja biru muda berkerah, celana biru gelap.
   * Pakai: XD.tokoh(ctx, x, y, s, { ...XD.PEMBAWA, t, pose, ekspresi, bicara }) dan JANGAN menimpa kunci lain.
   */
  XD.PEMBAWA = Object.freeze({
    nama: 'Raka',
    id: 1,
    kulit: '#d39a6a',
    rambut: '#2b2320',
    gayaRambut: 'pendek',
    kacamata: true,
    baju: '#7fa7c4',
    kerah: 'kemeja',
    celana: '#3e4a5c',
    sepatu: '#2f2a28',
  });
  /** Hanya pose/ekspresi/gerak yang boleh berubah untuk tokoh tetap. */
  /** Tokoh tetap gaya ini = Tora (v2). Skala disamakan dengan tinggi tokoh lama (~330 px per s). */
  XD.pembawa = (ctx, x, y, s, o = {}) => XD.tora(ctx, x, y, s * 0.69, o);

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
    if (gaya === 'jambul') {
      // jambul: tiga jumput rambut mencuat di ubun-ubun (ciri khas Tora)
      const j = new Path2D();
      j.moveTo(-rx * 0.42, cy - ry + 8);
      j.quadraticCurveTo(-rx * 0.5, cy - ry - 34, -rx * 0.2, cy - ry - 46);
      j.quadraticCurveTo(-rx * 0.18, cy - ry - 22, -rx * 0.02, cy - ry - 8);
      j.quadraticCurveTo(rx * 0.02, cy - ry - 52, rx * 0.34, cy - ry - 58);
      j.quadraticCurveTo(rx * 0.24, cy - ry - 30, rx * 0.3, cy - ry - 6);
      j.quadraticCurveTo(rx * 0.5, cy - ry - 30, rx * 0.66, cy - ry - 26);
      j.quadraticCurveTo(rx * 0.6, cy - ry + 2, rx * 0.5, cy - ry + 16);
      j.closePath();
      XD.bentuk(ctx, j, c, { sd: 6 });
    }
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
    // kacamata bulat tipis (opsional, ciri khas tokoh pembawa)
    if (o.kacamata) {
      ctx.strokeStyle = o.warnaKacamata ?? ink;
      ctx.lineWidth = 4.5;
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(sx * ex + lx, ey, 21, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(-ex + 21 + lx, ey - 2);
      ctx.quadraticCurveTo(lx, ey - 10, ex - 21 + lx, ey - 2);
      ctx.stroke();
      ctx.fillStyle = ink;
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
    if (o.kerah === 'hoodie') {
      // tudung terlipat di leher + dua tali + kantong depan
      XD.bentuk(ctx, XD.rect(-58, top - 16, 116, 40, 20), XD.gelap(baju, 0.88), { sd: 6 });
      XD.bentuk(ctx, XD.rect(-44, top - 6, 88, 22, 11), XD.gelap(baju, 0.72), { sd: 2 });
      XD.garis(ctx, [[-14, top + 14], [-16, top + 56]], 5, o.warnaTali ?? '#f4efe4');
      XD.garis(ctx, [[14, top + 14], [16, top + 50]], 5, o.warnaTali ?? '#f4efe4');
      XD.bentuk(ctx, XD.rect(-40, -92, 80, 36, 12), XD.gelap(baju, 0.9), { sd: 4 });
    } else if (o.kerah === 'v' || o.kerah === undefined) {
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
   * Kartu penutup TERIMA KASIH (4-8 detik terakhir, setelah cerita selesai tuntas). Tokoh pembawa melambai,
   * ucapan terima kasih besar, salam sampai jumpa, dan (opsional) satu baris ringkasan pesan video.
   * Bukan teaser video berikutnya: tidak ada pertanyaan menggantung.
   * o = { t0 (mulai), judul ("Terima kasih sudah menonton!"), pesan ("Sampai jumpa!"), ringkasan (opsional, 1 kalimat),
   *       tokoh (bawaan XD.PEMBAWA), latarAtas, latarBawah, aksen, bicara }
   */
  XD.penutup = (ctx, t, o = {}) => {
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    const lk = W > H;
    const t0 = o.t0 ?? 0;
    const u = HF.prog(t, t0, t0 + 0.6);
    const atas = o.latarAtas ?? '#f3e4cc';
    const bawah = o.latarBawah ?? '#e6cfae';
    XD.langit(ctx, W, H, atas, bawah);
    XD.cahaya(ctx, lk ? W * 0.3 : W * 0.5, H * 0.35, H * 0.7, '255,240,210', 0.5);
    // bulatan lembut melayang (deterministik)
    const r = HF.rng(11);
    for (let i = 0; i < 14; i++) {
      const bx = r() * W;
      const by = ((r() * H - (t - t0) * (20 + r() * 30)) % H + H) % H;
      const rr = (lk ? H : W) * (0.01 + r() * 0.025);
      ctx.fillStyle = `rgba(255,255,255,${0.18 + r() * 0.2})`;
      ctx.beginPath();
      ctx.arc(bx, by, rr, 0, Math.PI * 2);
      ctx.fill();
    }
    const rim = XD.rimUntuk(atas);
    // tokoh pembawa melambai (9:16: di atas area subtitle ~70% tinggi layar)
    const ts = lk ? H / 560 : W / 650;
    const tx = lk ? W * 0.27 : W * 0.5;
    const ty = lk ? H * 0.9 : H * 0.685;
    // bawaan: tokoh tetap Tora; o.tokoh hanya untuk proyek yang memang punya pembawa lain yang disetujui
    const py = ty + (1 - HF.ease.out(u)) * H * 0.3;
    if (o.tokoh) XD.tokoh(ctx, tx, py, ts, { ...o.tokoh, pose: 'lambai', ekspresi: 'senang', bicara: Boolean(o.bicara), rim, t });
    else XD.tora(ctx, tx, py, ts * 0.69, { pose: 'lambai', ekspresi: 'senang', bicara: Boolean(o.bicara), t });
    // ucapan
    const cx = lk ? W * 0.66 : W * 0.5;
    const cy = lk ? H * 0.4 : H * 0.2;
    const lu = HF.spring(t, t0 + 0.15, 0, 1, 15, 0.5);
    XD.label(ctx, cx, cy, o.judul ?? 'Terima kasih sudah menonton!', { muncul: Math.max(0, lu), ukuran: lk ? H * 0.055 : W * 0.048, warna: o.aksen });
    const a = HF.prog(t, t0 + 0.6, t0 + 1.0);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = '#3a2a22';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${lk ? H * 0.075 : W * 0.085}px ${FONT}`;
    ctx.fillText(o.pesan ?? 'Sampai jumpa!', cx, cy + (lk ? H * 0.14 : H * 0.075));
    if (o.ringkasan) {
      ctx.globalAlpha = HF.prog(t, t0 + 1.0, t0 + 1.4);
      ctx.fillStyle = '#5a463a';
      ctx.font = `700 ${lk ? H * 0.032 : W * 0.04}px ${FONT}`;
      ctx.fillText(o.ringkasan, cx, cy + (lk ? H * 0.24 : H * 0.125));
    }
    ctx.restore();
  };

  // ---------- thumbnail ----------
  /**
   * Teks judul thumbnail: huruf sangat tebal putih bergaris tepi gelap tebal + bayangan, maksimal 2-3 baris.
   * Kata di antara *bintang* disorot dengan kotak aksen miring (satu sorotan saja per thumbnail).
   * (x, y) = titik kiri-atas baris pertama (o.rata 'kiri') atau tengah (o.rata 'tengah'); o.ukuran = tinggi huruf px.
   * Contoh: XD.judulBesar(ctx, 80, 120, ['Upahnya cuma', '*Rp32 ribu*?'], { ukuran: 120 })
   */
  XD.judulBesar = (ctx, x, y, baris, o = {}) => {
    const size = o.ukuran ?? 110;
    const aksen = o.aksen ?? '#ffd23f';
    const tinta = o.tinta ?? '#1b1512';
    const rata = o.rata ?? 'kiri';
    const font = `900 ${size}px "Segoe UI Black", "Arial Black", ${FONT}`;
    ctx.save();
    ctx.font = font;
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    baris.forEach((line, i) => {
      const parts = String(line).split(/(\*[^*]+\*)/).filter(Boolean).map((p) => ({ teks: p.replace(/\*/g, ''), sorot: /^\*.*\*$/.test(p) }));
      const lebar = parts.reduce((n, p) => n + ctx.measureText(p.teks).width, 0);
      let px = rata === 'tengah' ? x - lebar / 2 : x;
      const py = y + size * (0.9 + i * 1.08);
      for (const p of parts) {
        const w = ctx.measureText(p.teks).width;
        if (p.sorot) {
          ctx.save();
          ctx.translate(px + w / 2, py - size * 0.36);
          ctx.rotate(-0.025);
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          ctx.beginPath();
          ctx.roundRect(-w / 2 - size * 0.16 + 8, -size * 0.62 + 10, w + size * 0.32, size * 1.12, size * 0.14);
          ctx.fill();
          ctx.fillStyle = aksen;
          ctx.beginPath();
          ctx.roundRect(-w / 2 - size * 0.16, -size * 0.62, w + size * 0.32, size * 1.12, size * 0.14);
          ctx.fill();
          ctx.restore();
          ctx.fillStyle = tinta;
          ctx.fillText(p.teks, px, py);
        } else {
          ctx.shadowColor = 'rgba(0,0,0,0.45)';
          ctx.shadowBlur = size * 0.12;
          ctx.shadowOffsetY = size * 0.05;
          ctx.strokeStyle = tinta;
          ctx.lineWidth = size * 0.2;
          ctx.strokeText(p.teks, px, py);
          ctx.shadowColor = 'transparent';
          ctx.fillStyle = o.warna ?? '#ffffff';
          ctx.fillText(p.teks, px, py);
        }
        px += w;
      }
    });
    ctx.restore();
  };

  // =====================================================================
  //  v2 "sinematik lembut": tokoh tetap Tora, dunia berlapis (jauh berkabut, tengah tajam, depan buram),
  //  cahaya hangat, kamera dolly pelan + paralaks, kartu istilah/lokasi editorial, transisi sapuan.
  // =====================================================================

  /**
   * TOKOH TETAP gaya explainer datar v2: "Tora". Penampilan dikunci: kulit krem persik, rambut hitam
   * dengan jambul tiga jumput, hoodie kuning mustard bertali, celana hijau zaitun, sepatu putih. Tanpa kacamata.
   */
  XD.TORA = Object.freeze({
    nama: 'Tora',
    id: 2,
    kulit: '#f3d2ae',
    rambut: '#2c2a30',
    gayaRambut: 'jambul',
    baju: '#e6a93c',
    kerah: 'hoodie',
    celana: '#56664f',
    sepatu: '#f1ede4',
  });
  // Proporsi v3 (mengikuti referensi): kepala kotak-membulat lebar, badan ramping, kaki panjang, lengan tipis,
  // mata titik kecil di bawah kepala, tanpa alis/mulut kecuali ekspresi, tepi cahaya krem tipis, gradasi halus.
  // Satuan lokal: tinggi total ~480 (kaki 150, badan 128, kepala 214). (x, y) = titik tumpu di tanah.
  const K2 = { w: 252, h: 214, r: 92, top: -150 - 128 - 214 + 14 };
  const BADAN = { y0: -150, y1: -278, atas: 46, bawah: 54 };
  const POSE2 = {
    diam: { k: [8, 2], i: [8, 2] },
    tunjuk: { k: [112, 98], i: [8, 2] },
    lambai: { k: [62, (t) => 150 + 16 * Math.sin(t * 9)], i: [8, 2] },
    garuk: { k: [150, 196], i: [8, 2] },
    tanya: { k: [40, 110], i: [40, 110] },
    pinggang: { k: [40, -60], i: [40, -60] },
    angkat: { k: [160, 176], i: [160, 176] },
    pegang: { k: [24, -84], i: [24, -84] },
    sedekap: { k: [26, -100], i: [26, -92] },
    kepala: { k: [150, 196], i: [150, 196] },
    hitung: { k: [30, 150], i: [8, 2] },
  };
  const gradV = (ctx, y0, y1, a, b) => {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, a);
    g.addColorStop(1, b);
    return g;
  };
  const gradD = (ctx, x0, y0, x1, y1, a, b) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, a);
    g.addColorStop(1, b);
    return g;
  };
  function lengan2(ctx, sisi, pose, t, warna, kulit) {
    const def = pose[sisi > 0 ? 'k' : 'i'];
    const val = (v) => (typeof v === 'function' ? v(t) : v);
    const a1 = (val(def[0]) * Math.PI) / 180;
    const a2 = (val(def[1]) * Math.PI) / 180;
    const sx = (BADAN.atas - 6) * sisi;
    const sy = BADAN.y1 + 16;
    const ex = sx + sisi * Math.sin(a1) * 64;
    const ey = sy + Math.cos(a1) * 64;
    const hx = ex + sisi * Math.sin(a2) * 60;
    const hy = ey + Math.cos(a2) * 60;
    XD.garis(ctx, [[sx, sy], [ex, ey]], 19, warna);
    XD.garis(ctx, [[ex, ey], [hx, hy]], 15, kulit);
    ctx.fillStyle = kulit;
    ctx.beginPath();
    ctx.arc(hx, hy, 11, 0, Math.PI * 2);
    ctx.fill();
  }
  function rambutTora(ctx, C, belakang) {
    const { w, h, r, top } = K2;
    const hw = w / 2;
    ctx.fillStyle = gradV(ctx, top - 60, top + h * 0.7, XD.terang(C.rambut, 0.1), C.rambut);
    ctx.beginPath();
    if (belakang) {
      ctx.roundRect(-hw - 8, top - 10, w + 16, h * 0.9, [r + 8, r + 8, r * 0.6, r * 0.6]);
    } else {
      // helm rambut tebal: menutup atas + sisi sampai setengah kepala, poni miring
      ctx.moveTo(-hw - 8, top + h * 0.56);
      ctx.lineTo(-hw - 8, top + r * 0.8);
      ctx.quadraticCurveTo(-hw - 8, top - 10, -hw + r, top - 10);
      ctx.lineTo(hw - r, top - 10);
      ctx.quadraticCurveTo(hw + 8, top - 10, hw + 8, top + r * 0.8);
      ctx.lineTo(hw + 8, top + h * 0.5);
      ctx.quadraticCurveTo(hw - 6, top + h * 0.44, hw - 18, top + h * 0.3);
      ctx.quadraticCurveTo(hw * 0.4, top + h * 0.36, -hw * 0.05, top + h * 0.3);
      ctx.quadraticCurveTo(-hw * 0.5, top + h * 0.24, -hw + 22, top + h * 0.36);
      ctx.quadraticCurveTo(-hw + 6, top + h * 0.46, -hw + 2, top + h * 0.58);
    }
    ctx.closePath();
    ctx.fill();
    if (C.gayaRambut === 'bob') {
      // bob: sisi turun sampai rahang, poni rata
      ctx.beginPath();
      ctx.roundRect(-hw - 14, top - 12, w + 28, h * 0.92, [r + 12, r + 12, 26, 26]);
      ctx.fill();
      if (!belakang) {
        ctx.fillStyle = gradD(ctx, -w / 2, top, w / 2, top + h, XD.terang(C.kulit, 0.12), XD.gelap(C.kulit, 0.9));
        ctx.beginPath();
        ctx.roundRect(-hw + 22, top + h * 0.34, w - 44, h * 0.66, [24, 24, r * 0.8, r * 0.8]);
        ctx.fill();
      }
      return;
    }
    if (C.gayaRambut === 'cepak') return;
    // jambul runcing ke atas-kanan (ciri khas Tora)
    ctx.beginPath();
    ctx.moveTo(-hw * 0.62, top + 6);
    ctx.quadraticCurveTo(-hw * 0.6, top - 42, -hw * 0.3, top - 58);
    ctx.quadraticCurveTo(-hw * 0.28, top - 30, -hw * 0.12, top - 8);
    ctx.quadraticCurveTo(-hw * 0.04, top - 72, hw * 0.34, top - 86);
    ctx.quadraticCurveTo(hw * 0.18, top - 44, hw * 0.24, top - 8);
    ctx.quadraticCurveTo(hw * 0.5, top - 52, hw * 0.86, top - 50);
    ctx.quadraticCurveTo(hw * 0.7, top - 12, hw * 0.6, top + 14);
    ctx.closePath();
    ctx.fill();
  }
  function wajahTora(ctx, C, o, t) {
    const { h, top } = K2;
    const ek = o.ekspresi ?? 'netral';
    const lx = (o.lihat ?? 0) * 18;
    const ey = top + h * 0.64;
    const ex = 44;
    const tt = HF.stepTime(t, 12);
    const kedip = o.kedip !== false && ((tt + 1.3) % 3.3) < 0.12;
    const ink = '#2b2224';
    ctx.save();
    ctx.fillStyle = ink;
    ctx.strokeStyle = ink;
    ctx.lineCap = 'round';
    for (const sx of [-1, 1]) {
      const x = sx * ex + lx;
      ctx.beginPath();
      if (kedip || ek === 'tenang') {
        ctx.lineWidth = 4.5;
        ctx.moveTo(x - 9, ey);
        ctx.lineTo(x + 9, ey);
        ctx.stroke();
      } else if (ek === 'senang') {
        ctx.lineWidth = 4.5;
        ctx.arc(x, ey + 5, 9, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      } else {
        ctx.arc(x, ey, ek === 'kaget' ? 8.5 : 6.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // alis hanya untuk ekspresi kuat (referensi: wajah polos tanpa alis)
    const alis = { sedih: -0.4, marah: 0.5, ragu: [0.3, -0.25], bingung: [0.4, -0.35], kaget: -0.1 }[ek];
    if (alis !== undefined) {
      ctx.lineWidth = 4.5;
      for (const sx of [-1, 1]) {
        const a = Array.isArray(alis) ? alis[sx < 0 ? 0 : 1] : alis;
        ctx.save();
        ctx.translate(sx * ex + lx, ey - 26 - (ek === 'kaget' ? 8 : 0));
        ctx.rotate(-sx * a);
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(10, 0);
        ctx.stroke();
        ctx.restore();
      }
    }
    // mulut hanya saat bicara / kaget / sedih
    const my = ey + 30;
    const mx = lx * 0.8;
    if (o.bicara) {
      const buka = 1.5 + 6 * HF.noise(tt * 9, 2);
      ctx.fillStyle = '#6a3a34';
      ctx.beginPath();
      ctx.ellipse(mx, my, 7, buka, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (ek === 'kaget') {
      ctx.fillStyle = '#6a3a34';
      ctx.beginPath();
      ctx.ellipse(mx, my + 2, 6, 8, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (ek === 'sedih') {
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(mx, my + 6, 7, Math.PI * 1.2, Math.PI * 1.8);
      ctx.stroke();
    }
    if (ek === 'senang' || ek === 'malu' || o.merona) {
      ctx.fillStyle = 'rgba(236,120,110,0.28)';
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(sx * (ex + 28) + lx * 0.6, ey + 20, 17, 9, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function gambarTora(ctx, o, C = XD.TORA) {
    const t = o.t ?? 0;
    const tt = HF.stepTime(t, 12);
    const pose = POSE2[o.pose ?? 'diam'] ?? POSE2.diam;
    const belakang = o.dari === 'belakang';
    const napas = o.napas === false ? 0 : 2 * Math.sin(tt * 2.4 + 2);
    const { w, h, r, top } = K2;
    // kaki panjang ramping + sepatu
    for (const sx of [-1, 1]) {
      ctx.fillStyle = gradV(ctx, BADAN.y0, 0, C.celana, XD.gelap(C.celana, 0.85));
      ctx.beginPath();
      ctx.roundRect(sx > 0 ? 6 : -40, BADAN.y0 - 6, 34, 150, 12);
      ctx.fill();
      ctx.fillStyle = gradV(ctx, -16, 0, C.sepatu, XD.gelap(C.sepatu, 0.8));
      ctx.beginPath();
      ctx.ellipse(sx * 26, -8, 28, 11, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const tangan = () => {
      const warna = XD.gelap(C.baju, 0.95);
      lengan2(ctx, 1, pose, tt, warna, C.kulit);
      lengan2(ctx, -1, pose, tt, warna, C.kulit);
    };
    if (belakang) tangan();
    // badan hoodie ramping
    const y1 = BADAN.y1 - napas;
    ctx.fillStyle = gradD(ctx, -60, y1, 60, BADAN.y0, XD.terang(C.baju, 0.12), XD.gelap(C.baju, 0.84));
    ctx.beginPath();
    ctx.moveTo(-BADAN.atas + 10, y1);
    ctx.lineTo(BADAN.atas - 10, y1);
    ctx.quadraticCurveTo(BADAN.atas + 4, y1 + 4, BADAN.atas + 2, y1 + 30);
    ctx.lineTo(BADAN.bawah, BADAN.y0 + 2);
    ctx.lineTo(-BADAN.bawah, BADAN.y0 + 2);
    ctx.lineTo(-BADAN.atas - 2, y1 + 30);
    ctx.quadraticCurveTo(-BADAN.atas - 4, y1 + 4, -BADAN.atas + 10, y1);
    ctx.closePath();
    ctx.fill();
    // ujung hoodie (rib) + kantong + tali
    ctx.fillStyle = XD.gelap(C.baju, 0.82);
    ctx.fillRect(-BADAN.bawah, BADAN.y0 - 14, BADAN.bawah * 2, 16);
    if (!belakang) {
      ctx.beginPath();
      ctx.roundRect(-30, BADAN.y0 - 58, 60, 30, 10);
      ctx.fill();
      ctx.strokeStyle = '#f6f0e4';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(sx * 11, y1 + 8);
        ctx.lineTo(sx * 12, y1 + 44);
        ctx.stroke();
      }
    } else {
      ctx.beginPath();
      ctx.roundRect(-40, y1 - 6, 80, 50, [16, 16, 34, 34]);
      ctx.fill();
    }
    // kepala
    ctx.save();
    ctx.translate(0, -napas * 0.6);
    for (const sx of [-1, 1]) {
      ctx.fillStyle = XD.gelap(C.kulit, 0.93);
      ctx.beginPath();
      ctx.ellipse(sx * (w / 2 + 1), top + h * 0.62, 13, 20, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = gradD(ctx, -w / 2, top, w / 2, top + h, XD.terang(C.kulit, 0.12), XD.gelap(C.kulit, 0.9));
    ctx.beginPath();
    ctx.roundRect(-w / 2, top, w, h, [r, r, r * 0.86, r * 0.86]);
    ctx.fill();
    rambutTora(ctx, C, belakang);
    if (!belakang) wajahTora(ctx, C, o, t);
    if (o.keringat) {
      const u = (t * 0.8) % 1;
      ctx.fillStyle = 'rgba(160,212,242,0.95)';
      ctx.beginPath();
      ctx.ellipse(w / 2 - 22, top + h * 0.42 + u * 34, 8, 12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    if (!belakang) tangan();
  }

  // kanvas bantu (satu untuk semua): untuk tepi cahaya & blur per lapisan tanpa artefak antarbentuk
  let BANTU = null;
  const bantu = (ctx) => {
    const { width, height } = ctx.canvas;
    if (!BANTU) BANTU = document.createElement('canvas');
    if (BANTU.width !== width || BANTU.height !== height) {
      BANTU.width = width;
      BANTU.height = height;
    }
    const b = BANTU.getContext('2d');
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.clearRect(0, 0, width, height);
    b.filter = 'none';
    b.globalAlpha = 1;
    b.globalCompositeOperation = 'source-over';
    return b;
  };
  /**
   * Gambar fn(ctx) sebagai satu lapisan utuh: o.tepi = warna garis cahaya di sekeliling siluet (px o.tebal),
   * o.blur = px kabur (latar depan/belakang di luar fokus), o.alpha.
   */
  XD.lapisan = (ctx, fn, o = {}) => {
    const b = bantu(ctx);
    b.setTransform(ctx.getTransform());
    fn(b);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const f = [];
    if (o.tepi) {
      const k = o.tebal ?? 4;
      f.push(`drop-shadow(${k}px 0 0 ${o.tepi})`, `drop-shadow(-${k}px 0 0 ${o.tepi})`, `drop-shadow(0 ${k}px 0 ${o.tepi})`, `drop-shadow(0 -${k}px 0 ${o.tepi})`);
    }
    if (o.blur) f.push(`blur(${o.blur}px)`);
    ctx.filter = f.length ? f.join(' ') : 'none';
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    ctx.drawImage(BANTU, 0, 0);
    ctx.restore();
  };

  /**
   * Tora (tokoh tetap explainer datar v2). (x, y) = titik tumpu, s = skala (s=1 tinggi ~480 px).
   * o = { t, pose: diam|tunjuk|lambai|garuk|tanya|pinggang|angkat|pegang|sedekap,
   *       ekspresi: netral|senang|tenang|sedih|kaget|marah|ragu|bingung|malu, bicara, lihat: -1..1, hadap: 1|-1,
   *       dari: 'depan'|'belakang', keringat, merona, tepi (warna tepi cahaya, bawaan krem; false = tanpa), blur }
   * Hanya pose/ekspresi/gerak/arah yang boleh berubah; penampilan dikunci XD.TORA.
   */
  /**
   * Tokoh pendamping dengan proporsi & gaya yang sama dengan Tora (teman, orang tua, guru, tokoh cerita).
   * o = { ...seperti XD.tora, kulit, rambut, gayaRambut: 'bob'|'cepak'|'jambul', baju, celana, sepatu }
   */
  XD.chibi = (ctx, x, y, s, o = {}) => {
    const C = { ...XD.TORA, gayaRambut: 'bob', baju: '#5fb7a8', celana: '#5b5f6a', ...o, nama: o.nama ?? 'teman' };
    if (!o.blur) {
      ctx.save();
      ctx.fillStyle = 'rgba(40,24,12,0.2)';
      ctx.beginPath();
      ctx.ellipse(x, y, 100 * s, 14 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    XD.lapisan(
      ctx,
      (c) => {
        c.translate(x, y);
        c.scale(s * (o.hadap === -1 ? -1 : 1), s);
        gambarTora(c, o, C);
      },
      { tepi: o.tepi === false ? null : o.tepi ?? 'rgba(255,236,205,0.85)', tebal: Math.max(2, Math.round(2.6 * s)), blur: o.blur },
    );
  };

  /**
   * Gelembung bicara: badan bulat-lonjong putih + ekor melengkung yang menyatu (satu bentuk, tanpa sambungan),
   * bayangan lembut, teks kapital tebal gelap. Pusat (x, y); o.ekor = [x, y] ujung ekor (ke mulut pembicara).
   * o = { ekor, ukuran (px huruf, 40), muncul: 0..1 (pop + goyang kecil), warna, warnaTeks }
   */
  XD.bicara = (ctx, x, y, teks, o = {}) => {
    const u = HF.clamp(o.muncul ?? 1);
    if (u <= 0.01) return;
    const size = o.ukuran ?? 40;
    const baris = String(teks).toUpperCase().split('\n');
    ctx.save();
    ctx.font = `800 ${size}px ${FONT}`;
    const tw = Math.max(...baris.map((b) => ctx.measureText(b).width));
    const th = baris.length * size * 1.08;
    // badan: elips yang cukup lega untuk teks (sudut kotak teks muat di dalam elips)
    const rx = Math.max(tw * 0.5 + size * 1.15, th * 0.95);
    const ry = th * 0.5 + size * 0.85;
    const ex = (o.ekor?.[0] ?? x - rx * 0.7) - x;
    const ey = (o.ekor?.[1] ?? y + ry * 1.7) - y;
    // pangkal ekor di tepi elips ke arah ujung ekor, lebar ~0.5 rad
    const a = Math.atan2(ey / ry, ex / rx);
    const p = (ang) => [Math.cos(ang) * rx, Math.sin(ang) * ry];
    const [ax, ay] = p(a - 0.24);
    const [bx, by] = p(a + 0.24);
    const pop = HF.ease.back(u, 1.6);
    ctx.translate(x, y);
    ctx.scale(pop, pop);
    ctx.rotate((1 - u) * -0.08);
    const path = new Path2D();
    path.ellipse(0, 0, rx, ry, 0, a + 0.24, a - 0.24 + Math.PI * 2);
    // ekor melengkung (sedikit menekuk ke samping, ujung membulat)
    const tekuk = 0.22;
    const mx = (bx + ex) / 2 - ey * tekuk;
    const my = (by + ey) / 2 + ex * tekuk;
    path.quadraticCurveTo(mx, my, ex, ey);
    const nx = (ax + ex) / 2 - ey * tekuk * 0.6;
    const ny = (ay + ey) / 2 + ex * tekuk * 0.6;
    path.quadraticCurveTo(nx, ny, ax, ay);
    path.closePath();
    ctx.shadowColor = 'rgba(30,20,10,0.22)';
    ctx.shadowBlur = size * 0.5;
    ctx.shadowOffsetY = size * 0.12;
    ctx.fillStyle = o.warna ?? '#ffffff';
    ctx.fill(path);
    ctx.shadowColor = 'transparent';
    // tepi bawah sedikit gelap (volume lembut)
    ctx.save();
    ctx.clip(path);
    const g = ctx.createLinearGradient(0, -ry, 0, ry);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(120,110,100,0.12)');
    ctx.fillStyle = g;
    ctx.fillRect(-rx - Math.abs(ex), -ry, (rx + Math.abs(ex)) * 2, ry * 2 + Math.abs(ey));
    ctx.restore();
    ctx.fillStyle = o.warnaTeks ?? '#1f1a1c';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    baris.forEach((b, i) => ctx.fillText(b, 0, (i - (baris.length - 1) / 2) * size * 1.08 + size * 0.04));
    ctx.restore();
  };

  /** Teks penanda tebal di kiri bawah (mis. "HARI 1", "PUKUL 12.00"). */
  XD.penanda = (ctx, x, y, teks, o = {}) => {
    const u = HF.clamp(o.muncul ?? 1);
    if (u <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = u;
    ctx.font = `800 ${o.ukuran ?? 64}px ${FONT}`;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 16;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(String(teks).toUpperCase(), x + (1 - u) * -20, y);
    ctx.restore();
  };

  XD.tora = (ctx, x, y, s, o = {}) => {
    if (!o.blur) {
      ctx.save();
      ctx.fillStyle = 'rgba(40,24,12,0.2)';
      ctx.beginPath();
      ctx.ellipse(x, y, 100 * s, 14 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    XD.lapisan(
      ctx,
      (c) => {
        c.translate(x, y);
        c.scale(s * (o.hadap === -1 ? -1 : 1), s);
        gambarTora(c, o);
      },
      { tepi: o.tepi === false ? null : o.tepi ?? 'rgba(255,236,205,0.85)', tebal: Math.max(2, Math.round(2.6 * s)), blur: o.blur },
    );
  };

  /**
   * Penilaian warna akhir gaya referensi: hangat, kontras rendah, cahaya berpendar (bloom). Panggil paling akhir
   * SEBELUM teks/subtitle. o = { glow: 0..1 (bawaan 0.28), hangat: 0..1 (0.16), kabut: 0..1 (0.06) }
   */
  XD.grade = (ctx, W, H, o = {}) => {
    const b = bantu(ctx);
    b.drawImage(ctx.canvas, 0, 0);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = o.glow ?? 0.16;
    ctx.filter = `blur(${Math.round(W / 60)}px) brightness(1.05)`;
    ctx.drawImage(BANTU, 0, 0);
    ctx.filter = 'none';
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = o.hangat ?? 0.14;
    ctx.fillStyle = '#ffb56a';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = o.kabut ?? 0.025;
    ctx.fillStyle = '#fff3e0';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  };

  /**
   * Kamera dolly pelan + paralaks. Panggil sekali per frame: const lapis = XD.kamera(ctx, W, H, t, { t0, t1, zoom, geser });
   * lalu lapis(kedalaman) sebelum menggambar tiap lapisan (0 = langit diam, 1 = lapisan tokoh, 1.4 = latar depan).
   * Akhiri dengan lapis(null) untuk kembali normal (teks, subtitle).
   */
  XD.kamera = (ctx, W, H, t, o = {}) => {
    const u = HF.ease.inOut(HF.prog(t, o.t0 ?? 0, o.t1 ?? 6));
    const zoom = o.zoom ?? 0.05;
    const [gx, gy] = o.geser ?? [-40, -10];
    const fx = o.fokus?.[0] ?? W / 2;
    const fy = o.fokus?.[1] ?? H * 0.6;
    return (d) => {
      if (d === null || d === undefined) return ctx.setTransform(1, 0, 0, 1, 0, 0);
      const z = 1 + zoom * u * d;
      ctx.setTransform(z, 0, 0, z, fx - fx * z + gx * u * d, fy - fy * z + gy * u * d);
    };
  };

  /** Awan bergaya lukis: gumpalan bertumpuk, sisi bawah biru keabuan, puncak putih, sedikit tepi terang. */
  XD.awan = (ctx, x, y, s = 1, a = 0.95, seed = 1) => {
    const r = HF.rng(seed);
    const lobus = [];
    for (let i = 0; i < 7; i++) {
      const dx = (i - 3) * 46 + (r() - 0.5) * 18;
      const rr = 30 + r() * 26 - Math.abs(i - 3) * 4;
      lobus.push([dx, -rr * 0.45 - r() * 10, rr]);
    }
    ctx.save();
    ctx.globalAlpha = a;
    // bayangan bawah
    ctx.fillStyle = '#b9cfe0';
    for (const [dx, dy, rr] of lobus) {
      ctx.beginPath();
      ctx.arc(x + dx * s, y + (dy + 10) * s, rr * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.roundRect(x - 170 * s, y - 6 * s, 340 * s, 30 * s, 15 * s);
    ctx.fill();
    // badan putih (sedikit naik)
    ctx.fillStyle = '#f7fbfd';
    for (const [dx, dy, rr] of lobus) {
      ctx.beginPath();
      ctx.arc(x + dx * s, y + (dy - 2) * s, rr * 0.92 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    // garis lengkung lembut di dalam awan (kesan lukisan)
    ctx.strokeStyle = 'rgba(170,196,216,0.6)';
    ctx.lineWidth = 3 * s;
    ctx.lineCap = 'round';
    for (const [dx, dy, rr] of lobus.slice(1, 5)) {
      ctx.beginPath();
      ctx.arc(x + dx * s, y + (dy + 4) * s, rr * 0.55 * s, Math.PI * 0.15, Math.PI * 0.75);
      ctx.stroke();
    }
    ctx.restore();
  };

  /** Angka/fakta BESAR di tengah (mis. "525.000 HEKTAR" + keterangan). o = { judul, isi, muncul, ukuran } */
  XD.angkaBesar = (ctx, x, y, o = {}) => {
    const u = HF.clamp(o.muncul ?? 1);
    if (u <= 0.01) return;
    const size = o.ukuran ?? 110;
    ctx.save();
    ctx.globalAlpha = u;
    ctx.translate(x, y);
    ctx.scale(0.9 + 0.1 * u, 0.9 + 0.1 * u);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 ${size}px ${FONT}`;
    ctx.fillText(String(o.judul ?? '').toUpperCase(), 0, 0);
    if (o.isi) {
      ctx.font = `400 ${Math.round(size * 0.44)}px ${FONT}`;
      ctx.fillText(o.isi, 0, size * 0.72);
    }
    ctx.restore();
  };

  /** Transisi GELEMBUNG: lingkaran warna muncul memenuhi layar lalu menghilang. u 0..1. */
  XD.gelembung = (ctx, W, H, u, warna = '#e8344a', seed = 4) => {
    if (u <= 0 || u >= 1) return;
    const r = HF.rng(seed);
    const tutup = u < 0.5 ? HF.ease.out(u * 2) : 1 - HF.ease.in((u - 0.5) * 2);
    ctx.save();
    ctx.fillStyle = warna;
    for (let i = 0; i < 9; i++) {
      const cx = r() * W;
      const cy = r() * H;
      const d = r() * 0.35;
      const k = HF.clamp((tutup - d) / (1 - d));
      ctx.beginPath();
      ctx.arc(cx, cy, k * Math.max(W, H) * (0.35 + r() * 0.3), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  /** Bukit bergelombang selebar layar (puncak sekitar y0, tinggi amp). */
  XD.bukit = (ctx, W, H, y0, amp, warna, seed = 1) => {
    const r = HF.rng(seed);
    const ph = r() * 6;
    ctx.fillStyle = warna;
    ctx.beginPath();
    ctx.moveTo(-200, H + 200);
    for (let x = -200; x <= W + 200; x += 40) ctx.lineTo(x, y0 - amp * (0.55 + 0.3 * Math.sin(x / 310 + ph) + 0.15 * Math.sin(x / 113 + ph * 2)));
    ctx.lineTo(W + 200, H + 200);
    ctx.closePath();
    ctx.fill();
  };

  /** Kabut atmosfer: pita terang di cakrawala supaya lapisan jauh terasa jauh. */
  XD.kabut = (ctx, W, y, tinggi, warna = '255,246,228', a = 0.55) => {
    const g = ctx.createLinearGradient(0, y - tinggi, 0, y + tinggi);
    g.addColorStop(0, `rgba(${warna},0)`);
    g.addColorStop(0.5, `rgba(${warna},${a})`);
    g.addColorStop(1, `rgba(${warna},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(-200, y - tinggi, W + 400, tinggi * 2);
  };

  /** Pohon/ranting kering bercabang (dasar di x, y). */
  XD.ranting = (ctx, x, y, s = 1, warna = '#8a6a52', seed = 3) => {
    const r = HF.rng(seed);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.strokeStyle = warna;
    ctx.lineCap = 'round';
    const cab = (len, w, d) => {
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -len);
      ctx.stroke();
      if (d >= 4) return;
      ctx.save();
      ctx.translate(0, -len);
      for (const k of [-1, 1]) {
        ctx.save();
        ctx.rotate(k * (0.32 + r() * 0.3));
        cab(len * (0.6 + r() * 0.15), w * 0.62, d + 1);
        ctx.restore();
      }
      ctx.restore();
    };
    cab(190, 30, 0);
    ctx.restore();
  };

  /** Semak/rumpun daun membulat. */
  XD.semak = (ctx, x, y, s = 1, warna = '#7fa05a', seed = 5) => {
    const r = HF.rng(seed);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    for (let i = 0; i < 5; i++) {
      const dx = (i - 2) * 46 + (r() - 0.5) * 16;
      const rr = 46 + r() * 22 - Math.abs(i - 2) * 6;
      XD.bentuk(ctx, XD.ellipse(dx, -rr * 0.7, rr, rr * 0.8), i % 2 ? XD.gelap(warna, 0.92) : warna, { sd: 8 });
    }
    ctx.restore();
  };

  /** Gambar sesuatu dengan blur (latar depan di luar fokus). fn(ctx) menggambar seperti biasa. */
  XD.buram = (ctx, px, fn) => {
    ctx.save();
    ctx.filter = `blur(${px}px)`;
    fn(ctx);
    ctx.restore();
  };

  /** Titik cahaya bokeh yang berkedip pelan. */
  XD.bokeh = (ctx, W, H, t, o = {}) => {
    const r = HF.rng(o.seed ?? 3);
    const n = o.n ?? 12;
    const warna = o.warna ?? '255,236,200';
    for (let i = 0; i < n; i++) {
      const x = r() * W;
      const y = r() * H * (o.tinggi ?? 0.8);
      const rr = 10 + r() * 34;
      const a = (o.a ?? 0.1) * (0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 1.2 + i * 1.7)));
      ctx.fillStyle = `rgba(${warna},${a})`;
      ctx.beginPath();
      ctx.arc(x + Math.sin(t * 0.3 + i) * 14, y + Math.cos(t * 0.25 + i) * 8, rr, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  /** Berkas sinar matahari miring dari (x, y). */
  XD.sinar = (ctx, x, y, W, H, a = 0.12, warna = '255,240,205') => {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const ang = 0.35 + i * 0.16;
      const g = ctx.createLinearGradient(x, y, x - Math.sin(ang) * H * 1.4, y + Math.cos(ang) * H * 1.4);
      g.addColorStop(0, `rgba(${warna},${a})`);
      g.addColorStop(1, `rgba(${warna},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - Math.sin(ang - 0.04) * H * 1.6, y + Math.cos(ang - 0.04) * H * 1.6);
      ctx.lineTo(x - Math.sin(ang + 0.04) * H * 1.6, y + Math.cos(ang + 0.04) * H * 1.6);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    void W;
  };

  /** Vinyet halus (pinggir sedikit gelap & hangat). */
  XD.vinyet = (ctx, W, H, a = 0.32, warna = '40,24,10') => {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.62);
    g.addColorStop(0, `rgba(${warna},0)`);
    g.addColorStop(1, `rgba(${warna},${a})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  };

  /** Mata kecil untuk benda (benih, termometer, tetes air) supaya terasa hidup. */
  XD.mataBenda = (ctx, x, y, s = 1, o = {}) => {
    const tt = HF.stepTime(o.t ?? 0, 12);
    const kedip = ((tt + (o.id ?? 3) * 0.61) % 3.4) < 0.12;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = ctx.strokeStyle = o.warna ?? XD.palet.tinta;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      if (kedip) {
        ctx.moveTo(sx * 14 - 6, 0);
        ctx.lineTo(sx * 14 + 6, 0);
        ctx.stroke();
      } else if (o.senang) {
        ctx.arc(sx * 14, 3, 7, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
      } else {
        ctx.arc(sx * 14, 0, 5.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  };

  function teksBayang(ctx) {
    ctx.shadowColor = 'rgba(0,0,0,0.38)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 2;
  }
  /** Bayangan gelap lembut di belakang teks supaya terbaca di latar terang. */
  function latarTeks(ctx, x, y, w, h, a) {
    if (!a) return;
    // elips lembut (diskala vertikal) supaya tidak ada tepi kotak
    const cx = x + w * 0.3;
    const cy = y + h * 0.4;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, (h * 1.6) / w);
    const g = ctx.createRadialGradient(0, 0, 10, 0, 0, w * 0.75);
    g.addColorStop(0, `rgba(18,26,36,${a})`);
    g.addColorStop(0.6, `rgba(18,26,36,${a * 0.45})`);
    g.addColorStop(1, 'rgba(18,26,36,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-w * 0.75, -w * 0.75, w * 1.5, w * 1.5);
    ctx.restore();
  }

  /**
   * Kartu ISTILAH editorial (kiri atas): istilah asli kecil miring, judul tebal kapital, 1-2 baris penjelasan.
   * o = { kecil, judul, isi: [baris], muncul: 0..1, ukuran (judul, bawaan 64), gelap: alpha latar (bawaan 0.4) }
   */
  XD.kartuIstilah = (ctx, x, y, o = {}) => {
    const u = HF.clamp(o.muncul ?? 1);
    if (u <= 0.01) return;
    const size = o.ukuran ?? 64;
    ctx.save();
    ctx.globalAlpha = u;
    ctx.translate(0, (1 - u) * 20);
    latarTeks(ctx, x, y, size * 9, size * 2.4, o.gelap ?? 0.4);
    teksBayang(ctx);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    if (o.kecil) {
      ctx.font = `italic 400 ${Math.round(size * 0.42)}px ${FONT}`;
      ctx.fillText(o.kecil, x, y);
    }
    ctx.font = `800 ${size}px ${FONT}`;
    ctx.fillText(String(o.judul ?? '').toUpperCase(), x, y + size * 1.1);
    ctx.font = `400 ${Math.round(size * 0.45)}px ${FONT}`;
    (o.isi ?? []).forEach((b, i) => ctx.fillText(b, x, y + size * 1.85 + i * size * 0.6));
    ctx.restore();
  };

  /**
   * Kartu LOKASI/WAKTU (kiri atas): baris kecil (tahun), nama tempat tebal kapital, keterangan.
   * o = { atas, judul, isi, muncul, tag: true = judul di kotak aksen merah (untuk tempat nyata yang penting) }
   */
  XD.kartuLokasi = (ctx, x, y, o = {}) => {
    const u = HF.clamp(o.muncul ?? 1);
    if (u <= 0.01) return;
    const size = o.ukuran ?? 44;
    ctx.save();
    ctx.globalAlpha = u;
    ctx.translate((1 - u) * -24, 0);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const judul = String(o.judul ?? '').toUpperCase();
    ctx.font = `800 ${size}px ${FONT}`;
    const w = ctx.measureText(judul).width;
    if (o.tag) {
      // tag merah: judul tebal + satu baris kecil (tanggal/keterangan) di DALAM kotak
      const kecil = o.isi ?? o.atas ?? '';
      ctx.font = `400 ${Math.round(size * 0.5)}px ${FONT}`;
      const w2 = ctx.measureText(kecil).width;
      const bw = Math.max(w, w2) + size * 0.8;
      const bh = size * (kecil ? 1.95 : 1.4);
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.roundRect(x + 4, y + 6, bw, bh, 6);
      ctx.fill();
      ctx.fillStyle = o.warna ?? '#e0384c';
      ctx.beginPath();
      ctx.roundRect(x, y, bw, bh, 6);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `800 ${size}px ${FONT}`;
      ctx.fillText(judul, x + size * 0.4, y + size * 1.0);
      if (kecil) {
        ctx.font = `400 ${Math.round(size * 0.5)}px ${FONT}`;
        ctx.fillText(kecil, x + size * 0.4, y + size * 1.62);
      }
      ctx.restore();
      return;
    } else {
      latarTeks(ctx, x, y, size * 10, size * 2, o.gelap ?? 0.32);
      teksBayang(ctx);
    }
    ctx.fillStyle = '#ffffff';
    if (o.atas) {
      ctx.font = `400 ${Math.round(size * 0.55)}px ${FONT}`;
      ctx.fillText(o.atas, x, y - size * 0.5);
    }
    ctx.font = `800 ${size}px ${FONT}`;
    ctx.fillText(judul, x, y + size * 0.85);
    if (o.isi) {
      ctx.font = `400 ${Math.round(size * 0.58)}px ${FONT}`;
      ctx.fillText(o.isi, x, y + size * 1.8);
    }
    ctx.restore();
  };

  /**
   * Transisi SAPUAN warna penuh layar. u: 0..1 (0-0.5 menutup, 0.5-1 membuka). arah: 1 = ke kanan, -1 = ke kiri.
   * Gambar paling akhir (di atas semuanya), mis. u = HF.prog(t, tPotong - 0.35, tPotong + 0.35).
   */
  XD.sapuan = (ctx, W, H, u, warna = '#f2c14e', arah = 1) => {
    if (u <= 0 || u >= 1) return;
    const e = HF.ease.inOut(u < 0.5 ? u * 2 : (u - 0.5) * 2);
    const miring = W * 0.12;
    ctx.save();
    ctx.fillStyle = warna;
    ctx.beginPath();
    let a;
    let b;
    if (u < 0.5) {
      a = -miring;
      b = -miring + (W + miring * 2) * e;
    } else {
      a = -miring + (W + miring * 2) * e;
      b = W + miring;
    }
    if (arah < 0) [a, b] = [W - b, W - a];
    ctx.moveTo(a, 0);
    ctx.lineTo(b + miring, 0);
    ctx.lineTo(b, H);
    ctx.lineTo(a - miring, H);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  window.XD = XD;
})();
