import { create } from 'zustand';
import { Socket } from 'socket.io-client';
import io from 'socket.io-client';
import { GameState, CardGroup } from './lib/types';

interface StoreState {
  socket: Socket | null;
  roomId: string;
  playerName: string;
  gameState: GameState | null;
  setRoomId: (id: string) => void;
  setPlayerName: (name: string) => void;
  connect: () => void;
  joinRoom: () => void;
  playVsBot: () => void;
  ready: () => void;
  drawCard: (source: 'deck' | 'discard', targetPosition?: {groupIdx: number, cardIdx: number}) => void;
  discardCard: (cardId: string) => void;
  updateHand: (newGroups: CardGroup[]) => void;
  declare: (discardCardId?: string) => void;
  nextRound: () => void;
}

export const useGameStore = create<StoreState>((set, get) => ({
  socket: null,
  roomId: '',
  playerName: `Player ${Math.floor(Math.random() * 1000)}`,
  gameState: null,

  setRoomId: (id) => set({ roomId: id }),
  setPlayerName: (name) => set({ playerName: name }),

  connect: () => {
    if (get().socket) return;
    const socket = io(); // Connects to same host/port serving page
    
    socket.on('room_state', (state: GameState) => {
      set({ gameState: state, roomId: state.roomId });
    });

    socket.on('error', (msg) => {
      alert(msg);
    });

    set({ socket });
  },

  joinRoom: () => {
    const { socket, roomId, playerName } = get();
    if (socket && roomId) {
      socket.emit('join_room', roomId, playerName);
    }
  },

  playVsBot: () => {
    const { socket, playerName } = get();
    if (socket) {
      socket.emit('play_vs_bot', playerName);
    }
  },

  ready: () => {
    const { socket, roomId } = get();
    socket?.emit('ready', roomId);
  },

  drawCard: (source, targetPosition) => {
    const { socket, roomId } = get();
    socket?.emit('draw_card', roomId, source, targetPosition);
  },

  discardCard: (cardId) => {
    const { socket, roomId } = get();
    socket?.emit('discard_card', roomId, cardId);
  },

  updateHand: (newGroups) => {
    const { socket, roomId } = get();
    // Optimistic update locally
    set(state => {
      if (!state.gameState || !state.socket) return state;
      const newState = {
        ...state.gameState,
        players: {
          ...state.gameState.players,
          [state.socket.id]: {
            ...state.gameState.players[state.socket.id],
            handGroups: newGroups
          }
        }
      };
      return { gameState: newState };
    });
    
    socket?.emit('update_hand', roomId, newGroups);
  },

  declare: (discardCardId?: string) => {
    const { socket, roomId } = get();
    socket?.emit('declare', roomId, discardCardId);
  },

  nextRound: () => {
    const { socket, roomId } = get();
    socket?.emit('next_round', roomId);
  }
}));
