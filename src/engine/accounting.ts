import {
  canHandDouble,
  canHandHit,
  canHandSplit,
  canHandStand,
  canHandSurrender,
  canTakeInsurance,
  isSplittablePair,
} from './rules';
import { calculateHandScore } from './scoring';
import {
  ActionAvailability,
  AvailableActionsMap,
  ChipBreakdownItem,
  ChipDefinition,
  ChipDenomination,
  CommittedChipsSummary,
  GameState,
  HandOutcome,
  TableRules,
} from './types';

export const CHIP_DENOMINATIONS: readonly ChipDenomination[] = [
  1, 5, 25, 100, 500,
];

export const CHIP_DEFINITIONS: readonly ChipDefinition[] = [
  {
    denomination: 1,
    label: '1',
    primaryColor: '#e8e4d9',
    accentColor: '#2c5e9e',
    textColor: '#1b263b',
  },
  {
    denomination: 5,
    label: '5',
    primaryColor: '#c9302c',
    accentColor: '#f5f0e6',
    textColor: '#ffffff',
  },
  {
    denomination: 25,
    label: '25',
    primaryColor: '#1f7a4c',
    accentColor: '#f5f0e6',
    textColor: '#ffffff',
  },
  {
    denomination: 100,
    label: '100',
    primaryColor: '#22252a',
    accentColor: '#d4af37',
    textColor: '#f8e49b',
  },
  {
    denomination: 500,
    label: '500',
    primaryColor: '#5b2c6f',
    accentColor: '#d4af37',
    textColor: '#ffffff',
  },
];

/**
 * Checks whether the game is in a phase where the player is allowed to prepare/modify the main bet.
 */
export function canModifyStagedBet(state: GameState): boolean {
  return state.phase === 'BETTING' || state.phase === 'ROUND_OVER';
}

/**
 * Decomposes any positive amount into casino chip denominations (500, 100, 25, 5, 1).
 */
export function decomposeAmountToChips(amount: number): ChipBreakdownItem[] {
  if (!Number.isFinite(amount) || amount <= 0) {
    return [];
  }

  let remaining = Math.floor(amount);
  const breakdown: ChipBreakdownItem[] = [];
  const descending: ChipDenomination[] = [500, 100, 25, 5, 1];

  for (const denom of descending) {
    const count = Math.floor(remaining / denom);
    if (count > 0) {
      breakdown.push({ denomination: denom, count });
      remaining -= count * denom;
    }
  }

  return breakdown;
}

/**
 * Validates whether a proposed bet amount can be confirmed to start a round.
 */
export function validateBetForDeal(
  bet: number,
  balance: number,
  rules: Pick<TableRules, 'minBet' | 'maxBet'>
): { valid: boolean; reason?: string } {
  if (typeof bet !== 'number' || !Number.isFinite(bet) || Number.isNaN(bet)) {
    return { valid: false, reason: 'El importe de la apuesta debe ser numérico.' };
  }
  if (bet <= 0) {
    return { valid: false, reason: 'El importe de la apuesta debe ser mayor que 0.' };
  }
  if (balance < rules.minBet) {
    return {
      valid: false,
      reason: `Saldo insuficiente (${balance}) para cubrir la apuesta mínima (${rules.minBet}).`,
    };
  }
  if (bet < rules.minBet) {
    return {
      valid: false,
      reason: `La apuesta mínima de la mesa es de ${rules.minBet} fichas.`,
    };
  }
  if (bet > rules.maxBet) {
    return {
      valid: false,
      reason: `La apuesta máxima de la mesa es de ${rules.maxBet} fichas.`,
    };
  }
  if (bet > balance) {
    return {
      valid: false,
      reason: `La apuesta (${bet}) supera tu saldo disponible (${balance}).`,
    };
  }
  return { valid: true };
}

/**
 * Sets an exact staged bet prior to dealing, enforcing valid numerical input and table/balance bounds.
 */
export function setStagedBet(state: GameState, amount: number): GameState {
  if (!canModifyStagedBet(state)) {
    throw new Error('No se puede modificar la apuesta principal durante una mano en curso.');
  }
  if (typeof amount !== 'number' || !Number.isFinite(amount) || Number.isNaN(amount)) {
    throw new Error('El importe de apuesta debe ser un número válido.');
  }
  if (amount < 0) {
    throw new Error('El importe de apuesta no puede ser negativo.');
  }

  const maxAllowed = Math.min(state.balance, state.rules.maxBet);
  const normalized = Math.floor(amount);

  if (normalized > state.balance) {
    throw new Error('No puedes preparar una apuesta superior a tu saldo disponible.');
  }
  if (normalized > state.rules.maxBet) {
    throw new Error(`La apuesta no puede superar el máximo de la mesa (${state.rules.maxBet}).`);
  }

  return {
    ...state,
    phase: state.phase === 'ROUND_OVER' ? 'BETTING' : state.phase,
    stagedBet: Math.min(normalized, maxAllowed),
  };
}

/**
 * Adds a chip of a specific denomination to the staged bet.
 */
export function addChipToBet(
  state: GameState,
  denomination: ChipDenomination
): GameState {
  if (!canModifyStagedBet(state)) {
    throw new Error('No se pueden añadir fichas durante una mano en curso.');
  }
  if (!CHIP_DENOMINATIONS.includes(denomination)) {
    throw new Error(`Denominación de ficha inválida: ${denomination}`);
  }

  const nextBet = state.stagedBet + denomination;
  if (nextBet > state.balance) {
    throw new Error('Saldo insuficiente para añadir esta ficha.');
  }
  if (nextBet > state.rules.maxBet) {
    throw new Error(`La apuesta superaría el límite máximo de la mesa (${state.rules.maxBet}).`);
  }

  return {
    ...state,
    phase: state.phase === 'ROUND_OVER' ? 'BETTING' : state.phase,
    stagedBet: nextBet,
  };
}

/**
 * Removes a chip amount from the staged bet (down to 0).
 */
export function removeChipFromBet(
  state: GameState,
  denomination: ChipDenomination
): GameState {
  if (!canModifyStagedBet(state)) {
    throw new Error('No se pueden retirar fichas durante una mano en curso.');
  }
  if (!CHIP_DENOMINATIONS.includes(denomination)) {
    throw new Error(`Denominación de ficha inválida: ${denomination}`);
  }

  const nextBet = Math.max(0, state.stagedBet - denomination);
  return {
    ...state,
    phase: state.phase === 'ROUND_OVER' ? 'BETTING' : state.phase,
    stagedBet: nextBet,
  };
}

/**
 * Clears the staged bet to 0 so the player can build a new bet from scratch.
 */
export function clearStagedBet(state: GameState): GameState {
  if (!canModifyStagedBet(state)) {
    throw new Error('No se puede limpiar la apuesta durante una mano en curso.');
  }

  return {
    ...state,
    phase: state.phase === 'ROUND_OVER' ? 'BETTING' : state.phase,
    stagedBet: 0,
  };
}

/**
 * Doubles the staged bet prior to dealing, capped at maxBet and available balance.
 */
export function doubleStagedBet(state: GameState): GameState {
  if (!canModifyStagedBet(state)) {
    throw new Error('No se puede modificar la apuesta durante una mano en curso.');
  }

  const cap = Math.min(state.balance, state.rules.maxBet);
  const base = state.stagedBet > 0 ? state.stagedBet * 2 : state.rules.minBet;
  const nextBet = Math.min(base, cap);

  return {
    ...state,
    phase: state.phase === 'ROUND_OVER' ? 'BETTING' : state.phase,
    stagedBet: nextBet,
  };
}

/**
 * Halves the staged bet prior to dealing, floored to minBet (or balance if lower).
 */
export function halfStagedBet(state: GameState): GameState {
  if (!canModifyStagedBet(state)) {
    throw new Error('No se puede modificar la apuesta durante una mano en curso.');
  }

  const minFloor = Math.min(state.rules.minBet, state.balance);
  const halved = Math.floor(state.stagedBet / 2);
  const nextBet = Math.max(minFloor, halved);

  return {
    ...state,
    phase: state.phase === 'ROUND_OVER' ? 'BETTING' : state.phase,
    stagedBet: nextBet,
  };
}

/**
 * Sets the staged bet to the maximum allowed by the table and player's balance.
 */
export function maxStagedBet(state: GameState): GameState {
  if (!canModifyStagedBet(state)) {
    throw new Error('No se puede modificar la apuesta durante una mano en curso.');
  }

  const maxAllowed = Math.min(state.balance, state.rules.maxBet);
  return {
    ...state,
    phase: state.phase === 'ROUND_OVER' ? 'BETTING' : state.phase,
    stagedBet: maxAllowed,
  };
}

/**
 * Calculates the payout (total returned to player balance) and net profit for a resolved hand.
 * Since the bet was already deducted from balance when placed/doubled/split:
 * - Win (1:1): payout = bet * 2, netProfit = +bet
 * - Natural Blackjack (3:2): payout = bet * 2.5, netProfit = +bet * 1.5
 * - Natural Blackjack (6:5): payout = bet * 2.2, netProfit = +bet * 1.2
 * - Push: payout = bet, netProfit = 0
 * - Surrender: payout = bet * 0.5, netProfit = -bet * 0.5
 * - Lose / Bust: payout = 0, netProfit = -bet
 */
export function calculateHandPayout(
  bet: number,
  outcome: HandOutcome,
  rules: Pick<TableRules, 'blackjackPayout'>
): { payout: number; netProfit: number } {
  switch (outcome) {
    case 'blackjack': {
      const multiplier = rules.blackjackPayout === '3:2' ? 1.5 : 1.2;
      const netProfit = Number((bet * multiplier).toFixed(2));
      return {
        payout: Number((bet + netProfit).toFixed(2)),
        netProfit,
      };
    }
    case 'win':
      return {
        payout: Number((bet * 2).toFixed(2)),
        netProfit: Number(bet.toFixed(2)),
      };
    case 'push':
      return {
        payout: Number(bet.toFixed(2)),
        netProfit: 0,
      };
    case 'surrender': {
      const returned = Number((bet / 2).toFixed(2));
      return {
        payout: returned,
        netProfit: Number((-returned).toFixed(2)),
      };
    }
    case 'lose':
    case 'bust':
    default:
      return {
        payout: 0,
        netProfit: Number((-bet).toFixed(2)),
      };
  }
}

/**
 * Calculates the insurance settlement (2:1 payout on winning insurance bet).
 */
export function calculateInsurancePayout(
  insuranceBet: number,
  dealerHasNaturalBlackjack: boolean
): { outcome: 'win' | 'lose'; payout: number; netProfit: number } {
  if (dealerHasNaturalBlackjack) {
    const netProfit = Number((insuranceBet * 2).toFixed(2));
    const payout = Number((insuranceBet + netProfit).toFixed(2));
    return {
      outcome: 'win',
      payout,
      netProfit,
    };
  }
  return {
    outcome: 'lose',
    payout: 0,
    netProfit: Number((-insuranceBet).toFixed(2)),
  };
}

/**
 * Computes a complete financial breakdown of available balance, staged bets,
 * committed bets across main/split/double/insurance, and net session profit.
 */
export function getCommittedChipsSummary(
  state: GameState
): CommittedChipsSummary {
  const isRoundActive =
    state.phase === 'DEALING' ||
    state.phase === 'INSURANCE_OFFERED' ||
    state.phase === 'PLAYER_TURN' ||
    state.phase === 'DEALER_TURN' ||
    state.phase === 'SETTLEMENT';

  let activeMainBets = 0;
  let additionalSplitBets = 0;
  let additionalDoubleBets = 0;

  for (let i = 0; i < state.playerHands.length; i++) {
    const hand = state.playerHands[i];
    const baseHandBet = hand.isDoubled ? hand.bet / 2 : hand.bet;

    if (i === 0) {
      activeMainBets += baseHandBet;
    } else {
      additionalSplitBets += baseHandBet;
    }

    if (hand.isDoubled) {
      additionalDoubleBets += baseHandBet;
    }
  }

  const insuranceBet = state.insurance.taken ? state.insurance.bet : 0;
  const totalCommittedOnTable = Number(
    (
      activeMainBets +
      additionalSplitBets +
      additionalDoubleBets +
      insuranceBet
    ).toFixed(2)
  );

  // During an active round, committed chips are on the felt (not yet lost or won),
  // whereas after settlement (ROUND_OVER / BETTING), netSessionProfit is simply balance - initialBalance
  const effectiveEquity = isRoundActive
    ? state.balance + totalCommittedOnTable
    : state.balance;
  const netSessionProfit = Number(
    (effectiveEquity - state.initialBalance).toFixed(2)
  );

  return {
    availableBalance: state.balance,
    stagedBet: state.stagedBet,
    activeMainBets: Number(activeMainBets.toFixed(2)),
    additionalSplitBets: Number(additionalSplitBets.toFixed(2)),
    additionalDoubleBets: Number(additionalDoubleBets.toFixed(2)),
    insuranceBet: Number(insuranceBet.toFixed(2)),
    totalCommittedOnTable,
    netSessionProfit,
  };
}

/**
 * Evaluates every game action and returns whether it is enabled along with a clear user-facing reason when disabled.
 */
export function getAvailableActions(state: GameState): AvailableActionsMap {
  const dealCheck =
    state.phase === 'BETTING' || state.phase === 'ROUND_OVER'
      ? validateBetForDeal(state.stagedBet, state.balance, state.rules)
      : {
          valid: false,
          reason:
            state.phase === 'OUT_OF_CHIPS'
              ? 'Saldo agotado. Reinicia la sesión o recarga fichas.'
              : 'Hay una mano en curso.',
        };

  const deal: ActionAvailability = {
    enabled: dealCheck.valid,
    reason: dealCheck.reason,
  };

  const activeHand = state.playerHands[state.activeHandIndex];

  if (state.phase !== 'PLAYER_TURN' || !activeHand) {
    const notPlayerTurnReason = 'No es el turno de decisión de la mano.';
    const insCheck = canTakeInsurance(state);
    return {
      deal,
      hit: { enabled: false, reason: notPlayerTurnReason },
      stand: { enabled: false, reason: notPlayerTurnReason },
      double: { enabled: false, reason: notPlayerTurnReason },
      split: { enabled: false, reason: notPlayerTurnReason },
      surrender: { enabled: false, reason: notPlayerTurnReason },
      insurance: {
        enabled: insCheck.eligible,
        reason: insCheck.reason,
      },
    };
  }

  // Hit availability
  const hitEnabled = canHandHit(activeHand, state.rules);
  let hitReason: string | undefined;
  if (!hitEnabled) {
    if (activeHand.splitFromAces && !state.rules.hitSplitAces) {
      hitReason = 'Las reglas de la mesa solo permiten 1 carta por cada As dividido.';
    } else {
      hitReason = 'La mano ya alcanzó 21 o ha finalizado.';
    }
  }

  // Stand availability
  const standEnabled = canHandStand(activeHand);

  // Double availability
  const doubleEnabled = canHandDouble(activeHand, state.balance, state.rules);
  let doubleReason: string | undefined;
  if (!doubleEnabled) {
    if (activeHand.cards.length !== 2) {
      doubleReason = 'Solo se puede doblar con las 2 cartas iniciales de la mano.';
    } else if (activeHand.splitFromAces) {
      doubleReason = 'No se permite doblar tras dividir ases.';
    } else if (activeHand.isFromSplit && !state.rules.doubleAfterSplit) {
      doubleReason = 'Doblar después de dividir (DAS) está deshabilitado en esta mesa.';
    } else if (state.balance < activeHand.bet) {
      doubleReason = `Fichas insuficientes para doblar (necesitas ${activeHand.bet}, tienes ${state.balance}).`;
    } else {
      const score = calculateHandScore(activeHand.cards, activeHand.isFromSplit);
      if (
        state.rules.doubleRestriction === '9-11' &&
        (score.total < 9 || score.total > 11)
      ) {
        doubleReason = 'Esta mesa solo permite doblar con totales de 9, 10 u 11.';
      } else if (
        state.rules.doubleRestriction === '10-11' &&
        (score.total < 10 || score.total > 11)
      ) {
        doubleReason = 'Esta mesa solo permite doblar con totales de 10 u 11.';
      } else {
        doubleReason = 'No elegible para doblar.';
      }
    }
  }

  // Split availability
  const splitEnabled = canHandSplit(
    activeHand,
    state.playerHands.length,
    state.balance,
    state.rules
  );
  let splitReason: string | undefined;
  if (!splitEnabled) {
    if (activeHand.cards.length !== 2) {
      splitReason = 'Solo se puede dividir con las 2 cartas iniciales de la mano.';
    } else if (state.playerHands.length >= state.rules.maxSplitHands) {
      splitReason = `Límite máximo de manos divididas alcanzado (${state.rules.maxSplitHands}).`;
    } else if (activeHand.splitFromAces && !state.rules.resplitAces) {
      splitReason = 'Re-dividir ases está deshabilitado en esta mesa.';
    } else if (!isSplittablePair(activeHand.cards, state.rules)) {
      splitReason = state.rules.splitSameValueTenCards
        ? 'Las cartas no forman una pareja elegible para dividir.'
        : 'Las cartas deben tener el mismo rango exacto para dividir.';
    } else if (state.balance < activeHand.bet) {
      splitReason = `Fichas insuficientes para dividir (necesitas ${activeHand.bet}, tienes ${state.balance}).`;
    }
  }

  // Surrender availability
  const surrenderEnabled = canHandSurrender(
    activeHand,
    state.playerHands.length,
    state.rules
  );
  let surrenderReason: string | undefined;
  if (!surrenderEnabled) {
    if (state.rules.surrender === 'none') {
      surrenderReason = 'La rendición está deshabilitada en las reglas de la mesa.';
    } else if (activeHand.isFromSplit || state.playerHands.length > 1) {
      surrenderReason = 'No se permite rendirse después de dividir.';
    } else if (activeHand.cards.length !== 2 || activeHand.actionsTaken.length > 0) {
      surrenderReason = 'Solo se permite la rendición tardía antes de pedir cartas.';
    }
  }

  return {
    deal,
    hit: { enabled: hitEnabled, reason: hitReason },
    stand: {
      enabled: standEnabled,
      reason: standEnabled ? undefined : 'La mano no está activa.',
    },
    double: { enabled: doubleEnabled, reason: doubleReason },
    split: { enabled: splitEnabled, reason: splitReason },
    surrender: { enabled: surrenderEnabled, reason: surrenderReason },
    insurance: {
      enabled: false,
      reason: 'El seguro solo se ofrece antes del turno cuando el crupier muestra un As.',
    },
  };
}

/**
 * Adds virtual chips to the balance when out of chips or between rounds.
 * Blocked during active rounds to preserve accounting integrity.
 */
export function refillBalance(state: GameState, amount: number): GameState {
  if (
    state.phase !== 'OUT_OF_CHIPS' &&
    state.phase !== 'BETTING' &&
    state.phase !== 'ROUND_OVER' &&
    state.phase !== 'CONFIGURING'
  ) {
    throw new Error('No se puede recargar saldo durante una mano activa.');
  }
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    throw new Error('El importe de recarga debe ser un número positivo.');
  }

  const added = Math.floor(amount);
  const nextBalance = Number((state.balance + added).toFixed(2));
  const nextInitial = Number((state.initialBalance + added).toFixed(2));
  const canPlay = nextBalance >= state.rules.minBet;

  return {
    ...state,
    phase: canPlay ? 'BETTING' : 'OUT_OF_CHIPS',
    balance: nextBalance,
    initialBalance: nextInitial,
    stagedBet: canPlay
      ? Math.min(Math.max(state.stagedBet, state.rules.minBet), Math.min(nextBalance, state.rules.maxBet))
      : 0,
    message: canPlay
      ? `Se han añadido ${added} fichas al saldo. Realiza tu apuesta.`
      : 'El saldo sigue siendo inferior a la apuesta mínima.',
  };
}

