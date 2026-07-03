// Three.js renderer. The server owns all game state; this module just draws
// the interpolated view it's handed each frame.

import * as THREE from '/vendor/three.module.js';

const PLAYER_COLORS = [
  0xff4d5a, 0x3affd0, 0xffc93a, 0x7a6bff,
  0x4dc3ff, 0xff8a3a, 0x62e05a, 0xff5ad0,
];

function gridTexture(fill, line) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = `#${fill.toString(16).padStart(6, '0')}`;
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = `#${line.toString(16).padStart(6, '0')}`;
  g.lineWidth = 3;
  g.strokeRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function crateTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#2d2350';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#8f7aff';
  g.lineWidth = 8;
  g.strokeRect(6, 6, 116, 116);
  g.fillStyle = '#3affd0';
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
  g.shadowColor = '#000';
  g.shadowBlur = 8;
  g.fillStyle = `#${colorHex.toString(16).padStart(6, '0')}`;
  g.fillText(name, 128, 32);
  const tex = new THREE.CanvasTexture(c);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  sprite.scale.set(3.4, 0.85, 1);
  sprite.position.y = 2.6;
  return sprite;
}

// Ninja-on-a-skateboard, built from primitives, facing +X.
function buildSkater(color) {
  const group = new THREE.Group();
  const mat = (c, extra = {}) => new THREE.MeshStandardMaterial({ color: c, ...extra });

  const deck = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.1, 0.55), mat(0x4a3623));
  deck.position.y = 0.32;
  group.add(deck);

  const wheelGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.1, 10);
  for (const [wx, wz] of [[0.6, 0.24], [0.6, -0.24], [-0.6, 0.24], [-0.6, -0.24]]) {
    const w = new THREE.Mesh(wheelGeo, mat(0xf5e9d0));
    w.rotation.x = Math.PI / 2;
    w.position.set(wx, 0.14, wz);
    group.add(w);
  }

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.6, 4, 10), mat(color));
  body.position.y = 1.05;
  group.add(body);

  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.12, 0.72), mat(0x1a1a22));
  belt.position.y = 0.95;
  group.add(belt);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), mat(0x1a1a22));
  head.position.y = 1.78;
  group.add(head);

  // eye slit facing forward (+X)
  const slit = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.4), mat(0xf5d7b0));
  slit.position.set(0.24, 1.8, 0);
  group.add(slit);

  // headband + tails flying behind
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 8, 16), mat(color));
  band.rotation.x = Math.PI / 2;
  band.position.y = 1.9;
  group.add(band);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.12), mat(color));
  tail.position.set(-0.5, 1.92, 0);
  group.add(tail);

  // blob shadow
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.85, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  group.add(shadow);

  // shield bubble (toggled per frame)
  const shield = new THREE.Mesh(
    new THREE.SphereGeometry(1.35, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0x3affd0, transparent: true, opacity: 0.22 }),
  );
  shield.position.y = 1.0;
  group.add(shield);
  group.userData.shield = shield;
  group.userData.body = body;

  return group;
}

export class Renderer {
  constructor(canvas, map) {
    this.map = map;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(map.theme.sky);
    this.scene.fog = new THREE.Fog(map.theme.fog, 60, 140);

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 300);
    this.camera.position.set(0, 30, 30);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(30, 50, 20);
    this.scene.add(sun);

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
      map: this.crateTex, emissive: 0x221a55, emissiveIntensity: 0.6,
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

  spawnExplosion(x, z, big) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 14, 10),
      new THREE.MeshBasicMaterial({ color: big ? 0xffa63a : 0xdddddd, transparent: true, opacity: 0.9 }),
    );
    mesh.position.set(x, 1, z);
    this.scene.add(mesh);
    this.effects.push({ mesh, age: 0, life: 0.45, size: big ? 3.4 : 1.4 });
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
      m.userData.shield.material.opacity = 0.16 + 0.08 * Math.sin(elapsed * 8);
      // boost: lean forward a touch and glow
      m.userData.body.material.emissive = new THREE.Color(p.bo ? this.colorFor(p.id) : 0x000000);
      m.userData.body.material.emissiveIntensity = p.bo ? 0.5 : 0;
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
        m.rotation.z = -Math.PI / 2;
        m.rotation.y = -pr.a;
        m.rotation.order = 'YZX';
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
    this.effects = this.effects.filter((fx) => {
      fx.age += dt;
      const t = fx.age / fx.life;
      if (t >= 1) { this.scene.remove(fx.mesh); return false; }
      fx.mesh.scale.setScalar(0.3 + t * fx.size);
      fx.mesh.material.opacity = 0.9 * (1 - t);
      return true;
    });

    // chase camera on my skater
    const me = view.players.find((p) => p.id === myId);
    if (me) {
      const back = 9;
      const target = new THREE.Vector3(
        me.x - Math.cos(me.a) * back,
        6.5,
        me.z - Math.sin(me.a) * back,
      );
      this.camera.position.lerp(target, Math.min(1, dt * 5));
      this.camera.lookAt(me.x, 1.2, me.z);
    }

    this.renderer.render(this.scene, this.camera);
  }
}
