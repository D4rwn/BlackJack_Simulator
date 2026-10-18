import { Card, Rank, RandomSource, ShoeState, Suit, TableRules } from './types';

export const SUITS: readonly Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];

export const RANKS: readonly Rank[] = [
  'A',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
];

export const CARDS_PER_DECK = 52;
export const MIN_DECKS = 1;
export const MAX_DECKS = 8;

/**
 * Cryptographically strong uniform random number generator returning [0, 1).
 * Falls back to Math.random only if crypto is unavailable.
 */
export const defaultRandomSource: RandomSource = (): number => {
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    const array = new Uint32Array(1);
    globalThis.crypto.getRandomValues(array);
    return array[0] / (0xffffffff + 1);
  }
  return Math.random();
};

/**
 * Creates a single 52-card deck with unique physical IDs.
 */
export function createSingleDeck(deckIndex: number): Card[] {
  const cards: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push({
        id: `deck-${deckIndex}-${suit}-${rank}`,
        suit,
        rank,
        deckIndex,
        faceUp: true,
      });
    }
  }
  return cards;
}

/**
 * Creates an unshuffled multi-deck shoe for the given number of decks (1 to 8).
 */
export function createUnshuffledCards(deckCount: number): Card[] {
  if (!Number.isInteger(deckCount) || deckCount < MIN_DECKS || deckCount > MAX_DECKS) {
    throw new Error(`Invalid deck count: ${deckCount}. Must be an integer between ${MIN_DECKS} and ${MAX_DECKS}.`);
  }

  const allCards: Card[] = [];
  for (let i = 0; i < deckCount; i++) {
    allCards.push(...createSingleDeck(i));
  }
  return allCards;
}

/**
 * Uniform Fisher-Yates shuffle returning a new array of cards.
 */
export function shuffleCards(
  cards: readonly Card[],
  rng: RandomSource = defaultRandomSource
): Card[] {
  const copy = cards.map((card) => ({ ...card }));
  for (let i = copy.length - 1; i > 0; i--) {
    const randomValue = rng();
    const clamped = Math.max(0, Math.min(0.999999999999, randomValue));
    const j = Math.floor(clamped * (i + 1));
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}

/**
 * Creates a fresh shuffled ShoeState for the specified deck count.
 */
export function createShoe(
  deckCount: number,
  rng: RandomSource = defaultRandomSource,
  previousReshuffleCount = 0
): ShoeState {
  const unshuffled = createUnshuffledCards(deckCount);
  const shuffled = shuffleCards(unshuffled, rng);
  return {
    cards: shuffled,
    totalCards: shuffled.length,
    cutCardReached: false,
    reshuffleCount: previousReshuffleCount,
  };
}

/**
 * Checks whether the shoe has reached or passed the penetration cut point.
 * For example, with penetration = 0.75, reshuffle is needed when <= 25% of cards remain.
 */
export function isCutCardReached(shoe: ShoeState, penetration: number): boolean {
  const clampedPenetration = Math.max(0.1, Math.min(0.95, penetration));
  const dealtCards = shoe.totalCards - shoe.cards.length;
  const dealtFraction = shoe.totalCards > 0 ? dealtCards / shoe.totalCards : 1;
  return dealtFraction >= clampedPenetration || shoe.cards.length < 6;
}

/**
 * Draws a single card from the top of the shoe without replacement.
 * Updates cutCardReached flag when penetration threshold is crossed.
 */
export function drawCardFromShoe(
  shoe: ShoeState,
  rules: Pick<TableRules, 'deckCount' | 'penetration'>,
  faceUp = true
): { card: Card; nextShoe: ShoeState } {
  if (shoe.cards.length === 0) {
    throw new Error('Cannot draw from an empty shoe.');
  }

  const [rawCard, ...remainingCards] = shoe.cards;
  const card: Card = {
    ...rawCard,
    faceUp,
  };

  const tempShoe: ShoeState = {
    ...shoe,
    cards: remainingCards,
  };

  const cutCardReached =
    shoe.cutCardReached || isCutCardReached(tempShoe, rules.penetration);

  return {
    card,
    nextShoe: {
      ...tempShoe,
      cutCardReached,
    },
  };
}

/**
 * Reshuffles the shoe ONLY between rounds if the cut card has been reached
 * or if deck count changed.
 */
export function ensureShoeReadyForNewRound(
  shoe: ShoeState,
  rules: Pick<TableRules, 'deckCount' | 'penetration'>,
  rng: RandomSource = defaultRandomSource
): ShoeState {
  const expectedTotal = rules.deckCount * CARDS_PER_DECK;
  const needsReshuffle =
    shoe.totalCards !== expectedTotal ||
    shoe.cutCardReached ||
    isCutCardReached(shoe, rules.penetration);

  if (!needsReshuffle) {
    return shoe;
  }

  return createShoe(rules.deckCount, rng, shoe.reshuffleCount + 1);
}
