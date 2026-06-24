import React, { useState } from 'react';
import { Card as CardType, CardGroup } from '../lib/types';
import { CardView } from './CardView';
import { motion, AnimatePresence } from 'motion/react';
import { identifyGroupType } from '../lib/rummy';
import { cn } from '../lib/utils';
import { useGameStore } from '../store';

interface HandProps {
  groups: CardGroup[];
  wildJoker: CardType | null;
  onGroupsUpdate: (newGroups: CardGroup[]) => void;
}

export const PlayerHand: React.FC<HandProps> = ({ groups, wildJoker, onGroupsUpdate }) => {
  const [draggedItem, setDraggedItem] = useState<{ groupIdx: number, cardIdx: number } | null>(null);
  const [dragOverInfo, setDragOverInfo] = useState<{ groupIdx: number, cardIdx: number, position: 'before' | 'after'} | null>(null);
  const { discardCard, gameState, socket } = useGameStore();

  const handleDragStart = (groupIdx: number, cardIdx: number) => {
    setDraggedItem({ groupIdx, cardIdx });
    setDragOverInfo(null);
  };

  const handleDropOnGroup = (e: React.DragEvent, targetGroupIdx: number) => {
    e.preventDefault();
    setDragOverInfo(null);
    const rawData = e.dataTransfer.getData('application/json');
    if (rawData) {
        try {
            const data = JSON.parse(rawData);
            if (data.type === 'draw') {
                useGameStore.getState().drawCard(data.source, { groupIdx: targetGroupIdx, cardIdx: groups[targetGroupIdx].length });
                return;
            }
        } catch {}
    }
    if (!draggedItem) return;
    
    // We only use this if we drop exactly on a group but NOT on a card, or as fallback.
    // The specific card drop logic is better.
    const newGroups = groups.map(g => [...g]);
    const targetCardObj = newGroups[draggedItem.groupIdx][draggedItem.cardIdx];
    
    newGroups[draggedItem.groupIdx].splice(draggedItem.cardIdx, 1);
    newGroups[targetGroupIdx].push(targetCardObj);
    
    const cleanGroups = newGroups.filter(g => g.length > 0);
    onGroupsUpdate(cleanGroups);
    setDraggedItem(null);
  };

  const handleDropOnCard = (e: React.DragEvent, targetGroupIdx: number, targetCardIdx: number) => {
    e.preventDefault();
    e.stopPropagation(); // prevent group drop from firing
    setDragOverInfo(null);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const isRightHalf = e.clientX > rect.left + rect.width / 2;
    let insertIdx = targetCardIdx;
    if (isRightHalf) insertIdx++;

    const rawData = e.dataTransfer.getData('application/json');
    if (rawData) {
        try {
            const data = JSON.parse(rawData);
            if (data.type === 'draw') {
                useGameStore.getState().drawCard(data.source, { groupIdx: targetGroupIdx, cardIdx: insertIdx });
                return;
            }
        } catch {}
    }

    if (!draggedItem) return;

    const { groupIdx: sGroupIdx, cardIdx: sCardIdx } = draggedItem;
    if (sGroupIdx === targetGroupIdx && sCardIdx === targetCardIdx) {
      setDraggedItem(null);
      return;
    }

    const newGroups = groups.map(g => [...g]);
    const cardToMove = newGroups[sGroupIdx][sCardIdx];
    
    // Remove from old
    newGroups[sGroupIdx].splice(sCardIdx, 1);

    insertIdx = targetCardIdx;
    if (sGroupIdx === targetGroupIdx && sCardIdx < targetCardIdx) {
      insertIdx--;
    }
    if (isRightHalf) {
      insertIdx++;
    }

    newGroups[targetGroupIdx].splice(insertIdx, 0, cardToMove);

    const cleanGroups = newGroups.filter(g => g.length > 0);
    onGroupsUpdate(cleanGroups);
    setDraggedItem(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // necessary to allow dropping
  };

  const handleDropNewGroup = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverInfo(null);
    const rawData = e.dataTransfer.getData('application/json');
    if (rawData) {
        try {
            const data = JSON.parse(rawData);
            if (data.type === 'draw') {
                useGameStore.getState().drawCard(data.source, { groupIdx: -2, cardIdx: 0 });
                return;
            }
        } catch {}
    }
    if (!draggedItem) return;
    const newGroups = groups.map(g => [...g]);
    const card = newGroups[draggedItem.groupIdx][draggedItem.cardIdx];
    newGroups[draggedItem.groupIdx].splice(draggedItem.cardIdx, 1);
    newGroups.push([card]);
    onGroupsUpdate(newGroups.filter(g => g.length > 0));
    setDraggedItem(null);
  };

  const isMyTurn = gameState?.currentTurnId === socket?.id;
  const totalCards = groups.reduce((acc, g) => acc + g.length, 0);

  const handleDoubleClick = (cardId: string) => {
    if (isMyTurn && totalCards === 14) {
      discardCard(cardId);
    }
  };

  return (
    <div 
      className="w-full h-full flex flex-col justify-end overflow-visible pb-12"
      onDragOver={handleDragOver}
      onDrop={(e) => {
        e.preventDefault();
        // Check if drawing a card
        const rawData = e.dataTransfer.getData('application/json');
        if (rawData) {
           try {
             const data = JSON.parse(rawData);
             if (data.type === 'draw') {
                useGameStore.getState().drawCard(data.source);
                return;
             }
           } catch {}
        }
        
        // Otherwise handle normal group creation if dragged up an obvious distance
        if (draggedItem) {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const dropY = e.clientY - rect.top;
          if (dropY < rect.height - 250) { 
            handleDropNewGroup(e);
          }
        }
      }}
    >
      <div 
        className="absolute inset-y-0 left-0 w-16 sm:w-24 border-r border-dashed border-white/20 flex flex-col items-center justify-center text-white/30 text-xs font-bold uppercase tracking-widest z-20 opacity-30 hover:opacity-100 transition-opacity bg-black/20"
        onDragOver={handleDragOver}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const rawData = e.dataTransfer.getData('application/json');
          if (rawData) {
             try {
               const data = JSON.parse(rawData);
               if (data.type === 'draw') {
                  useGameStore.getState().drawCard(data.source, { groupIdx: -1, cardIdx: 0 });
                  return;
               }
             } catch {}
          }
          if (!draggedItem) return;
          const newGroups = groups.map(g => [...g]);
          const card = newGroups[draggedItem.groupIdx][draggedItem.cardIdx];
          newGroups[draggedItem.groupIdx].splice(draggedItem.cardIdx, 1);
          newGroups.unshift([card]); // prepend
          onGroupsUpdate(newGroups.filter(g => g.length > 0));
          setDraggedItem(null);
        }}
      >
        New Group
      </div>

      <div 
        className="absolute inset-y-0 right-0 w-16 sm:w-24 border-l border-dashed border-white/20 flex flex-col items-center justify-center text-white/30 text-xs font-bold uppercase tracking-widest z-20 opacity-30 hover:opacity-100 transition-opacity bg-black/20"
        onDragOver={handleDragOver}
        onDrop={(e) => {
          e.stopPropagation();
          handleDropNewGroup(e);
        }}
      >
        New Group
      </div>

      <div className="flex items-end justify-center min-w-max mx-auto relative z-10 w-full px-20 sm:px-32 h-[220px]">
        <AnimatePresence mode="popLayout">
          {groups.flatMap((group, groupIdx) => {
            const groupType = identifyGroupType(group, wildJoker);
            const isValid = groupType === 'pure_sequence' || groupType === 'impure_sequence' || groupType === 'set' || groupType === 'pure_set';
            
            const groupNode = (
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  key={`group-${groupIdx}`}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDropOnGroup(e, groupIdx)}
                  className={cn(
                    "flex items-end pb-4 pt-16 relative z-10 rounded-3xl mx-0.5 sm:mx-2 transition-colors",
                    isValid ? "bg-emerald-500/10 shadow-[0_10px_40px_rgba(16,185,129,0.15)] border border-emerald-500/20" : "bg-transparent border border-transparent"
                  )}
                  style={{
                    transformStyle: 'preserve-3d',
                  }}
                >
                  {group.map((card, cardIdx) => {
                    // Global card index for smooth full-hand arc
                    let globalIdx = 0;
                    for (let i = 0; i < groupIdx; i++) {
                      globalIdx += groups[i].length;
                    }
                    globalIdx += cardIdx;
                    
                    const midHand = (totalCards - 1) / 2;
                    const distance = globalIdx - midHand;
                    const rotation = distance * 3.5;
                    // Arch translation (yOffset)
                    const yOffset = Math.abs(distance) * Math.abs(distance) * 0.8; 
                    
                    // simplified rotation and translation for smoother interaction
                    const overlap = cardIdx > 0 ? '-ml-10 sm:-ml-12' : 'ml-1 sm:ml-2';
                    const rightPad = cardIdx === group.length - 1 ? 'mr-1 sm:mr-2' : '';

                    let dragShiftX = 0;
                    if (dragOverInfo && dragOverInfo.groupIdx === groupIdx && draggedItem) {
                      if (draggedItem.groupIdx !== groupIdx || draggedItem.cardIdx !== dragOverInfo.cardIdx) {
                        // Never shift the card actually being hovered so the mouse doesn't fall off of it
                        if (cardIdx !== dragOverInfo.cardIdx) {
                          if (dragOverInfo.position === 'after' && cardIdx > dragOverInfo.cardIdx) {
                            dragShiftX = 50;
                          } else if (dragOverInfo.position === 'before' && cardIdx < dragOverInfo.cardIdx) {
                            dragShiftX = -50;
                          }
                        }
                      }
                    }

                    return (
                      <motion.div
                        layout
                        layoutId={card.id}
                        key={card.id}
                        className={cn("relative origin-bottom", overlap, rightPad)}
                        whileHover={{ y: -30, scale: 1.08, zIndex: 100 }}
                        style={{ zIndex: cardIdx }}
                        animate={{ 
                          x: dragShiftX,
                          rotate: rotation,
                          y: yOffset,
                        }}
                        draggable
                        onDragStart={(e) => {
                           handleDragStart(groupIdx, cardIdx);
                           e.dataTransfer.setData('application/json', JSON.stringify({ type: 'hand', cardId: card.id }));
                        }}
                        onDragEnd={() => {
                          setDraggedItem(null);
                          setDragOverInfo(null);
                        }}
                        onDoubleClick={() => handleDoubleClick(card.id)}
                        onDragOver={(e) => {
                          handleDragOver(e);
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          const isRightHalf = e.clientX > rect.left + rect.width / 2;
                          const position = isRightHalf ? 'after' : 'before';
                          if (
                            !dragOverInfo ||
                            dragOverInfo.groupIdx !== groupIdx ||
                            dragOverInfo.cardIdx !== cardIdx ||
                            dragOverInfo.position !== position
                          ) {
                            setDragOverInfo({ groupIdx, cardIdx, position });
                          }
                        }}
                        onDrop={(e) => handleDropOnCard(e, groupIdx, cardIdx)}
                      >
                        <CardView 
                          card={card} 
                          isDragging={draggedItem?.groupIdx === groupIdx && draggedItem?.cardIdx === cardIdx}
                          className={isValid ? 'border-emerald-500 ring-2 ring-emerald-500/50 shadow-emerald-500/20' : 'hover:border-blue-400'}
                        />
                      </motion.div>
                    );
                  })}
                  
                  {/* Group Type Indicator */}
                  {isValid && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-emerald-500 text-[#031d1d] text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-widest whitespace-nowrap shadow-lg shadow-emerald-500/20 z-20">
                      {groupType.replace('_', ' ')}
                    </div>
                  )}
                </motion.div>
            );

            const gapNode = groupIdx < groups.length - 1 ? (
                  <div 
                    key={`gap-${groupIdx}`}
                    className="w-6 sm:w-8 h-32 shrink-0 relative z-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                    onDragOver={handleDragOver}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!draggedItem) return;
                      const newGroups = groups.map(g => [...g]);
                      const card = newGroups[draggedItem.groupIdx][draggedItem.cardIdx];
                      newGroups[draggedItem.groupIdx].splice(draggedItem.cardIdx, 1);
                      newGroups.splice(groupIdx + 1, 0, [card]); // insert between
                      onGroupsUpdate(newGroups.filter(g => g.length > 0));
                      setDraggedItem(null);
                    }}
                  >
                    <div className="h-32 w-1 border-r-2 border-dashed border-white/30"></div>
                  </div>
            ) : null;
            
            return gapNode ? [groupNode, gapNode] : [groupNode];
          })}
        </AnimatePresence>
      </div>
      
      {/* Drag Hint */}
      <div className="mt-8 text-[10px] sm:text-xs text-white/30 text-center uppercase tracking-[0.3em] font-bold z-10 w-full mb-1">
        Drag to reorganize • Double-click or drag to discard
      </div>
    </div>
  );
};
