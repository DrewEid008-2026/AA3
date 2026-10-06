// Enemy Commander tactical AI scoring engine. Pure functions that evaluate
// the battlefield and assign numeric scores to skill-target combinations so the
// decision pipeline (enemyCommanderAi.js) can choose the best legal action or
// HOLD.
//
// Design principles (Implementation 3.2.3):
//   - DETERMINISTIC: no randomness in core scoring. Identical battle states
//     produce identical decisions. Tie-breaking is stable (first-found).
//   - SKILL-SPECIFIC: each skill's aiMetadata defines what makes a target
//     valuable. The scoring engine applies those weights, not a flat formula.
//   - BUDGET-AWARE: expensive commands must clear a higher bar (cost penalty +
//     reserve bias). The last Command Point is not hoarded if the opportunity
//     is valuable.
//   - FAIR: only reads authoritative visible battle state. No hidden player
//     information, no multi-turn simulation, no omniscient prediction.
//   - LIGHTWEIGHT: O(skills × targets) arithmetic — no simulation, no tree
//     search. Mobile-efficient.
//
// This module is used by the AI entry point and by the dev inspector (score
// breakdown display). It never executes commands.

import { TEAMS } from './constants';
import { getUnitWeapon } from './combat';
import { hasStatus, STATUS_TYPES } from './statuses';
import { isInOverwatch } from './reactions';
import {
  getCommanderAffectedArea,
  getCommanderAffectedUnits,
} from './commanderSkills';
import {
  isDevMarked,
  getCommandBudgetCurrent,
  getCommandBudgetMax,
} from './enemyCommanderBattleState';

// --- Scoring constants ---
// Tuned so DEV_COMMANDER (minimumCommandScore = 25) makes meaningful choices.
const COST_PENALTY_PER_CP = 8;       // each CP above 1 subtracts this from the score
const FRIENDLY_FIRE_PER_ALIEN = 12;  // area skills penalized per alien caught in blast
const ALREADY_AFFECTED_PENALTY = 25; // duplicate-status avoidance (e.g. re-Marking)
const DOWNED_PENALTY = 50;           // downed soldiers heavily deprioritized
const RESERVE_PENALTY_MAX = 12;      // cap so a valuable last-CP command still fires
const EMERGENCY_BONUS_MAX = 15;      // raised when alien force is nearly defeated
const EXPOSED_BONUS = 4;             // player soldier not behind cover
const OVERWATCH_THREAT_BONUS = 5;    // overwatching soldiers are high-priority targets
const SUPERPRESSED_PENALTY = 5;      // suppressed soldiers are less threatening

// --- Context shape ---
// ctx = {
//   units, grid, GRID_WIDTH, GRID_HEIGHT,
//   missionConfig,    // { type, isBoss, ... } | null
//   turn,             // current turn number (1-based)
//   battleState,      // enemy commander battle state (budget, uses, cooldowns, devMarkedUnitIds)
//   profile,          // commander profile (for reserveBias, emergencyBias, doctrine)
//   overrides: {      // dev-only tuning overrides
//     holdThreshold,  // override profile.minimumCommandScore
//     reserveBias,     // override profile.reserveBias
//     invalidateTargetId, // force the chosen unit target to fail validation
//   } | null,
// }

// ============================================================
// PLAYER SOLDIER THREAT SCORE
// Reusable approximation of how dangerous a player soldier is right now.
// Returns a numeric score (typically 0-20). Downed soldiers score near 0.
// No hidden bonuses — reads only visible tactical state.
// ============================================================

export function scorePlayerSoldierThreat(unit, ctx = {}) {
  if (!unit || !unit.alive) return 0;
  if (unit.downed) return Math.max(0, 5 - DOWNED_PENALTY); // near-zero but not exactly 0

  let score = 0;

  // HP ratio — healthier soldiers are more threatening (0-6)
  const maxHp = unit.maxHp || 8;
  const hpRatio = Math.max(0, Math.min(1, (unit.hp || 0) / maxHp));
  score += hpRatio * 6;

  // Weapon damage potential (0-5)
  const weapon = getUnitWeapon(unit);
  if (weapon) {
    score += Math.min(5, (weapon.damage || 0) * 0.8);
  }

  // AP remaining — more AP = more actions = more threat (0-4)
  const maxAp = unit.maxAp || 2;
  score += ((unit.ap || 0) / maxAp) * 4;

  // Overwatch — an overwatching soldier controls tiles (high threat)
  if (isInOverwatch(unit)) score += OVERWATCH_THREAT_BONUS;

  // Class-based threat weighting
  const classBonus = CLASS_THREAT_BONUS[unit.class] || 0;
  score += classBonus;

  // Suppressed soldiers are less threatening
  if (hasStatus(unit, STATUS_TYPES.SUPPRESSED)) score -= SUPERPRESSED_PENALTY;
  // Stunned soldiers can't act this phase
  if (hasStatus(unit, STATUS_TYPES.STUNNED)) score -= 8;

  // Objective proximity — soldiers near the objective are higher priority
  // (mission-specific, applied via mission modifier elsewhere)

  return Math.max(0, score);
}

const CLASS_THREAT_BONUS = {
  marksman: 4,   // high damage, long range — top priority
  heavy: 3,      // area denial, shred
  assault: 2,    // aggressive, close-range
  engineer: 1,   // utility, barricades
  support: 1,    // healing, command — lower direct threat
};

// ============================================================
// ALIEN UNIT OPPORTUNITY SCORE
// For commands that buff an alien: how much can that alien DO with the buff?
// Avoids buffing aliens that cannot meaningfully act.
// ============================================================

export function scoreAlienOpportunity(unit, ctx = {}) {
  if (!unit || !unit.alive) return 0;
  if (unit.downed) return 0;

  let score = 0;
  const { units = [], grid = [] } = ctx;

  // AP remaining — more AP = more actions possible (0-6)
  const maxAp = unit.maxAp || 2;
  score += ((unit.ap || 0) / maxAp) * 6;

  // Has valid attack targets — an alien with someone to shoot is a good buff target
  const hasTargets = units.some(
    (t) => t.team === TEAMS.PLAYER && t.alive && !t.downed &&
           Math.max(Math.abs(t.x - unit.x), Math.abs(t.y - unit.y)) <= ((getUnitWeapon(unit)?.range) || 0)
  );
  if (hasTargets) score += 5;

  // Weapon damage — a buff on a hard-hitting alien is more valuable
  const weapon = getUnitWeapon(unit);
  if (weapon) score += Math.min(4, (weapon.damage || 0) * 0.5);

  // Suppressed/stunned aliens can't act — poor buff targets
  if (hasStatus(unit, STATUS_TYPES.SUPPRESSED)) score -= 6;
  if (hasStatus(unit, STATUS_TYPES.STUNNED)) score -= 10;

  return Math.max(0, score);
}

// ============================================================
// AREA TARGET SCORE
// For AREA skills: evaluate the cluster of units affected by centering on a
// tile. Considers player soldiers hit (positive) and alien friendly fire
// (negative). Does NOT simply choose the area with the most units — quality
// matters via per-unit threat.
// ============================================================

export function scoreAreaTarget(skill, cx, cy, ctx = {}) {
  const { units = [], GRID_WIDTH = 9, GRID_HEIGHT = 14 } = ctx;
  const areaTiles = getCommanderAffectedArea(skill.id, cx, cy, GRID_WIDTH, GRID_HEIGHT);
  const affected = getCommanderAffectedUnits(areaTiles, units);

  const players = affected.filter((u) => u.team === TEAMS.PLAYER);
  const aliens = affected.filter((u) => u.team === TEAMS.ENEMY);

  // Player value: sum of standing soldier threat, downed soldiers heavily reduced
  let playerValue = 0;
  for (const p of players) {
    if (p.downed) playerValue += 1; // downed soldiers are low-value area targets
    else playerValue += scorePlayerSoldierThreat(p, ctx);
  }

  // Friendly fire: each alien caught in the area is a penalty
  const alienPenalty = aliens.filter((a) => a.alive && !a.downed).length * FRIENDLY_FIRE_PER_ALIEN;

  return {
    score: Math.max(0, playerValue - alienPenalty),
    playerCount: players.length,
    alienCount: aliens.filter((a) => a.alive).length,
    areaTiles,
  };
}

// ============================================================
// SKILL-TARGET COMBINATION SCORE
// The core scoring function. Computes the full score for one (skill, target)
// pair, including base value, target score, mission modifier, emergency bias,
// budget penalty, reserve penalty, and duplicate-status penalty.
//
// Returns { score, breakdown } where breakdown is a dev-facing list of
// { label, value } components for the debug inspector.
// ============================================================

export function scoreSkillTargetCombination(skill, target, ctx = {}) {
  const breakdown = [];
  const meta = skill.aiMetadata || {};

  // --- Skill-specific scoring: Vexar's Tactical Advance ---
  // Tactical Advance has a dedicated scoring function that produces a detailed
  // breakdown (attack opportunity, movement, ability, pursuit, isolation,
  // objective pressure) for the dev inspector (§37).
  if (skill.id === 'vexar_tactical_advance') {
    const taResult = scoreTacticalAdvance(skill, target, ctx);
    let score = taResult.score;

    // --- Mission modifier ---
    const missionMod = computeMissionModifier(skill, target, ctx);
    if (missionMod !== 0) {
      score += missionMod;
      taResult.breakdown.push({ label: 'Mission Modifier', value: missionMod });
    }

    // --- Emergency bias ---
    const emergency = computeEmergencyBonus(ctx);
    if (emergency !== 0) {
      score += emergency;
      taResult.breakdown.push({ label: 'Emergency Bias', value: emergency });
    }

    // --- Reserve penalty ---
    const cost = skill.enemyCommandPointCost || 0;
    const reservePenalty = computeReservePenalty(cost, ctx);
    if (reservePenalty > 0) {
      score -= reservePenalty;
      taResult.breakdown.push({ label: 'Reserve Bias', value: -reservePenalty });
    }

    return { score: Math.max(0, score), breakdown: taResult.breakdown };
  }

  let score = meta.baseValue || 0;
  breakdown.push({ label: 'Base Value', value: meta.baseValue || 0 });

  // --- Target-specific score ---
  const targetScore = computeTargetScore(skill, target, ctx);
  score += targetScore;
  breakdown.push({ label: 'Target Value', value: targetScore });

  // --- Duplicate status avoidance ---
  const dupPenalty = computeDuplicatePenalty(skill, target, ctx);
  if (dupPenalty !== 0) {
    score += dupPenalty; // negative
    breakdown.push({ label: 'Already Affected', value: dupPenalty });
  }

  // --- Mission modifier ---
  const missionMod = computeMissionModifier(skill, target, ctx);
  if (missionMod !== 0) {
    score += missionMod;
    breakdown.push({ label: 'Mission Modifier', value: missionMod });
  }

  // --- Emergency bias ---
  const emergency = computeEmergencyBonus(ctx);
  if (emergency !== 0) {
    score += emergency;
    breakdown.push({ label: 'Emergency Bias', value: emergency });
  }

  // --- Cost penalty (budget awareness) ---
  const cost = skill.enemyCommandPointCost || 0;
  const costPenalty = (cost - 1) * COST_PENALTY_PER_CP;
  if (costPenalty > 0) {
    score -= costPenalty;
    breakdown.push({ label: 'Cost Penalty', value: -costPenalty });
  }

  // --- Reserve penalty (save budget for better opportunities) ---
  const reservePenalty = computeReservePenalty(cost, ctx);
  if (reservePenalty > 0) {
    score -= reservePenalty;
    breakdown.push({ label: 'Reserve Bias', value: -reservePenalty });
  }

  return { score: Math.max(0, score), breakdown };
}

// --- Target score dispatcher ---
// Applies skill-specific target weights from aiMetadata.targetWeights to the
// appropriate target scoring function.
function computeTargetScore(skill, target, ctx = {}) {
  const meta = skill.aiMetadata || {};
  const weights = meta.targetWeights || {};

  switch (skill.targetType) {
    case 'friendly_unit': {
      // Enemy "friendly" = player soldier (from enemy Commander's perspective,
      // FRIENDLY_UNIT targets the player's team — the soldiers it wants to harm)
      const unit = (ctx.units || []).find((u) => u.id === target?.unitId);
      if (!unit) return 0;
      let s = scorePlayerSoldierThreat(unit, ctx);
      // Exposed bonus: soldier not behind cover (simplified — no cover data in
      // ctx, so we use a proxy: not suppressed and high AP = "exposed")
      if (weights.exposed && unit.ap > 0 && !hasStatus(unit, STATUS_TYPES.SUPPRESSED)) {
        s += EXPOSED_BONUS;
      }
      return s * (weights.threat || 1);
    }

    case 'enemy_unit': {
      // Enemy "enemy" = alien unit (the enemy Commander's own forces)
      const unit = (ctx.units || []).find((u) => u.id === target?.unitId);
      if (!unit) return 0;
      let s = scoreAlienOpportunity(unit, ctx);
      return s * (weights.opportunity || 1);
    }

    case 'any_unit': {
      const unit = (ctx.units || []).find((u) => u.id === target?.unitId);
      if (!unit) return 0;
      if (unit.team === TEAMS.PLAYER) return scorePlayerSoldierThreat(unit, ctx);
      return scoreAlienOpportunity(unit, ctx);
    }

    case 'area':
    case 'friendly_area':
    case 'enemy_area': {
      if (!target || target.kind !== 'tile') return 0;
      const area = scoreAreaTarget(skill, target.x, target.y, ctx);
      return area.score * (weights.areaValue || 1);
    }

    case 'tile': {
      // Tile-targeted skills: low base value unless mission-relevant
      return (weights.tile || 1);
    }

    case 'global': {
      // Global skills: value comes from base + mission modifier, not target
      return 0;
    }

    default:
      return 0;
  }
}

// --- Duplicate status avoidance ---
// If a skill applies a status and the target already has it, apply a penalty.
// For DEV_ENEMY_MARK: checks the dev-marked tracking in battle state.
function computeDuplicatePenalty(skill, target, ctx = {}) {
  if (!target || target.kind !== 'unit') return 0;
  const battleState = ctx.battleState;
  if (!battleState) return 0;

  // DEV_ENEMY_MARK: avoid re-marking an already dev-marked soldier
  if (skill.id === 'DEV_ENEMY_MARK' && isDevMarked(battleState, target.unitId)) {
    return -ALREADY_AFFECTED_PENALTY;
  }

  // Future: real status-based duplicate detection will go here.
  return 0;
}

// --- Mission modifier ---
// Adjusts scores based on mission type and phase. Allows doctrine-specific
// behavior through profile.doctrine.
function computeMissionModifier(skill, target, ctx = {}) {
  const { missionConfig, units = [], turn = 1 } = ctx;
  if (!missionConfig) return 0;

  let mod = 0;
  const type = missionConfig.type;
  const aliensAlive = units.filter((u) => u.team === TEAMS.ENEMY && u.alive && !u.downed).length;
  const playersAlive = units.filter((u) => u.team === TEAMS.PLAYER && u.alive && !u.downed).length;

  // Mission-type weights from skill aiMetadata.missionWeights
  const meta = skill.aiMetadata || {};
  const missionWeights = meta.missionWeights || {};
  if (missionWeights[type]) {
    mod += missionWeights[type];
  }

  // Mission phase awareness
  const isEarly = turn <= 2;
  const alienForceWeak = aliensAlive <= 2 && aliensAlive > 0;

  // Early mission: lower value for aggressive commands (recon phase)
  if (isEarly && meta.baseValue && meta.baseValue > 20) {
    mod -= 3;
  }

  // Sabotage: commands that delay objective access are more valuable
  if (type === 'sabotage' && skill.targetType === 'friendly_unit') {
    mod += 2; // pressuring soldiers near the device
  }

  // Rescue: pressuring escort routes is valuable
  if (type === 'rescue' && skill.targetType === 'friendly_unit') {
    mod += 2;
  }

  // Extraction: denying extraction is valuable late
  if (type === 'extraction' && turn > 3) {
    mod += 3;
  }

  return mod;
}

// --- Emergency bias ---
// Raises command value when the alien force is in trouble (few aliens remain,
// player close to victory). Does NOT grant free Command Points.
function computeEmergencyBonus(ctx = {}) {
  const { units = [], profile } = ctx;
  if (!profile) return 0;

  const emergencyBias = profile.emergencyBias || 0;
  if (emergencyBias <= 0) return 0;

  const aliensAlive = units.filter((u) => u.team === TEAMS.ENEMY && u.alive && !u.downed).length;
  const playersAlive = units.filter((u) => u.team === TEAMS.PLAYER && u.alive && !u.downed).length;

  // Emergency scales up as aliens dwindle
  if (aliensAlive === 0) return 0;
  const alienFraction = aliensAlive / Math.max(1, aliensAlive + playersAlive);
  // When aliens are a small fraction, emergency kicks in
  if (alienFraction > 0.5) return 0; // aliens are fine — no emergency
  const intensity = (0.5 - alienFraction) / 0.5; // 0..1
  return Math.round(emergencyBias * intensity * EMERGENCY_BONUS_MAX);
}

// --- Reserve penalty ---
// Higher reserveBias means the Commander is more willing to HOLD and save
// budget. Scales with the fraction of budget already spent. Capped so a
// genuinely valuable last-CP command still fires (last-point behavior).
function computeReservePenalty(cost, ctx = {}) {
  const { battleState, profile, overrides } = ctx;
  if (!battleState || !profile) return 0;

  const reserveBias = overrides?.reserveBias ?? (profile.reserveBias || 0);
  if (reserveBias <= 0) return 0;

  const current = getCommandBudgetCurrent(battleState);
  const max = getCommandBudgetMax(battleState);
  if (max <= 0) return 0;

  const budgetFractionSpent = 1 - (current / max);
  // Reserve penalty only bites when budget is running low
  if (budgetFractionSpent <= 0.5) return 0;
  const intensity = (budgetFractionSpent - 0.5) / 0.5; // 0..1 in the low half
  return Math.round(reserveBias * intensity * RESERVE_PENALTY_MAX);
}

// ============================================================
// TACTICAL ADVANCE SCORING (Vexar's first production command)
// ============================================================
// Evaluates how much value +1 AP creates for a specific alien. Returns a
// detailed breakdown for the dev inspector (§37):
//   current AP, attack opportunity, movement opportunity, ability opportunity,
//   objective pressure, pursuit value, isolation pressure, final score
//
// Scoring principles (§11-13):
//   HIGH value: alien can attack, move into range, use an ability, flank,
//               pressure an objective, pursue an isolated soldier
//   LOW value:  no useful actions, trapped, stunned, too far, would waste AP
//   DOCTRINE:   Isolation / Pursuit / Elimination — bonus for pressuring
//               isolated or wounded soldiers
//
// This function does NOT simulate — it reads only visible battle state and
// uses lightweight heuristics. No hidden player information.
export function scoreTacticalAdvance(skill, target, ctx = {}) {
  const breakdown = [];
  const meta = skill.aiMetadata || {};
  const units = ctx.units || [];

  const unit = units.find((u) => u.id === target?.unitId);
  if (!unit || !unit.alive || unit.downed) {
    return { score: 0, breakdown: [{ label: 'Invalid Target', value: 0 }] };
  }

  let score = meta.baseValue || 0;
  breakdown.push({ label: 'Base Value', value: score });

  // --- Current AP (informational, 0 score contribution) ---
  const currentAp = unit.ap || 0;
  const maxAp = unit.maxAp || 2;
  breakdown.push({ label: `Current AP: ${currentAp}/${maxAp}`, value: 0 });

  // --- Attack opportunity ---
  // Can the alien attack with the extra AP? Two cases:
  //  a) Already in range — +1 AP means an extra attack
  //  b) Can reach range with movement — +1 AP enables move + attack
  const weapon = getUnitWeapon(unit);
  const weaponRange = weapon?.range || 0;
  const playerUnits = units.filter((t) => t.team === TEAMS.PLAYER && t.alive && !t.downed);

  const hasTargetsInRange = playerUnits.some(
    (t) => Math.max(Math.abs(t.x - unit.x), Math.abs(t.y - unit.y)) <= weaponRange
  );
  const canReachAttackRange = playerUnits.some(
    (t) => Math.max(Math.abs(t.x - unit.x), Math.abs(t.y - unit.y)) <= weaponRange + 3
  );

  let attackOpportunity = 0;
  if (hasTargetsInRange) attackOpportunity = 10;
  else if (canReachAttackRange) attackOpportunity = 6;
  score += attackOpportunity;
  breakdown.push({ label: 'Attack Opportunity', value: attackOpportunity });

  // --- Movement opportunity ---
  // Can the alien reach a better position (cover, flank, higher ground)?
  // Proxy: if not in range but can reach range, movement is valuable.
  let movementOpportunity = 0;
  if (!hasTargetsInRange && canReachAttackRange) movementOpportunity = 4;
  score += movementOpportunity;
  breakdown.push({ label: 'Movement Opportunity', value: movementOpportunity });

  // --- Ability opportunity ---
  // Does the alien have an ability off cooldown that could use the extra AP?
  let abilityOpportunity = 0;
  if (unit.cooldowns) {
    const offCooldown = Object.entries(unit.cooldowns).some(([, cd]) => cd === 0);
    if (offCooldown) abilityOpportunity = 3;
  }
  score += abilityOpportunity;
  breakdown.push({ label: 'Ability Opportunity', value: abilityOpportunity });

  // --- Pursuit value (doctrine: PURSUIT) ---
  // Is there an isolated soldier (few nearby allies) within reach? Vexar's
  // doctrine rewards pressuring isolated targets.
  let pursuitValue = 0;
  for (const p of playerUnits) {
    const nearbyAllies = playerUnits.filter(
      (a) => a.id !== p.id && Math.max(Math.abs(a.x - p.x), Math.abs(a.y - p.y)) <= 3
    ).length;
    if (nearbyAllies <= 1) {
      // Isolated soldier — check if this alien can reach
      const dist = Math.max(Math.abs(p.x - unit.x), Math.abs(p.y - unit.y));
      if (dist <= 6) pursuitValue += 5;
      else if (dist <= 9) pursuitValue += 2;
    }
  }
  score += pursuitValue;
  breakdown.push({ label: 'Pursuit Value', value: pursuitValue });

  // --- Isolation pressure (doctrine: ISOLATION) ---
  // Bonus for aliens near already-isolated soldiers (closing the trap).
  let isolationPressure = 0;
  const isolatedSoldiers = playerUnits.filter((p) => {
    const nearbyAllies = playerUnits.filter(
      (a) => a.id !== p.id && Math.max(Math.abs(a.x - p.x), Math.abs(a.y - p.y)) <= 3
    ).length;
    return nearbyAllies <= 1;
  });
  if (isolatedSoldiers.length > 0) {
    const nearestIsolated = Math.min(
      ...isolatedSoldiers.map((s) => Math.max(Math.abs(s.x - unit.x), Math.abs(s.y - unit.y)))
    );
    if (nearestIsolated <= 4) isolationPressure = 4;
  }
  score += isolationPressure;
  breakdown.push({ label: 'Isolation Pressure', value: isolationPressure });

  // --- Objective pressure (doctrine: ELIMINATION) ---
  // Is the alien near a mission-critical area? Simplified: aliens close to
  // any living player unit are pressuring the squad.
  let objectivePressure = 0;
  if (playerUnits.length > 0) {
    const nearestPlayer = Math.min(
      ...playerUnits.map((p) => Math.max(Math.abs(p.x - unit.x), Math.abs(p.y - unit.y)))
    );
    if (nearestPlayer <= 3) objectivePressure = 3;
    else if (nearestPlayer <= 5) objectivePressure = 1;
  }
  score += objectivePressure;
  breakdown.push({ label: 'Objective Pressure', value: objectivePressure });

  // --- Penalties (§12: low-value targets) ---

  // Stunned: can't meaningfully use AP
  if (hasStatus(unit, STATUS_TYPES.STUNNED)) {
    score -= 15;
    breakdown.push({ label: 'Stunned Penalty', value: -15 });
  }

  // Suppressed: still valid but less effective
  if (hasStatus(unit, STATUS_TYPES.SUPPRESSED)) {
    score -= 4;
    breakdown.push({ label: 'Suppressed Penalty', value: -4 });
  }

  // No useful actions: alien has 0 AP, no targets in range, can't reach range
  if (currentAp <= 0 && !hasTargetsInRange && !canReachAttackRange) {
    score -= 10;
    breakdown.push({ label: 'No Useful Actions', value: -10 });
  }

  // Too far from any relevant interaction
  if (playerUnits.length > 0) {
    const nearestPlayer = Math.min(
      ...playerUnits.map((p) => Math.max(Math.abs(p.x - unit.x), Math.abs(p.y - unit.y)))
    );
    if (nearestPlayer > 9) {
      score -= 8;
      breakdown.push({ label: 'Too Far From Action', value: -8 });
    }
  }

  return { score: Math.max(0, score), breakdown };
}

// --- Exposed bonus accessor (for breakdown display) ---
export function getExposedBonus() { return EXPOSED_BONUS; }
export function getOverwatchBonus() { return OVERWATCH_THREAT_BONUS; }
export function getDownedPenalty() { return DOWNED_PENALTY; }
export function getCostPenaltyPerCp() { return COST_PENALTY_PER_CP; }
export function getFriendlyFirePenalty() { return FRIENDLY_FIRE_PER_ALIEN; }