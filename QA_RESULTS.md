# ANIK Block Racers v2.4 — Voxel Graphics QA

## Automated checks in this build

- `npm test`: 81/81 passed (74 existing tests + 7 new pixel / tree / terrain regression tests).
- JSX parse: all 8 React JSX modules passed TypeScript syntactic transpilation.
- New pixel palettes are deterministic, 16×16 RGBA, nearest-neighbour texture-ready and have recognizable seams.
- 135 deterministic block-tree positions are outside the original racing track, world lakes, principal roads, and landmark collision zones.
- Seven ground texture planes (including green Blockhaven lawn) are below the 3D racetrack elevation; terrain and weather gameplay math remain unchanged.
- No external image/texture assets or proprietary Minecraft artwork are included.

## Remaining release gates

- GitHub Actions: Node 22, production Vite build, GitHub Pages deploy (inspect workflow).
- 915×412 Samsung-like Chromium smoke test: 3D scene ready, Explore and Race launch, voxel materials, screenshot, no browser errors.
- Physical Galaxy FPS, GPU temperature, battery drain, touch interactions, PWA update and offline cached model need device testing.

## Expected original voxel graphics

- 16×16 pixel motifs on block materials; colourful pixel-patterned terrain.
- Square-leaved cubic trees, flat-topped terraced hills and flower pixels.
- Wide stepped square clouds, cubic sun/moon, and pixel-style lake ripples.
- Preserve old game controls, AI opponents, villagers, water rescue and weather.
