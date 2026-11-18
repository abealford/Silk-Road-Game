
// ============================================================
//  BUILDERS: low-poly geometry assembly for buildings, trees, props
// ============================================================
const BLD = (() => {
  const V3 = THREE.Vector3, Q = THREE.Quaternion, M4 = THREE.Matrix4;
  const UP = new V3(0, 1, 0);
  const tmpl = {};
  function T(key, make) {
    if (!tmpl[key]) { let g = make(); if (g.index) g = g.toNonIndexed(); tmpl[key] = g.attributes.position.array; }
    return tmpl[key];
  }
  const colCache = {};
  function col(c) {
    if (Array.isArray(c)) return c;
    if (colCache[c] === undefined) { const k = new THREE.Color(c); colCache[c] = [k.r, k.g, k.b]; }
    return colCache[c];
  }
  // custom templates
  function prismGeo() { // gable roof: ridge along x, unit size, base y=0..1
    const g = new THREE.BufferGeometry();
    const v = [
      -.5,0,.5, .5,0,.5, .5,1,0,  -.5,0,.5, .5,1,0, -.5,1,0,   // front slope
      .5,0,-.5, -.5,0,-.5, -.5,1,0,  .5,0,-.5, -.5,1,0, .5,1,0, // back slope
      -.5,0,-.5, -.5,0,.5, -.5,1,0,   .5,0,.5, .5,0,-.5, .5,1,0, // gables
    ];
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); return g;
  }
  function hipGeo(ridge, lift) { // flared hip roof, unit footprint, ridge length fraction along x
    const r = ridge / 2, L = lift;
    const c0 = [-.5, L, .5], c1 = [.5, L, .5], c2 = [.5, L, -.5], c3 = [-.5, L, -.5];
    const mf = [0, 0, .5], mr = [.5, 0, 0], mb = [0, 0, -.5], ml = [-.5, 0, 0];
    const r0 = [-r, 1, 0], r1 = [r, 1, 0];
    const tris = [
      c0, mf, r0, mf, r1, r0, mf, c1, r1,
      c2, mb, r1, mb, r0, r1, mb, c3, r0,
      c1, mr, r1, mr, c2, r1,
      c3, ml, r0, ml, c0, r0,
    ];
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3)); return g;
  }

  class Builder {
    constructor() { this.pos = []; this.col = []; this.stack = []; this.cur = new M4(); this.jit = 0.04; this.rng = Math.random; this._m = new M4(); this._v = new V3(); this.ao = true; }
    push(x, y, z, ry = 0, s = 1) {
      this.stack.push(this.cur.clone());
      const m = new M4().compose(new V3(x, y, z), new Q().setFromAxisAngle(UP, ry), new V3(s, s, s));
      this.cur.multiply(m);
    }
    pushM(m) { this.stack.push(this.cur.clone()); this.cur.multiply(m); }
    pop() { this.cur = this.stack.pop(); }
    add(arr, m, c, ao) {
      const full = this._m.multiplyMatrices(this.cur, m); const e = full.elements; const cc = col(c);
      const j = 1 + (this.rng() - 0.5) * 2 * this.jit; const r = cc[0] * j, g = cc[1] * j, b = cc[2] * j;
      const P = this.pos, C = this.col; const sy = m.elements[5];
      for (let i = 0; i < arr.length; i += 3) {
        const x = arr[i], y = arr[i + 1], z = arr[i + 2];
        P.push(e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]);
        const k = ao && this.ao ? (y <= 0.001 ? 0.72 : 1) : 1;
        C.push(r * k, g * k, b * k);
      }
    }
    mat(x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0) {
      const q = new Q().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ'));
      return new M4().compose(new V3(x, y, z), q, new V3(sx, sy, sz));
    }
    // y = bottom
    box(x, y, z, w, h, d, c, ry = 0, rx = 0, rz = 0) { this.add(T('box', () => new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0)), this.mat(x, y, z, w, h, d, ry, rx, rz), c, h > 0.9); }
    arch(x, y, z, r, w, c, ry = 0) { this.add(T('arch', () => new THREE.CylinderGeometry(1, 1, 1, 12, 1, true, 0, Math.PI).rotateZ(Math.PI / 2)), this.mat(x, y, z, w, r, r, ry), c); }
    cyl(x, y, z, rt, rb, h, c, seg = 8, ry = 0, rx = 0, rz = 0) {
      const k = 'cyl' + seg + '_' + (rt / rb).toFixed(2);
      this.add(T(k, () => new THREE.CylinderGeometry(rt / rb, 1, 1, seg).translate(0, .5, 0)), this.mat(x, y, z, rb, h, rb, ry, rx, rz), c, h > 0.9 && !rx && !rz);
    }
    cone(x, y, z, r, h, c, seg = 8, ry = 0, rx = 0, rz = 0) { this.add(T('cone' + seg, () => new THREE.ConeGeometry(1, 1, seg).translate(0, .5, 0)), this.mat(x, y, z, r, h, r, ry, rx, rz), c); }
    dome(x, y, z, r, c, seg = 12, hs = 1) { this.add(T('dome' + seg, () => new THREE.SphereGeometry(1, seg, Math.max(3, seg / 2 | 0), 0, Math.PI * 2, 0, Math.PI / 2)), this.mat(x, y, z, r, r * hs, r), c); }
    sphere(x, y, z, r, c, seg = 6, sy = 1, sx = 1) { this.add(T('sph' + seg, () => new THREE.SphereGeometry(1, seg, Math.max(3, seg / 2 | 0))), this.mat(x, y, z, r * sx, r * sy, r), c); }
    ico(x, y, z, r, c, sy = 1, sx = 1, ry = 0) { this.add(T('ico', () => new THREE.IcosahedronGeometry(1, 0)), this.mat(x, y, z, r * sx, r * sy, r, ry), c); }
    dodec(x, y, z, r, c, sy = 1, sx = 1, ry = 0) { this.add(T('dod', () => new THREE.DodecahedronGeometry(1, 0)), this.mat(x, y, z, r * sx, r * sy, r, ry), c); }
    gable(x, y, z, w, h, d, c, ry = 0) { this.add(T('prism', prismGeo), this.mat(x, y, z, w, h, d, ry), c); }
    hip(x, y, z, w, h, d, c, ry = 0, lift = 0.22) {
      const ridge = Math.max(0, (w - d) / w) * 0.9; const k = 'hip' + ridge.toFixed(2) + lift;
      this.add(T(k, () => hipGeo(ridge, lift)), this.mat(x, y, z, w, h, d, ry), c);
    }
    pyramid(x, y, z, w, h, c, ry = 0) { this.add(T('pyr', () => new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4).translate(0, .5, 0)), this.mat(x, y, z, w, h, w, ry), c); }
    tri(a, b, c, ca, cb, cc) {
      const e = this.cur.elements; const P = this.pos, Cl = this.col;
      for (const [v, k] of [[a, ca], [b, cb], [c, cc]]) {
        const x = v[0], y = v[1], z = v[2];
        P.push(e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]);
        const kk = col(k); Cl.push(kk[0], kk[1], kk[2]);
      }
    }
    geometry() {
      const g = new THREE.BufferGeometry(); { const P = this.pos; for (let i = 0; i < P.length; i++) if (P[i] !== P[i]) P[i] = 0; }
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
      g.computeVertexNormals(); g.computeBoundingSphere();
      return g;
    }
    get empty() { return this.pos.length === 0; }
  }

  // ---------- palette ----------
  const C = {
    stone: 0xd9cdb4, stoneW: 0xcdb48f, stoneG: 0xa7a39b, stoneD: 0x8a847a, mud: 0xc9a06a, mudL: 0xd8b787, mudD: 0xb08656, brick: 0xb8734a, brickD: 0x9c5a3a,
    terra: 0xb5523b, terra2: 0xa8492f, lead: 0x8e9aa0, turq: 0x2fa7a0, blue: 0x2c5fa8, white: 0xf1ece0, twhite: 0xf3efe6, tred: 0x8e2a22,
    cwall: 0xa59a88, croof: 0x4b4f55, sroof: 0x3e4448, red: 0xa8352a, gold: 0xe0b13a, wood: 0x8a5a36, woodD: 0x5e3d26, dark: 0x2a211c,
    felt: 0xece3cf, sand: 0xe1c48f, green: 0x4f8a54, yellow: 0xe3b32b, iron: 0x6d4a33, marble: 0xe9e4d8, earth: 0xb59468, tuff: 0xc29a86,
    sandstone: 0xcdb28a, redrock: 0xb8603e,
  };
  const pick = (rng, arr) => arr[Math.floor(rng() * arr.length) % arr.length];

  // ---------- houses ----------
  // helpers for facade details on a box of size w x h x d centred at origin (front = +z)
  function windowsRow(b, w, d, y, hgt, wc, frame, n, sides) {
    for (let k = 0; k < n; k++) {
      const x = (k + .5 - n / 2) * (w / n);
      b.box(x, y - .08, d / 2, .62, hgt + .16, .07, frame); b.box(x, y, d / 2 + .02, .44, hgt, .06, wc);
      if (sides) { b.box(-w / 2, y, (k + .5 - n / 2) * (d / n) * .8, .06, hgt, .44, wc); b.box(w / 2, y, (k + .5 - n / 2) * (d / n) * .8, .06, hgt, .44, wc); }
    }
  }
  function house(b, cul, rng, cityId, W0, D0) {
    const s = 0.85 + rng() * 0.5;
    if (cul === 'mongol' || cul === 'steppe') { yurt(b, 0, 0, 1.6 + rng() * 0.6, rng() < 0.15 ? C.gold : null); if (rng() < .5) { b.cyl(2.6, 0, 1.2, .07, .09, 1.4, C.woodD, 4); b.box(2.6, 1.2, 1.2, 1.2, .08, .08, C.woodD); } return 2.4; }
    const w = W0 || (2.6 + rng() * 1.8) * s, d = D0 || (2.6 + rng() * 1.8) * s;
    if (cul === 'byz' || cul === 'armenian' || cul === 'georgian') {
      const wc = cul === 'armenian' ? pick(rng, [C.tuff, 0xb9887a, 0xd2b29b]) : cul === 'georgian' ? pick(rng, [0xd8c8ad, C.stoneW, 0xc9b49a]) : pick(rng, [0xe8dcc3, 0xd9c6a3, 0xcfb796, 0xe5d2b6, 0xddc9b0, 0xe9d2b4]);
      const two = rng() < 0.38; const h = 2.4 + rng() * 0.8 + (two ? 2.2 : 0);
      b.box(0, -.3, 0, w + .2, .5, d + .2, 0xb9ad98);
      b.box(0, 0, 0, w, h, d, wc);
      if (two && cul === 'byz' && rng() < .6) { b.box(0, h - 2.1, 0, w + .5, 2.1, d + .5, pick(rng, [0xe7dcc6, 0xd6c4a5])); for (let k = 0; k < 4; k++) b.box((k / 3 - .5) * (w + .4), h - 2.1, d / 2 + .27, .14, 2.1, .06, C.woodD); b.box(0, h - 2.15, 0, w + .6, .14, d + .6, C.woodD); }
      const nW = Math.max(1, Math.round(w / 1.4));
      windowsRow(b, w, d, 1.3, .6, C.dark, 0xf0e6d2, nW, true); if (two) windowsRow(b, w + (cul === 'byz' ? .5 : 0), d + (cul === 'byz' ? .5 : 0), h - 1.3, .7, C.dark, 0xf0e6d2, nW, true);
      const rc = pick(rng, [C.terra, C.terra2, 0xbf6343, 0xa95238]);
      if (rng() < .5) b.gable(0, h, 0, w + .6, 1.3 + rng() * .4, d + .6, rc); else b.hip(0, h, 0, w + .6, 1.4, d + .6, rc, 0, .05);
      b.box(0, h + 1.2, 0, w * .9, .12, .18, 0x7a3a28);
      if (rng() < .35) { b.box(w * .28, h + .3, -d * .2, .5, 1.6, .5, wc); b.box(w * .28, h + 1.9, -d * .2, .62, .12, .62, 0x8a7a6a); }
      b.box(0, 0, d / 2 + .05, 1.1, 1.85, .06, 0xbfb29a); b.box(0, 0, d / 2 + .08, .8, 1.6, .06, C.woodD);
      if (two && rng() < .3) { b.box(0, h - 2.2, d / 2 + .5, w * .55, .14, 1, C.wood); for (let k = 0; k < 5; k++) b.box((k / 4 - .5) * w * .5, h - 2.06, d / 2 + .98, .07, .7, .07, C.woodD); }
      return Math.max(w, d) * 0.62;
    }
    if (cul === 'chinese' || cul === 'song') {
      const wc = cul === 'song' ? pick(rng, [0xede8dc, 0xe4ddcd, 0xf0ebe0]) : pick(rng, [0xa59a88, 0xb3a690, 0x9e937f, 0xc0b39a]);
      const two = rng() < 0.28; const h = 2.5 + rng() * 0.8 + (two ? 2 : 0);
      const roofC = cul === 'song' ? C.sroof : C.croof;
      b.box(0, -.3, 0, w + .6, .6, d + .6, 0x9a958a);
      b.box(0, 0, 0, w, h, d, wc);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(sx * (w / 2 - .1), 0, sz * (d / 2 - .1), .26, h, .26, cul === 'song' ? 0x5a4636 : C.red);
      b.box(0, h - .35, d / 2 + .02, w, .3, .06, cul === 'song' ? 0x5a4636 : C.red);
      const nW = Math.max(1, Math.round(w / 1.6));
      for (let k = 0; k < nW; k++) { const x = (k + .5 - nW / 2) * (w / nW); if (Math.abs(x) < .7) continue; b.box(x, 1.0, d / 2 + .02, .8, .9, .06, 0x6e5a44); for (let m = 0; m < 3; m++) b.box(x, 1.05 + m * .28, d / 2 + .05, .8, .05, .04, 0xcfc2a8); }
      b.box(0, 0, d / 2 + .04, 1, 1.9, .06, C.red);
      if (two) { b.box(0, h - 2.2, d / 2 + .45, w + .4, .12, .9, C.wood); for (let k = 0; k < 7; k++) b.box((k / 6 - .5) * w, h - 2.08, d / 2 + .86, .06, .55, .06, C.red); }
      b.hip(0, h, 0, w + 1.3, 1.4, d + 1.3, roofC, 0, 0.28);
      b.box(0, h + 1.3, 0, Math.max(.4, (w - d) * .9 + .4), .22, .3, 0x3a3e44);
      for (const sx of [-1, 1]) b.box(sx * Math.max(.2, (w - d) * .45 + .2), h + 1.35, 0, .2, .45, .25, 0x3a3e44, 0, 0, sx * .5);
      if (rng() < .35) { b.sphere(-.8, 1.9, d / 2 + .4, .2, 0xd03a26, 6, 1.3); b.sphere(.8, 1.9, d / 2 + .4, .2, 0xd03a26, 6, 1.3); }
      if (rng() < .25) { b.box(0, 0, d / 2 + 2.2, w + 1, 1.6, .3, wc); }
      return Math.max(w, d) * 0.66;
    }
    if (cul === 'tibet') {
      const h = 3 + rng() * 2.4;
      b.cyl(0, 0, 0, Math.SQRT1_2 * w * .88, Math.SQRT1_2 * w, h, C.twhite, 4, Math.PI / 4);
      b.box(0, h - .5, 0, w * .9, .5, w * .9, C.tred);
      b.box(0, h, 0, w * .92, .14, w * .92, 0x5a3a2a);
      for (let fl = 0; fl < 2; fl++) for (let k = 0; k < 2; k++) { const y = 1 + fl * 1.6; if (y > h - 1) continue; b.box((k - .5) * w * .42, y, w * .45, .62, .78, .07, C.dark); b.box((k - .5) * w * .42, y + .78, w * .45 + .02, .8, .14, .1, 0x8e2a22); }
      b.box(0, 0, w * .46, .9, 1.7, .06, 0x5a2a20);
      if (rng() < .45) { b.cyl(w * .3, h, -w * .2, .05, .06, 2.4, C.woodD, 4); prayerFlagsSmall(b, w * .3, h + 2.3, -w * .2, rng); }
      return w * 0.62;
    }
    // mud-brick cultures
    const wc = cul === 'arab' ? pick(rng, [0xe3d6bd, 0xd9c9a8, 0xcdb894, 0xece2cc]) : cul === 'tarim' ? pick(rng, [0xcfac78, 0xd6b585, 0xc4a06d]) :
      cul === 'rum' ? pick(rng, [0xd6c2a0, 0xc9b08a, 0xdccaa9]) : pick(rng, [C.mud, C.mudL, 0xc49766, 0xd2ad7a, 0xd9b98a]);
    const two = rng() < 0.22; const h = 2.1 + rng() * 0.9 + (two ? 1.5 : 0);
    b.box(0, 0, 0, w, h, d, wc);
    b.box(0, h, 0, w + .1, .3, d + .1, wc);
    b.box(0, h - .05, d / 2 + .02, w, .06, .04, 0x9a7a52);
    for (let k = 0; k < Math.round(w / .8); k++) b.box((k + .5 - Math.round(w / .8) / 2) * .8, h - .35, d / 2 + .12, .12, .12, .3, C.woodD); // roof beams
    const nW = Math.max(1, Math.round(w / 1.8));
    for (let k = 0; k < nW; k++) { const x = (k + .5 - nW / 2) * (w / nW); if (Math.abs(x) < .8) continue; b.box(x, h * .55, d / 2 + .02, .4, .55, .05, C.dark); }
    b.box(0, 0, d / 2 + .02, .9, 1.5, .06, C.dark); b.cyl(0, 1.5, d / 2 + .02, .45, .45, .06, C.dark, 8, 0, Math.PI / 2); b.box(0, 0, d / 2 + .05, .7, 1.45, .05, pick(rng, [0x6a4a30, 0x2c5f7a, 0x7a3a2a]));
    if ((cul === 'persian' || cul === 'central') && rng() < 0.3) b.dome(w * .15, h + .3, -d * .1, Math.min(w, d) * 0.28, wc, 10);
    if (cityId === 'yazd' && rng() < 0.6) { b.box(w * .25, h, d * .2, .9, 2.6, .9, wc); for (let k = 0; k < 3; k++) b.box(w * .25 + (k - 1) * .26, h + 1.4, d * .2 + .46, .14, 1, .05, C.dark); }
    if (cul === 'rum' && rng() < 0.3) b.gable(0, h + .3, 0, w + .3, .8, d + .3, C.terra);
    if (cul === 'arab' && rng() < .3) { b.box(w * .25, h * .5, d / 2 + .35, 1.1, 1.3, .7, C.wood); for (let k = 0; k < 4; k++) b.box(w * .25 + (k - 1.5) * .25, h * .5 + .1, d / 2 + .71, .06, 1.1, .03, C.woodD); }
    if (rng() < .25) for (let k = 0; k < 5; k++) b.box(w / 2 + .35, k * h / 5, -d * .3 + k * .45, .7, h / 5, .45, wc); // stair to roof
    if (rng() < .3) { b.box(0, 2.1, d / 2 + .7, w * .7, .06, 1.4, pick(rng, [0xb0402c, 0x2f6f8f, 0xd09a2a, 0x5a7a3a]), 0, .15); b.cyl(-w * .32, 0, d / 2 + 1.3, .05, .05, 2.0, C.woodD, 4); b.cyl(w * .32, 0, d / 2 + 1.3, .05, .05, 2.0, C.woodD, 4); }
    if (rng() < .4) { b.cyl(-w * .3, h + .3, -d * .25, .22, .28, .5, 0xb8734a, 6); b.box(w * .1, h + .3, -d * .3, .5, .35, .4, 0x9a8a6a); }
    if (cul === 'tarim' && rng() < .45) { b.box(0, h - .2, d / 2 + .9, w * .9, .15, 1.8, C.woodD); for (const sx of [-1, 1]) b.cyl(sx * w * .4, 0, d / 2 + 1.7, .1, .12, h - .2, C.wood, 6); }
    return Math.max(w, d) * 0.6;
  }
  function prayerFlagsSmall(b, x, y, z, rng) {
    const cols = [0x2c5fa8, 0xf2efe6, 0xc0392b, 0x3f8f4f, 0xe3b32b]; const a = rng() * 6.28;
    for (let k = 0; k < 7; k++) { const t = (k + .5) / 7; b.box(x + Math.cos(a) * 3 * t, y - t * 2 - Math.sin(t * Math.PI) * .4, z + Math.sin(a) * 3 * t, .32, .3, .02, cols[k % 5], -a + Math.PI / 2); }
  }
  // street & market furniture
  const FURN = {};
  FURN.stall = (b, rng, cul) => {
    const aw = pick(rng, [0xb0402c, 0x2f6f8f, 0xd09a2a, 0x5a7a3a, 0x8a3a6a, 0xe0d4b8]);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl(sx * 1.25, 0, sz * .8, .05, .06, sz > 0 ? 2.1 : 2.5, C.woodD, 4);
    b.box(0, 2.1, 0, 2.9, .06, 2.0, aw, 0, -.2);
    for (let k = -1; k <= 1; k++) b.box(k * .97, 2.15, .02, .48, .07, 2.02, 0xf2ead8, 0, -.2);
    b.box(0, .75, .45, 2.4, .1, .9, C.wood); b.box(0, 0, .45, 2.3, .75, .06, C.woodD);
    const goods = cul === 'chinese' || cul === 'song' ? [0xd03a26, 0xe3c35a, 0x3f7a6a, 0xf0ede4] : [0xd08a2a, 0xb0402c, 0x7a9a3a, 0xc9a06a, 0x2c5fa8, 0xe0c060];
    for (let k = 0; k < 5; k++) { const c = pick(rng, goods); if (rng() < .5) b.cone(-.9 + k * .45, .85, .4, .2, .3, c, 6); else b.box(-.9 + k * .45, .85, .4, .36, .14 + rng() * .2, .5, c); }
    if (rng() < .5) b.box(0, 0, -.6, 2.6, .05, 1.2, pick(rng, [0x8a2a24, 0x2c4f7a, 0x6a3a5a]));
    for (let k = 0; k < 2; k++) b.sphere(1.6 + k * .4, .3, -.3, .32, 0xc9b48a, 5, .8);
  };
  FURN.barrels = (b, rng) => { for (let k = 0; k < 2 + (rng() * 3 | 0); k++) { const x = (rng() - .5) * 1.6, z = (rng() - .5) * 1.2; b.cyl(x, 0, z, .32, .3, .85, 0x7a5236, 8); b.cyl(x, .2, z, .34, .34, .06, 0x3a3a3a, 8); b.cyl(x, .62, z, .34, .34, .06, 0x3a3a3a, 8); } };
  FURN.crates = (b, rng) => { for (let k = 0; k < 2 + (rng() * 3 | 0); k++) { const sz = .5 + rng() * .3; b.box((rng() - .5) * 1.4, k > 2 ? .6 : 0, (rng() - .5) * 1.2, sz, sz, sz, pick(rng, [0x9a7048, 0x8a6240, 0xa8804f]), rng()); } };
  FURN.sacks = (b, rng) => { for (let k = 0; k < 3 + (rng() * 3 | 0); k++) b.sphere((rng() - .5) * 1.4, .28, (rng() - .5) * 1, .34, pick(rng, [0xd8c69a, 0xc9b080, 0xe0d2aa]), 6, .85, 1.1); };
  FURN.cart = (b, rng) => {
    b.box(0, .7, 0, 1.4, .12, 2.2, C.wood); b.box(-.7, .82, 0, .08, .4, 2.2, C.woodD); b.box(.7, .82, 0, .08, .4, 2.2, C.woodD);
    for (const sx of [-1, 1]) { b.cyl(sx * .78, .6, .2, .6, .6, .1, C.woodD, 10, 0, 0, Math.PI / 2); }
    b.box(0, .7, 1.7, .08, .08, 1.6, C.wood, 0, -.35); if (rng() < .6) FURN.sacks(b, rng);
  };
  FURN.well = (b) => { b.cyl(0, 0, 0, 1, 1.05, .9, 0xb9ad98, 12); b.cyl(0, .85, 0, .8, .8, .08, 0x2e5a6a, 12); for (const sx of [-1, 1]) b.box(sx * .9, .9, 0, .14, 1.6, .14, C.woodD); b.box(0, 2.4, 0, 2.1, .1, .14, C.woodD); b.gable(0, 2.5, 0, 2.4, .7, 1.4, C.terra); };
  FURN.hay = (b, rng) => { b.cyl(0, 0, 0, 1.0, 1.1, 1.0, 0xd8b85a, 10); b.cone(0, 1.0, 0, 1.05, 1.0, 0xcfae52, 10); };
  FURN.lanterns = (b) => { for (const sx of [-1, 1]) { b.cyl(sx * 1.2, 0, 0, .06, .08, 2.6, C.woodD, 4); b.sphere(sx * 1.2, 2.4, .2, .25, 0xd03a26, 6, 1.3); } };
  FURN.jars = (b, rng) => { for (let k = 0; k < 3 + (rng() * 3 | 0); k++) { const x = (rng() - .5) * 1.4, z = (rng() - .5) * 1; b.sphere(x, .35, z, .32, 0xb8734a, 7, 1.2); b.cyl(x, .7, z, .12, .14, .2, 0xb8734a, 6); } };
  FURN.rugs = (b, rng) => { b.box(0, 0, 0, 1.6, .05, 2.2, pick(rng, [0x8a2a24, 0x2c4f7a, 0x6a3a5a, 0x9a5a24])); b.box(0, .06, 0, 1.2, .02, 1.8, pick(rng, [0xd8b25a, 0xe8dcc0, 0x3a6a5a])); b.cyl(1.3, 0, 0, .2, .2, 1.8, 0x7a2a24, 6, 0, Math.PI / 2); };

  function yurt(b, x, z, r, roof) {
    b.cyl(x, 0, z, r, r, r * 0.75, C.felt, 10);
    b.cone(x, r * 0.75, z, r * 1.04, r * 0.55, roof || 0xe2d6bd, 10);
    b.box(x, 0, z + r * 0.97, r * 0.5, r * 0.6, .12, pick(Math.random, [C.red, 0x2c5fa8, 0xd08a2a]));
  }

  // ---------- walls ----------
  function wallStyle(cul, cityId) {
    if (cityId === 'constantinople') return { h: 7, t: 1.6, c: 0xd2c3a2, tower: 'sq', th: 9.5, merl: true, double: true };
    if (cul === 'byz') return { h: 5, t: 1.2, c: 0xd2c3a2, tower: 'sq', th: 6.8, merl: true };
    if (cul === 'armenian' || cul === 'georgian') return { h: 5, t: 1.2, c: cul === 'armenian' ? 0xa8735f : 0xc6b293, tower: 'round', th: 6.5, merl: true };
    if (cul === 'rum') return { h: 5, t: 1.2, c: 0xcdb790, tower: 'round', th: 6.5, merl: true };
    if (cul === 'arab') return { h: 5.2, t: 1.2, c: 0xd9c49e, tower: 'sq', th: 6.8, merl: true };
    if (cul === 'persian' || cul === 'central') return { h: 4.6, t: 1.3, c: 0xc49a66, tower: 'round', th: 6, merl: true };
    if (cul === 'tarim') return { h: 4.6, t: 1.5, c: 0xc9a573, tower: 'sq', th: 5.8, merl: false };
    if (cul === 'chinese' || cul === 'song') return { h: 5.6, t: 1.8, c: cul === 'song' ? 0x9c968c : 0xa89a80, tower: 'sq', th: 6.2, merl: true, gate: 'chinese' };
    return null; // steppe, mongol, tibet: unwalled
  }

  // ---------- trees ----------
  const TREE = {};
  function treeGeo(type) {
    if (TREE[type]) return TREE[type];
    const b = new Builder(); b.jit = 0.06;
    switch (type) {
      case 'conifer': b.cyl(0, 0, 0, .18, .28, 1.4, C.woodD, 5);
        b.cone(0, .9, 0, 1.7, 2.4, 0x2f5e3e, 7); b.cone(0, 2.2, 0, 1.3, 2.1, 0x356a44, 7); b.cone(0, 3.4, 0, .9, 1.9, 0x3b7449, 7); break;
      case 'pine': b.cyl(0, 0, 0, .16, .26, 3.2, C.woodD, 5); b.ico(0, 3.6, 0, 1.6, 0x3f6e45, .5, 1.3); b.ico(.9, 2.9, .3, 1.0, 0x467a4b, .45, 1.2); break;
      case 'broad': b.cyl(0, 0, 0, .16, .24, 1.8, C.woodD, 5); b.ico(0, 2.8, 0, 1.7, 0x5b8a3c); b.ico(.8, 2.4, .5, 1.1, 0x66953f); break;
      case 'olive': b.cyl(0, 0, 0, .18, .28, 1.0, 0x6f5a45, 5); b.ico(0, 1.8, 0, 1.4, 0x8a9a6a, .7, 1.2); break;
      case 'willow': b.cyl(0, 0, 0, .18, .26, 2.0, C.woodD, 5); b.ico(0, 3.0, 0, 1.7, 0x86aa52, 1.05); b.ico(.6, 2.4, .4, 1.1, 0x7ea24f, 1.2, .9); b.ico(-.6, 2.3, -.3, 1.0, 0x8fb25a, 1.2, .9); break;
      case 'poplar': b.cyl(0, 0, 0, .14, .2, 1.4, C.woodD, 5); b.sphere(0, 4.2, 0, .95, 0x6f9a3e, 7, 3.6); break;
      case 'cypress': b.cyl(0, 0, 0, .12, .18, .6, C.woodD, 5); b.cone(0, .4, 0, .75, 6.2, 0x2d4f35, 7); break;
      case 'palm':
        b.cyl(0, 0, 0, .2, .28, 2.2, 0x8a6b45, 6); b.cyl(.15, 2.2, 0, .17, .2, 2.0, 0x8a6b45, 6, 0, 0, -.1); b.cyl(.35, 4.1, 0, .15, .17, 1.6, 0x8a6b45, 6, 0, 0, -.15);
        for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; b.cone(.45 + Math.cos(a) * 1.1, 5.4, Math.sin(a) * 1.1, .45, 2.6, 0x5f8a3a, 4, -a, 0, 0); }
        // fronds as tilted cones
        b.pos.splice(b.pos.length - 7 * 12 * 3 * 0); break;
      case 'bamboo': for (let k = 0; k < 5; k++) { const a = k * 1.3, r = .5 + (k % 2) * .4; const h = 4.5 + (k % 3); b.cyl(Math.cos(a) * r, 0, Math.sin(a) * r, .08, .1, h, 0x7aa04a, 3); b.cone(Math.cos(a) * r, h - 1.6, Math.sin(a) * r, .7, 2.4, 0x8ab456, 4); } break;
      case 'shrub': b.ico(0, .5, 0, .9, 0x7a8a4a, .7); break;
      case 'saxaul': b.cyl(0, 0, 0, .06, .12, 1.0, 0x8b7b66, 4, 0, 0, .3); b.cyl(.2, .4, 0, .05, .08, .9, 0x8b7b66, 4, 0, 0, -.4); b.ico(.1, 1.0, 0, .55, 0x9a9a6a, .6); break;
      case 'tuft': for (let k = 0; k < 5; k++) { const a = k * 1.3; b.cone(Math.cos(a) * .25, 0, Math.sin(a) * .25, .12, .8 + (k % 2) * .3, 0xb3ae62, 3, 0, Math.cos(a) * .3, Math.sin(a) * .3); } break;
      case 'rock': b.dodec(0, .3, 0, 1, 0x8d8478, .7); break;
      case 'umbrella': b.cyl(0, 0, 0, .2, .3, 5.2, 0x6b4a32, 5, 0, 0, .06); b.cyl(.2, 4.4, 0, .1, .14, 1.6, 0x6b4a32, 4, 0, 0, -.6); b.ico(.1, 6.0, 0, 2.8, 0x3e6a3a, .38, 1.15); b.ico(1.2, 5.7, .6, 1.7, 0x46743f, .35, 1.1); b.ico(-1.1, 5.8, -.5, 1.6, 0x3a6236, .35, 1.1); break;
      case 'plane': b.cyl(0, 0, 0, .38, .55, 3.2, 0xb8b0a0, 6); b.cyl(.5, 2.8, 0, .2, .28, 1.8, 0xb8b0a0, 5, 0, 0, -.5); b.cyl(-.4, 2.8, .2, .2, .28, 1.8, 0xb8b0a0, 5, 0, 0, .5);
        b.ico(0, 5.4, 0, 2.6, 0x6f9a44, .85, 1.1); b.ico(1.6, 4.6, .8, 1.8, 0x7aa64a); b.ico(-1.5, 4.7, -.6, 1.9, 0x678f40); b.ico(.2, 4.4, -1.5, 1.6, 0x74a046); break;
      case 'oak': b.cyl(0, 0, 0, .26, .4, 1.8, 0x5a4230, 5); b.cyl(.3, 1.6, 0, .14, .2, 1.4, 0x5a4230, 4, 0, 0, -.7); b.ico(0, 3.0, 0, 1.9, 0x58783a, .8, 1.2); b.ico(1.3, 2.6, .4, 1.3, 0x627f3e, .8); b.ico(-1.1, 2.8, -.6, 1.2, 0x50703a, .85); break;
      case 'fir': b.cyl(0, 0, 0, .16, .26, 1.4, C.woodD, 5); for (let k = 0; k < 5; k++) b.cone(0, .8 + k * 1.3, 0, 1.9 - k * .32, 2.1, k % 2 ? 0x24503a : 0x2a5a40, 7); break;
      case 'spruce': b.cyl(0, 0, 0, .14, .22, 1.2, C.woodD, 5); for (let k = 0; k < 7; k++) b.cone(0, .7 + k * 1.25, 0, 1.25 - k * .14, 1.9, k % 2 ? 0x22463a : 0x284f40, 6); break;
      case 'beech': b.cyl(0, 0, 0, .2, .3, 3.4, 0x8a8478, 5); b.sphere(0, 5.2, 0, 1.9, 0x3f6e38, 7, 1.35); b.ico(.9, 4.4, .5, 1.2, 0x467a3e); break;
      case 'cedar': b.cyl(0, 0, 0, .3, .42, 3.6, 0x5a4230, 5); for (let k = 0; k < 4; k++) b.cyl(k % 2 ? .3 : -.2, 2.2 + k * 1.15, k % 2 ? -.2 : .2, 2.9 - k * .55, 3.1 - k * .55, .45, k % 2 ? 0x2f5a3c : 0x34613f, 7); b.cone(0, 6.6, 0, .7, 1, 0x2f5a3c, 6); break;
      case 'date': b.cyl(0, 0, 0, .22, .3, 6.5, 0x8a6b45, 6); for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2; b.push(0, 6.6, 0, a); b.cone(.3, 0, 0, .35, 3, k % 2 ? 0x5f8a3a : 0x6b9640, 4, 0, 0, -1.75); b.pop(); } b.sphere(0, 6.2, 0, .45, 0xb8862a, 5); break;
      case 'tamarisk': for (let k = 0; k < 5; k++) { const a = k * 1.3; b.cyl(Math.cos(a) * .3, 0, Math.sin(a) * .3, .05, .08, 1.4, 0x7a6a5a, 3, 0, Math.cos(a) * .3, Math.sin(a) * .3); b.cone(Math.cos(a) * .7, 1.0, Math.sin(a) * .7, .55, 1.8, k % 2 ? 0xc49ab4 : 0xb48aa4, 5); } break;
      case 'pistachio': b.cyl(0, 0, 0, .14, .2, .9, 0x6a5a48, 4); b.ico(0, 1.5, 0, 1.2, 0x8a9a62, .75, 1.2); b.ico(.6, 1.3, .3, .8, 0x94a46a, .7); break;
      case 'juniper': b.cyl(0, 0, 0, .12, .18, .6, 0x5a4a3a, 4); b.cone(0, .4, 0, .95, 3.2, 0x3e5a48, 6); b.ico(.4, 1.2, .2, .6, 0x46624e, 1.2); break;
      case 'mulberry': case 'fruit': b.cyl(0, 0, 0, .14, .2, 1.3, 0x5a4230, 5); b.ico(0, 2.3, 0, 1.4, type === 'fruit' ? 0x6e9a40 : 0x58883a, .85, 1.15); b.ico(.7, 2.0, .3, .9, type === 'fruit' ? 0x78a448 : 0x62903e); if (type === 'fruit') for (let k = 0; k < 6; k++) b.ico(Math.cos(k) * 1.1, 2.0 + (k % 3) * .4, Math.sin(k) * 1.1, .12, 0xd8752a); break;
      case 'birch': b.cyl(0, 0, 0, .1, .14, 4.2, 0xe8e4da, 5); for (let k = 0; k < 4; k++) b.box(0, .6 + k * .9, .1, .16, .1, .06, 0x2a2a2a); b.sphere(0, 4.6, 0, 1.1, 0x8aae52, 6, 1.5); break;
      case 'sophora': b.cyl(0, 0, 0, .22, .32, 2.2, 0x4a3a2c, 5); b.ico(0, 3.6, 0, 2.2, 0x5e8a40, .75, 1.25); b.ico(1.3, 3.2, .5, 1.4, 0x669044, .8); break;
      case 'camphor': b.cyl(0, 0, 0, .3, .42, 2.4, 0x4a3a2c, 5); b.ico(0, 4.2, 0, 2.8, 0x2f5f32, .78, 1.2); b.ico(1.8, 3.6, .7, 1.8, 0x376a36, .8); b.ico(-1.6, 3.7, -.6, 1.7, 0x2c5a30, .8); break;
      case 'tograk': b.cyl(0, 0, 0, .22, .34, 1.6, 0x7a6a56, 4, 0, 0, .2); b.cyl(.35, 1.4, 0, .12, .18, 1.6, 0x7a6a56, 4, 0, 0, -.6); b.cyl(-.2, 1.5, .2, .1, .16, 1.4, 0x7a6a56, 4, 0, .4, .5); b.ico(1.1, 2.9, 0, .9, 0xa8a84a, .6, 1.3); b.ico(-.8, 2.8, .5, .8, 0x9ca048, .6, 1.2); break;
      case 'vine': for (let k = -1; k <= 1; k++) { b.cyl(k * 1.4, 0, 0, .04, .05, 1.3, 0x5a4230, 3); b.ico(k * 1.4, 1.1, 0, .6, 0x5e8a34, .8, 1.2); } b.box(0, 1.25, 0, 3.4, .04, .04, 0x5a4230); break;
      case 'tea': b.sphere(0, .45, 0, .75, 0x3f7038, 6, .65, 1.1); break;
      case 'feather': for (let k = 0; k < 7; k++) { const a = k * .9, r = .1 + (k % 3) * .06, hh = .6 + (k % 3) * .25; const px = -Math.sin(a) * .03, pz = Math.cos(a) * .03; b.tri([Math.cos(a) * r * .3 - px, 0, Math.sin(a) * r * .3 - pz], [Math.cos(a) * r * .3 + px, 0, Math.sin(a) * r * .3 + pz], [Math.cos(a) * (r + .3), hh, Math.sin(a) * (r + .3)], 0x8a8a5a, 0x8a8a5a, 0xe8e6d0); } break;
      case 'tulip': for (let k = 0; k < 3; k++) { const x = (k - 1) * .2, z = (k % 2) * .15; b.tri([x - .02, 0, z], [x + .02, 0, z], [x, .32, z], 0x4f6a2a, 0x4f6a2a, 0x4f6a2a); b.cone(x, .28, z, .07, .14, k === 1 ? 0xe8c43a : 0xd8302a, 4, k); } break;
      case 'grass': for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + k * .4, r = .12 + (k % 3) * .06, hh = .45 + (k % 3) * .18; const px = -Math.sin(a) * .05, pz = Math.cos(a) * .05; b.tri([Math.cos(a) * r * .3 - px, 0, Math.sin(a) * r * .3 - pz], [Math.cos(a) * r * .3 + px, 0, Math.sin(a) * r * .3 + pz], [Math.cos(a) * (r + .18), hh, Math.sin(a) * (r + .18)], 0x55702e, 0x55702e, 0xa8c060); } break;
      case 'dry': for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + k * .4, r = .12 + (k % 3) * .05, hh = .35 + (k % 3) * .14; const px = -Math.sin(a) * .04, pz = Math.cos(a) * .04; b.tri([Math.cos(a) * r * .3 - px, 0, Math.sin(a) * r * .3 - pz], [Math.cos(a) * r * .3 + px, 0, Math.sin(a) * r * .3 + pz], [Math.cos(a) * (r + .2), hh, Math.sin(a) * (r + .2)], 0x8a7a48, 0x8a7a48, 0xd8c890); } break;
      case 'pebbles': for (let k = 0; k < 4; k++) b.cone((k % 2 - .5) * .5, -.02, ((k >> 1) - .5) * .4, .14 + (k % 3) * .06, .12 + (k % 2) * .06, k % 2 ? 0x9a8f80 : 0xb3a796, 3, k); break;
      case 'flowerR': case 'flowerY': case 'flowerW': case 'flowerB': {
        const fc = { flowerR: 0xd23a2a, flowerY: 0xf0c83a, flowerW: 0xf4f0e6, flowerB: 0x6a6ad8 }[type];
        for (let k = 0; k < 4; k++) { const a = k * 1.7, r = .18 + k * .05, hh = .35 + (k % 2) * .15; const x = Math.cos(a) * r, z = Math.sin(a) * r; b.tri([x - .02, 0, z], [x + .02, 0, z], [x, hh, z], 0x4f6a2a, 0x4f6a2a, 0x4f6a2a); b.cone(x, hh - .04, z, .09, .1, fc, 3, k); }
        b.tri([-.06, 0, 0], [.06, 0, 0], [.15, .3, .05], 0x55702e, 0x55702e, 0x8aa84a); break; }
    }
    TREE[type] = { pos: new Float32Array(b.pos), col: new Float32Array(b.col) };
    return TREE[type];
  }
  // cheap far versions for the mid-distance ring
  const TREE_LOW = {};
  function treeGeoLow(type) {
    if (TREE_LOW[type]) return TREE_LOW[type];
    const b = new Builder(); b.jit = 0.05; b.ao = false;
    switch (type) {
      case 'conifer': b.cone(0, 0, 0, 1.6, 5.2, 0x326544, 5); break;
      case 'pine': b.cyl(0, 0, 0, .15, .2, 3, C.woodD, 3); b.ico(0, 3.6, 0, 1.6, 0x3f6e45, .5, 1.3); break;
      case 'cypress': b.cone(0, 0, 0, .7, 6.4, 0x2d4f35, 4); break;
      case 'poplar': b.cone(0, 0, 0, .9, 8, 0x6f9a3e, 4); break;
      case 'broad': case 'willow': case 'olive': b.cyl(0, 0, 0, .15, .2, 1.8, C.woodD, 3); b.ico(0, 2.8, 0, 1.8, type === 'olive' ? 0x8a9a6a : type === 'willow' ? 0x86aa52 : 0x5b8a3c, 1.1); break;
      case 'palm': b.cyl(0, 0, 0, .18, .25, 5.4, 0x8a6b45, 3); b.ico(.4, 5.6, 0, 1.6, 0x5f8a3a, .35, 1.2); break;
      case 'bamboo': b.ico(0, 3, 0, 1.4, 0x7aa04a, 2.2, .9); break;
      case 'shrub': b.ico(0, .5, 0, .9, 0x7a8a4a, .7); break;
      case 'rock': b.ico(0, .3, 0, 1, 0x8d8478, .7); break;
      case 'umbrella': b.cyl(0, 0, 0, .2, .26, 5.2, 0x6b4a32, 3); b.ico(0, 6, 0, 2.8, 0x3e6a3a, .38, 1.15); break;
      case 'plane': case 'sophora': case 'camphor': b.cyl(0, 0, 0, .3, .4, 3, 0x8a7a68, 3); b.ico(0, 4.6, 0, 2.6, type === 'camphor' ? 0x2f5f32 : 0x6f9a44, .85, 1.15); break;
      case 'oak': case 'beech': case 'mulberry': case 'fruit': b.cyl(0, 0, 0, .2, .3, 2, 0x5a4230, 3); b.ico(0, 3, 0, 1.8, 0x58783a, .85, 1.15); break;
      case 'fir': case 'spruce': b.cone(0, 0, 0, 1.6, 8, 0x26503c, 5); break;
      case 'cedar': b.cyl(0, 0, 0, .3, .4, 3, 0x5a4230, 3); b.cyl(0, 3, 0, 1.2, 2.8, 2.6, 0x2f5a3c, 6); break;
      case 'date': b.cyl(0, 0, 0, .2, .26, 6.4, 0x8a6b45, 3); b.ico(0, 6.6, 0, 2, 0x5f8a3a, .4, 1.2); break;
      case 'tamarisk': b.cone(0, 0, 0, 1.2, 2.6, 0xc49ab4, 5); break;
      case 'pistachio': case 'juniper': b.ico(0, 1.2, 0, 1.1, type === 'juniper' ? 0x3e5a48 : 0x8a9a62, 1.2); break;
      case 'birch': b.cone(0, 0, 0, 1, 5.4, 0x8aae52, 4); break;
      case 'tograk': b.ico(0, 2.6, 0, 1.3, 0xa8a84a, .7, 1.3); break;
      default: return null;
    }
    TREE_LOW[type] = { pos: new Float32Array(b.pos), col: new Float32Array(b.col) };
    return TREE_LOW[type];
  }
  // fix palm fronds: tilt outward (rebuild properly)
  function palmFix() {
    const b = new Builder(); b.jit = 0.06;
    b.cyl(0, 0, 0, .2, .28, 2.2, 0x8a6b45, 6); b.cyl(.15, 2.2, 0, .17, .2, 2.0, 0x8a6b45, 6, 0, 0, -.1); b.cyl(.35, 4.1, 0, .15, .17, 1.6, 0x8a6b45, 6, 0, 0, -.15);
    for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; b.push(.5, 5.6, 0, a); b.cone(0, 0, 0, .4, 2.8, k % 2 ? 0x5f8a3a : 0x6b9640, 4, 0, 0, -1.9); b.pop(); }
    TREE.palm = { pos: new Float32Array(b.pos), col: new Float32Array(b.col) };
  }

  // ---------- landmark builders ----------
  // Each returns {r: collider radius} or {colliders:[...]} in local space; front faces +z.
  const LM = {};
  LM.hagiaSophia = (b) => {
    const wc = 0xdcb48c, dc = 0x8e9aa0, wc2 = 0xcfa580;
    b.box(0, 0, 0, 22, 7, 19, wc);
    b.box(0, 0, 10.8, 20, 5.5, 2.6, wc2); // narthex
    b.box(0, 7, 0, 13, 3.6, 13, wc);    // central tower under the dome
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(sx * 9.6, 0, sz * 6.9, 3.2, 12.5, 3.4, wc2); // buttresses
    b.cyl(0, 10.6, 0, 6.2, 6.4, 1.5, 0xd5ad86, 24);
    for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; b.box(Math.cos(a) * 6.35, 10.9, Math.sin(a) * 6.35, .45, .8, .2, C.dark, -a + Math.PI / 2); }
    b.dome(0, 12.1, 0, 6.5, dc, 24, .52);
    for (const sz of [-1, 1]) { b.dome(0, 7, sz * 6.5, 6.2, dc, 18, .55); b.dome(4.6, 6.2, sz * 9.2, 2.6, dc, 10, .55); b.dome(-4.6, 6.2, sz * 9.2, 2.6, dc, 10, .55); }
    b.cyl(0, 0, -10.6, 3.6, 3.6, 6.2, wc, 12); b.dome(0, 6.2, -10.6, 3.6, dc, 12, .6);
    for (let k = -3; k <= 3; k++) b.box(k * 2.6, 2, 9.52, 1.0, 2.6, .1, C.dark);
    return { r: 13 };
  };
  LM.obelisk = (b) => {
    b.box(0, 0, 0, 34, .9, 3, 0xcbbd9f); // spina
    b.box(-6, .9, 0, 2.4, 1.6, 2.4, 0xb9ab8c); b.cyl(-6, 2.5, 0, .35, .7, 9, 0xc79a76, 4, Math.PI / 4); b.cone(-6, 11.5, 0, .5, .9, 0xc79a76, 4, Math.PI / 4);
    b.box(4, .9, 0, 1.4, 1, 1.4, 0xb9ab8c); b.cyl(4, 1.9, 0, .28, .32, 5, 0x6b5a3c, 6);
    b.box(12, .9, 0, 1.8, 1.2, 1.8, 0xb9ab8c); b.cyl(12, 2.1, 0, .5, .8, 6, 0xb8a07f, 4, Math.PI / 4);
    return { colliders: [{ seg: [-17, 0, 17, 0], r: 2 }] };
  };
  LM.church = (b, p) => {
    const s = p.big ? 1.35 : 1; const arm = p.style === 'armenian';
    const wc = arm ? C.tuff : p.style === 'georgian' ? 0xcdb796 : 0xd9c3a0; const rc = arm ? 0xa07a68 : C.terra;
    b.push(0, 0, 0, 0, s);
    b.box(0, 0, 0, 7, 6.5, 9, wc); b.box(0, 0, 0, 11, 5.5, 4.5, wc);
    b.gable(0, 6.5, 0, 7.2, 2, 9.2, rc, Math.PI / 2); b.gable(0, 5.5, 0, 11.2, 1.8, 4.7, rc);
    b.cyl(0, 0, -4.8, 2.6, 2.6, 5.2, wc, 10); b.cone(0, 5.2, -4.8, 2.8, 1.2, rc, 10);
    b.cyl(0, 7.4, 0, 2.1, 2.1, 3.2, wc, arm ? 12 : 12);
    if (arm || p.style === 'georgian') b.cone(0, 10.6, 0, 2.4, 3.2, rc, 12); else b.dome(0, 10.6, 0, 2.2, C.lead, 12, .8);
    b.box(0, 0, 4.55, 1.4, 2.6, .1, C.dark);
    b.pop();
    return { r: 6.5 * s };
  };
  LM.mosque = (b, p) => {
    const D = p.dome || 0; const wc = p.style === 'seljuk' ? 0xd2bf9c : p.style === 'umayyad' ? 0xd8c9a8 : C.mudL;
    const dc = p.domeColor === 'turq' ? C.turq : p.domeColor === 'brick' ? C.brick : C.lead;
    if (p.style === 'umayyad') {
      b.box(0, 0, -4, 26, 7, 9, wc); b.gable(0, 7, -4, 26.5, 2, 9.4, C.lead);
      b.box(0, 0, 4, 26, 4, 1, wc); b.box(-12.5, 0, 0, 1, 4, 16, wc); b.box(12.5, 0, 0, 1, 4, 16, wc); b.box(0, 0, -11, 26, 4, 1, wc);
      b.box(0, 0, -4, 5, 9, 9.4, wc); b.cyl(0, 9, -4, 3, 3, 1.5, wc, 8); b.dome(0, 10.5, -4, 3.2, dc, 12, .9);
      for (const [x, z] of [[-12, -10], [12, -10], [0, 4]]) { b.box(x, 0, z, 2.2, 14, 2.2, 0xcab98f); b.box(x, 14, z, 2.6, .5, 2.6, 0xcab98f); b.box(x, 14.5, z, 1.6, 2.5, 1.6, 0xcab98f); b.pyramid(x, 17, z, 1.8, 2, C.lead); }
      return { r: 14 };
    }
    if (p.style === 'qingjing') {
      const gc = 0x9c958a; b.box(0, 0, 0, 16, 5, 12, gc); b.box(0, 0, 6.6, 7, 12, 3, gc); b.box(0, 0, 8.12, 3.6, 8.5, .1, C.dark); b.arch(0, 8.5, 8.12, 1.8, .12, C.dark, Math.PI / 2);
      for (let k = -3; k <= 3; k++) b.box(k * 1.0, 12, 6.6, .55, .7, 3, gc); for (let k = -2; k <= 2; k++) if (k) b.box(k * 2.8, 1.5, 6.02, 1, 2.2, .08, C.dark);
      return { r: 10 };
    }
    const w = Math.max(10, 2.4 * D + 7), d = Math.max(9, 2.2 * D + 6);
    b.box(0, 0, 0, w, 5.5, d, wc);
    if (D > 0) { b.cyl(0, 5.5, 0, D * .85, D * .9, 1.6, wc, 12); b.dome(0, 7.1, 0, D * .86, dc, 14, p.style === 'seljuk' ? .55 : 1.05); b.cyl(0, 7.1 + D * (p.style === 'seljuk' ? .55 : 1.05), 0, .08, .12, 1.4, C.gold, 4); }
    if (p.style === 'iwan' || p.style !== 'seljuk') { b.box(0, 0, d / 2, Math.max(5, D * 1.6), 8.5, 1.6, wc); b.box(0, 0, d / 2 + .82, Math.max(2.6, D * .9), 6, .1, 0x3a4a5c); b.box(0, 7.4, d / 2 + .82, Math.max(5, D * 1.6) * .9, .7, .1, C.turq); }
    else { b.box(0, 0, d / 2 + .3, 3.4, 6.5, .9, 0xcab68f); b.box(0, 0, d / 2 + .78, 1.8, 4.2, .1, C.dark); }
    const n = p.minarets || 0;
    for (let i = 0; i < n; i++) {
      const x = n === 1 ? w / 2 - 1 : (i === 0 ? -1 : 1) * (w / 2 - 1), z = d / 2 - 1;
      const mh = 13 + D;
      b.cyl(x, 0, z, .8, .95, mh, p.domeColor === 'brick' ? C.brick : p.style === 'seljuk' ? 0xb98663 : C.mudL, 10);
      b.cyl(x, mh * .78, z, 1.25, 1.1, .5, wc, 10);
      if (p.style === 'seljuk') b.cone(x, mh, z, .85, 3.2, C.lead, 10); else { b.cyl(x, mh, z, .7, .7, 1.4, dc, 10); b.dome(x, mh + 1.4, z, .7, dc, 8, 1.2); }
    }
    return { r: Math.max(w, d) * .62 };
  };
  LM.minaret = (b, p) => {
    const h = p.h, r = p.r; const c = p.color === 'brick' ? 0xc08a5c : C.stoneW;
    const m = b.mat(0, 0, 0, 1, 1, 1, 0, 0, p.lean || 0); b.pushM(m);
    if (p.square) { b.box(0, 0, 0, r * 2.2, h + 2.2, r * 2.2, c); for (let k = 1; k < 5; k++) b.box(0, 2.2 + h * k / 5, 0, r * 2.3, .45, r * 2.3, 0xb8a888); b.box(0, h + 2.2, 0, r * 2.5, .5, r * 2.5, c); b.box(0, h + 2.7, 0, r * 1.6, 2.6, r * 1.6, c); for (const a of [0, 1, 2, 3]) b.box(Math.sin(a * Math.PI / 2) * r * .81, h + 3.1, Math.cos(a * Math.PI / 2) * r * .81, .7, 1.6, .1, C.dark, a * Math.PI / 2); b.dome(0, h + 5.3, 0, r * .7, c, 10, .8); b.pop(); return { r: r * 1.7 }; }
    b.cyl(0, 0, 0, r * 1.25, r * 1.35, 2.2, c, 14);
    b.cyl(0, 2.2, 0, r * .72, r, h, c, 14);
    for (let k = 1; k < 5; k++) b.cyl(0, 2.2 + h * k / 5, 0, r * (1 - .28 * k / 5) + .06, r * (1 - .28 * k / 5) + .08, .5, 0xa8714a, 14);
    if (p.lantern) { b.cyl(0, h + 2.2, 0, r * .95, r * .8, 2.4, c, 14); for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; b.box(Math.cos(a) * r * .9, h + 3, Math.sin(a) * r * .9, .35, 1.2, .1, C.dark, -a + Math.PI / 2); } b.dome(0, h + 4.6, 0, r * .85, c, 12, .6); }
    else if (!p.truncated) { b.cyl(0, h + 2.2, 0, r * .9, r * .75, .5, c, 12); b.dome(0, h + 2.7, 0, r * .6, c, 10, 1.4); }
    b.box(0, 0, r * 1.3, .9, 1.7, .1, C.dark);
    b.pop();
    return { r: r * 1.4 + .3 };
  };
  LM.mausoleum = (b, p) => {
    const s = p.big ? 9 : 6; const wc = p.color === 'brick' ? 0xc08a5c : p.color === 'terracotta' ? 0xc9875a : p.color === 'tile' ? 0xd9c6a2 : C.mudL;
    const dc = p.dome === 'turq' ? C.turq : p.dome === 'lead' ? C.lead : 0xb98260;
    b.box(0, 0, 0, s, s, s, wc);
    b.box(0, 0, s / 2, s * .5, s * .8, .12, C.dark); b.box(0, 0, s / 2 + .03, s * .62, s * .95, .06, p.color === 'tile' ? C.blue : wc);
    if (p.samanid) { for (const sx of [-1, 1]) for (const sz of [-1, 1]) { b.cyl(sx * s / 2, 0, sz * s / 2, .45, .5, s, wc, 8); b.dome(sx * s * .32, s, sz * s * .32, .7, wc, 8); } b.dome(0, s, 0, s * .4, dc, 14, .8); return { r: s * .8 }; }
    b.cyl(0, s, 0, s * .42, s * .45, s * .3, wc, 12);
    if (p.conical) b.cone(0, s * 1.3, 0, s * .46, s * .7, dc, 12);
    else b.dome(0, s * 1.3, 0, s * .44, dc, 16, p.big ? 1.25 : 1.05);
    return { r: s * .78 };
  };
  LM.kumbet = (b, p) => {
    const c = p.color === 'brick' ? 0xc08a5c : 0xd4bf98; const rc = p.roof === 'turq' ? C.turq : p.roof === 'brick' ? 0xb07a52 : 0x9a8a72;
    b.cyl(0, 0, 0, 3.2, 3.4, 1.2, c, 8); b.cyl(0, 1.2, 0, 2.7, 2.8, 5.5, c, 8); b.cyl(0, 6.7, 0, 2.95, 2.95, .4, c, 8); b.cone(0, 7.1, 0, 3.0, 3.8, rc, 8);
    b.box(0, 1.2, 2.65, 1.2, 2.4, .2, C.dark);
    return { r: 3.6 };
  };
  LM.madrasa = (b, p) => {
    const brick = p.tile === 'brick'; const wc = brick ? 0xc79a6c : 0xd2c2a2; const tc = brick ? 0x9c5a3a : C.turq;
    b.box(0, 0, 0, 20, 6.5, 14, wc);
    b.box(0, 0, 7.4, 7, 11, 1.8, wc); b.box(0, 0, 8.32, 3.4, 7.5, .1, C.dark); b.box(0, 9, 8.32, 6.4, .7, .1, tc);
    if (brick) { for (let k = -4; k <= 4; k++) if (Math.abs(k) > 1) b.box(k * 2.1, .8, 7.05, 1.2, 3.2, .1, C.dark); }
    else for (const sx of [-1, 1]) { b.cyl(sx * 2.6, 11, 7.4, .65, .8, 7, 0xb98663, 10); for (let k = 0; k < 3; k++) b.cyl(sx * 2.6, 12 + k * 2, 7.4, .82 - k * .03, .84 - k * .03, .5, tc, 10); b.cone(sx * 2.6, 18, 7.4, .66, 1.6, tc, 10); }
    b.dome(0, 6.5, -2.5, 3.4, brick ? 0xb98260 : C.lead, 12, .7);
    return { r: 11.5 };
  };
  LM.citadel = (b, p, rng) => {
    const r = p.r, H = p.hill; const wc = p.ruin ? 0xbfa47c : 0xc9b48e;
    b.cyl(0, 0, 0, r * .78, r * 1.25, H, p.glacis ? 0xcab590 : C.earth, 14);
    const wr = r * .72; const n = 12;
    for (let i = 0; i < n; i++) {
      const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2, am = (a0 + a1) / 2;
      const len = 2 * wr * Math.sin(Math.PI / n);
      const wh = p.ruin ? 1 + rng() * 3 : 3.8;
      b.box(Math.cos(am) * wr, H, Math.sin(am) * wr, len + .3, wh, 1.1, wc, -am + Math.PI / 2);
      if (i % 2 === 0) b.cyl(Math.cos(a0) * wr, H, Math.sin(a0) * wr, 1.25, 1.35, p.ruin ? 2 + rng() * 3 : 5.2, wc, 8);
    }
    if (!p.ruin) { b.box(0, H, 0, 4.5, 7, 4.5, wc); b.box(0, H + 7, 0, 5, .5, 5, wc); }
    b.box(0, H, wr + .2, 2.2, 3, .3, C.dark);
    return { r: r * 1.25 + .5 };
  };
  LM.caravanserai = (b, p) => {
    const s = p.size || 14, h = 4.6, wc = 0xd2bb92;
    b.box(0, 0, -s / 2, s, h, 1.3, wc); b.box(-s / 2, 0, 0, 1.3, h, s, wc); b.box(s / 2, 0, 0, 1.3, h, s, wc);
    b.box(-s / 4 - 1.5, 0, s / 2, s / 2 - 3, h, 1.3, wc); b.box(s / 4 + 1.5, 0, s / 2, s / 2 - 3, h, 1.3, wc);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl(sx * s / 2, 0, sz * s / 2, 1.1, 1.2, 5.4, wc, 8);
    for (let k = -1; k <= 1; k += 2) for (const side of [-1, 1]) b.cyl(side * s / 2, 0, k * s / 4, .7, .7, 4.8, wc, 8);
    b.box(0, 0, s / 2 + .3, 6, 7.5, 2, 0xcfb58b); b.box(0, 0, s / 2 + 1.32, 2.6, 5, .1, C.dark); b.box(0, 6.3, s / 2 + 1.32, 5, .6, .1, 0xa8885e);
    const cols = [];
    cols.push({ seg: [-s / 2, -s / 2, s / 2, -s / 2], r: 1 }, { seg: [-s / 2, -s / 2, -s / 2, s / 2], r: 1 }, { seg: [s / 2, -s / 2, s / 2, s / 2], r: 1 });
    cols.push({ seg: [-s / 2, s / 2, -2.5, s / 2], r: 1 }, { seg: [2.5, s / 2, s / 2, s / 2], r: 1 });
    return { colliders: cols };
  };
  LM.pagoda = (b, p) => {
    const one = (ox) => {
      const sides = p.sides || 8, w = p.w || 4, tiers = p.tiers || 7; const big = p.big ? 1.25 : 1;
      const body = { brick: 0xbf9a6e, iron: 0x7a4f35, wood: 0xb88a5a, stone: 0xa9a59c, white: 0xebe6da }[p.color] || 0xbf9a6e;
      const eave = { brick: 0x9c7a55, iron: 0x5e3b27, wood: 0x4b4f55, stone: 0x8f8b83, white: 0x6e6e6e }[p.color] || 0x9c7a55;
      b.push(ox, 0, 0, 0, big);
      b.box(0, 0, 0, w * 1.7, .8, w * 1.7, 0xc9bda5);
      let y = .8, r = w * .62;
      for (let t = 0; t < tiers; t++) {
        const th = t === 0 ? w * .95 : w * .55;
        if (sides === 4) b.box(0, y, 0, r * 1.6, th, r * 1.6, body); else b.cyl(0, y, 0, r * .96, r, th, body, sides, Math.PI / sides);
        if (sides === 4) b.box(0, y + th * .35, r * .8 + .02, r * .35, th * .4, .05, C.dark);
        y += th;
        const er = r * (p.color === 'wood' ? 1.55 : 1.3);
        if (p.color === 'wood') b.cyl(0, y - .2, 0, r * .9, er, .9, eave, sides, Math.PI / sides);
        else if (sides === 4) b.box(0, y - .1, 0, er * 1.6, .35, er * 1.6, eave);
        else b.cyl(0, y - .1, 0, er * .98, er, .35, eave, sides, Math.PI / sides);
        r *= tiers > 9 ? 0.95 : 0.9;
      }
      b.cyl(0, y, 0, .12, .18, w * .9, C.gold, 6); b.sphere(0, y + w * .5, 0, .35, C.gold, 6);
      b.pop();
      return w * 1.1 * big;
    };
    if (p.twin) { const r = one(-p.w * 2.4); one(p.w * 2.4); return { colliders: [{ c: [-p.w * 2.4, 0], r }, { c: [p.w * 2.4, 0], r }] }; }
    return { r: one(0) };
  };
  LM.stupa = (b, p, rng) => {
    const s = p.big ? 1.8 : 1;
    b.push(0, 0, 0, 0, s);
    if (p.style === 'tibetan') {
      b.box(0, 0, 0, 7, 1, 7, C.twhite); b.box(0, 1, 0, 5.8, .8, 5.8, C.twhite); b.box(0, 1.8, 0, 4.8, .7, 4.8, C.twhite);
      b.cyl(0, 2.5, 0, 2.2, 2.5, .6, C.twhite, 16); b.sphere(0, 3.9, 0, 2.3, C.twhite, 16, 1.0);
      b.box(0, 5.9, 0, 1.6, 1, 1.6, C.twhite);
      for (let k = 0; k < 9; k++) b.cyl(0, 6.9 + k * .42, 0, .75 - k * .055, .8 - k * .055, .3, C.gold, 10);
      b.cone(0, 10.7, 0, .9, .5, C.gold, 10); b.sphere(0, 11.4, 0, .3, C.gold, 6);
      b.pop(); return { r: 4.2 * s };
    }
    const mc = 0xc8a676;
    b.box(0, 0, 0, 8, 2.8, 8, mc); b.box(0, 2.8, 0, 6.4, 1.6, 6.4, mc);
    b.cyl(0, 4.4, 0, 2.8, 3, 2.6, mc, 12); b.dome(0, 7, 0, 2.8, 0xbf9c6c, 12, .75);
    for (let k = 0; k < 6; k++) b.box((rng() - .5) * 7, 0, (rng() - .5) * 7, .8 + rng() * 1.2, .5 + rng(), .8 + rng() * 1.2, 0xb8976a);
    b.pop(); return { r: 5.6 * s };
  };
  LM.caves = (b, p, rng) => {
    const w = p.w, h = p.h; const cc = p.red ? C.redrock : C.sandstone;
    b.box(0, 0, -4, w, h, 8, cc);
    for (let k = 0; k < 7; k++) b.box((rng() - .5) * w * .9, h - 1, -4 + (rng() - .5) * 4, 4 + rng() * 8, 2 + rng() * 3, 5 + rng() * 3, cc);
    b.box(0, 0, -.3, w * 1.02, h * .15, 1.5, cc);
    const rows = p.rows, cols = p.cols;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = (c - (cols - 1) / 2) * (w * .9 / cols), y = 1.5 + r * (h * .75 / Math.max(1, rows));
      if (p.buddha && Math.abs(x) < 6 && r < 2) continue;
      b.box(x + (rng() - .5) * .8, y, 0.05, 1.5, 2.1, .1, C.dark);
      if (rng() < .3) b.box(x, y + 2.1, .3, 2.2, .25, .7, C.wood);
    }
    if (p.buddha) {
      b.box(0, 0, 0.06, 10, h * .85, .1, 0x4a3a2c);
      const sc = 0xc9a882; const H2 = h * .85;
      b.box(0, 0, .4, 7.5, H2 * .2, 3, sc); b.cyl(0, H2 * .2, .6, 2.4, 3.1, H2 * .42, sc, 10); b.sphere(0, H2 * .72, .9, 1.7, sc, 10, 1.15);
      b.cyl(0, H2 * .78, .5, 3.2, 3.2, .2, 0xb0906a, 16, 0, Math.PI / 2);
    }
    return { colliders: [{ seg: [-w / 2, -2, w / 2, -2], r: 2.5 }] };
  };
  LM.bamiyan = (b, p, rng) => {
    const w = 60, h = 28, cc = 0xcdb28a;
    b.box(0, 0, -5, w, h, 10, cc);
    for (let k = 0; k < 9; k++) b.box((rng() - .5) * w, h - 1.5, -5 + (rng() - .5) * 4, 6 + rng() * 9, 2 + rng() * 3, 8, cc);
    const fig = (x, H, robe) => {
      b.box(x, 0, .02, H * .42, H, .1, 0x4b3b2a); b.cyl(x, H - H * .22, .02, H * .21, H * .21, .1, 0x4b3b2a, 12, 0, Math.PI / 2);
      b.cyl(x, 0, .9, H * .1, H * .15, H * .74, robe, 10); b.sphere(x, H * .8, .9, H * .085, 0xc8a07a, 8, 1.15);
      b.box(x, H * .5, 1.2, H * .26, H * .08, .8, robe);
    };
    fig(-16, 24, 0xa8483a); fig(16, 17, 0x7d86a8);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 16; c++) { const x = (c - 7.5) * 3.6; if (Math.abs(Math.abs(x) - 16) < 6) continue; b.box(x, 2 + r * 6 + rng(), .05, 1.4, 2, .1, C.dark); }
    return { colliders: [{ seg: [-w / 2, -1, w / 2, -1], r: 2 }] };
  };
  LM.hall = (b, p) => {
    const w = p.w, d = p.d; const wc = p.color === 'red' ? 0xa8352a : 0xebe6da; const rc = p.roof === 'gold' ? C.gold : p.roof === 'green' ? C.green : C.croof;
    b.box(0, 0, 0, w + 4, 1.4, d + 4, 0xcfc6b2); b.box(0, 0, d / 2 + 2.6, 4, .7, 1.4, 0xcfc6b2);
    b.box(0, 1.4, 0, w - 2, 5, d - 2, wc);
    for (let k = 0; k <= 6; k++) { const x = -w / 2 + .5 + k * (w - 1) / 6; b.cyl(x, 1.4, d / 2 - .4, .32, .32, 5, 0x9e2f25, 8); }
    b.box(0, 5.6, 0, w - 1, .8, d - 1, 0x2e6e66);
    b.hip(0, 6.4, 0, w + 3, p.double ? 3 : 4.2, d + 3, rc, 0, .3);
    if (p.double) { b.box(0, 8.6, 0, w * .62, 2, d * .55, wc); b.hip(0, 10.4, 0, w * .78, 3.2, d * .7, rc, 0, .3); }
    return { r: Math.max(w, d) * .62 };
  };
  LM.pavilion = (b, p) => {
    const w = p.w; const rc = p.yellow ? C.yellow : C.croof; let y = 0, s = w;
    b.box(0, 0, 0, w + 3, 1.5, w + 3, 0xcfc6b2);
    y = 1.5;
    for (let l = 0; l < p.levels; l++) {
      const h = l === 0 ? 4.2 : 3.2;
      b.box(0, y, 0, s, h, s, l === 0 ? 0xa8352a : 0xb04236);
      y += h; b.hip(0, y - .3, 0, s + 3, 2.2, s + 3, rc, 0, .35); y += 1.2; s *= .78;
    }
    b.cyl(0, y + .5, 0, .15, .25, 2, C.gold, 6); b.sphere(0, y + 2.6, 0, .4, C.gold, 6);
    return { r: w * .8 + 1.5 };
  };
  LM.palace = (b, p) => {
    const W2 = 26, D2 = 22, wc = p.cane ? 0xd9cbb0 : 0xb7483c;
    b.box(0, 0, -D2 / 2, W2, 4, 1, wc); b.box(-W2 / 2, 0, 0, 1, 4, D2, wc); b.box(W2 / 2, 0, 0, 1, 4, D2, wc);
    b.box(-W2 / 4 - 1.6, 0, D2 / 2, W2 / 2 - 3.2, 4, 1, wc); b.box(W2 / 4 + 1.6, 0, D2 / 2, W2 / 2 - 3.2, 4, 1, wc);
    b.box(0, 4.6, D2 / 2, 7, 3, 3, 0xa8352a); b.hip(0, 7.6, D2 / 2, 8.5, 2, 4.4, C.green, 0, .3);
    for (const sx of [-1, 1]) b.box(sx * 2.4, 0, D2 / 2, 1.6, 4.6, 2.6, wc);
    b.box(0, 0, -2, 18, 1, 12, C.marble); b.box(0, 1, -2, 16, 1, 10, C.marble); b.box(0, 2, -2, 14, 1, 8.4, C.marble);
    b.box(0, 3, -2, 11.5, 4.6, 6.6, 0xa8352a);
    for (let k = 0; k < 7; k++) b.cyl(-5.4 + k * 1.8, 3, 1.5, .3, .3, 4.6, 0x9e2f25, 8);
    b.hip(0, 7.4, -2, 15, 4, 9.5, p.cane ? C.gold : C.green, 0, .3);
    b.box(0, 11.2, -2, 6, .4, .5, C.gold);
    if (p.cane) {
      const cx = 0, cz = 16;
      for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; b.cyl(cx + Math.cos(a) * 4, 0, cz + Math.sin(a) * 4, .22, .25, 5, 0xd9b44a, 6); }
      b.cone(cx, 5, cz, 5.4, 3.2, 0xc99a2e, 10); b.sphere(cx, 8.4, cz, .5, C.gold, 6);
      return { colliders: [{ seg: [-W2 / 2, -D2 / 2, W2 / 2, -D2 / 2], r: 1 }, { seg: [-W2 / 2, -D2 / 2, -W2 / 2, D2 / 2], r: 1 }, { seg: [W2 / 2, -D2 / 2, W2 / 2, D2 / 2], r: 1 }, { seg: [-W2 / 2, D2 / 2, -3.2, D2 / 2], r: 1 }, { seg: [3.2, D2 / 2, W2 / 2, D2 / 2], r: 1 }, { c: [0, -2], r: 9 }, { c: [0, 16], r: 4.5 }] };
    }
    return { colliders: [{ seg: [-W2 / 2, -D2 / 2, W2 / 2, -D2 / 2], r: 1 }, { seg: [-W2 / 2, -D2 / 2, -W2 / 2, D2 / 2], r: 1 }, { seg: [W2 / 2, -D2 / 2, W2 / 2, D2 / 2], r: 1 }, { seg: [-W2 / 2, D2 / 2, -3.2, D2 / 2], r: 1 }, { seg: [3.2, D2 / 2, W2 / 2, D2 / 2], r: 1 }, { c: [0, -2], r: 9 }] };
  };
  LM.siege = (b, p, rng) => {
    const treb = (x, z, ry) => {
      b.push(x, 0, z, ry);
      for (const sx of [-1, 1]) { b.box(sx * 1.3, 0, 0, .35, 6.5, .35, C.wood, 0, .35); b.box(sx * 1.3, 0, 0, .35, 6.5, .35, C.wood, 0, -.35); }
      b.box(0, 0, 0, 3, .4, 6, C.woodD);
      b.box(0, 6, 0, 3, .35, .35, C.woodD);
      b.box(0, 6, 0, .35, .35, 12, C.wood, 0, -.6);
      b.box(0, 2.6, -3.1, 1.9, 2, 1.9, 0x6e5a44);
      b.pop();
    };
    treb(-7, 0, .3); treb(0, -3, 0); treb(7, 0, -.3);
    for (let k = 0; k < 7; k++) { const a = Math.PI + (k / 6 - .5) * 2.2; yurt(b, Math.cos(a) * 15, Math.sin(a) * 9 - 6, 1.7, null); }
    for (let k = 0; k < 4; k++) { const x = -12 + k * 8; b.cyl(x, 0, -14, .08, .1, 7, C.woodD, 4); b.box(x + .7, 5.4, -14, 1.4, 1.2, .05, C.red); }
    return { colliders: [{ c: [-7, 0], r: 3.2 }, { c: [0, -3], r: 3.2 }, { c: [7, 0], r: 3.2 }] };
  };
  LM.tombs = (b, p, rng) => {
    const cols = [];
    for (let k = 0; k < 5; k++) {
      const x = (k - 2) * 11 + (rng() - .5) * 3, z = (rng() - .5) * 10, r = 3 + rng() * 2.5;
      b.cyl(x, 0, z, r * .45, r, r * 1.6, 0xc4a273, 10); b.dome(x, r * 1.6, z, r * .45, 0xc4a273, 8, .7);
      for (let t = 1; t < 5; t++) b.cyl(x, r * .32 * t, z, r * (1 - t * .12) + .15, r * (1 - t * .12) + .2, .22, 0xa9885c, 10);
      cols.push({ c: [x, z], r: r + .3 });
    }
    return { colliders: cols };
  };
  LM.yurtPalace = (b, p) => {
    b.cyl(0, 0, 0, 5.5, 5.5, 3.6, C.felt, 16); b.cone(0, 3.6, 0, 5.8, 3.8, p.gold ? C.gold : 0xd8cbb0, 16); b.sphere(0, 7.6, 0, .5, C.gold, 6);
    b.box(0, 0, 5.4, 2.6, 2.8, .3, C.red);
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + .2; yurt(b, Math.cos(a) * 11, Math.sin(a) * 11, 1.8, k % 3 === 0 ? C.gold : null); }
    for (const sx of [-1, 1]) { b.cyl(sx * 3.5, 0, 8, .1, .12, 7, C.woodD, 4); b.sphere(sx * 3.5, 7, 8, .55, sx < 0 ? 0xf2efe6 : 0x222222, 6, 1.3); }
    const cols = [{ c: [0, 0], r: 6 }]; for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + .2; cols.push({ c: [Math.cos(a) * 11, Math.sin(a) * 11], r: 2.2 }); }
    return { colliders: cols };
  };
  LM.ruins = (b, p, rng, cul) => {
    const c = p.mud || cul === 'tarim' || cul === 'central' || cul === 'persian' ? 0xc6a271 : cul === 'arab' ? 0xd6c4a0 : cul === 'armenian' ? 0xa8735f : 0xcdbb98;
    const cols = [];
    for (let k = 0; k < 9; k++) {
      const x = (rng() - .5) * 18, z = (rng() - .5) * 14, L = 3 + rng() * 6, a = rng() < .5 ? 0 : Math.PI / 2;
      b.box(x, 0, z, L, .8 + rng() * 4, 1 + rng() * .4, c, a);
      cols.push({ seg: [x - Math.cos(a) * L / 2, z + Math.sin(a) * L / 2, x + Math.cos(a) * L / 2, z - Math.sin(a) * L / 2], r: 1 });
    }
    for (let k = 0; k < 8; k++) b.box((rng() - .5) * 20, 0, (rng() - .5) * 16, .6 + rng(), .3 + rng() * .6, .6 + rng(), c, rng() * 3);
    return { colliders: cols };
  };
  LM.tower = (b, p) => {
    const c = p.color === 'brick' ? 0xb98260 : 0xc7b796;
    b.cyl(0, 0, 0, p.r, p.r * 1.06, p.h, c, p.fluted ? 24 : 16);
    if (p.fluted) for (let k = 0; k < 20; k++) { const a = k / 20 * Math.PI * 2; b.box(Math.cos(a) * p.r, 0, Math.sin(a) * p.r, .6, p.h, .6, c, -a + Math.PI / 4); }
    if (p.buttress) b.box(0, 0, p.r, 2.4, p.h * .92, 3.2, c);
    b.box(0, 0, -p.r - .02, 1.1, 2, .1, C.dark);
    return { r: p.r + 1.6 };
  };
  LM.observatory = (b) => {
    b.cyl(0, 0, 0, 9, 13, 5, C.earth, 14);
    b.cyl(0, 5, 0, 5, 5, 4.5, 0xd5c39d, 16); b.dome(0, 9.5, 0, 3.6, C.turq, 14); b.box(6, 5, 0, 4, 3.5, 6, 0xd5c39d);
    b.box(-6, 5, 0, .6, 4.5, 7, 0xbfa77d);
    return { r: 13.5 };
  };
  LM.dakhma = (b) => {
    b.cyl(0, 0, 0, 6, 10, 5, 0xc9a978, 12); b.cyl(0, 5, 0, 5.4, 5.4, 2.6, 0xd8c09a, 18); b.box(0, 0, 8, 1.6, 5, 4, 0xc9a978, 0, -.6);
    return { r: 10.5 };
  };
  LM.gate = (b, p, rng) => {
    const rc = 0x8f8270, cols = [];
    for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) {
      const x = sx * (8 + k * 3.5 + rng() * 2), z = (rng() - .5) * 16, h = 10 + rng() * 10;
      b.dodec(x, h * .3, z, 4 + rng() * 2, rc, h / 6, 1, rng() * 3); cols.push({ c: [x, z], r: 4 });
    }
    const wc = p.chinese ? 0xa89a80 : 0xb59f7b;
    for (const sx of [-1, 1]) { b.box(sx * 3.4, 0, 0, 2, 7, 3, wc); cols.push({ c: [sx * 3.4, 0], r: 1.6 }); b.box(sx * 6.5, 0, 0, 4.5, 5, 2.2, wc); }
    b.box(0, 6, 0, 8.8, 2, 3.2, wc);
    if (p.chinese) { b.box(0, 8, 0, 6.6, 2.6, 2.8, 0xa8352a); b.hip(0, 10.4, 0, 9, 2.2, 4.8, C.croof, 0, .3); }
    else for (let k = -3; k <= 3; k++) b.box(k * 1.2, 8, 0, .6, .7, 3.2, wc);
    return { colliders: cols, onRoad: true };
  };
  LM.beacon = (b, p, rng) => {
    const mc = 0xc8a676;
    if (p.gate) {
      const s = 10; b.box(0, 0, -s / 2, s, 6.5, 1.8, mc); b.box(-s / 2, 0, 0, 1.8, 6.5, s, mc); b.box(s / 2, 0, 0, 1.8, 6.5, s, mc);
      b.box(-3.2, 0, s / 2, 3.6, 6.5, 1.8, mc); b.box(3.2, 0, s / 2, 3.6, 6.5, 1.8, mc);
      for (let k = 0; k < 5; k++) b.box((rng() - .5) * 14, 0, (rng() - .5) * 14, 1 + rng(), .5 + rng(), 1 + rng(), 0xb8976a);
      b.cyl(14, 0, -3, 1.6, 2.6, 7, mc, 4, Math.PI / 4);
      return { colliders: [{ seg: [-5, -5, 5, -5], r: 1 }, { seg: [-5, -5, -5, 5], r: 1 }, { seg: [5, -5, 5, 5], r: 1 }, { seg: [-5, 5, -1.4, 5], r: 1 }, { seg: [1.4, 5, 5, 5], r: 1 }, { c: [14, -3], r: 2.6 }] };
    }
    b.cyl(0, 0, 0, 1.6, 2.6, 7, mc, 4, Math.PI / 4); return { r: 2.8 };
  };
  LM.cairn = (b, p, rng) => {
    for (let k = 0; k < 9; k++) { const a = rng() * 6.28, r = rng() * 1.6; b.dodec(Math.cos(a) * r, .4 + rng() * .5 + (k > 5 ? .9 : 0), Math.sin(a) * r, .6 + rng() * .5, 0x8e877c); }
    b.cyl(0, 0, 0, .09, .12, 5, C.woodD, 4);
    if (p.horns) { for (const sx of [-1, 1]) { b.cone(sx * .7, 2.4, .3, .32, 2.2, 0xe2d8c0, 6, 0, .9, sx * 1.4); b.cone(sx * 1.8, 2.9, .9, .2, 1.2, 0xe2d8c0, 6, 0, 1.6, sx * .4); } b.box(0, 2.0, .3, .8, .7, 1.1, 0xe8dfca); }
    if (p.flags) prayerFlags(b, 0, 4.8, 0, rng);
    b.box(0, 4.4, 0, .1, 1, .8, 0x2c5fa8);
    return { r: 2.2 };
  };
  function prayerFlags(b, x, y, z, rng) {
    const cols = [0x2c5fa8, 0xf2efe6, 0xc0392b, 0x3f8f4f, 0xe3b32b];
    for (let s = 0; s < 4; s++) {
      const a = s / 4 * Math.PI * 2 + rng(); const L = 7;
      for (let k = 0; k < 10; k++) {
        const t = (k + .5) / 10; const sag = Math.sin(t * Math.PI) * 1.4;
        b.box(x + Math.cos(a) * L * t, y - t * 4.2 - sag + .2, z + Math.sin(a) * L * t, .5, .45, .03, cols[k % 5], -a + Math.PI / 2);
      }
    }
  }
  LM.lake = () => ({ r: 0, lake: true });
  LM.mountainRock = (b, p, rng) => {
    for (let k = 0; k < 6; k++) b.dodec(-8 + k * 3.2, 2 + rng() * 3, (rng() - .5) * 3, 3.5 + rng() * 2.5, k % 2 ? 0x8f8473 : 0x9a8f7c, 1.3 + rng(), 1.2);
    return { colliders: [{ seg: [-9, 0, 9, 0], r: 4.5 }] };
  };
  LM.jokhang = (b, p, rng) => {
    b.box(0, 0, 0, 16, 6, 14, C.twhite); b.box(0, 5.2, 0, 16.1, .8, 14.1, C.tred);
    for (let k = -3; k <= 3; k++) b.box(k * 2, 2.4, 7.02, .8, 1.1, .08, C.dark);
    b.box(0, 6, -1, 9, 3, 8, 0xd8a03a); b.hip(0, 9, -1, 10.5, 2.6, 9.5, C.gold, 0, .35);
    b.box(-5, 6, 3, 3, 1.8, 3, C.tred); b.hip(-5, 7.8, 3, 4, 1.5, 4, C.gold, 0, .35); b.box(5, 6, 3, 3, 1.8, 3, C.tred); b.hip(5, 7.8, 3, 4, 1.5, 4, C.gold, 0, .35);
    b.cyl(0, 0, 11, .14, .2, 11, C.woodD, 5); prayerFlags(b, 0, 10.5, 11, rng);
    return { r: 11 };
  };
  LM.sakya = (b) => {
    const gc = 0x6f6f6c;
    b.box(0, 0, 0, 18, 8.5, 18, gc);
    for (let k = -8; k <= 8; k += 2) { b.box(k, 0, 9.03, .5, 8.5, .06, k % 4 === 0 ? 0xf3efe6 : 0xa8352a); b.box(9.03, 0, k, .06, 8.5, .5, k % 4 === 0 ? 0xf3efe6 : 0xa8352a); b.box(-9.03, 0, k, .06, 8.5, .5, k % 4 === 0 ? 0xf3efe6 : 0xa8352a); }
    b.box(0, 7.8, 0, 18.2, .9, 18.2, C.tred);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(sx * 9, 0, sz * 9, 3, 10, 3, gc);
    b.box(0, 8.5, 0, 8, 3, 8, 0xc9902e); b.hip(0, 11.5, 0, 9.5, 2.8, 9.5, C.gold, 0, .35);
    b.box(0, 0, 9.06, 2.2, 3.5, .1, C.dark);
    return { r: 13 };
  };
  LM.harbor = () => ({ r: 0, harbor: true });
  LM.aqueduct = (b) => {
    const c = 0xc9b48e, n = 12, span = 4.2;
    for (let k = 0; k < n; k++) { const x = (k - (n - 1) / 2) * span; b.box(x, 0, 0, 1.4, 14, 3, c); if (k < n - 1) { b.arch(x + span / 2, 6.4 - 1.4, 0, 1.4, 3.0, 0xa8936e, Math.PI / 2); b.arch(x + span / 2, 12.2 - 1.4, 0, 1.4, 3.0, 0xa8936e, Math.PI / 2); b.box(x + span / 2, 6.3, 0, span - 1.4, 1.4, 3, c); b.box(x + span / 2, 12.1, 0, span - 1.4, 1.4, 3, c); } }
    b.box(0, 7.6, 0, n * span, 1.8, 3, c); b.box(0, 13.4, 0, n * span, 1.6, 3, c); b.box(0, 15, 0, n * span, .4, 3.4, 0xb9a47e);
    for (let k = 0; k < n - 1; k++) { const x = (k - (n - 1) / 2) * span + span / 2; b.box(x, 0, 0, span - 1.4, 3.4, 3, c); b.box(x, 9.4, 0, span - 1.4, 1.2, 3, c); }
    return { colliders: [{ seg: [-n * span / 2, 0, n * span / 2, 0], r: 2 }] };
  };
  LM.column = (b, p) => {
    const c = p.color === 'porphyry' ? 0x7a3a4a : 0xd8cdb6;
    b.box(0, 0, 0, 4.4, 1.2, 4.4, 0xcfc4ad); b.box(0, 1.2, 0, 3.4, 3.2, 3.4, 0xd8cdb6);
    for (let k = 0; k < 7; k++) { b.cyl(0, 4.4 + k * p.h / 7, 0, 1.2, 1.25, p.h / 7 - .25, c, 14); b.cyl(0, 4.4 + (k + 1) * p.h / 7 - .25, 0, 1.4, 1.4, .25, 0xd8b54a, 14); }
    b.box(0, 4.4 + p.h, 0, 2.6, .8, 2.6, 0xd8cdb6);
    return { r: 3.4 };
  };
  LM.scaffold = (b, p, rng) => {
    const c = 0xc4a271, L = 30;
    b.box(0, 0, 0, L, 7, 6, c); b.box(-L / 4, 7, 0, L / 2, 3, 5, c);
    for (let k = 0; k <= 10; k++) { const x = L / 4 - 1 + (k / 10) * (L / 2); for (const z of [-3.6, 3.6]) b.cyl(x, 0, z, .1, .12, 11, C.wood, 4); }
    for (let lv = 1; lv <= 3; lv++) for (const z of [-3.6, 3.6]) b.box(L / 4 - 1 + L / 4, lv * 3.2, z, L / 2, .12, .25, C.wood);
    for (let k = 0; k < 6; k++) b.box(L / 4 + (rng() - .5) * L * .4, 7 + (rng() * 3), (rng() - .5) * 4, 1, .5, 1, 0xb0905e);
    b.box(-L / 2 - 4, 0, 4, 3, 1, 2, 0xc4a271); b.box(-L / 2 - 4, 0, -2, 2, 1.6, 2, 0xc4a271);
    return { colliders: [{ seg: [-L / 2, 0, L / 2, 0], r: 3.5 }] };
  };
  LM.bazaar = (b) => {
    const c = 0xc9a274, L = 26;
    b.box(0, 0, 0, L, 5.5, 8, c);
    for (let k = 0; k < 7; k++) { const x = (k - 3) * (L / 7); b.dome(x, 5.5, 0, 2.6, 0xc4996a, 10, .6); b.cyl(x, 5.5 + 1.5, 0, .3, .3, .5, 0xc4996a, 6); }
    for (const sx of [-1, 1]) { b.box(sx * (L / 2 + .3), 0, 0, 1.2, 7.5, 6, c); b.box(sx * (L / 2 + .95), 0, 0, .1, 4.5, 3, C.dark); b.arch(sx * (L / 2 + .95), 4.5, 0, 1.5, .1, C.dark); }
    for (let k = 0; k < 8; k++) { const x = (k - 3.5) * (L / 8); b.box(x, .3, 4.02, 1.8, 2.4, .1, C.dark); b.box(x, .3, -4.02, 1.8, 2.4, .1, C.dark); }
    return { colliders: [{ seg: [-L / 2, 0, L / 2, 0], r: 4.2 }] };
  };
  LM.canalbridge = (b, p, rng) => {
    // a stretch of stone canal with a humped bridge and moored boats (water added by the city builder)
    const sc = 0xa8a294, L = 36;
    for (const sz of [-1, 1]) b.box(0, -1.4, sz * 3.6, L, 1.6, 1, sc);
    b.box(0, -1.6, 0, L, .2, 6.2, 0x3f8f9c);
    for (let k = 0; k < 9; k++) { const t = k / 8; const y = Math.sin(t * Math.PI) * 2.2; b.box(-3 + t * 0, y, -3.6 + t * 7.2, 3.2, .45, 1, sc); }
    b.arch(0, -1.6, 0, 2.0, 3.2, 0x8a857a, Math.PI / 2);
    for (let k = 0; k < 3; k++) { const x = 8 + k * 7; b.box(x, -1.5, (k % 2 ? 1.2 : -1.2), 1.4, .6, 4.5, 0x6b4a30); b.cyl(x, -1, (k % 2 ? 1.2 : -1.2), .7, .7, .1, 0x8a6a48, 8, 0, Math.PI / 2); }
    for (let k = 0; k < 4; k++) { const tg = treeGeo('willow'); const x = -14 + k * 8, z = (k % 2 ? 5.6 : -5.6); for (let v = 0; v < tg.pos.length; v += 3) { b.pos.push(x + tg.pos[v] * .8, tg.pos[v + 1] * .8, z + tg.pos[v + 2] * .8); b.col.push(tg.col[v], tg.col[v + 1], tg.col[v + 2]); } }
    return { colliders: [{ seg: [-L / 2, 0, -2, 0], r: 3.4 }, { seg: [2, 0, L / 2, 0], r: 3.4 }] };
  };
  // ---- planned-city building types (front = +z, footprint w x d centred on origin) ----
  const CB = {};
  CB.siheyuan = (b, w, d, rng, cul) => {
    const song = cul === 'song'; const wallC = song ? 0xe9e3d6 : pick(rng, [0x9e9584, 0xa89c88, 0x948b7c]); const roof = song ? C.sroof : C.croof; const red = song ? 0x5a4636 : 0xa8352a;
    const T = .35, H = 2.7, gx = w * .3;
    const wall = (x, z, len, ry) => { b.box(x, 0, z, len, H, T, wallC, ry); b.box(x, H, z, len + .2, .22, T + .5, roof, ry); };
    wall(0, -d / 2, w, 0); wall(-w / 2, 0, d, Math.PI / 2); wall(w / 2, 0, d, Math.PI / 2);
    const gl = gx - 1.1, gr = gx + 1.1; wall((-w / 2 + gl) / 2, d / 2, gl + w / 2, 0); wall((gr + w / 2) / 2, d / 2, w / 2 - gr, 0);
    b.box(gx, 0, d / 2, 2.4, 3.3, 1.6, wallC); b.gable(gx, 3.3, d / 2, 2.9, 1.1, 2.2, roof); b.box(gx, 0, d / 2 + .81, 1.3, 2.3, .06, red); b.box(gx, 2.35, d / 2 + .82, 1.6, .25, .05, 0x2e6e66);
    const md = Math.min(4.2, d * .3), mw = w * .66, mz = -d / 2 + md / 2 + .5;
    b.box(0, 0, mz, mw + .6, .45, md + .8, 0xb9b2a2); b.box(0, .45, mz, mw, 3.0, md, wallC);
    for (let k = 0; k <= 4; k++) b.cyl(-mw / 2 + k * mw / 4, .45, mz + md / 2 + .2, .14, .14, 3.0, red, 6);
    for (let k = 0; k < 3; k++) { b.box((k - 1) * mw * .3, 1.1, mz + md / 2 + .02, mw * .2, 1.6, .06, 0x6e5a44); for (let m = 0; m < 4; m++) b.box((k - 1) * mw * .3, 1.2 + m * .4, mz + md / 2 + .05, mw * .2, .05, .04, 0xd8ccb2); }
    b.gable(0, 3.45, mz, mw + 1.4, 1.7, md + 1.6, roof); b.box(0, 5.1, mz, mw + .6, .25, .3, 0x3a3e44);
    const sw = Math.min(3.4, w * .2), sd = d * .34;
    for (const sx of [-1, 1]) { const x = sx * (w / 2 - sw / 2 - .5); b.box(x, 0, .4, sw, 2.7, sd, wallC); b.gable(x, 2.7, .4, sw + 1.1, 1.3, sd + .8, roof, Math.PI / 2); b.box(x - sx * sw / 2, .9, .4, .06, 1.3, sd * .5, 0x6e5a44); }
    if (d > 11) { b.box(0, 0, d / 2 - 1.9, w * .55, 2.6, 2.4, wallC); b.gable(0, 2.6, d / 2 - 1.9, w * .55 + 1, 1.1, 3.2, roof); }
    b.box(0, .02, .6, w - 2 * sw - 1.4, .05, sd + 1, 0xa39b8a);
    if (rng() < .7) { const tg = treeGeo(rng() < .5 ? 'sophora' : 'fruit'); const s = .6 + rng() * .2; const tx = (rng() - .5) * 2; for (let v = 0; v < tg.pos.length; v += 3) { b.pos.push(...applyCur(b, tx + tg.pos[v] * s, tg.pos[v + 1] * s, .8 + tg.pos[v + 2] * s)); b.col.push(tg.col[v], tg.col[v + 1], tg.col[v + 2]); } }
    if (rng() < .3) { b.cyl(-w * .2, 0, .8, .35, .4, .6, 0x6a6a64, 8); }
  };
  function applyCur(b, x, y, z) { const e = b.cur.elements; return [e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]]; }
  CB.shophouse = (b, w, d, rng, cul) => {
    const song = cul === 'song'; const wc = song ? 0xe9e3d6 : pick(rng, [0xb0a48e, 0xa89c88]); const roof = song ? C.sroof : C.croof; const red = song ? 0x5a4636 : 0xa8352a;
    b.box(0, 0, 0, w, 2.8, d, wc); b.box(0, .02, d / 2 + .01, w - .6, 2.4, .08, 0x2a221c);
    b.box(0, 0, d / 2 + .25, w - .8, .9, .5, C.wood); for (let k = 0; k < 3; k++) b.box((k - 1) * w * .25, .9, d / 2 + .25, .5, .25, .35, pick(rng, [0xd03a26, 0xe3c35a, 0x3f7a6a, 0xc9a06a, 0xf0ede4]));
    b.box(0, 2.8, .25, w + .2, 2.4, d + .5, wc); b.box(0, 2.75, d / 2 + .5, w + .4, .15, .1, red);
    const nW = Math.max(1, Math.round(w / 1.6)); for (let k = 0; k < nW; k++) { const x = (k + .5 - nW / 2) * w / nW; b.box(x, 3.4, d / 2 + .52, w / nW * .7, 1.2, .05, 0x6e5a44); b.box(x, 3.9, d / 2 + .55, w / nW * .7, .05, .04, 0xd8ccb2); }
    b.gable(0, 5.2, .25, w + .9, 1.5, d + 1.6, roof); b.box(0, 6.6, .25, w + .5, .22, .3, 0x3a3e44);
    if (rng() < .7) { b.box(w / 2 - .3, 1.2, d / 2 + .7, .1, 2.6, .55, pick(rng, [0xa8352a, 0x1e1a18, 0x2e5a5a])); b.box(w / 2 - .3, 1.5, d / 2 + .7, .12, 1.8, .38, 0xd8b54a); }
    if (rng() < .5) { b.sphere(-w / 2 + .6, 2.4, d / 2 + .6, .22, 0xd03a26, 6, 1.3); }
  };
  CB.courtyardHouse = (b, w, d, rng, cul) => {
    const wc = cul === 'arab' ? pick(rng, [0xe3d6bd, 0xd9c9a8, 0xece2cc]) : cul === 'tarim' ? pick(rng, [0xcfac78, 0xd6b585]) : cul === 'rum' ? pick(rng, [0xd6c2a0, 0xc9b08a]) : pick(rng, [C.mud, C.mudL, 0xc49766, 0xd2ad7a, 0xd9b98a]);
    const H = 3.2 + rng() * .8, t = Math.min(2.6, Math.min(w, d) * .24);
    b.box(0, 0, d / 2 - t / 2, w, H, t, wc); b.box(0, 0, -d / 2 + t * .6, w, H + 1.2, t * 1.2, wc);
    b.box(-w / 2 + t / 2, 0, 0, t, H, d - 2 * t, wc); b.box(w / 2 - t / 2, 0, 0, t, H, d - 2 * t, wc);
    for (const [x, z, ww, dd, hh] of [[0, d / 2 - t / 2, w, t, H], [0, -d / 2 + t * .6, w, t * 1.2, H + 1.2], [-w / 2 + t / 2, 0, t, d - 2 * t, H], [w / 2 - t / 2, 0, t, d - 2 * t, H]]) b.box(x, hh, z, ww + .1, .3, dd + .1, wc);
    b.box(0, H * .55 + .6, -d / 2 + t * 1.2 + .02, Math.min(3, w * .3), H * .55, .06, 0x3a2e24);
    b.box(0, 0, d / 2 + .02, 1, 1.8, .06, pick(rng, [0x6a4a30, 0x2c5f7a, 0x5a3a2a])); b.arch(0, 1.8, d / 2 + .02, .5, .07, 0x3a2e24, Math.PI / 2);
    b.box(0, 0, d / 2 + .04, 1.5, 2.6, .04, cul === 'persian' || cul === 'central' ? 0x3f7f8c : 0xbfa98a);
    for (let k = 0; k < 2; k++) b.box((k - .5) * w * .5, H - 1.1, d / 2 + .02, .35, .45, .05, C.dark);
    b.box(0, .02, 0, w - 2 * t, .05, d - 2.2 * t, 0xb7a684);
    if (rng() < .5) { b.box(0, .02, .3, 1.6, .2, 1.6, 0x9a8a70); b.box(0, .06, .3, 1.3, .2, 1.3, 0x3d8fa0); }
    if (rng() < .45) { const tg = treeGeo(cul === 'arab' && rng() < .5 ? 'date' : (rng() < .5 ? 'fruit' : 'mulberry')); const s = .55; const tx = (rng() - .5) * (w - 2 * t - 2) * .5; for (let v = 0; v < tg.pos.length; v += 3) { b.pos.push(...applyCur(b, tx + tg.pos[v] * s, tg.pos[v + 1] * s, -.8 + tg.pos[v + 2] * s)); b.col.push(tg.col[v], tg.col[v + 1], tg.col[v + 2]); } }
    if (cul === 'rum' && rng() < .5) b.gable(0, H + .3, 0, w + .2, 1, d + .2, C.terra, 0);
    else {
      if ((cul === 'persian' || cul === 'central') && rng() < .3) b.dome(-w / 2 + t, H + .3, -d / 2 + t, t * .9, wc, 8);
      if (rng() < .35) { b.box(w * .3, H + .3, -d / 2 + t * .6, 1, 2.2, 1, wc); for (let k = 0; k < 2; k++) b.box(w * .3 + (k - .5) * .4, H + 1.4, -d / 2 + t * .6 + .51, .16, .9, .05, C.dark); }
      for (let k = 0; k < 2; k++) if (rng() < .5) b.cyl((rng() - .5) * w * .6, H + .3, d / 2 - t / 2, .22, .26, .5, 0xb8734a, 6);
    }
  };
  CB.shopBay = (b, w, d, rng, cul) => {
    const wc = cul === 'arab' ? 0xe0d2b6 : cul === 'rum' ? 0xd6c2a0 : cul === 'tarim' ? 0xd2b080 : C.mudL;
    b.box(0, 0, 0, w, 3.6, d, wc); b.box(0, 3.6, 0, w + .05, .3, d + .05, wc);
    b.box(0, 0, d / 2 + .02, w - .7, 2.2, .06, 0x2a221c); b.arch(0, 2.2, d / 2 + .02, (w - .7) / 2, .07, 0x2a221c, Math.PI / 2);
    b.box(0, 0, d / 2 + .4, w - .9, .7, .8, C.wood);
    for (let k = 0; k < 3; k++) { const c = pick(rng, [0xd08a2a, 0xb0402c, 0x7a9a3a, 0xc9a06a, 0x2c5fa8, 0xe0c060, 0x8a2a24]); if (rng() < .5) b.cone((k - 1) * w * .26, .7, d / 2 + .4, .22, .32, c, 6); else b.box((k - 1) * w * .26, .7, d / 2 + .4, .4, .18, .5, c); }
    if (rng() < .5) b.box(0, 2.6, d / 2 + .7, w - .2, .06, 1.4, pick(rng, [0xb0402c, 0x2f6f8f, 0xd09a2a, 0x5a7a3a, 0xe0d4b8]), 0, .2);
    if (rng() < .25) FURN[pick(rng, ['jars', 'sacks', 'rugs'])](b, rng);
  };
  CB.rowHouse = (b, w, d, rng, cul) => {
    const wc = cul === 'armenian' ? pick(rng, [C.tuff, 0xb9887a]) : cul === 'georgian' ? pick(rng, [0xd8c8ad, 0xc9b49a]) : pick(rng, [0xe8dcc3, 0xd9c6a3, 0xcfb796, 0xe5d2b6, 0xddc9b0, 0xead8b8]);
    const fl = 2 + (rng() < .45 ? 1 : 0); const H = fl * 2.5;
    b.box(0, 0, 0, w, H, d, wc); b.box(0, 0, d / 2 + .01, w, .45, .06, 0xb9ad98);
    if (rng() < .4) { b.box(0, 0, d / 2 + .02, w * .55, 2.1, .06, 0x2a221c); b.arch(0, 2.1, d / 2 + .02, w * .275, .07, 0x2a221c, Math.PI / 2); } else { b.box(-w * .25, 0, d / 2 + .03, .9, 1.9, .06, C.woodD); b.box(-w * .25, 0, d / 2 + .02, 1.15, 2.05, .05, 0xc9bca2); }
    const nW = Math.max(1, Math.round(w / 1.7));
    for (let f = 1; f < fl; f++) for (let k = 0; k < nW; k++) { const x = (k + .5 - nW / 2) * w / nW; b.box(x, f * 2.5 + .7, d / 2 + .02, .55, 1.0, .06, C.dark); b.box(x, f * 2.5 + .62, d / 2 + .05, .75, .1, .1, 0xf0e6d2); b.box(x - .42, f * 2.5 + .7, d / 2 + .05, .1, 1, .08, pick(rng, [0x2c5a4a, 0x6a3a2a, 0x3a4a6a])); }
    if (fl > 2 && rng() < .5) { b.box(0, 2.45, d / 2 + .5, w * .7, .12, 1, C.wood); for (let k = 0; k < 6; k++) b.box((k / 5 - .5) * w * .66, 2.57, d / 2 + .96, .06, .7, .06, C.woodD); b.box(0, 3.2, d / 2 + .96, w * .7, .07, .07, C.woodD); }
    b.gable(0, H, 0, w + .3, 1.3 + rng() * .3, d + .5, pick(rng, [C.terra, C.terra2, 0xbf6343, 0xa95238]));
    if (rng() < .4) { b.box(w * .3, H + .2, -d * .2, .5, 1.5, .5, wc); }
  };
  CB.colonnade = (b, len) => {
    const n = Math.max(2, Math.round(len / 2.6)); const sp = len / n;
    for (let k = 0; k <= n; k++) { const x = -len / 2 + k * sp; b.box(x, 0, 0, .7, .4, .7, 0xd8cdb6); b.cyl(x, .4, 0, .24, .28, 3.8, 0xe6dccb, 8); b.box(x, 4.2, 0, .6, .3, .6, 0xd8cdb6); }
    b.box(0, 4.5, 0, len + .6, .5, .9, 0xd8cdb6); b.box(0, 5.0, -1.4, len + .6, .1, 3.4, C.terra, 0, -.25);
  };
  CB.yurtCompound = (b, w, d, rng) => {
    for (const [x, z, L, ry] of [[0, -d / 2, w, 0], [-w / 2, 0, d, Math.PI / 2], [w / 2, 0, d, Math.PI / 2], [-w / 4 - .9, d / 2, w / 2 - 1.8, 0], [w / 4 + .9, d / 2, w / 2 - 1.8, 0]]) {
      const n = Math.max(2, Math.round(L / 1.6)); const cs = Math.cos(ry), sn = Math.sin(ry);
      for (let k = 0; k <= n; k++) { const t = -L / 2 + k * L / n; b.cyl(x + t * cs, 0, z - t * sn, .06, .08, 1.4, C.woodD, 4); }
      b.box(x, 1.1, z, L, .08, .08, C.wood, ry); b.box(x, .6, z, L, .08, .08, C.wood, ry);
    }
    yurt(b, -w * .15, -d * .1, 1.9 + rng() * .3, rng() < .15 ? C.gold : null); if (w > 9) yurt(b, w * .25, -d * .2, 1.5, null);
    if (rng() < .6) FURN.cart(b, rng);
  };
  // ---- small civic buildings for city streets & villages ----
  const CIVIC = {};
  CIVIC.mosque = (b, rng, cul) => {
    const wc = cul === 'arab' ? 0xe0d2b6 : cul === 'rum' ? 0xd2bf9c : cul === 'tarim' ? 0xd2b080 : C.mudL; const dc = cul === 'rum' ? C.lead : pick(rng, [C.turq, C.turq, 0xc49a6a]);
    b.box(0, 0, 0, 7, 4.2, 6.5, wc); b.cyl(0, 4.2, 0, 2.4, 2.5, .8, wc, 10); if (cul === 'rum') b.dome(0, 5, 0, 2.5, dc, 12, .6); else b.dome(0, 5, 0, 2.4, dc, 12, 1.05);
    b.box(0, 0, 3.3, 2.6, 5.4, .8, wc); b.box(0, 0, 3.72, 1.3, 3.4, .06, C.dark); b.arch(0, 3.4, 3.72, .65, .06, C.dark, Math.PI / 2);
    const mx = 3.2, mz = 2.9;
    if (cul === 'arab') { b.box(mx, 0, mz, 1.5, 11, 1.5, wc); b.box(mx, 11, mz, 1.8, .4, 1.8, wc); b.box(mx, 11.4, mz, 1.1, 1.6, 1.1, wc); b.dome(mx, 13, mz, .6, wc, 8, 1.2); }
    else { b.cyl(mx, 0, mz, .55, .7, 10.5, cul === 'rum' ? 0xb98663 : wc, 10); b.cyl(mx, 8.3, mz, .9, .8, .4, wc, 10); if (cul === 'rum') b.cone(mx, 10.5, mz, .6, 2.4, C.lead, 10); else b.dome(mx, 10.5, mz, .55, dc, 8, 1.3); }
    return 4.8;
  };
  CIVIC.church = (b, rng, cul) => {
    const wc = cul === 'armenian' ? C.tuff : cul === 'georgian' ? 0xcdb796 : 0xdcc6a2; const rc = cul === 'byz' ? C.terra : 0x9a7a68;
    b.box(0, 0, 0, 5, 4.6, 7, wc); b.gable(0, 4.6, 0, 5.3, 1.6, 7.3, rc, Math.PI / 2); b.box(0, 0, 0, 7.4, 3.8, 3.4, wc); b.gable(0, 3.8, 0, 7.6, 1.3, 3.6, rc);
    b.cyl(0, 6.2, 0, 1.4, 1.4, 2.2, wc, 10); if (cul === 'byz') b.dome(0, 8.4, 0, 1.45, C.terra, 10, .8); else b.cone(0, 8.4, 0, 1.6, 2.2, rc, 10);
    b.cyl(0, 0, -3.6, 1.8, 1.8, 3.6, wc, 8); b.box(0, 0, 3.52, 1, 2.2, .06, C.dark); b.arch(0, 2.2, 3.52, .5, .06, C.dark, Math.PI / 2);
    for (const sx of [-1, 1]) b.box(sx * 2.52, 2.2, 0, .06, 1.2, .5, C.dark);
    return 4.6;
  };
  CIVIC.temple = (b, rng, cul) => {
    const rc = cul === 'song' ? C.sroof : C.croof;
    b.box(0, 0, 0, 9, .9, 7, 0xb9b2a2); b.box(0, .9, 0, 7, 3.6, 5, 0xa8352a); for (let k = 0; k < 5; k++) b.cyl(-3 + k * 1.5, .9, 2.6, .18, .18, 3.6, 0x9e2f25, 6);
    b.hip(0, 4.5, 0, 9.6, 2.4, 7.4, rc, 0, .32); b.box(0, 6.8, 0, 3.5, .25, .35, 0x3a3e44);
    b.box(0, 0, 5.4, 4, .1, .1, 0x8a8a8a); b.cyl(-1.6, 0, 5.4, .14, .14, 3.2, 0xa8352a, 6); b.cyl(1.6, 0, 5.4, .14, .14, 3.2, 0xa8352a, 6); b.box(0, 3.2, 5.4, 4.4, .45, .5, 0xa8352a); b.hip(0, 3.6, 5.4, 4.8, .8, 1, rc, 0, .3);
    if (rng() < .5) { b.cyl(4.5, .9, -2, .06, .08, 1.4, 0x6b6b6b, 6); b.box(4.5, 2.2, -2, .5, .6, .5, 0x8a8a8a); }
    return 5.8;
  };
  CIVIC.hammam = (b, rng, cul) => {
    const wc = cul === 'arab' ? 0xe0d2b6 : C.mudL;
    b.box(0, 0, 0, 8, 3.6, 6, wc); for (const [x, r] of [[-2, 1.8], [2, 1.5], [0, 2.2]]) b.dome(x, 3.6, x === 0 ? -1 : 1, r, wc, 10, .8);
    for (let k = 0; k < 9; k++) b.cyl(-2 + (k % 3) * .6 - .6, 3.6 + 1.5, 1 + (k / 3 | 0) * .5 - .5, .08, .08, .2, 0xa8d4d0, 5);
    b.box(0, 0, 3.02, 1.2, 2.2, .06, C.dark); return 5;
  };
  CIVIC.serai = (b, rng) => { PROP.serai(b, rng); return 6.5; };
  CIVIC.paifang = (b, rng, cul) => {
    const c = cul === 'song' ? 0x9c968c : 0xa8352a;
    for (const sx of [-1, 1]) for (const s2 of [3.4, 5.2]) b.box(sx * s2, 0, 0, .5, 5.5 - (s2 > 4 ? 1.2 : 0), .5, c);
    b.box(0, 4.2, 0, 11.5, .6, .45, c); b.box(0, 5.0, 0, 7, .9, .3, 0x2e6e66); b.hip(0, 5.5, 0, 8.6, 1, 1.2, cul === 'song' ? C.sroof : C.croof, 0, .35);
    for (const sx of [-1, 1]) b.hip(sx * 4.3, 4.6, 0, 2.6, .7, 1, cul === 'song' ? C.sroof : C.croof, 0, .35);
    return 0;
  };
  CIVIC.chorten = (b) => { PROP.chorten(b); b.cyl(1.5, 0, 0, .06, .08, 3, C.woodD, 4); prayerFlagsSmall(b, 1.5, 3, 0, Math.random); return 1.6; };
  CIVIC.stupa = (b) => { b.box(0, 0, 0, 5, 1.5, 5, 0xc8a676); b.cyl(0, 1.5, 0, 1.8, 2, 2, 0xc8a676, 10); b.dome(0, 3.5, 0, 1.8, 0xbf9c6c, 10, .8); b.cyl(0, 5, 0, .15, .2, 1.4, C.gold, 6); return 3.6; };

  LM.label = () => ({ r: 0, none: true });

  function ship(b, kind) {
    if (kind === 'junk') {
      b.box(0, -.6, 0, 3.6, 1.8, 13, 0x6b4a30); b.box(0, 1.2, -5, 3.6, 1.6, 3, 0x7a5636); b.box(0, 1.2, 5.3, 3, 1, 2.4, 0x7a5636);
      for (const z of [-2.5, 1.5, 4.5]) { b.cyl(0, 1.2, z, .12, .15, z === 1.5 ? 11 : 8, C.woodD, 5); b.box(0, 3.5, z, 5, z === 1.5 ? 7 : 5, .1, 0xa8643a); for (let k = 0; k < 5; k++) b.box(0, 3.6 + k * 1.3, z + .06, 5.1, .1, .1, C.woodD); }
    } else if (kind === 'galley') {
      b.box(0, -.4, 0, 3, 1.4, 16, 0x7a5636); b.box(0, 1, -6.5, 3, 1.2, 3, 0x8a6240);
      for (let k = 0; k < 10; k++) for (const sx of [-1, 1]) b.box(sx * 2.4, .6, -5 + k * 1.1, 2.6, .08, .12, C.woodD, 0, 0, sx * .3);
      b.cyl(0, .9, 1, .12, .15, 9, C.woodD, 5); b.box(0, 7.5, 1, .12, .12, 10, C.woodD, 0, .5); b.box(0, 3.5, 2, .05, 6, 6, 0xf0e6cf, 0, .5);
    } else {
      b.box(0, -.5, 0, 2.6, 1.6, 9, 0x8a6240); b.box(0, 1.1, -3.4, 2.6, .8, 2.2, 0x8a6240);
      b.cyl(0, 1, 0, .1, .13, 7.5, C.woodD, 5); b.box(0, 5.5, 0, .1, .1, 8, C.woodD, 0, .45); b.box(0, 3, .6, .05, 5.5, 5, 0xf0e6cf, 0, .45);
    }
  }

  // ---------- roadside props ----------
  const PROP = {};
  PROP.cairn = (b, rng) => { for (let k = 0; k < 5; k++) b.dodec((rng() - .5) * 1.2, .3 + k * .25, (rng() - .5) * 1.2, .5 + rng() * .3, 0x8e877c); };
  PROP.milestone = (b) => { b.box(0, 0, 0, .6, 1.3, .4, 0xcfc4ad); b.box(0, 1.3, 0, .7, .15, .5, 0xcfc4ad); };
  PROP.ovoo = (b, rng) => { for (let k = 0; k < 8; k++) b.dodec((rng() - .5) * 2, .3 + (k > 4 ? .8 : 0), (rng() - .5) * 2, .6 + rng() * .4, 0x8e877c); b.cyl(0, 0, 0, .08, .1, 3.6, C.woodD, 4); b.box(.25, 3, 0, .5, 1.2, .04, 0x2c78c8); };
  PROP.beacon = (b) => { b.cyl(0, 0, 0, 1.3, 2.1, 6, 0xc8a676, 4, Math.PI / 4); b.box(0, 6, 0, 1.6, .5, 1.6, 0xb8976a); };
  PROP.hanwall = (b, rng) => { for (let k = 0; k < 4; k++) b.box(k * 5.2, 0, 0, 5, 1.5 + rng() * 2.5, 1.4, 0xc4a271); };
  PROP.chorten = (b) => { b.box(0, 0, 0, 2.4, .6, 2.4, C.twhite); b.box(0, .6, 0, 1.8, .5, 1.8, C.twhite); b.sphere(0, 1.8, 0, .9, C.twhite, 8); b.cyl(0, 2.6, 0, .2, .4, 1.4, C.gold, 6); };
  PROP.pavilion = (b) => { for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl(sx * 1.6, 0, sz * 1.6, .15, .15, 2.8, 0xa8352a, 6); b.box(0, 0, 0, 4, .3, 4, 0xcfc6b2); b.hip(0, 2.7, 0, 5.2, 1.6, 5.2, C.croof, 0, .35); };
  PROP.serai = (b) => { const s = 9, wc = 0xd2bb92; b.box(0, 0, -s / 2, s, 3.8, 1, wc); b.box(-s / 2, 0, 0, 1, 3.8, s, wc); b.box(s / 2, 0, 0, 1, 3.8, s, wc); b.box(-2.8, 0, s / 2, 3.4, 3.8, 1, wc); b.box(2.8, 0, s / 2, 3.4, 3.8, 1, wc); b.box(0, 0, s / 2 + .2, 3.4, 5.5, 1.4, 0xcfb58b); b.box(0, 0, s / 2 + .92, 1.6, 3.2, .1, C.dark); for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl(sx * s / 2, 0, sz * s / 2, .8, .9, 4.4, wc, 8); };
  PROP.yurts = (b, rng) => { for (let k = 0; k < 3; k++) yurt(b, k * 5 - 5, (rng() - .5) * 4, 1.5 + rng() * .4, null); };
  PROP.flags = (b, rng) => { b.cyl(0, 0, 0, .08, .1, 4.5, C.woodD, 4); prayerFlags(b, 0, 4.4, 0, rng); };

  // ================= BUILD 2: Egypt, Arabia, India, Indochina =================
  // (spliced into the BLD closure: can use Builder, C, TREE, TREE_LOW, house, wallStyle, CB, CIVIC, LM, pick)
  Object.assign(C, { laterite: 0x9a5a3a, khmer: 0x9c968a, soap: 0x6e6658, stucco: 0xe8dcc4, thatch: 0xa38a5a, bamboo: 0xc8a87a, kiswa: 0x161616, basalt: 0x6a645c, water: 0x4a7a86 });

  // ---------- trees ----------
  const mk = (fn, jit = .06, ao = true) => { const b = new Builder(); b.jit = jit; if (!ao) b.ao = false; fn(b); return { pos: new Float32Array(b.pos), col: new Float32Array(b.col) }; };
  TREE.coconut = mk(b => {
    let x = 0, y = 0; const seg = [[2.4, .08], [2.4, .16], [2.2, .26], [1.6, .34]];
    for (const [h, lean] of seg) { b.cyl(x, y, 0, .15, .19, h + .1, 0x9a7e5e, 6, 0, 0, -lean); x += Math.sin(lean) * h; y += Math.cos(lean) * h; }
    for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2; b.push(x, y, 0, a); b.cone(0, 0, 0, .34, 3.6, k % 2 ? 0x4f8a36 : 0x5c9a3e, 4, 0, 0, -2.05); b.pop(); }
    for (let k = 0; k < 3; k++) b.sphere(x + Math.cos(k * 2.1) * .3, y - .35, Math.sin(k * 2.1) * .3, .22, 0x6a5a2e, 5);
  });
  TREE.banyan = mk(b => {
    b.cyl(0, 0, 0, .55, .8, 2.6, 0x7a6a58, 7);
    for (let k = 0; k < 7; k++) { const a = k * .9, r = 1.4 + (k % 3) * .7; b.cyl(Math.cos(a) * r, 0, Math.sin(a) * r, .06, .1, 3.2 + (k % 2) * .4, 0x8a7a64, 3); }
    b.ico(0, 3.9, 0, 3.6, 0x3e6a30, .5, 1.25); b.ico(2.4, 3.5, .8, 2.3, 0x467534, .55); b.ico(-2.2, 3.6, -1, 2.2, 0x3a6430, .55); b.ico(.4, 4.6, -1.6, 1.8, 0x4a7a38, .6);
  });
  TREE.teak = mk(b => { b.cyl(0, 0, 0, .18, .28, 4.6, 0x8a7a68, 5); b.ico(0, 5.6, 0, 2.0, 0x5a7a34, .95, 1.1); b.ico(.9, 4.9, .4, 1.3, 0x668436, .9); b.ico(-.8, 5.1, -.3, 1.2, 0x52722f, .9); });
  TREE.mango = mk(b => { b.cyl(0, 0, 0, .26, .36, 1.7, 0x4e3e30, 5); b.sphere(0, 3.3, 0, 2.4, 0x2d5a2a, 8, .82); b.ico(1.4, 2.9, .6, 1.4, 0x356530, .8); b.ico(-1.3, 3.0, -.5, 1.3, 0x2a542a, .8); });
  TREE.acacia = mk(b => { b.cyl(0, 0, 0, .1, .16, 1.8, 0x6a5a46, 4, 0, 0, .15); b.cyl(.2, 1.6, 0, .07, .1, 1.3, 0x6a5a46, 4, 0, 0, -.55); b.cyl(-.1, 1.6, .1, .07, .1, 1.2, 0x6a5a46, 4, 0, .3, .5);
    b.ico(.3, 2.9, 0, 2.3, 0x7f8c48, .22, 1.2); b.ico(-.8, 2.75, .4, 1.4, 0x8a9550, .25, 1.1); });
  TREE.sycamore = mk(b => { b.cyl(0, 0, 0, .34, .5, 1.6, 0x6a5a48, 5); b.cyl(.4, 1.3, 0, .18, .26, 1.4, 0x6a5a48, 4, 0, 0, -.7); b.ico(0, 3.0, 0, 2.1, 0x5a7a40, .7, 1.25); b.ico(1.5, 2.6, .5, 1.4, 0x62823f, .75); });
  TREE_LOW.coconut = mk(b => { b.cyl(0, 0, 0, .16, .2, 8, 0x9a7e5e, 3, 0, 0, -.18); b.ico(1.3, 8, 0, 2.2, 0x528e38, .3, 1.2); }, .05, false);
  TREE_LOW.banyan = mk(b => { b.cyl(0, 0, 0, .5, .7, 3, 0x7a6a58, 4); b.ico(0, 3.9, 0, 3.8, 0x3e6a30, .52, 1.3); }, .05, false);
  TREE_LOW.teak = mk(b => { b.cyl(0, 0, 0, .18, .25, 4.6, 0x8a7a68, 3); b.ico(0, 5.6, 0, 2.1, 0x5a7a34, .95, 1.1); }, .05, false);
  TREE_LOW.mango = mk(b => { b.cyl(0, 0, 0, .25, .32, 1.7, 0x4e3e30, 3); b.ico(0, 3.3, 0, 2.4, 0x2d5a2a, .82, 1.1); }, .05, false);
  TREE_LOW.acacia = mk(b => { b.cyl(0, 0, 0, .1, .15, 2.6, 0x6a5a46, 3); b.ico(0, 2.9, 0, 2.3, 0x7f8c48, .22, 1.2); }, .05, false);
  TREE_LOW.sycamore = mk(b => { b.cyl(0, 0, 0, .3, .4, 1.8, 0x6a5a48, 3); b.ico(0, 3.0, 0, 2.2, 0x5a7a40, .7, 1.25); }, .05, false);

  // ---------- shared motifs ----------
  // curvilinear North-Indian tower (also Burmese & Hoysala variants), base at y
  function shikharaTower(b, x, y, z, w, h, col, n = 9, ribbed = true) {
    for (let i = 0; i < n; i++) {
      const t = i / n, t2 = (i + 1) / n; const ww = w * (1 - .62 * Math.pow(t, 1.7)); const hh = h / n * (1.02 - t * .2);
      b.box(x, y, z, ww, hh + .02, ww, col);
      if (ribbed && ww > 1.1) for (const s of [-1, 1]) { b.box(x + s * ww * .5, y, z, .22, hh * .8, ww * .34, col); b.box(x, y, z + s * ww * .5, ww * .34, hh * .8, .22, col); }
      y += hh * (1 - .02 * t2);
    }
    const wt = w * .38; b.cyl(x, y, z, wt * .55, wt * .55, .25, col, 8); b.cyl(x, y + .25, z, wt * .78, wt * .78, .55, col, 16); b.cyl(x, y + .8, z, wt * .4, wt * .4, .25, col, 8);
    b.sphere(x, y + 1.35, z, wt * .32, C.gold, 7, 1.3); b.cone(x, y + 1.6, z, wt * .12, .9, C.gold, 5);
    return y + 2.5;
  }
  // stepped Dravidian vimana / gopuram tier with miniature roof-shrines
  function dravidaTier(b, x, y, z, w, d, h, col, accent) {
    b.box(x, y, z, w, h, d, col); b.box(x, y + h, z, w + .5, .28, d + .5, accent);
    const n = Math.max(2, Math.round(w / 2.2)); for (let k = 0; k < n; k++) { const xx = x + (k + .5 - n / 2) * (w / n); for (const s of [-1, 1]) { b.box(xx, y + h + .28, z + s * (d / 2 - .25), .9, .55, .7, col); b.dome(xx, y + h + .83, z + s * (d / 2 - .25), .38, accent, 6, .9); } }
  }
  // Burmese/Khmer/Thai stupa-like towers
  function bellStupa(b, x, y, z, s, col, gold) {
    for (let k = 0; k < 3; k++) { b.box(x, y, z, (6.4 - k * 1.2) * s, .9 * s, (6.4 - k * 1.2) * s, col); y += .9 * s; }
    b.cyl(x, y, z, 2.1 * s, 2.3 * s, .7 * s, col, 8); y += .7 * s;
    b.cyl(x, y, z, 1.9 * s, 2.15 * s, 1.2 * s, gold ? C.gold : col, 16); y += 1.2 * s;
    b.dome(x, y, z, 1.95 * s, gold ? C.gold : col, 16, 1.25); y += 2.2 * s;
    for (let k = 0; k < 6; k++) { b.cyl(x, y, z, (.75 - k * .1) * s, (.8 - k * .1) * s, .45 * s, gold ? C.gold : col, 10); y += .45 * s; }
    b.cone(x, y, z, .3 * s, 2.4 * s, C.gold, 8); b.cyl(x, y + 1.2 * s, z, .55 * s, .45 * s, .25 * s, C.gold, 8);
    return y + 2.4 * s;
  }
  function prangTower(b, x, y, z, w, h, col) {
    b.box(x, y, z, w, h * .38, w, col); for (const s of [-1, 1]) { b.box(x + s * w * .5, y, z, .5, h * .34, w * .5, col); b.box(x, y, z + s * w * .5, w * .5, h * .34, .5, col); }
    b.box(x, y, z + w * .5 + .25, w * .34, h * .26, .5, C.dark);
    y += h * .38; const n = 5;
    for (let k = 0; k < n; k++) { const t = k / n; const r = w * .55 * (1 - .55 * t) * (1 - .3 * t * t); const hh = h * .55 / n; b.cyl(x, y, z, r * .86, r, hh, col, 8, Math.PI / 8); b.cyl(x, y + hh * .8, z, r * .95, r * .95, hh * .2, col, 8, Math.PI / 8); y += hh; }
    b.cone(x, y, z, w * .14, h * .12, col, 8); return y + h * .12;
  }
  function chhatri(b, x, y, z, r, col) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl(x + sx * r * .7, y, z + sz * r * .7, .1, .12, r * 1.4, col, 5);
    b.box(x, y + r * 1.4, z, r * 1.9, .2, r * 1.9, col); b.dome(x, y + r * 1.6, z, r * .9, col, 10, .8); b.sphere(x, y + r * 2.4, z, .14, C.gold, 5);
  }

  // ---------- houses ----------
  const house0 = house;
  house = function (b, cul, rng, cityId, W0, D0) {
    if (cul === 'yemen') {
      const w = W0 || 3.2 + rng() * 1.4, d = D0 || 3.2 + rng() * 1.4; const fl = 2 + Math.floor(rng() * 3); const h = fl * 2.5;
      const mud = pick(rng, [0xb8946a, 0xa98560, 0xc4a27a, 0x9c7c5c]); const base = rng() < .5 ? C.basalt : 0x8a7a68;
      b.box(0, 0, 0, w, 2.4, d, base); b.box(0, 2.4, 0, w * .98, h - 2.4, d * .98, mud);
      for (let f = 0; f < fl; f++) { const y = 1 + f * 2.5; const n = Math.max(1, Math.round(w / 1.4));
        for (let k = 0; k < n; k++) { const x = (k + .5 - n / 2) * (w / n); b.box(x, y - .12, d / 2, .7, 1.25, .06, C.white); b.box(x, y, d / 2 + .02, .42, .95, .06, C.dark); if (f > 0) b.dome(x, y + 1.0, d / 2 + .03, .26, C.white, 6, .7); }
        if (f > 0) b.box(0, y - .5, 0, w + .08, .12, d + .08, C.white); }
      b.box(0, h, 0, w, .5, d, C.white); for (let k = -1; k <= 1; k++) for (const s of [-1, 1]) b.box(k * w * .33, h + .5, s * d * .48, .3, .4, .14, C.white);
      b.box(0, 0, d / 2 + .02, .9, 1.9, .06, 0x5a3a26); return Math.max(w, d) * .6;
    }
    if (cul === 'indian') {
      const w = W0 || 3.0 + rng() * 1.8, d = D0 || 3.0 + rng() * 1.6;
      if (!cityId || rng() < .35) { // mud & thatch village house with a verandah
        const wc = pick(rng, [0xc49a6a, 0xb98a5c, 0xd2ae84, 0xc8a07a]);
        b.box(0, 0, 0, w + .6, .35, d + .6, 0xa88a68); b.box(0, .35, 0, w, 2.0, d, wc); b.box(0, .35, d / 2 + .02, .8, 1.6, .06, C.dark);
        b.box(0, 0.35, 0, w + .1, .3, d + .1, 0xe8e0d0);
        b.hip(0, 2.3, 0, w + 1.6, 1.6, d + 1.6, C.thatch, 0, .1);
        for (const sx of [-1, 1]) b.cyl(sx * (w / 2 + .5), .35, d / 2 + .6, .07, .08, 1.9, C.woodD, 4);
        return Math.max(w, d) * .65;
      }
      const two = rng() < .6; const h = two ? 5.2 : 2.9; const wc = pick(rng, [0xe6dccb, 0xdcc8a6, 0xd9b48a, 0xe8d6b8, 0xc9946a, 0xd8b0a0]);
      b.box(0, 0, 0, w, h, d, wc); b.box(0, 0, d / 2 + .02, .9, 1.9, .06, 0x6a4028); b.box(0, 1.95, d / 2 + .04, 1.1, .18, .08, 0x8a5a36);
      if (two && rng() < .7) { b.box(0, 3.0, d / 2 + .35, w * .45, 1.2, .7, wc); b.box(0, 3.0, d / 2 + .72, w * .36, .8, .05, C.dark); b.dome(0, 4.2, d / 2 + .35, w * .2, wc, 8, .45); }
      else { const n = Math.max(1, Math.round(w / 1.6)); for (let k = 0; k < n; k++) b.box((k + .5 - n / 2) * (w / n), h - 1.4, d / 2 + .02, .45, .7, .06, C.dark); }
      b.box(0, h, 0, w + .1, .35, d + .1, wc); for (let k = -1; k <= 1; k++) b.box(k * w * .35, h + .35, d / 2, .4, .35, .15, wc);
      if (rng() < .18) chhatri(b, w * .3, h + .35, -d * .2, .6, wc);
      return Math.max(w, d) * .6;
    }
    if (cul === 'sea') {
      const w = W0 || 3.2 + rng() * 1.6, d = D0 || 3.4 + rng() * 1.6; stilt(b, w, d, rng); return Math.max(w, d) * .7;
    }
    return house0(b, cul, rng, cityId, W0, D0);
  };
  function stilt(b, w, d, rng) {
    const ph = 1.5 + rng() * .5; const wc = pick(rng, [C.bamboo, 0xb8946a, 0xa88a5e, 0xd2b48a]);
    for (const sx of [-1, 0, 1]) for (const sz of [-1, 1]) b.cyl(sx * (w / 2 - .2), 0, sz * (d / 2 - .2), .09, .11, ph + .1, C.woodD, 4);
    b.box(0, ph, 0, w + .5, .2, d + .9, 0x7a5a3a); b.box(0, ph + .2, -.2, w, 2.0, d - .4, wc);
    b.box(0, ph + .2, (d - .4) / 2 - .19, .7, 1.5, .06, C.dark);
    const roof = rng() < .7 ? C.thatch : 0x6a5a40; b.gable(0, ph + 2.2, -.2, w + 1.1, 2.4, d + .6, roof, Math.PI / 2);
    for (let k = 0; k < 5; k++) b.box(0, k * ph / 5 + .15, d / 2 + .5 + (5 - k) * .12, .7, .06, .14, C.wood);
  }

  // ---------- city building types ----------
  CB.haveli = (b, w, d, rng, cul) => {
    const wc = pick(rng, [0xd9b48a, 0xe6d3b3, 0xc9946a, 0xe8dcc8, 0xd8b0a0]); const H = 5.6 + rng() * 1.6; const t = Math.min(w, d) * .28;
    b.box(0, 0, d / 2 - t / 2, w, H, t, wc); b.box(0, 0, -d / 2 + t / 2, w, H * .9, t, wc);
    for (const sx of [-1, 1]) b.box(sx * (w / 2 - t * .4), 0, 0, t * .8, H * .9, d - 2 * t, wc);
    b.box(0, 0, d / 2 + .02, 1.1, 2.2, .06, 0x5a3a26); b.box(0, 2.2, d / 2 + .05, 1.5, .25, .08, 0x8a5a36);
    const nj = Math.max(1, Math.round(w / 3.8)); for (let k = 0; k < nj; k++) { const x = (k + .5 - nj / 2) * (w / nj); if (Math.abs(x) < .9) continue; b.box(x, 3.0, d / 2 + .4, 1.5, 1.4, .8, wc); b.box(x, 3.3, d / 2 + .81, 1.1, .9, .05, C.dark); b.dome(x, 4.4, d / 2 + .4, .8, wc, 8, .5); b.box(x, 2.85, d / 2 + .4, 1.7, .15, 1, 0x8a5a36); }
    b.box(0, H, d / 2 - t / 2, w + .1, .4, t + .1, wc); for (let k = 0; k < Math.round(w / 1.2); k++) b.box(-w / 2 + .6 + k * 1.2, H + .4, d / 2, .45, .4, .16, wc);
    if (rng() < .4) chhatri(b, w / 2 - t * .5, H + .4, d / 2 - t * .5, .7, wc);
  };
  CB.towerHouse = (b, w, d, rng) => {
    const n = w > 8 && rng() < .6 ? 2 : 1;
    for (let k = 0; k < n; k++) { const ww = n === 2 ? w * .46 : w * .78, dd = d * .8; b.push(n === 2 ? (k - .5) * w * .5 : 0, 0, 0, 0); house(b, 'yemen', rng, 'c', ww, dd); b.pop(); }
    b.box(0, 0, d / 2 - .2, w, 1.6, .35, pick(rng, [0xb8946a, 0xa98560]));
  };
  CB.stiltHouse = (b, w, d, rng) => { stilt(b, w * .86, d * .86, rng); };
  CB.stiltCompound = (b, w, d, rng) => {
    const fc = 0x9a8058; for (const s of [-1, 1]) { b.box(0, 0, s * d / 2, w, 1.1, .12, fc); b.box(s * w / 2, 0, 0, .12, 1.1, d, fc); }
    b.push(-w * .18, 0, -d * .12, 0); stilt(b, Math.min(5, w * .42), Math.min(5.5, d * .5), rng); b.pop();
    b.push(w * .24, 0, d * .1, Math.PI / 2); stilt(b, 3.2, 3.4, rng); b.pop();
    b.cyl(w * .28, 0, -d * .3, .9, .9, 1.4, C.thatch, 8); b.cone(w * .28, 1.4, -d * .3, 1.2, 1.2, C.thatch, 8);
  };

  // ---------- civic buildings ----------
  CIVIC.hinduTemple = (b, rng, cul) => {
    const col = pick(rng, [0xd2b48c, 0xc9a07a, 0xe0caa4, 0xbfa58a]);
    b.box(0, 0, 0, 7, 1, 9.5, col); b.box(0, 1, 2, 4.6, 2.6, 4.2, col);
    for (const sx of [-1, 1]) for (const sz of [0, 1]) b.cyl(sx * 2, 1, 4 + sz * -1.6, .2, .22, 2.6, col, 6);
    b.pyramid(0, 3.6, 2, 5.2, 1.8, col); b.box(0, 1, -2, 4, 3, 4, col); b.box(0, 1, 4.11, 1, 1.9, .06, C.dark);
    shikharaTower(b, 0, 4, -2, 3.8, 6.5, col, 7); b.cyl(1.8, 1, 4.6, .05, .06, 5, C.woodD, 4); b.box(2.2, 5.3, 4.6, .8, .5, .03, 0xd85a1a);
    return 4.8;
  };
  CIVIC.mandapa = (b, rng) => {
    const col = pick(rng, [0xcdb490, 0xbfa07a]); b.box(0, 0, 0, 7.6, .9, 7.6, col);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) b.box(-2.7 + i * 1.8, .9, -2.7 + j * 1.8, .45, 3, .45, col);
    b.box(0, 3.9, 0, 7.4, .45, 7.4, col); b.box(0, 4.35, 0, 5.4, .5, 5.4, col); for (const sx of [-1, 1]) for (const sz of [-1, 1]) chhatri(b, sx * 2.9, 4.35, sz * 2.9, .45, col);
    return 4.2;
  };
  CIVIC.wat = (b, rng) => {
    const w = 0xefe6d2; b.box(0, 0, 0, 7.6, .9, 11, 0xd8ccb4); b.box(0, .9, 0, 5.6, 3.2, 9, w);
    for (let k = 0; k < 5; k++) for (const sx of [-1, 1]) b.cyl(sx * 3.3, .9, -4 + k * 2, .22, .25, 3.1, w, 6);
    b.gable(0, 4.0, 0, 7.6, 2.6, 10.6, 0xb5523b, Math.PI / 2); b.gable(0, 5.6, -.3, 5.4, 2.2, 8.2, 0x3f7a4a, Math.PI / 2);
    for (const s of [-1, 1]) b.cone(0, 7.6, s * 4.1, .12, 1.0, C.gold, 4, 0, s * .5); b.box(0, .9, 4.51, 1.2, 2.2, .06, 0x8a2a1a);
    return 5.8;
  };
  CIVIC.zedi = (b, rng) => { const gold = rng() < .35; bellStupa(b, 0, 0, 0, .8, gold ? 0xefe6d2 : 0xb8734a, gold); return 3; };

  // ---------- walls ----------
  const wallStyle0 = wallStyle;
  wallStyle = function (cul, cityId) {
    if (cul === 'yemen') return { h: 5, t: 1.3, c: 0xb08c64, tower: 'round', th: 6.4, merl: true };
    if (cul === 'indian') return { h: 5.6, t: 1.5, c: cityId === 'delhi' || cityId === 'lahore' ? 0xb9876a : 0xbfa686, tower: 'round', th: 6.8, merl: true };
    if (cul === 'sea') return { h: 4.6, t: 1.6, c: cityId === 'angkor' || cityId === 'lavo' ? C.laterite : 0xa86a48, tower: 'sq', th: 5.0, merl: false };
    return wallStyle0(cul, cityId);
  };

  // ---------- tweaks to existing landmarks ----------
  { const col0 = LM.column; LM.column = (b, p) => {
      if (p.color === 'iron') { b.box(0, 0, 0, 3, .5, 3, 0xcfc4ad); b.cyl(0, .5, 0, .38, .42, p.h, 0x4a3a32, 10); b.cyl(0, .5 + p.h, 0, .6, .45, .9, 0x4a3a32, 10); return { r: 2.2 }; }
      if (p.color === 'granite') { b.box(0, 0, 0, 4.4, 3.2, 4.4, 0xb08070); b.cyl(0, 3.2, 0, 1.1, 1.25, p.h, 0xa05a50, 14); b.box(0, 3.2 + p.h, 0, 3, 1.1, 3, 0xa05a50); return { r: 3.4 }; }
      return col0(b, p); }; }
  { const t0 = LM.tower; LM.tower = (b, p) => {
      p = Object.assign({ r: 2.4, h: 10 }, p);
      if (p.style === 'jain') { const c = 0xe2d6bc; let y = 0; for (let k = 0; k < 7; k++) { const s = 4.2 - k * .25; b.box(0, y, 0, s, 2.6, s, c); b.box(0, y + 2.4, 0, s + 1.1, .25, s + 1.1, c); y += 2.65; } chhatri(b, 0, y, 0, 1.4, c); return { r: 3.4 }; }
      return t0(b, p); }; }
  { const p0 = LM.pavilion; LM.pavilion = (b, p, rng, cul) => {
      if (p.onePillar) { b.box(0, -.1, 0, 10, .3, 10, C.water); for (const s of [-1, 1]) { b.box(s * 5, 0, 0, .6, .6, 10.6, 0xa8a294); b.box(0, 0, s * 5, 10.6, .6, .6, 0xa8a294); }
        b.cyl(0, 0, 0, .55, .65, 3.2, 0x9c968a, 10); b.box(0, 3.1, 0, 2.6, .3, 2.6, 0x7a4a2a); b.box(0, 3.4, 0, 3, 2.2, 3, 0xa8352a); b.hip(0, 5.5, 0, 4.6, 1.8, 4.6, C.croof, 0, .45); b.box(0, 0, 3.6, 1.2, 2.6, 2.6, 0x9c968a); return { r: 5.6 }; }
      return p0(b, p, rng, cul); }; }
  { const g0 = LM.gate; LM.gate = (b, p, rng, cul) => {
      if (p.faces) { const c = C.khmer; const cols = [];
        for (const sx of [-1, 1]) { b.box(sx * 10, 0, 0, 14, 7, 2.6, C.laterite); cols.push({ seg: [sx * 3.4, 0, sx * 17, 0], r: 1.5 }); b.box(sx * 3.4, 0, 0, 2.6, 9, 4, c); }
        b.box(0, 7.2, 0, 9.4, 2.2, 4.2, c); b.box(0, 9.4, 0, 5, 3.4, 5, c);
        for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; const fx = Math.sin(a) * 2.55, fz = Math.cos(a) * 2.55; b.push(fx, 10.2, fz, a); b.box(0, 1.4, 0, 2.6, .25, .2, 0x6a645c); b.box(-.55, 1.0, 0, .5, .14, .18, 0x3a342e); b.box(.55, 1.0, 0, .5, .14, .18, 0x3a342e); b.box(0, .4, .05, .4, .7, .2, c); b.box(0, .05, .02, .9, .15, .18, 0x5a544c); b.pop(); }
        prangTower(b, 0, 12.8, 0, 3.6, 6, c); return { colliders: cols, onRoad: true }; }
      return g0(b, p, rng, cul); }; }
  { const s0 = LM.stupa; LM.stupa = (b, p, rng) => {
      if (p.eyes) { const s = 1.6; b.push(0, 0, 0, 0, s); b.cyl(0, 0, 0, 5, 5.4, 1, 0xe8e2d6, 16); b.dome(0, 1, 0, 4.4, C.twhite, 16, .75); b.box(0, 4.2, 0, 2.2, 1.6, 2.2, C.gold);
        for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; b.push(Math.sin(a) * 1.12, 4.7, Math.cos(a) * 1.12, a); b.box(-.45, 0, 0, .55, .22, .05, 0x1e2a50); b.box(.45, 0, 0, .55, .22, .05, 0x1e2a50); b.box(0, -.4, 0, .16, .4, .05, 0x1e2a50); b.pop(); }
        for (let k = 0; k < 13; k++) b.cyl(0, 5.8 + k * .4, 0, .95 - k * .055, 1.0 - k * .055, .3, C.gold, 10); b.cone(0, 11, 0, .9, .7, C.gold, 10); b.pop(); return { r: 5.4 * s }; }
      return s0(b, p, rng); }; }
  { const pg0 = LM.pagoda; LM.pagoda = (b, p, rng, cul) => { if (p.color === 'red') p = Object.assign({}, p, { color: 'brick' }); const r = pg0(b, p, rng, cul); return r; }; }

  // ---------- new landmarks ----------
  LM.pyramids = (b) => {
    const sc = 0xd8c39a, cap = 0xece0c4;
    const pyr = (x, z, w, h, casing) => { b.pyramid(x, 0, z, w, h, sc); for (let k = 1; k < 9; k++) b.box(x, k * h / 10 - .05, z, w * (1 - k / 10) + .05, .1, w * (1 - k / 10) + .05, 0xc8b38a); if (casing) b.pyramid(x, h * .82, z, w * .18, h * .18, cap); };
    pyr(0, 0, 54, 34, false); pyr(-44, -40, 50, 33, true); pyr(-78, -72, 24, 15, false);
    for (let k = 0; k < 3; k++) pyr(30, -14 + k * 11, 8, 5, false);
    // the Sphinx, buried to its shoulders
    b.push(34, 0, 20, -Math.PI / 4); b.box(0, 0, -4, 5.5, 4.2, 14, 0xc9ab7a); b.box(0, 3.6, 3.4, 4.2, 4.2, 3.8, 0xc9ab7a); b.box(0, 4.2, 5.2, 3, 2.8, 1.4, 0xbe9f70);
    for (const s of [-1, 1]) { b.box(s * 1.6, 0, 6.4, 1.6, 1.2, 5, 0xc9ab7a); b.box(s * 2.15, 4.4, 3.8, .3, 3.4, 2.2, 0xbe9f70); }
    b.box(0, 0, -2, 12, .5, 22, 0xd2b98e); b.pop();
    return { r: 34, fp: 36, colliders: [{ c: [0, 0], r: 28 }, { c: [-44, -40], r: 26 }, { c: [-78, -72], r: 13 }, { c: [30, -3], r: 9 }, { c: [34, 20], r: 7 }] };
  };
  LM.pharos = (b) => {
    for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2; b.dodec(Math.cos(a) * 9, -.5, Math.sin(a) * 9, 2 + (k % 3) * .6, 0x9a9488, .6); }
    b.box(0, 0, 0, 16, 2, 16, 0xcfc4ad); b.box(0, 2, 0, 11, 22, 11, 0xdcd2bc); for (let y = 4; y < 22; y += 3.2) for (let k = -1; k <= 1; k++) for (const s of [-1, 1]) { b.box(k * 3, y, s * 5.52, .6, 1.2, .06, C.dark); b.box(s * 5.52, y, k * 3, .06, 1.2, .6, C.dark); }
    b.box(0, 24, 0, 12, .7, 12, 0xd2c8b2); b.cyl(0, 24.7, 0, 3.8, 4.2, 10, 0xd8cdb6, 8, Math.PI / 8); b.cyl(0, 34.7, 0, 4.5, 4.5, .5, 0xd2c8b2, 8, Math.PI / 8);
    b.cyl(0, 35.2, 0, 2, 2.3, 2.6, 0xd8cdb6, 12); b.dome(0, 37.8, 0, 2, 0xd8cdb6, 12, .9);
    return { r: 10 };
  };
  LM.spiralMinaret = (b) => {
    const wc = 0xc9b48e, S = 34, cols = [];
    for (const [x, z, w, d] of [[0, -S / 2, S, 1.4], [-S / 2, 0, 1.4, S], [S / 2, 0, 1.4, S], [-S * .32, S / 2, S * .36, 1.4], [S * .32, S / 2, S * .36, 1.4]]) { b.box(x, 0, z, w, 6.5, d, wc); for (let k = 0; k < Math.max(w, d) / 1.6; k++) b.box(x + (w > d ? -w / 2 + .8 + k * 1.6 : 0), 6.5, z + (w > d ? 0 : -d / 2 + .8 + k * 1.6), .7, .6, .7, wc); }
    for (let k = -6; k <= 6; k++) { if (Math.abs(k) < 2) continue; b.box(k * 2.4, 1, S / 2 + .72, 1.2, 3.6, .06, C.dark); }
    cols.push({ seg: [-S / 2, -S / 2, S / 2, -S / 2], r: 1 }, { seg: [-S / 2, -S / 2, -S / 2, S / 2], r: 1 }, { seg: [S / 2, -S / 2, S / 2, S / 2], r: 1 }, { seg: [-S / 2, S / 2, -S * .14, S / 2], r: 1 }, { seg: [S * .14, S / 2, S / 2, S / 2], r: 1 });
    b.box(0, 0, -S / 2 + 4, S - 3, 6.2, 6, 0xd2bf9a); b.dome(0, 0, 0, 2.6, 0xc9b48e, 10, 1.2); b.cyl(0, 0, 0, 3, 3, .5, 0xbfa77d, 12);
    // the minaret with its outside spiral stair
    const mx = 0, mz = -S / 2 - 9; b.box(mx, 0, mz, 7, 11, 7, wc); b.cyl(mx, 11, mz, 2.6, 3.2, 10, wc, 14);
    for (let k = 0; k < 40; k++) { const a = k * .42, y = 11 + k * .25; b.box(mx + Math.cos(a) * 3.15, y, mz + Math.sin(a) * 3.15, 1.4, .3, .9, 0xbfa77d, -a); }
    b.cyl(mx, 21, mz, 1.7, 1.9, 3.5, wc, 8, Math.PI / 8); b.cyl(mx, 24.5, mz, 1.2, 1.4, 1.8, wc, 8); b.dome(mx, 26.3, mz, 1.2, wc, 8, 1.4);
    cols.push({ c: [mx, mz], r: 5 });
    return { r: S / 2 + 3, colliders: cols };
  };
  LM.domeRock = (b) => {
    b.box(0, 0, 0, 30, 1.4, 30, 0xd8ccb4); for (const s of [-1, 1]) { for (let k = -2; k <= 2; k++) { b.box(k * 2, 1.4, s * 14, .5, 3, .5, 0xd8ccb4); } b.box(0, 4.4, s * 14, 10.5, .7, .6, 0xd8ccb4); }
    b.cyl(0, 1.4, 0, 8.4, 8.4, 3.2, 0xe9e4d8, 8, Math.PI / 8); b.cyl(0, 4.6, 0, 8.4, 8.4, 3.4, 0x2c5fa8, 8, Math.PI / 8); b.cyl(0, 8.0, 0, 8.7, 8.7, .4, 0x3a8a9a, 8, Math.PI / 8);
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; b.box(Math.cos(a) * 8.2, 1.4, Math.sin(a) * 8.2, 1.2, 2.6, .1, C.dark, -a + Math.PI / 2); }
    b.cyl(0, 8.4, 0, 4.5, 4.5, 3.2, 0x2c5fa8, 16); b.dome(0, 11.6, 0, 4.6, C.gold, 18, 1.15); b.cyl(0, 16.8, 0, .1, .12, 1.6, C.gold, 5); b.sphere(0, 18.3, 0, .35, C.gold, 6);
    return { r: 15, colliders: [{ c: [0, 0], r: 8.6 }] };
  };
  LM.haram = (b) => {
    const W2 = 18, D2 = 15, ac = 0xe6dcc8, cols = [];
    const side = (x0, z0, x1, z1) => { const L = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(z1 - z0, x1 - x0); const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2; b.box(mx, 0, mz, L, 4.6, 3.4, ac, -a); for (let k = 0; k < L / 2.2; k++) { const t = -L / 2 + 1.1 + k * 2.2; b.dome(mx + Math.cos(a) * t, 4.6, mz + Math.sin(a) * t, .9, ac, 8, .7); } cols.push({ seg: [x0, z0, x1, z1], r: 1.9 }); };
    for (const s of [-1, 1]) { side(-W2, s * D2, -2.4, s * D2); side(2.4, s * D2, W2, s * D2); side(s * W2, -D2, s * W2, -2.4); side(s * W2, 2.4, s * W2, D2); }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const x = sx * (W2 + .4), z = sz * (D2 + .4); b.cyl(x, 0, z, .75, .85, 14, ac, 10); b.cyl(x, 10, z, 1.2, 1.1, .4, ac, 10); b.cyl(x, 14, z, .55, .6, 2.2, ac, 10); b.cone(x, 16.2, z, .6, 1.6, ac, 10); cols.push({ c: [x, z], r: 1 }); }
    b.box(0, 0, 0, W2 * 2 - 6, .1, D2 * 2 - 6, 0xefeae0);
    b.box(0, 0, 0, 5.2, 6.2, 5.8, C.kiswa); b.box(0, 4.1, 0, 5.3, .55, 5.9, 0xc9a23a); b.box(1.2, .9, 2.91, 1.1, 2.1, .06, 0xc9a23a);
    b.cyl(0, 0, 0, 7.5, 7.5, .12, 0xd8d0c0, 24); b.box(-1.5, 0, 5.2, 1, 1.8, 1, 0xd8c9a0); b.dome(-1.5, 1.8, 5.2, .6, C.gold, 8);
    cols.push({ c: [0, 0], r: 3.9 });
    return { r: W2 + 2, colliders: cols };
  };
  LM.rockFacade = (b, p, rng) => {
    if (p.style === 'hegra') {
      const cols = []; const outs = [[-14, 0, 9, 8], [6, -6, 12, 10], [20, 8, 7, 7]];
      for (const [x, z, w, h] of outs) { b.dodec(x, h * .45, z, w * .62, 0xcda477, h / (w * .62) * .55, 1, rng() * 3); b.box(x, 0, z, w * .9, h * .7, w * .7, 0xc99c6c);
        const fz = z + w * .35 + .02; b.box(x, 1.2, fz, w * .42, h * .42, .3, 0xd8b088); b.box(x, 1.2, fz + .05, w * .14, h * .2, .3, C.dark);
        for (const s of [-1, 1]) b.box(x + s * w * .2, 1.2, fz + .1, .4, h * .42, .2, 0xe0bc94); for (let k = 0; k < 3; k++) for (const s of [-1, 1]) b.box(x + s * (w * .12 + k * .5), 1.2 + h * .42 + k * .45, fz, .45, .45, .3, 0xd8b088);
        cols.push({ c: [x, z], r: w * .55 }); }
      return { r: 26, colliders: cols };
    }
    const rc = 0xc07858;
    b.box(0, 0, 0, 34, 26, 12, rc); for (let k = 0; k < 7; k++) b.dodec(-15 + k * 5, 24 + (k % 2) * 2, (rng() - .5) * 6, 4 + rng() * 2, rc, .7, 1, rng() * 3);
    const fz = 6.05, fc = 0xd28a68;
    b.box(0, 0, fz, 14, 1, 1.2, fc); for (let k = 0; k < 6; k++) b.cyl(-5.5 + k * 2.2, 1, fz + .3, .45, .5, 8, fc, 10);
    b.box(0, 9, fz, 13.5, 1.2, 1, fc); b.gable(0, 10.2, fz, 6, 2.2, 1, fc); b.box(0, 1, fz - .1, 1.6, 4.6, .3, C.dark);
    b.box(0, 12.4, fz - .2, 13, 1, .8, fc); b.cyl(0, 13.4, fz - .1, 1.8, 1.8, 7, fc, 12); b.cone(0, 20.4, fz - .1, 1.9, 1.2, fc, 12); b.sphere(0, 22, fz - .1, .5, fc, 6, 1.4);
    for (const s of [-1, 1]) { b.box(s * 5.3, 13.4, fz - .2, 3, 7, .8, fc); b.gable(s * 5.3, 20.4, fz - .2, 3, 1, .8, fc); }
    return { r: 18, colliders: [{ seg: [-16, 0, 16, 0], r: 6.2 }] };
  };
  LM.towerCluster = (b, p, rng) => {
    const S = 26; const wc = 0xb08c64; for (const s of [-1, 1]) { b.box(0, 0, s * S / 2, S, 4, 1.2, wc); b.box(s * S / 2, 0, 0, 1.2, 4, S, wc); }
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) { if (i === 2 && j === 4) continue; const x = -S / 2 + 2.8 + i * 5.1 + (rng() - .5) * .4, z = -S / 2 + 2.8 + j * 5.1 + (rng() - .5) * .4; const w = 4 + rng() * .6, d = 4 + rng() * .6, fl = 5 + Math.floor(rng() * 4), h = fl * 2.3;
      const mud = pick(rng, [0xb8946a, 0xa98560, 0xc4a27a, 0xb08a62]); b.box(x, 0, z, w, h, d, mud); b.box(x, h - 1.4, z, w + .04, 1.4, d + .04, C.white);
      for (let f = 1; f < fl; f++) for (const s of [-1, 1]) { b.box(x - .8, f * 2.3 + .5, z + s * (d / 2 + .02), .4, .8, .05, C.dark); b.box(x + .8, f * 2.3 + .5, z + s * (d / 2 + .02), .4, .8, .05, C.dark); } }
    return { r: S / 2 + 1, colliders: [{ c: [0, 0], r: S / 2 }] };
  };
  LM.karnak = (b, p, rng) => {
    const sc = 0xd2b98a, cols = [];
    for (const s of [-1, 1]) { b.box(s * 8, 0, 14, 11, 15, 4.5, sc); b.box(s * 8, 15, 14, 11.6, .8, 5, 0xc8ae80); cols.push({ seg: [s * 3, 14, s * 13.5, 14], r: 2.4 }); }
    for (let i = 0; i < 4; i++) for (let j = 0; j < 5; j++) { const x = -6 + i * 4, z = 8 - j * 4.5; if (rng() < .12) { b.cyl(x + 2, 0, z, 1.1, 1.1, 8, sc, 10, rng(), 0, Math.PI / 2); continue; } const h = 9 + (i === 1 || i === 2 ? 3 : 0);
      b.cyl(x, 0, z, 1.05, 1.2, h, sc, 12); b.cyl(x, h, z, 1.6, 1.1, 1.3, 0xc8ae80, 12); b.box(x, h + 1.3, z, 2.4, .6, 2.4, sc); cols.push({ c: [x, z], r: 1.3 }); }
    for (let j = 0; j < 5; j++) if (rng() < .6) b.box(0, 13.2, 8 - j * 4.5, 13, 1, 2, sc);
    for (const s of [-1, 1]) { b.box(s * 3.2, 0, -16, 1.2, 15, 1.2, 0xc9a37a); b.pyramid(s * 3.2, 15, -16, 1.2, 1.4, C.gold); cols.push({ c: [s * 3.2, -16], r: 1 }); }
    for (let k = 0; k < 8; k++) b.box((rng() - .5) * 26, 0, (rng() - .5) * 30, 1.6 + rng() * 2, 1 + rng(), 1.4 + rng(), sc, rng() * 3);
    return { r: 20, colliders: cols };
  };
  LM.qutb = (b) => {
    const H = [12, 9, 8, 5.5, 4.5]; let y = 0, r = 3.6;
    b.box(0, 0, 0, 9.5, .8, 9.5, 0xb88a6a); y = .8;
    for (let s = 0; s < 5; s++) { const r1 = r * .86, c = s < 3 ? 0xb05e3e : (s === 3 ? 0xe9e4d8 : 0xc87a5a);
      b.cyl(0, y, 0, r1, r, H[s], c, 24); const n = 16; for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; if (s === 1 && k % 2) b.box(Math.cos(a) * r * .93, y, Math.sin(a) * r * .93, .5, H[s], .5, c, -a + Math.PI / 4); else b.cyl(Math.cos(a) * r * .92, y, Math.sin(a) * r * .92, .3, .34, H[s], c, 6); }
      for (const yy of [H[s] * .3, H[s] * .6]) b.cyl(0, y + yy, 0, r * .98, r * 1.0, .4, 0xd8c8a8, 24);
      y += H[s]; b.cyl(0, y, 0, r1 + .9, r1 + .4, .5, 0xd8c8a8, 20); for (let k = 0; k < 20; k++) { const a = k / 20 * Math.PI * 2; b.box(Math.cos(a) * (r1 + .75), y + .5, Math.sin(a) * (r1 + .75), .1, .6, .1, 0x8a6a50); } r = r1;
    }
    chhatri(b, 0, y + .2, 0, 1, 0xe0d0b4);
    return { r: 5.2 };
  };
  LM.stepwell = (b) => {
    const st = 0xc9b48a, L = 30, Wd = 10, H = 4.4, cols = [];
    for (const s of [-1, 1]) { b.box(s * (Wd / 2 + 1.6), 0, 0, 3.2, H, L, st); cols.push({ seg: [s * (Wd / 2 + 1.6), -L / 2, s * (Wd / 2 + 1.6), L / 2], r: 1.7 }); for (let k = 0; k < 12; k++) b.box(s * (Wd / 2 + .02), .8 + (k % 3) * 1.2, -L / 2 + 1.5 + k * 2.4, .1, .8, .9, 0xa89068); }
    b.box(0, 0, -L / 2 - 2, Wd + 6.4, H + 2.4, 4, st); cols.push({ seg: [-Wd / 2 - 3, -L / 2 - 2, Wd / 2 + 3, -L / 2 - 2], r: 2.1 });
    const steps = 12; for (let k = 0; k < steps; k++) { const z = L / 2 - (k + .5) * (L * .7 / steps); b.box(0, 0, z, Wd, H * (1 - k / steps), L * .7 / steps + .02, k % 2 ? st : 0xbfa77d); }
    b.box(0, 0, -L / 2 + L * .15, Wd, .28, L * .3, C.water);
    for (let k = 1; k < 4; k++) { const z = L / 2 - k * L * .7 / 4; for (const s of [-1, 1]) b.box(s * (Wd / 2 - .4), H * (1 - k / 4), z, .5, H * k / 4 + 1.6, .5, st); b.box(0, H + 1.6, z, Wd, .4, 1.4, st); }
    return { r: L / 2 + 3, colliders: cols };
  };
  LM.shikhara = (b, p, rng) => {
    const style = p.style || 'nagara';
    if (style === 'dravida') { const h = p.h || 20, w = h * .55; const c = 0xc8b08a, acc = 0xb59a74; b.box(0, 0, 0, w + 8, 1.2, w + 14, 0xbfa783); b.box(0, 1.2, w * .5 + 3, w * .7, 4.5, 6, c); b.pyramid(0, 5.7, w * .5 + 3, w * .75, 1.4, acc);
      b.box(0, 1.2, 0, w, h * .3, w, c); for (const s of [-1, 1]) for (let k = -1; k <= 1; k++) { b.box(s * (w / 2 + .05), 2.2, k * w * .3, .3, h * .24, w * .16, acc); b.box(k * w * .3, 2.2, s * (w / 2 + .05), w * .16, h * .24, .3, acc); }
      let y = 1.2 + h * .3, ww = w; const nt = Math.max(3, Math.round(h / 4.5)); for (let k = 0; k < nt; k++) { const th = h * .55 / nt; ww *= .86; dravidaTier(b, 0, y, 0, ww, ww, th * .7, c, acc); y += th; }
      b.cyl(0, y, 0, ww * .32, ww * .4, 1, c, 8, Math.PI / 8); b.dome(0, y + 1, 0, ww * .42, acc, 8, 1.1); b.sphere(0, y + 1 + ww * .46, 0, .4, C.gold, 6, 1.6);
      return { r: (w + 14) * .55 }; }
    if (style === 'hoysala') { const c = C.soap; for (const ox of [-6.5, 6.5]) { b.cyl(ox, 0, 0, 6, 6, 1.4, 0x7a7266, 16); b.cyl(ox, 1.4, 0, 4.8, 4.8, 3.6, c, 16); for (let k = 0; k < 3; k++) b.cyl(ox, 1.8 + k * 1.1, 0, 4.95, 4.95, .35, 0x8a8274, 16); b.cyl(ox, 5, 0, 5.2, 5.2, .6, 0x7a7266, 16);
        let y = 5.6, r = 3.6; for (let k = 0; k < 4; k++) { b.cyl(ox, y, 0, r * .85, r, 1.4, c, 16); y += 1.4; r *= .78; } b.sphere(ox, y + .4, 0, .6, C.gold, 6, 1.4); }
      b.box(0, 0, 0, 8, 4.6, 6, c); b.box(0, 0, 3.01, 1.2, 2.4, .06, C.dark); return { r: 13 }; }
    if (style === 'mahabodhi') { const c = 0xcdb28a; b.box(0, 0, 0, 18, 1.6, 18, 0xbfa783); b.box(0, 1.6, 0, 11, 7, 11, c); let y = 8.6, w = 9.6;
      for (let k = 0; k < 9; k++) { b.box(0, y, 0, w, 3, w, c); for (const s of [-1, 1]) { b.box(s * w / 2, y + .8, 0, .1, 1.3, 1, C.dark); b.box(0, y + .8, s * w / 2, 1, 1.3, .1, C.dark); } y += 3; w *= .9; }
      b.cyl(0, y, 0, 1.6, 1.6, 1, c, 16); b.cyl(0, y + 1, 0, .3, .3, 2.6, C.gold, 6); for (const sx of [-1, 1]) for (const sz of [-1, 1]) shikharaTower(b, sx * 6.8, 1.6, sz * 6.8, 2.6, 7, c, 6, false);
      b.box(0, 1.6, 5.6, 4, 4.2, 2.2, c); b.box(0, 1.6, 6.71, 1.4, 2.8, .05, C.dark); return { r: 10 }; }
    const jain = style === 'jain'; const c = jain ? 0xefeae0 : pick(rng, [0xd2b48c, 0xc9a07a, 0xd8b896]); const S = jain ? 1 : 1.2;
    b.push(0, 0, 0, 0, S);
    b.box(0, 0, 0, 12, 1.6, 18, c); for (let k = 0; k < 3; k++) b.box(0, .3 + k * .45, 9.01, 12, .14, .05, 0xa88a68);
    b.box(0, 1.6, 4.5, 8, 4, 7, c); for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) b.cyl(sx * 3.6, 1.6, 2 + k * 2.4, .3, .32, 4, c, 8);
    b.pyramid(0, 5.6, 4.5, 8.4, 3, c); for (let k = 0; k < 3; k++) b.pyramid(0, 6 + k * .9, 4.5, 6.5 - k * 1.8, .9, c); b.sphere(0, 9.3, 4.5, .45, C.gold, 6);
    b.box(0, 1.6, -3, 6.4, 5, 6.4, c); b.box(0, 1.6, 8.01, 1.4, 2.8, .06, C.dark);
    shikharaTower(b, 0, 6.6, -3, 5.6, 11, c, 9);
    for (const sx of [-1, 1]) shikharaTower(b, sx * 3.1, 4.6, -3, 2.2, 5, c, 5, false);
    if (jain) for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; const x = Math.cos(a) * 9.5, z = Math.sin(a) * 11 - 1; b.box(x, 0, z, 2.2, 2.4, 2.2, c); b.pyramid(x, 2.4, z, 2.4, 1.6, c); }
    b.pop();
    return { r: (jain ? 13 : 11) * S };
  };
  LM.gopuram = (b, p) => {
    const tiers = p.tiers || 7, c = 0xe2d2b0, acc = 0xc9a274, st = 0xc8b494; const w0 = 12 + tiers * .8, d0 = 7 + tiers * .3, cols = [];
    for (const s of [-1, 1]) { b.box(s * (w0 / 4 + 1.1), 0, 0, w0 / 2 - 2.2, 7, d0, st); cols.push({ seg: [s * 2.2, 0, s * (w0 / 2), 0], r: d0 / 2 }); b.box(s * (w0 / 2 + 9), 0, 0, 18, 5, 1.6, st); cols.push({ seg: [s * w0 / 2, 0, s * (w0 / 2 + 18), 0], r: 1 }); }
    b.box(0, 5.4, 0, 4.4, 1.6, d0, st);
    let y = 7, w = w0, d = d0; const th = 2.2;
    for (let k = 0; k < tiers; k++) { dravidaTier(b, 0, y, 0, w, d, th, k % 2 ? c : 0xe8d8b8, acc); y += th + .3; w *= .88; d *= .9; }
    b.cyl(w / 2, y, 0, d * .42, d * .42, w, c, 10, 0, 0, Math.PI / 2); for (let k = 0; k < 7; k++) { const x = -w / 2 + .6 + k * (w - 1.2) / 6; b.cone(x, y + d * .42 - .1, 0, .22, 1.3, C.gold, 6); }
    // the shrine behind the gate
    b.box(0, 0, -16, 10, 1, 10, st); b.box(0, 1, -16, 6, 6, 6, st); let yy = 7, ww = 6; for (let k = 0; k < 3; k++) { ww *= .84; dravidaTier(b, 0, yy, -16, ww, ww, 1.6, c, acc); yy += 1.9; } b.dome(0, yy, -16, ww * .45, C.gold, 8, 1);
    cols.push({ c: [0, -16], r: 5 });
    return { r: w0 / 2 + 4, colliders: cols };
  };
  LM.ghat = (b, p, rng) => {
    const st = 0xcdb894; for (let k = 0; k < 6; k++) b.box(0, 0, -6 + k * 1.6, 32, 4 - k * .65, 1.62, k % 2 ? st : 0xc2ab86);
    b.box(0, 0, 8, 40, .15, 6, C.water); b.box(0, 0, -11, 34, 4, 8, st);
    for (const x of [-12, 0, 12]) { b.push(x, 4, -12, 0); shikharaTower(b, 0, 0, 0, 3.6, 6.5, st, 7); b.box(0, 0, 2.2, 3, 2.8, 1.6, st); b.pop(); }
    for (const x of [-6, 6]) chhatri(b, x, 4, -9, 1.3, 0xd9c6a2); for (let k = 0; k < 4; k++) { const x = -14 + k * 9; b.cyl(x, 4 - 2.6, 1.5, .05, .06, 3.2, C.woodD, 4); b.cone(x, 4 - 2.6 + 3, 1.5, 1.6, .5, pick(rng, [0xd85a1a, 0xe8b030, 0xc8402a]), 8); }
    return { r: 18, colliders: [{ seg: [-17, -11, 17, -11], r: 4 }] };
  };
  LM.zedi = (b, p, rng) => {
    const style = p.style || 'zedi';
    if (style === 'lotus') { const c = 0xd8cdb8; b.box(0, 0, 0, 12, 1, 12, 0xb8a888); let y = 1; for (let k = 0; k < 3; k++) { b.box(0, y, 0, 8 - k * 1.4, 1.2, 8 - k * 1.4, c); y += 1.2; } b.box(0, y, 0, 3.6, 4.5, 3.6, c); y += 4.5;
      b.cyl(0, y, 0, 2.2, 1.8, 1, c, 8); b.sphere(0, y + 2.6, 0, 2.2, c, 10, 1.45); b.cone(0, y + 5.6, 0, .7, 4, c, 8);
      for (let k = 0; k < 4; k++) { const z = 10 + k * 2.6; for (const s of [-1, 1]) b.cyl(s * 3.5, 0, z, .45, .5, 5, 0x9a8a78, 8); } b.box(0, 0, 9.5, 8, 1, 10, 0xb0a084);
      b.box(0, 1, 18.5, 2.6, 1.2, 1.6, c); b.sphere(0, 3.2, 18.5, 1.1, 0xd8cdb8, 8, 1.3); return { r: 10, colliders: [{ c: [0, 0], r: 6 }] }; }
    if (style === 'prang') { const c = C.laterite; const xs = p.triple ? [-7, 0, 7] : [0]; for (const x of xs) prangTower(b, x, 0, 0, 5, 14, c); if (p.triple) for (const s of [-1, 1]) b.box(s * 3.5, 0, 0, 3, 4, 3, c); return { r: p.triple ? 11 : 5, colliders: xs.map(x => ({ c: [x, 0], r: 3.3 })) }; }
    if (style === 'cham') { const c = 0xb06a48; const cols = []; for (const [x, s] of [[-7, .8], [0, 1.1], [7, .8]]) { const w = 5 * s, h = 10 * s; b.box(x, 0, 0, w + 1, 1, w + 1, 0xa05a3a); b.box(x, 1, 0, w, h, w, c); for (const sx of [-1, 1]) { b.box(x + sx * w * .3, 1, w / 2 + .05, .5, h, .3, 0xa05a3a); } b.box(x, 1, w / 2 + .1, w * .3, h * .4, .2, C.dark);
        let y = 1 + h, ww = w; for (let k = 0; k < 3; k++) { ww *= .72; b.box(x, y, 0, ww, h * .22, ww, c); for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cone(x + sx * ww * .5, y + h * .22, sz * ww * .5, .3, .8, c, 4); y += h * .22; } b.cone(x, y, 0, ww * .4, 1.6, c, 4); cols.push({ c: [x, 0], r: w * .6 }); }
      return { r: 12, colliders: cols }; }
    if (style === 'bell') { const c = C.twhite; b.cyl(0, 0, 0, 7.5, 8, 1.4, 0xd8d0c0, 20); b.cyl(0, 1.4, 0, 6, 6.5, 1.2, c, 20); b.dome(0, 2.6, 0, 5.6, c, 20, 1.0); b.box(0, 8, 0, 2.6, 1.6, 2.6, c); let y = 9.6; for (let k = 0; k < 9; k++) { b.cyl(0, y, 0, 1.2 - k * .1, 1.25 - k * .1, .5, k > 5 ? C.gold : c, 12); y += .5; } b.cone(0, y, 0, .4, 3.6, C.gold, 8); return { r: 8, colliders: [{ c: [0, 0], r: 7.6 }] }; }
    const s = (p.h || 20) / 14; const gold = !!p.gold; const c = gold ? 0xefe6d2 : 0xc8885a;
    if (p.terraces) { let y = 0; for (let k = 0; k < p.terraces; k++) { const w = (16 - k * 2.2) * s * .8; b.box(0, y, 0, w, 1.1 * s, w, 0xc8885a); for (const sx of [-1, 1]) for (const sz of [-1, 1]) bellStupa(b, sx * w * .45, y + 1.1 * s, sz * w * .45, .12 * s, 0xc8885a, false); y += 1.1 * s; } bellStupa(b, 0, y, 0, .9 * s, 0xc8885a, false); return { r: 7 * s, colliders: [{ c: [0, 0], r: 6.4 * s }] }; }
    b.box(0, 0, 0, 13 * s, 1, 13 * s, 0xd2c4a8); for (const sx of [-1, 1]) for (const sz of [-1, 1]) bellStupa(b, sx * 5.2 * s, 1, sz * 5.2 * s, .22 * s, c, gold);
    bellStupa(b, 0, 1, 0, s, c, gold); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; b.push(Math.sin(a) * 4.6 * s, 1, Math.cos(a) * 4.6 * s, a); b.box(0, 0, 0, 1.6, 2.6, 1.2, 0xe8dcc0); b.gable(0, 2.6, 0, 1.8, 1, 1.4, 0xb5523b); b.pop(); }
    return { r: 6.6 * s, colliders: [{ c: [0, 0], r: 4.6 * s }] };
  };
  LM.zediField = (b, p, rng) => {
    const cols = []; let n = 0;
    for (let t = 0; t < 80 && n < 16; t++) { const a = rng() * Math.PI * 2, r = 14 + rng() * 32; const x = Math.cos(a) * r, z = Math.sin(a) * r; if (Math.abs(z) < 7) continue; if (cols.some(c => Math.hypot(c.c[0] - x, c.c[1] - z) < c.r + 6)) continue;
      const kind = rng(); const s = .45 + rng() * .45;
      if (kind < .55) { bellStupa(b, x, 0, z, s, pick(rng, [0xc8885a, 0xb8734a, 0xd09a6a]), rng() < .12); cols.push({ c: [x, z], r: 3.3 * s }); }
      else { const w = 6 * s + 2; b.box(x, 0, z, w, 4 * s + 2, w, 0xb8734a); for (let k = 0; k < 3; k++) b.box(x, 4 * s + 2 + k * .9, z, w * (.8 - k * .15), .9, w * (.8 - k * .15), 0xb06a44); shikharaTower(b, x, 4 * s + 4.7, z, w * .36, 4 * s + 2, 0xb8734a, 6, false); b.box(x, 0, z + w / 2 + .03, w * .2, 2.2, .06, C.dark); cols.push({ c: [x, z], r: w * .6 }); }
      n++; }
    return { r: 6, colliders: cols };
  };
  LM.pahto = (b) => {
    const c = 0xefe8da; b.box(0, 0, 0, 20, 1, 20, 0xd8ccb4); b.box(0, 1, 0, 15, 7, 15, c);
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; b.push(Math.sin(a) * 9.2, 1, Math.cos(a) * 9.2, a); b.box(0, 0, 0, 5.6, 6, 3.4, c); b.box(0, 0, 1.71, 1.6, 3.2, .06, C.dark); b.gable(0, 6, 0, 5.8, 1.6, 3.6, c); shikharaTower(b, 0, 6.4, -.6, 1.6, 3.4, c, 5, false); b.pop(); }
    let y = 8, w = 15; for (let k = 0; k < 3; k++) { w *= .82; b.box(0, y, 0, w, 1.5, w, c); for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cone(sx * w * .45, y + 1.5, sz * w * .45, .35, 1, c, 6); y += 1.5; }
    y = shikharaTower(b, 0, y, 0, w * .7, 12, C.gold, 8); b.cyl(0, y - 1, 0, .6, .4, .4, C.gold, 8);
    return { r: 12, colliders: [{ c: [0, 0], r: 11 }] };
  };
  LM.templeMountain = (b, p) => {
    const c = C.khmer, cl = 0x8f8a7e, cols = [];
    if (p.style === 'bayon') { b.box(0, 0, 0, 34, 2.6, 34, cl); b.box(0, 2.6, 0, 24, 3.4, 24, c); cols.push({ c: [0, 0], r: 18 });
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; b.push(Math.sin(a) * 18.5, 0, Math.cos(a) * 18.5, a); b.box(0, 0, 0, 5, 1, 4, cl); for (let s = 0; s < 4; s++) b.box(0, 1 + s * .5, 1.8 - s * .9 + 2, 4, .5, 1, cl); b.pop(); }
      const faceT = (x, z, h, s) => { b.box(x, 6, z, 3.2 * s, h, 3.2 * s, c); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; b.push(x + Math.sin(a) * 1.62 * s, 6 + h * .55, z + Math.cos(a) * 1.62 * s, a, s); b.box(0, 1.5, 0, 2.6, .25, .22, 0x6a645c); b.box(-.6, 1.05, 0, .55, .16, .2, 0x3a342e); b.box(.6, 1.05, 0, .55, .16, .2, 0x3a342e); b.box(0, .45, .05, .45, .7, .22, c); b.box(0, .05, .02, 1, .16, .2, 0x5a544c); b.pop(); } prangTower(b, x, 6 + h, z, 2.6 * s, 4 * s, c); };
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; faceT(Math.cos(a) * 9.5, Math.sin(a) * 9.5, 4, 1); }
      b.cyl(0, 6, 0, 5.6, 6, 7, c, 12); faceT(0, 0, 9, 1.6); prangTower(b, 0, 19, 0, 4, 9, c);
      return { r: 21, colliders: cols }; }
    // Angkor Wat: moat, enclosure, three galleried terraces, five towers
    const MW = 40, MD = 36; b.box(0, -.25, 0, MW * 2 + 12, .3, MD * 2 + 12, C.water);
    for (const s of [-1, 1]) { b.box(0, 0, s * (MD + 6.5), MW * 2 + 14, .6, 1.2, cl); b.box(s * (MW + 6.5), 0, 0, 1.2, .6, MD * 2 + 14, cl); }
    b.box(0, 0, 0, MW * 2 - 2, .25, MD * 2 - 2, 0x8a9a5a); b.box(0, 0, MD + 3.5, 6, .6, 10, cl);
    for (const s of [-1, 1]) { b.box(0, 0, s * MD, MW * 2, 3, 1.2, c); b.box(s * MW, 0, 0, 1.2, 3, MD * 2, c); cols.push({ seg: [-MW, s * MD, MW, s * MD], r: .8 }, { seg: [s * MW, -MD, s * MW, MD], r: .8 }); }
    b.box(0, 0, MD, 10, 5.5, 3.2, c); prangTower(b, 0, 5.5, MD, 3.4, 5, c);
    b.box(0, 0, 18, 3.5, .8, 18, cl);
    b.box(0, 0, 0, 34, 4, 30, c); b.box(0, 4, 0, 26, 4.4, 22, cl); b.box(0, 8.4, 0, 17, 5.5, 17, c);
    for (const [w, d, y] of [[34, 30, 4], [26, 22, 8.4], [17, 17, 13.9]]) for (let k = 0; k < (w + d) / 3; k++) { const t = k / ((w + d) / 3); const onX = t < w / (w + d); const u = onX ? t * (w + d) / w : (t - w / (w + d)) * (w + d) / d; for (const s of [-1, 1]) { if (onX) b.box(-w / 2 + u * w, y - 1.2, s * d / 2, .5, 1.2, .5, cl); else b.box(s * w / 2, y - 1.2, -d / 2 + u * d, .5, 1.2, .5, cl); } }
    b.box(0, 4, 13, 5, 4.4, 4, c); b.box(0, 8.4, 9.5, 4, 5.5, 3, c);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) prangTower(b, sx * 7, 13.9, sz * 7, 3.4, 10, c);
    prangTower(b, 0, 13.9, 0, 5, 16, c);
    cols.push({ c: [0, 0], r: 16 });
    return { r: MW + 7, colliders: cols };
  };

  palmFix();
  return { Builder, C, CB, house, yurt, wallStyle, treeGeo, treeGeoLow, LM, ship, PROP, prayerFlags, FURN, pick, CIVIC };
})();

