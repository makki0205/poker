import { serve } from '@hono/node-server';
import { clientActionSchema, clientPingSchema, type ErrorEvent } from '@poker/shared';
import { createApp } from './app';
import { createContainer } from './bootstrap';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT ?? 8787);

const container = createContainer();
const app = createApp(container.manager);

const server = serve({
  fetch: app.fetch,
  port: PORT
});

const wss = new WebSocketServer({ noServer: true });

interface UpgradeContext {
  sessionId: string;
  tournamentId: string;
}

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`);
  if (url.pathname !== '/ws') {
    socket.destroy();
    return;
  }

  const sessionId = url.searchParams.get('sessionId') ?? '';
  const tournamentId = url.searchParams.get('tournamentId') ?? '';
  const principal = container.manager.getSessionPrincipal(sessionId);

  if (!principal || principal.tournamentId !== tournamentId) {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    (ws as { upgradeContext?: UpgradeContext }).upgradeContext = { sessionId, tournamentId };
    wss.emit('connection', ws, req);
  });
});

wss.on('connection', (ws) => {
  const ctx = (ws as { upgradeContext?: UpgradeContext }).upgradeContext;
  if (!ctx) {
    ws.close();
    return;
  }
  container.hub.registerConnection(ctx.tournamentId, ctx.sessionId, ws);
  container.manager.pushSnapshotToSession(ctx.sessionId);

  ws.on('message', (raw) => {
    try {
      const parsed = JSON.parse(raw.toString());

      const action = clientActionSchema.safeParse(parsed);
      if (action.success) {
        container.manager.applyPlayerAction(
          ctx.tournamentId,
          ctx.sessionId,
          action.data.payload.playerId,
          action.data.payload.action,
          action.data.payload.amount
        );
        return;
      }

      const ping = clientPingSchema.safeParse(parsed);
      if (ping.success) {
        ws.send(
          JSON.stringify({
            type: 'player.pong',
            payload: {
              ts: ping.data.payload.ts
            }
          })
        );
        return;
      }

      throw new Error('BAD_REQUEST');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'BAD_REQUEST';
      const event: ErrorEvent = {
        type: 'error',
        payload: {
          code: message,
          message
        }
      };
      ws.send(JSON.stringify(event));
    }
  });

  ws.on('close', () => {
    container.hub.removeConnection(ctx.sessionId);
    container.manager.onDisconnect(ctx.sessionId);
  });
});

console.log(`Server listening on http://localhost:${PORT}`);
