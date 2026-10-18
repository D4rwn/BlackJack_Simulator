import { describe, expect, it } from 'vitest';
import {
  createShoe,
  createSingleDeck,
  createUnshuffledCards,
  drawCardFromShoe,
  ensureShoeReadyForNewRound,
  isCutCardReached,
} from '../engine/deck';

describe('Deck and Shoe Engine (Section 13.2)', () => {
  it('creates a single deck with exactly 52 unique cards (4 suits x 13 ranks)', () => {
    const deck = createSingleDeck(0);
    expect(deck).toHaveLength(52);
    const uniqueIds = new Set(deck.map((c) => c.id));
    expect(uniqueIds.size).toBe(52);
  });

  it('creates 6-deck (312 cards) and 8-deck (416 cards) shoes with zero duplicate physical cards', () => {
    const shoe6 = createShoe(6);
    expect(shoe6.cards).toHaveLength(312);
    expect(shoe6.totalCards).toBe(312);
    expect(new Set(shoe6.cards.map((c) => c.id)).size).toBe(312);

    const shoe8 = createShoe(8);
    expect(shoe8.cards).toHaveLength(416);
    expect(shoe8.totalCards).toBe(416);
    expect(new Set(shoe8.cards.map((c) => c.id)).size).toBe(416);
  });

  it('rejects invalid deck counts outside [1, 8]', () => {
    expect(() => createUnshuffledCards(0)).toThrow();
    expect(() => createUnshuffledCards(9)).toThrow();
  });

  it('reduces available cards without replacement when dealing', () => {
    let shoe = createShoe(1);
    const drawnIds = new Set<string>();

    for (let i = 0; i < 10; i++) {
      const { card, nextShoe } = drawCardFromShoe(shoe, {
        deckCount: 1,
        penetration: 0.75,
      });
      expect(drawnIds.has(card.id)).toBe(false);
      drawnIds.add(card.id);
      shoe = nextShoe;
    }

    expect(shoe.cards).toHaveLength(42);
    for (const remaining of shoe.cards) {
      expect(drawnIds.has(remaining.id)).toBe(false);
    }
  });

  it('flags cutCardReached when penetration threshold is crossed and reshuffles only between rounds', () => {
    let shoe = createShoe(1);
    const rules = { deckCount: 1, penetration: 0.75 };

    // Deal 38 cards (38/52 = 73.07% < 75%)
    for (let i = 0; i < 38; i++) {
      shoe = drawCardFromShoe(shoe, rules).nextShoe;
    }
    expect(isCutCardReached(shoe, 0.75)).toBe(false);
    expect(shoe.cutCardReached).toBe(false);

    // Ensure shoe does NOT reshuffle when cut card not reached
    const unchangedShoe = ensureShoeReadyForNewRound(shoe, rules);
    expect(unchangedShoe.reshuffleCount).toBe(0);
    expect(unchangedShoe.cards).toHaveLength(14);

    // Deal 1 more card (39/52 = 75% >= 75%)
    shoe = drawCardFromShoe(shoe, rules).nextShoe;
    expect(shoe.cutCardReached).toBe(true);
    // Still has 13 cards during the active round (not reshuffled mid-round)
    expect(shoe.cards).toHaveLength(13);

    // Between rounds, ensureShoeReadyForNewRound reshuffles back to 52 cards
    const reshuffledShoe = ensureShoeReadyForNewRound(shoe, rules);
    expect(reshuffledShoe.cards).toHaveLength(52);
    expect(reshuffledShoe.cutCardReached).toBe(false);
    expect(reshuffledShoe.reshuffleCount).toBe(1);
  });
});
