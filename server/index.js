// NinjaSkates server: serves the static client and hosts the WebSocket
// endpoint that all rooms run behind.

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
app.use(express.static(path.join(__dirname, '..', 'public')));
// Serve three.js straight out of node_modules so the client is fully self-hosted.
app.use('/vendor', express.static(path.join(__dirname, '..', 'node_modules', 'three', 'build')));

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

function sanitizeName(raw) {
  const name = String(raw || '').replace(/[^\w \-'!.]/g, '').trim().slice(0, 14);
  return name || `Ninja${Math.floor(Math.random() * 900) + 100}`;
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

function joinRoom(ws, room, name) {
  const player = room.addHuman(ws, sanitizeName(name));
  if (!player) {
    ws.send(JSON.stringify({ t: 'error', msg: 'Room is full.' }));
    return;
  }
  ws._room = room;
  ws._playerId = player.id;
  ws.send(JSON.stringify({
    t: 'joined',
    id: player.id,
    room: room.code,
    map: room.map,
    duration: room.duration,
    maxPlayers: MAX_PLAYERS,
  }));
}

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data); } catch { return; }
    if (typeof msg !== 'object' || msg === null) return;

    switch (msg.t) {
      case 'create': {
        if (ws._room) return;
        const room = createRoom({
          mapId: MAPS[msg.map] ? msg.map : randomMapId(),
          duration: msg.duration === 360 ? 360 : 180,
          isPublic: false,
          botCount: Math.max(0, Math.min(6, msg.bots | 0)),
        });
        joinRoom(ws, room, msg.name);
        break;
      }
      case 'join': {
        if (ws._room) return;
        const code = String(msg.room || '').toUpperCase().trim();
        const room = rooms.get(code);
        if (!room) {
          ws.send(JSON.stringify({ t: 'error', msg: `Room ${code} not found.` }));
          return;
        }
        joinRoom(ws, room, msg.name);
        break;
      }
      case 'quick': {
        if (ws._room) return;
        joinRoom(ws, findQuickRoom(), msg.name);
        break;
      }
      case 'input': {
        if (ws._room) ws._room.setInput(ws._playerId, msg);
        break;
      }
      case 'ping': {
        ws.send(JSON.stringify({ t: 'pong', ts: msg.ts }));
        break;
      }
      default:
        break;
    }
  });

  ws.on('close', () => {
    if (ws._room) ws._room.removePlayer(ws._playerId);
  });
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
