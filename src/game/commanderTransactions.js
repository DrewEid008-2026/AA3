// Centralized Commander Skill transaction execution. Handles the full
// revalidation → atomic payment → effect initialization → recording pipeline
// for player Commander Skills.
//
// This module is the SINGLE entry point for spending campaign resources on
// Commander Skills. Individual skills never deduct resources directly — they
// declare resourceCosts and the transaction function handles payment.
//
// Enemy Commanders will NOT use this system — they will use a separate Command
// Budget. Both sides reuse the same skill/effect definitions (commanderSkills.js)
// but pay from different pools.

import {
  getCommanderSkill,
  getCommanderSkillCost,
  isValidCommanderTarget,
  canAffordCommanderSkill,
  resolveCommanderSkill,
  COMMANDER_SOURCE_TYPES,
} from './commanderSkills';
import { getUsesRemaining, getCooldownRemaining } from './commanderBattleState';
import { spendCommanderResources, refundCommanderResources } from './persistence';

// Transaction result codes. Used for logging and UI feedback.
export const COMMANDER_TX_RESULT = {
  SUCCESS: 'success',
  INVALID_PHASE: 'invalid_phase',
  COMMANDER_LOCKED: 'commander_locked',
  SKILL_NOT_FOUND: 'skill_not_found',
  SKILL_NOT_UNLOCKED: 'skill_not_unlocked',
  INVALID_TARGET: 'invalid_target',
  UNAFFORDABLE: 'unaffordable',
  DUPLICATE_TX: 'duplicate_tx',
  EFFECT_INIT_FAILED: 'effect_init_failed',
  USES_EXHAUSTED: 'uses_exhausted',
  ON_COOLDOWN: 'on_cooldown',
};

// Generate a unique battle-level transaction ID. Each genuinely new Commander
// command receives a new ID. The same ID may never commit twice.
let txCounter = 0;
export function generateTransactionId() {
  txCounter += 1;
  return `cmd-tx-${Date.now()}-${txCounter}`;
}

// Create a transaction history entry for debugging. Not player-facing.
export function createTransactionHistoryEntry(txId, skillId, cost, missionId, turn, success, failReason) {
  return {
    transactionId: txId,
    skillId,
    cost,
    missionId: missionId || null,
    turn: turn || null,
    success,
    failReason: failReason || null,
    timestamp: Date.now(),
  };
}

// Centralized Commander Skill transaction. Performs full revalidation, atomic
// resource deduction, effect initialization, and returns a result. The caller
// is responsible for:
//   - Action lock (preventing re-entry during async execution)
//   - Recording the transaction in history
//   - Adding the transaction ID to the committed set on success
//   - Refreshing campaign resources and tactical UI
//   - Clearing targeting state
//
// context = {
//   units, grid, GRID_WIDTH, GRID_HEIGHT,     // battle state
//   phase,                                     // 'player' | 'enemy'
//   commanderUnlocked,                         // boolean
//   unlockedSkillIds,                          // string[]
//   campaignResources,                         // { credits, alien_materials, powerCores, nanoCubes }
//   transactionId,                             // unique ID for this activation
//   committedTransactionIds,                   // Set<string> — already committed
//   battleState,                               // { usesRemainingBySkillId, cooldownsBySkillId } — battle-use state
//   sourceType,                                // COMMANDER_SOURCE_TYPES (default PLAYER_COMMANDER)
//   missionId, turn,                            // for history/logging
//   simulateFail,                              // dev: force effect init failure (tests refund)
// }
//
// Returns {
//   ok: boolean,
//   result: COMMANDER_TX_RESULT,
//   transactionId,
//   skillId,
//   cost,
//   resourcesAfter,                            // updated campaign save (on success)
//   message,                                   // user-facing feedback
//   missing,                                   // on UNAFFORDABLE: missing resources
//   isDev,                                     // dev skill flag
// }
export async function executeCommanderSkillTransaction(skillId, target, context) {
  const {
    units, grid, GRID_WIDTH, GRID_HEIGHT,
    phase,
    commanderUnlocked,
    unlockedSkillIds,
    campaignResources,
    transactionId,
    committedTransactionIds,
    missionId, turn,
    simulateFail,
  } = context;

  // 1. Revalidate Player Phase
  if (phase !== 'player') {
    return { ok: false, result: COMMANDER_TX_RESULT.INVALID_PHASE, transactionId, skillId, message: 'COMMAND CANNOT BE EXECUTED — wrong phase' };
  }

  // 2. Revalidate Commander availability
  if (!commanderUnlocked) {
    return { ok: false, result: COMMANDER_TX_RESULT.COMMANDER_LOCKED, transactionId, skillId, message: 'COMMANDER LOCKED' };
  }

  // 3. Revalidate skill availability
  const skill = getCommanderSkill(skillId);
  if (!skill) {
    return { ok: false, result: COMMANDER_TX_RESULT.SKILL_NOT_FOUND, transactionId, skillId, message: 'Unknown skill' };
  }
  if (!Array.isArray(unlockedSkillIds) || !unlockedSkillIds.includes(skillId)) {
    return { ok: false, result: COMMANDER_TX_RESULT.SKILL_NOT_UNLOCKED, transactionId, skillId, message: 'Skill not unlocked' };
  }

  // 4-5. Revalidate target + immunity
  const battleState = { units, grid, GRID_WIDTH, GRID_HEIGHT };
  const targetValidation = isValidCommanderTarget(skillId, target, battleState);
  if (!targetValidation.valid) {
    return { ok: false, result: COMMANDER_TX_RESULT.INVALID_TARGET, transactionId, skillId, message: targetValidation.reason || 'TARGET NO LONGER VALID' };
  }

  // 6. Revalidate uses-per-mission and cooldown (battle-use state)
  if (skill.usesPerMission != null) {
    const uses = getUsesRemaining(context.battleState, skillId);
    if (uses <= 0) {
      return { ok: false, result: COMMANDER_TX_RESULT.USES_EXHAUSTED, transactionId, skillId, message: 'NO USES REMAINING THIS MISSION' };
    }
  }
  if (skill.cooldown != null && skill.cooldown > 0) {
    const cd = getCooldownRemaining(context.battleState, skillId);
    if (cd > 0) {
      return { ok: false, result: COMMANDER_TX_RESULT.ON_COOLDOWN, transactionId, skillId, message: `ON COOLDOWN — ${cd} PHASE${cd !== 1 ? 'S' : ''} REMAINING` };
    }
  }

  // 7. Revalidate affordability
  const affordResult = canAffordCommanderSkill(skillId, campaignResources);
  if (!affordResult.canAfford) {
    return { ok: false, result: COMMANDER_TX_RESULT.UNAFFORDABLE, transactionId, skillId, message: 'INSUFFICIENT RESOURCES', missing: affordResult.missing };
  }

  // 8. Idempotency guard — check transaction ID not already committed
  if (committedTransactionIds && committedTransactionIds.has(transactionId)) {
    return { ok: false, result: COMMANDER_TX_RESULT.DUPLICATE_TX, transactionId, skillId, message: 'DUPLICATE TRANSACTION' };
  }

  // 9-10. Deduct all required resources atomically.
  // spendCommanderResources re-checks affordability (defense in depth) and
  // clamps to 0 — resources can never go negative.
  const cost = getCommanderSkillCost(skillId);
  let resourcesAfter;
  try {
    const spendResult = await spendCommanderResources(cost);
    if (!spendResult.ok) {
      return { ok: false, result: COMMANDER_TX_RESULT.UNAFFORDABLE, transactionId, skillId, message: 'INSUFFICIENT RESOURCES', missing: spendResult.missing };
    }
    resourcesAfter = spendResult.save;
  } catch (e) {
    console.error('[Commander TX] Payment error:', e);
    return { ok: false, result: COMMANDER_TX_RESULT.UNAFFORDABLE, transactionId, skillId, message: 'PAYMENT FAILED' };
  }

  // 11. Initialize/execute the Commander effect.
  // If the effect fails to initialize, REFUND the deducted resources so the
  // player is never charged for a command that didn't execute.
  const sourceType = context.sourceType || COMMANDER_SOURCE_TYPES.PLAYER_COMMANDER;
  const effectContext = { units, grid, GRID_WIDTH, GRID_HEIGHT, sourceType };
  const effectResult = resolveCommanderSkill(skillId, target, effectContext);
  if (!effectResult.ok || simulateFail) {
    // Refund — add resources back atomically.
    try {
      await refundCommanderResources(cost);
    } catch (e) {
      console.error('[Commander TX] Refund error after effect init failure:', e);
    }
    return { ok: false, result: COMMANDER_TX_RESULT.EFFECT_INIT_FAILED, transactionId, skillId, message: 'EFFECT INITIALIZATION FAILED — RESOURCES REFUNDED' };
  }

  // 12. Success — return result. The caller records history, adds the
  // transaction ID to the committed set, refreshes UI, and clears targeting.
  return {
    ok: true,
    result: COMMANDER_TX_RESULT.SUCCESS,
    transactionId,
    skillId,
    cost,
    resourcesAfter,
    message: effectResult.message,
    isDev: effectResult.isDev,
    unitEffect: effectResult.unitEffect || null,
  };
}