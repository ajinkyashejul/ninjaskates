// Server-authoritative game room. Simulates all physics and combat at 30Hz
// and broadcasts 15Hz snapshots; clients only send inputs and interpolate.

import { MAPS } from './maps.js';
import { WEAPONS, POWERS, rollLoot } from './weapons.js';
import { updateBot, pickBotName } from './bots.js';

export const TICK_RATE = 30;
const DT = 1 / TICK_RATE;
const SNAPSHOT_EVERY = 2; // ticks -> 15Hz snapshots

export const MAX_PLAYERS = 8;
const PLAYER_RADIUS = 0.7;
const ACCEL = 30;
const BRAKE = 40;
const MAX_SPEED = 14;
const BOOST_MAX_SPEED = 19;
const REVERSE_MAX = 6;
const FRICTION = 10;
const TURN_RATE = 3.0;

const MAX_HP = 100;
const RESPAWN_DELAY = 3;
const SPAWN_PROTECT = 2.5;
const CRATE_RESPAWN = 8;
const CRATE_PICKUP_DIST = 1.7;
const RESULTS_DURATION = 12;

let nextEntityId = 1;

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export class Room {
  constructor(code, { mapId, duration, isPublic, botCount }) {
    this.code = code;
    this.map = MAPS[mapId] || MAPS.skatepark;
    this.duration = duration === 360 ? 360 : 180; // 3 or 6 minutes
    this.isPublic = !!isPublic;
    this.desiredBots = Math.max(0, Math.min(6, botCount | 0));

    this.players = new Map(); // id -> player (humans and bots)
    this.sockets = new Map(); // id -> ws (humans only)
    this.projectiles = [];
    this.mines = [];
    this.crates = this.map.crates.map((c, i) => ({
      i, x: c.x, z: c.z, active: true, respawnAt: 0,
    }));
    this.events = [];

    this.time = 0; // simulation clock, seconds
    this.tick = 0;
    this.state = 'playing';
    this.matchEndsAt = this.duration;
    this.resultsEndsAt = 0;
    this.emptyAt = Date.now();

    this.timer = setInterval(() => this.step(), 1000 / TICK_RATE);
  }

  destroy() {
    clearInterval(this.timer);
  }

  humanCount() {
    let n = 0;
    for (const p of this.players.values()) if (!p.bot) n++;
    return n;
  }

  // ---------------------------------------------------------------- players

  spawnPoint() {
    // Prefer the spawn farthest from all living players.
    let best = this.map.spawns[0];
    let bestScore = -1;
    for (const s of this.map.spawns) {
      let nearest = Infinity;
      for (const p of this.players.values()) {
        if (!p.alive) continue;
        const d = (p.x - s.x) ** 2 + (p.z - s.z) ** 2;
        if (d < nearest) nearest = d;
      }
      if (nearest > bestScore) { bestScore = nearest; best = s; }
    }
    return best;
  }

  makePlayer(name, bot) {
    const s = this.spawnPoint();
    return {
      id: String(nextEntityId++),
      name,
      bot,
      x: s.x, z: s.z, angle: s.angle,
      speed: 0,
      hp: MAX_HP,
      alive: true,
      respawnAt: 0,
      shieldUntil: this.time + SPAWN_PROTECT,
      boostUntil: 0,
      weapon: null, // { type, ammo }
      kills: 0, deaths: 0,
      input: { u: false, d: false, l: false, r: false, f: false },
      lastFireAt: -10,
      lastHitBy: null,
      // bot brain state
      think: 0, targetX: 0, targetZ: 0, targetPlayer: null,
      stuckTime: 0, reverseUntil: 0,
    };
  }

  addHuman(ws, name) {
    if (this.players.size >= MAX_PLAYERS) {
      // Kick a bot to make room for a human.
      const bot = [...this.players.values()].find((p) => p.bot);
      if (!bot) return null;
      this.players.delete(bot.id);
      this.events.push({ e: 'leave', n: bot.name });
    }
    const p = this.makePlayer(name, false);
    this.players.set(p.id, p);
    this.sockets.set(p.id, ws);
    this.events.push({ e: 'join', n: p.name });
    return p;
  }

  removePlayer(id) {
    const p = this.players.get(id);
    if (!p) return;
    this.players.delete(id);
    this.sockets.delete(id);
    this.events.push({ e: 'leave', n: p.name });
    if (this.humanCount() === 0) this.emptyAt = Date.now();
  }

  ensureBots() {
    const bots = [...this.players.values()].filter((p) => p.bot);
    const room = MAX_PLAYERS - this.players.size;
    const want = Math.min(this.desiredBots, bots.length + room);
    for (let i = bots.length; i < want; i++) {
      const b = this.makePlayer(pickBotName(this), true);
      this.players.set(b.id, b);
    }
  }

  setInput(id, msg) {
    const p = this.players.get(id);
    if (!p) return;
    p.input.u = !!msg.u;
    p.input.d = !!msg.d;
    p.input.l = !!msg.l;
    p.input.r = !!msg.r;
    p.input.f = !!msg.f;
  }

  // ------------------------------------------------------------- main loop

  step() {
    this.time += DT;
    this.tick++;

    if (this.state === 'playing') {
      this.ensureBots();
      for (const p of this.players.values()) {
        if (p.bot && p.alive) updateBot(this, p, DT);
        this.updatePlayer(p, DT);
      }
      this.resolvePlayerCollisions();
      for (const p of this.players.values()) this.handleFire(p);
      this.updateProjectiles(DT);
      this.updateMines();
      this.updateCrates();

      if (this.time >= this.matchEndsAt) this.endMatch();
    } else if (this.state === 'results' && this.time >= this.resultsEndsAt) {
      this.startMatch();
    }

    if (this.tick % SNAPSHOT_EVERY === 0) this.broadcastSnapshot();
  }

  endMatch() {
    this.state = 'results';
    this.resultsEndsAt = this.time + RESULTS_DURATION;
    this.projectiles = [];
    this.mines = [];
    const standings = [...this.players.values()]
      .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths)
      .map((p) => ({ n: p.name, k: p.kills, d: p.deaths, bot: p.bot }));
    this.events.push({ e: 'matchEnd', standings });
  }

  startMatch() {
    this.state = 'playing';
    this.matchEndsAt = this.time + this.duration;
    for (const c of this.crates) { c.active = true; c.respawnAt = 0; }
    for (const p of this.players.values()) {
      p.kills = 0; p.deaths = 0;
      this.respawn(p);
    }
    this.events.push({ e: 'matchStart' });
  }

  respawn(p) {
    const s = this.spawnPoint();
    p.x = s.x; p.z = s.z; p.angle = s.angle;
    p.speed = 0;
    p.hp = MAX_HP;
    p.alive = true;
    p.weapon = null;
    p.boostUntil = 0;
    p.shieldUntil = this.time + SPAWN_PROTECT;
    p.lastHitBy = null;
  }

  // -------------------------------------------------------------- movement

  updatePlayer(p, dt) {
    if (!p.alive) {
      if (this.time >= p.respawnAt) this.respawn(p);
      return;
    }

    const inp = p.input;
    const maxSpeed = this.time < p.boostUntil ? BOOST_MAX_SPEED : MAX_SPEED;

    if (inp.u && !inp.d) {
      p.speed += (p.speed < 0 ? BRAKE : ACCEL) * dt;
    } else if (inp.d && !inp.u) {
      p.speed -= (p.speed > 0 ? BRAKE : ACCEL) * dt;
    } else {
      // coast toward zero
      const f = FRICTION * dt;
      if (p.speed > f) p.speed -= f;
      else if (p.speed < -f) p.speed += f;
      else p.speed = 0;
    }
    p.speed = Math.max(-REVERSE_MAX, Math.min(maxSpeed, p.speed));

    // Steering scales with speed a bit, and flips when reversing.
    if (inp.l !== inp.r && Math.abs(p.speed) > 0.2) {
      const grip = Math.min(1, 0.35 + Math.abs(p.speed) / 8);
      const dir = (inp.l ? -1 : 1) * (p.speed < 0 ? -1 : 1);
      p.angle = wrapAngle(p.angle + dir * TURN_RATE * grip * dt);
    }

    p.x += Math.cos(p.angle) * p.speed * dt;
    p.z += Math.sin(p.angle) * p.speed * dt;

    this.collideWithWorld(p, PLAYER_RADIUS, true);
  }

  // Push a circular entity out of walls and obstacles. Returns true on hit.
  collideWithWorld(e, radius, dampen) {
    let hit = false;
    const hw = this.map.width / 2 - radius;
    const hd = this.map.depth / 2 - radius;
    if (e.x < -hw) { e.x = -hw; hit = true; }
    if (e.x > hw) { e.x = hw; hit = true; }
    if (e.z < -hd) { e.z = -hd; hit = true; }
    if (e.z > hd) { e.z = hd; hit = true; }

    for (const o of this.map.obstacles) {
      const cx = Math.max(o.x - o.w / 2, Math.min(e.x, o.x + o.w / 2));
      const cz = Math.max(o.z - o.d / 2, Math.min(e.z, o.z + o.d / 2));
      let dx = e.x - cx;
      let dz = e.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= radius * radius) continue;
      hit = true;
      if (d2 > 1e-9) {
        const d = Math.sqrt(d2);
        e.x = cx + (dx / d) * radius;
        e.z = cz + (dz / d) * radius;
      } else {
        // center inside the box: push out along the shallowest axis
        const px = o.w / 2 + radius - Math.abs(e.x - o.x);
        const pz = o.d / 2 + radius - Math.abs(e.z - o.z);
        if (px < pz) e.x += e.x >= o.x ? px : -px;
        else e.z += e.z >= o.z ? pz : -pz;
      }
    }
    if (hit && dampen) e.speed *= 0.6;
    return hit;
  }

  resolvePlayerCollisions() {
    const list = [...this.players.values()].filter((p) => p.alive);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]; const b = list[j];
        let dx = b.x - a.x;
        let dz = b.z - a.z;
        const d2 = dx * dx + dz * dz;
        const min = PLAYER_RADIUS * 2;
        if (d2 >= min * min || d2 < 1e-9) continue;
        const d = Math.sqrt(d2);
        const push = (min - d) / 2;
        dx /= d; dz /= d;
        a.x -= dx * push; a.z -= dz * push;
        b.x += dx * push; b.z += dz * push;
        a.speed *= 0.92; b.speed *= 0.92;
      }
    }
  }

  // ---------------------------------------------------------------- combat

  handleFire(p) {
    if (!p.alive || !p.input.f || !p.weapon) return;
    const spec = WEAPONS[p.weapon.type];
    if (!spec || this.time - p.lastFireAt < spec.fireInterval) return;
    p.lastFireAt = this.time;
    p.weapon.ammo--;

    if (spec.mine) {
      const behind = 1.4;
      const m = {
        id: String(nextEntityId++),
        x: p.x - Math.cos(p.angle) * behind,
        z: p.z - Math.sin(p.angle) * behind,
        owner: p.id,
        armedAt: this.time + spec.mine.armTime,
        dieAt: this.time + spec.mine.life,
        spec: spec.mine,
      };
      this.collideWithWorld(m, 0.4, false);
      this.mines.push(m);
      this.events.push({ e: 'fire', x: m.x, z: m.z, w: 'mine' });
    } else {
      const angle = p.angle + (spec.spread ? (Math.random() - 0.5) * 2 * spec.spread : 0);
      const off = PLAYER_RADIUS + spec.projectile.radius + 0.15;
      this.projectiles.push({
        id: String(nextEntityId++),
        type: p.weapon.type,
        x: p.x + Math.cos(angle) * off,
        z: p.z + Math.sin(angle) * off,
        dx: Math.cos(angle),
        dz: Math.sin(angle),
        owner: p.id,
        dieAt: this.time + spec.projectile.life,
        bounces: spec.projectile.bounces,
        spec: spec.projectile,
      });
      this.events.push({ e: 'fire', x: p.x, z: p.z, w: p.weapon.type });
    }

    if (p.weapon.ammo <= 0) p.weapon = null;
  }

  updateProjectiles(dt) {
    const survivors = [];
    for (const pr of this.projectiles) {
      let dead = false;
      const steps = pr.spec.speed * dt > 1 ? 2 : 1;
      for (let s = 0; s < steps && !dead; s++) {
        const stepLen = (pr.spec.speed * dt) / steps;
        const px = pr.x; const pz = pr.z;
        pr.x += pr.dx * stepLen;
        pr.z += pr.dz * stepLen;

        if (this.projectileHitsWorld(pr)) {
          if (pr.bounces > 0) {
            pr.bounces--;
            // reflect on the axis we crossed
            pr.x = px; pr.z = pz;
            if (this.projectileHitsWorld({ ...pr, x: px + pr.dx * stepLen, z: pz })) pr.dx = -pr.dx;
            else pr.dz = -pr.dz;
            pr.x = px + pr.dx * stepLen;
            pr.z = pz + pr.dz * stepLen;
          } else {
            if (pr.spec.splash) this.explode(pr.x, pr.z, pr.spec.splash, pr.owner, pr.type);
            else this.events.push({ e: 'poof', x: pr.x, z: pr.z });
            dead = true;
            break;
          }
        }

        for (const t of this.players.values()) {
          if (!t.alive || t.id === pr.owner) continue;
          const dx = t.x - pr.x;
          const dz = t.z - pr.z;
          const r = PLAYER_RADIUS + pr.spec.radius;
          if (dx * dx + dz * dz < r * r) {
            this.damage(t, pr.spec.damage, pr.owner, pr.type);
            if (pr.spec.splash) this.explode(pr.x, pr.z, pr.spec.splash, pr.owner, pr.type, t.id);
            dead = true;
            break;
          }
        }
      }
      if (!dead && this.time < pr.dieAt) survivors.push(pr);
    }
    this.projectiles = survivors;
  }

  projectileHitsWorld(pr) {
    const hw = this.map.width / 2;
    const hd = this.map.depth / 2;
    if (pr.x < -hw || pr.x > hw || pr.z < -hd || pr.z > hd) return true;
    for (const o of this.map.obstacles) {
      if (
        pr.x > o.x - o.w / 2 - pr.spec.radius && pr.x < o.x + o.w / 2 + pr.spec.radius &&
        pr.z > o.z - o.d / 2 - pr.spec.radius && pr.z < o.z + o.d / 2 + pr.spec.radius
      ) return true;
    }
    return false;
  }

  updateMines() {
    const survivors = [];
    for (const m of this.mines) {
      if (this.time >= m.dieAt) continue;
      let boom = false;
      if (this.time >= m.armedAt) {
        for (const t of this.players.values()) {
          if (!t.alive || t.id === m.owner) continue;
          const dx = t.x - m.x;
          const dz = t.z - m.z;
          const r = m.spec.triggerRadius + PLAYER_RADIUS;
          if (dx * dx + dz * dz < r * r) {
            this.damage(t, m.spec.damage, m.owner, 'mine');
            this.explode(m.x, m.z, m.spec.splash, m.owner, 'mine', t.id);
            boom = true;
            break;
          }
        }
      }
      if (!boom) survivors.push(m);
    }
    this.mines = survivors;
  }

  explode(x, z, splash, ownerId, weaponType, alreadyHitId = null) {
    this.events.push({ e: 'boom', x, z, big: true });
    for (const t of this.players.values()) {
      if (!t.alive || t.id === ownerId || t.id === alreadyHitId) continue;
      const dx = t.x - x;
      const dz = t.z - z;
      if (dx * dx + dz * dz < splash.radius * splash.radius) {
        this.damage(t, splash.damage, ownerId, weaponType);
      }
    }
  }

  damage(victim, amount, attackerId, weaponType) {
    if (!victim.alive) return;
    if (this.time < victim.shieldUntil) {
      this.events.push({ e: 'shield', id: victim.id });
      return;
    }
    victim.hp -= amount;
    victim.lastHitBy = attackerId;
    this.events.push({ e: 'hit', id: victim.id });
    if (victim.hp <= 0) {
      victim.hp = 0;
      victim.alive = false;
      victim.deaths++;
      victim.respawnAt = this.time + RESPAWN_DELAY;
      victim.weapon = null;
      const killer = attackerId != null ? this.players.get(attackerId) : null;
      if (killer && killer.id !== victim.id) killer.kills++;
      this.events.push({
        e: 'kill',
        kn: killer ? killer.name : '???',
        vn: victim.name,
        w: weaponType,
        x: victim.x,
        z: victim.z,
      });
    }
  }

  // --------------------------------------------------------------- pickups

  updateCrates() {
    for (const c of this.crates) {
      if (!c.active) {
        if (this.time >= c.respawnAt) c.active = true;
        continue;
      }
      for (const p of this.players.values()) {
        if (!p.alive) continue;
        const dx = p.x - c.x;
        const dz = p.z - c.z;
        if (dx * dx + dz * dz > CRATE_PICKUP_DIST * CRATE_PICKUP_DIST) continue;
        c.active = false;
        c.respawnAt = this.time + CRATE_RESPAWN;
        this.applyLoot(p, rollLoot());
        break;
      }
    }
  }

  applyLoot(p, lootId) {
    let label;
    if (WEAPONS[lootId]) {
      p.weapon = { type: lootId, ammo: WEAPONS[lootId].ammo };
      label = WEAPONS[lootId].label;
    } else if (lootId === 'shield') {
      p.shieldUntil = this.time + POWERS.shield.duration;
      label = POWERS.shield.label;
    } else if (lootId === 'boost') {
      p.boostUntil = this.time + POWERS.boost.duration;
      label = POWERS.boost.label;
    } else {
      p.hp = Math.min(MAX_HP, p.hp + POWERS.health.heal);
      label = POWERS.health.label;
    }
    this.events.push({ e: 'pickup', id: p.id, what: lootId, label });
  }

  // ------------------------------------------------------------ networking

  snapshot() {
    const r2 = (v) => Math.round(v * 100) / 100;
    return {
      t: 'snap',
      st: this.state,
      tl: r2(Math.max(0, (this.state === 'playing' ? this.matchEndsAt : this.resultsEndsAt) - this.time)),
      p: [...this.players.values()].map((p) => ({
        id: p.id,
        n: p.name,
        x: r2(p.x), z: r2(p.z), a: r2(p.angle),
        hp: Math.round(p.hp),
        al: p.alive ? 1 : 0,
        sh: this.time < p.shieldUntil ? 1 : 0,
        bo: this.time < p.boostUntil ? 1 : 0,
        w: p.weapon ? p.weapon.type : '',
        am: p.weapon ? p.weapon.ammo : 0,
        k: p.kills, d: p.deaths,
        rs: p.alive ? 0 : r2(Math.max(0, p.respawnAt - this.time)),
        bot: p.bot ? 1 : 0,
      })),
      pr: this.projectiles.map((pr) => ({
        id: pr.id, ty: pr.type, x: r2(pr.x), z: r2(pr.z),
        a: r2(Math.atan2(pr.dz, pr.dx)),
      })),
      mn: this.mines.map((m) => ({
        id: m.id, x: r2(m.x), z: r2(m.z), ar: this.time >= m.armedAt ? 1 : 0,
      })),
      cr: this.crates.map((c) => (c.active ? 1 : 0)),
      ev: this.events,
    };
  }

  broadcastSnapshot() {
    const msg = JSON.stringify(this.snapshot());
    this.events = [];
    for (const ws of this.sockets.values()) {
      if (ws.readyState === 1) ws.send(msg);
    }
  }
}
