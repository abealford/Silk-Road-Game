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
