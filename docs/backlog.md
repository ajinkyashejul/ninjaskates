# Backlog & roadmap

*Agreed direction as of July 2026, ordered by expected impact on the daily
office group (our beta cohort — see decision D9). Sources: Smash Karts field
notes (gap analysis), concept brainstorm, and direct user asks.*

## Tier 1 — feel & readability (client-heavy, cheap, do first)

1. **Held/mounted weapons** — the weapon you carry should be visible on the
   skater with an aim pose. Biggest single readability gap vs Smash Karts
   (everyone reads who is armed at a glance).
2. **Overhead health pips** on enemies (we have name + bar; make damage
   state readable at distance).
3. **Confetti kill bursts + richer spawn ring** — spectacle per kill.
4. **Music track** — SFX are in; there is no music. One CC0 loop + mute
   button.
5. **Jump pads / boost pads / teleporters** — flat-map-friendly stand-ins
   for Smash Karts' terrain verticality; also helps traverse the new big
   maps.

## Tier 2 — depth

6. **New weapons**: homing missile, lobber (arc grenade), freeze; rare nuke.
7. **12-player rooms** (currently 8) — needs snapshot size check; consider
   delta compression or binary packing if JSON gets fat.
8. **Instant PLAY** — auto-guest name, zero-form entry (portal distribution
   requirement).
9. **Rails/grind + trick-boost** ("Grind or Die" concept A) — the skating
   payoff; rails as constrained movement lanes granting speed/invuln frames.

## Tier 3 — modes & meta

10. **Party modes**: Hot Potato (bomb passes on ram), Sumo (knockback-only,
    shrinking island), Gem Collector / Hat Holder (near-verbatim fits).
11. **Persistence**: XP → levels → cosmetics, keyed by a browser token in a
    Durable Object (no accounts for v1).
12. **Daily-rotation seeded maps** (generator already takes a seed).
13. **Portal distribution**: Poki/CrazyGames submissions + a 30s clip.

## Tuning watchlist (revisit after office playtests)

- **Shadow clone balance** — caps (3/player, 12/room), clone HP 40, fire
  slowdown 2.5×. Watch for snowballing; the intended counter is that
  killing the leader wipes their clones.
- **Big-map pacing** — R=180 with 8 players may feel sparse; options:
  denser center crates, more players (Tier 2 #7), shrinking-play-area
  pulse, or minimap ping on the fight.
- **Drift boost** (+7.5) vs straight-line play — is drifting actually
  winning races across the map?

## Explicitly parked

- **Office-chair / capybara reskins** (concepts B/C) — engine is clean
  enough that these are mostly art; hold as separate-portal A/B experiments
  after the core game proves out.
- **Smoke Island stealth pulses** (concept E) — cool but risks frustrating
  the low-skill half of the office.
- **Accounts/login** — browser-token persistence first.
