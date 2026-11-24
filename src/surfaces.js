
// ============================================================
//  SURFACES (v22.2): real textures on the ground, roads and buildings
// ============================================================
// Two WebGL2 texture arrays built from src/surfaces_data.js (tools/textures/build_surfaces.py):
//   GROUND  meadow, patchy, sand, earth, forest, rock, setts, flags, fan
//   BUILD   plaster, mudbrick, brick, tile, stoneWarm, rubble, ashlar, slate, planks, boards, thatch, felt
// Each layer has a colour map, a normal map, its mean linear colour and (1/metres per tile, detail k, own colour).
// Shading keeps the vertex colour in charge: colour = vertex colour * (texture / mean), blended toward the
// texture's own colour by `own`. So region, culture and season palettes still decide the colour, and the
// texture adds the detail. Layers are sampled with textureGrad so they can sit in non-uniform branches.
const SURF = (() => {
  const D = typeof SURF_DATA !== 'undefined' ? SURF_DATA : null;
  const G = {}, Bn = {};
  if (D) { D.ground.forEach((l, i) => (G[l.name] = i)); D.build.forEach((l, i) => (Bn[l.name] = i)); }
  const GN = D ? D.ground.length : 1, BN = D ? D.build.length : 1;
  const v4 = (L) => L.map(l => new THREE.Vector4(1 / l.scale, l.k, l.own, 0));
  const v3 = (L) => L.map(l => new THREE.Vector3(l.mean[0], l.mean[1], l.mean[2]));
  const U = {
    tGround: { value: null }, tGroundN: { value: null }, tBuild: { value: null }, tBuildN: { value: null },
    uGT: { value: 0 }, uBT: { value: 0 }, uSN: { value: 1 },
    uGP: { value: D ? v4(D.ground) : [new THREE.Vector4()] }, uGM: { value: D ? v3(D.ground) : [new THREE.Vector3(1, 1, 1)] },
    uBP: { value: D ? v4(D.build) : [new THREE.Vector4()] }, uBM: { value: D ? v3(D.build) : [new THREE.Vector3(1, 1, 1)] },
  };
  const state = { ok: false, ready: false, on: true, normals: true };

  // ---- GLSL ----
  const DECL = `
    uniform highp sampler2DArray tGround; uniform highp sampler2DArray tGroundN; uniform highp sampler2DArray tBuild; uniform highp sampler2DArray tBuildN;
    uniform float uGT; uniform float uBT; uniform float uSN;
    uniform vec4 uGP[${GN}]; uniform vec3 uGM[${GN}]; uniform vec4 uBP[${BN}]; uniform vec3 uBM[${BN}];
    vec3 surfDet(vec3 base, vec3 t, vec3 mean, vec4 p) {
      vec3 det = mix(vec3(1.0), clamp(t / max(mean, vec3(0.003)), 0.0, 3.5), p.y);
      float lb = dot(base, vec3(0.2126, 0.7152, 0.0722)), lm = dot(mean, vec3(0.2126, 0.7152, 0.0722));
      return mix(base * det, t * (lb / max(lm, 0.003)), p.z);
    }
  `;
  function inject(sh) { Object.assign(sh.uniforms, U); sh.fragmentShader = DECL + sh.fragmentShader; }

  // ---- loading: decode the WebP layers into two texture arrays (colour sRGB, normals linear) ----
  async function decode(list, key, size) {
    const cv = document.createElement('canvas'); cv.width = cv.height = size; const g = cv.getContext('2d', { willReadFrequently: true });
    const out = new Uint8Array(size * size * 4 * list.length);
    for (let i = 0; i < list.length; i++) {
      const img = new Image(); img.src = list[i][key]; await img.decode();
      g.clearRect(0, 0, size, size); g.drawImage(img, 0, 0, size, size);
      out.set(g.getImageData(0, 0, size, size).data, i * size * size * 4);
    }
    return out;
  }
  function arr(data, size, n, srgb, aniso) {
    const t = new THREE.DataArrayTexture(data, size, size, n);
    t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true; t.anisotropy = aniso; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.needsUpdate = true;
    return t;
  }
  async function load(renderer, opt) {
    state.ok = !!(D && renderer.capabilities.isWebGL2); if (!state.ok) return;
    const an = Math.min(opt.aniso || 8, renderer.capabilities.getMaxAnisotropy());
    try {
      const [gc, bc] = [await decode(D.ground, 'col', D.cs), await decode(D.build, 'col', D.cs)];
      U.tGround.value = arr(gc, D.cs, GN, true, an); U.tBuild.value = arr(bc, D.cs, BN, true, an);
      const [gn, bn] = [await decode(D.ground, 'nrm', D.ns), await decode(D.build, 'nrm', D.ns)];
      U.tGroundN.value = arr(gn, D.ns, GN, false, an); U.tBuildN.value = arr(bn, D.ns, BN, false, an);
      state.ready = true; apply();
    } catch (e) { console.warn('surfaces: textures failed to load', e); }
  }
  function apply() { const on = state.ready && state.on; U.uGT.value = on ? 1 : 0; U.uBT.value = on ? 1 : 0; U.uSN.value = state.normals ? 1 : 0; }
  function set(on, normals) { if (on !== undefined) state.on = !!on; if (normals !== undefined) state.normals = !!normals; apply(); }

  // ---- buildings: which layer a face gets, from its colour, slope and the builder's wall default ----
  // Returns 1 + layer index (0 = untextured). `wall` names the default for light, plain walls (by culture).
  const LIN2S = (x) => Math.pow(Math.max(0, x), 1 / 2.2);
  function buildLayer(r, g, b, ny, wall) {
    if (!D) return 0;
    const R = LIN2S(r), Gc = LIN2S(g), Bc = LIN2S(b); const mx = Math.max(R, Gc, Bc), mn = Math.min(R, Gc, Bc);
    const v = mx, s = mx > 0 ? (mx - mn) / mx : 0; let h = 0;
    if (mx > mn) { if (mx === R) h = ((Gc - Bc) / (mx - mn)) % 6; else if (mx === Gc) h = (Bc - R) / (mx - mn) + 2; else h = (R - Gc) / (mx - mn) + 4; h *= 60; if (h < 0) h += 360; }
    const slope = Math.abs(ny) > 0.12 && Math.abs(ny) < 0.97, flat = Math.abs(ny) >= 0.97;
    const L = (n) => (Bn[n] === undefined ? 0 : Bn[n] + 1);
    if (v < 0.24) return 0;                                             // openings, shadows, ironwork
    if (s > 0.42 && h > 58 && h < 335) return 0;                        // paint, glazed tile, cloth, foliage
    if (wall === 'felt') return s < 0.5 && v > 0.55 ? L('felt') : 0;
    if (h < 30 && s > 0.42 && (v >= 0.5 || s > 0.7)) {                 // reds and terracotta (dark browns are timber, below)
      if (slope) return L('tile');
      return s > 0.7 ? L('planks') : L('brick');                        // lacquered posts / fired brick
    }
    if (s < 0.14) {                                                     // greys
      if (slope) return v < 0.45 ? L('tile') : 0;                       // grey roof tiles; lead domes stay plain
      if (flat) return L(v < 0.4 ? 'slate' : 'ashlar');
      return v < 0.4 ? L('slate') : wall === 'plaster' && v > 0.8 ? L('plaster') : L('ashlar');
    }
    if (h < 48 && s >= 0.35 && v < 0.6) return L(v < 0.4 ? 'boards' : 'planks');               // timber
    if (h >= 32 && h < 55 && s >= 0.33 && s < 0.62 && slope && v >= 0.45 && v < 0.72) return L('thatch'); // thatch and reed roofs
    if (v >= 0.5) return L(flat && (wall === 'mudbrick' || wall === 'brick') ? 'plaster' : wall || 'plaster');                         // walls in the culture's material
    return L('rubble');
  }
  // what a light wall is made of, by culture (houses; city walls use cityWall)
  const WALL = { levant: 'stoneWarm', byz: 'plaster', armenian: 'ashlar', georgian: 'rubble', rum: 'stoneWarm', arab: 'stoneWarm', yemen: 'stoneWarm',
    persian: 'mudbrick', central: 'mudbrick', tarim: 'mudbrick', chinese: 'mudbrick', song: 'plaster', tibet: 'plaster',
    mongol: 'felt', steppe: 'felt', indian: 'plaster', sea: 'planks' };
  const CITYWALL = { levant: 'stoneWarm', byz: 'stoneWarm', armenian: 'ashlar', georgian: 'rubble', rum: 'stoneWarm', arab: 'stoneWarm', yemen: 'stoneWarm',
    persian: 'mudbrick', central: 'mudbrick', tarim: 'mudbrick', chinese: 'mudbrick', song: 'ashlar', indian: 'stoneWarm', tibet: 'plaster' };
  // mud-brick cities: about half the houses are rendered with mud plaster
  function houseWall(cul, rng) { const w = WALL[cul] || 'plaster'; return w === 'mudbrick' && rng() < 0.5 ? 'plaster' : w === 'stoneWarm' && rng() < 0.3 ? 'rubble' : w; }

  // the crusader ports of the Levant (Acre and its neighbours) are built of the local limestone, not render
  const look = (city) => (city.culture === 'byz' && city.lat < 37 ? 'levant' : city.culture);
  return { look, D, U, G, B: Bn, state, inject, load, set, buildLayer, WALL, CITYWALL, houseWall, GN, BN };
})();
