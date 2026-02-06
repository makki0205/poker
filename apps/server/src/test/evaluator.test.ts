import { describe, expect, it } from 'vitest';
import type { Card } from '@poker/shared';
import { compareHandRank, evaluateBestHand } from '../modules/table/domain/evaluator';

function c(rank: number, suit: Card['suit']): Card {
  return { rank, suit };
}

describe('evaluateBestHand', () => {
  it('detects straight flush over lower hands', () => {
    const sf = evaluateBestHand([c(10, 'h'), c(11, 'h'), c(12, 'h'), c(13, 'h'), c(14, 'h'), c(2, 'c'), c(3, 'd')]);
    const fh = evaluateBestHand([c(14, 'c'), c(14, 'd'), c(14, 'h'), c(13, 'c'), c(13, 'd'), c(2, 's'), c(3, 's')]);
    expect(compareHandRank(sf, fh)).toBeGreaterThan(0);
  });

  it('handles wheel straight', () => {
    const wheel = evaluateBestHand([c(14, 's'), c(2, 'd'), c(3, 'h'), c(4, 'c'), c(5, 's'), c(9, 'd'), c(13, 'h')]);
    const pair = evaluateBestHand([c(11, 's'), c(11, 'd'), c(3, 'h'), c(4, 'c'), c(6, 's'), c(9, 'd'), c(13, 'h')]);
    expect(compareHandRank(wheel, pair)).toBeGreaterThan(0);
  });

  it('splits ties with equal rank comparison', () => {
    const a = evaluateBestHand([c(14, 's'), c(14, 'd'), c(13, 'h'), c(12, 'h'), c(11, 'c'), c(3, 'd'), c(2, 's')]);
    const b = evaluateBestHand([c(14, 'c'), c(14, 'h'), c(13, 'd'), c(12, 'd'), c(11, 's'), c(4, 'c'), c(3, 'h')]);
    expect(compareHandRank(a, b)).toBe(0);
  });
});
