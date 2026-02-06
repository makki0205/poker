import { createTournamentSchema, joinSchema, rebuySchema } from '@poker/shared';
import { Hono } from 'hono';
import type { TournamentManager } from '../../modules/tournament/service/tournament-manager';

function toStatusCode(errorMessage: string): 400 | 401 | 404 | 409 {
  if (errorMessage === 'NOT_FOUND') {
    return 404;
  }
  if (errorMessage === 'UNAUTHORIZED') {
    return 401;
  }
  if (errorMessage === 'TABLE_FULL') {
    return 409;
  }
  if (errorMessage === 'INVALID_STATE') {
    return 409;
  }
  if (errorMessage.includes('not found')) {
    return 404;
  }
  return 400;
}

function extractError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'BAD_REQUEST';
}

export function registerRoutes(app: Hono, manager: TournamentManager): void {
  app.get('/api/v1/health', (c) => c.json({ status: 'ok' }));

  app.post('/api/v1/tournaments', async (c) => {
    try {
      const parsed = createTournamentSchema.parse(await c.req.json());
      const created = manager.createTournament(parsed);
      return c.json(created, 201);
    } catch (error) {
      const message = extractError(error);
      return c.json({ code: 'BAD_REQUEST', message }, toStatusCode(message));
    }
  });

  app.get('/api/v1/tournaments/:tournamentId', (c) => {
    try {
      const detail = manager.getTournamentSummary(c.req.param('tournamentId'));
      return c.json(detail);
    } catch (error) {
      const message = extractError(error);
      return c.json({ code: message, message }, toStatusCode(message));
    }
  });

  app.post('/api/v1/tournaments/:tournamentId/join', async (c) => {
    try {
      const parsed = joinSchema.parse(await c.req.json());
      const result = manager.joinPlayer(c.req.param('tournamentId'), parsed.name);
      return c.json(result);
    } catch (error) {
      const message = extractError(error);
      return c.json({ code: message, message }, toStatusCode(message));
    }
  });

  app.post('/api/v1/tournaments/:tournamentId/spectators', async (c) => {
    try {
      const parsed = joinSchema.parse(await c.req.json());
      const result = manager.joinSpectator(c.req.param('tournamentId'), parsed.name);
      return c.json(result);
    } catch (error) {
      const message = extractError(error);
      return c.json({ code: message, message }, toStatusCode(message));
    }
  });

  app.post('/api/v1/tournaments/:tournamentId/start', (c) => {
    try {
      const result = manager.startTournament(c.req.param('tournamentId'));
      return c.json(result);
    } catch (error) {
      const message = extractError(error);
      return c.json({ code: message, message }, toStatusCode(message));
    }
  });

  app.post('/api/v1/tournaments/:tournamentId/rebuys', async (c) => {
    try {
      const parsed = rebuySchema.parse(await c.req.json());
      const result = manager.rebuy(c.req.param('tournamentId'), parsed.playerId);
      return c.json(result);
    } catch (error) {
      const message = extractError(error);
      return c.json({ code: message, message }, toStatusCode(message));
    }
  });

  app.get('/api/v1/tournaments/:tournamentId/hands', (c) => {
    try {
      const limit = Math.max(1, Math.min(100, Number(c.req.query('limit') ?? '20')));
      const cursor = c.req.query('cursor') ?? undefined;
      const result = manager.getHands(c.req.param('tournamentId'), limit, cursor);
      return c.json(result);
    } catch (error) {
      const message = extractError(error);
      return c.json({ code: message, message }, toStatusCode(message));
    }
  });
}
