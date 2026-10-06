import React from 'react';
import { GRID_WIDTH, GRID_HEIGHT } from '@/game/constants';
import { getChargePathKeys, getChargePathTiles } from '@/game/siegeCharge';

// Pending Siege Charge telegraph overlay. Renders a highly visible charge path
// with directional arrows, danger markers, and "SIEGE CHARGE INCOMING" text.
// The path is unmistakable — danger tiles take visual priority over terrain
// (Part 15/38). Visible without the Tactical Lens.
export default function SiegeChargeOverlay({ pendingCharge }) {
  if (!pendingCharge) return null;
  const tiles = getChargePathTiles(pendingCharge);
  if (tiles.length === 0) return null;
  const keys = getChargePathKeys(pendingCharge);

  const tileStyle = (x, y) => ({
    left: `${(x / GRID_WIDTH) * 100}%`,
    top: `${(y / GRID_HEIGHT) * 100}%`,
    width: `${100 / GRID_WIDTH}%`,
    height: `${100 / GRID_HEIGHT}%`,
  });

  // Directional arrow character based on charge direction.
  const arrowChar = {
    north: '▲',
    south: '▼',
    east: '▶',
    west: '◀',
  }[pendingCharge.dir] || '■';

  const isDest = (x, y) => x === pendingCharge.destinationX && y === pendingCharge.destinationY;

  return (
    <div className="absolute inset-0 pointer-events-none z-[8]">
      {tiles.map((t) => {
        const dest = isDest(t.x, t.y);
        return (
          <div key={`${t.x},${t.y}`} className="absolute" style={tileStyle(t.x, t.y)}>
            <div
              className={`w-full h-full flex items-center justify-center border-2 ${
                dest
                  ? 'border-red-400 bg-red-500/40 animate-pulse'
                  : 'border-red-500/70 bg-red-500/25'
              }`}
            >
              <span className="text-[10px] font-black text-red-200 tracking-wide">
                {arrowChar}
              </span>
            </div>
          </div>
        );
      })}

      {/* "SIEGE CHARGE INCOMING" label centered on the path */}
      <div
        className="absolute"
        style={{
          left: `${((pendingCharge.sourceX + pendingCharge.destinationX) / 2 + 0.5) / GRID_WIDTH * 100}%`,
          top: `${((pendingCharge.sourceY + pendingCharge.destinationY) / 2 + 0.5) / GRID_HEIGHT * 100}%`,
          transform: 'translate(-50%, -50%)',
        }}
      >
        <div className="text-[8px] font-black text-red-200 tracking-wider uppercase bg-red-900/80 border border-red-500/60 px-1.5 py-0.5 rounded whitespace-nowrap shadow-lg">
          ⚡ Siege Charge
        </div>
      </div>
    </div>
  );
}