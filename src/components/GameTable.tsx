import React from 'react';
import { useGameStore } from '../store';
import { CardView } from './CardView';
import { PlayerHand } from './Hand';
import { motion, AnimatePresence } from 'motion/react';
import { evaluateHand, autoSortHand, identifyGroupType } from '../lib/rummy';
import { Card, CardGroup } from '../lib/types';

const ReadOnlyHand = ({ groups, title, isWinner, scoreAdded, totalScore, wildJoker }: { groups: CardGroup[], title: string, isWinner: boolean, scoreAdded: number | undefined, totalScore: number, wildJoker: Card | null }) => {
  return (
    <div className={`p-4 sm:p-6 rounded-2xl border flex-1 w-full flex flex-col ${isWinner ? 'bg-emerald-900/40 border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.2)]' : 'bg-black/40 border-white/10'}`}>
      <div className={`flex items-center justify-between mb-4 sm:mb-6`}>
        <h3 className={`text-lg sm:text-xl font-bold uppercase tracking-widest flex items-center gap-4 ${isWinner ? 'text-emerald-400' : 'text-white/70'}`}>
          {title} {isWinner && <span className="text-[10px] sm:text-xs bg-emerald-500 text-black px-3 py-1 rounded-full font-bold uppercase tracking-widest">WINNER</span>}
        </h3>
        <div className="flex gap-6 sm:gap-12">
           <div className="flex flex-col items-end">
              <span className="text-[10px] sm:text-xs uppercase tracking-widest opacity-60">Round Penalty</span>
              <span className={`font-mono text-xl sm:text-2xl font-bold ${isWinner ? 'text-emerald-400' : 'text-red-400'}`}>+{scoreAdded ?? '?'}</span>
           </div>
           <div className="flex flex-col items-end">
              <span className="text-[10px] sm:text-xs uppercase tracking-widest opacity-60">Total Score</span>
              <span className={`font-mono text-xl sm:text-2xl font-bold text-white`}>{totalScore}</span>
           </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-4 sm:gap-6 justify-start overflow-x-auto pb-4 custom-scrollbar items-end">
         {groups.map((group, gIdx) => {
           const groupType = identifyGroupType(group, wildJoker);
           let badgeText = '';
           let badgeColor = '';
           
           if (groupType === 'pure_sequence') {
             badgeText = 'Pure Seq';
             badgeColor = 'bg-emerald-500 text-[#052c2c]';
           } else if (groupType === 'impure_sequence') {
             badgeText = 'Impure Seq';
             badgeColor = 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50';
           } else if (groupType === 'pure_set' || groupType === 'set') {
             badgeText = 'Set';
             badgeColor = 'bg-blue-500/20 text-blue-300 border border-blue-500/50';
           } else {
             badgeText = 'Invalid';
             badgeColor = 'bg-red-500/20 text-red-300 border border-red-500/50';
           }

           return (
             <div key={gIdx} className="flex flex-col items-center min-w-min pl-2">
               <div className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full mb-2 ${badgeColor}`}>
                 {badgeText}
               </div>
               <div className="flex -space-x-12 sm:-space-x-10 hover:space-x-1 transition-all duration-300 min-w-min">
                 {group.map((card) => (
                   <div key={card.id} className="relative z-0 hover:z-10 transform transition-transform hover:-translate-y-2">
                     <CardView card={card} className="!w-[60px] !h-[84px] sm:!w-[70px] sm:!h-[98px] shadow-[0_0_15px_rgba(0,0,0,0.5)]" />
                   </div>
                 ))}
               </div>
             </div>
           )
         })}
      </div>
    </div>
  );
};

export const GameTable: React.FC = () => {
  const { gameState, socket, drawCard, discardCard, updateHand, declare, nextRound } = useGameStore();

  if (!gameState || !socket) return null;

  const myPlayer = gameState.players[socket.id];
  const otherPlayerId = Object.keys(gameState.players).find(id => id !== socket.id);
  const otherPlayer = otherPlayerId ? gameState.players[otherPlayerId] : null;

  const isMyTurn = gameState.currentTurnId === socket.id;

  const totalCards = myPlayer?.handGroups.reduce((acc, g) => acc + g.length, 0) || 0;

  const [actionAnim, setActionAnim] = React.useState<{ type: 'draw_deck' | 'draw_discard' | 'discard', id: number, card?: Card } | null>(null);
  const prevDiscardCount = React.useRef<number | null>(null);
  const prevDeckCount = React.useRef<number | null>(null);
  const prevTurnRef = React.useRef<string | null>(null);
  const topDiscardRef = React.useRef<Card | null>(null);
  const isMyTurnPrev = React.useRef<boolean>(gameState.currentTurnId === socket.id);

  React.useEffect(() => {
     if (!gameState || !otherPlayerId) return;
     if (gameState.status !== 'playing') {
        prevDiscardCount.current = null;
        prevDeckCount.current = null;
        return;
     }

     if (prevDiscardCount.current !== null && prevDeckCount.current !== null) {
        const discardDiff = gameState.discardPile.length - prevDiscardCount.current;
        const deckDiff = gameState.deckCount - prevDeckCount.current;
        
        // Track opponent actions (when it's their turn or they just ended it)
        if (prevTurnRef.current === otherPlayerId || (!isMyTurnPrev.current && gameState.currentTurnId === socket.id)) {
           if (discardDiff === -1 && topDiscardRef.current) {
              setActionAnim({ type: 'draw_discard', id: Date.now(), card: topDiscardRef.current });
           } else if (deckDiff === -1) {
              setActionAnim({ type: 'draw_deck', id: Date.now() });
           } else if (discardDiff === 1) {
              setActionAnim({ type: 'discard', id: Date.now(), card: gameState.discardPile[gameState.discardPile.length - 1] });
           }
        }
     }

     prevDiscardCount.current = gameState.discardPile.length;
     prevDeckCount.current = gameState.deckCount;
     topDiscardRef.current = gameState.discardPile.length > 0 ? gameState.discardPile[gameState.discardPile.length - 1] : null;
     prevTurnRef.current = gameState.currentTurnId;
     isMyTurnPrev.current = gameState.currentTurnId === socket.id;
  }, [gameState, otherPlayerId, socket.id]);

  React.useEffect(() => {
     if (actionAnim) {
        const t = setTimeout(() => setActionAnim(null), 3500); // 3.5s for text toast
        return () => clearTimeout(t);
     }
  }, [actionAnim]);

  let canDeclare = false;
  let canDeclareWithCard: string | null = null;
  
  if (myPlayer) {
    if (totalCards === 13) {
       canDeclare = evaluateHand(myPlayer.handGroups, gameState.wildJoker).isValidDeclaration;
    } else if (totalCards === 14) {
       for (let i = 0; i < myPlayer.handGroups.length; i++) {
          for (let j = 0; j < myPlayer.handGroups[i].length; j++) {
             const cardId = myPlayer.handGroups[i][j].id;
             const tg = myPlayer.handGroups.map(g => [...g]);
             tg[i].splice(j, 1);
             const testG = tg.filter(g => g.length > 0);
             if (evaluateHand(testG, gameState.wildJoker).isValidDeclaration) {
                canDeclare = true;
                canDeclareWithCard = cardId;
                break;
             }
          }
          if (canDeclare) break;
       }
    }
  }

  return (
    <div className="w-full h-full flex flex-col table-cloth overflow-hidden p-4 sm:p-6 font-sans text-white select-none">
      {/* Header: Scores & Game Info */}
      <header className="flex justify-between items-center mb-4 sm:mb-8 z-20 shrink-0">
        <div className="flex gap-2 sm:gap-4 flex-wrap">
          {/* Player 1 (You) */}
          <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl p-2 sm:p-4 flex items-center gap-2 sm:gap-4 order-1 sm:order-none">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-orange-500 flex items-center justify-center font-bold text-sm sm:text-lg">
              {myPlayer?.name?.[0]?.toUpperCase() || 'P'}
            </div>
            <div>
              <div className="text-[10px] sm:text-xs opacity-60 uppercase tracking-widest leading-tight">Player 1 (You)</div>
              <div className="font-bold text-base sm:text-xl leading-tight">
                {myPlayer?.name} <span className="ml-1 sm:ml-2 text-xs sm:text-sm font-normal text-emerald-400 font-mono">Score: {myPlayer?.score || 0}</span>
              </div>
            </div>
          </div>
          
          {/* Player 2 (Opponent) */}
          <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-2 sm:p-4 flex items-center gap-2 sm:gap-4 opacity-70">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-500 flex items-center justify-center font-bold text-sm sm:text-lg">
              {otherPlayer?.name?.[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <div className="text-[10px] sm:text-xs opacity-60 uppercase tracking-widest leading-tight">Player 2</div>
              <div className="font-bold text-base sm:text-xl uppercase leading-tight">
                {otherPlayer?.name || 'Waiting...'} <span className="ml-1 sm:ml-2 text-xs sm:text-sm font-normal text-red-400 font-mono">Score: {otherPlayer?.score || 0}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="text-right flex flex-col items-end justify-center">
          <div className={`backdrop-blur-xl border px-3 sm:px-6 py-1 sm:py-2 rounded-full inline-flex items-center ${isMyTurn && gameState.status === 'playing' ? 'bg-emerald-500/20 border-emerald-500/30' : 'bg-white/5 border-white/10'}`}>
            {gameState.status === 'playing' ? (
              isMyTurn ? (
                <>
                  <span className="animate-pulse inline-block w-2 h-2 rounded-full bg-emerald-400 mr-2"></span>
                  <span className="text-xs sm:text-sm font-medium tracking-wide text-emerald-400">YOUR TURN</span>
                </>
              ) : (
                <span className="text-xs sm:text-sm font-medium tracking-wide text-white/50">OPPONENT</span>
              )
            ) : (
              <span className="text-xs sm:text-sm font-medium tracking-wide text-amber-500">ROUND OVER</span>
            )}
          </div>
          <div className="text-[8px] sm:text-[10px] mt-1 sm:mt-2 opacity-40 uppercase tracking-[0.1em] sm:tracking-[0.2em]">{myPlayer ? `Connected: Local WiFi (${gameState.roomId})` : 'Connecting...'}</div>
        </div>
      </header>

      {/* Opponent Hand (Live) */}
      {otherPlayer && gameState.status === 'playing' && (
         <div className="flex justify-center items-center w-full transform scale-50 sm:scale-[0.6] origin-top mb-4 sm:mb-8 pointer-events-none opacity-80 h-[80px] sm:h-[100px]">
           <div className="flex gap-8 justify-center">
             {otherPlayer.handGroups.map((group, gIdx) => (
               <div key={gIdx} className="flex -space-x-10 sm:-space-x-12">
                 {group.map((card, i) => (
                   <div key={`${card.id}-${i}`} className="relative z-0">
                     <CardView card={{ id: 'hidden', suit: 'back', rank: 'back' }} className="shadow-lg !w-[72px] !h-[100px] sm:!w-[93px] sm:!h-[130px]" />
                   </div>
                 ))}
               </div>
             ))}
           </div>
         </div>
      )}

      {/* Table Center: Deck & Discard */}
      <main className="flex-1 flex justify-center items-center gap-24 sm:gap-32 relative w-full shrink-0 min-h-[160px]">
        {/* Closed Deck */}
        <div className="relative group flex flex-col items-center z-10 h-[100px] sm:h-[130px] aspect-[226/314]">
          {/* Action Animations */}
          <AnimatePresence>
             {actionAnim && (
                <motion.div
                   key={`anim-text-${actionAnim.id}`}
                   initial={{ opacity: 0, x: -20 }}
                   animate={{ opacity: 1, x: 0 }}
                   exit={{ opacity: 0 }}
                   transition={{ duration: 0.5 }}
                   className={`absolute z-[100] pointer-events-none text-white/70 text-xs sm:text-sm font-medium uppercase tracking-wider whitespace-nowrap bg-black/60 px-3 py-1 rounded-full backdrop-blur-sm top-[-30px] sm:top-[-40px] left-[-20px] sm:left-[-40px] -translate-x-full shadow-xl border border-white/10`}
                >
                   {actionAnim.type === 'draw_deck' && 'Opponent drew'}
                   {actionAnim.type === 'draw_discard' && 'Opponent took'}
                   {actionAnim.type === 'discard' && 'Opponent discarded'}
                </motion.div>
             )}
          </AnimatePresence>
          {/* Wild Joker Sticking Out underneath */}
          {gameState.wildJoker && (
            <div className="absolute inset-0 w-full h-full transform origin-center rotate-[75deg] translate-x-3 sm:translate-x-6 shadow-xl pointer-events-none z-[-1]">
               <CardView card={gameState.wildJoker} className="!w-full !h-full !m-0" />
            </div>
          )}

          <AnimatePresence mode="popLayout">
            <motion.div 
              key={gameState.deckCount}
              initial={{ opacity: 1, scale: 1, y: 0, x: 0 }}
              animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
              exit={{ opacity: 0, x: isMyTurn ? 0 : 100, y: isMyTurn ? 250 : -250, rotate: isMyTurn ? 0 : 25, zIndex: 50 }}
              transition={{ duration: 1, ease: "easeInOut" }}
              className={`absolute inset-0 rounded-[4px] sm:rounded-xl shadow-xl transition-transform border-[4px] border-white overflow-hidden bg-blue-800 ${isMyTurn && totalCards === 13 && gameState.status === 'playing' ? 'cursor-pointer hover:-translate-y-2 !border-emerald-400 shadow-emerald-500/30' : ''}`}
              onClick={() => {
                if (isMyTurn && totalCards === 13) drawCard('deck');
              }}
              draggable={isMyTurn && totalCards === 13}
              onDragStart={(e) => {
                e.dataTransfer.setData('application/json', JSON.stringify({ type: 'draw', source: 'deck' }));
              }}
            >
              <div className="absolute inset-0 pointer-events-none">
                 <div className="absolute inset-1 bg-transparent border-[2px] border-white/40 rounded mix-blend-overlay" />
                 <div className="absolute inset-0 opacity-30" style={{
                    backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 4px, white 4px, white 5px), repeating-linear-gradient(-45deg, transparent, transparent 4px, white 4px, white 5px)`
                 }} />
                 <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full border-2 border-white/50 flex items-center justify-center bg-blue-800 mix-blend-hard-light">
                       <div className="w-8 h-8 sm:w-10 sm:h-10 rotate-45 border border-white/40 bg-white/10" />
                    </div>
                 </div>
              </div>
            </motion.div>
          </AnimatePresence>
          {gameState.deckCount > 0 && (
            <div className="absolute -top-3 -right-3 bg-emerald-500 text-white rounded-full w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center text-xs sm:text-sm font-bold shadow-md pointer-events-none z-20 border-2 border-[#052c2c]">
              {gameState.deckCount}
            </div>
          )}
          <div className="absolute -bottom-6 text-center text-[10px] sm:text-xs opacity-50 uppercase tracking-widest pointer-events-none">Draw Pile</div>
        </div>

        {/* Discard Pile */}
        <div className="relative flex flex-col items-center h-[100px] sm:h-[130px] aspect-[226/314]">
          <div 
            className={`absolute inset-0 rounded-xl shadow-2xl transition-transform ${isMyTurn && totalCards === 14 ? 'ring-4 ring-emerald-500/50 bg-emerald-500/10' : 'bg-white/5 border border-white/10'}`}
            onDragOver={(e) => {
              if (isMyTurn && totalCards === 14) e.preventDefault();
            }}
            onDrop={(e) => {
              if (isMyTurn && totalCards === 14) {
                 e.preventDefault();
                 const rawData = e.dataTransfer.getData('application/json');
                 if (rawData) {
                    try {
                       const data = JSON.parse(rawData);
                       if (data.type === 'hand' && data.cardId) {
                          let validDecl = false;
                          const tg = myPlayer.handGroups.map(g => [...g]);
                          for (let i = 0; i < tg.length; i++) {
                             const idx = tg[i].findIndex(c => c.id === data.cardId);
                             if (idx !== -1) {
                                tg[i].splice(idx, 1);
                                break;
                             }
                          }
                          const testG = tg.filter(g => g.length > 0);
                          if (evaluateHand(testG, gameState.wildJoker).isValidDeclaration) {
                             validDecl = true;
                          }

                          if (validDecl) {
                             declare(data.cardId);
                          } else {
                             discardCard(data.cardId);
                          }
                       }
                    } catch {}
                 }
              }
            }}
            onClick={() => {
              if (isMyTurn && totalCards === 13 && gameState.discardPile.length > 0) {
                 drawCard('discard');
              }
            }}
            draggable={isMyTurn && totalCards === 13 && gameState.discardPile.length > 0}
            onDragStart={(e) => {
               e.dataTransfer.setData('application/json', JSON.stringify({ type: 'draw', source: 'discard' }));
            }}
          >
            <AnimatePresence>
              {gameState.discardPile.map((card, index) => {
                const isTop = index === gameState.discardPile.length - 1;
                return (
                  <motion.div
                    key={card.id}
                    initial={{ scale: 0.8, opacity: 0, y: isMyTurn ? -250 : 250, x: isMyTurn ? -100 : 0, rotate: isMyTurn ? -25 : 0 }}
                    animate={{ scale: 1, opacity: 1, y: 0, x: 0, rotate: 0 }}
                    exit={{ opacity: 0, x: isMyTurn ? 0 : -100, y: isMyTurn ? 250 : -250, rotate: isMyTurn ? 0 : -25, zIndex: 50 }}
                    transition={{ duration: 1, ease: "easeInOut" }}
                    className="absolute inset-0"
                    style={{ zIndex: index }}
                  >
                    <CardView 
                      card={card} 
                      className={`!w-full !h-full m-0 absolute inset-0 ${isMyTurn && totalCards === 13 && isTop ? 'cursor-pointer hover:scale-105 hover:z-10' : 'pointer-events-none'}`}
                    />
                  </motion.div>
                );
              })}
              {gameState.discardPile.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center rounded-xl border-2 border-dashed border-white/20 text-white/20 text-xs font-bold uppercase pointer-events-none">Empty</div>
              )}
            </AnimatePresence>
          </div>
          <div className="absolute -bottom-6 text-center text-[10px] sm:text-xs opacity-50 uppercase tracking-widest pointer-events-none">Open Pile</div>
        </div>

        {/* Declaration Zone */}
        <div className="absolute right-2 sm:right-12 top-1/2 -translate-y-1/2 flex flex-col items-center transform scale-75 sm:scale-100 origin-right">
          <div 
            className={`h-[144px] sm:h-[180px] aspect-[226/314] border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center px-2 transition-colors ${isMyTurn && totalCards === 14 && canDeclare ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'border-white/20 text-white/40'}`}
            onDragOver={(e) => {
              if (isMyTurn && totalCards === 14 && canDeclare) e.preventDefault();
            }}
            onDrop={(e) => {
              if (isMyTurn && totalCards === 14 && canDeclare) {
                 e.preventDefault();
                 const rawData = e.dataTransfer.getData('application/json');
                 if (rawData) {
                    try {
                       const data = JSON.parse(rawData);
                       if (data.type === 'hand' && data.cardId) {
                          declare(data.cardId);
                       } else if (data.type === 'hand' && canDeclareWithCard) {
                          declare(canDeclareWithCard);
                       }
                    } catch {}
                 }
              }
            }}
          >
            <div className={`text-2xl sm:text-4xl mb-1 sm:mb-2 leading-none transition-transform ${isMyTurn && totalCards === 14 && canDeclare ? 'scale-125' : ''}`}>🏁</div>
            <div className="text-[8px] sm:text-[10px] opacity-70 uppercase font-bold">Drop here to Declare</div>
          </div>
        </div>

        {/* Sort Button */}
        <div className="absolute -bottom-16 sm:-bottom-20 left-1/2 -translate-x-1/2 z-50">
           <button 
             onClick={() => {
               if (myPlayer) {
                 const allCards = myPlayer.handGroups.flat();
                 const sortedGroups = autoSortHand(allCards, gameState.wildJoker);
                 updateHand(sortedGroups);
               }
             }}
             className="px-6 py-2.5 rounded-full backdrop-blur-md bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-bold uppercase tracking-widest transition-all text-white/80 hover:text-white select-none cursor-pointer shadow-lg"
           >
             Sort Cards
           </button>
        </div>
      </main>

      {/* Footer: Hand & Controls */}
      <footer className="h-72 sm:h-96 mt-24 relative flex flex-col items-center pb-0 sm:pb-4 w-full shrink-0">
        {/* Hand Controls */}
        <div className="flex gap-2 sm:gap-3 mb-2 sm:mb-6 z-20">
          {gameState.status === 'playing' ? null : (
            <button 
              onClick={nextRound}
              className="px-6 py-1.5 sm:px-8 sm:py-2 rounded-full bg-amber-500 text-amber-950 font-bold uppercase tracking-widest hover:bg-amber-400 text-xs"
            >
              Next Round
            </button>
          )}
        </div>

        {myPlayer && (
          <PlayerHand 
            groups={myPlayer.handGroups} 
            wildJoker={gameState.wildJoker}
            onGroupsUpdate={updateHand}
          />
        )}
      </footer>

      {/* Round Over Overlay */}
      <AnimatePresence>
        {gameState.status === 'round_over' && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-[#0d4f2b]/80 backdrop-blur-md flex items-center justify-center p-4"
          >
            <div className="bg-[#031d1d] border border-white/10 rounded-3xl p-4 sm:p-8 max-w-5xl w-full flex flex-col items-center shadow-2xl h-[90vh] overflow-y-auto custom-scrollbar">
              <h2 className="text-3xl sm:text-5xl font-bold text-white mb-2 uppercase tracking-widest mt-4">Round Over</h2>
              <p className="text-white/60 mb-8 sm:mb-12 text-sm sm:text-base">
                {gameState.winnerId === socket.id ? 
                  <span className="text-emerald-400 font-bold tracking-widest uppercase">You Won! 🎉</span> : 
                  <span className="text-red-400 font-bold tracking-widest uppercase">Opponent Won!</span>
                }
              </p>

              <div className="flex flex-col gap-6 w-full mb-8 sm:mb-12">
                 {/* Winner's Hand First */}
                 {gameState.winnerId === socket.id ? (
                   <>
                     <ReadOnlyHand 
                       groups={myPlayer?.handGroups || []} 
                       title="Your Hand" 
                       isWinner={true} 
                       scoreAdded={myPlayer?.roundScore}
                       totalScore={myPlayer?.score || 0}
                       wildJoker={gameState.wildJoker}
                     />
                     <ReadOnlyHand 
                       groups={otherPlayer?.handGroups || []} 
                       title="Opponent's Hand" 
                       isWinner={false} 
                       scoreAdded={otherPlayer?.roundScore}
                       totalScore={otherPlayer?.score || 0}
                       wildJoker={gameState.wildJoker}
                     />
                   </>
                 ) : (
                   <>
                     <ReadOnlyHand 
                       groups={otherPlayer?.handGroups || []} 
                       title="Opponent's Hand" 
                       isWinner={true} 
                       scoreAdded={otherPlayer?.roundScore}
                       totalScore={otherPlayer?.score || 0}
                       wildJoker={gameState.wildJoker}
                     />
                     <ReadOnlyHand 
                       groups={myPlayer?.handGroups || []} 
                       title="Your Hand" 
                       isWinner={false} 
                       scoreAdded={myPlayer?.roundScore}
                       totalScore={myPlayer?.score || 0}
                       wildJoker={gameState.wildJoker}
                     />
                   </>
                 )}
              </div>

              <button 
                onClick={nextRound}
                className="w-full sm:max-w-md py-4 sm:py-5 bg-emerald-500 hover:bg-emerald-400 text-[#031d1d] rounded-2xl font-bold uppercase tracking-widest transition-colors shadow-lg shadow-emerald-500/20 text-sm sm:text-base mt-auto mb-4"
              >
                Ready for Next Round
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute bottom-4 right-6 text-white/40 text-xs font-serif italic tracking-wide pointer-events-none z-[100]">
         Created by: Neil Sankineni
      </div>
    </div>
  );
};
