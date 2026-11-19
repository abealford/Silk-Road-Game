// ============================================================
//  v20: ADMIN MODE — cheats and debugging tools for testing the game
// ============================================================
// Switched on in the pause menu (or on the title screen). While it is on:
//   `  (the key left of 1) opens the admin panel
//   M  the map lets you travel to any city, in the Journey too
//   an ADMIN badge shows in the corner, and the save is marked as touched by admin mode,
//      so it never overwrites the story's chapter saves.
// To be removed before the game is released publicly.
(() => {
  const H = window.HOOKS; const $ = id => document.getElementById(id);
  const KEY = 'silkroad_admin_v1';
  const F = { on: false, noEvents: false, infSupplies: false, noclip: false, walk: 1, overlay: false };
  try { Object.assign(F, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { }
  const store = () => { try { localStorage.setItem(KEY, JSON.stringify(F)); } catch (e) { } };
  // what the rest of the game reads: every switch is off while admin mode is off
  H.adm = { get on() { return F.on; }, get noEvents() { return F.on && F.noEvents; }, get infSupplies() { return F.on && F.infSupplies; } };
  const J = () => H.J; const S = () => (H.J && H.J.MODE === 'journey') ? H.J.S : null;
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cityName = id => (H.W && H.W.cityById[id] ? H.W.cityById[id].name.replace(/ \(.*\)/, '') : id);
  function mark() { const s = S(); if (s && !s.adminUsed) { s.adminUsed = true; badge(); } }
  function toast(t) { if (H.showToast) H.showToast('Admin', t, 'Admin mode'); }

  // ---------------- styles ----------------
  const css = `
  #adm-badge { position:fixed; right:20px; bottom:40px; z-index:11; display:none; padding:2px 10px; font:bold 12px/1.5 Cinzel, Georgia, serif; letter-spacing:.14em; color:#fff3dc; background:rgba(122,31,18,.85); border:1px solid #f0d48a; border-radius:2px; pointer-events:none; }
  #adm-badge i { font:italic 11px Georgia, serif; letter-spacing:0; opacity:.85; margin-left:6px; }
  body.admin #adm-badge { display:block; }
  #adm { position:fixed; inset:0; z-index:70; display:none; background:rgba(20,12,6,.45); }
  #adm.show { display:flex; align-items:center; justify-content:center; }
  #adm .ad { width:min(980px, 94vw); height:min(680px, 90vh); display:flex; flex-direction:column; background:linear-gradient(#f6ecd2, #ecdcb4); color:#2e1e10; border:2px solid #7a1f12; box-shadow:0 12px 40px #000a; font:15px/1.4 "EB Garamond", Georgia, serif; }
  #adm .ah { display:flex; align-items:center; gap:12px; padding:10px 16px; border-bottom:1px solid #b89a62; background:linear-gradient(#ead6a8, #e0c896); }
  #adm .ah b { font:bold 20px Cinzel, serif; letter-spacing:.08em; color:#7a1f12; } #adm .ah span { flex:1; font-style:italic; opacity:.8; }
  #adm .tabs { display:flex; gap:4px; padding:8px 16px 0; flex-wrap:wrap; } #adm .tabs button { font:14px Cinzel, serif; padding:5px 12px; border:1px solid #8a6a3a; background:#f8eed6; cursor:pointer; border-radius:2px 2px 0 0; color:#4a2410; }
  #adm .tabs button.on { background:#7a1f12; color:#fff3dc; border-color:#7a1f12; }
  #adm .ab { flex:1; overflow:auto; padding:12px 16px 16px; border-top:1px solid #b89a62; }
  #adm h4 { font:bold 13px Cinzel, serif; letter-spacing:.12em; color:#7a1f12; margin:14px 0 6px; border-bottom:1px solid #c9ad78; padding-bottom:2px; text-transform:uppercase; } #adm h4:first-child { margin-top:0; }
  #adm button.b { font:14px Georgia, serif; padding:4px 10px; margin:2px 3px 2px 0; border:1px solid #6b4a2e; background:#fbf3df; color:#3a2414; cursor:pointer; border-radius:2px; }
  #adm button.b:hover { background:#fff; } #adm button.b.on { background:#3a6a2a; color:#fff; border-color:#2a4a1a; } #adm button.b.red { background:#7a1f12; color:#fff3dc; border-color:#5a1008; }
  #adm button.x { font:16px Georgia, serif; border:1px solid #6b4a2e; background:#fbf3df; cursor:pointer; padding:2px 9px; }
  #adm .row { display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin:3px 0; } #adm .row > label { min-width:150px; font-weight:600; }
  #adm .note { font-style:italic; opacity:.8; font-size:14px; margin:4px 0; }
  #adm input[type=text], #adm input[type=number], #adm select, #adm textarea { font:14px Georgia, serif; padding:3px 6px; border:1px solid #8a6a3a; background:#fffaf0; color:#2e1e10; }
  #adm table { border-collapse:collapse; width:100%; font-size:14px; } #adm td, #adm th { border-bottom:1px solid rgba(122,31,18,.15); padding:3px 6px; text-align:left; vertical-align:middle; } #adm th { font:12px Cinzel, serif; letter-spacing:.06em; color:#7a1f12; }
  #adm .glist { max-height:290px; overflow:auto; border:1px solid #c9ad78; background:#fffaf0; } #adm .glist td:first-child { width:30px; } #adm .glist svg { width:26px; height:26px; display:block; }
  #adm .rar-c { color:#5a4a3a; } #adm .rar-u { color:#2f7a2a; } #adm .rar-r { color:#1e5a9a; } #adm .rar-e { color:#7a2a9a; } #adm .rar-l { color:#b8780a; font-weight:600; }
  #adm .ok { color:#2f6a2a; } #adm .dim { opacity:.65; }
  #adm-dbg { position:fixed; right:12px; bottom:240px; z-index:25; display:none; min-width:230px; padding:6px 9px; background:rgba(20,14,8,.78); color:#f3e7cc; font:12px/1.45 ui-monospace, Menlo, Consolas, monospace; border:1px solid #8a6a3a; border-radius:3px; pointer-events:none; white-space:pre; }
  body.admin #adm-dbg.show { display:block; }
  #pm-admin.on { background:#7a1f12 !important; color:#fff3dc !important; }
  #title-admin { margin-top:10px; font:13px Georgia, serif; opacity:.8; cursor:pointer; user-select:none; text-align:center; } #title-admin input { vertical-align:middle; }
  `;
  { const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st); }
  const badgeEl = document.createElement('div'); badgeEl.id = 'adm-badge'; document.body.appendChild(badgeEl);
  const dbg = document.createElement('div'); dbg.id = 'adm-dbg'; document.body.appendChild(dbg);
  const root = document.createElement('div'); root.id = 'adm'; root.innerHTML = '<div class="ad"><div class="ah"><b>Admin</b><span>Cheats and debugging tools. Press ` to close.</span><button class="x" data-a="close">✕</button></div><div class="tabs"></div><div class="ab"></div></div>'; document.body.appendChild(root);
  function badge() { const s = S(); badgeEl.innerHTML = 'ADMIN' + (s && s.adminUsed ? '<i>this save used admin tools</i>' : ''); document.body.classList.toggle('admin', F.on); dbg.classList.toggle('show', F.overlay); }

  // ---------------- switching admin mode on and off ----------------
  function setOn(v) {
    F.on = !!v; store(); badge();
    const b = $('pm-admin'); if (b) { b.classList.toggle('on', F.on); b.textContent = F.on ? 'Admin mode: on' : 'Admin mode: off'; }
    const t = $('title-admin'); if (t) t.querySelector('input').checked = F.on;
    if (!F.on) close();
    if (H.noclip !== undefined || F.on) H.noclip = F.on && F.noclip;
  }
  { const pm = document.querySelector('#pause .pm'); const menu = $('pm-menu');
    if (pm && menu) { const b = document.createElement('button'); b.id = 'pm-admin'; pm.insertBefore(b, menu);
      b.onclick = () => { setOn(!F.on); if (F.on) toast('Admin mode is on. Press ` (left of 1) for the admin panel; the map (M) lets you travel to any city.'); }; }
    const modes = $('modes'); if (modes) { const t = document.createElement('label'); t.id = 'title-admin'; t.innerHTML = '<input type="checkbox"> Admin mode (cheats and debugging tools)'; modes.after(t); t.querySelector('input').onchange = e => setOn(e.target.checked); }
    const keys = document.querySelector('#pause .pm-keys'); if (keys) keys.insertAdjacentHTML('beforeend', '<br><b>V</b> view · <b>Space</b> jump · <b>`</b> admin panel');
  }

  // ---------------- the panel ----------------
  let open = false, tab = 'general', gq = '', grar = '', gqty = 10, evq = '';
  function close() { if (!open) return; open = false; root.classList.remove('show'); if (H.setPauseWanted) H.setPauseWanted(true); if (H.tryLock && !(H.J && H.J.ui)) H.tryLock(); }
  function show() { open = true; root.classList.add('show'); if (document.pointerLockElement) document.exitPointerLock(); if (H.setPauseWanted) H.setPauseWanted(false); for (const k in H.keys) H.keys[k] = false; if (H.player) H.player.auto = false; render(); }
  { const of = H.frozen; H.frozen = () => open || !!(of && of()); const ou = H.uiOpen; H.uiOpen = () => open || !!(ou && ou()); }
  H.adminKey = e => {
    if (e.code !== 'Backquote') return false;
    if (!F.on) { toast('Admin mode is off. Turn it on in the pause menu (P).'); return true; }
    open ? close() : show(); return true;
  };
  // the panel takes the keyboard while it's open
  document.addEventListener('keydown', e => {
    if (!open) return; if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) { if (e.code === 'Escape') e.target.blur(); e.stopPropagation(); return; }
    if (e.code === 'Backquote' || e.code === 'Escape') { close(); } e.stopPropagation(); e.preventDefault();
  }, true);
  H.adminTeleport = () => F.on && !(H.J && H.J.voy);
  H.teleported = () => { if (F.on) mark(); };
  { const o = H.speedMul; H.speedMul = () => (o ? o() : 1) * (F.on ? F.walk : 1); }

  const TABS = [['general', 'General'], ['money', 'Money & goods'], ['caravan', 'Caravan'], ['story', 'Story'], ['world', 'World'], ['events', 'Events'], ['debug', 'Debug']];
  function render() {
    root.querySelector('.tabs').innerHTML = TABS.map(([k, n]) => `<button data-a="tab" data-t="${k}" class="${tab === k ? 'on' : ''}">${n}</button>`).join('');
    const s = S(); const jr = !!s;
    let h = '';
    const tog = (k, label, note) => `<div class="row"><label>${label}</label><button class="b ${F[k] ? 'on' : ''}" data-a="flag" data-k="${k}">${F[k] ? 'On' : 'Off'}</button>${note ? `<span class="note">${note}</span>` : ''}</div>`;
    const needJ = '<p class="note">These tools work in the Journey. Start or continue a journey to use them.</p>';
    if (tab === 'general') {
      h += '<h4>Switches</h4>' + tog('noEvents', 'Skip world events', 'No random road events (bandits, wolves, chains). Wars and market news still run.')
        + tog('infSupplies', 'Never run out', 'Food, water and fodder never drop below 10 days.') + tog('noclip', 'Walk anywhere', 'Leave the roads and walk through walls, water and mountains.') + tog('overlay', 'Debug overlay', 'Frame rate, draw calls, position, realm and market.');
      h += `<div class="row"><label>Walking speed</label>${[1, 3, 10, 30].map(v => `<button class="b ${F.walk === v ? 'on' : ''}" data-a="walk" data-v="${v}">${v}×</button>`).join('')}<span class="note">Days on the road pass with the distance, so they speed up too.</span></div>`;
      h += '<h4>Teleport</h4><p class="note">Open the map (M) and click any city: the card has an <b>Admin: travel</b> button. Or jump straight to one here:</p>';
      h += `<div class="row"><select id="adm-tp">${H.W ? H.W.cities.slice().sort((a, b) => a.name.localeCompare(b.name)).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('') : ''}</select><button class="b" data-a="tp">Travel</button>${['acre', 'constantinople', 'tabriz', 'samarkand', 'kashgar', 'khanbaliq', 'caffa', 'cairo'].map(id => `<button class="b" data-a="tpq" data-c="${id}">${cityName(id)}</button>`).join('')}</div>`;
      h += `<h4>Admin mode</h4><div class="row"><button class="b red" data-a="off">Turn admin mode off</button><span class="note">You can turn it on again in the pause menu.</span></div>`;
    }
    else if (tab === 'money') {
      if (!jr) h += needJ; else {
        h += `<h4>Silver and standing</h4><div class="row"><label>Silver: ${fmt(s.coins)}</label>${[100, 1000, 10000].map(n => `<button class="b" data-a="coins" data-n="${n}">+${fmt(n)}</button>`).join('')}<button class="b" data-a="coins" data-n="${-s.coins}">Set to 0</button></div>`;
        h += `<div class="row"><label>Reputation: ${Math.round(s.rep)}</label>${[0, 25, 40, 60, 100].map(n => `<button class="b" data-a="rep" data-n="${n}">${n}</button>`).join('')}</div>`;
        h += `<div class="row"><label>Supplies</label><button class="b" data-a="fill">Fill 30 days of food, water and fodder</button><button class="b" data-a="empty">Empty them</button></div>`;
        h += `<h4>Add goods</h4><div class="row"><input type="text" id="adm-gq" placeholder="Search 250 goods…" value="${esc(gq)}" style="width:220px"><select id="adm-gr"><option value="">Any rarity</option>${RAR_ORDER.map(r => `<option value="${r}" ${grar === r ? 'selected' : ''}>${RARITY[r].name}</option>`).join('')}</select> Quantity <input type="number" id="adm-gn" value="${gqty}" min="1" style="width:70px"><span class="note">Cargo: ${J().load().toFixed(1)} / ${J().capacity()} loads. Overloaded caravans drop goods at the end of the day: add pack animals first.</span></div>`;
        const list = Object.values(GOOD).filter(g => !g.quest && (!grar || (g.rar || 'c') === grar) && (!gq || g.name.toLowerCase().includes(gq.toLowerCase()) || g.id.includes(gq.toLowerCase()))).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 120);
        h += `<div class="glist"><table>${list.map(g => `<tr><td>${typeof ICONS === 'function' ? ICONS(g.id, 26) : ''}</td><td class="${g.rar ? 'rar-' + g.rar : ''}">${esc(g.name)}</td><td class="dim">${g.rar ? RARITY[g.rar].name : 'special'}${g.m && typeof MARKETS !== 'undefined' && MARKETS[g.m] ? ' · ' + MARKETS[g.m].name : g.fac ? ' · house good' : ''}</td><td>${s.cargo[g.id] ? '× ' + s.cargo[g.id] : ''}</td><td><button class="b" data-a="addg" data-g="${g.id}">Add</button></td></tr>`).join('')}</table></div>`;
        h += `<div class="row" style="margin-top:6px"><button class="b" data-a="holyoil">Add the holy oil (the Khan's gift)</button><button class="b" data-a="clearcargo">Clear all cargo</button></div>`;
      }
    }
    else if (tab === 'caravan') {
      if (!jr) h += needJ; else {
        h += `<h4>Mount</h4><div class="row">${Object.keys(MOUNTS).map(k => `<button class="b ${s.mount === k ? 'on' : ''}" data-a="mount" data-k="${k}">${esc(MOUNTS[k].name)}</button>`).join('')}</div>`;
        h += `<h4>Pack animals and carts</h4><table>${Object.keys(PACK).map(k => `<tr><td>${esc(PACK[k].name)}</td><td>× ${s.pack[k] || 0}</td><td><button class="b" data-a="pack" data-k="${k}" data-n="1">+1</button><button class="b" data-a="pack" data-k="${k}" data-n="5">+5</button><button class="b" data-a="pack" data-k="${k}" data-n="-99">Remove all</button></td></tr>`).join('')}${Object.keys(VEHICLES).map(k => `<tr><td>${esc(VEHICLES[k].name)}</td><td>× ${s.veh[k] || 0}</td><td><button class="b" data-a="veh" data-k="${k}" data-n="1">+1</button><button class="b" data-a="veh" data-k="${k}" data-n="-99">Remove all</button></td></tr>`).join('')}</table>`;
        h += `<h4>Hired men</h4><table>${Object.keys(HIRES).map(k => `<tr><td>${esc(HIRES[k].name)}</td><td>× ${s.hires[k] || 0}</td><td><button class="b" data-a="hire" data-k="${k}" data-n="1">+1</button><button class="b" data-a="hire" data-k="${k}" data-n="-99">Dismiss all</button></td></tr>`).join('')}</table>`;
        h += `<h4>Speed upgrades</h4><div class="row">${Object.keys(SPEED_UPS).map(k => { const u = SPEED_UPS[k]; const have = u.slot ? s.speed.breed === k : s.speed[k]; return `<button class="b ${have ? 'on' : ''}" data-a="speed" data-k="${k}">${esc(u.name)}</button>`; }).join('')}</div><p class="note">Speed now: ${fmt(J().speedKm())} km a day.</p>`;
        h += `<h4>Arms and gear</h4><div class="row">${Object.keys(ARMS).map(k => `<button class="b ${s.arms[ARMS[k].slot] === k ? 'on' : ''}" data-a="arms" data-k="${k}">${esc(ARMS[k].name)}</button>`).join('')}</div><div class="row">${Object.keys(UPGRADES).map(k => `<button class="b ${s.up[k] ? 'on' : ''}" data-a="up" data-k="${k}">${esc(UPGRADES[k].name)}</button>`).join('')}<button class="b ${s.paiza ? 'on' : ''}" data-a="paiza">Paiza</button></div>`;
        h += `<h4>House wares</h4><div class="row">${Object.keys(J().RARE).map(k => `<button class="b ${s.up[k] ? 'on' : ''}" data-a="up" data-k="${k}">${esc(J().RARE[k].name)}</button>`).join('')}</div>`;
        const fs = J().facState();
        h += `<h4>Merchant houses</h4><table>${FAC_ORDER.map(f => `<tr><td>${esc(FACTIONS[f].name)}</td><td>standing ${Math.round(fs[f].s)}${fs[f].m ? ' · <b>member</b> (' + facRank(s, f) + ')' : ''}</td><td>${[0, 10, 25, 50, 80, 100].map(n => `<button class="b" data-a="fac" data-f="${f}" data-n="${n}">${n}</button>`).join('')}<button class="b ${fs[f].m ? 'on' : ''}" data-a="facm" data-f="${f}">Member</button></td></tr>`).join('')}</table>`;
        h += `<h4>Property</h4><p class="note">Warehouses, caravanserai shares and workshops are bought at the guild's Property tab; use +10,000 silver.</p>`;
      }
    }
    else if (tab === 'story') {
      if (!jr) h += needJ; else if (!s.camp) h += '<p class="note">This is an open journey, with no story. Start Matteo\'s story from the title screen to use these tools.</p>'; else {
        const a = s.camp.act; const AN = J().ACT_NAMES;
        h += `<h4>Chapters</h4><p>Now in <b>${a <= 4 ? 'Act ' + ['', 'I', 'II', 'III', 'IV'][a] + ': ' + AN[a] : 'the story is complete'}</b>, day ${fmt(s.day)}.</p><div class="row">${[2, 3, 4].map(n => `<button class="b" data-a="skipto" data-n="${n}" ${n <= a ? 'disabled' : ''}>Skip to Act ${['', 'I', 'II', 'III', 'IV'][n]}</button>`).join('')}<span class="note">Skipping fills in what each act would have given you, and takes you to the next act's city.</span></div>`;
        if (a <= 4) {
          const steps = J().stepsOf(a);
          h += `<h4>Objectives of this act</h4><table>${steps.map(st => { const done = J().stepDone(st); return `<tr><td class="${done ? 'ok' : ''}">${done ? '✔' : '○'} ${typeof st.t === 'function' ? st.t() : st.t}${st.opt ? ' <i class="dim">(optional)</i>' : ''}</td><td>${done || st.live ? '' : `<button class="b" data-a="stepdone" data-id="${st.id}">Complete</button>`}</td></tr>`; }).join('')}</table>`;
          if (a === 3) h += `<div class="row"><button class="b" data-a="audreq">Meet the audience requirements</button><button class="b" data-a="audwin">Win the audience now</button></div>`;
        }
        const ch = J().chapters(); h += `<h4>Chapter saves</h4><div class="row">${Object.keys(ch).length ? Object.keys(ch).map(k => `<button class="b" data-a="chapter" data-n="${k}">Load Act ${['', 'I', 'II', 'III', 'IV'][k] || k}</button>`).join('') : '<span class="note">None yet.</span>'}<span class="note">Admin games never write chapter saves.</span></div>`;
        h += `<h4>Pace log</h4><p class="note">Recorded in every game, admin or not: the day and silver when each objective was done. Copy it into a playtest issue.</p>${paceTable(s)}<div class="row"><button class="b" data-a="copypace">Copy the pace log</button></div>`;
      }
    }
    else if (tab === 'world') {
      if (!jr) h += needJ; else {
        h += `<h4>Time</h4><p>Day ${fmt(s.day)}: ${J().dateOf(s.day)} · ${J().seasonNow()}</p><div class="row">${[1, 3, 10, 30, 90, 365].map(n => `<button class="b" data-a="days" data-n="${n}">+${n} day${n > 1 ? 's' : ''}</button>`).join('')}<span class="note">Time passes as if you had waited: supplies are eaten, wars and market news move on, and stock refreshes after 3 days.</span></div>`;
        const ws = J().wars(); h += `<h4>Wars</h4><table><tr><th>War</th><th>Dates</th><th></th></tr>${ws.map(w => { const D = J().warDef(w.id) || {}; const on = s.day >= w.start && s.day < w.end; return `<tr><td>${on ? '<b>' + esc(D.name || w.id) + '</b> (now)' : esc(D.name || w.id)}</td><td>day ${fmt(w.start)} to ${fmt(w.end)}</td><td><button class="b" data-a="war" data-id="${w.id}" data-on="1">Start now</button><button class="b" data-a="war" data-id="${w.id}" data-on="0">End now</button></td></tr>`; }).join('')}</table>`;
        const c = H.getCity(); const cid = J().nearestCityId();
        h += `<h4>Markets</h4><div class="row"><button class="b" data-a="mktev">Start a market event somewhere</button><button class="b" data-a="reroll">Reroll the merchant's stock in ${cityName(cid)}</button><button class="b" data-a="forcer" data-r="e">Add an epic good here</button><button class="b" data-a="forcer" data-r="l">Add a legendary good here</button></div>${c ? '' : '<p class="note">Stock tools act on the nearest city.</p>'}`;
        const st = s.stock && s.stock[cid]; if (st && st.offers) h += `<p class="note">${cityName(cid)} sells now: ${st.offers.map(g => GOOD[g] ? `<span class="${GOOD[g].rar ? 'rar-' + GOOD[g].rar : ''}">${esc(GOOD[g].name)}</span>` : g).join(', ')}.</p>`;
        h += `<h4>Prices</h4><div class="row"><select id="adm-pg">${Object.values(GOOD).filter(g => g.m).sort((a, b) => a.name.localeCompare(b.name)).map(g => `<option value="${g.id}">${esc(g.name)}</option>`).join('')}</select><button class="b" data-a="prices">Show sell prices in every market city</button></div><div id="adm-prices"></div>`;
      }
    }
    else if (tab === 'events') {
      if (!jr) h += needJ; else {
        const evs = J().EVENTS.filter(e => e.choices && e.choices.length && (!evq || (e.title || e.id).toLowerCase().includes(evq.toLowerCase()) || e.id.includes(evq.toLowerCase())));
        h += `<h4>Run an event</h4><div class="row"><input type="text" id="adm-evq" placeholder="Search events…" value="${esc(evq)}" style="width:240px"><span class="note">${J().EVENTS.length} events. Runs it here, whatever the region; close this panel to see it. Chains need their earlier steps.</span></div>`;
        h += `<div class="glist"><table>${evs.map(e => `<tr><td>${esc(e.title || e.id)}</td><td class="dim">${e.id}${e.once ? ' · once' : ''}${s.usedOnce[e.id] ? ' · used' : ''}</td><td><button class="b" data-a="runev" data-id="${e.id}">Run</button></td></tr>`).join('')}</table></div>`;
        h += `<div class="row" style="margin-top:6px"><button class="b" data-a="resetonce">Allow the one-time events again</button><button class="b" data-a="cool">Reset the event cooldown</button></div>`;
      }
    }
    else if (tab === 'debug') {
      h += '<h4>Overlay</h4>' + tog('overlay', 'Debug overlay', 'Shown at the bottom right while admin mode is on.');
      if (jr) {
        h += `<h4>Save</h4><div class="row"><button class="b" data-a="copysave">Copy this save</button><button class="b" data-a="savenow">Save now</button><span class="note">Paste a copied save into a GitHub issue so a bug can be repeated exactly.</span></div>`;
        h += `<div class="row"><textarea id="adm-load" rows="3" style="width:100%" placeholder="Paste a save here…"></textarea></div><div class="row"><button class="b red" data-a="loadsave">Load the pasted save</button><span class="note">Replaces the current journey and reloads the page.</span></div>`;
        h += `<h4>State</h4><p class="note">Seed ${esc(s.seed)} · day ${s.day.toFixed(2)} · ${fmt(s.kmTotal)} km · ${s.events} events · net worth ${fmt(J().netWorth())}${s.adminUsed ? ' · admin used' : ''}</p>`;
      }
      h += `<h4>Test hooks</h4><p class="note">In the browser console: <code>HOOKS.J</code> (journey internals), <code>__view</code>, <code>__v19</code>, <code>__v18</code>, <code>__mech</code>, <code>__gfx</code>, <code>__combat</code>.</p>`;
    }
    root.querySelector('.ab').innerHTML = h;
    const gqi = $('adm-gq'); if (gqi) { gqi.oninput = () => { gq = gqi.value; const p = gqi.selectionStart; render(); const n = $('adm-gq'); n.focus(); n.setSelectionRange(p, p); }; }
    const gri = $('adm-gr'); if (gri) gri.onchange = () => { grar = gri.value; render(); };
    const gni = $('adm-gn'); if (gni) gni.onchange = () => { gqty = Math.max(1, +gni.value || 1); };
    const evi = $('adm-evq'); if (evi) evi.oninput = () => { evq = evi.value; const p = evi.selectionStart; render(); const n = $('adm-evq'); n.focus(); n.setSelectionRange(p, p); };
  }
  function paceTable(s) {
    const L = s.paceLog || []; if (!L.length) return '<p class="note">Nothing yet.</p>';
    return `<table><tr><th>Act</th><th>Objective</th><th>Day</th><th>Silver</th><th>Net worth</th></tr>${L.map(r => `<tr><td>${r.a}</td><td>${esc(r.t)}</td><td>${fmt(r.day)}</td><td>${fmt(r.coins)}</td><td>${fmt(r.nw)}</td></tr>`).join('')}</table>`;
  }
  function paceText(s) { return (s.paceLog || []).map(r => `Act ${r.a} | ${r.t} | day ${Math.round(r.day)} | ${Math.round(r.coins)} silver | net worth ${Math.round(r.nw)}`).join('\n'); }
  function copy(t, what) { const done = () => toast(`${what} copied to the clipboard.`); try { navigator.clipboard.writeText(t).then(done, () => fallback()); } catch (e) { fallback(); } function fallback() { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { } ta.remove(); } }

  // ---------------- actions ----------------
  function refresh(s) { if (!s) return; J().rebuildCaravan(); J().applyMount(); J().hud(); J().campCheck(); }
  function travel(id) { if (!H.W.cityById[id]) return; mark(); close(); H.placeAtCity(id); if (J() && J().resetTrail) J().resetTrail(); }
  function skipTo(n) {
    const s = S(); if (!s || !s.camp) return; mark();
    const ms = typeof MARKET !== 'undefined' ? MARKET_ORDER.filter(m => m !== MARKET.of('constantinople')).slice(0, 3) : [];
    while (s.camp.act < n && s.camp.act < 4) {
      const a = s.camp.act;
      if (a === 1) { Object.assign(s.camp.ev, { talk_merchant: 1, contract: 1, bought: 1, food: 1, delivered: 1, profit: 1 }); s.coins = Math.max(s.coins, 300); for (const c of ['damascus', 'aleppo', 'constantinople']) if (!s.visited.includes(c)) s.visited.push(c); }
      if (a === 2) { s.camp.ev.bailo = 1; delete s.cargo.bailoletter; s.rep = Math.min(100, s.rep + 10); s.pack.mule = Math.max(3, s.pack.mule || 0); s.camp.mk2 = Array.from(new Set((s.camp.mk2 || []).concat(ms))); s.coins = Math.max(s.coins, 1500); s.camp.ev.venture = 1; }
      for (const st of J().stepsOf(a)) if (!st.live) s.camp.done[st.id] = 1;
      if (a < 3) { s.camp.act = a + 1; s.camp.base = s.visited.length; s.camp.startDay = s.day; if (a + 1 === 2) s.water = Math.max(s.water, 10); }
      else { s.won = true; s.paiza = true; s.camp.act = 4; s.camp.a4intro = 1; }
    }
    close();
    const to = { 2: 'constantinople', 4: 'khanbaliq' }[n]; if (to) H.placeAtCity(to);
    J().refreshVendors(); refresh(s); J().save();
    setTimeout(() => J().showStory(n, 'Admin mode skipped ahead to this act.', n - 1), 400);
  }
  root.addEventListener('click', e => {
    const t = e.target.closest('[data-a]'); if (!t || t.disabled) return; const d = t.dataset; const s = S();
    switch (d.a) {
      case 'close': close(); return;
      case 'tab': tab = d.t; break;
      case 'off': setOn(false); return;
      case 'flag': F[d.k] = !F[d.k]; store(); H.noclip = F.on && F.noclip; badge(); break;
      case 'walk': F.walk = +d.v; store(); break;
      case 'tp': travel($('adm-tp').value); return;
      case 'tpq': travel(d.c); return;
      case 'coins': mark(); s.coins = Math.max(0, s.coins + +d.n); break;
      case 'rep': mark(); s.rep = +d.n; break;
      case 'fill': mark(); s.food = s.people() * 30; s.water = Math.max(s.water, s.people() * 15 + 20); s.fodder = Math.max(s.fodder, 40); break;
      case 'empty': mark(); s.food = 0; s.water = 0; s.fodder = 0; break;
      case 'addg': { mark(); const g = d.g, n = Math.max(1, +($('adm-gn') || {}).value || gqty); const have = s.cargo[g] || 0; let p = 0; try { p = ECON.mid(g, J().nearestCityId(), s.day); } catch (e) { } s.basis[g] = ((s.basis[g] || 0) * have + p * n) / (have + n); s.cargo[g] = have + n; toast(`${n} × ${GOOD[g].name} added.`); break; }
      case 'holyoil': mark(); s.cargo.holyoil = (s.cargo.holyoil || 0) + 1; break;
      case 'clearcargo': mark(); s.cargo = {}; s.basis = {}; break;
      case 'mount': mark(); s.mount = d.k; break;
      case 'pack': mark(); s.pack[d.k] = Math.max(0, (s.pack[d.k] || 0) + +d.n); if (!s.pack[d.k]) delete s.pack[d.k]; break;
      case 'veh': mark(); s.veh[d.k] = Math.max(0, (s.veh[d.k] || 0) + +d.n); if (!s.veh[d.k]) delete s.veh[d.k]; break;
      case 'hire': mark(); s.hires[d.k] = Math.max(0, (s.hires[d.k] || 0) + +d.n); if (!s.hires[d.k]) delete s.hires[d.k]; break;
      case 'speed': { mark(); const u = SPEED_UPS[d.k]; if (u.slot) s.speed.breed = s.speed.breed === d.k ? undefined : d.k; else s.speed[d.k] = s.speed[d.k] ? 0 : 1; break; }
      case 'arms': { mark(); const a = ARMS[d.k]; s.arms[a.slot] = s.arms[a.slot] === d.k ? undefined : d.k; break; }
      case 'up': mark(); s.up[d.k] = s.up[d.k] ? 0 : (UPGRADES[d.k] && UPGRADES[d.k].max > 1 ? UPGRADES[d.k].max : 1); break;
      case 'paiza': mark(); s.paiza = !s.paiza; break;
      case 'fac': mark(); J().facState()[d.f].s = +d.n; break;
      case 'facm': { mark(); const st = J().facState()[d.f]; st.m = !st.m; if (st.m) st.s = Math.max(st.s, 10); break; }
      case 'skipto': skipTo(+d.n); return;
      case 'stepdone': { mark(); const st = J().stepsOf(s.camp.act).find(x => x.id === d.id); if (st) { s.camp.done[st.id] = 1; if (st.id === 'bailo') { s.camp.ev.bailo = 1; delete s.cargo.bailoletter; } J().campCheck(); J().updateTracker(); } if (J().ui === 'story') { close(); return; } break; }
      case 'audreq': { mark(); const nw = J().netWorth(); if (nw < 6100) s.coins += 6100 - nw; s.cargo.holyoil = Math.max(1, s.cargo.holyoil || 0); s.paiza = true; s.rep = Math.max(s.rep, 40); toast('You now meet every requirement for the audience.'); break; }
      case 'audwin': { mark(); const nw = J().netWorth(); if (nw < 6100) s.coins += 6100 - nw; s.cargo.holyoil = Math.max(1, s.cargo.holyoil || 0); s.paiza = true; close(); J().openUI('audience'); J().act('win', {}); return; }
      case 'chapter': { const ch = J().chapters()[d.n]; if (!ch) return; try { localStorage.setItem(J().SAVE_KEY, ch); location.reload(); } catch (e) { } return; }
      case 'copypace': copy(paceText(s), 'The pace log'); return;
      case 'days': mark(); J().passDays(+d.n); break;
      case 'war': { mark(); const w = J().wars().find(w => w.id === d.id); if (!w) break; const len = w.end - w.start; if (d.on === '1') { w.start = Math.floor(s.day); w.end = w.start + Math.max(30, len); } else { w.end = Math.floor(s.day); if (w.start > w.end) w.start = w.end - 1; } toast(d.on === '1' ? 'The war begins today.' : 'The war ends today.'); break; }
      case 'mktev': mark(); J().spawnMarketEvent(false); break;
      case 'reroll': { mark(); const cid = J().nearestCityId(); MARKET.arrive(s, cid, '__admin'); toast(`New stock in ${cityName(cid)}.`); break; }
      case 'forcer': { mark(); const cid = J().nearestCityId(); if (!s.stock[cid] || !s.stock[cid].offers) MARKET.arrive(s, cid, '__admin'); const st = s.stock[cid]; const mid = MARKET.of(cid);
        const el = GOODS.filter(g => g.m === mid && g.rar === d.r && !st.offers.includes(g.id)); if (!el.length) { toast('No more goods of that rarity in this market.'); break; } const g = el[Math.floor(Math.random() * el.length)];
        st.offers.push(g.id); const q = MARKET.quantity(g, cid, Math.random, s.day); st.max[g.id] = q; st.q[g.id] = q; toast(`${g.name} is now on sale in ${cityName(cid)}.`); break; }
      case 'prices': { const g = $('adm-pg').value; const rows = typeof MARKETS_DATA !== 'undefined' ? MARKETS_DATA.flatMap(m => m.stars || []) : []; const out = rows.filter(id => H.W.cityById[id]).map(id => [id, ECON.sellPrice(s, g, id, s.day), ECON.buyPrice(s, g, id, s.day)]).sort((a, b) => b[1] - a[1]);
        $('adm-prices').innerHTML = `<table><tr><th>City</th><th>Sells for</th><th>Buys at</th></tr>${out.map(([id, sp, bp]) => `<tr><td>${cityName(id)}</td><td>${sp.toFixed(1)}</td><td>${bp.toFixed(1)}</td></tr>`).join('')}</table>`; return; }
      case 'runev': mark(); close(); setTimeout(() => J().triggerEvent(d.id), 100); return;
      case 'resetonce': mark(); s.usedOnce = {}; break;
      case 'cool': s.cool = 0; s.kmRoll = 54; break;
      case 'copysave': copy(JSON.stringify(s), 'The save'); return;
      case 'savenow': J().save(); toast('Saved.'); return;
      case 'loadsave': { const txt = $('adm-load').value.trim(); try { const o = JSON.parse(txt); if (!o || !o.cargo) throw 0; localStorage.setItem(J().SAVE_KEY, JSON.stringify(o)); toast('Loaded. Reloading…'); setTimeout(() => location.reload(), 600); } catch (e) { toast('That is not a save from this game.'); } return; }
    }
    if (s) refresh(s); render();
  });

  // ---------------- pace log: the day and silver when each objective is done (every game) ----------------
  function pace() {
    const s = S(); if (!s || !s.camp || !J()) return; const a = s.camp.act; if (a > 4) return;
    const L = s.paceLog = s.paceLog || []; const seen = new Set(L.map(r => r.a + ':' + r.id));
    const rec = (id, t) => { if (seen.has(a + ':' + id)) return; seen.add(a + ':' + id); L.push({ a, id, t, day: Math.round(s.day * 10) / 10, coins: Math.round(s.coins), nw: Math.round(J().netWorth()) }); };
    rec('start', 'Act begins');
    try { for (const st of J().stepsOf(a)) if (J().stepDone(st)) rec(st.id, typeof st.t === 'function' ? st.t() : st.t); } catch (e) { }
  }

  // ---------------- debug overlay ----------------
  let frames = 0, fpsT = performance.now(), fps = 0, dbgT = 0, calls = 0, tris = 0;
  function tick() {
    requestAnimationFrame(tick); frames++; const now = performance.now();
    // all render passes of a frame (the scene, shadows, bloom): counted between two of our frames
    const inf = H.renderer && H.renderer.info; if (inf) { if (F.on && F.overlay) { if (inf.autoReset) inf.autoReset = false; else { calls = inf.render.calls; tris = inf.render.triangles; } inf.reset(); } else if (!inf.autoReset) inf.autoReset = true; }
    if (now - fpsT >= 1000) { fps = frames * 1000 / (now - fpsT); frames = 0; fpsT = now; pace(); }
    if (!F.on || !F.overlay || now - dbgT < 400) return; dbgT = now;
    try {
      const p = H.player, W = H.W; const ri = { calls, triangles: tris }; const [lon, lat] = W.toLL(p.x, p.z); const nc = W.nearestCity(p.x, p.z);
      const cid = nc.c.id; const s = S(); const realm = typeof ECON !== 'undefined' && ECON.realmOf ? ECON.realmOf(cid) : '';
      dbg.textContent = [`FPS ${fps.toFixed(0)}`, `draw calls ${ri.calls || 0}   tris ${fmt(ri.triangles || 0)}`, `pos ${p.x.toFixed(0)}, ${p.z.toFixed(0)}   ${lat.toFixed(2)}°N ${lon.toFixed(2)}°E`,
        `near ${cityName(cid)} (${nc.d.toFixed(0)} u)${H.getCity() ? ' · inside' : ''}`, `realm ${realm}${typeof MARKET !== 'undefined' ? '   market ' + (MARKET.of(cid) || '-') : ''}`,
        s ? `day ${s.day.toFixed(1)}   act ${s.camp ? s.camp.act : '-'}   seed ${s.seed}` : 'free roam', s ? `km ${fmt(s.kmTotal)}   cool ${Math.round(s.cool)}   events ${s.events}` : '', `view ${window.__view ? (window.__view.state().want3p ? 'third' : 'first') : ''} person   noclip ${F.noclip ? 'on' : 'off'}   walk ${F.walk}×`].filter(Boolean).join('\n');
    } catch (e) { dbg.textContent = 'debug: ' + e.message; }
  }
  requestAnimationFrame(tick);
  setOn(F.on);
  window.__admin = { F, show, close, setOn, skipTo, travel, render: () => render(), get open() { return open; } };
})();
