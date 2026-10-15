export type MatchPhase =
  | 'WAITING_FOR_PLAYERS'
  | 'LOBBY_READY'
  | 'STARTING'
  | 'BRIEFING'
  | 'INVESTIGATION'
  | 'DISCUSSION'
  | 'VOTING'
  | 'FINAL_PHASE'
  | 'RESOLVING'
  | 'RESULTS'
  | 'RETURN_TO_LOBBY'
  | 'CANCELLED';

export type Role = 'INVESTIGATOR' | 'TRICKSTER' | 'ENGINEER';
export type Objective = 'MISSION_MASTER' | 'THE_COLLECTOR' | 'THE_KINGMAKER';

export type Evidence = {
  id: string;
  type: string;
  authenticity: 'authentic' | 'altered' | 'planted';
  holder: string;
  discoveredAt?: number;
};

export type Player = {
  id: string;
  name: string;
  color: string;
  ready: boolean;
  host?: boolean;
  role?: Role;
  objective?: Objective;
  inventory: Evidence[];
  score: number;
};

export type MissionState = {
  status: 'incomplete' | 'complete';
  text: string;
  requires: string;
};

export function createRoomCode(): string {
  return Math.random().toString(36).slice(2, 7).toUpperCase();
}

export function assignRolesAndObjectives(
  players: Array<{ id: string; name?: string; color?: string; ready?: boolean }>,
): Player[] {
  const roles: Role[] = ['INVESTIGATOR', 'TRICKSTER', 'ENGINEER'];
  const objectives: Objective[] = ['MISSION_MASTER', 'THE_COLLECTOR', 'THE_KINGMAKER'];

  return players.map((player, index) => ({
    id: player.id,
    name: player.name ?? `Player ${index + 1}`,
    color: player.color ?? '#8b5cf6',
    ready: player.ready ?? false,
    role: roles[index % roles.length],
    objective: objectives[index % objectives.length],
    inventory: [],
    score: 0,
  }));
}

export function applyTrade(
  players: Record<string, { inventory: Array<{ id: string }> }>,
  fromId: string,
  toId: string,
  fromItemId: string,
  toItemId: string,
) {
  if (!players[fromId] || !players[toId]) return players;

  const fromInventory = [...players[fromId].inventory];
  const toInventory = [...players[toId].inventory];
  const fromIndex = fromInventory.findIndex((item) => item.id === fromItemId);
  const toIndex = toInventory.findIndex((item) => item.id === toItemId);

  if (fromIndex < 0 || toIndex < 0) return players;

  const fromItem = fromInventory[fromIndex];
  const toItem = toInventory[toIndex];
  fromInventory[fromIndex] = toItem;
  toInventory[toIndex] = fromItem;

  return {
    ...players,
    [fromId]: { ...players[fromId], inventory: fromInventory },
    [toId]: { ...players[toId], inventory: toInventory },
  };
}

export function validateMissionCompletion(
  room: { players?: Array<{ id: string; objective?: string }>; missionState?: Record<string, MissionState> },
  playerId: string,
  missionId: string,
): boolean {
  if (!room?.players || !room.missionState || !room.missionState[missionId]) {
    return false;
  }

  const player = room.players.find((candidate) => candidate.id === playerId);
  if (!player) {
    return false;
  }

  const mission = room.missionState[missionId];
  if (mission.status === 'complete') {
    return false;
  }

  return player.objective === 'MISSION_MASTER' || mission.requires === 'PLAYER_ACTION';
}

export function transitionMatchPhase(current: MatchPhase, secondsRemaining: number): MatchPhase {
  switch (current) {
    case 'BRIEFING':
      return secondsRemaining > 0 ? 'BRIEFING' : 'INVESTIGATION';
    case 'INVESTIGATION':
      return secondsRemaining > 0 ? 'INVESTIGATION' : 'DISCUSSION';
    case 'DISCUSSION':
      return secondsRemaining > 0 ? 'DISCUSSION' : 'VOTING';
    case 'VOTING':
      return secondsRemaining > 0 ? 'VOTING' : 'FINAL_PHASE';
    case 'FINAL_PHASE':
      return secondsRemaining > 0 ? 'FINAL_PHASE' : 'RESOLVING';
    case 'RESOLVING':
      return 'RESULTS';
    case 'RESULTS':
      return 'RETURN_TO_LOBBY';
    default:
      return current;
  }
}

export function createEvidence(
  id: string,
  type: string,
  holder: string,
  authenticity: Evidence['authenticity'] = 'authentic',
): Evidence {
  return {
    id,
    type,
    authenticity,
    holder,
    discoveredAt: Date.now(),
  };
}
