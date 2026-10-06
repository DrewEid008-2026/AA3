// Centralized Commander Skill definitions, target validation, preview, and
// resource affordability. Single source of truth for Commander skill data —
// used by both the player UI (targeting/preview/confirm/payment) and future
// enemy Commander AI.
//
// This phase implements:
//   - Targeting/preview/confirmation framework (3.1.4)
//   - Resource cost definitions using existing campaign resources (3.1.5)
//   - Centralized affordability check
//   - Development test skills with real resource costs
//
// No production skills, no enemy Commanders, no Command Budget.

import { TEAMS } from './constants';
import { COMMANDER_SOURCE_TYPES } from './commanderBattleState';

// --- Target types ---
export const COMMANDER_TARGET_TYPES = {
  GLOBAL: 'global',
  FRIENDLY_UNIT: 'friendly_unit',
  ENEMY_UNIT: 'enemy_unit',
  ANY_UNIT: 'any_unit',
  TILE: 'tile',
  AREA: 'area',
  FRIENDLY_AREA: 'friendly_area',
  ENEMY_AREA: 'enemy_area',
};

export const COMMANDER_TIMING_TYPES = {
  IMMEDIATE: 'immediate',
  DELAYED: 'delayed',
};

// Immunity tag that blocks Commander skills on a unit.
export const COMMANDER_IMMUNE_TAG = 'COMMANDER_IMMUNE';

// Resource keys that Commander skills may spend. These map 1:1 to the
// existing campaign resource fields — never duplicated inside Commander data.
export const COMMANDER_RESOURCE_KEYS = ['credits', 'alienMaterials', 'powerCores', 'nanoCubes'];

// Source type identifier — distinguishes player Commander effects from future
// enemy Commander, soldier, utility, and environmental effects. Imported from
// commanderBattleState and re-exported for convenience.
export { COMMANDER_SOURCE_TYPES };

// Skill status codes for card display, following the priority order from
// Implementation 3.1.6 §18. When multiple restrictions apply, the
// highest-priority (lowest number) reason is shown.
export const COMMANDER_SKILL_STATUS = {
  SYSTEM_UNAVAILABLE: 'system_unavailable',
  WRONG_PHASE: 'wrong_phase',
  NO_USES: 'no_uses',
  ON_COOLDOWN: 'on_cooldown',
  INSUFFICIENT_RESOURCES: 'insufficient_resources',
  NO_VALID_TARGETS: 'no_valid_targets',
  AVAILABLE: 'available',
};

// Human-readable status labels for skill cards.
export const COMMANDER_SKILL_STATUS_LABELS = {
  [COMMANDER_SKILL_STATUS.SYSTEM_UNAVAILABLE]: 'LOCKED',
  [COMMANDER_SKILL_STATUS.WRONG_PHASE]: 'NOT PLAYER PHASE',
  [COMMANDER_SKILL_STATUS.NO_USES]: 'NO USES LEFT',
  [COMMANDER_SKILL_STATUS.ON_COOLDOWN]: 'COOLDOWN',
  [COMMANDER_SKILL_STATUS.INSUFFICIENT_RESOURCES]: 'INSUFFICIENT',
  [COMMANDER_SKILL_STATUS.NO_VALID_TARGETS]: 'NO VALID TARGETS',
  [COMMANDER_SKILL_STATUS.AVAILABLE]: 'AVAILABLE',
};

// --- Development test skills ---
// Only available in development mode via debug controls.
// The first group (DEV_GLOBAL, DEV_UNIT_TARGET, etc.) has zero costs and
// tests the targeting framework. The second group (DEV_CREDIT_COST, etc.)
// has real resource costs and tests the payment/transaction framework.
// None have gameplay effects — confirm shows a debug completion message.
const DEV_SKILLS = [
  // --- Targeting test skills (zero cost) ---
  {
    id: 'DEV_GLOBAL',
    name: 'DEV GLOBAL',
    desc: 'Development test command. No gameplay effect.',
    targetType: COMMANDER_TARGET_TYPES.GLOBAL,
    targetRules: {},
    requiresLOS: false,
    radius: 0,
    resourceCosts: { credits: 0, alienMaterials: 0, powerCores: 0, nanoCubes: 0 },
    immunityTags: [],
    timingType: COMMANDER_TIMING_TYPES.IMMEDIATE,
    usesPerMission: null,
    cooldown: null,
    requiresHighValueConfirmation: false,
    isDev: true,
  },
  {
    id: 'DEV_UNIT_TARGET',
    name: 'DEV UNIT TARGET',
    desc: 'Development test command. No gameplay effect.',
    targetType: COMMANDER_TARGET_TYPES.ANY_UNIT,
    targetRules: { allowDowned: false },
    requiresLOS: false,
    radius: 0,
    resourceCosts: { credits: 0, alienMaterials: 0, powerCores: 0, nanoCubes: 0 },
    immunityTags: [COMMANDER_IMMUNE_TAG],
    timingType: COMMANDER_TIMING_TYPES.IMMEDIATE,
    usesPerMission: null,
    cooldown: null,
    requiresHighValueConfirmation: false,
    isDev: true,
  },
  {
    id: 'DEV_TILE_TARGET',
    name: 'DEV TILE TARGET',
    desc: 'Development test command. No gameplay effect.',
    targetType: COMMANDER_TARGET_TYPES.TILE,
    targetRules: {},
    requiresLOS: false,
    radius: 0,
    resourceCosts: { credits: 0, alienMaterials: 0, powerCores: 0, nanoCubes: 0 },
    immunityTags: [],
    timingType: COMMANDER_TIMING_TYPES.IMMEDIATE,
    usesPerMission: null,
    cooldown: null,
    requiresHighValueConfirmation: false,
    isDev: true,
  },
  {
    id: 'DEV_AREA_TARGET',
    name: 'DEV AREA TARGET',
    desc: 'Development test command. No gameplay effect.',
    targetType: COMMANDER_TARGET_TYPES.AREA,
    targetRules: {},
    requiresLOS: false,
    radius: 1,
    resourceCosts: { credits: 0, alienMaterials: 0, powerCores: 0, nanoCubes: 0 },
    immunityTags: [COMMANDER_IMMUNE_TAG],
    timingType: COMMANDER_TIMING_TYPES.IMMEDIATE,
    usesPerMission: null,
    cooldown: null,
    requiresHighValueConfirmation: false,
    isDev: true,
  },
  {
    id: 'DEV_FRIENDLY_ONLY',
    name: 'DEV FRIENDLY ONLY',
    desc: 'Development test command. No gameplay effect.',
    targetType: COMMANDER_TARGET_TYPES.FRIENDLY_UNIT,
    targetRules: { allowDowned: false },
    requiresLOS: false,
    radius: 0,
    resourceCosts: { credits: 0, alienMaterials: 0, powerCores: 0, nanoCubes: 0 },
    immunityTags: [COMMANDER_IMMUNE_TAG],
    timingType: COMMANDER_TIMING_TYPES.IMMEDIATE,
    usesPerMission: null,
    cooldown: null,
    requiresHighValueConfirmation: false,
    isDev: true,
  },
  // --- Resource payment test skills (real costs, GLOBAL targeting) ---
  {
    id: 'DEV_CREDIT_COST',
    name: 'DEV CREDIT COST',
    desc: 'Dev payment test. Costs 10 Credits. No gameplay effect.',
    targetType: COMMANDER_TARGET_TYPES.GLOBAL,
    targetRules: {},
    requiresLOS: false,
    radius: 0,
    resourceCosts: { credits: 10, alienMaterials: 0, powerCores: 0, nanoCubes: 0 },
    immunityTags: [],
    timingType: COMMANDER_TIMING_TYPES.IMMEDIATE,
    usesPerMission: null,
    cooldown: null,
    requiresHighValueConfirmation: false,
    isDev: true,
  },
  {
    id: 'DEV_MATERIAL_COST',
    name: 'DEV MATERIAL COST',
    desc: 'Dev payment test. Costs 2 Alien Materials. No gameplay effect.',
    targetType: COMMANDER_TARGET_TYPES.GLOBAL,
    targetRules: {},
    requiresLOS: false,
    radius: 0,
    resourceCosts: { credits: 0, alienMaterials: 2, powerCores: 0, nanoCubes: 0 },
    immunityTags: [],
    timingType: COMMANDER_TIMING_TYPES.IMMEDIATE,
    usesPerMission: null,
    cooldown: null,
    requiresHighValueConfirmation: false,
    isDev: true,
  },
  {
    id: 'DEV_CORE_COST',
    name: 'DEV CORE COST',
    desc: 'Dev payment test. Costs 1 Power Core. No gameplay effect.',
    targetType: COMMANDER_TARGET_TYPES.GLOBAL,
    targetRules: {},
    requiresLOS: false,
    radius: 0,
    resourceCosts: { credits: 0, alienMaterials: 0, powerCores: 1, nanoCubes: 0 },
    immunityTags: [],
    timingType: COMMANDER_TIMING_TYPES.IMMEDIATE,
    usesPerMission: null,
    cooldown: null,
    requiresHighValueConfirmation: true,
    isDev: true,
  },
  {
    id: 'DEV_NANO_COST',
    name: 'DEV NANO COST',
    desc: 'Dev payment test. Costs 1 Nano Cube. No gameplay effect.',
    targetType: COMMANDER_TARGET_TYPES.GLOBAL,
    targetRules: {},
    requiresLOS: false,
    radius: 0,
    resourceCosts: { credits: 0, alienMaterials: 0, powerCores: 0, nanoCubes: 1 },
    immunityTags: [],
    timingType: COMMANDER_TIMING_TYPES.IMMEDIATE,
    usesPerMission: null,
    cooldown: null,
    requiresHighValueConfirmation: true,
    isDev: true,
  },
  {
    id: 'DEV_MULTI_COST',
    name: 'DEV MULTI COST',
    desc: 'Dev payment test. Costs 10 Credits, 2 Alien Materials, 1 Power Core, 1 Nano Cube. No gameplay effect.',
    targetType: COMMANDER_TARGET_TYPES.GLOBAL,
    targetRules: {},
    requiresLOS: false,
    radius: 0,
    resourceCosts: { credits: 10, alienMaterials: 2, powerCores: 1, nanoCubes: 1 },
    immunityTags: [],
    timingType: COMMANDER_TIMING_TYPES.IMMEDIATE,
    usesPerMission: null,
    cooldown: null,
    requiresHighValueConfirmation: true,
    isDev: true,
  },
  {
    id: 'DEV_EXPENSIVE_COMMAND',
    name: 'DEV EXPENSIVE',
    desc: 'Dev payment test. Costs 50 Credits, 2 Alien Materials. No gameplay effect.',
    targetType: COMMANDER_TARGET_TYPES.GLOBAL,
    targetRules: {},
    requiresLOS: false,
    radius: 0,
    resourceCosts: { credits: 50, alienMaterials: 2, powerCores: 0, nanoCubes: 0 },
    immunityTags: [],
    timingType: COMMANDER_TIMING_TYPES.IMMEDIATE,
    usesPerMission: null,
    cooldown: null,
    requiresHighValueConfirmation: false,
    isDev: true,
  },
];

// --- Production player Commander skills ---
// TACTICAL ADVANCE: the first production player command. Grants one friendly
// soldier +1 AP for the current Player Phase only. Cost: 25 Credits. No
// uses-per-mission limit, no cooldown — the Credit cost is the sole limiter.
// Multiple uses per mission and on the same soldier are allowed if affordable.
// Temporary AP is naturally cleaned up at Player Phase end (AP resets to
// maxAp at the start of each new Player Phase — see enemyPhaseRunner.js).
const PRODUCTION_SKILLS = [
  {
    id: 'player_tactical_advance',
    name: 'TACTICAL ADVANCE',
    desc: 'Grant one soldier +1 AP for the current Player Phase.',
    targetType: COMMANDER_TARGET_TYPES.FRIENDLY_UNIT,
    targetRules: { allowDowned: false },
    requiresLOS: false,
    radius: 0,
    resourceCosts: { credits: 25, alienMaterials: 0, powerCores: 0, nanoCubes: 0 },
    playerAvailable: true,
    immunityTags: [COMMANDER_IMMUNE_TAG],
    timingType: COMMANDER_TIMING_TYPES.IMMEDIATE,
    usesPerMission: null,
    cooldown: null,
    requiresHighValueConfirmation: false,
    isDev: false,
  },
];

// --- Production enemy Commander skills ---
// Vexar's first production command. Grants +1 AP to one alien for the
// current Enemy Phase only. Cost 1 Command Point. No usesPerMission or
// cooldown limit — the Command Budget (2) and maxCommandsPerEnemyPhase (1)
// naturally limit it to at most two uses per mission.
const PRODUCTION_ENEMY_SKILLS = [
  {
    id: 'vexar_tactical_advance',
    name: 'TACTICAL ADVANCE',
    desc: 'Grants one alien +1 AP for the current Enemy Phase.',
    targetType: COMMANDER_TARGET_TYPES.ENEMY_UNIT,
    targetRules: { allowDowned: false },
    requiresLOS: false,
    radius: 0,
    resourceCosts: { credits: 0, alienMaterials: 0, powerCores: 0, nanoCubes: 0 },
    enemyAvailable: true,
    enemyCommandPointCost: 1,
    playerAvailable: false,
    immunityTags: [COMMANDER_IMMUNE_TAG],
    timingType: COMMANDER_TIMING_TYPES.IMMEDIATE,
    usesPerMission: null,
    cooldown: null,
    requiresHighValueConfirmation: false,
    isDev: false,
    aiMetadata: {
      baseValue: 15,
      targetWeights: { opportunity: 1.5 },
      missionWeights: { elimination: 2, extraction: 2, sabotage: 1, rescue: 1 },
    },
  },
];

// --- Enemy Commander dev test skills ---
// Only available to enemy Commanders (playerAvailable: false). They test the
// enemy targeting/budget framework. enemyCommandPointCost is paid from the
// mission-local Command Budget — NOT player campaign resources. Enemy skills
// reuse the same target types, validation, immunity tags, and timing as player
// skills; only the payment pool differs.
const ENEMY_DEV_SKILLS = [
  {
    id: 'DEV_ENEMY_GLOBAL',
    name: 'DEV ENEMY GLOBAL',
    desc: 'Enemy dev test command. Battlefield-wide. No gameplay effect.',
    targetType: COMMANDER_TARGET_TYPES.GLOBAL,
    targetRules: {},
    requiresLOS: false,
    radius: 0,
    resourceCosts: { credits: 0, alienMaterials: 0, powerCores: 0, nanoCubes: 0 },
    enemyAvailable: true,
    enemyCommandPointCost: 1,
    playerAvailable: false,
    immunityTags: [],
    timingType: COMMANDER_TIMING_TYPES.IMMEDIATE,
    usesPerMission: null,
    cooldown: null,
    requiresHighValueConfirmation: false,
    isDev: true,
  },
  {
    id: 'DEV_ENEMY_UNIT_TARGET',
    name: 'DEV ENEMY UNIT',
    desc: 'Enemy dev test command. Targets any unit. No gameplay effect.',
    targetType: COMMANDER_TARGET_TYPES.ANY_UNIT,
    targetRules: { allowDowned: false },
    requiresLOS: false,
    radius: 0,
    resourceCosts: { credits: 0, alienMaterials: 0, powerCores: 0, nanoCubes: 0 },
    enemyAvailable: true,
    enemyCommandPointCost: 1,
    playerAvailable: false,
    immunityTags: [COMMANDER_IMMUNE_TAG],
    timingType: COMMANDER_TIMING_TYPES.IMMEDIATE,
    usesPerMission: null,
    cooldown: null,
    requiresHighValueConfirmation: false,
    isDev: true,
  },
  {
    id: 'DEV_ENEMY_TILE_TARGET',
    name: 'DEV ENEMY TILE',
    desc: 'Enemy dev test command. Targets a tile. No gameplay effect.',
    targetType: COMMANDER_TARGET_TYPES.TILE,
    targetRules: {},
    requiresLOS: false,
    radius: 0,
    resourceCosts: { credits: 0, alienMaterials: 0, powerCores: 0, nanoCubes: 0 },
    enemyAvailable: true,
    enemyCommandPointCost: 1,
    playerAvailable: false,
    immunityTags: [],
    timingType: COMMANDER_TIMING_TYPES.IMMEDIATE,
    usesPerMission: null,
    cooldown: null,
    requiresHighValueConfirmation: false,
    isDev: true,
  },
  {
    id: 'DEV_ENEMY_AREA_TARGET',
    name: 'DEV ENEMY AREA',
    desc: 'Enemy dev test command. Area effect. No gameplay effect.',
    targetType: COMMANDER_TARGET_TYPES.AREA,
    targetRules: {},
    requiresLOS: false,
    radius: 1,
    resourceCosts: { credits: 0, alienMaterials: 0, powerCores: 0, nanoCubes: 0 },
    enemyAvailable: true,
    enemyCommandPointCost: 2,
    playerAvailable: false,
    immunityTags: [COMMANDER_IMMUNE_TAG],
    timingType: COMMANDER_TIMING_TYPES.IMMEDIATE,
    usesPerMission: null,
    cooldown: null,
    requiresHighValueConfirmation: false,
    isDev: true,
    aiMetadata: {
      baseValue: 25,
      targetWeights: { areaValue: 1 },
      missionWeights: { elimination: 3, extraction: 2 },
    },
  },
  {
    id: 'DEV_ENEMY_MARK',
    name: 'DEV ENEMY MARK',
    desc: 'Enemy dev test command. Marks a player soldier. No gameplay effect.',
    targetType: COMMANDER_TARGET_TYPES.FRIENDLY_UNIT,
    targetRules: { allowDowned: false },
    requiresLOS: false,
    radius: 0,
    resourceCosts: { credits: 0, alienMaterials: 0, powerCores: 0, nanoCubes: 0 },
    enemyAvailable: true,
    enemyCommandPointCost: 1,
    playerAvailable: false,
    immunityTags: [COMMANDER_IMMUNE_TAG],
    timingType: COMMANDER_TIMING_TYPES.IMMEDIATE,
    usesPerMission: null,
    cooldown: null,
    requiresHighValueConfirmation: false,
    isDev: true,
    aiMetadata: {
      baseValue: 20,
      targetWeights: { threat: 1, exposed: true },
      missionWeights: { sabotage: 2, rescue: 2 },
    },
  },
  {
    id: 'DEV_ENEMY_AP_BOOST',
    name: 'DEV ENEMY AP BOOST',
    desc: 'Enemy dev test command. Would grant +1 AP to an alien. No actual gameplay effect.',
    targetType: COMMANDER_TARGET_TYPES.ENEMY_UNIT,
    targetRules: { allowDowned: false },
    requiresLOS: false,
    radius: 0,
    resourceCosts: { credits: 0, alienMaterials: 0, powerCores: 0, nanoCubes: 0 },
    enemyAvailable: true,
    enemyCommandPointCost: 1,
    playerAvailable: false,
    immunityTags: [COMMANDER_IMMUNE_TAG],
    timingType: COMMANDER_TIMING_TYPES.IMMEDIATE,
    usesPerMission: null,
    cooldown: null,
    requiresHighValueConfirmation: false,
    isDev: true,
    aiMetadata: {
      baseValue: 18,
      targetWeights: { opportunity: 1 },
      missionWeights: { elimination: 2 },
    },
  },
  {
    id: 'DEV_ENEMY_TILE',
    name: 'DEV ENEMY TILE',
    desc: 'Enemy dev test command. Targets a battlefield tile. No gameplay effect.',
    targetType: COMMANDER_TARGET_TYPES.TILE,
    targetRules: {},
    requiresLOS: false,
    radius: 0,
    resourceCosts: { credits: 0, alienMaterials: 0, powerCores: 0, nanoCubes: 0 },
    enemyAvailable: true,
    enemyCommandPointCost: 1,
    playerAvailable: false,
    immunityTags: [],
    timingType: COMMANDER_TIMING_TYPES.IMMEDIATE,
    usesPerMission: null,
    cooldown: null,
    requiresHighValueConfirmation: false,
    isDev: true,
  },
  {
    id: 'DEV_ENEMY_BUDGET_TEST',
    name: 'DEV ENEMY BUDGET',
    desc: 'Enemy dev test command. Costs 2 CP. Budget exhaustion test.',
    targetType: COMMANDER_TARGET_TYPES.GLOBAL,
    targetRules: {},
    requiresLOS: false,
    radius: 0,
    resourceCosts: { credits: 0, alienMaterials: 0, powerCores: 0, nanoCubes: 0 },
    enemyAvailable: true,
    enemyCommandPointCost: 2,
    playerAvailable: false,
    immunityTags: [],
    timingType: COMMANDER_TIMING_TYPES.IMMEDIATE,
    usesPerMission: null,
    cooldown: null,
    requiresHighValueConfirmation: false,
    isDev: true,
  },
];

const ALL_SKILLS = [...DEV_SKILLS, ...PRODUCTION_SKILLS, ...PRODUCTION_ENEMY_SKILLS, ...ENEMY_DEV_SKILLS];
const SKILLS_BY_ID = Object.fromEntries(ALL_SKILLS.map((s) => [s.id, s]));

export function getCommanderSkill(skillId) {
  return SKILLS_BY_ID[skillId] || null;
}

// Deduplicate and filter unknown skill IDs. Unknown IDs (deprecated, invalid,
// or from a future version) are silently dropped — never crash the UI.
export function getCommanderSkillsByIds(skillIds) {
  if (!Array.isArray(skillIds)) return [];
  const seen = new Set();
  const result = [];
  for (const id of skillIds) {
    if (seen.has(id)) continue; // dedup
    const skill = SKILLS_BY_ID[id];
    if (!skill) continue; // unknown — drop silently
    seen.add(id);
    result.push(skill);
  }
  return result;
}

// Deduplicate raw skill IDs (for save normalization). Returns a clean array
// with duplicates removed and unknown IDs dropped.
export function deduplicateSkillIds(skillIds) {
  if (!Array.isArray(skillIds)) return [];
  const seen = new Set();
  const result = [];
  for (const id of skillIds) {
    if (seen.has(id)) continue;
    if (!SKILLS_BY_ID[id]) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

export function getDevCommanderSkillIds() {
  return DEV_SKILLS.map((s) => s.id);
}

export function isDevCommanderSkill(skillId) {
  const skill = SKILLS_BY_ID[skillId];
  return !!(skill && skill.isDev);
}

// --- Enemy Commander skill helpers ---
// Enemy Commanders reuse the same skill registry but pay from a Command Budget
// instead of campaign resources. These helpers read the enemy-specific fields
// (enemyAvailable, enemyCommandPointCost) without affecting player logic.

// Is this skill available to enemy Commanders? Defaults to false.
export function isEnemyCommanderSkill(skillId) {
  const skill = SKILLS_BY_ID[skillId];
  return !!(skill && skill.enemyAvailable === true);
}

// Get the enemy Command Point cost for a skill. Returns 0 if not set or not
// enemy-available. Enemy Commanders pay from the mission-local Command Budget.
export function getEnemyCommandPointCost(skillId) {
  const skill = SKILLS_BY_ID[skillId];
  if (!skill || skill.enemyAvailable !== true) return 0;
  return skill.enemyCommandPointCost || 0;
}

// Get the full skill objects for a list of enemy skill IDs (e.g. from a
// profile.skillIds). Unknown/non-enemy IDs are silently dropped.
export function getEnemyCommanderSkillsByIds(skillIds) {
  if (!Array.isArray(skillIds)) return [];
  const seen = new Set();
  const result = [];
  for (const id of skillIds) {
    if (seen.has(id)) continue;
    const skill = SKILLS_BY_ID[id];
    if (!skill || skill.enemyAvailable !== true) continue;
    seen.add(id);
    result.push(skill);
  }
  return result;
}

// Dev-only enemy skill IDs — used by debug tooling.
export function getDevEnemyCommanderSkillIds() {
  return ENEMY_DEV_SKILLS.map((s) => s.id);
}

// --- Resource cost helpers ---

// Return the normalized resource cost object for a skill. Always includes all
// four resource keys (0 if not declared). Never returns null.
export function getCommanderSkillCost(skillId) {
  const skill = getCommanderSkill(skillId);
  if (!skill) return { credits: 0, alienMaterials: 0, powerCores: 0, nanoCubes: 0 };
  const c = skill.resourceCosts || {};
  return {
    credits: c.credits || 0,
    alienMaterials: c.alienMaterials || 0,
    powerCores: c.powerCores || 0,
    nanoCubes: c.nanoCubes || 0,
  };
}

// Check if a skill has any nonzero resource cost.
export function hasCommanderSkillCost(skillId) {
  const c = getCommanderSkillCost(skillId);
  return c.credits > 0 || c.alienMaterials > 0 || c.powerCores > 0 || c.nanoCubes > 0;
}

// Centralized affordability check. campaignState is the live campaign resource
// object: { credits, alien_materials, powerCores, nanoCubes }.
// Returns { canAfford, missing } where missing lists each deficient resource
// and the shortfall amount. Never allows partial payment.
export function canAffordCommanderSkill(skillId, campaignState) {
  const cost = getCommanderSkillCost(skillId);
  const credits = campaignState?.credits ?? 0;
  const alienMaterials = campaignState?.alien_materials ?? 0;
  const powerCores = campaignState?.powerCores ?? 0;
  const nanoCubes = campaignState?.nanoCubes ?? 0;
  const missing = {};
  if (credits < cost.credits) missing.credits = cost.credits - credits;
  if (alienMaterials < cost.alienMaterials) missing.alienMaterials = cost.alienMaterials - alienMaterials;
  if (powerCores < cost.powerCores) missing.powerCores = cost.powerCores - powerCores;
  if (nanoCubes < cost.nanoCubes) missing.nanoCubes = cost.nanoCubes - nanoCubes;
  return { canAfford: Object.keys(missing).length === 0, missing };
}

// Centralized skill usability query. Single entry point for skill card status
// display. Returns { canUse, status, statusLabel, reason, cooldownRemaining,
// usesRemaining } following the priority order from §18:
//   1. system unavailable
//   2. not Player Phase
//   3. no uses remaining
//   4. cooldown
//   5. insufficient resources
//   6. no valid targets
//   7. available
//
// battleContext = {
//   phase,                        // 'player' | 'enemy'
//   commanderUnlocked,            // boolean
//   battleState,                  // { usesRemainingBySkillId, cooldownsBySkillId }
//   campaignResources,            // { credits, alien_materials, powerCores, nanoCubes }
//   units, grid, GRID_WIDTH, GRID_HEIGHT,  // for valid-target check
// }
export function canUseCommanderSkill(skillId, battleContext) {
  const skill = getCommanderSkill(skillId);
  if (!skill) {
    return { canUse: false, status: COMMANDER_SKILL_STATUS.SYSTEM_UNAVAILABLE, statusLabel: 'UNKNOWN', reason: 'Unknown skill' };
  }
  const { phase, commanderUnlocked, battleState, campaignResources, units, grid, GRID_WIDTH, GRID_HEIGHT } = battleContext || {};

  // 1. System unavailable
  if (!commanderUnlocked) {
    return { canUse: false, status: COMMANDER_SKILL_STATUS.SYSTEM_UNAVAILABLE, statusLabel: COMMANDER_SKILL_STATUS_LABELS[COMMANDER_SKILL_STATUS.SYSTEM_UNAVAILABLE], reason: 'Commander locked' };
  }

  // 2. Not Player Phase
  if (phase !== 'player') {
    return { canUse: false, status: COMMANDER_SKILL_STATUS.WRONG_PHASE, statusLabel: COMMANDER_SKILL_STATUS_LABELS[COMMANDER_SKILL_STATUS.WRONG_PHASE], reason: 'Not Player Phase' };
  }

  // 3. No uses remaining
  const usesRemaining = battleState ? (battleState.usesRemainingBySkillId?.[skillId] ?? skill.usesPerMission) : skill.usesPerMission;
  if (skill.usesPerMission != null && usesRemaining <= 0) {
    return { canUse: false, status: COMMANDER_SKILL_STATUS.NO_USES, statusLabel: COMMANDER_SKILL_STATUS_LABELS[COMMANDER_SKILL_STATUS.NO_USES], reason: 'No uses remaining this mission', usesRemaining: 0 };
  }

  // 4. Cooldown
  const cooldownRemaining = battleState ? (battleState.cooldownsBySkillId?.[skillId] ?? 0) : 0;
  if (cooldownRemaining > 0) {
    return { canUse: false, status: COMMANDER_SKILL_STATUS.ON_COOLDOWN, statusLabel: COMMANDER_SKILL_STATUS_LABELS[COMMANDER_SKILL_STATUS.ON_COOLDOWN], reason: `Cooldown: ${cooldownRemaining}`, cooldownRemaining };
  }

  // 5. Insufficient resources
  if (campaignResources) {
    const afford = canAffordCommanderSkill(skillId, campaignResources);
    if (!afford.canAfford) {
      return { canUse: false, status: COMMANDER_SKILL_STATUS.INSUFFICIENT_RESOURCES, statusLabel: COMMANDER_SKILL_STATUS_LABELS[COMMANDER_SKILL_STATUS.INSUFFICIENT_RESOURCES], reason: getInsufficientResourceLabel(skillId, campaignResources) };
    }
  }

  // 6. No valid targets (only check if board state is provided)
  if (units && grid && GRID_WIDTH && GRID_HEIGHT) {
    const hasValidTarget = checkHasValidTarget(skillId, units, grid, GRID_WIDTH, GRID_HEIGHT);
    if (!hasValidTarget) {
      return { canUse: false, status: COMMANDER_SKILL_STATUS.NO_VALID_TARGETS, statusLabel: COMMANDER_SKILL_STATUS_LABELS[COMMANDER_SKILL_STATUS.NO_VALID_TARGETS], reason: 'No valid targets on the board' };
    }
  }

  // 7. Available
  return {
    canUse: true,
    status: COMMANDER_SKILL_STATUS.AVAILABLE,
    statusLabel: COMMANDER_SKILL_STATUS_LABELS[COMMANDER_SKILL_STATUS.AVAILABLE],
    reason: null,
    cooldownRemaining: 0,
    usesRemaining: skill.usesPerMission != null ? usesRemaining : Infinity,
  };
}

// Check if at least one valid target exists on the board for this skill.
// GLOBAL skills always have a valid target. Unit-targeting skills need at
// least one valid unit. Tile/area skills always have valid tiles (the board
// is non-empty).
function checkHasValidTarget(skillId, units, grid, GRID_WIDTH, GRID_HEIGHT) {
  const skill = getCommanderSkill(skillId);
  if (!skill) return false;
  const battleState = { units, grid, GRID_WIDTH, GRID_HEIGHT };
  switch (skill.targetType) {
    case COMMANDER_TARGET_TYPES.GLOBAL:
    case COMMANDER_TARGET_TYPES.TILE:
    case COMMANDER_TARGET_TYPES.AREA:
    case COMMANDER_TARGET_TYPES.FRIENDLY_AREA:
    case COMMANDER_TARGET_TYPES.ENEMY_AREA:
      return true; // board is non-empty
    case COMMANDER_TARGET_TYPES.FRIENDLY_UNIT:
    case COMMANDER_TARGET_TYPES.ENEMY_UNIT:
    case COMMANDER_TARGET_TYPES.ANY_UNIT:
      return units.some((u) => u.alive && isUnitValidCommanderTarget(skillId, u, battleState));
    default:
      return false;
  }
}

// Human-readable label for the first missing resource (for skill card display).
export function getInsufficientResourceLabel(skillId, campaignState) {
  const { missing } = canAffordCommanderSkill(skillId, campaignState);
  if (missing.credits) return `NEED ${missing.credits} CREDITS`;
  if (missing.alienMaterials) return `NEED ${missing.alienMaterials} ALIEN MATS`;
  if (missing.powerCores) return `NEED ${missing.powerCores} POWER CORE${missing.powerCores !== 1 ? 'S' : ''}`;
  if (missing.nanoCubes) return `NEED ${missing.nanoCubes} NANO CUBE${missing.nanoCubes !== 1 ? 'S' : ''}`;
  return '';
}

// --- Targeting instruction text ---
const TARGETING_INSTRUCTIONS = {
  [COMMANDER_TARGET_TYPES.GLOBAL]: 'No target required — entire battlefield.',
  [COMMANDER_TARGET_TYPES.FRIENDLY_UNIT]: 'Select a friendly unit.',
  [COMMANDER_TARGET_TYPES.ENEMY_UNIT]: 'Select an enemy unit.',
  [COMMANDER_TARGET_TYPES.ANY_UNIT]: 'Select any unit.',
  [COMMANDER_TARGET_TYPES.TILE]: 'Select a battlefield tile.',
  [COMMANDER_TARGET_TYPES.AREA]: 'Select the center of the affected area.',
  [COMMANDER_TARGET_TYPES.FRIENDLY_AREA]: 'Select the center of the friendly area.',
  [COMMANDER_TARGET_TYPES.ENEMY_AREA]: 'Select the center of the enemy area.',
};

export function getCommanderTargetingInstruction(skillId) {
  const skill = getCommanderSkill(skillId);
  if (!skill) return '';
  return TARGETING_INSTRUCTIONS[skill.targetType] || 'Select a target.';
}

// --- Target validation ---

// Check if a unit has an immunity tag that blocks the skill.
function isUnitImmune(unit, skill) {
  if (!unit || !skill.immunityTags || skill.immunityTags.length === 0) return false;
  if (!unit.commanderImmune) return false;
  return skill.immunityTags.includes(COMMANDER_IMMUNE_TAG);
}

// Centralized target validation. Returns { valid, reason }.
// battleState = { units, grid, GRID_WIDTH, GRID_HEIGHT }
// This is the single validation entry point — UI and future AI both call this.
export function isValidCommanderTarget(skillId, target, battleState) {
  const skill = getCommanderSkill(skillId);
  if (!skill) return { valid: false, reason: 'Unknown skill' };
  const { units, GRID_WIDTH: GW, GRID_HEIGHT: GH } = battleState;

  switch (skill.targetType) {
    case COMMANDER_TARGET_TYPES.GLOBAL:
      return { valid: true, reason: null };

    case COMMANDER_TARGET_TYPES.FRIENDLY_UNIT:
    case COMMANDER_TARGET_TYPES.ENEMY_UNIT:
    case COMMANDER_TARGET_TYPES.ANY_UNIT: {
      if (!target || target.kind !== 'unit') return { valid: false, reason: 'Select a unit' };
      const unit = units.find((u) => u.id === target.unitId);
      if (!unit) return { valid: false, reason: 'Unit not found' };
      if (!unit.alive) return { valid: false, reason: 'Unit is not alive' };
      if (unit.downed && !skill.targetRules.allowDowned) {
        return { valid: false, reason: 'CANNOT TARGET DOWNED UNIT' };
      }
      if (skill.targetType === COMMANDER_TARGET_TYPES.FRIENDLY_UNIT && unit.team !== TEAMS.PLAYER) {
        return { valid: false, reason: 'Friendly units only' };
      }
      if (skill.targetType === COMMANDER_TARGET_TYPES.ENEMY_UNIT && unit.team !== TEAMS.ENEMY) {
        return { valid: false, reason: 'Enemy units only' };
      }
      if (isUnitImmune(unit, skill)) {
        return { valid: false, reason: 'IMMUNE TO THIS COMMAND' };
      }
      return { valid: true, reason: null };
    }

    case COMMANDER_TARGET_TYPES.TILE: {
      if (!target || target.kind !== 'tile') return { valid: false, reason: 'Select a tile' };
      if (target.x < 0 || target.x >= GW || target.y < 0 || target.y >= GH) {
        return { valid: false, reason: 'Out of bounds' };
      }
      return { valid: true, reason: null };
    }

    case COMMANDER_TARGET_TYPES.AREA:
    case COMMANDER_TARGET_TYPES.FRIENDLY_AREA:
    case COMMANDER_TARGET_TYPES.ENEMY_AREA: {
      if (!target || target.kind !== 'tile') return { valid: false, reason: 'Select a center tile' };
      if (target.x < 0 || target.x >= GW || target.y < 0 || target.y >= GH) {
        return { valid: false, reason: 'Out of bounds' };
      }
      return { valid: true, reason: null };
    }

    default:
      return { valid: false, reason: 'Unknown target type' };
  }
}

// Check whether a unit is a valid target for a unit-type skill. Used by the
// highlight system to mark valid vs invalid units on the board.
export function isUnitValidCommanderTarget(skillId, unit, battleState) {
  if (!unit || !unit.alive) return false;
  const target = { kind: 'unit', unitId: unit.id };
  return isValidCommanderTarget(skillId, target, battleState).valid;
}

// --- Area calculation ---

// Compute the set of tiles affected by an area skill centered at (cx, cy).
// Clips safely to battlefield bounds — never generates out-of-bounds coords.
export function getCommanderAffectedArea(skillId, cx, cy, GW, GH) {
  const skill = getCommanderSkill(skillId);
  if (!skill) return [];
  const r = skill.radius || 0;
  if (r <= 0) return [{ x: cx, y: cy }];
  const tiles = [];
  for (let dx = -r; dx <= r; dx++) {
    for (let dy = -r; dy <= r; dy++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x >= 0 && x < GW && y >= 0 && y < GH) {
        tiles.push({ x, y });
      }
    }
  }
  return tiles;
}

// Get units occupying the given set of tiles. Used for area preview.
export function getCommanderAffectedUnits(areaTiles, units, teamFilter = null) {
  if (!areaTiles || areaTiles.length === 0) return [];
  const tileSet = new Set(areaTiles.map((t) => `${t.x},${t.y}`));
  return units.filter((u) => {
    if (!u.alive) return false;
    if (!tileSet.has(`${u.x},${u.y}`)) return false;
    if (teamFilter && u.team !== teamFilter) return false;
    return true;
  });
}

// --- Preview generation ---

// Generate the preview payload for a selected target. This is the single
// authoritative preview — the UI renders from this, never approximates.
// context = { units, grid, GRID_WIDTH, GRID_HEIGHT, campaignResources }
// campaignResources is optional — when provided, affordability is computed.
export function getCommanderSkillPreview(skillId, target, context) {
  const skill = getCommanderSkill(skillId);
  if (!skill) return null;
  const { units, grid, GRID_WIDTH: GW, GRID_HEIGHT: GH, campaignResources } = context;
  const battleState = { units, grid, GRID_WIDTH: GW, GRID_HEIGHT: GH };
  const validation = isValidCommanderTarget(skillId, target, battleState);

  const resourceCosts = getCommanderSkillCost(skillId);
  let canAfford = true;
  let missingResources = {};
  let insufficientLabel = '';
  if (campaignResources) {
    const afford = canAffordCommanderSkill(skillId, campaignResources);
    canAfford = afford.canAfford;
    missingResources = afford.missing;
    insufficientLabel = canAfford ? '' : getInsufficientResourceLabel(skillId, campaignResources);
  }

  let targetLabel = '';
  let affectedTiles = [];
  let affectedUnits = [];
  let friendlyUnits = [];
  let enemyUnits = [];
  let effectText = '';

  // Production skills generate their own effect text; dev skills use generic
  // "no gameplay effect" text. This keeps the preview authoritative for both.
  const isProduction = !skill.isDev;

  if (skill.targetType === COMMANDER_TARGET_TYPES.GLOBAL) {
    targetLabel = 'Entire Battlefield';
    effectText = isProduction ? getProductionEffectText(skill, target, units) : 'Test command affects the battlefield. No gameplay effect.';
  } else if (target?.kind === 'unit') {
    const unit = units.find((u) => u.id === target.unitId);
    targetLabel = unit ? unit.name : 'Unknown';
    effectText = isProduction
      ? getProductionEffectText(skill, target, units)
      : `Test command will target ${targetLabel}. No gameplay effect.`;
  } else if (target?.kind === 'tile') {
    targetLabel = `[${target.x}, ${target.y}]`;
    if (skill.targetType === COMMANDER_TARGET_TYPES.TILE) {
      effectText = isProduction ? getProductionEffectText(skill, target, units) : 'Test command will target this tile. No gameplay effect.';
    } else {
      // AREA types
      affectedTiles = getCommanderAffectedArea(skillId, target.x, target.y, GW, GH);
      let teamFilter = null;
      if (skill.targetType === COMMANDER_TARGET_TYPES.FRIENDLY_AREA) teamFilter = TEAMS.PLAYER;
      else if (skill.targetType === COMMANDER_TARGET_TYPES.ENEMY_AREA) teamFilter = TEAMS.ENEMY;
      affectedUnits = getCommanderAffectedUnits(affectedTiles, units, teamFilter);
      friendlyUnits = affectedUnits.filter((u) => u.team === TEAMS.PLAYER);
      enemyUnits = affectedUnits.filter((u) => u.team === TEAMS.ENEMY);
      effectText = isProduction
        ? getProductionEffectText(skill, target, units)
        : `Test command affects ${affectedTiles.length} tiles and ${affectedUnits.length} unit${affectedUnits.length === 1 ? '' : 's'}. No gameplay effect.`;
    }
  }

  return {
    skillId,
    skillName: skill.name,
    targetType: skill.targetType,
    targetLabel,
    affectedTiles,
    affectedUnits,
    friendlyUnits,
    enemyUnits,
    effectText,
    resourceCosts,
    canAfford,
    missingResources,
    insufficientLabel,
    requiresHighValueConfirmation: !!skill.requiresHighValueConfirmation,
    timingType: skill.timingType,
    usesPerMission: skill.usesPerMission,
    cooldown: skill.cooldown,
    canConfirm: validation.valid && canAfford,
    blockReason: !validation.valid ? validation.reason : (!canAfford ? 'INSUFFICIENT RESOURCES' : null),
  };
}

// --- Production effect text ---
// Generates skill-specific effect text for the preview panel. Dev skills
// return '' (the caller falls back to generic dev text). Production skills
// return meaningful effect descriptions with current/after state where relevant.
function getProductionEffectText(skill, target, units) {
  if (skill.id === 'player_tactical_advance') {
    if (target?.kind === 'unit') {
      const unit = units.find((u) => u.id === target.unitId);
      if (unit) {
        return `+1 AP for this Player Phase. Current AP: ${unit.ap} → After: ${unit.ap + 1}`;
      }
    }
    return '+1 AP for this Player Phase.';
  }
  return '';
}

// --- Resolution (dev test only) ---

// Resolve a Commander skill's EFFECT. Called by the transaction function AFTER
// resources have been deducted. The context may include:
//   sourceType — COMMANDER_SOURCE_TYPES.PLAYER_COMMANDER (default) or ENEMY_COMMANDER
//   sourceSide — 'PLAYER' | 'ENEMY' (future enemy Commander)
//   sourceCommanderId — identifier for the commanding entity (future)
//   commandBudgetCost — enemy Command Budget cost (future, separate from resources)
//
// For dev skills, this is a no-op that returns a debug completion message.
// Production skills will be added in a future phase.
//
// IMPORTANT: This function must NOT fail under normal circumstances — all
// validation (target, affordability, phase) happens in the transaction function
// before payment. If this does fail, the transaction function refunds.
export function resolveCommanderSkill(skillId, target, context) {
  const skill = getCommanderSkill(skillId);
  if (!skill) return { ok: false, message: 'Unknown skill' };

  const preview = getCommanderSkillPreview(skillId, target, context);
  if (!preview || !preview.canConfirm) {
    return { ok: false, message: preview?.blockReason || 'Invalid target' };
  }

  // Source type for combat log / effect attribution. Defaults to player.
  const sourceType = context?.sourceType || COMMANDER_SOURCE_TYPES?.PLAYER_COMMANDER || 'PLAYER_COMMANDER';

  // Dev test resolution — no gameplay effect.
  if (skill.isDev) {
    let message = 'COMMAND TEST COMPLETE';
    if (skill.targetType === COMMANDER_TARGET_TYPES.GLOBAL) {
      message += ' — Target: Entire Battlefield';
    } else if (target?.kind === 'unit') {
      const unit = context.units.find((u) => u.id === target.unitId);
      message += ` — Target: ${unit?.name || 'Unknown'}`;
    } else if (target?.kind === 'tile') {
      message += ` — Tile: [${target.x}, ${target.y}]`;
    }
    return { ok: true, message, isDev: true, sourceType };
  }

  // Production enemy Commander skill: Vexar's Tactical Advance.
  // Grants +1 AP to the target alien for the current Enemy Phase. The AP is
  // temporary — enemy AP resets to maxAp at the start of each Enemy Phase, so
  // unused extra AP naturally disappears. The unitEffect is applied by the
  // caller (useEnemyCommander) via setUnits after the transaction commits.
  if (skill.id === 'vexar_tactical_advance') {
    if (!target || target.kind !== 'unit') {
      return { ok: false, message: 'Invalid target' };
    }
    const unit = (context.units || []).find((u) => u.id === target.unitId);
    if (!unit) return { ok: false, message: 'Target unit not found' };
    return {
      ok: true,
      message: 'TACTICAL ADVANCE',
      unitEffect: { type: 'ap_grant', unitId: target.unitId, amount: 1 },
      sourceType,
    };
  }

  // Production player Commander skill: Tactical Advance.
  // Grants +1 AP to the target friendly soldier for the current Player Phase.
  // The AP is temporary — player AP resets to maxAp at the start of each new
  // Player Phase (enemyPhaseRunner.js), so unused bonus AP naturally disappears.
  // The unitEffect is applied by the caller (useCommanderBattle) via setUnits
  // after the transaction commits.
  if (skill.id === 'player_tactical_advance') {
    if (!target || target.kind !== 'unit') {
      return { ok: false, message: 'Invalid target' };
    }
    const unit = (context.units || []).find((u) => u.id === target.unitId);
    if (!unit) return { ok: false, message: 'Target unit not found' };
    return {
      ok: true,
      message: 'TACTICAL ADVANCE',
      unitEffect: { type: 'ap_grant', unitId: target.unitId, amount: 1 },
      sourceType,
    };
  }

  // Unknown production skill.
  return { ok: false, message: 'Skill effect not implemented', sourceType };
}