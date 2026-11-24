#!/usr/bin/env python3
"""Build the vegetation atlas (v22.1): bark, leaf clusters, conifer needles, palm fronds, ferns.

    python3 tools/textures/build_veg_atlas.py

Writes src/veg_atlas.js (a data-URI WebP plus the cell table) which build.py inlines into the page.
1024x1024 RGBA, 4x4 cells of 256 px. The bottom-left cell is plain white: geometry without UVs
(everything built before v22.1) samples texel (0,0) and so stays vertex-coloured.

Sources are the CC0 textures in assets/textures/. Cards the pack lacks (conifer needles, palm frond, fern,
cypress scale-leaf, pine needles) are drawn here with fixed seeds so the build is reproducible.
Needs: pillow numpy scipy
"""
import os, io, json, math, base64, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TEX = os.path.join(ROOT, 'assets', 'textures')
S = 256              # cell size
SS = 2               # supersampling for drawn cards

# name -> (col, row) from the top-left of the image
LAYOUT = {
    'barkPine': (0, 0), 'barkPale': (1, 0), 'barkSakura': (2, 0), 'barkRough': (3, 0),
    'leafA': (0, 1), 'leafB': (1, 1), 'leafNarrow': (2, 1), 'leafC': (3, 1),
    'needle': (0, 2), 'needlePine': (1, 2), 'scale': (2, 2), 'frond': (3, 2),
    'fern': (1, 3), 'leafSmall': (2, 3), 'rock': (3, 3),
    'white': (0, 3),
}
TILED = {'barkPine', 'barkPale', 'barkSakura', 'barkRough', 'rock'}   # wrap in the shader (fract)


def tex(path):
    return Image.open(os.path.join(TEX, path))


def tile(path, size=S, tint=None, gain=1.0):
    im = tex(path).convert('RGB').resize((size, size), Image.LANCZOS)
    a = np.asarray(im).astype(np.float32) * gain
    if tint is not None:
        a = a * np.array(tint, np.float32)
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def sprites(color_path, opacity_path, min_px=900):
    """Cut the individual leaves out of a leaf sheet: list of RGBA PIL images, tight crops."""
    col = np.asarray(tex(color_path).convert('RGB'))
    op = np.asarray(tex(opacity_path).convert('L'))
    lab, n = ndimage.label(op > 128)
    out = []
    for i, sl in enumerate(ndimage.find_objects(lab), 1):
        m = lab[sl] == i
        if m.sum() < min_px:
            continue
        rgb = col[sl]
        mean = rgb[m].astype(np.float32).mean(0)
        if mean.mean() > 175 or mean[1] < mean[2] + 6:     # skip white scraps and non-green bits
            continue
        if max(m.shape) < 3 * min(m.shape) and m.sum() < min_px * 1.5 and mean.mean() > 150:
            continue
        a = (op[sl].astype(np.float32) * m)
        out.append(Image.fromarray(np.dstack([rgb, a.astype(np.uint8)]), 'RGBA'))
    return out


def dilate_colour(rgba, passes=3, radius=5):
    """Bleed leaf colour into the transparent margin so mip levels and filtering show no dark halos."""
    a = np.asarray(rgba).astype(np.float32)
    rgb, al = a[..., :3], a[..., 3] / 255.0
    for _ in range(passes):
        w = ndimage.gaussian_filter(al, radius)
        c = np.stack([ndimage.gaussian_filter(rgb[..., k] * al, radius) for k in range(3)], -1) / np.maximum(w[..., None], 1e-4)
        hole = al < 0.5
        rgb = np.where(hole[..., None], c, rgb)
        al = np.maximum(al, np.where(hole, np.minimum(w, 0.49), al))
    out = np.dstack([np.clip(rgb, 0, 255), a[..., 3]]).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')


def finish(img):
    """Downsample a supersampled RGBA card to the cell size and dilate its colour."""
    img = img.resize((S, S), Image.LANCZOS)
    return dilate_colour(img)


def shade(im, k):
    a = np.asarray(im).astype(np.float32)
    a[..., :3] *= k
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')


def leaf_cluster(sp, seed, n=34, leaf_px=(34, 50), tint=(1, 1, 1), darken=0.0, spread=0.9):
    """A foliage card: many real leaves scattered over a twig, with gaps for light."""
    rnd = random.Random(seed)
    big = Image.new('RGBA', (S * SS, S * SS), (0, 0, 0, 0))
    cx = S * SS / 2
    d = ImageDraw.Draw(big)
    # twig
    d.line([(cx, S * SS * 0.97), (cx + rnd.uniform(-12, 12), S * SS * 0.45), (cx, S * SS * 0.08)], fill=(70, 56, 40, 255), width=5)
    order = []
    for i in range(n):
        t = i / n
        ang = rnd.uniform(0, math.tau)
        rr = (rnd.random() ** 0.6) * spread * S * SS * 0.46
        x = cx + math.cos(ang) * rr * 0.9
        y = S * SS * 0.5 + math.sin(ang) * rr * 1.0
        order.append((rr, x, y))
    order.sort(key=lambda o: -o[0])          # outer leaves first, inner on top
    for rr, x, y in order:
        s = rnd.choice(sp)
        L = rnd.uniform(*leaf_px) * SS
        k = L / max(s.size)
        im = s.resize((max(2, int(s.width * k)), max(2, int(s.height * k))), Image.LANCZOS)
        shade_k = rnd.uniform(0.78, 1.12) * (1 - darken * (1 - rr / (S * SS * 0.5)))
        im = shade(im, shade_k)
        a = np.asarray(im).astype(np.float32)
        a[..., :3] *= np.array(tint, np.float32)
        im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')
        # point the leaf away from the centre, with some wobble
        base = math.degrees(math.atan2(y - S * SS / 2, x - cx)) + 90
        im = im.rotate(-base + rnd.uniform(-40, 40) + 180, expand=True, resample=Image.BICUBIC)
        big.alpha_composite(im, (int(x - im.width / 2), int(y - im.height / 2)))
    return finish(big)


# ---------- procedural cards ----------

def needle_card(seed, length=0.92, twigs=20, needle=17, col=(44, 88, 56), tip=(112, 158, 88), width=3.6, spread=62, dense=7.5):
    """A fir / spruce branch: stem up the card with side twigs, each fringed with needles."""
    rnd = random.Random(seed)
    W = S * SS
    img = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    x0, y0 = W / 2, W * 0.985
    y1 = W * (0.985 - length)

    def mix(c1, c2, t):
        return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))

    def twig(x, y, ang, L, depth):
        # a short twig: axis plus needles on both sides
        steps = max(3, int(L / (dense * SS * 0.55)))
        d.line([(x, y), (x + math.sin(ang) * L, y - math.cos(ang) * L)], fill=mix((60, 46, 34), col, 0.4) + (255,), width=int(2.4 * SS))
        for k in range(steps):
            t = k / steps
            px, py = x + math.sin(ang) * L * t, y - math.cos(ang) * L * t
            nl = needle * SS * (0.45 + 0.55 * math.sin(math.pi * min(1, t * 1.1 + 0.15))) * rnd.uniform(0.8, 1.15)
            for side in (-1, 1):
                a2 = ang + side * math.radians(spread + rnd.uniform(-14, 14))
                ex, ey = px + math.sin(a2) * nl, py - math.cos(a2) * nl
                c = mix(col, tip, min(1, t * 0.8 + rnd.uniform(0, 0.25)))
                d.line([(px, py), (ex, ey)], fill=c + (255,), width=int(width * SS))

    # main axis
    d.line([(x0, y0), (x0, y1)], fill=(70, 52, 38, 255), width=int(3.4 * SS))
    for k in range(twigs):
        t = (k + 0.5) / twigs
        y = y0 - (y0 - y1) * t
        L = (W * 0.46) * (1 - t * 0.78) * rnd.uniform(0.85, 1.05)
        for side in (-1, 1):
            if rnd.random() < 0.94:
                twig(x0, y, side * math.radians(rnd.uniform(52, 66)), L, 1)
    twig(x0, y1 + 6, 0, W * 0.07, 1)
    return finish(img)


def pine_card(seed):
    """Long needle sprays for stone pine / umbrella pine: tufts of bundled needles along a stem."""
    rnd = random.Random(seed)
    W = S * SS
    img = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    x0, y0, y1 = W / 2, W * 0.98, W * 0.06
    d.line([(x0, y0), (x0 + 8, W * 0.5), (x0, y1)], fill=(96, 70, 48, 255), width=int(4 * SS))
    for k in range(13):
        t = (k + 0.5) / 13
        y = y0 - (y0 - y1) * t
        xb = x0 + 8 * math.sin(t * math.pi)
        for side in (-1, 1):
            a = side * math.radians(rnd.uniform(30, 62))
            L = W * 0.34 * (1 - t * 0.6)
            ex, ey = xb + math.sin(a) * L * 0.5, y - math.cos(a) * L * 0.5
            d.line([(xb, y), (ex, ey)], fill=(96, 70, 48, 255), width=int(2 * SS))
            for n in range(9):                          # tuft of long needles
                a2 = a + math.radians(rnd.uniform(-48, 48))
                nl = L * rnd.uniform(0.7, 1.0) * 0.8
                c = (rnd.randint(48, 70), rnd.randint(92, 120), rnd.randint(50, 66))
                d.line([(ex, ey), (ex + math.sin(a2) * nl, ey - math.cos(a2) * nl)], fill=c + (255,), width=int(1.8 * SS))
    return finish(img)


def scale_card(seed):
    """Cypress / juniper scale-leaf spray: fine, dense, dark flat sprays."""
    rnd = random.Random(seed)
    W = S * SS
    img = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    def spray(x, y, ang, L, w, depth):
        n = int(L / (7 * SS))
        for k in range(n):
            t = k / max(1, n - 1)
            px, py = x + math.sin(ang) * L * t, y - math.cos(ang) * L * t
            sl = w * (1 - 0.5 * t)
            for side in (-1, 1):
                a2 = ang + side * math.radians(rnd.uniform(40, 70))
                c = (rnd.randint(40, 58), rnd.randint(78, 100), rnd.randint(50, 66))
                d.line([(px, py), (px + math.sin(a2) * sl, py - math.cos(a2) * sl)], fill=c + (255,), width=int(4.4 * SS))
        d.line([(x, y), (x + math.sin(ang) * L, y - math.cos(ang) * L)], fill=(52, 42, 32, 255), width=int(2.4 * SS))
    x0, y0 = W / 2, W * 0.985
    spray(x0, y0, 0, W * 0.9, W * 0.1, 0)
    for k in range(9):
        t = (k + 0.7) / 9.6
        for side in (-1, 1):
            spray(x0, y0 - W * 0.9 * t, side * math.radians(rnd.uniform(45, 62)), W * 0.42 * (1 - t * 0.7), W * 0.075, 1)
    return finish(img)


def frond_card(seed, leaflets=36, col=(58, 104, 46), tipc=(124, 160, 76), arch=0.09):
    """Pinnate palm frond (date, coconut): curved rachis with a ladder of long leaflets."""
    rnd = random.Random(seed)
    W = S * SS
    img = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pts = []
    for k in range(60):
        t = k / 59
        pts.append((W * 0.5 + math.sin(t * 2.2) * W * arch * t, W * 0.985 - t * W * 0.95))
    d.line(pts, fill=(112, 96, 56, 255), width=int(4 * SS))
    for k in range(leaflets):
        t = 0.1 + 0.88 * k / leaflets
        i = int(t * 59)
        px, py = pts[i]
        qx, qy = pts[min(59, i + 1)]
        ang = math.atan2(qx - px, py - qy)
        Lmax = W * 0.40 * math.sin(math.pi * (0.12 + 0.88 * t)) ** 0.6
        for side in (-1, 1):
            a2 = ang + side * math.radians(rnd.uniform(52, 68) - t * 18)
            L = Lmax * rnd.uniform(0.85, 1.0)
            c = tuple(int(col[j] + (tipc[j] - col[j]) * rnd.uniform(0.0, 0.7)) for j in range(3))
            ex, ey = px + math.sin(a2) * L, py - math.cos(a2) * L + L * 0.22   # leaflets droop
            d.line([(px, py), ((px + ex) / 2, (py + ey) / 2 - L * 0.06), (ex, ey)], fill=c + (255,), width=int(6.2 * SS))
    return finish(img)


def fern_card(seed):
    """A single fern frond: a finer, lighter, more arched pinnate card."""
    rnd = random.Random(seed)
    W = S * SS
    img = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pts = [(W * 0.5 + math.sin(t * 1.6) * W * 0.14 * t, W * 0.985 - t * W * 0.95) for t in [k / 59 for k in range(60)]]
    d.line(pts, fill=(72, 92, 44, 255), width=int(3 * SS))
    for k in range(34):
        t = 0.06 + 0.92 * k / 34
        i = int(t * 59)
        px, py = pts[i]
        qx, qy = pts[min(59, i + 1)]
        ang = math.atan2(qx - px, py - qy)
        Lm = W * 0.26 * math.sin(math.pi * (0.05 + 0.95 * t)) ** 0.7
        for side in (-1, 1):
            a2 = ang + side * math.radians(rnd.uniform(62, 78) - t * 22)
            L = Lm * rnd.uniform(0.85, 1.0)
            c = (rnd.randint(70, 96), rnd.randint(124, 150), rnd.randint(52, 70))
            d.line([(px, py), (px + math.sin(a2) * L, py - math.cos(a2) * L + L * 0.1)], fill=c + (255,), width=int(5 * SS))
    return finish(img)


def fbm_tile(size, rnd, beta=2.3):
    """Tileable 1/f noise in [0, 1] from filtered white noise (periodic by construction)."""
    f = np.fft.fftfreq(size)[:, None] ** 2 + np.fft.fftfreq(size)[None, :] ** 2
    f[0, 0] = 1
    spec = np.fft.fft2(rnd.standard_normal((size, size))) / (f ** (beta / 2))
    spec[0, 0] = 0
    a = np.fft.ifft2(spec).real
    a = (a - a.min()) / (a.max() - a.min())
    return a


def rock_cell():
    """Natural grey rock: soft mottling, strata, dark cracks (wrapped voronoi edges) and speckle. Tileable."""
    rnd = np.random.default_rng(5)
    n = S
    base = fbm_tile(n, rnd, 2.6)
    mid = fbm_tile(n, rnd, 1.8)
    fine = fbm_tile(n, rnd, 1.1)
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    pts = rnd.random((15, 2)) * n
    wx = (fbm_tile(n, rnd, 2.0) - 0.5) * 70; wy = (fbm_tile(n, rnd, 2.0) - 0.5) * 70
    xx = (xx + wx) % n; yy = (yy + wy) % n
    d = np.full((n, n), 1e9, np.float32); d2 = d.copy()
    for px, py in pts:
        dx = np.minimum(abs(xx - px), n - abs(xx - px)); dy = np.minimum(abs(yy - py), n - abs(yy - py))
        r = np.sqrt(dx * dx + dy * dy)
        d2 = np.minimum(d2, np.maximum(d, r)); d = np.minimum(d, r)
    edge = np.clip((d2 - d) / 3.5, 0, 1)                      # 0 on a crack
    strata = 0.5 + 0.5 * np.sin((yy / n) * 2 * np.pi * 6 + base * 5)
    v = 0.50 + 0.42 * (base - 0.5) + 0.26 * (mid - 0.5) + 0.16 * (fine - 0.5) + 0.06 * (strata - 0.5)
    v = v * (0.72 + 0.28 * edge)
    img = np.stack([v * 1.04, v * 1.0, v * 0.95], -1) * 255 * 1.22
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))


def main():
    cells = {}
    # bark: pine bark is orange-red when raw; tame it towards a natural brown-grey
    cells['barkPine'] = tile('bark-pine/color.jpg', tint=(0.78, 0.74, 0.72), gain=0.95).convert('RGBA')
    cells['barkPale'] = tile('bark-pale/color.jpg', gain=0.92).convert('RGBA')
    cells['barkSakura'] = tile('bark-sakura/color.jpg', gain=0.9).convert('RGBA')
    cells['barkRough'] = tile('tree-island-01/branches/color.jpg', gain=0.95).convert('RGBA')
    cells['rock'] = rock_cell().convert('RGBA')

    spA = sprites('leaves-broadleaf/color.jpg', 'leaves-broadleaf/opacity.png')
    spB = sprites('tree-island-01/leaves/color.jpg', 'tree-island-01/leaves/opacity.png')
    print('leaf sprites:', len(spA), len(spB))
    cells['leafA'] = leaf_cluster(spA, 11, n=40, leaf_px=(40, 58), tint=(0.96, 1.0, 0.9), darken=0.25)
    cells['leafB'] = leaf_cluster(spB, 12, n=44, leaf_px=(40, 62), tint=(1.0, 1.0, 0.92), darken=0.25)
    cells['leafNarrow'] = leaf_cluster(spB, 13, n=70, leaf_px=(28, 44), tint=(0.98, 1.0, 0.92), darken=0.2, spread=1.0)
    cells['leafC'] = leaf_cluster(spA, 14, n=46, leaf_px=(36, 52), tint=(0.62, 0.78, 0.6), darken=0.3)
    cells['leafSmall'] = leaf_cluster(spB, 15, n=90, leaf_px=(20, 30), tint=(1.0, 1.0, 0.85), darken=0.15, spread=1.0)
    cells['needle'] = needle_card(21)
    cells['needlePine'] = pine_card(22)
    cells['scale'] = scale_card(23)
    cells['frond'] = frond_card(24)
    cells['fern'] = fern_card(25)
    cells['white'] = Image.new('RGBA', (S, S), (255, 255, 255, 255))

    atlas = Image.new('RGBA', (S * 4, S * 4), (255, 255, 255, 255))
    for name, (c, r) in LAYOUT.items():
        atlas.paste(cells[name], (c * S, r * S))
    os.makedirs(os.path.join(ROOT, 'assets', 'gen'), exist_ok=True)
    atlas.save(os.path.join(ROOT, 'assets', 'gen', 'veg-atlas.png'))
    buf = io.BytesIO()
    atlas.save(buf, 'WEBP', quality=84, method=6, alpha_quality=92)
    data = buf.getvalue()
    print('webp bytes', len(data))
    # cell table in UV space (flipY): u0, v0, du, dv, with a half-texel inset
    ins = 1.5 / (S * 4)
    table = {}
    for name, (c, r) in LAYOUT.items():
        u0 = c * 0.25 + ins
        v0 = 1 - (r + 1) * 0.25 + ins
        table[name] = [round(u0, 5), round(v0, 5), round(0.25 - 2 * ins, 5), round(0.25 - 2 * ins, 5), 1 if name in TILED else 0]
    js = ('// GENERATED by tools/textures/build_veg_atlas.py: do not edit.\n'
          'const VEG_ATLAS = { uri: "data:image/webp;base64,' + base64.b64encode(data).decode() + '", cells: ' + json.dumps(table) + ' };\n')
    open(os.path.join(ROOT, 'src', 'veg_atlas.js'), 'w').write(js)
    print('src/veg_atlas.js', len(js))


if __name__ == '__main__':
    main()
