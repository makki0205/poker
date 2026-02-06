import type { Card } from '@poker/shared';

const suits: Array<Card['suit']> = ['c', 'd', 'h', 's'];
const ranks = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

export function createDeck(): Card[] {
  const cards: Card[] = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      cards.push({ rank, suit });
    }
  }
  return cards;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const cards = [...deck];
  for (let i = cards.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = cards[i];
    cards[i] = cards[j] as Card;
    cards[j] = tmp as Card;
  }
  return cards;
}

export function deal(deck: Card[], count: number): Card[] {
  if (deck.length < count) {
    throw new Error('Deck does not have enough cards');
  }
  return deck.splice(0, count);
}
