/* HyperForge Studio kit (browser). Dimuat oleh halaman adegan: <script src="/kit/studio-kit.js"></script>
 *
 * Kontrak render (dipakai tools/render.mjs dan tools/snap.mjs):
 *   window.STUDIO = { width, height, fps, duration, ready: Promise, seek(t): Promise|void }
 * HF.setup(...) membuatnya untukmu. Semua gambar adalah fungsi murni dari waktu t (detik):
 * tidak boleh Math.random(), Date, atau performance.now() di dalam draw.
 *
 * Pratinjau: buka halaman lewat `node tools/serve.mjs` -> autoplay + loop. ?t=12.5 membekukan frame.
 */
(function () {
  const HF = {};

  // ---------- angka & waktu ----------
  HF.clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  HF.lerp = (a, b, u) => a + (b - a) * u;
  /** progres 0..1 dari t di rentang [a, b] */
  HF.prog = (t, a, b) => HF.clamp((t - a) / Math.max(1e-6, b - a));
  HF.ease = {
    linear: (u) => HF.clamp(u),
    inOut: (u) => ((u = HF.clamp(u)), u * u * (3 - 2 * u)),
    out: (u) => 1 - Math.pow(1 - HF.clamp(u), 3),
    in: (u) => Math.pow(HF.clamp(u), 3),
    /** melewati target lalu kembali (follow-through) */
    back: (u, s = 1.7) => ((u = HF.clamp(u) - 1), 1 + (s + 1) * u * u * u + s * u * u),
    /** ancang-ancang mundur dulu */
    anticipate: (u) => (u < 0.25 ? -0.15 * Math.sin((HF.clamp(u) / 0.25) * Math.PI) : HF.ease.back((u - 0.25) / 0.75)),
  };
  /** Pegas tertutup (deterministik): nilai dari a ke b mulai t0. k = kekakuan, z = redaman (0..1). */
  HF.spring = (t, t0, a, b, k = 14, z = 0.45) => {
    const x = t - t0;
    if (x <= 0) return a;
    const w = k * Math.sqrt(1 - z * z);
    return b + (a - b) * Math.exp(-z * k * x) * (Math.cos(w * x) + ((z * k) / w) * Math.sin(w * x));
  };
  /** Waktu dibulatkan ke gambar: perSecond = 12 untuk "on twos" di 24 fps, 15 di 30 fps. */
  HF.stepTime = (t, perSecond) => Math.floor(t * perSecond + 1e-6) / perSecond;
  /** Indeks gambar untuk getaran garis ("boil"), berubah perSecond kali per detik. */
  HF.boil = (t, perSecond = 12, n = 3) => Math.floor(t * perSecond + 1e-6) % n;

  // ---------- acak dengan seed ----------
  HF.rng = (seed) => {
    let a = seed >>> 0 || 1;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let r = Math.imul(a ^ (a >>> 15), 1 | a);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  };
  /** noise 1D halus (value noise), deterministik */
  HF.noise = (x, seed = 1) => {
    const h = (i) => {
      let n = (i * 374761393 + seed * 668265263) | 0;
      n = (n ^ (n >>> 13)) * 1274126177;
      return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
    };
    const i = Math.floor(x);
    const f = x - i;
    const u = f * f * (3 - 2 * f);
    return h(i) * (1 - u) + h(i + 1) * u;
  };

  // ---------- data ----------
  HF.loadJSON = async (url, fallback = null) => {
    try {
      const r = await fetch(url, { cache: 'no-store' });
      return r.ok ? await r.json() : fallback;
    } catch {
      return fallback;
    }
  };

  // ---------- area aman (layar HP) ----------
  /** Kotak yang aman dari tombol aplikasi: 9:16 atas 9%, bawah 22%, kanan 14% (tombol like/komen). */
  HF.safe = (W, H) =>
    W < H ? { x: W * 0.06, y: H * 0.09, w: W * 0.8, h: H * 0.69, subtitleY: H * 0.7 } : { x: W * 0.05, y: H * 0.07, w: W * 0.9, h: H * 0.8, subtitleY: H * 0.84 };

  // ---------- subtitle per kata ----------
  /**
   * Potong kata (dari tools: words.json [{s,e,text}] atau [{t0,t1,w}]) jadi potongan maks n kata.
   * Pecah juga di tanda baca dan jeda > 0,45 dtk.
   */
  HF.chunkWords = (words, n = 4) => {
    const ws = (words || []).map((w) => ({ s: w.s ?? w.t0 ?? w.start, e: w.e ?? w.t1 ?? w.end, text: String(w.text ?? w.w ?? w.word ?? '') })).filter((w) => w.text);
    const out = [];
    let cur = [];
    for (const w of ws) {
      const prev = cur[cur.length - 1];
      if (cur.length && (cur.length >= n || w.s - prev.e > 0.45 || /[.!?,;:]$/.test(prev.text))) {
        out.push(cur);
        cur = [];
      }
      cur.push(w);
    }
    if (cur.length) out.push(cur);
    return out.map((c, i) => ({ s: c[0].s, e: Math.min(c[c.length - 1].e + 0.5, out[i + 1]?.[0]?.s ?? c[c.length - 1].e + 0.5), words: c }));
  };

  /**
   * Gambar subtitle di canvas 2D pada waktu t. o: { y, size, font, color, hi (warna kata aktif), stroke, keywords: Set }
   * Kata kunci (o.keywords) ditebalkan. Kata yang sedang diucapkan diberi warna hi.
   */
  HF.drawSubtitle = (ctx, t, chunks, o = {}) => {
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    const c = chunks.find((k) => t >= k.s && t < k.e);
    if (!c) return;
    const size = o.size ?? Math.round((W < H ? H : W) * 0.032);
    const y = o.y ?? HF.safe(W, H).subtitleY;
    const pop = HF.ease.back(HF.prog(t, c.s, c.s + 0.12), 1.2);
    ctx.save();
    ctx.textBaseline = 'middle';
    const parts = c.words.map((w) => {
      const kw = o.keywords?.has?.(w.text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''));
      ctx.font = `${kw ? 900 : o.weight ?? 800} ${size}px ${o.font ?? '"Arial Rounded MT Bold", "Segoe UI", Arial, sans-serif'}`;
      return { w, kw, width: ctx.measureText(w.text + ' ').width, font: ctx.font };
    });
    const total = parts.reduce((n, p) => n + p.width, 0);
    let x = (W - total) / 2;
    ctx.translate(W / 2, y);
    ctx.scale(0.92 + 0.08 * pop, 0.92 + 0.08 * pop);
    ctx.translate(-W / 2, -y);
    for (const p of parts) {
      ctx.font = p.font;
      const active = t >= p.w.s && t < p.w.e + 0.05;
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(3, size * 0.14);
      ctx.strokeStyle = o.stroke ?? 'rgba(0,0,0,0.78)';
      ctx.strokeText(p.w.text, x, y);
      ctx.fillStyle = active ? o.hi ?? '#ffd54a' : o.color ?? '#ffffff';
      ctx.fillText(p.w.text, x, y);
      x += p.width;
    }
    ctx.restore();
  };

  // ---------- setup halaman ----------
  /**
   * HF.setup({ width, height, fps, duration, init?: async () => {}, draw: (t) => {} })
   * Membuat window.STUDIO, menjalankan pratinjau (autoplay + loop, ?t= membekukan) kalau bukan mode render.
   */
  HF.setup = (o) => {
    const q = new URLSearchParams(location.search);
    const rendering = q.has('render');
    let resolveReady;
    const ready = new Promise((r) => (resolveReady = r));
    const S = {
      width: o.width,
      height: o.height,
      fps: o.fps ?? 30,
      duration: o.duration,
      ready,
      t: 0,
      async seek(t) {
        S.t = t;
        await o.draw(t);
      },
    };
    window.STUDIO = S;
    (async () => {
      if (o.init) await o.init();
      if (document.fonts?.ready) await document.fonts.ready;
      await o.draw(0);
      resolveReady(true);
      if (rendering) return;
      if (q.has('t')) return o.draw(Number(q.get('t')) || 0);
      // pratinjau: waktu dinding HANYA di sini (tidak pernah di dalam draw)
      const t0 = performance.now();
      const loop = () => {
        const t = (((performance.now() - t0) / 1000) % S.duration);
        S.t = t;
        o.draw(t);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    })();
    return S;
  };

  window.HF = HF;
})();
