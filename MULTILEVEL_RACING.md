# Multilevel Crash Racing — v3.3

This update extends the dedicated Battle Race mode (`?view=battle`). Voxel Valley,
its optional combat layer, the large open world and versioned Bot Smash challenges
remain in the source package. No challenge leaderboard rules are changed.

## Choose the race

Before starting, select a track, **LAPS / ROUNDS** (1–10), and a weather option.
A round means one complete lap of the circuit. Every lap still requires all eight
checkpoints in order. The selected count controls the actual finish condition for
all four karts. Restart preserves the selection. Invalid URL or storage values
safely fall back to three laps and changing weather.

Options are saved locally under `anik-battle-options-v1`. Valid URL parameters,
for example `?view=battle&track=skybridge&laps=5&weather=dynamic`, can select a race.
They do not create a server-verified challenge or global leaderboard.

| Level | Track | Maximum road elevation |
| --- | --- | --- |
| 1 | Blast Circuit | 0 m; ground-level circuit |
| 2 | Canyon Fuse | 12 m; raised canyon sections |
| 3 | Frost Run | 10 m; icy ridges |
| 4 | Skybridge Sprint | 24 m; true two-deck crossover |
| 5 | Summit Switchback | 32 m; graded mountain route |

Elevations are virtual game metres. Roads, karts, gates, guardrails, repair pads,
mines and cameras follow the real road height. Support columns make the raised
sections visible. Upper and lower bridge surfaces are resolved by elevation;
a kart cannot collide with another kart or earn a checkpoint on a different deck.
The result screen offers **NEXT TRACK LEVEL**; there is no unlock system or
multi-race championship scoring in this release.

## Vehicle contact

Player–AI and AI–AI impacts use the same arcade collision solver. Rear-end,
head-on and side contact can transfer momentum, slow or shove a kart, and damage
armor when the closing speed is significant. Swept contact detection reduces
high-speed pass-through. Per-pair cooldowns prevent repeated frame-by-frame damage
while two vehicles remain in contact. Resting contact is not a damage source.

Shields prevent damage but do not make karts physically intangible. Disabled and
finished karts are excluded from active contact. A collision knockout uses the
existing two-second checkpoint recovery and temporary shield. Lap progress is
preserved; the race does not award a checkpoint for a recovery teleport.

## Weather and handling

Choose **Changing Weather**, **Clear**, **Rain**, **Snow**, or **Windy**. Dynamic
weather uses race simulation time, moves to a new state every 32 seconds, and
blends the visible and physical parameters over five seconds. The sequence is
clear → rain → snow → windy → clear. Frost starts snowy and Summit starts windy.
Pause freezes the weather clock along with vehicles and hazard timers.

Rain and snow reduce steering grip and braking effectiveness. Lateral tire slip
recovers more slowly on slippery surfaces. Gusts push karts sideways, with greater
exposure at altitude. Uphill and downhill road grades affect speed. The same
weather physics applies to all four karts. Sky, fog and precipitation reflect the
selected condition; precipitation follows the player's elevation.

These are lightweight arcade physics, not a full tire/suspension simulation. The
road remains guardrail-bounded: free-fall off cliffs, terrain deformation and
vehicle body deformation are not implemented. Bombs and mines remain stylized
fictional game hazards, with height-aware damage.

## Controls

WASD / arrows: drive. Space: drift. B: throw bomb. V: drop mine. P / Escape:
pause. C: camera. Touch controls include steering, gas, brake, drift and separate
weapon buttons. The existing Voxel Valley battle option retains its own B/Q
controls. There is no real-time online multiplayer in this update.

## Build and tests

Use Node 22, `npm install`, `npm test`, then `npm run build`. For a local production
preview under the repository URL, set `GITHUB_PAGES=true` and
`GITHUB_REPOSITORY=k6subramaniam/anik-block-racers` while building.

The GitHub Pages workflow retains the unit-test, production-build and browser-test
gates. The new `e2e/multilevel.spec.js` exercises selected laps/weather, all track
choices, pause/restart, actual elevated driving, a one-lap finish and next-level
navigation. A successful workflow is still required before claiming publication.

Physical Samsung performance, temperature, battery use and Samsung Internet
compatibility require device testing. A local software-rendered Chromium check
is not a hardware performance benchmark.
