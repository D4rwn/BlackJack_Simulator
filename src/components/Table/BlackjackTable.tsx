import React from 'react';
import {
  getAvailableActions,
  getCommittedChipsSummary,
  getPublicDealerView,
} from '../../engine/gameEngine';
import { calculateHandScore } from '../../engine/scoring';
import {
  ChipDenomination,
  GameState,
  HandOutcome,
  PlayerHand,
} from '../../engine/types';
import { PlayingCard } from '../Cards/PlayingCard';
import { BettingZone } from '../Chips/BettingZone';
import { ActionControls } from '../Controls/ActionControls';

export type ActiveModalType =
  | 'none'
  | 'settings'
  | 'history'
  | 'stats'
  | 'rules'
  | 'reset_confirm';

export interface BlackjackTableProps {
  state: GameState;
  activeModal: ActiveModalType;
  onOpenModal: (modal: ActiveModalType) => void;
  onAddChip: (denom: ChipDenomination) => void;
  onRemoveChip: (denom: ChipDenomination) => void;
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

const OUTCOME_LABELS_ES: Record<HandOutcome, string> = {
  blackjack: '¡Blackjack!',
  win: 'Ganada',
  push: 'Empate (Push)',
  lose: 'Perdida',
  bust: 'Pasado (Bust)',
  surrender: 'Rendida',
};

function formatHandScoreLabel(hand: PlayerHand): string {
  const score = calculateHandScore(hand.cards, hand.isFromSplit);
  if (score.isNaturalBlackjack) {
    return '21 ★ BJ';
  }
  if (score.isSoft && score.total < 21) {
    return `${score.total - 10} / ${score.total}`;
  }
  return String(score.total);
}

export const BlackjackTable: React.FC<BlackjackTableProps> = ({
  state,
  activeModal,
  onOpenModal,
  onAddChip,
  onRemoveChip,
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
  const publicDealer = getPublicDealerView(state);
  const availableActions = getAvailableActions(state);
  const chipSummary = getCommittedChipsSummary(state);

  const shoeRemainingPct =
    state.shoe.totalCards > 0
      ? Math.round((state.shoe.cards.length / state.shoe.totalCards) * 100)
      : 100;

  const canModifyBet = state.phase === 'BETTING';

  const activeTableBet =
    state.playerHands.length > 0
      ? chipSummary.totalCommittedOnTable - chipSummary.insuranceBet
      : state.stagedBet;

  return (
    <div className="casino-viewport" data-testid="blackjack-table">
      {/* Top HUD Bar */}
      <header className="table-hud">
        <div className="hud-brand">
          <div className="hud-brand-badge" aria-hidden="true">
            ♠
          </div>
          <div>
            <div className="hud-brand-title">ROYAL FELT BLACKJACK</div>
            <div className="hud-brand-subtitle">
              {state.rules.deckCount}{' '}
              {state.rules.deckCount === 1 ? 'Baraja' : 'Barajas'} •{' '}
              {state.rules.dealerSoft17} • BJ {state.rules.blackjackPayout}
            </div>
          </div>
        </div>

        <div className="hud-metrics">
          <div className="hud-pill" data-testid="hud-balance">
            <span className="hud-pill-label">Saldo</span>
            <span className="hud-pill-value">{state.balance} fichas</span>
          </div>

          <div className="hud-pill" data-testid="hud-committed">
            <span className="hud-pill-label">En Mesa</span>
            <span className="hud-pill-value">
              {chipSummary.totalCommittedOnTable > 0
                ? `${chipSummary.totalCommittedOnTable} fichas`
                : `${state.stagedBet} fichas`}
            </span>
          </div>

          <div className="hud-pill" data-testid="hud-net-profit">
            <span className="hud-pill-label">Sesión</span>
            <span
              className={`hud-pill-value ${
                chipSummary.netSessionProfit > 0
                  ? 'positive'
                  : chipSummary.netSessionProfit < 0
                  ? 'negative'
                  : ''
              }`}
            >
              {chipSummary.netSessionProfit > 0 ? '+' : ''}
              {chipSummary.netSessionProfit}
            </span>
          </div>
        </div>

        <nav className="hud-nav-buttons" aria-label="Paneles de mesa">
          <button
            type="button"
            className={`cartoon-icon-btn ${
              activeModal === 'settings' ? 'active' : ''
            }`}
            onClick={() => onOpenModal('settings')}
            data-testid="nav-settings"
          >
            ⚙ Mesa
          </button>
          <button
            type="button"
            className={`cartoon-icon-btn ${
              activeModal === 'stats' ? 'active' : ''
            }`}
            onClick={() => onOpenModal('stats')}
            data-testid="nav-stats"
          >
            📊 Estadísticas
          </button>
          <button
            type="button"
            className={`cartoon-icon-btn ${
              activeModal === 'history' ? 'active' : ''
            }`}
            onClick={() => onOpenModal('history')}
            data-testid="nav-history"
          >
            📜 Historial ({state.history.length})
          </button>
          <button
            type="button"
            className={`cartoon-icon-btn ${
              activeModal === 'rules' ? 'active' : ''
            }`}
            onClick={() => onOpenModal('rules')}
            data-testid="nav-rules"
          >
            📖 Reglas
          </button>
          <button
            type="button"
            className="cartoon-icon-btn"
            onClick={() => onOpenModal('reset_confirm')}
            data-testid="nav-reset"
          >
            ↺ Reiniciar
          </button>
        </nav>
      </header>

      {/* Main Felt Arena */}
      <main className="table-felt-arena">
        {/* Illustrated Shoe Widget */}
        <aside className="shoe-widget" aria-label="Estado del zapato de cartas">
          <div className="shoe-box-illustration" aria-hidden="true">
            <div
              className="shoe-cards-bar"
              style={{ width: `${shoeRemainingPct}%` }}
            />
          </div>
          <div className="shoe-info">
            <strong>
              Zapato: {state.shoe.cards.length}/{state.shoe.totalCards}
            </strong>
            <span>
              Corte al {Math.round(state.rules.penetration * 100)}% (
              {shoeRemainingPct}% disp.)
            </span>
          </div>
        </aside>

        {/* Dealer Hand Zone */}
        <section className="dealer-zone" aria-label="Zona del crupier">
          <div className="zone-header">
            <span className="zone-label">Crupier</span>
            {publicDealer.cards.length > 0 && (
              <span
                className={`score-pill ${
                  publicDealer.visibleScore.isNaturalBlackjack
                    ? 'blackjack'
                    : publicDealer.visibleScore.isBust
                    ? 'bust'
                    : ''
                }`}
                data-testid="dealer-score"
              >
                {publicDealer.visibleScore.total}
              </span>
            )}
          </div>

          <div className="cards-fan" data-testid="dealer-cards">
            {publicDealer.cards.length > 0 ? (
              publicDealer.cards.map((card, idx) => (
                <PlayingCard key={card.id} card={card} index={idx} />
              ))
            ) : (
              <span
                style={{
                  fontSize: '0.8rem',
                  color: 'rgba(249, 246, 238, 0.45)',
                  fontWeight: 700,
                }}
              >
                Esperando reparto...
              </span>
            )}
          </div>
        </section>

        {/* Felt Curved Casino Inscriptions */}
        <div className="table-inscriptions" data-testid="table-inscriptions">
          <div className="inscription-main">
            BLACKJACK PAGA {state.rules.blackjackPayout === '3:2' ? '3 A 2' : '6 A 5'}
          </div>
          <div className="inscription-sub">
            {state.rules.dealerSoft17 === 'S17'
              ? 'EL CRUPIER SE PLANTA EN TODO 17'
              : 'EL CRUPIER PIDE EN 17 SUAVE'}{' '}
            {state.rules.insuranceEnabled ? '• SEGURO PAGA 2 A 1' : '• SIN SEGURO'}
          </div>
        </div>

        {/* Status Message Banner */}
        <div
          className="table-status-banner"
          role="status"
          aria-live="polite"
          data-testid="table-status-message"
        >
          {state.message}
        </div>

        {/* Player Hands Area */}
        <section
          className="player-hands-container"
          aria-label="Manos del jugador"
          data-testid="player-hands"
        >
          {state.playerHands.length > 0 ? (
            state.playerHands.map((hand, idx) => {
              const isActive =
                state.phase === 'PLAYER_TURN' && state.activeHandIndex === idx;
              const score = calculateHandScore(hand.cards, hand.isFromSplit);

              return (
                <div
                  key={hand.id}
                  className={`hand-seat ${isActive ? 'active-turn' : ''}`}
                  data-testid={`player-hand-${idx}`}
                >
                  {isActive && (
                    <span className="active-turn-pointer">
                      {state.playerHands.length > 1
                        ? `Mano Activa (${idx + 1}/${state.playerHands.length})`
                        : 'Tu Turno'}
                    </span>
                  )}

                  <div className="zone-header">
                    <span className="zone-label">
                      {state.playerHands.length > 1
                        ? `Mano ${idx + 1}`
                        : 'Jugador'}
                    </span>
                    <span
                      className={`score-pill ${
                        score.isNaturalBlackjack
                          ? 'blackjack'
                          : score.isBust
                          ? 'bust'
                          : ''
                      }`}
                      data-testid={`player-hand-${idx}-score`}
                    >
                      {formatHandScoreLabel(hand)}
                    </span>
                  </div>

                  <div className="cards-fan">
                    {hand.cards.map((card, cIdx) => (
                      <PlayingCard key={card.id} card={card} index={cIdx} />
                    ))}
                  </div>

                  <div className="hand-meta-row">
                    <span className="hand-bet-tag">
                      Apuesta: {hand.bet}
                      {hand.isDoubled ? ' (2x)' : ''}
                    </span>

                    {hand.outcome && (
                      <span
                        className={`hand-outcome-badge outcome-${hand.outcome}`}
                        data-testid={`player-hand-${idx}-outcome`}
                      >
                        {OUTCOME_LABELS_ES[hand.outcome]} (
                        {hand.netProfit! >= 0
                          ? `+${hand.netProfit}`
                          : hand.netProfit}
                        )
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="hand-seat">
              <span
                style={{
                  fontSize: '0.84rem',
                  color: 'rgba(249, 246, 238, 0.65)',
                  fontWeight: 700,
                }}
              >
                Coloca tus fichas y pulsa Repartir para iniciar la ronda
              </span>
            </div>
          )}
        </section>

        {/* Felt Betting Spot */}
        <BettingZone
          amount={activeTableBet}
          insuranceBet={state.insurance.taken ? state.insurance.bet : 0}
          canEdit={canModifyBet}
          onRemoveChip={onRemoveChip}
        />
      </main>

      {/* Bottom Wood & Leather Rail + Controls */}
      <ActionControls
        phase={state.phase}
        balance={state.balance}
        stagedBet={state.stagedBet}
        rules={state.rules}
        availableActions={availableActions}
        onAddChip={onAddChip}
        onSetExactBet={onSetExactBet}
        onClearBet={onClearBet}
        onHalfBet={onHalfBet}
        onDoubleBet={onDoubleBet}
        onMaxBet={onMaxBet}
        onDeal={onDeal}
        onHit={onHit}
        onStand={onStand}
        onDoubleDown={onDoubleDown}
        onSplit={onSplit}
        onSurrender={onSurrender}
        onInsuranceDecision={onInsuranceDecision}
        onNextRound={onNextRound}
        onRefillBalance={onRefillBalance}
      />
    </div>
  );
};
