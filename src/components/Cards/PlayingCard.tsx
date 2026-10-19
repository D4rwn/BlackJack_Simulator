import React from 'react';
import { Card, PublicCard, Suit } from '../../engine/types';

export interface PlayingCardProps {
  card: Card | PublicCard;
  index?: number;
  dealDelay?: number;
  isHit?: boolean;
  isRevealedHoleCard?: boolean;
  style?: React.CSSProperties;
}

function SuitIcon({ suit, className }: { suit: Suit; className?: string }) {
  switch (suit) {
    case 'hearts':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      );
    case 'diamonds':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
          <path d="M12 2L20 12L12 22L4 12L12 2Z" />
        </svg>
      );
    case 'clubs':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
          <path d="M12 3a4.2 4.2 0 0 0-3.85 5.87A4.2 4.2 0 1 0 6.5 16.5c1.58 0 2.95-.87 3.67-2.16L9 20h6l-1.17-5.66A4.19 4.19 0 0 0 17.5 16.5a4.2 4.2 0 1 0-1.65-7.63A4.2 4.2 0 0 0 12 3z" />
        </svg>
      );
    case 'spades':
    default:
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
          <path d="M12 2C7 7 3 11.2 3 14.8 3 17.3 5 19 7.4 19c1.5 0 2.8-.7 3.6-1.8L9.5 22h5l-1.5-4.8c.8 1.1 2.1 1.8 3.6 1.8 2.4 0 4.4-1.7 4.4-4.2C21 11.2 17 7 12 2z" />
        </svg>
      );
  }
}

const SUIT_NAMES_ES: Record<Suit, string> = {
  spades: 'Picas',
  hearts: 'Corazones',
  diamonds: 'Diamantes',
  clubs: 'Tréboles',
};

export const PlayingCard: React.FC<PlayingCardProps> = ({
  card,
  dealDelay,
  isHit = false,
  isRevealedHoleCard = false,
  style,
}) => {
  const inlineStyle: React.CSSProperties = {
    animationDelay: dealDelay ? `${dealDelay}ms` : undefined,
    ...style,
  };

  if (!card.faceUp || !card.rank || !card.suit) {
    return (
      <div
        className="playing-card face-down"
        style={inlineStyle}
        data-testid="card-face-down"
        aria-label="Carta oculta del crupier"
      >
        <div className="card-back-pattern">
          <div className="card-back-emblem">BJ</div>
        </div>
      </div>
    );
  }

  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const isCourt = card.rank === 'J' || card.rank === 'Q' || card.rank === 'K';

  const animationClass = isRevealedHoleCard
    ? 'card-flip-reveal'
    : isHit
    ? 'card-hit'
    : 'card-deal';

  return (
    <div
      className={`playing-card ${isRed ? 'suit-red' : 'suit-black'} ${animationClass}`}
      style={inlineStyle}
      data-testid={`card-${card.rank}-${card.suit}`}
      aria-label={`${card.rank} de ${SUIT_NAMES_ES[card.suit]}`}
    >
      <div className="card-corner top-left">
        <span className="card-rank">{card.rank}</span>
        <SuitIcon suit={card.suit} className="card-suit-small" />
      </div>

      <div className="card-center-art">
        {isCourt ? (
          <div className="card-court-badge">
            <span style={{ fontSize: '0.7rem', fontWeight: 900 }}>♛</span>
            <SuitIcon suit={card.suit} className="card-suit-small" />
          </div>
        ) : (
          <SuitIcon suit={card.suit} className="card-suit-large" />
        )}
      </div>

      <div className="card-corner bottom-right">
        <span className="card-rank">{card.rank}</span>
        <SuitIcon suit={card.suit} className="card-suit-small" />
      </div>
    </div>
  );
};
