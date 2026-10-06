// Smoke Grenade battlefield effect. Smoke is stored as a transient `smoke: true`
// flag on grid tiles (immutable updates, same pattern as cover.js). This keeps
// the grid as the single source of truth — getCoverState reads tile.smoke
// directly with no extra plumbing, and restart reuses the pristine cached grid
// (smoke was applied to a derived grid, never the cached original).
//
// Smoke provides a COVERED state against eligible direct attacks when the
// occupant would otherwise be Exposed or Flanked (lack of physical protection).
// It does not block movement, LOS, or targeting, and cover-ignoring attacks
// bypass it entirely (they never call getCoverState).
import { TILE_TYPES } from './constants';

// Mark all tiles within `radius` (Chebyshev) of (cx, cy) as smoke. Returns a new
// grid; blocked tiles and tiles already smoking are skipped.
export function addSmoke(grid, cx, cy, radius) {
  const newGrid = grid.map((r) => r.slice());
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (y < 0 || y >= newGrid.length) continue;
      if (x < 0 || x >= newGrid[y].length) continue;
      const tile = newGrid[y][x];
      if (!tile || tile.type === TILE_TYPES.BLOCKED || tile.smoke) continue;
      newGrid[y][x] = { ...tile, smoke: true };
    }
  }
  return newGrid;
}

// Remove smoke from all tiles. Returns a new grid, or the original if no tiles
// had smoke (avoids needless re-renders).
export function clearSmoke(grid) {
  let changed = false;
  const newGrid = grid.map((row) => {
    let rowChanged = false;
    const newRow = row.map((tile) => {
      if (tile && tile.smoke) {
        rowChanged = true;
        const { smoke, ...rest } = tile;
        return rest;
      }
      return tile;
    });
    if (rowChanged) changed = true;
    return newRow;
  });
  return changed ? newGrid : grid;
}

export function isSmokeTile(grid, x, y) {
  const tile = grid[y] && grid[y][x];
  return !!(tile && tile.smoke);
}