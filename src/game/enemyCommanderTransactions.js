// Centralized Enemy Commander Skill transaction execution. The SINGLE entry
// point for spending the mission-local Command Budget on enemy Commander
// commands. Mirrors the player's commanderTransactions.js but pays from the
// Command Budget instead of campaign resources.
//
// Design:
//   - Synchronous (budget is in-memory, not a DB write)
//   - Atomic: validate → spend → resolve → update state in one step
//   - Idempotent: transaction IDs prevent duplicate execution
//   - No partial spend: if budget < cost, command fails and budget is untouched
//   - Failed effect → no budget spent (refund by not committing nextState)
//
// Enemy Commanders do NOT use executeCommanderSkillTransaction (player system).
// Both sides reuse the same skill definitions (commanderSkills.js) and target
// validation (isValidCommanderTarget), but pay from different pools.

import {
  getCommanderSkill,
  isValidCommanderTarget,
  isEnemyCommanderSkill,
  getEnemyCommandPointCost,
  getCommanderAffectedArea,
  COMMANDER_TIMING_TYPES,
  resolveCommanderSkill,
} from './commanderSkills';
import { COMMANDER_SOURCE_TYPES } from './commanderBattleState';
import {
  canSpendCommandPoints,
  spendCommandPoints,
  canIssueCommandThisPhase,
  recordCommandIssued,
  getEnemyUsesRemaining,
  getEnemyCooldownRemaining,
  decrementEnemyUses,
  setEnemyCooldown,
  addEnemyPendingEffect,
  createEnemyPendingEffect,
  addDevMarked,
} from './enemyCommanderBattleState';

// Transaction result codes — used for logging, debug inspection, and UI.
export const ENEMY_COMMANDER_TX_RESULT = {
  SUCCESS: 'success',
  NO_COMMANDER: 'no_commander',
  WRONG_PHASE: 'wrong_phase',
  SKILL_NOT_FOUND: 'skill_not_found',
  SKILL_NOT_AVAILABLE: 'skill_not_available',
  SKILL_NOT_IN_PROFILE: 'skill_not_in_profile',
  PHASE_LIMIT_REACHED: 'phase_limit_reached',
  USES_EXHAUSTED: 'uses_exhausted',
  ON_COOLDOWN: 'on_cooldown',
  INVALID_TARGET: 'invalid_target',
  INSUFFICIENT_BUDGET: 'insufficient_budget',
  DUPLICATE_TX: 'duplicate_tx',
  EFFECT_FAILED: 'effect_failed',
};

// Generate a unique enemy Commander transaction ID. Each genuinely new command
// receives a new ID. The same ID may never commit twice (idempotency guard).
let txCounter = 0;
export function generateEnemyTransactionId() {
  txCounter += 1;
  return `enemy-cmd-tx-${Date.now()}-${txCounter}`;
}

// Centralized Enemy Commander Skill transaction.
//
// context = {
//   profile,                                    // enemy commander profile
//   battleState,                                 // enemy commander battle state (budget, uses, cooldowns)
//   units, grid, GRID_WIDTH, GRID_HEIGHT,        // current battlefield state
//   phase,                                       // 'player' | 'enemy'
//   committedTransactionIds,                      // Set<string> — already committed
//   transactionId,                               // unique ID for this activation
//   sourceType,                                   // COMMANDER_SOURCE_TYPES (default ENEMY_COMMANDER)
//   allowAnyPhase,                                // debug: skip phase check
// }
//
// Returns {
//   ok: boolean,
//   result: ENEMY_COMMANDER_TX_RESULT,
//   transactionId,
//   skillId,
//   cost,                                         // command points spent (on success)
//   battleStateAfter,                             // updated battle state (on success)
//   message,                                      // effect message (on success)
//   target,                                       // the target that was used
//   sourceType,
// }
export function executeEnemyCommanderSkillTransaction(skillId, target, context) {
  const {
    profile,
    battleState,
    units,
    grid,
    GRID_WIDTH,
    GRID_HEIGHT,
    phase,
    committedTransactionIds,
    transactionId,
    allowAnyPhase = false,
  } = context;

  const fail = (result, message) => ({
    ok: false, result, transactionId, skillId, message: message || '',
  });

  // 1. Verify hostile Commander exists
  if (!profile || !battleState) {
    return fail(ENEMY_COMMANDER_TX_RESULT.NO_COMMANDER, 'No hostile commander');
  }

  // 2. Verify Enemy Phase (unless debug override)
  if (!allowAnyPhase && phase !== 'enemy') {
    return fail(ENEMY_COMMANDER_TX_RESULT.WRONG_PHASE, 'Not Enemy Phase');
  }

  // 5. Verify skill belongs to Commander profile
  const skill = getCommanderSkill(skillId);
  if (!skill) {
    return fail(ENEMY_COMMANDER_TX_RESULT.SKILL_NOT_FOUND, 'Unknown skill');
  }
  if (!profile.skillIds || !profile.skillIds.includes(skillId)) {
    return fail(ENEMY_COMMANDER_TX_RESULT.SKILL_NOT_IN_PROFILE, 'Skill not in commander profile');
  }

  // 6. Verify enemyAvailable = true
  if (!isEnemyCommanderSkill(skillId)) {
    return fail(ENEMY_COMMANDER_TX_RESULT.SKILL_NOT_AVAILABLE, 'Skill not available to enemy commanders');
  }

  const cost = getEnemyCommandPointCost(skillId);

  // 4. Verify max commands per phase + budget (combined check)
  if (!canIssueCommandThisPhase(battleState, profile, cost)) {
    if (battleState.commandsUsedThisEnemyPhase >= (profile.maxCommandsPerEnemyPhase ?? 1)) {
      return fail(ENEMY_COMMANDER_TX_RESULT.PHASE_LIMIT_REACHED, 'Phase command limit reached');
    }
    return fail(ENEMY_COMMANDER_TX_RESULT.INSUFFICIENT_BUDGET, 'Insufficient Command Budget');
  }

  // 7. Verify uses remaining
  const usesLeft = getEnemyUsesRemaining(battleState, skillId);
  if (usesLeft <= 0) {
    return fail(ENEMY_COMMANDER_TX_RESULT.USES_EXHAUSTED, 'No uses remaining');
  }

  // 8. Verify cooldown
  const cdLeft = getEnemyCooldownRemaining(battleState, skillId);
  if (cdLeft > 0) {
    return fail(ENEMY_COMMANDER_TX_RESULT.ON_COOLDOWN, `Cooldown: ${cdLeft}`);
  }

  // 9-10. Verify target validity + immunity (shared validation)
  const validationBattleState = { units, grid, GRID_WIDTH, GRID_HEIGHT };
  const targetCheck = isValidCommanderTarget(skillId, target, validationBattleState);
  if (!targetCheck.valid) {
    return fail(ENEMY_COMMANDER_TX_RESULT.INVALID_TARGET, targetCheck.reason || 'Invalid target');
  }

  // 11. Verify Command Budget (defense in depth)
  if (!canSpendCommandPoints(battleState, cost)) {
    return fail(ENEMY_COMMANDER_TX_RESULT.INSUFFICIENT_BUDGET, 'Insufficient Command Budget');
  }

  // 12. Idempotency guard — check transaction ID not already committed
  if (committedTransactionIds && transactionId && committedTransactionIds.has(transactionId)) {
    return fail(ENEMY_COMMANDER_TX_RESULT.DUPLICATE_TX, 'Duplicate transaction');
  }

  // 14. Spend Command Budget atomically. spendCommandPoints returns null if
  // insufficient (no partial spend). The original battleState is untouched on
  // failure — nextState is only committed on full success.
  let nextState = spendCommandPoints(battleState, cost);
  if (!nextState) {
    return fail(ENEMY_COMMANDER_TX_RESULT.INSUFFICIENT_BUDGET, 'Budget spend failed');
  }

  // 15. Resolve or schedule the effect. If the effect fails to initialize,
  // do NOT commit nextState — the original battleState (with full budget) is
  // returned to the caller. No refund needed because nextState was never
  // committed; the caller keeps the original state.
  const sourceType = context.sourceType || COMMANDER_SOURCE_TYPES.ENEMY_COMMANDER;
  const effectContext = {
    units,
    grid,
    GRID_WIDTH,
    GRID_HEIGHT,
    sourceType,
    sourceCommanderId: profile.commanderId,
  };
  const effectResult = resolveCommanderSkill(skillId, target, effectContext);
  if (!effectResult.ok) {
    return fail(ENEMY_COMMANDER_TX_RESULT.EFFECT_FAILED, 'Effect initialization failed');
  }

  // 16. Decrement uses (only on successful commit)
  nextState = decrementEnemyUses(nextState, skillId);
  // 17. Start cooldown
  nextState = setEnemyCooldown(nextState, skillId);
  // 18. Increment commandsUsedThisEnemyPhase
  nextState = recordCommandIssued(nextState);
  // Track the active transaction ID (for save/load safety)
  nextState = { ...nextState, activeTransactionId: transactionId };

  // 18b. Dev-mark tracking: DEV_ENEMY_MARK records the target so the AI avoids
  // re-targeting the same soldier (duplicate-status avoidance). Harmless — no
  // gameplay status is applied; purely for AI testing.
  if (skillId === 'DEV_ENEMY_MARK' && target?.kind === 'unit' && target.unitId) {
    nextState = addDevMarked(nextState, target.unitId);
  }

  // Delayed effect: create a pending effect entry. The effect is stored with
  // its exact target/area and will resolve later. Budget is NOT refunded —
  // the command was successfully issued, just delayed.
  if (skill.timingType === COMMANDER_TIMING_TYPES.DELAYED) {
    let affectedTiles = [];
    if (target?.kind === 'tile') {
      affectedTiles = getCommanderAffectedArea(skillId, target.x, target.y, GRID_WIDTH, GRID_HEIGHT);
    }
    const effect = createEnemyPendingEffect({
      skillId,
      sourceCommanderId: profile.commanderId,
      target,
      affectedTiles,
      resolveTiming: null, // future: define when delayed enemy effects resolve
      transactionId,
      effectData: effectResult,
    });
    nextState = addEnemyPendingEffect(nextState, effect);
  }

  // 19-20. Success — return the updated battle state. The caller commits it
  // to React state, records the transaction ID, refreshes UI, and shows the
  // command banner. unitEffect (when present) is applied to game units by the
  // caller via setUnits — the transaction only owns the Command Budget.
  return {
    ok: true,
    result: ENEMY_COMMANDER_TX_RESULT.SUCCESS,
    transactionId,
    skillId,
    cost,
    battleStateAfter: nextState,
    message: effectResult.message,
    unitEffect: effectResult.unitEffect || null,
    target,
    sourceType,
  };
}