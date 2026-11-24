"""Builds the building-kit mockup page (roadmap step 4, 24 Nov 2026).

python3 tools/buildings_mockup/build.py  ->  dist/buildings_mockup.html

Inlines vendor/three.min.js, the stylized texture layers from src/surfaces_data.js, the game's own
src/builders.js (for "Today"), and the kit modules in mock/ (core, kits, streets, app).
"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
HERE = os.path.dirname(os.path.abspath(__file__))
GROUND_LAYERS = ['flags', 'setts', 'fan', 'earth', 'sand', 'cracked', 'steppe', 'loess', 'meadow']
MOCK = ['core.js', 'kit_town.js', 'kit_court.js', 'kit_east.js', 'streets.js', 'app.js']

s = open(os.path.join(ROOT, 'src', 'surfaces_data.js')).read()
data = json.loads(s[s.index('{'):s.rindex('}') + 1])
tex, order = {}, []
for layer in data['build']:   # every building layer, in the game's order (buildLayer returns indices into it)
    tex[layer['name']] = {k: layer[k] for k in ('scale', 'k', 'own', 'mean', 'col', 'nrm')}
    order.append(layer['name'])
for layer in data['ground']:
    if layer['name'] in GROUND_LAYERS:
        tex[layer['name']] = {k: layer[k] for k in ('scale', 'k', 'own', 'mean', 'col', 'nrm')}
assert set(GROUND_LAYERS) <= set(tex), set(GROUND_LAYERS) - set(tex)

rd = lambda *p: open(os.path.join(*p)).read().replace('</script', '<\\/script')
page = open(os.path.join(HERE, 'page.html')).read()
page = page.replace('/*THREE*/', rd(ROOT, 'vendor', 'three.min.js'))
page = page.replace('/*TEXDATA*/', 'const TEX = ' + json.dumps(tex) + ';\nconst BUILD_ORDER = ' + json.dumps(order) + ';')
page = page.replace('/*SURF*/', rd(HERE, 'mock', 'surf_stub.js'))
page = page.replace('/*BUILDERS*/', rd(ROOT, 'src', 'builders.js'))
page = page.replace('/*MOCK*/', '\n'.join(rd(HERE, 'mock', f) for f in MOCK))
os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
out = os.path.join(ROOT, 'dist', 'buildings_mockup.html')
open(out, 'w').write(page)
print(out, f'{os.path.getsize(out):,} bytes')
