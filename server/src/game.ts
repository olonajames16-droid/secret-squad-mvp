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

export type Player = {
  id: string;
  name: string;
  color: string;
  ready: boolean;
  host?: boolean;
  role?: Role;
  objective?: Objective;
  inventory?: Array<{ id: string; type: string; authenticity: string; holder: string }>;
  score?: number;
};

export function createRoomCode() {
  return Math.random().toString(36).slice(2, 7).toUpperCase();
}

export function assignRolesAndObjectives(players: Array<{ id: string }>) {
  const roles: Role[] = ['INVESTIGATOR', 'TRICKSTER', 'ENGINEER'];
  const objectives: Objective[] = ['MISSION_MASTER', 'THE_COLLECTOR', 'THE_KINGMAKER'];

  return players.map((player, index) => ({
    ...player,
    role: roles[index % roles.length],
    objective: objectives[index % objectives.length],
  }));
}

export function applyTrade(
  players: Record<string, { inventory: Array<{ id: string }> }>,
  fromId: string,
  toId: string,
  fromItemId: string,
  toItemId: string,
) {
  const fromInventory = players[fromId].inventory;
  const toInventory = players[toId].inventory;

  const fromIndex = fromInventory.findIndex((item) => item.id === fromItemId);
  const toIndex = toInventory.findIndex((item) => item.id === toItemId);

  if (fromIndex < 0 || toIndex < 0) return players;

  const fromItem = fromInventory[fromIndex];
  const toItem = toInventory[toIndex];

  fromInventory[fromIndex] = toItem;
  toInventory[toIndex] = fromItem;

  return { ...players, [fromId]: { ...players[fromId], inventory: fromInventory }, [toId]: { ...players[toId], inventory: toInventory } };
}

export function validateMissionCompletion(room: any, playerId: string, missionId: string) {
  if (!room || !room.players) return false;
  if (!room.players.some((player: any) => player.id === playerId)) return false;

  const mission = room.missionState?.[missionId];
  if (!mission) return false;

  return mission.status !== 'complete' && room.players.some((player: any) => player.id === playerId && player.objective === 'MISSION_MASTER');
}

export function transitionMatchPhase(current: MatchPhase, secondsRemaining: number, totalSeconds: number): MatchPhase {
  if (current === 'INVESTIGATION' && secondsRemaining <= 0) return 'DISCUSSION';
  if (current === 'DISCUSSION' && secondsRemaining <= 0) return 'VOTING';
  if (current === 'VOTING' && secondsRemaining <= 0) return 'FINAL_PHASE';
  if (current === 'FINAL_PHASE' && secondsRemaining <= 0) return 'RESOLVING';
  if (current === 'RESOLVING') return 'RESULTS';
  return current;
}
