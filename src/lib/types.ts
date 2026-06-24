export type Suit = 'Spades' | 'Hearts' | 'Diamonds' | 'Clubs' | 'None';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'Joker';

export interface Card {
  id: string;      // Unique identifier (useful for React rendering & D&D)
  suit: Suit;
  rank: Rank;
  isJoker: boolean; // True if it's the standard printed joker
}

// In the D&D UI, cards are organized into arrays representing distinct meld groups
export type CardGroup = Card[];

export interface Player {
  id: string; // Socket ID
  name: string;
  handGroups: CardGroup[];
  score: number;
  roundScore?: number;
  ready: boolean;
  isBot?: boolean;
}

export interface GameState {
  roomId: string;
  players: Record<string, Player>;
  deckCount: number; // Number of cards remaining in the closed deck
  discardPile: Card[];
  wildJoker: Card | null; // The selected wild joker for the round
  currentTurnId: string | null;
  status: 'waiting' | 'playing' | 'round_over';
  winnerId: string | null;
}
