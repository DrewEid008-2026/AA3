// The Harvester — Chapter 2 Boss state management.
//
// Distinct from the Warden Prime bossState.js (which tracks relays + Core
// Shield). The Harvester's defensive identity is ARMOR, not shields. This
// state is transient (mission-local) — created during mission init and reset
// on restart. It does NOT persist in the campaign save.
//
// Phase 2 (ADVANCING HARVESTER) triggers once when Current Armor ≤ 2. The
// Fabrication Sequence is a one-time reinforcement event tied to that
// transition — it fires at the start of the next Enemy Phase after Phase 2
// begins, then never again for the rest of the attempt.

export const HARVESTER_PHASES = {
  PHASE_1_ARMORED: 'PHASE_1_ARMORED',
  PHASE_2_ADVANCE: 'PHASE_2_ADVANCE',
  PHASE_3_CORE_FAILURE: 'PHASE_3_CORE_FAILURE',
  DEFEATED: 'DEFEATED',
};

// Player-facing phase labels.
export const HARVESTER_PHASE_LABELS = {
  PHASE_1_ARMORED: 'ARMORED HARVESTER',
  PHASE_2_ADVANCE: 'ADVANCING HARVESTER',
  PHASE_3_CORE_FAILURE: 'CORE FAILURE',
  DEFEATED: 'DEFEATED',
};

// Phase 2 movement bonus — the Harvester becomes faster when its Armor breaks.
export const PHASE_2_MOVEMENT = 5;

// Phase 1 defense zone — the Harvester prefers staying near its platform.
// Center is the platform (4,1); radius 3 allows modest repositioning.
export const PHASE_1_DEFENSE_ZONE = {
  center: { x: 4, y: 1 },
  radius: 3,
};

// Create the initial Harvester state for a new mission attempt.
export function createInitialHarvesterState() {
  return {
    bossPhase: HARVESTER_PHASES.PHASE_1_ARMORED,
    phase2ConditionMet: false,        // true once when Current Armor ≤ 2 (hook)
    phase2Triggered: false,            // true once when the actual transition fires
    fabricationSequenceTriggered: false, // true once when Phase 2 begins (one-time event)
    phase2ReinforcementsSpawned: false, // true once the Fabrication Sequence spawns
    phase3ConditionMet: false,        // true once when HP ≤ 10 (hook)
    phase3Triggered: false,            // true once when the actual Phase 3 transition fires
    coreDischargeUsed: false,          // true once Core Discharge is used (Part 24)
    bossDefeated: false,
    devComplete: false,                // temporary: HP 0 during Phase 1/2 testing
  };
}

// Check the Phase 2 transition condition (Current Armor ≤ 2). Triggers the
// ACTUAL phase transition (bossPhase → PHASE_2_ADVANCE, phase2Triggered = true,
// fabricationSequenceTriggered = true) exactly once. Lethal edge case: if HP
// is 0, boss death takes priority and Phase 2 does NOT trigger (Part 3).
// Idempotent.
//
// Returns the new harvesterState. The caller is responsible for applying the
// movement increase to the Harvester unit (separate from state).
export function checkPhase2Condition(harvesterState, harvesterUnit) {
  if (!harvesterState || !harvesterUnit) return harvesterState;
  if (harvesterState.phase2Triggered) return harvesterState;
  // Lethal edge case: boss death takes priority (Part 3).
  if (harvesterUnit.hp <= 0) return harvesterState;
  const currentArmor = harvesterUnit.currentArmor != null
    ? harvesterUnit.currentArmor
    : (harvesterUnit.armor || 0);
  if (currentArmor <= 2) {
    return {
      ...harvesterState,
      phase2ConditionMet: true,
      phase2Triggered: true,
      fabricationSequenceTriggered: true,
      bossPhase: HARVESTER_PHASES.PHASE_2_ADVANCE,
    };
  }
  return harvesterState;
}

// Should the Fabrication Sequence reinforcements spawn at the beginning of the
// next Enemy Phase? True when Phase 2 has triggered, the Fabrication Sequence
// is queued, and reinforcements have not yet spawned.
export function shouldSpawnFabricationReinforcements(harvesterState) {
  if (!harvesterState) return false;
  return !!(harvesterState.fabricationSequenceTriggered && !harvesterState.phase2ReinforcementsSpawned);
}

// Mark the Fabrication Sequence reinforcements as spawned (once per attempt).
export function markFabricationReinforcementsSpawned(harvesterState) {
  if (!harvesterState) return harvesterState;
  return { ...harvesterState, phase2ReinforcementsSpawned: true };
}

// Check the Phase 3 condition (HP ≤ 10) and trigger the actual transition
// (bossPhase → PHASE_3_CORE_FAILURE, phase3Triggered = true) exactly once.
// Death priority (Part 2): if HP is 0, boss death takes priority and Phase 3
// does NOT trigger. Idempotent.
//
// Returns the new harvesterState. The caller is responsible for setting the
// movement to 5 if Phase 2 was skipped (ensuring MOVE 5 per Part 5).
export function checkPhase3Condition(harvesterState, harvesterUnit) {
  if (!harvesterState || !harvesterUnit) return harvesterState;
  if (harvesterState.phase3Triggered) return harvesterState;
  // Death priority (Part 2): HP 0 → no Phase 3.
  if (harvesterUnit.hp <= 0) return harvesterState;
  if (harvesterUnit.hp <= 10) {
    return {
      ...harvesterState,
      phase3ConditionMet: true,
      phase3Triggered: true,
      bossPhase: HARVESTER_PHASES.PHASE_3_CORE_FAILURE,
    };
  }
  return harvesterState;
}

// Should Meltdown Zones be generated this Enemy Phase? True when in Phase 3
// and the Harvester is still alive (Part 9).
export function shouldGenerateMeltdownZones(harvesterState, harvesterAlive) {
  if (!harvesterState) return false;
  if (harvesterState.bossPhase !== HARVESTER_PHASES.PHASE_3_CORE_FAILURE) return false;
  return !!harvesterAlive;
}

// Mark Core Discharge as used (Part 24 — once per Boss attempt).
export function markCoreDischargeUsed(harvesterState) {
  if (!harvesterState) return harvesterState;
  return { ...harvesterState, coreDischargeUsed: true };
}

// Mark the Harvester as defeated (HP 0). Sets bossPhase = DEFEATED.
// Idempotent.
export function defeatHarvester(harvesterState) {
  if (!harvesterState || harvesterState.bossDefeated) return harvesterState;
  return {
    ...harvesterState,
    bossPhase: HARVESTER_PHASES.DEFEATED,
    bossDefeated: true,
  };
}

// Is the Harvester defeated?
export function isHarvesterDefeated(harvesterState) {
  return !!(harvesterState && harvesterState.bossDefeated);
}

// Find the Harvester unit (the isBoss unit on a Harvester Pit mission).
export function getHarvesterUnit(units) {
  return units.find((u) => u.isBoss && u.alive && u.archetype === 'harvester') || null;
}

// Is a tile inside the Phase 1 defense zone?
export function isInPhase1DefenseZone(x, y) {
  const { center, radius } = PHASE_1_DEFENSE_ZONE;
  return Math.max(Math.abs(x - center.x), Math.abs(y - center.y)) <= radius;
}