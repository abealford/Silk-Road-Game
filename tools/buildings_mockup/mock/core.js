// ============================================================
//  Building-kit mockup: shared core (materials, kit builder, shapes, baking)
//  Everything here is plain Three.js, so it can move into src/ for the real build.
// ============================================================
const V3 = THREE.Vector3;
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function rng32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const pick = (r, a) => a[Math.floor(r() * a.length)];

// ---------- materials: every stylized layer, coloured like the game (surfDet) ----------
const MAT = {}, SCALE = {};
function makeMaterials(R) {
  const loader = new THREE.TextureLoader();
  const an = Math.min(8, R.capabilities.getMaxAnisotropy());
  const tex = (url, srgb) => { const t = loader.load(url); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = an; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  for (const [k, L] of Object.entries(TEX)) {
    const m = MAT[k] = new THREE.MeshStandardMaterial({ map: tex(L.col, true), normalMap: tex(L.nrm, false), normalScale: new THREE.Vector2(.85, .85), vertexColors: true, roughness: k === 'glazed' ? .45 : .92 });
    m.onBeforeCompile = sh => {   // the game's surfDet: detail strength k, blend toward the texture's own colour
      sh.uniforms.uMean = { value: new THREE.Vector3(...L.mean) }; sh.uniforms.uK = { value: L.k }; sh.uniforms.uOwn = { value: L.own };
      sh.fragmentShader = 'uniform vec3 uMean; uniform float uK; uniform float uOwn;\n' + sh.fragmentShader
        .replace('#include <map_fragment>', 'vec3 sTex = texture2D(map, vMapUv).rgb;')
        .replace('#include <color_fragment>', `vec3 det = mix(vec3(1.0), clamp(sTex / max(uMean, vec3(0.003)), 0.0, 3.5), uK);
          float lb = dot(vColor, vec3(0.2126, 0.7152, 0.0722)), lm = dot(uMean, vec3(0.2126, 0.7152, 0.0722));
          diffuseColor.rgb = mix(vColor * det, sTex * (lb / max(lm, 0.003)), uOwn);`);
    };
    m.customProgramCacheKey = () => 'surf' + k;
    SCALE[k] = L.scale;
  }
  MAT.flat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9 });
  MAT.dark = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  MAT.cloth = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, side: THREE.DoubleSide });
  MAT.leaf = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  MAT.iron = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .6, metalness: .4 });
  MAT.lead = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .55, metalness: .25 });
  MAT.gold = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .35, metalness: .8 });
  MAT.lit = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8, emissive: 0xffa24a, emissiveIntensity: 0 });
  MAT.paper = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9, emissive: 0xff7a3a, emissiveIntensity: 0, side: THREE.DoubleSide });   // paper lanterns, coloured glass
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const r = g.createRadialGradient(32, 32, 2, 32, 32, 32); r.addColorStop(0, 'rgba(255,190,110,1)'); r.addColorStop(.35, 'rgba(255,160,80,.45)'); r.addColorStop(1, 'rgba(255,140,60,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  MAT.glow = new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, vertexColors: true });
}
const NOSHADOW = new Set(['glow', 'lit', 'paper']);

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

// ---------- baking: one mesh per material, planar UVs in metres (as the game's aSurf) ----------
class Buckets {
  constructor() { this.B = {}; this.tris = 0; }
  get(mat) { return this.B[mat] || (this.B[mat] = { P: [], N: [], U: [], C: [] }); }
  addPart(p) {
    const g = p.geo, pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
    const v = new V3(), n = new V3(), nm = new THREE.Matrix3().getNormalMatrix(p.m), c = new THREE.Color(p.tint);
    const b = this.get(p.mat), base = b.P.length;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(p.m); n.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize();
      b.P.push(v.x, v.y, v.z); b.N.push(n.x, n.y, n.z);
      const k = p.opt.grime ? .6 + .4 * sm(0, 1.7, v.y) : 1;   // dirt and damp at the foot of walls
      if (p.opt.vcol) { const ca = g.attributes.color; b.C.push(ca.getX(i), ca.getY(i), ca.getZ(i)); } else b.C.push(c.r * k, c.g * k, c.b * k);
      if (p.opt.uv) b.U.push(uv.getX(i), uv.getY(i));
    }
    if (!p.opt.uv) planarUV(b, base, SCALE[p.mat] || 1);
    this.tris += pos.count / 3;
  }
  // the game's Builder output, textured as the game does it (aSurf = u, v in metres, layer + 1)
  addBuilder(geo, names) {
    const P = geo.attributes.position.array, N = geo.attributes.normal.array, C = geo.attributes.color.array, S = geo.attributes.aSurf ? geo.attributes.aSurf.array : null;
    for (let t = 0; t < P.length; t += 9) {
      const layer = S ? S[t + 2] : 0, mat = layer ? names[layer - 1] : 'flat', b = this.get(mat), sc = SCALE[mat] || 1;
      for (let j = 0; j < 9; j++) { b.P.push(P[t + j]); b.N.push(N[t + j]); b.C.push(C[t + j]); }
      for (let j = 0; j < 9; j += 3) { if (S) b.U.push(S[t + j] / sc, S[t + j + 1] / sc); else b.U.push(0, 0); }
    }
    this.tris += P.length / 9;
  }
  toGroup(group) {
    for (const [mat, b] of Object.entries(this.B)) {
      if (!b.P.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(b.N, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(b.U, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(b.C, 3));
      const mesh = new THREE.Mesh(g, MAT[mat] || MAT.flat); mesh.castShadow = !NOSHADOW.has(mat); mesh.receiveShadow = mat !== 'glow';
      if (mat === 'glow') mesh.renderOrder = 2;
      group.add(mesh);
    }
    return this.tris;
  }
}
function planarUV(b, base, sc) {
  const P = b.P;
  for (let i = base; i < P.length; i += 9) {
    const ax = P[i + 3] - P[i], ay = P[i + 4] - P[i + 1], az = P[i + 5] - P[i + 2], bx = P[i + 6] - P[i], by = P[i + 7] - P[i + 1], bz = P[i + 8] - P[i + 2];
    const nx = Math.abs(ay * bz - az * by), ny = Math.abs(az * bx - ax * bz), nz = Math.abs(ax * by - ay * bx);
    for (let j = 0; j < 9; j += 3) { const x = P[i + j], y = P[i + j + 1], z = P[i + j + 2]; if (ny >= nx && ny >= nz) b.U.push(x / sc, z / sc); else if (nx >= nz) b.U.push(z / sc, y / sc); else b.U.push(x / sc, y / sc); }
  }
}
function bakeKit(kit, group) { const b = new Buckets(); for (const p of kit.parts) b.addPart(p); return b.toGroup(group); }

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
