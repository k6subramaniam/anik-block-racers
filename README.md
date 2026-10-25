# ANIK Block Racers — AI Rivals & Voxel Wildlife (Open World v2.1) (v2.0)

**Real playable 3D world** for Samsung Galaxy and modern Android browsers. Based on the original Higgsfield 3D Jutsu asset scene, updated with five themed zones and connecting roads. The game remains an original voxel racer, not a Minecraft/Mojang product.

## Game modes

- **Explore Open World:** roam a bounded ~312 × 264 metre terrain at your own pace, across five zones: Neon City, Crystal Ridge, Sunset Canyon, Ember Peaks, and Portal Grove. Discover each location, collect five floating relics, fast-travel from the map, and drive through the grove portal to return to Voxel Valley. Landmarks have simplified collision volumes, an exterior world border, and a lava rescue area.
- **Race 3 Laps:** original Voxel Valley time trial. Drive the existing 7.2 metre roadway, pass the two checkpoints in order, and race for your best lap. Original speed boosts, coins and road collisions are retained.

## Cool new Higgsfield 3D assets

- Neon city skyscrapers with glowing trim, a giant block robot and a holographic platform.
- Massive voxel ice crystals, glacier and waterfall.
- Stepped desert temple, red canyon pillars and oversized cactus.
- Tiered lava volcano with magma falls, glowing crater and block dragon.
- Magical portal, rune pillars and colourful voxel hot-air balloon.
- Four trail routes linking the racetrack to the zones, a north portal road and hundreds of GPU-instanced small shrubs/rocks/mushrooms.

Higgsfield editable source: https://higgsfield.ai/3d-jutsu/6e4c8faf-89eb-4667-a05b-5762ab96b85a

A public Higgsfield CDN URL serves the portable GLB (877,672 bytes). The latest geometry remains editable in the Higgsfield project. The HTML/JS build uses glTF-compatible materials with no official Minecraft artwork.

## Controls

**Samsung:** Landscape recommended. Press and hold the on-screen gas/brake, steering, and drift controls. Tap the **map icon** to choose a district and fast-travel; tap the **compass/flag icon** to switch between free roam and racing.

**Keyboard:** WASD or arrows for drive; Space for drift; C for chase/aerial camera; M for map; E for Explore; H for Race; P/Esc pause; R restart; Enter starts racing.

## Host and build

Use Node.js 22+ and a browser with WebGL 2. From the repository root:

```bash
npm install
npm test
npm run dev
```

To build production files:

```bash
npm run build
```

GitHub Pages is configured in `.github/workflows/pages.yml` for `main`. **Settings → Pages → Source = GitHub Actions**. Push to `main` automatically runs the Node unit tests and builds/deploys `dist/`.

Live app: https://k6subramaniam.github.io/anik-block-racers/

The installed PWA should refresh automatically after an online launch and reload. Model caching requires one successful online request; offline behavior and frame rate depend on the device and available storage. Changing or clearing browser storage may delete caches.

## Architecture

- React 19, React Three Fiber, Three.js, Rapier kinematic kart collider.
- Pure deterministic physics/race logic: `src/game/simulation.js`, `track.js`, `openWorld.js`.
- 3D scene: `src/game/World.jsx` and lightweight instanced foliage/relic effects in `src/game/OpenWorldDecor.jsx`.
- Touch controls: `src/game/mobile.js` and responsive UI in `src/App.jsx`, `src/styles.css`.
- PWA install/offline cache: manifest and generated `sw.js`.

## Limitations / next milestones

This is a **bounded** open-world prototype, not an infinite Minecraft map. Terrain is primarily flat, with towering background landmark geometry. Bridges and mountains are scenery, not climbable race physics. Car physics uses 2D planar movement with simplified obstacles. No multiplayer, traffic AI, saves/account sync, Android APK/AAB, or dedicated 60 FPS guarantee yet. A device test on physical Samsung hardware is required for real FPS, memory usage, battery drain and reliable offline installation.


## v2.1 — AI racers, roaming wildlife and crash mechanics

- **3 AI rival karts:** BOLT, NOVA and PIXEL automatically race around the original Voxel Valley course at different speeds, then patrol the open-world road network when Explore is selected. They use the existing Higgsfield kart mesh recolored per rival.
- **8 voxel creature bots:** foxes, sheep, boars and crystal cubs roam across the districts, wander near their spawn territories and flee approaching racers. These are stylized game creatures, not depictions of realistic animal harm.
- **Ram-to-damage:** steering into a bot at speed removes hit points (visible overhead). Slow touches do not cause damage. Defeated bots burst into harmless voxel cubes and respawn after 11 seconds.
- **On-screen scoreboard:** BOTS SMASHED and arcade points (100 for a rival kart, 40 for a creature). Bots survive multiple crashes depending on impact speed. Health and AI states reset when restarting a race or free roam; points reset intentionally.
- **Galaxy performance:** AI simulation is deterministic; moving meshes use refs instead of triggering React rerenders 60 times per second. Faraway bots are culled; animals are simple block meshes with no image texture downloads.

**How to play:** Start **RACE 3 LAPS** to compete against rival karts, or **EXPLORE OPEN WORLD** to encounter the animals and roaming karts. Accelerate, aim your kart toward an NPC and crash into it at speed; avoid slow side-swipes. The orange AI health bar diminishes with impacts; the bot bursts into cubes when health is depleted. The top-right **BOTS SMASHED** indicator tracks knockouts. There are no weapons and no realistic gore.

**QA:** Run `npm test` for the deterministically simulated NPC behavior and ramming mechanics, or inspect the GitHub Actions build for the compiled mobile web app. Physical Samsung frame rate and battery impact still require real-device validation.


## v2.2 — Blockhaven living village (original voxel art)

- Higgsfield scene expanded with timber-frame houses, windmill, wheat fields, pond and bridge, cobblestone paths, market, glow lamps, forge, well and square oaks.
- Twelve friendly humanoid AI villagers walk waypoint paths, pause, animate walking limbs and move away from approaching vehicles. Movement is local rule-based AI, not a remote model.
- In free roam, fast travel to **Blockhaven Village**, slow down near a character and tap **TALK** (keyboard: **T**) to hear their tips. The first meeting with each character earns two bonus coins.
- There are now six discovery districts and six relics. Three-lap race mode, AI rival karts, voxel animal bots, ramming effects and Samsung PWA controls remain.
- Villagers are friendly and invulnerable; only the fantasy kart and creature bots use the arcade knockout system.
- This is an original block-world game and is not officially affiliated with Minecraft or Mojang.
