import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GameState, Card, Player } from './src/lib/types';
import { createDeck, evaluateHand, calculatePenalty, POINT_VALUES, RANK_VALUES, isCardJoker, autoSortHand } from './src/lib/rummy';

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*' }
  });

  // Game Rooms State
  const rooms: Record<string, GameState> = {};
  
  // Track pure deck separately to pop cards from server side
  const roomDecks: Record<string, Card[]> = {};

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on('join_room', (roomId: string, playerName: string) => {
      socket.join(roomId);
      
      if (!rooms[roomId]) {
        rooms[roomId] = {
          roomId,
          players: {},
          deckCount: 0,
          discardPile: [],
          wildJoker: null,
          currentTurnId: null,
          status: 'waiting',
          winnerId: null
        };
      }

      const room = rooms[roomId];
      const playerIds = Object.keys(room.players);
      
      if (playerIds.length >= 2 && !room.players[socket.id]) {
        socket.emit('error', 'Room is full.');
        return;
      }

      room.players[socket.id] = {
        id: socket.id,
        name: playerName,
        handGroups: [],
        score: 0,
        ready: false
      };

      io.to(roomId).emit('room_state', room);
    });

    socket.on('play_vs_bot', (playerName: string) => {
      const roomId = 'BOT-' + Math.random().toString(36).substring(2, 6).toUpperCase();
      socket.join(roomId);

      rooms[roomId] = {
        roomId,
        players: {},
        deckCount: 0,
        discardPile: [],
        wildJoker: null,
        currentTurnId: null,
        status: 'waiting',
        winnerId: null
      };

      const room = rooms[roomId];
      room.players[socket.id] = {
        id: socket.id,
        name: playerName,
        handGroups: [],
        score: 0,
        ready: true
      };
      room.players['bot'] = {
        id: 'bot',
        name: 'Rummy Bot',
        handGroups: [],
        score: 0,
        ready: true,
        isBot: true
      };

      io.to(roomId).emit('room_state', room);
      checkStartGame(roomId);
    });

    socket.on('ready', (roomId: string) => {
      const room = rooms[roomId];
      if (!room) return;
      
      const p = room.players[socket.id];
      if (p) p.ready = true;

      checkStartGame(roomId);
      broadcastState(roomId);
    });

    socket.on('draw_card', (roomId: string, source: 'deck' | 'discard', targetPosition?: { groupIdx: number, cardIdx: number }) => {
      const room = rooms[roomId];
      if (!room || room.currentTurnId !== socket.id || room.status !== 'playing') return;

      const p = room.players[socket.id];
      const totalCards = p.handGroups.reduce((acc, g) => acc + g.length, 0);
      if (totalCards >= 14) return; // Player already drew a card

      let drawnCard: Card | undefined;

      if (source === 'deck') {
        drawnCard = roomDecks[roomId].pop();
        room.deckCount = roomDecks[roomId].length;
      } else if (source === 'discard') {
        drawnCard = room.discardPile.pop();
      }

      if (drawnCard) {
        if (targetPosition) {
           const p = room.players[socket.id];
           if (targetPosition.groupIdx === -1) {
              p.handGroups.unshift([drawnCard]);
           } else if (targetPosition.groupIdx === -2) {
              p.handGroups.push([drawnCard]);
           } else {
              if (!p.handGroups[targetPosition.groupIdx]) {
                 p.handGroups[targetPosition.groupIdx] = [];
              }
              p.handGroups[targetPosition.groupIdx].splice(targetPosition.cardIdx, 0, drawnCard);
           }
        } else {
           room.players[socket.id].handGroups.push([drawnCard]);
        }
      }
      
      broadcastState(roomId);
    });

    socket.on('discard_card', (roomId: string, cardId: string) => {
      const room = rooms[roomId];
      if (!room || room.currentTurnId !== socket.id || room.status !== 'playing') return;

      const p = room.players[socket.id];
      const totalCards = p.handGroups.reduce((acc, g) => acc + g.length, 0);
      if (totalCards !== 14) return; // Cannot discard unless you have exactly 14 cards

      let discardedCard: Card | null = null;
      let newHandGroups = [...p.handGroups];

      for (let i=0; i<newHandGroups.length; i++) {
        const idx = newHandGroups[i].findIndex(c => c.id === cardId);
        if (idx !== -1) {
          discardedCard = newHandGroups[i].splice(idx, 1)[0];
          // Remove empty groups
          if (newHandGroups[i].length === 0) {
             newHandGroups.splice(i, 1);
          }
          break;
        }
      }

      if (discardedCard) {
        p.handGroups = newHandGroups;
        room.discardPile.push(discardedCard);
        
        // Next turn
        const playerIds = Object.keys(room.players);
        room.currentTurnId = playerIds.find(id => id !== socket.id) || null;
      }
      
      broadcastState(roomId);
      
      if (room.currentTurnId && room.players[room.currentTurnId].isBot) {
        triggerBotTurn(roomId);
      }
    });

    socket.on('update_hand', (roomId: string, newGroups: Card[][]) => {
      // Sync hand layout locally per player
      const room = rooms[roomId];
      if (room && room.players[socket.id]) {
        room.players[socket.id].handGroups = newGroups;
      }
    });

    socket.on('declare', (roomId: string, discardCardId?: string) => {
      const room = rooms[roomId];
      if (!room || room.status !== 'playing') return;
      
      const p = room.players[socket.id];
      if (discardCardId) {
        let discardedCard: Card | null = null;
        let newHandGroups = [...p.handGroups];

        for (let i=0; i<newHandGroups.length; i++) {
          const idx = newHandGroups[i].findIndex(c => c.id === discardCardId);
          if (idx !== -1) {
            discardedCard = newHandGroups[i].splice(idx, 1)[0];
            if (newHandGroups[i].length === 0) {
               newHandGroups.splice(i, 1);
            }
            break;
          }
        }
        if (discardedCard) {
            p.handGroups = newHandGroups;
            room.discardPile.push(discardedCard);
        }
      }

      const evaluation = evaluateHand(p.handGroups, room.wildJoker);
      
      if (evaluation.isValidDeclaration) {
         room.status = 'round_over';
         room.winnerId = socket.id;
         p.roundScore = 0; // Winner gets 0 points for the round
         
         // Calculate opponent score
         const opponentId = Object.keys(room.players).find(id => id !== socket.id);
         if (opponentId) {
            const opp = room.players[opponentId];
            let penalty = calculatePenalty(opp.handGroups, room.wildJoker);
            if (evaluation.specialWinCondition) {
               penalty *= 2;
            }
            opp.roundScore = penalty;
            opp.score += penalty;
         }
      } else {
        // Invalid declaration penalty. Usually flat 80 penalty.
        p.roundScore = 80;
        p.score += 80;
        room.status = 'round_over';
        const opponentId = Object.keys(room.players).find(id => id !== socket.id);
        if (opponentId) {
           const opp = room.players[opponentId];
           opp.roundScore = 0;
           room.winnerId = opponentId;
        } else {
           room.winnerId = null;
        }
      }
      
      broadcastState(roomId);
    });

    socket.on('next_round', (roomId: string) => {
      const room = rooms[roomId];
      if (!room) return;
      
      if (room.status === 'round_over') {
        room.status = 'waiting';
        for (const p of Object.values(room.players)) {
          p.ready = p.isBot ? true : false;
          p.handGroups = [];
        }
      }
      
      const p = room.players[socket.id];
      if (p) p.ready = true;
      
      broadcastState(roomId);
      checkStartGame(roomId);
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
      // Simple cleanup for demo
      for (const [roomId, room] of Object.entries(rooms)) {
         if (room.players[socket.id]) {
            delete room.players[socket.id];
            // if empty, clean up
            if (Object.keys(room.players).length === 0) {
               delete rooms[roomId];
               delete roomDecks[roomId];
            } else {
               broadcastState(roomId);
            }
         }
      }
    });
    
    function checkStartGame(roomId: string) {
       const room = rooms[roomId];
       if (!room) return;
       const playerIds = Object.keys(room.players);
       if (playerIds.length === 2 && playerIds.every(id => room.players[id].ready)) {
          startGame(roomId);
       }
    }

    function startGame(roomId: string) {
        const room = rooms[roomId];
        const playerIds = Object.keys(room.players);
        
        const deck = createDeck();
        const wildJoker = deck.pop()!;
        
        for (const id of playerIds) {
          const hand = deck.splice(-13, 13);
          room.players[id].handGroups = [hand];
        }

        const openCard = deck.pop()!;
        room.wildJoker = wildJoker;
        room.discardPile = [openCard];
        room.deckCount = deck.length;
        
        room.currentTurnId = playerIds[0];
        room.status = 'playing';
        room.winnerId = null;
        roomDecks[roomId] = deck;
        
        broadcastState(roomId);

        if (room.currentTurnId && room.players[room.currentTurnId].isBot) {
           triggerBotTurn(roomId);
        }
    }

    function triggerBotTurn(roomId: string) {
       const room = rooms[roomId];
       if (!room || room.status !== 'playing') return;
       const botId = Object.keys(room.players).find(id => room.players[id].isBot);
       if (!botId || room.currentTurnId !== botId) return;

       setTimeout(() => {
          const r = rooms[roomId];
          if (!r || r.status !== 'playing' || r.currentTurnId !== botId) return;

          const botHand = r.players[botId].handGroups.flat();
          let drawSource: 'deck' | 'discard' = 'deck';
          let drawnCard: any = null;

          // Check if top discard card is useful
          if (r.discardPile.length > 0) {
              const topDiscard = r.discardPile[r.discardPile.length - 1];
              if (isCardJoker(topDiscard, r.wildJoker)) {
                  drawSource = 'discard';
              } else {
                  // Check if it can form a set or sequence
                  let isUseful = false;
                  
                  // Check Set: at least 2 cards of same rank but different suits
                  const sameRank = botHand.filter(c => c.rank === topDiscard.rank && c.suit !== topDiscard.suit);
                  const distinctSuits = new Set(sameRank.map(c => c.suit));
                  if (distinctSuits.size >= 2) isUseful = true;
                  
                  // Check Sequence: at least 2 cards of same suit that can form a sequence with topDiscard
                  const sameSuit = botHand.filter(c => c.suit === topDiscard.suit);
                  const tv = RANK_VALUES[topDiscard.rank];
                  const vals = sameSuit.map(c => RANK_VALUES[c.rank]);

                  if (sameSuit.length >= 2) {
                      for (let i = 0; i < vals.length; i++) {
                          for (let j = i + 1; j < vals.length; j++) {
                              const sorted = [vals[i], vals[j], tv].sort((a,b) => a - b);
                              if (sorted[2] - sorted[1] === 1 && sorted[1] - sorted[0] === 1) isUseful = true;
                              if (sorted.includes(1)) {
                                  const alt = sorted.map(v => v === 1 ? 14 : v).sort((a,b) => a-b);
                                  if (alt[2] - alt[1] === 1 && alt[1] - alt[0] === 1) isUseful = true;
                              }
                          }
                      }
                  }
                  
                  // Check Sequence with 1 gap (needs 1 card in middle) or adjacent (needs 1 card next to it) + joker
                  // If we have a joker in hand, maybe a 2-card combination is enough
                  const jokersInHand = botHand.filter(c => isCardJoker(c, r.wildJoker));
                  if (jokersInHand.length > 0) {
                      // Set with joker
                      if (distinctSuits.size >= 1) isUseful = true;
                      // Sequence with joker
                      for (let i = 0; i < vals.length; i++) {
                          const diff = Math.abs(vals[i] - tv);
                          if (diff === 1 || diff === 2) isUseful = true;
                          if (tv === 1 && Math.abs(14 - vals[i]) <= 2) isUseful = true;
                          if (vals[i] === 1 && Math.abs(14 - tv) <= 2) isUseful = true;
                      }
                  }

                  if (isUseful) drawSource = 'discard';
              }
          }

          if (drawSource === 'discard') {
              drawnCard = r.discardPile.pop();
          } else {
              drawnCard = roomDecks[roomId].pop();
              if (drawnCard) r.deckCount = roomDecks[roomId].length;
          }

          if (drawnCard) {
             if (r.players[botId].handGroups.length === 0) r.players[botId].handGroups.push([]);
             r.players[botId].handGroups[0].push(drawnCard);
             broadcastState(roomId);

             setTimeout(() => {
                const r2 = rooms[roomId];
                if (!r2 || r2.status !== 'playing' || r2.currentTurnId !== botId) return;
                
                // Group the bot's hand to mimic real play
                const allBotCards = r2.players[botId].handGroups.flat();
                const groupedHand = autoSortHand(allBotCards, r2.wildJoker);
                r2.players[botId].handGroups = groupedHand;

                // Try to find a winning discard
                let winningDiscardId: string | null = null;
                for (let i = 0; i < groupedHand.length; i++) {
                   for (let j = 0; j < groupedHand[i].length; j++) {
                      const testGroups = groupedHand.map(g => [...g]);
                      const cardId = testGroups[i][j].id;
                      testGroups[i].splice(j, 1);
                      const filteredGroups = testGroups.filter(g => g.length > 0);
                      
                      const evaluation = evaluateHand(filteredGroups, r2.wildJoker);
                      if (evaluation.isValidDeclaration) {
                         winningDiscardId = cardId;
                         break;
                      }
                   }
                   if (winningDiscardId) break;
                }

                if (winningDiscardId) {
                   // Bot wins!
                   let discardedCard: any = null;
                   for (let i = 0; i < groupedHand.length; i++) {
                      const idx = groupedHand[i].findIndex((c: any) => c.id === winningDiscardId);
                      if (idx !== -1) {
                         discardedCard = groupedHand[i].splice(idx, 1)[0];
                         break;
                      }
                   }
                   if (discardedCard) {
                      r2.discardPile.push(discardedCard);
                      r2.players[botId].handGroups = groupedHand.filter(g => g.length > 0);
                      r2.status = 'round_over';
                      r2.winnerId = botId;
                      r2.players[botId].roundScore = 0;
                      
                      const opponentId = Object.keys(r2.players).find(id => id !== botId);
                      if (opponentId) {
                         const opp = r2.players[opponentId];
                         let penalty = calculatePenalty(opp.handGroups, r2.wildJoker);
                         const finalEval = evaluateHand(groupedHand.filter(g => g.length > 0), r2.wildJoker);
                         if (finalEval.specialWinCondition) penalty *= 2;
                         opp.roundScore = penalty;
                         opp.score += penalty;
                      }
                      broadcastState(roomId);
                   }
                } else {
                   // Bot doesn't win, just discard the worst card
                   let discardGroupIdx = 0;
                   let discardCardIdx = 0;
                   let maxPts = -1;
                   for (let i = 0; i < groupedHand.length; i++) {
                      for (let j = 0; j < groupedHand[i].length; j++) {
                         const c = groupedHand[i][j];
                         if (!isCardJoker(c, r2.wildJoker)) {
                            const pts = POINT_VALUES[c.rank] || 0;
                            if (pts > maxPts) {
                               maxPts = pts;
                               discardGroupIdx = i;
                               discardCardIdx = j;
                            }
                         }
                      }
                   }
                   
                   const discardedCard = groupedHand[discardGroupIdx].splice(discardCardIdx, 1)[0];
                   if (groupedHand[discardGroupIdx].length === 0) {
                      groupedHand.splice(discardGroupIdx, 1);
                   }
                   r2.discardPile.push(discardedCard);
                   r2.players[botId].handGroups = groupedHand;

                   // Give turn to human
                   const nextId = Object.keys(r2.players).find(id => id !== botId) || null;
                   r2.currentTurnId = nextId;
                   broadcastState(roomId);
                }
             }, 1500);
          }
       }, 1500);
    }
    
    function broadcastState(roomId: string) {
       const room = rooms[roomId];
       if (!room) return;
       // We must sanitize the handGroups so p1 doesn't see p2's cards!
       io.of('/').in(roomId).fetchSockets().then(sockets => {
          for (const s of sockets) {
             const sanRoom = JSON.parse(JSON.stringify(room)) as GameState;
             for (const [pid, player] of Object.entries(sanRoom.players)) {
                 if (pid !== s.id && room.status !== 'round_over') {
                     // Hide other player's cards but show their grouping
                     player.handGroups = player.handGroups.map(group => 
                        group.map(() => ({ id: 'hidden', rank: 'back', suit: 'back' } as any))
                     );
                 }
             }
             s.emit('room_state', sanRoom);
          }
       });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static files
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
