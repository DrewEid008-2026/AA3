// Plasma Strike (Artillery) — delayed area-denial hazard. Unlike unit statuses,
// a Plasma Strike is a battlefield tile hazard: it marks a center tile + adjacent
// tiles, gives the player one full Player Phase to react, then detonates at the
// start of the following Enemy Phase.
//
// Damage is flat, ignores cover/flanking, and is deterministic. Center = 5,
// adjacent = 3. For now, only player units are damaged (no alien friendly fire,
// no terrain damage).
//
// The hazard state lives in Battle.jsx as an array of pending strikes. This
// module provides the data + detonation logic so Battle stays thin.

export const PLASMA_STRIKE = {
  radius: 1,
  centerDamage: 5,
  adjacentDamage: 3,
};

let strikeIdCounter = 0;

// Create a pending Plasma Strike hazard at (x, y).
export function createPlasmaStrike(x, y, sourceId) {
  return {
    id: `plasma_${strikeIdCounter++}`,
    x,
    y,
    sourceId,
    radius: PLASMA_STRIKE.radius,
    centerDamage: PLASMA_STRIKE.centerDamage,
    adjacentDamage: PLASMA_STRIKE.adjacentDamage,
  };
}

// All tiles covered by a strike (center + adjacent within Chebyshev radius).
export function getPlasmaStrikeTiles(strike) {
  const tiles = [];
  for (let dy = -strike.radius; dy <= strike.radius; dy++) {
    for (let dx = -strike.radius; dx <= strike.radius; dx++) {
      const x = strike.x + dx;
      const y = strike.y + dy;
      tiles.push({ x, y });
    }
  }
  return tiles;
}

// Set of "x,y" keys for fast lookup (overlay rendering, tile checks).
export function getPlasmaStrikeTileKeys(strike) {
  return new Set(getPlasmaStrikeTiles(strike).map((t) => `${t.x},${t.y}`));
}

// Flat damage for a tile relative to the strike center. Center = centerDamage,
// adjacent = adjacentDamage. Chebyshev distance > radius = 0.
export function plasmaStrikeDamageAt(strike, x, y) {
  const dist = Math.max(Math.abs(x - strike.x), Math.abs(y - strike.y));
  if (dist > strike.radius) return 0;
  return dist === 0 ? strike.centerDamage : strike.adjacentDamage;
}

// Detonate a strike against a set of units. Returns { results, killed } where
// results maps unitId -> { unit, damage, killed, downed }. Only player units
// in the blast area are affected. The caller applies the returned units to state.
// Shield absorption is handled by the caller's damage resolver; this returns the
// raw flat damage per unit so the caller can route through resolveTargetDamage.
export function detonatePlasmaStrike(strike, units) {
  const results = [];
  for (const u of units) {
    if (!u || !u.alive || u.team !== 'player') continue;
    if (u.downed) continue;
    const dmg = plasmaStrikeDamageAt(strike, u.x, u.y);
    if (dmg <= 0) continue;
    results.push({ unitId: u.id, damage: dmg });
  }
  return results;
}