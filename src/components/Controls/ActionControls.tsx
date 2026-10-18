import React, { useState, useEffect } from 'react';
import { CHIP_DENOMINATIONS } from '../../engine/accounting';
import {
  AvailableActionsMap,
  ChipDenomination,
  GamePhase,
  TableRules,
} from '../../engine/types';
import { CasinoChip } from '../Chips/CasinoChip';

export interface ActionControlsProps {
  phase: GamePhase;
  balance: number;
  stagedBet: number;
  rules: TableRules;
  availableActions: AvailableActionsMap;
  onAddChip: (denom: ChipDenomination) => void;
  onSetExactBet: (amount: number) => void;
  onClearBet: () => void;
  onHalfBet: () => void;
  onDoubleBet: () => void;
  onMaxBet: () => void;
  onDeal: () => void;
  onHit: () => void;
  onStand: () => void;
  onDoubleDown: () => void;
  onSplit: () => void;
  onSurrender: () => void;
  onInsuranceDecision: (take: boolean) => void;
  onNextRound: () => void;
  onRefillBalance: (amount: number) => void;
}

export const ActionControls: React.FC<ActionControlsProps> = ({
  phase,
  balance,
  stagedBet,
  rules,
  availableActions,
  onAddChip,
  onSetExactBet,
  onClearBet,
  onHalfBet,
  onDoubleBet,
  onMaxBet,
  onDeal,
  onHit,
  onStand,
  onDoubleDown,
  onSplit,
  onSurrender,
  onInsuranceDecision,
  onNextRound,
  onRefillBalance,
}) => {
  const [inputBet, setInputBet] = useState<string>(String(stagedBet));

  useEffect(() => {
    setInputBet(String(stagedBet));
  }, [stagedBet]);

  const isBettingPhase = phase === 'BETTING';

  const handleExactBetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputBet(val);
    const parsed = Number(val);
    if (Number.isFinite(parsed) && parsed >= 0) {
      const clamped = Math.min(Math.floor(parsed), Math.min(balance, rules.maxBet));
      onSetExactBet(clamped);
    }
  };

  return (
    <footer className="table-bottom-rail" aria-label="Controles de partida">
      <div className="controls-dock">
        {isBettingPhase && (
          <div className="betting-controls-row">
            <div className="chip-rack" role="group" aria-label="Selector de fichas">
              {CHIP_DENOMINATIONS.map((denom) => {
                const exceeds =
                  stagedBet + denom > balance ||
                  stagedBet + denom > rules.maxBet;
                return (
                  <CasinoChip
                    key={denom}
                    denomination={denom}
                    disabled={exceeds}
                    onClick={onAddChip}
                    title={
                      exceeds
                        ? 'Supera el saldo disponible o el límite máximo de apuesta'
                        : `Añadir ficha de ${denom}`
                    }
                  />
                );
              })}
            </div>

            <div className="exact-bet-group">
              <label htmlFor="exact-bet-input" style={{ fontSize: '0.78rem', fontWeight: 700 }}>
                Importe:
              </label>
              <input
                id="exact-bet-input"
                type="number"
                min={rules.minBet}
                max={Math.min(balance, rules.maxBet)}
                value={inputBet}
                onChange={handleExactBetChange}
                className="exact-bet-input"
                data-testid="exact-bet-input"
              />
              <button
                type="button"
                className="cartoon-action-btn btn-utility"
                onClick={onClearBet}
                disabled={stagedBet === 0}
                data-testid="btn-clear-bet"
              >
                Limpiar
              </button>
              <button
                type="button"
                className="cartoon-action-btn btn-utility"
                onClick={onHalfBet}
                disabled={stagedBet <= rules.minBet}
                data-testid="btn-half-bet"
              >
                1/2
              </button>
              <button
                type="button"
                className="cartoon-action-btn btn-utility"
                onClick={onDoubleBet}
                disabled={stagedBet >= Math.min(balance, rules.maxBet)}
                data-testid="btn-double-bet"
              >
                x2
              </button>
              <button
                type="button"
                className="cartoon-action-btn btn-utility"
                onClick={onMaxBet}
                disabled={stagedBet >= Math.min(balance, rules.maxBet)}
                data-testid="btn-max-bet"
              >
                Máx
              </button>
            </div>

            <button
              type="button"
              className="cartoon-action-btn btn-primary-gold"
              disabled={!availableActions.deal.enabled}
              onClick={onDeal}
              title={availableActions.deal.reason}
              data-testid="btn-deal"
            >
              <span>Repartir</span>
              <small>{stagedBet} fichas</small>
            </button>
          </div>
        )}

        {phase === 'INSURANCE_OFFERED' && (
          <div className="action-buttons-row" role="group" aria-label="Decisión de seguro">
            <button
              type="button"
              className="cartoon-action-btn btn-primary-gold"
              disabled={!availableActions.insurance.enabled}
              onClick={() => onInsuranceDecision(true)}
              title={availableActions.insurance.reason}
              data-testid="btn-take-insurance"
            >
              <span>Contratar Seguro</span>
              <small>{stagedBet / 2} fichas (Paga 2:1)</small>
            </button>
            <button
              type="button"
              className="cartoon-action-btn btn-stand-crimson"
              onClick={() => onInsuranceDecision(false)}
              data-testid="btn-decline-insurance"
            >
              <span>No, gracias</span>
              <small>Continuar mano</small>
            </button>
          </div>
        )}

        {phase === 'PLAYER_TURN' && (
          <div className="action-buttons-row" role="group" aria-label="Acciones de juego">
            <button
              type="button"
              className="cartoon-action-btn btn-hit-emerald"
              disabled={!availableActions.hit.enabled}
              onClick={onHit}
              title={availableActions.hit.reason}
              data-testid="btn-hit"
            >
              <span>Pedir</span>
              <small>Hit</small>
            </button>

            <button
              type="button"
              className="cartoon-action-btn btn-stand-crimson"
              disabled={!availableActions.stand.enabled}
              onClick={onStand}
              title={availableActions.stand.reason}
              data-testid="btn-stand"
            >
              <span>Plantarse</span>
              <small>Stand</small>
            </button>

            <button
              type="button"
              className="cartoon-action-btn btn-double-amber"
              disabled={!availableActions.double.enabled}
              onClick={onDoubleDown}
              title={availableActions.double.reason}
              data-testid="btn-double"
            >
              <span>Doblar</span>
              <small>Double</small>
            </button>

            <button
              type="button"
              className="cartoon-action-btn btn-split-royal"
              disabled={!availableActions.split.enabled}
              onClick={onSplit}
              title={availableActions.split.reason}
              data-testid="btn-split"
            >
              <span>Dividir</span>
              <small>Split</small>
            </button>

            {rules.surrender !== 'none' && (
              <button
                type="button"
                className="cartoon-action-btn btn-surrender-slate"
                disabled={!availableActions.surrender.enabled}
                onClick={onSurrender}
                title={availableActions.surrender.reason}
                data-testid="btn-surrender"
              >
                <span>Rendirse</span>
                <small>Surrender</small>
              </button>
            )}
          </div>
        )}

        {phase === 'ROUND_OVER' && (
          <div className="action-buttons-row">
            <button
              type="button"
              className="cartoon-action-btn btn-primary-gold"
              onClick={onNextRound}
              data-testid="btn-next-round"
            >
              <span>Siguiente Mano</span>
              <small>Ajustar o repetir apuesta</small>
            </button>
          </div>
        )}

        {phase === 'OUT_OF_CHIPS' && (
          <div className="action-buttons-row">
            <button
              type="button"
              className="cartoon-action-btn btn-primary-gold"
              onClick={() => onRefillBalance(1000)}
              data-testid="btn-refill-chips"
            >
              <span>Recargar +1,000 Fichas</span>
              <small>Continuar practicando</small>
            </button>
          </div>
        )}
      </div>
    </footer>
  );
};
