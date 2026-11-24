# Stylize mockup (24 Nov 2026)

The interactive page the user picked the v22.2d texture style with (published: https://claude.ai/artifact/JfN8Swwuayp9kq4CUMMv9v).
`python3 prep.py` writes `texdata.js` (edit its paths first: it reads `assets/textures/`, writes next to itself);
then replace `/*TEXDATA*/` in `page.html` with that file's contents. The settings chosen (Balanced) are `STYLE`
in `../stylize.py`.
