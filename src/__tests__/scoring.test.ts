import { describe, expect, it } from 'vitest';
import { calculateHandScore, calculateVisibleHandScore } from '../engine/scoring';
import { Card, Rank } from '../engine/types';

function makeCards(ranks: Rank[], faceUpFlags?: boolean[]): Card[] {
  return ranks.map((rank, index) => ({
    id: `test-card-${index}`,
    suit: 'spades',
    rank,
    deckIndex: 0,
    faceUp: faceUpFlags ? (faceUpFlags[index] ?? true) : true,
  }));
}

describe('Hand Scoring Engine (Section 13.1)', () => {
  it('evaluates Ace + 10 as 21 natural blackjack and soft', () => {
    const score = calculateHandScore(makeCards(['A', '10']), false);
    expect(score.total).toBe(21);
    expect(score.isSoft).toBe(true);
    expect(score.isBust).toBe(false);
    expect(score.isNaturalBlackjack).toBe(true);
  });

  it('evaluates Ace + 7 as soft 18', () => {
    const score = calculateHandScore(makeCards(['A', '7']), false);
    expect(score.total).toBe(18);
    expect(score.isSoft).toBe(true);
    expect(score.isBust).toBe(false);
    expect(score.isNaturalBlackjack).toBe(false);
  });

  it('evaluates Ace + 7 + 9 as hard 17', () => {
    const score = calculateHandScore(makeCards(['A', '7', '9']), false);
    expect(score.total).toBe(17);
    expect(score.isSoft).toBe(false);
    expect(score.isBust).toBe(false);
    expect(score.isNaturalBlackjack).toBe(false);
  });

  it('evaluates Ace + Ace as soft 12', () => {
    const score = calculateHandScore(makeCards(['A', 'A']), false);
    expect(score.total).toBe(12);
    expect(score.isSoft).toBe(true);
    expect(score.isBust).toBe(false);
  });

  it('evaluates multiple face cards (K + Q + J) as 30 bust', () => {
    const score = calculateHandScore(makeCards(['K', 'Q', 'J']), false);
    expect(score.total).toBe(30);
    expect(score.isSoft).toBe(false);
    expect(score.isBust).toBe(true);
  });

  it('evaluates 10 + 8 + 5 as 23 bust', () => {
    const score = calculateHandScore(makeCards(['10', '8', '5']), false);
    expect(score.total).toBe(23);
    expect(score.isSoft).toBe(false);
    expect(score.isBust).toBe(true);
  });

  it('evaluates multiple Aces correctly (A + A + A + 8 = 21 soft, A + A + A + 9 = 12 hard)', () => {
    const soft21 = calculateHandScore(makeCards(['A', 'A', 'A', '8']), false);
    expect(soft21.total).toBe(21);
    expect(soft21.isSoft).toBe(true);
    expect(soft21.isNaturalBlackjack).toBe(false);

    const hard12 = calculateHandScore(makeCards(['A', 'A', 'A', '9']), false);
    expect(hard12.total).toBe(12);
    expect(hard12.isSoft).toBe(false);
    expect(hard12.isBust).toBe(false);
  });

  it('distinguishes 21 after split or with 3+ cards from natural blackjack', () => {
    const split21 = calculateHandScore(makeCards(['A', 'K']), true);
    expect(split21.total).toBe(21);
    expect(split21.isNaturalBlackjack).toBe(false);

    const threeCard21 = calculateHandScore(makeCards(['7', '7', '7']), false);
    expect(threeCard21.total).toBe(21);
    expect(threeCard21.isNaturalBlackjack).toBe(false);
  });

  it('calculates visible hand score ignoring face-down hole card', () => {
    const dealerCards = makeCards(['A', 'K'], [true, false]);
    const visible = calculateVisibleHandScore(dealerCards, false);
    expect(visible.total).toBe(11);
    expect(visible.isNaturalBlackjack).toBe(false);
  });
});

