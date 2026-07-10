# Gameplay design & tuning reference

*What the game plays like and every number that shapes it. Constants live in
code (single source of truth) — this doc tells you where and what the intent
is.*

## Core loop

Arena deathmatch, up to **8 players** (bots fill empty slots). Skate into
crates for a random weapon or power-up, smash opponents for kills, most
kills when the timer ends wins. Matches are 3 or 6 minutes, back-to-back,
join-in-progress. Every kill raises a **shadow clone** that fights for you.

## Movement (constants in `public/js/physics.js`)

| Constant | Value | Intent |
|---|---|---|
| MAX_SPEED / BOOST_MAX_SPEED | 17 / 22 | tuned for R=180 island (~21s to cross) |
| ACCEL / KICK_ACCEL | 24 / 38 | skaters launch hard off the line |
| BRAKE / REVERSE_MAX | 42 / 6 | strong stop, slow reverse |
| FRICTION | 10 | coast bleed |
| TURN_RATE | 3.6 rad/s | base steering |
| LATERAL_GRIP | 6.5 | sideways slip decay — lower = driftier |
| DRIFT_GRIP / DRIFT_TURN | 2.4 / ×1.3 | big controlled slide, extra steering |
| DRIFT_MIN_CHARGE / DRIFT_BOOST | 0.6s / +7.5 | earn the boost, feel the reward |
| OVERSPEED_DECAY | 7/s | boost bleeds back to cap |
| RESTITUTION | 0.4 | wall bounce |
| PLAYER_RADIUS | 0.7 | collision circle |

**Drift** is the skill mechanic: hold Shift in a turn at speed > 6; sparks
show charge; release after 0.6s for the boost. Server-validated,
client-predicted, works on touch (🌀 button).

## Combat (constants in `server/weapons.js`, `server/room.js`)

| Weapon | Ammo | Fire | Damage | Notes |
|---|---|---|---|---|
| 🌀 Shurikens | 6 | 0.35s | 25 | ricochet ×2 off walls |
| 🚀 Rocket | 3 | 0.8s | 55 + 35 splash (r3.2) | knockback 16 at ground zero |
| 🔫 Minigun | 24 | 0.09s | 7 | 0.09 rad spread |
| 💣 Smoke mines | 3 | 0.5s | 65 + 40 splash | dropped behind, 1s arm, 30s life |

Powers: 🛡 shield 5s, ⚡ speed boost 5s (cap 22), ❤️ health +40.
Loot weights: shuriken 22, rocket 16, minigun 16, mine 12, shield 10,
boost 12, health 12.

Health 100, respawn 3s, spawn protection 2.5s, crates respawn 8s after
pickup (pickup radius 1.7). Kill-streak banners at 3/5/7+.

## Shadow Clones (`server/room.js`, driven by `server/bots.js`)

Signature mechanic — see decision D11.

| Parameter | Value |
|---|---|
| Spawn | one per kill, next to the killer |
| HP / scale / speed | 40 / 0.85 / 0.85× cap |
| Weapon | infinite shurikens, fires 2.5× slower |
| Caps | 3 per player, 12 per room |
| Death | all your clones die with you; clones never respawn |
| Credit | clone kills count for the owner |
| Behavior | escort owner in formation; attack owner's nearest enemy; never loot crates |

Balance intent: momentum, not army — fragile, weak DPS, and killing the
leader wipes their clones (comeback mechanic). Toggleable per room.

## Maps (`server/maps.js` — seeded procedural, def sent to client)

| Map | Shape | Size | Character |
|---|---|---|---|
| 🏝️ Sunny Island (`skatepark`) | circle | R=180 | beach: central mound, torii roads, watchtowers, hut villages, palms, ponds, docks; 54 crates in rings, 16 spawns |
| 🌌 Neon Rink (`neon`) | circle | R=140 | night: glow pillar rings, barrier walls; 39 crates, 12 spawns |
| 🏙️ Rooftop Rumble (`rooftop`) | rect | 380×280 | AC units, vents, parapets; 42 crates, 12 spawns |

Generation: `mulberry32(seed)` + scatter (min-spacing rejection) and ring
helpers. Crates ring outward from center so fights have gradient density;
spawns sit on an outer ring. Changing a map = editing its build function;
same seed → same layout on server and every client.

## Rooms & session (office-first, see decision D9)

- **Quick Play** → LobbyDO finds/creates a public room.
- **Create Room** → map, 3/6 min, bots 0/3/6, clones on/off, optional
  **vanity code** (4–8 chars, e.g. `OFFICE`) for a standing daily room.
- **Deep link** `/?room=CODE` joins-or-creates; URL rewritten after join so
  refresh rejoins.
- **Session win tally** on results screen persists across matches while the
  room lives.

## HUD

Rank chip, room code + invite-link copy, big timer, leaderboard (clones
excluded), health bar, weapon + ammo, clone counter (☁ ×n), kill feed,
weapon-specific death messages, hitmarker + damage numbers, pickup/streak
banners, 3-2-1 countdown + GO, **minimap** (boundary, live crates,
enemy/clone blips, own heading wedge), ping/fps.

## Controls

WASD/arrows skate · Space/click attack · **Shift drift** · touch: stick +
⚔️ + 🌀. Sound: 12 CC0 samples (`public/assets/sfx/`) with procedural
fallbacks.
