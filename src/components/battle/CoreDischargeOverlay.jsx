import React from 'react';
import { GRID_WIDTH, GRID_HEIGHT } from '@/game/constants';
import { getCoreDischargeTileKeys } from '@/game/coreDischarge';

// Pending Core Discharge overlay — renders a large telegraphed danger area
// (radius 2) around the Harvester. Uses a white-hot/blue energy burst style to
// distinguish from Meltdown (red) and Siege Charge (red). The affected tiles
// are frozen at telegraph time (Part 32). Visible without the Tactical Lens.
//
// Rendered above tiles (z-[7]) but below units (z-10). Visual-only.
export default function CoreDischargeOverlay({ pendingCoreDischarge }) {
  if (!pendingCoreDischarge) return null;
  const keys = getCoreDischargeTileKeys(pendingCoreDischarge);
  if (keys.size === 0) return null;

  const { sourceX, sourceY, tiles } = pendingCoreDischarge;

  return (
    <div className="absolute inset-0 pointer-events-none z-[7]">
      {tiles.map((t) => {
        const left = `${(t.x / GRID_WIDTH) * 100}%`;
        const top = `${(t.y / GRID_HEIGHT) * 100}%`;
        const w = `${100 / GRID_WIDTH}%`;
        const h = `${100 / GRID_HEIGHT}%`;
        const dist = Math.max(Math.abs(t.x - sourceX), Math.abs(t.y - sourceY));
        return (
          <div key={`${t.x},${t.y}`} className="absolute" style={{ left, top, width: w, height: h }}>
            {/* Pulsing energy field — white-hot core energy */}
            <div
              className={`absolute inset-0 border-2 rounded-sm animate-pulse ${
                dist <= 1
                  ? 'bg-cyan-400/35 border-cyan-300/90'
                  : 'bg-cyan-500/25 border-cyan-400/70'
              }`}
            />
            {/* Energy vent pattern — radiating from the Harvester */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="absolute w-[55%] h-[2px] bg-cyan-200/90 rotate-45 shadow-[0_0_8px_rgba(34,211,238,0.9)]" />
              <div className="absolute w-[2px] h-[55%] bg-cyan-200/90 rotate-45 shadow-[0_0_8px_rgba(34,211,238,0.9)]" />
            </div>
          </div>
        );
      })}

      {/* "CORE DISCHARGE INCOMING" label centered on the Harvester */}
      <div
        className="absolute"
        style={{
          left: `${(sourceX + 0.5) / GRID_WIDTH * 100}%`,
          top: `${(sourceY + 0.5) / GRID_HEIGHT * 100}%`,
          transform: 'translate(-50%, -50%)',
        }}
      >
        <div className="text-[8px] font-black text-cyan-100 tracking-wider uppercase bg-cyan-950/85 border border-cyan-400/60 px-1.5 py-0.5 rounded whitespace-nowrap shadow-lg animate-pulse">
          ⚡ Core Discharge
        </div>
      </div>
    </div>
  );
}