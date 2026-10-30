# ANIK Block Racers — Water & Dynamic Weather v2.3

**Real playable 3D world** for Samsung Galaxy and modern Android browsers. Based on the original Higgsfield 3D Jutsu asset scene, updated with five themed zones and connecting roads. The game remains an original voxel racer, not a Minecraft/Mojang product.

## Game modes

- **Explore Open World:** roam a bounded ~312 × 264 metre terrain at your own pace, across five zones: Neon City, Crystal Ridge, Sunset Canyon, Ember Peaks, and Portal Grove. Discover each location, collect five floating relics, fast-travel from the map, and drive through the grove portal to return to Voxel Valley. Landmarks have simplified collision volumes, an exterior world border, and a lava rescue area.
- **Race 3 Laps:** Voxel Valley Grand Circuit race against seven AI rivals on an eight-kart grid (two rows of four; you start at the back on the right). Rivals overtake by switching to a free lane. The 321 m lap is a six-lane, 21.6 m-wide road around the castle. Pass the two checkpoints in order and race for your best lap. Boost pads and coins are spread across different lanes.

## Cool new Higgsfield 3D assets

- Neon city skyscrapers with glowing trim, a giant block robot and a holographic platform.
- Massive voxel ice crystals, glacier and waterfall.
- Stepped desert temple, red canyon pillars and oversized cactus.
- Tiered lava volcano with magma falls, glowing crater and block dragon.
- Magical portal, rune pillars and colourful voxel hot-air balloon.
- Four trail routes linking the racetrack to the zones, a north portal road and hundreds of GPU-instanced small shrubs/rocks/mushrooms.

Higgsfield editable source: https://higgsfield.ai/3d-jutsu/6e4c8faf-89eb-4667-a05b-5762ab96b85a

A public Higgsfield CDN URL serves the portable GLB (877,672 bytes). The latest geometry remains editable in the Higgsfield project. The HTML/JS build uses glTF-compatible materials with no official Minecraft artwork.

## v4.2 — Higgsfield title art and race announcer

- **Title key art:** the intro screen now sits on cinematic voxel-kart key art generated with Higgsfield (`public/art/keyart.webp`, 110 KB WebP).
- **Arcade announcer:** a voice line plays at each countdown beat (THREE · TWO · ONE · GO), at checkpoints, on lap complete, on the **final lap**, at the finish, on turbo boosts, on bot smashes, on new districts and on relics. Clips were generated with Higgsfield Seed Audio TTS and are in `public/audio/` (~350 KB total, precached for offline play).
- Audio starts after the first tap or key press, as browsers require, and pauses when the app is hidden. Turbo and checkpoint calls are rate limited, so the announcer stays out of the way. To mute it, go to **Settings → ANNOUNCER VOICE**.
- Logic is in `src/game/announcer.js`; tests are in `src/tests/announcer.test.js`.

### Power-ups (Battle Race)

Four rows of rainbow **?** boxes span all six lanes. The first row is 11 m past the start line, so you can grab a power-up within seconds of "GO". Drive through one to hold a random power-up, then press **F** or tap the item button to use it:

| Power-up | Effect |
|---|---|
| TURBO | 2.4 s speed boost |
| SHIELD | 6 s of protection from blasts and oil |
| ROCKET | Homes in on the nearest rival ahead (6–70 m) and explodes on contact |
| OIL SLICK | Dropped behind you; anyone who drives over it spins out |

Rivals collect boxes too. They use turbo and shield straight away, fire rockets when you're ahead of them, and drop oil when you're close behind. Boxes regrow 6 s after you take one. A rival's pickup doesn't remove a box for you. Power-ups sit alongside the existing bombs (**B**), mines (**Q**), barrels, and ammo and repair pads. They're off when Battle Race is switched off for a classic race. Rules are in `src/battle/items.js`.

The five **Battle Race circuits** (Blast, Canyon, Frost, Skybridge, Summit), and tracks made in the Track Creator, race 50% wider than their authored width (18–21 m for the built-in circuits). They have the same power-ups: four rows of **?** boxes per lap, the first 40 m after the start, plus an item button between BOMB and MINE (**F** on a keyboard). Rules are in `src/battle/circuitItems.js`. In portrait on a phone, these circuits use a pulled-back camera, a slimmer HUD and larger touch buttons.

### Rival chatter and wall recovery

Each AI driver talks in their own Higgsfield voice (Seed Audio presets). They throw out a taunt when they pass close to you and complain when you bump into them. A speech bubble in their colour shows who's talking.

| Rival | Voice | Close pass | Bump |
|---|---|---|---|
| BOLT | Benji | "Beep beep! Coming through!" | "Hey! Watch the paint job!" |
| NOVA | Juno | "Catch me if you can, slowpoke!" | "Rude! I was here first!" |
| PIXEL | Archie | "Lagging behind, are we?" | "Ouch! You glitched me!" |
| BLAZE | Desmond | "Feel the heat!" | "You just bumped a legend!" |
| VOLT | Ginger | "Zap! Out of my way!" | "Shocking driving!" |
| ROSE | Isla | "Smell you later!" | "Watch the petals!" |
| ONYX | Grady | "Quiet. Like a rock." | "I am a boulder. You bounce." |

Each rival has two lines of each kind (`public/audio/chatter/`). Bumps speak straight away. Close passes need to be within 9 m, with at least 4.5 s between any two lines and 14 s before the same rival speaks again. It works in the main race and on the battle circuits, and **Settings → VOICES** turns it off together with the announcer.

Hitting a wall no longer bounces you backwards. Your kart glances off: it turns most of the way to run along the barrier, keeps about 70% of its speed, and is nudged back onto the road, so you can keep driving. This applies in both modes (`src/game/wallRecovery.js`).

### In-game radio

Six stations. Press **N** or tap the radio icon to cycle through them, or pick one under **Settings → MUSIC**. A short card shows what's playing, and your choice is remembered.

| Station | Genre | Source |
|---|---|---|
| TURBO FM | Electro racing, 120 BPM | Higgsfield (Seedance 2.0 Mini audio) |
| NEON NIGHTS | Synthwave, 100 BPM | Higgsfield |
| RIFF RADIO | Rock, 150 BPM | Higgsfield |
| CHILL CRUISE | Lo-fi beats, 85 BPM | Higgsfield |
| BASS DRIVE | Drum & bass, 172 BPM | Higgsfield |
| 8-BIT ARCADE | Chiptune, 132 BPM | Synthesized live (no download) |

Each Higgsfield track plays its intro once, then loops whole bars seamlessly (`public/audio/radio-*.mp3`, about 200 KB each). The next station is preloaded so switching is instant.

### Engine, sound effects and music

- **Engine:** a synthesized kart engine whose pitch, brightness and volume follow speed, with extra whine during turbo.
- **Sound effects:** coins, turbo, wall and obstacle bumps, bot hits and smashes, checkpoint chimes, lap and finish fanfares, discovery and relic sparkles, water splashes and countdown beeps.
- **Music:** an upbeat 120 BPM electronic racing track generated with Higgsfield (Seedance 2.0 Mini native audio; `public/audio/music.mp3`, 200 KB). A ~4 s intro plays once, then a 4-bar groove loops seamlessly. The music plays quietly on menus and pause and at full volume while racing. If the file can't load, a synthesized chiptune plays instead.
- The engine and effects are synthesized live with Web Audio (`src/game/sound.js`), and everything shares one AudioContext with the announcer. Each layer can be turned off in Settings: **ENGINE & EFFECTS**, **MUSIC** and **ANNOUNCER VOICE**.

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


## v2.3 — Drive into water and dynamic weather

- **Three playable open-world lakes**: Blockhaven Pond, Crystal Lake and Blue Lagoon. Open the map and choose a water destination; the spawn pad faces the lake. Accelerate to enter the water. An arcade splash ring appears, hydrodynamic drag slows the kart, and it submerges. If you stay in deep water for about **4 seconds**, automatic rescue places you on a safe shore. Driving back out before rescue allows the kart to surface. This is stylized, deterministic gameplay physics, not a full Navier–Stokes fluid simulation.
- **Day/night**: the simulated clock starts at 08:00 and moves gradually through noon, dusk, night and sunrise, completing a day in roughly **9 minutes** of gameplay. Solar lighting, moonlight, sky hue and fog respond continuously; the clock stops while paused.
- **Four weather phases**: clear → rain → snow → windy, repeating. Each phase lasts about **55 seconds**, with smooth ten-second transitions. Rain makes roads slick, snow reduces traction and braking, and wind gusts physically push the kart. Low-cost 3D rain and snow particles plus animated lake ripples and moving wind streaks vary with the conditions.
- **Weather HUD** shows game time, current phase and wind speed. In **Settings**, NEXT WEATHER and PREVIEW NIGHT skip forward for demonstrations; automatic progression remains enabled.
- **Samsung-friendly**: low-cost geometry; particle counts are reduced automatically on ECO. All existing AI rivals, villages, NPC conversations, touch controls and 3-lap racing remain available.

**Testing**: `npm test` verifies pure water, weather, racing and exploration logic. The GitHub Pages workflow also runs a production Vite build. Actual phone FPS, water visuals and battery usage should be checked on the Galaxy device after deployment.


## v2.4 — Original pixel-textured voxel graphics (Minecraft-like aesthetic)

**Important:** This is original voxel styling, not official Minecraft/Mojang art, assets, textures, UI, or branding. No copyrighted textures are fetched or copied.

- **16×16-pixel materials:** `src/game/voxelStyle.js` builds deterministic, original grayscale pixel palettes for grass, dirt, stone, road, oak, leaves, ice, snow, brick, basalt, sand, glass, and glow. `src/game/VoxelVisuals.jsx` uses `THREE.DataTexture` with nearest-neighbour filtering, square pixel motifs, flat-shaded glTF material clones, and no external texture network requests. Original GLB color accents are retained.
- **Seven pixel-ground palettes:** 3.2-metre repeating pixel tiles across the grassy heartland, city paving, Crystal Ridge, canyon, ember region, Portal Grove and a bright green Blockhaven village lawn. All tile planes are below existing drivable roads.
- **135 block-built trees:** trunk plus two cuboid foliage levels, all three layers drawn with `InstancedMesh`. A corresponding collision radius keeps free-roam vehicles out of the square trunks; trees are generated away from active roads, lakes, plazas, and travel corridors.
- **170 square flowers and 72 terraced hill blocks:** the flowers use two GPU draw calls; Eco mode draws half the flowers. Decorative cliff edges remain near the far world perimeter.
- **Chunky moving clouds and cube sun/moon:** multiple low-poly, square-edged sky forms reflect the existing day/night and weather clock with no image downloads or postprocessing.
- **Pixel-style water shader:** water colors, light bands, and waves are quantized onto a fine grid. Three lake plunge/rescue triggers and gameplay physics are unchanged.
- **Mobile-conscious:** shared material instances, fewer than 20 new instanced drawing batches and a small number of 16px textures. No real-time ray tracing, heavy bloom or high-poly procedural terrain. Existing Auto/Eco/Balanced/High settings continue to work.

### Testing and release

- `npm test` includes the original race, weather, water, AI and villager tests and 7 new voxel-graphics tests.
- GitHub Pages automatically rebuilds the installed PWA when the `main` branch is updated. The old installed app ID is preserved.
- In the app choose **EXPLORE OPEN WORLD** to see all six styled biomes. Choose **RACE 3 LAPS** for the original circuit.
- Physical Samsung GPU FPS, thermal load and battery use must be verified on hardware after this update; test in Eco and Balanced graphics modes.
