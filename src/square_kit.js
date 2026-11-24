// ============================================================
//  TEST BUILD (branch test-all-cities-square, not for merge):
//  the new town square, laid out from the user's markup of 24 Nov 2026
//  (see claude/silk-road-city-centre-redesign.md), in EVERY city.
//  Kit coordinates: metres, origin = centre of the square, +u toward the
//  first gate road (or the best free direction), +v across it. The kit
//  group is rotated by -theta, like the plaza.
//    market (west half) · blacksmith (north edge) · tavern and stables (south edge)
//    cities (tier 2+): an alley north under a "Venetian Quarter" sign to the
//    Scuola di San Marco. Towns (tier 1): no Venetian Quarter, smaller square.
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
  const has = city => !!city;   // every city and town

  // the layout for one city: square size, what is reserved and paved
  function layout(city) {
    const town = city.tier <= 1, ven = !town;
    const s = town ? 10 : 13;          // half the square: 20 x 20 in towns, today's 26 x 26 in cities
    const dN = 13 - s;                  // north pieces move south by dN, south pieces north by dN
    const sq = typeof WORLD !== 'undefined' && WORLD.isSquare && WORLD.isSquare(city);   // grid cities have square walls, nearer the middle
    const dV = city.tier === 2 ? (sq ? 7.5 : 5) : 0; // tier-2 cities: a shorter alley, the Scuola nearer the square
    const SQ = { u0: -s, u1: s, v0: -s, v1: s };
    const PAVE = [], RESERVE = [];
    RESERVE.push({ u0: -8.2, u1: 3.0, v0: -20.2 + dN, v1: -s, k: 'smith' });
    RESERVE.push({ u0: -7.2, u1: 5.0, v0: s, v1: 21.4 - dN, k: 'tavern' });
    RESERVE.push({ u0: 4.4, u1: 14.8, v0: s, v1: 18.8 - dN, k: 'stables' });
    if (ven) {
      PAVE.push({ u0: 6.4, u1: 11.6, v0: -24.2 + dV, v1: -s + .5, k: 'alley' });
      RESERVE.push({ u0: 2.0, u1: 18.2, v0: -24.6 + dV, v1: -s, k: 'alleyHouses', noCorner: true });
      RESERVE.push({ u0: 1.8, u1: 18.4, v0: -36.4 + dV, v1: -23.4 + dV, k: 'scuola' });
    }
    return { town, ven, s, dN, dV, SQ, PAVE, RESERVE };
  }
  const inR = (r, u, v) => u >= r.u0 && u <= r.u1 && v >= r.v0 && v <= r.v1;
  const blocked = (L, u, v) => (u >= L.SQ.u0 - 1 && u <= L.SQ.u1 + 1 && v >= L.SQ.v0 - 1 && v <= L.SQ.v1 + 1) || L.RESERVE.some(r => inR(r, u, v)) || L.PAVE.some(r => inR(r, u, v));
  const resample = (pts, step) => { const out = []; for (let i = 0; i < pts.length - 1; i++) { const [ax, az] = pts[i], [bx, bz] = pts[i + 1]; const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / step)); for (let k = 0; k < n; k++) out.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n]); } if (pts.length) out.push(pts[pts.length - 1]); return out; };

  // which way the kit faces: keep the city's roads out of the buildings and the buildings inside the walls
  function orient(L, theta, lines, inside, grid) {
    const P = []; for (const l of lines) for (const p of resample(l, 1.5)) if (Math.hypot(p[0], p[1]) < 46) P.push(p);
    const corners = []; for (const r of L.RESERVE) if (!r.noCorner) for (const [u, v] of [[r.u0, r.v0], [r.u1, r.v0], [r.u0, r.v1], [r.u1, r.v1]]) corners.push([u, v]);
    let best = theta, bs = 1e9; const N = grid ? 4 : 72;
    for (let k = 0; k < N; k++) {
      const a = grid ? k * Math.PI / 2 : theta + k / N * Math.PI * 2; const ca = Math.cos(a), sa = Math.sin(a); let sc = 0;
      for (const p of P) { const u = p[0] * ca + p[1] * sa, v = -p[0] * sa + p[1] * ca; if (L.RESERVE.some(r => inR(r, u, v))) sc += 1; else if (L.PAVE.some(r => inR(r, u, v))) sc += .3; }
      for (const [u, v] of corners) { const x = u * ca - v * sa, z = u * sa + v * ca; if (!inside(x, z, 0.8)) sc += 25; }
      let da = Math.abs(((a - theta) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI); sc += da * .4;
      if (sc < bs) { bs = sc; best = a; L.out = corners.filter(([u, v]) => !inside(u * ca - v * sa, u * sa + v * ca, 0.8)).length; L.roadHits = P.filter(p => { const u = p[0] * ca + p[1] * sa, v = -p[0] * sa + p[1] * ca; return L.RESERVE.some(r => inR(r, u, v)); }).length; }
    }
    return best;
  }
  // a street polyline with the pieces that cross the square or a kit building cut out
  function split(pts, L, uv) {
    const out = []; let cur = [];
    for (const p of resample(pts, 1.2)) { if (blocked(L, ...uv(p[0], p[1]))) { if (cur.length >= 2) out.push(cur); cur = []; } else cur.push(p); }
    if (cur.length >= 2) out.push(cur); return out;
  }

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

  // what each culture builds with
  const WALLCOL = { plaster: 0xe6dcc6, stoneWarm: 0xd6c9ae, ashlar: 0xcfc6b4, rubble: 0xc9b998, mudbrick: 0xc9a87c, mudwall: 0xc4a47a, brickGrey: 0x9a9a98, sandstoneRed: 0xc98a68, brick: 0xd2b48c };
  const TILE_ROOF = { byz: 1, rum: 1, armenian: 1, georgian: 1 };     // terracotta hip roofs
  const GREY_ROOF = { chinese: 1, song: 1 };                            // grey tile hip roofs
  const BANDS = { byz: 1, rum: 1, armenian: 1, georgian: 1, levant: 1 }; // Byzantine brick courses
  const STABLE_ANIMAL = { arab: 'camel', yemen: 'camel', persian: 'camel', central: 'camel', tarim: 'camel', tibet: 'yak', mongol: 'pony', steppe: 'pony', indian: 'ox', sea: 'ox' };

  const K = {
    stone: 0xd6c9ae, stone2: 0xc9b998, brick: 0xa4553a, terra: 0xb0563c, greyTile: 0x6a6e72, plaster: 0xe6dcc6, plaster2: 0xdccfb2,
    wood: 0x7a5236, woodD: 0x4f3524, woodL: 0x9a7048, floorW: 0x8e6a48, floorS: 0xbcae92,
    dark: 0x2a211c, iron: 0x3a3a3c, steel: 0x9aa0a6, red: 0x8c2a24, gold: 0xd8b040, green: 0x2f5a3a,
    coal: 0xff7a1e, ember: 0xffc04a, water: 0x3f7a92, hay: 0xd8b85a,
  };

  const kits = [];   // every kit built so far (cities come and go as you travel)

  function build(ctx) {
    const { city, group, theta, firstBuild, addCollider, B, objMat, bldMat, rng, L, scul } = ctx;
    const cul = city.culture; const lookC = scul || cul;
    const wallSurf = ctx.wallSurf && ctx.wallSurf !== 'felt' ? ctx.wallSurf : 'plaster';
    const wallCol = WALLCOL[wallSurf] || K.plaster;
    const banded = !!BANDS[lookC];
    const roofKind = TILE_ROOF[lookC] ? 'hip' : GREY_ROOF[lookC] ? 'hipGrey' : 'flat';
    const ca = Math.cos(theta), sa = Math.sin(theta);
    const toWorld = (u, v) => [city.x + u * ca - v * sa, city.z + u * sa + v * ca];
    const kit = new THREE.Group(); kit.rotation.y = -theta; group.add(kit);
    const crowd = new THREE.Group(); crowd.userData.detail = 160; group.add(crowd); crowd.rotation.y = -theta;   // people and animals: hidden when far
    const wb = new B.Builder(); wb.rng = rng;   // walls and roofs (building material, textured)
    const pb = new B.Builder(); pb.rng = rng;   // props and furniture
    const kitInfo = { npcs: [], buildings: [], lights: [], city };
    const OFF = { v: 0 };                        // the current section's shift along v (towns pull pieces toward the square)
    const section = (dv, fn) => { OFF.v = dv; pb.push(0, 0, dv); wb.push(0, 0, dv); fn(); wb.pop(); pb.pop(); OFF.v = 0; };

    // ---------- colliders in kit space ----------
    const segCol = (u0, v0, u1, v1, r) => { if (!firstBuild) return; const a = toWorld(u0, v0 + OFF.v), b = toWorld(u1, v1 + OFF.v); addCollider({ seg: [a[0], a[1], b[0], b[1]], r }); };
    const rectCol = (u0, v0, u1, v1) => { if (!firstBuild) return; const c = toWorld((u0 + u1) / 2, (v0 + v1) / 2 + OFF.v); addCollider({ rect: [c[0], c[1], (u1 - u0) / 2, (v1 - v0) / 2, -theta] }); };
    const circCol = (u, v, r) => { if (!firstBuild) return; const c = toWorld(u, v + OFF.v); addCollider({ x: c[0], z: c[1], r }); };

    let curFloor = K.floorW;
    // ---------- walls with openings ----------
    // side: 'N' (v = v0), 'S' (v = v1), 'W' (u = u0), 'E' (u = u1); openings [{at, w, h, door, y0}] along the side
    function wall(bd, x0, z0, x1, z1, side, h, t, ops, bands, col) {
      const alongU = side === 'N' || side === 'S';
      const a0 = alongU ? x0 : z0, a1 = alongU ? x1 : z1;
      const fixed = side === 'N' ? z0 + t / 2 : side === 'S' ? z1 - t / 2 : side === 'W' ? x0 + t / 2 : x1 - t / 2;
      const out = side === 'N' || side === 'W' ? -1 : 1;
      const piece = (s0, s1, y0, y1) => {
        if (s1 - s0 < 0.05 || y1 - y0 < 0.05) return; const m = (s0 + s1) / 2, L2 = s1 - s0;
        if (alongU) bd.box(m, y0, fixed, L2, y1 - y0, t, col); else bd.box(fixed, y0, m, t, y1 - y0, L2, col);
        for (const by of bands) if (by > y0 + .05 && by + .32 < y1) {
          for (let k = 0; k < 3; k++) { const yy = by + k * .11; if (alongU) bd.box(m, yy, fixed, L2, .07, t + .06, K.brick); else bd.box(fixed, yy, m, t + .06, .07, L2, K.brick); }
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
        else { // the floor runs through the doorway and out to a threshold step, so it starts at the door
          if (alongU) pb.box(o.at, -.06, fixed + out * .15, o.w + .1, .12, t + .3, curFloor); else pb.box(fixed + out * .15, -.06, o.at, t + .3, .12, o.w + .1, curFloor);
        }
        s = o1;
      }
      piece(s, a1, 0, h);
      let c = a0; const doors = sorted.filter(o => o.door);
      for (const o of doors) { const o0 = o.at - o.w / 2; if (o0 - c > .1) alongU ? segCol(c, fixed, o0, fixed, t / 2) : segCol(fixed, c, fixed, o0, t / 2); c = o.at + o.w / 2; }
      if (a1 - c > .1) alongU ? segCol(c, fixed, a1, fixed, t / 2) : segCol(fixed, c, fixed, a1, t / 2);
    }

    // a roof for a block: terracotta or grey hip, or a flat roof with a parapet
    function roofOn(cu, top, cv, W2, D2, kind, over, col) {
      if (kind === 'hip' || kind === 'hipGrey') { wb.hip(cu, top, cv, W2 + over, Math.min(2.6, .22 * Math.min(W2, D2) + .6), D2 + over, kind === 'hip' ? K.terra : K.greyTile, 0, .12); wb.box(cu, top - .05, cv, W2 + over + .1, .12, D2 + over + .1, K.woodD); }
      else if (kind === 'gable') { wb.gable(cu, top, cv, W2 + 1.2, 2.0, D2 + 1.2, K.terra); wb.box(cu, top - .05, cv, W2 + 1.3, .12, D2 + 1.3, K.woodD); }
      else { // flat roof: a slab, a parapet and timber beam-ends
        wb.box(cu, top - .02, cv, W2 + .3, .26, D2 + .3, col);
        for (const [x, z, w, d] of [[cu, cv - D2 / 2 - .05, W2 + .3, .2], [cu, cv + D2 / 2 + .05, W2 + .3, .2], [cu - W2 / 2 - .05, cv, .2, D2 + .3], [cu + W2 / 2 + .05, cv, .2, D2 + .3]]) wb.box(x, top + .2, z, w, .55, d, col);
        for (let k = 0; k < Math.round(W2 / 1.6); k++) for (const sv of [-1, 1]) wb.box(cu - W2 / 2 + .8 + k * 1.6, top - .35, cv + sv * (D2 / 2 + .12), .16, .16, .3, K.woodD);
      }
    }

    // a hollow building you can walk into: floor, four walls, ceiling, beams, roof
    function building(spec) {
      const { u0, v0, u1, v1, h, t = .6, ops = {}, bands = [1.6, 3.4], col = wallCol, floor = K.floorW, roof = roofKind, upper, surf = wallSurf } = spec;
      const W2 = u1 - u0, D2 = v1 - v0, cu = (u0 + u1) / 2, cv = (v0 + v1) / 2; const bd2 = banded || spec.forceBands ? bands : [];
      curFloor = floor; wb.setSurf(surf);
      pb.box(cu, -.06, cv, W2 - t * 2 + .02, .12, D2 - t * 2 + .02, floor);                     // floor (top at .06)
      wb.box(cu, -.15, cv, W2 + .5, .18, D2 + .5, K.stone2);                                     // plinth (top at .03, under the floor)
      for (const side of ['N', 'S', 'W', 'E']) {
        const isU = side === 'N' || side === 'S';
        if (isU) wall(wb, u0, v0, u1, v1, side, h, t, ops[side], bd2, col);
        else wall(wb, u0, v0 + t, u1, v1 - t, side, h, t, ops[side], bd2, col);
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
      roofOn(cu, top, cv, W2, D2, roof, 1.4, col);
      kitInfo.buildings.push({ name: spec.name, u0, v0: v0 + OFF.v, u1, v1: v1 + OFF.v });
    }

    // a closed town house (not enterable), two storeys, shuttered windows on given faces
    function townHouse(u0, v0, u1, v1, h, faces) {
      const W2 = u1 - u0, D2 = v1 - v0, cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
      wb.setSurf(wallSurf);
      wb.box(cu, -.05, cv, W2, h, D2, wallCol);
      if (banded) for (let k = 0; k < 3; k++) wb.box(cu, 3.0 + k * .11, cv, W2 + .06, .07, D2 + .06, K.brick);
      roofOn(cu, h, cv, W2, D2, roofKind, 1.0, wallCol);
      for (const f of faces) {
        const alongU = f === 'N' || f === 'S'; const L2 = alongU ? W2 : D2; const n = Math.max(1, Math.floor(L2 / 2.6));
        for (let k = 0; k < n; k++) {
          const a = (alongU ? u0 : v0) + L2 * (k + .5) / n;
          for (const [y0, hh] of [[1.2, 1.2], [3.8, 1.2]]) {
            if (f === 'N') wb.box(a, y0, v0 - .03, .8, hh, .1, K.dark); else if (f === 'S') wb.box(a, y0, v1 + .03, .8, hh, .1, K.dark);
            else if (f === 'W') wb.box(u0 - .03, y0, a, .1, hh, .8, K.dark); else wb.box(u1 + .03, y0, a, .1, hh, .8, K.dark);
          }
        }
      }
      rectCol(u0, v0, u1, v1);
    }

    const person = (pc, role, v, u, vv, face, opt = {}) => {
      const kitL = HOOKS.lifeKit; if (!kitL || !kitL.makePerson) return null;
      const V = vv + OFF.v;
      const p = kitL.makePerson(pc, role, v); p.position.set(u, opt.y || 0, V); p.rotation.y = face;
      if (opt.sit) { p.position.y = -.17; for (const l of p.userData.legs) l.rotation.x = -1.45; }
      crowd.add(p); circCol(u, vv, .35);
      const n = { obj: p, u, v: V, face, talk: !!opt.label, idle: Math.random() * 6 };
      if (opt.label && kitL.textSprite) { const s = kitL.textSprite(opt.label); s.position.set(u, opt.labelY || (opt.sit ? 2.1 : 2.55), V); crowd.add(s); n.label = s; }
      kitInfo.npcs.push(n); return p;
    };
    const animal = (kind, u, vv, f, v) => { const kitL = HOOKS.lifeKit; if (!kitL || !kitL.makeAnimal) return; const a = kitL.makeAnimal(kind, false, v); a.position.set(u, 0, vv + OFF.v); a.rotation.y = f; crowd.add(a); kitInfo.npcs.push({ obj: a, u, v: vv + OFF.v, animal: true, idle: rng() * 6 }); circCol(u, vv, .9); };
    const face = (du, dv) => Math.atan2(du, dv);
    const sign = (text, u, y, v, ry, w, h, bg, fg, size) => { const s = signMesh(text, w, h, bg, fg, { size }); s.position.set(u, y, v + OFF.v); s.rotation.y = ry; kit.add(s); return s; };
    const furn = (k, u, v, ry = 0, col = .9) => { pb.push(u, -.05, v, ry); B.FURN[k](pb, rng); pb.pop(); if (col) circCol(u, v, col); };
    const lamp = (u, y, v, c, i, d) => { kitInfo.lights.push({ u, y, v: v + OFF.v, c, i, d }); if (y > 2) { pb.cyl(u, y + .15, v, .02, .02, .6, K.iron, 4); pb.box(u, y - .25, v, .28, .4, .28, 0xffd88a); } };

    const { town, ven, s: S, dN, dV } = L;
    const E = Math.PI / 2;   // facing +u (east, toward the middle of the square)

    // ================= the market: west half of the square =================
    // The Merchant stands in the middle of one long stall, nothing between him and you but the counter.
    pb.box(-4.0, 0, -1, .9, .78, 5.4, K.woodD); pb.box(-4.0, .78, -1, 1.05, .07, 5.6, K.wood);                // the counter
    { const goods = [0xd08a2a, 0xb0402c, 0x7a9a3a, 0xc9a06a, 0x2c5fa8, 0xe0c060]; for (let k = 0; k < 9; k++) { const v = -3.4 + k * .6; const c = goods[k % goods.length]; if (k % 2) pb.cone(-3.95, .85, v, .2, .32, c, 6); else pb.box(-3.95, .85, v, .42, .16 + (k % 3) * .06, .42, c); } }
    pb.box(-6.1, 0, -1, .6, .9, 5.0, K.woodD); for (let k = 0; k < 6; k++) pb.box(-6.1, .9, -3.1 + k * .85, .5, .3, .5, [0x9a3a2a, 0xc8b890, 0x2f4f6f][k % 3]);   // the back shelf
    for (const su of [-3.35, -6.5]) for (const sv of [-3.9, 1.9]) pb.cyl(su, 0, -1 + sv + 1, .07, .08, su > -4 ? 2.4 : 2.9, K.woodD, 5);   // four corner posts only
    pb.box(-4.9, 2.5, -1, 6.4, .08, 3.6, K.red, E, -.15);                                       // one big red awning
    pb.box(-3.0, 2.48, -1, 3.4, .1, .1, K.woodD, E);
    sign('Merchant', -2.95, 2.95, -1, E, 2.8, .7, '#5a2a1a', '#f0d27a', .55);
    furn('sacks', -4.6, -4.9, 0, .8); furn('jars', -4.6, 2.9, 0, .8);
    rectCol(-6.5, -3.8, -3.5, 1.8);
    person(cul, 'rich', 1, -5.0, -1, face(1, 0), { label: 'Merchant', labelY: 3.75 });
    // the stalls behind him, in one or two staggered rows
    const stalls = [[-8.6, -6.6], [-8.6, -1], [-8.6, 4.6]].concat(town ? [] : [[-12, -9.4], [-12, -3.8], [-12, 1.8], [-12, 7.4]]);
    stalls.forEach(([u, v], i) => {
      pb.push(u, -.05, v, E); B.FURN.stall(pb, rng, cul); pb.pop(); rectCol(u - 1, v - 1.45, u + 1, v + 1.45);
      if (i !== 5) person(cul, i % 3 ? 'plain' : 'rich', i % 5, u - .6, v, face(1, 0));
    });
    for (const [k, u, v] of (town ? [['sacks', -6.8, -9.0]] : [['barrels', -10.3, -9.6], ['crates', -10.3, 8.4], ['sacks', -6.8, -9.4], ['jars', -12.2, 10.2]])) furn(k, u, v, rng() * 6, .8);
    for (const [u, v, f, k, r] of [[-6.7, -5.2, face(-1, -.3), 0, 'plain'], [-6.6, 3.3, face(-1, .4), 1, 'rich'], [-2.4, 1.8, face(-1, -.8), 4, 'rich'], [-2.3, -3.6, face(-1, .6), 0, 'plain']]
      .concat(town ? [] : [[-10.3, -1.6, face(-1, 0), 2, 'plain'], [-10.2, 4.0, face(-1, .3), 3, 'plain'], [-10.4, -6.8, face(-1, 0), 1, 'plain']])) person(cul, r, k, u, v, f);
    for (const [u, v, f, k] of [[3.5, 3, 2.2, 2], [4.4, 3.6, 4.6, 3], [1.5, -5.5, 3.6, 0], [7, -5, .5, 4]]) person(cul, 'plain', k, u, v, f);

    // ================= the blacksmith: north edge of the square =================
    section(dN, () => {
      building({ name: 'Blacksmith', u0: -7, v0: -19, u1: 2, v1: -10, h: 4.0, t: .6, bands: [1.5, 3.0], roof: roofKind === 'flat' ? 'flat' : 'gable', floor: K.floorS, col: banded ? K.stone2 : wallCol, surf: banded ? 'rubble' : wallSurf,
        ops: { S: [{ at: -2.5, w: 2.6, h: 2.9, door: true }, { at: -5.3, w: 1.1, h: 1.0, y0: 1.5 }, { at: .5, w: 1.1, h: 1.0, y0: 1.5 }], E: [{ at: -15.5, w: 1.1, h: 1.0, y0: 1.6 }] } });
      pb.box(-5.1, 0, -16.9, 2.4, 1.0, 2.4, K.stone2); pb.box(-5.1, .98, -16.9, 1.8, .1, 1.8, K.dark);
      for (let k = 0; k < 7; k++) pb.sphere(-5.6 + (k % 3) * .5, 1.08, -17.4 + (k >> 1) * .35, .17, k % 2 ? K.coal : K.ember, 5, .6);
      pb.pyramid(-5.1, 2.0, -16.9, 2.4, 1.3, K.stone2); wb.setSurf('rubble'); wb.box(-5.1, 3.1, -16.9, .9, 4.2, .9, K.stone2); wb.box(-5.1, 7.3, -16.9, 1.1, .2, 1.1, K.stone);
      pb.box(-3.5, .9, -17.7, .5, .3, .4, K.woodD); pb.box(-3.5, 1.2, -17.7, .1, .5, .1, K.woodD);
      rectCol(-6.4, -18.4, -3.8, -15.6);
      pb.cyl(-3.2, 0, -14.2, .3, .35, .6, K.woodD, 6); pb.box(-3.2, .6, -14.2, .9, .25, .35, K.iron); pb.cone(-2.6, .67, -14.2, .1, .4, K.iron, 4, 0, 0, -Math.PI / 2);
      pb.cyl(-5.6, 0, -13.5, .5, .45, .7, 0x7a5236, 8); pb.cyl(-5.6, .62, -13.5, .46, .46, .03, K.water, 8);
      pb.cyl(.4, .55, -17.6, .45, .45, .18, K.stone, 10, 0, 0, Math.PI / 2); pb.box(.4, 0, -17.6, .15, .55, .5, K.wood);
      circCol(-3.2, -14.2, .55); circCol(-5.6, -13.5, .55); circCol(.4, -17.6, .55);
      pb.box(-1.5, 1.3, -18.33, 3.6, 1.5, .1, K.wood);
      for (let k = 0; k < 6; k++) { const x = -3 + k * .6; pb.box(x, 1.5 + (k % 2) * .2, -18.25, .06, .9, .05, K.woodD); pb.box(x, 2.3 + (k % 2) * .2, -18.25, .26, .14, .07, K.iron); }
      for (const rv of [-14.2, -11.8]) {
        pb.box(-6.15, 0, rv, .5, .12, 2.0, K.wood); pb.box(-6.15, 1.0, rv, .5, .1, 2.0, K.wood); for (const e of [-.95, .95]) pb.box(-6.15, 0, rv + e, .1, 1.15, .1, K.woodD);
        for (let k = 0; k < 5; k++) { const z = rv - .8 + k * .4; if (rv < -13) { pb.box(-6.15, .12, z, .05, 1.05, .07, K.steel); pb.box(-6.15, 1.1, z, .07, .05, .28, K.gold); } else { pb.cyl(-6.15, .12, z, .025, .03, 2.3, K.woodL, 4); pb.cone(-6.15, 2.42, z, .06, .26, K.steel, 4); } }
        rectCol(-6.4, rv - 1, -5.9, rv + 1);
      }
      for (let k = 0; k < 3; k++) pb.cyl(-6.33, 2.35, -14.6 + k * 1.3, .5, .5, .06, [K.red, 0x2f4f6f, K.gold][k], 12, 0, 0, Math.PI / 2);
      pb.box(-6.2, 1.75, -11.8, .35, .06, 2.0, K.wood); for (let k = 0; k < 3; k++) pb.sphere(-6.15, 1.95, -12.5 + k * .7, .2, K.steel, 6, .9);
      pb.cyl(-4.2, 0, -11.2, .05, .06, 1.2, K.woodD, 4); pb.cyl(-4.2, 1.0, -11.2, .24, .3, .7, 0x6a6e72, 8); pb.box(-4.2, 1.65, -11.2, .7, .08, .08, K.woodD); circCol(-4.2, -11.2, .35);
      pb.box(.1, 0, -13.6, .9, 1.05, 3.4, K.woodD); pb.box(.1, 1.05, -13.6, 1.0, .06, 3.5, K.woodL);
      pb.box(.1, 1.11, -14.6, .5, .08, .25, K.steel); pb.box(.1, 1.11, -12.8, .4, .14, .4, K.iron); pb.sphere(.1, 1.25, -13.7, .16, K.steel, 6, .9);
      rectCol(-.4, -15.3, .6, -11.9);
      person(cul, 'groom', 1, 1.05, -13.6, face(-1, 0), { label: 'Blacksmith' });
      person(cul, 'plain', 3, -3.9, -14.8, face(.8, .6));
      pb.box(-.8, 3.25, -9.45, .08, .08, 1.0, K.iron, E);
      sign('Blacksmith', -.8, 2.75, -9.2, 0, 1.6, .55, '#3a2a1e', '#e8d8b0', .5);
      pb.cyl(-5.8, 0, -8.6, .25, .3, .55, K.woodD, 6); pb.box(-5.8, .55, -8.6, .8, .22, .3, K.iron); circCol(-5.8, -8.6, .5);
      furn('barrels', 1.0, -8.8, 0, .8);
      lamp(-4.0, 2.4, -15.2, 0xff8a3a, 14, 10);
    });

    // ================= the Venetian Quarter (cities only): an alley north to the Scuola di San Marco =================
    if (ven) {
      const vb = -24.2 + dV;   // where the alley ends at the Scuola's door
      townHouse(2.5, vb, 6.4, -12.5, 6.2, ['E', 'S']);
      townHouse(11.6, vb, 17.2, -12.5, 6.2, ['W', 'S']);
      if (!dV) { pb.box(7.0, 3.6, -19.5, 1.2, .12, 3.0, K.woodD); for (const z of [-20.9, -18.1]) pb.box(7.5, 3.6, z, .06, .9, .06, K.woodD); pb.box(7.5, 4.45, -19.5, .06, .06, 3.0, K.woodD); }
      for (const [v, y] of (dV ? [[-16.2, 5.0]] : [[-16.2, 5.0], [-21.6, 4.8]])) { pb.box(9, y, v, 5.2, .02, .02, 0x3a3028); for (let k = 0; k < 4; k++) pb.box(7.3 + k * 1.1, y - .55, v, .7, .55, .03, [0xe8e0cc, 0x8a2a24, 0x2f4f6f, 0xd8c69a][k]); }
      pb.box(9, 4.35, -12.7, 5.4, .22, .22, K.woodD);
      for (const x of [7.2, 10.8]) pb.box(x, 3.75, -12.7, .05, .6, .05, K.iron);
      sign('Venetian Quarter', 9, 3.15, -12.7, 0, 3.8, .78, '#7a1e1a', '#f0cc5a', .5);
      for (const x of [6.0, 12.0]) { pb.box(x, 2.6, -12.3, .06, .06, .5, K.iron); pb.box(x, 2.15, -12.1, .26, .42, .26, 0xffd88a); }
      for (const x of [5.2, 12.8]) { pb.box(x, 2.6, -12.42, 1.0, 1.8, .05, K.red); pb.box(x, 3.0, -12.38, .5, .5, .05, K.gold); pb.box(x, 3.5, -12.45, 1.2, .07, .07, K.woodD); }

      // the Scuola di San Marco: always Venetian stone, whatever the city
      section(dV, () => {
        building({ name: 'Scuola di San Marco', u0: 3, v0: -35, u1: 17, v1: -24, h: 6.6, t: .7, bands: [1.8, 3.8, 5.6], forceBands: true, roof: 'hip', surf: 'stoneWarm', col: K.stone,
          ops: { S: [{ at: 9, w: 2.6, h: 3.4, door: true }, { at: 4.8, w: 1.2, h: 2.0, y0: 3.8 }, { at: 13.2, w: 1.2, h: 2.0, y0: 3.8 }],
            N: [{ at: 6, w: 1.2, h: 1.8, y0: 4 }, { at: 12, w: 1.2, h: 1.8, y0: 4 }], E: [{ at: -29.5, w: 1.2, h: 1.8, y0: 4 }], W: [{ at: -29.5, w: 1.2, h: 1.8, y0: 4 }] } });
        sign('Scuola di San Marco', 9, 3.75, -23.55, 0, 3.0, .5, '#1f3a2a', '#f0cc5a', .5);
        for (const x of [7.1, 10.9]) { pb.cyl(x, 0, -23.4, .07, .09, 5.2, K.woodD, 5); pb.box(x + .55, 3.0, -23.4, 1.0, 1.8, .05, K.red); pb.box(x + .55, 3.6, -23.37, .5, .5, .05, K.gold); circCol(x, -23.4, .2); }
        pb.box(9.5, 0, -32.2, 4.2, .82, 1.3, K.woodD); pb.box(9.5, .82, -32.2, 4.3, .06, 1.4, K.green);
        for (let k = 0; k < 4; k++) pb.box(8.0 + k * .9, .88, -32.3, .5, .14 + (k % 2) * .06, .36, [K.red, 0x4a3a2a, K.gold, 0x2a3a5a][k]);
        pb.cyl(11.2, .88, -32.0, .08, .1, .22, K.dark, 6);
        pb.box(9.5, 0, -33.6, .8, .5, .7, K.wood); pb.box(9.5, .5, -34.0, .8, 1.0, .1, K.wood);
        rectCol(7.4, -32.9, 11.6, -31.5);
        pb.box(9.5, 2.2, -34.25, 2.4, 3.2, .06, K.red); pb.box(9.5, 3.3, -34.21, 1.1, 1.1, .05, K.gold); pb.box(9.5, 5.5, -34.2, 2.8, .12, .12, K.woodD);
        pb.box(9.5, .01, -30.3, 5.2, .02, 2.8, 0x6a2a2a); pb.box(9.5, .03, -30.3, 4.4, .02, 2.0, 0xb08a40);
        person('byz', 'rich', 2, 9.5, -33.3, face(0, 1), { label: 'Scuola di San Marco' });
        pb.box(9.5, 0, -27.6, 5, .8, 1.3, K.wood); pb.box(9.5, .8, -27.6, 5.2, .06, 1.5, K.woodL); rectCol(6.9, -28.4, 12.1, -26.8);
        for (let k = 0; k < 4; k++) pb.box(7.6 + k * 1.2, .86, -27.8 + (k % 2) * .4, .5, .12, .36, [K.red, 0x4a3a2a, 0x2a3a5a][k % 3]);
        pb.cyl(11.4, .86, -27.4, .05, .06, .5, K.gold, 6); pb.box(11.4, 1.34, -27.4, .8, .04, .04, K.gold); for (const sx of [-.38, .38]) pb.cyl(11.4 + sx, 1.12, -27.4, .14, .14, .03, K.gold, 8);
        for (let k = 0; k < 4; k++) pb.sphere(8.4 + k * .3, .9, -27.2, .1, [0x9ad0e0, 0x3a9a7a, 0xe0b050, 0xa04060][k], 6, 1.3);
        for (let k = 0; k < 2; k++) { const z = -32.6 + k * 3.0; pb.box(15.9, 0, z, 1.0, 2.3, 2.4, K.woodD); for (let q = 0; q < 6; q++) pb.cyl(15.7, .3 + (q >> 1) * .7, z - .7 + (q % 2) * 1.4, .2, .2, .9, [K.red, 0x2f4f6f, 0x6a7a3a, 0xc8b890][(q + k) % 4], 8, 0, Math.PI / 2); rectCol(15.4, z - 1.2, 16.4, z + 1.2); }
        for (const [x, z] of [[4.4, -33.8], [13.6, -33.8]]) { pb.box(x, 0, z, 1.4, .7, .8, K.woodD); pb.box(x, .7, z, 1.45, .08, .85, K.gold); rectCol(x - .7, z - .4, x + .7, z + .4); }
        for (const [x, z] of [[4.3, -30.6], [4.3, -27.0]]) { pb.push(x, 0, z, rng()); B.FURN[rng() < .5 ? 'crates' : 'barrels'](pb, rng); pb.pop(); circCol(x, z, .9); }
        for (const [u, v, f, k] of [[13.4, -26.3, face(-1, 0), 0], [12.3, -26.0, face(1, -.2), 4], [14.4, -29.6, face(-1, 0), 1], [6.2, -25.6, face(.5, -1), 2], [6.6, -29.3, face(1, .2), 3]]) person('byz', 'rich', k, u, v, f);
        person('byz', 'plain', 2, 9.5, -26.6, face(0, -1));
        lamp(7, 4.8, -29.5, 0xffd29a, 12, 12); lamp(12.5, 4.8, -29.5, 0xffd29a, 10, 12);
      });
    }

    // ================= the tavern: south edge of the square =================
    section(-dN, () => {
      building({ name: 'Tavern', u0: -6, v0: 10, u1: 4, v1: 20, h: 4.2, t: .6, bands: [1.5, 3.1], upper: roofKind === 'flat' ? null : { h: 2.8 }, floor: K.floorW, col: banded ? K.plaster2 : wallCol,
        ops: { N: [{ at: -1, w: 2.4, h: 3.0, door: true }, { at: -4.2, w: 1.1, h: 1.3, y0: 1.3 }, { at: 2.3, w: 1.1, h: 1.3, y0: 1.3 }],
          E: [{ at: 13, w: 1.1, h: 1.3, y0: 1.3 }, { at: 16, w: 1.1, h: 1.3, y0: 1.3 }], W: [{ at: 12, w: 1.1, h: 1.3, y0: 1.3 }] } });
      pb.box(1.0, 3.35, 9.65, .08, .08, 1.0, K.iron, E);
      sign('Tavern', 1.0, 2.85, 9.4, 0, 1.4, .55, '#3a2a1e', '#f0d27a', .55);
      pb.box(.3, 0, 16.9, 5.6, 1.1, 1.0, K.woodD); pb.box(.3, 1.1, 16.9, 5.8, .07, 1.15, K.woodL); rectCol(-2.6, 16.4, 3.2, 17.4);
      for (const y of [1.2, 2.0, 2.8]) { pb.box(.3, y, 19.15, 5.6, .06, .45, K.wood); for (let k = 0; k < 9; k++) { const x = -2.1 + k * .6; if (rng() < .8) (k % 3 ? pb.cyl(x, y + .06, 19.15, .11, .14, .38, [0xb8734a, 0x5a7a4a, 0x8a6a48][k % 3], 6) : pb.sphere(x, y + .28, 19.15, .2, 0xb8734a, 6, 1.2)); } }
      for (let k = 0; k < 3; k++) { const x = -4.6 + (k % 2) * .9, z = 18.4 - (k >> 1) * .95; pb.cyl(x, 0, z, .42, .4, 1.0, 0x7a5236, 8); pb.cyl(x, .25, z, .44, .44, .06, K.iron, 8); pb.cyl(x, .7, z, .44, .44, .06, K.iron, 8); } circCol(-4.2, 18.0, 1.1);
      for (let k = 0; k < 4; k++) pb.cyl(-1.5 + k * 1.3, 1.17, 16.7, .08, .07, .2, 0xb8734a, 6);
      person(cul, 'plain', 2, .3, 17.9, face(0, -1), { label: 'Innkeeper' });
      pb.box(-5.1, 0, 14.6, 1.2, 1.1, 2.6, K.stone2); pb.box(-5.3, 1.1, 14.6, .8, 2.2, 2.2, K.stone2); pb.box(-4.75, .3, 14.6, .5, .3, 1.6, K.dark);
      for (let k = 0; k < 4; k++) pb.cone(-4.6, .55, 14.0 + k * .38, .16, .55 + (k % 2) * .25, k % 2 ? K.ember : K.coal, 5);
      pb.cyl(-4.4, 1.5, 14.6, .45, .32, .6, K.iron, 8);
      rectCol(-5.7, 13.3, -4.5, 15.9);
      const tables = [[-3.0, 12.6], [1.9, 12.6], [-2.4, 15.0]];
      tables.forEach(([x, z], i) => {
        pb.cyl(x, 0, z, .12, .14, .72, K.woodD, 6); pb.cyl(x, .72, z, .7, .7, .07, K.wood, 12); circCol(x, z, .75);
        for (let k = 0; k < 3; k++) { const a = k * 2.1 + i; pb.cyl(x + Math.cos(a) * .35, .79, z + Math.sin(a) * .35, .09, .07, .14, 0xb8734a, 6); }
        pb.cyl(x + .15, .79, z - .1, .22, .16, .06, 0xe0d2aa, 8); pb.sphere(x + .15, .85, z - .1, .1, 0xc8964a, 5, .6);
        for (let k = 0; k < 3; k++) { const a = k * 2.1 + .6 + i; pb.cyl(x + Math.cos(a) * 1.05, 0, z + Math.sin(a) * 1.05, .2, .18, .45, K.wood, 6); }
      });
      [[0, 0, 0], [0, 1, 1], [1, 0, 2], [1, 2, 3], [2, 1, 4]].forEach(([ti, k, v]) => {
        const [x, z] = tables[ti]; const a = k * 2.1 + .6 + ti; const u = x + Math.cos(a) * 1.02, w = z + Math.sin(a) * 1.02;
        person(cul, 'plain', v, u, w, face(x - u, z - w), { sit: true });
      });
      person(cul, 'plain', 4, -1.6, 16.0, face(0, 1));
      pb.box(2.4, 0, 15.2, 1.9, .03, 1.7, 0x6a2a3a); pb.box(2.4, .03, 15.2, 1.5, .02, 1.3, K.gold);
      pb.cyl(2.2, 0, 15.0, .1, .12, .72, K.woodD, 6); pb.cyl(2.2, .72, 15.0, .5, .5, .07, K.woodD, 12); circCol(2.2, 15.0, .55);
      pb.cyl(2.3, .79, 14.9, .05, .05, .2, 0xf0e6d2, 6); pb.box(2.0, .79, 15.1, .35, .05, .26, 0xe8dcc0); pb.box(3.0, 0, 13.6, .7, .45, .5, K.woodD); pb.box(3.0, .18, 13.33, .72, .05, .04, K.gold);
      person(cul, 'rich', 0, 2.95, 15.4, face(-1, -.3), { sit: true, label: 'Broker' });
      lamp(-3.6, 1.6, 14.6, 0xffa050, 10, 9); lamp(.3, 3.2, 14.0, 0xffc080, 9, 10);

      // ================= the stables: outdoors, beside the tavern =================
      const fence = (u0, v0, u1, v1) => { const L2 = Math.hypot(u1 - u0, v1 - v0), n = Math.max(1, Math.round(L2 / 2.2));
        for (let k = 0; k <= n; k++) { const u = u0 + (u1 - u0) * k / n, v = v0 + (v1 - v0) * k / n; pb.box(u, 0, v, .16, 1.3, .16, K.woodD); }
        const ry = Math.atan2(-(v1 - v0), u1 - u0); for (const y of [.55, 1.05]) pb.box((u0 + u1) / 2, y, (v0 + v1) / 2, L2, .1, .08, K.wood, ry); segCol(u0, v0, u1, v1, .12); };
      fence(5, 10.6, 7.4, 10.6); fence(10.8, 10.6, 13.6, 10.6); fence(5, 10.6, 5, 15); fence(13.6, 10.6, 13.6, 15);
      wb.setSurf(banded ? 'rubble' : wallSurf); wb.box(9.3, 0, 17.4, 9.0, 3.2, .4, banded ? K.stone2 : wallCol);
      for (let k = 0; k <= 3; k++) pb.box(5 + k * 2.87, 0, 14.9, .22, 2.5, .22, K.woodD);
      wb.box(9.3, 2.45, 16.15, 9.6, .16, 3.0, 0x8a6a42, 0, .2); wb.box(9.3, 2.6, 16.15, 9.6, .08, 2.9, 0xa88c52, 0, .2);
      for (const x of [7.87, 10.73]) { pb.box(x, 0, 16.2, .12, 1.3, 2.4, K.wood); segCol(x, 15.0, x, 17.3, .1); }
      segCol(5, 17.4, 13.6, 17.4, .25); segCol(5, 15, 5, 17.4, .12); segCol(13.6, 15, 13.6, 17.4, .12);
      pb.box(12.4, 0, 12.6, .9, .7, 2.6, K.woodD); pb.box(12.4, .68, 12.6, .7, .04, 2.4, K.water); rectCol(11.95, 11.3, 12.85, 13.9);
      furn('hay', 6.3, 13.0, 0, 1.1); furn('sacks', 12.6, 15.0, .6, .7);
      pb.box(9.1, 0, 11.4, .14, 1.1, .14, K.woodD); pb.box(9.1, 1.0, 11.4, .5, .08, .08, K.woodD);
      const beast = STABLE_ANIMAL[lookC] || STABLE_ANIMAL[cul] || 'horse';
      animal(beast, 9.8, 12.9, Math.PI / 2, 0); animal('mule', 6.4, 16.1, Math.PI, 1); animal(beast === 'camel' || beast === 'yak' || beast === 'ox' ? 'horse' : beast, 12.1, 16.1, Math.PI, 2);
      person(cul, 'groom', 2, 8.2, 12.0, face(0, -1), { label: 'Stables' });
    });

    // ================= meshes =================
    const wm = new THREE.Mesh(wb.geometry(), bldMat); wm.castShadow = true; wm.receiveShadow = true; kit.add(wm);
    const pm = new THREE.Mesh(pb.geometry(), objMat); pm.castShadow = true; pm.receiveShadow = true; kit.add(pm);
    kitInfo.kit = kit; kitInfo.theta = theta; kitInfo.toWorld = toWorld; kitInfo.L = L;
    city.squareKit = kitInfo; if (!kits.includes(kitInfo)) { for (let i = kits.length - 1; i >= 0; i--) if (kits[i].city === city) kits.splice(i, 1); kits.push(kitInfo); }
    return kitInfo;
  }

  // One shared set of interior lights moves to the nearest square, so the light count never changes as cities load.
  const pool = []; let poolKit = null, poolT = 0; const _v = new THREE.Vector3();
  function frame(player, dt) {
    const G = window.__game; if (!G || !G.scene) return;
    // the nearest kit that is in the scene
    let near = null, nd = 1e9;
    for (const k of kits) { const c = k.city; if (!k.kit.parent || !k.kit.parent.parent) continue; const d = Math.hypot(player.x - c.x, player.z - c.z); if (d < nd) { nd = d; near = k; } }
    poolT -= dt;
    if (poolT < 0) {
      poolT = .5;
      if (!pool.length) for (let i = 0; i < 5; i++) { const l = new THREE.PointLight(0xffc080, 0, 10, 1.3); G.scene.add(l); pool.push(l); }
      const want = near && nd < 260 ? near : null;
      if (want !== poolKit) {
        poolKit = want;
        if (want) want.kit.updateMatrixWorld(true);
        pool.forEach((l, i) => { const s = want && want.lights[i]; if (!s) { l.intensity = 0; return; } want.kit.localToWorld(_v.set(s.u, s.y, s.v)); l.position.copy(_v); l.color.setHex(s.c); l.intensity = s.i; l.distance = s.d; });
      }
    }
    const k = near; if (!k || nd > 200) return; const c = k.city;
    const ca = Math.cos(k.theta), sa = Math.sin(k.theta); const dx0 = player.x - c.x, dz0 = player.z - c.z; const pu = dx0 * ca + dz0 * sa, pv = -dx0 * sa + dz0 * ca;
    for (const n of k.npcs) {
      n.idle += dt; if (n.animal) { const l = n.obj.userData.legs; if (l && l[0]) l[0].rotation.x = Math.sin(n.idle * .7) * .08; continue; }
      if (!n.talk) continue; const du = pu - n.u, dv = pv - n.v; const d2 = du * du + dv * dv;
      const target = d2 < 64 ? Math.atan2(du, dv) : n.face; let dy = target - n.obj.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); n.obj.rotation.y += dy * Math.min(1, dt * 4);
      if (n.label) n.label.visible = d2 > 2.5;
    }
  }

  return { has, layout, orient, split, blocked, build, frame, kits };
})();
