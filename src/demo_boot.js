// TEST ONLY: a title card that drops you straight into Constantinople's new square (layout test, 24 Nov 2026).
(() => {
  const $ = id => document.getElementById(id);
  const card = document.querySelector('#intro .card'); if (!card) return;
  card.querySelector('.eyebrow').textContent = 'LAYOUT TEST · NOT THE GAME';
  card.querySelector('h1').textContent = 'Constantinople';
  card.querySelector('.sub').textContent = 'The new town square in every city: the market, the blacksmith, the tavern and the stables, and in cities the Venetian Quarter';
  for (const b of document.querySelectorAll('.modebtn')) if (b.dataset.mode !== 'free') b.style.display = 'none';
  const free = document.querySelector('.modebtn[data-mode="free"]');
  if (free) free.innerHTML = '<b>Enter the square</b><small>Free Roam, starting in Constantinople. Press M and click any city to go there. NPCs are placed but E does nothing yet. Nothing here saves to your real game.</small>';
  if ($('startbtn')) $('startbtn').style.display = 'none';

  const H = window.HOOKS; const orig = H.start;
  H.start = mode => {
    if (orig) orig(mode);
    const G = window.__game; if (!G) return;
    let tries = 0;
    const put = () => {
      const c = G.W.cityById.constantinople;
      if (!G.W.cities.every(q => q.gates)) { if (++tries < 400) setTimeout(put, 150); return; }   // world setup is stepped: teleport only once every gate exists
      if (!c.squareKit) { if (!c._sqTp) { c._sqTp = true; G.teleport('constantinople'); } if (++tries < 400) setTimeout(put, 150); return; }
      const k = c.squareKit;
      if (!put.again) { put.again = true; setTimeout(put, 2500); setTimeout(put, 6000); }   // the teleport settles over a few seconds; place the player again after it
      const [x, z] = k.toWorld(22, 0); const p = G.player;
      p.x = x; p.z = z; p.pitch = 0; p.y = G.W.walkHeight(x, z) + 1.7;
      const dx = -Math.cos(k.theta), dz = -Math.sin(k.theta); p.yaw = Math.atan2(-dx, -dz);   // look into the square
    };
    setTimeout(put, 700);
  };
  window.__sqdemo = { goto: (u, v, lookU, lookV, id) => { const G = window.__game, c = G.W.cityById[id || 'constantinople'], k = c.squareKit, p = G.player; const [x, z] = k.toWorld(u, v); p.x = x; p.z = z; p.y = G.W.walkHeight(x, z) + 1.7; if (lookU !== undefined) { const [lx, lz] = k.toWorld(lookU, lookV); p.yaw = Math.atan2(-(lx - x), -(lz - z)); } return [x, z]; } };
})();
