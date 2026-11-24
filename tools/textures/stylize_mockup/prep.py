#!/usr/bin/env python3
"""Prepare textures for the stylize mockup: colour, normal and a height map (integrated from the normal map) at 512 px."""
import os, io, json, base64, sys
import numpy as np
from PIL import Image

TEX = '/home/claude/silk-road-game/assets/textures'
S = 512
LIST = [
    # key, folder, label, group, metres per tile (from build_surfaces.py)
    ('meadow', 'ground-meadow', 'Meadow', 'ground', 2.6),
    ('steppe', 'steppe-dry', 'Dry steppe', 'ground', 2.8),
    ('sand', 'sand', 'Sand', 'ground', 3.4),
    ('earth', 'dry-earth', 'Dry earth', 'ground', 2.6),
    ('rock', 'rock-cliff-grey', 'Cliff rock', 'ground', 6.0),
    ('setts', 'paving-setts', 'Paving setts', 'ground', 2.2),
    ('flags', 'paving-rubble', 'Flagstones', 'ground', 2.4),
    ('mudbrick', 'mud-brick-rough', 'Mud brick', 'build', 2.4),
    ('brick', 'brick-byzantine', 'Byzantine brick', 'build', 2.0),
    ('stone', 'stone-blocks-warm', 'Stone blocks', 'build', 2.6),
    ('tile', 'roof-tiles-terracotta', 'Roof tiles', 'build', 2.2),
    ('planks', 'wood-planks', 'Planks', 'build', 2.0),
    ('thatch', 'thatch-reed', 'Thatch', 'build', 2.2),
    ('conifer', 'conifer-spray', 'Conifer card', 'veg', 1.0),
]


def squared(im):
    w, h = im.size
    if w == h:
        return im
    s = max(w, h)
    out = Image.new(im.mode, (s, s))
    for y in range(0, s, h):
        for x in range(0, s, w):
            out.paste(im, (x, y))
    return out


def wrap_resize(im, size):
    w, h = im.size
    big = Image.new(im.mode, (w * 3, h * 3))
    for j in range(3):
        for i in range(3):
            big.paste(im, (i * w, j * h))
    big = big.resize((size * 3, size * 3), Image.LANCZOS)
    return big.crop((size, size, size * 2, size * 2))


def height_from_normal(n):
    """Tileable height by integrating the OpenGL normal map's slopes in the Fourier domain."""
    v = n.astype(np.float64) / 127.5 - 1
    nz = np.clip(v[..., 2], .2, 1)
    gx = -v[..., 0] / nz          # dh/dx
    gy = v[..., 1] / nz           # dh/dy with rows going down (green points up the image)
    H, W = gx.shape
    fx = np.fft.fftfreq(W)[None, :] * 2 * np.pi
    fy = np.fft.fftfreq(H)[:, None] * 2 * np.pi
    d = fx ** 2 + fy ** 2
    d[0, 0] = 1
    Fh = (-1j * fx * np.fft.fft2(gx) - 1j * fy * np.fft.fft2(gy)) / d
    Fh[0, 0] = 0
    h = np.fft.ifft2(Fh).real
    lo, hi = np.percentile(h, 1), np.percentile(h, 99)
    return np.clip((h - lo) / (hi - lo), 0, 1)


def uri(im, q=82, lossless=False):
    b = io.BytesIO()
    im.save(b, 'WEBP', quality=q, method=6, lossless=lossless)
    return 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode()


out = []
for key, folder, label, group, m in LIST:
    p = os.path.join(TEX, folder)
    col = squared(Image.open(os.path.join(p, 'color.jpg')).convert('RGB'))
    nrm = squared(Image.open(os.path.join(p, 'normal.jpg')).convert('RGB'))
    h = height_from_normal(np.asarray(nrm))
    if os.path.exists(os.path.join(p, 'ao.jpg')):   # blend in AO a little: cracks read lower
        ao = np.asarray(squared(Image.open(os.path.join(p, 'ao.jpg')).convert('L')), np.float64) / 255
        h = .7 * h + .3 * ao
    lum = np.asarray(col.convert('L'), np.float64) / 255
    h = np.clip(.85 * h + .15 * lum, 0, 1)
    himg = Image.fromarray((h * 255).astype(np.uint8))
    rec = {'key': key, 'label': label, 'group': group, 'm': m}
    if group == 'veg':
        a = Image.open(os.path.join(p, 'opacity.png')).convert('L')
        c = col.resize((S, S), Image.LANCZOS).convert('RGBA')
        c.putalpha(a.resize((S, S), Image.LANCZOS))
        rec['col'] = uri(c, 85)
        rec['nrm'] = uri(nrm.resize((S, S), Image.LANCZOS))
        rec['h'] = uri(himg.resize((S, S), Image.LANCZOS).convert('RGB'))
    else:
        rec['col'] = uri(wrap_resize(col, S), 85)
        rec['nrm'] = uri(wrap_resize(nrm, S))
        rec['h'] = uri(wrap_resize(himg, S).convert('RGB'))
    out.append(rec)
    print(key, sum(len(rec[k]) for k in ('col', 'nrm', 'h')) // 1024, 'KB', file=sys.stderr)

open('/home/claude/mock/texdata.js', 'w').write('const TEX = ' + json.dumps(out) + ';\n')
