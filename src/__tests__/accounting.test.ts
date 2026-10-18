import { describe, expect, it } from 'vitest';
import {
  addChipToBet,
  calculateHandPayout,
  calculateInsurancePayout,
  CHIP_DENOMINATIONS,
  clearStagedBet,
  decomposeAmountToChips,
  doubleStagedBet,
  getAvailableActions,
  getCommittedChipsSummary,
  halfStagedBet,
  maxStagedBet,
  refillBalance,
  removeChipFromBet,
  setStagedBet,
  validateBetForDeal,
} from '../engine/accounting';
import {
  createInitialGameState,
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

function withStackedShoe(state: GameState, ranks: Rank[]): GameState {
  const customCards: Card[] = ranks.map((rank, idx) => ({
    id: `acct-stacked-${idx}-${rank}`,
    suit: 'diamonds',
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

describe('Virtual Chip Accounting & Payout Settlement (Sections 9, 13.3, 13.4, 13.5)', () => {
  it('supports standard casino chip denominations (1, 5, 25, 100, 500) and decomposes amounts accurately', () => {
    expect(CHIP_DENOMINATIONS).toEqual([1, 5, 25, 100, 500]);

    const breakdown = decomposeAmountToChips(687);
    expect(breakdown).toEqual([
      { denomination: 500, count: 1 },
      { denomination: 100, count: 1 },
      { denomination: 25, count: 3 },
      { denomination: 5, count: 2 },
      { denomination: 1, count: 2 },
    ]);

    expect(decomposeAmountToChips(0)).toEqual([]);
    expect(decomposeAmountToChips(-25)).toEqual([]);
  });

  it('allows adding, removing, clearing, doubling, halving, and maxing staged bets before a round starts', () => {
    let state = createInitialGameState({
      initialBalance: 1000,
      rules: { minBet: 10, maxBet: 500 },
    });

    state = clearStagedBet(state);
    expect(state.stagedBet).toBe(0);

    state = addChipToBet(state, 25);
    state = addChipToBet(state, 100);
    expect(state.stagedBet).toBe(125);

    state = removeChipFromBet(state, 25);
    expect(state.stagedBet).toBe(100);

    state = doubleStagedBet(state);
    expect(state.stagedBet).toBe(200);

    state = halfStagedBet(state);
    expect(state.stagedBet).toBe(100);

    state = maxStagedBet(state);
    expect(state.stagedBet).toBe(500);

    // Cannot exceed maxBet (500)
    expect(() => addChipToBet(state, 5)).toThrow();
  });

  it('rejects negative, NaN, out-of-bounds, or mid-round bet modifications', () => {
    const state = createInitialGameState({
      initialBalance: 300,
      rules: { minBet: 10, maxBet: 500 },
    });

    expect(() => setStagedBet(state, -10)).toThrow();
    expect(() => setStagedBet(state, Number.NaN)).toThrow();
    expect(() => setStagedBet(state, 350)).toThrow(); // Exceeds balance of 300

    expect(validateBetForDeal(5, 300, state.rules).valid).toBe(false);
    expect(validateBetForDeal(600, 1000, state.rules).valid).toBe(false);
    expect(validateBetForDeal(400, 300, state.rules).valid).toBe(false);

    // Start round and verify staged bet cannot be modified mid-hand
    const active = startRound(
      withStackedShoe(state, ['10', '9', '8', '7']),
      100
    );
    expect(() => addChipToBet(active, 25)).toThrow();
    expect(() => removeChipFromBet(active, 5)).toThrow();
    expect(() => clearStagedBet(active)).toThrow();
    expect(() => setStagedBet(active, 50)).toThrow();
  });

  it('verifies exact payout tables: 1:1 win, 3:2 blackjack, 6:5 blackjack, push, lose, surrender, and 2:1 insurance', () => {
    expect(calculateHandPayout(100, 'win', { blackjackPayout: '3:2' })).toEqual({
      payout: 200,
      netProfit: 100,
    });
    expect(
      calculateHandPayout(100, 'blackjack', { blackjackPayout: '3:2' })
    ).toEqual({
      payout: 250,
      netProfit: 150,
    });
    expect(
      calculateHandPayout(100, 'blackjack', { blackjackPayout: '6:5' })
    ).toEqual({
      payout: 220,
      netProfit: 120,
    });
    expect(
      calculateHandPayout(100, 'push', { blackjackPayout: '3:2' })
    ).toEqual({
      payout: 100,
      netProfit: 0,
    });
    expect(
      calculateHandPayout(100, 'surrender', { blackjackPayout: '3:2' })
    ).toEqual({
      payout: 50,
      netProfit: -50,
    });
    expect(
      calculateHandPayout(100, 'lose', { blackjackPayout: '3:2' })
    ).toEqual({
      payout: 0,
      netProfit: -100,
    });

    expect(calculateInsurancePayout(50, true)).toEqual({
      outcome: 'win',
      payout: 150,
      netProfit: 100,
    });
    expect(calculateInsurancePayout(50, false)).toEqual({
      outcome: 'lose',
      payout: 0,
      netProfit: -50,
    });
  });

  it('tracks committed chips accurately across Split, Double After Split (DAS), and Insurance', () => {
    // Setup: Player gets 8 + 8, Dealer shows A + 9 (no dealer BJ, total 20)
    // Split 8s -> Hand 1 gets 3 (total 11), Hand 2 gets 10 (total 18)
    // Hand 1 doubles down -> gets 10 (total 21)
    // Hand 2 stands on 18
    // Dealer stands on 20 -> Hand 1 wins 200 (+200), Hand 2 loses 100 (-100), Insurance lost 50 (-50)
    const initial = withStackedShoe(
      createInitialGameState({
        initialBalance: 1000,
        rules: { doubleAfterSplit: true, insuranceEnabled: true },
      }),
      ['8', 'A', '8', '9', '3', '10', '10']
    );

    const offered = startRound(initial, 100);
    expect(offered.phase).toBe('INSURANCE_OFFERED');
    expect(offered.balance).toBe(900);

    // Take insurance (50 chips)
    const afterIns = resolveInsuranceDecision(offered, true);
    expect(afterIns.phase).toBe('PLAYER_TURN');
    expect(afterIns.balance).toBe(850);

    // Split 8-8 (costs another 100 chips)
    const afterSplit = playerSplit(afterIns);
    expect(afterSplit.balance).toBe(750);
    expect(afterSplit.playerHands).toHaveLength(2);

    // Double down on Hand 1 (8+3=11, costs another 100 chips)
    const afterDouble = playerDouble(afterSplit);
    expect(afterDouble.balance).toBe(650);
    expect(afterDouble.activeHandIndex).toBe(1);

    // Check committed chips summary mid-round before Hand 2 finishes
    const midSummary = getCommittedChipsSummary(afterDouble);
    expect(midSummary.availableBalance).toBe(650);
    expect(midSummary.activeMainBets).toBe(100);
    expect(midSummary.additionalSplitBets).toBe(100);
    expect(midSummary.additionalDoubleBets).toBe(100);
    expect(midSummary.insuranceBet).toBe(50);
    expect(midSummary.totalCommittedOnTable).toBe(350);
    expect(midSummary.netSessionProfit).toBe(0); // Equity on table + balance still equals 1000

    // Stand on Hand 2 (8+10=18 vs Dealer 20)
    const settled = playerStand(afterDouble);
    expect(settled.phase).toBe('ROUND_OVER');
    // Hand 1 (bet 200, score 21 vs 20) -> wins! Payout = 400 (+200 net)
    // Hand 2 (bet 100, score 18 vs 20) -> loses! Payout = 0 (-100 net)
    // Insurance (bet 50, dealer has 20 not BJ) -> loses! Payout = 0 (-50 net)
    // Final balance = 650 + 400 = 1050 (+50 net profit)
    expect(settled.balance).toBe(1050);
    expect(settled.lastRoundSummary?.totalCommitted).toBe(350);
    expect(settled.lastRoundSummary?.totalPayout).toBe(400);
    expect(settled.lastRoundSummary?.netBalanceChange).toBe(50);

    const postSummary = getCommittedChipsSummary(settled);
    expect(postSummary.netSessionProfit).toBe(50);

    // Ensure settlement cannot be executed a second time
    expect(() => resolveDealerTurnAndSettle(settled)).toThrow();
  });

  it('disables actions and provides clear explanations when player lacks sufficient chips', () => {
    // Player has 150 balance and bets 100 -> only 50 remaining (not enough to Double or Split, which need 100)
    const initial = withStackedShoe(
      createInitialGameState({ initialBalance: 150 }),
      ['8', '6', '8', '10']
    );

    const active = startRound(initial, 100);
    expect(active.balance).toBe(50);

    const actions = getAvailableActions(active);
    expect(actions.hit.enabled).toBe(true);
    expect(actions.stand.enabled).toBe(true);
    expect(actions.double.enabled).toBe(false);
    expect(actions.double.reason).toContain('Fichas insuficientes para doblar');
    expect(actions.split.enabled).toBe(false);
    expect(actions.split.reason).toContain('Fichas insuficientes para dividir');
  });

  it('transitions to OUT_OF_CHIPS when balance falls below minBet and recovers via refillBalance', () => {
    const initial = withStackedShoe(
      createInitialGameState({
        initialBalance: 100,
        rules: { minBet: 25, maxBet: 500 },
      }),
      ['10', '10', '6', '9', '10'] // Player has 16, hits and draws 10 -> 26 bust
    );

    const active = startRound(initial, 100);
    const busted = playerHit(active);
    expect(busted.phase).toBe('ROUND_OVER');
    expect(busted.balance).toBe(0);

    const nextState = prepareNextRound(busted);
    expect(nextState.phase).toBe('OUT_OF_CHIPS');
    expect(getAvailableActions(nextState).deal.enabled).toBe(false);

    const refilled = refillBalance(nextState, 500);
    expect(refilled.phase).toBe('BETTING');
    expect(refilled.balance).toBe(500);
    expect(getAvailableActions(refilled).deal.enabled).toBe(true);
  });

  it('handles Late Surrender accounting accurately without double-returning chips', () => {
    const initial = withStackedShoe(
      createInitialGameState({ initialBalance: 500 }),
      ['10', '9', '6', '10']
    );
    const active = startRound(initial, 100);
    expect(active.balance).toBe(400);

    const surrendered = playerSurrender(active);
    expect(surrendered.phase).toBe('ROUND_OVER');
    expect(surrendered.balance).toBe(450);
    expect(surrendered.lastRoundSummary?.netBalanceChange).toBe(-50);
  });
});

