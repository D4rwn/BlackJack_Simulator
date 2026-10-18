import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PlayingCard } from '../components/Cards/PlayingCard';
import { BettingZone } from '../components/Chips/BettingZone';
import { BlackjackTable } from '../components/Table/BlackjackTable';
import { createInitialGameState, startRound } from '../engine/gameEngine';

describe('Cartoon UI Components (Etapa 6)', () => {
  it('renders face-up cards with rank and suit and conceals face-down hole cards in DOM', () => {
    const { rerender } = render(
      <PlayingCard
        card={{
          id: 'c1',
          suit: 'hearts',
          rank: 'A',
          deckIndex: 0,
          faceUp: true,
        }}
      />
    );

    expect(screen.getByTestId('card-A-hearts')).toBeInTheDocument();

    rerender(
      <PlayingCard
        card={{
          id: 'c2',
          suit: 'spades',
          rank: 'K',
          deckIndex: 0,
          faceUp: false,
        }}
      />
    );

    expect(screen.getByTestId('card-face-down')).toBeInTheDocument();
    expect(screen.queryByText('K')).not.toBeInTheDocument();
  });

  it('renders chip stacks in BettingZone and calls onRemoveChip when editable', () => {
    const onRemove = vi.fn();
    render(
      <BettingZone amount={125} canEdit={true} onRemoveChip={onRemove} />
    );

    expect(screen.getByTestId('staged-bet-display')).toHaveTextContent(
      'Apuesta: 125 fichas'
    );
    const chip100 = screen.getByTestId('chip-100');
    fireEvent.click(chip100);
    expect(onRemove).toHaveBeenCalledWith(100);
  });

  it('renders BlackjackTable with dynamic casino felt inscriptions and player turn controls', () => {
    const base = createInitialGameState({
      initialBalance: 1000,
      rules: { blackjackPayout: '6:5', dealerSoft17: 'H17' },
    });

    const noop = vi.fn();

    const { rerender } = render(
      <BlackjackTable
        state={base}
        activeModal="none"
        onOpenModal={noop}
        onAddChip={noop}
        onRemoveChip={noop}
        onSetExactBet={noop}
        onClearBet={noop}
        onHalfBet={noop}
        onDoubleBet={noop}
        onMaxBet={noop}
        onDeal={noop}
        onHit={noop}
        onStand={noop}
        onDoubleDown={noop}
        onSplit={noop}
        onSurrender={noop}
        onInsuranceDecision={noop}
        onNextRound={noop}
        onRefillBalance={noop}
      />
    );

    expect(screen.getByTestId('table-inscriptions')).toHaveTextContent(
      'BLACKJACK PAGA 6 A 5'
    );
    expect(screen.getByTestId('table-inscriptions')).toHaveTextContent(
      'EL CRUPIER PIDE EN 17 SUAVE'
    );
    expect(screen.getByTestId('btn-deal')).toBeInTheDocument();

    // Stack shoe so round enters PLAYER_TURN (10 + 7 vs dealer 8 + 9)
    const stacked = {
      ...base,
      shoe: {
        ...base.shoe,
        cards: [
          { id: 's1', suit: 'spades' as const, rank: '10' as const, deckIndex: 0, faceUp: true },
          { id: 's2', suit: 'hearts' as const, rank: '8' as const, deckIndex: 0, faceUp: true },
          { id: 's3', suit: 'clubs' as const, rank: '7' as const, deckIndex: 0, faceUp: true },
          { id: 's4', suit: 'diamonds' as const, rank: '9' as const, deckIndex: 0, faceUp: true },
          ...base.shoe.cards,
        ],
      },
    };
    const activeState = startRound(stacked, 50);

    rerender(
      <BlackjackTable
        state={activeState}
        activeModal="none"
        onOpenModal={noop}
        onAddChip={noop}
        onRemoveChip={noop}
        onSetExactBet={noop}
        onClearBet={noop}
        onHalfBet={noop}
        onDoubleBet={noop}
        onMaxBet={noop}
        onDeal={noop}
        onHit={noop}
        onStand={noop}
        onDoubleDown={noop}
        onSplit={noop}
        onSurrender={noop}
        onInsuranceDecision={noop}
        onNextRound={noop}
        onRefillBalance={noop}
      />
    );

    expect(screen.getByTestId('btn-hit')).toBeEnabled();
    expect(screen.getByTestId('btn-stand')).toBeEnabled();
    expect(screen.getByTestId('btn-double')).toBeEnabled();
    expect(screen.getByTestId('card-face-down')).toBeInTheDocument();
  });
});
