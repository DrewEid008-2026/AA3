// Beam Sweep (Warden Prime) — delayed full-lane energy attack. Unlike Plasma
// Strike (area blast), Beam Sweep targets an entire row OR column across the
// 9×14 grid. When cast, it marks every tile in the lane with a highly visible
// warning. The player gets one full Player Phase to react. At the beginning of
// the following Enemy Phase, the sweep fires: 6 damage to every player soldier
// occupying an affected tile.
//
// Damage rules: ignores Cover (the beam passes through the entire lane). Armor
// DOES apply. Shields apply normally. Deterministic. This is NOT environmental
// damage — it is a direct energy weapon attack.
//
// Only ONE Beam Sweep can be pending at a time. The Warden cannot cast another
// until the previous one fires and the cooldown allows it.
//
// The hazard state lives in Battle.jsx as an array of pending sweeps. This
// module provides the data + detonation logic so Battle stays thin.

import { GRID_WIDTH, GRID_HEIGHT } from './constants';

export const BEAM_SWEEP = {
  damage: 6,
  cooldown: 3,
  apCost: 1,
};

let sweepIdCounter = 0;

// Create a pending Beam Sweep hazard.
// orientation: 'row' (sweeps horizontal across a Y row) or 'column' (sweeps
// vertical across an X column).
// index: the row Y (0..13) or column X (0..8) to sweep.
// sourceId: the Warden's unit id (for attribution).
// castRound: the turn number when the sweep was cast.
export function createBeamSweep(orientation, index, sourceId, castRound) {
  return {
    id: `sweep_${sweepIdCounter++}`,
    orientation,
    index,
    sourceId,
    castRound,
    detonationEnemyPhase: castRound + 1,
    damage: BEAM_SWEEP.damage,
    resolved: false,
  };
}

// All tiles covered by a sweep. For a row sweep, every tile (0..8, index).
// For a column sweep, every tile (index, 0..13).
export function getBeamSweepTiles(sweep) {
  const tiles = [];
  if (sweep.orientation === 'row') {
    for (let x = 0; x < GRID_WIDTH; x++) tiles.push({ x, y: sweep.index });
  } else {
    for (let y = 0; y < GRID_HEIGHT; y++) tiles.push({ x: sweep.index, y });
  }
  return tiles;
}

// Set of "x,y" keys for fast lookup (overlay rendering, tile checks).
export function getBeamSweepTileKeys(sweep) {
  return new Set(getBeamSweepTiles(sweep).map((t) => `${t.x},${t.y}`));
}

// Detonate a sweep against a set of units. Returns [{ unitId, damage }] for
// every living, non-downed player soldier occupying an affected tile. The
// caller applies armor + shields + HP via resolveFlatDamage + resolveTargetDamage.
export function detonateBeamSweep(sweep, units) {
  const keys = getBeamSweepTileKeys(sweep);
  const results = [];
  for (const u of units) {
    if (!u || !u.alive || u.team !== 'player') continue;
    if (u.downed) continue;
    if (keys.has(`${u.x},${u.y}`)) {
      results.push({ unitId: u.id, damage: sweep.damage });
    }
  }
  return results;
}