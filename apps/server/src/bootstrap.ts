import { HandEngine } from './modules/table/service/hand-engine';
import { InMemoryStore } from './modules/tournament/store/in-memory-store';
import { TournamentManager, type EventSink } from './modules/tournament/service/tournament-manager';
import { WebSocketHub } from './platform/websocket/hub';

export interface AppContainer {
  store: InMemoryStore;
  handEngine: HandEngine;
  hub: WebSocketHub;
  manager: TournamentManager;
}

export function createContainer(): AppContainer {
  const store = new InMemoryStore();
  const handEngine = new HandEngine();
  const hub = new WebSocketHub();

  const sink: EventSink = {
    publishToTournament: (tournamentId, event) => hub.broadcastTournament(tournamentId, event),
    publishToSession: (sessionId, event) => hub.sendToSession(sessionId, event)
  };

  const manager = new TournamentManager(store, handEngine, sink);

  return {
    store,
    handEngine,
    hub,
    manager
  };
}
