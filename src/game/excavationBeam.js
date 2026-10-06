// EXCAVATION BEAM — The Harvester's delayed straight-line cutting attack.
//
// When cast during the Enemy Phase, the Harvester selects a full row OR column
// and marks every tile with a highly visible warning. The player gets one full
// Player Phase to reposition. At the beginning of the following Enemy Phase,
// the beam resolves:
//   - 5 DIRECT ENERGY damage to player units on the line. Armor applies,
//     Shields apply. Cover reduction is IGNORED (the beam cuts through the
//     entire line — no Covered ×0.5).
//   - 8 TERRAIN damage to every normal destructible Cover on the line.
//   - CANNOT destroy Siege-destructible map tiles (no Siege permission).
//
// This is distinct from the Warden's Beam Sweep (precision command energy).
// The Excavation Beam is an industrial cutting tool — its identity is carving
// through normal battlefield cover.
//
// Only ONE major Harvester hazard may be pending at a time (Tremor OR Beam).

import { GRID_WIDTH, GRID_HEIGHT } from './constants';
import { TEAMS } from './constants';
import { damageCoverTile } from './cover';
import { getCurrentArmor } from './armorShred';

export const EXCAVATION_BEAM = {
  damage: 5,         // direct energy — armor applies, cover reduction ignored
  terrainDamage: 8,  // to normal destructible cover
  cooldown: 3,
  apCost: 1,
};

let beamIdCounter = 0;

// Create a pending Excavation Beam hazard.
// orientation: 'row' (horizontal, sweeps across Y) or 'column' (vertical, X).
// index: the row Y (0..13) or column X (0..8).
export function createExcavationBeam(orientation, index, sourceId, castRound) {
  return {
    id: `excavbeam_${beamIdCounter++}`,
    orientation,
    index,
    sourceId,
    castRound,
    detonationEnemyPhase: castRound + 1,
    damage: EXCAVATION_BEAM.damage,
    terrainDamage: EXCAVATION_BEAM.terrainDamage,
    resolved: false,
  };
}

// All tiles covered by the beam. Row → every tile (0..8, index).
// Column → every tile (index, 0..13).
export function getBeamTiles(beam) {
  const tiles = [];
  if (beam.orientation === 'row') {
    for (let x = 0; x < GRID_WIDTH; x++) tiles.push({ x, y: beam.index });
  } else {
    for (let y = 0; y < GRID_HEIGHT; y++) tiles.push({ x: beam.index, y });
  }
  return tiles;
}

// Set of "x,y" keys for fast lookup (overlay rendering, tile checks).
export function getBeamTileKeys(beam) {
  return new Set(getBeamTiles(beam).map((t) => `${t.x},${t.y}`));
}

// Detonate an Excavation Beam against units. Returns [{ unitId, x, y, damage,
// armor }] for every living, non-downed player soldier on the line. The damage
// is the flat 5 — the caller applies armor + shields + HP via
// resolveFlatDamage + resolveTargetDamage (armor applies, cover ignored).
export function detonateExcavationBeam(beam, units) {
  const keys = getBeamTileKeys(beam);
  const hits = [];
  for (const u of units) {
    if (!u || !u.alive || u.team !== TEAMS.PLAYER) continue;
    if (u.downed) continue;
    if (keys.has(`${u.x},${u.y}`)) {
      hits.push({
        unitId: u.id,
        x: u.x,
        y: u.y,
        damage: EXCAVATION_BEAM.damage,
        armor: getCurrentArmor(u),
      });
    }
  }
  return hits;
}

// Apply Excavation Beam terrain damage to the grid. Deals 8 damage to every
// normal destructible cover side on every tile on the line. Does NOT destroy
// Siege-destructible map tiles. Returns { grid, destroyedCount }.
export function detonateBeamTerrain(beam, grid) {
  const tiles = getBeamTiles(beam);
  let g = grid;
  let destroyedCount = 0;
  for (const t of tiles) {
    const before = g;
    g = damageCoverTile(g, t.x, t.y, EXCAVATION_BEAM.terrainDamage);
    if (g !== before) {
      const afterTile = g[t.y][t.x];
      for (const d of ['n', 's', 'e', 'w']) {
        const ac = afterTile.cover[d];
        if (ac && ac.destroyed && ac.hp <= 0) {
          const beforeSide = before[t.y][t.x].cover[d];
          if (beforeSide && !beforeSide.destroyed) destroyedCount++;
        }
      }
    }
  }
  return { grid: g, destroyedCount };
}