// Shared Burning action-completion hooks for the player and enemy phases.
// Extracted from Battle.jsx so both phases share one implementation and the
// page file stays manageable. The factory receives the UI/timing bindings the
// caller already owns; the returned functions are drop-in replacements for the
// former inline `withBurning` / `applyEnemyBurning`.
import { applyActionCompletion } from './statuses';

export function createBurningHooks(ctx) {
  const {
    pushPopup, setHitFlashId, hitTimer, HIT_FLASH_MS, flashAttackFeedback,
  } = ctx;

  // Player-phase Burning hook: given the post-action unit snapshot, applies
  // Burning damage and fires the burn popup + hit flash. `fxX/fxY` overrides
  // the popup tile. Returns the final unit.
  function withBurning(postActionUnit, fxX, fxY) {
    const burn = applyActionCompletion(postActionUnit);
    if (burn.damage > 0) {
      pushPopup(fxX ?? postActionUnit.x, fxY ?? postActionUnit.y, burn.damage, burn.died, 'burn');
      if (burn.died || burn.downed) {
        setHitFlashId(postActionUnit.id);
        if (hitTimer.current) clearTimeout(hitTimer.current);
        hitTimer.current = setTimeout(() => setHitFlashId(null), HIT_FLASH_MS);
      }
      if (burn.downed) {
        flashAttackFeedback(fxX ?? postActionUnit.x, fxY ?? postActionUnit.y, 'DOWNED', 'status');
      }
    }
    return burn.unit;
  }

  // Enemy-phase Burning hook: applied to the working `work` array. Returns
  // { work, died } so the enemy loop can cancel queued actions on death.
  function applyEnemyBurning(work, enemyId) {
    const e = work.find((u) => u.id === enemyId);
    if (!e) return { work, died: false };
    const burn = applyActionCompletion(e);
    if (burn.damage <= 0) return { work, died: false };
    const next = work.map((u) => (u.id === enemyId ? burn.unit : u));
    pushPopup(e.x, e.y, burn.damage, burn.died, 'burn');
    if (burn.died) {
      setHitFlashId(enemyId);
      if (hitTimer.current) clearTimeout(hitTimer.current);
      hitTimer.current = setTimeout(() => setHitFlashId(null), HIT_FLASH_MS);
    }
    return { work: next, died: burn.died };
  }

  return { withBurning, applyEnemyBurning };
}