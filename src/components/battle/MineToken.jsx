import React from 'react';
import { GRID_WIDTH, GRID_HEIGHT } from '@/game/constants';
import { Zap } from 'lucide-react';

const tileCenter = (x, y) => ({
  left: `${((x + 0.5) / GRID_WIDTH) * 100}%`,
  top: `${((y + 0.5) / GRID_HEIGHT) * 100}%`,
});

const TILE_W = `${100 / GRID_WIDTH}%`;
const TILE_H = `${100 / GRID_HEIGHT}%`;

// Visual marker for a deployed Shock Mine. Subtle but visible so the player
// can remember where their mines are. Does not resemble cover.
export default function MineToken({ mine }) {
  if (!mine) return null;
  return (
    <div
      className="absolute pointer-events-none z-[7]"
      style={{ ...tileCenter(mine.x, mine.y), width: TILE_W, height: TILE_H, transform: 'translate(-50%, -50%)' }}
    >
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-[40%] h-[40%] rounded-full bg-yellow-500/20 border border-yellow-400/60 flex items-center justify-center shadow-[0_0_6px_rgba(250,204,21,0.4)]">
          <Zap className="w-[60%] h-[60%] text-yellow-300" strokeWidth={2.5} />
        </div>
      </div>
    </div>
  );
}