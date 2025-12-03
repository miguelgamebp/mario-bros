import { GoogleGenAI, Type, Schema } from "@google/genai";
import { LevelData, TileType } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const levelSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    theme: { type: Type.STRING, enum: ['day', 'night', 'underground'] },
    width: { type: Type.INTEGER, description: "Width of the level in tiles. Should be between 40 and 100." },
    height: { type: Type.INTEGER, description: "Height of the level in tiles. Usually 14." },
    layout: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Array of strings representing the level rows. Use characters: '.'=empty, '#'=ground, 'B'=brick, '?'=question, 'C'=coin, 'E'=enemy, 'F'=flag, 'S'=start position"
    },
    message: { type: Type.STRING, description: "A short welcome message for this level." }
  },
  required: ["theme", "width", "height", "layout", "message"]
};

export const generateLevel = async (prompt: string): Promise<LevelData> => {
  try {
    const systemInstruction = `
      You are a game level designer for a Super Mario Bros style platformer.
      Create a fun, playable 2D level based on the user's description.
      
      Rules:
      1. The level must be playable (jumps possible).
      2. Place 'S' (Start) on the far left.
      3. Place 'F' (Flag) on the far right.
      4. Ensure there is ground '#' across most of the bottom, but add gaps (pits) if requested.
      5. Height is fixed at 14 rows.
      6. Use '?' for powerup blocks, 'B' for breakable bricks.
      7. Be creative with verticality.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: levelSchema
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    const rawData = JSON.parse(text);
    
    // Convert string map to number[][] map
    const tiles: number[][] = [];
    const height = 14; // Force height consistency
    const width = rawData.width || 50;

    for (let y = 0; y < height; y++) {
      const row: number[] = [];
      const rowStr = rawData.layout[y] || ".".repeat(width);
      
      for (let x = 0; x < width; x++) {
        const char = rowStr[x] || '.';
        switch (char) {
          case '#': row.push(TileType.GROUND); break;
          case 'B': row.push(TileType.BRICK); break;
          case '?': row.push(TileType.QUESTION); break;
          case 'C': row.push(TileType.COIN); break;
          case 'E': row.push(TileType.ENEMY); break;
          case 'F': row.push(TileType.FLAG); break;
          case 'S': row.push(TileType.PLAYER_START); break;
          default: row.push(TileType.EMPTY);
        }
      }
      tiles.push(row);
    }

    return {
      theme: rawData.theme || 'day',
      width: width,
      height: height,
      tiles: tiles,
      message: rawData.message || "Let's-a go!"
    };

  } catch (error) {
    console.error("Gemini Level Gen Error:", error);
    // Fallback level if AI fails
    return createFallbackLevel();
  }
};

const createFallbackLevel = (): LevelData => {
  const width = 40;
  const height = 14;
  const tiles: number[][] = [];
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      if (y === height - 1 || y === height - 2) row.push(TileType.GROUND);
      else if (x === 5 && y === 9) row.push(TileType.QUESTION);
      else if (x === 10 && y === 9) row.push(TileType.BRICK);
      else if (x === 15 && y === 11) row.push(TileType.ENEMY);
      else if (x === 35 && y === 10) row.push(TileType.FLAG);
      else if (x === 2 && y === 10) row.push(TileType.PLAYER_START);
      else row.push(TileType.EMPTY);
    }
    tiles.push(row);
  }
  return { theme: 'day', width, height, tiles, message: "Fallback Level loaded." };
};
