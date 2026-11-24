
// ============================================================
//  WORLD: projection, baked fields, roads, rivers, height function
// ============================================================
const WORLD = (() => {
  const W = {};
  const COS = Math.cos(38 * Math.PI / 180);
  const LON0 = 75, LAT0 = 38;
  W.WALK = 8; W.SPRINT = 16; W.TARGET_SECONDS = 2430; // v22.2c: 1.5x v22.2 (was 1620 = 27 min; v1 was 9 min)
  W.HS = 2.9; // vertical scale for mountains/plateaus (slightly steeper than v2)
  W.VF = W.HS / 1.3; W.SC = 2;
  W.STEP = 2; // road sample spacing (world units)

  // ---------- math helpers ----------
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (e0, e1, x) => { let t = (x - e0) / (e1 - e0); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
  W.clamp = clamp; W.lerp = lerp; W.smooth = smooth;

  // ---------- simplex noise ----------
  function makeNoise(seed) {
    const p = new Uint8Array(512), perm = new Uint8Array(256);
    let s = seed >>> 0;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    for (let i = 0; i < 256; i++) perm[i] = i;
    for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
    for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
    const G = [[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
    const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
    return function (xin, yin) {
      let n0 = 0, n1 = 0, n2 = 0;
      const s2 = (xin + yin) * F2; const i = Math.floor(xin + s2), j = Math.floor(yin + s2);
      const t = (i + j) * G2; const x0 = xin - (i - t), y0 = yin - (j - t);
      const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
      const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
      const ii = i & 255, jj = j & 255;
      let t0 = 0.5 - x0 * x0 - y0 * y0;
      if (t0 > 0) { const g = G[p[ii + p[jj]] & 7]; t0 *= t0; n0 = t0 * t0 * (g[0] * x0 + g[1] * y0); }
      let t1 = 0.5 - x1 * x1 - y1 * y1;
      if (t1 > 0) { const g = G[p[ii + i1 + p[jj + j1]] & 7]; t1 *= t1; n1 = t1 * t1 * (g[0] * x1 + g[1] * y1); }
      let t2 = 0.5 - x2 * x2 - y2 * y2;
      if (t2 > 0) { const g = G[p[ii + 1 + p[jj + 1]] & 7]; t2 *= t2; n2 = t2 * t2 * (g[0] * x2 + g[1] * y2); }
      return 70 * (n0 + n1 + n2);
    };
  }
  const N1 = makeNoise(1337), N2 = makeNoise(4242), N3 = makeNoise(777);
  W.noise = N1; W.noise2 = N2; W.noise3 = N3;

  // ---------- seeded rng ----------
  W.rng = function (seed) {
    let s = (seed * 2654435761) >>> 0 || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  };

  // ---------- projection ----------
  // deg-space: X = (lon-75)*cos38, Y = lat-38.  world: x = X*K, z = -Y*K
  const degX = lon => (lon - LON0) * COS;
  const degY = lat => lat - LAT0;
  W.K = 45;
  W.toWorld = (lon, lat) => [degX(lon) * W.K, -degY(lat) * W.K];
  W.toLL = (x, z) => [x / W.K / COS + LON0, -z / W.K + LAT0];
  W.degX = degX; W.degY = degY; W.COS = COS;

  // ---------- grids ----------
  const G = { lon0: 23, lat0: -1.0, d: 0.1, NX: 1031, NY: 536 };
  const B = { lon0: 23, lat0: -1.0, d: 0.2, NX: 516, NY: 269 };
  const gsize = G.NX * G.NY, bsize = B.NX * B.NY;
  const mtnG = new Float32Array(gsize), baseG = new Float32Array(gsize), seaG = new Float32Array(gsize), pdG = new Float32Array(gsize);
  const lakeG = new Float32Array(gsize), lakeId = new Uint8Array(gsize), lakeIdD = new Uint8Array(gsize);
  W.lakeG = lakeG; W.lakeId = lakeId; W.lakeIdD = lakeIdD;
  const bio = {
    gr: new Float32Array(bsize), gg: new Float32Array(bsize), gb: new Float32Array(bsize),
    ar: new Float32Array(bsize), ag: new Float32Array(bsize), ab: new Float32Array(bsize),
    rough: new Float32Array(bsize), dunes: new Float32Array(bsize), snow: new Float32Array(bsize), terr: new Float32Array(bsize),
    dens: new Float32Array(bsize), dom: new Uint8Array(bsize),
  };
  W.bio = bio; W.G = G; W.B = B; W.mtnG = mtnG; W.baseG = baseG; W.seaG = seaG;
  const BIOME_KEYS = Object.keys(BIOMES);
  W.BIOME_KEYS = BIOME_KEYS;

  function bil(arr, g, lon, lat) {
    let fx = (lon - g.lon0) / g.d, fy = (lat - g.lat0) / g.d;
    if (fx < 0) fx = 0; if (fy < 0) fy = 0; if (fx > g.NX - 1.001) fx = g.NX - 1.001; if (fy > g.NY - 1.001) fy = g.NY - 1.001;
    const ix = fx | 0, iy = fy | 0, tx = fx - ix, ty = fy - iy, i = iy * g.NX + ix;
    const a = arr[i], b = arr[i + 1], c = arr[i + g.NX], d = arr[i + g.NX + 1];
    return (a + (b - a) * tx) + ((c + (d - c) * tx) - (a + (b - a) * tx)) * ty;
  }
  W.bil = bil;
  function bioIndex(lon, lat) {
    const ix = clamp(Math.round((lon - B.lon0) / B.d), 0, B.NX - 1), iy = clamp(Math.round((lat - B.lat0) / B.d), 0, B.NY - 1);
    return iy * B.NX + ix;
  }
  W.bioIndex = bioIndex;

  function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay; const l2 = dx * dx + dy * dy;
    let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const ex = ax + dx * t - px, ey = ay + dy * t - py; return Math.sqrt(ex * ex + ey * ey);
  }
  function pointInPoly(x, y, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }

  function bakeTerrainGrids() {
    // plateaus
    for (let iy = 0; iy < G.NY; iy++) {
      const lat = G.lat0 + iy * G.d;
      for (let ix = 0; ix < G.NX; ix++) {
        const lon = G.lon0 + ix * G.d; let b = 3;
        for (const p of PLATEAUS) { const dx = (lon - p[0]) / p[2], dy = (lat - p[1]) / p[3]; const q = dx * dx + dy * dy; if (q < 9) b += p[4] * 0.65 * W.HS * Math.exp(-q); }
        baseG[iy * G.NX + ix] = b;
      }
    }
    // mountain ranges (distance in deg-space)
    for (const [pts, H0, W0] of RANGES) {
      const H = H0 * 0.6 * W.HS, Wd = W0 * 1.2;
      const P = pts.map(p => [degX(p[0]), degY(p[1])]);
      let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
      for (const p of pts) { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
      const pad = Wd * 2.6;
      const x0 = Math.max(0, Math.floor((minX - pad / COS - G.lon0) / G.d)), x1 = Math.min(G.NX - 1, Math.ceil((maxX + pad / COS - G.lon0) / G.d));
      const y0 = Math.max(0, Math.floor((minY - pad - G.lat0) / G.d)), y1 = Math.min(G.NY - 1, Math.ceil((maxY + pad - G.lat0) / G.d));
      for (let iy = y0; iy <= y1; iy++) {
        const Y = degY(G.lat0 + iy * G.d);
        for (let ix = x0; ix <= x1; ix++) {
          const X = degX(G.lon0 + ix * G.d); let d = 1e9;
          if (P.length === 1) d = Math.hypot(X - P[0][0], Y - P[0][1]);
          else for (let k = 0; k < P.length - 1; k++) d = Math.min(d, segDist(X, Y, P[k][0], P[k][1], P[k + 1][0], P[k + 1][1]));
          const t = d / Wd; if (t > 2.6) continue;
          const c = H * Math.exp(-t * t * 1.5);
          const i = iy * G.NX + ix; const m = mtnG[i];
          mtnG[i] = Math.max(m, c) + 0.2 * Math.min(m, c);
        }
      }
    }
    // seas: Natural Earth land raster (run-length encoded), 1272 Aral Sea carved in
    { const r = GEO.land; let k = 0; for (let i = 0; i < r.length; i += 2) { const v = r[i] ? 0 : 1; for (let n = 0; n < r[i + 1]; n++) seaG[k++] = v; } }
    // lakes raster
    { const r = GEO.lakeGrid; let k = 0; for (let i = 0; i < r.length; i += 2) { const v = r[i]; for (let n = 0; n < r[i + 1]; n++) { lakeId[k] = v; lakeG[k] = v ? 1 : 0; k++; } } }
    // dilate lake ids by one cell (so the water reaches under the shore)
    { const tmpId = lakeId.slice(); for (let iy = 1; iy < G.NY - 1; iy++) for (let ix = 1; ix < G.NX - 1; ix++) { const i = iy * G.NX + ix; if (tmpId[i]) continue; const n = tmpId[i - 1] || tmpId[i + 1] || tmpId[i - G.NX] || tmpId[i + G.NX]; if (n) lakeIdD[i] = n; } for (let i = 0; i < gsize; i++) if (lakeId[i]) lakeIdD[i] = lakeId[i]; }
    { const t2 = new Float32Array(gsize); for (let pass = 0; pass < 2; pass++) { for (let iy = 1; iy < G.NY - 1; iy++) for (let ix = 1; ix < G.NX - 1; ix++) { const i = iy * G.NX + ix; t2[i] = (lakeG[i] * 4 + lakeG[i - 1] + lakeG[i + 1] + lakeG[i - G.NX] + lakeG[i + G.NX]) / 8; } lakeG.set(t2); } }
    // blur sea
    const tmp = new Float32Array(gsize);
    for (let pass = 0; pass < 3; pass++) {
      for (let iy = 1; iy < G.NY - 1; iy++) for (let ix = 1; ix < G.NX - 1; ix++) {
        const i = iy * G.NX + ix;
        tmp[i] = (seaG[i] * 4 + seaG[i - 1] + seaG[i + 1] + seaG[i - G.NX] + seaG[i + G.NX]) / 8;
      }
      seaG.set(tmp);
    }
  }

  function bakeBiomes() {
    const keys = BIOME_KEYS; const nk = keys.length; const w = new Float32Array(nk);
    const anchors = BIOME_ANCHORS.map(a => ({ X: degX(a[0]), Y: degY(a[1]), k: keys.indexOf(a[2]), s2: 2 * a[3] * a[3] }));
    for (let iy = 0; iy < B.NY; iy++) {
      const Y = degY(B.lat0 + iy * B.d);
      for (let ix = 0; ix < B.NX; ix++) {
        const X = degX(B.lon0 + ix * B.d); w.fill(0);
        let tot = 0;
        for (const a of anchors) { const dx = X - a.X, dy = Y - a.Y; const q = (dx * dx + dy * dy) / a.s2; if (q < 12) { const v = Math.exp(-q); w[a.k] += v; tot += v; } }
        const def = keys.indexOf('steppe'); const fill = Math.max(0, 0.02 - tot); w[def] += fill; tot += fill;
        const i = iy * B.NX + ix; let best = 0, bi = def;
        let gr = 0, gg = 0, gb = 0, ar = 0, ag = 0, ab = 0, ro = 0, du = 0, sn = 0, de = 0, te = 0;
        for (let k = 0; k < nk; k++) {
          if (w[k] <= 0) continue; const f = w[k] / tot; const b = BIOMES[keys[k]];
          gr += b.g[0] * f; gg += b.g[1] * f; gb += b.g[2] * f; ar += b.a[0] * f; ag += b.a[1] * f; ab += b.a[2] * f;
          ro += b.rough * 1.2 * W.VF * 0.85 * f; te += (b.terr || 0) * f; du += b.dunes * f; sn += Math.min(b.snow * W.HS, 400) * f; de += b.density * f;
          if (w[k] > best) { best = w[k]; bi = k; }
        }
        bio.gr[i] = gr; bio.gg[i] = gg; bio.gb[i] = gb; bio.ar[i] = ar; bio.ag[i] = ag; bio.ab[i] = ab;
        bio.rough[i] = ro; bio.dunes[i] = du; bio.terr[i] = te; bio.snow[i] = sn; bio.dens[i] = de; bio.dom[i] = bi;
      }
    }
  }

  // settlement density grid (where people farmed densely)
  const settleG = new Float32Array(bsize); W.settleG = settleG;
  function bakeSettle() {
    const A = VILLAGE_DENSITY.filter(a => !a[4]).map(a => ({ X: degX(a[0]), Y: degY(a[1]), s2: 2 * a[2] * a[2], d: a[3] }));
    for (let iy = 0; iy < B.NY; iy++) { const Y = degY(B.lat0 + iy * B.d); for (let ix = 0; ix < B.NX; ix++) { const X = degX(B.lon0 + ix * B.d); let d = 0; for (const a of A) { const q = ((X - a.X) ** 2 + (Y - a.Y) ** 2) / a.s2; if (q < 9) d = Math.max(d, a.d * Math.exp(-q)); } settleG[iy * B.NX + ix] = d; } }
  }
  W.settleAt = (x, z) => { const lon = x / W.K / COS + LON0, lat = -z / W.K + LAT0; return bil(settleG, B, lon, lat); };
  // ---------- roads ----------
  W.cities = []; W.cityById = {}; W.edges = [];
  function catmull(pts, spacing) {
    // centripetal-ish Catmull-Rom through points (deg-space)
    const out = [];
    const P = [pts[0], ...pts, pts[pts.length - 1]];
    for (let i = 1; i < P.length - 2; i++) {
      const p0 = P[i - 1], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2];
      const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]); const n = Math.max(2, Math.ceil(len / spacing));
      for (let k = 0; k < n; k++) {
        const t = k / n, t2 = t * t, t3 = t2 * t;
        out.push([
          0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]);
      }
    }
    out.push(pts[pts.length - 1].slice());
    return out;
  }
  function polyLen(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }
  function resample(pts, step) {
    const out = [pts[0].slice()]; let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      let ax = pts[i - 1][0], ay = pts[i - 1][1]; const bx = pts[i][0], by = pts[i][1];
      let seg = Math.hypot(bx - ax, by - ay);
      while (acc + seg >= step) {
        const t = (step - acc) / seg; ax = ax + (bx - ax) * t; ay = ay + (by - ay) * t; out.push([ax, ay]);
        seg = Math.hypot(bx - ax, by - ay); acc = 0;
      }
      acc += seg;
    }
    const last = pts[pts.length - 1]; const pl = out[out.length - 1];
    if (Math.hypot(last[0] - pl[0], last[1] - pl[1]) > step * 0.3) out.push(last.slice()); else out[out.length - 1] = last.slice();
    return out;
  }
  W.resample = resample;

  const CITY_R = { 1: 30, 2: 45, 3: 65, 4: 90, 5: 120 };
  function buildRoadsDeg() {
    for (const c of CITIES) {
      const tier = CITY_TIER[c.id] || 1; const city = Object.assign({}, c, { tier, size: tier >= 4 ? 3 : tier >= 3 ? 2 : 1, X: degX(c.lon), Y: degY(c.lat), R: CITY_R[tier], edges: [] });
      W.cities.push(city); W.cityById[c.id] = city;
    }
    EDGES.forEach((e, idx) => {
      const A = W.cityById[e[0]], Bc = W.cityById[e[1]];
      if (!A || !Bc) { console.warn('bad edge', e); return; }
      const pts = [[A.X, A.Y], ...e[3].map(p => [degX(p[0]), degY(p[1])]), [Bc.X, Bc.Y]];
      let curve = catmull(pts, 0.02);
      curve = resample(curve, 0.02);
      const L = polyLen(curve);
      // meander
      const seed = idx * 17.3; const out = [];
      let s = 0;
      for (let i = 0; i < curve.length; i++) {
        if (i > 0) s += Math.hypot(curve[i][0] - curve[i - 1][0], curve[i][1] - curve[i - 1][1]);
        const i0 = Math.max(0, i - 1), i1 = Math.min(curve.length - 1, i + 1);
        let tx = curve[i1][0] - curve[i0][0], ty = curve[i1][1] - curve[i0][1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
        const taper = smooth(0, 0.7, s) * smooth(0, 0.7, L - s);
        const off = (N2(s * 1.4 + seed, seed) * 0.06 + N3(s * 4 + seed, 3.3) * 0.015) * taper;
        out.push([curve[i][0] - ty * off, curve[i][1] + tx * off]);
      }
      // real-world length (km) along via points
      let km = 0; const ll = [[A.lon, A.lat], ...e[3], [Bc.lon, Bc.lat]];
      for (let i = 1; i < ll.length; i++) km += haversine(ll[i - 1], ll[i]);
      km *= 1.12;
      const edge = { id: W.edges.length, a: A.id, b: Bc.id, group: e[2], deg: out, lenDeg: polyLen(out), km: Math.round(km / 10) * 10 };
      W.edges.push(edge); A.edges.push(edge.id); Bc.edges.push(edge.id);
    });
  }
  function haversine(a, b) {
    const R = 6371, r = Math.PI / 180; const dLat = (b[1] - a[1]) * r, dLon = (b[0] - a[0]) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  W.haversine = haversine;

  W.shortest = function (from, to, weight) {
    const dist = {}, prev = {}, done = {}; for (const c of W.cities) dist[c.id] = Infinity; dist[from] = 0;
    for (;;) {
      let u = null, best = Infinity; for (const c of W.cities) if (!done[c.id] && dist[c.id] < best) { best = dist[c.id]; u = c.id; }
      if (!u || u === to) break; done[u] = true;
      for (const ei of W.cityById[u].edges) {
        const e = W.edges[ei]; const v = e.a === u ? e.b : e.a; const nd = dist[u] + weight(e);
        if (nd < dist[v]) { dist[v] = nd; prev[v] = { u, e: ei }; }
      }
    }
    const path = []; let c = to; while (prev[c]) { path.unshift(prev[c].e); c = prev[c].u; }
    return { dist: dist[to], edges: path };
  };

  // Path sample arrays (world)
  let PX, PZ, PH, PE, PT; W.P = {};
  W.isSquare = c => c.culture === 'chinese' || c.culture === 'song' || c.culture === 'sea' || c.id === 'shangdu';
  function straightenEnd(rs, city, atStart) {
    const pts = atStart ? rs : rs.slice().reverse();
    const cx = city.x, cz = city.z; const k = pts.findIndex(p => Math.hypot(p[0] - cx, p[1] - cz) > city.R * 1.2);
    if (k < 1 || k > pts.length - 3) return rs;
    const a = Math.atan2(pts[k][1] - cz, pts[k][0] - cx); let ox, oz, gd;
    if (W.isSquare(city)) { if (Math.abs(Math.cos(a)) >= Math.abs(Math.sin(a))) { ox = Math.sign(Math.cos(a)); oz = 0; } else { ox = 0; oz = Math.sign(Math.sin(a)); } gd = city.R * 0.7; }
    else { ox = Math.cos(a); oz = Math.sin(a); gd = city.R - 2.5; }
    const lead = [[cx, cz], [cx + ox * gd, cz + oz * gd], [cx + ox * (gd + city.R * 0.1), cz + oz * (gd + city.R * 0.1)], pts[k]];
    const out = resample(lead, W.STEP).concat(pts.slice(k + 1));
    return atStart ? out : out.reverse();
  }
  function buildRoadsWorld() {
    const xs = [], zs = [], es = [], ts = [];
    for (const c of W.cities) { const w = W.toWorld(c.lon, c.lat); c.x = w[0]; c.z = w[1]; }
    for (const e of W.edges) {
      const wpts = e.deg.map(p => [p[0] * W.K, -p[1] * W.K]);
      let rs = resample(wpts, W.STEP);
      rs = straightenEnd(rs, W.cityById[e.a], true); rs = straightenEnd(rs, W.cityById[e.b], false);
      e.start = xs.length; e.n = rs.length;
      for (let i = 0; i < rs.length; i++) { xs.push(rs[i][0]); zs.push(rs[i][1]); es.push(e.id); ts.push(i / (rs.length - 1)); }
      e.len = (rs.length - 1) * W.STEP;
    }
    PX = new Float32Array(xs); PZ = new Float32Array(zs); PH = new Float32Array(xs.length); PE = new Int16Array(es); PT = new Float32Array(ts);
    W.P = { X: PX, Z: PZ, H: PH, E: PE, T: PT, n: xs.length };
    for (const c of W.cities) { const w = W.toWorld(c.lon, c.lat); c.x = w[0]; c.z = w[1]; }
  }

  // ---------- spatial hash ----------
  function Hash(cell) { this.cell = cell; this.map = new Map(); }
  Hash.prototype.key = function (ix, iz) { return (ix + 2000) * 5000 + (iz + 2000); };
  Hash.prototype.add = function (x, z, v) {
    const k = this.key(Math.floor(x / this.cell), Math.floor(z / this.cell));
    let a = this.map.get(k); if (!a) { a = []; this.map.set(k, a); } a.push(v);
  };
  Hash.prototype.get = function (ix, iz) { return this.map.get(this.key(ix, iz)); };
  let pathHash, riverHash;

  function buildPathHash() {
    pathHash = new Hash(48);
    for (let i = 0; i < W.P.n - 1; i++) {
      if (PE[i] !== PE[i + 1]) continue;
      pathHash.add((PX[i] + PX[i + 1]) / 2, (PZ[i] + PZ[i + 1]) / 2, i);
    }
  }
  const PQ = { d: 1e9, h: 0, i: -1, t: 0, cx: 0, cz: 0 };
  function pathQuery(x, z) {
    PQ.d = 1e9; PQ.i = -1;
    const cx = Math.floor(x / 48), cz = Math.floor(z / 48);
    let best = 1e18;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const arr = pathHash.get(cx + a, cz + b); if (!arr) continue;
      for (let k = 0; k < arr.length; k++) {
        const i = arr[k];
        const ax = PX[i], az = PZ[i], dx = PX[i + 1] - ax, dz = PZ[i + 1] - az;
        let t = ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz); t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ex = ax + dx * t - x, ez = az + dz * t - z; const d2 = ex * ex + ez * ez;
        if (d2 < best) { best = d2; PQ.i = i; PQ.t = t; PQ.cx = ax + dx * t; PQ.cz = az + dz * t; }
      }
    }
    if (PQ.i >= 0) { PQ.d = Math.sqrt(best); PQ.h = PH[PQ.i] + (PH[PQ.i + 1] - PH[PQ.i]) * PQ.t; }
    return PQ;
  }
  W.pathQuery = pathQuery;

  // coarse path distance grid (deg-space distances), chamfer transform
  function bakePathDistance() {
    const INF = 1e6; pdG.fill(INF);
    const dx = G.d * COS, dy = G.d, dd = Math.hypot(dx, dy);
    for (const e of W.edges) {
      const r = resample(e.deg, 0.03);
      for (const p of r) {
        const lon = p[0] / COS + LON0, lat = p[1] + LAT0;
        const ix = Math.round((lon - G.lon0) / G.d), iy = Math.round((lat - G.lat0) / G.d);
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
          const jx = ix + a, jy = iy + b; if (jx < 0 || jy < 0 || jx >= G.NX || jy >= G.NY) continue;
          const d = Math.hypot(degX(G.lon0 + jx * G.d) - p[0], degY(G.lat0 + jy * G.d) - p[1]);
          const i = jy * G.NX + jx; if (d < pdG[i]) pdG[i] = d;
        }
      }
    }
    const NX = G.NX, NY = G.NY;
    for (let iy = 0; iy < NY; iy++) for (let ix = 0; ix < NX; ix++) {
      const i = iy * NX + ix; let v = pdG[i];
      if (ix > 0) v = Math.min(v, pdG[i - 1] + dx);
      if (iy > 0) { v = Math.min(v, pdG[i - NX] + dy); if (ix > 0) v = Math.min(v, pdG[i - NX - 1] + dd); if (ix < NX - 1) v = Math.min(v, pdG[i - NX + 1] + dd); }
      pdG[i] = v;
    }
    for (let iy = NY - 1; iy >= 0; iy--) for (let ix = NX - 1; ix >= 0; ix--) {
      const i = iy * NX + ix; let v = pdG[i];
      if (ix < NX - 1) v = Math.min(v, pdG[i + 1] + dx);
      if (iy < NY - 1) { v = Math.min(v, pdG[i + NX] + dy); if (ix < NX - 1) v = Math.min(v, pdG[i + NX + 1] + dd); if (ix > 0) v = Math.min(v, pdG[i + NX - 1] + dd); }
      pdG[i] = v;
    }
  }
  W.pdG = pdG;

  // ---------- cities lookup ----------
  W.cityCand = null; // optional candidate list
  function nearestCity(x, z) {
    let best = null, bd = 1e18; const list = W.cityCand || W.cities;
    for (let i = 0; i < list.length; i++) { const c = list[i]; const dx = c.x - x, dz = c.z - z; const d = dx * dx + dz * dz; if (d < bd) { bd = d; best = c; } }
    return { c: best, d: Math.sqrt(bd) };
  }
  W.nearestCity = nearestCity;

  // ---------- lakes ----------
  W.lakes = [];
  function setupLakes() {
    for (const L of GEO.lakes) {
      const poly = []; for (let i = 0; i < L.poly.length; i += 2) poly.push([L.poly[i] / 100, L.poly[i + 1] / 100]);
      const samp = []; for (let i = 0; i < L.samp.length; i += 2) samp.push(W.toWorld(L.samp[i] / 100, L.samp[i + 1] / 100));
      const cx = (L.bb[0] + L.bb[2]) / 2, cy = (L.bb[1] + L.bb[3]) / 2; const w = W.toWorld(cx, cy);
      W.lakes.push({ name: L.name, poly, samp, bb: L.bb, x: w[0], z: w[1], rxw: (L.bb[2] - L.bb[0]) / 2 * COS * W.K, ryw: (L.bb[3] - L.bb[1]) / 2 * W.K, level: 0 });
    }
  }
  function lakeAt(x, z) {
    const lon = x / W.K / COS + LON0, lat = -z / W.K + LAT0;
    const m = bil(lakeG, G, lon, lat);
    if (m < 0.002) { LK.m = 0; return LK; }
    const ix = clamp(Math.round((lon - G.lon0) / G.d), 0, G.NX - 1), iy = clamp(Math.round((lat - G.lat0) / G.d), 0, G.NY - 1);
    let id = lakeIdD[iy * G.NX + ix];
    if (!id) for (let a = -2; a <= 2 && !id; a++) for (let b = -2; b <= 2 && !id; b++) { const jx = ix + a, jy = iy + b; if (jx >= 0 && jy >= 0 && jx < G.NX && jy < G.NY) id = lakeIdD[jy * G.NX + jx]; }
    LK.m = clamp(m * 1.25 + N1(x * 0.03, z * 0.03) * 0.08, 0, 1); LK.level = id ? W.lakes[id - 1].level : 0; return LK;
  }
  const LK = { m: 0, level: 0 };

  // ---------- raw terrain ----------
  const RAW = { sea: 0, lake: 0, lakeLevel: 0, pd: 0 };
  function rawHeight(x, z, noLake) {
    const lon = x / W.K / COS + LON0, lat = -z / W.K + LAT0;
    const base = bil(baseG, G, lon, lat);
    let mtn = bil(mtnG, G, lon, lat);
    const pd = bil(pdG, G, lon, lat) * W.K;
    const bi = bioIndex(lon, lat);
    let rough = bio.rough[bi], dunes = bio.dunes[bi];
    // mountain passes around roads
    const pass = 0.14 + 0.86 * smooth(24, 360, pd);
    mtn *= pass; rough *= 0.35 + 0.65 * smooth(0, 180, pd);
    const r1 = 1 - Math.abs(N1(x * 0.0035, z * 0.0035));
    const r2 = 1 - Math.abs(N2(x * 0.0115, z * 0.0115));
    const r3 = 1 - Math.abs(N3(x * 0.04, z * 0.04));
    let h = base + mtn * (0.42 + 0.58 * r1 * r1) + mtn * 0.2 * (r2 - 0.5) + mtn * 0.06 * (r3 - 0.5);
    h += rough * (N1(x * 0.0048 + 50, z * 0.0048) * 0.6 + N3(x * 0.017, z * 0.017) * 0.27 + N2(x * 0.06, z * 0.06) * 0.08 + N1(x * 0.16, z * 0.16) * 0.025);
    if (dunes > 0.01) {
      const crest = 1 - Math.abs(N3(x * 0.012 + 9, z * 0.02));
      h += dunes * (8 * crest * crest + 1.4 * N2(x * 0.055, z * 0.055) + 0.35 * Math.sin(x * 0.9 + N1(x * 0.05, z * 0.05) * 6)) * smooth(3, 22, pd);
    }
    // agricultural terraces (loess plateau, southern hills)
    const terr = bio.terr[bi];
    if (terr > 0.02) {
      const tf = terr * smooth(6, 40, pd) * (1 - smooth(25, 70, mtn)) * smooth(-0.3, 0.2, N3(x * 0.004, z * 0.004));
      if (tf > 0.01) { const st = 2.6; const q = h / st; const fl = Math.floor(q); const stepped = (fl + smooth(0.72, 1.0, q - fl)) * st; h = lerp(h, stepped, tf); }
    }
    // keep dry land above the sea plane (low tropical plains with rough noise)
    if (h < 1.5) h = 1.5 - 1.3 * (1 - Math.exp(-(1.5 - h) / 1.3));
    // sea
    let sea = bil(seaG, G, lon, lat);
    RAW.pd = pd;
    if (sea > 0.001) {
      const nc = nearestCity(x, z);
      sea *= smooth(5, 16, pd) * smooth(nc.c.R * 0.85, nc.c.R + 10, nc.d);
      sea = clamp(sea + N1(x * 0.03, z * 0.03) * 0.12 * sea * (1 - sea) * 4, 0, 1);
      h = lerp(h, Math.min(h, 1.4), smooth(0.0, 0.33, sea));
      h = lerp(h, -7, smooth(0.36, 0.72, sea));
    }
    RAW.sea = sea; RAW.lake = 0;
    if (!noLake) {
      const lk = lakeAt(x, z);
      if (lk.m > 0.001) {
        const nc = nearestCity(x, z);
        const m = lk.m * smooth(6, 18, pd) * smooth(nc.c.R, nc.c.R + 8, nc.d);
        h = lerp(h, Math.min(h, lk.level + 1.2), smooth(0, 0.35, m));
        h = lerp(h, lk.level - 5, smooth(0.4, 0.8, m));
        RAW.lake = m; RAW.lakeLevel = lk.level;
      }
    }
    return h;
  }
  W.rawHeight = rawHeight; W.RAW = RAW;

  // ---------- road heights ----------
  function computeRoadHeights() {
    const n = W.P.n; const raw = new Float32Array(n);
    for (let i = 0; i < n; i++) raw[i] = rawHeight(PX[i], PZ[i]);
    // city heights
    for (const c of W.cities) {
      let s = rawHeight(c.x, c.z), k = 1;
      for (let a = 0; a < 8; a++) { s += rawHeight(c.x + Math.cos(a) * c.R * 0.6, c.z + Math.sin(a) * c.R * 0.6); k++; }
      c.h = Math.max(1.6, s / k);
    }
    // smooth along each edge
    const SIG = 26, RADI = 75; const wts = []; for (let k = -RADI; k <= RADI; k++) wts.push(Math.exp(-(k * k) / (2 * SIG * SIG)));
    for (const e of W.edges) {
      for (let j = 0; j < e.n; j++) {
        let s = 0, ws = 0;
        for (let k = -RADI; k <= RADI; k++) { const jj = j + k; if (jj < 0 || jj >= e.n) continue; s += raw[e.start + jj] * wts[k + RADI]; ws += wts[k + RADI]; }
        PH[e.start + j] = Math.max(0.9, s / ws);
      }
      const A = W.cityById[e.a], Bc = W.cityById[e.b];
      for (let j = 0; j < e.n; j++) {
        const i = e.start + j;
        for (const c of [A, Bc]) {
          const d = Math.hypot(PX[i] - c.x, PZ[i] - c.z);
          if (d < c.R + 80) PH[i] = lerp(c.h, PH[i], smooth(c.R - 3, c.R + 80, d));
        }
      }
      // also other cities that the road passes close to
    }
  }

  // ---------- rivers ----------
  W.rivers = [];
  function buildRivers() {
    let RXa = [], RZa = [], RWa = [], RIa = [];
    W.RIVER_DEFS = GEO.rivers.map(r => { const pts = []; for (let i = 0; i < r.pts.length; i += 2) pts.push([r.pts[i] / 100, r.pts[i + 1] / 100]); return [r.name, r.w, pts]; });
    W.RIVER_DEFS.forEach((rv, ri) => {
      let pts = rv[2].map(p => W.toWorld(p[0], p[1]));
      pts = catmull(pts, 6); pts = resample(pts, 3);
      // meander
      let s = 0;
      for (let i = 0; i < pts.length; i++) {
        const i0 = Math.max(0, i - 1), i1 = Math.min(pts.length - 1, i + 1);
        let tx = pts[i1][0] - pts[i0][0], tz = pts[i1][1] - pts[i0][1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
        const off = N3(i * 0.05 + ri * 10, 7) * 6 + N1(i * 0.2, ri) * 1.5;
        pts[i] = [pts[i][0] - tz * off, pts[i][1] + tx * off];
      }
      // push away from cities
      for (let it = 0; it < 2; it++) for (const p of pts) for (const c of W.cities) {
        const dx = p[0] - c.x, dz = p[1] - c.z; const d = Math.hypot(dx, dz); const need = c.R + 11;
        if (d < need && d > 0.01) { p[0] = c.x + dx / d * need; p[1] = c.z + dz / d * need; }
      }
      pts = resample(pts, 2.5);
      // push away from roads except where crossing (find crossings by sign change of side)
      const protect = new Uint8Array(pts.length);
      for (let i = 0; i < pts.length - 1; i++) {
        const q = pathQuery(pts[i][0], pts[i][1]); if (q.d < 3.5) for (let k = -9; k <= 9; k++) if (i + k >= 0 && i + k < pts.length) protect[i + k] = 1;
      }
      for (let it = 0; it < 3; it++) for (let i = 0; i < pts.length; i++) {
        if (protect[i]) continue; const p = pts[i]; const q = pathQuery(p[0], p[1]);
        const need = rv[1] + 11;
        if (q.i >= 0 && q.d < need && q.d > 0.01) { const dx = p[0] - q.cx, dz = p[1] - q.cz; p[0] = q.cx + dx / q.d * need; p[1] = q.cz + dz / q.d * need; }
      }
      // smooth a little
      for (let it = 0; it < 2; it++) for (let i = 1; i < pts.length - 1; i++) { if (protect[i]) continue; pts[i] = [(pts[i - 1][0] + pts[i][0] * 2 + pts[i + 1][0]) / 4, (pts[i - 1][1] + pts[i][1] * 2 + pts[i + 1][1]) / 4]; }
      pts = resample(pts, 2.5);
      const river = { id: ri, name: rv[0], hw: rv[1], start: RXa.length, n: pts.length };
      for (const p of pts) { RXa.push(p[0]); RZa.push(p[1]); RWa.push(rv[1]); RIa.push(ri); }
      W.rivers.push(river);
    });
    const RX = new Float32Array(RXa), RZ = new Float32Array(RZa), RW = new Float32Array(RWa), RI = new Int16Array(RIa), RH = new Float32Array(RXa.length);
    W.R = { X: RX, Z: RZ, W: RW, I: RI, H: RH, n: RXa.length };
    // surface heights: smoothed raw, monotonic downstream
    for (const r of W.rivers) {
      const raw = []; for (let j = 0; j < r.n; j++) raw.push(rawHeight(RX[r.start + j], RZ[r.start + j]));
      let run = 1e9;
      for (let j = 0; j < r.n; j++) {
        let s = 0, k = 0; for (let a = -6; a <= 6; a++) { const jj = j + a; if (jj >= 0 && jj < r.n) { s += raw[jj]; k++; } }
        const v = Math.min(raw[j], s / k) - 1.6; run = Math.min(run, v); RH[r.start + j] = Math.max(0.05, run);
      }
    }
    riverHash = new Hash(48);
    for (let i = 0; i < W.R.n - 1; i++) { if (RI[i] !== RI[i + 1]) continue; riverHash.add((RX[i] + RX[i + 1]) / 2, (RZ[i] + RZ[i + 1]) / 2, i); }
  }
  const RQ = { d: 1e9, h: 0, hw: 0, i: -1 };
  function riverQuery(x, z) {
    RQ.d = 1e9; RQ.i = -1; const R = W.R;
    const cx = Math.floor(x / 48), cz = Math.floor(z / 48); let best = 1e18;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const arr = riverHash.get(cx + a, cz + b); if (!arr) continue;
      for (let k = 0; k < arr.length; k++) {
        const i = arr[k]; const ax = R.X[i], az = R.Z[i], dx = R.X[i + 1] - ax, dz = R.Z[i + 1] - az;
        let t = ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz); t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ex = ax + dx * t - x, ez = az + dz * t - z; const d2 = ex * ex + ez * ez;
        if (d2 < best) { best = d2; RQ.i = i; RQ.t = t; }
      }
    }
    if (RQ.i >= 0) { RQ.d = Math.sqrt(best); RQ.h = R.H[RQ.i] + (R.H[RQ.i + 1] - R.H[RQ.i]) * RQ.t; RQ.hw = R.W[RQ.i]; }
    return RQ;
  }
  W.riverQuery = riverQuery;

  // bridges where roads cross rivers
  W.bridges = [];
  function findBridges() {
    const R = W.R; const found = [];
    for (let i = 0; i < W.P.n - 1; i++) {
      if (PE[i] !== PE[i + 1]) continue;
      const cx = Math.floor((PX[i] + PX[i + 1]) / 96), cz = Math.floor((PZ[i] + PZ[i + 1]) / 96);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
        const arr = riverHash.get(cx + a, cz + b); if (!arr) continue;
        for (const j of arr) {
          const hit = segInter(PX[i], PZ[i], PX[i + 1], PZ[i + 1], R.X[j], R.Z[j], R.X[j + 1], R.Z[j + 1]);
          if (hit) found.push({ i, j, x: hit[0], z: hit[1] });
        }
      }
    }
    // dedupe (same edge & river within 30 units)
    for (const f of found) {
      if (W.bridges.some(b => PE[b.i] === PE[f.i] && R.I[b.j] === R.I[f.j] && Math.hypot(b.x - f.x, b.z - f.z) < 30)) continue;
      const nc = nearestCity(f.x, f.z); if (nc.d < nc.c.R + 4) continue;
      const hw = R.W[f.j]; const rh = R.H[f.j];
      const e = W.edges[PE[f.i]];
      const L = hw + 8, A = 26; const nL = Math.ceil(L / W.STEP), nA = Math.ceil((L + A) / W.STEP);
      const iA = Math.max(e.start, f.i - nA), iB = Math.min(e.start + e.n - 1, f.i + nA);
      const endA = PH[iA], endB = PH[iB];
      const deck = Math.max(rh + 3.2 + hw * 0.25, (endA + endB) / 2);
      let tx = PX[f.i + 1] - PX[f.i], tz = PZ[f.i + 1] - PZ[f.i]; const tl = Math.hypot(tx, tz); tx /= tl; tz /= tl;
      const br = { i: f.i, j: f.j, x: f.x, z: f.z, deck, half: L, tx, tz, river: W.rivers[R.I[f.j]].name, edge: e.id, waterH: rh, hw,
        i0: Math.max(e.start, f.i - nL - 2), i1: Math.min(e.start + e.n - 1, f.i + nL + 2) };
      const nb = NAMED_BRIDGES.find(n => n.river === br.river && ((n.edge[0] === e.a && n.edge[1] === e.b) || (n.edge[0] === e.b && n.edge[1] === e.a)));
      if (nb) { br.name = nb.name; br.blurb = nb.blurb; br.style = nb.style; }
      W.bridges.push(br);
      // smooth humped deck with eased approach ramps (the road ribbon follows this exactly)
      const hump = Math.min(1.4, 0.4 + hw * 0.12);
      for (let ii = iA; ii <= iB; ii++) {
        const sd = (ii - f.i) * W.STEP; const as = Math.abs(sd);
        let prof;
        if (as <= L) prof = deck + hump * (1 - (sd / L) * (sd / L));
        else { const t = smooth(0, 1, (as - L) / A); prof = lerp(deck, sd < 0 ? endA : endB, t); }
        PH[ii] = prof;
      }
    }
  }
  function segInter(ax, ay, bx, by, cx, cy, dx, dy) {
    const r1 = bx - ax, r2 = by - ay, s1 = dx - cx, s2 = dy - cy; const den = r1 * s2 - r2 * s1; if (Math.abs(den) < 1e-9) return null;
    const t = ((cx - ax) * s2 - (cy - ay) * s1) / den, u = ((cx - ax) * r2 - (cy - ay) * r1) / den;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return [ax + r1 * t, ay + r2 * t]; return null;
  }
  // bridge surface for walking
  W.bridgeAt = function (x, z) {
    const q = pathQuery(x, z); if (q.i < 0 || q.d > 2.9) return -1e9;
    for (const b of W.bridges) if (q.i >= b.i0 && q.i <= b.i1 && W.P.E[q.i] === W.P.E[b.i]) return q.h + 0.08;
    return -1e9;
  };

  // ---------- flat building pads (villages, landmarks, caravanserais) ----------
  W.flats = []; const flatHash = new Hash(64); W.villages = []; const vilHash = new Hash(96);
  W.addFlat = function (x, z, r, fall, ref) {
    const h = height(x, z); const f = { x, z, r, fall, h, ref };
    for (let ix = Math.floor((x - r - fall) / 64); ix <= Math.floor((x + r + fall) / 64); ix++) for (let iz = Math.floor((z - r - fall) / 64); iz <= Math.floor((z + r + fall) / 64); iz++) {
      const k = flatHash.key(ix, iz); let a = flatHash.map.get(k); if (!a) { a = []; flatHash.map.set(k, a); } a.push(f);
    }
    W.flats.push(f); return f;
  };
  function nearestVillage(x, z) {
    const cx = Math.floor(x / 96), cz = Math.floor(z / 96); let best = null, bd = 1e18;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const arr = vilHash.get(cx + a, cz + b); if (!arr) continue; for (const v of arr) { const d = (v.x - x) ** 2 + (v.z - z) ** 2; if (d < bd) { bd = d; best = v; } } }
    OUT.vil = best; OUT.vd = Math.sqrt(bd);
  }
  // ---------- final height ----------
  const OUT = { pd: 1e9, ph: 0, pi: -1, city: null, cd: 1e9, rd: 1e9, rhw: 0, rh: 0, sea: 0, lake: 0, lakeLevel: 0, raw: 0, vil: null, vd: 1e9 };
  W.OUT = OUT;
  function height(x, z) {
    let h = rawHeight(x, z);
    OUT.sea = RAW.sea; OUT.lake = RAW.lake; OUT.lakeLevel = RAW.lakeLevel; OUT.raw = h;
    { const arr = flatHash.get(Math.floor(x / 64), Math.floor(z / 64));
      if (arr) for (const f of arr) { const d = Math.hypot(x - f.x, z - f.z); if (d < f.r + f.fall) h = lerp(f.h, h, smooth(f.r, f.r + f.fall, d)); } }
    nearestVillage(x, z);
    const q = pathQuery(x, z); OUT.pd = q.d; OUT.pi = q.i;
    if (q.i >= 0 && q.d < 46) {
      OUT.ph = q.h;
      const w = Math.min(42, 10 + 0.42 * Math.abs(h - q.h));
      h = lerp(q.h, h, smooth(3.4, 3.4 + w, q.d));
    }
    const nc = nearestCity(x, z); OUT.city = nc.c; OUT.cd = nc.d;
    if (nc.d < nc.c.R + 90) {
      const c = nc.c; const w = Math.min(75, 16 + 0.5 * Math.abs(h - c.h));
      h = lerp(c.h, h, smooth(c.R + 2, c.R + 2 + w, nc.d));
    }
    const r = riverQuery(x, z); OUT.rd = r.d; OUT.rhw = r.hw; OUT.rh = r.h;
    if (r.i >= 0 && r.d < 46) {
      const target = r.d < r.hw ? r.h - 1.5 : r.h - 1.5 + (r.d - r.hw) * 0.85;
      if (target < h) h = target;
    }
    return h;
  }
  W.height = height;
  W.walkHeight = function (x, z) { const h = height(x, z); if (OUT.pd < 2.7) return Math.max(h, OUT.ph + 0.08); return h; };

  // ---------- villages & farmsteads in densely settled lands ----------
  const VD = VILLAGE_DENSITY.map(a => ({ X: degX(a[0]), Y: degY(a[1]), s2: 2 * a[2] * a[2], d: a[3], nomad: !!a[4] }));
  function settleDensity(x, z) {
    const X = x / W.K, Y = -z / W.K; let d = 0, nd = 0;
    for (const a of VD) { const q = ((X - a.X) ** 2 + (Y - a.Y) ** 2) / a.s2; if (q < 9) { const v = a.d * Math.exp(-q); if (a.nomad) nd = Math.max(nd, v); else d = Math.max(d, v); } }
    return [d, nd];
  }
  W.settleDensity = settleDensity;
  function planVillages() {
    const rng = W.rng(99173);
    const ok = (x, z, r) => {
      const q = pathQuery(x, z); if (q.i >= 0 && q.d < r + 12) return false;
      const rq = riverQuery(x, z); if (rq.i >= 0 && rq.d < rq.hw + r + 8) return false;
      for (const c of W.cities) if (Math.hypot(c.x - x, c.z - z) < c.R + r + 70) return false;
      let mn = 1e9, mx = -1e9;
      for (let a = 0; a < 7; a++) { const an = a / 7 * Math.PI * 2; const px = x + (a ? Math.cos(an) * r : 0), pz = z + (a ? Math.sin(an) * r : 0); const h = rawHeight(px, pz); if (RAW.sea > 0.05 || RAW.lake > 0.05 || h < 0.8) return false; mn = Math.min(mn, h); mx = Math.max(mx, h); }
      if (mx - mn > 5 + r * 0.35) return false;
      const cx = Math.floor(x / 96), cz = Math.floor(z / 96);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const arr = vilHash.get(cx + a, cz + b); if (arr) for (const v of arr) if (Math.hypot(v.x - x, v.z - z) < v.r + r + 26) return false; }
      return true;
    };
    for (const e of W.edges) {
      for (let j = 20; j < e.n - 20; j += 14) {
        const i = e.start + j; const x = PX[i], z = PZ[i];
        const [d, nd] = settleDensity(x, z); if (d < 0.05 && nd < 0.05) continue;
        const i1 = Math.min(e.start + e.n - 1, i + 1); let tx = PX[i1] - PX[i], tz = PZ[i1] - PZ[i]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
        const nc = nearestCity(x, z); const cul = nc.c.culture;
        const place = (off, r, type, n) => {
          const side = rng() < .5 ? -1 : 1; const vx = x - tz * off * side, vz = z + tx * off * side;
          if (!ok(vx, vz, r)) return;
          const v = { x: vx, z: vz, r, n, type, culture: type === 'nomad' ? 'mongol' : cul, seed: (rng() * 1e9) | 0, faceX: x, faceZ: z, lat: -vz / W.K + LAT0 };
          W.villages.push(v); vilHash.add(vx, vz, v); W.addFlat(vx, vz, r, 18, v);
        };
        for (let t = 0; t < 2; t++) if (rng() < d * 0.75) { const n = 4 + Math.round(d * 9 + rng() * 4); place(40 + rng() * 220, 9 + n * 1.1, 'village', n); }
        if (rng() < d * 0.8) place(15 + rng() * 26, 7, 'farm', 1);
        if (nd > 0.05 && rng() < nd * 0.35) place(40 + rng() * 120, 14, 'nomad', 3 + (rng() * 4 | 0));
      }
    }
  }

  // ---------- init ----------
  W.init = function (progress) {
    const steps = [];
    steps.push(['Charting the roads', () => {
      buildRoadsDeg();
      const sp = W.shortest('constantinople', 'khanbaliq', e => e.lenDeg);
      W.mainRoute = sp.edges;
      W.K = W.WALK * W.TARGET_SECONDS / sp.dist;
      buildRoadsWorld(); setupLakes();
    }]);
    steps.push(['Raising the mountains', () => bakeTerrainGrids()]);
    steps.push(['Painting the lands', () => { bakeBiomes(); bakeSettle(); }]);
    steps.push(['Measuring the distances', () => { bakePathDistance(); buildPathHash(); }]);
    steps.push(['Filling the lakes', () => {
      for (const L of W.lakes) {
        let mn = 1e9;
        for (const p of L.samp) mn = Math.min(mn, rawHeight(p[0], p[1], true));
        L.level = Math.max(0.6, mn - 0.8);
      }
    }]);
    steps.push(['Levelling the roads', () => computeRoadHeights()]);
    steps.push(['Tracing the rivers', () => { buildRivers(); findBridges(); }]);
    steps.push(['Settling the villages', () => planVillages()]);
    return steps;
  };
  return W;
})();

