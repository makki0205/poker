import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { registerRoutes } from './platform/http/routes';
import type { TournamentManager } from './modules/tournament/service/tournament-manager';

export function createApp(manager: TournamentManager): Hono {
  const app = new Hono();
  const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(
    '/api/*',
    cors({
      origin: corsOrigins,
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
      exposeHeaders: ['Content-Length']
    })
  );

  app.get('/', (c) => c.text('Poker tournament server is running'));

  registerRoutes(app, manager);

  return app;
}
