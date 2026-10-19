import React from 'react';
import { decomposeAmountToChips } from '../../engine/accounting';
import { ChipDenomination } from '../../engine/types';
import { CasinoChip } from './CasinoChip';

export interface BettingZoneProps {
  amount: number;
  insuranceBet?: number;
  canEdit: boolean;
  onRemoveChip?: (denomination: ChipDenomination) => void;
}

export const BettingZone: React.FC<BettingZoneProps> = ({
  amount,
  insuranceBet = 0,
  canEdit,
  onRemoveChip,
}) => {
  const chipBreakdown = decomposeAmountToChips(amount);

  return (
    <div className="betting-spot-wrapper" data-testid="betting-zone">
      <div className={`betting-circle ${chipBreakdown.length > 0 ? 'has-chips' : ''}`}>
        {chipBreakdown.length > 0 ? (
          <div className="chip-stacks-row">
            {chipBreakdown.map((item, stackIdx) => {
              const visibleChipsCount = Math.min(item.count, 5);
              return (
                <div
                  key={item.denomination}
                  className="chip-stack-column"
                  title={
                    canEdit
                      ? `${item.count}x ${item.denomination} (clic para retirar 1 ficha de ${item.denomination})`
                      : `${item.count}x ${item.denomination}`
                  }
                >
                  {Array.from({ length: visibleChipsCount }).map((_, idx) => (
                    <CasinoChip
                      key={`${item.denomination}-${idx}`}
                      denomination={item.denomination}
                      size="small"
                      disabled={!canEdit}
                      onClick={onRemoveChip}
                      className="betting-chip-in-stack"
                      style={{
                        animationDelay: `${(stackIdx * 2 + idx) * 35}ms`,
                      }}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        ) : (
          <span
            style={{
              fontSize: '0.75rem',
              color: 'rgba(249, 246, 238, 0.55)',
              fontWeight: 700,
              textTransform: 'uppercase',
            }}
          >
            Zona de Apuesta
          </span>
        )}
      </div>

      <div className="hand-meta-row">
        <span className="hand-bet-tag" data-testid="staged-bet-display">
          Apuesta: {amount} fichas
        </span>
        {insuranceBet > 0 && (
          <span className="hand-bet-tag" data-testid="insurance-bet-display">
            Seguro: {insuranceBet} fichas
          </span>
        )}
      </div>
    </div>
  );
};
