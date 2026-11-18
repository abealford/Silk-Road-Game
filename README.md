# The Silk Road · 1272

A first-person browser game (Three.js, one self-contained page): travel the overland Silk Road in 1272, from Constantinople and Cairo to Khanbaliq and Quinsai, trading goods, provisioning a caravan and playing Matteo's story.

**Playable build:** https://claude.ai/artifact/CAiFGNGi3FXAM4cpMtrbr3 (v18.3: v18 with Combat Practice)

Design docs live in the claude.ai project "Silk Road Game": `silk-road-v1-design-notes.md` (world, cities, graphics), `silk-road-game-mechanics.md` (rules), `silk-road-campaign-plan.md`, `silk-road-goods-rarity.md`, `silk-road-arena.md` and `silk-road-combat-practice-build.md`.

## Build

```sh
python3 build.py                                # -> dist/index.html (the main game)
python3 build.py prototypes/arena               # -> dist/arena.html (the old Arena prototype)
```

No dependencies beyond Python 3. Open `dist/index.html` in a browser to play locally. That file is what gets published as the artifact.

## Layout

| Path | What it is |
|---|---|
| `index.template.html` | The page: HTML markup plus `<!--#include ... -->` markers that `build.py` fills in |
| `css/main.css` | Interface styles |
| `css/fonts.css` | Embedded fonts (base64) and the later UI styles appended to them |
| `css/combat.css` | Combat Practice HUD and menus |
| `vendor/three.min.js` | Three.js (MIT licence) |
| `src/geo.js` | Generated geography: land grid, coasts, rivers, lakes, borders (Natural Earth; 1272 borders adapted from aourednik/historical-basemaps, GPL-3.0) |
| `src/data.js` | Cities, roads and landmarks, including the Build 2 south |
| `src/world.js` | Projection, baked fields, roads, rivers, height function |
| `src/builders.js` | Low-poly buildings, trees and props |
| `src/game.js` | Rendering, streaming terrain, sites, player, HUD, map, v13 graphics |
| `src/econ.js` | Goods, producers, prices, realms, tolls, characters, factions (v17), relay trade |
| `src/icons.js` | Goods icons (SVG) |
| `src/events.js` | Road events and event chains |
| `src/journey.js` | The Journey: trading, supplies, caravan, NPCs, the story, start screen, v18 ships/quarter merchants/property |
| `src/combat.js` | Combat Practice: the colosseum, weapons, foes and five waves (`window.COMBAT`, test hook `window.__combat`) |
| `prototypes/arena/` | The Arena, the other combat prototype (v18.2), kept for reference. It reuses the shared files above and keeps only its own `game.js`, `arena.js` and page template. |

Keep the script order in `index.template.html`: later files depend on globals defined by earlier ones.

## History

- **v18.3 (18 Nov 2026):** Combat Practice (prototype B, first published separately at https://claude.ai/artifact/3Uz9cda3CefPLBehSuTF8n) became the main game, replacing the Arena on the title screen. The Arena moved to `prototypes/arena/`.


This repo was recovered on 18 Nov 2026 from the published artifacts, and both pages rebuild byte for byte:
- the main game with Combat Practice (`dist/index.html`): sha256 `786e22f7125b290ab7d43140afc44d47f240e21feaae59b670df546139f358d5`
- the Arena (`dist/arena.html`, the main game up to v18.2): sha256 `0044483c1fe9d0a9e52a58c3118c69a2d4a2f071cce30a0cd44515800c295394`

Earlier versions were built in chat workspaces that didn't persist, so some things weren't recovered:
- The finer module split (`data_south.js`, `builders_south.js`, `econ_south.js`, `events_south.js`, `mech.js`, `gfx_sky.js`, `gfx_life.js`, `gfx_ground.js` and so on). Their code is all here, merged into the files above.
- The data tools (`prep_geo.py`, `tools/prep_map.py`, `tools/sealanes`, `relayopt.js`, `build_combat.py`). Treat `src/geo.js` and the map and sea-lane data inside the scripts as source data from now on.
- The `src_v2` to `src_v17` backups. From here on, git history replaces them.
