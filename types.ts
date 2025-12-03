export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  WON = 'WON',
  LOST = 'LOST',
  GENERATING = 'GENERATING',
}

export enum TileType {
  EMPTY = 0,
  GROUND = 1,
  BRICK = 2,
  QUESTION = 3, // Surprise block
  COIN = 4,
  ENEMY = 5,
  FLAG = 6,
  PLAYER_START = 7,
  DEATH_ZONE = 99,
}

export interface Entity {
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
  type?: TileType;
  id?: number;
  dead?: boolean;
}

export interface Player extends Entity {
  isGrounded: boolean;
  facingRight: boolean;
  isInvulnerable: boolean;
  invulnerableTimer: number;
}

export interface LevelData {
  theme: 'day' | 'night' | 'underground';
  width: number;
  height: number;
  tiles: number[][]; // 2D array representing the grid
  message: string;
}

export interface ControlState {
  left: boolean;
  right: boolean;
  jump: boolean;
  run: boolean;
}