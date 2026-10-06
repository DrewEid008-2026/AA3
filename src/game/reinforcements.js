// Reinforcement + Elite Response spawn logic. Spawn tiles must be walkable,
// unoccupied, and not conflicting with mission objects (device, unrescued
// civilian). The caller passes a spawn group (ordered preferred tiles); this
// module picks the first `count` valid ones so blocked tiles fall through to
// the next preference without ever stacking enemies.
import { makeEnemy } from './units';

export function findSpawnTiles(grid, units, spawnGroup, count, missionObjects = {}) {
  const occupied = new Set(units.filter((u) => u.alive).map((u) => `${u.x},${u.y}`));
  const blocked = new Set();
  if (missionObjects.device) blocked.add(`${missionObjects.device.x},${missionObjects.device.y}`);
  if (missionObjects.civilian && !missionObjects.civilian.escortId && !missionObjects.civilian.safe) {
    blocked.add(`${missionObjects.civilian.x},${missionObjects.civilian.y}`);
  }

  const valid = [];
  for (const { x, y } of spawnGroup) {
    if (valid.length >= count) break;
    const tile = grid[y] && grid[y][x];
    if (!tile || tile.type === 'blocked') continue;
    if (occupied.has(`${x},${y}`)) continue;
    if (blocked.has(`${x},${y}`)) continue;
    valid.push({ x, y });
  }
  return valid;
}

// Spawn a standard reinforcement wave. Returns new enemy units (empty if no
// valid tiles were available for some entries — partial spawns are OK).
export function spawnReinforcementWave(grid, units, wave, spawnGroup, missionObjects) {
  const tiles = findSpawnTiles(grid, units, spawnGroup, wave.length, missionObjects);
  return tiles.map((t, i) => makeEnemy(wave[i].archetype, t.x, t.y));
}

// Spawn the Elite Response squad. Elite units use { elite: true } so they get
// the stronger stat overrides while keeping the base archetype for AI.
export function spawnEliteSquad(grid, units, eliteSquad, spawnGroup, missionObjects) {
  const tiles = findSpawnTiles(grid, units, spawnGroup, eliteSquad.length, missionObjects);
  return tiles.map((t, i) => makeEnemy(eliteSquad[i].archetype, t.x, t.y, { elite: true }));
}

// Spawn Phase 2 boss reinforcements: 1 Stalker + 1 Rusher. Uses the boss map's
// predefined reinforcement zones (stalker zone + rusher zone). Each zone is an
// ordered list of preferred tiles; the first valid (walkable, unoccupied, not
// on a mission object) tile is used. If the entire zone is blocked, falls back
// to the other zone's tiles. Never spawns on a player, the Warden, another
// enemy, or inside terrain. Returns new enemy units (may be partial or empty).
export function spawnPhase2Reinforcements(grid, units, zones, missionObjects = {}) {
  if (!zones) return [];
  const newUnits = [];
  const spawns = [
    { archetype: 'stalker', zone: zones.stalker || [] },
    { archetype: 'rusher', zone: zones.rusher || [] },
  ];
  for (const { archetype, zone } of spawns) {
    if (!zone || zone.length === 0) continue;
    const tiles = findSpawnTiles(grid, [...units, ...newUnits], zone, 1, missionObjects);
    if (tiles.length > 0) {
      newUnits.push(makeEnemy(archetype, tiles[0].x, tiles[0].y));
    }
  }
  return newUnits;
}

// --- The Harvester: Fabrication Sequence (Phase 2 one-time reinforcements) ---
//
// Data-driven reinforcement package so the composition can be swapped without
// rebuilding Boss logic. Default: 1 Fabricator (upper-right service zone) +
// 1 Hardened Grunt (upper-left industrial zone). Both use normal enemy
// definitions — normal HP, Armor, movement, AP, AI, salvage, kill handling.
export const FABRICATION_PACKAGE = [
  { archetype: 'fabricator', hardened: false, zoneKey: 'upper_right', label: 'Fabricator' },
  { archetype: 'grunt', hardened: true, zoneKey: 'upper_left', label: 'Hardened Grunt' },
];

// Validate a single spawn tile against CURRENT battlefield state (Part 5-6):
// inside the grid, open terrain (not blocked by intact indestructible or
// intact Siege tile — destroyed Siege tiles become OPEN and are valid),
// unoccupied by any unit, not on a mission object, not on the Harvester
// footprint, not on a pending-hazard tile.
function isValidFabricationTile(tile, x, y, occupied, blocked, hazardKeys, bossFootprint) {
  if (!tile) return false;
  if (tile.type !== 'open') return false; // intact walls / intact Siege tiles
  const k = `${x},${y}`;
  if (occupied.has(k)) return false;
  if (blocked.has(k)) return false;
  if (hazardKeys && hazardKeys.has(k)) return false;
  if (bossFootprint && bossFootprint.has(k)) return false;
  return true;
}

// Search outward from a starting tile for the nearest valid open tile within a
// region constraint (Part 5 fallback). `regionFilter(x,y)` returns true if the
// tile is in the same reinforcement region (so we don't drift across the map).
function nearestValidTile(grid, startX, startY, occupied, blocked, hazardKeys, bossFootprint, regionFilter, maxRadius = 4) {
  for (let r = 1; r <= maxRadius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; // ring
        const x = startX + dx, y = startY + dy;
        if (y < 0 || y >= grid.length || x < 0 || x >= grid[0].length) continue;
        if (!regionFilter(x, y)) continue;
        const tile = grid[y][x];
        if (isValidFabricationTile(tile, x, y, occupied, blocked, hazardKeys, bossFootprint)) {
          return { x, y };
        }
      }
    }
  }
  return null;
}

// Spawn the Fabrication Sequence reinforcements. Uses CURRENT battlefield
// geometry (grid reflects Siege destruction, cover damage, etc.). Each
// reinforcement spawns in its assigned zone; if the preferred tiles are all
// invalid (destroyed/occupied/hazard), falls back to the nearest valid tile in
// the same region. Never spawns inside invalid terrain, on a pending hazard,
// or on the Harvester footprint. Returns { newUnits, logs }.
export function spawnFabricationReinforcements(grid, units, zones, missionObjects = {}, options = {}) {
  if (!zones) return { newUnits: [], logs: [] };
  const occupied = new Set(units.filter((u) => u.alive).map((u) => `${u.x},${u.y}`));
  const blocked = new Set();
  if (missionObjects.device) blocked.add(`${missionObjects.device.x},${missionObjects.device.y}`);
  if (missionObjects.civilian && !missionObjects.civilian.escortId && !missionObjects.civilian.safe) {
    blocked.add(`${missionObjects.civilian.x},${missionObjects.civilian.y}`);
  }
  const hazardKeys = options.pendingHazardKeys || null;
  const bossFootprint = options.bossFootprint
    ? new Set(options.bossFootprint.map((t) => `${t.x},${t.y}`))
    : null;

  const newUnits = [];
  const logs = [];
  const usedTiles = new Set();

  for (const entry of FABRICATION_PACKAGE) {
    const zoneTiles = zones[entry.zoneKey] || [];
    if (zoneTiles.length === 0) continue;

    // Try preferred tiles first (ordered).
    let spawnTile = null;
    for (const z of zoneTiles) {
      const k = `${z.x},${z.y}`;
      if (usedTiles.has(k)) continue;
      const tile = grid[z.y] && grid[z.y][z.x];
      if (isValidFabricationTile(tile, z.x, z.y, occupied, blocked, hazardKeys, bossFootprint)) {
        spawnTile = { x: z.x, y: z.y };
        break;
      }
    }

    // Fallback: nearest valid tile in the same region (Part 5).
    if (!spawnTile) {
      const first = zoneTiles[0];
      const regionFilter = entry.zoneKey === 'upper_left'
        ? (x) => x <= 2
        : (x) => x >= 6;
      const near = nearestValidTile(grid, first.x, first.y, occupied, blocked, hazardKeys, bossFootprint, regionFilter);
      if (near) spawnTile = near;
    }

    if (spawnTile) {
      const k = `${spawnTile.x},${spawnTile.y}`;
      usedTiles.add(k);
      occupied.add(k); // prevent stacking within this batch
      newUnits.push(makeEnemy(entry.archetype, spawnTile.x, spawnTile.y, { hardened: entry.hardened }));
      logs.push(`${entry.label} deployed.`);
    }
  }

  return { newUnits, logs };
}