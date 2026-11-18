#!/usr/bin/env python3
"""Build the single self-contained game page from a template.

    python3 build.py                                   -> dist/index.html (the main game)
    python3 build.py prototypes/combat-practice        -> dist/combat-practice.html

Each <!--#include TAG ATTRS|PATH[+PATH...] --> marker in the template is
replaced by <TAG ATTRS>contents</TAG>; several paths joined with + are
concatenated. Paths are relative to the repo root. dist/index.html is the
file that gets published as the playable artifact."""
import re, os, sys, hashlib
ROOT = os.path.dirname(os.path.abspath(__file__))

def read(p):
    return open(os.path.join(ROOT, p), encoding='utf-8', newline='').read()

def inline(m):
    head, paths = m.group(1), m.group(2)
    tag = head.split()[0]
    return f'<{head}>' + ''.join(read(p) for p in paths.split('+')) + f'</{tag}>'

def build(src_dir=''):
    tpl = os.path.join(src_dir, 'index.template.html')
    html = re.sub(r'<!--#include (.+?)\|(\S+) -->', inline, read(tpl))
    name = (os.path.basename(src_dir.rstrip('/')) + '.html') if src_dir else 'index.html'
    os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
    out = os.path.join(ROOT, 'dist', name)
    data = html.encode('utf-8')
    open(out, 'wb').write(data)
    print(f'dist/{name}  {len(data):,} bytes  sha256 {hashlib.sha256(data).hexdigest()}')

if __name__ == '__main__':
    build(sys.argv[1] if len(sys.argv) > 1 else '')
