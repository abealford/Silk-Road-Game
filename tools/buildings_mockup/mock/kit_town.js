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
