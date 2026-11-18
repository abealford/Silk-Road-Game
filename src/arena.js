
// ============================================================
//  THE ARENA — combat practice. A colosseum of its own, separate from the world.
//  Time moves only when you move (SUPERHOT-style). Sword, bow or throwing knives; 5 waves.
// ============================================================
(function () {
  const Arena = window.Arena = {};
  const AX = 40, AZ = 26;                 // half-axes of the arena floor (m)
  const OUT_A = 86, OUT_B = 72, TOP = 44;   // outer wall
  const EYE = 1.65, PSPEED = 6.2, G = 13;
  let R, scene, cam, canvas, ui, running = false, last = 0;
  const keys = {}; let yaw = 0, pitch = 0, mouseAcc = 0, locked = false;
  const P = { x: 0, z: 6, y: 0, vy: 0, hp: 3, inv: 0, vx: 0, vz: 0 };
  let weapon = 'sword', tScale = 0.05, state = 'menu', wave = 0, stateT = 0, spawnQ = [], spawnT = 0;
  let enemies = [], projs = [], shards = [], pickups = [], sparks = [];
  let swing = 0, swingHit = false, blocking = false, draw = 0, drawing = false, throwCd = 0, knives = 8, actT = 0, shake = 0, kills = 0;
  let view = null; const obstacles = []; const BOWS = .45; let hadLock = false;
  const rnd = Math.random, lerp = (a, b, t) => a + (b - a) * t, clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------------- textures ----------------
  function canvasTex(w, h, fn, rep) { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; if (rep) t.repeat.set(rep[0], rep[1]); t.anisotropy = 4; return t; }
  const sandTex = () => canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#d9bf8c'; g.fillRect(0, 0, w, h); for (let i = 0; i < 5000; i++) { const v = 170 + rnd() * 70; g.fillStyle = `rgba(${v},${v * .86},${v * .62},.35)`; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2); } for (let i = 0; i < 40; i++) { g.strokeStyle = 'rgba(150,110,60,.12)'; g.beginPath(); const x = rnd() * w, y = rnd() * h; g.ellipse(x, y, 10 + rnd() * 30, 3 + rnd() * 8, rnd() * 3, 0, 6.3); g.stroke(); } }, [10, 7]);
  const crowdTex = () => canvasTex(512, 64, (g, w, h) => { g.fillStyle = '#cdbb98'; g.fillRect(0, 0, w, h); g.fillStyle = '#a89270'; g.fillRect(0, h - 10, w, 10);
    const cols = ['#f1ece0', '#e8e2d2', '#8e2c18', '#b8862a', '#5a6a8a', '#4a6a3a', '#7a4a2a', '#d9d0b8', '#a03a2a', '#e0c890'];
    for (let r = 0; r < 2; r++) for (let x = 3 + r * 7; x < w - 12; x += 13 + rnd() * 5) { if (rnd() < .15) continue; const y = 4 + r * 26 + rnd() * 3; g.fillStyle = cols[(rnd() * cols.length) | 0]; g.fillRect(x, y + 8, 11, 17); g.fillStyle = ['#e3b98c', '#c08a5a', '#8a5a3a', '#f0cda8'][(rnd() * 4) | 0]; g.fillRect(x + 2, y, 7, 8); } });
  const facadeTex = () => canvasTex(256, 512, (g, w, h) => { g.fillStyle = '#d6c4a0'; g.fillRect(0, 0, w, h); for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(${120 + rnd() * 60},${100 + rnd() * 50},${70 + rnd() * 40},.18)`; g.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 6, 1 + rnd() * 3); }
    const rows = [[0.04, 0.3], [0.36, 0.58], [0.64, 0.84]]; for (const [a, b] of rows) { const y0 = h * (1 - b), y1 = h * (1 - a); const aw = w * .52; const x0 = (w - aw) / 2; g.fillStyle = '#3a2a1c'; g.beginPath(); g.moveTo(x0, y1); g.lineTo(x0, y0 + aw / 2); g.arc(w / 2, y0 + aw / 2, aw / 2, Math.PI, 0); g.lineTo(x0 + aw, y1); g.fill();
      g.fillStyle = '#c0ad88'; g.fillRect(0, y0 - 14, w, 10); g.fillRect(x0 - 26, y0 + 10, 16, y1 - y0 - 10); g.fillRect(x0 + aw + 10, y0 + 10, 16, y1 - y0 - 10); }
    g.fillStyle = '#c0ad88'; g.fillRect(0, h * .1, w, 8); for (let x = 30; x < w; x += 100) { g.fillStyle = '#4a3a2a'; g.fillRect(x, h * .02, 30, 22); } });

  // ---------------- the colosseum ----------------
  function ringGeo(levels, fnUV) { // levels: [{a,b,y}] rings; builds a strip between consecutive rings
    const pos = [], uv = [], idx = []; const N = 160; let base = 0;
    for (let L = 0; L < levels.length - 1; L++) { const r0 = levels[L], r1 = levels[L + 1];
      for (let i = 0; i <= N; i++) { const t = i / N * Math.PI * 2; const c = Math.cos(t), s = Math.sin(t);
        pos.push(r0.a * c, r0.y, r0.b * s, r1.a * c, r1.y, r1.b * s); const u = fnUV ? fnUV(i / N) : i / N; uv.push(u, 0, u, 1); }
      for (let i = 0; i < N; i++) { const k = base + i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } base += (N + 1) * 2; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  const mat = (o) => new THREE.MeshLambertMaterial(o);
  function buildArena() {
    scene = new THREE.Scene(); scene.background = new THREE.Color('#bcd6ea'); scene.fog = new THREE.Fog('#d8e2e6', 160, 700);
    const hemi = new THREE.HemisphereLight('#dcecff', '#b39a6c', .85); scene.add(hemi);
    const sun = new THREE.DirectionalLight('#fff3dc', 1.05); sun.position.set(60, 110, 40); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 10, far: 300 }); sun.shadow.bias = -0.0008; scene.add(sun);
    // sky dome
    { const g = new THREE.SphereGeometry(900, 24, 12); const col = []; const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i) / 900; const c = new THREE.Color('#e8eef0').lerp(new THREE.Color('#7fb0dc'), clamp(y * 1.6, 0, 1)); col.push(c.r, c.g, c.b); } g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }))); }
    // the land around
    { const g = new THREE.CircleGeometry(900, 48); g.rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, mat({ color: '#b9ab7a' })); m.position.y = -0.05; m.receiveShadow = true; scene.add(m);
      for (let i = 0; i < 40; i++) { const t = rnd() * 6.28, r = 140 + rnd() * 300; const h = new THREE.Mesh(new THREE.ConeGeometry(30 + rnd() * 50, 8 + rnd() * 25, 7), mat({ color: rnd() < .5 ? '#a8a070' : '#9c9468' })); h.position.set(Math.cos(t) * r, 0, Math.sin(t) * r); scene.add(h); }
      for (let i = 0; i < 70; i++) { const t = rnd() * 6.28, r = 110 + rnd() * 160; const tr = new THREE.Group(); const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.25, .35, 3, 5), mat({ color: '#6a4a2a' })); trunk.position.y = 1.5; const top = new THREE.Mesh(new THREE.ConeGeometry(1.3, 7, 6), mat({ color: '#3f5a2e' })); top.position.y = 6; tr.add(trunk, top); tr.position.set(Math.cos(t) * r, 0, Math.sin(t) * r); scene.add(tr); } }
    // arena floor
    { const g = new THREE.CircleGeometry(1, 96); g.rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, mat({ map: sandTex() })); m.scale.set(AX + 1, 1, AZ + 1); m.position.y = 0.01; m.receiveShadow = true; scene.add(m); }
    // podium wall (with four gates)
    { const L = [{ a: AX + .6, b: AZ + .6, y: 0 }, { a: AX + .6, b: AZ + .6, y: 4.6 }]; const wall = new THREE.Mesh(ringGeo(L, u => u * 40), mat({ map: canvasTex(64, 64, (g) => { g.fillStyle = '#a2895f'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#8c7450'; g.fillRect(0, 30, 64, 3); g.fillRect(30, 0, 3, 30); g.fillRect(0, 62, 64, 2); g.fillRect(10, 33, 3, 30); }), side: THREE.DoubleSide })); wall.receiveShadow = true; scene.add(wall);
      const top = new THREE.Mesh(ringGeo([{ a: AX + .6, b: AZ + .6, y: 4.6 }, { a: AX + 1.6, b: AZ + 1.6, y: 4.6 }]), mat({ color: '#e3d6b8', side: THREE.DoubleSide })); scene.add(top);
      for (const [gx, gz, ry] of gateSpots()) { const gate = new THREE.Group(); const dark = new THREE.Mesh(new THREE.BoxGeometry(4.2, 3.6, .3), mat({ color: '#1e140c' })); dark.position.y = 1.8; const arch = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, .32, 16, 1, false, 0, Math.PI), mat({ color: '#1e140c' })); arch.rotation.set(Math.PI / 2, 0, Math.PI / 2); arch.position.y = 3.6; const frame = new THREE.Mesh(new THREE.BoxGeometry(5.2, .5, .5), mat({ color: '#e3d6b8' })); frame.position.y = 4.4;
        for (let k = -2; k <= 2; k++) { const bar = new THREE.Mesh(new THREE.BoxGeometry(.08, 4, .08), mat({ color: '#3a3430' })); bar.position.set(k * .8, 2.1, .25); gate.add(bar); }
        gate.add(dark, arch, frame); gate.position.set(gx * (1 + .7 / AX), 0, gz * (1 + .7 / AZ)); gate.rotation.y = ry; scene.add(gate); } }
    // seating (cavea), in three belts, and the crowd
    { const lv = []; const n = 14; for (let i = 0; i <= n; i++) { const a = AX + 1.6 + i * 3.15, b = AZ + 1.6 + i * 3.15, y = 4.6 + i * 2.5; lv.push({ a, b, y }); }
      const tread = [], riser = []; for (let i = 0; i < n; i++) { const r0 = lv[i], r1 = lv[i + 1]; tread.push([{ a: r0.a, b: r0.b, y: r0.y }, { a: r1.a, b: r1.b, y: r0.y }]); riser.push([{ a: r1.a, b: r1.b, y: r0.y }, { a: r1.a, b: r1.b, y: r1.y }]); }
      const ct = crowdTex(); const tm = mat({ map: ct, side: THREE.DoubleSide }); const rm = mat({ color: '#bda57c', side: THREE.DoubleSide }); const walk = mat({ color: '#d8c8a4', side: THREE.DoubleSide });
      tread.forEach((L, i) => { const m = new THREE.Mesh(ringGeo(L), (i === 4 || i === 9) ? walk : rm); m.receiveShadow = true; scene.add(m); });
      riser.forEach((L, i) => { const empty = i === 3 || i === 8; const m = new THREE.Mesh(ringGeo(L, u => u * (empty ? 1 : 26 + i * 2)), empty ? mat({ color: '#9a8158', side: THREE.DoubleSide }) : tm); m.receiveShadow = true; scene.add(m); });
      // the emperor's box
      const box = new THREE.Mesh(new THREE.BoxGeometry(10, 3, 4), mat({ color: '#8e2c18' })); box.position.set(0, 5.5, AZ + 3.4); scene.add(box); const can = new THREE.Mesh(new THREE.BoxGeometry(11, .3, 5), mat({ color: '#e8d7a8' })); can.position.set(0, 9.5, AZ + 3.6); scene.add(can);
      for (const x of [-5, 5]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, 4, 6), mat({ color: '#e3d6b8' })); c.position.set(x, 7.5, AZ + 1.8); scene.add(c); }
      // back wall above the top tier, and the outer wall with its arcades
      const lt = lv[n]; scene.add(new THREE.Mesh(ringGeo([{ a: lt.a, b: lt.b, y: lt.y }, { a: lt.a, b: lt.b, y: TOP }]), mat({ color: '#c8b48e', side: THREE.DoubleSide })));
      const fac = facadeTex(); fac.repeat.set(1, 1); const outer = new THREE.Mesh(ringGeo([{ a: lt.a + 2, b: lt.b + 2, y: 0 }, { a: lt.a + 2, b: lt.b + 2, y: TOP }], u => u * 80), mat({ map: fac, side: THREE.DoubleSide })); outer.castShadow = true; scene.add(outer);
      scene.add(new THREE.Mesh(ringGeo([{ a: lt.a, b: lt.b, y: TOP }, { a: lt.a + 2.2, b: lt.b + 2.2, y: TOP }]), mat({ color: '#d6c4a0', side: THREE.DoubleSide })));
      // velarium masts
      for (let i = 0; i < 48; i++) { const t = i / 48 * 6.283; const m = new THREE.Mesh(new THREE.CylinderGeometry(.18, .18, 7, 5), mat({ color: '#6a4a2a' })); m.position.set(Math.cos(t) * (lt.a + 1), TOP + 3.5, Math.sin(t) * (lt.b + 1)); scene.add(m); }
      // banners
      for (let i = 0; i < 16; i++) { const t = i / 16 * 6.283 + .1; const b = new THREE.Mesh(new THREE.PlaneGeometry(2, 5), mat({ color: i % 2 ? '#8e2c18' : '#b8862a', side: THREE.DoubleSide })); b.position.set(Math.cos(t) * (lt.a - .2), TOP - 4, Math.sin(t) * (lt.b - .2)); b.lookAt(0, TOP - 4, 0); scene.add(b); } }
    // columns and crates for cover
    const col = mat({ color: '#e6dcc4' }), wood = mat({ color: '#8a5a32' });
    for (let i = 0; i < 6; i++) { const t = i / 6 * 6.283 + .5; const x = Math.cos(t) * AX * .52, z = Math.sin(t) * AZ * .52; const c = new THREE.Mesh(new THREE.CylinderGeometry(.62, .7, 5.5, 12), col); c.position.set(x, 2.75, z); c.castShadow = c.receiveShadow = true; scene.add(c); const cap = new THREE.Mesh(new THREE.BoxGeometry(1.7, .4, 1.7), col); cap.position.set(x, 5.6, z); cap.castShadow = true; scene.add(cap); obstacles.push({ x, z, r: .75, h: 6 }); }
    for (const [x, z] of [[-16, -10], [17, 9], [-20, 12], [22, -12]]) { for (const [dx, dz, s] of [[0, 0, 1.6], [1.4, .3, 1.2]]) { const c = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), wood); c.position.set(x + dx, s / 2, z + dz); c.rotation.y = rnd(); c.castShadow = c.receiveShadow = true; scene.add(c); } obstacles.push({ x: x + .6, z: z + .1, r: 1.6, h: 1.6 }); }
  }
  function gateSpots() { return [[AX, 0, Math.PI / 2], [-AX, 0, -Math.PI / 2], [0, AZ, 0], [0, -AZ, Math.PI]]; }

  // ---------------- people ----------------
  const ENEMY = {
    brawler: { name: 'Brawler', hp: 1, speed: 3.3, kind: 'melee', wind: .55, reach: 2.4, dmg: 1, tunic: '#a8342a', weapon: 'club' },
    swordsman: { name: 'Swordsman', hp: 1, speed: 3.8, kind: 'melee', wind: .42, reach: 2.6, dmg: 1, tunic: '#8e1f18', weapon: 'sword', helm: '#8a8a88' },
    archer: { name: 'Archer', hp: 1, speed: 3.2, kind: 'archer', wind: 1.25, dmg: 1, tunic: '#b04a2a', weapon: 'bow', cap: '#5a3a1a' },
    thrower: { name: 'Knife-thrower', hp: 1, speed: 4.2, kind: 'thrower', wind: .5, dmg: 1, tunic: '#c0402a', weapon: 'knife', cap: '#2a2a2a' },
    heavy: { name: 'Heavy', hp: 3, speed: 2.5, kind: 'melee', wind: .8, reach: 2.9, dmg: 2, tunic: '#6a1610', weapon: 'axe', helm: '#5a5a58', armour: '#7a7a78', big: 1.18 },
  };
  const WAVES = [
    [['brawler', 3]],
    [['brawler', 3], ['swordsman', 2], ['archer', 1]],
    [['swordsman', 4], ['archer', 2], ['heavy', 1]],
    [['swordsman', 4], ['archer', 3], ['thrower', 2], ['heavy', 1]],
    [['swordsman', 5], ['archer', 3], ['thrower', 3], ['heavy', 3]],
  ];
  function part(w, h, d, color, x, y, z, parent) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat({ color })); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; }
  function limb(w, h, d, color, x, y, z, parent) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); const m = part(w, h, d, color, 0, -h / 2, 0, g); return g; }
  function weaponMesh(kind) { const g = new THREE.Group(); const steel = '#c8ccd0', wood = '#6a4426';
    if (kind === 'sword') { part(.06, .9, .02, steel, 0, .55, 0, g); part(.24, .05, .06, '#8a6a2a', 0, .1, 0, g); part(.05, .18, .05, '#3a2414', 0, 0, 0, g); }
    if (kind === 'club') { part(.12, .8, .12, wood, 0, .4, 0, g); part(.18, .25, .18, '#5a3a1a', 0, .75, 0, g); }
    if (kind === 'axe') { part(.06, 1.2, .06, wood, 0, .6, 0, g); part(.04, .32, .38, steel, 0, 1.05, .14, g); }
    if (kind === 'knife') { part(.04, .26, .02, steel, 0, .2, 0, g); part(.05, .12, .04, '#3a2414', 0, .02, 0, g); }
    if (kind === 'bow') { const a = new THREE.Mesh(new THREE.TorusGeometry(.55, .025, 5, 14, Math.PI * .85), mat({ color: wood })); a.rotation.z = Math.PI / 2 + Math.PI * .075; a.rotation.y = Math.PI / 2; g.add(a); }
    return g; }
  function makeFighter(type) {
    const T = ENEMY[type]; const g = new THREE.Group(); const body = new THREE.Group(); g.add(body); const s = T.big || 1; body.scale.setScalar(s);
    const skin = ['#e3b98c', '#c08a5a', '#a06a42', '#d8a878'][(rnd() * 4) | 0];
    const legL = limb(.2, .85, .22, '#4a3424', -.14, .9, 0, body), legR = limb(.2, .85, .22, '#4a3424', .14, .9, 0, body);
    part(.56, .7, .32, T.tunic, 0, 1.22, 0, body); part(.6, .14, .34, '#3a2414', 0, .92, 0, body); if (T.armour) part(.62, .5, .36, T.armour, 0, 1.3, 0, body);
    part(.3, .32, .3, skin, 0, 1.75, 0, body); part(.05, .04, .02, '#1a1008', -.07, 1.79, .155, body); part(.05, .04, .02, '#1a1008', .07, 1.79, .155, body); if (rnd() < .6) part(.26, .1, .04, ['#2a1a10', '#4a3020', '#1a1a1a'][(rnd() * 3) | 0], 0, 1.63, .15, body); if (T.helm) { part(.36, .2, .36, T.helm, 0, 1.92, 0, body); part(.06, .14, .06, T.helm, 0, 2.06, 0, body); } else if (T.cap) part(.34, .1, .34, T.cap, 0, 1.92, 0, body);
    const armL = limb(.16, .66, .18, T.tunic, -.37, 1.52, 0, body), armR = limb(.16, .66, .18, T.tunic, .37, 1.52, 0, body);
    part(.14, .14, .14, skin, 0, -.7, 0, armL); part(.14, .14, .14, skin, 0, -.7, 0, armR);
    const w = weaponMesh(T.weapon); w.position.set(0, -.72, .05); w.rotation.x = Math.PI / 2; armR.add(w); if (T.weapon === 'bow') { w.position.set(0, -.72, 0); w.rotation.set(0, 0, 0); armL.add(w); }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return { g, body, legL, legR, armL, armR, w, s, skin };
  }

  // ---------------- the player's weapons (view model) ----------------
  function buildView() {
    if (view) cam.remove(view.g); const g = new THREE.Group(); cam.add(g); view = { g };
    const arm = part(.08, .08, .4, '#8e2c18', 0, 0, .1, g); view.arm = arm;
    if (weapon === 'sword') { const s = weaponMesh('sword'); s.scale.setScalar(1.15); g.add(s); view.blade = s; g.position.set(.38, -.36, -.62); s.rotation.set(-.35, 0, -.25); s.position.set(0, .02, -.18); arm.position.set(.02, -.06, .12); }
    if (weapon === 'bow') { arm.visible = false; const b = weaponMesh('bow'); b.scale.setScalar(BOWS); b.rotation.set(0, 0, -.15); g.add(b); view.bow = b; g.position.set(-.1, -.14, -.7);
      const strMat = new THREE.MeshBasicMaterial({ color: '#efe6cf' }); view.s1 = new THREE.Mesh(new THREE.BoxGeometry(.008, .008, 1), strMat); view.s2 = view.s1.clone(); g.add(view.s1, view.s2);
      view.arrow = new THREE.Group(); part(.018, .018, .8, '#8a6a3a', 0, 0, -.2, view.arrow); part(.04, .04, .1, '#9a9a9a', 0, 0, -.62, view.arrow); g.add(view.arrow); }
    if (weapon === 'knives') { const k = weaponMesh('knife'); k.scale.setScalar(1.0); k.rotation.set(-1.2, 0, 0); g.add(k); view.knife = k; g.position.set(.34, -.32, -.55); }
  }
  function updateView(dt) {
    if (!view) return; const g = view.g; const bob = Math.hypot(P.vx, P.vz) > .5 ? Math.sin(performance.now() / 110) * .012 : 0;
    if (weapon === 'sword') { const s = view.blade; if (swing > 0) { const t = 1 - swing / .32; s.rotation.set(-.35 - Math.sin(t * Math.PI) * .6, 0, lerp(-.9, 1.6, t)); s.position.x = lerp(.25, -.55, t); g.position.y = -.36 + bob; }
      else if (blocking) { s.rotation.set(-.2, 0, 1.45); s.position.set(-.3, .18, -.2); }
      else { s.rotation.set(-.35, 0, -.25); s.position.set(0, .02 + bob, -.18); } }
    if (weapon === 'bow') { const pull = draw; const top = new THREE.Vector3(0, .53 * BOWS, -.04), bot = new THREE.Vector3(0, -.53 * BOWS, -.04); const nock = new THREE.Vector3(0, 0, .02 + pull * .25);
      for (const [m, a] of [[view.s1, top], [view.s2, bot]]) { const d = nock.clone().sub(a); m.position.copy(a.clone().add(nock).multiplyScalar(.5)); m.scale.z = d.length(); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.normalize()); }
      view.arrow.visible = drawing || throwCd <= 0; view.arrow.position.set(0, 0, .05 + pull * .42 + .4 - .4); view.arrow.position.z = pull * .25; view.arrow.scale.setScalar(.6); g.position.y = -.22 + bob; }
    if (weapon === 'knives') { const k = view.knife; k.visible = knives > 0; if (throwCd > .2) { const t = (throwCd - .2) / .15; k.position.set(0, .1 * t, .15 * t); } else if (swing > 0) { k.position.set(0, .05, -.35 * Math.sin((1 - swing / .25) * Math.PI)); } else k.position.set(0, bob, 0); }
  }

  // ---------------- input ----------------
  function onKey(e, down) { if (!running) return; keys[e.code] = down; if (down) { if (e.code === 'Escape' || e.code === 'KeyP') { if (state === 'fight' || state === 'intro' || state === 'between') pause(); } if (e.code === 'Space' && P.y <= 0.001) P.vy = 5.4; } if (['Space', 'Tab'].includes(e.code)) e.preventDefault(); }
  function onMouseMove(e) { if (!locked) return; yaw -= e.movementX * .0023; pitch = clamp(pitch - e.movementY * .0023, -1.45, 1.45); mouseAcc += Math.abs(e.movementX) + Math.abs(e.movementY); }
  function onDown(e) { if (!running) return; if (!locked) { if (state === 'fight' || state === 'intro' || state === 'between') canvas.requestPointerLock(); return; } if (state !== 'fight' && state !== 'intro' && state !== 'between') return;
    if (e.button === 0) { if (weapon === 'sword' && swing <= 0 && !blocking) { swing = .32; swingHit = false; actT = .35; } if (weapon === 'bow') { drawing = true; } if (weapon === 'knives' && throwCd <= 0 && knives > 0) throwKnife(); }
    if (e.button === 2) { if (weapon === 'sword') blocking = true; if (weapon === 'knives' && swing <= 0) { swing = .25; swingHit = false; actT = .3; } } }
  function onUp(e) { if (!running) return; if (e.button === 0 && weapon === 'bow' && drawing) { drawing = false; if (draw > .25) fireArrow(); draw = 0; } if (e.button === 2) blocking = false; }

  // ---------------- projectiles ----------------
  function projMesh(kind) { const g = new THREE.Group(); if (kind === 'arrow') { part(.03, .03, .85, '#7a5a32', 0, 0, 0, g); part(.06, .06, .12, '#9a9a9a', 0, 0, -.45, g); part(.08, .005, .14, '#e8e0d0', 0, 0, .38, g); } else { part(.03, .02, .3, '#c8ccd0', 0, 0, -.1, g); part(.05, .04, .12, '#3a2414', 0, 0, .1, g); } scene.add(g); return g; }
  function addProj(kind, owner, pos, vel) { projs.push({ kind, owner, pos: pos.clone(), vel: vel.clone(), m: projMesh(kind), stuck: 0, spin: 0 }); }
  function fwd() { return new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)); }
  function fireArrow() { const f = fwd(); const o = eyePos().add(f.clone().multiplyScalar(.6)); addProj('arrow', 'p', o, f.multiplyScalar(30 + 34 * draw)); throwCd = .35; actT = .45; }
  function throwKnife() { knives--; const f = fwd(); const o = eyePos().add(f.clone().multiplyScalar(.5)); addProj('knife', 'p', o, f.multiplyScalar(36)); throwCd = .35; actT = .4; }
  function eyePos() { return new THREE.Vector3(P.x, P.y + EYE, P.z); }
  function updateProjs(gdt) {
    for (let i = projs.length - 1; i >= 0; i--) { const p = projs[i];
      const steps = Math.max(1, Math.ceil(p.vel.length() * gdt / .25)); let done = false;
      for (let k = 0; k < steps && !done; k++) { const h = gdt / steps; p.vel.y -= (p.kind === 'arrow' ? 6 : 4) * h; p.pos.addScaledVector(p.vel, h);
        if (p.owner === 'p') { for (const e of enemies) { if (e.dead) continue; const cy = 1.0 * e.f.s, hy = 1.6 * e.f.s; const d1 = Math.hypot(p.pos.x - e.x, p.pos.y - cy, p.pos.z - e.z), d2 = Math.hypot(p.pos.x - e.x, p.pos.y - hy, p.pos.z - e.z); if (Math.min(d1, d2) < .5 * e.f.s) { hitEnemy(e, p.kind === 'arrow' ? 2 : 1, p.vel); dropProj(p, i, e); done = true; break; } } }
        else { const by = [P.y + .9, P.y + 1.5]; if (by.some(y => Math.hypot(p.pos.x - P.x, p.pos.y - y, p.pos.z - P.z) < .45)) { const toE = new THREE.Vector3(-p.vel.x, 0, -p.vel.z).normalize(); const f = fwd(); f.y = 0; f.normalize();
            if (weapon === 'sword' && (blocking || swing > 0) && f.dot(toE) > .35) { spark(p.pos); removeProj(i); } else { hurtPlayer(1); removeProj(i); } done = true; break; } }
        if (done) break;
        if (p.pos.y <= .02) { p.pos.y = .02; stick(p, i); done = true; break; }
        for (const o of obstacles) if (Math.hypot(p.pos.x - o.x, p.pos.z - o.z) < o.r && p.pos.y < o.h) { stick(p, i); done = true; break; }
        if (done) break;
        if ((p.pos.x / (AX + .6)) ** 2 + (p.pos.z / (AZ + .6)) ** 2 > 1 && p.pos.y < 4.6) { stick(p, i); done = true; break; }
        if (p.pos.y > 60 || Math.abs(p.pos.x) > 200) { removeProj(i); done = true; break; } }
      if (!done) { { p.m.position.copy(p.pos); const v = p.vel.clone().normalize(); p.m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), v); if (p.kind === 'knife') { p.spin += gdt * 22; p.m.rotateX(p.spin); } } } }
  }
  function removeProj(i) { scene.remove(projs[i].m); projs.splice(i, 1); }
  function stick(p, i) { p.stuck = 1; p.m.position.copy(p.pos); if (p.owner === 'p' && p.kind === 'knife') { pickups.push({ x: p.pos.x, z: p.pos.z, m: p.m }); projs.splice(i, 1); p.m.rotation.set(Math.PI / 2, rnd() * 6, 0); p.m.position.y = .04; } else { setTimeout(() => { scene && scene.remove(p.m); }, 9000); projs.splice(i, 1); } }
  function dropProj(p, i, e) { if (p.kind === 'knife') { p.m.position.set(e.x + (rnd() - .5), .04, e.z + (rnd() - .5)); p.m.rotation.set(Math.PI / 2, rnd() * 6, 0); pickups.push({ x: p.m.position.x, z: p.m.position.z, m: p.m }); projs.splice(i, 1); } else removeProj(i); }
  function spark(pos) { for (let k = 0; k < 10; k++) { const m = new THREE.Mesh(new THREE.BoxGeometry(.05, .05, .05), new THREE.MeshBasicMaterial({ color: '#ffd27a' })); m.position.copy(pos); scene.add(m); sparks.push({ m, v: new THREE.Vector3(rnd() - .5, rnd(), rnd() - .5).multiplyScalar(6), t: .5 }); } }

  // ---------------- enemies ----------------
  function spawnEnemy(type) {
    const gs = gateSpots().map(([x, z]) => [x * .96, z * .96]).sort((a, b) => Math.hypot(b[0] - P.x, b[1] - P.z) - Math.hypot(a[0] - P.x, a[1] - P.z)); const [gx, gz] = gs[(rnd() * 2) | 0];
    const f = makeFighter(type); const e = { type, T: ENEMY[type], f, x: gx + (rnd() - .5) * 2, z: gz + (rnd() - .5) * 2, hp: ENEMY[type].hp, st: 'move', t: 0, cd: rnd() * .8, phase: rnd() * 6, stun: 0, strafe: rnd() < .5 ? 1 : -1 };
    f.g.position.set(e.x, 0, e.z); scene.add(f.g); enemies.push(e); }
  function hitEnemy(e, dmg, dir) { e.hp -= dmg; if (e.hp <= 0) killEnemy(e, dir); else { e.stun = .7; e.st = 'move'; const d = Math.hypot(e.x - P.x, e.z - P.z) || 1; e.x += (e.x - P.x) / d * 1.1; e.z += (e.z - P.z) / d * 1.1; spark(new THREE.Vector3(e.x, 1.3, e.z)); } }
  function killEnemy(e, dir) { e.dead = true; kills++; scene.remove(e.f.g); const cols = [e.T.tunic, e.f.skin, '#4a3424', e.T.helm || e.T.tunic, '#c8ccd0'];
    const push = dir ? new THREE.Vector3(dir.x, 0, dir.z).normalize().multiplyScalar(4) : new THREE.Vector3(e.x - P.x, 0, e.z - P.z).normalize().multiplyScalar(4);
    for (let k = 0; k < 34; k++) { const s = .08 + rnd() * .16; const m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), mat({ color: cols[(rnd() * cols.length) | 0] })); m.position.set(e.x + (rnd() - .5) * .5, .3 + rnd() * 1.7 * e.f.s, e.z + (rnd() - .5) * .5); m.castShadow = true; scene.add(m);
      shards.push({ m, v: new THREE.Vector3((rnd() - .5) * 5, rnd() * 5, (rnd() - .5) * 5).add(push), r: new THREE.Vector3(rnd() * 8, rnd() * 8, rnd() * 8), life: 14 }); } }
  function hurtPlayer(n) { if (P.inv > 0 || state !== 'fight') return; P.hp -= n; P.inv = 1; shake = .35; flash('rgba(160,20,10,.45)'); if (P.hp <= 0) die(); }
  function separation(e) { let sx = 0, sz = 0; for (const o of enemies) { if (o === e || o.dead) continue; const dx = e.x - o.x, dz = e.z - o.z, d = Math.hypot(dx, dz); if (d < 1.2 && d > 0) { sx += dx / d * (1.2 - d); sz += dz / d * (1.2 - d); } } return [sx, sz]; }
  function moveEnemy(e, dx, dz, sp, gdt) { const d = Math.hypot(dx, dz) || 1; let mx = dx / d * sp * gdt, mz = dz / d * sp * gdt; const [sx, sz] = separation(e); mx += sx * gdt * 4; mz += sz * gdt * 4;
    let nx = e.x + mx, nz = e.z + mz; for (const o of obstacles) { const ox = nx - o.x, oz = nz - o.z, od = Math.hypot(ox, oz); if (od < o.r + .45) { nx = o.x + ox / od * (o.r + .45); nz = o.z + oz / od * (o.r + .45); } }
    const k = (nx / (AX - .8)) ** 2 + (nz / (AZ - .8)) ** 2; if (k > 1 && !e.entering) { const s = 1 / Math.sqrt(k); nx *= s; nz *= s; } e.x = nx; e.z = nz; return Math.hypot(mx, mz); }
  function lineOfSight(x0, z0, x1, z1) { for (const o of obstacles) { if (o.h < 1.7) continue; const dx = x1 - x0, dz = z1 - z0; const L2 = dx * dx + dz * dz; const t = clamp(((o.x - x0) * dx + (o.z - z0) * dz) / L2, 0, 1); if (Math.hypot(x0 + dx * t - o.x, z0 + dz * t - o.z) < o.r) return false; } return true; }
  function updateEnemies(gdt) {
    for (const e of enemies) { if (e.dead) continue; const T = e.T; const dx = P.x - e.x, dz = P.z - e.z, d = Math.hypot(dx, dz); let moved = 0; e.cd -= gdt; e.stun -= gdt;
      if ((e.x / AX) ** 2 + (e.z / AZ) ** 2 < .95) e.entering = false; else if (e.entering === undefined) e.entering = true;
      if (e.stun > 0) { e.f.armR.rotation.x = .4; }
      else if (T.kind === 'melee') {
        if (e.st === 'move') { if (d > 1.7) moved = moveEnemy(e, dx, dz, T.speed, gdt); if (d < T.reach - .3 && e.cd <= 0) { e.st = 'wind'; e.t = T.wind; } e.f.armR.rotation.x = 0; }
        else if (e.st === 'wind') { e.t -= gdt; e.f.armR.rotation.x = -2.6 * (1 - e.t / T.wind); if (d > 1.6) moved = moveEnemy(e, dx, dz, T.speed * .35, gdt); if (e.t <= 0) { e.st = 'strike'; e.t = .18; } }
        else if (e.st === 'strike') { e.t -= gdt; e.f.armR.rotation.x = -2.6 + 3.4 * (1 - e.t / .18); if (e.t <= 0) { if (d < T.reach) { const f = fwd(); f.y = 0; f.normalize(); const toE = new THREE.Vector3(-dx, 0, -dz).normalize(); if (weapon === 'sword' && blocking && f.dot(toE) > .4) { spark(new THREE.Vector3(P.x - dx / d * .8, 1.4, P.z - dz / d * .8)); e.stun = .9; } else hurtPlayer(T.dmg); } e.st = 'move'; e.cd = .9 + rnd() * .4; } }
      } else { // archers and knife-throwers keep their distance
        const [near, far] = T.kind === 'archer' ? [12, 22] : [7, 13]; const los = lineOfSight(e.x, e.z, P.x, P.z);
        if (e.st === 'move') { if (d < near) moved = moveEnemy(e, -dx, -dz, T.speed * .9, gdt); else if (d > far || !los) moved = moveEnemy(e, dx, dz, T.speed, gdt); else moved = moveEnemy(e, -dz * e.strafe, dx * e.strafe, T.speed * .45, gdt);
          if (rnd() < gdt * .3) e.strafe *= -1; if (e.cd <= 0 && d < far + 4 && los) { e.st = 'aim'; e.t = T.wind; } e.f.armL.rotation.x = 0; e.f.armR.rotation.x = 0; }
        else if (e.st === 'aim') { e.t -= gdt; if (T.kind === 'archer') { e.f.armL.rotation.x = -1.5; e.f.armR.rotation.x = -1.5 + (1 - e.t / T.wind) * .3; } else e.f.armR.rotation.x = -2.8 * (1 - e.t / T.wind);
          if (e.t <= 0) { const sp = T.kind === 'archer' ? 26 : 24; const from = new THREE.Vector3(e.x, 1.55 * e.f.s, e.z); const tgt = new THREE.Vector3(P.x + P.vx * d / sp * .5, P.y + 1.3, P.z + P.vz * d / sp * .5); const v = tgt.sub(from); const tt = v.length() / sp; v.normalize().multiplyScalar(sp); v.y += (T.kind === 'archer' ? 6 : 4) * tt * .5;
            from.addScaledVector(v.clone().normalize(), .6); addProj(T.kind === 'archer' ? 'arrow' : 'knife', 'e', from, v); e.st = 'move'; e.cd = (T.kind === 'archer' ? 1.6 : 1.3) + rnd() * .8; } } }
      // walk animation and facing
      e.phase += moved * 3.2; const sw = Math.sin(e.phase) * .6 * Math.min(1, moved / (gdt * T.speed * .5 + 1e-6)); e.f.legL.rotation.x = sw; e.f.legR.rotation.x = -sw; if (e.st === 'move' && T.kind === 'melee') e.f.armL.rotation.x = -sw * .6;
      e.f.g.position.set(e.x, 0, e.z); e.f.g.rotation.y = Math.atan2(dx, dz); }
  }

  // ---------------- waves ----------------
  function startWave(n) { wave = n; state = 'intro'; stateT = 2.2; banner(`Wave ${n}`, WAVES[n - 1].map(([t, c]) => `${c} ${ENEMY[t].name.toLowerCase()}${c > 1 ? 's' : ''}`).join(' · ')); spawnQ = []; for (const [t, c] of WAVES[n - 1]) for (let k = 0; k < c; k++) spawnQ.push(t); spawnQ.sort(() => rnd() - .5); spawnT = 0; }
  function updateWaves(dt, gdt) {
    if (state === 'intro') { stateT -= dt; if (stateT <= 0) { state = 'fight'; banner(''); } }
    if (state === 'fight') { spawnT -= gdt; if (spawnQ.length && spawnT <= 0) { spawnEnemy(spawnQ.shift()); spawnT = .9; }
      if (!spawnQ.length && enemies.every(e => e.dead)) { enemies = []; if (wave >= WAVES.length) return win(); state = 'between'; stateT = 3.2; P.hp = Math.min(3, P.hp + 1); banner('Wave cleared', wave < WAVES.length ? 'You catch your breath (+1 heart)' : ''); } }
    if (state === 'between') { stateT -= dt; if (stateT <= 0) startWave(wave + 1); }
  }

  // ---------------- the player ----------------
  function updatePlayer(dt) {
    const f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), s = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0); let vx = 0, vz = 0;
    if (f || s) { const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw); vx = fx * f + rx * s; vz = fz * f + rz * s; const l = Math.hypot(vx, vz); vx = vx / l * PSPEED * (blocking ? .5 : 1); vz = vz / l * PSPEED * (blocking ? .5 : 1); }
    if (state === 'dead' || state === 'won' || state === 'menu') vx = vz = 0;
    let nx = P.x + vx * dt, nz = P.z + vz * dt; for (const o of obstacles) { const ox = nx - o.x, oz = nz - o.z, od = Math.hypot(ox, oz); if (od < o.r + .4 && P.y < o.h) { nx = o.x + ox / od * (o.r + .4); nz = o.z + oz / od * (o.r + .4); } }
    const k = (nx / (AX - .6)) ** 2 + (nz / (AZ - .6)) ** 2; if (k > 1) { const sc = 1 / Math.sqrt(k); nx *= sc; nz *= sc; }
    P.vx = (nx - P.x) / Math.max(dt, 1e-4); P.vz = (nz - P.z) / Math.max(dt, 1e-4); P.x = nx; P.z = nz;
    P.vy -= G * dt; P.y = Math.max(0, P.y + P.vy * dt); if (P.y === 0) P.vy = 0;
    P.inv -= dt; throwCd -= dt * Math.max(.3, tScale); if (swing > 0) { swing -= dt * Math.max(.6, tScale); } actT -= dt;
    if (drawing) { draw = Math.min(1, draw + dt * 1.6); actT = Math.max(actT, .05); }
    // the sword's swing (and the knife's stab) hits at mid-stroke, and cuts arrows from the air
    if (swing > 0 && !swingHit && swing < (weapon === 'sword' ? .2 : .15)) { swingHit = true; const ff = fwd(); ff.y = 0; ff.normalize(); const reach = weapon === 'sword' ? 2.9 : 2.0;
      for (const e of enemies) { if (e.dead) continue; const vx2 = e.x - P.x, vz2 = e.z - P.z, d = Math.hypot(vx2, vz2); if (d < reach * (e.f.s) && (vx2 * ff.x + vz2 * ff.z) / d > .42) hitEnemy(e, 1, new THREE.Vector3(vx2, 0, vz2)); } }
    if (weapon === 'sword' && (swing > 0 || blocking)) { const ff = fwd(); ff.y = 0; ff.normalize(); for (let i = projs.length - 1; i >= 0; i--) { const p = projs[i]; if (p.owner !== 'e') continue; const dx = p.pos.x - P.x, dz = p.pos.z - P.z, d = Math.hypot(dx, dz); if (d < (swing > 0 ? 3.2 : 1.6) && (dx * ff.x + dz * ff.z) / d > .3) { spark(p.pos); removeProj(i); } } }
    // pick up thrown knives
    if (weapon === 'knives') for (let i = pickups.length - 1; i >= 0; i--) { const q = pickups[i]; if (Math.hypot(q.x - P.x, q.z - P.z) < 1.6) { knives++; scene.remove(q.m); pickups.splice(i, 1); } }
    return Math.hypot(vx, vz) > .1 || P.y > 0;
  }
  function updateTime(dt, moving) {
    let tgt = .04; if (moving) tgt = 1; const look = Math.min(.45, mouseAcc * .006); mouseAcc = 0; tgt = Math.max(tgt, look); if (actT > 0 || drawing) tgt = Math.max(tgt, .7);
    if (state === 'intro' || state === 'between') tgt = 1; if (state === 'dead' || state === 'won') tgt = .02;
    tScale += (tgt - tScale) * Math.min(1, dt * (tgt > tScale ? 14 : 7)); return dt * tScale;
  }

  // ---------------- frame ----------------
  function frame() {
    if (!running) return; requestAnimationFrame(frame); const now = performance.now(); const dt = Math.min(.05, (now - last) / 1000); last = now;
    const paused = state === 'menu' || state === 'paused';
    if (!paused) { const moving = updatePlayer(dt); const gdt = updateTime(dt, moving);
      updateEnemies(gdt); updateProjs(gdt); updateWaves(dt, gdt);
      for (let i = shards.length - 1; i >= 0; i--) { const s = shards[i]; s.life -= dt; s.v.y -= 12 * gdt; s.m.position.addScaledVector(s.v, gdt); if (s.m.position.y < .05) { s.m.position.y = .05; s.v.multiplyScalar(.6); s.v.y = Math.abs(s.v.y) * .3; } else { s.m.rotation.x += s.r.x * gdt; s.m.rotation.y += s.r.y * gdt; } if (s.life < 0) { scene.remove(s.m); shards.splice(i, 1); } }
      for (let i = sparks.length - 1; i >= 0; i--) { const s = sparks[i]; s.t -= dt; s.m.position.addScaledVector(s.v, dt); if (s.t < 0) { scene.remove(s.m); sparks.splice(i, 1); } } }
    shake = Math.max(0, shake - dt); cam.position.set(P.x + (rnd() - .5) * shake * .3, P.y + EYE, P.z + (rnd() - .5) * shake * .3); cam.rotation.set(pitch, yaw, 0, 'YXZ');
    updateView(dt); hud(); R.render(scene, cam);
  }

  // ---------------- interface ----------------
  const $ = id => document.getElementById(id);
  function buildUI() {
    const st = document.createElement('style'); st.textContent = `
      #arena-ui { position:fixed; inset:0; z-index:60; pointer-events:none; font-family:var(--book, Georgia, serif); color:#2b1a0e; }
      #arena-ui .ax { position:absolute; left:50%; top:50%; width:6px; height:6px; margin:-3px; border-radius:50%; background:rgba(255,255,255,.85); box-shadow:0 0 0 1.5px rgba(0,0,0,.45); }
      #arena-ui .hearts { position:absolute; left:18px; top:16px; font-size:30px; color:#a8201a; text-shadow:0 1px 3px rgba(0,0,0,.4); letter-spacing:4px; }
      #arena-ui .wave { position:absolute; left:50%; top:14px; transform:translateX(-50%); padding:4px 16px; background:rgba(247,236,211,.7); border:1px solid rgba(122,31,18,.35); border-radius:3px; font-size:16px; }
      #arena-ui .wpn { position:absolute; right:18px; bottom:18px; padding:6px 14px; background:rgba(247,236,211,.7); border:1px solid rgba(122,31,18,.35); border-radius:3px; font-size:15px; text-align:right; }
      #arena-ui .time { position:absolute; left:50%; bottom:22px; width:240px; margin-left:-120px; height:6px; background:rgba(0,0,0,.25); border-radius:3px; overflow:hidden; } #arena-ui .time div { height:100%; background:#f3e7cc; }
      #arena-ui .tlabel { position:absolute; left:50%; bottom:32px; transform:translateX(-50%); font-size:12px; letter-spacing:.2em; color:#fff; text-shadow:0 1px 2px #000; text-transform:uppercase; }
      #arena-ui .vig { position:absolute; inset:0; box-shadow:inset 0 0 160px rgba(255,255,255,.9); opacity:0; transition:opacity .15s; }
      #arena-ui .flash { position:absolute; inset:0; opacity:0; transition:opacity .4s; }
      #arena-ui .ban { position:absolute; left:0; right:0; top:30%; text-align:center; color:#fff; text-shadow:0 2px 8px rgba(0,0,0,.6); }
      #arena-ui .ban b { display:block; font-family:Cinzel, var(--book); font-size:54px; letter-spacing:.18em; text-transform:uppercase; } #arena-ui .ban span { font-size:20px; font-style:italic; }
      #arena-ui .menu { position:absolute; inset:0; display:none; align-items:center; justify-content:center; background:rgba(30,20,10,.45); pointer-events:auto; }
      #arena-ui .menu.show { display:flex; }
      #arena-ui .card { width:min(860px, 92vw); padding:22px 26px; background:rgba(247,236,211,.96); border:1px solid #7a1f12; box-shadow:0 10px 30px rgba(0,0,0,.4); border-radius:3px; }
      #arena-ui h1 { font-family:var(--script, Cinzel), Cinzel, serif; color:#7a1f12; font-size:40px; margin:0 0 2px; font-weight:normal; } #arena-ui .sub { font-style:italic; margin-bottom:14px; }
      #arena-ui .wps { display:flex; gap:12px; margin:12px 0; } #arena-ui .wp { flex:1; padding:12px 14px; border:1px solid rgba(122,31,18,.35); border-radius:3px; cursor:pointer; background:rgba(255,255,255,.35); }
      #arena-ui .wp.on { border:2px solid #7a1f12; background:rgba(201,164,74,.22); } #arena-ui .wp b { font-family:Cinzel, var(--book); color:#7a1f12; font-size:18px; letter-spacing:.06em; } #arena-ui .wp p { margin:6px 0 0; font-size:14px; }
      #arena-ui .btns { display:flex; gap:10px; justify-content:flex-end; margin-top:12px; } #arena-ui button { font-family:var(--book); font-size:16px; padding:8px 18px; border:1px solid #5a1408; background:#7a1f12; color:#f7ecd3; border-radius:3px; cursor:pointer; } #arena-ui button.q { background:transparent; color:#7a1f12; }
      #arena-ui .how { font-size:14px; columns:2; margin-top:6px; } #arena-ui .how div { margin:2px 0; }`;
    document.head.appendChild(st);
    ui = document.createElement('div'); ui.id = 'arena-ui'; ui.innerHTML = `<div class="vig"></div><div class="flash"></div><div class="ax"></div><div class="hearts"></div><div class="wave"></div><div class="wpn"></div><div class="tlabel">time</div><div class="time"><div></div></div><div class="ban"><b></b><span></span></div>
      <div class="menu" id="ar-menu"><div class="card"><h1>The Arena</h1><div class="sub">A practice colosseum, apart from the Silk Road. Time moves only when you move.</div>
        <div class="wps">
          <div class="wp" data-w="sword"><b>Sword</b><p>Click to swing; it cuts down any foe in reach, and strikes arrows out of the air. Hold the right button to block blows and arrows from the front.</p></div>
          <div class="wp" data-w="bow"><b>Bow</b><p>Hold to draw, release to loose. A full draw flies flatter and fells even a heavy in two shots. Endless arrows.</p></div>
          <div class="wp" data-w="knives"><b>Throwing knives</b><p>Click to throw; one knife, one kill. You carry 8: walk over thrown knives to pick them up. Right-click to stab.</p></div></div>
        <div class="how"><div><b>WASD</b> move · <b>Space</b> jump</div><div><b>Mouse</b> aim · turning moves time a little</div><div>Stand still and the world almost stops</div><div><b>Esc</b> pause</div><div>Five waves: brawlers, swordsmen, archers, knife-throwers, heavies</div><div>Three hearts; you regain one after each wave</div></div>
        <div class="btns"><button class="q" id="ar-leave">Leave the arena</button><button id="ar-go">Enter the arena</button></div></div></div>
      <div class="menu" id="ar-end"><div class="card"><h1 id="ar-end-t"></h1><div class="sub" id="ar-end-s"></div><div class="btns"><button class="q" id="ar-leave2">Leave the arena</button><button class="q" id="ar-pick">Choose another weapon</button><button id="ar-again">Fight again</button></div></div></div>
      <div class="menu" id="ar-pause"><div class="card"><h1>Paused</h1><div class="btns"><button class="q" id="ar-leave3">Leave the arena</button><button class="q" id="ar-restart">Restart</button><button id="ar-resume">Resume</button></div></div></div>`;
    document.body.appendChild(ui);
    ui.querySelectorAll('.wp').forEach(w => w.onclick = () => { weapon = w.dataset.w; ui.querySelectorAll('.wp').forEach(x => x.classList.toggle('on', x === w)); });
    $('ar-go').onclick = () => begin(); $('ar-again').onclick = () => begin(); $('ar-pick').onclick = () => showMenu(); $('ar-restart').onclick = () => begin(); $('ar-resume').onclick = () => { $('ar-pause').classList.remove('show'); state = pausedFrom; canvas.requestPointerLock(); };
    for (const id of ['ar-leave', 'ar-leave2', 'ar-leave3']) $(id).onclick = () => location.reload();
  }
  let pausedFrom = 'fight';
  function pause() { pausedFrom = state; state = 'paused'; if (document.pointerLockElement) document.exitPointerLock(); $('ar-pause').classList.add('show'); }
  function showMenu() { state = 'menu'; $('ar-end').classList.remove('show'); $('ar-pause').classList.remove('show'); $('ar-menu').classList.add('show'); ui.querySelectorAll('.wp').forEach(x => x.classList.toggle('on', x.dataset.w === weapon)); if (document.pointerLockElement) document.exitPointerLock(); }
  function banner(t, s) { ui.querySelector('.ban b').textContent = t || ''; ui.querySelector('.ban span').textContent = s || ''; }
  function flash(c) { const f = ui.querySelector('.flash'); f.style.transition = 'none'; f.style.background = c; f.style.opacity = 1; requestAnimationFrame(() => { f.style.transition = 'opacity .5s'; f.style.opacity = 0; }); }
  function hud() { ui.querySelector('.hearts').textContent = '♥'.repeat(Math.max(0, P.hp)) + '♡'.repeat(Math.max(0, 3 - P.hp));
    const alive = enemies.filter(e => !e.dead).length + spawnQ.length; ui.querySelector('.wave').innerHTML = state === 'menu' ? 'The Arena' : `Wave <b>${wave}</b> / ${WAVES.length} · ${alive} ${alive === 1 ? 'foe' : 'foes'} left`;
    ui.querySelector('.wpn').innerHTML = weapon === 'sword' ? '<b>Sword</b><br>click strike · right-click block' : weapon === 'bow' ? `<b>Bow</b><br>${drawing ? 'drawn ' + Math.round(draw * 100) + '%' : 'hold to draw'}` : `<b>Throwing knives</b><br>${knives} left · right-click stab`;
    ui.querySelector('.time div').style.width = Math.round(tScale * 100) + '%'; ui.querySelector('.vig').style.opacity = state === 'fight' ? (1 - tScale) * .35 : 0; }
  function begin() {
    for (const e of enemies) scene.remove(e.f.g); for (const p of projs) scene.remove(p.m); for (const s of shards) scene.remove(s.m); for (const q of pickups) scene.remove(q.m);
    enemies = []; projs = []; shards = []; pickups = []; Object.assign(P, { x: 0, z: 6, y: 0, vy: 0, hp: 3, inv: 0 }); yaw = 0; pitch = 0; knives = 8; kills = 0; swing = 0; draw = 0; drawing = false; blocking = false;
    buildView(); $('ar-menu').classList.remove('show'); $('ar-end').classList.remove('show'); $('ar-pause').classList.remove('show'); canvas.requestPointerLock(); startWave(1); }
  function die() { state = 'dead'; banner(''); setTimeout(() => { if (document.pointerLockElement) document.exitPointerLock(); $('ar-end-t').textContent = 'You have fallen'; $('ar-end-s').textContent = `Wave ${wave} of ${WAVES.length} · ${kills} ${kills === 1 ? 'foe' : 'foes'} defeated with the ${weapon === 'knives' ? 'throwing knives' : weapon}.`; $('ar-end').classList.add('show'); }, 1200); }
  function win() { state = 'won'; banner('Victory', ''); setTimeout(() => { if (document.pointerLockElement) document.exitPointerLock(); $('ar-end-t').textContent = 'Victory!'; $('ar-end-s').textContent = `All five waves defeated: ${kills} foes, with ${P.hp} ${P.hp === 1 ? 'heart' : 'hearts'} to spare. The crowd is on its feet.`; $('ar-end').classList.add('show'); }, 1500); }

  // ---------------- start ----------------
  Arena.start = function () {
    if (running) return; running = true; window.__arenaOn = true;
    const intro = document.getElementById('intro'); if (intro) intro.classList.add('hide'); for (const c of document.querySelectorAll('canvas')) if (!c.closest('#arena-ui')) c.style.display = 'none';
    for (const id of ['hud']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    R = new THREE.WebGLRenderer({ antialias: true }); R.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); R.setSize(innerWidth, innerHeight); R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap; R.outputColorSpace = THREE.SRGBColorSpace;
    canvas = R.domElement; canvas.style.cssText = 'position:fixed;inset:0;z-index:50'; document.body.appendChild(canvas);
    cam = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, .05, 2500); buildArena(); scene.add(cam); buildUI();
    addEventListener('resize', () => { R.setSize(innerWidth, innerHeight); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); });
    document.addEventListener('keydown', e => onKey(e, true)); document.addEventListener('keyup', e => onKey(e, false));
    document.addEventListener('mousemove', onMouseMove); canvas.addEventListener('mousedown', onDown); document.addEventListener('mouseup', onUp); canvas.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === canvas; if (locked) hadLock = true; if (!locked && hadLock && (state === 'fight' || state === 'intro' || state === 'between')) pause(); });
    showMenu(); weapon = 'sword'; ui.querySelector('.wp[data-w="sword"]').classList.add('on'); last = performance.now(); frame();
  };
  Arena.debug = () => ({ swinging: swing > 0, state, wave, tScale, P, enemies: enemies.filter(e => !e.dead).map(e => [e.type, e.x.toFixed(1), e.z.toFixed(1), e.st]), projs: projs.length, knives, kills, set: (k, v) => { if (k === 'weapon') weapon = v; if (k === 'yaw') yaw = v; if (k === 'pitch') pitch = v; if (k === 'hp') P.hp = v; if (k === 'pos') { P.x = v[0]; P.z = v[1]; } }, begin, swingNow: () => { swing = .32; swingHit = false; actT = .35; }, fire: d => { draw = d; fireArrow(); draw = 0; }, throwK: throwKnife, keys,
    // test helper: run the game for `secs` without rendering; ai(d) may steer the player each step
    sim: (secs, ai) => { for (let t = 0; t < secs; t += .05) { if (ai) ai(); const moving = updatePlayer(.05); const gdt = updateTime(.05, moving); updateEnemies(gdt); updateProjs(gdt); updateWaves(.05, gdt); if (state === 'dead' || state === 'won') break; } },
    face: (x, z) => { yaw = Math.atan2(-(x - P.x), -(z - P.z)); } });
})();

