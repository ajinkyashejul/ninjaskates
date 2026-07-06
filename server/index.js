// NinjaSkates Node server: static client + WebSocket rooms in one process.
// Room selection happens over HTTP (POST /api/create|quick|join) and the
// WebSocket then connects straight to /ws/:code — the same protocol the
// Cloudflare Workers deployment (src/worker.js) speaks, so the client is
// identical for both.

import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { WebSocketServer } from 'ws';
import { Room, MAX_PLAYERS } from './room.js';
import { MAPS, randomMapId } from './maps.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const rooms = new Map(); // code -> Room

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O/0/1/I
function newRoomCode() {
  for (;;) {
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    if (!rooms.has(code)) return code;
  }
}

function createRoom({ mapId, duration, isPublic, botCount }) {
  const code = newRoomCode();
  const room = new Room(code, { mapId, duration, isPublic, botCount });
  rooms.set(code, room);
  return room;
}

function findQuickRoom() {
  for (const room of rooms.values()) {
    if (room.isPublic && room.humanCount() < MAX_PLAYERS) return room;
  }
  return createRoom({
    mapId: randomMapId(),
    duration: 180,
    isPublic: true,
    botCount: 3, // keep public rooms lively until humans fill them
  });
}

// ------------------------------------------------------------ room lookup

app.post('/api/create', (req, res) => {
  const body = req.body || {};
  // vanity code support: "standing rooms" your group can bookmark; if the
  // room already exists you simply join it
  const wanted = String(body.room || '').toUpperCase().trim();
  if (wanted) {
    if (!/^[A-Z0-9]{4,8}$/.test(wanted)) {
      return res.status(400).json({ error: 'Room codes are 4-8 letters/numbers.' });
    }
    if (rooms.has(wanted)) return res.json({ room: wanted, existed: true });
    const room = new Room(wanted, {
      mapId: MAPS[body.map] ? body.map : randomMapId(),
      duration: body.duration === 360 ? 360 : 180,
      isPublic: false,
      botCount: Math.max(0, Math.min(6, body.bots | 0)),
    });
    rooms.set(wanted, room);
    return res.json({ room: wanted });
  }
  const room = createRoom({
    mapId: MAPS[body.map] ? body.map : randomMapId(),
    duration: body.duration === 360 ? 360 : 180,
    isPublic: false,
    botCount: Math.max(0, Math.min(6, body.bots | 0)),
  });
  res.json({ room: room.code });
});

app.post('/api/quick', (req, res) => {
  res.json({ room: findQuickRoom().code });
});

app.post('/api/join', (req, res) => {
  const code = String(req.body?.room || '').toUpperCase().trim();
  if (rooms.has(code)) res.json({ room: code });
  else res.status(404).json({ error: `Room ${code} not found.` });
});

// --------------------------------------------------------------- gameplay

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost');
  const m = url.pathname.match(/^\/ws\/([A-Za-z0-9]+)$/);
  const room = m ? rooms.get(m[1].toUpperCase()) : null;
  if (!room) {
    ws.send(JSON.stringify({ t: 'error', msg: 'Room not found.' }));
    ws.close();
    return;
  }

  const player = room.addHuman(ws, url.searchParams.get('name'));
  if (!player) {
    ws.send(JSON.stringify({ t: 'error', msg: 'Room is full.' }));
    ws.close();
    return;
  }

  ws.send(JSON.stringify({
    t: 'joined',
    id: player.id,
    room: room.code,
    map: room.map,
    duration: room.duration,
    maxPlayers: MAX_PLAYERS,
  }));

  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data); } catch { return; }
    if (msg?.t === 'input') room.setInput(player.id, msg);
    else if (msg?.t === 'ping') ws.send(JSON.stringify({ t: 'pong', ts: msg.ts }));
  });

  ws.on('close', () => room.removePlayer(player.id));
});

// Reap rooms that have had no human players for a minute (grace period so a
// host refreshing their page doesn't strand friends who hold the link).
setInterval(() => {
  for (const [code, room] of rooms) {
    if (room.humanCount() === 0 && Date.now() - room.emptyAt > 60_000) {
      room.destroy();
      rooms.delete(code);
    }
  }
}, 5000);

server.listen(PORT, () => {
  console.log(`NinjaSkates listening on http://localhost:${PORT}`);
});
