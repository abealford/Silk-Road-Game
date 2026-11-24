# Building-kit mockup (24 Nov 2026)

Roadmap step 4. One street per culture (17 cultures, 10 kit families), each next to what the game builds today,
on the v22.2d stylized textures with the game's lighting and surface blend (`surfDet`). Not part of the game yet.

    python3 tools/buildings_mockup/build.py   # -> dist/buildings_mockup.html

Published: https://claude.ai/artifact/AJjJCJP3XnB9RcGYQNFVVC (slug 4b5bf549-62bb-49ce-80c1-cbf74c60fa73). `#<culture id>` opens a culture.

- `mock/core.js`: materials, the `Kit` builder, baking (one mesh per material, planar UVs in metres), shapes:
  `facade` (walls with real openings), `archCurve` (round, pointed, cusped, horseshoe, flat), `ring`, `ablaq`,
  `band`, `windowFill` (lit windows), `shutters`, `grille`, `lattice`, `door`, `gableRoof`, `hipRoof` (with Chinese
  flare and lifted corners, or a flared gable), `flatRoof` (plain, merlons, stepped, round, horns).
- `mock/kit_town.js`: narrow-lot town houses (rowHouse) for Byzantine, Levant, Armenian, Georgian.
- `mock/kit_court.js`: courtyard houses (Rûm, Arab, Persian, Central Asian, Tarim; Mongol and steppe use Central Asian) and bazaar shop bays.
- `mock/kit_east.js`: Yemeni tower houses, Indian havelis, Chinese/Song shophouses and siheyuan, Southeast Asian stilt houses, Tibetan houses, yurts.
- `mock/streets.js`: the 17 culture streets (lot types and sizes from cityGen), `kitLot` (kit per lot type), `todayLot` (the game's builders).
- `mock/surf_stub.js`: `SURF.buildLayer` copied from `src/surfaces.js`, so "Today" (the real `src/builders.js`) is textured as in the game.
- `mock/app.js`: scene, lights, time of day, culture picker, camera. Hook: `window.__mock`.
