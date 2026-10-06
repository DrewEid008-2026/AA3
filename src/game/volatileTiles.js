// Volatile Tiles — Chapter 3 environmental hazard system (Implementation 3.4.5).
//
// A Volatile Tile is hazardous traversable terrain. Any unit that ENTERS the
// tile takes environmental damage (default 2). The hazard fires ON ENTER —
// standing on a volatile tile does not repeatedly deal damage. Re-entering
// the same tile triggers damage again.
//
// Design (spec):
//   - Damage type: ENVIRONMENTAL (Armor applies, Shields apply, Cover does NOT).
//   - Affects ALL units (player, enemy, boss, featured) — no hidden immunity.
//   - Flash Reflexes does NOT protect (it only blocks Overwatch/reaction fire).
//   - Triggers during normal movement, Dash, forced movement, COME HERE!, and
//     enemy movement — every real tile-by-tile entry.
//   - Downed/killed units stop movement immediately at the volatile tile.
//
// This module is the single source of truth for the hazard. The damage value
// is data-driven (VOLATILE_TILE_DAMAGE) so it can be tuned without rewriting
// the system. The architecture is reusable for future hazard types
// (fire, acid, electricity, ice, poison, gravity zones — spec 33).

import { getCurrentArmor } from './armorShred';
import { resolveTargetDamage } from './enemyPhaseHelpers';

// --- Data-driven balance ---
export const VOLATILE_TILE_DAMAGE = 2;

// Reusable terrain configuration (spec 1, 30).
export const VOLATILE_TERRAIN_CONFIG = {
  id: 'volatile',
  name: 'VOLATILE',
  desc: `Units take ${VOLATILE_TILE_DAMAGE} environmental damage whenever they enter this tile.`,
  isTraversable: true,
  blocksLOS: false,
  providesCover: false,
  onEnterDamage: VOLATILE_TILE_DAMAGE,
  damageType: 'ENVIRONMENTAL',
  aiHazard: true,
};

export const TERRAIN_DEFS = {
  default: {
    id: 'default',
    name: 'GROUND',
    desc: 'Normal ground.',
    isTraversable: true,
    blocksLOS: false,
    providesCover: false,
    onEnterDamage: 0,
    damageType: null,
    aiHazard: false,
  },
  volatile: VOLATILE_TERRAIN_CONFIG,
};

// Display metadata (used by Tactical Lens, InspectionCard, etc.).
export const VOLATILE_INFO = {
  id: 'volatile',
  name: 'VOLATILE',
  desc: `Units take ${VOLATILE_TILE_DAMAGE} environmental damage whenever they enter this tile.`,
  damage: VOLATILE_TILE_DAMAGE,
};

// --- Tile state helpers ---

// Is this tile volatile? Checks the `volatile` flag or `terrain === 'volatile'`.
export function isVolatileTile(tile) {
  return !!(tile && (tile.volatile || tile.terrain === 'volatile'));
}

// Toggle volatile state on a tile (debug / map editing).
export function setVolatile(grid, x, y, active) {
  const tile = grid[y] && grid[y][x];
  if (!tile) return;
  if (active) {
    tile.volatile = true;
    tile.terrain = 'volatile';
  } else {
    delete tile.volatile;
    tile.terrain = 'default';
  }
}

// --- Path analysis (for preview + AI) ---

// Count volatile tiles in a movement path (excluding the start tile).
// `path` is an array of [x, y] pairs (same shape as computeReachable paths).
export function countVolatileInPath(path, grid) {
  if (!path || path.length < 2) return 0;
  let count = 0;
  for (let i = 1; i < path.length; i++) {
    const [x, y] = path[i];
    const tile = grid[y] && grid[y][x];
    if (isVolatileTile(tile)) count++;
  }
  return count;
}

// Predict the total raw environmental damage for a path (before defenses).
// Used by the movement preview to warn the player (spec 19-20).
export function predictHazardDamage(path, grid) {
  return countVolatileInPath(path, grid) * VOLATILE_TILE_DAMAGE;
}

// List individual hazard events along a path (for detailed preview, spec 20).
// Returns [{ pathIndex, x, y, damage }] for each volatile tile entered.
export function getHazardEventsInPath(path, grid) {
  const events = [];
  if (!path || path.length < 2) return events;
  for (let i = 1; i < path.length; i++) {
    const [x, y] = path[i];
    const tile = grid[y] && grid[y][x];
    if (isVolatileTile(tile)) {
      events.push({ pathIndex: i, x, y, damage: VOLATILE_TILE_DAMAGE });
    }
  }
  return events;
}

// --- Damage resolution ---

// Apply volatile tile damage to a unit. Environmental damage:
//   - Armor applies (flat reduction, min 1)
//   - Shields apply (Bulwark + Core Shield, handled by resolveTargetDamage)
//   - Cover modifiers do NOT apply (spec 13)
//   - Marked bonus does NOT apply (environmental, not an attack)
//   - Flash Reflexes does NOT protect (spec 15)
//
// Returns { unit, damage, killed, downed, shieldAbsorbed, coreShieldAbsorbed }.
// `damage` is the post-Armor, pre-Shield value (for popups). The caller is
// responsible for updating game state and showing feedback.
export function applyVolatileDamage(unit) {
  if (!unit || !unit.alive || unit.downed) {
    return { unit, damage: 0, killed: false, downed: false, shieldAbsorbed: 0, coreShieldAbsorbed: 0 };
  }
  const baseDamage = VOLATILE_TILE_DAMAGE;
  const armor = getCurrentArmor(unit);
  let finalDamage = baseDamage;
  if (armor > 0) {
    finalDamage = Math.max(1, finalDamage - armor);
  }
  const result = resolveTargetDamage(unit, finalDamage);
  return {
    unit: result.unit,
    damage: finalDamage,
    killed: result.killed,
    downed: result.downed,
    shieldAbsorbed: result.shieldAbsorbed || 0,
    coreShieldAbsorbed: result.coreShieldAbsorbed || 0,
  };
}

// --- Authoritative tile-entry event (Spec 2, 9) ---

// Authoritative tile-entry event resolver.
// When a unit transitions from one tile to another along any movement path:
//   1. Inspects the tile / terrain at (nx, ny).
//   2. If volatile, applies environmental damage (recalculated defensively each entry).
//   3. Returns whether the unit stopped (downed or killed).
//
// This is the single shared entry point used by:
//   - Player movement (normal move, Dash, Hit and Run / Relocate)
//   - Enemy movement & Phase Step/Shift
//   - Forced movement (Dislocator COME HERE!)
//   - Any future movement effects
export function onUnitEnterTile(grid, unit, nx, ny, _context = {}) {
  if (!unit || !unit.alive || unit.downed) {
    return {
      hasEffect: false,
      unit,
      damage: 0,
      killed: false,
      downed: false,
      stopped: false,
      hazardType: null,
      shieldAbsorbed: 0,
      coreShieldAbsorbed: 0,
    };
  }

  const tile = grid && grid[ny] && grid[ny][nx];
  if (!tile) {
    return {
      hasEffect: false,
      unit,
      damage: 0,
      killed: false,
      downed: false,
      stopped: false,
      hazardType: null,
      shieldAbsorbed: 0,
      coreShieldAbsorbed: 0,
    };
  }

  // Volatile terrain hazard check
  if (isVolatileTile(tile)) {
    const volResult = applyVolatileDamage(unit);
    return {
      hasEffect: true,
      hazardType: 'volatile',
      unit: volResult.unit,
      damage: volResult.damage,
      killed: volResult.killed,
      downed: volResult.downed,
      stopped: volResult.killed || volResult.downed,
      shieldAbsorbed: volResult.shieldAbsorbed || 0,
      coreShieldAbsorbed: volResult.coreShieldAbsorbed || 0,
    };
  }

  return {
    hasEffect: false,
    unit,
    damage: 0,
    killed: false,
    downed: false,
    stopped: false,
    hazardType: null,
    shieldAbsorbed: 0,
    coreShieldAbsorbed: 0,
  };
}

// --- Spawn & objective safety validation (spec 31, 32) ---

// Check if a position overlaps any reserved zone (deploy, spawn, extraction,
// objective). Returns true if the position is safe for volatile placement.
export function isPositionSafeForVolatile(x, y, reservedTiles) {
  if (!reservedTiles) return true;
  return !reservedTiles.has(`${x},${y}`);
}

// Validate map layout safety: warns if volatile tiles overlap player deploy,
// enemy deploy, reinforcement spawn, extraction, or mandatory objective tiles.
// Never deletes or mutates data — logs clear warnings for review (spec 31-32).
export function validateVolatileMapSafety(grid, zones = {}) {
  const {
    playerDeploy = [],
    enemyDeploy = [],
    reinforcementSpawns = [],
    extractionZone = [],
    objectiveTiles = [],
  } = zones;

  const reserved = new Map();
  for (const t of playerDeploy || []) if (t) reserved.set(`${t.x},${t.y}`, 'Player Deployment');
  for (const t of enemyDeploy || []) if (t) reserved.set(`${t.x},${t.y}`, 'Enemy Deployment');
  for (const t of reinforcementSpawns || []) if (t) reserved.set(`${t.x},${t.y}`, 'Reinforcement Spawn');
  for (const t of extractionZone || []) if (t) reserved.set(`${t.x},${t.y}`, 'Extraction Zone');
  for (const t of objectiveTiles || []) if (t) reserved.set(`${t.x},${t.y}`, 'Mandatory Objective Tile');

  const warnings = [];
  if (grid) {
    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < grid[y].length; x++) {
        if (isVolatileTile(grid[y][x])) {
          const resType = reserved.get(`${x},${y}`);
          if (resType) {
            const msg = `Volatile tile at (${x},${y}) overlaps ${resType}.`;
            warnings.push(msg);
            console.warn(`[Volatile Safety Warning] ${msg}`);
          }
        }
      }
    }
  }

  return {
    safe: warnings.length === 0,
    warnings,
  };
}

/**
 * Check if the grid contains at least one contiguous square block (e.g. 2x2) of volatile tiles.
 */
export function hasVolatileSquareGroup(grid, size = 2) {
  if (!grid || grid.length < size || !grid[0] || grid[0].length < size) return false;
  const H = grid.length;
  const W = grid[0].length;
  for (let y = 0; y <= H - size; y++) {
    for (let x = 0; x <= W - size; x++) {
      let allVolatile = true;
      for (let dy = 0; dy < size; dy++) {
        for (let dx = 0; dx < size; dx++) {
          if (!isVolatileTile(grid[y + dy][x + dx])) {
            allVolatile = false;
            break;
          }
        }
        if (!allVolatile) break;
      }
      if (allVolatile) return true;
    }
  }
  return false;
}

/**
 * Procedurally populates volatile terrain hazards on the battlefield grid.
 *
 * Rules:
 * 1. Safe Placement: Never overlaps player deployment, enemy deployment,
 *    reinforcement spawns, extraction zones, or mandatory objective tiles (device/civilian).
 * 2. Chapter 3 Guarantee: On Chapter 3 maps, ALWAYS includes at least one 2x2 square
 *    group of volatile terrain (4 contiguous tiles: [x,y], [x+1,y], [x,y+1], [x+1,y+1])
 *    located in the mid-field so the Dislocator unit can exploit it with "COME HERE!".
 * 3. Reasonable Amount on Maps:
 *    - Chapter 3: 1 mandatory 2x2 block (4 tiles) + 1-2 additional hazard tiles in mid-field (5-6 total).
 *    - Other chapters / standard maps: 2 to 4 volatile tiles placed in tactical mid-field or flanking positions.
 */
export function populateVolatileHazards(grid, zones = {}, options = {}, rng = Math.random) {
  if (!grid || grid.length === 0 || !grid[0] || grid[0].length === 0) return [];

  const H = grid.length;
  const W = grid[0].length;
  const chapterId = options.chapterId || options.chapter || null;
  const isChapter3 = chapterId === 'ch3';

  const {
    playerDeploy = [],
    enemyDeploy = [],
    reinforcementSpawns = [],
    extractionZone = [],
    device = null,
    civilian = null,
  } = zones;

  // Build reserved set of unsafe tile keys
  const reserved = new Set();
  const playerBuffer = new Set();

  for (const t of playerDeploy || []) {
    if (!t) continue;
    reserved.add(`${t.x},${t.y}`);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = t.x + dx;
        const ny = t.y + dy;
        if (nx >= 0 && nx < W && ny >= 0 && ny < H) {
          playerBuffer.add(`${nx},${ny}`);
        }
      }
    }
  }

  for (const t of enemyDeploy || []) if (t) reserved.add(`${t.x},${t.y}`);
  for (const t of reinforcementSpawns || []) if (t) reserved.add(`${t.x},${t.y}`);
  for (const t of extractionZone || []) if (t) reserved.add(`${t.x},${t.y}`);

  if (device) {
    reserved.add(`${device.x},${device.y}`);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = device.x + dx;
        const ny = device.y + dy;
        if (nx >= 0 && nx < W && ny >= 0 && ny < H) reserved.add(`${nx},${ny}`);
      }
    }
  }

  if (civilian) {
    reserved.add(`${civilian.x},${civilian.y}`);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = civilian.x + dx;
        const ny = civilian.y + dy;
        if (nx >= 0 && nx < W && ny >= 0 && ny < H) reserved.add(`${nx},${ny}`);
      }
    }
  }

  const isTileEligible = (x, y, usePlayerBuffer = true) => {
    if (y < 0 || y >= H || x < 0 || x >= W) return false;
    const tile = grid[y][x];
    if (!tile || tile.type !== 'open') return false;
    if (reserved.has(`${x},${y}`)) return false;
    if (usePlayerBuffer && playerBuffer.has(`${x},${y}`)) return false;
    return true;
  };

  const newlyAdded = [];

  const markVolatile = (x, y) => {
    const tile = grid[y]?.[x];
    if (tile && tile.type === 'open' && !tile.volatile) {
      tile.volatile = true;
      tile.terrain = 'volatile';
      newlyAdded.push({ x, y });
    }
  };

  // --- Step 1: Chapter 3 Mandatory 2x2 Square Group ---
  if (isChapter3) {
    const find2x2Candidates = (useBuffer) => {
      const candidates = [];
      const midY = H / 2;
      for (let y = 1; y < H - 2; y++) {
        for (let x = 0; x < W - 1; x++) {
          const t00 = isTileEligible(x, y, useBuffer);
          const t10 = isTileEligible(x + 1, y, useBuffer);
          const t01 = isTileEligible(x, y + 1, useBuffer);
          const t11 = isTileEligible(x + 1, y + 1, useBuffer);
          if (t00 && t10 && t01 && t11) {
            const distFromMid = Math.abs((y + 0.5) - midY);
            let score = 100 - distFromMid * 10;
            if (x >= 1 && x <= W - 3) score += 15;
            candidates.push({ x, y, score });
          }
        }
      }
      return candidates;
    };

    let candidates = find2x2Candidates(true);
    if (candidates.length === 0) {
      candidates = find2x2Candidates(false);
    }

    if (candidates.length > 0) {
      candidates.sort((a, b) => b.score - a.score);
      const topScore = candidates[0].score;
      const topCandidates = candidates.filter((c) => c.score >= topScore - 12);
      const chosen = topCandidates[Math.floor(rng() * topCandidates.length)];

      markVolatile(chosen.x, chosen.y);
      markVolatile(chosen.x + 1, chosen.y);
      markVolatile(chosen.x, chosen.y + 1);
      markVolatile(chosen.x + 1, chosen.y + 1);
    }
  }

  // --- Step 2: Additional / General Volatile Tiles ("a reasonable amount on maps") ---
  const targetAdditional = isChapter3
    ? 1 + Math.floor(rng() * 2)   // 1 or 2 extra tiles (total 5-6)
    : 2 + Math.floor(rng() * 3);  // 2 to 4 tiles for general maps

  const singleCandidates = [];
  const midY = H / 2;
  for (let y = 2; y < H - 2; y++) {
    for (let x = 0; x < W; x++) {
      if (isTileEligible(x, y, true) && !grid[y][x].volatile) {
        const distFromMid = Math.abs(y - midY);
        singleCandidates.push({ x, y, score: 50 - distFromMid * 5 });
      }
    }
  }

  if (singleCandidates.length > 0) {
    singleCandidates.sort((a, b) => b.score - a.score);
    const pool = singleCandidates.slice(0, Math.min(singleCandidates.length, 12));
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    for (let i = 0; i < Math.min(targetAdditional, pool.length); i++) {
      markVolatile(pool[i].x, pool[i].y);
    }
  }

  return newlyAdded;
}