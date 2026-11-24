// ============================================================
//  TEST BUILD (branch test-constantinople-square-v2, not for merge):
//  Constantinople's town square laid out from the user's markup of
//  24 Nov 2026 (see claude/silk-road-city-centre-redesign.md).
//  Kit coordinates: metres, origin = centre of the square, +u toward the
//  gate road (roughly east), +v across it (roughly south). The kit group
//  is rotated by -theta, like the plaza.
//    market (west half of the square) · blacksmith (north edge)
//    Venetian alley with a sign → Venetian guild hall (north)
//    tavern (south edge) · stables, outdoors (south-east)
// ============================================================

// The test keeps its own browser storage, so it never touches the real game's saves.
(() => {
  try {
    const P = Storage.prototype, pre = k => (typeof k === 'string' && k.startsWith('silkroad') ? 'sqtest_' + k : k);
    const g = P.getItem, s = P.setItem, r = P.removeItem;
    P.getItem = function (k) { return g.call(this, pre(k)); };
    P.setItem = function (k, v) { return s.call(this, pre(k), v); };
    P.removeItem = function (k) { return r.call(this, pre(k)); };
  } catch (e) { /* storage unavailable: nothing to protect */ }
})();
window.SQUARE_DEMO = true;

window.SQUARE_KIT = (() => {
  const SQ = { u0: -13, u1: 13, v0: -13, v1: 13 };               // the paved square: today's 26 x 26
  // paved like the square (no houses): the Venetian alley
  const PAVE = [{ u0: 6.4, u1: 11.6, v0: -24.2, v1: -12.5 }];
  // kept free of filler houses and landmarks: each building with a small margin
  const RESERVE = [
    { u0: -8.2, u1: 3.0, v0: -20.2, v1: -12.5 },   // blacksmith
    { u0: 2.0, u1: 18.2, v0: -24.6, v1: -12.5 },   // the alley's two flanking houses
    { u0: 1.8, u1: 18.4, v0: -36.4, v1: -23.4 },   // Venetian guild hall
    { u0: -7.2, u1: 5.0, v0: 12.5, v1: 21.4 },     // tavern
    { u0: 4.4, u1: 14.8, v0: 12.5, v1: 18.8 },     // stables
  ];
  const has = city => city.id === 'constantinople';
  const inSquare = (u, v) => u >= SQ.u0 - 1 && u <= SQ.u1 + 1 && v >= SQ.v0 - 1 && v <= SQ.v1 + 1;

  const K = {
    stone: 0xd6c9ae, stone2: 0xc9b998, brick: 0xa4553a, terra: 0xb0563c, plaster: 0xe6dcc6, plaster2: 0xdccfb2,
    wood: 0x7a5236, woodD: 0x4f3524, woodL: 0x9a7048, floorW: 0x8e6a48, floorS: 0xbcae92,
    dark: 0x2a211c, iron: 0x3a3a3c, steel: 0x9aa0a6, red: 0x8c2a24, gold: 0xd8b040, green: 0x2f5a3a,
    coal: 0xff7a1e, ember: 0xffc04a, water: 0x3f7a92, hay: 0xd8b85a,
  };

  // a painted board: canvas text on both faces (readable from either side)
  function signMesh(text, w, h, bg, fg, opt = {}) {
    const cv = document.createElement('canvas'); const px = 128; cv.width = Math.round(w * px); cv.height = Math.round(h * px); const g = cv.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, cv.width, cv.height);
    g.strokeStyle = fg; g.lineWidth = Math.max(4, cv.height * .06); g.strokeRect(g.lineWidth, g.lineWidth, cv.width - g.lineWidth * 2, cv.height - g.lineWidth * 2);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    let fs = cv.height * (opt.size || .5); g.font = `bold ${fs}px Georgia, 'Times New Roman', serif`;
    while (g.measureText(text).width > cv.width * .86 && fs > 8) { fs -= 2; g.font = `bold ${fs}px Georgia, 'Times New Roman', serif`; }
    g.fillText(text, cv.width / 2, cv.height / 2 + fs * .04);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    const m = new THREE.MeshLambertMaterial({ map: t });
    const grp = new THREE.Group();
    for (const s of [1, -1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); p.position.z = s * .051; if (s < 0) p.rotation.y = Math.PI; grp.add(p); }
    return grp;
  }

  function build(ctx) {
    const { city, group, theta, firstBuild, addCollider, B, objMat, bldMat, rng } = ctx;
    const ca = Math.cos(theta), sa = Math.sin(theta);
    const toWorld = (u, v) => [city.x + u * ca - v * sa, city.z + u * sa + v * ca];
    const kit = new THREE.Group(); kit.rotation.y = -theta; group.add(kit);
    const wb = new B.Builder(); wb.rng = rng;   // walls and roofs (building material, textured)
    const pb = new B.Builder(); pb.rng = rng;   // props and furniture
    const kitInfo = { npcs: [], buildings: [] };

    // ---------- colliders in kit space ----------
    const segCol = (u0, v0, u1, v1, r) => { if (!firstBuild) return; const a = toWorld(u0, v0), b = toWorld(u1, v1); addCollider({ seg: [a[0], a[1], b[0], b[1]], r }); };
    const rectCol = (u0, v0, u1, v1) => { if (!firstBuild) return; const c = toWorld((u0 + u1) / 2, (v0 + v1) / 2); addCollider({ rect: [c[0], c[1], (u1 - u0) / 2, (v1 - v0) / 2, -theta] }); };
    const circCol = (u, v, r) => { if (!firstBuild) return; const c = toWorld(u, v); addCollider({ x: c[0], z: c[1], r }); };

    // ---------- walls with openings, Byzantine banded masonry ----------
    // side: 'N' (v = v0), 'S' (v = v1), 'W' (u = u0), 'E' (u = u1); openings [{at, w, h, door, y0}] along the side
    function wall(bd, x0, z0, x1, z1, side, h, t, ops, bands, col) {
      const alongU = side === 'N' || side === 'S';
      const a0 = alongU ? x0 : z0, a1 = alongU ? x1 : z1;
      const fixed = side === 'N' ? z0 + t / 2 : side === 'S' ? z1 - t / 2 : side === 'W' ? x0 + t / 2 : x1 - t / 2;
      const out = side === 'N' || side === 'W' ? -1 : 1;
      const piece = (s0, s1, y0, y1) => {
        if (s1 - s0 < 0.05 || y1 - y0 < 0.05) return; const m = (s0 + s1) / 2, L = s1 - s0;
        if (alongU) bd.box(m, y0, fixed, L, y1 - y0, t, col); else bd.box(fixed, y0, m, t, y1 - y0, L, col);
        for (const by of bands) if (by > y0 + .05 && by + .32 < y1) {
          for (let k = 0; k < 3; k++) { const yy = by + k * .11; if (alongU) bd.box(m, yy, fixed, L, .07, t + .06, K.brick); else bd.box(fixed, yy, m, t + .06, .07, L, K.brick); }
        }
      };
      const sorted = (ops || []).slice().sort((p, q) => p.at - q.at); let s = a0;
      for (const o of sorted) {
        const o0 = o.at - o.w / 2, o1 = o.at + o.w / 2;
        piece(s, o0, 0, h);
        if (!o.door) piece(o0, o1, 0, o.y0);
        piece(o0, o1, (o.door ? 0 : o.y0) + o.h, h);
        const top = (o.door ? 0 : o.y0) + o.h; const of = fixed + out * (t / 2 + .04);
        if (alongU) bd.arch(o.at, top - .02, of, o.w / 2 + .18, .16, K.stone2, Math.PI / 2); else bd.arch(of, top - .02, o.at, o.w / 2 + .18, .16, K.stone2, 0);
        if (!o.door) { if (alongU) bd.box(o.at, o.y0, fixed, o.w, o.h, t * .35, K.dark); else bd.box(fixed, o.y0, o.at, t * .35, o.h, o.w, K.dark); }
        s = o1;
      }
      piece(s, a1, 0, h);
      let c = a0; const doors = sorted.filter(o => o.door);
      for (const o of doors) { const o0 = o.at - o.w / 2; if (o0 - c > .1) alongU ? segCol(c, fixed, o0, fixed, t / 2) : segCol(fixed, c, fixed, o0, t / 2); c = o.at + o.w / 2; }
      if (a1 - c > .1) alongU ? segCol(c, fixed, a1, fixed, t / 2) : segCol(fixed, c, fixed, a1, t / 2);
    }

    // a hollow building you can walk into: floor, four walls, ceiling, beams, roof
    function building(spec) {
      const { u0, v0, u1, v1, h, t = .6, ops = {}, bands = [1.6, 3.4], col = K.stone, floor = K.floorW, roof = 'hip', roofH = 2.4, upper, surf = 'plaster' } = spec;
      const W2 = u1 - u0, D2 = v1 - v0, cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
      wb.setSurf(surf);
      pb.box(cu, -.02, cv, W2 - t * 2 + .02, .14, D2 - t * 2 + .02, floor);                       // floor (top at .12)
      wb.box(cu, -.12, cv, W2 + .5, .2, D2 + .5, K.stone2);                                      // plinth (top at .08, under the floor)
      for (const side of ['N', 'S', 'W', 'E']) {
        const isU = side === 'N' || side === 'S';
        if (isU) wall(wb, u0, v0, u1, v1, side, h, t, ops[side], bands, col);
        else wall(wb, u0, v0 + t, u1, v1 - t, side, h, t, ops[side], bands, col);
      }
      wb.box(cu, h - .22, cv, W2 - t * 2 + .02, .22, D2 - t * 2 + .02, K.woodD);
      const nb = Math.max(2, Math.round(W2 / 3)); for (let k = 1; k < nb; k++) pb.box(u0 + t + (W2 - 2 * t) * k / nb, h - .52, cv, .26, .3, D2 - t * 2, K.wood);
      let top = h;
      if (upper) { // timber-framed upper storey, closed inside
        const uh = upper.h; wb.box(cu, h, cv, W2 + .5, uh, D2 + .5, K.plaster);
        const nu = Math.round(W2 / 2.2), nv = Math.round(D2 / 2.2);
        for (let k = 0; k <= nu; k++) { const x = u0 - .25 + (W2 + .5) * k / nu; for (const sv of [-1, 1]) wb.box(x, h, cv + sv * (D2 / 2 + .27), .18, uh, .06, K.woodD); }
        for (let k = 0; k <= nv; k++) { const z = v0 - .25 + (D2 + .5) * k / nv; for (const su of [-1, 1]) wb.box(cu + su * (W2 / 2 + .27), h, z, .06, uh, .18, K.woodD); }
        for (const sv of [-1, 1]) { wb.box(cu, h, cv + sv * (D2 / 2 + .28), W2 + .5, .2, .06, K.woodD); wb.box(cu, h + uh - .2, cv + sv * (D2 / 2 + .28), W2 + .5, .2, .06, K.woodD); }
        for (let k = 0; k < Math.round(W2 / 3.2); k++) { const x = u0 + 1.6 + k * 3.2; for (const sv of [-1, 1]) wb.box(x, h + uh * .35, cv + sv * (D2 / 2 + .29), .9, 1.0, .05, K.dark); }
        top = h + uh;
      }
      if (roof === 'hip') wb.hip(cu, top, cv, W2 + 1.4, roofH, D2 + 1.4, K.terra, 0, .12);
      else if (roof === 'gable') wb.gable(cu, top, cv, W2 + 1.2, roofH, D2 + 1.2, K.terra);
      wb.box(cu, top - .05, cv, W2 + 1.5, .12, D2 + 1.5, K.woodD);
      kitInfo.buildings.push({ name: spec.name, u0, v0, u1, v1 });
    }

    // a closed town house (not enterable): plastered, two storeys, shuttered windows on given faces
    function townHouse(u0, v0, u1, v1, h, faces, opt = {}) {
      const W2 = u1 - u0, D2 = v1 - v0, cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
      wb.setSurf('plaster');
      wb.box(cu, -.05, cv, W2, h, D2, opt.col || K.plaster);
      for (let k = 0; k < 3; k++) wb.box(cu, 3.0 + k * .11, cv, W2 + .06, .07, D2 + .06, K.brick);   // a brick band between the storeys
      wb.hip(cu, h, cv, W2 + 1.0, 1.8, D2 + 1.0, K.terra, 0, .12); wb.box(cu, h - .05, cv, W2 + 1.1, .12, D2 + 1.1, K.woodD);
      for (const f of faces) {
        const alongU = f === 'N' || f === 'S'; const L = alongU ? W2 : D2; const n = Math.max(1, Math.floor(L / 2.6));
        for (let k = 0; k < n; k++) {
          const a = (alongU ? u0 : v0) + L * (k + .5) / n;
          for (const [y0, hh] of [[1.2, 1.2], [3.8, 1.2]]) {
            if (y0 < 2 && opt.noLowWindows) continue;
            if (f === 'N') wb.box(a, y0, v0 - .03, .8, hh, .1, K.dark); else if (f === 'S') wb.box(a, y0, v1 + .03, .8, hh, .1, K.dark);
            else if (f === 'W') wb.box(u0 - .03, y0, a, .1, hh, .8, K.dark); else wb.box(u1 + .03, y0, a, .1, hh, .8, K.dark);
          }
        }
      }
      rectCol(u0, v0, u1, v1);
    }

    const person = (cul, role, v, u, vv, face, opt = {}) => {
      const kitL = HOOKS.lifeKit; if (!kitL || !kitL.makePerson) return null;
      const p = kitL.makePerson(cul, role, v); p.position.set(u, opt.y || 0, vv); p.rotation.y = face;
      if (opt.sit) { p.position.y = -.17; for (const l of p.userData.legs) l.rotation.x = -1.45; }
      kit.add(p); circCol(u, vv, .35);
      const n = { obj: p, u, v: vv, face, talk: !!opt.label, idle: Math.random() * 6 };
      if (opt.label && kitL.textSprite) { const s = kitL.textSprite(opt.label); s.position.set(u, opt.labelY || (opt.sit ? 2.1 : 2.55), vv); kit.add(s); n.label = s; }
      kitInfo.npcs.push(n); return p;
    };
    const face = (du, dv) => Math.atan2(du, dv);
    const sign = (text, u, y, v, ry, w, h, bg, fg, size) => { const s = signMesh(text, w, h, bg, fg, { size }); s.position.set(u, y, v); s.rotation.y = ry; kit.add(s); return s; };
    const furn = (k, u, v, ry = 0, col = .9) => { pb.push(u, -.05, v, ry); B.FURN[k](pb, rng); pb.pop(); if (col) circCol(u, v, col); };

    // ================= the market: west half of the square =================
    // The Merchant's stall faces into the square; more stallholders stand behind him.
    const E = Math.PI / 2;   // a stall facing +u (east, toward the middle of the square)
    for (const dv of [-1.5, 1.5]) { pb.push(-4.5, -.05, -1 + dv, E); B.FURN.stall(pb, rng, 'byz'); pb.pop(); }
    pb.box(-4.5, 2.45, -1, 6.6, .08, 3.2, K.red, E, -.15);                                     // one big red awning over both
    for (const su of [-1.5, 1.5]) for (const sv of [-3.3, 3.3]) pb.cyl(-4.5 + su, 0, -1 + sv, .07, .08, 2.6, K.woodD, 5);
    pb.box(-3.0, 2.55, -1, 3.4, .1, .1, K.woodD, E);                                           // the sign board's rail
    sign('Merchant', -2.95, 2.95, -1, E, 2.8, .7, '#5a2a1a', '#f0d27a', .55);
    furn('sacks', -4.6, -4.8, 0, .8); furn('jars', -4.6, 2.9, 0, .8); furn('crates', -6.6, 2.4, 0, .8);
    rectCol(-5.6, -3.9, -3.5, 1.9);
    person('byz', 'rich', 1, -5.25, -1, face(1, 0), { label: 'Merchant', labelY: 3.75 });
    // the stalls behind him, two staggered rows
    const stalls = [[-8.6, -6.6], [-8.6, -1], [-8.6, 4.6], [-12, -9.4], [-12, -3.8], [-12, 1.8], [-12, 7.4]];
    stalls.forEach(([u, v], i) => {
      pb.push(u, -.05, v, E); B.FURN.stall(pb, rng, 'byz'); pb.pop(); rectCol(u - 1, v - 1.45, u + 1, v + 1.45);
      if (i !== 5) person('byz', i % 3 ? 'plain' : 'rich', i % 5, u - .6, v, face(1, 0));
    });
    for (const [k, u, v] of [['barrels', -10.3, -9.6], ['crates', -10.3, 8.4], ['sacks', -6.8, -9.4], ['jars', -12.2, 10.2]]) furn(k, u, v, rng() * 6, .8);
    // shoppers between the stalls and in front of the Merchant
    for (const [u, v, f, k, r] of [[-6.7, -5.2, face(-1, -.3), 0, 'plain'], [-6.6, 3.3, face(-1, .4), 1, 'rich'], [-10.3, -1.6, face(-1, 0), 2, 'plain'], [-10.2, 4.0, face(-1, .3), 3, 'plain'],
      [-2.6, 1.6, face(-1, -.8), 4, 'rich'], [-2.4, -3.4, face(-1, .6), 0, 'plain'], [-10.4, -6.8, face(-1, 0), 1, 'plain']]) person('byz', r, k, u, v, f);
    // a few people crossing the square
    for (const [u, v, f, k] of [[3.5, 3, 2.2, 2], [4.4, 3.6, 4.6, 3], [7, -6, .5, 4], [1.5, -5.5, 3.6, 0], [9.5, 6.5, 5.2, 1]]) person('byz', 'plain', k, u, v, f);

    // ================= the blacksmith: north edge of the square =================
    building({ name: 'Blacksmith', u0: -7, v0: -19, u1: 2, v1: -10, h: 4.0, t: .6, bands: [1.5, 3.0], roof: 'gable', roofH: 2.0, floor: K.floorS, col: K.stone2, surf: 'rubble',
      ops: { S: [{ at: -2.5, w: 2.6, h: 2.9, door: true }, { at: -5.3, w: 1.1, h: 1.0, y0: 1.5 }, { at: .5, w: 1.1, h: 1.0, y0: 1.5 }], E: [{ at: -15.5, w: 1.1, h: 1.0, y0: 1.6 }] } });
    // the forge in the north-west corner, its hood and a chimney through the roof
    pb.box(-5.1, 0, -16.9, 2.4, 1.0, 2.4, K.stone2); pb.box(-5.1, .98, -16.9, 1.8, .1, 1.8, K.dark);
    for (let k = 0; k < 7; k++) pb.sphere(-5.6 + (k % 3) * .5, 1.08, -17.4 + (k >> 1) * .35, .17, k % 2 ? K.coal : K.ember, 5, .6);
    pb.pyramid(-5.1, 2.0, -16.9, 2.4, 1.3, K.stone2); wb.setSurf('rubble'); wb.box(-5.1, 3.1, -16.9, .9, 4.2, .9, K.stone2); wb.box(-5.1, 7.3, -16.9, 1.1, .2, 1.1, K.stone);
    pb.box(-3.5, .9, -17.7, .5, .3, .4, K.woodD); pb.box(-3.5, 1.2, -17.7, .1, .5, .1, K.woodD);                 // bellows
    rectCol(-6.4, -18.4, -3.8, -15.6);
    // anvil, quench tub, grindstone
    pb.cyl(-3.2, 0, -14.2, .3, .35, .6, K.woodD, 6); pb.box(-3.2, .6, -14.2, .9, .25, .35, K.iron); pb.cone(-2.6, .67, -14.2, .1, .4, K.iron, 4, 0, 0, -Math.PI / 2);
    pb.cyl(-5.6, 0, -13.5, .5, .45, .7, 0x7a5236, 8); pb.cyl(-5.6, .62, -13.5, .46, .46, .03, K.water, 8);
    pb.cyl(.4, .55, -17.6, .45, .45, .18, K.stone, 10, 0, 0, Math.PI / 2); pb.box(.4, 0, -17.6, .15, .55, .5, K.wood);
    circCol(-3.2, -14.2, .55); circCol(-5.6, -13.5, .55); circCol(.4, -17.6, .55);
    // tools on the north wall
    pb.box(-1.5, 1.3, -18.33, 3.6, 1.5, .1, K.wood);
    for (let k = 0; k < 6; k++) { const x = -3 + k * .6; pb.box(x, 1.5 + (k % 2) * .2, -18.25, .06, .9, .05, K.woodD); pb.box(x, 2.3 + (k % 2) * .2, -18.25, .26, .14, .07, K.iron); }
    // weapon racks along the west wall: swords and spears standing, shields and helmets above
    for (const rv of [-14.2, -11.8]) {
      pb.box(-6.15, 0, rv, .5, .12, 2.0, K.wood); pb.box(-6.15, 1.0, rv, .5, .1, 2.0, K.wood); for (const e of [-.95, .95]) pb.box(-6.15, 0, rv + e, .1, 1.15, .1, K.woodD);
      for (let k = 0; k < 5; k++) { const z = rv - .8 + k * .4; if (rv < -13) { pb.box(-6.15, .12, z, .05, 1.05, .07, K.steel); pb.box(-6.15, 1.1, z, .07, .05, .28, K.gold); } else { pb.cyl(-6.15, .12, z, .025, .03, 2.3, K.woodL, 4); pb.cone(-6.15, 2.42, z, .06, .26, K.steel, 4); } }
      rectCol(-6.4, rv - 1, -5.9, rv + 1);
    }
    for (let k = 0; k < 3; k++) pb.cyl(-6.33, 2.35, -14.6 + k * 1.3, .5, .5, .06, [K.red, 0x2f4f6f, K.gold][k], 12, 0, 0, Math.PI / 2);   // shields on the wall
    pb.box(-6.2, 1.75, -11.8, .35, .06, 2.0, K.wood); for (let k = 0; k < 3; k++) pb.sphere(-6.15, 1.95, -12.5 + k * .7, .2, K.steel, 6, .9);   // helmets on a shelf
    // a mail shirt on a stand
    pb.cyl(-4.2, 0, -11.2, .05, .06, 1.2, K.woodD, 4); pb.cyl(-4.2, 1.0, -11.2, .24, .3, .7, 0x6a6e72, 8); pb.box(-4.2, 1.65, -11.2, .7, .08, .08, K.woodD); circCol(-4.2, -11.2, .35);
    // the shop counter on the east side, the smith behind it facing the door
    pb.box(.1, 0, -13.6, .9, 1.05, 3.4, K.woodD); pb.box(.1, 1.05, -13.6, 1.0, .06, 3.5, K.woodL);
    pb.box(.1, 1.11, -14.6, .5, .08, .25, K.steel); pb.box(.1, 1.11, -12.8, .4, .14, .4, K.iron); pb.sphere(.1, 1.25, -13.7, .16, K.steel, 6, .9);
    rectCol(-.4, -15.3, .6, -11.9);
    person('byz', 'groom', 1, 1.05, -13.6, face(-1, 0), { label: 'Blacksmith' });
    person('byz', 'plain', 3, -3.9, -14.8, face(.8, .6));             // the smith's hand at the anvil
    // outside: a hanging sign by the door, an anvil and barrels
    pb.box(-.8, 3.25, -9.45, .08, .08, 1.0, K.iron, E);
    sign('Blacksmith', -.8, 2.75, -9.2, 0, 1.6, .55, '#3a2a1e', '#e8d8b0', .5);
    pb.cyl(-5.8, 0, -8.6, .25, .3, .55, K.woodD, 6); pb.box(-5.8, .55, -8.6, .8, .22, .3, K.iron); circCol(-5.8, -8.6, .5);
    furn('barrels', 1.0, -8.8, 0, .8);

    // ================= the Venetian Quarter: an alley north from the square =================
    // two houses flank the alley; a sign over its mouth; the guild hall closes the end
    townHouse(2.5, -24.2, 6.4, -12.5 + 0, 6.2, ['E', 'S'], {});
    townHouse(11.6, -24.2, 17.2, -12.5, 6.2, ['W', 'S'], {});
    wb.setSurf('plaster');
    // a timber balcony and laundry across the alley
    pb.box(7.0, 3.6, -19.5, 1.2, .12, 3.0, K.woodD); for (const z of [-20.9, -18.1]) pb.box(7.5, 3.6, z, .06, .9, .06, K.woodD); pb.box(7.5, 4.45, -19.5, .06, .06, 3.0, K.woodD);
    for (const [v, y] of [[-16.2, 5.0], [-21.6, 4.8]]) { pb.box(9, y, v, 5.2, .02, .02, 0x3a3028); for (let k = 0; k < 4; k++) pb.box(7.3 + k * 1.1, y - .55, v, .7, .55, .03, [0xe8e0cc, 0x8a2a24, 0x2f4f6f, 0xd8c69a][k]); }
    // the sign over the alley mouth: a beam between the two houses, a painted board under it, lanterns
    pb.box(9, 4.35, -12.7, 5.4, .22, .22, K.woodD);
    for (const x of [7.2, 10.8]) pb.box(x, 3.75, -12.7, .05, .6, .05, K.iron);
    sign('Venetian Quarter', 9, 3.15, -12.7, 0, 3.8, .78, '#7a1e1a', '#f0cc5a', .5);
    for (const x of [6.0, 12.0]) { pb.box(x, 2.6, -12.3, .06, .06, .5, K.iron); pb.box(x, 2.15, -12.1, .26, .42, .26, 0xffd88a); }
    // banners of Saint Mark on the houses at the mouth
    for (const x of [5.2, 12.8]) { pb.box(x, 2.6, -12.42, 1.0, 1.8, .05, K.red); pb.box(x, 3.0, -12.38, .5, .5, .05, K.gold); pb.box(x, 3.5, -12.45, 1.2, .07, .07, K.woodD); }

    // the guild hall (Scuola di San Marco)
    building({ name: 'Venetian Guild', u0: 3, v0: -35, u1: 17, v1: -24, h: 6.6, t: .7, bands: [1.8, 3.8, 5.6], roof: 'hip', roofH: 2.8, surf: 'stoneWarm',
      ops: { S: [{ at: 9, w: 2.6, h: 3.4, door: true }, { at: 4.8, w: 1.2, h: 2.0, y0: 3.8 }, { at: 13.2, w: 1.2, h: 2.0, y0: 3.8 }],
        N: [{ at: 6, w: 1.2, h: 1.8, y0: 4 }, { at: 12, w: 1.2, h: 1.8, y0: 4 }], E: [{ at: -29.5, w: 1.2, h: 1.8, y0: 4 }], W: [{ at: -29.5, w: 1.2, h: 1.8, y0: 4 }] } });
    sign('Venetian Guild', 9, 3.75, -23.55, 0, 2.6, .5, '#1f3a2a', '#f0cc5a', .55);
    for (const x of [7.1, 10.9]) { pb.cyl(x, 0, -23.4, .07, .09, 5.2, K.woodD, 5); pb.box(x + .55, 3.0, -23.4, 1.0, 1.8, .05, K.red); pb.box(x + .55, 3.6, -23.37, .5, .5, .05, K.gold); circCol(x, -23.4, .2); }
    // inside: the guild desk at the back, Saint Mark's banner on the wall behind it
    pb.box(9.5, 0, -32.2, 4.2, .82, 1.3, K.woodD); pb.box(9.5, .82, -32.2, 4.3, .06, 1.4, K.green);
    for (let k = 0; k < 4; k++) pb.box(8.0 + k * .9, .88, -32.3, .5, .14 + (k % 2) * .06, .36, [K.red, 0x4a3a2a, K.gold, 0x2a3a5a][k]);
    pb.cyl(11.2, .88, -32.0, .08, .1, .22, K.dark, 6);
    pb.box(9.5, 0, -33.6, .8, .5, .7, K.wood); pb.box(9.5, .5, -34.0, .8, 1.0, .1, K.wood);
    rectCol(7.4, -32.9, 11.6, -31.5);
    pb.box(9.5, 2.2, -34.25, 2.4, 3.2, .06, K.red); pb.box(9.5, 3.3, -34.21, 1.1, 1.1, .05, K.gold); pb.box(9.5, 5.5, -34.2, 2.8, .12, .12, K.woodD);
    pb.box(9.5, .01, -30.3, 5.2, .02, 2.8, 0x6a2a2a); pb.box(9.5, .03, -30.3, 4.4, .02, 2.0, 0xb08a40);   // carpet
    person('byz', 'rich', 2, 9.5, -33.3, face(0, 1), { label: 'Venetian Guild · Quests' });
    // a counting table with ledgers, a balance and samples of glass
    pb.box(9.5, 0, -27.6, 5, .8, 1.3, K.wood); pb.box(9.5, .8, -27.6, 5.2, .06, 1.5, K.woodL); rectCol(6.9, -28.4, 12.1, -26.8);
    for (let k = 0; k < 4; k++) pb.box(7.6 + k * 1.2, .86, -27.8 + (k % 2) * .4, .5, .12, .36, [K.red, 0x4a3a2a, 0x2a3a5a][k % 3]);
    pb.cyl(11.4, .86, -27.4, .05, .06, .5, K.gold, 6); pb.box(11.4, 1.34, -27.4, .8, .04, .04, K.gold); for (const sx of [-.38, .38]) pb.cyl(11.4 + sx, 1.12, -27.4, .14, .14, .03, K.gold, 8);
    for (let k = 0; k < 4; k++) pb.sphere(8.4 + k * .3, .9, -27.2, .1, [0x9ad0e0, 0x3a9a7a, 0xe0b050, 0xa04060][k], 6, 1.3);
    // cloth on racks along the east wall, chests and bales
    for (let k = 0; k < 2; k++) { const z = -32.6 + k * 3.0; pb.box(15.9, 0, z, 1.0, 2.3, 2.4, K.woodD); for (let q = 0; q < 6; q++) pb.cyl(15.7, .3 + (q >> 1) * .7, z - .7 + (q % 2) * 1.4, .2, .2, .9, [K.red, 0x2f4f6f, 0x6a7a3a, 0xc8b890][(q + k) % 4], 8, 0, Math.PI / 2); rectCol(15.4, z - 1.2, 16.4, z + 1.2); }
    for (const [x, z] of [[4.4, -33.8], [13.6, -33.8]]) { pb.box(x, 0, z, 1.4, .7, .8, K.woodD); pb.box(x, .7, z, 1.45, .08, .85, K.gold); rectCol(x - .7, z - .4, x + .7, z + .4); }
    for (const [x, z] of [[4.3, -30.6], [4.3, -27.0]]) { pb.push(x, 0, z, rng()); B.FURN[rng() < .5 ? 'crates' : 'barrels'](pb, rng); pb.pop(); circCol(x, z, .9); }
    // Italians: merchants talking, a clerk at the ledgers
    for (const [u, v, f, k] of [[13.4, -26.3, face(-1, 0), 0], [12.3, -26.0, face(1, -.2), 4], [14.4, -29.6, face(-1, 0), 1], [6.2, -25.6, face(.5, -1), 2], [6.6, -29.3, face(1, .2), 3]]) person('byz', 'rich', k, u, v, f);
    person('byz', 'plain', 2, 9.5, -26.6, face(0, -1), { sit: false });

    // ================= the tavern: south edge of the square =================
    building({ name: 'Tavern', u0: -6, v0: 10, u1: 4, v1: 20, h: 4.2, t: .6, bands: [1.5, 3.1], roof: 'hip', roofH: 2.2, upper: { h: 2.8 }, floor: K.floorW, col: K.plaster2, surf: 'plaster',
      ops: { N: [{ at: -1, w: 2.4, h: 3.0, door: true }, { at: -4.2, w: 1.1, h: 1.3, y0: 1.3 }, { at: 2.3, w: 1.1, h: 1.3, y0: 1.3 }],
        E: [{ at: 13, w: 1.1, h: 1.3, y0: 1.3 }, { at: 16, w: 1.1, h: 1.3, y0: 1.3 }], W: [{ at: 12, w: 1.1, h: 1.3, y0: 1.3 }] } });
    // a hanging sign by the door: a jug and the name
    pb.box(1.0, 3.35, 9.65, .08, .08, 1.0, K.iron, E);
    sign('Tavern', 1.0, 2.85, 9.4, 0, 1.4, .55, '#3a2a1e', '#f0d27a', .55);
    pb.sphere(1.0, 2.35, 9.4, .16, 0xb8734a, 6, 1.2);
    // the bar across the back, shelves of jugs behind it, barrels in the corner
    pb.box(.3, 0, 16.9, 5.6, 1.1, 1.0, K.woodD); pb.box(.3, 1.1, 16.9, 5.8, .07, 1.15, K.woodL); rectCol(-2.6, 16.4, 3.2, 17.4);
    for (const y of [1.2, 2.0, 2.8]) { pb.box(.3, y, 19.15, 5.6, .06, .45, K.wood); for (let k = 0; k < 9; k++) { const x = -2.1 + k * .6; if (rng() < .8) (k % 3 ? pb.cyl(x, y + .06, 19.15, .11, .14, .38, [0xb8734a, 0x5a7a4a, 0x8a6a48][k % 3], 6) : pb.sphere(x, y + .28, 19.15, .2, 0xb8734a, 6, 1.2)); } }
    for (let k = 0; k < 3; k++) { const x = -4.6 + (k % 2) * .9, z = 18.4 - (k >> 1) * .95; pb.cyl(x, 0, z, .42, .4, 1.0, 0x7a5236, 8); pb.cyl(x, .25, z, .44, .44, .06, K.iron, 8); pb.cyl(x, .7, z, .44, .44, .06, K.iron, 8); } circCol(-4.2, 18.0, 1.1);
    for (let k = 0; k < 4; k++) pb.cyl(-1.5 + k * 1.3, 1.17, 16.7, .08, .07, .2, 0xb8734a, 6);
    person('byz', 'plain', 2, .3, 17.9, face(0, -1), { label: 'Innkeeper' });
    // the hearth on the west wall
    pb.box(-5.1, 0, 14.6, 1.2, 1.1, 2.6, K.stone2); pb.box(-5.3, 1.1, 14.6, .8, 2.2, 2.2, K.stone2); pb.box(-4.75, .3, 14.6, .5, .3, 1.6, K.dark);
    for (let k = 0; k < 4; k++) pb.cone(-4.6, .55, 14.0 + k * .38, .16, .55 + (k % 2) * .25, k % 2 ? K.ember : K.coal, 5);
    pb.cyl(-4.4, 1.5, 14.6, .45, .32, .6, K.iron, 8);
    rectCol(-5.7, 13.3, -4.5, 15.9);
    // tables and stools, food and drink; diners seated
    const tables = [[-3.0, 12.6], [1.9, 12.6], [-2.4, 15.0]];
    tables.forEach(([x, z], i) => {
      pb.cyl(x, 0, z, .12, .14, .72, K.woodD, 6); pb.cyl(x, .72, z, .7, .7, .07, K.wood, 12); circCol(x, z, .75);
      for (let k = 0; k < 3; k++) { const a = k * 2.1 + i; pb.cyl(x + Math.cos(a) * .35, .79, z + Math.sin(a) * .35, .09, .07, .14, 0xb8734a, 6); }
      pb.cyl(x + .15, .79, z - .1, .22, .16, .06, 0xe0d2aa, 8); pb.sphere(x + .15, .85, z - .1, .1, 0xc8964a, 5, .6);
      for (let k = 0; k < 3; k++) { const a = k * 2.1 + .6 + i; pb.cyl(x + Math.cos(a) * 1.05, 0, z + Math.sin(a) * 1.05, .2, .18, .45, K.wood, 6); }
    });
    [[0, 0, 0], [0, 1, 1], [1, 0, 2], [1, 2, 3], [2, 1, 4]].forEach(([ti, k, v]) => {
      const [x, z] = tables[ti]; const a = k * 2.1 + .6 + ti; const u = x + Math.cos(a) * 1.02, w = z + Math.sin(a) * 1.02;
      person('byz', 'plain', v, u, w, face(x - u, z - w), { sit: true });
    });
    person('byz', 'plain', 4, -1.6, 16.0, face(0, 1));               // a drinker standing at the bar
    // the broker's corner table by the east wall, a rug and a strongbox
    pb.box(2.4, 0, 15.2, 1.9, .03, 1.7, 0x6a2a3a); pb.box(2.4, .03, 15.2, 1.5, .02, 1.3, K.gold);
    pb.cyl(2.2, 0, 15.0, .1, .12, .72, K.woodD, 6); pb.cyl(2.2, .72, 15.0, .5, .5, .07, K.woodD, 12); circCol(2.2, 15.0, .55);
    pb.cyl(2.3, .79, 14.9, .05, .05, .2, 0xf0e6d2, 6); pb.box(2.0, .79, 15.1, .35, .05, .26, 0xe8dcc0); pb.box(3.0, 0, 13.6, .7, .45, .5, K.woodD); pb.box(3.0, .18, 13.33, .72, .05, .04, K.gold);
    person('byz', 'rich', 0, 2.95, 15.4, face(-1, -.3), { sit: true, label: 'Broker' });

    // ================= the stables: outdoors, south-east corner =================
    const fence = (u0, v0, u1, v1) => { const L = Math.hypot(u1 - u0, v1 - v0), n = Math.max(1, Math.round(L / 2.2));
      for (let k = 0; k <= n; k++) { const u = u0 + (u1 - u0) * k / n, v = v0 + (v1 - v0) * k / n; pb.box(u, 0, v, .16, 1.3, .16, K.woodD); }
      const ry = Math.atan2(-(v1 - v0), u1 - u0); for (const y of [.55, 1.05]) pb.box((u0 + u1) / 2, y, (v0 + v1) / 2, L, .1, .08, K.wood, ry); segCol(u0, v0, u1, v1, .12); };
    fence(5, 10.6, 7.4, 10.6); fence(10.8, 10.6, 13.6, 10.6); fence(5, 10.6, 5, 15); fence(13.6, 10.6, 13.6, 15);
    // a lean-to stable along the back: a stone back wall, posts, a sloping roof, two stalls
    wb.setSurf('rubble'); wb.box(9.3, 0, 17.4, 9.0, 3.2, .4, K.stone2);
    for (let k = 0; k <= 3; k++) pb.box(5 + k * 2.87, 0, 14.9, .22, 2.5, .22, K.woodD);
    wb.box(9.3, 2.45, 16.15, 9.6, .16, 3.0, 0x8a6a42, 0, .2); wb.box(9.3, 2.6, 16.15, 9.6, .08, 2.9, 0xa88c52, 0, .2);
    for (const x of [7.87, 10.73]) { pb.box(x, 0, 16.2, .12, 1.3, 2.4, K.wood); segCol(x, 15.0, x, 17.3, .1); }
    segCol(5, 17.4, 13.6, 17.4, .25); segCol(5, 15, 5, 17.4, .12); segCol(13.6, 15, 13.6, 17.4, .12);
    pb.box(12.4, 0, 12.6, .9, .7, 2.6, K.woodD); pb.box(12.4, .68, 12.6, .7, .04, 2.4, K.water); rectCol(11.95, 11.3, 12.85, 13.9);   // trough
    furn('hay', 6.3, 13.0, 0, 1.1); furn('sacks', 12.6, 15.0, .6, .7);
    pb.box(9.1, 0, 11.4, .14, 1.1, .14, K.woodD); pb.box(9.1, 1.0, 11.4, .5, .08, .08, K.woodD);   // hitching post
    { const kitL = HOOKS.lifeKit; if (kitL && kitL.makeAnimal) for (const [kind, x, z, f, v] of [['horse', 9.8, 12.9, Math.PI / 2, 0], ['mule', 6.4, 16.1, Math.PI, 1], ['horse', 12.1, 16.1, Math.PI, 2]]) { const a = kitL.makeAnimal(kind, false, v); a.position.set(x, 0, z); a.rotation.y = f; kit.add(a); kitInfo.npcs.push({ obj: a, u: x, v: z, animal: true, idle: rng() * 6 }); circCol(x, z, .9); } }
    person('byz', 'groom', 2, 8.2, 12.0, face(0, -1), { label: 'Stables' });

    // ================= warm light inside the three buildings =================
    for (const [u, y, v, c, i, d] of [[-4.0, 2.4, -15.2, 0xff8a3a, 14, 10], [-3.6, 1.6, 14.6, 0xffa050, 10, 9], [.3, 3.2, 14.0, 0xffc080, 9, 10], [7, 4.8, -29.5, 0xffd29a, 12, 12], [12.5, 4.8, -29.5, 0xffd29a, 10, 12]]) {
      const l = new THREE.PointLight(c, i, d, 1.3); l.position.set(u, y, v); kit.add(l);
      if (y > 2) { pb.cyl(u, y + .15, v, .02, .02, .6, K.iron, 4); pb.box(u, y - .25, v, .28, .4, .28, 0xffd88a); }
    }
    // ================= meshes =================
    const wm = new THREE.Mesh(wb.geometry(), bldMat); wm.castShadow = true; wm.receiveShadow = true; kit.add(wm);
    const pm = new THREE.Mesh(pb.geometry(), objMat); pm.castShadow = true; pm.receiveShadow = true; kit.add(pm);
    kitInfo.kit = kit; kitInfo.theta = theta; kitInfo.toWorld = toWorld;
    city.squareKit = kitInfo; builtCity = city;
    return kitInfo;
  }

  // NPCs with a label turn toward the player when close; animals shift their weight
  let builtCity = null;
  function frame(player, dt) {
    const c = builtCity; const k = c && c.squareKit; if (!k) return;
    const dx0 = player.x - c.x, dz0 = player.z - c.z; if (dx0 * dx0 + dz0 * dz0 > 200 * 200) return;
    const ca = Math.cos(k.theta), sa = Math.sin(k.theta); const pu = dx0 * ca + dz0 * sa, pv = -dx0 * sa + dz0 * ca;
    for (const n of k.npcs) {
      n.idle += dt; if (n.animal) { const l = n.obj.userData.legs; if (l && l[0]) l[0].rotation.x = Math.sin(n.idle * .7) * .08; continue; }
      if (!n.talk) continue; const du = pu - n.u, dv = pv - n.v; const d2 = du * du + dv * dv;
      const target = d2 < 64 ? Math.atan2(du, dv) : n.face; let dy = target - n.obj.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); n.obj.rotation.y += dy * Math.min(1, dt * 4);
      if (n.label) n.label.visible = d2 > 2.5;
    }
  }

  return { has, inSquare, SQ, PAVE, RESERVE, build, frame };
})();
