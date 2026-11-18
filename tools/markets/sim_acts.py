#!/usr/bin/env python3
"""Story-pace simulator: plays Matteo's Acts I-III with a greedy trader under different economy rules.

    python3 tools/markets/sim_acts.py                 # all variants, 20 seeds each
    python3 tools/markets/sim_acts.py --v tuned --seeds 50 --detail

Act I   Acre -> Constantinople along the story route (Damascus, Aleppo, Ayas, Konya, Smyrna, Nicaea),
        100 dirhams, 8 loads on foot, the 90-dirham linen contract to Aleppo. Two players: one who only
        trades at Acre ("one trade") and one who trades at every stop ("route trader").
Act II  From Constantinople with the route trader's silver. Stables open: pack animals, camel drivers,
        speed upgrades. Ends at net worth 1,500 with 3+ animals and 3 cities not seen in Act I
        (the game's 'three markets you have not seen before').
Act III Ends at Khanbaliq or Shangdu with net worth 6,000. Two policies: "greedy" trades anywhere until
        6,000 and then heads east; "eastward" only takes legs that bring it closer to Khanbaliq.

Modelled: food (0.3/person/day), fodder (0.2 x animal rate), wages, supply weight, realm tolls along the
road (halved for Matteo), delivery contracts that end at the leg's destination, persistent saturation that
decays 4% a day, random merchant stock on every visit. Not modelled: events, robbery, seasons, drift,
reputation, ventures, loans, property, the gift, breeds and the paiza. The trader knows every price, so it
is an upper bound: a real player should take roughly 1.3-1.5x as many days.

Variants: v19 (as built), recommended (the 18 Nov rebalance), fast (same idea without the border fix, which
turns border cities such as Ayas into gateways), brainstorm (the first guess). Results are in the project doc
claude/silk-road-economy-rebalance.md.
"""
import sys, os, re, math, random, heapq, statistics as st
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import sim as base   # loads cities, road graph, goods, distances
from goods_data import DEMAND
import markets

CITIES, CD, TIER, CM, adj = base.CITIES, base.CD, base.TIER, base.CM, base.adj
MK = {m['id']: m for m in markets.MARKETS}
ROOT = os.path.dirname(os.path.dirname(HERE))
econ_js = open(os.path.join(ROOT, 'src', 'econ.js'), encoding='utf-8').read()
data_js = open(os.path.join(ROOT, 'src', 'data.js'), encoding='utf-8').read()

# ---------- realms and tolls (mirrors realmOf in econ.js) ----------
TOLL = {k: float(v) for k, v in re.findall(r"(\w+): *\{ *name:'[^']*', *toll:([.\d]+)", econ_js)}
POL = {m.group(1): m.group(2) for m in re.finditer(r"C\('(\w+)', *'(?:[^'\\]|\\.)*', *'(?:[^'\\]|\\.)*', *'((?:[^'\\]|\\.)*)'", data_js)}
POL.update({m.group(1): m.group(2) for m in re.finditer(r"\{ *id:'(\w+)',.*?polity:'((?:[^'\\]|\\.)*)'", data_js)})
def realm_of(c):
    p = POL.get(c, '')
    for key, r in [('Kingdom of Jerusalem', 'crusader'), ('Hejaz', 'hejaz'), ('Bedouin', 'bedouin'), ('Rasulid', 'rasulid'), ('Hadramawt', 'hadramawt'),
                   ('Dhofar', 'dhofar'), ('Bengal (Delhi', 'bengal'), ('Deva kingdom', 'deva'), ('Delhi', 'delhi'), ('Mewar', 'mewar'), ('Vaghela', 'gujarat'),
                   ('Yadava', 'yadava'), ('Hoysala', 'hoysala'), ('Pandya', 'pandya'), ('Nepal', 'nepal'), ('Pagan', 'pagan'), ('Sukhothai', 'sukhothai'),
                   ('Lavo', 'lavo'), ('Khmer', 'khmer'), ('Champa', 'champa'), ('Tambralinga', 'tambralinga'), ('Srivijaya', 'srivijaya'), ('Đại Việt', 'daiviet'),
                   ('Byzantine', 'byz'), ('Trebizond', 'trebizond'), ('Rûm', 'rum'), ('Seljuk', 'rum'), ('Cilicia', 'cilicia'), ('Mamluk', 'mamluk'),
                   ('Georgia', 'georgia'), ('Golden Horde', 'horde'), ('Chagatai', 'chagatai'), ('Song', 'song'), ('Sakya', 'tibet'),
                   ('Yuan', 'yuan'), ('Uyghur', 'yuan'), ('Contested', 'yuan')]:
        if key in p: return r
    return 'ilkhan'
REALM = {c: realm_of(c) for c in CITIES}

def paths_from(s):
    d = {c: 1e18 for c in CITIES}; prev = {}; d[s] = 0; q = [(0, s)]
    while q:
        k, u = heapq.heappop(q)
        if k > d[u]: continue
        for v, w in adj[u]:
            if k + w < d[v]: d[v] = k + w; prev[v] = u; heapq.heappush(q, (k + w, v))
    return prev
def toll_frac(a, b, prev):
    path = [b]
    while path[-1] != a: path.append(prev[path[-1]])
    path.reverse(); f = 0
    for x, y in zip(path, path[1:]):
        if REALM[x] != REALM[y]: f += TOLL.get(REALM[y], .03)
    return f * 0.5          # Matteo pays half
PREV = {c: paths_from(c) for c in CITIES}
TOLLF = {a: {b: toll_frac(a, b, PREV[a]) for b in CITIES if b != a} for a in CITIES}
def hops_from(s):
    d = {s: 0}; q = [s]
    for u in q:
        for v, _ in adj[u]:
            if v not in d: d[v] = d[u] + 1; q.append(v)
    return d
HOPS = {c: hops_from(c) for c in CITIES}

SIZEW = {'bulky': 1, 'medium': .25, 'compact': .05}
LIVESTOCK = {  # id fragments of goods that walk: (fodder per day)
    'Arabian warhorse': 1.1, 'Heavenly horse': 1.1, 'White mare of the Khan': 1.1, 'Dali pony': .7, 'War elephant': 2.4,
    'White elephant': 2.4, 'Tiger for a menagerie': 1.0, 'White gyrfalcon': .1}
tierf = lambda c: 1 + 0.04 * (TIER.get(c, 1) - 2)
tf_stock = lambda c: 0.6 + 0.2 * TIER.get(c, 1)

# ---------- economy variants ----------
VARIANTS = {
    'v19': dict(desc='v19.0 as built', K=dict(c=.27, u=.30, r=.33, e=.36, l=.40), CAP=dict(c=3.5, u=4, r=4.5, e=5, l=6), P=0,
                SM=dict(bulky=1, medium=1, compact=1), stock='old', sat='old', livestock=False),
    'recommended': dict(desc='tuned for the story pace, with the border fix', K=dict(c=1.1, u=.9, r=.7, e=.6, l=.5),
                        CAP=dict(c=3.25, u=3.9, r=5.2, e=6.5, l=7.8), P=.6, R=1000, ramp_from='border', inmarket=True,
                        SM=dict(bulky=1.25, medium=1, compact=.85), stock='budget', sat='value', livestock=True,
                        B=dict(c=750, u=650, r=750, e=750, l=750), SATV=3000),
    'fast': dict(desc='tuned for pace without the border fix (border cities become gateways)', K=dict(c=.55, u=.45, r=.35, e=.30, l=.25), CAP=dict(c=2.5, u=3, r=4, e=5, l=6), P=.4, R=1000,
                  SM=dict(bulky=1.25, medium=1, compact=.85), stock='budget', sat='value', livestock=True,
                  B=dict(c=300, u=260, r=300, e=300, l=300), SATV=1200),
    'brainstorm': dict(desc='brainstorm defaults', K=dict(c=.55, u=.45, r=.35, e=.30, l=.25), CAP=dict(c=2.5, u=3, r=4, e=5, l=6), P=.25,
                       SM=dict(bulky=1.25, medium=1, compact=.85), stock='budget', sat='value', livestock=True),
}
BUDGET = dict(c=150, u=130, r=150, e=150, l=150)     # dirhams of stock per slot at a tier-2 city (x 0.6 + 0.2 x tier)
SATV = 600                                            # dirhams of a good that move its price by e (x 0.6 + 0.2 x tier)

class Econ:
    def __init__(s, V):
        s.V = V; s.G = {}; s.dm = {}
        for g in base.NEW:
            if g['m'] not in s.dm: s.dm[g['m']] = base.dij(MK[g['m']]['cities'].split())   # km from the good's own market
            if g['id'] == 'holyoil': continue
            d = base.dij(g['prod']); r = g['rar']; w = SIZEW[g['size']]; fod = 0
            if V['livestock'] and g['name'] in LIVESTOCK: w, fod = 0, LIVESTOCK[g['name']]
            sm = V['SM'][g['size']]; price = {}
            for c in CITIES:
                if CM[c] == g['m']: m = min(V['CAP'][r], 1 + V['K'][r] * sm * d[c] / 1000) if V.get('inmarket') else 1
                else:
                    dd = s.dm[g['m']][c] if V.get('ramp_from') == 'border' else d[c]
                    ramp = min(1, dd / V['R']) if V.get('R') else 1   # the foreign premium phases in over R km
                    m = min(V['CAP'][r], 1 + V['P'] * ramp + V['K'][r] * sm * d[c] / 1000)
                    m = min(V['CAP'][r] * 1.15, m * DEMAND[CM[c]].get(g['type'], 1))
                price[c] = g['base'] * m * tierf(c)
            s.G[g['id']] = dict(g=g, w=w, fod=fod, price=price, r=r, size=g['size'])
    def elig(s, c, r):
        m = MK[CM[c]]; out = []
        for gid, x in s.G.items():
            g = x['g']
            if g['m'] != m['id'] or g['rar'] != r: continue
            if r in 'cu' or c in g['prod'] or (r == 'r' and c in m['stars']) or (r in 'el' and c == m['hub']): out.append(gid)
        return out
    def offers(s, c, rnd):
        m = MK[CM[c]]; n = 10 if c in m['stars'] else (5 + rnd.randrange(3) if TIER.get(c, 1) >= 2 else 3 + rnd.randrange(2))
        cs = s.elig(c, 'c'); prod = [g for g in cs if c in s.G[g]['g']['prod']]
        cs = sorted(cs, key=lambda g: rnd.random() / (3 if g in prod else 1))
        us = s.elig(c, 'u'); rnd.shuffle(us); off = (cs + us)[:n]
        CH = {'u': .4, 'r': .2, 'e': .125, 'l': .05}
        for r in 'urel':
            el = [g for g in s.elig(c, r) if g not in off]
            p = CH[r] * (2 if r in 'el' and c in m['special'] and any(c in s.G[g]['g']['prod'] for g in el) else 1)
            if el and rnd.random() < p:
                cm = [g for g in off if s.G[g]['r'] == 'c']
                if cm and len(off) >= n: off.remove(rnd.choice(cm))
                off.append(rnd.choice(el))
        QTY = {'c': (10, 25), 'u': (5, 12), 'r': (2, 5), 'e': (1, 2), 'l': (1, 1)}; out = {}
        for gid in off:
            x = s.G[gid]
            if s.V['stock'] == 'old':
                lo, hi = QTY[x['r']]; q = rnd.randint(lo, hi) * (.5 if x['size'] == 'bulky' else 1) * tf_stock(c)
            else:
                q = s.V.get('B', BUDGET)[x['r']] * tf_stock(c) / x['price'][c] * rnd.uniform(.7, 1.3)
            out[gid] = max(1, round(q))
        return out
    def E(s, gid, c):  # saturation elasticity in units
        x = s.G[gid]
        if s.V['sat'] == 'old': return (30 + TIER.get(c, 1) * 22) / max(.4, x['w'] if x['w'] else 1)
        return s.V.get('SATV', SATV) * tf_stock(c) / x['price'][c]

# ---------- the trader ----------
PACKS = dict(camel=(170, 24, .6), mule=(80, 12, .8), donkey=(40, 9, .6))
UPS = [('saddles', 150, .12, 0, 600), ('horseshoes', 350, .12, 0, 1500), ('master', 500, .15, 2.5, 3500)]   # name, cost, speed, wage, buy when coins >

class Trader:
    def __init__(s, E, rnd, coins, city, day=0, animals=0, handlers=0, ups=()):
        s.E, s.rnd, s.coins, s.c, s.day = E, rnd, coins, city, day
        s.animals, s.handlers, s.ups = animals, handlers, set(ups); s.pcap = 0; s.pval = 0; s.pfod = 0
        s.sat = {}; s.stock = E.offers(city, rnd); s.contracts = s.roll_contracts(city)
        s.log = dict(profit_by_rar={}, profit_by_size={}, costs=0, tolls=0, contracts=0, legs=0, km=0, leglist=[]); s.markets_sold = set(); s.visited = set(); s.seen0 = set(ROUTE)
    cap = property(lambda s: 8 + s.pcap)
    speed = property(lambda s: 20 * (1 + sum(u[2] for u in UPS if u[0] in s.ups)))
    people = property(lambda s: 1 + s.handlers + ('master' in s.ups))
    wage = property(lambda s: .5 * s.handlers + sum(u[3] for u in UPS if u[0] in s.ups))
    def nw(s): return s.coins + s.pval * .5
    def satm(s, c, g): return math.exp(-s.sat.get((c, g), 0) / s.E.E(g, c))
    def roll_contracts(s, c):
        out = []; G = s.E.G; pool = [g for g in s.stock if G[g]['r'] in 'cur' and G[g]['w'] > 0]
        cand = [d for d, h in HOPS[c].items() if 2 <= h <= 5]
        for _ in range(3):
            if not pool or not cand: break
            g = s.rnd.choice(pool); dst = s.rnd.choice(cand); h = HOPS[c][dst]; x = G[g]
            n = max(1, round(s.rnd.uniform(1, 2.5) / x['w'])); n = max(1, min(n, int((250 + 80 * h) / x['price'][c])))
            trade = n * max(0, x['price'][dst] * .94 - x['price'][c] * 1.06)
            pay = max(30, 1.4 * trade + .15 * n * x['price'][c] + 18 * h + 2 * CD[c][dst] / 100)
            out.append((dst, n * x['w'], pay))
        return out
    def leg_costs(s, t):
        food = s.people * t; fod = s.pfod * t
        return food * .3 + fod * .2 + s.wage * t, food * .05 + fod * .05
    def plan(s, dst, room, cash):
        """best purchase plan at s.c for sale at dst. returns (profit, items, contract_pay, contract_loads)"""
        G = s.E.G; c = s.c; tf = TOLLF[c][dst]
        cons = sorted([k for k in s.contracts if k[0] == dst], key=lambda k: -k[2] / max(k[1], .05)); cpay = cl = 0
        for _, l, pay in cons:
            if l <= room - cl: cl += l; cpay += pay
        room -= cl
        def best_n(g, nmax):
            x = G[g]; bp = x['price'][c] * 1.06 * s.satm(c, g); sp = x['price'][dst] * .94 * s.satm(dst, g)
            Ec, Ed = s.E.E(g, c), s.E.E(g, dst); best = (0, 0, 0)
            for n in range(1, nmax + 1):
                cost = n * bp * math.exp(n / 2 / Ec); gain = n * sp * math.exp(-n / 2 / Ed)
                pr = gain - cost * (1 + tf) - n * x['fod'] * .2 * (CD[c][dst] / s.speed + 1)
                if pr > best[0]: best = (pr, n, cost)
            return best
        plans = []
        for key in ('load', 'silver'):
            rm, ch, items, prof = room, cash, [], 0
            sc = []
            for g, q in s.stock.items():
                pr, n, cost = best_n(g, min(q, 400))
                if n: sc.append((pr / max(n * G[g]['w'], .02) if key == 'load' else pr / cost, g))
            for _, g in sorted(sc, reverse=True):
                x = G[g]; q = s.stock[g]
                lim = q if x['w'] == 0 else min(q, int(rm / x['w'] + 1e-9))
                if lim <= 0: continue
                bp = x['price'][c] * 1.06 * s.satm(c, g); lim = min(lim, int(ch / bp))
                if lim <= 0: continue
                pr, n, cost = best_n(g, min(lim, 400))
                if n <= 0 or cost > ch: continue
                items.append((g, n, cost, pr)); rm -= n * x['w']; ch -= cost; prof += pr
            plans.append((prof, items))
        prof, items = max(plans, key=lambda p: p[0])
        return prof, items, cpay, cl
    def choose(s, allowed):
        best = None
        for dst in allowed:
            km = CD[s.c][dst]; t = km / s.speed + 1
            run, sup = s.leg_costs(t)
            prof, items, cpay, cl = s.plan(dst, s.cap - sup, s.coins - run)
            score = (prof + cpay - run) / t
            if best is None or score > best[0]: best = (score, dst, items, cpay, run, t)
        return best
    def go(s, dst, items, cpay, run, t):
        G = s.E.G; c = s.c
        for g, n, cost, pr in items:
            x = G[g]; s.coins += pr
            s.sat[(c, g)] = s.sat.get((c, g), 0) - n; s.sat[(dst, g)] = s.sat.get((dst, g), 0) + n
            s.log['profit_by_rar'][x['r']] = s.log['profit_by_rar'].get(x['r'], 0) + pr
            s.log['profit_by_size'][x['size']] = s.log['profit_by_size'].get(x['size'], 0) + pr
            s.log['tolls'] += cost * TOLLF[c][dst]
            if CM[dst] != 'byz': s.markets_sold.add(CM[dst])
        s.log['leglist'].append((CD[c][dst], (sum(i[3] for i in items) + cpay - run) / t))
        s.coins += cpay - run; s.log['contracts'] += cpay; s.log['costs'] += run; s.log['legs'] += 1; s.log['km'] += CD[c][dst]
        s.contracts = [k for k in s.contracts if k[0] != dst]
        k = .96 ** t
        for key in list(s.sat):
            s.sat[key] *= k
            if abs(s.sat[key]) < .05: del s.sat[key]
        x = dst
        while x != c:   # every city on the road counts as visited
            if x not in s.seen0: s.visited.add(x)
            x = PREV[c][x]
        s.day += t; s.c = dst; s.stock = s.E.offers(dst, s.rnd); s.contracts = s.roll_contracts(dst)
    def shop(s, used_frac):
        for name, cost, _, _, when in UPS:
            if name not in s.ups and s.coins > when: s.coins -= cost; s.ups.add(name)
        need3 = s.animals < 3 and s.nw() >= 1300
        while s.animals < 12 and (used_frac > .8 or need3):
            kind = 'camel' if s.coins > 1200 else 'donkey'; cost, cap, fod = PACKS[kind]
            if s.coins < cost * 1.5: break
            s.coins -= cost; s.animals += 1; s.pcap += cap; s.pval += cost; s.pfod += fod; used_frac = 0; need3 = s.animals < 3
            if s.animals > 3 + 6 * s.handlers: s.coins -= 25; s.handlers += 1
    def leg(s, allowed, fallback):
        b = s.choose(allowed)
        if b is None or b[0] <= 0:
            km = CD[s.c][fallback]; t = km / s.speed + 1; run, _ = s.leg_costs(t); s.go(fallback, [], 0, run, t); return 0
        _, dst, items, cpay, run, t = b
        used = sum(n * s.E.G[g]['w'] for g, n, _, _ in items) / max(1, s.cap); s.go(dst, items, cpay, run, t); return used

def near_market_city(c):
    return min((x for x in CITIES if x != c), key=lambda x: CD[c][x] + (0 if TIER.get(x, 1) >= 3 else 400))

ROUTE = ['acre', 'damascus', 'aleppo', 'ayas', 'iconium', 'smyrna', 'nicaea', 'constantinople']
def act1(E, seed, every_stop=True):
    rnd = random.Random(seed); T = Trader(E, rnd, 100, 'acre')
    T.contracts = [('aleppo', 2, 90)]  # Ser Bonaventura's linen
    held = []  # (good, n, cost, sell_city)
    for i, c in enumerate(ROUTE[:-1]):
        T.c = c
        if i: T.stock = E.offers(c, rnd)
        # sell what was bought for here
        for h in [h for h in held if h[3] == c]:
            g, n, cost, _ = h; x = E.G[g]; sp = x['price'][c] * .94 * T.satm(c, g) * math.exp(-n / 2 / E.E(g, c))
            T.coins += n * sp; T.sat[(c, g)] = T.sat.get((c, g), 0) + n; T.log['profit_by_rar'][x['r']] = T.log['profit_by_rar'].get(x['r'], 0) + n * sp - cost; held.remove(h)
        # contracts to later route stops
        rest = ROUTE[i + 1:]
        T.contracts = [k for k in T.contracts if k[0] in rest]
        t_rest = sum(CD[a][b] for a, b in zip(ROUTE[i:], ROUTE[i + 1:])) / 20
        food = max(0, math.ceil(CD[c][ROUTE[i + 1]] / 20 * 1.1) + 1); T.coins -= food * .3
        room = 8 - food * .05 - sum(E.G[h[0]]['w'] * h[1] for h in held) - sum(k[1] for k in T.contracts)
        reserve = max(0, sum(CD[a][b] for a, b in zip(ROUTE[i + 1:], ROUTE[i + 2:])) / 20 * 1.1) * .3
        T.coins -= reserve
        if every_stop or i == 0:
            for _ in range(3):   # fill by best sale city on the rest of the route
                best = None
                for g, q in T.stock.items():
                    x = E.G[g]; bp = x['price'][c] * 1.06 * T.satm(c, g)
                    for d in rest:
                        sp = x['price'][d] * .94 * T.satm(d, g); tf = sum(TOLLF[a][b] for a, b in zip(ROUTE[i:], ROUTE[i + 1:ROUTE.index(d) + 1]))
                        n = min(q, int(room / max(x['w'], .01)), int(T.coins / bp))
                        while n > 0 and n * (sp * math.exp(-n / 2 / E.E(g, d)) - bp * math.exp(n / 2 / E.E(g, c)) * (1 + tf)) <= 0: n = int(n * .7)
                        if n <= 0: continue
                        pr = n * (sp * math.exp(-n / 2 / E.E(g, d)) - bp * math.exp(n / 2 / E.E(g, c)) * (1 + tf))
                        if best is None or pr > best[0]: best = (pr, g, n, bp * math.exp(n / 2 / E.E(g, c)) * n, d, tf)
                if not best: break
                pr, g, n, cost, d, tf = best; T.coins -= cost * (1 + tf); T.sat[(c, g)] = T.sat.get((c, g), 0) - n
                held.append((g, n, cost * (1 + tf), d)); T.stock[g] -= n; room -= n * E.G[g]['w']
                if T.stock[g] <= 0: del T.stock[g]
        T.coins += reserve
        T.day += CD[c][ROUTE[i + 1]] / 20 + 1
        for k in [k for k in T.contracts if k[0] == ROUTE[i + 1]]: T.coins += k[2]; T.log['contracts'] += k[2]
        T.contracts = [k for k in T.contracts if k[0] != ROUTE[i + 1]]
        # (contracts from this stop to a later stop)
        newk = [k for k in T.roll_contracts(c) if k[0] in rest[1:] and k[1] <= room] if i and every_stop else []
        T.contracts += newk[:1]
    c = ROUTE[-1]
    for g, n, cost, _ in held:
        x = E.G[g]; T.coins += n * x['price'][c] * .94 * T.satm(c, g) * math.exp(-n / 2 / E.E(g, c))
    return T.coins, T.day

def acts23(E, seed, coins, day, policy='greedy'):
    rnd = random.Random(seed + 1000); T = Trader(E, rnd, coins, 'constantinople', day)
    T.markets_sold = set(); out = {}; used = 1   # Act II's first objective: buy a pack animal
    while T.day < 3000:
        T.shop(used)
        if 'II' not in out:
            if T.nw() >= 1500 and T.animals >= 3 and len(T.visited) >= 3:
                out['II'] = T.day
            else:
                allowed = [d for d in CITIES if d != T.c and 100 <= CD[T.c][d] <= 2500]
                if T.nw() >= 1500 and len(T.visited) < 3:   # the objective sends the player somewhere new
                    allowed = [d for d in allowed if d not in T.seen0 and d not in T.visited] or allowed
                used = T.leg(allowed, near_market_city(T.c)); continue
        dk = lambda x: min(CD[x]['khanbaliq'], CD[x]['shangdu'])
        if T.c in ('khanbaliq', 'shangdu') and T.nw() >= 6000:
            out['III'] = T.day; out['nw'] = T.nw(); break
        if policy == 'greedy' and T.nw() < 6000:
            allowed = [d for d in CITIES if d != T.c and 100 <= CD[T.c][d] <= 2500]
        else:
            allowed = [d for d in CITIES if d != T.c and 100 <= CD[T.c][d] <= 2500 and (dk(d) < dk(T.c) - 150 or (dk(T.c) < 300 and dk(d) < 2500))]
            if T.nw() >= 6000: allowed = [d for d in allowed if dk(d) < dk(T.c)]
        if not allowed: allowed = [min(CITIES, key=lambda x: dk(x) if x != T.c else 1e18)]
        step = min((x for x, _ in adj[T.c]), key=dk)
        used = T.leg(allowed, step)
    out['log'] = T.log
    return out

_E = {}
def one_seed(args):
    key, V, sd = args
    if key not in _E: _E[key] = Econ(V)
    E = _E[key]
    c1, _ = act1(E, sd, every_stop=False); c2, d = act1(E, sd, every_stop=True)
    o = acts23(E, sd, c2, d, 'greedy'); o2 = acts23(E, sd, c2, d, 'eastward')
    return c1, c2, d, o.get('II', 3000), o.get('III', 3000), o['log'], o2.get('III', 3000), o2['log']
def run_variant(name, seeds, detail=False, V=None, quiet=False):
    import multiprocessing as mp
    V = V or VARIANTS[name]; r = dict(one=[], route=[], a1day=[], II=[], III=[], IIIe=[], logs=[], logse=[])
    with mp.Pool() as pool:
        for c1, c2, d, a2, a3, lg, a3e, lge in pool.map(one_seed, [(name, V, sd) for sd in range(seeds)]):
            r['one'].append(c1); r['route'].append(c2); r['a1day'].append(d); r['II'].append(a2); r['III'].append(a3); r['logs'].append(lg); r['IIIe'].append(a3e); r['logse'].append(lge)
    if quiet: return r
    q = lambda xs: f"{st.median(xs):5.0f} ({sorted(xs)[len(xs) // 10]:.0f}-{sorted(xs)[-1 - len(xs) // 10]:.0f})"
    print(f"\n== {name}: {V['desc']}  ({seeds} seeds; median (10th-90th pct))")
    print(f"  Act I   arrive day {q(r['a1day'])} | silver: Acre trade only {q(r['one'])}, route trader {q(r['route'])}")
    print(f"  Act II  net worth 1,500 on day {q(r['II'])}")
    print(f"  Act III audience on day {q(r['III'])} (greedy), {q(r['IIIe'])} (eastward)")
    if detail:
        L = r['logs']; tot = lambda k: sum(sum(l[k].values()) for l in L) / len(L)
        pr = {k: sum(l['profit_by_rar'].get(k, 0) for l in L) / len(L) for k in 'curel'}
        ps = {k: sum(l['profit_by_size'].get(k, 0) for l in L) / len(L) for k in ('bulky', 'medium', 'compact')}
        allp = sum(pr.values()) or 1
        print('  trade profit by rarity: ' + ', '.join(f"{k} {v / allp:.0%}" for k, v in pr.items()))
        print('  trade profit by size:   ' + ', '.join(f"{k} {v / allp:.0%}" for k, v in ps.items()))
        avg = lambda k: sum(l[k] for l in L) / len(L)
        legs = [x for l in L for x in l['leglist']]
        print(f"  legs: median {st.median(k for k, _ in legs):.0f} km; net dirhams/day median {st.median(v for _, v in legs):.1f}, 90th pct {sorted(v for _, v in legs)[int(len(legs) * .9)]:.1f}, legs under 300 km {sum(k < 300 for k, _ in legs) / len(legs):.0%}")
        print(f"  per game (Acts II-III): trade {allp:.0f}, contracts {avg('contracts'):.0f}, running costs {avg('costs'):.0f}, tolls {avg('tolls'):.0f}, {avg('legs'):.0f} legs, {avg('km'):.0f} km")
    return r

if __name__ == '__main__':
    a = sys.argv; seeds = int(a[a.index('--seeds') + 1]) if '--seeds' in a else 20
    names = [a[a.index('--v') + 1]] if '--v' in a else list(VARIANTS)
    for n in names: run_variant(n, seeds, '--detail' in a)
