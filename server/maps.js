// Map definitions. Coordinates are on the XZ plane, origin at arena center.
// Obstacles are axis-aligned boxes: x/z = center, w/d = full width/depth, h = render height.
// Everything here is sent to the client on join so rendering needs no separate map data.

function ring(cx, cz, r, n, fn) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    out.push(fn(cx + Math.cos(a) * r, cz + Math.sin(a) * r, a));
  }
  return out;
}

export const MAPS = {
  skatepark: {
    id: 'skatepark',
    name: 'Sunny Island',
    style: 'island', // renderer draws water, rock shores, palms instead of box walls
    width: 64,
    depth: 64,
    theme: {
      floor: 0xf7dc8a,
      grid: 0xeccb72,
      wall: 0xc98d5a,
      sky: 0x63c8f0,
      skyTop: 0x45b6ee,
      skyBottom: 0xd8f1fc,
      fog: 0xc9ecf9,
      obstacle: 0xe0a95c,
      water: 0x2fbfe8,
      waterDeep: 0x1795c9,
      grass: 0x82d763,
      rock: 0xb7af9f,
      trunk: 0x8a5a33,
      leaf: 0x3fae4e,
      sandLight: 0xfbe9b2,
    },
    obstacles: [
      // grassy knoll in the middle of the island
      { kind: 'mound', x: 0, z: 0, w: 11, d: 11, h: 1.9 },
      // palm trees (small trunk footprint, big canopy)
      { kind: 'palm', x: -15, z: -13, w: 1.3, d: 1.3, h: 5 },
      { kind: 'palm', x: 15, z: -13, w: 1.3, d: 1.3, h: 5 },
      { kind: 'palm', x: -15, z: 13, w: 1.3, d: 1.3, h: 5 },
      { kind: 'palm', x: 15, z: 13, w: 1.3, d: 1.3, h: 5 },
      { kind: 'palm', x: 0, z: -21, w: 1.3, d: 1.3, h: 5 },
      { kind: 'palm', x: 0, z: 21, w: 1.3, d: 1.3, h: 5 },
      // rocky outcrops
      { kind: 'rock', x: -24, z: -5, w: 4.5, d: 6, h: 2.2 },
      { kind: 'rock', x: 24, z: 5, w: 4.5, d: 6, h: 2.2 },
      { kind: 'rock', x: -6, z: 24, w: 6, d: 4, h: 1.9 },
      { kind: 'rock', x: 6, z: -24, w: 6, d: 4, h: 1.9 },
      // stacked supply crates
      { kind: 'crates', x: -20, z: 9, w: 2.6, d: 2.6, h: 2.3 },
      { kind: 'crates', x: 20, z: -9, w: 2.6, d: 2.6, h: 2.3 },
    ],
    decor: [
      { kind: 'grass', x: -10, z: -9, s: 2.2 }, { kind: 'grass', x: 11, z: 8, s: 2.6 },
      { kind: 'grass', x: -19, z: 17, s: 1.8 }, { kind: 'grass', x: 20, z: -17, s: 2.0 },
      { kind: 'grass', x: -25, z: -18, s: 1.5 }, { kind: 'grass', x: 25, z: 18, s: 1.6 },
      { kind: 'searock', x: -38, z: -34, s: 3.2 }, { kind: 'searock', x: 40, z: 30, s: 2.6 },
      { kind: 'searock', x: 34, z: -40, s: 2.2 }, { kind: 'searock', x: -36, z: 38, s: 2.8 },
      { kind: 'searock', x: 0, z: -44, s: 2.0 }, { kind: 'searock', x: -46, z: 4, s: 2.4 },
    ],
    spawns: [
      { x: -26, z: -26, angle: Math.PI / 4 },
      { x: 26, z: -26, angle: (3 * Math.PI) / 4 },
      { x: 26, z: 26, angle: (-3 * Math.PI) / 4 },
      { x: -26, z: 26, angle: -Math.PI / 4 },
      { x: 0, z: -27, angle: Math.PI / 2 },
      { x: 0, z: 27, angle: -Math.PI / 2 },
      { x: -27, z: 0, angle: 0 },
      { x: 27, z: 0, angle: Math.PI },
    ],
    crates: [
      { x: 0, z: -9 }, { x: 0, z: 9 },
      { x: -9, z: 0 }, { x: 9, z: 0 },
      { x: -22, z: -12 }, { x: 22, z: 12 },
      { x: -22, z: 14 }, { x: 22, z: -14 },
      { x: -12, z: -22 }, { x: 12, z: 22 },
    ],
  },

  neon: {
    id: 'neon',
    name: 'Neon Rink',
    width: 56,
    depth: 56,
    theme: {
      floor: 0x191936,
      grid: 0x35ffd5,
      wall: 0x2c2566,
      sky: 0x0a0a24,
      skyTop: 0x070718,
      skyBottom: 0x2c2158,
      fog: 0x241d55,
      obstacle: 0x4a39b8,
    },
    obstacles: [
      // pinwheel of pillars around the middle
      ...ring(0, 0, 12, 6, (x, z) => ({ x, z, w: 3, d: 3, h: 3 })),
      // long side barriers
      { x: -20, z: 0, w: 2, d: 16, h: 2.4 },
      { x: 20, z: 0, w: 2, d: 16, h: 2.4 },
    ],
    spawns: [
      { x: -22, z: -22, angle: Math.PI / 4 },
      { x: 22, z: -22, angle: (3 * Math.PI) / 4 },
      { x: 22, z: 22, angle: (-3 * Math.PI) / 4 },
      { x: -22, z: 22, angle: -Math.PI / 4 },
      { x: 0, z: -22, angle: Math.PI / 2 },
      { x: 0, z: 22, angle: -Math.PI / 2 },
    ],
    crates: [
      { x: 0, z: 0 },
      { x: 0, z: -18 }, { x: 0, z: 18 },
      { x: -14, z: -14 }, { x: 14, z: -14 },
      { x: -14, z: 14 }, { x: 14, z: 14 },
      { x: -25, z: 0 }, { x: 25, z: 0 },
    ],
  },

  rooftop: {
    id: 'rooftop',
    name: 'Rooftop Rumble',
    width: 70,
    depth: 50,
    theme: {
      floor: 0x9aa6b8,
      grid: 0x8894a6,
      wall: 0x5d6675,
      sky: 0x7fb8e8,
      skyTop: 0x64a9e4,
      skyBottom: 0xdcedfb,
      fog: 0xcfe4f5,
      obstacle: 0xa8bccf,
    },
    obstacles: [
      // AC units and skylights scattered across the roof
      { x: -20, z: -10, w: 6, d: 6, h: 2.6 },
      { x: -20, z: 10, w: 6, d: 6, h: 2.6 },
      { x: 20, z: -10, w: 6, d: 6, h: 2.6 },
      { x: 20, z: 10, w: 6, d: 6, h: 2.6 },
      { x: 0, z: 0, w: 8, d: 8, h: 1.4 },
      { x: -8, z: -16, w: 4, d: 3, h: 2 },
      { x: 8, z: 16, w: 4, d: 3, h: 2 },
      { x: 30, z: 0, w: 2, d: 12, h: 2.2 },
      { x: -30, z: 0, w: 2, d: 12, h: 2.2 },
    ],
    spawns: [
      { x: -30, z: -20, angle: Math.PI / 4 },
      { x: 30, z: -20, angle: (3 * Math.PI) / 4 },
      { x: 30, z: 20, angle: (-3 * Math.PI) / 4 },
      { x: -30, z: 20, angle: -Math.PI / 4 },
      { x: 0, z: -20, angle: Math.PI / 2 },
      { x: 0, z: 20, angle: -Math.PI / 2 },
    ],
    crates: [
      { x: 0, z: -12 }, { x: 0, z: 12 },
      { x: -13, z: 0 }, { x: 13, z: 0 },
      { x: -26, z: -18 }, { x: 26, z: 18 },
      { x: 26, z: -18 }, { x: -26, z: 18 },
      { x: -13, z: -20 }, { x: 13, z: 20 },
    ],
  },
};

export const MAP_IDS = Object.keys(MAPS);

export function randomMapId() {
  return MAP_IDS[Math.floor(Math.random() * MAP_IDS.length)];
}
