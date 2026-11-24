// The game's SURF, reduced to what src/builders.js needs (buildLayer) plus the wall table.
// buildLayer is copied from src/surfaces.js so "Today" is textured exactly as in the game.
const SURF = (() => {
  const Bn = {}; BUILD_ORDER.forEach((n, i) => { Bn[n] = i; }); const D = true;
  const LIN2S = (x) => Math.pow(Math.max(0, x), 1 / 2.2);
  function buildLayer(r, g, b, ny, wall) {
    if (!D) return 0;
    const R = LIN2S(r), Gc = LIN2S(g), Bc = LIN2S(b); const mx = Math.max(R, Gc, Bc), mn = Math.min(R, Gc, Bc);
    const v = mx, s = mx > 0 ? (mx - mn) / mx : 0; let h = 0;
    if (mx > mn) { if (mx === R) h = ((Gc - Bc) / (mx - mn)) % 6; else if (mx === Gc) h = (Bc - R) / (mx - mn) + 2; else h = (R - Gc) / (mx - mn) + 4; h *= 60; if (h < 0) h += 360; }
    const slope = Math.abs(ny) > 0.12 && Math.abs(ny) < 0.97, flat = Math.abs(ny) >= 0.97;
    const L = (n) => (Bn[n] === undefined ? 0 : Bn[n] + 1);
    if (v < 0.24) return 0;
    if (s > 0.42 && h >= 165 && h < 212 && v > 0.32) return L('glazed');
    if (s > 0.42 && h > 58 && h < 335) return 0;
    if (wall === 'felt') return s < 0.5 && v > 0.55 ? L('felt') : 0;
    if (h < 30 && s > 0.42 && (v >= 0.5 || s > 0.7)) { if (slope) return L('tile'); return s > 0.7 ? L('planks') : L('brick'); }
    if (s < 0.14) {
      if (slope) return v < 0.45 ? L('tileGrey') : 0;
      if (flat) return L(v < 0.4 ? 'slate' : 'ashlar');
      return v < 0.4 ? L('slate') : wall === 'plaster' && v > 0.8 ? L('plaster') : wall === 'brickGrey' ? L('brickGrey') : L('ashlar');
    }
    if (h < 48 && s >= 0.35 && v < 0.6) return slope && (wall === 'ashlar' || wall === 'rubble') ? L('shingles') : L(v < 0.4 ? 'boards' : 'planks');
    if (h >= 32 && h < 55 && s >= 0.33 && s < 0.62 && slope && v >= 0.45 && v < 0.72) return L('thatch');
    if (v >= 0.5) return L(flat && (wall === 'mudbrick' || wall === 'mudwall') ? 'mudwall' : flat && (wall === 'brick' || wall === 'brickGrey') ? 'plaster' : wall || 'plaster');
    return L('rubble');
  }
  const WALL = { levant: 'stoneWarm', byz: 'plaster', armenian: 'ashlar', georgian: 'rubble', rum: 'stoneWarm', arab: 'stoneWarm', yemen: 'stoneWarm',
    persian: 'mudbrick', central: 'mudbrick', tarim: 'mudbrick', chinese: 'mudbrick', song: 'plaster', tibet: 'plaster',
    mongol: 'felt', steppe: 'felt', indian: 'plaster', sea: 'planks' };
  function houseWall(cul, rng) { const w = WALL[cul] || 'plaster'; return w === 'mudbrick' && rng() < 0.5 ? 'mudwall' : w === 'stoneWarm' && rng() < 0.3 ? 'rubble' : w; }
  return { buildLayer, WALL, houseWall };
})();
