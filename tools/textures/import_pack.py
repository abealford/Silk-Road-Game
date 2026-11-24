"""Import downloaded CC0 texture folders (Poly Haven / ambientCG) into assets/textures/<slug>/.

Keeps only what the game needs, at the download's 1K size:
  color.jpg, normal.jpg (OpenGL convention), rough.jpg, ao.jpg (if given), opacity.png (if given).
Drops .blend/.usdc/.mtlx/.tres, displacement, DirectX normals and previews. EXR maps are converted to 8-bit.

usage: python3 tools/textures/import_pack.py <unzipped pack folder>
Needs: pip install OpenEXR pillow numpy
"""
import os, sys, glob, json
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'assets', 'textures')

# source folder -> (slug, what it is, site page)
MAP = {
    'Ground003_1K-JPG': ('ground-meadow', 'grass and dirt meadow ground', 'https://ambientcg.com/view?id=Ground003'),
    'Ground037_1K-JPG': ('ground-grass-patchy', 'patchy grass over dirt', 'https://ambientcg.com/view?id=Ground037'),
    'Ground080_1K-JPG': ('sand', 'rippled desert sand', 'https://ambientcg.com/view?id=Ground080'),
    'Ground111_1K-JPG': ('dry-earth', 'dry reddish earth and gravel', 'https://ambientcg.com/view?id=Ground111'),
    'LeafSet024_1K-JPG': ('leaves-broadleaf', 'broadleaf leaf set with opacity', 'https://ambientcg.com/view?id=LeafSet024'),
    'PavingStones138_1K-JPG': ('paving-setts', 'stone setts in rows', 'https://ambientcg.com/view?id=PavingStones138'),
    'PavingStones150_1K-JPG': ('paving-fan', 'small cobbles in fan arcs', 'https://ambientcg.com/view?id=PavingStones150'),
    'PavingStones153_1K-JPG': ('paving-rubble', 'irregular flagstones', 'https://ambientcg.com/view?id=PavingStones153'),
    'ScatteredLeaves008_1K-JPG': ('forest-floor-leaves', 'autumn leaves on the ground', 'https://ambientcg.com/view?id=ScatteredLeaves008'),
    'castle_wall_slates_1k': ('stone-wall-slate', 'grey rubble wall of slates', 'https://polyhaven.com/a/castle_wall_slates'),
    'grass_medium_01_1k': ('grass-blades', 'grass blade atlas with alpha (for grass cards)', 'https://polyhaven.com/a/grass_medium_01'),
    'medieval_blocks_02_1k': ('stone-rubble-warm', 'warm limestone rubble wall', 'https://polyhaven.com/a/medieval_blocks_02'),
    'medieval_blocks_03_1k': ('stone-ashlar-grey', 'grey squared ashlar blocks', 'https://polyhaven.com/a/medieval_blocks_03'),
    'medieval_blocks_05_1k': ('stone-blocks-warm', 'warm limestone blocks (Acre, the Levant)', 'https://polyhaven.com/a/medieval_blocks_05'),
    'medieval_wood_1k': ('wood-boards-studded', 'vertical boards with iron studs (doors)', 'https://polyhaven.com/a/medieval_wood'),
    'pine_bark_1k': ('bark-pine', 'pine bark', 'https://polyhaven.com/a/pine_bark'),
    'reed_roof_04_1k': ('thatch-reed', 'reed thatch roof', 'https://polyhaven.com/a/reed_roof_04'),
    'sakura_bark_1k': ('bark-sakura', 'smooth brown bark (fruit trees, broadleaf)', 'https://polyhaven.com/a/sakura_bark'),
    'tree_bark_03_1k': ('bark-pale', 'pale bark with moss (poplar, beech)', 'https://polyhaven.com/a/tree_bark_03'),
    'wood_planks_1k': ('wood-planks', 'horizontal wooden planks', 'https://polyhaven.com/a/wood_planks'),
    # second pack (24 Nov 2026), downloaded by Claude from Poly Haven
    'rock_face_03_1k': ('rock-cliff-pale', 'pale limestone cliff face', 'https://polyhaven.com/a/rock_face_03'),
    'cliff_side_1k': ('rock-cliff-layered', 'brown layered sedimentary cliff', 'https://polyhaven.com/a/cliff_side'),
    'lichen_rock_1k': ('rock-dark-lichen', 'dark rock with lichen (Caucasus, north)', 'https://polyhaven.com/a/lichen_rock'),
    'snow_02_1k': ('snow', 'clean packed snow', 'https://polyhaven.com/a/snow_02'),
    'white_plaster_02_1k': ('plaster-white', 'white lime plaster', 'https://polyhaven.com/a/white_plaster_02'),
    'clay_plaster_1k': ('plaster-mud', 'brown mud render', 'https://polyhaven.com/a/clay_plaster'),
    'damaged_plaster_1k': ('plaster-over-brick', 'worn plaster showing brick (Byzantine)', 'https://polyhaven.com/a/damaged_plaster'),
    'clay_block_wall_1k': ('mud-wall-cracked', 'cracked mud wall (Persia, Central Asia)', 'https://polyhaven.com/a/clay_block_wall'),
    'rough_plaster_brick_02_1k': ('mud-brick-rough', 'rough brick with mud plaster', 'https://polyhaven.com/a/rough_plaster_brick_02'),
    'medieval_red_brick_1k': ('brick-byzantine', 'thin dark red brick (Byzantine)', 'https://polyhaven.com/a/medieval_red_brick'),
    'clay_roof_tiles_02_1k': ('roof-tiles-terracotta', 'orange barrel roof tiles', 'https://polyhaven.com/a/clay_roof_tiles_02'),
    'roof_tiles_14_1k': ('roof-tiles-grey', 'dark grey roof tiles (China)', 'https://polyhaven.com/a/roof_tiles_14'),
    'tiger_rock_1k': ('rock-red', 'red-brown rock (Anatolia, Persia)', 'https://polyhaven.com/a/tiger_rock'),
    'sandstone_cracks_1k': ('rock-ochre', 'ochre sandstone (Tarim, desert)', 'https://polyhaven.com/a/sandstone_cracks'),
    'rocky_trail_1k': ('scree', 'tan gravel and scree', 'https://polyhaven.com/a/rocky_trail'),
    'mud_cracked_dry_03_1k': ('mud-cracked', 'cracked dry mud (desert)', 'https://polyhaven.com/a/mud_cracked_dry_03'),
    'dry_ground_01_1k': ('salt-flat', 'grey cracked flat (salt pans, Lop Nur)', 'https://polyhaven.com/a/dry_ground_01'),
    'withered_grass_1k': ('steppe-dry', 'pale withered grass (steppe)', 'https://polyhaven.com/a/withered_grass'),
    'leafy_grass_1k': ('grass-sparse-dry', 'sparse dry grass and earth', 'https://polyhaven.com/a/leafy_grass'),
    'forrest_ground_03_1k': ('loess', 'pale yellow earth (loess, north China)', 'https://polyhaven.com/a/forrest_ground_03'),
    'red_laterite_soil_stones_1k': ('laterite', 'red laterite soil (south China, India)', 'https://polyhaven.com/a/red_laterite_soil_stones'),
    'dry_river_pebbles_1k': ('pebbles-river', 'river pebbles (banks, fords)', 'https://polyhaven.com/a/dry_river_pebbles'),
    'mossy_rock_1k': ('moss-rock', 'mossy rock (damp forests)', 'https://polyhaven.com/a/mossy_rock'),
    'marble_01_1k': ('marble-blocks', 'pale marble blocks (Byzantine)', 'https://polyhaven.com/a/marble_01'),
    'red_sandstone_wall_1k': ('sandstone-red', 'red sandstone wall (India)', 'https://polyhaven.com/a/red_sandstone_wall'),
    'brick_wall_08_1k': ('brick-grey', 'grey brick (China)', 'https://polyhaven.com/a/brick_wall_08'),
    'yellow_brick_1k': ('brick-yellow', 'yellow fired brick (Central Asia)', 'https://polyhaven.com/a/yellow_brick'),
    'rough_wood_1k': ('wood-beams-rough', 'rough weathered beam', 'https://polyhaven.com/a/rough_wood'),
    'bamboo_wall_1k': ('bamboo-wall', 'bamboo wall (south China)', 'https://polyhaven.com/a/bamboo_wall'),
    'palm_bark_1k': ('bark-palm', 'palm trunk bark', 'https://polyhaven.com/a/palm_bark'),
    'fir_tree_01_1k': ('conifer-twig-fir', 'fir needle twig card with alpha', 'https://polyhaven.com/a/fir_tree_01'),
    'pine_tree_01_1k': ('conifer-twig-pine', 'pine needle twig card with alpha', 'https://polyhaven.com/a/pine_tree_01'),
    'fern_02_1k': ('fern', 'fern fronds with alpha', 'https://polyhaven.com/a/fern_02'),
    'shrub_02_1k': ('shrub-leaves', 'shrub leaves with alpha', 'https://polyhaven.com/a/shrub_02'),
    'rough_linen_1k': ('fabric-linen', 'rough linen', 'https://polyhaven.com/a/rough_linen'),
    'hessian_230_1k': ('fabric-sackcloth', 'hessian / sackcloth', 'https://polyhaven.com/a/hessian_230'),
    'caban_1k': ('fabric-wool', 'woollen cloth', 'https://polyhaven.com/a/caban'),
    'crepe_satin_1k': ('fabric-silk', 'silk satin', 'https://polyhaven.com/a/crepe_satin'),
    'floral_jacquard_1k': ('fabric-brocade', 'floral brocade', 'https://polyhaven.com/a/floral_jacquard'),
    'brown_leather_1k': ('leather-brown', 'brown leather', 'https://polyhaven.com/a/brown_leather'),
    'curly_teddy_natural_1k': ('fur-fleece', 'curly fleece (sheepskin)', 'https://polyhaven.com/a/curly_teddy_natural'),
    # third pack (24 Nov 2026), downloaded by Claude from ambientCG
    'Tiles020_1K-JPG': ('tile-glazed-turquoise', 'turquoise glazed tiles (Persia, Central Asia)', 'https://ambientcg.com/view?id=Tiles020'),
    'Tiles070_1K-JPG': ('tile-mosaic-blue', 'dark blue hexagonal glazed mosaic', 'https://ambientcg.com/view?id=Tiles070'),
    'Tiles131_1K-JPG': ('tile-floor-pattern', 'patterned floor tiles (courtyards, palaces)', 'https://ambientcg.com/view?id=Tiles131'),
    'WoodSiding011_1K-JPG': ('shingles-wood', 'wooden shingles (Caucasus, mountains)', 'https://ambientcg.com/view?id=WoodSiding011'),
    'Fabric034_1K-JPG': ('felt', 'grey-white felt (steppe gers)', 'https://ambientcg.com/view?id=Fabric034'),
    'Carpet015_1K-JPG': ('rug-woven-red', 'red-orange woven rug', 'https://ambientcg.com/view?id=Carpet015'),
    'Rock028_1K-JPG': ('rock-cliff-grey', 'grey cliff rock', 'https://ambientcg.com/view?id=Rock028'),
    'LeafSet019_1K-JPG': ('conifer-spray', 'conifer sprays with opacity (cedar, juniper)', 'https://ambientcg.com/view?id=LeafSet019'),
    'LeafSet013_1K-JPG': ('leaves-slender', 'long slender leaves with opacity (bamboo, willow, oleander)', 'https://ambientcg.com/view?id=LeafSet013'),
    'Foliage001_1K-JPG': ('grass-strands', 'grass and reed strands with opacity', 'https://ambientcg.com/view?id=Foliage001'),
    'Foliage002_1K-JPG': ('grass-dry-seedheads', 'dry grass with seed heads, opacity (steppe tufts)', 'https://ambientcg.com/view?id=Foliage002'),
    'PineNeedles001_1K-JPG': ('pine-needles', 'loose pine needles with opacity', 'https://ambientcg.com/view?id=PineNeedles001'),
    'island_tree_01_1k': ('tree-island-01', 'a tree model\'s textures: trunk, branches, leaves with alpha (the .blend model itself is not imported)', 'https://polyhaven.com/a/island_tree_01'),
}

def load(path):
    if path.lower().endswith('.exr'):
        import OpenEXR
        with OpenEXR.File(path) as f:
            ch = f.channels()
            if 'RGB' in ch: a = ch['RGB'].pixels
            elif 'RGBA' in ch: a = ch['RGBA'].pixels[..., :3]
            else:
                ks = [k for k in ('R', 'G', 'B', 'Y') if k in ch]
                a = np.stack([ch[k].pixels for k in ks], -1) if len(ks) > 1 else ch[ks[0]].pixels
        a = np.asarray(a, dtype=np.float32)
        a = np.clip(a, 0, 1) if a.max() <= 1.001 else a / a.max()
        a = (a * 255 + 0.5).astype(np.uint8)
        return Image.fromarray(a if a.ndim == 2 or a.shape[-1] > 1 else a[..., 0])
    return Image.open(path)

def save(img, dst, mode):
    img = img.convert(mode)
    if dst.endswith('.png'): img.save(dst, optimize=True)
    else: img.save(dst, quality=90, optimize=True)

def pick(files, *keys, avoid=()):
    for f in files:
        b = os.path.basename(f).lower()
        if all(k in b for k in keys) and not any(a in b for a in avoid): return f
    return None

def import_folder(src, slug, sub=''):
    files = sorted(f for f in glob.glob(os.path.join(src, '**', '*'), recursive=True) if os.path.isfile(f))
    if sub: files = [f for f in files if sub in os.path.basename(f).lower()]
    else: files = [f for f in files if not any(s in os.path.basename(f).lower() for s in ('branches', 'leaves'))] if 'island_tree' in src else files
    dst = os.path.join(OUT, slug); os.makedirs(dst, exist_ok=True); made = []
    jobs = [
        ('color.jpg', 'RGB', pick(files, '_color.') or pick(files, 'diff', avoid=('dry',))),
        ('normal.jpg', 'RGB', pick(files, 'normalgl') or pick(files, 'nor_gl')),
        ('rough.jpg', 'L', pick(files, 'roughness') or pick(files, 'rough')),
        ('ao.jpg', 'L', pick(files, 'ambientocclusion') or pick(files, '_ao')),
        ('opacity.png', 'L', pick(files, 'opacity') or pick(files, 'alpha')),
    ]
    for name, mode, f in jobs:
        if not f: continue
        save(load(f), os.path.join(dst, name), mode); made.append(name)
    return made

def main(pack):
    inv = {}
    try: inv = json.load(open(os.path.join(OUT, 'inventory.json')))
    except Exception: pass
    for d in sorted(os.listdir(pack)):
        src = os.path.join(pack, d)
        if not os.path.isdir(src) or d not in MAP:
            if os.path.isdir(src): print('skip (not in MAP):', d)
            continue
        slug, what, url = MAP[d]
        if d == 'island_tree_01_1k':
            for part in ('trunk', 'branches', 'leaves'):
                made = import_folder(src, f'{slug}/{part}', '' if part == 'trunk' else part)
                inv[f'{slug}/{part}'] = {'what': f'{what} — {part}', 'source': url, 'license': 'CC0', 'maps': made}
                print(slug, part, made)
            continue
        made = import_folder(src, slug)
        inv[slug] = {'what': what, 'source': url, 'license': 'CC0', 'maps': made}
        print(slug, made)
    json.dump(inv, open(os.path.join(OUT, 'inventory.json'), 'w'), indent=1, sort_keys=True)

if __name__ == '__main__':
    main(sys.argv[1])
