# ANIK Block Racers — Open World Galaxy Edition v2.0: QA

Reviewed October 25, 2026.

## Confirmed tests

- **PASS — 38/38 Node unit tests:** existing racing (acceleration, steering, collisions, two ordered checkpoints, 3-lap finish), Samsung PWA behavior, five open-world zones, world bounds, landmark blockers, fast travel, portal, collectible relics, one-time bonuses, lava rescue, minimap projection, and a 30,000-step stable free-roam simulation, including the new Explore launcher shortcut routing.
- **PASS — React JSX parse:** `src/App.jsx`, `src/game/World.jsx`, `src/game/OpenWorldDecor.jsx` parsed with TypeScript compiler syntax checking.
- **PASS — GitHub Actions build and deploy:** https://github.com/k6subramaniam/anik-block-racers/actions/runs/40231913630 (includes Node test, Vite build, GitHub Pages deploy).
- **PASS — Live Chrome/Playwright, emulated Samsung-size 915×412, touch enabled:** open-world intro ready, Explore opens, touch controls visible, five fast-travel destinations appear, tapping Neon City changes district, returning to the three-lap circuit restores the racing HUD, JavaScript runtime errors = 0, required 3D asset requests failed = 0, horizontal overflow = none.
- **PASS — PWA offline in an emulated browser:** service worker registered, two ANIK-specific caches present (app shell and model), Higgsfield open-world GLB successfully cached, browser switched to offline mode, page reloaded and allowed starting Explore with touch controls and map visible, JavaScript errors = 0.
- **PASS — 3D source scene visual check:** Higgsfield rev 5 overview rendered and inspected, with original circuit at the center surrounded by Neon City, Crystal Ridge, Sunset Canyon, Ember Peaks and Portal Grove.
- **PASS — Portable GLB structure:** 877,672-byte glTF/GLB, 594 scene nodes, 511 meshes, five named zones, ten world paths, eight named hero asset roots.
- **PASS — Galaxy map visual regression check:** map illustration and its 14-pixel inline navigation icon now use separate CSS selectors; regression test included.

## Not yet confirmed

- Performance, FPS, GPU temperature and battery usage on a *physical* Samsung S25/S26 or other Galaxy model.
- Physical Samsung Internet offline install and relaunch for the new v2.0 build (Playwright offline cache passed, but it is not physical phone evidence).
- Full end-to-end human three-lap race in v2.0 (race lap logic and return-to-race are verified automatically).
- Feature progression storage across browser refreshes; district discoveries and relics are session-only in this prototype.
- Multiplayer, full terrain elevation physics, jumping off-road ramps, and native signed APK/AAB.

## How to smoke-test on a phone

1. Open https://k6subramaniam.github.io/anik-block-racers/ after connecting to Wi-Fi.
2. Close/relaunch the installed home-screen PWA to receive the latest service worker, then tap **EXPLORE OPEN WORLD**.
3. Hold GAS and steer off the original racetrack; scenery and districts should remain drivable except obstacles and the map border.
4. Tap **Map** and travel to all five zones, collecting floating relics at each destination.
5. Go through the glowing Portal Grove gate, then use the flag icon to return to **Race 3 Laps**.
6. Switch to Eco graphics if framerate is low and report device/browser, whether it was an installed PWA, and any frame drops or rendering glitches.
