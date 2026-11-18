
// ============================================================
//  GAME: rendering, streaming terrain, sites, player, HUD, map
// ============================================================
(() => {
  const W = WORLD, B = BLD;
  const HK = window.HOOKS = window.HOOKS || {}; // set by mech.js
  const $ = id => document.getElementById(id);
  const smooth = W.smooth, lerp = W.lerp, clamp = W.clamp;
  const lin = c => Math.pow(c, 2.2);
  const CULTURE_GROUND = {
    byz: [.74, .69, .6], armenian: [.66, .58, .52], georgian: [.7, .66, .58], rum: [.78, .7, .58], arab: [.82, .74, .6],
    persian: [.82, .7, .53], central: [.8, .69, .52], tarim: [.8, .68, .5], chinese: [.62, .6, .55], song: [.6, .6, .56],
    tibet: [.7, .66, .57], mongol: [.62, .64, .42], steppe: [.62, .64, .42], yemen: [.74, .66, .54], indian: [.74, .62, .5], sea: [.68, .56, .44],
  };

  // ---------- renderer ----------
  const canvas = $('c');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  const QUALITY = {
    low: { pr: .75, shadow: 0, view: 900, veg: .55, clutter: .3, msaa: 0, bloom: 0, shafts: 0, life: .45, grass: .35, wx: 1400, imp: .35, birds: 40, plights: 0, rocks: .5, clouds: 60, stars: 1200 },
    medium: { pr: 1, shadow: 1024, view: 1100, veg: .8, clutter: .65, msaa: 2, bloom: 1, shafts: 0, life: .75, grass: .65, wx: 2800, imp: .7, birds: 80, plights: 4, rocks: .8, clouds: 100, stars: 2200 },
    high: { pr: 1.5, shadow: 2048, view: 1300, veg: 1, clutter: 1, msaa: 4, bloom: 1, shafts: 1, life: 1, grass: 1, wx: 4500, imp: 1, birds: 130, plights: 4, rocks: 1, clouds: 140, stars: 3200 } };
  let qName = 'high'; try { qName = localStorage.getItem('silkroad_quality') || 'high'; } catch (e) { } if (!QUALITY[qName]) qName = 'high';
  let Q = QUALITY[qName];
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, Q.pr));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  // ---- post-processing: filmic tone mapping, grading, vignette (WebGL2 + MSAA) ----
  const POST = renderer.capabilities.isWebGL2;
  let rt = null; const postScene = new THREE.Scene(), postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const postMat = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: null }, tBloomA: { value: null }, tBloomB: { value: null }, uBloom: { value: 0 }, uShaft: { value: 0 }, uSun: { value: new THREE.Vector3(0.5, 0.5, 0) }, uAspect: { value: 1 }, uExposure: { value: 0.92 }, uNight: { value: 0 }, uWarm: { value: new THREE.Vector3(1, 1, 1) } },
    depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform sampler2D tBloomA; uniform sampler2D tBloomB; uniform float uBloom; uniform float uShaft; uniform vec3 uSun; uniform float uAspect; uniform float uExposure; uniform float uNight; varying vec2 vUv;
      vec3 aces(vec3 x){ const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14; return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0); }
      void main(){
        vec3 col = texture2D(tDiffuse, vUv).rgb;
        if (uBloom > 0.0) col += (texture2D(tBloomA, vUv).rgb * 0.5 + texture2D(tBloomB, vUv).rgb * 0.8) * uBloom;
        if (uShaft > 0.0 && uSun.z > 0.0) {
          vec2 dlt = (vUv - uSun.xy) / 28.0; vec2 p = vUv - dlt * fract(sin(dot(vUv, vec2(12.9898, 78.233))) * 43758.5453); float dec = 1.0; vec3 acc = vec3(0.0);
          for (int i = 0; i < 28; i++) { p -= dlt; acc += texture2D(tBloomA, clamp(p, 0.001, 0.999)).rgb * dec; dec *= 0.94; }
          float fall = 1.0 - smoothstep(0.0, 0.85, length((vUv - uSun.xy) * vec2(uAspect, 1.0)));
          col += acc / 28.0 * uShaft * uSun.z * fall * vec3(1.0, 0.86, 0.62);
        }
        col *= uExposure;
        col = mix(col, col * vec3(0.82, 0.94, 1.22), uNight * 0.55);
        col = aces(col);
        float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
        col = mix(vec3(l), col, 1.08 - uNight * 0.18);
        col = mix(col, col * col * (3.0 - 2.0 * col), 0.3);
        col += vec3(0.025, 0.012, -0.012) * smoothstep(0.45, 1.0, l) + vec3(-0.012, 0.004, 0.022) * (1.0 - smoothstep(0.0, 0.35, l));
        vec2 q = vUv - 0.5; col *= 1.0 - dot(q, q) * (0.6 + uNight * 0.5);
        col = pow(max(col, 0.0), vec3(1.0 / 2.2));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat));
  function makeRT() {
    if (!POST) return; const dpr = renderer.getPixelRatio(); const w = Math.floor(window.innerWidth * dpr), h = Math.floor(window.innerHeight * dpr);
    if (rt) rt.dispose(); rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: Q.msaa }); postMat.uniforms.tDiffuse.value = rt.texture;
  }
  makeRT();
  const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.12, 3400);
  scene.fog = new THREE.Fog(0xe8d3b0, 70, 760);
  window.addEventListener('resize', () => { renderer.setSize(window.innerWidth, window.innerHeight); makeRT(); camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); if (mapOpen) drawMap(); });

  const hemi = new THREE.HemisphereLight(0xbcd4e6, 0xb98a5a, 1.75); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe2b0, 3.0); scene.add(sun); scene.add(sun.target);
  sun.castShadow = Q.shadow > 0; sun.shadow.mapSize.set(Q.shadow || 1024, Q.shadow || 1024);
  const sc = sun.shadow.camera; sc.left = -80; sc.right = 80; sc.top = 80; sc.bottom = -80; sc.near = 1; sc.far = 1800;
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.5;
  const SUN_DIR = new THREE.Vector3(-0.62, 0.52, 0.58).normalize();

  // ---------- sky ----------
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { zen: { value: new THREE.Color(0x5b8fc9) }, hor: { value: new THREE.Color(0xf3d9b0) }, sunc: { value: new THREE.Color(0xfff0d0) }, sdir: { value: SUN_DIR.clone() }, mdir: { value: new THREE.Vector3(0, -1, 0) },
      setc: { value: new THREE.Color(0xf09a5a) }, twi: { value: 0 }, sunVis: { value: 1 }, moonVis: { value: 0 }, overcast: { value: 0 }, wxc: { value: new THREE.Color(0x888888) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform vec3 zen; uniform vec3 hor; uniform vec3 sunc; uniform vec3 sdir; uniform vec3 mdir; uniform vec3 setc; uniform float twi; uniform float sunVis; uniform float moonVis; uniform float overcast; uniform vec3 wxc; varying vec3 vP;
      void main(){ float h = vP.y; float t = pow(clamp(h,0.0,1.0), 0.55);
        vec3 c = mix(hor, zen, t); c = mix(c, hor*0.92, smoothstep(0.0,-0.25,h));
        vec2 az = normalize(vP.xz + 1e-4), saz = normalize(sdir.xz + 1e-4); float toward = dot(az, saz) * 0.5 + 0.5;
        float band = exp(-max(h + 0.04, 0.0) * 5.0) * (0.3 + 0.7 * toward * toward);
        c = mix(c, setc, clamp(band * twi, 0.0, 1.0));
        c = mix(c, setc * 0.55 + zen * 0.3, twi * 0.25 * smoothstep(0.1, 0.6, h) * toward);
        float s = max(dot(vP, sdir), 0.0); c += sunc * sunVis * (pow(s, 900.0) * 3.0 + pow(s, 12.0) * 0.22 + pow(s, 3.0) * 0.08);
        float m = max(dot(vP, mdir), 0.0); c += vec3(0.55, 0.65, 0.9) * moonVis * (pow(m, 80.0) * 0.22 + pow(m, 8.0) * 0.06);
        c = mix(c, wxc * (0.85 + 0.25 * t), overcast);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(3100, 32, 16), skyMat); sky.renderOrder = -1; scene.add(sky);

  // regional palettes
  const PAL = [
    { lon: 30, lat: 40, s: 7, zen: 0x5d93cc, hor: 0xf2dcb6, fog: 0xe6d6b8, sun: 0xffe3b5, hs: 0xbdd5e8, hg: 0x9c9384, far: 760 },
    { lon: 47, lat: 35, s: 7, zen: 0x6a8fc4, hor: 0xf6d0a0, fog: 0xefcc9e, sun: 0xffdca8, hs: 0xc4d2e0, hg: 0x9c9384, far: 760 },
    { lon: 65, lat: 39, s: 7, zen: 0x4f86c6, hor: 0xf2d9ae, fog: 0xead3aa, sun: 0xffe1b0, hs: 0xbad2e8, hg: 0x9c9384, far: 780 },
    { lon: 88, lat: 41, s: 8, zen: 0x6c8bbb, hor: 0xf4c792, fog: 0xecc293, sun: 0xffd39c, hs: 0xc8cfd8, hg: 0x9c9384, far: 700 },
    { lon: 110, lat: 34, s: 9, zen: 0x7ba4c6, hor: 0xe7e1c9, fog: 0xdcdac6, sun: 0xfff0d2, hs: 0xc5d8e0, hg: 0x9c9384, far: 600 },
    { lon: 60, lat: 47, s: 7, zen: 0x5d95d1, hor: 0xeae6c3, fog: 0xe2e0c0, sun: 0xffeac0, hs: 0xc2d8ec, hg: 0x9c9384, far: 800 },
    { lon: 32, lat: 27, s: 6, zen: 0x5a95d6, hor: 0xf7dcae, fog: 0xf0d8ae, sun: 0xffe6b8, hs: 0xc0d8ee, hg: 0xa49880, far: 820 },
    { lon: 44, lat: 20, s: 7, zen: 0x5f90cc, hor: 0xf8d39e, fog: 0xf2cf9c, sun: 0xffdca4, hs: 0xc8d6e2, hg: 0xa49880, far: 800 },
    { lon: 78, lat: 22, s: 8, zen: 0x6d95c0, hor: 0xf0d8b0, fog: 0xe6d4b2, sun: 0xffe2b0, hs: 0xc6d4dc, hg: 0x9a9480, far: 680 },
    { lon: 100, lat: 16, s: 8, zen: 0x5d8fc2, hor: 0xe6e6cc, fog: 0xd8dcc4, sun: 0xfff0cc, hs: 0xc2d8e2, hg: 0x8f9a7e, far: 620 },
    { lon: 88, lat: 31, s: 7, zen: 0x3a6dbf, hor: 0xd9e6ee, fog: 0xd2dde2, sun: 0xfff6e6, hs: 0xcfe0f2, hg: 0x9c9384, far: 950 },
  ].map(p => ({ ...p, X: W.degX(p.lon), Y: W.degY(p.lat), c: ['zen', 'hor', 'fog', 'sun', 'hs', 'hg'].reduce((o, k) => (o[k] = new THREE.Color(p[k]), o), {}) }));
  const palCur = { zen: new THREE.Color(), hor: new THREE.Color(), fog: new THREE.Color(), sun: new THREE.Color(), hs: new THREE.Color(), hg: new THREE.Color(), far: 760 };
  let palInit = false;
  function updatePalette(x, z, dt) {
    const X = x / W.K, Y = -z / W.K; let tot = 0; const acc = { zen: [0, 0, 0], hor: [0, 0, 0], fog: [0, 0, 0], sun: [0, 0, 0], hs: [0, 0, 0], hg: [0, 0, 0] }; let far = 0;
    for (const p of PAL) { const d2 = ((X - p.X) ** 2 + (Y - p.Y) ** 2) / (p.s * p.s); const w = Math.exp(-d2 * 2); tot += w; far += p.far * w; for (const k in acc) { acc[k][0] += p.c[k].r * w; acc[k][1] += p.c[k].g * w; acc[k][2] += p.c[k].b * w; } }
    const k = palInit ? 1 - Math.exp(-dt * 0.8) : 1; palInit = true;
    for (const key in acc) { const t = new THREE.Color(acc[key][0] / tot, acc[key][1] / tot, acc[key][2] / tot); palCur[key].lerp(t, k); }
    palCur.far = lerp(palCur.far, far / tot, k);
  }

  // ---------- materials ----------
  const waterUniforms = { time: { value: 0 } };
  const GLSL_NOISE = `
    float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
    float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
      return mix(mix(h21(i), h21(i+vec2(1.0,0.0)), f.x), mix(h21(i+vec2(0.0,1.0)), h21(i+vec2(1.0,1.0)), f.x), f.y); }
`;
  function withWorldVaryings(sh) {
    sh.vertexShader = 'varying vec3 vWPos; varying vec3 vWNorm;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz; vWNorm = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = 'varying vec3 vWPos; varying vec3 vWNorm;\n' + GLSL_NOISE + sh.fragmentShader;
  }
  // ---------- seasons (v11): shared uniforms driven by the journey calendar ----------
  const SEASON_U = { uWinter: { value: 0 }, uSummer: { value: 1 }, uAutumn: { value: 0 }, uSpring: { value: 0 }, uK: { value: 1 } };
  const SEASON_GLSL = 'uniform float uWinter; uniform float uSummer; uniform float uAutumn; uniform float uSpring; uniform float uK;\n';
  function seasonWeights(m) { const bump = (c, w) => { let d = Math.abs(m - c); d = Math.min(d, 12 - d); return Math.max(0, 1 - d / w); };
    return { w: Math.min(1, bump(0.6, 2.6) * 1.35), s: Math.min(1, bump(6.8, 2.6) * 1.3), a: Math.min(1, bump(9.6, 1.9) * 1.3), sp: Math.min(1, bump(3.8, 1.8) * 1.3) }; }
  // ---------- v13 shared lighting: layered haze, rim light, night ----------
  const HAZE_U = { uHazeFar: { value: new THREE.Color(0xb0b8c8) }, uMist: { value: 0 }, uMistY: { value: 0 } };
  const RIM_U = { uRimCol: { value: new THREE.Color(0xffd9a0) }, uLDir: { value: SUN_DIR.clone() }, uNight: { value: 0 } };
  function withHaze(sh, wp) {
    Object.assign(sh.uniforms, HAZE_U);
    sh.fragmentShader = 'uniform vec3 uHazeFar; uniform float uMist; uniform float uMistY;\n' + sh.fragmentShader.replace('#include <fog_fragment>', `
      #ifdef USE_FOG
        float ffog = smoothstep(fogNear, fogFar, vFogDepth);
        vec3 fogC = mix(fogColor, uHazeFar, smoothstep(0.25, 1.0, ffog) * 0.7);
        float lowM = 1.0 - smoothstep(uMistY, uMistY + 10.0, ${wp}.y);
        ffog = max(ffog, uMist * lowM * smoothstep(3.0, 80.0, vFogDepth) * 0.9);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, fogC, ffog);
      #endif`);
  }
  function withRim(sh, k) { // painterly rim light: strongest on silhouettes facing away from the sun/moon
    Object.assign(sh.uniforms, RIM_U);
    sh.fragmentShader = 'uniform vec3 uRimCol; uniform vec3 uLDir; uniform float uNight;\n' + sh.fragmentShader.replace('#include <opaque_fragment>', `
      { vec3 Vd = normalize(cameraPosition - vWPos); vec3 Nw = normalize(vWNorm); float fr = pow(1.0 - abs(dot(Nw, Vd)), 3.0);
        float back = 0.3 + 0.7 * max(dot(-Vd, uLDir), 0.0); outgoingLight += uRimCol * fr * back * ${k.toFixed(2)} * diffuseColor.rgb * 2.0; }
      #include <opaque_fragment>`);
  }
  const NIGHT_GLSL = 'uniform float uNight; uniform float time;\n';
  const terrainMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  terrainMat.onBeforeCompile = (sh) => {
    withWorldVaryings(sh); Object.assign(sh.uniforms, SEASON_U); sh.fragmentShader = SEASON_GLSL + sh.fragmentShader;
    sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      {
        vec2 wp = vWPos.xz; float dist = length(vWPos - cameraPosition);
        float fade = 1.0 - smoothstep(50.0, 240.0, dist);
        float n3 = vn(wp * 0.07) * 0.6 + vn(wp * 0.21) * 0.4;
        float n1 = vn(wp * 0.9), n2 = vn(wp * 3.7);
        float slope = 1.0 - clamp(vWNorm.y, 0.0, 1.0);
        vec3 c = diffuseColor.rgb;
        c *= 0.88 + 0.24 * n3;
        c *= mix(1.0, 0.84 + 0.3 * (n2 * 0.6 + n1 * 0.4), fade);
        float strata = sin(vWPos.y * 0.9 + vn(wp * 0.08) * 9.0) * 0.5 + 0.5;
        float cracks = smoothstep(0.08, 0.0, abs(vn(vec2(wp.x * 0.35 + vWPos.y * 0.5, wp.y * 0.35)) - 0.5));
        float steep = smoothstep(0.22, 0.5, slope);
        c *= mix(1.0, (0.9 + 0.13 * strata) * (1.0 - 0.2 * cracks), steep);
        float green = clamp((c.g - max(c.r, c.b)) * 10.0, 0.0, 1.0);
        float blade = step(0.68, vn(wp * 7.5)) * fade * (1.0 - steep);
        c = mix(c, c * vec3(0.72, 0.88, 0.66), green * blade);
        c = mix(c, c * 1.12, (1.0 - green) * step(0.82, vn(wp * 5.3)) * fade * 0.6);
        // seasons
        float lat = 38.0 - vWPos.z / uK; float north = smoothstep(30.0, 46.0, lat);
        float greenS = clamp((diffuseColor.g - max(diffuseColor.r, diffuseColor.b)) * 6.0, 0.0, 1.0);
        c = mix(c, c * vec3(1.14, 1.02, 0.72), greenS * uSummer * 0.55 * smoothstep(22.0, 40.0, lat));
        c = mix(c, c * vec3(1.28, 0.9, 0.58), greenS * uAutumn * 0.75 * north);
        c = mix(c, c * vec3(0.9, 1.12, 0.86), greenS * uSpring * 0.45);
        float flat2 = smoothstep(0.55, 0.85, vWNorm.y);
        float snowLow = uWinter * smoothstep(33.0, 43.0, lat) * smoothstep(0.35, 0.65, vn(wp * 0.035) * 0.6 + vn(wp * 0.21) * 0.4 + uWinter * 0.25);
        float snowHigh = uWinter * smoothstep(48.0 - 22.0 * smoothstep(28.0, 45.0, lat), 70.0, vWPos.y);
        float snow = clamp(max(snowLow, snowHigh) * flat2, 0.0, 1.0);
        c = mix(c, vec3(0.92, 0.94, 0.98), snow);
        // v13 close-up ground detail: sand ripples, cracked earth, pebbles
        float near2 = 1.0 - smoothstep(25.0, 110.0, dist);
        if (near2 > 0.0 && snow < 0.5) {
          vec3 b0 = diffuseColor.rgb; float lum = dot(b0, vec3(0.33));
          float sandy = clamp((b0.r - b0.b) * 5.0 - 0.6, 0.0, 1.0) * clamp((b0.r - b0.g) * 9.0 + 0.3, 0.0, 1.0) * (1.0 - green) * (1.0 - steep) * smoothstep(0.25, 0.42, lum);
          float rip = sin(dot(wp, vec2(0.82, 0.57)) * 2.6 + vn(wp * 0.18) * 7.0 + vn(wp * 0.9) * 1.4);
          c *= 1.0 + sandy * near2 * (0.07 * rip - 0.02);
          float dry = (1.0 - green) * (1.0 - sandy) * (1.0 - steep) * clamp((b0.r - b0.b - 0.16) * 6.0, 0.0, 1.0) * clamp((b0.r * 0.92 - b0.g) * 12.0, 0.0, 1.0) * (1.0 - smoothstep(20.0, 60.0, dist));
          vec2 cp = wp * 0.8; vec2 ci = floor(cp), cf = fract(cp); float m1 = 9.0, m2 = 9.0;
          for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) { vec2 o = vec2(float(i), float(j)); vec2 r = o + vec2(h21(ci + o), h21(ci + o + 17.0)) - cf; float dd = dot(r, r); if (dd < m1) { m2 = m1; m1 = dd; } else if (dd < m2) m2 = dd; }
          float crack = 1.0 - smoothstep(0.0, 0.09, sqrt(m2) - sqrt(m1));
          c *= 1.0 - crack * dry * 0.2 * step(0.45, vn(wp * 0.05));
          vec2 pg = wp * 2.2; vec2 pi = floor(pg); float pr = h21(pi); vec2 pc = fract(pg) - 0.5 - (vec2(h21(pi + 3.1), h21(pi + 7.7)) - 0.5) * 0.5;
          float peb = step(0.86, pr) * (1.0 - smoothstep(0.1, 0.2, length(pc))) * (1.0 - sandy * 0.7);
          c = mix(c, c * (0.75 + 0.5 * h21(pi + 1.3)) + vec3(0.03), peb * near2 * 0.8);
        }
        diffuseColor.rgb = c;
      }`);
    withHaze(sh, 'vWPos'); withRim(sh, 0.12);
  };
  function makeObjMat(windows) {
    const m = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
    m.onBeforeCompile = (sh) => {
      withWorldVaryings(sh);
      if (windows) { sh.vertexShader = 'varying float vLocY;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vLocY = position.y;'); sh.uniforms.time = waterUniforms.time; }
      sh.fragmentShader = (windows ? 'varying float vLocY; uniform float time;\n' : '') + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      {
        float dist = length(vWPos - cameraPosition); float fade = 1.0 - smoothstep(30.0, 160.0, dist);
        vec3 an = abs(vWNorm);
        vec2 uv = an.y > 0.6 ? vWPos.xz : (an.x > an.z ? vWPos.zy : vWPos.xy);
        float g = vn(uv * 3.0) * 0.5 + vn(uv * 11.0) * 0.5;
        float course = an.y < 0.6 ? smoothstep(0.06, 0.0, abs(fract(vWPos.y * 2.2) - 0.5) - 0.44) : 0.0;
        diffuseColor.rgb *= mix(1.0, (0.9 + 0.18 * g) * (1.0 - 0.08 * course), fade);
      }`);
      withRim(sh, 0.16);
      if (windows) sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      if (uNight > 0.01) { vec3 an2 = abs(vWNorm);
        if (an2.y < 0.2) { float u = an2.x > an2.z ? vWPos.z : vWPos.x; float yy = (vLocY - 0.7) / 2.8;
          vec2 cell = vec2(floor(u / 1.8), floor(yy)); vec2 f = vec2(fract(u / 1.8), fract(yy));
          float win = step(0.4, f.x) * step(f.x, 0.6) * step(0.3, f.y) * step(f.y, 0.6);
          float on = step(0.6, h21(cell + floor(vWPos.xz / 9.0) * 3.17));
          float lvl = step(0.7, vLocY) * step(vLocY, 11.0);
          float flick = 0.8 + 0.2 * sin(time * 2.7 + cell.x * 7.0 + cell.y * 3.0);
          totalEmissiveRadiance += vec3(1.9, 1.05, 0.4) * win * on * lvl * uNight * flick;
        } }`);
      withHaze(sh, 'vWPos');
    };
    if (windows) m.customProgramCacheKey = () => 'objWin';
    return m;
  }
  const objMat = makeObjMat(false), bldMat = makeObjMat(true);
  const vegMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
  vegMat.onBeforeCompile = (sh) => {
    withWorldVaryings(sh); Object.assign(sh.uniforms, SEASON_U); sh.fragmentShader = SEASON_GLSL + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      {
        float lat = 38.0 - vWPos.z / uK; vec3 c = diffuseColor.rgb;
        float leaf = clamp((c.g - max(c.r, c.b)) * 5.0, 0.0, 1.0);
        float pick = step(0.45, fract(sin(dot(floor(vWPos.xz * 0.35), vec2(12.9898, 78.233))) * 43758.5453));
        c = mix(c, c * vec3(1.65, 1.0, 0.45), leaf * uAutumn * smoothstep(30.0, 42.0, lat) * mix(0.55, 1.0, pick));
        c = mix(c, c * vec3(1.15, 1.05, 0.75), leaf * uSummer * 0.35 * smoothstep(24.0, 40.0, lat));
        c = mix(c, mix(c, vec3(0.5, 0.46, 0.4), 0.7), leaf * uWinter * smoothstep(34.0, 42.0, lat) * mix(0.6, 1.0, pick));
        c = mix(c, vec3(0.93, 0.95, 0.99), uWinter * smoothstep(34.0, 42.0, lat) * smoothstep(0.2, 0.8, vWNorm.y) * 0.9);
        diffuseColor.rgb = c;
      }`);
    sh.uniforms.time = waterUniforms.time;
    sh.vertexShader = 'uniform float time; attribute float aSway;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float ph = time * 1.4 + position.x * 0.21 + position.z * 0.17;
      float gust = 0.6 + 0.8 * sin(time * 0.35 + position.x * 0.013 + position.z * 0.009);
      transformed.x += sin(ph) * 0.045 * aSway * gust; transformed.z += cos(ph * 0.83) * 0.034 * aSway * gust;`);
    withRim(sh, 0.22); withHaze(sh, 'vWPos');
  };
  const roadMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6 });
  roadMat.onBeforeCompile = (sh) => {
    sh.vertexShader = 'attribute vec2 aRoad; varying vec2 vRoad; varying vec3 vWPos2;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vRoad = aRoad; vWPos2 = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'varying vec2 vRoad; varying vec3 vWPos2;\n' + GLSL_NOISE + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      {
        float u = vRoad.x; float paved = vRoad.y; vec2 wp = vWPos2.xz; vec3 c = diffuseColor.rgb;
        float ruts = smoothstep(0.13, 0.0, abs(abs(u) - 0.4)) * (0.7 + 0.3 * vn(wp * 0.6));
        float peb = vn(wp * 4.0), peb2 = step(0.8, vn(wp * 9.0));
        vec3 dirt = c * (1.0 - 0.2 * ruts + (peb - 0.5) * 0.14 - peb2 * 0.12);
        vec2 g = wp * 1.25; float row = mod(floor(g.y), 2.0); vec2 f = vec2(fract(g.x + row * 0.5), fract(g.y));
        float edge = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
        vec3 cob = c * (0.74 + 0.24 * smoothstep(0.03, 0.13, edge)) * (0.9 + 0.2 * h21(floor(vec2(g.x + row * 0.5, g.y))));
        c = mix(dirt, cob, paved);
        c *= 1.0 - 0.14 * smoothstep(0.7, 1.0, abs(u));
        diffuseColor.rgb = c;
      }`);
    withHaze(sh, 'vWPos2');
  };
  // v13 water: sky reflections with fresnel, sun glitter, flowing rivers with bank and bridge foam, shore waves on the sea
  const WATER_U = { uZen: { value: new THREE.Color(0x5b8fc9) }, uHor: { value: new THREE.Color(0xf3d9b0) }, uSunW: { value: SUN_DIR.clone() }, uSunC: { value: new THREE.Color(0xffe2b0) },
    uSeaTex: { value: null }, uSeaG: { value: new THREE.Vector4(0, 0, 0, 0) } };
  function makeWaterMat(color, amp, kind) {
    const m = new THREE.MeshPhongMaterial({ color, specular: 0x9fc4cc, shininess: 60, flatShading: kind === 'sea', side: THREE.DoubleSide });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.time = waterUniforms.time; Object.assign(sh.uniforms, WATER_U);
      sh.vertexShader = 'uniform float time; varying vec3 vWP;' + (kind === 'river' ? ' attribute vec3 aRiv; varying vec3 vRiv;' : '') + '\n' + sh.vertexShader.replace('#include <begin_vertex>',
        `#include <begin_vertex>
         vec4 wp = modelMatrix * vec4(position, 1.0);
         transformed.y += (sin(wp.x*0.21 + time*1.1) * 0.5 + sin(wp.z*0.17 - time*0.9) * 0.4 + sin((wp.x+wp.z)*0.37 + time*1.7)*0.2) * ${amp.toFixed(2)};
         vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;` + (kind === 'river' ? '\n vRiv = aRiv;' : ''));
      sh.fragmentShader = 'uniform float time; varying vec3 vWP; uniform vec3 uZen; uniform vec3 uHor; uniform vec3 uSunW; uniform vec3 uSunC; uniform sampler2D uSeaTex; uniform vec4 uSeaG;' + (kind === 'river' ? ' varying vec3 vRiv;' : '') + '\n' + GLSL_NOISE +
        sh.fragmentShader.replace('#include <opaque_fragment>', `
        {
          vec3 Vd = normalize(cameraPosition - vWP); float dist = length(cameraPosition - vWP); vec2 q = vWP.xz;
          ${kind === 'river' ? `vec2 fl = vec2(vRiv.x * 3.0, vRiv.y * 0.22 - time * 0.55);
          float n1 = vn(fl * vec2(1.0, 1.0)) - 0.5, n2 = vn(fl * 2.7 + 9.0) - 0.5;` : `float n1 = vn(q * 0.23 + vec2(time * 0.07, time * 0.05)) - 0.5, n2 = vn(q * 0.61 - vec2(time * 0.11, -time * 0.06)) - 0.5;`}
          float rk = ${kind === 'lake' ? '0.10' : kind === 'river' ? '0.22' : '0.3'} * (1.0 - smoothstep(60.0, 600.0, dist));
          vec3 Nw = normalize(vec3((n1 + n2 * 0.5) * rk, 1.0, (n2 - n1 * 0.4) * rk));
          float fres = 0.03 + 0.97 * pow(1.0 - max(dot(Nw, Vd), 0.0), 5.0);
          vec3 Rr = reflect(-Vd, Nw); float ty = pow(clamp(Rr.y, 0.0, 1.0), 0.55); vec3 skyR = mix(uHor, uZen, ty);
          vec3 irr = (reflectedLight.directDiffuse + reflectedLight.indirectDiffuse) / max(diffuseColor.rgb, vec3(0.04));
          float refl = ${kind === 'lake' ? '0.85' : kind === 'river' ? '0.6' : '0.7'};
          outgoingLight = mix(outgoingLight, skyR * ${kind === 'lake' ? '0.95' : '0.85'}, clamp(fres * refl + ${kind === 'lake' ? '0.18' : '0.08'}, 0.0, ${kind === 'lake' ? '0.8' : kind === 'river' ? '0.45' : '0.6'}));
          outgoingLight += uSunC * pow(max(dot(Rr, uSunW), 0.0), ${kind === 'lake' ? '600.0' : '260.0'}) * ${kind === 'lake' ? '4.0' : '2.2'};
          ${kind === 'river' ? `float bank = smoothstep(0.62, 0.98, abs(vRiv.x));
          float fn = vn(vec2(vRiv.x * 6.0, vRiv.y * 0.6 - time * 1.4)) * 0.6 + vn(vec2(vRiv.x * 15.0, vRiv.y * 1.7 - time * 2.2)) * 0.4;
          float foam = smoothstep(0.42, 0.75, fn * (bank * 0.9 + vRiv.z * 1.2)) * (1.0 - smoothstep(80.0, 260.0, dist));
          float streak = smoothstep(0.64, 0.75, vn(vec2(vRiv.x * 9.0, vRiv.y * 0.08 - time * 0.4))) * 0.07 * (1.0 - smoothstep(30.0, 150.0, dist));
          outgoingLight = mix(outgoingLight, irr * vec3(0.86, 0.9, 0.92), clamp(foam * 0.8 + streak, 0.0, 1.0));` : ''}
          ${kind === 'sea' ? `vec2 suv = vec2(vWP.x * uSeaG.x + uSeaG.y, -vWP.z * uSeaG.z + uSeaG.w); float sg = texture2D(uSeaTex, suv).r;
          float shore = 1.0 - smoothstep(0.5, 0.95, sg);
          outgoingLight = mix(outgoingLight, irr * vec3(0.28, 0.62, 0.6), shore * 0.45);
          float wv = sin(sg * 46.0 - time * 1.3 + vn(q * 0.04) * 8.0);
          float sfoam = smoothstep(0.82, 1.0, wv) * shore * (0.6 + 0.4 * vn(q * 0.5 + time * 0.2)) + (1.0 - smoothstep(0.42, 0.56, sg)) * (0.55 + 0.45 * vn(q * 0.8 - time * 0.3));
          outgoingLight = mix(outgoingLight, irr * vec3(0.9, 0.93, 0.95), clamp(sfoam, 0.0, 1.0) * 0.8 * (1.0 - smoothstep(150.0, 700.0, dist)));` : ''}
        }
        #include <opaque_fragment>`);
      withHaze(sh, 'vWP');
    };
    m.customProgramCacheKey = () => 'water' + kind;
    return m;
  }
  const seaMat = makeWaterMat(0x3f8f9c, 0.35, 'sea');
  const riverMat = makeWaterMat(0x4a9aa0, 0.08, 'river'); riverMat.shininess = 18; riverMat.specular = new THREE.Color(0x3a5a60);
  const lakeMat = makeWaterMat(0x3d93a8, 0.06, 'lake'); lakeMat.shininess = 90;
  function buildSeaTex() {
    const G = W.G, n = G.NX * G.NY, d = new Uint8Array(n); for (let i = 0; i < n; i++) d[i] = Math.max(0, Math.min(255, W.seaG[i] * 255)) | 0;
    const t = new THREE.DataTexture(d, G.NX, G.NY, THREE.RedFormat, THREE.UnsignedByteType); t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
    const ll = W.toLL(0, 0); const LON0 = ll[0], LAT0 = ll[1];
    WATER_U.uSeaTex.value = t; WATER_U.uSeaG.value.set(1 / (W.K * W.COS * G.d * G.NX), (LON0 - G.lon0) / (G.d * G.NX) + 0.5 / G.NX, 1 / (W.K * G.d * G.NY), (LAT0 - G.lat0) / (G.d * G.NY) + 0.5 / G.NY);
  }

  // ---------- loading ----------
  const loadBar = $('loadbar'), loadTxt = $('loadtxt');
  function setLoad(t, f) { loadTxt.textContent = t; loadBar.style.width = Math.round(f * 100) + '%'; }
  const steps = W.init();
  let si = 0;
  function runStep() {
    if (si < steps.length) {
      setLoad(steps[si][0] + '…', si / (steps.length + 2));
      setTimeout(() => { try { steps[si][1](); } catch (e) { console.error(e); loadTxt.textContent = 'Error: ' + e.message; throw e; } si++; runStep(); }, 30);
    } else {
      setLoad('Building the world…', (steps.length) / (steps.length + 2));
      setTimeout(() => { postInit(); }, 30);
    }
  }
  runStep();

  // ---------- static meshes: roads, rivers, lakes, bridges ----------
  function buildRoads() {
    const P = W.P;
    for (const e of W.edges) for (let j0 = 0; j0 < e.n - 1; j0 += 150) {
      const pos = [], colA = [], idx = [], aRoad = []; let prevIn = false;
      for (let j = j0; j <= Math.min(e.n - 1, j0 + 150); j++) {
        const i = e.start + j; const i0 = Math.max(e.start, i - 1), i1 = Math.min(e.start + e.n - 1, i + 1);
        let tx = P.X[i1] - P.X[i0], tz = P.Z[i1] - P.Z[i0]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
        const nx = -tz, nz = tx; const y = P.H[i] + 0.08;
        const ll = W.toLL(P.X[i], P.Z[i]); const bi = W.bioIndex(ll[0], ll[1]); const dom = W.BIOME_KEYS[W.bio.dom[bi]];
        let c = [.80, .71, .55];
        if (dom === 'southchina' || dom === 'northchina') c = [.70, .66, .57]; else if (dom === 'tibet' || dom === 'alpine') c = [.77, .72, .62]; else if (dom === 'sand' || dom === 'gobi') c = [.86, .76, .6]; else if (dom === 'steppe' || dom === 'pontic' || dom === 'caucasus') c = [.72, .64, .5];
        const nc = W.nearestCity(P.X[i], P.Z[i]); if (nc.d < nc.c.R) c = [.74, .7, .62];
        const v = (N => N * 0.04)(W.noise(P.X[i] * 0.1, P.Z[i] * 0.1));
        const paved = nc.d < nc.c.R - 1 ? 1 : 0; const hw = paved ? 2.3 : 1.9; const inCity = nc.d < nc.c.R - 3;
        for (const s of [-1, -0.5, 0.5, 1]) {
          pos.push(P.X[i] + nx * s * hw, y - (Math.abs(s) > .9 ? 0.02 : 0), P.Z[i] + nz * s * hw);
          const k = Math.abs(s) > .9 ? 0.93 : 1.0; colA.push(lin(c[0] * k + v), lin(c[1] * k + v), lin(c[2] * k + v)); aRoad.push(s, paved);
        }
        if (j > j0 && !(inCity && prevIn)) { const b = pos.length / 3 - 8; for (let s = 0; s < 3; s++) { const a0 = b + s, a1 = b + s + 1, c0 = b + 4 + s, c1 = b + 5 + s; idx.push(a0, c0, a1, a1, c0, c1); } }
        prevIn = inCity;
      }
      if (!idx.length) continue;
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(colA, 3)); g.setAttribute('aRoad', new THREE.Float32BufferAttribute(aRoad, 2)); g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
      const m = new THREE.Mesh(g, roadMat); m.receiveShadow = true; scene.add(m);
    }
  }
  function buildRivers() {
    const R = W.R;
    for (const r of W.rivers) for (let j0 = 0; j0 < r.n - 1; j0 += 120) {
      const pos = [], idx = [], riv = [];
      for (let j = j0; j <= Math.min(r.n - 1, j0 + 120); j++) {
        const i = r.start + j; const i0 = Math.max(r.start, i - 1), i1 = Math.min(r.start + r.n - 1, i + 1);
        let tx = R.X[i1] - R.X[i0], tz = R.Z[i1] - R.Z[i0]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
        const hw = R.W[i] + 1.6;
        let bf = 0; for (const br of W.bridges) { const dd = Math.hypot(br.x - R.X[i], br.z - R.Z[i]); if (dd < 16) bf = Math.max(bf, 1 - dd / 16); }
        for (const s of [-1, -0.33, 0.33, 1]) { pos.push(R.X[i] - tz * hw * s, R.H[i], R.Z[i] + tx * hw * s); riv.push(s, j * 2.5, bf); }
        if (j > j0) { const b = pos.length / 3 - 8; for (let s = 0; s < 3; s++) { const a0 = b + s, a1 = b + s + 1, c0 = b + 4 + s, c1 = b + 5 + s; idx.push(a0, c0, a1, a1, c0, c1); } }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aRiv', new THREE.Float32BufferAttribute(riv, 3)); g.setIndex(idx); g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(pos.length).map((_, k) => k % 3 === 1 ? 1 : 0), 3)); g.computeBoundingSphere();
      const m = new THREE.Mesh(g, riverMat); m.receiveShadow = true; scene.add(m);
    }
  }
  function polarDisc(rx, rz, rings, segs) {
    const pos = [], idx = []; pos.push(0, 0, 0);
    for (let r = 1; r <= rings; r++) for (let s = 0; s < segs; s++) { const a = s / segs * Math.PI * 2; pos.push(Math.cos(a) * rx * r / rings, 0, Math.sin(a) * rz * r / rings); }
    for (let s = 0; s < segs; s++) idx.push(0, 1 + (s + 1) % segs, 1 + s);
    for (let r = 1; r < rings; r++) for (let s = 0; s < segs; s++) {
      const a = 1 + (r - 1) * segs + s, b = 1 + (r - 1) * segs + (s + 1) % segs, c = 1 + r * segs + s, d = 1 + r * segs + (s + 1) % segs;
      idx.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  function buildLakes() {
    const G = W.G; const pos = [], idx = [];
    // one quad per 0.1-degree cell (dilated) at the lake's own level, subdivided 2x2 for waves
    for (let iy = 0; iy < G.NY - 1; iy++) for (let ix = 0; ix < G.NX - 1; ix++) {
      const id = W.lakeIdD[iy * G.NX + ix]; if (!id) continue; const L = W.lakes[id - 1];
      const lon = G.lon0 + ix * G.d, lat = G.lat0 + iy * G.d;
      const base = pos.length / 3;
      for (let b = 0; b <= 2; b++) for (let a = 0; a <= 2; a++) { const w = W.toWorld(lon + (a - 1) * G.d * .5, lat + (b - 1) * G.d * .5); pos.push(w[0], L.level, w[1]); }
      for (let b = 0; b < 2; b++) for (let a = 0; a < 2; a++) { const i0 = base + b * 3 + a; idx.push(i0, i0 + 3, i0 + 1, i0 + 1, i0 + 3, i0 + 4); }
    }
    if (!pos.length) return;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, lakeMat); m.receiveShadow = true; m.frustumCulled = false; scene.add(m);
  }
  let sea;
  function buildSea() {
    const g = new THREE.PlaneGeometry(3200, 3200, 140, 140); g.rotateX(-Math.PI / 2);
    sea = new THREE.Mesh(g, seaMat); sea.receiveShadow = true; scene.add(sea);
  }
  function cultureAt(x, z) { const nc = W.nearestCity(x, z); return nc.c.culture; }
  function buildBridges() {
    const b = new B.Builder(); const P = W.P;
    for (const br of W.bridges) {
      const cul = cultureAt(br.x, br.z); const ry = Math.atan2(br.tx, br.tz);
      const style = br.style || (cul === 'mongol' || cul === 'steppe' || cul === 'tibet' ? 'wood' : 'stone');
      const sc = style === 'lugou' ? 0xe6e1d6 : style === 'wood' ? 0x8a5a36 : (cul === 'chinese' || cul === 'song' ? 0xb3aa9a : 0xcdb994);
      const sd = style === 'lugou' ? 0xcfc9bc : style === 'wood' ? 0x5e3d26 : (cul === 'chinese' || cul === 'song' ? 0x9c958a : 0xb8a37e);
      b.push(br.x, 0, br.z, ry);
      const loc = k => { const dx = P.X[k] - br.x, dz = P.Z[k] - br.z; return [dx * br.tz - dz * br.tx, dx * br.tx + dz * br.tz]; }; // [lateral(x), along(z)]
      const lat = [], al = [], hh = [];
      for (let k = br.i0; k <= br.i1; k++) { const [x, z] = loc(k); lat.push(x); al.push(z); hh.push(P.H[k]); }
      const n = lat.length;
      // deck & parapets, segment by segment so they follow the hump exactly
      for (let k = 0; k < n - 1; k++) {
        const x = (lat[k] + lat[k + 1]) / 2, z = (al[k] + al[k + 1]) / 2, h0 = hh[k], h1 = hh[k + 1]; const len = Math.hypot(al[k + 1] - al[k], lat[k + 1] - lat[k]) + 0.12;
        const pitch = -Math.atan2(h1 - h0, len), yaw = Math.atan2(lat[k + 1] - lat[k], al[k + 1] - al[k]); const hm = (h0 + h1) / 2;
        b.box(x, hm - 0.9, z, 6.2, 0.9, len, style === 'wood' ? 0x7a5236 : sc, yaw, pitch);
        if (style === 'wood') { for (const sx of [-1, 1]) { b.box(x + sx * 2.9, hm + 0.95, z, .14, .14, len, sd, yaw, pitch); if (k % 2 === 0) b.box(x + sx * 2.9, hm - .1, z, .16, 1.1, .16, sd, yaw); } }
        else for (const sx of [-1, 1]) b.box(x + sx * 2.85, hm - 0.05, z, .5, 1.0, len, sc, yaw, pitch);
        if (style === 'lugou' && k % 2 === 0) for (const sx of [-1, 1]) { b.box(x + sx * 2.85, hm + .9, z, .55, .5, .55, sc); b.sphere(x + sx * 2.85, hm + 1.55, z, .34, 0xd9d2c2, 5, 1.1); }
      }
      // piers and arches across the river channel
      const span = br.hw + 6; const nP = Math.max(1, Math.round(2 * span / (style === 'wood' ? 6 : 9)));
      const hAt = z => { for (let k = 0; k < n - 1; k++) if ((al[k] - z) * (al[k + 1] - z) <= 0) { const t = (z - al[k]) / ((al[k + 1] - al[k]) || 1); return hh[k] + (hh[k + 1] - hh[k]) * t; } return hh[n >> 1]; };
      const latAt = z => { let best = 0, bd = 1e9; for (let k = 0; k < n; k++) { const d = Math.abs(al[k] - z); if (d < bd) { bd = d; best = lat[k]; } } return best; };
      const base = br.waterH - 3;
      for (let k = 0; k <= nP; k++) {
        const z = -span + k * 2 * span / nP; const top = hAt(z) - 0.9; const x = latAt(z);
        if (style === 'wood') { for (const sx of [-1, 1]) b.cyl(x + sx * 2.3, base, z, .22, .26, top - base, sd, 6); b.box(x, top - .6, z, 5.4, .3, .3, sd); }
        else { b.box(x, base, z, 6.6, top - base, 1.8, sd); b.box(x, base, z, 7.4, br.waterH - base + 0.6, 2.6, sd); }
      }
      if (style !== 'wood') for (let k = 0; k < nP; k++) {
        const z0 = -span + k * 2 * span / nP, z1 = z0 + 2 * span / nP, zm = (z0 + z1) / 2; const dTop = Math.min(hAt(z0), hAt(z1)) - 0.9;
        const r = Math.max(0.8, (z1 - z0) / 2 - 0.85); const x = latAt(zm);
        { const wx = br.x + x * br.tz + zm * br.tx, wz = br.z - x * br.tx + zm * br.tz; if (W.height(wx, wz) > dTop - r * 0.4) continue; }
        b.arch(x, dTop - r, zm, r, 6.3, 0x6e665a);
        for (const sx of [-1, 1]) { b.box(x + sx * 3.05, dTop - r * 0.45, z0 + 0.6, .3, r * 0.45 + 0.05, (z1 - z0) * 0.22, sd); b.box(x + sx * 3.05, dTop - r * 0.45, z1 - 0.6 - (z1 - z0) * 0.22, .3, r * 0.45 + 0.05, (z1 - z0) * 0.22, sd); }
        b.box(x, dTop - r - 0.02, z0 + 0.9, 6.3, 0.06 + 0, 0.01, sd);
      }
      // abutments where the bridge meets the banks
      for (const s2 of [-1, 1]) { const z = s2 * (span + 2.5); const top = hAt(z) - 0.9; const x = latAt(z); b.box(x, base, z, 7.2, top - base, 5, sd); }
      b.pop();
      // keep walkers on the deck
      for (const sx of [-1, 1]) {
        const pts = []; for (let k = 0; k < n; k++) { const lx = lat[k] + sx * 2.85, lz = al[k]; if (Math.abs(lz) > span + 2) continue; pts.push([br.x + lx * br.tz + lz * br.tx, br.z - lx * br.tx + lz * br.tz]); }
        for (let k = 0; k < pts.length - 1; k++) addCollider({ seg: [pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1]], r: 0.3 });
      }
    }
    if (b.empty) return;
    const m = new THREE.Mesh(b.geometry(), objMat); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; scene.add(m);
  }

  // ---------- colliders ----------
  const colHash = new Map();
  const ckey = (ix, iz) => (ix + 2000) * 5000 + (iz + 2000);
  function addCollider(c) {
    let x0, x1, z0, z1;
    if (c.rect) { const [cx, cz, hw, hd] = c.rect; const r = Math.hypot(hw, hd); x0 = cx - r; x1 = cx + r; z0 = cz - r; z1 = cz + r; }
    else if (c.seg) { x0 = Math.min(c.seg[0], c.seg[2]) - c.r; x1 = Math.max(c.seg[0], c.seg[2]) + c.r; z0 = Math.min(c.seg[1], c.seg[3]) - c.r; z1 = Math.max(c.seg[1], c.seg[3]) + c.r; }
    else { x0 = c.x - c.r; x1 = c.x + c.r; z0 = c.z - c.r; z1 = c.z + c.r; }
    for (let ix = Math.floor(x0 / 32); ix <= Math.floor(x1 / 32); ix++) for (let iz = Math.floor(z0 / 32); iz <= Math.floor(z1 / 32); iz++) {
      const k = ckey(ix, iz); let a = colHash.get(k); if (!a) { a = []; colHash.set(k, a); } a.push(c);
    }
  }
  function addLocalColliders(res, ox, oz, ry, scale = 1) {
    const cs = Math.cos(ry), sn = Math.sin(ry);
    const tr = (x, z) => [ox + (x * cs + z * sn) * scale, oz + (-x * sn + z * cs) * scale];
    if (res.colliders) for (const c of res.colliders) {
      if (c.seg) { const a = tr(c.seg[0], c.seg[1]), b = tr(c.seg[2], c.seg[3]); addCollider({ seg: [a[0], a[1], b[0], b[1]], r: c.r * scale }); }
      else { const p = tr(c.c[0], c.c[1]); addCollider({ x: p[0], z: p[1], r: c.r * scale }); }
    } else if (res.r > 0) addCollider({ x: ox, z: oz, r: res.r * scale });
  }
  function resolveCollisions(p) {
    const ix = Math.floor(p.x / 32), iz = Math.floor(p.z / 32); const PR = 0.45;
    for (let it = 0; it < 2; it++) for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const arr = colHash.get(ckey(ix + a, iz + b)); if (!arr) continue;
      for (const c of arr) {
        if (c.rect) {
          const [rx, rz, hw, hd, ry] = c.rect; const cs = Math.cos(ry), sn = Math.sin(ry);
          const dx = p.x - rx, dz = p.z - rz; const lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
          const ex = hw + PR, ez = hd + PR;
          if (Math.abs(lx) < ex && Math.abs(lz) < ez) {
            const px = ex - Math.abs(lx), pz = ez - Math.abs(lz); let nx = lx, nz = lz;
            if (px < pz) nx = Math.sign(lx || 1) * ex; else nz = Math.sign(lz || 1) * ez;
            p.x = rx + nx * cs + nz * sn; p.z = rz - nx * sn + nz * cs;
          }
          continue;
        }
        let cx, cz;
        if (c.seg) { const [x1, z1, x2, z2] = c.seg; const dx = x2 - x1, dz = z2 - z1; let t = ((p.x - x1) * dx + (p.z - z1) * dz) / (dx * dx + dz * dz || 1); t = clamp(t, 0, 1); cx = x1 + dx * t; cz = z1 + dz * t; }
        else { cx = c.x; cz = c.z; }
        const ex = p.x - cx, ez = p.z - cz; const d = Math.hypot(ex, ez); const need = c.r + PR;
        if (d < need) { if (d < 1e-4) { p.x += need; continue; } p.x = cx + ex / d * need; p.z = cz + ez / d * need; }
      }
    }
  }

  // ---------- road props ----------
  const propBuckets = new Map(); const CH = 128;
  const chKey = (cx, cz) => (cx + 2000) * 5000 + (cz + 2000);
  function planProps() {
    const P = W.P;
    const hexi = new Set(['dunhuang', 'jiuquan', 'zhangye', 'wuwei', 'hami', 'lop']);
    for (const e of W.edges) {
      const A = W.cityById[e.a], Bc = W.cityById[e.b];
      const isHexi = hexi.has(e.a) && hexi.has(e.b);
      for (let j = 0; j < e.n; j += 5) {
        const i = e.start + j; const x = P.X[i], z = P.Z[i];
        const dA = Math.hypot(x - A.x, z - A.z), dB = Math.hypot(x - Bc.x, z - Bc.z);
        if (dA < A.R + 14 || dB < Bc.R + 14) continue;
        const cul = (dA < dB ? A : Bc).culture;
        const i1 = Math.min(e.start + e.n - 1, i + 1), i0 = Math.max(e.start, i - 1);
        let tx = P.X[i1] - P.X[i0], tz = P.Z[i1] - P.Z[i0]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
        const plan = [];
        if (j % 70 === 35) plan.push({ t: cul === 'chinese' || cul === 'song' ? 'milestone' : cul === 'tibet' ? 'chorten' : (cul === 'mongol' || cul === 'steppe') ? 'ovoo' : 'cairn', off: 3.4, side: (j / 70 | 0) % 2 ? 1 : -1 });
        if (j % 230 === 115) {
          const big = { persian: 'serai', rum: 'serai', central: 'serai', arab: 'serai', armenian: 'serai', georgian: 'cairn', byz: 'cairn', tarim: 'beacon', chinese: 'pavilion', song: 'pavilion', tibet: 'flags', mongol: 'yurts', steppe: 'yurts', yemen: 'serai', indian: 'serai', sea: 'pavilion' }[cul] || 'cairn';
          const off = { serai: 14, beacon: 10, pavilion: 6.5, flags: 6, yurts: 16, cairn: 4 }[big];
          plan.push({ t: big, off, side: (j / 230 | 0) % 2 ? -1 : 1, r: { serai: 6.5, beacon: 2.4, pavilion: 2.8, yurts: 0, flags: 0.5, cairn: 1.2 }[big] });
        }
        if (isHexi && j % 30 === 0) plan.push({ t: 'hanwall', off: 17, side: 1, along: true });
        if (isHexi && j % 90 === 45) plan.push({ t: 'beacon', off: 11, side: -1, r: 2.4 });
        for (const pl of plan) {
          const px = x - tz * pl.off * pl.side, pz = z + tx * pl.off * pl.side;
          const q = W.pathQuery(px, pz); if (q.d < pl.off - 2.5) continue;
          const rq = W.riverQuery(px, pz); if (rq.i >= 0 && rq.d < rq.hw + 5) continue;
          const nc = W.nearestCity(px, pz); if (nc.d < nc.c.R + 6) continue;
          let ry = Math.atan2(-tz * pl.side * -1, tx * pl.side * -1); // face road
          ry = Math.atan2(x - px, z - pz);
          if (pl.along) ry = Math.atan2(tz, -tx) + Math.PI / 2;
          const item = { t: pl.t, x: px, z: pz, ry, seed: i };
          const k = chKey(Math.floor(px / CH), Math.floor(pz / CH)); let a = propBuckets.get(k); if (!a) { a = []; propBuckets.set(k, a); } a.push(item);
          if (pl.r) { addCollider({ x: px, z: pz, r: pl.r }); W.addFlat(px, pz, pl.r + 1.5, 8); }
          if (pl.t === 'yurts') { const cs = Math.cos(ry), sn = Math.sin(ry); for (let k2 = 0; k2 < 3; k2++) { const lx = k2 * 5 - 5; addCollider({ x: px + lx * cs, z: pz - lx * sn, r: 2.0 }); } }
        }
      }
    }
  }

  // ---------- terrain chunks ----------
  const chunks = new Map(); let VIEW = Q.view;
  const LODSEG = [64, 32, 12];
  const tmpH = new Float32Array(67 * 67);
  function chunkCities(x0, z0) {
    const pad = 160; return W.cities.filter(c => c.x > x0 - pad && c.x < x0 + CH + pad && c.z > z0 - pad && c.z < z0 + CH + pad);
  }
  function buildTerrain(cx, cz, lod) {
    const seg = LODSEG[lod], step = CH / seg, n = seg + 1, N = n + 2; const x0 = cx * CH, z0 = cz * CH;
    const cand = chunkCities(x0, z0); W.cityCand = cand.length ? cand : null;
    const hs = tmpH; const info = new Array(n * n);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = x0 + (i - 1) * step, z = z0 + (j - 1) * step;
      hs[j * N + i] = W.height(x, z);
      if (i >= 1 && j >= 1 && i <= n && j <= n) { const o = W.OUT; info[(j - 1) * n + (i - 1)] = [o.pd, o.cd, o.city, o.rd, o.rhw, o.sea, o.lake, o.lakeLevel, o.vil, o.vd]; }
    }
    W.cityCand = null;
    const skirt = lod === 0 ? 4 : lod === 1 ? 8 : 18;
    const nv = n * n + 4 * n; const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const v = j * n + i; const x = x0 + i * step, z = z0 + j * step; const h = hs[(j + 1) * N + i + 1];
      pos[v * 3] = x; pos[v * 3 + 1] = h; pos[v * 3 + 2] = z;
      let nx = hs[(j + 1) * N + i] - hs[(j + 1) * N + i + 2], ny = 2 * step, nz = hs[j * N + i + 1] - hs[(j + 2) * N + i + 1];
      const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
      nor[v * 3] = nx; nor[v * 3 + 1] = ny; nor[v * 3 + 2] = nz;
      const c = terrainColor(x, z, h, ny, info[v]);
      const cav = (hs[(j + 1) * N + i] + hs[(j + 1) * N + i + 2] + hs[j * N + i + 1] + hs[(j + 2) * N + i + 1]) * 0.25 - h;
      const ao = 1 - clamp(cav / step * 0.45, -0.08, 0.28);
      col[v * 3] = c[0] * ao; col[v * 3 + 1] = c[1] * ao; col[v * 3 + 2] = c[2] * ao;
    }
    // skirts
    const edgesIdx = [[], [], [], []];
    for (let k = 0; k < n; k++) { edgesIdx[0].push(k); edgesIdx[1].push((n - 1) * n + k); edgesIdx[2].push(k * n); edgesIdx[3].push(k * n + n - 1); }
    let sv = n * n; const idx = [];
    for (let j = 0; j < seg; j++) for (let i = 0; i < seg; i++) { const a = j * n + i, b = a + 1, c = a + n, d = c + 1; idx.push(a, c, b, b, c, d); }
    edgesIdx.forEach((list, ei) => {
      const base = sv;
      for (const v of list) { pos[sv * 3] = pos[v * 3]; pos[sv * 3 + 1] = pos[v * 3 + 1] - skirt; pos[sv * 3 + 2] = pos[v * 3 + 2]; nor.copyWithin(sv * 3, v * 3, v * 3 + 3); col.copyWithin(sv * 3, v * 3, v * 3 + 3); sv++; }
      for (let k = 0; k < n - 1; k++) { const a = list[k], b = list[k + 1], c = base + k, d = base + k + 1; idx.push(a, b, c, b, d, c, a, c, b, b, c, d); }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(idx); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, terrainMat); m.receiveShadow = true; m.castShadow = lod === 0;
    return m;
  }
  // ---- farmland & orchards: one plot system shared by terrain colour and vegetation ----
  const PI = { fm: 0, orch: false, kind: '', col: null, ang: 0 };
  function regionAngle(x, z) { return W.noise3(x * 0.0007, z * 0.0007) * 1.4; }
  function orchardKind(lon, lat, ph) {
    if (lon < 44 && lat < 41.6 && lat > 33) return 'olive';
    if (lat < 34.5 && lon < 62) return 'date';
    if (lon < 103) return ph < 0.5 ? 'vine' : 'fruit';
    if (lat < 28.5) return 'tea';
    if (lat < 33) return 'mulberry';
    return 'fruit';
  }
  function plotInfo(x, z, ny, pd, sea, lake, city, cd, vil, vd) {
    PI.fm = 0; PI.orch = false;
    let fm = 0;
    if (city && cd > city.R + 4 && cd < city.R + 120 && city.culture !== 'mongol' && city.culture !== 'tibet') fm = smooth(city.R + 120, city.R + 50, cd) * smooth(city.R + 4, city.R + 12, cd);
    if (vil && vil.type !== 'nomad' && vd > vil.r - 1 && vd < vil.r + 65) fm = Math.max(fm, smooth(vil.r + 65, vil.r + 24, vd));
    fm = Math.max(fm, smooth(0.3, 0.72, W.settleAt(x, z)) * 0.95);
    if (fm <= 0 || ny < 0.9 || pd < 4.5 || sea > 0.05 || lake > 0.05) return PI;
    if (W.noise(x * 0.0055 + 11, z * 0.0055) < -0.5) return PI;
    fm *= smooth(4.5, 8, pd) * smooth(0.9, 0.95, ny);
    const ang = regionAngle(x, z); const ca = Math.cos(ang), sa = Math.sin(ang);
    const u = x * ca + z * sa, v = -x * sa + z * ca;
    const pu = Math.floor(u / 17), pv = Math.floor(v / 25); const ph = ((((pu * 73856093) ^ (pv * 19349663)) >>> 0) % 10007) / 10007;
    const ll = W.toLL(x, z); const lon = ll[0], lat = ll[1];
    PI.fm = fm; PI.ang = ang; PI.u = u; PI.v = v;
    PI.orch = ph < 0.17; PI.kind = PI.orch ? orchardKind(lon, lat, (ph * 7) % 1) : '';
    const rice = lon > 103 && lat < 33.2;
    const FC = rice ? [[.36, .62, .28], [.5, .72, .34], [.52, .68, .62], [.42, .66, .3], [.6, .74, .66]] : lat > 45 ? [[.7, .72, .4], [.6, .68, .34]] :
      lon > 103 ? [[.76, .7, .38], [.58, .66, .32], [.66, .58, .36], [.82, .74, .42]] : [[.8, .68, .34], [.56, .66, .3], [.62, .5, .33], [.86, .76, .42], [.5, .62, .3]];
    let c = FC[Math.floor(ph * 97) % FC.length];
    if (PI.orch) c = PI.kind === 'olive' ? [.72, .66, .44] : PI.kind === 'date' ? [.78, .7, .5] : PI.kind === 'tea' ? [.4, .56, .3] : [.56, .62, .36];
    const furrow = Math.sin(u * (rice ? 1.2 : 2.6)) > 0.35 ? 0.93 : 1;
    const fu = u / 17 - pu, fv = v / 25 - pv; const border = (fu < 0.035 || fu > 0.965 || fv < 0.025 || fv > 0.975) ? (rice ? 1.12 : 0.86) : 1;
    PI.col = [c[0] * furrow * border, c[1] * furrow * border, c[2] * furrow * border];
    return PI;
  }
  const TC = [0, 0, 0];
  function terrainColor(x, z, h, ny, inf) {
    const [pd, cd, city, rd, rhw, sea, lake, lakeLevel, vil, vd] = inf;
    const ll = W.toLL(x, z); const bi = W.bioIndex(ll[0], ll[1]); const bio = W.bio;
    const n = W.noise(x * 0.018, z * 0.018) * 0.5 + 0.5, n2 = W.noise3(x * 0.09, z * 0.09);
    const t = clamp(n * 1.3 - 0.15, 0, 1);
    let r = lerp(bio.gr[bi], bio.ar[bi], t) + n2 * 0.035, g = lerp(bio.gg[bi], bio.ag[bi], t) + n2 * 0.035, b = lerp(bio.gb[bi], bio.ab[bi], t) + n2 * 0.025;
    const dom = W.BIOME_KEYS[bio.dom[bi]];
    // slope -> rock
    const rock = smooth(0.88, 0.66, ny);
    if (rock > 0) {
      let rc = dom === 'tibet' || dom === 'alpine' || dom === 'caucasus' ? [.63, .6, .56] : dom === 'flaming' ? [.66, .32, .2] : dom === 'southchina' || dom === 'pontic' ? [.45, .48, .4] : [.62, .53, .44];
      r = lerp(r, rc[0], rock * .85); g = lerp(g, rc[1], rock * .85); b = lerp(b, rc[2], rock * .85);
    }
    // altitude tint
    const alt = smooth(30, 140, h) * 0.12; r = lerp(r, .62, alt); g = lerp(g, .6, alt); b = lerp(b, .58, alt);
    // snow
    const sl = bio.snow[bi] + W.noise(x * 0.03, z * 0.03) * 9;
    if (h > sl - 10) { const s = smooth(sl - 4, sl + 6, h) * smooth(0.45, 0.7, ny); r = lerp(r, .95, s); g = lerp(g, .96, s); b = lerp(b, .99, s); }
    // water edges
    if (sea > 0.02 || lake > 0.02) {
      const lvl = lake > sea ? lakeLevel : 0; const bt = smooth(lvl + 2.6, lvl + 0.6, h) * smooth(0.6, 0.85, ny);
      r = lerp(r, .87, bt); g = lerp(g, .8, bt); b = lerp(b, .62, bt);
      if (h < lvl - 0.5) { r = .5; g = .58; b = .5; }
    }
    // rivers: lush banks
    if (rd < rhw + 16) {
      const gt = smooth(rhw + 16, rhw + 2, rd) * 0.55; r = lerp(r, .44, gt); g = lerp(g, .6, gt); b = lerp(b, .31, gt);
      if (rd < rhw + 1) { r = .5; g = .52; b = .42; }
    }
    // farmland, rice paddies, orchards and vineyards
    { const pl = plotInfo(x, z, ny, pd, sea, lake, city, cd, vil, vd);
      if (pl.fm > 0) { r = lerp(r, pl.col[0], pl.fm * .85); g = lerp(g, pl.col[1], pl.fm * .85); b = lerp(b, pl.col[2], pl.fm * .85); } }
    if (vil && vd < vil.r + 2) { const t2 = smooth(vil.r + 2, vil.r - 3, vd) * .6; const cg = CULTURE_GROUND[vil.culture] || [.75, .68, .55]; r = lerp(r, cg[0], t2); g = lerp(g, cg[1], t2); b = lerp(b, cg[2], t2); }
    // road dust
    if (pd < 5.5) { const dt = smooth(5.5, 1.8, pd) * 0.7; r = lerp(r, .8, dt); g = lerp(g, .71, dt); b = lerp(b, .55, dt); }
    // city ground
    if (city && cd < city.R + 2) { const ct = smooth(city.R + 2, city.R - 5, cd) * 0.82; const cg = CULTURE_GROUND[city.culture] || [.78, .7, .58]; r = lerp(r, cg[0] + n2 * .03, ct); g = lerp(g, cg[1] + n2 * .03, ct); b = lerp(b, cg[2] + n2 * .03, ct); }
    TC[0] = lin(clamp(r, 0, 1)); TC[1] = lin(clamp(g, 0, 1)); TC[2] = lin(clamp(b, 0, 1));
    return TC;
  }
  // vegetation
  const TREE_SET = ['conifer', 'pine', 'broad', 'olive', 'willow', 'poplar', 'cypress', 'palm', 'bamboo', 'shrub', 'saxaul', 'tuft', 'rock'];
  // far-distance tree impostors: one low double-pyramid per tree, coloured like its canopy
  const IMP = {};
  function impShape(type) {
    if (IMP[type] !== undefined) return IMP[type]; const tg = B.treeGeoLow(type) || B.treeGeo(type); if (!tg) return (IMP[type] = null);
    const P = tg.pos, C = tg.col; let ymax = 0, rmax = 0, cr = 0, cg = 0, cb = 0, cn = 0; for (let v = 0; v < P.length; v += 3) { ymax = Math.max(ymax, P[v + 1]); rmax = Math.max(rmax, Math.hypot(P[v], P[v + 2])); }
    for (let v = 0; v < P.length; v += 3) if (P[v + 1] > ymax * 0.4) { cr += C[v]; cg += C[v + 1]; cb += C[v + 2]; cn++; }
    if (!cn || ymax < 0.6) return (IMP[type] = null);
    const tall = ymax / Math.max(0.5, rmax) > 2.2; return (IMP[type] = { h: ymax, r: Math.min(rmax, ymax * 0.6), base: tall ? 0.12 : 0.32, mid: tall ? 0.38 : 0.6, c: [cr / cn, cg / cn, cb / cn] });
  }
  function buildImpostors(cx, cz, rng) {
    if (!Q.imp) return null; const x0 = cx * CH, z0 = cz * CH; const pos = [], col = [], sway = []; const tries = Math.round(150 * Q.imp);
    for (let k = 0; k < tries; k++) {
      const x = x0 + rng() * CH, z = z0 + rng() * CH; const ll = W.toLL(x, z); const bi = W.bioIndex(ll[0], ll[1]); const dens = W.bio.dens[bi];
      if (rng() > dens * 0.85) continue; const dom = W.BIOME_KEYS[W.bio.dom[bi]]; const weights = BIOMES[dom].trees; let tot = 0; for (const t in weights) tot += weights[t]; if (tot <= 0) continue;
      let type, pr = rng() * tot; for (const t in weights) { pr -= weights[t]; if (pr <= 0) { type = t; break; } } if (!type || type === 'rock' || type === 'tuft') continue;
      const sh = impShape(type); if (!sh) continue; const h = W.height(x, z); const o = W.OUT;
      if (o.pd < 5 || (o.city && o.cd < o.city.R + 3) || o.sea > 0.3 || o.lake > 0.3 || h < 0.6 || o.rd < o.rhw + 2 || h > W.bio.snow[bi] - 6) continue;
      const s = 0.8 + rng() * 0.5, H = sh.h * s, R = sh.r * s * 1.1, y0 = h + H * sh.base, ym = h + H * sh.mid, y1 = h + H; const a0 = rng() * 1.57; const t = 0.86 + rng() * 0.24;
      const ring = []; for (let q = 0; q < 4; q++) { const a = a0 + q * Math.PI / 2; ring.push([x + Math.cos(a) * R, ym, z + Math.sin(a) * R]); }
      const top = [x, y1, z], bot = [x, y0, z]; const cT = [sh.c[0] * t * 1.08, sh.c[1] * t * 1.08, sh.c[2] * t * 1.08], cM = [sh.c[0] * t, sh.c[1] * t, sh.c[2] * t], cB = [sh.c[0] * t * .62, sh.c[1] * t * .62, sh.c[2] * t * .62];
      for (let q = 0; q < 4; q++) { const A = ring[q], Bq = ring[(q + 1) % 4]; pos.push(...top, ...Bq, ...A); col.push(...cT, ...cM, ...cM); pos.push(...bot, ...A, ...Bq); col.push(...cB, ...cM, ...cM); for (let i = 0; i < 6; i++) sway.push(0); }
    }
    if (!pos.length) return null;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('aSway', new THREE.Float32BufferAttribute(sway, 1)); g.computeVertexNormals(); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, vegMat); m.receiveShadow = false; return m;
  }
  function buildVeg(cx, cz, lod) {
    const x0 = cx * CH, z0 = cz * CH; const rng = W.rng(cx * 7919 + cz * 104729 + 13);
    const cand = chunkCities(x0, z0); W.cityCand = cand.length ? cand : null;
    const pos = [], col = [], sway = [];
    if (lod === 2) { const im = buildImpostors(cx, cz, rng); W.cityCand = null; return [im, null]; }
    const tries = Math.round((lod === 0 ? 540 : 290) * Q.veg);
    for (let k = 0; k < tries; k++) {
      const x = x0 + rng() * CH, z = z0 + rng() * CH;
      const ll = W.toLL(x, z); const bi = W.bioIndex(ll[0], ll[1]);
      let dens = W.bio.dens[bi]; const dom = W.BIOME_KEYS[W.bio.dom[bi]];
      const rq = W.riverQuery(x, z); const nearRiver = rq.i >= 0 && rq.d < rq.hw + 20;
      if (nearRiver) dens = Math.max(dens, 0.5);
      const nc0 = W.nearestCity(x, z); if (nc0.d < nc0.c.R + 30 && nc0.d > nc0.c.R + 3 && ['sand', 'gobi', 'iran', 'mesopotamia', 'tibet', 'steppe', 'loess'].includes(dom)) dens = Math.max(dens, 0.55);
      if (rng() > dens) continue;
      const h = W.height(x, z); const o = W.OUT;
      { const pl = plotInfo(x, z, 0.97, o.pd, o.sea, o.lake, o.city, o.cd, o.vil, o.vd); if (pl.fm > 0.15 && rng() < pl.fm * 0.9) continue; }
      if (o.pd < 4.5 || (o.city && o.cd < o.city.R + 2.5) || (o.vil && o.vd < o.vil.r + 2) || o.sea > 0.3 || o.lake > 0.3 || h < 0.6) continue;
      if (o.rd < o.rhw + 1.8) continue;
      const sl = W.bio.snow[bi]; if (h > sl - 6) continue;
      const h2 = W.height(x + 2, z); if (Math.abs(h2 - h) > 1.6) { if (rng() < 0.7) continue; }
      // choose type
      let type;
      const weights = (nearRiver || (nc0.d < nc0.c.R + 30)) && ['sand', 'gobi', 'iran', 'mesopotamia', 'loess', 'steppe', 'oasis', 'tibet'].includes(dom)
        ? (ll[0] > 103 ? { willow: .5, poplar: .3, sophora: .2 } : ll[0] > 76 && ll[0] <= 103 ? { poplar: .45, tograk: .35, tamarisk: .2 } : (ll[1] < 34 && ll[0] < 62) ? { date: .7, tamarisk: .3 } : dom === 'tibet' ? { poplar: .5, shrub: .5 } : { poplar: .45, plane: .25, mulberry: .3 })
        : BIOMES[dom].trees;
      let tot = 0; for (const t in weights) tot += weights[t]; if (tot <= 0) continue;
      let pr = rng() * tot; for (const t in weights) { pr -= weights[t]; if (pr <= 0) { type = t; break; } }
      if (!type) continue;
      const tg = lod === 0 ? B.treeGeo(type) : B.treeGeoLow(type); if (!tg) continue;
      const s = type === 'rock' ? 0.5 + rng() * 2.2 : 0.75 + rng() * 0.6; const ry = rng() * Math.PI * 2; const cs = Math.cos(ry) * s, sn = Math.sin(ry) * s;
      const tint = 0.86 + rng() * 0.26, tr = tint * (0.96 + rng() * 0.08);
      const P = tg.pos, Cc = tg.col; const yb = h - 0.15;
      const sw = type === 'rock' ? 0 : 1;
      for (let v = 0; v < P.length; v += 3) {
        const lx = P[v], ly = P[v + 1], lz = P[v + 2];
        pos.push(x + lx * cs + lz * sn, yb + ly * s, z - lx * sn + lz * cs);
        col.push(Cc[v] * tr, Cc[v + 1] * tint, Cc[v + 2] * tint); sway.push(ly * s * sw);
      }
      // undergrowth: shrubs and saplings around trees in wooded country
      if (type !== 'rock' && dens > 0.3 && rng() < 0.5 * Q.veg) { const ug = lod === 0 ? B.treeGeo('shrub') : B.treeGeoLow('shrub'); if (ug) for (let q = 0, qn = 1 + (rng() * 2 | 0); q < qn; q++) {
        const a = rng() * 6.28, rr = 1.6 + rng() * 2.4; const ux = x + Math.cos(a) * rr, uz = z + Math.sin(a) * rr; const uh = W.height(ux, uz); const uo = W.OUT; if (uo.pd < 4 || uo.rd < uo.rhw + 1.5) continue;
        const us = 0.5 + rng() * 0.45, ur = rng() * 6.28, uc = Math.cos(ur) * us, un = Math.sin(ur) * us; const ut = 0.85 + rng() * 0.25; const UP = ug.pos, UC = ug.col;
        for (let v = 0; v < UP.length; v += 3) { const lx = UP[v], ly = UP[v + 1], lz = UP[v + 2]; pos.push(ux + lx * uc + lz * un, uh - 0.1 + ly * us, uz - lx * un + lz * uc); col.push(UC[v] * ut, UC[v + 1] * ut, UC[v + 2] * ut); sway.push(ly * us); } } }
    }
    // orchards, olive groves, vineyards and tea gardens in neat rows
    {
      const ang = regionAngle(x0 + CH / 2, z0 + CH / 2); const ca = Math.cos(ang), sa = Math.sin(ang);
      const sp = lod === 0 ? 5.5 : 7; const cx0 = x0 + CH / 2, cz0 = z0 + CH / 2; const ext = CH * 0.75;
      const u0 = cx0 * ca + cz0 * sa, v0 = -cx0 * sa + cz0 * ca;
      for (let uu = Math.floor((u0 - ext) / sp) * sp; uu < u0 + ext; uu += sp) for (let vv = Math.floor((v0 - ext) / sp) * sp; vv < v0 + ext; vv += sp) {
        const x = uu * ca - vv * sa, z = uu * sa + vv * ca; if (x < x0 || x >= x0 + CH || z < z0 || z >= z0 + CH) continue;
        const h = W.height(x, z); const o = W.OUT; const h2 = W.height(x + 1.5, z); const ny = 1.5 / Math.hypot(1.5, h2 - h);
        const pl = plotInfo(x, z, ny, o.pd, o.sea, o.lake, o.city, o.cd, o.vil, o.vd);
        if (!pl.orch || pl.fm < 0.45 || o.rd < o.rhw + 2) continue;
        const fu = pl.u / 17 - Math.floor(pl.u / 17), fv = pl.v / 25 - Math.floor(pl.v / 25); if (fu < .08 || fu > .92 || fv < .06 || fv > .94) continue;
        const type = pl.kind; const tg = lod === 0 ? B.treeGeo(type) : B.treeGeoLow(type); if (!tg) continue;
        const s = (type === 'vine' || type === 'tea' ? 0.9 : 0.7) + rng() * 0.2; const ry = type === 'vine' ? -ang : rng() * 6.28; const cs = Math.cos(ry) * s, sn = Math.sin(ry) * s;
        const P = tg.pos, Cc = tg.col; const tint = 0.9 + rng() * 0.15;
        for (let v = 0; v < P.length; v += 3) { const lx = P[v], ly = P[v + 1], lz = P[v + 2]; pos.push(x + lx * cs + lz * sn, h - 0.1 + ly * s, z - lx * sn + lz * cs); col.push(Cc[v] * tint, Cc[v + 1] * tint, Cc[v + 2] * tint); sway.push(ly * s * .6); }
      }
    }
    // ground clutter: grass tufts, flowers, pebbles (only close to the player)
    if (lod === 0) {
      for (let k = 0, kn = Math.round(900 * Q.clutter); k < kn; k++) {
        const x = x0 + rng() * CH, z = z0 + rng() * CH;
        const ll = W.toLL(x, z); const bi = W.bioIndex(ll[0], ll[1]); const dom = W.BIOME_KEYS[W.bio.dom[bi]];
        const gr = W.bio.gr[bi], gg = W.bio.gg[bi];
        const lush = gg > gr + 0.02;
        if (dom === 'sand' && rng() < .75) continue;
        const h = W.height(x, z); const o = W.OUT;
        if (o.pd < 2.6 || (o.city && o.cd < o.city.R - 1) || (o.vil && o.vd < o.vil.r) || o.sea > 0.2 || o.lake > 0.2 || o.rd < o.rhw + 1 || h > W.bio.snow[bi] - 8) continue;
        const nearRiver = o.rd < o.rhw + 14;
        let type;
        const rr = rng();
        if (dom === 'steppe') type = rr < .3 ? 'feather' : rr < .36 ? 'tulip' : rr < .4 ? 'pebbles' : 'grass';
        else if (lush || nearRiver) type = rr < .09 ? ['flowerR', 'flowerY', 'flowerW', 'flowerB'][(rng() * 4) | 0] : rr < .15 ? 'pebbles' : 'grass';
        else type = rr < .45 ? 'pebbles' : 'dry';
        if (dom === 'tibet' && rr < .5) type = 'grass';
        const tg = B.treeGeo(type); const s = 0.8 + rng() * 0.8; const ry = rng() * 6.28; const cs = Math.cos(ry) * s, sn = Math.sin(ry) * s;
        const base = type === 'grass' || type === 'dry' ? [lin(gr * .8), lin(gg * .85), lin(W.bio.gb[bi] * .7)] : null;
        const P = tg.pos, Cc = tg.col;
        for (let v = 0; v < P.length; v += 3) {
          const lx = P[v], ly = P[v + 1], lz = P[v + 2];
          pos.push(x + lx * cs + lz * sn, h - 0.04 + ly * s, z - lx * sn + lz * cs);
          if (base && type === 'grass') { const t = ly > .1 ? 1.35 : .8; col.push(base[0] * t, base[1] * t, base[2] * t); }
          else col.push(Cc[v], Cc[v + 1], Cc[v + 2]);
          sway.push(type === 'pebbles' ? 0 : ly * 3);
        }
      }
    }
    // props
    const props = propBuckets.get(chKey(cx, cz));
    let pm = null;
    if (props) {
      const b = new B.Builder();
      for (const it of props) {
        const h = W.height(it.x, it.z); b.rng = W.rng(it.seed);
        b.push(it.x, h - 0.25, it.z, it.ry); B.PROP[it.t](b, b.rng); b.pop();
      }
      if (!b.empty) { pm = new THREE.Mesh(b.geometry(), objMat); pm.castShadow = true; pm.receiveShadow = true; }
    }
    W.cityCand = null;
    let vm = null;
    if (pos.length) {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('aSway', new THREE.Float32BufferAttribute(sway, 1));
      g.computeVertexNormals(); g.computeBoundingSphere();
      vm = new THREE.Mesh(g, vegMat); vm.castShadow = lod === 0; vm.receiveShadow = true;
    }
    return [vm, pm];
  }
  function desiredLod(d) { return d < 200 ? 0 : d < 540 ? 1 : 2; }
  function chunkDist(cx, cz, px, pz) { const dx = clamp(px, cx * CH, cx * CH + CH) - px, dz = clamp(pz, cz * CH, cz * CH + CH) - pz; return Math.hypot(dx, dz); }
  function buildChunk(cx, cz, lod) {
    const key = chKey(cx, cz); let c = chunks.get(key);
    const terrain = buildTerrain(cx, cz, lod);
    let veg = null, props = null;
    if (lod <= 1 || Q.imp) [veg, props] = buildVeg(cx, cz, lod);
    if (c) disposeChunk(c);
    c = { cx, cz, lod, terrain, veg, props };
    scene.add(terrain); if (veg) scene.add(veg); if (props) scene.add(props);
    chunks.set(key, c);
  }
  function disposeChunk(c) {
    for (const m of [c.terrain, c.veg, c.props]) if (m) { scene.remove(m); m.geometry.dispose(); }
  }
  function updateChunks(px, pz, budgetMs, force) {
    const t0 = performance.now(); const pcx = Math.floor(px / CH), pcz = Math.floor(pz / CH); const R = Math.ceil(VIEW / CH);
    const need = [];
    for (let a = -R; a <= R; a++) for (let b = -R; b <= R; b++) {
      const cx = pcx + a, cz = pcz + b; const d = chunkDist(cx, cz, px, pz); if (d > VIEW) continue;
      const lod = desiredLod(d); const c = chunks.get(chKey(cx, cz));
      if (!c) need.push([d, cx, cz, lod]);
      else if (c.lod !== lod) { if (lod < c.lod || Math.abs(d - [200, 540][Math.min(lod, c.lod)]) > 30) need.push([d + (lod < c.lod ? 0 : 400), cx, cz, lod]); }
    }
    need.sort((a, b) => a[0] - b[0]);
    for (const [d, cx, cz, lod] of need) {
      if (!force && performance.now() - t0 > budgetMs) break;
      if (force && d > force) break;
      buildChunk(cx, cz, lod);
    }
    for (const [k, c] of chunks) { if (chunkDist(c.cx, c.cz, px, pz) > VIEW + 200) { disposeChunk(c); chunks.delete(k); } }
    return need.length;
  }

  // ---------- sites (cities & landmarks) ----------
  const sites = []; // {x,z, build(), group, built, r}
  const poiList = []; // for proximity toasts: {x,z,r,name,blurb,shown}
  function edgeSamplesFrom(city, e) {
    const P = W.P; const fromA = e.a === city.id; const arr = [];
    for (let j = 0; j < e.n; j++) { const i = e.start + (fromA ? j : e.n - 1 - j); arr.push(i); }
    return arr;
  }
  function bearing(a, b) {
    const ang = Math.atan2(b.lat - a.lat, (b.lon - a.lon) * Math.cos((a.lat + b.lat) / 2 * Math.PI / 180)) * 180 / Math.PI;
    const dirs = ['east', 'north-east', 'north', 'north-west', 'west', 'south-west', 'south', 'south-east'];
    return dirs[((Math.round(ang / 45) % 8) + 8) % 8];
  }
  function planCity(city, ci) {
    const P = W.P; city.gates = [];
    for (const ei of city.edges) {
      const e = W.edges[ei]; const s = edgeSamplesFrom(city, e); const other = W.cityById[e.a === city.id ? e.b : e.a];
      let gi = s.find(i => Math.hypot(P.X[i] - city.x, P.Z[i] - city.z) > city.R - 1.5) ?? s[s.length - 1];
      let si = s.find(i => Math.hypot(P.X[i] - city.x, P.Z[i] - city.z) > city.R + 4) ?? s[s.length - 1];
      const exitI = s.find(i => Math.hypot(P.X[i] - city.x, P.Z[i] - city.z) > city.R + 8) ?? s[s.length - 1];
      city.gates.push({ edge: ei, other: other.id, ang: Math.atan2(P.Z[gi] - city.z, P.X[gi] - city.x), gx: P.X[gi], gz: P.Z[gi], sign: si, exitI, km: e.km, dir: bearing(city, other), group: e.group });
    }
    // road corridor points inside city
    city.corr = []; city.corrLines = [];
    for (const ei of city.edges) { const e = W.edges[ei]; const line = []; for (const i of edgeSamplesFrom(city, e)) { const d = Math.hypot(P.X[i] - city.x, P.Z[i] - city.z); if (d > city.R + 6) break; city.corr.push([P.X[i] - city.x, P.Z[i] - city.z]); line.push([P.X[i] - city.x, P.Z[i] - city.z]); } if (line.length > 1) city.corrLines.push(line); }
    // also other roads passing through
    for (const e of W.edges) { if (e.a === city.id || e.b === city.id) continue; let line = []; for (let j = 0; j < e.n; j++) { const i = e.start + j; const dx = P.X[i] - city.x, dz = P.Z[i] - city.z; if (dx * dx + dz * dz < (city.R + 6) ** 2) { city.corr.push([dx, dz]); line.push([dx, dz]); } else if (line.length) { if (line.length > 1) city.corrLines.push(line); line = []; } } if (line.length > 1) city.corrLines.push(line); }
    sites.push({ x: city.x, z: city.z, kind: 'city', city, built: false, group: null });
  }
  function corrDist(city, x, z) { let m = 1e9; for (const p of city.corr) { const d = Math.hypot(p[0] - x, p[1] - z); if (d < m) m = d; } return m; }

  // ================= CITY GENERATOR (v3): streets, walls, houses along streets =================
  function OccGrid(R) {
    const n = Math.ceil(2 * R + 24); const o = -(R + 12); const cells = new Uint8Array(n * n);
    const idx = (x, z) => { const i = Math.floor(x - o), j = Math.floor(z - o); return (i < 0 || j < 0 || i >= n || j >= n) ? -1 : j * n + i; };
    return {
      n, o, cells,
      get: (x, z) => { const k = idx(x, z); return k < 0 ? 255 : cells[k]; },
      rect(cx, cz, w, d, ry, val, test) { // test mode returns true if all free
        const c = Math.cos(ry), s = Math.sin(ry); const ex = Math.abs(c) * w / 2 + Math.abs(s) * d / 2, ez = Math.abs(s) * w / 2 + Math.abs(c) * d / 2;
        for (let z = Math.floor(cz - ez); z <= cz + ez; z++) for (let x = Math.floor(cx - ex); x <= cx + ex; x++) {
          const px = x + .5 - cx, pz = z + .5 - cz; const lx = px * c - pz * s, lz = px * s + pz * c;
          if (Math.abs(lx) > w / 2 || Math.abs(lz) > d / 2) continue;
          const k = idx(x + .5, z + .5);
          if (test) { if (k < 0 || cells[k]) return false; } else if (k >= 0 && cells[k] < val) cells[k] = val;
        }
        return true;
      },
      circle(cx, cz, r, val, test) {
        for (let z = Math.floor(cz - r); z <= cz + r; z++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
          if ((x + .5 - cx) ** 2 + (z + .5 - cz) ** 2 > r * r) continue; const k = idx(x + .5, z + .5);
          if (test) { if (k < 0 || cells[k]) return false; } else if (k >= 0 && cells[k] < val) cells[k] = val;
        }
        return true;
      },
      polyline(pts, hw, val) { for (let i = 0; i < pts.length - 1; i++) { const [ax, az] = pts[i], [bx, bz] = pts[i + 1]; const L = Math.hypot(bx - ax, bz - az); const n2 = Math.ceil(L / 0.7); for (let k = 0; k <= n2; k++) { const t = k / n2; this.circle(ax + (bx - ax) * t, az + (bz - az) * t, hw, val); } } },
    };
  }
  function cityShape(city) {
    const ws = B.wallStyle(city.culture, city.id);
    const square = city.culture === 'chinese' || city.culture === 'song';
    const half = city.R * 0.7, rad = city.R - 2.5;
    const inside = (x, z, m) => square ? Math.max(Math.abs(x), Math.abs(z)) < half - m : Math.hypot(x, z) < (ws ? rad : city.R - 3) - m;
    return { ws, square, half, rad, inside };
  }
  function streetRibbon(streets, cg) {
    const pos = [], ar = [], cc = [], idx = [];
    const col = [lin(cg[0] * .95), lin(cg[1] * .93), lin(cg[2] * .9)];
    for (const st of streets) {
      const P = st.pts; if (P.length < 2) continue;
      for (let i = 0; i < P.length; i++) {
        const a = P[Math.max(0, i - 1)], b2 = P[Math.min(P.length - 1, i + 1)]; let tx = b2[0] - a[0], tz = b2[1] - a[1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
        const k2 = st.kind === 'lane' || st.kind === 'alley' ? 0.93 : 1; const yy = st.kind === 'main' || st.kind === 'avenue' ? 0.11 : 0.1;
        for (const s of [-1, 1]) { pos.push(P[i][0] - tz * st.hw * s, yy, P[i][1] + tx * st.hw * s); ar.push(s, 1); cc.push(col[0] * k2, col[1] * k2, col[2] * k2); }
        if (i > 0) { const k = pos.length / 3 - 4; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
      }
    }
    if (!pos.length) return null;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aRoad', new THREE.Float32BufferAttribute(ar, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(cc, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, roadMat); m.receiveShadow = true; return m;
  }
  function buildCitySite(site) { const gen = cityGen(site); let r; do { r = gen.next(); } while (!r.done); return r.value; }
  // ================= CITY GENERATOR v4: planned layouts by region =================
  //  grid    – Chinese/Song/Shangdu: square walls, cardinal gates, axial avenues, ward grid, hutong alleys, siheyuan compounds facing south, canals in the south
  //  islamic – Persia, Central Asia, Arab lands, Seljuk Anatolia, Tarim: irregular walls, bazaar spines gate→centre, maidan + Friday mosque, cul-de-sac quarters of courtyard houses
  //  byz     – Byzantine, Armenian, Georgian: Mese with colonnades to a forum, Roman-style street grid, terraced row houses, churches
  //  tibet   – unwalled, Barkhor circuit around the main temple
  //  camp    – Golden Horde / Chagatai towns: open grid of wide streets with yurt compounds and brick houses
  function polyPIP(x, z, P) { let ins = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, zi] = P[i], [xj, zj] = P[j]; if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi) + xi)) ins = !ins; } return ins; }
  function polyEdgeDist(x, z, P) { let m = 1e9; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [ax, az] = P[j], [bx, bz] = P[i]; const dx = bx - ax, dz = bz - az; let t = ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz); t = clamp(t, 0, 1); m = Math.min(m, Math.hypot(ax + dx * t - x, az + dz * t - z)); } return m; }
  function* cityGen(site) {
    const city = site.city; const rng = W.rng(W.cities.indexOf(city) * 31 + 7);
    const group = new THREE.Group(); group.position.set(city.x, city.h, city.z);
    const b = new B.Builder(); b.rng = rng; const bd = new B.Builder(); bd.rng = rng;
    const firstBuild = !city.collidersDone; const cul = city.culture; const R = city.R; const tier = city.tier; const CH = cul === 'indian' ? 'haveli' : cul === 'yemen' ? 'towerHouse' : 'courtyardHouse';
    const style = W.isSquare(city) ? 'grid' : (cul === 'byz' || cul === 'armenian' || cul === 'georgian') ? 'byz' : cul === 'tibet' ? 'tibet' : cul === 'mongol' ? 'camp' : 'islamic';
    const ws = style === 'grid' ? B.wallStyle(cul === 'mongol' ? 'chinese' : cul, city.id) : (style === 'tibet' || style === 'camp') ? null : B.wallStyle(cul, city.id);
    const half = R * 0.7, rad = R - 2.5;
    // wall outline
    let poly = null;
    if (style === 'grid') poly = [[-half, -half], [half, -half], [half, half], [-half, half]];
    else if (ws) { const n = 12 + tier * 3; const ph = rng() * 6; poly = []; for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; const rr = rad * (0.93 + 0.07 * Math.sin(a * 3 + ph) + 0.03 * Math.sin(a * 7 + ph * 2)); poly.push([Math.cos(a) * rr, Math.sin(a) * rr]); } }
    const inside = (x, z, m) => poly ? (polyPIP(x, z, poly) && polyEdgeDist(x, z, poly) > m) : Math.hypot(x, z) < R - 3 - m;
    const occ = OccGrid(R); const streets = [];
    const addStreet = (pts, hw, kind, cut = true) => {
      if (!cut) { streets.push({ pts, hw, kind }); occ.polyline(pts, hw, 1); return; }
      let cur = []; const P = W.resample(pts, 1.2);
      const flush = () => { if (cur.length >= 3) { streets.push({ pts: cur, hw, kind }); occ.polyline(cur, kind === 'lane' ? hw * 0.75 : hw, 1); } cur = []; };
      for (const p of P) { if (inside(p[0], p[1], hw + 0.8) && occ.get(p[0], p[1]) !== 2) cur.push(p); else flush(); }
      flush();
    };
    const mainLines = city.corrLines;
    const theta = mainLines.length ? Math.atan2(mainLines[0][Math.min(mainLines[0].length - 1, 8)][1], mainLines[0][Math.min(mainLines[0].length - 1, 8)][0]) : 0;
    // 1. caravan roads become the main streets
    for (const l of mainLines) addStreet(l.filter(p => Math.hypot(p[0], p[1]) < R + 6), style === 'grid' ? 3.6 : 3.0, 'main', false);
    // 2. primary civic spaces
    const paved = []; // {x,z,w,d,ry}
    const plaza = (x, z, w, d, ry) => { paved.push({ x, z, w, d, ry }); occ.rect(x, z, w, d, ry, 1); };
    if (style === 'grid') {
      for (const [ax, az, bx, bz] of [[0, -half - 4, 0, half + 4], [-half - 4, 0, half + 4, 0]]) addStreet([[ax, az], [bx, bz]], 3.6, 'avenue', false);
      plaza(0, 0, 16, 16, 0);
    } else if (style === 'islamic') { const s = tier >= 3 ? [30, 20] : tier >= 2 ? [20, 14] : [12, 10]; plaza(0, 0, s[0], s[1], -theta); }
    else if (style === 'byz') { const s = tier >= 3 ? 26 : 16; plaza(0, 0, s, s, -theta); }
    else plaza(0, 0, 14, 14, 0);
    occ.circle(0, 0, 8, 1);
    yield;
    // 3. landmarks
    const gateAngs = city.gates.map(g => g.ang);
    const angGap = a => { let m = 9; for (const g of gateAngs) { const d = Math.abs(((a - g + Math.PI * 3) % (Math.PI * 2)) - Math.PI); m = Math.min(m, d); } return m; };
    const extras = []; let mainLm = null;
    const lmsAll = LANDMARKS.filter(l => l.city === city.id);
    for (const lm of lmsAll) {
      const p = lm.p || {};
      if (lm.type === 'harbor') { extras.push(lm); continue; }
      const scratch = new B.Builder(); const res = B.LM[lm.type](scratch, p, W.rng(5), cul);
      let fp = res.r || 0; if (res.colliders) for (const c of res.colliders) fp = Math.max(fp, c.seg ? Math.max(Math.hypot(c.seg[0], c.seg[1]), Math.hypot(c.seg[2], c.seg[3])) + c.r : Math.hypot(c.c[0], c.c[1]) + c.r);
      if (lm.type === 'lake') fp = p.r + 2;
      const outside = lm.type === 'siege' || lm.type === 'mountainRock';
      const isFirst = lmsAll.indexOf(lm) === 0; const edgeLoving = lm.type === 'citadel' || lm.type === 'aqueduct';
      let best = null;
      if (!outside) for (let tries = 0; tries < 3 && !best; tries++) {
        const scale = [1, 0.85, 0.72][tries]; const r = fp * scale; let bestScore = -1e9;
        for (let ai = 0; ai < 72; ai++) {
          const a = ai / 72 * Math.PI * 2;
          for (let rr = 6; rr < R; rr += 2) {
            const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
            if (!inside(x, z, r * 0.9 + 1.5)) break;
            if (occ.circle(x, z, r * 0.92 + 1.4, 0, true)) {
              const sc = angGap(a) * 2 + (isFirst ? -rr * 0.03 : edgeLoving ? rr * 0.03 : -Math.abs(rr - R * 0.45) * 0.01) + rng() * 0.05;
              if (sc > bestScore) { bestScore = sc; best = { x, z, scale }; } break;
            }
          }
        }
      }
      if (!best) { let ba = 0, bs = -1; for (let ai = 0; ai < 36; ai++) { const a = ai / 36 * Math.PI * 2; const s2 = angGap(a); if (s2 > bs) { bs = s2; ba = a; } } const rr = R + fp + 5; best = { x: Math.cos(ba) * rr, z: Math.sin(ba) * rr, scale: 1, outside: true }; }
      const ry = style === 'grid' ? (Math.abs(best.x) > Math.abs(best.z) ? (best.x > 0 ? -Math.PI / 2 : Math.PI / 2) : (best.z > 0 ? Math.PI : 0)) : Math.atan2(-best.x, -best.z);
      occ.circle(best.x, best.z, fp * best.scale * 0.92 + 0.5, 2);
      const gh = best.outside ? W.height(city.x + best.x, city.z + best.z) - city.h : 0;
      if (lm.type === 'lake') buildCityLake(group, b, best.x, best.z, p, city);
      else { b.push(best.x, gh - 0.1, best.z, ry, best.scale); B.LM[lm.type](b, p, W.rng(9 + lmsAll.indexOf(lm)), cul); b.pop(); }
      if (lm.type === 'canalbridge') { const wg = new THREE.PlaneGeometry(36, 6.2); wg.rotateX(-Math.PI / 2); const wm = new THREE.Mesh(wg, riverMat); wm.position.set(best.x, -1.2, best.z); wm.rotation.y = ry; group.add(wm); }
      if (firstBuild && lm.type !== 'lake') addLocalColliders(res, city.x + best.x, city.z + best.z, ry, best.scale);
      lm._pos = [city.x + best.x, city.z + best.z];
      if (firstBuild) poiList.push({ x: city.x + best.x, z: city.z + best.z, r: fp * best.scale + 14, name: lm.name, blurb: lm.blurb, city: city.name });
      if (!mainLm && !best.outside) mainLm = { x: best.x, z: best.z, r: fp * best.scale };
      yield;
    }
    // processional way to the main monument
    if (mainLm) { const dl = Math.hypot(mainLm.x, mainLm.z); if (dl > mainLm.r + 6) { const e2 = (dl - mainLm.r - 1.5) / dl; addStreet([[0, 0], [mainLm.x * e2, mainLm.z * e2]], 2.8, 'avenue', false); } }
    // 4. street networks
    let canalX = null;
    if (style === 'grid') {
      const sp = tier >= 5 ? 30 : tier >= 4 ? 28 : tier >= 3 ? 26 : tier >= 2 ? 22 : 18;
      for (let k = -Math.floor(half / sp); k <= Math.floor(half / sp); k++) { const c = k * sp; if (k === 0 || Math.abs(c) > half - 6) continue; addStreet([[c, -half + 2], [c, half - 2]], 2.2, 'street'); addStreet([[-half + 2, c], [half - 2, c]], 2.2, 'street'); }
      if (tier >= 2) for (let k = -Math.floor(half / sp) - 1; k <= Math.floor(half / sp); k++) { const c = k * sp + sp / 2; if (Math.abs(c) > half - 4) continue; addStreet([[-half + 2, c], [half - 2, c]], 1.2, 'alley'); }
      if (cul === 'song' && tier >= 2) { canalX = sp / 2; occ.polyline([[canalX, -half + 2], [canalX, half - 2]], 2.6, 1); }
    } else if (style === 'islamic') {
      // intervallum lane inside the walls
      if (tier >= 3 && poly) { const ring = poly.map(([x, z]) => { const d = Math.hypot(x, z); return [x * (d - 6) / d, z * (d - 6) / d]; }); ring.push(ring[0]); addStreet(ring, 1.5, 'street'); }
      // secondary radial streets between the gates
      if (tier >= 4) { const nRad = Math.round(R / 30); for (let k = 0; k < nRad; k++) { const a = k / nRad * Math.PI * 2 + 0.3; if (angGap(a) < 0.45) continue; const pts = []; for (let t = 0; t <= 6; t++) { const rr = 14 + t / 6 * (rad - 20); const aa = a + Math.sin(t * 1.3 + k) * 0.05; pts.push([Math.cos(aa) * rr, Math.sin(aa) * rr]); } addStreet(pts, 2.0, 'street'); } }
      // cul-de-sac lanes branching off every street
      const trunks = streets.slice();
      for (const st of trunks) {
        const P = W.resample(st.pts, 1); let next = 10 + rng() * 10;
        for (let i = 1; i < P.length - 1; i++) {
          const r0 = Math.hypot(P[i][0], P[i][1]); if (r0 < 16) continue; if (--next > 0) continue; next = 22 + rng() * 14;
          let tx = P[i + 1][0] - P[i - 1][0], tz = P[i + 1][1] - P[i - 1][1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
          for (const side of [-1, 1]) {
            if (rng() < 0.4) continue;
            const nx = -tz * side, nz = tx * side; const L1 = 10 + rng() * 20, L2 = 6 + rng() * 12; const turn = rng() < .5 ? 1 : -1;
            const s0 = [P[i][0] + nx * (st.hw + 0.5), P[i][1] + nz * (st.hw + 0.5)], s1 = [s0[0] + nx * L1, s0[1] + nz * L1];
            const s2 = rng() < .7 ? [s1[0] - nz * turn * L2, s1[1] + nx * turn * L2] : null;
            addStreet(s2 ? [s0, s1, s2] : [s0, s1], 1.1, 'lane');
          }
        }
        if (streets.length > 400) break;
      }
    } else if (style === 'byz') {
      const sp = tier >= 4 ? 24 : tier >= 3 ? 22 : 18; const ca = Math.cos(theta), sa = Math.sin(theta);
      for (let k = -Math.ceil(R / sp); k <= Math.ceil(R / sp); k++) { if (k === 0) continue; const c = k * sp;
        addStreet([[c * ca - (-R) * sa, c * sa + (-R) * ca], [c * ca - R * sa, c * sa + R * ca]], 2.0, 'street');
        addStreet([[-R * ca - c * sa, -R * sa + c * ca], [R * ca - c * sa, R * sa + c * ca]], 2.0, 'street'); }
    } else if (style === 'tibet') {
      const cx = mainLm ? mainLm.x : 0, cz = mainLm ? mainLm.z : 0, rr = (mainLm ? mainLm.r : 6) + 5;
      const ring = []; for (let k = 0; k <= 40; k++) { const a = k / 40 * Math.PI * 2; ring.push([cx + Math.cos(a) * rr, cz + Math.sin(a) * rr]); } addStreet(ring, 2.4, 'street');
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + .4; addStreet([[cx + Math.cos(a) * (rr + 2.4), cz + Math.sin(a) * (rr + 2.4)], [cx + Math.cos(a) * (R - 4), cz + Math.sin(a) * (R - 4)]], 1.6, 'lane'); }
    } else if (style === 'camp') {
      const sp = 26; const ca = Math.cos(theta), sa = Math.sin(theta);
      for (let k = -Math.ceil(R / sp); k <= Math.ceil(R / sp); k++) { if (k === 0) continue; const c = k * sp;
        addStreet([[c * ca + R * sa, c * sa - R * ca], [c * ca - R * sa, c * sa + R * ca]], 2.8, 'street');
        addStreet([[-R * ca - c * sa, -R * sa + c * ca], [R * ca - c * sa, R * sa + c * ca]], 2.8, 'street'); }
    }
    yield;
    // 5. walls & gates
    if (ws && poly) {
      const segs = [];
      for (let k = 0; k < poly.length; k++) { const [ax, az] = poly[k], [bx, bz] = poly[(k + 1) % poly.length]; const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 4.2)); for (let m = 0; m < n; m++) segs.push([ax + (bx - ax) * m / n, az + (bz - az) * m / n, ax + (bx - ax) * (m + 1) / n, az + (bz - az) * (m + 1) / n, m === 0]); }
      const gatePts = []; for (const st of streets) if (st.kind === 'main' || st.kind === 'avenue') for (const p of st.pts) gatePts.push(p);
      const isGap = sg => { const mx = (sg[0] + sg[2]) / 2, mz = (sg[1] + sg[3]) / 2; for (const p of gatePts) if (Math.hypot(p[0] - mx, p[1] - mz) < 4.8) return true; return false; };
      const gap = segs.map(isGap);
      segs.forEach((sg, k) => {
        if (gap[k]) return;
        const mx = (sg[0] + sg[2]) / 2, mz = (sg[1] + sg[3]) / 2; const len = Math.hypot(sg[2] - sg[0], sg[3] - sg[1]) + 0.3; const am = Math.atan2(sg[3] - sg[1], sg[2] - sg[0]);
        const gy = Math.min(0, W.height(city.x + mx, city.z + mz) - city.h);
        b.box(mx, gy - 0.6, mz, len, ws.h + 0.6 - gy, ws.t, ws.c, -am);
        if (ws.merl) for (let m = -1; m <= 1; m++) b.box(mx + Math.cos(am) * m * len / 3, ws.h, mz + Math.sin(am) * m * len / 3, .6, .75, ws.t, ws.c, -am);
        if (ws.double) b.box(mx * 1.05, gy - 0.6, mz * 1.05, len * 1.05, ws.h * 0.6 - gy, 1, ws.c, -am);
        if (sg[4] || k % 4 === 0) {
          if (ws.tower === 'round') { b.cyl(sg[0], gy - .6, sg[1], 1.7, 1.8, ws.th - gy + .6, ws.c, 10); for (let m = 0; m < 7; m++) { const a = m / 7 * Math.PI * 2; b.box(sg[0] + Math.cos(a) * 1.55, ws.th, sg[1] + Math.sin(a) * 1.55, .5, .65, .5, ws.c); } }
          else { b.box(sg[0], gy - .6, sg[1], 3.2, ws.th - gy + .6, 3.2, ws.c, -am); for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(sg[0] + (sx * Math.cos(am) - sz * Math.sin(am)) * 1.35, ws.th, sg[1] + (sx * Math.sin(am) + sz * Math.cos(am)) * 1.35, .55, .65, .55, ws.c, -am); if (ws.gate === 'chinese' && sg[4]) { b.box(sg[0], ws.th, sg[1], 2.6, 1.6, 2.6, 0xa8352a, -am); b.hip(sg[0], ws.th + 1.6, sg[1], 4, 1.4, 4, 0x4b4f55, -am, .3); } }
          if (k % 8 === 0) { b.cyl(sg[0], ws.th, sg[1], .05, .06, 3.4, 0x4a3426, 4); b.box(sg[0], ws.th + 2.3, sg[1], .05, .9, 1.5, polityColor(city), -am); }
        }
        if (firstBuild) addCollider({ seg: [city.x + sg[0], city.z + sg[1], city.x + sg[2], city.z + sg[3]], r: ws.t * 0.6 });
      });
      segs.forEach((sg, k) => {
        const nk = (k + 1) % segs.length; if (gap[k] === gap[nk]) return;
        const x = sg[2], z = sg[3]; const am = Math.atan2(sg[3] - sg[1], sg[2] - sg[0]);
        if (ws.tower === 'round') b.cyl(x, -.6, z, 2.2, 2.3, ws.th + 2, ws.c, 10); else b.box(x, -.6, z, 3.8, ws.th + 2, 3.8, ws.c, -am);
        if (firstBuild) addCollider({ x: city.x + x, z: city.z + z, r: 2.3 });
      });
      // gatehouses spanning the main gates
      for (const st of streets) if (st.kind === 'main' || st.kind === 'avenue') { const P = st.pts; for (let i = 1; i < P.length; i++) { const a0 = polyPIP(P[i - 1][0], P[i - 1][1], poly), a1 = polyPIP(P[i][0], P[i][1], poly); if (a0 !== a1) { const a = Math.atan2(P[i][1] - P[i - 1][1], P[i][0] - P[i - 1][0]); const mx = (P[i][0] + P[i - 1][0]) / 2, mz = (P[i][1] + P[i - 1][1]) / 2; b.push(mx, 0, mz, -a + Math.PI / 2);
        b.box(0, ws.h + 0.3, 0, 9.6, 2, ws.t + 2, ws.c); b.box(0, ws.h + 2.3, 0, 9.6, .5, ws.t + 2.4, ws.c);
        if (ws.gate === 'chinese') { b.box(0, ws.h + 2.8, 0, 8, 3, ws.t + 1.6, 0xa8352a); for (let m = -2; m <= 2; m++) b.cyl(m * 1.8, ws.h + 2.8, ws.t / 2 + .9, .16, .16, 3, 0x8e2a20, 6); b.hip(0, ws.h + 5.6, 0, 11, 2.4, ws.t + 4.4, 0x4b4f55, 0, .32); b.box(0, ws.h + 7.9, 0, 4, .25, .3, 0x3a3e44); }
        else if (cul === 'persian' || cul === 'central' || cul === 'tarim' || cul === 'arab' || cul === 'rum' || cul === 'yemen' || cul === 'indian') { b.box(0, ws.h + 2.8, 0, 4.8, 1.2, ws.t + 1, ws.c); for (const sx of [-1, 1]) { b.cyl(sx * 4.3, -.6, 0, 1.9, 2.1, ws.h + 4.2, ws.c, 10); } b.box(0, ws.h + 1.2, ws.t / 2 + 1.02, 6, .9, .08, cul === 'persian' || cul === 'central' ? C_TURQ : 0xb8a07a); }
        else { for (const sx of [-1, 1]) b.box(sx * 4.4, -.6, 0, 3.2, ws.th + 2.4, 3.6, ws.c); }
        b.pop(); break; } } }
    }
    yield;
    // 6. buildings
    let count = 0; const houses = [];
    const civicKinds = { byz: ['church'], armenian: ['church'], georgian: ['church'], rum: ['mosque', 'hammam'], arab: ['mosque', 'hammam'], persian: ['mosque', 'hammam'], central: ['mosque', 'hammam'],
      tarim: city.lon > 86 ? ['stupa', 'temple'] : ['mosque'], chinese: ['temple'], song: ['temple'], tibet: ['chorten'], mongol: ['mosque'], yemen: ['mosque'], indian: city.polity.includes('Delhi') || city.polity.includes('Bengal') ? ['mosque', 'hinduTemple'] : ['hinduTemple', 'hinduTemple', 'mandapa'], sea: ['wat', 'zedi'] }[cul] || [];
    const CIV_SIZE = { hinduTemple: [8, 10], mandapa: [8, 8], wat: [9, 12], zedi: [6, 6], mosque: [9, 9], church: [8, 9], temple: [10, 12], hammam: [8.5, 6.5], serai: [10, 10], stupa: [5.5, 5.5], chorten: [3, 3] };
    const place = (x, z, ry, w, d, type) => {
      if (!inside(x, z, Math.max(w, d) / 2 + 0.4)) return false;
      if (!occ.rect(x, z, Math.max(1, w - 0.7), Math.max(1, d - 0.7), ry, 0, true)) return false;
      occ.rect(x, z, w - 0.2, d - 0.2, ry, 2);
      bd.push(x, -0.05, z, ry); houses.push([x, z, w, d, ry, type]);
      if (type.startsWith('civic:')) B.CIVIC[type.slice(6)](bd, rng, cul);
      else if (type === 'house') B.house(bd, cul === 'mongol' ? 'central' : cul, rng, city.id, w, d);
      else if (type === 'yurt') B.yurt(bd, 0, 0, 1.9, rng() < .1 ? B.C.gold : null);
      else B.CB[type](bd, w, d, rng, cul);
      bd.pop();
      if (firstBuild) addCollider({ rect: [city.x + x, city.z + z, w / 2, d / 2, ry] });
      count++; return true;
    };
    const frontage = function* (st, side, o) {
      const P = W.resample(st.pts, 0.5); let i = Math.floor(rng() * 3);
      while (i < P.length - 2) {
        const w = o.w[0] + rng() * (o.w[1] - o.w[0]), d = o.d[0] + rng() * (o.d[1] - o.d[0]);
        const ib = Math.min(P.length - 1, i + Math.max(2, Math.round(w / 0.5)));
        const pa = P[i], pb = P[ib]; let tx = pb[0] - pa[0], tz = pb[1] - pa[1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
        const mx = (pa[0] + pb[0]) / 2, mz = (pa[1] + pb[1]) / 2; const off = st.hw + o.set + d / 2;
        const x = mx - tz * off * side, z = mz + tx * off * side; const ry = Math.atan2(tz * side, -tx * side); const rr = Math.hypot(mx, mz);
        let type = o.type; let ww = w, dd = d;
        if (o.civic && civicKinds.length && rng() < o.civic) { const k2 = B.pick(rng, civicKinds); type = 'civic:' + k2; [ww, dd] = CIV_SIZE[k2]; }
        const ok = rr >= (o.r0 || 0) && rr <= (o.r1 || 1e9) && place(mx - tz * (st.hw + o.set + dd / 2) * side, mz + tx * (st.hw + o.set + dd / 2) * side, ry, ww, dd, type);
        i = ok ? i + Math.max(2, Math.round((ww + (o.gap || 0)) / 0.5)) : i + 2;
        if (count % 50 === 49) yield;
      }
    };
    const run = function* (it) { yield* it; };
    const byKind = k => streets.filter(s => s.kind === k);
    if (style === 'grid') {
      // trees along the avenues, then shops facing them
      const tg = B.treeGeo(cul === 'song' ? 'willow' : cul === 'sea' ? 'coconut' : 'sophora');
      for (const st of byKind('avenue').concat(byKind('main'))) { const P = W.resample(st.pts, 9); for (let i = 1; i < P.length - 1; i++) { const r0 = Math.hypot(P[i][0], P[i][1]); if (r0 < 12) continue; let tx = P[i + 1][0] - P[i - 1][0], tz = P[i + 1][1] - P[i - 1][1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
        for (const side of [-1, 1]) { const x = P[i][0] - tz * (st.hw + 1.1) * side, z = P[i][1] + tx * (st.hw + 1.1) * side; if (!inside(x, z, 2) || !occ.circle(x, z, .8, 0, true)) continue; occ.circle(x, z, .9, 2); const s = .55; for (let v = 0; v < tg.pos.length; v += 3) { bd.pos.push(x + tg.pos[v] * s, tg.pos[v + 1] * s - .1, z + tg.pos[v + 2] * s); bd.col.push(tg.col[v], tg.col[v + 1], tg.col[v + 2]); } } } }
      for (const st of byKind('avenue').concat(byKind('main'))) for (const side of [-1, 1]) yield* frontage(st, side, { type: cul === 'sea' ? 'stiltHouse' : 'shophouse', w: [4, 5.6], d: [5.5, 6.5], set: 2.2, gap: 0.05, r0: 9 });
      // canal with bridges and willows
      if (canalX !== null) {
        const g2 = new THREE.PlaneGeometry(4.6, 2 * half - 4); g2.rotateX(-Math.PI / 2); const wm = new THREE.Mesh(g2, riverMat); wm.position.set(canalX, -0.35, 0); group.add(wm);
        for (const sx of [-1, 1]) b.box(canalX + sx * 2.5, -0.9, 0, .6, 1.1, 2 * half - 4, 0xa8a294);
        for (const st of streets) { if (st.kind === 'lane') continue; const P = st.pts; const horiz = Math.abs(P[P.length - 1][1] - P[0][1]) < 1; if (!horiz) continue; const z = P[0][1]; for (let t = 0; t < 7; t++) { const u = t / 6; b.box(canalX - 2.9 + u * 5.8, Math.sin(u * Math.PI) * .9 - .2, z, 1.0, .35, st.hw * 2 + .4, 0xb3ab9a); } }
        const wl = B.treeGeo('willow'); for (let z = -half + 6; z < half - 6; z += 11) for (const sx of [-1, 1]) { const x = canalX + sx * 3.7; if (!occ.circle(x, z, .8, 0, true)) continue; occ.circle(x, z, .9, 2); for (let v = 0; v < wl.pos.length; v += 3) { bd.pos.push(x + wl.pos[v] * .6, wl.pos[v + 1] * .6 - .1, z + wl.pos[v + 2] * .6); bd.col.push(wl.col[v], wl.col[v + 1], wl.col[v + 2]); } }
      }
      // wards: courtyard compounds facing south, packed along each block
      const xs = [-half, half], zs = [-half, half];
      for (const st of streets) { const P = st.pts; if (P.length < 2) continue; const vert = Math.abs(P[P.length - 1][0] - P[0][0]) < 1, horiz = Math.abs(P[P.length - 1][1] - P[0][1]) < 1; if (vert) xs.push(P[0][0]); if (horiz) zs.push(P[0][1]); }
      if (canalX !== null) xs.push(canalX);
      const ux = [...new Set(xs.map(v => Math.round(v * 2) / 2))].sort((a, b2) => a - b2), uz = [...new Set(zs.map(v => Math.round(v * 2) / 2))].sort((a, b2) => a - b2);
      for (let iz = 0; iz < uz.length - 1; iz++) for (let ix = 0; ix < ux.length - 1; ix++) {
        const x0 = ux[ix] + 3, x1 = ux[ix + 1] - 3, z0 = uz[iz] + 2.2, z1 = uz[iz + 1] - 2.2; if (x1 - x0 < 6 || z1 - z0 < 6) continue;
        const depth = Math.min(z1 - z0, tier >= 4 ? 18 : 15); const zc = z1 - depth / 2;
        let x = x0;
        while (x < x1 - 6) {
          const w = Math.min(x1 - x, (tier >= 4 ? 11 : 9) + rng() * 5); if (w < 6) break;
          const cx = x + w / 2; const type = cul === 'mongol' && rng() < .45 ? 'yurtCompound' : cul === 'sea' ? (w < 8 ? 'stiltHouse' : 'stiltCompound') : (w < 8 ? 'house' : 'siheyuan');
          if (!place(cx, zc, 0, w, depth, type)) { // shrink to fit behind shopfronts
            let ok = false; for (let dd = depth - 2; dd >= 7 && !ok; dd -= 2) ok = place(cx, z1 - dd / 2, 0, w, dd, type);
          }
          x += w + 0.15;
        }
        if (count % 40 === 0) yield;
      }
    } else if (style === 'islamic') {
      for (const st of byKind('main')) for (const side of [-1, 1]) yield* frontage(st, side, { type: 'shopBay', w: [3, 3.6], d: [4, 4.4], set: 0.2, gap: 0, r0: 12, r1: tier >= 2 ? R * 0.6 : R * 0.4 });
      // covered bazaar vaults over the busiest stretch
      if ((cul === 'persian' || cul === 'central' || cul === 'arab') && tier >= 3) for (const st of byKind('main')) { const P = W.resample(st.pts, 4); for (let i = 1; i < P.length - 1; i++) { const r0 = Math.hypot(P[i][0], P[i][1]); if (r0 < 14 || r0 > Math.min(R * 0.5, 60)) continue; let tx = P[i + 1][0] - P[i - 1][0], tz = P[i + 1][1] - P[i - 1][1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl; const ry = Math.atan2(-tz, tx);
        bd.arch(P[i][0], 3.7, P[i][1], st.hw + 0.7, 4.1, 0xd6b486, ry); for (const sd of [-1, 1]) bd.box(P[i][0] - tz * sd * (st.hw + 0.9), 3.6, P[i][1] + tx * sd * (st.hw + 0.9), 4.1, 1.2, 1.2, 0xc9a274, ry); if (i % 3 === 0) { bd.cyl(P[i][0], 3.7 + st.hw + 0.5, P[i][1], .6, .7, .5, 0xc9a274, 8); bd.dome(P[i][0], 3.7 + st.hw + 1, P[i][1], .7, 0xc4996a, 8, .8); } } }
      for (const st of byKind('main')) for (const side of [-1, 1]) yield* frontage(st, side, { type: CH, w: [8, 11], d: [8, 10], set: 0.3, gap: 0.1, r0: tier >= 2 ? R * 0.6 : R * 0.4, civic: 0.05 });
      for (const st of byKind('street').concat(byKind('avenue'))) for (const side of [-1, 1]) yield* frontage(st, side, { type: CH, w: [8, 11], d: [8, 10], set: 0.2, gap: 0.1, civic: 0.06 });
      for (const st of byKind('lane')) for (const side of [-1, 1]) yield* frontage(st, side, { type: CH, w: [6.5, 9], d: [6.5, 8.5], set: 0.1, gap: 0.05, civic: 0.03 });
      // caravanserais just inside the gates
      for (const st of byKind('main')) { const P = st.pts; const p = P.find(q => Math.hypot(q[0], q[1]) > rad * 0.75); if (p) { const a = Math.atan2(p[1], p[0]); const x = p[0] - Math.sin(a) * 9.5, z = p[1] + Math.cos(a) * 9.5; place(x, z, Math.atan2(Math.sin(a) * -1, Math.cos(a)) , 10, 10, 'civic:serai'); } }
    } else if (style === 'byz') {
      // colonnaded Mese from the forum
      const mese = byKind('main')[0];
      if (mese) { const P = W.resample(mese.pts, 1); for (let i = 1; i < P.length - 11; i += 11) { const r0 = Math.hypot(P[i][0], P[i][1]); if (r0 < 14 || r0 > R * 0.6) continue; let tx = P[i + 10][0] - P[i][0], tz = P[i + 10][1] - P[i][1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl; const mx = (P[i][0] + P[i + 10][0]) / 2, mz = (P[i][1] + P[i + 10][1]) / 2;
        for (const side of [-1, 1]) { const off = mese.hw + 1.0; const x = mx - tz * off * side, z = mz + tx * off * side; const ry = Math.atan2(tz * side, -tx * side); if (!occ.rect(x, z, 10, 1.2, ry, 0, true)) continue; occ.rect(x, z, 10, 3, ry, 1); bd.push(x, -0.05, z, ry); B.CB.colonnade(bd, 10); bd.pop(); } } }
      for (const st of byKind('main').concat(byKind('avenue'))) for (const side of [-1, 1]) yield* frontage(st, side, { type: 'rowHouse', w: [4.4, 6.4], d: [7, 9], set: st === mese ? 3.4 : 0.3, gap: 0.02, r0: 9, civic: 0.04 });
      for (const st of byKind('street')) for (const side of [-1, 1]) yield* frontage(st, side, { type: 'rowHouse', w: [4.2, 6.2], d: [7, 9], set: 0.3, gap: 0.02, civic: 0.04 });
      yield;
      // fill block interiors with smaller houses
      for (let t = 0; t < R * R * 0.03; t++) { const a = rng() * Math.PI * 2, rr = Math.sqrt(rng()) * rad; const x = Math.cos(a) * rr, z = Math.sin(a) * rr; place(x, z, -theta + Math.round(rng() * 3) * Math.PI / 2, 4 + rng() * 2, 5 + rng() * 2, 'house'); }
      const cy = B.treeGeo('cypress'); for (let t = 0, k = 0; t < 400 && k < R * .3; t++) { const a = rng() * 6.28, rr = rng() * rad; const x = Math.cos(a) * rr, z = Math.sin(a) * rr; if (!inside(x, z, 2) || !occ.circle(x, z, 1.1, 0, true)) continue; occ.circle(x, z, 1, 2); const s = .6 + rng() * .2; for (let v = 0; v < cy.pos.length; v += 3) { bd.pos.push(x + cy.pos[v] * s, cy.pos[v + 1] * s - .1, z + cy.pos[v + 2] * s); bd.col.push(cy.col[v], cy.col[v + 1], cy.col[v + 2]); } k++; }
    } else if (style === 'tibet') {
      for (const st of streets) for (const side of [-1, 1]) yield* frontage(st, side, { type: 'house', w: [4.5, 6.5], d: [4.5, 6], set: 0.4, gap: 0.6, civic: 0.05 });
      for (let k = 0; k < 4; k++) { const a = rng() * 6.28, rr = 8 + rng() * R * .6; const x = Math.cos(a) * rr, z = Math.sin(a) * rr; if (!occ.circle(x, z, 2, 0, true)) continue; occ.circle(x, z, 2, 2); bd.push(x, 0, z, rng() * 6); B.PROP.flags(bd, rng); bd.pop(); }
    } else if (style === 'camp') {
      for (const st of streets) for (const side of [-1, 1]) yield* frontage(st, side, { type: 'yurtCompound', w: [10, 13], d: [10, 12], set: 0.6, gap: 1.5, civic: 0.04 });
      for (const st of byKind('main')) for (const side of [-1, 1]) yield* frontage(st, side, { type: CH, w: [9, 12], d: [9, 11], set: 0.3, gap: 0.3, r0: 10, r1: R * 0.5 });
    }
    // generic infill for any leftover space
    yield;
    const fillType = style === 'grid' ? 'house' : style === 'islamic' ? CH : style === 'camp' ? 'yurtCompound' : style === 'byz' ? 'rowHouse' : 'house';
    const DBG = { t: 0, i: 0, f: 0, ok: 0 };
    { // systematic infill on a lattice aligned with the city
      const ang = style === 'grid' ? 0 : -theta; const ca = Math.cos(ang), sa = Math.sin(ang); const step = fillType === CH ? 6 : 5; const lim = style === 'grid' ? half : rad;
      for (let u = -lim; u <= lim; u += step) for (let v = -lim; v <= lim; v += step) {
        const x = u * ca - v * sa + (rng() - .5) * 2, z = u * sa + v * ca + (rng() - .5) * 2; DBG.t++; if (!inside(x, z, 3)) continue; DBG.i++; if (occ.get(x, z) !== 0) continue; DBG.f++; const c0 = count;
        const ry = style === 'grid' ? 0 : ang + Math.round(rng() * 3) * Math.PI / 2;
        if (fillType === CH) { if (!place(x, z, ry, 8 + rng() * 2, 7.5 + rng() * 2, CH) && !place(x, z, ry, 6.5, 6.5, CH)) place(x, z, ry, 4.2 + rng() * 1.2, 4.2 + rng() * 1.2, 'house'); }
        else if (fillType === 'rowHouse') { if (!place(x, z, ry, 5 + rng() * 1.5, 7 + rng(), 'rowHouse')) place(x, z, ry, 4, 4.5, 'house'); }
        else place(x, z, ry, 4.5 + rng() * 2, 4.5 + rng() * 2, fillType);
        if (count > c0) DBG.ok++; else if (count % 60 === 0) yield;
      }
    }
    if (style !== 'grid' && style !== 'camp') { // pack the remaining pockets with small houses
      const ang = -theta; const ca = Math.cos(ang), sa = Math.sin(ang);
      for (let u = -rad; u <= rad; u += 4.2) for (let v = -rad; v <= rad; v += 4.2) {
        const x = u * ca - v * sa, z = u * sa + v * ca; if (!inside(x, z, 2.5) || occ.get(x, z) !== 0) continue;
        const ry = ang + Math.round(rng() * 3) * Math.PI / 2; place(x, z, ry, 3.6 + rng() * 1.4, 3.6 + rng() * 1.4, style === 'tibet' ? 'house' : 'house');
      }
      yield;
    }
    // a few wells at street corners
    for (let t = 0, k = 0; t < 120 && k < tier + 1; t++) { const a = rng() * 6.28, rr = 10 + rng() * R * 0.5; const x = Math.cos(a) * rr, z = Math.sin(a) * rr; if (!inside(x, z, 2) || occ.get(x, z) !== 0 || !occ.circle(x, z, 1.6, 0, true)) continue; bd.push(x, -0.05, z, 0); B.FURN.well(bd); bd.pop(); occ.circle(x, z, 1.5, 2); if (firstBuild) addCollider({ x: city.x + x, z: city.z + z, r: 1.1 }); k++; }
    yield;
    for (const lm of extras) buildHarbor(group, b, city, lm, firstBuild);
    const mesh = new THREE.Mesh(b.geometry(), objMat); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
    if (!bd.empty) { const dm = new THREE.Mesh(bd.geometry(), bldMat); dm.castShadow = true; dm.receiveShadow = true; dm.userData.detail = 820; group.add(dm); }
    const sm = streetRibbon(streets, CULTURE_GROUND[cul] || [.75, .7, .62]); if (sm) group.add(sm);
    { const cg = CULTURE_GROUND[cul] || [.75, .7, .62]; for (const pv of paved) { const pg = new THREE.PlaneGeometry(pv.w, pv.d); pg.rotateX(-Math.PI / 2); const n = pg.attributes.position.count; const ar = new Float32Array(n * 2), cc = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { ar[i * 2] = 0; ar[i * 2 + 1] = 1; cc[i * 3] = lin(cg[0] * .97); cc[i * 3 + 1] = lin(cg[1] * .95); cc[i * 3 + 2] = lin(cg[2] * .92); }
      pg.setAttribute('aRoad', new THREE.BufferAttribute(ar, 2)); pg.setAttribute('color', new THREE.BufferAttribute(cc, 3));
      const pm = new THREE.Mesh(pg, roadMat); pm.position.set(pv.x, 0.12, pv.z); pm.rotation.y = pv.ry; pm.receiveShadow = true; group.add(pm); } }
    for (const g of city.gates) addSignpost(group, city, g);
    city.streetsCache = streets; city.houses = houses; city.wallPoly = poly; city.layoutStyle = style; city.occ = occ; city.mainLmLocal = mainLm;
    city.collidersDone = true;
    if (window.__dbgOcc) { const h = [0, 0, 0, 0]; for (let z = -R; z < R; z++) for (let x = -R; x < R; x++) if (inside(x, z, 0)) h[Math.min(3, occ.get(x, z))]++; window.__dbgOcc[city.id] = { DBG, h, streets: streets.length, kinds: streets.reduce((o, s2) => (o[s2.kind] = (o[s2.kind] || 0) + 1, o), {}), count }; }
    return group;
  }
  // ================= VILLAGES =================
  function buildVillage(v) {
    const rng = W.rng(v.seed); const b = new B.Builder(); b.rng = rng;
    const g = new THREE.Group(); const f = W.flats.find(f => f.ref === v); const h = f ? f.h : W.height(v.x, v.z);
    g.position.set(v.x, h, v.z);
    const occ = OccGrid(v.r + 4); const cul = v.culture; const first = !v.collidersDone;
    const faceRoad = Math.atan2(v.faceX - v.x, v.faceZ - v.z); const vh = []; v.houses = vh;
    if (v.type === 'nomad') {
      for (let k = 0; k < v.n; k++) { const a = k / v.n * Math.PI * 2 + rng(), rr = 4 + rng() * (v.r - 6); const x = Math.cos(a) * rr, z = Math.sin(a) * rr; if (!occ.circle(x, z, 3, 0, true)) continue; occ.circle(x, z, 2.6, 2); vh.push([x, z, 3.4, 3.4, 0, 'yurt']); B.yurt(b, x, z, 1.7 + rng() * .4, null); if (first) addCollider({ x: v.x + x, z: v.z + z, r: 2 }); }
      b.push(0, 0, 0, rng() * 6); B.PROP.ovoo(b, rng); b.pop(); b.push(v.r * .5, 0, -v.r * .3, rng()); B.FURN.cart(b, rng); b.pop();
    } else {
      const lane = []; for (let t = -1; t <= 1; t += 0.25) lane.push([Math.sin(faceRoad) * t * v.r, Math.cos(faceRoad) * t * v.r]);
      occ.polyline(lane, 1.6, 1);
      let n = 0;
      if (v.n >= 8) { const kinds = { byz: 'church', armenian: 'church', georgian: 'church', chinese: 'temple', song: 'temple', tibet: 'chorten', tarim: 'mosque', indian: 'hinduTemple', sea: 'wat' }[cul] || 'mosque'; const x = Math.cos(faceRoad) * 6, z = -Math.sin(faceRoad) * 6; const sz = kinds === 'temple' ? [10, 12] : kinds === 'wat' ? [9, 12] : [9, 9]; if (occ.rect(x, z, sz[0], sz[1], faceRoad, 0, true)) { occ.rect(x, z, sz[0], sz[1], faceRoad, 2); b.push(x, -0.05, z, faceRoad + Math.PI / 2); B.CIVIC[kinds](b, rng, cul); b.pop(); if (first) addCollider({ x: v.x + x, z: v.z + z, r: 5 }); } }
      for (let t = 0; t < v.n * 12 && n < v.n; t++) {
        const a = rng() * Math.PI * 2, rr = (v.type === 'farm' ? 0 : 3) + rng() * (v.r - 4); const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
        const w = 3.4 + rng() * 2.4, d = 3.4 + rng() * 2; const ry = faceRoad + Math.round(rng() * 4) * Math.PI / 2 + (rng() - .5) * .2;
        if (!occ.rect(x, z, w + 1.2, d + 1.2, ry, 0, true)) continue; occ.rect(x, z, w + .6, d + .6, ry, 2);
        b.push(x, -0.05, z, ry); B.house(b, cul, rng, '', w, d); b.pop(); n++; vh.push([x, z, w, d, ry, 'house']);
        if (rng() < .5) { const fx = x + Math.sin(ry) * (d / 2 + 1.4), fz = z + Math.cos(ry) * (d / 2 + 1.4); if (occ.circle(fx, fz, 1.2, 0, true)) { b.push(fx, -0.05, fz, ry); B.FURN[B.pick(rng, ['hay', 'sacks', 'cart', 'crates'])](b, rng); b.pop(); occ.circle(fx, fz, 1.2, 2); } }
      }
      const treeT = { byz: 'cypress', armenian: 'broad', georgian: 'broad', rum: 'poplar', arab: 'palm', persian: 'poplar', central: 'poplar', tarim: 'poplar', chinese: 'willow', song: 'bamboo', tibet: 'poplar', yemen: 'acacia', indian: v.lat < 20 ? 'coconut' : 'banyan', sea: 'coconut' }[cul] || 'broad';
      const tg = B.treeGeo(v.lat < 33.5 && v.lat > 0 && (cul === 'arab' || cul === 'persian') ? 'palm' : treeT);
      for (let t = 0, k = 0; t < 60 && k < 3 + v.n / 2; t++) { const a = rng() * 6.28, rr = rng() * (v.r + 3); const x = Math.cos(a) * rr, z = Math.sin(a) * rr; if (!occ.circle(x, z, 1.3, 0, true)) continue; occ.circle(x, z, 1, 2); const s = .65 + rng() * .3; for (let q = 0; q < tg.pos.length; q += 3) { b.pos.push(x + tg.pos[q] * s, tg.pos[q + 1] * s - .1, z + tg.pos[q + 2] * s); b.col.push(tg.col[q], tg.col[q + 1], tg.col[q + 2]); } k++; }
    }
    v.collidersDone = true;
    if (b.empty) return g;
    const m = new THREE.Mesh(b.geometry(), bldMat); m.castShadow = true; m.receiveShadow = true; m.userData.detail = 820; g.add(m);
    return g;
  }
  const C_DARK = 0x2a211c, C_TURQ = 0x2fa7a0;
  function polityColor(city) {
    const p = city.polity;
    const M = [['Byzantine', 0x7a2a8a], ['Trebizond', 0x8a2a5a], ['Rûm', 0xb03a2a], ['Mamluk', 0xd8b04a], ['Golden Horde', 0xd8a82a], ['Chagatai', 0x3f8f4f], ['Yuan', 0xb02a1e], ['Song', 0x2a7a6a], ['Georgia', 0xe8e0d0], ['Cilicia', 0xc07a2a], ['Uyghur', 0x3a6a8a], ['Sakya', 0xa8352a], ['Contested', 0x8a7a5a]];
    for (const [k, c] of M) if (p.includes(k)) return c; return 0x2c5fa8;
  }
  function buildCityLake(group, b, x, z, p, city) {
    let geo;
    if (p.crescent) {
      const sh = new THREE.Shape(); sh.absarc(0, 0, p.r, Math.PI * 0.15, Math.PI * 1.85, false);
      sh.absarc(p.r * 0.45, 0, p.r * 0.72, Math.PI * 1.7, Math.PI * 0.3, true);
      geo = new THREE.ShapeGeometry(sh, 24); geo.rotateX(-Math.PI / 2);
    } else geo = polarDisc(p.r, p.r * 0.7, 6, 40);
    const m = new THREE.Mesh(geo, lakeMat); m.position.set(x, 0.12, z); group.add(m);
    for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; b.box(x + Math.cos(a) * p.r * (p.crescent ? 1.02 : 1.02), -0.2, z + Math.sin(a) * p.r * (p.crescent ? 1.02 : 0.72), 1.4, .45, .7, 0xb9b0a0, -a); }
    if (!p.crescent) { b.push(x + p.r * .2, 0, z, 0); B.PROP.pavilion(b, Math.random); b.pop(); const tg = B.treeGeo('willow'); for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + .3; const tx = x + Math.cos(a) * (p.r + 2), tz = z + Math.sin(a) * (p.r * .7 + 2); for (let v = 0; v < tg.pos.length; v += 3) { b.pos.push(tx + tg.pos[v], tg.pos[v + 1], tz + tg.pos[v + 2]); b.col.push(tg.col[v], tg.col[v + 1], tg.col[v + 2]); } } }
    if (!city.collidersDone) addCollider({ x: city.x + x, z: city.z + z, r: p.r * 0.7 });
  }
  function buildHarbor(group, b, city, lm, firstBuild) {
    let ba = null, bh = 1e9;
    for (let k = 0; k < 36; k++) { const a = k / 36 * Math.PI * 2; const h = W.rawHeight(city.x + Math.cos(a) * (city.R + 16), city.z + Math.sin(a) * (city.R + 16)); if (h < bh) { bh = h; ba = a; } }
    if (bh > -0.5) return;
    const cs = Math.cos(ba), sn = Math.sin(ba);
    const y0 = 1.0 - city.h;
    for (let d = city.R - 4; d < city.R + 22; d += 2) b.box(cs * d, y0 - 0.4 + Math.min(0, 0), sn * d, 3.2, 0.4, 2.1, 0x8a6a48, -ba + Math.PI / 2);
    for (let d = city.R + 2; d < city.R + 22; d += 4) for (const s of [-1, 1]) b.cyl(cs * d - sn * s * 1.6, -city.h - 2, sn * d + cs * s * 1.6, .18, .2, city.h + 2.6, 0x5e3d26, 5);
    const sb = new B.Builder();
    for (let k = 0; k < 3; k++) {
      const d = city.R + 9 + k * 8, side = k % 2 ? 1 : -1;
      sb.push(cs * d - sn * side * 6, -city.h + 0.1, sn * d + cs * side * 6, -ba + (side > 0 ? 0.15 : -0.15)); B.ship(sb, lm.p.ship); sb.pop();
    }
    const sm = new THREE.Mesh(sb.geometry(), objMat); sm.castShadow = true; group.add(sm);
    if (firstBuild) poiList.push({ x: city.x + cs * (city.R + 10), z: city.z + sn * (city.R + 10), r: 20, name: lm.name, blurb: lm.blurb, city: city.name });
  }
  function textTexture(lines, w, h, bg) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d');
    g.fillStyle = bg || '#7a5534'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(40,24,12,.6)'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
    for (let k = 0; k < 6; k++) { g.fillStyle = 'rgba(0,0,0,.06)'; g.fillRect(0, k * h / 6 + 4, w, 2); }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach((ln, i) => { g.fillStyle = ln.c || '#f6ead2'; g.font = ln.f; g.fillText(ln.t, w / 2, ln.y * h); });
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }
  const postGeo = new THREE.CylinderGeometry(.12, .14, 3.2, 6).translate(0, 1.6, 0);
  const signPostMat = new THREE.MeshLambertMaterial({ color: 0x5e3d26 });
  function addSignpost(group, city, g) {
    const P = W.P; const i = g.sign; const e = W.edges[g.edge];
    const i1 = Math.min(e.start + e.n - 1, i + 1), i0 = Math.max(e.start, i - 1);
    let tx = P.X[i1] - P.X[i0], tz = P.Z[i1] - P.Z[i0]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
    const awayX = P.X[i] - city.x, awayZ = P.Z[i] - city.z; if (tx * awayX + tz * awayZ < 0) { tx = -tx; tz = -tz; }
    const sx = P.X[i] + tz * 3.8, sz = P.Z[i] - tx * 3.8; const h = W.walkHeight(sx, sz);
    const other = W.cityById[g.other];
    const holder = new THREE.Group(); holder.position.set(sx - city.x, h - city.h, sz - city.z);
    holder.rotation.y = Math.atan2(tx, tz);
    const post = new THREE.Mesh(postGeo, signPostMat); post.castShadow = true; holder.add(post);
    const front = textTexture([{ t: '\u2191 ' + other.name.replace(/ \(.*\)/, ''), f: 'bold 46px Georgia, serif', y: .36 }, { t: `${mi(g.km)} mi ${g.dir}`, f: 'italic 30px Georgia, serif', y: .74, c: '#e9d6ad' }], 512, 160);
    const back = textTexture([{ t: city.name, f: 'bold 46px Georgia, serif', y: .42 }, { t: city.polity.split('(')[0].trim(), f: 'italic 26px Georgia, serif', y: .78, c: '#e9d6ad' }], 512, 160, '#6b4a2e');
    const pg = new THREE.PlaneGeometry(3.2, 1.0);
    const mf = new THREE.Mesh(pg, new THREE.MeshLambertMaterial({ map: front })); mf.position.set(0, 2.75, -0.05); mf.rotation.y = Math.PI; holder.add(mf);
    const mb = new THREE.Mesh(pg, new THREE.MeshLambertMaterial({ map: back })); mb.position.set(0, 2.75, 0.05); holder.add(mb);
    group.add(holder);
    if (!city.collidersDone) addCollider({ x: sx, z: sz, r: .4 });
  }
  function planRouteLandmarks() {
    const P = W.P;
    for (const lm of LANDMARKS) {
      if (lm.city) continue;
      const [tx, tz] = W.toWorld(lm.lon, lm.lat);
      let bi = 0, bd = 1e18; for (let i = 0; i < P.n; i++) { const d = (P.X[i] - tx) ** 2 + (P.Z[i] - tz) ** 2; if (d < bd) { bd = d; bi = i; } }
      const e = W.edges[P.E[bi]];
      // slide out of city zones
      const inCity = i => W.cities.some(c => Math.hypot(P.X[i] - c.x, P.Z[i] - c.z) < c.R + 34);
      let i = bi, guard = 0;
      if (inCity(i)) { const A = W.cityById[e.a], Bc = W.cityById[e.b]; const dirSign = Math.hypot(P.X[i] - A.x, P.Z[i] - A.z) < Math.hypot(P.X[i] - Bc.x, P.Z[i] - Bc.z) ? 1 : -1; while (inCity(i) && guard++ < 400) { const ni = i + dirSign; if (ni < e.start || ni >= e.start + e.n) break; i = ni; } }
      const i1 = Math.min(e.start + e.n - 1, i + 1), i0 = Math.max(e.start, i - 1);
      let ux = P.X[i1] - P.X[i0], uz = P.Z[i1] - P.Z[i0]; const ul = Math.hypot(ux, uz) || 1; ux /= ul; uz /= ul;
      const scratch = new B.Builder(); const res = B.LM[lm.type](scratch, lm.p || {}, W.rng(3), 'central');
      let fp = res.r || 0; if (res.colliders) for (const c of res.colliders) fp = Math.max(fp, c.seg ? 6 : Math.hypot(c.c[0], c.c[1]) + c.r); if (res.fp) fp = res.fp;
      let site;
      if (res.onRoad) {
        site = { x: P.X[i], z: P.Z[i], ry: Math.atan2(ux, uz) + Math.PI / 2, lm, res };
        // gate builder spans local x across the road: rotate so local x is perpendicular to road
        site.ry = Math.atan2(ux, uz);
      } else if (res.none) {
        site = { x: P.X[i], z: P.Z[i], ry: 0, lm, res, label: true };
      } else {
        let side = ((tx - P.X[i]) * -uz + (tz - P.Z[i]) * ux) >= 0 ? 1 : -1;
        const isCliff = lm.type === 'caves' || lm.type === 'bamiyan';
        const off = isCliff ? 30 : fp + 8;
        for (let tries = 0; tries < 2; tries++) {
          const sx = P.X[i] + -uz * side * off, sz = P.Z[i] + ux * side * off; const q = W.pathQuery(sx, sz);
          if (q.d > off - 4 || tries === 1) { site = { x: sx, z: sz, ry: Math.atan2(P.X[i] - sx, P.Z[i] - sz), lm, res }; break; }
          side = -side;
        }
      }
      site.kind = 'lm'; site.built = false; site.group = null; site.fp = fp;
      sites.push(site);
      poiList.push({ x: site.x, z: site.z, r: Math.max(30, fp + 22), name: lm.name, blurb: lm.blurb });
      if (!res.none) addLocalColliders(res, site.x, site.z, site.ry);
      if (!res.none && !res.onRoad) W.addFlat(site.x, site.z, Math.min(fp * 0.85 + 2, 40), 14);
    }
    for (const br of W.bridges) if (br.name) poiList.push({ x: br.x, z: br.z, r: 26, name: br.name, blurb: br.blurb });
    for (const L of W.lakes) poiList.push({ x: L.x, z: L.z, r: Math.max(L.rxw, L.ryw) + 30, name: L.name, blurb: 'A lake on the road.', soft: true });
  }
  function buildLmSite(site) {
    if (site.label) return null;
    const g = new THREE.Group(); const h = W.height(site.x, site.z);
    g.position.set(site.x, h - 0.2, site.z);
    const b = new B.Builder(); b.rng = W.rng(17);
    b.push(0, 0, 0, site.ry); B.LM[site.lm.type](b, site.lm.p || {}, W.rng(11), 'central'); b.pop();
    // ground skirt for cliffs on slopes
    const m = new THREE.Mesh(b.geometry(), bldMat); m.castShadow = true; m.receiveShadow = true; m.userData.detail = 820; g.add(m);
    return g;
  }
  function buildSiteSync(s) { s.group = s.kind === 'city' ? buildCitySite(s) : s.kind === 'village' ? buildVillage(s.v) : buildLmSite(s); s.gen = null; s.built = true; if (s.group) { scene.add(s.group); GFX.siteBuilt(s); } }
  function updateSites(px, pz) {
    const t0 = performance.now();
    for (const s of sites) if (s.gen) { // continue a city being built across frames
      let r; do { r = s.gen.next(); } while (!r.done && performance.now() - t0 < 6);
      if (r.done) { s.group = r.value; s.gen = null; s.built = true; scene.add(s.group); GFX.siteBuilt(s); }
      return;
    }
    for (const s of sites) {
      const d = Math.hypot(s.x - px, s.z - pz);
      if (!s.built && d < (s.kind === 'village' ? 900 : 1500)) {
        if (s.kind === 'city') { s.gen = cityGen(s); return; }
        buildSiteSync(s);
        if (performance.now() - t0 > 4) return;
      } else if (s.built && d > (s.kind === 'village' ? 1050 : 1750)) {
        if (s.group) { GFX.siteGone(s); scene.remove(s.group); s.group.traverse(o => { if (o.geometry && o.geometry !== postGeo && !o.geometry.userData.shared) o.geometry.dispose(); if (o.material && o.material.map) { o.material.map.dispose(); o.material.dispose(); } }); }
        s.group = null; s.built = false;
      }
    }
  }

  // ---------- clouds ----------
  const clouds = [];
  function buildClouds() {
    const mat = GFX.cloudMat;
    const sph = new THREE.SphereGeometry(1, 12, 8);
    const geos = [];
    for (let v = 0; v < 5; v++) {
      const rng = W.rng(v + 50); const parts = [];
      const n = 5 + v;
      for (let k = 0; k < n; k++) {
        const r = 8 + rng() * 7; const g = sph.clone(); g.scale(r * 1.3, r * 0.7, r);
        const cx = (k - n / 2) * 9 + rng() * 5; g.translate(cx, r * 0.25 - Math.abs(cx) * 0.08, (rng() - .5) * 10); parts.push(g);
      }
      // flat bottom
      const pos = []; const nor = [];
      for (const g of parts) { const p = g.attributes.position.array, nn = g.attributes.normal.array; for (let i = 0; i < p.length; i += 3) { pos.push(p[i], Math.max(p[i + 1], -1), p[i + 2]); nor.push(nn[i], nn[i + 1], nn[i + 2]); } }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      let off = 0; const idx = []; for (const g of parts) { for (const i of g.index.array) idx.push(i + off); off += g.attributes.position.count; } geo.setIndex(idx);
      geos.push(geo);
    }
    for (let k = 0; k < 140; k++) {
      const m = new THREE.Mesh(geos[k % 5], mat); const a = Math.random() * Math.PI * 2, r = 250 + Math.sqrt(Math.random()) * 1350; const low = k % 3 === 2;
      m.userData = { ox: Math.cos(a) * r, oz: Math.sin(a) * r, cov: Math.random(), sp: low ? 1.5 : 1 }; m.position.y = low ? 330 + Math.random() * 120 : 560 + Math.random() * 320;
      const sc = low ? 1.2 + Math.random() * 1.1 : 2.2 + Math.random() * 2.2; m.scale.set(sc * (1 + Math.random() * 0.5), sc * (0.8 + Math.random() * 0.4), sc);
      m.rotation.y = Math.random() * 6; scene.add(m); clouds.push(m);
    }
  }
  let cloudDrift = 0;
  function updateClouds(px, pz, dt) {
    cloudDrift += dt * 2.2;
    const cov = GFX.cloudCover === undefined ? 0.55 : GFX.cloudCover;
    for (let k = 0; k < clouds.length; k++) { const c = clouds[k];
      c.visible = k < Q.clouds && c.userData.cov < cov; if (!c.visible) continue;
      let x = c.userData.ox + cloudDrift * c.userData.sp, z = c.userData.oz;
      x = ((x + 1500) % 3000 + 3000) % 3000 - 1500;
      c.position.x = px + x; c.position.z = pz + z;
    }
  }

  function setQuality(name) {
    if (!QUALITY[name]) return; qName = name; Q = QUALITY[name]; try { localStorage.setItem('silkroad_quality', name); } catch (e) { }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, Q.pr)); renderer.setSize(window.innerWidth, window.innerHeight); makeRT();
    sun.castShadow = Q.shadow > 0; if (Q.shadow) { sun.shadow.mapSize.set(Q.shadow, Q.shadow); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    VIEW = Q.view; if (GFX.setQuality) GFX.setQuality(); for (const [k, c] of chunks) { disposeChunk(c); chunks.delete(k); } updateChunks(player.x, player.z, 0, 400);
    document.querySelectorAll('#pm-gfx button').forEach(b => b.classList.toggle('on', b.dataset.q === name));
  }
  // ---------- player ----------
  const player = { x: 0, z: 0, y: 5, yaw: 0, pitch: 0, vy: 0, bob: 0, auto: false, autoTarget: null };
  const keys = {};
  let started = false, mapOpen = false, paused = true;
  let EYE = 1.62; HK.setEye = v => { EYE = v; };
  function placeAtCity(id) {
    const c = W.cityById[id]; player.x = c.x; player.z = c.z;
    const g = c.gates[0]; player.yaw = g ? Math.atan2(-(g.gx - c.x), -(g.gz - c.z)) : 0;
    player.pitch = 0;
    player.y = W.walkHeight(player.x, player.z) + EYE;
  }
  function allowed(x, z) {
    const q = W.pathQuery(x, z);
    let ok = q.i >= 0 && q.d <= 21;
    if (!ok) { const nc = W.nearestCity(x, z); ok = nc.d <= nc.c.R + 3; }
    if (!ok) return false;
    if (HK.allowed && !HK.allowed(x, z)) return false;
    if (W.bridgeAt(x, z) > -1e8) return true;
    const h = W.height(x, z); const o = W.OUT;
    if (o.sea > 0.5 && h < -0.4) return false;
    if (o.lake > 0.5 && h < o.lakeLevel - 0.6) return false;
    return true;
  }
  function updatePlayer(dt) {
    let mx = 0, mz = 0;
    if (keys.KeyW || keys.ArrowUp) mz += 1; if (keys.KeyS || keys.ArrowDown) mz -= 1;
    if (keys.KeyA) mx -= 1; if (keys.KeyD) mx += 1;
    if (keys.ArrowLeft) player.yaw += dt * 1.8; if (keys.ArrowRight) player.yaw -= dt * 1.8;
    if ((HK.frozen && HK.frozen()) || pauseOpen()) { camera.position.set(player.x, player.y, player.z); camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ'); return; }
    const sp = ((keys.ShiftLeft || keys.ShiftRight) && !HK.noSprint ? W.SPRINT : W.WALK) * (HK.speedMul ? HK.speedMul() : 1);
    let dx = 0, dz = 0;
    const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw), rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
    if (mx || mz) { player.auto = false; dx = fx * mz + rx * mx; dz = fz * mz + rz * mx; const l = Math.hypot(dx, dz); dx /= l; dz /= l; }
    else if (player.auto) { const d = autoDir(); if (d) { dx = d[0]; dz = d[1]; } else player.auto = false; }
    const moving = dx || dz;
    if (moving) {
      const step = sp * dt; let nx = player.x + dx * step, nz = player.z + dz * step;
      if (allowed(nx, nz)) { player.x = nx; player.z = nz; }
      else if (allowed(nx, player.z)) player.x = nx;
      else if (allowed(player.x, nz)) player.z = nz;
      resolveCollisions(player);
      player.bob += step * 1.1; if (HK.moved) HK.moved(step);
    }
    const gy = W.walkHeight(player.x, player.z) + EYE + (moving ? Math.sin(player.bob) * 0.06 : 0);
    player.y = lerp(player.y, gy, 1 - Math.exp(-dt * 14));
    if (player.y < gy - 1.5) player.y = gy - 1.5;
    camera.position.set(player.x, player.y, player.z);
    camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
  }
  function autoDir() {
    const P = W.P; const t = player.autoTarget; if (!t) return null;
    const tc = W.cityById[t.city];
    if (Math.hypot(tc.x - player.x, tc.z - player.z) < 4) { player.autoTarget = null; selected = null; updateTarget(); renderCross(); return null; }
    const q = W.pathQuery(player.x, player.z);
    const inStart = t.from && Math.hypot(W.cityById[t.from].x - player.x, W.cityById[t.from].z - player.z) < W.cityById[t.from].R + 6;
    let gx, gz;
    const e = W.edges[t.edge];
    if (q.i >= 0 && P.E[q.i] === t.edge && !inStart) {
      const dir = e.b === t.city ? 1 : -1; let j = q.i + dir * 5; j = clamp(j, e.start, e.start + e.n - 1);
      gx = P.X[j]; gz = P.Z[j];
    } else {
      // head to the nearest point of the edge, a bit along toward target
      let bi = e.start, bd = 1e18; for (let j = e.start; j < e.start + e.n; j += 2) { const d = (P.X[j] - player.x) ** 2 + (P.Z[j] - player.z) ** 2; if (d < bd) { bd = d; bi = j; } }
      const dir = e.b === t.city ? 1 : -1; const j = clamp(bi + dir * 6, e.start, e.start + e.n - 1); gx = P.X[j]; gz = P.Z[j];
    }
    const dx = gx - player.x, dz = gz - player.z; const l = Math.hypot(dx, dz) || 1; return [dx / l, dz / l];
  }

  // ---------- input ----------
  document.addEventListener('keydown', (e) => {
    if (window.__arenaOn) return;
    if (!started) return;
    if (pauseOpen()) { if (e.code === 'KeyP' || e.code === 'Escape') closePause(); return; }
    if (HK.keydown && HK.keydown(e)) { e.preventDefault(); return; }
    if (e.code === 'KeyP' && !mapOpen) { openPause(); return; }
    if (e.code === 'KeyL' && started) { GFX.setTime(GFX.getTime() + 0.125); showToast('Time of day', GFX.timeName()); return; }
    if (e.code === 'KeyN') { mmZoom = (mmZoom + 1) % 4; $('minimap').classList.toggle('off', mmZoom === 3); return; }
    keys[e.code] = true;
    if (e.code === 'KeyM') { toggleMap(); e.preventDefault(); }
    if (e.code === 'Escape' && mapOpen) toggleMap(false);
    if (mapOpen) return;
    if (e.code === 'KeyF') startAuto();
    if (e.code === 'KeyH') $('help').classList.toggle('show');
    if (/^Digit[1-9]$/.test(e.code)) chooseRoad(+e.code.slice(5) - 1);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  });
  document.addEventListener('keyup', (e) => { keys[e.code] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  let dragLook = false, lastMX = 0, lastMY = 0;
  canvas.addEventListener('mousedown', (e) => {
    if (!started || mapOpen || pauseOpen() || (HK.frozen && HK.frozen())) return;
    if (document.pointerLockElement !== canvas) { tryLock(); dragLook = true; lastMX = e.clientX; lastMY = e.clientY; }
  });
  window.addEventListener('mouseup', () => { dragLook = false; });
  document.addEventListener('mousemove', (e) => {
    if (!started || mapOpen || (HK.uiOpen && HK.uiOpen())) return;
    let dx = 0, dy = 0;
    if (document.pointerLockElement === canvas) { dx = e.movementX; dy = e.movementY; }
    else if (dragLook) { dx = e.clientX - lastMX; dy = e.clientY - lastMY; lastMX = e.clientX; lastMY = e.clientY; }
    else return;
    player.yaw -= dx * 0.0022; player.pitch = clamp(player.pitch - dy * 0.0022, -1.35, 1.35);
  });
  function tryLock() { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { } }
  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === canvas;
    if (locked) { $('pause').classList.remove('show'); pauseDismissed = false; }
    else if (started && !mapOpen && pauseWanted && !pauseDismissed && !(HK.uiOpen && HK.uiOpen())) openPause();
  });
  let pauseWanted = false, pauseDismissed = false;
  const pauseOpen = () => $('pause').classList.contains('show');
  function openPause() { if (document.pointerLockElement) document.exitPointerLock(); for (const k in keys) keys[k] = false; player.auto = false; $('pm-confirm').classList.remove('show'); $('pause').classList.add('show'); document.querySelectorAll('#pm-gfx button').forEach(b => b.classList.toggle('on', b.dataset.q === qName)); }
  function closePause() { $('pause').classList.remove('show'); pauseDismissed = true; tryLock(); }

  // ---------- HUD ----------
  let currentCity = null, selected = null; const visited = new Set();
  const bannerEl = $('banner'), toastEl = $('toast'), crossEl = $('cross'), locEl = $('loc'), compEl = $('compass');
  let bannerTimer = 0, toastTimer = 0;
  function showBanner(c) {
    $('b-name').textContent = c.name; $('b-polity').textContent = c.polity + ' · 1272';
    $('b-modern').textContent = 'Today: ' + c.modern; $('b-blurb').textContent = c.blurb;
    bannerEl.classList.add('show'); bannerTimer = 9;
  }
  function showToast(name, blurb, sub) {
    $('t-name').textContent = name; $('t-blurb').textContent = (blurb || '').replace(/<[^>]+>/g, ''); $('t-sub').textContent = sub || 'Landmark';
    toastEl.classList.add('show'); toastTimer = 9;
  }
  function renderCross() {
    if (!currentCity) { crossEl.classList.remove('show'); return; }
    const c = currentCity;
    let html = `<div class="ct">Crossroads of ${c.name}</div><div class="cs">Choose your next road</div>`;
    c.gates.forEach((g, k) => {
      const o = W.cityById[g.other]; const sel = selected && selected.edge === g.edge;
      const secs = Math.round(W.edges[g.edge].len / W.WALK);
      const extra = HK.roadInfo ? HK.roadInfo(c, g) : null;
      html += `<div class="road${sel ? ' sel' : ''}" data-k="${k}"><span class="key">${k + 1}</span><span class="dot" style="background:${ROUTE_GROUPS[g.group].color}"></span><span class="rn">${o.name}${visited.has(o.id) ? ' <i>✓</i>' : ''}</span><span class="rd">${extra || `${mi(g.km)} mi ${g.dir} · ~${Math.max(1, Math.round(g.km / 30))} days by caravan · ${secs}s walk`}</span></div>`;
    });
    html += `<div class="hint">${selected ? 'Press <b>F</b> to follow the road, or walk out through the gate' : 'Press a number to choose a road'}</div>`;
    crossEl.innerHTML = html; crossEl.classList.add('show');
    crossEl.querySelectorAll('.road').forEach(el => el.onclick = () => chooseRoad(+el.dataset.k));
  }
  function chooseRoad(k) {
    if (!currentCity) return; const g = currentCity.gates[k]; if (!g) return;
    selected = { edge: g.edge, city: g.other, from: currentCity.id };
    renderCross(); updateTarget();
  }
  function startAuto() {
    if (selected) { player.autoTarget = selected; player.auto = true; return; }
    // on a road: pick the endpoint we're facing
    const q = W.pathQuery(player.x, player.z); if (q.i < 0) return;
    const e = W.edges[W.P.E[q.i]]; const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
    const A = W.cityById[e.a], Bc = W.cityById[e.b];
    const dA = (A.x - player.x) * fx + (A.z - player.z) * fz, dB = (Bc.x - player.x) * fx + (Bc.z - player.z) * fz;
    const tgt = dB > dA ? Bc : A;
    selected = { edge: e.id, city: tgt.id, from: null }; player.autoTarget = selected; player.auto = true; updateTarget();
  }
  function updateTarget() {
    const el = $('target');
    if (!selected) { el.classList.remove('show'); return; }
    el.innerHTML = `Heading to <b>${W.cityById[selected.city].name}</b>${player.auto ? ' · following the road' : ''}`; el.classList.add('show');
  }
  let hudTimer = 0, lastEdge = -1;
  function updateHUD(dt) {
    bannerTimer -= dt; if (bannerTimer < 0) bannerEl.classList.remove('show');
    toastTimer -= dt; if (toastTimer < 0) toastEl.classList.remove('show');
    hudTimer -= dt;
    // compass
    const yawDeg = (-player.yaw * 180 / Math.PI) % 360;
    let html = '';
    const marks = [['N', 0], ['NE', 45], ['E', 90], ['SE', 135], ['S', 180], ['SW', 225], ['W', 270], ['NW', 315]];
    for (const [l, a] of marks) { let d = ((a - yawDeg + 540) % 360) - 180; if (Math.abs(d) < 75) html += `<span class="cm${l.length === 1 ? ' big' : ''}" style="left:${50 + d / 75 * 50}%">${l}</span>`; }
    if (selected) {
      const tc = W.cityById[selected.city]; let tx = tc.x, tz = tc.z;
      const q = W.pathQuery(player.x, player.z);
      if (currentCity && currentCity.id === selected.from) { const g = currentCity.gates.find(g => g.edge === selected.edge); if (g) { tx = W.P.X[g.exitI]; tz = W.P.Z[g.exitI]; } }
      else if (q.i >= 0 && W.P.E[q.i] === selected.edge) { const e = W.edges[selected.edge]; const dir = e.b === selected.city ? 1 : -1; const j = clamp(q.i + dir * 30, e.start, e.start + e.n - 1); tx = W.P.X[j]; tz = W.P.Z[j]; }
      const ang = Math.atan2(tx - player.x, -(tz - player.z)) * 180 / Math.PI; let d = ((ang - yawDeg + 540) % 360) - 180;
      html += `<span class="tgt" style="left:${50 + clamp(d, -75, 75) / 75 * 50}%">◆</span>`;
    }
    compEl.innerHTML = html;
    if (hudTimer > 0) return; hudTimer = 0.25;
    // location
    const nc = W.nearestCity(player.x, player.z);
    const inCity = nc.d < nc.c.R + 3 ? nc.c : null;
    if (inCity !== currentCity) {
      if (inCity) { visited.add(inCity.id); showBanner(inCity); if (selected && selected.city === inCity.id && !player.auto) { selected = null; updateTarget(); } }
      currentCity = inCity; renderCross(); if (HK.onCity) HK.onCity(inCity);
    }
    if (inCity) locEl.innerHTML = `<b>${inCity.name}</b><span>${inCity.polity}</span>`;
    else {
      const q = W.pathQuery(player.x, player.z);
      if (q.i >= 0) {
        const e = W.edges[W.P.E[q.i]]; const t = W.P.T[q.i];
        const A = W.cityById[e.a], Bc = W.cityById[e.b];
        locEl.innerHTML = `<b>${ROUTE_GROUPS[e.group].name}</b><span>${A.name} ${mi(e.km * t)} mi · ${Bc.name} ${mi(e.km * (1 - t))} mi</span><span class="pol">${(t < .5 ? A : Bc).polity}</span>`;
        if (e.id !== lastEdge) { lastEdge = e.id; }
      }
    }
    $('visited').textContent = `Cities visited: ${visited.size} / ${W.cities.length}`;
    // points of interest
    for (const p of poiList) {
      const d = Math.hypot(p.x - player.x, p.z - player.z);
      if (!p.shown && d < p.r) { p.shown = true; if (!p.soft || !inCity) showToast(p.name, p.blurb, p.soft ? 'Lake' : (p.city ? 'Landmark · ' + p.city : 'Landmark')); break; }
    }
    // crossing a river bridge
    const bh = W.bridgeAt(player.x, player.z);
    if (bh > -1e8) { const br = W.bridges.find(b => Math.hypot(b.x - player.x, b.z - player.z) < b.half + 2); if (br && !br.name && !br.shown) { br.shown = true; showToast('Crossing the ' + br.river, 'A bridge carries the caravan road over the river.', 'River'); } }
  }

  // ---------- map ----------
  const mapEl = $('map'), mcv = $('mapc'), mctx = mcv.getContext('2d');
  let mapImg = null; const mv = { cx: 0, cy: 0, z: 10 }; let hoverCity = null, mapSel = null;
  let mapLayer = '1272';
  const MP = {}; // cached Path2D in map space (x = degX, y = -degY)
  const toPath = (flat, close) => { const p = new Path2D(); for (let i = 0; i < flat.length; i += 2) { const x = W.degX(flat[i] / 100), y = -W.degY(flat[i + 1] / 100); i ? p.lineTo(x, y) : p.moveTo(x, y); } if (close) p.closePath(); return p; };
  function buildMapImage() {
    const G = W.G; const cv = document.createElement('canvas'); cv.width = G.NX; cv.height = G.NY; const g = cv.getContext('2d');
    const img = g.createImageData(G.NX, G.NY); const d = img.data;
    const hAt = (ix, iy) => W.baseG[iy * G.NX + ix] + W.mtnG[iy * G.NX + ix];
    for (let iy = 0; iy < G.NY; iy++) for (let ix = 0; ix < G.NX; ix++) {
      const lon = G.lon0 + ix * G.d, lat = G.lat0 + iy * G.d; const bi = W.bioIndex(lon, lat);
      let r = W.bio.gr[bi] * .8 + .2 * .93, gg = W.bio.gg[bi] * .8 + .2 * .88, b = W.bio.gb[bi] * .8 + .2 * .74;
      const h = hAt(ix, iy);
      const sx = ix > 0 && ix < G.NX - 1 ? hAt(ix + 1, iy) - hAt(ix - 1, iy) : 0, sy = iy > 0 && iy < G.NY - 1 ? hAt(ix, iy + 1) - hAt(ix, iy - 1) : 0;
      const shade = clamp(1 + (-sx * 0.5 + sy * 0.5) * 0.018, 0.62, 1.28);
      r *= shade; gg *= shade; b *= shade;
      const snow = 95 * W.HS; if (h > snow) { const s = smooth(snow, snow + 50, h); r = lerp(r, .96, s); gg = lerp(gg, .96, s); b = lerp(b, .97, s); }
      const o = ((G.NY - 1 - iy) * G.NX + ix) * 4; d[o] = clamp(r, 0, 1) * 255; d[o + 1] = clamp(gg, 0, 1) * 255; d[o + 2] = clamp(b, 0, 1) * 255; d[o + 3] = 255;
    }
    g.putImageData(img, 0, 0); mapImg = cv; buildMapX();
    const M = GEO.map;
    MP.land = new Path2D(); for (const r of M.land) MP.land.addPath(toPath(r, true));
    MP.lakes = new Path2D(); for (const L of GEO.lakes) MP.lakes.addPath(toPath(L.poly, true));
    MP.rivers = new Path2D(); for (const r of M.rivers) MP.rivers.addPath(toPath(r, false));
    for (const rv of W.RIVER_DEFS) { const p = new Path2D(); rv[2].forEach((q, i) => { const x = W.degX(q[0]), y = -W.degY(q[1]); i ? p.lineTo(x, y) : p.moveTo(x, y); }); MP.rivers.addPath(p); }
    MP.states = M.states.map(st => { const p = new Path2D(); for (const r of st.polys) p.addPath(toPath(r, true)); return { p, st }; });
    MP.modern = M.modern.map(c => { const p = new Path2D(); for (const r of c.polys) p.addPath(toPath(r, true)); return { p, c }; });
    MP.routes = W.edges.map(e => { const p = new Path2D(); const step = Math.max(1, Math.floor(e.deg.length / 300)); for (let i = 0; i < e.deg.length; i += step) { const q = e.deg[i]; i ? p.lineTo(q[0], -q[1]) : p.moveTo(q[0], -q[1]); } const l = e.deg[e.deg.length - 1]; p.lineTo(l[0], -l[1]); return { p, e }; });
  }
  const m2s = (X, Y) => [(X - mv.cx) * mv.z + mcv.width / 2, (mv.cy - Y) * mv.z + mcv.height / 2];
  const s2m = (sx, sy) => [(sx - mcv.width / 2) / mv.z + mv.cx, mv.cy - (sy - mcv.height / 2) / mv.z];
  const MODERN_TINT = ['#e9d9b3', '#e4cfa4', '#ead9ad', '#dccba0', '#e6d2a8', '#ddd0aa', '#e8d4a6'];
  // ================= v15 map: terrain raster, vector contours, clean realm borders, the world 1,500 miles around =================
  const MX = { ok: false }; const GAMEBOX = typeof MAPX !== 'undefined' ? MAPX.game : [23, 126, -1, 52.5];
  function buildMapX() {
    if (typeof MAPX === 'undefined') return; const D = MAPX;
    MX.img = new Image(); MX.img.onload = () => { MX.ok = true; if (mapOpen) drawMap(); }; MX.img.src = D.raster;
    MX.x0 = W.degX(D.ext[0]); MX.x1 = W.degX(D.ext[1]); MX.y0 = W.degY(D.ext[2]); MX.y1 = W.degY(D.ext[3]);
    MX.land = new Path2D(); for (const r of D.land) MX.land.addPath(toPath(r, true));
    MX.lakes = new Path2D(); for (const r of D.lakes) MX.lakes.addPath(toPath(r, true));
    MX.riv = [new Path2D(), new Path2D()]; for (const r of D.rivers) MX.riv[r[0]].addPath(toPath(r.slice(1), false));
    for (const rv of W.RIVER_DEFS) { const p = new Path2D(); rv[2].forEach((q, i) => { const x = W.degX(q[0]), y = -W.degY(q[1]); i ? p.lineTo(x, y) : p.moveTo(x, y); }); MX.riv[1].addPath(p); }
    MX.cont = [new Path2D(), new Path2D()]; for (const c of D.contours) MX.cont[c[0]].addPath(toPath(c.slice(1), true));
    MX.states = D.states.map(st => { const p = new Path2D(); for (const r of st.polys) p.addPath(toPath(r, true)); return { p, st }; });
    MX.modern = D.modern.map(c => { const p = new Path2D(); for (const r of c.polys) p.addPath(toPath(r, true)); return { p, c }; });
  }
  const inGame = (lon, lat) => lon >= GAMEBOX[0] && lon <= GAMEBOX[1] && lat >= GAMEBOX[2] && lat <= GAMEBOX[3];
  function mapMinZoom() { if (!MX.x1) return 5; return Math.max(mcv.width / (MX.x1 - MX.x0), mcv.height / (MX.y1 - MX.y0)); }
  function clampView() {
    if (!MX.x1) return; const zMin = mapMinZoom(); mv.z = clamp(mv.z, zMin, 140);
    const hw = mcv.width / 2 / mv.z, hh = mcv.height / 2 / mv.z;
    mv.cx = clamp(mv.cx, MX.x0 + hw, Math.max(MX.x0 + hw, MX.x1 - hw)); mv.cy = clamp(mv.cy, MX.y0 + hh, Math.max(MX.y0 + hh, MX.y1 - hh));
    const zo = $('zout'); if (zo) zo.classList.toggle('dis', mv.z <= zMin * 1.001);
  }
  function spaced(t) { return t.split('').join(String.fromCharCode(8202)); }
  function drawMap() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    mcv.width = mcv.clientWidth * dpr; mcv.height = mcv.clientHeight * dpr; clampView();
    const g = mctx; const z = mv.z; const D = typeof MAPX !== 'undefined' ? MAPX : null;
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#a7bfbf'; g.fillRect(0, 0, mcv.width, mcv.height);
    const T = () => g.setTransform(z, 0, 0, z, mcv.width / 2 - mv.cx * z, mcv.height / 2 + mv.cy * z);
    const land = MX.land || MP.land;
    T();
    if (MX.ok) { g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(MX.img, MX.x0, -MX.y1, MX.x1 - MX.x0, MX.y1 - MX.y0); }
    else { g.fillStyle = '#eadfbd'; g.fill(land); }
    // contours: thin at every step, stronger index lines; fade out when zoomed far out
    if (MX.cont) { const a = clamp((z / dpr - 8) / 14, 0.35, 1); g.strokeStyle = `rgba(61,42,24,${0.3 * a})`; g.lineWidth = 0.55 * dpr / z; g.stroke(MX.cont[0]); g.strokeStyle = `rgba(61,42,24,${0.45 * a})`; g.lineWidth = 0.95 * dpr / z; g.stroke(MX.cont[1]); }
    // realms: soft fill, an inner band of their colour, a crisp ink border
    const states = MX.states || MP.states;
    if (mapLayer === '1272') {
      g.save(); g.clip(land);
      for (const { p, st } of states) { g.fillStyle = (st.col || '#888') + '24'; g.fill(p); }
      for (const { p, st } of states) { g.save(); g.clip(p); g.strokeStyle = (st.col || '#888') + '70'; g.lineWidth = 7 * dpr / z; g.stroke(p); g.restore(); }
      g.strokeStyle = 'rgba(74,50,32,.82)'; g.lineWidth = 1.15 * dpr / z; g.lineJoin = 'round'; for (const { p } of states) g.stroke(p);
      g.restore();
    } else if (mapLayer === 'modern') {
      const mod = MX.modern || MP.modern; g.save(); g.clip(land);
      mod.forEach(({ p, c }) => { g.fillStyle = MODERN_TINT[(c.c || 1) % MODERN_TINT.length] + '55'; g.fill(p); });
      g.strokeStyle = 'rgba(110,60,90,.8)'; g.lineWidth = 1.1 * dpr / z; for (const { p } of mod) g.stroke(p); g.restore();
    }
    // water
    g.fillStyle = '#a7bfbf'; g.fill(MX.lakes || MP.lakes); g.strokeStyle = 'rgba(74,106,120,.8)'; g.lineWidth = 0.8 * dpr / z; g.stroke(MX.lakes || MP.lakes);
    if (MX.riv) { g.strokeStyle = 'rgba(90,138,160,.85)'; g.lineWidth = 0.7 * dpr / z; g.stroke(MX.riv[0]); g.lineWidth = 1.15 * dpr / z; g.stroke(MX.riv[1]); } else { g.lineWidth = 1.1 * dpr / z; g.strokeStyle = 'rgba(70,115,145,.75)'; g.stroke(MP.rivers); }
    g.lineWidth = 1.25 * dpr / z; g.strokeStyle = 'rgba(61,42,24,.9)'; g.stroke(land);
    // graticule
    g.strokeStyle = 'rgba(61,42,24,.12)'; g.lineWidth = 0.6 * dpr / z; g.beginPath();
    if (D) { for (let lo = -10; lo <= 160; lo += 10) { g.moveTo(W.degX(lo), -MX.y1); g.lineTo(W.degX(lo), -MX.y0); } for (let la = -20; la <= 80; la += 10) { g.moveTo(MX.x0, -W.degY(la)); g.lineTo(MX.x1, -W.degY(la)); } } g.stroke();
    // routes
    if (mapLayer !== 'terrain') {
      g.lineJoin = 'round'; g.lineCap = 'round';
      for (const { p } of MP.routes) { g.strokeStyle = 'rgba(61,42,24,.42)'; g.lineWidth = 4.4 * dpr / z; g.stroke(p); }
      for (const { p, e } of MP.routes) { g.strokeStyle = ROUTE_GROUPS[e.group].color; g.lineWidth = ((selected && selected.edge === e.id) ? 4.8 : 2.5) * dpr / z; g.stroke(p); }
      if (HK.mapExtra) HK.mapExtra(g, z, dpr);
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    const zs = z / dpr; // pixels per degree, in CSS px
    const text = (t, lon, lat, px, col, rot, font, alpha, align) => { const [sx, sy] = m2s(W.degX(lon), W.degY(lat)); if (sx < -200 || sy < -60 || sx > mcv.width + 200 || sy > mcv.height + 60) return;
      g.save(); g.translate(sx, sy); if (rot) g.rotate(-rot * Math.PI / 180); g.font = font.replace('#', Math.round(px * dpr) + 'px'); g.textAlign = align || 'center'; g.textBaseline = 'middle';
      g.globalAlpha = alpha; g.lineWidth = 3 * dpr; g.strokeStyle = 'rgba(244,234,210,.85)'; g.strokeText(t, 0, 0); g.fillStyle = col; g.fillText(t, 0, 0); g.restore(); };
    const lk = clamp(zs / 14, 0.75, 1.7);
    if (D) {
      for (const L of D.labels) {
        if (L.k === 'sea' && L.s * lk >= 0.55) text(spaced(L.t), L.lon, L.lat, 11 * L.s * lk, '#3e6470', L.r, 'italic # Bonum, "EB Garamond", Georgia, serif', .85);
        if (L.k === 'range' && L.s * lk >= 0.6 && mapLayer !== 'modern') text(spaced(L.t), L.lon, L.lat, 9.5 * L.s * lk, '#6a4a2e', L.r, '# Cinzel, Georgia, serif', .75);
        if (L.k === 'realm' && mapLayer === '1272' && L.s * lk >= 0.6) text(spaced(L.t.toUpperCase()), L.lon, L.lat, 11 * L.s * lk, inGame(L.lon, L.lat) ? '#5a2a1a' : '#6a5a4a', L.r, 'italic # Bonum, "EB Garamond", Georgia, serif', .78);
      }
      if (mapLayer === '1272') for (const { st } of states) { if (!st.lab) continue; const [lo, la, sz, r] = st.lab; if (sz * lk < 0.55) continue;
        text(spaced(st.name.toUpperCase()), lo, la, 11.5 * sz * lk, inGame(lo, la) ? '#5a2a1a' : '#6a5a4a', r, 'italic # Bonum, "EB Garamond", Georgia, serif', inGame(lo, la) ? .82 : .72); }
      if (mapLayer === 'modern') for (const { c } of (MX.modern || MP.modern)) text(c.name.toUpperCase(), c.lab[0], c.lab[1], 11 * clamp(lk, .8, 1.3), 'rgba(90,40,70,.9)', 0, '# Bonum, "EB Garamond", Georgia, serif', .8);
      // cities beyond the caravan roads
      for (const c of D.cities) { if (!c.big && zs < 16) continue; const [sx, sy] = m2s(W.degX(c.lon), W.degY(c.lat)); const r = 3 * dpr * clamp(lk, .8, 1.3);
        g.fillStyle = '#f4ead2'; g.strokeStyle = '#6a5a4a'; g.lineWidth = 1.2 * dpr; g.fillRect(sx - r, sy - r, 2 * r, 2 * r); g.strokeRect(sx - r, sy - r, 2 * r, 2 * r);
        text(c.n, c.lon + 4.5 / zs, c.lat, 11.5 * clamp(lk, .85, 1.25), '#5a4a3a', 0, 'italic # Bonum, "EB Garamond", Georgia, serif', .9, 'left'); }
    }
    // caravan cities
    const fs = clamp(z / (20 * dpr), 0.8, 1.5);
    for (const c of W.cities) {
      const [sx, sy] = m2s(c.X, c.Y); const r = (2.6 + c.size * 1.3) * dpr * fs;
      if (sx < -50 || sy < -50 || sx > mcv.width + 50 || sy > mcv.height + 50) continue;
      g.beginPath(); g.arc(sx, sy, r, 0, Math.PI * 2);
      g.fillStyle = visited.has(c.id) ? '#3d2a18' : '#f7efdc'; g.fill(); g.lineWidth = 1.6 * dpr; g.strokeStyle = '#3d2a18'; g.stroke();
      if (c === hoverCity || c === mapSel) { g.beginPath(); g.arc(sx, sy, r + 4 * dpr, 0, Math.PI * 2); g.strokeStyle = '#b23a1e'; g.lineWidth = 2 * dpr; g.stroke(); }
      if (z > 16 * dpr || c.size >= 3 || (c.size >= 2 && z > 9 * dpr) || c === hoverCity || c === mapSel) {
        g.font = `${c.size >= 3 ? 'bold ' : ''}${Math.round((c.size >= 2 ? 13 : 11) * dpr * fs)}px Bonum, "EB Garamond", Georgia, serif`;
        g.lineWidth = 3 * dpr; g.strokeStyle = 'rgba(244,234,210,.9)'; g.fillStyle = '#2b1d10'; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
        const nm = c.name.replace(/ \(.*\)/, ''); g.strokeText(nm, sx + r + 3 * dpr, sy + 4 * dpr); g.fillText(nm, sx + r + 3 * dpr, sy + 4 * dpr);
      }
    }
    // player
    const [px, py] = m2s(player.x / W.K, -player.z / W.K);
    g.save(); g.translate(px, py); g.rotate(-player.yaw);
    g.beginPath(); g.moveTo(0, -11 * dpr); g.lineTo(7 * dpr, 8 * dpr); g.lineTo(0, 4 * dpr); g.lineTo(-7 * dpr, 8 * dpr); g.closePath();
    g.fillStyle = '#c0281b'; g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 1.5 * dpr; g.stroke(); g.restore();
    // compass rose
    g.save(); g.translate(mcv.width - 60 * dpr, mcv.height - 110 * dpr); g.fillStyle = 'rgba(60,40,20,.75)'; g.font = `bold ${14 * dpr}px Cinzel, serif`; g.textAlign = 'center';
    g.beginPath(); g.moveTo(0, -26 * dpr); g.lineTo(6 * dpr, 0); g.lineTo(0, 26 * dpr); g.lineTo(-6 * dpr, 0); g.closePath(); g.fill(); g.fillText('N', 0, -32 * dpr); g.restore();
    // scale bar in miles (1 degree of latitude = 69 miles)
    { const pxPerMi = z / 69; const nice = [25, 50, 100, 200, 250, 500, 1000, 2000]; let mi = nice[0]; for (const n of nice) if (n * pxPerMi <= 170 * dpr) mi = n;
      const L = mi * pxPerMi, x0 = mcv.width - 40 * dpr - L, y0 = mcv.height - 46 * dpr; g.fillStyle = 'rgba(245,234,208,.92)'; g.fillRect(x0 - 10 * dpr, y0 - 22 * dpr, L + 20 * dpr, 36 * dpr);
      g.fillStyle = '#2b1d10'; g.fillRect(x0, y0, L / 2, 5 * dpr); g.strokeStyle = '#2b1d10'; g.lineWidth = 1 * dpr; g.strokeRect(x0, y0, L, 5 * dpr);
      g.font = `${11 * dpr}px Bonum, "EB Garamond", Georgia, serif`; g.textAlign = 'center'; g.fillText('0', x0, y0 - 6 * dpr); g.fillText(fmtN(mi / 2), x0 + L / 2, y0 - 6 * dpr); g.fillText(fmtN(mi) + ' mi', x0 + L, y0 - 6 * dpr); }
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    const zo = $('zoutnote'); if (zo) zo.classList.toggle('show', !!MX.x1 && mv.z <= mapMinZoom() * 1.001);
  }
  const fmtN = n => n.toLocaleString('en-US');
  // ---------- minimap ----------
  let mmZoom = 0; let mmT = 0;
  const MM_SCALE = [2.2, 1.0, 4.5]; // degrees across the minimap
  function drawMinimap(dt) {
    mmT -= dt; if (mmT > 0 || mmZoom === 3 || !mapImg) return; mmT = 0.12;
    const cv = $('minimap'); const dpr = Math.min(2, window.devicePixelRatio || 1); const S0 = cv.clientWidth * dpr; if (S0 < 20) return; if (cv.width !== S0) { cv.width = S0; cv.height = S0; }
    const g = cv.getContext('2d'); const span = MM_SCALE[mmZoom]; const z = S0 / span; const px = player.x / W.K, py = player.z / W.K;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, S0, S0);
    g.save(); g.beginPath(); g.arc(S0 / 2, S0 / 2, S0 / 2 - 2, 0, Math.PI * 2); g.clip();
    g.fillStyle = '#9fb6b6'; g.fillRect(0, 0, S0, S0);
    g.setTransform(z, 0, 0, z, S0 / 2 - px * z, S0 / 2 - py * z);
    if (MX.ok) { g.drawImage(MX.img, MX.x0, -MX.y1, MX.x1 - MX.x0, MX.y1 - MX.y0); if (MX.cont) { g.strokeStyle = 'rgba(61,42,24,.3)'; g.lineWidth = .6 * dpr / z; g.stroke(MX.cont[0]); g.stroke(MX.cont[1]); } g.lineWidth = 1.1 * dpr / z; g.strokeStyle = 'rgba(61,42,24,.85)'; g.stroke(MX.land); }
    else { g.fillStyle = '#e3d2aa'; g.fill(MP.land); g.save(); g.clip(MP.land); const G = W.G;
    g.drawImage(mapImg, W.degX(G.lon0), -W.degY(G.lat0 + (G.NY - 1) * G.d), W.degX(G.lon0 + (G.NX - 1) * G.d) - W.degX(G.lon0), (G.NY - 1) * G.d); g.restore(); }
    g.fillStyle = '#9dbcc4'; g.fill(MP.lakes); g.lineWidth = 1.2 * dpr / z; g.strokeStyle = 'rgba(70,115,145,.8)'; g.stroke(MP.rivers);
    g.lineJoin = 'round'; g.lineCap = 'round';
    for (const { p, e } of MP.routes) { const sel = selected && selected.edge === e.id; g.strokeStyle = sel ? '#fff4c8' : 'rgba(60,40,20,.5)'; g.lineWidth = (sel ? 6 : 4) * dpr / z; g.stroke(p); g.strokeStyle = ROUTE_GROUPS[e.group].color; g.lineWidth = (sel ? 3.4 : 2.4) * dpr / z; g.stroke(p); }
    g.setTransform(1, 0, 0, 1, 0, 0);
    const toS = (X, Y) => [(X - px) * z + S0 / 2, (Y - py) * z + S0 / 2];
    if (HK.minimapDots) for (const d of HK.minimapDots()) { const [sx, sy] = toS(d.x / W.K, d.z / W.K); g.fillStyle = d.c; g.beginPath(); g.arc(sx, sy, 2.6 * dpr, 0, Math.PI * 2); g.fill(); }
    g.font = `${Math.round(11 * dpr)}px Bonum, "EB Garamond", Georgia, serif`; g.textAlign = 'center';
    for (const c of W.cities) { const [sx, sy] = toS(c.x / W.K, c.z / W.K); if (sx < -40 || sy < -40 || sx > S0 + 40 || sy > S0 + 40) continue;
      g.beginPath(); g.arc(sx, sy, (2.5 + c.size) * dpr, 0, Math.PI * 2); g.fillStyle = visited.has(c.id) ? '#3d2a18' : '#f7efdc'; g.fill(); g.lineWidth = 1.4 * dpr; g.strokeStyle = '#3d2a18'; g.stroke();
      g.lineWidth = 3 * dpr; g.strokeStyle = 'rgba(244,234,210,.9)'; g.fillStyle = '#2b1d10'; const nm = c.name.replace(/ \(.*\)/, ''); g.strokeText(nm, sx, sy - 7 * dpr); g.fillText(nm, sx, sy - 7 * dpr); }
    g.save(); g.translate(S0 / 2, S0 / 2); g.rotate(-player.yaw); g.beginPath(); g.moveTo(0, -9 * dpr); g.lineTo(6 * dpr, 7 * dpr); g.lineTo(0, 3.5 * dpr); g.lineTo(-6 * dpr, 7 * dpr); g.closePath(); g.fillStyle = '#c0281b'; g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 1.4 * dpr; g.stroke(); g.restore();
    g.restore();
    g.beginPath(); g.arc(S0 / 2, S0 / 2, S0 / 2 - 2, 0, Math.PI * 2); g.lineWidth = 3 * dpr; g.strokeStyle = 'rgba(60,40,20,.85)'; g.stroke();
    g.fillStyle = '#3d2a18'; g.font = `bold ${Math.round(12 * dpr)}px Cinzel, serif`; g.fillText('N', S0 / 2, 14 * dpr);
  }
  function toggleMap(force) {
    mapOpen = force === undefined ? !mapOpen : force;
    mapEl.classList.toggle('show', mapOpen);
    if (mapOpen) {
      pauseWanted = false; if (document.pointerLockElement) document.exitPointerLock();
      mv.cx = player.x / W.K; mv.cy = -player.z / W.K; mv.z = Math.max(mv.z, 22 * Math.min(2, window.devicePixelRatio || 1)); mapSel = null; renderMapCard(); drawMap();
      $('pause').classList.remove('show');
    } else { tryLock(); pauseWanted = true; }
  }
  function renderMapCard() {
    const el = $('mapcard');
    if (!mapSel) { el.classList.remove('show'); return; }
    const c = mapSel;
    el.innerHTML = `<div class="mn">${c.name}</div><div class="mp">${c.polity}</div><div class="mm">Today: ${c.modern}</div><p>${c.blurb}</p>
      <div class="ml">${LANDMARKS.filter(l => l.city === c.id).map(l => '◆ ' + l.name).join('<br>')}</div>
      ${HK.noTeleport ? `<div class="mm">${HK.mapCityInfo ? HK.mapCityInfo(c) : ''}</div>` : `<button id="tp">Travel to ${c.name.replace(/ \(.*\)/, '')}</button>`}`;
    el.classList.add('show');
    if (!HK.noTeleport) $('tp').onclick = () => teleport(c.id);
  }
  function cityAtScreen(sx, sy) {
    let best = null, bd = 18 * Math.min(2, window.devicePixelRatio || 1);
    for (const c of W.cities) { const s = m2s(c.X, c.Y); const d = Math.hypot(s[0] - sx, s[1] - sy); if (d < bd) { bd = d; best = c; } }
    return best;
  }
  let mDrag = null;
  mcv.addEventListener('mousedown', e => { const dpr = mcv.width / mcv.clientWidth; mDrag = { x: e.clientX, y: e.clientY, cx: mv.cx, cy: mv.cy, moved: false, dpr }; });
  window.addEventListener('mousemove', e => {
    if (!mapOpen) return; const dpr = mcv.width / mcv.clientWidth;
    if (mDrag) { const dx = e.clientX - mDrag.x, dy = e.clientY - mDrag.y; if (Math.abs(dx) + Math.abs(dy) > 3) mDrag.moved = true; mv.cx = mDrag.cx - dx * dpr / mv.z; mv.cy = mDrag.cy + dy * dpr / mv.z; drawMap(); return; }
    const r = mcv.getBoundingClientRect(); const hc = cityAtScreen((e.clientX - r.left) * dpr, (e.clientY - r.top) * dpr);
    if (hc !== hoverCity) { hoverCity = hc; mcv.style.cursor = hc ? 'pointer' : 'grab'; drawMap(); }
  });
  window.addEventListener('mouseup', e => {
    if (!mapOpen || !mDrag) { mDrag = null; return; }
    if (!mDrag.moved) { const r = mcv.getBoundingClientRect(); const dpr = mDrag.dpr; const c = cityAtScreen((e.clientX - r.left) * dpr, (e.clientY - r.top) * dpr); mapSel = c; renderMapCard(); drawMap(); }
    mDrag = null;
  });
  mcv.addEventListener('wheel', e => {
    e.preventDefault(); const dpr = mcv.width / mcv.clientWidth; const r = mcv.getBoundingClientRect();
    const sx = (e.clientX - r.left) * dpr, sy = (e.clientY - r.top) * dpr; const before = s2m(sx, sy);
    mv.z = clamp(mv.z * Math.exp(-e.deltaY * 0.0015), mapMinZoom(), 140); const after = s2m(sx, sy);
    mv.cx += before[0] - after[0]; mv.cy += before[1] - after[1]; drawMap();
  }, { passive: false });
  $('zin').onclick = () => { mv.z = clamp(mv.z * 1.4, mapMinZoom(), 140); drawMap(); };
  $('zout').onclick = () => { mv.z = clamp(mv.z / 1.4, mapMinZoom(), 140); drawMap(); };
  $('mclose').onclick = () => toggleMap(false);
  document.querySelectorAll('.layer').forEach(bt => bt.onclick = () => { mapLayer = bt.dataset.l; document.querySelectorAll('.layer').forEach(x => x.classList.toggle('on', x === bt)); drawMap(); });
  function buildLegend() {
    const D = typeof MAPX !== 'undefined' ? MAPX : null;
    $('legend').innerHTML = Object.values(ROUTE_GROUPS).map(g => `<div><span style="background:${g.color}"></span>${g.name}</div>`).join('') + '<div class="lg2"><i class="o"></i>City on the road · <i class="f"></i>Visited · <i class="sq"></i>Beyond the roads</div>'
      + (D ? `<div class="lgh">Elevation</div><div class="ramp">${D.hcol.map(c => `<b style="background:${c}"></b>`).join('')}</div><div class="rampl"><span>0</span><span>1,200</span><span>3,000</span><span>5,400 m</span></div>` : '');
  }
  function teleport(id) {
    const fade = $('fade'); fade.classList.add('show');
    setTimeout(() => {
      toggleMap(false); placeAtCity(id); selected = null; player.auto = false; updateTarget(); toastTimer = 0; bannerTimer = 0;
      for (const s of sites) if (Math.hypot(s.x - player.x, s.z - player.z) < 500 && !s.built) { if (s.gen) s.gen = null; buildSiteSync(s); }
      updateChunks(player.x, player.z, 0, 480);
      player.y = W.walkHeight(player.x, player.z) + EYE;
      currentCity = null; hudTimer = 0;
      setTimeout(() => fade.classList.remove('show'), 150);
    }, 350);
  }

  // ---------- post init ----------
  function postInit() {
    try {
      buildRoads(); buildRivers(); buildLakes(); buildSea(); buildBridges(); buildSeaTex();
      planProps();
      W.cities.forEach((c, i) => planCity(c, i));
      for (const v of W.villages) sites.push({ x: v.x, z: v.z, kind: 'village', v, built: false, group: null });
      planRouteLandmarks();
      buildClouds(); buildMapImage(); buildLegend();
      placeAtCity('constantinople');
      // look toward Hagia Sophia
      const hs = LANDMARKS.find(l => l.type === 'hagiaSophia');
      setLoad('Growing the forests…', (steps.length + 1) / (steps.length + 2));
      setTimeout(() => {
        for (const s of sites) if (Math.hypot(s.x - player.x, s.z - player.z) < 500) buildSiteSync(s);
        if (hs && hs._pos) { const c = W.cityById.constantinople; const dx = hs._pos[0] - c.x, dz = hs._pos[1] - c.z, dl = Math.hypot(dx, dz); player.x = c.x - dx / dl * 3; player.z = c.z - dz / dl * 3; player.yaw = Math.atan2(-dx, -dz); player.pitch = 0.1; }
        updateChunks(player.x, player.z, 0, 480);
        updatePalette(player.x, player.z, 1);
        player.y = W.walkHeight(player.x, player.z) + EYE;
        setLoad('Ready', 1);
        $('loading').classList.add('done'); $('modes').classList.add('show');
        window.__ready = true;
        loop();
      }, 30);
    } catch (e) { console.error(e); loadTxt.textContent = 'Error: ' + e.message; }
  }
  function startGame(mode) {
    started = true; pauseWanted = true; $('intro').classList.add('hide'); $('hud').classList.add('show'); tryLock();
    hudTimer = 0; if (HK.start) HK.start(mode);
  }
  $('startbtn').onclick = () => startGame('free');
  document.querySelectorAll('.modebtn').forEach(bt => bt.onclick = () => { if (bt.dataset.mode === 'arena') { if (window.Arena) window.Arena.start(); return; } if (bt.dataset.mode === 'journey' && window.openCharSel) window.openCharSel((cid, o) => { HK.charId = cid; HK.campOpts = o || {}; startGame('journey'); }); else startGame(bt.dataset.mode); });
  $('pm-resume').onclick = closePause;
  $('pm-menu').onclick = () => { if (HK.save) HK.save(); location.reload(); };
  $('pm-save').onclick = () => { if (HK.save) HK.save(); $('pm-save').textContent = 'Saved ✓'; setTimeout(() => $('pm-save').textContent = 'Save the journey', 1500); };
  $('pm-restart').onclick = () => $('pm-confirm').classList.add('show');
  $('pm-no').onclick = () => $('pm-confirm').classList.remove('show');
  $('pm-yes').onclick = () => { $('pm-confirm').classList.remove('show'); if (HK.restart) HK.restart(); closePause(); };
  document.querySelectorAll('#pm-gfx button').forEach(b => b.onclick = () => setQuality(b.dataset.q));
  Object.assign(HK, { scene, camera, renderer, player, keys, sites, W, B, objMat, vegMat, addCollider, resolveCollisions, showToast, showBanner, renderCross, updateTarget, tryLock,
    placeAtCity: id => { placeAtCity(id); currentCity = null; hudTimer = 0; for (const s of sites) if (Math.hypot(s.x - player.x, s.z - player.z) < 500 && !s.built) { if (s.gen) s.gen = null; buildSiteSync(s); } updateChunks(player.x, player.z, 0, 480); player.y = W.walkHeight(player.x, player.z) + EYE; },
    getCity: () => currentCity, getSelected: () => selected, clearSelected: () => { selected = null; player.auto = false; updateTarget(); }, visited, lin, CULTURE_GROUND, colliderRemove: c => { for (const a of colHash.values()) { const i = a.indexOf(c); if (i >= 0) a.splice(i, 1); } },
    setPauseWanted: v => { pauseWanted = v; }, isMapOpen: () => mapOpen, toggleMap, openPause, setQuality });
  window.__game = { buildCityTest: (id) => { const s = sites.find(s => s.city && s.city.id === id); const t0 = performance.now(); const g = buildCitySite(s); let tris = 0; g.traverse(o => { if (o.geometry) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; }); return { ms: performance.now() - t0, tris }; }, rendererInfo: () => renderer.info.render, scene, sim: (n, dt) => { for (let i = 0; i < n; i++) { updatePlayer(dt); updateHUD(dt); } }, state: () => ({ city: currentCity && currentCity.id, selected, auto: player.auto, visited: visited.size }), chooseRoad, startAuto, player, W, teleport, toggleMap, chunks, sites, keys,
    placeOnEdge: (a, b, t, look) => { const e = W.edges.find(e => (e.a === a && e.b === b) || (e.a === b && e.b === a)); const j = e.start + Math.round(t * (e.n - 1)); const P = W.P; player.x = P.X[j]; player.z = P.Z[j]; const k = Math.min(e.start + e.n - 1, j + 3); player.yaw = Math.atan2(-(P.X[k] - P.X[j]), -(P.Z[k] - P.Z[j])) + (look || 0); for (const s of sites) if (Math.hypot(s.x - player.x, s.z - player.z) < 600 && !s.built) { if (s.gen) s.gen = null; buildSiteSync(s); } updateChunks(player.x, player.z, 0, 480); player.y = W.walkHeight(player.x, player.z) + EYE; }, setStarted: () => { started = true; $('intro').classList.add('hide'); $('hud').classList.add('show'); } };

  // ================= v13 GRAPHICS: day/night, sky, stars, moon, clouds, weather, bloom =================
  const GFX = { lightDir: SUN_DIR.clone(), night: 0, day: 1 };
  const DN = { t: 0.14, len: 600, sun: new THREE.Vector3(0, 1, 0), moon: new THREE.Vector3(0, -1, 0), night: 0, twi: 0, day: 1 };
  const _C = h => new THREE.Color(h);
  const NIGHTP = { zen: _C(0x0a1634), hor: _C(0x24345a), fog: _C(0x1b2846), moon: _C(0x9fb6ff), hs: _C(0x56699a), hg: _C(0x262838) };
  const SETC = _C(0xf2925a), SETC2 = _C(0xb05f86), SETSUN = _C(0xff8f4a);
  const tC1 = new THREE.Color(), tC2 = new THREE.Color(), tC3 = new THREE.Color(), tV = new THREE.Vector3();
  const smoothJ = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  function dirAt(th, south) { return new THREE.Vector3(Math.cos(th), Math.sin(th) * 0.9, south).normalize(); }

  // ---- stars ----
  const starGeo = new THREE.BufferGeometry(); {
    const N = 3200, pos = new Float32Array(N * 3), mag = new Float32Array(N); const r = W.rng(4242);
    for (let i = 0; i < N; i++) { let x, y, z, l; do { x = r() * 2 - 1; y = r() * 2 - 1; z = r() * 2 - 1; l = Math.hypot(x, y, z); } while (l > 1 || l < 0.1);
      // a faint band of extra stars (the Milky Way)
      if (i % 3 === 0) { const a = r() * Math.PI * 2; x = Math.cos(a); z = Math.sin(a) * 0.35; y = Math.sin(a) * 0.9 + (r() - .5) * 0.25; l = Math.hypot(x, y, z); }
      pos[i * 3] = x / l * 2700; pos[i * 3 + 1] = y / l * 2700; pos[i * 3 + 2] = z / l * 2700; mag[i] = Math.pow(r(), 3.5); }
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); starGeo.setAttribute('aMag', new THREE.BufferAttribute(mag, 1));
  }
  const starMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uNight: { value: 0 }, uTime: { value: 0 }, uPx: { value: 1 } },
    vertexShader: `attribute float aMag; uniform float uNight; uniform float uTime; uniform float uPx; varying float vA;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = (1.3 + aMag * 2.6) * uPx; vec3 wp = normalize((modelMatrix * vec4(position, 1.0)).xyz - cameraPosition);
        vA = uNight * (0.35 + 0.65 * aMag) * (0.75 + 0.25 * sin(uTime * (1.3 + aMag * 4.0) + position.x * 0.1)) * smoothstep(0.0, 0.15, wp.y); }`,
    fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(vec3(1.0, 0.95, 0.86) * 1.5, vA * (1.0 - smoothstep(0.1, 0.5, d))); }` });
  const stars = new THREE.Points(starGeo, starMat); stars.frustumCulled = false; stars.renderOrder = 0; scene.add(stars);
  // ---- moon ----
  const moonMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false, uniforms: { uVis: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: GLSL_NOISE + `uniform float uVis; varying vec2 vUv;
      void main(){ vec2 p = (vUv - 0.5) * 2.0; float r = length(p);
        float disc = 1.0 - smoothstep(0.30, 0.32, r);
        float cr = vn(p * 7.0) * 0.6 + vn(p * 17.0) * 0.4; vec3 mc = vec3(0.95, 0.94, 0.88) * (0.78 + 0.3 * cr) - vec3(0.12) * smoothstep(0.55, 0.7, vn(p * 3.5 + 2.0));
        float sh = smoothstep(-0.05, 0.12, dot(p, normalize(vec2(-0.8, 0.35))) + 0.18);
        mc *= 0.3 + 0.7 * sh; float glow = exp(-r * 4.5) * 0.45 * (1.0 - disc);
        gl_FragColor = vec4(mc * disc * 1.6 + vec3(0.6, 0.7, 0.95) * glow, (disc + glow) * uVis); }` });
  const moon = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), moonMat); moon.renderOrder = 0; moon.frustumCulled = false; scene.add(moon);

  // ---- painted clouds (toon-banded, Firewatch style) ----
  GFX.cloudMat = new THREE.ShaderMaterial({ fog: false,
    uniforms: { uL: { value: SUN_DIR.clone() }, uLit: { value: new THREE.Color(1, 1, 1) }, uMid: { value: new THREE.Color(.9, .88, .86) }, uShade: { value: new THREE.Color(.6, .65, .75) }, uRim: { value: new THREE.Color(1, .9, .7) }, uFar: { value: new THREE.Color(.9, .85, .8) } },
    vertexShader: 'varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform vec3 uL; uniform vec3 uLit; uniform vec3 uMid; uniform vec3 uShade; uniform vec3 uRim; uniform vec3 uFar; varying vec3 vN; varying vec3 vW;
      void main(){ vec3 N = normalize(vN); float l = dot(N, uL) * 0.5 + 0.5; l += (vW.y - 700.0) * 0.0006;
        vec3 c = mix(uShade, uMid, smoothstep(0.36, 0.42, l)); c = mix(c, uLit, smoothstep(0.66, 0.72, l));
        vec3 V = normalize(cameraPosition - vW); float rim = pow(1.0 - abs(dot(N, V)), 4.0) * (0.4 + 0.6 * max(dot(-V, uL), 0.0)); c += uRim * rim * 0.55;
        float d = length(vW.xz - cameraPosition.xz); c = mix(c, uFar, smoothstep(700.0, 2500.0, d) * 0.8);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }` });

  // ---- weather ----
  const WX = {
    clear: { n: 0 },
    rain: { n: 1, col: [.62, .68, .78], a: .5, size: .9, vel: [1.6, -24, .9], box: 48, streak: 1, wob: 0, fogMul: .5, fog: 0x8a95a2, sun: .3, cover: 1, over: .75, sky: 0x7d8796 },
    snow: { n: 1, col: [1, 1, 1], a: .9, size: .075, vel: [.9, -2.1, .4], box: 44, streak: 0, wob: .9, fogMul: .45, fog: 0xdde3ea, sun: .5, cover: 1, over: .7, sky: 0xc8ced8 },
    sand: { n: 1.4, col: [.9, .68, .42], a: .9, size: .16, vel: [15, -.5, 5], box: 50, streak: 0, wob: 1.5, fogMul: .065, fog: 0xc8945a, sun: .45, cover: .3, over: .65, sky: 0xd0a070 },
    dust: { n: .45, col: [.86, .76, .58], a: .35, size: .06, vel: [6, .3, 2], box: 56, streak: 0, wob: 1.2, fogMul: .68, fog: 0xd8c39a, sun: .85, cover: .45, over: .25, sky: 0xd9c9a6 },
    mist: { n: 0, fogMul: .62, fog: 0xdfe3e2, sun: .8, cover: .5, over: .2, sky: 0xd5dadc, mist: 1 },
  };
  const wxState = { type: 'clear', k: 0, target: 'clear', period: -1, force: null, timer: 0 };
  const wxGeo = new THREE.BufferGeometry(); {
    const N = 6000, seed = new Float32Array(N * 3); for (let i = 0; i < N * 3; i++) seed[i] = Math.random();
    wxGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3)); wxGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3));
  }
  const wxMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false,
    uniforms: { uVel: { value: new THREE.Vector3() }, uBox: { value: 48 }, uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uSize: { value: 1 }, uScale: { value: 600 }, uCol: { value: new THREE.Color() }, uAlpha: { value: 0 }, uStreak: { value: 0 }, uWob: { value: 0 }, uLight: { value: 1 } },
    vertexShader: `attribute vec3 aSeed; uniform vec3 uVel; uniform float uBox; uniform float uTime; uniform vec3 uCam; uniform float uSize; uniform float uScale; uniform float uAlpha; uniform float uWob; varying float vA;
      void main(){ vec3 p = aSeed * uBox + uVel * uTime;
        p.x += sin(uTime * 0.9 + aSeed.y * 40.0) * uWob; p.z += cos(uTime * 0.7 + aSeed.x * 40.0) * uWob; p.y += sin(uTime * 1.3 + aSeed.z * 30.0) * uWob * 0.3;
        p = mod(p - uCam, uBox) - uBox * 0.5 + uCam;
        vec4 mv = viewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; float d = -mv.z;
        gl_PointSize = min(uSize * uScale / max(d, 0.4), 90.0);
        vA = uAlpha * (1.0 - smoothstep(uBox * 0.3, uBox * 0.5, length(p - uCam))) * smoothstep(0.4, 1.6, d); }`,
    fragmentShader: `uniform vec3 uCol; uniform float uStreak; uniform float uLight; varying float vA;
      void main(){ vec2 pc = gl_PointCoord - 0.5; float m = uStreak > 0.5 ? (1.0 - smoothstep(0.012, 0.03, abs(pc.x))) * (1.0 - smoothstep(0.25, 0.5, abs(pc.y))) : 1.0 - smoothstep(0.12, 0.5, length(pc));
        if (m * vA < 0.01) discard; gl_FragColor = vec4(uCol * uLight, vA * m); }` });
  const wxPts = new THREE.Points(wxGeo, wxMat); wxPts.frustumCulled = false; wxPts.renderOrder = 5; scene.add(wxPts);
  const DESERTS = ['sand', 'nafud', 'thar', 'gobi', 'flaming'], DUSTY = ['steppe', 'iran', 'mesopotamia', 'loess', 'hejaz', 'gobi', 'yemen'], WETWEST = ['thrace', 'anatolia', 'pontic', 'caucasus', 'hyrcanian', 'levant'], MONS = ['indoplain', 'tropical', 'deccan', 'dryzone', 'southchina'];
  function hash2(a, b) { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function weatherOdds() {
    const ll = W.toLL(player.x, player.z), lon = ll[0], lat = ll[1]; const dom = W.BIOME_KEYS[W.bio.dom[W.bioIndex(lon, lat)]];
    const m = HK.seasonMonth ? HK.seasonMonth() : 6.3; const sw = seasonWeights(m); const o = { rain: 0, snow: 0, sand: 0, dust: 0, mist: 0 };
    const summerish = sw.s + sw.sp * 0.6;
    if (MONS.includes(dom) || (lon > 73 && lat < 29 && lon < 123)) o.rain += (m >= 5.2 && m <= 9.2) ? 0.55 : (dom === 'southchina' ? 0.18 : 0.04);
    if (WETWEST.includes(dom) || dom === 'northchina' || dom === 'alpine') o.rain += 0.06 + (sw.w + sw.sp + sw.a) * 0.16 + (dom === 'northchina' ? sw.s * 0.25 : 0);
    if (sw.w > 0.3 && (lat > 33 || dom === 'tibet' || dom === 'alpine' || dom === 'caucasus')) { o.snow += sw.w * (dom === 'tibet' || dom === 'alpine' ? 0.6 : 0.42); o.rain *= 0.3; }
    if (player.y > 75) o.snow += 0.12;
    if (DESERTS.includes(dom) || (dom === 'nile' && Math.abs(W.riverQuery(player.x, player.z).d) > 60)) o.sand += 0.1 + summerish * 0.14;
    if (DUSTY.includes(dom)) o.dust += 0.07 + (sw.s + sw.a) * 0.15;
    const rq = W.riverQuery(player.x, player.z); const wet = (rq.i >= 0 && rq.d < rq.hw + 90) || W.OUT.lake > 0.05;
    if (DN.t > 0.97 || DN.t < 0.13) o.mist += wet ? 0.75 : (WETWEST.includes(dom) || MONS.includes(dom) || dom === 'southchina' || dom === 'hyrcanian' ? 0.3 : 0.05);
    return o;
  }
  function pickWeather() {
    const period = Math.floor(performance.now() / 80000); const ll = W.toLL(player.x, player.z); const o = weatherOdds();
    if (wxState.force) return wxState.force;
    let u = hash2(period * 13 + 7, Math.floor(ll[0] / 3) * 101 + Math.floor(ll[1] / 3)); for (const k of ['mist', 'snow', 'rain', 'sand', 'dust']) { if (u < o[k]) return k; u -= o[k]; }
    return 'clear';
  }
  function updateWeather(dt) {
    wxState.timer -= dt; if (wxState.timer < 0) { wxState.timer = 3; wxState.target = started ? pickWeather() : 'clear'; if (wxState.force) wxState.target = wxState.force; }
    if (wxState.type !== wxState.target) { wxState.k -= dt / 7; if (wxState.k <= 0) { wxState.k = 0; wxState.type = wxState.target; } }
    else wxState.k = Math.min(1, wxState.k + dt / 9);
    const d = WX[wxState.type], k = wxState.k; const u = wxMat.uniforms;
    const n = d.n ? Math.round(Q.wx * d.n * k) : 0; wxGeo.setDrawRange(0, Math.min(6000, n)); wxPts.visible = n > 0;
    if (n > 0) { u.uVel.value.set(d.vel[0], d.vel[1], d.vel[2]); u.uBox.value = d.box; u.uSize.value = d.size; u.uCol.value.setRGB(d.col[0], d.col[1], d.col[2]); u.uAlpha.value = d.a * Math.min(1, k * 1.5); u.uStreak.value = d.streak; u.uWob.value = d.wob;
      u.uTime.value = (performance.now() / 1000) % 600; u.uCam.value.copy(camera.position); u.uScale.value = renderer.domElement.height / (2 * Math.tan(camera.fov * Math.PI / 360)); u.uLight.value = 0.25 + 0.75 * DN.day; }
  }

  // ---- bloom + light shafts ----
  let bl = null; const blScene = new THREE.Scene(); const blQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); blScene.add(blQuad);
  const VQ = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const brightMat = new THREE.ShaderMaterial({ depthTest: false, depthWrite: false, uniforms: { tSrc: { value: null }, uTex: { value: new THREE.Vector2() }, uThr: { value: 1.2 } }, vertexShader: VQ,
    fragmentShader: `uniform sampler2D tSrc; uniform vec2 uTex; uniform float uThr; varying vec2 vUv;
      void main(){ vec3 c = (texture2D(tSrc, vUv + uTex * vec2(-1.0, -1.0)).rgb + texture2D(tSrc, vUv + uTex * vec2(1.0, -1.0)).rgb + texture2D(tSrc, vUv + uTex * vec2(-1.0, 1.0)).rgb + texture2D(tSrc, vUv + uTex * vec2(1.0, 1.0)).rgb) * 0.25;
        float l = max(c.r, max(c.g, c.b)); float k = max(l - uThr, 0.0); k = k * k / (k + 0.6); gl_FragColor = vec4(min(c / max(l, 1e-4) * k, vec3(6.0)), 1.0); }` });
  const blurMat = new THREE.ShaderMaterial({ depthTest: false, depthWrite: false, uniforms: { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } }, vertexShader: VQ,
    fragmentShader: `uniform sampler2D tSrc; uniform vec2 uDir; varying vec2 vUv;
      void main(){ vec3 c = texture2D(tSrc, vUv).rgb * 0.227; c += (texture2D(tSrc, vUv + uDir * 1.385).rgb + texture2D(tSrc, vUv - uDir * 1.385).rgb) * 0.316; c += (texture2D(tSrc, vUv + uDir * 3.23).rgb + texture2D(tSrc, vUv - uDir * 3.23).rgb) * 0.07; gl_FragColor = vec4(c, 1.0); }` });
  const copyMat = new THREE.ShaderMaterial({ depthTest: false, depthWrite: false, uniforms: { tSrc: { value: null }, uTex: { value: new THREE.Vector2() } }, vertexShader: VQ,
    fragmentShader: `uniform sampler2D tSrc; uniform vec2 uTex; varying vec2 vUv; void main(){ gl_FragColor = vec4((texture2D(tSrc, vUv + uTex * vec2(-1.0,-1.0)).rgb + texture2D(tSrc, vUv + uTex * vec2(1.0,-1.0)).rgb + texture2D(tSrc, vUv + uTex * vec2(-1.0,1.0)).rgb + texture2D(tSrc, vUv + uTex * vec2(1.0,1.0)).rgb) * 0.25, 1.0); }` });
  function ensureBloom() {
    const w = rt.width, h = rt.height; if (bl && bl.w === w && bl.h === h) return;
    if (bl) for (const t of bl.t) t.dispose();
    const mk = (d) => new THREE.WebGLRenderTarget(Math.max(1, w >> d), Math.max(1, h >> d), { type: THREE.HalfFloatType, depthBuffer: false });
    bl = { w, h, t: [mk(2), mk(2), mk(3), mk(3)] };
  }
  function pass(mat, target) { blQuad.material = mat; renderer.setRenderTarget(target); renderer.render(blScene, postCam); }
  function bloomPasses() {
    ensureBloom(); const [A, B2, C2, D] = bl.t;
    brightMat.uniforms.tSrc.value = rt.texture; brightMat.uniforms.uTex.value.set(1 / rt.width, 1 / rt.height); pass(brightMat, A);
    blurMat.uniforms.tSrc.value = A.texture; blurMat.uniforms.uDir.value.set(1 / A.width, 0); pass(blurMat, B2);
    blurMat.uniforms.tSrc.value = B2.texture; blurMat.uniforms.uDir.value.set(0, 1 / A.height); pass(blurMat, A);
    copyMat.uniforms.tSrc.value = A.texture; copyMat.uniforms.uTex.value.set(0.5 / A.width, 0.5 / A.height); pass(copyMat, C2);
    blurMat.uniforms.tSrc.value = C2.texture; blurMat.uniforms.uDir.value.set(1.5 / C2.width, 0); pass(blurMat, D);
    blurMat.uniforms.tSrc.value = D.texture; blurMat.uniforms.uDir.value.set(0, 1.5 / C2.height); pass(blurMat, C2);
    postMat.uniforms.tBloomA.value = A.texture; postMat.uniforms.tBloomB.value = C2.texture;
  }
  const sunScr = new THREE.Vector3();
  GFX.render = () => {
    if (POST && rt) {
      renderer.setRenderTarget(rt); renderer.render(scene, camera);
      const pu = postMat.uniforms;
      if (Q.bloom) { bloomPasses(); pu.uBloom.value = 0.55 + DN.night * 0.35; } else pu.uBloom.value = 0;
      if (Q.shafts && Q.bloom && DN.day > 0.05) {
        sunScr.copy(DN.sun).multiplyScalar(1000).add(camera.position).project(camera); camera.getWorldDirection(tV);
        const facing = smoothJ(0.25, 0.7, tV.dot(DN.sun)); const ov = 1 - (WX[wxState.type].over || 0) * wxState.k;
        pu.uSun.value.set(sunScr.x * 0.5 + 0.5, sunScr.y * 0.5 + 0.5, sunScr.z < 1 ? facing * DN.day * ov : 0); pu.uShaft.value = 0.55; pu.uAspect.value = camera.aspect;
      } else pu.uShaft.value = 0;
      renderer.setRenderTarget(null); renderer.render(postScene, postCam);
    } else renderer.render(scene, camera);
  };

  // ---- the clock and the light ----
  GFX.setTime = t => { DN.t = ((t % 1) + 1) % 1; };
  GFX.getTime = () => DN.t;
  GFX.timeName = () => { const t = DN.t; return t < 0.04 ? 'Dawn' : t < 0.17 ? 'Morning' : t < 0.33 ? 'Midday' : t < 0.46 ? 'Afternoon' : t < 0.53 ? 'Dusk' : t < 0.7 ? 'Evening' : t < 0.92 ? 'Deep night' : 'Before dawn'; };
  GFX.setWeather = w => { wxState.force = w && WX[w] ? w : null; wxState.timer = 0; if (w && WX[w]) { wxState.type = w; wxState.target = w; wxState.k = 1; } };
  GFX.weather = () => wxState.type;
  function applyLight(dt) {
    const th = DN.t * Math.PI * 2; DN.sun.copy(dirAt(th, 0.42)); DN.moon.copy(dirAt(th + Math.PI + 0.3, 0.5));
    const sy = DN.sun.y, my = DN.moon.y;
    DN.day = smoothJ(-0.07, 0.1, sy); DN.night = 1 - smoothJ(-0.2, 0.0, sy); DN.twi = Math.max(0, 1 - Math.abs(sy - 0.03) / 0.26);
    GFX.night = DN.night; GFX.day = DN.day;
    const wd = WX[wxState.type], wk = wxState.k; const over = (wd.over || 0) * wk, twi = DN.twi * (1 - over * 0.8), night = DN.night;
    // sky
    const su = skyMat.uniforms;
    su.zen.value.copy(palCur.zen).lerp(NIGHTP.zen, night); su.zen.value.multiplyScalar(1 - twi * 0.18 * (1 - night));
    su.hor.value.copy(palCur.hor).lerp(NIGHTP.hor, night);
    su.sunc.value.copy(palCur.sun).lerp(SETSUN, twi * 0.7); su.sdir.value.copy(DN.sun); su.mdir.value.copy(DN.moon);
    su.setc.value.copy(SETC).lerp(SETC2, smoothJ(0.05, -0.15, sy)); su.twi.value = twi * 0.85;
    su.sunVis.value = smoothJ(-0.06, 0.02, sy) * (1 - over * 0.9); su.moonVis.value = night * smoothJ(-0.05, 0.1, my) * (1 - over * 0.8);
    su.overcast.value = over; su.wxc.value.set(wd.sky || 0x888888).lerp(NIGHTP.hor, night * 0.85);
    // fog + haze
    scene.fog.color.copy(palCur.fog).lerp(NIGHTP.fog, night); tC1.copy(SETC).multiplyScalar(0.9); scene.fog.color.lerp(tC1, twi * 0.3);
    if (wk > 0 && wd.fog) { tC2.set(wd.fog).lerp(NIGHTP.fog, night * 0.8); scene.fog.color.lerp(tC2, wk * 0.85); }
    const fm = 1 + ((wd.fogMul || 1) - 1) * wk; scene.fog.far = palCur.far * 1.45 * fm * (1 - night * 0.12); scene.fog.near = 90 * Math.max(0.15, fm * fm);
    HAZE_U.uHazeFar.value.copy(su.hor.value).lerp(su.zen.value, 0.4).lerp(scene.fog.color, 0.35 + over * 0.5);
    let mist = wd.mist ? wk : 0; HAZE_U.uMist.value += (mist - HAZE_U.uMist.value) * Math.min(1, dt * 0.5);
    { const rq = W.riverQuery(player.x, player.z); const gy = player.y - EYE; HAZE_U.uMistY.value = (rq.i >= 0 && rq.d < rq.hw + 120) ? Math.min(gy, rq.h + 3) : gy - 2; }
    // sun / moon light
    const sunMul = 1 + ((wd.sun || 1) - 1) * wk;
    if (sy > -0.04) { GFX.lightDir.copy(DN.sun); sun.color.copy(palCur.sun).lerp(SETSUN, twi * 0.75); sun.intensity = 3.0 * smoothJ(-0.04, 0.16, sy) * sunMul; }
    else { GFX.lightDir.copy(DN.moon); sun.color.copy(NIGHTP.moon); sun.intensity = 0.95 * smoothJ(-0.04, -0.2, sy) * smoothJ(0.0, 0.25, my) * (1 - over * 0.6); }
    if (GFX.lightDir.y < 0.08) { GFX.lightDir.y = 0.08; GFX.lightDir.normalize(); }
    hemi.color.copy(palCur.hs).lerp(NIGHTP.hs, night); hemi.groundColor.copy(palCur.hg).lerp(NIGHTP.hg, night);
    if (twi > 0) { tC3.copy(SETC); hemi.color.lerp(tC3, twi * 0.25 * (1 - night)); }
    hemi.intensity = (1.75 - 0.95 * night) * (1 - twi * 0.15) * (1 + over * 0.15);
    // post, rim, water, stars, moon, clouds
    postMat.uniforms.uExposure.value = 0.92 + night * 0.48; postMat.uniforms.uNight.value = night;
    RIM_U.uRimCol.value.copy(sun.color).multiplyScalar(Math.min(1.2, sun.intensity * 0.42)); RIM_U.uLDir.value.copy(GFX.lightDir); RIM_U.uNight.value = night;
    WATER_U.uZen.value.copy(su.zen.value).lerp(su.wxc.value, over); WATER_U.uHor.value.copy(su.hor.value).lerp(scene.fog.color, 0.3 + over * 0.5); WATER_U.uSunW.value.copy(GFX.lightDir); WATER_U.uSunC.value.copy(sun.color).multiplyScalar(sun.intensity * 0.5);
    starGeo.setDrawRange(0, Q.stars); starMat.uniforms.uNight.value = night * (1 - over); starMat.uniforms.uTime.value = performance.now() / 1000; starMat.uniforms.uPx.value = renderer.getPixelRatio();
    stars.position.copy(camera.position); stars.rotation.set(0.66, 0, 0); stars.rotateY(th * 0.5);
    moon.position.copy(DN.moon).multiplyScalar(2500).add(camera.position); moon.scale.setScalar(260); moon.lookAt(camera.position); moonMat.uniforms.uVis.value = smoothJ(-0.02, 0.06, my) * (0.35 + 0.65 * night) * (1 - over * 0.85);
    const cu = GFX.cloudMat.uniforms; cu.uL.value.copy(sy > -0.05 ? DN.sun : DN.moon);
    tC1.setRGB(1, 1, 1).lerp(sun.color, 0.35 + twi * 0.4).multiplyScalar(1.05 * DN.day + 0.1 * night); cu.uLit.value.copy(tC1).lerp(su.wxc.value, over * 0.8);
    cu.uMid.value.copy(su.hor.value).lerp(tC1, 0.55).lerp(su.wxc.value, over * 0.5);
    cu.uShade.value.copy(su.zen.value).lerp(su.hor.value, 0.45).multiplyScalar(0.85 - over * 0.15).lerp(su.wxc.value, over * 0.5).multiplyScalar(1 - over * 0.3);
    cu.uRim.value.copy(sun.color).multiplyScalar(0.6 * DN.day + 0.08 * night); cu.uFar.value.copy(su.hor.value).lerp(scene.fog.color, 0.3);
    GFX.cloudCover = Math.min(1, 0.55 + ((wd.cover || 0.55) - 0.55) * wk);
  }
  GFX.update = (dt, now) => {
    DN.t = (DN.t + dt / DN.len) % 1;
    updateWeather(dt); applyLight(dt);
    if (GFX.lifeUpdate) GFX.lifeUpdate(dt, now);
    if (GFX.groundUpdate) GFX.groundUpdate(dt, now);
  };
  GFX.siteBuilt = s => { if (GFX.onSite) GFX.onSite(s, true); };
  GFX.siteGone = s => { if (GFX.onSite) GFX.onSite(s, false); };
  window.__gfx = GFX;

  // ================= v13 LIFE: birds, herds, people at work, smoke, flags, lanterns, wheels, windmills, boats =================
  // One animated material drives everything that moves on the GPU: legs (1), wings (2), flags (3), awnings (4), glowing (5), swinging glowing lanterns (6), swinging (7)
  const animMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
  animMat.onBeforeCompile = (sh) => {
    sh.uniforms.time = waterUniforms.time; Object.assign(sh.uniforms, RIM_U);
    sh.vertexShader = 'attribute vec4 aPart; attribute vec2 aAnim; uniform float time; varying float vGlow; varying vec3 vWPos; varying vec3 vWNorm;\n' + sh.vertexShader
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vGlow = 0.0; int ty = int(aPart.x + 0.5);
        if (ty == 1) { float a = sin(aAnim.x) * aAnim.y * aPart.y; vec3 q = transformed - vec3(0.0, aPart.z, 0.0); transformed = vec3(q.x, aPart.z + q.y * cos(a) - q.z * sin(a), q.y * sin(a) + q.z * cos(a)); }
        else if (ty == 2) { float a = (sin(aAnim.x) * 0.85 + 0.15) * aAnim.y * aPart.y; float c = cos(a), s = sin(a); transformed = vec3(transformed.x * c - transformed.y * s, transformed.x * s + transformed.y * c, transformed.z); }
        else if (ty == 3) { float ph = time * 5.5 + aAnim.x - aPart.y * 7.0; float w = sin(ph) * 0.22 + sin(ph * 1.7 + 1.3) * 0.08; transformed += vec3(aPart.z, 0.0, aPart.w) * w * aPart.y * aAnim.y; transformed.y += sin(ph * 0.8) * 0.05 * aPart.y * aAnim.y; }
        else if (ty == 4) { float ph = time * 3.2 + aAnim.x - aPart.y * 4.0; transformed.y += sin(ph) * 0.06 * aPart.y * aAnim.y; }
        else if (ty >= 5) { vGlow = ty == 7 ? 0.0 : 1.0; if (ty >= 6) { float a = sin(time * 1.7 + aAnim.x) * 0.14 * aAnim.y; vec3 pv = aPart.yzw; vec3 q = transformed - pv; transformed = pv + vec3(q.x * cos(a) - q.y * sin(a), q.x * sin(a) + q.y * cos(a), q.z); } }`)
      .replace('#include <project_vertex>', `#include <project_vertex>
        { vec4 wq = vec4(transformed, 1.0); vec3 nq = objectNormal;
          #ifdef USE_INSTANCING
            wq = instanceMatrix * wq; nq = mat3(instanceMatrix) * nq;
          #endif
          vWPos = (modelMatrix * wq).xyz; vWNorm = normalize(mat3(modelMatrix) * nq); }`);
    sh.fragmentShader = 'varying float vGlow; varying vec3 vWPos; varying vec3 vWNorm;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += diffuseColor.rgb * vGlow * (0.25 + uNight * 3.2);`);
    withRim(sh, 0.2); withHaze(sh, 'vWPos');
  };
  // ---- geometry helpers: a Builder that also records the animation part of every vertex ----
  function Deco() { this.b = new B.Builder(); this.b.ao = false; this.b.jit = 0.03; this.part = []; this.anim = []; this.n = 0; }
  Deco.prototype.add = function (fn, part, anim) { const b = this.b; fn(b); const n = b.pos.length / 3; const p = part || [0, 0, 0, 0], a = anim || [0, 0]; for (let i = this.n; i < n; i++) { this.part.push(p[0], p[1], p[2], p[3]); this.anim.push(a[0], a[1]); } this.n = n; };
  Deco.prototype.addGeo = function (g, part, anim, ox = 0, oy = 0, oz = 0) { // copy an existing (non-indexed) geometry
    const P = g.attributes.position.array, Cc = g.attributes.color.array; const b = this.b; for (let i = 0; i < P.length; i += 3) { b.pos.push(P[i] + ox, P[i + 1] + oy, P[i + 2] + oz); b.col.push(Cc[i], Cc[i + 1], Cc[i + 2]); }
    this.add(() => { }, part, anim); };
  Deco.prototype.geometry = function (instAnim) {
    const g = this.b.geometry(); g.setAttribute('aPart', new THREE.Float32BufferAttribute(this.part, 4)); if (!instAnim) g.setAttribute('aAnim', new THREE.Float32BufferAttribute(this.anim, 2)); g.userData.shared = !!instAnim; return g; };
  // ---- instanced pools ----
  function Pool(geo, cap, shadow) {
    this.geo = geo; this.cap = cap; this.anim = new THREE.InstancedBufferAttribute(new Float32Array(cap * 2), 2); this.anim.setUsage(THREE.DynamicDrawUsage); geo.setAttribute('aAnim', this.anim);
    const m = new THREE.InstancedMesh(geo, animMat, cap); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.castShadow = !!shadow; m.receiveShadow = true; m.count = 0;
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3); m.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.mesh = m; this.n = 0; scene.add(m);
  }
  Pool.prototype.begin = function () { this.n = 0; };
  Pool.prototype.put = function (x, y, z, ry, s, ph, am, pitch, col) {
    if (this.n >= this.cap) return; const i = this.n++; const e = this.mesh.instanceMatrix.array, o = i * 16;
    const c = Math.cos(ry), sn = Math.sin(ry), cp = Math.cos(pitch || 0), sp = Math.sin(pitch || 0);
    e[o] = c * s; e[o + 1] = 0; e[o + 2] = -sn * s; e[o + 3] = 0; e[o + 4] = sn * sp * s; e[o + 5] = cp * s; e[o + 6] = c * sp * s; e[o + 7] = 0;
    e[o + 8] = sn * cp * s; e[o + 9] = -sp * s; e[o + 10] = c * cp * s; e[o + 11] = 0; e[o + 12] = x; e[o + 13] = y; e[o + 14] = z; e[o + 15] = 1;
    this.anim.array[i * 2] = ph; this.anim.array[i * 2 + 1] = am;
    if (col) { const ca = this.mesh.instanceColor.array; ca[i * 3] = col[0]; ca[i * 3 + 1] = col[1]; ca[i * 3 + 2] = col[2]; }
  };
  Pool.prototype.end = function () { const m = this.mesh; m.count = this.n; m.visible = this.n > 0; if (this.n) { m.instanceMatrix.needsUpdate = true; this.anim.needsUpdate = true; m.instanceColor.needsUpdate = true; } };
  const pools = {};
  function getPool(key, make, cap, shadow) { let p = pools[key]; if (!p) { p = pools[key] = new Pool(make(), Math.round(cap), shadow); } return p; }

  // ---- people ----
  function personMesh(cul, role, v) {
    const kit = HK.lifeKit; const d = new Deco(); const body = kit.personGeo(cul, role === 'herder' || role === 'farmer' ? 'plain' : role, v);
    d.addGeo(body, [0, 0, 0, 0]);
    for (const sx of [-1, 1]) d.add(b => { b.box(sx * .09, 0, 0, .14, .62, .16, 0x2a221c); b.box(sx * .09, 0, .03, .15, .1, .24, 0x1a1410); }, [1, sx, .62, 0]);
    if (role === 'herder') d.add(b => { b.cyl(.33, 0, .12, .025, .03, 1.85, 0x6a4a2a, 4); b.cyl(.33, 1.85, .2, .025, .025, .2, 0x6a4a2a, 4, 0, 1.2); });
    if (role === 'farmer') d.add(b => { b.cyl(0, .55, .38, .022, .026, 1.3, 0x7a5a3a, 4, 0, .9); b.box(0, .2, .86, .22, .05, .16, 0x5a5a5a); });
    return d.geometry(true);
  }
  function personPool(cul, role, v) { return getPool('p' + cul + role + v, () => personMesh(cul, role, v), 90 * Q.life + 10, true); }
  // ---- quadrupeds: regional herds and wildlife ----
  const SPEC = {
    sheep: { L: .9, wd: .55, hb: .5, leg: .38, lw: .08, col: 0xe8dfcc, lc: 0x2a2420, wool: 1, nl: .22, na: .7, nw: .2, head: [.2, .22, .3], hc: 0x3a3028, ears: .1, tail: .12 },
    goat: { L: .82, wd: .36, hb: .42, leg: .46, lw: .07, col: 0x5a4232, lc: 0x3a2a20, nl: .3, na: 1.0, nw: .14, head: [.15, .18, .28], horns: 'back', ears: .1, tail: .1, beard: 1 },
    ibex: { L: .95, wd: .4, hb: .48, leg: .55, lw: .08, col: 0x9a8058, lc: 0x5a4a38, nl: .3, na: 1.0, nw: .16, head: [.16, .2, .3], horns: 'ibex', ears: .1, tail: .1, beard: 1 },
    gazelle: { L: .9, wd: .3, hb: .36, leg: .64, lw: .05, col: 0xc99a62, belly: 0xf2ead8, lc: 0xb08a5a, nl: .4, na: 1.1, nw: .1, head: [.12, .13, .28], horns: 'lyre', ears: .14, tail: .1 },
    onager: { L: 1.35, wd: .45, hb: .52, leg: .74, lw: .09, col: 0xc9a272, belly: 0xf0e4cc, lc: 0x8a7050, nl: .52, na: .85, nw: .2, head: [.18, .24, .5], ears: .26, tail: .4, mane: 0x4a3a2a },
    buffalo: { L: 1.9, wd: .85, hb: .85, leg: .7, lw: .17, col: 0x3c3834, lc: 0x2a2624, nl: .22, na: .25, nw: .42, head: [.36, .4, .55], horns: 'swept', ears: .14, tail: .5 },
    cattle: { L: 1.6, wd: .68, hb: .74, leg: .64, lw: .14, col: 0x9a7048, lc: 0x5a4030, nl: .25, na: .35, nw: .36, head: [.32, .36, .5], horns: 'short', ears: .14, tail: .55, hump: .25 },
    dromedary: { L: 1.9, wd: .68, hb: .78, leg: 1.25, lw: .13, col: 0xc8a06a, lc: 0xb8905a, nl: .95, na: .9, nw: .2, head: [.2, .24, .52], ears: .1, tail: .4, humps: 1 },
  };
  function quadMesh(kind, v) {
    const sp = SPEC[kind], d = new Deco(); const r = W.rng(v * 17 + kind.length);
    const y = sp.leg + sp.hb * .5; const L = sp.L;
    d.add(b => {
      const col = sp.col;
      b.sphere(0, y, 0, L * .5, col, 8, sp.hb / L, sp.wd / L);
      if (sp.belly) b.sphere(0, y - sp.hb * .16, 0, L * .43, sp.belly, 7, sp.hb * .62 / L, sp.wd * .92 / L);
      if (sp.wool) b.sphere(0, y + sp.hb * .06, -.02, L * .56, col, 7, sp.hb * 1.2 / L, sp.wd * 1.2 / L);
      if (sp.humps) b.sphere(0, y + sp.hb * .42, -.05, .42, col, 7, 1.0, .85);
      if (sp.hump) b.sphere(0, y + sp.hb * .38, L * .3, .22, col, 6, .8, 1);
      const nz0 = L * .38, ny0 = y + sp.hb * .12, nz1 = nz0 + Math.cos(sp.na) * sp.nl, ny1 = ny0 + Math.sin(sp.na) * sp.nl;
      b.box(0, ny0, nz0, sp.nw, sp.nl + sp.nw * .5, sp.nw * 1.1, col, 0, Math.PI / 2 - sp.na);
      if (sp.mane) b.box(0, ny0 + .05, nz0 - .05, .06, sp.nl + .1, .14, sp.mane, 0, Math.PI / 2 - sp.na);
      const [hw, hh, hl] = sp.head; const hc = sp.hc || col;
      b.box(0, ny1 - hh * .55, nz1 + hl * .3, hw, hh, hl, hc, 0, .25);
      if (sp.ears) for (const sx of [-1, 1]) b.cone(sx * hw * .45, ny1 + hh * .25, nz1, .035, sp.ears, hc, 4, 0, -.3, sx * .5);
      const hcol = 0x3a3028;
      if (sp.horns === 'back') for (const sx of [-1, 1]) b.cone(sx * .05, ny1 + hh * .3, nz1 + .02, .03, .26, hcol, 4, 0, -.9, sx * .15);
      if (sp.horns === 'ibex') for (const sx of [-1, 1]) { b.cone(sx * .05, ny1 + hh * .3, nz1, .04, .3, 0x6a5a44, 4, 0, -.7, sx * .1); b.cone(sx * .05, ny1 + hh * .3 + .22, nz1 - .2, .03, .3, 0x6a5a44, 4, 0, -1.6, sx * .1); }
      if (sp.horns === 'lyre') for (const sx of [-1, 1]) b.cone(sx * .04, ny1 + hh * .3, nz1 + .03, .018, .3, 0x2a2420, 4, 0, -.5, sx * .25);
      if (sp.horns === 'short') for (const sx of [-1, 1]) b.cone(sx * hw * .5, ny1 + hh * .2, nz1 + .1, .035, .2, 0xd8ccb0, 4, 0, 0, sx * -1.2);
      if (sp.horns === 'swept') for (const sx of [-1, 1]) { b.box(sx * hw * .4, ny1 + hh * .1, nz1 + .08, .5, .08, .1, 0x5a5048, 0, 0, sx * .25); b.cone(sx * (hw * .4 + .42), ny1 + hh * .1 + .08, nz1 + .02, .045, .35, 0x5a5048, 4, 0, -1.1, 0); }
      if (sp.beard) b.cone(0, ny1 - hh * .95, nz1 + hl * .45, .03, .12, 0x2a2420, 4, 0, Math.PI);
      if (sp.tail) b.box(0, y - sp.hb * .1 - sp.tail * .6, -L * .5, .05, sp.tail, .05, sp.mane || col, 0, -.25);
    }, [0, 0, 0, 0]);
    for (const [sx, sz, sg] of [[-1, 1, 1], [1, 1, -1], [-1, -1, -1], [1, -1, 1]]) d.add(b => { const lx = sx * sp.wd * .3, lz = sz * L * .3; b.box(lx, 0, lz, sp.lw, sp.leg + .05, sp.lw * 1.1, sp.lc); b.box(lx, 0, lz, sp.lw * 1.1, .07, sp.lw * 1.25, 0x2a2018); }, [1, sg, sp.leg, 0]);
    return d.geometry(true);
  }
  function mechAnimalMesh(kind, v) { // camel, horse, yak, elephant, donkey, ox from the caravan models
    const kit = HK.lifeKit, a = kit.AN[kind]; const d = new Deco(); d.addGeo(kit.animalBodyGeo(kind, false, v), [0, 0, 0, 0]);
    for (const [sx, sz, sg] of [[-1, 1, 1], [1, 1, -1], [-1, -1, -1], [1, -1, 1]]) d.add(b => { const lx = sx * a.wid * .3, lz = sz * a.len * .3; b.box(lx, 0, lz, a.legW, a.leg, a.legW * 1.1, kind === 'yak' ? 0x1a1612 : a.c); b.box(lx, 0, lz, a.legW * 1.1, .1, a.legW * 1.2, 0x2a2018); }, [1, sg, a.leg, 0]);
    return d.geometry(true);
  }
  const MECH_KINDS = { camel: 1, horse: 1, yak: 1, elephant: 1, donkey: 1, ox: 1 };
  function animalPool(kind, v) { return getPool('a' + kind + v, () => MECH_KINDS[kind] ? mechAnimalMesh(kind, v) : quadMesh(kind, v), (kind === 'sheep' || kind === 'goat' ? 160 : 70) * Q.life + 8, true); }
  const STRIDE = { sheep: .4, goat: .45, ibex: .55, gazelle: .65, onager: .75, buffalo: .7, cattle: .64, dromedary: 1.25, camel: 1.25, horse: 1.0, yak: .72, elephant: 1.35, donkey: .68, ox: .78 };
  const HERD = {
    thrace: [['sheep', .5], ['goat', .2], ['cattle', .3]], anatolia: [['sheep', .55], ['goat', .3], ['cattle', .15]], pontic: [['cattle', .5], ['sheep', .5]], caucasus: [['sheep', .5], ['goat', .2], ['cattle', .3]],
    hyrcanian: [['cattle', .5], ['sheep', .5]], levant: [['goat', .45], ['sheep', .4], ['dromedary', .15]], mesopotamia: [['sheep', .4], ['goat', .2], ['buffalo', .2], ['dromedary', .2]],
    iran: [['sheep', .45], ['goat', .35], ['camel', .2]], sand: [['camel', .7], ['goat', .3]], oasis: [['sheep', .35], ['goat', .2], ['donkey', .2], ['cattle', .25]], steppe: [['horse', .45], ['sheep', .4], ['camel', .15]],
    alpine: [['yak', .45], ['sheep', .35], ['goat', .2]], gobi: [['camel', .4], ['horse', .4], ['sheep', .2]], tibet: [['yak', .7], ['sheep', .3]], loess: [['sheep', .5], ['goat', .3], ['donkey', .2]],
    northchina: [['ox', .4], ['sheep', .3], ['donkey', .3]], southchina: [['buffalo', .8], ['cattle', .2]], flaming: [['camel', .5], ['sheep', .3], ['donkey', .2]],
    nile: [['buffalo', .3], ['cattle', .3], ['donkey', .2], ['dromedary', .2]], nafud: [['dromedary', .7], ['goat', .3]], hejaz: [['dromedary', .6], ['goat', .4]], yemen: [['goat', .6], ['dromedary', .2], ['cattle', .2]],
    indoplain: [['cattle', .45], ['buffalo', .35], ['goat', .14], ['elephant', .06]], thar: [['dromedary', .5], ['goat', .3], ['sheep', .2]], deccan: [['cattle', .45], ['buffalo', .3], ['goat', .2], ['elephant', .05]],
    tropical: [['buffalo', .6], ['elephant', .2], ['cattle', .2]], dryzone: [['cattle', .5], ['buffalo', .3], ['elephant', .2]],
  };
  const WILD = { steppe: [['gazelle', .5], ['onager', .5]], iran: [['gazelle', .5], ['onager', .5]], gobi: [['gazelle', .6], ['onager', .4]], sand: [['gazelle', 1]], nafud: [['gazelle', 1]], hejaz: [['gazelle', 1]],
    thar: [['gazelle', .6], ['onager', .4]], tibet: [['yak', .4], ['gazelle', .6]], tropical: [['elephant', 1]], deccan: [['gazelle', 1]], indoplain: [['gazelle', 1]], mesopotamia: [['gazelle', .6], ['onager', .4]],
    levant: [['gazelle', 1]], yemen: [['ibex', .5], ['gazelle', .5]], loess: [['gazelle', 1]], alpine: [['ibex', 1]], caucasus: [['ibex', 1]], anatolia: [['ibex', .4], ['gazelle', .6]], flaming: [['gazelle', 1]] };
  const NOMAD = { steppe: 1, gobi: 1, tibet: 1, alpine: 1, sand: 1, nafud: 1, hejaz: 1, thar: 1 };
  const SOUTH_PLOW = { southchina: 'buffalo', tropical: 'buffalo', indoplain: 'ox', deccan: 'ox', dryzone: 'buffalo', nile: 'ox', mesopotamia: 'ox', northchina: 'ox', loess: 'ox' };
  function pickW(list, u) { let t = 0; for (const [k, w] of list) t += w; u *= t; for (const [k, w] of list) { if (u < w) return k; u -= w; } return list[0][0]; }
  const TINT = { sheep: [[1, 1, 1], [.92, .9, .86], [1, .98, .94], [.55, .5, .46]], goat: [[1, 1, 1], [.5, .45, .42], [1.6, 1.5, 1.4], [1.2, .9, .7]], cattle: [[1, 1, 1], [.6, .5, .45], [1.3, 1.25, 1.2], [.8, .55, .4]], horse: [[1, 1, 1]], def: [[1, 1, 1], [.92, .9, .88], [1.06, 1.04, 1.02]] };

  // ---- rural agents in cells around the player ----
  const CELL = 110; const cells = new Map(); let agents = [];
  function cultureOf(x, z, o) { if (o && o.vil && o.vd < 600) return o.vil.culture || W.nearestCity(x, z).c.culture; return W.nearestCity(x, z).c.culture; }
  function okGround(x, z, strict) {
    const h = W.height(x, z); const o = W.OUT;
    if (o.sea > 0.15 || o.lake > 0.15 || h < 0.7) return null;
    if (o.city && o.cd < o.city.R + (strict ? 14 : 4)) return null;
    if (o.vil && o.vd < o.vil.r + 2) return null;
    if (o.rd < o.rhw + 2.5) return null;
    return { h, o };
  }
  function spawnCell(cx, cz) {
    const list = []; const x0 = cx * CELL, z0 = cz * CELL; const u = (k) => hash2(cx * 7 + k * 131, cz * 13 + k * 71);
    const x = x0 + u(1) * CELL, z = z0 + u(2) * CELL; const g = okGround(x, z, true); if (!g) return list;
    const { h, o } = g; const ll = W.toLL(x, z); const bi = W.bioIndex(ll[0], ll[1]); const dom = W.BIOME_KEYS[W.bio.dom[bi]];
    if (h > W.bio.snow[bi] - 6) return list;
    const h2 = W.height(x + 3, z); if (Math.abs(h2 - h) > 2.2) return list;
    const L = Q.life; const roll = u(3); const cul = cultureOf(x, z, o);
    const pl = plotInfo(x, z, 0.97, o.pd, o.sea, o.lake, o.city, o.cd, o.vil, o.vd);
    const settle = W.settleAt(x, z); const vd = o.vil ? o.vd : 1e9;
    if (pl.fm > 0.45 && !pl.orch && roll < 0.75 * L) { // farmers working the fields, sometimes behind a plough animal
      const n = 1 + Math.floor(u(4) * 3);
      for (let k = 0; k < n; k++) { const ax = x + (u(10 + k) - .5) * 24, az = z + (u(20 + k) - .5) * 24; const gg = okGround(ax, az); if (!gg) continue; list.push(mkAgent('farmer', personPool(cul, 'farmer', k % 3), ax, az, gg.h, { hr: 6, work: 1 })); }
      const pk = SOUTH_PLOW[dom]; if (pk && u(5) < 0.55) { const ax = x + 4, az = z; const gg = okGround(ax, az); if (gg) { const a = mkAgent(pk, animalPool(pk, 1), ax, az, gg.h, { hr: 10, plough: 1, speed: .55 }); list.push(a); list.push(mkAgent('farmer', personPool(cul, 'herder', 1), ax, az - 2.2, gg.h, { follow: a, dist: 2.4 })); } }
      return list;
    }
    if (o.pd < 9 && o.city && o.cd < 1100 && roll < 0.6 * L) { // porters and travellers on foot along the road
      const q = W.pathQuery(x, z); if (q.i >= 0) { const e = W.edges.find(e => q.i >= e.start && q.i < e.start + e.n); if (e) {
        const n = 1 + Math.floor(u(6) * 3); const dir = u(7) < .5 ? 1 : -1;
        for (let k = 0; k < n; k++) { const role = k === 0 || u(30 + k) < .5 ? 'carrier' : 'plain'; const a = mkAgent('porter', personPool(cul, role, (k + cx) % 3), x, z, h, { road: e, ri: Math.min(e.start + e.n - 2, Math.max(e.start, q.i - k * 2 * dir)), dir, lat: 1.2 + u(40 + k) * .6, speed: 1.15 + u(50 + k) * .25 }); list.push(a); }
        if (u(8) < .45) list.push(mkAgent('donkey', animalPool('donkey', 0), x, z, h, { road: e, ri: Math.min(e.start + e.n - 2, Math.max(e.start, q.i - n * 2 * dir)), dir, lat: 1.4, speed: 1.2 }));
      } }
      return list;
    }
    const wild = WILD[dom]; const herd = HERD[dom] || HERD.anatolia;
    const domestic = (vd < 520 || settle > 0.06 || NOMAD[dom]) && !(o.pd < 6);
    if (domestic && roll < 0.55 * L) {
      const kind = pickW(herd, u(9)); const big = kind === 'elephant' || kind === 'camel' || kind === 'dromedary' || kind === 'horse' || kind === 'buffalo' || kind === 'cattle' || kind === 'ox' || kind === 'yak';
      const n = Math.max(2, Math.round((big ? 3 + u(11) * 5 : 6 + u(11) * 12) * (0.5 + L * 0.5)));
      const tint = TINT[kind] || TINT.def;
      for (let k = 0; k < n; k++) { const ax = x + (u(60 + k) - .5) * 26, az = z + (u(90 + k) - .5) * 26; const gg = okGround(ax, az); if (!gg) continue;
        list.push(mkAgent(kind, animalPool(kind, k % 2), ax, az, gg.h, { home: [x, z], hr: 15, col: tint[Math.floor(u(120 + k) * tint.length)] })); }
      if (kind === 'sheep' && u(12) < .5) for (let k = 0; k < 4; k++) { const ax = x + (u(140 + k) - .5) * 20, az = z + (u(150 + k) - .5) * 20; const gg = okGround(ax, az); if (gg) list.push(mkAgent('goat', animalPool('goat', 0), ax, az, gg.h, { home: [x, z], hr: 15, col: TINT.goat[k % 4] })); }
      list.push(mkAgent('herder', personPool(cul, 'herder', Math.floor(u(13) * 3)), x + 8, z + 6, h, { home: [x, z], hr: 18, slow: 1 }));
      if (NOMAD[dom] && u(14) < .4) list.push(mkAgent('horse', animalPool('horse', 1), x + 10, z + 8, h, { home: [x + 10, z + 8], hr: 4 }));
      return list;
    }
    if (wild && settle < 0.14 && vd > 220 && roll < 0.42 * L) {
      const kind = pickW(wild, u(15)); const n = kind === 'elephant' ? 2 + Math.floor(u(16) * 4) : kind === 'yak' ? 3 + Math.floor(u(16) * 5) : 4 + Math.floor(u(16) * 9);
      for (let k = 0; k < n; k++) { const ax = x + (u(160 + k) - .5) * 30, az = z + (u(190 + k) - .5) * 30; const gg = okGround(ax, az); if (!gg) continue; list.push(mkAgent(kind, animalPool(kind, k % 2), ax, az, gg.h, { home: [x, z], hr: 22, wild: 1 })); }
    }
    return list;
  }
  function mkAgent(kind, pool, x, z, y, o) {
    const a = Object.assign({ kind, pool, x, z, y, hx: x, hz: z, ry: Math.random() * 6.28, ph: Math.random() * 6, am: 0, speed: 0, tgt: null, wait: Math.random() * 6, home: [x, z], hr: 8, pitch: 0, flee: 0, col: null, s: 1 }, o || {});
    a.stride = STRIDE[kind] || .62; a.person = kind === 'farmer' || kind === 'herder' || kind === 'porter';
    if (a.road) { const P = W.P; a.x = P.X[a.ri]; a.z = P.Z[a.ri]; a.f = 0; }
    if (!a.person) a.s = 0.92 + Math.random() * 0.16; return a;
  }
  function stepAgent(a, dt, t) {
    let v = 0; const P = W.P;
    if (a.road) { // walk along the road polyline at the roadside
      const e = a.road; a.f += a.speed * dt / W.STEP * a.dir; while (a.f >= 1) { a.f -= 1; a.ri += 1; } while (a.f < 0) { a.f += 1; a.ri -= 1; }
      if (a.ri <= e.start || a.ri >= e.start + e.n - 2) { a.dir = -a.dir; a.ri = Math.max(e.start + 1, Math.min(e.start + e.n - 3, a.ri)); }
      const i = a.ri, j = i + 1; const tx = P.X[j] - P.X[i], tz = P.Z[j] - P.Z[i]; const tl = Math.hypot(tx, tz) || 1;
      const side = a.dir > 0 ? 1 : -1; const nx = -tz / tl * side, nz = tx / tl * side;
      a.x = P.X[i] + tx * a.f + nx * a.lat * 2.2; a.z = P.Z[i] + tz * a.f + nz * a.lat * 2.2; a.ry = Math.atan2(tx * a.dir, tz * a.dir); v = a.speed;
    } else if (a.follow) { const f = a.follow; const dx = f.x - a.x, dz = f.z - a.z, d = Math.hypot(dx, dz); if (d > a.dist) { const sp = Math.min(f.speed + .2, (d - a.dist) * 2); a.x += dx / d * sp * dt; a.z += dz / d * sp * dt; v = sp; a.ry = Math.atan2(dx, dz); } }
    else {
      if (a.wild) { const dx = a.x - player.x, dz = a.z - player.z, d = Math.hypot(dx, dz); if (d < (a.kind === 'elephant' ? 14 : 26) && !a.flee) { a.flee = 3 + Math.random() * 2; a.tgt = [a.x + dx / d * 40, a.z + dz / d * 40]; } }
      if (a.flee > 0) a.flee = Math.max(0, a.flee - dt);
      if (!a.tgt) { a.wait -= dt; if (a.wait < 0) { const r = a.hr * Math.sqrt(Math.random()), ang = Math.random() * 6.28; a.tgt = [a.home[0] + Math.cos(ang) * r, a.home[1] + Math.sin(ang) * r]; } }
      if (a.tgt) { const dx = a.tgt[0] - a.x, dz = a.tgt[1] - a.z, d = Math.hypot(dx, dz);
        const sp = a.flee > 0 ? (a.kind === 'gazelle' ? 9 : a.kind === 'onager' ? 7.5 : 4) : a.plough ? a.speed : a.person ? (a.slow ? .7 : 1.0) : .55;
        if (d < .4) { a.tgt = null; a.wait = a.plough ? .5 : a.work ? 3 + Math.random() * 6 : 3 + Math.random() * 9; }
        else { a.x += dx / d * sp * dt; a.z += dz / d * sp * dt; v = sp; const want = Math.atan2(dx, dz); let dr = want - a.ry; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); a.ry += dr * Math.min(1, dt * 4); } }
      if (a.plough && !a.tgt && a.wait < 0.2) { a.side = -(a.side || 1); a.tgt = [a.home[0] + a.side * 12, a.home[1] + (Math.random() - .5) * 3]; }
    }
    if (Math.abs(a.x - a.hx) + Math.abs(a.z - a.hz) > 1.2) { a.hx = a.x; a.hz = a.z; a.y = W.height(a.x, a.z); }
    a.ph += v * dt * (a.person ? 4.2 : 2.6 / Math.max(.4, a.stride)); a.am = Math.min(1, v / 1.5) * (a.person ? .55 : .5);
    a.pitch = 0;
    if (v < 0.05) { if (a.work) a.pitch = 0.32 + 0.22 * Math.sin(t * 2.2 + a.home[0]); else if (!a.person && !a.flee) a.pitch = 0.1 + 0.08 * Math.sin(t * 0.7 + a.ph); }
  }
  function updateCells(px, pz) {
    const R = 280 + 170 * Q.life; const pcx = Math.floor(px / CELL), pcz = Math.floor(pz / CELL); const n = Math.ceil(R / CELL); let spawned = 0;
    for (let a = -n; a <= n; a++) for (let b = -n; b <= n; b++) {
      const cx = pcx + a, cz = pcz + b; const k = cx + ',' + cz; const d = Math.hypot((cx + .5) * CELL - px, (cz + .5) * CELL - pz);
      if (d < R && !cells.has(k) && (spawned < 2 || GFX._nolimit)) { cells.set(k, spawnCell(cx, cz)); spawned++; }
    }
    for (const [k, c] of cells) { const [cx, cz] = k.split(',').map(Number); if (Math.hypot((cx + .5) * CELL - px, (cz + .5) * CELL - pz) > R + 140) cells.delete(k); }
    agents = []; for (const c of cells.values()) for (const a of c) agents.push(a);
  }

  // ---- birds ----
  function birdMesh(kind) {
    const d = new Deco(); const big = kind === 'vulture' ? 2.2 : kind === 'stork' ? 1.7 : kind === 'goose' ? 1.2 : 0.42;
    const body = kind === 'stork' || kind === 'goose' ? 0xf2f0ea : kind === 'vulture' ? 0x4a3a2e : 0x3a3430; const tip = kind === 'stork' ? 0x1a1a1a : kind === 'vulture' ? 0x2a2018 : kind === 'goose' ? 0x8a8a8a : 0x2a2622;
    d.add(b => { b.sphere(0, 0, 0, .3 * big, body, 6, .45, .45); b.sphere(0, .04 * big, .32 * big, .11 * big, kind === 'vulture' ? 0xd8b8a0 : body, 5); b.cone(0, .04 * big, .4 * big, .03 * big, (kind === 'stork' ? .3 : .1) * big, kind === 'stork' ? 0xd8402a : 0xd8a030, 4, 0, Math.PI / 2);
      b.box(0, 0, -.38 * big, .16 * big, .02 * big, .2 * big, tip); if (kind === 'stork') for (const sx of [-1, 1]) b.cyl(sx * .04, -.05, -.4 * big, .012, .012, .5 * big, 0xd8402a, 3, 0, -Math.PI / 2); });
    for (const sx of [-1, 1]) d.add(b => { const w = (kind === 'vulture' ? 1.15 : kind === 'stork' ? 1.0 : .8) * big; b.box(sx * w * .5, -.01, .02, w, .025, .28 * big, body); b.box(sx * w * .92, -.01, -.02, w * .2, .028, .24 * big, tip); }, [2, sx, 0, 0]);
    return d.geometry(true);
  }
  function birdPool(kind) { return getPool('b' + kind, () => birdMesh(kind), kind === 'small' ? Q.birds + 10 : 40, false); }
  let flocks = []; let flockT = 0;
  const STORKLAND = (lon, lat) => lon > 24 && lon < 75 && lat > 30 && lat < 46;
  function planFlocks(px, pz) {
    const ll = W.toLL(px, pz); const dom = W.BIOME_KEYS[W.bio.dom[W.bioIndex(ll[0], ll[1])]]; const nc = W.nearestCity(px, pz); const out = []; const r = Math.random;
    const nSmall = Math.round(2 + 3 * Q.life); for (let k = 0; k < nSmall; k++) out.push({ kind: 'small', n: 6 + Math.floor(r() * 16), cx: px + (r() - .5) * 300, cz: pz + (r() - .5) * 300, cy: 14 + r() * 26, R: 18 + r() * 40, w: (r() < .5 ? 1 : -1) * (0.25 + r() * .3), t: r() * 6, drift: [(r() - .5) * 3, (r() - .5) * 3] });
    if (['sand', 'nafud', 'hejaz', 'gobi', 'tibet', 'alpine', 'steppe', 'iran', 'thar', 'yemen', 'flaming', 'deccan', 'caucasus'].includes(dom)) for (let k = 0; k < 1 + Math.floor(r() * 2); k++) out.push({ kind: 'vulture', n: 1 + Math.floor(r() * 4), cx: px + (r() - .5) * 500, cz: pz + (r() - .5) * 500, cy: 70 + r() * 60, R: 40 + r() * 50, w: .12 + r() * .08, t: r() * 6, drift: [0, 0] });
    if (STORKLAND(ll[0], ll[1]) && nc.d < 700) out.push({ kind: 'stork', n: 2 + Math.floor(r() * 4), cx: nc.c.x + (r() - .5) * 60, cz: nc.c.z + (r() - .5) * 60, cy: nc.c.h + 30 + r() * 25, R: 25 + r() * 30, w: .2, t: r() * 6, drift: [0, 0] });
    const rq = W.riverQuery(px, pz); if ((rq.i >= 0 && rq.d < 300) || r() < .25) { const a = r() * 6.28; out.push({ kind: 'goose', n: 7 + Math.floor(r() * 10), vee: 1, x: px - Math.cos(a) * 500, z: pz - Math.sin(a) * 500, y: 55 + r() * 30, vx: Math.cos(a) * 9, vz: Math.sin(a) * 9 }); }
    return out;
  }
  function drawBirds(dt, t) {
    for (const k of ['small', 'vulture', 'stork', 'goose']) if (pools['b' + k]) pools['b' + k].begin();
    if (DN.day > 0.15) for (const f of flocks) {
      const pool = birdPool(f.kind);
      if (f.vee) { f.x += f.vx * dt; f.z += f.vz * dt; const ry = Math.atan2(f.vx, f.vz); const fx = Math.sin(ry), fz = Math.cos(ry);
        for (let i = 0; i < f.n; i++) { const row = Math.ceil(i / 2), side = i % 2 ? 1 : -1; const bx = f.x - fx * row * 2.6 + fz * side * row * 2.2, bz = f.z - fz * row * 2.6 - fx * side * row * 2.2;
          pool.put(bx, f.y + Math.sin(t + i) * .3, bz, ry, 1, t * 7 + i * .6, .55, 0); } continue; }
      f.t += f.w * dt; f.cx += f.drift[0] * dt; f.cz += f.drift[1] * dt;
      const flapSp = f.kind === 'small' ? 15 : f.kind === 'stork' ? 4 : 3;
      for (let i = 0; i < f.n; i++) { const a = f.t + i * (f.kind === 'small' ? .18 : 6.28 / f.n); const rr = f.R * (f.kind === 'small' ? 0.7 + 0.3 * Math.sin(i * 1.7 + f.t * 2) : 1);
        const bx = f.cx + Math.cos(a) * rr, bz = f.cz + Math.sin(a) * rr, by = f.cy + Math.sin(a * 2 + i) * (f.kind === 'small' ? 4 : 2);
        const ry = Math.atan2(-Math.sin(a) * Math.sign(f.w), Math.cos(a) * Math.sign(f.w)); const glide = f.kind === 'vulture' ? (Math.sin(t * .3 + i) > .6 ? .35 : .05) : f.kind === 'stork' ? (Math.sin(t * .5 + i) > .3 ? .5 : .08) : .9;
        pool.put(bx, by, bz, ry, 1, t * flapSp + i, glide, 0); }
    }
    for (const k of ['small', 'vulture', 'stork', 'goose']) if (pools['b' + k]) pools['b' + k].end();
  }

  // ---- smoke ----
  const SMK = 2400; const smkGeo = new THREE.BufferGeometry(); const smkP = new Float32Array(SMK * 3).fill(-9999), smkB = new Float32Array(SMK).fill(-999), smkS = new Float32Array(SMK);
  for (let i = 0; i < SMK; i++) smkS[i] = Math.random();
  smkGeo.setAttribute('position', new THREE.BufferAttribute(smkP, 3)); smkGeo.setAttribute('aB', new THREE.BufferAttribute(smkB, 1)); smkGeo.setAttribute('aS', new THREE.BufferAttribute(smkS, 1));
  const smkMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false,
    uniforms: { uTime: { value: 0 }, uWind: { value: new THREE.Vector3(.5, 0, .3) }, uScale: { value: 600 }, uCol: { value: new THREE.Color(.8, .8, .8) }, uFog: { value: new THREE.Color() }, uFar: { value: 900 } },
    vertexShader: `attribute float aB; attribute float aS; uniform float uTime; uniform vec3 uWind; uniform float uScale; uniform float uFar; varying float vA; varying float vF; varying float vS;
      void main(){ float age = uTime - aB; float life = 7.0 + aS * 4.0; float t = age / life; vS = aS;
        if (t < 0.0 || t > 1.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vA = 0.0; return; }
        vec3 p = position + vec3(0.0, age * (1.0 + aS * 0.5), 0.0) + uWind * age * (0.25 + t) + vec3(sin(age * 0.8 + aS * 20.0), 0.0, cos(age * 0.6 + aS * 13.0)) * 0.5 * t;
        vec4 mv = viewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; float d = -mv.z;
        gl_PointSize = min((0.7 + t * 4.2) * uScale / max(d, 1.0), 220.0); vA = 0.3 * smoothstep(0.0, 0.08, t) * (1.0 - t); vF = smoothstep(90.0, uFar, d); }`,
    fragmentShader: GLSL_NOISE + `uniform vec3 uCol; uniform vec3 uFog; varying float vA; varying float vF; varying float vS;
      void main(){ vec2 pc = gl_PointCoord - 0.5; float r = length(pc); float n = vn(gl_PointCoord * 4.0 + vS * 10.0); float m = (1.0 - smoothstep(0.15, 0.5, r + (n - 0.5) * 0.18)) * vA;
        if (m < 0.004) discard; gl_FragColor = vec4(mix(uCol * (0.85 + 0.3 * n), uFog, vF), m); }` });
  const smoke = new THREE.Points(smkGeo, smkMat); smoke.frustumCulled = false; smoke.renderOrder = 4; scene.add(smoke); let smkI = 0;
  function emitSmoke(x, y, z, t) { const i = smkI; smkI = (smkI + 1) % SMK; smkP[i * 3] = x + (Math.random() - .5) * .3; smkP[i * 3 + 1] = y; smkP[i * 3 + 2] = z + (Math.random() - .5) * .3; smkB[i] = t; smkGeo.attributes.position.needsUpdate = true; smkGeo.attributes.aB.needsUpdate = true; }

  // ---- night lights: glow sprites + a few real point lights ----
  const glowMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uNight: RIM_U.uNight, uTime: waterUniforms.time, uScale: { value: 600 } },
    vertexShader: `attribute vec3 aCol; attribute float aSize; uniform float uTime; uniform float uScale; uniform float uNight; varying vec3 vC; varying float vA;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; float d = -mv.z;
        float fl = 0.82 + 0.18 * sin(uTime * (7.0 + aSize) + position.x * 3.0) * sin(uTime * 3.1 + position.z * 2.0);
        gl_PointSize = min(aSize * uScale / max(d, 1.0), 160.0) * (0.9 + 0.1 * fl); vC = aCol * fl; vA = uNight * (1.0 - smoothstep(300.0, 900.0, d)); }`,
    fragmentShader: `varying vec3 vC; varying float vA; void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; float core = exp(-r * r * 9.0); float halo = exp(-r * 3.2) * 0.45; float m = (core + halo) * (1.0 - smoothstep(0.85, 1.0, r)); if (m * vA < 0.003) discard; gl_FragColor = vec4(vC * m * vA, 1.0); }` });
  const plights = []; function setupPointLights() { while (plights.length < Q.plights) { const l = new THREE.PointLight(0xffa850, 0, 22, 1.6); scene.add(l); plights.push(l); } }
  setupPointLights();

  // ---- per-site decor: flags, lanterns, market stalls with awnings, stork nests, water wheels, windmills ----
  const RED_LANTERN = { chinese: 1, song: 1, sea: 1, tibet: 1, mongol: 1 };
  function siteDecor(s) {
    const g = s.group; if (!g) return; const fx = s.fx = { smoke: [], lights: [], spin: [], crowd: null };
    const ox = g.position.x, oy = g.position.y, oz = g.position.z; const d = new Deco(); const r = W.rng((s.city ? s.city.id.length * 977 : 0) + Math.floor(s.x * 3 + s.z * 7));
    const light = (x, y, z, col, size) => fx.lights.push([x, y, z, col[0], col[1], col[2], size]);
    const FIRE = [1.9, .9, .3], LAMP = [1.7, 1.0, .45], REDL = [2.0, .55, .3];
    if (s.city) {
      const c = s.city; const cul = c.culture; const pc = new THREE.Color(polityColor(c)); const flagC = [pc.r, pc.g, pc.b]; const redL = RED_LANTERN[cul];
      // flags on poles either side of every gate, and around the centre
      const flag = (x, z, hgt, ang, big) => { const w = big ? 3.2 : 2.3, hh = big ? 1.8 : 1.3; const ca = Math.cos(ang), sa = Math.sin(ang); const y0 = W.height(ox + x, oz + z) - oy;
        d.add(b => { b.cyl(x, y0, z, .06, .08, hgt, 0x5a3e28, 6); b.sphere(x, y0 + hgt + .1, z, .12, 0xe0b13a, 5); });
        const seg = 8; for (let i = 0; i < seg; i++) { const u0 = i / seg, u1 = (i + 1) / seg; const cb = new THREE.Color(); cb.setRGB(flagC[0], flagC[1], flagC[2]);
          const pts = [[u0, 0], [u1, 0], [u1, 1], [u0, 1]].map(([u, v]) => [x + ca * u * w, y0 + hgt - .1 - v * hh, z + sa * u * w]);
          const col = i === 0 ? 0xf0e6c8 : cb.getHex(); const p0 = pts[0], p1 = pts[1], p2 = pts[2], p3 = pts[3];
          d.add(b => { b.tri(p0, p1, p2, col, col, col); b.tri(p0, p2, p3, col, col, col); }, [3, (u0 + u1) / 2, -sa, ca], [x * .3 + z * .2, 1]); } };
      for (const gt of c.gates) { const lx = gt.gx - ox, lz = gt.gz - oz; const dl = Math.hypot(lx, lz) || 1; const nx = -lz / dl, nz = lx / dl; const inx = -lx / dl, inz = -lz / dl;
        for (const sd of [-1, 1]) { const fxp = lx + nx * sd * 5.2 + inx * 3, fzp = lz + nz * sd * 5.2 + inz * 3; flag(fxp, fzp, 8.5, Math.atan2(.3, 1) + r() * .6, false);
          light(fxp + inx, W.height(ox + fxp, oz + fzp) - oy + 2.6, fzp + inz, FIRE, 1.6); fx.smoke.push([ox + fxp + inx, W.height(ox + fxp, oz + fzp) + 3.1, oz + fzp + inz, .25]); } }
      for (let k = 0; k < 2 + c.tier; k++) { const a = k / (2 + c.tier) * 6.28 + r(), rr = 8 + r() * 6; flag(Math.cos(a) * rr, Math.sin(a) * rr, 7 + r() * 2, r() * 6.28, true); }
      // lanterns along the main streets, market stalls along the bazaar spines
      const occ = c.occ; let stalls = 0; const stallMax = Math.round((10 + c.tier * 12) * (0.5 + 0.5 * Q.life));
      const awn = [0xc8402a, 0xe8c050, 0x2f6f8f, 0xf0e6c8, 0x5a8a4a, 0xb05a8a];
      for (const st of (c.streetsCache || [])) { if (st.kind === 'lane' || st.kind === 'alley') continue; const P = st.pts; let acc = 0, side = 1;
        for (let i = 1; i < P.length; i++) { const dx = P[i][0] - P[i - 1][0], dz = P[i][1] - P[i - 1][1], L = Math.hypot(dx, dz); if (L < 0.01) continue; acc += L;
          const nx = -dz / L, nz = dx / L; const hw = st.hw || 3;
          if (acc > 13) { acc = 0; side = -side; const lx = P[i][0] + nx * side * (hw + .25), lz = P[i][1] + nz * side * (hw + .25);
            if (occ && occ.get(lx + nx * side * .8, lz + nz * side * .8) === 2 || r() < .5) { const ex = -nx * side * .55, ez = -nz * side * .55; const lc = redL ? 0xd83a2a : 0xd8a040; const ly = 2.55;
              d.add(b => { b.box(lx - ex * .9, 0, lz - ez * .9, .1, 2.9, .1, 0x4a3424); b.box(lx, 2.85, lz, Math.abs(ex) * 2 + .08, .07, Math.abs(ez) * 2 + .08, 0x4a3424); });
              const hx = lx + ex, hz = lz + ez;
              d.add(b => { if (redL) { b.sphere(hx, ly, hz, .26, lc, 7, 1.15); b.cyl(hx, ly + .24, hz, .1, .1, .06, 0x2a2018, 6); b.cyl(hx, ly - .34, hz, .1, .1, .06, 0x2a2018, 6); } else { b.box(hx, ly - .25, hz, .3, .42, .3, lc); b.cone(hx, ly + .17, hz, .22, .18, 0x5a4a30, 4); } }, [6, hx, 2.85, hz], [hx + hz, 1]);
              light(hx, ly - .05, hz, redL ? REDL : LAMP, 1.3); } }
          const dc = Math.hypot(P[i][0], P[i][1]);
          if ((st.kind === 'main' || st.kind === 'bazaar' || st.kind === 'avenue') && dc < c.R * .62 && dc > 9 && stalls < stallMax && r() < .45) {
            const sd = r() < .5 ? 1 : -1; const sx = P[i][0] + nx * sd * (hw - .9), sz = P[i][1] + nz * sd * (hw - .9); const ang = Math.atan2(dx, dz); const ca = Math.cos(ang), sa = Math.sin(ang);
            const loc = (u, v) => [sx + sa * u + nx * sd * v, sz + ca * u + nz * sd * v];
            const ac = awn[Math.floor(r() * awn.length)], ac2 = r() < .5 ? 0xf0e6c8 : ac;
            d.add(b => { for (const [u, v] of [[-1.1, -.7], [1.1, -.7], [-1.1, .7], [1.1, .7]]) { const [px2, pz2] = loc(u, v); b.box(px2, 0, pz2, .08, v < 0 ? 2.1 : 2.4, .08, 0x5a4030); }
              const [cx2, cz2] = loc(0, -.2); b.box(cx2, 0, cz2, 2.1, .8, .9, 0x7a5a3a, ang - Math.PI / 2);
              for (let q = 0; q < 4; q++) { const [gx2, gz2] = loc(-.75 + q * .5, -.25); b.box(gx2, .8, gz2, .38, .22 + r() * .2, .5, [0xd8a040, 0xc85a2a, 0x8a6a3a, 0x6a8a3a, 0xe8dcc0, 0x9a3a6a][Math.floor(r() * 6)], ang - Math.PI / 2); } });
            for (let q = 0; q < 4; q++) { const v0 = -.9 + q * .5, v1 = v0 + .5; const col = q % 2 ? ac : ac2; const a0 = loc(-1.2, v0), a1 = loc(1.2, v0), a2 = loc(1.2, v1), a3 = loc(-1.2, v1);
              const y0 = 2.45 - (v0 + .9) * .18, y1 = 2.45 - (v1 + .9) * .18; const p0 = [a0[0], y0, a0[1]], p1 = [a1[0], y0, a1[1]], p2 = [a2[0], y1, a2[1]], p3 = [a3[0], y1, a3[1]];
              d.add(b => { b.tri(p0, p1, p2, col, col, col); b.tri(p0, p2, p3, col, col, col); }, [4, (v1 + .9) / 1.8, 0, 0], [sx + sz, 1]); }
            fx.stalls = fx.stalls || []; fx.stalls.push([ox + sx - nx * sd * 1.8, oz + sz - nz * sd * 1.8, Math.atan2(nx * sd, nz * sd)]); stalls++;
          } } }
      // hearth smoke, door lamps
      for (const hh of (c.houses || [])) { const u = r(); const [hx, hz, w, dd, ry, type] = hh; const fw = Math.sin(ry), fwz = Math.cos(ry);
        if (type === 'yurt' ? u < .6 : u < .1) fx.smoke.push([ox + hx + (r() - .5) * w * .4, oy + (type === 'yurt' ? 3.0 : 4.6 + r()), oz + hz + (r() - .5) * dd * .4, type === 'yurt' ? .6 : .4]);
        if (r() < .16) light(hx + fw * (dd / 2 + .12), 1.5, hz + fwz * (dd / 2 + .12), LAMP, .9); }
      // bonfires in open squares
      for (let k = 0, tries = 0; k < 1 + c.tier && tries < 80; tries++) { const a = r() * 6.28, rr = r() * c.R * .6; const bx = Math.cos(a) * rr, bz = Math.sin(a) * rr; if (!occ || occ.get(bx, bz) !== 0) continue;
        d.add(b => { for (let q = 0; q < 5; q++) b.box(bx, 0, bz, .12, .1, 1.1, 0x4a3020, q * 1.2); b.cone(bx, .05, bz, .35, .8, 0xe8802a, 5); }, [5, 0, 0, 0]); light(bx, .9, bz, FIRE, 2.6); fx.smoke.push([ox + bx, oy + 1.4, oz + bz, 1]); k++; }
      // storks nesting on the tallest towers and minarets
      if (STORKLAND(...W.toLL(c.x, c.z))) { const tops = findPeaks(g, 13); for (const [tx, ty, tz] of tops.slice(0, 2 + Math.floor(r() * 3))) d.add(b => { b.cyl(tx, ty - .05, tz, .55, .45, .3, 0x6a5030, 8); b.sphere(tx, ty + .55, tz, .22, 0xf2f0ea, 6, .8, .7); b.sphere(tx, ty + .85, tz + .18, .09, 0xf2f0ea, 5); b.cone(tx, ty + .85, tz + .25, .03, .25, 0xd8402a, 4, 0, Math.PI / 2); b.box(tx, ty + .5, tz - .2, .3, .05, .25, 0x1a1a1a); for (const sx of [-1, 1]) b.cyl(tx + sx * .06, ty + .18, tz, .015, .015, .3, 0xd8402a, 3); }); }
    } else if (s.v) {
      const v = s.v; for (const hh of (v.houses || [])) { const [hx, hz, w, dd, ry, type] = hh; const u = r();
        if (type === 'yurt' ? u < .75 : u < .35) fx.smoke.push([ox + hx + (type === 'yurt' ? 0 : (r() - .5) * w * .5), oy + (type === 'yurt' ? 2.9 : 3.6 + r() * .6), oz + hz + (type === 'yurt' ? 0 : (r() - .5) * dd * .5), type === 'yurt' ? .7 : .5]);
        if (r() < .4) light(hx + Math.sin(ry) * (dd / 2 + .1), type === 'yurt' ? .9 : 1.4, hz + Math.cos(ry) * (dd / 2 + .1), LAMP, .8); }
      if (v.type === 'nomad') { d.add(b => { b.cone(0, .05, 2, .35, .7, 0xe8802a, 5); for (let q = 0; q < 6; q++) b.box(Math.cos(q) * .5, 0, 2 + Math.sin(q) * .5, .3, .25, .3, 0x6a6058); }, [5, 0, 0, 0]); light(0, .8, 2, FIRE, 2.4); fx.smoke.push([ox, oy + 1.2, oz + 2, 1]); }
    }
    // water wheels where a settlement meets a river
    { const rq = W.riverQuery(s.x, s.z); const RR = s.city ? s.city.R + 45 : (s.v ? s.v.r + 35 : 0); const R = W.R;
      if (rq.i >= 0 && RR && rq.d < RR && rq.d > rq.hw + 2 && (s.city || r() < .55)) { const nW = s.city ? 1 + (s.city.tier > 1 ? 1 : 0) : 1;
        for (let k = 0; k < nW; k++) { const i = Math.max(W.rivers.find(rv => rq.i >= rv.start && rq.i < rv.start + rv.n).start + 1, rq.i + (k ? 7 : -3)); if (!R.X[i + 1]) continue;
          const tx = R.X[i + 1] - R.X[i - 1], tz = R.Z[i + 1] - R.Z[i - 1], tl = Math.hypot(tx, tz) || 1; let nx = -tz / tl, nz = tx / tl; if ((s.x - R.X[i]) * nx + (s.z - R.Z[i]) * nz < 0) { nx = -nx; nz = -nz; }
          const hw = R.W[i]; const rad = 3.6 + r() * 1.8; const cx = R.X[i] + nx * (hw - .6), cz = R.Z[i] + nz * (hw - .6), cy = R.H[i] + rad * .7;
          const wheel = makeWheel(rad); const par = new THREE.Group(); par.position.set(cx - ox, cy - oy, cz - oz); par.rotation.y = Math.atan2(-nz, nx); par.add(wheel.spin); par.add(wheel.frame); g.add(par);
          fx.spin.push({ o: wheel.spin, axis: 'x', sp: .35 * (r() < .5 ? 1 : -1) * 4.5 / rad }); } } }
    // vertical-axis windmills of Sistan and Khorasan
    { const ll = W.toLL(s.x, s.z); if (ll[0] > 58.5 && ll[0] < 64.8 && ll[1] > 29 && ll[1] < 35.6 && (s.city || r() < .65)) {
      const n = s.city ? 4 + Math.floor(r() * 4) : 2 + Math.floor(r() * 3); const RR = s.city ? s.city.R + 10 : s.v.r + 7; const base = r() * 6.28;
      for (let k = 0; k < n; k++) { const a = base + (k - n / 2) * 0.16 * (s.city ? 0.6 : 1.2); const mx = Math.cos(a) * RR, mz = Math.sin(a) * RR; const my = W.height(ox + mx, oz + mz) - oy;
        const m = makeWindmill(); m.frame.position.set(mx, my, mz); m.frame.rotation.y = 0.35; m.spin.position.set(mx, my, mz); g.add(m.frame); g.add(m.spin); fx.spin.push({ o: m.spin, axis: 'y', sp: 1.1 + r() * .4 }); } } }
    if (d.n) { const m = new THREE.Mesh(d.geometry(false), animMat); m.castShadow = true; m.receiveShadow = true; g.add(m); fx.deco = m; }
    if (fx.lights.length) { const n = fx.lights.length; const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), sz = new Float32Array(n);
      fx.lights.forEach((l, i) => { pos[i * 3] = l[0]; pos[i * 3 + 1] = l[1]; pos[i * 3 + 2] = l[2]; col[i * 3] = l[3]; col[i * 3 + 1] = l[4]; col[i * 3 + 2] = l[5]; sz[i] = l[6]; });
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); lg.setAttribute('aCol', new THREE.BufferAttribute(col, 3)); lg.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
      const pts = new THREE.Points(lg, glowMat); pts.frustumCulled = false; pts.renderOrder = 6; g.add(pts); fx.lightsW = fx.lights.map(l => [l[0] + ox, l[1] + oy, l[2] + oz]); }
  }
  function findPeaks(g, minY) { // tall local maxima in a city's meshes = minaret and tower tops
    const cellsP = new Map();
    g.traverse(o => { if (!o.isMesh || !o.geometry || o.material === animMat) return; const P = o.geometry.attributes.position; if (!P) return; const A = P.array; const pp = o.position;
      for (let i = 0; i < A.length; i += 3) { const y = A[i + 1] + pp.y; if (y < minY) continue; const k = Math.floor((A[i] + pp.x) / 5) + ',' + Math.floor((A[i + 2] + pp.z) / 5); const c = cellsP.get(k); if (!c || c[1] < y) cellsP.set(k, [A[i] + pp.x, y, A[i + 2] + pp.z]); } });
    const out = []; for (const [k, c] of cellsP) { const [a, b] = k.split(',').map(Number); let top = true; for (let i = -1; i <= 1 && top; i++) for (let j = -1; j <= 1; j++) { if (!i && !j) continue; const n = cellsP.get((a + i) + ',' + (b + j)); if (n && n[1] > c[1] - 1.5) { top = false; break; } } if (top) out.push(c); }
    return out.sort((p, q) => q[1] - p[1]);
  }
  const wheelGeo = {}; function makeWheel(rad) {
    const k = Math.round(rad * 2); if (!wheelGeo[k]) { const R0 = k / 2; const b = new B.Builder(); b.ao = false; const n = 18;
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; const y = Math.cos(a) * R0, z = Math.sin(a) * R0;
        for (const sx of [-.45, .45]) b.box(sx, y - .12, z, .12, .24, 2 * Math.PI * R0 / n * 1.08, 0x6a4a30, 0, a);
        b.box(0, y * 1.04 - .25, z * 1.04, 1.0, .5, .35, 0x7a5a3a, 0, a); if (i % 2 === 0) for (const sx of [-.45, .45]) b.box(sx, 0, 0, .1, R0, .1, 0x5a3e28, 0, a); }
      b.cyl(0, 0, 0, .3, .3, 1.3, 0x4a3424, 8, 0, 0, Math.PI / 2); const g1 = b.geometry(); g1.translate(-0, 0, 0); g1.userData.shared = true;
      const f = new B.Builder(); f.ao = false; for (const sx of [-1, 1]) f.box(sx * .85, -R0 * .75 - 1, 0, .7, R0 * .75 + 1.3, .7, 0x9a8468); f.box(.6 + 3, R0 + .1, 0, 7, .5, .9, 0x9a8468); for (const xx of [3, 6]) f.box(xx, -R0 * .75 - 1, 0, .6, R0 * 1.75 + 1.1, .6, 0x9a8468);
      const g2 = f.geometry(); g2.userData.shared = true; wheelGeo[k] = [g1, g2]; }
    const spin = new THREE.Mesh(wheelGeo[k][0], objMat); spin.castShadow = true; const frame = new THREE.Mesh(wheelGeo[k][1], objMat); frame.castShadow = true; frame.receiveShadow = true; return { spin, frame };
  }
  let millGeo = null; function makeWindmill() {
    if (!millGeo) { const f = new B.Builder(); f.ao = false; for (const sx of [-1, 1]) f.box(sx * 2.4, 0, 0, .9, 7.5, 4.4, 0xc8a878); f.box(0, 7.5, 0, 5.8, .6, 4.4, 0xb89868); f.box(0, 0, -1.9, 3.9, 7.5, .7, 0xc8a878); f.box(-1.2, 0, 1.9, 1.6, 7.5, .6, 0xc8a878); f.box(0, 0, 0, 5.4, 1.4, 4.4, 0xb89868);
      const s2 = new B.Builder(); s2.ao = false; s2.cyl(0, 1.4, 0, .14, .14, 6.4, 0x5a3e28, 6); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; s2.box(Math.cos(a) * 1.0, 1.7, Math.sin(a) * 1.0, .12, 5.6, 1.7, 0xd8c08a, -a + Math.PI / 2); }
      millGeo = [f.geometry(), s2.geometry()]; millGeo[0].userData.shared = millGeo[1].userData.shared = true; }
    const frame = new THREE.Mesh(millGeo[0], objMat); frame.castShadow = true; frame.receiveShadow = true; const spin = new THREE.Mesh(millGeo[1], objMat); spin.castShadow = true; return { frame, spin };
  }

  // ---- market crowds in the city you are in ----
  let crowd = null;
  function buildCrowd(s) {
    const c = s.city; const cul = c.culture; const list = []; const r = W.rng(c.id.length * 31 + 5); const streets = (c.streetsCache || []).filter(st => st.pts.length > 2);
    if (!streets.length) return { s, list };
    const n = Math.round((15 + c.tier * 17) * (0.4 + 0.6 * Q.life)); // v15: halved
    for (let k = 0; k < n; k++) { const st = streets[Math.floor(r() * streets.length)]; const role = r() < .18 ? 'carrier' : 'plain';
      list.push({ pool: personPool(cul, role, k % 3), st, i: Math.floor(r() * (st.pts.length - 1)), f: r(), dir: r() < .5 ? 1 : -1, lat: (r() - .5) * 1.6 * (st.hw || 2), sp: .9 + r() * .5, ph: r() * 6, wait: 0 }); }
    for (const sl of (s.fx && s.fx.stalls) || []) { for (let q = 0; q < 1 + Math.floor(r() * 3); q++) list.push({ pool: personPool(cul, 'plain', q % 3), stand: [sl[0] + (r() - .5) * 2, sl[1] + (r() - .5) * 2, sl[2] + (r() - .5) * .6], ph: r() * 6 }); }
    return { s, list };
  }
  function stepCrowd(dt, t) {
    if (!crowd) return; const c = crowd.s.city; const ox = c.x, oz = c.z, oy = c.h + 0.03;
    for (const p of crowd.list) {
      if (p.stand) { p.pool.put(p.stand[0], oy, p.stand[1], p.stand[2], 1, 0, 0, 0.04 * Math.sin(t + p.ph)); continue; }
      const P = p.st.pts; if (p.wait > 0) { p.wait -= dt; } else { p.f += p.sp * dt / Math.max(.5, Math.hypot(P[p.i + 1][0] - P[p.i][0], P[p.i + 1][1] - P[p.i][1])) * p.dir; }
      while (p.f > 1) { p.f -= 1; p.i++; if (p.i >= P.length - 1) { p.i = P.length - 2; p.f = 1; p.dir = -1; } }
      while (p.f < 0) { p.f += 1; p.i--; if (p.i < 0) { p.i = 0; p.f = 0; p.dir = 1; } }
      if (p.wait <= 0 && Math.random() < dt * 0.04) p.wait = 2 + Math.random() * 5;
      const a = P[p.i], b2 = P[p.i + 1]; const dx = b2[0] - a[0], dz = b2[1] - a[1], L = Math.hypot(dx, dz) || 1;
      const x = a[0] + dx * p.f - dz / L * p.lat, z = a[1] + dz * p.f + dx / L * p.lat; const moving = p.wait <= 0; if (moving) p.ph += p.sp * dt * 4.2;
      p.pool.put(ox + x, oy, oz + z, Math.atan2(dx * p.dir, dz * p.dir), 1, p.ph, moving ? .5 : 0, 0);
    }
  }

  // ---- boats and ferries on the great rivers ----
  const BOAT_RIV = { 'Nile': 'felucca', 'Euphrates': 'felucca', 'Tigris': 'felucca', 'Yangtze': 'junk', 'Pearl (Xi)': 'junk', 'Qiantang': 'junk', 'Han': 'junk', 'Red River (Hong)': 'junk', 'Yellow River': 'junk', 'Ganges': 'ganga', 'Yamuna': 'ganga', 'Brahmaputra': 'ganga', 'Indus': 'ganga', 'Irrawaddy': 'ganga', 'Mekong': 'ganga', 'Chao Phraya': 'ganga' };
  function boatMesh(type) {
    const d = new Deco();
    if (type === 'felucca') { d.add(b => { b.sphere(0, .1, 0, 3.2, 0xe8dcc0, 9, .14, .3); b.box(0, .2, 0, 1.6, .12, 5.2, 0x8a6a48); b.box(0, .3, 2.6, .1, .5, .5, 0x8a6a48, 0, .5); b.cyl(0, .2, .9, .07, .09, 6.2, 0x5a3e28, 5); for (const z of [-1.6, -.4]) b.box(0, .3, z, 1.5, .18, .5, 0x6a4a2a); });
      d.add(b => { const p0 = [0, 6.6, 2.8], p1 = [0, .9, -2.2], p2 = [0, .9, .9]; b.tri(p0, p1, p2, 0xf4eee0, 0xf4eee0, 0xf4eee0); b.cyl(0, .9, -2.2, .05, .05, 7.6, 0x5a3e28, 4, 0, .72); }, [3, .6, 1, 0], [0, .25]); }
    else if (type === 'junk') { d.add(b => { b.sphere(0, .12, 0, 3.6, 0x7a5232, 9, .14, .3); b.box(0, .2, 0, 1.9, .14, 6, 0x6a4a2a); b.box(0, .3, -2.8, 2, .9, 1, 0x7a5232); b.box(0, .34, -.8, 1.5, 1.1, 2, 0x8a6a48); b.arch(0, 1.4, -.8, .8, 2.1, 0x4a3a2a); b.cyl(0, .2, 1.1, .07, .09, 6.5, 0x4a3424, 5); b.box(0, 1.2, 2.9, .06, .9, .06, 0xc83a2a); });
      for (let i = 0; i < 6; i++) d.add(b => { const y0 = 1.6 + i * .8; b.box(0, y0, 1.15, .04, .78, 2.6 - i * .15, 0xa84a2a); b.box(0, y0 + .74, 1.15, .07, .06, 2.7 - i * .15, 0x3a2a1a); }, [4, .2 + i * .1, 0, 0], [0, 1]); }
    else if (type === 'ganga') { d.add(b => { b.sphere(0, .1, 0, 3.0, 0x6a4a30, 9, .15, .3); b.box(0, .2, 0, 1.5, .12, 4.6, 0x5a3e28); b.arch(0, .35, -.5, .75, 1.8, 0xc8a868); b.box(0, .3, -1.4, .3, .3, .3, 0xd8a040); b.cyl(0, .2, 1.0, .06, .08, 4.6, 0x4a3424, 5); });
      d.add(b => { const c1 = 0xe8d8b0; const p0 = [-1.3, 4.6, 1.05], p1 = [1.3, 4.6, 1.05], p2 = [1.4, 1.5, 1.05], p3 = [-1.4, 1.5, 1.05]; b.tri(p0, p1, p2, c1, c1, c1); b.tri(p0, p2, p3, c1, c1, c1); }, [3, .5, 0, 1], [0, .35]); }
    else if (type === 'ferry') { d.add(b => { b.box(0, 0, 0, 3.2, .35, 6, 0x7a5a3a); for (const sx of [-1.5, 1.5]) b.box(sx, .35, 0, .1, .5, 6, 0x5a3e28); b.cyl(1.2, .35, 2.4, .05, .05, 2.2, 0x4a3424, 4, 0, -.7); for (let k = 0; k < 3; k++) b.box(-.6 + k * .6, .35, -1 + k * .8, .5, .5, .5, [0xb0402c, 0x2f6f8f, 0xd09a2a][k]); }); }
    return d.geometry(true);
  }
  function boatPool(type) { return getPool('boat' + type, () => boatMesh(type), 30, true); }
  let boats = [], boatT = 0;
  function planBoats(px, pz) {
    const R = W.R; const keep = []; for (const b of boats) if (Math.hypot(b.x - px, b.z - pz) < 620) keep.push(b); boats = keep;
    if (boats.length > 30 * Q.life) return;
    for (const rv of W.rivers) { const type = BOAT_RIV[rv.name]; if (!type) continue;
      const near = []; for (let j = 0; j < rv.n - 2; j += 6) { const i = rv.start + j; if (Math.abs(R.X[i] - px) < 480 && Math.abs(R.Z[i] - pz) < 480 && Math.hypot(R.X[i] - px, R.Z[i] - pz) < 480) near.push(i); }
      if (!near.length) continue; const want = Math.round(near.length * 15 / 150 * (0.5 + Q.life * 0.7)); let have = boats.filter(b => b.rv === rv && !b.ferry).length;
      for (let k = 0; k < 8 && have < want; k++) { const i = near[Math.floor(Math.random() * near.length)]; if (boats.some(b => Math.hypot(b.x - R.X[i], b.z - R.Z[i]) < 40)) continue; if (W.bridges.some(br => Math.hypot(br.x - R.X[i], br.z - R.Z[i]) < 30)) continue;
        const down = Math.random() < .6; boats.push({ rv, type, fi: i, dir: down ? 1 : -1, sp: down ? 2.2 + Math.random() : 1.3 + Math.random() * .6, lat: (Math.random() - .5) * 0.9, x: R.X[i], z: R.Z[i], ph: Math.random() * 6 }); have++; }
      // a ferry plying across near each riverside city
      for (const c of W.cities) { if (Math.hypot(c.x - px, c.z - pz) > 600) continue; const rq = W.riverQuery(c.x, c.z); if (rq.i < rv.start || rq.i >= rv.start + rv.n || rq.d > c.R + 70) continue;
        if (boats.some(b => b.ferry && b.city === c)) continue; let i = rq.i; if (W.bridges.some(br => Math.hypot(br.x - R.X[i], br.z - R.Z[i]) < 40)) i = Math.min(rv.start + rv.n - 3, i + 16);
        boats.push({ rv, type: 'ferry', ferry: 1, city: c, fi: i, x: R.X[i], z: R.Z[i], ph: Math.random() * 6, sp: 0, dir: 1, lat: 0 }); } }
  }
  function stepBoats(dt, t) {
    const R = W.R; for (const k of ['felucca', 'junk', 'ganga', 'ferry']) if (pools['boat' + k]) pools['boat' + k].begin();
    for (const b of boats) {
      const rv = b.rv; if (!b.ferry) { b.fi += b.sp * dt / 2.5 * b.dir; if (b.fi < rv.start + 2 || b.fi > rv.start + rv.n - 3) { b.dir = -b.dir; b.fi = Math.max(rv.start + 2, Math.min(rv.start + rv.n - 3, b.fi)); } }
      const i = Math.floor(b.fi), f = b.fi - i; const tx = R.X[i + 1] - R.X[i], tz = R.Z[i + 1] - R.Z[i], tl = Math.hypot(tx, tz) || 1; const nx = -tz / tl, nz = tx / tl; const hw = R.W[i];
      let lat = b.lat * hw, ry = Math.atan2(tx * b.dir, tz * b.dir);
      if (b.ferry) { b.ph += dt * 0.05; const u = Math.sin(b.ph); lat = u * Math.max(0, hw - 3); ry = Math.atan2(nx, nz); }
      b.x = R.X[i] + tx * f + nx * lat; b.z = R.Z[i] + tz * f + nz * lat; const y = R.H[i] + (R.H[i + 1] - R.H[i]) * f + 0.05 + Math.sin(t * 1.3 + b.ph) * .06;
      const s = b.type === 'ferry' ? 1 : Math.min(1, hw / 4.5 + .3);
      boatPool(b.type).put(b.x, y, b.z, ry, s, t + b.ph, 1, Math.sin(t * .9 + b.ph) * .02);
      if (b.ferry) { const cul = b.city.culture; const pp = personPool(cul, 'plain', 1); pp.put(b.x + nx * 0.2, y + .35, b.z + nz * 0.2, ry, 1, 0, 0, 0); const pp2 = personPool(cul, 'herder', 0); pp2.put(b.x - tx / tl * 2.2, y + .35, b.z - tz / tl * 2.2, ry + 1.5, 1, 0, 0, .2 * Math.sin(t * 1.5)); }
      else if (b.type !== 'felucca' || Math.sin(b.ph) > 0) { const pp = personPool(b.rv.name === 'Nile' || b.type === 'felucca' ? 'arab' : b.type === 'junk' ? 'song' : 'indian', 'plain', 2); pp.put(b.x - tx / tl * b.dir * 2.0, y + .3, b.z - tz / tl * b.dir * 2.0, ry, 1, 0, 0, 0); }
    }
    for (const k of ['felucca', 'junk', 'ganga', 'ferry']) if (pools['boat' + k]) pools['boat' + k].end();
  }

  // ---- per-frame driver ----
  let lifeT = 0, cellT = 0, plT = 0, smkTimeAcc = 0; const builtFx = new Set();
  GFX.onSite = (s, on) => { if (on) { try { siteDecor(s); } catch (e) { console.warn('decor', e); } builtFx.add(s); } else { builtFx.delete(s); if (crowd && crowd.s === s) crowd = null; s.fx = null; } };
  GFX.setQuality = () => { setupPointLights(); for (const k in pools) { const p = pools[k]; scene.remove(p.mesh); p.mesh.dispose(); delete pools[k]; } cells.clear(); agents = []; crowd = null; boats = []; flocks = []; flockT = 0; };
  let activeEm = [];
  GFX.lifeUpdate = (dt, now) => {
    if (!HK.lifeKit) return; const t = now / 1000; const px = player.x, pz = player.z;
    const scl = renderer.domElement.height / (2 * Math.tan(camera.fov * Math.PI / 360)); smkMat.uniforms.uScale.value = scl; glowMat.uniforms.uScale.value = scl; smkMat.uniforms.uTime.value = t;
    cellT -= dt; if (cellT < 0) { cellT = 0.35; updateCells(px, pz); }
    for (const k in pools) pools[k].begin();
    for (const a of agents) { const dd = Math.abs(a.x - px) + Math.abs(a.z - pz); if (dd > 700) continue; stepAgent(a, dt, t); a.pool.put(a.x, a.y, a.z, a.ry, a.s, a.ph, a.am, a.pitch, a.col); }
    // the crowd follows whichever city you are in
    let near = null; for (const s of builtFx) if (s.city && s.fx && Math.hypot(s.x - px, s.z - pz) < s.city.R + 120) near = s;
    if (near && (!crowd || crowd.s !== near)) crowd = buildCrowd(near); if (!near) crowd = null;
    stepCrowd(dt, t);
    boatT -= dt; if (boatT < 0) { boatT = 2; planBoats(px, pz); } stepBoats(dt, t);
    for (const k in pools) if (!k.startsWith('b') || k.startsWith('boat')) pools[k].end();
    flockT -= dt; if (flockT < 0) { flockT = 40; flocks = planFlocks(px, pz); }
    drawBirds(dt, t);
    // spinning wheels and mills, smoke from hearths
    plT -= dt; if (plT < 0) { plT = 1; activeEm = []; const cand = [];
      for (const s of builtFx) { if (!s.fx || Math.hypot(s.x - px, s.z - pz) > 420) continue; for (const e of s.fx.smoke) { const d = Math.hypot(e[0] - px, e[2] - pz); if (d < 330) cand.push([d, e]); } }
      cand.sort((a, b) => a[0] - b[0]); activeEm = cand.slice(0, Math.round(22 + 36 * Q.life)).map(c => c[1]);
      // point lights to the nearest lamps
      if (plights.length) { const L = []; for (const s of builtFx) { if (!s.fx || !s.fx.lightsW || Math.hypot(s.x - px, s.z - pz) > 400) continue; for (const l of s.fx.lightsW) { const d = Math.hypot(l[0] - px, l[2] - pz); if (d < 90) L.push([d, l]); } }
        L.sort((a, b) => a[0] - b[0]); plights.forEach((pl, i) => { const l = L[i]; pl.userData.on = !!l; if (l) pl.position.set(l[1][0], l[1][1] + .3, l[1][2]); }); } }
    for (const pl of plights) pl.intensity = pl.userData.on ? 9 * DN.night * (0.88 + 0.12 * Math.sin(t * 9 + pl.position.x)) : 0;
    for (const s of builtFx) if (s.fx && s.fx.spin.length && Math.hypot(s.x - px, s.z - pz) < 600) for (const sp of s.fx.spin) sp.o.rotation[sp.axis] += sp.sp * dt;
    smkTimeAcc += dt; const rate = 1.1; const nEm = activeEm.length;
    if (nEm) { const per = rate * smkTimeAcc; if (per >= 1 / nEm) { for (const e of activeEm) if (Math.random() < per * (e[3] || .5) * 1.6) emitSmoke(e[0], e[1], e[2], t); smkTimeAcc = 0; } }
    smkMat.uniforms.uCol.value.setRGB(.86, .84, .8).multiplyScalar(0.35 + 0.65 * DN.day).lerp(scene.fog.color, 0.15); smkMat.uniforms.uFog.value.copy(scene.fog.color); smkMat.uniforms.uFar.value = scene.fog.far;
    const wx = WX[wxState.type]; smkMat.uniforms.uWind.value.set(.5 + (wx.vel ? wx.vel[0] * .1 * wxState.k : 0), 0, .3 + (wx.vel ? wx.vel[2] * .1 * wxState.k : 0));
  };
  GFX._warmLife = () => { updateCells(player.x, player.z); flocks = planFlocks(player.x, player.z); flockT = 40; planBoats(player.x, player.z); boatT = 2; };
  GFX._agents = () => agents; GFX._boats = () => boats;

  // ================= v13 GROUND: swaying grass, reeds and flowers by the rivers, boulders, outcrops and cliffs =================
  const GWIND = { uWind: { value: 1 }, uGR: { value: 60 } };
  const grassMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  grassMat.onBeforeCompile = (sh) => {
    sh.uniforms.time = waterUniforms.time; Object.assign(sh.uniforms, SEASON_U, GWIND);
    sh.vertexShader = 'uniform float time; uniform float uWind; uniform float uGR; attribute float aH; varying vec3 vWPos; varying float vH;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
      float dcam = length(ip.xz - cameraPosition.xz); float fadeS = 1.0 - smoothstep(uGR * 0.72, uGR, dcam);
      transformed *= fadeS; vH = aH;
      float ph = time * 1.9 + ip.x * 0.31 + ip.z * 0.23; float gust = 0.55 + 0.45 * sin(time * 0.6 + ip.x * 0.05 - ip.z * 0.04);
      float sw = (sin(ph) * 0.6 + sin(ph * 2.3 + 1.7) * 0.25) * gust * uWind * aH * aH;
      mat3 gim = mat3(instanceMatrix); float s2 = dot(gim[0], gim[0]); vec3 wv = vec3(0.17, 0.0, 0.11) * sw * 1.6 / s2; transformed += vec3(dot(gim[0], wv), dot(gim[1], wv), dot(gim[2], wv));`)
      .replace('#include <project_vertex>', '#include <project_vertex>\n vWPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = SEASON_GLSL + 'varying vec3 vWPos; varying float vH;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      { float lat = 38.0 - vWPos.z / uK; vec3 c = diffuseColor.rgb;
        c = mix(c, c * vec3(1.25, 1.0, 0.55), uAutumn * 0.7 * smoothstep(30.0, 42.0, lat));
        c = mix(c, c * vec3(1.18, 1.05, 0.7), uSummer * 0.4 * smoothstep(24.0, 40.0, lat));
        c = mix(c, mix(c, vec3(0.62, 0.55, 0.42), 0.6), uWinter * smoothstep(33.0, 42.0, lat));
        c = mix(c, vec3(0.92, 0.94, 0.98), uWinter * smoothstep(34.0, 43.0, lat) * smoothstep(0.5, 1.0, vH) * 0.7);
        diffuseColor.rgb = c; }`);
    withHaze(sh, 'vWPos');
  };
  grassMat.customProgramCacheKey = () => 'grass';
  function bladeGeo(kind) {
    const pos = [], col = [], ah = []; const r = W.rng(kind.length * 7 + 3);
    const blade = (x, z, hgt, w, lean, ang, c0, c1) => { const ca = Math.cos(ang), sa = Math.sin(ang); const tx = x + Math.sin(ang) * lean, tz = z + Math.cos(ang) * lean;
      const p = [[x - ca * w, 0, z + sa * w], [x + ca * w, 0, z - sa * w], [tx, hgt, tz]]; for (const [i, q] of p.entries()) { pos.push(...q); const t = i === 2 ? 1 : 0; col.push(c0[0] + (c1[0] - c0[0]) * t, c0[1] + (c1[1] - c0[1]) * t, c0[2] + (c1[2] - c0[2]) * t); ah.push(t); } };
    if (kind === 'grass') for (let i = 0; i < 9; i++) { const a = r() * 6.28, rr = r() * .28; blade(Math.cos(a) * rr, Math.sin(a) * rr, .35 + r() * .4, .045, .12 + r() * .15, r() * 6.28, [.45, .45, .4], [1.15, 1.12, 1.0]); }
    else if (kind === 'reed') { for (let i = 0; i < 10; i++) { const a = r() * 6.28, rr = r() * .35; blade(Math.cos(a) * rr, Math.sin(a) * rr, 1.3 + r() * .9, .035, .15 + r() * .25, r() * 6.28, [.3, .4, .2], [.7, .75, .45]); }
      for (let i = 0; i < 3; i++) { const x = (r() - .5) * .4, z = (r() - .5) * .4, hh = 1.6 + r() * .5; for (const [ox, oz] of [[.04, 0], [-.04, 0], [0, .04], [0, -.04]]) { blade(x + ox, z + oz, hh, .02, .1, Math.atan2(ox, oz), [.4, .3, .18], [.45, .3, .16]); } } }
    else { const fc = { flowerR: [1.3, .28, .2], flowerY: [1.4, 1.1, .25], flowerW: [1.4, 1.4, 1.3], flowerB: [.55, .45, 1.2] }[kind];
      for (let i = 0; i < 6; i++) { const a = r() * 6.28, rr = r() * .3; const x = Math.cos(a) * rr, z = Math.sin(a) * rr, hh = .28 + r() * .25; blade(x, z, hh, .02, .05, r() * 6.28, [.35, .5, .25], [.5, .7, .35]);
        for (let k = 0; k < 3; k++) { const pa = k / 3 * 6.28; const px = x + Math.sin(.05) * .05, pz = z; pos.push(px, hh, pz, px + Math.cos(pa) * .09, hh + .03, pz + Math.sin(pa) * .09, px + Math.cos(pa + 1.2) * .09, hh + .03, pz + Math.sin(pa + 1.2) * .09); for (let q = 0; q < 3; q++) { col.push(fc[0], fc[1], fc[2]); ah.push(1); } } }
      for (let i = 0; i < 4; i++) { const a = r() * 6.28, rr = r() * .3; blade(Math.cos(a) * rr, Math.sin(a) * rr, .3, .04, .1, r() * 6.28, [.45, .45, .4], [1.1, 1.1, 1.0]); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('aH', new THREE.Float32BufferAttribute(ah, 1)); g.computeVertexNormals();
    { const N = g.attributes.normal.array; for (let i = 0; i < N.length; i += 3) { N[i] *= .3; N[i + 1] = 1; N[i + 2] *= .3; const l = Math.hypot(N[i], N[i + 1], N[i + 2]); N[i] /= l; N[i + 1] /= l; N[i + 2] /= l; } } // soft, sky-facing normals
    return g;
  }
  const GKINDS = ['grass', 'reed', 'flowerR', 'flowerY', 'flowerW', 'flowerB']; const GCAP = { grass: 16000, reed: 4000, flowerR: 1500, flowerY: 1500, flowerW: 1500, flowerB: 1500 };
  const gmesh = {}; for (const k of GKINDS) { const m = new THREE.InstancedMesh(bladeGeo(k), grassMat, GCAP[k]); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.receiveShadow = true; m.count = 0;
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(GCAP[k] * 3).fill(1), 3); scene.add(m); gmesh[k] = m; }
  const GDENS = { thrace: 1, anatolia: .75, pontic: 1, caucasus: 1, hyrcanian: 1, levant: .55, mesopotamia: .35, iran: .3, sand: 0, oasis: .7, steppe: 1, alpine: .95, gobi: .2, tibet: .6, loess: .5, northchina: .8, southchina: 1, flaming: 0, nile: .25, nafud: .03, hejaz: .08, yemen: .35, indoplain: .8, thar: .2, deccan: .6, tropical: 1, dryzone: .6 };
  const GC = 8; const gcells = new Map(); let gDirty = false;
  function genGrassCell(cx, cz) {
    const out = { grass: [], reed: [], flowerR: [], flowerY: [], flowerW: [], flowerB: [] }; const x0 = cx * GC, z0 = cz * GC;
    const xc = x0 + GC / 2, zc = z0 + GC / 2; const hc = W.height(xc, zc); const o = W.OUT;
    if (o.sea > 0.3 || (o.city && o.cd < o.city.R + 1) || (o.vil && o.vd < o.vil.r - 1) || hc < 0.4) return out;
    const ll = W.toLL(xc, zc); const bi = W.bioIndex(ll[0], ll[1]); const dom = W.BIOME_KEYS[W.bio.dom[bi]]; if (hc > W.bio.snow[bi] - 5) return out;
    const nearR = o.rd < o.rhw + 14; const nearRoad = o.pd < 10; const lakeEdge = o.lake > 0.02;
    let dens = GDENS[dom] === undefined ? .6 : GDENS[dom]; const lush = W.bio.gg[bi] > W.bio.gr[bi] + 0.02; if (lush) dens = Math.max(dens, .8); if (nearR) dens = Math.max(dens, .95);
    // 3x3 height samples for cheap interpolation
    const H = new Float32Array(9); for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) H[j * 3 + i] = W.height(x0 + i * GC / 2, z0 + j * GC / 2);
    const hAt = (fx, fz) => { const u = fx * 2, v = fz * 2; const i = Math.min(1, Math.floor(u)), j = Math.min(1, Math.floor(v)); const a = u - i, b = v - j; const k = j * 3 + i; return (H[k] * (1 - a) + H[k + 1] * a) * (1 - b) + (H[k + 3] * (1 - a) + H[k + 4] * a) * b; };
    if (Math.abs(H[0] - H[8]) > 5 || Math.abs(H[2] - H[6]) > 5) dens *= 0.3; // cliffs stay bare
    const sw = seasonWeights(HK.seasonMonth ? HK.seasonMonth() : 6.3); const flowerK = (sw.sp + sw.s * .55 + sw.a * .1) * (lush || nearR ? 1 : .35);
    const gb = [lin(W.bio.gr[bi] * .85), lin(W.bio.gg[bi] * .9), lin(W.bio.gb[bi] * .75)];
    const n = Math.round(26 * dens * Q.grass + (nearR ? 8 : 0)); const r = W.rng(cx * 92821 + cz * 68917);
    for (let k = 0; k < n; k++) {
      const fx = r(), fz = r(); const x = x0 + fx * GC, z = z0 + fz * GC;
      if (nearRoad && W.pathQuery(x, z).d < 3.6) continue;
      let kind = 'grass';
      if (nearR) { const rq = W.riverQuery(x, z); if (rq.d < rq.hw + 0.6) { if (rq.d > rq.hw - 1.4 && r() < .7) kind = 'reed'; else continue; } else if (rq.d < rq.hw + 3.5 && r() < .55) kind = 'reed'; }
      if (lakeEdge && kind === 'grass') { W.height(x, z); const lk = W.OUT.lake; if (lk > 0.4) continue; if (lk > 0.08 && r() < .7) kind = 'reed'; }
      if (kind === 'grass' && r() < 0.1 * flowerK) kind = ['flowerR', 'flowerY', 'flowerW', 'flowerB'][Math.floor(r() * 4)];
      const y = hAt(fx, fz) - 0.06; const s = (kind === 'reed' ? .8 + r() * .5 : .7 + r() * .7); const ry = r() * 6.28;
      const tint = .82 + r() * .3; out[kind].push(x, y, z, ry, s, kind === 'grass' ? gb[0] * tint * 1.6 : 1, kind === 'grass' ? gb[1] * tint * 1.6 : 1, kind === 'grass' ? gb[2] * tint * 1.6 : 1);
    }
    return out;
  }
  function rebuildGrass() {
    for (const k of GKINDS) { const m = gmesh[k]; const e = m.instanceMatrix.array, ca = m.instanceColor.array; let n = 0; const cap = GCAP[k];
      for (const c of gcells.values()) { const L = c[k]; for (let i = 0; i < L.length && n < cap; i += 8) { const ry = L[i + 3], s = L[i + 4], co = Math.cos(ry) * s, si = Math.sin(ry) * s, o = n * 16;
        e[o] = co; e[o + 1] = 0; e[o + 2] = -si; e[o + 3] = 0; e[o + 4] = 0; e[o + 5] = s; e[o + 6] = 0; e[o + 7] = 0; e[o + 8] = si; e[o + 9] = 0; e[o + 10] = co; e[o + 11] = 0; e[o + 12] = L[i]; e[o + 13] = L[i + 1]; e[o + 14] = L[i + 2]; e[o + 15] = 1;
        ca[n * 3] = L[i + 5]; ca[n * 3 + 1] = L[i + 6]; ca[n * 3 + 2] = L[i + 7]; n++; } }
      m.count = n; m.visible = n > 0; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
  }
  let gT = 0, gLastSeason = -1;
  function updateGrass(px, pz, dt) {
    const R = 26 + 44 * Q.grass; GWIND.uGR.value = R; const pcx = Math.floor(px / GC), pcz = Math.floor(pz / GC), n = Math.ceil(R / GC); const t0 = performance.now();
    const sm = Math.round((HK.seasonMonth ? HK.seasonMonth() : 6.3) * 2); if (sm !== gLastSeason) { gLastSeason = sm; gcells.clear(); }
    const want = []; for (let a = -n; a <= n; a++) for (let b = -n; b <= n; b++) { const cx = pcx + a, cz = pcz + b; const d = Math.hypot((cx + .5) * GC - px, (cz + .5) * GC - pz); if (d < R + 4 && !gcells.has(cx + ',' + cz)) want.push([d, cx, cz]); }
    want.sort((p, q) => p[0] - q[0]);
    for (const [d, cx, cz] of want) { if (performance.now() - t0 > 2.5 && !GFX._nolimit) break; gcells.set(cx + ',' + cz, genGrassCell(cx, cz)); gDirty = true; }
    for (const k of gcells.keys()) { const [cx, cz] = k.split(',').map(Number); if (Math.hypot((cx + .5) * GC - px, (cz + .5) * GC - pz) > R + 14) { gcells.delete(k); gDirty = true; } }
    gT -= dt; if (gDirty && gT < 0) { gT = 0.25; gDirty = false; rebuildGrass(); }
    const wd = WX[wxState.type]; GWIND.uWind.value = 1 + (wd === WX.sand ? 2.5 : wd === WX.rain ? 1.2 : wd === WX.dust ? 1.2 : 0) * wxState.k;
  }

  // ---- boulders, outcrops and cliff faces ----
  const rockMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  rockMat.onBeforeCompile = (sh) => {
    sh.vertexShader = 'varying vec3 vWPos; varying vec3 vWNorm;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n vWPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz; vWNorm = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);');
    sh.fragmentShader = 'varying vec3 vWPos; varying vec3 vWNorm;\n' + GLSL_NOISE + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      { float st = sin(vWPos.y * 2.4 + vn(vWPos.xz * 0.3) * 4.0) * 0.5 + 0.5; float g = vn(vWPos.xz * 2.0 + vWPos.y) * 0.5 + vn(vWPos.zy * 5.0) * 0.5;
        diffuseColor.rgb *= (0.86 + 0.14 * st) * (0.85 + 0.3 * g); diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.75, 0.85, 0.6), smoothstep(0.6, 0.95, vWNorm.y) * 0.35 * step(0.55, vn(vWPos.xz * 1.3))); }`);
    withRim(sh, 0.14); withHaze(sh, 'vWPos');
  };
  rockMat.customProgramCacheKey = () => 'rock';
  function rockGeo(seed, kind) {
    const g = (kind === 'slab' ? new THREE.IcosahedronGeometry(1, 1) : new THREE.DodecahedronGeometry(1, seed % 2)); const P = g.attributes.position.array; const r = W.rng(seed * 11 + 5);
    const off = [r() * 10, r() * 10, r() * 10];
    for (let i = 0; i < P.length; i += 3) { const x = P[i], y = P[i + 1], z = P[i + 2]; const n = W.noise3 ? W.noise3(x * 1.3 + off[0], z * 1.3 + y * .7 + off[1]) : 0; let k = 1 + n * .35;
      P[i] = x * k; P[i + 1] = (y > 0 ? y * (kind === 'slab' ? 1 : .75) : y * .5) * k; P[i + 2] = z * k * (kind === 'slab' ? .45 : 1); if (kind === 'slab') { P[i + 1] += Math.floor((y + 1) * 3) * .02; } }
    g.computeVertexNormals(); const n = P.length / 3, col = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const yy = P[i * 3 + 1]; const t = .78 + .3 * Math.max(0, yy); col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = t; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g;
  }
  const RKINDS = ['b0', 'b1', 'b2', 'slab']; const RCAP = { b0: 2500, b1: 2500, b2: 1500, slab: 900 }; const rmesh = {};
  for (const [i, k] of RKINDS.entries()) { const m = new THREE.InstancedMesh(rockGeo(i + 1, k === 'slab' ? 'slab' : 'b'), rockMat, RCAP[k]); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true; m.count = 0;
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(RCAP[k] * 3).fill(1), 3); scene.add(m); rmesh[k] = m; }
  const ROCKC = { sand: 0xb08858, nafud: 0xa8664a, hejaz: 0x8a5a44, flaming: 0xa4583a, loess: 0xb09070, yemen: 0x5a5048, deccan: 0x4e4844, levant: 0xc8bca0, nile: 0xc0a478, gobi: 0x8a7458, tibet: 0x8a8478, alpine: 0x8a8884, caucasus: 0x7c7a76, anatolia: 0x9a9080, iran: 0x9a8670, thar: 0xb08a60, steppe: 0x8e8a7c, mesopotamia: 0xa89878 };
  const RC = 32; const rcells = new Map(); let rDirty = false;
  function genRockCell(cx, cz) {
    const out = { b0: [], b1: [], b2: [], slab: [], col: [] }; const x0 = cx * RC, z0 = cz * RC; const xc = x0 + RC / 2, zc = z0 + RC / 2;
    const h = W.height(xc, zc); const o = W.OUT; if (o.sea > 0.2 || o.lake > 0.2 || (o.city && o.cd < o.city.R + 8) || (o.vil && o.vd < o.vil.r + 3) || h < 0.5) return out;
    const ll = W.toLL(xc, zc); const bi = W.bioIndex(ll[0], ll[1]); const dom = W.BIOME_KEYS[W.bio.dom[bi]]; const rough = W.bio.rough[bi] || 3;
    const hx = W.height(xc + 6, zc), hz = W.height(xc, zc + 6); const gx = (hx - h) / 6, gz = (hz - h) / 6; const slope = Math.hypot(gx, gz);
    const dry = (W.bio.dens[bi] || .3) < .35 ? 1 : 0; const r = W.rng(cx * 15731 + cz * 789221 + 7);
    let n = (rough / 10) * 2.2 + Math.min(3, slope * 4) + dry * .8; n = n * Q.rocks * (0.4 + r() * 1.2); if (dom === 'sand' && slope < .2) n *= .2;
    const rc = new THREE.Color(ROCKC[dom] || 0x8a8478); const c0 = [rc.r, rc.g, rc.b];
    const put = (kind, x, z, s, sy, ry, sink) => { const y = W.height(x, z); const oo = W.OUT; if (oo.pd < 5 || oo.rd < oo.rhw + 2 || oo.sea > .1 || oo.lake > .1 || (oo.city && oo.cd < oo.city.R + 6) || (oo.vil && oo.vd < oo.vil.r + 2)) return;
      const v = .85 + r() * .3; out[kind].push(x, y - s * sink, z, ry, s, sy, c0[0] * v, c0[1] * v, c0[2] * v); if (s > 1.1) out.col.push({ x, z, r: s * .75 }); };
    const cnt = Math.floor(n) + (r() < n % 1 ? 1 : 0);
    for (let k = 0; k < cnt; k++) { const x = x0 + r() * RC, z = z0 + r() * RC; const big = r(); const kk = ['b0', 'b1', 'b2'][Math.floor(r() * 3)];
      if (big < .72) put(kk, x, z, .3 + r() * .8, .8 + r() * .4, r() * 6.28, .25); else if (big < .94) put(kk, x, z, 1.2 + r() * 1.6, .7 + r() * .5, r() * 6.28, .35);
      else { const m = 2 + Math.floor(r() * 4); for (let q = 0; q < m; q++) put(['b0', 'b1', 'b2'][q % 3], x + (r() - .5) * 7, z + (r() - .5) * 7, 1.6 + r() * 2.8, .8 + r() * .7, r() * 6.28, .4); } }
    if (slope > .45 && rough > 4 && r() < Math.min(1, slope) * Q.rocks) { const m = 1 + Math.floor(slope * 2.5); const ry = Math.atan2(gx, gz);
      for (let q = 0; q < m; q++) put('slab', xc + (r() - .5) * 20, zc + (r() - .5) * 20, 2.5 + r() * 3.5, 1.1 + r() * .9, ry + (r() - .5) * .5, .3); }
    return out;
  }
  function removeCol(c) { const x0 = c.x - c.r, x1 = c.x + c.r, z0 = c.z - c.r, z1 = c.z + c.r; for (let ix = Math.floor(x0 / 32); ix <= Math.floor(x1 / 32); ix++) for (let iz = Math.floor(z0 / 32); iz <= Math.floor(z1 / 32); iz++) { const a = colHash.get(ckey(ix, iz)); if (a) { const i = a.indexOf(c); if (i >= 0) a.splice(i, 1); } } }
  function rebuildRocks() {
    for (const k of RKINDS) { const m = rmesh[k]; const e = m.instanceMatrix.array, ca = m.instanceColor.array; let n = 0; const cap = RCAP[k];
      for (const c of rcells.values()) { const L = c[k]; for (let i = 0; i < L.length && n < cap; i += 9) { const ry = L[i + 3], s = L[i + 4], sy = L[i + 5] * s, co = Math.cos(ry) * s, si = Math.sin(ry) * s, o = n * 16;
        e[o] = co; e[o + 1] = 0; e[o + 2] = -si; e[o + 3] = 0; e[o + 4] = 0; e[o + 5] = sy; e[o + 6] = 0; e[o + 7] = 0; e[o + 8] = si; e[o + 9] = 0; e[o + 10] = co; e[o + 11] = 0; e[o + 12] = L[i]; e[o + 13] = L[i + 1]; e[o + 14] = L[i + 2]; e[o + 15] = 1;
        ca[n * 3] = L[i + 6]; ca[n * 3 + 1] = L[i + 7]; ca[n * 3 + 2] = L[i + 8]; n++; } }
      m.count = n; m.visible = n > 0; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
  }
  let rT = 0;
  function updateRocks(px, pz, dt) {
    const R = 140 + 170 * Q.rocks; const pcx = Math.floor(px / RC), pcz = Math.floor(pz / RC), n = Math.ceil(R / RC); const t0 = performance.now();
    const want = []; for (let a = -n; a <= n; a++) for (let b = -n; b <= n; b++) { const cx = pcx + a, cz = pcz + b; const d = Math.hypot((cx + .5) * RC - px, (cz + .5) * RC - pz); if (d < R && !rcells.has(cx + ',' + cz)) want.push([d, cx, cz]); }
    want.sort((p, q) => p[0] - q[0]);
    for (const [d, cx, cz] of want) { if (performance.now() - t0 > 2 && !GFX._nolimit) break; const c = genRockCell(cx, cz); for (const cc of c.col) addCollider(cc); rcells.set(cx + ',' + cz, c); rDirty = true; }
    for (const [k, c] of rcells) { const [cx, cz] = k.split(',').map(Number); if (Math.hypot((cx + .5) * RC - px, (cz + .5) * RC - pz) > R + 60) { for (const cc of c.col) removeCol(cc); rcells.delete(k); rDirty = true; } }
    rT -= dt; if (rDirty && rT < 0) { rT = 0.3; rDirty = false; rebuildRocks(); }
  }
  GFX.groundUpdate = (dt) => { updateGrass(player.x, player.z, dt); updateRocks(player.x, player.z, dt); };
  const _sq = GFX.setQuality; GFX.setQuality = () => { if (_sq) _sq(); gcells.clear(); for (const c of rcells.values()) for (const cc of c.col) removeCol(cc); rcells.clear(); gDirty = rDirty = true; };
  GFX.warm = () => { GFX._nolimit = true; updateGrass(player.x, player.z, 1); updateRocks(player.x, player.z, 1); gT = rT = 0; gDirty = rDirty = true; updateGrass(player.x, player.z, 1); updateRocks(player.x, player.z, 1); if (GFX._warmLife) GFX._warmLife(); GFX._nolimit = false; };
  GFX._dbg = () => { const o = { gcells: gcells.size, rcells: rcells.size }; for (const k of GKINDS) o[k] = gmesh[k].count; for (const k of RKINDS) o[k] = rmesh[k].count; o.pools = Object.keys(pools).map(k => k + ':' + pools[k].n).join(' '); o.agents = agents.length; o.boats = boats.length; o.flocks = flocks.length; return o; };

  Object.assign(window.__game, { renderer, setQuality });
  // ---------- loop ----------
  let detT = 0; let last = performance.now(), palT = 0, frames = 0, fpsT = 0;
  function loop() {
    requestAnimationFrame(loop);
    if (window.__arenaOn) return;
    const now = performance.now(); let dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (started && !mapOpen && !window.__freeze) updatePlayer(dt); else { camera.position.set(player.x, player.y, player.z); camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ'); }
    if (started) { updateHUD(dt); drawMinimap(dt); }
    if (started && HK.frame) HK.frame(dt, now);
    updateChunks(player.x, player.z, 7, 0);
    updateSites(player.x, player.z);
    detT -= dt; if (detT < 0) { detT = 0.3; for (const st of sites) if (st.group) { const d = Math.hypot(st.x - player.x, st.z - player.z); for (const ch of st.group.children) if (ch.userData.detail) ch.visible = d < ch.userData.detail + (st.city ? st.city.R : 0); } }
    palT -= dt; if (palT < 0) { palT = 0.2; updatePalette(player.x, player.z, 0.2); }
    updateClouds(player.x, player.z, dt);
    GFX.update(dt, now);
    waterUniforms.time.value = now / 1000;
    { const m = HK.seasonMonth ? HK.seasonMonth() : 6.3; const sw = seasonWeights(m); for (const [k, v] of [['uWinter', sw.w], ['uSummer', sw.s], ['uAutumn', sw.a], ['uSpring', sw.sp]]) { const u = SEASON_U[k]; u.value = Math.abs(v - u.value) > 0.25 ? v : u.value + (v - u.value) * 0.1; } SEASON_U.uK.value = W.K; }
    sea.position.set(Math.round(player.x / 20) * 20, 0, Math.round(player.z / 20) * 20);
    sky.position.copy(camera.position);
    sun.position.set(player.x + GFX.lightDir.x * 800, player.y + GFX.lightDir.y * 800, player.z + GFX.lightDir.z * 800);
    sun.target.position.set(player.x, player.y, player.z);
    GFX.render();
    if (HK.postRender) HK.postRender();
    if (mapOpen) { frames++; fpsT += dt; if (fpsT > 0.25) { fpsT = 0; drawMap(); } }
  }
})();

