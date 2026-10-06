// Terrain-manipulation utility resolvers: Wall Charge and Insta-Wall Cement.
//
// Both are equipment-granted abilities (1 AP, 1 use/mission) that reshape the
// battlefield grid. Wall Charge destroys an adjacent Siege-destructible wall
// tile (→ open ground); Insta-Wall Cement creates a player-made wall tile on
// an empty ground tile within range 3. Both use the authoritative tile
// conversion system from tileDestruction.js, so pathfinding, LOS, cover,
// Tactical Lens, and enemy AI all update immediately — they read grid
// tile.type, never a cached copy.
//
// Tile changes are mission-local React state. Restart reuses the cached
// original map config grid (resetBattle sets grid = cfg.grid), so destroyed
// walls return and player-created walls disappear on restart. There is no
// mid-mission persistence to duplicate.

import {
  GRID_WIDTH,
  GRID_HEIGHT,
  TILE_TYPES,
  TILE_DESTRUCTION_CLASSES,
  COVER_TYPES,
  COVER_HP,
  MISSION_TYPES,
  TEAMS,
} from './constants';
import { isSiegeDestructibleTile, destroyTile } from './tileDestruction';
import { getUnitAbility } from './abilities';
import { getAbilityApCost } from './skillEffects';

const DIRS8 = [
  [0, -1], [0, 1], [-1, 0], [1, 0],
  [-1, -1], [1, -1], [-1, 1], [1, 1],
];
const DIRS4 = [[0, -1], [0, 1], [-1, 0], [1, 0]];

// ===================== Targeting =====================

// Wall Charge: 4-cardinal adjacent Siege-destructible intact wall tiles.
export function getWallChargeTiles(grid, unit) {
  const tiles = [];
  for (const [dx, dy] of DIRS4) {
    const nx = unit.x + dx;
    const ny = unit.y + dy;
    if (nx < 0 || nx >= GRID_WIDTH || ny < 0 || ny >= GRID_HEIGHT) continue;
    const tile = grid[ny][nx];
    if (isSiegeDestructibleTile(tile)) tiles.push({ x: nx, y: ny });
  }
  return tiles;
}

// Insta-Wall Cement: empty valid ground tiles within Chebyshev range 3.
// Excludes occupied, objective, extraction, reinforcement-spawn, and
// connectivity-breaking tiles. `missionContext` = { missionConfig, civilian,
// device, extractionZone, reinforcementSpawns }.
export function getInstaWallTiles(grid, units, unit, missionContext = {}) {
  const tiles = [];
  const range = 3;
  const { missionConfig, civilian, device, extractionZone, reinforcementSpawns } = missionContext;
  for (let dy = -range; dy <= range; dy++) {
    for (let dx = -range; dx <= range; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = unit.x + dx;
      const ny = unit.y + dy;
      if (nx < 0 || nx >= GRID_WIDTH || ny < 0 || ny >= GRID_HEIGHT) continue;
      if (Math.max(Math.abs(dx), Math.abs(dy)) > range) continue;
      const tile = grid[ny][nx];
      if (!tile || tile.type !== TILE_TYPES.OPEN) continue;
      // Not occupied by any unit.
      if (units.some((u) => u.alive && u.x === nx && u.y === ny)) continue;
      // Not on the objective device.
      if (device && device.x === nx && device.y === ny) continue;
      // Not on an unrescued civilian.
      if (civilian && !civilian.rescued && civilian.x === nx && civilian.y === ny) continue;
      // Not in the extraction zone.
      if (extractionZone && extractionZone.some((t) => t.x === nx && t.y === ny)) continue;
      // Not on a reinforcement spawn tile.
      if (reinforcementSpawns && reinforcementSpawns.some((t) => t.x === nx && t.y === ny)) continue;
      // Connectivity safety: reject if placement would block the mission.
      if (wouldBlockMission(grid, units, nx, ny, missionConfig, civilian, device, extractionZone)) continue;
      tiles.push({ x: nx, y: ny });
    }
  }
  return tiles;
}

// ===================== Connectivity safety =====================

function isOpenTile(grid, x, y) {
  if (y < 0 || y >= GRID_HEIGHT || x < 0 || x >= GRID_WIDTH) return false;
  return grid[y][x].type === TILE_TYPES.OPEN;
}

// BFS over open tiles (8-dir, no corner cutting), ignoring units. Returns true
// if any start can reach any target. Units are treated as passable because
// they move — only permanent terrain (tile.type) gates connectivity.
function canReachAny(grid, starts, targets) {
  if (!starts.length || !targets.length) return false;
  const targetSet = new Set(targets.map((t) => `${t.x},${t.y}`));
  const seen = new Set();
  const queue = [];
  for (const s of starts) {
    if (!isOpenTile(grid, s.x, s.y)) continue;
    const k = `${s.x},${s.y}`;
    if (!seen.has(k)) { seen.add(k); queue.push(s); }
  }
  while (queue.length) {
    const { x, y } = queue.shift();
    if (targetSet.has(`${x},${y}`)) return true;
    for (const [dx, dy] of DIRS8) {
      const nx = x + dx, ny = y + dy;
      if (!isOpenTile(grid, nx, ny)) continue;
      if (dx !== 0 && dy !== 0) {
        if (!isOpenTile(grid, x + dx, y) || !isOpenTile(grid, x, y + dy)) continue;
      }
      const k = `${nx},${ny}`;
      if (seen.has(k)) continue;
      seen.add(k);
      queue.push({ x: nx, y: ny });
    }
  }
  return false;
}

// Simulate placing a wall at (x, y) and check whether the mission's mandatory
// destinations remain reachable by at least one living player unit. Returns
// true if the placement would break the mission (the caller rejects it).
// Only blocks truly mission-breaking placements — closing one of several
// routes is allowed.
export function wouldBlockMission(grid, units, x, y, missionConfig, civilian, device, extractionZone) {
  if (!missionConfig) return false;
  const simGrid = grid.map((row) => row.slice());
  simGrid[y] = grid[y].slice();
  simGrid[y][x] = { ...grid[y][x], type: TILE_TYPES.BLOCKED };

  const playerStarts = units
    .filter((u) => u.team === TEAMS.PLAYER && u.alive)
    .map((u) => ({ x: u.x, y: u.y }));
  if (playerStarts.length === 0) return false;

  const type = missionConfig.type;
  if (type === MISSION_TYPES.ELIMINATION) {
    const enemyTargets = units
      .filter((u) => u.team === TEAMS.ENEMY && u.alive)
      .map((u) => ({ x: u.x, y: u.y }));
    if (enemyTargets.length === 0) return false;
    return !canReachAny(simGrid, playerStarts, enemyTargets);
  }
  if (type === MISSION_TYPES.EXTRACTION) {
    if (!extractionZone || extractionZone.length === 0) return false;
    return !canReachAny(simGrid, playerStarts, extractionZone);
  }
  if (type === MISSION_TYPES.RESCUE) {
    if (!civilian) return false;
    const civTile = [{ x: civilian.x, y: civilian.y }];
    if (!canReachAny(simGrid, playerStarts, civTile)) return true;
    if (extractionZone && extractionZone.length > 0 && !canReachAny(simGrid, civTile, extractionZone)) return true;
    return false;
  }
  if (type === MISSION_TYPES.SABOTAGE) {
    if (!device) return false;
    return !canReachAny(simGrid, playerStarts, [{ x: device.x, y: device.y }]);
  }
  if (type === MISSION_TYPES.BOSS) {
    const bossTargets = units
      .filter((u) => u.team === TEAMS.ENEMY && u.alive && (u.isBoss || u.isBossObject))
      .map((u) => ({ x: u.x, y: u.y }));
    if (bossTargets.length === 0) return false;
    return !canReachAny(simGrid, playerStarts, bossTargets);
  }
  return false;
}

// ===================== Tile conversion =====================

// Convert an open ground tile into a player-created wall. The wall is a
// BLOCKED tile that blocks movement + LOS, is Siege-destructible (so Wall
// Charge / Harvester Siege Charge can destroy it later), and carries
// directional wall cover on all four edges so adjacent units benefit from the
// bidirectional cover system. Returns a NEW tile object (immutable).
export function createPlayerWallTile(tile) {
  const wallCover = {
    type: COVER_TYPES.WALL,
    hp: COVER_HP[COVER_TYPES.WALL] ?? 6,
    maxHp: COVER_HP[COVER_TYPES.WALL] ?? 6,
    destroyed: false,
  };
  return {
    ...tile,
    type: TILE_TYPES.BLOCKED,
    isDestructibleTile: true,
    tileDestructionClass: TILE_DESTRUCTION_CLASSES.SIEGE,
    currentTileState: 'intact',
    tileKind: 'player_wall',
    playerCreated: true,
    destroyedReplacementTileType: TILE_TYPES.OPEN,
    cover: {
      n: { ...wallCover },
      s: { ...wallCover },
      e: { ...wallCover },
      w: { ...wallCover },
    },
  };
}

// Apply a player wall to the grid at (x, y). Returns a NEW grid (immutable).
export function placePlayerWall(grid, x, y) {
  const tile = grid[y] && grid[y][x];
  if (!tile || tile.type !== TILE_TYPES.OPEN) return grid;
  const newGrid = grid.map((r) => r.slice());
  newGrid[y] = grid[y].slice();
  newGrid[y][x] = createPlayerWallTile(tile);
  return newGrid;
}

// ===================== Resolvers =====================

// WALL CHARGE: 1 AP. Destroy the targeted adjacent Siege-destructible wall
// tile → open ground. Pathfinding, LOS, cover, and AI update immediately
// (they read grid tile.type). 1 use per mission.
export function resolveWallCharge(ctx) {
  const {
    grid, setGrid, caster, x, y, withBurning, setUnits, setResolving,
    setAbilityTargeting, flashAttackFeedback, wallChargeTiles, triggerSiegeFx,
  } = ctx;
  if (!wallChargeTiles || !wallChargeTiles.has(`${x},${y}`)) {
    flashAttackFeedback(x, y, 'INVALID');
    return;
  }
  const ability = getUnitAbility(caster, 'wall_charge');
  const apCost = getAbilityApCost(caster, ability);
  setAbilityTargeting(null);
  setResolving(true);
  const newGrid = destroyTile(grid, x, y);
  setGrid(newGrid);
  if (triggerSiegeFx) triggerSiegeFx([{ x, y }]);
  const atkFinal = withBurning(
    {
      ...caster,
      ap: Math.max(0, caster.ap - apCost),
      abilityUses: { ...caster.abilityUses, wall_charge: (caster.abilityUses?.wall_charge || 0) + 1 },
      reaction: null,
    },
    caster.x,
    caster.y
  );
  setUnits((prev) => prev.map((u) => (u.id === caster.id ? atkFinal : u)));
  flashAttackFeedback(x, y, 'BREACH!', 'status');
  setResolving(false);
}

// INSTA-WALL CEMENT: 1 AP. Convert an empty ground tile within range 3 into a
// player-created wall (BLOCKED, Siege-destructible). Blocks movement + LOS.
// 1 use per mission.
export function resolveInstaWallCement(ctx) {
  const {
    grid, setGrid, caster, x, y, withBurning, setUnits, setResolving,
    setAbilityTargeting, flashAttackFeedback, instaWallTiles,
  } = ctx;
  if (!instaWallTiles || !instaWallTiles.has(`${x},${y}`)) {
    flashAttackFeedback(x, y, 'INVALID');
    return;
  }
  const ability = getUnitAbility(caster, 'insta_wall_cement');
  const apCost = getAbilityApCost(caster, ability);
  setAbilityTargeting(null);
  setResolving(true);
  const newGrid = placePlayerWall(grid, x, y);
  setGrid(newGrid);
  const atkFinal = withBurning(
    {
      ...caster,
      ap: Math.max(0, caster.ap - apCost),
      abilityUses: { ...caster.abilityUses, insta_wall_cement: (caster.abilityUses?.insta_wall_cement || 0) + 1 },
      reaction: null,
    },
    caster.x,
    caster.y
  );
  setUnits((prev) => prev.map((u) => (u.id === caster.id ? atkFinal : u)));
  flashAttackFeedback(x, y, 'WALL!', 'status');
  setResolving(false);
}