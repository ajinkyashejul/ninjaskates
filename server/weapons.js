// Weapon and power-up definitions. Crates grant one of these at random.

export const WEAPONS = {
  shuriken: {
    id: 'shuriken',
    label: 'Shurikens',
    ammo: 6,
    fireInterval: 0.35, // seconds between shots
    projectile: {
      speed: 32,
      radius: 0.35,
      damage: 25,
      life: 1.6,
      bounces: 2, // ninja stars ricochet off walls
    },
  },
  rocket: {
    id: 'rocket',
    label: 'Rocket',
    ammo: 3,
    fireInterval: 0.8,
    projectile: {
      speed: 24,
      radius: 0.45,
      damage: 55,
      life: 2.5,
      bounces: 0,
      splash: { radius: 3.2, damage: 35 },
    },
  },
  minigun: {
    id: 'minigun',
    label: 'Minigun',
    ammo: 24,
    fireInterval: 0.09,
    spread: 0.09, // radians of random spread per shot
    projectile: {
      speed: 44,
      radius: 0.2,
      damage: 7,
      life: 0.9,
      bounces: 0,
    },
  },
  mine: {
    id: 'mine',
    label: 'Smoke Mines',
    ammo: 3,
    fireInterval: 0.5,
    // mines are placed behind the player, not fired forward
    mine: {
      armTime: 1.0,
      triggerRadius: 1.5,
      damage: 65,
      splash: { radius: 2.8, damage: 40 },
      life: 30,
    },
  },
};

export const POWERS = {
  shield: { id: 'shield', label: 'Shield', duration: 5 },
  boost: { id: 'boost', label: 'Speed Boost', duration: 5 },
  health: { id: 'health', label: 'Health Pack', heal: 40 },
};

// Weighted loot table for crates.
const LOOT = [
  ['shuriken', 22],
  ['rocket', 16],
  ['minigun', 16],
  ['mine', 12],
  ['shield', 10],
  ['boost', 12],
  ['health', 12],
];
const LOOT_TOTAL = LOOT.reduce((s, [, w]) => s + w, 0);

export function rollLoot() {
  let r = Math.random() * LOOT_TOTAL;
  for (const [id, w] of LOOT) {
    r -= w;
    if (r <= 0) return id;
  }
  return 'shuriken';
}
