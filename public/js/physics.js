// Shared movement simulation. This exact code runs in two places:
//  - on the server (authoritative), inside each room tick
//  - on the client (prediction), so your own skater responds frame-instantly
// It must stay deterministic and dependency-free: same inputs + same state
// in, same state out, or reconciliation will rubber-band.

export const DT = 1 / 30;
export const PLAYER_RADIUS = 0.7;

const ACCEL = 24;
const KICK_ACCEL = 38; // harder first pushes: skaters launch off the line
const BRAKE = 42;
const MAX_SPEED = 15;
const BOOST_MAX_SPEED = 19.5;
const REVERSE_MAX = 6;
const FRICTION = 10;
const TURN_RATE = 3.6;
const LATERAL_GRIP = 6.5; // sideways slide decay (lower = driftier)
const DRIFT_GRIP = 2.4; // grip while holding drift — big controlled slide
const DRIFT_TURN = 1.3; // extra steering authority while drifting
const RESTITUTION = 0.4; // wall bounce
const OVERSPEED_DECAY = 7; // how fast a drift boost bleeds back to cap

export const DRIFT_MIN_CHARGE = 0.6; // seconds of sliding to earn the boost
const DRIFT_BOOST = 6.5;

export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// Push a circular entity out of the arena boundary and obstacles; entities
// with velocity bounce with restitution. Mutates e{x,z[,vx,vz]}.
export function collideCircleWorld(e, radius, map, rest) {
  let hit = false;
  const hasVel = e.vx !== undefined;
  const r = hasVel ? rest : 0;

  if (map.shape === 'circle') {
    const R = map.radius - radius;
    const d = Math.hypot(e.x, e.z);
    if (d > R) {
      const nx = -e.x / d;
      const nz = -e.z / d;
      e.x = -nx * R;
      e.z = -nz * R;
      hit = true;
      if (r) {
        const vn = e.vx * nx + e.vz * nz;
        if (vn < 0) {
          e.vx -= (1 + r) * vn * nx;
          e.vz -= (1 + r) * vn * nz;
        }
      }
    }
  } else {
    const hw = map.width / 2 - radius;
    const hd = map.depth / 2 - radius;
    if (e.x < -hw) { e.x = -hw; if (r && e.vx < 0) e.vx = -e.vx * r; hit = true; }
    if (e.x > hw) { e.x = hw; if (r && e.vx > 0) e.vx = -e.vx * r; hit = true; }
    if (e.z < -hd) { e.z = -hd; if (r && e.vz < 0) e.vz = -e.vz * r; hit = true; }
    if (e.z > hd) { e.z = hd; if (r && e.vz > 0) e.vz = -e.vz * r; hit = true; }
  }

  for (const o of map.obstacles) {
    const cx = Math.max(o.x - o.w / 2, Math.min(e.x, o.x + o.w / 2));
    const cz = Math.max(o.z - o.d / 2, Math.min(e.z, o.z + o.d / 2));
    let dx = e.x - cx;
    let dz = e.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= radius * radius) continue;
    hit = true;
    let nx; let nz;
    if (d2 > 1e-9) {
      const d = Math.sqrt(d2);
      nx = dx / d; nz = dz / d;
      e.x = cx + nx * radius;
      e.z = cz + nz * radius;
    } else {
      const px = o.w / 2 + radius - Math.abs(e.x - o.x);
      const pz = o.d / 2 + radius - Math.abs(e.z - o.z);
      if (px < pz) { nx = e.x >= o.x ? 1 : -1; nz = 0; e.x += nx * px; }
      else { nx = 0; nz = e.z >= o.z ? 1 : -1; e.z += nz * pz; }
    }
    if (r) {
      const vn = e.vx * nx + e.vz * nz;
      if (vn < 0) {
        e.vx -= (1 + r) * vn * nx;
        e.vz -= (1 + r) * vn * nz;
      }
    }
  }
  return hit;
}

// One fixed movement step. Mutates p{x,z,angle,vx,vz,speed,driftCharge,
// drifting,driftBoosted}. inp{u,d,l,r,dr} are held booleans.
export function stepMovement(p, inp, dt, map, boosted) {
  const fx = Math.cos(p.angle);
  const fz = Math.sin(p.angle);
  let fwd = p.vx * fx + p.vz * fz;
  let lat = -p.vx * fz + p.vz * fx;

  const accel = Math.abs(fwd) < 6 ? KICK_ACCEL : ACCEL;
  if (inp.u && !inp.d) {
    fwd += (fwd < 0 ? BRAKE : accel) * dt;
  } else if (inp.d && !inp.u) {
    fwd -= (fwd > 0 ? BRAKE : accel) * dt;
  } else {
    const f = FRICTION * dt;
    if (fwd > f) fwd -= f;
    else if (fwd < -f) fwd += f;
    else fwd = 0;
  }

  // speed cap: drift boosts may exceed it briefly, then bleed back down
  // (capScale lets special entities like shadow clones run a bit slower)
  const cap = (boosted ? BOOST_MAX_SPEED : MAX_SPEED) * (p.capScale || 1);
  if (fwd > cap) fwd = Math.max(cap, fwd - OVERSPEED_DECAY * dt);
  fwd = Math.max(-REVERSE_MAX, fwd);

  // drift: hold the modifier while turning at speed → grip drops, steering
  // sharpens, and sustained sliding charges a release-boost
  const turning = inp.l !== inp.r;
  const drifting = !!inp.dr && turning && Math.abs(fwd) > 6;
  p.drifting = drifting;
  lat *= Math.exp(-(drifting ? DRIFT_GRIP : LATERAL_GRIP) * dt);

  if (turning && Math.abs(fwd) > 0.15) {
    const grip = Math.min(1, 0.55 + Math.abs(fwd) / 10);
    const dir = (inp.l ? -1 : 1) * (fwd < 0 ? -1 : 1);
    const rate = TURN_RATE * (drifting ? DRIFT_TURN : 1);
    p.angle = wrapAngle(p.angle + dir * rate * grip * dt);
  }

  if (drifting && Math.abs(lat) > 1.6) {
    p.driftCharge = Math.min(1.6, (p.driftCharge || 0) + dt);
  } else if (!inp.dr) {
    if ((p.driftCharge || 0) >= DRIFT_MIN_CHARGE) {
      fwd = Math.min(fwd + DRIFT_BOOST, cap + DRIFT_BOOST); // release, no stacking
      p.driftBoosted = true;
    }
    p.driftCharge = 0;
  }

  const nfx = Math.cos(p.angle);
  const nfz = Math.sin(p.angle);
  p.vx = fwd * nfx - lat * nfz;
  p.vz = fwd * nfz + lat * nfx;

  p.x += p.vx * dt;
  p.z += p.vz * dt;
  p.speed = fwd;

  collideCircleWorld(p, PLAYER_RADIUS, map, RESTITUTION);
}
