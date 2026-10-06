// Phase 3 Core Overload — telegraphed environmental hazards. During Core
// Overload, the Warden destabilizes the battlefield itself: 2 tiles near the
// Warden become Overloaded each Enemy Phase and detonate at the start of the
// next Enemy Phase for 3 Environmental damage (no armor, no cover, no Marked).
//
// The player gets one full Player Phase to vacate the marked tiles. Hazards
// affect player units only — never enemies, cover, walls, or relay remains.
import { GRID_WIDTH, GRID_HEIGHT, TILE_TYPES } from './constants';
import { TEAMS } from './constants';

export const OVERLOAD_DAMAGE = 3;
export const OVERLOAD_RANGE = 4; // tiles from Warden's current position
export const MAX_PENDING = 2; // exactly 2 tiles per cycle

// Create the hazard data for a selected tile.
function makeHazard(x, y, turn, idx) {
  return {
    id: `overload_${turn}_${idx}`,
    x,
    y,
    damage: OVERLOAD_DAMAGE,
    castRound: turn,
  };
}

// Is this tile valid for an Overload hazard?
// - inside bounds
// - walkable (not a wall/blocked)
// - not already a pending Overload tile
// - not a destroyed relay (isBossObject && !alive)
function isValidOverloadTile(grid, x, y, existingKeys, units) {
  if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) return false;
  const tile = grid[y] && grid[y][x];
  if (!tile || tile.type === TILE_TYPES.BLOCKED) return false;
  if (existingKeys.has(`${x},${y}`)) return false;
  // Don't place on a destroyed relay's remains.
  const onDestroyedRelay = units.some((u) => u.isBossObject && !u.alive && u.x === x && u.y === y);
  if (onDestroyedRelay) return false;
  return true;
}

// Score a candidate tile for Overload placement. Higher = better target.
// Prefers player-occupied tiles, clustered soldiers, defensive positions,
// engineer hardpoints, and likely movement lanes near the Warden.
function scoreOverloadTile(grid, tile, units, warden) {
  let score = 0;
  const { x, y } = tile;

  // Player-occupied: the strongest preference — the soldier gets a warning.
  const occupant = units.find((u) => u.alive && u.team === TEAMS.PLAYER && u.x === x && u.y === y);
  if (occupant) {
    score += 100;
    // Wounded soldiers are higher-value targets (pressure to finish them).
    if (occupant.maxHp > 0 && occupant.hp <= occupant.maxHp * 0.5) score += 20;
  }

  // Cluster pressure: count players adjacent to this tile.
  let adjacentPlayers = 0;
  for (const u of units) {
    if (!u.alive || u.team !== TEAMS.PLAYER) continue;
    const dist = Math.max(Math.abs(u.x - x), Math.abs(u.y - y));
    if (dist === 1) adjacentPlayers++;
    if (dist <= 2) score += 10; // near-miss pressure on movement lanes
  }
  score += adjacentPlayers * 30;

  // Defensive position: tile with cover is a strong defensive hardpoint.
  if (tile.cover) {
    const hasCover = ['n', 's', 'e', 'w'].some((d) => tile.cover[d] && !tile.cover[d].destroyed);
    if (hasCover) score += 25;
  }

  // Engineer hardpoint: engineer within 2 tiles.
  const engineerNear = units.some(
    (u) => u.alive && u.team === TEAMS.PLAYER && u.archetype === 'engineer' &&
    Math.max(Math.abs(u.x - x), Math.abs(u.y - y)) <= 2
  );
  if (engineerNear) score += 20;

  // Proximity to Warden: prefer tiles closer to the Warden (Part 13).
  const distToWarden = Math.max(Math.abs(x - warden.x), Math.abs(y - warden.y));
  score += (OVERLOAD_RANGE - distToWarden) * 5;

  return score;
}

// Safety check (Part 18): ensure no player is completely trapped by the new
// hazards. A player on a hazard tile must have at least one walkable, non-
// hazard neighbor to escape to during their Player Phase. Returns true if safe.
function isPlacementSafe(grid, hazards, units) {
  const hazardKeys = new Set(hazards.map((h) => `${h.x},${h.y}`));
  for (const h of hazards) {
    const occupant = units.find((u) => u.alive && u.team === TEAMS.PLAYER && u.x === h.x && u.y === h.y);
    if (!occupant) continue;
    // Check at least 2 walkable non-hazard neighbors (1 to escape, 1 buffer).
    let escapeRoutes = 0;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const nx = h.x + dx, ny = h.y + dy;
        if (nx < 0 || nx >= GRID_WIDTH || ny < 0 || ny >= GRID_HEIGHT) continue;
        const t = grid[ny] && grid[nx] && grid[ny][nx];
        if (!t || t.type === TILE_TYPES.BLOCKED) continue;
        if (hazardKeys.has(`${nx},${ny}`)) continue;
        escapeRoutes++;
      }
    }
    if (escapeRoutes < 2) return false;
  }
  return true;
}

// Select 2 valid battlefield tiles near the Warden for Overload hazards.
// Returns an array of 0–2 hazard objects. Tiles are chosen by tactical
// scoring, with a safety check to avoid unavoidable traps.
export function createOverloadHazards(grid, units, warden, existingHazards, turn = 0) {
  if (!warden || !warden.alive) return [];
  const existingKeys = new Set((existingHazards || []).map((h) => `${h.x},${h.y}`));

  // Gather all valid candidate tiles within range of the Warden.
  const candidates = [];
  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      const dist = Math.max(Math.abs(x - warden.x), Math.abs(y - warden.y));
      if (dist > OVERLOAD_RANGE || dist < 1) continue; // not on Warden's own tile
      if (!isValidOverloadTile(grid, x, y, existingKeys, units)) continue;
      const tile = grid[y][x];
      candidates.push({ x, y, tile, score: scoreOverloadTile(grid, { x, y, tile }, units, warden) });
    }
  }

  if (candidates.length === 0) return [];

  // Sort by score descending.
  candidates.sort((a, b) => b.score - a.score);

  // Pick the top 2 distinct tiles. Try the best pair that passes the safety
  // check. If the best pair is unsafe, fall back to lower-scored alternatives.
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const pair = [
        makeHazard(candidates[i].x, candidates[i].y, turn, 0),
        makeHazard(candidates[j].x, candidates[j].y, turn, 1),
      ];
      if (isPlacementSafe(grid, pair, units)) return pair;
    }
  }

  // If no safe pair of 2 exists, try a single tile (better than nothing).
  if (candidates.length > 0) {
    return [makeHazard(candidates[0].x, candidates[0].y, turn, 0)];
  }

  return [];
}

// Detonate all pending Overload hazards. Returns an array of hit results:
// { unitId, x, y, damage, killed, downed } for each player unit on a hazard
// tile. Does NOT modify the units array — the caller applies the damage.
export function detonateOverloadHazards(hazards, units) {
  if (!hazards || hazards.length === 0) return [];
  const hits = [];
  for (const h of hazards) {
    const occupant = units.find(
      (u) => u.alive && u.team === TEAMS.PLAYER && u.x === h.x && u.y === h.y
    );
    if (occupant) {
      hits.push({
        unitId: occupant.id,
        x: h.x,
        y: h.y,
        damage: OVERLOAD_DAMAGE,
      });
    }
  }
  return hits;
}

// Set of "x,y" keys for all pending hazards (for rendering overlays).
export function getOverloadTileKeys(hazards) {
  const keys = new Set();
  for (const h of hazards || []) keys.add(`${h.x},${h.y}`);
  return keys;
}