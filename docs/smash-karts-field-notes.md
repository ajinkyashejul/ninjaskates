# Smash Karts — field notes & improvement backlog

*Compiled July 2026. Sources: (1) a live boot of the real client from a
sandboxed browser — network stack and load chain observed directly; the
Unity engine wedged on the container's software GPU before reaching a
match, so (2) moment-to-moment gameplay observations come from annotated
gameplay screenshots, and (3) systems detail from community documentation
(Smash Karts Fandom wiki, player guides).*

## 1. Tech observations (verified live)

- Boot chain: CDN-hosted, content-hash-named **Brotli bundles**
  (`*.framework.js.br`, `*.wasm.br`, `*.data.br`) → Unity WASM boot →
  **ad-network gate** (adinplay `aiptag`) → menu.
- **Firebase Realtime Database over WSS** opens immediately
  (`wss://webgltest-17af1.firebaseio.com`) — identity/presence/persistence,
  matching earlier research. Analytics via ByteBrew + GA.
- Runs 60fps at ~37ms ping on modest hardware → client-side prediction and
  a tight netcode loop are clearly present.
- Session structure: 3-minute matches, up to **12 players**, join-in-progress.

## 2. Gameplay/UX inventory (from screenshots)

| System | What they do |
|---|---|
| Entry | One PLAY button → instant matchmaking. No form. Map/mode choice exists only for private rooms. |
| Weapons on vehicle | Picking up a weapon **visibly mounts it on your kart** (triple cannons, MG rig). Everyone reads who is armed at a glance. |
| Overhead info | Enemy name + **level badge** + **health pip bar** above every kart. |
| Kill feedback | Weapon-specific, personal: "You were smashed by X's cannon balls". Confetti bursts at kill sites. |
| Spawn | Fast respawn, visible glowing protection ring. |
| Maps | Sculpted organic terrain: elevation, ramps, bridges, water channels, dense crate placement, decorative landmarks. Hazards/jump pads on some maps. |
| HUD | Rank chip, collapsible leaderboard w/ level badges, heart bar, big timer, FPS/PING, XP multiplier button, invite, settings. |
| Modes | FFA, Capture the Flag, Hat Holder, Gem Collector, Arms Race, Candy Rush. |
| Weapons (~11) | Cannons, machine gun, rockets, **homing missiles**, mines, **lobber** (arc grenade), freeze, laser, invincibility star, rare **nuke**. |
| Meta | XP per smash → levels → coins/hats/wheels/**character tokens** → prize-machine gacha. **58-day seasons** with challenge tracks + premium pass (600 gems). Lucky spins. Season shop. Daily challenges. |
| Monetization | Ads (preroll + reward), "remove ads", gem purchases. |

## 3. Gap analysis vs NinjaSkates (July 2026)

Have already: arena deathmatch loop, crates/weapons/powers, bots,
rooms/invites/quick play, kill feed + weapon-specific death messages,
rank chip/leaderboard/heart bar, countdown, respawn protection, knockback
physics, island + neon maps with HDRI/bloom/shadows, glTF props, 3D menu
preview, edge-distributed rooms (something SK does *not* have).

Missing, in order of visible impact:

### Tier 1 — feel & readability (client-heavy, cheap)
1. **Held/mounted weapons** — weapon visible on the skater + aim pose.
2. **Overhead health pips + level badge** on enemies.
3. Confetti kill bursts; richer spawn ring.
4. **Music + real SFX** (CC0 packs) replacing procedural beeps.
5. **Jump pads / boost pads / teleporters** — 2D-physics-friendly stand-ins
   for their terrain verticality.

### Tier 2 — depth
6. Homing missile, lobber, freeze; rare nuke.
7. **12-player rooms**; **client-side prediction**.
8. Instant PLAY (no form; auto-guest names).

### Tier 3 — retention meta
9. XP → levels → coins → cosmetics, persisted per browser token in a
   Durable Object (no accounts needed for v1).
10. Modes: Gem Collector, Hat Holder (near-verbatim fits for our sim),
    Arms Race (loot-table tweak).
11. Challenges, spin-wheel rewards, seasonal reskins.

## 4. Why Smash Karts went viral (working theory)

1. **Distribution**: unblocked/portal ecosystem (Poki, CrazyGames, school
   Chromebooks) — the concept is inseparable from where it spreads.
2. **Zero friction**: URL → PLAY → shooting someone within 20 seconds.
3. **3-minute sessions**: fits a school break; "one more round" loops.
4. **Readable chaos**: 12 players, big telegraphed weapons, funny deaths.
5. **Cute + collectible**: animal drivers, hats, gacha tokens, seasons.
6. **Spectacle per kill**: confetti, ragdoll karts, named kill messages.
