// ============================================================
//  v20: HOVER CARDS — goods and cities named anywhere in the game's text
// ============================================================
// Every panel, story card, event, toast, objective and map card is scanned for the names of goods and
// cities. Each name becomes a dotted link: hovering a good shows its card (rarity, market, where it's made,
// where it sells best, the price here, what you carry); hovering a city shows a small map with the road
// from where you are, and what the city is.
(() => {
  const H = window.HOOKS;
  const EXCL = 'button, a, input, select, textarea, script, style, canvas, svg, code, .lk, .lk-card, [data-pg], [data-route], [data-act], .mx-nolk, .mn, .mx-t, .mx-wt, .mx-tabs, #adm, #adm-dbg, .mx-qty';
  let RX = null, LOOK = null;
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const short = c => c.name.replace(/ \(.*\)/, '');
  function build() {
    if (RX || !H.W || typeof GOOD === 'undefined') return !!RX;
    LOOK = new Map(); const add = (name, v) => { const k = name.toLowerCase(); if (k.length < 3 || LOOK.has(k)) return; LOOK.set(k, v); };
    // goods first, so "Damascus steel" beats "Damascus"
    for (const g of Object.values(GOOD)) { if (!g || g.quest || !g.name) continue; add(g.name, 'g:' + g.id); }
    for (const c of H.W.cities) { add(c.name, 'c:' + c.id); add(short(c), 'c:' + c.id); const m = c.name.match(/\(([^)]+)\)/); if (m && m[1].length >= 4 && !/^the /i.test(m[1])) add(m[1], 'c:' + c.id); }
    const keys = [...LOOK.keys()].sort((a, b) => b.length - a.length).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    RX = new RegExp(`(?<![\\p{L}\\p{N}])(${keys.join('|')})(?![\\p{L}\\p{N}])`, 'giu');
    return true;
  }
  // wrap the names in one element's text
  function decorate(root) {
    if (!root || !build()) return;
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => (n.nodeValue.length > 2 && !(n.parentElement && n.parentElement.closest(EXCL))) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT });
    const nodes = []; while (tw.nextNode()) nodes.push(tw.currentNode);
    for (const n of nodes) {
      const t = n.nodeValue; RX.lastIndex = 0; let m, last = 0, frag = null;
      while ((m = RX.exec(t))) {
        const v = LOOK.get(m[1].toLowerCase()); if (!v) continue;
        if (!frag) frag = document.createDocumentFragment();
        if (m.index > last) frag.appendChild(document.createTextNode(t.slice(last, m.index)));
        const sp = document.createElement('span'); sp.className = 'lk lk-' + v[0]; sp.dataset.lk = v; sp.textContent = m[1]; frag.appendChild(sp); last = m.index + m[1].length;
      }
      if (!frag) continue; if (last < t.length) frag.appendChild(document.createTextNode(t.slice(last))); n.parentNode.replaceChild(frag, n);
    }
  }
  H.decorate = decorate;
  // watch the places where text appears
  const watched = new WeakSet(); const pending = new Set(); let raf = 0;
  function queue(el) { pending.add(el); if (!raf) raf = requestAnimationFrame(() => { raf = 0; const els = [...pending]; pending.clear(); for (const e of els) decorate(e); }); }
  function watch(el) { if (!el || watched.has(el)) return; watched.add(el); new MutationObserver(() => queue(el)).observe(el, { childList: true, subtree: true, characterData: true }); queue(el); }
  setInterval(() => { for (const sel of ['.mx-panel', '#mapcard', '.mx-obj', '#t-blurb', '#b-blurb', '#cb-card']) document.querySelectorAll(sel).forEach(watch); }, 700);

  // ---------------- the card ----------------
  const card = document.createElement('div'); card.className = 'lk-card'; document.body.appendChild(card);
  { const st = document.createElement('style'); st.textContent = `
    .lk { pointer-events:auto; cursor:help; border-bottom:1px dotted currentColor; text-decoration:none; }
    .lk:hover { background:rgba(201,164,74,.25); }
    .lk-card { position:fixed; z-index:90; display:none; width:330px; pointer-events:none; background:#f4e8cc; border:2px solid #8a6a3a; box-shadow:0 6px 20px #0008; padding:8px 10px; font:14px/1.35 "EB Garamond", Georgia, serif; color:#2e1e10; }
    .lk-card .lh { display:flex; gap:9px; align-items:center; } .lk-card .lh svg { width:42px; height:42px; flex:none; border:2px solid #b89a62; background:#fbf3df; }
    .lk-card .ln { font:bold 17px/1.15 Cinzel, Georgia, serif; } .lk-card .ls { font-style:italic; opacity:.8; font-size:13px; }
    .lk-card p { margin:5px 0 0; } .lk-card .lr { margin-top:4px; } .lk-card .lr b { font-weight:600; } .lk-card .ld { opacity:.7; font-size:13px; }
    .lk-card canvas { display:block; width:330px; height:170px; margin:6px -10px 0; width:calc(100% + 20px); border-top:1px solid #b89a62; border-bottom:1px solid #b89a62; }
    .lk-card .rar-c { color:#6a5a4a; } .lk-card .rar-u { color:#2e8b3a; } .lk-card .rar-r { color:#2f6fd0; } .lk-card .rar-e { color:#8a3fc0; } .lk-card .rar-l { color:#b8780a; }
    html body .mx-qpins { margin:4px 0 6px; padding:4px 6px; border:1px dashed rgba(122,31,18,.4); background:rgba(255,250,235,.6); }
  `; document.head.appendChild(st); }
  const S = () => (H.J && H.J.MODE === 'journey') ? H.J.S : null;
  function here() { try { return H.J && H.J.nearestCityId ? H.J.nearestCityId() : H.W.nearestCity(H.player.x, H.player.z).c.id; } catch (e) { return null; } }
  function goodCard(id) {
    const g = GOOD[id]; if (!g) return ''; const s = S(); const cid = here();
    const rar = g.rar && typeof RARITY !== 'undefined' ? RARITY[g.rar] : null; const mk = g.m && typeof MARKETS !== 'undefined' ? MARKETS[g.m] : null;
    const size = g.w === 0 ? 'walks beside the caravan' : g.w >= 1 ? 'bulky, 1 load' : g.w >= 0.2 ? 'medium, ¼ load' : 'compact';
    let h = `<div class="lh">${typeof ICONS === 'function' ? ICONS(id, 42) : ''}<div><div class="ln ${g.rar ? 'rar-' + g.rar : ''}">${g.name}</div><div class="ls">${rar ? rar.name : 'Special'}${mk ? ' · ' + mk.name : g.fac ? ' · a merchant house\'s good' : ''} · ${size}</div></div></div>`;
    if (g.blurb) h += `<p>${g.blurb}</p>`;
    const prod = (g.prod || []).filter(c => H.W.cityById[c]).map(c => short(H.W.cityById[c])); if (prod.length) h += `<div class="lr"><b>Made in:</b> ${prod.slice(0, 6).join(', ')}${prod.length > 6 ? '…' : ''}</div>`;
    if (typeof MARKET !== 'undefined' && MARKET.bestMarkets) { const b = MARKET.bestMarkets(id).map(m => MARKETS[m].name); if (b.length) h += `<div class="lr"><b>Sells best in:</b> ${b.join(' and ')}</div>`; }
    if (s && cid && typeof ECON !== 'undefined') { try { const sp = ECON.sellPrice(s, id, cid, s.day), bp = ECON.buyPrice(s, id, cid, s.day); const sells = ECON.offers(cid).includes(id);
      h += `<div class="lr"><b>${short(H.W.cityById[cid])}:</b> ${sells ? `buy at ${sp >= 10 ? fmt(bp) : bp.toFixed(1)}, ` : 'not sold here; '}sells for ${sp >= 10 ? fmt(sp) : sp.toFixed(1)}</div>`; } catch (e) { } }
    if (s && s.cargo[id]) h += `<div class="lr"><b>You carry</b> ${s.cargo[id]}${s.basis[id] ? `, paid about ${s.basis[id] >= 10 ? fmt(s.basis[id]) : s.basis[id].toFixed(1)} each` : ''}</div>`;
    return h;
  }
  function cityCard(id) {
    const c = H.W.cityById[id]; if (!c) return ''; const s = S(); const from = here();
    let h = `<div class="ln">${c.name}</div><div class="ls">${c.polity}${c.modern ? ' · today ' + c.modern : ''}</div><canvas width="660" height="340"></canvas>`;
    if (typeof MARKET !== 'undefined' && MARKETS[MARKET.of(id)]) { const mk = MARKETS[MARKET.of(id)], k = MARKET.kind(id); const makes = MARKET.makes(id).slice(0, 5).map(g => `<span class="${MARKET.rarClass(g)}">${GOOD[g].name}</span>`).join(', ');
      h += `<div class="lr"><b>${mk.name}</b> market · ${MARKET.kindName[k].toLowerCase()} (${MARKET.slotsText[k]})${MARKET.isHub(id) ? ' · market capital' : ''}${MARKET.isSpecialty(id) ? ' · specialty town' : ''}</div>${makes ? `<div class="lr"><b>Makes:</b> ${makes}</div>` : ''}`; }
    if (from && from !== id) { let km = null; try { km = s && H.J ? H.J.distFrom(from)[id] : H.W.shortest(from, id, e => e.km).dist; } catch (e) { }
      if (km != null && isFinite(km)) h += `<div class="lr"><b>From ${short(H.W.cityById[from])}:</b> ${fmt(km * 0.621)} mi by road${s && H.J ? `, about ${Math.ceil(km / H.J.speedKm())} days at your speed` : ''}</div>`; }
    else if (from === id) h += `<div class="lr ld">You are here.</div>`;
    if (s) { const q = H.questPins ? H.questPins().filter(q => q.city === id) : []; for (const x of q) h += `<div class="lr"><span style="color:${x.color}">⚑</span> ${x.text}</div>`; h += `<div class="lr ld">${s.visited.includes(id) ? 'You have been here.' : 'You have not been here yet.'}</div>`; }
    return h;
  }
  function drawCityMap(cv, id) {
    const c = H.W.cityById[id]; const from = here(); const g = cv.getContext('2d'); const Wd = cv.width, Ht = cv.height;
    let L0 = c.lon - 7, L1 = c.lon + 7, A0 = c.lat - 3.6, A1 = c.lat + 3.6; let route = null;
    if (from && from !== id) { try { route = H.W.shortest(from, id, e => e.km); } catch (e) { } const f = H.W.cityById[from]; L0 = Math.min(L0, f.lon - 1.5); L1 = Math.max(L1, f.lon + 1.5); A0 = Math.min(A0, f.lat - 1.2); A1 = Math.max(A1, f.lat + 1.2); }
    const k0 = Math.min(Wd / ((L1 - L0) * 0.85), Ht / (A1 - A0)); const cx = (L0 + L1) / 2, cy = (A0 + A1) / 2;
    const P = (lon, lat) => [Wd / 2 + (lon - cx) * 0.85 * k0, Ht / 2 - (lat - cy) * k0];
    g.fillStyle = '#9db8bb'; g.fillRect(0, 0, Wd, Ht); g.fillStyle = '#eadcb4';
    if (typeof GEO !== 'undefined' && GEO.map) for (const r of GEO.map.land) { g.beginPath(); for (let i = 0; i < r.length; i += 2) { const [px, py] = P(r[i] / 100, r[i + 1] / 100); i ? g.lineTo(px, py) : g.moveTo(px, py); } g.fill(); }
    g.strokeStyle = '#7a5a3a77'; g.lineWidth = 2; for (const e of H.W.edges) { const a = H.W.cityById[e.a], b = H.W.cityById[e.b]; const [ax, ay] = P(a.lon, a.lat), [bx, by] = P(b.lon, b.lat); g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke(); }
    if (route && route.edges) { g.strokeStyle = '#a8301e'; g.lineWidth = 5; g.setLineDash([12, 7]); g.beginPath(); let cur = from; let [x0, y0] = P(H.W.cityById[from].lon, H.W.cityById[from].lat); g.moveTo(x0, y0);
      for (const ei of route.edges) { const e = H.W.edges[ei]; cur = e.a === cur ? e.b : e.a; const cc = H.W.cityById[cur]; const [px, py] = P(cc.lon, cc.lat); g.lineTo(px, py); } g.stroke(); g.setLineDash([]); }
    g.font = '22px Georgia, serif'; g.textAlign = 'center';
    for (const o of H.W.cities) { const [px, py] = P(o.lon, o.lat); if (px < -20 || py < -20 || px > Wd + 20 || py > Ht + 20) continue; const me = o.id === id;
      g.beginPath(); g.arc(px, py, me ? 9 : 4 + o.size, 0, 7); g.fillStyle = me ? '#a8301e' : '#f7efdc'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = '#3d2a18'; g.stroke();
      if (me || o.size >= 3 || o.id === from) { g.lineWidth = 5; g.strokeStyle = '#f4e8cc'; g.font = `${me ? 'bold 26px' : '21px'} Georgia, serif`; g.strokeText(short(o), px, py - 15); g.fillStyle = '#2e1e10'; g.fillText(short(o), px, py - 15); } }
    if (H.player) { const [lon, lat] = H.W.toLL(H.player.x, H.player.z); const [px, py] = P(lon, lat); g.beginPath(); g.arc(px, py, 7, 0, 7); g.fillStyle = '#1e5a8a'; g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2.5; g.stroke(); }
  }
  let cur = null;
  document.addEventListener('mouseover', e => {
    const t = e.target.closest && e.target.closest('.lk'); if (!t) return; if (t === cur) return; cur = t;
    const [k, id] = t.dataset.lk.split(':');
    card.innerHTML = k === 'g' ? goodCard(id) : cityCard(id); if (!card.innerHTML) return;
    const cv = card.querySelector('canvas'); if (cv) drawCityMap(cv, id);
    card.style.display = 'block'; const r = card.getBoundingClientRect(); const x = e.clientX + 18, y = e.clientY + 14;
    card.style.left = Math.max(8, x + r.width > innerWidth - 8 ? e.clientX - r.width - 14 : x) + 'px'; card.style.top = Math.max(8, Math.min(innerHeight - r.height - 8, y)) + 'px';
  });
  document.addEventListener('mouseout', e => { const t = e.target.closest && e.target.closest('.lk'); if (t && !t.contains(e.relatedTarget)) { cur = null; card.style.display = 'none'; } });
  // hide when the panel underneath goes away
  setInterval(() => { if (cur && !document.body.contains(cur)) { cur = null; card.style.display = 'none'; } }, 300);
  window.__lookup = { decorate, build: () => build(), count: () => LOOK ? LOOK.size : 0, goodCard, cityCard };
})();
