// HyperForge Studio: pustaka gaya HOROR KARTUN 3D (three.js) untuk style "horor-dongeng" dan "horor-nyata".
// Semua fungsi deterministik dari t (pakai HF.noise/HF.rng, tidak ada Math.random/Date).
// Pakai di <proyek>/index.html (setelah studio-kit.js):
//   <script src="/kit/horor-3d.js"></script>
//   import * as THREE from 'three';  HR.pakai(THREE);
//   const dunia = HR.suasana(scene, renderer, { kabut: '#0b1020' });
//   const kunti = HR.kuntilanak(); scene.add(kunti.group);
//   draw(t) { dunia.update(t); kunti.update(t); HR.kameraGoyang(cam, t, 0.02); renderer.render(scene, cam);
//             ctx.clearRect(0,0,W,H); HR.overlay(ctx, t, { denyut: HR.denyut(t, beats) }); HF.drawSubtitle(ctx, t, chunks, HR.SUB); }
// Hantu di sini kartun: seram lewat cahaya, siluet, dan waktu, bukan darah atau luka (aman untuk YouTube umum).
(function () {
  let T = null;
  const HR = {};
  const need = () => {
    if (!T) throw new Error('HR.pakai(THREE) dulu sebelum memakai pustaka horor');
    return T;
  };
  /** Wajib dipanggil sekali dengan modul three. */
  HR.pakai = (THREE) => {
    T = THREE;
    return HR;
  };

  /** Palet bawaan: malam biru tua, cahaya bulan dingin, lentera kuning kusam, aksen merah untuk mata/kata kunci. */
  HR.WARNA = {
    malam: '#0b1020',
    kabut: '#1a2236',
    bulan: '#9fb4ff',
    lentera: '#ffb35c',
    putihHantu: '#e9eef2',
    rambut: '#0a0a0d',
    mata: '#ff2a2a',
    kulitPucat: '#c9d3cf',
    tanah: '#2a2a22',
    rumput: '#1f3326',
    kayu: '#3b2a1f',
  };
  /** Opsi subtitle horor: putih, kata aktif merah pucat, garis tebal gelap. */
  HR.SUB = { hi: '#ff5a5a', color: '#f2f2f2', stroke: 'rgba(0,0,0,0.88)' };

  // ---------------------------------------------------------------- suasana
  /**
   * Malam berkabut + bulan + cahaya langit redup. o: { kabut, rapat (0.06-0.14), bulan (intensitas), latar }
   * Kembalikan { bulan, langit, kilat(waktuList), update(t) }. update(t) memberi kilat bila ada.
   */
  HR.suasana = (scene, renderer, o = {}) => {
    const THREE = need();
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = o.exposure ?? 1.2;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    scene.background = new THREE.Color(o.latar ?? HR.WARNA.malam);
    scene.fog = new THREE.FogExp2(o.kabut ?? HR.WARNA.kabut, o.rapat ?? 0.09);
    const langit = new THREE.HemisphereLight('#4a5a8a', '#0a0a10', o.langit ?? 0.6);
    scene.add(langit);
    const bulan = new THREE.DirectionalLight(HR.WARNA.bulan, o.bulan ?? 2.6);
    bulan.position.set(-4, 9, 3); // dari depan-samping supaya wajah & hantu terbaca (siluet tetap ada lewat kabut)
    bulan.castShadow = true;
    bulan.shadow.mapSize.set(1024, 1024);
    Object.assign(bulan.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 });
    scene.add(bulan);
    let flashes = o.kilat || [];
    const base = bulan.intensity;
    return {
      bulan,
      langit,
      /** waktu kilat (detik). Satu kilat = 2 kedipan cepat. Pasangkan dengan sfx "guntur" 0,3-1 dtk sesudahnya. */
      kilat(list) {
        flashes = list || [];
      },
      update(t) {
        const k = HR.kilatAt(t, flashes);
        bulan.intensity = base + k * 9;
        langit.intensity = (o.langit ?? 0.6) + k * 1.5;
        return k;
      },
    };
  };

  /** Kekuatan kilat 0..1 di waktu t untuk daftar waktu kilat. */
  HR.kilatAt = (t, list) => {
    let k = 0;
    for (const t0 of list || []) {
      const d = t - t0;
      if (d < 0 || d > 0.6) continue;
      k = Math.max(k, Math.exp(-d * 30), d > 0.12 ? Math.exp(-(d - 0.12) * 18) * 0.8 : 0);
    }
    return k;
  };

  /**
   * Lentera/lampu minyak/bohlam yang berkedip deterministik. o: { warna, kuat, jarak, seed, padam: [[dari,sampai],...] }
   * padam = lampu mati total di rentang itu (sebelum hantu muncul). Kembalikan { light, update(t) }.
   */
  HR.lentera = (o = {}) => {
    const THREE = need();
    const light = new THREE.PointLight(o.warna ?? HR.WARNA.lentera, o.kuat ?? 6, o.jarak ?? 9, 1.6);
    light.castShadow = !!o.bayangan;
    const kaca = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), new THREE.MeshBasicMaterial({ color: o.warna ?? HR.WARNA.lentera }));
    light.add(kaca);
    const seed = o.seed ?? 3;
    return {
      light,
      update(t) {
        const off = (o.padam || []).some(([a, b]) => t >= a && t < b);
        const kedip = 0.82 + 0.18 * HF.noise(t * 9, seed) - (HF.noise(t * 2.3, seed + 7) > 0.86 ? 0.5 : 0);
        light.intensity = off ? 0 : (o.kuat ?? 6) * kedip;
        kaca.visible = !off;
        return light.intensity;
      },
    };
  };

  // ---------------------------------------------------------------- material
  const mat = (warna, o = {}) => new (need().MeshPhysicalMaterial)({ color: warna, roughness: o.r ?? 0.75, sheen: o.sheen ?? 0, clearcoat: o.cc ?? 0, transparent: o.op != null, opacity: o.op ?? 1, emissive: o.em ?? '#000000', emissiveIntensity: o.ei ?? 1 });
  HR.mat = mat;
  /** Sepasang mata menyala (emissive + titik cahaya kecil). Kembalikan { group, set(nyala 0..1) }. */
  HR.mataMenyala = (o = {}) => {
    const THREE = need();
    const g = new THREE.Group();
    const m = mat(o.warna ?? HR.WARNA.mata, { em: o.warna ?? HR.WARNA.mata, ei: 2.2, r: 0.3 });
    const jarak = o.jarak ?? 0.11;
    for (const x of [-jarak, jarak]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(o.besar ?? 0.045, 16, 12), m);
      e.position.x = x;
      e.scale.y = o.sipit ?? 0.7;
      g.add(e);
    }
    const glow = new THREE.PointLight(o.warna ?? HR.WARNA.mata, 0.15, 0.7, 2); // kecil: jangan sampai mewarnai baju merah (terlihat seperti darah)
    g.add(glow);
    return {
      group: g,
      set(n) {
        m.emissiveIntensity = 2.2 * n;
        glow.intensity = 0.15 * n;
        g.visible = n > 0.01;
      },
    };
  };

  // ---------------------------------------------------------------- hantu kartun
  // Semua hantu: { group, update(t, s) }. s (opsional): { nyala: 0..1 (mata), muncul: 0..1 (opasitas/skala) }.
  // Tinggi kira-kira 1,7-2,4 unit; berdiri di y = 0.

  /** Kuntilanak: gaun putih panjang melayang, rambut hitam panjang menutupi sebagian wajah, mata merah. */
  HR.kuntilanak = (o = {}) => {
    const THREE = need();
    const g = new THREE.Group();
    const putih = mat(o.gaun ?? HR.WARNA.putihHantu, { r: 0.9, sheen: 0.5, op: 1 });
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const u = i / 12;
      pts.push(new THREE.Vector2(0.18 + 0.42 * Math.pow(u, 1.4) + 0.03 * Math.sin(u * 20), 1.5 - u * 1.5));
    }
    const gaun = new THREE.Mesh(new THREE.LatheGeometry(pts, 40), putih);
    gaun.castShadow = true;
    g.add(gaun);
    const kepala = new THREE.Mesh(new THREE.SphereGeometry(0.24, 40, 30), mat(o.kulit ?? HR.WARNA.kulitPucat, { r: 0.6, sheen: 0.3 }));
    kepala.position.y = 1.78;
    g.add(kepala);
    const hitam = mat(HR.WARNA.rambut, { r: 0.55, cc: 0.3 });
    const rambut = new THREE.Group();
    const helai = [];
    const n = 22;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const depan = Math.cos(a) > 0.55; // helai depan menutupi wajah (celah di tengah)
      const tengah = Math.abs(Math.sin(a)) < 0.12 && depan;
      if (tengah) continue;
      const len = depan ? 0.75 : 1.15;
      const h = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.02, len, 6), hitam);
      h.geometry.translate(0, -len / 2, 0);
      h.position.set(Math.sin(a) * 0.2, 1.95, Math.cos(a) * 0.2);
      h.rotation.z = Math.sin(a) * 0.12;
      h.rotation.x = -Math.cos(a) * 0.12;
      rambut.add(h);
      helai.push({ h, a });
    }
    const topi = new THREE.Mesh(new THREE.SphereGeometry(0.26, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.55), hitam);
    topi.position.y = 1.8;
    rambut.add(topi);
    g.add(rambut);
    const mata = HR.mataMenyala({ jarak: 0.08 });
    mata.group.position.set(0, 1.8, 0.22);
    g.add(mata.group);
    const lengan = [];
    for (const s of [-1, 1]) {
      const l = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.6, 6, 12), putih);
      l.geometry.translate(0, -0.3, 0);
      l.position.set(s * 0.26, 1.42, 0.02);
      l.rotation.z = s * 0.25;
      g.add(l);
      lengan.push({ l, s });
    }
    g.userData.tinggi = 2.1;
    return {
      group: g,
      mata,
      update(t, s = {}) {
        const m = s.muncul ?? 1;
        g.position.y = (o.melayang ?? 0.18) + Math.sin(t * 1.3) * 0.06;
        putih.opacity = 0.35 + 0.65 * m;
        for (const { h, a } of helai) h.rotation.x = -Math.cos(a) * 0.12 + Math.sin(t * 1.7 + a * 3) * 0.05;
        for (const { l, s: sd } of lengan) l.rotation.x = -(s.raih ?? 0) * 1.2 + Math.sin(t * 1.1 + sd) * 0.05;
        mata.set(s.nyala ?? 1);
        g.scale.setScalar(0.85 + 0.15 * m);
      },
    };
  };

  /** Pocong: kain kafan putih terikat di kepala, wajah gelap bulat dengan mata, melompat pelan. */
  HR.pocong = (o = {}) => {
    const THREE = need();
    const g = new THREE.Group();
    const kain = mat(o.kain ?? '#e6e2d6', { r: 0.95, sheen: 0.4 });
    const badan = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 1.2, 10, 28), kain);
    badan.position.y = 0.95;
    badan.castShadow = true;
    g.add(badan);
    const wajah = new THREE.Mesh(new THREE.SphereGeometry(0.22, 32, 24), mat('#3a3f3a', { r: 0.7 }));
    wajah.position.set(0, 1.5, 0.2);
    wajah.scale.set(1, 1.1, 0.55);
    g.add(wajah);
    const ikat = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 18), kain);
    ikat.position.y = 2.04;
    g.add(ikat);
    const simpul = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.035, 8, 20), kain);
    simpul.position.y = 1.86;
    simpul.rotation.x = Math.PI / 2;
    g.add(simpul);
    const ikatKaki = simpul.clone();
    ikatKaki.position.y = 0.32;
    ikatKaki.scale.setScalar(2.3);
    g.add(ikatKaki);
    const mata = HR.mataMenyala({ jarak: 0.08, warna: o.mata ?? '#ffefc0' });
    mata.group.position.set(0, 1.53, 0.31);
    g.add(mata.group);
    g.userData.tinggi = 2.2;
    return {
      group: g,
      mata,
      update(t, s = {}) {
        const hop = s.lompat === false ? 0 : Math.abs(Math.sin(t * Math.PI * (o.laju ?? 1.2)));
        g.position.y = hop * 0.28;
        badan.scale.set(1 + (1 - hop) * 0.05, 1 - (1 - hop) * 0.06, 1);
        g.rotation.z = Math.sin(t * 2.4) * 0.03;
        mata.set(s.nyala ?? 1);
        g.scale.setScalar(0.85 + 0.15 * (s.muncul ?? 1));
      },
    };
  };

  /** Genderuwo: sosok besar berbulu gelap, hanya siluet + mata merah yang jelas. Muncul dari balik pohon/gelap. */
  HR.genderuwo = (o = {}) => {
    const THREE = need();
    const g = new THREE.Group();
    const bulu = mat(o.warna ?? '#17120e', { r: 1 });
    const badan = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 3), bulu);
    badan.scale.set(1, 1.25, 0.8);
    badan.position.y = 1.3;
    const pos = badan.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const k = 1 + 0.08 * (HF.noise(i * 0.37, 5) - 0.5);
      pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k, pos.getZ(i) * k);
    }
    badan.geometry.computeVertexNormals();
    badan.castShadow = true;
    g.add(badan);
    const kepala = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 2), bulu);
    kepala.position.set(0, 2.55, 0.1);
    g.add(kepala);
    const lengan = [];
    for (const s of [-1, 1]) {
      const l = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 1.1, 6, 12), bulu);
      l.geometry.translate(0, -0.55, 0);
      l.position.set(s * 0.95, 2.0, 0);
      l.rotation.z = s * 0.25;
      g.add(l);
      lengan.push({ l, s });
    }
    const mata = HR.mataMenyala({ jarak: 0.16, besar: 0.06 });
    mata.group.position.set(0, 2.6, 0.5);
    g.add(mata.group);
    g.userData.tinggi = 3;
    return {
      group: g,
      mata,
      update(t, s = {}) {
        const napas = Math.sin(t * 1.4);
        badan.scale.set(1 + napas * 0.02, 1.25 + napas * 0.03, 0.8);
        for (const { l, s: sd } of lengan) l.rotation.z = sd * (0.25 + napas * 0.03);
        mata.set(s.nyala ?? 1);
        g.scale.setScalar(o.besar ?? 1);
      },
    };
  };

  /** Sosok bayangan tanpa wajah (untuk horor nyata: "sesuatu" yang dilihat saksi, tidak digambar jelas). */
  HR.bayangan = (o = {}) => {
    const THREE = need();
    const g = new THREE.Group();
    const m = new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.92 });
    const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.2, 8, 20), m);
    b.position.y = 0.95;
    g.add(b);
    const k = new THREE.Mesh(new THREE.SphereGeometry(0.24, 24, 18), m);
    k.position.y = 1.85;
    g.add(k);
    const mata = HR.mataMenyala({ jarak: 0.07, besar: 0.03, warna: o.mata ?? '#ffffff' });
    mata.group.position.set(0, 1.88, 0.22);
    g.add(mata.group);
    return {
      group: g,
      mata,
      update(t, s = {}) {
        m.opacity = 0.92 * (s.muncul ?? 1);
        g.position.x = (o.x ?? 0) + (HF.noise(t * 3, 11) - 0.5) * 0.04; // getar halus
        mata.set((s.nyala ?? (o.mataNyala ? 1 : 0)) * (s.muncul ?? 1));
      },
    };
  };

  // ---------------------------------------------------------------- tokoh manusia kartun (korban/saksi)
  /**
   * Tokoh manusia kartun 3D (kepala besar, mata besar). o: { kulit, baju, celana, rambut, hijab (bool), sarung (bool) }
   * update(t, { takut 0..1, lihat: -1..1 (toleh), jalan (bool), senter (bool) })
   */
  HR.orang = (o = {}) => {
    const THREE = need();
    const g = new THREE.Group();
    const kulit = mat(o.kulit ?? '#c98f65', { r: 0.55, sheen: 0.4 });
    const baju = mat(o.baju ?? '#5b7aa5', { r: 0.9 });
    const celana = mat(o.celana ?? '#2d3240', { r: 0.9 });
    const badan = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.5, 8, 24), baju);
    badan.position.y = 0.95;
    badan.castShadow = true;
    g.add(badan);
    const kaki = [];
    for (const s of [-1, 1]) {
      const k = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.45, 6, 12), o.sarung ? baju : celana);
      k.geometry.translate(0, -0.25, 0);
      k.position.set(s * 0.13, 0.6, 0);
      k.castShadow = true;
      g.add(k);
      kaki.push({ k, s });
    }
    const lengan = [];
    for (const s of [-1, 1]) {
      const l = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.42, 6, 12), baju);
      l.geometry.translate(0, -0.22, 0);
      l.position.set(s * 0.36, 1.2, 0);
      g.add(l);
      lengan.push({ l, s });
    }
    const kepala = new THREE.Group();
    kepala.position.y = 1.75;
    g.add(kepala);
    const kp = new THREE.Mesh(new THREE.SphereGeometry(0.42, 48, 36), kulit);
    kp.castShadow = true;
    kepala.add(kp);
    if (o.hijab) {
      const hj = new THREE.Mesh(new THREE.SphereGeometry(0.46, 40, 30, 0, Math.PI * 2, 0, Math.PI * 0.62), mat(o.rambut ?? '#7a3b4a', { r: 0.9 }));
      hj.rotation.x = -0.35;
      kepala.add(hj);
      const leher = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.5, 32, 1, true), mat(o.rambut ?? '#7a3b4a', { r: 0.9 }));
      leher.position.y = -0.4;
      kepala.add(leher);
    } else {
      const rb = new THREE.Mesh(new THREE.SphereGeometry(0.44, 40, 30, 0, Math.PI * 2, 0, Math.PI * 0.45), mat(o.rambut ?? '#15110f', { r: 0.6, cc: 0.2 }));
      rb.rotation.x = -0.25;
      kepala.add(rb);
    }
    const putih = mat('#ffffff', { r: 0.15, cc: 1 });
    const iris = mat('#1b120c', { r: 0.1, cc: 1 });
    const mata = [];
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 18), putih);
      w.position.set(s * 0.15, 0.04, 0.35);
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.06, 20, 14), iris);
      p.position.set(0, 0, 0.07);
      w.add(p);
      kepala.add(w);
      mata.push({ w, p });
    }
    const alis = [];
    for (const s of [-1, 1]) {
      const a = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.025, 0.02), mat('#1a1410'));
      a.position.set(s * 0.15, 0.2, 0.39);
      kepala.add(a);
      alis.push({ a, s });
    }
    const mulut = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 8, 20, Math.PI), mat('#4a1d1d'));
    mulut.position.set(0, -0.16, 0.39);
    kepala.add(mulut);
    let senter = null;
    if (o.senter) {
      senter = new THREE.SpotLight('#fff4d6', 14, 10, 0.35, 0.5, 1.5);
      senter.position.set(0.36, 1.0, 0.2);
      senter.castShadow = true;
      g.add(senter);
      g.add(senter.target);
      senter.target.position.set(0.4, 0.4, 4);
    }
    return {
      group: g,
      senter,
      update(t, s = {}) {
        const tk = s.takut ?? 0;
        const tt = HF.stepTime ? HF.stepTime(t, 30) : t;
        const kedip = (tt % 3.1) < 0.1 && tk < 0.7 ? 0.1 : 1;
        for (const { w, p } of mata) {
          w.scale.set(1 + tk * 0.25, (1 + tk * 0.3) * kedip, 1);
          p.scale.setScalar(1 - tk * 0.45); // pupil mengecil saat takut
        }
        for (const { a, s: sd } of alis) {
          a.position.y = 0.2 + tk * 0.05;
          a.rotation.z = sd * tk * -0.35;
        }
        mulut.rotation.z = tk > 0.5 ? Math.PI : 0;
        mulut.scale.set(1, 1 + tk * 1.5, 1);
        kepala.rotation.y = (s.lihat ?? 0) * 0.9;
        const gemetar = tk > 0.6 ? (HF.noise(t * 25, 4) - 0.5) * 0.02 * tk : 0;
        if (g.userData.x0 == null) g.userData.x0 = g.position.x;
        g.position.x = (s.x ?? g.userData.x0) + gemetar;
        const jalan = s.jalan ? Math.sin(t * 6) : 0;
        for (const { k, s: sd } of kaki) k.rotation.x = jalan * 0.5 * sd;
        for (const { l, s: sd } of lengan) {
          l.rotation.x = -jalan * 0.4 * sd - tk * 0.6;
          l.rotation.z = sd * (0.12 + tk * 0.15);
        }
        badan.scale.y = 1 + Math.sin(t * (2 + tk * 6)) * 0.015; // napas makin cepat saat takut
      },
    };
  };

  // ---------------------------------------------------------------- latar & benda
  /** Pohon beringin tua: batang tebal, akar gantung, tajuk gelap. */
  HR.beringin = (o = {}) => {
    const THREE = need();
    const g = new THREE.Group();
    const kayu = mat(o.kayu ?? '#2e241c', { r: 1 });
    const batang = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.95, 4, 18), kayu);
    batang.position.y = 2;
    batang.castShadow = true;
    g.add(batang);
    const daun = mat(o.daun ?? '#132219', { r: 1 });
    const rng = HF.rng(o.seed ?? 21);
    for (let i = 0; i < 9; i++) {
      const d = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2 + rng() * 0.8, 1), daun);
      d.position.set((rng() - 0.5) * 4.5, 4.3 + rng() * 1.3, (rng() - 0.5) * 2.5);
      d.castShadow = true;
      g.add(d);
    }
    const akar = [];
    for (let i = 0; i < 26; i++) {
      const len = 1.2 + rng() * 2.4;
      const a = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.035, len, 5), kayu);
      a.geometry.translate(0, -len / 2, 0);
      a.position.set((rng() - 0.5) * 4.2, 4.2, (rng() - 0.5) * 2.2);
      g.add(a);
      akar.push({ a, p: rng() * 6 });
    }
    return {
      group: g,
      update(t, angin = 1) {
        for (const { a, p } of akar) a.rotation.z = Math.sin(t * 0.9 + p) * 0.04 * angin;
      },
    };
  };

  /** Batu nisan (kuburan kampung). n nisan acak di area lebar w x d. */
  HR.nisan = (o = {}) => {
    const THREE = need();
    const g = new THREE.Group();
    const batu = mat(o.warna ?? '#6b6f68', { r: 1 });
    const rng = HF.rng(o.seed ?? 8);
    for (let i = 0; i < (o.n ?? 7); i++) {
      const h = 0.5 + rng() * 0.4;
      const n = new THREE.Mesh(new THREE.BoxGeometry(0.35, h, 0.12), batu);
      n.position.set((rng() - 0.5) * (o.w ?? 6), h / 2, (rng() - 0.5) * (o.d ?? 4));
      n.rotation.set((rng() - 0.5) * 0.15, (rng() - 0.5) * 0.4, (rng() - 0.5) * 0.15);
      n.castShadow = true;
      const atas = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.175, 0.12, 16, 1, false, 0, Math.PI), batu);
      atas.rotation.set(Math.PI / 2, Math.PI / 2, 0);
      atas.position.y = h / 2;
      n.add(atas);
      g.add(n);
    }
    return { group: g };
  };

  /** Rumah kayu kampung tua: dinding papan, atap pelana, jendela (bisa menyala/gelap), pintu (bisa terbuka). */
  HR.rumah = (o = {}) => {
    const THREE = need();
    const g = new THREE.Group();
    const kayu = mat(o.kayu ?? HR.WARNA.kayu, { r: 1 });
    const dinding = new THREE.Mesh(new THREE.BoxGeometry(4, 2.6, 3), kayu);
    dinding.position.y = 1.5;
    dinding.castShadow = true;
    dinding.receiveShadow = true;
    g.add(dinding);
    const atap = new THREE.Mesh(new THREE.ConeGeometry(3.4, 1.6, 4, 1), mat(o.atap ?? '#3a1f18', { r: 1 }));
    atap.position.y = 3.6;
    atap.rotation.y = Math.PI / 4;
    atap.scale.z = 0.75;
    atap.castShadow = true;
    g.add(atap);
    const jendelaMat = new THREE.MeshBasicMaterial({ color: '#ffcf7a' });
    const jendela = [];
    for (const x of [-1.2, 1.2]) {
      const j = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.8), jendelaMat);
      j.position.set(x, 1.8, 1.51);
      g.add(j);
      jendela.push(j);
    }
    const pintu = new THREE.Group();
    pintu.position.set(-0.4, 0.2, 1.52);
    const daun = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.7, 0.05), mat('#24170f', { r: 1 }));
    daun.position.set(0.4, 0.85, 0);
    pintu.add(daun);
    g.add(pintu);
    const tiang = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.2, 3.2), kayu);
    tiang.position.y = 0.1;
    g.add(tiang);
    return {
      group: g,
      /** nyala 0..1 jendela, buka 0..1 pintu */
      update(t, s = {}) {
        const n = s.nyala ?? 1;
        jendelaMat.color.set('#000000').lerp(new THREE.Color('#ffcf7a'), n * (0.85 + 0.15 * HF.noise(t * 6, 2)));
        pintu.rotation.y = -(s.buka ?? 0) * 1.4;
      },
    };
  };

  /** Tanah berumput gelap besar + jalan setapak opsional. */
  HR.tanah = (o = {}) => {
    const THREE = need();
    const g = new THREE.Group();
    const t = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), mat(o.warna ?? HR.WARNA.rumput, { r: 1 }));
    t.rotation.x = -Math.PI / 2;
    t.receiveShadow = true;
    g.add(t);
    if (o.jalan) {
      const j = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 60), mat('#3a3428', { r: 1 }));
      j.rotation.x = -Math.PI / 2;
      j.position.y = 0.01;
      j.receiveShadow = true;
      g.add(j);
    }
    return { group: g };
  };

  /** Kabut tanah bergerak (sprite datar transparan). Kembalikan { group, update(t) }. */
  HR.kabutTanah = (o = {}) => {
    const THREE = need();
    const g = new THREE.Group();
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(200,210,230,0.55)');
    gr.addColorStop(1, 'rgba(200,210,230,0)');
    x.fillStyle = gr;
    x.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: o.tebal ?? 0.5 });
    const rng = HF.rng(o.seed ?? 13);
    const keping = [];
    for (let i = 0; i < (o.n ?? 26); i++) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(3 + rng() * 3, 3 + rng() * 3), m);
      p.rotation.x = -Math.PI / 2;
      p.position.set((rng() - 0.5) * (o.w ?? 14), 0.15 + rng() * 0.35, (rng() - 0.5) * (o.d ?? 10));
      g.add(p);
      keping.push({ p, x0: p.position.x, v: 0.1 + rng() * 0.2 });
    }
    return {
      group: g,
      update(t) {
        const w = o.w ?? 14;
        for (const k of keping) k.p.position.x = ((k.x0 + t * k.v + w / 2) % w + w) % w - w / 2;
      },
    };
  };

  // ---------------------------------------------------------------- kamera
  /** Kamera genggam: goyang halus (amp ~0.01-0.04). Panggil SETELAH posisi/lookAt kamera diatur. */
  HR.kameraGoyang = (cam, t, amp = 0.02, seed = 31) => {
    cam.rotation.x += (HF.noise(t * 1.7, seed) - 0.5) * amp;
    cam.rotation.y += (HF.noise(t * 1.3, seed + 3) - 0.5) * amp;
    cam.rotation.z += (HF.noise(t * 0.9, seed + 9) - 0.5) * amp * 0.5;
  };
  /** Zoom pelan menekan (dolly-in) untuk membangun ketegangan: kembalikan faktor 0..1 dari a ke b dengan ease. */
  HR.dekati = (t, a, b) => HF.ease.inOut(HF.prog(t, a, b));

  // ---------------------------------------------------------------- detak jantung (sama persis dengan tools/score.mjs)
  /**
   * Waktu-waktu detak dari bagian "jantung" score.json: [{ dari, sampai, bpm0, bpm1 }].
   * Algoritma IDENTIK dengan score.mjs supaya denyut layar pas dengan suara detak.
   */
  HR.ketukanJantung = (jantung) => {
    const out = [];
    for (const j of jantung || []) {
      const a = Number(j.dari) || 0;
      const b = Number(j.sampai) || a;
      const b0 = Number(j.bpm0 ?? 70);
      const b1 = Number(j.bpm1 ?? b0);
      let t = a;
      while (t < b) {
        const u = (t - a) / Math.max(1e-6, b - a);
        out.push({ t, u });
        t += 60 / (b0 + (b1 - b0) * u * u);
      }
    }
    return out;
  };
  /** Kekuatan denyut 0..1 di waktu t (puncak di setiap detak "lub", lebih kecil di "dub"). */
  HR.denyut = (t, beats) => {
    let k = 0;
    for (const b of beats || []) {
      const d = t - b.t;
      if (d < 0 || d > 0.5) continue;
      k = Math.max(k, Math.exp(-d * 14) * (0.6 + 0.4 * b.u), d > 0.16 ? Math.exp(-(d - 0.16) * 16) * 0.6 * (0.6 + 0.4 * b.u) : 0);
    }
    return k;
  };

  // ---------------------------------------------------------------- lapisan 2D (canvas ui di atas WebGL)
  /**
   * Lapisan akhir frame: vinyet gelap (berdenyut merah bila o.denyut), butiran film, garis pindai tipis (o.vhs untuk
   * horor nyata: rekaman/arsip), kedip gelap (o.gelap 0..1). Panggil sebelum subtitle.
   */
  HR.overlay = (ctx, t, o = {}) => {
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    const d = o.denyut ?? 0;
    ctx.save();
    const r0 = Math.min(W, H) * (0.38 - d * 0.06);
    const g = ctx.createRadialGradient(W / 2, H / 2, r0, W / 2, H / 2, Math.hypot(W, H) * 0.62);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, d > 0.01 ? `rgba(${Math.round(60 + 90 * d)},0,0,${0.75 + 0.15 * d})` : `rgba(0,0,0,${o.vinyet ?? 0.78})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    if (o.gelap) {
      ctx.fillStyle = `rgba(0,0,0,${HF.clamp(o.gelap)})`;
      ctx.fillRect(0, 0, W, H);
    }
    const grain = o.butir ?? 0.07;
    if (grain > 0) {
      const f = Math.floor(t * 24); // butiran ganti tiap frame 24 fps, deterministik
      const rng = HF.rng(1000 + f);
      const n = Math.floor((W * H) / 900);
      for (let i = 0; i < n; i++) {
        const v = rng() > 0.5 ? 255 : 0;
        ctx.fillStyle = `rgba(${v},${v},${v},${grain * rng()})`;
        ctx.fillRect(rng() * W, rng() * H, 2, 2);
      }
    }
    if (o.vhs) {
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
      const band = ((t * 0.37) % 1) * H;
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fillRect(0, band, W, H * 0.03);
    }
    ctx.restore();
  };

  /**
   * Kartu teks horor (judul bab, nama tempat, tahun, "Berdasarkan kisah yang beredar di ..."). Huruf serif tipis,
   * muncul pelan, sedikit bergetar. o: { t0, t1, judul, sub, y (0..1), ukuran }
   */
  HR.kartu = (ctx, t, o) => {
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    const a = HF.prog(t, o.t0, o.t0 + 0.8) * (1 - HF.prog(t, (o.t1 ?? o.t0 + 3) - 0.6, o.t1 ?? o.t0 + 3));
    if (a <= 0) return;
    const S = Math.min(W, H);
    const y = (o.y ?? 0.42) * H;
    const jx = (HF.noise(t * 12, 77) - 0.5) * S * 0.003;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = S * 0.02;
    ctx.fillStyle = o.warna ?? '#efe9e1';
    ctx.font = `600 ${Math.round(S * (o.ukuran ?? 0.075))}px Georgia, "Times New Roman", serif`;
    ctx.fillText(o.judul, W / 2 + jx, y);
    if (o.sub) {
      ctx.fillStyle = o.warnaSub ?? '#ff6b6b';
      ctx.font = `400 ${Math.round(S * 0.034)}px Georgia, "Times New Roman", serif`;
      ctx.fillText(o.sub, W / 2, y + S * 0.08);
    }
    ctx.restore();
  };

  /** Penutup horor: layar gelap, satu kalimat terakhir yang dingin lalu "Terima kasih sudah menonton." */
  HR.penutup = (ctx, t, o) => {
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    const a = HF.prog(t, o.t0, o.t0 + 0.8);
    if (a <= 0) return;
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${0.85 * a})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    if (o.kalimat) HR.kartu(ctx, t, { t0: o.t0 + 0.3, t1: o.t0 + 99, judul: o.kalimat, y: 0.4, ukuran: 0.045 });
    HR.kartu(ctx, t, { t0: o.t0 + 1.6, t1: o.t0 + 99, judul: 'Terima kasih sudah menonton', sub: o.sub ?? 'Sampai jumpa', y: 0.55, ukuran: 0.05, warnaSub: '#c9c3bb' });
  };

  window.HR = HR;
})();
