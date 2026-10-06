// MELTDOWN ZONES — Phase 3 environmental hazards (The Harvester).
//
// During Phase 3 (CORE FAILURE), the Harvester's failing reactor destabilizes
// the battlefield. Each cycle, 2-3 tiles near the Harvester become Meltdown
// Zones — glowing, overheated ground that detonates at the start of the next
// Enemy Phase for 4 Environmental damage (ignores Armor, Cover, Exposed/Flanked).
//
// The player gets one full Player Phase to vacate (Part 10). Meltdown Zones are
// environmental (not a weapon attack): they don't destroy Siege tiles or normal
// cover (Part 17). The Harvester is immune to its own reactor venting (Part 40);
// other aliens are not (Part 18).

import { GRID_WIDTH, GRID_HEIGHT, TILE_TYPES, TEAMS } from './constants';
import { isSiegeDestructibleTile } from './tileDestruction';

export const MELTDOWN_DAMAGE = 4;
export const MELTDOWN_RADIUS = 4;
export const MELTDOWN_MIN_COUNT = 2;
export const MELTDOWN_MAX_COUNT = 3;

let meltdownCycleCounter = 0;

// Create a single Meltdown Zone data object (Part 20 — explicit pending state).
function makeZone(x, y, cycleId, castRound) {
  return {
    id: `meltdown_${cycleId}_${x}_${y}`,
    x,
    y,
    cycleId,
    castRound,
    detonationEnemyPhase: castRound + 1,
    resolved: false,
  };
}

// Is this tile valid for a Meltdown Zone?
// - inside bounds
// - walkable (not blocked)
// - not a Siege-destructible tile (Part 17 — don't mark Siege tiles)
// - not already a pending Meltdown tile
// - not the Harvester's own tile
function isValidMeltdownTile(grid, x, y, existingKeys, harvester) {
  if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) return false;
  const tile = grid[y] && grid[y][x];
  if (!tile || tile.type === TILE_TYPES.BLOCKED) return false;
  if (isSiegeDestructibleTile(tile)) return false;
  if (existingKeys.has(`${x},${y}`)) return false;
  if (harvester && harvester.x === x && harvester.y === y) return false;
  return true;
}

// Score a candidate tile for Meltdown placement. Higher = better.
// Prefers: player-occupied tiles, tiles near players, defensive cover positions,
// approach routes near the Harvester (Part 13). Avoids targeting only Downed
// soldiers (Part 42).
function scoreMeltdownTile(grid, tile, units, harvester) {
  let score = 0;
  const { x, y } = tile;

  const occupant = units.find((u) => u.alive && u.team === TEAMS.PLAYER && u.x === x && u.y === y);
  if (occupant) {
    if (occupant.downed) return -1; // Part 42
    score += 100;
    if (occupant.maxHp > 0 && occupant.hp <= occupant.maxHp * 0.5) score += 20;
  }

  let adjacentPlayers = 0;
  for (const u of units) {
    if (!u.alive || u.team !== TEAMS.PLAYER || u.downed) continue;
    const dist = Math.max(Math.abs(u.x - x), Math.abs(u.y - y));
    if (dist === 1) adjacentPlayers++;
    if (dist <= 2) score += 10;
  }
  score += adjacentPlayers * 25;

  if (tile.cover) {
    const hasCover = ['n', 's', 'e', 'w'].some((d) => tile.cover[d] && !tile.cover[d].destroyed);
    if (hasCover) score += 20;
  }

  const distToHarvester = Math.max(Math.abs(x - harvester.x), Math.abs(y - harvester.y));
  score += (MELTDOWN_RADIUS - distToHarvester) * 5;

  return score;
}

// Safety check (Part 14): ensure no player is completely trapped by the new
// hazards. A player on a hazard tile must have at least one walkable, non-
// hazard neighbor to escape to. Also validates combined safety with other
// pending hazard tiles (Part 35).
function isMeltdownPlacementSafe(grid, zones, units, pendingHazardKeys) {
  const hazardKeys = new Set(zones.map((z) => `${z.x},${z.y}`));
  if (pendingHazardKeys) for (const k of pendingHazardKeys) hazardKeys.add(k);

  for (const z of zones) {
    const occupant = units.find((u) => u.alive && u.team === TEAMS.PLAYER && u.x === z.x && u.y === z.y);
    if (!occupant || occupant.downed) continue;
    let escapeRoutes = 0;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const nx = z.x + dx, ny = z.y + dy;
        if (nx < 0 || nx >= GRID_WIDTH || ny < 0 || ny >= GRID_HEIGHT) continue;
        const t = grid[ny] && grid[ny][nx];
        if (!t || t.type === TILE_TYPES.BLOCKED) continue;
        if (hazardKeys.has(`${nx},${ny}`)) continue;
        escapeRoutes++;
      }
    }
    if (escapeRoutes < 1) return false;
  }
  return true;
}

// Create 2-3 Meltdown Zones near the Harvester (Part 11). Returns an array of
// zone objects. `pendingHazardKeys` is a Set of "x,y" for other pending hazards
// (Tremor, Beam, Charge, Core Discharge) — used for combined safety (Part 35).
export function createMeltdownZones(grid, units, harvester, existingZones, pendingHazardKeys, turn = 0) {
  if (!harvester || !harvester.alive) return [];
  const existingKeys = new Set((existingZones || []).map((z) => `${z.x},${z.y}`));

  const candidates = [];
  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      const dist = Math.max(Math.abs(x - harvester.x), Math.abs(y - harvester.y));
      if (dist > MELTDOWN_RADIUS || dist < 1) continue;
      if (!isValidMeltdownTile(grid, x, y, existingKeys, harvester)) continue;
      const tile = grid[y][x];
      candidates.push({ x, y, tile, score: scoreMeltdownTile(grid, { x, y, tile }, units, harvester) });
    }
  }

  if (candidates.length === 0) return [];
  candidates.sort((a, b) => b.score - a.score);

  const cycleId = meltdownCycleCounter++;
  const targetCount = (candidates.length >= 6 && Math.random() < 0.35) ? 3 : 2;

  // Try combinations of the top candidates that pass the safety check.
  const top = candidates.slice(0, Math.min(candidates.length, targetCount + 4));

  // Try targetCount first, then fall back to fewer.
  for (let n = Math.min(targetCount, top.length); n >= 2; n--) {
    if (n === 2) {
      for (let i = 0; i < top.length; i++) {
        for (let j = i + 1; j < top.length; j++) {
          const pair = [
            makeZone(top[i].x, top[i].y, cycleId, turn),
            makeZone(top[j].x, top[j].y, cycleId, turn),
          ];
          if (isMeltdownPlacementSafe(grid, pair, units, pendingHazardKeys)) return pair;
        }
      }
    } else if (n === 3) {
      for (let i = 0; i < top.length; i++) {
        for (let j = i + 1; j < top.length; j++) {
          for (let k = j + 1; k < top.length; k++) {
            const triple = [
              makeZone(top[i].x, top[i].y, cycleId, turn),
              makeZone(top[j].x, top[j].y, cycleId, turn),
              makeZone(top[k].x, top[k].y, cycleId, turn),
            ];
            if (isMeltdownPlacementSafe(grid, triple, units, pendingHazardKeys)) return triple;
          }
        }
      }
    }
  }

  // Fallback: a single safe tile.
  if (candidates.length > 0) {
    const single = [makeZone(candidates[0].x, candidates[0].y, cycleId, turn)];
    if (isMeltdownPlacementSafe(grid, single, units, pendingHazardKeys)) return single;
  }

  return [];
}

// Detonate all pending Meltdown Zones. Returns an array of hit results:
// { unitId, x, y, damage, team } for each unit on a hazard tile.
// The Harvester is immune to its own reactor venting (Part 40). Other aliens
// are NOT immune (Part 18). Does NOT modify the units array — caller applies.
export function detonateMeltdownZones(zones, units, harvesterId) {
  if (!zones || zones.length === 0) return [];
  const hits = [];
  for (const z of zones) {
    const occupant = units.find((u) => u.alive && u.x === z.x && u.y === z.y);
    if (!occupant) continue;
    if (harvesterId && occupant.id === harvesterId) continue; // Part 40
    hits.push({
      unitId: occupant.id,
      x: z.x,
      y: z.y,
      damage: MELTDOWN_DAMAGE,
      team: occupant.team,
    });
  }
  return hits;
}

// Set of "x,y" keys for all pending zones (rendering, safety checks).
export function getMeltdownTileKeys(zones) {
  const keys = new Set();
  for (const z of zones || []) keys.add(`${z.x},${z.y}`);
  return keys;
}