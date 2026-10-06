// Destructible cover logic. Cover objects carry HP and a destroyed flag (set up
// in maps.js). This module damages cover from attacks and grenade blasts and
// keeps the grid immutable so React state updates correctly.
import { relevantCoverSides, protectingCoverLocation } from './combat';

const SIDES = ['n', 's', 'e', 'w'];

// Damage one cover side on a tile. Returns a new grid (shallow-copied rows/tiles).
export function damageCoverSide(grid, x, y, side, amount = 1) {
  const row = grid[y];
  const tile = row && row[x];
  if (!tile || !tile.cover || !tile.cover[side] || tile.cover[side].destroyed) return grid;
  const hp = tile.cover[side].hp - amount;
  const newGrid = grid.map((r) => r.slice());
  newGrid[y] = row.slice();
  newGrid[y][x] = {
    ...tile,
    cover: {
      ...tile.cover,
      [side]: { ...tile.cover[side], hp, destroyed: hp <= 0 },
    },
  };
  return newGrid;
}

// Damage all active cover sides on a tile (grenade blast). Returns a new grid.
export function damageCoverTile(grid, x, y, amount = 2) {
  const row = grid[y];
  const tile = row && row[x];
  if (!tile || !tile.cover) return grid;
  const hasActive = SIDES.some((d) => tile.cover[d] && !tile.cover[d].destroyed);
  if (!hasActive) return grid;
  const newCover = { ...tile.cover };
  let changed = false;
  for (const d of SIDES) {
    const c = newCover[d];
    if (c && !c.destroyed) {
      const hp = c.hp - amount;
      newCover[d] = { ...c, hp, destroyed: hp <= 0 };
      changed = true;
    }
  }
  if (!changed) return grid;
  const newGrid = grid.map((r) => r.slice());
  newGrid[y] = row.slice();
  newGrid[y][x] = { ...tile, cover: newCover };
  return newGrid;
}

// Damage the cover side(s) protecting the target from this attack. The
// protecting cover may live on the target's own tile OR the neighbor tile on the
// other side of the shared edge (bidirectional cover). Returns a new grid.
export function damageProtectingCover(grid, attacker, target, amount = 1) {
  const sides = relevantCoverSides(attacker, target);
  if (sides.length === 0) return grid;
  let g = grid;
  for (const side of sides) {
    const loc = protectingCoverLocation(g, target.x, target.y, side);
    if (loc) g = damageCoverSide(g, loc.x, loc.y, loc.side, amount);
  }
  return g;
}

// Remove a specific cover side from a tile (used when a barricade is destroyed
// and needs to be fully cleared rather than just marked destroyed). Returns a
// new grid. Currently not needed — destroyed cover sides are already excluded
// by getCoverState — but available for future cleanup.
export function removeCoverSide(grid, x, y, dir) {
  const row = grid[y];
  const tile = row && row[x];
  if (!tile || !tile.cover || !tile.cover[dir]) return grid;
  const newGrid = grid.map((r) => r.slice());
  newGrid[y] = row.slice();
  newGrid[y][x] = {
    ...tile,
    cover: { ...tile.cover, [dir]: null },
  };
  return newGrid;
}

// Count cover sides that transitioned from intact to destroyed between two
// grids. Used to surface a "Cover Destroyed" bubble after an attack/blast.
export function countNewlyDestroyedCover(before, after) {
  let count = 0;
  for (let y = 0; y < before.length; y++) {
    const rb = before[y] || [];
    const ra = after[y] || [];
    for (let x = 0; x < rb.length; x++) {
      const cb = rb[x]?.cover || {};
      const ca = ra[x]?.cover || {};
      for (const d of SIDES) {
        if (cb[d] && !cb[d].destroyed && ca[d] && ca[d].destroyed) count++;
      }
    }
  }
  return count;
}