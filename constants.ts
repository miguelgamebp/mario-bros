export const TILE_SIZE = 32;
export const GRAVITY = 0.5;
export const FRICTION = 0.8;
export const ACCELERATION = 0.5;
export const JUMP_FORCE = -10; // Negative because Y is down
export const MAX_SPEED = 5;
export const ENEMY_SPEED = 1.5;

// Colors
export const COLORS = {
  sky: '#63adff',
  skyNight: '#0f0f2a',
  ground: '#5c94fc', // Classic NES blue-ish ground highlight
  groundDark: '#c84c0c', // Or the brownish ground
  brick: '#b83800',
  gold: '#f8d820',
  enemy: '#883000',
  heroRed: '#ff0000',
  heroBlue: '#0000ff',
  heroSkin: '#ffcc99',
};

export const DEFAULT_LEVEL_PROMPT = "A standard mario-like level with some jumps, a few goombas, coins, and a flag at the end.";
