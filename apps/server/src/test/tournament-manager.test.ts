import { describe, expect, it } from 'vitest';
import type { ServerEvent } from '@poker/shared';
import { HandEngine } from '../modules/table/service/hand-engine';
import { InMemoryStore } from '../modules/tournament/store/in-memory-store';
import { TournamentManager, type EventSink } from '../modules/tournament/service/tournament-manager';

function setupManager() {
  const store = new InMemoryStore();
  const events: ServerEvent[] = [];
  const sink: EventSink = {
    publishToTournament: (_tournamentId, event) => events.push(event),
    publishToSession: (_sessionId, event) => events.push(event)
  };
  const manager = new TournamentManager(store, new HandEngine(), sink);
  return { manager, store, events };
}

describe('TournamentManager', () => {
  it('creates tournament and starts first hand', () => {
    const { manager, store } = setupManager();

    const created = manager.createTournament({
      name: 't1',
      durationMinutes: 60,
      maxSeats: 9,
      startingStack: 20000,
      botCount: 0
    });

    const p1 = manager.joinPlayer(created.tournamentId, 'alice');
    const p2 = manager.joinPlayer(created.tournamentId, 'bob');

    expect(p1.playerId).not.toBe(p2.playerId);

    manager.startTournament(created.tournamentId);
    const tournament = store.getTournament(created.tournamentId);

    expect(tournament?.status).toBe('running');
    expect(tournament?.currentHand?.id).toBeTruthy();
    expect(tournament?.currentHand?.players.length).toBe(2);
  });

  it('applies valid player action and rotates game', () => {
    const { manager, store } = setupManager();

    const created = manager.createTournament({
      name: 't2',
      durationMinutes: 30,
      maxSeats: 9,
      startingStack: 2000,
      botCount: 0
    });

    const p1 = manager.joinPlayer(created.tournamentId, 'alice');
    const p2 = manager.joinPlayer(created.tournamentId, 'bob');

    manager.startTournament(created.tournamentId);

    const tournament = store.getTournament(created.tournamentId);
    const actorId = tournament?.currentHand?.currentActorId;
    expect(actorId).toBeTruthy();

    const actorSession = actorId === p1.playerId ? p1.sessionId : p2.sessionId;
    manager.applyPlayerAction(created.tournamentId, actorSession, actorId as string, 'fold', 0);

    const updated = store.getTournament(created.tournamentId);
    expect(updated?.handHistory.length).toBeGreaterThan(0);
    expect(updated?.status).toBe('running');
  });

  it('supports unlimited rebuys', () => {
    const { manager, store } = setupManager();

    const created = manager.createTournament({
      name: 't3',
      durationMinutes: 90,
      maxSeats: 9,
      startingStack: 1000,
      botCount: 0
    });

    const p1 = manager.joinPlayer(created.tournamentId, 'alice');
    const tournament = store.getTournament(created.tournamentId);
    const player = tournament?.players.find((item) => item.id === p1.playerId);
    if (!player) {
      throw new Error('expected player');
    }

    player.stack = 0;
    const rebuy1 = manager.rebuy(created.tournamentId, p1.playerId);
    const rebuy2 = manager.rebuy(created.tournamentId, p1.playerId);

    expect(rebuy1.rebuyCount).toBe(1);
    expect(rebuy2.rebuyCount).toBe(2);
    expect(rebuy2.newStack).toBe(2000);
  });

  it('allows same player name to rejoin after tournament start', () => {
    const { manager, store } = setupManager();

    const created = manager.createTournament({
      name: 't4',
      durationMinutes: 60,
      maxSeats: 9,
      startingStack: 2000,
      botCount: 0
    });

    const first = manager.joinPlayer(created.tournamentId, 'alice');
    manager.joinPlayer(created.tournamentId, 'bob');
    manager.startTournament(created.tournamentId);

    manager.onDisconnect(first.sessionId);
    const rejoined = manager.joinPlayer(created.tournamentId, 'alice');
    const tournament = store.getTournament(created.tournamentId);
    const player = tournament?.players.find((item) => item.id === first.playerId);

    expect(rejoined.playerId).toBe(first.playerId);
    expect(rejoined.seatNo).toBe(first.seatNo);
    expect(player?.connected).toBe(true);
  });
});
