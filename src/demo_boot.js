// DEMO ONLY: a title card that drops you straight into Constantinople's new square.
(() => {
  const $ = id => document.getElementById(id);
  const card = document.querySelector('#intro .card'); if (!card) return;
  card.querySelector('.eyebrow').textContent = 'LAYOUT DEMO · NOT THE GAME';
  card.querySelector('h1').textContent = 'Constantinople';
  card.querySelector('.sub').textContent = 'The redesigned town square: walk into the inn, the Venetian Quarter and the blacksmith';
  for (const b of document.querySelectorAll('.modebtn')) if (b.dataset.mode !== 'free') b.style.display = 'none';
  const free = document.querySelector('.modebtn[data-mode="free"]');
  if (free) free.innerHTML = '<b>Enter the square</b><small>Free Roam, starting at the market. M opens the map; nothing here saves to your real game.</small>';
  if ($('startbtn')) $('startbtn').style.display = 'none';

  const H = window.HOOKS; const orig = H.start;
  H.start = mode => {
    if (orig) orig(mode);
    const G = window.__game; if (!G) return;
    G.teleport('constantinople');
    let tries = 0;
    const put = () => {
      const c = G.W.cityById.constantinople; const k = c && c.squareKit;
      if (!k) { if (++tries < 200) setTimeout(put, 150); return; }
      const [x, z] = k.toWorld(36, 0); const p = G.player;
      p.x = x; p.z = z; p.pitch = 0; p.y = G.W.walkHeight(x, z) + 1.7;
      const dx = -Math.cos(k.theta), dz = -Math.sin(k.theta); p.yaw = Math.atan2(-dx, -dz);   // look into the square
    };
    setTimeout(put, 700);
  };
  window.__sqdemo = { goto: (u, v, lookU, lookV) => { const G = window.__game, c = G.W.cityById.constantinople, k = c.squareKit, p = G.player; const [x, z] = k.toWorld(u, v); p.x = x; p.z = z; p.y = G.W.walkHeight(x, z) + 1.7; if (lookU !== undefined) { const [lx, lz] = k.toWorld(lookU, lookV); p.yaw = Math.atan2(-(lx - x), -(lz - z)); } return [x, z]; } };
})();
