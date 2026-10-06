// Executioner AI — Isolated-Target Hunter / Ranged Finisher (Implementation 3.4.4).
//
// The Executioner strongly prefers targets where Lone Prey is active (no
// active friendly soldier within 2 tiles). It uses a multi-factor scoring
// model (spec 16) that balances isolation against normal tactical value,
// so it does NOT blindly choose terrible isolated targets over
// overwhelmingly better normal targets (spec 18).
//
// This module provides `executionerBestAttack`, called from ai.js's
// `bestAttackFrom` when the attacker is an Executioner. It replaces the
// generic lethal-first/flank ranking with isolation-aware scoring. The
// generic flow handles movement and repositioning via `scoreTile` (which
// calls `bestAttackFrom`, so it also benefits from isolation-aware scoring).
//
// The Executioner has no active ability — it is a pure ranged hunter with
// the Lone Prey passive. Two-AP behavior (Move → Attack, Attack → reposition)
// uses the normal enemy AP architecture (spec 24-25).

import {
  gridDistance, attackIsValid, computeDamage, getUnitWeapon,
} from './combat';
import { hasAmmo } from './ammo';
import { isIsolated } from './lonePrey';
import { TEAMS } from './constants';

// Data-driven scoring weights (spec 16-18). Tunable without logic changes.
const SCORE_WEIGHTS = {
  killBonus: 1000,           // guaranteed Down dominates everything (spec 18)
  isolatedBonus: 300,         // strong preference for isolated targets (spec 15)
  isolatedWounded: 100,       // priority 2: wounded isolated (spec 17)
  isolatedExposed: 80,        // priority 3: exposed/flanked isolated (spec 17)
  isolatedThreat: 20,         // priority 4: high-threat isolated (spec 17)
  flankedBonus: 60,           // normal tactical: flanked
  exposedBonus: 30,           // normal tactical: exposed
  woundedBonus: 20,            // normal tactical: wounded
  threatValue: 10,            // normal tactical: threat weighting
  followUpPerEnemy: 8,         // futureFollowUpPotential (spec 16)
  distancePenalty: 2,          // closer targets are slightly preferred
};

function playersOf(units) {
  return units.filter((u) => u.alive && u.team === TEAMS.PLAYER && !u.downed);
}

function enemiesOf(units) {
  return units.filter((u) => u.alive && u.team === TEAMS.ENEMY);
}

// Threat value: higher-damage weapons are more threatening (spec 17 priority 4).
// A Marksman with a sniper rifle is higher threat than a Support with a rifle.
function targetThreatValue(target) {
  const weapon = getUnitWeapon(target);
  return weapon ? weapon.damage : 1;
}

// Count other living enemies that can attack a target from current positions.
// Used for futureFollowUpPotential (spec 16).
function enemiesAbleToAttack(grid, units, target) {
  let n = 0;
  for (const e of enemiesOf(units)) {
    if (attackIsValid(grid, e, target)) n++;
  }
  return n;
}

// Multi-factor target scoring (spec 16-18). Higher is better.
//
// Priority order (spec 17):
//   1. isolated standing soldier that can be Downed  → kill (1000) + isolated (300)
//   2. wounded isolated soldier                     → isolated (300) + wounded (100)
//   3. exposed isolated soldier                     → isolated (300) + exposed (80)
//   4. high-threat isolated soldier                  → isolated (300) + threat*20
//   5. other isolated soldier                        → isolated (300)
//   6. best normal tactical target                   → normal factors only
//
// Spec 18 (common sense): a guaranteed Down on a non-isolated target (1000)
// always beats an isolated non-kill (~300-500), so the AI may choose the
// better normal target.
function scoreExecutionerTarget(grid, units, enemy, target, outcome) {
  const isolated = isIsolated(target, units);
  const wounded = target.maxHp > 0 && target.hp < target.maxHp;
  const exposed = outcome.state === 'exposed';
  const flanked = outcome.state === 'flanked';
  const canDown = outcome.killed;
  const threat = targetThreatValue(target);
  const distance = gridDistance(enemy, target);
  const followUp = enemiesAbleToAttack(grid, units, target);

  let score = 0;

  // Kills always dominate (spec 17 priority 1, spec 18 common sense).
  if (canDown) score += SCORE_WEIGHTS.killBonus;

  if (isolated) {
    // Strong isolation preference (spec 15).
    score += SCORE_WEIGHTS.isolatedBonus;
    // Priority sub-rankings (spec 17).
    if (wounded) score += SCORE_WEIGHTS.isolatedWounded;       // priority 2
    if (exposed || flanked) score += SCORE_WEIGHTS.isolatedExposed; // priority 3
    score += threat * SCORE_WEIGHTS.isolatedThreat;             // priority 4
    // priority 5: other isolated — just the base bonus
  }

  // Normal tactical factors (spec 18: don't obsess over isolation).
  if (flanked) score += SCORE_WEIGHTS.flankedBonus;
  else if (exposed) score += SCORE_WEIGHTS.exposedBonus;
  if (wounded) score += SCORE_WEIGHTS.woundedBonus;
  score += threat * SCORE_WEIGHTS.threatValue;
  score += followUp * SCORE_WEIGHTS.followUpPerEnemy; // futureFollowUpPotential
  score -= distance * SCORE_WEIGHTS.distancePenalty;

  return score;
}

// Isolation-aware best attack for the Executioner. Replaces the generic
// bestAttackFrom ranking when the attacker is an Executioner. Passes `units`
// to computeDamage so the Lone Prey +2 bonus is included in the damage
// calculation — the AI can see that an isolated target can be Downed with
// the bonus. Returns { target, outcome, rank } or null.
export function executionerBestAttack(grid, units, sim) {
  const weapon = getUnitWeapon(sim);
  if (!weapon || sim.ap < weapon.apCost || !hasAmmo(sim)) return null;
  let best = null;
  for (const p of playersOf(units)) {
    if (!attackIsValid(grid, sim, p)) continue;
    const o = computeDamage(sim, p, grid, { units });
    const rank = scoreExecutionerTarget(grid, units, sim, p, o);
    if (!best || rank > best.rank) best = { target: p, outcome: o, rank };
  }
  return best;
}