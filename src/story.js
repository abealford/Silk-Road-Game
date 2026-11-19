// ============================================================
//  v21: THE STORY — dialogue, NPCs, cutscenes and the two scripted fights
// ============================================================
// Chapters and objectives live in journey.js (ACTS). This module plays the scenes between them:
// the opening galley, Matteo at your side in Chapter I, the night camp on the Aleppo road and the
// riders at dawn (COMBAT A), Bartolomeo Ghisi in Constantinople, Bahram in Tabriz, the Compagna's
// house in Delhi (COMBAT B) and Matteo's death. Script: claude/silk-road-story-chapters.md.
(() => {
  const H = window.HOOKS; const $ = id => document.getElementById(id);
  const J = () => H.J; const S = () => (H.J && H.J.MODE === 'journey') ? H.J.S : null;
  const fmt = n => Math.round(n).toLocaleString('en-US');

  // ---------------- icons for the story's items ----------------
  if (typeof ICONS !== 'undefined' && ICONS.I) {
    const st = ICONS.T.st;
    ICONS.I.matteoring = () => `<circle cx="24" cy="27" r="10" fill="none" stroke="#c9a24a" stroke-width="4"/><rect x="18" y="11" width="12" height="9" rx="2" fill="#c9a24a" ${st}/><path d="M21 16 l3 -3 l3 3" stroke="#7a1f12" stroke-width="1.6" fill="none"/>`;
    ICONS.I.griffinletter = () => `<rect x="12" y="14" width="24" height="22" rx="2" fill="#f0e6c8" ${st}/><path d="M16 20 h16 M16 24 h16 M16 28 h10" stroke="#6a4a2a" stroke-width="1"/><circle cx="31" cy="32" r="4.5" fill="#2a2a30" ${st}/><path d="M29 32 l2 -2 l2 2" stroke="#c9a24a" stroke-width="1"/>`;
  }

  // ---------------- the cast ----------------
  const LOOK = {
    matteo: { gender: 'm', robe: '#7a1f2a', trim: '#c8a03a', hose: '#2a1e1a', body: 1, skinHex: '#e2b48e', face: 3, hair: 0, hairHex: '#9a948c', facial: 2, head: 1, hatHex: '#a8302a' },
    bartolomeo: { gender: 'm', robe: '#22262e', trim: '#8a7a5a', hose: '#1a1a1e', body: 0, skin: 1, face: 2, hair: 0, hairHex: '#5a4a3a', facial: 0, head: 2, hatHex: '#2a2a2a' },
    bahram: { gender: 'm', robe: '#2a6a6a', trim: '#e8d8a0', hose: '#3a2a1e', body: 2, skin: 3, face: 1, hair: 0, hairC: 0, facial: 3, headOverride: 'turban', hatHex: '#f0e6d0', long: true },
    oberto: { gender: 'm', robe: '#a8201a', trim: '#f0ece0', hose: '#e8e0d0', body: 1, skin: 1, face: 0, hair: 1, hairC: 2, facial: 0, head: 1, hatHex: '#1a1a1a' },
    tyrian: { gender: 'm', robe: '#2a2a30', trim: '#5a4a3a', hose: '#1a1a1e', body: 2, skin: 2, face: 3, hair: 0, hairC: 0, facial: 1, scar: 1, scarHand: true, headOverride: 'wrap', hatHex: '#3a3430' },
    guard: { gender: 'm', robe: '#a8201a', trim: '#e8e0d0', hose: '#3a2a1e', body: 2, skin: 2, face: 3, hair: 0, hairC: 1, facial: 4, headOverride: 'helm' },
    rider1: { gender: 'm', robe: '#3a3228', trim: '#6a5a40', body: 2, skin: 3, face: 3, facial: 3, hairC: 0, headOverride: 'wrap', hatHex: '#4a3a2a' },
    rider2: { gender: 'm', robe: '#4a3a2a', trim: '#2a2622', body: 1, skin: 2, face: 2, facial: 1, hairC: 1, scar: 2, headOverride: 'wrap', hatHex: '#2a2622' },
    merchant: { gender: 'm', robe: '#e8e0cc', trim: '#8a6a3a', body: 2, skin: 3, face: 1, facial: 3, hairC: 0, headOverride: 'turban', hatHex: '#f0ece0', long: true },
  };
  const WHO = {
    Matteo: ['Ser Matteo Corner', 'matteo', '#3a5a7a'], Bartolomeo: ['Ser Bartolomeo Ghisi', 'bartolomeo', '#4a3a5a'], Bahram: ['Bahram the Broker', 'bahram', '#2a6a5a'],
    Oberto: ['Oberto Spinola', 'oberto', '#8a2a1a'], Tyrian: ['The Tyrian', 'tyrian', '#2a2a30'], Guard: ['Genoese guard', 'guard', '#8a2a1a'],
    Rider1: ['First rider', 'rider1', '#5a4a3a'], Rider2: ['Second rider', 'rider2', '#5a4a3a'], Merchant: ['The merchant of Acre', 'merchant', '#8a6a3a'],
  };

  // ---------------- the dialogue box ----------------
  const css = `
  #dlg { position:fixed; left:50%; bottom:26px; transform:translateX(-50%); width:min(780px, 94vw); z-index:48; display:none; background:linear-gradient(#f6ecd2f2, #ead8b0f2); color:#2e1e10; border:2px solid #8a6a3a; box-shadow:0 10px 36px #000a; font:17px/1.42 "EB Garamond", Georgia, serif; }
  #dlg.show { display:flex; } #dlg .pt { flex:none; padding:12px 0 12px 12px; } #dlg .pt svg { display:block; border:2px solid #8a6a3a; }
  #dlg .bd { flex:1; padding:10px 18px 12px; min-width:0; } #dlg .sp { font:600 14px Cinzel, serif; letter-spacing:.1em; color:#7a1f12; text-transform:uppercase; margin-bottom:3px; }
  #dlg .tx { min-height:48px; } #dlg .tx i { color:#5a3a22; } #dlg .ch { display:flex; flex-direction:column; gap:5px; margin-top:8px; }
  #dlg .ch button { text-align:left; font:16px Georgia, serif; padding:6px 12px; border:1px solid #6b4a2e; background:#fbf3df; color:#3a2414; cursor:pointer; border-radius:2px; }
  #dlg .ch button:hover { background:#fff; border-color:#7a1f12; } #dlg .ch button.seen { opacity:.62; } #dlg .ch button[disabled] { opacity:.45; cursor:default; } #dlg .ch button b { color:#7a1f12; margin-right:6px; }
  #dlg .nx { margin-top:8px; text-align:right; font-size:14px; } #dlg .nx button { font:15px Cinzel, serif; padding:5px 16px; border:1px solid #2e1c10; background:linear-gradient(#b23a1e, #8a2a14); color:#fff3dc; cursor:pointer; border-radius:2px; }
  #dlg .nx span { opacity:.65; margin-right:10px; font-style:italic; }
  #dlgcard { position:fixed; inset:0; z-index:49; display:none; align-items:center; justify-content:center; text-align:center; color:#f3e7cc; font:21px/1.55 "EB Garamond", Georgia, serif; padding:0 8vw; }
  #dlgcard.show { display:flex; } #dlgcard .in { max-width:760px; } #dlgcard .in .t { font-style:italic; } #dlgcard .in h2 { font:500 30px Cinzel, serif; letter-spacing:.1em; color:#f0d48a; margin:0 0 14px; }
  #dlgcard button { margin-top:24px; font:15px Cinzel, serif; letter-spacing:.08em; padding:8px 22px; border:1px solid #c9a24a; background:transparent; color:#f0d48a; cursor:pointer; } #dlgcard button:hover { background:#c9a24a22; }
  #dlgcard .doc { display:inline-block; text-align:left; background:#f0e2c0; color:#2a1a10; padding:22px 30px; border:1px solid #8a6a3a; box-shadow:0 8px 30px #000c; font-size:19px; transform:rotate(-1deg); }
  #dlgcard .doc .seal { float:right; margin:-6px -10px 6px 14px; } #dlgcard .think { font-style:italic; color:#f8e8c0; font-size:23px; }
  #dlgcard .unl { text-align:left; font-size:17px; display:inline-block; margin:6px 0; } #dlgcard .stats { display:flex; gap:26px; justify-content:center; margin-top:10px; font-size:15px; } #dlgcard .stats b { display:block; font:22px Cinzel, serif; color:#f0d48a; }
  #st-prompt { position:absolute; left:50%; bottom:22%; transform:translateX(-50%); padding:6px 16px; font-size:16px; color:#fff3dc; background:rgba(40,24,12,.78); border-radius:3px; display:none; white-space:nowrap; } #st-prompt.show { display:block; } #st-prompt b { color:#f0d48a; }
  body.st-near .mx-prompt { display:none !important; }
  body.cine #hud > * { visibility:hidden; } body.cine .mx-obj { visibility:hidden; }
  #cine-bars:before, #cine-bars:after { content:''; position:fixed; left:0; right:0; height:9vh; background:#0c0804; z-index:30; transition:transform .6s; } #cine-bars:before { top:0; transform:translateY(-100%); } #cine-bars:after { bottom:0; transform:translateY(100%); }
  body.cine #cine-bars:before, body.cine #cine-bars:after { transform:none; }
  `;
  { const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st); }
  const box = document.createElement('div'); box.id = 'dlg'; box.innerHTML = '<div class="pt"></div><div class="bd"><div class="sp"></div><div class="tx"></div><div class="ch"></div><div class="nx"></div></div>'; document.body.appendChild(box);
  const card = document.createElement('div'); card.id = 'dlgcard'; card.innerHTML = '<div class="in"></div>'; document.body.appendChild(card);
  const bars = document.createElement('div'); bars.id = 'cine-bars'; document.body.appendChild(bars);
  const pr = document.createElement('div'); pr.id = 'st-prompt'; ($('hud') || document.body).appendChild(pr);
  const fade = (on) => $('fade').classList.toggle('show', !!on);
  const tok = t => { const s = S(); const h = s && s.hero || {}; return String(t).replace(/\{FIRST\}/g, h.first || 'apprentice').replace(/\{LAST\}/g, h.last || ''); };
  const wait = ms => next => setTimeout(next, ms);

  // a scene is a list of steps:
  //   ['Matteo', 'line']             a line (speaker key, or 'You' for your own thoughts)
  //   { topics: [{ t, lines }], last: { t, lines } }   topics loop until the last one is picked
  //   { choice: [{ t, lines, if, why, do }] }          pick one, then go on
  //   { do: fn }   { wait: fn(next) }   { card: html }   { fade: true|false }   { note: text } (stage direction)
  let D = null; // the running dialogue
  const isOpen = () => !!D;
  function run(steps, onDone) {
    if (D) { D.queue.push([steps, onDone]); return; }
    D = { steps: steps.slice(), i: 0, onDone, queue: [] }; window.__dlgOpen = true;
    for (const k in H.keys) H.keys[k] = false; if (H.player) H.player.auto = false; if (document.pointerLockElement) document.exitPointerLock(); if (H.setPauseWanted) H.setPauseWanted(false);
    step();
  }
  function end() {
    const d = D; box.classList.remove('show'); card.classList.remove('show'); D = null; window.__dlgOpen = false;
    if (d.queue.length) { const [s, f] = d.queue.shift(); run(s, f); D.queue.push(...d.queue); }
    if (d.onDone) d.onDone();
    if (!D && !window.__combatOn && !CINE) { if (H.setPauseWanted) H.setPauseWanted(true); if (H.tryLock && !(J() && J().ui)) H.tryLock(); }
  }
  function step() {
    if (!D) return; if (D.i >= D.steps.length) return end();
    const s = D.steps[D.i++];
    if (Array.isArray(s)) return line(s[0], s[1]);
    if (s.do) { s.do(); return step(); }
    if (s.wait) { box.classList.remove('show'); return s.wait(step); }
    if (s.fade !== undefined) { box.classList.remove('show'); fade(s.fade); return setTimeout(step, s.ms || 650); }
    if (s.card) return showCard(typeof s.card === 'function' ? s.card() : s.card, s.btn);
    if (s.topics) return topics(s);
    if (s.choice) return choose(s.choice);
    if (s.note) return line(null, `<i>${s.note}</i>`);
    step();
  }
  function portraitFor(who) {
    if (!window.HERO) return '';
    if (who === 'You') { const s = S(); return s && s.hero ? HERO.portrait(s.hero, 92, '#5a4a2a') : ''; }
    const w = WHO[who]; return w ? HERO.portrait(LOOK[w[1]], 92, w[2]) : '';
  }
  function showBox(who, html, ch, next) {
    box.classList.add('show'); card.classList.remove('show');
    box.querySelector('.pt').innerHTML = who ? portraitFor(who) : ''; box.querySelector('.pt').style.display = who ? '' : 'none';
    box.querySelector('.sp').textContent = who === 'You' ? (S() && S().hero ? S().hero.first : 'You') : who ? (WHO[who] ? WHO[who][0] : who) : '';
    box.querySelector('.tx').innerHTML = html; box.querySelector('.ch').innerHTML = ch || '';
    box.querySelector('.nx').innerHTML = next ? `<span>Space or E</span><button data-d="next">Continue ▸</button>` : '';
  }
  function line(who, text) { const q = who && who !== 'You' && !text.startsWith('<i>') ? `“${tok(text)}”` : tok(text); showBox(who, q, '', true); D.wait = 'next'; }
  function topics(s) {
    s._seen = s._seen || {}; const all = s.topics.concat([s.last]);
    const opts = all.map((o, i) => `<button data-d="t" data-i="${i}" class="${s._seen[i] && i < all.length - 1 ? 'seen' : ''}"><b>${i + 1}</b>▸ ${tok(o.t)}</button>`).join('');
    showBox('You', '', opts, false); D.wait = 'choice';
    D.pick = i => { const o = all[i]; s._seen[i] = 1; D.steps.splice(D.i, 0, ...(o.lines || []), ...(i === all.length - 1 ? [] : [s])); step(); };
  }
  function choose(list) {
    const opts = list.map((o, i) => { const ok = !o.if || o.if(); return `<button data-d="t" data-i="${i}" ${ok ? '' : 'disabled'}><b>${i + 1}</b>▸ ${tok(o.t)}${!ok && o.why ? ` <i>(${o.why()})</i>` : ''}</button>`; }).join('');
    showBox('You', '', opts, false); D.wait = 'choice'; D.pick = i => { const o = list[i]; if (o.if && !o.if()) return; D.steps.splice(D.i, 0, ...(o.do ? [{ do: o.do }] : []), ...(o.lines || [])); step(); };
  }
  function showCard(html, btn) { box.classList.remove('show'); card.querySelector('.in').innerHTML = html + `<div><button data-d="next">${btn || 'Continue'}</button></div>`; card.classList.add('show'); D.wait = 'next'; }
  function advanceKey() { if (D && D.wait === 'next') { D.wait = null; step(); } }
  for (const el of [box, card]) el.addEventListener('click', e => { const b = e.target.closest('[data-d]'); if (!b || !D || b.disabled) return; if (b.dataset.d === 'next') advanceKey(); else if (b.dataset.d === 't' && D.wait === 'choice') { D.wait = null; D.pick(+b.dataset.i); } });
  document.addEventListener('keydown', e => {
    if (!D) return; if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (['Space', 'Enter', 'KeyE', 'NumpadEnter'].includes(e.code)) { advanceKey(); }
    else if (/^Digit[1-9]$/.test(e.code) && D.wait === 'choice') { const b = box.querySelector(`.ch button[data-i="${+e.code.slice(5) - 1}"]`); if (b && !b.disabled) { D.wait = null; D.pick(+b.dataset.i); } }
    e.stopPropagation(); e.preventDefault();
  }, true);
  { const of = H.frozen; H.frozen = () => isOpen() || !!CINE || !!(of && of()); const ou = H.uiOpen; H.uiOpen = () => isOpen() || !!CINE || !!(ou && ou()); }
  H.dlgOpen = () => isOpen() || !!CINE;

  // ---------------- cinema: the camera, bars, the world clock ----------------
  let CINE = null; // function(camera, dt)
  let cineT = performance.now();
  H.cineCam = (cam) => { if (!CINE) return; const now = performance.now(); const dt = Math.min(.05, (now - cineT) / 1000); cineT = now; CINE(cam, dt); };
  function cine(on, f) { CINE = on ? (f || (() => { })) : null; cineT = performance.now(); document.body.classList.toggle('cine', !!on); if (!on) { if (H.setPauseWanted) H.setPauseWanted(true); } }
  const objs = []; // temporary scene objects for cutscenes
  function add(o) { H.scene.add(o); objs.push(o); return o; }
  function clearObjs() { for (const o of objs) H.scene.remove(o); objs.length = 0; }
  const gy = (x, z) => H.W.walkHeight(x, z);
  function figure(key, o) { const f = HERO.makeFigure(LOOK[key], o); f.traverse(m => { if (m.isMesh) m.castShadow = true; }); return f; }

  // ---------------- NPCs in the cities ----------------
  // { key, look, label, city, when(), talk(), x, z, obj } placed on a free spot near the square, away from the stalls
  const NPCS = [
    { key: 'tyrianD', look: 'tyrian', city: 'damascus', when: s => s.camp.act === 1 && !s.camp.ev.ambush, mute: true, r: [13, 16, 18, 11] },
    { key: 'bartolomeo', look: 'bartolomeo', label: 'Scuola di San Marco', city: 'constantinople', when: s => s.camp.act === 1 && s.camp.ev.fightA, talk: () => talkBartolomeo(), banner: true },
    { key: 'bahram', look: 'bahram', label: 'Bahram the Broker', city: 'tabriz', when: s => s.camp.act === 2 || s.camp.act === 3, talk: () => talkBahram() },
    { key: 'guard', look: 'guard', label: 'The Compagna\'s house', city: 'delhi', when: s => s.camp.act === 4 && !s.camp.ev.paidRansom, talk: () => talkGuard(), griffin: true },
  ];
  const placed = new Map(); // key -> { obj, x, z, cityId }
  function spotIn(c, avoid, radii) {
    if (!c.occ) return null; const vs = J().vendors(c.id); let best = null;
    const dMain = (x, z) => { let m = 1e9; for (const l of (c.corrLines || [])) for (const p of l) m = Math.min(m, Math.hypot(p[0] - x, p[1] - z)); return m; };
    for (let k = 0; k < 72; k++) for (const r of radii) {
      const a = k / 72 * Math.PI * 2 + .04; const x = Math.cos(a) * r, z = Math.sin(a) * r; if (r > c.R - 4) continue;
      if (c.occ.get(x, z) === 2 || c.occ.get(x * 1.08, z * 1.08) === 2 || c.occ.get(x + .9, z) === 2 || c.occ.get(x - .9, z) === 2 || c.occ.get(x, z + .9) === 2 || c.occ.get(x, z - .9) === 2) continue;
      const wx = c.x + x, wz = c.z + z; let sep = 1e9; for (const v of vs) sep = Math.min(sep, Math.hypot(v.x - wx, v.z - wz)); for (const p of avoid) sep = Math.min(sep, Math.hypot(p[0] - wx, p[1] - wz));
      if (sep < 4.5) continue; const dm = dMain(x, z); if (dm < 3) continue;
      const sc = Math.min(sep, 8) - r * .15 + Math.min(dm, 5) * .5; if (!best || sc > best.sc) best = { x: wx, z: wz, sc };
    }
    return best;
  }
  function placeNPCs() {
    const s = S(); const c = H.getCity && H.getCity();
    for (const [k, p] of placed) { const n = NPCS.find(n => n.key === k); if (!s || !s.camp || !c || c.id !== p.cityId || !n.when(s)) { H.scene.remove(p.obj); placed.delete(k); } }
    if (!s || !s.camp || !c || !c.occ) return;
    for (const n of NPCS) {
      if (n.city !== c.id || placed.has(n.key) || !n.when(s)) continue; if (!J().vendors(c.id).length) continue;
      const sp = spotIn(c, [...placed.values()].map(p => [p.x, p.z]), n.r || [9, 11, 12.5, 14, 16, 7]); if (!sp) continue;
      const g = new THREE.Group(); g.position.set(sp.x, c.h, sp.z); const f = figure(n.look, n.key === 'guard' ? { weapon: 'sword' } : {}); g.add(f); f.rotation.y = Math.atan2(c.x - sp.x, c.z - sp.z);
      if (n.label) { const l = J().textSprite(n.label); l.position.set(0, 3.0, 0); g.add(l); }
      if (n.banner) { const b = new THREE.Group(); const pole = new THREE.Mesh(new THREE.CylinderGeometry(.04, .05, 3.6, 6), new THREE.MeshLambertMaterial({ color: 0x5a3a24 })); pole.position.y = 1.8; b.add(pole);
        const cv = document.createElement('canvas'); cv.width = 96; cv.height = 128; const x = cv.getContext('2d'); x.fillStyle = '#9a1f1a'; x.fillRect(0, 0, 96, 128); x.fillStyle = '#d8b04a'; x.font = 'bold 64px Georgia, serif'; x.textAlign = 'center'; x.fillText('✠', 48, 80);
        const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; const fl = new THREE.Mesh(new THREE.PlaneGeometry(.9, 1.2), new THREE.MeshLambertMaterial({ map: t, side: THREE.DoubleSide })); fl.position.set(.48, 2.9, 0); b.add(fl); b.position.set(-1.1, 0, -.4); g.add(b); }
      if (n.griffin) { const b = new THREE.Group(); const pole = new THREE.Mesh(new THREE.CylinderGeometry(.04, .05, 3.2, 6), new THREE.MeshLambertMaterial({ color: 0x5a3a24 })); pole.position.y = 1.6; b.add(pole);
        const cv = document.createElement('canvas'); cv.width = 96; cv.height = 96; const x = cv.getContext('2d'); x.fillStyle = '#f0ece0'; x.fillRect(0, 0, 96, 96); x.fillStyle = '#a8201a'; x.fillRect(40, 0, 16, 96); x.fillRect(0, 40, 96, 16); x.fillStyle = '#c9a24a'; x.font = 'bold 34px Georgia, serif'; x.fillText('♞', 6, 34);
        const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; const fl = new THREE.Mesh(new THREE.PlaneGeometry(.8, .8), new THREE.MeshLambertMaterial({ map: t, side: THREE.DoubleSide })); fl.position.set(.44, 2.7, 0); b.add(fl); b.position.set(1.0, 0, -.5); g.add(b);
        const door = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.4, .2), new THREE.MeshLambertMaterial({ color: 0x5a3a22 })); door.position.set(0, 1.2, -1.1); g.add(door); }
      H.scene.add(g); placed.set(n.key, { obj: g, fig: f, x: sp.x, z: sp.z, cityId: c.id });
      if (H.addCollider) H.addCollider({ x: sp.x, z: sp.z, r: .45 });
    }
  }

  // ---------------- Matteo walks with you (Chapter I) ----------------
  let matteo = null; // { obj, x, z, yaw }
  const matteoWith = s => s && s.camp && s.camp.act === 1 && s.camp.ev.cine && !s.camp.ev.ambush;
  function updMatteo(dt) {
    const s = S(); const want = matteoWith(s) && !CINE && !(J().voy);
    if (!want) { if (matteo) { H.scene.remove(matteo.obj); matteo = null; } return; }
    const p = H.player; if (!matteo) { const o = figure('matteo'); H.scene.add(o); matteo = { obj: o, x: p.x + 1.5, z: p.z + 1.5, yaw: 0 }; }
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
    const tx = p.x - fx * 1.9 - rx * 1.2, tz = p.z - fz * 1.9 - rz * 1.2; const dx = tx - matteo.x, dz = tz - matteo.z, d = Math.hypot(dx, dz);
    if (d > 30) { matteo.x = tx; matteo.z = tz; }
    let sp = 0; if (d > .25) { sp = Math.min(d * 3, (H.adm && H.adm.on ? 60 : 14) * (d > 6 ? 2.5 : 1)); const st = Math.min(d, sp * dt); matteo.x += dx / d * st; matteo.z += dz / d * st; matteo.yaw = Math.atan2(dx, dz); }
    else { const lx = p.x - matteo.x, lz = p.z - matteo.z; let w = Math.atan2(lx, lz) - matteo.yaw; w = Math.atan2(Math.sin(w), Math.cos(w)); matteo.yaw += w * Math.min(1, dt * 3); }
    matteo.obj.position.set(matteo.x, gy(matteo.x, matteo.z), matteo.z); matteo.obj.rotation.y = matteo.yaw; J().animate(matteo.obj, sp > .3 ? Math.min(4, sp * .5) : 0, dt);
  }

  // ---------------- talking: who is near, and the E key ----------------
  let nearNPC = null;
  function pendingMatteo(s) { if (!matteoWith(s)) return null; const ev = s.camp.ev; if (!ev.d11) return 'd11'; if (ev.d11 && !ev.d12 && (ev.soldVen || (!s.cargo.muranoglass && !s.cargo.scarlet))) return 'd12'; if (ev.d12 && !ev.d13 && J().inCity('damascus')) return 'd13'; return 'chat'; }
  function findNear() {
    nearNPC = null; const s = S(); if (!s || !s.camp || isOpen() || CINE || (J() && J().ui) || window.__combatOn) return;
    const p = H.player; const c = H.getCity(); const vs = c ? J().vendors(c.id) : []; let vd = 1e9; for (const v of vs) vd = Math.min(vd, Math.hypot(v.x - p.x, v.z - p.z));
    if (matteo) { const d = Math.hypot(matteo.x - p.x, matteo.z - p.z); const pend = pendingMatteo(s); if (d < 3.2 && (pend !== 'chat' ? vd > 2.2 : (d < 2.6 && vd > 3.6))) nearNPC = { kind: 'matteo', d, text: pend === 'chat' ? 'Talk to Matteo' : 'Talk to Matteo' }; }
    for (const [k, pl] of placed) { const n = NPCS.find(n => n.key === k); if (n.mute) continue; const d = Math.hypot(pl.x - p.x, pl.z - p.z); if (d < 3.4 && (!nearNPC || d < nearNPC.d)) nearNPC = { kind: 'npc', n, d, text: k === 'guard' ? 'Knock at the Compagna\'s door' : `Talk to ${WHO[n.look[0].toUpperCase() + n.look.slice(1)] ? WHO[n.look[0].toUpperCase() + n.look.slice(1)][0] : n.label}` }; }
  }
  function updPrompt() { const on = !!nearNPC; pr.innerHTML = on ? `<b>E</b> &nbsp;${nearNPC.text}` : ''; pr.classList.toggle('show', on); document.body.classList.toggle('st-near', on); }
  { const o = H.keydown; H.keydown = function (e) {
    if (isOpen() || CINE) return true;
    if (e.code === 'KeyE' && nearNPC && !(J() && J().ui)) { const n = nearNPC; nearNPC = null; updPrompt(); if (n.kind === 'matteo') talkMatteo(); else n.n.talk(); return true; }
    return o ? o(e) : false; }; }

  // ============================================================
  //  THE SCRIPT
  // ============================================================
  const ev = k => J().ev(k);
  const give = (n) => { const s = S(); s.coins += n; J().hud(); };
  const task = t => ({ card: `<div class="t" style="font-style:normal;font-size:18px;opacity:.9">New task</div><div class="t">${t}</div>`, btn: 'Continue' });

  // ---------- 1.0 The opening cinematic ----------
  function opening(done) {
    const s = S(); const W = H.W; const A = W.cityById.acre; const ax = A.x - 250, az = A.z + 22, bx = A.x - 104, bz = A.z + 6; // out at sea, west of the harbour
    let ship = null, mt = null, t0 = 0; const DUR = 16;
    run([
      { fade: true, ms: 50 },
      { card: '<div class="t">Spring, 1272. Two summers ago Venice and Genoa signed a truce, ending fourteen years of war fought on every sea, and even in the streets of Acre. Neither side believes it will last.<br><br>Ser Matteo Corner, merchant of Venice and master of the Scuola di San Marco, sails east with his apprentice and a hold full of Venetian glass and scarlet cloth. In Acre, the last great harbour of the Crusaders, the roads to the East begin.</div>' },
      { do: () => {
        H.setTime && H.setTime(.975);
        const b = new H.B.Builder(); H.B.ship(b, 'galley'); const m = new THREE.Mesh(b.geometry(), H.objMat); m.castShadow = true; m.scale.setScalar(1.35); ship = add(new THREE.Group()); ship.add(m);
        mt = figure('matteo'); mt.position.set(1.5, 3.0, -5.4); mt.rotation.y = .15; ship.add(mt);
        const head = Math.atan2(bx - ax, bz - az); ship.rotation.y = head; t0 = performance.now();
        const place = (f) => { const x = ax + (bx - ax) * f, z = az + (bz - az) * f; ship.position.set(x, Math.sin(performance.now() / 900) * .12, z); ship.rotation.z = Math.sin(performance.now() / 1300) * .025;
          const sx = Math.sin(head), sz = Math.cos(head); H.player.x = x + sx * -8.6; H.player.z = z + sz * -8.6; };
        place(0); if (H.buildNear) H.buildNear(700); if (H.updateChunks) H.updateChunks();
        cine(true, (cam, dt) => { const f = Math.min(1, (performance.now() - t0) / 1000 / DUR); place(f * (2 - f)); const sx = Math.sin(head), sz = Math.cos(head);
          cam.position.set(ship.position.x + sx * -8.6, ship.position.y + 3.0 + 1.7, ship.position.z + sz * -8.6);
          const ac = W.cityById.acre; cam.lookAt(ac.x * .55 + (ship.position.x + sx * 6) * .45, 4.5, ac.z * .55 + (ship.position.z + sz * 6) * .45); H.setTime && H.setTime(.975 + f * .035); });
      } },
      { fade: false, ms: 2600 },
      ['Matteo', 'There she is. Acre. Smell that? Pepper, tar and trouble, in that order.'],
      ['Matteo', 'Keep your purse close and your mouth closer, {FIRST}. This city has been robbing Venetians for a hundred years, and it\'s very good at it.'],
      { fade: true },
      { do: () => { cine(false); clearObjs(); H.setTime && H.setTime(.06); H.placeAtCity('acre'); const c = H.W.cityById.acre; const p = H.player; p.yaw = Math.atan2(-(c.x - p.x), -(c.z - p.z)); p.pitch = 0; s.camp.ev.cine = 1; J().save(); } },
      { fade: false, ms: 400 },
    ], done);
  }
  H.storyIntro = () => {
    const s = S(); if (!s || !s.camp) return false;
    if (s.camp.act === 1 && !s.camp.ev.cine) { opening(() => J().showStory(1)); return true; }
    return false;
  };

  // ---------- 1.1 – 1.3 Matteo ----------
  function talkMatteo() {
    const s = S(); const p = pendingMatteo(s); const tr = (k) => () => { s.camp.ev[k] = 1; J().campCheck(); J().updateTracker(); J().save(); };
    if (p === 'd11') return run([
      ['Matteo', 'Solid ground at last. Thirty days on that galley, and my knees still think they\'re at sea. Now listen, because Acre will teach you fast or rob you faster.'],
      { topics: [
        { t: 'How does trading work?', lines: [['Matteo', 'Every city has its merchants, and every merchant has his prices. What\'s cheap where it\'s made is dear where it isn\'t. That\'s the whole secret of our trade, and the whole reason men walk to the ends of the earth.'], ['Matteo', 'Buy where a thing is common, sell where it\'s rare. And don\'t flood one market: no merchant pays full price for his fifth bale of the same cloth. Spread your goods around.']] },
        { t: 'What do we need for the road?', lines: [['Matteo', 'Food for us. Water for the dry stretches. Fodder, once we have animals to feed. Run out of water in the desert, and all the silk in Cathay won\'t buy you a cup.'], ['Matteo', 'Buy supplies in every city. It costs less than a funeral.']] },
        { t: 'Is the road dangerous?', lines: [['Matteo', 'Bandits on the roads, toll-men at the gates, and princes who start wars without asking our leave. Listen to the talk in the bazaar: when a war closes a road, the news gets to the market before the soldiers do.'], ['Matteo', 'And if you ever see riders coming fast at night, don\'t wait to ask their business.']] },
      ], last: { t: 'I\'m ready.', lines: [['Matteo', 'Good. Then here\'s your first lesson in earnest. The goods we brought, the glass and the cloth: sell them to the merchant in the square. He\'ll swear by every saint in Outremer that he\'s paying too much. He isn\'t.']] } },
      { do: tr('d11') }, task('Sell the Venetian goods in Acre\'s market.'),
    ]);
    if (p === 'd12') return run([
      ['Matteo', 'Let me see that purse… Ha! That\'s a fine profit. Either you\'re a natural, or that man\'s a fool. Silver\'s silver either way.'],
      ['Matteo', 'Now, a Venetian never travels empty. An empty caravan is a wasted journey. Buy something that\'s cheap here and will be dear farther north. And take a contract.'],
      { topics: [
        { t: 'What\'s a contract?', lines: [['Matteo', 'A merchant in one city needs goods carried to another. He pays you when you deliver, on top of anything you make trading along the way. The contract board in the square lists them.'], ['Matteo', 'Mind the terms. Deliver late, or not at all, and you\'re paid nothing and talked about in every market on the road. A good name is worth more than one contract.']] },
        { t: 'Which one should I take?', lines: [['Matteo', 'There\'s one for Aleppo. It\'s on our road, so take it. We\'ll go by way of Damascus. I have an old friend there who owes me money, which makes him a very good friend indeed.']] },
      ], last: { t: 'Let\'s go.', lines: [['Matteo', 'Buy your goods, take the Aleppo contract, and we ride for Damascus.']] } },
      { do: tr('d12') }, task('Buy goods to sell later. Accept the contract to Aleppo. Travel to Damascus.'),
    ]);
    if (p === 'd13') return run(scene13(tr));
    // small talk on the way
    const ev2 = s.camp.ev; const c = H.getCity();
    const say = !ev2.contract && ev2.d12 ? 'The Aleppo contract, {FIRST}. It\'s on the merchant\'s board, and it\'s on our road.' : !ev2.bought && ev2.d12 ? 'Buy something light and cheap here. Constantinople will pay for it.' : s.food < 6 ? 'We\'re nearly out of food. Press R in town and buy some, unless you fancy eating your boots.' : !s.visited.includes('damascus') ? 'Damascus is north-east, over the hills. The road\'s good, and the company\'s better.' : c && c.id === 'damascus' ? 'Let\'s be about our business, and away north to Aleppo.' : 'North to Aleppo. Keep your eyes open on the road.';
    run([['Matteo', say]]);
  }
  function scene13(tr) { return [
    { note: 'Matteo, quietly:' },
    ['Matteo', 'Don\'t look now. The man by the fountain, the one with the scarred hand. He was on the quay at Acre too.'],
    { topics: [
      { t: 'Who is he?', lines: [['Matteo', 'Tyre men, if I\'m any judge. Since we threw the Genoese out of Acre, they\'ve nested in Tyre like gulls, and they\'ll hire anyone who can swing a sword. That one has Genoese silver in his purse. I\'d bet my beard on it.']] },
      { t: 'Should we be worried?', lines: [['Matteo', 'The truce says no Genoese may lift a hand against a Venetian. The truce says a great many things.']] },
    ], last: { t: 'What do we do?', lines: [['Matteo', 'We do our business quickly and quietly, and we\'re on the Aleppo road before he finishes his wine.']] } },
    { do: tr('d13') }, task('Trade in Damascus if you wish, then set out for Aleppo.'),
  ]; }

  // ---------- 1.4 The ambush, 1.5 the riders, COMBAT A ----------
  function ambush() {
    const s = S(); const p = H.player; const W = H.W; s.camp.ev.ambushing = 1;
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
    const cx = p.x + rx * .3 + fx * 1.7, cz = p.z + rz * .3 + fz * 1.7; let fireL = null, mt = null;
    run([
      { fade: true },
      { do: () => {
        H.setTime && H.setTime(.79); if (matteo) { H.scene.remove(matteo.obj); matteo = null; }
        const fire = add(new THREE.Group()); fire.position.set(cx, gy(cx, cz), cz);
        for (let i = 0; i < 4; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(.7, .1, .1), new THREE.MeshLambertMaterial({ color: 0x4a2e1a })); l.rotation.y = i * .8; l.position.y = .06; fire.add(l); }
        const fl = new THREE.Mesh(new THREE.ConeGeometry(.22, .6, 6), new THREE.MeshBasicMaterial({ color: 0xffa040 })); fl.position.y = .35; fire.add(fl); const f2 = new THREE.Mesh(new THREE.ConeGeometry(.12, .4, 6), new THREE.MeshBasicMaterial({ color: 0xfff0a0 })); f2.position.y = .3; fire.add(f2);
        fireL = new THREE.PointLight(0xff9a40, 6, 16, 1.6); fireL.position.y = .8; fire.add(fireL);
        mt = add(figure('matteo')); const mx = p.x + fx * 3.1 + rx * 1.0, mz = p.z + fz * 3.1 + rz * 1.0; mt.position.set(mx, gy(mx, mz) - .38, mz); mt.rotation.y = Math.atan2(p.x - mx, p.z - mz); for (const l of mt.userData.legs) l.rotation.x = -1.3; // kneeling by the fire
        const t0 = performance.now();
        cine(true, (cam) => { const t = (performance.now() - t0) / 1000; fl.scale.y = 1 + Math.sin(t * 13) * .2; f2.scale.y = 1 + Math.sin(t * 17) * .25; fireL.intensity = 5.5 + Math.sin(t * 11) * 1.2;
          cam.position.set(p.x, gy(p.x, p.z) + .7, p.z); cam.lookAt(mt.position.x, mt.position.y + 1.0, mt.position.z); });
      } },
      { fade: false, ms: 900 },
      { note: 'Firelight, then darkness. Matteo shakes you awake.' },
      { note: 'Matteo, whispering:' },
      ['Matteo', '{FIRST}. Up. Quietly. Riders on the road, a dozen torches, coming from the south. No honest man rides at this hour.'],
      ['Matteo', 'Listen to me. Take this.'],
      { do: () => { s.cargo.matteoring = 1; } },
      { note: 'He presses his ring into your hand.' },
      ['Matteo', 'My seal. Any brother of the Scuola di San Marco will know it. Get to Constantinople, to the Venetian quarter, and find Ser Bartolomeo Ghisi. Tell him everything.'],
      { choice: [{ t: 'I\'m not leaving you.' }, { t: 'Come with me!' }] },
      ['Matteo', 'And who\'ll hold the road while you run? I\'m old, my horse is older, and I\'ve talked my way out of worse than this. It\'s me they want, not you.'],
      { do: () => { give(100); s.camp.arrows = 10; } },
      { note: 'A purse, and his hunting bow.' },
      ['Matteo', 'A hundred dirham. It isn\'t much. Make it more. That\'s what I taught you, isn\'t it? And take the bow. Ten arrows; make them count.'],
      ['Matteo', 'West, through the hills, and don\'t look back. Go, {FIRST}. <i>Now!</i>'],
      { fade: true },
      { do: () => { cine(false); clearObjs(); } },
      { card: '<div class="t">You run.<br><br>Behind you: shouting, steel, then silence.</div>' },
      { do: () => { H.setTime && H.setTime(.005); s.camp.ev.ambush = 1; delete s.camp.ev.ambushing; J().save(); } },
      ...riders(),
    ]);
  }
  function riders() {
    let r1 = null, r2 = null;
    return [
      { do: () => {
        const p = H.player; const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
        const mk = (key, side) => { const g = add(new THREE.Group()); const x = p.x + fx * 9 + rx * side, z = p.z + fz * 9 + rz * side; g.position.set(x, gy(x, z), z); g.rotation.y = Math.atan2(p.x - x, p.z - z); const h = J().makeAnimal('horse', false, side > 0 ? 1 : 3); g.add(h); const f = figure(key, { weapon: 'sword' }); f.position.set(0, 1.08, -.05); for (const l of f.userData.legs) l.rotation.x = -1.2; g.add(f); return g; };
        r1 = mk('rider1', -1.4); r2 = mk('rider2', 1.6);
        cine(true, (cam) => { cam.position.set(p.x, gy(p.x, p.z) + 1.62, p.z); cam.lookAt((r1.position.x + r2.position.x) / 2, gy(p.x, p.z) + 2.1, (r1.position.z + r2.position.z) / 2); });
      } },
      { fade: false, ms: 900 },
      { note: 'Dawn in the hills. Two riders rein in on the path ahead.' },
      ['Rider1', 'Well, well. Out here alone, are you? Came from that camp on the road.'],
      ['Rider2', 'Answer straight. Were you with the old Venetian?'],
      { choice: [
        { t: 'Yes. And if you\'ve hurt him…', lines: [['Rider1', 'Honest! The captain would like that. Shame he said no witnesses.']] },
        { t: 'No. I\'m a pilgrim, bound for Aleppo.', lines: [['Rider2', 'A pilgrim, in Venetian boots? Pull the other one.'], ['Rider1', 'Doesn\'t matter. The captain said no witnesses either way.']] },
      ] },
      { note: 'They swing down from their horses and draw.' },
      { fade: true },
      { do: () => { cine(false); clearObjs(); } },
      { do: () => fightA() },
    ];
  }
  function fightA() {
    const s = S(); s.camp.pending = 'A'; J().save(); fade(false);
    window.COMBAT.story('A', { arrows: s.camp.arrows || 10, hints: s.camp.hints = s.camp.hints || {}, onQuit: quitToMenu,
      onLoot: (arrows) => {
        s.camp.arrows = Math.max(arrows, 0); const n = 15 + Math.floor(Math.random() * 11); give(n); s.cargo.griffinletter = 1; s.camp.ev.letter = 1;
        run([
          { note: `You search the riders: ${n} dirham, and a folded letter with a griffin seal.` },
          { card: `<div class="doc"><span class="seal"><svg width="56" height="56" viewBox="0 0 60 60"><circle cx="30" cy="30" r="27" fill="#2a2a30" stroke="#0a0a0c" stroke-width="2"/><path d="M18 40 Q24 18 34 16 Q44 16 42 26 Q40 34 30 34 L36 44 M30 34 L22 44" fill="none" stroke="#c9a24a" stroke-width="3" stroke-linecap="round"/></svg></span><i>Corner and all he carries to the Tyrian. No one else is to walk away from that road.</i><br><br><span style="float:right">— L. Z.</span></div>`, btn: 'Fold the letter away' },
          { card: '<div class="think">L. Z.… The captain. The Tyrian.<br>I\'ll remember those names.</div>' },
          { fade: true },
          { do: () => { window.COMBAT.endStory(); delete s.camp.pending; s.camp.ev.fightA = 1; J().save(); J().campCheck(); } },
          { card: `<div class="t">Your master is gone.<br><br>Reach Constantinople with 250 dirham for the gate toll, and find Ser Bartolomeo Ghisi in the Venetian quarter.</div>` },
          task('Deliver the Aleppo contract (optional). Reach Constantinople with 250 dirham. Find Ser Bartolomeo Ghisi.'),
          { fade: false, ms: 300 },
          { do: () => { J().updateTracker(); J().hud(); } },
        ]);
      } });
  }
  function quitToMenu() { const s = S(); if (s) J().save(); location.reload(); }

  // ---------- 2.1 – 2.2 Bartolomeo Ghisi ----------
  function talkBartolomeo() {
    const s = S();
    if (s.coins < 250) return run([['Bartolomeo', 'Stop there. The quarter is for Venetians and their business. Which are you?'], { note: 'You show him the ring. He looks at it, and at you, a long time.' },
      ['Bartolomeo', 'Not here, and not like that. The gate-wardens of this quarter want their due before I can let anyone in to talk: two hundred and fifty dirham. Sell what you carry, and come back.']]);
    const done = () => { s.camp.ev.d21 = 1; s.camp.ev.d22 = 1; J().save(); J().campCheck(); };
    run([
      ['Bartolomeo', 'Stop there. The quarter is for Venetians and their business. Which are you?'],
      { choice: [{ t: 'Show him Matteo\'s ring.' }] },
      ['Bartolomeo', '…That\'s Matteo Corner\'s seal. Where did you get it? Where is <i>he</i>?'],
      { choice: [{ t: 'Tell him everything.' }] },
      { fade: true, ms: 700 }, { fade: false, ms: 500 },
      ['Bartolomeo', 'Riders by night on the Aleppo road. And you walked away from it. God and Saint Mark were with you, apprentice.'],
      ['Bartolomeo', 'I\'ll be honest with you. Three days ago a Genoese galley captain who drinks more than he should told me a Venetian had been taken on the Syrian road and carried off by men in Genoese pay. Now I know who.'],
      { topics: [
        { t: 'Is he alive?', lines: [['Bartolomeo', 'If they\'d wanted him dead, they\'d have left him in the road. A living Venetian is worth silver. A dead one is only worth a funeral.'], ['Bartolomeo', 'And Matteo is worth more than most. He knows every factor, every route and every price the Scuola pays from here to Tabriz. They\'ll ransom him, or they\'ll squeeze him dry.']] },
        { t: 'Who took him?', lines: [['Bartolomeo', 'Show me that letter again… The Tyrian. A Tyre man who sells his sword to Genoa. As for \'L. Z.\', I can think of a few men who sign that way, and none of them I\'d want to cross. Keep that letter safe.']] },
        { t: 'How do we get him back?', lines: [['Bartolomeo', 'Not <i>we</i>. The Scuola can\'t be seen moving against Genoa, not with the truce signed and the Emperor watching us both like a hawk watching two mice. But you\'re nobody yet, and nobody can go where a Venetian factor can\'t.'], ['Bartolomeo', 'There\'s a broker in Tabriz called Bahram. He keeps a table in the caravanserai by the great bazaar. Every secret between the Black Sea and the Gulf passes over that table, and he sells them all. He won\'t sell cheap: fifteen hundred dirham before he says a word.']] },
        { t: 'What is the Scuola di San Marco?', lines: [['Bartolomeo', 'On paper, a brotherhood of Saint Mark. We pray together, bury our dead and look after the widows. In truth, it\'s how Venice trades in the East.'], ['Bartolomeo', 'We keep a brother in every market city. Not the little towns, mind; we\'re merchants, not shepherds. He passes on news, honours our seals and offers our contracts. Show Matteo\'s ring to our man in any market city, and he\'ll treat you as one of us.'], ['Bartolomeo', 'Almost one of us. You\'re not a brother yet.']] },
        { t: 'How do I become one?', lines: [['Bartolomeo', 'Brothers are sworn, not hired. A master has to stand for you, and your master is in chains. So bring him home.']] },
      ], last: { t: 'I\'m going to Tabriz.', lines: [] } },
      { do: () => { s.camp.ev.d21 = 1; } },
      ['Bartolomeo', 'You won\'t get to Tabriz with a sack of beans and a bow. The Scuola will lend you three hundred dirham against Matteo\'s name.'],
      { do: () => { give(300); s.scuolaDebt = 300; } },
      { note: 'You receive a loan of 300 dirham from the Scuola.' },
      ['Bartolomeo', 'Repay it when you can. The Scuola has a long memory and even longer ledgers.'],
      { topics: [
        { t: 'How do I build a caravan?', lines: [['Bartolomeo', 'Start at the stables. A donkey is cheap and patient. A mule carries more and complains less. A camel carries the most and drinks the least, but you\'ll pay for it.'], ['Bartolomeo', 'Every beast needs fodder, so carry enough. As the purse grows, buy better saddles, packs and gear, and hire men to guard it all. A merchant who carries his own goods on his back is a porter, not a merchant. Buy one beast at least, before you leave the city.']] },
      ], last: { t: 'Anything else?', lines: [['Bartolomeo', 'Yes. Speak Matteo\'s name softly in Tabriz. The Genoese are as thick as flies there. And {FIRST}… Matteo has never taken an apprentice who wasn\'t worth the trouble. Don\'t prove him wrong.']] } },
      task('Buy a pack animal (recommended). Travel to Tabriz. Pay Bahram the Broker 1,500 dirham.'),
    ], done);
  }

  // ---------- 3.1 Bahram ----------
  function talkBahram() {
    const s = S();
    if (s.camp.ev.paidBahram) return run([['Bahram', 'You\'ve had your answer, my friend. Delhi, beyond the Khyber. Go quickly.']]);
    const pay = [
      { do: () => { s.coins -= 1500; J().hud(); } },
      ['Bahram', 'Generous. Listen carefully, because I don\'t repeat myself for free.'],
      ['Bahram', 'Two months ago a Venetian came through here in chains: grey beard, Venetian nose, and a mouth that wouldn\'t stop arguing. The men holding him were Tyre men, led by a fellow with a ruined hand. They didn\'t stop. They rode east.'],
      ['Bahram', 'All the way to Delhi, beyond the Khyber. The Genoese have rented a house there. They\'re courting Sultan Balban\'s officials, hoping for a road to India that doesn\'t pass through Egypt. Far enough, they think, that no Venetian would ever come looking.'],
      ['Bahram', 'His price has been set: five thousand dirham, paid in person at that house.'],
      { topics: [
        { t: 'Five thousand?!', lines: [['Bahram', 'He carries a whole Republic\'s secrets in his head. Be glad they didn\'t ask for more. And Delhi pays well for the right goods. A clever merchant could arrive with the ransom and leave with change.']] },
        { t: 'Who\'s behind this?', lines: [['Bahram', 'That\'s a different answer, and you\'ve only bought one.']] },
        { t: 'Why should I trust you?', lines: [['Bahram', 'You shouldn\'t trust anyone in Tabriz. But I\'ve never sold a lie. It\'s bad for business.']] },
      ], last: { t: 'Thank you.', lines: [{ note: 'As you turn to leave:' }, ['Bahram', 'Oh, and {FIRST}? Go quickly. You\'re not the only one who\'s asked me about your master.']] } },
      { do: () => { s.camp.ev.paidBahram = 1; J().save(); } },
      task('Raise 5,000 dirham. Travel to Delhi. Go to the Genoese house and pay the ransom.'),
    ];
    run([
      ['Bahram', 'A young Frank with dust on their boots and a Venetian ring on their finger. Sit. Tea? It\'s free. Nothing else here is.'],
      { choice: [{ t: 'I\'m looking for a Venetian merchant.' }] },
      ['Bahram', 'Half of Tabriz is, by the sound of it. Questions cost nothing, my friend. Answers cost fifteen hundred dirham, which is why I only sell answers.'],
      { choice: [
        { t: 'Pay 1,500 dirham.', if: () => s.coins >= 1500, why: () => `you have ${fmt(s.coins)}`, lines: pay },
        { t: 'I\'ll come back.', lines: [['Bahram', 'Come back when your purse is heavier. Tabriz will still be here, and so, I suspect, will your master\'s troubles.']] },
      ] },
    ], () => J().campCheck());
  }

  // ---------- 4.1 The Compagna's house, COMBAT B, 4.2 Matteo's death ----------
  function talkGuard() {
    const s = S();
    const pay = [
      { do: () => { s.coins -= 5000; s.camp.ev.paidRansom = 1; J().hud(); J().save(); } },
      ['Oberto', 'Every coin. You Venetians do love your ledgers. Bring out the old man.'],
      { note: 'Matteo is brought in, bruised, his hands bound.' },
      ['Matteo', '{FIRST}? You fool. You magnificent fool. You shouldn\'t have come.'],
      { note: 'The door bars behind you. The Tyrian steps in from the courtyard.' },
      ['Tyrian', 'Touching. Ser Lanfranco Zaccaria thanks you for the silver. He\'ll keep the merchant as well. And the apprentice…'],
      { note: 'He flexes his scarred hand.' },
      ['Tyrian', 'I\'ve been meaning to finish that job since the Aleppo road.'],
      { choice: [{ t: 'We had a bargain!' }] },
      ['Oberto', 'With Venice? Genoa doesn\'t bargain with Venice. It <i>tolerates</i> Venice, for now.'],
      ['Matteo', 'Then we\'ll leave the way Venetians always do: owing nobody. Cut me loose, {FIRST}!'],
      { fade: true },
      { do: () => fightB() },
    ];
    run([
      ['Guard', 'This is a Genoese house. State your business or keep walking.'],
      { choice: [{ t: 'I\'ve come to pay the ransom for Matteo Corner.' }, { t: 'Keep walking.', lines: [{ do: () => { D.steps.length = D.i; } }] }] },
      ['Guard', '…Wait here.'],
      { fade: true, ms: 600 }, { fade: false, ms: 400 },
      ['Oberto', 'Ah. The apprentice. Welcome to the Compagna\'s newest house; you\'re our first Venetian guest. We were told you might come. Five thousand, wasn\'t it? Count it out on the table.'],
      { choice: [
        { t: 'Pay 5,000 dirham.', if: () => s.coins >= 5000, why: () => `you have ${fmt(s.coins)}`, lines: pay },
        { t: 'I don\'t have it all yet.', lines: [['Oberto', 'Then the old man waits, and so do we. The Compagna is patient. Its patience is not cheap.']] },
      ] },
    ]);
  }
  function fightB() {
    const s = S(); s.camp.pending = 'B'; J().save(); fade(false);
    window.COMBAT.story('B', { arrows: 20, allyLook: LOOK.matteo, hints: s.camp.hints = s.camp.hints || {}, onQuit: quitToMenu,
      onEscape: () => {
        run([
          { note: 'The Tyrian, wounded, scrambles onto the courtyard wall, turns, and raises his crossbow.' },
          { wait: next => window.COMBAT.cmd('bolt', () => setTimeout(next, 700)) },
          { note: 'The bolt strikes Matteo.' },
          { do: () => window.COMBAT.cmd('lookTyrian') },
          ['Tyrian', 'Enjoy your victory, Venetian. Ser Lanfranco has a long reach, and I have a long memory.'],
          { do: () => window.COMBAT.cmd('tyrianGone') },
          { note: 'He drops out of sight.' },
          { fade: true },
          { do: () => window.COMBAT.cmd('toWell') },
          { fade: false, ms: 900 },
          { note: 'In the courtyard. Matteo sits against the well, wounded.' },
          ['Matteo', 'No, leave it. I\'ve seen enough wounds to know this kind. Sit with me a moment.'],
          ['Matteo', 'You came. Halfway across the world, with my ring, a hundred dirham and a bow you can barely draw. I took an apprentice who couldn\'t tell pepper from gravel… and look at you now.'],
          { choice: [
            { t: 'We\'ll find a physician.', lines: [['Matteo', 'And pay him for what? Save your silver. That\'s the last lesson, and the hardest one.']] },
            { t: 'I should have come sooner.', lines: [['Matteo', 'You came faster than any man in the Scuola would have. Don\'t you dare carry that.']] },
          ] },
          ['Matteo', 'Listen now. <i>Lanfranco Zaccaria.</i> That\'s the L. Z. on your letter. That\'s the name behind the Tyrian, the riders, all of it. He means to own every road and every port from Genoa to Cathay, and Venice is the only thing standing in his way.'],
          ['Matteo', 'Give me your hand. By my right as a master of the Scuola di San Marco, I stand for you. I name you my heir, and my brother. Take my ring to the bailo in Constantinople. My house, my ledgers, my debts too, God forgive me… they\'re yours now.'],
          ['Matteo', 'Don\'t let them take the road from us, {FIRST}.'],
          ['Matteo', 'Funny… I always thought I\'d die in Venice. I suppose the road was always home.'],
          { note: 'He dies. You hold the ring in your hand.' },
          { fade: true, ms: 1200 },
          { do: () => { window.COMBAT.endStory(); delete s.camp.pending; s.camp.ev.fightB = 1; s.camp.ev.d42 = 1; H.setTime && H.setTime(.5); J().save(); } },
          { card: '<div class="t">Ser Matteo Corner, merchant of Venice, died in Delhi in the year of our Lord 1273.<br><br>His apprentice carried his ring home.<br><br>You are now a brother of the Scuola di San Marco.</div>' },
          { fade: false, ms: 300 },
        ], () => J().campCheck());
      } });
  }
  H.storyFinale = () => {
    const s = S(); const h = s.hero || {};
    run([{ card: () => `<h2>A Brother of the Scuola</h2>${window.HERO ? `<div>${HERO.sealSVG(h, 84)}</div>` : ''}<div class="t" style="margin:8px 0 12px">${h.first} ${h.last}, sworn brother of the Scuola di San Marco and heir to Ser Matteo Corner.</div>
        <div class="unl"><b>Now open to you</b><ul><li><b>Ships</b>: the harbour master in each port books passage on galleys, dhows and junks.</li><li><b>The Scuola's own goods</b>: Venetian glass and scarlet broadcloth at the Venetian fondaco, and the other houses' quarters.</li><li><b>Membership and ranks</b> in the Scuola, and standing with the other merchant houses (journal: Factions).</li><li><b>Property</b>: warehouses, caravanserai shares and workshops, at the guild.</li></ul></div>
        <div class="stats"><div><b>${fmt(s.day)}</b>days on the road</div><div><b>${fmt(J().netWorth())}</b>dirham net worth</div><div><b>${s.visited.length}</b>cities</div></div>
        <div class="t" style="margin-top:14px;font-size:17px">Chapters I–IV are complete. Lanfranco Zaccaria and the Tyrian are still out there; their story goes on in a later build. The road is yours: keep trading as long as you like.</div>`, btn: 'Continue' }], () => { J().hud(); J().updateTracker(); });
  };

  // ---------------- the ambush trigger: partway along the Damascus–Aleppo road ----------------
  function onAleppoRoad() {
    const W = H.W, p = H.player; const q = W.pathQuery(p.x, p.z); if (q.i < 0 || q.d > 30) return -1;
    const e = W.edges[W.P.E[q.i]]; if (!e || !((e.a === 'damascus' && e.b === 'aleppo') || (e.a === 'aleppo' && e.b === 'damascus'))) return -1;
    const f = (q.i - e.start) / Math.max(1, e.n - 1); return e.a === 'damascus' ? f : 1 - f;
  }

  // ---------------- every frame ----------------
  let slow = 0, resumed = false;
  { const o = H.frame; H.frame = function (dt) {
    o && o(dt); const s = S(); if (!s) { if (matteo) { H.scene.remove(matteo.obj); matteo = null; } return; }
    updMatteo(dt);
    for (const [k, p] of placed) { if (!p.fig) continue; const dx = H.player.x - p.x, dz = H.player.z - p.z; if (dx * dx + dz * dz < 120 && k !== 'tyrianD') { let dy = Math.atan2(dx, dz) - p.fig.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); p.fig.rotation.y += dy * .08; } }
    slow -= dt; if (slow > 0) return; slow = .25;
    placeNPCs(); findNear(); updPrompt();
    // the merchant of Acre's aside, the first time his panel opens
    if (s.camp && s.camp.act === 1 && !s.camp.ev.aside && J().ui === 'vendor' && J().inCity('acre') && s.camp.ev.talk_merchant && (s.cargo.muranoglass || s.cargo.scarlet)) { s.camp.ev.aside = 1; H.showToast('The merchant of Acre', '"Venetian glass! I haven\'t seen good Venetian glass since the winter. Don\'t tell your master I said so."', 'Acre'); }
    if (!s.camp || isOpen() || CINE || window.__combatOn || (J() && J().ui)) return;
    // a game saved in the middle of a fight goes straight back to it (the dialogue before it is skipped)
    if (s.camp.pending && !resumed) { resumed = true; const p = s.camp.pending; run([{ fade: true, ms: 100 }, { card: `<div class="t">${p === 'A' ? 'Dawn in the hills between Damascus and Aleppo. The riders are coming.' : 'The Compagna\'s house in Delhi. The door is barred behind you.'}</div>`, btn: 'Fight' }, { do: () => p === 'A' ? fightA() : fightB() }]); return; }
    // Chapter I: the talk on the road out of Damascus, if you left without it, and then the ambush
    if (s.camp.act === 1 && s.camp.ev.cine && !s.camp.ev.ambush && s.visited.includes('damascus') && !H.getCity()) {
      const f = onAleppoRoad();
      if (!s.camp.ev.d13 && f > .05) { run(scene13(k => () => { s.camp.ev[k] = 1; J().campCheck(); J().save(); })); return; }
      if (s.camp.ev.d13 && f > .32) { ambush(); return; }
    }
  }; }
  H.storyReset = () => { clearObjs(); cine(false); if (matteo) { H.scene.remove(matteo.obj); matteo = null; } for (const p of placed.values()) H.scene.remove(p.obj); placed.clear(); resumed = false; };
  window.__story = { placeNPCs, spotIn, run, get open() { return isOpen(); }, get cine() { return !!CINE; }, LOOK, talkMatteo, talkBartolomeo, talkBahram, talkGuard, ambush, fightA, fightB, opening, placed, get near() { return nearNPC; }, get matteo() { return matteo; }, onAleppoRoad };
})();
