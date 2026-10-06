// Bastion Mech BULLDOZE logic. A straight-line charge that destroys light
// (non-wall) directional cover along its path and rams an adjacent soldier
// for flat damage + Stun. Reuses the directional-cover architecture: bulldozed
// cover sides are marked destroyed (same as grenade/attack damage), so
// getCoverState excludes them automatically. Walls are structural and cannot
// be bulldozed — the Bastion stops at a wall.
import { COVER_TYPES } from './constants';

const SIDES = ['n', 's', 'e', 'w'];

// Destroy all non-wall (light) cover sides on a tile. Walls are structural and
// survive. Returns a new grid (shallow-copied rows/tile).
export function destroyLightCoverTile(grid, x, y) {
  const row = grid[y];
  const tile = row && row[x];
  if (!tile || !tile.cover) return grid;
  const hasLight = SIDES.some((d) => {
    const c = tile.cover[d];
    return c && !c.destroyed && c.type !== COVER_TYPES.WALL;
  });
  if (!hasLight) return grid;
  const newCover = { ...tile.cover };
  let changed = false;
  for (const d of SIDES) {
    const c = newCover[d];
    if (c && !c.destroyed && c.type !== COVER_TYPES.WALL) {
      newCover[d] = { ...c, hp: 0, destroyed: true };
      changed = true;
    }
  }
  if (!changed) return grid;
  const newGrid = grid.map((r) => r.slice());
  newGrid[y] = row.slice();
  newGrid[y][x] = { ...tile, cover: newCover };
  return newGrid;
}

// Count light (non-wall) cover sides on a tile — used by the AI to score how
// much a bulldoze path would destroy.
export function countLightCoverOnTile(grid, x, y) {
  const tile = grid[y] && grid[y][x];
  if (!tile || !tile.cover) return 0;
  let n = 0;
  for (const d of SIDES) {
    const c = tile.cover[d];
    if (c && !c.destroyed && c.type !== COVER_TYPES.WALL) n++;
  }
  return n;
}