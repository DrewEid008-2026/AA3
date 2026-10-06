// Destructible Map Tile framework.
//
// This is DISTINCT from the existing destructible Cover system (cover.js).
// Cover objects are directional edge barriers with HP (barricades, walls).
// Destructible Map Tiles are actual grid tiles (BLOCKED terrain) that can be
// obliterated by specially-authorized attacks and replaced with open ground.
//
// Normal attacks — Rifle, Shotgun, LMG, Sniper, Beam, Grenade, Launch Rocket —
// do NOT destroy map tiles, regardless of damage or terrain damage. Only
// attacks/abilities with explicit `canDestroyMapTiles` or a matching
// `tileDestructionClass` may destroy them. This permission is never inferred
// from damage, explosive tags, terrain damage, or Armor Shred.
//
// Destruction is BINARY: intact blocking tile → destroyed open tile. No HP,
// no chipping, no multi-stage cracking (future support is architecturally
// possible but intentionally not implemented this phase).
//
// Because pathfinding, LOS, cover, AI, and all previews read the grid's
// `tile.type`, changing a tile from BLOCKED to OPEN immediately opens
// movement, LOS, and firing lines with no extra refresh logic needed.
import { TILE_TYPES, TILE_DESTRUCTION_CLASSES } from './constants';

// Re-export for convenience.
export { TILE_DESTRUCTION_CLASSES };

// Display labels for tile kinds (inspection + log feedback).
export const TILE_KIND_LABELS = {
  heavy_wall: 'Heavy Wall',
  rock_outcrop: 'Rock Outcrop',
  thick_wreckage: 'Thick Wreckage',
  alien_structural_block: 'Alien Structural Block',
  industrial_blocker: 'Industrial Blocker',
};

export function getTileKindLabel(tile) {
  if (!tile || !tile.tileKind) return 'Structure';
  return TILE_KIND_LABELS[tile.tileKind] || tile.tileKind;
}

// Is this tile a Siege-destructible map tile that is still intact?
export function isSiegeDestructibleTile(tile) {
  if (!tile) return false;
  return tile.isDestructibleTile === true
    && tile.tileDestructionClass === TILE_DESTRUCTION_CLASSES.SIEGE
    && tile.currentTileState === 'intact';
}

// Was this tile a blocking structure that has been destroyed (now open)?
export function isDestroyedTile(tile) {
  if (!tile) return false;
  return tile.isDestructibleTile === true && tile.currentTileState === 'destroyed';
}

// Can the given attack/ability destroy this tile?
// `attack` may be a weapon, ability, or dev test object with:
//   canDestroyMapTiles: true           — destroys any destructible tile
//   tileDestructionClass: 'siege'      — destroys tiles of that class
export function canAttackDestroyTile(attack, tile) {
  if (!tile || !tile.isDestructibleTile || tile.currentTileState !== 'intact') return false;
  if (!attack) return false;
  if (attack.canDestroyMapTiles) return true;
  if (attack.tileDestructionClass && attack.tileDestructionClass === tile.tileDestructionClass) return true;
  return false;
}

// Destroy a single intact destructible tile — returns a NEW grid (immutable).
// The tile becomes its configured replacement (default OPEN), cover is cleared,
// and currentTileState is set to 'destroyed'. No HP, no chipping — binary.
export function destroyTile(grid, x, y) {
  const tile = grid[y] && grid[y][x];
  if (!tile || !tile.isDestructibleTile || tile.currentTileState !== 'intact') return grid;
  const newGrid = grid.map((r) => r.slice());
  newGrid[y] = grid[y].slice();
  newGrid[y][x] = {
    ...tile,
    type: tile.destroyedReplacementTileType || TILE_TYPES.OPEN,
    currentTileState: 'destroyed',
    // A destroyed structure no longer provides directional cover.
    cover: { n: null, s: null, e: null, w: null },
  };
  return newGrid;
}

// Bresenham line (inclusive of both endpoints) — reused for path-based siege.
function lineTiles(x0, y0, x1, y1) {
  const tiles = [];
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0, y = y0;
  let guard = 0;
  while (guard++ < 1000) {
    tiles.push([x, y]);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
  return tiles;
}

// Destroy all eligible siege tiles along a path (array of [x, y]).
// Processes tiles in path order:
//   1. open tile → continue
//   2. Siege-destructible + attack has permission → destroy, continue
//   3. indestructible blocker → stop (attack cannot pass)
// Returns { grid, destroyedTiles, stoppedAt }.
export function destroyTilesAlongPath(grid, path, attack) {
  let g = grid;
  const destroyed = [];
  let stoppedAt = null;
  for (const [x, y] of path) {
    const tile = g[y] && g[y][x];
    if (!tile) continue;
    if (tile.type === TILE_TYPES.OPEN) continue; // pass through open ground
    if (canAttackDestroyTile(attack, tile)) {
      g = destroyTile(g, x, y);
      destroyed.push({ x, y, kind: tile.tileKind });
    } else {
      // Indestructible blocker — the attack stops here.
      stoppedAt = { x, y };
      break;
    }
  }
  return { grid: g, destroyedTiles: destroyed, stoppedAt };
}

// Convenience: destroy all siege tiles along a straight line from (x0,y0) to (x1,y1).
export function destroyTilesAlongLine(grid, x0, y0, x1, y1, attack) {
  return destroyTilesAlongPath(grid, lineTiles(x0, y0, x1, y1), attack);
}

// The dev-only Siege Test "attack" — authorized to destroy any siege tile.
// Used by the Siege Test dev action to validate the tile system.
export const SIEGE_TEST_ATTACK = {
  canDestroyMapTiles: true,
  tileDestructionClass: TILE_DESTRUCTION_CLASSES.SIEGE,
};