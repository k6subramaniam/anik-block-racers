# Battle Circuits — v3.2

The dedicated Battle Race menu adds three selectable circuits alongside the Voxel Valley battle option already present in this repository. No existing track, battle controls, test coverage, open-world feature or sd1/sd2 challenge is removed.

Open `?view=battle` or press Battle Race in the Bot Smash lobby. Choose Blast Circuit (balanced), Canyon Fuse (tighter bends), or Frost Run (reduced grip). Each is a three-lap race against Bolt, Nova and Pixel with eight sequential checkpoints per lap.

## Dedicated circuit controls

WASD/arrows drive, Space drifts, B throws a bomb, V drops a mine, P/Escape pauses, and C switches cameras. Phones have separate BOMB and MINE buttons in addition to their two-thumb driving controls. These circuit controls are separate from Voxel Valley's B/Q controls, which remain unchanged.

Track mines and explosive crates warn before detonating. Bombs follow a visible arc and explode on a timer; dropped mines arm after a delay. Every kart begins with 100 armor and uses the same radial damage, speed loss, knockback and short hit protection. Your own explosives can damage you. AI racers can deploy both weapons with the same cooldown rules.

A disabled kart returns to its last passed checkpoint after two seconds with full armor and a temporary shield. It does not earn checkpoint or lap progress by respawning. Green repair pads restore 40 armor. Bombs recharge in six seconds and dropped mines in nine. Track hazards regenerate after cooldown; deployed mines expire. Hazards and fragment effects have fixed caps and use instanced rendering. Reduced particle settings are available.

## Compatibility

Voxel Valley's existing Battle Race ON/OFF option, ammo pads and combat implementation are preserved in `src/battle/rules.js`, `BattleUI.jsx` and `BattleFX.jsx`. Their original test suites remain enabled. The new circuits use `src/battle/simulation.js`, `Game.jsx`, `Scene.jsx` and `tracks.js` with their own tests. The new mode does not modify daily challenge scores or shared challenge seeds.

## Verification

New logic tests cover complete races on all circuits, deterministic simulation, player/AI damage parity, self damage, blast ownership, chain reactions, arming, cooldowns, respawn, repair, and ordered checkpoints. Browser tests exercise real mine damage, AI health loss, both weapon buttons, pause/background handling, track selection, full-screen layout bounds and navigation back to the existing modes. All pre-existing tests are retained.

These are fictional arcade effects, not realistic explosives. Battle Race is single-player against rule-based AI, not online multiplayer. Physical Samsung performance, heat, battery life and Samsung Internet-specific behavior still require real-device testing.
