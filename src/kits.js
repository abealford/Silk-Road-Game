// ============================================================
//  KITS (v22.3): building kits for all 17 cultures, from the building-kit mockup (issue #25, approved 24 Nov 2026)
//  A kit of parts in code, one rulebook per culture, a texture per part. Clean and solid (Valheim).
//  Near buildings (about 100 m) are built from the kit; today's builders (src/builders.js) stay beyond.
//  Parts: facade (walls with real openings), arches (round, pointed, cusped, horseshoe), arch rings and ablaq,
//  bands, lit windows, shutters, grilles, lattice screens, doors, gable / hipped (Chinese flare) / flat roofs.
//  Kits: town house (rowHouse), courtyard house, bazaar shop bay, Yemeni tower house, haveli, shophouse,
//  siheyuan, stilt house, Tibetan house, ger. See claude/silk-road-building-kit.md.
// ============================================================
const KITS = (() => {
// ============================================================
//  Building-kit mockup: shared core (materials, kit builder, shapes, baking)
//  Everything here is plain Three.js, so it can move into src/ for the real build.
// ============================================================
const V3 = THREE.Vector3;
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function rng32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const pick = (r, a) => a[Math.floor(r() * a.length)];

// ---------- kit builder ----------
const _q = new THREE.Quaternion(), _e = new THREE.Euler();
function M(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) { return new THREE.Matrix4().compose(new V3(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ')), new V3(sx, sy, sz)); }
const BOX = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
const PLANE = new THREE.PlaneGeometry(1, 1).toNonIndexed();
const geoCache = {};
function cached(key, f) { return geoCache[key] || (geoCache[key] = f()); }
class Kit {
  constructor() { this.parts = []; this.m = new THREE.Matrix4(); this.stack = []; this.lights = []; }
  push(x, y, z, ry = 0) { this.stack.push(this.m.clone()); this.m.multiply(M(x, y, z, 0, ry)); }
  pop() { this.m = this.stack.pop(); }
  add(geo, mat, tint, local, opt) { const m = this.m.clone(); if (local) m.multiply(local); this.parts.push({ geo, m, mat, tint, opt: opt || {} }); }
  box(x, y0, z, w, h, d, mat, tint, opt = {}) { this.add(BOX, mat, tint, M(x, y0 + h / 2, z, opt.rx || 0, opt.ry || 0, opt.rz || 0, w, h, d), opt); }
  boxC(x, y, z, w, h, d, mat, tint, rx = 0, ry = 0, rz = 0, opt) { this.add(BOX, mat, tint, M(x, y, z, rx, ry, rz, w, h, d), opt); }
  cyl(x, y0, z, r0, r1, h, mat, tint, seg = 8, opt) { this.add(cached(`c${r0},${r1},${seg}`, () => new THREE.CylinderGeometry(r1, r0, 1, seg).toNonIndexed()), mat, tint, M(x, y0 + h / 2, z, 0, (opt && opt.ry) || 0, 0, 1, h, 1), opt); }
  cylX(x, y, z, r, len, mat, tint, seg = 8) { this.add(cached(`cx${seg}`, () => new THREE.CylinderGeometry(1, 1, 1, seg).toNonIndexed()), mat, tint, M(x, y, z, 0, 0, Math.PI / 2, r, len, r)); }
  sphere(x, y, z, r, mat, tint, sy = 1, sx = 1) { this.add(cached('s', () => new THREE.SphereGeometry(1, 12, 8).toNonIndexed()), mat, tint, M(x, y, z, 0, 0, 0, r * sx, r * sy, r)); }
  cone(x, y0, z, r, h, mat, tint, seg = 10, ry = 0) { this.add(cached(`cone${seg}`, () => new THREE.ConeGeometry(1, 1, seg).toNonIndexed()), mat, tint, M(x, y0 + h / 2, z, 0, ry, 0, r, h, r)); }
  dome(x, y0, z, r, mat, tint, hs = 1, seg = 16) { this.add(cached(`dome${seg}`, () => new THREE.SphereGeometry(1, seg, Math.max(4, seg / 2 | 0), 0, Math.PI * 2, 0, Math.PI / 2).toNonIndexed()), mat, tint, M(x, y0, z, 0, 0, 0, r, r * hs, r)); }
  glow(x, y, z, w, h, ry = 0) { this.add(PLANE, 'glow', 0xffffff, M(x, y, z, 0, ry, 0, w, h, 1), { uv: true }); }
  light(x, y, z) { this.lights.push(this.world(x, y, z)); }
  world(x, y, z) { return new V3(x, y, z).applyMatrix4(this.m); }
  // a tree from the game's own tree builder (BLD.treeGeo), with its vertex colours
  tree(x, z, type, s = 1) {
    const g = cached('tree' + type, () => { const t = BLD.treeGeo(type); const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(t.pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(t.col, 3)); geo.computeVertexNormals(); return geo; });
    this.add(g, 'leaf', 0xffffff, M(x, 0, z, 0, (x * 7.3 + z * 3.1) % 6.28, 0, s, s, s), { vcol: true });
  }
}

// ---------- shapes ----------
// An opening: { x, yb, ys, w, arch: 'round'|'pointed'|'flat'|'cusped'|'horseshoe', kind }. ys = springing line.
function archCurve(o, grow = 0) {   // points from the left springing to the right, over the top
  const w = o.w + 2 * grow, x0 = o.x - w / 2, x1 = o.x + w / 2, ys = o.ys, pts = [];
  const a = o.arch || 'flat';
  if (a === 'flat') return [[x0, ys], [x1, ys]];
  if (a === 'round' || a === 'horseshoe') {
    const r = w / 2, ext = a === 'horseshoe' ? .35 : 0, n = 14;
    for (let i = 0; i <= n; i++) { const t = Math.PI + ext - (Math.PI + 2 * ext) * i / n; pts.push([o.x + Math.cos(t) * r, ys + Math.sin(t) * r + (a === 'horseshoe' ? r * Math.sin(ext) : 0)]); }
    if (a === 'horseshoe') { pts.unshift([x0 + r * (1 - Math.cos(ext)), ys]); pts.push([x1 - r * (1 - Math.cos(ext)), ys]); }
    return pts;
  }
  if (a === 'pointed' || a === 'cusped') {   // two arcs of radius 0.8 w meeting at a point
    const R = w * .8, n = 8, cxL = x0 + R, cxR = x1 - R, top = Math.sqrt(R * R - (R - w / 2) ** 2);
    const aEnd = Math.atan2(top, o.x - cxL);
    for (let i = 0; i <= n; i++) { const t = Math.PI - (Math.PI - aEnd) * i / n; pts.push([cxL + Math.cos(t) * R, ys + Math.sin(t) * R]); }
    for (let i = n - 1; i >= 0; i--) { const t = Math.PI - (Math.PI - aEnd) * i / n; pts.push([cxR - Math.cos(t) * R, ys + Math.sin(t) * R]); }
    if (a === 'cusped') { // three small lobes: push the curve in a little between them
      for (let i = 1; i < pts.length - 1; i++) { const f = i / (pts.length - 1); const lobe = Math.abs(Math.sin(f * Math.PI * 3)); pts[i][1] -= (1 - lobe) * w * .06; }
    }
    return pts;
  }
  return [[x0, ys], [x1, ys]];
}
const holeTop = o => { const c = archCurve(o); return Math.max(...c.map(p => p[1])); };
// a wall face with real openings, extruded inward from zF
function facade(k, y0, h, w, zF, holes, mat, tint, opt = {}) {
  const T = opt.t || .45, s = new THREE.Shape(); const x0 = opt.x0 !== undefined ? opt.x0 : -w / 2, x1 = x0 + w;
  s.moveTo(x0, 0); s.lineTo(x1, 0); s.lineTo(x1, h); s.lineTo(x0, h); s.lineTo(x0, 0);
  for (const o of holes) {
    const p = new THREE.Path(), c = archCurve(o), xl = o.x - o.w / 2, xr = o.x + o.w / 2;
    p.moveTo(xl, o.yb); p.lineTo(xl, o.ys); for (const q of c) p.lineTo(q[0], q[1]); p.lineTo(xr, o.ys); p.lineTo(xr, o.yb); p.lineTo(xl, o.yb);
    s.holes.push(p);
  }
  k.add(new THREE.ExtrudeGeometry(s, { depth: T, bevelEnabled: false, curveSegments: 6 }), mat, tint, M(0, y0, zF - T), { grime: opt.grime });
}
// the arch ring (voussoirs) around an opening, standing proud of the wall
function ring(k, o, y0, zF, band, mat, tint, depth = .07) {
  if (!o.arch || o.arch === 'flat') return;
  const inner = archCurve(o), outer = archCurve(o, band), s = new THREE.Shape();
  s.moveTo(outer[0][0], outer[0][1]); for (const p of outer) s.lineTo(p[0], p[1]);
  s.lineTo(inner[inner.length - 1][0], inner[inner.length - 1][1]); for (let i = inner.length - 1; i >= 0; i--) s.lineTo(inner[i][0], inner[i][1]);
  s.lineTo(outer[0][0], outer[0][1]);
  k.add(new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false }), mat, tint, M(0, y0, zF));
}
// alternating light and dark voussoirs (ablaq), Mamluk style
function ablaq(k, o, y0, zF, band, light, dark) {
  const inner = archCurve(o), outer = archCurve(o, band), n = inner.length - 1;
  for (let i = 0; i < n; i++) {
    const s = new THREE.Shape(); const a = outer[Math.round(i * (outer.length - 1) / n)], b = outer[Math.round((i + 1) * (outer.length - 1) / n)];
    s.moveTo(inner[i][0], inner[i][1]); s.lineTo(a[0], a[1]); s.lineTo(b[0], b[1]); s.lineTo(inner[i + 1][0], inner[i + 1][1]); s.lineTo(inner[i][0], inner[i][1]);
    k.add(new THREE.ExtrudeGeometry(s, { depth: .07, bevelEnabled: false }), 'stoneWarm', i % 2 ? dark : light, M(0, y0, zF));
  }
}
function segs(x0, x1, cuts) { cuts = cuts.slice().sort((a, b) => a[0] - b[0]); const out = []; let cur = x0; for (const [a, b] of cuts) { if (a > cur) out.push([cur, Math.min(a, x1)]); cur = Math.max(cur, b); } if (cur < x1) out.push([cur, x1]); return out.filter(s => s[1] - s[0] > .06); }
function cutsAt(holes, ya, yb) { return holes.filter(o => o.yb < yb && holeTop(o) > ya).map(o => [o.x - o.w / 2 - .03, o.x + o.w / 2 + .03]); }
// a horizontal band across a facade, broken at the openings
function band(k, y0, y, h, w, zF, holes, mat, tint, proud = .02, x0) { const a0 = x0 !== undefined ? x0 : -w / 2; for (const [a, b] of segs(a0, a0 + w, cutsAt(holes, y, y + h))) k.box((a + b) / 2, y0 + y, zF + proud / 2, b - a, h, proud, mat, tint); }
// the back of an opening: a dark room, or lamplight at night
function windowFill(k, o, y0, zF, lit, T = .45, tintLit = 0x3a2414) {
  const top = holeTop(o), cx = o.x, cy = y0 + (o.yb + top) / 2, hh = top - o.yb;
  k.boxC(cx, cy, zF - T * .72, o.w + .1, hh + .1, .05, lit ? 'lit' : 'dark', lit ? tintLit : 0x1c1611);
  if (lit) k.glow(cx, cy - .1, zF + .04, o.w * 2.6, hh * 1.9);
}
function shutters(k, o, y0, zF, tint) { const hs = o.ys - o.yb + (o.arch && o.arch !== 'flat' ? o.w * .35 : 0); for (const sgn of [-1, 1]) k.box(o.x + sgn * (o.w * .75 + .02), y0 + o.yb, zF + .04, o.w / 2, hs, .05, 'planks', tint); }
function grille(k, o, y0, zF, n = 3) { const top = holeTop(o), hh = top - o.yb, cy = y0 + (o.yb + top) / 2; for (let j = 0; j < n; j++) k.boxC(o.x + (j - (n - 1) / 2) * o.w / (n + .5), cy, zF - .14, .035, hh, .035, 'iron', 0x2a2622); }
function lattice(k, x, y, z, w, h, tint, step = .12, mat = 'planks') {   // wooden screen (mashrabiya, jali, Chinese lattice)
  for (let u = -w / 2 + step / 2; u < w / 2; u += step) k.boxC(x + u, y + h / 2, z, .035, h, .035, mat, tint);
  for (let v = step / 2; v < h; v += step) k.boxC(x, y + v, z + .01, w, .035, .035, mat, tint);
}
function door(k, o, zF, tint, depth = .3) { k.box(o.x, o.yb - .2, zF - depth, o.w + .1, holeTop(o) - o.yb + .4, .08, 'boards', tint); }
// roofs ---------------------------------------------------------------
function gableEnd(len, base, h0, hA) { const s = new THREE.Shape(); s.moveTo(-base / 2, 0); s.lineTo(base / 2, 0); s.lineTo(base / 2, h0); s.lineTo(0, hA); s.lineTo(-base / 2, h0); s.lineTo(-base / 2, 0); return new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false }); }
// eaves along x; ridge along x at zc. Wall top at H; depth DT between wall faces
function gableRoof(k, w, DT, zc, H, o) {
  const pitch = o.pitch || .42, ov = o.over !== undefined ? o.over : .55, side = o.side || .02, half = DT / 2 + ov, tp = Math.tan(pitch);
  const yE = H + .08, rise = half * tp, len = half / Math.cos(pitch) + .04, th = o.th || .14;
  for (const sgn of [1, -1]) {
    k.boxC(0, yE + rise / 2 + th / 2, zc + sgn * half / 2, w + 2 * side, th, len, o.mat || 'tile', o.tint, sgn * pitch);
    if (o.beams !== false) { const n = Math.max(3, Math.round(w / .55)); for (let j = 0; j < n; j++) { const x = (j + .5 - n / 2) * w / n; k.box(x, H + .03, zc + sgn * (DT / 2 + ov / 2 - .02), .1, .13, ov + .1, 'planks', o.beamT || 0x4e3524); } }
  }
  if (o.ridge !== false) k.add(cached('ridge', () => new THREE.CylinderGeometry(.13, .13, 1, 8, 1, false, 0, Math.PI).toNonIndexed()), o.mat || 'tile', o.ridgeT || o.tint, M(0, yE + rise + .08, zc, 0, 0, Math.PI / 2, 1, w + 2 * side + .06, 1));
  if (o.ends !== false) { const h0 = (yE - H) + ov * tp - .03, hA = (yE - H) + rise - .03; for (const sgn of [-1, 1]) k.add(gableEnd(o.endT || .45, DT, h0, hA), o.endMat, o.endTint, M(sgn > 0 ? w / 2 - (o.endT || .45) : -w / 2, H, zc, 0, Math.PI / 2)); }
  return yE + rise;
}
// a hipped roof with real thickness (four slopes), optional flared Chinese eaves
function hipRoofGeo(w, d, rise, flare, lift, gable) {
  // heightfield over the roof's footprint, u = distance in from the eave (0 eave .. 1 ridge); gable: slopes to the z sides only
  const nx = 22, nz = 14, top = [], P = [];
  const hw = w / 2, hd = d / 2, hm = gable ? hd : Math.min(hw, hd), H = (x, z) => {
    const ex = gable ? 1e9 : hw - Math.abs(x), ez = hd - Math.abs(z), u = Math.min(1, Math.min(ex, ez) / hm);
    let y = rise * (flare ? Math.pow(u, 1.7) : u);
    if (lift) { const a = Math.min(hw, hd) * .55, exr = hw - Math.abs(x); const fx = Math.max(0, 1 - exr / a), fz = Math.max(0, 1 - ez / a); y += lift * fx * fx * fz * fz + lift * .25 * ((gable ? 0 : fx * fx) + fz * fz) * (flare ? 1 : 0); }
    return y;
  };
  for (let i = 0; i <= nx; i++) { top.push([]); for (let j = 0; j <= nz; j++) { const x = -hw + w * i / nx, z = -hd + d * j / nz; top[i].push([x, H(x, z), z]); } }
  const quad = (a, b, c, d2) => P.push(...a, ...b, ...c, ...a, ...c, ...d2);
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) quad(top[i][j], top[i][j + 1], top[i + 1][j + 1], top[i + 1][j]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.computeVertexNormals();
  // underside and fascia
  const U = [], th = .16;
  const dn = p => [p[0], p[1] - th, p[2]];
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const a = dn(top[i][j]), b = dn(top[i][j + 1]), c = dn(top[i + 1][j + 1]), d2 = dn(top[i + 1][j]); U.push(...a, ...d2, ...c, ...a, ...c, ...b); }
  const edge = []; for (let i = 0; i < nx; i++) edge.push([top[i][0], top[i + 1][0]]); for (let j = 0; j < nz; j++) edge.push([top[nx][j], top[nx][j + 1]]); for (let i = nx; i > 0; i--) edge.push([top[i][nz], top[i - 1][nz]]); for (let j = nz; j > 0; j--) edge.push([top[0][j], top[0][j - 1]]);
  for (const [a, b] of edge) { U.push(...a, ...dn(a), ...dn(b), ...a, ...dn(b), ...b); }
  const gu = new THREE.BufferGeometry(); gu.setAttribute('position', new THREE.Float32BufferAttribute(U, 3)); gu.computeVertexNormals();
  return [g, gu];
}
function hipRoof(k, x, H, z, w, d, rise, mat, tint, o = {}) {
  const key = `hip${w.toFixed(2)},${d.toFixed(2)},${rise.toFixed(2)},${!!o.flare},${o.lift || 0},${!!o.gable}`;
  const [g, gu] = cached(key, () => hipRoofGeo(w, d, rise, o.flare, o.lift || 0, o.gable));
  k.add(g, mat, tint, M(x, H, z, 0, o.ry || 0)); k.add(gu, o.underMat || 'planks', o.underT || 0x5a3e2a, M(x, H, z, 0, o.ry || 0));
  return H + rise;
}
// flat roof with a parapet: 'plain' | 'merlons' (square) | 'stepped' | 'round' (Persian) | 'horns' (Yemen corners)
function flatRoof(k, w, d, zc, H, mat, tint, style = 'plain', o = {}) {
  const ph = o.ph || .55, t = o.t || .3;
  k.box(0, H - .02, zc, w - .1, .1, d - .1, o.deckMat || 'mudwall', o.deckT || 0xc9b08a);
  for (const sgn of [-1, 1]) { k.box(0, H, zc + sgn * (d / 2 - t / 2), w, ph, t, mat, tint); k.box(sgn * (w / 2 - t / 2), H, zc, t, ph, d - 2 * t, mat, tint); }
  if (style === 'plain') return;
  const step = o.step || .7, edges = [[0, zc + d / 2 - t / 2, w, 0], [0, zc - d / 2 + t / 2, w, 0], [-w / 2 + t / 2, zc, d, 1], [w / 2 - t / 2, zc, d, 1]];
  for (const [ex, ez, L, rot] of edges) {
    const n = Math.max(2, Math.floor(L / step));
    for (let i = 0; i < n; i++) {
      const f = (i + .5) / n - .5, x = ex + (rot ? 0 : f * L), z = ez + (rot ? f * L : 0);
      if (style === 'merlons') k.box(x, H + ph, z, rot ? t : step * .5, .32, rot ? step * .5 : t, mat, tint);
      else if (style === 'stepped') { k.box(x, H + ph, z, rot ? t : step * .55, .2, rot ? step * .55 : t, mat, tint); k.box(x, H + ph + .2, z, rot ? t : step * .3, .2, rot ? step * .3 : t, mat, tint); }
      else if (style === 'round') { k.box(x, H + ph, z, rot ? t : step * .5, .14, rot ? step * .5 : t, mat, tint); k.add(cached('rmerl', () => new THREE.CylinderGeometry(.5, .5, 1, 10, 1, false, 0, Math.PI).toNonIndexed()), mat, tint, M(x, H + ph + .14, z, 0, rot ? Math.PI / 2 : 0, Math.PI / 2, step * .25, t, step * .25)); }
    }
  }
  if (style === 'horns' || o.horns) for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(sx * (w / 2 - t / 2), H + ph, zc + sz * (d / 2 - t / 2), t + .06, .7, t + .06, mat, o.hornT || tint);
}

// ============================================================
//  Town houses on narrow lots (game type rowHouse): Byzantine, Levant (Acre), Armenian, Georgian
//  Front faces +z at z = d/2; lot w x d. Clean and solid.
// ============================================================
const PAL = {
  plaster: [0xeadcc0, 0xe6d3ae, 0xdcc49c, 0xe9d6c4, 0xd8c3a5, 0xefe3cc],
  stone: [0xdcd0b8, 0xd2c4a6, 0xe0d4bc],
  rubble: [0xc9b596, 0xbfa889],
  brick: [0xc0866a, 0xb77a5d, 0xc99475],
  roof: [0xb5523b, 0xa8492f, 0xbf6343, 0xa95238, 0xb85d40],
  shutter: [0x3d5f52, 0x6a3a2a, 0x3a4a62, 0x5a4a32, 0x7a5a2e],
  door: [0x5e3d26, 0x4a3020, 0x6a4628, 0x3d4a3a],
  cloth: [0xb0402c, 0x2f6f8f, 0xd09a2a, 0x5a7a3a, 0xe0d4b8, 0x8a2a24, 0x9a6a2a],
  timber: 0x6b4a30, timberD: 0x4e3524,
};
const TOWN = {
  byz: { arch: 'round', walls: [['plaster', .5], ['mixed', .32], ['brick', .18]], jetty: .55, shop: .4, roof: 'gable', hg: 3.0 },
  levant: { arch: 'pointed', walls: [['stoneWarm', .7], ['rubble', .3]], jetty: 0, shop: .5, roof: 'flat', hg: 3.4, stone: [0xe6dcc6, 0xdccfb2, 0xeee4cf, 0xd8c8a8] },
  armenian: { arch: 'round', walls: [['tuff', 1]], jetty: 0, shop: .3, roof: 'stoneslab', hg: 3.0, stone: [0xc99a86, 0xb98774, 0xd2a892, 0xa8826e, 0xcdb4a0] },
  georgian: { arch: 'round', walls: [['rubble', .45], ['brick', .3], ['plaster', .25]], jetty: 0, gallery: .7, shop: .35, roof: 'shingle', hg: 2.9 },
};
const T = .45, HF = 2.65;
function townHouse(k, L, cul) {
  const S = TOWN[cul] || TOWN.byz, r = rng32(L.seed), w = L.w, d = L.d;
  const fl = 2 + (r() < .45 ? 1 : 0), shop = r() < S.shop, jetty = r() < S.jetty, gallery = r() < (S.gallery || 0);
  let wt = r(), wallT = S.walls[0][0]; for (const [n, p] of S.walls) { if (wt < p) { wallT = n; break; } wt -= p; }
  const tones = S.stone || PAL.stone;
  const wMat = { plaster: 'plaster', mixed: 'rubble', brick: 'brick', stoneWarm: 'stoneWarm', rubble: 'rubble', tuff: 'ashlar' }[wallT];
  const wTint = wallT === 'plaster' ? pick(r, PAL.plaster) : wallT === 'mixed' || wallT === 'rubble' ? (cul === 'levant' ? pick(r, tones) : pick(r, PAL.rubble)) : wallT === 'brick' ? pick(r, PAL.brick) : pick(r, tones);
  const stoneT = pick(r, tones), trimMat = wallT === 'mixed' ? 'brick' : cul === 'armenian' ? 'ashlar' : 'stoneWarm', trimT = wallT === 'mixed' ? pick(r, PAL.brick) : cul === 'armenian' ? pick(r, tones) : pick(r, PAL.stone);
  const upMat = jetty ? 'plaster' : wMat, upTint = jetty ? pick(r, PAL.plaster) : wTint;
  const HG = S.hg, F = d / 2, FU = jetty ? F + .55 : F, H = HG + (fl - 1) * HF, A = S.arch;
  const ringT = wallT === 'brick' ? stoneT : trimT, ringM = wallT === 'brick' ? 'stoneWarm' : trimMat;

  // --- ground floor ---
  const gh = [];
  const dx = shop ? (r() < .5 ? -1 : 1) * Math.max(0, (w - 4.2) / 2) : -w * .22;
  if (shop) gh.push(cul === 'levant' ? { x: dx * .5, yb: .5, ys: 1.9, w: Math.min(2.8, w - 1.6), arch: 'pointed', kind: 'shop' } : { x: dx * .5, yb: .55, ys: 2.45, w: Math.min(3.0, w - 1.5), arch: 'flat', kind: 'shop' });
  else { gh.push({ x: dx, yb: .18, ys: 1.98, w: 1.15, arch: A, kind: 'door' }); gh.push({ x: w * .24, yb: 1.0, ys: 1.85, w: .66, arch: A, kind: 'win' }); }
  facade(k, 0, HG, w, F, gh, wMat, wTint, { grime: true });
  k.box(-(w / 2 - T / 2), 0, -T / 2, T, HG, d - T, wMat, wTint, { grime: true }); k.box(w / 2 - T / 2, 0, -T / 2, T, HG, d - T, wMat, wTint, { grime: true });
  k.box(0, 0, -F + T / 2, w - 2 * T, HG, T, wMat, wTint, { grime: true });
  for (const [a, b] of segs(-w / 2, w / 2, cutsAt(gh, 0, .45))) k.box((a + b) / 2, 0, F + .04, b - a, .45, .08, 'ashlar', cul === 'armenian' ? 0xa8826e : 0xc9bba0, { grime: true });
  const bands = (y0, h, holes, zF) => { if (wallT !== 'mixed') return; for (let y = .95; y < h - .3; y += 1.05) band(k, y0, y, .24, w, zF, holes, 'brick', trimT, .02); };
  bands(0, HG, gh, F);
  for (const o of gh) {
    if (o.kind === 'door') {
      ring(k, o, 0, F, .22, ringM, ringT);
      for (const sgn of [-1, 1]) k.box(o.x + sgn * (o.w / 2 + .11), .18, F + .035, .22, o.ys - .18, .07, ringM, ringT);
      if (cul === 'armenian') { k.box(o.x, 0, F + .03, o.w + 1.0, .1, .1, 'ashlar', ringT); k.box(o.x, holeTop(o) + .28, F + .05, o.w + 1.0, .2, .12, 'ashlar', ringT); }   // carved portal frame
      door(k, o, F, pick(r, PAL.door));
      k.box(o.x, 0, F + .35, o.w + .5, .14, .5, 'ashlar', 0xc4b79f, { grime: true });
      if (r() < .45) { const lx = o.x + o.w / 2 + .45; k.box(lx, 2.35, F + .2, .05, .05, .4, 'iron', 0x2a2622); k.box(lx, 2.0, F + .38, .2, .3, .2, 'lit', 0x4a3420); k.box(lx, 2.3, F + .38, .26, .05, .26, 'iron', 0x2a2622); k.glow(lx, 2.15, F + .5, 1.6, 1.6); k.light(lx, 2.1, F + .7); }
      if (r() < .5) { const px = o.x - o.w / 2 - .45; k.cyl(px, 0, F + .35, .2, .26, .5, 'brick', 0xb8734a); k.sphere(px, .75, F + .35, .32, 'leaf', 0x4f6a2e, .85); }
    } else if (o.kind === 'win') {
      ring(k, o, 0, F, .14, ringM, ringT, .06); k.box(o.x, o.yb - .09, F - .05, o.w + .24, .09, .2, 'ashlar', 0xd0c4aa);
      windowFill(k, o, 0, F, r() < .5); grille(k, o, 0, F);
    } else {   // shop front
      const x0 = o.x - o.w / 2, x1 = o.x + o.w / 2;
      if (o.arch === 'flat') k.box(o.x, o.ys, F + .04, o.w + .5, .28, .1, 'planks', PAL.timber); else ring(k, o, 0, F, .24, ringM, ringT);
      k.box(o.x, o.yb - .05, F + .18, o.w - .1, .08, .7, 'planks', 0x8a6040);
      const room = 1.8, rc = 0x7a6450; k.box(o.x, .05, F - T - room / 2, o.w + .3, .05, room, 'boards', 0x6a5440); k.box(o.x, 0, F - T - room, o.w + .3, HG - .2, .06, 'plaster', rc);
      for (const y of [1.0, 1.7]) k.box(o.x, y, F - T - room + .2, o.w - .2, .05, .35, 'planks', 0x8a6040);
      for (let j = 0; j < 5; j++) k.box(o.x - o.w / 2 + .4 + j * (o.w - .8) / 4, 1.05, F - T - room + .2, .28, .3, .25, 'cloth', pick(r, PAL.cloth));
      for (const sx of [x0 - .1, x1 + .1]) k.box(sx, 0, F - T - room / 2, .06, HG - .2, room, 'plaster', rc);
      k.box(o.x, HG - .3, F - T - room / 2, o.w + .3, .06, room, 'planks', 0x5a4030);
      for (let j = 0; j < 4; j++) { const gx = x0 + .35 + j * (o.w - .7) / 3; const gk = r(); if (gk < .4) k.cyl(gx, o.yb + .03, F + .2, .13, .18, .42, 'brick', pick(r, [0xb8734a, 0xa8633a, 0xc9a06a]), 7); else if (gk < .7) k.sphere(gx, o.yb + .23, F + .2, .24, 'cloth', pick(r, [0xc9b08a, 0xb89a6a, 0xd8c8a0]), .8); else k.box(gx, o.yb + .03, F + .2, .4, .22, .4, 'planks', 0x9a7048); }
      const cl = pick(r, PAL.cloth), aw = o.w + .7, out = 1.5, drop = .55, len = Math.hypot(out, drop), a = Math.atan2(drop, out), ya = Math.max(holeTop(o) + .35, HG - .1);
      k.boxC(o.x, ya - drop / 2, F + out / 2, aw, .04, len, 'cloth', cl, a);
      k.box(o.x, ya - drop - .26, F + out, aw, .26, .03, 'cloth', cl);
      for (const sx of [o.x - aw / 2 + .06, o.x + aw / 2 - .06]) k.cyl(sx, 0, F + out - .04, .045, .05, ya - drop, 'planks', PAL.timber, 6);
    }
  }
  // --- upper floors ---
  if (jetty) {
    k.box(0, HG - .14, F + .55 / 2, w, .14, .57, 'planks', 0x7a5638);
    const n = Math.max(3, Math.round(w / .62)); for (let j = 0; j < n; j++) { const x = (j + .5 - n / 2) * w / n; k.box(x, HG - .32, F + .55 / 2 - .05, .14, .18, .85, 'planks', PAL.timberD); }
    for (const sx of [-w / 2 + .35, w / 2 - .35]) { const z0 = F, z1 = F + .49, y0 = HG - 1.15, y1 = HG - .3; k.boxC(sx, (y0 + y1) / 2, (z0 + z1) / 2, .13, Math.hypot(z1 - z0, y1 - y0), .13, 'planks', PAL.timberD, Math.atan2(z1 - z0, y1 - y0)); }
  }
  const nW = Math.max(1, Math.round(w / 1.9));
  for (let f = 1; f < fl; f++) {
    const y0 = HG + (f - 1) * HF, holes = [];
    for (let j = 0; j < nW; j++) {
      const x = (j + .5 - nW / 2) * w / nW;
      if (jetty) holes.push({ x, yb: .85, ys: 1.95, w: .8, arch: 'flat' });
      else if (cul === 'levant' && w / nW > 1.7) { holes.push({ x: x - .3, yb: .8, ys: 1.6, w: .46, arch: 'pointed', pair: 1 }); holes.push({ x: x + .3, yb: .8, ys: 1.6, w: .46, arch: 'pointed', pair: -1 }); }   // bifora
      else holes.push({ x, yb: .8, ys: 1.72, w: .72, arch: A });
    }
    facade(k, y0, HF, w, FU, holes, upMat, upTint);
    const DU = FU + F;
    k.box(-(w / 2 - T / 2), y0, (FU - F) / 2 - T / 2, T, HF, DU - T, upMat, upTint); k.box(w / 2 - T / 2, y0, (FU - F) / 2 - T / 2, T, HF, DU - T, upMat, upTint);
    k.box(0, y0, -F + T / 2, w - 2 * T, HF, T, upMat, upTint);
    if (jetty) {
      const posts = [-w / 2 + .08, w / 2 - .08]; for (let j = 1; j < nW; j++) posts.push((j - nW / 2) * w / nW);
      for (const x of posts) k.box(x, y0, FU + .015, .16, HF, .05, 'planks', PAL.timber);
      for (const y of [0, HF - .16]) k.box(0, y0 + y, FU + .02, w, .16, .06, 'planks', PAL.timber);
      for (const o of holes) { k.box(o.x, y0 + o.yb - .14, FU + .025, o.w + .3, .14, .08, 'planks', PAL.timber); k.box(o.x, y0 + o.ys, FU + .025, o.w + .3, .14, .07, 'planks', PAL.timber); }
    } else {
      bands(y0, HF, holes, FU);
      k.box(0, y0 - .08, FU + .02, w, .16, .14, trimMat, trimT);
      for (const o of holes) {
        ring(k, o, y0, FU, o.pair ? .1 : .15, ringM, ringT, .06);
        if (o.pair === 1) k.cyl(o.x + o.w / 2 + .07, y0 + o.yb, FU - .1, .06, .06, o.ys - o.yb, 'ashlar', 0xe8dcc4, 8);   // colonnette of the bifora
        if (o.pair !== -1) k.box(o.pair ? o.x + .3 : o.x, y0 + o.yb - .09, FU - .05, (o.pair ? 1.06 : o.w) + .24, .09, .2, 'ashlar', 0xd0c4aa);
      }
    }
    const shutT = pick(r, PAL.shutter);
    for (const o of holes) { windowFill(k, o, y0, FU, r() < .55); if (!o.pair && cul !== 'armenian') shutters(k, o, y0, FU, shutT); }
    if (gallery && f === fl - 1) {   // Tbilisi-style carved wooden gallery across the top floor
      const gw = w - .2, gd = 1.0, gy = y0 - .05, gt = 0x6a4a30;
      k.box(0, gy, FU + gd / 2, gw, .12, gd, 'planks', 0x7a5638);
      for (let j = 0; j <= 7; j++) k.box(-gw / 2 + .05 + j * (gw - .1) / 7, gy, FU + gd - .05, .1, HF - .1, .1, 'planks', gt);
      for (let j = 0; j < 7; j++) lattice(k, -gw / 2 + (j + .5) * gw / 7, gy + .12, FU + gd - .04, gw / 7 - .14, .8, 0x8a6a48, .16);
      k.box(0, gy + .92, FU + gd - .05, gw, .08, .12, 'planks', gt); k.box(0, gy + HF - .2, FU + gd / 2, gw, .1, gd, 'planks', gt);
      const nb = Math.round(gw / .6); for (let j = 0; j < nb; j++) k.boxC(-gw / 2 + (j + .5) * gw / nb, gy - .3, FU + gd / 2 - .1, .12, .5, .12, 'planks', gt, .7);
    } else if (!jetty && f === 1 && fl === 3 && r() < .5) {
      const o = holes[Math.floor(holes.length / 2)]; const bw = Math.min(w - .6, 2.4);
      k.box(o.x, y0 - .05, FU + .45, bw, .1, .9, 'planks', 0x8a6040);
      for (let j = 0; j <= 6; j++) k.box(o.x - bw / 2 + .05 + j * (bw - .1) / 6, y0 + .05, FU + .86, .06, .85, .06, 'planks', PAL.timberD);
      k.box(o.x, y0 + .88, FU + .86, bw, .07, .08, 'planks', PAL.timberD);
      for (const sx of [o.x - bw / 2 + .2, o.x + bw / 2 - .2]) k.boxC(sx, y0 - .45, FU + .22, .1, .9, .1, 'planks', PAL.timberD, .7);
    }
  }
  if (wallT !== 'mixed') for (const sgn of [L.openL ? -1 : 0, L.openR ? 1 : 0]) { if (!sgn) continue; for (let y = .45, j = 0; y < HG - .1; y += .3, j++) { const qw = j % 2 ? .3 : .5; k.box(sgn * (w / 2 - qw / 2 + .01), y, F - .25 + .01, qw + .02, .29, .52, 'ashlar', cul === 'armenian' ? 0xb98774 : 0xd6cab0); } }
  // --- roof ---
  const DT = FU + F, zc = (FU - F) / 2;
  if (S.roof === 'flat') {
    flatRoof(k, w, DT, zc, H, wMat, wTint, 'plain', { ph: .7, deckMat: 'plaster', deckT: 0xd8ccb4 });
    k.box(0, H - .26, zc + DT / 2 + .06, w, .2, .14, 'stoneWarm', stoneT);
    const pr = r();
    if (pr < .4) { k.cyl(0, H, zc - DT * .1, Math.min(w, DT) * .3, Math.min(w, DT) * .3, .3, wMat, wTint, 16); k.dome(0, H + .3, zc - DT * .1, Math.min(w, DT) * .3, 'plaster', 0xe6dcc8, .55); }   // roof dome over a vault
    else if (pr < .7) {   // rooftop loggia: a little arcade with a tiled lean-to
      const lw = w - .8, lz = zc - DT / 2 + 1.4, hs = []; const n = Math.max(2, Math.round(lw / 1.3));
      for (let j = 0; j < n; j++) hs.push({ x: -lw / 2 + (j + .5) * lw / n, yb: .02, ys: 1.5, w: lw / n - .4, arch: 'pointed' });
      facade(k, H, 2.4, lw, lz + 1.1, hs, wMat, wTint, { t: .3 }); k.box(0, H, lz - .4, lw, 2.4, .3, wMat, wTint);
      k.box(0, H + 2.4, lz + .3, lw + .3, .18, 2.2, 'plaster', 0xd8ccb4);
      if (r() < .5) { const lit = r() < .5; k.box(0, H + .1, lz - .2, lw - .4, 1.8, .05, lit ? 'lit' : 'dark', 0x3a2414); }
    }
    if (r() < .35) for (let j = 0; j < 6; j++) k.box(w / 2 - .45, H - (j + 1) * .5, F - 1.2 - j * .4, .8, .5, .4, wMat, wTint);   // stair up to the roof (side)
    return;
  }
  const roofMat = S.roof === 'shingle' ? 'shingles' : S.roof === 'stoneslab' ? 'slate' : 'tile';
  const roofT = S.roof === 'shingle' ? pick(r, [0x8a6a4a, 0x7a5a3e, 0x96724e]) : S.roof === 'stoneslab' ? pick(r, [0x9a8a7a, 0x8a7c6e, 0xa8968a]) : pick(r, PAL.roof);
  for (const sgn of [1, -1]) k.box(0, H - .26, zc + sgn * (DT / 2 + .06), w, .3, .2, trimMat, trimT);
  gableRoof(k, w, DT, zc, H, { pitch: S.roof === 'stoneslab' ? .32 : S.roof === 'shingle' ? .5 : .42, mat: roofMat, tint: roofT, ridgeT: S.roof === 'gable' ? 0x9a4630 : roofT, endMat: upMat, endTint: upTint });
  if (r() < .35) { const cx = (r() - .5) * w * .5, cz = zc - DT * .22, rise = (DT / 2 + .55) * Math.tan(.42); k.box(cx, H, cz, .55, rise + 1.0, .55, wMat === 'rubble' ? 'brick' : wMat, wallT === 'mixed' ? trimT : wTint); k.box(cx, H + rise + 1.0, cz, .75, .1, .75, 'ashlar', 0xc9bba0); }
}

// ============================================================
//  Courtyard houses (game type courtyardHouse) and bazaar shop bays (shopBay)
//  Rûm, Arab, Persian, Central Asian, Tarim; Mongol and steppe towns use the Central Asian house.
// ============================================================
const COURT = {
  arab: { wall: ['stoneWarm', 'rubble'], tones: [0xe6d8bc, 0xdccaa6, 0xeadfca, 0xd6c4a0], streetH: [6.2, 7.0], parapet: 'stepped', arch: 'pointed', portal: 'ablaq', oriel: .8, deck: 'plaster', tree: 'date', pave: 'flags' },
  rum: { wall: ['stoneWarm', 'rubble'], tones: [0xd8c4a2, 0xcdb790, 0xdccaa9], streetH: [3.2, 3.2], upper: true, arch: 'pointed', portal: 'stone', tree: 'poplar', pave: 'flags' },
  persian: { wall: ['mudbrick', 'mudwall'], tones: [0xc9a472, 0xd2ae7c, 0xc29a68, 0xd8b88a], streetH: [4.2, 5.0], parapet: 'round', arch: 'pointed', portal: 'pishtaq', badgir: .45, cupola: .4, deck: 'mudwall', tree: 'poplar', pave: 'cracked' },
  central: { wall: ['mudbrick', 'mudwall'], tones: [0xcfae7e, 0xd8b98c, 0xc8a474, 0xdcc096], streetH: [4.0, 4.8], parapet: 'plain', arch: 'pointed', portal: 'carved', cupola: .3, aywan: true, deck: 'mudwall', tree: 'mulberry', pave: 'cracked' },
  tarim: { wall: ['mudwall', 'mudbrick'], tones: [0xcfac78, 0xd6b585, 0xc4a06d], streetH: [3.6, 4.2], parapet: 'plain', arch: 'round', portal: 'carved', porch: .6, aywan: true, deck: 'mudwall', tree: 'poplar', pave: 'cracked' },
};
COURT.mongol = COURT.central; COURT.steppe = COURT.central;
const GLAZE = [0x2fa7a0, 0x2c7fb8, 0x3aa0c0];
function courtyardHouse(k, L, cul) {
  const S = COURT[cul] || COURT.central, r = rng32(L.seed), w = L.w, d = L.d, F = d / 2, t = .5;
  const wMat = r() < .7 ? S.wall[0] : S.wall[1], wT = pick(r, S.tones);
  const H = S.streetH[0] + r() * (S.streetH[1] - S.streetH[0]);
  const dx = (r() < .5 ? -1 : 1) * w * .22, holes = [];
  // --- the street front: a high wall with a portal and few, small, high windows ---
  const portal = { x: dx, yb: .15, ys: 1.95, w: 1.2, arch: S.arch, kind: 'door' };
  if (S.portal === 'pishtaq') { portal.w = 1.3; portal.ys = 2.1; }
  holes.push(portal);
  const nWin = Math.max(1, Math.round(w / 3.2));
  for (let j = 0; j < nWin; j++) { const x = -w / 2 + (j + .5) * w / nWin; if (Math.abs(x - dx) < 1.6) continue; holes.push({ x, yb: H > 5.5 ? 4.0 : 2.3, ys: H > 5.5 ? 4.8 : 2.85, w: .5, arch: S.arch, kind: 'win' }); }
  const frontH = S.upper ? 3.2 : H;
  facade(k, 0, frontH, w, F, holes, wMat, wT, { t, grime: true });
  // side and back walls, rooms around a court
  const sideH = S.upper ? 3.2 : Math.min(H, 4.2);
  k.box(-w / 2 + t / 2, 0, -t / 2, t, sideH, d - t, wMat, wT, { grime: true }); k.box(w / 2 - t / 2, 0, -t / 2, t, sideH, d - t, wMat, wT, { grime: true });
  k.box(0, 0, -F + t / 2, w - 2 * t, sideH, t, wMat, wT, { grime: true });
  const front = 2.6, back = 3.0;   // depth of the street range and the back range
  const courtZ0 = F - front, courtZ1 = -F + back;
  k.box(0, 0, (courtZ0 + courtZ1) / 2, w - 2 * t, .04, courtZ0 - courtZ1, S.pave === 'flags' ? 'stoneWarm' : 'mudwall', S.pave === 'flags' ? 0xd2c4a8 : 0xc4a47c);
  k.box(0, 0, courtZ0 + .15, w - 2 * t, (S.upper ? 3.2 : H) - .02, .3, wMat, wT);   // inner face of the street range
  const bH = S.upper ? 3.2 : Math.min(H + (r() < .5 ? 1.2 : 0), 6.4), back2 = back, cz = (courtZ0 + courtZ1) / 2;
  if (!S.upper) {
  // the back range with an iwan facing the court
  const iw = Math.min(3.2, w * .38);
  const iwan = [{ x: 0, yb: .3, ys: Math.min(2.6, bH - iw * .8 - .4), w: iw, arch: S.arch === 'round' ? 'round' : 'pointed' }];
  facade(k, 0, bH, w - 2 * t, courtZ1 + .2, iwan, wMat, wT, { t: .4 });   // the arched hall (iwan) opens onto the court
  const zr = courtZ1 - 1.0, wi = w - 2 * t, sw = (wi - iw) / 2, it = holeTop(iwan[0]);
  k.box(0, 0, (-F + t + zr) / 2, wi, bH, zr - (-F + t), wMat, wT);
  for (const sgn of [-1, 1]) k.box(sgn * (iw / 2 + sw / 2), 0, (zr + courtZ1 - .2) / 2, sw, bH, courtZ1 - .2 - zr, wMat, wT);
  k.box(0, it, (zr + courtZ1 - .2) / 2, iw, bH - it, courtZ1 - .2 - zr, wMat, wT);
  const ilit = r() < .5; k.box(0, .3, zr + .03, 1.0, 2.0, .05, ilit ? 'lit' : 'dark', 0x3a2a1e); if (ilit) k.glow(0, 1.3, zr + .1, 2.2, 2.6);
  k.box(0, 0, courtZ1 - .5, iw + .2, .3, 1.0, 'ashlar', 0xd2c4a8);
  if (r() < .6) k.box(0, .3, courtZ1 - .7, iw - .4, .06, .8, 'cloth', pick(r, [0x8a2a24, 0x2c4f7a, 0x6a3a5a, 0x9a5a24]));   // a carpet in the iwan
  // the court: a pool or a fountain, a tree, pots
  if (courtZ0 - courtZ1 > 2.5) {
    if (r() < .6) { k.box(0, 0, cz, 1.8, .35, 1.2, 'ashlar', 0xd8ccb4); k.box(0, .05, cz, 1.5, .31, .9, 'glazed', 0x3a8a9a); }
    k.tree(-w / 2 + 1.6, cz, S.tree, .75);
    for (let j = 0; j < 3; j++) { const px = w / 2 - 1.2, pz = cz - 1 + j; k.cyl(px, 0, pz, .2, .26, .55, 'brick', 0xb8734a); k.sphere(px, .75, pz, .28, 'leaf', 0x4f6a2e, .8); }
  }
  // roof decks and parapets
  const deck = S.deck || 'mudwall', deckT = deck === 'plaster' ? 0xdcd0b8 : 0xc9a878;
  if (!S.upper) {
    flatRoof(k, w, front, F - front / 2, H, wMat, wT, S.parapet, { ph: .6, deckMat: deck, deckT, step: .8 });
    flatRoof(k, w - 2 * t, back, -F + back / 2, bH, wMat, wT, S.parapet, { ph: .5, deckMat: deck, deckT, step: .8 });
    for (const sgn of [-1, 1]) { k.push(sgn * (w / 2 - t - .9), 0, 0); flatRoof(k, 1.8, courtZ0 - courtZ1, cz, 3.2, wMat, wT, 'plain', { ph: .3, deckMat: deck, deckT }); k.box(0, 0, cz, 1.8, 3.2, courtZ0 - courtZ1, wMat, wT); k.pop(); }
  }
  }
  // --- portals by culture ---
  const o = portal;
  door(k, o, F, pick(r, [0x5e3d26, 0x4a3020, 0x3d5a6a, 0x6a4628]), .25);
  k.box(o.x, 0, F + .45, o.w + 1.2, .4, .5, 'ashlar', 0xc4b79f, { grime: true });   // mastaba bench / step
  if (S.portal === 'ablaq') {
    const nh = holeTop(o) + .9;   // a tall recessed niche with a stepped hood
    ablaq(k, o, 0, F, .3, 0xeee4cc, 0x8a6a4a);
    for (const sgn of [-1, 1]) k.box(o.x + sgn * (o.w / 2 + .55), 0, F + .1, .3, nh, .2, 'stoneWarm', wT);
    for (let j = 0; j < 3; j++) k.box(o.x, nh - .25 + j * .14, F + .1 + j * .06, o.w + 1.4 - j * .2, .14, .2 + j * .12, 'stoneWarm', j % 2 ? 0x9a7a5a : 0xe6dcc6);
    for (let j = 0; j < 3; j++) k.box(o.x, .4 + j * .9, F + .02, o.w + .8, .14, .04, 'stoneWarm', 0x9a7a5a);   // striped courses
  } else if (S.portal === 'pishtaq') {   // a frame rising above the wall, with a glazed band
    const pw = o.w + 1.6, ph = H + 1.0, gl = pick(r, GLAZE);
    const ph2 = [{ x: 0, yb: .02, ys: 2.3, w: o.w + .7, arch: 'pointed' }];
    k.push(o.x, 0, F + .35, 0); facade(k, 0, ph, pw, 0, ph2, wMat, wT, { t: .35, grime: true }); ring(k, ph2[0], 0, 0, .14, 'glazed', gl, .04); k.pop();
    for (const sgn of [-1, 1]) k.box(o.x + sgn * (pw / 2 - .12), .4, F + .36, .14, ph - .8, .05, 'glazed', gl);
    k.box(o.x, ph - .55, F + .36, pw - .1, .18, .05, 'glazed', gl);
    k.box(o.x, ph, F + .17, pw + .1, .14, .45, wMat, wT);
  } else if (S.portal === 'carved') {   // carved wooden door frame, Bukhara and Kashgar
    for (const sgn of [-1, 1]) k.box(o.x + sgn * (o.w / 2 + .12), 0, F + .04, .24, holeTop(o) + .2, .1, 'planks', 0x7a5638);
    k.box(o.x, holeTop(o) + .1, F + .05, o.w + .6, .3, .14, 'planks', 0x6a4a30); for (let j = 0; j < 6; j++) k.box(o.x - o.w / 2 + .1 + j * (o.w - .2) / 5, holeTop(o) + .4, F + .08, .08, .08, .2, 'planks', 0x6a4a30);
    if (S.arch === 'round') ring(k, o, 0, F, .12, 'planks', 0x7a5638, .06);
  } else {   // stone portal (Rûm)
    ring(k, o, 0, F, .26, 'stoneWarm', 0xe6d8bc);
    for (const sgn of [-1, 1]) k.box(o.x + sgn * (o.w / 2 + .13), 0, F + .035, .26, o.ys, .07, 'stoneWarm', 0xe6d8bc);
  }
  if (r() < .5) { k.box(o.x + o.w / 2 + .5, 2.5, F + .2, .05, .05, .4, 'iron', 0x2a2622); k.box(o.x + o.w / 2 + .5, 2.15, F + .38, .2, .3, .2, 'lit', 0x4a3420); k.glow(o.x + o.w / 2 + .5, 2.3, F + .5, 1.6, 1.6); k.light(o.x + o.w / 2 + .5, 2.25, F + .7); }
  for (const h of holes) if (h.kind === 'win') { windowFill(k, h, 0, F, r() < .45, t); grille(k, h, 0, F, 2); }
  // --- extras by culture ---
  if (S.oriel && r() < S.oriel) {   // mashrabiya: a wooden oriel on corbels
    const ox = -dx * .9, ow = Math.min(2.4, w * .28), oy = 3.3, oh = 2.0, od = .7;
    for (let j = 0; j < 3; j++) k.box(ox, oy - .5 + j * .16, F + .1, ow - .4 + j * .2, .16, .2 + j * .2, 'planks', 0x5a3e28);
    k.box(ox, oy, F + od / 2, ow, .12, od, 'planks', 0x6a4a30); k.box(ox, oy + oh, F + od / 2, ow + .2, .16, od + .2, 'planks', 0x5a3e28);
    const lit = r() < .5; k.box(ox, oy + .1, F + od - .1, ow - .1, oh - .1, .04, lit ? 'lit' : 'dark', 0x3a2414); if (lit) k.glow(ox, oy + 1, F + od + .05, ow * 1.8, oh * 1.4);
    lattice(k, ox, oy + .1, F + od - .02, ow - .1, oh - .12, 0x6a4a30, .1); for (const sgn of [-1, 1]) lattice(k, ox + sgn * (ow / 2 - .02), oy + .1, F + od / 2, .04, oh - .12, 0x6a4a30, .1);
  }
  if (S.upper) {   // Rûm: a timber-framed upper floor with a projecting bay (cumba), under a low hipped tile roof
    const uz = .5, uH = 2.6, uw = w, ud = d + uz, ut = pick(r, [0xeee4d0, 0xe6d8c0, 0xf0e8d8]);
    const uh = []; const n = Math.max(2, Math.round(w / 1.6)); for (let j = 0; j < n; j++) uh.push({ x: -w / 2 + (j + .5) * w / n, yb: .7, ys: 1.9, w: .7, arch: 'flat' });
    k.box(0, 3.2 - .12, F + uz / 2, w, .12, uz + .02, 'planks', 0x6a4a30);
    for (let j = 0; j < Math.round(w / .55); j++) k.box(-w / 2 + (j + .5) * .55, 3.2 - .3, F + .2, .12, .18, uz + .2, 'planks', 0x4e3524);
    facade(k, 3.2, uH, uw, F + uz, uh, 'plaster', ut, { t: .3 });
    for (const sgn of [-1, 1]) k.box(sgn * (w / 2 - .15), 3.2, uz / 2 - .15, .3, uH, ud - .3, 'plaster', ut);
    k.box(0, 3.2, -F + .15, w - .6, uH, .3, 'plaster', ut);
    for (let j = 0; j <= n; j++) k.box(-w / 2 + .07 + j * (w - .14) / n, 3.2, F + uz + .02, .14, uH, .05, 'planks', 0x5a3e28);
    k.box(0, 3.2, F + uz + .03, w, .14, .06, 'planks', 0x5a3e28); k.box(0, 3.2 + uH - .14, F + uz + .03, w, .14, .06, 'planks', 0x5a3e28);
    for (const h of uh) { windowFill(k, h, 3.2, F + uz, r() < .5, .3); lattice(k, h.x, 3.2 + h.yb, F + uz - .05, h.w, h.ys - h.yb, 0x5a3e28, .2); }
    hipRoof(k, 0, 3.2 + uH, uz / 2, w + 1.1, ud + 1.1, 1.5, 'tile', pick(r, PAL.roof));
  }
  if (S.badgir && r() < S.badgir) {   // wind tower
    const bx = w / 2 - 1.4, bz = -F + 1.6, bw = 1.3;
    k.box(bx, bH, bz, bw, 3.2, bw, wMat, wT);
    for (const sgn of [-1, 1]) for (let j = 0; j < 3; j++) { k.box(bx - bw / 2 + .25 + j * .4, bH + 1.4, bz + sgn * (bw / 2 + .01), .14, 1.5, .03, 'dark', 0x1c1611); k.box(bx + sgn * (bw / 2 + .01), bH + 1.4, bz - bw / 2 + .25 + j * .4, .03, 1.5, .14, 'dark', 0x1c1611); }
    k.box(bx, bH + 3.2, bz, bw + .2, .2, bw + .2, wMat, wT);
  }
  if (S.cupola && r() < S.cupola) { const cr = Math.min(1.6, w * .16); k.cyl(-w * .22, bH, -F + back / 2, cr, cr, .4, wMat, wT, 16); k.dome(-w * .22, bH + .4, -F + back / 2, cr, r() < .35 ? 'glazed' : wMat, r() < .35 ? pick(r, GLAZE) : wT, .9); }
  if (S.porch && r() < S.porch) {   // Kashgar: a wooden porch (aywan) on the street, with carved posts
    const pw = w * .55, px = -dx * .6, pd = 1.4;
    k.box(px, 0, F + pd / 2, pw, .25, pd, 'planks', 0x7a5638);
    for (let j = 0; j < 4; j++) { const x = px - pw / 2 + .15 + j * (pw - .3) / 3; k.cyl(x, .25, F + pd - .15, .09, .11, 2.4, 'planks', 0x8a6040, 8); k.box(x, 2.55, F + pd - .15, .5, .14, .2, 'planks', 0x6a4a30); }
    k.box(px, 2.69, F + pd / 2, pw + .3, .2, pd + .2, 'planks', 0x6a4a30);
  }
}

// ---------- bazaar shop bays ----------
const BAZ = {
  arab: { mat: 'stoneWarm', tones: [0xe0d0b0, 0xd6c4a0], arch: 'pointed', roof: 'dome' },
  rum: { mat: 'stoneWarm', tones: [0xd6c2a0, 0xcdb790], arch: 'pointed', roof: 'flat' },
  persian: { mat: 'brick', tones: [0xc89a6e, 0xd2a87a, 0xbf8e62], arch: 'pointed', roof: 'dome' },
  central: { mat: 'brick', tones: [0xcfa274, 0xd8b084], arch: 'pointed', roof: 'dome' },
  tarim: { mat: 'mudwall', tones: [0xd2b080, 0xc9a573], arch: 'round', roof: 'flat', shutters: true },
};
BAZ.mongol = BAZ.central; BAZ.steppe = BAZ.central; BAZ.yemen = BAZ.arab; BAZ.indian = { mat: 'plaster', tones: [0xe0c8a0, 0xd8b88a, 0xe6d0b0], arch: 'cusped', roof: 'flat' };
function shopBay(k, L, cul) {
  const S = BAZ[cul] || BAZ.arab, r = rng32(L.seed), w = L.w, d = L.d, F = d / 2, H = 3.7, t = .35;
  const tint = pick(r, S.tones);
  const o = { x: 0, yb: .5, ys: 1.75, w: w - .8, arch: S.arch };
  if (S.arch === 'pointed' || S.arch === 'cusped') o.ys = Math.min(1.75, H - .45 - (w - .8) * .74);
  facade(k, 0, H, w, F, [o], S.mat, tint, { t, grime: true });
  for (const sgn of [-1, 1]) k.box(sgn * (w / 2 - .15), 0, -t / 2, .3, H, d - t, S.mat, tint);
  k.box(0, 0, -F + .15, w - .6, H, .3, S.mat, tint);
  ring(k, o, 0, F, .16, S.mat === 'brick' ? 'stoneWarm' : S.mat, S.mat === 'brick' ? 0xe0d0b0 : 0xe6dcc6, .05);
  // the shop: a raised platform, shelves, goods, a hanging lamp
  const iw = w - .7, id = d - t - .3;
  k.box(0, 0, F - t - id / 2, iw, .5, id, 'planks', 0x7a5638); k.box(0, 0, F - t / 2 + .15, iw + .1, .5, t + .3, 'ashlar', 0xbdb09a);
  k.box(0, .5, F - t - id / 2, iw, .04, id, 'cloth', pick(r, [0x8a2a24, 0x2c4f7a, 0x6a3a5a, 0x9a5a24]));
  for (const y of [1.3, 2.0]) k.box(0, y, -F + .5, iw - .2, .05, .4, 'planks', 0x8a6040);
  for (let j = 0; j < 5; j++) { const gx = -iw / 2 + .3 + j * (iw - .6) / 4; k.box(gx, 1.35, -F + .5, .3, .32, .3, 'cloth', pick(r, PAL.cloth)); k.cyl(gx, 2.05, -F + .5, .1, .14, .35, 'brick', 0xb8734a, 7); }
  const goods = pick(r, ['jars', 'sacks', 'copper', 'rugs', 'cloth']);
  for (let j = 0; j < 4; j++) { const gx = -iw / 2 + .35 + j * (iw - .7) / 3, gz = F - t - .45;
    if (goods === 'jars') k.cyl(gx, .54, gz, .14, .2, .45, 'brick', pick(r, [0xb8734a, 0xa8633a]), 8);
    else if (goods === 'sacks') { k.sphere(gx, .78, gz, .24, 'cloth', pick(r, [0xd8c69a, 0xc9b080]), .9); k.sphere(gx, 1.0, gz, .18, 'cloth', pick(r, [0xd0802a, 0xb0402c, 0xe0c060, 0x7a9a3a]), .4); }
    else if (goods === 'copper') { k.dome(gx, .54, gz, .22, 'gold', 0xc8743a, .7); k.cyl(gx, .54, gz, .22, .22, .06, 'gold', 0xb8642a, 10); }
    else if (goods === 'rugs') k.cylX(gx * .2, .7 + j * .08, gz - j * .15, .12, iw - .4, 'cloth', pick(r, [0x8a2a24, 0x2c4f7a, 0x9a5a24, 0x6a3a5a]), 8);
    else k.box(gx, .54, gz, .4, .18 + j * .05, .5, 'cloth', pick(r, PAL.cloth)); }
  const lit = r() < .7; k.box(0, 2.4, F - t - .8, .05, .5, .05, 'iron', 0x2a2622); k.box(0, 2.15, F - t - .8, .18, .25, .18, lit ? 'lit' : 'dark', 0x4a3420); if (lit) { k.glow(0, 1.8, F + .05, o.w * 1.6, 2.6); }
  if (S.shutters) { k.box(0, holeTop(o) + .05, F + .5, o.w + .2, .06, 1.0, 'planks', 0x7a5638, { rx: -.35 }); }   // a board flap propped up as a canopy
  else if (r() < .65) { const cl = pick(r, PAL.cloth), out = 1.3, drop = .45, ya = Math.min(holeTop(o) - .25, 2.75); k.boxC(0, ya - drop / 2, F + out / 2, w - .1, .04, Math.hypot(out, drop), 'cloth', cl, Math.atan2(drop, out)); k.box(0, ya - drop - .22, F + out, w - .1, .22, .03, 'cloth', cl); for (const sx of [-1, 1]) k.box(sx * (w / 2 - .12), ya - drop, F + out / 2, .03, .03, out, 'planks', 0x5a3e28); }
  // roof
  if (S.roof === 'dome') { k.box(0, H, 0, w, .25, d, S.mat, tint); k.dome(0, H + .25, -.1, Math.min(w, d) * .42, S.mat === 'brick' ? 'brick' : 'plaster', S.mat === 'brick' ? tint : 0xe6dcc8, .6); k.cyl(0, H + .25 + Math.min(w, d) * .25, -.1, .18, .18, .3, S.mat, tint, 8); }
  else flatRoof(k, w, d, 0, H, S.mat, tint, cul === 'indian' ? 'merlons' : 'plain', { ph: .35, deckMat: 'mudwall', deckT: 0xc9a878 });
}

// ============================================================
//  Yemen tower houses, Indian havelis, Chinese and Song shophouses and siheyuan,
//  Southeast Asian stilt houses, Tibetan houses, yurts. Front faces +z at z = d/2.
// ============================================================
const WHITE = 0xf3efe6;

// ---------- Yemen: tower houses (towerHouse) ----------
function yemenTower(k, L) {
  const r = rng32(L.seed), w = L.w, d = L.d, F = d / 2, two = w > 9.2 && r() < .6;
  const n = two ? 2 : 1;
  for (let i = 0; i < n; i++) {
    const tw = two ? w * .44 : Math.min(5.6, w * .62), td = Math.min(d - 1, 5.6), x = two ? (i - .5) * w * .5 : (r() - .5) * (w - tw) * .5;
    k.push(x, 0, F - td / 2 - .2, 0); tower(k, tw, td, 4 + Math.floor(r() * 3), r); k.pop();
  }
  // a walled forecourt along the street with a gate
  const gx = (r() - .5) * w * .4;
  for (const [a, b] of segs(-w / 2, w / 2, [[gx - .8, gx + .8]])) k.box((a + b) / 2, 0, F - .15, b - a, 1.9, .3, 'stoneWarm', 0xa88a68, { grime: true });
  for (const sgn of [-1, 1]) k.box(gx + sgn * .95, 0, F - .15, .3, 2.6, .4, 'stoneWarm', 0x9c7c5c); k.box(gx, 2.4, F - .15, 2.2, .3, .45, 'plaster', WHITE);
  k.box(gx, 0, F - .3, 1.6, 2.3, .08, 'boards', 0x5a3a26);
}
function tower(k, tw, td, fl, r) {
  const FH = 2.6, H = fl * FH, base = r() < .5 ? 0x5e5852 : 0x8a7a68, mud = pick(r, [0xb8946a, 0xa98560, 0xc4a27a, 0x9c7c5c]);
  const stoneFloors = 2, hz = td / 2;
  for (let f = 0; f < fl; f++) {
    const y0 = f * FH, stone = f < stoneFloors, mat = stone ? 'ashlar' : 'mudwall', tint = stone ? base : mud, holes = [];
    if (f === 0) { holes.push({ x: 0, yb: .15, ys: 1.9, w: 1.0, arch: 'flat', kind: 'door' }); for (const sx of [-1, 1]) holes.push({ x: sx * tw * .3, yb: 1.4, ys: 1.9, w: .22, arch: 'flat' }); }
    else { const nW = Math.max(2, Math.round(tw / 1.5)); for (let j = 0; j < nW; j++) holes.push({ x: (j + .5 - nW / 2) * tw / nW, yb: .7, ys: 1.6, w: .6, arch: 'flat', kind: 'win' }); }
    facade(k, y0, FH, tw, hz, holes, mat, tint, { t: .5, grime: f === 0 });
    for (const sgn of [-1, 1]) k.box(sgn * (tw / 2 - .25), y0, -.25, .5, FH, td - .5, mat, tint, { grime: f === 0 });
    k.box(0, y0, -hz + .25, tw - 1, FH, .5, mat, tint);
    if (f > 0) {   // white gypsum: a frieze at each floor, frames and fanlights (qamariya) over each window
      k.box(0, y0 - .06, hz + .02, tw + .02, .14, .04, 'plaster', WHITE); k.box(0, y0 + .12, hz + .02, tw + .02, .06, .04, 'plaster', WHITE);
      for (const sgn of [-1, 1]) k.box(sgn * (tw / 2 + .01), y0 - .06, 0, .04, .14, td, 'plaster', WHITE);
      for (const o of holes) {
        k.box(o.x, y0 + o.yb - .1, hz + .025, o.w + .3, .1, .05, 'plaster', WHITE); for (const sgn of [-1, 1]) k.box(o.x + sgn * (o.w / 2 + .1), y0 + o.yb - .1, hz + .025, .1, o.ys - o.yb + .2, .05, 'plaster', WHITE);
        const fan = { x: o.x, yb: o.ys + .12, ys: o.ys + .12, w: o.w, arch: 'round' };
        k.add(cached('qam', () => new THREE.CylinderGeometry(1, 1, .04, 12, 1, false, Math.PI / 2, Math.PI).toNonIndexed()), 'paper', pick(r, [0xe8c070, 0xd89060, 0x9ab8d0, 0xe0a0a0]), M(o.x, y0 + o.ys + .12, hz - .02, Math.PI / 2, 0, 0, o.w / 2, 1, o.w / 2));
        ring(k, fan, y0, hz, .1, 'plaster', WHITE, .05); k.box(o.x, y0 + o.ys + .05, hz + .02, o.w + .3, .07, .05, 'plaster', WHITE);
        windowFill(k, o, y0, hz, r() < .55, .5);
      }
      // a few windows on the sides, flush, white-framed
      for (const sgn of [-1, 1]) { k.box(sgn * (tw / 2 + .01), y0 + .75, 0, .04, .95, .7, 'plaster', WHITE); k.box(sgn * (tw / 2 + .03), y0 + .85, 0, .04, .75, .45, 'dark', 0x1c1611); }
    } else for (const o of holes) { if (o.kind === 'door') { door(k, o, hz, 0x5a3a26, .3); k.box(o.x, o.ys, hz + .03, o.w + .4, .16, .08, 'plaster', WHITE); } else windowFill(k, o, y0, hz, false, .5); }
  }
  flatRoof(k, tw, td, 0, H, 'plaster', WHITE, 'stepped', { ph: .5, t: .25, step: .5, horns: true, deckMat: 'mudwall', deckT: 0xb89870 });
  if (r() < .5) { k.box(tw * .2, H, -td * .2, 1.6, 2.2, 1.6, 'mudwall', mud); k.box(tw * .2, H + 2.2, -td * .2, 1.8, .2, 1.8, 'plaster', WHITE); const lit = r() < .5; k.box(tw * .2, H + .8, -td * .2 + .81, .5, .9, .04, lit ? 'lit' : 'dark', 0x3a2414); }   // the mafraj on the roof
}

// ---------- India: havelis ----------
const HAV = [0xe0b07a, 0xe8c9a0, 0xd89a78, 0xeee2cc, 0xd8a8a0, 0xd0c0d8, 0xdca868];
function haveli(k, L) {
  const r = rng32(L.seed), w = L.w, d = L.d, F = d / 2, fl = 2 + (r() < .5 ? 1 : 0), FH = 3.0, H = fl * FH, t = .45;
  const red = r() < .3, mat = red ? 'sandstoneRed' : 'plaster', tint = red ? pick(r, [0xc87a5a, 0xd08a68, 0xb86a4a]) : pick(r, HAV), trim = red ? 0xe8d8c0 : 0xf0e8d8;
  k.box(0, 0, F - .6, w + .1, .6, 1.4, 'stoneWarm', 0xc9b494, { grime: true });   // plinth
  for (let f = 0; f < fl; f++) {
    const y0 = f * FH + .6, holes = [];
    if (f === 0) { holes.push({ x: 0, yb: .02, ys: 1.6, w: 1.6, arch: 'cusped', kind: 'gate' }); for (const sx of [-1, 1]) holes.push({ x: sx * w * .32, yb: 1.0, ys: 1.9, w: .6, arch: 'cusped', kind: 'win' }); }
    else { const n = Math.max(2, Math.round(w / 2.4)); for (let j = 0; j < n; j++) holes.push({ x: -w / 2 + (j + .5) * w / n, yb: .7, ys: 1.7, w: .7, arch: 'cusped', kind: 'win' }); }
    facade(k, y0, FH, w, F, holes, mat, tint, { t, grime: f === 0 });
    for (const sgn of [-1, 1]) k.box(sgn * (w / 2 - t / 2), y0, -t / 2, t, FH, d - t, mat, tint);
    k.box(0, y0, -F + t / 2, w - 2 * t, FH, t, mat, tint);
    k.boxC(0, y0 + FH - .1, F + .3, w + .3, .08, .7, 'stoneWarm', trim, .25);   // chhajja: a thin stone eave on brackets
    for (let j = 0; j < Math.round(w / .9); j++) k.boxC(-w / 2 + (j + .5) * w / Math.round(w / .9), y0 + FH - .4, F + .15, .1, .4, .1, 'stoneWarm', trim, .6);
    for (const o of holes) {
      ring(k, o, y0, F, .14, 'stoneWarm', trim, .05);
      if (o.kind === 'gate') { door(k, o, F, 0x6a4028, .3); for (let a = 0; a < 3; a++) for (let b = 0; b < 4; b++) k.sphere(o.x - .5 + b * .33, y0 + .5 + a * .6, F - .25, .04, 'gold', 0xd0a040); k.box(o.x, y0, F + .3, o.w + .6, .1, .6, 'stoneWarm', 0xc9b494); for (const sx of [-1, 1]) k.box(o.x + sx * (o.w / 2 + .5), y0 + .4, F + .03, .4, .6, .06, 'stoneWarm', trim); }
      else { windowFill(k, o, y0, F, r() < .55, t); lattice(k, o.x, y0 + o.yb, F - .12, o.w, o.ys - o.yb, 0xd8c8a8, .1, 'stoneWarm'); }
    }
    if (f > 0) {   // jharokhas: projecting balconies on stepped brackets, cusped arches and a curved roof
      const nj = Math.max(1, Math.round(w / 4.2));
      for (let j = 0; j < nj; j++) {
        const jx = -w / 2 + (j + .5) * w / nj, jw = 1.6, jd = .75, jy = y0 + .55;
        for (let s = 0; s < 3; s++) k.box(jx, jy - .45 + s * .15, F + .1, jw - .5 + s * .2, .15, .2 + s * .2, 'stoneWarm', trim);
        k.box(jx, jy, F + jd / 2, jw, .12, jd, 'stoneWarm', trim);
        k.box(jx, jy + .12, F + jd - .05, jw, .5, .08, 'stoneWarm', tint);
        for (let p = 0; p < 4; p++) k.cyl(jx - jw / 2 + .08 + p * (jw - .16) / 3, jy + .62, F + jd - .08, .05, .06, 1.1, 'stoneWarm', trim, 8);
        const lit = r() < .5; k.box(jx, jy + .62, F + .1, jw - .2, 1.1, .04, lit ? 'lit' : 'dark', 0x3a2414); if (lit) k.glow(jx, jy + 1.1, F + jd + .05, jw * 1.6, 1.8);
        k.box(jx, jy + 1.72, F + jd / 2, jw + .2, .1, jd + .15, 'stoneWarm', trim);
        k.add(cached('bangla', () => new THREE.CylinderGeometry(1, 1, 1, 12, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).toNonIndexed()), mat, tint, M(jx, jy + 1.82, F + jd / 2, 0, 0, 0, jw + .2, .32, (jd + .15) / 2));
      }
    }
  }
  // roof: merlons, corner chhatris
  flatRoof(k, w, d, 0, H + .6, mat, tint, 'merlons', { ph: .5, step: .6, deckMat: 'plaster', deckT: 0xe0d4c0 });
  for (const sx of [-1, 1]) if (r() < .7) { const cx = sx * (w / 2 - .8), cz = F - .8, y = H + .6 + .5, cr = .55; for (const a of [-1, 1]) for (const b of [-1, 1]) k.cyl(cx + a * cr * .7, y, cz + b * cr * .7, .07, .08, 1.1, 'stoneWarm', trim, 6); k.box(cx, y + 1.1, cz, cr * 2.1, .14, cr * 2.1, 'stoneWarm', trim); k.dome(cx, y + 1.24, cz, cr * .9, mat, tint, .8); k.sphere(cx, y + 1.24 + cr * .75, cz, .08, 'gold', 0xd0a040); }
  // the court behind, with a tulsi planter
  k.box(0, .6, 0, w - 2 * t, .05, d - 2 * t - 2, 'stoneWarm', 0xd8c8a8); k.box(0, .65, -.5, .7, .6, .7, 'stoneWarm', trim); k.sphere(0, 1.45, -.5, .3, 'leaf', 0x4f7a2e);
}

// ---------- China and Song: shophouses and courtyard compounds ----------
const CHN = {
  chinese: { post: 0xa8352a, wall: 'brickGrey', wallT: [0xa59a88, 0x9e937f, 0xb3a690], up: 'plaster', upT: [0xe6e0d4, 0xd8d0c2], roof: 0x55595e, beam: 0x5a3426 },
  song: { post: 0x4a3828, wall: 'plaster', wallT: [0xf0ebe0, 0xe8e2d4, 0xede8dc], up: 'plaster', upT: [0xf0ebe0, 0xe8e2d4], roof: 0x464b52, beam: 0x3a2a20 },
};
function chinaRoof(k, x, H, z, w, d, rise, tint, o = {}) {
  hipRoof(k, x, H, z, w, d, rise, 'tileGrey', tint, { flare: true, lift: o.lift !== undefined ? o.lift : .45, underMat: 'planks', underT: o.under || 0x5a3426, gable: o.gable });
  const alongX = o.gable || w >= d, rl = o.gable ? w - .3 : Math.max(.4, Math.abs(w - d) + .3);
  k.box(x, H + rise - .06, z, alongX ? rl : .3, .28, alongX ? .3 : rl, 'tileGrey', 0x3a3e44);
  for (const sx of [-1, 1]) k.boxC(x + (alongX ? sx * rl / 2 : 0), H + rise + .3, z + (alongX ? 0 : sx * rl / 2), alongX ? .18 : .26, .55, alongX ? .26 : .18, 'tileGrey', 0x3a3e44, alongX ? 0 : sx * .45, 0, alongX ? -sx * .45 : 0);   // ridge-end ornaments
}
// the gable wall under a flared gable roof, following its curve
function chinaGableEnd(k, x, H, z, d, rise, roofD, mat, tint) {
  const hd = roofD / 2, s = new THREE.Shape(), n = 10; s.moveTo(-d / 2, 0);
  for (let i = 0; i <= n; i++) { const zz = -d / 2 + d * i / n, u = (hd - Math.abs(zz)) / hd; s.lineTo(zz, rise * Math.pow(Math.min(1, u), 1.7) - .1); }
  s.lineTo(d / 2, 0); s.lineTo(-d / 2, 0);
  k.add(new THREE.ExtrudeGeometry(s, { depth: .24, bevelEnabled: false }), mat, tint, M(x, H, z, 0, Math.PI / 2));
}
function shophouse(k, L, cul) {
  const S = CHN[cul] || CHN.chinese, r = rng32(L.seed), w = L.w, d = L.d, F = d / 2, two = r() < .6, H1 = 3.0, H = two ? 5.6 : H1;
  k.box(0, 0, 0, w + .2, .35, d + .2, 'ashlar', 0xa8a294, { grime: true });   // stone plinth
  const y = .35;
  // ground floor: posts and an open front with board shutters and a counter
  for (const x of [-w / 2 + .14, w / 2 - .14, ...(w > 4.8 ? [0] : [])]) k.cyl(x, y, F - .14, .13, .14, H1 - .1, 'planks', S.post, 10);
  k.box(0, y + H1 - .35, F - .14, w, .3, .22, 'planks', S.beam);
  for (const sgn of [-1, 1]) k.box(sgn * (w / 2 - .12), y, -.1, .24, H, d - .4, S.wall, pick(r, S.wallT));
  k.box(0, y, -F + .2, w - .4, H, .3, S.wall, pick(r, S.wallT));
  const ow = w - .5, room = d - 1.2;
  k.box(0, y, F - .4 - room / 2, ow, .04, room, 'boards', 0x6a5440); k.box(0, y + H1 - .35, F - .4 - room / 2, ow, .05, room, 'planks', 0x5a4030);
  for (const yy of [1.1, 1.8]) k.box(0, y + yy, -F + .6, ow - .3, .05, .4, 'planks', 0x8a6040);
  for (let j = 0; j < 6; j++) { const gx = -ow / 2 + .35 + j * (ow - .7) / 5; if (r() < .5) k.cyl(gx, y + 1.15, -F + .6, .1, .14, .35, 'brick', pick(r, [0x8a9a8a, 0xb8734a, 0xd8d0c0]), 8); else k.box(gx, y + 1.15, -F + .6, .3, .25, .3, 'cloth', pick(r, [0xd03a26, 0xe3c35a, 0x3f7a6a, 0xf0ede4, 0x2c4f7a])); }
  const boards = Math.round(ow / .32), shut = Math.floor(boards * .35);   // some shutter boards still standing at one side
  for (let j = 0; j < shut; j++) k.box(-ow / 2 + .16 + j * .32, y, F - .2, .3, H1 - .4, .06, 'planks', 0x7a5a3e);
  k.box(ow * .15, y, F - .3, ow * .55, .95, .5, 'planks', 0x6a4a30); for (let j = 0; j < 3; j++) k.box(ow * .15 + (j - 1) * ow * .17, y + .95, F - .3, .4, .2 + r() * .2, .4, 'cloth', pick(r, [0xd03a26, 0xe3c35a, 0x3f7a6a, 0xf0ede4]));
  const lit = r() < .7; k.box(0, y + .1, -F + .38, ow - .3, 2.4, .04, lit ? 'lit' : 'dark', 0x3a2414); if (lit) k.glow(0, y + 1.4, F + .05, ow * 1.3, 2.4);
  if (two) {   // the upper floor: lattice windows (paper glows at night), a balcony rail
    const y2 = y + H1, uw = w, holes = []; const n = Math.max(1, Math.round(uw / 1.5)); for (let j = 0; j < n; j++) holes.push({ x: -uw / 2 + (j + .5) * uw / n, yb: .5, ys: 1.7, w: Math.min(1.1, uw / n - .4), arch: 'flat' });
    facade(k, y2, H - H1, uw, F - .1, holes, S.up, pick(r, S.upT), { t: .25 });
    for (const x of [-uw / 2 + .08, uw / 2 - .08]) k.box(x, y2, F - .08, .16, H - H1, .06, 'planks', S.post);
    for (const o of holes) { const pl = r() < .6; k.box(o.x, y2 + o.yb, F - .25, o.w, o.ys - o.yb, .03, pl ? 'paper' : 'dark', 0xf0dca8); lattice(k, o.x, y2 + o.yb, F - .18, o.w, o.ys - o.yb, 0x4a3426, .14); if (pl) k.glow(o.x, y2 + 1.1, F, o.w * 2, 1.8); }
    if (r() < .5) { k.box(0, y2 - .05, F + .3, uw - .2, .1, .7, 'planks', 0x6a4a30); for (let j = 0; j <= 8; j++) k.box(-uw / 2 + .15 + j * (uw - .3) / 8, y2 + .05, F + .62, .05, .7, .05, 'planks', S.post); k.box(0, y2 + .75, F + .62, uw - .2, .06, .08, 'planks', S.post); }
  }
  chinaRoof(k, 0, y + H, 0, w + .3, d + 1.6, 1.6, S.roof, { lift: .3, under: S.beam, gable: true });
  for (const sgn of [-1, 1]) chinaGableEnd(k, sgn > 0 ? w / 2 - .24 : -w / 2, y + H, 0, d - .1, 1.6, d + 1.6, S.wall, pick(r, S.wallT));
  if (r() < .5) { k.box(w / 2 - .45, y + 2.0, F + .12, .4, 1.6, .06, 'planks', 0x2a2420); k.box(w / 2 - .45, y + 2.1, F + .16, .28, 1.4, .02, 'gold', 0xc8a040); }   // a signboard
  for (const sx of [-1, 1]) if (r() < .55) { const lx = sx * (w / 2 - .5); k.box(lx, y + H1 - .5, F + .1, .02, .25, .02, 'iron', 0x2a2622); k.sphere(lx, y + H1 - .78, F + .1, .2, 'paper', 0xd03a26, 1.3); k.glow(lx, y + H1 - .78, F + .3, 1.2, 1.2); if (sx > 0) k.light(lx, y + H1 - .8, F + .5); }
}
function siheyuan(k, L, cul) {
  const S = CHN[cul] || CHN.chinese, r = rng32(L.seed), w = L.w, d = L.d, F = d / 2, WH = 3.0, wallT = pick(r, S.wallT);
  const gx = w * .3, gate = [[gx - 1.4, gx + 1.4]];
  // outer walls with tile coping
  const wallSeg = (x, z, len, rot) => { k.box(x, 0, z, rot ? .4 : len, WH, rot ? len : .4, S.wall, wallT, { grime: true }); k.box(x, WH, z, rot ? .8 : len + .2, .14, rot ? len + .2 : .8, 'tileGrey', S.roof); k.box(x, WH + .14, z, rot ? .3 : len + .1, .14, rot ? len + .1 : .3, 'tileGrey', 0x3a3e44); };
  for (const [a, b] of segs(-w / 2, w / 2, gate)) wallSeg((a + b) / 2, F - .2, b - a, 0);
  wallSeg(0, -F + .2, w, 0); wallSeg(-w / 2 + .2, 0, d, 1); wallSeg(w / 2 - .2, 0, d, 1);
  // the gatehouse: red doors with studs, stone drums, steps, lanterns
  k.box(gx, 0, F - .6, 2.8, .4, 2.0, 'ashlar', 0xa8a294);
  for (const sgn of [-1, 1]) k.box(gx + sgn * 1.25, .4, F - .7, .3, 3.0, 1.6, S.wall, wallT);
  k.box(gx, .4, F - .9, 2.2, 2.6, .12, 'planks', S.post); for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) k.sphere(gx - .6 + b * .4, .9 + a * .5, F - .82, .04, 'gold', 0xd0a040);
  k.box(gx, 3.0, F - .7, 2.8, .25, 1.7, 'planks', S.beam);
  chinaRoof(k, gx, 3.4, F - .7, 3.6, 2.8, 1.1, S.roof, { lift: .3, under: S.beam });
  for (const sgn of [-1, 1]) { k.cylX(gx + sgn * .85, .75, F + .2, .32, .3, 'ashlar', 0xb0aaa0, 12); k.box(gx + sgn * .85, .4, F + .2, .5, .14, .5, 'ashlar', 0xa8a294); }
  for (const sgn of [-1, 1]) { const lx = gx + sgn * 1.0; k.sphere(lx, 2.6, F + .2, .22, 'paper', 0xd03a26, 1.3); k.glow(lx, 2.6, F + .4, 1.3, 1.3); } k.light(gx, 2.5, F + .8);
  // main hall at the back on a plinth, side halls, the court
  const mw = w * .62, md = Math.min(4.6, d * .32), mz = -F + md / 2 + .8;
  k.box(0, 0, mz, mw + .8, .6, md + .8, 'ashlar', 0xb0aaa0);
  for (let j = 0; j <= 4; j++) k.cyl(-mw / 2 + j * mw / 4, .6, mz + md / 2 + .1, .15, .16, 3.0, 'planks', S.post, 10);
  k.box(0, .6, mz - .15, mw, 3.0, md - .3, S.up, pick(r, S.upT));
  for (let j = 0; j < 4; j++) { const x = -mw / 2 + (j + .5) * mw / 4, pl = r() < .55; k.box(x, 1.0, mz + md / 2 - .28, mw / 4 - .3, 2.1, .03, pl ? 'paper' : 'dark', 0xf0dca8); lattice(k, x, 1.0, mz + md / 2 - .25, mw / 4 - .3, 2.1, 0x4a3426, .16); }
  k.box(0, 3.4, mz, mw + .4, .3, md + .4, 'planks', S.beam);
  chinaRoof(k, 0, 3.7, mz, mw + 1.8, md + 2.2, 1.9, S.roof, { lift: .5, under: S.beam });
  const sw = Math.min(3.2, w * .2), sd = d * .3;
  for (const sx of [-1, 1]) { const x = sx * (w / 2 - sw / 2 - .7); k.box(x, 0, .6, sw, .4, sd, 'ashlar', 0xb0aaa0); k.box(x, .4, .6, sw, 2.5, sd, S.up, pick(r, S.upT)); chinaRoof(k, x, 2.9, .6, sw + 1.0, sd + 1.0, 1.1, S.roof, { lift: .25, under: S.beam }); }
  k.box(0, 0, .8, w - 2 * sw - 1.6, .03, sd + 1, 'ashlar', 0x9a958a);
  k.tree(-1.2, 1.2, r() < .5 ? 'sophora' : 'fruit', .7);
  if (r() < .6) k.cyl(1.4, 0, 1.6, .45, .5, .6, 'ashlar', 0x6a6a64, 10);
}

// ---------- Southeast Asia: houses on stilts ----------
function stiltHouse(k, w, d, r) {
  const ph = 1.8, floorT = 0x7a5a3a, post = 0x5a3e28, wallT = pick(r, [0xc8a878, 0xb8946a, 0xd2b48a, 0xa88a5e]);
  for (const sx of [-1, 0, 1]) for (const sz of [-1, 0, 1]) { const x = sx * (w / 2 - .15), z = sz * (d / 2 - .15); k.cyl(x, 0, z, .12, .14, ph + 2.3, 'planks', post, 8); k.cyl(x, 0, z, .22, .26, .25, 'ashlar', 0x9a9284, 8); }
  k.box(0, ph, .4, w + .3, .16, d + .8, 'planks', floorT);   // floor with a front deck
  const hd = d - .6, hz = -.3, holes = [{ x: -w * .2, yb: .05, ys: 1.75, w: .8, arch: 'flat' }, { x: w * .22, yb: .7, ys: 1.5, w: .7, arch: 'flat' }];
  facade(k, ph + .16, 2.2, w - .2, hz + hd / 2, holes, 'planks', wallT, { t: .12 });
  for (const sgn of [-1, 1]) k.box(sgn * (w / 2 - .16), ph + .16, hz, .12, 2.2, hd - .12, 'planks', wallT);
  k.box(0, ph + .16, hz - hd / 2 + .06, w - .3, 2.2, .12, 'planks', wallT);
  for (let j = 0; j < 4; j++) k.box(-w / 2 + .15 + j * (w - .3) / 3, ph + .16, hz + hd / 2 + .02, .1, 2.2, .06, 'planks', post);   // frame over woven panels
  const lit = r() < .55; for (const o of holes) { windowFill(k, o, ph + .16, hz + hd / 2, lit && o.x > 0, .12); }
  k.box(w * .22, ph + .16 + 1.5, hz + hd / 2 + .3, .9, .05, .6, 'planks', 0x7a5a3e, { rx: -.5 });   // a propped shutter
  for (let j = 0; j <= 6; j++) k.box(-w / 2 + .1 + j * (w - .2) / 6, ph + .16, d / 2 + .75, .05, .7, .05, 'planks', post); k.box(0, ph + .85, d / 2 + .75, w, .06, .06, 'planks', post);
  for (let j = 0; j < 6; j++) k.box(w / 2 - .6, j * ph / 6, d / 2 + .9 + (6 - j) * .15, .7, .06, .16, 'planks', 0x8a6a48);   // ladder steps
  for (const sx of [w / 2 - .95, w / 2 - .25]) k.boxC(sx, ph / 2, d / 2 + 1.3, .07, ph * 1.15, .07, 'planks', post, -.45);
  // steep thatched roof, gable to the street, crossed finials
  k.push(0, 0, hz, Math.PI / 2);
  gableRoof(k, hd + .2, w - .2, 0, ph + 2.36, { pitch: .9, over: .9, side: .5, mat: 'thatch', tint: pick(r, [0xc8a860, 0xb89a58, 0xd0b068]), beams: false, ridgeT: 0x8a7040, endMat: 'planks', endTint: wallT, endT: .1, th: .3 });
  k.pop();
  const rise = (w / 2 - .1 + .9) * Math.tan(.9), ry = ph + 2.44 + rise;
  for (const sgn of [-1, 1]) for (const s2 of [-1, 1]) k.boxC(s2 * .35, ry + .35, hz + sgn * (hd / 2 + .6), .1, 1.2, .1, 'planks', post, 0, 0, s2 * .5);
  // under the house: jars, firewood, a loom
  k.cyl(-w * .25, 0, -.5, .25, .3, .6, 'brick', 0x8a5a3a, 8); k.cyl(-w * .1, 0, -.8, .2, .25, .5, 'brick', 0x7a4a2a, 8);
  for (let j = 0; j < 4; j++) k.cylX(w * .2, .1 + j * .12, -.6, .06, 1.2, 'planks', 0x6a4a30, 6);
}
function stilt(k, L) { const r = rng32(L.seed); if (L.type === 'stiltCompound') { stiltCompound(k, L, r); return; } stiltHouse(k, Math.min(L.w - .4, 5.2), Math.min(L.d - 1.6, 5.4), r); }
function stiltCompound(k, L, r) {
  const w = L.w, d = L.d;
  for (const s of [-1, 1]) for (const [a, b] of segs(-w / 2, w / 2, s > 0 ? [[-.8, .8]] : [])) { const len = b - a, n = Math.round(len / .25); for (let j = 0; j < n; j++) k.cyl(a + (j + .5) * len / n, 0, s * d / 2, .05, .05, 1.3 + (j % 2) * .1, 'planks', 0xb8a068, 5); }
  for (const s of [-1, 1]) { const n = Math.round(d / .25); for (let j = 0; j < n; j++) k.cyl(s * w / 2, 0, -d / 2 + (j + .5) * d / n, .05, .05, 1.3 + (j % 2) * .1, 'planks', 0xb8a068, 5); }
  k.push(-w * .15, 0, -d * .1, 0); stiltHouse(k, Math.min(5, w * .45), Math.min(5.4, d * .5), r); k.pop();
  // a granary on short stilts
  const gx = w * .3, gz = -d * .25; for (const a of [-1, 1]) for (const b of [-1, 1]) k.cyl(gx + a * .7, 0, gz + b * .7, .08, .08, 1.0, 'planks', 0x5a3e28, 6);
  k.box(gx, 1.0, gz, 1.8, 1.3, 1.8, 'planks', 0xa88a5e); k.push(gx, 0, gz, 0); gableRoof(k, 1.8, 1.8, 0, 2.3, { pitch: .8, over: .5, side: .3, mat: 'thatch', tint: 0xc0a060, beams: false, endMat: 'planks', endTint: 0xa88a5e, endT: .1, th: .25 }); k.pop();
  k.tree(w * .32, d * .3, 'coconut', .9);
}

// ---------- Tibet: whitewashed houses with tapering walls ----------
function tibetHouse(k, L) {
  const r = rng32(L.seed), w = Math.min(L.w, 6.5), d = Math.min(L.d, 6), fl = 2 + (r() < .4 ? 1 : 0), FH = 2.5, H = fl * FH, tp = .07;
  const wallT = pick(r, [0xf2eee4, 0xefe8da, 0xf4f0e8]);
  k.add(cached('frustum', () => new THREE.CylinderGeometry(1 - tp, 1, 1, 4, 1).rotateY(Math.PI / 4).toNonIndexed()), 'plaster', wallT, M(0, H / 2, 0, 0, 0, 0, w / Math.SQRT2, H, d / Math.SQRT2), { grime: true });
  const zf = y => d / 2 * (1 - tp * y / H), tilt = -Math.atan(d / 2 * tp / H);
  k.box(0, H - .7, 0, w * (1 - tp) + .06, .55, d * (1 - tp) + .06, 'boards', 0x5a2a22);   // the dark red band under the roof (penbey)
  for (let j = 0; j < Math.round(w * 2.2); j++) k.box(-w * (1 - tp) / 2 + .1 + j * (w * (1 - tp) - .2) / Math.round(w * 2.2), H - .78, zf(H - .78) + .04, .08, .08, .14, 'planks', 0x3a2a20);
  k.box(0, H - .15, 0, w * (1 - tp) + .1, .15, d * (1 - tp) + .1, 'planks', 0x4a3a2e);
  // windows: black trapezoid surrounds, layered lintels with small rafter ends, a cloth valance
  const win = (x, y, ww, hh, lit) => {
    const z = zf(y + hh / 2) + .02;
    k.add(cached('trap', () => { const s = new THREE.Shape(); s.moveTo(-.62, -.05); s.lineTo(.62, -.05); s.lineTo(.5, 1.05); s.lineTo(-.5, 1.05); s.lineTo(-.62, -.05); return new THREE.ExtrudeGeometry(s, { depth: .03, bevelEnabled: false }); }), 'dark', 0x141210, M(x, y, z, tilt, 0, 0, ww, hh, 1));
    k.box(x, y + .05, z + .03, ww * .7, hh * .85, .03, lit ? 'lit' : 'dark', 0x3a2414); if (lit) k.glow(x, y + hh * .5, z + .1, ww * 2, hh * 1.8);
    lattice(k, x, y + .05, z + .06, ww * .7, hh * .85, 0x8a2a22, .18);
    for (let s = 0; s < 2; s++) k.box(x, y + hh + .02 + s * .1, z + .06 + s * .06, ww * 1.1 + s * .2, .1, .14 + s * .08, 'planks', s ? 0x8a2a22 : 0x3a5a7a);
    for (let j = 0; j < 6; j++) k.box(x - ww * .55 + j * ww * .22, y + hh + .22, z + .2, .06, .06, .12, 'planks', pick(r, [0x3a6a4a, 0xc0392b, 0xe3b32b]));
    k.box(x, y + hh - .12, z + .1, ww * .95, .14, .02, 'cloth', pick(r, [0xf2efe6, 0xc0392b, 0x2c5fa8]));
  };
  for (let f = 1; f < fl; f++) { const n = w > 5 ? 2 : 1; for (let j = 0; j < n; j++) win(n === 1 ? 0 : (j - .5) * w * .45, f * FH + .55, .95, 1.15, r() < .5); }
  for (const sgn of [-1, 1]) { const y = (fl - 1) * FH + .7; k.add(cached('trapS', () => { const s = new THREE.Shape(); s.moveTo(-.35, 0); s.lineTo(.35, 0); s.lineTo(.28, .8); s.lineTo(-.28, .8); s.lineTo(-.35, 0); return new THREE.ExtrudeGeometry(s, { depth: .03, bevelEnabled: false }); }), 'dark', 0x141210, M(sgn * (w / 2 * (1 - tp * y / H) + .02), y, 0, 0, sgn * Math.PI / 2, 0)); }
  // door: black surround, red door, a valance and steps
  const dy = 0, dz = zf(1) + .02;
  k.add(cached('trapD', () => { const s = new THREE.Shape(); s.moveTo(-.7, 0); s.lineTo(.7, 0); s.lineTo(.6, 2.3); s.lineTo(-.6, 2.3); s.lineTo(-.7, 0); return new THREE.ExtrudeGeometry(s, { depth: .03, bevelEnabled: false }); }), 'dark', 0x141210, M(-w * .15, dy, dz, tilt));
  k.box(-w * .15, 0, dz + .03, .95, 2.0, .05, 'boards', 0x8a2a22); k.box(-w * .15, 2.0, dz + .1, 1.3, .3, .05, 'cloth', 0xf2efe6); k.box(-w * .15, 2.2, dz + .14, 1.5, .1, .16, 'planks', 0x3a5a7a);
  for (let j = 0; j < 2; j++) k.box(-w * .15, j * .15, dz + .3 + (1 - j) * .3, 1.3, .15, .3, 'ashlar', 0x9a958a);
  // roof: firewood stacks, prayer flags on poles at the corners
  k.box(-w * .3, H, -d * .25, 1.4, .5, .6, 'planks', 0x6a5440); k.box(w * .25, H, -d * .3, .8, .4, .8, 'mudwall', 0x8a7458);
  const cols = [0x2c5fa8, 0xf2efe6, 0xc0392b, 0x3f8f4f, 0xe3b32b];
  const poles = [[w * .4, d * .38], [-w * .4, -d * .38]];
  for (const [px, pz] of poles) { k.cyl(px, H, pz, .04, .05, 2.4, 'planks', 0x5a3e28, 6); k.cyl(px, H + 2.2, pz, .25, .05, .5, 'cloth', pick(r, cols), 8); }
  const [a, b] = poles, n = 12; for (let j = 0; j < n; j++) { const t = (j + .5) / n, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t, y = H + 2.3 - Math.sin(t * Math.PI) * .7; k.box(x, y - .3, z, .02, .28, .22, 'cloth', cols[j % 5], { ry: Math.atan2(b[0] - a[0], b[1] - a[1]) }); }
}

// ---------- Mongols and the steppe: yurts (ger) and their compounds ----------
function ger(k, x, z, rr, r, ry = 0) {
  const wh = rr * .62, felt = pick(r, [0xf0ebdf, 0xe8e2d2, 0xf2eee6]);
  k.push(x, 0, z, ry);
  k.cyl(0, 0, 0, rr, rr, wh, 'felt', felt, 20);
  k.cyl(0, 0, 0, rr + .02, rr + .02, .25, 'felt', 0xb8a888, 20);   // the skirt
  for (const y of [wh * .35, wh * .8]) k.cyl(0, y, 0, rr + .03, rr + .03, .05, 'flat', 0x5a3e28, 20);   // ropes
  k.cone(0, wh, 0, rr + .12, rr * .42, 'felt', felt, 20);
  k.cyl(0, wh - .04, 0, rr + .13, rr + .1, .12, 'cloth', pick(r, [0x2c5fa8, 0x8a2a24, 0x2f6f6f]), 20);   // a coloured band at the eave
  k.cyl(0, wh + rr * .38, 0, rr * .18, rr * .2, .12, 'planks', 0xc0502a, 12);   // the crown
  k.cyl(rr * .08, wh + rr * .3, rr * .05, .07, .07, 1.1, 'iron', 0x2a2622, 6);   // stovepipe
  // the door: an orange-painted frame and leaf, a felt flap rolled above
  const dz = rr - .02; k.box(0, 0, dz, .95, 1.4, .14, 'planks', 0xc0502a); k.box(0, .05, dz + .05, .7, 1.25, .06, 'planks', 0xd06a2a);
  for (const sgn of [-1, 1]) k.box(sgn * .2, .3, dz + .09, .12, .8, .02, 'gold', 0xe0b13a);
  k.cylX(0, 1.48, dz + .02, .1, .9, 'felt', felt, 8);
  const lit = r() < .6; if (lit) { k.box(0, .15, dz + .1, .15, 1.1, .02, 'lit', 0x3a2414); k.glow(0, .8, dz + .3, 1.6, 2); }
  k.pop();
}
function yurtCompound(k, L) {
  const r = rng32(L.seed), w = L.w, d = L.d;
  const fence = (x, z, len, rot) => { const n = Math.max(2, Math.round(len / 1.5)); for (let j = 0; j <= n; j++) { const t = -len / 2 + j * len / n; k.cyl(x + (rot ? 0 : t), 0, z + (rot ? t : 0), .06, .08, 1.4, 'planks', 0x5e3d26, 5); } for (const y of [.6, 1.15]) k.box(x, y, z, rot ? .08 : len, .08, rot ? len : .08, 'planks', 0x7a5236); };
  fence(0, -d / 2, w, 0); fence(-w / 2, 0, d, 1); fence(w / 2, 0, d, 1);
  for (const [a, b] of segs(-w / 2, w / 2, [[-1.2, 1.2]])) fence((a + b) / 2, d / 2, b - a, 0);
  ger(k, -w * .15, -d * .1, 2.2 + r() * .4, r);
  if (w > 10.5) ger(k, w * .27, -d * .22, 1.6, r);
  // a cart, a hitching rail, a felt-covered store
  k.push(w * .28, 0, d * .22, .4); k.box(0, .7, 0, 1.4, .12, 2.2, 'planks', 0x8a5a36); for (const sx of [-1, 1]) k.add(cached('wheel', () => new THREE.CylinderGeometry(.6, .6, .1, 12).toNonIndexed()), 'planks', 0x5e3d26, M(sx * .78, .6, .2, 0, 0, Math.PI / 2)); k.box(0, .82, 0, 1.2, .5, 1.6, 'felt', 0xd8ccb0); k.pop();
  k.box(-w * .35, 0, d * .3, .1, 1.1, .1, 'planks', 0x5e3d26); k.box(-w * .25, 0, d * .3, .1, 1.1, .1, 'planks', 0x5e3d26); k.box(-w * .3, 1.0, d * .3, 1.2, .08, .08, 'planks', 0x5e3d26);
}
function yurtHouse(k, L) { const r = rng32(L.seed); ger(k, 0, 0, 1.8 + r() * .5, r); }


// ============================================================
//  Game integration (v22.3)
// ============================================================
// Kit parts name a SURF building layer ('plaster', 'brick', ...) or a plain material. Baking turns a Kit into the
// game's own vertex format (position, colour, aSurf = u, v in metres, layer + 1), so kit buildings go through
// objMat and the same surfDet shading as everything else. Lamplit parts get their own small meshes.
const ALIAS = { flags: 'ashlar', fan: 'ashlar', setts: 'slate', cracked: 'mudwall', earth: 'mudwall', sand: 'mudwall', loess: 'mudwall', stoneslab: 'slate', tuff: 'ashlar' };
const PLAIN = new Set(['flat', 'dark', 'cloth', 'leaf', 'iron', 'lead', 'gold', 'meadow', 'steppe']);
const EMIT = new Set(['lit', 'paper', 'glow']);
function layerOf(mat) {
  if (PLAIN.has(mat) || !mat) return 0;
  const n = ALIAS[mat] || mat, i = SURF.B[n];
  return i === undefined ? 0 : i + 1;
}
const _v = new V3(), _n = new V3(), _c = new THREE.Color();
class Bake {
  constructor() { this.solid = { P: [], C: [], S: [] }; this.lit = { P: [], C: [] }; this.paper = { P: [], C: [] }; this.glow = { P: [], C: [], U: [] }; this.tris = 0; this.lights = []; }
  // bake the kit's parts so far, then drop them (so a cell can be baked a lot at a time)
  take(k) {
    for (const p of k.parts) this.part(p);
    for (const l of k.lights) this.lights.push(l);
    k.parts.length = 0; k.lights.length = 0;
  }
  part(p) {
    let g = p.geo; if (g.index) g = p.geo = g.toNonIndexed();
    const pos = g.attributes.position, uv = g.attributes.uv, ca = g.attributes.color, e = p.m.elements;
    const emit = EMIT.has(p.mat), B = emit ? this[p.mat] : this.solid, L = emit ? 0 : layerOf(p.mat);
    _c.set(p.tint);
    const base = B.P.length;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const wx = e[0] * x + e[4] * y + e[8] * z + e[12], wy = e[1] * x + e[5] * y + e[9] * z + e[13], wz = e[2] * x + e[6] * y + e[10] * z + e[14];
      B.P.push(wx, wy, wz);
      if (p.opt.vcol && ca) B.C.push(ca.getX(i), ca.getY(i), ca.getZ(i));
      else { const k = p.opt.grime ? .6 + .4 * sm(0, 1.7, y) : 1; B.C.push(_c.r * k, _c.g * k, _c.b * k); }
      if (B.U) B.U.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
    }
    if (B === this.solid) surfFaces(B, base, L);
    this.tris += pos.count / 3;
  }
  meshes(objMat) {
    const out = [];
    const geo = (A, attrs) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(A.P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(A.C, 3)); if (attrs) attrs(g); g.computeVertexNormals(); g.computeBoundingSphere(); return g; };
    if (this.solid.P.length) { const m = new THREE.Mesh(geo(this.solid, g => g.setAttribute('aSurf', new THREE.Float32BufferAttribute(this.solid.S, 3))), objMat); m.castShadow = true; m.receiveShadow = true; out.push(m); }
    if (this.lit.P.length) { const m = new THREE.Mesh(geo(this.lit), mats().lit); m.receiveShadow = true; out.push(m); }
    if (this.paper.P.length) { const m = new THREE.Mesh(geo(this.paper), mats().paper); m.castShadow = true; out.push(m); }
    if (this.glow.P.length) { const m = new THREE.Mesh(geo(this.glow, g => g.setAttribute('uv', new THREE.Float32BufferAttribute(this.glow.U, 2))), mats().glow); m.renderOrder = 2; m.frustumCulled = true; out.push(m); }
    return out;
  }
}
// per face (u, v, layer + 1), exactly as BLD.Builder.surfAttr does it: walls u level along the face, v down it; flat faces x, z
function surfFaces(B, base, L) {
  const P = B.P, S = B.S;
  for (let a = base; a < P.length; a += 9) {
    if (!L) { S.push(0, 0, 0, 0, 0, 0, 0, 0, 0); continue; }
    const b = a + 3, c = a + 6;
    const e1x = P[b] - P[a], e1y = P[b + 1] - P[a + 1], e1z = P[b + 2] - P[a + 2], e2x = P[c] - P[a], e2y = P[c + 1] - P[a + 1], e2z = P[c + 2] - P[a + 2];
    let nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x; const nl = Math.hypot(nx, ny, nz);
    if (!(nl > 1e-9)) { S.push(0, 0, 0, 0, 0, 0, 0, 0, 0); continue; }
    nx /= nl; ny /= nl; nz /= nl;
    let tx = 1, tz = 0, bx = 0, by = 0, bz = 1; const flat = Math.abs(ny) >= 0.97;
    if (!flat) { const tl = Math.hypot(nz, nx); tx = nz / tl; tz = -nx / tl; bx = ny * tz; by = nz * tx - nx * tz; bz = -ny * tx; }
    for (let k = 0; k < 3; k++) { const o = a + k * 3, x = P[o], y = P[o + 1], z = P[o + 2]; S.push(x * tx + z * tz, flat ? z : -(x * bx + y * by + z * bz), L); }
  }
}

// lamplight materials: lit window backs, paper lanterns and coloured glass, glow cards. They follow the game's night.
let MATS = null;
function mats() {
  if (MATS) return MATS;
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const r = g.createRadialGradient(32, 32, 2, 32, 32, 32); r.addColorStop(0, 'rgba(255,190,110,1)'); r.addColorStop(.35, 'rgba(255,160,80,.45)'); r.addColorStop(1, 'rgba(255,140,60,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  MATS = {
    lit: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: 0xffa24a, emissiveIntensity: 0 }),
    paper: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: 0xff7a3a, emissiveIntensity: 0, side: THREE.DoubleSide }),
    glow: new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, vertexColors: true, side: THREE.DoubleSide }),
  };
  return MATS;
}

// ---------- which kit for which game lot ----------
// look: SURF.look(city) (Byzantine cities south of 37° are 'levant'). Types without a kit keep today's builder.
function lotKind(type, cul) {
  switch (type) {
    case 'rowHouse': case 'shopBay': case 'courtyardHouse': case 'towerHouse': case 'haveli': case 'shophouse': case 'siheyuan':
    case 'stiltHouse': case 'stiltCompound': case 'yurtCompound': case 'yurt': return type;
    case 'house': return cul === 'tibet' ? 'tibet' : null;
  }
  return null;
}
function buildLot(k, lot, cul, look) {
  const L = { w: lot.w, d: lot.d, seed: lot.seed, type: lot.type, openL: true, openR: true, side: -1, x: 0 };
  const east = cul === 'song' ? 'song' : 'chinese';
  switch (lotKind(lot.type, cul)) {
    case 'rowHouse': return townHouse(k, L, TOWN[look] ? look : TOWN[cul] ? cul : 'byz');
    case 'shopBay': return shopBay(k, L, cul);
    case 'courtyardHouse': return courtyardHouse(k, L, cul === 'mongol' || cul === 'steppe' || !COURT[cul] ? 'central' : cul);
    case 'towerHouse': return yemenTower(k, L);
    case 'haveli': return haveli(k, L);
    case 'shophouse': return shophouse(k, L, east);
    case 'siheyuan': return siheyuan(k, L, east);
    case 'stiltHouse': case 'stiltCompound': return stilt(k, L);
    case 'yurtCompound': return yurtCompound(k, L);
    case 'yurt': return yurtHouse(k, L);
    case 'tibet': return tibetHouse(k, L);
  }
}
const seedAt = (x, z) => (Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) * 1e4) | 0;

// ---------- near cells: full kit within NEAR metres, today's builders beyond ----------
// cityGen splits each city's kit-able houses into CELL-metre cells, each with today's mesh. When you come within NEAR
// of a cell its kit is built a few houses per frame (BUDGET ms), then swapped in. Far kits are freed.
const CELL = 32, NEAR = 100, HYST = 20, FREE = 260, BUDGET = 6, SHADOW = 60;   // kit cells beyond SHADOW m cast no shadows, to keep the shadow pass light
const regs = [];
let objMatRef = null, tick = 0;
const stats = { cells: 0, built: 0, shown: 0, tris: 0, ms: 0 };
function cellKey(x, z) { return Math.floor(x / CELL) + ',' + Math.floor(z / CELL); }
function register(city, group, cells, cul, look, objMat) {
  objMatRef = objMat;
  for (let i = regs.length - 1; i >= 0; i--) if (regs[i].city === city) regs.splice(i, 1);
  for (const c of cells) { c.kit = null; c.gen = null; c.show = false; }
  regs.push({ city, group, cells, cul, look });
}
function* cellGen(R, cell) {
  const k = new Kit(), bake = new Bake();
  for (const lot of cell.lots) {
    k.push(lot.x, -0.05, lot.z, lot.ry);
    try { buildLot(k, lot, R.cul, R.look); } catch (e) { console.warn('kits: lot failed', lot.type, e); k.parts.length = 0; }
    k.pop(); bake.take(k);
    yield;
  }
  const g = new THREE.Group(); for (const m of bake.meshes(objMatRef)) g.add(m);
  g.userData.lights = bake.lights; g.userData.tris = bake.tris;
  return g;
}
function freeCell(c) { if (!c.kit) return; c.kit.parent && c.kit.parent.remove(c.kit); c.kit.traverse(o => o.geometry && o.geometry.dispose()); c.kit = null; }
// point lights for kit lanterns: a fixed pool (a fixed count keeps shader compiles stable)
const pool = []; const POOL = 4;
function frame(player, dt, night) {
  const M = mats(); M.lit.emissiveIntensity = night * 1.5; M.paper.emissiveIntensity = night * 1.3; M.glow.opacity = night * .85;
  const G = window.__game;
  if (!pool.length && G && G.scene) for (let i = 0; i < POOL; i++) { const l = new THREE.PointLight(0xffb070, 0, 9, 1.6); G.scene.add(l); pool.push(l); }
  // the nearest cell still waiting for its kit: build it within the frame budget
  const t0 = performance.now();
  tick -= dt;
  if (tick < 0) {
    tick = .25; let cand = null, cd = 1e9; const lamps = []; stats.cells = stats.built = stats.shown = stats.tris = 0;
    for (let i = regs.length - 1; i >= 0; i--) {
      const R = regs[i]; if (!R.group.parent) { for (const c of R.cells) freeCell(c); regs.splice(i, 1); continue; }
      const cx = R.city.x, cz = R.city.z, dc = Math.hypot(player.x - cx, player.z - cz);
      for (const c of R.cells) {
        stats.cells++;
        const d = dc > R.city.R + NEAR + 60 ? 1e9 : Math.hypot(player.x - cx - c.cx, player.z - cz - c.cz);
        const want = d < NEAR + (c.show ? HYST : 0);
        if (want && !c.kit && !c.gen && d < cd) { cd = d; cand = [R, c]; }
        c.show = want && !!c.kit;
        if (c.kit) { c.kit.visible = c.show; stats.built++; const sh = d < SHADOW; if (c.kit.userData.sh !== sh) { c.kit.userData.sh = sh; for (const m of c.kit.children) if (m.material !== mats().glow && m.material !== mats().lit) m.castShadow = sh; } if (c.show) { stats.shown++; stats.tris += c.kit.userData.tris; for (const l of c.kit.userData.lights) lamps.push([l, Math.hypot(player.x - cx - l.x, player.z - cz - l.z), R.group]); } }
        if (c.today) c.today.visible = !c.show;
        if (c.kit && d > FREE) freeCell(c);
      }
    }
    if (cand && !regs.some(R => R.cells.some(c => c.gen))) { const [R, c] = cand; c.gen = cellGen(R, c); c.genR = R; }
    lamps.sort((a, b) => a[1] - b[1]);
    pool.forEach((l, i) => { const s = night > .05 && lamps[i]; if (!s) { l.intensity = 0; return; } l.position.set(s[0].x + s[2].position.x, s[0].y + s[2].position.y, s[0].z + s[2].position.z); l.intensity = night * 2.2; });
  }
  for (const R of regs) for (const c of R.cells) if (c.gen) {
    while (performance.now() - t0 < BUDGET) {
      const r = c.gen.next();
      if (r.done) { c.gen = null; c.kit = r.value; c.kit.visible = false; R.group.add(c.kit); tick = 0; break; }
    }
  }
  stats.ms = performance.now() - t0;
}
// build every waiting cell now (tests and screenshots)
function flush(player) { for (let n = 0; n < 400; n++) { frame(player, 1, 0); tick = 0; if (!regs.some(R => R.cells.some(c => c.gen))) { frame(player, 1, 0); if (!regs.some(R => R.cells.some(c => c.gen))) break; } } }

return {
  lotKind, buildLot, seedAt, cellKey, CELL, NEAR, register, frame, flush, stats, regs, mats,
  // parts for other builders (the town square)
  Kit, Bake, M, facade, archCurve, ring, ablaq, band, windowFill, shutters, grille, lattice, door, gableRoof, hipRoof, flatRoof, rng32, pick,
  TOWN, COURT, townHouse, courtyardHouse, shopBay, tibetHouse, shophouse, haveli, yurtHouse,
};

})();
window.KITS = KITS;
