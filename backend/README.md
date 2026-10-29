# Dedicated online ranking backend (not deployed)

The GitHub Pages release includes personal best times and 2-device WebRTC races without a backend. This optional backend enables **server-recomputed** rankings once a dedicated ANIK game Supabase project is available. Do not use the connected Native Smoke Shop or My Legacy Cannabis production/staging databases for a game.

Setup requires selecting a Supabase organization, creating a **new game-only project**, enabling supported sign-in, and reviewing data/privacy terms. Apply `backend/verified_scores.sql` to that project, then deploy `backend/edge/index.ts` as an Edge Function (`verify-run`) with environment-managed secrets. The Edge function imports the same deterministic battle-racing code to validate every submitted controller command before writing scores. Clients are never granted insert/update permissions, and the service-role key must never be placed in the GitHub Pages frontend.

Current limitations: the v4.0 public client does not yet capture ranked-mode input logs for server submission or authenticate players; the optional backend therefore cannot accept submissions from the public game until those pieces are connected. Creator tracks, peer-to-peer rooms, and garage upgrades are intentionally excluded from global ranked verification pending a rules/versioning and anti-cheat review. The local leaderboard does **not** imply a verified global leaderboard.

Run `node --test src/tests/backend.test.js` to test payload/schema guardrails. Before production deployment, pin tool versions, run Supabase Security Advisors, confirm RLS and column grants, load-test verification CPU limits, implement per-user request limits, validate CORS, and build the authenticated submission UI.
