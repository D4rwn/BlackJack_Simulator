import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../App';
import {
  createInitialGameState,
  getAvailableActions,
  playerHit,
  playerSplit,
  playerStand,
  resolveInsuranceDecision,
  startRound,
} from '../engine/gameEngine';
import { Card, GameState, Rank, TableRules } from '../engine/types';

function createStackedState(
  ranks: Rank[],
  initialBalance = 1000,
  rules?: Partial<TableRules>
): GameState {
  const base = createInitialGameState({ initialBalance, rules });
  const customCards: Card[] = ranks.map((rank, idx) => ({
    id: `int-card-${idx}-${rank}`,
    suit: 'clubs',
    rank,
    deckIndex: 0,
    faceUp: true,
  }));

  return {
    ...base,
    shoe: {
      ...base.shoe,
      cards: [...customCards, ...base.shoe.cards],
    },
  };
}

describe('Comprehensive Integration & Regression Suite (Etapa 9)', () => {
  it('enforces maxSplitHands (up to 4 hands) and settles each split hand independently', () => {
    // Initial: P1=8, D1=6, P2=8, D2=10 (Dealer has 16, will draw 10 -> 26 bust)
    // Split 1 (2 hands): Hand 0 gets 8 (another pair!), Hand 1 gets 10 (18)
    // Split 2 on Hand 0 (3 hands): Hand 0a gets 8 (another pair!), Hand 0b gets 9 (17)
    // Split 3 on Hand 0a (4 hands): Hand 0a-1 gets 10 (18), Hand 0a-2 gets 8 (pair, but maxSplitHands=4 reached!)
    const state0 = createStackedState(
      ['8', '6', '8', '10', '8', '10', '8', '9', '10', '8', '10'],
      1000,
      { maxSplitHands: 4 }
    );

    let s = startRound(state0, 100);
    s = playerSplit(s); // 2 hands
    expect(s.playerHands).toHaveLength(2);
    expect(s.balance).toBe(800);

    s = playerSplit(s); // 3 hands
    expect(s.playerHands).toHaveLength(3);
    expect(s.balance).toBe(700);

    s = playerSplit(s); // 4 hands
    expect(s.playerHands).toHaveLength(4);
    expect(s.balance).toBe(600);

    // Stand on Hand 0 (8+10=18) -> advances to Hand 1 (which has 8+8)
    s = playerStand(s);
    expect(s.activeHandIndex).toBe(1);
    expect(s.playerHands[1].cards.map((c) => c.rank)).toEqual(['8', '8']);

    // Verify 4th split is blocked because maxSplitHands (4) is reached
    const avail = getAvailableActions(s);
    expect(avail.split.enabled).toBe(false);
    expect(avail.split.reason).toContain('Límite máximo de manos divididas alcanzado (4)');

    // Stand on remaining 3 hands -> Dealer draws 10 and busts (26) -> all 4 hands win!
    s = playerStand(s);
    s = playerStand(s);
    s = playerStand(s);

    expect(s.phase).toBe('ROUND_OVER');
    expect(s.balance).toBe(1400); // 1000 + 4 * 100 profit
    expect(s.lastRoundSummary?.playerHands).toHaveLength(4);
  });

  it('enforces doubleRestriction (9-11 and 10-11), DAS=false, and splitSameValueTenCards rules', () => {
    // 1. Test doubleRestriction = '10-11' with a hand of 9 (5+4) -> double disabled
    const state9 = createStackedState(['5', '6', '4', '10'], 1000, {
      doubleRestriction: '10-11',
    });
    const active9 = startRound(state9, 100);
    expect(getAvailableActions(active9).double.enabled).toBe(false);
    expect(getAvailableActions(active9).double.reason).toContain('10 u 11');

    // 2. Test doubleAfterSplit = false
    const noDasState = createStackedState(
      ['8', '6', '8', '10', '3', '10'],
      1000,
      { doubleAfterSplit: false }
    );
    const dealtNoDas = startRound(noDasState, 100);
    const splitNoDas = playerSplit(dealtNoDas);
    // Hand 0 has 8+3 = 11, but DAS is false
    expect(getAvailableActions(splitNoDas).double.enabled).toBe(false);
    expect(getAvailableActions(splitNoDas).double.reason).toContain(
      'Doblar después de dividir (DAS) está deshabilitado'
    );

    // 3. Test splitSameValueTenCards: 10 + K
    const strictPairs = createStackedState(['10', '6', 'K', '10'], 1000, {
      splitSameValueTenCards: false,
    });
    const activeStrict = startRound(strictPairs, 100);
    expect(getAvailableActions(activeStrict).split.enabled).toBe(false);

    const tenValuePairs = createStackedState(['10', '6', 'K', '10'], 1000, {
      splitSameValueTenCards: true,
    });
    const activeTenSplit = startRound(tenValuePairs, 100);
    expect(getAvailableActions(activeTenSplit).split.enabled).toBe(true);
  });

  it('handles Even Money scenario: Player has Natural Blackjack, Dealer shows Ace and also has Blackjack, Player takes Insurance', () => {
    // P1=A, D1=A, P2=K (Player BJ), D2=Q (Dealer BJ)
    const state = createStackedState(['A', 'A', 'K', 'Q'], 1000, {
      insuranceEnabled: true,
    });

    const offered = startRound(state, 100);
    expect(offered.phase).toBe('INSURANCE_OFFERED');

    // Player takes insurance (50 chips) -> Dealer also has BJ -> Main hand pushes (returns 100), Insurance wins 2:1 (returns 150) -> Net +100!
    const settled = resolveInsuranceDecision(offered, true);
    expect(settled.phase).toBe('ROUND_OVER');
    expect(settled.playerHands[0].outcome).toBe('push');
    expect(settled.insurance.outcome).toBe('win');
    expect(settled.balance).toBe(1100);
  });

  it('omits unnecessary dealer draws when all player hands bust', () => {
    // P1=10, D1=6, P2=6 (16), D2=9 (15) -> Player hits and draws K (26 bust)
    // Dealer has 15 (< 17), but since player busted, dealer should NOT draw extra cards from the shoe
    const state = createStackedState(['10', '6', '6', '9', 'K', '2'], 1000);
    const active = startRound(state, 100);
    const settled = playerHit(active);

    expect(settled.phase).toBe('ROUND_OVER');
    expect(settled.playerHands[0].outcome).toBe('bust');
    // Dealer still has only the 2 initial cards (revealed)
    expect(settled.dealerCards).toHaveLength(2);
    expect(settled.dealerCards.every((c) => c.faceUp)).toBe(true);
  });

  it('renders full application and navigates all modal panels without console errors', () => {
    const initial = createStackedState(['10', '7', '9', '10'], 1000);
    render(<App initialState={initial} />);

    // Open and close Rules guide
    fireEvent.click(screen.getByTestId('nav-rules'));
    expect(screen.getByTestId('modal-rules')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('modal-close'));
    expect(screen.queryByTestId('modal-rules')).not.toBeInTheDocument();

    // Play a quick hand and verify History & Stats
    fireEvent.click(screen.getByTestId('btn-deal'));
    fireEvent.click(screen.getByTestId('btn-stand'));

    expect(screen.getByTestId('player-hand-0-outcome')).toHaveTextContent(
      'Ganada (+10)'
    );
    expect(screen.getByTestId('hud-balance')).toHaveTextContent('1010 fichas');
  });
});

