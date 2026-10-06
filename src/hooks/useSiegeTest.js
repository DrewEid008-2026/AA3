import { useState, useCallback } from 'react';
import { TILE_TYPES } from '@/game/constants';
import {
  isSiegeDestructibleTile,
  destroyTile,
  destroyTilesAlongLine,
  SIEGE_TEST_ATTACK,
  getTileKindLabel,
} from '@/game/tileDestruction';

// Dev-only Siege Test hook — encapsulates the destructible-map-tile validation
// system so Battle.jsx stays small. Two modes:
//   'single' — tap a Siege-destructible tile to destroy it
//   'path'   — tap start, then end; destroys all siege tiles along the line
//
// Normal attacks can never destroy map tiles; this dev action uses
// SIEGE_TEST_ATTACK which has canDestroyMapTiles: true.
//
// Returns everything Battle.jsx needs: mode state, the tile-tap handler, the
// visual-fx array (for SiegeDestructionOverlay), and a reset function.
export function useSiegeTest({ grid, setGrid, busy, flashAttackFeedback }) {
  const [siegeTestMode, setSiegeTestMode] = useState(null); // null | 'single' | 'path'
  const [siegeTestStart, setSiegeTestStart] = useState(null); // {x,y} | null
  const [siegeDestructionFx, setSiegeDestructionFx] = useState([]);

  const triggerSiegeFx = useCallback((tiles) => {
    const fx = tiles.map((t) => ({ id: `sf_${Date.now()}_${t.x}_${t.y}_${Math.random()}`, x: t.x, y: t.y }));
    setSiegeDestructionFx((prev) => [...prev, ...fx]);
    setTimeout(() => {
      setSiegeDestructionFx((prev) => prev.filter((f) => !fx.some((nf) => nf.id === f.id)));
    }, 700);
  }, []);

  const handleSiegeTestTileTap = useCallback((tile) => {
    if (busy) return;
    const t = grid[tile.y] && grid[tile.y][tile.x];
    if (!t) return;

    if (siegeTestMode === 'single') {
      if (isSiegeDestructibleTile(t)) {
        const label = getTileKindLabel(t);
        setGrid(destroyTile(grid, tile.x, tile.y));
        triggerSiegeFx([{ x: tile.x, y: tile.y }]);
        flashAttackFeedback(tile.x, tile.y, `${label} DESTROYED`, 'ability');
      } else if (t.type === TILE_TYPES.BLOCKED) {
        flashAttackFeedback(tile.x, tile.y, 'INDESTRUCTIBLE', 'status');
      } else {
        flashAttackFeedback(tile.x, tile.y, 'OPEN', 'info');
      }
    } else if (siegeTestMode === 'path') {
      if (!siegeTestStart) {
        setSiegeTestStart({ x: tile.x, y: tile.y });
        flashAttackFeedback(tile.x, tile.y, 'PATH START', 'info');
      } else {
        const result = destroyTilesAlongLine(grid, siegeTestStart.x, siegeTestStart.y, tile.x, tile.y, SIEGE_TEST_ATTACK);
        setGrid(result.grid);
        if (result.destroyedTiles.length > 0) {
          triggerSiegeFx(result.destroyedTiles);
          const n = result.destroyedTiles.length;
          flashAttackFeedback(result.destroyedTiles[0].x, result.destroyedTiles[0].y, `SIEGE: ${n} TILE${n !== 1 ? 'S' : ''}`, 'ability');
        }
        if (result.stoppedAt) {
          flashAttackFeedback(result.stoppedAt.x, result.stoppedAt.y, 'BLOCKED', 'status');
        }
        setSiegeTestStart(null);
      }
    }
  }, [siegeTestMode, siegeTestStart, grid, busy, setGrid, flashAttackFeedback, triggerSiegeFx]);

  const resetSiegeTest = useCallback(() => {
    setSiegeTestMode(null);
    setSiegeTestStart(null);
    setSiegeDestructionFx([]);
  }, []);

  return {
    siegeTestMode,
    setSiegeTestMode,
    siegeDestructionFx,
    triggerSiegeFx,
    handleSiegeTestTileTap,
    resetSiegeTest,
  };
}