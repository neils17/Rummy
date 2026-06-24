import React, { useState, useEffect } from 'react';
import { useGameStore } from '../store';
import { motion } from 'motion/react';

export const Lobby: React.FC = () => {
  const { connect, joinRoom, setPlayerName, setRoomId, playerName, roomId, socket, gameState, ready, playVsBot } = useGameStore();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('room');
    if (code) {
      setRoomId(code.toUpperCase());
    }
  }, [setRoomId]);

  const handleCopyLink = () => {
    if (!gameState) return;
    const inviteLink = `${window.location.origin}?room=${gameState.roomId}`;
    
    const fallbackCopy = () => {
      const textArea = document.createElement("textarea");
      textArea.value = inviteLink;
      textArea.style.position = "fixed";
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        const successful = document.execCommand('copy');
        if (successful) {
           alert('Invite link copied! Share it with your friend.');
        } else {
           alert('Failed to copy link. Room code is: ' + gameState.roomId);
        }
      } catch (err) {
        alert('Failed to copy link. Room code is: ' + gameState.roomId);
      }
      document.body.removeChild(textArea);
    };

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(inviteLink).then(() => {
        alert('Invite link copied! Share it with your friend.');
      }).catch(() => {
        fallbackCopy();
      });
    } else {
      fallbackCopy();
    }
  };

  const handleCreateGame = () => {
    const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomId(randomCode);
    connect();
    setTimeout(() => {
      useGameStore.getState().joinRoom();
    }, 100);
  };

  if (gameState) {
    // If we're in a room but waiting
    if (gameState.status === 'waiting') {
       return (
         <div className="flex flex-col items-center justify-center h-screen bg-neutral-950 text-white p-6 font-sans relative overflow-hidden">
           
           {/* Deep elegant radial gradient background */}
           <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-900/40 via-neutral-950 to-neutral-950"></div>
           
           {/* Decorative Grid Pattern */}
           <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30"></div>

           {/* Decorative Floating Cards Background with blur/depth effect */}
           <div className="absolute inset-0 pointer-events-none opacity-40 hidden sm:block">
              <motion.div initial={{ y: 50, rotate: -15, filter: 'blur(4px)' }} animate={{ y: -20, rotate: -10, filter: 'blur(2px)' }} transition={{ duration: 4, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }} className="absolute top-[10%] left-[10%] text-[140px] text-red-500/80 drop-shadow-2xl">♦</motion.div>
              <motion.div initial={{ y: -30, rotate: 20, filter: 'blur(8px)' }} animate={{ y: 10, rotate: 25, filter: 'blur(5px)' }} transition={{ duration: 5, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }} className="absolute top-[20%] right-[10%] text-[120px] text-neutral-800 drop-shadow-2xl">♠</motion.div>
              <motion.div initial={{ y: 20, rotate: -5, filter: 'blur(2px)' }} animate={{ y: -40, rotate: 5, filter: 'blur(0px)' }} transition={{ duration: 6, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }} className="absolute bottom-[20%] left-[15%] text-[160px] text-neutral-800 drop-shadow-2xl">♣</motion.div>
              <motion.div initial={{ y: -40, rotate: 15, filter: 'blur(6px)' }} animate={{ y: 30, rotate: 10, filter: 'blur(4px)' }} transition={{ duration: 4.5, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }} className="absolute bottom-[10%] right-[15%] text-[130px] text-red-500/80 drop-shadow-2xl">♥</motion.div>
           </div>

           <motion.div 
             initial={{ opacity: 0, y: 30, scale: 0.95 }}
             animate={{ opacity: 1, y: 0, scale: 1 }}
             transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
             className="relative z-10 bg-neutral-900/80 backdrop-blur-2xl p-8 sm:p-12 rounded-[2rem] border border-white/10 w-full max-w-md text-center shadow-[0_30px_60px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)] before:absolute before:inset-0 before:rounded-[2rem] before:border before:border-white/5 before:-m-px before:pointer-events-none"
           >
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-amber-200/50 to-transparent opacity-50"></div>

              <h2 className="text-3xl font-light mb-2 uppercase tracking-[0.2em] text-white font-serif drop-shadow-sm">Room {gameState.roomId}</h2>
              <p className="text-neutral-400 mb-8 text-sm font-light tracking-wide">Awaiting players...</p>
              
              <button 
                onClick={handleCopyLink}
                className="mb-8 w-full py-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-2xl text-xs font-bold uppercase tracking-[0.2em] transition-all border border-white/10 shadow-lg"
              >
                Copy Invite Link
              </button>
              
              <div className="space-y-4 mb-8">
                {Object.values(gameState.players).map(p => (
                  <div key={p.id} className="flex items-center justify-between p-4 bg-neutral-950/50 backdrop-blur-md rounded-2xl border border-white/10 shadow-inner">
                    <span className="font-medium text-lg text-white">{p.name} {p.id === socket?.id ? <span className="text-amber-200/80 text-sm ml-2 tracking-widest uppercase text-[10px]">(You)</span> : ''}</span>
                    <span className={`text-[10px] sm:text-xs px-4 py-2 rounded-xl uppercase font-bold tracking-widest ${p.ready ? 'bg-white text-neutral-950 shadow-[0_0_15px_rgba(255,255,255,0.2)]' : 'bg-neutral-800 text-neutral-400 border border-white/10'}`}>
                       {p.ready ? 'Ready' : 'Not Ready'}
                    </span>
                  </div>
                ))}
                
                {Object.keys(gameState.players).length < 2 && (
                  <div className="flex items-center justify-between p-4 bg-neutral-950/30 rounded-2xl border border-dashed border-white/20 text-neutral-500">
                    <span className="text-sm tracking-[0.2em] uppercase font-medium">Waiting for opponent...</span>
                  </div>
                )}
              </div>

              {!gameState.players[socket?.id!]?.ready ? (
                <button 
                  onClick={ready}
                  className="w-full py-4 bg-white hover:bg-neutral-200 rounded-2xl font-bold text-lg transition-all text-neutral-950 uppercase tracking-[0.2em] shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                >
                  I'm Ready
                </button>
              ) : (
                <div className="w-full py-4 bg-neutral-950/50 border border-white/10 rounded-2xl text-neutral-500 font-bold uppercase tracking-[0.2em] text-sm shadow-inner">
                  Waiting for game to start...
                </div>
              )}
           </motion.div>

           <div className="absolute bottom-6 right-8 text-neutral-500/60 text-xs font-serif italic tracking-wider pointer-events-none">
              Created by: Neil Sankineni
           </div>
         </div>
       );
    }
    
    return null; // Handled by GameTable
  }

  return (
    <div className="flex items-center justify-center h-screen bg-neutral-950 text-white p-6 font-sans relative overflow-hidden">
      
      {/* Deep elegant radial gradient background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-900/40 via-neutral-950 to-neutral-950"></div>
      
      {/* Decorative Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30"></div>

      {/* Decorative Floating Cards Background with blur/depth effect */}
      <div className="absolute inset-0 pointer-events-none opacity-40 hidden sm:block">
         <motion.div initial={{ y: 50, rotate: -15, filter: 'blur(4px)' }} animate={{ y: -20, rotate: -10, filter: 'blur(2px)' }} transition={{ duration: 4, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }} className="absolute top-[10%] left-[10%] text-[140px] text-red-500/80 drop-shadow-2xl">♦</motion.div>
         <motion.div initial={{ y: -30, rotate: 20, filter: 'blur(8px)' }} animate={{ y: 10, rotate: 25, filter: 'blur(5px)' }} transition={{ duration: 5, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }} className="absolute top-[20%] right-[10%] text-[120px] text-neutral-800 drop-shadow-2xl">♠</motion.div>
         <motion.div initial={{ y: 20, rotate: -5, filter: 'blur(2px)' }} animate={{ y: -40, rotate: 5, filter: 'blur(0px)' }} transition={{ duration: 6, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }} className="absolute bottom-[20%] left-[15%] text-[160px] text-neutral-800 drop-shadow-2xl">♣</motion.div>
         <motion.div initial={{ y: -40, rotate: 15, filter: 'blur(6px)' }} animate={{ y: 30, rotate: 10, filter: 'blur(4px)' }} transition={{ duration: 4.5, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }} className="absolute bottom-[10%] right-[15%] text-[130px] text-red-500/80 drop-shadow-2xl">♥</motion.div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 bg-neutral-900/80 backdrop-blur-2xl p-8 sm:p-12 rounded-[2rem] border border-white/10 w-full max-w-md shadow-[0_30px_60px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)] before:absolute before:inset-0 before:rounded-[2rem] before:border before:border-white/5 before:-m-px before:pointer-events-none"
      >
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-amber-200/50 to-transparent opacity-50"></div>

        <div className="flex justify-center items-center gap-4 mb-6 opacity-80">
           <span className="text-red-400 text-2xl">♥</span>
           <span className="text-neutral-500 text-xl">♠</span>
           <span className="text-red-400 text-xl">♦</span>
           <span className="text-neutral-500 text-2xl">♣</span>
        </div>

        <h1 className="text-5xl sm:text-6xl font-normal mb-3 text-white font-serif text-center drop-shadow-lg tracking-wide">Rummy</h1>
        <p className="text-neutral-400 mb-10 text-sm sm:text-base text-center font-light tracking-wide">
           A classic experience. Join a table or play against the house.
        </p>

        <div className="space-y-8 relative">
          <div className="relative group">
            <input 
              type="text" 
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="w-full bg-neutral-950/50 border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:ring-1 focus:ring-amber-200/50 focus:border-amber-200/30 font-medium text-center text-lg shadow-inner placeholder:text-neutral-600 transition-all"
              placeholder="Enter your alias"
            />
          </div>

          <div className="pt-8 border-t border-white/10 space-y-4">
            <button 
              onClick={handleCreateGame}
              disabled={!playerName}
              className="w-full py-4 bg-white hover:bg-neutral-200 disabled:bg-neutral-800 disabled:text-neutral-600 disabled:cursor-not-allowed rounded-2xl font-bold transition-all text-neutral-950 uppercase tracking-[0.2em] shadow-[0_0_20px_rgba(255,255,255,0.1)]"
            >
              Start New Table
            </button>

            <div className="flex gap-3">
              <input 
                type="text" 
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                placeholder="INVITE CODE"
                className="flex-1 bg-neutral-950/50 border border-white/10 rounded-2xl px-5 py-4 text-white font-mono font-medium placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-amber-200/50 focus:border-amber-200/30 tracking-widest text-center shadow-inner transition-all uppercase"
              />
              <button 
                onClick={() => {
                  connect();
                  setTimeout(joinRoom, 100);
                }}
                disabled={!playerName || !roomId}
                className="px-8 bg-neutral-800 hover:bg-neutral-700 disabled:bg-neutral-900 disabled:text-neutral-700 disabled:cursor-not-allowed border border-white/10 rounded-2xl font-bold transition-all text-white uppercase tracking-[0.2em] shadow-lg"
              >
                Join
              </button>
            </div>

            <button 
              onClick={() => {
                connect();
                setTimeout(playVsBot, 100);
              }}
              disabled={!playerName}
              className="w-full py-4 bg-transparent hover:bg-white/5 disabled:bg-transparent disabled:text-neutral-700 disabled:border-white/5 disabled:cursor-not-allowed rounded-2xl font-bold transition-all text-neutral-300 uppercase tracking-[0.2em] border border-white/20 mt-4"
            >
              Play House Bot
            </button>
          </div>
        </div>
      </motion.div>

      <div className="absolute bottom-6 right-8 text-neutral-500/60 text-xs font-serif italic tracking-wider pointer-events-none">
         Created by: Neil Sankineni
      </div>
    </div>
  );
};
