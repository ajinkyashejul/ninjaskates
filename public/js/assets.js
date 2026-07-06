// glTF prop library (Kenney Pirate Kit, CC0). Models preload in the
// background at page load; the renderer uses them when available and falls
// back to the procedural primitives when a model is missing or still loading.

import * as THREE from 'three';
import { GLTFLoader } from '/vendor/loaders/GLTFLoader.js';

const FILES = {
  palm: 'palm-detailed-straight',
  palmBend: 'palm-detailed-bend',
  rockA: 'rocks-a',
  rockB: 'rocks-b',
  rockSandA: 'rocks-sand-a',
  rockSandB: 'rocks-sand-b',
  crate: 'crate',
  barrel: 'barrel',
  chest: 'chest',
  boat: 'boat-row-small',
  dock: 'structure-platform-dock',
  grassPlant: 'grass-plant',
  grassPatch: 'patch-grass-foliage',
  hut: 'structure',
  hutRoof: 'structure-roof',
  tower: 'tower-complete-small',
  flag: 'flag-high',
};

const templates = {};
let started = null;

export function preloadModels(timeoutMs = 6000) {
  if (started) return started;
  const loader = new GLTFLoader();
  const jobs = Object.entries(FILES).map(([key, file]) => new Promise((resolve) => {
    loader.load(
      `/assets/models/${file}.glb`,
      (gltf) => {
        const scene = gltf.scene;
        scene.traverse((o) => {
          if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
        });
        templates[key] = scene;
        resolve();
      },
      undefined,
      () => resolve(), // missing model → primitives fallback
    );
  }));
  started = Promise.race([
    Promise.all(jobs),
    new Promise((r) => setTimeout(r, timeoutMs)),
  ]);
  return started;
}

export function hasModel(key) {
  return !!templates[key];
}

// Clone a template, scaled so its bounding box matches the requested size.
// Geometry/materials are shared between clones; only transforms differ.
export function instance(key, { height, footprint, scale } = {}) {
  const tpl = templates[key];
  if (!tpl) return null;
  const obj = tpl.clone(true);
  const box = new THREE.Box3().setFromObject(obj);
  const size = new THREE.Vector3();
  box.getSize(size);
  let s = scale ?? 1;
  if (height) s = height / Math.max(size.y, 1e-3);
  else if (footprint) s = footprint / Math.max(size.x, size.z, 1e-3);
  obj.scale.setScalar(s);
  // rest the model's base on the ground at its local origin
  obj.position.y = -box.min.y * s;
  return obj;
}
