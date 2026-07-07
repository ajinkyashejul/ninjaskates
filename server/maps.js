// Map definitions. Coordinates are on the XZ plane, origin at arena center.
// Obstacles are axis-aligned boxes: x/z = center, w/d = full width/depth,
// h = render height. Layouts are seeded-procedural so big maps stay dense;
// the full definition is sent to the client on join, so server and client
// always agree.

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// scatter n points in an annulus, keeping minimum spacing from prior points
function scatter(rand, n, rMin, rMax, spacing, taken) {
  const pts = [];
  let guard = 0;
  while (pts.length < n && guard++ < n * 40) {
    const a = rand() * Math.PI * 2;
    const r = rMin + Math.sqrt(rand()) * (rMax - rMin);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if ([...taken, ...pts].some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < spacing * spacing)) continue;
    pts.push({ x, z });
  }
  return pts;
}

function ring(n, r, fn, phase = 0) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + phase;
    out.push(fn(Math.cos(a) * r, Math.sin(a) * r, a));
  }
  return out;
}

// ------------------------------------------------------------ Sunny Island

function buildIsland() {
  const R = 180; // play radius — ~22s to cross at top speed
  const rand = mulberry32(20260707);
  const obstacles = [];
  const decor = [];
  const taken = []; // occupied spots for spacing checks

  const place = (o) => { obstacles.push(o); taken.push(o); };

  // central landmark: big grass knoll with the flag
  place({ kind: 'mound', x: 0, z: 0, w: 26, d: 26, h: 3.2 });

  // torii gate "roads": five gates at mid radius, aligned tangentially
  ring(5, 62, (x, z, a) => {
    const dirX = -Math.sin(a); const dirZ = Math.cos(a);
    place({ kind: 'pillar', x: x - dirX * 2.2, z: z - dirZ * 2.2, w: 0.9, d: 0.9, h: 3.6 });
    place({ kind: 'pillar', x: x + dirX * 2.2, z: z + dirZ * 2.2, w: 0.9, d: 0.9, h: 3.6 });
    decor.push({ kind: 'toriiTop', x, z, angle: -(a + Math.PI / 2) });
  });
  // and three more gates further out
  ring(3, 128, (x, z, a) => {
    const dirX = -Math.sin(a); const dirZ = Math.cos(a);
    place({ kind: 'pillar', x: x - dirX * 2.2, z: z - dirZ * 2.2, w: 0.9, d: 0.9, h: 3.6 });
    place({ kind: 'pillar', x: x + dirX * 2.2, z: z + dirZ * 2.2, w: 0.9, d: 0.9, h: 3.6 });
    decor.push({ kind: 'toriiTop', x, z, angle: -(a + Math.PI / 2) });
  }, 0.4);

  // watchtower landmarks for navigation
  for (const [x, z] of [[95, -60], [-90, 70]]) {
    place({ kind: 'tower', x, z, w: 6, d: 6, h: 8 });
  }

  // villages: hut clusters
  for (const c of scatter(rand, 7, 45, 155, 34, taken)) {
    place({ kind: 'hut', x: c.x, z: c.z, w: 4.2, d: 4.2, h: 2.6 });
  }

  // palms, rocks, crate stacks scattered across the island
  for (const p of scatter(rand, 30, 22, 168, 17, taken)) {
    place({ kind: 'palm', x: p.x, z: p.z, w: 1.3, d: 1.3, h: 5 + rand() * 1.5 });
  }
  for (const p of scatter(rand, 15, 30, 165, 26, taken)) {
    place({ kind: 'rock', x: p.x, z: p.z, w: 4.5 + rand() * 3, d: 5 + rand() * 3, h: 2 + rand() });
  }
  for (const p of scatter(rand, 8, 35, 150, 40, taken)) {
    place({ kind: 'crates', x: p.x, z: p.z, w: 2.6, d: 2.6, h: 2.3 });
  }

  // lawns + ponds (visual paint; ponds sit where nothing collides)
  const grass = [
    { x: 0, z: 0, r: 40 },
    ...scatter(rand, 8, 55, 150, 55, []).map((p) => ({ x: p.x, z: p.z, r: 13 + rand() * 9 })),
  ];
  const ponds = scatter(rand, 3, 60, 130, 70, taken).map((p) => ({ x: p.x, z: p.z, r: 10 + rand() * 5 }));

  // beach furniture + offshore dressing
  for (const b of scatter(rand, 22, 30, 165, 24, taken)) {
    decor.push({ kind: 'bush', x: b.x, z: b.z, s: 0.5 + rand() * 0.35 });
  }
  ring(3, R + 3.4, (x, z, a) => decor.push({ kind: 'dock', x: 0, z: 0, s: 1, angle: a }), 0.65);
  ring(3, R + 9, (x, z, a) => decor.push({ kind: 'boat', x, z, angle: a + 0.9 }), 1.1);
  ring(6, R + 1.8, (x, z) => decor.push({ kind: 'umbrella', x, z, s: 1 }), 0.25);
  ring(4, R + 0.6, (x, z) => decor.push({ kind: 'ball', x, z, s: 0.45 }), 0.9);
  ring(14, R + 14, (x, z) => decor.push({ kind: 'searock', x, z, s: 2 + rand() * 1.6 }), 0.1);

  // pickup crates: dense rings so you're never far from a weapon
  const crates = [
    ...ring(5, 20, (x, z) => ({ x, z })),
    ...ring(9, 55, (x, z) => ({ x, z }), 0.3),
    ...ring(13, 95, (x, z) => ({ x, z }), 0.1),
    ...ring(15, 135, (x, z) => ({ x, z }), 0.45),
    ...ring(12, 165, (x, z) => ({ x, z }), 0.2),
  ];

  const spawns = ring(16, 150, (x, z, a) => ({ x, z, angle: a + Math.PI }));

  return {
    id: 'skatepark',
    name: 'Sunny Island',
    style: 'island',
    shape: 'circle',
    radius: R,
    width: R * 2,
    depth: R * 2,
    theme: {
      floor: 0xf7dc8a, grid: 0xeccb72, wall: 0xc98d5a,
      sky: 0x63c8f0, skyTop: 0x45b6ee, skyBottom: 0xd8f1fc, fog: 0xc9ecf9,
      obstacle: 0xe0a95c, water: 0x2fbfe8, waterDeep: 0x1795c9,
      grass: 0x82d763, rock: 0xb7af9f, trunk: 0x8a5a33, leaf: 0x3fae4e,
      sandLight: 0xfbe9b2,
    },
    paint: { grass, ponds },
    obstacles,
    decor,
    crates,
    spawns,
  };
}

// -------------------------------------------------------------- Neon Rink

function buildNeon() {
  const R = 140;
  const rand = mulberry32(9042);
  const obstacles = [
    ...ring(6, 32, (x, z) => ({ x, z, w: 4, d: 4, h: 3.5 })),
    ...ring(10, 72, (x, z) => ({ x, z, w: 4.5, d: 4.5, h: 4 }), 0.3),
    ...ring(14, 112, (x, z) => ({ x, z, w: 5, d: 5, h: 4.5 }), 0.1),
    // long barrier walls between the rings
    ...ring(4, 52, (x, z, a) => ({
      x, z, w: Math.abs(Math.cos(a)) > 0.5 ? 2 : 18, d: Math.abs(Math.cos(a)) > 0.5 ? 18 : 2, h: 2.6,
    }), Math.PI / 4),
    ...ring(5, 92, (x, z, a) => ({
      x, z, w: Math.abs(Math.cos(a)) > 0.5 ? 2 : 22, d: Math.abs(Math.cos(a)) > 0.5 ? 22 : 2, h: 2.6,
    }), 0.8),
  ];
  const crates = [
    { x: 0, z: 0 },
    ...ring(6, 18, (x, z) => ({ x, z }), 0.5),
    ...ring(8, 52, (x, z) => ({ x, z })),
    ...ring(12, 92, (x, z) => ({ x, z }), 0.25),
    ...ring(12, 126, (x, z) => ({ x, z }), 0.6),
  ];
  void rand;
  return {
    id: 'neon',
    name: 'Neon Rink',
    style: 'neon',
    shape: 'circle',
    radius: R,
    width: R * 2,
    depth: R * 2,
    theme: {
      floor: 0x191936, grid: 0x35ffd5, wall: 0x2c2566,
      sky: 0x0a0a24, skyTop: 0x070718, skyBottom: 0x2c2158, fog: 0x241d55,
      obstacle: 0x4a39b8,
    },
    obstacles,
    crates,
    spawns: ring(12, 118, (x, z, a) => ({ x, z, angle: a + Math.PI })),
  };
}

// --------------------------------------------------------- Rooftop Rumble

function buildRooftop() {
  const W = 380; const D = 280;
  const rand = mulberry32(77120);
  const obstacles = [];
  const taken = [];
  const place = (o) => { obstacles.push(o); taken.push(o); };

  // grid-ish blocks of AC units, skylights and vents, like a real roofscape
  for (const p of scatter(rand, 26, 20, Math.min(W, D) / 2 - 15, 30, taken)) {
    place({ x: p.x, z: p.z, w: 7 + rand() * 5, d: 7 + rand() * 5, h: 2.2 + rand() * 1.6 });
  }
  for (const p of scatter(rand, 18, 15, Math.min(W, D) / 2 - 10, 22, taken)) {
    place({ x: p.x, z: p.z, w: 3 + rand() * 2, d: 3 + rand() * 2, h: 1.6 + rand() });
  }
  // long parapet walls making lanes
  for (let i = 0; i < 8; i++) {
    const horiz = rand() > 0.5;
    const p = scatter(rand, 1, 30, Math.min(W, D) / 2 - 25, 24, taken)[0];
    if (!p) continue;
    place({ x: p.x, z: p.z, w: horiz ? 24 + rand() * 14 : 2, d: horiz ? 2 : 24 + rand() * 14, h: 2.2 });
  }

  const crates = [
    ...ring(6, 30, (x, z) => ({ x, z })),
    ...ring(10, 75, (x, z) => ({ x, z }), 0.3),
    ...ring(12, 115, (x, z) => ({ x: x * (W / D >= 1 ? 1.2 : 1), z, }), 0.1),
    ...scatter(rand, 14, 20, Math.min(W, D) / 2 - 12, 26, []).map((p) => ({ x: p.x, z: p.z })),
  ].filter((c) => Math.abs(c.x) < W / 2 - 8 && Math.abs(c.z) < D / 2 - 8);

  const spawns = ring(12, Math.min(W, D) / 2 - 20, (x, z, a) => ({
    x: Math.max(-W / 2 + 15, Math.min(W / 2 - 15, x * (W / D))),
    z,
    angle: a + Math.PI,
  }));

  return {
    id: 'rooftop',
    name: 'Rooftop Rumble',
    width: W,
    depth: D,
    theme: {
      floor: 0x9aa6b8, grid: 0x8894a6, wall: 0x5d6675,
      sky: 0x7fb8e8, skyTop: 0x64a9e4, skyBottom: 0xdcedfb, fog: 0xcfe4f5,
      obstacle: 0xa8bccf,
    },
    obstacles,
    crates,
    spawns,
  };
}

export const MAPS = {
  skatepark: buildIsland(),
  neon: buildNeon(),
  rooftop: buildRooftop(),
};

export const MAP_IDS = Object.keys(MAPS);

export function randomMapId() {
  return MAP_IDS[Math.floor(Math.random() * MAP_IDS.length)];
}
