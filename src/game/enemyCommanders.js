// Enemy Commander profiles — centralized, data-driven registry of off-map
// hostile strategic leaders. Each profile is a named opponent who influences
// the battlefield through strategic commands (future) funded by a mission-
// local Command Budget.
//
// Enemy Commanders are NOT physical battlefield units:
//   - no tile, no HP, no Armor, no movement
//   - not targetable by normal soldiers
//   - do not count toward enemy elimination
//   - do not drop salvage
//
// This module owns:
//   - profile registry + lookup
//   - stable commander IDs (never use display name as the persistent key)
//   - assignment validation (chapter + mission-type restrictions)
//   - hostile commander resolution (mission field + dev override)
//   - display profile (hidden-identity support)
//
// No production Commanders are defined in this phase. DEV_COMMANDER is the
// only profile, used for development testing of assignment, UI, and budget.

// --- Profile registry ---

// DEV_COMMANDER — development-only test profile. Used to validate assignment,
// UI rendering, and Command Budget spending without production behavior.
// Allowed in Chapter 3 only. Not exposed to players.
const DEV_COMMANDER = {
  commanderId: 'DEV_COMMANDER',
  displayName: 'DEV COMMANDER',
  title: 'SYSTEM TEST',
  faction: 'TEST',
  description: 'Development test commander. Validates enemy Commander UI, assignment, and Command Budget. No production behavior.',
  portrait: null, // icon-based — see presentationData
  doctrine: 'Test / Validation',
  skillIds: ['DEV_ENEMY_GLOBAL', 'DEV_ENEMY_MARK', 'DEV_ENEMY_AP_BOOST', 'DEV_ENEMY_TILE', 'DEV_ENEMY_UNIT_TARGET', 'DEV_ENEMY_TILE_TARGET', 'DEV_ENEMY_AREA_TARGET', 'DEV_ENEMY_BUDGET_TEST'],
  commandBudget: 2,
  maxCommandsPerEnemyPhase: 1,
  minimumCommandScore: 25,   // HOLD threshold — actions below this score are skipped
  reserveBias: 0.3,           // moderate willingness to save budget
  emergencyBias: 0.5,         // raises command value when alien force is weak
  allowedChapters: ['ch3'],
  allowedMissionTypes: null, // null = all mission types allowed (dev flexibility)
  territoryTags: [],
  presentationData: { portraitColor: '#a855f7', portraitGlyph: 'bug' },
  aiMetadata: { aggression: 0.5, caution: 0.5 },
  isDev: true,
  isIdentityHidden: false,
};

// VEXAR — THE HUNTSMASTER
// Production enemy Commander. Doctrine: ISOLATION / PURSUIT / ELIMINATION.
// Begins with 2 Command Points and one production command (Tactical Advance).
// Allowed in Chapter 3 only. Automatic assignment is disabled in this phase —
// use the development override to test.
const VEXAR_HUNTMASTER = {
  commanderId: 'vexar_huntsmaster',
  displayName: 'VEXAR',
  title: 'THE HUNTSMASTER',
  faction: 'ALIEN',
  description: 'A patient, predatory commander who isolates and eliminates targets through coordinated pursuit. Directs his forces to act beyond their normal tempo.',
  portrait: null,
  doctrine: 'ISOLATION / PURSUIT / ELIMINATION',
  skillIds: ['vexar_tactical_advance'],
  commandBudget: 2,
  maxCommandsPerEnemyPhase: 1,
  minimumCommandScore: 20,
  reserveBias: 0.25,
  emergencyBias: 0.4,
  allowedChapters: ['ch3'],
  allowedMissionTypes: null, // null = all mission types allowed in permitted chapters
  territoryTags: [],
  presentationData: { portraitColor: '#dc2626', portraitGlyph: 'crosshair' },
  aiMetadata: { aggression: 0.7, caution: 0.3 },
  isDev: false,
  isIdentityHidden: false,
  // Composition preference hook (3.4.1 framework — not yet activated). When
  // wired into generateComposition, these enemies receive a higher effective
  // spawn weight in Vexar's missions. Activation is deferred to 3.4.8 to avoid
  // double-weighting before the featured units exist.
  preferredEnemyIds: ['flash_claw', 'dislocator', 'executioner'],
};

const PRODUCTION_PROFILES = [VEXAR_HUNTMASTER];

const ALL_PROFILES = [DEV_COMMANDER, ...PRODUCTION_PROFILES];
const PROFILES_BY_ID = Object.fromEntries(ALL_PROFILES.map((p) => [p.commanderId, p]));

// --- Lookup ---

// Get a profile by stable commander ID. Returns null for unknown IDs.
export function getEnemyCommanderProfile(commanderId) {
  if (!commanderId) return null;
  return PROFILES_BY_ID[commanderId] || null;
}

// Get all registered profiles (dev + production). Used by debug inspectors.
export function getAllEnemyCommanderProfiles() {
  return ALL_PROFILES.slice();
}

// Dev-only profile IDs — used by debug tooling to populate the force-override
// picker. Production IDs are excluded so they never appear in dev menus until
// they are ready.
export function getDevEnemyCommanderIds() {
  return ALL_PROFILES.filter((p) => p.isDev).map((p) => p.commanderId);
}

// All profile IDs (dev + production) — used by debug tooling to populate the
// force-override picker when production commanders are ready for testing.
export function getAllEnemyCommanderIdsForDebug() {
  return ALL_PROFILES.map((p) => p.commanderId);
}

export function isDevEnemyCommander(commanderId) {
  const p = getEnemyCommanderProfile(commanderId);
  return !!(p && p.isDev);
}

// --- Display profile (hidden-identity support) ---

// Returns a player-facing display object. When isIdentityHidden is true, the
// name and title are masked as "UNKNOWN COMMAND ENTITY" so the player sees a
// hostile presence without the reveal. Budget, doctrine, and known skills
// remain visible (the player can still plan against the budget).
export function getEnemyCommanderDisplayProfile(profile) {
  if (!profile) return null;
  if (profile.isIdentityHidden) {
    return {
      ...profile,
      displayName: 'UNKNOWN COMMAND ENTITY',
      title: 'CLASSIFIED',
      description: 'A hostile command entity is directing enemy forces. Its identity has not been identified.',
      doctrine: 'Unknown',
    };
  }
  return profile;
}

// --- Assignment validation ---

// Validate that a profile is allowed for a given mission context. Checks
// chapter and mission-type restrictions from the profile. Returns
// { valid, reason }. A null profile is always invalid.
//
// chapterId: e.g. 'ch3'
// missionType: one of MISSION_TYPES (ELIMINATION, EXTRACTION, RESCUE, SABOTAGE)
export function validateCommanderAssignment(profile, { chapterId, missionType } = {}) {
  if (!profile) return { valid: false, reason: 'Unknown commander' };
  if (profile.allowedChapters && profile.allowedChapters.length > 0) {
    if (!chapterId || !profile.allowedChapters.includes(chapterId)) {
      return { valid: false, reason: `Commander not permitted in chapter ${chapterId || '??'}` };
    }
  }
  if (profile.allowedMissionTypes && profile.allowedMissionTypes.length > 0) {
    if (!missionType || !profile.allowedMissionTypes.includes(missionType)) {
      return { valid: false, reason: `Commander not permitted in ${missionType || 'this'} missions` };
    }
  }
  return { valid: true, reason: null };
}

// --- Hostile commander resolution ---

// Resolve the effective hostile commander ID for a mission. Precedence:
//   1. devOverride === 'NONE' → explicitly no commander (dev tool)
//   2. devOverride (any other non-null string) → forced commander (dev tool)
//   3. campaignAssignment → dynamic assignment from the assignment system
//   4. mission.hostileCommanderId → mission-defined static assignment
//   5. null → no commander
//
// Returns { commanderId, source } where source is:
//   'dev_override' | 'campaign_assignment' | 'mission_field' | 'none'
// This is the single entry point — mission generation code never hardcodes
// commander logic; it uses the assignment system or sets mission.hostileCommanderId.
export function resolveHostileCommanderId(mission, { devOverride, campaignAssignment } = {}) {
  if (devOverride === 'NONE') return { commanderId: null, source: 'dev_override' };
  if (devOverride) return { commanderId: devOverride, source: 'dev_override' };
  // Dynamic campaign assignment (from enemyCommanderAssignment.js) takes
  // precedence over the static mission field.
  if (campaignAssignment) return { commanderId: campaignAssignment, source: 'campaign_assignment' };
  const id = mission?.hostileCommanderId || null;
  if (!id) return { commanderId: null, source: 'none' };
  return { commanderId: id, source: 'mission_field' };
}

// Convenience: resolve + validate in one call. Returns the profile if the
// assignment is valid, or null with a reason. Used by the battle hook to
// decide whether to initialize enemy Commander state.
export function resolveEnemyCommanderForMission(mission, { devOverride, campaignAssignment } = {}) {
  const { commanderId, source } = resolveHostileCommanderId(mission, { devOverride, campaignAssignment });
  if (!commanderId) return { profile: null, commanderId: null, source, valid: true };
  const profile = getEnemyCommanderProfile(commanderId);
  if (!profile) return { profile: null, commanderId, source, valid: false, reason: 'Unknown commander profile' };
  const check = validateCommanderAssignment(profile, {
    chapterId: mission?.chapterId,
    missionType: mission?.type,
  });
  if (!check.valid) return { profile: null, commanderId, source, valid: false, reason: check.reason };
  return { profile, commanderId, source, valid: true };
}