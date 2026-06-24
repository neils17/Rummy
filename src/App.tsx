import { Lobby } from './components/Lobby';
import { GameTable } from './components/GameTable';
import { useGameStore } from './store';

export default function App() {
  const { gameState } = useGameStore();

  return (
    <>
      {!gameState || gameState.status === 'waiting' ? (
        <Lobby />
      ) : (
        <GameTable />
      )}
    </>
  );
}
