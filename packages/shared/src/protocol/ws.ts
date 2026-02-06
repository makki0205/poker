import { z } from 'zod';
import type { ActionType, Card, TableSnapshot } from '../domain/types';

export interface PlayerActionEvent {
  type: 'player.action';
  payload: {
    handId: string;
    playerId: string;
    action: ActionType;
    amount: number;
  };
}

export interface PlayerPingEvent {
  type: 'player.ping';
  payload: {
    ts: number;
  };
}

export type ClientEvent = PlayerActionEvent | PlayerPingEvent;

export interface TableSnapshotEvent {
  type: 'table.snapshot';
  payload: {
    tournamentId: string;
    status: 'waiting' | 'running' | 'finished';
    table: TableSnapshot;
    you: {
      playerId?: string;
      role: 'player' | 'spectator';
    };
  };
}

export interface HandStartedEvent {
  type: 'hand.started';
  payload: {
    handId: string;
    dealerSeat: number;
    blindLevel: number;
  };
}

export interface ActionAppliedEvent {
  type: 'action.applied';
  payload: {
    handId: string;
    playerId: string;
    action: ActionType;
    amount: number;
    nextActorId: string | null;
  };
}

export interface HandFinishedEvent {
  type: 'hand.finished';
  payload: {
    handId: string;
    winners: string[];
    payouts: Array<{ playerId: string; amount: number }>;
    board: Card[];
    winnerHoleCards: Array<{ playerId: string; cards: Card[] }>;
  };
}

export interface TournamentFinishedEvent {
  type: 'tournament.finished';
  payload: {
    tournamentId: string;
    winnerPlayerId: string;
    rankings: string[];
  };
}

export interface ErrorEvent {
  type: 'error';
  payload: {
    code: string;
    message: string;
  };
}

export type ServerEvent =
  | TableSnapshotEvent
  | HandStartedEvent
  | ActionAppliedEvent
  | HandFinishedEvent
  | TournamentFinishedEvent
  | ErrorEvent;

export const clientActionSchema = z.object({
  type: z.literal('player.action'),
  payload: z.object({
    handId: z.string().min(1),
    playerId: z.string().min(1),
    action: z.union([
      z.literal('fold'),
      z.literal('check'),
      z.literal('call'),
      z.literal('bet'),
      z.literal('raise'),
      z.literal('allin')
    ]),
    amount: z.number().int().min(0)
  })
});

export const clientPingSchema = z.object({
  type: z.literal('player.ping'),
  payload: z.object({
    ts: z.number().int()
  })
});
