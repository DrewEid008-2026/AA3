// CORE DISCHARGE — The Harvester's one-time Phase 3 attack.
//
// The exposed reactor violently vents energy around the Harvester in all
// directions. Radius 2 (all valid tiles up to 2 tiles from the Harvester
// footprint, excluding the Harvester's own tile). Telegraphed for one full
// Player Phase (Part 26). Deals 6 DIRECT ENERGY damage (Armor applies, Cover
// does NOT, Shields apply) + 6 terrain damage to normal destructible Cover
// (Part 30). Does NOT destroy Siege map tiles (Part 31). The Harvester does
// not move while the discharge is pending (Part 33). Used at most once per
// Boss attempt (Part 24).

import { GRID_WIDTH, GRID_HEIGHT, TILE_TYPES } from './constants';
import { isSiegeDestructibleTile } from './tileDestruction';
import { damageCoverTile } from './cover';

export const CORE_DISCHARGE_DAMAGE = 6;
export const CORE_DISCHARGE_RADIUS = 2;
export const CORE_DISCHARGE_TERRAIN_DAMAGE = 6;

let dischargeIdCounter = 0;

// Compute all valid affected tiles within radius of the Harvester (excluding
// the Harvester's own tile). Tiles are frozen at telegraph time (Part 32).
function computeAffectedTiles(grid, harvester) {
  const tiles = [];
  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      const dist = Math.max(Math.abs(x - harvester.x), Math.abs(y - harvester.y));
      if (dist > CORE_DISCHARGE_RADIUS || dist < 1) continue;
      const tile = grid[y] && grid[y][x];
      if (!tile || tile.type === TILE_TYPES.BLOCKED) continue;
      tiles.push({ x, y });
    }
  }
  return tiles;
}

// Create a pending Core Discharge. The affected tiles are pre-computed and
// stored so the player reacts to the exact telegraphed area (Part 32).
export function createCoreDischarge(harvester, grid, turn) {
  const tiles = computeAffectedTiles(grid, harvester);
  return {
    id: `core_discharge_${dischargeIdCounter++}`,
    sourceId: harvester.id,
    sourceX: harvester.x,
    sourceY: harvester.y,
    tiles,
    castRound: turn,
    detonationEnemyPhase: turn + 1,
    resolved: false,
  };
}

// Set of "x,y" keys for the affected area (rendering, safety checks).
export function getCoreDischargeTileKeys(discharge) {
  if (!discharge || !discharge.tiles) return new Set();
  return new Set(discharge.tiles.map((t) => `${t.x},${t.y}`));
}

// Detonate the Core Discharge. Deals 6 direct energy damage to all units in
// the affected area (Armor applies, Cover ignored, Shields apply) and 6
// terrain damage to normal destructible Cover (Part 30). Does NOT destroy
// Siege tiles (Part 31). Returns { hits, grid } — the caller applies unit
// damage via resolveFlatDamage (affectedByArmor: true, ignoreCover: true).
export function detonateCoreDischarge(discharge, units, grid) {
  if (!discharge) return { hits: [], grid };
  const keys = getCoreDischargeTileKeys(discharge);
  const hits = [];

  for (const u of units) {
    if (!u.alive) continue;
    if (u.id === discharge.sourceId) continue; // Harvester is immune
    if (keys.has(`${u.x},${u.y}`)) {
      hits.push({
        unitId: u.id,
        x: u.x,
        y: u.y,
        damage: CORE_DISCHARGE_DAMAGE,
        team: u.team,
      });
    }
  }

  // Damage normal destructible Cover in the affected area (Part 30).
  let newGrid = grid;
  for (const t of discharge.tiles) {
    const tile = newGrid[t.y] && newGrid[t.y][t.x];
    if (!tile || !tile.cover) continue;
    if (isSiegeDestructibleTile(tile)) continue; // Part 31
    newGrid = damageCoverTile(newGrid, t.x, t.y, CORE_DISCHARGE_TERRAIN_DAMAGE);
  }

  return { hits, grid: newGrid };
}

// Safety check (Part 36): verify that scheduling Core Discharge alongside
// pending Meltdown zones doesn't create an impossible escape combination.
// Every player in the discharge area must have at least one safe escape tile
// that is NOT in the discharge area and NOT in a pending Meltdown zone.
export function isCoreDischargeSafeWithMeltdown(grid, dischargeKeys, meltdownKeys, units) {
  const allHazardKeys = new Set([...dischargeKeys, ...(meltdownKeys || [])]);

  for (const u of units) {
    if (!u.alive || u.team !== 'player' || u.downed) continue;
    if (!dischargeKeys.has(`${u.x},${u.y}`)) continue;

    let escapeRoutes = 0;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const nx = u.x + dx, ny = u.y + dy;
        if (nx < 0 || nx >= GRID_WIDTH || ny < 0 || ny >= GRID_HEIGHT) continue;
        const t = grid[ny] && grid[ny][nx];
        if (!t || t.type === TILE_TYPES.BLOCKED) continue;
        if (allHazardKeys.has(`${nx},${ny}`)) continue;
        escapeRoutes++;
      }
    }
    if (escapeRoutes < 1) return false;
  }
  return true;
}