
// ============================================================
//  ECONOMY: goods, producers, prices, realms, tolls, caravan catalogue
//  (pure data + logic, no DOM — also used by the balance simulator)
// ============================================================
const CURRENCY = 'dirhams';

// w = loads per unit (1 load ≈ what a person can carry on their back).  base = dirhams per unit.
// slope = price rise per 1000 km from the nearest producer.  cap = max multiple of base.
const GOODS = [
  { id:'silk',      name:'Chinese silk',        unit:'bolt',  w:0.5, base:40,  slope:.42, cap:3.6, prod:['quinsai','yangzhou','chengdu','kaifeng','jingzhao','zaitun','fuzhou','ezhou','luoyang','zhending','khanbaliq'], blurb:'The thread that gave the road its name, woven in the workshops of Hangzhou and Sichuan.' },
  { id:'porcelain', name:'Porcelain',           unit:'crate', w:2,   base:30,  slope:.38, cap:3.4, prod:['zaitun','fuzhou','quinsai','kaifeng'], fragile:true, blurb:'Celadon and white wares from the kilns of Fujian and Jiangxi.' },
  { id:'tea',       name:'Brick tea',           unit:'bale',  w:1,   base:8,   slope:.30, cap:2.6, prod:['fuzhou','quinsai','chengdu','ezhou'], blurb:'Pressed tea, prized by Tibetans and steppe nomads.' },
  { id:'lacquer',   name:'Lacquerware',         unit:'crate', w:1,   base:22,  slope:.34, cap:3.0, prod:['quinsai','fuzhou','chengdu'], blurb:'Carved red lacquer boxes and trays.' },
  { id:'ginger',    name:'Ginger',              unit:'sack',  w:1,   base:6,   slope:.32, cap:2.8, prod:['quinsai','fuzhou','zaitun','ezhou'], blurb:'Polo saw great quantities of ginger around Fuzhou.' },
  { id:'rhubarb',   name:'Rhubarb root',        unit:'sack',  w:1,   base:7,   slope:.40, cap:3.0, prod:['jiuquan','xining','zhangye','wuwei'], blurb:'Polo said the finest rhubarb grew in the mountains of Suzhou, sold across the world as medicine.' },
  { id:'musk',      name:'Musk',                unit:'pod',   w:0.1, base:35,  slope:.30, cap:3.0, prod:['xining','lhasa','sakya','ngari'], blurb:'From the musk deer of Tibet. A small pod is worth a fortune.' },
  { id:'jade',      name:'Khotan jade',         unit:'block', w:2,   base:28,  slope:.30, cap:2.8, prod:['khotan','yarkand'], blurb:'White and green jade from the rivers of Khotan, carried east to China for 2,000 years.' },
  { id:'paper',     name:'Samarkand paper',     unit:'ream',  w:1,   base:9,   slope:.28, cap:2.4, prod:['samarkand','bukhara','kaifeng'], blurb:'Samarkand learned papermaking from Chinese prisoners captured in 751.' },
  { id:'carpets',   name:'Turkoman carpets',    unit:'roll',  w:2,   base:22,  slope:.28, cap:2.6, prod:['iconium','caesarea','sivas','tabriz'], blurb:'Polo called the carpets of Konya, Kayseri and Sivas "the finest and handsomest in the world".' },
  { id:'brocade',   name:'Gold brocade',        unit:'bolt',  w:0.5, base:45,  slope:.26, cap:2.6, prod:['tabriz','baghdad','herat'], blurb:'Nasij, cloth of gold woven for Mongol princes at Tabriz and Baghdad.' },
  { id:'muslin',    name:'Mosul muslin',        unit:'bolt',  w:0.5, base:12,  slope:.26, cap:2.4, prod:['mosul','baghdad'], blurb:'Fine cotton cloth that gave Europe the word "muslin".' },
  { id:'glass',     name:'Glassware',           unit:'crate', w:2,   base:18,  slope:.28, cap:3.0, prod:['damascus','aleppo','constantinople'], fragile:true, blurb:'Enamelled glass of Damascus and Aleppo, and Venetian glass shipped through Constantinople.' },
  { id:'blades',    name:'Damascus steel',      unit:'blade', w:0.5, base:40,  slope:.24, cap:2.4, prod:['damascus'], blurb:'Watered-steel swords, envied across Asia.' },
  { id:'rosewater', name:'Rosewater',           unit:'flask', w:0.5, base:10,  slope:.26, cap:2.6, prod:['damascus','isfahan','yazd'], blurb:'Distilled from Damask roses.' },
  { id:'olive',     name:'Olive oil',           unit:'jar',   w:2,   base:5,   slope:.24, cap:2.4, prod:['smyrna','nicaea','aleppo','damascus','sinope'], blurb:'Pressed in the groves of the Aegean and Syria.' },
  { id:'wool',      name:'Flemish woollens',    unit:'bolt',  w:1,   base:18,  slope:.24, cap:2.4, prod:['constantinople','ayas','trebizond'], blurb:'Fine European cloth brought east by Venetian and Genoese ships.' },
  { id:'coral',     name:'Red coral',           unit:'string',w:0.2, base:25,  slope:.34, cap:3.4, prod:['constantinople','ayas','smyrna'], blurb:'Mediterranean coral, worn in Tibet and treasured in China.' },
  { id:'amber',     name:'Baltic amber',        unit:'string',w:0.2, base:22,  slope:.30, cap:3.0, prod:['sarai','constantinople', 'caffa'], blurb:'Brought down the Volga and through the Black Sea ports.' },
  { id:'furs',      name:'Sable furs',          unit:'bundle',w:1,   base:30,  slope:.26, cap:2.6, prod:['sarai','saraichik', 'tana'], blurb:'Furs from the northern forests, traded at the Golden Horde\'s markets.' },
  { id:'wax',       name:'Wax and honey',       unit:'cask',  w:2,   base:6,   slope:.24, cap:2.2, prod:['sarai','saraichik', 'tana'], blurb:'From the forests of the Rus principalities.' },
  { id:'lapis',     name:'Lapis lazuli',        unit:'sack',  w:1,   base:30,  slope:.28, cap:3.0, prod:['badakhshan'], blurb:'The only great source of lapis in the world, ground for ultramarine pigment.' },
  { id:'rubies',    name:'Balas rubies',        unit:'pouch', w:0.1, base:70,  slope:.26, cap:2.8, prod:['badakhshan'], blurb:'Polo said the king of Badakhshan alone could mine them, on pain of death.' },
  { id:'turquoise', name:'Turquoise',           unit:'pouch', w:0.2, base:24,  slope:.28, cap:2.8, prod:['nishapur','kerman'], blurb:'Mined at Nishapur and Kerman.' },
  { id:'saffron',   name:'Saffron',             unit:'pouch', w:0.1, base:30,  slope:.26, cap:2.6, prod:['hamadan','isfahan'], blurb:'Hand-picked crocus stamens from the Iranian plateau.' },
  { id:'pepper',    name:'Indian pepper',       unit:'sack',  w:1,   base:14,  slope:.30, cap:3.0, prod:['hormuz','zaitun'], blurb:'Landed by ships from Malabar at Hormuz and Zaitun.' },
  { id:'incense',   name:'Frankincense',        unit:'sack',  w:1,   base:12,  slope:.28, cap:2.6, prod:['hormuz','baghdad'], blurb:'Resin from southern Arabia, burned in churches, mosques and temples.' },
  { id:'indigo',    name:'Indigo',              unit:'cake',  w:0.5, base:12,  slope:.26, cap:2.6, prod:['hormuz','baghdad'], blurb:'Indian dye, traded up the Gulf.' },
  { id:'dates',     name:'Dates',               unit:'basket',w:2,   base:3,   slope:.26, cap:2.4, prod:['baghdad','hormuz','kerman'], blurb:'From the palm groves of Mesopotamia.' },
  { id:'fruit',     name:'Dried fruit & nuts',  unit:'sack',  w:1,   base:4,   slope:.24, cap:2.4, prod:['isfahan','samarkand','bukhara','kabul','herat','qocho','hami'], blurb:'Apricots, pistachios, almonds and the famous raisins of Turfan.' },
  { id:'wine',      name:'Wine',                unit:'jar',   w:2,   base:6,   slope:.24, cap:2.6, prod:['tiflis','nicaea','smyrna','qocho','caffa'], blurb:'Georgian, Greek and Turfan wines, much loved at the Mongol courts.' },
  { id:'felt',      name:'Felt',                unit:'roll',  w:2,   base:4,   slope:.20, cap:2.0, prod:['sarai','almaliq','shangdu','beshbalik'], blurb:'Pressed wool, used for yurts and saddle blankets.' },
  { id:'rawsilk',   name:'Caspian raw silk',    unit:'bale',  w:0.5, base:16,  slope:.28, cap:2.6, prod:['derbent','baku','rayy','yazd','merv'], blurb:'Polo saw the silk of Ghel (Gilan) by the Caspian, and the silk weavers of Yazd.' },
  { id:'naphtha',   name:'Naphtha',             unit:'jar',   w:2,   base:4,   slope:.24, cap:2.4, prod:['baku'], blurb:'Polo described a spring near Baku gushing oil "good for burning", carried away on camels.' },
  { id:'cotton',    name:'Raw cotton',          unit:'bale',  w:1,   base:4,   slope:.24, cap:2.4, prod:['merv','bukhara','urgench','osh','khujand','kashgar','otrar'], blurb:'Cotton grows in every oasis of Transoxiana and Fergana.' },
  { id:'salammoniac',name:'Sal ammoniac',       unit:'cake',  w:0.5, base:12,  slope:.28, cap:2.6, prod:['kucha','aksu','korla'], blurb:'Collected from volcanic vents in the Tian Shan, used by dyers and doctors. A famous export of Kucha.' },
  { id:'chalcedony',name:'Jasper & chalcedony', unit:'pouch', w:0.3, base:12,  slope:.28, cap:2.6, prod:['cherchen','lop'], blurb:'Polo said the rivers of Cherchen carry jasper and chalcedony, sold in China.' },
  { id:'horsegear', name:'Saddles & bridles',   unit:'set',   w:1,   base:10,  slope:.22, cap:2.2, prod:['taraz','balasagun','almaliq','otrar','sarai'], blurb:'Fine leather tack from the horse peoples of the steppe.' },
  { id:'buckram',   name:'Erzincan buckram',    unit:'bolt',  w:0.5, base:10,  slope:.24, cap:2.4, prod:['erzincan','erzurum'], blurb:'Polo praised the buckram cloth woven at Erzincan.' },
];
const GOOD = Object.fromEntries(GOODS.map(g => [g.id, g]));
// Special: the gift the Polos actually carried to Kublai Khan
const HOLY_OIL = { id:'holyoil', name:'Oil from the Holy Sepulchre', unit:'flask', w:0.1, base:300, special:true, blurb:'Kublai asked the Polos to bring oil from the lamp at Christ\'s tomb in Jerusalem. Pilgrims and merchants sell it at Ayas.' };
GOOD.holyoil = HOLY_OIL;

// Regional demand: extra multiplier when selling in these cultures
const DEMAND = {
  tibet:   { tea:1.7, coral:1.6, silk:1.2, turquoise:1.3, amber:1.3 },
  mongol:  { tea:1.3, silk:1.25, wine:1.4, brocade:1.35, blades:1.2, glass:1.1 },
  chinese: { coral:1.35, amber:1.3, glass:1.3, carpets:1.2, lapis:1.2, rubies:1.15, pepper:1.15, incense:1.15 },
  song:    { coral:1.3, amber:1.25, pepper:1.1, glass:1.2 },
  byz:     { silk:1.15, pepper:1.2, porcelain:1.15, furs:1.15, incense:1.15 },
  arab:    { silk:1.15, porcelain:1.15, musk:1.15, furs:1.1 },
  persian: { silk:1.1, porcelain:1.1, musk:1.15, furs:1.15 },
  tarim:   { tea:1.2, wool:1.15 },
  central: { porcelain:1.1, glass:1.1 },
};

// ---------- realms and tolls ----------
const REALMS = {
  byz:      { name:'Byzantine Empire',    toll:.03,  mongol:false },
  trebizond:{ name:'Empire of Trebizond', toll:.03,  mongol:false },
  rum:      { name:'Sultanate of Rûm',    toll:.03,  mongol:true },
  cilicia:  { name:'Armenian Cilicia',    toll:.02,  mongol:true },
  mamluk:   { name:'Mamluk Sultanate',    toll:.06,  mongol:false },
  ilkhan:   { name:'Ilkhanate',           toll:.03,  mongol:true },
  georgia:  { name:'Kingdom of Georgia',  toll:.02,  mongol:true },
  horde:    { name:'Golden Horde',        toll:.03,  mongol:true },
  chagatai: { name:'Chagatai Khanate',    toll:.04,  mongol:true },
  yuan:     { name:'Yuan dynasty',        toll:.035, mongol:true },
  song:     { name:'Southern Song',       toll:.05,  mongol:false },
  tibet:    { name:'Sakya Tibet',         toll:.02,  mongol:true },
};
function realmOf(c) {
  const p = c.polity;
  if (p.includes('Byzantine')) return 'byz'; if (p.includes('Trebizond')) return 'trebizond';
  if (p.includes('Rûm') || p.includes('Seljuk')) return 'rum'; if (p.includes('Cilicia')) return 'cilicia';
  if (p.includes('Mamluk')) return 'mamluk'; if (p.includes('Georgia')) return 'georgia';
  if (p.includes('Golden Horde')) return 'horde'; if (p.includes('Chagatai')) return 'chagatai';
  if (p.includes('Song')) return 'song'; if (p.includes('Sakya')) return 'tibet';
  if (p.includes('Yuan') || p.includes('Uyghur') || p.includes('Contested')) return 'yuan';
  return 'ilkhan';
}
// cities where a Mongol official (darughachi) can issue a paiza
const PAIZA_CITIES = ['tabriz', 'sarai', 'almaliq', 'khanbaliq', 'shangdu', 'baghdad', 'samarkand'];
// roads impassable to wheeled carts (mountain passes, plank roads, Tibet)
const MOUNTAIN_ROADS = [['osh','kashgar'],['badakhshan','tashkurgan'],['tashkurgan','kashgar'],['kabul','balkh'],['herat','kabul'],['balkh','badakhshan'],
  ['khotan','ngari'],['ngari','sakya'],['sakya','lhasa'],['lhasa','xining'],['jingzhao','chengdu'],['trebizond','erzurum'],['tiflis','ani'],['iconium','ayas']];

// ---------- caravan catalogue ----------
// speed in km/day.  terrain: bonus terrain and the speed there.
const MOUNTS = {
  foot:   { name:'On foot',            cost:0,    speed:22, eye:1.62 },
  donkey: { name:'Riding donkey',      cost:45,   speed:27, eye:2.15, fodder:.6, water:.8, blurb:'Cheap, sure-footed and stubborn.' },
  mule:   { name:'Mule',               cost:90,   speed:29, eye:2.35, fodder:.8, water:.8, mountain:34, blurb:'The best mount in the mountains.' },
  pony:   { name:'Mongol pony',        cost:140,  speed:36, eye:2.4,  fodder:.7, water:.9, steppe:42, blurb:'Small, hardy and tireless on the steppe.' },
  horse:  { name:'Turkoman horse',     cost:260,  speed:40, eye:2.55, fodder:1.2, water:1.4, blurb:'A tall, fast horse of the Anatolian and Persian breeds.' },
  camel:  { name:'Riding camel',       cost:200,  speed:31, eye:2.9,  fodder:.6, water:.25, desert:40, blurb:'Slow on hard roads, unbeatable in the desert.' },
  yak:    { name:'Yak',                cost:110,  speed:25, eye:2.35, fodder:.7, water:.6, tibet:33, blurb:'Lumbering but at home on the high plateau.' },
};
const PACK = {
  donkey: { name:'Pack donkey',        cost:40,  cap:6,  speed:27, fodder:.6, water:.8 },
  mule:   { name:'Pack mule',          cost:80,  cap:9,  speed:29, fodder:.8, water:.8, mountain:34 },
  horse:  { name:'Pack horse',         cost:150, cap:8,  speed:36, fodder:1.1, water:1.3 },
  camel:  { name:'Bactrian camel',     cost:170, cap:16, speed:30, fodder:.6, water:.25, desert:38 },
  yak:    { name:'Pack yak',           cost:90,  cap:10, speed:25, fodder:.7, water:.6, tibet:32 },
};
const VEHICLES = {
  cart:   { name:'Ox cart',            cost:220, cap:30, speed:22, fodder:1.5, water:1.5, blurb:'Holds a great deal but crawls along, and cannot cross mountain passes.' },
  wagon:  { name:'Four-wheeled wagon', cost:520, cap:60, speed:20, fodder:3,   water:3,   blurb:'A wagon and its ox team. Only for good roads.' },
};
const HIRES = {
  guard:       { name:'Guard',            cost:30,  wage:.5, str:3, blurb:'A spearman to protect the caravan.' },
  archer:      { name:'Mongol archer',    cost:80,  wage:.5, str:6, blurb:'A mounted archer, deadly at a distance.' },
  guide:       { name:'Guide',            cost:60,  wage:.5, blurb:'Knows the wells and the shortcuts. Fewer bad events, shorter journeys.' },
  interpreter: { name:'Interpreter',      cost:70,  wage:.5, blurb:'Speaks Persian, Turkic and Mongol. Better prices in every market.' },
  handler:     { name:'Camel driver',     cost:25,  wage:.5, blurb:'Each driver can handle six more animals.' },
};
const ARMS = {
  dagger: { name:'Dagger',              cost:12,  str:1, slot:'weapon' },
  sword:  { name:'Sword',               cost:70,  str:3, slot:'weapon' },
  bow:    { name:'Composite bow',       cost:110, str:4, slot:'weapon' },
  mail:   { name:'Lamellar armour',     cost:160, str:3, slot:'armour' },
};
const UPGRADES = {
  bags:   { name:'Saddlebags',          cost:25,  cap:3, max:1, blurb:'Extra room for a few more goods.' },
  dog:    { name:'Tibetan mastiff',     cost:60,  str:2, max:2, only:['tibet'], blurb:'Polo wrote these dogs were as big as donkeys.' },
  guardArms:{ name:'Arm your guards with bows', cost:20, perGuard:true, max:1, blurb:'+2 strength for every guard.' },
};
const PAIZA = { name:'Silver paiza', cost:1500, rep:30, blurb:'A silver tablet of safe-conduct from the Khan. Halves tolls and deters bandits in Mongol lands, and opens the post stations of the yam.' };

// supplies: units are rations / feeds / skins, 10 per load
const SUPPLY = { food:{ name:'Food', w:.1, base:1 }, fodder:{ name:'Fodder', w:.1, base:.6 }, water:{ name:'Water', w:.1, base:.15 } };
const ARID = ['sand', 'gobi', 'flaming', 'mesopotamia', 'iran'];

// ---------- price engine ----------
const ECON = (() => {
  const E = {};
  let cities = [], byId = {}, adj = {};
  function hav(a, b) { const R = 6371, r = Math.PI / 180; const dLat = (b[1] - a[1]) * r, dLon = (b[0] - a[0]) * r; const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLon / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); }
  E.init = function (cityList, edgeList) {
    cities = cityList; byId = Object.fromEntries(cities.map(c => [c.id, c])); adj = {}; for (const c of cities) adj[c.id] = [];
    for (const e of edgeList) {
      const A = byId[e[0]], B = byId[e[1]]; const ll = [[A.lon, A.lat], ...e[3], [B.lon, B.lat]]; let km = 0; for (let i = 1; i < ll.length; i++) km += hav(ll[i - 1], ll[i]); km = Math.round(km * 1.12 / 10) * 10;
      adj[A.id].push([B.id, km]); adj[B.id].push([A.id, km]);
    }
    E.dist = {};
    for (const g of Object.values(GOOD)) if (g.prod) E.dist[g.id] = multiDijkstra(g.prod);
    E.realm = Object.fromEntries(cities.map(c => [c.id, realmOf(c)]));
  };
  function multiDijkstra(src) {
    const d = {}; for (const c of cities) d[c.id] = Infinity; const q = [];
    for (const s of src) if (byId[s]) { d[s] = 0; q.push(s); }
    const done = {};
    while (true) { let u = null, b = Infinity; for (const c of cities) if (!done[c.id] && d[c.id] < b) { b = d[c.id]; u = c.id; } if (!u) break; done[u] = true; for (const [v, km] of adj[u]) if (d[u] + km < d[v]) d[v] = d[u] + km; }
    return d;
  }
  E.adj = () => adj;
  function hash(a, b, c) { let h = 2166136261; for (const s of [a, b, String(c), String(E.seed || 0)]) for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }
  // drift: slow random swings of ±12%, changing every ~45 days with smooth interpolation
  function drift(cid, gid, day) { const t = day / 45; const k = Math.floor(t), f = t - k; const a = hash(cid, gid, k), b = hash(cid, gid, k + 1); const s = f * f * (3 - 2 * f); return 0.88 + 0.24 * (a + (b - a) * s); }
  E.tierOf = c => (typeof CITY_TIER !== 'undefined' && CITY_TIER[c.id]) || 1;
  E.mid = function (gid, cid, day) {
    const g = GOOD[gid], c = byId[cid];
    if (g.special) return g.base;
    const d = E.dist[gid][cid]; const isProd = d === 0;
    let m = isProd ? 0.55 : Math.min(g.cap, 0.62 + g.slope * d / 1000);
    const dem = DEMAND[c.culture === 'steppe' ? 'mongol' : c.culture]; if (dem && dem[gid] && !isProd) m *= dem[gid];
    const cdm = typeof CITY_DEMAND !== 'undefined' && CITY_DEMAND[cid]; if (cdm && cdm[gid] && !isProd) m *= cdm[gid];
    m *= 1 + 0.04 * (E.tierOf(c) - 2);
    return g.base * m * drift(cid, gid, day);
  };
  // market saturation: state.sat[cid][gid] = net units the player sold (negative = bought), decays over time
  E.elast = (gid, cid) => { const g = GOOD[gid]; return (30 + E.tierOf(byId[cid]) * 22) / Math.max(0.4, g.w); };
  E.satMul = (state, gid, cid) => { const s = (state.sat[cid] && state.sat[cid][gid]) || 0; return Math.exp(-s / E.elast(gid, cid)); };
  // v15: reputation earns better rates, up to 8% off when buying and 8% more when selling at reputation 100
  E.repBonus = state => Math.max(0, Math.min(100, (state && state.rep) || 0)) / 100 * 0.08;
  E.buyPrice = (state, gid, cid, day) => E.mid(gid, cid, day) * 1.06 * E.satMul(state, gid, cid) * (state.hires && state.hires.interpreter ? 0.96 : 1) * (1 - E.repBonus(state));
  E.sellPrice = (state, gid, cid, day) => E.mid(gid, cid, day) * 0.94 * E.satMul(state, gid, cid) * (state.hires && state.hires.interpreter ? 1.05 : 1) * (1 + E.repBonus(state));
  E.decaySat = (state, days) => { const k = Math.pow(0.96, days); for (const c in state.sat) for (const g in state.sat[c]) { state.sat[c][g] *= k; if (Math.abs(state.sat[c][g]) < 0.05) delete state.sat[c][g]; } };
  // goods offered for sale in a city: produced there, or within easy reach of a producer
  E.offers = function (cid) {
    const c = byId[cid]; const out = [];
    for (const g of GOODS) { const d = E.dist[g.id][cid]; if (d === 0 || d <= 700) out.push(g.id); }
    if (cid === 'ayas' || cid === 'jerusalem' || cid === 'acre') out.push('holyoil');
    return out;
  };
  E.stockMax = (gid, cid) => { const g = GOOD[gid]; if (g.special) return 1; const t = E.tierOf(byId[cid]); const d = E.dist[gid][cid]; return Math.round((10 + t * 8) * (d === 0 ? 1 : 0.45) / Math.max(0.3, g.w)); };
  E.supplyPrice = function (kind, cid) {
    const c = byId[cid]; const b = SUPPLY[kind].base;
    const desert = ['lop', 'cherchen', 'dunhuang', 'hami', 'hormuz', 'tashkurgan', 'ngari', 'badakhshan'].includes(cid);
    const rich = typeof VILLAGE_DENSITY !== 'undefined' ? 0 : 0;
    let m = desert ? 1.8 : c.culture === 'tibet' ? 1.6 : 1;
    if (kind === 'water') m = desert ? 2.5 : 1;
    return +(b * m * (1 + 0.03 * (E.tierOf(c) - 2))).toFixed(2);
  };
  E.realmOf = cid => E.realm[cid];
  E.byId = () => byId;
  return E;
})();

// ---------- speed upgrades (v6): expensive, some only in particular places ----------
const BASE_SPEED = 20; // km per day for a laden caravan on foot
const SPEED_UPS = {
  saddles:  { name:'Fitted pack saddles',        cost:150,  bonus:.12, blurb:'Well-fitted saddles let the animals walk further each day without sores.' },
  farrier:  { name:'Iron horseshoes',            cost:350,  bonus:.12, minTier:2, blurb:'A farrier shoes your animals in iron, so they keep their pace on stony roads.' },
  wheels:   { name:'Iron-rimmed wheels',         cost:450,  wheel:8, minTier:2, cultures:['byz','rum','persian','arab','central','chinese','song','mongol','armenian','georgian'], blurb:'Carts and wagons roll 5 miles a day faster.' },
  master:   { name:'Experienced caravan master', cost:500,  bonus:.15, wage:2.5, rep:25, minTier:3, blurb:'A veteran caravan bashi who knows every halt and every well. Paid 2.5 a day.' },
  camels:   { slot:'breed', name:'Bactrian racing stock', cost:900,  bonus:.25, cities:['bukhara','samarkand','merv','kashgar','khotan','hami','dunhuang','urgench'], blurb:'Trade your plodding beasts for long-legged camels bred for speed.' },
  ferghana: { slot:'breed', name:'Ferghana "heavenly horses"', cost:1600, bonus:.35, rep:20, cities:['osh','khujand'], blurb:'The legendary "blood-sweating" horses that Han emperors went to war to obtain.' },
  arabian:  { slot:'breed', name:'Arabian horses',       cost:1600, bonus:.35, rep:20, cities:['hormuz','baghdad','damascus','aleppo'], blurb:'Swift Arab horses, the most precious export of the Gulf ports.' },
  bucephalus:{ slot:'breed', name:'Horses of Bucephalus\'s line', cost:0, bonus:.3, hidden:true, blurb:'Descended, so they say, from Alexander\'s own horse.' },
};
const VEHICLE_SPEED = { cart: 18, wagon: 16 };

// broad regions, for the goods guide
function regionOf(c) {
  const k = c.culture, lon = c.lon;
  if (k === 'byz') return lon < 31 ? 'Constantinople & the Aegean' : 'the Black Sea coast';
  if (k === 'rum' || k === 'armenian') return lon > 36.5 && c.lat < 37 ? 'Cilicia' : 'Anatolia';
  if (k === 'georgian') return 'the Caucasus';
  if (k === 'arab') return lon > 41 ? 'Mesopotamia' : 'Syria';
  if (k === 'persian') return lon > 60 ? 'Khorasan & Afghanistan' : (c.lat > 39 ? 'the Caucasus' : 'Persia');
  if (k === 'central') return 'Central Asia';
  if (k === 'mongol' || k === 'steppe') return lon > 100 ? 'Mongolia' : 'the steppe';
  if (k === 'tarim') return lon > 92 ? 'the Gansu corridor' : 'the Tarim Basin';
  if (k === 'tibet') return 'Tibet';
  if (k === 'song') return 'South China';
  if (k === 'chinese') return c.lat < 33 ? 'South China' : 'North China';
  return 'the East';
}
const GOOD_GUIDE = {};
function goodGuide(gid) {
  if (GOOD_GUIDE[gid]) return GOOD_GUIDE[gid];
  const g = GOOD[gid]; const byId = ECON.byId();
  if (g.special) return GOOD_GUIDE[gid] = { made: gid === 'holyoil' ? 'Jerusalem (sold at Jerusalem, Acre and Ayas)' : 'Maragheh', best: gid === 'holyoil' ? 'priceless at the Khan\'s court' : 'deliver to Samarkand', bestCities: [] };
  const made = [...new Set(g.prod.filter(p => byId[p]).map(p => regionOf(byId[p])))];
  const scored = Object.values(byId).map(c => [ECON.mid(gid, c.id, 0) / g.base, c]).sort((a, b) => b[0] - a[0]);
  const regions = []; const cities = [];
  for (const [m, c] of scored) { const r = regionOf(c); if (!regions.includes(r)) regions.push(r); if (cities.length < 3) cities.push(c.name.replace(/ \(.*\)/, '')); if (regions.length >= 3) break; }
  return GOOD_GUIDE[gid] = { made: made.slice(0, 3).join(', '), best: regions.join(', '), bestCities: cities, mult: scored[0][0] / 0.55 };
}

// ============================================================
//  BUILD 2 economy: Egypt, Arabia, India, Indochina & Yunnan
// ============================================================
(function () {
  const NEW = [
    { id:'cottoncloth', name:'Gujarati cotton cloth', unit:'bolt', w:0.5, base:9,  slope:.30, cap:2.8, prod:['cambay','anhilwara','devagiri'], blurb:'Printed and dyed cottons from Gujarat, the cloth that clothed half the Indian Ocean.' },
    { id:'pearls',    name:'Pearls of Mannar',    unit:'pouch', w:0.1, base:60, slope:.30, cap:3.0, prod:['kayal','madurai'], blurb:'Polo watched divers bring up pearls off the Pandya coast, and saw the king wear 104 of them on a single cord.' },
    { id:'cinnamon',  name:'Cinnamon',            unit:'bundle',w:0.5, base:14, slope:.32, cap:3.0, prod:['kayal','madurai','thanjavur'], blurb:'Bark from Sri Lanka and the far south, landed in the Pandya ports.' },
    { id:'spices',    name:'Cloves & nutmeg',     unit:'pouch', w:0.3, base:28, slope:.36, cap:3.6, prod:['kedah','tambralinga'], blurb:'From the Spice Islands far to the east, traded through the ports of the Malay peninsula.' },
    { id:'sandalwood',name:'Sandalwood',          unit:'log',   w:1,   base:16, slope:.30, cap:2.8, prod:['dvarasamudra','kanchipuram'], blurb:'Fragrant wood from the hills of the Hoysala country, burned in temples from Cairo to Quinsai.' },
    { id:'ivory',     name:'Ivory',               unit:'tusk',  w:1,   base:30, slope:.30, cap:2.8, prod:['pagan','angkor','vijaya'], blurb:'Elephant tusks from the forests of Burma and Cambodia, carved in China into fans and seals.' },
    { id:'aloeswood', name:'Aloeswood (agar)',    unit:'pouch', w:0.3, base:40, slope:.32, cap:3.2, prod:['angkor','vijaya','lavo'], blurb:'Resin-soaked heartwood worth more than its weight in silver. Champa\'s is said to be the best.' },
    { id:'tin',       name:'Malay tin',           unit:'ingot', w:2,   base:8,  slope:.26, cap:2.4, prod:['kedah','tambralinga'], blurb:'Tin from the river gravels of the peninsula, alloyed into bronze across Asia.' },
    { id:'sugar',     name:'Cane sugar',          unit:'loaf',  w:1,   base:6,  slope:.26, cap:2.6, prod:['cairo','qus','lakhnauti','guangzhou'], blurb:'Egyptian sugar refined in the mills of Fustat, and the raw sugar of Bengal.' },
    { id:'linen',     name:'Egyptian linen',      unit:'bolt',  w:0.5, base:10, slope:.26, cap:2.4, prod:['alexandria','cairo','qus'], blurb:'Fine flax cloth of the Delta, prized since the pharaohs.' },
    { id:'balsam',    name:'Balsam of Matariya',  unit:'phial', w:0.1, base:45, slope:.30, cap:3.0, prod:['cairo'], blurb:'Grown only in one walled garden near Cairo. Christians believe the Holy Family rested there. Sultans send it as royal gifts.' },
    { id:'emeralds',  name:'Egyptian emeralds',   unit:'pouch', w:0.1, base:55, slope:.28, cap:2.8, prod:['aswan'], blurb:'From the ancient mines of the Eastern Desert, worked since Ptolemaic times.' },
    { id:'betel',     name:'Areca & betel',       unit:'basket',w:1,   base:3,  slope:.26, cap:2.4, prod:['chittagong','sonargaon','pegu','martaban','thanglong'], blurb:'Chewed everywhere from Bengal to Vietnam, staining lips and teeth red.' },
    { id:'carnelian', name:'Yemeni carnelian',    unit:'pouch', w:0.2, base:20, slope:.28, cap:2.8, prod:['sanaa','taizz'], blurb:'Red agate (ʿaqīq) from the mines near Sanaa, carved into seals and rings.' },
    { id:'golddust',  name:'Gold dust',           unit:'pouch', w:0.1, base:65, slope:.24, cap:2.4, prod:['yongchang','bhamo','dali'], blurb:'Polo said the people of Zardandan covered their teeth in gold and paid for everything with it.' },
    { id:'salt',      name:'Salt cakes',          unit:'cake',  w:1,   base:3,  slope:.30, cap:3.0, prod:['jianchang','najran','faid','aswan','caffa'], blurb:'In Caindu, Polo saw salt cakes stamped with the ruler\'s seal used as money.' },
    { id:'pashmina',  name:'Changthang wool',     unit:'bale',  w:0.5, base:14, slope:.30, cap:2.8, prod:['ngari','sakya'], blurb:'The fine underwool of Tibetan highland goats, carried down to the weavers of Kashmir and Persia.' },
    { id:'cowries',   name:'Cowrie shells',       unit:'string',w:0.3, base:5,  slope:.30, cap:3.0, prod:['lakhnauti','sonargaon'], blurb:'Shells from the Maldives, used as small change in Bengal, and as money in Yunnan, Polo noted.' },
  ];
  for (const g of NEW) { GOODS.push(g); GOOD[g.id] = g; }
  const addProd = (id, cs) => { for (const c of cs) if (!GOOD[id].prod.includes(c)) GOOD[id].prod.push(c); };
  addProd('incense', ['zafar', 'shihr', 'aden']); addProd('pepper', ['cambay', 'kayal', 'thana']); addProd('indigo', ['anhilwara', 'cambay', 'multan']);
  addProd('rubies', ['pagan']); addProd('muslin', ['sonargaon', 'lakhnauti']); addProd('dates', ['medina', 'khaybar', 'ula', 'qus']); addProd('lacquer', ['pagan']);
  addProd('tea', ['yachi', 'dali']); addProd('silk', ['guangzhou', 'tanzhou']); addProd('porcelain', ['guangzhou']); addProd('ginger', ['guangzhou', 'thanglong']);
  addProd('glass', ['alexandria', 'cairo']); addProd('rosewater', ['taif']); addProd('olive', ['acre', 'jerusalem']); addProd('wool', ['acre', 'alexandria']);
  addProd('coral', ['alexandria', 'acre']); addProd('cotton', ['multan', 'cambay']); addProd('fruit', ['taif', 'kandahar']);
  addProd('rawsilk', ['samarkand', 'khujand', 'khotan', 'kashgar']); addProd('horsegear', ['zhangye', 'wuwei', 'kashgar']); addProd('carpets', ['bukhara', 'khotan', 'kashgar']); addProd('paper', ['khotan', 'qocho']); addProd('glass', ['tabriz']);
  addProd('indigo', ['mathura', 'delhi']); addProd('sugar', ['kanauj', 'delhi']); addProd('rosewater', ['kanauj']); addProd('brocade', ['delhi']); addProd('cottoncloth', ['varanasi', 'aden']);
  addProd('pepper', ['aden']); addProd('dates', ['faid']); addProd('lacquer', ['thanglong']); addProd('musk', ['dali']); addProd('horsegear', ['lahore', 'multan']);
  GOOD.muslin.name = 'Muslin'; GOOD.muslin.blurb = 'Fine cotton cloth: the muslin of Mosul gave Europe the word, but the finest of all is woven in Bengal.';
  GOOD.pepper.blurb = 'Black pepper from the Malabar coast, landed at Cambay, Kayal and Thana, and shipped on to Hormuz and Zaitun.';
  GOOD.incense.blurb = 'Resin from the frankincense trees of Dhofar and the Hadramawt, burned in churches, mosques and temples.';

  Object.assign(DEMAND, {
    arab:   Object.assign(DEMAND.arab || {}, { pepper:1.25, spices:1.3, cinnamon:1.25, pearls:1.2, sandalwood:1.2, aloeswood:1.2 }),
    yemen:  { cottoncloth:1.25, pepper:1.15, silk:1.2, porcelain:1.25, linen:1.15, sugar:1.15 },
    indian: { coral:1.35, horsegear:1.3, rosewater:1.25, glass:1.2, incense:1.2, silk:1.25, porcelain:1.2, wool:1.15, dates:1.2 },
    sea:    { cottoncloth:1.35, porcelain:1.3, silk:1.25, glass:1.25, coral:1.2, pearls:1.15 },
  });
  for (const k of ['chinese', 'song']) Object.assign(DEMAND[k], { ivory:1.35, aloeswood:1.3, spices:1.25, pearls:1.25, sandalwood:1.2, tin:1.15 });
  Object.assign(DEMAND.mongol, { pearls:1.4, ivory:1.2 });
  Object.assign(DEMAND.byz, { spices:1.3, cinnamon:1.25, balsam:1.3, sugar:1.2 });

  Object.assign(REALMS, {
    crusader: { name:'Kingdom of Jerusalem',  toll:.04,  mongol:false },
    hejaz:    { name:'Sharifate of the Hejaz', toll:.03, mongol:false },
    bedouin:  { name:'Bedouin tribes',        toll:.02,  mongol:false },
    rasulid:  { name:'Rasulid Sultanate',     toll:.05,  mongol:false },
    hadramawt:{ name:'Hadramawt',             toll:.03,  mongol:false },
    dhofar:   { name:'Dhofar',                toll:.03,  mongol:false },
    delhi:    { name:'Delhi Sultanate',       toll:.05,  mongol:false },
    mewar:    { name:'Mewar',                 toll:.03,  mongol:false },
    gujarat:  { name:'Vaghela Gujarat',       toll:.04,  mongol:false },
    yadava:   { name:'Yadava kingdom',        toll:.04,  mongol:false },
    hoysala:  { name:'Hoysala kingdom',       toll:.03,  mongol:false },
    pandya:   { name:'Pandya kingdom',        toll:.04,  mongol:false },
    bengal:   { name:'Bengal',                toll:.04,  mongol:false },
    deva:     { name:'Deva kingdom',          toll:.03,  mongol:false },
    nepal:    { name:'Nepal',                 toll:.02,  mongol:false },
    pagan:    { name:'Pagan Kingdom',         toll:.04,  mongol:false },
    sukhothai:{ name:'Sukhothai',             toll:.02,  mongol:false },
    lavo:     { name:'Lavo',                  toll:.03,  mongol:false },
    khmer:    { name:'Khmer Empire',          toll:.04,  mongol:false },
    champa:   { name:'Champa',                toll:.03,  mongol:false },
    tambralinga:{ name:'Tambralinga',         toll:.03,  mongol:false },
    srivijaya:{ name:'Srivijaya',             toll:.03,  mongol:false },
    daiviet:  { name:'Đại Việt',              toll:.04,  mongol:false },
  });
  const realmOf0 = realmOf;
  realmOf = function (c) {
    const p = c.polity;
    if (p.includes('Kingdom of Jerusalem')) return 'crusader'; if (p.includes('Hejaz')) return 'hejaz'; if (p.includes('Bedouin')) return 'bedouin';
    if (p.includes('Rasulid')) return 'rasulid'; if (p.includes('Hadramawt')) return 'hadramawt'; if (p.includes('Dhofar')) return 'dhofar';
    if (p.includes('Bengal (Delhi')) return 'bengal'; if (p.includes('Deva kingdom')) return 'deva'; if (p.includes('Delhi')) return 'delhi';
    if (p.includes('Mewar')) return 'mewar'; if (p.includes('Vaghela')) return 'gujarat'; if (p.includes('Yadava')) return 'yadava'; if (p.includes('Hoysala')) return 'hoysala';
    if (p.includes('Pandya')) return 'pandya'; if (p.includes('Nepal')) return 'nepal'; if (p.includes('Pagan')) return 'pagan'; if (p.includes('Sukhothai')) return 'sukhothai';
    if (p.includes('Lavo')) return 'lavo'; if (p.includes('Khmer')) return 'khmer'; if (p.includes('Champa')) return 'champa'; if (p.includes('Tambralinga')) return 'tambralinga';
    if (p.includes('Srivijaya')) return 'srivijaya'; if (p.includes('Đại Việt')) return 'daiviet';
    return realmOf0(c);
  };
  MOUNTAIN_ROADS.push(['kandahar', 'multan'], ['bihar', 'kathmandu'], ['kathmandu', 'sakya'], ['chittagong', 'pagan'], ['dali', 'yongchang'], ['yongchang', 'bhamo'],
    ['chengdu', 'jianchang'], ['jianchang', 'yachi'], ['martaban', 'sukhothai'], ['angkor', 'vijaya'], ['najran', 'sanaa'], ['sanaa', 'taizz'], ['thana', 'devagiri'], ['karak', 'ayla'], ['yachi', 'thanglong']);
  ARID.push('nafud', 'hejaz', 'thar');
  PAIZA_CITIES.push('chengdu');
  // Arabian horses are sold in their homeland too
  SPEED_UPS.arabian.cities.push('aden', 'shihr', 'zafar', 'cairo');
  SPEED_UPS.arabian.blurb = 'Swift Arab horses, the most precious export of Aden, Zafar and the Gulf ports. Indian kings buy thousands a year.';
  // elephants: slow, enormous loads, India & Southeast Asia
  PACK.elephant = { name:'Elephant', cost:420, cap:30, speed:24, fodder:2.4, water:2.0, blurb:'A working elephant with its mahout. Carries five camel-loads and walks through the jungle.' };

  const regionOf0 = regionOf;
  regionOf = function (c) {
    const k = c.culture, lon = c.lon, lat = c.lat;
    if (k === 'arab' && lon < 34.3 && lat < 31.6) return 'Egypt';
    if (k === 'arab' && lat < 30 && lon > 34.5) return 'Arabia';
    if (k === 'arab' && lon < 36.5 && lat < 33.5) return 'Palestine';
    if (c.id === 'acre') return 'Palestine';
    if (k === 'yemen') return lon > 47 ? 'the Hadramawt & Dhofar' : 'Yemen';
    if (k === 'indian') return lon > 87 ? 'Bengal' : lat < 16 ? 'South India' : lat < 22.5 ? 'the Deccan' : lon < 76 ? (lat > 29 ? 'the Punjab' : 'Gujarat & Rajputana') : lat > 27 && lon > 84 ? 'Nepal' : 'Hindustan';
    if (k === 'sea') return lon < 98.5 ? 'Burma' : lat < 10 ? 'the Malay peninsula' : lon > 106 ? 'Champa' : lon > 102 ? 'Cambodia' : 'Siam';
    if (k === 'chinese' && lat < 29 && lon < 104) return 'Yunnan';
    if (c.id === 'thanglong') return 'Đại Việt';
    if (k === 'persian' && lat < 32.5 && lon > 60) return 'Sistan & Kandahar';
    return regionOf0(c);
  };
})();

// ============================================================
//  BUILD 3: playable characters (fictional, modelled on real people of the 1270s)
// ============================================================
GOOD.letter = { id: 'letter', name: 'The Sultan\'s letter', unit: 'letter', w: 0.1, base: 0, special: true, quest: true, blurb: 'Sultan Baybars\' letter to Möngke-Temür, Khan of the Golden Horde, sealed in gold: an alliance against the Ilkhans.' };

const CHARACTERS = {
  venetian: {
    name: 'Matteo Corner', title: 'Venetian merchant', place: 'Constantinople', start: 'constantinople', faith: 'christian', difficulty: 1,
    basedOn: 'Niccolò, Maffeo and Marco Polo, who set out for Kublai\'s court in 1271.',
    story: 'A young merchant of the Venetian quarter by the Golden Horn. Your uncle traded with the Polos, and their tales of the Great Khan\'s court have filled your head for years. Now you go east yourself.',
    coins: 300, food: 20, water: 6, rep: 10, pack: {}, hires: {},
    ability: { name: 'Venetian privileges', text: 'Letters of credit from your family\'s bank and the trade privileges of the Serenissima: you pay only half the usual tolls when you cross into a new realm.' },
    goal: { type: 'audience', short: 'Win an audience with Kublai Khan', text: 'Reach the palace of the Great Khan at Khanbaliq or Shangdu with a fortune, a worthy gift and a good name.' },
    portrait: { skin: '#e2b48e', robe: '#7a2a3a', robe2: '#c8a03a', hat: 'beretta', hatC: '#a8302a', hair: '#4a2e1a', beard: 'short', bg: '#3a5a7a' },
  },
  monk: {
    name: 'Rabban Yosip', title: 'Nestorian monk', place: 'Khanbaliq', start: 'khanbaliq', faith: 'christian', difficulty: 3,
    basedOn: 'Rabban Sauma, an Önggüt monk born near Khanbaliq, who set out for Jerusalem in about 1275 and ended up as an envoy to the Pope and the kings of Europe.',
    story: 'An Önggüt Turk raised in the Church of the East outside the Khan\'s capital. You have given up your family\'s wealth to see the tomb of Christ in Jerusalem before you die.',
    fodder: 10, coins: 120, food: 20, water: 8, rep: 25, pack: { donkey: 1 }, hires: {},
    ability: { name: 'Shelter of the churches', text: 'The Church of the East has communities from China to Baghdad. In any city with Christians, the brethren give you food and water for the road (once a month per city).' },
    goal: { type: 'reach', cities: ['jerusalem'], short: 'Pray at the Holy Sepulchre', text: 'Make the pilgrimage overland from Khanbaliq to Jerusalem, nearly the whole length of the Silk Road, with little money.' },
    portrait: { skin: '#d8a678', robe: '#22202a', robe2: '#3a3442', hat: 'cowl', hatC: '#22202a', hair: '#1a1410', beard: 'long', bg: '#6a4a2a', cross: true },
  },
  zaitun: {
    name: 'Pu Haiyuan', title: 'Muslim merchant of Zaitun', place: 'Zaitun', start: 'zaitun', faith: 'muslim', difficulty: 2,
    basedOn: 'Pu Shougeng, the Muslim superintendent of Zaitun\'s maritime trade, whose family came from the Arab or Persian merchant world.',
    story: 'Your family came from the West generations ago and grew rich in Zaitun\'s foreign quarter. The sea lanes are closing as the Mongols advance, and your father\'s dying wish was that one of his sons make the Hajj.',
    fodder: 12, coins: 500, food: 20, water: 6, rep: 15, pack: { mule: 1 }, hires: {},
    ability: { name: 'The merchant brotherhood', text: 'Muslim merchants trade with one of their own on better terms: 5% better prices when you buy and sell in Muslim cities and the Muslim quarters of Chinese ports.' },
    goal: { type: 'hajj', city: 'mecca', worth: 4000, short: 'Make the Hajj to Mecca', text: 'Cross Asia overland and reach Mecca with a fortune of at least 4,000 dirhams to give in charity, as a great merchant should.' },
    portrait: { skin: '#d2a07a', robe: '#2a5a6a', robe2: '#e8e0cc', hat: 'turban', hatC: '#f0ece0', hair: '#1a1410', beard: 'short', bg: '#2a6a5a' },
  },
  engineer: {
    name: 'Ismāʿīl of Hilla', title: 'Siege engineer of the Ilkhan', place: 'Tabriz', start: 'tabriz', faith: 'muslim', difficulty: 3,
    basedOn: 'Ismāʿīl and ʿAlā al-Dīn, the Muslim engineers whom the Ilkhan Abaqa sent to Kublai in 1271–72. Their counterweight trebuchets broke Xiangyang in 1273.',
    story: 'Kublai has asked his nephew the Ilkhan for engineers who can build the great Muslim trebuchets. The Song fortress of Xiangyang has held out for five years. You must reach it before the Khan loses patience.',
    fodder: 15, coins: 380, food: 25, water: 10, rep: 20, pack: { horse: 1 }, hires: { guard: 1 }, paiza: true,
    ability: { name: 'Envoy of the Ilkhan', text: 'You carry a paiza from the start (halved tolls and safe passage in Mongol lands, fresh horses at the yam stations), and your skill in war gives your caravan +3 strength.' },
    goal: { type: 'deadline', city: 'xiangyang', short: 'Reach Xiangyang in time', text: 'Reach the siege lines at Xiangyang before the deadline, so your trebuchets can be built before the Khan\'s patience runs out.' },
    portrait: { skin: '#c8946a', robe: '#3a4a7a', robe2: '#a8823a', hat: 'turbanTall', hatC: '#e8e0cc', hair: '#1a1410', beard: 'full', bg: '#7a3a2a' },
  },
  gujarati: {
    name: 'Jagdev Shah', title: 'Jain merchant of Cambay', place: 'Cambay', start: 'cambay', faith: 'jain', difficulty: 1,
    basedOn: 'Jagaḍu Shah, the rich Jain merchant of Kutch who traded with Persia and Arabia and fed Gujarat during the famine of 1256–58.',
    story: 'Your family\'s ships carry cloth and indigo to Aden and Hormuz, but the land roads are where the new fortunes are. Your father has given you capital and a blessing: come back a merchant prince.',
    fodder: 15, coins: 450, food: 20, water: 6, rep: 15, pack: { donkey: 2 }, hires: {},
    ability: { name: 'Many tongues', text: 'You grew up among Arab, Persian, Jewish and Hindu traders and speak their languages: you always get an interpreter\'s better prices, without paying an interpreter.' },
    goal: { type: 'prince', worth: 7000, cities: 25, short: 'Become a merchant prince', text: 'Build a fortune of 7,000 dirhams and visit at least 25 cities, to found trading houses across Asia.' },
    portrait: { skin: '#a8724a', robe: '#f0ece0', robe2: '#c8402a', hat: 'pagri', hatC: '#e0a020', hair: '#1a1410', beard: 'moustache', bg: '#8a5a2a', tilak: true },
  },
  karimi: {
    name: 'Nāṣir al-Kārimī', title: 'Karimi spice merchant of Cairo', place: 'Cairo', start: 'cairo', faith: 'muslim', difficulty: 2,
    basedOn: 'The Kārimī merchants, the great pepper guild of Mamluk Egypt, and Baybars\' embassies to the Golden Horde (1260s–70s).',
    story: 'Your guild buys the pepper of India at Aden and sells it to the Venetians at Alexandria. Now Sultan Baybars himself has chosen you to carry a secret letter to the Khan of the Golden Horde, across the lands of his enemy the Ilkhan.',
    fodder: 10, coins: 600, food: 20, water: 10, rep: 20, pack: { camel: 1 }, hires: {}, cargo: { letter: 1 },
    ability: { name: 'The Kārimī guild', text: 'Your guild\'s agents are everywhere spices are sold: you buy pepper, cinnamon, cloves and nutmeg, incense and sugar 15% cheaper.' },
    goal: { type: 'embassy', city: 'sarai', short: 'Carry the Sultan\'s letter to Sarai', text: 'Deliver Baybars\' letter to the Khan of the Golden Horde at Sarai. Ilkhanate officials will search for it on the way. If it is taken, return to Cairo for another copy.' },
    portrait: { skin: '#b07a52', robe: '#2a6a3a', robe2: '#e8e0cc', hat: 'turbanBig', hatC: '#f4f0e6', hair: '#1a1410', beard: 'full', bg: '#a8823a' },
  },
};
const CHAR_ORDER = ['venetian', 'monk', 'zaitun', 'engineer', 'gujarati', 'karimi'];

// Christian communities that shelter the monk: churches of every rite, and Nestorian communities Polo mentions
const CHRISTIAN_CITIES = ['khanbaliq', 'shangdu', 'datong', 'xingqing', 'wuwei', 'zhangye', 'jiuquan', 'dunhuang', 'hami', 'qocho', 'beshbalik', 'almaliq', 'kashgar', 'yarkand',
  'samarkand', 'merv', 'tabriz', 'mosul', 'baghdad', 'yangzhou', 'zaitun', 'quinsai', 'mylapore', 'acre', 'jerusalem', 'tiflis', 'ani', 'ayas', 'erzurum', 'erzincan', 'sivas', 'caesarea', 'aleppo', 'damascus', 'alexandria', 'cairo', 'aswan'];
const isChristianCity = c => ['byz', 'armenian', 'georgian'].includes(c.culture) || CHRISTIAN_CITIES.includes(c.id);
const MUSLIM_PORTS = ['zaitun', 'guangzhou', 'quinsai', 'yangzhou', 'khanbaliq', 'yachi', 'cambay', 'kayal'];
const isMuslimCity = c => !!(['arab', 'persian', 'central', 'rum', 'yemen', 'mongol'].includes(c.culture) && !c.holy && c.id !== 'acre' || (c.culture === 'tarim' && c.lon < 86) || /Delhi|Bengal/.test(c.polity) || MUSLIM_PORTS.includes(c.id) || c.holy);
const KARIMI_GOODS = ['pepper', 'cinnamon', 'spices', 'incense', 'sugar'];

const charOf = s => CHARACTERS[(s && s.char) || 'venetian'];
// price modifiers from character abilities
(function () {
  const byId = {}; for (const c of CITIES) byId[c.id] = c;
  const bp = ECON.buyPrice, sp = ECON.sellPrice;
  ECON.buyPrice = (s, g, cid, d) => { let p = bp(s, g, cid, d); const ch = s && s.char; const c = byId[cid];
    if (ch === 'zaitun' && c && isMuslimCity(c)) p *= 0.95; if (ch === 'gujarati' && !(s.hires && s.hires.interpreter)) p *= 0.96; if (ch === 'karimi' && KARIMI_GOODS.includes(g)) p *= 0.85; return p; };
  ECON.sellPrice = (s, g, cid, d) => { let p = sp(s, g, cid, d); const ch = s && s.char; const c = byId[cid];
    if (ch === 'zaitun' && c && isMuslimCity(c)) p *= 1.05; if (ch === 'gujarati' && !(s.hires && s.hires.interpreter)) p *= 1.05; return p; };
})();
// road distance in km between two cities (Dijkstra on the trade graph)
function roadKm(a, b) {
  const adj = ECON.adj(); const d = { [a]: 0 }; const done = {};
  for (;;) { let u = null, best = Infinity; for (const k in d) if (!done[k] && d[k] < best) { best = d[k]; u = k; } if (!u) return Infinity; if (u === b) return best; done[u] = 1; for (const [v, km] of adj[u] || []) if (!(v in d) || best + km < d[v]) d[v] = best + km; }
}
let _engDeadline = null;
function engineerDeadline() { if (_engDeadline === null) _engDeadline = Math.round(roadKm('tabriz', 'xiangyang') / 24 / 10) * 10; return _engDeadline; }

// ---------- portraits (SVG) ----------
function portraitSVG(id, size = 120) {
  const P = CHARACTERS[id].portrait; const st = 'stroke="#2a1a10" stroke-width="1.6" stroke-linejoin="round"';
  let s = `<svg viewBox="0 0 100 100" width="${size}" height="${size}" class="portrait"><rect width="100" height="100" fill="${P.bg}"/><circle cx="50" cy="38" r="42" fill="#fff" opacity=".14"/>`;
  // shoulders & robe
  s += `<path d="M10 100 Q14 72 50 68 Q86 72 90 100 Z" fill="${P.robe}" ${st}/>`;
  s += `<path d="M38 70 L50 88 L62 70" fill="${P.robe2}" ${st}/>`;
  if (P.cross) s += `<path d="M50 78 v12 M45 82 h10" stroke="#d8b84a" stroke-width="2.4"/>`;
  // neck & head
  s += `<rect x="43" y="56" width="14" height="14" fill="${P.skin}" ${st}/>`;
  if (P.hat === 'cowl') s += `<path d="M24 66 Q22 22 50 18 Q78 22 76 66 Q64 58 50 58 Q36 58 24 66 Z" fill="${P.hatC}" ${st}/>`;
  s += `<ellipse cx="50" cy="44" rx="15" ry="18" fill="${P.skin}" ${st}/>`;
  s += `<ellipse cx="35.5" cy="45" rx="2.5" ry="4" fill="${P.skin}" ${st}/><ellipse cx="64.5" cy="45" rx="2.5" ry="4" fill="${P.skin}" ${st}/>`;
  // eyes, brows, nose, mouth
  s += `<path d="M42 38 q3 -2 6 0 M52 38 q3 -2 6 0" stroke="${P.hair}" stroke-width="2" fill="none"/><circle cx="45" cy="42" r="1.6" fill="#1a1410"/><circle cx="55" cy="42" r="1.6" fill="#1a1410"/>`;
  s += `<path d="M50 43 q-2 6 0 8 q1.5 .5 2.5 -.5" stroke="#6a3a22" stroke-width="1.3" fill="none"/>`;
  if (P.tilak) s += `<path d="M50 30 v5" stroke="#c82a1a" stroke-width="2"/>`;
  // beard
  if (P.beard === 'long') s += `<path d="M36 48 Q38 76 50 80 Q62 76 64 48 Q58 56 50 55 Q42 56 36 48 Z" fill="${P.hair}" ${st}/>`;
  else if (P.beard === 'full') s += `<path d="M36 47 Q38 66 50 68 Q62 66 64 47 Q58 55 50 54 Q42 55 36 47 Z" fill="${P.hair}" ${st}/>`;
  else if (P.beard === 'short') s += `<path d="M38 50 Q42 62 50 62 Q58 62 62 50 Q56 56 50 55.5 Q44 56 38 50 Z" fill="${P.hair}" opacity=".9" ${st}/>`;
  if (P.beard !== 'long' && P.beard !== 'full') s += `<path d="M44 52 q6 -2 12 0" stroke="${P.hair}" stroke-width="${P.beard === 'moustache' ? 3 : 2}" fill="none" stroke-linecap="round"/>`;
  s += `<path d="M46 56.5 q4 1.5 8 0" stroke="#7a3a2a" stroke-width="1.3" fill="none"/>`;
  // headgear
  if (P.hat === 'beretta') s += `<path d="M33 36 Q34 20 50 20 Q66 20 67 36 Q50 30 33 36 Z" fill="${P.hatC}" ${st}/><path d="M34 38 q-2 6 1 10 M66 38 q2 6 -1 10" stroke="${P.hair}" stroke-width="3" fill="none"/>`;
  else if (P.hat === 'cowl') s += `<path d="M34 32 Q38 22 50 22 Q62 22 66 32" fill="none" ${st}/>`;
  else if (P.hat === 'turban' || P.hat === 'turbanBig' || P.hat === 'turbanTall') { const big = P.hat === 'turbanBig' ? 4 : 0, tall = P.hat === 'turbanTall' ? 6 : 0;
    if (tall) s += `<path d="M40 22 Q50 8 60 22" fill="#5a2a2a" ${st}/>`;
    s += `<ellipse cx="50" cy="${29 - tall / 2}" rx="${19 + big}" ry="${11 + big / 2 + tall / 2}" fill="${P.hatC}" ${st}/><path d="M33 ${30 - tall / 2} Q50 ${20 - tall} 67 ${28 - tall / 2} M35 ${34 - tall / 2} Q50 ${26 - tall} 66 ${33 - tall / 2}" stroke="#b8ae94" stroke-width="1.4" fill="none"/>`;
    if (P.hat === 'turban') s += `<path d="M66 32 q8 10 4 24" stroke="${P.hatC}" stroke-width="5" fill="none"/>`; }
  else if (P.hat === 'pagri') s += `<ellipse cx="50" cy="28" rx="19" ry="11" fill="${P.hatC}" ${st}/><path d="M32 30 Q50 18 68 28 M34 34 Q50 24 66 32" stroke="#a8602a" stroke-width="1.5" fill="none"/><circle cx="58" cy="22" r="3" fill="#c82a1a" ${st}/>`;
  s += `<rect x="1" y="1" width="98" height="98" fill="none" stroke="#c9a24a" stroke-width="2"/></svg>`;
  return s;
}

// ============================================================
//  BALANCE PASS (v9): lighter goods, bigger packs, cheaper supplies, richer margins
// ============================================================
const SIZES = { bulky: { w: 1, name: 'Bulky' }, medium: { w: 0.25, name: 'Medium' }, compact: { w: 0.05, name: 'Compact' } };
(function () {
  const BULKY = ['olive', 'wine', 'dates', 'tin', 'porcelain', 'carpets', 'felt', 'naphtha', 'wax', 'glass', 'jade', 'salt', 'sugar', 'fruit', 'cotton', 'betel', 'sandalwood', 'ivory'];
  const COMPACT = ['rubies', 'pearls', 'musk', 'golddust', 'balsam', 'emeralds', 'saffron', 'turquoise', 'amber', 'coral', 'carnelian', 'chalcedony'];
  for (const g of GOODS) {
    g.size = BULKY.includes(g.id) ? 'bulky' : COMPACT.includes(g.id) ? 'compact' : 'medium';
    g.w = SIZES[g.size].w;
    // every good should pay its way: minimum profit per load per 1,000 km of road
    const target = g.size === 'bulky' ? 4 : g.size === 'medium' ? 10 : 0;
    const minSlope = Math.min(target * g.w / g.base, g.size === 'bulky' ? 0.6 : 0.6);
    if (g.slope < minSlope) { g.slope = +minSlope.toFixed(2); g.cap = Math.max(g.cap, +(1 + g.slope * 3).toFixed(1)); }
  }
  // v12 rebalance: every good earns its keep.
  //  bulky: cheapest per unit, best return on silver, worst per load -> early-game, short hauls
  //  medium: the all-rounders                        compact: best per load, lowest return on silver -> late game
  const BAND = { bulky: { slope: [0.45, 0.62], minBase: 20 }, medium: { slope: [0.3, 0.42], minBase: 8 }, compact: { slope: [0.2, 0.3], minBase: 16 } };
  for (const g of GOODS) g.base = g.size === 'bulky' ? 14 + g.base : Math.max(BAND[g.size].minBase, g.base);
  // within a size, cheaper goods return more on your silver and dearer goods more per load
  for (const size in BAND) { const gs = GOODS.filter(g => g.size === size); const lo = Math.log(Math.min(...gs.map(g => g.base))), hi = Math.log(Math.max(...gs.map(g => g.base)));
    for (const g of gs) { const t = hi > lo ? (Math.log(g.base) - lo) / (hi - lo) : 0.5; const [s0, s1] = BAND[size].slope; g.slope = +(s1 - (s1 - s0) * t).toFixed(2); g.cap = +Math.max(g.cap, 0.62 + g.slope * 3.2).toFixed(1); } }
  // bigger packs
  const CAP = { donkey: 9, mule: 12, horse: 11, camel: 24, yak: 14, elephant: 40 };
  for (const k in CAP) if (PACK[k]) PACK[k].cap = CAP[k];
  VEHICLES.cart.cap = 40; VEHICLES.wagon.cap = 80;
  // cheaper supplies
  SUPPLY.food.base = 0.3; SUPPLY.fodder.base = 0.2; SUPPLY.water.base = 0.12;
  // more starting silver
  const COINS = { venetian: 500, monk: 200, zaitun: 750, engineer: 550, gujarati: 650, karimi: 850 };
  for (const k in COINS) if (CHARACTERS[k]) CHARACTERS[k].coins = COINS[k];
})();
const BASE_CARRY = 8;
// how many days of supplies the caravan can carry
function supplyDays(s) {
  let d = 10; for (const k in s.pack) d += (k === 'camel' || k === 'elephant' ? 8 : k === 'yak' ? 5 : 4) * s.pack[k];
  for (const k in s.veh) d += 6 * s.veh[k] * (k === 'wagon' ? 2 : 1);
  return d;
}

// space taken by one unit of each supply (food was halved in v10)
const SUPPLY_W = { food: 0.05, water: 0.1, fodder: 0.05 };

// ============================================================
//  v17: FACTIONS — merchant houses with their own standing, ranks and goods
// ============================================================
const FACTIONS = {
  venice: { name: 'Scuola di San Marco', short: 'Venetian', house: 'Scuola di San Marco', who: 'Latin Christians', faiths: ['christian'], latin: true, rival: 'genoa', color: '#b8862a',
    cities: ['constantinople', 'acre', 'trebizond', 'tana', 'tabriz'], goods: ['muranoglass', 'scarlet'], head: 'the bailo', client: 'the Scuola di San Marco',
    blurb: 'On paper a brotherhood of Saint Mark that prays together, buries its dead and looks after the widows; in truth, how Venice trades in the East. Its houses answer to the bailo in Constantinople and the consuls in Acre, Trebizond, Tana and Tabriz.' },
  genoa: { name: 'Compagna', short: 'Genoese', house: 'house of the Compagna', who: 'Latin Christians', faiths: ['christian'], latin: true, rival: 'venice', color: '#a8201a',
    cities: ['constantinople', 'caffa', 'ayas', 'tana'], goods: ['alum', 'mastic'], head: 'the podestà', client: 'the Compagna',
    blurb: 'The sworn association of Genoa\'s merchants. Allies of the Emperor since 1261, they hold Pera across the Golden Horn and have just founded Caffa in the Crimea. They mean to own the Black Sea.' },
  karimi: { name: 'Kārimī merchants', short: 'Kārimī', house: 'Kārimī counting house', who: 'Muslim merchants', faiths: ['muslim'], rival: null, color: '#3a6a3a',
    cities: ['cairo', 'alexandria', 'qus', 'aden'], goods: [], head: 'the ra\'is of the Kārimī', client: 'a Kārimī house', spices: true,
    blurb: 'The great spice guild of Egypt and Yemen. Pepper, cinnamon, cloves and incense pass through their hands from Aden to Alexandria, and outsiders pay for the privilege.' },
};
const FAC_ORDER = ['venice', 'genoa', 'karimi'];
const FAC_RANKS = [[0, 'Stranger'], [10, 'Associate'], [25, 'Member'], [50, 'Factor'], [80, 'Master']];
const FAC_SPICES = ['pepper', 'cinnamon', 'spices', 'incense', 'sugar'];
// monopoly goods: only the faction's members can buy them, at its houses
GOOD.muranoglass = { id: 'muranoglass', name: 'Venetian glass', unit: 'case', size: 'medium', w: 0.25, base: 28, slope: .34, cap: 1.9, prod: ['constantinople', 'acre', 'trebizond', 'tana'], fac: 'venice',
  blurb: 'Goblets, beads and enamelled lamps from the furnaces of Venice. Only brothers of the Scuola di San Marco may buy them for export.' };
GOOD.scarlet = { id: 'scarlet', name: 'Scarlet broadcloth', unit: 'bolt', size: 'medium', w: 0.25, base: 34, slope: .32, cap: 1.9, prod: ['constantinople', 'acre', 'trebizond', 'tana'], fac: 'venice',
  blurb: 'Fine wool dyed with kermes in Venice: the cloth of kings and khans. Sold only through the Scuola di San Marco.' };
GOOD.alum = { id: 'alum', name: 'Phocaean alum', unit: 'sack', size: 'bulky', w: 1, base: 18, slope: .55, cap: 2.1, prod: ['constantinople', 'caffa', 'ayas'], fac: 'genoa',
  blurb: 'The mordant that fixes dyes to cloth, from the mines near Phocaea. Every dyer from Tabriz to India needs it, and the Genoese hold the trade.' };
GOOD.mastic = { id: 'mastic', name: 'Chian mastic', unit: 'jar', size: 'medium', w: 0.25, base: 24, slope: .34, cap: 1.9, prod: ['constantinople', 'caffa', 'ayas'], fac: 'genoa',
  blurb: 'Resin tears from the mastic trees of Chios, chewed, burned and used in medicine. Shipped by the Genoese.' };
const FAC_GOODS = ['muranoglass', 'scarlet', 'alum', 'mastic'];
// v17: quest letters for the guild's first mission
GOOD.guildletters = { id: 'guildletters', name: 'The Scuola\'s letters', unit: 'packet', w: 0.05, base: 0, special: true, quest: true, dest: 'To deliver to another house of the Scuola',
  blurb: 'Sealed reports and bills of exchange for the Venetian consuls.' };

function facState(s) { if (!s.fac) s.fac = { venice: { s: s.char === 'venetian' ? 5 : 0, m: false }, genoa: { s: 0, m: false }, karimi: { s: 0, m: false } }; return s.fac; }
function facsIn(cid) { return FAC_ORDER.filter(f => FACTIONS[f].cities.includes(cid)); }
function facCanJoin(s, f) { const F = FACTIONS[f]; return F.faiths.includes(s.faith) && (!F.latin || s.char === 'venetian') && !facState(s)[f].traitor; }
function facRank(s, f) { const st = facState(s)[f]; if (!st.m) return st.s >= 25 ? 'Friend of the house' : 'Outsider'; let r = FAC_RANKS[0][1]; for (const [t, n] of FAC_RANKS) if (st.s >= t) r = n; return r; }
function facRankN(s, f) { const st = facState(s)[f]; if (!st.m) return -1; let r = 0; FAC_RANKS.forEach(([t], i) => { if (st.s >= t) r = i; }); return r; }
// prices: standing with the houses in a city earns up to 4%; a Factor or Master earns 4% more there
function facPriceBonus(s, cid) { if (!s || !s.fac) return 0; let b = 0; for (const f of facsIn(cid)) { const st = s.fac[f]; b = Math.max(b, st.s / 100 * 0.04 + (st.m && st.s >= 50 ? 0.04 : 0)); } return b; }
(function () {
  const bp = ECON.buyPrice, sp = ECON.sellPrice;
  ECON.buyPrice = (s, g, cid, d) => { let p = bp(s, g, cid, d); if (!s || !s.fac) return p; p *= 1 - facPriceBonus(s, cid);
    if (FAC_SPICES.includes(g) && FACTIONS.karimi.cities.includes(cid)) { const k = s.fac.karimi; p *= k.m ? 0.95 : 1 + 0.12 * (1 - k.s / 100); }
    if (GOOD[g] && GOOD[g].fac) { const st = s.fac[GOOD[g].fac]; if (st.m && st.s >= 80) p *= 0.85; }
    return p; };
  ECON.sellPrice = (s, g, cid, d) => sp(s, g, cid, d) * (1 + facPriceBonus(s, cid));
})();

// v18: sea lanes for ships on autopilot, built by tools/sealanes.js (A* over the land mask). [from, to, type, [lon, lat] points]
const SEA_LANES = [["constantinople","caffa","galley",[[29,41],[29.1,41.3],[29.3,41.6],[29.6,41.9],[29.9,42.2],[30.2,42.5],[30.5,42.8],[30.8,43.1],[31.1,43.4],[31.4,43.6],[31.7,43.7],[32,43.8],[32.3,43.9],[32.6,44],[32.9,44.1],[33.2,44.2],[33.5,44.2],[33.8,44.1],[34.1,44.2],[34.4,44.2],[34.7,44.2],[35,44.5],[35.3,44.8],[35.3,44.9]]],["constantinople","sinope","galley",[[29,41],[29.1,41.3],[29.3,41.5],[29.6,41.5],[29.9,41.5],[30.2,41.5],[30.5,41.5],[30.8,41.5],[31.1,41.5],[31.4,41.5],[31.7,41.7],[32,41.8],[32.3,42],[32.6,42.1],[32.9,42.1],[33.2,42.2],[33.5,42.3],[33.8,42.3],[34.1,42.3],[34.4,42.3],[34.7,42.3],[35,42.3],[35.2,42.1],[35.2,42]]],["sinope","trebizond","galley",[[35.2,42],[35.5,42.1],[35.8,42.1],[36.1,42.1],[36.4,42.1],[36.7,42],[37,41.9],[37.3,41.8],[37.6,41.7],[37.9,41.6],[38.2,41.5],[38.5,41.5],[38.8,41.5],[39.1,41.4],[39.4,41.4],[39.7,41.3],[39.8,41]]],["caffa","sinope","galley",[[35.3,44.9],[35.4,44.6],[35.4,44.3],[35.4,44],[35.4,43.7],[35.4,43.4],[35.4,43.1],[35.4,42.8],[35.4,42.5],[35.3,42.2],[35.2,42]]],["caffa","tana","galley",[[35.3,44.9],[35.6,44.8],[35.9,44.8],[36.2,44.8],[36.5,44.9],[36.6,45.2],[36.6,45.5],[36.9,45.8],[37,46.1],[37.3,46.4],[37.6,46.7],[37.9,46.8],[38.2,46.8],[38.5,47],[38.8,47],[39.1,47.1],[39.2,47.1]]],["constantinople","smyrna","galley",[[29,41],[28.8,40.7],[28.5,40.7],[28.2,40.7],[27.9,40.7],[27.6,40.6],[27.3,40.6],[27,40.5],[26.7,40.6],[26.4,40.6],[26.1,40.4],[26.1,40.1],[25.9,39.8],[25.9,39.5],[25.7,39.2],[25.9,38.9],[26.2,38.8],[26.5,38.8],[26.8,38.5],[27,38.4]]],["smyrna","acre","galley",[[27,38.4],[26.7,38.6],[26.4,38.7],[26.3,38.4],[26.3,38.1],[26.4,37.8],[26.5,37.5],[26.5,37.2],[26.7,36.9],[26.9,36.6],[27.2,36.3],[27.5,36],[27.8,35.7],[28.1,35.4],[28.4,35.1],[28.7,35],[29,34.9],[29.3,34.8],[29.6,34.7],[29.9,34.6],[30.2,34.5],[30.5,34.4],[30.8,34.3],[31.1,34.2],[31.4,34.1],[31.7,34],[32,33.9],[32.3,33.8],[32.6,33.7],[32.9,33.6],[33.2,33.5],[33.5,33.4],[33.8,33.3],[34.1,33.3],[34.4,33.3],[34.7,33],[35,32.9]]],["acre","alexandria","galley",[[35,32.9],[34.7,32.8],[34.4,32.7],[34.1,32.6],[33.8,32.5],[33.5,32.4],[33.2,32.3],[32.9,32.2],[32.6,32.1],[32.3,32],[32,31.9],[31.7,31.8],[31.4,31.8],[31.1,31.8],[30.8,31.8],[30.5,31.8],[30.2,31.8],[29.9,31.5],[29.8,31.2]]],["ayas","acre","galley",[[35.8,36.7],[35.6,36.4],[35.6,36.1],[35.6,35.8],[35.5,35.5],[35.5,35.2],[35.5,34.9],[35.5,34.6],[35.4,34.3],[35.3,34],[35.2,33.7],[35,33.4],[34.9,33.1],[35,32.9]]],["aden","hormuz","dhow",[[45,12.8],[45.3,12.8],[45.6,13],[45.9,13.1],[46.2,13.2],[46.5,13.2],[46.8,13.2],[47.1,13.3],[47.4,13.4],[47.7,13.6],[48,13.7],[48.3,13.7],[48.6,13.7],[48.9,13.7],[49.2,13.7],[49.5,13.8],[49.8,14.1],[50.1,14.4],[50.4,14.7],[50.7,14.8],[51,14.8],[51.3,14.8],[51.6,14.8],[51.9,14.8],[52.2,14.8],[52.5,14.8],[52.8,14.8],[53.1,14.8],[53.4,15.1],[53.7,15.4],[54,15.7],[54.3,16],[54.6,16.3],[54.9,16.6],[55.2,16.9],[55.5,17.2],[55.8,17.5],[56.1,17.5],[56.4,17.5],[56.7,17.7],[57,18],[57.3,18.3],[57.6,18.6],[57.9,18.9],[58,19.2],[58.2,19.5],[58.5,19.8],[58.8,20.1],[59.1,20.4],[59.2,20.7],[59.2,21],[59.4,21.3],[59.7,21.6],[59.9,21.9],[60,22.2],[60.1,22.5],[59.8,22.8],[59.5,23.1],[59.2,23.4],[58.9,23.7],[58.6,24],[58.3,24.3],[58,24.6],[57.7,24.9],[57.5,25.2],[57.4,25.5],[57.1,25.8],[57,26.1],[56.9,26.4],[56.8,26.7],[56.9,27]]],["aden","cambay","dhow",[[45,12.8],[45.3,12.8],[45.6,13],[45.9,13.1],[46.2,13.2],[46.5,13.2],[46.8,13.2],[47.1,13.3],[47.4,13.4],[47.7,13.6],[48,13.7],[48.3,13.7],[48.6,13.8],[48.9,14],[49.2,14.3],[49.5,14.4],[49.8,14.5],[50.1,14.6],[50.4,14.7],[50.7,14.8],[51,14.9],[51.3,15],[51.6,15.1],[51.9,15.2],[52.2,15.3],[52.5,15.4],[52.8,15.5],[53.1,15.6],[53.4,15.7],[53.7,15.9],[54,16],[54.3,16.1],[54.6,16.2],[54.9,16.3],[55.2,16.4],[55.5,16.5],[55.8,16.6],[56.1,16.7],[56.4,16.8],[56.7,16.9],[57,17],[57.3,17.1],[57.6,17.2],[57.9,17.3],[58.2,17.4],[58.5,17.5],[58.8,17.6],[59.1,17.7],[59.4,17.8],[59.7,17.9],[60,18],[60.3,18.1],[60.6,18.2],[60.9,18.3],[61.2,18.4],[61.5,18.5],[61.8,18.6],[62.1,18.7],[62.4,18.8],[62.7,18.9],[63,19],[63.3,19.1],[63.6,19.2],[63.9,19.3],[64.2,19.4],[64.5,19.5],[64.8,19.6],[65.1,19.7],[65.4,19.8],[65.7,19.9],[66,20],[66.3,20],[66.6,20],[66.9,19.9],[67.2,19.8],[67.5,19.8],[67.8,19.7],[68.1,19.7],[68.4,19.9],[68.7,20],[69,20],[69.3,20.1],[69.6,20.2],[69.9,20.2],[70.2,20.2],[70.5,20.2],[70.8,20.2],[71.1,20.2],[71.4,20.3],[71.7,20.6],[72,20.9],[72.3,21.2],[72.4,21.5],[72.4,21.8],[72.5,22.1],[72.6,22.2]]],["hormuz","cambay","dhow",[[56.9,27],[56.8,26.7],[56.9,26.4],[57,26.1],[57.1,25.8],[57.4,25.5],[57.7,25.5],[58,25.4],[58.3,25.3],[58.6,25.3],[58.9,25.2],[59.2,25.2],[59.5,25.2],[59.8,25.2],[60.1,25.1],[60.4,25.1],[60.7,25],[61,25],[61.3,24.9],[61.6,24.9],[61.9,24.9],[62.2,24.9],[62.5,24.9],[62.8,24.9],[63.1,24.9],[63.4,24.9],[63.7,24.9],[64,24.6],[64.3,24.3],[64.6,24],[64.9,23.7],[65.2,23.4],[65.5,23.1],[65.8,22.8],[66.1,22.5],[66.4,22.2],[66.7,22],[67,21.8],[67.3,21.6],[67.6,21.4],[67.9,21.2],[68.2,21.1],[68.5,21],[68.8,20.9],[69.1,20.8],[69.4,20.7],[69.7,20.6],[70,20.6],[70.3,20.5],[70.6,20.5],[70.9,20.5],[71.2,20.5],[71.5,20.5],[71.8,20.7],[72.1,21],[72.4,21.3],[72.4,21.6],[72.4,21.9],[72.6,22.2]]],["cambay","kayal","dhow",[[72.6,22.2],[72.4,21.9],[72.4,21.6],[72.4,21.3],[72.5,21],[72.5,20.7],[72.4,20.4],[72.4,20.1],[72.4,19.8],[72.5,19.5],[72.6,19.2],[72.6,18.9],[72.7,18.6],[72.7,18.3],[72.8,18],[72.9,17.7],[72.9,17.4],[73,17.1],[73,16.8],[73.1,16.5],[73.1,16.2],[73.1,15.9],[73.1,15.6],[73.1,15.3],[73.1,15],[73.1,14.7],[73.1,14.4],[73.1,14.1],[73.1,13.8],[73.1,13.5],[73.1,13.2],[73.2,12.9],[73.3,12.6],[73.4,12.3],[73.5,12],[73.6,11.7],[73.8,11.4],[74,11.1],[74.3,10.8],[74.6,10.5],[74.9,10.2],[75.2,9.9],[75.5,9.6],[75.8,9.3],[76.1,9],[76.4,8.7],[76.7,8.4],[77,8.1],[77.3,7.9],[77.6,7.9],[77.9,8],[78.2,8.3],[78.2,8.6]]],["kayal","mylapore","dhow",[[78.2,8.6],[78.5,8.7],[78.8,8.8],[79.1,9],[79.3,9.3],[79.3,9.6],[79.6,9.9],[79.9,10.2],[80.1,10.5],[80.1,10.8],[80.1,11.1],[80.1,11.4],[80.1,11.7],[80.1,12],[80.3,12.3],[80.4,12.6],[80.5,12.9],[80.3,13]]],["mylapore","martaban","dhow",[[80.3,13],[80.6,13],[80.9,13],[81.2,13],[81.5,13],[81.8,13],[82.1,13],[82.4,13],[82.7,13],[83,13],[83.3,13],[83.6,13],[83.9,13],[84.2,13],[84.5,13],[84.8,13],[85.1,13],[85.4,13],[85.7,13],[86,13],[86.3,13],[86.6,13],[86.9,13],[87.2,13],[87.5,13.1],[87.8,13.2],[88.1,13.3],[88.4,13.4],[88.7,13.5],[89,13.6],[89.3,13.7],[89.6,13.8],[89.9,13.9],[90.2,14],[90.5,14.1],[90.8,14.2],[91.1,14.3],[91.4,14.4],[91.7,14.5],[92,14.6],[92.3,14.7],[92.6,14.8],[92.9,14.9],[93.2,15],[93.5,15.1],[93.8,15.2],[94.1,15.3],[94.4,15.4],[94.7,15.5],[95,15.6],[95.3,15.6],[95.6,15.5],[95.9,15.5],[96.2,15.7],[96.5,16],[96.8,16.1],[97.1,16.4],[97.4,16.5],[97.6,16.5]]],["martaban","kedah","junk",[[97.6,16.5],[97.5,16.2],[97.4,15.9],[97.4,15.6],[97.4,15.3],[97.4,15],[97.4,14.7],[97.4,14.4],[97.5,14.1],[97.6,13.8],[97.7,13.5],[97.8,13.2],[97.8,12.9],[97.8,12.6],[97.7,12.3],[98,12],[98,11.7],[97.9,11.4],[97.9,11.1],[97.9,10.8],[98,10.5],[98,10.2],[98,9.9],[98,9.6],[98,9.3],[98,9],[98,8.7],[98,8.4],[98,8.1],[98,7.8],[98.3,7.5],[98.6,7.2],[98.9,6.9],[99.2,6.6],[99.5,6.3],[99.8,6],[100.1,5.7],[100.3,5.7]]],["kedah","vijaya","junk",[[100.3,5.7],[100,5.4],[100.1,5.1],[100.3,4.8],[100.4,4.5],[100.4,4.2],[100.5,3.9],[100.8,3.6],[101,3.3],[101,3],[101.3,2.7],[101.6,2.4],[101.9,2.2],[102.2,2],[102.5,1.8],[102.8,1.6],[103.1,1.4],[103.4,1.2],[103.7,1.1],[104,1.3],[104.3,1.3],[104.6,1.6],[104.9,1.9],[105.2,2.2],[105.5,2.5],[105.5,2.8],[105.5,3.1],[105.8,3.4],[105.9,3.7],[106,4],[106.1,4.3],[106.2,4.6],[106.3,4.9],[106.4,5.2],[106.5,5.5],[106.6,5.8],[106.7,6.1],[106.8,6.4],[106.9,6.7],[107,7],[107.1,7.3],[107.2,7.6],[107.3,7.9],[107.4,8.2],[107.5,8.5],[107.6,8.8],[107.7,9.1],[107.8,9.4],[107.9,9.7],[108,10],[108.1,10.3],[108.4,10.6],[108.7,10.8],[109,11.1],[109.3,11.4],[109.4,11.7],[109.5,12],[109.5,12.3],[109.6,12.6],[109.7,12.9],[109.7,13.2],[109.7,13.5],[109.5,13.8],[109.3,13.9]]],["vijaya","guangzhou","junk",[[109.3,13.9],[109.6,14.2],[109.9,14.5],[110.2,14.8],[110.5,15.1],[110.8,15.4],[111,15.7],[111.1,16],[111.2,16.3],[111.3,16.6],[111.4,16.9],[111.5,17.2],[111.6,17.5],[111.7,17.8],[111.8,18.1],[111.8,18.4],[111.9,18.7],[112,19],[112.1,19.3],[112.2,19.6],[112.3,19.9],[112.4,20.2],[112.5,20.5],[112.6,20.8],[112.6,21.1],[112.9,21.4],[113.2,21.7],[113.5,22],[113.7,22.3],[113.7,22.6],[113.4,22.9]]],["guangzhou","zaitun","junk",[[113.4,22.9],[113.7,22.6],[113.7,22.3],[114,22.1],[114.3,22.1],[114.6,22.4],[114.9,22.4],[115.2,22.5],[115.5,22.5],[115.8,22.6],[116.1,22.6],[116.4,22.7],[116.7,22.9],[117,23.2],[117.3,23.2],[117.6,23.3],[117.9,23.6],[118.2,23.9],[118.5,24.2],[118.8,24.5],[118.7,24.8]]],["zaitun","quinsai","junk",[[118.7,24.8],[119,24.8],[119.3,25.1],[119.6,25.1],[119.9,25.3],[120.1,25.6],[120.1,25.9],[120.1,26.2],[120.4,26.5],[120.7,26.8],[121,27.1],[121.3,27.4],[121.6,27.7],[121.9,28],[122.1,28.3],[122.1,28.6],[122.1,28.9],[122.2,29.2],[122.2,29.5],[122.1,29.8],[121.8,30.1],[121.5,30.4],[121.2,30.5],[120.9,30.3],[120.6,30.3],[120.3,30.3]]]];

// ============================================================
//  v11 RELAY TRADE: local tastes tuned (by relayopt.js) so that from almost every city,
//  east and west, some good sells at least ~30% dearer one or two cities on.
// ============================================================
const CITY_DEMAND = {"ancyra":{"glass":1.15,"olive":1.25,"wool":1.2},"smyrna":{"wool":1.1,"buckram":1.17},"constantinople":{"wine":1.09,"buckram":1.25},"caesarea":{"wine":1.08},"erzincan":{"coral":1.3},"erzurum":{"carpets":1.08,"wine":1.31},"sinope":{"buckram":1.06},"mosul":{"wool":1.08},"hamadan":{"olive":1.04},"tabriz":{"wine":1.14},"trebizond":{"wine":1.23},"derbent":{"wine":1.12},"merv":{"glass":1.08,"fruit":1.18},"baghdad":{"rawsilk":1.04},"kerman":{"fruit":1.17},"isfahan":{"rawsilk":1.05},"balkh":{"brocade":1.05,"carpets":1.07,"horsegear":1.18},"samarkand":{"cotton":1.15},"lahore":{"carpets":1.16},"herat":{"lapis":1.13},"aksu":{"lapis":1.17,"fruit":1.14},"kashgar":{"fruit":1.36,"jade":1.16},"balasagun":{"fruit":1.06},"beshbalik":{"horsegear":1.07},"tashkent":{"felt":1.2},"osh":{"jade":1.13},"dunhuang":{"rawsilk":1.09,"rhubarb":1.09},"hami":{"chalcedony":1.12,"felt":1.07},"khotan":{"chalcedony":1.45},"korla":{"carpets":1.28},"qocho":{"salammoniac":1.44},"jiuquan":{"fruit":1.21},"cherchen":{"fruit":1.12},"xingqing":{"rhubarb":1.22,"silk":1.17},"xining":{"horsegear":1.13},"lanzhou":{"horsegear":1.99,"tea":1.14},"khanbaliq":{"felt":1.5},"datong":{"porcelain":1.16},"xiangyang":{"silk":1.31},"yangzhou":{"paper":1.3,"porcelain":1.14},"jingzhao":{"paper":1.16},"luoyang":{"ginger":1.19},"quinsai":{"paper":1.76},"zhending":{"tea":1.06},"bihar":{"pashmina":1.13},"kathmandu":{"musk":1.25,"cottoncloth":1.1},"alexandria":{"olive":1.49},"acre":{"sugar":1.34},"damascus":{"linen":1.47},"gaza":{"glass":1.32},"khaybar":{"linen":1.23,"fruit":1.3},"cairo":{"dates":1.16},"taif":{"dates":1.12,"pepper":1.1},"ayla":{"dates":1.07},"tabuk":{},"aden":{"carnelian":1.36},"sanaa":{"cottoncloth":1.07,"incense":1.2},"zafar":{"carnelian":1.3,"pepper":1.15},"najran":{"incense":1.2},"shibam":{},"hormuz":{"fruit":1.12},"kanauj":{"brocade":1.36,"cowries":1.13},"delhi":{"cottoncloth":1.48},"anhilwara":{"sugar":1.24,"pepper":1.34},"ajmer":{"cotton":1.21},"pandharpur":{"cotton":1.11},"dvarasamudra":{"cottoncloth":1.13,"cinnamon":1.21},"thana":{"cottoncloth":1.47},"thanjavur":{"sandalwood":1.39,"pepper":1.05},"mylapore":{"sandalwood":1.47},"kanchipuram":{"cinnamon":1.4},"mathura":{"cowries":1.25},"sakya":{"sugar":1.16},"lakhnauti":{"betel":1.19},"lhasa":{"cowries":1.21},"jianchang":{"tea":1.24},"bhamo":{"tea":1.22},"yachi":{"golddust":1.54,"sugar":1.15},"pagan":{"golddust":1.21},"dali":{"ivory":1.05},"chittagong":{"ivory":1.05},"pegu":{"aloeswood":1.67},"angkor":{"betel":1.26},"kedah":{"betel":1.06},"guangzhou":{"tea":1.16}};

