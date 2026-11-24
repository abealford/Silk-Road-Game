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

## Still wanted
Cliff rock, snow, plaster or stucco, mud brick or adobe, thin red brick (Byzantine), terracotta roof tiles. Also, for the trees: a conifer needle or branch card with opacity, and a palm leaf.

## Adding more
Unzip the download, then run `python3 tools/textures/import_pack.py <folder>` after adding each new folder to the script's `MAP` (slug, description, source page). It needs `pip install OpenEXR pillow numpy` for Poly Haven's EXR maps.
