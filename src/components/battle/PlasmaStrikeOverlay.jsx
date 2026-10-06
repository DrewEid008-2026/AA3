import React from 'react';
import { GRID_WIDTH, GRID_HEIGHT } from '@/game/constants';
import { getPlasmaStrikeTileKeys } from '@/game/plasmaStrike';

// Pending Plasma Strike hazard overlay. Renders the marked center + adjacent
// tiles with a pulsing danger tint so the player can see where the strike will
// detonate and move out of the area. The strike detonates at the start of the
// next Enemy Phase (see Battle.jsx runEnemyPhase).
export default function PlasmaStrikeOverlay({ plasmaStrikes }) {
  if (!plasmaStrikes || plasmaStrikes.length === 0) return null;
  const allKeys = new Set();
  const centers = [];
  for (const s of plasmaStrikes) {
    for (const k of getPlasmaStrikeTileKeys(s)) allKeys.add(k);
    centers.push({ x: s.x, y: s.y });
  }
  return (
    <div className="absolute inset-0 pointer-events-none z-[6]">
      {Array.from(allKeys).map((k) => {
        const [x, y] = k.split(',').map(Number);
        const isCenter = centers.some((c) => c.x === x && c.y === y);
        return (
          <span
            key={k}
            className={`absolute rounded-sm border-2 animate-pulse ${
              isCenter
                ? 'bg-fuchsia-500/30 border-fuchsia-400/70'
                : 'bg-fuchsia-500/15 border-fuchsia-400/40'
            }`}
            style={{
              left: `${(x / GRID_WIDTH) * 100}%`,
              top: `${(y / GRID_HEIGHT) * 100}%`,
              width: `${100 / GRID_WIDTH}%`,
              height: `${100 / GRID_HEIGHT}%`,
            }}
          />
        );
      })}
    </div>
  );
}