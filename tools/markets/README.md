# Markets and goods tools (v19)

The design lives in the claude.ai project docs `claude/silk-road-markets.md` and `claude/silk-road-goods-catalogue.md`.
These files are the editable source for it:

| File | What it is |
|---|---|
| `markets.py` | The 11 markets: cities, capital, market cities, specialty towns, colour, label position |
| `goods_data.py` | The 253 goods (8 common, 5 uncommon, 4 rare, 3 epic, 3 legendary per market) and what each market pays extra for |
| `gen_markets_js.py` | Writes `src/markets_data.js` from the two files above. Goods carried over from v18 keep their old ids |
| `gen_market_layer.py` | Bakes the map's Markets layer into `src/markets_layer.js` (needs numpy, scipy, Pillow) |
| `sim.py` | Greedy-trader balance simulator comparing the v18 economy (`old_goods_v18.json`) with v19 |
| `road_graph.json` | Road distances between cities (km), used by the simulator |

After editing the data: `python3 tools/markets/gen_markets_js.py`, then `python3 tools/markets/gen_market_layer.py`
if markets or colours changed, then `python3 tools/markets/sim.py` to check the pace, then `python3 build.py`.
