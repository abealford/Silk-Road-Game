// ============================================================
//  The mockup page: one street per culture, Today vs Kit, time of day
// ============================================================
const canvas = document.getElementById('c');
const R = new THREE.WebGLRenderer({ canvas, antialias: true });
R.setPixelRatio(Math.min(devicePixelRatio, 2)); R.setSize(innerWidth, innerHeight);
R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.0;
makeMaterials(R);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.1, 1500);
scene.fog = new THREE.Fog(0xe8d3b0, 60, 520);
addEventListener('resize', () => { R.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
const hemi = new THREE.HemisphereLight(0xbcd4e6, 0xb98a5a, 1.75); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe2b0, 3.0); scene.add(sun); scene.add(sun.target);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 400 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
const skyU = { zen: { value: new THREE.Color(0x5b8fc9) }, hor: { value: new THREE.Color(0xf3d9b0) } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(1200, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: 'uniform vec3 zen; uniform vec3 hor; varying vec3 vP; void main(){ float t = pow(clamp(vP.y,0.0,1.0),0.55); gl_FragColor = vec4(mix(hor,zen,t),1.0); \n#include <colorspace_fragment>\n }',
}));
scene.add(sky);
const POOL = []; for (let i = 0; i < 12; i++) { const l = new THREE.PointLight(0xffa04a, 0, 9, 2); scene.add(l); POOL.push(l); }   // a fixed light count keeps shaders stable

const state = { t: .35, mode: 'kit', C: null, lights: [], stats: {} };
let gCommon = new THREE.Group(), gToday = new THREE.Group(), gKit = new THREE.Group();
function dispose(g) { scene.remove(g); g.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
function buildCulture(id) {
  const C = CULTURES.find(c => c.id === id) || CULTURES[0]; state.C = C;
  for (const g of [gCommon, gToday, gKit]) dispose(g);
  gCommon = new THREE.Group(); gToday = new THREE.Group(); gKit = new THREE.Group();
  const lots = makeLots(C), r = rng32(7);
  // shared scenery: paving, ground, a landmark closing the street, trees, simpler houses behind
  const common = new Kit(), cb = new BLD.Builder(); cb.rng = rng32(11);
  common.box(0, -.06, 0, 112, .06, C.hw * 2, C.pave, C.paveT);
  if (C.pave === 'flags') common.box(0, -.07, 0, 112, .06, .5, 'setts', 0xa89c88);
  if (lots.lane) common.box((lots.lane.x0 + lots.lane.x1) / 2, -.06, -C.hw - 12, lots.lane.x1 - lots.lane.x0, .06, 24, C.pave === 'flags' ? 'setts' : C.pave, C.paveT);
  common.box(0, -.1, 0, 600, .06, 600, C.ground, C.groundT);
  cb.setSurf(SURF.WALL[C.look] || 'plaster');
  cb.push(56, -.05, 0, -Math.PI / 2, 1.8); BLD.CIVIC[C.civic](cb, rng32(3), C.cul); cb.pop();
  for (const [x, z] of [[48, 7], [48, -7], [-48, 6], [52, 11], [52, -11]]) common.tree(x, z, C.tree, 1);
  const maxD = Math.max(...lots.map(L => L.d));
  for (const side of [-1, 1]) for (let x = -50; x < 48; x += 6 + r() * 3) {
    const z = side * (C.hw + maxD + 3 + r() * 3); cb.push(x, -.05, z, side > 0 ? Math.PI : 0); cb.setSurf(C.cul === 'mongol' || C.cul === 'steppe' ? 'felt' : SURF.houseWall(C.look, r));
    BLD.house(cb, C.cul === 'mongol' ? 'central' : C.cul, r, 'mock'); cb.pop();
  }
  const bc = new Buckets(); for (const p of common.parts) bc.addPart(p); bc.addBuilder(cb.geometry(), BUILD_ORDER); bc.toGroup(gCommon);
  // today and the kit, lot by lot
  const bt = new BLD.Builder(), kk = new Kit();
  for (const L of lots) {
    const f = lotFrame(C, L);
    bt.push(f[0], -.05, f[2], f[3]); todayLot(bt, C, L); bt.pop();
    kk.push(...f); kitLot(kk, C, L); kk.pop();
  }
  const btk = new Buckets(); btk.addBuilder(bt.geometry(), BUILD_ORDER); const triT = btk.toGroup(gToday);
  const triK = bakeKit(kk, gKit);
  scene.add(gCommon, gToday, gKit);
  state.lights = kk.lights.filter(p => p.x > -40 && p.x < 20).slice(0, POOL.length);
  POOL.forEach((l, i) => { if (state.lights[i]) l.position.copy(state.lights[i]); });
  const nb = lots.length; state.stats = { houses: nb, today: triT, kit: triK };
  document.getElementById('stats').textContent = `${nb} buildings · about ${Math.round(triT / nb)} triangles each today, ${Math.round(triK / nb)} with the kit`;
  document.getElementById('cul').value = C.id;
  try { history.replaceState(null, '', '#' + C.id); } catch (e) {}
  setMode(state.mode);
}

// ---------- time of day ----------
const KEYS = [
  { t: 0, el: 14, az: 2.1, sun: 0xffcf98, si: 2.3, hs: 0xb4cbe0, hg: 0xa98060, hi: 1.25, fog: 0xe6cfb0, zen: 0x6d9ccf, hor: 0xf2d6b0, lit: 0, exp: 1.0 },
  { t: .35, el: 58, az: 2.6, sun: 0xffe2b0, si: 3.0, hs: 0xbcd4e6, hg: 0xb98a5a, hi: 1.75, fog: 0xe8d3b0, zen: 0x5b8fc9, hor: 0xf3d9b0, lit: 0, exp: 1.0 },
  { t: .7, el: 5, az: 3.9, sun: 0xff9a52, si: 1.7, hs: 0x9a8cb2, hg: 0x7a5a48, hi: .85, fog: 0xc99474, zen: 0x46659a, hor: 0xf09a5a, lit: .55, exp: 1.05 },
  { t: 1, el: 38, az: 1.2, sun: 0x8fa8dc, si: .32, hs: 0x4a5f8e, hg: 0x221f2a, hi: .6, fog: 0x161d2e, zen: 0x0b1428, hor: 0x223052, lit: 1, exp: 1.2 },
];
const ca = new THREE.Color(), cb2 = new THREE.Color();
const lerpC = (a, b, f, out) => out.copy(ca.set(a)).lerp(cb2.set(b), f);
function setTime(t) {
  let i = 0; while (i < KEYS.length - 2 && t > KEYS[i + 1].t) i++;
  const A = KEYS[i], B = KEYS[i + 1], f = sm(0, 1, (t - A.t) / (B.t - A.t)), Lr = (a, b) => a + (b - a) * f;
  const el = Lr(A.el, B.el) * Math.PI / 180, az = Lr(A.az, B.az);
  sun.position.set(Math.cos(el) * Math.cos(az) * 150, Math.sin(el) * 150, Math.cos(el) * Math.sin(az) * 150);
  lerpC(A.sun, B.sun, f, sun.color); sun.intensity = Lr(A.si, B.si);
  lerpC(A.hs, B.hs, f, hemi.color); lerpC(A.hg, B.hg, f, hemi.groundColor); hemi.intensity = Lr(A.hi, B.hi);
  lerpC(A.fog, B.fog, f, scene.fog.color); lerpC(A.zen, B.zen, f, skyU.zen.value); lerpC(A.hor, B.hor, f, skyU.hor.value);
  R.toneMappingExposure = Lr(A.exp, B.exp);
  const lit = Lr(A.lit, B.lit);
  MAT.lit.emissiveIntensity = lit * 2.0; MAT.paper.emissiveIntensity = lit * 1.6; MAT.glow.opacity = lit * .5;
  POOL.forEach((l, i) => { l.intensity = gKit.visible && state.lights[i] ? lit * 3.2 : 0; });
  state.t = t;
}
function setMode(m) {
  state.mode = m; gKit.visible = m === 'kit'; gToday.visible = m === 'today';
  for (const b of document.querySelectorAll('#mode button')) b.classList.toggle('on', b.dataset.m === m);
  setTime(state.t);
}

// ---------- camera ----------
const cam = { pos: new V3(-30, 1.7, 0), yaw: -Math.PI / 2, pitch: 0 };
function lookAt(p, q) { cam.pos.copy(p); const d = new V3().subVectors(q, p).normalize(); cam.yaw = Math.atan2(-d.x, -d.z); cam.pitch = Math.asin(d.y); }
const VIEWS = {
  street: () => lookAt(new V3(-34, 1.7, .6), new V3(10, 3.2, -.4)),
  left: () => lookAt(new V3(-17, 1.75, state.C.hw - 1.6), new V3(-11, 3.4, -state.C.hw - 3)),
  right: () => lookAt(new V3(-2, 1.75, -state.C.hw + 1.6), new V3(4, 3.4, state.C.hw + 3)),
  above: () => lookAt(new V3(-46, 16, 8), new V3(-12, 1, 0)),
};
function setView(v) { VIEWS[v](); }
let drag = null;
canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', e => { if (!drag) return; cam.yaw -= (e.clientX - drag.x) * .004; cam.pitch = Math.max(-1.4, Math.min(1.4, cam.pitch - (e.clientY - drag.y) * .004)); drag = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener('pointerup', () => drag = null);
const keys = {};
addEventListener('keydown', e => { if (e.target.tagName === 'SELECT') return; keys[e.code] = true; if (e.code === 'KeyK') setMode(state.mode === 'kit' ? 'today' : 'kit'); });
addEventListener('keyup', e => keys[e.code] = false);
document.querySelectorAll('#mode button').forEach(b => b.onclick = () => setMode(b.dataset.m));
document.querySelectorAll('#views button').forEach(b => b.onclick = () => setView(b.dataset.v));
const slider = document.getElementById('time'); slider.oninput = () => setTime(+slider.value);
{ // culture picker, grouped
  const sel = document.getElementById('cul'), groups = [['Mediterranean and Caucasus', ['byz', 'levant', 'armenian', 'georgian']], ['Islamic world and India', ['rum', 'arab', 'yemen', 'persian', 'central', 'tarim', 'indian']], ['Steppe and East Asia', ['steppe', 'mongol', 'tibet', 'chinese', 'song', 'sea']]];
  for (const [name, ids] of groups) { const og = document.createElement('optgroup'); og.label = name; for (const id of ids) { const o = document.createElement('option'); o.value = id; o.textContent = CULTURES.find(c => c.id === id).name; og.appendChild(o); } sel.appendChild(og); }
  sel.onchange = () => { buildCulture(sel.value); sel.blur(); };
  const step = dir => { const i = CULTURES.findIndex(c => c.id === state.C.id); buildCulture(CULTURES[(i + dir + CULTURES.length) % CULTURES.length].id); };
  document.getElementById('prev').onclick = () => step(-1); document.getElementById('next').onclick = () => step(1);
  addEventListener('hashchange', () => { const id = location.hash.slice(1); if (id && id !== state.C.id && CULTURES.some(c => c.id === id)) buildCulture(id); });
}
let last = performance.now();
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  const sp = (keys.ShiftLeft || keys.ShiftRight ? 12 : 4) * dt;
  const fw = new V3(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw)), rt = new V3(-fw.z, 0, fw.x);
  if (keys.KeyW || keys.ArrowUp) cam.pos.addScaledVector(fw, sp); if (keys.KeyS || keys.ArrowDown) cam.pos.addScaledVector(fw, -sp);
  if (keys.KeyD || keys.ArrowRight) cam.pos.addScaledVector(rt, sp); if (keys.KeyA || keys.ArrowLeft) cam.pos.addScaledVector(rt, -sp);
  if (keys.KeyE) cam.pos.y += sp; if (keys.KeyQ) cam.pos.y = Math.max(.5, cam.pos.y - sp);
  camera.position.copy(cam.pos); camera.rotation.set(cam.pitch, cam.yaw, 0, 'YXZ');
  sky.position.copy(camera.position);
  R.render(scene, camera);
  requestAnimationFrame(frame);
}
const startId = location.hash.slice(1);
buildCulture(CULTURES.some(c => c.id === startId) ? startId : 'byz'); setTime(.35); setView('street');
requestAnimationFrame(frame);
window.__mock = { setMode, setTime, setView, buildCulture, lookAt: (a, b) => lookAt(new V3(...a), new V3(...b)), state, R, CULTURES };
