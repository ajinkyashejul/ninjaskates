# NinjaSkates 🥷🛹

A browser-based multiplayer arena deathmatch. Ninjas on skateboards grab
weapons and power-ups from crates and smash each other for kills before the
match timer runs out. Inspired by the architecture of Smash Karts, rebuilt
web-native.

## Play

```bash
npm install
npm start          # Node server on http://localhost:3000
```

## Deploy to Cloudflare (Workers + Durable Objects)

The same game deploys to Cloudflare's edge, where **each room is a Durable
Object** — a single-threaded instance that every player's WebSocket routes
to worldwide. Rooms scale horizontally and idle rooms cost nothing.

```bash
npm install
npx wrangler login          # or export CLOUDFLARE_API_TOKEN=...
npm run cf:dev              # local workerd dev server on :8787
npm run cf:deploy           # deploy to <name>.workers.dev
```

The Node server (`server/index.js`) and the Worker (`src/worker.js`) are two
shells around the same simulation code and speak the same protocol: room
selection over `POST /api/create|quick|join`, then a WebSocket to
`/ws/:code`. On Cloudflare, quick-play matchmaking lives in a singleton
lobby Durable Object that room objects report their occupancy to, and
idle room objects stop their tick loop so they can hibernate (an alarm
reaps the room config after an hour of emptiness).

- **Quick Play** — join a public room with players (and bots) worldwide.
- **Create Room** — pick a map, 3 or 6 minute matches, optional bots, then
  share the invite link (`/?room=CODE`) with friends.
- **Join Room** — enter a friend's 5-letter room code.

**Controls:** WASD / arrow keys to skate, Space or mouse click to attack.
Touch devices get an on-screen joystick and fire button.

## The game

- Up to **8 players** per room; bots fill empty slots and get kicked when
  humans join.
- **Crates** spawn around the map. Skate into one to get a random weapon —
  🌀 ricocheting shurikens, 🚀 rockets with splash damage, 🔫 a minigun, or
  💣 proximity mines — or a power-up (shield, speed boost, health pack).
- Smash opponents to climb the kill leaderboard. Getting smashed respawns
  you after 3 seconds with brief spawn protection.
- When the timer hits zero, final standings are shown and a new match
  starts automatically. Players can join mid-match.
- Three maps: **Sunset Skatepark**, **Neon Rink**, **Rooftop Rumble**.

## Architecture

Smash Karts is a Unity WebGL build with Firebase services and a separate
realtime layer. NinjaSkates maps each of those concerns onto a deliberately
lighter, fully self-hosted stack:

| Concern | Smash Karts | NinjaSkates |
|---|---|---|
| Rendering | Unity → WebAssembly → WebGL 2 | Three.js (WebGL) into one `<canvas>` |
| Realtime multiplayer | dedicated netcode | Node.js + `ws`, server-authoritative sim |
| Rooms / matchmaking | room links + global quick play | same: room codes, invite links, public quick-play pool |
| Menus / HUD | Unity UI + JS bridge | plain DOM overlay on top of the canvas |
| Assets | CDN AssetBundles | maps are pure data, models built from primitives at runtime |

### Server (`server/`)

The server owns all game state — clients send only their held inputs and
can't cheat position, ammo, or health.

- `index.js` — Express static hosting + WebSocket endpoint, room registry,
  room codes, quick-play matchmaking, idle-room reaping (rooms survive 60s
  with no humans so a host refresh doesn't strand friends holding the link).
- `room.js` — the simulation: **30Hz tick**, kart-style movement (throttle /
  steer / friction), circle-vs-AABB collision against map obstacles,
  projectiles (with ricochet + splash), mines, crate loot, damage, kills,
  respawns, spawn protection, match timer and the results → new-match cycle.
  Broadcasts **15Hz JSON snapshots** plus one-shot events (kills, booms,
  pickups) to every client in the room.
- `maps.js` — arenas as pure data: bounds, obstacle boxes, spawn points,
  crate locations, theme colors. The whole map definition is sent to the
  client on join.
- `weapons.js` — weapon/power stats and the weighted crate loot table.
- `bots.js` — bots use the same input interface as humans: seek a crate when
  unarmed, chase and lead-shoot the nearest enemy when armed, reverse out
  when stuck.

### Client (`public/`)

- `js/main.js` — menu flow, snapshot buffering, and **entity interpolation**:
  rendering runs ~130ms behind the newest snapshot and lerps positions/angles
  between the two bracketing snapshots, so 15Hz network updates look like
  60fps motion.
- `js/render.js` — Three.js scene: arena built from the map data, skater
  models assembled from primitives (deck, wheels, body, masked head,
  headband), name sprites, crates, projectiles, shield bubbles, blob
  shadows, explosion effects, and a chase camera.
- `js/hud.js` — DOM HUD: match timer, live kill leaderboard, health bar,
  weapon + ammo, kill feed, respawn/results overlays, ping + FPS.
- `js/input.js` — keyboard + touch joystick; sends input state on change
  with a keepalive.
- `js/sfx.js` — procedural WebAudio sound effects (no audio assets).
- `js/net.js` — WebSocket wrapper with a ping loop.

### Protocol

JSON over a single WebSocket:

```
client → server:  create | join | quick | input {u,d,l,r,f} | ping
server → client:  joined {id, room, map, duration}
                  snap {state, timeLeft, players, projectiles, mines,
                        crates, events[]}
                  error | pong
```

## Notes / future work

- Client-side prediction for the local player (currently everyone is
  interpolated, so your own inputs carry one round-trip of latency —
  imperceptible on LAN, noticeable over long links).
- Persistence (accounts, XP, cosmetics) would slot in where Smash Karts
  uses Firebase; the server is stateless beyond live rooms.
- Binary snapshots (or delta compression) if rooms grow beyond 8 players.
