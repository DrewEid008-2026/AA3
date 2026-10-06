import React from 'react';
import { Pickaxe, BrickWall, RotateCw, Eye, EyeOff } from 'lucide-react';

// Development-only debug panel for the terrain-manipulation utilities. Shown
// in Battle when debug is active. Lets developers grant/restore the utility
// abilities on the selected unit and toggle tile highlights for inspection.
//
// Grant: temporarily adds the ability to the selected unit's equipmentAbilities
//        and resets its per-mission uses (for testing without the Armory).
// Restore Uses: resets abilityUses for both terrain utilities on the unit.
// Show Siege Tiles: highlights all intact Siege-destructible map tiles.
// Show Insta-Wall Tiles: highlights valid placement tiles for the selected unit.
export default function TerrainUtilityDebugPanel({
  debug,
  selectedUnit,
  onGrantWallCharge,
  onGrantInstaWall,
  onRestoreUses,
  showSiegeTiles,
  onToggleShowSiege,
  showInstaWallTiles,
  onToggleShowInstaWall,
}) {
  if (!debug) return null;
  const hasSelection = !!selectedUnit;

  return (
    <div className="absolute top-2 right-2 z-30 flex flex-col gap-1.5 pointer-events-auto max-w-[160px]">
      <div className="text-[9px] uppercase tracking-wider text-amber-300 font-bold bg-slate-950/80 px-2 py-1 rounded border border-amber-800/50">
        Terrain Utility
      </div>
      <button
        type="button"
        onClick={onGrantWallCharge}
        disabled={!hasSelection}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[10px] font-bold tracking-wide uppercase touch-manipulation active:scale-95 border bg-slate-900/80 text-amber-300 border-amber-800/50 disabled:opacity-40"
      >
        <Pickaxe className="w-3.5 h-3.5" />
        Grant Wall Charge
      </button>
      <button
        type="button"
        onClick={onGrantInstaWall}
        disabled={!hasSelection}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[10px] font-bold tracking-wide uppercase touch-manipulation active:scale-95 border bg-slate-900/80 text-amber-300 border-amber-800/50 disabled:opacity-40"
      >
        <BrickWall className="w-3.5 h-3.5" />
        Grant Insta-Wall
      </button>
      <button
        type="button"
        onClick={onRestoreUses}
        disabled={!hasSelection}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[10px] font-bold tracking-wide uppercase touch-manipulation active:scale-95 border bg-slate-900/80 text-slate-300 border-slate-700/50 disabled:opacity-40"
      >
        <RotateCw className="w-3.5 h-3.5" />
        Restore Uses
      </button>
      <button
        type="button"
        onClick={onToggleShowSiege}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[10px] font-bold tracking-wide uppercase touch-manipulation active:scale-95 border ${
          showSiegeTiles
            ? 'bg-rose-600/80 text-white border-rose-400'
            : 'bg-slate-900/80 text-rose-300 border-rose-800/50'
        }`}
      >
        {showSiegeTiles ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        Siege Tiles
      </button>
      <button
        type="button"
        onClick={onToggleShowInstaWall}
        disabled={!hasSelection}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[10px] font-bold tracking-wide uppercase touch-manipulation active:scale-95 border disabled:opacity-40 ${
          showInstaWallTiles
            ? 'bg-emerald-600/80 text-white border-emerald-400'
            : 'bg-slate-900/80 text-emerald-300 border-emerald-800/50'
        }`}
      >
        {showInstaWallTiles ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        Insta-Wall Tiles
      </button>
      {!hasSelection && (
        <div className="text-[9px] text-slate-500 bg-slate-950/80 px-2 py-1 rounded leading-tight">
          Select a unit to grant/restore.
        </div>
      )}
    </div>
  );
}