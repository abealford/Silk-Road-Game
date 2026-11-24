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
