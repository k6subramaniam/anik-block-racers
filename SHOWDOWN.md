# ANIK Bot Smash Showdown — v3.0

A new standalone mode in the existing ANIK Block Racers browser game. The original racing and open-world implementation remains available through **Race & Explore** and is not replaced.

## Play

Select Daily or New Challenge, then Play · 60 Seconds. Accelerate toward the first robot. Use WASD/arrows or simultaneous touchscreen pedals; Space drifts, C switches cameras, P/Esc pauses. Chain robot knockouts and ramp landings within five seconds for up to a 5x multiplier. The round ends after 3,600 fixed 1/60-second gameplay ticks. Pausing or backgrounding freezes the simulation.

Daily challenge identifiers are based on the UTC date. Shared links preserve a versioned seed, which fixes robot paths and weather progression. They also display a friend's target score. Shared scores are explicitly **unverified** and do not enter the local leaderboard automatically.

## Replays and sharing

The game keeps compact transform snapshots from the actual run at 12 Hz. Watch Highlight plays a six-second window around a scored stunt at 0.65x speed. Make 9:16 Clip captures that replay into a 540x960 video using the browser's supported MediaRecorder codec (WebM or MP4); it does not capture the microphone, camera or desktop. Share Score Card produces a 540x960 PNG from actual gameplay. Native device sharing is attempted only on a button press, with file download or copy-link fallbacks. No social accounts are connected and nothing is posted automatically.

## Scores and privacy

The leaderboard contains completed runs saved **on this browser/device only**, grouped by challenge seed. It is not a global or server-verified ranking. Client-side validation catches malformed data but is not an anti-cheat service.

Local play statistics are off by default. Players may opt in under Device Leaderboard > Local play stats & privacy. The bounded log records only allowlisted events, valid challenge IDs, scores and timestamps. Nothing is sent to a server. The JSON export is for local diagnosis, not audience-wide conversion or retention reporting. Turning collection off removes the event log.

A dedicated backend, score verification, abuse controls and a reviewed data policy are required before enabling a global leaderboard or aggregate analytics. Existing unrelated business databases are not used.

## Build and verification

Node 22+ is recommended. Run `npm install`, `npm test`, and `npm run build`. For the GitHub Pages path set `GITHUB_PAGES=true` and `GITHUB_REPOSITORY=k6subramaniam/anik-block-racers` during build. Browser tests run with `npx playwright install --with-deps chromium` then `npm run test:browser`.

The workflow tests the release branch without publishing. On main it repeats unit tests, builds and exercises real gameplay in Chromium before deploying. Browser evidence is saved as a workflow artifact, not committed as game source.

Physical Samsung frame rate, heat, battery life and native Android sharing should still be tested on the device. Browser video codec support varies; score cards and challenge links are the fallback.
