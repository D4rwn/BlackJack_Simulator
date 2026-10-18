import { Card, HandScore, Rank } from './types';

/**
 * Returns the base numeric value of a rank (Ace returns 11 initially; adjustment happens at hand evaluation).
 */
export function getRankValue(rank: Rank): number {
  switch (rank) {
    case 'A':
      return 11;
    case 'K':
    case 'Q':
    case 'J':
    case '10':
      return 10;
    default:
      return Number(rank);
  }
}

/**
 * Evaluates a hand of cards according to standard casino Blackjack rules.
 *
 * - Aces count as 11 unless that would cause the hand total to exceed 21, in which case they count as 1.
 * - A hand is "soft" (isSoft = true) if and only if at least one Ace is actively counted as 11 and total <= 21.
 * - A hand is a "natural blackjack" if and only if it has exactly 2 cards totaling 21 and did not result from a split.
 */
export function calculateHandScore(
  cards: readonly Pick<Card, 'rank'>[],
  isFromSplit = false
): HandScore {
  let total = 0;
  let softAces = 0;

  for (const card of cards) {
    const value = getRankValue(card.rank);
    total += value;
    if (card.rank === 'A') {
      softAces += 1;
    }
  }

  while (total > 21 && softAces > 0) {
    total -= 10;
    softAces -= 1;
  }

  const isBust = total > 21;
  const isSoft = !isBust && softAces > 0;
  const isNaturalBlackjack =
    cards.length === 2 && total === 21 && !isFromSplit;

  return {
    total,
    isSoft,
    isBust,
    isNaturalBlackjack,
  };
}

/**
 * Calculates the score of only the face-up cards in a hand (e.g. dealer's visible upcard before hole card reveal).
 */
export function calculateVisibleHandScore(
  cards: readonly Card[],
  isFromSplit = false
): HandScore {
  const visibleCards = cards.filter((card) => card.faceUp);
  const allCardsVisible = visibleCards.length === cards.length;
  return calculateHandScore(
    visibleCards,
    isFromSplit || !allCardsVisible
  );
}
