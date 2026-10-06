import React from 'react';
import { GRID_WIDTH, GRID_HEIGHT } from '@/game/constants';
import { getBeamTileKeys } from '@/game/excavationBeam';

// Pending Excavation Beam warning overlay. Renders a highly visible full-lane
// warning (row or column) so the player knows which line to vacate. Visible
// without the Tactical Lens (Part 28/34 — strong, obvious highlight).
export default function ExcavationBeamOverlay({ pendingBeam }) {
  if (!pendingBeam) return null;
  const keys = getBeamTileKeys(pendingBeam);
  const isRow = pendingBeam.orientation === 'row';

  const tileCenter = (x, y) => ({
    left: `${((x + 0.5) / GRID_WIDTH) * 100}%`,
    top: `${((y + 0.5) / GRID_HEIGHT) * 100}%`,
  });

  return (
    <div className="absolute inset-0 pointer-events-none z-[7]">
      {Array.from(keys).map((k) => {
        const [x, y] = k.split(',').map(Number);
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
            <div className="w-full h-full border-2 border-cyan-400/80 bg-cyan-500/20 animate-pulse flex items-center justify-center">
              <span className="text-[7px] font-black text-cyan-200 tracking-wide uppercase rotate-[-90deg] hidden">
                BEAM
              </span>
            </div>
          </div>
        );
      })}
      {/* Directional indicator at the lane label position */}
      <div
        className="absolute"
        style={{
          ...tileCenter(isRow ? 4 : pendingBeam.index, isRow ? pendingBeam.index : 7),
          transform: 'translate(-50%, -50%)',
        }}
      >
        <span className="text-[8px] font-black text-cyan-200 bg-cyan-900/80 border border-cyan-400/60 px-1 py-0.5 rounded tracking-wider uppercase whitespace-nowrap shadow-lg">
          {isRow ? `◀ BEAM ▶` : `▲ BEAM ▼`}
        </span>
      </div>
    </div>
  );
}