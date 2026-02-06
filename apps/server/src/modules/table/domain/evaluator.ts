import type { Card } from '@poker/shared';

export interface HandRank {
  category: number;
  values: number[];
}

function countByRank(cards: Card[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const card of cards) {
    map.set(card.rank, (map.get(card.rank) ?? 0) + 1);
  }
  return map;
}

function sortedUniqueRanksDesc(cards: Card[]): number[] {
  return [...new Set(cards.map((card) => card.rank))].sort((a, b) => b - a);
}

function findStraightHigh(ranksDesc: number[]): number | null {
  const ranks = [...ranksDesc];
  if (ranks.includes(14)) {
    ranks.push(1);
  }

  let run = 1;
  for (let i = 1; i < ranks.length; i += 1) {
    const prev = ranks[i - 1];
    const current = ranks[i];
    if (prev === undefined || current === undefined) {
      continue;
    }

    if (prev === current + 1) {
      run += 1;
      if (run >= 5) {
        return ranks[i - 4] as number;
      }
    } else if (prev !== current) {
      run = 1;
    }
  }
  return null;
}

function evaluateFive(cards: Card[]): HandRank {
  const byRank = countByRank(cards);
  const rankEntries = [...byRank.entries()].sort((a, b) => {
    if (b[1] !== a[1]) {
      return b[1] - a[1];
    }
    return b[0] - a[0];
  });

  const isFlush = cards.every((card) => card.suit === cards[0]?.suit);
  const ranksDesc = sortedUniqueRanksDesc(cards);
  const straightHigh = findStraightHigh(ranksDesc);

  if (isFlush && straightHigh !== null) {
    return { category: 8, values: [straightHigh] };
  }

  if (rankEntries[0]?.[1] === 4) {
    const four = rankEntries[0][0];
    const kicker = rankEntries[1]?.[0] ?? 0;
    return { category: 7, values: [four, kicker] };
  }

  if (rankEntries[0]?.[1] === 3 && rankEntries[1]?.[1] === 2) {
    return { category: 6, values: [rankEntries[0][0], rankEntries[1][0]] };
  }

  if (isFlush) {
    const flushValues = cards.map((card) => card.rank).sort((a, b) => b - a);
    return { category: 5, values: flushValues };
  }

  if (straightHigh !== null) {
    return { category: 4, values: [straightHigh] };
  }

  if (rankEntries[0]?.[1] === 3) {
    const trips = rankEntries[0][0];
    const kickers = rankEntries
      .slice(1)
      .map((entry) => entry[0])
      .sort((a, b) => b - a)
      .slice(0, 2);
    return { category: 3, values: [trips, ...kickers] };
  }

  if (rankEntries[0]?.[1] === 2 && rankEntries[1]?.[1] === 2) {
    const pairA = Math.max(rankEntries[0][0], rankEntries[1][0]);
    const pairB = Math.min(rankEntries[0][0], rankEntries[1][0]);
    const kicker = rankEntries.find((entry) => entry[1] === 1)?.[0] ?? 0;
    return { category: 2, values: [pairA, pairB, kicker] };
  }

  if (rankEntries[0]?.[1] === 2) {
    const pair = rankEntries[0][0];
    const kickers = rankEntries
      .filter((entry) => entry[1] === 1)
      .map((entry) => entry[0])
      .sort((a, b) => b - a)
      .slice(0, 3);
    return { category: 1, values: [pair, ...kickers] };
  }

  return {
    category: 0,
    values: cards.map((card) => card.rank).sort((a, b) => b - a)
  };
}

function compareValues(a: number[], b: number[]): number {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av !== bv) {
      return av > bv ? 1 : -1;
    }
  }
  return 0;
}

export function compareHandRank(a: HandRank, b: HandRank): number {
  if (a.category !== b.category) {
    return a.category > b.category ? 1 : -1;
  }
  return compareValues(a.values, b.values);
}

function chooseFive(cards: Card[]): Card[][] {
  const results: Card[][] = [];
  for (let i = 0; i < cards.length - 4; i += 1) {
    for (let j = i + 1; j < cards.length - 3; j += 1) {
      for (let k = j + 1; k < cards.length - 2; k += 1) {
        for (let l = k + 1; l < cards.length - 1; l += 1) {
          for (let m = l + 1; m < cards.length; m += 1) {
            results.push([cards[i], cards[j], cards[k], cards[l], cards[m]] as Card[]);
          }
        }
      }
    }
  }
  return results;
}

export function evaluateBestHand(cards: Card[]): HandRank {
  if (cards.length < 5) {
    throw new Error('At least 5 cards are required');
  }
  let best = evaluateFive(cards.slice(0, 5));
  const combos = chooseFive(cards);
  for (const combo of combos) {
    const rank = evaluateFive(combo);
    if (compareHandRank(rank, best) > 0) {
      best = rank;
    }
  }
  return best;
}
