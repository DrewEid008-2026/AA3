// Dislocator AI — Formation Breaker / Forced Movement (Implementation 3.4.3).
//
// The Dislocator evaluates COME HERE! as a positional setup tool. High-value
// uses include pulling soldiers out of formation, out of cover, and into
// positions where other enemies (Flash Claw, Rusher, Executioner) can exploit
// the isolation (spec 20-24).
//
// The AI compares COME HERE! tactical value against the normal Beam Attack
// and does not force the ability every time cooldown is ready (spec 26). It
// also avoids using COME HERE! when it would improve the player's position
// (spec 25).

import { computeComeHerePull } from './comeHereResolver';
import { getCoverState, attackIsValid, computeDamage, getUnitWeapon,
} from './combat';
import { hasAmmo } from './ammo';
import {
  getEnemyAbility, canEnemyUseAbility, getEnemyAbilityTargets,
} from './enemyAbilities';
import { TEAMS } from './constants';

// Data-driven scoring weights (spec 21-25). Tunable without logic changes.
const SCORE_WEIGHTS = {
  baseDamage: 10,           // 3 damage baseline
  isolationPerAlly: 18,     // per ally removed from within 2 tiles (spec 21)
  coverBreakBonus: 25,      // covered → exposed (spec 22)
  coverWorsenPenalty: 20,   // target moves to better cover (spec 25)
  allyProximityPenalty: 12, // per ally gained within 2 tiles (spec 25)
  alliedFollowUp: 14,       // per enemy that can now attack the target (spec 23)
  hazardTilesCrossed: 16,   // per volatile tile crossed (spec 26-27) — 3.4.5
  minComeHereScore: 30,     // require meaningful tactical value
  damageKillBonus: 40,      // if the 3 damage would likely kill
};

function playersOf(units) {
  return units.filter((u) => u.alive && u.team === TEAMS.PLAYER && !u.downed);
}

function enemiesOf(units) {
  return units.filter((u) => u.alive && u.team === TEAMS.ENEMY);
}

// Count player allies within Chebyshev distance `radius` of a position.
function nearbyAllyCount(units, pos, excludeId, radius) {
  return units.filter(
    (u) => u.alive && u.team === TEAMS.PLAYER && !u.downed && u.id !== excludeId &&
    Math.max(Math.abs(u.x - pos.x), Math.abs(u.y - pos.y)) <= radius
  ).length;
}

// Count enemies that can attack a target at a given position.
function enemiesAbleToAttack(grid, units, pos) {
  let n = 0;
  for (const e of enemiesOf(units)) {
    if (attackIsValid(grid, e, { ...pos, alive: true, team: TEAMS.PLAYER, downed: false })) n++;
  }
  return n;
}

// Score a COME HERE! pull for a specific target. Returns a score or null if
// the pull is invalid or clearly harmful (spec 25).
function scoreComeHerePull(grid, units, enemy, target, pull) {
  if (!pull.valid) return null;

  let score = SCORE_WEIGHTS.baseDamage; // 3 damage baseline

  // Damage kill check: if 3 damage would likely kill, that's high value.
  if (target.hp <= 3) score += SCORE_WEIGHTS.damageKillBonus;

  const destination = pull.destination;
  const tilesMoved = pull.tilesMoved;

  // If target is already adjacent (spec 27), no pull — just damage.
  if (tilesMoved === 0) return score;

  // Isolation scoring (spec 21): count allies within 2 tiles before vs after.
  const alliesBefore = nearbyAllyCount(units, target, target.id, 2);
  const alliesAfter = nearbyAllyCount(units, destination, target.id, 2);
  const isolationGain = alliesBefore - alliesAfter;
  score += isolationGain * SCORE_WEIGHTS.isolationPerAlly;

  // Penalty if the pull moves the target closer to more allies (spec 25).
  if (alliesAfter > alliesBefore) {
    score -= (alliesAfter - alliesBefore) * SCORE_WEIGHTS.allyProximityPenalty;
  }

  // Cover scoring (spec 22): covered → exposed is good; exposed → covered is bad.
  const coverBefore = getCoverState(grid, enemy, target);
  const simTargetAfter = { ...target, x: destination.x, y: destination.y };
  const coverAfter = getCoverState(grid, enemy, simTargetAfter);
  if (coverBefore === 'covered' && (coverAfter === 'exposed' || coverAfter === 'flanked')) {
    score += SCORE_WEIGHTS.coverBreakBonus;
  }
  if (coverAfter === 'covered' && (coverBefore === 'exposed' || coverBefore === 'flanked')) {
    score -= SCORE_WEIGHTS.coverWorsenPenalty;
  }

  // Allied follow-up (spec 23): can more enemies attack the target after pull?
  const followUpBefore = enemiesAbleToAttack(grid, units, target);
  const followUpAfter = enemiesAbleToAttack(grid, units, simTargetAfter);
  const followUpGain = followUpAfter - followUpBefore;
  score += Math.max(0, followUpGain) * SCORE_WEIGHTS.alliedFollowUp;

  // Hazard tiles crossed (spec 26-27): pulling a target through Volatile Tiles
  // deals environmental damage per tile crossed. This is one scoring factor
  // among many — it does not override isolation, cover, or kill value (spec 28).
  const hazardTiles = pull.hazardTilesCrossed || 0;
  score += hazardTiles * SCORE_WEIGHTS.hazardTilesCrossed;

  return score;
}

// Score the normal Beam Attack from the current position (spec 26).
function scoreBeamAttack(grid, units, enemy) {
  const weapon = getUnitWeapon(enemy);
  if (!weapon || enemy.ap < weapon.apCost || !hasAmmo(enemy)) return 0;
  let best = 0;
  for (const p of playersOf(units)) {
    if (!attackIsValid(grid, enemy, p)) continue;
    const o = computeDamage(enemy, p, grid);
    let s = 10; // base damage value
    if (o.killed) s += 40;
    if (o.state === 'flanked') s += 15;
    else if (o.state === 'exposed') s += 10;
    else if (o.state === 'covered') s -= 5;
    if (s > best) best = s;
  }
  return best;
}

// Dislocator's special-ability decision. Returns a come_here decision when
// it's the best action, or null to fall through to the normal attack/move flow.
//
// The AI does NOT force COME HERE! every time cooldown is ready (spec 26). It
// compares the tactical value against the normal Beam Attack and only uses
// COME HERE! when it offers meaningful positional disruption (spec 20-25).
export function decideDislocatorAction(grid, units, enemy) {
  if (!enemy || !enemy.alive || enemy.ap <= 0) return null;

  const players = playersOf(units);
  if (players.length === 0) return null;

  const ability = getEnemyAbility('come_here');
  if (!ability || !canEnemyUseAbility(enemy, ability)) return null;

  // Find valid targets (range 5, LOS, standing soldiers).
  const candidates = getEnemyAbilityTargets(grid, units, enemy, ability);
  if (candidates.length === 0) return null;

  // Score the normal Beam Attack for comparison (spec 26).
  const beamScore = scoreBeamAttack(grid, units, enemy);

  let best = null;
  let bestScore = SCORE_WEIGHTS.minComeHereScore;

  for (const target of candidates) {
    const pull = computeComeHerePull(grid, units, enemy, target);
    if (!pull.valid) continue;

    const score = scoreComeHerePull(grid, units, enemy, target, pull);
    if (score === null) continue;

    // Only use COME HERE! if it beats the Beam Attack value (spec 26).
    if (score <= beamScore) continue;

    if (score > bestScore) {
      bestScore = score;
      const tilesMoved = pull.tilesMoved;
      const reason = tilesMoved === 0
        ? `COME HERE! · ${target.name} · 3 dmg`
        : `COME HERE! · ${target.name} · ${tilesMoved} tiles`;
      best = {
        type: 'come_here',
        abilityId: 'come_here',
        targetId: target.id,
        targetName: target.name,
        pullPath: pull.path,
        destination: pull.destination,
        tilesMoved,
        reason,
      };
    }
  }

  return best;
}