import React from 'react';
import { GRID_WIDTH, GRID_HEIGHT } from '@/game/constants';

// Pending Meltdown Zone overlay — renders glowing, overheated ground with
// pulsing plasma cracks on each marked tile. Distinct from the Warden's orange
// Overload: Meltdown uses a deep red/crimson plasma-rupture style to signal
// the Harvester's failing reactor. Visible without the Tactical Lens.
//
// Rendered above tiles (z-[6]) but below units (z-10). Visual-only.
export default function MeltdownZoneOverlay({ pendingMeltdown }) {
  if (!pendingMeltdown || pendingMeltdown.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-[6]">
      {pendingMeltdown.map((z) => {
        const left = `${(z.x / GRID_WIDTH) * 100}%`;
        const top = `${(z.y / GRID_HEIGHT) * 100}%`;
        const w = `${100 / GRID_WIDTH}%`;
        const h = `${100 / GRID_HEIGHT}%`;
        return (
          <div key={z.id} className="absolute" style={{ left, top, width: w, height: h }}>
            {/* Pulsing ground glow — deep red plasma rupture */}
            <div className="absolute inset-0 bg-red-600/30 border-2 border-red-400/80 rounded-sm animate-pulse" />
            {/* Plasma crack pattern — jagged energy lines radiating from center */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="absolute w-[65%] h-[2px] bg-red-300/90 rotate-45 shadow-[0_0_6px_rgba(248,113,113,0.9)]" />
              <div className="absolute w-[2px] h-[65%] bg-red-300/90 rotate-45 shadow-[0_0_6px_rgba(248,113,113,0.9)]" />
              <div className="absolute w-[45%] h-[2px] bg-rose-200/70 -rotate-45" />
              <div className="absolute w-[2px] h-[45%] bg-rose-200/70 -rotate-45" />
            </div>
            {/* Reactor vent icon badge */}
            <div className="absolute top-0.5 left-1/2 -translate-x-1/2">
              <span className="block text-[7px] font-black tracking-[0.1em] uppercase text-red-200 bg-slate-950/85 px-1 py-0.5 rounded whitespace-nowrap animate-pulse">
                ⚠ Meltdown
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}