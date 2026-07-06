// Cloudflare Workers deployment. Each game room is a Durable Object — a
// single-threaded instance that every player's WebSocket routes to, no matter
// which edge location they connect through. The simulation code in server/
// is pure JS and runs here unchanged; this file is just the platform shell.

import { Room, MAX_PLAYERS } from '../server/room.js';
import { MAPS, randomMapId } from '../server/maps.js';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O/0/1/I
const ROOM_TTL_MS = 60 * 60 * 1000; // idle rooms are reaped after an hour

function randomCode() {
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

// Allocate a fresh room code: ask candidate Durable Objects to claim the
// config until one accepts (409 = code already in use).
async function initRoom(env, cfg) {
  for (let i = 0; i < 8; i++) {
    const code = randomCode();
    const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
    const res = await stub.fetch('https://do/init', {
      method: 'POST',
      body: JSON.stringify({ ...cfg, code }),
    });
    if (res.ok) return code;
  }
  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/api/create' && request.method === 'POST') {
      let body = {};
      try { body = await request.json(); } catch { /* empty body is fine */ }
      const cfg = {
        mapId: MAPS[body.map] ? body.map : randomMapId(),
        duration: body.duration === 360 ? 360 : 180,
        isPublic: false,
        botCount: Math.max(0, Math.min(6, body.bots | 0)),
        clones: body.clones !== false,
      };
      // vanity code support: "standing rooms" your group can bookmark; if
      // the room already exists you simply join it
      const wanted = String(body.room || '').toUpperCase().trim();
      if (wanted) {
        if (!/^[A-Z0-9]{4,8}$/.test(wanted)) {
          return Response.json({ error: 'Room codes are 4-8 letters/numbers.' }, { status: 400 });
        }
        const stub = env.ROOMS.get(env.ROOMS.idFromName(wanted));
        const res = await stub.fetch('https://do/init', {
          method: 'POST',
          body: JSON.stringify({ ...cfg, code: wanted }),
        });
        // 409 = already exists — that's fine, the caller joins it
        return Response.json({ room: wanted, existed: res.status === 409 });
      }
      const code = await initRoom(env, cfg);
      if (!code) return Response.json({ error: 'Could not allocate a room.' }, { status: 500 });
      return Response.json({ room: code });
    }

    if (path === '/api/quick' && request.method === 'POST') {
      const lobby = env.LOBBY.get(env.LOBBY.idFromName('global'));
      const { room } = await (await lobby.fetch('https://do/acquire', { method: 'POST' })).json();
      if (room) return Response.json({ room });
      const code = await initRoom(env, {
        mapId: randomMapId(),
        duration: 180,
        isPublic: true,
        botCount: 3, // keep public rooms lively until humans fill them
      });
      if (!code) return Response.json({ error: 'Could not allocate a room.' }, { status: 500 });
      await lobby.fetch('https://do/update', {
        method: 'POST',
        body: JSON.stringify({ code, humans: 0 }),
      });
      return Response.json({ room: code });
    }

    if (path === '/api/join' && request.method === 'POST') {
      let body = {};
      try { body = await request.json(); } catch { /* handled below */ }
      const code = String(body.room || '').toUpperCase().trim();
      if (!/^[A-Z0-9]{4,6}$/.test(code)) {
        return Response.json({ error: 'Invalid room code.' }, { status: 400 });
      }
      const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
      const res = await stub.fetch('https://do/exists');
      if (!res.ok) return Response.json({ error: `Room ${code} not found.` }, { status: 404 });
      return Response.json({ room: code });
    }

    const wsMatch = path.match(/^\/ws\/([A-Za-z0-9]{4,6})$/);
    if (wsMatch) {
      const code = wsMatch[1].toUpperCase();
      const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
      return stub.fetch(request);
    }

    // Static assets are served before the worker runs; anything else is a miss.
    return new Response('Not found', { status: 404 });
  },
};

// ------------------------------------------------------------------ rooms

export class RoomDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.room = null; // live simulation, only while humans are connected
    this.cfg = null;
  }

  async getCfg() {
    if (!this.cfg) this.cfg = await this.state.storage.get('config');
    return this.cfg;
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/init') {
      if (await this.getCfg()) return new Response('code taken', { status: 409 });
      this.cfg = await request.json();
      await this.state.storage.put('config', this.cfg);
      await this.state.storage.setAlarm(Date.now() + ROOM_TTL_MS);
      return Response.json({ ok: true });
    }

    if (url.pathname === '/exists') {
      return (await this.getCfg())
        ? Response.json({ ok: true })
        : new Response('not found', { status: 404 });
    }

    // Everything else is a player WebSocket (/ws/CODE?name=...)
    const cfg = await this.getCfg();
    if (!cfg) return new Response('Room not found', { status: 404 });
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    if (!this.room) this.room = new Room(cfg.code, cfg);

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();

    const player = this.room.addHuman(server, url.searchParams.get('name'));
    if (!player) {
      server.send(JSON.stringify({ t: 'error', msg: 'Room is full.' }));
      server.close(1000, 'full');
      return new Response(null, { status: 101, webSocket: client });
    }

    server.send(JSON.stringify({
      t: 'joined',
      id: player.id,
      room: cfg.code,
      map: this.room.map,
      duration: this.room.duration,
      maxPlayers: MAX_PLAYERS,
    }));

    server.addEventListener('message', (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg?.t === 'input') this.room?.setInput(player.id, msg);
      else if (msg?.t === 'ping') {
        try { server.send(JSON.stringify({ t: 'pong', ts: msg.ts })); } catch { /* closed */ }
      }
    });

    let dropped = false;
    const drop = () => {
      if (dropped) return;
      dropped = true;
      this.room?.removePlayer(player.id);
      this.afterLeave();
    };
    server.addEventListener('close', drop);
    server.addEventListener('error', drop);

    await this.state.storage.setAlarm(Date.now() + ROOM_TTL_MS); // push reap horizon
    this.reportLobby();
    return new Response(null, { status: 101, webSocket: client });
  }

  afterLeave() {
    this.reportLobby();
    if (this.room && this.room.humanCount() === 0) {
      // Stop simulating so the object can go idle (idle objects aren't
      // billed). The config stays in storage, so the invite link keeps
      // working — a rejoin just boots a fresh match — until the alarm reaps it.
      this.room.destroy();
      this.room = null;
    }
  }

  reportLobby() {
    if (!this.cfg?.isPublic) return;
    const lobby = this.env.LOBBY.get(this.env.LOBBY.idFromName('global'));
    lobby.fetch('https://do/update', {
      method: 'POST',
      body: JSON.stringify({ code: this.cfg.code, humans: this.room?.humanCount() ?? 0 }),
    }).catch(() => { /* lobby bookkeeping is best-effort */ });
  }

  async alarm() {
    if (this.room && this.room.humanCount() > 0) {
      await this.state.storage.setAlarm(Date.now() + ROOM_TTL_MS);
      return;
    }
    const cfg = await this.getCfg();
    if (cfg?.isPublic) {
      const lobby = this.env.LOBBY.get(this.env.LOBBY.idFromName('global'));
      await lobby.fetch('https://do/remove', {
        method: 'POST',
        body: JSON.stringify({ code: cfg.code }),
      }).catch(() => {});
    }
    await this.state.storage.deleteAll();
    this.cfg = null;
  }
}

// ------------------------------------------------------------------ lobby
// Singleton registry of public rooms for quick play. Occupancy reports are
// best-effort; a stale entry just means one failed join attempt.

export class LobbyDO {
  constructor(state) {
    this.state = state;
    this.rooms = null; // code -> { humans, at }
  }

  async load() {
    if (!this.rooms) this.rooms = (await this.state.storage.get('rooms')) || {};
  }

  async fetch(request) {
    await this.load();
    const url = new URL(request.url);

    if (url.pathname === '/acquire') {
      const now = Date.now();
      let pick = null;
      for (const [code, info] of Object.entries(this.rooms)) {
        if (now - info.at > 2 * ROOM_TTL_MS) { delete this.rooms[code]; continue; }
        if (!pick && info.humans < MAX_PLAYERS) pick = code;
      }
      await this.state.storage.put('rooms', this.rooms);
      return Response.json({ room: pick });
    }

    if (url.pathname === '/update') {
      const { code, humans } = await request.json();
      this.rooms[code] = { humans, at: Date.now() };
      await this.state.storage.put('rooms', this.rooms);
      return Response.json({ ok: true });
    }

    if (url.pathname === '/remove') {
      const { code } = await request.json();
      delete this.rooms[code];
      await this.state.storage.put('rooms', this.rooms);
      return Response.json({ ok: true });
    }

    return new Response('bad request', { status: 400 });
  }
}
