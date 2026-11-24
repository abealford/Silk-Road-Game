// ============================================================
//  DEMO ONLY (branch demo-constantinople-square, never merged):
//  the redesigned town square of Constantinople, built from the
//  layout in the project doc claude/silk-road-city-centre-redesign.md.
//  Kit coordinates: metres, origin = centre of the square, +u toward the
//  gate road, v across it. The kit group is rotated by -theta, like the plaza.
// ============================================================

// The demo keeps its own browser storage, so it never touches the real game's saves.
(() => {
  try {
    const P = Storage.prototype, pre = k => (typeof k === 'string' && k.startsWith('silkroad') ? 'sqdemo_' + k : k);
    const g = P.getItem, s = P.setItem, r = P.removeItem;
    P.getItem = function (k) { return g.call(this, pre(k)); };
    P.setItem = function (k, v) { return s.call(this, pre(k), v); };
    P.removeItem = function (k) { return r.call(this, pre(k)); };
  } catch (e) { /* storage unavailable: nothing to protect */ }
})();
window.SQUARE_DEMO = true;

window.SQUARE_KIT = (() => {
  const SQ = { u0: -40, u1: 40, v0: -30, v1: 30 };              // paved square
  // areas kept clear of filler houses and landmarks: the square and each building with a small margin
  const RESERVE = [{ u0: -40, u1: 40, v0: -30, v1: 30 }, { u0: -10.5, u1: 26.5, v0: -53.5, v1: -28.5 }, { u0: -37.5, u1: -6.5, v0: 28.5, v1: 51.5 },
    { u0: -59.5, u1: -36.5, v0: -11.5, v1: 7.5 }, { u0: 12, u1: 42, v0: 31, v1: 49.5 }];
  const has = city => city.id === 'constantinople';
  const inSquare = (u, v) => u >= SQ.u0 && u <= SQ.u1 && v >= SQ.v0 && v <= SQ.v1;

  // palette (Byzantine): limestone, thin red brick bands, terracotta roofs, dark timber
  const K = {
    stone: 0xd6c9ae, stone2: 0xc9b998, brick: 0xa4553a, terra: 0xb0563c, plaster: 0xe6dcc6,
    wood: 0x7a5236, woodD: 0x4f3524, woodL: 0x9a7048, floorW: 0x8e6a48, floorS: 0xbcae92,
    dark: 0x2a211c, iron: 0x3a3a3c, steel: 0x9aa0a6, red: 0x8c2a24, gold: 0xd8b040, green: 0x2f5a3a,
    coal: 0xff7a1e, ember: 0xffc04a, water: 0x3f7a92, hay: 0xd8b85a,
  };

  function build(ctx) {
    const { city, group, theta, firstBuild, addCollider, B, objMat, bldMat, rng } = ctx;
    const ca = Math.cos(theta), sa = Math.sin(theta);
    const toWorld = (u, v) => [city.x + u * ca - v * sa, city.z + u * sa + v * ca];
    const kit = new THREE.Group(); kit.rotation.y = -theta; group.add(kit);
    const wb = new B.Builder(); wb.rng = rng;   // walls and roofs (building material)
    const pb = new B.Builder(); pb.rng = rng;   // props and furniture
    const kitInfo = { npcs: [], buildings: [] };

    // ---------- colliders in kit space ----------
    const segCol = (u0, v0, u1, v1, r) => { if (!firstBuild) return; const a = toWorld(u0, v0), b = toWorld(u1, v1); addCollider({ seg: [a[0], a[1], b[0], b[1]], r }); };
    const rectCol = (u0, v0, u1, v1) => { if (!firstBuild) return; const c = toWorld((u0 + u1) / 2, (v0 + v1) / 2); addCollider({ rect: [c[0], c[1], (u1 - u0) / 2, (v1 - v0) / 2, -theta] }); };
    const circCol = (u, v, r) => { if (!firstBuild) return; const c = toWorld(u, v); addCollider({ x: c[0], z: c[1], r }); };

    // ---------- walls with openings, Byzantine banded masonry ----------
    // side: 'N' (v = v0), 'S' (v = v1), 'W' (u = u0), 'E' (u = u1); openings [{at, w, h, door}] along the side
    function wall(bd, x0, z0, x1, z1, side, h, t, ops, bands, col) {
      const alongU = side === 'N' || side === 'S';
      const a0 = alongU ? x0 : z0, a1 = alongU ? x1 : z1;
      const fixed = side === 'N' ? z0 + t / 2 : side === 'S' ? z1 - t / 2 : side === 'W' ? x0 + t / 2 : x1 - t / 2;
      const out = side === 'N' || side === 'W' ? -1 : 1;
      const piece = (s0, s1, y0, y1) => {
        if (s1 - s0 < 0.05 || y1 - y0 < 0.05) return; const m = (s0 + s1) / 2, L = s1 - s0;
        if (alongU) bd.box(m, y0, fixed, L, y1 - y0, t, col); else bd.box(fixed, y0, m, t, y1 - y0, L, col);
        for (const by of bands) if (by > y0 + .05 && by + .32 < y1) { // three thin brick courses, proud of both faces
          for (let k = 0; k < 3; k++) { const yy = by + k * .11; if (alongU) bd.box(m, yy, fixed, L, .07, t + .06, K.brick); else bd.box(fixed, yy, m, t + .06, .07, L, K.brick); }
        }
      };
      const sorted = (ops || []).slice().sort((p, q) => p.at - q.at); let s = a0;
      for (const o of sorted) {
        const o0 = o.at - o.w / 2, o1 = o.at + o.w / 2;
        piece(s, o0, 0, h);
        if (!o.door) piece(o0, o1, 0, o.y0);           // window: wall below the sill
        piece(o0, o1, (o.door ? 0 : o.y0) + o.h, h);    // wall above the opening
        // stone arch band on the outer face over doors and windows
        const top = (o.door ? 0 : o.y0) + o.h; const of = fixed + out * (t / 2 + .04);
        if (alongU) wb.arch(o.at, top - .02, of, o.w / 2 + .18, .16, K.stone2, Math.PI / 2); else wb.arch(of, top - .02, o.at, o.w / 2 + .18, .16, K.stone2, 0);
        if (!o.door) { // dark shutter recess inside the window frame, set back in the wall
          if (alongU) bd.box(o.at, o.y0, fixed, o.w, o.h, t * .35, K.dark); else bd.box(fixed, o.y0, o.at, t * .35, o.h, o.w, K.dark);
        }
        s = o1;
      }
      piece(s, a1, 0, h);
      // colliders: wall pieces between door openings (windows are blocked anyway)
      let c = a0; const doors = sorted.filter(o => o.door);
      for (const o of doors) { const o0 = o.at - o.w / 2; if (o0 - c > .1) alongU ? segCol(c, fixed, o0, fixed, t / 2) : segCol(fixed, c, fixed, o0, t / 2); c = o.at + o.w / 2; }
      if (a1 - c > .1) alongU ? segCol(c, fixed, a1, fixed, t / 2) : segCol(fixed, c, fixed, a1, t / 2);
    }

    // a hollow building: floor, four walls, ceiling, beams, roof
    function building(spec) {
      const { u0, v0, u1, v1, h, t = .6, ops = {}, bands = [1.6, 3.4], col = K.stone, floor = K.floorW, roof = 'hip', roofH = 2.4, upper } = spec;
      const W2 = u1 - u0, D2 = v1 - v0, cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
      pb.box(cu, -.02, cv, W2 - t * 2 + .02, .1, D2 - t * 2 + .02, floor);                      // floor
      wb.box(cu, -.05, cv, W2 + .5, .2, D2 + .5, K.stone2);                                      // plinth
      for (const side of ['N', 'S', 'W', 'E']) {
        const isU = side === 'N' || side === 'S';
        // the side walls run between the end walls, so corners don't overlap
        if (isU) wall(wb, u0, v0, u1, v1, side, h, t, ops[side], bands, col);
        else wall(wb, u0, v0 + t, u1, v1 - t, side, h, t, ops[side], bands, col);
      }
      wb.box(cu, h - .22, cv, W2 - t * 2 + .02, .22, D2 - t * 2 + .02, K.woodD);                 // ceiling boards
      const nb = Math.max(2, Math.round(W2 / 3)); for (let k = 1; k < nb; k++) pb.box(u0 + t + (W2 - 2 * t) * k / nb, h - .52, cv, .26, .3, D2 - t * 2, K.wood); // beams
      let top = h;
      if (upper) { // timber-framed upper storey, slightly jettied, closed inside
        const uh = upper.h; wb.box(cu, h, cv, W2 + .5, uh, D2 + .5, K.plaster);
        for (let k = 0; k <= Math.round(W2 / 2.2); k++) { const x = u0 - .25 + (W2 + .5) * k / Math.round(W2 / 2.2); for (const sv of [-1, 1]) wb.box(x, h, cv + sv * (D2 / 2 + .27), .18, uh, .06, K.woodD); }
        for (let k = 0; k <= Math.round(D2 / 2.2); k++) { const z = v0 - .25 + (D2 + .5) * k / Math.round(D2 / 2.2); for (const su of [-1, 1]) wb.box(cu + su * (W2 / 2 + .27), h, z, .06, uh, .18, K.woodD); }
        for (const sv of [-1, 1]) { wb.box(cu, h, cv + sv * (D2 / 2 + .28), W2 + .5, .2, .06, K.woodD); wb.box(cu, h + uh - .2, cv + sv * (D2 / 2 + .28), W2 + .5, .2, .06, K.woodD); }
        for (let k = 0; k < Math.round(W2 / 3.2); k++) { const x = u0 + 1.6 + k * 3.2; for (const sv of [-1, 1]) wb.box(x, h + uh * .35, cv + sv * (D2 / 2 + .29), .9, 1.0, .05, K.dark); }
        top = h + uh;
      }
      // roof: low-pitched terracotta, overhanging, with a ridge
      if (roof === 'hip') wb.hip(cu, top, cv, W2 + 1.4, roofH, D2 + 1.4, K.terra, 0, .12);
      else if (roof === 'gable') wb.gable(cu, top, cv, W2 + 1.2, roofH, D2 + 1.2, K.terra);
      wb.box(cu, top - .05, cv, W2 + 1.5, .12, D2 + 1.5, K.woodD);                               // eaves
      kitInfo.buildings.push({ name: spec.name, u0, v0, u1, v1 });
    }

    const person = (cul, role, v, u, vv, face, opt = {}) => {
      const kitL = HOOKS.lifeKit; if (!kitL || !kitL.makePerson) return null;
      const p = kitL.makePerson(cul, role, v); p.position.set(u, opt.y || 0, vv); p.rotation.y = face;
      if (opt.sit) { p.position.y = -.17; for (const l of p.userData.legs) l.rotation.x = -1.45; }
      kit.add(p); circCol(u, vv, .4);
      const n = { obj: p, u, v: vv, face, talk: !!opt.label, idle: Math.random() * 6 };
      if (opt.label && kitL.textSprite) { const s = kitL.textSprite(opt.label); s.position.set(u, 2.55, vv); kit.add(s); n.label = s; }
      kitInfo.npcs.push(n); return p;
    };
    const face = (du, dv) => Math.atan2(du, dv);

    // ================= the square =================
    // fountain
    pb.cyl(22, -.05, 10, 2.7, 2.8, .75, K.stone2, 16); pb.cyl(22, .55, 10, 2.45, 2.45, .08, K.water, 16);
    pb.cyl(22, .5, 10, .35, .45, 1.6, K.stone, 8); pb.cyl(22, 2.05, 10, 1.0, .5, .3, K.stone2, 10); pb.cyl(22, 2.3, 10, .9, .9, .05, K.water, 10); pb.sphere(22, 2.55, 10, .22, K.stone2, 6);
    circCol(22, 10, 2.8);
    // a ring of plane trees' worth of shade: four stone benches around the fountain
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; const x = 22 + Math.cos(a) * 4.6, z = 10 + Math.sin(a) * 4.6; pb.box(x, 0, z, 1.8, .45, .5, K.stone2, -a + Math.PI / 2); }

    // ---------- open-air market ----------
    const stallRows = [-17, -9, -1, 7, 15], stallCols = [-28, -19, -10, -1]; let si = 0;
    for (const zc of stallRows) for (const xc of stallCols) {
      if (zc === -1 && (xc === -19 || xc === -10)) continue;
      const fz = (stallRows.indexOf(zc) % 2 === 0) ? 0 : Math.PI;  // rows face the aisles alternately
      pb.push(xc, -.05, zc, fz); B.FURN.stall(pb, rng, 'byz'); pb.pop();
      rectCol(xc - 1.4, zc - 1, xc + 1.4, zc + 1);
      if (si % 2 === 0) person('byz', 'plain', si % 5, xc - Math.sin(fz) * .55, zc - Math.cos(fz) * .55, fz);
      si++;
    }
    // crates, sacks and jars between the stalls
    for (const [x, z, k] of [[-32.5, -13, 'crates'], [-32.5, 3, 'barrels'], [-23.5, 19.5, 'sacks'], [-5.5, -21.5, 'jars'], [3.5, 11, 'crates'], [3.5, -5, 'sacks'], [-23.5, -21.5, 'barrels']]) { pb.push(x, -.05, z, rng() * 6); B.FURN[k](pb, rng); pb.pop(); circCol(x, z, .9); }
    // the Merchant's stall: two stalls under one big awning, with a sign board
    for (const dx of [-1.6, 1.6]) { pb.push(-14.5 + dx, -.05, -1, 0); B.FURN.stall(pb, rng, 'byz'); pb.pop(); }
    pb.box(-14.5, 2.45, -1, 7.2, .08, 3.0, K.red, 0, -.15); for (const sx of [-3.5, 3.5]) for (const sz of [-1.4, 1.4]) pb.cyl(-14.5 + sx, 0, -1 + sz, .07, .08, 2.6, K.woodD, 5);
    pb.box(-14.5, 2.7, .55, 3.2, .8, .08, K.woodD); pb.box(-14.5, 2.82, .6, 2.8, .56, .04, K.gold);
    for (const [x, z, k] of [[-19.4, -2.4, 'sacks'], [-9.6, -2.4, 'jars'], [-14.5, -3.0, 'crates']]) { pb.push(x, -.05, z, 0); B.FURN[k](pb, rng); pb.pop(); }
    rectCol(-18.2, -2.6, -10.8, .6);
    person('byz', 'rich', 1, -14.5, -1.6, face(0, 1), { label: 'Merchant' });
    // shoppers in the aisles
    for (const [u, v, f, k] of [[-24, -5, 1.2, 0], [-23.4, 3.2, 2.6, 1], [-15, -13, .4, 2], [-6, -5.4, 3.6, 3], [-6.4, 3, 5.1, 4], [-15.6, 11, 2.2, 0], [-28, 11, 4, 1], [-5, -13, 3.3, 2], [-14, 3.4, 3.1, 3], [-12.4, 3.6, 3.4, 4], [8, 4, 4.4, 1], [14, -6, 2.0, 2]]) person('byz', k % 3 ? 'plain' : 'rich', k, u, v, f);

    // ---------- Venetian Quarter (Scuola di San Marco, fondaco) ----------
    building({ name: 'Venetian Quarter', u0: -8, v0: -51, u1: 24, v1: -31, h: 6.8, t: .7, bands: [1.8, 3.8, 5.6], roof: 'hip', roofH: 3.0,
      ops: { S: [{ at: 8, w: 2.6, h: 3.4, door: true }, { at: -1, w: 1.4, h: 2.2, y0: 3.4 }, { at: 3, w: 1.4, h: 2.2, y0: 3.4 }, { at: 13, w: 1.4, h: 2.2, y0: 3.4 }, { at: 17, w: 1.4, h: 2.2, y0: 3.4 }],
        N: [{ at: 0, w: 1.2, h: 1.8, y0: 4 }, { at: 8, w: 1.2, h: 1.8, y0: 4 }, { at: 16, w: 1.2, h: 1.8, y0: 4 }], E: [{ at: -41, w: 1.2, h: 1.8, y0: 4 }], W: [{ at: -41, w: 1.2, h: 1.8, y0: 4 }] } });
    // banners of Saint Mark at the door
    for (const x of [3, 13]) { pb.cyl(x, 0, -29.2, .07, .09, 6.2, K.woodD, 5); pb.box(x + .75, 3.6, -29.2, 1.4, 2.4, .05, K.red); pb.box(x + .75, 4.4, -29.17, .7, .7, .05, K.gold); pb.sphere(x, 6.25, -29.2, .12, K.gold, 5); circCol(x, -29.2, .2); }
    pb.box(8, 3.9, -30.55, 3.4, .55, .1, K.woodD); pb.box(8, 3.98, -30.5, 3.0, .38, .05, K.gold);   // sign over the door
    // inside: the guild desk at the back, Saint Mark's banner on the wall
    pb.box(8, 0, -45.5, 4.4, .82, 1.3, K.woodD); pb.box(8, .82, -45.5, 4.5, .06, 1.4, K.green);
    for (let k = 0; k < 4; k++) pb.box(6.4 + k * .9, .88, -45.6, .5, .14 + (k % 2) * .06, .36, [K.red, 0x4a3a2a, K.gold, 0x2a3a5a][k]);
    pb.cyl(9.8, .88, -45.3, .08, .1, .22, K.dark, 6);                          // inkwell
    pb.box(8, 0, -47.6, .8, .5, .7, K.wood); pb.box(8, .5, -48, .8, 1.0, .1, K.wood);   // chair
    rectCol(5.8, -46.2, 10.2, -44.8);
    pb.box(8, 2.2, -50.25, 2.4, 3.4, .06, K.red); pb.box(8, 3.4, -50.21, 1.1, 1.1, .05, K.gold); pb.box(8, 5.6, -50.2, 2.8, .12, .12, K.woodD);
    person('byz', 'rich', 2, 8, -46.8, face(0, 1), { label: "Merchants' Guild" });
    // the fondaco counter on the west side, bales and crates behind it
    pb.box(-4.6, 0, -40, 1.0, 1.05, 6, K.woodD); pb.box(-4.6, 1.05, -40, 1.15, .06, 6.1, K.woodL); rectCol(-5.1, -43, -4.1, -37);
    for (const [x, z] of [[-6.4, -48.6], [-6.4, -33.6], [-2.4, -48.6], [21.6, -48.6], [21.6, -44.4], [21.6, -34], [17.6, -48.6]]) { pb.push(x, 0, z, rng()); B.FURN[rng() < .5 ? 'crates' : 'barrels'](pb, rng); pb.pop(); circCol(x, z, .9); }
    for (let k = 0; k < 6; k++) { const x = -6.6 + (k % 2) * .9, z = -38.6 + (k >> 1) * 1.1; pb.box(x, k > 3 ? .7 : 0, z, .8, .7, 1.0, [0xc8b890, 0x9a3a2a, 0x2f4f6f][k % 3]); }
    person('byz', 'rich', 3, -6.1, -41.5, face(1, 0), { label: 'Venetian fondaco' });
    // the counting table down the middle: ledgers, a balance, coin, samples of glass and cloth
    pb.box(8, 0, -39.5, 9, .8, 1.6, K.wood); pb.box(8, .8, -39.5, 9.2, .06, 1.8, K.woodL); rectCol(3.4, -40.4, 12.6, -38.6);
    for (let k = 0; k < 6; k++) pb.box(4.6 + k * 1.3, .86, -39.7 + (k % 2) * .4, .5, .12, .36, [K.red, 0x4a3a2a, 0x2a3a5a][k % 3]);
    pb.cyl(10.4, .86, -39.2, .05, .06, .5, K.gold, 6); pb.box(10.4, 1.34, -39.2, .8, .04, .04, K.gold); for (const sx of [-.38, .38]) pb.cyl(10.4 + sx, 1.12, -39.2, .14, .14, .03, K.gold, 8);
    for (let k = 0; k < 4; k++) pb.sphere(6.6 + k * .3, .9, -39.0, .1, [0x9ad0e0, 0x3a9a7a, 0xe0b050, 0xa04060][k], 6, 1.3);
    for (let k = 0; k < 6; k++) { pb.box(4 + k * 1.6, 0, -41.2, .5, .45, .5, K.woodD); pb.box(4 + k * 1.6, 0, -37.8, .5, .45, .5, K.woodD); }
    // bolts of scarlet and Flemish cloth on racks along the east wall, chests under them
    for (let k = 0; k < 4; k++) { const z = -48 + k * 3.4; pb.box(22.6, 0, z, 1.2, 2.4, 2.6, K.woodD); for (let q = 0; q < 6; q++) pb.cyl(22.4, .3 + (q >> 1) * .7, z - .8 + (q % 2) * 1.6, .22, .22, 1.0, [K.red, 0x2f4f6f, 0x6a7a3a, 0xc8b890][(q + k) % 4], 8, 0, Math.PI / 2); rectCol(22, z - 1.3, 23.2, z + 1.3); }
    for (const [x, z] of [[15, -49.8], [11, -49.8], [3, -49.8]]) { pb.box(x, 0, z, 1.4, .7, .8, K.woodD); pb.box(x, .7, z, 1.45, .08, .85, K.gold); rectCol(x - .7, z - .4, x + .7, z + .4); }
    pb.box(8, .01, -43.5, 6, .02, 3.4, 0x6a2a2a); pb.box(8, .03, -43.5, 5.2, .02, 2.6, 0xb08a40);   // a carpet in front of the desk
    // Italians: merchants talking in pairs, a clerk with a ledger
    for (const [u, v, f, k] of [[14.5, -38, face(-1, 0), 0], [13.2, -38, face(1, 0), 4], [19, -42, face(0, -1), 1], [1, -34.5, face(0, -1), 2], [2.1, -35.6, face(-1, .5), 3]]) person('byz', 'rich', k, u, v, f);

    // ---------- the inn ----------
    building({ name: 'Inn', u0: -35, v0: 31, u1: -9, v1: 49, h: 4.4, t: .6, bands: [1.5, 3.2], roof: 'hip', roofH: 2.6, upper: { h: 3.0 }, floor: K.floorW,
      ops: { N: [{ at: -22, w: 2.4, h: 3.0, door: true }, { at: -30, w: 1.2, h: 1.3, y0: 1.4 }, { at: -27, w: 1.2, h: 1.3, y0: 1.4 }, { at: -17, w: 1.2, h: 1.3, y0: 1.4 }, { at: -13, w: 1.2, h: 1.3, y0: 1.4 }],
        E: [{ at: 36, w: 1.2, h: 1.3, y0: 1.4 }, { at: 44, w: 1.2, h: 1.3, y0: 1.4 }], W: [{ at: 36, w: 1.2, h: 1.3, y0: 1.4 }] } });
    // a hanging sign: a jug on a bracket
    pb.box(-19.5, 3.3, 30.3, .08, .08, 1.4, K.iron); pb.box(-19.5, 2.55, 29.75, .06, .7, .9, K.woodD); pb.sphere(-19.5, 2.9, 29.7, .18, K.gold, 6, 1.2);
    // the bar along the back, shelves and barrels behind it
    pb.box(-22, 0, 44.7, 16, 1.1, 1.2, K.woodD); pb.box(-22, 1.1, 44.7, 16.2, .07, 1.35, K.woodL); rectCol(-30, 44.1, -14, 45.3);
    for (const y of [1.2, 2.1, 3.0]) { pb.box(-22, y, 48.15, 14, .06, .5, K.wood); for (let k = 0; k < 12; k++) { const x = -28.4 + k * 1.15; if (rng() < .75) (k % 3 ? pb.cyl(x, y + .06, 48.15, .12, .16, .42, [0xb8734a, 0x5a7a4a, 0x8a6a48][k % 3], 6) : pb.sphere(x, y + .3, 48.15, .22, 0xb8734a, 6, 1.2)); } }
    for (let k = 0; k < 4; k++) { const x = -32.6 + (k % 2) * .9, z = 46.6 + (k >> 1) * .95; pb.cyl(x, 0, z, .42, .4, 1.0, 0x7a5236, 8); pb.cyl(x, .25, z, .44, .44, .06, K.iron, 8); pb.cyl(x, .7, z, .44, .44, .06, K.iron, 8); } circCol(-32.2, 47, 1.2);
    for (let k = 0; k < 4; k++) pb.cyl(-27 + k * 3, 1.17, 44.5, .08, .07, .2, 0xb8734a, 6);   // cups on the bar
    person('byz', 'plain', 2, -22, 46.4, face(0, -1), { label: 'Innkeeper' });
    // the hearth on the west wall
    pb.box(-34.1, 0, 40, 1.2, 1.1, 3, K.stone2); pb.box(-34.3, 1.1, 40, .8, 2.4, 2.4, K.stone2); pb.box(-33.75, .3, 40, .5, .3, 1.8, K.dark);
    for (let k = 0; k < 5; k++) pb.cone(-33.6, .55, 39.3 + k * .35, .16, .55 + (k % 2) * .25, k % 2 ? K.ember : K.coal, 5);
    pb.cyl(-33.4, 1.6, 40, .5, .35, .7, K.iron, 8);                                          // pot
    rectCol(-34.7, 38.5, -33.5, 41.5);
    // tables and stools, food and drink
    const tables = [[-30, 36], [-25, 36], [-18, 37.6], [-30, 40.6], [-24, 40.6], [-17.4, 41.2]];
    tables.forEach(([x, z], i) => {
      pb.cyl(x, 0, z, .12, .14, .72, K.woodD, 6); pb.cyl(x, .72, z, .85, .85, .07, K.wood, 12); circCol(x, z, .9);
      for (let k = 0; k < 3; k++) { const a = k * 2.1 + i; pb.cyl(x + Math.cos(a) * .4, .79, z + Math.sin(a) * .4, .1, .08, .15, 0xb8734a, 6); }
      pb.cyl(x + .2, .79, z - .15, .26, .18, .06, 0xe0d2aa, 8); pb.sphere(x + .2, .86, z - .15, .12, 0xc8964a, 5, .6);
      for (let k = 0; k < 3; k++) { const a = k * 2.1 + .6 + i; pb.cyl(x + Math.cos(a) * 1.35, 0, z + Math.sin(a) * 1.35, .22, .2, .45, K.wood, 6); }
    });
    // diners and drinkers, seated at the tables
    [[0, 0, 0], [0, 1, 1], [1, 0, 2], [2, 1, 3], [3, 0, 4], [4, 2, 0], [5, 0, 1]].forEach(([ti, k, v]) => {
      const [x, z] = tables[ti]; const a = k * 2.1 + .6 + ti; const u = x + Math.cos(a) * 1.3, w = z + Math.sin(a) * 1.3;
      person('byz', 'plain', v, u, w, face(x - u, z - w), { sit: true });
    });
    person('byz', 'plain', 4, -19.5, 43.2, face(0, 1));            // a drinker standing at the bar
    // the broker's corner table, with a rug and a strongbox
    pb.box(-13, .0, 34.2, 3, .03, 2.4, 0x6a2a3a); pb.box(-13, .03, 34.2, 2.4, .02, 1.8, K.gold);
    pb.cyl(-13, 0, 34.4, .12, .14, .72, K.woodD, 6); pb.cyl(-13, .72, 34.4, .7, .7, .07, K.woodD, 12); circCol(-13, 34.4, .8);
    pb.cyl(-12.8, .79, 34.3, .05, .05, .22, 0xf0e6d2, 6); pb.box(-13.3, .79, 34.6, .4, .05, .3, 0xe8dcc0); pb.box(-10.4, 0, 32.6, .9, .55, .6, K.woodD); pb.box(-10.4, .2, 32.25, .92, .06, .04, K.gold);
    person('byz', 'rich', 0, -12, 33.6, face(-1, .6), { sit: true, label: 'Broker' });

    // ---------- the blacksmith ----------
    building({ name: 'Blacksmith', u0: -57, v0: -9, u1: -41, v1: 5, h: 4.0, t: .6, bands: [1.5, 3.0], roof: 'gable', roofH: 2.2, floor: K.floorS, col: K.stone2,
      ops: { E: [{ at: -2, w: 2.6, h: 2.9, door: true }, { at: -6.4, w: 1.2, h: 1.0, y0: 1.5 }, { at: 2.4, w: 1.2, h: 1.0, y0: 1.5 }], N: [{ at: -49, w: 1.2, h: 1.0, y0: 1.8 }] } });
    // the forge with its hood and chimney through the roof
    pb.box(-55.3, 0, 1.4, 2.6, 1.0, 3.0, K.stone2); pb.box(-55.3, .98, 1.4, 2.0, .1, 2.4, K.dark);
    for (let k = 0; k < 7; k++) pb.sphere(-55.8 + (k % 3) * .5, 1.08, .7 + (k >> 1) * .45, .17, k % 2 ? K.coal : K.ember, 5, .6);
    pb.pyramid(-55.3, 2.0, 1.4, 2.6, 1.4, K.stone2); wb.box(-55.3, 3.2, 1.4, 1.0, 4.4, 1.0, K.stone2); wb.box(-55.3, 7.5, 1.4, 1.2, .2, 1.2, K.stone);
    pb.box(-53.6, .9, 2.8, .5, .3, .4, K.woodD);                   // bellows
    rectCol(-56.6, -.1, -54, 2.9);
    // anvil, quench tub, grindstone
    pb.cyl(-50.2, 0, -.4, .3, .35, .6, K.woodD, 6); pb.box(-50.2, .6, -.4, .9, .25, .35, K.iron); pb.cone(-49.6, .67, -.4, .1, .4, K.iron, 4, 0, 0, -Math.PI / 2);
    pb.cyl(-51.6, 0, 2.4, .5, .45, .7, 0x7a5236, 8); pb.cyl(-51.6, .62, 2.4, .46, .46, .03, K.water, 8);
    pb.cyl(-48.4, .55, 3.6, .45, .45, .18, K.stone, 10, 0, 0, Math.PI / 2); pb.box(-48.4, 0, 3.6, .15, .55, .5, K.wood);
    circCol(-50.2, -.4, .55); circCol(-51.6, 2.4, .55); circCol(-48.4, 3.6, .55);
    // tools on the north wall, arms and armour for sale on the south wall
    pb.box(-51, 1.2, -8.15, 6, 1.6, .1, K.wood);
    for (let k = 0; k < 9; k++) { const x = -53.6 + k * .65; pb.box(x, 1.4 + (k % 2) * .2, -8.05, .06, .9, .05, K.woodD); pb.box(x, 2.2 + (k % 2) * .2, -8.05, .26, .14, .07, K.iron); }
    pb.box(-50, 0, 3.95, 5, .1, .7, K.wood); pb.box(-50, 1.2, 4.25, 5, .1, .4, K.wood);
    for (let k = 0; k < 5; k++) { const x = -52 + k * .9; pb.box(x, .1, 4.15, .07, 1.1, .05, K.steel); pb.box(x, 1.05, 4.15, .3, .05, .07, K.gold); }   // swords standing in the rack
    for (let k = 0; k < 3; k++) pb.cyl(-51.6 + k * 1.6, 2.15, 4.3, .55, .55, .06, [K.red, 0x2f4f6f, K.gold][k], 12, 0, Math.PI / 2);                   // shields on the wall
    for (let k = 0; k < 3; k++) pb.sphere(-51.2 + k * 1.2, 1.4, 4.25, .22, K.steel, 6, .9);                                                                 // helmets
    rectCol(-52.6, 3.4, -47.4, 4.4);
    // the shop counter by the door
    pb.box(-44.8, 0, -3.4, .9, 1.05, 3.2, K.woodD); pb.box(-44.8, 1.05, -3.4, 1.0, .06, 3.3, K.woodL); pb.box(-44.8, 1.11, -4.3, .5, .1, .3, K.steel); pb.box(-44.8, 1.11, -2.8, .4, .14, .4, K.iron);
    rectCol(-45.3, -5, -44.3, -1.8);
    person('byz', 'groom', 1, -46, -3.4, face(1, 0), { label: 'Blacksmith' });
    person('byz', 'plain', 3, -52.2, .6, face(1, -1));             // the smith's hand at the anvil
    // an anvil and a cart outside the door
    pb.cyl(-39, 0, -1.2, .25, .3, .55, K.woodD, 6); pb.box(-39, .55, -1.2, .8, .22, .3, K.iron); circCol(-39, -1.2, .5);
    pb.push(-38.4, -.05, -6.4, Math.PI / 2); B.FURN.cart(pb, rng); pb.pop(); circCol(-38.4, -6.4, 1.6);

    // ---------- the stables (outside) ----------
    const fence = (u0, v0, u1, v1) => { const L = Math.hypot(u1 - u0, v1 - v0), n = Math.max(1, Math.round(L / 2.4));
      for (let k = 0; k <= n; k++) { const u = u0 + (u1 - u0) * k / n, v = v0 + (v1 - v0) * k / n; pb.box(u, 0, v, .16, 1.3, .16, K.woodD); }
      const ry = Math.atan2(-(v1 - v0), u1 - u0); for (const y of [.55, 1.05]) pb.box((u0 + u1) / 2, y, (v0 + v1) / 2, L, .1, .08, K.wood, ry); segCol(u0, v0, u1, v1, .12); };
    fence(14, 33, 20, 33); fence(26, 33, 40, 33); fence(14, 33, 14, 47); fence(40, 33, 40, 47);
    // the lean-to stable along the back: posts, a sloping roof, stalls
    wb.box(27, 0, 46.8, 26, 3.4, .4, K.stone2); for (let k = 0; k <= 5; k++) pb.box(14.3 + k * 5.08, 0, 43.2, .22, 2.6, .22, K.woodD);
    wb.box(27, 2.55, 44.9, 27, .18, 4.6, 0x8a6a42, 0, .17); wb.box(27, 2.7, 44.9, 27, .1, 4.5, 0xa88c52, 0, .17);
    for (let k = 1; k < 5; k++) { pb.box(14.3 + k * 5.08, 0, 45, .12, 1.3, 3.4, K.wood); segCol(14.3 + k * 5.08, 43.3, 14.3 + k * 5.08, 46.6, .1); }
    segCol(14, 46.8, 40, 46.8, .25);
    pb.box(29, 0, 41.8, 10, .7, 1.0, K.woodD); pb.box(29, .68, 41.8, 9.6, .04, .7, K.water); rectCol(24, 41.3, 34, 42.3);
    for (const [x, z] of [[36.5, 36.5], [37.8, 38.6]]) { pb.push(x, -.05, z, 0); B.FURN.hay(pb, rng); pb.pop(); circCol(x, z, 1.1); }
    pb.push(17, -.05, 36, .6); B.FURN.sacks(pb, rng); pb.pop();
    { const kitL = HOOKS.lifeKit; if (kitL && kitL.makeAnimal) for (const [kind, x, z, f, v] of [['horse', 29, 38.8, Math.PI / 2, 0], ['horse', 19.4, 45, Math.PI, 2], ['mule', 29.6, 45.2, Math.PI, 1], ['donkey', 34.7, 45.2, Math.PI, 0]]) { const a = kitL.makeAnimal(kind, false, v); a.position.set(x, 0, z); a.rotation.y = f; kit.add(a); circCol(x, z, .9); kitInfo.npcs.push({ obj: a, animal: true, idle: rng() * 6 }); } }
    person('byz', 'groom', 2, 22, 38.5, face(1, 0), { label: 'Stables & Hiring' });

    // ---------- harbour master (kept from v20) ----------
    pb.cyl(35, 0, -24, .14, .2, 9.5, K.woodD, 6); pb.box(35, 7.6, -24, .1, .1, 3.4, K.woodD); pb.box(35.8, 8.6, -24, 1.6, .6, .05, 0x2a5a8a); pb.box(35.6, 8.6, -23.98, .5, .6, .05, 0xf0ece0);
    pb.push(32.4, -.05, -24.6, Math.PI / 2); B.FURN.stall(pb, rng, 'byz'); pb.pop(); circCol(35, -24, .3); rectCol(31.4, -26, 33.4, -23.2);
    person('byz', 'rich', 4, 31.6, -24.6, face(1, 0), { label: 'Harbour master' });

    // ---------- shade trees along the open east half of the square ----------
    { const tg = B.treeGeo('broad'); if (tg) for (const [x, z] of [[10, -27.5], [20, -27.5], [28, -27.5], [8, 27.5], [16, 27.5], [37.5, -14], [37.5, 14]]) {
      const s2 = .85 + rng() * .15, ry = rng() * 6.28, cs = Math.cos(ry) * s2, sn = Math.sin(ry) * s2; const P = tg.pos, Cc = tg.col;
      for (let q = 0; q < P.length; q += 3) { pb.pos.push(x + P[q] * cs + P[q + 2] * sn, P[q + 1] * s2, z - P[q] * sn + P[q + 2] * cs); pb.col.push(Cc[q], Cc[q + 1], Cc[q + 2]); }
      pb.box(x, -.02, z, 2.2, .12, 2.2, K.stone2); circCol(x, z, .5); } }
    // ---------- building signs, seen from the square ----------
    const kitL = HOOKS.lifeKit;
    if (kitL && kitL.textSprite) for (const [t, u, v] of [['Venetian Quarter', 8, -28.6], ['The Inn', -22, 29.6], ['Blacksmith', -39.6, 1.6], ['Stables', 23, 32]]) { const s = kitL.textSprite(t); s.position.set(u, 4.4, v); s.scale.multiplyScalar(1.4); kit.add(s); }

    // ---------- warm light inside the three buildings (hearth, lamps, forge) ----------
    for (const [u, y, v, c, i, d] of [[-30, 2.6, 40, 0xffa050, 16, 15], [-18, 3.2, 41, 0xffc080, 12, 14], [8, 4.6, -42, 0xffd29a, 16, 18], [-2, 4.6, -37, 0xffd29a, 10, 14], [-53.5, 2.4, 0, 0xff8a3a, 18, 12]]) {
      const l = new THREE.PointLight(c, i, d, 1.3); l.position.set(u, y, v); kit.add(l);
      pb.cyl(u, y + .15, v, .02, .02, Math.max(.3, (v > -40 && u > -40 ? 1 : 1) * .6), K.iron, 4); pb.box(u, y - .25, v, .28, .4, .28, 0xffd88a);   // a hanging lamp at each light
    }
    // ---------- meshes ----------
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
      n.idle += dt; if (n.animal) { const l = n.obj.userData.legs; if (l) l[0].rotation.x = Math.sin(n.idle * .7) * .08; continue; }
      if (!n.talk) continue; const du = pu - n.u, dv = pv - n.v; const d2 = du * du + dv * dv;
      let target = d2 < 64 ? Math.atan2(du, dv) : n.face; let dy = target - n.obj.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); n.obj.rotation.y += dy * Math.min(1, dt * 4);
      if (n.label) n.label.visible = d2 > 4;
    }
  }

  return { has, inSquare, SQ, RESERVE, build, frame };
})();
