# Bigger World & XL Arena — v3.1

## Physical playable dimensions

Open-world kart-centre bounds expand from 302 × 252 m to 906 × 756 m: three times each axis, nine times the playable area. Continuous textured ground extends beyond the bounds, so the larger space is not a camera zoom or a hidden empty void. The existing central world and original three-lap circuit remain at their previous positions and scales.

Four new destinations bring the total to ten districts and ten relics: Evergreen Wilds, Aurora Fields, Sunset Outpost and Redrock Valley. Twelve highway segments connect the outer districts to each other and to the original map. The expansion adds deterministic chunked trees/stone columns and sixteen solid landmarks. Roads, spawn points and relic positions are kept clear of those collision footprints.

New Bot Smash challenges use a 164 × 164 m arena, four times the original 82 × 82 m area, with sixteen bots, six ramps and six boosts. The duration remains sixty seconds. Existing `sd1-` invitations retain the original physical arena, bot layouts and scoring rules. New daily/random challenges use `sd2-` identifiers; old and new records remain on separate per-challenge device leaderboards.

## Controls and access

From the home menu, choose Race & Explore, then Explore Open World. The map lists all ten districts and three lakes. Select one of the four frontier districts to fast travel, or follow the highways beyond the original map edge. The existing touch pedals, keyboard controls, NPCs, villagers, water and weather are retained.

The daily challenge on the main menu defaults to the XL arena. Opening an older shared invitation intentionally selects the classic arena for fair score comparison.

## Mobile performance

Repeated scenery uses instanced geometry grouped into spatial chunks. Distant chunks are hidden according to Eco/Balanced/High quality. Collision queries use a spatial index instead of scanning every new obstacle each physics step. The sky follows the camera horizontally and quality-aware fog covers the extended viewing distance.

The world is bounded and primarily flat-drivable, not infinite or editable voxel terrain. New landmarks are solid obstacles, not climbable interiors. Physical Samsung frame rate, heat and battery life require device validation; passing automated browser tests is not a hardware benchmark.

## Verification

`npm test` covers expanded bounds, navigation, map projection, deterministic scenery, clear highway centre lines, safe fast travel, one-time relics, versioned arenas and score storage. `npm run test:browser` covers the XL and classic modes, driving in each outer district, screenshots and return to the existing race. GitHub Pages publication is gated on the full test/build workflow.
