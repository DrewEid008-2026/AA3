import React from 'react';
import { GRID_WIDTH, GRID_HEIGHT } from '@/game/constants';
import { getBeamSweepTileKeys } from '@/game/beamSweep';

// Beam Sweep warning overlay — renders a highly visible glowing lane for each
// pending Beam Sweep. The lane pulses so the player notices the threat without
// needing the Tactical Lens. This is a visual-only layer; it does NOT mutate
// game state.
//
// Rendered above tiles (z-[6]) but below units (z-10) so soldiers remain visible
// inside the warning lane. The lane spans the full row or column.
export default function BeamSweepOverlay({ beamSweeps }) {
  if (!beamSweeps || beamSweeps.length === 0) return null;

  return (
    <>
      {beamSweeps.map((sweep) => {
        const keys = getBeamSweepTileKeys(sweep);
        const isRow = sweep.orientation === 'row';
        // Lane label position: center of the lane
        const labelX = isRow ? Math.floor(GRID_WIDTH / 2) : sweep.index;
        const labelY = isRow ? sweep.index : Math.floor(GRID_HEIGHT / 2);

        return (
          <div key={sweep.id} className="absolute inset-0 pointer-events-none z-[6]">
            {/* Glowing lane tiles */}
            {Array.from(keys).map((k) => {
              const [x, y] = k.split(',').map(Number);
              return (
                <div
                  key={k}
                  className="absolute"
                  style={{
                    left: `${(x / GRID_WIDTH) * 100}%`,
                    top: `${(y / GRID_HEIGHT) * 100}%`,
                    width: `${100 / GRID_WIDTH}%`,
                    height: `${100 / GRID_HEIGHT}%`,
                  }}
                >
                  <div className="absolute inset-0 bg-fuchsia-500/25 border border-fuchsia-400/50 animate-pulse" />
                  <div className="absolute inset-0 bg-gradient-to-r from-fuchsia-500/10 via-fuchsia-400/30 to-fuchsia-500/10 animate-pulse" />
                </div>
              );
            })}

            {/* Directional beam indicator — a bright line through the lane center */}
            {isRow ? (
              <div
                className="absolute"
                style={{
                  left: '0%',
                  top: `${((labelY + 0.5) / GRID_HEIGHT) * 100}%`,
                  width: '100%',
                  height: '2px',
                  transform: 'translateY(-50%)',
                }}
              >
                <div className="w-full h-full bg-fuchsia-400/70 shadow-[0_0_8px_rgba(232,121,249,0.8)] animate-pulse" />
              </div>
            ) : (
              <div
                className="absolute"
                style={{
                  left: `${((labelX + 0.5) / GRID_WIDTH) * 100}%`,
                  top: '0%',
                  width: '2px',
                  height: '100%',
                  transform: 'translateX(-50%)',
                }}
              >
                <div className="w-full h-full bg-fuchsia-400/70 shadow-[0_0_8px_rgba(232,121,249,0.8)] animate-pulse" />
              </div>
            )}

            {/* "BEAM SWEEP INCOMING" label at the lane edge nearest the Warden */}
            <div
              className="absolute"
              style={{
                left: `${((labelX + 0.5) / GRID_WIDTH) * 100}%`,
                top: `${((labelY + 0.5) / GRID_HEIGHT) * 100}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <span className="block text-[8px] font-black tracking-[0.15em] uppercase text-fuchsia-200 bg-slate-950/90 px-1.5 py-0.5 rounded whitespace-nowrap animate-pulse">
                ◆ Sweep
              </span>
            </div>
          </div>
        );
      })}
    </>
  );
}