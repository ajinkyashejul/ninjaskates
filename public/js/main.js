// Entry point: menu flow, server connection, snapshot interpolation and the
// requestAnimationFrame loop that feeds the renderer + HUD.

import { Net } from './net.js';
import { Input } from './input.js';
import { Renderer } from './render.js';
import { MenuScene } from './menu-scene.js';
import { Hud } from './hud.js';
import { sfx } from './sfx.js';
import { preloadModels } from './assets.js';

preloadModels(); // fetch glTF props in the background while the menu shows

const $ = (id) => document.getElementById(id);

const INTERP_DELAY = 130; // ms behind the latest snapshot we render

const net = new Net();
const hud = new Hud();
let renderer = null;
let myId = null;
let snapshots = []; // { at, snap }
let wasAlive = true;
let inGame = false;

// ------------------------------------------------------------------- menu

let chosenMap = 'skatepark';
let chosenMin = 3;
let chosenBots = 3;

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
        ? { map: chosenMap, duration: chosenMin * 60, bots: chosenBots, room: $('code-input')?.value || '' }
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
  inGame = true;
  snapshots = [];
  menuScene?.dispose();
  menuScene = null;
  await preloadModels(); // usually already done while the menu was up
  renderer = new Renderer($('game'), msg.map);
  window.__renderer = renderer; // debug/QA handle
  $('menu').classList.add('hidden');
  hud.show(msg.room);
  hud.toast(`Welcome to ${msg.map.name}! Grab a crate to arm up.`);
  new Input(net).start();
  requestAnimationFrame(loop);
});

net.on('snap', (snap) => {
  snapshots.push({ at: performance.now(), snap });
  if (snapshots.length > 30) snapshots.splice(0, snapshots.length - 30);
  processEvents(snap.ev || []);

  // detect my own death for sound/feel
  const me = snap.p.find((p) => p.id === myId);
  if (me) {
    if (wasAlive && !me.al) sfx.death();
    wasAlive = !!me.al;
  }
});

function processEvents(events) {
  for (const ev of events) {
    switch (ev.e) {
      case 'kill':
        hud.killFeed(ev.kn, ev.vn, ev.w);
        renderer?.spawnExplosion(ev.x, ev.z, true);
        sfx.boom();
        if (ev.vi === myId) { hud.setDeathCause(ev.kn, ev.w); renderer?.shake(0.7, 0.45); }
        if (ev.ki === myId) { hud.smashBanner(`You smashed ${ev.vn}! 💥`); sfx.pickup(); }
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

function loop() {
  requestAnimationFrame(loop);
  const now = performance.now();
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;
  elapsed += dt;

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
