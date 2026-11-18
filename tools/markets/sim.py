#!/usr/bin/env python3
"""Trade balance simulator: one greedy trader with perfect price knowledge, run through the
v18 economy (old_goods_v18.json) and the v19 markets economy, so their pace can be compared.

    python3 tools/markets/sim.py [--k 0.27,0.30,0.33,0.36,0.40]

Simplified: no supplies, events, tolls, drift or contracts. Starts in Constantinople with 500
dirhams and 8 loads; buys a camel (24 loads, 170) whenever it can spare the silver (max 12)."""
import json, os, re, sys, heapq, random, math
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE)); sys.path.insert(0, HERE)
import markets
from goods_data import DEMAND
data = open(os.path.join(ROOT, 'src', 'data.js'), encoding='utf-8').read()
mjs = open(os.path.join(ROOT, 'src', 'markets_data.js'), encoding='utf-8').read()
NEW = json.loads(re.search(r'const MARKET_GOODS = (\[.*?\]);', mjs, re.S).group(1))
OLDG = json.load(open(os.path.join(HERE, 'old_goods_v18.json')))
TIER = {k: int(v) for k, v in re.findall(r"(\w+): *(\d)", data[data.index('CITY_TIER = {'):data.index('};', data.index('CITY_TIER = {'))])}
for m in re.finditer(r"C\('(\w+)', *'(?:[^'\\]|\\.)*', *'(?:[^'\\]|\\.)*', *'(?:[^'\\]|\\.)*', *[-\d.]+, *[-\d.]+, *(\d)", data): TIER[m.group(1)] = int(m.group(2))
TIER.update({'quinsai': 5, 'khanbaliq': 5, 'cairo': 5})
adj = json.load(open(os.path.join(HERE, 'road_graph.json')))
CM = {c: m['id'] for m in markets.MARKETS for c in m['cities'].split()}
CITIES = list(CM)
def dij(srcs):
    d = {c: 1e18 for c in CITIES}; q = []
    for s in srcs:
        if s in d: d[s] = 0; q.append((0, s))
    heapq.heapify(q)
    while q:
        k, u = heapq.heappop(q)
        if k > d[u]: continue
        for v, w in adj[u]:
            if k + w < d[v]: d[v] = k + w; heapq.heappush(q, (k + w, v))
    return d
CD = {c: dij([c]) for c in CITIES}
SIZEW = {'bulky': 1, 'medium': .25, 'compact': .05}
tierf = lambda c: 1 + 0.04 * (TIER.get(c, 1) - 2)
def econ_old():
    G = {}
    for g in OLDG:
        d = dij(g['prod']); w = SIZEW[g['size']]
        G[g['id']] = dict(w=w, price={c: g['base'] * (0.55 if d[c] == 0 else min(g['cap'], 0.62 + g['slope'] * d[c] / 1000)) * tierf(c) for c in CITIES}, d=d)
    def offers(c, r):
        out = {}
        for gid, g in G.items():
            if g['d'][c] <= 700: out[gid] = round((10 + TIER.get(c, 1) * 8) * (1 if g['d'][c] == 0 else .45) / max(.3, g['w']))
        return out
    return G, offers
def econ_new(K=None, CAP=None, off=1.0, ds=1.0):
    RK = dict(zip('curel', K or [0.27, 0.30, 0.33, 0.36, 0.40])); RC = dict(zip('curel', CAP or [3.5, 4, 4.5, 5, 6]))
    QTY = {'c': (10, 25), 'u': (5, 12), 'r': (2, 5), 'e': (1, 2), 'l': (1, 1)}; CH = {'u': .4, 'r': .2, 'e': .125, 'l': .05}
    G = {}
    for g in NEW:
        if g['id'] == 'holyoil': continue
        d = dij(g['prod']); r = g['rar']
        def pm(c, g=g, d=d, r=r):
            if CM[c] == g['m']: return 1
            m = min(RC[r], off + RK[r] * d[c] / 1000); return min(RC[r] * 1.15, m * (1 + (DEMAND[CM[c]].get(g['type'], 1) - 1) * ds))
        G[g['id']] = dict(w=SIZEW[g['size']], price={c: g['base'] * pm(c) * tierf(c) for c in CITIES}, g=g)
    MK = {m['id']: m for m in markets.MARKETS}
    def elig(c, r):
        m = MK[CM[c]]; out = []
        for gid, x in G.items():
            g = x['g']
            if g['m'] != m['id'] or g['rar'] != r: continue
            if r in 'cu' or c in g['prod'] or (r == 'r' and c in m['stars']) or (r in 'el' and c == m['hub']): out.append(gid)
        return out
    def offers(c, rnd):
        m = MK[CM[c]]; n = 10 if c in m['stars'] else (5 + rnd.randrange(3) if TIER.get(c, 1) >= 2 else 3 + rnd.randrange(2))
        cs = elig(c, 'c'); rnd.shuffle(cs); us = elig(c, 'u'); rnd.shuffle(us); off = (cs + us)[:n]
        for r in 'urel':
            el = [g for g in elig(c, r) if g not in off]
            p = CH[r] * (2 if r in 'el' and c in m['special'] and any(c in G[g]['g']['prod'] for g in el) else 1)
            if el and rnd.random() < p:
                cm = [g for g in off if G[g]['g']['rar'] == 'c']
                if cm and len(off) >= n: off.remove(rnd.choice(cm))
                off.append(rnd.choice(el))
        out = {}
        for gid in off:
            g = G[gid]['g']; lo, hi = QTY[g['rar']]; q = rnd.randint(lo, hi) * (.5 if g['size'] == 'bulky' else 1) * (0.6 + 0.2 * TIER.get(c, 1)); out[gid] = max(1, round(q))
        return out
    return G, offers
def run(econ, days=600, seed=1, start='constantinople'):
    G, offers = econ; rnd = random.Random(seed)
    coins, cap, camels, day, c = 500.0, 8, 0, 0.0, start; marks = {}; cargo = {}
    E = lambda gid, cc: (30 + TIER.get(cc, 1) * 22) / max(.4, G[gid]['w'])
    while day < days:
        while coins > 400 and camels < 12: coins -= 170; camels += 1; cap = 8 + 24 * camels
        stock = offers(c, rnd); best = None
        for dst in CITIES:
            km = CD[c][dst]
            if dst == c or km > 2500 or km < 150: continue
            t = km / 22 + 1; plan = []; room = cap; cash = coins; prof = 0
            cands = sorted(stock, key=lambda g: -(G[g]['price'][dst] * .94 - G[g]['price'][c] * 1.06) / G[g]['w'])
            for g in cands:
                bp, sp = G[g]['price'][c] * 1.06, G[g]['price'][dst] * .94
                if sp <= bp * 1.05: continue
                n = min(stock[g], int(room / G[g]['w']), int(cash / bp))
                # saturation: buying and selling n units moves both prices
                while n > 0 and sp * math.exp(-n / 2 / E(g, dst)) <= bp * math.exp(n / 2 / E(g, c)) * 1.05: n = int(n * .7)
                if n <= 0: continue
                cost = n * bp * math.exp(n / 2 / E(g, c)); gain = n * sp * math.exp(-n / 2 / E(g, dst))
                plan.append((g, n, cost, gain)); room -= n * G[g]['w']; cash -= cost; prof += gain - cost
            if plan and (best is None or prof / t > best[0]): best = (prof / t, dst, plan, t)
        if not best:  # nothing worth carrying: move to the nearest market city
            dst = min((x for x in CITIES if x != c), key=lambda x: CD[c][x] + (0 if TIER.get(x, 1) >= 3 else 400)); day += CD[c][dst] / 22 + 1; c = dst; continue
        _, dst, plan, t = best
        for g, n, cost, gain in plan: coins += gain - cost
        day += t; c = dst
        for mk in (100, 300, 600):
            if day >= mk and mk not in marks: marks[mk] = round(coins + camels * 170)
    return marks
if __name__ == '__main__':
    K = None
    if '--k' in sys.argv: K = [float(x) for x in sys.argv[sys.argv.index('--k') + 1].split(',')]
    old = econ_old(); new = econ_new(K)
    for name, e in (('v18', old), ('v19', new)):
        res = [run(e, seed=s) for s in (1, 2, 3)]
        print(name, {d: round(sum(r.get(d, 0) for r in res) / len(res)) for d in (100, 300, 600)})
