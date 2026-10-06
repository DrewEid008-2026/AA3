// Pure functions for Commander battle-use state: uses-per-mission tracking,
// cooldown progression, and pending delayed-effect storage. Kept separate from
// the hook so the logic is testable and reusable by future enemy Commander AI.
//
// Battle-use state is TRANSIENT — never persisted to the campaign save. It is
// created at mission start, mutated during battle, and discarded on mission
// end/restart. Only campaign resources spent through successful transactions
// are persistent (handled by commanderTransactions.js + persistence.js).
//
// Cooldown interpretation: cooldown = number of future Player Phases before
// the skill can be reused. A skill with cooldown: 2 used on Turn 1 is on
// cooldown during Turns 2 and 3, and available again on Turn 4. The tick fires
// at the start of each Player Phase (except the very first one of the mission).
//
// Uses-per-mission: if null, no limit. If 1, one successful execution per
// mission. Uses are only decremented on successful transaction commit — never
// on cancel or failure.

import { getCommanderSkill } from './commanderSkills';

// Source type identifier — distinguishes player Commander effects from future
// enemy Commander, soldier, utility, and environmental effects.
export const COMMANDER_SOURCE_TYPES = {
  PLAYER_COMMANDER: 'PLAYER_COMMANDER',
  ENEMY_COMMANDER: 'ENEMY_COMMANDER',
};

// Create the initial battle-use state from a list of unlocked skill IDs.
// usesRemainingBySkillId: only tracked for skills with usesPerMission != null.
// cooldownsBySkillId: always 0 at mission start (no skill has been used yet).
// pendingCommanderEffects: delayed effects awaiting resolution.
export function createCommanderBattleState(unlockedSkillIds) {
  const ids = Array.isArray(unlockedSkillIds) ? unlockedSkillIds : [];
  const usesRemainingBySkillId = {};
  const cooldownsBySkillId = {};
  for (const id of ids) {
    const skill = getCommanderSkill(id);
    if (!skill) continue;
    if (skill.usesPerMission != null) {
      usesRemainingBySkillId[id] = skill.usesPerMission;
    }
    cooldownsBySkillId[id] = 0;
  }
  return {
    usesRemainingBySkillId,
    cooldownsBySkillId,
    pendingCommanderEffects: [],
    activeTransactionId: null,
  };
}

// Check remaining uses for a skill this mission. Returns Infinity if no limit.
export function getUsesRemaining(battleState, skillId) {
  if (!battleState) return Infinity;
  const skill = getCommanderSkill(skillId);
  if (!skill || skill.usesPerMission == null) return Infinity;
  return battleState.usesRemainingBySkillId?.[skillId] ?? skill.usesPerMission;
}

// Check if a skill is on cooldown. Returns the remaining cooldown (0 = ready).
export function getCooldownRemaining(battleState, skillId) {
  if (!battleState) return 0;
  return battleState.cooldownsBySkillId?.[skillId] ?? 0;
}

// Decrement uses on successful commit. No-op for unlimited-use skills.
export function decrementUses(battleState, skillId) {
  if (!battleState) return battleState;
  const skill = getCommanderSkill(skillId);
  if (!skill || skill.usesPerMission == null) return battleState;
  const current = battleState.usesRemainingBySkillId?.[skillId] ?? skill.usesPerMission;
  return {
    ...battleState,
    usesRemainingBySkillId: {
      ...battleState.usesRemainingBySkillId,
      [skillId]: Math.max(0, current - 1),
    },
  };
}

// Set cooldown on successful commit.
export function setCooldown(battleState, skillId) {
  if (!battleState) return battleState;
  const skill = getCommanderSkill(skillId);
  if (!skill || skill.cooldown == null || skill.cooldown <= 0) return battleState;
  return {
    ...battleState,
    cooldownsBySkillId: {
      ...battleState.cooldownsBySkillId,
      [skillId]: skill.cooldown,
    },
  };
}

// Tick all cooldowns down by 1 (floored at 0). Called at the start of each
// Player Phase after the first. Idempotent — skills at 0 stay at 0.
export function tickCooldowns(battleState) {
  if (!battleState) return battleState;
  const next = {};
  for (const [id, cd] of Object.entries(battleState.cooldownsBySkillId || {})) {
    next[id] = Math.max(0, cd - 1);
  }
  return { ...battleState, cooldownsBySkillId: next };
}

// Create a pending delayed-effect entry. Stored until its resolve timing fires.
// effectId is unique within the mission. transactionId links back to the
// committed transaction for idempotency checks.
export function createPendingEffect({ effectId, skillId, target, affectedTiles, resolveTiming, transactionId, effectData }) {
  return {
    effectId,
    skillId,
    source: COMMANDER_SOURCE_TYPES.PLAYER_COMMANDER,
    target,
    affectedTiles: affectedTiles || [],
    resolveTiming: resolveTiming || null,
    transactionId,
    effectData: effectData || {},
    createdAt: Date.now(),
  };
}

// Add a pending effect to battle state.
export function addPendingEffect(battleState, effect) {
  if (!battleState) return battleState;
  return {
    ...battleState,
    pendingCommanderEffects: [...(battleState.pendingCommanderEffects || []), effect],
  };
}

// Remove a pending effect by effectId (after it has resolved).
export function removePendingEffect(battleState, effectId) {
  if (!battleState) return battleState;
  return {
    ...battleState,
    pendingCommanderEffects: (battleState.pendingCommanderEffects || []).filter((e) => e.effectId !== effectId),
  };
}