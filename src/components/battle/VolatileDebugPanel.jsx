import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { isVolatileTile, setVolatile, VOLATILE_TILE_DAMAGE, predictHazardDamage } from '@/game/volatileTiles';
import { computeComeHerePull } from '@/game/comeHereResolver';
import { TILE_TYPES } from '@/game/constants';
import { makePlayer, makeEnemy } from '@/game/units';

// Developer / QA debug panel for Volatile Tiles & COME HERE! interaction (spec 35, 36).
// Only rendered when debug=true. Never exposed in production UI.
export default function VolatileDebugPanel({
  grid,
  setGrid,
  units,
  setUnits,
  selectedUnit,
}) {
  const [collapsed, setCollapsed] = useState(true);

  if (!grid) return null;

  // Count total volatile tiles on the grid
  let volatileCount = 0;
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      if (isVolatileTile(grid[y][x])) volatileCount++;
    }
  }

  // Toggle volatile on selected unit's tile
  const handleToggleSelected = () => {
    if (!selectedUnit || !setGrid) return;
    const { x, y } = selectedUnit;
    const active = isVolatileTile(grid[y]?.[x]);
    const nextGrid = grid.map((row) => row.map((t) => ({ ...t })));
    setVolatile(nextGrid, x, y, !active);
    setGrid(nextGrid);
  };

  // Setup QA Test Strip (spec 36): G G V V V G
  // y=6: x=1 (Soldier), x=2 (G), x=3 (V), x=4 (V), x=5 (V), x=6 (G), x=7 (Dislocator)
  const handleSetupQaStrip = (soldierHp = 10) => {
    if (!setGrid || !setUnits) return;
    const testY = 6;
    const nextGrid = grid.map((row, y) =>
      row.map((t, x) => {
        const copy = { ...t };
        if (y === testY && x >= 1 && x <= 7) {
          copy.type = TILE_TYPES.OPEN;
          copy.cover = { n: null, s: null, e: null, w: null };
          if (x >= 3 && x <= 5) {
            copy.volatile = true;
            copy.terrain = 'volatile';
          } else {
            delete copy.volatile;
            copy.terrain = 'default';
          }
        }
        return copy;
      })
    );
    setGrid(nextGrid);

    // Create test soldier and Dislocator
    const testSoldier = {
      ...makePlayer('assault', 1, testY),
      id: 'qa_soldier',
      name: `QA Operative (${soldierHp} HP)`,
      hp: soldierHp,
      maxHp: 10,
      currentArmor: 0,
      armor: 0,
      shield: 0,
      alive: true,
      downed: false,
    };
    const testDislocator = {
      ...makeEnemy('dislocator', 7, testY),
      id: 'qa_dislocator',
      name: 'QA Dislocator',
      hp: 12,
      maxHp: 12,
      ap: 2,
      maxAp: 2,
      alive: true,
      downed: false,
      cooldowns: { come_here: 0 },
    };

    // Filter out units occupying the test row and place our QA pair
    const remainingUnits = units.filter((u) => u.y !== testY || u.x < 1 || u.x > 7);
    setUnits([...remainingUnits, testSoldier, testDislocator]);
  };

  // Inspect COME HERE! pull between any Dislocator and Soldier
  const dislocator = units.find((u) => u.archetype === 'dislocator' && u.alive);
  const target = units.find((u) => u.team === 'player' && u.alive && !u.downed);
  const pullInfo = dislocator && target ? computeComeHerePull(grid, units, dislocator, target) : null;

  return (
    <div className="absolute left-3 top-36 z-40 text-[9px] font-mono bg-slate-950/95 border border-emerald-600/70 rounded-md p-2 max-w-[260px] shadow-xl text-slate-200 pointer-events-auto">
      <div className="flex items-center justify-between gap-2 border-b border-slate-700/80 pb-1 mb-1.5">
        <div className="flex items-center gap-1 font-bold text-emerald-400 uppercase tracking-wide">
          <AlertTriangle className="w-3 h-3 text-emerald-400" />
          Volatile QA ({volatileCount} tiles)
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="text-slate-400 hover:text-white px-1 text-[8px] bg-slate-800 rounded"
        >
          {collapsed ? 'EXPAND' : 'HIDE'}
        </button>
      </div>

      {!collapsed && (
        <div className="flex flex-col gap-1.5">
          <div className="text-[8px] text-slate-400 leading-tight">
            Damage: <span className="text-emerald-300 font-bold">{VOLATILE_TILE_DAMAGE} ENV</span> · Triggers ON ENTER
          </div>

          {selectedUnit && (
            <button
              type="button"
              onClick={handleToggleSelected}
              className="px-1.5 py-1 rounded bg-emerald-900/60 hover:bg-emerald-800/80 border border-emerald-500/50 text-emerald-200 text-left active:scale-95 transition"
            >
              Toggle ({selectedUnit.x},{selectedUnit.y}): {isVolatileTile(grid[selectedUnit.y]?.[selectedUnit.x]) ? 'Remove Volatile' : 'Make Volatile'}
            </button>
          )}

          <div className="border-t border-slate-800 pt-1 flex flex-col gap-1">
            <span className="text-[8px] uppercase tracking-wider text-slate-400 font-bold">QA Test Strip (G G V V V G)</span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => handleSetupQaStrip(10)}
                className="flex-1 px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-[8px] active:scale-95"
              >
                10 HP (Survive)
              </button>
              <button
                type="button"
                onClick={() => handleSetupQaStrip(4)}
                className="flex-1 px-1.5 py-0.5 rounded bg-rose-950/70 hover:bg-rose-900 border border-rose-600/70 text-rose-200 text-[8px] active:scale-95"
              >
                4 HP (Downed)
              </button>
            </div>
          </div>

          {pullInfo && (
            <div className="border-t border-slate-800 pt-1 text-[8px] leading-tight flex flex-col gap-0.5">
              <div className="text-cyan-300 font-bold">COME HERE! Pull Preview:</div>
              <div>Valid: {pullInfo.valid ? 'YES' : 'NO'} · Dist: {pullInfo.tilesMoved || 0}</div>
              <div className="text-emerald-300">
                Hazards Crossed: {pullInfo.hazardTilesCrossed || 0} ({predictHazardDamage(pullInfo.path, grid)} Raw Dmg)
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
