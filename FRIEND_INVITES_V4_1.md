# ANIK v4.1 — One-tap private race invitations

Create a private game link instead of exchanging WebRTC SDP offer/answer codes.

1. From the main game screen tap **Invite a Friend**, or open `?view=battle` and choose **Play With Friend → Create Race Room**. Android installed-app shortcuts can also open the invitation screen directly.
2. Tap **Share Invite** (Samsung native sharing when available) or **Copy Link**, then send the link privately through Messages, WhatsApp, or email.
3. The friend opens the link on another phone or computer. The game automatically loads Battle Race and joins the same room. Both browsers discover each other through the public Nostr signaling relays provided by Trystero; game packets then use encrypted WebRTC.
4. The host sees **2 / 2 Racers Connected**, closes the panel, chooses the track/laps/weather, and starts the race. The guest sees the lobby until the host starts.

Rooms use a 128-bit cryptographically random secret placed in `#race=...`, not a URL query parameter. That keeps the capability out of normal HTTP request and referrer paths. Room peers must share the same secret; it is not user identity authentication. The room supports **two human racers**, not eight, plus AI opponents. Only the accepted guest can supply inputs. The host owns simulation, collisions, scoring and the race configuration. Third visitors are rejected by the in-game application handshake.

No new Supabase project, account or database is required for this version. Existing commerce databases remain untouched. The new lightweight transport is dynamically loaded only when the multiplayer room is opened. The legacy SDP method is still available under **Having trouble connecting? → Advanced · Manual Pairing**.

## Networking limitations

Trystero's default public Nostr relays are third-party infrastructure, not guaranteed production-grade signaling. Firewalls, restrictive cellular carrier NATs, or blocked WebSockets can prevent discovery or WebRTC connectivity. An independently managed signaling relay and a TURN service with short-lived credentials are the next step for reliable cross-network public matchmaking. Do not commit TURN secrets in frontend code.

## Testing and release

`npm test` validates secure invitations, fragment link parsing, host-only acceptance, two-device data exchange via a fake signaling relay, third-peer rejection, room teardown and pre-existing simulation behavior. `npm run test:browser` exercises the actual Create Room UI, shareable link, automatic Battle Race opening in a second browser, no pairing-code entry, plus the legacy manual fallback, on mobile-sized views.

A passing browser UI test does not certify successful peer discovery across two physical Samsung devices on different mobile networks. Verify device-to-device gameplay before declaring that reliability proven.
