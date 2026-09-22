import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, RefreshCw, X, Play } from 'lucide-react';
import toast from 'react-hot-toast';

const QueueRunner = ({ onGameEnd, onBadgeEarned }) => {
  const [gameState, setGameState] = useState('IDLE'); // IDLE, PLAYING, GAME_OVER
  const [score, setScore] = useState(0);
  const [playerY, setPlayerY] = useState(0);
  const [isJumping, setIsJumping] = useState(false);
  const [obstacles, setObstacles] = useState([]);
  const gameLoopRef = useRef();
  const lastTimeRef = useRef();

  const JUMP_STRENGTH = 120;
  const GRAVITY = 5;
  const PLAYER_SIZE = 40;
  const GAME_WIDTH = 400;
  const GAME_HEIGHT = 200;

  const handleJump = useCallback(() => {
    if (!isJumping && gameState === 'PLAYING') {
      setIsJumping(true);
      setPlayerY(JUMP_STRENGTH);
    }
  }, [isJumping, gameState]);

  const startGame = () => {
    setScore(0);
    setObstacles([]);
    setPlayerY(0);
    setGameState('PLAYING');
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        if (gameState === 'IDLE' || gameState === 'GAME_OVER') startGame();
        else handleJump();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, handleJump]);

  useEffect(() => {
    if (gameState !== 'PLAYING') return;

    const gameLoop = (time) => {
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const deltaTime = time - lastTimeRef.current;
      lastTimeRef.current = time;

      // Update Player
      setPlayerY((y) => {
        if (y > 0 || isJumping) {
          const newY = y - GRAVITY;
          if (newY <= 0) {
            setIsJumping(false);
            return 0;
          }
          return newY;
        }
        return 0;
      });

      // Update Obstacles
      setObstacles((prev) => {
        const speed = 5 + Math.floor(score / 10);
        const next = prev.map((o) => ({ ...o, x: o.x - speed }));
        
        // Spawn logic
        if (next.length === 0 || next[next.length - 1].x < GAME_WIDTH - 150) {
          if (Math.random() < 0.02) {
            next.push({ id: Date.now(), x: GAME_WIDTH, width: 20, height: 30 + Math.random() * 20 });
          }
        }

        // Collision Check
        const playerBox = { x: 50, y: GAME_HEIGHT - PLAYER_SIZE - playerY, w: PLAYER_SIZE, h: PLAYER_SIZE };
        for (const o of next) {
          if (
            playerBox.x < o.x + o.width &&
            playerBox.x + playerBox.w > o.x &&
            playerBox.y < GAME_HEIGHT &&
            playerBox.y + playerBox.h > GAME_HEIGHT - o.height
          ) {
             setGameState('GAME_OVER');
          }
        }

        // Score logic
        const passed = next.filter(o => o.x < 50 && !o.scored);
        if (passed.length > 0) {
          setScore(s => s + 1);
          passed.forEach(o => o.scored = true);
        }

        return next.filter((o) => o.x > -50);
      });

      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoopRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(gameLoopRef.current);
  }, [gameState, isJumping, score]);

  useEffect(() => {
    if (gameState === 'GAME_OVER' && score >= 50) {
       onBadgeEarned('Patient Pro');
       toast.success('🏆 Patient Pro Badge Earned!', { icon: '🏅' });
    }
  }, [gameState, score, onBadgeEarned]);

  return (
    <div className="relative w-full max-w-[400px] mx-auto overflow-hidden bg-slate-900 rounded-2xl border-4 border-indigo-500/30 touch-none shadow-2xl" 
         onClick={gameState === 'PLAYING' ? handleJump : undefined}>
      
      {/* HUD */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
         <div className="bg-black/50 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
            <span className="text-[10px] font-black uppercase text-indigo-400 mr-2">Score</span>
            <span className="text-sm font-black text-white">{score}</span>
         </div>
      </div>

      <div className="absolute top-4 right-4 z-10">
         <button onClick={onGameEnd} className="p-1.5 bg-black/50 rounded-full text-white/50 hover:text-white border border-white/10">
            <X size={16} />
         </button>
      </div>

      {/* GAME AREA */}
      <div className="relative h-[200px] w-full pt-[40px]">
         {/* PLAYER */}
         <motion.div 
           animate={{ y: -playerY }}
           transition={{ type: 'spring', damping: 20, stiffness: 300 }}
           className="absolute left-[50px] bottom-0 text-3xl"
           style={{ width: PLAYER_SIZE, height: PLAYER_SIZE }}
         >
           🏃
         </motion.div>

         {/* OBSTACLES */}
         {obstacles.map(o => (
            <div 
              key={o.id}
              className="absolute bottom-0 bg-red-500 rounded-t-lg shadow-[0_0_10px_rgba(239,68,68,0.5)]"
              style={{ left: o.x, width: o.width, height: o.height }}
            />
         ))}

         {/* GROUND */}
         <div className="absolute bottom-0 w-full h-1 bg-indigo-500/30" />
      </div>

      {/* OVERLAYS */}
      <AnimatePresence>
        {gameState !== 'PLAYING' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-8 text-center"
          >
            {gameState === 'IDLE' ? (
              <>
                <div className="w-16 h-16 bg-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center mb-6">
                   <Play size={32} />
                </div>
                <h3 className="text-xl font-black text-white mb-2 uppercase tracking-tighter">Queue Runner</h3>
                <p className="text-xs text-slate-400 mb-8">Jump over the red obstacles to beat the queue stress!</p>
                <button 
                  onClick={startGame}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl hover:bg-indigo-700 active:scale-95 transition-all"
                >
                  START GAME
                </button>
              </>
            ) : (
              <>
                <div className="text-5xl mb-6">💥</div>
                <h3 className="text-2xl font-black text-white mb-1 uppercase tracking-tighter">Game Over!</h3>
                <p className="text-sm font-bold text-indigo-400 mb-8">Final Score: {score}</p>
                
                {score < 50 && (
                  <p className="text-[10px] text-slate-500 uppercase font-black mb-6">Get 50+ points for a reward</p>
                )}

                <div className="flex gap-4 w-full">
                  <button 
                    onClick={startGame}
                    className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl hover:bg-indigo-700 flex items-center justify-center gap-2"
                  >
                    <RefreshCw size={18} /> RETRY
                  </button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-4 bg-black/40 text-[8px] text-center font-black uppercase tracking-widest text-slate-500">
         Space / Tap to Jump
      </div>
    </div>
  );
};

export default QueueRunner;
