// ============================================================
//  One street per culture: lot types and sizes follow cityGen in src/game.js
// ============================================================
const RUN = {
  row: { type: 'rowHouse', w: [4.4, 6.4], d: [7, 9], gap: .02 },
  bay: { type: 'shopBay', w: [3, 3.6], d: [4, 4.4], gap: 0 },
  court: { type: 'courtyardHouse', w: [8, 11], d: [8, 10], gap: .1 },
  tower: { type: 'towerHouse', w: [8, 11], d: [8, 10], gap: .1 },
  haveli: { type: 'haveli', w: [8, 11], d: [8, 10], gap: .1 },
  shop: { type: 'shophouse', w: [4, 5.6], d: [5.5, 6.5], gap: .05 },
  sihe: { type: 'siheyuan', w: [12, 15], d: [12, 15], gap: .3 },
  stilt: { type: 'stiltHouse', w: [5.2, 6.2], d: [6.8, 7.6], gap: 1.4 },
  stiltC: { type: 'stiltCompound', w: [9, 11], d: [9.5, 11], gap: 1.0 },
  tibet: { type: 'house', w: [4.5, 6.5], d: [4.5, 6], gap: .6 },
  yurtC: { type: 'yurtCompound', w: [10, 13], d: [10, 12], gap: 1.5 },
  yurt: { type: 'house', w: [5, 6], d: [5, 6], gap: 1.2 },
};
const islamicSides = (CH) => [[['bay', -42, -8], [CH, -6, 42]], [[CH, -42, -14], ['bay', -12, 14], [CH, 16, 42]]];
const CULTURES = [
  { id: 'byz', name: 'Byzantine · Constantinople', cul: 'byz', look: 'byz', hw: 3.6, pave: 'flags', paveT: 0xd6cbb6, ground: 'earth', groundT: 0xb79f80, tree: 'cypress', civic: 'church', sides: [[['row', -46, 42]], [['row', -46, 42]]], lane: true },
  { id: 'levant', name: 'Levant · Acre', cul: 'byz', look: 'levant', hw: 3.4, pave: 'flags', paveT: 0xe0d6c0, ground: 'sand', groundT: 0xd8c6a0, tree: 'date', civic: 'church', sides: [[['row', -46, 42]], [['row', -46, 42]]], lane: true },
  { id: 'armenian', name: 'Armenian · Ani', cul: 'armenian', look: 'armenian', hw: 3.4, pave: 'setts', paveT: 0xb8a898, ground: 'meadow', groundT: 0x9a9a6a, tree: 'broad', civic: 'church', sides: [[['row', -46, 42]], [['row', -46, 42]]], lane: true },
  { id: 'georgian', name: 'Georgian · Tiflis', cul: 'georgian', look: 'georgian', hw: 3.4, pave: 'setts', paveT: 0xb8ac98, ground: 'meadow', groundT: 0x8a9a5a, tree: 'broad', civic: 'church', sides: [[['row', -46, 42]], [['row', -46, 42]]], lane: true },
  { id: 'rum', name: 'Rûm · Konya', cul: 'rum', look: 'rum', hw: 3.2, pave: 'flags', paveT: 0xd2c6ae, ground: 'earth', groundT: 0xb8a07c, tree: 'poplar', civic: 'mosque', sides: islamicSides('court') },
  { id: 'arab', name: 'Arab · Cairo, Damascus', cul: 'arab', look: 'arab', hw: 3.2, pave: 'flags', paveT: 0xdcd0b6, ground: 'sand', groundT: 0xd8c4a0, tree: 'date', civic: 'mosque', sides: islamicSides('court') },
  { id: 'yemen', name: 'Yemen · Sanaa', cul: 'yemen', look: 'yemen', hw: 3.2, pave: 'flags', paveT: 0xc8b89c, ground: 'earth', groundT: 0xa88a68, tree: 'acacia', civic: 'mosque', sides: islamicSides('tower') },
  { id: 'persian', name: 'Persian · Tabriz, Isfahan', cul: 'persian', look: 'persian', hw: 3.2, pave: 'flags', paveT: 0xd2c0a0, ground: 'cracked', groundT: 0xc8a87c, tree: 'poplar', civic: 'mosque', sides: islamicSides('court') },
  { id: 'central', name: 'Central Asian · Samarkand', cul: 'central', look: 'central', hw: 3.2, pave: 'flags', paveT: 0xd2c0a0, ground: 'cracked', groundT: 0xc8aa80, tree: 'poplar', civic: 'mosque', sides: islamicSides('court') },
  { id: 'tarim', name: 'Tarim · Kashgar', cul: 'tarim', look: 'tarim', hw: 3.2, pave: 'flags', paveT: 0xcab894, ground: 'cracked', groundT: 0xc8a878, tree: 'poplar', civic: 'mosque', sides: islamicSides('court') },
  { id: 'steppe', name: 'Steppe · Sarai', cul: 'steppe', look: 'steppe', hw: 3.4, pave: 'earth', paveT: 0xb09a78, ground: 'steppe', groundT: 0xb8a878, tree: 'poplar', civic: 'mosque', sides: [[['bay', -42, -8], ['court', -6, 42]], [['yurt', -42, 0], ['court', 2, 42]]] },
  { id: 'mongol', name: 'Mongol · Karakorum', cul: 'mongol', look: 'mongol', hw: 3.6, pave: 'earth', paveT: 0xa8926e, ground: 'steppe', groundT: 0xa8a070, tree: 'poplar', civic: 'mosque', sides: [[['court', -42, -10], ['yurtC', -8, 42]], [['yurtC', -42, 42]]] },
  { id: 'indian', name: 'Indian · Delhi, Cambay', cul: 'indian', look: 'indian', hw: 3.4, pave: 'flags', paveT: 0xd8c4a4, ground: 'earth', groundT: 0xb89a70, tree: 'banyan', civic: 'hinduTemple', sides: islamicSides('haveli') },
  { id: 'chinese', name: 'Chinese · Khanbaliq', cul: 'chinese', look: 'chinese', hw: 4.5, pave: 'flags', paveT: 0xb8b4a8, ground: 'loess', groundT: 0xc8b088, tree: 'willow', civic: 'temple', sides: [[['shop', -46, 16], ['sihe', 18, 46]], [['shop', -46, 16], ['sihe', 18, 46]]] },
  { id: 'song', name: 'Song · Quinsai', cul: 'song', look: 'song', hw: 4.5, pave: 'flags', paveT: 0xb4b0a6, ground: 'meadow', groundT: 0x8aa060, tree: 'willow', civic: 'temple', sides: [[['shop', -46, 16], ['sihe', 18, 46]], [['shop', -46, 16], ['sihe', 18, 46]]] },
  { id: 'sea', name: 'Southeast Asian · Pagan, Sukhothai', cul: 'sea', look: 'sea', hw: 3.5, pave: 'earth', paveT: 0xb08a68, ground: 'meadow', groundT: 0x7a9a4a, tree: 'coconut', civic: 'wat', sides: [[['stilt', -46, 42]], [['stiltC', -46, 42]]] },
  { id: 'tibet', name: 'Tibetan · Sakya', cul: 'tibet', look: 'tibet', hw: 3.4, pave: 'earth', paveT: 0xa8987c, ground: 'earth', groundT: 0x9a8a6e, tree: 'poplar', civic: 'chorten', sides: [[['tibet', -46, 42]], [['tibet', -46, 42]]] },
];
function makeLots(C) {
  const r = rng32(1272 + C.id.length * 97), lots = [];
  C.sides.forEach((runs, si) => {
    const side = si === 0 ? -1 : 1;
    for (const [key, x0, x1] of runs) {
      const R = RUN[key]; let x = x0;
      while (x < x1) {
        if (C.lane && side === -1 && x > 4 && !lots.lane) { lots.lane = { x0: x, x1: x + 3.2 }; x += 3.2; continue; }
        const w = R.w[0] + r() * (R.w[1] - R.w[0]), d = R.d[0] + r() * (R.d[1] - R.d[0]);
        if (x + w > x1 + 1) break;
        lots.push({ side, x: x + w / 2, w, d, type: R.type, seed: (r() * 1e9) | 0 });
        x += w + R.gap;
      }
    }
  });
  for (const L of lots) { const same = lots.filter(o => o.side === L.side && o !== L); L.openL = !same.some(o => Math.abs(o.x + o.w / 2 - (L.x - L.w / 2)) < .1); L.openR = !same.some(o => Math.abs(o.x - o.w / 2 - (L.x + L.w / 2)) < .1); }
  return lots;
}
const lotFrame = (C, L) => [L.x, 0, L.side * (C.hw + L.d / 2), L.side > 0 ? Math.PI : 0];

// the kit: which builder for which lot
function kitLot(k, C, L) {
  const c = C.cul, look = C.look;
  switch (L.type) {
    case 'rowHouse': return townHouse(k, L, look);
    case 'shopBay': return shopBay(k, L, c);
    case 'courtyardHouse': return courtyardHouse(k, L, c === 'mongol' || c === 'steppe' ? 'central' : c);
    case 'towerHouse': return yemenTower(k, L);
    case 'haveli': return haveli(k, L);
    case 'shophouse': return shophouse(k, L, c);
    case 'siheyuan': return siheyuan(k, L, c);
    case 'stiltHouse': case 'stiltCompound': return stilt(k, L);
    case 'yurtCompound': return yurtCompound(k, L);
    case 'house': return c === 'tibet' ? tibetHouse(k, L) : yurtHouse(k, L);
  }
}
// today: the game's own builders, called as cityGen's place() does
function todayLot(b, C, L) {
  const rng = rng32(L.seed ^ 0x51ed), hh = rng32(L.seed ^ 0x99)();
  b.rng = rng;
  b.setSurf(L.type === 'yurtCompound' ? 'felt' : SURF.houseWall(C.look, () => hh));
  if (L.type === 'house') BLD.house(b, C.cul === 'mongol' ? 'central' : C.cul, rng, 'mock', L.w, L.d);
  else BLD.CB[L.type](b, L.w, L.d, rng, C.cul);
}
