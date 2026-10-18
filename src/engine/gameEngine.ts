import {
  createShoe,
  defaultRandomSource,
  drawCardFromShoe,
  ensureShoeReadyForNewRound,
} from './deck';
import {
  canHandDouble,
  canHandHit,
  canHandSplit,
  canHandStand,
  canHandSurrender,
  canTakeInsurance,
  normalizeTableRules,
  shouldDealerHit,
} from './rules';
import { calculateHandScore, calculateVisibleHandScore } from './scoring';
import {
  Card,
  GameState,
  HandOutcome,
  PlayerHand,
  PublicCard,
  RandomSource,
  RoundSummary,
  TableRules,
} from './types';

export interface CreateGameOptions {
  initialBalance?: number;
  rules?: Partial<TableRules>;
  rng?: RandomSource;
}

/**
 * Initializes a brand-new Blackjack game state.
 */
export function createInitialGameState(
  options: CreateGameOptions = {}
): GameState {
  const rules = normalizeTableRules(options.rules);
  const initialBalance =
    typeof options.initialBalance === 'number' && options.initialBalance > 0
      ? options.initialBalance
      : 1000;
  const rng = options.rng ?? defaultRandomSource;
  const shoe = createShoe(rules.deckCount, rng, 0);

  return {
    phase: initialBalance < rules.minBet ? 'OUT_OF_CHIPS' : 'BETTING',
    rules,
    shoe,
    balance: initialBalance,
    initialBalance,
    stagedBet: Math.min(rules.minBet, initialBalance),
    playerHands: [],
    activeHandIndex: 0,
    dealerCards: [],
    insurance: {
      offered: false,
      taken: false,
      decided: false,
      bet: 0,
    },
    roundNumber: 0,
    currentRoundId: null,
    settledRoundIds: [],
    lastRoundSummary: null,
    history: [],
    message:
      initialBalance < rules.minBet
        ? 'Saldo insuficiente para la apuesta mínima.'
        : 'Realiza tu apuesta para comenzar la mano.',
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
        payout: bet * 2,
        netProfit: bet,
      };
    case 'push':
      return {
        payout: bet,
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
        netProfit: -bet,
      };
  }
}

/**
 * Compares a single player hand against the final dealer hand to determine its outcome.
 */
export function evaluateHandOutcome(
  hand: PlayerHand,
  dealerCards: readonly Card[]
): HandOutcome {
  if (hand.status === 'surrendered') {
    return 'surrender';
  }

  const playerScore = calculateHandScore(hand.cards, hand.isFromSplit);
  if (playerScore.isBust || hand.status === 'bust') {
    return 'bust';
  }

  const dealerScore = calculateHandScore(dealerCards, false);

  if (playerScore.isNaturalBlackjack && dealerScore.isNaturalBlackjack) {
    return 'push';
  }
  if (playerScore.isNaturalBlackjack) {
    return 'blackjack';
  }
  if (dealerScore.isNaturalBlackjack) {
    return 'lose';
  }
  if (dealerScore.isBust) {
    return 'win';
  }
  if (playerScore.total > dealerScore.total) {
    return 'win';
  }
  if (playerScore.total < dealerScore.total) {
    return 'lose';
  }
  return 'push';
}

/**
 * Reveals the dealer's hole card, executes deterministic dealer draws if needed,
 * and settles all hands and insurance bets exactly once.
 */
export function resolveDealerTurnAndSettle(state: GameState): GameState {
  if (
    state.currentRoundId &&
    state.settledRoundIds.includes(state.currentRoundId)
  ) {
    throw new Error('Round has already been settled.');
  }

  let currentShoe = state.shoe;
  const revealedDealerCards: Card[] = state.dealerCards.map((c) => ({
    ...c,
    faceUp: true,
  }));

  const dealerInitialScore = calculateHandScore(revealedDealerCards, false);

  // Check if any player hand requires dealer comparison (i.e., not busted, not surrendered, and not a natural blackjack against a non-blackjack dealer)
  const needsDealerDraw = state.playerHands.some((hand) => {
    if (hand.status === 'bust' || hand.status === 'surrendered') {
      return false;
    }
    const pScore = calculateHandScore(hand.cards, hand.isFromSplit);
    if (pScore.isNaturalBlackjack && !dealerInitialScore.isNaturalBlackjack) {
      return false;
    }
    return true;
  });

  if (needsDealerDraw && !dealerInitialScore.isNaturalBlackjack) {
    while (shouldDealerHit(revealedDealerCards, state.rules)) {
      const drawn = drawCardFromShoe(currentShoe, state.rules, true);
      revealedDealerCards.push(drawn.card);
      currentShoe = drawn.nextShoe;
    }
  }

  const finalDealerScore = calculateHandScore(revealedDealerCards, false);

  // Settle insurance if taken
  let totalPayout = 0;
  let insuranceState = { ...state.insurance };

  if (insuranceState.taken && insuranceState.bet > 0) {
    if (finalDealerScore.isNaturalBlackjack) {
      // Insurance pays 2:1 profit + returns the insurance bet (total 3x insurance bet)
      const insPayout = Number((insuranceState.bet * 3).toFixed(2));
      const insProfit = Number((insuranceState.bet * 2).toFixed(2));
      insuranceState = {
        ...insuranceState,
        outcome: 'win',
        payout: insPayout,
        netProfit: insProfit,
      };
      totalPayout += insPayout;
    } else {
      insuranceState = {
        ...insuranceState,
        outcome: 'lose',
        payout: 0,
        netProfit: -insuranceState.bet,
      };
    }
  }

  // Settle each player hand
  const settledHands: PlayerHand[] = state.playerHands.map((hand) => {
    const outcome = evaluateHandOutcome(hand, revealedDealerCards);
    const { payout, netProfit } = calculateHandPayout(
      hand.bet,
      outcome,
      state.rules
    );
    totalPayout = Number((totalPayout + payout).toFixed(2));
    return {
      ...hand,
      outcome,
      payout,
      netProfit,
    };
  });

  const nextBalance = Number((state.balance + totalPayout).toFixed(2));
  const totalHandBets = settledHands.reduce((acc, h) => acc + h.bet, 0);
  const totalCommitted = Number(
    (totalHandBets + (insuranceState.taken ? insuranceState.bet : 0)).toFixed(2)
  );
  const netBalanceChange = Number((totalPayout - totalCommitted).toFixed(2));

  const roundId = state.currentRoundId ?? `round-${state.roundNumber}`;

  const summary: RoundSummary = {
    roundId,
    timestamp: Date.now(),
    playerHands: settledHands.map((h) => ({
      id: h.id,
      cards: h.cards,
      score: calculateHandScore(h.cards, h.isFromSplit),
      bet: h.bet,
      actions: h.actionsTaken,
      outcome: h.outcome!,
      payout: h.payout!,
      netProfit: h.netProfit!,
      isFromSplit: h.isFromSplit,
      isDoubled: h.isDoubled,
    })),
    dealerCards: revealedDealerCards,
    dealerScore: finalDealerScore,
    mainBet: state.stagedBet,
    totalCommitted,
    insuranceBet: insuranceState.taken ? insuranceState.bet : 0,
    insuranceNetProfit: insuranceState.netProfit ?? 0,
    totalPayout,
    netBalanceChange,
    endingBalance: nextBalance,
  };

  const resultMessage = buildRoundResultMessage(settledHands, finalDealerScore);

  return {
    ...state,
    phase: 'ROUND_OVER',
    shoe: currentShoe,
    balance: nextBalance,
    playerHands: settledHands,
    dealerCards: revealedDealerCards,
    insurance: insuranceState,
    settledRoundIds: [...state.settledRoundIds, roundId],
    lastRoundSummary: summary,
    history: [summary, ...state.history],
    message: resultMessage,
  };
}

function buildRoundResultMessage(
  hands: readonly PlayerHand[],
  dealerScore: ReturnType<typeof calculateHandScore>
): string {
  if (hands.length === 1) {
    const outcome = hands[0].outcome;
    switch (outcome) {
      case 'blackjack':
        return '¡Blackjack natural! Has ganado la mano.';
      case 'win':
        return dealerScore.isBust
          ? '¡El crupier se pasa! Ganas la mano.'
          : '¡Ganas la mano!';
      case 'push':
        return 'Empate (Push). Recuperas tu apuesta.';
      case 'surrender':
        return 'Mano rendida. Recuperas la mitad de tu apuesta.';
      case 'bust':
        return 'Te has pasado de 21 (Bust).';
      case 'lose':
      default:
        return dealerScore.isNaturalBlackjack
          ? 'El crupier tiene Blackjack natural.'
          : 'El crupier gana la mano.';
    }
  }

  const wins = hands.filter(
    (h) => h.outcome === 'win' || h.outcome === 'blackjack'
  ).length;
  const pushes = hands.filter((h) => h.outcome === 'push').length;
  const losses = hands.length - wins - pushes;
  return `Ronda finalizada: ${wins} ganada(s), ${losses} perdida(s), ${pushes} empate(s).`;
}

/**
 * Advances to the next active player hand, or triggers dealer turn and settlement if all player hands are done.
 */
function advanceTurnOrResolve(state: GameState): GameState {
  const nextActiveIndex = state.playerHands.findIndex(
    (hand, idx) => idx >= state.activeHandIndex && hand.status === 'active'
  );

  if (nextActiveIndex !== -1) {
    return {
      ...state,
      phase: 'PLAYER_TURN',
      activeHandIndex: nextActiveIndex,
      message:
        state.playerHands.length > 1
          ? `Jugando mano ${nextActiveIndex + 1} de ${state.playerHands.length}.`
          : 'Tu turno: elige una acción.',
    };
  }

  return resolveDealerTurnAndSettle({
    ...state,
    phase: 'DEALER_TURN',
  });
}

/**
 * Places and confirms the main bet and deals the initial 4 cards:
 * 1. Player card 1 (face up)
 * 2. Dealer card 1 (face up)
 * 3. Player card 2 (face up)
 * 4. Dealer card 2 (face down / hole card)
 */
export function startRound(
  state: GameState,
  betAmount?: number,
  rng: RandomSource = defaultRandomSource
): GameState {
  if (state.phase !== 'BETTING' && state.phase !== 'ROUND_OVER') {
    throw new Error(`Cannot start a round during phase ${state.phase}.`);
  }

  const bet = betAmount !== undefined ? betAmount : state.stagedBet;

  if (typeof bet !== 'number' || !Number.isFinite(bet) || bet <= 0) {
    throw new Error('Bet amount must be a positive number.');
  }
  if (bet < state.rules.minBet || bet > state.rules.maxBet) {
    throw new Error(
      `Bet must be between ${state.rules.minBet} and ${state.rules.maxBet}.`
    );
  }
  if (bet > state.balance) {
    throw new Error('Bet exceeds available balance.');
  }

  let currentShoe = ensureShoeReadyForNewRound(state.shoe, state.rules, rng);

  const p1 = drawCardFromShoe(currentShoe, state.rules, true);
  currentShoe = p1.nextShoe;

  const d1 = drawCardFromShoe(currentShoe, state.rules, true);
  currentShoe = d1.nextShoe;

  const p2 = drawCardFromShoe(currentShoe, state.rules, true);
  currentShoe = p2.nextShoe;

  const d2 = drawCardFromShoe(currentShoe, state.rules, false);
  currentShoe = d2.nextShoe;

  const playerCards = [p1.card, p2.card];
  const dealerCards = [d1.card, d2.card];

  const playerScore = calculateHandScore(playerCards, false);
  const dealerHiddenScore = calculateHandScore(dealerCards, false);

  const nextRoundNumber = state.roundNumber + 1;
  const roundId = `round-${nextRoundNumber}`;

  const initialHand: PlayerHand = {
    id: `${roundId}-hand-0`,
    cards: playerCards,
    bet,
    status: playerScore.isNaturalBlackjack ? 'blackjack' : 'active',
    isFromSplit: false,
    splitFromAces: false,
    isDoubled: false,
    actionsTaken: [],
  };

  const nextBalance = Number((state.balance - bet).toFixed(2));
  const dealerShowsAce = d1.card.rank === 'A';
  const offerInsurance = dealerShowsAce && state.rules.insuranceEnabled;

  const baseState: GameState = {
    ...state,
    phase: 'DEALING',
    shoe: currentShoe,
    balance: nextBalance,
    stagedBet: bet,
    playerHands: [initialHand],
    activeHandIndex: 0,
    dealerCards,
    insurance: {
      offered: offerInsurance,
      taken: false,
      decided: false,
      bet: 0,
    },
    roundNumber: nextRoundNumber,
    currentRoundId: roundId,
    message: 'Repartiendo cartas...',
  };

  // If dealer shows an Ace and insurance is enabled, offer insurance before checking dealer blackjack
  if (offerInsurance) {
    return {
      ...baseState,
      phase: 'INSURANCE_OFFERED',
      message: 'El crupier muestra un As. ¿Deseas contratar seguro (paga 2:1)?',
    };
  }

  // If either player or dealer has natural blackjack (and no insurance prompt applies), settle immediately
  if (playerScore.isNaturalBlackjack || dealerHiddenScore.isNaturalBlackjack) {
    return resolveDealerTurnAndSettle(baseState);
  }

  return {
    ...baseState,
    phase: 'PLAYER_TURN',
    message: 'Tu turno: elige una acción.',
  };
}

/**
 * Resolves the player's insurance decision (take or decline).
 */
export function resolveInsuranceDecision(
  state: GameState,
  takeInsurance: boolean,
  customInsuranceBet?: number
): GameState {
  if (state.phase !== 'INSURANCE_OFFERED') {
    throw new Error('Insurance is not currently offered.');
  }

  const mainBet = state.playerHands[0].bet;
  const maxInsurance = Number((mainBet / 2).toFixed(2));

  let nextBalance = state.balance;
  let insuranceBet = 0;

  if (takeInsurance) {
    const check = canTakeInsurance(state);
    if (!check.eligible) {
      throw new Error(check.reason ?? 'Cannot take insurance.');
    }
    insuranceBet =
      customInsuranceBet !== undefined ? customInsuranceBet : maxInsurance;
    if (insuranceBet <= 0 || insuranceBet > maxInsurance) {
      throw new Error(
        `Insurance bet must be greater than 0 and at most ${maxInsurance}.`
      );
    }
    if (insuranceBet > state.balance) {
      throw new Error('Insufficient balance for insurance bet.');
    }
    nextBalance = Number((state.balance - insuranceBet).toFixed(2));
  }

  const updatedState: GameState = {
    ...state,
    balance: nextBalance,
    insurance: {
      ...state.insurance,
      taken: takeInsurance,
      decided: true,
      bet: insuranceBet,
    },
  };

  const playerScore = calculateHandScore(
    updatedState.playerHands[0].cards,
    false
  );
  const dealerScore = calculateHandScore(updatedState.dealerCards, false);

  // If dealer or player has natural blackjack, settle immediately
  if (dealerScore.isNaturalBlackjack || playerScore.isNaturalBlackjack) {
    return resolveDealerTurnAndSettle(updatedState);
  }

  return {
    ...updatedState,
    phase: 'PLAYER_TURN',
    message: takeInsurance
      ? 'Seguro contratado. El crupier no tiene Blackjack. Continúa tu turno.'
      : 'Seguro rechazado. Continúa tu turno.',
  };
}

/**
 * Player Action: Hit
 */
export function playerHit(state: GameState): GameState {
  if (state.phase !== 'PLAYER_TURN') {
    throw new Error('Cannot hit outside of PLAYER_TURN.');
  }

  const hand = state.playerHands[state.activeHandIndex];
  if (!hand || !canHandHit(hand, state.rules)) {
    throw new Error('Active hand is not eligible to hit.');
  }

  const drawn = drawCardFromShoe(state.shoe, state.rules, true);
  const updatedCards = [...hand.cards, drawn.card];
  const score = calculateHandScore(updatedCards, hand.isFromSplit);

  let nextStatus = hand.status;
  if (score.isBust) {
    nextStatus = 'bust';
  } else if (score.total === 21) {
    nextStatus = 'stood';
  }

  const updatedHand: PlayerHand = {
    ...hand,
    cards: updatedCards,
    status: nextStatus,
    actionsTaken: [...hand.actionsTaken, 'hit'],
  };

  const updatedHands = state.playerHands.map((h, i) =>
    i === state.activeHandIndex ? updatedHand : h
  );

  return advanceTurnOrResolve({
    ...state,
    shoe: drawn.nextShoe,
    playerHands: updatedHands,
  });
}

/**
 * Player Action: Stand
 */
export function playerStand(state: GameState): GameState {
  if (state.phase !== 'PLAYER_TURN') {
    throw new Error('Cannot stand outside of PLAYER_TURN.');
  }

  const hand = state.playerHands[state.activeHandIndex];
  if (!hand || !canHandStand(hand)) {
    throw new Error('Active hand is not eligible to stand.');
  }

  const updatedHand: PlayerHand = {
    ...hand,
    status: 'stood',
    actionsTaken: [...hand.actionsTaken, 'stand'],
  };

  const updatedHands = state.playerHands.map((h, i) =>
    i === state.activeHandIndex ? updatedHand : h
  );

  return advanceTurnOrResolve({
    ...state,
    playerHands: updatedHands,
  });
}

/**
 * Player Action: Double Down
 * Doubles the active hand's bet, deducts the extra bet from balance, deals exactly one card, and ends decisions on that hand.
 */
export function playerDouble(state: GameState): GameState {
  if (state.phase !== 'PLAYER_TURN') {
    throw new Error('Cannot double down outside of PLAYER_TURN.');
  }

  const hand = state.playerHands[state.activeHandIndex];
  if (!hand || !canHandDouble(hand, state.balance, state.rules)) {
    throw new Error('Active hand is not eligible to double down.');
  }

  const additionalBet = hand.bet;
  const nextBalance = Number((state.balance - additionalBet).toFixed(2));
  const drawn = drawCardFromShoe(state.shoe, state.rules, true);
  const updatedCards = [...hand.cards, drawn.card];
  const score = calculateHandScore(updatedCards, hand.isFromSplit);

  const updatedHand: PlayerHand = {
    ...hand,
    cards: updatedCards,
    bet: Number((hand.bet + additionalBet).toFixed(2)),
    status: score.isBust ? 'bust' : 'doubled',
    isDoubled: true,
    actionsTaken: [...hand.actionsTaken, 'double'],
  };

  const updatedHands = state.playerHands.map((h, i) =>
    i === state.activeHandIndex ? updatedHand : h
  );

  return advanceTurnOrResolve({
    ...state,
    shoe: drawn.nextShoe,
    balance: nextBalance,
    playerHands: updatedHands,
  });
}

/**
 * Player Action: Split
 * Splits an eligible pair into two independent hands, deducts an equal bet from balance,
 * and deals one card to each new hand.
 */
export function playerSplit(state: GameState): GameState {
  if (state.phase !== 'PLAYER_TURN') {
    throw new Error('Cannot split outside of PLAYER_TURN.');
  }

  const hand = state.playerHands[state.activeHandIndex];
  if (
    !hand ||
    !canHandSplit(hand, state.playerHands.length, state.balance, state.rules)
  ) {
    throw new Error('Active hand is not eligible to split.');
  }

  const additionalBet = hand.bet;
  const nextBalance = Number((state.balance - additionalBet).toFixed(2));
  const isSplittingAces =
    hand.cards[0].rank === 'A' && hand.cards[1].rank === 'A';

  let currentShoe = state.shoe;
  const draw1 = drawCardFromShoe(currentShoe, state.rules, true);
  currentShoe = draw1.nextShoe;
  const draw2 = drawCardFromShoe(currentShoe, state.rules, true);
  currentShoe = draw2.nextShoe;

  const firstCards = [hand.cards[0], draw1.card];
  const secondCards = [hand.cards[1], draw2.card];

  const firstScore = calculateHandScore(firstCards, true);
  const secondScore = calculateHandScore(secondCards, true);

  // Determine if split hands automatically stand (e.g. split Aces when hitSplitAces=false and resplitAces=false, or 21 total)
  const shouldAutoStandHand = (cards: Card[], scoreTotal: number): boolean => {
    if (scoreTotal === 21) {
      return true;
    }
    if (isSplittingAces && !state.rules.hitSplitAces) {
      const canResplitThisHand =
        state.rules.resplitAces &&
        cards[0].rank === 'A' &&
        cards[1].rank === 'A' &&
        state.playerHands.length + 1 < state.rules.maxSplitHands &&
        nextBalance >= additionalBet;
      return !canResplitThisHand;
    }
    return false;
  };

  const hand1: PlayerHand = {
    id: `${hand.id}-a`,
    cards: firstCards,
    bet: hand.bet,
    status: shouldAutoStandHand(firstCards, firstScore.total)
      ? 'stood'
      : 'active',
    isFromSplit: true,
    splitFromAces: isSplittingAces || hand.splitFromAces,
    isDoubled: false,
    actionsTaken: [...hand.actionsTaken, 'split'],
  };

  const hand2: PlayerHand = {
    id: `${hand.id}-b`,
    cards: secondCards,
    bet: additionalBet,
    status: shouldAutoStandHand(secondCards, secondScore.total)
      ? 'stood'
      : 'active',
    isFromSplit: true,
    splitFromAces: isSplittingAces || hand.splitFromAces,
    isDoubled: false,
    actionsTaken: ['split'],
  };

  const updatedHands = [
    ...state.playerHands.slice(0, state.activeHandIndex),
    hand1,
    hand2,
    ...state.playerHands.slice(state.activeHandIndex + 1),
  ];

  return advanceTurnOrResolve({
    ...state,
    shoe: currentShoe,
    balance: nextBalance,
    playerHands: updatedHands,
  });
}

/**
 * Player Action: Surrender (Late Surrender)
 * Forfeits half the bet on an initial 2-card hand and immediately ends that hand.
 */
export function playerSurrender(state: GameState): GameState {
  if (state.phase !== 'PLAYER_TURN') {
    throw new Error('Cannot surrender outside of PLAYER_TURN.');
  }

  const hand = state.playerHands[state.activeHandIndex];
  if (
    !hand ||
    !canHandSurrender(hand, state.playerHands.length, state.rules)
  ) {
    throw new Error('Active hand is not eligible to surrender.');
  }

  const updatedHand: PlayerHand = {
    ...hand,
    status: 'surrendered',
    actionsTaken: [...hand.actionsTaken, 'surrender'],
  };

  const updatedHands = state.playerHands.map((h, i) =>
    i === state.activeHandIndex ? updatedHand : h
  );

  return advanceTurnOrResolve({
    ...state,
    playerHands: updatedHands,
  });
}

/**
 * Prepares the table for the next round after ROUND_OVER.
 * Checks if balance is sufficient for minBet; otherwise transitions to OUT_OF_CHIPS.
 */
export function prepareNextRound(
  state: GameState,
  rng: RandomSource = defaultRandomSource
): GameState {
  if (state.phase !== 'ROUND_OVER') {
    throw new Error('Can only prepare next round from ROUND_OVER phase.');
  }

  const shoe = ensureShoeReadyForNewRound(state.shoe, state.rules, rng);
  const reshuffled = shoe.reshuffleCount > state.shoe.reshuffleCount;

  if (state.balance < state.rules.minBet) {
    return {
      ...state,
      phase: 'OUT_OF_CHIPS',
      shoe,
      playerHands: [],
      dealerCards: [],
      activeHandIndex: 0,
      currentRoundId: null,
      message:
        'No tienes fichas suficientes para la apuesta mínima. Reinicia la sesión o recarga fichas.',
    };
  }

  const nextStagedBet = Math.min(
    Math.max(state.stagedBet, state.rules.minBet),
    Math.min(state.rules.maxBet, state.balance)
  );

  return {
    ...state,
    phase: 'BETTING',
    shoe,
    stagedBet: nextStagedBet,
    playerHands: [],
    dealerCards: [],
    activeHandIndex: 0,
    currentRoundId: null,
    insurance: {
      offered: false,
      taken: false,
      decided: false,
      bet: 0,
    },
    message: reshuffled
      ? 'El zapato ha alcanzado la carta de corte y ha sido barajado. Realiza tu apuesta.'
      : 'Realiza tu apuesta para la siguiente mano.',
  };
}

/**
 * Returns a sanitized view of the dealer's cards and score so hidden hole cards
 * cannot leak into the UI or history before revelation.
 */
export function getPublicDealerView(state: GameState): {
  cards: PublicCard[];
  visibleScore: ReturnType<typeof calculateVisibleHandScore>;
} {
  const cards: PublicCard[] = state.dealerCards.map((card) =>
    card.faceUp
      ? {
          id: card.id,
          suit: card.suit,
          rank: card.rank,
          deckIndex: card.deckIndex,
          faceUp: true,
        }
      : {
          id: card.id,
          suit: null,
          rank: null,
          deckIndex: card.deckIndex,
          faceUp: false,
        }
  );

  return {
    cards,
    visibleScore: calculateVisibleHandScore(state.dealerCards, false),
  };
}
