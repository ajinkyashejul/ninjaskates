// Entry point: menu flow, server connection, snapshot interpolation and the
// requestAnimationFrame loop that feeds the renderer + HUD.

import { Net } from './net.js';
import { Input } from './input.js';
import { Renderer } from './render.js';
import { MenuScene } from './menu-scene.js';
import { Hud } from './hud.js';
import { sfx } from './sfx.js';
import { preloadModels } from './assets.js';
import { DT as SIM_DT, stepMovement, wrapAngle } from './physics.js';

preloadModels(); // fetch glTF props in the background while the menu shows

const $ = (id) => document.getElementById(id);

const INTERP_DELAY = 100; // ms behind the latest snapshot we render OTHERS

const net = new Net();
const hud = new Hud();
const input = new Input();
let renderer = null;
let myId = null;
let mapDef = null;
let snapshots = []; // { at, snap }
let wasAlive = true;
let inGame = false;

// ---- client-side prediction state: your own skater runs the shared
// physics locally every fixed step, so it responds on the next frame; the
// server confirms asynchronously and we replay unacknowledged inputs.
let pred = null; // predicted own state {x,z,angle,vx,vz,speed,driftCharge}
let predAngVel = 0; // angular velocity of the last sim step, for extrapolation
let lastStepAt = 0; // when that step ran — rendering extrapolates from here
let pendingInputs = []; // [{s, inp}] not yet acknowledged by the server
let inputSeq = 0;
let errX = 0; let errZ = 0; let errA = 0; // render-smoothing offsets
let predTimer = null;

// ------------------------------------------------------------------- menu

let chosenMap = 'skatepark';
let chosenMin = 3;
let chosenBots = 3;
let chosenClones = true;

function initMenu() {
  // restore name
  $('name-input').value = localStorage.getItem('nj_name') || '';

  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      ['quick', 'create', 'join'].forEach((p) =>
        $(`panel-${p}`).classList.toggle('hidden', tab.dataset.tab !== p));
    });
  });

  $('map-grid').addEventListener('click', (e) => {
    const card = e.target.closest('.map-card');
    if (!card) return;
    document.querySelectorAll('.map-card').forEach((c) => c.classList.remove('active'));
    card.classList.add('active');
    chosenMap = card.dataset.map;
  });

  const pillGroup = (groupId, attr, set) => {
    $(groupId).addEventListener('click', (e) => {
      const pill = e.target.closest('.pill');
      if (!pill) return;
      $(groupId).querySelectorAll('.pill').forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      set(Number(pill.dataset[attr]));
    });
  };
  pillGroup('duration-group', 'min', (v) => { chosenMin = v; });
  pillGroup('bots-group', 'bots', (v) => { chosenBots = v; });
  pillGroup('clones-group', 'clones', (v) => { chosenClones = v === 1; });

  $('btn-quick').addEventListener('click', () => play('quick'));
  $('btn-create').addEventListener('click', () => play('create'));
  $('btn-join').addEventListener('click', () => {
    const code = $('room-input').value.trim().toUpperCase();
    if (code.length < 4) return menuError('Enter the 5-letter room code.');
    play('join', code);
  });

  // Deep link: ?room=CODE is a "standing room" — auto-join it, creating it
  // if it doesn't exist yet, so a bookmarked link works every day. Falls
  // back to the join tab when we don't know the player's name yet.
  const linkRoom = (new URLSearchParams(location.search).get('room') || '').toUpperCase();
  if (linkRoom) {
    document.querySelector('[data-tab="join"]').click();
    $('room-input').value = linkRoom;
    $('btn-join').textContent = `Join Room ${linkRoom}`;
    if ($('name-input').value.trim()) play('standing', linkRoom);
  }
}

function menuError(msg) {
  const el = $('menu-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

// Room selection happens over HTTP; the WebSocket then connects straight to
// the chosen room. (On the Cloudflare deployment the room's Durable Object
// must be picked before the upgrade, so this order is load-bearing.)
async function play(mode, joinCode) {
  const name = $('name-input').value.trim();
  localStorage.setItem('nj_name', name);
  try {
    let room;
    if (mode === 'standing') {
      // bookmarked room link: join it, or create it if it isn't up yet
      const tryJoin = await fetch('/api/join', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ room: joinCode }),
      });
      if (tryJoin.ok) {
        ({ room } = await tryJoin.json());
      } else {
        const res = await fetch('/api/create', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ room: joinCode, bots: 3 }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Could not reach the game server.');
        }
        ({ room } = await res.json());
      }
    } else {
      const body = mode === 'create'
        ? { map: chosenMap, duration: chosenMin * 60, bots: chosenBots, clones: chosenClones, room: $('code-input')?.value || '' }
        : mode === 'join' ? { room: joinCode } : {};
      const res = await fetch(`/api/${mode}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Could not reach the game server.');
      }
      ({ room } = await res.json());
    }
    await net.connect(`/ws/${room}?name=${encodeURIComponent(name)}`);
    // put the room in the URL so a refresh drops you straight back in
    history.replaceState(null, '', `/?room=${room}`);
  } catch (err) {
    menuError(err.message);
  }
}

// ------------------------------------------------------------- net events

net.on('error', (msg) => {
  if (inGame) hud.toast(msg.msg);
  else menuError(msg.msg);
});

net.on('close', () => {
  if (!inGame) return;
  hud.toast('Disconnected from server — reloading…', 4000);
  setTimeout(() => location.reload(), 2500);
});

net.on('joined', async (msg) => {
  myId = msg.id;
  mapDef = msg.map;
  inGame = true;
  snapshots = [];
  pred = null;
  pendingInputs = [];
  menuScene?.dispose();
  menuScene = null;
  await preloadModels(); // usually already done while the menu was up
  renderer = new Renderer($('game'), msg.map);
  window.__renderer = renderer; // debug/QA handle
  window.__dbg = {
    getPred: () => pred,
    getErr: () => [errX, errZ],
    pending: () => pendingInputs.length,
    getServerMe: () => snapshots[snapshots.length - 1]?.snap.p.find((p) => p.id === myId),
    getRendered: () => {
      if (!pred) return null;
      const e = Math.min(SIM_DT, Math.max(0, (performance.now() - lastStepAt) / 1000));
      return { x: pred.x + pred.vx * e + errX, z: pred.z + pred.vz * e + errZ };
    },
  };
  $('menu').classList.add('hidden');
  hud.show(msg.room);
  hud.toast(`Welcome to ${msg.map.name}! Grab a crate to arm up.`);
  input.start();
  // the prediction pump runs on a fixed timer, NOT the render loop, so the
  // simulation keeps pace even when rendering hitches
  clearInterval(predTimer);
  predTimer = setInterval(stepPrediction, 1000 / 30);
  requestAnimationFrame(loop);
});

net.on('snap', (snap) => {
  snapshots.push({ at: performance.now(), snap });
  if (snapshots.length > 40) snapshots.splice(0, snapshots.length - 40);
  processEvents(snap.ev || []);

  const me = snap.p.find((p) => p.id === myId);
  if (me) {
    // detect my own death for sound/feel
    if (wasAlive && !me.al) sfx.death();
    wasAlive = !!me.al;
    reconcile(me, snap.st);
  }
});

// Server state arrived: rewind our prediction to it, replay every input the
// server hasn't processed yet, and fold any disagreement into a smoothing
// offset that decays over a few frames (instead of a visible snap).
function reconcile(me, state) {
  if (!pred || !me.al || state !== 'playing') {
    pred = { x: me.x, z: me.z, angle: me.a, vx: me.vx || 0, vz: me.vz || 0, speed: 0, driftCharge: 0 };
    predAngVel = 0;
    pendingInputs = [];
    errX = errZ = errA = 0;
    return;
  }
  const beforeX = pred.x + errX;
  const beforeZ = pred.z + errZ;
  const beforeA = pred.angle + errA;

  pred.x = me.x; pred.z = me.z; pred.angle = me.a;
  pred.vx = me.vx || 0; pred.vz = me.vz || 0;
  const acked = me.ls || 0;
  pendingInputs = pendingInputs.filter((pi) => pi.s > acked);
  for (const pi of pendingInputs) stepMovement(pred, pi.inp, SIM_DT, mapDef, !!me.bo);

  const ex = beforeX - pred.x;
  const ez = beforeZ - pred.z;
  if (Math.hypot(ex, ez) > 4) {
    // teleport-scale difference (respawn, knockback burst): snap, don't glide
    errX = errZ = errA = 0;
  } else {
    errX = ex; errZ = ez;
    errA = wrapAngle(beforeA - pred.angle);
  }
}

function processEvents(events) {
  for (const ev of events) {
    switch (ev.e) {
      case 'kill':
        hud.killFeed(ev.kn, ev.vn, ev.w);
        renderer?.spawnExplosion(ev.x, ev.z, true);
        sfx.boom();
        if (ev.vi === myId) { hud.setDeathCause(ev.kn, ev.w); renderer?.shake(0.7, 0.45); }
        if (ev.ki === myId) {
          if (ev.ks === 3) hud.smashBanner(`You smashed ${ev.vn}! 🔥 KILLING SPREE!`);
          else if (ev.ks === 5) hud.smashBanner('⚡ RAMPAGE! 5 in a row!');
          else if (ev.ks >= 7) hud.smashBanner(`💀 UNSTOPPABLE ×${ev.ks}`);
          else hud.smashBanner(`You smashed ${ev.vn}! 💥`);
          if (ev.vs >= 3) hud.toast(`You ended ${ev.vn}'s ${ev.vs}-kill spree!`);
          sfx.pickup();
        } else if (ev.ks === 3 || ev.ks === 5 || ev.ks === 8) {
          hud.toast(`🔥 ${ev.kn} is on a ${ev.ks}-kill streak!`);
        }
        break;
      case 'drift':
        if (ev.id === myId) { sfx.drift(); renderer?.shake(0.12, 0.15); }
        renderer?.spawnDriftBoost(ev.x, ev.z);
        break;
      case 'clone':
        renderer?.spawnExplosion(ev.x, ev.z, false);
        if (ev.oi === myId) { hud.toast('☁ A shadow clone joined your army!'); sfx.shield(); }
        break;
      case 'boom':
        renderer?.spawnExplosion(ev.x, ev.z, !!ev.big);
        sfx.boom();
        break;
      case 'poof':
        renderer?.spawnExplosion(ev.x, ev.z, false);
        break;
      case 'fire':
        sfx.fire(ev.w);
        break;
      case 'hit':
        if (ev.id === myId) { hud.damageFlash(); sfx.hit(); renderer?.shake(0.3, 0.25); }
        if (ev.ai === myId && ev.id !== myId) {
          hud.hitmarker();
          sfx.hitConfirm();
          renderer?.spawnDamageNumber(ev.x, ev.z, ev.dmg);
        }
        break;
      case 'shield':
        if (ev.id === myId) sfx.shield();
        break;
      case 'pickup':
        if (ev.id === myId) { hud.pickupBanner(ev.label); sfx.pickup(); }
        break;
      case 'matchEnd':
        hud.setStandings(ev.standings, ev.session);
        sfx.countdownEnd();
        break;
      case 'matchStart':
        hud.goFlash();
        sfx.countdownEnd();
        break;
      case 'join':
        hud.toast(`${ev.n} rolled in`);
        break;
      case 'leave':
        hud.toast(`${ev.n} bailed`);
        break;
      default:
        break;
    }
  }
}

// -------------------------------------------------------- interpolated view

function lerp(a, b, t) { return a + (b - a) * t; }

function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

function buildView() {
  if (snapshots.length === 0) return null;
  const latest = snapshots[snapshots.length - 1];
  const rt = performance.now() - INTERP_DELAY;

  let s0 = latest; let s1 = latest;
  for (let i = snapshots.length - 1; i >= 0; i--) {
    if (snapshots[i].at <= rt) {
      s0 = snapshots[i];
      s1 = snapshots[Math.min(i + 1, snapshots.length - 1)];
      break;
    }
    s0 = snapshots[i];
    s1 = snapshots[i];
  }
  const span = s1.at - s0.at;
  const t = span > 0 ? Math.min(1, Math.max(0, (rt - s0.at) / span)) : 1;

  const prev = new Map(s0.snap.p.map((p) => [p.id, p]));
  const players = s1.snap.p.map((p) => {
    // own skater: predicted state (frame-instant). The 30Hz sim result is
    // extrapolated by velocity so motion stays continuous at any frame rate
    // and across sim-pump catch-up bursts.
    if (p.id === myId && pred && p.al && latest.snap.st === 'playing') {
      const e = Math.min(SIM_DT, Math.max(0, (performance.now() - lastStepAt) / 1000));
      return {
        ...p,
        x: pred.x + pred.vx * e + errX,
        z: pred.z + pred.vz * e + errZ,
        a: pred.angle + predAngVel * e + errA,
      };
    }
    const q = prev.get(p.id);
    if (!q || !p.al || !q.al) return p;
    return { ...p, x: lerp(q.x, p.x, t), z: lerp(q.z, p.z, t), a: lerpAngle(q.a, p.a, t) };
  });

  const prevPr = new Map(s0.snap.pr.map((p) => [p.id, p]));
  const projectiles = s1.snap.pr.map((p) => {
    const q = prevPr.get(p.id);
    if (!q) return p;
    return { ...p, x: lerp(q.x, p.x, t), z: lerp(q.z, p.z, t) };
  });

  return {
    state: latest.snap.st,
    timeLeft: latest.snap.tl,
    players,
    projectiles,
    mines: latest.snap.mn,
    crates: latest.snap.cr,
  };
}

// -------------------------------------------------------------- game loop

let lastFrame = performance.now();
let elapsed = 0;

// One fixed simulation step: sample held input, predict locally, send to the
// server tagged with a sequence number. Runs at the same rate as the server
// tick so replayed inputs line up.
function stepPrediction() {
  inputSeq++;
  const s = input.state;
  net.send({ t: 'input', s: inputSeq, u: s.u, d: s.d, l: s.l, r: s.r, f: s.f, dr: s.dr });

  const latest = snapshots[snapshots.length - 1];
  const me = latest?.snap.p.find((p) => p.id === myId);
  if (!pred || !me || !me.al || latest.snap.st !== 'playing') return;

  pendingInputs.push({ s: inputSeq, inp: { u: s.u, d: s.d, l: s.l, r: s.r, dr: s.dr } });
  if (pendingInputs.length > 120) pendingInputs.splice(0, pendingInputs.length - 120);
  const a0 = pred.angle;
  stepMovement(pred, pendingInputs[pendingInputs.length - 1].inp, SIM_DT, mapDef, !!me.bo);
  predAngVel = wrapAngle(pred.angle - a0) / SIM_DT;
  lastStepAt = performance.now();
  if (pred.driftBoosted) {
    pred.driftBoosted = false;
    sfx.pickup(); // immediate local feedback; the server event brings the fx
  }
}

function loop() {
  requestAnimationFrame(loop);
  const now = performance.now();
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;
  elapsed += dt;

  // reconciliation error bleeds away smoothly instead of snapping
  const decay = Math.exp(-14 * dt);
  errX *= decay; errZ *= decay; errA *= decay;

  const view = buildView();
  if (!view || !renderer) return;
  renderer.update(view, myId, dt, elapsed);
  hud.update(view, myId, net.ping);
}

initMenu();

// live 3D character preview beside the menu form
let menuScene = null;
try {
  const pc = $('preview-canvas');
  if (pc && pc.clientWidth > 0) menuScene = new MenuScene(pc);
} catch { /* preview is decorative — the game works without it */ }
