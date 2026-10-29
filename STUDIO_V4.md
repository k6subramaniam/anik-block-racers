# ANIK Creator Studio v4.0 — local garage, stunts/destruction, track builder and private multiplayer

The v4.0 release adds four major systems **without removing** the v3.4 turbo power-ups, 5 multilevel race tracks, selectable lap counts, weather/handling, explosives, open world, Bot Smash or PWA.

## 1. Cartoon destruction and aerial tricks
Four jump pads and twelve destructible voxel boxes are generated along every battle track, including custom tracks. A sufficiently fast collision breaks a box into colorful cubes, awards points and starts a cooldown until the prop respawns. Jump pads launch vehicles into an arc that can earn a trick-landing bonus; steering while airborne accumulates spin. Combos last five seconds and cap at 5×. Physics considers height, so separate bridge levels do not interact. An instant top-down slow-motion replay uses real kart-coordinate snapshots captured at 12Hz; it is not a fabricated video or external upload.

## 2. Kart garage and local economy
The garage offers five original kart palettes and three paid-by-earnings levels of engine, grip, armor and turbo upgrades. No real-money transactions. Completed single-player races earn capped credits, recorded once per run ID. Garage data and earned credits are stored locally. Multiplayer races use equalized stats so player purchases cannot confer an advantage. Personal best times are stored locally and labelled accordingly; these are not global validated rankings.

## 3. Build and share tracks
Creator Studio has an interactive top-down SVG track editor with 6–20 waypoints, height from 0–36m, four biomes and track-width controls. It validates area/point spacing and produces a versioned share code (e.g. `vc1_…`) or a URL using `?view=battle&trackcode=…`. A saved or imported custom circuit is actually generated in 3D with gates, elevated geometry, repairs, mines, AI racers and turbo pickups. Design storage is device-local; publishing is accomplished by sharing its link/code.

## 4. Two-device direct multiplayer
Live 2-player WebRTC race: host controls the authoritative physics simulation; the second device sends sanitized controls and renders replicated host snapshots. Host races in player kart, guest controls the BOLT slot; NOVA/PIXEL remain AI. Both vehicles can damage one another via collisions and blasts, and share the same track, laps, weather, and stunts. Setup uses three manual steps: copy host offer, copy guest reply, then paste reply into the host. No user account, backend, chat or global discovery is required. STUN-only WebRTC may fail behind carrier-grade NAT/restrictive firewalls without a TURN relay. P2P games are not server-verified. Stronger connections, instant room codes, and global leaderboards require a dedicated game backend; the already connected commerce databases were deliberately not reused.

## Controls
Battle Race: WASD/arrows to steer and accelerate, Space to drift, B bomb, V mine. Mobile touch pedals and weapon buttons remain. Creator Studio lives in the Battle Race lobby. Use the GARAGE, TRACK CREATOR, PLAY WITH FRIEND and BEST TIMES buttons. Once a race is finished, the results offer a real 12Hz top-down crash replay.

## QA and security notes
Unit tests cover original game physics, limits, environmental interactions, economy integrity of locally stored data, custom track validation, WebRTC payload sanitization and replay sampling. New browser smoke checks exercise editing and racing a custom track, WebRTC offer generation and garage upgrades. Client-side credits and local scores can be tampered with; they must **never** be treated as server-authoritative. No user data is uploaded by these features unless the player explicitly shares a pairing invitation or track URL.
