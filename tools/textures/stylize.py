"""Stylized look for the photo textures (v22.2d): Valheim plus Sea of Thieves.

Used by build_surfaces.py (ground and building layers) and build_veg_atlas.py (bark and leaf cards).
The steps and the Balanced settings were picked by the user in the mockup on 24 Nov 2026
(https://claude.ai/artifact/JfN8Swwuayp9kq4CUMMv9v; project doc claude/silk-road-stylized-textures-mockup.md):

  1. remove baked lighting   divide the colour by a large blur of its luminance
  2. painterly smoothing      smooth Kuwahara filter (keeps edges, flattens noise inside stones and planks)
  3. contrast, saturation
  4. tone bands               soft luminance quantization
  5. painted edges            raised edges lighter, cracks and joints darker, from the height map's curvature
  6. ground calmness          ground layers only: melt grit into soft patches
  7. bump                     softer, weaker normal map

Radii are in pixels at 512 px; scaled for other sizes. Everything wraps, so tiles stay seamless.
Needs: numpy scipy pillow
"""
import numpy as np
from PIL import Image
from scipy import ndimage

# Balanced, as chosen in the mockup. 'harmony' evens the luminance contrast between ground layers.
STYLE = dict(delight=.6, radius=4, passes=1, bands=6, contrast=.9, sat=1.06, edge=.5, crev=.4,
             bump=.55, bsoft=2, calm=.5, harmony=.7)


def lum(a):
    return a[..., 0] * .2126 + a[..., 1] * .7152 + a[..., 2] * .0722


def blur(a, r, passes=1):
    """Wrap-around box blur over the first two axes."""
    if r < 1:
        return a
    size = (2 * r + 1, 2 * r + 1) + (1,) * (a.ndim - 2)
    for _ in range(passes):
        a = ndimage.uniform_filter(a, size=size, mode='wrap')
    return a


def kuwahara(col, r):
    """Smooth Kuwahara: four overlapping quadrants, weighted by 1 / variance^2 (luminance variance)."""
    if r < 1:
        return col
    L = lum(col)
    chans = [col[..., 0], col[..., 1], col[..., 2], L, L * L]
    k = r + 1
    # quadrant means via a (k x k) box filter, then shifted so each pixel sees the quadrant on each side
    means = [ndimage.uniform_filter(c, size=k, mode='wrap') for c in chans]
    # uniform_filter's window at c covers [c - k//2, c - k//2 + r]; the quadrant [x, x + r] is the window at
    # c = x + k//2 and [x - r, x] the one at c = x + k//2 - r
    acc = np.zeros_like(col); wsum = np.zeros(L.shape, np.float64)
    for oy in (k // 2, k // 2 - r):
        for ox in (k // 2, k // 2 - r):
            sh = [np.roll(m, (-oy, -ox), (0, 1)) for m in means]
            v = np.maximum(sh[4] - sh[3] ** 2, 0)
            w = 1.0 / (v + 2e-4) ** 2
            acc += np.stack(sh[:3], -1) * w[..., None]; wsum += w
    return acc / wsum[..., None]


def height_from_normal(nrm):
    """Tileable height (0..1) by integrating an OpenGL normal map's slopes in the Fourier domain."""
    v = nrm.astype(np.float64) / 127.5 - 1
    nz = np.clip(v[..., 2], .2, 1)
    gx, gy = -v[..., 0] / nz, v[..., 1] / nz
    H, W = gx.shape
    fx = np.fft.fftfreq(W)[None, :] * 2 * np.pi
    fy = np.fft.fftfreq(H)[:, None] * 2 * np.pi
    d = fx ** 2 + fy ** 2; d[0, 0] = 1
    F = (-1j * fx * np.fft.fft2(gx) - 1j * fy * np.fft.fft2(gy)) / d; F[0, 0] = 0
    h = np.fft.ifft2(F).real
    lo, hi = np.percentile(h, 1), np.percentile(h, 99)
    return np.clip((h - lo) / max(hi - lo, 1e-6), 0, 1)


def seam_ratio(a):
    """How much worse the wrap-around edges match than the inside (1 = seamless)."""
    g = lum(a.astype(np.float64)) if a.ndim == 3 else a.astype(np.float64)
    H, W = g.shape
    ix = np.abs(g[:, W // 2] - g[:, W // 2 + 1]).mean() + 1e-3
    iy = np.abs(g[H // 2] - g[H // 2 + 1]).mean() + 1e-3
    return np.abs(g[:, 0] - g[:, -1]).mean() / ix, np.abs(g[0] - g[-1]).mean() / iy


def make_tileable(ims, frac=1 / 10, thresh=2.0):
    """Remove the repeat seam of non-tileable photos: crossfade a band at the end into the start.
    `ims` is a list of same-size PIL images (colour, normal, ...) handled alike; the first decides."""
    a0 = np.asarray(ims[0])
    rx, ry = seam_ratio(a0)
    arrs = [np.asarray(im).astype(np.float32) for im in ims]
    for axis, r in ((1, rx), (0, ry)):
        if r < thresh:
            continue
        n = arrs[0].shape[axis]; b = int(n * frac)
        t0 = np.linspace(0, 1, b, endpoint=False)
        out = []
        for a in arrs:
            shape = [1] * a.ndim; shape[axis] = b; t = t0.reshape(shape)
            body = np.take(a, range(b, n), axis=axis)                 # drop the first b
            head = np.take(a, range(0, b), axis=axis)                 # ...and fade the end into them
            tail = np.take(body, range(n - 2 * b, n - b), axis=axis)
            mixed = tail * (1 - t) + head * t
            body = np.concatenate([np.take(body, range(0, n - 2 * b), axis=axis), mixed], axis=axis)
            out.append(body)
        arrs = out
    res = []
    for im, a in zip(ims, arrs):
        r = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), im.mode)
        res.append(r.resize(im.size, Image.LANCZOS) if r.size != im.size else r)
    return res, (rx, ry)


def stylize_colour(col8, height, ground=False, S=STYLE):
    """col8: HxWx3 uint8 (sRGB), height: HxW 0..1 at the same size. Returns uint8."""
    n = col8.shape[0]; k = n / 512.0
    R = lambda r: max(0, int(round(r * k)))
    col = col8.astype(np.float64) / 255
    # 1. remove baked lighting
    if S['delight'] > 0:
        L = lum(col); Lb = blur(L, R(28), 2)
        f = 1 + S['delight'] * (L.mean() / np.maximum(Lb, .02) - 1)
        col = col * f[..., None]
    # 2. painterly smoothing
    for _ in range(S['passes']):
        col = kuwahara(col, R(S['radius']))
    # 3. contrast and saturation, 4. tone bands
    L = lum(col); m = L.mean(); lo, hi = np.percentile(L, 2), np.percentile(L, 98)
    L2 = m + (L - m) * S['contrast']
    if S['bands'] >= 2:
        nb = S['bands']; ln = np.clip((L2 - lo) / max(hi - lo, .02), 0, 1) * nb
        fl = np.floor(ln); f = ln - fl
        t = np.clip((f - .2) / .6, 0, 1); t = t * t * (3 - 2 * t)
        q = (np.minimum(fl, nb - 1) + t) / nb
        L2 = L2 + .7 * (lo + q * (hi - lo) - L2)
    col = col * (L2 / np.maximum(L, 1e-3))[..., None]
    col = L2[..., None] + (col - L2[..., None]) * S['sat']
    # 5. painted edges and crevices
    if height is not None and (S['edge'] > 0 or S['crev'] > 0):
        hs = blur(height, max(1, R(S['radius'] / 2)))
        lap = hs - blur(hs, R(4), 2)
        c = np.clip(lap / (1.6 * (lap.std() or 1)), -1, 1)
        up = np.maximum(c, 0) * S['edge'] * .5; dn = np.maximum(-c, 0) * S['crev'] * .65
        col = (col * (1 + .45 * up[..., None]) + .02 * up[..., None]) * (1 - dn[..., None])
    # 6. ground calmness
    if ground and S['calm'] > 0:
        col = col + (blur(col, R(4), 2) - col) * S['calm']
    return np.clip(col * 255, 0, 255).astype(np.uint8)


def stylize_normal(nrm8, S=STYLE):
    """Softer, weaker OpenGL normal map (xy only; z rebuilt). Returns float xyz in -1..1."""
    n = nrm8.shape[0]; k = n / 512.0
    v = nrm8.astype(np.float64) / 127.5 - 1
    xy = blur(v[..., :2], max(0, int(round(S['bsoft'] * k)))) * S['bump']
    z = np.sqrt(np.clip(1 - (xy ** 2).sum(-1), .04, 1))
    out = np.dstack([xy, z])
    return out / np.linalg.norm(out, axis=-1, keepdims=True)


def harmonize(cols, amount):
    """Pull the luminance contrast (std) of several uint8 layers toward their common mean. In-place list."""
    sds = [lum(c.astype(np.float64)).std() for c in cols]
    target = float(np.mean(sds))
    out = []
    for c, sd in zip(cols, sds):
        a = c.astype(np.float64); L = lum(a); m = L.mean()
        ks = 1 + (target / max(sd, 1e-3) - 1) * amount
        L2 = m + (L - m) * ks
        out.append(np.clip(a * (L2 / np.maximum(L, 1e-3))[..., None], 0, 255).astype(np.uint8))
    return out
