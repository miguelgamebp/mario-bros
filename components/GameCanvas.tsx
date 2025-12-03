import React, { useRef, useEffect } from 'react';
import { TileType, Player, Entity, LevelData, ControlState, GameState } from '../types';
import { TILE_SIZE, GRAVITY, FRICTION, ACCELERATION, MAX_SPEED, JUMP_FORCE, ENEMY_SPEED, COLORS } from '../constants';

interface GameCanvasProps {
  levelData: LevelData;
  controls: ControlState;
  onCoinCollect: () => void;
  onWin: () => void;
  onDie: () => void;
  gameState: GameState;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ levelData, controls, onCoinCollect, onWin, onDie, gameState }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Game state held in refs to avoid React render cycle lag
  const playerRef = useRef<Player>({
    x: 100, y: 100, width: TILE_SIZE - 8, height: TILE_SIZE - 4,
    vx: 0, vy: 0, isGrounded: false, facingRight: true,
    isInvulnerable: false, invulnerableTimer: 0
  });
  
  const enemiesRef = useRef<Entity[]>([]);
  const particlesRef = useRef<any[]>([]);
  const coinsRef = useRef<Entity[]>([]); // Store coin locations to remove them
  const cameraRef = useRef({ x: 0 });
  const frameIdRef = useRef<number>(0);
  
  // Initialize Level Entities
  useEffect(() => {
    if (!levelData) return;

    enemiesRef.current = [];
    coinsRef.current = [];
    particlesRef.current = [];

    // Parse grid to find entities
    levelData.tiles.forEach((row, y) => {
      row.forEach((tile, x) => {
        const screenX = x * TILE_SIZE;
        const screenY = y * TILE_SIZE;

        if (tile === TileType.ENEMY) {
          enemiesRef.current.push({
            x: screenX, y: screenY, width: TILE_SIZE, height: TILE_SIZE,
            vx: -ENEMY_SPEED, vy: 0, type: TileType.ENEMY, dead: false
          });
        } else if (tile === TileType.COIN) {
          coinsRef.current.push({
            x: screenX, y: screenY, width: TILE_SIZE, height: TILE_SIZE,
            vx: 0, vy: 0, type: TileType.COIN, id: y * 1000 + x // Simple hash ID
          });
        } else if (tile === TileType.PLAYER_START) {
           playerRef.current = {
            ...playerRef.current,
            x: screenX, y: screenY, vx: 0, vy: 0
           };
        }
      });
    });
    
    cameraRef.current.x = 0;

  }, [levelData, gameState]); // Reset when level or gamestate changes to playing

  // Main Game Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || gameState !== GameState.PLAYING) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = false;

    const loop = () => {
      updatePhysics();
      draw(ctx, rect.width, rect.height);
      frameIdRef.current = requestAnimationFrame(loop);
    };

    frameIdRef.current = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(frameIdRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, levelData, controls]); // Re-bind if these change

  const checkCollision = (rect1: Entity, rect2: Entity) => {
    return (
      rect1.x < rect2.x + rect2.width &&
      rect1.x + rect1.width > rect2.x &&
      rect1.y < rect2.y + rect2.height &&
      rect1.y + rect1.height > rect2.y
    );
  };

  const getTileAt = (px: number, py: number) => {
    const tx = Math.floor(px / TILE_SIZE);
    const ty = Math.floor(py / TILE_SIZE);
    if (ty < 0 || ty >= levelData.height || tx < 0 || tx >= levelData.width) return TileType.EMPTY;
    // Treat Start as empty physics-wise, but we removed it from grid anyway usually.
    // However, if we didn't remove it from grid array:
    const t = levelData.tiles[ty][tx];
    if (t === TileType.PLAYER_START || t === TileType.COIN || t === TileType.ENEMY) return TileType.EMPTY; 
    return t;
  };

  const updatePhysics = () => {
    const player = playerRef.current;
    
    // --- Player Movement ---
    if (controls.left) {
      player.vx -= ACCELERATION;
      player.facingRight = false;
    }
    if (controls.right) {
      player.vx += ACCELERATION;
      player.facingRight = true;
    }

    // Friction
    player.vx *= FRICTION;
    if (Math.abs(player.vx) < 0.1) player.vx = 0;
    if (player.vx > MAX_SPEED) player.vx = MAX_SPEED;
    if (player.vx < -MAX_SPEED) player.vx = -MAX_SPEED;

    // Gravity
    player.vy += GRAVITY;

    // Jump
    if (controls.jump && player.isGrounded) {
      player.vy = JUMP_FORCE;
      player.isGrounded = false;
    }

    // --- Collision Detection (X Axis) ---
    player.x += player.vx;
    checkWallCollisions(player);

    // --- Collision Detection (Y Axis) ---
    player.y += player.vy;
    player.isGrounded = false; // Assume falling until proven otherwise
    checkFloorCollisions(player);

    // --- World Bounds ---
    if (player.y > levelData.height * TILE_SIZE) {
      onDie();
    }

    // --- Enemy Logic ---
    enemiesRef.current.forEach(enemy => {
      if (enemy.dead) {
        enemy.y += 4; // Fall off screen
        return; 
      }
      
      enemy.vy += GRAVITY;
      enemy.x += enemy.vx;
      
      // Simple turn around logic
      // Check walls for enemy
      const txLeft = Math.floor(enemy.x / TILE_SIZE);
      const txRight = Math.floor((enemy.x + enemy.width) / TILE_SIZE);
      const ty = Math.floor((enemy.y + 10) / TILE_SIZE);
      
      // Basic ground check for enemies
      enemy.y += enemy.vy;
      const tyFoot = Math.floor((enemy.y + enemy.height) / TILE_SIZE);
       if (levelData.tiles[tyFoot]?.[Math.floor((enemy.x + enemy.width/2)/TILE_SIZE)] !== TileType.EMPTY) {
           enemy.y = tyFoot * TILE_SIZE - enemy.height;
           enemy.vy = 0;
       }

      // Wall checks
      if (getTileAt(enemy.x, enemy.y + 5) !== TileType.EMPTY || 
          getTileAt(enemy.x + enemy.width, enemy.y + 5) !== TileType.EMPTY) {
        enemy.vx *= -1;
      }

      // --- Player vs Enemy ---
      if (checkCollision(player, enemy)) {
        // Did player stomp? (Coming from above)
        if (player.vy > 0 && player.y + player.height - player.vy < enemy.y + enemy.height / 2) {
           enemy.dead = true;
           player.vy = JUMP_FORCE / 2; // Bounce
           // Add particle
           particlesRef.current.push({x: enemy.x, y: enemy.y, life: 20});
        } else {
          // Player hurt
          onDie();
        }
      }
    });

    // --- Coins ---
    // Coins in grid are static images, but we use coinsRef for state. 
    // Optimization: Only check coins near player
    for (let i = coinsRef.current.length - 1; i >= 0; i--) {
        const coin = coinsRef.current[i];
        if (checkCollision(player, coin)) {
            onCoinCollect();
            coinsRef.current.splice(i, 1);
        }
    }

    // --- Goal Flag ---
    const tx = Math.floor((player.x + player.width/2) / TILE_SIZE);
    const ty = Math.floor((player.y + player.height/2) / TILE_SIZE);
    if (levelData.tiles[ty]?.[tx] === TileType.FLAG) {
      onWin();
    }

    // --- Camera Follow ---
    // Keep player in middle 1/3 of screen
    const targetCamX = player.x - 300; // Offset
    cameraRef.current.x += (targetCamX - cameraRef.current.x) * 0.1;
    // Clamp camera
    cameraRef.current.x = Math.max(0, cameraRef.current.x);
    const maxCam = (levelData.width * TILE_SIZE) - canvasRef.current!.getBoundingClientRect().width;
    // Let it scroll a bit past end is fine, but generally clamp
  };

  const checkWallCollisions = (entity: Entity) => {
    const left = Math.floor(entity.x / TILE_SIZE);
    const right = Math.floor((entity.x + entity.width) / TILE_SIZE);
    const top = Math.floor(entity.y / TILE_SIZE);
    const bottom = Math.floor((entity.y + entity.height - 0.1) / TILE_SIZE);

    // Checking right Movement
    if (entity.vx > 0) {
      if (isSolid(right, top) || isSolid(right, bottom)) {
        entity.x = right * TILE_SIZE - entity.width;
        entity.vx = 0;
      }
    }
    // Checking left Movement
    else if (entity.vx < 0) {
      if (isSolid(left, top) || isSolid(left, bottom)) {
        entity.x = (left + 1) * TILE_SIZE;
        entity.vx = 0;
      }
    }
  };

  const checkFloorCollisions = (entity: Entity) => {
    const left = Math.floor(entity.x / TILE_SIZE);
    const right = Math.floor((entity.x + entity.width) / TILE_SIZE);
    const top = Math.floor(entity.y / TILE_SIZE);
    const bottom = Math.floor((entity.y + entity.height) / TILE_SIZE);

    // Falling
    if (entity.vy > 0) {
      if (isSolid(left, bottom) || isSolid(right, bottom)) {
        entity.y = bottom * TILE_SIZE - entity.height;
        entity.vy = 0;
        // @ts-ignore
        if (entity.isGrounded !== undefined) entity.isGrounded = true;
      }
    }
    // Jumping/Hitting Head
    else if (entity.vy < 0) {
      if (isSolid(left, top) || isSolid(right, top)) {
        entity.y = (top + 1) * TILE_SIZE;
        entity.vy = 0;
        
        // Break Block Logic?
        const tile = levelData.tiles[top][right]; // Simplified, should check both
        if (tile === TileType.QUESTION) {
           levelData.tiles[top][right] = TileType.EMPTY; // Empty it
           // Spawn coin effect or mushroom
           onCoinCollect();
        } else if (tile === TileType.BRICK) {
             levelData.tiles[top][right] = TileType.EMPTY;
        }
      }
    }
  };

  const isSolid = (x: number, y: number) => {
    if (y < 0 || y >= levelData.height || x < 0 || x >= levelData.width) return false;
    const t = levelData.tiles[y][x];
    return t === TileType.GROUND || t === TileType.BRICK || t === TileType.QUESTION;
  };

  const draw = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // 1. Sky
    ctx.fillStyle = levelData.theme === 'night' ? COLORS.skyNight : COLORS.sky;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(-cameraRef.current.x, 0);

    // 2. Map
    // Optimization: only iterate visible range
    const startCol = Math.floor(cameraRef.current.x / TILE_SIZE);
    const endCol = startCol + Math.ceil(width / TILE_SIZE) + 1;

    for (let y = 0; y < levelData.height; y++) {
      for (let x = startCol; x < endCol; x++) {
        if (x < 0 || x >= levelData.width) continue;
        
        const tile = levelData.tiles[y][x];
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;

        if (tile === TileType.GROUND) {
            ctx.fillStyle = COLORS.groundDark;
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            ctx.fillStyle = COLORS.ground;
            ctx.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
        } else if (tile === TileType.BRICK) {
            ctx.fillStyle = '#000';
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            ctx.fillStyle = COLORS.brick;
            ctx.fillRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
            // Brick lines
            ctx.fillStyle = '#000';
            ctx.fillRect(px, py + TILE_SIZE/2, TILE_SIZE, 2);
            ctx.fillRect(px + TILE_SIZE/2, py, 2, TILE_SIZE/2);
            ctx.fillRect(px + TILE_SIZE/4, py + TILE_SIZE/2, 2, TILE_SIZE/2);
        } else if (tile === TileType.QUESTION) {
            ctx.fillStyle = '#b88800';
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            ctx.fillStyle = COLORS.gold;
            ctx.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
            ctx.fillStyle = '#000';
            ctx.font = 'bold 20px monospace';
            ctx.fillText('?', px + 10, py + 24);
        } else if (tile === TileType.FLAG) {
            ctx.fillStyle = '#fff'; // Pole
            ctx.fillRect(px + 14, py, 4, TILE_SIZE);
            if (y > 0 && levelData.tiles[y-1][x] !== TileType.FLAG) {
                 // Top of flag
                 ctx.fillStyle = '#0f0';
                 ctx.beginPath();
                 ctx.moveTo(px + 18, py);
                 ctx.lineTo(px + 30, py + 8);
                 ctx.lineTo(px + 18, py + 16);
                 ctx.fill();
            }
        }
      }
    }

    // 3. Dynamic Coins
    coinsRef.current.forEach(c => {
        ctx.fillStyle = COLORS.gold;
        ctx.beginPath();
        ctx.arc(c.x + TILE_SIZE/2, c.y + TILE_SIZE/2, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#b88800';
        ctx.stroke();
    });

    // 4. Enemies
    enemiesRef.current.forEach(e => {
        if (e.dead) {
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = COLORS.enemy;
            ctx.fillRect(e.x, e.y + 10, e.width, e.height/2); // Squished
            ctx.globalAlpha = 1.0;
        } else {
            ctx.fillStyle = COLORS.enemy;
            // Goomba shape-ish
            ctx.beginPath();
            ctx.moveTo(e.x, e.y + e.height);
            ctx.lineTo(e.x + e.width, e.y + e.height);
            ctx.lineTo(e.x + e.width - 2, e.y + e.height/2);
            ctx.quadraticCurveTo(e.x + e.width/2, e.y, e.x + 2, e.y + e.height/2);
            ctx.fill();
            
            // Eyes
            ctx.fillStyle = '#fff';
            ctx.fillRect(e.x + 6, e.y + 10, 6, 8);
            ctx.fillRect(e.x + 20, e.y + 10, 6, 8);
            ctx.fillStyle = '#000';
            ctx.fillRect(e.x + 8, e.y + 12, 2, 4);
            ctx.fillRect(e.x + 22, e.y + 12, 2, 4);
        }
    });

    // 5. Player
    const p = playerRef.current;
    if (p.invulnerableTimer > 0 && Math.floor(Date.now() / 50) % 2 === 0) {
        // Blink effect
    } else {
        // Draw Mario-like sprite using primitive shapes
        const py = p.y;
        const px = p.x;
        const w = p.width;
        const h = p.height;
        
        const dir = p.facingRight ? 1 : -1;

        // Hat
        ctx.fillStyle = COLORS.heroRed;
        ctx.fillRect(px, py, w, h/3); 
        // Bill of hat
        ctx.fillRect(p.facingRight ? px + w/2 : px - 4, py, w/2 + 4, 4);

        // Face
        ctx.fillStyle = COLORS.heroSkin;
        ctx.fillRect(px + 4, py + h/3, w - 8, h/3);

        // Body/Overalls
        ctx.fillStyle = COLORS.heroBlue;
        ctx.fillRect(px + 2, py + (2*h)/3, w - 4, h/3);
        
        // Strap
        ctx.fillStyle = COLORS.heroRed;
        ctx.fillRect(px + 6, py + (2*h)/3, 4, 8);
        ctx.fillRect(px + w - 10, py + (2*h)/3, 4, 8);
    }

    ctx.restore();
  };

  return <canvas ref={canvasRef} className="w-full h-full block" />;
};

export default GameCanvas;