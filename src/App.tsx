import React, { useState } from 'react';
import {
  ActiveModalType,
  BlackjackTable,
} from './components/Table/BlackjackTable';
import {
  useBlackjackGame,
  UseBlackjackGameOptions,
} from './state/useBlackjackGame';
import './styles/table.css';

export interface AppProps extends UseBlackjackGameOptions {}

export const App: React.FC<AppProps> = (props) => {
  const { state, actions } = useBlackjackGame(props);
  const [activeModal, setActiveModal] = useState<ActiveModalType>('none');

  const handleOpenModal = (modal: ActiveModalType) => {
    setActiveModal((prev) => (prev === modal ? 'none' : modal));
  };

  return (
    <BlackjackTable
      state={state}
      activeModal={activeModal}
      onOpenModal={handleOpenModal}
      onAddChip={actions.addChip}
      onRemoveChip={actions.removeChip}
      onSetExactBet={actions.setExactBet}
      onClearBet={actions.clearBet}
      onHalfBet={actions.halfBet}
      onDoubleBet={actions.doubleBet}
      onMaxBet={actions.maxBet}
      onDeal={actions.deal}
      onHit={actions.hit}
      onStand={actions.stand}
      onDoubleDown={actions.doubleDown}
      onSplit={actions.split}
      onSurrender={actions.surrender}
      onInsuranceDecision={actions.insuranceDecision}
      onNextRound={actions.nextRound}
      onRefillBalance={actions.refillBalance}
    />
  );
};

export default App;
