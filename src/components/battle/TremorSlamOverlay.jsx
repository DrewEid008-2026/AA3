import React from 'react';
import { GRID_WIDTH, GRID_HEIGHT } from '@/game/constants';
import { getTremorTileKeys } from '@/game/tremorSlam';

// Pending Tremor Slam warning overlay. Renders a highly visible 3×3 area
// warning so the player knows which tiles to vacate. Visible without the
// Tactical Lens (Part 18/24 — clear, obvious danger tiles).
export default function TremorSlamOverlay({ pendingTremor }) {
  if (!pendingTremor) return null;
  const keys = getTremorTileKeys(pendingTremor);
  const center = { x: pendingTremor.centerX, y: pendingTremor.centerY };

  const tileCenter = (x, y) => ({
    left: `${((x + 0.5) / GRID_WIDTH) * 100}%`,
    top: `${((y + 0.5) / GRID_HEIGHT) * 100}%`,
  });

  return (
    <div className="absolute inset-0 pointer-events-none z-[7]">
      {Array.from(keys).map((k) => {
        const [x, y] = k.split(',').map(Number);
        const isCenter = x === center.x && y === center.y;
        return (
          <div
            key={k}
            className="absolute"
            style={{
              ...tileCenter(x, y),
              width: `${100 / GRID_WIDTH}%`,
              height: `${100 / GRID_HEIGHT}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div className={`w-full h-full rounded-sm border-2 ${
              isCenter
                ? 'border-orange-400 bg-orange-500/30 animate-pulse'
                : 'border-orange-500/70 bg-orange-500/20'
            } flex items-center justify-center`}>
              {isCenter && (
                <span className="text-[7px] font-black text-orange-200 tracking-wide uppercase rotate-[-12deg]">
                  SLAM
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}