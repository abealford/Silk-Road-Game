// ============================================================
//  v21: CHARACTER CREATION — Matteo's apprentice, made your own
// ============================================================
// Replaces the v8 character select. Purely cosmetic: the backstory and age (about 20) are fixed.
// window.HERO holds the look data, the period names, the portrait and merchant's-mark drawings and
// the 3D figure used for the preview, the third-person view and the story's NPCs.
// window.openCharCreate(cb) shows the screen; cb('venetian', { mode, hero, chapter }) starts the game.
(() => {
  const SKIN = ['#f0c8a4', '#e2b48e', '#d0a078', '#b88458', '#9a6a44', '#7a5032'];
  const HAIRC = ['#1a1410', '#3a2414', '#6a4022', '#a8743a', '#caa264', '#8e8a84'];
  const BANNERS = [['Crimson', '#9a1f1a'], ['Venetian blue', '#1f4a8a'], ['Forest green', '#2f6a32'], ['Saffron', '#d09a1a'], ['Purple', '#5a2a72'], ['Black', '#22201e'], ['Ivory', '#ece2c8'], ['Russet', '#a8502a']];
  const OUTFITS = [
    { name: 'Merchant\'s tunic', main: '#7a2a1e', trim: '#c8a03a', hose: '#3a2a1e' },
    { name: 'Travelling cloak', main: '#5a4a3a', trim: '#8a7050', hose: '#2a2420', cloak: true },
    { name: 'Scholar\'s robe', main: '#24304a', trim: '#b8a070', hose: '#1e1e24', long: true },
    { name: 'Apprentice\'s smock', main: '#5a6a3a', trim: '#d8c8a0', hose: '#4a3a2a' },
    { name: 'Brocade for feast days', main: '#5a2a5a', trim: '#d8b04a', hose: '#2a1e2a' },
  ];
  const OPTS = {
    gender: [['m', 'Man'], ['f', 'Woman']],
    body: ['Slight', 'Average', 'Sturdy'],
    face: ['Oval', 'Round', 'Long', 'Angular'],
    hair: ['Cropped', 'Page-boy', 'Shoulder-length', 'Long and braided', 'Shaven'],
    facial: ['None', 'Stubble', 'Short beard', 'Full beard', 'Moustache'],
    head: ['Bare-headed', 'Beretta', 'Linen coif', 'Hood', 'Straw hat', 'Veil'],
    scar: ['None', 'Across the cheek', 'Through the brow', 'On the lip'],
    markTop: ['Sign of four', 'Cross', 'Double cross', 'Orb', 'Hook'],
    markFoot: ['Plain', 'Split', 'Crossed', 'Footed'],
  };
  const NAMES = {
    m: ['Marco', 'Niccolò', 'Andrea', 'Pietro', 'Zanino', 'Giovanni', 'Iacopo', 'Lorenzo', 'Tommaso', 'Filippo', 'Benedetto', 'Domenico'],
    f: ['Agnese', 'Caterina', 'Maria', 'Franceschina', 'Marchesina', 'Beatrice', 'Isabetta', 'Cristina', 'Lucia', 'Fantina', 'Orsola', 'Elena'],
    last: ['Dandolo', 'Contarini', 'Morosini', 'Querini', 'Ziani', 'Soranzo', 'Michiel', 'Bembo', 'Gradenigo', 'Badoer', 'Giustinian', 'Falier', 'Zeno', 'Tiepolo'],
  };
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const ri = n => Math.floor(Math.random() * n);
  function randomName(look) { look.first = pick(NAMES[look.gender]); look.last = pick(NAMES.last); return look; }
  function randomLook(gender) {
    const g = gender || (Math.random() < .5 ? 'm' : 'f');
    const L = { gender: g, outfit: ri(OUTFITS.length), body: ri(3), skin: ri(5), face: ri(4), hair: g === 'f' ? pick([1, 2, 3]) : pick([0, 0, 1, 2, 4]), hairC: ri(5),
      facial: g === 'f' ? 0 : pick([0, 0, 1, 2, 3, 4]), head: g === 'f' ? pick([0, 2, 5, 5]) : pick([0, 1, 1, 2, 3, 4]), scar: Math.random() < .7 ? 0 : 1 + ri(3),
      markTop: ri(5), markFoot: ri(4), markInit: Math.random() < .6 ? 1 : 0, banner: ri(BANNERS.length) };
    return randomName(L);
  }
  const bannerHex = L => BANNERS[L.banner || 0][1];
  const initials = L => [(L.first || '?')[0].toUpperCase(), (L.last || '?')[0].toUpperCase()];

  // ---------------- the merchant's mark ----------------
  function markPath(L) {
    let d = 'M30 8 V48 ';
    d += ['M30 8 L17 24 H36 ', 'M21 17 H39 ', 'M21 14 H39 M23 23 H37 ', 'M30 8 m-7 0 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 M23 8 H37 ', 'M30 8 Q42 8 40 18 '][L.markTop || 0];
    d += ['', 'M30 48 L21 57 M30 48 L39 57 ', 'M23 41 L37 53 M37 41 L23 53 ', 'M20 50 H40 '][L.markFoot || 0];
    return d;
  }
  function markSVG(L, size = 60, col = '#2a1a10', bg) {
    const [a, b] = initials(L);
    return `<svg viewBox="0 0 60 60" width="${size}" height="${size}" class="mark">${bg ? `<circle cx="30" cy="30" r="29" fill="${bg}" stroke="#5a1008" stroke-width="2"/>` : ''}<path d="${markPath(L)}" fill="none" stroke="${col}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>${L.markInit ? `<text x="12" y="44" font-family="Georgia, serif" font-size="13" font-weight="bold" fill="${col}" text-anchor="middle">${a}</text><text x="48" y="44" font-family="Georgia, serif" font-size="13" font-weight="bold" fill="${col}" text-anchor="middle">${b}</text>` : ''}</svg>`;
  }
  function sealSVG(L, size = 64) { return markSVG(L, size, '#f3d9b0', '#8e2416'); }
  function drawMark(g, L, x, y, s, col) { // onto a 2D canvas, the mark's 60 x 60 box scaled by s
    g.save(); g.translate(x, y); g.scale(s, s); g.strokeStyle = col; g.lineWidth = 3.4; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(new Path2D(markPath(L)));
    if (L.markInit) { const [a, b] = initials(L); g.fillStyle = col; g.font = 'bold 13px Georgia, serif'; g.textAlign = 'center'; g.fillText(a, 12, 44); g.fillText(b, 48, 44); } g.restore();
  }
  function bannerTexture(L) {
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 160; const g = cv.getContext('2d'); const col = bannerHex(L);
    g.fillStyle = col; g.fillRect(0, 0, 128, 160); g.fillStyle = 'rgba(255,240,200,.18)'; g.fillRect(0, 0, 128, 10); g.fillRect(0, 150, 128, 10);
    const light = ['#ece2c8', '#d09a1a'].includes(col); drawMark(g, L, 19, 30, 1.5, light ? '#3a1a10' : '#f3e2b8');
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  }

  // ---------------- the portrait (SVG) ----------------
  function portrait(L, size = 110, bg = '#3a5a7a') {
    const st = 'stroke="#2a1a10" stroke-width="1.5" stroke-linejoin="round"'; const O = OUTFITS[L.outfit || 0]; const sk = L.skinHex || SKIN[L.skin || 0]; const hc = L.hairHex || HAIRC[L.hairC || 0];
    const robe = L.robe || O.main, trim = L.trim || O.trim; const bw = [0.9, 1, 1.12][L.body ?? 1];
    const fr = [[15, 18], [16.5, 16.5], [14, 19.5], [15.5, 17.5]][L.face || 0]; const [rx, ry] = fr;
    let s = `<svg viewBox="0 0 100 100" width="${size}" height="${size}" class="portrait"><rect width="100" height="100" fill="${bg}"/><circle cx="50" cy="38" r="42" fill="#fff" opacity=".13"/>`;
    // long hair falls behind the shoulders
    if (!L.headOverride && (L.hair === 2 || L.hair === 3) && L.head !== 3 && L.head !== 5) s += `<path d="M${50 - rx - 3} 40 Q${50 - rx - 6} ${L.hair === 3 ? 74 : 66} ${50 - rx + 2} ${L.hair === 3 ? 78 : 68} H${50 + rx - 2} Q${50 + rx + 6} ${L.hair === 3 ? 74 : 66} ${50 + rx + 3} 40 Z" fill="${hc}" ${st}/>`;
    s += `<path d="M${50 - 40 * bw} 100 Q${50 - 36 * bw} 72 50 68 Q${50 + 36 * bw} 72 ${50 + 40 * bw} 100 Z" fill="${robe}" ${st}/>`;
    s += L.gender === 'f' ? `<path d="M40 70 Q50 80 60 70" fill="none" stroke="${trim}" stroke-width="3"/>` : `<path d="M38 70 L50 86 L62 70" fill="${trim}" ${st}/>`;
    if ((OUTFITS[L.outfit || 0] || {}).cloak && !L.robe) s += `<path d="M${50 - 41 * bw} 100 Q${50 - 38 * bw} 74 ${50 - 18} 69 L${50 - 24} 100 Z M${50 + 41 * bw} 100 Q${50 + 38 * bw} 74 ${50 + 18} 69 L${50 + 24} 100 Z" fill="${L.cloakHex || bannerHex(L)}" ${st}/><circle cx="50" cy="72" r="2.6" fill="#c8a03a" ${st}/>`;
    if (L.cross) s += `<path d="M50 78 v12 M45 82 h10" stroke="#d8b84a" stroke-width="2.4"/>`;
    s += `<rect x="43.5" y="56" width="13" height="14" fill="${sk}" ${st}/>`;
    if (L.head === 3) s += `<path d="M${50 - rx - 10} 70 Q${50 - rx - 12} 20 50 17 Q${50 + rx + 12} 20 ${50 + rx + 10} 70 Q62 60 50 60 Q38 60 ${50 - rx - 10} 70 Z" fill="${L.hoodHex || '#4a3a2a'}" ${st}/>`;
    if (L.head === 5) s += `<path d="M${50 - rx - 8} 72 Q${50 - rx - 9} 22 50 19 Q${50 + rx + 9} 22 ${50 + rx + 8} 72 Q62 62 50 62 Q38 62 ${50 - rx - 8} 72 Z" fill="#ece4d0" ${st}/>`;
    s += `<ellipse cx="50" cy="44" rx="${rx}" ry="${ry}" fill="${sk}" ${st}/>`;
    if (L.face === 3) s += `<path d="M${50 - rx + 2} 52 L50 ${44 + ry} L${50 + rx - 2} 52" fill="none" stroke="#2a1a10" stroke-width=".8" opacity=".4"/>`;
    if (L.head !== 3 && L.head !== 5) s += `<ellipse cx="${50 - rx - .5}" cy="45" rx="2.5" ry="4" fill="${sk}" ${st}/><ellipse cx="${50 + rx + .5}" cy="45" rx="2.5" ry="4" fill="${sk}" ${st}/>`;
    const fem = L.gender === 'f';
    s += `<path d="M42 38 q3 -${fem ? 2.6 : 1.6} 6 0 M52 38 q3 -${fem ? 2.6 : 1.6} 6 0" stroke="${hc}" stroke-width="${fem ? 1.4 : 2.1}" fill="none"/><circle cx="45" cy="42" r="1.6" fill="#1a1410"/><circle cx="55" cy="42" r="1.6" fill="#1a1410"/>`;
    if (fem) s += `<path d="M43 41 l-1.2 -1 M57 41 l1.2 -1" stroke="#1a1410" stroke-width=".8"/>`;
    s += `<path d="M50 43 q-2 6 0 8 q1.5 .5 2.5 -.5" stroke="#6a3a22" stroke-width="1.3" fill="none"/>`;
    s += `<path d="M46 56.5 q4 1.5 8 0" stroke="${fem ? '#9a3a32' : '#7a3a2a'}" stroke-width="${fem ? 1.7 : 1.3}" fill="none"/>`;
    // scars
    if (L.scar === 1) s += `<path d="M57 44 l6 6 M58.5 46 l1.6 -1 M60.5 48 l1.6 -1" stroke="#8a3a2a" stroke-width="1.2" fill="none"/>`;
    if (L.scar === 2) s += `<path d="M55 33 l2 10" stroke="#8a3a2a" stroke-width="1.3" fill="none"/>`;
    if (L.scar === 3) s += `<path d="M47 54 l2 5" stroke="#8a3a2a" stroke-width="1.2" fill="none"/>`;
    if (L.scarHand) s += `<path d="M28 92 q4 -6 9 -4" stroke="#8a3a2a" stroke-width="1.6" fill="none"/>`;
    // facial hair
    const f = L.facial || 0;
    if (f === 1) s += `<path d="M38 50 Q42 62 50 62 Q58 62 62 50" fill="none" stroke="${hc}" stroke-width="5" opacity=".28"/>`;
    if (f === 2) s += `<path d="M38 50 Q42 62 50 62 Q58 62 62 50 Q56 56 50 55.5 Q44 56 38 50 Z" fill="${hc}" opacity=".92" ${st}/>`;
    if (f === 3) s += `<path d="M36 47 Q38 68 50 70 Q62 68 64 47 Q58 55 50 54 Q42 55 36 47 Z" fill="${hc}" ${st}/>`;
    if (f >= 2 || f === 4) s += `<path d="M44 52 q6 -2 12 0" stroke="${hc}" stroke-width="${f === 4 ? 3.2 : 2}" fill="none" stroke-linecap="round"/>`;
    // hair (front)
    const H = L.hair || 0; const top = 44 - ry;
    if (L.head !== 3 && L.head !== 5 && !L.headOverride) {
      if (H === 0) s += `<path d="M${50 - rx + 1} 38 Q${50 - rx} ${top - 2} 50 ${top - 3} Q${50 + rx} ${top - 2} ${50 + rx - 1} 38 Q50 ${top + 4} ${50 - rx + 1} 38 Z" fill="${hc}" ${st}/>`;
      if (H === 1) s += `<path d="M${50 - rx - 2} 50 Q${50 - rx - 3} ${top - 3} 50 ${top - 3} Q${50 + rx + 3} ${top - 3} ${50 + rx + 2} 50 L${50 + rx - 1} 50 Q${50 + rx - 2} 36 50 34 Q${50 - rx + 2} 36 ${50 - rx + 1} 50 Z" fill="${hc}" ${st}/>`;
      if (H === 2 || H === 3) s += `<path d="M${50 - rx - 1} 46 Q${50 - rx - 2} ${top - 3} 50 ${top - 3} Q${50 + rx + 2} ${top - 3} ${50 + rx + 1} 46 Q${50 + rx - 2} 33 50 ${top + 5} Q${50 - rx + 2} 33 ${50 - rx - 1} 46 Z" fill="${hc}" ${st}/>`;
      if (H === 3) s += `<path d="M${50 + rx + 1} 50 q5 10 1 24" stroke="${hc}" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M${50 + rx + 3} 58 h4 M${50 + rx + 4} 64 h4" stroke="#2a1a10" stroke-width=".8"/>`;
      if (H === 4) s += `<path d="M${50 - rx + 1} 40 Q50 ${top - 1} ${50 + rx - 1} 40" fill="none" stroke="${hc}" stroke-width="3" opacity=".35"/>`;
    }
    // headwear
    const hd = L.headOverride || ['', 'beretta', 'coif', '', 'straw', ''][L.head || 0];
    if (hd === 'beretta') s += `<path d="M${50 - rx - 2} 37 Q${50 - rx} ${top - 6} 50 ${top - 7} Q${50 + rx} ${top - 6} ${50 + rx + 2} 37 Q50 31 ${50 - rx - 2} 37 Z" fill="${L.hatHex || '#a8302a'}" ${st}/>`;
    if (hd === 'coif') s += `<path d="M${50 - rx - 1} 50 Q${50 - rx - 2} ${top - 4} 50 ${top - 4} Q${50 + rx + 2} ${top - 4} ${50 + rx + 1} 50 Q${50 + rx - 2} 37 50 35 Q${50 - rx + 2} 37 ${50 - rx - 1} 50 Z" fill="${L.hatHex || '#ece4d0'}" ${st}/><path d="M${50 - rx} 52 Q50 64 ${50 + rx} 52" fill="none" stroke="#8a8070" stroke-width="1.2"/>`;
    if (hd === 'straw') s += `<ellipse cx="50" cy="${top + 4}" rx="${rx + 12}" ry="5" fill="#d8b868" ${st}/><path d="M${50 - rx + 2} ${top + 4} Q50 ${top - 10} ${50 + rx - 2} ${top + 4} Z" fill="#d8b868" ${st}/><path d="M${50 - rx + 2} ${top + 2} H${50 + rx - 2}" stroke="#8a3a2a" stroke-width="2"/>`;
    if (hd === 'turban') s += `<ellipse cx="50" cy="${top + 3}" rx="${rx + 4}" ry="11" fill="${L.hatHex || '#f0ece0'}" ${st}/><path d="M${50 - rx - 2} ${top + 4} Q50 ${top - 6} ${50 + rx + 2} ${top + 2} M${50 - rx} ${top + 8} Q50 ${top} ${50 + rx} ${top + 7}" stroke="#b8ae94" stroke-width="1.4" fill="none"/>`;
    if (hd === 'helm') s += `<path d="M${50 - rx - 2} 40 Q${50 - rx - 2} ${top - 8} 50 ${top - 12} Q${50 + rx + 2} ${top - 8} ${50 + rx + 2} 40 Z" fill="#8a8e94" ${st}/><path d="M50 40 v12" stroke="#6a6e74" stroke-width="3"/>`;
    if (hd === 'wrap') s += `<path d="M${50 - rx - 2} 46 Q${50 - rx - 3} ${top - 4} 50 ${top - 4} Q${50 + rx + 3} ${top - 4} ${50 + rx + 2} 46 Q50 34 ${50 - rx - 2} 46 Z" fill="${L.hatHex || '#3a3228'}" ${st}/><path d="M${50 - rx} 50 Q50 58 ${50 + rx} 50 L${50 + rx} 60 Q50 66 ${50 - rx} 60 Z" fill="${L.hatHex || '#3a3228'}" ${st}/>`;
    s += `<rect x="1" y="1" width="98" height="98" fill="none" stroke="#c9a24a" stroke-width="2"/></svg>`;
    return s;
  }

  // ---------------- the 3D figure ----------------
  const matC = {}; const MAT = hex => matC[hex] || (matC[hex] = new THREE.MeshLambertMaterial({ color: new THREE.Color(hex) }));
  let G = null;
  function geos() { if (G) return G; G = { box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(1, 1, 1, 10), cone: new THREE.ConeGeometry(1, 1, 10), sph: new THREE.SphereGeometry(1, 12, 9), hemi: new THREE.SphereGeometry(1, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2) }; return G; }
  function mesh(par, geo, hex, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) { const m = new THREE.Mesh(geos()[geo], MAT(hex)); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz); m.castShadow = true; par.add(m); return m; }
  function cylTB(par, hex, y0, y1, r0, r1, sx = 1, sz = 1) { const g = new THREE.CylinderGeometry(r1, r0, y1 - y0, 12); const m = new THREE.Mesh(g, MAT(hex)); m.position.y = (y0 + y1) / 2; m.scale.set(sx, 1, sz); m.castShadow = true; par.add(m); return m; }
  function makeFigure(L, o = {}) {
    const O = OUTFITS[L.outfit || 0]; const robe = L.robe || O.main, trim = L.trim || O.trim, hose = L.hose || O.hose;
    const sk = L.skinHex || SKIN[L.skin || 0], hc = L.hairHex || HAIRC[L.hairC || 0]; const bw = [0.88, 1, 1.14][L.body ?? 1]; const fem = L.gender === 'f';
    const g = new THREE.Group(); const long = fem || O.long || L.long;
    // legs pivot at the hip, so the journey's animate() can swing them
    const legs = []; for (const sx of [-1, 1]) { const p = new THREE.Group(); p.position.set(sx * .1 * bw, .9, 0); mesh(p, 'box', hose, 0, -.45, 0, .15, .9, .17); mesh(p, 'box', '#2a1c12', 0, -.86, .04, .16, .09, .26); g.add(p); legs.push(p); }
    cylTB(g, robe, long ? .1 : .5, .98, long ? .34 * bw : .27 * bw, .21 * bw, 1, .8);
    cylTB(g, robe, .96, 1.47, .22 * bw, .2 * bw * (fem ? .92 : 1.06), 1, .74);
    cylTB(g, trim, .93, 1.0, .225 * bw, .225 * bw, 1, .76);
    if (long) cylTB(g, trim, .1, .16, .345 * bw, .34 * bw, 1, .8);
    if (O.cloak && !L.robe) { const c = L.cloakHex || bannerHex(L); mesh(g, 'box', c, 0, 1.0, -.17 * bw, .5 * bw, .95, .06, .06); mesh(g, 'sph', '#c8a03a', 0, 1.42, .14, .03, .03, .03); }
    const arms = []; for (const sx of [-1, 1]) { const p = new THREE.Group(); p.position.set(sx * .27 * bw, 1.43, 0); mesh(p, 'box', robe, 0, -.27, 0, .11, .56, .13, 0, 0, -sx * .07); mesh(p, 'sph', sk, sx * -.02, -.58, 0, .055, .06, .055); g.add(p); arms.push(p); }
    mesh(g, 'cyl', sk, 0, 1.52, 0, .06, .1, .06);
    const fs = [[1, 1.1, .98], [1.08, 1.02, 1.04], [.94, 1.2, .96], [1, 1.1, .92]][L.face || 0];
    const head = new THREE.Group(); head.position.y = 1.64; g.add(head);
    mesh(head, 'sph', sk, 0, 0, 0, .118 * fs[0], .125 * fs[1], .122 * fs[2]);
    for (const sx of [-1, 1]) { mesh(head, 'box', '#1a1410', sx * .042, .02, .112, .025, .018, .01); mesh(head, 'box', hc, sx * .042, .05, .112, .04, .01, .01); }
    mesh(head, 'box', sk, 0, -.01, .125, .022, .045, .03);
    if (L.scar) mesh(head, 'box', '#8a3a2a', L.scar === 2 ? .04 : .06, L.scar === 2 ? .06 : -.03, .105, .008, .05, .01, 0, 0, .5);
    const f = L.facial || 0;
    if (f === 2) mesh(head, 'sph', hc, 0, -.07, .06, .1, .07, .08);
    if (f === 3) mesh(head, 'sph', hc, 0, -.08, .05, .11, .11, .09);
    if (f === 4 || f >= 2) mesh(head, 'box', hc, 0, -.035, .118, .07, .016, .02);
    if (f === 1) mesh(head, 'sph', hc, 0, -.06, .05, .112, .07, .08).material = MAT(hc);
    const hd = L.headOverride || ['', 'beretta', 'coif', 'hood', 'straw', 'veil'][L.head || 0]; const H = L.hair || 0;
    const hidden = hd === 'hood' || hd === 'veil' || hd === 'helm' || hd === 'turban';
    if (!hidden && H !== 4) { mesh(head, 'hemi', hc, 0, .015, -.008, .128 * fs[0], .13 * fs[1], .13 * fs[2]); if (H === 1) mesh(head, 'box', hc, 0, -.04, -.04, .25 * fs[0], .1, .17); if (H === 2) mesh(head, 'box', hc, 0, -.1, -.07, .24, .24, .08); if (H === 3) { mesh(head, 'box', hc, 0, -.08, -.08, .2, .2, .07); mesh(head, 'cyl', hc, 0, -.3, -.11, .03, .3, .03); } }
    if (H === 4 && !hidden) mesh(head, 'hemi', hc, 0, .02, -.005, .121 * fs[0], .124 * fs[1], .124 * fs[2]).material = MAT(sk);
    if (hd === 'beretta') { mesh(head, 'cyl', L.hatHex || '#a8302a', 0, .1, -.01, .14, .07, .14); }
    if (hd === 'coif') mesh(head, 'hemi', L.hatHex || '#ece4d0', 0, .0, -.005, .135, .15, .14);
    if (hd === 'hood' || hd === 'veil') { const c = hd === 'veil' ? '#ece4d0' : L.hoodHex || '#4a3a2a'; mesh(head, 'hemi', c, 0, -.01, -.01, .15, .16, .155); mesh(head, 'box', c, 0, -.13, -.07, .3, .2, .14); }
    if (hd === 'straw') { mesh(head, 'cyl', '#d8b868', 0, .06, 0, .26, .015, .26); mesh(head, 'cone', '#d8b868', 0, .13, 0, .12, .12, .12); }
    if (hd === 'turban') { mesh(head, 'sph', L.hatHex || '#f0ece0', 0, .07, 0, .15, .1, .15); mesh(head, 'sph', L.hatHex || '#f0ece0', 0, .13, 0, .1, .07, .1); }
    if (hd === 'helm') { mesh(head, 'cone', '#8a8e94', 0, .14, 0, .14, .2, .14); mesh(head, 'hemi', '#8a8e94', 0, .02, 0, .135, .13, .135); }
    if (hd === 'wrap') mesh(head, 'hemi', L.hatHex || '#3a3228', 0, .0, -.005, .135, .15, .14);
    if (o.weapon === 'sword') mesh(arms[1], 'box', '#c8ccd0', .02, -.85, .2, .04, .04, .7, 1.2);
    if (o.weapon === 'crossbow') { mesh(arms[1], 'box', '#5a3a24', 0, -.62, .2, .05, .05, .55, Math.PI / 2); mesh(arms[1], 'box', '#3a2a1a', 0, -.62, .4, .45, .03, .04); }
    g.userData = { legs, arms, head, phase: Math.random() * 6, kind: 'person' };
    return g;
  }
  function makeBanner(L, h = 2.6) { // a pole with your colours and mark
    const g = new THREE.Group(); mesh(g, 'cyl', '#5a3a24', 0, h / 2, 0, .025, h, .025); mesh(g, 'sph', '#c8a03a', 0, h + .03, 0, .05, .05, .05);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(.62, .78), new THREE.MeshLambertMaterial({ map: bannerTexture(L), side: THREE.DoubleSide })); fl.position.set(.34, h - .44, 0); g.add(fl); g.userData.flag = fl; return g;
  }

  // ---------------- the screen ----------------
  const css = `
  #cc { position:fixed; inset:0; z-index:60; display:none; background:radial-gradient(ellipse at 30% 40%, #3a2818, #160e08 75%); color:#f3e7cc; font-family:"EB Garamond", Georgia, serif; }
  #cc.show { display:flex; }
  #cc .cc-l { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; min-width:0; position:relative; }
  #cc .cc-title { position:absolute; left:26px; top:18px; } #cc .cc-title b { display:block; font-family:Cinzel, serif; font-size:26px; letter-spacing:.12em; color:#f0d48a; } #cc .cc-title span { font-style:italic; opacity:.85; font-size:16px; }
  #cc-prev { width:min(380px, 40vw); height:min(520px, 62vh); cursor:grab; display:block; }
  #cc .cc-name { font-family:Cinzel, serif; font-size:24px; letter-spacing:.06em; color:#f0d48a; margin-top:4px; text-align:center; }
  #cc .cc-sub { font-style:italic; opacity:.85; text-align:center; max-width:440px; font-size:15px; margin-top:3px; }
  #cc .cc-badges { display:flex; gap:14px; align-items:center; margin-top:10px; } #cc .cc-badges svg { display:block; border:2px solid #8a6a3a; box-shadow:0 3px 12px #0008; } #cc .cc-badges .mark { border:none; box-shadow:none; background:#f4e8cc; border-radius:50%; }
  #cc .cc-r { width:min(470px, 44vw); background:linear-gradient(#f4e8cc, #e8d6ae); color:#2e1e10; border-left:2px solid #8a6a3a; box-shadow:-10px 0 40px #000a; display:flex; flex-direction:column; }
  #cc .cc-bd { flex:1; overflow:auto; padding:12px 18px 8px; }
  #cc h4 { font-family:Cinzel, serif; font-size:13px; letter-spacing:.12em; color:#7a4a1a; margin:12px 0 5px; border-bottom:1px solid #c9ad78; padding-bottom:2px; text-transform:uppercase; } #cc h4:first-child { margin-top:2px; }
  #cc .row { display:flex; align-items:center; gap:8px; margin:4px 0; } #cc .row > label { width:112px; flex:none; font-weight:600; font-size:15px; }
  #cc .step { display:flex; align-items:center; gap:6px; flex:1; } #cc .step span { flex:1; text-align:center; font-size:15px; background:#fbf3df; border:1px solid #c9ad78; padding:3px 6px; border-radius:2px; }
  #cc button.ar { width:28px; height:28px; border:1px solid #6b4a2e; background:#f8eed6; color:#4a2410; cursor:pointer; border-radius:2px; font-size:14px; padding:0; }
  #cc button.ar:hover, #cc .seg button:hover { background:#fff; }
  #cc .seg { display:flex; gap:4px; } #cc .seg button { font:15px Georgia, serif; padding:4px 14px; border:1px solid #6b4a2e; background:#f8eed6; color:#4a2410; cursor:pointer; border-radius:2px; } #cc .seg button.on { background:#7a1f12; color:#fff3dc; border-color:#5a1008; }
  #cc input[type=text] { font:16px Georgia, serif; padding:4px 8px; border:1px solid #8a6a3a; background:#fffaf0; color:#2e1e10; width:100%; box-sizing:border-box; }
  #cc .sw { display:flex; gap:5px; flex-wrap:wrap; } #cc .sw i { width:24px; height:24px; border-radius:50%; border:2px solid #6b4a2e; cursor:pointer; display:block; } #cc .sw i.on { box-shadow:0 0 0 2px #f4e8cc, 0 0 0 4px #7a1f12; }
  #cc .note { font-style:italic; font-size:14px; opacity:.8; margin:2px 0 6px; }
  #cc .chap { display:flex; flex-wrap:wrap; gap:5px; } #cc .chap button { font:13px Cinzel, serif; padding:5px 9px; cursor:pointer; border:1px solid #6b4a2e; background:#f8eed6; color:#4a2410; border-radius:3px; }
  #cc .cc-ft { display:flex; gap:8px; padding:11px 16px; border-top:1px solid #b89a62; flex-wrap:wrap; }
  #cc .cc-ft button { flex:1; font-family:Cinzel, serif; font-size:14px; letter-spacing:.06em; padding:10px 6px; cursor:pointer; border-radius:3px; border:1px solid #2e1c10; background:linear-gradient(#6b4a2e, #4a3020); color:#f3e7cc; }
  #cc #cc-go { background:linear-gradient(#b23a1e, #8a2a14); color:#fff3dc; flex:1.4; }
  `;
  const stEl = document.createElement('style'); stEl.textContent = css; document.head.appendChild(stEl);
  const root = document.createElement('div'); root.id = 'cc'; document.body.appendChild(root);
  root.innerHTML = `<div class="cc-l"><div class="cc-title"><b>The Apprentice</b><span>Spring 1272 · Ser Matteo Corner's apprentice, about twenty years old</span></div><canvas id="cc-prev"></canvas><div class="cc-name"></div><div class="cc-sub">A young Venetian, apprenticed to Ser Matteo Corner, merchant of Venice and master of the Scuola di San Marco. You sail east with him to Acre.</div><div class="cc-badges"></div></div><div class="cc-r"><div class="cc-bd"></div><div class="cc-ft"></div></div>`;
  let look = randomLook(), onPick = null, rr = null, rScene, rCam, fig = null, ban = null, spin = 0, dragX = null, raf = 0;
  function preview() {
    const cv = document.getElementById('cc-prev'); if (!window.THREE) return;
    if (!rr) {
      try { rr = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); } catch (e) { rr = null; return; }
      rr.outputColorSpace = THREE.SRGBColorSpace; rScene = new THREE.Scene(); rCam = new THREE.PerspectiveCamera(30, 1, .1, 50);
      rScene.add(new THREE.HemisphereLight(0xfff0d8, 0x5a3a22, 2.0)); const d = new THREE.DirectionalLight(0xffe2b0, 2.2); d.position.set(2, 4, 3); rScene.add(d);
      const fl = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, .08, 32), new THREE.MeshLambertMaterial({ color: 0x6a4a2e })); fl.position.y = -.04; rScene.add(fl);
      cv.addEventListener('pointerdown', e => { dragX = e.clientX; cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing'; });
      cv.addEventListener('pointermove', e => { if (dragX === null) return; spin += (e.clientX - dragX) * .012; dragX = e.clientX; });
      cv.addEventListener('pointerup', () => { dragX = null; cv.style.cursor = 'grab'; });
    }
    if (fig) rScene.remove(fig); if (ban) rScene.remove(ban);
    fig = makeFigure(look); rScene.add(fig); ban = makeBanner(look, 2.3); ban.position.set(-.62, 0, -.2); rScene.add(ban);
  }
  function loop() {
    if (!root.classList.contains('show')) { raf = 0; return; } raf = requestAnimationFrame(loop); if (!rr) return;
    const cv = rr.domElement; const w = cv.clientWidth, h = cv.clientHeight; if (cv.width !== Math.round(w * devicePixelRatio) || cv.height !== Math.round(h * devicePixelRatio)) { rr.setPixelRatio(devicePixelRatio); rr.setSize(w, h, false); rCam.aspect = w / h; rCam.updateProjectionMatrix(); }
    if (dragX === null) spin += .006; if (fig) fig.rotation.y = spin; if (ban) { ban.rotation.y = spin; ban.position.set(Math.cos(spin) * -.62 + Math.sin(spin) * -.2, 0, -Math.sin(spin) * -.62 + Math.cos(spin) * -.2); if (ban.userData.flag) ban.userData.flag.rotation.y = Math.sin(performance.now() / 700) * .25; }
    rCam.position.set(0, 1.25, 4.9); rCam.lookAt(0, 1.05, 0); rr.render(rScene, rCam);
  }
  const chapters = () => { try { return JSON.parse(localStorage.getItem('silkroad_chapters_v2') || '{}'); } catch (e) { return {}; } };
  const CH_NAMES = { 1: 'The Apprentice', 2: 'The Ring', 3: 'The Broker', 4: 'The Ransom' };
  function stepper(k, list, label) { const n = list.length; const v = look[k] || 0; return `<div class="row"><label>${label}</label><div class="step"><button class="ar" data-a="dec" data-k="${k}" data-n="${n}">◀</button><span>${list[v]}</span><button class="ar" data-a="inc" data-k="${k}" data-n="${n}">▶</button></div></div>`; }
  function sw(k, cols, label) { return `<div class="row"><label>${label}</label><div class="sw">${cols.map((c, i) => `<i data-a="set" data-k="${k}" data-v="${i}" class="${(look[k] || 0) === i ? 'on' : ''}" style="background:${c}" title="${c}"></i>`).join('')}</div></div>`; }
  function render() {
    const L = look; root.querySelector('.cc-name').textContent = `${L.first || '…'} ${L.last || ''}`;
    root.querySelector('.cc-badges').innerHTML = portrait(L, 92) + markSVG(L, 70) + sealSVG(L, 58);
    const bd = root.querySelector('.cc-bd'); const sc = bd.scrollTop;
    bd.innerHTML = `<h4>Who you are</h4><div class="row"><label>You are</label><div class="seg">${OPTS.gender.map(([v, n]) => `<button data-a="gender" data-v="${v}" class="${L.gender === v ? 'on' : ''}">${n}</button>`).join('')}</div></div>
      <div class="row"><label>First name</label><input type="text" id="cc-first" maxlength="18" value="${(L.first || '').replace(/"/g, '')}"></div>
      <div class="row"><label>Family name</label><input type="text" id="cc-last" maxlength="18" value="${(L.last || '').replace(/"/g, '')}"></div>
      <div class="row"><label></label><button class="ar" style="width:auto;padding:0 12px" data-a="rname">Randomize the name</button></div>
      <p class="note">The story is the same whoever you are: about twenty, Venetian, and Matteo's apprentice.</p>
      <h4>Dress and build</h4>${stepper('outfit', OUTFITS.map(o => o.name), 'Clothes')}${stepper('body', OPTS.body, 'Build')}
      <h4>Face</h4>${sw('skin', SKIN, 'Skin')}${stepper('face', OPTS.face, 'Face')}${stepper('hair', OPTS.hair, 'Hair')}${sw('hairC', HAIRC, 'Hair colour')}
      ${stepper('facial', OPTS.facial, 'Facial hair')}${stepper('head', OPTS.head, 'Headwear')}${stepper('scar', OPTS.scar, 'Scar')}
      <h4>Your merchant's mark</h4><p class="note">Stamped on your bales, flown on your caravan's banner and pressed into your seal.</p>${stepper('markTop', OPTS.markTop, 'Head')}${stepper('markFoot', OPTS.markFoot, 'Foot')}
      <div class="row"><label>Initials</label><div class="seg"><button data-a="set" data-k="markInit" data-v="1" class="${L.markInit ? 'on' : ''}">With</button><button data-a="set" data-k="markInit" data-v="0" class="${L.markInit ? '' : 'on'}">Without</button></div></div>
      <h4>Your colours</h4>${sw('banner', BANNERS.map(b => b[1]), 'Banner and cloak')}
      ${Object.keys(chapters()).length ? `<h4>Replay a chapter</h4><p class="note">Every chapter you reach is saved, with the apprentice you played.</p><div class="chap">${Object.keys(chapters()).sort().map(n => { let nmz = ''; try { const h = JSON.parse(chapters()[n]).hero; nmz = h ? ` · ${h.first}` : ''; } catch (e) { } return `<button data-a="chapter" data-n="${n}">Chapter ${['', 'I', 'II', 'III', 'IV'][n]}: ${CH_NAMES[n]}${nmz}</button>`; }).join('')}</div>` : ''}`;
    bd.scrollTop = sc;
    root.querySelector('.cc-ft').innerHTML = `<button data-a="back">Back</button><button data-a="rall">Randomize all</button><button data-a="open" title="No story: start in Constantinople with everything open">Open journey</button><button id="cc-go" data-a="go">Begin the story</button>`;
    const fi = document.getElementById('cc-first'), la = document.getElementById('cc-last');
    fi.oninput = () => { look.first = fi.value.trim(); root.querySelector('.cc-name').textContent = `${look.first} ${look.last}`; badges(); };
    la.oninput = () => { look.last = la.value.trim(); root.querySelector('.cc-name').textContent = `${look.first} ${look.last}`; badges(); };
  }
  function badges() { root.querySelector('.cc-badges').innerHTML = portrait(look, 92) + markSVG(look, 70) + sealSVG(look, 58); }
  const done = o => { if (!look.first) look.first = pick(NAMES[look.gender]); if (!look.last) look.last = pick(NAMES.last); root.classList.remove('show'); const f = onPick; onPick = null; f && f('venetian', Object.assign({ hero: JSON.parse(JSON.stringify(look)) }, o)); };
  root.addEventListener('click', e => {
    const t = e.target.closest('[data-a]'); if (!t) return; const d = t.dataset; let redraw = true;
    switch (d.a) {
      case 'gender': if (look.gender !== d.v) { look.gender = d.v; if (NAMES[d.v === 'm' ? 'f' : 'm'].includes(look.first)) look.first = pick(NAMES[d.v]); if (d.v === 'f') look.facial = 0; } break;
      case 'rname': randomName(look); break;
      case 'inc': look[d.k] = ((look[d.k] || 0) + 1) % +d.n; break;
      case 'dec': look[d.k] = ((look[d.k] || 0) - 1 + +d.n) % +d.n; break;
      case 'set': look[d.k] = +d.v; break;
      case 'rall': look = randomLook(); break;
      case 'back': root.classList.remove('show'); return;
      case 'go': done({ mode: 'story' }); return;
      case 'open': done({ mode: 'open' }); return;
      case 'chapter': { root.classList.remove('show'); const f = onPick; onPick = null; f && f('venetian', { mode: 'story', chapter: +d.n }); return; }
      default: redraw = false;
    }
    if (redraw) { render(); preview(); }
  });
  window.openCharCreate = cb => { onPick = cb; root.classList.add('show'); render(); preview(); if (!raf) loop(); };
  window.openCharSel = window.openCharCreate; // the title screen's Journey button
  window.HERO = { SKIN, HAIRC, BANNERS, OUTFITS, OPTS, NAMES, randomLook, portrait, markSVG, sealSVG, markPath, drawMark, bannerTexture, makeFigure, makeBanner, bannerHex, set look(v) { look = v; } };
})();
