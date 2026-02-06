import type { ServerEvent } from '@poker/shared';
import type WebSocket from 'ws';

interface Connection {
  tournamentId: string;
  sessionId: string;
  socket: WebSocket;
}

export class WebSocketHub {
  private connections = new Map<string, Connection>();

  registerConnection(tournamentId: string, sessionId: string, socket: WebSocket): void {
    this.connections.set(sessionId, { tournamentId, sessionId, socket });
  }

  removeConnection(sessionId: string): void {
    this.connections.delete(sessionId);
  }

  sendToSession(sessionId: string, event: ServerEvent): void {
    const conn = this.connections.get(sessionId);
    if (!conn) {
      return;
    }
    if (conn.socket.readyState === conn.socket.OPEN) {
      conn.socket.send(JSON.stringify(event));
    }
  }

  broadcastTournament(tournamentId: string, event: ServerEvent): void {
    for (const conn of this.connections.values()) {
      if (conn.tournamentId !== tournamentId) {
        continue;
      }
      if (conn.socket.readyState === conn.socket.OPEN) {
        conn.socket.send(JSON.stringify(event));
      }
    }
  }
}
