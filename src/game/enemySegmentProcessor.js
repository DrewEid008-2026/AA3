// Enemy movement segment processor — extracted from Battle.jsx to keep the
// page file manageable. Handles per-tile reaction processing (mine + Overwatch
// + Pin Down) for enemy movement and Phase Step/Shift. Returns { workGrid,
// work, died } so the caller can cancel queued actions on death.
import { computeDamage, getUnitWeapon } from './combat';
import { collectOverwatchShooters, collectPinDownShooters, resolveTargetDamage } from './enemyPhaseHelpers';
import { consumeAmmo } from './ammo';
import { getWeaponPresentation, getShotTiming, getWeaponVisualProfile } from './attackPresentation';
import { markPinDownFired, hasSkill } from './skillEffects';
import { damageProtectingCover } from './cover';
import { triggerMine } from './engineer';
import { hasFlashReflexes } from './flashReflexes';
import { onUnitEnterTile } from './volatileTiles';

// Factory: takes the shared battle context (state setters, refs, helpers,
// timing constants) and returns the processEnemySegment function bound to
// that context. Called once per runEnemyPhase invocation.
export function createSegmentProcessor(ctx) {
  const {
    minesRef, setUnits, setMines, setHitFlashId, setReactionFlashId,
    setActiveShot, setGrid, setLastReaction, pushPopup, flashAttackFeedback,
    hitTimer, reactionTimer, shotId, sleep, debug,
    REACTION_MS, REACTION_FLASH_MS, HIT_FLASH_MS,
  } = ctx;

  // Process a single tile-entry for a moving unit. When `skipReactions` is true
  // (forced movement like COME HERE!), only tile-entry events (mines, future
  // Volatile Tiles) fire — Overwatch and Pin Down are skipped (spec 18).
  return async function processEnemySegment(workGrid, work, enemyId, nx, ny, isSprint, skipReactions = false) {
    let died = false;
    // Authoritative tile-entry hazard check (spec 2, 8, 9, 10): environmental
    // damage on tile entry. Fires for ALL movement (enemy + forced movement like
    // COME HERE!) before mines and reactions. Armor + Shields apply; Cover does NOT.
    // Flash Reflexes does NOT protect (environmental, not reaction fire). If the
    // unit is downed/killed, movement stops immediately (spec 9).
    const movingUnit = work.find((u) => u.id === enemyId);
    if (movingUnit && movingUnit.alive && !movingUnit.downed) {
      const entry = onUnitEnterTile(workGrid, movingUnit, nx, ny);
      if (entry.hasEffect) {
        work = work.map((u) => (u.id === enemyId ? entry.unit : u));
        setUnits([...work]);
        pushPopup(nx, ny, entry.damage, entry.killed, 'damage');
        if (entry.downed) flashAttackFeedback(nx, ny, 'DOWNED', 'status');
        else flashAttackFeedback(nx, ny, 'VOLATILE', 'status');
        setHitFlashId(enemyId);
        if (hitTimer.current) clearTimeout(hitTimer.current);
        hitTimer.current = setTimeout(() => setHitFlashId(null), HIT_FLASH_MS);
        await sleep(REACTION_MS);
        if (entry.stopped) return { workGrid, work, died: true };
      }
    }
    const mine = minesRef.current.find((m) => m.x === nx && m.y === ny);
    if (mine) {
      const movingUnit = work.find((u) => u.id === enemyId);
      // Friendly Mines (Engineer L8): if the mine owner is on the same team as
      // the moving unit and has the Friendly Mines skill, skip the trigger.
      // This prevents a player being pulled by COME HERE! from triggering their
      // own squad's mines when the Engineer invested in Friendly Mines.
      const owner = work.find((u) => u.id === mine.ownerId);
      const sameTeam = owner && movingUnit && owner.team === movingUnit.team;
      const ownerHasFriendlyMines = owner && hasSkill(owner, 'friendly_mines');
      if (!(sameTeam && ownerHasFriendlyMines)) {
        const r = triggerMine(movingUnit, mine);
        work = work.map((u) => (u.id === enemyId ? r.unit : u));
        setUnits([...work]); setMines((prev) => prev.filter((m) => m.id !== mine.id));
        pushPopup(nx, ny, r.damage, r.killed, 'damage');
        setHitFlashId(enemyId);
        if (hitTimer.current) clearTimeout(hitTimer.current);
        hitTimer.current = setTimeout(() => setHitFlashId(null), HIT_FLASH_MS);
        if (!r.killed) flashAttackFeedback(nx, ny, 'STUNNED', 'status');
        await sleep(REACTION_MS);
        if (r.killed) return { workGrid, work, died: true };
      }
    }
    // Forced movement (COME HERE!) does not trigger Overwatch or Pin Down (spec 18).
    if (skipReactions) return { workGrid, work, died };
    const shotLists = [
      { shooters: collectOverwatchShooters(workGrid, work, enemyId, nx, ny), sprint: isSprint, reaction: true, pin: false },
      { shooters: collectPinDownShooters(workGrid, work, enemyId, nx, ny), sprint: false, reaction: false, pin: true },
    ];
    for (const { shooters, sprint, reaction, pin } of shotLists) {
      for (const shooter of shooters) {
        const t = work.find((u) => u.id === enemyId);
        if (!t || !t.alive) { died = true; break; }
        const simTarget = { ...t, x: nx, y: ny };
        const o = computeDamage(shooter, simTarget, workGrid, { sprint });
        // Flash Reflexes (spec 8-14): Flash Claw takes 0 damage from Overwatch /
        // reaction fire. The reaction still fires, consumes ammo, and consumes
        // the reaction — but HP damage is 0 and NO damage-linked secondary
        // effects (Armor Shred, cover damage, hit-based statuses) are applied.
        // Both Overwatch and Pin Down are reaction-fire sources.
        const evaded = hasFlashReflexes(t) && (reaction || pin);
        const w = getUnitWeapon(shooter);
        const pres = getWeaponPresentation(w); const timing = getShotTiming(pres);
        const prof = getWeaponVisualProfile(w); const sid = ++shotId.current;
        setActiveShot({ id: sid, from: { x: shooter.x, y: shooter.y }, to: { x: nx, y: ny }, presentation: pres, profile: prof, phase: 'travel' });
        await sleep(timing.travel);
        work = work.map((u) => {
          if (u.id === shooter.id) return reaction ? { ...consumeAmmo(u), reaction: null } : consumeAmmo(u);
          if (u.id === enemyId) {
            if (evaded) return u; // Flash Reflexes: no HP change, no state change
            return resolveTargetDamage(u, o.finalDamage).unit;
          }
          return u;
        });
        if (pin) work = work.map((u) => (u.id === shooter.id ? markPinDownFired(u, enemyId) : u));
        setUnits([...work]);
        setActiveShot((prev) => (prev && prev.id === sid ? { ...prev, phase: 'impact' } : prev));
        // Skip cover damage when evaded (Flash Reflexes prevents all secondary effects).
        if (!evaded && o.state === 'covered') { workGrid = damageProtectingCover(workGrid, shooter, simTarget, 1); setGrid(workGrid); }
        if (evaded) {
          flashAttackFeedback(nx, ny, 'FLASH REFLEXES', 'status');
        } else {
          pushPopup(nx, ny, o.finalDamage, o.killed, 'damage');
        }
        setHitFlashId(enemyId); setReactionFlashId(shooter.id);
        if (reactionTimer.current) clearTimeout(reactionTimer.current);
        reactionTimer.current = setTimeout(() => setReactionFlashId(null), REACTION_FLASH_MS);
        if (hitTimer.current) clearTimeout(hitTimer.current);
        hitTimer.current = setTimeout(() => setHitFlashId(null), HIT_FLASH_MS);
        if (debug) setLastReaction({ shooter: shooter.name, tile: `${nx},${ny}`, state: o.state, sprint, damage: evaded ? 0 : o.finalDamage, killed: evaded ? false : o.killed, evaded });
        await sleep(timing.impact); setActiveShot(null);
        if (!(work.find((u) => u.id === enemyId)?.alive)) { died = true; break; }
      }
      if (died) break;
    }
    return { workGrid, work, died };
  };
}