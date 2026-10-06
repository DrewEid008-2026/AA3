import React from 'react';
import { GRID_WIDTH, GRID_HEIGHT } from '@/game/constants';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

const tileCenter = (x, y) => ({
  left: `${((x + 0.5) / GRID_WIDTH) * 100}%`,
  top: `${((y + 0.5) / GRID_HEIGHT) * 100}%`,
});

const TILE_W = `${100 / GRID_WIDTH}%`;
const TILE_H = `${100 / GRID_HEIGHT}%`;

// Orientation picker overlay shown after the player selects a tile for
// Deploy Barricade. Renders 4 directional buttons around the target tile.
// Each button places the barricade on that side of the tile.
export default function BarricadeOrientationPicker({ tile, onPick, onCancel }) {
  if (!tile) return null;
  const { x, y } = tile;

  const btn = (dir, Icon, posClass) => (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onPick(dir); }}
      className={`absolute w-7 h-7 rounded-full bg-amber-600 border-2 border-amber-300 text-white flex items-center justify-center shadow-lg active:scale-90 transition touch-manipulation z-30 ${posClass}`}
    >
      <Icon className="w-4 h-4" strokeWidth={2.5} />
    </button>
  );

  return (
    <div
      className="absolute pointer-events-auto z-30"
      style={{ ...tileCenter(x, y), width: TILE_W, height: TILE_H, transform: 'translate(-50%, -50%)' }}
      onClick={onCancel}
    >
      {/* Highlight the target tile */}
      <div className="absolute inset-0 rounded-sm border-2 border-amber-400 bg-amber-400/15 shadow-[0_0_10px_rgba(251,191,36,0.5)]" />

      {/* Direction buttons positioned around the tile */}
      <div className="absolute inset-0">
        {btn('n', ChevronUp, 'top-0 left-1/2 -translate-x-1/2 -translate-y-[120%]')}
        {btn('s', ChevronDown, 'bottom-0 left-1/2 -translate-x-1/2 translate-y-[120%]')}
        {btn('e', ChevronRight, 'right-0 top-1/2 -translate-y-1/2 translate-x-[120%]')}
        {btn('w', ChevronLeft, 'left-0 top-1/2 -translate-y-1/2 -translate-x-[120%]')}
      </div>
    </div>
  );
}