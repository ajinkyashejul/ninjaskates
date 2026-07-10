# Architecture

*How NinjaSkates is put together. For the "why", see [decisions.md](decisions.md).*

## Big picture

```
┌────────────────────────────  browser  ────────────────────────────┐
│ main.js  ── menu flow, net loop, PREDICTION + RECONCILIATION      │
│ render.js ─ Three.js scene, skaters, VFX, postprocessing          │
│ hud.js  ─── DOM HUD + minimap        input.js ── WASD/touch state │
│ physics.js ─ shared movement sim (same file the server runs)      │
└──────────────┬─────────────────────────────────────────────────---┘
               │  WS: input {seq,u,d,l,r,f,dr}   ▲ snap @30Hz + events
┌──────────────▼────────────────────────────────────────────────────┐
│ ROOM (authoritative, 30Hz tick)                                   │
│  room.js ── players, projectiles, mines, crates, damage, clones,  │
│             match state machine (starting→playing→results→repeat) │
│  maps.js ── seeded procedural map defs   weapons.js ── loot table │
│  bots.js ── bot + shadow-clone steering  physics.js ── movement   │
└──────────────┬──────────────────────────────┬─────────────────────┘
        Node shell                     Cloudflare shell
   server/index.js                     src/worker.js
   Express + ws                        Worker + RoomDO (1 room = 1 DO)
   local dev / self-host               + LobbyDO (quick-play directory)
                                       + Workers Assets (static client)
```

The **simulation is transport-agnostic**: `room.js`, `maps.js`, `weapons.js`,
`bots.js`, and `public/js/physics.js` contain no Express/Workers code. The
two shells adapt them to their runtime and speak an identical protocol.

## Protocol (JSON over one WebSocket)

```
HTTP  POST /api/create {name?, map, duration, bots, clones, room?} → {room}
      POST /api/quick  {name?}                                     → {room}
      POST /api/join   {room}                                      → {room} | 404
WS    /ws/:code?name=Foo
client → server: {t:'input', s:<seq>, u,d,l,r,f,dr}   held-keys state
                 {t:'ping', ts}
server → client: {t:'joined', id, room, map, duration, clones}
                 {t:'snap', st, tl, p:[players], pr, mn, cr, ev:[events]}
                 {t:'pong', ts} | {t:'error', msg}
```

- `map` in `joined` is the **full map definition** (bounds, obstacles,
  spawns, crates, decor, paint) — client builds the arena from data.
- Snapshot player fields (short keys): `id,n,x,z,a,vx,vz,ls,df,hp,al,sh,bo,
  w,am,k,d,st,rs,bot,cl` — `ls` = last applied input seq (prediction ack),
  `df` = drifting, `cl` = clone-owner id, `st` = kill streak, `rs` = respawn
  countdown.
- Events (`ev`): kill, hit, boom, pickup, drift(boost), clone, matchEnd —
  one-shot, consumed for VFX/SFX/HUD.

## Netcode

- **Server**: 30Hz fixed tick. Inputs are stored per-player on receipt
  (`receivedSeq`) and **acked only when a tick applies them**
  (`lastInputSeq`). Snapshot broadcast every tick.
- **Client — own player**: predicted. Input pump runs on
  `setInterval(1000/30)` (never rAF): send input with seq, step the shared
  physics, store in `pendingInputs`. On each snapshot: rewind to server
  state, drop inputs ≤ acked `ls`, replay the rest, fold residual into
  `errX/errZ/errA` offsets that decay `exp(-14·dt)` (snap if error > 4u).
  Rendering adds **velocity extrapolation** — `pred.x + pred.vx·e` where
  `e = min(1/30, time since last step)` — so 30Hz sim looks smooth at any fps.
- **Client — remote players**: buffered snapshots, rendered ~100ms behind
  newest, lerped between the two bracketing snapshots (angle-wrapped).
- **`?fakelag=N`** (ms) query param injects symmetric artificial latency in
  `net.js` for testing.

## Movement model (`public/js/physics.js`)

Kinematic kart-style: decompose velocity into forward/lateral, apply
accel/brake/friction on forward, decay lateral by grip, cap speed
(`capScale` per entity — clones 0.85), recompose, integrate, collide.
Collision = circle vs circular-or-rect boundary + AABB obstacles with
restitution 0.4. Drift (Shift): grip 6.5→2.4, turn ×1.3, ≥0.6s charge →
+7.5 boost on release, decaying at 7/s back to cap. Constants at top of the
file are the tuning surface — change them there and both sides agree.

## Cloudflare shell (`src/worker.js` + `wrangler.toml`)

- **RoomDO**: `/init` (config, 409 if exists), `/exists`, WS upgrade
  (`WebSocketPair`). Starts the tick loop on first join, **stops it when the
  last player leaves** (DO hibernates), alarm deletes room config after 1h
  empty. Reports occupancy to the lobby.
- **LobbyDO** (singleton): `/acquire` (find-or-create a public room),
  `/update`, `/remove`.
- Static client served by Workers Assets (`[assets] directory = "public"`);
  only `/api/*` and `/ws/*` hit the worker.
- DO classes are **SQLite-backed** (`new_sqlite_classes`) → runs on the free
  plan. Deployed at `https://ninjaskates.ajinkyashejul.workers.dev`.

## Rendering (`public/js/render.js`)

- three r185, import-mapped to `/vendor/` files (no bundler;
  `scripts/copy-vendor.mjs` copies them on postinstall).
- **Postprocessing** (pmndrs): EffectComposer → RenderPass →
  EffectPass(SMAA, Bloom(mipmapBlur; neon maps get lower threshold / higher
  intensity), ToneMapping(ACES_FILMIC), HueSaturation(+0.22 sat),
  Vignette). Renderer: `antialias:false`, `NoToneMapping` — the composer
  owns AA and tone mapping. Falls back to plain renderer on failure.
- **Lighting**: HDRI env (`/assets/env/sky.hdr` day, `night.hdr` neon) at
  intensity 0.55, hemisphere 0.5, directional sun 1.5 with a **65u shadow
  camera that follows the player** (`sun.target` must be in the scene).
  PCFShadowMap (PCFSoft was removed in r185).
- **Skaters**: procedural chibi rig from primitives (see decisions D5),
  animated by code — stride, crouch, lean, drift sparks, dust, death
  barrel-roll, spawn bounce. Clones are darkened + translucent.
- **Maps**: built from the server's map def. Ground is a generated 2048px
  canvas texture (sand, grass patches, ponds, paths, speckle). Kenney glTF
  props via `assets.js` (bounding-box fit + primitive fallback). Water disc,
  sky dome, clouds, fog all scale with map size.
- Debug hooks on `window`: `__dbg` (prediction stats), `__renderer`,
  `__freezeCam`.

## Client files

| File | Role |
|---|---|
| `main.js` | menu flow, join modes (quick/create/join/`?room=` deep link), snapshot handling, prediction/reconciliation, event → VFX/HUD wiring |
| `render.js` | everything Three.js |
| `hud.js` | DOM HUD: timer, leaderboard, health, weapon, kill feed, banners, results + session tally, **minimap** |
| `input.js` | keyboard + touch (stick, fire, drift buttons); state-only, main.js owns sending |
| `net.js` | WS wrapper, ping loop, fakelag harness |
| `physics.js` | shared sim (see above) |
| `assets.js` | glTF preload + fitted instancing |
| `sfx.js` | 12 CC0 samples with procedural WebAudio fallbacks |
| `menu-scene.js` | 3D showcase scene behind the menu |

## Match flow

`starting` (3s countdown) → `playing` (3 or 6 min) → `results` (12s,
standings + session win tally) → auto-restart with fresh map state. Players
join mid-match; bots fill to 8 and are kicked as humans arrive; respawn 3s
with 2.5s spawn protection. Kill streak events at 3/5/7+.
