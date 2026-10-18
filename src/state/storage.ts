import { createInitialGameState } from '../engine/gameEngine';
import { normalizeTableRules } from '../engine/rules';
import { GameState, RoundSummary, TableRules } from '../engine/types';

export const SESSION_STORAGE_KEY = 'blackjack_simulator_session_v1';

export interface SessionStatistics {
  roundsPlayed: number;
  handsPlayed: number;
  wins: number;
  losses: number;
  pushes: number;
  naturalBlackjacks: number;
  currentBalance: number;
  initialBalance: number;
  netProfit: number;
  averageBet: number;
  winRatePercent: number;
}

export interface PersistedSessionData {
  version: 1;
  rules: TableRules;
  balance: number;
  initialBalance: number;
  stagedBet: number;
  roundNumber: number;
  settledRoundIds: string[];
  history: RoundSummary[];
}

/**
 * Calculates aggregate session statistics from the game state and its round history.
 */
export function calculateSessionStats(state: GameState): SessionStatistics {
  let handsPlayed = 0;
  let wins = 0;
  let losses = 0;
  let pushes = 0;
  let naturalBlackjacks = 0;
  let totalBetSum = 0;

  for (const round of state.history) {
    for (const hand of round.playerHands) {
      handsPlayed += 1;
      totalBetSum += hand.bet;

      if (hand.outcome === 'blackjack') {
        wins += 1;
        naturalBlackjacks += 1;
      } else if (hand.outcome === 'win') {
        wins += 1;
      } else if (hand.outcome === 'push') {
        pushes += 1;
      } else {
        losses += 1;
      }
    }
  }

  const roundsPlayed = state.history.length;
  const averageBet =
    handsPlayed > 0 ? Number((totalBetSum / handsPlayed).toFixed(2)) : 0;
  const winRatePercent =
    handsPlayed > 0 ? Number(((wins / handsPlayed) * 100).toFixed(1)) : 0;
  const netProfit = Number((state.balance - state.initialBalance).toFixed(2));

  return {
    roundsPlayed,
    handsPlayed,
    wins,
    losses,
    pushes,
    naturalBlackjacks,
    currentBalance: state.balance,
    initialBalance: state.initialBalance,
    netProfit,
    averageBet,
    winRatePercent,
  };
}

/**
 * Persists the current session to localStorage ONLY when the game is between rounds
 * (never mid-hand) so incomplete hands cannot be re-settled or corrupted on reload.
 */
export function saveSessionToStorage(state: GameState): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  const isSafeBetweenRounds =
    state.phase === 'BETTING' ||
    state.phase === 'ROUND_OVER' ||
    state.phase === 'OUT_OF_CHIPS' ||
    state.phase === 'CONFIGURING';

  if (!isSafeBetweenRounds) {
    return;
  }

  const payload: PersistedSessionData = {
    version: 1,
    rules: state.rules,
    balance: state.balance,
    initialBalance: state.initialBalance,
    stagedBet: state.stagedBet,
    roundNumber: state.roundNumber,
    settledRoundIds: state.settledRoundIds.slice(-100),
    history: state.history.slice(0, 100),
  };

  try {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota errors in restricted environments
  }
}

/**
 * Restores a coherent GameState from localStorage, or returns null if none exists or data is invalid.
 */
export function loadSessionFromStorage(): GameState | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<PersistedSessionData>;
    if (
      parsed.version !== 1 ||
      typeof parsed.balance !== 'number' ||
      !Number.isFinite(parsed.balance) ||
      parsed.balance < 0 ||
      typeof parsed.initialBalance !== 'number' ||
      parsed.initialBalance <= 0
    ) {
      return null;
    }

    const rules = normalizeTableRules(parsed.rules);
    const base = createInitialGameState({
      initialBalance: parsed.initialBalance,
      rules,
    });

    const canPlay = parsed.balance >= rules.minBet;
    const restoredStagedBet = canPlay
      ? Math.min(
          Math.max(parsed.stagedBet ?? rules.minBet, rules.minBet),
          Math.min(parsed.balance, rules.maxBet)
        )
      : 0;

    const history = Array.isArray(parsed.history) ? parsed.history : [];

    return {
      ...base,
      phase: canPlay ? 'BETTING' : 'OUT_OF_CHIPS',
      balance: parsed.balance,
      initialBalance: parsed.initialBalance,
      stagedBet: restoredStagedBet,
      roundNumber:
        typeof parsed.roundNumber === 'number' ? parsed.roundNumber : history.length,
      settledRoundIds: Array.isArray(parsed.settledRoundIds)
        ? parsed.settledRoundIds
        : [],
      history,
      lastRoundSummary: history[0] ?? null,
      message: canPlay
        ? 'Sesión restaurada. Realiza tu apuesta para continuar.'
        : 'Sesión restaurada sin saldo suficiente para la apuesta mínima.',
    };
  } catch {
    return null;
  }
}

/**
 * Clears the persisted session from localStorage.
 */
export function clearSessionStorage(): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

