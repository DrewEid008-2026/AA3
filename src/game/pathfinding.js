import { GRID_WIDTH, GRID_HEIGHT, TILE_TYPES } from './constants';
import { canCrossEdge, getEdgeBetweenTiles } from './terrainEdges';

// 8-directional movement. Diagonal and cardinal both cost 1 tile.
const DIRS = [
  [0, -1], [0, 1], [-1, 0], [1, 0],          // cardinal
  [-1, -1], [1, -1], [-1, 1], [1, 1],         // diagonal
];

const key = (x, y) => `${x},${y}`;

export function isBlockedTile(tile) {
  return !tile || tile.type === TILE_TYPES.BLOCKED;
}

// Clean helper to check if movement can cross between two tiles according to edge state
export function canCrossBetweenTiles(fromTile, toTile, edges = null) {
  if (!edges || !fromTile || !toTile) return true;
  const edge = getEdgeBetweenTiles(fromTile, toTile, edges);
  return canCrossEdge(edge);
}

// A unit of the OPPOSITE team blocks traversal; same-team units are passable
// (path-through). This matches the existing player behaviour and makes enemy
// movement correct (enemies cannot walk through player units).
function oppositeUnitAt(units, x, y, unit) {
  return units.find((u) => u.alive && u.id !== unit.id && u.team !== unit.team && u.x === x && u.y === y);
}
function anyOtherUnitAt(units, x, y, unit) {
  return units.find((u) => u.alive && u.id !== unit.id && u.x === x && u.y === y);
}

export function isPassableForTraversal(grid, units, x, y, unit) {
  if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) return false;
  if (isBlockedTile(grid[y][x])) return false;
  if (oppositeUnitAt(units, x, y, unit)) return false;
  return true;
}

// A valid destination must be passable AND not occupied by any other unit.
export function isDestinationTile(grid, units, x, y, unit) {
  if (!isPassableForTraversal(grid, units, x, y, unit)) return false;
  if (anyOtherUnitAt(units, x, y, unit)) return false;
  return true;
}

// BFS over the 8-neighbourhood with uniform per-step cost.
// Returns a Map: "x,y" -> { x, y, dist, path: [[x,y], ...] } for every reachable
// *destination* tile within `range` steps. The path includes the start tile.
export function computeReachable(grid, units, unit, range, edges = null) {
  const edgeCollection = edges || grid?.edges || null;
  const visited = new Map();
  visited.set(key(unit.x, unit.y), { dist: 0, path: [[unit.x, unit.y]] });
  const queue = [[unit.x, unit.y, 0, [[unit.x, unit.y]]]];

  while (queue.length) {
    const [cx, cy, dist, path] = queue.shift();
    if (dist >= range) continue;

    for (const [dx, dy] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!isPassableForTraversal(grid, units, nx, ny, unit)) continue;

      // Edge crossing check: cardinal moves cross a direct edge
      if (edgeCollection) {
        if (dx === 0 || dy === 0) {
          if (!canCrossBetweenTiles({ x: cx, y: cy }, { x: nx, y: ny }, edgeCollection)) {
            continue;
          }
        } else {
          // Diagonal move: checks both orthogonal crossing edges
          const crossA = canCrossBetweenTiles({ x: cx, y: cy }, { x: cx + dx, y: cy }, edgeCollection)
            && canCrossBetweenTiles({ x: cx + dx, y: cy }, { x: nx, y: ny }, edgeCollection);
          const crossB = canCrossBetweenTiles({ x: cx, y: cy }, { x: cx, y: cy + dy }, edgeCollection)
            && canCrossBetweenTiles({ x: cx, y: cy + dy }, { x: nx, y: ny }, edgeCollection);
          if (!crossA || !crossB) {
            continue;
          }
        }
      }

      // Corner-cutting prevention: a diagonal move is only allowed when both
      // orthogonal neighbours are passable (no squeezing through a blocked corner).
      if (dx !== 0 && dy !== 0) {
        if (
          !isPassableForTraversal(grid, units, cx + dx, cy, unit) ||
          !isPassableForTraversal(grid, units, cx, cy + dy, unit)
        ) {
          continue;
        }
      }

      const nKey = key(nx, ny);
      const newDist = dist + 1;
      if (visited.has(nKey) && visited.get(nKey).dist <= newDist) continue;

      const newPath = [...path, [nx, ny]];
      visited.set(nKey, { dist: newDist, path: newPath });
      queue.push([nx, ny, newDist, newPath]);
    }
  }

  const destinations = new Map();
  for (const [k, v] of visited) {
    if (k === key(unit.x, unit.y)) continue;
    const [lx, ly] = v.path[v.path.length - 1];
    if (!isDestinationTile(grid, units, lx, ly, unit)) continue;
    destinations.set(k, { x: lx, y: ly, dist: v.dist, path: v.path });
  }
  return destinations;
}

// Effective movement range. Centralised so future modifiers (suppression, buffs,
// injury, abilities) can adjust it without touching the movement UI.
// Sprint Harness (utility): +3 normal movement for the current Player Phase
// (unit.sprintHarnessActive). Only affects normal Move — Dash, Relocate, and
// Phase Step use their own fixed ranges and never call this function.
export function getMovementRange(unit) {
  let range = unit.movement;
  if (unit && unit.sprintHarnessActive) range += 3;
  return range;
}

// Phase Step (Stalker) — relaxed-movement pathfinding. The Stalker may pass
// through occupied tiles (allies and enemies) and ignores low cover as a path
// obstruction, but CANNOT pass through structural walls (BLOCKED terrain) and
// cannot end on an occupied or blocked tile. This is a short evasive reposition,
// NOT a full teleport through walls.
//
// Returns the same shape as computeReachable: Map("x,y" -> { x, y, dist, path }).
export function computePhaseStepReachable(grid, units, unit, range) {
  const visited = new Map();
  visited.set(key(unit.x, unit.y), { dist: 0, path: [[unit.x, unit.y]] });
  const queue = [[unit.x, unit.y, 0, [[unit.x, unit.y]]]];

  const isBlocked = (x, y) => {
    if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) return true;
    return isBlockedTile(grid[y][x]);
  };

  while (queue.length) {
    const [cx, cy, dist, path] = queue.shift();
    if (dist >= range) continue;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (isBlocked(nx, ny)) continue; // structural walls block Phase Step
      // Corner-cutting prevention (same rule as normal movement).
      if (dx !== 0 && dy !== 0) {
        if (isBlocked(cx + dx, cy) || isBlocked(cx, cy + dy)) continue;
      }
      const nKey = key(nx, ny);
      const newDist = dist + 1;
      if (visited.has(nKey) && visited.get(nKey).dist <= newDist) continue;
      const newPath = [...path, [nx, ny]];
      visited.set(nKey, { dist: newDist, path: newPath });
      queue.push([nx, ny, newDist, newPath]);
    }
  }

  // Destinations: any reachable non-blocked tile not occupied by another unit.
  const occupied = new Set(
    units.filter((u) => u.alive && u.id !== unit.id).map((u) => `${u.x},${u.y}`)
  );
  const destinations = new Map();
  for (const [k, v] of visited) {
    if (k === key(unit.x, unit.y)) continue;
    if (occupied.has(k)) continue;
    const [lx, ly] = v.path[v.path.length - 1];
    if (isBlockedTile(grid[ly][lx])) continue;
    destinations.set(k, { x: lx, y: ly, dist: v.dist, path: v.path });
  }
  return destinations;
}