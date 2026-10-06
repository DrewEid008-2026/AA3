// COME HERE! — Dislocator's signature forced-movement ability (3.4.3).
//
// Pulls a target soldier tile-by-tile toward the Dislocator, stopping at the
// nearest valid adjacent tile. Validation happens BEFORE any AP/cooldown/
// damage is committed (spec 13). The pull path uses BFS with 8-directional
// movement and corner-cutting prevention — the same rules as normal movement.
//
// Blockers (spec 11): structural walls, impassable terrain, occupied tiles,
// and battlefield boundaries all block the pull path. The target traverses
// every tile in the path (spec 8) — this is forced movement, NOT teleport.

import { GRID_WIDTH, GRID_HEIGHT, TILE_TYPES } from './constants';
import { countVolatileInPath, onUnitEnterTile } from './volatileTiles';
import { gridDistance } from './combat';
import { triggerMine } from './engineer';
import { hasSkill } from './skillEffects';

const DIRS8 = [
  [0, -1], [0, 1], [-1, 0], [1, 0],
  [-1, -1], [1, -1], [-1, 1], [1, 1],
];

const key = (x, y) => `${x},${y}`;

// Check if a unit is immune to forced movement (bosses, relays, immovable units)
export function isImmuneToForcedMovement(unit) {
  if (!unit) return true;
  if (unit.forcedMovementImmune || unit.immovable) return true;
  if (unit.isBoss || unit.isBossObject) return true;
  if (unit.archetype === 'power_relay' || unit.archetype === 'warden_prime' || unit.archetype === 'harvester') return true;
  return false;
}

// Is this tile passable for the pull path? The target's own tile is passable
// (they're leaving it). Other living units block the path (spec 11).
function isPullPassable(grid, units, x, y, targetId) {
  const height = grid?.length ?? GRID_HEIGHT;
  const width = grid?.[0]?.length ?? GRID_WIDTH;
  if (x < 0 || x >= width || y < 0 || y >= height) return false;
  const tile = grid[y]?.[x];
  if (!tile || tile.type === TILE_TYPES.BLOCKED) return false;
  const occ = units.find((u) => u.alive && u.id !== targetId && u.x === x && u.y === y);
  if (occ) return false;
  return true;
}

// Find valid adjacent tiles to the Dislocator (open, unoccupied, in bounds).
// These are potential pull destinations (spec 12).
function getValidAdjacentTiles(grid, units, dislocator) {
  const tiles = [];
  const height = grid?.length ?? GRID_HEIGHT;
  const width = grid?.[0]?.length ?? GRID_WIDTH;
  for (const [dx, dy] of DIRS8) {
    const nx = dislocator.x + dx;
    const ny = dislocator.y + dy;
    if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
    const tile = grid[ny]?.[nx];
    if (!tile || tile.type === TILE_TYPES.BLOCKED) continue;
    const occ = units.find((u) => u.alive && u.x === nx && u.y === ny);
    if (occ) continue;
    tiles.push({ x: nx, y: ny });
  }
  return tiles;
}

// BFS from target to a destination tile. Returns the shortest path
// (array of [x,y] including start and end) or null if unreachable.
// Uses 8-directional movement with corner-cutting prevention (spec 8, 10).
function findPullPath(grid, units, target, dest, targetId) {
  if (target.x === dest.x && target.y === dest.y) return [[target.x, target.y]];
  const visited = new Set();
  visited.add(key(target.x, target.y));
  const queue = [[target.x, target.y, [[target.x, target.y]]]];
  while (queue.length) {
    const [cx, cy, path] = queue.shift();
    for (const [dx, dy] of DIRS8) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!isPullPassable(grid, units, nx, ny, targetId)) continue;
      // Corner-cutting prevention (same rule as normal movement).
      if (dx !== 0 && dy !== 0) {
        if (!isPullPassable(grid, units, cx + dx, cy, targetId) ||
            !isPullPassable(grid, units, cx, cy + dy, targetId)) continue;
      }
      const nKey = key(nx, ny);
      if (visited.has(nKey)) continue;
      const newPath = [...path, [nx, ny]];
      if (nx === dest.x && ny === dest.y) return newPath;
      visited.add(nKey);
      queue.push([nx, ny, newPath]);
    }
  }
  return null;
}

// Compute the COME HERE! pull: find the nearest valid adjacent tile to the
// Dislocator and the shortest path from the target to that tile (spec 7, 10,
// 12). Returns { valid: true, path, destination, tilesMoved } or
// { valid: false, reason }. Validation happens BEFORE any AP/cooldown/damage
// is spent (spec 13).
export function computeComeHerePull(grid, units, dislocator, target) {
  if (!dislocator || !target || !target.alive || target.downed) {
    return { valid: false, reason: 'invalid target' };
  }
  if (isImmuneToForcedMovement(target)) {
    return { valid: false, reason: 'IMMUNE TO FORCED MOVEMENT' };
  }
  const adjacents = getValidAdjacentTiles(grid, units, dislocator);
  if (adjacents.length === 0) {
    return { valid: false, reason: 'no valid adjacent tile' };
  }
  // Find the nearest valid adjacent tile by pull-path distance.
  // When multiple valid destinations have the same shortest distance, prefer
  // the path that pulls the target through more Volatile Tiles (spec 27).
  let best = null;
  for (const adj of adjacents) {
    const path = findPullPath(grid, units, target, adj, target.id);
    if (!path) continue;
    const dist = path.length - 1; // tiles to traverse
    const hazardCount = countVolatileInPath(path, grid);
    if (!best || dist < best.dist || (dist === best.dist && hazardCount > (best.hazardCount || 0))) {
      best = { destination: adj, path, dist, hazardCount };
    }
  }
  if (!best) {
    return { valid: false, reason: 'no valid pull path' };
  }
  return {
    valid: true,
    path: best.path,
    destination: best.destination,
    tilesMoved: best.dist,
    hazardTilesCrossed: countVolatileInPath(best.path, grid),
  };
}

// Unified shared forced-pull resolution helper
export function resolveForcedPull({ grid, units, source, target, range = 5 }) {
  if (!source || !target || !target.alive || target.downed) {
    return { valid: false, reason: 'invalid target' };
  }
  if (gridDistance(source, target) > range) {
    return { valid: false, reason: 'out of range' };
  }
  return computeComeHerePull(grid, units, source, target);
}

// Process a single tile entry during forced movement (COME HERE! or Disruptor Hook).
// Triggers environmental tile-entry hazards (Volatile Ground) and Mines.
// Reaction fire (Overwatch, Pin Down) is explicitly NOT triggered.
// Returns { unit, stopped, killed, downed, hasHazard, hazardDamage, hazardDowned, mineTriggered, mineDamage }
export function processForcedMovementTileEntry({
  grid,
  unit,
  x,
  y,
  mines = [],
  units = [],
}) {
  let currentUnit = unit;
  let killed = false;
  let downed = false;
  let stopped = false;
  let hazardDamage = 0;
  let mineTriggered = null;
  let mineDamage = 0;

  // 1. Authoritative tile-entry hazard check (Volatile Ground)
  const entry = onUnitEnterTile(grid, currentUnit, x, y);
  if (entry.hasEffect) {
    currentUnit = entry.unit;
    hazardDamage = entry.damage;
    if (entry.stopped) {
      killed = entry.killed;
      downed = entry.downed;
      stopped = true;
      return {
        unit: currentUnit,
        stopped: true,
        killed,
        downed,
        hasHazard: true,
        hazardDamage,
        hazardDowned: entry.downed,
        mineTriggered: null,
        mineDamage: 0,
      };
    }
  }

  // 2. Mines check (if not stopped by hazard)
  const mine = (mines || []).find((m) => m.x === x && m.y === y);
  if (mine) {
    const owner = units.find((u) => u.id === mine.ownerId);
    const sameTeam = owner && owner.team === currentUnit.team;
    const ownerHasFriendlyMines = owner && hasSkill(owner, 'friendly_mines');
    if (!(sameTeam && ownerHasFriendlyMines)) {
      const r = triggerMine(currentUnit, mine);
      currentUnit = r.unit;
      mineTriggered = mine;
      mineDamage = r.damage;
      if (r.killed || currentUnit.downed) {
        killed = r.killed;
        downed = !!currentUnit.downed;
        stopped = true;
      }
    }
  }

  return {
    unit: currentUnit,
    stopped,
    killed,
    downed,
    hasHazard: entry.hasEffect,
    hazardDamage,
    hazardDowned: entry.downed,
    mineTriggered,
    mineDamage,
  };
}