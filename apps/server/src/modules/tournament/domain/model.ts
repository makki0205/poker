import type { ActionType, Card, HandPhase, PlayerStatus, TournamentStatus } from '@poker/shared';

export interface PlayerModel {
  id: string;
  name: string;
  seatNo: number;
  isBot: boolean;
  stack: number;
  status: PlayerStatus;
  rebuyCount: number;
  connected: boolean;
}

export interface SpectatorModel {
  id: string;
  name: string;
}

export interface HandPlayerState {
  playerId: string;
  seatNo: number;
  holeCards: Card[];
  contributionTotal: number;
  contributionRound: number;
  hasFolded: boolean;
  isAllIn: boolean;
  acted: boolean;
}

export interface ActionHistoryItem {
  playerId: string;
  action: ActionType;
  amount: number;
  phase: HandPhase;
  at: string;
}

export interface HandModel {
  id: string;
  startedAt: string;
  finishedAt?: string;
  dealerSeatNo: number;
  blindLevel: number;
  phase: HandPhase;
  board: Card[];
  pot: number;
  currentBet: number;
  minRaiseTo: number;
  currentActorId: string | null;
  deck: Card[];
  players: HandPlayerState[];
  actionHistory: ActionHistoryItem[];
  payouts?: Array<{ playerId: string; amount: number }>;
  winners?: string[];
}

export interface TournamentModel {
  id: string;
  name: string;
  status: TournamentStatus;
  durationMinutes: 30 | 60 | 90;
  maxSeats: number;
  startingStack: number;
  blindLevel: number;
  blindStartedAt?: string;
  createdAt: string;
  startedAt?: string;
  dealerSeatNo: number;
  players: PlayerModel[];
  spectators: SpectatorModel[];
  currentHand: HandModel | null;
  handHistory: HandModel[];
  ranking: string[];
}

export interface SessionModel {
  sessionId: string;
  tournamentId: string;
  role: 'player' | 'spectator';
  playerId?: string;
  spectatorId?: string;
}
