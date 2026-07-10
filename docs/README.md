# NinjaSkates docs

Start here in a new session. Reading order for full context:

| Doc | What it gives you |
|---|---|
| [decisions.md](decisions.md) | **Read first.** Every significant decision (stack, hosting, netcode, art, game identity, maps) with the context and reasoning behind it, plus standing constraints for future work. |
| [architecture.md](architecture.md) | How it's built: sim/shell split, protocol, prediction & reconciliation, Cloudflare Durable Objects shape, rendering pipeline, file map. |
| [gameplay.md](gameplay.md) | Game design + every tuning constant: movement/drift, weapons/loot, shadow clones, maps, rooms, HUD. |
| [dev-testing.md](dev-testing.md) | Running locally, the three test layers and quality bars, and the environment gotchas that cost real debugging time. |
| [deployment.md](deployment.md) | Cloudflare deploy, DO runtime shape, first-deploy gotchas, cost model. |
| [backlog.md](backlog.md) | Agreed roadmap by tier, tuning watchlist, explicitly parked ideas. |
| [smash-karts-field-notes.md](smash-karts-field-notes.md) | Research: how Smash Karts works (tech + UX inventory) and the gap analysis. |
| [concept-brainstorm.md](concept-brainstorm.md) | The 7 concept candidates and why "ninja is the brand, skating is the movement" won. |

**Product context in one paragraph:** browser multiplayer arena deathmatch —
ninjas on inline skates grab weapons from crates and smash each other; every
kill raises a shadow clone that fights for you. Server-authoritative 30Hz
sim on Cloudflare Durable Objects (one room = one DO), client-side
prediction, Three.js + postprocessing client, no build step. The daily beta
group is the user's office (3 games after standup, standing room code) —
prioritize competitive feel and match pacing for ~6 players over
strangers-matchmaking features. Live:
https://ninjaskates.ajinkyashejul.workers.dev
