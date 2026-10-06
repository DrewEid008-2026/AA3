// TREMOR SLAM — The Harvester's delayed 3×3 area attack.
//
// When cast during the Enemy Phase, the Harvester selects a 3×3 area and marks
// every tile with a highly visible warning. The player gets one full Player
// Phase to vacate the area. At the beginning of the following Enemy Phase,
// the slam resolves:
//   - 4 ENVIRONMENTAL damage to player units still inside (ignores Armor,
//     Cover, Exposed, Flanked — pure environmental).
//   - 6 TERRAIN damage to normal destructible Cover inside the area.
//   - CANNOT destroy Siege-destructible map tiles (no Siege permission).
//
// Only ONE major Harvester hazard may be pending at a time (Tremor OR Beam).
// The hazard state lives in Battle.jsx; this module provides data + detonation.

import { GRID_WIDTH, GRID_HEIGHT } from './constants';
import { TEAMS } from './constants';
import { damageCoverTile } from './cover';

export const TREMOR = {
  damage: 4,        // environmental — ignores armor + cover
  terrainDamage: 6, // to normal destructible cover
  cooldown: 3,
  apCost: 1,
};

let tremorIdCounter = 0;

// Create a pending Tremor Slam hazard centered on (cx, cy).
export function createTremorSlam(cx, cy, sourceId, castRound) {
  return {
    id: `tremor_${tremorIdCounter++}`,
    centerX: cx,
    centerY: cy,
    sourceId,
    castRound,
    detonationEnemyPhase: castRound + 1,
    damage: TREMOR.damage,
    terrainDamage: TREMOR.terrainDamage,
    resolved: false,
  };
}

// All 9 tiles in the 3×3 area around the center. Bounds-clamped.
export function getTremorTiles(tremor) {
  const tiles = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = tremor.centerX + dx;
      const y = tremor.centerY + dy;
      if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) continue;
      tiles.push({ x, y });
    }
  }
  return tiles;
}

// Set of "x,y" keys for fast lookup (overlay rendering, tile checks).
export function getTremorTileKeys(tremor) {
  return new Set(getTremorTiles(tremor).map((t) => `${t.x},${t.y}`));
}

// Detonate a Tremor Slam against units. Returns [{ unitId, x, y, damage }] for
// every living, non-downed player soldier inside the 3×3 area. Environmental
// damage — the caller applies it directly to HP (no armor, no cover).
export function detonateTremorSlam(tremor, units) {
  const keys = getTremorTileKeys(tremor);
  const hits = [];
  for (const u of units) {
    if (!u || !u.alive || u.team !== TEAMS.PLAYER) continue;
    if (u.downed) continue;
    if (keys.has(`${u.x},${u.y}`)) {
      hits.push({ unitId: u.id, x: u.x, y: u.y, damage: TREMOR.damage });
    }
  }
  return hits;
}

// Apply Tremor Slam terrain damage to the grid. Deals 6 damage to every normal
// destructible cover side on every tile in the 3×3 area. Does NOT destroy
// Siege-destructible map tiles (no tile destruction permission). Returns
// { grid, destroyedCount } — the new grid and how many cover sides were
// destroyed by this detonation.
export function detonateTremorTerrain(tremor, grid) {
  const tiles = getTremorTiles(tremor);
  let g = grid;
  let destroyedCount = 0;
  for (const t of tiles) {
    const before = g;
    g = damageCoverTile(g, t.x, t.y, TREMOR.terrainDamage);
    // Count newly destroyed cover sides (damageCoverTile sets destroyed=true).
    if (g !== before) {
      const afterTile = g[t.y][t.x];
      for (const d of ['n', 's', 'e', 'w']) {
        const ac = afterTile.cover[d];
        if (ac && ac.destroyed && ac.hp <= 0) {
          // Only count if it just crossed (hp after == terrainDamage and was > 0 before).
          // damageCoverTile reduces by amount; destroyed when hp <= 0.
          const beforeSide = before[t.y][t.x].cover[d];
          if (beforeSide && !beforeSide.destroyed) destroyedCount++;
        }
      }
    }
  }
  return { grid: g, destroyedCount };
}