#!/usr/bin/env python3
"""Build the ground and building texture arrays (v22.2).

    python3 tools/textures/build_surfaces.py

Writes src/surfaces_data.js, which build.py inlines into the page. Two sets of square layers:

  GROUND  terrain and roads: meadow, patchy grass, sand, dry earth, forest floor, rock, three pavings
  BUILD   buildings: plaster, mud brick, fired brick, roof tiles, four stones, planks, studded boards,
          thatch, felt

Each layer ships a colour image (512 px, WebP) and a normal map (256 px, WebP, OpenGL convention) plus
its mean linear colour. The game multiplies the vertex colour by (texture / mean), so the region and
culture palettes stay in charge of the colour and the texture brings the detail (see src/surfaces.js).

Sources are the CC0 textures in assets/textures/. Since v22.2b every layer is a photo; the drawn generators (gen_rock and friends) are kept
for reference and as fallbacks.
Needs: pillow numpy
"""
import os, io, json, base64
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TEX = os.path.join(ROOT, 'assets', 'textures')
OUT = os.path.join(ROOT, 'src', 'surfaces_data.js')
CS, NS = 512, 256          # colour and normal sizes
QC, QN = 80, 82            # WebP quality


# ---------- helpers ----------
def wrap_resize(im, size):
    """Resize a tileable image without seams: resize a 3x3 tiling, keep the centre."""
    w, h = im.size
    big = Image.new(im.mode, (w * 3, h * 3))
    for j in range(3):
        for i in range(3):
            big.paste(im, (i * w, j * h))
    big = big.resize((size * 3, size * 3), Image.LANCZOS)
    return big.crop((size, size, size * 2, size * 2))


def squared(im):
    """Tile a 1:2 or 2:1 image into a square."""
    w, h = im.size
    if w == h:
        return im
    s = max(w, h)
    out = Image.new(im.mode, (s, s))
    for y in range(0, s, h):
        for x in range(0, s, w):
            out.paste(im, (x, y))
    return out


def load(name, m):
    return squared(Image.open(os.path.join(TEX, name, m)).convert('RGB'))


def srgb_to_lin(a):
    a = a / 255.0
    return np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)


def webp(im, q):
    b = io.BytesIO()
    im.save(b, 'WEBP', quality=q, method=6)
    return 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode()


def fbm(size, rnd, beta=2.3):
    """Tileable 1/f noise in [0, 1]."""
    f = np.fft.fftfreq(size)[:, None] ** 2 + np.fft.fftfreq(size)[None, :] ** 2
    f[0, 0] = 1
    spec = np.fft.fft2(rnd.standard_normal((size, size))) / (f ** (beta / 2))
    spec[0, 0] = 0
    a = np.fft.ifft2(spec).real
    return (a - a.min()) / (a.max() - a.min())


def normal_from_height(h, strength):
    """OpenGL normal map (green = up the image) from a tileable height field in [0, 1]."""
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5 * strength
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5 * strength
    n = np.stack([-dx, dy, np.ones_like(h)], -1)      # rows grow downwards; green points up the image
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return Image.fromarray(((n * 0.5 + 0.5) * 255).astype(np.uint8))


def rgb(v, tint):
    a = np.stack([v * tint[0], v * tint[1], v * tint[2]], -1) * 255
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def voronoi(n, pts, wx, wy):
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    xx = (xx + wx) % n; yy = (yy + wy) % n
    d = np.full((n, n), 1e9, np.float32); d2 = d.copy(); idx = np.zeros((n, n), np.int32)
    for k, (px, py) in enumerate(pts):
        ddx = np.minimum(abs(xx - px), n - abs(xx - px)); ddy = np.minimum(abs(yy - py), n - abs(yy - py))
        r = np.sqrt(ddx * ddx + ddy * ddy)
        closer = r < d
        d2 = np.where(closer, d, np.minimum(d2, r)); idx = np.where(closer, k, idx); d = np.minimum(d, r)
    return d, d2, idx


# ---------- drawn layers (height field -> colour and normal) ----------
N = 1024


def gen_rock():
    rnd = np.random.default_rng(5)
    base, mid, fine = fbm(N, rnd, 2.6), fbm(N, rnd, 1.9), fbm(N, rnd, 1.2)
    wx = (fbm(N, rnd, 2.0) - .5) * 220; wy = (fbm(N, rnd, 2.0) - .5) * 220
    d, d2, idx = voronoi(N, rnd.random((60, 2)) * N, wx, wy)
    edge = np.clip((d2 - d) / 6, 0, 1)
    yy = np.mgrid[0:N, 0:N][0].astype(np.float32)
    strata = .5 + .5 * np.sin(yy / N * 2 * np.pi * 9 + base * 7)
    face = np.random.default_rng(9).random(60)[idx]
    grit = fbm(N, rnd, .4)
    h = .25 * base + .25 * mid + .15 * fine + .2 * edge + .1 * face + .05 * grit
    v = .55 + .22 * (base - .5) + .3 * (mid - .5) + .3 * (fine - .5) + .2 * (grit - .5) + .07 * (strata - .5) + .14 * (face - .5)
    v *= .62 + .38 * edge
    return rgb(v, (1.03, 1.0, .95)), (h, 9)


def gen_plaster():
    """Lime or mud render: soft trowel mottling, faint horizontal sweeps, slight weathering. No shapes that repeat."""
    rnd = np.random.default_rng(11)
    base, mid, fine = fbm(N, rnd, 3.0), fbm(N, rnd, 2.0), fbm(N, rnd, 1.0)
    yy, xx = np.mgrid[0:N, 0:N].astype(np.float32)
    sweep = .5 + .5 * np.sin(yy / N * 2 * np.pi * 14 + (fbm(N, rnd, 2.4) - .5) * 9)
    h = .5 * base + .3 * mid + .17 * fine + .03 * sweep
    v = .9 + .07 * (base - .5) + .06 * (mid - .5) + .05 * (fine - .5) + .025 * (sweep - .5)
    return rgb(v, (1.0, .99, .965)), (h, 1.1)


def courses(n, rows, cols, mortar, jitter, rnd, offset=.5):
    """Brick courses: per-pixel brick id, distance to the mortar (0 in a joint), local coords."""
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    rh = n / rows; cw = n / cols
    r = np.floor(yy / rh); sx = xx + (r % 2) * cw * offset
    c = np.floor(sx / cw) % cols
    fy = (yy % rh) / rh; fx = (sx % cw) / cw
    dist = np.minimum(np.minimum(fx, 1 - fx) * cw, np.minimum(fy, 1 - fy) * rh)
    bid = (r * cols + c).astype(np.int32)
    return dist, bid, fx, fy


def gen_mudbrick():
    rnd = np.random.default_rng(17)
    dist, bid, fx, fy = courses(N, 16, 6, 0, 0, rnd)
    per = rnd.random(16 * 6 + 8)[bid]
    base, mid, fine = fbm(N, rnd, 2.4), fbm(N, rnd, 1.6), fbm(N, rnd, 1.0)
    erode = np.clip((fbm(N, rnd, 2.2) - .35) * 2.2, 0, 1)            # rendered over in places
    joint = np.clip(dist / 5.0 + (mid - .5) * 1.4, 0, 1)
    joint = 1 - (1 - joint) * (1 - erode * .8)
    h = .35 * joint + .35 * base + .2 * fine + .1 * per
    v = .78 + .1 * (per - .5) + .14 * (base - .5) + .08 * (fine - .5) - .14 * (1 - joint)
    return rgb(v, (1.0, .97, .92)), (h, 4)


def gen_brick():
    """Thin Byzantine bricks with thick lime mortar."""
    rnd = np.random.default_rng(23)
    dist, bid, fx, fy = courses(N, 24, 4, 0, 0, rnd)
    per = rnd.random(24 * 4 + 8)[bid]
    base, fine = fbm(N, rnd, 2.2), fbm(N, rnd, 1.0)
    joint = np.clip((dist - 7) / 3.0 + (fine - .5) * .8, 0, 1)        # thick joints
    h = .55 * joint + .2 * fine + .15 * per + .1 * base
    brick = np.stack([.70 + .2 * (per - .5), .40 + .12 * (per - .5), .30 + .08 * (per - .5)], -1) * (.9 + .2 * (fine[..., None] - .5))
    mortar = np.stack([.86, .82, .74], -1) * (.92 + .16 * (base[..., None] - .5))
    c = brick * joint[..., None] + mortar * (1 - joint[..., None])
    img = Image.fromarray(np.clip(c * 255 * 1.05, 0, 255).astype(np.uint8))
    return img, (h, 5)


def gen_rooftile():
    """Barrel (Roman / Chinese) tiles: columns of half cylinders running down the slope (image v)."""
    rnd = np.random.default_rng(29)
    cols, rows = 8, 6
    yy, xx = np.mgrid[0:N, 0:N].astype(np.float32)
    cw = N / cols; rh = N / rows
    c = np.floor(xx / cw); fx = (xx % cw) / cw
    sy = yy + (c % 2) * rh * .5
    r = np.floor(sy / rh); fy = (sy % rh) / rh
    bid = ((r % rows) * cols + c).astype(np.int32)
    per = rnd.random(rows * cols + 4)[bid]
    arch = np.sin(fx * np.pi)                                # the curved tile
    lap = np.clip(fy * 1.25, 0, 1) ** .7                      # each tile rises to the next row's lip
    shadow = np.clip((fy - .9) * 10, 0, 1)                    # dark lip under the tile above
    fine, base = fbm(N, rnd, 1.1), fbm(N, rnd, 2.4)
    h = .55 * arch + .25 * lap - .2 * shadow + .06 * fine
    v = (.62 + .38 * arch) * (1 - .45 * shadow) * (.86 + .28 * (per - .5)) * (.92 + .16 * (base - .5)) * (.95 + .1 * (fine - .5))
    gap = np.clip(np.minimum(fx, 1 - fx) * cw / 3, 0, 1)
    v *= .55 + .45 * gap
    return rgb(v * 1.12, (1.0, .97, .93)), (h, 7)


def gen_felt():
    rnd = np.random.default_rng(31)
    base, mid, fine = fbm(N, rnd, 2.5), fbm(N, rnd, 1.5), fbm(N, rnd, .6)
    yy, xx = np.mgrid[0:N, 0:N].astype(np.float32)
    rope = (np.abs(((yy / N * 5 + (base - .5) * .1) % 1) - .5) < .02).astype(np.float32)  # lashing bands
    h = .4 * base + .3 * mid + .3 * fine - .3 * rope
    v = .9 + .1 * (base - .5) + .08 * (mid - .5) + .07 * (fine - .5) - .25 * rope
    return rgb(v, (1.0, .98, .94)), (h, 2.5)


# ---------- layer tables ----------
# name, source (folder or drawn), metres per tile, detail strength k, own colour (0 = all vertex colour)
GROUND = [
    ('meadow', 'ground-meadow', 2.6, 1.25, .4),
    ('patchy', 'ground-grass-patchy', 3.0, 1.2, .35),
    ('sand', 'sand', 3.4, 1.1, .15),
    ('earth', 'dry-earth', 2.6, 1.1, .12),
    ('forest', 'forest-floor-leaves', 1.8, 1.0, .3),
    ('rock', 'rock-cliff-grey', 6.0, 1.15, 0.0),          # v22.2b: photo (was drawn: gen_rock)
    ('setts', 'paving-setts', 2.2, 1.0, .25),
    ('flags', 'paving-rubble', 2.4, 1.0, .25),
    ('fan', 'paving-fan', 2.2, 1.0, .25),
    # v22.2b: snow and regional ground (layers 9-13; weights in aGW2 and the snow test in the terrain shader)
    ('snow', 'snow', 3.0, 1.0, .5),
    ('cracked', 'mud-cracked', 3.2, 1.05, .1),
    ('scree', 'scree', 2.6, 1.1, .1),
    ('steppe', 'steppe-dry', 2.8, 1.15, .2),
    ('loess', 'loess', 3.0, 1.05, .15),
]
BUILD = [
    ('plaster', 'plaster-white', 3.0, 1.0, 0.0),          # v22.2b: photos replace the drawn plaster, mud brick, brick, tile, felt
    ('mudbrick', 'mud-brick-rough', 2.4, 1.0, 0.0),
    ('brick', 'brick-byzantine', 2.0, 1.0, .35),
    ('tile', 'roof-tiles-terracotta', 2.2, 1.0, 0.0),
    ('stoneWarm', 'stone-blocks-warm', 2.6, .85, .3),
    ('rubble', 'stone-rubble-warm', 2.2, .85, .25),
    ('ashlar', 'stone-ashlar-grey', 3.0, .95, .2),
    ('slate', 'stone-wall-slate', 2.2, .95, .2),
    ('planks', 'wood-planks', 2.0, .9, .3),
    ('boards', 'wood-boards-studded', 2.0, .9, .3),
    ('thatch', 'thatch-reed', 2.2, .95, .35),
    ('felt', 'felt', 2.0, 1.0, 0.0),
    # v22.2b: new building layers
    ('tileGrey', 'roof-tiles-grey', 2.2, 1.0, 0.0),
    ('glazed', 'tile-glazed-turquoise', 1.2, 1.0, 0.0),
    ('shingles', 'shingles-wood', 2.0, .95, .2),
    ('mudwall', 'mud-wall-cracked', 3.0, 1.0, 0.0),
    ('brickGrey', 'brick-grey', 2.0, 1.0, .2),
    ('sandstoneRed', 'sandstone-red', 2.6, .9, .3),
]


def prep_colour(name, im):
    a = np.asarray(im).astype(np.float32)
    if name == 'forest':           # autumn leaves -> brown leaf litter (the season shader adds autumn on top)
        l = a.mean(-1, keepdims=True)
        a = l + (a - l) * .3
        a = a * np.array([.92, .86, .72]) * .8
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def build(table):
    out = []
    for name, src, scale, k, own in table:
        if callable(src):
            col, (h, strength) = src()

            hs = np.asarray(Image.fromarray(h.astype(np.float32), "F").resize((NS, NS), Image.BOX))
            nrm = normal_from_height(hs, strength * NS / 64)
        else:
            col, nrm = load(src, 'color.jpg'), load(src, 'normal.jpg')
            if name == 'thatch':
                w, h = col.size
                col, nrm = col.crop((0, int(h * .06), w, h)).resize((w, h)), nrm.crop((0, int(h * .06), w, h)).resize((w, h))
        col = wrap_resize(prep_colour(name, col), CS)
        if nrm.size[0] != NS: nrm = wrap_resize(nrm, NS)
        a = np.asarray(nrm).astype(np.float32) / 127.5 - 1      # remove any overall tilt so a wall stays lit as a wall
        a[..., :2] -= a[..., :2].mean((0, 1)); a[..., 2] = np.maximum(a[..., 2], .2)
        a /= np.linalg.norm(a, axis=-1, keepdims=True)
        nrm = Image.fromarray(np.clip((a + 1) * 127.5, 0, 255).astype(np.uint8))
        mean = srgb_to_lin(np.asarray(col).astype(np.float32)).reshape(-1, 3).mean(0)
        out.append({'name': name, 'scale': scale, 'k': k, 'own': own, 'mean': [round(float(x), 4) for x in mean],
                    'col': webp(col, QC), 'nrm': webp(nrm, QN)})
        print(f'  {name:10s} {len(out[-1]["col"]) // 1024:4d} KB + {len(out[-1]["nrm"]) // 1024:3d} KB  mean {out[-1]["mean"]}')
    return out


def main():
    print('ground'); g = build(GROUND)
    print('build'); b = build(BUILD)
    data = {'cs': CS, 'ns': NS, 'ground': g, 'build': b}
    js = '// GENERATED by tools/textures/build_surfaces.py: do not edit.\nconst SURF_DATA = ' + json.dumps(data, separators=(',', ':')) + ';\n'
    open(OUT, 'w').write(js)
    print(f'wrote {os.path.relpath(OUT, ROOT)}  {len(js) // 1024} KB')
    # contact sheet for checking by eye
    sheet = Image.new('RGB', (len(max(g, b, key=len)) * 128, 4 * 128))
    for row, layers in enumerate((g, b)):
        for i, L in enumerate(layers):
            for j, key in enumerate(('col', 'nrm')):
                im = Image.open(io.BytesIO(base64.b64decode(L[key].split(',')[1]))).convert('RGB').resize((128, 128))
                sheet.paste(im, (i * 128, (row * 2 + j) * 128))
    sheet.save('/tmp/surfaces_sheet.png')


if __name__ == '__main__':
    main()
