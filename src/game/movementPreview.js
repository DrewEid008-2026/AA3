// Tactical movement preview calculations. All functions are read-only: they
// evaluate the battlefield as if a unit were standing at a hypothetical position
// WITHOUT mutating any game state. The same combat functions used by real
// attacks drive the preview, so "FLANKED 6 DAMAGE" in preview always matches
// the real attack result when no battlefield state has changed.
import { GRID_WIDTH, GRID_HEIGHT } from './constants';
import { getUnitWeapon, computeDamage, gridDistance, hasLineOfSight, edgeHasActiveCover } from './combat';
import { countVolatileInPath, predictHazardDamage, getHazardEventsInPath } from './volatileTiles';

// Compute tactical preview information from a hypothetical destination.
// Returns { targetInfos, rangeTiles, destCover, threatIds, hazardInfo }.
//
// hazardInfo: volatile tile hazard preview for the movement path (spec 19-20).
//   { count, rawDamage, events: [{ pathIndex, x, y, damage }] }
//   `count` = number of volatile tiles crossed
//   `rawDamage` = total predicted environmental damage (before defenses)
//   `events` = per-tile hazard details for the detailed preview
//
// targetInfos: per-enemy combat evaluation from the hypothetical position.
//   { unitId, state: 'exposed'|'covered'|'flanked'|'blocked', damage, killed }
//   Out-of-range enemies are excluded entirely (subdued appearance, no label).
//
// rangeTiles: Set of "x,y" keys within the unit's weapon range from the dest.
//
// destCover: { n, s, e, w } booleans — which sides have active cover at the dest.
//
// threatIds: Set of enemy IDs that have a valid shot (range + LOS) at the dest.
export function computeMovementPreview(grid, units, unit, destination, path) {
  const hyp = { ...unit, x: destination.x, y: destination.y };
  const weapon = getUnitWeapon(unit);

  // --- Hypothetical targeting from the destination ---
  const targetInfos = [];
  for (const enemy of units) {
    if (!enemy.alive || enemy.team === unit.team) continue;
    if (!weapon) continue;
    const inRange = gridDistance(hyp, enemy) <= weapon.range;
    if (!inRange) continue; // out of range — no indicator (subdued appearance)
    const los = hasLineOfSight(grid, hyp, enemy);
    if (!los) {
      targetInfos.push({ unitId: enemy.id, state: 'blocked', damage: 0, killed: false });
      continue;
    }
    const o = computeDamage(hyp, enemy, grid); // same function real attacks use
    targetInfos.push({
      unitId: enemy.id,
      state: o.state, // 'exposed' | 'covered' | 'flanked'
      damage: o.finalDamage,
      killed: o.killed,
      closeRange: o.closeRange, // Marksman close-range penalty active
    });
  }

  // --- Weapon range tiles from the destination ---
  const rangeTiles = new Set();
  if (weapon) {
    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        if (gridDistance({ x: destination.x, y: destination.y }, { x, y }) <= weapon.range) {
          rangeTiles.add(`${x},${y}`);
        }
      }
    }
  }

  // --- Destination directional cover (N/S/E/W) ---
  // Bidirectional: a barrier on an adjacent edge protects the destination
  // occupant regardless of which tile owns the cover entry.
  const destCover = { n: false, s: false, e: false, w: false };
  for (const dir of ['n', 's', 'e', 'w']) {
    destCover[dir] = edgeHasActiveCover(grid, destination.x, destination.y, dir);
  }

  // --- Threat preview: enemies that could attack the soldier at the dest ---
  // Uses current battlefield state only (range + LOS). Does not simulate future
  // enemy movement, abilities, or AI decisions.
  const threatIds = new Set();
  for (const enemy of units) {
    if (!enemy.alive || enemy.team === unit.team) continue;
    const enemyWeapon = getUnitWeapon(enemy);
    if (!enemyWeapon) continue;
    if (gridDistance(enemy, hyp) > enemyWeapon.range) continue;
    if (!hasLineOfSight(grid, enemy, hyp)) continue;
    threatIds.add(enemy.id);
  }

  // --- Volatile Tile hazard preview (spec 19-20) ---
  // Warn the player about volatile tiles in the movement path. Shows the count,
  // total predicted damage, and per-tile events for the detailed preview.
  const hazardInfo = path
    ? {
        count: countVolatileInPath(path, grid),
        rawDamage: predictHazardDamage(path, grid),
        events: getHazardEventsInPath(path, grid),
      }
    : { count: 0, rawDamage: 0, events: [] };

  return { targetInfos, rangeTiles, destCover, threatIds, hazardInfo };
}