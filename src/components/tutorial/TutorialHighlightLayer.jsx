import React from 'react';
import { GRID_WIDTH, GRID_HEIGHT } from '@/game/constants';

// TutorialHighlightLayer — renders pulse/outline highlights on battlefield
// tokens and tiles using percentage-based positioning (matches Battlefield's
// CSS grid layout). Rendered INSIDE Battlefield's grid container so
// coordinates align automatically.
//
// The layer is purely visual — pointer-events-none.
//
// Props:
//   highlights — parsed target list [{ kind, ... }]
//   units      — for resolving unit ids to tile coords
export default function TutorialHighlightLayer({ highlights, units }) {
  if (!highlights || highlights.length === 0) return null;

  const pct = (x, y) => ({
    left: `${(x / GRID_WIDTH) * 100}%`,
    top: `${(y / GRID_HEIGHT) * 100}%`,
    width: `${100 / GRID_WIDTH}%`,
    height: `${100 / GRID_HEIGHT}%`,
  });

  return (
    <div className="absolute inset-0 z-30 pointer-events-none">
      {highlights.map((h, i) => {
        if (h.kind === 'unit') {
          const unit = units.find((u) => u.id === h.id || (u.tutIds && u.tutIds.includes(h.id)));
          if (!unit) return null;
          const pos = pct(unit.x, unit.y);
          return (
            <div
              key={`u-${i}`}
              className="absolute rounded-full border-2 border-bio animate-pulse"
              style={{
                ...pos,
                boxShadow: '0 0 12px 2px rgba(130,250,70,0.6)',
              }}
            />
          );
        }
        if (h.kind === 'tile') {
          if (h.x == null || h.y == null) return null;
          const pos = pct(h.x, h.y);
          return (
            <div
              key={`t-${i}`}
              className="absolute rounded-md border-2 border-bio/80 animate-pulse"
              style={{
                ...pos,
                boxShadow: '0 0 10px 1px rgba(130,250,70,0.4)',
              }}
            />
          );
        }
        return null;
      })}
    </div>
  );
}