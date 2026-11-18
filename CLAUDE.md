# Working on this repo

- This repo is the only durable copy of the game's source. Chat workspaces are wiped between sessions, so **commit and push at the end of every change**, with the version number in the commit message (e.g. "v19: fog of war").
- Build with `python3 build.py` and test `dist/index.html`. When publishing to the artifact (https://claude.ai/artifact/CAiFGNGi3FXAM4cpMtrbr3), publish exactly that file, then record the version and sha256 in the commit.
- Read the claude.ai project docs before changing behaviour. After a change, update the matching doc (design notes, mechanics, campaign plan) so it stays current.
- Standing decisions (don't change these without asking): the year 1272 and 1272 place names; overland routes only (ships only as the planned late-game autopilot); the map scale (about 27 min Constantinople to Khanbaliq at a walk); the cartoon art style in the manner of Sea of Thieves and Firewatch; city size by 1272 population tier.
- Rendering here is software-only, so frame rate can't be judged in the sandbox. Ask the user for FPS on real hardware before and after performance-sensitive changes.
- Test hooks in the page: `window.__gfx` (graphics), `window.__v18`, `Arena.debug()`, `window.__combat` (prototype B).
- New modules: add a file under `src/` and an include marker in `index.template.html`, in dependency order.
