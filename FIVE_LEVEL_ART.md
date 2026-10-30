# Five Reference-Inspired 3D Levels — ANIK Block Racers

This feature adds distinctive rendered 3D scenery, not background screenshots, to the existing five playable Battle Race circuits. All artwork is original procedural voxel geometry inspired by five user-provided visual references.

| Playable level | Existing circuit ID | Reference concept | New signature scenery |
| --- | --- | --- | --- |
| 1. Block Kart Grand Prix | blast | Image 4: classic voxel kart circuit | Kart pits, checker gate, tiered grandstands, spectators, stacked tire walls and bright floodlights |
| 2. Autumn Canyon Rally | canyon | Image 3: rustic autumn kart arena | Autumn voxel trees, hay bales, brown mesas and barn-style paddocks |
| 3. Alpine Lighthouse Run | frost | Image 1: snowy mountain track | Four large stepped snow peaks, two striped lighthouses, snow-dusted pines and icy track surface |
| 4. Rainbow Skybridge | skybridge | Image 2: purple city rainbow track | Blocky purple towers, seven-colour curbs, rainbow archways and road-edge light panels |
| 5. Neon Nitro Skyway | summit | Image 5: neon desert speedway | Night-sky palette, neon-lit desert city, cacti, glowing sky-high racing edges and light arches |

## What's unchanged
- Existing circuit IDs, real geometries, elevations, AI racing paths, checkpoint gates, mechanical collision response, selected laps (1–10), weather physics, upgrades, weapons and turbo power-ups.
- Race previews, custom creator tracks and direct multiplayer keep using existing rules. They display the same level theme when the players select the same built-in track.
- The levels are decorative race environments. Props are outside the collision solver: hay bales, spectator crowds and towers cannot be smashed or driven through as physical hazards in this first art pass.

## Engineering
- src/battle/levelArt.js: deterministic voxel geometry generator, track-specific palette and decor; no network or third-party art assets.
- src/battle/LevelScenery.jsx: two GPU instanced-mesh batches (solid and luminous boxes), avoiding hundreds of separate draw calls.
- src/battle/Scene.jsx: expanded ground plane, road colours, multicolour curb painting, per-level sky and lighting.
- src/battle/Game.jsx: level theme names in the existing selection and HUD.
- src/tests/level-art.test.js: render-data validation and mobile-quality object-budget checks.
- Eco quality lowers decorative prop density and uses sparser road lights. All visual presets share the same mechanical track.
- The neon level uses bright unlit panels rather than costly postprocessing bloom.

## Test and deployment
Run npm test, npm run build, and the existing Playwright browser suite. PR checks should pass before merging. The game remains available at its existing GitHub Pages path after merging the feature branch and a successful deployment: https://k6subramaniam.github.io/anik-block-racers/?view=battle

**Physical phone test:** verify landscape and portrait HUD visibility, Samsung Galaxy S25 Ultra framerate, battery/thermal behaviour, and that scenery does not obscure curbs. Desktop rendering and CI do not prove Android GPU performance.

## Future enhancements
Authored texture atlases, low-poly environment props, dynamic lighting, billboards, camera fly-throughs and physically interactive hazards can bring a closer match to the high-polish reference images. That is a separate asset and physics pass.
