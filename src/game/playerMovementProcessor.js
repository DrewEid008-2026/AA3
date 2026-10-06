// Player movement volatile-tile processor (Implementation 3.4.5).
//
// Extracted from Battle.jsx to keep that file under the size limit and to
// centralize the per-tile Volatile Tile hazard processing for player movement.
// The enemy side is handled by enemySegmentProcessor.js; this module handles
// the player side (normal Move, Dash, Relocate / Hit and Run).
//
// The processor animates the unit tile-by-tile along its path. At each volatile
// tile, it applies environmental damage (Armor + Shields apply, Cover does NOT).
// If the unit is downed or killed, movement stops immediately at that tile
// (spec 10-11) — the unit does not continue through remaining tiles.

import { animateSegment } from './battleAnimation';
import { onUnitEnterTile } from './volatileTiles';

// Factory: takes the shared battle context (token refs, feedback helpers,
// timing constants) and returns an async `processPlayerPath` function.
export function createPlayerMovementProcessor(ctx) {
  const {
    tokenRefs, setUnits, pushPopup, flashAttackFeedback,
    setHitFlashId, hitTimer, sleep,
    HIT_FLASH_MS, REACTION_MS, MOVE_PER_SEG = 85,
  } = ctx;

  // Process a player unit's movement path tile-by-tile, applying volatile tile
  // damage at each step. Returns { finalX, finalY, stoppedEarly, tilesTraversed,
  // downed, killed }.
  //
  // `unit` — the unit as it exists BEFORE the move (AP not yet spent).
  // `path` — array of [x, y] pairs (including the start tile).
  // `grid` — the current battlefield grid (read-only for volatile checks).
  //
  // The caller is responsible for:
  //   - Spending AP / setting cooldowns
  //   - Applying onPlayerMove, resetSustainedFire, withBurning, clearLineUp
  //   - Updating civilian escort position
  //   - Setting `moving` state
  //
  // This function ONLY handles animation + volatile damage. It updates unit
  // state (HP, downed, alive) via setUnits as it goes so the player sees damage
  // apply at each volatile tile.
  return async function processPlayerPath(unit, path, grid) {
    if (!unit || !path || path.length < 2) {
      return { finalX: unit?.x, finalY: unit?.y, stoppedEarly: false, tilesTraversed: 0, downed: false, killed: false };
    }

    const el = tokenRefs.current[unit.id];
    let currentUnit = unit;
    let stoppedEarly = false;
    let downed = false;
    let killed = false;
    let tilesTraversed = 0;
    let lastX = unit.x;
    let lastY = unit.y;

    for (let i = 1; i < path.length && !stoppedEarly; i++) {
      const [px, py] = path[i - 1];
      const [nx, ny] = path[i];

      // Animate this segment.
      await animateSegment(el, px, py, nx, ny, MOVE_PER_SEG);

      // Update the unit's position in state (so popups/feedback align).
      currentUnit = { ...currentUnit, x: nx, y: ny };
      lastX = nx;
      lastY = ny;
      tilesTraversed++;

      // Authoritative tile-entry hazard check (spec 2, 9).
      const entry = onUnitEnterTile(grid, currentUnit, nx, ny);
      if (entry.hasEffect) {
        currentUnit = entry.unit;

        // Update unit state immediately so the player sees the damage.
        setUnits((prev) => prev.map((u) => (u.id === unit.id ? currentUnit : u)));

        // Feedback: damage popup + hazard label + hit flash.
        pushPopup(nx, ny, entry.damage, entry.killed, 'damage');
        if (entry.downed) flashAttackFeedback(nx, ny, 'DOWNED', 'status');
        else flashAttackFeedback(nx, ny, 'VOLATILE', 'status');
        setHitFlashId(unit.id);
        if (hitTimer.current) clearTimeout(hitTimer.current);
        hitTimer.current = setTimeout(() => setHitFlashId(null), HIT_FLASH_MS);

        // Brief pause so the player can read the hazard event.
        await sleep(REACTION_MS);

        // Stop movement immediately if downed or killed (spec 9).
        if (entry.stopped) {
          downed = entry.downed;
          killed = entry.killed;
          stoppedEarly = true;
        }
      }
    }

    return { finalX: lastX, finalY: lastY, stoppedEarly, tilesTraversed, downed, killed, finalUnit: currentUnit };
  };
}