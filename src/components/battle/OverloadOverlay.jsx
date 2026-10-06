import React from 'react';
import { GRID_WIDTH, GRID_HEIGHT } from '@/game/constants';

// Pending Overload hazard overlay — renders unstable energy cracks on each
// marked tile. Distinct from Beam Sweep (fuchsia lanes) and Plasma Strike
// (fuchsia blast areas): Overload uses an orange/red energy-crack style to
// signal core destabilization. Visible without the Tactical Lens.
//
// Rendered above tiles (z-[6]) but below units (z-10) so soldiers remain
// visible inside the hazard area. Visual-only — does NOT mutate game state.
export default function OverloadOverlay({ hazards }) {
  if (!hazards || hazards.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-[6]">
      {hazards.map((h) => {
        const left = `${(h.x / GRID_WIDTH) * 100}%`;
        const top = `${(h.y / GRID_HEIGHT) * 100}%`;
        const w = `${100 / GRID_WIDTH}%`;
        const hgt = `${100 / GRID_HEIGHT}%`;
        return (
          <div
            key={h.id}
            className="absolute"
            style={{ left, top, width: w, height: hgt }}
          >
            {/* Pulsing ground glow — orange/red core energy */}
            <div className="absolute inset-0 bg-orange-500/25 border-2 border-orange-400/70 rounded-sm animate-pulse" />
            {/* Energy crack pattern — jagged lines radiating from center */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="absolute w-[60%] h-[2px] bg-orange-300/80 rotate-45 shadow-[0_0_6px_rgba(251,146,60,0.9)]" />
              <div className="absolute w-[2px] h-[60%] bg-orange-300/80 rotate-45 shadow-[0_0_6px_rgba(251,146,60,0.9)]" />
              <div className="absolute w-[40%] h-[2px] bg-amber-200/70 -rotate-45" />
              <div className="absolute w-[2px] h-[40%] bg-amber-200/70 -rotate-45" />
            </div>
            {/* Core-energy icon badge */}
            <div className="absolute top-0.5 left-1/2 -translate-x-1/2">
              <span className="block text-[7px] font-black tracking-[0.1em] uppercase text-orange-200 bg-slate-950/85 px-1 py-0.5 rounded whitespace-nowrap animate-pulse">
                ⚡ Overload
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}