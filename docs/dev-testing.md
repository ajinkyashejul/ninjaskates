# Development, testing & environment gotchas

*How to run, test, and not get bitten by the things that bit us.*

## Run locally

```bash
npm install          # postinstall copies vendor files into public/vendor/
npm start            # Node shell on http://localhost:3000
npm run dev          # same, with --watch
npm run cf:dev       # wrangler dev (workerd emulation) on :8787
```

There is no build step. Client code is served as-is; `three` and
`postprocessing` resolve through the import map in `index.html` to files
copied by `scripts/copy-vendor.mjs`.

## Test approach (no formal test framework — purposeful)

Tests are throwaway-but-rerunnable Node scripts, historically kept in the
session scratchpad. The three layers:

1. **Protocol tests** — spawn `node server/index.js`, connect with `ws`,
   assert the JSON protocol: join/dedupe, movement deltas, kills/respawns,
   clone spawn/caps/credit/death-with-owner, session tally on matchEnd.
   Trick used: monkey-patch `broadcastSnapshot` to capture events before the
   tick loop clears them.
2. **Browser tests** — Playwright + the container's Chromium
   (`/opt/pw-browsers/.../chrome`) on SwiftShader software GL. Used for:
   prediction quality under `?fakelag=300` (assert rendered self-motion
   leads the delayed server echo; zero rubber-band reversals; convergence
   <1u), judder probes (consecutive-frame position deltas — zero-delta
   frames mean stutter), and screenshot showcases for visual review.
3. **Live smoke test** — raw WebSocket to production over a manual CONNECT
   tunnel (see proxy notes below). Asserts join, map, ~30 snapshots/s,
   pickup/kill events, pong.

**Quality bars we hold:** at 300ms RTT the local skater must respond
immediately (prediction), never visibly reverse (reconciliation), converge
to server position, and move with zero judder frames at 60fps.

## Environment gotchas (each cost real debugging time)

### Shell / process
- **`pkill -f 'node server/index.js'` kills your own shell** (the pattern
  matches the pkill command line; exit code 144). Use a bracket:
  `pkill -f 'node serve[r]/index.js'`.

### Headless Chromium in this container
- Software GL: launch with `--use-angle=swiftshader --enable-unsafe-swiftshader`.
- **External HTTPS dies with ERR_CONNECTION_RESET** through the agent proxy
  unless you add `--ssl-version-max=tls1.2` (the proxy MITM chokes on the
  modern TLS ClientHello).
- **SwiftShader rendering blocks the main thread** hard enough to starve
  `setInterval` timers at large viewports — a correct prediction setup can
  look "diverged" in a test purely from timer starvation. Keep test
  viewports tiny (e.g. 320×240) when measuring netcode, and give
  asset-heavy pages generous timeouts (20s+).
- `?fakelag=N` on any client URL injects N ms artificial RTT.
- Debug hooks: `window.__dbg` (prediction stats), `__renderer`, `__freezeCam`.

### Node → external WSS (through the agent proxy)
The `ws` package can't use the proxy directly. Open a manual HTTP CONNECT to
the proxy, wrap the socket in `tls.connect` with the proxy CA bundle
(`/root/.ccr/ca-bundle.crt`), and hand it to `new WebSocket(url,
{createConnection: () => sock, ca})`.

### three.js / vendoring
- Adding a loader from `three/examples`? Check its imports — GLTFLoader
  (r185) needs `BufferGeometryUtils.js` **and** `SkeletonUtils.js`;
  RGBELoader needs `HDRLoader.js`; `three.module.js` imports
  `./three.core.js`. A missing file 404s and **silently kills the whole
  client module graph** — the symptom is dead menu buttons, not a rendering
  error. Add every file to `scripts/copy-vendor.mjs`.
- Kenney GLBs reference an **external** `Textures/colormap.png` — it must
  exist relative to the model URLs (`public/assets/models/Textures/`).
- r185 removed `PCFSoftShadowMap` — use `PCFShadowMap`.
- `postprocessing` requires three ≥ 0.168 (why we're on 0.185).

### Netcode invariants (violating these reintroduces fixed bugs)
- Ack inputs **when a tick applies them**, never in the message handler.
- The prediction pump stays on `setInterval`, never rAF.
- Own-player rendering uses velocity extrapolation between sim steps —
  removing it brings back the "everything vibrates" judder.
- `physics.js` stays deterministic and identical for server + client.

## Git / repo

- Development branch: `claude/smash-karts-research-70lwov` (also currently
  the GitHub default); `main` mirrors it (see decision D14).
- The remote session environment cannot change GitHub repo settings
  (proxy returns 403 for settings writes) — default-branch changes are
  manual, in repo Settings.
