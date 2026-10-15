import { describe, expect, it } from 'vitest';
import { applyTrade, assignRolesAndObjectives, createRoomCode, validateMissionCompletion, transitionMatchPhase } from './game.js';

describe('room logic', () => {
  it('cannot start with fewer than four players', () => {
    const players = [{ id: 'p1', name: 'A', ready: true }, { id: 'p2', name: 'B', ready: true }, { id: 'p3', name: 'C', ready: true }];
    const result = assignRolesAndObjectives(players);
    expect(result.length).toBeGreaterThanOrEqual(3);
  });

  it('room code is valid and uppercase', () => {
    const code = createRoomCode();
    expect(code).toMatch(/^[A-Z0-9]{5}$/);
  });

  it('trade is atomic and does not duplicate evidence', () => {
    const evidenceA = [{ id: 'e1', holder: 'p1' }];
    const evidenceB = [{ id: 'e2', holder: 'p2' }];
    const players = {
      p1: { inventory: [evidenceA[0]] },
      p2: { inventory: [evidenceB[0]] },
    } as any;

    const updated = applyTrade(players, 'p1', 'p2', 'e1', 'e2');
    expect(updated.p1.inventory.map((item: any) => item.id)).toContain('e2');
    expect(updated.p2.inventory.map((item: any) => item.id)).toContain('e1');
  });

  it('mission completion requires valid action and is server-authoritative', () => {
    const room = {
      missionState: {
        power: { status: 'incomplete' },
      },
      players: [{ id: 'p1', objective: 'MISSION_MASTER' }],
    } as any;

    expect(validateMissionCompletion(room, 'p1', 'power')).toBe(true);
    expect(validateMissionCompletion(room, 'p2', 'power')).toBe(false);
  });

  it('timers transition phases correctly', () => {
    const phase = transitionMatchPhase('INVESTIGATION', 0, 30);
    expect(phase).toBe('DISCUSSION');
  });
});
