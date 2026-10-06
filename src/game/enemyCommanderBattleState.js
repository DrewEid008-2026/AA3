// Enemy Commander battle-local state: Command Budget, uses-per-mission,
// cooldowns, per-phase command count, and pending delayed effects. Fully
// separate from player campaign resources — enemy Commanders pay from a
// mission-local Command Budget that never touches Credits, Alien Materials,
// Power Cores, or Nano Cubes.
//
// This state is TRANSIENT and MISSION-LOCAL:
//   - created at mission start from the commander profile
//   - mutated during battle (budget spend, cooldown tick, command count)
//   - discarded on mission end
//   - saved to the campaign blob mid-mission so save/load preserves the budget
//   - reset to full on mission restart (unlike save/load, which restores)
//
// Cooldown interpretation mirrors the player system: cooldown = number of
// future Enemy Phases before reuse. A skill with cooldown: 2 used on Enemy
// Phase 1 is ready on Enemy Phase 4 (ticks on EP 2 and EP 3).

import { getCommanderSkill } from './commanderSkills';
import { COMMANDER_SOURCE_TYPES } from './commanderBattleState';
import { readActiveCampaign, writeActiveCampaign } from './saveSlots';

// localStorage field on the campaign blob for the active enemy Commander
// battle-state snapshot. Single-field — only one mission is active at a time.
const EC_BATTLE_STATE_FIELD = 'enemyCommanderBattleState';

// --- State creation ---

// Create the initial enemy Commander battle state from a profile. Budget is
// set to the profile's commandBudget (max = commandBudget). Uses and cooldowns
// are seeded from the profile's known skills.
export function createEnemyCommanderBattleState(profile) {
  if (!profile) return null;
  const usesRemainingBySkillId = {};
  const cooldownsBySkillId = {};
  for (const id of profile.skillIds || []) {
    const skill = getCommanderSkill(id);
    if (!skill) continue;
    if (skill.usesPerMission != null) {
      usesRemainingBySkillId[id] = skill.usesPerMission;
    }
    cooldownsBySkillId[id] = 0;
  }
  return {
    commanderId: profile.commanderId,
    commandBudgetCurrent: profile.commandBudget,
    commandBudgetMax: profile.commandBudget,
    commandsUsedThisEnemyPhase: 0,
    usesRemainingBySkillId,
    cooldownsBySkillId,
    pendingCommanderEffects: [],
    activeTransactionId: null,
    // Dev-only: tracks which player soldiers have been "test-marked" by
    // DEV_ENEMY_MARK, so the AI can avoid re-targeting them (duplicate-status
    // avoidance). Not a real game status — purely for AI testing.
    devMarkedUnitIds: [],
  };
}

// Full reset to mission-start state. Used by the restart flow — restores full
// budget, full uses, zero cooldowns, no pending effects. This is distinct from
// save/load (which restores the saved mid-mission state).
export function resetEnemyCommanderBattleState(profile) {
  return createEnemyCommanderBattleState(profile);
}

// --- Budget queries ---

export function getCommandBudgetCurrent(state) {
  return state ? state.commandBudgetCurrent : 0;
}

export function getCommandBudgetMax(state) {
  return state ? state.commandBudgetMax : 0;
}

// Can the commander afford `amount` command points right now?
export function canSpendCommandPoints(state, amount) {
  if (!state) return false;
  return state.commandBudgetCurrent >= amount;
}

// Spend `amount` command points. Returns a new state, or null if the budget
// is insufficient (no partial spend). Never produces negative budget.
export function spendCommandPoints(state, amount) {
  if (!state || !canSpendCommandPoints(state, amount)) return null;
  return {
    ...state,
    commandBudgetCurrent: Math.max(0, state.commandBudgetCurrent - amount),
  };
}

// --- Per-phase command limit ---

export function getCommandsUsedThisPhase(state) {
  return state ? state.commandsUsedThisEnemyPhase : 0;
}

// Can the commander issue another command this Enemy Phase? Checks both the
// per-phase limit (from the profile) and the remaining budget.
export function canIssueCommandThisPhase(state, profile, commandPointCost = 1) {
  if (!state || !profile) return false;
  if (profile.maxCommandsPerEnemyPhase != null) {
    if (state.commandsUsedThisEnemyPhase >= profile.maxCommandsPerEnemyPhase) return false;
  }
  return canSpendCommandPoints(state, commandPointCost);
}

// Record that a command was issued this Enemy Phase. Increments the counter
// and is combined with spendCommandPoints by the caller.
export function recordCommandIssued(state) {
  if (!state) return state;
  return { ...state, commandsUsedThisEnemyPhase: state.commandsUsedThisEnemyPhase + 1 };
}

// Reset the per-phase command counter. Called at the start of each Enemy Phase.
export function resetPhaseCommandCount(state) {
  if (!state) return state;
  if (state.commandsUsedThisEnemyPhase === 0) return state;
  return { ...state, commandsUsedThisEnemyPhase: 0 };
}

// --- Uses-per-mission + cooldowns (mirror the player system) ---

export function getEnemyUsesRemaining(state, skillId) {
  if (!state) return Infinity;
  const skill = getCommanderSkill(skillId);
  if (!skill || skill.usesPerMission == null) return Infinity;
  return state.usesRemainingBySkillId?.[skillId] ?? skill.usesPerMission;
}

export function getEnemyCooldownRemaining(state, skillId) {
  if (!state) return 0;
  return state.cooldownsBySkillId?.[skillId] ?? 0;
}

export function decrementEnemyUses(state, skillId) {
  if (!state) return state;
  const skill = getCommanderSkill(skillId);
  if (!skill || skill.usesPerMission == null) return state;
  const current = state.usesRemainingBySkillId?.[skillId] ?? skill.usesPerMission;
  return {
    ...state,
    usesRemainingBySkillId: {
      ...state.usesRemainingBySkillId,
      [skillId]: Math.max(0, current - 1),
    },
  };
}

export function setEnemyCooldown(state, skillId) {
  if (!state) return state;
  const skill = getCommanderSkill(skillId);
  if (!skill || skill.cooldown == null || skill.cooldown <= 0) return state;
  return {
    ...state,
    cooldownsBySkillId: {
      ...state.cooldownsBySkillId,
      [skillId]: skill.cooldown,
    },
  };
}

// Tick all cooldowns down by 1 (floored at 0). Called at the start of each
// Enemy Phase after the first.
export function tickEnemyCooldowns(state) {
  if (!state) return state;
  const next = {};
  for (const [id, cd] of Object.entries(state.cooldownsBySkillId || {})) {
    next[id] = Math.max(0, cd - 1);
  }
  return { ...state, cooldownsBySkillId: next };
}

// --- Pending effects (delayed-effect architecture, shared with player system) ---

// Create a pending delayed-effect entry for an enemy Commander command. Stores
// the source type, source commander ID, skill, target, affected tiles, and
// resolve timing so the effect can be safely resolved later without
// re-executing or refunding the budget.
export function createEnemyPendingEffect({
  effectId,
  skillId,
  sourceCommanderId,
  target,
  affectedTiles,
  resolveTiming,
  transactionId,
  effectData,
}) {
  return {
    effectId: effectId || `enemy-eff-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    skillId,
    source: COMMANDER_SOURCE_TYPES.ENEMY_COMMANDER,
    sourceCommanderId,
    target,
    affectedTiles: affectedTiles || [],
    resolveTiming: resolveTiming || null,
    transactionId,
    effectData: effectData || {},
    createdAt: Date.now(),
  };
}

export function addEnemyPendingEffect(state, effect) {
  if (!state) return state;
  return {
    ...state,
    pendingCommanderEffects: [...(state.pendingCommanderEffects || []), effect],
  };
}

export function removeEnemyPendingEffect(state, effectId) {
  if (!state) return state;
  return {
    ...state,
    pendingCommanderEffects: (state.pendingCommanderEffects || []).filter((e) => e.effectId !== effectId),
  };
}

// --- Dev-marked tracking (duplicate-status avoidance for DEV_ENEMY_MARK) ---

// Has this player soldier already been test-marked by DEV_ENEMY_MARK?
export function isDevMarked(state, unitId) {
  if (!state || !unitId) return false;
  return (state.devMarkedUnitIds || []).includes(unitId);
}

// Record a dev-mark on a soldier. Called after a successful DEV_ENEMY_MARK
// transaction so the AI avoids re-targeting the same soldier.
export function addDevMarked(state, unitId) {
  if (!state || !unitId) return state;
  if (isDevMarked(state, unitId)) return state;
  return {
    ...state,
    devMarkedUnitIds: [...(state.devMarkedUnitIds || []), unitId],
  };
}

// --- Serialization (for save/load) ---

// Serialize the battle state for persistence. Strips nothing — all fields are
// plain JSON-serializable. The profile is NOT serialized (it is re-read from
// the registry on load by commanderId).
export function serializeEnemyCommanderBattleState(state) {
  if (!state) return null;
  return {
    commanderId: state.commanderId,
    commandBudgetCurrent: state.commandBudgetCurrent,
    commandBudgetMax: state.commandBudgetMax,
    commandsUsedThisEnemyPhase: state.commandsUsedThisEnemyPhase,
    usesRemainingBySkillId: { ...(state.usesRemainingBySkillId || {}) },
    cooldownsBySkillId: { ...(state.cooldownsBySkillId || {}) },
    pendingCommanderEffects: (state.pendingCommanderEffects || []).slice(),
    activeTransactionId: state.activeTransactionId || null,
    devMarkedUnitIds: (state.devMarkedUnitIds || []).slice(),
  };
}

// Deserialize a saved snapshot back into a battle state. The profile is used
// to validate the commanderId still exists; if the profile is missing, returns
// null (the commander was removed from the registry — discard the state).
export function deserializeEnemyCommanderBattleState(snapshot, profile) {
  if (!snapshot || !profile) return null;
  if (snapshot.commanderId !== profile.commanderId) return null;
  return {
    commanderId: snapshot.commanderId,
    commandBudgetCurrent: Math.max(0, snapshot.commandBudgetCurrent ?? 0),
    commandBudgetMax: profile.commandBudget,
    commandsUsedThisEnemyPhase: Math.max(0, snapshot.commandsUsedThisEnemyPhase ?? 0),
    usesRemainingBySkillId: { ...(snapshot.usesRemainingBySkillId || {}) },
    cooldownsBySkillId: { ...(snapshot.cooldownsBySkillId || {}) },
    pendingCommanderEffects: (snapshot.pendingCommanderEffects || []).slice(),
    activeTransactionId: snapshot.activeTransactionId || null,
    devMarkedUnitIds: (snapshot.devMarkedUnitIds || []).slice(),
  };
}

// --- Persistence (campaign blob) ---

// Save the enemy Commander battle-state snapshot to the active campaign blob.
// Tagged with missionId so a reload only restores state for the same mission.
export function saveEnemyCommanderBattleState(missionId, state) {
  const c = readActiveCampaign();
  if (!c) return;
  if (!state) {
    delete c[EC_BATTLE_STATE_FIELD];
  } else {
    c[EC_BATTLE_STATE_FIELD] = { missionId, snapshot: serializeEnemyCommanderBattleState(state) };
  }
  writeActiveCampaign(c);
}

// Load a saved enemy Commander battle-state snapshot for the given mission.
// Returns the snapshot (to be deserialized with a profile) or null if there
// is no saved state for this mission. A mismatched missionId returns null so
// stale state from a previous mission never leaks forward.
export function loadEnemyCommanderBattleState(missionId) {
  const c = readActiveCampaign();
  if (!c) return null;
  const saved = c[EC_BATTLE_STATE_FIELD];
  if (!saved || saved.missionId !== missionId) return null;
  return saved.snapshot || null;
}

// Clear the saved enemy Commander battle state. Called on mission end, restart,
// and when no commander is assigned — ensures no state leaks to the next mission.
export function clearEnemyCommanderBattleState() {
  const c = readActiveCampaign();
  if (!c) return;
  if (!c[EC_BATTLE_STATE_FIELD]) return;
  delete c[EC_BATTLE_STATE_FIELD];
  writeActiveCampaign(c);
}