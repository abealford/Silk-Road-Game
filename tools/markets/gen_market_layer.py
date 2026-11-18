#!/usr/bin/env python3
"""Bake the map's Markets layer into src/markets_layer.js.

    python3 tools/markets/gen_market_layer.py

Territories follow the 1272 realm outlines in MAPX.states (src/geo.js). Each realm is painted
with its market; a realm holding two markets is split by nearest city. All of Tibet is Yuan
(except the Kathmandu valley); land with no outline joins the nearest territory; Oman and Africa
stay blank. Output: a transparent PNG (equirectangular, lon 21-128, lat -2 to 55.5) as a data URI.
Needs numpy, scipy and Pillow."""
import json, os, re, sys, base64, io
import numpy as np
from PIL import Image, ImageDraw
from scipy.spatial import cKDTree
from scipy import ndimage
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE)); sys.path.insert(0, HERE)
import markets
LON0, LON1, LAT0, LAT1 = 21.0, 128.0, -2.0, 55.5
W = 2400; H = round(W * (LAT1 - LAT0) / ((LON1 - LON0) * 0.788))  # x is scaled by cos 38 like the game map
geo = open(os.path.join(ROOT, 'src', 'geo.js'), encoding='utf-8').read()
i = geo.index('const MAPX = '); e = geo.index('};\n', i); MAPX = json.loads(geo[i + len('const MAPX = '):e + 1])
data = open(os.path.join(ROOT, 'src', 'data.js'), encoding='utf-8').read()
coords = {}
for m in re.finditer(r"id:'(\w+)'.*?lon:([-\d.]+), *lat:([-\d.]+)", data): coords[m.group(1)] = (float(m.group(2)), float(m.group(3)))
for m in re.finditer(r"C\('(\w+)', *'(?:[^'\\]|\\.)*', *'(?:[^'\\]|\\.)*', *'(?:[^'\\]|\\.)*', *([-\d.]+), *([-\d.]+)", data): coords[m.group(1)] = (float(m.group(2)), float(m.group(3)))
def P(lon, lat): return ((lon - LON0) / (LON1 - LON0) * W, (LAT1 - lat) / (LAT1 - LAT0) * H)
mk = {c: i for i, m in enumerate(markets.MARKETS) for c in m['cities'].split()}
missing = [c for c in mk if c not in coords]; assert not missing, missing
MI = {m['id']: i for i, m in enumerate(markets.MARKETS)}
STATE_MK = {'Byzantine Empire':'byz','Trebizond':'byz','Sultanate of Rûm':'byz','Armenian Cilicia':'byz','Golden Horde':'horde',
 'Mamluk Sultanate':'mamluk','Rasulids':'yemen','Hadramawt':'yemen','Ilkhanate':'ilkhan','Georgia':'ilkhan','Chagatai Khanate':'chagatai',
 'Yuan Dynasty':None,'Tibet':'yuan','Southern Song':'song','Delhi Sultanate':None,'Kashmir':'hind','Hindu kingdoms':None,'Pandya':'south',
 'Chola':'south','Sinhala':'south','Eastern Ganga':'hind','Pagan':'sea','Đại Việt':'sea','Khmer Empire':'sea','Champa':'sea','Lavo':'sea',
 'Sukhothai':'sea','Srivijaya':None}
FORCE = {'Tibet', 'Hejaz & Bedouin Arabia'}
st = Image.new('I', (W, H), 0); dr = ImageDraw.Draw(st); names = [None]
ex = Image.new('L', (W, H), 0); de = ImageDraw.Draw(ex)
for s in MAPX['states']:
    polys = [[P(p[i] / 100, p[i + 1] / 100) for i in range(0, len(p), 2)] for p in s['polys']]
    if s['name'] == 'Oman':
        for q in polys: de.polygon(q, fill=1)
    if s['name'] not in STATE_MK: continue
    names.append(s['name'])
    for q in polys:
        if len(q) > 2: dr.polygon(q, fill=len(names) - 1)
S = np.array(st)
names.append('Hejaz & Bedouin Arabia'); STATE_MK['Hejaz & Bedouin Arabia'] = 'mamluk'
HEJ = [(35.0,28.0),(36.0,29.6),(37.5,31.2),(39.5,32.0),(42.0,31.0),(46.0,29.0),(48.0,27.5),(47.5,22.5),(45.0,19.0),(43.0,17.3),(41.2,18.8),(39.6,20.6),(38.6,22.2),(37.4,24.6),(36.0,26.4)]
hj = Image.new('L', (W, H), 0); ImageDraw.Draw(hj).polygon([P(*q) for q in HEJ], fill=1); S[(np.array(hj) > 0) & (S == 0)] = len(names) - 1
ids = list(mk); pts = np.array([P(*coords[c]) for c in ids])
cstate = {c: S[int(min(H - 1, max(0, y))), int(min(W - 1, max(0, x)))] for c, (x, y) in zip(ids, pts)}
lab = np.full((H, W), -1, np.int16); gy, gx = np.mgrid[0:H, 0:W]
for k in range(1, len(names)):
    sel = S == k
    if not sel.any(): continue
    fixed = STATE_MK[names[k]]; inside = [c for c in ids if cstate[c] == k]
    if names[k] in FORCE or (fixed and not any(mk[c] != MI[fixed] for c in inside)): lab[sel] = MI[fixed]; continue
    if not inside:
        if fixed: lab[sel] = MI[fixed]
        continue
    _, ix = cKDTree(np.array([pts[ids.index(c)] for c in inside])).query(np.stack([gx[sel], gy[sel]], 1)); lab[sel] = np.array([mk[inside[i]] for i in ix])
kx, ky = pts[ids.index('kathmandu')]; lab[((gx - kx) ** 2 + (gy - ky) ** 2 < 30 ** 2) & (lab == MI['yuan'])] = MI['hind']
lonq = LON0 + gx / W * (LON1 - LON0); latq = LAT1 - gy / H * (LAT1 - LAT0)
lab[((latq < 18) & (lonq < 42.7)) | ((latq < 12.4) & (lonq < 52)) | ((latq < 22.6) & (lonq < 38.5))] = -1
# sea mask from the map's own land polygons
landI = Image.new('L', (W, H), 0); dl = ImageDraw.Draw(landI)
for r in MAPX['land']:
    q = [P(r[i] / 100, r[i + 1] / 100) for i in range(0, len(r), 2)]
    if len(q) > 2: dl.polygon(q, fill=1)
for r in MAPX['lakes']:
    q = [P(r[i] / 100, r[i + 1] / 100) for i in range(0, len(r), 2)]
    if len(q) > 2: dl.polygon(q, fill=0)
sea = np.array(landI) == 0
lab[np.array(ex) > 0] = -2
unl = lab == -1
dist, (iy, ix2) = ndimage.distance_transform_edt(unl, return_indices=True)
fill = unl & ~sea & (dist < 90); lab[fill] = lab[iy[fill], ix2[fill]]; lab[lab == -2] = -1
d, ixn = cKDTree(pts).query(np.stack([gx.ravel(), gy.ravel()], 1)); d = d.reshape(H, W); near = np.array([mk[ids[i]] for i in ixn]).reshape(H, W)
free = (lab < 0) & (d < 40) & ~sea; lab[free] = near[free]
lab[sea] = -1
for _ in range(2):  # majority filter: remove specks
    best = lab.copy(); cnt = np.zeros(lab.shape, np.float32)
    for v in np.unique(lab):
        if v < 0: continue
        c = ndimage.uniform_filter((lab == v).astype(np.float32), 5); better = c > cnt; best[better] = v; cnt = np.where(better, c, cnt)
    best[lab < 0] = -1; lab = best
dm = np.full((H, W), 1e9)
for i, m in enumerate(markets.MARKETS):
    cp = np.array([pts[ids.index(c)] for c in m['cities'].split()]); dd, _ = cKDTree(cp).query(np.stack([gx.ravel(), gy.ravel()], 1)); dm = np.where(lab == i, dd.reshape(H, W), dm)
fade = np.clip(1 - (dm - 260) / 140, 0, 1)
# fade out towards the image's own edges, so the steppe and Siberia don't end in a hard line
edge = np.minimum(np.minimum(gx, W - 1 - gx), np.minimum(gy, H - 1 - gy)); fade = fade * np.clip(edge / 140, 0, 1)
rgba = np.zeros((H, W, 4), np.uint8)
for i, m in enumerate(markets.MARKETS): rgba[lab == i, :3] = tuple(int(m['color'][j:j + 2], 16) for j in (1, 3, 5))
rgba[:, :, 3] = np.where(lab >= 0, (fade * 255).astype(np.uint8), 0)
b = np.zeros((H, W), bool)
b[:, 1:] |= (lab[:, 1:] != lab[:, :-1]) & (lab[:, 1:] >= 0) & (lab[:, :-1] >= 0)
b[1:, :] |= (lab[1:, :] != lab[:-1, :]) & (lab[1:, :] >= 0) & (lab[:-1, :] >= 0)
b = ndimage.binary_dilation(b, iterations=1)
rgba[b, :3] = (74, 48, 30); rgba[b, 3] = (fade[b] * 255).astype(np.uint8)
img = Image.fromarray(rgba, 'RGBA').quantize(colors=64, method=Image.Quantize.FASTOCTREE)
buf = io.BytesIO(); img.save(buf, 'PNG', optimize=True)
uri = 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()
open(os.path.join(ROOT, 'src', 'markets_layer.js'), 'w').write(f'// GENERATED by tools/markets/gen_market_layer.py. Do not edit by hand.\nconst MARKET_LAYER = {{ ext: [{LON0}, {LON1}, {LAT0}, {LAT1}], img: \'{uri}\' }};\n')
Image.fromarray(rgba, 'RGBA').save('/tmp/market_layer_full.png')
print(W, H, len(buf.getvalue()), 'bytes PNG')
