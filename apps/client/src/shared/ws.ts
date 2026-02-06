import type { ClientEvent, ServerEvent } from '@poker/shared';

const WS_BASE = import.meta.env.VITE_WS_BASE ?? 'ws://localhost:8787/ws';

export interface TournamentSocket {
  send(event: ClientEvent): void;
  close(): void;
}

export function connectTournamentSocket(
  tournamentId: string,
  sessionId: string,
  onEvent: (event: ServerEvent) => void,
  onError: (message: string) => void
): TournamentSocket {
  const url = new URL(WS_BASE);
  url.searchParams.set('tournamentId', tournamentId);
  url.searchParams.set('sessionId', sessionId);

  const ws = new WebSocket(url.toString());

  ws.onmessage = (message) => {
    try {
      const parsed = JSON.parse(String(message.data)) as ServerEvent;
      onEvent(parsed);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to parse ws message');
    }
  };

  ws.onerror = () => {
    onError('WebSocket connection error');
  };

  return {
    send(event: ClientEvent) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(event));
      }
    },
    close() {
      ws.close();
    }
  };
}
