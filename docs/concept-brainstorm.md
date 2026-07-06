# Core concept brainstorm — challenging "players on skates"

*July 2026. Premise: NinjaSkates started as "Smash Karts but skating."
This doc challenges that premise and explores concepts with a stronger
viral hook, ranked by originality × meme-ability × how much of our
existing engine survives.*

## The uncomfortable question

What does *skating* uniquely enable that karts don't? **Momentum tricks,
rails to grind, and body language.** If we don't use those, a skater is
just a slower, less readable kart — we'd be competing with Smash Karts at
their own game with fewer features. So: either **lean all the way into
skating**, or **pivot the fantasy** while keeping the engine (top-down
arena, drift physics, knockback, crates, rooms — all concept-agnostic).

## The ideas

### A. "Grind or Die" — lean into skating (trick-combat hybrid)
- **Loop:** deathmatch as today, but the map is full of **grind rails,
  halfpipes and jump pads**. Grinding/jumping charges a **style meter**;
  tricks mid-air multiply your next shot's damage or drop a shockwave on
  landing. Kills while airborne/grinding score double and bank more XP.
- **Why viral:** Tony-Hawk-style trick-shot kills are natural clip
  material (TikTok/Shorts). Nobody in the .io space does skill-expression
  movement + combat.
- **Engine reuse:** ~90%. Rails = spline paths (server: constrained
  movement lanes granting speed/invuln frames), tricks = client animation
  + a server flag.
- **Risk:** higher skill floor than Smash Karts; balance so W+space still works.

### B. "Hot Wheels of Death" — meme-vehicle pivot: office chairs
- **Loop:** identical arena deathmatch, but everyone is an office worker
  in a **rolling office chair** in an open-plan-office/rooftop/parking-lot
  world. Weapons: staplers (minigun), coffee mugs (lobber), printer-paper
  shurikens, "REPLY ALL" nuke. Boost = chair-scoot animation.
- **Why viral:** office-chair racing is an established meme; the fantasy
  is universally understood and screenshots are funny with zero context.
  Corporate satire names itself ("Q3 Deathmatch", "Performance Review").
- **Engine reuse:** ~95% — it is literally a reskin of our physics
  (chairs drift/spin beautifully with our lateral-slip model).
- **Risk:** less cute/kid-appeal than karts; comedy carries it instead.

### C. "Capybara Combat League" — ride-on animal pivot
- **Loop:** ninjas ride **capybaras** (or pugs, ostriches, geese) instead
  of skating. Same combat; mounts have personality idles (capybara
  serenity vs chaos around it).
- **Why viral:** capybara internet energy is enormous and evergreen;
  animals-in-games out-share vehicles. Mount variety = natural gacha.
- **Engine reuse:** ~85% (new mount models/animations; rider already built).
- **Risk:** art-heavy; personality is the product, needs to be *charming*.

### D. "Shadow Clone Rumble" — lean into *ninja* instead of skates
- **Loop:** every kill spawns a **shadow clone** of you that fights
  alongside (weak AI copy — our bots repurposed). Die and your clones
  vanish. Kill the leader, inherit one of their clones. Smoke bombs leave
  **decoy clones**.
- **Why viral:** snowballing power fantasy ("I ended with 9 clones") +
  built-in comeback drama targeting the leader. Naruto-adjacent fantasy
  with zero license risk.
- **Engine reuse:** ~90% — clones are literally our bot system with a
  paint job and follow-owner logic.
- **Risk:** snowball balance; clone cap and fragility need tuning.

### E. "Smoke Island" — stealth-pulse deathmatch
- **Loop:** every ~45s a **smoke wave** rolls over the island: everyone
  turns invisible except skid trails, footsteps, and muzzle flashes.
  Radar pings the nearest enemy. Smoke clears → chaos resumes.
- **Why viral:** tension/release rhythm no other .io arena has; jump-scare
  kills and betrayals make great clips; deepens the *ninja* identity.
- **Engine reuse:** ~95% — a server timer + client fog/visibility pass.
- **Risk:** invisible players frustrate low-skill players; keep waves short.

### F. "Hot Potato Bomb" — social physics mode
- **Loop:** one bomb, fuse resets each transfer, **ramming passes it**.
  Explodes → holder dies spectacularly. Most survives/points wins. Could
  be a mode inside any concept above.
- **Why viral:** universally funny, zero explanation needed, screaming-
  with-friends energy. Our bump physics already does the hard part.
- **Engine reuse:** ~98%.

### G. "Sumo Skates" — no weapons at all
- **Loop:** knockback-only combat on a **shrinking island** (tide rises);
  push players into the water. Last skater standing.
- **Why viral:** instantly understood; rage-and-laughter deaths; the
  shrinking arena forces confrontation. (Fall Guys × agar.io energy.)
- **Engine reuse:** ~95% — knockback, circle boundary, water all exist.

## Evaluation

| Concept | Originality | Meme-ability | Engine reuse | Kid-appeal | Clip-ability |
|---|---|---|---|---|---|
| A. Grind or Die | ★★★★ | ★★★ | 90% | ★★★ | ★★★★★ |
| B. Office chairs | ★★★★ | ★★★★★ | 95% | ★★ | ★★★★ |
| C. Capybara League | ★★★ | ★★★★★ | 85% | ★★★★★ | ★★★★ |
| D. Shadow Clones | ★★★★★ | ★★★ | 90% | ★★★★ | ★★★★ |
| E. Smoke Island | ★★★★ | ★★ | 95% | ★★★ | ★★★★ |
| F. Hot Potato | ★★★ | ★★★★ | 98% | ★★★★ | ★★★ |
| G. Sumo Skates | ★★ | ★★★ | 95% | ★★★★ | ★★★ |

## Recommendation

**Identity = D + A on our current base: "ninja" is the brand, skating is
the movement.** Concretely:

1. Ship **Shadow Clone Rumble** as the signature mechanic — no other .io
   arena game has it, it reuses our bots, and it names the game: *ninjas*.
2. Add **rails/jump pads + a simple trick-boost** (the defensible part of
   A) so skating finally earns its place in the title.
3. Keep **Hot Potato** and **Sumo** as rotating party modes (F, G are
   each ~a day of work).
4. Hold B/C as *reskin experiments*: the engine is now clean enough that
   an office-chair or capybara build is mostly art — worth A/B testing as
   separate portals/domains later, the way .io studios multiply hits.

Viral mechanics are necessary but not sufficient — distribution decides:
portal submissions (Poki/CrazyGames), a 30-second gameplay clip cut for
Shorts/TikTok, and instant PLAY (no form) are part of the concept.
