
// ============================================================
//  TREE KIT (v22.1): trunks, branches and leaf cards for the wild vegetation
//  Replaces the blob trees in forests and wild country. Everything for a species is one small
//  triangle list with: position, normal, vertex colour, local UV, atlas cell, sway weight.
//  The vegetation material (game.js vegMat) samples src/veg_atlas.js with alpha-cut leaf cards.
//  City, village and prop trees still use the old blob trees from builders.js.
// ============================================================
const TK = (() => {
  const CELLS = VEG_ATLAS.cells;
  const SQ = Math.sqrt, PI = Math.PI, TAU = Math.PI * 2;
  function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const nrm = (v) => { const l = SQ(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len = (a) => SQ(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const hex = (h) => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };

  class M {
    constructor() { this.pos = []; this.nrm = []; this.col = []; this.uv = []; this.cell = []; this.sw = []; }
    vert(p, n, c, uv, cell, sw) { this.pos.push(p[0], p[1], p[2]); this.nrm.push(n[0], n[1], n[2]); this.col.push(c[0], c[1], c[2]); this.uv.push(uv[0], uv[1]); this.cell.push(cell[0], cell[1], cell[2], cell[3]); this.sw.push(sw); }
    // p0 bottom-left, p1 bottom-right, p2 top-right, p3 top-left; hint normal n
    quad(p0, p1, p2, p3, cell, n, c, sw, vA = 0, vB = 1) {
      const e = 0.003, a = [e, vA + e], b = [1 - e, vA + e], cc = [1 - e, vB - e], d = [e, vB - e];
      this.vert(p0, n, c, a, cell, sw); this.vert(p1, n, c, b, cell, sw); this.vert(p2, n, c, cc, cell, sw);
      this.vert(p0, n, c, a, cell, sw); this.vert(p2, n, c, cc, cell, sw); this.vert(p3, n, c, d, cell, sw);
    }
    // a card standing on `base`, pointing along dv, width along du; length L, width W; baseW scales the bottom edge (taper)
    card(base, dv, du, L, W, cell, n, c, swK = 1) {
      const hw = W / 2, tip = add(base, dv, L);
      const p0 = add(base, du, -hw), p1 = add(base, du, hw), p2 = add(tip, du, hw), p3 = add(tip, du, -hw);
      this.quad(p0, p1, p2, p3, cell, n, c, base[1] * 0.3 + swK * 0.7);
    }
    // tapered tube along a polyline
    tube(pts, rads, sides, cell, c, tileLen, swK, uRep) {
      const rings = []; let acc = 0; const vs = [];
      for (let i = 0; i < pts.length; i++) {
        const t = nrm(sub(pts[Math.min(pts.length - 1, i + 1)], pts[Math.max(0, i - 1)]));
        const ref = Math.abs(t[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
        const e1 = nrm(cross(t, ref)), e2 = cross(t, e1);
        if (i > 0) acc += len(sub(pts[i], pts[i - 1]));
        const ring = [];
        for (let j = 0; j <= sides; j++) { const a = j / sides * TAU, ca = Math.cos(a), sa = Math.sin(a); const r = [e1[0] * ca + e2[0] * sa, e1[1] * ca + e2[1] * sa, e1[2] * ca + e2[2] * sa]; ring.push({ p: add(pts[i], r, rads[i]), n: r, u: j / sides * uRep, v: acc / tileLen }); }
        rings.push(ring);
      }
      for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < sides; j++) {
        const a = rings[i][j], b = rings[i][j + 1], cc = rings[i + 1][j + 1], d = rings[i + 1][j];
        const k = (r) => (r.p[1] * swK);
        for (const [x, y, z] of [[a, b, cc], [a, cc, d]]) for (const q of [x, y, z]) this.vert(q.p, q.n, c, [q.u, q.v], cell, k(q));
      }
    }
  }
  const cellOf = (name) => { const c = CELLS[name]; return [c[0], c[1], c[2], c[3]]; };

  // ---------- trunk helper: a leaning, slightly bent trunk with a root flare ----------
  function trunk(m, rng, H, r0, r1, bark, col, sides, lean, bend, segs) {
    const lx = (rng() - 0.5) * lean, lz = (rng() - 0.5) * lean; const n = segs || 5; const pts = [], rads = [];
    for (let i = 0; i <= n; i++) { const t = i / n; pts.push([lx * t * t * H + Math.sin(t * 3 + rng()) * bend * t, H * t, lz * t * t * H + Math.cos(t * 2.4) * bend * t]); rads.push(r0 + (r1 - r0) * t + (i === 0 ? r0 * 0.35 : i === 1 ? r0 * 0.12 : 0)); }
    const cl = CELLS[bark]; m.tube(pts, rads, sides, cellOf(bark), col, 1.7, 0.3, Math.max(1, Math.round(r0 * TAU / 1.1)));
    return pts;
  }

  // ---------- broadleaf trees ----------
  // H trunk height; tr trunk radius; Rx/Ry crown radii; cy crown centre as a fraction of Ry above H; nb branches; nc clusters; cs card size
  const BROAD = {
    oak:      { bark: 'barkRough', bc: [.78, .74, .68], H: 2.4, tr: .34, Rx: 3.8, Ry: 2.5, cy: .5, nb: 7, nc: 24, cs: 2.9, leaf: 'leafB', tint: [.95, 1, .86], imp: '56783a', lean: .25 },
    beech:    { bark: 'barkPale', bc: [.92, .9, .84], H: 4.6, tr: .26, Rx: 3.1, Ry: 3.6, cy: .6, nb: 8, nc: 26, cs: 2.6, leaf: 'leafA', tint: [.8, .92, .72], imp: '3f6e38', lean: .15 },
    broad:    { bark: 'barkSakura', bc: [.9, .86, .8], H: 2.4, tr: .22, Rx: 2.8, Ry: 2.3, cy: .55, nb: 6, nc: 18, cs: 2.4, leaf: 'leafA', tint: [.9, 1, .8], imp: '5b8a3c', lean: .3 },
    plane:    { bark: 'barkPale', bc: [1, .98, .9], H: 3.3, tr: .42, Rx: 4.6, Ry: 3.1, cy: .6, nb: 7, nc: 26, cs: 3.2, leaf: 'leafA', tint: [.95, 1.04, .82], imp: '6f9a44', lean: .35 },
    sophora:  { bark: 'barkSakura', bc: [.8, .76, .7], H: 2.6, tr: .3, Rx: 3.4, Ry: 2.5, cy: .5, nb: 6, nc: 20, cs: 2.6, leaf: 'leafNarrow', tint: [.9, 1, .8], imp: '5e8a40', lean: .3 },
    camphor:  { bark: 'barkRough', bc: [.62, .58, .52], H: 2.6, tr: .4, Rx: 4.2, Ry: 3.2, cy: .55, nb: 7, nc: 26, cs: 3.0, leaf: 'leafC', tint: [.75, .95, .75], imp: '2f5f32', lean: .2 },
    mulberry: { bark: 'barkSakura', bc: [.92, .88, .8], H: 1.7, tr: .2, Rx: 2.4, Ry: 2.0, cy: .6, nb: 5, nc: 15, cs: 2.2, leaf: 'leafA', tint: [.85, 1, .75], imp: '58883a', lean: .3 },
    fruit:    { bark: 'barkSakura', bc: [.95, .9, .84], H: 1.4, tr: .17, Rx: 2.1, Ry: 1.7, cy: .6, nb: 5, nc: 14, cs: 2.0, leaf: 'leafA', tint: [.95, 1.04, .8], imp: '6e9a40', lean: .3 },
    olive:    { bark: 'barkRough', bc: [.88, .84, .78], H: .9, tr: .2, Rx: 2.0, Ry: 1.5, cy: .7, nb: 5, nc: 16, cs: 1.9, leaf: 'leafSmall', tint: [.78, .88, .72], imp: '8a9a6a', lean: .6 },
    pistachio:{ bark: 'barkRough', bc: [.85, .8, .72], H: 1.0, tr: .17, Rx: 2.1, Ry: 1.7, cy: .7, nb: 5, nc: 14, cs: 1.9, leaf: 'leafB', tint: [.95, 1, .85], imp: '8a9a62', lean: .5 },
    willow:   { bark: 'barkRough', bc: [.7, .66, .6], H: 2.4, tr: .32, Rx: 3.3, Ry: 2.4, cy: .55, nb: 6, nc: 18, cs: 2.6, leaf: 'leafNarrow', tint: [.98, 1.06, .78], imp: '86aa52', lean: .4, weep: true },
    poplar:   { bark: 'barkPale', bc: [.95, .94, .88], H: 1.5, tr: .17, Rx: 1.25, Ry: 4.6, cy: 1.0, nb: 6, nc: 20, cs: 1.9, leaf: 'leafA', tint: [.92, 1.04, .78], imp: '6f9a3e', lean: .12 },
    birch:    { bark: 'barkPale', bc: [1.25, 1.25, 1.2], H: 2.8, tr: .13, Rx: 1.7, Ry: 2.3, cy: .8, nb: 5, nc: 14, cs: 1.9, leaf: 'leafA', tint: [.98, 1.08, .75], imp: '8aae52', lean: .4 },
    tograk:   { bark: 'barkRough', bc: [.95, .9, .82], H: 1.2, tr: .24, Rx: 2.4, Ry: 1.7, cy: .8, nb: 5, nc: 9, cs: 2.0, leaf: 'leafNarrow', tint: [1.1, 1.05, .7], imp: 'a8a84a', lean: .9 },
    acacia:   { bark: 'barkRough', bc: [.72, .66, .58], H: 2.3, tr: .2, Rx: 3.8, Ry: 1.0, cy: .3, nb: 6, nc: 12, cs: 2.5, leaf: 'leafSmall', tint: [.95, 1, .72], imp: '8d9a52', lean: .7, flat: true },
    sycamore: { bark: 'barkPale', bc: [.95, .9, .82], H: 2.6, tr: .4, Rx: 4.2, Ry: 3.0, cy: .6, nb: 7, nc: 24, cs: 3.0, leaf: 'leafA', tint: [.88, 1, .74], imp: '5f8a3e', lean: .3 },
    mango:    { bark: 'barkRough', bc: [.6, .56, .5], H: 1.9, tr: .32, Rx: 3.7, Ry: 2.8, cy: .6, nb: 7, nc: 24, cs: 2.8, leaf: 'leafC', tint: [.78, .98, .72], imp: '2e5a30', lean: .2 },
    teak:     { bark: 'barkPale', bc: [.88, .82, .72], H: 5.2, tr: .3, Rx: 3.2, Ry: 3.2, cy: .6, nb: 7, nc: 22, cs: 3.1, leaf: 'leafA', tint: [.82, 1.0, .72], imp: '5c8a3a', lean: .2 },
    banyan:   { bark: 'barkRough', bc: [.7, .66, .6], H: 2.4, tr: .55, Rx: 5.5, Ry: 3.0, cy: .5, nb: 9, nc: 30, cs: 3.2, leaf: 'leafC', tint: [.82, 1.0, .76], imp: '34663a', lean: .2 },
    shrub:    { bark: 'barkRough', bc: [.8, .74, .66], H: .25, tr: .05, Rx: 1.1, Ry: .8, cy: 1.0, nb: 2, nc: 7, cs: 1.5, leaf: 'leafB', tint: [1, 1.05, .86], imp: '7a8a4a', lean: .1 },
    bush:     { bark: 'barkRough', bc: [.8, .74, .66], H: .2, tr: .04, Rx: 1.0, Ry: .75, cy: 1.0, nb: 2, nc: 6, cs: 1.4, leaf: 'leafA', tint: [.82, .96, .72], imp: '5b8a3c', lean: .1 },
    tea:      { bark: 'barkRough', bc: [.8, .74, .66], H: .1, tr: .04, Rx: .9, Ry: .5, cy: 1.0, nb: 1, nc: 6, cs: 1.3, leaf: 'leafC', tint: [.8, 1, .75], imp: '3f7038', lean: .1 },
    umbrella: { bark: 'barkPine', bc: [.78, .72, .68], H: 5.6, tr: .26, Rx: 4.3, Ry: .9, cy: .5, nb: 6, nc: 16, cs: 3.4, leaf: 'needlePine', tint: [.82, .96, .8], imp: '3e6a3a', lean: .5, flat: true, crownLow: true },
    pine:     { bark: 'barkPine', bc: [.82, .76, .7], H: 5.8, tr: .24, Rx: 3.0, Ry: 2.6, cy: .6, nb: 6, nc: 14, cs: 3.2, leaf: 'needlePine', tint: [.8, .95, .8], imp: '3f6e45', lean: .45, flat: true },
  };
  function broadleaf(cfg, rng, lod, scale) {
    const m = new M(); const sides = lod ? 4 : 6; const th = cfg.H;
    const tp = trunk(m, rng, th, cfg.tr, cfg.tr * 0.5, cfg.bark, cfg.bc, sides, cfg.lean * 1.0, 0.1, lod ? 3 : 5);
    const top = tp[tp.length - 1]; const c = [top[0], top[1] + cfg.Ry * cfg.cy, top[2]];
    const nb = lod ? Math.ceil(cfg.nb * 0.5) : cfg.nb, nc = Math.max(6, Math.round(cfg.nc * (lod ? 0.4 : 0.82))); const cs = cfg.cs * (lod ? 1.45 : 1);
    const lcell = cellOf(cfg.leaf), bcell = cellOf(cfg.bark); const ends = [];
    const a0 = rng() * TAU;
    for (let i = 0; i < nb; i++) {
      const a = a0 + i / nb * TAU + (rng() - 0.5) * 0.7, ya = th * (0.5 + 0.5 * rng());
      const idx = Math.min(tp.length - 1, Math.floor(ya / th * (tp.length - 1))); const at = tp[idx];
      const rr = cfg.Rx * (0.55 + 0.45 * rng()), dy = (rng() - 0.35) * cfg.Ry * 0.9;
      const tgt = [c[0] + Math.cos(a) * rr, c[1] + dy, c[2] + Math.sin(a) * rr];
      const mid = [(at[0] + tgt[0]) / 2, Math.max(at[1], (at[1] + tgt[1]) / 2) + 0.3, (at[2] + tgt[2]) / 2];
      const r0 = cfg.tr * (0.42 - 0.18 * (ya / th));
      if (cfg.H > 0.35 && !lod) m.tube([at, mid, tgt], [r0, r0 * 0.62, r0 * 0.25], 4, bcell, cfg.bc, 1.5, 0.3, 1);
      ends.push(tgt);
    }
    for (let k = 0; k < nc; k++) {
      let p;
      if (k < ends.length) p = ends[k];
      else {
        // a point inside the crown ellipsoid, biased toward the shell so the crown reads as clumps with gaps
        let q; do { q = [rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1]; } while (q[0] * q[0] + q[1] * q[1] + q[2] * q[2] > 1);
        const l = len(q) || 1; const sh = 0.55 + 0.45 * Math.min(1, l * 1.2); p = [c[0] + q[0] / l * sh * cfg.Rx * l ** 0.35, c[1] + q[1] / l * sh * cfg.Ry * l ** 0.35, c[2] + q[2] / l * sh * cfg.Rx * l ** 0.35];
      }
      const o = sub(p, c); const ol = len(o) || 1; const nh = nrm([o[0] / cfg.Rx, o[1] / cfg.Ry + 0.25, o[2] / cfg.Rx]);
      const ht = clamp(0.5 + 0.5 * o[1] / cfg.Ry, 0, 1), rr = clamp(ol / Math.max(cfg.Rx, cfg.Ry), 0, 1.1);
      const k0 = 0.7 + 0.26 * ht + 0.2 * rr; const j = 0.92 + rng() * 0.16;
      const col = [cfg.tint[0] * k0 * j, cfg.tint[1] * k0 * j, cfg.tint[2] * k0 * j];
      const size = cs * (0.8 + rng() * 0.45);
      if (cfg.weep && k >= 2) { // hanging strands
        const th2 = rng() * TAU; const du = [Math.cos(th2), 0, Math.sin(th2)];
        m.card(p, [0, -1, 0], du, size * 1.45, size * 0.75, lcell, nh, col, 1.4);
        m.card(p, [0.15, -1, 0.1], [-du[2], 0, du[0]], size * 1.3, size * 0.7, lcell, nh, col, 1.4); continue;
      }
      if (cfg.flat) { // horizontal sprays (acacia, stone pine)
        const th2 = rng() * TAU; const du = [Math.cos(th2), 0, Math.sin(th2)]; const dv = nrm([-du[2], 0.12 + rng() * 0.15, du[0]]);
        const base = add(p, dv, -size * 0.5);
        m.card(base, dv, du, size, size * 1.05, lcell, nrm([nh[0] * 0.5, 1, nh[2] * 0.5]), col, 1.2);
        if (!lod && rng() < 0.55) { const t3 = rng() * TAU, du3 = [Math.cos(t3), 0, Math.sin(t3)], dv3 = nrm([-du3[2], 0.1 + rng() * 0.15, du3[0]]); m.card(add(p, dv3, -size * 0.45), dv3, du3, size * 0.9, size * 0.95, lcell, nrm([nh[0] * 0.5, 1, nh[2] * 0.5]), col, 1.2); }
        continue;
      }
      const th1 = rng() * Math.PI; const du1 = [Math.cos(th1), 0, Math.sin(th1)];
      const ox = o[0] / (ol || 1), oz = o[2] / (ol || 1);
      const dv = nrm([ox * 0.3, 1, oz * 0.3]);
      m.card(add(p, dv, -size * 0.5), dv, du1, size, size * 1.05, lcell, nh, col, 1.2);
      const du2 = [-du1[2], 0, du1[0]]; const dv2 = nrm([ox * 0.2 + (rng() - 0.5) * 0.3, 1, oz * 0.2 + (rng() - 0.5) * 0.3]);
      m.card(add(p, dv2, -size * 0.45), dv2, du2, size * 0.9, size, lcell, nh, [col[0] * 0.95, col[1] * 0.95, col[2] * 0.95], 1.2);
      if (!lod && rng() < 0.25) { const dv3 = nrm([ox * 0.8, 0.25, oz * 0.8]); const du3 = [-oz, 0, ox]; m.card(add(p, dv3, -size * 0.4), dv3, du3, size * 0.85, size * 0.9, lcell, nh, col, 1.2); }
    }
    return m;
  }

  // ---------- conifers ----------
  const CONIF = {
    fir:    { H: 12, tr: .36, R: 3.0, y0: .1, m0: 6, m1: 3, nw: 18, droop: 30, wmul: 1.0, cell: 'needle', tint: [.95, 1.05, .93], imp: '2c5a42' },
    spruce: { H: 13.5, tr: .32, R: 2.4, y0: .07, m0: 5, m1: 3, nw: 21, droop: 38, wmul: .95, cell: 'needle', tint: [.86, 1.0, .9], imp: '25483a' },
    conifer:{ H: 10, tr: .3, R: 2.7, y0: .12, m0: 5, m1: 3, nw: 15, droop: 32, wmul: 1.0, cell: 'needle', tint: [.98, 1.06, .95], imp: '326544' },
    cedar:  { H: 9.5, tr: .5, R: 4.6, y0: .28, m0: 6, m1: 4, nw: 7, droop: 7, wmul: 1.1, cell: 'needle', tint: [.92, 1.04, .94], imp: '2f5a3c', tiers: true },
    cypress:{ H: 8.8, tr: .2, R: 1.05, y0: .05, m0: 5, m1: 3, nw: 17, droop: -62, wmul: .95, cell: 'scale', tint: [.8, 1, .86], imp: '2d4f35' },
    juniper:{ H: 4.4, tr: .16, R: 1.7, y0: .06, m0: 5, m1: 3, nw: 9, droop: -8, wmul: 1.0, cell: 'scale', tint: [.92, 1.04, .98], imp: '3e5a48' },
  };
  function conifer(cfg, rng, lod) {
    const m = new M(); const H = cfg.H * (0.92 + rng() * 0.16);
    trunk(m, rng, H * 0.99, cfg.tr, 0.04, 'barkPine', [.72, .66, .6], lod ? 4 : 6, 0.5, 0.05, lod ? 3 : 5);
    const nw = lod ? Math.max(4, Math.round(cfg.nw * 0.4)) : Math.round(cfg.nw * 0.82); const cell = cellOf(cfg.cell); const a0 = rng() * TAU;
    for (let k = 0; k < nw; k++) {
      const t = k / (nw - 1); const y = H * (cfg.y0 + (0.985 - cfg.y0) * t);
      const prof = cfg.tiers ? (0.55 + 0.45 * (1 - t)) : Math.pow(1 - t, 0.82); const R = cfg.R * (0.14 + 0.86 * prof) * (0.92 + rng() * 0.16) * (lod ? 1.12 : 1);
      const m_ = Math.max(3, Math.round(cfg.m0 + (cfg.m1 - cfg.m0) * t)) - (lod ? 1 : 0); const off = a0 + k * 2.399;
      for (let j = 0; j < m_; j++) {
        const a = off + j / m_ * TAU + (rng() - 0.5) * 0.5; const d = [Math.cos(a), 0, Math.sin(a)];
        const dr = (cfg.droop + (rng() - 0.5) * 10 - t * 8) * PI / 180; const dv = nrm([d[0] * Math.cos(dr), -Math.sin(dr), d[2] * Math.cos(dr)]);
        const du = [-Math.sin(a), 0, Math.cos(a)]; const L = R * 1.05 + 0.25; const W = L * cfg.wmul * (0.95 + rng() * 0.15);
        const ao = 0.66 + 0.34 * t + 0.1 * (1 - Math.abs(cfg.droop) / 60); const jj = 0.93 + rng() * 0.14;
        const col = [cfg.tint[0] * ao * jj, cfg.tint[1] * ao * jj, cfg.tint[2] * ao * jj];
        const n = nrm([d[0] * 0.5, 0.85 + (cfg.droop < 0 ? -0.2 : 0), d[2] * 0.5]);
        const base = [d[0] * 0.12, y, d[2] * 0.12];
        m.card(base, dv, du, L, W, cell, n, col, 1.15);
      }
    }
    // leader at the tip: two crossed cards
    const tipC = [0, H * 0.9, 0]; const tcol = [cfg.tint[0] * 0.95, cfg.tint[1] * 0.95, cfg.tint[2] * 0.95];
    m.card(tipC, [0, 1, 0], [1, 0, 0], H * 0.1 + 0.3, H * 0.07 + 0.5, cell, [0, 1, 0], tcol, 1.2);
    m.card(tipC, [0, 1, 0], [0, 0, 1], H * 0.1 + 0.3, H * 0.07 + 0.5, cell, [0, 1, 0], tcol, 1.2);
    return m;
  }

  // ---------- palms ----------
  const PALM = {
    date:    { H: 7.5, tr: .24, nf: 12, L: 4.2, W: 1.9, tint: [.82, 1, .72], imp: '5f8a3a', lean: .9 },
    coconut: { H: 9.0, tr: .2, nf: 10, L: 4.4, W: 1.8, tint: [.86, 1.04, .72], imp: '5a8a3a', lean: 2.4 },
    palm:    { H: 6.4, tr: .22, nf: 11, L: 3.8, W: 1.8, tint: [.84, 1, .72], imp: '5f8a3a', lean: 1.0 },
  };
  function palm(cfg, rng, lod) {
    const m = new M(); const H = cfg.H * (0.9 + rng() * 0.2); const lx = (rng() - 0.5) * cfg.lean * 2, lz = (rng() - 0.5) * cfg.lean * 2;
    const nS = lod ? 3 : 6; const pts = [], rads = []; for (let i = 0; i <= nS; i++) { const t = i / nS; pts.push([lx * t * t, H * t, lz * t * t]); rads.push(cfg.tr * (1 - 0.3 * t) + (i === 0 ? 0.08 : 0)); }
    m.tube(pts, rads, lod ? 4 : 6, cellOf('barkRough'), [1.15, .95, .72], 1.2, 0.3, 2);
    const top = pts[pts.length - 1], nf = lod ? Math.ceil(cfg.nf * 0.7) : cfg.nf, cell = cellOf('frond'); const a0 = rng() * TAU;
    for (let i = 0; i < nf; i++) {
      const a = a0 + i / nf * TAU + (rng() - 0.5) * 0.3, d = [Math.cos(a), 0, Math.sin(a)], du = [-Math.sin(a), 0, Math.cos(a)];
      const e0 = (28 + rng() * 24 - (i % 2) * 14) * PI / 180, L = cfg.L * (0.85 + rng() * 0.3), W = cfg.W * (0.9 + rng() * 0.2);
      const segs = lod ? 2 : 3; let p = [top[0], top[1] - 0.1, top[2]], prev = null; const stations = [];
      let el = e0; for (let s = 0; s <= segs; s++) { stations.push({ p: p.slice(), w: W * (0.35 + 0.65 * Math.sin(PI * (0.12 + 0.88 * s / segs)) ** 0.7) }); el -= (0.45 + s * 0.12); const step = L / segs; p = add(p, [d[0] * Math.cos(el), Math.sin(el), d[2] * Math.cos(el)], step); }
      const n = nrm([d[0] * 0.25, 0.9, d[2] * 0.25]); const ao = 0.62 + 0.38 * (i % 2 ? 1 : 0.85);
      const col = [cfg.tint[0] * ao, cfg.tint[1] * ao, cfg.tint[2] * ao];
      for (let s = 0; s < segs; s++) { const A = stations[s], B = stations[s + 1];
        m.quad(add(A.p, du, -A.w / 2), add(A.p, du, A.w / 2), add(B.p, du, B.w / 2), add(B.p, du, -B.w / 2), cell, n, col, A.p[1] * 0.3 + 0.9, s / segs, (s + 1) / segs); }
    }
    return m;
  }

  // ---------- ferns ----------
  function fern(rng, lod) {
    const m = new M(); const cell = cellOf('fern'); const n = lod ? 4 : 7; const a0 = rng() * TAU;
    for (let i = 0; i < n; i++) {
      const a = a0 + i / n * TAU + (rng() - 0.5) * 0.5, d = [Math.cos(a), 0, Math.sin(a)], du = [-d[2], 0, d[0]];
      const el = (38 + rng() * 28) * PI / 180; const L = 1.0 + rng() * 0.45;
      const k = 0.62 + rng() * 0.4; const col = [k * 0.92, k * 1.04, k * 0.78];
      const dv = nrm([d[0] * Math.cos(el), Math.sin(el), d[2] * Math.cos(el)]);
      m.card([d[0] * 0.05, 0.02, d[2] * 0.05], dv, du, L, L * 0.62, cell, nrm([d[0] * 0.3, 1, d[2] * 0.3]), col, 2.2);
    }
    return m;
  }

  // ---------- bamboo ----------
  function bamboo(rng, lod) {
    const m = new M(); const n = lod ? 3 : 6, lc = cellOf('leafNarrow'), wc = cellOf('white');
    for (let i = 0; i < n; i++) {
      const a = rng() * TAU, r = rng() * 1.1, H = 6 + rng() * 3.2, tl = 0.1 + rng() * 0.12, ta = rng() * TAU;
      const pts = [], rads = []; for (let k = 0; k <= 4; k++) { const t = k / 4; pts.push([Math.cos(a) * r + Math.cos(ta) * tl * t * t * H, H * t, Math.sin(a) * r + Math.sin(ta) * tl * t * t * H]); rads.push(0.06 - 0.028 * t); }
      const g = 0.82 + rng() * 0.3; m.tube(pts, rads, lod ? 3 : 4, wc, [0.5 * g, 0.66 * g, 0.28 * g], 1.5, 0.3, 1);
      const top = pts[4];
      for (let k = 0; k < (lod ? 1 : 3); k++) {
        const t = 0.55 + 0.45 * rng(), y = H * t; const at = [pts[Math.min(4, Math.floor(t * 4))][0], y, pts[Math.min(4, Math.floor(t * 4))][2]];
        const o = rng() * TAU, d = [Math.cos(o), 0, Math.sin(o)]; const dv = nrm([d[0] * 0.8, -0.35, d[2] * 0.8]);
        const sz = 1.5 + rng() * 0.8, kk = 0.78 + 0.25 * t;
        m.card(at, dv, [-d[2], 0, d[0]], sz, sz * 0.8, lc, nrm([d[0] * 0.4, 0.9, d[2] * 0.4]), [0.9 * kk, 1.06 * kk, 0.66 * kk], 1.6);
      }
    }
    return m;
  }

  // ---------- rocks: chunky low-poly boulders with slate texture and moss on the tops ----------
  function rock(rng, lod, mossK) {
    const m = new M(); const ico = new THREE.IcosahedronGeometry(1, lod ? 0 : 1); const P = ico.attributes.position.array; const seed = rng() * 100; const memo = {};
    const disp = (x, y, z) => { const k = x.toFixed(3) + y.toFixed(3) + z.toFixed(3); if (memo[k] === undefined) memo[k] = 1 + 0.3 * (Math.sin(x * 3.1 + seed) * Math.cos(z * 2.7 + seed * 1.3) + Math.sin(y * 4.3 + seed * 0.7) * 0.6) + (rng() - 0.5) * 0.18; return memo[k]; };
    const flat = 0.58 + rng() * 0.25, sx = 0.9 + rng() * 0.4, cell = cellOf('rock'); const base = 0.84 + rng() * 0.2;
    for (let i = 0; i < P.length; i += 9) {
      const v = []; for (let j = 0; j < 3; j++) { const x = P[i + j * 3], y = P[i + j * 3 + 1], z = P[i + j * 3 + 2]; const d = disp(x, y, z); v.push([x * d * sx, Math.max(-0.2, y * d * flat) + 0.18, z * d]); }
      const n = nrm(cross(sub(v[1], v[0]), sub(v[2], v[0]))); const ax = Math.abs(n[0]) > Math.abs(n[2]) ? (Math.abs(n[0]) > Math.abs(n[1]) ? 0 : 1) : (Math.abs(n[2]) > Math.abs(n[1]) ? 2 : 1);
      const top = clamp((n[1] - 0.35) * 2.4, 0, 1), g = base * (0.92 + rng() * 0.16);
      const mo = top * mossK; const col = [g * (1 - 0.38 * mo), g * (1 - 0.06 * mo), g * (1 - 0.5 * mo)];
      for (const q of v) { const uv = ax === 0 ? [q[2], q[1]] : ax === 1 ? [q[0], q[2]] : [q[0], q[1]]; m.vert(q, n, col, [uv[0] * 0.5 + 8, uv[1] * 0.5 + 8], cell, 0); }
    }
    return m;
  }

  // ---------- variants (cached) ----------
  const NV = 3, cache = {};
  function finalize(m, cfg, lod) {
    let h = 0, rmax = 0; const P = m.pos; for (let i = 0; i < P.length; i += 3) { h = Math.max(h, P[i + 1]); rmax = Math.max(rmax, Math.hypot(P[i], P[i + 2])); }
    const imp = cfg && cfg.imp ? hex(parseInt(cfg.imp, 16)) : [.3, .5, .3];
    return { pos: new Float32Array(m.pos), nrm: new Float32Array(m.nrm), col: new Float32Array(m.col), uv: new Float32Array(m.uv), cell: new Float32Array(m.cell), sw: new Float32Array(m.sw), h, r: rmax, c: imp };
  }
  function kindOf(type) { return BROAD[type] ? 'broad' : CONIF[type] ? 'conif' : PALM[type] ? 'palm' : type === 'fern' ? 'fern' : type === 'bamboo' ? 'bamboo' : type === 'rock' ? 'rock' : null; }
  const has = (type) => !!kindOf(type);
  function variants(type, lod) {
    const key = type + (lod ? '1' : '0'); if (cache[key]) return cache[key];
    const kind = kindOf(type); if (!kind) return (cache[key] = null);
    const out = []; let seed = 0; for (let i = 0; i < type.length; i++) seed = seed * 31 + type.charCodeAt(i);
    for (let v = 0; v < NV; v++) {
      const rng = mulberry(seed * 7919 + v * 104729 + (lod ? 17 : 3));
      const m = kind === 'broad' ? broadleaf(BROAD[type], rng, lod) : kind === 'conif' ? conifer(CONIF[type], rng, lod) : kind === 'palm' ? palm(PALM[type], rng, lod) : kind === 'bamboo' ? bamboo(rng, lod) : kind === 'rock' ? rock(rng, lod, [0, 0.55, 1][v % 3]) : fern(rng, lod);
      out.push(finalize(m, kind === 'broad' ? BROAD[type] : kind === 'conif' ? CONIF[type] : kind === 'palm' ? PALM[type] : kind === 'bamboo' ? { imp: '7aa04a' } : { imp: '5a8a3a' }, lod));
    }
    return (cache[key] = out);
  }

  // ---------- atlas texture + material hookup ----------
  const st = { ready: false, tex: null };
  function attach(mat, onReady) {
    const img = new Image();
    img.onload = () => {
      const t = new THREE.Texture(img); t.colorSpace = THREE.SRGBColorSpace; t.flipY = true; t.generateMipmaps = true;
      t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = 4; t.needsUpdate = true;
      mat.map = t; mat.alphaTest = 0.5; mat.alphaToCoverage = true; mat.needsUpdate = true; st.tex = t; st.ready = true; if (onReady) onReady();
    };
    img.onerror = () => console.warn('veg atlas failed to load; vegetation keeps the old blob trees');
    img.src = VEG_ATLAS.uri;
  }
  return { has, variants, attach, state: st, BROAD, CONIF, PALM };
})();
