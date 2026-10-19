import React from 'react';
import { CHIP_DEFINITIONS } from '../../engine/accounting';
import { ChipDenomination } from '../../engine/types';

export interface CasinoChipProps {
  denomination: ChipDenomination;
  onClick?: (denomination: ChipDenomination) => void;
  disabled?: boolean;
  size?: 'normal' | 'small';
  title?: string;
  style?: React.CSSProperties;
  className?: string;
}

export const CasinoChip: React.FC<CasinoChipProps> = ({
  denomination,
  onClick,
  disabled = false,
  size = 'normal',
  title,
  style,
  className = '',
}) => {
  const def =
    CHIP_DEFINITIONS.find((c) => c.denomination === denomination) ??
    CHIP_DEFINITIONS[0];

  return (
    <button
      type="button"
      className={`casino-chip ${size === 'small' ? 'chip-small' : ''} ${className}`}
      style={{
        backgroundColor: def.primaryColor,
        color: def.textColor,
        ...style,
      }}
      disabled={disabled}
      onClick={() => onClick?.(denomination)}
      title={title ?? `Ficha de ${denomination}`}
      aria-label={`Ficha de ${denomination}`}
      data-testid={`chip-${denomination}`}
    >
      <span
        className="casino-chip-inner"
        style={{ borderColor: def.accentColor }}
      >
        {def.label}
      </span>
    </button>
  );
};
