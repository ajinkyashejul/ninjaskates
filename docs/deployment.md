# Deployment (Cloudflare Workers + Durable Objects)

Live at **https://ninjaskates.ajinkyashejul.workers.dev**.

## Why Cloudflare

See decision D3: stateful WebSockets don't fit Vercel/Netlify; always-on
Node hosts cost from ~$5/mo and run in one region. Durable Objects give us
one single-threaded object per room (exactly our authority model), players
connect to the nearest edge, idle rooms hibernate for free, and
SQLite-backed DO classes run on the **free plan**.

## Deploy

```bash
npm install
export CLOUDFLARE_API_TOKEN=...   # or: npx wrangler login
npm run cf:deploy                  # = npx wrangler deploy
```

`wrangler.toml`: worker `ninjaskates`, entry `src/worker.js`, static assets
from `public/` (only `/api/*` and `/ws/*` invoke the worker), DO bindings
`ROOMS` → `RoomDO` and `LOBBY` → `LobbyDO`, migration `v1` declares both as
`new_sqlite_classes` (free-plan requirement). Observability enabled.

**API token scopes needed:** Workers Scripts:Edit, Workers Durable
Objects:Edit (account-level). Rotate/revoke tokens after use — they are
plaintext credentials.

## Runtime shape

- `RoomDO` — one per room, addressed by room code. Holds config in DO
  storage, runs the 30Hz tick **only while occupied**, stops the loop when
  the last socket closes (hibernation), and an alarm deletes the config
  after 1h empty. `POST /init` returns 409 if the room already exists
  (vanity-code collision handling).
- `LobbyDO` — singleton quick-play directory. Rooms report occupancy;
  `/acquire` returns a joinable public room or creates one.
- Client is static — served from the edge cache, no worker invocation.

## First-deploy gotchas (hit once, documented so never again)

- A fresh account has **no workers.dev subdomain** — first deploy 404s until
  you create one: `PUT /accounts/{account_id}/workers/subdomain
  {"subdomain": "..."}` (or via dashboard).
- The new subdomain's **TLS cert takes ~1 minute** to provision (SSL errors
  right after creation are transient).
- Asset 404s in the first seconds after a deploy are propagation lag, not a
  broken deploy.

## Verifying a deploy

Protocol-level smoke test from any Node env (see dev-testing.md for the
proxy-tunnel variant used in the dev container):

1. `POST /api/create` → room code.
2. Open `wss://.../ws/CODE?name=X`, expect `joined` with the map def.
3. Count snapshots for ~30s → expect ~30/s.
4. Send inputs, expect movement + `pickup`/`kill` events; `ping` → `pong`.

## Cost model

Free plan: 100k worker requests/day, DO compute billed only while rooms are
awake (they sleep when empty), SQLite storage free tier. A daily office
group costs ~nothing. Beyond free tier: Workers Paid $5/mo covers ~10M
requests + DO duration at micro-rates — scales linearly with concurrent
rooms, not with registered users.
