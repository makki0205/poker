import type { ActionType } from '@poker/shared';
import type { TournamentModel } from '../tournament/domain/model';

export interface BotDecision {
  action: ActionType;
  amount: number;
}

function randomChoice<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)] as T;
}

export function chooseBotAction(tournament: TournamentModel, playerId: string): BotDecision {
  const hand = tournament.currentHand;
  if (!hand) {
    return { action: 'check', amount: 0 };
  }

  const handPlayer = hand.players.find((player) => player.playerId === playerId);
  const player = tournament.players.find((item) => item.id === playerId);
  if (!handPlayer || !player) {
    return { action: 'check', amount: 0 };
  }

  const toCall = Math.max(0, hand.currentBet - handPlayer.contributionRound);
  const stack = player.stack;
  const canCheck = toCall === 0;

  if (stack <= 0) {
    return { action: 'check', amount: 0 };
  }

  if (!canCheck && toCall >= stack) {
    return { action: 'allin', amount: 0 };
  }

  if (canCheck) {
    const pick = randomChoice(['check', 'bet', 'allin'] as const);
    if (pick === 'check') {
      return { action: 'check', amount: 0 };
    }
    if (pick === 'bet') {
      const target = Math.min(stack, Math.max(1, Math.floor(stack * 0.25)));
      return { action: 'bet', amount: target };
    }
    return { action: 'allin', amount: 0 };
  }

  const pick = randomChoice(['fold', 'call', 'raise', 'allin'] as const);
  if (pick === 'fold') {
    return { action: 'fold', amount: 0 };
  }
  if (pick === 'call') {
    return { action: 'call', amount: 0 };
  }
  if (pick === 'raise') {
    const raiseTo = Math.min(stack + handPlayer.contributionRound, hand.minRaiseTo);
    if (raiseTo <= hand.currentBet) {
      return { action: 'call', amount: 0 };
    }
    return { action: 'raise', amount: raiseTo };
  }

  return { action: 'allin', amount: 0 };
}
