// Simple bot AI: grab a crate when unarmed, chase and shoot the nearest
// enemy when armed, wander otherwise. Bots use the exact same input
// interface as human players, so the simulation treats them identically.

const NAMES = [
  'ShadowBlade', 'KunaiKid', 'SilentWheels', 'GrindMaster',
  'NightFlip', 'SmokeBomb', 'RailRonin', 'SwiftShinobi',
  'OllieOni', 'KickflipKage', 'HalfpipeHanzo', 'DeckDaimyo',
];

export function pickBotName(room) {
  const used = new Set([...room.players.values()].map((p) => p.name));
  const free = NAMES.filter((n) => !used.has(n));
  const base = free.length ? free[Math.floor(Math.random() * free.length)]
    : `Ninja${Math.floor(Math.random() * 900) + 100}`;
  return base;
}

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function nearestEnemy(room, bot) {
  let best = null;
  let bestD2 = Infinity;
  for (const p of room.players.values()) {
    if (p.id === bot.id || !p.alive) continue;
    if (room.time < p.shieldUntil) continue; // don't waste ammo on shields
    const d2 = (p.x - bot.x) ** 2 + (p.z - bot.z) ** 2;
    if (d2 < bestD2) { bestD2 = d2; best = p; }
  }
  return best;
}

function nearestCrate(room, bot) {
  let best = null;
  let bestD2 = Infinity;
  for (const c of room.crates) {
    if (!c.active) continue;
    const d2 = (c.x - bot.x) ** 2 + (c.z - bot.z) ** 2;
    if (d2 < bestD2) { bestD2 = d2; best = c; }
  }
  return best;
}

export function updateBot(room, bot, dt) {
  bot.think -= dt;
  if (bot.think <= 0) {
    bot.think = 0.25 + Math.random() * 0.25;

    bot.targetPlayer = null;
    if (bot.weapon) {
      const enemy = nearestEnemy(room, bot);
      if (enemy) {
        bot.targetPlayer = enemy;
        // aim slightly ahead of where they're going
        const lead = 0.25 * enemy.speed;
        bot.targetX = enemy.x + Math.cos(enemy.angle) * lead;
        bot.targetZ = enemy.z + Math.sin(enemy.angle) * lead;
      }
    }
    if (!bot.targetPlayer) {
      const crate = nearestCrate(room, bot);
      if (crate) {
        bot.targetX = crate.x;
        bot.targetZ = crate.z;
      } else {
        bot.targetX = (Math.random() - 0.5) * room.map.width * 0.7;
        bot.targetZ = (Math.random() - 0.5) * room.map.depth * 0.7;
      }
    }
  }

  // Unstick: if we've been pressed against a wall, back up for a moment.
  if (Math.abs(bot.speed) < 0.6) bot.stuckTime += dt;
  else bot.stuckTime = 0;
  if (bot.stuckTime > 0.9) {
    bot.reverseUntil = room.time + 0.7;
    bot.stuckTime = 0;
  }

  const inp = bot.input;
  const desired = Math.atan2(bot.targetZ - bot.z, bot.targetX - bot.x);
  const diff = wrapAngle(desired - bot.angle);

  if (room.time < bot.reverseUntil) {
    inp.u = false; inp.d = true;
    inp.l = diff > 0; inp.r = diff < 0; // steering flips in reverse
    inp.f = false;
    return;
  }

  inp.l = diff < -0.1;
  inp.r = diff > 0.1;
  inp.u = Math.abs(diff) < Math.PI * 0.6;
  inp.d = false;

  // Fire when armed, roughly aimed, and in range.
  inp.f = false;
  if (bot.weapon && bot.targetPlayer) {
    const d2 = (bot.targetPlayer.x - bot.x) ** 2 + (bot.targetPlayer.z - bot.z) ** 2;
    if (bot.weapon.type === 'mine') {
      inp.f = d2 < 8 * 8; // drop mines while being chased / in a scrum
    } else if (Math.abs(diff) < 0.22 && d2 < 22 * 22) {
      inp.f = true;
    }
  }
}
