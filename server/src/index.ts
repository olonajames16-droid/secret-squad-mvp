import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import { z } from 'zod';
import { assignRolesAndObjectives, createRoomCode, transitionMatchPhase } from './game.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

const PORT = Number(process.env.PORT || 4000);
const MAX_PLAYERS = 10;

const playerSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(24),
  color: z.string(),
  ready: z.boolean().default(false),
  host: z.boolean().default(false),
  role: z.string().optional(),
  objective: z.string().optional(),
  inventory: z.array(z.object({ id: z.string(), type: z.string(), authenticity: z.string(), holder: z.string() })).default([]),
});

type Player = z.infer<typeof playerSchema>;

type Room = {
  code: string;
  players: Map<string, Player>;
  hostId: string;
  phase: string;
  timer: number;
  matchLength: number;
  discussionLength: number;
  voteLength: number;
  missions: Record<string, { label: string; status: string; requires: string }>;
  evidence: Array<{ id: string; type: string; authenticity: string; holder: string }>;
  results?: { title: string; summary: string; teamProgress: number; personal: string };
};

const rooms = new Map<string, Room>();

function createDefaultRoom(code: string, hostId: string) {
  const room: Room = {
    code,
    hostId,
    players: new Map(),
    phase: 'WAITING_FOR_PLAYERS',
    timer: 300,
    matchLength: 300,
    discussionLength: 60,
    voteLength: 30,
    missions: {
      power: { label: 'Power Surge', status: 'incomplete', requires: 'MATCH_MASTER' },
      evidence: { label: 'Missing Evidence', status: 'incomplete', requires: 'EVIDENCE' },
      codebreaker: { label: 'Code Breaker', status: 'incomplete', requires: 'SEQUENCE' },
      reactor: { label: 'Reactor Rescue', status: 'incomplete', requires: 'REACTOR' },
    },
    evidence: [],
  };

  return room;
}

function serializeRoom(room: Room) {
  return {
    code: room.code,
    phase: room.phase,
    timer: room.timer,
    hostId: room.hostId,
    players: Array.from(room.players.values()).map((player) => ({
      id: player.id,
      name: player.name,
      color: player.color,
      ready: player.ready,
      host: player.id === room.hostId,
      role: player.role,
      objective: player.objective,
      score: player.score ?? 0,
    })),
    actions: Object.entries(room.missions).map(([missionId, item]) => ({ missionId, label: item.label, status: item.status })),
    evidence: room.evidence,
    results: room.results,
    role: room.players.get(room.hostId)?.role ?? undefined,
    objective: room.players.get(room.hostId)?.objective ?? undefined,
    voteSummary: {},
  };
}

function sendRoomState(room: Room) {
  const payload = serializeRoom(room);
  for (const player of room.players.values()) {
    io.to(player.id).emit('roomState', payload);
  }
}

function emitError(socketId: string, message: string) {
  io.to(socketId).emit('errorMessage', message);
}

function assignRolesForRoom(room: Room) {
  const players = Array.from(room.players.values()).map((player) => ({
    id: player.id,
    name: player.name,
    color: player.color,
    ready: true,
  }));

  const assigned = assignRolesAndObjectives(players).map((player) => ({
    ...room.players.get(player.id)!,
    role: player.role,
    objective: player.objective,
  }));

  for (const player of assigned) {
    room.players.set(player.id, player);
  }
}

io.on('connection', (socket) => {
  socket.on('createRoom', ({ name, color }) => {
    const safeName = String(name ?? 'Agent Zero').slice(0, 24);
    const roomCode = createRoomCode();
    const room = createDefaultRoom(roomCode, socket.id);

    room.players.set(socket.id, {
      id: socket.id,
      name: safeName,
      color: color || '#22d3ee',
      ready: false,
      host: true,
      inventory: [],
    });

    rooms.set(roomCode, room);
    socket.join(roomCode);
    socket.data.roomCode = roomCode;
    sendRoomState(room);
  });

  socket.on('joinRoom', ({ code, name, color }) => {
    const roomCode = String(code ?? '').toUpperCase();
    const room = rooms.get(roomCode);

    if (!room) {
      emitError(socket.id, 'Room not found.');
      return;
    }

    if (room.players.size >= MAX_PLAYERS) {
      emitError(socket.id, 'Room is full.');
      return;
    }

    if (room.players.has(socket.id)) {
      socket.join(roomCode);
      sendRoomState(room);
      return;
    }

    room.players.set(socket.id, {
      id: socket.id,
      name: String(name ?? 'Agent').slice(0, 24) || 'Agent',
      color: color || '#8b5cf6',
      ready: false,
      inventory: [],
    });

    socket.join(roomCode);
    socket.data.roomCode = roomCode;
    sendRoomState(room);
  });

  socket.on('toggleReady', () => {
    const roomCode = socket.data.roomCode as string | undefined;
    const room = roomCode ? rooms.get(roomCode) : undefined;
    if (!room) return;

    const player = room.players.get(socket.id);
    if (!player) return;

    player.ready = !player.ready;
    if (room.players.size >= 4 && Array.from(room.players.values()).every((p) => p.ready)) {
      room.phase = 'LOBBY_READY';
    }

    sendRoomState(room);
  });

  socket.on('startMatch', () => {
    const roomCode = socket.data.roomCode as string | undefined;
    const room = roomCode ? rooms.get(roomCode) : undefined;
    if (!room) return;

    if (room.players.size < 4) {
      emitError(socket.id, 'At least four players are required to start.');
      return;
    }

    const allReady = Array.from(room.players.values()).every((player) => player.ready);
    if (!allReady) {
      emitError(socket.id, 'Every player must be ready before the match can begin.');
      return;
    }

    room.phase = 'BRIEFING';
    room.timer = 10;
    assignRolesForRoom(room);
    sendRoomState(room);
  });

  socket.on('completeMission', ({ missionId }) => {
    const roomCode = socket.data.roomCode as string | undefined;
    const room = roomCode ? rooms.get(roomCode) : undefined;
    if (!room) return;

    const mission = room.missions[missionId as keyof typeof room.missions];
    if (!mission) return;

    const player = room.players.get(socket.id);
    if (!player) return;

    if (mission.status === 'complete') return;

    if (player.objective === 'MISSION_MASTER' || room.phase === 'INVESTIGATION') {
      mission.status = 'complete';
    }

    if (room.phase !== 'INVESTIGATION') {
      room.phase = 'INVESTIGATION';
    }

    if (room.timer <= 0) room.phase = 'FINAL_PHASE';
    sendRoomState(room);
  });

  socket.on('tradeEvidence', ({ fromId, toId }) => {
    const roomCode = socket.data.roomCode as string | undefined;
    const room = roomCode ? rooms.get(roomCode) : undefined;
    if (!room) return;

    const source = room.players.get(socket.id);
    const target = room.players.get(toId);
    if (!source || !target) return;

    const fromItem = source.inventory?.[0];
    const toItem = target.inventory?.[0];
    if (!fromItem || !toItem) return;

    source.inventory = [toItem];
    target.inventory = [fromItem];

    sendRoomState(room);
  });

  socket.on('requestDiscussion', () => {
    const roomCode = socket.data.roomCode as string | undefined;
    const room = roomCode ? rooms.get(roomCode) : undefined;
    if (!room) return;

    room.phase = 'DISCUSSION';
    room.timer = 60;
    sendRoomState(room);
  });

  socket.on('submitVote', ({ targetId }) => {
    const roomCode = socket.data.roomCode as string | undefined;
    const room = roomCode ? rooms.get(roomCode) : undefined;
    if (!room) return;

    if (room.phase !== 'VOTING') return;

    const player = room.players.get(socket.id);
    if (!player) return;

    const target = room.players.get(targetId);
    if (!target) return;

    if (!player.score) player.score = 0;
    player.score += 1;
    room.results = {
      title: 'Operation Complete',
      summary: 'The site has reached a stable end-state and the evidence trail is being reviewed.',
      teamProgress: 86,
      personal: player.objective ?? 'Survived',
    };

    sendRoomState(room);
  });

  socket.on('disconnect', () => {
    const roomCode = socket.data.roomCode as string | undefined;
    if (!roomCode) return;

    const room = rooms.get(roomCode);
    if (!room) return;

    room.players.delete(socket.id);

    if (room.players.size === 0) {
      rooms.delete(roomCode);
      return;
    }

    if (room.hostId === socket.id) {
      room.hostId = Array.from(room.players.keys())[0];
    }

    if (room.players.size < 4) {
      room.phase = 'WAITING_FOR_PLAYERS';
    }

    sendRoomState(room);
  });
});

setInterval(() => {
  for (const room of rooms.values()) {
    if (room.phase === 'BRIEFING' || room.phase === 'INVESTIGATION' || room.phase === 'DISCUSSION' || room.phase === 'VOTING' || room.phase === 'FINAL_PHASE') {
      room.timer = Math.max(0, room.timer - 1);
    }

    if (room.phase === 'BRIEFING' && room.timer <= 0) {
      room.phase = 'INVESTIGATION';
      room.timer = 180;
    }
    if (room.phase === 'INVESTIGATION' && room.timer <= 0) {
      room.phase = 'DISCUSSION';
      room.timer = 60;
    }
    if (room.phase === 'DISCUSSION' && room.timer <= 0) {
      room.phase = 'VOTING';
      room.timer = 30;
    }
    if (room.phase === 'VOTING' && room.timer <= 0) {
      room.phase = 'FINAL_PHASE';
      room.timer = 0;
      room.results = {
        title: 'Exposed',
        summary: 'A false lead changed the narrative and the site revealed the truth.',
        teamProgress: 72,
        personal: 'Objective revealed',
      };
    }

    sendRoomState(room);
  }
}, 1000);

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, rooms: rooms.size });
});

server.listen(PORT, () => {
  console.log(`SECRET SQUAD server running on http://localhost:${PORT}`);
});
