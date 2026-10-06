// Centralized hostile Commander assignment logic. Determines which hostile
// Commander (if any) is assigned to a mission, based on campaign state and
// data-driven rules. This is the single entry point for production assignment
// — mission creation code never hardcodes a specific Commander.
//
// Responsibilities:
//   - selectHostileCommanderForMission: evaluate eligibility, first-encounter
//     guarantee, recurrence chance, and anti-spam cooldown
//   - ensureMissionCommanderAssignment: cache the result per mission instance
//     so tab changes / save-load do not reroll
//   - campaign-state management: encounter flags, encounterCount,
//     missionsSinceVexarEncounter, tutorialShown, recurrenceChance,
//     productionEnabled, per-mission assignment cache
//   - debug controls: reset flags, set counters, force assignments, inspect
//     assignment reasons
//
// Design rules (spec 3.2.6):
//   - First eligible Chapter 3 Sabotage GUARANTEES Vexar (no RNG).
//   - Repeat appearances use a tunable chance (default 40%).
//   - Anti-spam: no back-to-back Vexar (missionsSinceVexarEncounter >= 1).
//   - Dev overrides bypass all rules without altering production state.
//   - Mission instances preserve their assignment until the instance ends.

import { readActiveCampaign, writeActiveCampaign } from './saveSlots';
import { getEnemyCommanderProfile, validateCommanderAssignment } from './enemyCommanders';

// --- Defaults ---

export const DEFAULT_RECURRENCE_CHANCE = 0.40;

// Create the default enemy Commander campaign state. Every new save and every
// migrated old save starts with no encounters, no assignments, and production
// enabled.
export function createDefaultEnemyCommanderState() {
  return {
    commanders: {}, // { commanderId: { encountered, encounterCount } }
    missionsSinceVexarEncounter: 0,
    tutorialShown: false,
    assignments: {}, // { missionId: { commanderId, reason, source } }
    lastEncounterMissionId: null, // anti-duplicate-increment guard
    recurrenceChance: DEFAULT_RECURRENCE_CHANCE,
    productionEnabled: true,
    ch3CommanderIntroShown: false,
  };
}

// --- Campaign state read/write ---

// Read the enemy Commander state from the active campaign. Migrates old saves
// that lack the field. Never throws — returns defaults on any error.
export function getEnemyCommanderState(campaign) {
  const c = campaign || readActiveCampaign();
  if (!c) return createDefaultEnemyCommanderState();
  const raw = c.enemyCommanderState;
  if (!raw || typeof raw !== 'object') return createDefaultEnemyCommanderState();
  return {
    ...createDefaultEnemyCommanderState(),
    ...raw,
    commanders: raw.commanders || {},
    assignments: raw.assignments || {},
  };
}

// Write the enemy Commander state to the active campaign blob.
export function writeEnemyCommanderState(state) {
  const c = readActiveCampaign();
  if (!c) return;
  c.enemyCommanderState = state;
  writeActiveCampaign(c);
}

// Mutate the enemy Commander state via an updater function and persist.
function updateEnemyCommanderState(updater) {
  const c = readActiveCampaign();
  if (!c) return null;
  const current = getEnemyCommanderState(c);
  const next = updater(current);
  if (!next) return null;
  c.enemyCommanderState = next;
  writeActiveCampaign(c);
  return next;
}

// --- Commander encounter tracking ---

// Get the per-commander encounter record. Returns { encountered: false, encounterCount: 0 }
// for commanders that have not been encountered.
export function getCommanderRecord(state, commanderId) {
  if (!state || !commanderId) return { encountered: false, encounterCount: 0 };
  return state.commanders[commanderId] || { encountered: false, encounterCount: 0 };
}

export function isCommanderEncountered(state, commanderId) {
  return getCommanderRecord(state, commanderId).encountered;
}

export function getCommanderEncounterCount(state, commanderId) {
  return getCommanderRecord(state, commanderId).encounterCount;
}

// Should the encounter be recorded for this mission instance? Returns false if
// already recorded (anti-duplicate guard for restart / reload / abandon-retry).
export function shouldRecordEncounter(state, commanderId, missionId) {
  if (!state || !commanderId || !missionId) return false;
  return state.lastEncounterMissionId !== missionId;
}

// Record a commander encounter: set encountered, increment encounterCount,
// reset missionsSinceVexarEncounter, and set the anti-duplicate guard.
// Returns the updated state.
export function recordCommanderEncounter(state, commanderId, missionId) {
  if (!state || !commanderId) return state;
  const rec = getCommanderRecord(state, commanderId);
  const next = {
    ...state,
    commanders: {
      ...state.commanders,
      [commanderId]: {
        encountered: true,
        encounterCount: rec.encounterCount + 1,
      },
    },
    missionsSinceVexarEncounter: 0,
    lastEncounterMissionId: missionId || state.lastEncounterMissionId,
  };
  return next;
}

// Increment the anti-spam counter (called when a non-Vexar eligible mission is
// launched). Returns the updated state.
export function incrementMissionsSinceVexar(state) {
  if (!state) return state;
  return { ...state, missionsSinceVexarEncounter: state.missionsSinceVexarEncounter + 1 };
}

// --- Tutorial ---

export function shouldShowCommanderTutorial(state) {
  return !!(state && !state.tutorialShown);
}

export function markCommanderTutorialShown(state) {
  if (!state) return state;
  return { ...state, tutorialShown: true };
}

// --- Chapter 3 enemy commander intro title card ---

// Should the Chapter 3 enemy commander intro title card be shown? True only
// once per campaign (until dismissed). The flag lives in enemyCommanderState so
// it persists across saves and migrates with the default (false) for old saves.
export function shouldShowCh3CommanderIntro(state) {
  return !!(state && !state.ch3CommanderIntroShown);
}

// Mark the Chapter 3 intro as shown. Persists to the active campaign. No-op if
// already shown (avoids a redundant write).
export function markCh3CommanderIntroShown() {
  updateEnemyCommanderState((state) =>
    state.ch3CommanderIntroShown ? null : { ...state, ch3CommanderIntroShown: true }
  );
}

// --- Assignment ---

// Check if a mission is eligible for hostile Commander assignment. Returns
// { eligible, reason }. A mission is eligible when:
//   - productionEnabled is true
//   - the mission chapter is ch3
//   - the mission type is Sabotage
//   - the commander profile exists and passes assignment validation
export function isMissionEligibleForCommander(mission, state, commanderId) {
  if (!state?.productionEnabled) return { eligible: false, reason: 'Production Disabled' };
  if (!mission) return { eligible: false, reason: 'No mission' };
  if (mission.chapterId !== 'ch3') return { eligible: false, reason: 'Wrong Chapter' };
  const profile = getEnemyCommanderProfile(commanderId);
  if (!profile) return { eligible: false, reason: 'Unknown Commander' };
  const check = validateCommanderAssignment(profile, {
    chapterId: mission.chapterId,
    missionType: mission.type,
  });
  if (!check.valid) return { eligible: false, reason: check.reason };
  return { eligible: true, reason: null };
}

// The core assignment function. Deterministic: a mission's declared
// hostileCommanderId is the single source of truth. No RNG, no recurrence
// chance, no anti-spam cooldown — if the mission lists a Commander, they are
// always assigned. Returns:
//   { commanderId, reason, source }
// where:
//   commanderId: the mission's hostileCommanderId (or null)
//   reason: human-readable debug reason
//   source: 'mission_field' | 'ineligible' | 'disabled'
//
// This function is PURE — it does not read or write campaign state. The caller
// passes the current state and receives the decision.
export function selectHostileCommanderForMission(mission, state, commanderId = 'vexar_huntsmaster') {
  if (!state?.productionEnabled) {
    return { commanderId: null, reason: 'Production Disabled', source: 'disabled' };
  }
  const elig = isMissionEligibleForCommander(mission, state, commanderId);
  if (!elig.eligible) {
    return { commanderId: null, reason: elig.reason, source: 'ineligible' };
  }
  // Deterministic: honor the mission's declared hostileCommanderId. Every
  // eligible mission always gets its declared Commander — no probability.
  const id = mission.hostileCommanderId || commanderId;
  return { commanderId: id, reason: 'Mission Assignment', source: 'mission_field' };
}

// Ensure a mission has a commander assignment. If one already exists in the
// cache, return it (no reroll). Otherwise, evaluate, persist, and return.
// This is the main entry point for MissionSelect / Deploy.
export function ensureMissionCommanderAssignment(missionId, mission, commanderId = 'vexar_huntsmaster') {
  const c = readActiveCampaign();
  if (!c) return { commanderId: null, reason: 'No campaign', source: 'none' };
  const state = getEnemyCommanderState(c);
  // Return cached assignment if it exists (spec §21: do not reroll).
  const cached = state.assignments[missionId];
  if (cached) return cached;
  // Evaluate a new assignment.
  const decision = selectHostileCommanderForMission(mission, state, commanderId);
  const next = {
    ...state,
    assignments: {
      ...state.assignments,
      [missionId]: decision,
    },
  };
  c.enemyCommanderState = next;
  writeActiveCampaign(c);
  return decision;
}

// Read the cached assignment for a mission (without evaluating). Returns null
// if no assignment exists.
export function getMissionCommanderAssignment(missionId) {
  const c = readActiveCampaign();
  if (!c) return null;
  const state = getEnemyCommanderState(c);
  return state.assignments[missionId] || null;
}

// Clear the cached assignment for a mission. Called when the mission instance
// ends (complete, abandon, save/load exit) so the next launch re-evaluates.
export function clearMissionCommanderAssignment(missionId) {
  updateEnemyCommanderState((state) => {
    if (!state.assignments[missionId]) return null; // no change
    const assignments = { ...state.assignments };
    delete assignments[missionId];
    return { ...state, assignments };
  });
}

// Clear all cached assignments (debug).
export function clearAllMissionCommanderAssignments() {
  updateEnemyCommanderState((state) => ({ ...state, assignments: {} }));
}

// Clear the last-encounter mission guard so the next launch can record a new
// encounter. Called when the player navigates to Deploy (new mission attempt).
export function clearLastEncounterMission() {
  updateEnemyCommanderState((state) =>
    state.lastEncounterMissionId == null ? null : { ...state, lastEncounterMissionId: null }
  );
}

// --- Debug controls ---

export function debugResetCommanderEncounter(commanderId) {
  updateEnemyCommanderState((state) => {
    const commanders = { ...state.commanders };
    delete commanders[commanderId];
    return { ...state, commanders, missionsSinceVexarEncounter: 0, lastEncounterMissionId: null };
  });
}

export function debugSetEncounterCount(commanderId, count) {
  updateEnemyCommanderState((state) => {
    const rec = getCommanderRecord(state, commanderId);
    const commanders = {
      ...state.commanders,
      [commanderId]: { ...rec, encounterCount: Math.max(0, Math.floor(count)) },
    };
    return { ...state, commanders };
  });
}

export function debugSetMissionsSinceVexar(count) {
  updateEnemyCommanderState((state) => ({ ...state, missionsSinceVexarEncounter: Math.max(0, Math.floor(count)) }));
}

export function debugSetRecurrenceChance(chance) {
  updateEnemyCommanderState((state) => ({ ...state, recurrenceChance: Math.max(0, Math.min(1, chance)) }));
}

export function debugSetProductionEnabled(enabled) {
  updateEnemyCommanderState((state) => ({ ...state, productionEnabled: !!enabled }));
}

export function debugResetTutorial() {
  updateEnemyCommanderState((state) => ({ ...state, tutorialShown: false }));
}

export function debugForceAssignment(missionId, commanderId) {
  updateEnemyCommanderState((state) => {
    const assignments = {
      ...state.assignments,
      [missionId]: { commanderId, reason: 'Dev Forced', source: 'dev_override' },
    };
    return { ...state, assignments };
  });
}

export function debugClearAssignment(missionId) {
  clearMissionCommanderAssignment(missionId);
}