import { calculateHandScore, getRankValue } from './scoring';
import { Card, GameState, PlayerHand, TableRules } from './types';

export const DEFAULT_TABLE_RULES: TableRules = {
  deckCount: 6,
  penetration: 0.75,
  dealerSoft17: 'S17',
  blackjackPayout: '3:2',
  insuranceEnabled: true,
  surrender: 'late',
  doubleAfterSplit: true,
  splitSameValueTenCards: false,
  resplitAces: false,
  hitSplitAces: false,
  maxSplitHands: 4,
  doubleRestriction: 'any',
  minBet: 10,
  maxBet: 500,
};

/**
 * Validates and normalizes partial or full TableRules.
 */
export function normalizeTableRules(
  partial: Partial<TableRules> = {}
): TableRules {
  const merged: TableRules = {
    ...DEFAULT_TABLE_RULES,
    ...partial,
  };

  const validDeckCount = Math.max(
    1,
    Math.min(8, Math.round(merged.deckCount))
  );
  const validPenetration = Math.max(
    0.25,
    Math.min(0.9, Number(merged.penetration) || DEFAULT_TABLE_RULES.penetration)
  );
  const validMinBet = Math.max(1, Math.floor(merged.minBet));
  const validMaxBet = Math.max(validMinBet, Math.floor(merged.maxBet));
  const validMaxSplitHands = Math.max(
    2,
    Math.min(4, Math.floor(merged.maxSplitHands))
  );

  return {
    ...merged,
    deckCount: validDeckCount,
    penetration: validPenetration,
    minBet: validMinBet,
    maxBet: validMaxBet,
    maxSplitHands: validMaxSplitHands,
  };
}

/**
 * Deterministic casino dealer rule:
 * - Always hits on totals < 17
 * - On 17: hits ONLY if the hand is soft 17 AND the table uses H17
 * - Always stands on hard 17+, or soft 18+
 */
export function shouldDealerHit(
  dealerCards: readonly Pick<Card, 'rank'>[],
  rules: Pick<TableRules, 'dealerSoft17'>
): boolean {
  const score = calculateHandScore(dealerCards, false);
  if (score.total < 17) {
    return true;
  }
  if (score.total === 17 && score.isSoft && rules.dealerSoft17 === 'H17') {
    return true;
  }
  return false;
}

/**
 * Checks whether two cards form an eligible pair for splitting according to the table rules.
 * By default (splitSameValueTenCards = false), both cards must share the exact same rank (e.g., K-K or 8-8).
 * When splitSameValueTenCards = true, any two 10-value cards (10, J, Q, K) can also be split.
 */
export function isSplittablePair(
  cards: readonly Pick<Card, 'rank'>[],
  rules: Pick<TableRules, 'splitSameValueTenCards'>
): boolean {
  if (cards.length !== 2) {
    return false;
  }
  const [first, second] = cards;
  if (first.rank === second.rank) {
    return true;
  }
  if (rules.splitSameValueTenCards) {
    return getRankValue(first.rank) === 10 && getRankValue(second.rank) === 10;
  }
  return false;
}

/**
 * Checks if the active hand can Hit.
 */
export function canHandHit(hand: PlayerHand, rules: TableRules): boolean {
  if (hand.status !== 'active') {
    return false;
  }
  const score = calculateHandScore(hand.cards, hand.isFromSplit);
  if (score.total >= 21) {
    return false;
  }
  if (hand.splitFromAces && !rules.hitSplitAces && hand.cards.length >= 2) {
    return false;
  }
  return true;
}

/**
 * Checks if the active hand can Stand.
 */
export function canHandStand(hand: PlayerHand): boolean {
  return hand.status === 'active';
}

/**
 * Checks if the active hand is eligible to Double Down.
 */
export function canHandDouble(
  hand: PlayerHand,
  balance: number,
  rules: TableRules
): boolean {
  if (hand.status !== 'active' || hand.cards.length !== 2) {
    return false;
  }
  if (balance < hand.bet) {
    return false;
  }
  if (hand.isFromSplit && !rules.doubleAfterSplit) {
    return false;
  }
  if (hand.splitFromAces) {
    return false;
  }

  const score = calculateHandScore(hand.cards, hand.isFromSplit);
  if (score.total >= 21) {
    return false;
  }

  if (rules.doubleRestriction === '9-11') {
    return score.total >= 9 && score.total <= 11;
  }
  if (rules.doubleRestriction === '10-11') {
    return score.total >= 10 && score.total <= 11;
  }

  return true;
}

/**
 * Checks if the active hand is eligible to Split.
 */
export function canHandSplit(
  hand: PlayerHand,
  totalHandsCount: number,
  balance: number,
  rules: TableRules
): boolean {
  if (hand.status !== 'active' || hand.cards.length !== 2) {
    return false;
  }
  if (totalHandsCount >= rules.maxSplitHands) {
    return false;
  }
  if (balance < hand.bet) {
    return false;
  }
  if (hand.splitFromAces && !rules.resplitAces) {
    return false;
  }
  return isSplittablePair(hand.cards, rules);
}

/**
 * Checks if the active hand is eligible to Surrender (late surrender on initial 2-card hand before any action/split).
 */
export function canHandSurrender(
  hand: PlayerHand,
  totalHandsCount: number,
  rules: TableRules
): boolean {
  if (rules.surrender === 'none') {
    return false;
  }
  if (hand.status !== 'active' || hand.cards.length !== 2) {
    return false;
  }
  if (hand.isFromSplit || totalHandsCount > 1 || hand.actionsTaken.length > 0) {
    return false;
  }
  return true;
}

/**
 * Checks if insurance can currently be taken.
 */
export function canTakeInsurance(state: GameState): {
  eligible: boolean;
  maxInsuranceBet: number;
  reason?: string;
} {
  if (state.phase !== 'INSURANCE_OFFERED') {
    return { eligible: false, maxInsuranceBet: 0, reason: 'Not in insurance phase.' };
  }
  if (!state.rules.insuranceEnabled) {
    return { eligible: false, maxInsuranceBet: 0, reason: 'Insurance is disabled.' };
  }
  const upcard = state.dealerCards[0];
  if (!upcard || upcard.rank !== 'A') {
    return { eligible: false, maxInsuranceBet: 0, reason: 'Dealer upcard is not an Ace.' };
  }
  const mainBet = state.playerHands[0]?.bet ?? 0;
  const maxInsuranceBet = mainBet / 2;
  if (state.balance < maxInsuranceBet || maxInsuranceBet <= 0) {
    return {
      eligible: false,
      maxInsuranceBet,
      reason: 'Insufficient balance for insurance bet.',
    };
  }
  return { eligible: true, maxInsuranceBet };
}
