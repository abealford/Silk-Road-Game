
// ============================================================
//  GOODS ICONS — small hand-drawn SVGs, one per trade good
// ============================================================
const ICONS = (() => {
  const st = 'stroke="#3a2614" stroke-width="1.4" stroke-linejoin="round"';
  const bg = '<circle cx="24" cy="24" r="22.5" fill="#efe0bd" stroke="#b08a52" stroke-width="1.2"/>';
  const bolt = (c1, c2, extra = '') => `<rect x="9" y="17" width="26" height="15" rx="2" fill="${c1}" ${st}/><ellipse cx="35" cy="24.5" rx="4" ry="7.5" fill="${c2}" ${st}/><path d="M35 19.5 q-2.4 5 0 10 M35 22 q-1.2 2.5 0 5" fill="none" stroke="#3a2614" stroke-width=".9"/><path d="M9 32 l-3 6 l8 -3" fill="${c1}" ${st}/>${extra}`;
  const sack = (c, dots, dc) => `<path d="M14 18 q-4 8 -2 16 q1 4 12 4 q11 0 12 -4 q2 -8 -2 -16 z" fill="${c}" ${st}/><path d="M16 18 q8 -4 16 0 l-2 -5 q-6 -2 -12 0 z" fill="${c}" ${st}/><path d="M17 17.5 q7 2 14 0" fill="none" stroke="#3a2614" stroke-width="1.6"/>${dots ? `<circle cx="19" cy="12.5" r="2.2" fill="${dc}" ${st}/><circle cx="24" cy="11" r="2.4" fill="${dc}" ${st}/><circle cx="29" cy="12.5" r="2.1" fill="${dc}" ${st}/>` : ''}`;
  const jar = (c, neck = '#a87048') => `<path d="M19 12 h10 l-1 4 q8 4 7 13 q-1 9 -11 10 q-10 -1 -11 -10 q-1 -9 7 -13 z" fill="${c}" ${st}/><rect x="18" y="9" width="12" height="4" rx="1" fill="${neck}" ${st}/><path d="M17 15 q-5 2 -4 7 M31 15 q5 2 4 7" fill="none" ${st}/>`;
  const gems = (c, hi, n = 3) => { let s = ''; const P = [[18, 28, 7], [29, 30, 6], [24, 20, 6.5], [31, 21, 4.5]]; for (let i = 0; i < n; i++) { const [x, y, r] = P[i]; s += `<path d="M${x - r} ${y} l${r * .5} ${-r * .7} h${r} l${r * .5} ${r * .7} l${-r} ${r} z" fill="${c}" ${st}/><path d="M${x - r * .5} ${y - r * .7} l${r * .5} ${r * .7} l${r * .5} ${-r * .7}" fill="none" stroke="${hi}" stroke-width="1"/>`; } return s; };
  const nuggets = (c, hi) => `<path d="M12 30 q2 -7 8 -6 q5 1 4 7 q-1 5 -7 5 q-6 -1 -5 -6 z" fill="${c}" ${st}/><path d="M24 22 q3 -8 10 -5 q5 3 2 9 q-3 5 -9 3 q-4 -2 -3 -7 z" fill="${c}" ${st}/><path d="M26 33 q2 -4 6 -3 q4 2 2 6 q-3 3 -6 1 z" fill="${c}" ${st}/><path d="M15 28 q2 -2 4 -1 M28 19 q3 -1 5 1" stroke="${hi}" stroke-width="1.4" fill="none"/>`;
  const beads = (c, hi) => { let s = '<path d="M10 16 q14 30 28 0" fill="none" stroke="#5a3a1a" stroke-width="1"/>'; for (let i = 0; i <= 8; i++) { const t = i / 8; const x = 10 + 28 * t, y = 16 + 30 * t * (1 - t) * 1.6; s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="${c}" ${st}/><circle cx="${(x - .9).toFixed(1)}" cy="${(y - .9).toFixed(1)}" r=".9" fill="${hi}"/>`; } return s; };
  const flask = (c, glow) => `${glow ? `<circle cx="24" cy="28" r="13" fill="${glow}" opacity=".35"/>` : ''}<path d="M21 9 h6 v7 q8 4 8 12 q0 10 -11 10 q-11 0 -11 -10 q0 -8 8 -12 z" fill="${c}" ${st}/><rect x="20" y="7" width="8" height="3" rx="1" fill="#a87048" ${st}/><path d="M15 29 q9 3 18 0" fill="none" stroke="#fff" stroke-width="1" opacity=".6"/>`;
  const I = {
    silk: () => bolt('#d8a83a', '#e8c46a', '<path d="M12 22 h20 M12 27 h20" stroke="#a8782a" stroke-width="1"/>'),
    brocade: () => bolt('#8a2a2a', '#c8a03a', '<path d="M12 21 l3 3 l3 -3 l3 3 l3 -3 l3 3 l3 -3 M12 28 l3 -3 l3 3 l3 -3 l3 3 l3 -3 l3 3" fill="none" stroke="#e8c46a" stroke-width="1.2"/>'),
    muslin: () => bolt('#f2ede0', '#e2dccb'),
    wool: () => bolt('#3a5a8a', '#5a7aaa', '<path d="M14 17 v15 M20 17 v15 M26 17 v15" stroke="#2a4a6a" stroke-width="1"/>'),
    buckram: () => bolt('#5a6a3a', '#7a8a52'),
    rawsilk: () => `<ellipse cx="18" cy="27" rx="8" ry="6" fill="#f2e8c8" ${st}/><ellipse cx="30" cy="22" rx="8" ry="6" fill="#efe2b8" ${st}/><path d="M12 26 q6 -3 12 0 M24 21 q6 -3 12 0" fill="none" stroke="#b8a070" stroke-width="1"/><path d="M30 28 q6 6 2 12" fill="none" stroke="#c8b888" stroke-width="1"/>`,
    porcelain: () => `<path d="M19 9 h10 v4 q9 5 8 14 q-1 11 -13 12 q-12 -1 -13 -12 q-1 -9 8 -14 z" fill="#f4f2ec" ${st}/><path d="M14 24 q10 4 20 0 M16 31 q8 3 16 0" fill="none" stroke="#2c5fa8" stroke-width="1.6"/><path d="M21 18 q3 2 6 0 q1 3 -3 4 q-4 -1 -3 -4 z" fill="#2c5fa8"/>`,
    tea: () => `<rect x="10" y="14" width="28" height="20" rx="2" fill="#6a4a2a" ${st}/><rect x="14" y="18" width="20" height="12" fill="none" stroke="#8a6a42" stroke-width="1.2"/><path d="M18 24 q6 -5 12 0 q-6 5 -12 0 z" fill="#4a3a1e"/><path d="M10 14 l3 -3 h28 l-3 3" fill="#7a5a36" ${st}/>`,
    lacquer: () => `<rect x="11" y="19" width="26" height="15" rx="2" fill="#a8261c" ${st}/><path d="M9 19 q15 -9 30 0 z" fill="#c4352a" ${st}/><path d="M15 25 h18 M15 29 h18" stroke="#e8c46a" stroke-width="1.2"/><circle cx="24" cy="15.5" r="1.8" fill="#e8c46a"/>`,
    ginger: () => sack('#c8a868', true, '#d8b860'),
    rhubarb: () => `<path d="M14 34 q-3 -12 6 -20 q3 -3 6 0 q4 8 -2 20 z" fill="#b84a3a" ${st}/><path d="M24 36 q2 -12 10 -16 q4 0 3 4 q-2 9 -11 13 z" fill="#a83a2e" ${st}/><path d="M18 16 q-4 -4 -2 -8 q4 0 5 6" fill="#5a8a3a" ${st}/>`,
    musk: () => `<ellipse cx="24" cy="26" rx="11" ry="9" fill="#7a4a2a" ${st}/><path d="M17 22 q7 -5 14 0" fill="none" stroke="#a87048" stroke-width="1.4"/><circle cx="24" cy="17" r="2.5" fill="#5a3a1e" ${st}/><path d="M24 14 q6 -6 10 -2" fill="none" stroke="#8a6a42" stroke-width="1" stroke-dasharray="2 2"/>`,
    jade: () => `<path d="M12 30 q-1 -10 8 -13 q9 -3 15 4 q5 7 -2 12 q-8 5 -16 2 q-4 -1 -5 -5 z" fill="#8ac89a" ${st}/><path d="M17 23 q5 -3 10 -1" fill="none" stroke="#d8f2dc" stroke-width="2"/>`,
    paper: () => `<rect x="11" y="16" width="24" height="18" fill="#f4ecd4" ${st} transform="rotate(-6 23 25)"/><rect x="13" y="14" width="24" height="18" fill="#faf4e2" ${st}/><path d="M16 19 h18 M16 23 h18 M16 27 h12" stroke="#8a7a5a" stroke-width="1"/>`,
    carpets: () => `<rect x="10" y="13" width="28" height="22" fill="#8a2a24" ${st}/><rect x="14" y="17" width="20" height="14" fill="#c8a03a" stroke="#3a2614" stroke-width="1"/><path d="M24 19 l5 5 l-5 5 l-5 -5 z" fill="#2c4f7a"/><path d="M10 13 v-3 M14 13 v-3 M18 13 v-3 M22 13 v-3 M26 13 v-3 M30 13 v-3 M34 13 v-3 M38 13 v-3 M10 35 v3 M14 35 v3 M18 35 v3 M22 35 v3 M26 35 v3 M30 35 v3 M34 35 v3 M38 35 v3" stroke="#e8dcc0" stroke-width="1.2"/>`,
    glass: () => `<path d="M16 10 h16 q0 12 -8 14 q-8 -2 -8 -14 z" fill="#5ab8b0" fill-opacity=".85" ${st}/><path d="M24 24 v9 M17 37 h14 q-2 -4 -7 -4 q-5 0 -7 4 z" fill="#5ab8b0" ${st}/><path d="M18 13 q2 6 5 8" fill="none" stroke="#e8fffc" stroke-width="1.6"/><path d="M17 15 h14" stroke="#e8c46a" stroke-width="1.6"/>`,
    blades: () => `<path d="M14 36 l18 -24 l3 2 l-17 25 z" fill="#c8ccd2" ${st}/><path d="M17 33 q4 -3 3 -6 M22 27 q4 -3 3 -6 M26 21 q3 -2 3 -5" fill="none" stroke="#8a8e96" stroke-width=".9"/><path d="M11 33 l9 6 M13 36 l-3 4" stroke="#6a4a2a" stroke-width="3" stroke-linecap="round"/>`,
    rosewater: () => flask('#e89ab0'),
    olive: () => jar('#9aa84a'),
    wine: () => jar('#6a1e2a'),
    naphtha: () => jar('#2a2622', '#5a4a3a') + '<path d="M22 20 q2 -3 4 0 q1 3 -2 3 q-3 0 -2 -3 z" fill="#e8a83a"/>',
    coral: () => beads('#d8402e', '#ffb0a0'),
    amber: () => beads('#e8962a', '#ffe0a0'),
    furs: () => `<path d="M10 22 q3 -8 10 -6 q4 -3 8 0 q7 -2 10 6 q-2 4 -1 9 q-6 6 -13 6 q-7 0 -13 -6 q1 -5 -1 -9 z" fill="#6a4a2e" ${st}/><path d="M14 24 l2 3 M20 22 l1 4 M27 22 l-1 4 M33 24 l-2 3 M18 30 l2 2 M28 30 l-2 2" stroke="#9a7a52" stroke-width="1.4"/>`,
    wax: () => `<path d="M13 15 h22 v20 q-11 4 -22 0 z" fill="#c8963a" ${st}/><ellipse cx="24" cy="15" rx="11" ry="3.5" fill="#e8c46a" ${st}/><path d="M13 21 q11 3 22 0 M13 28 q11 3 22 0" fill="none" stroke="#6a4a2a" stroke-width="1.4"/>`,
    lapis: () => nuggets('#24479a', '#e8c46a'),
    rubies: () => gems('#c41e3a', '#ff9aaa', 4),
    turquoise: () => nuggets('#3ab8a8', '#2a4a3a'),
    chalcedony: () => nuggets('#d8783a', '#fff0d0'),
    saffron: () => `<path d="M14 20 q-3 10 1 16 q9 4 18 0 q4 -6 1 -16 z" fill="#c8a868" ${st}/><path d="M14 20 q10 -4 20 0" fill="none" ${st}/><path d="M20 14 q-1 5 1 8 M24 12 v10 M28 14 q1 5 -1 8" stroke="#d8302a" stroke-width="1.6" fill="none"/>`,
    pepper: () => sack('#a88a5a', true, '#2a2622'),
    incense: () => sack('#d8c8a0', true, '#f0e2b8') + '<path d="M36 12 q3 -4 0 -7 M33 13 q2 -3 0 -5" fill="none" stroke="#9a9a9a" stroke-width="1"/>',
    indigo: () => `<rect x="12" y="17" width="16" height="13" fill="#232a6a" ${st}/><rect x="22" y="24" width="15" height="12" fill="#1c2258" ${st}/><path d="M14 20 h10 M24 27 h10" stroke="#5a6ab0" stroke-width="1"/>`,
    dates: () => `<path d="M10 26 h28 l-3 10 h-22 z" fill="#b8925a" ${st}/>` + [[16, 23], [21, 21], [26, 23], [31, 21], [19, 18], [28, 18]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="3.2" ry="4.5" fill="#7a3a1a" ${st}/>`).join(''),
    fruit: () => sack('#a88a5a', false) + '<circle cx="18" cy="13" r="3.4" fill="#e8962a" stroke="#3a2614" stroke-width="1"/><circle cx="25" cy="11" r="3" fill="#a8b84a" stroke="#3a2614" stroke-width="1"/><circle cx="31" cy="14" r="2.8" fill="#6a3a5a" stroke="#3a2614" stroke-width="1"/>',
    cotton: () => sack('#e8dcc0', false) + '<circle cx="19" cy="13" r="4" fill="#fff" stroke="#3a2614" stroke-width="1"/><circle cx="26" cy="11" r="4.4" fill="#fff" stroke="#3a2614" stroke-width="1"/><circle cx="31" cy="14" r="3.6" fill="#fff" stroke="#3a2614" stroke-width="1"/>',
    felt: () => `<rect x="10" y="17" width="24" height="15" rx="2" fill="#d8c8a0" ${st}/><ellipse cx="34" cy="24.5" rx="4" ry="7.5" fill="#c8b888" ${st}/><path d="M12 20 l20 9 M12 29 l20 -9" stroke="#8a2a24" stroke-width="1.6"/>`,
    salammoniac: () => `<path d="M12 26 l6 -10 h12 l6 10 l-6 10 h-12 z" fill="#f2f0ea" ${st}/><path d="M18 16 l3 10 h6 l3 -10 M21 26 l-3 10 M27 26 l3 10" fill="none" stroke="#b8b4aa" stroke-width="1"/>`,
    horsegear: () => `<path d="M10 26 q2 -10 14 -10 q12 0 14 10 q-6 -3 -14 -3 q-8 0 -14 3 z" fill="#7a4a2a" ${st}/><path d="M14 25 q10 -4 20 0 v6 q-10 -3 -20 0 z" fill="#8a2a24" ${st}/><path d="M18 31 v6 M30 31 v6" stroke="#3a2614" stroke-width="1.6"/><rect x="15" y="36" width="6" height="3" fill="#a8a8a8" ${st}/><rect x="27" y="36" width="6" height="3" fill="#a8a8a8" ${st}/>`,
    cottoncloth: () => bolt('#f0e6d0', '#d8c8a8', '<path d="M12 21 h20 M12 25 h20 M12 29 h20" stroke="#c84a2a" stroke-width="1.6" stroke-dasharray="2 2"/><circle cx="18" cy="23" r="1.4" fill="#2a5a8a"/><circle cx="26" cy="27" r="1.4" fill="#2a5a8a"/>'),
    pearls: () => { let s = '<path d="M12 30 q12 -18 24 0 q-12 10 -24 0 z" fill="#7a5a3a" ' + st + '/><path d="M14 30 q10 6 20 0" fill="#c8b8a0" ' + st + '/>'; for (const [x, y] of [[20, 28], [24, 29], [28, 28], [24, 25]]) s += `<circle cx="${x}" cy="${y}" r="2.6" fill="#f4f0ea" ${st}/><circle cx="${x - .8}" cy="${y - .9}" r=".8" fill="#fff"/>`; return s; },
    cinnamon: () => '<g transform="rotate(-25 24 24)"><rect x="10" y="17" width="28" height="5" rx="2.5" fill="#a8603a" ' + st + '/><rect x="10" y="23" width="28" height="5" rx="2.5" fill="#b8703f" ' + st + '/><rect x="12" y="29" width="26" height="5" rx="2.5" fill="#9a5634" ' + st + '/><path d="M36 17 v17" stroke="#6a3a1a" stroke-width="1"/></g><path d="M30 12 q4 -4 8 -1" stroke="#4a7a3a" stroke-width="2" fill="none"/>',
    spices: () => { let s = ''; for (const [x, y, a] of [[16, 22, -20], [24, 18, 10], [30, 26, 40]]) s += `<g transform="rotate(${a} ${x} ${y})"><rect x="${x - 1}" y="${y}" width="2" height="12" fill="#5a3020" ${st}/><circle cx="${x}" cy="${y - 1}" r="3.2" fill="#7a3a22" ${st}/></g>`; return s + `<ellipse cx="20" cy="33" rx="5.5" ry="4.5" fill="#a8703a" ${st}/><path d="M17 31 q3 3 6 0" stroke="#6a3a1a" fill="none"/>`; },
    sandalwood: () => `<rect x="9" y="19" width="30" height="11" rx="5.5" fill="#d8a870" ${st}/><ellipse cx="9.5" cy="24.5" rx="3" ry="5.5" fill="#e8c48a" ${st}/><circle cx="9.5" cy="24.5" r="2" fill="none" stroke="#a8703a"/><path d="M28 14 q2 -4 0 -7 M33 15 q2 -4 0 -7" stroke="#8a8a8a" stroke-width="1.2" fill="none"/>`,
    ivory: () => `<path d="M12 36 q2 -16 16 -24 q4 -2 6 0 q-14 10 -16 24 z" fill="#f0e6cc" ${st}/><path d="M18 30 q4 -10 12 -15" stroke="#c8b890" fill="none"/>`,
    aloeswood: () => `<path d="M10 30 q6 -10 14 -8 q8 2 14 -6 l2 6 q-6 10 -16 8 q-8 -1 -12 6 z" fill="#5a3a22" ${st}/><path d="M16 28 q6 -4 12 -2 M26 24 q4 -1 8 -4" stroke="#2a1a0e" stroke-width="1.2" fill="none"/><path d="M22 18 q2 -4 0 -7 M27 17 q2 -4 0 -7" stroke="#9a8a7a" stroke-width="1.1" fill="none"/>`,
    tin: () => `<path d="M10 28 l6 -8 h18 l4 8 z" fill="#c8ccd0" ${st}/><path d="M10 28 h28 v5 h-28 z" fill="#a8acb0" ${st}/><path d="M18 22 h12" stroke="#f0f4f8" stroke-width="1.4"/>`,
    sugar: () => `<path d="M16 38 l8 -26 l8 26 z" fill="#f8f4ec" ${st}/><path d="M14 36 h20 v3 h-20 z" fill="#3a5a8a" ${st}/><path d="M22 20 l2 -6" stroke="#fff" stroke-width="1.4"/>`,
    linen: () => bolt('#e8e0cc', '#d8ceb4', '<path d="M12 22 h20 M12 27 h20" stroke="#b8ae94" stroke-width=".8"/>'),
    balsam: () => flask('#c89a3a', '#f0d080') + '<path d="M18 10 q-4 -4 -2 -6 M30 10 q4 -4 2 -6" stroke="#4a7a3a" stroke-width="1.6" fill="none"/>',
    emeralds: () => gems('#2a9a5a', '#a8f0c0', 3),
    betel: () => `<path d="M10 30 q4 -14 14 -16 q-2 12 -14 16 z" fill="#4a8a3a" ${st}/><circle cx="28" cy="30" r="5" fill="#a87040" ${st}/><circle cx="34" cy="24" r="4.4" fill="#b88048" ${st}/><path d="M26 28 q2 -1 4 1" stroke="#6a4020" fill="none"/>`,
    carnelian: () => gems('#c84a2a', '#f8b090', 3),
    golddust: () => sack('#c8a060', true, '#f0c840') + '<path d="M20 26 l2 2 M26 24 l1 2 M24 30 l2 1" stroke="#f0c840" stroke-width="1.6"/>',
    salt: () => `<rect x="12" y="16" width="24" height="16" rx="2" fill="#f4f2ec" ${st}/><rect x="15" y="12" width="18" height="5" rx="1" fill="#e8e6e0" ${st}/><rect x="20" y="20" width="8" height="8" fill="none" stroke="#c84a2a" stroke-width="1.4"/>`,
    pashmina: () => sack('#ece4d4', false) + '<path d="M18 24 q6 -4 12 0 M18 28 q6 -4 12 0" stroke="#b8ae94" stroke-width="1.4" fill="none"/>',
    cowries: () => { let s = ''; for (const [x, y, a] of [[17, 22, -20], [29, 21, 15], [23, 31, 0]]) s += `<g transform="rotate(${a} ${x} ${y})"><ellipse cx="${x}" cy="${y}" rx="5" ry="7" fill="#f0e6c8" ${st}/><path d="M${x} ${y - 5} v10" stroke="#3a2614" stroke-width="1.2"/><path d="M${x - 1.6} ${y - 3} h-1 M${x - 1.6} ${y} h-1 M${x - 1.6} ${y + 3} h-1" stroke="#3a2614" stroke-width=".8"/></g>`; return s; },
    bailoletter: () => `<rect x="12" y="14" width="24" height="22" rx="2" fill="#f0e6c8" ${st}/><path d="M16 20 h16 M16 24 h16 M16 28 h10" stroke="#6a4a2a" stroke-width="1"/><circle cx="31" cy="32" r="4" fill="#a8302a" ${st}/>`,
    letter: () => `<rect x="12" y="14" width="24" height="22" rx="2" fill="#f0e6c8" ${st}/><path d="M16 20 h16 M16 24 h16 M16 28 h10" stroke="#6a4a2a" stroke-width="1"/><circle cx="31" cy="32" r="4" fill="#c8302a" ${st}/>`,
    holyoil: () => flask('#e8c46a', '#ffe9a0') + '<path d="M24 22 v10 M20 26 h8" stroke="#8a2a1a" stroke-width="1.6"/>',
    tables: () => `<rect x="10" y="16" width="28" height="20" fill="#a8804f" ${st}/><circle cx="24" cy="26" r="7" fill="#e8c46a" ${st}/><path d="M17 26 h14 M24 19 v14 M19 21 l10 10" stroke="#6a4a2a" stroke-width="1"/>`,
  };
  // v17 faction goods
  I.muranoglass = () => I.glass() + '<circle cx="34" cy="14" r="3" fill="#c8302a" stroke="#2a1a10" stroke-width="1"/>';
  I.scarlet = () => bolt('#a8201a', '#c8402a', '<path d="M14 17 v15 M20 17 v15" stroke="#e8c060" stroke-width="1"/>');
  I.alum = () => I.salt();
  I.mastic = () => `<circle cx="18" cy="26" r="5" fill="#f0e4a8" stroke="#2a1a10" stroke-width="1.4"/><circle cx="28" cy="22" r="4" fill="#e8d890" stroke="#2a1a10" stroke-width="1.4"/><circle cx="29" cy="31" r="4.5" fill="#f4ecb8" stroke="#2a1a10" stroke-width="1.4"/>`;
  const cache = {};
  return function icon(id, size = 40) { const k = id + size; if (cache[k]) return cache[k]; const f = I[id] || (() => sack('#a88a5a', false)); return cache[k] = `<svg class="gi" width="${size}" height="${size}" viewBox="0 0 48 48">${bg}${f()}</svg>`; };
})();

