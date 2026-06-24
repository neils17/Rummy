import React, { useState } from 'react';
import { Card as CardType } from '../lib/types';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

interface CardProps {
  card: CardType;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  isDragging?: boolean;
}

const suitSymbols: Record<string, string> = {
  Spades: '♠',
  Hearts: '♥',
  Diamonds: '♦',
  Clubs: '♣',
  None: '★'
};

export const CardView: React.FC<CardProps> = ({ card, className, style, onClick, isDragging }) => {
  const [imgError, setImgError] = useState(false);

    if (card.id === 'hidden') {
      return (
        <div 
          className={cn(
            "h-[100px] sm:h-[130px] aspect-[226/314] rounded-[4px] sm:rounded-xl shadow-xl border-[3px] border-white shrink-0 relative overflow-hidden",
            className
          )}
          style={style}
        >
         <div className="absolute inset-0 bg-blue-800" />
         <div className="absolute inset-1 bg-transparent border-[2px] border-white/40 rounded mix-blend-overlay" />
         <div className="absolute inset-0 opacity-30" style={{
            backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 4px, white 4px, white 5px), repeating-linear-gradient(-45deg, transparent, transparent 4px, white 4px, white 5px)`
         }} />
         {/* Center diamond/medallion simulation */}
         <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full border-2 border-white/50 flex items-center justify-center bg-blue-800 mix-blend-hard-light">
               <div className="w-8 h-8 sm:w-10 sm:h-10 rotate-45 border border-white/40 bg-white/10" />
            </div>
         </div>
      </div>
    );
  }

  const getCardImageCode = () => {
    if (card.rank === 'Joker') {
      return (card.id.includes('red') || card.suit === 'Hearts' || card.suit === 'Diamonds') ? 'X2' : 'X1';
    }
    const r = card.rank === '10' ? '0' : card.rank.charAt(0);
    const s = card.suit.charAt(0);
    return `${r}${s}`;
  };

  const imgCode = getCardImageCode();

  const isRed = card.suit === 'Hearts' || card.suit === 'Diamonds';
  const colorClass = isRed ? 'text-[#d32f2f]' : 'text-[#212121]';

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative h-[100px] sm:h-[130px] aspect-[226/314] shrink-0 flex flex-col select-none box-border",
        isDragging && "z-50 scale-105 opacity-90 cursor-grabbing",
        !isDragging && "cursor-grab",
        imgError && "bg-white rounded-[4px] sm:rounded-xl overflow-hidden shadow-xl border border-slate-300",
        !imgError && "drop-shadow-xl",
        card.isJoker && "ring-2 ring-amber-400/50 rounded-xl",
        className
      )}
      style={style}
    >
      {!imgError ? (
         <img 
            src={`https://deckofcardsapi.com/static/img/${imgCode}.png`}
            onError={() => setImgError(true)}
            className="w-full h-full object-contain pointer-events-none"
            alt={`${card.rank} of ${card.suit}`}
            draggable={false}
         />
      ) : (
         <div className="absolute inset-0 flex flex-col p-1.5 sm:p-3 pointer-events-none overflow-hidden rounded-[4px] sm:rounded-xl bg-white">
            {/* Fallback CSS Layout */}
            {card.isJoker && (
               <div className="absolute top-1 right-1 text-[8px] bg-amber-400 text-black px-1 rounded font-bold uppercase z-10 hidden sm:block">Joker</div>
            )}
            <div className={cn("text-[10px] sm:text-lg font-serif font-bold leading-none w-max flex flex-col items-center", colorClass)}>
               <div>{card.rank === 'Joker' ? 'J' : card.rank}</div>
               <div className="text-[10px] sm:text-xs">{suitSymbols[card.suit]}</div>
            </div>
            
            <div className={cn("flex-1 flex items-center justify-center text-4xl sm:text-5xl font-serif", colorClass)}>
               {card.rank === 'Joker' ? '★' : suitSymbols[card.suit]}
            </div>

            <div className={cn("text-[10px] sm:text-lg font-serif font-bold leading-none w-max flex flex-col items-center absolute bottom-1 right-1 sm:bottom-2 sm:right-2 rotate-180", colorClass)}>
               <div>{card.rank === 'Joker' ? 'J' : card.rank}</div>
               <div className="text-[10px] sm:text-xs">{suitSymbols[card.suit]}</div>
            </div>
         </div>
      )}
    </div>
  );
};
