# Textures (v22 art update)

Source textures for the Valheim-style look. All **CC0** (public domain: free to use, no credit required), downloaded by the user from Poly Haven and ambientCG on 23 Nov 2026. `inventory.json` lists each texture, what it is, its source page and the maps it has.

These are **sources at 1K**, not what ships: the build will make smaller, compressed versions (256–512 px, atlases) for the game.

## Layout
One folder per texture, with these maps when the download had them:
- `color.jpg`: the base colour (sRGB)
- `normal.jpg`: normal map, OpenGL convention (green up)
- `rough.jpg`: roughness (linear, grey)
- `ao.jpg`: ambient occlusion
- `opacity.png`: cut-out mask (leaves, grass blades)

## What's here
| Group | Textures |
|---|---|
| Ground | `ground-meadow`, `ground-grass-patchy`, `sand`, `dry-earth`, `forest-floor-leaves` |
| Paving | `paving-setts`, `paving-fan`, `paving-rubble` |
| Stone walls | `stone-blocks-warm` (Acre, the Levant), `stone-rubble-warm`, `stone-ashlar-grey`, `stone-wall-slate` |
| Wood and roofs | `wood-planks`, `wood-boards-studded` (doors), `thatch-reed` |
| Trees | `bark-pine`, `bark-pale`, `bark-sakura`, `leaves-broadleaf`, `tree-island-01/{trunk,branches,leaves}` |
| Grass | `grass-blades` (atlas of blades with alpha, for grass cards) |

`tree-island-01` came as a Blender model (`island_tree_01_1k.blend`); only its textures are imported, because there's no Blender here to export the model. If it's wanted, export it from Blender as glTF (.glb) and add it under `assets/models/`.

## Second pack (24 Nov 2026)
41 more CC0 textures from Poly Haven, downloaded by Claude (source pages in `inventory.json`):
| Group | Textures |
|---|---|
| For v22.2 | `rock-cliff-pale`, `rock-cliff-layered`, `rock-dark-lichen`, `snow`, `plaster-white`, `plaster-mud`, `plaster-over-brick`, `mud-wall-cracked`, `mud-brick-rough`, `brick-byzantine`, `roof-tiles-terracotta`, `roof-tiles-grey` |
| Regional ground | `rock-red`, `rock-ochre`, `scree`, `mud-cracked`, `salt-flat`, `steppe-dry`, `grass-sparse-dry`, `loess`, `laterite`, `pebbles-river`, `moss-rock` |
| Building | `marble-blocks`, `sandstone-red`, `brick-grey`, `brick-yellow`, `wood-beams-rough`, `bamboo-wall` |
| Vegetation | `bark-palm`, `conifer-twig-fir`, `conifer-twig-pine` (packed sheet; only the top-left sprays are clean), `fern`, `shrub-leaves` (cards with opacity, from Poly Haven plant models) |
| Fabrics | `fabric-linen`, `fabric-sackcloth`, `fabric-wool`, `fabric-silk`, `fabric-brocade`, `leather-brown`, `fur-fleece` |

## Still wanted
From ambientCG (needs its download host allowed): turquoise glazed tile, wooden shingles, felt, palm leaf and bamboo leaf cards, carpets.

## Adding more
Unzip the download, then run `python3 tools/textures/import_pack.py <folder>` after adding each new folder to the script's `MAP` (slug, description, source page). It needs `pip install OpenEXR pillow numpy` for Poly Haven's EXR maps.
