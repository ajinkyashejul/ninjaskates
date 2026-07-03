// Three.js renderer. The server owns all game state; this module draws the
// interpolated view it's handed each frame and layers on purely-visual feel:
// stride animation, lean, skid trails, knock smoke, explosion effects.

import * as THREE from '/vendor/three.module.js';

const PLAYER_COLORS = [
  0xff4d5a, 0x2ec8a6, 0xffb42e, 0x7a6bff,
  0x39aef5, 0xff7a2e, 0x58c94f, 0xf05ac0,
];
const SKIN = 0xffd9b3;
const DARK = 0x23232e;

function hex(c) { return `#${c.toString(16).padStart(6, '0')}`; }

function gridTexture(fill, line) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = hex(fill);
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = hex(line);
  g.lineWidth = 3;
  g.strokeRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function skyTexture(top, bottom) {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, hex(top));
  grad.addColorStop(0.62, hex(bottom));
  grad.addColorStop(1, hex(bottom));
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  return new THREE.CanvasTexture(c);
}

function crateTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#e0742a';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#ffd28a';
  g.lineWidth = 10;
  g.strokeRect(7, 7, 114, 114);
  g.fillStyle = '#fff6e0';
  g.font = 'bold 84px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('?', 64, 70);
  return new THREE.CanvasTexture(c);
}

function nameSprite(name, colorHex) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 34px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 7;
  g.strokeStyle = 'rgba(20,20,30,0.85)';
  g.strokeText(name, 128, 32);
  g.fillStyle = hex(colorHex);
  g.fillText(name, 128, 32);
  const tex = new THREE.CanvasTexture(c);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  sprite.scale.set(3.2, 0.8, 1);
  sprite.position.y = 2.35;
  return sprite;
}

// ------------------------------------------------------------- the skater
// Chibi humanoid ninja on inline skates, built from primitives, facing +X.
// Structure: outer group (position + yaw) -> body group (lean roll/pitch)
// -> hips/torso/head + leg pivots + arm pivots. Legs swing to skate.

function buildSkater(color) {
  const outer = new THREE.Group();
  const body = new THREE.Group();
  outer.add(body);
  const mat = (c, extra = {}) => new THREE.MeshStandardMaterial({ color: c, ...extra });
  const suit = mat(color);
  const dark = mat(DARK);

  // ---- legs with skates (pivot at the hip so swings look like strides)
  const mkLeg = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(0, 0.66, side * 0.15);

    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.44, 0.16), suit);
    leg.position.y = -0.22;
    pivot.add(leg);

    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 0.18), dark);
    boot.position.set(0.06, -0.48, 0);
    pivot.add(boot);

    // inline skate: chassis + 3 wheels
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.05, 0.06), mat(0x8b95a8));
    chassis.position.set(0.06, -0.57, 0);
    pivot.add(chassis);
    const wheels = [];
    for (const wx of [-0.09, 0.06, 0.21]) {
      const w = new THREE.Mesh(
        new THREE.CylinderGeometry(0.065, 0.065, 0.05, 10),
        mat(0xfff3d6),
      );
      w.rotation.x = Math.PI / 2;
      w.position.set(wx, -0.62, 0);
      pivot.add(w);
      wheels.push(w);
    }
    pivot.userData.wheels = wheels;
    return pivot;
  };
  const legL = mkLeg(-1);
  const legR = mkLeg(1);
  body.add(legL, legR);

  // ---- torso + belt
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.3, 4, 10), suit);
  torso.position.y = 0.98;
  body.add(torso);
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.1, 0.56), dark);
  belt.position.y = 0.8;
  body.add(belt);

  // ---- arms (pivot at shoulders, swing opposite the legs)
  const mkArm = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(0, 1.18, side * 0.34);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.3, 4, 8), suit);
    arm.position.y = -0.2;
    pivot.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), dark);
    hand.position.y = -0.42;
    pivot.add(hand);
    return pivot;
  };
  const armL = mkArm(-1);
  const armR = mkArm(1);
  body.add(armL, armR);

  // ---- big cartoon head: hooded, skin face patch, eyes, headband
  const head = new THREE.Group();
  head.position.y = 1.62;
  body.add(head);

  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 12), suit);
  head.add(hood);
  // face: flattened skin sphere poking out the front of the hood
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 10), mat(SKIN));
  face.scale.set(0.55, 0.75, 0.9);
  face.position.set(0.2, -0.02, 0);
  head.add(face);
  // eyes: white + pupil, on the front (+X)
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), mat(0xffffff));
    eye.position.set(0.32, 0.02, side * 0.1);
    head.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 5), mat(0x18181f));
    pupil.position.set(0.375, 0.02, side * 0.1);
    head.add(pupil);
  }
  // headband + flowing tails
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.345, 0.045, 8, 18), dark);
  band.rotation.x = Math.PI / 2;
  band.position.y = 0.12;
  head.add(band);
  const tails = [];
  for (const [len, zoff] of [[0.5, -0.03], [0.38, 0.06]]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(len, 0.02, 0.09), dark);
    t.geometry.translate(-len / 2, 0, 0); // flutter pivots at the knot
    t.position.set(-0.3, 0.14, zoff);
    head.add(t);
    tails.push(t);
  }

  // ---- blob shadow + shield bubble
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.7, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  outer.add(shadow);

  const shield = new THREE.Mesh(
    new THREE.SphereGeometry(1.2, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0x3affd0, transparent: true, opacity: 0.2 }),
  );
  shield.position.y = 0.95;
  outer.add(shield);

  outer.userData = {
    body, legL, legR, armL, armR, head, tails, shield, torso, hood,
    phase: 0, lastX: null, lastZ: null, lastA: null, roll: 0,
    lastSkid: 0, lastPuff: 0, lastSmoke: 0,
  };
  return outer;
}

export class Renderer {
  constructor(canvas, map) {
    this.map = map;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(map.theme.sky);
    this.scene.fog = new THREE.Fog(map.theme.fog, 65, 150);

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);
    this.camera.position.set(0, 30, 30);
    this.fov = 60;

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a97a8, 1.15));
    const sun = new THREE.DirectionalLight(0xfff2dd, 1.5);
    sun.position.set(30, 50, 20);
    this.scene.add(sun);

    this._buildSky(map);
    this._buildArena(map);

    this.playerMeshes = new Map();
    this.projMeshes = new Map();
    this.mineMeshes = new Map();
    this.effects = [];
    this.crateTex = crateTexture();
    this._buildCrates(map);

    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  _buildSky(map) {
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(180, 16, 12),
      new THREE.MeshBasicMaterial({
        map: skyTexture(map.theme.skyTop ?? map.theme.sky, map.theme.skyBottom ?? map.theme.fog),
        side: THREE.BackSide,
        fog: false,
      }),
    );
    this.scene.add(dome);

    // puffy clouds drifting above the arena edge
    const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, transparent: true, opacity: 0.92 });
    const R = Math.max(map.width, map.depth);
    for (let i = 0; i < 9; i++) {
      const cloud = new THREE.Group();
      const puffs = 2 + (i % 3);
      for (let p = 0; p < puffs; p++) {
        const s = 2 + ((i * 7 + p * 3) % 5) * 0.6;
        const m = new THREE.Mesh(new THREE.SphereGeometry(s, 8, 6), cloudMat);
        m.scale.y = 0.55;
        m.position.set(p * s * 1.1, (p % 2) * 0.6, (p % 2) * s * 0.4);
        cloud.add(m);
      }
      const a = (i / 9) * Math.PI * 2;
      cloud.position.set(Math.cos(a) * R * (0.7 + (i % 3) * 0.25), 20 + (i % 4) * 4, Math.sin(a) * R * (0.7 + ((i + 1) % 3) * 0.25));
      this.scene.add(cloud);
    }
  }

  _buildArena(map) {
    const { width: W, depth: D, theme } = map;

    const floorTex = gridTexture(theme.floor, theme.grid);
    floorTex.repeat.set(W / 4, D / 4);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(W, D),
      new THREE.MeshStandardMaterial({ map: floorTex }),
    );
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    // apron outside the walls so the arena doesn't float in the void
    const apron = new THREE.Mesh(
      new THREE.PlaneGeometry(W * 3, D * 3),
      new THREE.MeshStandardMaterial({ color: theme.skyBottom ?? theme.fog }),
    );
    apron.rotation.x = -Math.PI / 2;
    apron.position.y = -0.05;
    this.scene.add(apron);

    const wallMat = new THREE.MeshStandardMaterial({ color: theme.wall });
    const wallH = 2.4;
    const mkWall = (w, d, x, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), wallMat);
      m.position.set(x, wallH / 2, z);
      this.scene.add(m);
    };
    mkWall(W + 2, 1, 0, -D / 2 - 0.5);
    mkWall(W + 2, 1, 0, D / 2 + 0.5);
    mkWall(1, D + 2, -W / 2 - 0.5, 0);
    mkWall(1, D + 2, W / 2 + 0.5, 0);

    const obMat = new THREE.MeshStandardMaterial({ color: theme.obstacle });
    for (const o of map.obstacles) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(o.w, o.h, o.d), obMat);
      m.position.set(o.x, o.h / 2, o.z);
      this.scene.add(m);
    }
  }

  _buildCrates(map) {
    const geo = new THREE.BoxGeometry(1.1, 1.1, 1.1);
    const mat = new THREE.MeshStandardMaterial({
      map: this.crateTex, emissive: 0x552200, emissiveIntensity: 0.35,
    });
    this.crateMeshes = map.crates.map((c) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(c.x, 0.9, c.z);
      this.scene.add(m);
      return m;
    });
  }

  colorFor(id) {
    let h = 0;
    for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return PLAYER_COLORS[h % PLAYER_COLORS.length];
  }

  _playerMesh(p) {
    let m = this.playerMeshes.get(p.id);
    if (!m) {
      const color = this.colorFor(p.id);
      m = buildSkater(color);
      m.add(nameSprite(p.n, color));
      this.scene.add(m);
      this.playerMeshes.set(p.id, m);
    }
    return m;
  }

  _projMesh(pr) {
    let m = this.projMeshes.get(pr.id);
    if (m) return m;
    if (pr.ty === 'shuriken') {
      m = new THREE.Mesh(
        new THREE.CylinderGeometry(0.34, 0.34, 0.06, 4),
        new THREE.MeshStandardMaterial({ color: 0xd8dee8, emissive: 0x8899aa, emissiveIntensity: 0.4 }),
      );
      m.userData.spin = true;
    } else if (pr.ty === 'rocket') {
      m = new THREE.Mesh(
        new THREE.ConeGeometry(0.26, 0.85, 8),
        new THREE.MeshStandardMaterial({ color: 0xff6a2a, emissive: 0xff3300, emissiveIntensity: 0.7 }),
      );
      m.userData.rocket = true;
    } else {
      m = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xffe45a }),
      );
    }
    m.position.y = 0.9;
    this.scene.add(m);
    this.projMeshes.set(pr.id, m);
    return m;
  }

  _mineMesh(mn) {
    let m = this.mineMeshes.get(mn.id);
    if (m) return m;
    m = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.42, 0.22, 12),
      new THREE.MeshStandardMaterial({ color: 0x552233, emissive: 0xff2244, emissiveIntensity: 0.2 }),
    );
    m.position.set(mn.x, 0.12, mn.z);
    this.scene.add(m);
    this.mineMeshes.set(mn.id, m);
    return m;
  }

  // ----------------------------------------------------------- effects

  _fx(mesh, kind, life, extra = {}) {
    mesh.material.transparent = true;
    this.scene.add(mesh);
    this.effects.push({ mesh, kind, age: 0, life, ...extra });
  }

  spawnExplosion(x, z, big) {
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(1, 14, 10),
      new THREE.MeshBasicMaterial({ color: big ? 0xffa63a : 0xdddddd, opacity: 0.9 }),
    );
    core.position.set(x, 1, z);
    this._fx(core, 'burst', 0.45, { size: big ? 3.4 : 1.4 });
    if (big) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1, 0.16, 8, 24),
        new THREE.MeshBasicMaterial({ color: 0xfff0c8, opacity: 0.8 }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, 0.25, z);
      this._fx(ring, 'burst', 0.4, { size: 4.2 });
    }
  }

  _skid(x, z, angle) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(0.42, 0.07),
      new THREE.MeshBasicMaterial({ color: 0x2a2a33, opacity: 0.26, depthWrite: false }),
    );
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = -angle;
    m.position.set(x, 0.03, z);
    this._fx(m, 'flat', 0.9);
  }

  _puff(x, y, z, color, size = 0.22, life = 0.5) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(size, 7, 5),
      new THREE.MeshBasicMaterial({ color, opacity: 0.55, depthWrite: false }),
    );
    m.position.set(x, y, z);
    this._fx(m, 'puff', life);
  }

  // -------------------------------------------------------- frame update

  _animateSkater(m, p, dt, elapsed) {
    const u = m.userData;

    // estimate motion from interpolated positions (no extra net traffic)
    let sp = 0; let fwdSp = 0; let dA = 0;
    if (u.lastX !== null && dt > 0) {
      const dx = (p.x - u.lastX) / dt;
      const dz = (p.z - u.lastZ) / dt;
      sp = Math.hypot(dx, dz);
      fwdSp = dx * Math.cos(p.a) + dz * Math.sin(p.a);
      dA = p.a - u.lastA;
      while (dA > Math.PI) dA -= Math.PI * 2;
      while (dA < -Math.PI) dA += Math.PI * 2;
    }
    u.lastX = p.x; u.lastZ = p.z; u.lastA = p.a;

    // stride: legs scissor, arms counter-swing, wheels spin
    u.phase += fwdSp * dt * 2.1;
    const amp = Math.min(1, Math.abs(fwdSp) / 6) * 0.55;
    const swing = Math.sin(u.phase) * amp;
    u.legL.rotation.z = swing;
    u.legR.rotation.z = -swing;
    u.armL.rotation.z = -swing * 0.7;
    u.armR.rotation.z = swing * 0.7;
    for (const leg of [u.legL, u.legR]) {
      for (const w of leg.userData.wheels) w.rotation.z -= fwdSp * dt / 0.065;
    }

    // lean: roll into turns, pitch forward with speed, crouch a touch
    const targetRoll = Math.max(-0.5, Math.min(0.5, (dA / Math.max(dt, 1e-3)) * Math.min(sp, 12) * 0.012));
    u.roll += (targetRoll - u.roll) * Math.min(1, dt * 8);
    u.body.rotation.x = u.roll;
    u.body.rotation.z = -Math.min(0.3, sp * 0.02) - amp * 0.06;
    u.body.position.y = -Math.min(0.08, sp * 0.006);

    // headband flutter
    const flap = Math.min(1, sp / 10);
    u.tails[0].rotation.z = 0.25 + Math.sin(elapsed * 9) * 0.25 * (0.3 + flap);
    u.tails[1].rotation.z = 0.1 + Math.sin(elapsed * 11 + 1.3) * 0.3 * (0.3 + flap);

    // ground feel: skid marks in corners / hard braking, boost + hurt puffs
    const now = elapsed;
    const drifting = sp > 6 && Math.abs(dA) / Math.max(dt, 1e-3) > 1.4;
    if (drifting && now - u.lastSkid > 0.05) {
      u.lastSkid = now;
      for (const side of [-0.16, 0.16]) {
        this._skid(
          p.x - Math.sin(p.a) * side - Math.cos(p.a) * 0.2,
          p.z + Math.cos(p.a) * side - Math.sin(p.a) * 0.2,
          p.a,
        );
      }
    }
    if (p.bo && now - u.lastPuff > 0.07) {
      u.lastPuff = now;
      this._puff(p.x - Math.cos(p.a) * 0.8, 0.35, p.z - Math.sin(p.a) * 0.8, 0xdff6ff, 0.2, 0.4);
    }
    if (p.hp <= 35 && now - u.lastSmoke > 0.3) {
      u.lastSmoke = now;
      this._puff(p.x - Math.cos(p.a) * 0.3, 1.5, p.z - Math.sin(p.a) * 0.3, 0x5a5a64, 0.13, 0.55);
    }
  }

  // view = interpolated state from main.js
  update(view, myId, dt, elapsed) {
    // players
    const seen = new Set();
    for (const p of view.players) {
      seen.add(p.id);
      const m = this._playerMesh(p);
      m.visible = !!p.al;
      m.position.set(p.x, 0, p.z);
      m.rotation.y = -p.a;
      m.userData.shield.visible = !!p.sh;
      m.userData.shield.material.opacity = 0.14 + 0.07 * Math.sin(elapsed * 8);
      const glow = p.bo ? this.colorFor(p.id) : 0x000000;
      m.userData.torso.material.emissive.setHex(glow);
      m.userData.torso.material.emissiveIntensity = p.bo ? 0.45 : 0;
      if (p.al) this._animateSkater(m, p, dt, elapsed);
      else m.userData.lastX = null;
    }
    for (const [id, m] of this.playerMeshes) {
      if (!seen.has(id)) { this.scene.remove(m); this.playerMeshes.delete(id); }
    }

    // projectiles
    const seenPr = new Set();
    for (const pr of view.projectiles) {
      seenPr.add(pr.id);
      const m = this._projMesh(pr);
      m.position.x = pr.x;
      m.position.z = pr.z;
      if (m.userData.spin) m.rotation.y += 25 * dt;
      if (m.userData.rocket) {
        m.rotation.order = 'YZX';
        m.rotation.z = -Math.PI / 2;
        m.rotation.y = -pr.a;
        if (Math.random() < 0.5) this._puff(pr.x, 0.9, pr.z, 0xcccccc, 0.14, 0.35);
      }
    }
    for (const [id, m] of this.projMeshes) {
      if (!seenPr.has(id)) { this.scene.remove(m); this.projMeshes.delete(id); }
    }

    // mines
    const seenMn = new Set();
    for (const mn of view.mines) {
      seenMn.add(mn.id);
      const m = this._mineMesh(mn);
      m.material.emissiveIntensity = mn.ar ? 0.4 + 0.6 * Math.abs(Math.sin(elapsed * 6)) : 0.15;
    }
    for (const [id, m] of this.mineMeshes) {
      if (!seenMn.has(id)) { this.scene.remove(m); this.mineMeshes.delete(id); }
    }

    // crates
    for (let i = 0; i < this.crateMeshes.length; i++) {
      const m = this.crateMeshes[i];
      m.visible = !!view.crates[i];
      m.rotation.y = elapsed * 1.2;
      m.position.y = 0.9 + 0.15 * Math.sin(elapsed * 2 + i);
    }

    // effects
    if (this.effects.length > 260) this.effects.splice(0, this.effects.length - 260);
    this.effects = this.effects.filter((fx) => {
      fx.age += dt;
      const t = fx.age / fx.life;
      if (t >= 1) { this.scene.remove(fx.mesh); return false; }
      if (fx.kind === 'burst') {
        fx.mesh.scale.setScalar(0.3 + t * fx.size);
        fx.mesh.material.opacity = 0.9 * (1 - t);
      } else if (fx.kind === 'puff') {
        fx.mesh.position.y += dt * 0.9;
        fx.mesh.scale.setScalar(1 + t * 1.2);
        fx.mesh.material.opacity = 0.4 * (1 - t);
      } else { // flat skid
        fx.mesh.material.opacity = 0.26 * (1 - t);
      }
      return true;
    });

    // chase camera with speed-reactive FOV
    const me = view.players.find((p) => p.id === myId);
    if (me) {
      const back = 8.6;
      const target = new THREE.Vector3(
        me.x - Math.cos(me.a) * back,
        5.6,
        me.z - Math.sin(me.a) * back,
      );
      this.camera.position.lerp(target, Math.min(1, dt * 5));
      this.camera.lookAt(me.x, 1.1, me.z);

      const mm = this.playerMeshes.get(me.id);
      let spd = 0;
      if (mm && dt > 0 && mm.userData.lastX !== null) {
        spd = Math.hypot(me.x - (mm.userData.prevCamX ?? me.x), me.z - (mm.userData.prevCamZ ?? me.z)) / dt;
        mm.userData.prevCamX = me.x;
        mm.userData.prevCamZ = me.z;
      }
      const targetFov = 58 + Math.min(20, spd) * 0.7;
      this.fov += (targetFov - this.fov) * Math.min(1, dt * 4);
      if (Math.abs(this.camera.fov - this.fov) > 0.1) {
        this.camera.fov = this.fov;
        this.camera.updateProjectionMatrix();
      }
    }

    this.renderer.render(this.scene, this.camera);
  }
}
