import type { Card } from '@poker/shared';
import { describe, expect, it, vi } from 'vitest';
import { chooseBotAction } from '../modules/bot/bot-strategy';
import type { TournamentModel } from '../modules/tournament/domain/model';

function c(rank: number, suit: Card['suit']): Card {
  return { rank, suit };
}

function buildTournament(input: {
  stack: number;
  currentBet: number;
  contributionRound: number;
  minRaiseTo: number;
  holeCards: Card[];
  board?: Card[];
}): TournamentModel {
  return {
    id: 'trn_test',
    name: 'test',
    status: 'running',
    durationMinutes: 60,
    maxSeats: 9,
    startingStack: 2000,
    blindLevel: 1,
    createdAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    dealerSeatNo: 1,
    players: [
      {
        id: 'bot_1',
        name: 'Bot-1',
        seatNo: 1,
        isBot: true,
        stack: input.stack,
        status: 'active',
        rebuyCount: 0,
        connected: true
      },
      {
        id: 'pl_2',
        name: 'Villain',
        seatNo: 2,
        isBot: false,
        stack: 4000,
        status: 'active',
        rebuyCount: 0,
        connected: true
      }
    ],
    spectators: [],
    handHistory: [],
    ranking: [],
    currentHand: {
      id: 'h_1',
      startedAt: new Date().toISOString(),
      dealerSeatNo: 1,
      blindLevel: 1,
      phase: 'preflop',
      board: input.board ?? [],
      pot: 300,
      currentBet: input.currentBet,
      minRaiseTo: input.minRaiseTo,
      currentActorId: 'bot_1',
      deck: [],
      actionHistory: [],
      players: [
        {
          playerId: 'bot_1',
          seatNo: 1,
          holeCards: input.holeCards,
          contributionTotal: input.contributionRound,
          contributionRound: input.contributionRound,
          hasFolded: false,
          isAllIn: false,
          acted: false
        },
        {
          playerId: 'pl_2',
          seatNo: 2,
          holeCards: [c(14, 'h'), c(13, 'h')],
          contributionTotal: input.currentBet,
          contributionRound: input.currentBet,
          hasFolded: false,
          isAllIn: false,
          acted: true
        }
      ]
    }
  };
}

describe('chooseBotAction', () => {
  it('folds weak hand when calling would be all-in', () => {
    const tournament = buildTournament({
      stack: 120,
      currentBet: 200,
      contributionRound: 0,
      minRaiseTo: 400,
      holeCards: [c(2, 'c'), c(7, 'd')]
    });

    const action = chooseBotAction(tournament, 'bot_1');
    expect(action.action).toBe('fold');
  });

  it('calls strong hand when calling would be all-in', () => {
    const tournament = buildTournament({
      stack: 120,
      currentBet: 200,
      contributionRound: 0,
      minRaiseTo: 400,
      holeCards: [c(14, 'c'), c(14, 'd')]
    });

    const action = chooseBotAction(tournament, 'bot_1');
    expect(action.action).toBe('call');
  });

  it('checks weak hand in free action spot (no random punt all-in)', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99);

    const tournament = buildTournament({
      stack: 2500,
      currentBet: 0,
      contributionRound: 0,
      minRaiseTo: 200,
      holeCards: [c(2, 'c'), c(7, 'd')]
    });

    const action = chooseBotAction(tournament, 'bot_1');
    expect(action.action).toBe('check');

    randomSpy.mockRestore();
  });

  it('bets strong hand in free action spot', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.1);

    const tournament = buildTournament({
      stack: 2500,
      currentBet: 0,
      contributionRound: 0,
      minRaiseTo: 200,
      holeCards: [c(14, 's'), c(14, 'h')]
    });

    const action = chooseBotAction(tournament, 'bot_1');
    expect(action.action).toBe('bet');
    expect(action.amount).toBeGreaterThanOrEqual(200);

    randomSpy.mockRestore();
  });
});
