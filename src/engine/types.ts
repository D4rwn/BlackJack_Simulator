export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';

export type Rank =
  | 'A'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | 'J'
  | 'Q'
  | 'K';

export interface Card {
  /** Unique physical card identifier, e.g., "deck-0-spades-A" */
  id: string;
  suit: Suit;
  rank: Rank;
  /** 0-based index of the deck this card belongs to */
  deckIndex: number;
  /** Whether the card is face up (visible to the player) */
  faceUp: boolean;
}

export interface PublicCard {
  id: string;
  suit: Suit | null;
  rank: Rank | null;
  deckIndex: number;
  faceUp: boolean;
}

export interface HandScore {
  /** Best total score (counting Aces as 11 when advantageous without busting) */
  total: number;
  /** True when at least one Ace is currently counted as 11 and total <= 21 */
  isSoft: boolean;
  /** True when total > 21 */
  isBust: boolean;
  /** True when the hand consists of exactly 2 cards totaling 21 and is NOT from a split (unless explicitly allowed) */
  isNaturalBlackjack: boolean;
}

export type DeckCountOption = 1 | 2 | 4 | 6 | 8;

export type DealerSoft17Rule = 'S17' | 'H17';

export type BlackjackPayoutRatio = '3:2' | '6:5';

export type SurrenderRule = 'none' | 'late';

export type DoubleRestrictionRule = 'any' | '9-11' | '10-11';

export interface TableRules {
  /** Number of 52-card decks in the shoe (1 to 8) */
  deckCount: number;
  /** Fraction of shoe dealt before reshuffling between rounds (e.g., 0.75 = reshuffle when <= 25% remains) */
  penetration: number;
  /** S17: dealer stands on all 17s; H17: dealer hits on soft 17 */
  dealerSoft17: DealerSoft17Rule;
  /** Natural blackjack payout ratio */
  blackjackPayout: BlackjackPayoutRatio;
  /** Offer insurance when dealer upcard is an Ace */
  insuranceEnabled: boolean;
  /** Late surrender availability */
  surrender: SurrenderRule;
  /** Allow doubling down after splitting (DAS) */
  doubleAfterSplit: boolean;
  /** Allow splitting any two 10-value cards (e.g. 10 and K) vs requiring identical ranks */
  splitSameValueTenCards: boolean;
  /** Allow re-splitting Aces */
  resplitAces: boolean;
  /** Allow hitting split Aces (false in standard casino rules: 1 card only per split Ace) */
  hitSplitAces: boolean;
  /** Maximum number of hands a player can split into (e.g. 2, 3, or 4) */
  maxSplitHands: number;
  /** Which initial two-card totals can be doubled */
  doubleRestriction: DoubleRestrictionRule;
  /** Minimum main bet allowed */
  minBet: number;
  /** Maximum main bet allowed */
  maxBet: number;
}

export type HandStatus =
  | 'active'
  | 'stood'
  | 'bust'
  | 'doubled'
  | 'surrendered'
  | 'blackjack';

export type HandOutcome =
  | 'blackjack'
  | 'win'
  | 'lose'
  | 'push'
  | 'bust'
  | 'surrender';

export type PlayerActionType =
  | 'hit'
  | 'stand'
  | 'double'
  | 'split'
  | 'insurance'
  | 'decline_insurance'
  | 'surrender';

export interface PlayerHand {
  id: string;
  cards: Card[];
  bet: number;
  status: HandStatus;
  isFromSplit: boolean;
  splitFromAces: boolean;
  isDoubled: boolean;
  actionsTaken: PlayerActionType[];
  outcome?: HandOutcome;
  /** Total chips returned to player balance at settlement (includes original bet when applicable) */
  payout?: number;
  /** Net profit/loss for this hand relative to its committed bet */
  netProfit?: number;
}

export type GamePhase =
  | 'CONFIGURING'
  | 'BETTING'
  | 'DEALING'
  | 'INSURANCE_OFFERED'
  | 'PLAYER_TURN'
  | 'DEALER_TURN'
  | 'SETTLEMENT'
  | 'ROUND_OVER'
  | 'OUT_OF_CHIPS';

export interface ShoeState {
  cards: Card[];
  totalCards: number;
  cutCardReached: boolean;
  reshuffleCount: number;
}

export interface InsuranceState {
  offered: boolean;
  taken: boolean;
  decided: boolean;
  bet: number;
  outcome?: 'win' | 'lose';
  payout?: number;
  netProfit?: number;
}

export interface RoundSummary {
  roundId: string;
  timestamp: number;
  playerHands: {
    id: string;
    cards: Card[];
    score: HandScore;
    bet: number;
    actions: PlayerActionType[];
    outcome: HandOutcome;
    payout: number;
    netProfit: number;
    isFromSplit: boolean;
    isDoubled: boolean;
  }[];
  dealerCards: Card[];
  dealerScore: HandScore;
  mainBet: number;
  totalCommitted: number;
  insuranceBet: number;
  insuranceNetProfit: number;
  totalPayout: number;
  netBalanceChange: number;
  endingBalance: number;
}

export interface GameState {
  phase: GamePhase;
  rules: TableRules;
  shoe: ShoeState;
  balance: number;
  initialBalance: number;
  stagedBet: number;
  playerHands: PlayerHand[];
  activeHandIndex: number;
  dealerCards: Card[];
  insurance: InsuranceState;
  roundNumber: number;
  currentRoundId: string | null;
  settledRoundIds: string[];
  lastRoundSummary: RoundSummary | null;
  history: RoundSummary[];
  message: string;
}

export type RandomSource = () => number;
