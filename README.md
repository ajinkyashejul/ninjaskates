# NinjaSkates 🥷🛼

A browser-based multiplayer arena deathmatch. Ninjas on inline skates grab
weapons and power-ups from crates and smash each other for kills — and every
kill raises a **shadow clone** that fights alongside you. Inspired by the
architecture of Smash Karts, rebuilt web-native: no engine, no build step,
~instant load.

**Play it:** https://ninjaskates.ajinkyashejul.workers.dev

## Run locally

```bash
npm install
npm start          # Node server on http://localhost:3000
```

## Deploy to Cloudflare (Workers + Durable Objects)

Each room is a **Durable Object** — a single-threaded authority every
player's WebSocket routes to at the nearest edge. Idle rooms hibernate and
cost nothing; the free plan covers real usage.

```bash
npx wrangler login          # or export CLOUDFLARE_API_TOKEN=...
npm run cf:dev              # local workerd dev server on :8787
npm run cf:deploy           # deploy to <name>.workers.dev
```

The Node server (`server/index.js`) and the Worker (`src/worker.js`) are two
shells around the same simulation code and speak the same protocol.

## The game

- **Quick Play**, or **Create Room** with a map, 3/6-minute matches, bots,
  and an optional vanity code (e.g. `OFFICE`) you can reuse daily as a
  standing room — share `/?room=CODE` and friends join or auto-create it.
- Up to **8 players**; bots fill empty slots and get kicked as humans join.
- **Crates**: 🌀 ricocheting shurikens, 🚀 rockets, 🔫 minigun, 💣 mines,
  🛡 shield, ⚡ boost, ❤️ health.
- **Drift**: hold Shift through a turn, release for a speed boost.
- **Shadow clones**: every kill spawns a weak AI copy of you (max 3) that
  escorts you and fights; die and your army dies with you.
- Three big procedural maps: 🏝️ **Sunny Island**, 🌌 **Neon Rink**,
  🏙️ **Rooftop Rumble** — with a minimap to find the fights.
- Session win tally across back-to-back matches for bragging rights.

**Controls:** WASD/arrows skate · Space/click attack · Shift drift ·
touch devices get a stick + fire + drift buttons.

## Tech in one breath

Server-authoritative **30Hz** simulation with **client-side prediction and
reconciliation** (a shared deterministic physics module runs on both sides),
30Hz JSON snapshots over one WebSocket, Three.js r185 with pmndrs
postprocessing (SMAA/bloom/ACES) and HDRI lighting, Kenney CC0 props and
sounds, DOM HUD, seeded procedural maps, and two deployment shells (Node and
Cloudflare Durable Objects) around the same sim. No bundler — import maps +
vendored files.

## Documentation

Full context lives in [`docs/`](docs/README.md) — start with
[`docs/decisions.md`](docs/decisions.md) (every architectural and design
decision with its reasoning), then
[`docs/architecture.md`](docs/architecture.md),
[`docs/gameplay.md`](docs/gameplay.md),
[`docs/dev-testing.md`](docs/dev-testing.md),
[`docs/deployment.md`](docs/deployment.md), and
[`docs/backlog.md`](docs/backlog.md).
