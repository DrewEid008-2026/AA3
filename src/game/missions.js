// Structured mission framework. A mission declares its type, objective, enemy
// composition, reinforcement rules, elite response config, and rewards. Map
// configs (deployment, extraction zone, civilian, device, spawn areas) live
// alongside the definitions so Battle.jsx reads everything from one place.
//
// Mission state is a runtime object separate from the definition — it tracks
// the current phase of the state machine (ACTIVE → OBJECTIVE_SECURED → …).
import { MISSION_TYPES, MISSION_STATES, TEAMS } from './constants';
import { STANDARD_BASE_REWARD, STANDARD_ELITE_BONUS } from './rewards';
import { makePlayer, makeEnemy, makeCivilian, makePlayerFromSoldier, makeBossObject } from './units';
import { generateBattlefield, getCompatibleMapIds, MAP_TEMPLATES } from './mapTemplates';
import { getBossMapConfig, BOSS_MAP_ID } from './bossMap';
import { getHarvesterPitConfig, HARVESTER_PIT_MAP_ID } from './harvesterPit';
import { getTutorialMapConfig } from './tutorial/tutorialMap';
import { createInitialTutorialUnits } from './tutorial/tutorialUnits';
import { generateComposition } from './chapterEnemyPools';
import { readActiveCampaign, writeActiveCampaign } from './saveSlots';
import { validateVolatileMapSafety } from './volatileTiles';

// Standard reinforcement wave: 2 Grunts + 1 Rusher.
export const STANDARD_REINFORCEMENT_WAVE = [
  { archetype: 'grunt' },
  { archetype: 'grunt' },
  { archetype: 'rusher' },
];

// Chapter 3 featured reinforcement wave: Dislocator + Executioner + Flash Claw
// Ensures Dislocators and Executioners apply tactical pressure on Chapter 3 maps.
export const CH3_REINFORCEMENT_WAVE = [
  { archetype: 'dislocator' },
  { archetype: 'executioner' },
  { archetype: 'flash_claw' },
];

export function getReinforcementWaveForMission(mission) {
  if (mission?.chapterId === 'ch3') {
    return CH3_REINFORCEMENT_WAVE;
  }
  return STANDARD_REINFORCEMENT_WAVE;
}

// --- Generated map-config cache ---
// A battlefield is generated once per mission attempt and cached by missionId so
// every consumer (Battle, createMissionObjects, createMissionUnitsFromSoldiers)
// reads the SAME generated config. Restart reuses the cached config (same seed)
// so the battlefield is recreated identically; a new mission generates fresh.
const mapConfigCache = {};
let lastGeneratedMapId = null;

export function getLastGeneratedMapId() {
  return lastGeneratedMapId;
}

// Resolve the enemy composition for a mission. Missions with a
// `weightedComposition` config draw from the chapter spawn-weight pool
// (chapterEnemyPools.js) instead of a hardcoded enemy list. Boss and tutorial
// missions always use their explicit `enemies` array.
//
// PERSISTENCE: the generated composition is stored in the save blob
// (campaign.missionCompositions[missionId]) so it survives app reload, mission
// list reopening, and chapter tab switches. Restart reuses the in-memory
// mapConfigCache (which already holds the composition). Old saves without a
// stored composition generate one on first access and persist it — they are
// never migrated or rerolled (old save safety).
function resolveComposition(mission) {
  if (mission.weightedComposition && !mission.isBoss && !mission.isTutorial) {
    // Reuse a persisted composition if one exists for this mission.
    const campaign = readActiveCampaign();
    if (campaign) {
      const stored = campaign.missionCompositions?.[mission.id];
      if (stored && Array.isArray(stored) && stored.length > 0) {
        if (mission.chapterId === 'ch3') {
          const hasClaw = stored.some((e) => e.archetype === 'flash_claw');
          const hasDislocator = stored.some((e) => e.archetype === 'dislocator');
          const hasExecutioner = stored.some((e) => e.archetype === 'executioner');
          if (hasClaw && hasDislocator && hasExecutioner) {
            return stored;
          }
        } else {
          return stored;
        }
      }
    }
    // Generate, persist, and return.
    const composition = generateComposition(mission.chapterId, {
      count: mission.weightedComposition.count ?? 4,
      guaranteeFeatured: mission.weightedComposition.guaranteeFeatured !== false,
      featuredCount: mission.weightedComposition.featuredCount,
      hardenedChance: mission.weightedComposition.hardenedChance ?? 0,
    });
    if (campaign && composition.length > 0) {
      campaign.missionCompositions = { ...(campaign.missionCompositions || {}) };
      campaign.missionCompositions[mission.id] = composition;
      writeActiveCampaign(campaign);
    }
    return composition;
  }
  return mission.enemies || [];
}

// Generate a fresh battlefield for a mission and cache it. `options` passes
// through to generateBattlefield (seed, previousMapId, forceMapId, squadSize).
// Boss missions use a dedicated handcrafted map (Alien Command Nexus), not
// the procedural generator.
export function generateMapConfig(missionId, options = {}) {
  const mission = getMission(missionId);
  if (!mission) return null;
  // Tutorial missions use a dedicated handcrafted map (not procedural).
  if (mission.isTutorial) {
    const cfg = getTutorialMapConfig();
    mapConfigCache[missionId] = cfg;
    lastGeneratedMapId = cfg.mapId;
    return cfg;
  }
  // Boss missions use a handcrafted boss map when bossMapId matches the
  // Chapter 1 Alien Command Nexus. Other boss missions (Chapter 2+) use a
  // generated battlefield so each boss can have its own encounter without
  // rebuilding the handcrafted map architecture.
  if (mission.isBoss) {
    if (mission.bossMapId === BOSS_MAP_ID) {
      const cfg = getBossMapConfig();
      if (cfg) {
        mapConfigCache[missionId] = cfg;
        lastGeneratedMapId = cfg.mapId;
      }
      return cfg;
    }
    if (mission.bossMapId === HARVESTER_PIT_MAP_ID) {
      const cfg = getHarvesterPitConfig();
      if (cfg) {
        mapConfigCache[missionId] = cfg;
        lastGeneratedMapId = cfg.mapId;
      }
      return cfg;
    }
    // Generated boss map — uses elimination-style terrain with the boss's
    // declared enemy composition. The win condition is still "defeat the
    // boss unit" (checked by isObjectiveSecured via mission.isBoss).
    const cfg = generateBattlefield(MISSION_TYPES.ELIMINATION, resolveComposition(mission), {
      previousMapId: lastGeneratedMapId,
      chapterId: mission.chapterId,
      missionId: mission.id,
      ...options,
    });
    if (cfg) {
      mapConfigCache[missionId] = cfg;
      lastGeneratedMapId = cfg.mapId;
    }
    return cfg;
  }
  const cfg = generateBattlefield(mission.type, resolveComposition(mission), {
    previousMapId: lastGeneratedMapId,
    chapterId: mission.chapterId,
    missionId: mission.id,
    ...options,
  });
  if (cfg) {
    mapConfigCache[missionId] = cfg;
    lastGeneratedMapId = cfg.mapId;
  }
  return cfg;
}

// Ensure a config exists for the mission (generate one if missing). Idempotent.
export function ensureMapConfig(missionId) {
  // Tutorial: always return a fresh config (all gates closed) so retry works.
  const mission = getMission(missionId);
  if (mission?.isTutorial) {
    const cfg = getTutorialMapConfig();
    mapConfigCache[missionId] = cfg;
    return cfg;
  }
  if (mapConfigCache[missionId]) return mapConfigCache[missionId];
  return generateMapConfig(missionId);
}

// Force a fresh generation (debug: regenerate variation / force map).
export function regenerateMapConfig(missionId, options = {}) {
  delete mapConfigCache[missionId];
  return generateMapConfig(missionId, options);
}

export function getCompatibleMaps(missionId) {
  const mission = getMission(missionId);
  if (!mission) return [];
  return getCompatibleMapIds(mission.type);
}

export function getAllMapTemplates() {
  return MAP_TEMPLATES;
}

// --- Mission definitions ---

// Chapter 1 Boss mission — Alien Command Nexus. A unique handcrafted
// encounter on a dedicated boss map. The objective is to DEFEAT WARDEN PRIME
// (the boss unit). Two Power Relays flank the Warden as secondary objectives
// (informational this phase — their destruction does not yet trigger Phase 2).
// No reinforcements, no elite response. Boss defeat completes the mission but
// does NOT finalize the chapter yet (temporary QA behavior — see chapter.js).
const CHAPTER1_BOSS = {
  id: 'chapter1_boss',
  chapterId: 'ch1',
  type: MISSION_TYPES.BOSS,
  title: 'Alien Command Nexus',
  objectiveText: 'Defeat Warden Prime',
  secondaryObjectiveText: 'Disable the Power Relays',
  reinforcementRounds: 0,
  baseReward: { credits: 300, alienMaterials: 0, powerCores: 0 },
  eliteBonus: null,
  isBoss: true,
  bossMapId: 'alien_command_nexus_ch1',
  enemies: [
    { archetype: 'warden_prime', isBoss: true },
    { archetype: 'grunt' },
    { archetype: 'grunt' },
    { archetype: 'bulwark' },
  ],
  // Power Relays are boss objects — destructible structures, not standard enemies.
  // They are spawned from the boss map config's bossObjects array.
};

// Tutorial mission — FIRST CONTACT. A handcrafted teaching battlefield with
// six zones. Does NOT count as a campaign mission: no rewards, no chapter
// progress, no reinforcements. Enemies are spawned dynamically by the zone
// controller (useTutorialMission) as the player progresses through zones.
const TUTORIAL_FIRST_CONTACT = {
  id: 'tutorial_first_contact',
  chapterId: 'tutorial',
  type: MISSION_TYPES.ELIMINATION,
  title: 'First Contact',
  objectiveText: 'Eliminate Hostiles',
  subtitle: 'This Seems Bad',
  reinforcementRounds: 0,
  baseReward: { credits: 0, alienMaterials: 0, powerCores: 0 },
  eliteBonus: null,
  isTutorial: true,
  enemies: [],
};

export const MISSIONS = {
  tutorial_first_contact: TUTORIAL_FIRST_CONTACT,
  A: {
    id: 'A',
    chapterId: 'ch1',
    type: MISSION_TYPES.ELIMINATION,
    title: 'Clean Sweep',
    objectiveText: 'Eliminate Hostile Force',
    reinforcementRounds: 4,
    baseReward: STANDARD_BASE_REWARD,
    eliteBonus: STANDARD_ELITE_BONUS,
    // Enemy composition (archetypes only). Positions are assigned by map
    // generation from the selected template's enemy deployment zone.
    enemies: [
      { archetype: 'grunt' },
      { archetype: 'grunt' },
      { archetype: 'rusher' },
      { archetype: 'support' },
      { archetype: 'bulwark' },
      { archetype: 'stalker' },
    ],
  },
  B: {
    id: 'B',
    chapterId: 'ch1',
    type: MISSION_TYPES.EXTRACTION,
    title: 'Exit Strategy',
    objectiveText: 'Reach Extraction Zone',
    reinforcementRounds: 4,
    baseReward: STANDARD_BASE_REWARD,
    eliteBonus: STANDARD_ELITE_BONUS,
    enemies: [
      { archetype: 'grunt' },
      { archetype: 'grunt' },
      { archetype: 'rusher' },
      { archetype: 'disruptor' },
    ],
  },
  C: {
    id: 'C',
    chapterId: 'ch1',
    type: MISSION_TYPES.RESCUE,
    title: 'Civilian Rescue',
    objectiveText: 'Rescue the Civilian',
    reinforcementRounds: 4,
    baseReward: STANDARD_BASE_REWARD,
    eliteBonus: STANDARD_ELITE_BONUS,
    enemies: [
      { archetype: 'grunt' },
      { archetype: 'grunt' },
      { archetype: 'rusher' },
      { archetype: 'stalker' },
    ],
  },
  D: {
    id: 'D',
    chapterId: 'ch1',
    type: MISSION_TYPES.SABOTAGE,
    title: 'Sabotage',
    objectiveText: 'Sabotage Objective Device',
    reinforcementRounds: 3,
    baseReward: STANDARD_BASE_REWARD,
    eliteBonus: STANDARD_ELITE_BONUS,
    enemies: [
      { archetype: 'grunt' },
      { archetype: 'rusher' },
      { archetype: 'bulwark' },
      { archetype: 'artillery' },
    ],
  },
  chapter1_boss: CHAPTER1_BOSS,
  // --- Chapter 2 standard missions ---
  // Chapter 2 reuses Chapter 1 mission types, enemies, maps, and rewards.
  // Distinct IDs keep progress and missionChapterId separate per chapter.
  // Chapter 2 compositions communicate a larger invasion force: hardened
  // variants of familiar enemies plus the new Bastion Mech and Alien
  // Fabricator. Bastion is uncommon (0-1 per encounter) so seeing one still
  // matters. The Fabricator+Bastion pairing creates target-priority tension.
  ch2_A: {
    id: 'ch2_A',
    chapterId: 'ch2',
    type: MISSION_TYPES.ELIMINATION,
    title: 'Clean Sweep',
    objectiveText: 'Eliminate Hostile Force',
    reinforcementRounds: 4,
    baseReward: STANDARD_BASE_REWARD,
    eliteBonus: STANDARD_ELITE_BONUS,
    // Armored Push — the showcase encounter.
    enemies: [
      { archetype: 'bastion' },
      { archetype: 'fabricator' },
      { archetype: 'grunt', hardened: true },
      { archetype: 'grunt', hardened: true },
    ],
  },
  ch2_B: {
    id: 'ch2_B',
    chapterId: 'ch2',
    type: MISSION_TYPES.EXTRACTION,
    title: 'Exit Strategy',
    objectiveText: 'Reach Extraction Zone',
    reinforcementRounds: 4,
    baseReward: STANDARD_BASE_REWARD,
    eliteBonus: STANDARD_ELITE_BONUS,
    // Hardened infantry pressure, no Bastion.
    enemies: [
      { archetype: 'grunt', hardened: true },
      { archetype: 'rusher', hardened: true },
      { archetype: 'support', hardened: true },
      { archetype: 'disruptor', hardened: true },
    ],
  },
  ch2_C: {
    id: 'ch2_C',
    chapterId: 'ch2',
    type: MISSION_TYPES.RESCUE,
    title: 'Civilian Rescue',
    objectiveText: 'Rescue the Civilian',
    reinforcementRounds: 4,
    baseReward: STANDARD_BASE_REWARD,
    eliteBonus: STANDARD_ELITE_BONUS,
    // Engineering Corps — the Fabricator reshapes the battlefield.
    enemies: [
      { archetype: 'fabricator' },
      { archetype: 'bulwark', hardened: true },
      { archetype: 'grunt', hardened: true },
      { archetype: 'stalker', hardened: true },
    ],
  },
  ch2_D: {
    id: 'ch2_D',
    chapterId: 'ch2',
    type: MISSION_TYPES.SABOTAGE,
    title: 'Sabotage',
    objectiveText: 'Sabotage Objective Device',
    reinforcementRounds: 3,
    baseReward: STANDARD_BASE_REWARD,
    eliteBonus: STANDARD_ELITE_BONUS,
    // Siege Team — the defensive position is attacked from multiple angles.
    enemies: [
      { archetype: 'bastion' },
      { archetype: 'artillery', hardened: true },
      { archetype: 'support', hardened: true },
      { archetype: 'grunt', hardened: true },
    ],
  },
  // --- Chapter 2 Boss: The Harvester ---
  // A replayable boss encounter. Uses a generated battlefield (not the
  // handcrafted Chapter 1 boss map). The win condition is "defeat the
  // Harvester" (the isBoss unit). Awards +1 Nano Cube per successful victory
  // (data-driven via the chapter def's nanoCubeReward, committed in
  // missionCommit.js). No reinforcements, no elite response.
  chapter2_boss: {
    id: 'chapter2_boss',
    chapterId: 'ch2',
    type: MISSION_TYPES.BOSS,
    title: 'The Harvester',
    objectiveText: 'Defeat The Harvester',
    secondaryObjectiveText: 'Recover the Nano Cube',
    reinforcementRounds: 0,
    baseReward: { credits: 400, alienMaterials: 0, powerCores: 0 },
    eliteBonus: null,
    isBoss: true,
    // Unique handcrafted arena: The Harvester Pit (alien industrial excavation).
    bossMapId: 'harvester_pit_ch2',
    enemies: [
      { archetype: 'harvester', isBoss: true },
      { archetype: 'grunt', hardened: true },
      { archetype: 'grunt', hardened: true },
      { archetype: 'bulwark' },
      { archetype: 'stalker' },
    ],
  },
  // --- Chapter 3 standard missions ---
  // Chapter 3 (ADAPTATION) reuses the standard mission types and temporarily
  // borrows the Chapter 2 enemy pool until Chapter 3-specific enemies are
  // implemented. Distinct IDs keep progress and missionChapterId separate.
  // briefingText communicates the enemy's shifting, adaptive response.
  // Chapter 3 uses the data-driven chapter spawn-weight framework
  // (chapterEnemyPools.js) instead of hardcoded enemy lists. The weighted
  // pool favors featured enemies (flash_claw, dislocator, executioner) once
  // implemented; until then it draws from the existing roster at Chapter 3
  // weights. guaranteeFeatured ensures at least one featured enemy appears
  // per mission once their unit definitions exist (3.4.2-3.4.4).
  ch3_A: {
    id: 'ch3_A',
    chapterId: 'ch3',
    type: MISSION_TYPES.ELIMINATION,
    title: 'Adaptive Response',
    objectiveText: 'Eliminate Hostile Force',
    briefingText: 'Alien units in this sector are displaying coordinated response patterns. Eliminate the hostile force.',
    reinforcementRounds: 4,
    baseReward: STANDARD_BASE_REWARD,
    eliteBonus: STANDARD_ELITE_BONUS,
    hostileCommanderId: 'vexar_huntsmaster',
    weightedComposition: { count: 6, hardenedChance: 0.5, featuredCount: 3 },
  },
  ch3_B: {
    id: 'ch3_B',
    chapterId: 'ch3',
    type: MISSION_TYPES.EXTRACTION,
    title: 'Watched Exit',
    objectiveText: 'Reach Extraction Zone',
    briefingText: 'The enemy appears to be monitoring resistance movement. Secure the objective and extract.',
    reinforcementRounds: 4,
    baseReward: STANDARD_BASE_REWARD,
    eliteBonus: STANDARD_ELITE_BONUS,
    hostileCommanderId: 'vexar_huntsmaster',
    weightedComposition: { count: 5, hardenedChance: 0.5, featuredCount: 2 },
  },
  ch3_C: {
    id: 'ch3_C',
    chapterId: 'ch3',
    type: MISSION_TYPES.RESCUE,
    title: 'Targeted Rescue',
    objectiveText: 'Rescue the Civilian',
    briefingText: 'Alien forces are targeting civilians and resistance contacts with increasing precision. Recover the survivors.',
    reinforcementRounds: 4,
    baseReward: STANDARD_BASE_REWARD,
    eliteBonus: STANDARD_ELITE_BONUS,
    hostileCommanderId: 'vexar_huntsmaster',
    weightedComposition: { count: 5, hardenedChance: 0.5, featuredCount: 2 },
  },
  ch3_D: {
    id: 'ch3_D',
    chapterId: 'ch3',
    type: MISSION_TYPES.SABOTAGE,
    title: 'Adaptive Sabotage',
    objectiveText: 'Sabotage Objective Device',
    briefingText: 'Disrupt the alien operation before its adaptive command network can respond.',
    reinforcementRounds: 3,
    baseReward: STANDARD_BASE_REWARD,
    eliteBonus: STANDARD_ELITE_BONUS,
    hostileCommanderId: 'vexar_huntsmaster',
    weightedComposition: { count: 5, hardenedChance: 0.5, featuredCount: 2 },
  },
};

const DYNAMIC_MISSIONS = {};

export function registerDynamicMission(mission) {
  if (!mission || !mission.id) return;
  DYNAMIC_MISSIONS[mission.id] = mission;
}

export function getMission(id) {
  if (!id) return null;
  if (MISSIONS[id]) return MISSIONS[id];
  if (DYNAMIC_MISSIONS[id]) return DYNAMIC_MISSIONS[id];
  const campaign = readActiveCampaign();
  if (campaign?.dynamicMissions?.[id]) {
    DYNAMIC_MISSIONS[id] = campaign.dynamicMissions[id];
    return DYNAMIC_MISSIONS[id];
  }
  return null;
}

// Generates a NEW mission instance of the same missionType for the current chapter context.
// Produces a unique mission ID, distinct enemy composition, new map variations, and
// respects Chapter 3 featured enemy weighting, Volatile Ground, and hostile commander rules.
export function createReplayMissionInstance(previousMission, chapterId) {
  const targetChapterId = chapterId || previousMission?.chapterId || 'ch1';
  const missionType = previousMission?.type || MISSION_TYPES.ELIMINATION;
  const newMissionId = `replay_${targetChapterId}_${missionType}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  // Find baseline template for this type in targetChapterId
  const template = Object.values(MISSIONS).find(
    (m) => m.chapterId === targetChapterId && m.type === missionType && !m.isBoss && !m.isTutorial
  ) || Object.values(MISSIONS).find(
    (m) => m.type === missionType && !m.isBoss && !m.isTutorial
  ) || MISSIONS.A;

  const newMission = {
    ...template,
    id: newMissionId,
    chapterId: targetChapterId,
    type: missionType,
    isReplayInstance: true,
  };

  // For Chapter 3 Sabotage, ensure hostile commander assignment evaluates normally
  if (targetChapterId === 'ch3' && missionType === MISSION_TYPES.SABOTAGE) {
    newMission.hostileCommanderId = 'vexar_huntsmaster';
  } else {
    delete newMission.hostileCommanderId;
  }

  // Register in-memory
  registerDynamicMission(newMission);

  // Persist into active campaign blob so reload survives
  const campaign = readActiveCampaign();
  if (campaign) {
    campaign.dynamicMissions = { ...(campaign.dynamicMissions || {}) };
    campaign.dynamicMissions[newMissionId] = newMission;
    writeActiveCampaign(campaign);
  }

  return newMission;
}

// Returns the cached generated battlefield config for a mission. If none is
// cached (e.g. direct navigation without going through Deploy), one is
// generated on demand so the mission can still start.
export function getMissionMapConfig(id) {
  return ensureMapConfig(id);
}

// Returns the cached generated grid for a mission (or generates one).
export function getMissionGrid(id) {
  const cfg = ensureMapConfig(id);
  return cfg ? cfg.grid : null;
}

// Standard missions only (excludes boss missions). When a chapterId is given,
// returns only the standard missions belonging to that chapter. Without a
// chapterId, returns all standard missions (backward compat).
export function getMissionList(chapterId) {
  return Object.values(MISSIONS).filter((m) => {
    if (m.isBoss) return false;
    if (m.isTutorial) return false;
    if (chapterId && m.chapterId !== chapterId) return false;
    return true;
  });
}

// The boss mission for the given chapter, or the first boss if no chapterId is
// given. Returns null if the chapter has no boss mission definition (e.g.
// Chapter 2's placeholder boss is not yet implemented).
export function getBossMission(chapterId) {
  return Object.values(MISSIONS).find((m) => {
    if (!m.isBoss) return false;
    if (chapterId && m.chapterId !== chapterId) return false;
    return true;
  }) || null;
}

// --- Unit / object creation ---

export function createMissionUnits(missionId) {
  const cfg = getMissionMapConfig(missionId);
  if (!cfg) return [];
  const units = [];
  for (const p of cfg.players) units.push(makePlayer(p.archetype, p.x, p.y));
  for (const e of cfg.enemies) units.push(makeEnemy(e.archetype, e.x, e.y));
  return units;
}

// Create tactical units from persistent soldier records. Only alive soldiers
// deploy; dead soldiers are skipped (the mission can run with fewer units).
export function createMissionUnitsFromSoldiers(missionId, soldiers, selectedIds) {
  const cfg = getMissionMapConfig(missionId);
  if (!cfg) return [];
  // Tutorial: create temporary tutorial units, ignore persistent soldiers.
  const mission = getMission(missionId);
  if (mission?.isTutorial) {
    return createInitialTutorialUnits();
  }
  const units = [];
  // Use selected IDs if provided, else auto-select Ready soldiers up to the
  // number of deployment positions (backward compatibility for direct nav).
  const ids = selectedIds && selectedIds.length > 0
    ? selectedIds
    : soldiers.filter((s) => s.alive && !s.injured).slice(0, cfg.players.length).map((s) => s.id);
  for (let i = 0; i < ids.length && i < cfg.players.length; i++) {
    const soldier = soldiers.find((s) => s.id === ids[i]);
    if (soldier && soldier.alive && !soldier.injured) {
      const pos = cfg.players[i];
      units.push(makePlayerFromSoldier(soldier, pos.x, pos.y));
    }
  }
  for (const e of cfg.enemies) {
    units.push(makeEnemy(e.archetype, e.x, e.y, { isBoss: !!e.isBoss, hardened: !!e.hardened, elite: !!e.elite }));
  }
  // Boss objects (Power Relays) — destructible structures, not standard enemies.
  if (cfg.bossObjects) {
    for (const obj of cfg.bossObjects) {
      units.push(makeBossObject(obj));
    }
  }
  return units;
}

export function createMissionObjects(missionId) {
  const cfg = getMissionMapConfig(missionId);
  if (!cfg) return { civilian: null, device: null, extractionZone: null };
  return {
    civilian: cfg.civilian ? makeCivilian(cfg.civilian.x, cfg.civilian.y) : null,
    device: cfg.device ? { x: cfg.device.x, y: cfg.device.y, sabotaged: false } : null,
    extractionZone: cfg.extractionZone ? cfg.extractionZone.map((t) => ({ ...t })) : null,
  };
}

// --- Runtime state ---

// Runtime starts in INITIALIZING. Victory/failure evaluation is disabled until
// `activateMissionRuntime` transitions to ACTIVE after setup validation.
export function createInitialMissionRuntime(missionId) {
  const mission = getMission(missionId);
  if (!mission) return null;
  return {
    missionId,
    state: MISSION_STATES.INITIALIZING,
    missionInitialized: false,
    hasGameplayStarted: false,
    setupError: null,
    round: 1,
    reinforcementCountdown: mission.reinforcementRounds,
    standardReinforcementSpawned: false,
    reinforcementCanceled: false,
    eliteResponseAccepted: false,
    eliteResponseSpawned: false,
    eliteResponseDefeated: false,
    baseRewardSecured: false,
    eliteRewardSecured: false,
  };
}

// Lightweight setup validation. Confirms each mission type's required entities
// exist before gameplay begins. A failed validation is a development/config
// error — never a player mission failure. Also validates volatile tile safety (spec 31-32).
export function validateMissionSetup(mission, units, civilian, device, extractionZone, grid, mapConfig) {
  if (!mission) return { valid: false, reason: 'Unknown mission' };
  const players = units.filter((u) => u.team === TEAMS.PLAYER && u.alive);
  const enemies = units.filter((u) => u.team === TEAMS.ENEMY && u.alive);
  if (players.length === 0) return { valid: false, reason: 'No deployable player units' };
  // Tutorial: enemies are spawned dynamically; don't require them at setup.
  if (mission.isTutorial) {
    return { valid: true, reason: null };
  }

  // Volatile map safety validation (spec 31, 32): warn if volatile hazards
  // overlap player/enemy deployment, extraction, or mandatory objective devices.
  if (grid) {
    validateVolatileMapSafety(grid, {
      playerDeploy: units.filter((u) => u.team === TEAMS.PLAYER).map((u) => ({ x: u.x, y: u.y })),
      enemyDeploy: units.filter((u) => u.team === TEAMS.ENEMY).map((u) => ({ x: u.x, y: u.y })),
      reinforcementSpawns: mapConfig?.reinforcementSpawns || [],
      extractionZone: extractionZone || [],
      objectiveTiles: [civilian, device].filter(Boolean).map((o) => ({ x: o.x, y: o.y })),
    });
  }
  switch (mission.type) {
    case MISSION_TYPES.ELIMINATION:
      if (enemies.length === 0) return { valid: false, reason: 'Elimination requires an enemy force' };
      break;
    case MISSION_TYPES.EXTRACTION:
      if (!extractionZone || extractionZone.length === 0) return { valid: false, reason: 'Extraction requires an extraction zone' };
      break;
    case MISSION_TYPES.RESCUE:
      if (!civilian) return { valid: false, reason: 'Rescue requires a civilian' };
      if (!extractionZone || extractionZone.length === 0) return { valid: false, reason: 'Rescue requires an extraction zone' };
      break;
    case MISSION_TYPES.SABOTAGE:
      if (!device) return { valid: false, reason: 'Sabotage requires an objective device' };
      break;
    case MISSION_TYPES.BOSS:
      if (enemies.length === 0) return { valid: false, reason: 'Boss mission requires enemies' };
      break;
    default:
      return { valid: false, reason: 'Unknown mission type' };
  }
  return { valid: true, reason: null };
}

// Transition INITIALIZING → ACTIVE. Called once after setup is validated.
// Sets the flags that unlock victory/failure evaluation and the first Player Phase.
export function activateMissionRuntime(runtime) {
  return {
    ...runtime,
    state: MISSION_STATES.ACTIVE,
    missionInitialized: true,
    hasGameplayStarted: true,
  };
}

// --- Objective checks ---

// Is the primary objective met? Called after every state change to detect
// completion as soon as it happens (not only at end of round).
export function isObjectiveSecured(mission, units, civilian, device, extractedIds) {
  switch (mission.type) {
    case MISSION_TYPES.ELIMINATION:
      return !units.some((u) => u.team === TEAMS.ENEMY && u.alive);
    case MISSION_TYPES.EXTRACTION: {
      const living = units.filter((u) => u.team === TEAMS.PLAYER && u.alive);
      return living.length > 0 && living.every((u) => extractedIds.has(u.id));
    }
    case MISSION_TYPES.RESCUE:
      return !!(civilian && civilian.safe);
    case MISSION_TYPES.SABOTAGE:
      return !!(device && device.sabotaged);
    case MISSION_TYPES.BOSS:
      // Boss objective: defeat the Warden (the unit with isBoss = true).
      // Supporting enemies (grunts, bulwark) and relays do NOT need to be dead.
      return !units.some((u) => u.team === TEAMS.ENEMY && u.alive && u.isBoss);
    default:
      return false;
  }
}

// Display text for the objective line in the top HUD.
export function getObjectiveDisplayText(mission, runtime) {
  if (!mission || !runtime) return '';
  if (runtime.state === MISSION_STATES.OBJECTIVE_SECURED) return 'OBJECTIVE SECURED';
  if (runtime.state === MISSION_STATES.ELITE_RESPONSE_ACTIVE) return 'ELITE RESPONSE ACTIVE';
  return mission.objectiveText;
}

// Is a tile inside the extraction zone?
export function isInExtractionZone(extractionZone, x, y) {
  if (!extractionZone) return false;
  return extractionZone.some((t) => t.x === x && t.y === y);
}

// Chebyshev distance 1 (adjacent including diagonals).
export function isAdjacent(a, b) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) === 1;
}