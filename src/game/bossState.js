// Boss mission state management. Tracks the boss phase, relay states, Core
// Shield, and phase transition flags. This state is transient (mission-local)
// — it's created during mission initialization and reset on restart. It does
// NOT persist in the campaign save.
//
// Phase 1 Implementation: PHASE_1_FORTIFIED is fully active. Core Shield
// absorbs damage after Armor + Bulwark Shield. Shield regenerates +4 at the
// start of each Enemy Phase while at least one Relay survives. Destroying
// both Relays permanently disables regeneration and sets phase2Ready.

export const BOSS_PHASES = {
  PHASE_1_FORTIFIED: 'PHASE_1_FORTIFIED',
  PHASE_2_ADVANCE: 'PHASE_2_ADVANCE',
  PHASE_3_OVERLOAD: 'PHASE_3_OVERLOAD',
  DEFEATED: 'DEFEATED',
};

export const RELAY_STATES = {
  ACTIVE: 'ACTIVE',
  DESTROYED: 'DESTROYED',
};

// Core Shield constants — the boss's separate durability pool.
export const CORE_SHIELD_MAX = 8;
export const CORE_SHIELD_REGEN = 4;

// Create the initial boss state for a new mission attempt.
export function createInitialBossState(bossMissionId = null, bossId = null) {
  return {
    bossMissionId,
    bossId,
    bossPhase: BOSS_PHASES.PHASE_1_FORTIFIED,
    relayAState: RELAY_STATES.ACTIVE,
    relayBState: RELAY_STATES.ACTIVE,
    activeRelayCount: 2,
    bossShield: CORE_SHIELD_MAX,
    bossShieldMax: CORE_SHIELD_MAX,
    bossShieldRegenerationEnabled: true,
    phase2Ready: false,
    phase2Triggered: false,
    phase2ReinforcementsSpawned: false,
    phase3Triggered: false,
    bossDefeated: false,
    pendingBossRewards: null,
  };
}

// Trigger the Phase 2 transition. Called once when both Power Relays are
// destroyed. Sets bossPhase to PHASE_2_ADVANCE and phase2Triggered = true.
// Idempotent: if phase2Triggered is already true, returns the state unchanged.
export function triggerPhase2(bossState) {
  if (!bossState || bossState.phase2Triggered) return bossState;
  return {
    ...bossState,
    bossPhase: BOSS_PHASES.PHASE_2_ADVANCE,
    phase2Triggered: true,
    phase2Ready: true,
    bossShieldRegenerationEnabled: false,
    activeRelayCount: 0,
    relayAState: RELAY_STATES.DESTROYED,
    relayBState: RELAY_STATES.DESTROYED,
  };
}

// Trigger the Phase 3 transition (Core Overload). Called once when Warden Prime
// reaches 9 HP or lower (35% of 26 HP) while still alive. Sets bossPhase to
// PHASE_3_OVERLOAD and phase3Triggered = true. Idempotent.
// IMPORTANT: the caller must check boss death BEFORE calling this — if the
// Warden is already defeated, defeatBoss takes priority (Part 3).
export function triggerPhase3(bossState) {
  if (!bossState || bossState.phase3Triggered) return bossState;
  return {
    ...bossState,
    bossPhase: BOSS_PHASES.PHASE_3_OVERLOAD,
    phase3Triggered: true,
  };
}

// Mark the boss as defeated. Called once when Warden Prime reaches 0 HP.
// Sets bossDefeated = true and bossPhase = DEFEATED. Stops all boss actions,
// hazard generation, and phase transitions. Idempotent.
export function defeatBoss(bossState) {
  if (!bossState || bossState.bossDefeated) return bossState;
  return {
    ...bossState,
    bossPhase: BOSS_PHASES.DEFEATED,
    bossDefeated: true,
  };
}

// Should Overload hazards be generated this Enemy Phase? True when Phase 3 is
// active and the boss is not defeated.
export function shouldGenerateOverloadHazards(bossState) {
  return !!(bossState && bossState.phase3Triggered && !bossState.bossDefeated);
}

// Is the boss defeated?
export function isBossDefeated(bossState) {
  return !!(bossState && bossState.bossDefeated);
}

// Should Phase 2 reinforcements spawn at the beginning of the next Enemy Phase?
// True when Phase 2 has been triggered but reinforcements haven't spawned yet.
export function shouldSpawnPhase2Reinforcements(bossState) {
  return !!(bossState && bossState.phase2Triggered && !bossState.phase2ReinforcementsSpawned);
}

// Mark Phase 2 reinforcements as spawned (so they only spawn once per attempt).
export function markPhase2ReinforcementsSpawned(bossState) {
  if (!bossState) return bossState;
  return { ...bossState, phase2ReinforcementsSpawned: true };
}

// Compute relay status from the live units array. Relays are boss-object units
// (isBossObject === true). An alive relay is ACTIVE; a dead relay is DESTROYED.
// Returns { destroyed, total, active } for the relay counter display.
export function getRelayStatus(units) {
  const relays = units.filter((u) => u.isBossObject);
  const total = relays.length;
  const destroyed = relays.filter((r) => !r.alive).length;
  return { destroyed, total, active: total - destroyed };
}

// Find the Warden Prime unit (the boss) in the units array.
export function getBossUnit(units) {
  return units.find((u) => u.isBoss && u.alive) || null;
}

// Find a relay by its bossObjectId ('relayA' or 'relayB').
export function getRelayById(units, relayId) {
  return units.find((u) => u.isBossObject && u.bossObjectId === relayId) || null;
}

// Shield regeneration state: ACTIVE if at least one relay survives, OFFLINE if
// both are destroyed. This is the read-only computed state from live units.
export function getRelayRegenerationState(units) {
  const { active, total } = getRelayStatus(units);
  return active >= 1 && total > 0 ? 'ACTIVE' : 'OFFLINE';
}

// Regenerate Core Shield at the beginning of an Enemy Phase.
// `activeRelayCount` is computed from live units by the caller.
// `regenEnabled` is the persistent boss-state flag (false after both relays destroyed).
// Returns { unit, regenAmount } — regenAmount is 0 if no regen occurs.
export function regenerateBossShield(bossUnit, activeRelayCount, regenEnabled) {
  if (!bossUnit || !bossUnit.alive) return { unit: bossUnit, regenAmount: 0 };
  if (!regenEnabled) return { unit: bossUnit, regenAmount: 0 };
  if (activeRelayCount < 1) return { unit: bossUnit, regenAmount: 0 };
  const current = bossUnit.coreShield || 0;
  const newShield = Math.min((bossUnit.coreShieldMax || CORE_SHIELD_MAX), current + CORE_SHIELD_REGEN);
  const regenAmount = newShield - current;
  if (regenAmount <= 0) return { unit: bossUnit, regenAmount: 0 };
  return { unit: { ...bossUnit, coreShield: newShield }, regenAmount };
}