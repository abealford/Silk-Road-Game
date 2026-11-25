
// ============================================================
//  COMBAT MODE: a practice arena, kept apart from the main game.
//  Time only moves when you move (after SUPERHOT).
// ============================================================
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const TAU = Math.PI * 2, clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t;
  const rnd = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
  const AX = 42, AZ = 30, WALL = 4.2, EYE = 1.7, NSEG = 120, GATE_H = 3.3;
  const GATES = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
  const E = (th, d, y) => [(AX + d) * Math.cos(th), y, (AZ + d) * Math.sin(th)];
  const inArena = (x, z, m) => (x * x) / ((AX - m) * (AX - m)) + (z * z) / ((AZ - m) * (AZ - m));
  // v21: in a story set the play area is a union of rectangles [x0, x1, z0, z1]; doors open as the fight moves on
  const inRects = (x, z, m) => SB.rects.some(r => x > r[0] + m && x < r[1] - m && z > r[2] + m && z < r[3] - m);
  function outK(x, z, m) { return mode === 'story' ? (inRects(x, z, m) ? 0 : 2) : inArena(x, z, m); }
  function clampIn(o, m) {
    if (mode !== 'story') { const k = inArena(o.x, o.z, m); if (k > 1) { const s = 1 / Math.sqrt(k); o.x *= s; o.z *= s; } return; }
    if (inRects(o.x, o.z, m)) return; let b = null;
    for (const r of SB.rects) { const x = clamp(o.x, r[0] + m, r[1] - m), z = clamp(o.z, r[2] + m, r[3] - m); const d = (x - o.x) ** 2 + (z - o.z) ** 2; if (!b || d < b[0]) b = [d, x, z]; }
    if (b) { o.x = b[1]; o.z = b[2]; }
  }
  const wallAt = (x, y, z) => SB.walls.some(w => x > w[0] && x < w[1] && z > w[2] && z < w[3] && y < w[4]);

  const TYPES = {
    brigand: { name: 'Brigand', hp: 1, speed: 4.3, reach: 1.9, wind: .5, recover: .55, scale: 1, tunic: 0x9a3b2a, legs: 0x4a3a2a, hat: 'turban' },
    shield: { name: 'Shield-bearer', hp: 1, shield: 2, speed: 3.6, reach: 2.0, wind: .6, recover: .6, scale: 1.05, tunic: 0x4f6a3c, legs: 0x3a3226, hat: 'helm' },
    archer: { name: 'Archer', hp: 1, speed: 3.7, range: 22, wind: 1.1, recover: 1.5, shot: 24, scale: 1, tunic: 0xb8862e, legs: 0x5a4630, hat: 'fur' },
    champion: { name: 'Champion', hp: 3, speed: 3.1, reach: 2.7, wind: .8, recover: .8, scale: 1.38, tunic: 0x3a2e2a, legs: 0x241c18, hat: 'plume' },
    tyrian: { name: 'The Tyrian', hp: 3, speed: 3.4, reach: 2.6, wind: .75, recover: .75, scale: 1.16, tunic: 0x2a2a30, legs: 0x1a1a1e, hat: 'helm' },
    guard: { name: 'Genoese guard', hp: 1, speed: 4.2, reach: 1.9, wind: .5, recover: .55, scale: 1, tunic: 0xa8201a, legs: 0xe8e0d0, hat: 'helm' },
    rider: { name: 'Rider', hp: 1, speed: 4.1, reach: 1.9, wind: .55, recover: .6, scale: 1, tunic: 0x3a3228, legs: 0x2a2622, hat: 'turban' },
  };
  const WAVES = [
    { name: 'The Brigands', foes: { brigand: 3 }, k: 1, cap: 3 },
    { name: 'Bows on the Sand', foes: { brigand: 4, archer: 2 }, k: 1.06, cap: 4 },
    { name: 'The Shield Wall', foes: { brigand: 4, shield: 2, archer: 3 }, k: 1.12, cap: 6 },
    { name: 'The Champion', foes: { brigand: 5, shield: 3, archer: 4, champion: 1 }, k: 1.18, cap: 7 },
    { name: 'The Last Stand', foes: { brigand: 6, shield: 4, archer: 5, champion: 2 }, k: 1.25, cap: 9 },
  ];
  const WEAPONS = {
    sword: { name: 'Sword', ammo: 0, blurb: 'One clean cut fells most foes. A well-timed swing knocks arrows back at the archers.' },
    bow: { name: 'Bow', ammo: 24, unit: 'arrow', blurb: 'Fast and far-reaching. Nocking the next arrow takes time, and time only passes when you move.' },
    knives: { name: 'Throwing knives', ammo: 10, unit: 'knife', blurb: 'Quick to throw, slower in the air, and they drop with distance. Walk over them to pick them up.' },
  };
  const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

  let renderer, scene, cam, sunL, built = false, lowQ = false;
  let state = 'off', wave = 0, weapon = 'sword', ts = 0, lookAmt = 0, actT = 0, lastT = 0, gameT = 0, orbit = 0, clearT = 0;
  const P = { x: 0, z: 0, yaw: 0, pitch: 0, hp: 3, inv: 0, ammo: 0, cool: 0, swing: -1, swingHit: false, bob: 0, throwT: 0 };
  const keys = {}; let wasLocked = false, hurtFlash = 0, cheerT = 0, bannerT = 0;
  const enemies = [], shots = [], debris = [], sparks = [], pillars = [];
  let queue = [], spawnT = 0, stats = { kills: 0, hurt: 0, t: 0 };
  let crowd = null, dust = null, vm = {}, flags = [];
  // v21: story encounters fought in small hand-built sets (the Riders at Dawn, the Compagna's House)
  let mode = 'practice', SP = null, SB = null, arenaG = null, arenaPillars = null, ally = null, swordItem = null, sceneLook = null, hintT = 0, lootT = 0;
  const sets = {}; const owned = { bow: true }; const store = { bow: 0 };
  let prevTone, prevExp, skyU = null;

  // ---------- small geometry builder (vertex-coloured, flat-shaded) ----------
  const colCache = {}; const C = hex => colCache[hex] || (colCache[hex] = new THREE.Color(hex));
  class Geo {
    constructor() { this.p = []; this.c = []; }
    tri(a, b, c, hex, k = 1) { const col = C(hex); this.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]); for (let i = 0; i < 3; i++) this.c.push(col.r * k, col.g * k, col.b * k); }
    quad(a, b, c, d, hex, k = 1) { this.tri(a, b, c, hex, k); this.tri(a, c, d, hex, k); }
    box(x, y, z, w, h, d, hex, ry = 0, k = 1) {
      const cs = Math.cos(ry), sn = Math.sin(ry); const v = [];
      for (const sy of [0, 1]) for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const lx = sx * w / 2, lz = sz * d / 2; v.push([x + lx * cs + lz * sn, y + sy * h, z - lx * sn + lz * cs]); }
      for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; this.quad(v[i], v[j], v[j + 4], v[i + 4], hex, k * (i % 2 ? .92 : 1)); }
      this.quad(v[4], v[5], v[6], v[7], hex, k * 1.05); this.quad(v[0], v[3], v[2], v[1], hex, k * .8);
    }
    cyl(x, y, z, r0, r1, h, hex, seg = 10, k = 1) {
      for (let i = 0; i < seg; i++) {
        const a0 = i / seg * TAU, a1 = (i + 1) / seg * TAU; const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
        this.quad([x + c0 * r0, y, z + s0 * r0], [x + c1 * r0, y, z + s1 * r0], [x + c1 * r1, y + h, z + s1 * r1], [x + c0 * r1, y + h, z + s0 * r1], hex, k * (i % 2 ? .94 : 1));
        this.tri([x, y + h, z], [x + c0 * r1, y + h, z + s0 * r1], [x + c1 * r1, y + h, z + s1 * r1], hex, k * 1.04);
      }
    }
    mesh(mat) {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
      g.computeVertexNormals(); g.computeBoundingSphere(); return new THREE.Mesh(g, mat);
    }
  }
  const hash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
  const matCache = {}; const M = hex => matCache[hex] || (matCache[hex] = new THREE.MeshLambertMaterial({ color: hex }));
  let boxG;
  function part(parent, w, h, d, hex, x, y, z) { const m = new THREE.Mesh(boxG, M(hex)); m.scale.set(w, h, d); m.position.set(x, y, z); m.castShadow = !lowQ; parent.add(m); return m; }

  // ---------- the colosseum ----------
  function isGate(th) { for (const g of GATES) { const a = E(th, 0, 0), b = E(g, 0, 0); if (Math.hypot(a[0] - b[0], a[2] - b[2]) < 2.7) return true; } return false; }
  function buildArena() {
    const stoneMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    const G = new Geo(); const STONE = 0xd9c7a0, DARK = 0x2a2018, SHADE = 0xb7a27c;
    const treads = [];
    for (let i = 0; i < NSEG; i++) {
      const t0 = i / NSEG * TAU, t1 = (i + 1) / NSEG * TAU, tm = (t0 + t1) / 2; const j = .94 + hash(i, 1) * .1;
      const gate = isGate(tm), aisle = i % 10 === 5;
      // podium wall (with the gate openings)
      if (gate) {
        G.quad(E(t0, 0, GATE_H), E(t1, 0, GATE_H), E(t1, 0, WALL), E(t0, 0, WALL), 0xc9b48a, j);
        G.quad(E(t0, 0, GATE_H), E(t1, 0, GATE_H), E(t1, 8, GATE_H), E(t0, 8, GATE_H), DARK, 1.2);
        G.quad(E(t0, 8, 0), E(t1, 8, 0), E(t1, 8, GATE_H), E(t0, 8, GATE_H), DARK, .6);
        if (!isGate(tm - TAU / NSEG)) G.quad(E(t0, 0, 0), E(t0, 8, 0), E(t0, 8, GATE_H), E(t0, 0, GATE_H), DARK, 1.6);
        if (!isGate(tm + TAU / NSEG)) G.quad(E(t1, 0, 0), E(t1, 8, 0), E(t1, 8, GATE_H), E(t1, 0, GATE_H), DARK, 1.6);
      } else {
        G.quad(E(t0, 0, 0), E(t1, 0, 0), E(t1, 0, WALL), E(t0, 0, WALL), i % 2 ? 0xd2bf96 : 0xcbb78c, j);
        G.quad(E(t0, -.12, 0), E(t1, -.12, 0), E(t1, -.12, .5), E(t0, -.12, .5), 0xa8946e, j);
        if (i % 6 === 2) { // hanging cloths in the game's red and gold
          G.quad(E(t0, -.06, 1.2), E(t1, -.06, 1.2), E(t1, -.06, 3.7), E(t0, -.06, 3.7), 0x7a1f12, 1);
          G.quad(E(t0, -.08, 1.2), E(t1, -.08, 1.2), E(t1, -.08, 1.5), E(t0, -.08, 1.5), 0xc9a44a, 1);
        }
      }
      G.quad(E(t0, 0, WALL), E(t1, 0, WALL), E(t1, 1.2, WALL), E(t0, 1.2, WALL), STONE, j * 1.05);
      // the seating: three banks of eight rows
      let y = WALL, d = 1.2;
      for (let r = 0; r < 24; r++) {
        const rise = 1.35 + ((r === 8 || r === 16) ? 2.4 : 0);
        G.quad(E(t0, d, y), E(t1, d, y), E(t1, d, y + rise), E(t0, d, y + rise), aisle ? SHADE : STONE, j * (rise > 2 ? .8 : .88)); y += rise;
        G.quad(E(t0, d, y), E(t1, d, y), E(t1, d + 2.5, y), E(t0, d + 2.5, y), aisle ? SHADE : STONE, j * (r % 2 ? 1.02 : .97));
        if (i === 0) treads.push({ d, y }); d += 2.5;
      }
      // the top gallery: columns, roof and back wall
      G.quad(E(t0, d, y), E(t1, d, y), E(t1, d + 5, y), E(t0, d + 5, y), SHADE, j);
      G.quad(E(t0, d + 5, y), E(t1, d + 5, y), E(t1, d + 5, y + 7.6), E(t0, d + 5, y + 7.6), 0x8f7c5a, j);
      G.quad(E(t0, d + .2, y + 6.5), E(t1, d + .2, y + 6.5), E(t1, d + .2, y + 7.9), E(t0, d + .2, y + 7.9), 0xd9c7a0, j);
      G.quad(E(t0, d + .2, y + 6.5), E(t1, d + .2, y + 6.5), E(t1, d + 5, y + 6.5), E(t0, d + 5, y + 6.5), 0x9a8660, j);
      G.quad(E(t0, d + .2, y + 7.9), E(t1, d + .2, y + 7.9), E(t1, d + 5.6, y + 7.9), E(t0, d + 5.6, y + 7.9), 0xa5553a, j);
      if (i % 2 === 0) { const c = E(t0, d + .9, y); G.cyl(c[0], y, c[2], .55, .45, 6.5, 0xe4d4b0, 8, j); }
      if (i % 10 === 0) { const c = E(t0, d + 2.8, y + 7.9); G.cyl(c[0], c[1], c[2], .16, .1, 9, 0x5a4630, 5); flags.push({ x: c[0], y: c[1] + 8.2, z: c[2], th: t0 }); }
    }
    // gate frames
    for (const g of GATES) {
      const da = Math.asin(3.1 / Math.hypot(...E(g, 0, 0)));
      for (const s of [-1, 1]) { const c = E(g + s * da * 1.0, -.25, 0); G.box(c[0], 0, c[2], 1.0, WALL + .5, 1.0, 0xe4d4b0, -g); G.box(c[0], WALL + .5, c[2], 1.3, .35, 1.3, 0xc9b48a, -g); }
    }
    // broken columns and blocks on the sand, for cover
    const PL = [[14, 8, 4.6], [-14, 8, 3.4], [14, -8, 3.8], [-14, -8, 4.8], [0, 15, 2.1], [0, -15, 2.4], [27, 0, 1.3], [-27, 0, 1.3]];
    for (const [x, z, h] of PL) {
      if (h < 1.5) { G.box(x, 0, z, 2.6, h, 1.5, 0xcbb78c, .4); pillars.push({ x, z, r: 1.45, h }); continue; }
      G.box(x, 0, z, 2.1, .45, 2.1, 0xcbb78c, .3); G.cyl(x, .45, z, .82, .72, h - .45, 0xe4d4b0, 10); G.cyl(x, h, z, .6, .3, .25, 0xb7a27c, 6);
      pillars.push({ x, z, r: 1.02, h: h + .2 });
    }
    const arena = G.mesh(stoneMat); arena.castShadow = !lowQ; arena.receiveShadow = true; arenaG.add(arena);

    // the sand
    const fg = new THREE.PlaneGeometry(2 * AX + 18, 2 * AZ + 18, 80, 64); fg.rotateX(-Math.PI / 2);
    const fp = fg.attributes.position, fc = new Float32Array(fp.count * 3); const sand = C(0xd8b77a), sand2 = C(0xb9945a);
    for (let i = 0; i < fp.count; i++) {
      const x = fp.getX(i), z = fp.getZ(i); const e = inArena(x, z, 0);
      const n = hash(Math.round(x * 1.3), Math.round(z * 1.3)) * .1 + Math.sin(x * .31 + z * .17) * .04 + Math.sin(z * .9) * .02; const k = clamp(.95 + n - Math.max(0, e - .7) * .5, .5, 1.1);
      const m = clamp(Math.sin(x * .12) * Math.cos(z * .15) * .5 + .5, 0, 1) * .35;
      fc[i * 3] = lerp(sand.r, sand2.r, m) * k; fc[i * 3 + 1] = lerp(sand.g, sand2.g, m) * k; fc[i * 3 + 2] = lerp(sand.b, sand2.b, m) * k;
    }
    fg.setAttribute('color', new THREE.BufferAttribute(fc, 3));
    const floor = new THREE.Mesh(fg, new THREE.MeshLambertMaterial({ vertexColors: true })); floor.receiveShadow = true; arenaG.add(floor);

    // the crowd
    const occ = lowQ ? .18 : .4; const seats = [];
    for (const tr of treads) for (let i = 0; i < NSEG; i++) {
      if (i % 10 === 5) continue; const t0 = i / NSEG * TAU, t1 = (i + 1) / NSEG * TAU; const a = E(t0, tr.d + 1.3, tr.y), b = E(t1, tr.d + 1.3, tr.y);
      const n = Math.floor(Math.hypot(b[0] - a[0], b[2] - a[2]) / .8);
      for (let s = 0; s < n; s++) if (Math.random() < occ) { const f = (s + .5) / n; seats.push([lerp(a[0], b[0], f), tr.y, lerp(a[2], b[2], f)]); }
    }
    const nC = seats.length; const cm = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const bodies = new THREE.InstancedMesh(boxG, cm, nC), heads = new THREE.InstancedMesh(boxG, cm, nC);
    const ROBES = [0xe8dcc0, 0xc9963a, 0x9a3b2a, 0x6a4a2a, 0x4f6a3c, 0x3f5672, 0xf2ead8, 0x7a2f4a, 0xb8862e, 0x8a7050], SKIN = [0xd9a67a, 0xc48a5c, 0xa8704a, 0xe8c9a0, 0xf2ead8, 0x8a5a3a];
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pv = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
    const base = new Float32Array(nC), ph = new Float32Array(nC);
    for (let i = 0; i < nC; i++) {
      const [x, y, z] = seats[i]; q.setFromAxisAngle(up, Math.atan2(-x, -z)); base[i] = y; ph[i] = Math.random() * TAU;
      m4.compose(pv.set(x, y + .32, z), q, sc.set(.46, .64, .4)); bodies.setMatrixAt(i, m4); bodies.setColorAt(i, col.set(ROBES[Math.random() * ROBES.length | 0]));
      m4.compose(pv.set(x, y + .78, z), q, sc.set(.24, .25, .24)); heads.setMatrixAt(i, m4); heads.setColorAt(i, col.set(SKIN[Math.random() * SKIN.length | 0]));
    }
    bodies.frustumCulled = heads.frustumCulled = false; arenaG.add(bodies); arenaG.add(heads); crowd = { bodies, heads, base, ph, n: nC };

    // pennants on the masts
    const fgm = new THREE.PlaneGeometry(3.2, 1.1); fgm.translate(1.6, 0, 0);
    flags = flags.map((f, i) => { const m = new THREE.Mesh(fgm, new THREE.MeshLambertMaterial({ color: i % 2 ? 0x7a1f12 : 0xc9a44a, side: THREE.DoubleSide })); m.position.set(f.x, f.y, f.z); arenaG.add(m); return { m, ph: i * 1.7 }; });

    // dust hanging in the air (it stops when time stops)
    const nD = lowQ ? 120 : 320, dp = new Float32Array(nD * 3);
    for (let i = 0; i < nD; i++) { const a = Math.random() * TAU, r = Math.sqrt(Math.random()); dp[i * 3] = Math.cos(a) * r * AX; dp[i * 3 + 1] = rnd(.2, 7); dp[i * 3 + 2] = Math.sin(a) * r * AZ; }
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
    dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xfff0c8, size: .07, transparent: true, opacity: .55, depthWrite: false })); dust.frustumCulled = false; arenaG.add(dust);
  }

  function buildScene() {
    renderer = window.__game.renderer; let qn = 'high'; try { qn = localStorage.getItem('silkroad_quality') || 'high'; } catch (e) { } lowQ = qn === 'low';
    boxG = new THREE.BoxGeometry(1, 1, 1);
    scene = new THREE.Scene(); scene.fog = new THREE.Fog(0xe9d6b4, 120, 620);
    cam = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, .05, 1400); cam.rotation.order = 'YXZ'; scene.add(cam);
    scene.add(new THREE.HemisphereLight(0xcfe0f0, 0xb98a5a, 1.5));
    sunL = new THREE.DirectionalLight(0xffe6bd, 2.6); sunL.position.set(38, 70, 26); scene.add(sunL); scene.add(sunL.target);
    if (!lowQ) { sunL.castShadow = true; const s = sunL.shadow; s.mapSize.set(2048, 2048); s.camera.left = -50; s.camera.right = 50; s.camera.top = 40; s.camera.bottom = -40; s.camera.near = 10; s.camera.far = 160; s.bias = -.0006; s.normalBias = .04; }
    const sky = new THREE.Mesh(new THREE.SphereGeometry(1200, 24, 12), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { zen: { value: new THREE.Color(0x4f86c6) }, hor: { value: new THREE.Color(0xf0dcb8) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: 'uniform vec3 zen, hor; varying vec3 vP; void main(){ float h = normalize(vP).y; gl_FragColor = vec4(mix(hor, zen, pow(clamp(h, 0., 1.), .5)), 1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}' }));
    scene.add(sky); skyU = sky.material.uniforms;
    arenaG = new THREE.Group(); scene.add(arenaG); buildArena(); arenaPillars = pillars.slice(); buildViewModels(); built = true;
  }

  // ---------- fighters ----------
  function makeFigure(type) {
    const T = TYPES[type], g = new THREE.Group(), skin = 0xc48a5c, f = { g };
    const leg = sx => { const p = new THREE.Group(); p.position.set(sx * .11, .92, 0); part(p, .17, .92, .2, T.legs, 0, -.46, 0); part(p, .18, .1, .27, 0x2a1c12, 0, -.87, .04); g.add(p); return p; };
    f.legL = leg(-1); f.legR = leg(1);
    part(g, .5, .64, .28, T.tunic, 0, 1.25, 0); part(g, .48, .22, .27, T.tunic, 0, .86, 0); part(g, .52, .08, .3, type === 'champion' ? 0xc9a44a : 0x3a2a1c, 0, .97, 0);
    const head = new THREE.Group(); head.position.set(0, 1.57, 0); g.add(head); part(head, .24, .26, .25, skin, 0, .14, 0);
    if (T.hat === 'turban') { part(head, .32, .15, .32, 0xe8dcc0, 0, .3, 0); part(head, .26, .1, .08, T.tunic, 0, .06, .13); }
    if (T.hat === 'helm') { part(head, .28, .16, .29, 0x8a8e94, 0, .31, 0); part(head, .05, .2, .04, 0x8a8e94, 0, .16, .14); }
    if (T.hat === 'fur') { part(head, .34, .14, .34, 0x5a4030, 0, .28, 0); part(head, .2, .1, .2, 0xb8862e, 0, .4, 0); }
    if (T.hat === 'plume') { part(head, .3, .2, .3, 0x4a4e56, 0, .3, 0); part(head, .05, .22, .04, 0x4a4e56, 0, .15, .15); part(head, .06, .3, .22, 0xa3321f, 0, .52, -.04); part(g, .62, .12, .34, 0xc9a44a, 0, 1.5, 0); }
    const arm = sx => { const p = new THREE.Group(); p.position.set(sx * .33, 1.5, 0); part(p, .13, .6, .14, T.tunic, 0, -.3, 0); part(p, .1, .1, .1, skin, 0, -.63, 0); g.add(p); return p; };
    f.armL = arm(-1); f.armR = arm(1);
    if (type === 'archer') {
      const b = new THREE.Group(); b.position.set(0, -.63, 0); f.armL.add(b);
      part(b, .035, .04, .7, 0x6a4a2a, 0, 0, 0); for (const s of [-1, 1]) { const t = part(b, .03, .035, .34, 0x6a4a2a, 0, .07, s * .48); t.rotation.x = s * .45; }
      part(b, .008, .008, 1.2, 0xe8dcc0, 0, .16, 0);
      part(g, .12, .5, .12, 0x5a4030, .12, 1.3, -.2).rotation.z = .3;
    } else {
      const s = type === 'champion' ? 1.35 : 1; const w = new THREE.Group(); w.position.set(0, -.63, 0); f.armR.add(w);
      part(w, .04, .04, .18, 0x3a2a1c, 0, 0, .02); part(w, .2, .04, .04, 0xc9a44a, 0, 0, .12); part(w, .055 * s, .02, .8 * s, 0xc8ccd0, 0, 0, .12 + .4 * s);
    }
    if (T.shield) {
      const s = new THREE.Group(); s.position.set(-.04, -.5, .16); f.armL.add(s); f.shield = s;
      part(s, .7, .7, .05, 0x7a5a32, 0, 0, 0); part(s, .56, .56, .06, 0x4f6a3c, 0, 0, 0); part(s, .16, .16, .1, 0xc8ccd0, 0, 0, 0); s.rotation.x = .95;
    }
    g.scale.setScalar(T.scale); return f;
  }
  function spawn(type) {
    const T = TYPES[type], W = WAVES[wave];
    // come in through one of the three gates farthest from the player
    const gs = GATES.map(g => { const p = E(g, 0, 0); return { g, d: Math.hypot(p[0] - P.x, p[2] - P.z) }; }).sort((a, b) => b.d - a.d); const g = gs[Math.random() * 3 | 0].g;
    const a = E(g, 5, 0), b = E(g, -7 - rnd(4), 0); const side = rnd(-1.6, 1.6);
    const e = { type, T, f: makeFigure(type), x: a[0] - Math.sin(g) * side, z: a[2] + Math.cos(g) * side, tx: b[0] - Math.sin(g) * side * 2, tz: b[2] + Math.cos(g) * side * 2,
      yaw: Math.atan2(-a[0], -a[2]), st: 'enter', t: 6, hp: T.hp, shield: T.shield || 0, ph: rnd(TAU), mv: 0, rad: .42 * T.scale, speed: T.speed * W.k * rnd(.92, 1.08), hit: false, flinch: 0, side: Math.random() < .5 ? -1 : 1 };
    e.f.g.position.set(e.x, 0, e.z); scene.add(e.f.g); enemies.push(e);
  }
  const turnTo = (a, b, m) => { let d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI; return a + clamp(d, -m, m); };
  function moveEnemy(e, dx, dz, sp, g) {
    if (e.fixed) return;
    e.x += dx * sp * g; e.z += dz * sp * g; e.mv = sp;
    for (const p of pillars) { const ox = e.x - p.x, oz = e.z - p.z, d = Math.hypot(ox, oz), r = p.r + e.rad; if (d < r && d > 1e-4) { e.x = p.x + ox / d * r; e.z = p.z + oz / d * r; } }
    if (e.st !== 'enter' && !e.fixed) clampIn(e, 1);
  }
  function updEnemy(e, g) {
    const T = e.T, K = curK(); if (e.st === 'escape' || e.st === 'flee') return escapeStep(e, g);
    const ta = targetOf(e); const dx = ta.x - e.x, dz = ta.z - e.z, dist = Math.hypot(dx, dz) || 1e-3, ux = dx / dist, uz = dz / dist; e.mv = 0;
    if (e.flinch > 0) e.flinch -= g;
    if (e.st === 'enter') {
      const ex = e.tx - e.x, ez = e.tz - e.z, el = Math.hypot(ex, ez); e.t -= g; e.yaw = turnTo(e.yaw, Math.atan2(ex, ez), 6 * g);
      if (el < .6 || e.t <= 0) e.st = 'hunt'; else moveEnemy(e, ex / el, ez / el, e.speed, g);
    } else {
      e.yaw = turnTo(e.yaw, Math.atan2(dx, dz), (e.st === 'strike' ? 1.2 : 5) * g);
      if (e.type === 'archer') {
        if (e.st === 'hunt') {
          if (dist < 10 && outK(e.x - ux * 2, e.z - uz * 2, 1.2) < 1) moveEnemy(e, -ux * .8 + -uz * e.side * .6, -uz * .8 + ux * e.side * .6, e.speed * .8, g);
          else if (dist > T.range) moveEnemy(e, ux, uz, e.speed, g);
          else { e.st = 'draw'; e.t = T.wind / K; }
        } else if (e.st === 'draw') {
          e.t -= g; if (dist < 5 && !e.fixed) e.st = 'hunt';
          else if (e.t <= 0) { enemyShoot(e); e.st = 'recover'; e.t = T.recover / K + rnd(.6); }
        } else if (e.st === 'recover') { e.t -= g; if (dist < 9 && outK(e.x - ux * 2, e.z - uz * 2, 1.2) < 1) moveEnemy(e, -ux, -uz, e.speed * .7, g); if (e.t <= 0) e.st = 'hunt'; }
      } else {
        if (e.st === 'hunt') { if (dist > T.reach * .82) moveEnemy(e, ux, uz, e.speed, g); else { e.st = 'wind'; e.t = e.t0 = T.wind / K; } }
        else if (e.st === 'wind') { e.t -= g; if (dist > T.reach + 1.6) e.st = 'hunt'; else if (e.t <= 0) { e.st = 'strike'; e.t = .16; e.hit = false; } }
        else if (e.st === 'strike') {
          e.t -= g; if (dist > e.rad + .5) moveEnemy(e, Math.sin(e.yaw), Math.cos(e.yaw), 5, g);
          if (!e.hit && e.t < .09) { e.hit = true; const fa = Math.abs(((Math.atan2(dx, dz) - e.yaw + Math.PI) % TAU + TAU) % TAU - Math.PI); if (dist < T.reach + .45 && fa < 1.0) { if (ta === ally) hurtAlly(); else hurtPlayer(); } }
          if (e.t <= 0) { e.st = 'recover'; e.t = T.recover / K; }
        } else if (e.st === 'recover') { e.t -= g; if (e.t <= 0) e.st = 'hunt'; }
      }
    }
    // pose
    const f = e.f; f.g.position.set(e.x, e.y || 0, e.z); f.g.rotation.y = e.yaw;
    if (e.mv > 0) e.ph += e.mv * g * 2.6; const sw = e.mv > 0 ? Math.sin(e.ph) * .65 : 0;
    f.legL.rotation.x = sw; f.legR.rotation.x = -sw;
    if (e.type === 'archer') {
      const aim = e.st === 'draw'; f.armL.rotation.x = lerp(f.armL.rotation.x, aim ? -1.55 : -.35 - sw * .3, clamp(g * 10, 0, 1));
      f.armR.rotation.x = lerp(f.armR.rotation.x, aim ? -1.3 + (1 - e.t / (e.T.wind / K)) * .5 : sw * .5, clamp(g * 10, 0, 1)); f.armR.rotation.z = aim ? -.5 : 0;
    } else {
      let ar = -.35 + sw * .5; if (e.st === 'wind') ar = lerp(-.35, -2.7, clamp(1 - e.t / e.t0, 0, 1)); else if (e.st === 'strike') ar = lerp(-.4, -2.7, clamp(e.t / .16, 0, 1)); else if (e.st === 'recover') ar = -.4;
      f.armR.rotation.x = ar; f.armL.rotation.x = e.shield ? -.95 : -sw * .5;
    }
    f.g.rotation.x = e.flinch > 0 ? -.25 * e.flinch / .4 : 0;
  }
  function enemyShoot(e) {
    const T = e.T, v = T.shot * curK(); const ox = e.x + Math.sin(e.yaw) * .6, oy = 1.42 + (e.y || 0), oz = e.z + Math.cos(e.yaw) * .6; const ta = targetOf(e);
    const dx = ta.x - ox, dz = ta.z - oz, d = Math.hypot(dx, dz), t = d / v; const dy = 1.2 + .5 * 2 * t * t - oy;
    const l = Math.hypot(dx, dy, dz); const sp = .025;
    addShot('e', 'arrow', ox, oy, oz, (dx / l + rnd(-sp, sp)) * v, (dy / l + rnd(-sp, sp) * .5) * v, (dz / l + rnd(-sp, sp)) * v, 2);
  }

  // ---------- arrows and knives ----------
  function addShot(own, kind, x, y, z, vx, vy, vz, grav) {
    const g = new THREE.Group(); const red = own === 'e';
    if (kind === 'arrow') { part(g, .035, .035, .85, 0x6a4a2a, 0, 0, 0); part(g, .06, .06, .1, 0x8a8e94, 0, 0, .45); part(g, .1, .012, .16, red ? 0xa3321f : 0xf2ead8, 0, 0, -.38); part(g, .012, .1, .16, red ? 0xa3321f : 0xf2ead8, 0, 0, -.38); }
    else { part(g, .05, .015, .3, 0xc8ccd0, 0, 0, .12); part(g, .04, .03, .16, 0x3a2a1c, 0, 0, -.1); }
    const tr = new THREE.Mesh(boxG, new THREE.MeshBasicMaterial({ color: red ? 0xff5030 : 0xfff2d0, transparent: true, opacity: red ? .5 : .3, depthWrite: false })); tr.scale.set(.03, .03, .01); g.add(tr);
    g.position.set(x, y, z); scene.add(g);
    const s = { g, tr, own, kind, x, y, z, vx, vy, vz, grav, stuck: false, age: 0, spin: 0, trail: 0 }; shots.push(s); orient(s); return s;
  }
  const _v = new THREE.Vector3();
  function orient(s) { s.g.lookAt(_v.set(s.x + s.vx, s.y + s.vy, s.z + s.vz)); }
  function stick(s, pickup) { s.stuck = true; s.age = 0; s.tr.visible = false; s.pick = pickup && s.own === 'p'; if (s.pick && s.y > 2.2) s.y = 2.2; s.g.position.set(s.x, s.y, s.z); }
  function dropShot(s, x, z) { s.x = x + rnd(-.4, .4); s.z = z + rnd(-.4, .4); s.y = .06; if (mode === 'story') clampIn(s, .6); s.vx = rnd(-1, 1); s.vy = -.15; s.vz = rnd(-1, 1); orient(s); stick(s, true); }
  function killShot(i) { scene.remove(shots[i].g); shots[i].tr.material.dispose(); shots.splice(i, 1); }
  function updShots(g) {
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i];
      if (s.stuck) {
        s.age += g;
        if (s.pick) { if (Math.hypot(s.x - P.x, s.z - P.z) < 1.35 && (mode !== 'story' || state === 'fight' || state === 'loot')) { addArrow(); killShot(i); } }
        else if (s.age > 7) killShot(i);
        continue;
      }
      const px = s.x, py = s.y, pz = s.z; s.vy -= s.grav * g; s.x += s.vx * g; s.y += s.vy * g; s.z += s.vz * g;
      s.trail = Math.min(s.trail + Math.hypot(s.vx, s.vy, s.vz) * g, s.own === 'e' ? 5 : 3.5); s.tr.scale.z = s.trail; s.tr.position.z = -s.trail / 2 - .3;
      if (s.kind === 'knife') { s.spin += g * 22; orient(s); s.g.rotateX(s.spin); s.tr.visible = false; } else orient(s);
      s.g.position.set(s.x, s.y, s.z);
      const sx = s.x - px, sz = s.z - pz, sl2 = sx * sx + sz * sz || 1e-9; let done = false;
      if (s.own === 'p') {
        for (const e of enemies) {
          const u = clamp(((e.x - px) * sx + (e.z - pz) * sz) / sl2, 0, 1), cx = px + sx * u, cz = pz + sz * u, cy = py + (s.y - py) * u;
          const ey = e.y || 0; if (Math.hypot(cx - e.x, cz - e.z) < e.rad + .08 && cy > ey && cy < ey + 1.9 * e.T.scale) {
            const head = cy - ey > 1.5 * e.T.scale; const r = hitEnemy(e, head ? 2 : 1, s.vx, s.vz, true);
            if (s.refl) killShot(i); else dropShot(s, e.x, e.z);
            if (r) burst(cx, cy, cz, r === 'block' ? 0xfff2d0 : 0xa3321f, 6); done = true; break;
          }
        }
      } else {
        // a sword swing knocks arrows back
        const dp = Math.hypot(s.x - P.x, s.z - P.z);
        if (weapon === 'sword' && P.swing >= .1 && P.swing <= .75 && dp < 2.5 && s.y < 2.6) {
          const fa = Math.atan2(-(s.x - P.x), -(s.z - P.z)); const d = Math.abs(((fa - P.yaw + Math.PI) % TAU + TAU) % TAU - Math.PI);
          if (d < 1.2) { const v = Math.hypot(s.vx, s.vy, s.vz) * 1.4, cp = Math.cos(P.pitch); s.vx = -Math.sin(P.yaw) * cp * v; s.vy = Math.sin(P.pitch) * v + 1; s.vz = -Math.cos(P.yaw) * cp * v; s.own = 'p'; s.refl = true; s.tr.material.color.set(0xfff2d0); burst(s.x, s.y, s.z, 0xfff2d0, 8); continue; }
        }
        const u = clamp(((P.x - px) * sx + (P.z - pz) * sz) / sl2, 0, 1), cx = px + sx * u, cz = pz + sz * u, cy = py + (s.y - py) * u;
        if (Math.hypot(cx - P.x, cz - P.z) < .36 && cy > 0 && cy < 1.85) { if (hurtPlayer()) { killShot(i); done = true; } }
        else if (ally && !ally.down && !s.bolt && Math.hypot(s.x - ally.x, s.z - ally.z) < .4 && s.y > 0 && s.y < 1.8) { hurtAlly(); killShot(i); done = true; }
        else if (s.bolt && ally && Math.hypot(s.x - ally.x, s.z - ally.z) < .6 && s.y < 2) { killShot(i); done = true; if (s.bolt) s.bolt(); }
      }
      if (done) continue;
      if (s.y <= .04) { s.y = .05; if (mode === 'story') { clampIn(s, .5); s.g.position.set(s.x, s.y, s.z); } stick(s, true); continue; }
      let hitP = false; for (const p of pillars) if (s.y < p.h && Math.hypot(s.x - p.x, s.z - p.z) < p.r - .15) { hitP = true; break; }
      if (hitP) { s.x = px; s.y = py; s.z = pz; if (s.own === 'p' && !s.refl) dropShot(s, px, pz); else stick(s, false); continue; }
      if (mode === 'story') { if (wallAt(s.x, s.y, s.z)) { s.x = px; s.y = py; s.z = pz; if (s.own === 'p' && !s.refl) dropShot(s, px, pz); else stick(s, false); continue; } if (Math.hypot(s.x, s.z) > 160 || s.y > 60) killShot(i); continue; }
      const k = inArena(s.x, s.z, 0);
      if (k >= 1 && s.y < WALL && !isGate(Math.atan2(s.z / AZ, s.x / AX))) { s.x = px; s.y = py; s.z = pz; if (s.own === 'p' && !s.refl) dropShot(s, px * .96, pz * .96); else stick(s, false); continue; }
      if (k > 1.9 || s.y > 60) killShot(i);
    }
  }

  // ---------- hits, deaths, sparks ----------
  function burst(x, y, z, hex, n) {
    for (let i = 0; i < n; i++) { const m = new THREE.Mesh(boxG, M(hex)); const s = rnd(.04, .09); m.scale.setScalar(s); m.position.set(x, y, z); scene.add(m); sparks.push({ m, vx: rnd(-3, 3), vy: rnd(1, 4), vz: rnd(-3, 3), t: rnd(.3, .7) }); }
  }
  function toDebris(mesh, ix, iz, pow) {
    scene.attach(mesh); debris.push({ m: mesh, vx: ix * pow * rnd(.5, 1.2) + rnd(-1.5, 1.5), vy: rnd(1.5, 5), vz: iz * pow * rnd(.5, 1.2) + rnd(-1.5, 1.5), rx: rnd(-7, 7), rz: rnd(-7, 7), t: 0, rest: false, h: Math.max(.03, Math.min(mesh.scale.x, mesh.scale.y, mesh.scale.z) / 2) });
    while (debris.length > 320) scene.remove(debris.shift().m);
  }
  function hitEnemy(e, dmg, ix, iz, proj) {
    const l = Math.hypot(ix, iz) || 1; ix /= l; iz /= l;
    if (e.shield > 0) { // the shield only covers the front
      const facing = -(Math.sin(e.yaw) * ix + Math.cos(e.yaw) * iz);
      if (facing > .35) {
        e.shield -= proj ? 1 : 2; e.flinch = .4; e.x += ix * .4; e.z += iz * .4;
        if (e.shield <= 0) { e.shield = 0; const sh = e.f.shield; const ms = []; sh.traverse(o => { if (o.isMesh) ms.push(o); }); ms.forEach(m => toDebris(m, ix, iz, 3)); e.st = 'recover'; e.t = .7; }
        return 'block';
      }
    }
    e.hp -= dmg;
    if (e.escapes && e.hp <= 1) { e.hp = 1; e.flinch = .4; startEscape(e); return 'hit'; }
    if (e.hp > 0) { e.flinch = .4; e.st = 'recover'; e.t = .5; e.x += ix * .7; e.z += iz * .7; return 'hit'; }
    const ms = []; e.f.g.updateMatrixWorld(true); e.f.g.traverse(o => { if (o.isMesh) ms.push(o); }); ms.forEach(m => toDebris(m, ix, iz, 5)); scene.remove(e.f.g);
    enemies.splice(enemies.indexOf(e), 1); stats.kills++; cheerT = 1.6; if (mode === 'story') lastFall = [e.x, e.z]; return 'kill';
  }
  let lastFall = [0, 0];
  function hurtPlayer() {
    if (P.inv > 0 || state !== 'fight') return false; P.hp--; P.inv = .9; hurtFlash = 1; stats.hurt++; hud();
    if (P.hp <= 0) { state = 'dead'; clearT = .9; } return true;
  }
  function updDebris(g) {
    for (let i = debris.length - 1; i >= 0; i--) {
      const d = debris[i]; d.t += g; if (d.t > 9) { d.m.scale.multiplyScalar(Math.max(0, 1 - g * 3)); if (d.t > 10) { scene.remove(d.m); debris.splice(i, 1); } continue; }
      if (d.rest) continue; d.vy -= 15 * g; const p = d.m.position; p.x += d.vx * g; p.y += d.vy * g; p.z += d.vz * g; d.m.rotation.x += d.rx * g; d.m.rotation.z += d.rz * g;
      if (p.y < d.h) { p.y = d.h; if (Math.abs(d.vy) < 1.2) { d.rest = true; } else { d.vy *= -.3; d.vx *= .55; d.vz *= .55; d.rx *= .5; d.rz *= .5; } }
      if (mode === 'story') { const o = { x: p.x, z: p.z }; clampIn(o, .3); if (o.x !== p.x || o.z !== p.z) { p.x = o.x; p.z = o.z; d.vx *= -.3; d.vz *= -.3; } }
      else { const k = inArena(p.x, p.z, .4); if (k > 1) { const s = 1 / Math.sqrt(k); p.x *= s; p.z *= s; d.vx *= -.3; d.vz *= -.3; } }
    }
    for (let i = sparks.length - 1; i >= 0; i--) { const s = sparks[i]; s.t -= g; s.vy -= 9 * g; s.m.position.x += s.vx * g; s.m.position.y += s.vy * g; s.m.position.z += s.vz * g; if (s.t <= 0 || s.m.position.y < 0) { scene.remove(s.m); sparks.splice(i, 1); } }
  }

  // ---------- the player's hands ----------
  function buildViewModels() {
    const skin = 0xc48a5c; const mk = () => { const g = new THREE.Group(); cam.add(g); g.visible = false; return g; };
    const nos = g => g.traverse(o => { o.castShadow = false; });
    const s = vm.sword = mk(); part(s, .035, .2, .035, 0x3a2a1c, 0, -.02, 0); part(s, .2, .03, .05, 0xc9a44a, 0, .1, 0); part(s, .05, .85, .014, 0xd4d8dc, 0, .54, 0); part(s, .05, .05, .05, 0xc9a44a, 0, -.14, 0); part(s, .09, .1, .1, skin, 0, 0, 0); nos(s);
    const b = vm.bow = mk(); part(b, .028, .5, .035, 0x6a4a2a, 0, 0, 0); for (const sg of [-1, 1]) { const t = part(b, .024, .3, .03, 0x6a4a2a, 0, sg * .37, .05); t.rotation.x = sg * .4; }
    part(b, .006, .96, .006, 0xe8dcc0, 0, 0, .13); part(b, .08, .1, .09, skin, 0, 0, 0);
    const a = vm.arrow = new THREE.Group(); b.add(a); part(a, .014, .014, .8, 0x6a4a2a, .04, .03, -.22); part(a, .03, .03, .06, 0x8a8e94, .04, .03, -.64); part(a, .05, .008, .1, 0xf2ead8, .04, .03, .14); nos(b);
    const k = vm.knives = mk(); const kn = vm.knife = new THREE.Group(); k.add(kn); part(kn, .03, .26, .01, 0xd4d8dc, 0, .2, 0); part(kn, .03, .12, .025, 0x3a2a1c, 0, .02, 0); part(k, .09, .1, .1, skin, 0, 0, 0); nos(k);
  }
  function updViewModel(dt) {
    for (const k of ['sword', 'bow', 'knives']) vm[k].visible = k === weapon && (state === 'fight' || state === 'pause' || state === 'clear' || state === 'dead' || state === 'loot');
    const bob = Math.sin(P.bob) * .012, bob2 = Math.abs(Math.cos(P.bob)) * .012;
    const hasAmmo = WEAPONS[weapon].ammo === 0 || P.ammo > 0;
    if (weapon === 'sword') {
      const g = vm.sword; let s = P.swing; if (s < 0) { g.position.set(.34 + bob, -.36 + bob2, -.55); g.rotation.set(-.35, 0, -.3); }
      else { const e = s < .6 ? s / .6 : 1, back = s < .6 ? 0 : (s - .6) / .4; const k = e * e * (3 - 2 * e) * (1 - back);
        g.position.set(lerp(.34, -.2, k), lerp(-.36, -.42, k) + Math.sin(k * Math.PI) * .12, lerp(-.55, -.62, k)); g.rotation.set(lerp(-.35, -1.25, k), 0, lerp(-.3, 1.5, k)); }
    } else if (weapon === 'bow') {
      const g = vm.bow; const j = P.swing >= 0 ? Math.sin(P.swing * Math.PI) : 0;
      g.position.set(hasAmmo ? -.15 + bob : .25, -.2 + bob2 - j * .03, -.6 - (hasAmmo ? 0 : j * .3)); g.rotation.set(0, 0, hasAmmo ? .12 : .5); vm.arrow.visible = P.cool <= 0 && P.ammo > 0;
    } else {
      const g = vm.knives; const j = P.swing >= 0 ? Math.sin(P.swing * Math.PI) : 0;
      g.position.set(.3 + bob, -.3 + bob2 + j * .1, -.5 - j * .25); g.rotation.set(-.2 - j * 1.1, 0, -.15); vm.knife.visible = P.ammo > 0 && P.cool <= 0;
    }
  }
  function attack() {
    if (state !== 'fight' || P.swing >= 0) return; const W = WEAPONS[weapon];
    if (W.ammo && P.ammo > 0) {
      if (P.cool > 0) return; P.ammo--; P.swing = 0; P.melee = false; actT = .13;
      const cp = Math.cos(P.pitch), fx = -Math.sin(P.yaw) * cp, fy = Math.sin(P.pitch), fz = -Math.cos(P.yaw) * cp, rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
      const ox = P.x + fx * .5 + rx * .14, oy = EYE - .1 + fy * .5, oz = P.z + fz * .5 + rz * .14; const tx = P.x + fx * 30, ty = EYE + fy * 30, tz = P.z + fz * 30;
      const dx = tx - ox, dy = ty - oy, dz = tz - oz, l = Math.hypot(dx, dy, dz);
      if (weapon === 'bow') { addShot('p', 'arrow', ox, oy, oz, dx / l * 70, dy / l * 70, dz / l * 70, 5); P.cool = .8; }
      else { addShot('p', 'knife', ox, oy, oz, dx / l * 32, dy / l * 32 + 1.2, dz / l * 32, 9); P.cool = .32; }
      hud(); return;
    }
    P.swing = 0; P.swingHit = false; P.melee = true; actT = .3; // sword, or a shove when out of arrows or knives
  }
  function meleeHit() {
    const reach = weapon === 'sword' ? 2.9 : 1.9;
    for (const e of enemies.slice()) {
      const dx = e.x - P.x, dz = e.z - P.z, d = Math.hypot(dx, dz); if (d > reach + e.rad || (e.y || 0) > 1) continue;
      const fa = Math.atan2(-dx, -dz); const df = Math.abs(((fa - P.yaw + Math.PI) % TAU + TAU) % TAU - Math.PI);
      if (df < 1.0 || d < 1) { const r = hitEnemy(e, 1, dx, dz, weapon !== 'sword'); burst(e.x - dx / d * .3, 1.2, e.z - dz / d * .3, r === 'block' ? 0xfff2d0 : 0xa3321f, 7); }
    }
  }

  // ---------- frame ----------
  function updPlayer(dt) {
    let mx = 0, mz = 0; if (keys.KeyW || keys.ArrowUp) mz -= 1; if (keys.KeyS || keys.ArrowDown) mz += 1; if (keys.KeyA || keys.ArrowLeft) mx -= 1; if (keys.KeyD || keys.ArrowRight) mx += 1;
    const moving = mx || mz;
    if (moving) {
      const l = Math.hypot(mx, mz), c = Math.cos(P.yaw), s = Math.sin(P.yaw), sp = 6.2 * dt; P.x += (mx / l * c + mz / l * s) * sp; P.z += (-mx / l * s + mz / l * c) * sp; P.bob += dt * 10;
      for (const p of pillars) { const ox = P.x - p.x, oz = P.z - p.z, d = Math.hypot(ox, oz), r = p.r + .4; if (d < r && d > 1e-4) { P.x = p.x + ox / d * r; P.z = p.z + oz / d * r; } }
      for (const e of enemies) { const ox = P.x - e.x, oz = P.z - e.z, d = Math.hypot(ox, oz), r = e.rad + .38; if (d < r && d > 1e-4) { P.x = e.x + ox / d * r; P.z = e.z + oz / d * r; } }
      if (ally && !ally.down) { const ox = P.x - ally.x, oz = P.z - ally.z, d = Math.hypot(ox, oz); if (d < .8 && d > 1e-4) { P.x = ally.x + ox / d * .8; P.z = ally.z + oz / d * .8; } }
      clampIn(P, .7);
    }
    // time moves when you move, look around or act
    const look = clamp(lookAmt / Math.max(dt, .001) * .1, 0, .3); lookAmt = 0; if (actT > 0) actT -= dt;
    const target = Math.max(.03, moving ? 1 : 0, look, actT > 0 ? 1 : 0); ts += (target - ts) * (1 - Math.exp(-dt * (target > ts ? 16 : 9)));
    if (P.swing >= 0) { P.swing += dt / (P.melee ? (weapon === 'sword' ? .3 : .3) : .18); if (P.melee && !P.swingHit && P.swing >= .35) { P.swingHit = true; meleeHit(); } if (P.swing >= 1) P.swing = -1; }
  }
  function separate() {
    for (let i = 0; i < enemies.length; i++) for (let j = i + 1; j < enemies.length; j++) {
      const a = enemies[i], b = enemies[j]; if (a.st === 'enter' && b.st === 'enter') continue; const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), r = a.rad + b.rad + .15;
      if (d < r && d > 1e-4) { const p = (r - d) / 2; a.x -= dx / d * p; a.z -= dz / d * p; b.x += dx / d * p; b.z += dz / d * p; }
    }
  }
  function updWorld(g, dt) {
    gameT += g;
    if (crowd && (g > .0008 || cheerT > 0)) {
      const amp = .04 + (cheerT > 0 ? .22 * Math.min(1, cheerT) : 0), ab = crowd.bodies.instanceMatrix.array, ah = crowd.heads.instanceMatrix.array, t = gameT * 5;
      for (let i = 0; i < crowd.n; i++) { const o = Math.max(0, Math.sin(t + crowd.ph[i])) * amp; ab[i * 16 + 13] = crowd.base[i] + .32 + o; ah[i * 16 + 13] = crowd.base[i] + .78 + o; }
      crowd.bodies.instanceMatrix.needsUpdate = crowd.heads.instanceMatrix.needsUpdate = true; if (cheerT > 0) cheerT -= g;
    }
    for (const f of flags) { f.m.rotation.y = .6 + Math.sin(gameT * 1.6 + f.ph) * .35; }
    if (dust) { const a = dust.geometry.attributes.position; for (let i = 0; i < a.count; i++) { let x = a.getX(i) + g * (.5 + (i % 5) * .08), y = a.getY(i) + Math.sin(gameT * .6 + i) * g * .12; if (x > AX) x = -AX; a.setXYZ(i, x, y, a.getZ(i)); } a.needsUpdate = true; }
  }
  function frame(now) {
    if (!built) return; const dt = Math.min(.05, (now - lastT) / 1000 || .016); lastT = now;
    tick(dt); if (window.ATMOS) { ATMOS.soft[2] = 100; ATMOS.soft[3] = 150; ATMOS.cloud[3] = 0; } /* v22.4: this arena's shadow box, no cloud shadows */ renderer.setRenderTarget(null); renderer.render(scene, cam);
  }
  function tick(dt) {
    let g = 0;
    if (state === 'fight') {
      stats.t += dt; updPlayer(dt); g = dt * ts;
      if (P.inv > 0) P.inv -= g; if (P.cool > 0) { P.cool -= g; if (P.cool <= 0) hud(); }
      // let the next foes in
      if (mode === 'story') storyTick(dt, g);
      else if (queue.length) { spawnT -= g; if (enemies.length < WAVES[wave].cap && (spawnT <= 0 || enemies.length < 2)) { spawn(queue.shift()); spawnT = 1.7; hud(); } }
      for (const e of enemies.slice()) updEnemy(e, g); separate(); updAlly(g); updShots(g); const left = enemies.length + queue.length;
      if (left !== frame._left) { frame._left = left; hud(); }
      if (!left && state === 'fight' && !(mode === 'story' && SP.holdClear)) { state = 'cleared'; clearT = 1.1; }
    } else if (state === 'cleared' || state === 'dead') {
      g = dt * .25; updShots(g); for (const e of enemies.slice()) if (state === 'dead') updEnemy(e, g * .3); if (ally) updAlly(g);
      clearT -= dt; if (clearT <= 0) { if (mode === 'story') { if (state === 'dead') showStoryDead(); else stageCleared(); } else if (state === 'dead') showDead(); else if (wave >= WAVES.length - 1) { state = 'won'; showWon(); } else { state = 'clear'; showClear(); } }
    } else if (state === 'loot') {
      updPlayer(dt); g = dt; ts = 1; updShots(g); if (ally) updAlly(g); lootT += dt;
      if (lootT > .6 && lootT - dt <= .6) prompt(SP.lootText || '<b>E</b> &nbsp;Search the riders');
    } else if (state === 'scene') {
      g = dt; ts = 1; for (const e of enemies.slice()) updEnemy(e, g); updAlly(g); updShots(g);
      if (sceneLook) { const dx = sceneLook.x - P.x, dz = sceneLook.z - P.z; const wy = Math.atan2(-dx, -dz), wp = Math.atan2(sceneLook.y - EYE, Math.hypot(dx, dz)); let d = wy - P.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); P.yaw += d * Math.min(1, dt * 3); P.pitch += (wp - P.pitch) * Math.min(1, dt * 3); }
    }
    updDebris(g || (state === 'pick' ? dt : 0)); if (mode !== 'story') updWorld(state === 'pick' || state === 'won' ? dt * .6 : g, dt);
    if (hintT > 0) { hintT -= dt; if (hintT <= 0) hintEl.classList.remove('show'); }
    $('cb-hud').classList.toggle('scene', state === 'scene');
    // camera
    if (state === 'pick' || state === 'won') { orbit += dt * .12; cam.position.set(Math.cos(orbit) * 30, 13, Math.sin(orbit) * 21); cam.lookAt(0, 3, 0); }
    else { cam.position.set(P.x, EYE + Math.abs(Math.sin(P.bob)) * .035 - (state === 'dead' ? Math.min(1.2, (0.9 - clearT) * 1.4) : 0), P.z); cam.rotation.set(P.pitch, P.yaw, state === 'dead' ? Math.min(.5, (0.9 - clearT) * .6) : 0, 'YXZ'); }
    updViewModel(dt);
    // screen feedback
    if (hurtFlash > 0) hurtFlash = Math.max(0, hurtFlash - dt * 1.6); $('cb-hurt').style.opacity = hurtFlash * .8;
    const fighting = state === 'fight'; $('cb-slow').style.opacity = fighting ? (1 - ts) * .55 : 0; $('cb-tbar').style.width = (fighting ? clamp(ts, 0, 1) * 100 : 0) + '%';
    if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $('cb-banner').classList.remove('show'); }
  }

  // ---------- flow and interface ----------
  function clearField() {
    for (const e of enemies) scene.remove(e.f.g); enemies.length = 0; for (let i = shots.length - 1; i >= 0; i--) killShot(i);
    for (const d of debris) scene.remove(d.m); debris.length = 0; for (const s of sparks) scene.remove(s.m); sparks.length = 0;
  }
  function startWave(i) {
    wave = i; clearField(); const W = WAVES[i]; queue = [];
    for (const t in W.foes) for (let n = 0; n < W.foes[t]; n++) queue.push(t);
    // melee fighters first, the champions last, the rest mixed
    queue.sort((a, b) => (a === 'champion') - (b === 'champion') || Math.random() - .5);
    P.x = 0; P.z = 0; P.hp = 3; P.inv = 0; P.cool = 0; P.swing = -1; P.ammo = WEAPONS[weapon].ammo; P.pitch = 0; ts = 0; actT = 0; lookAmt = 0; spawnT = 0; hurtFlash = 0; frame._left = -1;
    for (const k in keys) keys[k] = false;
    state = 'fight'; const n0 = Math.min(queue.length, i < 2 ? 3 : 4); for (let n = 0; n < n0; n++) spawn(queue.shift());
    // face the nearest foe
    if (enemies[0]) P.yaw = Math.atan2(-(enemies[0].x - P.x), -(enemies[0].z - P.z));
    hideCard(); $('cb-hud').classList.add('show'); hud();
    $('cb-banner').innerHTML = '<b>Wave ' + ROMAN[i] + '</b><span>' + W.name + '</span><i>Time moves only when you move</i>'; $('cb-banner').classList.add('show'); bannerT = 3.2;
    lock();
  }
  function hud() {
    if (mode === 'story') return storyHud();
    const W = WEAPONS[weapon]; $('cb-w').textContent = 'Wave ' + ROMAN[wave] + ' of ' + ROMAN[WAVES.length - 1]; $('cb-wn').textContent = WAVES[wave].name;
    const left = enemies.length + queue.length; $('cb-left').textContent = left + (left === 1 ? ' foe left' : ' foes left');
    $('cb-hp').innerHTML = [0, 1, 2].map(i => '<i class="' + (i < P.hp ? 'on' : '') + '"></i>').join('');
    let w = W.name; if (W.ammo) w += P.ammo > 0 ? ' · ' + P.ammo + ' ' + (P.ammo === 1 ? W.unit : W.unit === 'knife' ? 'knives' : 'arrows') : ' · none left, pick them up or shove';
    $('cb-wpn').textContent = w; $('cb-wpn').classList.toggle('bad', !!W.ammo && P.ammo <= 0);
  }
  const ICON = {
    sword: '<svg viewBox="0 0 48 48"><path d="M36 6 16 30l3 3L42 12z" fill="#d4d8dc" stroke="#2b1a0e" stroke-width="1.5"/><path d="m11 28 9 9M14 34l-7 7" stroke="#7a1f12" stroke-width="4" stroke-linecap="round"/></svg>',
    bow: '<svg viewBox="0 0 48 48"><path d="M12 6c22 4 22 32 0 36" fill="none" stroke="#6a4a2a" stroke-width="3.5" stroke-linecap="round"/><path d="M12 6v36" stroke="#2b1a0e" stroke-width="1"/><path d="M6 24h36m-7-5 7 5-7 5" fill="none" stroke="#7a1f12" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    knives: '<svg viewBox="0 0 48 48"><g stroke="#2b1a0e" stroke-width="1.2"><path d="M10 40 14 16l5-8 1 10-4 23z" fill="#d4d8dc"/><path d="M22 42 26 18l5-8 1 10-4 23z" fill="#d4d8dc"/><path d="M34 40 38 16l5-8 1 10-4 23z" fill="#d4d8dc"/></g><path d="M9 41h8m5 2h8m4-2h8" stroke="#7a1f12" stroke-width="3" stroke-linecap="round"/></svg>',
  };
  function showCard(html) { $('cb-card').innerHTML = html; $('cb-ui').classList.add('show'); if (document.pointerLockElement) document.exitPointerLock(); }
  function hideCard() { $('cb-ui').classList.remove('show'); }
  const wpnRow = () => '<div class="cb-row">' + Object.keys(WEAPONS).map(k => '<button class="cb-chip' + (k === weapon ? ' on' : '') + '" data-a="sw:' + k + '">' + WEAPONS[k].name + '</button>').join('') + '</div>';
  function showPick() {
    state = 'pick'; clearField(); $('cb-hud').classList.remove('show');
    showCard('<div class="eyebrow">The Practice Arena</div><h2>Choose your weapon</h2><p class="cb-p">Five waves, each harder than the last. Your foes move only when you do: stand still and time all but stops.</p>' +
      Object.keys(WEAPONS).map(k => '<button class="cb-wb" data-a="w:' + k + '">' + ICON[k] + '<span><b>' + WEAPONS[k].name + '</b><small>' + WEAPONS[k].blurb + '</small></span></button>').join('') +
      '<div class="cb-keys"><b>W A S D</b> move · <b>Mouse</b> look · <b>Click</b> strike, shoot or throw · <b>P</b> pause</div><button class="cb-quiet" data-a="menu">Back to the main menu</button>');
  }
  function showClear() {
    const nx = WAVES[wave + 1]; const list = Object.keys(nx.foes).map(t => nx.foes[t] + ' ' + TYPES[t].name.toLowerCase() + (nx.foes[t] > 1 ? 's' : '')).join(', ');
    showCard('<div class="eyebrow">Wave ' + ROMAN[wave] + ' cleared</div><h2>' + WAVES[wave].name + '</h2><p class="cb-p">Next, wave ' + ROMAN[wave + 1] + ': <b>' + nx.name + '</b><br>' + list + '.</p><div class="cb-lbl">Fight on with</div>' + wpnRow() +
      '<button class="cb-main" data-a="next">Begin wave ' + ROMAN[wave + 1] + '</button><button class="cb-quiet" data-a="menu">Main menu</button>');
  }
  function showDead() {
    showCard('<div class="eyebrow">Wave ' + ROMAN[wave] + ' · ' + WAVES[wave].name + '</div><h2>You have fallen</h2><p class="cb-p">' + (enemies.length + queue.length) + ' still stood against you. Remember: stop moving and you have all the time you need to read the fight.</p><div class="cb-lbl">Try again with</div>' + wpnRow() +
      '<button class="cb-main" data-a="retry">Try wave ' + ROMAN[wave] + ' again</button><button class="cb-quiet" data-a="pick">Start over from wave I</button><button class="cb-quiet" data-a="menu">Main menu</button>');
  }
  function showWon() {
    const m = Math.floor(stats.t / 60), s = Math.floor(stats.t % 60); $('cb-hud').classList.remove('show');
    showCard('<div class="eyebrow">All five waves cleared</div><h2>Champion of the arena</h2><p class="cb-p">' + stats.kills + ' foes felled · ' + stats.hurt + (stats.hurt === 1 ? ' wound' : ' wounds') + ' taken · ' + m + ':' + String(s).padStart(2, '0') + ' on the sand</p>' +
      '<button class="cb-main" data-a="pick">Fight again</button><button class="cb-quiet" data-a="menu">Main menu</button>');
  }
  function showPause() {
    if (state !== 'fight') return; state = 'pause';
    if (mode === 'story') { showCard('<div class="eyebrow">' + SP.title + '</div><h2>Paused</h2><button class="cb-main" data-a="resume">Resume</button><button class="cb-quiet" data-a="sretry">Restart from the last checkpoint</button>' + (SP.onQuit ? '<button class="cb-quiet" data-a="squit">Save and return to the main menu</button>' : '')); return; }
    showCard('<div class="eyebrow">Wave ' + ROMAN[wave] + ' · ' + WAVES[wave].name + '</div><h2>Paused</h2><button class="cb-main" data-a="resume">Resume</button><button class="cb-quiet" data-a="retry">Restart this wave</button><button class="cb-quiet" data-a="pick">Choose another weapon</button><button class="cb-quiet" data-a="menu">Main menu</button>');
  }
  function lock() { try { const p = $('c').requestPointerLock(); if (p && p.catch) p.catch(() => { }); } catch (e) { } }
  function act(a) {
    if (a.startsWith('w:')) { weapon = a.slice(2); stats = { kills: 0, hurt: 0, t: 0 }; startWave(0); }
    else if (a.startsWith('sw:')) { weapon = a.slice(3); document.querySelectorAll('#cb-card .cb-chip').forEach(b => b.classList.toggle('on', b.dataset.a === a)); }
    else if (a === 'next') startWave(wave + 1);
    else if (a === 'retry') startWave(wave);
    else if (a === 'pick') showPick();
    else if (a === 'resume') { state = 'fight'; hideCard(); for (const k in keys) keys[k] = false; lock(); }
    else if (a === 'menu') close();
    else if (a === 'sretry') retryStage();
    else if (a === 'squit') { const f = SP.onQuit; endStory(); f && f(); }
  }
  function open() {
    if (!window.__game || !window.__game.renderer) return;
    if (!built) buildScene();
    prevTone = renderer.toneMapping; prevExp = renderer.toneMappingExposure; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix();
    window.__combatOn = true; lastT = performance.now(); $('intro').classList.add('hide'); document.body.classList.add('combat'); showPick();
  }
  function close() {
    clearField(); state = 'off'; window.__combatOn = false; if (document.pointerLockElement) document.exitPointerLock();
    renderer.toneMapping = prevTone; renderer.toneMappingExposure = prevExp;
    hideCard(); $('cb-hud').classList.remove('show'); document.body.classList.remove('combat'); $('intro').classList.remove('hide');
  }

  // ============================================================
  //  v21: STORY ENCOUNTERS — fights in place, inside the Journey
  // ============================================================
  const hintEl = document.createElement('div'); hintEl.id = 'cb-hint'; $('cb-hud').appendChild(hintEl);
  const promptEl2 = document.createElement('div'); promptEl2.id = 'cb-prompt'; $('cb-hud').appendChild(promptEl2);
  { const st = document.createElement('style'); st.textContent = `
    #cb-hint { position:absolute; left:50%; top:64%; transform:translateX(-50%); max-width:520px; padding:7px 16px; text-align:center; font-size:16px; color:var(--ink, #2b1a0e); background:rgba(247,236,211,.86); border:1px solid rgba(122,31,18,.4); border-radius:3px; opacity:0; transition:opacity .4s; }
    #cb-hint.show { opacity:1; } #cb-hint b { color:var(--rubric, #7a1f12); }
    #cb-prompt { position:absolute; left:50%; top:57%; transform:translateX(-50%); padding:6px 16px; font-size:16px; color:#fff3dc; background:rgba(40,24,12,.78); border-radius:3px; display:none; } #cb-prompt.show { display:block; } #cb-prompt b { color:#f0d48a; }
    #cb-hud.scene > *:not(#cb-hint):not(#cb-prompt):not(#cb-banner) { visibility:hidden; }
    #cb-wpn .k { display:inline-block; margin-right:10px; opacity:.55; } #cb-wpn .k.on { opacity:1; } #cb-wpn .k b { color:var(--rubric, #7a1f12); }
  `; document.head.appendChild(st); }
  const curK = () => mode === 'story' ? SP.k : WAVES[wave].k;
  function targetOf(e) { return (ally && !ally.down && !ally.scripted && e.tg === 'a') ? ally : P; }
  function prompt(html) { if (!html) { promptEl2.classList.remove('show'); return; } promptEl2.innerHTML = html; promptEl2.classList.add('show'); }
  function hint(id, text, force) { if (!SP) return; if (!force && SP.hints[id]) return; SP.hints[id] = 1; hintEl.innerHTML = text; hintEl.classList.add('show'); hintT = 5.5; }
  const arrowsLeft = () => weapon === 'bow' ? P.ammo : (store.bow || 0);
  function addArrow(n = 1) { if (mode !== 'story' || weapon === 'bow') P.ammo += n; else store.bow = (store.bow || 0) + n; hud(); }
  function setWeapon(w) {
    if (!owned[w] || w === weapon) return; if (weapon === 'bow') store.bow = P.ammo; weapon = w; P.ammo = w === 'bow' ? (store.bow || 0) : 0; P.swing = -1; P.cool = 0; hud();
  }
  // ---------- the sets ----------
  function addSet(name, build) { const g = new THREE.Group(); g.visible = false; scene.add(g); const set = { g, pillars: [], walls: [] }; build(g, set); sets[name] = set; return set; }
  function groundMesh(w, d, f) { const fg = new THREE.PlaneGeometry(w, d, Math.round(w / 1.5), Math.round(d / 1.5)); fg.rotateX(-Math.PI / 2); const p = fg.attributes.position, c = new Float32Array(p.count * 3); const col = new THREE.Color();
    for (let i = 0; i < p.count; i++) { const [hex, k, y] = f(p.getX(i), p.getZ(i)); col.set(hex); c[i * 3] = col.r * k; c[i * 3 + 1] = col.g * k; c[i * 3 + 2] = col.b * k; p.setY(i, y || 0); }
    fg.setAttribute('color', new THREE.BufferAttribute(c, 3)); fg.computeVertexNormals(); const m = new THREE.Mesh(fg, new THREE.MeshLambertMaterial({ vertexColors: true })); m.receiveShadow = true; return m; }
  function buildHill(g, set) { // a clearing in the hills between Damascus and Aleppo, at dawn
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true }); const G = new Geo();
    g.add(groundMesh(260, 220, (x, z) => { const r = Math.max(Math.abs(x) / 25, Math.abs(z) / 20); const lift = r > 1.15 ? (r - 1.15) * (r - 1.15) * 9 + hash(Math.round(x / 6), Math.round(z / 6)) * 2 : 0;
      const road = Math.abs(z + x * .12 - 2) < 2.2 && r < 4; const n = hash(Math.round(x * 1.2), Math.round(z * 1.2)) * .12; return [road ? 0xc9a878 : (n > .07 ? 0x9a8a4a : 0xa89458), .9 + n, Math.min(lift, 26)]; }));
    const rocks = [[-11, -4, 1.6, 1.3], [9, -6, 1.3, 1.0], [-6, 8, 1.1, .9], [14, 7, 1.7, 1.4], [-17, 12, 1.4, 1.1], [3, -1, .9, .7], [-19, -11, 1.5, 1.2], [19, -12, 1.2, 1.0]];
    for (const [x, z, r, h] of rocks) { G.cyl(x, 0, z, r, r * .7, h, 0x9a8c78, 7); G.cyl(x + r * .3, h * .7, z - r * .2, r * .55, r * .3, h * .5, 0xaa9c86, 6); set.pillars.push({ x, z, r: r + .1, h: h * 1.3 }); }
    for (let i = 0; i < 46; i++) { const a = rnd(TAU), d = rnd(6, 24); const x = Math.cos(a) * d * 1.1, z = Math.sin(a) * d * .85; if (rocks.some(r => Math.hypot(r[0] - x, r[1] - z) < r[2] + 1.2)) continue; const s = rnd(.4, .9); G.cyl(x, 0, z, s, s * .2, s * 1.2, i % 3 ? 0x6a7a3a : 0x7a6a3a, 6); }
    for (let i = 0; i < 26; i++) { const a = i / 26 * TAU, d = 70 + rnd(30); const x = Math.cos(a) * d, z = Math.sin(a) * d; G.cyl(x, 0, z, rnd(14, 26), rnd(2, 5), rnd(14, 30), i % 2 ? 0xb89a6a : 0xa88a5a, 7); }
    // two tethered horses by the road and the riders' gear
    for (const [x, z] of [[-3, -19], [1, -19.5]]) { G.box(x, 1.05, z, .55, .6, 1.6, 0x5a3a24); for (const sx of [-1, 1]) for (const sz of [-1, 1]) G.box(x + sx * .18, 0, z + sz * .55, .13, 1.05, .13, 0x4a2e1c); G.box(x, 1.45, z + .9, .24, .7, .3, 0x5a3a24); }
    const m = G.mesh(mat); m.castShadow = !lowQ; m.receiveShadow = true; g.add(m);
    set.rects0 = [[-25, 25, -20, 20]]; set.sky = [0x5a6aa8, 0xf4b27a]; set.sun = [0xffc890, -60, 18, 30, 2.2]; set.fog = [0xe8b890, 60, 240]; set.hemi = 1.15;
  }
  function buildHouse(g, set) { // the Compagna's rented house in Delhi: a hall, an arcaded courtyard with a gallery and a well, the gate yard
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true }); const G = new Geo(); const RS = 0xb9876a, RS2 = 0xa8765a, PL = 0xe0cdb0, WOOD = 0x6a4428;
    g.add(groundMesh(140, 90, (x, z) => { const hall = x < -11.5; const tile = (Math.floor(x / 2) + Math.floor(z / 2)) & 1; return [hall ? (tile ? 0x8a6a52 : 0x7a5a44) : x > 16.5 ? 0xb8a07a : (tile ? 0xd8c4a0 : 0xc8b08a), .95 + hash(Math.round(x), Math.round(z)) * .08, 0]; }));
    const wall = (x0, x1, z0, z1, h, c = RS) => { G.box((x0 + x1) / 2, 0, (z0 + z1) / 2, x1 - x0, h, z1 - z0, c); set.walls.push([x0, x1, z0, z1, h]); };
    // the hall
    wall(-31, -12, 7, 8, 6.5); wall(-31, -12, -8, -7, 6.5); wall(-31, -30, -8, 8, 6.5); wall(-12, -11, -12, -1.6, 6.5); wall(-12, -11, 1.6, 12, 6.5);
    G.box(-11.5, 4.2, 0, 1, 2.3, 3.2, RS); for (let x = -29; x <= -13; x += 4) G.box(x, 6.2, 0, .35, .35, 15, WOOD);
    for (const [x, z] of [[-24, -3.5], [-24, 3.5], [-18, -3.5], [-18, 3.5]]) { G.cyl(x, 0, z, .45, .4, 6.2, PL, 8); set.pillars.push({ x, z, r: .55, h: 6.2 }); }
    G.box(-29.4, 0, 0, 1, .8, 5, WOOD); G.box(-28, 0, -6, 3, .9, 1.2, 0x7a2a1e); // a chest, a carpet roll
    G.quad([-27, .02, -2.5], [-27, .02, 2.5], [-15, .02, 2.5], [-15, .02, -2.5], 0x8a2a1e, 1); G.quad([-26.6, .03, -2.1], [-26.6, .03, 2.1], [-15.4, .03, 2.1], [-15.4, .03, -2.1], 0xb8862e, .9);
    // the courtyard: south wall, the arcade and gallery to the north, the well
    wall(-11, 16, -13, -12, 6); wall(-11, 16, 17, 18, 8.5); wall(16, 17, -12, -2, 6); wall(16, 17, 2, 18, 6);
    G.box(2.5, 2.4, 14.6, 27, .25, 4.8, RS2); set.walls.push([-11, 16, 12.2, 17, 2.62]); G.box(2.5, 2.62, 12.35, 27, .55, .3, RS); set.walls.push([-11, 16, 12.2, 12.5, 3.17]);
    for (let x = -10; x <= 15; x += 3.2) { G.cyl(x, 0, 12.5, .3, .26, 2.4, PL, 8); G.box(x, 2.6, 12.5, .4, .1, .4, PL); }
    for (let x = -9; x <= 14; x += 4.6) { G.box(x, 1.4, -12.1, 2.2, 3.1, .15, RS2); }
    G.box(16.5, 4.3, 0, 1, 1.7, 4.2, RS);
    G.cyl(2, 0, -3, 1.2, 1.25, 1.0, PL, 12); G.cyl(2, 1.0, -3, 1.0, 1.0, .04, 0x2a4a5a, 12); G.box(.9, 1, -3, .12, 1.6, .12, WOOD); G.box(3.1, 1, -3, .12, 1.6, .12, WOOD); G.box(2, 2.6, -3, 2.4, .12, .12, WOOD);
    set.pillars.push({ x: 2, z: -3, r: 1.35, h: 1.05 });
    for (const [x, z] of [[-7, -9], [12, -9], [-8, 9]]) { G.cyl(x, 0, z, .45, .55, .9, 0xa8502a, 8); set.pillars.push({ x, z, r: .6, h: .9 }); } // planters
    // the Compagna's banner: the red cross of Genoa, with a little griffin
    G.box(4, 3.2, -11.86, 2.2, 2.6, .06, 0xf0ece0); G.box(4, 4.25, -11.82, 2.2, .4, .05, 0xa8201a); G.box(4.6, 3.2, -11.82, .4, 2.6, .05, 0xa8201a); G.box(3.3, 3.5, -11.8, .5, .5, .04, 0xc8a03a);
    // the gate yard and the barred gate
    wall(16, 31, 8, 9, 4.6); wall(16, 31, -9, -8, 4.6); wall(30, 31, -9, 9, 6.5);
    G.box(29.9, 0, 0, .2, 4.6, 5, WOOD); G.box(29.75, 2.3, 0, .2, .3, 5.4, 0x3a2a1a); for (const z of [-1.6, 1.6]) G.box(29.7, 0, z, .14, 4.6, .14, 0x3a2a1a);
    for (const [x, z] of [[22, -5.5], [25.5, 5.6], [27, -6]]) { G.box(x, 0, z, 1.3, 1.1, 1.3, WOOD); set.pillars.push({ x, z, r: .95, h: 1.15 }); }
    const m = G.mesh(mat); m.castShadow = !lowQ; m.receiveShadow = true; g.add(m);
    set.rects0 = [[-30, -12, -7, 7]]; set.sky = [0x6a9ad0, 0xf2dcb0]; set.sun = [0xffe6bd, 30, 60, 22, 2.6]; set.fog = [0xe9d6b4, 80, 300]; set.hemi = 1.4;
  }
  // ---------- the encounters ----------
  const FIGHTS = {
    A: { title: 'The Riders at Dawn', set: 'hill', k: .86, stages: [
      { name: 'Two riders on the hill path', player: [0, 13, 0], foes: [['rider', -4, -12], ['rider', 6, -13]] }] },
    B: { title: 'The Compagna\'s House', set: 'house', k: 1.08, ally: true, refill: true, stages: [
      { name: 'The hall', player: [-27.5, 0, -Math.PI / 2], ally: [-26, 2.2], foes: [['guard', -15.5, -3], ['guard', -14.5, 3.2], ['guard', -18.5, .5]], knock: [-24.6, -1.6] },
      { name: 'The courtyard', enter: x => x > -9.6, player: [-9.4, 0, -Math.PI / 2], ally: [-9.6, 2.4], door: [[-14, -9, -1.5, 1.5], [-11, 16, -12, 12]], foes: [['brigand', 8, -8], ['brigand', 11, 6], ['brigand', 13, -1], ['shield', 6, 2], ['archer', -3, 14.6, 2.62], ['archer', 9, 14.6, 2.62]] },
      { name: 'The Tyrian', go: 'the gate yard', enter: x => x > 18.6, player: [18.6, 0, -Math.PI / 2], ally: [18.2, 2.4], door: [[14, 19, -2, 2], [17, 30, -8, 8]], foes: [['tyrian', 27, 0], ['brigand', 25.5, -5], ['brigand', 25.5, 5]], escapeZ: 7.25 }] },
  };
  function startStory(id, spec) {
    if (!window.__game || !window.__game.renderer) return; if (!built) buildScene();
    const F = FIGHTS[id]; SP = Object.assign({ id, k: F.k, title: F.title, hints: {} }, F, spec); mode = 'story';
    if (!sets[F.set]) addSet(F.set, F.set === 'hill' ? buildHill : buildHouse);
    SB = sets[F.set]; for (const k in sets) sets[k].g.visible = k === F.set; arenaG.visible = false;
    pillars.length = 0; pillars.push(...SB.pillars);
    skyU.zen.value.set(SB.sky[0]); skyU.hor.value.set(SB.sky[1]); scene.fog.color.set(SB.fog[0]); scene.fog.near = SB.fog[1]; scene.fog.far = SB.fog[2];
    sunL.color.set(SB.sun[0]); sunL.position.set(SB.sun[1], SB.sun[2], SB.sun[3]); sunL.intensity = SB.sun[4];
    prevTone = renderer.toneMapping; prevExp = renderer.toneMappingExposure; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix();
    window.__combatOn = true; lastT = performance.now(); document.body.classList.add('combat');
    owned.bow = true; owned.sword = false; store.bow = SP.arrows; weapon = 'bow'; P.ammo = SP.arrows; stats = { kills: 0, hurt: 0, t: 0 };
    $('cb-keyline').innerHTML = '<b>WASD</b> move · <b>Mouse</b> look · <b>Click</b> shoot or strike' + (id === 'B' ? ' · <b>1 2</b> bow, sword' : '') + ' · <b>P</b> pause · stand still to slow time';
    SP.stage = -1; SP.cp = null; SB.rects = SB.rects0.map(r => r.slice()); beginStage(0);
  }
  function placeAlly(x, z) {
    if (!ally) { const f = window.HERO ? HERO.makeFigure(SP.allyLook || {}, { weapon: 'sword' }) : new THREE.Group(); scene.add(f); ally = { f, x, z, yaw: -Math.PI / 2, st: 'idle', t: 0, down: 0, ph: 0, mv: 0 }; }
    Object.assign(ally, { x, z, st: 'idle', t: 0, down: 0, scripted: false, dead: false }); ally.f.rotation.set(0, 0, 0); ally.f.position.set(x, 0, z);
  }
  function beginStage(i, retry) {
    const st = SP.stages[i]; SP.stage = i; clearField(); prompt(''); if (swordItem) { scene.remove(swordItem); swordItem = null; } if (weapon === 'bow') store.bow = P.ammo;
    if (!retry) SP.cp = { i, arrows: store.bow, sword: !!owned.sword, rects: SB.rects.map(r => r.slice()) };
    else { SB.rects = SP.cp.rects.map(r => r.slice()); store.bow = SP.cp.arrows; owned.sword = SP.cp.sword; if (weapon === 'sword' && !owned.sword) weapon = 'bow'; }
    if (weapon === 'bow') P.ammo = store.bow; else P.ammo = 0;
    const [px, pz, yaw] = st.player; P.x = px; P.z = pz; P.yaw = yaw; P.pitch = 0; P.hp = 3; P.inv = 0; P.cool = 0; P.swing = -1; ts = 0; actT = 0; lookAmt = 0; hurtFlash = 0; frame._left = -1; SP.refillT = 0; sceneLook = null;
    for (const k in keys) keys[k] = false;
    if (SP.ally && st.ally) placeAlly(st.ally[0], st.ally[1]);
    for (const [type, x, z, y] of st.foes) spawnAt(type, x, z, y);
    if (st.knock && (!owned.sword)) { const e = spawnAt('guard', st.knock[0], st.knock[1]); e.st = 'recover'; e.t = 9; SP.knockT = .7; SP.knockE = e; }
    state = 'fight'; SP.holdClear = false; hideCard(); $('cb-hud').classList.add('show'); hud();
    $('cb-banner').innerHTML = '<b>' + SP.title + '</b><span>' + st.name + '</span><i>' + (retry ? 'From the last checkpoint' : SP.id === 'A' ? 'Time moves only when you move' : 'Stage ' + ROMAN[i] + ' of ' + ROMAN[SP.stages.length - 1]) + '</i>'; $('cb-banner').classList.add('show'); bannerT = 3;
    if (SP.id === 'A') setTimeout(() => { if (state === 'fight') hint('a_shoot', '<b>Click</b> to shoot. A hit to the head always fells a man. <b>Time moves only when you move</b>: stand still to think.'); }, 1800);
    if (SP.id === 'B' && i === 0) setTimeout(() => hint('b_matteo', 'Matteo fights beside you. If they knock him down, he gets back up.'), 3400);
    if (SP.id === 'B' && i === 1) setTimeout(() => hint('b_gallery', 'Archers on the gallery: only arrows can reach them.'), 2600);
    if (SP.id === 'B' && i === 2) setTimeout(() => hint('b_tyrian', 'The Tyrian: a champion, and he takes three hits.'), 2600);
    lock();
  }
  function spawnAt(type, x, z, y) {
    const T = TYPES[type]; const e = { type, T, f: makeFigure(type === 'tyrian' || type === 'guard' || type === 'rider' ? (type === 'tyrian' ? 'champion' : 'brigand') : type), x, z, y: y || 0, fixed: !!y, yaw: Math.atan2(P.x - x, P.z - z), st: 'hunt', t: 0, hp: T.hp, shield: T.shield || 0, ph: rnd(TAU), mv: 0, rad: .42 * T.scale, speed: T.speed * SP.k * rnd(.92, 1.08), hit: false, flinch: 0, side: Math.random() < .5 ? -1 : 1, tg: 'p', tgT: rnd(2) };
    if (type !== 'brigand' && type !== 'archer' && type !== 'shield') { e.T = Object.assign({}, TYPES[type === 'tyrian' ? 'champion' : 'brigand'], T); recolor(e.f, T); }
    if (type === 'tyrian') { e.escapes = true; e.f.g.scale.setScalar(T.scale); }
    e.f.g.position.set(x, e.y, z); scene.add(e.f.g); enemies.push(e); return e;
  }
  function recolor(f, T) { f.g.traverse(o => { if (!o.isMesh) return; const h = o.material.color.getHex(); if (h === TYPES.brigand.tunic || h === TYPES.champion.tunic) o.material = M(T.tunic); else if (h === TYPES.brigand.legs || h === TYPES.champion.legs) o.material = M(T.legs); }); }
  function stageCleared() {
    const i = SP.stage; if (i < SP.stages.length - 1) { const nx = SP.stages[i + 1]; for (const r of nx.door) if (!SB.rects.some(q => q.join() === r.join())) SB.rects.push(r);
      state = 'walk'; prompt('The way is open. Go on to <b>' + (nx.go || nx.name.toLowerCase()) + '</b>.'); return; }
    if (SP.id === 'A') { state = 'loot'; lootT = 0; hint('a_pick', 'Walk over spent arrows to pick them up.'); return; }
  }
  function showStoryDead() {
    showCard('<div class="eyebrow">' + SP.title + ' · ' + SP.stages[SP.stage].name + '</div><h2>You have fallen</h2><p class="cb-p">Nothing is lost. Stand still and time all but stops: read the fight before you move.</p><button class="cb-main" data-a="sretry">Try again from the last checkpoint</button>');
  }
  function retryStage() { hideCard(); for (const k in keys) keys[k] = false; beginStage(SP.cp.i, true); }
  function storyHud() {
    $('cb-w').textContent = SP.title; $('cb-wn').textContent = SP.stages[SP.stage] ? SP.stages[SP.stage].name : '';
    const left = enemies.filter(e => e.st !== 'flee').length; $('cb-left').textContent = left + (left === 1 ? ' foe left' : ' foes left');
    $('cb-hp').innerHTML = [0, 1, 2].map(i => '<i class="' + (i < P.hp ? 'on' : '') + '"></i>').join('');
    const a = arrowsLeft(); const bow = 'Bow · ' + (a > 0 ? a + (a === 1 ? ' arrow' : ' arrows') : 'none left, click to shove');
    $('cb-wpn').innerHTML = owned.sword ? '<span class="k' + (weapon === 'bow' ? ' on' : '') + '"><b>1</b> ' + bow + '</span><span class="k' + (weapon === 'sword' ? ' on' : '') + '"><b>2</b> Sword</span>' : bow;
    $('cb-wpn').classList.toggle('bad', weapon === 'bow' && a <= 0);
  }
  function storyTick(dt, g) {
    const st = SP.stages[SP.stage];
    // Matteo fells the first guard; his sword is yours for the taking
    if (SP.knockT > 0) { SP.knockT -= dt; if (SP.knockT <= 0 && SP.knockE && enemies.includes(SP.knockE)) { const e = SP.knockE; hitEnemy(e, 1, e.x - (ally ? ally.x : P.x), e.z - (ally ? ally.z : P.z), false); burst(e.x, 1.2, e.z, 0xa3321f, 7); dropSword(e.x, e.z); } }
    if (swordItem) { swordItem.rotation.y += dt * 1.5; const d = Math.hypot(swordItem.position.x - P.x, swordItem.position.z - P.z); if (d < 1.1) takeSword(); else if (d < 2.6) prompt('<b>E</b> &nbsp;Take the sword'); else prompt(''); }
    if (SP.id === 'A') { if (arrowsLeft() < SP.arrows && shots.some(s => s.pick)) hint('a_pick', 'Walk over spent arrows to pick them up.'); if (arrowsLeft() <= 0) hint('a_shove', 'Out of arrows: <b>click</b> to shove a man back.'); }
    if (SP.refill && arrowsLeft() <= 0 && enemies.some(e => e.fixed) && !shots.some(s => s.pick && s.stuck)) { SP.refillT += dt; if (SP.refillT > 3) { SP.refillT = 0; addArrow(6); hint('quiver', 'Matteo kicks a quiver across the floor: <i>"Here! Make them count!"</i> (+6 arrows)', true); } }
    // retarget: foes split their attention between you and Matteo
    for (const e of enemies) { e.tgT -= g; if (e.tgT <= 0) { e.tgT = 2 + rnd(1.5); e.tg = ally && !ally.down && Math.hypot(ally.x - e.x, ally.z - e.z) < 14 && Math.random() < (e.type === 'archer' ? .25 : .4) ? 'a' : 'p'; } }
  }
  function dropSword(x, z) { swordItem = new THREE.Group(); part(swordItem, .05, .02, .85, 0xd4d8dc, 0, .1, .2); part(swordItem, .22, .03, .05, 0xc9a44a, 0, .1, -.24); part(swordItem, .04, .04, .2, 0x3a2a1c, 0, .1, -.36); swordItem.position.set(x, 0, z); scene.add(swordItem); hint('b_sword', 'Matteo knocks a guard down. <b>Take his sword</b>: walk over it, or press <b>E</b>.'); }
  function takeSword() { if (!swordItem) return; scene.remove(swordItem); swordItem = null; owned.sword = true; prompt(''); setWeapon('sword'); hint('b_switch', 'You have a sword. Keys <b>1</b> and <b>2</b> switch between the bow and the sword.', true); }
  function storyKey(e) {
    if (e.code === 'Digit1' && state === 'fight') { setWeapon('bow'); return true; }
    if (e.code === 'Digit2' && state === 'fight') { setWeapon('sword'); return true; }
    if (e.code === 'KeyE') { if (state === 'fight' && swordItem && Math.hypot(swordItem.position.x - P.x, swordItem.position.z - P.z) < 2.6) { takeSword(); return true; }
      if (state === 'loot' && lootT > .6) { prompt(''); state = 'scene'; sceneLook = null; if (document.pointerLockElement) document.exitPointerLock(); SP.onLoot && SP.onLoot(arrowsLeft()); return true; } }
    return false;
  }
  // the walk between stages: the next stage begins as you go through the door
  { const t0 = tick; tick = function (dt) { if (state === 'walk') { updPlayer(dt); ts = 1; updShots(dt); if (ally) { if (!ally.scripted) { ally.st = 'idle'; } updAlly(dt); } updDebris(dt); const nx = SP.stages[SP.stage + 1]; if (nx && nx.enter(P.x)) { prompt(''); beginStage(SP.stage + 1); } cam.position.set(P.x, EYE + Math.abs(Math.sin(P.bob)) * .035, P.z); cam.rotation.set(P.pitch, P.yaw, 0, 'YXZ'); updViewModel(dt); if (hintT > 0) { hintT -= dt; if (hintT <= 0) hintEl.classList.remove('show'); } if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $('cb-banner').classList.remove('show'); } $('cb-slow').style.opacity = 0; return; } t0(dt); }; }
  // ---------- Matteo ----------
  function hurtAlly() { if (!ally || ally.down > 0 || ally.scripted) return; ally.down = 3.2; ally.st = 'idle'; burst(ally.x, 1.2, ally.z, 0xa3321f, 6); }
  function updAlly(g) {
    if (!ally) return; const a = ally, f = a.f, u = f.userData || {};
    if (a.dead) { f.position.set(a.x, 0, a.z); return; }
    if (a.sit) { f.position.set(a.x, -.42, a.z); f.rotation.set(0, a.yaw, 0); if (u.legs) for (const l of u.legs) l.rotation.x = -1.45; return; }
    if (a.down > 0) { a.down -= g; f.position.set(a.x, .15, a.z); f.rotation.set(-1.45, a.yaw, 0, 'YXZ'); if (a.down <= 0) f.rotation.set(0, a.yaw, 0); return; }
    a.mv = 0; let tg = null, bd = 1e9;
    if (!a.scripted) for (const e of enemies) { if (e.fixed || e.st === 'escape' || e.st === 'flee') continue; const d = Math.hypot(e.x - a.x, e.z - a.z); if (d < bd) { bd = d; tg = e; } }
    const K = curK(); const go = (tx, tz, sp) => { const dx = tx - a.x, dz = tz - a.z, l = Math.hypot(dx, dz) || 1; a.x += dx / l * sp * g; a.z += dz / l * sp * g; a.mv = sp; };
    if (a.st === 'wind') { a.t -= g; if (a.t <= 0) { a.st = 'strike'; a.t = .18; a.hit = false; } }
    else if (a.st === 'strike') { a.t -= g; if (!a.hit && a.t < .09) { a.hit = true; if (tg && bd < 2.4) { const r = hitEnemy(tg, 1, tg.x - a.x, tg.z - a.z, false); burst(tg.x, 1.2, tg.z, r === 'block' ? 0xfff2d0 : 0xa3321f, 6); } } if (a.t <= 0) { a.st = 'recover'; a.t = 1.0 / K; } }
    else if (a.st === 'recover') { a.t -= g; if (a.t <= 0) a.st = 'idle'; }
    else if (tg && bd > 1.8) go(tg.x, tg.z, 3.7); else if (tg) { a.st = 'wind'; a.t = 1.05 / K; }
    else if (Math.hypot(P.x - a.x, P.z - a.z) > 3.2) go(P.x, P.z, state === 'walk' ? 6 : 3.7);
    for (const p of pillars) { const ox = a.x - p.x, oz = a.z - p.z, d = Math.hypot(ox, oz), r = p.r + .4; if (d < r && d > 1e-4) { a.x = p.x + ox / d * r; a.z = p.z + oz / d * r; } }
    for (const e of enemies) { if (e.fixed) continue; const ox = a.x - e.x, oz = a.z - e.z, d = Math.hypot(ox, oz), r = e.rad + .42; if (d < r && d > 1e-4) { a.x = e.x + ox / d * r; a.z = e.z + oz / d * r; } }
    clampIn(a, .8);
    const lx = (tg ? tg.x : P.x) - a.x, lz = (tg ? tg.z : P.z) - a.z; a.yaw = Math.atan2(lx, lz);
    f.position.set(a.x, 0, a.z); f.rotation.set(0, a.yaw, 0);
    if (a.mv > 0) a.ph += a.mv * g * 2.6; const sw = a.mv > 0 ? Math.sin(a.ph) * .6 : 0;
    if (u.legs) { u.legs[0].rotation.x = sw; u.legs[1].rotation.x = -sw; }
    if (u.arms) { let ar = -.3 + sw * .4; if (a.st === 'wind') ar = lerp(-.3, -2.6, clamp(1 - a.t * K / 1.05, 0, 1)); else if (a.st === 'strike') ar = lerp(-.4, -2.6, clamp(a.t / .18, 0, 1)); u.arms[1].rotation.x = ar; u.arms[0].rotation.x = -sw * .4; }
  }
  // ---------- the Tyrian breaks off ----------
  function startEscape(e) {
    e.st = 'escape'; e.ez = SP.stages[SP.stage].escapeZ; e.climb = 0; state = 'scene'; sceneLook = { x: e.x, y: 2, z: e.z }; SP.holdClear = true; prompt(''); hintEl.classList.remove('show');
    for (const o of enemies) if (o !== e) { o.st = 'flee'; }
    if (ally) ally.scripted = true;
  }
  function escapeStep(e, g) {
    const f = e.f; if (e.st === 'flee') { const tx = 14.5, tz = 0; const dx = tx - e.x, dz = tz - e.z, d = Math.hypot(dx, dz); if (d < 1.2) { scene.remove(f.g); enemies.splice(enemies.indexOf(e), 1); return; } e.x += dx / d * 6 * g; e.z += dz / d * 6 * g; e.yaw = Math.atan2(dx, dz); e.ph += g * 15; f.legL.rotation.x = Math.sin(e.ph) * .7; f.legR.rotation.x = -Math.sin(e.ph) * .7; f.g.position.set(e.x, 0, e.z); f.g.rotation.y = e.yaw; return; }
    if (e.perch) { f.g.position.set(e.x, e.y, e.z); return; }
    if (e.climb === 0) { const dz = e.ez - e.z; if (Math.abs(dz) > .3) { e.z += Math.sign(dz) * Math.min(Math.abs(dz), 6.5 * g); e.yaw = dz > 0 ? 0 : Math.PI; e.ph += g * 15; f.legL.rotation.x = Math.sin(e.ph) * .7; f.legR.rotation.x = -Math.sin(e.ph) * .7; } else e.climb = .001; }
    else if (e.climb < 1) { e.climb = Math.min(1, e.climb + g / 1.3); e.y = 4.6 * e.climb; e.z = e.ez + .9 * e.climb; f.armL.rotation.x = f.armR.rotation.x = -2.8 + Math.sin(e.climb * 20) * .4; if (e.climb >= 1) { e.perch = true; e.yaw = Math.atan2(P.x - e.x, P.z - e.z); f.armL.rotation.x = f.armR.rotation.x = -.3; f.legL.rotation.x = f.legR.rotation.x = 0; sceneLook = { x: e.x, y: e.y + 1.6, z: e.z }; if (SP.onEscape) SP.onEscape(); } }
    sceneLook = sceneLook && !e.perch ? { x: e.x, y: (e.y || 0) + 1.7, z: e.z } : sceneLook;
    f.g.position.set(e.x, e.y || 0, e.z); f.g.rotation.y = e.yaw;
  }
  // ---------- commands from the story's cutscenes ----------
  function storyCmd(c, arg) {
    const ty = enemies.find(e => e.escapes);
    if (c === 'bolt' && ty && ally) { // the crossbow bolt from the wall
      ty.f.armR.rotation.x = -1.5; ty.f.armL.rotation.x = -1.4; const ox = ty.x, oy = ty.y + 1.45, oz = ty.z - .4; const dx = ally.x - ox, dy = 1.2 - oy, dz = ally.z - oz, l = Math.hypot(dx, dy, dz);
      const s = addShot('e', 'arrow', ox, oy, oz, dx / l * 40, dy / l * 40, dz / l * 40, 0); s.bolt = () => { ally.scripted = true; burst(ally.x, 1.3, ally.z, 0xa3321f, 10); ally.f.rotation.set(0, ally.yaw, 0); ally.sit = true; sceneLook = { x: ally.x, y: .9, z: ally.z }; if (arg) arg(); };
      sceneLook = { x: ally.x, y: 1.2, z: ally.z }; }
    if (c === 'tyrianGone' && ty) { scene.remove(ty.f.g); enemies.splice(enemies.indexOf(ty), 1); }
    if (c === 'toWell' && ally) { ally.x = 2.0; ally.z = -1.55; ally.yaw = 0; ally.sit = true; ally.dead = false; P.x = 2.1; P.z = 1.2; sceneLook = { x: 2.0, y: .95, z: -1.55 }; P.yaw = Math.atan2(-(ally.x - P.x), -(ally.z - P.z)); P.pitch = -.3; if (weapon) vm[weapon].visible = false; }
    if (c === 'look') sceneLook = arg;
    if (c === 'lookTyrian' && ty) sceneLook = { x: ty.x, y: ty.y + 1.6, z: ty.z };
  }
  function endStory() {
    clearField(); if (ally) { scene.remove(ally.f); ally = null; } if (swordItem) { scene.remove(swordItem); swordItem = null; } prompt(''); hintEl.classList.remove('show'); $('cb-banner').classList.remove('show');
    for (const k in sets) sets[k].g.visible = false; arenaG.visible = true; pillars.length = 0; pillars.push(...arenaPillars);
    skyU.zen.value.set(0x4f86c6); skyU.hor.value.set(0xf0dcb8); scene.fog.color.set(0xe9d6b4); scene.fog.near = 120; scene.fog.far = 620; sunL.color.set(0xffe6bd); sunL.position.set(38, 70, 26); sunL.intensity = 2.6;
    state = 'off'; mode = 'practice'; SP = null; window.__combatOn = false; if (document.pointerLockElement) document.exitPointerLock();
    renderer.toneMapping = prevTone; renderer.toneMappingExposure = prevExp; hideCard(); $('cb-hud').classList.remove('show'); document.body.classList.remove('combat'); weapon = 'sword';
    $('cb-keyline').innerHTML = '<b>WASD</b> move · <b>Mouse</b> look · <b>Click</b> attack · <b>P</b> pause · stand still to slow time';
  }

  // ---------- input ----------
  $('cb-ui').addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b) act(b.dataset.a); });
  document.addEventListener('keydown', e => {
    if (!window.__combatOn) return;
    if (e.code === 'KeyP' || e.code === 'Escape') { if (state === 'fight') showPause(); else if (state === 'pause' && e.code === 'KeyP') act('resume'); e.preventDefault(); return; }
    if (mode === 'story' && storyKey(e)) { e.preventDefault(); return; }
    keys[e.code] = true; if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  });
  document.addEventListener('keyup', e => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  document.addEventListener('mousemove', e => {
    if (state !== 'fight' && state !== 'loot') return; const dx = e.movementX || 0, dy = e.movementY || 0;
    P.yaw -= dx * .0022; P.pitch = clamp(P.pitch - dy * .0022, -1.3, 1.3); lookAmt += Math.hypot(dx, dy) * .0022;
  });
  $('c').addEventListener('mousedown', e => { if (state !== 'fight' || e.button !== 0) return; if (document.pointerLockElement !== $('c')) lock(); attack(); });
  document.addEventListener('pointerlockchange', () => {
    if (!window.__combatOn) return; const l = document.pointerLockElement === $('c');
    if (!l && wasLocked && state === 'fight' && !window.__dlgOpen) showPause(); wasLocked = l;
  });
  addEventListener('resize', () => { if (cam) { cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); } });

  window.COMBAT = { open, frame, close, story: startStory, endStory, cmd: storyCmd };
  window.__combat = { tick, get queue() { return queue; }, get stats() { return stats; }, get state() { return state; }, get ts() { return ts; }, P, enemies, shots, keys, attack, startWave, act, get wave() { return wave; }, set weapon(w) { weapon = w; }, get weapon() { return weapon; }, hurtPlayer, hitEnemy, get mode() { return mode; }, get ally() { return ally; }, get SB() { return SB; }, get stage() { return SP && SP.stage; }, setWeapon, storyCmd, arrowsLeft: () => arrowsLeft() };
})();
