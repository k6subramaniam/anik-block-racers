# ANIK Block Racers — Open World Galaxy Edition (v2.0)

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
