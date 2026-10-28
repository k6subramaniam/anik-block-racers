# Battle Race — v3.2

Battle Race is a separate three-lap racing mode. It does not change published sd1/sd2 challenge layouts, their scores, the larger open world, or friendly villagers. Open `?view=battle`, or use the Battle Race button in the Bot Smash lobby.

## Tracks and controls

Choose Blast Circuit, Canyon Fuse or Frost Run. Four karts race through eight sequential checkpoints per lap. Finish three laps to see the race standings. WASD/arrows drive; Space drifts; B throws a bomb; V drops a mine; P/Esc pauses; C switches the camera. On a phone, use steering/pedal controls and the BOMB/MINE buttons. Simultaneous touch input and pointer cancellation are handled independently.

These are fictional arcade hazards, not real-world explosive models. Red tiles are mines; orange crates are explosive track props. Triggering a mine or crate starts a short visible warning, followed by a cubic blast. Orange circles show the danger radius. Bombs follow a short animated arc and explode on a timer. Dropped mines arm after a delay. Bombs recharge in six seconds; mines recharge in nine. Holding a weapon key does not spam deployments. Bots can use both weapons with the same cooldown rules.

## Damage and recovery

Every kart starts with 100 armor. Player and AI share the same radial damage, speed loss, knockback and brief hit immunity. Your own explosives can damage your kart. A destroyed kart waits two seconds, then returns to its last passed checkpoint with full armor and a temporary shield. Recovery cannot advance laps or skip checkpoint order. Green repair pads restore 40 armor with a per-kart cooldown. Blasts never affect villagers, because combat exists only in this mode.

Track hazards regenerate after a cooldown. Deployed mines expire; active hazards and explosion particles have hard caps. Repeated visuals are instanced. Reduced-effects settings lower debris count. Pause/background freezes AI, timers, fuses and the race together.

## Verification and limitations

Pure tests cover all three complete races, damage parity, self damage, radial falloff, immunity, blast ownership, cooldowns, chain reactions, checkpoint validation, respawn, repair, stable geometry and old challenge compatibility. Browser tests exercise actual mine damage, AI health changes, bomb/mine buttons, simultaneous input, pause/background, track selection and responsive layouts. Existing browser suites remain enabled.

This remains single-player with rule-based AI, not online multiplayer. Battle standings are per-race and are not a server-verified global leaderboard. Obstacles, impulses and explosions use lightweight game physics rather than real explosive or fluid simulation. Physical Galaxy performance, heat, battery life and Samsung Internet-specific behavior still require device testing.
