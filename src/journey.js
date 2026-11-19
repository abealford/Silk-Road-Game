
// ============================================================
//  THE JOURNEY: trading, supplies, caravan, NPCs, events, goal
// ============================================================
(() => {
  const H = window.HOOKS; const $ = id => document.getElementById(id);
  const SAVE_KEY = 'silkroad_journey_v1';
  let MODE = 'free', S = null, W, B, KMU = 0.6;
  let ui = null; // currently open panel name
  GOOD.tables = { id: 'tables', name: 'Astronomical tables', unit: 'crate', w: 1, base: 0, special: true, quest: true, blurb: 'A crate of tables from the observatory at Maragheh, to be delivered to the scholars of Samarkand.' };
  ECON.init(CITIES, EDGES);
  Object.defineProperty(ECON, 'state', { get: () => S, configurable: true });
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const fmt1 = n => (Math.round(n * 10) / 10).toLocaleString('en-US');
  const coinsHtml = n => `<span class="mx-c">${fmt(n)}</span>`;
  const rnd = Math.random;
  const pick = a => a[Math.floor(rnd() * a.length)];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const MDAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  function dateOf(day) { let d = Math.floor(day) + 151, y = 1272; for (;;) { const yl = 365; if (d < yl) break; d -= yl; y++; } let m = 0; while (d >= MDAYS[m]) { d -= MDAYS[m]; m++; } return `${d + 1} ${MONTHS[m]} ${y}`; }

  // ---------------- state ----------------
  function newState(cid) {
    const ch = CHARACTERS[cid] ? cid : 'venetian'; const C = CHARACTERS[ch];
    const st = baseState(); Object.assign(st, { char: ch, faith: C.faith, coins: C.coins, food: C.food, water: C.water, fodder: C.fodder || 0, rep: C.rep, paiza: !!C.paiza,
      pack: Object.assign({}, C.pack), hires: Object.assign({}, C.hires), cargo: Object.assign({}, C.cargo || {}), lastCity: C.start, visited: [C.start] });
    st.lastRealm = ECON.realmOf(C.start); return st;
  }
  function baseState() {
    return { v: 1, day: 0, coins: 300, cargo: {}, basis: {}, food: 20, fodder: 0, water: 6, mount: 'foot', pack: {}, veh: {}, hires: {}, arms: {}, up: {}, paiza: false, rep: 10,
      flags: {}, sat: {}, stock: {}, seen: {}, rumours: [], lastCity: 'constantinople', lastRealm: 'byz', visited: ['constantinople'], speed: {}, hunger: 0, thirst: 0, weak: 0,
      kmRoll: 0, cool: 0, usedOnce: {}, events: 0, startDay: 0, won: false, kmTotal: 0 };
  }
  function migrate(s) {
    if (!s.seed) s.seed = 1 + Math.floor(Math.random() * 2e9); ECON.seed = s.seed; // v14: every new game rolls its own contracts, ventures, opportunities and price swings
    s.speed = s.speed || {}; if (!s.char) { s.char = 'venetian'; s.faith = 'christian'; }
    if (s.camp && !s.camp.v21) { s.camp = null; s.oldStory = true; } // v21: Matteo's old acts are gone; such a save carries on as an open journey
    if (s.mount && s.mount !== 'foot') { s.pack.horse = (s.pack.horse || 0) + 1; s.mount = 'foot'; }
    s.v = 2; return s;
  }
  function decorate(s) {
    Object.defineProperties(s, {
      people: { value: () => 1 + Object.values(s.hires).reduce((a, b) => a + b, 0), enumerable: false, configurable: true },
      packCount: { value: () => Object.values(s.pack).reduce((a, b) => a + b, 0), enumerable: false, configurable: true },
      packKinds: { value: () => Object.fromEntries(Object.entries(s.pack).filter(([k, v]) => v > 0)), enumerable: false, configurable: true },
      animalFodder: { value: () => fodderUse(s), enumerable: false, configurable: true },
    });
    return s;
  }
  // ---------------- derived stats ----------------
  function capacity(s = S) { let c = BASE_CARRY + (s.up.bags ? 3 : 0) + (s.mount !== 'foot' ? 2 : 0); for (const k in s.pack) c += PACK[k].cap * s.pack[k]; for (const k in s.veh) c += VEHICLES[k].cap * s.veh[k]; return c; }
  function load(s = S) { let l = 0; for (const g in s.cargo) l += GOOD[g].w * s.cargo[g]; for (const k of (s.contracts || [])) l += GOOD[k.g].w * k.n; return l + s.food * SUPPLY_W.food + s.fodder * SUPPLY_W.fodder + s.water * SUPPLY_W.water; }
  function draftCount(s = S) { return (s.veh.cart || 0) + 2 * (s.veh.wagon || 0); }
  function animalCount(s = S) { return s.packCount() + draftCount(s) + (s.mount !== 'foot' ? 1 : 0); }
  function fodderUse(s = S) { let f = s.mount !== 'foot' ? MOUNTS[s.mount].fodder : 0; for (const k in s.pack) f += PACK[k].fodder * s.pack[k]; for (const k in s.veh) f += VEHICLES[k].fodder * s.veh[k]; for (const g in s.cargo) if (GOOD[g] && GOOD[g].fodder) f += GOOD[g].fodder * s.cargo[g]; return f; }
  function waterUse(s = S) { let w = s.people(); if (s.mount !== 'foot') w += MOUNTS[s.mount].water; for (const k in s.pack) w += PACK[k].water * s.pack[k]; for (const k in s.veh) w += VEHICLES[k].water * s.veh[k]; return w * 0.5; }
  function wages(s = S) { let w = 0; for (const k in s.hires) w += HIRES[k].wage * s.hires[k]; if (s.speed && s.speed.master) w += SPEED_UPS.master.wage; return w; }
  function strength(s = S) {
    let st = 2 + (s.arms.weapon ? ARMS[s.arms.weapon].str : 0) + (s.arms.armour ? ARMS[s.arms.armour].str : 0);
    st += (s.hires.guard || 0) * (3 + (s.up.guardArms ? 2 : 0)) + (s.hires.archer || 0) * 6 + (s.up.dog || 0) * 2;
    st += 0.5 * ((s.hires.guide || 0) + (s.hires.interpreter || 0) + (s.hires.handler || 0));
    if (s.char === 'engineer') st += 3;
    return Math.round(st);
  }
  function terrainAt(x, z) {
    const ll = W.toLL(x, z); const bi = W.bioIndex(ll[0], ll[1]); const dom = W.BIOME_KEYS[W.bio.dom[bi]];
    return { dom, lon: ll[0], lat: ll[1], desert: ['sand', 'gobi', 'flaming', 'nafud', 'thar'].includes(dom), tibet: dom === 'tibet' || dom === 'alpine', steppe: dom === 'steppe', arid: ARID.includes(dom) ? (dom === 'iran' ? 0.5 : 1) : 0 };
  }
  function animalSpeed(def, t, mtn) { let v = def.speed; if (t.desert && def.desert) v = def.desert; if (t.tibet && def.tibet) v = def.tibet; if (t.steppe && def.steppe) v = def.steppe; if (mtn && def.mountain) v = def.mountain; return v; }
  function speedBonus(s = S, t = null, mtn = false, realm = null) {
    let b = 0; const sp = s.speed || {};
    for (const k in SPEED_UPS) if (sp[k] && SPEED_UPS[k].bonus && !SPEED_UPS[k].slot) b += SPEED_UPS[k].bonus;
    if (sp.breed && SPEED_UPS[sp.breed]) b += SPEED_UPS[sp.breed].bonus;
    if (s.hires.guide) b += .05;
    if (t) { const pk = s.pack, n = s.packCount(); if (n) { if (t.desert && (pk.camel || 0) * 2 >= n) b += .08; if (t.tibet && (pk.yak || 0) * 2 >= n) b += .08; if (mtn && (pk.mule || 0) * 2 >= n) b += .08; } }
    if (s.paiza && realm && REALMS[realm] && REALMS[realm].mongol) b += .1;
    return b;
  }
  function speedKm(s = S, t = null, mtn = false, realm = undefined) {
    t = t || terrainAt(H.player.x, H.player.z);
    if (realm === undefined) realm = ECON.realmOf(W.nearestCity(H.player.x, H.player.z).c.id);
    let v = BASE_SPEED * (1 + speedBonus(s, t, mtn, realm));
    const wheel = (s.speed && s.speed.wheels) ? SPEED_UPS.wheels.wheel : 0;
    for (const k in s.veh) if (s.veh[k] > 0) v = Math.min(v, VEHICLE_SPEED[k] + wheel);
    const handle = 3 + 6 * (s.hires.handler || 0) + 2 * ((s.hires.guard || 0) + (s.hires.archer || 0) + (s.hires.guide || 0) + (s.hires.interpreter || 0));
    if (s.packCount() + draftCount(s) > handle) v *= 0.8;
    if (load(s) > capacity(s) + 0.01) v *= 0.5;
    if (s.hunger > 3) v *= 0.65; if (s.fodder <= 0 && fodderUse(s) > 0 && s.weak > 3) v *= 0.8;
    return Math.max(8, v);
  }
  function goodsValue(cid, s = S) { let v = 0; for (const g in s.cargo) if (!GOOD[g].quest) v += ECON.mid(g, cid, s.day) * s.cargo[g]; return v; }
  function nearestCityId() { return W.nearestCity(H.player.x, H.player.z).c.id; }
  function netWorth(s = S) { const cid = nearestCityId(); let a = 0; if (s.mount !== 'foot') a += MOUNTS[s.mount].cost * .5; for (const k in s.pack) a += PACK[k].cost * .5 * s.pack[k]; for (const k in s.veh) a += VEHICLES[k].cost * .5 * s.veh[k]; return s.coins + goodsValue(cid, s) + a; }
  function isMountainEdge(e) { return MOUNTAIN_ROADS.some(([a, b]) => (e.a === a && e.b === b) || (e.a === b && e.b === a)); }

  // ---------------- DOM ----------------
  function el(tag, cls, html, parent) { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; (parent || document.body).appendChild(e); return e; }
  let hudEl, promptEl, ov, panel, evtEl;
  function buildDom() {
    hudEl = el('div', 'mx-hud', '', $('hud'));
    promptEl = el('div', 'mx-prompt', '', $('hud'));
    ov = el('div', 'mx-ov'); panel = el('div', 'mx-panel', '', ov);
    ov.addEventListener('click', e => { const t = e.target.closest('[data-act]'); if (t && !t.disabled) { act(t.dataset.act, t.dataset); } });
  }
  function openUI(name) {
    ui = name; for (const k in H.keys) H.keys[k] = false; H.player.auto = false;
    if (document.pointerLockElement) document.exitPointerLock(); H.setPauseWanted(false);
    ov.classList.add('show'); render();
  }
  function closeUI() { if (typeof hidePmap === 'function') hidePmap(); ui = null; ov.classList.remove('show'); panel.innerHTML = ''; H.setPauseWanted(true); H.tryLock(); updateHud(true); }
  H.uiOpen = () => !!ui; H.frozen = () => !!ui;

  // ---------------- HUD ----------------
  let hudT = 0;
  function bar(label, units, days, warn) { const cls = days < 3 ? 'bad' : days < warn ? 'warn' : ''; return `<span class="mx-s ${cls}" title="${label}: ${fmt(units)} units, enough for ${days >= 999 ? 'ever' : fmt(days) + ' days'}">${label} <b>${fmt(units)}</b> <i>(${days >= 999 ? '∞' : fmt(Math.floor(days))}d)</i></span>`; }
  function tripHtml() { // v14: distance and days left to the city at the end of the road you're on
    const q = W.pathQuery(H.player.x, H.player.z); if (q.i < 0 || q.d > 40) return '';
    const e = W.edges[W.P.E[q.i]]; if (!e) return ''; const f = (q.i - e.start) / Math.max(1, e.n - 1);
    let toB = e.b !== S.lastCity; if (e.a !== S.lastCity && e.b !== S.lastCity) { const hd = H.player.yaw; const dx = W.P.X[Math.min(e.start + e.n - 1, q.i + 3)] - W.P.X[q.i], dz = W.P.Z[Math.min(e.start + e.n - 1, q.i + 3)] - W.P.Z[q.i]; toB = (-Math.sin(hd) * dx - Math.cos(hd) * dz) > 0; }
    const km = e.km * (toB ? 1 - f : f); const to = W.cityById[toB ? e.b : e.a]; const days = km / speedKm();
    return `<div class="mx-row">→ <b>${to.name.replace(/ \(.*\)/, '')}</b> ${fmt(mi(km))} mi · <b>${days < 1 ? 'under a day' : fmt(Math.ceil(days)) + (Math.ceil(days) === 1 ? ' day' : ' days')}</b> left</div>`;
  }
  function updateHud(force) {
    if (MODE !== 'journey' || !S) return;
    hudT -= 1; if (hudT > 0 && !force) return; hudT = 10;
    const fd = S.food / S.people(), fo = fodderUse() > 0 ? S.fodder / fodderUse() : 999, wa = S.water / waterUse();
    const c = H.getCity();
    hudEl.innerHTML = `<div class="mx-date">${SEASONS[seasonNow()].icon} ${dateOf(S.day)} <i>· ${lcName(SEASONS[seasonNow()].name)} · day ${fmt(S.day)}</i>${walkMul > 1 ? ` <b class="mx-walk">${walkMul}×</b>` : ''}</div>
      <div class="mx-row">${coinsHtml(S.coins)} ${CURRENCY} <span class="mx-rep" title="Reputation">★ ${Math.round(S.rep)}</span>${S.paiza ? '<span class="mx-paiza" title="Silver paiza">PAIZA</span>' : ''}${facBadge()}</div>
      <div class="mx-row">Cargo <b>${fmt1(load())}</b> / ${capacity()} loads${load() > capacity() ? ' <span class="bad">overloaded</span>' : ''}</div>
      <div class="mx-row">${bar('Food', S.food, fd, 8)} ${unl('water') ? bar('Water', S.water, wa, 6) : ''} ${fodderUse() > 0 ? bar('Fodder', S.fodder, fo, 8) : ''}</div>${c ? '' : tripHtml()}
      ${c && followers.length ? `<div class="mx-row mx-dim">Your caravan waits at the caravanserai by the gate.</div>` : ''}
      <div class="mx-row mx-dim">Speed ${mi(speedKm())} mi/day · strength ${strength()} · ${S.people()} ${S.people() > 1 ? 'people' : 'person'}${animalCount() ? ', ' + animalCount() + ' animals' : ''}</div>
      ${(S.contracts || []).length ? `<div class="mx-row">Contracts: ${S.contracts.map(k => `${lcName(GOOD[k.g].name)} → ${W.cityById[k.to].name.replace(/ \(.*\)/, '')} <i class="mx-dim">(${Math.max(0, Math.ceil(k.due - S.day))}d)</i>`).join(', ')}</div>` : ''}
      <div class="mx-row mx-keys"><b>E</b> interact · <b>J</b> journal · <b>C</b> caravan${c ? ' · <b>R</b> restock' : ''} · <b>T</b> speed · <b>P</b> pause</div>`;
  }

  // ---------------- travel: supplies & time ----------------
  let warnT = 0, blockT = 0;
  H.speedMul = () => MODE === 'journey' ? 1.35 : 1;
  H.allowed = (x, z) => {
    if (MODE === 'journey' && S && S.faith !== 'muslim') for (const hc of W.cities) { if (!hc.holy) continue; const nc = { c: hc, d: Math.hypot(x - hc.x, z - hc.z) }; if (nc.d < nc.c.R + 3 && nc.d < Math.hypot(H.player.x - nc.c.x, H.player.z - nc.c.z)) {
      if (performance.now() - blockT > 6000) { blockT = performance.now(); H.showToast('Only Muslims may enter', `The sacred precinct of ${nc.c.name} is closed to non-Muslims. Guards turn your caravan back at the boundary stones.`, 'Holy city'); }
      return false; } }
    if (MODE === 'journey' && S) { const q0 = W.pathQuery(x, z); if (q0.i >= 0) { const e0 = W.edges[W.P.E[q0.i]]; if (passClosed(e0)) { for (const id of [e0.a, e0.b]) { const cc = W.cityById[id]; const dn = Math.hypot(x - cc.x, z - cc.z), dp = Math.hypot(H.player.x - cc.x, H.player.z - cc.z); if (dn > cc.R + 6 && dn < cc.R + 70 && dn > dp) {
      if (performance.now() - blockT > 6000) { blockT = performance.now(); H.showToast('The pass is snowed in', `Deep snow closes the road between ${W.cityById[e0.a].name} and ${W.cityById[e0.b].name} until April. Wait for spring, or take another road.`, 'Winter'); } return false; } } } } }
    if (MODE !== 'journey' || !S || !draftCount()) return true;
    const q = W.pathQuery(x, z); if (q.i < 0) return true; const e = W.edges[W.P.E[q.i]]; if (!isMountainEdge(e)) return true;
    const nc = W.nearestCity(x, z); if (nc.d < nc.c.R + 25) return true;
    if (performance.now() - blockT > 6000) { blockT = performance.now(); H.showToast('Too steep for wheels', `Carts and wagons cannot cross the road between ${W.cityById[e.a].name} and ${W.cityById[e.b].name}. Sell them, or take another road.`, 'Caravan'); }
    return false;
  };
  H.moved = (step) => {
    if (MODE !== 'journey' || !S) return;
    if (H.getCity()) return; // time stands still while you stroll around town
    const km = step * kmPerUnitHere(); // distance covered on the road
    S.kmTotal += km;
    const days = km / speedKm();
    passDays(days, terrainAt(H.player.x, H.player.z));
    S.kmRoll += km; S.cool = Math.max(0, S.cool - km);
    if (S.kmRoll > 55) { S.kmRoll = 0; maybeEvent(); }
  };
  const ekmu = {};
  function kmPerUnitHere() {
    const q = W.pathQuery(H.player.x, H.player.z); if (q.i < 0 || q.d > 30) return KMU;
    const e = W.edges[W.P.E[q.i]]; if (ekmu[e.id]) return ekmu[e.id];
    const A = W.cityById[e.a], Bc = W.cityById[e.b]; return ekmu[e.id] = e.km / Math.max(e.len * 0.35, e.len - A.R - Bc.R - 6);
  }
  function passDays(days, t) {
    if (days <= 0) return;
    const before = Math.floor(S.day); S.day += days; ECON.decaySat(S, days);
    S.food -= S.people() * days * seasonMul('food', t); S.fodder -= fodderUse() * days * seasonMul('fodder', t);
    if (t && t.arid) S.water -= waterUse() * days * t.arid * seasonMul('water', t);
    if (S.food < 0) S.food = 0; if (S.fodder < 0) S.fodder = 0; if (S.water < 0) S.water = 0;
    if (H.adm && H.adm.infSupplies) { S.food = Math.max(S.food, S.people() * 10); S.water = Math.max(S.water, waterUse() * 10); S.fodder = Math.max(S.fodder, fodderUse() * 10); } // v20 admin
    const whole = Math.floor(S.day) - before;
    for (let d = 0; d < whole; d++) dailyTick(t);
  }
  function dailyTick(t) {
    v11Daily();
    if (S.contracts && S.contracts.some(k => S.day > k.due)) { const late = S.contracts.filter(k => S.day > k.due); S.contracts = S.contracts.filter(k => S.day <= k.due); S.rep = Math.max(0, S.rep - 6 * late.length); H.showToast('Contract broken', late.map(k => `You missed the deadline to bring ${lcName(GOOD[k.g].name)} to ${W.cityById[k.to].name}. ${k.client} will remember (reputation −6).`).join(' '), 'Contracts'); }
    // wages
    const w = wages(); if (w > 0) { if (S.coins >= w) S.coins -= w; else { const k = Object.keys(S.hires).find(k => S.hires[k] > 0); if (k) { S.hires[k]--; if (!S.hires[k]) delete S.hires[k]; rebuildCaravan(); H.showToast('Unpaid wages', `Your ${lcName(HIRES[k].name)} leaves the caravan: you cannot pay.`, 'Caravan'); } } }
    // hunger, thirst, fodder
    // v14: three days' grace before running out starts to hurt
    const GR = 3;
    if (S.food <= 0.01) { S.hunger++; const g = S.hunger - GR;
      if (S.hunger === 1) H.showToast('Out of food', `Your people are going hungry. You have ${GR} days of grace to reach a town or buy food before the caravan suffers.`, 'Supplies');
      else if (g === 0) H.showToast('Starving', 'The grace is over: your people are starving. Hired men will start to desert.', 'Supplies');
      if (g > 0 && g % 3 === 0) desert(); if (g >= 9) return collapse('Starvation has broken your caravan.'); } else S.hunger = 0;
    if (t && t.arid && waterUse() > 0 && S.water <= 0.01) { S.thirst++; const g = S.thirst - GR;
      if (S.thirst === 1) H.showToast('Out of water', `There is no water left. You can push on for ${GR} days before the desert takes its toll.`, 'Supplies');
      else if (g === 0) H.showToast('Dying of thirst', 'The grace is over. Animals will begin to die.', 'Supplies');
      if (g >= 2) loseAnimalQuiet(); if (g >= 4) return collapse('Without water, your caravan collapses in the desert.'); } else if (S.water > 0) S.thirst = 0;
    if (fodderUse() > 0 && S.fodder <= 0.01) { S.weak++; const g = S.weak - GR;
      if (S.weak === 1) H.showToast('Out of fodder', `Your animals have no fodder. They can manage ${GR} days before they weaken.`, 'Supplies');
      if (g > 0 && g % 3 === 0) loseAnimalQuiet(); } else S.weak = 0;
    dropOverflow();
  }
  function desert() { const k = Object.keys(S.hires).find(k => S.hires[k] > 0); if (k) { S.hires[k]--; if (!S.hires[k]) delete S.hires[k]; H.showToast('Desertion', `A hungry ${lcName(HIRES[k].name)} slips away in the night.`, 'Caravan'); rebuildCaravan(); } else loseAnimalQuiet(); }
  function loseAnimalQuiet() { const r = M.loseAnimal(); H.showToast('Animal lost', r, 'Caravan'); }
  function dropOverflow() {
    let over = load() - capacity(); if (over <= 0.01) return; const dropped = [];
    const order = Object.keys(S.cargo).filter(g => !GOOD[g].quest && GOOD[g].w > 0).sort((a, b) => ECON.mid(a, nearestCityId(), S.day) / GOOD[a].w - ECON.mid(b, nearestCityId(), S.day) / GOOD[b].w);
    for (const g of order) { while (over > 0.01 && S.cargo[g] > 0) { S.cargo[g]--; over -= GOOD[g].w; dropped.push(g); } if (!S.cargo[g]) delete S.cargo[g]; }
    while (over > 0.01 && S.fodder > 1) { S.fodder--; over -= SUPPLY_W.fodder; }
    if (dropped.length) H.showToast('Too heavy', `With fewer animals you must abandon ${dropped.length} ${dropped.length > 1 ? 'loads' : 'load'} of the cheapest goods.`, 'Caravan');
  }
  function collapse(why) {
    const lost = Object.keys(S.cargo).length;
    S.cargo = {}; S.basis = {}; S.hunger = 0; S.thirst = 0; S.weak = 0;
    S.food = Math.max(S.food, 3 * S.people()); S.water = Math.max(S.water, 3 * S.people());
    showEvent({ title: 'The Caravan Collapses', text: `${why} ${lost ? '<b>You lose all your goods.</b>' : ''} A passing caravan shares just enough food and water to get you to the next town.`, result: true });
  }

  // ---------------- arriving in a city ----------------
  H.onCity = (c) => {
    if (MODE !== 'journey' || !S || !c) return;
    if (!S.visited.includes(c.id)) S.visited.push(c.id);
    const realm = ECON.realmOf(c.id); const msgs = [];
    if (realm !== S.lastRealm) {
      const R = REALMS[realm]; let rate = R.toll; if (S.paiza && R.mongol) rate /= 2; if (S.char === 'venetian') rate /= 2;
      const v = goodsValue(c.id); const toll = Math.round(v * rate);
      if (toll > 0) { if (S.coins >= toll) { S.coins -= toll; msgs.push(`You enter the ${R.name} and pay ${fmt(toll)} ${CURRENCY} in tolls (${Math.round(rate * 1000) / 10}% of your cargo)${S.paiza && R.mongol ? ', halved by your paiza' : ''}${S.char === 'venetian' ? ', halved by your Venetian privileges' : ''}.`); }
        else { const taken = M.loseValue(toll - S.coins, c.id); S.coins = 0; msgs.push(`You cannot pay the ${R.name}'s toll of ${fmt(toll)}. The customs officers take goods instead: ${taken}`); } }
      S.lastRealm = realm;
    }
    const prevCity = S.lastCity; S.lastCity = c.id;
    // v19: the merchant rolls a fresh set of goods after 3+ days away or a visit to another city
    const hits = MARKET.arrive(S, c.id, prevCity);
    if (hits.length) msgs.push(`The merchant has something special today: ${hits.map(g => `<b class="${MARKET.rarClass(g)}">${GOOD[g].name}</b> (${MARKET.rarName(g).toLowerCase()})`).join(', ')}.`);
    recordPrices(c.id);
    // quest: Maragheh tables
    if (c.id === 'samarkand' && S.cargo.tables) { delete S.cargo.tables; S.flags.tables_done = S.day; S.coins += 250; S.rep += 10; msgs.push('The scholars of Samarkand receive the tables from Maragheh with delight, and reward you with 250 dirhams.'); }
    if (S.char === 'monk' && isChristianCity(c) && (S.flags['shelter_' + c.id] === undefined || S.day - S.flags['shelter_' + c.id] >= 30)) {
      S.flags['shelter_' + c.id] = S.day; const nf = Math.max(S.food, S.people() * 12), nw = Math.max(S.water, S.people() * 6); const gf = Math.round(nf - S.food), gw = Math.round(nw - S.water);
      S.food = nf; S.water = nw; if (gf + gw > 0) msgs.push(`The Christians of ${c.name} welcome you into their church and give you ${gf} food and ${gw} water for the road.`); }
    if (S.char === 'karimi' && c.id === 'cairo' && !S.cargo.letter && !S.won) { S.cargo.letter = 1; msgs.push('At the Citadel, the Sultan\'s secretary gives you a new copy of the letter to the Khan of the Golden Horde. Guard it better this time.'); }
    for (const k of (S.contracts || []).filter(k => k.to === c.id)) { S.coins += k.reward; S.rep = Math.min(100, S.rep + 4); msgs.push(`You deliver ${k.n} ${GOOD[k.g].unit}s of ${lcName(GOOD[k.g].name)} for ${k.client} of ${W.cityById[k.from].name} and collect <b>${fmt(k.reward)} ${CURRENCY}</b>.`); }
    if (S.contracts) S.contracts = S.contracts.filter(k => k.to !== c.id);
    if (S.autoRestock && S.autoRestock !== 'off') { const r = S.autoRestock === 'full' ? doRestock(c, 30) : (() => { const cc = W.cityById[c.id]; let best = null; for (const g of cc.gates) { const N = roadNeeds(cc, g); if (!best || N.days > best.N.days) best = { g, N }; } return best ? doRestockRoad(c, best.g.other) : ''; })(); if (r) msgs.push(r); }
    v11Arrive(c, msgs);
    if (msgs.length) setTimeout(() => H.showToast(c.name, msgs.join(' '), 'Arrival'), 3000);
    checkCharGoal(c);
    save(); spawnVendors(c);
  };
  function recordPrices(cid) { const p = {}; for (const g of GOODS) p[g.id] = Math.round(ECON.sellPrice(S, g.id, cid, S.day)); const b = {}; for (const g of ECON.offers(cid)) if (GOOD[g] && !GOOD[g].special) b[g] = Math.round(ECON.buyPrice(S, g, cid, S.day)); S.seen[cid] = { day: Math.floor(S.day), sell: p, buy: b }; }

  // ---------------- crossroads info ----------------
  const edgeArid = {};
  function aridFrac(e) { if (edgeArid[e.id] !== undefined) return edgeArid[e.id]; let a = 0, n = 0; for (let j = 0; j < e.n; j += 6) { const i = e.start + j; a += terrainAt(W.P.X[i], W.P.Z[i]).arid; n++; } return edgeArid[e.id] = a / Math.max(1, n); }
  H.roadInfo = (c, g) => {
    if (MODE !== 'journey' || !S) return null;
    const e = W.edges[g.edge]; const mid = e.start + (e.n >> 1); const t = terrainAt(W.P.X[mid], W.P.Z[mid]);
    const N = roadNeeds(c, g); const days = N.days;
    const needF = N.food, needW = N.water, needO = N.fodder;
    const ok = (have, need) => have >= need ? 'ok' : have >= need * .75 ? 'warn' : 'bad';
    let h = `${fmt(mi(g.km))} mi ${g.dir} · <b>${Math.ceil(days)} days</b>`;
    h += ` · <span class="mx-${ok(S.food, needF)}">food ${fmt(S.food)}/${fmt(needF)}</span>`;
    if (needW > 1) h += ` · <span class="mx-${ok(S.water, needW)}">water ${fmt(S.water)}/${fmt(needW)}</span>`;
    if (needO > 1) h += ` · <span class="mx-${ok(S.fodder, needO)}">fodder ${fmt(S.fodder)}/${fmt(needO)}</span>`;
    if (isMountainEdge(e)) h += ' · <span class="mx-warn">no carts</span>';
    const sn = seasonNotes(e, days); if (sn) h += ' · ' + sn;
    return h;
  };

  // ---------------- vendors ----------------
  const NAMES = {
    byz: ['Theodore', 'Michael', 'Nikephoros', 'Ioannes', 'Alexios', 'Demetrios'], armenian: ['Hovhannes', 'Smbat', 'Grigor', 'Vahram'], georgian: ['Giorgi', 'Davit', 'Shota', 'Zakaria'],
    rum: ['Hasan', 'Mahmud', 'Osman', 'Yusuf', 'Ali'], arab: ['Abu Bakr', 'Khalil', 'Ibrahim', 'Salah', 'Umar'], persian: ['Rashid', 'Hamid', 'Farrukh', 'Jalal', 'Kamal'],
    central: ['Nasir', 'Timur', 'Mas\'ud', 'Bahadur', 'Qutb'], tarim: ['Arslan', 'Bilge', 'Qutlugh', 'Tughril'], mongol: ['Temür', 'Bayan', 'Arghun', 'Nogai', 'Sübe'],
    chinese: ['Wang', 'Zhang', 'Liu', 'Chen', 'Zhao', 'Li'], song: ['Wu', 'Shen', 'Lu', 'Fang', 'Gu'], tibet: ['Tashi', 'Dorje', 'Pema', 'Sonam', 'Norbu'],
    yemen: ['Ahmad', 'Salim', 'Hasan al-Hadrami', 'Ali', 'Muhsin'], indian: ['Jagadu', 'Vastupala', 'Somadeva', 'Haridasa', 'Ramadeva', 'Bhima'], sea: ['Nga Pyi', 'Aung', 'Pho Khun', 'Chandra', 'Kyaw', 'Sri Ratna'],
  };
  const ROLES = { merchant: 'merchant', outfitter: 'stable-master', guild: 'master of the Merchants\' Guild' };
  const vendorSets = new Map(); // cityId -> {group, vendors:[{role,x,z,name,obj}]}
  function spawnVendors(c) {
    if (vendorSets.has(c.id) || !c.occ) return;
    const g = new THREE.Group(); g.position.set(c.x, c.h, c.z); H.scene.add(g);
    const vendors = []; const used = [];
    const dMain = (x, z) => { let m = 1e9; for (const l of c.corrLines) for (const p of l) m = Math.min(m, Math.hypot(p[0] - x, p[1] - z)); return m; };
    for (const role of vendorRoles(c)) {
      let best = null;
      for (let k = 0; k < 72; k++) for (const r of (role.startsWith('quarter') ? [16, 19, 22, 25].filter(r => r < c.R - 3) : [6.5, 8, 10, 12, 14])) {
        const a = k / 72 * Math.PI * 2; const x = Math.cos(a) * r, z = Math.sin(a) * r; const bx = Math.cos(a) * (r + 1.8), bz = Math.sin(a) * (r + 1.8);
        if (c.occ.get(x, z) === 2 || c.occ.get(bx, bz) === 2 || c.occ.get(bx + Math.sin(a), bz - Math.cos(a)) === 2 || c.occ.get(bx - Math.sin(a), bz + Math.cos(a)) === 2) continue;
        const dm = dMain(x, z); if (dm < 3.6) continue;
        let sep = 1e9; for (const u of used) sep = Math.min(sep, Math.hypot(u[0] - x, u[1] - z));
        const sc = Math.min(sep, 9) * 2 - r * 0.4 + Math.min(dm, 6);
        if (!best || sc > best.sc) best = { x, z, a, r, sc };
      }
      if (!best) continue; used.push([best.x, best.z]);
      const person = makePerson(role === 'scuola' ? 'byz' : c.culture, role === 'merchant' || role === 'guild' || role.startsWith('quarter') ? 'rich' : role === 'outfitter' ? 'groom' : 'plain');
      person.position.set(best.x, 0, best.z); person.rotation.y = Math.atan2(-best.x, -best.z); g.add(person);
      const sb = new B.Builder(); sb.push(Math.cos(best.a) * (best.r + 1.9), 0, Math.sin(best.a) * (best.r + 1.9), Math.atan2(-best.x, -best.z)); B.FURN.stall(sb, Math.random, c.culture); if (role === 'outfitter') { sb.push(2.6, 0, -.5, 0); B.FURN.hay(sb, Math.random); sb.pop(); } if (role === 'merchant') { sb.push(-2.4, 0, .2, 0); B.FURN.sacks(sb, Math.random); sb.pop(); sb.push(2.4, 0, .2, 0); B.FURN.jars(sb, Math.random); sb.pop(); } sb.pop();
      const sm = new THREE.Mesh(sb.geometry(), H.objMat); sm.castShadow = true; g.add(sm);
      if (role === 'outfitter') { const an = makeAnimal(pickAnimalFor(c), true); an.position.set(Math.cos(best.a + .35) * (best.r + 1), 0, Math.sin(best.a + .35) * (best.r + 1)); an.rotation.y = best.a + Math.PI / 2; g.add(an); }
      const label = textSprite(vendorLabel(role)); label.position.set(best.x, 3.05, best.z); g.add(label);
      const nl = (NAMES[c.culture] || NAMES.persian).filter(n => !vendors.some(v => v.name === n)); let hs = 0; for (const ch of c.id + role + ((S && S.seed) || '')) hs = (hs * 31 + ch.charCodeAt(0)) >>> 0;
      const name = nl.length ? nl[hs % nl.length] : pick(NAMES.persian); // v15.1: three different people, the same ones every visit
      vendors.push({ role, x: c.x + best.x, z: c.z + best.z, name, obj: person, label });
      if (!c._vcol) H.addCollider({ x: c.x + best.x, z: c.z + best.z, r: 0.45 });
    }
    c._vcol = true; vendorSets.set(c.id, { group: g, vendors, city: c });
  }
  function pickAnimalFor(c) { return c.culture === 'sea' || (c.culture === 'indian' && c.lat < 26 && c.lon > 74.5) ? 'elephant' : c.culture === 'indian' ? 'ox' : ['arab', 'persian', 'central', 'tarim', 'yemen'].includes(c.culture) ? 'camel' : c.culture === 'tibet' ? 'yak' : c.culture === 'mongol' ? 'pony' : ['chinese', 'song'].includes(c.culture) ? 'mule' : 'horse'; }
  function cleanupVendors() {
    for (const [id, v] of vendorSets) { const d = Math.hypot(v.city.x - H.player.x, v.city.z - H.player.z); if (d > v.city.R + 400) { H.scene.remove(v.group); vendorSets.delete(id); } }
  }
  function textSprite(text) {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const g = cv.getContext('2d');
    g.fillStyle = 'rgba(40,24,12,.72)'; g.beginPath(); g.roundRect(6, 8, 244, 48, 10); g.fill();
    g.fillStyle = '#f6e6c4'; g.font = 'bold 26px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 33);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false })); sp.scale.set(1.7, .42, 1); return sp;
  }

  // ---------------- interaction ----------------
  let near = null;
  function findInteraction() {
    near = null; const p = H.player; const c = H.getCity();
    if (!c) return;
    const vs = vendorSets.get(c.id);
    if (vs) for (const v of vs.vendors) { const d = Math.hypot(v.x - p.x, v.z - p.z); if (d < 3.6 && (!near || d < near.d)) near = { d, kind: 'vendor', v }; }
    if ((c.id === 'khanbaliq' || c.id === 'shangdu') && goalType() === 'audience') {
      const lm = LANDMARKS.find(l => l.city === c.id && l.type === 'palace'); const pos = lm && lm._pos;
      if (pos) { const d = Math.hypot(pos[0] - p.x, pos[1] - p.z); if (d < 26) near = { d, kind: 'audience' }; }
    }
  }
  function updatePrompt() {
    if (ui || !near) { promptEl.classList.remove('show'); return; }
    let t = '';
    if (near.kind === 'vendor') { const v = near.v; t = `<b>E</b> &nbsp;Talk to ${v.name}, the ${ROLES[v.role]}`; }
    else t = '<b>E</b> &nbsp;Request an audience with Kublai Khan';
    promptEl.innerHTML = t; promptEl.classList.add('show');
  }
  H.keydown = (e) => {
    if (e.code === 'KeyT' && !ui) { cycleWalk(); return true; }
    if (MODE !== 'journey') { if (e.code === 'KeyY') { H.freeMonth = ((H.freeMonth ?? 6.3) + 3) % 12; const se = SEASONS[seasonOfMonth(Math.floor(H.freeMonth))]; H.showToast('Season', `${se.icon} ${se.name}: the landscape changes with the season. Press Y again to move on.`, 'Free roam'); return true; } return false; }
    if (ui) {
      if (e.code === 'Escape' || (e.code === 'KeyE' && ui !== 'event' && ui !== 'win') || (e.code === 'KeyJ' && ui === 'journal') || (e.code === 'KeyC' && ui === 'caravan') || (e.code === 'KeyR' && ui === 'restock') || e.code === 'KeyP') { if (ui === 'event') return true; closeUI(); }
      return true;
    }
    if (e.code === 'KeyE' && near) { if (near.kind === 'vendor') { panelState = { tab: near.v.role, vendor: near.v, qty: 1 }; openUI('vendor'); } else openUI('audience'); return true; }
    if (e.code === 'KeyJ') { panelState = { tab: 'prices' }; openUI('journal'); return true; }
    if (e.code === 'KeyR' && H.getCity()) { panelState = { tab: 'restock' }; openUI('restock'); return true; }
    if (e.code === 'KeyC') { panelState = { tab: 'caravan' }; openUI('caravan'); return true; }
    return false;
  };

  // ---------------- panels ----------------
  let panelState = {};
  function render() {
    if (!ui) return;
    let h = '';
    if (ui === 'vendor') h = renderVendor();
    else if (ui === 'journal') h = renderJournal();
    else if (ui === 'caravan') h = renderCaravanPanel();
    else if (ui === 'audience') h = renderAudience();
    else if (ui === 'restock') { const c = H.getCity() || W.cityById[nearestCityId()]; h = head('Supplies', `${c.name} · ${REALMS[ECON.realmOf(c.id)].name}`) + renderSupplies(c); }
    else if (ui === 'event' || ui === 'win' || ui === 'intro' || ui === 'story') return;
    panel.className = 'mx-panel' + (ui === 'vendor' ? ' wide' : '');
    panel.innerHTML = h;
  }
  function head(title, sub) { return `<div class="mx-h"><div><div class="mx-t">${title}</div><div class="mx-sub">${sub || ''}</div></div><div class="mx-hr">${coinsHtml(S.coins)} ${CURRENCY}<br><span class="mx-dim">cargo ${fmt1(load())} / ${capacity()} loads</span></div><button class="mx-x" data-act="close">✕</button></div>`; }
  function qtyBar() { return `<div class="mx-qty">Quantity: ${[1, 5, 10, 25, 9999].map(q => `<button data-act="qty" data-q="${q}" class="${panelState.qty === q ? 'on' : ''}">${q === 9999 ? 'Max' : q}</button>`).join('')}</div>`; }
  function bestKnown(g, exclude) { let best = null; for (const cid in S.seen) { if (cid === exclude) continue; const p = S.seen[cid].sell[g]; if (p && (!best || p > best.p)) best = { p, cid, day: S.seen[cid].day }; } return best; }
  function renderVendor() {
    const v = panelState.vendor, c = W.cityById[nearestCityId()];
    const title = `${v.name}, ${ROLES[v.role]}`; const sub = `${c.name} · ${REALMS[ECON.realmOf(c.id)].name}`;
    if (v.role === 'merchant') { const t = panelState.mtab || 'market';
      const tabs = `<div class="mx-tabs">${[['market', 'Market'], ['provisions', 'Provisions'], ['news', 'Town news']].filter(t => t[0] !== 'news' || unl('news')).map(([k, n]) => `<button data-act="mtab" data-t="${k}" class="${t === k ? 'on' : ''}">${n}</button>`).join('')}</div>`;
      return head(title, sub) + tabs + (t === 'provisions' ? renderSupplies(c) : t === 'news' ? renderTownNews(c) : renderMarket(c)); }
    if (v.role === 'guild') return head(title, sub) + renderGuild(c);
    return head(title, sub) + renderOutfitter(c);
  }
  function renderMarket(c) {
    const st = S.stock[c.id] || { q: {} };
    const mk0 = MARKETS[MARKET.of(c.id)]; const kd = MARKET.kind(c.id);
    let h = qtyBar() + `<div class="mx-mk" style="--mk:${mk0 ? mk0.color : '#8a6a3a'}">${mk0 ? `<b>${mk0.name}</b> market` : ''} · ${MARKET.kindName[kd]}, ${MARKET.slotsText[kd]}${MARKET.isSpecialty(c.id) ? ' · <i>specialty town</i>' : ''} · stock changes after 3 days away</div>` + '<div class="mx-cols"><div><div class="mx-ct">For sale here</div><table class="mx-tb"><tr><th>Good</th><th>Price</th><th>Stock</th><th></th></tr>';
    for (const g of ECON.offers(c.id)) {
      const G = GOOD[g]; const p = ECON.buyPrice(S, g, c.id, S.day); const q = Math.floor(st.q[g] ?? ECON.stockMax(g, c.id)); const bk = bestKnown(g, c.id);
      const gg = goodGuide(g);
      h += `<tr title="${G.blurb}" data-pg="${g}"><td class="mx-gc">${ICONS(g)}<div><b class="${MARKET.rarClass(g)}">${G.name}</b> <span class="rar-tag ${MARKET.rarClass(g)}">${MARKET.rarName(g)}</span><br><span class="mx-dim">${G.livestock ? `Livestock: walks with the caravan, eats ${G.fodder} fodder a day` : `${SIZES[G.size || 'medium'].name}, ${G.w} load per ${G.unit}`} · sells best in ${gg.best}${bk ? `<br>best you've seen: ${fmt(bk.p)} at ${W.cityById[bk.cid].name.replace(/ \(.*\)/, '')}` : ''}</span></div></td><td>${fmt1(p)}</td><td>${q}</td><td><button data-act="buy" data-g="${g}" ${q < 1 || S.coins < p ? 'disabled' : ''}>Buy</button></td></tr>`;
    }
    h += '</table></div><div><div class="mx-ct">Your cargo</div><table class="mx-tb"><tr><th>Good</th><th>Have</th><th>Price here</th><th></th></tr>';
    const keys = Object.keys(S.cargo).filter(g => S.cargo[g] > 0);
    if (!keys.length) h += '<tr><td colspan="4" class="mx-dim">Your packs are empty.</td></tr>';
    for (const g of keys) {
      const G = GOOD[g];
      if (G.quest) { h += `<tr><td class="mx-gc">${ICONS(g)}<div><b>${G.name}</b><br><span class="mx-dim">${G.dest || (g === 'letter' ? 'To deliver to Sarai' : 'To deliver to Samarkand')}</span></div></td><td>${S.cargo[g]}</td><td>—</td><td></td></tr>`; continue; }
      const p = ECON.sellPrice(S, g, c.id, S.day); const paid = S.basis[g] || 0; const cls = paid ? (p > paid * 1.02 ? 'mx-ok' : p < paid * .98 ? 'mx-bad' : '') : '';
      h += `<tr title="${G.blurb}" data-pg="${g}" data-ref="${p.toFixed(2)}"><td class="mx-gc">${ICONS(g)}<div><b class="${MARKET.rarClass(g)}">${G.name}</b><br><span class="mx-dim">${paid ? 'paid ' + fmt1(paid) + ' each' : 'acquired on the road'} · best in ${goodGuide(g).best}</span></div></td><td>${S.cargo[g]}</td><td class="${cls}">${fmt1(p)}${paid ? `<br><span class="mx-dim">${p >= paid ? '+' : '−'}${fmt1(Math.abs(p - paid))} each</span>` : ''}</td><td><button data-act="sell" data-g="${g}">Sell</button> <button data-act="sell" data-g="${g}" data-all="1">All</button></td></tr>`;
    }
    h += '</table></div></div>' + renderContracts(c) + '<div class="mx-note">Your reputation of ${Math.round(S.rep)} gets you <b>${(ECON.repBonus(S) * 100).toFixed(1)}%</b> better prices, buying and selling (up to 8% at 100). Prices fall as you sell and rise as you buy; markets recover over weeks. An interpreter gets you better prices too.</div>';
    return h;
  }
  function freeSpace() { return Math.max(0, capacity() - load()); }
  function freeSupplySpace(k = 'water') { return Math.floor(freeSpace() / SUPPLY_W[k] + 1e-6); }
  function supplyCap(k) { return S[k] + freeSupplySpace(k); }
  function roadNeeds(c, g) {
    const e = W.edges[g.edge]; const mid = e.start + (e.n >> 1); const t = terrainAt(W.P.X[mid], W.P.Z[mid]);
    const days = g.km / speedKm(S, t, isMountainEdge(e), ECON.realmOf(g.other)); const D = days * 1.1;
    return { days, t, food: Math.ceil(D * S.people() * seasonMul('food', t)), water: Math.ceil(D * waterUse() * aridFrac(e) * seasonMul('water', t)), fodder: Math.ceil(D * fodderUse() * seasonMul('fodder', t)) };
  }
  function roadDays(c, g) { const e = W.edges[g.edge]; const mid = e.start + (e.n >> 1); const t = terrainAt(W.P.X[mid], W.P.Z[mid]); return { days: g.km / speedKm(S, t, isMountainEdge(e), ECON.realmOf(g.other)), arid: aridFrac(e) * seasonMul('water', t), closed: passClosed(e) }; }
  function longestRoadDays(c) { const cc = W.cityById[c.id]; let m = 0; for (const g of cc.gates) m = Math.max(m, roadDays(cc, g).days * 1.1); return m; }
  function restockNeeds(days, arid) { return { food: Math.ceil(days * S.people()), water: Math.ceil(days * waterUse() * (arid === undefined ? 1 : arid)), fodder: Math.ceil(days * fodderUse()) }; }
  function restockCost(c, need) { let cost = 0, free = freeSpace(), short = false; const buy = {}; for (const k of ['water', 'food', 'fodder']) { const want = Math.max(0, (need[k] || 0) - Math.floor(S[k])); buy[k] = Math.min(want, Math.floor(free / SUPPLY_W[k] + 1e-6)); if (buy[k] < want) short = true; free -= buy[k] * SUPPLY_W[k]; cost += buy[k] * ECON.supplyPrice(k, c.id); } return { buy, cost, short }; }
  function doRestock(c, days, arid) {
    if (arid === undefined) { arid = 0; const cc = W.cityById[c.id]; for (const g of cc.gates) arid = Math.max(arid, aridFrac(W.edges[g.edge])); }
    const { buy } = restockCost(c, restockNeeds(days, arid)); const got = []; let spent = 0;
    for (const k of ['water', 'food', 'fodder']) { const p = ECON.supplyPrice(k, c.id); const n = Math.min(buy[k], Math.floor(S.coins / p)); if (n > 0) { S.coins -= n * p; S[k] += n; spent += n * p; got.push(`${n} ${k}`); } }
    return got.length ? `Restocked ${got.join(', ')} for ${fmt(spent)} ${CURRENCY}.` : '';
  }
  function doRestockRoad(c, other) {
    const cc = W.cityById[c.id]; const g = cc.gates.find(g => g.other === other); if (!g) return ''; const N = roadNeeds(cc, g); const { buy } = restockCost(c, { food: N.food, water: N.water, fodder: N.fodder });
    const got = []; let spent = 0; for (const k of ['water', 'food', 'fodder']) { const p = ECON.supplyPrice(k, c.id); const n = Math.min(buy[k], Math.floor(S.coins / p)); if (n > 0) { S.coins -= n * p; S[k] += n; spent += n * p; got.push(`${n} ${k}`); } }
    return got.length ? `Restocked ${got.join(', ')} for ${fmt(spent)} ${CURRENCY}.` : '';
  }
  function renderRestock(c) {
    const cc = W.cityById[c.id]; const maxD = 30;
    let h = `<div class="mx-ct">Restock for the road</div><table class="mx-tb wide"><tr><th>Road</th><th>Days</th><th>Needs</th><th>Cost</th><th></th></tr>`;
    for (const g of cc.gates) { const N = roadNeeds(cc, g); const days = N.days, arid = W.edges[g.edge] ? aridFrac(W.edges[g.edge]) : 0; const need = { food: N.food, water: N.water, fodder: N.fodder }; const { buy, cost, short } = restockCost(c, need);
       const have = buy.food + buy.water + buy.fodder === 0;
      h += `<tr><td><b>${W.cityById[g.other].name}</b><br><span class="mx-dim">${fmt(mi(g.km))} mi ${g.dir}${arid > .3 ? ' · dry country' : ''}</span></td><td>${Math.ceil(days)}${passClosed(W.edges[g.edge]) ? '<br><span class="mx-bad">snowed in</span>' : ''}${short ? '<br><span class="mx-bad">not enough room</span>' : ''}</td><td>food ${need.food}${need.water ? ` · water ${need.water}` : ''}${need.fodder ? ` · fodder ${need.fodder}` : ''}</td><td>${have ? '<span class="mx-ok">ready</span>' : fmt(cost)}</td><td>${have ? '' : `<button data-act="restock" data-gate="${g.other}" ${S.coins < 1 ? 'disabled' : ''}>Restock</button>`}</td></tr>`; }
    const full = restockCost(c, restockNeeds(maxD, 1)); const fn = restockNeeds(maxD, 1);
    h += `<tr><td><b>Stock for ${maxD} days</b><br><span class="mx-dim">including water for dry country</span>${full.short ? '<br><span class="mx-bad">not enough room</span>' : ''}</td><td>${maxD}</td><td>food ${fn.food}${fn.fodder ? ` · fodder ${fn.fodder}` : ''} · water ${fn.water}</td><td>${fmt(full.cost)}</td><td><button data-act="restock" data-days="${maxD}" data-arid="1">Stock up</button></td></tr></table>`;
    const a = S.autoRestock || 'off';
    h += `<div class="mx-qty">Restock automatically when you arrive in a city: ${[['off', 'Off'], ['longest', 'For the longest road'], ['full', 'For 30 days']].map(([v, n]) => `<button data-act="autorestock" data-v="${v}" class="${a === v ? 'on' : ''}">${n}</button>`).join('')}</div>`;
    return h + '<div class="mx-note">Each road\'s needs include a 10% margin and the season\'s extra food, water and fodder, the same figures shown at the crossroads. Press <b>R</b> in any city to open this panel.</div>';
  }
  // ---------------- delivery contracts ----------------
  const CLIENTS = { byz: 'the house of Doukas', arab: 'a Damascene merchant', persian: 'a Tabrizi silk broker', central: 'a Bukharan trader', tarim: 'an Uyghur merchant', chinese: 'a Chinese ortogh agent', song: 'a Song merchant house', mongol: 'a Mongol noble\'s steward', steppe: 'a Kipchak trader', tibet: 'a Sakya monastery', rum: 'a Seljuk emir\'s agent', armenian: 'an Armenian trader', georgian: 'a Georgian merchant', yemen: 'a Rasulid merchant', indian: 'a Jain merchant house', sea: 'a royal trading agent' };
  const distCache = {};
  function distFrom(src) { if (distCache[src]) return distCache[src]; const adj = ECON.adj(); const d = { [src]: 0 }, done = {}; for (;;) { let u = null, b = Infinity; for (const k in d) if (!done[k] && d[k] < b) { b = d[k]; u = k; } if (!u) break; done[u] = 1; for (const [v, km] of adj[u] || []) if (!(v in d) || b + km < d[v]) d[v] = b + km; } return distCache[src] = d; }
  const hopCache = {};
  function hopsFrom(src) { if (hopCache[src]) return hopCache[src]; const adj = ECON.adj(); const h = { [src]: 0 }; let q = [src]; while (q.length) { const nq = []; for (const u of q) for (const [v] of adj[u] || []) if (!(v in h)) { h[v] = h[u] + 1; nq.push(v); } q = nq; } return hopCache[src] = h; }
  function cityContracts(c) {
    const period = 'v' + ((S.stock[c.id] && S.stock[c.id].visit) || 0); let seed = 0; for (const ch of c.id + period + (S.char || '') + (S.seed || '')) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const r = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const goods = ECON.offers(c.id).filter(g => !GOOD[g].special && !GOOD[g].livestock && 'cur'.includes(GOOD[g].rar || 'c')); if (!goods.length) return [];
    const dist = distFrom(c.id), hops = hopsFrom(c.id); const out = [];
    const cands = W.cities.filter(o => o.id !== c.id && !o.holy && hops[o.id] >= 2 && hops[o.id] <= 5);
    for (let i = 0; i < 3 && cands.length; i++) {
      const g = goods[Math.floor(r() * goods.length)]; const G = GOOD[g];
      const want = 2 + Math.floor(r() * 4); let pool = cands.filter(o => hops[o.id] === want); if (!pool.length) pool = cands;
      let best = null; for (let t = 0; t < 8; t++) { const o = pool[Math.floor(r() * pool.length)]; const gain = ECON.mid(g, o.id, S.day) / ECON.mid(g, c.id, S.day); if (!best || gain > best.gain) best = { o, gain }; }
      const km = dist[best.o.id], hp = hops[best.o.id]; const loads = 1 + r() * 1.5; const unit = ECON.mid(g, c.id, S.day);
      const n = Math.max(1, Math.min(Math.round(loads / G.w), Math.round((250 + 80 * hp) / unit)));
      // pay must beat buying the same goods here and selling them there yourself
      const selfProfit = n * Math.max(0, ECON.sellPrice(S, g, best.o.id, S.day) - ECON.buyPrice(S, g, c.id, S.day));
      const reward = Math.round(Math.max(30, selfProfit * 1.4 + n * ECON.mid(g, c.id, S.day) * 0.15 + hp * 18 + km * 0.02));
      const days = Math.ceil(km / 15) + 8; const id = `${c.id}-${period}-${i}`;
      if (S.takenC && S.takenC[id]) continue;
      out.push({ id, g, n, to: best.o.id, from: c.id, km: Math.round(km), hops: hp, reward, days, selfProfit: Math.round(selfProfit), client: CLIENTS[c.culture] || 'a local merchant' });
    }
    return out;
  }
  function renderContracts(c) {
    const list = cityContracts(c); const mine = (S.contracts || []);
    let h = `<div class="mx-ct">Delivery contracts</div><table class="mx-tb wide"><tr><th>Consignment</th><th>Deliver to</th><th>Time allowed</th><th>Pay on delivery</th><th></th></tr>`;
    if (!list.length) h += '<tr><td colspan="5" class="mx-dim">No one here needs goods carried right now. Offers change every few weeks.</td></tr>';
    for (const k of list) { const G = GOOD[k.g]; h += `<tr data-route="${k.from}|${k.to}"${k.id.startsWith('story') ? ' class="mx-hl"' : ''}><td class="mx-gc">${ICONS(k.g, 32)}<div><b>${k.n} ${G.unit}${k.n > 1 ? 's' : ''} of ${lcName(G.name)}</b><br><span class="mx-dim">for ${k.client} · ${fmt1(G.w * k.n)} ${G.w * k.n === 1 ? 'load' : 'loads'}</span></div></td><td>${W.cityById[k.to].name}<br><span class="mx-dim">${k.hops} cities away · ${fmt(mi(k.km))} mi</span></td><td>${k.days} days</td><td><b>${fmt(k.reward)}</b> ${CURRENCY}${k.selfProfit > 0 ? `<br><span class="mx-dim">trading it yourself: about ${fmt(k.selfProfit)}</span>` : ''}</td><td><button data-act="contract" data-id="${k.id}" ${mine.length >= 3 ? 'disabled' : ''}>Accept</button></td></tr>`; }
    h += '</table>';
    if (mine.length) h += `<div class="mx-dim" style="margin:4px 0 0">Your contracts: ${mine.map(k => `<span data-route="${c.id}|${k.to}" style="cursor:help;text-decoration:underline dotted">${k.n} ${lcName(GOOD[k.g].name)} to <b>${W.cityById[k.to].name}</b></span> by day ${Math.floor(k.due)}`).join(' · ')}</div>`;
    return h + '<div class="mx-note">You pay nothing up front: the goods are entrusted to you, and you are paid when you arrive. Miss the deadline or lose the goods and your reputation suffers. At most three contracts at once.</div>';
  }
  function failContracts(why) { const n = (S.contracts || []).length; if (!n) return 0; for (const k of S.contracts) S.rep = Math.max(0, S.rep - 6); S.contracts = []; setTimeout(() => H.showToast('Contracts lost', `The consignments you carried were ${why}. Your clients will remember (reputation −${6 * n}).`, 'Contracts'), 2500); return n; }
  function renderSupplies(c) {
    let h = '<div class="mx-qty"><button data-act="supply1each">Buy 1 of each</button></div><table class="mx-tb wide"><tr><th>Supply</th><th>Price</th><th>You have</th><th>Lasts</th><th>Buy</th></tr>';
    const use = { food: S.people(), water: waterUse(), fodder: fodderUse() };
    for (const k of ['food', 'water', 'fodder'].filter(k => k !== 'water' || unl('water'))) {
      if (k === 'fodder' && !fodderUse()) { h += `<tr><td><b>Fodder</b></td><td colspan="4" class="mx-dim">You have no animals to feed.</td></tr>`; continue; }
      const p = ECON.supplyPrice(k, c.id);
      h += `<tr><td><b>${SUPPLY[k].name}</b><br><span class="mx-dim">${Math.round(1 / SUPPLY_W[k])} per load${k === 'water' ? ' · only used in dry country' : ''}</span></td><td>${p.toFixed(2)}</td><td>${fmt(S[k])}</td><td>${fmt(S[k] / use[k])} days</td><td><button data-act="supply" data-k="${k}" data-n="1">+1</button> ${[10, 30, 60].map(d => `<button data-act="supply" data-k="${k}" data-d="${d}">+${d}d</button>`).join(' ')} <button data-act="sellsupply" data-k="${k}" ${S[k] < 1 ? 'disabled' : ''}>Sell 10</button></td></tr>`;
    }
    h += '</table>';
    return h + renderRestock(c) + '<div class="mx-note">Each person eats one ration a day. Animals eat fodder. In deserts and dry plateaus everyone drinks water; camels drink very little. Supplies take cargo space: 20 rations or bundles of fodder, or 10 waterskins, make one load.</div>';
  }
  function avail(kind, c) {
    const cul = c.culture; const north = c.lat > 35.5;
    const M = { donkey: true, mule: !['mongol', 'tarim'].includes(cul), horse: ['byz', 'rum', 'persian', 'arab', 'armenian', 'georgian', 'central', 'yemen', 'indian'].includes(cul) || c.id === 'yachi' || c.id === 'dali', pony: ['mongol', 'tarim', 'central'].includes(cul) || (cul === 'chinese' && north),
      camel: ['arab', 'persian', 'central', 'tarim', 'mongol', 'yemen'].includes(cul) || (cul === 'indian' && c.lon < 77.5 && c.lat > 22) || (cul === 'chinese' && north && c.lon < 112) || c.id === 'hormuz', yak: cul === 'tibet' || c.id === 'xining' || c.id === 'kathmandu', elephant: cul === 'sea' || (cul === 'indian' && c.lon > 74.5 && c.id !== 'kathmandu') };
    return M[kind];
  }
  function renderOutfitter(c) {
    const tab = panelState.otab || 'animals';
    let h = `<div class="mx-tabs">${[['animals', 'Pack animals'], ['speed', 'Speed'], ['wheels', 'Carts'], ['hire', 'Hire men'], ['arms', 'Arms'], ['special', 'Other']].map(([k, n]) => `<button data-act="otab" data-t="${k}" class="${tab === k ? 'on' : ''}">${n}</button>`).join('')}</div>`;
    const row = (name, desc, price, btns) => `<tr><td><b>${name}</b><br><span class="mx-dim">${desc}</span></td><td>${price}</td><td>${btns}</td></tr>`;
    h += '<table class="mx-tb wide">';
    if (tab === 'animals') {
      h += `<tr><th colspan="3">Pack animals carry your goods. Speed comes from upgrades (see the Speed tab).</th></tr>`;
      const terr = { elephant: 'slow, but carries as much as five camels', camel: 'camels: +8% speed in the desert if they are most of your animals', yak: 'yaks: +8% in Tibet', mule: 'mules: +8% on mountain roads' };
      for (const k of ['donkey', 'mule', 'horse', 'camel', 'yak', 'elephant']) { if (!avail(k, c) && !S.pack[k]) continue; const p = PACK[k];
        h += row(`${p.name} <span class="mx-dim">× ${S.pack[k] || 0}</span>`, `+${p.cap} loads · fodder ${p.fodder}/day, water ${p.water}/day${terr[k] ? ' · ' + terr[k] : ''}`, fmt(p.cost), `${avail(k, c) ? `<button data-act="pack" data-k="${k}" ${S.coins < p.cost ? 'disabled' : ''}>Buy</button>` : ''} <button data-act="sellpack" data-k="${k}" ${!S.pack[k] ? 'disabled' : ''}>Sell (${fmt(p.cost * .5)})</button>`); }
    } else if (tab === 'speed') {
      const tier = ECON.tierOf(c); const sp = S.speed;
      h += `<tr><th colspan="3">Caravan speed: ${mi(speedKm())} mi/day (base ${BASE_SPEED} + ${Math.round(speedBonus(S) * 100)}%). Faster caravans need fewer days, and less food and water, on every road.</th></tr>`;
      for (const k in SPEED_UPS) { const u = SPEED_UPS[k]; if (u.hidden && sp.breed !== k) continue;
        const here = (!u.cities || u.cities.includes(c.id)) && (!u.minTier || tier >= u.minTier) && (!u.cultures || u.cultures.includes(c.culture));
        const owned = u.slot ? sp.breed === k : sp[k];
        const where = u.cities ? `Only sold at ${u.cities.map(id => W.cityById[id] ? W.cityById[id].name.replace(/ \(.*\)/, '') : id).join(', ')}.` : u.minTier >= 3 ? 'Only in great cities.' : u.minTier ? 'Not in small towns.' : '';
        const eff = u.bonus ? `+${Math.round(u.bonus * 100)}% speed` : `carts +${mi(u.wheel)} mi/day`;
        const repOk = !u.rep || S.rep >= u.rep; const slotNote = u.slot && sp.breed && sp.breed !== k ? ' Replaces your current breeding stock.' : '';
        const btn = owned ? '<i>owned</i>' : !here ? `<span class="mx-dim">${where}</span>` : !repOk ? `<span class="mx-dim">needs reputation ${u.rep}</span>` : `<button data-act="speedup" data-k="${k}" ${S.coins < u.cost ? 'disabled' : ''}>Buy</button>`;
        h += row(u.name, `${eff} · ${u.blurb}${slotNote}${u.slot ? ' (Only one breed of animal at a time.)' : ''}`, u.cost ? fmt(u.cost) : '—', btn); }
      h += `<tr><td colspan="3" class="mx-dim">Also: a guide +5%; a paiza +10% in Mongol lands (fresh horses at the yam stations); the right pack animals +8% in their terrain. Carts and wagons limit you to ${VEHICLE_SPEED.cart} and ${mi(VEHICLE_SPEED.wagon)} mi/day.</td></tr>`;
    } else if (tab === 'wheels') {
      const can = !['tibet', 'tarim'].includes(c.culture);
      for (const k of ['cart', 'wagon']) { const v = VEHICLES[k]; h += row(`${v.name} <span class="mx-dim">× ${S.veh[k] || 0}</span>`, `+${v.cap} loads · caravan limited to ${mi(VEHICLE_SPEED[k] + (S.speed.wheels ? SPEED_UPS.wheels.wheel : 0))} mi/day · ${v.blurb}`, fmt(v.cost), `${can ? `<button data-act="veh" data-k="${k}" ${S.coins < v.cost ? 'disabled' : ''}>Buy</button>` : '<span class="mx-dim">not sold here</span>'} <button data-act="sellveh" data-k="${k}" ${!S.veh[k] ? 'disabled' : ''}>Sell (${fmt(v.cost * .5)})</button>`); }
      h += `<tr><td colspan="3" class="mx-dim">Mountain roads closed to wheels: the Pamir and Hindu Kush passes, the roads into Tibet, the plank roads to Chengdu, and the Taurus and Pontic passes.</td></tr>`;
    } else if (tab === 'hire') {
      for (const k of Object.keys(HIRES)) { const hh = HIRES[k]; if (hh.special && !S.hires[k]) continue; if (k === 'archer' && !REALMS[ECON.realmOf(c.id)].mongol) continue;
        h += row(`${hh.name} <span class="mx-dim">× ${S.hires[k] || 0}</span>`, `${hh.blurb}${hh.str ? ` (+${hh.str} strength)` : ''} · wage ${hh.wage}/day`, fmt(hh.cost), `<button data-act="hire" data-k="${k}" ${S.coins < hh.cost ? 'disabled' : ''}>Hire</button> <button data-act="fire" data-k="${k}" ${!S.hires[k] ? 'disabled' : ''}>Dismiss</button>`); }
    } else if (tab === 'arms') {
      for (const k of Object.keys(ARMS)) { const a = ARMS[k]; const have = S.arms[a.slot] === k; h += row(a.name, `+${a.str} strength (${a.slot})`, fmt(a.cost), have ? '<i>owned</i>' : `<button data-act="arms" data-k="${k}" ${S.coins < a.cost ? 'disabled' : ''}>Buy</button>`); }
      const u = UPGRADES.guardArms; const gc = (S.hires.guard || 0); h += row(u.name, u.blurb, `${u.cost} per guard`, S.up.guardArms ? '<i>done</i>' : `<button data-act="guardArms" ${!gc || S.coins < u.cost * gc ? 'disabled' : ''}>Arm ${gc} guards</button>`);
    } else if (tab === 'special') {
      const u = UPGRADES.bags; h += row(u.name, `+${u.cap} loads · ${u.blurb}`, fmt(u.cost), S.up.bags ? '<i>owned</i>' : `<button data-act="bags" ${S.coins < u.cost ? 'disabled' : ''}>Buy</button>`);
      if (c.culture === 'tibet') { const d = UPGRADES.dog; h += row(`${d.name} <span class="mx-dim">× ${S.up.dog || 0}</span>`, `+${d.str} strength · ${d.blurb}`, fmt(d.cost), `<button data-act="dog" ${(S.up.dog || 0) >= 2 || S.coins < d.cost ? 'disabled' : ''}>Buy</button>`); }
      if (PAIZA_CITIES.includes(c.id)) h += row(PAIZA.name, `${PAIZA.blurb} Requires reputation ${PAIZA.rep}.`, fmt(PAIZA.cost), S.paiza ? '<i>you carry one</i>' : `<button data-act="paiza" ${S.coins < PAIZA.cost || S.rep < PAIZA.rep ? 'disabled' : ''}>Petition the darughachi</button>`);
      else h += `<tr><td colspan="3" class="mx-dim">A Mongol paiza can be had from the darughachi (governor) at Tabriz, Baghdad, Sarai, Samarkand, Almaliq, Shangdu or Khanbaliq.</td></tr>`;
    }
    return h + '</table>';
  }
  function renderCaravanPanel() {
    let h = head('Your Caravan', `${dateOf(S.day)} · ${fmt(mi(S.kmTotal))} mi travelled · ${S.events} adventures on the road`);
    h += '<div class="mx-cols"><div><div class="mx-ct">People & animals</div><table class="mx-tb">';
    h += `<tr><td>You</td><td>${S.arms.weapon ? '' : 'Unarmed'}${S.arms.weapon ? ', ' + ARMS[S.arms.weapon].name : ''}${S.arms.armour ? ', ' + ARMS[S.arms.armour].name : ''}</td></tr>`;
    for (const k in S.hires) h += `<tr><td>${HIRES[k].name}</td><td>× ${S.hires[k]}</td></tr>`;
    for (const k in S.pack) if (S.pack[k]) h += `<tr><td>${PACK[k].name}</td><td>× ${S.pack[k]}</td></tr>`;
    for (const k in S.veh) if (S.veh[k]) h += `<tr><td>${VEHICLES[k].name}</td><td>× ${S.veh[k]}</td></tr>`;
    if (S.up.dog) h += `<tr><td>Tibetan mastiff</td><td>× ${S.up.dog}</td></tr>`;
    h += `</table><div class="mx-ct">Stats</div><table class="mx-tb"><tr><td>Speed</td><td>${mi(speedKm())} mi/day${Object.keys(S.speed).length ? '<br><span class="mx-dim">' + Object.entries(S.speed).map(([k, v]) => SPEED_UPS[k === 'breed' ? v : k].name).join(', ') + '</span>' : ''}</td></tr><tr><td>Strength</td><td>${strength()}</td></tr><tr><td>Reputation</td><td>${Math.round(S.rep)} / 100</td></tr><tr><td>Wages</td><td>${fmt1(wages())} per day</td></tr><tr><td>Net worth</td><td>${fmt(netWorth())} ${CURRENCY}</td></tr><tr><td>Trading profit</td><td>${fmt(S.profit || 0)} ${CURRENCY}</td></tr></table></div>`;
    h += '<div><div class="mx-ct">Cargo</div><table class="mx-tb">';
    const ks = Object.keys(S.cargo).filter(g => S.cargo[g] > 0); if (!ks.length) h += '<tr><td class="mx-dim">Nothing but your own bedroll.</td></tr>';
    for (const g of ks) h += `<tr><td>${GOOD[g].name}</td><td>${S.cargo[g]} ${GOOD[g].unit}${S.cargo[g] === 1 ? '' : 's'}</td><td>${fmt1(GOOD[g].w * S.cargo[g])} loads</td></tr>`;
    h += `<tr><td>Food / water / fodder</td><td>${fmt(S.food)} / ${fmt(S.water)} / ${fmt(S.fodder)}</td><td>${fmt1(S.food * SUPPLY_W.food + S.water * SUPPLY_W.water + S.fodder * SUPPLY_W.fodder)} loads</td></tr></table>`;
    h += `<div class="mx-ct">Dump supplies</div><div>${['food', 'water', 'fodder'].map(k => `<button data-act="dump" data-k="${k}" ${S[k] < 10 ? 'disabled' : ''}>Drop 10 ${k}</button>`).join(' ')}</div></div></div>`;
    return h;
  }
  function renderJournal() {
    const tab = panelState.tab || 'prices';
    let h = head('Journal', `${dateOf(S.day)} · ${S.visited.length} ${S.visited.length === 1 ? 'city' : 'cities'} visited`);
    h += `<div class="mx-tabs">${[['prices', 'Prices seen'], ['goods', 'Goods guide'], ['rumours', 'Rumours'], ['goal', S.camp ? 'Your story' : 'Your goal'], ['factions', 'Factions'], ['news', 'Market news'], ['calendar', 'Calendar'], ['help', 'How to trade']].filter(t => (t[0] !== 'news' || unl('news')) && (t[0] !== 'factions' || unl('factions'))).map(([k, n]) => `<button data-act="jtab" data-t="${k}" class="${tab === k ? 'on' : ''}">${n}</button>`).join('')}</div>`;
    if (tab === 'prices') {
      const cs = Object.keys(S.seen).sort((a, b) => S.seen[b].day - S.seen[a].day).slice(0, 9);
      if (!cs.length) return h + '<p>You have not yet visited a market.</p>';
      h += '<div class="mx-scroll"><table class="mx-tb mx-grid"><tr><th>Selling price</th>' + cs.map(c => `<th>${W.cityById[c].name.replace(/ \(.*\)/, '')}<br><span class="mx-dim">day ${S.seen[c].day}</span></th>`).join('') + '</tr>';
      const gl = GOODS.filter(g => cs.some(c => S.seen[c].buy[g.id]) || S.cargo[g.id]);
      for (const g of gl) { const vals = cs.map(c => S.seen[c].sell[g.id]); const mx = Math.max(...vals), mn = Math.min(...vals);
        h += `<tr><td><b class="${MARKET.rarClass(g.id)}">${g.name}</b></td>${cs.map((c, i) => { const b = S.seen[c].buy[g.id]; return `<td class="${vals[i] === mx ? 'mx-ok' : vals[i] === mn ? 'mx-bad' : ''}">${fmt(vals[i])}${b ? `<br><span class="mx-dim">buy ${fmt(b)}</span>` : ''}</td>`; }).join('')}</tr>`; }
      h += '</table></div><div class="mx-note">Green is the best selling price you have seen, red the worst. "Buy" marks where a good was on sale.</div>';
    } else if (tab === 'goods') {
      // v19: grouped by market, rarest first
      const card = g => { const gg = goodGuide(g.id); return `<div class="mx-good">${ICONS(g.id, 48)}<div><b class="${MARKET.rarClass(g.id)}">${g.name}</b> <span class="rar-tag ${MARKET.rarClass(g.id)}">${MARKET.rarName(g.id)}</span> <span class="mx-dim">${g.w} load per ${g.unit}</span><br><span class="mx-lab">Made in</span> ${gg.made}<br><span class="mx-lab">Sells best</span> ${gg.best}${gg.bestCities.length ? ` <span class="mx-dim">(${gg.bestCities.join(', ')})</span>` : ''}<br><span class="mx-dim">${g.blurb}</span></div></div>`; };
      h += '<div class="mx-note">Each market sells its own goods. They fetch little at home and more the further you carry them, most of all in markets that want that kind of good. Commons are always on sale; uncommon, rare, epic and legendary goods turn up by chance, and the rarest only in the towns that make them or in the market\'s capital.</div>';
      for (const mid of MARKET_ORDER) { const M = MARKETS[mid]; const gs = MARKET.goodsOf(mid).slice().sort((a, b) => RAR_ORDER.indexOf(b.rar) - RAR_ORDER.indexOf(a.rar) || a.name.localeCompare(b.name)); if (mid === 'mamluk') gs.unshift(GOOD.holyoil);
        h += `<div class="mx-mk" style="--mk:${M.color}"><b>${M.name}</b> · capital ${W.cityById[M.hub].name.replace(/ \(.*\)/, '')}</div><div class="mx-goods">` + gs.map(card).join('') + '</div>'; }
    } else if (tab === 'rumours') {
      h += S.rumours.length ? '<ul class="mx-list">' + S.rumours.slice(-14).reverse().map(r => `<li>${r}</li>`).join('') + '</ul>' : '<p>You have heard no rumours yet. Travellers on the road often share news of distant markets.</p>';
    } else if (tab === 'news') h += renderMarketNews();
    else if (tab === 'factions') h += factionsJournalHtml();
    else if (tab === 'calendar') h += renderCalendar();
    else if (tab === 'goal') h += (S.camp ? campJournalHtml() : goalHtml()) + ((S.contracts || []).length ? '<div class="mx-ct">Delivery contracts</div><ul class="mx-list">' + S.contracts.map(k => `<li data-route="${k.from || nearestCityId()}|${k.to}" style="cursor:help">${k.n} ${GOOD[k.g].unit}s of ${lcName(GOOD[k.g].name)} to <b>${W.cityById[k.to].name}</b> (${fmt(mi(k.km))} mi) by day ${Math.floor(k.due)}: ${fmt(k.reward)} ${CURRENCY}</li>`).join('') + '</ul>' : '');
    else h += `<ul class="mx-list"><li>The roads are divided into <b>eleven markets</b> (see the <b>Markets</b> layer on the map, <b>M</b>). Each sells its own goods, which fetch little at home and more the further you carry them, most of all in markets that want that kind of good: the Indian kingdoms pay most for horses, the Chinese for spices and gems.</li><li>Goods come in five rarities: <span class="rar-c">common</span>, <span class="rar-u">uncommon</span>, <span class="rar-r">rare</span>, <span class="rar-e">epic</span> and <span class="rar-l">legendary</span>. Commons are always on sale; the rest turn up by chance, and the rarest only in the towns that make them (◆ on the map) or in the market's capital. A merchant's stock changes once you have been away three days or visited another city.</li>
      <li>Each road shows its travel time, and whether your food, water and fodder will last.</li><li>Press <b>R</b> in any city to restock supplies for any road out, or to fill up. Supplies take cargo space (20 rations or fodder bundles, or 10 waterskins, per load).</li><li>Merchants offer <b>delivery contracts</b>: carry their goods to another city and get paid on arrival, with nothing paid up front.</li><li>Pack animals, carts and wagons carry more, but every animal eats, and carts cannot cross the mountains.</li>
      <li>Crossing into a new realm costs a toll on your cargo. A Mongol paiza halves it in Mongol lands.</li><li>Guards, archers, weapons and armour raise your strength against bandits. A guide reduces trouble and finds the wells.</li>
      <li>Selling a lot in one place drives the price down. Spread your sales across several markets.</li><li>If you are robbed or your caravan collapses, you lose your goods but keep your silver.</li></ul>`;
    return h;
  }
  function westernGiftValue() { let v = 0; for (const g in S.cargo) { const G = GOOD[g]; if (G.quest || G.special) continue; if (ECON.dist[g] && ECON.dist[g].khanbaliq >= 3500) v += ECON.mid(g, 'khanbaliq', S.day) * S.cargo[g]; } return v; }
  function goalChecks() {
    const nw = netWorth(); const gift = S.cargo.holyoil > 0 || westernGiftValue() >= 1200;
    return [
      { ok: nw >= 6000, t: `A fortune worthy of the court: net worth of 6,000 ${CURRENCY}`, v: `${fmt(nw)} now` },
      { ok: gift, t: 'A gift worthy of the Khan: oil from the Holy Sepulchre (sold at Jerusalem, Acre and Ayas), or western treasures worth 1,200 at Khanbaliq prices', v: S.cargo.holyoil ? 'You carry the holy oil' : `${fmt(westernGiftValue())} in western goods` },
      { ok: S.rep >= 40 || S.paiza, t: 'Standing: reputation 40, or a paiza from the Khan\'s officials', v: S.paiza ? 'You carry a paiza' : `reputation ${Math.round(S.rep)}` },
    ];
  }
  function goalType() { return S.goalOverride || charOf(S).goal.type; }
  function charGoalChecks() {
    const G = charOf(S).goal, t = goalType(), nw = netWorth();
    if (t === 'audience') return goalChecks();
    if (t === 'reach') return [{ ok: G.cities.some(id => S.visited.includes(id)), t: `Reach ${G.cities.map(id => W.cityById[id].name).join(' or ')}`, v: `You are ${mi(roadKm(nearestCityId(), G.cities[0]))} mi away by road` }];
    if (t === 'hajj') return [{ ok: nw >= G.worth, t: `A fortune of ${fmt(G.worth)} ${CURRENCY} to give in charity`, v: `${fmt(nw)} now` }, { ok: S.visited.includes(G.city), t: 'Reach Mecca', v: `${mi(roadKm(nearestCityId(), G.city))} mi away by road` }];
    if (t === 'deadline') { const D = engineerDeadline(); return [{ ok: S.visited.includes(G.city), t: `Reach the siege of Xiangyang by day ${D} (${dateOf(D)})`, v: S.day <= D ? `${Math.round(D - S.day)} days left · ${mi(roadKm(nearestCityId(), G.city))} mi to go` : 'The deadline has passed' }]; }
    if (t === 'prince') return [{ ok: nw >= G.worth, t: `Net worth of ${fmt(G.worth)} ${CURRENCY}`, v: `${fmt(nw)} now` }, { ok: S.visited.length >= G.cities, t: `Visit ${G.cities} cities`, v: `${S.visited.length} visited` }];
    if (t === 'embassy') return [{ ok: !!S.cargo.letter, t: 'Carry the Sultan\'s letter (if it is taken, Cairo will give you another)', v: S.cargo.letter ? 'Sealed and safe in your baggage' : 'Lost! Return to Cairo' }, { ok: false, t: 'Deliver it to the Khan at Sarai', v: `${mi(roadKm(nearestCityId(), G.city))} mi away by road` }];
    return [];
  }
  function checkCharGoal(c) {
    if (S.won) return; const C = charOf(S), t = goalType(), G = C.goal;
    if (t === 'reach' && G.cities.includes(c.id)) return setTimeout(() => showWin('Pilgrimage complete', `After ${fmt(S.day)} days on the road you kneel at the tomb of Christ in the Church of the Holy Sepulchre. Like Rabban Sauma, you have crossed the whole of Asia on faith. The brethren of Jerusalem will tell your story for years.`), 1500);
    if (t === 'hajj' && c.id === G.city) { if (netWorth() >= G.worth) return setTimeout(() => showWin('The Hajj', `You walk around the Kaaba with pilgrims from every land, and give alms with an open hand. From the harbour of Zaitun to the Holy Mosque, overland: your father\'s wish is fulfilled, and you are now Hajji Pu.`), 1500);
      return setTimeout(() => H.showToast('Mecca', `You have reached the Holy City, but you hoped to arrive with ${fmt(G.worth)} ${CURRENCY} to give in charity. Trade some more and return.`, 'Goal'), 3500); }
    if (t === 'deadline' && c.id === G.city) { if (S.day <= engineerDeadline()) return setTimeout(() => showWin('The Fall of Xiangyang', `You reach the siege lines with ${Math.round(engineerDeadline() - S.day)} days to spare. Your counterweight trebuchets hurl stones of 150 jin over the walls, and in March 1273 the city that held out for five years surrenders. Kublai rewards you with silver and silk.`), 1500);
      S.goalOverride = 'audience'; return setTimeout(() => H.showToast('Too late', 'Other engineers have already built the trebuchets, and Xiangyang has fallen. You will have to win the Khan\'s favour another way: seek an audience with Kublai at Khanbaliq or Shangdu.', 'Goal'), 3500); }
    if (t === 'deadline' && S.day > engineerDeadline() && !S.flags.lateWarned) { S.flags.lateWarned = 1; S.goalOverride = 'audience'; setTimeout(() => H.showToast('Too late', 'Word comes down the road: Xiangyang has fallen to other engineers\' trebuchets. Your new goal is to win an audience with Kublai at Khanbaliq or Shangdu.', 'Goal'), 3500); }
    if (t === 'prince' && netWorth() >= G.worth && S.visited.length >= G.cities) return setTimeout(() => showWin('A Merchant Prince', `With ${fmt(netWorth())} ${CURRENCY} and agents in ${S.visited.length} cities, your house is known from Cambay to the far ends of the Silk Road. Jagaḍu Shah himself could not have done better.`), 1500);
    if (t === 'embassy' && c.id === G.city && S.cargo.letter) { delete S.cargo.letter; S.rep += 15; return setTimeout(() => showWin('The Sultan\'s Embassy', 'You kneel before the Khan of the Golden Horde and hand over Baybars\' letter. The alliance of Cairo and Sarai against the Ilkhans holds for another generation, and your name is honoured in both courts.'), 1500); }
  }
  function goalHtml() {
    if (goalType() !== 'audience' || S.char !== 'venetian') { const C = charOf(S);
      return `<p><b>${C.name}</b>, ${C.title}. ${S.goalOverride ? 'Your original mission failed. <b>Win an audience with Kublai Khan at Khanbaliq or Shangdu.</b>' : `<b>${C.goal.short}.</b> ${C.goal.text}`}</p><ul class="mx-checks">` +
        charGoalChecks().map(c => `<li class="${c.ok ? 'ok' : ''}">${c.ok ? '✔' : '○'} ${c.t}<br><span class="mx-dim">${c.v}</span></li>`).join('') + `</ul><p class="mx-dim"><b>${C.ability.name}:</b> ${C.ability.text}</p>`; }
    return `<p>In 1266 Kublai Khan sent the Polo brothers home with a request: return with a hundred learned men and oil from the lamp of the Holy Sepulchre. In 1271 they set out again with young Marco. <b>Reach the palace of the Great Khan at Khanbaliq or Shangdu, and win an audience.</b></p><ul class="mx-checks">` +
      goalChecks().map(c => `<li class="${c.ok ? 'ok' : ''}">${c.ok ? '✔' : '○'} ${c.t}<br><span class="mx-dim">${c.v}</span></li>`).join('') + '</ul>' +
      `<p class="mx-dim">The Polos took about three and a half years to reach Kublai's court. Can you do better?</p>`;
  }
  function renderAudience() {
    const ch = goalChecks(); const all = ch.every(c => c.ok);
    let h = head('The Palace of the Great Khan', W.cityById[nearestCityId()].name);
    if (!all) return h + `<p>A court official in silk robes looks you over. "The Son of Heaven does not receive every pedlar who arrives at his gates," he says. "Come back when you are worthy."</p><ul class="mx-checks">${ch.map(c => `<li class="${c.ok ? 'ok' : ''}">${c.ok ? '✔' : '○'} ${c.t}<br><span class="mx-dim">${c.v}</span></li>`).join('')}</ul><button data-act="close" class="mx-big">Leave the palace</button>`;
    return h + `<p>The doors of the great hall open. Courtiers in robes of gold kneel in rows, and at the far end, on a raised throne, sits Kublai, Khan of Khans and Emperor of the Yuan.</p><p>You prostrate yourself four times and present your gifts. ${S.cargo.holyoil ? 'When the Khan sees the oil from the Holy Sepulchre he smiles: it is the gift he asked for years ago.' : 'He turns your western treasures over in his hands and nods with interest.'}</p><button data-act="win" class="mx-big">Approach the throne</button>`;
  }
  function showWin(title, text) {
    S.won = true; save();
    const days = Math.round(S.day); const rank = days <= 1000 ? 'Swifter than the Polos' : days <= 1300 ? 'Worthy of Marco Polo' : days <= 1700 ? 'A Seasoned Merchant' : 'A Long Road';
    ui = 'win'; panel.className = 'mx-panel';
    panel.innerHTML = `<div class="mx-win"><div class="mx-eyebrow">${dateOf(S.day)}</div><div class="mx-wt">${title || 'An Audience with Kublai Khan'}</div><div class="mx-orn"></div>
      <p>${text || 'The Great Khan receives you with honour and asks about every land you crossed. Like Marco Polo, you will serve at his court, and one day tell the world of what you saw.'}</p>
      <div class="mx-stats"><div><b>${fmt(days)}</b><span>days on the road</span></div><div><b>${fmt(netWorth())}</b><span>${CURRENCY} net worth</span></div><div><b>${S.visited.length}</b><span>cities visited</span></div><div><b>${S.events}</b><span>adventures</span></div><div><b>${fmt(S.kmTotal)}</b><span>km travelled</span></div></div>
      <div class="mx-rank">${rank}</div><button data-act="close" class="mx-big">Continue exploring</button></div>`;
  }

  // ---------------- actions ----------------
  function act(a, d) {
    const c = W.cityById[nearestCityId()]; const q = panelState.qty || 1;
    const spend = n => { S.coins -= n; };
    if (guildAct(a, d, c)) { render(); updateHud(true); return; }
    switch (a) {
      case 'close': if (ui === 'event' && evtState) return finishEvent(); closeUI(); return;
      case 'qty': panelState.qty = +d.q; break;
      case 'restock': { const r = d.gate ? doRestockRoad(c, d.gate) : doRestock(c, +d.days, d.arid !== undefined ? +d.arid : undefined); H.showToast('Supplies', r || 'You already have enough for that road.', 'Merchant'); break; }
      case 'supply1each': { const ks = ['food', 'water'].concat(fodderUse() > 0 ? ['fodder'] : []); for (const k of ks) { const p = ECON.supplyPrice(k, c.id); if (S.coins >= p && freeSupplySpace(k) >= 1) { S[k] += 1; spend(p); } } break; }
      case 'autorestock': S.autoRestock = d.v; break;
      case 'contract': { const k = cityContracts(c).find(k => k.id === d.id); if (!k) break; if ((S.contracts || []).length >= 3) { H.showToast('Too many contracts', 'You can carry at most three contracts at once.', 'Contracts'); break; } if (load() + GOOD[k.g].w * k.n > capacity() + 1e-6) { H.showToast('No room', 'Your animals cannot carry this consignment.', 'Contracts'); break; }
        (S.contracts = S.contracts || []).push(Object.assign({}, k, { due: S.day + k.days })); (S.takenC = S.takenC || {})[k.id] = 1; break; }
      case 'buy': { const g = d.g; const st = S.stock[c.id]; let n = 0; for (let k = 0; k < q; k++) { const p = ECON.buyPrice(S, g, c.id, S.day); if (S.coins < p || (st.q[g] ?? 0) < 1) break; if (load() + GOOD[g].w > capacity() + 1e-6) { H.showToast('No room', 'Your animals cannot carry any more.', 'Caravan'); break; } spend(p); const have = S.cargo[g] || 0; S.basis[g] = ((S.basis[g] || 0) * have + p) / (have + 1); S.cargo[g] = have + 1; st.q[g]--; (S.sat[c.id] = S.sat[c.id] || {})[g] = (S.sat[c.id][g] || 0) - 1; n++; } if (g === 'holyoil' && n) S.rep += 3; break; }
      case 'sell': { const g = d.g; const qq = d.all ? 1e9 : q; if (S.camp && S.camp.act === 2 && S.cargo[g] > 0) { const mk = MARKET.of(c.id); S.camp.mk2 = S.camp.mk2 || []; if (mk && !S.camp.mk2.includes(mk)) S.camp.mk2.push(mk); } for (let k = 0; k < qq && S.cargo[g] > 0; k++) { const p = ECON.sellPrice(S, g, c.id, S.day); S.coins += p; S.cargo[g]--; (S.sat[c.id] = S.sat[c.id] || {})[g] = (S.sat[c.id][g] || 0) + 1; } if (!S.cargo[g]) { delete S.cargo[g]; delete S.basis[g]; } S.rep = Math.min(100, S.rep + 0.15 * Math.min(q, 25)); break; }
      case 'supply': { const k = d.k; const use = { food: S.people(), water: waterUse(), fodder: fodderUse() }[k]; let n = d.n ? +d.n : Math.ceil(use * +d.d); const p = ECON.supplyPrice(k, c.id); n = Math.min(n, Math.floor(S.coins / p), freeSupplySpace(k)); if (n <= 0) { H.showToast('Cannot buy', S.coins < p ? 'Not enough silver.' : 'No room left to carry it.', 'Supplies'); break; } S[k] += n; spend(n * p); break; }
      case 'sellsupply': { const k = d.k; const n = Math.min(10, Math.floor(S[k])); S[k] -= n; S.coins += n * ECON.supplyPrice(k, c.id) * .5; break; }
      case 'dump': S[d.k] = Math.max(0, S[d.k] - 10); break;
      case 'otab': panelState.otab = d.t; break;
      case 'jtab': panelState.tab = d.t; break;
      case 'speedup': { const u = SPEED_UPS[d.k]; if (S.coins < u.cost || (u.rep && S.rep < u.rep)) break; S.coins -= u.cost; if (u.slot) S.speed.breed = d.k; else S.speed[d.k] = 1; H.showToast(u.name, 'Your caravan now travels at ' + Math.round(speedKm()) + ' km a day.', 'Caravan'); break; }
      case 'mount': { const m = MOUNTS[d.k]; const trade = S.mount !== 'foot' ? MOUNTS[S.mount].cost * .5 : 0; const cost = Math.max(0, m.cost - trade); if (S.coins < cost) break; spend(cost); S.mount = d.k; applyMount(); rebuildCaravan(); break; }
      case 'pack': { const p = PACK[d.k]; if (S.coins < p.cost) break; spend(p.cost); S.pack[d.k] = (S.pack[d.k] || 0) + 1; rebuildCaravan(); break; }
      case 'sellpack': if (S.pack[d.k]) { S.pack[d.k]--; S.coins += PACK[d.k].cost * .5; if (!S.pack[d.k]) delete S.pack[d.k]; dropOverflow(); rebuildCaravan(); } break;
      case 'veh': { const v = VEHICLES[d.k]; if (S.coins < v.cost) break; spend(v.cost); S.veh[d.k] = (S.veh[d.k] || 0) + 1; rebuildCaravan(); break; }
      case 'sellveh': if (S.veh[d.k]) { S.veh[d.k]--; S.coins += VEHICLES[d.k].cost * .5; if (!S.veh[d.k]) delete S.veh[d.k]; dropOverflow(); rebuildCaravan(); } break;
      case 'hire': { const hh = HIRES[d.k]; if (S.coins < hh.cost) break; spend(hh.cost); S.hires[d.k] = (S.hires[d.k] || 0) + 1; rebuildCaravan(); break; }
      case 'fire': if (S.hires[d.k]) { S.hires[d.k]--; if (!S.hires[d.k]) delete S.hires[d.k]; rebuildCaravan(); } break;
      case 'arms': { const ar = ARMS[d.k]; if (S.coins < ar.cost) break; spend(ar.cost); S.arms[ar.slot] = d.k; break; }
      case 'guardArms': { const n = S.hires.guard || 0; if (!n || S.coins < UPGRADES.guardArms.cost * n) break; spend(UPGRADES.guardArms.cost * n); S.up.guardArms = 1; break; }
      case 'bags': if (S.coins >= UPGRADES.bags.cost) { spend(UPGRADES.bags.cost); S.up.bags = 1; } break;
      case 'dog': if (S.coins >= UPGRADES.dog.cost) { spend(UPGRADES.dog.cost); S.up.dog = (S.up.dog || 0) + 1; } break;
      case 'paiza': if (S.coins >= PAIZA.cost && S.rep >= PAIZA.rep) { spend(PAIZA.cost); S.paiza = true; S.rep += 5; H.showToast('Silver paiza', 'You hang the Khan\'s tablet of safe-conduct around your neck.', 'Caravan'); } break;
      case 'win': showWin(); return;
      case 'choice': return resolveChoice(+d.i);
      case 'evdone': return finishEvent();
      case 'newgame': return;
    }
    S.coins = Math.max(0, S.coins); render(); updateHud(true); if (H.getCity()) H.renderCross();
  }

  // ---------------- event engine ----------------
  let evtState = null;
  function eventContext() {
    const p = H.player; const t = terrainAt(p.x, p.z); const q = W.pathQuery(p.x, p.z); const e = q.i >= 0 ? W.edges[W.P.E[q.i]] : null;
    const nc = W.nearestCity(p.x, p.z).c; const realm = ECON.realmOf(nc.id);
    let danger = 1; const box = (a, b, c, d) => t.lon >= a && t.lon <= c && t.lat >= b && t.lat <= d;
    if (t.desert) danger *= 1.2; if (box(54, 26, 66, 33)) danger *= 1.4; if (box(41, 33, 47, 38.5)) danger *= 1.3; if (box(58, 34, 76, 42)) danger *= 1.25; if (realm === 'mamluk') danger *= 1.15;
    if (['byz', 'song'].includes(realm)) danger *= .8; if (S.flags.kd_token && realm === 'chagatai') danger *= .6; if (realm === 'yuan' && t.lon > 100) danger *= .7;
    const paizaSafe = S.paiza && REALMS[realm] && REALMS[realm].mongol;
    return { realm, biome: t.dom, lon: t.lon, lat: t.lat, edge: e, group: e && e.group, mountain: (e && isMountainEdge(e)) || t.dom === 'alpine', desert: t.desert, danger, cargo: goodsValue(nc.id), str: strength(), speed: Math.round(speedKm()), paizaSafe, city: nc.id };
  }
  const ROBBERY = ['brigands', 'kurds', 'qaraunas', 'mewati'];
  const HOSTILE = ['mongol_raid', 'kaidu', 'khafara', 'kd_revenge', 'om_revenge', 'turkomans'];
  function ruralHere() {
    const p = H.player; let dmin = 1e9; for (const c of W.cities) { const d = Math.hypot(c.x - p.x, c.z - p.z) - c.R; if (d < dmin) dmin = d; }
    const km = dmin * KMU; if (km < speedKm() * 2) return false;
    return W.settleAt(p.x, p.z) < 0.35;
  }
  function maybeEvent() {
    if (H.adm && H.adm.noEvents) return; // v20 admin
    if (ui || S.cool > 0) return; if (H.getCity()) return;
    if (rnd() > 0.22) return;
    const X = eventContext();
    const pool = []; let tot = 0;
    for (const ev of EVENTS) {
      if (!ev.choices || !ev.choices.length) continue; if (ev.once && S.usedOnce[ev.id]) continue; if (ev.where && !ev.where(X)) continue;
      let w = typeof ev.w === 'function' ? ev.w(X, S) : ev.w;
      if (ev.id === 'brigands' || ev.id === 'kurds' || ev.id === 'qaraunas') w *= S.hires.guide ? 0.75 : 1;
      if (ROBBERY.includes(ev.id) || HOSTILE.includes(ev.id)) { if (S.day < 60) continue; }
      if (ROBBERY.includes(ev.id) && !ruralHere()) continue;
      if (!(w > 0)) continue; pool.push([ev, w]); tot += w;
    }
    if (!pool.length) return;
    let r = rnd() * tot; let ev = pool[0][0]; for (const [e2, w] of pool) { r -= w; if (r <= 0) { ev = e2; break; } }
    triggerEvent(ev, X);
  }
  function triggerEvent(ev, X) {
    S.cool = 120; S.events++; if (ev.once) S.usedOnce[ev.id] = 1;
    evtState = { ev, X, phase: 'pending' };
    ui = 'event'; for (const k in H.keys) H.keys[k] = false; H.player.auto = false;
    if (ev.npc) spawnEventNpcs(ev.npc);
    snapPending = 2; // capture the view after the NPCs have rendered
  }
  let snapPending = 0; const snapCv = document.createElement('canvas'); snapCv.width = 640; snapCv.height = 300;
  H.postRender = () => {
    if (!snapPending) return; if (--snapPending > 0) return;
    const src = H.renderer.domElement; const g = snapCv.getContext('2d'); const sw = src.width, sh = src.height; const ar = snapCv.width / snapCv.height;
    let cw = sw, chh = sw / ar; if (chh > sh) { chh = sh; cw = sh * ar; }
    try { g.drawImage(src, (sw - cw) / 2, (sh - chh) / 2 - sh * 0.05, cw, chh, 0, 0, snapCv.width, snapCv.height); } catch (e) { }
    showEventPanel();
  };
  function showEventPanel() {
    const { ev, X } = evtState; if (document.pointerLockElement) document.exitPointerLock(); H.setPauseWanted(false);
    const txt = typeof ev.text === 'function' ? ev.text(S, X) : ev.text;
    let ch = '';
    ev.choices.forEach((c, i) => {
      const okReq = !c.req || c.req(S, X); const pr = c.p ? c.p(S, X) : null;
      ch += `<button class="mx-choice" data-act="choice" data-i="${i}" ${okReq ? '' : 'disabled'}><span>${c.t}</span>${pr !== null ? `<em>${pct(pr)} chance${c.why ? ' · ' + c.why(S, X) : ''}</em>` : ''}${okReq ? '' : '<em>Not possible</em>'}</button>`;
    });
    panel.className = 'mx-panel evt';
    panel.innerHTML = `<div class="mx-evimg"><img src="${snapCv.toDataURL('image/jpeg', .85)}"><div class="mx-evt">${ev.title}</div></div><div class="mx-evbody"><p>${txt}</p><div class="mx-choices">${ch}</div></div>`;
    ov.classList.add('show');
  }
  function resolveChoice(i) {
    const { ev, X } = evtState; const c = ev.choices[i]; if (c.req && !c.req(S, X)) return;
    const pr = c.p ? Math.max(0.03, Math.min(0.97, c.p(S, X))) : 1; const success = rnd() < pr;
    const res = success ? c.ok(S, X, M) : (c.bad ? c.bad(S, X, M) : c.ok(S, X, M));
    S.coins = Math.max(0, S.coins); S.rep = Math.max(0, Math.min(100, S.rep));
    const body = panel.querySelector('.mx-evbody');
    body.innerHTML = `<p class="mx-dim">${c.t}${c.p ? (success ? ' — <b class="mx-ok">success</b>' : ' — <b class="mx-bad">failure</b>') : ''}</p><p>${res}</p><button class="mx-big" data-act="evdone">Continue</button>`;
    evtState.phase = 'done'; dropOverflow(); rebuildCaravan(); updateHud(true);
  }
  function finishEvent() { evtState = null; ui = null; ov.classList.remove('show'); panel.innerHTML = ''; H.setPauseWanted(true); H.tryLock(); setTimeout(() => clearEventNpcs(), 15000); save(); }
  function showEvent(o) { // simple message event (collapse etc.)
    ui = 'event'; evtState = { ev: { title: o.title }, phase: 'done' }; if (document.pointerLockElement) document.exitPointerLock(); H.setPauseWanted(false);
    panel.className = 'mx-panel evt'; panel.innerHTML = `<div class="mx-evbody"><div class="mx-t">${o.title}</div><p>${o.text}</p><button class="mx-big" data-act="evdone">Continue</button></div>`; ov.classList.add('show'); rebuildCaravan();
  }

  // ---------------- effect API used by events ----------------
  const M = {
    coins(n) { S.coins = Math.max(0, S.coins + n); return `${fmt(Math.abs(n))} ${CURRENCY}`; },
    rep(n) { S.rep = Math.max(0, Math.min(100, S.rep + n)); },
    supply(k, n) { S[k] = Math.max(0, S[k] + n); },
    days(n) { passDays(n, terrainAt(H.player.x, H.player.z)); },
    flag(k) { S.flags[k] = 1; },
    describe(lost) { const parts = Object.entries(lost).filter(([g, n]) => n > 0).map(([g, n]) => `${n} ${GOOD[g].unit}${n > 1 ? 's' : ''} of ${lcName(GOOD[g].name)}`); return parts.length ? 'You lose ' + parts.join(', ') + '.' : 'Luckily you had little to lose.'; },
    loseGoodsFrac(f) { const lost = {}; for (const g in S.cargo) { if (GOOD[g].quest) continue; const n = Math.min(S.cargo[g], Math.max(f >= .1 ? 1 : 0, Math.round(S.cargo[g] * f))); S.cargo[g] -= n; lost[g] = n; if (!S.cargo[g]) { delete S.cargo[g]; delete S.basis[g]; } } return M.describe(lost); },
    loseAllGoods() { const lostC = failContracts('lost with the rest of your goods'); const had = Object.keys(S.cargo).length + lostC; S.cargo = {}; S.basis = {}; return had ? '<b>You lose all your goods.</b>' : 'Luckily you had nothing worth taking.'; },
    loseValue(v, cid) { cid = cid || nearestCityId(); const lost = {}; const gs = Object.keys(S.cargo).filter(g => !GOOD[g].quest).sort(() => rnd() - .5); for (const g of gs) { while (v > 0 && S.cargo[g] > 0) { v -= ECON.mid(g, cid, S.day); S.cargo[g]--; lost[g] = (lost[g] || 0) + 1; } if (!S.cargo[g]) { delete S.cargo[g]; delete S.basis[g]; } } return M.describe(lost); },
    sellFrac(f, mult, filter) { const cid = nearestCityId(); let got = 0, n = 0; for (const g in S.cargo) { if (GOOD[g].quest || (filter && !filter(g))) continue; const k = Math.max(1, Math.round(S.cargo[g] * f)); got += k * ECON.mid(g, cid, S.day) * mult; n += k; S.cargo[g] -= k; if (S.cargo[g] <= 0) { delete S.cargo[g]; delete S.basis[g]; } } S.coins += got; return n ? `You sell ${n} units of goods for ${fmt(got)} ${CURRENCY}.` : 'You have nothing he wants.'; },
    buyCheap(g, n, mult) { const cid = nearestCityId(); const p = ECON.mid(g, cid, S.day) * mult; let k = 0; while (k < n && S.coins >= p && load() + GOOD[g].w <= capacity()) { S.coins -= p; const have = S.cargo[g] || 0; S.basis[g] = ((S.basis[g] || 0) * have + p) / (have + 1); S.cargo[g] = have + 1; k++; } return k ? `You buy ${k} ${GOOD[g].unit}s of ${lcName(GOOD[g].name)} for ${fmt(p)} each, far below the bazaar price.` : 'You cannot afford or carry any.'; },
    addGood(g, n) { S.cargo[g] = Math.max(0, (S.cargo[g] || 0) + n); if (!S.cargo[g]) delete S.cargo[g]; dropOverflow(); },
    randomGoodGift(value) { const cid = nearestCityId(); const g = pick(GOODS.filter(g => g.base * .6 <= value)); const p = ECON.mid(g.id, cid, S.day); const n = Math.max(1, Math.round(value / p)); S.cargo[g.id] = (S.cargo[g.id] || 0) + n; dropOverflow(); return `${n} ${g.unit}${n > 1 ? 's' : ''} of ${lcName(g.name)}`; },
    loseAnimal() {
      const ks = Object.keys(S.pack).filter(k => S.pack[k] > 0);
      if (ks.length) { const k = pick(ks); S.pack[k]--; if (!S.pack[k]) delete S.pack[k]; dropOverflow(); rebuildCaravan(); return `You lose a ${lcName(PACK[k].name)}.`; }
      const vs = Object.keys(S.veh).filter(k => S.veh[k] > 0); if (vs.length) { const k = vs[0]; S.veh[k]--; if (!S.veh[k]) delete S.veh[k]; dropOverflow(); rebuildCaravan(); return `An ox dies and you must abandon your ${lcName(VEHICLES[k].name)}.`; }
      if (S.mount !== 'foot') { const m = lcName(MOUNTS[S.mount].name); S.mount = 'foot'; applyMount(); dropOverflow(); rebuildCaravan(); return `You lose your ${m} and must walk.`; }
      return 'Luckily you have no animals to lose.';
    },
    loseHire(k, n) { S.hires[k] = Math.max(0, (S.hires[k] || 0) - n); if (!S.hires[k]) delete S.hires[k]; rebuildCaravan(); },
    loseHireAny() { const ks = Object.keys(S.hires).filter(k => S.hires[k] > 0); if (ks.length) M.loseHire(pick(ks), 1); },
    addHire(k, n) { S.hires[k] = (S.hires[k] || 0) + n; rebuildCaravan(); },
    setMount(k) { S.pack.horse = (S.pack.horse || 0) + 1; dropOverflow(); rebuildCaravan(); },
    speedUp(k) { const u = SPEED_UPS[k]; if (u.slot) S.speed.breed = k; else S.speed[k] = 1; },
    losePaiza() { S.paiza = false; },
    rumour() {
      const here = nearestCityId(); const cands = [];
      for (const c of W.cities) { if (c.id === here) continue; for (const g of GOODS) { const sp = ECON.sellPrice(S, g.id, c.id, S.day); cands.push([sp / g.base, c, g, sp]); } }
      cands.sort((a, b) => b[0] - a[0]); const [r, c, g, sp] = pick(cands.slice(0, 60));
      const src = pick(g.prod.filter(p => W.cityById[p])); const bp = ECON.buyPrice(S, g.id, src, S.day);
      const t = `They say <b>${lcName(g.name)}</b> sells for about <b>${fmt(sp)}</b> a ${g.unit} in <b>${c.name}</b> — and can be bought for about ${fmt(bp)} in ${W.cityById[src].name}.`;
      S.rumours.push(`<span class="mx-dim">${dateOf(S.day)}:</span> ${t}`); return t;
    },
  };

  // ---------------- people & animals (low-poly) ----------------
  const SKIN = { byz: [0xd8a989, 0xc99a78], armenian: [0xc99272, 0xb98262], georgian: [0xd8a989, 0xc99a78], rum: [0xc99272, 0xb88262], arab: [0xb07a52, 0x9a6844], persian: [0xc08a62, 0xb07a55], central: [0xc08a62, 0xb88a66], tarim: [0xc8946a, 0xb8845c], mongol: [0xc8946a, 0xb8845c], steppe: [0xc8946a, 0xb8845c], chinese: [0xe0b48a, 0xd2a47a], song: [0xe0b48a, 0xd2a47a], tibet: [0xa87048, 0x986040], yemen: [0x9a6844, 0x8a5a3a], indian: [0x9a6440, 0x8a5634], sea: [0xb07a4e, 0xa06c42] };
  const ROBES = {
    byz: [0x6a2a3a, 0x2c4a6a, 0x7a5a2a, 0x4a3a5a, 0xa8823a], armenian: [0x5a3a2a, 0x2c4a3a, 0x7a3a2a], georgian: [0x3a4a2a, 0x6a2a2a, 0x2a3a5a], rum: [0x2a5a6a, 0x8a3a2a, 0x5a6a2a, 0x3a3a6a],
    arab: [0xe8e0cc, 0xd8ccb0, 0x8a7a5a, 0x3a3a3a], persian: [0x2a5a7a, 0x6a2a4a, 0x2a6a4a, 0xb8862a, 0x8a3a2a], central: [0x3a6a8a, 0x8a2a3a, 0x4a7a3a, 0xc89a2a], tarim: [0x6a4a2a, 0x2a5a6a, 0x8a3a3a],
    mongol: [0x2a4a7a, 0x5a3a2a, 0x7a2a2a, 0x3a5a3a], steppe: [0x2a4a7a, 0x5a3a2a], chinese: [0x3a4a5a, 0x5a4a3a, 0x2a3a3a, 0x6a6a6a], song: [0x4a5a6a, 0x6a5a4a, 0x8a8a8a], tibet: [0x6a1a1a, 0x5a3a2a, 0x2a2a2a], yemen: [0x3a4a6a, 0xd8ccb0, 0x5a3a2a, 0x2a2a2a], indian: [0xf0ece0, 0xe8d8b0, 0xd8a03a, 0xb8402a, 0xf0e8d8], sea: [0x8a3a5a, 0x3a5a3a, 0xc88a2a, 0x5a3a6a, 0x2a4a5a] };
  const HAT = { byz: 'cap', armenian: 'cap', georgian: 'cap', rum: 'turban', arab: 'keffiyeh', persian: 'turban', central: 'turban', tarim: 'turban', mongol: 'mongol', steppe: 'mongol', chinese: 'futou', song: 'futou', tibet: 'fur', yemen: 'turban', indian: 'pagri', sea: 'gaung' };
  const geoCache = {};
  let legGeo = null;
  function personGeo(cul, role, v) {
    const key = cul + role + v; if (geoCache[key]) return geoCache[key];
    const b = new B.Builder(); b.jit = 0.03; b.ao = false; const r = W.rng(v * 31 + cul.length * 7 + role.length);
    const robes = role === 'bandit' ? [0x3a3228, 0x4a3a2a, 0x2a2622] : role === 'monk' ? (cul === 'sea' ? [0xd8781a, 0xc8601a] : cul === 'indian' ? [0xe8a03a, 0xf0e8d8] : cul === 'tibet' || cul === 'chinese' || cul === 'song' || cul === 'tarim' ? [0x8a2a1a, 0xc8782a] : [0x1e1e22, 0x3a3028]) : role === 'soldier' ? [0x5a4a3a, 0x6a2a2a] : (ROBES[cul] || ROBES.persian);
    const robe = robes[Math.floor(r() * robes.length)]; const robe2 = role === 'rich' ? 0xc8a03a : robes[Math.floor(r() * robes.length)];
    const skin = (SKIN[cul] || SKIN.persian)[Math.floor(r() * 2)];
    b.cyl(0, .28, 0, .2, .33, 1.0, robe, 8); b.cyl(0, 1.0, 0, .19, .21, .44, robe2 === robe ? robe : robe2, 8);
    b.cyl(0, 1.0, 0, .222, .222, .08, role === 'rich' ? 0xc8a03a : 0x3a2a1a, 8);
    for (const sx of [-1, 1]) { b.box(sx * .27, .82, .02, .1, .6, .12, robe, 0, 0, sx * .08); b.sphere(sx * .29, .78, .03, .055, skin, 5); }
    b.cyl(0, 1.42, 0, .06, .07, .08, skin, 6); b.sphere(0, 1.58, 0, .125, skin, 8, 1.12);
    for (const sx of [-1, 1]) b.box(sx * .045, 1.6, .115, .03, .02, .02, 0x1a1410);
    const beard = role !== 'monk' && cul !== 'chinese' && cul !== 'song' ? r() < .7 : r() < .3; const hairC = cul === 'byz' || cul === 'georgian' ? 0x3a2a1a : 0x1a1410;
    if (beard) b.cone(0, 1.55, .08, .085, .17, hairC, 5, 0, Math.PI);
    let hat = role === 'monk' ? (cul === 'tibet' || cul === 'chinese' || cul === 'song' || cul === 'tarim' || cul === 'sea' || cul === 'indian' ? 'bald' : 'hood') : role === 'soldier' ? 'helmet' : role === 'bandit' ? (r() < .5 ? 'wrap' : 'mongol') : (HAT[cul] || 'turban');
    if ((cul === 'chinese' || cul === 'song') && role === 'plain' && r() < .5) hat = 'topknot';
    const hc = role === 'rich' ? 0xf0e8d8 : [0xf0e8d8, 0xd8c8a8, 0x2a5a7a, 0x8a2a2a][Math.floor(r() * 4)];
    switch (hat) {
      case 'turban': b.sphere(0, 1.7, 0, .16, hc, 8, .62); b.sphere(0, 1.76, 0, .1, hc, 6, .8); break;
      case 'keffiyeh': b.sphere(0, 1.62, -.01, .148, 0xf0ece0, 8, 1.15); b.box(0, 1.25, -.1, .3, .42, .06, 0xf0ece0); b.cyl(0, 1.68, 0, .15, .15, .04, 0x1a1a1a, 8); break;
      case 'mongol': b.cyl(0, 1.66, 0, .21, .22, .06, 0x6a4a2a, 10); b.cone(0, 1.7, 0, .14, .26, [0x2a4a7a, 0x7a2a2a, 0x3a5a3a][Math.floor(r() * 3)], 8); b.sphere(0, 1.95, 0, .03, 0xc8302a, 4); break;
      case 'cap': b.sphere(0, 1.6, -.02, .135, hairC, 7, 1.05); b.cyl(0, 1.66, 0, .13, .135, .1, [0x6a2a3a, 0x2a2a2a, 0xa8823a][Math.floor(r() * 3)], 8); break;
      case 'futou': b.box(0, 1.66, 0, .22, .16, .22, 0x161616); b.box(0, 1.72, -.06, .62, .03, .05, 0x161616); break;
      case 'topknot': b.sphere(0, 1.62, -.01, .13, 0x161616, 7, 1.02); b.sphere(0, 1.76, -.02, .055, 0x161616, 5); break;
      case 'fur': b.cyl(0, 1.64, 0, .17, .18, .18, 0xc8a06a, 8); b.cyl(0, 1.66, 0, .185, .185, .08, 0xe8d8b8, 8); break;
      case 'hood': b.cone(0, 1.45, -.01, .19, .45, robe, 7); break;
      case 'helmet': b.cone(0, 1.66, 0, .15, .22, 0x8a8a8a, 8); b.cyl(0, 1.86, 0, .01, .015, .14, 0x8a8a8a, 4); b.box(0, 1.5, -.12, .26, .2, .03, 0x6a4a2a); break;
      case 'pagri': b.sphere(0, 1.7, 0, .17, [0xd8402a, 0xe8b030, 0xf0ece0, 0xc85a8a][Math.floor(r() * 4)], 8, .7); b.sphere(.05, 1.79, .02, .1, hc, 6, .7); break;
      case 'gaung': b.sphere(0, 1.62, -.01, .132, 0x161616, 7, 1.02); b.cyl(0, 1.66, 0, .145, .14, .07, [0xf0ece0, 0xe8c070, 0xc85a3a][Math.floor(r() * 3)], 8); b.sphere(.13, 1.7, .03, .05, 0xf0ece0, 5); break;
      case 'bald': b.sphere(0, 1.6, -.01, .128, skin, 7, 1.02); break;
      case 'wrap': b.sphere(0, 1.6, 0, .145, 0x2a2622, 7, 1.12); b.box(0, 1.5, .1, .2, .08, .06, 0x2a2622); break;
    }
    if (role === 'soldier' || role === 'bandit') { b.cyl(.34, 0, .06, .016, .02, 2.3, 0x6a4a2a, 4); b.cone(.34, 2.3, .06, .035, .2, 0xa8a8a8, 4); if (r() < .6) b.cyl(-.33, .7, .1, .22, .22, .05, role === 'soldier' ? 0x8a2a1a : 0x5a4a3a, 10, 0, 0, Math.PI / 2); }
    if (role === 'groom') b.box(0, 1.0, -.24, .3, .35, .15, 0x6a4a2a);
    if (role === 'carrier') b.box(0, 1.05, -.26, .38, .44, .22, 0x8a6a48);
    const g = b.geometry(); geoCache[key] = g; return g;
  }
  function makePerson(cul, role = 'plain', v) {
    if (!legGeo) { const lb = new B.Builder(); lb.ao = false; lb.box(0, -.62, 0, .14, .62, .16, 0x2a221c); lb.box(0, -.62, .03, .15, .1, .24, 0x1a1410); legGeo = lb.geometry(); }
    v = v === undefined ? Math.floor(rnd() * 5) : v;
    const g = new THREE.Group(); const body = new THREE.Mesh(personGeo(cul, role, v), H.objMat); body.castShadow = true; g.add(body);
    const legs = []; for (const sx of [-1, 1]) { const l = new THREE.Mesh(legGeo, H.objMat); l.position.set(sx * .09, .62, 0); g.add(l); legs.push(l); }
    g.userData = { legs, phase: rnd() * 6, kind: 'person' }; return g;
  }
  const AN = {
    camel:  { len: 2.0, wid: .85, bh: .9, leg: 1.25, legW: .16, c: 0xb8925e, neck: 'camel', humps: 2 },
    horse:  { len: 1.7, wid: .6, bh: .72, leg: 1.0, legW: .13, c: 0x7a4a2a, neck: 'horse' },
    pony:   { len: 1.4, wid: .55, bh: .65, leg: .78, legW: .13, c: 0x9a7a52, neck: 'horse' },
    mule:   { len: 1.45, wid: .52, bh: .62, leg: .85, legW: .12, c: 0x5a4a3a, neck: 'horse', ears: .28 },
    donkey: { len: 1.15, wid: .45, bh: .55, leg: .68, legW: .11, c: 0x8a8278, neck: 'horse', ears: .32 },
    yak:    { len: 1.8, wid: .85, bh: .9, leg: .72, legW: .18, c: 0x2a2420, neck: 'ox', shaggy: true, horns: true },
    elephant: { len: 2.7, wid: 1.45, bh: 1.55, leg: 1.35, legW: .34, c: 0x7c7672, neck: 'elephant' },
    ox:     { len: 1.9, wid: .8, bh: .85, leg: .78, legW: .17, c: 0x8a6a4a, neck: 'ox', horns: true },
  };
  const animalGeo = {};
  function animalBodyGeo(kind, packed, v) {
    const key = kind + (packed ? 'p' : '') + v; if (animalGeo[key]) return animalGeo[key];
    const a = AN[kind]; const b = new B.Builder(); b.jit = .03; b.ao = false; const r = W.rng(v + 5);
    const col = kind === 'horse' ? [0x7a4a2a, 0x3a2a1e, 0xc8b8a0, 0x9a6a3a][v % 4] : kind === 'pony' ? [0x9a7a52, 0x5a4a3a, 0xd8c8a8][v % 3] : a.c;
    const y = a.leg + a.bh * .45;
    b.sphere(0, y, 0, a.len * .5, col, 8, a.bh / a.len * 1.0, a.wid / a.len);
    if (a.shaggy) b.cyl(0, a.leg * .55, 0, a.wid * .55, a.wid * .6, a.bh * .5, 0x1a1612, 8);
    if (a.humps) for (const z of (a.humps === 1 ? [0] : [-.35, .3])) b.sphere(0, y + a.bh * .38, z, a.humps === 1 ? .4 : .28, col, 6, 1.1, .9);
    if (a.neck === 'horse') { b.box(0, y + .05, a.len * .36, .24, .75, .32, col, 0, .55); b.box(0, y + .62, a.len * .36 + .5, .2, .24, .58, col, 0, .25); for (const sx of [-1, 1]) b.cone(sx * .07, y + .86, a.len * .36 + .32, .04, a.ears || .14, col, 4); b.box(0, y + .3, a.len * .36 - .02, .06, .5, .08, 0x1a1410, 0, .55); }
    else if (a.neck === 'camel') { b.box(0, y - .1, a.len * .4, .22, .55, .26, col, 0, 1.15); b.box(0, y + .18, a.len * .4 + .5, .2, .8, .24, col, 0, -.15); b.box(0, y + .9, a.len * .4 + .48, .2, .24, .5, col); for (const sx of [-1, 1]) b.cone(sx * .07, y + 1.12, a.len * .4 + .42, .035, .1, col, 4); }
    else if (a.neck === 'elephant') { b.sphere(0, y + .25, a.len * .5, .62, col, 8, 1.05, .95); for (const sx of [-1, 1]) b.box(sx * .55, y - .2, a.len * .46, .08, 1.0, .8, 0x8a8480, sx * .35);
      b.cyl(0, y - .95, a.len * .62, .1, .2, 1.05, col, 6, 0, -.25); for (const sx of [-1, 1]) b.cone(sx * .25, y - .15, a.len * .66, .06, .55, 0xece4d0, 5, 0, 1.25, 0);
      if (packed) { b.box(0, y + a.bh * .5, -.1, a.wid * .9, .5, a.len * .45, 0xa8402a); b.box(0, y + a.bh * .5 + .5, -.1, a.wid * .7, .6, a.len * .32, 0xc89a3a); } }
    else { b.box(0, y - .25, a.len * .45, .38, .5, .45, col); if (a.horns) for (const sx of [-1, 1]) b.cone(sx * .2, y + .14, a.len * .48 + .15, .05, .35, 0xd8ccb0, 4, 0, 0, sx * -1.1); }
    b.box(0, y - .25, -a.len * .5, .06, .45, .06, col, 0, -.3);
    if (packed) {
      const cc = [0xb0402c, 0x2f6f8f, 0xd09a2a, 0x8a6a48, 0x5a7a3a, 0xc8b890];
      for (const sx of [-1, 1]) { b.box(sx * (a.wid * .5 + .12), y - .15, -.05, .3, .5, a.len * .4, cc[Math.floor(r() * cc.length)]); }
      b.box(0, y + a.bh * .45 + (a.humps ? .15 : 0), 0, a.wid * .9, .28, a.len * .3, cc[Math.floor(r() * cc.length)]);
      b.box(0, y + a.bh * .3, 0, a.wid + .1, .06, .08, 0x5a4a3a);
    } else if (v === 99) { b.box(0, y + a.bh * .42, 0, a.wid * .7, .12, a.len * .3, 0x8a2a1e); }
    const g = b.geometry(); animalGeo[key] = g; return g;
  }
  const animLegGeo = {};
  H.lifeKit = { personGeo: (...a) => { W = W || H.W; B = B || H.B; return personGeo(...a); }, animalBodyGeo: (...a) => { W = W || H.W; B = B || H.B; return animalBodyGeo(...a); }, AN };
  function makeAnimal(kind, packed, v) {
    const a = AN[kind]; v = v === undefined ? Math.floor(rnd() * 4) : v;
    if (!animLegGeo[kind]) { const lb = new B.Builder(); lb.ao = false; lb.box(0, -a.leg, 0, a.legW, a.leg, a.legW * 1.1, kind === 'yak' ? 0x1a1612 : AN[kind].c); lb.box(0, -a.leg, 0, a.legW * 1.1, .1, a.legW * 1.2, 0x2a2018); animLegGeo[kind] = lb.geometry(); }
    const g = new THREE.Group(); const body = new THREE.Mesh(animalBodyGeo(kind, packed, v), H.objMat); body.castShadow = true; g.add(body);
    const legs = []; for (const [sx, sz, ph] of [[-1, 1, 0], [1, 1, Math.PI], [-1, -1, Math.PI], [1, -1, 0]]) { const l = new THREE.Mesh(animLegGeo[kind], H.objMat); l.position.set(sx * a.wid * .3, a.leg, sz * a.len * .3); l.userData.ph = ph; g.add(l); legs.push(l); }
    g.userData = { legs, phase: rnd() * 6, kind: 'animal', stride: a.leg }; return g;
  }
  function makeCart(kind) {
    const g = new THREE.Group(); const b = new B.Builder(); b.ao = false; const L = kind === 'wagon' ? 3.6 : 2.6;
    b.box(0, .75, -1.9 - L / 2 + 1.3, 1.6, .15, L, 0x8a6240); for (const sx of [-1, 1]) b.box(sx * .78, .9, -1.9 - L / 2 + 1.3, .08, .45, L, 0x6a4a30);
    const cc = [0xb0402c, 0x2f6f8f, 0xd09a2a, 0xc8b890]; for (let k = 0; k < (kind === 'wagon' ? 4 : 3); k++) b.box((k % 2 - .5) * .6, .9, -1.9 - L / 2 + 1.3 + (k - 1) * .7, .6, .5, .6, cc[k % 4]);
    if (kind === 'wagon') b.arch(0, .9, -1.9 - L / 2 + 1.3, .8, L * .9, 0xd8ccb0, Math.PI / 2);
    for (const sx of [-1, 1]) for (const zz of kind === 'wagon' ? [-2.2, -2.2 - L + 1] : [-1.9 - L / 2 + 1.3]) b.cyl(sx * .9, .55, zz, .55, .55, .1, 0x5a3a24, 10, 0, 0, Math.PI / 2);
    for (const sx of [-1, 1]) b.box(sx * .3, .7, -.6, .06, .06, 2, 0x6a4a30);
    const m = new THREE.Mesh(b.geometry(), H.objMat); m.castShadow = true; g.add(m);
    const ox = makeAnimal('ox', false, 1); ox.position.set(0, 0, .8); g.add(ox);
    g.userData = { legs: ox.userData.legs, phase: 0, kind: 'animal', stride: .78, cart: true }; return g;
  }
  function animate(o, speed, dt) {
    const u = o.userData; if (!u.legs) return; u.phase += speed * dt * (u.kind === 'person' ? 4.2 : 2.6 / Math.max(.6, u.stride));
    const amp = Math.min(1, speed / 2) * (u.kind === 'person' ? .55 : .45);
    if (u.kind === 'person') { u.legs[0].rotation.x = Math.sin(u.phase) * amp; u.legs[1].rotation.x = -Math.sin(u.phase) * amp; }
    else for (const l of u.legs) l.rotation.x = Math.sin(u.phase + (l.userData.ph || 0)) * amp;
  }

  // ---------------- your own caravan (followers) ----------------
  const trail = []; let followers = [], mountView = null;
  function rebuildCaravan() {
    if (MODE !== 'journey') return;
    for (const f of followers) H.scene.remove(f.obj); followers = [];
    const cul = cultureNear(); const list = [];
    const hires = []; for (const k in S.hires) for (let i = 0; i < S.hires[k]; i++) hires.push(k);
    const animals = []; for (const k in S.pack) for (let i = 0; i < S.pack[k]; i++) animals.push(k);
    const carts = []; for (const k in S.veh) for (let i = 0; i < S.veh[k]; i++) carts.push(k);
    let hi = 0; for (let i = 0; i < animals.length && list.length < 16; i++) { if (i % 3 === 0 && hi < hires.length) list.push({ t: 'p', k: hires[hi++] }); list.push({ t: 'a', k: animals[i] }); }
    while (hi < hires.length && list.length < 18) list.push({ t: 'p', k: hires[hi++] });
    for (const k of carts.slice(0, 3)) list.push({ t: 'c', k });
    for (let i = 0; i < (S.up.dog || 0); i++) list.splice(1, 0, { t: 'd' });
    let dist = 3.2;
    for (const it of list) {
      let obj, gap = 3.2;
      if (it.t === 'p') obj = makePerson(it.k === 'archer' ? 'mongol' : cul, it.k === 'guard' || it.k === 'archer' || it.k === 'crossbow' ? 'soldier' : it.k === 'guide' ? 'plain' : 'carrier');
      else if (it.t === 'a') { obj = makeAnimal(it.k === 'horse' ? 'horse' : it.k, true); gap = AN[it.k].len + 1.6; }
      else if (it.t === 'c') { obj = makeCart(it.k); gap = it.k === 'wagon' ? 6.5 : 5.5; }
      else { obj = makeAnimal('donkey', false, 2); obj.scale.setScalar(.55); obj.children[0].material = H.objMat; gap = 2; }
      H.scene.add(obj); followers.push({ obj, dist: dist + gap * .5 }); dist += gap;
    }
    if (S.hero && window.HERO && followers.length) { const bn = HERO.makeBanner(S.hero, 1.6); const f0 = followers[0].obj; bn.position.set(.35, f0.userData.kind === 'animal' ? (AN.donkey.leg + .9) : 1.0, -.2); f0.add(bn); }
    resetTrail(); placeFollowers(0);
  }
  function resetTrail() {
    trail.length = 0; trail.push({ x: H.player.x, z: H.player.z, s: 0 }); lastPX = H.player.x; lastPZ = H.player.z;
    const fx = Math.sin(H.player.yaw), fz = Math.cos(H.player.yaw);
    for (let k = 1; k < 80; k++) trail.push({ x: H.player.x + fx * k * 1.5, z: H.player.z + fz * k * 1.5, s: k * 1.5 });
  }
  function cultureNear() { const c = W.nearestCity(H.player.x, H.player.z).c; return c.culture === 'steppe' ? 'mongol' : c.culture; }
  let trailLen = 0, lastPX = 0, lastPZ = 0;
  function updateTrail() {
    const p = H.player; const d = Math.hypot(p.x - lastPX, p.z - lastPZ);
    if (d > 25) { resetTrail(); return 0; } // teleported
    if (d > 0.5) { // prepend
      const head = { x: p.x, z: p.z, s: 0 }; for (const t of trail) t.s += d; trail.unshift(head); lastPX = p.x; lastPZ = p.z;
      while (trail.length > 2 && trail[trail.length - 2].s > 140) trail.pop();
      return d;
    }
    return 0;
  }
  function trailAt(s) { for (let i = 1; i < trail.length; i++) { if (trail[i].s >= s) { const a = trail[i - 1], b = trail[i]; const t = (s - a.s) / ((b.s - a.s) || 1); return [a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, Math.atan2(a.x - b.x, a.z - b.z)]; } } const l = trail[trail.length - 1]; return [l.x, l.z, 0]; }
  // v20: inside a city's walls the caravan waits at the caravanserai, so each follower vanishes at the gate and walks out again behind you
  function insideWalls(x, z) { const nc = W.nearestCity(x, z); return nc.d < nc.c.R + 1; }
  function placeFollowers(moved) {
    for (const f of followers) {
      const [x, z, yaw] = trailAt(f.dist); const o = f.obj; o.position.set(x, W.walkHeight(x, z) - .02, z);
      o.visible = !insideWalls(x, z);
      let dy = yaw - o.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); o.rotation.y += dy * .2;
      animate(o, moved > 0 ? 2 : 0, 1 / 60);
      if (o.userData.cart) animate(o.children[1], moved > 0 ? 2 : 0, 1 / 60);
    }
  }
  function applyMount() {
    H.setEye(MOUNTS[S.mount].eye);
    if (mountView) { H.camera.remove(mountView); mountView = null; }
    return;
    const kind = S.mount === 'camel' ? 'camel' : S.mount; const a = AN[kind];
    // neck & head visible at the bottom of the view
    const b = new B.Builder(); b.ao = false; const col = kind === 'horse' ? 0x7a4a2a : a.c;
    if (kind === 'camel') { b.box(0, -1.3, -.9, .22, 1.0, .26, col, 0, .5); b.box(0, -.55, -1.5, .2, .24, .5, col); for (const sx of [-1, 1]) b.cone(sx * .07, -.32, -1.4, .035, .1, col, 4); }
    else if (kind === 'yak') { b.box(0, -1.2, -1.0, .45, .5, .6, col); for (const sx of [-1, 1]) b.cone(sx * .22, -.75, -1.1, .05, .35, 0xd8ccb0, 4, 0, 0, sx * -1.1); }
    else { b.box(0, -1.35, -.7, .24, .9, .32, col, 0, .6); b.box(0, -.75, -1.25, .2, .24, .55, col, 0, .25); for (const sx of [-1, 1]) b.cone(sx * .07, -.52, -1.08, .04, a.ears || .14, col, 4); b.box(0, -1.0, -.82, .07, .55, .1, 0x1a1410, 0, .6); }
    mountView = new THREE.Mesh(b.geometry(), H.objMat); H.camera.add(mountView); if (!H.camera.parent) H.scene.add(H.camera);
  }

  // ---------------- NPC caravans on the roads ----------------
  const roadCaravans = [];
  function initRoadCaravans() {
    const n = 22; // v15: halved
    for (let k = 0; k < n; k++) {
      const e = W.edges[Math.floor(rnd() * W.edges.length)];
      roadCaravans.push(newCaravan(e, rnd() * e.len, rnd() < .5 ? 1 : -1));
    }
    // a couple setting out from the starting city
    const c0 = W.cityById[S.lastCity]; for (const ei of c0.edges.slice(0, 2)) { const e = W.edges[ei]; roadCaravans.push(newCaravan(e, e.a === c0.id ? c0.R + 60 : e.len - c0.R - 60, e.a === c0.id ? 1 : -1)); }
  }
  function newCaravan(e, s, dir) {
    const mid = e.start + (e.n >> 1); const t = terrainAt(W.P.X[mid], W.P.Z[mid]); const c = W.nearestCity(W.P.X[mid], W.P.Z[mid]).c;
    let kinds;
    if (e.group === 'tibet' || t.tibet) kinds = ['yak'];
    else if (t.lon > 100 && !t.desert) kinds = ['mule', 'donkey', 'cart'];
    else if (t.lon < 44) kinds = ['mule', 'horse', 'donkey', 'camel'];
    else if (e.group === 'steppe') kinds = ['camel', 'pony', 'cart'];
    else kinds = ['camel', 'camel', 'donkey'];
    const comp = []; const n = 3 + Math.floor(rnd() * 5); for (let i = 0; i < n; i++) comp.push(pick(kinds));
    return { e, s, dir, speed: 3 + rnd() * 1.5, comp, cul: c.culture === 'steppe' ? 'mongol' : c.culture, obj: null, members: [], wait: 0 };
  }
  function roadPos(e, s, lat) { const f = clamp01(s / e.len) * (e.n - 1); const i0 = e.start + Math.floor(f), i1 = Math.min(e.start + e.n - 1, i0 + 1); const t = f - Math.floor(f); const P = W.P; const x = P.X[i0] + (P.X[i1] - P.X[i0]) * t, z = P.Z[i0] + (P.Z[i1] - P.Z[i0]) * t; let tx = P.X[i1] - P.X[i0], tz = P.Z[i1] - P.Z[i0]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl; return [x - tz * lat, z + tx * lat, tx, tz]; }
  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  function updateRoadCaravans(dt) {
    const p = H.player;
    for (const cv of roadCaravans) {
      if (cv.wait > 0) { cv.wait -= dt; if (cv.wait <= 0) { // pick next road
          const atB = cv.dir > 0; const cid = atB ? cv.e.b : cv.e.a; const city = W.cityById[cid]; const opts = city.edges.filter(id => id !== cv.e.id); const ne = W.edges[opts.length ? pick(opts) : cv.e.id];
          const nc = newCaravan(ne, ne.a === cid ? 0 : ne.len, ne.a === cid ? 1 : -1); if (cv.obj) { H.scene.remove(cv.obj); } Object.assign(cv, nc); }
        continue; }
      cv.s += cv.dir * cv.speed * dt;
      if (cv.s < 0 || cv.s > cv.e.len) { cv.s = Math.max(0, Math.min(cv.e.len, cv.s)); cv.wait = 20 + rnd() * 40; if (cv.obj) { H.scene.remove(cv.obj); cv.obj = null; } continue; }
      const [x, z] = roadPos(cv.e, cv.s, 0); const d = Math.hypot(x - p.x, z - p.z);
      const end = W.cityById[cv.dir > 0 ? cv.e.b : cv.e.a]; const dEnd = Math.hypot(x - end.x, z - end.z); const start = W.cityById[cv.dir > 0 ? cv.e.a : cv.e.b]; const dStart = Math.hypot(x - start.x, z - start.z);
      const hide = dEnd < end.R + 6 || dStart < start.R + 6;
      if (d < 360 && !cv.obj && !hide) buildCaravanObj(cv);
      if ((d > 440 || hide) && cv.obj) { H.scene.remove(cv.obj); cv.obj = null; }
      if (cv.obj) {
        let off = 0;
        for (const m of cv.members) {
          const s = cv.s - cv.dir * off; const [mx, mz, tx, tz] = roadPos(cv.e, s, cv.dir * 1.3);
          m.o.position.set(mx, W.walkHeight(mx, mz) - .02, mz); m.o.rotation.y = Math.atan2(tx * cv.dir, tz * cv.dir);
          animate(m.o, cv.speed, dt); if (m.o.userData.cart) animate(m.o.children[1], cv.speed, dt); off += m.gap;
          // nudge the player aside
          const pd = Math.hypot(p.x - mx, p.z - mz); if (pd < 1.2 && pd > 0.01) { p.x = mx + (p.x - mx) / pd * 1.2; p.z = mz + (p.z - mz) / pd * 1.2; }
        }
      }
    }
  }
  function buildCaravanObj(cv) {
    const g = new THREE.Group(); cv.members = [];
    const lead = makePerson(cv.cul, rnd() < .4 ? 'rich' : 'plain'); g.add(lead); cv.members.push({ o: lead, gap: 2.6 });
    cv.comp.forEach((k, i) => { const o = k === 'cart' ? makeCart('cart') : makeAnimal(k, true); g.add(o); cv.members.push({ o, gap: k === 'cart' ? 5.5 : AN[k].len + 1.4 }); if (i % 3 === 2) { const pp = makePerson(cv.cul, 'plain'); g.add(pp); cv.members.push({ o: pp, gap: 2 }); } });
    H.scene.add(g); cv.obj = g;
  }

  // ---------------- townsfolk ----------------
  let towns = null;
  function updateTownsfolk(dt) {
    const c = H.getCity() || (() => { const nc = W.nearestCity(H.player.x, H.player.z); return nc.d < nc.c.R + 50 ? nc.c : null; })();
    if (towns && (!c || towns.city !== c)) { H.scene.remove(towns.group); towns = null; }
    if (!c || !c.streetsCache) return;
    if (!towns) {
      const g = new THREE.Group(); g.position.set(c.x, c.h, c.z); H.scene.add(g); const walkers = [];
      const streets = c.streetsCache.filter(s => s.pts.length > 3); if (!streets.length) return;
      const n = Math.min(18, 4 + c.tier * 3); // v15: halved
      const cul = c.culture === 'steppe' ? 'mongol' : c.culture;
      for (let k = 0; k < n; k++) {
        const st = pick(streets); const P = st.pts; const role = rnd() < .15 ? 'carrier' : rnd() < .12 ? 'rich' : rnd() < .06 ? 'soldier' : 'plain';
        const pc = c.culture === 'mongol' && rnd() < .5 ? 'central' : cul;
        const o = makePerson(pc, role); g.add(o);
        walkers.push({ o, st, i: Math.floor(rnd() * (P.length - 1)), t: rnd(), dir: rnd() < .5 ? 1 : -1, speed: 1 + rnd() * .7, lat: (rnd() - .5) * Math.max(0, st.hw * 2 - 1.2), pause: 0 });
      }
      // a few animals in town
      for (let k = 0; k < Math.min(3, 1 + (c.tier >> 1)); k++) { const st = pick(streets); const kind = pickAnimalFor(c); const o = makeAnimal(kind, rnd() < .6); g.add(o); walkers.push({ o, st, i: Math.floor(rnd() * (st.pts.length - 1)), t: rnd(), dir: 1, speed: .8, lat: st.hw * .5, pause: 0, animal: true }); }
      towns = { city: c, group: g, walkers };
    }
    const pl = H.player;
    for (const w of towns.walkers) {
      if (w.pause > 0) { w.pause -= dt; animate(w.o, 0, dt); continue; }
      const P = w.st.pts; const a = P[w.i], b = P[w.i + 1]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      w.t += w.dir * w.speed * dt / L;
      if (w.t > 1) { w.i++; w.t = 0; if (w.i >= P.length - 1) { w.i = P.length - 2; w.t = 1; w.dir = -1; if (rnd() < .5) w.pause = 2 + rnd() * 6; } }
      else if (w.t < 0) { w.i--; w.t = 1; if (w.i < 0) { w.i = 0; w.t = 0; w.dir = 1; if (rnd() < .5) w.pause = 2 + rnd() * 6; } }
      if (rnd() < dt * .03) w.pause = 1 + rnd() * 5;
      const A = P[w.i], Bp = P[Math.min(P.length - 1, w.i + 1)]; let tx = Bp[0] - A[0], tz = Bp[1] - A[1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
      const x = A[0] + (Bp[0] - A[0]) * w.t - tz * w.lat * w.dir, z = A[1] + (Bp[1] - A[1]) * w.t + tx * w.lat * w.dir;
      // stop and face the player if close
      const wx = towns.city.x + x, wz = towns.city.z + z; const pd = Math.hypot(pl.x - wx, pl.z - wz);
      if (pd < 1.6) { w.pause = 1.5; w.o.rotation.y = Math.atan2(pl.x - wx, pl.z - wz); if (pd > 0.01 && pd < 0.9) { pl.x = wx + (pl.x - wx) / pd * .9; pl.z = wz + (pl.z - wz) / pd * .9; } continue; }
      w.o.position.set(x, 0, z); w.o.rotation.y = Math.atan2(tx * w.dir, tz * w.dir); animate(w.o, w.speed, dt);
    }
  }

  // ---------------- event NPCs ----------------
  let evNpc = null;
  function spawnEventNpcs(kind) {
    clearEventNpcs();
    const p = H.player; const g = new THREE.Group(); H.scene.add(g);
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw); const cul = cultureNear();
    const spot = (dist, lat) => { const x = p.x + fx * dist + fz * lat, z = p.z + fz * dist - fx * lat; return [x, W.walkHeight(x, z), z]; };
    const face = o => { o.rotation.y = Math.atan2(p.x - o.position.x, p.z - o.position.z); };
    const add = (o, d, l) => { const [x, y, z] = spot(d, l); o.position.set(x, y, z); face(o); g.add(o); };
    const regionCul = kind === 'soldiers' ? (['ilkhan', 'horde', 'chagatai', 'yuan', 'rum'].includes(ECON.realmOf(W.nearestCity(p.x, p.z).c.id)) ? 'mongol' : cul) : cul;
    switch (kind) {
      case 'bandits': for (let k = 0; k < 5; k++) add(makePerson(cul, 'bandit'), 9 + (k % 2) * 1.5, (k - 2) * 1.4); add(makeAnimal(cul === 'mongol' ? 'pony' : 'horse', false, 1), 12, 3.5); break;
      case 'caravan': add(makePerson(cul, 'rich'), 9, -1); add(makePerson(cul, 'plain'), 10, 1.2); add(makeAnimal(pickAnimalFor(W.nearestCity(p.x, p.z).c), true), 12.5, -.5); add(makeAnimal(pickAnimalFor(W.nearestCity(p.x, p.z).c), true), 14, 2); break;
      case 'monk': add(makePerson(cul, 'monk'), 7, 0); if (rnd() < .6) add(makePerson(cul, 'monk'), 8, 1.3); break;
      case 'nomads': add(makePerson(cul === 'byz' ? 'rum' : cul, 'plain'), 8, -1); add(makePerson(cul === 'byz' ? 'rum' : cul, 'groom'), 8.5, 1); add(makeAnimal(cul === 'tibet' ? 'yak' : 'pony', false, 2), 11, 2.5); break;
      case 'soldiers': for (let k = 0; k < 4; k++) add(makePerson(regionCul, 'soldier'), 9 + (k % 2), (k - 1.5) * 1.3); add(makeAnimal(regionCul === 'mongol' ? 'pony' : 'horse', false, 99), 12, -3); break;
      case 'officials': add(makePerson(cul, 'rich'), 7, 0); add(makePerson(cul, 'soldier'), 8, 1.4); add(makePerson(cul, 'soldier'), 8, -1.4); break;
      case 'traveller': add(makePerson(cul, 'plain'), 7, 0); add(makeAnimal('donkey', true), 8.5, 1.6); break;
    }
    evNpc = g;
  }
  function clearEventNpcs() { if (evNpc) { H.scene.remove(evNpc); evNpc = null; } }

  // ---------------- save / load ----------------
  function save() { if (MODE !== 'journey' || !S) return; try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { } }
  function loadSave() { try { const j = localStorage.getItem(SAVE_KEY); if (!j) return null; const s = JSON.parse(j); return s && (s.v === 1 || s.v === 2) ? s : null; } catch (e) { return null; } }

  // ---------------- start ----------------
  H.start = (mode) => {
    W = H.W; B = H.B;
    let tk = 0, tu = 0; for (const e of W.edges) { tk += e.km; tu += e.len; } KMU = tk / tu;
    if (mode === 'free') { MODE = 'free'; H.noTeleport = false; buildDom(); return; }
    MODE = 'journey'; H.noTeleport = true; H.noSprint = true; document.body.classList.add('journey'); buildDom();
    H.save = save; H.restart = restart;
    H.minimapDots = () => { const out = []; for (const e of (S.mkt || [])) if (S.day >= e.start && S.day < e.end) { const cc = W.cityById[e.city]; out.push({ x: cc.x, z: cc.z, c: '#e0a020' }); } for (const cv of roadCaravans) { if (cv.wait > 0) continue; const [x, z] = roadPos(cv.e, cv.s, 0); out.push({ x, z, c: '#6a3a1a' }); } return out; };
    H.mapCityInfo = c => { const ev = mktActive(c.id).map(e => `<b>${e.title}</b>: ${Object.keys(e.goods).map(g => lcName(GOOD[g].name)).join(', ')} ×${Object.values(e.goods)[0]}. `).join(''); return ev + mapInfo0(c); }; const mapInfo0 = c => { const s = S.seen[c.id]; if (!s) return S.visited.includes(c.id) ? 'Visited.' : 'You have not been here yet.'; const top = Object.entries(s.sell).sort((a, b) => b[1] / GOOD[b[0]].base - a[1] / GOOD[a[0]].base).slice(0, 3).map(([g, p]) => `${GOOD[g].name} ${p}`).join(', '); return `Prices seen on day ${s.day}. Pays well for: ${top}.`; };
    const sv = mode === 'continue' ? loadSave() : null;
    S = decorate(migrate(sv || campInitState(H.charId, H.campOpts || {})));
    if (sv || S.lastCity !== 'constantinople') H.placeAtCity(S.lastCity);
    for (const v of S.visited) H.visited.add(v);
    if (!S.mkt) { S.mkt = []; for (let k = 0; k < 5; k++) spawnMarketEvent(true); }
    applyMount(); rebuildCaravan(); initRoadCaravans();
    updateHud(true);
    if (!sv) showIntro();
  };
  function restart() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { }
    if (ui) { ui = null; ov.classList.remove('show'); }
    S = decorate(migrate(campInitState(S && S.char, S && S.camp ? { mode: 'story', hero: S.hero } : { hero: S && S.hero }))); H.visited.clear(); H.visited.add(S.lastCity); if (H.storyReset) H.storyReset();
    H.placeAtCity(S.lastCity); H.clearSelected(); applyMount(); rebuildCaravan(); updateHud(true); showIntro();
  }
  function showIntro() {
    ui = 'intro'; if (document.pointerLockElement) document.exitPointerLock(); H.setPauseWanted(false);
    panel.className = 'mx-panel'; const C = charOf(S); const city = W.cityById[S.lastCity] || W.cityById[C.start];
    if (S.oldStory) { delete S.oldStory; }
    const kit = [`${fmt(S.coins)} ${CURRENCY}`].concat(Object.entries(S.pack).map(([k, n]) => `${n} ${lcName(PACK[k].name)}${n > 1 ? 's' : ''}`), Object.entries(S.hires).map(([k, n]) => `${n} ${lcName(HIRES[k].name)}`), S.paiza ? ['a silver paiza'] : [], S.cargo.letter ? ['the Sultan\'s sealed letter'] : []).join(', ');
    const hero = S.hero && window.HERO; const story = hero ? `A young Venetian merchant, about twenty, on your own account at last. You start in the Venetian quarter of Constantinople, with every road, stable, guild and harbour open to you. There is no story in the open journey: set your own course, or try for an audience with the Great Khan.` : C.story;
    panel.innerHTML = `<div class="mx-win mx-intro"><div class="mx-introhead">${hero ? HERO.portrait(S.hero, 110) : portraitSVG(S.char, 110)}<div><div class="mx-eyebrow">${city.name} · June 1272</div><div class="mx-wt">${hero ? S.hero.first + ' ' + S.hero.last : C.name}</div><div class="mx-dim"><i>${hero ? 'A Venetian merchant' : C.title}</i></div></div>${hero ? `<div style="margin-left:auto">${HERO.sealSVG(S.hero, 64)}</div>` : ''}</div><div class="mx-orn"></div>
      <p>${story}</p>
      <p><b>Your goal: ${C.goal.short}.</b> ${C.goal.text}${C.goal.type === 'deadline' ? ` <b>Deadline: day ${engineerDeadline()} (${dateOf(engineerDeadline())}).</b>` : ''}</p>
      <p><b>${C.ability.name}:</b> ${C.ability.text}</p>
      <p class="mx-dim">You set out with ${kit}.</p>
      <ul class="mx-list"><li>Press <b>P</b> to pause, save or change the graphics, <b>N</b> to zoom the minimap, and <b>J</b> for your journal and goal.</li><li>Find the <b>merchant</b> (goods, provisions and news), the <b>stables</b> and the <b>Merchants' Guild</b> around each city's central square, and press <b>E</b> to talk to them.</li><li>Buy cheap where goods are made; sell dear far away. Watch your food and water before long roads.</li></ul>
      <button class="mx-big" data-act="close">Set out</button></div>`;
    ov.classList.add('show');
  }

  // =====================================================================
  //  v11: seasons, walking speed, market events, profit maps, the guild
  //  (loans, caravan ventures, city opportunities), mercenaries
  // =====================================================================
  const MONTH_NAMES = MONTHS;
  const DAY0 = 151; // the journey starts on 1 June 1272
  function monthOf(day) { let d = (Math.floor(day) + DAY0) % 365; let m = 0; while (d >= MDAYS[m]) { d -= MDAYS[m]; m++; } return m; }
  function monthFloat(day) { let d = ((day + DAY0) % 365 + 365) % 365; let m = 0; while (m < 11 && d >= MDAYS[m]) { d -= MDAYS[m]; m++; } return m + d / MDAYS[m]; }
  const SEASONS = { winter: { name: 'Winter', icon: '❄' }, spring: { name: 'Spring', icon: '❀' }, summer: { name: 'Summer', icon: '☀' }, autumn: { name: 'Autumn', icon: '❦' } };
  function seasonOfMonth(m) { return m === 11 || m <= 1 ? 'winter' : m <= 4 ? 'spring' : m <= 7 ? 'summer' : 'autumn'; }
  function seasonNow() { return seasonOfMonth(monthOf(S.day)); }
  // snowed-in passes, December to March
  const WINTER_PASSES = [['osh', 'kashgar'], ['tashkurgan', 'kashgar'], ['badakhshan', 'tashkurgan'], ['kabul', 'balkh'], ['herat', 'kabul'], ['almaliq', 'beshbalik'], ['beshbalik', 'qocho'],
    ['khotan', 'ngari'], ['ngari', 'sakya'], ['lhasa', 'xining'], ['kathmandu', 'sakya']];
  const isPassEdge = e => WINTER_PASSES.some(([a, b]) => (e.a === a && e.b === b) || (e.a === b && e.b === a));
  const passClosed = (e, day = S.day) => isPassEdge(e) && [11, 0, 1, 2].includes(monthOf(day));
  function monsoonAt(t, day = S.day) { const m = monthOf(day); return m >= 5 && m <= 8 && t.lat < 27.5 && t.lon > 66 && !(t.lon > 98.5 && t.lat > 22.8 && t.lon < 106); }
  function seasonMul(kind, t, day = S.day) {
    const m = monthOf(day);
    if (kind === 'water') return (m >= 5 && m <= 7 && t && t.arid) ? (t.desert ? 1.6 : 1.3) : 1;
    if (kind === 'fodder') return ([11, 0, 1].includes(m) && t && t.lat > 39) ? 1.4 : 1;
    if (kind === 'food') return ([11, 0, 1].includes(m) && t && t.lat > 39) ? 1.2 : 1;
    if (kind === 'speed') return (t && monsoonAt(t, day)) ? 0.75 : ([11, 0, 1].includes(m) && t && (t.lat > 42 || t.tibet)) ? 0.85 : 1;
    return 1;
  }
  { const sk0 = speedKm; speedKm = function (s = S, t = null, mtn = false, realm = undefined) { t = t || terrainAt(H.player.x, H.player.z); return sk0(s, t, mtn, realm) * (s === S && S ? seasonMul('speed', t) * (S.flags.astrolabe !== undefined ? 1.05 : 1) : 1); }; }
  function seasonNotes(e, days) {
    const out = []; if (passClosed(e)) out.push('<span class="mx-bad">❄ pass snowed in until April</span>');
    else if (isPassEdge(e) && [10, 3].includes(monthOf(S.day))) out.push('<span class="mx-warn">❄ the pass may close soon</span>');
    const mid = e.start + (e.n >> 1); const t = terrainAt(W.P.X[mid], W.P.Z[mid]);
    if (monsoonAt(t)) out.push('<span class="mx-warn">monsoon: slow going</span>');
    if (seasonMul('water', t) > 1) out.push('<span class="mx-warn">summer heat: more water</span>');
    if (seasonMul('fodder', t) > 1) out.push('<span class="mx-warn">winter: more fodder, no grazing</span>');
    return out.join(' · ');
  }
  H.seasonMonth = () => (MODE === 'journey' && S) ? monthFloat(S.day) : (H.freeMonth ?? 6.3);

  // ---------- walking speed ----------
  let walkMul = 1;
  { const sm0 = H.speedMul; H.speedMul = () => sm0() * walkMul; }
  function cycleWalk() { walkMul = walkMul === 1 ? 2 : walkMul === 2 ? 4 : 1; H.showToast('Walking speed', walkMul === 1 ? 'Normal pace.' : `Travelling at ${walkMul}× speed. Press T again to change it.`, 'Travel'); updateHud(true); }
  H.walkMul = () => walkMul;

  // ---------- market events ----------
  // v15.1: a festival named for the culture AND the month it falls in
  function festName(c) {
    const m = monthOf(S ? S.day : 0); const cu = c.culture;
    if (['byz', 'armenian', 'georgian'].includes(cu)) return m === 3 || m === 2 ? 'The Easter feast' : m === 4 || m === 5 ? 'The feast of Pentecost' : m === 7 ? 'The feast of the Dormition' : m === 11 ? 'The Christmas feast' : m === 0 ? 'The feast of Epiphany' : 'The feast of the city\'s patron saint';
    if (cu === 'chinese' || cu === 'song') return m <= 1 ? 'The Lantern Festival' : m === 4 || m === 5 ? 'The Dragon Boat Festival' : m === 8 ? 'The Mid-Autumn Festival' : m === 9 ? 'The Double Ninth festival' : 'A temple fair';
    if (cu === 'tibet') return m === 1 ? 'Losar, the new year' : m === 4 || m === 5 ? 'Saga Dawa' : m >= 10 ? 'The butter-lamp festival' : 'A monastery festival';
    if (cu === 'indian') return m === 2 ? 'Holi' : m === 8 || m === 9 ? 'Dussehra' : m === 10 ? 'Diwali, the festival of lamps' : 'A temple festival';
    if (cu === 'sea') return m === 3 ? 'The water festival' : m === 9 || m === 10 ? 'The festival of lights' : 'A pagoda festival';
    if (cu === 'mongol') return m === 6 || m === 7 ? 'The Naadam games' : m === 1 ? 'The White Month feast' : 'A great feast of the khans';
    return m === 4 ? 'The feast at the end of Ramadan' : m === 5 || m === 6 ? 'The Feast of Sacrifice' : m === 9 ? 'The Prophet\'s birthday' : 'The great market fair';
  }
  const MKT_TYPES = [
    { id: 'famine', title: c => `Famine in ${c.name}`, text: 'The harvest has failed. Food of every kind fetches famine prices, and provisions are dear.', goods: ['dates', 'fruit', 'sugar', 'salt', 'olive', 'tea'], types: 'F', mult: 2.2, supply: 2, ok: c => true },
    { id: 'wedding', title: c => `A royal wedding at ${c.name}`, text: 'A prince is to marry, and the court is buying silks, jewels and perfumes for the feast.', goods: ['silk', 'brocade', 'pearls', 'rubies', 'rosewater', 'coral', 'amber', 'emeralds'], types: 'TG', mult: 1.9, ok: c => ECON.tierOf(c) >= 2 },
    { id: 'army', title: c => `An army gathers at ${c.name}`, text: 'Troops are mustering for a campaign and buying tack, blades, felt and furs.', goods: ['horsegear', 'blades', 'felt', 'wool', 'furs', 'buckram'], mult: 2.0, ok: c => ['ilkhan', 'chagatai', 'horde', 'yuan', 'mamluk', 'delhi', 'song'].includes(ECON.realmOf(c.id)) },
    { id: 'festival', title: c => `${festName(c)} in ${c.name}`, text: 'The city is preparing a great festival and wants incense, fragrant woods, wax and fine cloth.', goods: ['incense', 'rosewater', 'sandalwood', 'aloeswood', 'wax', 'muslin', 'cottoncloth', 'saffron'], types: 'ST', mult: 1.8, ok: c => true },
    { id: 'building', title: c => `A palace rises at ${c.name}`, text: 'A ruler is building, and craftsmen want lacquer, carpets, glass, porcelain and timber.', goods: ['lacquer', 'carpets', 'glass', 'porcelain', 'sandalwood', 'jade', 'tin'], types: 'AI', mult: 1.8, ok: c => ECON.tierOf(c) >= 3 },
    { id: 'plague', title: c => `Sickness in ${c.name}`, text: 'Fever has broken out. Doctors pay anything for rhubarb, musk, balsam and sal ammoniac.', goods: ['rhubarb', 'musk', 'balsam', 'salammoniac', 'cinnamon', 'ginger'], types: 'S', mult: 2.2, ok: c => true },
    { id: 'glut', glut: true, title: c => `A glut at ${c.name}`, text: 'A huge caravan has just arrived and flooded the market. Its goods are going cheap.', goods: null, mult: 0.6, ok: c => ECON.offers(c.id).length > 1 },
  ];
  function mktActive(cid, day = S.day) { return (S.mkt || []).filter(e => e.city === cid && day >= e.start && day < e.end); }
  function mktMul(s, gid, cid, day) { if (!s || !s.mkt) return 1; let m = 1; for (const e of s.mkt) if (e.city === cid && day >= e.start && day < e.end && e.goods[gid]) m *= e.goods[gid]; return m; }
  { const bp = ECON.buyPrice, sp = ECON.sellPrice; ECON.buyPrice = (s, g, c, d) => bp(s, g, c, d) * mktMul(s, g, c, d); ECON.sellPrice = (s, g, c, d) => sp(s, g, c, d) * mktMul(s, g, c, d); }
  { const sup0 = ECON.supplyPrice; ECON.supplyPrice = (k, cid) => { let p = sup0(k, cid); if (S && S.mkt) for (const e of mktActive(cid)) if (e.supply) p *= e.supply; return +p.toFixed(2); }; }
  function spawnMarketEvent(quiet) {
    const live = (S.mkt || []).filter(e => S.day < e.end); S.mkt = live; if (live.filter(e => !e.war).length >= 7) return;
    let pool = W.cities.filter(c => !c.holy && !live.some(e => e.city === c.id)); const dd = distFrom(nearestCityId()); const nearby = pool.filter(c => dd[c.id] < 2200); if (nearby.length && rnd() < 0.65) pool = nearby; const c = pick(pool);
    const types = MKT_TYPES.filter(t => t.ok(c)); const T = pick(types); const goods = {};
    if (T.glut) { const of = ECON.offers(c.id).filter(g => !GOOD[g].special); const g = pick(of); goods[g] = T.mult; }
    else { const pool0 = T.types ? GOODS.filter(g => g.m && g.m !== MARKET.of(c.id) && T.types.includes(g.type) && 'cur'.includes(g.rar)).map(g => g.id) : T.goods; const cand = pool0.filter(g => GOOD[g] && !ECON.offers(c.id).includes(g)); const use = cand.length ? cand : T.goods.filter(g => GOOD[g]); for (let k = 0; k < Math.min(3, use.length); k++) { const g = use[(k * 7 + Math.floor(rnd() * use.length)) % use.length]; goods[g] = +(T.mult * (0.9 + rnd() * 0.2)).toFixed(2); } }
    const len = 40 + Math.floor(rnd() * 60); const ev = { id: T.id + c.id + Math.floor(S.day), type: T.id, city: c.id, title: T.title(c), text: T.text, goods, supply: T.supply || 0, start: S.day, end: S.day + len };
    S.mkt.push(ev);
    const gl = Object.keys(goods).map(g => lcName(GOOD[g].name)).join(', ');
    const msg = `${ev.title}: ${T.glut ? `${gl} selling cheap` : `${gl} wanted`} for about ${len} days.`;
    S.rumours.push(`<span class="mx-dim">${dateOf(S.day)}:</span> <b>Market news.</b> ${msg}`);
    const km = distFrom(nearestCityId())[c.id]; if (!quiet && km < 3000) H.showToast('Market news', `${msg} (${fmt(mi(km))} mi away)`, 'Rumour');
  }
  function renderMarketNews() {
    const live = (S.mkt || []).filter(e => S.day < e.end); const here = nearestCityId(); const dist = distFrom(here);
    if (!live.length) return '<p class="mx-dim">No news yet. Traders on the road bring word of shortages, feasts and gluts.</p>';
    return '<table class="mx-tb wide"><tr><th>Where</th><th>What</th><th>Goods</th><th>Ends</th></tr>' + live.sort((a, b) => dist[a.city] - dist[b.city]).map(e => `<tr><td><b>${W.cityById[e.city].name}</b><br><span class="mx-dim">${fmt(mi(dist[e.city]))} mi by road</span></td><td>${e.title}<br><span class="mx-dim">${e.text}</span></td><td>${Object.entries(e.goods).map(([g, m]) => `${ICONS(g, 26)} ${GOOD[g].name} <b class="${m > 1 ? 'mx-ok' : 'mx-bad'}">×${m}</b>`).join('<br>')}</td><td>${Math.max(0, Math.round(e.end - S.day))} days</td></tr>`).join('') + '</table>';
  }

  // ---------- profit map on hover ----------
  let pmap = null;
  // v17: no pop-up map over buttons (or the cell that holds them), so Buy, Sell and Accept stay easy to click
  function overControl(e) { const t = e.target; if (!t.closest) return false; if (t.closest('button, input, select, a, [data-act]') || t.closest('td') && t.closest('td').querySelector('button')) { if (pmap) pmap.style.display = 'none'; return true; } return false; }
  function profitMap(g, ref, x, y) {
    if (!pmap) { pmap = document.createElement('div'); pmap.id = 'mx-pmap'; pmap.style.cssText = 'position:fixed;z-index:80;pointer-events:none;background:#f4e8cc;border:2px solid #8a6a3a;box-shadow:0 6px 20px #0008;padding:6px;font:13px "EB Garamond",Georgia,serif;color:#2e1e10;display:none'; pmap.innerHTML = '<canvas width="400" height="210" style="display:block;width:400px;height:210px"></canvas><div class="pm-t" style="width:400px;font:14px/1.3 EB Garamond,Georgia,serif;letter-spacing:0;text-transform:none;margin-top:4px"></div>'; document.body.appendChild(pmap); }
    const cv = pmap.querySelector('canvas'); const gx = cv.getContext('2d'); const Wd = 400, Ht = 210;
    const L0 = 24, L1 = 124, A0 = 4, A1 = 50; const k = Math.min(Wd / ((L1 - L0) * 0.85), Ht / (A1 - A0)); const ox = (Wd - (L1 - L0) * 0.85 * k) / 2, oy = (Ht - (A1 - A0) * k) / 2;
    const P = (lon, lat) => [ox + (lon - L0) * 0.85 * k, oy + (A1 - lat) * k];
    gx.fillStyle = '#9db8bb'; gx.fillRect(0, 0, Wd, Ht); gx.fillStyle = '#eadcb4';
    for (const r of GEO.map.land) { gx.beginPath(); for (let i = 0; i < r.length; i += 2) { const [px, py] = P(r[i] / 100, r[i + 1] / 100); i ? gx.lineTo(px, py) : gx.moveTo(px, py); } gx.fill(); }
    let best = null; const here = W.cityById[nearestCityId()]; const rows = [];
    for (const c of W.cities) { if (c.holy && S.faith !== 'muslim') continue; const sp = ECON.sellPrice(S, g, c.id, S.day); const pr = (sp - ref) / ref; rows.push([c, pr]); if (pr > 0 && (!best || pr > best.pr)) best = { c, pr, sp }; }
    gx.globalCompositeOperation = 'multiply'; const top = best ? best.pr : 1;
    for (const [c, pr] of rows) {
      if (pr <= 0.05) continue; const a = Math.pow(Math.min(1, pr / top), 1.6); const [px, py] = P(c.lon, c.lat); const rad = 9 + a * 12; const gr = gx.createRadialGradient(px, py, 0, px, py, rad);
      gr.addColorStop(0, `rgba(${Math.round(200 - a * 90)},${Math.round(120 - a * 90)},${Math.round(60 - a * 40)},${0.35 + a * 0.55})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); gx.fillStyle = gr; gx.beginPath(); gx.arc(px, py, rad, 0, 7); gx.fill(); }
    gx.globalCompositeOperation = 'source-over';
    gx.strokeStyle = '#7a5a3a66'; gx.lineWidth = 0.7; for (const e of W.edges) { const A = W.cityById[e.a], Bc = W.cityById[e.b]; const [ax, ay] = P(A.lon, A.lat), [bx, by] = P(Bc.lon, Bc.lat); gx.beginPath(); gx.moveTo(ax, ay); gx.lineTo(bx, by); gx.stroke(); }
    const [hx, hy] = P(here.lon, here.lat); gx.fillStyle = '#1e5a8a'; gx.beginPath(); gx.arc(hx, hy, 4, 0, 7); gx.fill(); gx.strokeStyle = '#fff'; gx.lineWidth = 1.5; gx.stroke();
    if (best) { const [bx, by] = P(best.c.lon, best.c.lat); gx.strokeStyle = '#8a1a0a'; gx.lineWidth = 2; gx.beginPath(); gx.arc(bx, by, 6, 0, 7); gx.stroke(); }
    pmap.querySelector('.pm-t').innerHTML = `<b>${GOOD[g].name}</b>: where it sells for more than ${fmt1(ref)}. Darker = more profit. <span style="color:#1e5a8a">●</span> you are here.${best ? `<br>Best: <b>${best.c.name}</b>, about ${fmt1(best.sp)} (+${Math.round(best.pr * 100)}%), ${fmt(mi(distFrom(here.id)[best.c.id]))} mi away.` : '<br>No market pays more than this price.'}`;
    pmap.style.display = 'block'; const vw = innerWidth; pmap.style.left = Math.min(vw - 420, x + 18) + 'px'; pmap.style.top = Math.max(8, Math.min(innerHeight - 270, y - 120)) + 'px';
  }
  document.addEventListener('mouseover', e => { if (overControl(e)) return; const t = e.target.closest('[data-pg]'); if (!t || !S) return; const c = W.cityById[nearestCityId()]; const g = t.dataset.pg; const ref = t.dataset.ref ? +t.dataset.ref : ECON.buyPrice(S, g, c.id, S.day); profitMap(g, ref, e.clientX, e.clientY); });
  document.addEventListener('mouseout', e => { const t = e.target.closest('[data-pg]'); if (t && pmap && !t.contains(e.relatedTarget)) pmap.style.display = 'none'; });
  const hidePmap = () => { if (pmap) pmap.style.display = 'none'; };
  // v14: hovering a contract shows its route on a small map
  const routeCache = {};
  function routeMap(from, to, x, y) {
    if (!pmap) { profitMap(Object.keys(GOOD)[0], 1, -999, -999); }
    const key = from + '|' + to; const rt = routeCache[key] || (routeCache[key] = W.shortest(from, to, e => e.km));
    const pts = []; const P0 = W.P;
    let cur = from; for (const ei of rt.edges) { const e = W.edges[ei]; const seg = []; for (let i = e.start; i < e.start + e.n; i += 4) seg.push(W.toLL(P0.X[i], P0.Z[i])); seg.push(W.toLL(P0.X[e.start + e.n - 1], P0.Z[e.start + e.n - 1])); if (e.a !== cur) seg.reverse(); pts.push(...seg); cur = e.a === cur ? e.b : e.a; }
    const A = W.cityById[from], Bc = W.cityById[to]; if (!pts.length) pts.push([A.lon, A.lat], [Bc.lon, Bc.lat]);
    let L0 = 1e9, L1 = -1e9, A0 = 1e9, A1 = -1e9; for (const [lo, la] of pts) { L0 = Math.min(L0, lo); L1 = Math.max(L1, lo); A0 = Math.min(A0, la); A1 = Math.max(A1, la); }
    const cv = pmap.querySelector('canvas'); const gx = cv.getContext('2d'); const Wd = 400, Ht = 210;
    const pad = Math.max(1.2, (L1 - L0) * 0.15, (A1 - A0) * 0.15); L0 -= pad; L1 += pad; A0 -= pad; A1 += pad;
    const k = Math.min(Wd / ((L1 - L0) * 0.85), Ht / (A1 - A0)); const ox = (Wd - (L1 - L0) * 0.85 * k) / 2, oy = (Ht - (A1 - A0) * k) / 2;
    const P = (lon, lat) => [ox + (lon - L0) * 0.85 * k, oy + (A1 - lat) * k];
    gx.fillStyle = '#9db8bb'; gx.fillRect(0, 0, Wd, Ht); gx.fillStyle = '#eadcb4';
    for (const r of GEO.map.land) { gx.beginPath(); for (let i = 0; i < r.length; i += 2) { const [px, py] = P(r[i] / 100, r[i + 1] / 100); i ? gx.lineTo(px, py) : gx.moveTo(px, py); } gx.fill(); }
    gx.strokeStyle = '#7a5a3a55'; gx.lineWidth = 1; for (const e of W.edges) { const a = W.cityById[e.a], b = W.cityById[e.b]; const [ax, ay] = P(a.lon, a.lat), [bx, by] = P(b.lon, b.lat); gx.beginPath(); gx.moveTo(ax, ay); gx.lineTo(bx, by); gx.stroke(); }
    gx.strokeStyle = '#fff8'; gx.lineWidth = 6; gx.lineJoin = 'round'; gx.beginPath(); pts.forEach(([lo, la], i) => { const [px, py] = P(lo, la); i ? gx.lineTo(px, py) : gx.moveTo(px, py); }); gx.stroke();
    gx.strokeStyle = '#a8301e'; gx.lineWidth = 3; gx.setLineDash([7, 4]); gx.stroke(); gx.setLineDash([]);
    gx.font = 'bold 12px Georgia, serif'; gx.textAlign = 'center';
    let c2 = from; const stops = [from]; for (const ei of rt.edges) { const e = W.edges[ei]; c2 = e.a === c2 ? e.b : e.a; stops.push(c2); }
    for (const id of stops) { const c = W.cityById[id]; const [px, py] = P(c.lon, c.lat); const end = id === from || id === to;
      gx.fillStyle = id === from ? '#1e5a8a' : id === to ? '#a8301e' : '#5a3e28'; gx.beginPath(); gx.arc(px, py, end ? 5 : 3, 0, 7); gx.fill(); gx.strokeStyle = '#fff'; gx.lineWidth = 1.5; gx.stroke();
      if (end || stops.length <= 7) { const nm = c.name.replace(/ \(.*\)/, ''); gx.lineWidth = 3; gx.strokeStyle = '#f4e8cc'; gx.strokeText(nm, px, py - 8); gx.fillStyle = end ? '#2e1e10' : '#5a3e28'; gx.fillText(nm, px, py - 8); } }
    const days = Math.ceil(rt.dist / speedKm());
    pmap.querySelector('.pm-t').innerHTML = `<b>${A.name.replace(/ \(.*\)/, '')} → ${Bc.name.replace(/ \(.*\)/, '')}</b>: ${fmt(mi(rt.dist))} mi by road through ${stops.length - 2} ${stops.length - 2 === 1 ? 'city' : 'cities'}, about ${days} days at your speed. <span style="color:#1e5a8a">●</span> start <span style="color:#a8301e">●</span> destination`;
    pmap.style.display = 'block'; pmap.style.left = Math.min(innerWidth - 420, x + 18) + 'px'; pmap.style.top = Math.max(8, Math.min(innerHeight - 270, y - 120)) + 'px';
  }
  H.routeMap = routeMap;
  document.addEventListener('mouseover', e => { if (overControl(e)) return; const t = e.target.closest && e.target.closest('[data-route]'); if (!t || !S) return; const [a, b] = t.dataset.route.split('|'); routeMap(a, b, e.clientX, e.clientY); });
  document.addEventListener('mouseout', e => { const t = e.target.closest && e.target.closest('[data-route]'); if (t && pmap && !t.contains(e.relatedTarget)) pmap.style.display = 'none'; });


  // v15: the merchant keeps the town news: market events, rumours and what this city wants
  function renderTownNews(c) {
    let h = '<div class="mx-ct">Market news</div>' + renderMarketNews();
    const rum = (S.rumours || []).slice(-4).reverse(); if (rum.length) h += '<div class="mx-ct">Rumours from the road</div><ul class="mx-list">' + rum.map(r => `<li>${typeof r === 'string' ? r : r.t || r.text || ''}</li>`).join('') + '</ul>';
    const o = opportunity(c); if (o) h += `<div class="mx-ct">In ${c.name.replace(/ \(.*\)/, '')}</div><p>${o.title}: ${o.text || ''} <span class="mx-dim">Ask at the Merchants' Guild.</span></p>`;
    return h;
  }
  // ---------- the merchants' guild: loans, ventures, opportunities ----------
  const LENDERS = { constantinople: 'the Genoese bankers of Galata', cairo: 'the Kārimī bankers', zaitun: 'the merchants of the foreign quarter', tabriz: 'the ortogh merchant partnership', cambay: 'the Jain shroffs of Cambay', khanbaliq: 'the Uyghur ortogh bankers' };
  const LOANS = { small: { name: 'Small loan', amt: 300, rate: 0.03, months: 6 }, medium: { name: 'Medium loan', amt: 800, rate: 0.04, months: 10 }, large: { name: 'Large loan', amt: 2000, rate: 0.05, months: 14 } };
  const RISKS = { low: { name: 'Low risk', p: 0.9, mult: [1.2, 1.35], fail: 0.6, days: [35, 60], blurb: 'A well-guarded caravan on a short, safe road.' },
    medium: { name: 'Medium risk', p: 0.7, mult: [1.6, 1.9], fail: 0.3, days: [60, 95], blurb: 'A long haul through two or three realms.' },
    high: { name: 'High risk', p: 0.45, mult: [2.5, 3.2], fail: 0, days: [90, 150], blurb: 'A daring venture across deserts or war zones.' } };
  function seeded(str) { let s = 0; for (const ch of str + (S.seed || '')) s = (s * 31 + ch.charCodeAt(0)) >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function ventureOffers(c) {
    const r = seeded(c.id + Math.floor(S.day / 20)); const dist = distFrom(c.id); const far = W.cities.filter(o => dist[o.id] > 700 && dist[o.id] < 4500 && !o.holy);
    return ['low', 'medium', 'high'].map(k => { const R = RISKS[k]; const to = far[Math.floor(r() * far.length)] || W.cities[0]; const of = ECON.offers(c.id); const g = of[Math.floor(r() * of.length)] || 'silk';
      return { risk: k, to: to.id, g, days: Math.round(R.days[0] + r() * (R.days[1] - R.days[0])), mult: +(R.mult[0] + r() * (R.mult[1] - R.mult[0])).toFixed(2) }; });
  }
  function opportunity(c) {
    const r = seeded('opp' + c.id + Math.floor(S.day / 40)); const types = ['festival', 'commission', 'book', 'dice'];
    if (['steppe', 'mongol', 'central', 'arab', 'tarim', 'rum', 'persian', 'yemen'].includes(c.culture) || c.id === 'constantinople') types.push('race', 'race');
    const lm = LANDMARKS.filter(l => !l.city && Math.hypot(l.lon - c.lon, l.lat - c.lat) < 3.2); if (lm.length) types.push('guide', 'guide');
    if (ECON.tierOf(c) >= 3) types.push('dice');
    const type = types[Math.floor(r() * types.length)]; const id = c.id + Math.floor(S.day / 40) + type; const dist = distFrom(c.id), hops = hopsFrom(c.id);
    if (type === 'festival') { const ev = mktActive(c.id).find(e => e.type === 'festival'); return { id, type, title: 'A festival is coming', text: ev ? `${ev.title} is under way. ${ev.text}` : 'The guild says a festival is coming. Check the market news: festival goods sell for much more while it lasts.', ev }; }
    if (type === 'commission') { const want = GOODS.filter(g => !g.special && 'cur'.includes(g.rar || 'c') && g.m !== MARKET.of(c.id) && !ECON.offers(c.id).includes(g.id)); const g = want[Math.floor(r() * want.length)]; const n = Math.max(1, Math.round((1 + r() * 1.5) / g.w)); const pay = Math.round(n * ECON.mid(g.id, c.id, S.day) * 1.7);
      return { id, type, g: g.id, n, pay, days: 120, title: 'The governor\'s commission', text: `The governor's steward wants ${n} ${g.unit}${n > 1 ? 's' : ''} of ${lcName(g.name)} within 120 days and will pay ${fmt(pay)} ${CURRENCY}, about 70% over the market price.` }; }
    if (type === 'book') { const cands = W.cities.filter(o => hops[o.id] >= 2 && hops[o.id] <= 5 && !o.holy); const to = cands[Math.floor(r() * cands.length)]; const pay = Math.round(40 + dist[to.id] * 0.06 + r() * 30);
      return { id, type, to: to.id, pay, days: Math.ceil(dist[to.id] / 15) + 15, title: 'A scholar\'s book', text: `A scholar asks you to carry a precious manuscript to a colleague in ${to.name} (${fmt(mi(dist[to.id]))} mi). It weighs almost nothing. Reward ${fmt(pay)} ${CURRENCY} and reputation.` }; }
    if (type === 'race') return { id, type, title: c.id === 'constantinople' ? 'Races at the Hippodrome' : 'A horse race', text: 'Riders gather on the plain outside the walls. Place a bet on one of four horses.', horses: [['The grey mare', 1.6, 0.55], ['A Turkoman stallion', 2.8, 0.3], ['The governor\'s bay', 4.5, 0.18], ['A scruffy pony', 9, 0.08]] };
    if (type === 'dice') return { id, type, title: 'A dice den', text: 'In a smoky room behind the caravanserai, merchants throw knucklebones for silver. Win and your stake doubles.' };
    const L = lm[Math.floor(r() * lm.length)]; const fee = 15 + Math.floor(r() * 25);
    return { id, type: 'guide', L: L.name, fee, days: 2 + Math.floor(r() * 3), title: `A guide to ${L.name}`, text: `A local guide offers to take you to see ${L.name}. ${L.blurb} Fee ${fee} ${CURRENCY}, ${2 + Math.floor(r() * 3)} days.` };
  }
  function renderGuild(c) {
    const tab = panelState.gtab || 'ventures'; const lender = LENDERS[c.id]; const canRepay = !!lender || c.tier >= 3;
    const tabs = [['ventures', 'Caravan ventures'], ['opps', 'In the city']]; if (lender || S.loan) tabs.push(['bank', lender ? 'Bank' : 'Your loan']); for (const f of facsIn(c.id)) if (unl('factions')) tabs.push(['fac_' + f, FACTIONS[f].house]); if (unl('property')) tabs.push(['prop', 'Property']);
    let h = `<div class="mx-tabs">${tabs.map(([k, n]) => `<button data-act="gtab" data-t="${k}" class="${tab === k ? 'on' : ''}">${n}</button>`).join('')}</div>`;
    if (tab === 'prop' && unl('property')) h += renderProperty(c);
    else if (tab.startsWith('fac_') && facsIn(c.id).includes(tab.slice(4)) && unl('factions')) h += renderFacHouse(c, tab.slice(4));
    else if (tab === 'ventures' || tab.startsWith('fac_') || tab === 'prop') {
      const mine = S.inv || [];
      h += '<div class="mx-ct">Your ventures</div>';
      if (!mine.length) h += '<p class="mx-dim">You have not backed any caravans. In a commenda you put up the money; the caravan master does the travelling, and you share the profit.</p>';
      else { h += '<table class="mx-tb wide"><tr><th>Caravan</th><th>Staked</th><th>Status</th><th></th></tr>'; for (const v of mine) { const done = S.day >= v.end; const st = !done ? `on the road, back in ${Math.ceil(v.end - S.day)} days` : v.win ? `<span class="mx-ok">returned with profit: ${fmt(v.amt * v.mult)}</span>` : `<span class="mx-bad">${v.fail ? `lost most of its goods: ${fmt(v.amt * v.fail)} left` : 'lost on the road'}</span>`;
        h += `<tr><td><b>${GOOD[v.g].name}</b> from ${W.cityById[v.from].name} to ${W.cityById[v.to].name}<br><span class="mx-dim">${RISKS[v.risk].name} · ×${v.mult} if it succeeds</span></td><td>${fmt(v.amt)}</td><td>${st}</td><td>${done ? `<button data-act="vcash" data-id="${v.id}">Collect</button>` : `<button data-act="vsell" data-id="${v.id}" title="Sell your share to the guild now">Sell share (${fmt(v.amt * 0.85)})</button>`}</td></tr>`; } h += '</table>'; }
      h += '<div class="mx-ct">Caravans looking for backers</div><table class="mx-tb wide"><tr><th>Venture</th><th>Odds</th><th>Return</th><th>Invest</th></tr>';
      for (const o of ventureOffers(c)) { const R = RISKS[o.risk]; const taken = mine.some(v => v.oid === c.id + Math.floor(S.day / 20) + o.risk);
        h += `<tr><td><b>${R.name}</b>: ${lcName(GOOD[o.g].name)} to ${W.cityById[o.to].name}<br><span class="mx-dim">${R.blurb} About ${o.days} days.</span></td><td>${Math.round(R.p * 100)}% success</td><td>×${o.mult}<br><span class="mx-dim">if it fails: ${R.fail ? '×' + R.fail : 'nothing'}</span></td><td>${taken ? '<i>backed</i>' : [50, 100, 250, 500, 1000].map(a => `<button data-act="vinvest" data-r="${o.risk}" data-a="${a}" ${S.coins < a || mine.length >= 5 ? 'disabled' : ''}>${a}</button>`).join(' ')}</td></tr>`; }
      h += '</table><div class="mx-note">Collect your share at any guild once the caravan is back. Up to five ventures at a time. Selling a share early returns 85% of your stake.</div>';
    } else if (tab === 'opps') {
      const o = opportunity(c); const done = (S.oppDone || {})[o.id];
      h += `<div class="mx-ct">${o.title}</div><p>${o.text}</p>`;
      if (o.type === 'commission') { const have = S.cargo[o.g] || 0; const acc = (S.errands || []).find(e => e.id === o.id);
        h += done ? '<p class="mx-ok">Commission fulfilled.</p>' : acc ? `<p>You accepted. Bring ${o.n} here by day ${Math.floor(acc.due)} (you carry ${have}). ${have >= o.n ? `<button data-act="oppdeliver">Deliver now</button>` : ''}</p>` : `<button data-act="oppaccept">Accept the commission</button>`; }
      else if (o.type === 'book') h += done ? '<p class="mx-ok">You have the book.</p>' : `<button data-act="oppaccept">Carry the book</button>`;
      else if (o.type === 'race') h += done ? '<p class="mx-dim">You have already bet on today\'s race.</p>' : '<table class="mx-tb wide">' + o.horses.map((hs, i) => `<tr><td><b>${hs[0]}</b></td><td>pays ${hs[1]}×</td><td>${[10, 50, 100].map(a => `<button data-act="race" data-i="${i}" data-a="${a}" ${S.coins < a ? 'disabled' : ''}>Bet ${a}</button>`).join(' ')}</td></tr>`).join('') + '</table>';
      else if (o.type === 'dice') { const n = (S.dice || {})[o.id] || 0; h += n >= 5 ? '<p class="mx-dim">The players have had enough of you for today.</p>' : `<p>Throws left tonight: ${5 - n}. ${[10, 25, 50].map(a => `<button data-act="dice" data-a="${a}" ${S.coins < a ? 'disabled' : ''}>Stake ${a}</button>`).join(' ')}</p>`; }
      else if (o.type === 'guide') h += done ? '<p class="mx-ok">You have seen it.</p>' : `<button data-act="oppaccept" ${S.coins < o.fee ? 'disabled' : ''}>Hire the guide (${o.fee})</button>`;
      else if (o.type === 'festival') h += '<p class="mx-dim">See the Market news tab for what sells.</p>';
      const er = (S.errands || []); if (er.length) h += '<div class="mx-ct">Your errands</div><ul class="mx-list">' + er.map(e => e.type === 'book' ? `<li>A manuscript for ${W.cityById[e.to].name}, by day ${Math.floor(e.due)}: ${fmt(e.pay)} ${CURRENCY}</li>` : `<li>${e.n} ${lcName(GOOD[e.g].name)} for the governor of ${W.cityById[e.to].name}, by day ${Math.floor(e.due)}: ${fmt(e.pay)} ${CURRENCY}</li>`).join('') + '</ul>';
      h += '<div class="mx-note">Each city has something different, and it changes every 40 days.</div>';
    } else if (tab === 'news') h += renderMarketNews();
    else if (tab === 'bank') {
      const L = S.loan;
      if (L) { const over = S.day > L.due; h += `<div class="mx-ct">Your loan from ${L.lender}</div><p>You owe <b>${fmt(L.bal)} ${CURRENCY}</b>. Interest of ${Math.round(L.rate * 100)}% is added every month. ${over ? '<b class="mx-bad">It is overdue: the bankers have sent mercenaries after you.</b>' : `Repay by day ${Math.floor(L.due)} (${dateOf(L.due)}).`}</p>`;
        h += canRepay ? `<p>${[100, 500].map(a => `<button data-act="repay" data-a="${a}" ${S.coins < 1 ? 'disabled' : ''}>Repay ${a}</button>`).join(' ')} <button data-act="repay" data-a="all" ${S.coins < 1 ? 'disabled' : ''}>Repay everything you can</button></p>` : `<p class="mx-dim">This town is too small to take a repayment. Loans can be repaid in any major city (the larger cities on the map) or at a banking house: ${Object.keys(LENDERS).map(id => W.cityById[id].name).join(', ')}.</p>`; }
      else { h += `<div class="mx-ct">Borrow from ${lender}</div><table class="mx-tb wide"><tr><th>Loan</th><th>Interest</th><th>Repay within</th><th></th></tr>` + Object.entries(LOANS).map(([k, l]) => `<tr><td><b>${l.name}</b>: ${fmt(l.amt)} ${CURRENCY}</td><td>${Math.round(l.rate * 100)}% a month, compounding</td><td>${l.months} months</td><td><button data-act="loan" data-k="${k}">Borrow</button></td></tr>`).join('') + '</table>'; }
      h += `<div class="mx-note">One loan at a time, borrowed at a banking house (${Object.keys(LENDERS).map(id => W.cityById[id].name).join(', ')}). You can repay it in any major city. If you miss the deadline, the bankers' mercenaries will come for everything you own.</div>`;
    }
    return h;
  }
  function guildAct(a, d, c) {
    switch (a) {
      case 'gtab': panelState.gtab = d.t; return true;
      case 'mtab': panelState.mtab = d.t; return true;
      case 'vinvest': { const amt = +d.a; if (S.coins < amt) return true; const o = ventureOffers(c).find(o => o.risk === d.r); const R = RISKS[o.risk]; S.coins -= amt; const win = rnd() < R.p;
        (S.inv = S.inv || []).push({ id: 'v' + Math.floor(rnd() * 1e9), oid: c.id + Math.floor(S.day / 20) + o.risk, from: c.id, to: o.to, g: o.g, risk: o.risk, amt, mult: o.mult, fail: R.fail, win, start: S.day, end: S.day + o.days, told: false });
        H.showToast('Commenda', `You back a caravan carrying ${lcName(GOOD[o.g].name)} to ${W.cityById[o.to].name} with ${fmt(amt)} ${CURRENCY}. It should be back in about ${o.days} days.`, 'Guild'); return true; }
      case 'vcash': { const v = (S.inv || []).find(v => v.id === d.id); if (!v || S.day < v.end) return true; const pay = Math.round(v.win ? v.amt * v.mult : v.amt * v.fail); S.coins += pay; S.inv = S.inv.filter(x => x !== v); if (v.win) S.rep = Math.min(100, S.rep + 2);
        H.showToast('Commenda', pay ? `You collect ${fmt(pay)} ${CURRENCY} from the venture.` : 'The caravan was lost. Your stake is gone.', 'Guild'); return true; }
      case 'vsell': { const v = (S.inv || []).find(v => v.id === d.id); if (!v || S.day >= v.end) return true; S.coins += Math.round(v.amt * 0.85); S.inv = S.inv.filter(x => x !== v); return true; }
      case 'loan': { if (S.loan) return true; const l = LOANS[d.k]; S.coins += l.amt; S.loan = { k: d.k, lender: LENDERS[c.id], bal: l.amt, rate: l.rate, start: S.day, nextInt: S.day + 30, due: S.day + l.months * 30, nextMerc: 0 };
        H.showToast('Loan', `You borrow ${fmt(l.amt)} ${CURRENCY}. ${Math.round(l.rate * 100)}% interest is added every month. Repay within ${l.months} months.`, 'Bank'); return true; }
      case 'repay': { const L = S.loan; if (!L) return true; const amt = Math.min(L.bal, S.coins, d.a === 'all' ? 1e9 : +d.a); S.coins -= amt; L.bal = Math.round((L.bal - amt) * 100) / 100;
        if (L.bal <= 0.5) { S.loan = null; S.rep = Math.min(100, S.rep + 3); H.showToast('Loan repaid', 'The bankers tear up your bond. Your credit is good.', 'Bank'); } return true; }
      case 'oppaccept': { const o = opportunity(c); (S.oppDone = S.oppDone || {});
        if (o.type === 'commission') (S.errands = S.errands || []).push({ id: o.id, type: 'commission', to: c.id, g: o.g, n: o.n, pay: o.pay, due: S.day + o.days });
        if (o.type === 'book') { (S.errands = S.errands || []).push({ id: o.id, type: 'book', to: o.to, pay: o.pay, due: S.day + o.days }); S.oppDone[o.id] = 1; }
        if (o.type === 'guide') { S.coins -= o.fee; S.oppDone[o.id] = 1; passDays(o.days, terrainAt(H.player.x, H.player.z)); S.rep = Math.min(100, S.rep + 4); const ru = M.rumour(); H.showToast(o.L, `You spend ${o.days} days seeing ${o.L} with your guide, and come back with stories to tell (+4 reputation). On the way the guide tells you: ${ru}`, 'Guide'); }
        return true; }
      case 'oppdeliver': { const o = opportunity(c); const e = (S.errands || []).find(e => e.id === o.id); if (!e || (S.cargo[e.g] || 0) < e.n) return true; S.cargo[e.g] -= e.n; if (!S.cargo[e.g]) delete S.cargo[e.g]; S.coins += e.pay; S.rep = Math.min(100, S.rep + 5); S.errands = S.errands.filter(x => x !== e); S.oppDone[o.id] = 1;
        H.showToast('Commission', `The governor's steward pays you ${fmt(e.pay)} ${CURRENCY}.`, 'Guild'); return true; }
      case 'race': { const o = opportunity(c); const hs = o.horses[+d.i]; const amt = +d.a; if (S.coins < amt) return true; S.coins -= amt; (S.oppDone = S.oppDone || {})[o.id] = 1;
        let r = rnd(), win = 0; for (let i = 0; i < 4; i++) { r -= o.horses[i][2]; if (r <= 0) { win = i; break; } } if (r > 0) win = 0;
        const won = win === +d.i; if (won) S.coins += Math.round(amt * hs[1]); H.showToast('The race', won ? `${hs[0]} wins! You collect ${fmt(Math.round(amt * hs[1]))} ${CURRENCY}.` : `${o.horses[win][0]} wins. Your ${fmt(amt)} is gone.`, 'Race'); return true; }
      case 'dice': { const o = opportunity(c); const amt = +d.a; if (S.coins < amt) return true; (S.dice = S.dice || {})[o.id] = (S.dice[o.id] || 0) + 1; const won = rnd() < 0.46; S.coins += won ? amt : -amt;
        H.showToast('Dice', won ? `The bones fall your way: +${amt}.` : `You lose ${amt}.`, 'Dice'); return true; }
    }
    return false;
  }
  // errands and ventures on arrival
  function v11Arrive(c, msgs) {
    if (walkMul !== 1) { walkMul = 1; updateHud(true); }
    for (const e of (S.errands || []).filter(e => e.type === 'book' && e.to === c.id)) { S.coins += e.pay; S.rep = Math.min(100, S.rep + 5); msgs.push(`You deliver the scholar's manuscript and receive ${fmt(e.pay)} ${CURRENCY}.`); }
    S.errands = (S.errands || []).filter(e => !(e.type === 'book' && e.to === c.id));
    if ((LENDERS[c.id] || c.tier >= 3) && S.loan) msgs.push(`You can repay your loan at the guild here (you owe ${fmt(S.loan.bal)}).`);
    const ready = (S.inv || []).filter(v => S.day >= v.end); if (ready.length) msgs.push(`${ready.length} of your caravan ventures ${ready.length > 1 ? 'are' : 'is'} back: collect at the guild.`);
    const ev = mktActive(c.id); if (ev.length) msgs.push(ev.map(e => `${e.title}: ${Object.keys(e.goods).map(g => lcName(GOOD[g].name)).join(', ')} ${Object.values(e.goods)[0] > 1 ? 'wanted' : 'cheap'}.`).join(' '));
  }
  function v11Daily() {
    if (!S.mkt) { S.mkt = []; for (let k = 0; k < 5; k++) spawnMarketEvent(true); }
    if (Math.floor(S.day) % 12 === 0) spawnMarketEvent(false);
    const L = S.loan; if (L) { while (S.day >= L.nextInt) { L.bal = Math.round(L.bal * (1 + L.rate) * 100) / 100; L.nextInt += 30; }
      if (S.day > L.due && !L.warned) { L.warned = 1; L.nextMerc = S.day + 3; H.showToast('Loan overdue', `Your loan from ${L.lender} is overdue. They have hired mercenaries to collect it: everything you own.`, 'Bank'); }
      else if (!L.warned && L.due - S.day === 30) H.showToast('Loan due', `Your loan of ${fmt(L.bal)} is due in 30 days. Repay at any banking house.`, 'Bank'); }
    for (const v of (S.inv || [])) if (!v.told && S.day >= v.end) { v.told = true; H.showToast('Commenda', v.win ? `News from ${W.cityById[v.to].name}: the caravan you backed arrived safely. Collect ${fmt(v.amt * v.mult)} at any guild.` : `Bad news: the caravan you backed to ${W.cityById[v.to].name} ${v.fail ? 'lost most of its goods' : 'was lost'}.`, 'Guild'); }
    for (const e of (S.errands || []).filter(e => S.day > e.due)) { S.rep = Math.max(0, S.rep - 5); H.showToast('Errand failed', e.type === 'book' ? `You did not deliver the manuscript to ${W.cityById[e.to].name} in time (reputation −5).` : `The governor of ${W.cityById[e.to].name} has given up on you (reputation −5).`, 'Guild'); }
    S.errands = (S.errands || []).filter(e => S.day <= e.due);
  }
  // mercenaries
  const MERC_EVENT = { id: 'mercenaries', title: 'The Bankers\' Mercenaries', npc: 'bandits', w: 0,
    text: (S2, X) => `Hard-faced riders surround your caravan. Their captain unrolls your bond. "${S.loan ? S.loan.lender.replace(/^the /, 'The ') : 'Your creditors'} want their ${fmt(S.loan ? S.loan.bal : 0)} ${CURRENCY}. Pay, or we take everything."`,
    choices: [
      { t: 'Pay the whole debt now', req: S2 => S.loan && S.coins >= S.loan.bal, ok: (S2, X, M2) => { S.coins -= S.loan.bal; S.loan = null; return 'The captain counts the silver, tears up the bond and rides away.'; } },
      { t: 'Fight them off', p: (S2, X) => fightP(X, 10 + (S.loan ? S.loan.bal / 120 : 0)), why: (S2, X) => `Your strength ${X.str} against about ${Math.round(10 + (S.loan ? S.loan.bal / 120 : 0))}`,
        ok: (S2, X, M2) => { if (S.loan) S.loan.nextMerc = S.day + 30; return 'You drive them off, but they will be back, and in greater numbers. The debt still stands.'; },
        bad: (S2, X, M2) => { const v = S.coins + goodsValue(nearestCityId()); S.coins = 0; const t = M2.loseAllGoods(); if (S.loan) { S.loan.bal = Math.max(0, S.loan.bal - v); if (S.loan.bal < 1) S.loan = null; else S.loan.nextMerc = S.day + 40; } return `They beat your guards and strip the caravan of its silver. ${t} ${S.loan ? `You still owe ${fmt(S.loan.bal)}.` : 'Your debt is considered paid.'}`; } },
      { t: 'Surrender everything', ok: (S2, X, M2) => { const v = S.coins + goodsValue(nearestCityId()); S.coins = 0; const t = M2.loseAllGoods(); if (S.loan) { S.loan.bal = Math.max(0, S.loan.bal - v); if (S.loan.bal < 1) S.loan = null; else S.loan.nextMerc = S.day + 40; } return `They take your silver and goods. ${t} ${S.loan ? `You still owe ${fmt(S.loan.bal)}.` : 'Your debt is settled.'}`; } },
    ] };
  { const me0 = maybeEvent; maybeEvent = function () { if (!ui && S.loan && S.day > S.loan.due && S.loan.nextMerc && S.day >= S.loan.nextMerc && !H.getCity()) { S.loan.nextMerc = S.day + 25; triggerEvent(MERC_EVENT, eventContext()); return; } return me0(); }; }

  // ---------- calendar ----------
  function renderCalendar() {
    const m = monthOf(S.day); const y = 1272 + Math.floor((Math.floor(S.day) + DAY0) / 365);
    let h = `<p>It is <b>${MONTH_NAMES[m]} ${y}</b>, ${lcName(SEASONS[seasonOfMonth(m)].name)} ${SEASONS[seasonOfMonth(m)].icon}. Seasons change the roads:</p><div class="mx-cal">`;
    for (let k = 0; k < 12; k++) { const se = seasonOfMonth(k); const fx = []; if ([11, 0, 1, 2].includes(k)) fx.push('passes closed'); if (k >= 5 && k <= 8) fx.push('monsoon'); if (k >= 5 && k <= 7) fx.push('desert heat'); if ([11, 0, 1].includes(k)) fx.push('northern cold');
      h += `<div class="mx-cm ${se}${k === m ? ' now' : ''}"><b>${MONTH_NAMES[k].slice(0, 3)}</b><span>${SEASONS[se].icon}</span><i>${fx.join(', ')}</i></div>`; }
    h += '</div><ul class="mx-list"><li><b>Winter (December–March):</b> snow closes the Pamir, Hindu Kush, Tian Shan and Tibetan passes. North of the Caspian and on the steppe, animals need 40% more fodder and people 20% more food, and travel is slower.</li><li><b>Summer (June–August):</b> crossing deserts takes 60% more water, and dry country 30% more.</li><li><b>Monsoon (June–September):</b> roads in India and Southeast Asia are 25% slower.</li><li>The crossroads and restock panels warn about all of these.</li></ul>';
    return h;
  }

  // ============================================================
  //  v16: THE STORY (campaign). Acts unlock the game a piece at a time;
  //  each act has objectives, a story card, and a chapter save.
  // ============================================================
  const CAMP_KEY = 'silkroad_chapters_v2'; // v21: chapters of the new story (v1 held Matteo's acts)
  GOOD.bailoletter = { id: 'bailoletter', name: 'Letter to the bailo', unit: 'letter', w: 0.05, base: 0, special: true, quest: true, dest: 'To present at the Merchants\' Guild of Constantinople',
    blurb: 'Your late master\'s letter, sealed with the lion of Saint Mark, recommending you to the bailo of the Venetian quarter in Constantinople.' };
  GOOD.matteoring = { id: 'matteoring', name: 'Matteo\'s ring', unit: 'ring', w: 0, base: 0, special: true, quest: true, dest: 'Any brother of the Scuola di San Marco will know it',
    blurb: 'Ser Matteo Corner\'s seal ring, cut with the winged lion of Saint Mark. He pressed it into your hand on the Aleppo road.' };
  GOOD.griffinletter = { id: 'griffinletter', name: 'Letter with a griffin seal', unit: 'letter', w: 0, base: 0, special: true, quest: true, dest: 'Found on the riders. Read it in your journal',
    blurb: '"Corner and all he carries to the Tyrian. No one else is to walk away from that road. — L. Z."' };
  // features each chapter opens up (anything not listed is always on); 5 = after the story
  const FEATURES = { stables: 2, guild: 2, water: 2, scuola: 2, news: 3, factions: 5 };
  const ACT_NAMES = { 1: 'The Apprentice', 2: 'The Ring', 3: 'The Broker', 4: 'The Ransom' };
  window.CAMP_ACT_NAMES = ACT_NAMES;
  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];
  function unl(k) { if (!S || !S.camp) return true; return S.camp.act >= (FEATURES[k] || 0); }
  function vendorRoles() { return ['merchant'].concat(unl('stables') ? ['outfitter'] : [], unl('guild') ? ['guild'] : []); }
  const ev = k => { if (S && S.camp && !S.camp.ev[k]) { S.camp.ev[k] = 1; campCheck(); } };
  const nm = id => W.cityById[id].name.replace(/ \(.*\)/, '');
  const heroName = () => S && S.hero ? `${S.hero.first} ${S.hero.last}` : 'Matteo Corner';

  // ---------------- new games and chapter saves ----------------
  function campInitState(cid, o) {
    if (!o || o.mode !== 'story') { const st = newState(cid); if (o && o.hero) st.hero = o.hero; return st; }
    if (o.chapter) { try { const all = JSON.parse(localStorage.getItem(CAMP_KEY) || '{}'); const j = all[o.chapter]; if (j) { const s = JSON.parse(j); s.camp.fresh = true; return s; } } catch (e) { } }
    const st = newState('venetian');
    // your own purse is small: the goods you carry are Matteo's, his to sell and yours to learn on
    Object.assign(st, { coins: 15, food: 12, water: 0, fodder: 0, rep: 5, cargo: { muranoglass: 2, scarlet: 1 }, lastCity: 'acre', visited: ['acre'], lastRealm: ECON.realmOf('acre') });
    st.hero = o.hero || (window.HERO ? HERO.randomLook() : { first: 'Marco', last: 'Dandolo', gender: 'm' });
    st.camp = { v21: true, act: 1, ev: {}, done: {}, startDay: 0, base: 1, fresh: true, hints: {}, arrows: 10 };
    return st;
  }
  function saveChapter() {
    if (S && S.adminUsed) return; // v20: games touched by admin mode never overwrite the chapter saves
    try { const all = JSON.parse(localStorage.getItem(CAMP_KEY) || '{}'); const keep = S.camp.fresh; delete S.camp.fresh;
      all[S.camp.act] = JSON.stringify(S); if (keep) S.camp.fresh = keep; localStorage.setItem(CAMP_KEY, JSON.stringify(all)); } catch (e) { }
  }

  // ---------------- the chapters ----------------
  const inCity = id => { const c = H.getCity(); return c && c.id === id; };
  const E = k => () => !!S.camp.ev[k];
  const ACTS = {
    1: {
      art: 'acre', where: 'Acre, spring 1272',
      intro: () => `Two summers after the truce of Cremona, Ser Matteo Corner, merchant of Venice and master of the Scuola di San Marco, lands at Acre with his apprentice: you, ${S.hero ? S.hero.first : 'his apprentice'}, about twenty years old, and a hold full of Venetian glass and scarlet cloth. In Acre, the last great harbour of the Crusaders, the roads to the East begin.`,
      teach: ['Find Matteo beside you and press <b>E</b> to talk to him. He goes everywhere you go.', 'The <b>merchant</b> in each city\'s square buys and sells goods, sells food, and offers delivery contracts.', 'Everyone eats one ration a day. Press <b>R</b> in a town to buy food for the next road.', '<b>J</b> opens your journal, <b>T</b> speeds up walking, <b>M</b> opens the map.'],
      steps: [
        { id: 'talk1', t: 'Talk to Matteo on the quay', hint: 'He is right beside you. Walk up to him and press E.', done: E('d11') },
        { id: 'sell', t: 'Sell the Venetian goods in Acre\'s market', hint: 'Find the stall marked "Merchant" in the square, press E, and sell the glass and the scarlet cloth.', done: () => S.camp.ev.soldVen || (!S.cargo.muranoglass && !S.cargo.scarlet) },
        { id: 'talk2', t: 'Show Matteo your purse', hint: 'Talk to Matteo again (E).', done: E('d12') },
        { id: 'buy', t: 'Buy goods to sell farther north', hint: () => `Try ${lcName(GOOD[bestFirstGood()].name)}: light, cheap here, and dear in Constantinople. Keep a little silver for food.`, done: E('bought') },
        { id: 'contract', t: 'Accept the contract to Aleppo', hint: 'On the merchant\'s Market tab: the linen for Aleppo is the first contract. You pay nothing up front.', done: E('contract') },
        { id: 'damascus', t: 'Travel to Damascus', hint: 'Buy food first (R). Leave by the gate toward Damascus; at a crossroads press the road\'s number, or F to follow it.', done: () => S.visited.includes('damascus') },
        { id: 'talk3', t: 'Talk to Matteo in Damascus', hint: 'Someone by the fountain is watching you. Talk to Matteo (E).', done: E('d13') },
        { id: 'aleppo', t: 'Set out for Aleppo', hint: 'Take the road north from Damascus toward Aleppo.', done: E('ambush') },
        { id: 'riders', t: 'Survive the riders', hint: 'Dawn in the hills.', done: E('fightA') },
        { id: 'deliver', opt: true, t: 'Deliver the Aleppo contract (optional)', hint: 'Aleppo is north. You are paid on arrival.', done: () => S.camp.ev.delivered || (S.camp.ev.fightA && !(S.contracts || []).some(k => k.id === 'story-linen')) },
        { id: 'arrive', t: () => `Reach Constantinople with 250 ${CURRENCY}`, hint: () => S.coins < 250 && S.visited.includes('constantinople') ? `You have ${fmt(S.coins)}. Sell your goods here to make up the rest.` : 'From Aleppo: Ayas on the coast, over the Taurus to Konya, then Smyrna, Nicaea and the Bosporus.',
          done: () => inCity('constantinople') && S.coins >= 250, v: () => `${fmt(S.coins)} / 250` },
        { id: 'ghisi', t: 'Find Ser Bartolomeo Ghisi in the Venetian quarter', hint: 'He waits by the Scuola\'s house in the square: look for the banner of Saint Mark, and press E.', done: E('d22') },
      ],
      end: 'ghisi',
      outro: 'Ser Bartolomeo Ghisi lends you three hundred dirham against Matteo\'s name. Somewhere east of Tabriz, men in Genoese pay are carrying your master away.',
    },
    2: {
      art: 'city', where: 'Constantinople',
      intro: 'The Scuola di San Marco cannot be seen moving against Genoa, not with the truce signed. But you are nobody yet, and nobody can go where a Venetian factor cannot. A broker in Tabriz called Bahram sells every secret between the Black Sea and the Gulf, for fifteen hundred dirham.',
      teach: ['The <b>stables</b> sell pack animals, carts and speed upgrades, and hire guards, guides and interpreters.', 'The <b>Merchants\' Guild</b> runs caravan ventures and errands in each city.', 'A brother of the <b>Scuola di San Marco</b> waits in every market city. Show him Matteo\'s ring: he passes on news, offers the Scuola\'s contracts and takes repayments on your loan.', '<b>Water</b> now counts: in deserts and dry plateaus everyone drinks. Camels drink least. Animals eat fodder.'],
      steps: [
        { id: 'animal', opt: true, t: 'Buy a pack animal (recommended)', hint: 'At the stables: a donkey is cheap and patient, a mule carries more, a camel carries most.', done: () => S.packCount() + draftCount() >= 1 },
        { id: 'tabriz', t: 'Travel to Tabriz', hint: 'East through Rûm, or by Trebizond: trade on the way. Tabriz is the Ilkhan\'s capital.', done: () => S.visited.includes('tabriz') },
        { id: 'bahram', t: () => `Pay Bahram the Broker 1,500 ${CURRENCY}`, hint: () => inCity('tabriz') ? 'Bahram keeps a table in the caravanserai by the great bazaar. Look for his sign and press E.' : 'Bahram keeps a table in the caravanserai by the great bazaar of Tabriz.', done: E('paidBahram'), v: () => `${fmt(S.coins)} / 1,500` },
      ],
      end: 'bahram',
      outro: '"All the way to Delhi, beyond the Khyber. Five thousand dirham, paid in person at that house." Bahram\'s answer cost you fifteen hundred.',
    },
    3: {
      art: 'road', where: 'Tabriz to Delhi',
      intro: 'Two months ago Matteo came through Tabriz in chains, and the Tyrian\'s men rode east with him to Delhi, where the Compagna has rented a house to court Sultan Balban\'s officials. The price of his life is five thousand dirham, paid in person. Delhi pays well for the right goods.',
      teach: ['<b>Market news</b> is now open: festivals, gluts and shortages change prices for weeks.', 'Mountain passes close with winter snow, and the summer monsoon slows travel in India. Plan your road with the calendar in your journal.', 'The road from Tabriz runs by Rayy, Nishapur, Herat and Kabul, and down through the Khyber to Lahore and Delhi.'],
      steps: [
        { id: 'raise', live: true, t: () => `Raise 5,000 ${CURRENCY}`, hint: 'Delhi pays extra for horses and other animals, furs, gems and fine textiles from the west.', done: () => S.coins >= 5000, v: () => `${fmt(S.coins)} / 5,000` },
        { id: 'delhi', t: 'Travel to Delhi', hint: 'Delhi is the Sultanate\'s capital, at the end of the Khyber road.', done: () => S.visited.includes('delhi') && !!H.getCity() && H.getCity().id === 'delhi' },
      ],
      end: 'delhi',
      outro: 'You come into Delhi past the red walls and the great victory tower. Somewhere in this city, behind a small griffin banner, the Compagna is waiting for your silver.',
    },
    4: {
      art: 'delhi', where: 'Delhi',
      intro: 'The Compagna\'s house is a walled merchant\'s house with a courtyard, new, small and secret. A small griffin banner hangs over the door.',
      teach: ['Bring five thousand dirham to the door of the Compagna\'s house and ask for Matteo.'],
      steps: [
        { id: 'ransom', live: true, t: () => `Carry 5,000 ${CURRENCY} for the ransom`, hint: 'Trade in Delhi and nearby cities if you are short.', done: () => S.coins >= 5000 || !!S.camp.ev.paidRansom, v: () => `${fmt(S.coins)} / 5,000` },
        { id: 'house', t: 'Pay the ransom at the Compagna\'s house', hint: 'Look for the griffin banner in Delhi\'s square, and the guard at the door. Press E.', done: E('paidRansom') },
        { id: 'escape', t: 'Fight your way out of the house', hint: 'Matteo is beside you.', done: E('fightB') },
        { id: 'matteo', t: 'Stay with Matteo', hint: '', done: E('d42') },
      ],
      end: 'matteo',
    },
  };
  function bestFirstGood() { // the light good from Acre that gains most by Constantinople, for the guided first trade
    let best = null; for (const g of ECON.offers('acre')) { const G = GOOD[g]; if (G.special || G.w > 0.25) continue; const r = ECON.sellPrice(S, g, 'constantinople', S.day) / ECON.buyPrice(S, g, 'acre', S.day); if (!best || r > best.r) best = { g, r }; }
    return best ? best.g : 'linen';
  }
  function stepsOf(n) { const a = ACTS[n]; if (!a) return []; return typeof a.steps === 'function' ? a.steps() : a.steps; }
  const txt = v => typeof v === 'function' ? v() : v;
  function stepDone(st) { if (!st.live && S.camp.done[st.id]) return true; let d = false; try { d = !!st.done(); } catch (e) { } if (d && !st.live) S.camp.done[st.id] = 1; return d; }

  // ---------------- checking progress ----------------
  let checking = false;
  function campCheck() {
    if (!S || !S.camp || checking || S.camp.act > 4) return; checking = true;
    try {
      const a = S.camp.act, A = ACTS[a]; const steps = stepsOf(a); let newly = [];
      for (const st of steps) { const was = !!S.camp.done[st.id]; if (stepDone(st) && !was && !st.live) newly.push(st); }
      const finished = stepDone(steps.find(s => s.id === A.end));
      if (finished && !ui && !(H.dlgOpen && H.dlgOpen()) && !window.__combatOn) { if (a < 4) advance(); else finish(); return; }
      if (newly.length) { trackerFlash = 1; updateTracker(true); }
    } finally { checking = false; }
  }
  function advance() {
    const from = S.camp.act, A = ACTS[from]; const to = from + 1;
    S.camp.act = to; S.camp.ev = Object.assign({}, S.camp.ev); S.camp.base = S.visited.length; S.camp.startDay = S.day;
    if (to === 2) { S.water = Math.max(S.water, 10); }
    refreshVendors();
    saveChapter(); save();
    showStory(to, A.outro, from);
  }
  function finish() { // Chapter IV ends with Matteo's death: the brotherhood, then free play
    S.camp.act = 5; const F = facState(S); F.venice.m = true; F.venice.s = Math.max(F.venice.s, 12); S.rep = Math.min(100, S.rep + 10); delete S.cargo.griffinletter;
    refreshVendors(); save(); if (H.storyFinale) H.storyFinale(); else showFinale();
  }
  function refreshVendors() {
    const c = H.getCity(); if (!c) { for (const [id, v] of vendorSets) { H.scene.remove(v.group); vendorSets.delete(id); } return; }
    const v = vendorSets.get(c.id); if (v) { H.scene.remove(v.group); vendorSets.delete(c.id); } c._vcol = false; spawnVendors(c);
  }

  // ---------------- story cards ----------------
  function sceneSVG(kind) {
    const ink = '#4a2a14', sky = '#efd9a8', sea = '#b9c7b0', red = '#8e2c18';
    let s = `<svg viewBox="0 0 400 130" class="mx-scene" preserveAspectRatio="xMidYMid slice"><rect width="400" height="130" fill="${sky}"/><circle cx="318" cy="38" r="20" fill="#f6e6b8" stroke="#c9a24a"/>`;
    const st = `stroke="${ink}" stroke-width="1.4" stroke-linejoin="round"`;
    if (kind === 'acre') {
      s += `<rect y="86" width="400" height="44" fill="${sea}"/><path d="M0 92 q20 -4 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0" fill="none" stroke="#7a8a72"/>`;
      s += `<path d="M190 86 V52 h10 v-8 h8 v8 h10 V40 h12 v46 Z M240 86 V60 h40 v26 Z M282 86 V48 h14 v-6 h6 v6 h10 v44 Z" fill="#d8bf8a" ${st}/><path d="M244 60 v-6 h6 v6 M258 60 v-6 h6 v6 M272 60 v-6 h6 v6" fill="none" ${st}/>`;
      s += `<path d="M60 96 h70 l-10 12 h-50 Z" fill="#7a4a24" ${st}/><path d="M96 96 V40 M96 42 L70 88 L96 88 Z M98 46 L122 86 L98 86 Z" fill="#f3e7cc" ${st}/><path d="M96 40 l10 -4 l-10 -2" fill="${red}" ${st}/>`;
    } else if (kind === 'city') {
      s += `<rect y="92" width="400" height="38" fill="${sea}"/>`;
      s += `<path d="M120 92 V66 h160 v26 Z" fill="#d8bf8a" ${st}/><path d="M150 66 a50 34 0 0 1 100 0 Z" fill="#c8ab72" ${st}/><path d="M138 66 a14 12 0 0 1 28 0 M234 66 a14 12 0 0 1 28 0" fill="#c8ab72" ${st}/><path d="M200 32 v-8 M196 27 h8" ${st}/>`;
      s += `<path d="M30 92 V74 h70 v18 M300 92 V70 h20 v-6 h10 v6 h50 v22" fill="#d8bf8a" ${st}/><path d="M104 92 V40 l4 -8 l4 8 V92 M288 92 V44 l4 -8 l4 8 V92" fill="#e4cf9c" ${st}/>`;
      for (let i = 0; i < 6; i++) s += `<path d="M${20 + i * 64} 108 h26 l-4 6 h-18 Z M${33 + i * 64} 108 V94" fill="#7a4a24" ${st}/>`;
    } else if (kind === 'road') {
      s += `<path d="M0 96 Q80 70 160 92 T320 86 T400 90 V130 H0 Z" fill="#dcc08a" ${st}/><path d="M0 78 L60 50 L110 76 L170 40 L230 78 L290 56 L340 74 L400 60 V90 H0 Z" fill="#c9b08a" opacity=".55"/>`;
      const camel = x => `<path d="M${x} 100 q4 -14 14 -12 q6 -10 12 0 q6 -2 8 -10 l6 2 l-4 12 q-2 6 -8 8 v12 M${x + 2} 100 v14 M${x + 10} 102 v12 M${x + 26} 100 v14" fill="#9a6a3a" ${st}/>`;
      s += camel(90) + camel(150) + camel(210) + `<path d="M272 114 v-22 l6 -6 l6 6 v22 M268 96 h20" fill="${red}" ${st}/>`;
    } else if (kind === 'harbour') {
      s += `<rect y="84" width="400" height="46" fill="${sea}"/><path d="M0 84 Q60 50 120 70 T240 60 T400 72 V86 H0 Z" fill="#c9b08a" ${st}/><path d="M250 70 V48 h8 v-6 h6 v6 h8 V70 M300 72 V54 h20 v18" fill="#d8bf8a" ${st}/>`;
      s += `<path d="M70 104 h120 q-6 12 -20 12 h-84 q-12 0 -16 -12 Z" fill="#7a4a24" ${st}/><path d="M128 104 V44 M128 46 Q96 66 100 98 L128 98 Z" fill="#f3e7cc" ${st}/><path d="M128 44 l14 -5 l-14 -3" fill="${red}" ${st}/>`;
      for (let i = 0; i < 7; i++) s += `<path d="M${84 + i * 14} 112 l-8 12" ${st}/>`;
    } else if (kind === 'delhi') {
      s += `<rect y="96" width="400" height="34" fill="#d8b888"/><path d="M0 96 V70 h120 v-6 h8 v6 h40 v26 Z M250 96 V72 h150 v24 Z" fill="#c08a6a" ${st}/>`;
      for (let i = 0; i < 12; i++) s += `<path d="M${i * 10 + 2} 70 v-5 h6 v5" fill="#c08a6a" ${st}/>`;
      s += `<path d="M196 96 L200 16 h10 L214 96 Z" fill="#b9775a" ${st}/><path d="M197 72 h16 M198 52 h14 M199 34 h12" ${st}/><path d="M196 16 h18 l-3 -5 h-12 Z" fill="#c08a6a" ${st}/>`;
      s += `<path d="M300 72 V54 h12 v18 M306 54 V40" fill="none" ${st}/><path d="M306 40 l16 4 l-16 4 Z" fill="#f0ece0" ${st}/><path d="M306 44 h16" stroke="#a8201a" stroke-width="2"/>`;
    } else if (kind === 'palace') {
      s += `<rect y="100" width="400" height="30" fill="#c8ab72"/><path d="M110 100 V70 h180 v30 Z" fill="#b84a2c" ${st}/><path d="M86 72 Q200 54 314 72 L290 58 Q200 44 110 58 Z" fill="#3a5a4a" ${st}/><path d="M130 48 Q200 30 270 48 L254 38 Q200 26 146 38 Z" fill="#3a5a4a" ${st}/><path d="M150 58 V48 h100 v10" fill="#b84a2c" ${st}/>`;
      for (let i = 0; i < 7; i++) s += `<path d="M${124 + i * 26} 100 V74" ${st}/>`;
    }
    return s + `<rect x="1" y="1" width="398" height="128" fill="none" stroke="#a67c43" stroke-width="2"/></svg>`;
  }
  function showStory(n, prevText, prevAct) {
    const A = ACTS[n]; if (!A) return;
    ui = 'story'; for (const k in H.keys) H.keys[k] = false; H.player.auto = false; if (document.pointerLockElement) document.exitPointerLock(); H.setPauseWanted(false);
    panel.className = 'mx-panel mx-storyp';
    const done = prevAct ? `<div class="mx-done">Chapter ${ROMAN[prevAct]} complete · ${ACT_NAMES[prevAct]}</div><p class="mx-prev">${prevText}</p><div class="mx-orn"></div>` : '';
    const goals = stepsOf(n).filter(s => !s.opt).map(s => `<li>${txt(s.t)}</li>`).join('');
    panel.innerHTML = `<div class="mx-win mx-story">${sceneSVG(A.art)}${done}<div class="mx-eyebrow">${A.where}</div><div class="mx-wt">Chapter ${ROMAN[n]}: ${ACT_NAMES[n]}</div><div class="mx-orn"></div>
      <p>${txt(A.intro)}</p>${A.teach ? `<div class="mx-ct">${n === 1 ? 'How it works' : 'Now open to you'}</div><ul class="mx-list">${A.teach.map(t => `<li>${t}</li>`).join('')}</ul>` : ''}
      <div class="mx-ct">Objectives</div><ul class="mx-list mx-goals">${goals}</ul><button class="mx-big" data-act="close">${prevAct ? 'Continue' : 'Set out'}</button></div>`;
    ov.classList.add('show');
  }

  // ---------------- objective tracker ----------------
  let trk = null, trkT = 0, trackerFlash = 0;
  function updateTracker(force) {
    if (!S) return; if (!trk) { trk = document.createElement('div'); trk.className = 'mx-obj'; $('hud').appendChild(trk); }
    if (!S.camp) { trk.style.display = 'none'; return; }
    trkT--; if (trkT > 0 && !force) return; trkT = 20;
    const a = Math.min(4, S.camp.act); const steps = stepsOf(a);
    if (S.camp.act > 4) { trk.innerHTML = `<div class="mx-ot">The story · Chapters I–IV complete</div><div class="mx-oh">A brother of the Scuola di San Marco. The road is yours; Lanfranco Zaccaria is still out there.</div>`; trk.style.display = ''; return; }
    const open = steps.filter(st => !stepDone(st)); const cur = open.find(st => !st.opt);
    const shown = steps.filter(st => stepDone(st)).slice(-2).concat(open.slice(0, 4));
    trk.innerHTML = `<div class="mx-ot">Chapter ${ROMAN[a]} · ${ACT_NAMES[a]}</div>` + shown.map(st => { const d = stepDone(st); return `<div class="mx-oi${d ? ' ok' : ''}${st === cur ? ' cur' : ''}${st.opt ? ' opt' : ''}">${d ? '✔' : '○'} ${txt(st.t)}${st.v && !d ? ` <i>${txt(st.v)}</i>` : ''}</div>`; }).join('') +
      (cur && txt(cur.hint) ? `<div class="mx-oh">${txt(cur.hint)}</div>` : '');
    trk.style.display = ''; if (hudEl) trk.style.top = (hudEl.offsetTop + hudEl.offsetHeight + 10) + 'px';
    if (trackerFlash) { trackerFlash = 0; trk.classList.remove('flash'); void trk.offsetWidth; trk.classList.add('flash'); }
  }
  function campJournalHtml() {
    const a = Math.min(4, S.camp.act); const h0 = S.hero;
    let h = `<div class="mx-introhead">${h0 && window.HERO ? HERO.portrait(h0, 74) : ''}<div><p><b>${heroName()}</b>, ${S.camp.act > 4 ? 'a brother of the Scuola di San Marco' : 'Ser Matteo Corner\'s apprentice'}. ${S.camp.act > 4 ? 'Chapters I–IV are complete. The road is yours.' : `Chapter ${ROMAN[a]}: <b>${ACT_NAMES[a]}</b>.`}</p></div>${h0 && window.HERO ? `<div style="margin-left:auto" title="Your merchant's mark">${HERO.sealSVG(h0, 58)}</div>` : ''}</div>`;
    if (S.camp.act <= 4) h += '<ul class="mx-checks">' + stepsOf(a).map(st => { const d = stepDone(st); return `<li class="${d ? 'ok' : ''}">${d ? '✔' : '○'} ${txt(st.t)}${st.v ? ` <span class="mx-dim">(${txt(st.v)})</span>` : ''}<br><span class="mx-dim">${txt(st.hint) || ''}</span></li>`; }).join('') + '</ul>';
    if (S.scuolaDebt > 0) h += `<p>You owe the Scuola di San Marco <b>${fmt(S.scuolaDebt)} ${CURRENCY}</b>. Repay it to any brother of the Scuola, when you can.</p>`;
    if (S.cargo.griffinletter || S.camp.ev.letter) h += `<div class="mx-ct">The letter with the griffin seal</div><blockquote class="mx-letter">"Corner and all he carries to the Tyrian. No one else is to walk away from that road."<br><span>— L. Z.</span></blockquote>`;
    h += `<div class="mx-ct">The story so far</div><ol class="mx-list">${[1, 2, 3, 4].map(n => `<li class="${n < S.camp.act ? 'mx-ok' : n === S.camp.act ? '' : 'mx-dim'}">Chapter ${ROMAN[n]}: ${ACT_NAMES[n]}${n < S.camp.act ? ' ✔' : ''}</li>`).join('')}</ol>`;
    return h + `<p class="mx-dim"><b>${charOf(S).ability.name}:</b> ${charOf(S).ability.text} Every chapter you reach is saved: replay it from the character screen.</p>`;
  }

  // ---------------- hooks into the game ----------------
  // the HUD runs every frame: refresh the tracker, and check once a second for things that change while you walk
  let campT = 0;
  { const o = updateHud; updateHud = function (force) { o(force); if (MODE !== 'journey') return; updateTracker(force); const now = performance.now(); if (S && S.camp && !ui && now - campT > 1000) { campT = now; campCheck(); } }; }
  { const o = waterUse; waterUse = function (s = S) { return unl('water') ? o(s) : 0; }; }
  { const o = showIntro; showIntro = function () { if (S && S.camp) { if (S.camp.act > 4) return; if (S.camp.fresh) { delete S.camp.fresh; saveChapter(); } if (H.storyIntro && H.storyIntro()) return; showStory(Math.min(4, S.camp.act)); return; } o(); }; }
  { const o = maybeEvent; maybeEvent = function () { if (S && S.camp && S.camp.act <= 1 && rnd() < 0.55) return; if (S && S.camp && H.storyNoEvents && H.storyNoEvents()) return; return o(); }; }
  { const o = openUI; openUI = function (name) { if (S && S.camp && name === 'vendor' && panelState.vendor) ev('talk_' + panelState.vendor.role); return o(name); }; }
  { const o = act; act = function (a, d) {
    if (!S || !S.camp) return o(a, d);
    const foodB = S.food; const had = (S.cargo.muranoglass || 0) + (S.cargo.scarlet || 0); o(a, d);
    if (a === 'buy') ev('bought');
    if ((a === 'supply' && d.k === 'food') || a === 'restock' || a === 'supply1each') { if (S.food > foodB) ev('food'); }
    if (a === 'contract' && (S.contracts || []).some(k => k.id === 'story-linen')) ev('contract');
    if (a === 'sell' && had && !S.cargo.muranoglass && !S.cargo.scarlet && S.camp.act === 1) ev('soldVen');
    campCheck(); };
  }
  // profit shown on every sale, story or not
  { const o = act; act = function (a, d) {
    if (a !== 'sell' || !S || !d.g) return o(a, d);
    const g = d.g, n0 = S.cargo[g] || 0, c0 = S.coins, basis = S.basis[g] || 0; o(a, d);
    const sold = n0 - (S.cargo[g] || 0); if (sold <= 0) return; const got = S.coins - c0;
    if (basis > 0) { const pr = got - basis * sold; S.profit = (S.profit || 0) + pr; if (pr > 0 && S.camp) ev('profit');
      H.showToast('Sold', `${sold} ${GOOD[g].unit}${sold > 1 ? 's' : ''} of ${lcName(GOOD[g].name)} for ${fmt(got)} ${CURRENCY}: <b class="${pr >= 0 ? 'mx-ok' : 'mx-bad'}">${pr >= 0 ? 'profit' : 'loss'} ${fmt(Math.abs(pr))}</b>.`, 'Market'); }
    else { S.profit = (S.profit || 0) + got; H.showToast('Sold', `${sold} ${GOOD[g].unit}${sold > 1 ? 's' : ''} of ${lcName(GOOD[g].name)} for ${fmt(got)} ${CURRENCY}.`, 'Market'); if (S.camp) ev('profit'); }
  }; }
  { const o = H.onCity; H.onCity = function (c) {
    const deliv = S && S.camp && c && (S.contracts || []).some(k => k.to === c.id && k.id === 'story-linen');
    o(c); if (deliv) ev('delivered');
    if (S && S.camp && S.camp.act === 1 && S.camp.ev.fightA && c && c.id === 'constantinople' && S.coins < 250) setTimeout(() => H.showToast('Constantinople', `You have reached the Queen of Cities with ${fmt(S.coins)} ${CURRENCY}. Sell your goods to make up 250 before you look for Ser Bartolomeo.`, 'Chapter I'), 5000);
    campCheck(); }; }
  { const o = cityContracts; cityContracts = function (c) {
    const out = o(c); if (!S || !S.camp || S.camp.act !== 1 || c.id !== 'acre' || (S.takenC && S.takenC['story-linen'])) return out;
    const km = Math.round(distFrom('acre').aleppo || 510);
    return [{ id: 'story-linen', g: 'linen', n: 8, to: 'aleppo', from: 'acre', km, hops: 2, reward: 90, days: 60, selfProfit: 0, client: 'Ser Bonaventura, an old friend of Matteo\'s' }].concat(out.slice(0, 2)); }; }
  // the Khan's audience is not part of this story: it stays open in the open journey only
  { const o = findInteraction; findInteraction = function () { o(); if (S && S.camp && near && near.kind === 'audience') near = null; }; }

  // ---------------- the Scuola di San Marco: a brother in every market city ----------------
  const SCUOLA_NAMES = ['Ser Pietro Badoer', 'Ser Giacomo Zeno', 'Ser Marino Morosini', 'Ser Nicolò Querini', 'Ser Lorenzo Soranzo', 'Ser Andrea Michiel', 'Ser Tommaso Bembo', 'Ser Filippo Giustinian'];
  const SCUOLA_CITIES = new Set((typeof MARKETS_DATA !== 'undefined' ? MARKETS_DATA.flatMap(m => m.stars || []) : []));
  ROLES.scuola = 'brother of the Scuola di San Marco';
  { const o = vendorRoles; vendorRoles = function (c) { const r = o(c); if (c && S && unl('scuola') && SCUOLA_CITIES.has(c.id) && (!S.camp || S.camp.act >= 2)) r.push('scuola'); return r; }; }
  function scuolaContracts(c) {
    const period = Math.floor(S.day / 25); const r = seeded('scuola' + c.id + period); const dist = distFrom(c.id), hops = hopsFrom(c.id);
    const dests = [...SCUOLA_CITIES].filter(id => id !== c.id && dist[id] < 2600 && hops[id] >= 2); const goods = ECON.offers(c.id).filter(g => !GOOD[g].special && 'cur'.includes(GOOD[g].rar || 'c')); if (!dests.length || !goods.length) return [];
    const out = [];
    for (let i = 0; i < 2; i++) { const to = dests[Math.floor(r() * dests.length)]; const g = goods[Math.floor(r() * goods.length)]; const G = GOOD[g]; const km = dist[to]; const id = `sc-${c.id}-${period}-${i}`; if (S.takenC && S.takenC[id]) continue; if (out.some(k => k.to === to)) continue;
      const n = Math.max(1, Math.round((1 + r()) / G.w)); out.push({ id, g, n, to, from: c.id, km: Math.round(km), hops: hops[to], reward: Math.round(Math.max(60, 45 + km * 0.1 + n * ECON.mid(g, c.id, S.day) * 0.2)), days: Math.ceil(km / 15) + 15, selfProfit: 0, client: 'the Scuola di San Marco', fac: 'venice' }); }
    return out;
  }
  function scuolaNews() {
    if (!S.camp || S.camp.act > 4) return 'Lanfranco Zaccaria\'s galleys have been seen off Pera. The brothers watch the Genoese, and the Genoese watch the brothers.';
    return { 1: 'Bartolomeo Ghisi is waiting for you in Constantinople.', 2: 'Bahram the Broker keeps his table in the caravanserai by the great bazaar of Tabriz. Speak Matteo\'s name softly there: the Genoese are as thick as flies.', 3: 'The road to Delhi runs by Rayy, Nishapur, Herat and Kabul, then through the Khyber to Lahore. Delhi pays well for horses, furs, gems and good cloth from the west.', 4: 'The Compagna\'s house in Delhi is new, small and secret. Go armed.' }[S.camp.act] || '';
  }
  function renderScuola(c) {
    const v = panelState.vendor; let h = `<div class="mx-dlgq"><p><i>${S.camp && S.camp.act <= 4 ? `"Matteo Corner's ring! Then you're one of ours, near enough. Almost one of us, mind: you're not a brother yet."` : `"Brother ${S.hero ? S.hero.first : ''}! Welcome. What does the Scuola owe you, or you the Scuola?"`}</i></p></div>`;
    h += `<div class="mx-ct">News from the brothers</div><p>${scuolaNews()}</p><p class="mx-dim">${M.rumour ? M.rumour() : ''}</p>`;
    if (S.scuolaDebt > 0) h += `<div class="mx-ct">Your debt to the Scuola</div><p>You owe <b>${fmt(S.scuolaDebt)} ${CURRENCY}</b>, lent against Matteo's name. No interest; the Scuola has a long memory and even longer ledgers.</p><p>${[100, 300].map(a => `<button data-act="screpay" data-a="${a}" ${S.coins < 1 ? 'disabled' : ''}>Repay ${a}</button>`).join(' ')} <button data-act="screpay" data-a="all" ${S.coins < 1 ? 'disabled' : ''}>Repay all you can</button></p>`;
    const list = scuolaContracts(c); const mine = S.contracts || [];
    h += `<div class="mx-ct">The Scuola's contracts</div><table class="mx-tb wide"><tr><th>Consignment</th><th>Deliver to</th><th>Time</th><th>Pay</th><th></th></tr>`;
    if (!list.length) h += '<tr><td colspan="5" class="mx-dim">Nothing to carry right now. New contracts come every 25 days.</td></tr>';
    for (const k of list) { const G = GOOD[k.g]; h += `<tr data-route="${k.from}|${k.to}"><td class="mx-gc">${ICONS(k.g, 32)}<div><b>${k.n} ${G.unit}${k.n > 1 ? 's' : ''} of ${lcName(G.name)}</b><br><span class="mx-dim">${fmt1(G.w * k.n)} loads</span></div></td><td>${W.cityById[k.to].name}<br><span class="mx-dim">${fmt(mi(k.km))} mi</span></td><td>${k.days} days</td><td><b>${fmt(k.reward)}</b><br><span class="mx-dim">and standing with the Scuola</span></td><td><button data-act="sccontract" data-id="${k.id}" ${mine.length >= 3 ? 'disabled' : ''}>Accept</button></td></tr>`; }
    return h + '</table><div class="mx-note">The Scuola keeps a brother in every market city (the larger stars on the map\'s Markets layer). Its contracts go from one market city to another.</div>';
  }
  { const o = act; act = function (a, d) {
    if (a === 'screpay') { const amt = Math.min(S.scuolaDebt || 0, S.coins, d.a === 'all' ? 1e9 : +d.a); S.coins -= amt; S.scuolaDebt = Math.max(0, (S.scuolaDebt || 0) - amt); if (!S.scuolaDebt) { facState(S).venice.s = Math.min(100, facState(S).venice.s + 5); H.showToast('The Scuola di San Marco', 'Your debt is paid. The brother writes it off in a ledger as thick as a Bible.', 'Scuola'); } render(); updateHud(true); return; }
    if (a === 'sccontract') { const c = W.cityById[nearestCityId()]; const k = scuolaContracts(c).find(k => k.id === d.id); if (!k) return; if ((S.contracts || []).length >= 3) { H.showToast('Too many contracts', 'You can carry at most three contracts at once.', 'Contracts'); return; } if (load() + GOOD[k.g].w * k.n > capacity() + 1e-6) { H.showToast('No room', 'Your animals cannot carry this consignment.', 'Contracts'); return; }
      (S.contracts = S.contracts || []).push(Object.assign({}, k, { due: S.day + k.days })); (S.takenC = S.takenC || {})[k.id] = 1; render(); return; }
    return o(a, d); }; }
  // ---------------- styles ----------------
  { const st = document.createElement('style'); st.textContent = `
    html body .mx-obj { position:absolute; left:16px; top:160px; width:280px; padding:8px 12px 9px; background:rgba(247,236,211,.62); border:1px solid rgba(122,31,18,.3); box-shadow:0 3px 10px rgba(40,20,0,.18); border-radius:3px; color:var(--ink, #3a2414); font-family:var(--book, Georgia, serif); font-size:13.5px; line-height:1.35; pointer-events:none; }
    html body .mx-obj .mx-ot { font-family:var(--disp, Cinzel, serif); font-size:12px; letter-spacing:.12em; text-transform:uppercase; color:var(--rubric, #7a1f12); margin-bottom:4px; border-bottom:1px solid rgba(122,31,18,.25); padding-bottom:3px; }
    html body .mx-obj .mx-oi { margin:2px 0; } html body .mx-obj .mx-oi.ok { opacity:.55; text-decoration:line-through; } html body .mx-obj .mx-oi.cur { font-weight:600; } html body .mx-obj .mx-oi.opt { font-style:italic; opacity:.8; }
    html body .mx-obj .mx-oi i { font-style:normal; opacity:.75; font-size:12.5px; } html body .mx-obj .mx-oh { margin-top:5px; font-size:12.5px; font-style:italic; opacity:.85; border-top:1px dotted rgba(122,31,18,.3); padding-top:4px; }
    html body .mx-obj.flash { animation:mxflash 1.2s ease-out; } @keyframes mxflash { 0% { box-shadow:0 0 0 3px rgba(201,164,74,.9); } 100% { box-shadow:0 3px 10px rgba(40,20,0,.18); } }
    html body .mx-story .mx-scene { width:100%; height:auto; max-height:140px; display:block; margin:-4px 0 8px; }
    html body .mx-story .mx-done { font-family:var(--disp, Cinzel, serif); letter-spacing:.14em; font-size:13px; color:#3a6a2a; text-transform:uppercase; } html body .mx-story .mx-prev { font-style:italic; }
    html body .mx-story .mx-goals li { margin:1px 0; } html body .mx-storyp { max-width:660px; } html body .mx-story p { margin:6px 0; } html body .mx-story .mx-list li { margin:1px 0; } html body .mx-story .mx-wt { font-size:27px; margin:2px 0; } html body .mx-story .mx-orn { margin:6px 0 8px; }
    html body .mx-introhead { display:flex; gap:16px; align-items:center; text-align:left; } html body .mx-introhead svg.portrait { border:2px solid #8a6a3a; flex:none; }
    html body .mx-letter { margin:6px 0; padding:8px 14px; font-style:italic; background:#f8eed6; border-left:3px solid #a8201a; } html body .mx-letter span { display:block; text-align:right; font-style:normal; }
    html body .mx-dlgq { padding:4px 12px; background:rgba(201,164,74,.12); border-left:3px solid #b8862a; margin-bottom:6px; }
    html body tr.mx-hl td { background:rgba(201,164,74,.22); } html body tr.mx-hl td:first-child { box-shadow:inset 3px 0 0 var(--rubric, #7a1f12); }
    body:not(.journey) .mx-obj { display:none; }
  `; document.head.appendChild(st); }

  // ============================================================
  //  v17: FACTIONS in play — the houses in each guild, standing, missions, Act IV
  // ============================================================
  const FS = () => facState(S);
  function facAdd(f, n, quiet) {
    const st = FS()[f]; const before = facRank(S, f); st.s = Math.max(0, Math.min(100, st.s + n));
    const R = FACTIONS[f].rival; if (n > 0 && R && st.m) FS()[R].s = Math.max(0, FS()[R].s - n * 0.5);
    const after = facRank(S, f); if (after !== before && n > 0 && st.m) setTimeout(() => H.showToast(FACTIONS[f].name, `You are now a <b>${after}</b> of the ${FACTIONS[f].name}. ${rankPerk(after)}`, 'Promotion'), 1200);
    else if (!quiet && Math.abs(n) >= 1) H.showToast(FACTIONS[f].name, `Standing ${n > 0 ? '+' : '−'}${Math.round(Math.abs(n))} (now ${Math.round(st.s)}).`, 'Faction');
    if (S.camp) campCheck();
  }
  function rankPerk(r) { return { Associate: 'The house\'s contracts now pay 20% more.', Member: 'You may buy the guild\'s own goods at its houses.', Factor: 'You get 4% better prices in all the guild\'s cities.', Master: 'You buy the guild\'s goods 15% cheaper, and its highest offices are open to you.' }[r] || ''; }
  function facBadge() { if (!S || !S.fac) return ''; const f = FAC_ORDER.find(f => S.fac[f].m); if (!f) return ''; return `<span class="mx-fac" style="border-color:${FACTIONS[f].color}" title="${FACTIONS[f].name}: standing ${Math.round(S.fac[f].s)}">⚑ ${FACTIONS[f].short} · ${facRank(S, f)}</span>`; }

  // ---------------- the house's own contracts ----------------
  function facContracts(c, f) {
    const F = FACTIONS[f]; const period = Math.floor(S.day / 25); const r = seeded('fac' + f + c.id + period); const dist = distFrom(c.id), hops = hopsFrom(c.id);
    const dests = F.cities.filter(id => id !== c.id && dist[id] < Infinity); const goods = ECON.offers(c.id).filter(g => !GOOD[g].special && 'cur'.includes(GOOD[g].rar || 'c')); if (!dests.length || !goods.length) return [];
    const out = []; const bonus = FS()[f].m && FS()[f].s >= 10 ? 1.2 : 1;
    for (let i = 0; i < 2; i++) { const to = dests[Math.floor(r() * dests.length)]; const g = goods[Math.floor(r() * goods.length)]; const G = GOOD[g]; const km = dist[to];
      const n = Math.max(1, Math.round((1 + r()) / G.w)); const id = `f-${f}-${c.id}-${period}-${i}`; if (S.takenC && S.takenC[id]) continue; if (out.some(k => k.to === to && k.g === g)) continue;
      const reward = Math.round(Math.max(60, 40 + km * 0.09 + n * ECON.mid(g, c.id, S.day) * 0.2) * bonus);
      out.push({ id, g, n, to, from: c.id, km: Math.round(km), hops: hops[to], reward, days: Math.ceil(km / 15) + 15, selfProfit: 0, client: F.client, fac: f }); }
    return out;
  }
  // ---------------- the house panel (a tab in the Merchants' Guild) ----------------
  function facStock(c, g) { const k = c.id + g + Math.floor(S.day / 25); S.fstock = S.fstock || {}; if (S.fstock[k] === undefined) S.fstock[k] = Math.round(14 / Math.max(.25, GOOD[g].w)); return S.fstock[k]; }
  function renderFacHouse(c, f) {
    const F = FACTIONS[f], st = FS()[f], rk = facRankN(S, f); const can = facCanJoin(S, f); const R = F.rival && FS()[F.rival];
    let h = `<div class="mx-ct">${F.name}</div><p>${F.blurb}</p>`;
    h += `<div class="mx-facbar"><div style="width:${st.s}%;background:${F.color}"></div>${FAC_RANKS.map(([t]) => `<i style="left:${t}%"></i>`).join('')}</div>`;
    h += `<p><b>Your standing: ${Math.round(st.s)}</b> · ${facRank(S, f)}${st.m ? '' : can ? ' (not a member)' : ''}. ${F.rival ? `Their rivals are the ${FACTIONS[F.rival].name}.` : ''}</p>`;
    // membership
    const invited = false;
    if (!st.m) {
      if (!can) h += `<p class="mx-dim">${st.traitor ? 'You betrayed this house. Its doors are closed to you for good.' : `The ${F.name} admit only ${F.who}. Your standing still earns you better prices in their cities${F.spices ? ' and lowers what outsiders pay for spices here' : ''}.`}</p>`;
      else if (R && R.m) h += `<p class="mx-dim">Sworn brothers of the ${FACTIONS[F.rival].name} cannot join the ${F.name}.</p>`; else if (false) h += `<p>${st.s >= 10 ? `${F.head.charAt(0).toUpperCase() + F.head.slice(1)} would take you in, but you are sworn to the ${FACTIONS[F.rival].name}. Going over means leaving them for good.` : `Earn standing 10 with this house (its contracts, profitable trade here, or backing its ventures) and ${F.head} may take you in, even from the ${FACTIONS[F.rival].name}.`}</p>${st.s >= 10 ? `<button data-act="fjoin" data-f="${f}" class="mx-warnbtn">Go over to the ${F.short}s</button>` : ''}`;
      else if (st.s >= 10 || invited) h += `<p>${invited ? 'The bailo\'s invitation is waiting for you here: your tales of the Khan\'s court have reached Venice.' : `${F.head.charAt(0).toUpperCase() + F.head.slice(1)} has watched your work and would take you in.`}</p><button data-act="fjoin" data-f="${f}">Join the ${F.name}</button>`;
      else h += `<p class="mx-dim">Earn standing 10 to be invited to join: carry the house's contracts, trade at a profit in its cities, or back its ventures at the guild.</p>`;
    }
    // ranks
    h += `<table class="mx-tb wide"><tr><th>Rank</th><th>Standing</th><th>What it gives you</th></tr>` + FAC_RANKS.slice(1).map(([t, n], i) => `<tr class="${rk >= i + 1 ? 'mx-ok' : ''}"><td><b>${n}</b></td><td>${t}</td><td>${rankPerk(n)}${n === 'Master' && F.cities.length ? '' : ''}</td></tr>`).join('') + '</table>';
    h += missionHtml(c, f);
    // goods: sold at the house's quarter merchant (v18)
    if (F.goods.length) h += `<div class="mx-ct">The ${F.short} goods</div><p class="mx-dim">${F.goods.map(g => GOOD[g].name).join(' and ')} are sold to members of rank Member and above at the <b>${F.quarter || F.house}</b>, in another part of town.</p>`;
    if (F.spices) h += `<div class="mx-note">${st.m ? 'As a member, you buy spices, pepper, incense and sugar 5% cheaper in Kārimī cities.' : `Outsiders pay up to 12% more for spices, pepper, incense and sugar in Kārimī cities. At your standing the markup is ${Math.round(12 * (1 - st.s / 100))}%.`}</div>`;
    // contracts
    const list = facContracts(c, f); const mine = S.contracts || [];
    h += `<div class="mx-ct">The house's contracts</div><table class="mx-tb wide"><tr><th>Consignment</th><th>Deliver to</th><th>Time</th><th>Pay</th><th></th></tr>`;
    if (!list.length) h += '<tr><td colspan="5" class="mx-dim">Nothing to carry right now. New contracts come every 25 days.</td></tr>';
    for (const k of list) { const G = GOOD[k.g]; h += `<tr data-route="${k.from}|${k.to}"><td class="mx-gc">${ICONS(k.g, 32)}<div><b>${k.n} ${G.unit}${k.n > 1 ? 's' : ''} of ${lcName(G.name)}</b><br><span class="mx-dim">${fmt1(G.w * k.n)} loads</span></div></td><td>${W.cityById[k.to].name}<br><span class="mx-dim">${fmt(mi(k.km))} mi</span></td><td>${k.days} days</td><td><b>${fmt(k.reward)}</b><br><span class="mx-dim">and standing +6</span></td><td><button data-act="fcontract" data-f="${f}" data-id="${k.id}" ${mine.length >= 3 ? 'disabled' : ''}>Accept</button></td></tr>`; }
    return h + '</table><div class="mx-note">Standing also rises when you sell at a profit in the house\'s cities, and when you back ventures at the guild there. Members lose standing with their rivals as they rise.</div>';
  }
  // ---------------- Act IV missions ----------------
  const A4 = () => null; // v21: the Act IV missions are out of the story for now
  function missionHtml(c, f) {
    const m = A4(); if (!m) return ''; let h = '';
    if (f === 'genoa' && c.id === 'caffa' && FS().venice.m && !S.camp.ev.outbid) h += `<div class="mx-ct">Mission: the furs of Caffa</div><p>A caravan of sable has come down from the north, and the Genoese mean to have it. Outbid them for the guild: 300 ${CURRENCY} for 6 bundles (6 loads). The Genoese will not forget it.</p><button data-act="foutbid" ${S.coins < 300 || freeSpace() < 6 ? 'disabled' : ''}>Outbid the Genoese (300)</button>${freeSpace() < 6 ? ' <span class="mx-dim">You need room for 6 loads.</span>' : ''}`;
    if (f === 'venice' && c.id === 'tana' && S.camp.ev.outbid && !S.camp.ev.furs) h += `<div class="mx-ct">Mission: the furs for Tana</div><p>The Venetian factor at Tana is waiting for the sable you won at Caffa.</p><button data-act="ffurs" ${(S.cargo.furs || 0) < 6 ? 'disabled' : ''}>Hand over 6 bundles of sable (+520)</button>${(S.cargo.furs || 0) < 6 ? ' <span class="mx-dim">You carry ' + (S.cargo.furs || 0) + '.</span>' : ''}`;
    if (f === 'venice' && c.id === 'tabriz' && FS().venice.m && FS().venice.s >= 80 && !S.camp.ev.consul) h += `<div class="mx-ct">The consulship of Tabriz</div><p>The old consul is going home to Venice, and the Signoria has written your name on his letter of appointment.</p><button data-act="fconsul" data-f="venice" class="mx-big">Become Venetian consul at Tabriz</button>`;
    if (f === 'genoa' && c.id === 'caffa' && FS().genoa.m && FS().genoa.s >= 80 && !S.camp.ev.consul) h += `<div class="mx-ct">The consulship of Caffa</div><p>The Commune of Genoa needs a man who knows the road to the Khan. The consulate of Caffa is yours if you want it.</p><button data-act="fconsul" data-f="genoa" class="mx-big">Become Genoese consul at Caffa</button>`;
    return h;
  }
  function facAct(a, d, c) {
    switch (a) {
      case 'fjoin': { const f = d.f, F = FACTIONS[f]; if (!facCanJoin(S, f)) return true; const R = F.rival;
        if (R && FS()[R].m) { FS()[R].m = false; FS()[R].traitor = 1; FS()[R].s = 0; if (S.camp) { S.camp.side = f; S.rep = Math.max(0, S.rep - 10); } H.showToast(F.name, `You go over to the ${F.short}s. In every ${FACTIONS[R].short} house your name is spat on (reputation −10).`, 'Betrayal'); }
        FS()[f].m = true; FS()[f].s = Math.max(FS()[f].s, 12); if (S.camp && S.camp.act === 4 && !S.camp.side) S.camp.side = f;
        if (S.camp && S.camp.act === 4 && f === 'venice' && !S.camp.ev.letters && !S.cargo.guildletters) { const dist = distFrom(c.id); const to = FACTIONS.venice.cities.filter(x => x !== c.id).sort((x, y) => dist[x] - dist[y])[0]; (S.camp.a4 = S.camp.a4 || {}).lettersTo = to; S.cargo.guildletters = 1;
          H.showToast('The Venetian guild', `${FACTIONS.venice.head.charAt(0).toUpperCase() + FACTIONS.venice.head.slice(1)}'s man embraces you as a brother of the guild, and hands you a packet of letters for the Venetian house at ${nm(to)}.`, 'Act IV'); }
        else H.showToast(F.name, `You are now an Associate of the ${F.name}.`, 'Faction');
        if (S.camp) campCheck(); return true; }
      case 'fcontract': { const k = facContracts(c, d.f).find(k => k.id === d.id); if (!k) return true; if ((S.contracts || []).length >= 3) { H.showToast('Too many contracts', 'You can carry at most three contracts at once.', 'Contracts'); return true; } if (load() + GOOD[k.g].w * k.n > capacity() + 1e-6) { H.showToast('No room', 'Your animals cannot carry this consignment.', 'Contracts'); return true; }
        (S.contracts = S.contracts || []).push(Object.assign({}, k, { due: S.day + k.days })); (S.takenC = S.takenC || {})[k.id] = 1; return true; }
      case 'fbuy': { const g = d.g; const q = panelState.qty || 1; let n = 0; for (let i = 0; i < q; i++) { const p = ECON.buyPrice(S, g, c.id, S.day); const left = facStock(c, g); if (left < 1 || S.coins < p) break; if (load() + GOOD[g].w > capacity() + 1e-6) { H.showToast('No room', 'Your animals cannot carry any more.', 'Caravan'); break; }
          S.coins -= p; const have = S.cargo[g] || 0; S.basis[g] = ((S.basis[g] || 0) * have + p) / (have + 1); S.cargo[g] = have + 1; S.fstock[c.id + g + Math.floor(S.day / 25)]--; n++; } return true; }
      case 'foutbid': { if (S.coins < 300 || freeSpace() < 6) return true; S.coins -= 300; S.cargo.furs = (S.cargo.furs || 0) + 6; S.basis.furs = 50; S.camp.ev.outbid = 1; facAdd('genoa', -15, true); facAdd('venice', 6, true);
        H.showToast('Caffa', 'The Genoese factors curse you in the street, but the sable is yours. Take it to the Venetian factor at Tana. (Venetian standing +6, Genoese −15.)', 'Act IV'); campCheck(); return true; }
      case 'ffurs': { if ((S.cargo.furs || 0) < 6) return true; S.cargo.furs -= 6; if (!S.cargo.furs) { delete S.cargo.furs; delete S.basis.furs; } S.coins += 520; S.camp.ev.furs = 1; facAdd('venice', 10, true);
        H.showToast('Tana', 'The factor counts the bundles twice and pays you 520 dirhams. Word of how you beat the Genoese at Caffa goes round every Venetian house (standing +10).', 'Act IV'); campCheck(); return true; }
      case 'fconsul': { S.camp.ev.consul = 1; S.camp.consulOf = d.f; campCheck(); return true; }
    }
    return false;
  }

  // ---------------- journal tab ----------------
  function factionsJournalHtml() {
    let h = '<p>Each merchant house keeps its own account of you. Standing rises with its contracts, with profitable trade in its cities, and with ventures backed at its guilds. Only members climb the ranks, and only those of the right faith may join.</p><table class="mx-tb wide"><tr><th>House</th><th>Standing</th><th>Rank</th><th>Houses in</th></tr>';
    for (const f of FAC_ORDER) { const F = FACTIONS[f], st = FS()[f]; h += `<tr><td><b style="color:${F.color}">⚑</b> <b>${F.name}</b><br><span class="mx-dim">${F.who}${F.rival ? ' · rivals of the ' + FACTIONS[F.rival].name : ''}</span></td><td>${Math.round(st.s)} / 100</td><td>${facRank(S, f)}${!facCanJoin(S, f) && !st.m ? '<br><span class="mx-dim">' + (st.traitor ? 'you betrayed them' : 'cannot join') + '</span>' : ''}</td><td>${F.cities.map(nm).join(', ')}</td></tr>`; }
    return h + '</table><div class="mx-note">Every house is a tab in the Merchants\' Guild of its cities. Members of rank Member and above can buy the house\'s own goods there: Venetian glass and scarlet broadcloth for the Scuola, Phocaean alum and Chian mastic for Genoa.</div>';
  }

  // ---------------- the old Act IV (the consulships) left the main story in v21 ----------------
  function showFinale() {
    ui = 'story'; if (document.pointerLockElement) document.exitPointerLock(); H.setPauseWanted(false); panel.className = 'mx-panel mx-storyp';
    panel.innerHTML = `<div class="mx-win mx-story">${sceneSVG('delhi')}<div class="mx-done">Chapter IV complete · ${ACT_NAMES[4]}</div><div class="mx-wt">A Brother of the Scuola</div><div class="mx-orn"></div><p>Ser Matteo Corner, merchant of Venice, died in Delhi in the year of our Lord 1273. His apprentice carried his ring home.</p><button class="mx-big" data-act="close">Continue</button></div>`;
    ov.classList.add('show');
  }

  // ---------------- hooks ----------------
  { const o = guildAct; guildAct = function (a, d, c) { if (facAct(a, d, c)) return true; return o(a, d, c); }; }
  { const o = H.onCity; H.onCity = function (c) {
    if (!S || !c) return o(c); facState(S); const fk = (S.contracts || []).filter(k => k.fac && k.to === c.id).map(k => k.fac);
    o(c);
    for (const f of fk) facAdd(f, 6);
    if (S.camp && S.camp.act === 4 && S.cargo.guildletters && S.camp.a4 && S.camp.a4.lettersTo === c.id) { delete S.cargo.guildletters; S.coins += 150; S.camp.ev.letters = 1; facAdd('venice', 8, true);
      setTimeout(() => H.showToast(c.name, `The Venetian consul breaks the seals and reads the guild's letters at once. He pays you 150 ${CURRENCY} and asks you to dine (standing +8).`, 'Act IV'), 3500); campCheck(); }
  }; }
  // trading at a profit, and backing ventures, in a house's city
  { const o = act; act = function (a, d) {
    if (!S) return o(a, d); facState(S); const c = H.getCity(); const p0 = S.profit || 0; const inv0 = (S.inv || []).length; o(a, d);
    if (!c) return; const fs = facsIn(c.id); if (!fs.length) return;
    if (a === 'sell') { const pr = (S.profit || 0) - p0; if (pr > 0) for (const f of fs) facAdd(f, Math.min(2, pr / 80), true); }
    if (a === 'vinvest' && (S.inv || []).length > inv0) for (const f of fs) facAdd(f, 2, true);
  }; }
  // when you talk to the guild in a city with houses during Act IV, open the house you need
  { const o = openUI; openUI = function (name) {
    if (S && name === 'vendor' && panelState.vendor && panelState.vendor.role === 'guild') { const c = H.getCity(); const fs = c ? facsIn(c.id) : [];
      if (panelState.gtab && panelState.gtab.startsWith('fac_') && !fs.includes(panelState.gtab.slice(4))) panelState.gtab = 'ventures';
      if (A4() && fs.length) { const want = S.camp.side || (c.id === 'caffa' && FS().venice.m && !S.camp.ev.outbid ? 'genoa' : 'venice'); panelState.gtab = 'fac_' + (fs.includes(want) ? want : fs[0]); } }
    return o(name); }; }

  { const st = document.createElement('style'); st.textContent = `
    html body .mx-fac { display:inline-block; margin-left:8px; padding:0 6px; border:1px solid; border-radius:2px; font-size:12px; font-variant:small-caps; }
    html body .mx-facbar { position:relative; height:9px; background:rgba(122,31,18,.12); border:1px solid rgba(122,31,18,.35); margin:6px 0 4px; }
    html body .mx-facbar div { height:100%; } html body .mx-facbar i { position:absolute; top:-3px; bottom:-3px; width:1px; background:rgba(60,30,10,.55); }
    html body .mx-warnbtn { background:#6a2a14 !important; }
  `; document.head.appendChild(st); }

  // ============================================================
  //  v18: SHIPS ON AUTOPILOT, QUARTER MERCHANTS, PROPERTY, WARS
  // ============================================================
  FEATURES.ships = 5; FEATURES.property = 5; // v21: after the story (Chapter IV)
  Object.assign(FACTIONS.venice, { quarter: 'Venetian fondaco', qrole: 'factor of the Venetian fondaco' });
  Object.assign(FACTIONS.genoa, { quarter: 'Genoese loggia', qrole: 'factor of the Genoese loggia' });
  Object.assign(FACTIONS.karimi, { quarter: 'Kārimī funduq', qrole: 'agent of the Kārimī funduq' });
  ROLES.harbour = 'harbour master'; for (const f of FAC_ORDER) ROLES['quarter_' + f] = FACTIONS[f].qrole;
  HIRES.crossbow = { name: 'Genoese crossbowman', cost: 120, wage: 1, str: 6, special: true, blurb: 'The most feared infantry of the age, hired through the Genoese loggia.' };
  const SHIPS = {
    galley: { name: 'galley', kmDay: 110, who: 'Venetian and Genoese galleys', fac: ['venice', 'genoa'] },
    dhow: { name: 'dhow', kmDay: 120, who: 'Arab and Indian dhows', fac: ['karimi'] },
    junk: { name: 'junk', kmDay: 130, who: 'Chinese junks', fac: [] },
  };
  const PORTS = new Set(SEA_LANES.flatMap(l => [l[0], l[1]]));
  const ITALIANS = { venice: ['Marino', 'Pietro', 'Giacomo', 'Andrea', 'Nicolò', 'Lorenzo'], genoa: ['Benedetto', 'Simone', 'Lanfranco', 'Ugolino', 'Oberto', 'Guglielmo'] };
  function vendorLabel(role) { if (role.startsWith('quarter_')) return FACTIONS[role.slice(8)].quarter; return { merchant: 'Merchant', outfitter: 'Stables & Hiring', guild: 'Merchants\' Guild', harbour: 'Harbour master', scuola: 'Scuola di San Marco' }[role] || role; }
  { const o = vendorRoles; vendorRoles = function (c) { const r = o(c); if (!c) return r; if (unl('ships') && PORTS.has(c.id)) r.push('harbour'); if (unl('factions')) for (const f of facsIn(c.id)) r.push('quarter_' + f); return r; }; }
  { const o = spawnVendors; spawnVendors = function (c) { const had = vendorSets.has(c.id); o(c); if (had) return; const vs = vendorSets.get(c.id); if (!vs) return;
    for (const v of vs.vendors) { if (v.role === 'scuola') { let h = 0; for (const ch of c.id + 'sc') h = (h * 31 + ch.charCodeAt(0)) >>> 0; v.name = SCUOLA_NAMES[h % SCUOLA_NAMES.length]; } const f = v.role.startsWith('quarter_') && v.role.slice(8); if (f && ITALIANS[f]) { let h = 0; for (const ch of c.id + f + (S.seed || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0; v.name = ITALIANS[f][h % ITALIANS[f].length]; } } }; }
  { const o = renderVendor; renderVendor = function () { const v = panelState.vendor; const c = W.cityById[nearestCityId()];
    const title = `${v.name}, ${ROLES[v.role]}`; const sub = `${c.name} · ${REALMS[ECON.realmOf(c.id)].name}`;
    if (v.role === 'harbour') return head(title, sub) + renderHarbour(c);
    if (v.role.startsWith('quarter_')) return head(title, sub) + renderQuarter(c, v.role.slice(8));
    if (v.role === 'scuola') return head(title, sub) + renderScuola(c);
    return o(); }; }

  // ---------------- sea lanes ----------------
  const toW = (lon, lat) => [W.degX(lon) * W.K, -W.degY(lat) * W.K];
  const hav = (a, b) => { const R = 6371, r = Math.PI / 180; const dLa = (b[1] - a[1]) * r, dLo = (b[0] - a[0]) * r; const h = Math.sin(dLa / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
  let LANES = null;
  function lanes() {
    if (LANES) return LANES;
    LANES = SEA_LANES.filter(l => W.cityById[l[0]] && W.cityById[l[1]]).map(([a, b, type, pts], i) => { let km = 0; for (let k = 1; k < pts.length; k++) km += hav(pts[k - 1], pts[k]); return { id: i, a, b, type, pts, km: Math.round(km * 1.05 / 10) * 10 }; });
    return LANES;
  }
  const monsoonLane = L => L.type === 'dhow' && ['cambay', 'kayal'].some(id => L.a === id || L.b === id);
  function laneOpen(L) { if (!S) return true; if (monsoonLane(L) && [5, 6, 7].includes(monthOf(S.day)) && !S.up.pilot) return false; return true; }
  function laneDays(L) { let d = L.km / SHIPS[L.type].kmDay; if (!S) return Math.max(1, d); if (S.up.portolan && L.type === 'galley') d /= 1.25; if (S.up.pilot && L.type === 'dhow') d /= 1.2; return Math.max(1, d); }
  function laneFare(L) {
    const k = L.km / 100; let f = k * (3 + S.people() * 1 + (S.packCount() + draftCount()) * 3 + load() * 0.4);
    const member = SHIPS[L.type].fac.some(x => FS()[x].m); if (member) f *= 0.7; if (S.up.berth && L.type === 'galley') f *= 0.5;
    if (warOn('sabas') && L.type === 'galley' && !member) f *= 1.5; return Math.round(f);
  }
  function lanesFrom(cid) { return lanes().filter(L => L.a === cid || L.b === cid); }
  function renderHarbour(c) {
    const ls = lanesFrom(c.id); let h = `<p>Ships sail from here on a fixed course and take you, your goods and your animals with them. You ride on deck while the crew sails: time passes, and the sea has its own dangers. Water is supplied on board; you still feed your people and animals.</p>`;
    h += '<table class="mx-tb wide"><tr><th>Destination</th><th>Ship</th><th>Voyage</th><th>Fare</th><th></th></tr>';
    for (const L of ls) { const to = L.a === c.id ? L.b : L.a; const S0 = SHIPS[L.type]; const days = laneDays(L); const fare = laneFare(L); const open = laneOpen(L);
      const need = Math.ceil(days * 1.1 * S.people()), needF = Math.ceil(days * 1.1 * fodderUse());
      h += `<tr data-sea="${L.id}"><td><b>${W.cityById[to].name}</b><br><span class="mx-dim">${fmt(mi(L.km))} mi by sea</span></td><td>${S0.who}</td><td>${Math.ceil(days)} days<br><span class="mx-dim">food ${need}${needF ? ` · fodder ${needF}` : ''}</span></td><td><b>${fmt(fare)}</b></td><td>${open ? `<button data-act="sail" data-l="${L.id}" ${S.coins < fare ? 'disabled' : ''}>Board</button>` : '<span class="mx-bad">The monsoon has closed the Indian ports until September</span>'}</td></tr>`; }
    h += '</table>';
    return h + `<div class="mx-note">The fare covers you, your men, your animals and your cargo. Members of the ${SHIPS.galley.fac.map(f => FACTIONS[f].short).join(' or ')} houses sail the galleys 30% cheaper, and the Kārimī the dhows.${warOn('sabas') ? ' <b>Venice and Genoa are at war at sea:</b> outsiders pay 50% more for a galley, and corsairs are about.' : ''} Press <b>T</b> on board to sail faster, or <b>Enter</b> to sleep through the voyage.</div>`;
  }

  // ---------------- the voyage ----------------
  let voy = null; const DECK = { galley: [-8.6, 3.0], dhow: [-4.6, 2.6], junk: [-6.7, 3.8] }; // where you stand: on the stern castle
  function buildPath(L, rev) {
    const ll = rev ? L.pts.slice().reverse() : L.pts.slice(); const raw = ll.map(p => toW(p[0], p[1]));
    // smooth (Chaikin, twice), then resample every 4 units
    let P = raw; for (let it = 0; it < 2; it++) { const Q = [P[0]]; for (let i = 0; i < P.length - 1; i++) { const a = P[i], b = P[i + 1]; Q.push([a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25], [a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75]); } Q.push(P[P.length - 1]); P = Q; }
    const out = [P[0]]; let acc = 0; for (let i = 1; i < P.length; i++) { const d = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); acc += d; if (acc >= 4 || i === P.length - 1) { out.push(P[i]); acc = 0; } }
    const s = [0]; for (let i = 1; i < out.length; i++) s.push(s[i - 1] + Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1])); return { P: out, s, len: s[s.length - 1] };
  }
  function pathAt(path, d) { const { P, s } = path; d = Math.max(0, Math.min(path.len, d)); let lo = 0, hi = s.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (s[m] <= d) lo = m; else hi = m; } const t = (d - s[lo]) / ((s[hi] - s[lo]) || 1); return [P[lo][0] + (P[hi][0] - P[lo][0]) * t, P[lo][1] + (P[hi][1] - P[lo][1]) * t]; }
  function shipMesh(type) { const b = new B.Builder(); B.ship(b, type); const m = new THREE.Mesh(b.geometry(), H.objMat); m.castShadow = true; const g = new THREE.Group(); m.scale.setScalar(1.35); g.add(m);
    // your animals and men aboard
    const n = S ? Math.min(4, S.packCount()) : 0; for (let i = 0; i < n; i++) { const k = Object.keys(S.pack).find(k => S.pack[k] > 0) || 'donkey'; const an = makeAnimal(k === 'horse' ? 'horse' : k, true); an.scale.setScalar(.7); an.position.set((i % 2 ? .9 : -.9), 1.3, 3 + Math.floor(i / 2) * 2.4); an.rotation.y = Math.PI / 2 * (i % 2 ? 1 : -1); g.add(an); }
    for (let i = 0; i < 3; i++) { const p = makePerson(type === 'junk' ? 'song' : type === 'dhow' ? 'arab' : 'byz', 'carrier'); p.position.set(i === 1 ? 1.2 : -1.2, 1.3, -1 + i * 2.2); g.add(p); }
    return g; }
  function startVoyage(L, from) {
    const fare = S ? laneFare(L) : 0; if (S && S.coins < fare) return; if (S) S.coins -= fare; const rev = L.a !== from; const to = rev ? L.a : L.b; const path = buildPath(L, rev);
    const days = laneDays(L); const secs = Math.max(30, Math.min(95, 25 + L.km / 30));
    closeUI(); const ship = shipMesh(L.type); H.scene.add(ship);
    for (const f of followers) f.obj.visible = false;
    // start just outside the walls of the port, and stop just outside the walls of the next one
    const A = W.cityById[from], Bc = W.cityById[to]; let d0 = 0, d1 = path.len;
    for (let d = 0; d < path.len; d += 4) { const [x, z] = pathAt(path, d); if (Math.hypot(x - A.x, z - A.z) > A.R + 10) { d0 = d; break; } }
    for (let d = path.len; d > d0; d -= 4) { const [x, z] = pathAt(path, d); if (Math.hypot(x - Bc.x, z - Bc.z) > Bc.R + 10) { d1 = d; break; } }
    voy = { L, to, from, path, d: d0, d0, d1, speed: (d1 - d0) / secs, days, done: 0, ship, yawOff: 0, lastHead: null, sleep: false, ev: !S ? 2 : rnd() < (warOn('sabas') && L.type === 'galley' ? 0.75 : 0.5) ? 0.25 + rnd() * 0.5 : 2, evDone: false };
    const [x, z] = pathAt(path, d0); H.player.x = x; H.player.z = z; H.player.auto = false; H.clearSelected && H.clearSelected();
    if (!S) H.noTeleport = true;
    H.showToast(`Aboard a ${SHIPS[L.type].name}`, `${S ? `You pay ${fmt(fare)} ${CURRENCY} and sail` : 'You sail'} for ${W.cityById[to].name}: about ${Math.ceil(days)} days at sea. Press T to sail faster, or Enter to sleep through the voyage.`, 'Voyage');
  }
  H.frozenBy = () => !!voy;
  { const o = H.frozen; H.frozen = () => o() || !!voy; }
  function voyageFrame(dt) {
    if (!voy) return false; if (ui) return true;
    const v = voy; const mul = v.sleep ? 25 : walkMul; const step = v.speed * dt * mul; v.d += step;
    const f = Math.min(1, (v.d - v.d0) / (v.d1 - v.d0)); const want = f * v.days; if (want > v.done && S) { const t = Object.assign({}, terrainAt(H.player.x, H.player.z), { arid: 0, desert: false }); passDays(want - v.done, t); v.done = want; }
    const [x, z] = pathAt(v.path, v.d); const [x2, z2] = pathAt(v.path, v.d + 14); const head = Math.atan2(x2 - x, z2 - z);
    v.ship.position.set(x, Math.sin(performance.now() / 900) * .12, z); v.ship.rotation.y = head; v.ship.rotation.z = Math.sin(performance.now() / 1300) * .03;
    if (v.lastHead === null) H.player.yaw = Math.atan2(-Math.sin(head), -Math.cos(head));
    if (v.lastHead !== null) { let dh = head - v.lastHead; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); H.player.yaw += dh; } v.lastHead = head;
    // stand at the stern, looking forward (+z along the ship)
    const sx = Math.sin(head), sz = Math.cos(head); const dk = DECK[v.L.type]; H.player.x = x + sx * dk[0]; H.player.z = z + sz * dk[0]; H.player.y = dk[1] + 1.7 + v.ship.position.y;
    if (!S) { const left = Math.max(0, v.days * (1 - f)); promptEl.innerHTML = `⚓ At sea for <b>${nm(v.to)}</b> · about ${Math.ceil(left)} ${Math.ceil(left) === 1 ? 'day' : 'days'} left · <b>T</b> faster · <b>Enter</b> ${v.sleep ? 'wake up' : 'sleep'}`; promptEl.classList.add('show'); }
    if (!v.evDone && f >= v.ev) { v.evDone = true; v.sleep = false; seaEvent(v); return true; }
    if (f >= 1) { arrive(); return true; }
    updateHud();
    return true;
  }
  function arrive() {
    const v = voy; voy = null; H.scene.remove(v.ship); if (!S) { H.noTeleport = false; promptEl.classList.remove('show'); } H.placeAtCity(v.to); for (const f of followers) f.obj.visible = true; rebuildCaravan(); updateHud(true);
    H.showToast(W.cityById[v.to].name, `After ${Math.ceil(v.days)} days at sea, you come ashore at ${W.cityById[v.to].name}.`, 'Voyage'); save();
  }
  { const o = H.keydown; H.keydown = function (e) {
    if (MODE !== 'journey') { if (ui === 'harbour') { if (e.code === 'Escape' || e.code === 'KeyB' || e.code === 'KeyE') closeUI(); return true; } if (e.code === 'KeyB' && !voy && !ui) { const c = H.getCity(); if (c && PORTS.has(c.id)) { openFreeHarbour(c); return true; } } }
    if (voy && !ui) { if (e.code === 'Enter') { voy.sleep = !voy.sleep; H.showToast('Voyage', voy.sleep ? 'You sleep below decks. The days pass quickly.' : 'You come back up on deck.', 'Voyage'); return true; } if (['KeyE', 'KeyR', 'KeyF'].includes(e.code)) return true; } return o(e); }; }
  // the HUD on board
  { const o = tripHtml; tripHtml = function () { if (!voy) return o(); const left = Math.max(0, voy.days - voy.done); return `<div class="mx-row">⚓ At sea for <b>${W.cityById[voy.to].name.replace(/ \(.*\)/, '')}</b> · <b>${left < 1 ? 'under a day' : Math.ceil(left) + ' days'}</b> left${voy.sleep ? ' · <i>sleeping</i>' : ''}</div>`; }; }
  // events at sea
  function seaEvent(v) {
    const galley = v.L.type === 'galley'; const corsair = galley && warOn('sabas'); const pick3 = rnd();
    const insured = () => S.up.insurance ? 0.5 : 1;
    const storm = { id: 'sea_storm', title: 'A Storm at Sea', text: `The sky turns black and the ${SHIPS[v.L.type].name} heels over in a rising gale. The master shouts for the cargo to be lightened.${S.up.portolan && galley ? ' Your portolan charts show a sheltered bay not far off.' : ''}`,
      choices: [
        { t: 'Throw the heaviest goods overboard', ok: (S, X, M) => { const lost = {}; let n = 0; for (const g of Object.keys(S.cargo)) { if (GOOD[g].quest || GOOD[g].w < 1) continue; const k = Math.ceil(S.cargo[g] * 0.4 * insured()); S.cargo[g] -= k; lost[g] = k; n += k; if (!S.cargo[g]) { delete S.cargo[g]; delete S.basis[g]; } } return n ? `The ship rides out the storm. ${M.describe(lost)}` : 'You have nothing heavy to throw. The ship rides out the storm anyway.'; } },
        { t: 'Ride it out', p: () => (S.up.portolan && galley ? 0.8 : 0.55), ok: () => 'The storm blows itself out by morning. Nothing is lost.', bad: (S, X, M) => { const r = M.loseGoodsFrac(0.25 * insured()); const a = rnd() < .5 ? ' ' + M.loseAnimal() : ''; M.days(2); return `Waves sweep the deck. ${r}${a} The battered ship limps on, two days late.`; } },
        ...(S.up.portolan && galley ? [{ t: 'Shelter in the bay on your charts', ok: (S, X, M) => { M.days(3); return 'You wait out the storm at anchor. Three days lost, nothing else.'; } }] : []),
      ] };
    const pirates = { id: 'sea_pirates', title: corsair ? (FS().genoa.m ? 'Venetian Galleys' : 'Genoese Corsairs') : 'Pirates', text: corsair ? `Two ${FS().genoa.m ? 'Venetian' : 'Genoese'} war galleys close in, flying their colours. In this war, any rival's cargo is fair prize.` : 'Low, fast boats come out of a hidden cove and close on the ship. The master asks how much you will pay to be left alone.',
      choices: [
        { t: 'Pay them off', req: () => S.coins >= 40, ok: (S, X, M) => `They take ${M.coins(-Math.round(Math.max(40, S.coins * 0.12)))} and row away.` },
        { t: 'Fight them off with the crew', p: () => Math.min(0.9, 0.35 + strength() / 40), ok: (S, X, M) => { M.rep(3); return 'Your men and the crew drive them off. The master swears he has never seen merchants fight so well.'; }, bad: (S, X, M) => `They board the ship. ${M.loseGoodsFrac(0.35 * insured())}` },
        ...(corsair && FS().venice.m && FS().genoa.s > 5 ? [] : []),
      ] };
    const calm = { id: 'sea_calm', title: 'Becalmed', text: 'The wind dies. For days the sails hang limp and the sea is like oil. The crew grow uneasy, and food runs short.',
      choices: [
        { t: 'Share your food with the crew', ok: (S, X, M) => { M.supply('food', -Math.min(S.food, 4 * S.people())); M.days(3); M.rep(2); return 'The crew remember your generosity. At last the wind returns (3 days lost).'; } },
        { t: 'Keep your stores for yourself', ok: (S, X, M) => { M.days(3); M.rep(-2); return 'The crew mutter about stingy merchants. At last the wind returns (3 days lost).'; } },
      ] };
    const ev = corsair && pick3 < 0.6 ? pirates : pick3 < 0.45 ? storm : pick3 < 0.75 ? pirates : calm;
    triggerEvent(ev, eventContext());
  }

  // ---------------- quarter merchants (fondaco, loggia, funduq) ----------------
  const RARE = {
    portolan: { f: 'venice', rank: 1, name: 'Portolan charts', cost: 300, blurb: 'Venetian sea charts of every coast and harbour: galleys sail 25% faster for you, and storms are less dangerous.' },
    berth: { f: 'venice', rank: 2, name: 'A berth on the Venetian convoy', cost: 450, blurb: 'A standing place on the state galleys: galley fares cost you half.' },
    insurance: { f: 'genoa', rank: 2, name: 'Sea insurance from Pera', cost: 350, blurb: 'Genoese underwriters cover your cargo: storms and pirates at sea take half as much.' },
    pilot: { f: 'karimi', rank: 1, name: 'A monsoon pilot', cost: 300, blurb: 'A pilot who reads the monsoon: dhows sail 20% faster, and you can sail to India in the summer.' },
  };
  function renderQuarter(c, f) {
    const F = FACTIONS[f], st = FS()[f], rk = facRankN(S, f);
    let h = `<p>The ${F.quarter} of ${c.name}: warehouse, inn and counting house of the ${F.name}. ${st.m ? `You are a <b>${facRank(S, f)}</b> of the house (standing ${Math.round(st.s)}).` : `Only members trade here. Your standing: ${Math.round(st.s)} (${facRank(S, f)}). Join at the ${F.house} in the Merchants' Guild.`}</p>`;
    if (F.goods.length) {
      h += `<div class="mx-ct">The ${F.short} goods</div>`;
      if (!st.m || rk < 2) h += `<p class="mx-dim">${F.goods.map(g => GOOD[g].name).join(' and ')}: sold only to members of rank Member or higher.</p>`;
      else { h += qtyBar() + '<table class="mx-tb wide"><tr><th>Good</th><th>Price</th><th>Stock</th><th></th></tr>';
        for (const g of F.goods) { const G = GOOD[g]; const p = ECON.buyPrice(S, g, c.id, S.day); const q = facStock(c, g);
          h += `<tr data-pg="${g}"><td class="mx-gc">${ICONS(g)}<div><b>${G.name}</b><br><span class="mx-dim">${G.blurb}</span></div></td><td>${fmt1(p)}</td><td>${q}</td><td><button data-act="fbuy" data-g="${g}" ${q < 1 || S.coins < p ? 'disabled' : ''}>Buy</button></td></tr>`; }
        h += '</table>'; }
    }
    if (F.spices) h += `<div class="mx-ct">Spices</div><p class="mx-dim">${st.m ? 'Members buy spices, pepper, incense and sugar 5% cheaper in Kārimī cities.' : 'The Kārimī admit only Muslim merchants. Outsiders pay a markup on spices in their cities, smaller as your standing grows.'}</p>`;
    const rare = Object.entries(RARE).filter(([, u]) => u.f === f);
    const hires = f === 'genoa' ? [['crossbow', HIRES.crossbow, 1]] : [];
    if (rare.length || hires.length) {
      h += '<div class="mx-ct">Only from the house</div><table class="mx-tb wide">';
      for (const [k, u] of rare) { const okR = st.m && rk >= u.rank; h += `<tr><td><b>${u.name}</b><br><span class="mx-dim">${u.blurb}</span></td><td>${fmt(u.cost)}</td><td>${S.up[k] ? '<i>owned</i>' : okR ? `<button data-act="rare" data-k="${k}" ${S.coins < u.cost ? 'disabled' : ''}>Buy</button>` : `<span class="mx-dim">members of rank ${FAC_RANKS[u.rank][1]}</span>`}</td></tr>`; }
      for (const [k, hh, r] of hires) { const okR = st.m && rk >= r; h += `<tr><td><b>${hh.name}</b> <span class="mx-dim">× ${S.hires[k] || 0}</span><br><span class="mx-dim">${hh.blurb} +${hh.str} strength · wage ${hh.wage}/day</span></td><td>${fmt(hh.cost)}</td><td>${okR ? `<button data-act="hire" data-k="${k}" ${S.coins < hh.cost ? 'disabled' : ''}>Hire</button> <button data-act="fire" data-k="${k}" ${!S.hires[k] ? 'disabled' : ''}>Dismiss</button>` : `<span class="mx-dim">members of rank ${FAC_RANKS[r][1]}</span>`}</td></tr>`; }
      h += '</table>';
    }
    return h;
  }

  // ---------------- property: warehouses, caravanserai shares, workshops ----------------
  const WH_COST = { 1: 250, 2: 350, 3: 500, 4: 700, 5: 900 }; const WH_CAP = 60; const SERAI_COST = 600, SERAI_RENT = 22, SHOP_COST = 800;
  const WORKSHOPS = {
    silk: { name: 'Silk workshop', in: [['rawsilk', 5]], out: 'brocade', per: 8, cities: ['tabriz', 'baghdad', 'yazd', 'herat', 'nishapur'], blurb: 'Weavers turn 5 bales of raw silk into a bolt of gold brocade.' },
    dye: { name: 'Dye works', in: [['wool', 1], ['alum', 1]], out: 'scarlet', per: 10, cities: ['constantinople', 'trebizond', 'acre'], blurb: 'Dyers fix kermes red on Flemish woollens with alum: one bolt and one sack make a bolt of scarlet broadcloth.' },
  };
  const P = () => (S.prop = S.prop || {}); const PC = cid => (P()[cid] = P()[cid] || {});
  const whLoad = w => Object.entries(w.goods).reduce((a, [g, n]) => a + GOOD[g].w * n, 0);
  function shopKind(cid) { return Object.keys(WORKSHOPS).find(k => WORKSHOPS[k].cities.includes(cid) && W.cityById[cid]); }
  function renderProperty(c) {
    const tier = ECON.tierOf(c); const pc = P()[c.id] || {}; let h = '<p>Property earns while you travel. A warehouse keeps goods safe in a city until you come back for them; a share in a caravanserai pays rent every month; a workshop turns raw goods into finer ones.</p>';
    // warehouse
    h += `<div class="mx-ct">Warehouse${FS().venice.m && FACTIONS.venice.cities.includes(c.id) ? ' (in the Venetian fondaco)' : ''}</div>`;
    if (!pc.wh) h += `<p>Rent a warehouse here for good: room for ${WH_CAP} loads. <button data-act="pbuy" data-k="wh" ${S.coins < WH_COST[tier] ? 'disabled' : ''}>Take a warehouse (${fmt(WH_COST[tier])})</button></p>`;
    else { const w = pc.wh; h += qtyBar() + `<div class="mx-cols"><div><div class="mx-dim">In your warehouse: ${fmt1(whLoad(w))} / ${WH_CAP} loads</div><table class="mx-tb">`;
      const ks = Object.keys(w.goods).filter(g => w.goods[g] > 0); if (!ks.length) h += '<tr><td class="mx-dim">Empty.</td></tr>';
      for (const g of ks) h += `<tr><td class="mx-gc">${ICONS(g, 28)}<b>${GOOD[g].name}</b></td><td>${w.goods[g]}</td><td><button data-act="wout" data-g="${g}">Take</button></td></tr>`;
      h += '</table></div><div><div class="mx-dim">Your cargo</div><table class="mx-tb">'; const cs = Object.keys(S.cargo).filter(g => S.cargo[g] > 0 && !GOOD[g].quest); if (!cs.length) h += '<tr><td class="mx-dim">Nothing to store.</td></tr>';
      for (const g of cs) h += `<tr><td class="mx-gc">${ICONS(g, 28)}<b>${GOOD[g].name}</b></td><td>${S.cargo[g]}</td><td><button data-act="win2" data-g="${g}">Store</button></td></tr>`;
      h += '</table></div></div>'; }
    // caravanserai
    h += '<div class="mx-ct">A share in the caravanserai</div>';
    if (tier < 2) h += '<p class="mx-dim">This town is too small for an investor\'s share.</p>';
    else if (!pc.serai) h += `<p>Buy a share in the city's great caravanserai: it pays you ${SERAI_RENT} ${CURRENCY} rent every month, wherever you are. <button data-act="pbuy" data-k="serai" ${S.coins < SERAI_COST ? 'disabled' : ''}>Buy a share (${fmt(SERAI_COST)})</button></p>`;
    else h += `<p class="mx-ok">You own a share here, paying ${SERAI_RENT} a month. So far: ${fmt(pc.serai.paid || 0)}.</p>`;
    // workshop
    const sk = shopKind(c.id);
    if (sk) { const Wk = WORKSHOPS[sk]; h += `<div class="mx-ct">${Wk.name}</div><p>${Wk.blurb} It makes up to ${Wk.per} a month, from what you leave with it.</p>`;
      if (!pc.shop) h += `<button data-act="pbuy" data-k="shop" ${S.coins < SHOP_COST ? 'disabled' : ''}>Buy the workshop (${fmt(SHOP_COST)})</button>`;
      else { const sh = pc.shop; h += `<p>Waiting to be worked: ${Wk.in.map(([g]) => `${sh.in[g] || 0} ${lcName(GOOD[g].name)}`).join(', ')}. Finished: <b>${sh.out || 0} ${lcName(GOOD[Wk.out].name)}</b>.</p><p>${Wk.in.map(([g]) => `<button data-act="shopin" data-g="${g}" ${!S.cargo[g] ? 'disabled' : ''}>Leave all your ${lcName(GOOD[g].name)}</button>`).join(' ')} <button data-act="shopout" ${!sh.out ? 'disabled' : ''}>Collect the ${lcName(GOOD[Wk.out].name)}</button></p>`; } }
    else h += `<div class="mx-ct">Workshops</div><p class="mx-dim">Silk workshops: ${WORKSHOPS.silk.cities.filter(id => W.cityById[id]).map(nm).join(', ')}. Dye works: ${WORKSHOPS.dye.cities.map(nm).join(', ')}.</p>`;
    // everything you own
    const all = Object.entries(P()).filter(([, v]) => v.wh || v.serai || v.shop);
    if (all.length) h += '<div class="mx-ct">Everything you own</div><ul class="mx-list">' + all.map(([cid, v]) => `<li><b>${nm(cid)}</b>: ${[v.wh ? `warehouse (${fmt1(whLoad(v.wh))} loads)` : '', v.serai ? 'caravanserai share' : '', v.shop ? `${WORKSHOPS[shopKind(cid)].name.toLowerCase()} (${v.shop.out || 0} ready)` : ''].filter(Boolean).join(', ')}</li>`).join('') + '</ul>';
    return h;
  }
  function v18Act(a, d, c) {
    switch (a) {
      case 'sail': { const L = lanes()[+d.l]; if (L && laneOpen(L)) startVoyage(L, c.id); return 'stop'; }
      case 'rare': { const u = RARE[d.k]; if (!u || S.up[d.k] || S.coins < u.cost) return true; S.coins -= u.cost; S.up[d.k] = 1; H.showToast(u.name, u.blurb, FACTIONS[u.f].quarter); return true; }
      case 'pbuy': { const pc = PC(c.id); const tier = ECON.tierOf(c);
        if (d.k === 'wh' && !pc.wh && S.coins >= WH_COST[tier]) { S.coins -= WH_COST[tier]; pc.wh = { goods: {} }; }
        if (d.k === 'serai' && !pc.serai && S.coins >= SERAI_COST) { S.coins -= SERAI_COST; pc.serai = { next: S.day + 30, paid: 0 }; }
        if (d.k === 'shop' && !pc.shop && S.coins >= SHOP_COST) { S.coins -= SHOP_COST; pc.shop = { in: {}, out: 0, last: S.day }; }
        return true; }
      case 'win2': { const w = PC(c.id).wh; if (!w) return true; const g = d.g; const q = Math.min(panelState.qty || 1, S.cargo[g] || 0); let n = 0; for (; n < q; n++) { if (whLoad(w) + GOOD[g].w > WH_CAP + 1e-6) break; S.cargo[g]--; w.goods[g] = (w.goods[g] || 0) + 1; } if (!S.cargo[g]) delete S.cargo[g]; if (n < q) H.showToast('Warehouse full', `Your warehouse holds ${WH_CAP} loads.`, 'Property'); return true; }
      case 'wout': { const w = PC(c.id).wh; if (!w) return true; const g = d.g; const q = Math.min(panelState.qty || 1, w.goods[g] || 0); let n = 0; for (; n < q; n++) { if (load() + GOOD[g].w > capacity() + 1e-6) { H.showToast('No room', 'Your animals cannot carry any more.', 'Caravan'); break; } w.goods[g]--; S.cargo[g] = (S.cargo[g] || 0) + 1; } if (!w.goods[g]) delete w.goods[g]; return true; }
      case 'shopin': { const sh = PC(c.id).shop; if (!sh) return true; const n = S.cargo[d.g] || 0; sh.in[d.g] = (sh.in[d.g] || 0) + n; delete S.cargo[d.g]; delete S.basis[d.g]; return true; }
      case 'shopout': { const sh = PC(c.id).shop; if (!sh || !sh.out) return true; const g = WORKSHOPS[shopKind(c.id)].out; let n = 0; while (sh.out > 0 && load() + GOOD[g].w <= capacity() + 1e-6) { sh.out--; S.cargo[g] = (S.cargo[g] || 0) + 1; n++; } if (sh.out) H.showToast('No room', `You take ${n}; ${sh.out} wait for you.`, 'Workshop'); return true; }
    }
    return false;
  }
  { const o = act; act = function (a, d) { if ((S || a === 'sail') && ['sail', 'rare', 'pbuy', 'win2', 'wout', 'shopin', 'shopout'].includes(a)) { const c = W.cityById[nearestCityId()]; const r = v18Act(a, d, c); if (r === 'stop') { updateHud(true); return; } render(); updateHud(true); save(); return; } return o(a, d); }; }
  // net worth includes what you store
  { const o = netWorth; netWorth = function (s = S) { let v = o(s); const pr = s.prop || {}; for (const cid in pr) { const w = pr[cid].wh; if (w) for (const g in w.goods) v += ECON.mid(g, cid, s.day) * w.goods[g]; if (pr[cid].serai) v += SERAI_COST * 0.5; if (pr[cid].shop) v += SHOP_COST * 0.5; } return v; }; }

  // ---------------- wars ----------------
  const WAR_DEFS = [
    { id: 'euphrates', a: 'mamluk', b: 'ilkhan', name: 'War on the Euphrates', start: 150, len: 170, text: 'Sultan Baybars and the Ilkhan Abaqa fight along the Euphrates. The Mamluks besiege al-Bira and Mongol raiders burn the frontier villages.' },
    { id: 'sabas', sea: true, a: 'venice', b: 'genoa', name: 'Venice and Genoa at sea', start: 260, len: 200, text: 'The truce of Cremona breaks down at sea. Genoese corsairs and Venetian war galleys prey on each other\'s shipping from Acre to Caffa.' },
    { id: 'kaidu', a: 'chagatai', b: 'yuan', name: 'Kaidu\'s war', start: 330, len: 240, text: 'Kaidu and the Chagatai princes ride against Kublai\'s garrisons along the Tarim and the Ili.' },
    { id: 'caucasus', a: 'horde', b: 'ilkhan', name: 'War in the Caucasus', start: 500, len: 140, text: 'The Golden Horde and the Ilkhanate fight again for the pastures of Azerbaijan. The Derbent road is closed.' },
    { id: 'song', a: 'yuan', b: 'song', name: 'The fall of the Song', start: 820, len: 330, text: 'Bayan leads Kublai\'s armies down the Yangtze, and city after city of the Southern Song falls.' },
  ];
  function wars() { if (!S.wars) { const r = seeded('wars'); S.wars = WAR_DEFS.map(w => { const st = Math.max(30, Math.round(w.start + (r() - .5) * 80)); return { id: w.id, start: st, end: st + Math.round(w.len * (0.8 + r() * 0.4)), told: 0 }; }); } return S.wars; }
  const warDef = id => WAR_DEFS.find(w => w.id === id);
  function warOn(id, day = S.day) { if (!S) return false; const w = wars().find(w => w.id === id); return !!w && day >= w.start && day < w.end; }
  function activeWars() { return wars().filter(w => S.day >= w.start && S.day < w.end).map(w => Object.assign({}, warDef(w.id), w)); }
  const edgeRealms = e => [ECON.realmOf(e.a), ECON.realmOf(e.b)];
  function warClosed(e) { if (!e || !S) return null; const [ra, rb] = edgeRealms(e); if (ra === rb) return null; return activeWars().find(w => !w.sea && ((w.a === ra && w.b === rb) || (w.a === rb && w.b === ra))) || null; }
  const BASE_TOLL = Object.fromEntries(Object.entries(REALMS).map(([k, r]) => [k, r.toll]));
  function warTick() {
    const aw = activeWars(); for (const k in REALMS) REALMS[k].toll = BASE_TOLL[k] * (aw.some(w => !w.sea && (w.a === k || w.b === k)) ? 2 : 1);
    for (const w of wars()) { const D = warDef(w.id);
      if (S.day >= w.start && S.day < w.end && w.told < 1) { w.told = 1; warPrices(D, w);
        S.rumours.push(`<span class="mx-dim">${dateOf(S.day)}:</span> <b>War.</b> ${D.name}: ${D.text}`);
        H.showToast(D.name, `${D.text} ${D.sea ? 'Galley fares rise, and corsairs hunt rival shipping.' : `Roads between the ${REALMS[D.a].name} and the ${REALMS[D.b].name} are closed, their tolls are doubled, and arms sell dear.`}`, 'War'); }
      else if (S.day >= w.end && w.told < 2) { w.told = 2; H.showToast('Peace', `${D.name} is over. ${D.sea ? 'The galleys sail in peace again.' : 'The roads reopen.'}`, 'War'); } }
  }
  function warPrices(D, w) { if (D.sea) return; const front = new Set(); for (const e of W.edges) { const [ra, rb] = edgeRealms(e); if ((ra === D.a && rb === D.b) || (ra === D.b && rb === D.a)) { front.add(e.a); front.add(e.b); } }
    const near = new Set(); for (const id of front) { const d = distFrom(id); for (const c of W.cities) if (d[c.id] < 700 && [D.a, D.b].includes(ECON.realmOf(c.id))) near.add(c.id); }
    for (const id of near) S.mkt.push({ id: 'war' + w.id + id, war: true, type: 'war', city: id, title: `${D.name}`, text: 'Armies need arms, horses and felt; merchants hold back their silks.', goods: { blades: 1.7, horsegear: 1.7, felt: 1.4 }, supply: 0, start: w.start, end: w.end }); }
  { const o = v11Daily; v11Daily = function () { o(); warTick(); shipDaily(); }; }
  function shipDaily() { // rents and workshops
    for (const [cid, v] of Object.entries(P())) {
      if (v.serai && S.day >= v.serai.next) { v.serai.next += 30; v.serai.paid = (v.serai.paid || 0) + SERAI_RENT; S.coins += SERAI_RENT; H.showToast('Rent', `Your share in the caravanserai at ${nm(cid)} pays ${SERAI_RENT} ${CURRENCY}.`, 'Property'); }
      if (v.shop) { const Wk = WORKSHOPS[shopKind(cid)]; if (!Wk) continue; const rate = Wk.per / 30; v.shop.acc = (v.shop.acc || 0) + rate; while (v.shop.acc >= 1 && Wk.in.every(([g, n]) => (v.shop.in[g] || 0) >= n)) { v.shop.acc -= 1; for (const [g, n] of Wk.in) v.shop.in[g] -= n; v.shop.out = (v.shop.out || 0) + 1; } if (v.shop.acc > 1) v.shop.acc = 1; }
    }
  }
  // blocked roads, like snowed-in passes
  { const o = H.allowed; H.allowed = function (x, z) {
    if (MODE === 'journey' && S && !voy) { const q0 = W.pathQuery(x, z); if (q0.i >= 0) { const e0 = W.edges[W.P.E[q0.i]]; const wr = warClosed(e0); if (wr) { for (const id of [e0.a, e0.b]) { const cc = W.cityById[id]; const dn = Math.hypot(x - cc.x, z - cc.z), dp = Math.hypot(H.player.x - cc.x, H.player.z - cc.z); if (dn > cc.R + 6 && dn < cc.R + 70 && dn > dp) {
      H.showToast('The road is closed', `${wr.name}: soldiers turn back every caravan on the road between ${W.cityById[e0.a].name} and ${W.cityById[e0.b].name}. Take another road, or wait for peace.`, 'War'); return false; } } } } }
    return o(x, z); }; }
  { const o = H.roadInfo; H.roadInfo = function (c, g) { const h = o(c, g); if (!h) return h; const wr = warClosed(W.edges[g.edge]); return wr ? h + ` · <span class="mx-bad">closed by war</span>` : h; }; }
  { const o = eventContext; eventContext = function () { const X = o(); if (activeWars().some(w => !w.sea && (w.a === X.realm || w.b === X.realm))) X.danger *= 1.3; return X; }; }
  { const o = renderMarketNews; renderMarketNews = function () { const aw = activeWars(); const up = wars().filter(w => S.day < w.start && w.start - S.day < 40);
    let h = ''; if (aw.length || up.length) h += '<div class="mx-ct">Wars</div><ul class="mx-list">' + aw.map(w => `<li><b class="mx-bad">${w.name}</b> (until about ${dateOf(w.end)}): ${w.text}</li>`).join('') + up.map(w => `<li class="mx-dim">Rumours of war: ${warDef(w.id).name}, expected soon.</li>`).join('') + '</ul>';
    return h + o(); }; }
  // sea lanes and war-closed roads on the big map
  H.mapExtra = (g, z, dpr) => { if (!W) return; g.save();
    if (unl('ships')) { g.setLineDash([5 * dpr / z, 4 * dpr / z]); g.lineWidth = 1.6 * dpr / z; g.strokeStyle = 'rgba(40,70,90,.75)'; for (const L of lanes()) { g.beginPath(); L.pts.forEach((p, i) => { const x = W.degX(p[0]), y = -W.degY(p[1]); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); } g.setLineDash([]); }
    g.strokeStyle = 'rgba(170,20,10,.9)'; g.lineWidth = 3 * dpr / z; for (const e of W.edges) { if (!warClosed(e)) continue; const A = W.cityById[e.a], Bc = W.cityById[e.b]; const mx = (W.degX(A.lon) + W.degX(Bc.lon)) / 2, my = -(W.degY(A.lat) + W.degY(Bc.lat)) / 2, r = 5 * dpr / z; g.beginPath(); g.moveTo(mx - r, my - r); g.lineTo(mx + r, my + r); g.moveTo(mx + r, my - r); g.lineTo(mx - r, my + r); g.stroke(); }
    g.restore(); };
  // ---------------- free roam: ships from any port, free of charge ----------------
  function freePortFrame() {
    if (voy || ui) return; const c = H.getCity();
    if (c && PORTS.has(c.id)) { promptEl.innerHTML = '<b>B</b> &nbsp;Take a ship from the harbour'; promptEl.classList.add('show'); } else promptEl.classList.remove('show');
  }
  function openFreeHarbour(c) {
    ui = 'harbour'; for (const k in H.keys) H.keys[k] = false; H.player.auto = false; if (document.pointerLockElement) document.exitPointerLock(); H.setPauseWanted(false); promptEl.classList.remove('show');
    const rows = lanesFrom(c.id).map(L => { const to = L.a === c.id ? L.b : L.a; return `<tr><td><b>${W.cityById[to].name}</b><br><span class="mx-dim">${fmt(mi(L.km))} mi by sea</span></td><td>${SHIPS[L.type].who}</td><td>about ${Math.ceil(L.km / SHIPS[L.type].kmDay)} days</td><td><button data-act="sail" data-l="${L.id}">Set sail</button></td></tr>`; }).join('');
    panel.className = 'mx-panel';
    panel.innerHTML = `<div class="mx-h"><div><div class="mx-t">The harbour of ${c.name.replace(/ \(.*\)/, '')}</div><div class="mx-sub">${REALMS[ECON.realmOf(c.id)].name}</div></div><button class="mx-x" data-act="close">✕</button></div>
      <p>Ships sail from here on a fixed course. You ride on deck while the crew sails: look around with the mouse, press <b>T</b> to sail faster, or <b>Enter</b> to sleep through the voyage.</p>
      <table class="mx-tb wide"><tr><th>Destination</th><th>Ship</th><th>Voyage</th><th></th></tr>${rows}</table><div class="mx-note">In Free Roam, passage is free. The dashed lines on the map (M) show every sea lane.</div>`;
    ov.classList.add('show');
  }
  { const st = document.createElement('style'); st.textContent = 'body:not(.journey) .mx-hud { display:none; }'; document.head.appendChild(st); }
  window.__v19 = { S: () => S, arrive: id => H.onCity(W.cityById[id]), market: id => renderMarket(W.cityById[id]), contracts: id => cityContracts(W.cityById[id]), journal: t => { panelState.tab = t; return renderJournal(); }, openMerchant: () => { panelState.vendor = { name: 'Merchant', role: 'merchant' }; panelState.mtab = 'market'; openUI('vendor'); }, openJournal: t => { panelState.tab = t; openUI('journal'); }, act: (a, d) => act(a, d), goto: id => { H.placeAtCity(id); H.onCity(W.cityById[id]); }, fodderUse: () => fodderUse(), load: () => load(), netWorth: () => netWorth() };
  window.__v18 = { lanes, openFreeHarbour: id => openFreeHarbour(W.cityById[id]), startVoyage: (i) => startVoyage(lanes()[i], nearestCityId()), voy: () => voy, wars, activeWars, warClosed, setSleep: v => { if (voy) voy.sleep = v; } };

  // ============================================================
  //  v20: QUALITY UPDATE: harbour master, quest pins, admin and view hooks
  // ============================================================
  // the harbour master stands under a tall mast with a blue pennant and an anchor board, and shows on the minimap
  { const o = spawnVendors; spawnVendors = function (c) { const had = vendorSets.has(c.id); o(c); if (had) return; const vs = vendorSets.get(c.id); if (!vs) return;
    for (const v of vs.vendors) { if (v.role !== 'harbour') continue; const lx = v.x - c.x, lz = v.z - c.z, a = Math.atan2(lz, lx);
      const b = new B.Builder(); b.ao = false; const mx = Math.cos(a) * (Math.hypot(lx, lz) + 3.4) + Math.sin(a) * 1.6, mz = Math.sin(a) * (Math.hypot(lx, lz) + 3.4) - Math.cos(a) * 1.6;
      b.cyl(mx, 0, mz, .11, .15, 9.5, 0x5a3a24, 6); b.box(mx, 7.6, mz, 2.6, .1, .1, 0x5a3a24); // mast and yard
      b.box(mx + .05, 8.3, mz, .04, 1.1, 2.6, 0x2a5a8a, a); b.box(mx + .05, 8.55, mz, .045, .35, 2.62, 0xf3e7cc, a); // pennant
      b.box(mx, 2.2, mz, 1.2, 1.3, .08, 0xf3e7cc, -a + Math.PI / 2); // board
      const ag = new THREE.Mesh(b.geometry(), H.objMat); ag.castShadow = true; vs.group.add(ag);
      const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d'); g.fillStyle = '#2a5a8a'; g.font = 'bold 104px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('⚓', 64, 70);
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false })); sp.scale.set(1.5, 1.5, 1); sp.position.set(mx, 10.4, mz); vs.group.add(sp);
      v.label.scale.set(2.3, .57, 1); v.label.position.y = 3.4; v.mast = { x: c.x + mx, z: c.z + mz }; } }; }
  { const o = H.onCity; H.onCity = function (c) { o(c);
    if (MODE === 'journey' && S && c && unl('ships') && PORTS.has(c.id) && !(S.harbourSeen = S.harbourSeen || {})[c.id]) { S.harbourSeen[c.id] = 1;
      setTimeout(() => { if (!ui) H.showToast('A port', `Ships sail from ${nm(c.id)}. The harbour master stands in the square under a tall mast with a blue pennant, marked ⚓ on the minimap.`, 'Harbour'); }, 7500); } }; }
  { const o = H.minimapDots; H.minimapDots = function () { const out = o ? o() : []; const c = H.getCity(); const vs = c && vendorSets.get(c.id); if (vs) for (const v of vs.vendors) if (v.role === 'harbour') out.push({ x: v.x, z: v.z, c: '#2a5a8a', big: true }); return out; }; }

  // where each story objective is done, for the map's quest pins
  const STEP_CITY = { talk1: 'acre', sell: 'acre', talk2: 'acre', buy: 'acre', contract: 'acre', damascus: 'damascus', talk3: 'damascus', aleppo: 'aleppo', deliver: 'aleppo', arrive: 'constantinople', ghisi: 'constantinople',
    tabriz: 'tabriz', bahram: 'tabriz', delhi: 'delhi', house: 'delhi', escape: 'delhi' };
  function nearestOf(ids) { const d = distFrom(nearestCityId()); let b = null; for (const id of ids) if (W.cityById[id] && (b === null || (d[id] ?? 1e9) < (d[b] ?? 1e9))) b = id; return b; }
  function questPins() {
    if (MODE !== 'journey' || !S) return []; const out = [];
    if (S.camp && S.camp.act <= 4) { const steps = stepsOf(S.camp.act); let first = true;
      for (const st of steps) { if (st.opt || stepDone(st)) continue; const m = STEP_CITY[st.id]; const city = typeof m === 'function' ? m() : m;
        if (city && W.cityById[city]) { const same = out.find(q => q.story && q.city === city); if (same) same.text += `; ${txt(st.t)}`; else out.push({ city, color: '#b8860b', icon: '★', text: `<b>Chapter ${ROMAN[S.camp.act]}:</b> ${txt(st.t)}`, story: true, cur: first }); } first = false; } }
    for (const k of (S.contracts || [])) { const left = Math.max(0, Math.ceil(k.due - S.day)); out.push({ city: k.to, color: left <= 5 ? '#d0451b' : '#7a1f12', icon: String(left), text: `<b>Contract:</b> ${k.n} ${GOOD[k.g].unit}${k.n > 1 ? 's' : ''} of ${lcName(GOOD[k.g].name)} for ${k.client || 'a client'}, due in ${left} day${left === 1 ? '' : 's'}` }); }
    for (const e of (S.errands || [])) { if (!W.cityById[e.to] || e.done) continue; const left = Math.max(0, Math.ceil(e.due - S.day)); if (left <= 0) continue;
      out.push({ city: e.to, color: '#2a5a8a', icon: e.type === 'book' ? 'B' : 'G', text: e.type === 'book' ? `<b>Errand:</b> deliver the scholar's manuscript (pays ${fmt(e.pay)}, ${left} days left)` : `<b>Commission:</b> bring ${e.n} ${GOOD[e.g] ? lcName(GOOD[e.g].name) : e.g} to the governor (pays ${fmt(e.pay)}, ${left} days left)` }); }
    return out.filter(q => W.cityById[q.city]);
  }
  H.questPins = questPins;
  H.compassMarks = () => { const c = H.getCity(); const vs = c && vendorSets.get(c.id); const out = []; if (vs) for (const v of vs.vendors) if (v.role === 'harbour' && Math.hypot(v.x - H.player.x, v.z - H.player.z) > 5) out.push({ x: v.x, z: v.z, c: '#2a5a8a', t: '⚓' }); return out; };
  { const o = H.mapCityInfo; H.mapCityInfo = c => { const q = questPins().filter(q => q.city === c.id); return (q.length ? `<div class="mx-qpins">${q.map(q => `<div><span style="color:${q.color}">⚑</span> ${q.text}</div>`).join('')}</div>` : '') + (o ? o(c) : ''); }; }
  // the model kit, for the third-person view
  Object.assign(H.lifeKit, { makePerson: (...a) => { W = W || H.W; B = B || H.B; return makePerson(...a); }, makeAnimal: (...a) => { W = W || H.W; B = B || H.B; return makeAnimal(...a); }, animate });
  H.canJump = () => !voy && !ui;
  // what the admin tools reach inside the journey
  H.J = { get S() { return S; }, get MODE() { return MODE; }, get ui() { return ui; }, get voy() { return voy; }, M, EVENTS,
    act: (a, d) => act(a, d), passDays: n => passDays(n, terrainAt(H.player.x, H.player.z)), triggerEvent: id => { const ev = EVENTS.find(e => e.id === id); if (ev) triggerEvent(ev, eventContext()); }, eventContext: () => eventContext(),
    rebuildCaravan: () => rebuildCaravan(), applyMount: () => applyMount(), hud: () => updateHud(true), save: () => save(), saveChapter: () => saveChapter(), refreshVendors: () => refreshVendors(),
    ACTS, ACT_NAMES, stepsOf: n => stepsOf(n), stepDone: st => stepDone(st), campCheck: () => campCheck(), advance: () => advance(), showStory: (n, p, a) => showStory(n, p, a), updateTracker: () => updateTracker(true), goalChecks: () => goalChecks(),
    netWorth: () => netWorth(), capacity: () => capacity(), load: () => load(), speedKm: () => speedKm(), distFrom: id => distFrom(id), nearestCityId: () => nearestCityId(), dateOf, fmt, nm, unl: k => unl(k),
    wars: () => wars(), activeWars: () => activeWars(), warDef: id => warDef(id), spawnMarketEvent: q => spawnMarketEvent(q), RARE, PORTS, closeUI: () => closeUI(), openUI: n => openUI(n), resetTrail: () => resetTrail(),
    restart: () => restart(), seasonNow: () => seasonNow(), facState: () => FS(), chapters: () => { try { return JSON.parse(localStorage.getItem(CAMP_KEY) || '{}'); } catch (e) { return {}; } }, CAMP_KEY, SAVE_KEY,
    ev: k => ev(k), finish: () => finish(), heroName, makePerson: (...a) => makePerson(...a), makeAnimal: (...a) => makeAnimal(...a), animate: (...a) => animate(...a), textSprite: t => textSprite(t), vendors: id => (vendorSets.get(id) || {}).vendors || [], render: () => render(), set ui(v) { ui = v; },
    rebuild: () => { rebuildCaravan(); updateHud(true); }, showWin: (t, x) => showWin(t, x), inCity, scuolaContracts: id => scuolaContracts(W.cityById[id]), ROMAN };

  // ---------------- per-frame ----------------
  let slowT = 0;
  H.frame = (dt) => {
    if (voyageFrame(dt)) return;
    if (MODE !== 'journey' || !S) { freePortFrame(); return; }
    const moved = updateTrail(); placeFollowers(moved);
    if (mountView) { mountView.position.y = moved > 0 ? Math.sin(H.player.bob * 1.4) * .04 : 0; }
    updateRoadCaravans(dt); updateTownsfolk(dt);
    if (vendorSets.size) for (const v of vendorSets.values()) for (const vd of v.vendors) { const o = vd.obj; const dx = H.player.x - vd.x, dz = H.player.z - vd.z; vd.label.visible = dx * dx + dz * dz > 30; if (dx * dx + dz * dz < 100) { let dy = Math.atan2(dx, dz) - o.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); o.rotation.y += dy * .1; } }
    slowT -= dt; if (slowT < 0) { slowT = .25; const c = H.getCity(); if (c) spawnVendors(c); cleanupVendors(); findInteraction(); updatePrompt(); }
    updateHud();
  };
  try { if (localStorage.getItem(SAVE_KEY)) document.body.classList.add('has-save'); } catch (e) { }
  window.__mech = { merc: () => triggerEvent(MERC_EVENT, eventContext()), contracts: id => cityContracts(W.cityById[id]), dbg: () => ({ followers: followers.map(f => [Math.round(f.obj.position.x - H.player.x), Math.round(f.obj.position.z - H.player.z), f.obj.parent === H.scene]), trail: trail.length, day: S.day, city: H.getCity() && H.getCity().id, roadVis: roadCaravans.filter(c => c.obj).length }), talk: (role, otab) => { const c = H.getCity(); const vs = vendorSets.get(c.id); const v = vs.vendors.find(v => v.role === role); H.player.x = v.x + 1.5; H.player.z = v.z + 1.5; panelState = { tab: role, vendor: v, qty: 1, otab }; openUI('vendor'); }, journal: t => { panelState = { tab: t }; openUI('journal'); }, get S() { return S; }, M, act, triggerEvent: (id) => triggerEvent(EVENTS.find(e => e.id === id), eventContext()), openUI, closeUI, passDays, eventContext, goalChecks, speedKm, capacity, load };
})();
