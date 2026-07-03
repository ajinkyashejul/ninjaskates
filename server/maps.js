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
      floor: 0xb8a98c,
      grid: 0x8f7f63,
      wall: 0x6b5b45,
      sky: 0xffc98a,
      fog: 0xe8b07a,
      obstacle: 0x8d7a5e,
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
      floor: 0x14142b,
      grid: 0x3affd0,
      wall: 0x241f4d,
      sky: 0x0b0b1c,
      fog: 0x1a1440,
      obstacle: 0x3d2f8f,
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
      floor: 0x565d68,
      grid: 0x3e444d,
      wall: 0x2f343c,
      sky: 0x9db8d8,
      fog: 0xb7c8de,
      obstacle: 0x777f8c,
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
