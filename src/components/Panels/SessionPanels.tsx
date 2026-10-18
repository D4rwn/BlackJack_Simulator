import React, { useState } from 'react';
import {
  BlackjackPayoutRatio,
  DealerSoft17Rule,
  DoubleRestrictionRule,
  GameState,
  SurrenderRule,
  TableRules,
} from '../../engine/types';
import { calculateSessionStats } from '../../state/storage';
import { ActiveModalType } from '../Table/BlackjackTable';

export interface SessionPanelsProps {
  state: GameState;
  activeModal: ActiveModalType;
  onClose: () => void;
  onApplySettings: (
    rules: Partial<TableRules>,
    newStartingBalance?: number
  ) => void;
  onConfirmReset: (newStartingBalance: number) => void;
}

const SUIT_SYMBOLS: Record<string, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

const PRESET_BALANCES = [500, 1000, 2500, 5000, 10000];
const DECK_OPTIONS = [1, 2, 4, 6, 8];

export const SessionPanels: React.FC<SessionPanelsProps> = ({
  state,
  activeModal,
  onClose,
  onApplySettings,
  onConfirmReset,
}) => {
  const [draftRules, setDraftRules] = useState<TableRules>(state.rules);
  const [draftBalance, setDraftBalance] = useState<number>(
    state.initialBalance
  );
  const [resetWithNewBalance, setResetWithNewBalance] = useState<boolean>(false);

  if (activeModal === 'none') {
    return null;
  }

  const isRoundInProgress =
    state.phase === 'DEALING' ||
    state.phase === 'INSURANCE_OFFERED' ||
    state.phase === 'PLAYER_TURN' ||
    state.phase === 'DEALER_TURN' ||
    state.phase === 'SETTLEMENT';

  const stats = calculateSessionStats(state);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onApplySettings(
      draftRules,
      resetWithNewBalance ? draftBalance : undefined
    );
    onClose();
  };

  return (
    <div
      className="panel-overlay"
      role="dialog"
      aria-modal="true"
      data-testid={`modal-${activeModal}`}
    >
      <div className="cartoon-modal">
        {activeModal === 'settings' && (
          <>
            <div className="modal-header">
              <h2 className="modal-title">⚙ Configuración de la Mesa</h2>
              <button
                type="button"
                className="cartoon-icon-btn"
                onClick={onClose}
                data-testid="modal-close"
              >
                ✕ Cerrar
              </button>
            </div>

            {isRoundInProgress ? (
              <p style={{ marginBottom: '1rem', color: '#f39c12', fontWeight: 700 }}>
                Finaliza la mano en curso antes de modificar las reglas de la mesa.
              </p>
            ) : (
              <form onSubmit={handleSaveSettings}>
                <div className="form-grid">
                  <div className="form-field">
                    <label htmlFor="cfg-decks">Número de barajas en zapato</label>
                    <select
                      id="cfg-decks"
                      value={draftRules.deckCount}
                      onChange={(e) =>
                        setDraftRules({
                          ...draftRules,
                          deckCount: Number(e.target.value),
                        })
                      }
                      data-testid="cfg-decks"
                    >
                      {DECK_OPTIONS.map((d) => (
                        <option key={d} value={d}>
                          {d} {d === 1 ? 'Baraja (52 cartas)' : `Barajas (${d * 52} cartas)`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label htmlFor="cfg-soft17">Regla del Crupier en 17</label>
                    <select
                      id="cfg-soft17"
                      value={draftRules.dealerSoft17}
                      onChange={(e) =>
                        setDraftRules({
                          ...draftRules,
                          dealerSoft17: e.target.value as DealerSoft17Rule,
                        })
                      }
                      data-testid="cfg-soft17"
                    >
                      <option value="S17">S17 — Se planta en todo 17 (Estándar)</option>
                      <option value="H17">H17 — Pide carta en 17 suave</option>
                    </select>
                  </div>

                  <div className="form-field">
                    <label htmlFor="cfg-payout">Pago de Blackjack Natural</label>
                    <select
                      id="cfg-payout"
                      value={draftRules.blackjackPayout}
                      onChange={(e) =>
                        setDraftRules({
                          ...draftRules,
                          blackjackPayout: e.target.value as BlackjackPayoutRatio,
                        })
                      }
                      data-testid="cfg-payout"
                    >
                      <option value="3:2">Pago clásico 3:2</option>
                      <option value="6:5">Pago variante 6:5</option>
                    </select>
                  </div>

                  <div className="form-field">
                    <label htmlFor="cfg-double-restriction">Restricción de Doblar</label>
                    <select
                      id="cfg-double-restriction"
                      value={draftRules.doubleRestriction}
                      onChange={(e) =>
                        setDraftRules({
                          ...draftRules,
                          doubleRestriction: e.target
                            .value as DoubleRestrictionRule,
                        })
                      }
                      data-testid="cfg-double-restriction"
                    >
                      <option value="any">Cualquier par de cartas iniciales</option>
                      <option value="9-11">Solo totales de 9, 10 u 11</option>
                      <option value="10-11">Solo totales de 10 u 11</option>
                    </select>
                  </div>

                  <div className="form-field">
                    <label htmlFor="cfg-surrender">Rendición (Surrender)</label>
                    <select
                      id="cfg-surrender"
                      value={draftRules.surrender}
                      onChange={(e) =>
                        setDraftRules({
                          ...draftRules,
                          surrender: e.target.value as SurrenderRule,
                        })
                      }
                      data-testid="cfg-surrender"
                    >
                      <option value="late">Rendición tardía habilitada</option>
                      <option value="none">Deshabilitada</option>
                    </select>
                  </div>

                  <div className="form-field">
                    <label htmlFor="cfg-max-splits">Máximo de manos divididas</label>
                    <select
                      id="cfg-max-splits"
                      value={draftRules.maxSplitHands}
                      onChange={(e) =>
                        setDraftRules({
                          ...draftRules,
                          maxSplitHands: Number(e.target.value),
                        })
                      }
                      data-testid="cfg-max-splits"
                    >
                      <option value={2}>Hasta 2 manos</option>
                      <option value={3}>Hasta 3 manos</option>
                      <option value={4}>Hasta 4 manos</option>
                    </select>
                  </div>

                  <div className="form-field">
                    <label htmlFor="cfg-min-bet">Apuesta mínima</label>
                    <input
                      id="cfg-min-bet"
                      type="number"
                      min={1}
                      max={1000}
                      value={draftRules.minBet}
                      onChange={(e) =>
                        setDraftRules({
                          ...draftRules,
                          minBet: Math.max(1, Number(e.target.value)),
                        })
                      }
                      data-testid="cfg-min-bet"
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="cfg-max-bet">Apuesta máxima</label>
                    <input
                      id="cfg-max-bet"
                      type="number"
                      min={draftRules.minBet}
                      max={10000}
                      value={draftRules.maxBet}
                      onChange={(e) =>
                        setDraftRules({
                          ...draftRules,
                          maxBet: Math.max(
                            draftRules.minBet,
                            Number(e.target.value)
                          ),
                        })
                      }
                      data-testid="cfg-max-bet"
                    />
                  </div>

                  <div className="form-field">
                    <label>
                      <input
                        type="checkbox"
                        checked={draftRules.insuranceEnabled}
                        onChange={(e) =>
                          setDraftRules({
                            ...draftRules,
                            insuranceEnabled: e.target.checked,
                          })
                        }
                        data-testid="cfg-insurance"
                      />{' '}
                      Habilitar Seguro (2:1 cuando crupier muestra As)
                    </label>
                  </div>

                  <div className="form-field">
                    <label>
                      <input
                        type="checkbox"
                        checked={draftRules.doubleAfterSplit}
                        onChange={(e) =>
                          setDraftRules({
                            ...draftRules,
                            doubleAfterSplit: e.target.checked,
                          })
                        }
                        data-testid="cfg-das"
                      />{' '}
                      Permitir Doblar después de Dividir (DAS)
                    </label>
                  </div>

                  <div className="form-field">
                    <label>
                      <input
                        type="checkbox"
                        checked={draftRules.splitSameValueTenCards}
                        onChange={(e) =>
                          setDraftRules({
                            ...draftRules,
                            splitSameValueTenCards: e.target.checked,
                          })
                        }
                        data-testid="cfg-split-tens"
                      />{' '}
                      Permitir dividir figuras distintas de valor 10 (ej. 10-K)
                    </label>
                  </div>

                  <div className="form-field">
                    <label>
                      <input
                        type="checkbox"
                        checked={draftRules.resplitAces}
                        onChange={(e) =>
                          setDraftRules({
                            ...draftRules,
                            resplitAces: e.target.checked,
                          })
                        }
                        data-testid="cfg-resplit-aces"
                      />{' '}
                      Permitir re-dividir Ases (RSA)
                    </label>
                  </div>
                </div>

                <div
                  className="form-field"
                  style={{ marginTop: '0.9rem' }}
                >
                  <label>
                    <input
                      type="checkbox"
                      checked={resetWithNewBalance}
                      onChange={(e) => setResetWithNewBalance(e.target.checked)}
                      data-testid="cfg-reset-balance-toggle"
                    />{' '}
                    Reiniciar saldo inicial al guardar cambios
                  </label>
                  {resetWithNewBalance && (
                    <div
                      style={{
                        display: 'flex',
                        gap: '0.5rem',
                        flexWrap: 'wrap',
                        marginTop: '0.45rem',
                        alignItems: 'center',
                      }}
                    >
                      {PRESET_BALANCES.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          className={`cartoon-icon-btn ${
                            draftBalance === preset ? 'active' : ''
                          }`}
                          onClick={() => setDraftBalance(preset)}
                        >
                          {preset}
                        </button>
                      ))}
                      <input
                        type="number"
                        min={50}
                        max={100000}
                        value={draftBalance}
                        onChange={(e) =>
                          setDraftBalance(Math.max(50, Number(e.target.value)))
                        }
                        aria-label="Saldo inicial personalizado"
                        data-testid="cfg-custom-balance"
                      />
                    </div>
                  )}
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '0.75rem',
                    marginTop: '1.2rem',
                  }}
                >
                  <button
                    type="button"
                    className="cartoon-action-btn btn-utility"
                    onClick={onClose}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="cartoon-action-btn btn-primary-gold"
                    data-testid="cfg-save-btn"
                  >
                    Guardar Reglas
                  </button>
                </div>
              </form>
            )}
          </>
        )}

        {activeModal === 'stats' && (
          <>
            <div className="modal-header">
              <h2 className="modal-title">📊 Estadísticas de la Sesión</h2>
              <button
                type="button"
                className="cartoon-icon-btn"
                onClick={onClose}
                data-testid="modal-close"
              >
                ✕ Cerrar
              </button>
            </div>

            <div className="stats-grid" data-testid="stats-grid">
              <div className="stat-box">
                <div className="stat-box-label">Manos Jugadas</div>
                <div className="stat-box-value" data-testid="stat-hands-played">
                  {stats.handsPlayed}
                </div>
              </div>
              <div className="stat-box">
                <div className="stat-box-label">Victorias</div>
                <div className="stat-box-value" data-testid="stat-wins">
                  {stats.wins}
                </div>
              </div>
              <div className="stat-box">
                <div className="stat-box-label">Derrotas</div>
                <div className="stat-box-value" data-testid="stat-losses">
                  {stats.losses}
                </div>
              </div>
              <div className="stat-box">
                <div className="stat-box-label">Empates (Push)</div>
                <div className="stat-box-value" data-testid="stat-pushes">
                  {stats.pushes}
                </div>
              </div>
              <div className="stat-box">
                <div className="stat-box-label">Blackjacks Naturales</div>
                <div className="stat-box-value" data-testid="stat-blackjacks">
                  {stats.naturalBlackjacks}
                </div>
              </div>
              <div className="stat-box">
                <div className="stat-box-label">Saldo Actual</div>
                <div className="stat-box-value">{stats.currentBalance}</div>
              </div>
              <div className="stat-box">
                <div className="stat-box-label">Balance Neto</div>
                <div className="stat-box-value" data-testid="stat-net-profit">
                  {stats.netProfit > 0 ? `+${stats.netProfit}` : stats.netProfit}
                </div>
              </div>
              <div className="stat-box">
                <div className="stat-box-label">Apuesta Media</div>
                <div className="stat-box-value" data-testid="stat-avg-bet">
                  {stats.averageBet}
                </div>
              </div>
            </div>
          </>
        )}

        {activeModal === 'history' && (
          <>
            <div className="modal-header">
              <h2 className="modal-title">📜 Historial de Manos</h2>
              <button
                type="button"
                className="cartoon-icon-btn"
                onClick={onClose}
                data-testid="modal-close"
              >
                ✕ Cerrar
              </button>
            </div>

            {state.history.length === 0 ? (
              <p style={{ color: 'var(--ivory-muted)' }}>
                Aún no se han completado manos en esta sesión.
              </p>
            ) : (
              <div className="history-list" data-testid="history-list">
                {state.history.map((round) => (
                  <div
                    key={round.roundId}
                    className="history-item"
                    data-testid={`history-item-${round.roundId}`}
                  >
                    <div className="history-item-top">
                      <span>
                        Ronda #{round.roundId.replace('round-', '')} • Crupier:{' '}
                        {round.dealerCards
                          .map((c) => `${c.rank}${SUIT_SYMBOLS[c.suit]}`)
                          .join(' ')}{' '}
                        ({round.dealerScore.total})
                      </span>
                      <span
                        style={{
                          color:
                            round.netBalanceChange > 0
                              ? '#58d68d'
                              : round.netBalanceChange < 0
                              ? '#ff7675'
                              : 'var(--gold-accent)',
                        }}
                      >
                        Neto:{' '}
                        {round.netBalanceChange > 0
                          ? `+${round.netBalanceChange}`
                          : round.netBalanceChange}{' '}
                        (Saldo: {round.endingBalance})
                      </span>
                    </div>

                    {round.playerHands.map((ph, idx) => (
                      <div key={ph.id} style={{ fontSize: '0.8rem', opacity: 0.92 }}>
                        Mano {idx + 1}:{' '}
                        {ph.cards
                          .map((c) => `${c.rank}${SUIT_SYMBOLS[c.suit]}`)
                          .join(' ')}{' '}
                        ({ph.score.total}) • Apuesta: {ph.bet} • Acciones:{' '}
                        {ph.actions.length > 0 ? ph.actions.join(', ') : 'ninguna'} •
                        Resultado: <strong>{ph.outcome.toUpperCase()}</strong> (Pago:{' '}
                        {ph.payout})
                      </div>
                    ))}

                    {round.insuranceBet > 0 && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--gold-accent)' }}>
                        Seguro: {round.insuranceBet} fichas (Neto:{' '}
                        {round.insuranceNetProfit >= 0
                          ? `+${round.insuranceNetProfit}`
                          : round.insuranceNetProfit}
                        )
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeModal === 'rules' && (
          <>
            <div className="modal-header">
              <h2 className="modal-title">📖 Reglas de la Mesa y Tabla de Pagos</h2>
              <button
                type="button"
                className="cartoon-icon-btn"
                onClick={onClose}
                data-testid="modal-close"
              >
                ✕ Cerrar
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', lineHeight: 1.5, fontSize: '0.9rem' }}>
              <p>
                <strong>Objetivo:</strong> Alcanzar una puntuación más cercana a 21 que el crupier sin pasarse (Bust).
              </p>
              <p>
                <strong>Valores de Cartas:</strong> Del 2 al 10 valen su número; J, Q y K valen 10; el As vale 11 o 1 automáticamente según convenga a la mano.
              </p>
              <p>
                <strong>Tabla de Pagos Activa:</strong>
              </p>
              <ul style={{ paddingLeft: '1.25rem' }}>
                <li>
                  <strong>Blackjack Natural (2 cartas = 21):</strong> Paga{' '}
                  {state.rules.blackjackPayout}
                </li>
                <li>
                  <strong>Victoria Normal:</strong> Paga 1:1
                </li>
                <li>
                  <strong>Seguro Ganador:</strong> Paga 2:1 sobre la apuesta de seguro
                </li>
                <li>
                  <strong>Empate (Push):</strong> Devolución íntegra de la apuesta
                </li>
                <li>
                  <strong>Rendición Tardía:</strong>{' '}
                  {state.rules.surrender === 'late'
                    ? 'Recuperas el 50% de la apuesta inicial'
                    : 'Deshabilitada en esta mesa'}
                </li>
              </ul>
              <p>
                <strong>Regla del Crupier:</strong>{' '}
                {state.rules.dealerSoft17 === 'S17'
                  ? 'El crupier pide con 16 o menos y se planta en cualquier 17 (duro o suave).'
                  : 'El crupier pide con 16 o menos y también pide con 17 suave (H17).'}
              </p>
            </div>
          </>
        )}

        {activeModal === 'reset_confirm' && (
          <>
            <div className="modal-header">
              <h2 className="modal-title">↺ Reiniciar Sesión</h2>
              <button
                type="button"
                className="cartoon-icon-btn"
                onClick={onClose}
                data-testid="modal-close"
              >
                ✕ Cerrar
              </button>
            </div>

            <p style={{ marginBottom: '1rem', lineHeight: 1.45 }}>
              ¿Estás seguro de que deseas iniciar una nueva sesión? Se reiniciará el historial de manos, las estadísticas acumuladas y se volverá a barajar el zapato completo.
            </p>

            <div className="form-field" style={{ marginBottom: '1.1rem' }}>
              <label>Selecciona el saldo inicial para la nueva sesión:</label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                {PRESET_BALANCES.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={`cartoon-icon-btn ${
                      draftBalance === preset ? 'active' : ''
                    }`}
                    onClick={() => setDraftBalance(preset)}
                    data-testid={`reset-preset-${preset}`}
                  >
                    {preset} fichas
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="cartoon-action-btn btn-utility"
                onClick={onClose}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="cartoon-action-btn btn-stand-crimson"
                onClick={() => {
                  onConfirmReset(draftBalance);
                  onClose();
                }}
                data-testid="confirm-reset-btn"
              >
                Confirmar Reinicio ({draftBalance} fichas)
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

