import { describe, expect, it } from 'vitest';
import {
  createInitialGameState,
  getPublicDealerView,
  playerDouble,
  playerHit,
  playerSplit,
  playerStand,
  playerSurrender,
  prepareNextRound,
  resolveDealerTurnAndSettle,
  resolveInsuranceDecision,
  startRound,
} from '../engine/gameEngine';
import { Card, GameState, Rank } from '../engine/types';

/**
 * Helper to inject specific top-of-shoe cards for deterministic scenario testing.
 */
function withStackedShoe(state: GameState, ranks: Rank[]): GameState {
  const customCards: Card[] = ranks.map((rank, idx) => ({
    id: `stacked-${idx}-${rank}`,
    suit: 'hearts',
    rank,
    deckIndex: 0,
    faceUp: true,
  }));

  return {
    ...state,
    shoe: {
      ...state.shoe,
      cards: [...customCards, ...state.shoe.cards],
    },
  };
}

describe('Core Blackjack Engine & State Machine (Sections 13.3, 13.4, 13.5)', () => {
  it('deals 4 cards in order (P1, D1, P2, D2) and hides dealer hole card in public view', () => {
    const initial = withStackedShoe(
      createInitialGameState({ initialBalance: 1000 }),
      ['10', '9', '8', '7']
    );

    const active = startRound(initial, 100);
    expect(active.phase).toBe('PLAYER_TURN');
    expect(active.balance).toBe(900);
    expect(active.playerHands[0].cards.map((c) => c.rank)).toEqual(['10', '8']);
    expect(active.dealerCards[0].faceUp).toBe(true);
    expect(active.dealerCards[1].faceUp).toBe(false);

    const publicView = getPublicDealerView(active);
    expect(publicView.cards[0].rank).toBe('9');
    expect(publicView.cards[1].rank).toBeNull();
    expect(publicView.cards[1].suit).toBeNull();
    expect(publicView.visibleScore.total).toBe(9);
  });

  it('pays 3:2 on player natural blackjack when dealer does not have blackjack', () => {
    // P1=A, D1=9, P2=K, D2=8 -> Player has Blackjack (21), Dealer has 17
    const initial = withStackedShoe(
      createInitialGameState({ initialBalance: 1000 }),
      ['A', '9', 'K', '8']
    );

    const settled = startRound(initial, 100);
    expect(settled.phase).toBe('ROUND_OVER');
    expect(settled.playerHands[0].outcome).toBe('blackjack');
    expect(settled.playerHands[0].netProfit).toBe(150);
    expect(settled.playerHands[0].payout).toBe(250);
    expect(settled.balance).toBe(1150);
  });

  it('pays 6:5 on player natural blackjack when configured with 6:5 rule', () => {
    const initial = withStackedShoe(
      createInitialGameState({
        initialBalance: 1000,
        rules: { blackjackPayout: '6:5' },
      }),
      ['A', '9', 'K', '8']
    );

    const settled = startRound(initial, 100);
    expect(settled.phase).toBe('ROUND_OVER');
    expect(settled.playerHands[0].outcome).toBe('blackjack');
    expect(settled.playerHands[0].netProfit).toBe(120);
    expect(settled.balance).toBe(1120);
  });

  it('pushes when both player and dealer have natural blackjack', () => {
    const initial = withStackedShoe(
      createInitialGameState({
        initialBalance: 1000,
        rules: { insuranceEnabled: false },
      }),
      ['A', '10', 'K', 'A']
    );

    const settled = startRound(initial, 100);
    expect(settled.phase).toBe('ROUND_OVER');
    expect(settled.playerHands[0].outcome).toBe('push');
    expect(settled.balance).toBe(1000);
  });

  it('enforces S17 vs H17 dealer rules deterministically', () => {
    // Dealer has A + 6 (soft 17), next card is 4 (would make 21 if dealer hits)
    // Player has 10 + 9 = 19 and stands
    const s17Initial = withStackedShoe(
      createInitialGameState({
        initialBalance: 1000,
        rules: { dealerSoft17: 'S17', insuranceEnabled: false },
      }),
      ['10', 'A', '9', '6', '4']
    );

    const s17Round = startRound(s17Initial, 100);
    const s17Settled = playerStand(s17Round);
    // Under S17, dealer stands on soft 17, so player's 19 beats dealer's 17
    expect(s17Settled.dealerCards).toHaveLength(2);
    expect(s17Settled.playerHands[0].outcome).toBe('win');
    expect(s17Settled.balance).toBe(1100);

    // Under H17, dealer hits soft 17, draws 4 -> 21, beating player's 19
    const h17Initial = withStackedShoe(
      createInitialGameState({
        initialBalance: 1000,
        rules: { dealerSoft17: 'H17', insuranceEnabled: false },
      }),
      ['10', 'A', '9', '6', '4']
    );

    const h17Round = startRound(h17Initial, 100);
    const h17Settled = playerStand(h17Round);
    expect(h17Settled.dealerCards).toHaveLength(3);
    expect(h17Settled.playerHands[0].outcome).toBe('lose');
    expect(h17Settled.balance).toBe(900);
  });

  it('handles Hit, Double Down, Split, Surrender, and Insurance accurately', () => {
    // Test Double Down: P1=5, D1=6, P2=6 (total 11), D2=10, Double card=10 (total 21), Dealer draws 5 (total 21 -> push or let's make dealer draw 2 -> 18)
    const doubleState = withStackedShoe(
      createInitialGameState({ initialBalance: 1000 }),
      ['5', '6', '6', '10', '10', '2']
    );
    const afterDeal = startRound(doubleState, 100);
    const afterDouble = playerDouble(afterDeal);
    expect(afterDouble.phase).toBe('ROUND_OVER');
    expect(afterDouble.playerHands[0].bet).toBe(200);
    expect(afterDouble.playerHands[0].outcome).toBe('win');
    expect(afterDouble.balance).toBe(1200);

    // Test Late Surrender: P1=10, D1=10, P2=6 (16 vs 10), D2=7
    const surrenderState = withStackedShoe(
      createInitialGameState({ initialBalance: 1000 }),
      ['10', '10', '6', '7']
    );
    const afterSurrenderDeal = startRound(surrenderState, 100);
    const afterSurrender = playerSurrender(afterSurrenderDeal);
    expect(afterSurrender.phase).toBe('ROUND_OVER');
    expect(afterSurrender.playerHands[0].outcome).toBe('surrender');
    expect(afterSurrender.balance).toBe(950);

    // Test Insurance win when dealer has Ace + 10
    const insState = withStackedShoe(
      createInitialGameState({ initialBalance: 1000 }),
      ['10', 'A', '9', 'K']
    );
    const offered = startRound(insState, 100);
    expect(offered.phase).toBe('INSURANCE_OFFERED');
    const resolvedIns = resolveInsuranceDecision(offered, true);
    expect(resolvedIns.phase).toBe('ROUND_OVER');
    expect(resolvedIns.insurance.outcome).toBe('win');
    expect(resolvedIns.insurance.netProfit).toBe(100); // 50 bet * 2
    // Main bet lost (-100), insurance won (+100) => net 0 => balance 1000
    expect(resolvedIns.balance).toBe(1000);
  });

  it('handles splitting pairs and splitting Aces (auto-standing with 1 card each)', () => {
    // Split Aces: P1=A, D1=9, P2=A, D2=8, Split draw 1=K (21, not natural BJ), Split draw 2=9 (20)
    const splitAcesState = withStackedShoe(
      createInitialGameState({ initialBalance: 1000 }),
      ['A', '9', 'A', '8', 'K', '9']
    );
    const dealt = startRound(splitAcesState, 100);
    const afterSplit = playerSplit(dealt);
    // Standard rule: split Aces get 1 card each and auto-stand -> dealer resolves immediately
    expect(afterSplit.phase).toBe('ROUND_OVER');
    expect(afterSplit.playerHands).toHaveLength(2);
    // First hand has A+K = 21 after split -> counts as normal 21 win (1:1), NOT 3:2 natural blackjack
    expect(afterSplit.playerHands[0].outcome).toBe('win');
    expect(afterSplit.playerHands[0].netProfit).toBe(100);
    expect(afterSplit.playerHands[1].outcome).toBe('win');
    expect(afterSplit.playerHands[1].netProfit).toBe(100);
    expect(afterSplit.balance).toBe(1200);
  });

  it('prevents invalid actions out of turn and prevents double settlement', () => {
    const initial = createInitialGameState({ initialBalance: 1000 });
    expect(() => playerHit(initial)).toThrow();
    expect(() => playerStand(initial)).toThrow();
    expect(() => playerDouble(initial)).toThrow();
    expect(() => playerSplit(initial)).toThrow();
    expect(() => startRound(initial, -50)).toThrow();
    expect(() => startRound(initial, 5000)).toThrow();

    const stacked = withStackedShoe(initial, ['10', '9', '9', '8']);
    const active = startRound(stacked, 100);
    expect(() => startRound(active, 100)).toThrow();

    const settled = playerStand(active);
    expect(() => resolveDealerTurnAndSettle(settled)).toThrow();

    const nextReady = prepareNextRound(settled);
    expect(nextReady.phase).toBe('BETTING');
  });
});
