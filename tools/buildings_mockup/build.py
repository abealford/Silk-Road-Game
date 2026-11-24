"""Builds the Constantinople building-kit mockup page (roadmap step 4, 24 Nov 2026).

python3 tools/buildings_mockup/build.py  ->  dist/buildings_mockup.html

Inlines vendor/three.min.js and the stylized texture layers the game uses (from src/surfaces_data.js),
so the mockup shows the same materials as the real game.
"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
HERE = os.path.dirname(os.path.abspath(__file__))

BUILD_LAYERS = ['plaster', 'brick', 'tile', 'stoneWarm', 'rubble', 'ashlar', 'planks', 'boards']
GROUND_LAYERS = ['flags', 'setts', 'earth']

s = open(os.path.join(ROOT, 'src', 'surfaces_data.js')).read()
data = json.loads(s[s.index('{'):s.rindex('}') + 1])
pick = {}
for group, names in (('build', BUILD_LAYERS), ('ground', GROUND_LAYERS)):
    for layer in data[group]:
        if layer['name'] in names:
            pick[layer['name']] = {k: layer[k] for k in ('scale', 'k', 'own', 'mean', 'col', 'nrm')}
missing = set(BUILD_LAYERS + GROUND_LAYERS) - set(pick)
assert not missing, missing

page = open(os.path.join(HERE, 'page.html')).read()
three = open(os.path.join(ROOT, 'vendor', 'three.min.js')).read()
page = page.replace('/*THREE*/', three.replace('</script', '<\\/script'))
page = page.replace('/*TEXDATA*/', 'const TEX = ' + json.dumps(pick) + ';')
os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
out = os.path.join(ROOT, 'dist', 'buildings_mockup.html')
open(out, 'w').write(page)
print(out, f'{os.path.getsize(out):,} bytes')
