export type TournamentStatus = 'waiting' | 'running' | 'finished';
export type PlayerStatus = 'active' | 'busted' | 'folded' | 'allin' | 'disconnected';
export type Role = 'player' | 'spectator';
export type HandPhase = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

export type ActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin';

export interface Card {
  rank: number;
  suit: 'c' | 'd' | 'h' | 's';
}

export interface SeatView {
  seatNo: number;
  playerId: string;
  name: string;
  isBot: boolean;
  stack: number;
  status: PlayerStatus;
  isDealer: boolean;
  currentBet: number;
  hasFolded: boolean;
  isAllIn: boolean;
  holeCards: Card[] | null;
}

export interface TableSnapshot {
  tournamentId: string;
  status: TournamentStatus;
  handId: string | null;
  phase: HandPhase | null;
  pot: number;
  board: Card[];
  blindLevel: number;
  seats: SeatView[];
  currentActorId: string | null;
  minRaiseTo: number | null;
  lastAction?: {
    playerId: string;
    action: ActionType;
    amount: number;
  };
}

export interface SessionPrincipal {
  sessionId: string;
  tournamentId: string;
  role: Role;
  playerId?: string;
  spectatorId?: string;
}

export interface HandHistoryItem {
  handId: string;
  startedAt: string;
  finishedAt: string;
  board: Card[];
  winners: string[];
  payouts: Array<{ playerId: string; amount: number }>;
}
