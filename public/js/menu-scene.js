// Live 3D character preview on the menu — your skater idling on a sunny
// beach disc, like Smash Karts' garage view.

import * as THREE from 'three';
import { buildSkater } from './render.js';

export class MenuScene {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(38, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
    this.camera.position.set(3.4, 1.9, 3.0);
    this.camera.lookAt(0, 1.0, 0);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa5b5, 1.0));
    const sun = new THREE.DirectionalLight(0xfff2dd, 1.7);
    sun.position.set(4, 7, 3);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -4; sun.shadow.camera.right = 4;
    sun.shadow.camera.top = 4; sun.shadow.camera.bottom = -4;
    this.scene.add(sun);

    // sand podium + water haze backdrop
    const sand = new THREE.Mesh(
      new THREE.CylinderGeometry(2.1, 2.3, 0.3, 40),
      new THREE.MeshStandardMaterial({ color: 0xf7dc8a }),
    );
    sand.position.y = -0.15;
    sand.receiveShadow = true;
    this.scene.add(sand);

    this.skater = buildSkater(0xff4d5a);
    this.skater.rotation.y = -0.5;
    this.scene.add(this.skater);

    this._running = true;
    this._t = 0;
    const loop = () => {
      if (!this._running) return;
      requestAnimationFrame(loop);
      this._t += 1 / 60;
      const t = this._t;
      // idle: gentle sway, breathing bob, slow look-around
      this.skater.rotation.y = -0.5 + Math.sin(t * 0.5) * 0.35;
      const u = this.skater.userData;
      u.body.position.y = Math.sin(t * 2.2) * 0.015;
      u.head.rotation.z = Math.sin(t * 1.1) * 0.05;
      u.armL.rotation.z = Math.sin(t * 2.2) * 0.06;
      u.armR.rotation.z = -Math.sin(t * 2.2) * 0.06;
      const c = this.renderer.domElement;
      if (c.clientWidth && (c.width !== c.clientWidth * this.renderer.getPixelRatio())) {
        this.renderer.setSize(c.clientWidth, c.clientHeight, false);
        this.camera.aspect = c.clientWidth / c.clientHeight;
        this.camera.updateProjectionMatrix();
      }
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  dispose() {
    this._running = false;
    this.renderer.dispose();
  }
}
