import { describe, expect, it } from 'vitest';
import type { ServerEvent } from '@poker/shared';
import { createApp } from '../app';
import { HandEngine } from '../modules/table/service/hand-engine';
import { InMemoryStore } from '../modules/tournament/store/in-memory-store';
import { TournamentManager, type EventSink } from '../modules/tournament/service/tournament-manager';

function createTestApp() {
  const store = new InMemoryStore();
  const sink: EventSink = {
    publishToTournament: (_id, _event: ServerEvent) => undefined,
    publishToSession: (_id, _event: ServerEvent) => undefined
  };
  const manager = new TournamentManager(store, new HandEngine(), sink);
  return createApp(manager);
}

describe('HTTP routes', () => {
  it('returns CORS headers for API preflight', async () => {
    const app = createTestApp();

    const res = await app.request('/api/v1/tournaments', {
      method: 'OPTIONS',
      headers: {
        origin: 'http://localhost:5173',
        'access-control-request-method': 'POST'
      }
    });

    expect([200, 204]).toContain(res.status);
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
  });

  it('creates tournament and joins players through API', async () => {
    const app = createTestApp();

    const createRes = await app.request('/api/v1/tournaments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'daily',
        durationMinutes: 60,
        maxSeats: 9,
        startingStack: 20000,
        botCount: 2
      })
    });

    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { tournamentId: string };

    const joinRes = await app.request(`/api/v1/tournaments/${created.tournamentId}/join`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'alice' })
    });

    expect(joinRes.status).toBe(200);

    const startRes = await app.request(`/api/v1/tournaments/${created.tournamentId}/start`, {
      method: 'POST'
    });

    expect(startRes.status).toBe(200);
    const started = (await startRes.json()) as { status: string };
    expect(started.status).toBe('running');
  });
});
