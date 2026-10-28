# Battle Race v3.2

An optional arcade combat layer on the existing **three-lap Voxel Valley racetrack**.
It is not a real-world explosive simulator and it does not change classic/XL Bot
Smash challenge rules or leaderboard versions. Open-world exploration and friendly
walking villagers are unchanged.

## Play

Choose **Race & Explore**, leave **Battle Race: ON**, then **Race 3 Laps**.
The same switch is in Galaxy Settings. Turn it off for the original classic race.

- **BOMB / B** throws a visible, bouncing arcade bomb ahead.
- **MINE / Q** places a warning mine behind the kart. It arms after a delay.
- Eight fixed mines occupy alternating sides of the track. Six explosive barrels
  sit near the road edges. Triggered mines/barrels display a blast warning before
  exploding. Nearby barrels can chain-react after their own warning delay.
- All three rival racers can deploy bombs/mines near the player. Explosions can
  damage both the player and rivals, including their owner; they have no team immunity.
- Kart health starts at 100. Blasts slow, jolt and push vehicles within the road.
  Wrecked player karts recover after 2.5 simulation seconds at a safe previously
  driven position, with temporary protection. Checkpoint/lap progress is preserved;
  the race timer keeps running during recovery. Rival wrecks respawn after five seconds.
- Two cyan ammo pads replenish limited bomb/mine inventory. Two green repair pads
  restore health. Pickups have cooldowns. Weapon presses are consumed once, not per frame.

## Scope and compatibility

Hazards are active in Battle Race only. They do not affect free-roam villagers,
animals, the original timed Showdown scores, shared invitations or recordings.
All visual effects are stylized block fragments and rings, with no graphic injuries.
There is no multiplayer or global score backend in this update.

## Safety and performance of the game simulation

Swept proximity tests catch fast-moving karts without teleport triggers. Arming
windows, start/recovery shields and damage cooldowns avoid unavoidable repeated
hits. Detonations are single-use per activation. Dynamic hazards and effect meshes
have fixed caps, and the renderer uses five instanced geometry pools. Damage and
scoring run in the existing bounded simulation steps. Pause freezes the race,
weapon timers and effects. Returning to the menu or another mode resets combat state.

`npm test` covers pure rules and all previous modes. `npm run test:browser` also
exercises real throwing, reverse-driving into a mine, AI blast damage, pause/reset,
classic mode, responsive touch hitboxes and returning to exploration/Showdown.
Real Samsung GPU, battery, heat and touch feel still require physical-device testing.
