import type { ActionType, Card } from '@poker/shared';
import { evaluateBestHand } from '../table/domain/evaluator';
import type { TournamentModel } from '../tournament/domain/model';

export interface BotDecision {
  action: ActionType;
  amount: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function estimatePreflopStrength(holeCards: Card[]): number {
  const [a, b] = holeCards.slice().sort((x, y) => y.rank - x.rank);
  if (!a || !b) {
    return 0;
  }

  let score = 20 + a.rank + b.rank;
  if (a.rank === b.rank) {
    score += 24 + a.rank;
  }
  if (a.suit === b.suit) {
    score += 5;
  }

  const gap = Math.abs(a.rank - b.rank);
  if (gap <= 1) {
    score += 4;
  } else if (gap === 2) {
    score += 2;
  }

  if (a.rank >= 13) {
    score += 6;
  }
  if (a.rank === 14 && b.rank >= 10) {
    score += 6;
  }

  return clamp(score, 0, 100);
}

function estimatePostflopStrength(holeCards: Card[], board: Card[]): number {
  const rank = evaluateBestHand([...holeCards, ...board]);
  const top = rank.values[0] ?? 0;
  return clamp(rank.category * 12 + top, 0, 100);
}

function estimateStrength(holeCards: Card[], board: Card[]): number {
  if (board.length === 0) {
    return estimatePreflopStrength(holeCards);
  }
  return estimatePostflopStrength(holeCards, board);
}

function randomChance(threshold: number): boolean {
  return Math.random() < threshold;
}

function pickRaiseAmount(
  stack: number,
  contributionRound: number,
  minRaiseTo: number,
  strength: number
): number {
  const maxTo = contributionRound + stack;
  if (maxTo < minRaiseTo) {
    return maxTo;
  }

  const span = maxTo - minRaiseTo;
  const strengthFactor = clamp((strength - 45) / 55, 0, 1);
  const extra = Math.floor(span * (0.15 + strengthFactor * 0.35));
  return clamp(minRaiseTo + extra, minRaiseTo, maxTo);
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

  const strength = estimateStrength(handPlayer.holeCards, hand.board);
  const pressure = toCall / Math.max(1, stack);
  const maxTo = handPlayer.contributionRound + stack;
  const canRaise = maxTo >= hand.minRaiseTo;
  const shortStack = stack <= Math.max(1, Math.floor((hand.minRaiseTo - hand.currentBet) * 2));

  // If calling is all-in, avoid punting weak hands.
  if (!canCheck && toCall >= stack) {
    if (strength >= 72 || (strength >= 58 && randomChance(0.25))) {
      return { action: 'call', amount: 0 };
    }
    return { action: 'fold', amount: 0 };
  }

  if (canCheck) {
    if (strength >= 78) {
      if (shortStack && randomChance(0.18)) {
        return { action: 'allin', amount: 0 };
      }
      if (randomChance(0.72)) {
        return {
          action: 'bet',
          amount: pickRaiseAmount(stack, handPlayer.contributionRound, hand.minRaiseTo, strength)
        };
      }
      return { action: 'check', amount: 0 };
    }

    if (strength >= 56) {
      if (randomChance(0.42)) {
        return {
          action: 'bet',
          amount: pickRaiseAmount(stack, handPlayer.contributionRound, hand.minRaiseTo, strength)
        };
      }
      return { action: 'check', amount: 0 };
    }

    if (strength >= 40 && randomChance(0.16)) {
      return {
        action: 'bet',
        amount: pickRaiseAmount(stack, handPlayer.contributionRound, hand.minRaiseTo, strength)
      };
    }

    return { action: 'check', amount: 0 };
  }

  if (strength < 30) {
    if (pressure <= 0.12 && randomChance(0.35)) {
      return { action: 'call', amount: 0 };
    }
    return { action: 'fold', amount: 0 };
  }

  if (strength < 50) {
    if (pressure > 0.32) {
      return { action: 'fold', amount: 0 };
    }
    return randomChance(0.78) ? { action: 'call', amount: 0 } : { action: 'fold', amount: 0 };
  }

  if (strength < 70) {
    if (canRaise && pressure < 0.28 && randomChance(0.22)) {
      return {
        action: 'raise',
        amount: pickRaiseAmount(stack, handPlayer.contributionRound, hand.minRaiseTo, strength)
      };
    }
    return { action: 'call', amount: 0 };
  }

  if (canRaise && randomChance(0.45)) {
    return {
      action: 'raise',
      amount: pickRaiseAmount(stack, handPlayer.contributionRound, hand.minRaiseTo, strength)
    };
  }

  if (shortStack && strength >= 84 && pressure >= 0.45 && randomChance(0.2)) {
    return { action: 'allin', amount: 0 };
  }

  return { action: 'call', amount: 0 };
}
