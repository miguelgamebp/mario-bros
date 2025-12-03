import React, { useState, useEffect, useCallback } from 'react';
import { Gamepad2, Skull, Trophy, RotateCcw, Sparkles } from 'lucide-react';
import GameCanvas from './components/GameCanvas';
import { generateLevel } from './services/geminiService';
import { LevelData, GameState, ControlState } from './types';
import { DEFAULT_LEVEL_PROMPT } from './constants';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [levelData, setLevelData] = useState<LevelData | null>(null);
  const [prompt, setPrompt] = useState('');
  const [score, setScore] = useState(0);
  const [loadingMsg, setLoadingMsg] = useState('');
  
  const [controls, setControls] = useState<ControlState>({
    left: false, right: false, jump: false, run: false
  });

  // --- Keyboard Inputs ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch(e.code) {
        case 'ArrowLeft': case 'KeyA': setControls(c => ({...c, left: true})); break;
        case 'ArrowRight': case 'KeyD': setControls(c => ({...c, right: true})); break;
        case 'ArrowUp': case 'KeyW': case 'Space': setControls(c => ({...c, jump: true})); break;
        case 'ShiftLeft': setControls(c => ({...c, run: true})); break;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
       switch(e.code) {
        case 'ArrowLeft': case 'KeyA': setControls(c => ({...c, left: false})); break;
        case 'ArrowRight': case 'KeyD': setControls(c => ({...c, right: false})); break;
        case 'ArrowUp': case 'KeyW': case 'Space': setControls(c => ({...c, jump: false})); break;
        case 'ShiftLeft': setControls(c => ({...c, run: false})); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handleStartGame = async (customPrompt?: string) => {
    setGameState(GameState.GENERATING);
    setLoadingMsg("AI is designing your level...");
    setScore(0);
    
    try {
      const p = customPrompt || prompt || DEFAULT_LEVEL_PROMPT;
      const data = await generateLevel(p);
      setLevelData(data);
      setGameState(GameState.PLAYING);
    } catch (e) {
      console.error(e);
      setGameState(GameState.MENU);
    }
  };

  const handleCoin = useCallback(() => {
    setScore(s => s + 100);
  }, []);

  const handleWin = useCallback(() => {
    setGameState(GameState.WON);
  }, []);

  const handleDie = useCallback(() => {
    setGameState(GameState.LOST);
  }, []);

  return (
    <div className="w-full h-screen bg-neutral-900 text-white flex flex-col items-center justify-center relative overflow-hidden font-mono">
      
      {/* --- HUD --- */}
      {gameState === GameState.PLAYING && (
        <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-start z-10 pointer-events-none">
          <div className="flex flex-col gap-1">
             <h1 className="text-yellow-400 text-shadow font-bold text-xl tracking-widest">WORLD 1-1</h1>
             <span className="text-white text-sm bg-black/50 px-2 py-1 rounded">SCORE: {score.toString().padStart(6, '0')}</span>
          </div>
          <div className="bg-black/50 px-3 py-1 rounded text-right">
             <p className="text-xs text-gray-300">Target</p>
             <p className="font-bold">FLAG</p>
          </div>
        </div>
      )}

      {/* --- Game Viewport --- */}
      <div className="relative w-full max-w-4xl aspect-video bg-sky-300 shadow-2xl overflow-hidden border-4 border-neutral-800 rounded-lg">
        
        {/* State: MENU */}
        {gameState === GameState.MENU && (
          <div className="absolute inset-0 bg-neutral-900/95 z-20 flex flex-col items-center justify-center p-6 text-center">
            <h1 className="text-5xl md:text-6xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-b from-red-500 to-red-700 tracking-tighter" style={{ textShadow: '4px 4px 0px #000' }}>
              SUPER AI BROS
            </h1>
            <p className="text-gray-400 mb-8 max-w-md">
              A generative platformer. Describe a level, and the AI will build it for you instantly.
            </p>
            
            <div className="w-full max-w-md space-y-4">
              <input 
                type="text" 
                placeholder="Ex: An underground level with lots of pits..." 
                className="w-full p-3 bg-neutral-800 border border-neutral-700 rounded text-white focus:border-red-500 focus:outline-none transition-colors"
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
              />
              <button 
                onClick={() => handleStartGame()}
                className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded shadow-[0_4px_0_rgb(153,27,27)] active:shadow-none active:translate-y-[4px] transition-all flex items-center justify-center gap-2"
              >
                <Gamepad2 size={24} /> START GAME
              </button>
            </div>
            
            <div className="mt-8 flex gap-2 overflow-x-auto max-w-full pb-2">
               <span className="text-xs text-gray-500 whitespace-nowrap">Try:</span>
               <button onClick={() => setPrompt("A hard level with lots of enemies")} className="text-xs border border-gray-700 px-2 py-1 rounded hover:bg-gray-800">Hard Mode</button>
               <button onClick={() => setPrompt("A coin heaven with no enemies")} className="text-xs border border-gray-700 px-2 py-1 rounded hover:bg-gray-800">Coin Heaven</button>
               <button onClick={() => setPrompt("An underground maze")} className="text-xs border border-gray-700 px-2 py-1 rounded hover:bg-gray-800">Underground</button>
            </div>
          </div>
        )}

        {/* State: LOADING */}
        {gameState === GameState.GENERATING && (
           <div className="absolute inset-0 bg-black z-20 flex flex-col items-center justify-center">
             <div className="animate-spin text-red-500 mb-4">
               <Sparkles size={48} />
             </div>
             <p className="text-white text-lg animate-pulse">{loadingMsg}</p>
           </div>
        )}

        {/* State: PLAYING (Canvas) */}
        {levelData && (
          <GameCanvas 
            gameState={gameState}
            levelData={levelData} 
            controls={controls}
            onCoinCollect={handleCoin}
            onWin={handleWin}
            onDie={handleDie}
          />
        )}

        {/* State: WIN/LOSS Overlays */}
        {(gameState === GameState.WON || gameState === GameState.LOST) && (
          <div className="absolute inset-0 bg-black/80 z-30 flex flex-col items-center justify-center backdrop-blur-sm animate-in fade-in duration-300">
             {gameState === GameState.WON ? (
               <Trophy className="text-yellow-400 w-24 h-24 mb-4 animate-bounce" />
             ) : (
               <Skull className="text-gray-400 w-24 h-24 mb-4" />
             )}
             <h2 className="text-4xl font-bold mb-2">{gameState === GameState.WON ? "LEVEL CLEARED!" : "GAME OVER"}</h2>
             <p className="text-xl mb-6">Final Score: {score}</p>
             <div className="flex gap-4">
                <button 
                  onClick={() => setGameState(GameState.PLAYING)}
                  className="px-6 py-3 bg-white text-black font-bold rounded hover:bg-gray-200"
                >
                  RETRY
                </button>
                <button 
                  onClick={() => setGameState(GameState.MENU)}
                  className="px-6 py-3 bg-transparent border-2 border-white text-white font-bold rounded hover:bg-white/10 flex items-center gap-2"
                >
                  <RotateCcw size={18}/> NEW LEVEL
                </button>
             </div>
          </div>
        )}
      </div>

      {/* --- Mobile Controls --- */}
      <div className="w-full max-w-4xl mt-4 grid grid-cols-2 gap-4 px-4 h-32 select-none touch-none">
        {/* D-Pad */}
        <div className="flex items-center justify-start gap-2">
           <button 
             className={`w-16 h-16 rounded-full border-2 border-gray-600 flex items-center justify-center ${controls.left ? 'bg-gray-700' : 'bg-gray-800'}`}
             onPointerDown={() => setControls(c => ({...c, left: true}))}
             onPointerUp={() => setControls(c => ({...c, left: false}))}
             onPointerLeave={() => setControls(c => ({...c, left: false}))}
           >←</button>
           <button 
             className={`w-16 h-16 rounded-full border-2 border-gray-600 flex items-center justify-center ${controls.right ? 'bg-gray-700' : 'bg-gray-800'}`}
             onPointerDown={() => setControls(c => ({...c, right: true}))}
             onPointerUp={() => setControls(c => ({...c, right: false}))}
             onPointerLeave={() => setControls(c => ({...c, right: false}))}
           >→</button>
        </div>
        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-4">
          <button 
             className={`w-20 h-20 rounded-full border-b-4 border-red-800 flex items-center justify-center font-bold text-xl transition-transform ${controls.jump ? 'bg-red-500 translate-y-1 border-0' : 'bg-red-600 shadow-lg'}`}
             onPointerDown={() => setControls(c => ({...c, jump: true}))}
             onPointerUp={() => setControls(c => ({...c, jump: false}))}
             onPointerLeave={() => setControls(c => ({...c, jump: false}))}
           >A</button>
        </div>
      </div>

      <div className="mt-4 text-xs text-gray-600 text-center">
        Controls: Arrows / WASD to move. Space / Up to Jump. Shift to Run.<br/>
        Mobile: Use on-screen touch controls.
      </div>
    </div>
  );
};

export default App;