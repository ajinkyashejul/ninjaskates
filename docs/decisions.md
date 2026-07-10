# Decision log

*Every significant decision made while building NinjaSkates, with the context
that produced it. Read this first in a new session — it explains **why** the
code is the way it is. Newest decisions at the bottom. Dates are July 2026.*

---

## D1. Web-native stack instead of a game engine

**Context.** The project started from a teardown of smashkarts.io: Unity WebGL
(WASM) + Firebase + CDN asset bundles. We considered replicating that shape.

**Decision.** Plain JavaScript ES modules, Three.js for rendering, DOM for all
UI, no bundler, no build step (only a `postinstall` script that copies vendor
files). One `npm start` and the game runs.

**Why.** Instant page load (Smash Karts ships ~40MB of WASM; we ship ~50KB of
worker + small assets), one-second iteration loop, and every line readable.
The genre (top-down-ish arena, kinematic physics) doesn't need an engine.

**Consequences.** No physics engine — we wrote our own kinematic sim
(`public/js/physics.js`). No asset pipeline — models are Kenney glTF or built
from primitives at runtime. Import maps stand in for a bundler.

## D2. Server-authoritative simulation

**Decision.** The server owns all state. Clients send *only held inputs*
(`{u,d,l,r,f,dr}` + a sequence number). Position, ammo, health, cooldowns are
never trusted from the client.

**Why.** It's a competitive game destined for strangers on the internet;
authoritative servers are the only real anti-cheat. It also made the later
Durable Objects port natural (one room = one single-threaded authority).

## D3. Hosting on Cloudflare Workers + Durable Objects

**Context.** User asked "can this deploy on Vercel?" then "where can I host
this, best free tier?". Vercel/Netlify functions can't hold a stateful
WebSocket game loop. Compared Render/Railway/Fly (always-on Node, ~$5+/mo,
single region) against Cloudflare.

**Decision.** Cloudflare Workers + Durable Objects. **One room = one DO**
(`RoomDO`), quick-play matchmaking in a singleton `LobbyDO`. Static client
served from Workers Assets. SQLite-backed DO classes so the **free plan**
works.

**Why.** Free tier covers real usage; rooms are single-threaded actors that
match our room model exactly; players connect to the nearest edge; idle rooms
hibernate and cost nothing.

**Consequences.** We keep **two shells around one sim** (D4). DOs can't use
`setInterval` freely across hibernation — rooms stop ticking when empty and an
alarm reaps room config after 1h. Live URL:
`https://ninjaskates.ajinkyashejul.workers.dev`.

## D4. Two deployment shells, one simulation

**Decision.** `server/index.js` (Node + Express + ws, for local dev) and
`src/worker.js` (Cloudflare) are thin transports around the same
`server/room.js` / `server/maps.js` / `server/weapons.js` / `server/bots.js`
/ `public/js/physics.js`. Both speak the identical protocol
(`POST /api/create|quick|join`, then WS `/ws/:code?name=`).

**Why.** Local dev with instant restart and no wrangler emulation quirks;
tests run against Node; production runs the same logic on DOs.

**Rule.** Never put transport-specific code in the sim files. If you touch the
protocol, update both shells.

## D5. Skates + chibi human avatar (not karts, not skateboards)

**Context.** Game began with skateboards. User: "avatar more human
(cartoonised), let them wear **skates**", with a reference image of a cartoon
kid in a red/yellow helmet on inline skates.

**Decision.** Chibi kid proportions (big head, small body), red helmet with
yellow stripe, anime eyes, knee pads, gloves, **orange inline skates**. Built
from Three.js primitives in `render.js#buildSkater` (not a rigged glTF), with
hand-coded procedural animation: skewed-sine stride, crouch at speed, lean
into turns, idle weight-shifts, death barrel-roll, spawn bounce.

**Why primitives over a rigged model.** Full control of silhouette and squash
& stretch at this art scale; no skinning/animation pipeline; trivially cheap
to render 8+ of them.

## D6. Netcode: 30Hz tick, JSON snapshots, client prediction + reconciliation

**Context.** User verdict on the interpolation-only version: "The controls,
the experience, the competitiveness is nowhere near smashkarts." Every input
carried a full RTT of lag.

**Decision (the "feel sprint").**
- Server ticks at **30Hz** and broadcasts a **snapshot every tick** (30Hz,
  JSON; was 15Hz).
- **Shared physics module** (`public/js/physics.js`) runs identically on
  server and client. Deterministic, dependency-free — this file is the
  contract; any drift between the two copies of the algorithm rubber-bands.
- Client **predicts the local player** with sequence-numbered inputs, and
  **reconciles**: on each snapshot, rewind to server state, replay all inputs
  the server hasn't applied yet, fold the residual error into smoothing
  offsets (`errX/errZ/errA`, exponential decay `exp(-14·dt)`, hard snap if
  >4u).
- Remote players stay interpolated ~100ms behind.

**Key subtleties (each was a bug first):**
- **Ack on apply, not on receipt.** The server acks an input seq only when a
  tick actually consumes it (`p.receivedSeq → p.lastInputSeq` at tick top).
  Acking in the message handler caused replay gaps → drift-boost overshoot
  and rubber-banding.
- **Prediction pump on `setInterval(1000/30)`, not rAF.** Rendering stalls
  (asset loads, tab jank, software GL) must not stall the sim or inputs
  bunch up.
- **Velocity extrapolation between sim steps.** Rendering at 60fps while
  simulating at 30Hz aliases into visible vibration (user: "everything just
  seems to vibrate on move"). Own player renders at
  `pred.x + pred.vx · min(DT, now − lastStepAt)`. Plain lerp was tried first
  and failed under burst catch-up.

## D7. Graphics upgrade via public CC0 libraries (user-approved "Vivid" grade)

**Context.** User: "Any public libraries or artifacts we can use for better
graphics?... When you find equally good options, ask me for decision."

**Decision.**
- **three r185** (upgraded from 0.160 to satisfy `postprocessing` peer dep).
- **pmndrs `postprocessing`**: SMAA, mipmap-blurred Bloom, ACES filmic tone
  mapping, hue/saturation, vignette — composed in one `EffectPass`.
  Renderer runs `antialias:false, NoToneMapping` (composer owns both).
- **HDRI environment lighting** (Poly Haven `sky.hdr` day / `night.hdr` neon)
  with `scene.environmentIntensity = 0.55`.
- **Kenney CC0 assets**: Pirate Kit glTF props (palms, crates, boats, huts…)
  via `assets.js` (bounding-box-fit instancing, primitive fallbacks if a
  model fails), plus 12 CC0 sound samples with procedural WebAudio fallbacks.
- Color grading **A/B was put to the user**; they chose **B: "Vivid"**
  (saturation +0.22, sun 1.5, brighter grade) over the softer look.

**Vendoring rule.** No bundler, so `scripts/copy-vendor.mjs` copies exact
files from `node_modules` into `public/vendor/`. GLTFLoader r185 needs
`BufferGeometryUtils.js` **and** `SkeletonUtils.js`; RGBELoader needs
`HDRLoader.js`; three.module.js now imports `./three.core.js`. Miss one and
the whole client module graph 404s (symptom: menu buttons dead).

## D8. Identity: "ninja" is the brand, skating is the movement

**Context.** User asked us to play Smash Karts, take field notes, then
"challenge the core concept... come up with original ideas that might go
viral." Seven concepts were scored (see `concept-brainstorm.md`).

**Decision.** Keep the skating arena base; make **Shadow Clones** the
signature mechanic (concept D) and plan **rails/tricks** (concept A) as the
skating payoff. Hot Potato / Sumo held as future party modes; office-chair
and capybara reskins parked as later A/B experiments.

**Why.** Clones reuse the bot system (~90% engine reuse), no other .io arena
has them, and they justify the name.

## D9. The office is the beta group — standing rooms & session tally

**Context.** User: "we play 3 games of smashkarts everyday in office after
our standup. Whatever we build, that's going to be my beta group."

**Decision.** Features aimed squarely at that ritual:
- **Vanity room codes** (4–8 chars, e.g. `OFFICE`) via `POST /api/create
  {room}` — reuse the same code daily as a standing room.
- **Deep link `/?room=CODE`** joins the room, creating it if needed, so one
  bookmarked link works every day. URL is `replaceState`d after any join so
  refresh rejoins.
- **Session win tally** across matches on the results screen (bragging
  rights persist while the room lives).
- Back-to-back matches: results screen for 12s, then auto-restart;
  join-in-progress always allowed.

**Implication for future work.** This audience is ~6 players on one LAN —
prioritize competitive fairness, match pacing, and spectacle over
strangers-matchmaking features.

## D10. Drift-boost as the core skill mechanic

**Decision.** Hold **Shift** while turning at speed > 6 to drift (grip drops
2.4, steering ×1.3); hold ≥ 0.6s and release for a +7.5 speed boost that
decays back to the cap. Server-validated, client-predicted, with spark VFX
and a boost event.

**Why.** Smash Karts' depth is its drift; a skill ceiling for the daily office
group. Skates make sliding believable.

## D11. Shadow Clones (signature mechanic) — shipped

**Decision.** Every kill spawns a **shadow clone** of the killer (dark
translucent copy, ☁-prefixed name): bot-driven, 40 HP, 0.85 scale, infinite
shurikens but fires 2.5× slower, escorts its owner in formation, never loots
crates. Caps: 3 per player, 12 per room. All clones die with their owner.
Clone kills credit the owner. Toggleable per room (`clones` option, on by
default); snapshot field `cl` = owner id.

**Balance intent.** Clones are momentum, not army: fragile, weak DPS, and
killing the leader wipes their clones — a built-in comeback mechanic.

## D12. Maps 10x+ bigger, seeded-procedural, with minimap

**Context.** User: "Each map needs to be at least 10x bigger. Currently you
can travel full map in about 5 seconds."

**Decision.**
- Rewrote `server/maps.js` as **seeded procedural generation** (`mulberry32`
  PRNG + scatter/ring helpers). Sunny Island R 32 → **180** (~31× area,
  ~21s to cross), Neon Rink R → 140, Rooftop → 380×280. Content scales with
  the space: torii-gate roads, watchtower landmarks, hut villages, ponds,
  docks, ~54 crates in concentric rings, 16 spawns.
- **Speed raised to match**: MAX_SPEED 17, boost cap 22, drift boost 7.5.
- **Minimap** added (bottom-right canvas): boundary, live crate dots, enemy /
  clone blips, own heading wedge — you need to *find* fights now.
- **Sun shadow camera follows the player** (fixed 65u range) instead of
  covering the whole map — sharp shadows anywhere at no texture cost.
- Fog, camera far plane, sky dome, water disc, fence tessellation, cloud
  count all scale off map dimensions.

**Why seeded rather than random.** The map definition is generated
server-side and sent to the client on join; a seed keeps layouts reproducible
and debuggable while allowing future daily-rotation maps.

## D13. Testing strategy: protocol-level + headless-browser, all in-repo scratchpad

**Decision.** Three layers, all runnable in the dev container:
1. **Protocol tests** (Node + `ws` against a spawned local server): join
   flow, movement, kills, clones, session tally.
2. **Browser tests** (Playwright + system Chromium on SwiftShader software
   GL): prediction/reconciliation quality under `?fakelag=N` (injected
   symmetric latency), judder probes, screenshot showcases.
3. **Live smoke test** (`livews.js`): raw CONNECT-tunnel WebSocket against
   production — asserts join, ~30 snapshots/s, events flowing.

**Quality bars established:** responsiveness = rendered movement leads the
delayed server echo at 300ms RTT; zero rubber-band reversals; convergence
< ~0.6u; judder probe zero-deltas = 0.

## D14. Repository: `main` is the public branch

**Context.** All work happened on `claude/smash-karts-research-70lwov`
(the session's designated branch); the repo had no `main`.

**Decision.** `main` created from the same history (user request). The
GitHub default-branch switch must be done in repo Settings by hand — the
session's GitHub proxy forbids repository-settings writes.

---

## Standing constraints (apply to all future work)

- **Determinism**: `physics.js` must stay dependency-free and identical in
  behavior on server and client. No `Math.random()` in the movement path.
- **Two shells**: any protocol change lands in `server/index.js` **and**
  `src/worker.js`.
- **No bundler**: new client deps go through `scripts/copy-vendor.mjs` and
  the import map in `index.html`.
- **Free-plan friendly**: DOs must remain SQLite-classes; rooms must stop
  ticking when empty.
- **Assets must be CC0/self-hosted** (Kenney, Poly Haven) — the game is
  destined for ad-supported portals; no license risk.
