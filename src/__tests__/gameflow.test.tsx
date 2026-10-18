import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../App';
import { createInitialGameState } from '../engine/gameEngine';
import { Card, GameState, Rank } from '../engine/types';

function createStackedState(
  ranks: Rank[],
  initialBalance = 1000
): GameState {
  const base = createInitialGameState({ initialBalance });
  const customCards: Card[] = ranks.map((rank, idx) => ({
    id: `flow-card-${idx}-${rank}`,
    suit: 'spades',
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

describe('Interactive Gameflow Integration (Etapa 7)', () => {
  it('completes a full interactive round: chip selection -> deal -> hit -> stand -> settlement -> next round', () => {
    // P1=9, D1=7, P2=5 (14), D2=10 (17), Hit card=6 (20) -> Player stands on 20, beats Dealer 17
    const initial = createStackedState(['9', '7', '5', '10', '6'], 1000);
    render(<App initialState={initial} />);

    expect(screen.getByTestId('hud-balance')).toHaveTextContent('1000 fichas');
    expect(screen.getByTestId('staged-bet-display')).toHaveTextContent(
      'Apuesta: 10 fichas'
    );

    // Clear bet and add 100 chip
    fireEvent.click(screen.getByTestId('btn-clear-bet'));
    expect(screen.getByTestId('staged-bet-display')).toHaveTextContent(
      'Apuesta: 0 fichas'
    );
    expect(screen.getByTestId('btn-deal')).toBeDisabled();

    fireEvent.click(screen.getByTestId('chip-100'));
    expect(screen.getByTestId('staged-bet-display')).toHaveTextContent(
      'Apuesta: 100 fichas'
    );
    expect(screen.getByTestId('btn-deal')).toBeEnabled();

    // Deal cards
    fireEvent.click(screen.getByTestId('btn-deal'));
    expect(screen.getByTestId('hud-balance')).toHaveTextContent('900 fichas');
    expect(screen.getByTestId('player-hand-0-score')).toHaveTextContent('14');
    expect(screen.getByTestId('dealer-score')).toHaveTextContent('7');
    expect(screen.getByTestId('card-face-down')).toBeInTheDocument();

    // Hit (draws 6 -> 20)
    fireEvent.click(screen.getByTestId('btn-hit'));
    expect(screen.getByTestId('player-hand-0-score')).toHaveTextContent('20');

    // Stand -> dealer reveals 10 (total 17) -> player wins 200 payout (balance 1100)
    fireEvent.click(screen.getByTestId('btn-stand'));
    expect(screen.getByTestId('dealer-score')).toHaveTextContent('17');
    expect(screen.getByTestId('player-hand-0-outcome')).toHaveTextContent(
      'Ganada (+100)'
    );
    expect(screen.getByTestId('hud-balance')).toHaveTextContent('1100 fichas');
    expect(screen.getByTestId('hud-net-profit')).toHaveTextContent('+100');

    // Prepare next round
    fireEvent.click(screen.getByTestId('btn-next-round'));
    expect(screen.getByTestId('btn-deal')).toBeEnabled();
  });

  it('handles insurance prompt and split hands interactively through the UI', () => {
    // P1=8, D1=A, P2=8, D2=9 (Dealer has 20, not BJ)
    // Player declines insurance, splits 8-8:
    // Hand 1 gets 10 (18), Hand 2 gets 3 (11) then doubles and gets 10 (21)
    const initial = createStackedState(
      ['8', 'A', '8', '9', '10', '3', '10'],
      1000
    );
    render(<App initialState={initial} />);

    fireEvent.click(screen.getByTestId('btn-clear-bet'));
    fireEvent.click(screen.getByTestId('chip-100'));
    fireEvent.click(screen.getByTestId('btn-deal'));

    // Insurance is offered because dealer upcard is Ace
    expect(screen.getByTestId('btn-take-insurance')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('btn-decline-insurance'));

    // Now in PLAYER_TURN with 8-8 -> Split
    fireEvent.click(screen.getByTestId('btn-split'));
    expect(screen.getByTestId('player-hand-0')).toBeInTheDocument();
    expect(screen.getByTestId('player-hand-1')).toBeInTheDocument();

    // Stand on Hand 1 (18)
    fireEvent.click(screen.getByTestId('btn-stand'));

    // Double on Hand 2 (11 -> draws 10 -> 21)
    fireEvent.click(screen.getByTestId('btn-double'));

    // Round is settled: Hand 1 (18 vs 20) loses -100, Hand 2 (21 vs 20, doubled to 200) wins +200 -> net +100 -> balance 1100
    expect(screen.getByTestId('hud-balance')).toHaveTextContent('1100 fichas');
    expect(screen.getByTestId('player-hand-0-outcome')).toHaveTextContent(
      'Perdida (-100)'
    );
    expect(screen.getByTestId('player-hand-1-outcome')).toHaveTextContent(
      'Ganada (+200)'
    );
  });
});
