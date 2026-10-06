// Enemy Commander tactical AI — centralized decision pipeline.
//
// This is the SINGLE entry point for enemy Commander decision-making during
// the Enemy Phase action window. It evaluates the battlefield, scores every
// legal skill-target combination, and returns a decision: either act on the
// best-scoring option or HOLD (spend 0 Command Points).
//
// Evaluation and execution are SEPARATE:
//   - evaluateEnemyCommanderActions() returns a decision object — it does NOT
//     execute anything or spend budget.
//   - The caller (useEnemyCommander.processEnemyCommanderAction) sends the
//     decision to the existing 3.2.2 atomic transaction for execution.
//
// Decision pipeline (Implementation 3.2.3):
//   1. verify Commander may act (phase limit + budget > 0)
//   2. gather usable Commander Skills (profile, enemyAvailable, affordable, uses, cooldown)
//   3. gather valid targets for each skill (shared targeting architecture)
//   4. score each skill-target combination (skill-specific weights)
//   5. compare against HOLD threshold (minimumCommandScore)
//   6. select highest valid score or HOLD
//   7. return { shouldAct, skillId, target, score, reason, breakdown }
//
// Design:
//   - DETERMINISTIC: score-based, no randomness. Identical states → identical
//     decisions. Stable tie-breaking (first-found wins).
//   - BUDGET-AWARE: cost penalty + reserve bias. Last-CP not hoarded if valuable.
//   - FAIR: reads only authoritative visible battle state. No hidden info, no
//     multi-turn prediction.
//   - LIGHTWEIGHT: O(skills × targets) arithmetic. No simulation. Mobile-efficient.
//   - BOSS-COMPATIBLE: Commander AI never interferes with boss AI. Boss abilities
//     and Commander commands are separate systems.

import {
  isValidCommanderTarget,
  getCommanderSkill,
  getEnemyCommandPointCost,
  isEnemyCommanderSkill,
} from './commanderSkills';
import { COMMANDER_SOURCE_TYPES } from './commanderBattleState';
import {
  canIssueCommandThisPhase,
  getEnemyUsesRemaining,
  getEnemyCooldownRemaining,
  getCommandBudgetCurrent,
} from './enemyCommanderBattleState';
import { scoreSkillTargetCombination } from './enemyCommanderAiScoring';

// ============================================================
// CENTRAL AI ENTRY POINT
// ============================================================
//
// evaluateEnemyCommanderActions(profile, battleState, battleContext)
//
// profile          — enemy commander profile (from enemyCommanders.js)
// battleState      — enemy commander battle state (budget, uses, cooldowns)
// battleContext    — { units, grid, GRID_WIDTH, GRID_HEIGHT, missionConfig, turn, overrides }
//
// Returns a decision object:
//   {
//     shouldAct: boolean,
//     skillId: string | null,
//     target: { kind, ... } | null,
//     score: number,                    // chosen action's score (0 if HOLD)
//     reason: string,                   // debug reason string
//     breakdown: [{ label, value }],    // score components for the chosen action
//     candidates: [{ skillId, target, score, reason }],  // all scored options (dev)
//     holdThreshold: number,           // the threshold used
//   }
//
// When shouldAct is false, skillId and target are null, score is 0, and reason
// explains why the Commander held.
export function evaluateEnemyCommanderActions(profile, battleState, battleContext) {
  const ctx = buildContext(profile, battleState, battleContext);

  // 1. Verify Commander may act
  const gateCheck = checkCommanderMayAct(profile, battleState, ctx);
  if (!gateCheck.canAct) {
    return holdDecision(gateCheck.reason, ctx);
  }

  // 2-4. Gather and score all legal skill-target combinations
  const candidates = gatherAndScoreCandidates(profile, battleState, ctx);

  // 5. No legal candidates → HOLD
  if (candidates.length === 0) {
    return holdDecision('No legal commands available — HOLD', ctx, []);
  }

  // 6. Find the highest-scoring candidate (stable: first-found on tie)
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];

  // 7. Compare against HOLD threshold
  const holdThreshold = ctx.overrides?.holdThreshold ?? (profile.minimumCommandScore || 0);
  if (best.score < holdThreshold) {
    return {
      shouldAct: false,
      skillId: null,
      target: null,
      score: best.score,
      reason: `Best score ${best.score} below threshold ${holdThreshold} — HOLD`,
      breakdown: best.breakdown,
      candidates,
      holdThreshold,
    };
  }

  // 8. Dev: invalidate selected target if override is set (tests re-evaluation)
  let chosenTarget = best.target;
  if (ctx.overrides?.invalidateTargetId && best.target?.kind === 'unit' &&
      best.target.unitId === ctx.overrides.invalidateTargetId) {
    // Mark the target as invalid so the transaction revalidates and fails,
    // triggering the caller's one-shot re-evaluation path.
    chosenTarget = { ...best.target, _devInvalidated: true };
  }

  // 9. Return the decision — execution is the caller's responsibility
  return {
    shouldAct: true,
    skillId: best.skillId,
    target: chosenTarget,
    score: best.score,
    reason: best.reason,
    breakdown: best.breakdown,
    candidates,
    holdThreshold,
  };
}

// ============================================================
// DECISION PIPELINE STEPS
// ============================================================

// Build the scoring context object from the raw battle context.
function buildContext(profile, battleState, battleContext) {
  const bc = battleContext || {};
  return {
    units: bc.units || [],
    grid: bc.grid || [],
    GRID_WIDTH: bc.GRID_WIDTH || 9,
    GRID_HEIGHT: bc.GRID_HEIGHT || 14,
    missionConfig: bc.missionConfig || null,
    turn: bc.turn || 1,
    battleState,
    profile,
    overrides: bc.overrides || null,
  };
}

// Step 1: Verify the Commander may act at all.
function checkCommanderMayAct(profile, battleState, ctx) {
  if (!profile || !battleState) {
    return { canAct: false, reason: 'No hostile commander assigned — HOLD' };
  }
  // Phase limit check
  const maxPerPhase = profile.maxCommandsPerEnemyPhase ?? 1;
  if (battleState.commandsUsedThisEnemyPhase >= maxPerPhase) {
    return { canAct: false, reason: `Phase limit reached (${maxPerPhase}) — HOLD` };
  }
  // Budget check — must have at least 1 CP to act
  const budget = getCommandBudgetCurrent(battleState);
  if (budget <= 0) {
    return { canAct: false, reason: 'Command Budget exhausted — HOLD' };
  }
  return { canAct: true };
}

// Steps 2-4: Gather all legal skill-target combinations and score them.
function gatherAndScoreCandidates(profile, battleState, ctx) {
  const candidates = [];

  for (const skillId of profile.skillIds || []) {
    const skill = getCommanderSkill(skillId);
    if (!skill) continue;

    // Filter: enemyAvailable
    if (!isEnemyCommanderSkill(skillId)) continue;

    // Filter: uses remaining
    if (getEnemyUsesRemaining(battleState, skillId) <= 0) continue;

    // Filter: cooldown
    if (getEnemyCooldownRemaining(battleState, skillId) > 0) continue;

    // Filter: affordable
    const cost = getEnemyCommandPointCost(skillId);
    if (!canIssueCommandThisPhase(battleState, profile, cost)) continue;

    // Gather valid targets (shared targeting architecture)
    const targets = getValidCommanderTargets(skillId, ctx, COMMANDER_SOURCE_TYPES.ENEMY_COMMANDER);
    if (targets.length === 0) continue;

    // Score each target
    for (const target of targets) {
      const { score, breakdown } = scoreSkillTargetCombination(skill, target, ctx);
      const reason = buildReasonString(skill, target, score, ctx);
      candidates.push({ skillId, target, score, breakdown, reason });
    }
  }

  return candidates;
}

// Build a debug reason string for the chosen action.
function buildReasonString(skill, target, score, ctx) {
  const targetLabel = describeTarget(target, ctx);
  return `Selected ${skill.id} on ${targetLabel} — score ${score}`;
}

function describeTarget(target, ctx) {
  if (!target) return 'none';
  if (target.kind === 'global') return 'entire battlefield';
  if (target.kind === 'tile') return `tile [${target.x}, ${target.y}]`;
  if (target.kind === 'unit') {
    const unit = (ctx.units || []).find((u) => u.id === target.unitId);
    return unit ? `${unit.name || unit.class || 'unit'} (${unit.team})` : 'unknown unit';
  }
  return 'unknown';
}

// Construct a HOLD decision object.
function holdDecision(reason, ctx, candidates = []) {
  return {
    shouldAct: false,
    skillId: null,
    target: null,
    score: 0,
    reason,
    breakdown: [],
    candidates,
    holdThreshold: ctx.overrides?.holdThreshold ?? (ctx.profile?.minimumCommandScore || 0),
  };
}

// ============================================================
// VALID TARGET QUERY
// ============================================================
//
// Query valid targets for a Commander skill using the same centralized target
// validation as the player. This lets the AI request targets without
// simulated UI taps. Returns a list of valid { kind, ... } targets.
//
// sourceType should be COMMANDER_SOURCE_TYPES.ENEMY_COMMANDER.
//
// For unit-targeting skills: returns all valid living units.
// For tile/area skills: returns all valid center tiles. For AREA skills, this
// is optimized to only return tiles near at least one unit (scoring all 126
// tiles is wasteful when most are empty).
export function getValidCommanderTargets(skillId, battleState, sourceType = COMMANDER_SOURCE_TYPES.ENEMY_COMMANDER) {
  const skill = getCommanderSkill(skillId);
  if (!skill) return [];
  const { units, grid, GRID_WIDTH, GRID_HEIGHT } = battleState || {};
  if (!units || !grid) return [];

  const valid = [];

  // Unit-targeting skills
  if (['friendly_unit', 'enemy_unit', 'any_unit'].includes(skill.targetType)) {
    for (const unit of units) {
      if (!unit.alive) continue;
      const target = { kind: 'unit', unitId: unit.id };
      const check = isValidCommanderTarget(skillId, target, { units, grid, GRID_WIDTH, GRID_HEIGHT });
      if (check.valid) valid.push(target);
    }
    return valid;
  }

  // Global skills — no target needed
  if (skill.targetType === 'global') {
    return [{ kind: 'global' }];
  }

  // Tile/area skills — return candidate center tiles
  if (['tile', 'area', 'friendly_area', 'enemy_area'].includes(skill.targetType)) {
    return getCandidateTiles(skill, units, GRID_WIDTH, GRID_HEIGHT);
  }

  return [];
}

// For tile/area skills: return candidate center tiles. For AREA skills, only
// include tiles within radius of at least one unit (most of the board is empty
// and would score 0). For TILE skills, return a small representative set (the
// tiles near units) rather than all 126 — the AI cares about tactical positions.
function getCandidateTiles(skill, units, GRID_WIDTH, GRID_HEIGHT) {
  const radius = skill.radius || 0;
  const tileSet = new Set();
  const tiles = [];

  const addTile = (x, y) => {
    const key = `${x},${y}`;
    if (tileSet.has(key)) return;
    if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) return;
    tileSet.add(key);
    tiles.push({ kind: 'tile', x, y });
  };

  if (skill.targetType === 'tile') {
    // For TILE skills: tiles near each living unit (tactical positions)
    for (const unit of units) {
      if (!unit.alive) continue;
      addTile(unit.x, unit.y);
      // Adjacent tiles
      addTile(unit.x + 1, unit.y);
      addTile(unit.x - 1, unit.y);
      addTile(unit.x, unit.y + 1);
      addTile(unit.x, unit.y - 1);
    }
    // Always include origin as a fallback
    addTile(0, 0);
  } else {
    // AREA skills: tiles within radius of each living unit
    for (const unit of units) {
      if (!unit.alive) continue;
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          addTile(unit.x + dx, unit.y + dy);
        }
      }
    }
  }

  return tiles;
}

// ============================================================
// LEGACY COMPATIBILITY
// ============================================================
// The 3.2.2 hook called evaluateEnemyCommanderActions and read proposals[0].
// The new API returns a single decision object. This wrapper preserves the old
// array-returning signature for any callers that haven't been updated yet.
// It is NOT used by the updated hook — the hook reads the decision object
// directly. Kept for safety during the transition.
export function evaluateEnemyCommanderActionsLegacy(profile, battleState, battleContext) {
  const decision = evaluateEnemyCommanderActions(profile, battleState, battleContext);
  if (!decision.shouldAct) return [];
  return [{ skillId: decision.skillId, target: decision.target, cost: getEnemyCommandPointCost(decision.skillId) }];
}