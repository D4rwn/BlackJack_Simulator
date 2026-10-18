import { useCallback, useEffect, useState } from 'react';
import {
  addChipToBet,
  clearStagedBet,
  createInitialGameState,
  doubleStagedBet,
  halfStagedBet,
  maxStagedBet,
  playerDouble,
  playerHit,
  playerSplit,
  playerStand,
  playerSurrender,
  prepareNextRound,
  refillBalance,
  removeChipFromBet,
  resolveInsuranceDecision,
  setStagedBet,
  startRound,
} from '../engine/gameEngine';
import { createShoe } from '../engine/deck';
import { normalizeTableRules } from '../engine/rules';
import {
  ChipDenomination,
  GameState,
  RandomSource,
  TableRules,
} from '../engine/types';
import {
  clearSessionStorage,
  loadSessionFromStorage,
  saveSessionToStorage,
} from './storage';

export interface UseBlackjackGameOptions {
  initialState?: GameState;
  initialBalance?: number;
  initialRules?: Partial<TableRules>;
  rng?: RandomSource;
  persistSession?: boolean;
  onStateChange?: (nextState: GameState) => void;
}

export function useBlackjackGame(options: UseBlackjackGameOptions = {}) {
  const shouldPersist =
    options.persistSession ?? !options.initialState;

  const [state, setStateInternal] = useState<GameState>(() => {
    if (options.initialState) {
      return options.initialState;
    }
    if (shouldPersist) {
      const restored = loadSessionFromStorage();
      if (restored) {
        return restored;
      }
    }
    return createInitialGameState({
      initialBalance: options.initialBalance,
      rules: options.initialRules,
      rng: options.rng,
    });
  });

  useEffect(() => {
    if (shouldPersist) {
      saveSessionToStorage(state);
    }
  }, [state, shouldPersist]);

  const updateState = useCallback(
    (updater: (prev: GameState) => GameState) => {
      setStateInternal((prev) => {
        try {
          const next = updater(prev);
          options.onStateChange?.(next);
          return next;
        } catch (err) {
          const errorMessage =
            err instanceof Error ? err.message : 'Acción no permitida.';
          return {
            ...prev,
            message: errorMessage,
          };
        }
      });
    },
    [options]
  );

  const handleAddChip = useCallback(
    (denom: ChipDenomination) => {
      updateState((prev) => addChipToBet(prev, denom));
    },
    [updateState]
  );

  const handleRemoveChip = useCallback(
    (denom: ChipDenomination) => {
      updateState((prev) => removeChipFromBet(prev, denom));
    },
    [updateState]
  );

  const handleSetExactBet = useCallback(
    (amount: number) => {
      updateState((prev) => setStagedBet(prev, amount));
    },
    [updateState]
  );

  const handleClearBet = useCallback(() => {
    updateState((prev) => clearStagedBet(prev));
  }, [updateState]);

  const handleHalfBet = useCallback(() => {
    updateState((prev) => halfStagedBet(prev));
  }, [updateState]);

  const handleDoubleBet = useCallback(() => {
    updateState((prev) => doubleStagedBet(prev));
  }, [updateState]);

  const handleMaxBet = useCallback(() => {
    updateState((prev) => maxStagedBet(prev));
  }, [updateState]);

  const handleDeal = useCallback(() => {
    updateState((prev) => startRound(prev, undefined, options.rng));
  }, [updateState, options.rng]);

  const handleHit = useCallback(() => {
    updateState((prev) => playerHit(prev));
  }, [updateState]);

  const handleStand = useCallback(() => {
    updateState((prev) => playerStand(prev));
  }, [updateState]);

  const handleDoubleDown = useCallback(() => {
    updateState((prev) => playerDouble(prev));
  }, [updateState]);

  const handleSplit = useCallback(() => {
    updateState((prev) => playerSplit(prev));
  }, [updateState]);

  const handleSurrender = useCallback(() => {
    updateState((prev) => playerSurrender(prev));
  }, [updateState]);

  const handleInsuranceDecision = useCallback(
    (take: boolean) => {
      updateState((prev) => resolveInsuranceDecision(prev, take));
    },
    [updateState]
  );

  const handleNextRound = useCallback(() => {
    updateState((prev) => prepareNextRound(prev, options.rng));
  }, [updateState, options.rng]);

  const handleRefillBalance = useCallback(
    (amount: number) => {
      updateState((prev) => refillBalance(prev, amount));
    },
    [updateState]
  );

  const handleUpdateRules = useCallback(
    (newRules: Partial<TableRules>, newStartingBalance?: number) => {
      updateState((prev) => {
        if (
          prev.phase !== 'BETTING' &&
          prev.phase !== 'ROUND_OVER' &&
          prev.phase !== 'OUT_OF_CHIPS' &&
          prev.phase !== 'CONFIGURING'
        ) {
          throw new Error(
            'No puedes cambiar las reglas de la mesa durante una mano en curso.'
          );
        }

        const mergedRules = normalizeTableRules({
          ...prev.rules,
          ...newRules,
        });

        const deckCountChanged = mergedRules.deckCount !== prev.rules.deckCount;
        const nextShoe = deckCountChanged
          ? createShoe(
              mergedRules.deckCount,
              options.rng,
              prev.shoe.reshuffleCount + 1
            )
          : prev.shoe;

        if (
          typeof newStartingBalance === 'number' &&
          newStartingBalance > 0
        ) {
          return createInitialGameState({
            initialBalance: newStartingBalance,
            rules: mergedRules,
            rng: options.rng,
          });
        }

        const nextBalance = prev.balance;
        const canAffordMin = nextBalance >= mergedRules.minBet;
        const clampedStagedBet = canAffordMin
          ? Math.min(
              Math.max(prev.stagedBet, mergedRules.minBet),
              Math.min(nextBalance, mergedRules.maxBet)
            )
          : 0;

        return {
          ...prev,
          phase: canAffordMin ? 'BETTING' : 'OUT_OF_CHIPS',
          rules: mergedRules,
          shoe: nextShoe,
          stagedBet: clampedStagedBet,
          playerHands: [],
          dealerCards: [],
          activeHandIndex: 0,
          currentRoundId: null,
          message: 'Configuración de la mesa actualizada.',
        };
      });
    },
    [updateState, options.rng]
  );

  const handleResetSession = useCallback(
    (startingBalance?: number, customRules?: Partial<TableRules>) => {
      if (shouldPersist) {
        clearSessionStorage();
      }
      updateState((prev) =>
        createInitialGameState({
          initialBalance: startingBalance ?? prev.initialBalance,
          rules: customRules ?? prev.rules,
          rng: options.rng,
        })
      );
    },
    [updateState, options.rng, shouldPersist]
  );

  return {
    state,
    actions: {
      addChip: handleAddChip,
      removeChip: handleRemoveChip,
      setExactBet: handleSetExactBet,
      clearBet: handleClearBet,
      halfBet: handleHalfBet,
      doubleBet: handleDoubleBet,
      maxBet: handleMaxBet,
      deal: handleDeal,
      hit: handleHit,
      stand: handleStand,
      doubleDown: handleDoubleDown,
      split: handleSplit,
      surrender: handleSurrender,
      insuranceDecision: handleInsuranceDecision,
      nextRound: handleNextRound,
      refillBalance: handleRefillBalance,
      updateRules: handleUpdateRules,
      resetSession: handleResetSession,
    },
  };
}
