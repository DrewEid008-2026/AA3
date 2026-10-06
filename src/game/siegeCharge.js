// SIEGE CHARGE — The Harvester's signature Phase 2 ability.
//
// When cast during the Enemy Phase, the Harvester locks a straight orthogonal
// charge line (max 5 tiles). The player gets one full Player Phase to vacate.
// At the beginning of the following Enemy Phase, the charge resolves:
//   - Destroy every Siege-destructible map tile in the path (binary obliteration).
//   - Destroy all normal destructible Cover in the path (catastrophic damage).
//   - Down every standing player soldier in the path (ignores Armor/Shield/HP).
//   - Pass over Downed soldiers without effect.
//   - Trigger Shock Mines (damage applies, Stun does NOT cancel the charge).
//   - Move the Harvester to the final valid destination.
//   - Overwatch fires as the Harvester travels (real movement).
//
// The charge STOPS before indestructible tiles (arena boundary, permanent
// structures). It cannot pass through protected geometry.
//
// Only ONE major pending Harvester attack may exist at a time (Tremor, Beam,
// OR Siege Charge).

import { GRID_WIDTH, GRID_HEIGHT, TILE_TYPES, TILE_DESTRUCTION_CLASSES, TEAMS } from './constants';
import { isSiegeDestructibleTile, destroyTile } from './tileDestruction';
import { damageCoverTile } from './cover';
import { enterDowned } from './downed';

export const SIEGE_CHARGE = {
  apCost: 1,
  cooldown: 3,
  maxRange: 5,
};

// The "attack" profile for Siege Charge — authorized to destroy Siege tiles.
export const SIEGE_CHARGE_ATTACK = {
  canDestroyMapTiles: true,
  tileDestructionClass: TILE_DESTRUCTION_CLASSES.SIEGE,
};

const DIRS = {
  north: { dx: 0, dy: -1 },
  south: { dx: 0, dy: 1 },
  east: { dx: 1, dy: 0 },
  west: { dx: -1, dy: 0 },
};

export const CHARGE_DIRS = Object.keys(DIRS);

let chargeIdCounter = 0;

// Is this tile an indestructible blocker that the charge cannot pass through?
function isIndestructibleBlocker(tile) {
  if (!tile) return true;
  if (tile.type !== TILE_TYPES.BLOCKED) return false;
  return !isSiegeDestructibleTile(tile);
}

// Compute the charge path from (sx, sy) in direction `dir`, up to maxRange tiles.
// Stops before indestructible tiles and arena boundaries.
// Returns { path: [{x,y}], destination: {x,y}, stoppedAtIndestructible: bool }.
export function computeChargePath(grid, sx, sy, dir, maxRange = SIEGE_CHARGE.maxRange) {
  const d = DIRS[dir];
  if (!d) return { path: [], destination: { x: sx, y: sy }, stoppedAtIndestructible: false };

  const path = [];
  let x = sx, y = sy;
  let stoppedAtIndestructible = false;

  for (let i = 0; i < maxRange; i++) {
    const nx = x + d.dx;
    const ny = y + d.dy;
    if (nx < 0 || nx >= GRID_WIDTH || ny < 0 || ny >= GRID_HEIGHT) break;

    const tile = grid[ny][nx];
    if (isIndestructibleBlocker(tile)) {
      stoppedAtIndestructible = true;
      break;
    }
    path.push({ x: nx, y: ny });
    x = nx;
    y = ny;
  }

  const destination = path.length > 0 ? path[path.length - 1] : { x: sx, y: sy };
  return { path, destination, stoppedAtIndestructible };
}

// Create a pending Siege Charge. The path is pre-computed and stored so the
// player reacts to the exact telegraphed line (Part 48).
export function createSiegeCharge(sourceX, sourceY, dir, path, destination, sourceId, castRound) {
  return {
    id: `siege_${chargeIdCounter++}`,
    sourceId,
    sourceX,
    sourceY,
    dir,
    pathTiles: path,
    destinationX: destination.x,
    destinationY: destination.y,
    castRound,
    detonationEnemyPhase: castRound + 1,
    resolved: false,
  };
}

// All tiles in the charge path (excluding the Harvester's start tile).
export function getChargePathTiles(charge) {
  if (!charge || !charge.pathTiles) return [];
  return charge.pathTiles;
}

// Set of "x,y" keys for fast lookup (overlay rendering, tile checks).
export function getChargePathKeys(charge) {
  if (!charge || !charge.pathTiles) return new Set();
  return new Set(charge.pathTiles.map((t) => `${t.x},${t.y}`));
}

// Standing player soldiers in the charge path (collision targets). Downed
// soldiers are excluded — the charge passes over them (Part 27).
export function getChargeCollisionTargets(charge, units) {
  const keys = getChargePathKeys(charge);
  const hits = [];
  for (const u of units) {
    if (!u || !u.alive || u.team !== TEAMS.PLAYER) continue;
    if (u.downed) continue;
    if (keys.has(`${u.x},${u.y}`)) {
      hits.push({ unitId: u.id, x: u.x, y: u.y, name: u.name });
    }
  }
  return hits;
}

// Destroy all Siege-destructible map tiles + normal cover along the charge
// path. Returns { grid, destroyedTileCount, destroyedCoverCount }.
// This is the "bulldoze" — structures are obliterated, not chipped.
export function destroyChargePathTerrain(grid, charge) {
  if (!charge || !charge.pathTiles) return { grid, destroyedTileCount: 0, destroyedCoverCount: 0 };
  let g = grid;
  let destroyedTileCount = 0;
  let destroyedCoverCount = 0;

  for (const t of charge.pathTiles) {
    const tile = g[t.y] && g[t.y][t.x];
    if (!tile) continue;

    // Destroy Siege-destructible map tiles (binary obliteration).
    if (isSiegeDestructibleTile(tile)) {
      g = destroyTile(g, t.x, t.y);
      destroyedTileCount++;
    }

    // Destroy all normal cover on this tile (catastrophic damage).
    if (tile.cover) {
      const before = g;
      g = damageCoverTile(g, t.x, t.y, 100);
      if (g !== before) {
        const afterTile = g[t.y][t.x];
        for (const d of ['n', 's', 'e', 'w']) {
          const ac = afterTile.cover[d];
          if (ac && ac.destroyed) {
            const beforeSide = before[t.y][t.x].cover[d];
            if (beforeSide && !beforeSide.destroyed) destroyedCoverCount++;
          }
        }
      }
    }
  }

  return { grid: g, destroyedTileCount, destroyedCoverCount };
}

// Down every standing player soldier on a charge path tile. Returns a new
// units array + list of downed soldier info. Ignores Armor, Shield, Cover, HP
// — catastrophic collision (Part 22-24). Downed soldiers are passed over.
export function applyChargeCollisions(units, charge) {
  const keys = getChargePathKeys(charge);
  const downed = [];
  let newUnits = units;
  for (const u of units) {
    if (!u || !u.alive || u.team !== TEAMS.PLAYER || u.downed) continue;
    if (keys.has(`${u.x},${u.y}`)) {
      newUnits = newUnits.map((x) => (x.id === u.id ? enterDowned(x) : x));
      downed.push({ unitId: u.id, x: u.x, y: u.y, name: u.name });
    }
  }
  return { units: newUnits, downed };
}

// Is a pending Siege Charge still valid? The Harvester must be alive and the
// path must still be passable (tiles may have been destroyed by the player
// during their phase, which only helps — destroyed tiles are open).
export function isChargeValid(charge, units) {
  if (!charge) return false;
  const harvester = units.find((u) => u.id === charge.sourceId);
  return !!(harvester && harvester.alive);
}