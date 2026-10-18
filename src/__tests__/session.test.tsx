import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../App';
import { createInitialGameState, playerStand, startRound } from '../engine/gameEngine';
import { Card, GameState, Rank } from '../engine/types';
import {
  calculateSessionStats,
  clearSessionStorage,
  loadSessionFromStorage,
  saveSessionToStorage,
} from '../state/storage';

function createStackedState(ranks: Rank[], initialBalance = 1000): GameState {
  const base = createInitialGameState({ initialBalance });
  const customCards: Card[] = ranks.map((rank, idx) => ({
    id: `sess-card-${idx}-${rank}`,
    suit: 'hearts',
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

describe('Session Configuration, Statistics, History & Persistence (Etapa 8)', () => {
  beforeEach(() => {
    clearSessionStorage();
  });

  it('calculates session statistics accurately and only persists safe between-round states', () => {
    // Round 1: Player natural blackjack (A + K vs 9 + 8) -> wins 150 on 100 bet
    const initial = createStackedState(['A', '9', 'K', '8', '10', '10', '9', '7'], 1000);
    const afterRound1 = startRound(initial, 100);
    expect(afterRound1.phase).toBe('ROUND_OVER');

    const stats = calculateSessionStats(afterRound1);
    expect(stats.roundsPlayed).toBe(1);
    expect(stats.handsPlayed).toBe(1);
    expect(stats.wins).toBe(1);
    expect(stats.naturalBlackjacks).toBe(1);
    expect(stats.netProfit).toBe(150);
    expect(stats.averageBet).toBe(100);

    // Save completed round state -> should persist
    saveSessionToStorage(afterRound1);
    const loaded = loadSessionFromStorage();
    expect(loaded).not.toBeNull();
    expect(loaded?.balance).toBe(1150);
    expect(loaded?.history).toHaveLength(1);

    // Now start Round 2 -> enters PLAYER_TURN (10+9 vs 10+7)
    // Saving during PLAYER_TURN must be ignored so mid-round states are never persisted
    const midRound = startRound(afterRound1, 50);
    expect(midRound.phase).toBe('PLAYER_TURN');
    expect(midRound.balance).toBe(1100);
    saveSessionToStorage(midRound);

    const stillRound1 = loadSessionFromStorage();
    expect(stillRound1?.balance).toBe(1150);

    // Finish Round 2 by standing (19 vs 17 -> win +50 -> balance 1200)
    const afterRound2 = playerStand(midRound);
    saveSessionToStorage(afterRound2);
    const loadedAfterR2 = loadSessionFromStorage();
    expect(loadedAfterR2?.balance).toBe(1200);
    expect(loadedAfterR2?.history).toHaveLength(2);
  });

  it('allows changing table rules, viewing stats and history, and resetting session with confirmation', () => {
    const initial = createStackedState(['A', '9', 'K', '8'], 1000);
    render(<App initialState={initial} />);

    // Play 1 blackjack hand (stagedBet = 10 -> win +15 -> balance 1015)
    fireEvent.click(screen.getByTestId('btn-deal'));
    expect(screen.getByTestId('hud-balance')).toHaveTextContent('1015 fichas');

    // Open Statistics modal
    fireEvent.click(screen.getByTestId('nav-stats'));
    expect(screen.getByTestId('modal-stats')).toBeInTheDocument();
    expect(screen.getByTestId('stat-hands-played')).toHaveTextContent('1');
    expect(screen.getByTestId('stat-blackjacks')).toHaveTextContent('1');
    expect(screen.getByTestId('stat-net-profit')).toHaveTextContent('+15');

    // Switch to History modal
    fireEvent.click(screen.getByTestId('nav-history'));
    expect(screen.getByTestId('modal-history')).toBeInTheDocument();
    expect(screen.getByTestId('history-list')).toHaveTextContent('BLACKJACK');

    // Switch to Settings modal and change rules (2 decks, H17, 6:5)
    fireEvent.click(screen.getByTestId('nav-settings'));
    expect(screen.getByTestId('modal-settings')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('cfg-decks'), {
      target: { value: '2' },
    });
    fireEvent.change(screen.getByTestId('cfg-soft17'), {
      target: { value: 'H17' },
    });
    fireEvent.change(screen.getByTestId('cfg-payout'), {
      target: { value: '6:5' },
    });
    fireEvent.click(screen.getByTestId('cfg-save-btn'));

    // Verify table inscriptions updated to reflect new engine rules
    expect(screen.getByTestId('table-inscriptions')).toHaveTextContent(
      'BLACKJACK PAGA 6 A 5'
    );
    expect(screen.getByTestId('table-inscriptions')).toHaveTextContent(
      'EL CRUPIER PIDE EN 17 SUAVE'
    );

    // Open Reset confirmation modal and reset session with 2500 chips
    fireEvent.click(screen.getByTestId('nav-reset'));
    expect(screen.getByTestId('modal-reset_confirm')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('reset-preset-2500'));
    fireEvent.click(screen.getByTestId('confirm-reset-btn'));

    expect(screen.getByTestId('hud-balance')).toHaveTextContent('2500 fichas');
    expect(screen.getByTestId('nav-history')).toHaveTextContent('Historial (0)');
  });
});
