# Working on this repo

- This repo is the only durable copy of the game's source. Chat workspaces are wiped between sessions, so **commit and push at the end of every change**, with the version number in the commit message (e.g. "v19: fog of war").
- Build with `python3 build.py` and test `dist/index.html`. When publishing to the artifact (https://claude.ai/artifact/CAiFGNGi3FXAM4cpMtrbr3), publish exactly that file, then record the version and sha256 in the commit.
- Start from the project doc `claude/silk-road-start-here.md`, then read the docs that cover what you're changing. After a change, update the matching doc (design notes, mechanics, campaign plan, combat practice) and the Start Here doc's current-version line.
- Every published version gets a line in `CHANGELOG.md`.
- The backlog is GitHub issues. Check them before starting; close or comment on the ones a change resolves (`Fixes #N` in the commit); file new bugs and ideas there.
- Experiments go on a branch and publish to their own page, never to the main build link, until the user picks them.
- Combat Practice (`src/combat.js`) is the game's combat mode. The Arena in `prototypes/arena/` is a retired alternative, kept only for reference.
- Standing decisions (don't change these without asking): the year 1272 and 1272 place names; overland travel on foot (the only ships are the v18 autopilot voyages); the map scale (about 27 min Constantinople to Khanbaliq at a walk); the cartoon art style in the manner of Sea of Thieves and Firewatch; city size by 1272 population tier.
- Rendering here is software-only, so frame rate can't be judged in the sandbox. Ask the user for FPS on real hardware before and after performance-sensitive changes.
- Test hooks in the page: `window.__gfx` (graphics), `window.__v18`, `window.__combat` (Combat Practice), and `Arena.debug()` in the Arena prototype.
- New modules: add a file under `src/` and an include marker in `index.template.html`, in dependency order.
