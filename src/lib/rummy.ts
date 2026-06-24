import { Card, CardGroup, Rank } from './types';

// Constants
export const SUITS = ['Spades', 'Hearts', 'Diamonds', 'Clubs'] as const;
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;

export const RANK_VALUES: Record<Rank, number> = {
  A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  J: 11, Q: 12, K: 13, Joker: 0
};

export const POINT_VALUES: Record<Rank, number> = {
  'A': 10, 'J': 10, 'Q': 10, 'K': 10,
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  Joker: 0
};

// Utils

export function createDeck(): Card[] {
  const deck: Card[] = [];
  let idCounter = 0;
  
  // 2 standard decks
  for (let d = 0; d < 2; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({ id: `card-${idCounter++}`, suit, rank, isJoker: false });
      }
    }
    // 2 printed jokers per deck = 4 jokers in total
    for (let j = 0; j < 2; j++) {
      deck.push({ id: `card-${idCounter++}`, suit: 'None', rank: 'Joker', isJoker: true });
    }
  }
  
  return deck.sort(() => Math.random() - 0.5); // Shuffle
}

export function isCardJoker(card: Card, wildJoker: Card | null): boolean {
  if (card.isJoker) return true;
  if (wildJoker) {
    if (wildJoker.rank === 'Joker') {
      return card.rank === 'A';
    }
    return card.rank === wildJoker.rank;
  }
  return false;
}

// Validation Logic

export type GroupType = 'pure_sequence' | 'impure_sequence' | 'pure_set' | 'set' | 'invalid';

export function identifyGroupType(group: CardGroup, wildJoker: Card | null): GroupType {
  if (group.length < 3) return 'invalid';

  // 0. Strict Pure Sequence or Pure Set Check (treating wildcard as its original card)
  // If a wild joker is used as its natural suit and rank, it forms a pure sequence or pure set.
  if (!group.some(c => c.isJoker)) {
    // Check Pure Sequence
    const isAllSameSuit = group.every(c => c.suit === group[0].suit);
    if (isAllSameSuit) {
      const sortedValues = group.map(c => RANK_VALUES[c.rank]).sort((a,b) => a - b);
      if (canFormSequence(sortedValues, 0)) return 'pure_sequence';
      
      if (group.some(c => c.rank === 'A')) {
        const altRanks = group.map(c => c.rank === 'A' ? 14 : RANK_VALUES[c.rank]).sort((a,b) => a - b);
        if (canFormSequence(altRanks, 0)) return 'pure_sequence';
      }
    }
    
    // Check Pure Set
    const isAllSameRank = group.every(c => c.rank === group[0].rank);
    if (isAllSameRank && group.length <= 4) {
      const suits = new Set(group.map(c => c.suit));
      if (suits.size === group.length) {
         return 'pure_set';
      }
    }
  }

  // Sort natural cards by rank value to evaluate sequences easily
  const naturalCards = group.filter(c => !isCardJoker(c, wildJoker));
  const jokerCount = group.length - naturalCards.length;

  // 1. Check Set
  // All natural cards must have the same rank but different suits.
  if (naturalCards.length > 0) {
    const isSet = naturalCards.every(c => c.rank === naturalCards[0].rank);
    if (isSet && group.length <= 4) { // Sets can be max 4 cards of different suits
      const suits = new Set(naturalCards.map(c => c.suit));
      if (suits.size === naturalCards.length) {
         return 'set';
      }
    }
  }

  // 2. Check Sequence
  // All natural cards must be of the SAME suit for a sequence.
  if (naturalCards.length === 0) return 'impure_sequence'; // all jokers (rare but possible sequence)
  const isAllSameSuit = naturalCards.every(c => c.suit === naturalCards[0].suit);
  
  if (isAllSameSuit) {
    // Determine if it's a valid sequence mathematically
    // Sort ranks low to high
    let sortedRanks = naturalCards.map(c => RANK_VALUES[c.rank]).sort((a,b) => a - b);
    
    // A special case: A can be high (Q, K, A)
    // Try building sequences
    if (canFormSequence(sortedRanks, jokerCount)) {
       return jokerCount === 0 ? 'pure_sequence' : 'impure_sequence';
    }
    
    // Test alternative Ace high
    if (naturalCards.some(c => c.rank === 'A')) {
       let altRanks = naturalCards.map(c => c.rank === 'A' ? 14 : RANK_VALUES[c.rank]).sort((a,b) => a - b);
       if (canFormSequence(altRanks, jokerCount)) {
         return jokerCount === 0 ? 'pure_sequence' : 'impure_sequence';
       }
    }
  }

  return 'invalid';
}

function canFormSequence(sortedValues: number[], availableJokers: number): boolean {
  let requiredJokers = 0;
  for (let i = 0; i < sortedValues.length - 1; i++) {
    const diff = sortedValues[i+1] - sortedValues[i];
    if (diff === 0) return false; // Duplicate card rank in the same suit -> not a valid sequence
    if (diff > 1) {
      requiredJokers += (diff - 1);
    }
  }
  return requiredJokers <= availableJokers;
}


// Determine overall hand validity
export function evaluateHand(groups: CardGroup[], wildJoker: Card | null) {
  let pureSequenceCount = 0;
  let allSequenceCount = 0;
  let allGroupsValid = true;

  const evaluatedGroups = groups.map(g => {
    const type = identifyGroupType(g, wildJoker);
    if (type === 'pure_sequence') pureSequenceCount++;
    if (type === 'pure_sequence' || type === 'impure_sequence') allSequenceCount++;
    if (type === 'invalid') allGroupsValid = false;
    return { group: g, type };
  });

  const totalCards = groups.reduce((acc, g) => acc + g.length, 0);

  const isAllPureSequences = allGroupsValid && evaluatedGroups.every(g => g.type === 'pure_sequence') && totalCards === 13;
  const isAllPureSets = allGroupsValid && evaluatedGroups.every(g => g.type === 'pure_set') && totalCards === 13;

  const isValidDeclaration = 
    isAllPureSequences ||
    isAllPureSets ||
    (allGroupsValid && 
    pureSequenceCount >= 1 && 
    allSequenceCount >= 2 &&
    totalCards === 13); // Must have exactly 13 cards

  const specialWinCondition = isAllPureSequences ? 'all_pure_sequences' : (isAllPureSets ? 'all_pure_sets' : null);

  return { isValidDeclaration, evaluatedGroups, pureSequenceCount, allSequenceCount, specialWinCondition };
}

// Scoring
export function calculatePenalty(groups: CardGroup[], wildJoker: Card | null): number {
  const evaluation = evaluateHand(groups, wildJoker);
  
  if (evaluation.isValidDeclaration) return 0;

  // If no pure sequence, player gets total points up to 80
  let score = 0;
  const hasPure = evaluation.pureSequenceCount >= 1;

  for (const result of evaluation.evaluatedGroups) {
    if (result.type === 'invalid' || (!hasPure && (result.type === 'impure_sequence' || result.type === 'set' || result.type === 'pure_set'))) {
      const gPoints = result.group.reduce((acc, c) => {
         return acc + (isCardJoker(c, wildJoker) ? 0 : POINT_VALUES[c.rank]);
      }, 0);
      score += gPoints;
    }
  }

  return Math.min(score, 80); // Max penalty is 80
}

export function autoSortHand(cards: Card[], wildJoker: Card | null): Card[][] {
  const result: Card[][] = [];
  let remaining = [...cards];

  function extractBestGroup(allowedTypes: GroupType[]) {
     let bestGroup: Card[] | null = null;
     let bestScore = -1;
     
     const n = remaining.length;
     // Max 15 cards, so maxMask is 1 << 15. If more cards, just cap it to avoid UI freezing.
     const maxMask = n > 15 ? (1 << 15) : (1 << n);
     
     for (let mask = 1; mask < maxMask; mask++) {
        let count = 0;
        for (let i = 0; i < Math.min(n, 15); i++) {
          if ((mask & (1 << i))) count++;
        }
        if (count < 3) continue;

        const subset: Card[] = [];
        for (let i = 0; i < Math.min(n, 15); i++) {
          if ((mask & (1 << i))) {
            subset.push(remaining[i]);
          }
        }

        const type = identifyGroupType(subset, wildJoker);
        if (allowedTypes.includes(type)) {
           // Score prioritizes group length, then pure over impure, then fewer jokers
           const score = subset.length * 100 
                       + (type.startsWith('pure') ? 10 : 0) 
                       - subset.filter(c => isCardJoker(c, wildJoker)).length;
           
           if (score > bestScore) {
              bestScore = score;
              bestGroup = subset;
           }
        }
     }

     if (bestGroup) {
        // Sort the extracted group nicely
        bestGroup.sort((a, b) => {
           if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
           return RANK_VALUES[a.rank] - RANK_VALUES[b.rank];
        });
        
        result.push(bestGroup);
        // Remove the cards used in this group from remaining
        bestGroup.forEach(c => {
           const idx = remaining.findIndex(rc => rc.id === c.id);
           if (idx !== -1) remaining.splice(idx, 1);
        });
        return true;
     }
     return false;
  }

  // 1. Greedily extract pure sequences and pure sets
  while (extractBestGroup(['pure_sequence', 'pure_set'])) {}

  // 2. Greedily extract impure sequences
  while (extractBestGroup(['impure_sequence'])) {}

  // 3. Greedily extract sets
  while (extractBestGroup(['set'])) {}

  // Any remaining cards are deadwood
  if (remaining.length > 0) {
     remaining.sort((a, b) => {
        if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
        return RANK_VALUES[a.rank] - RANK_VALUES[b.rank];
     });
     
     // Chunk remaining cards by suit to look slightly nicer
     let currentLeftover: Card[] = [];
     for (const c of remaining) {
        if (currentLeftover.length === 0 || currentLeftover[0].suit === c.suit) {
           currentLeftover.push(c);
        } else {
           result.push(currentLeftover);
           currentLeftover = [c];
        }
     }
     if (currentLeftover.length > 0) result.push(currentLeftover);
  }

  return result.filter(g => g.length > 0);
}
