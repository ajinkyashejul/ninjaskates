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
    name: 'Sunset Skatepark',
    width: 64,
    depth: 64,
    theme: {
      floor: 0xf5d67a,
      grid: 0xe3bf5f,
      wall: 0xd99a4e,
      sky: 0x63c8f0,
      skyTop: 0x4db5ec,
      skyBottom: 0xd8f1fc,
      fog: 0xc6e9f8,
      obstacle: 0xe0a95c,
    },
    obstacles: [
      // central halfpipe-ish block
      { x: 0, z: 0, w: 10, d: 4, h: 2.2 },
      // quarter ramps in the corners
      { x: -22, z: -22, w: 8, d: 8, h: 1.8 },
      { x: 22, z: -22, w: 8, d: 8, h: 1.8 },
      { x: -22, z: 22, w: 8, d: 8, h: 1.8 },
      { x: 22, z: 22, w: 8, d: 8, h: 1.8 },
      // rails
      { x: 0, z: -16, w: 14, d: 1.2, h: 1.0 },
      { x: 0, z: 16, w: 14, d: 1.2, h: 1.0 },
      { x: -16, z: 0, w: 1.2, d: 14, h: 1.0 },
      { x: 16, z: 0, w: 1.2, d: 14, h: 1.0 },
    ],
    spawns: [
      { x: -26, z: -26, angle: Math.PI / 4 },
      { x: 26, z: -26, angle: (3 * Math.PI) / 4 },
      { x: 26, z: 26, angle: (-3 * Math.PI) / 4 },
      { x: -26, z: 26, angle: -Math.PI / 4 },
      { x: 0, z: -26, angle: Math.PI / 2 },
      { x: 0, z: 26, angle: -Math.PI / 2 },
      { x: -26, z: 0, angle: 0 },
      { x: 26, z: 0, angle: Math.PI },
    ],
    crates: [
      { x: 0, z: -8 }, { x: 0, z: 8 },
      { x: -8, z: 0 }, { x: 8, z: 0 },
      { x: -22, z: -10 }, { x: 22, z: -10 },
      { x: -22, z: 10 }, { x: 22, z: 10 },
      { x: -10, z: -22 }, { x: 10, z: 22 },
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
