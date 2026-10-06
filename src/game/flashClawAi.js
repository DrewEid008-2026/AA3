// Flash Claw AI — Overwatch Breaker / Fast Melee Pursuit (Implementation 3.4.2).
//
// Flash Claw's primary purpose is to burn player Overwatch reactions before
// allied aliens advance, then pursue isolated soldiers as a fast melee hunter.
//
// This module provides `decideFlashClawAction`, called from ai.js's
// `decideAbilityAction` before the generic attack/move flow. It returns:
//   - A `move` decision when a useful Overwatch-baiting route exists.
//   - `null` to fall through to the generic flow (which handles melee attacks
//     via bestAttackFrom and pursuit movement via scoreTile with Flash Claw's
//     AI_PARAMS).
//
// Design rules (spec 18-27):
//   - Only value Overwatch baiting when the movement ALSO advances toward
//     players, improves melee pressure, or opens safer routes (spec 20).
//   - Do not make nonsensical detours just to trigger a distant reaction (spec 23).
//   - If adjacent to a player, prefer melee (let the generic flow handle it).
//   - Two-AP behavior uses the normal enemy AP architecture (move + move/attack).

import { computeReachable, getMovementRange } from './pathfinding';
import { gridDistance, attackIsValid, getUnitWeapon } from './combat';
import { hasAmmo } from './ammo';
import { isInOverwatch } from './reactions';
import { collectOverwatchShooters } from './enemyPhaseHelpers';
import { TEAMS } from './constants';

// Data-driven scoring weights (spec 21). Tunable without logic changes.
const BAIT_WEIGHTS = {
  overwatchReactionsConsumed: 28,  // per unique reaction burned
  pursuitValue: 4,                  // per tile closer to nearest player
  isolationPressure: 6,            // per missing nearby ally of the target
  meleeReachPotential: 12,          // flat bonus if melee is reachable next turn
  alliedRouteBenefit: 4,            // per reaction burned (opens routes for allies)
  minBaitScore: 30,                 // require meaningful value to bait
  retreatPenalty: 40,               // penalty for moving away from players
};

function playersOf(units) {
  return units.filter((u) => u.alive && u.team === TEAMS.PLAYER && !u.downed);
}

// Count active player Overwatch units with ammo.
function activeOverwatchers(units) {
  return units.filter((u) => u.alive && u.team === TEAMS.PLAYER && isInOverwatch(u) && hasAmmo(u));
}

// Count player allies near a given player (within Chebyshev distance 3).
function nearbyAllyCount(units, player, excludeId) {
  return units.filter(
    (u) => u.alive && u.team === TEAMS.PLAYER && !u.downed && u.id !== excludeId && gridDistance(player, u) <= 3
  ).length;
}

// Evaluate a single reachable destination for Overwatch-baiting value.
// Returns a score or null if the tile has no bait value.
function scoreBaitTile(grid, units, enemy, entry, overwatchers, players) {
  // Count UNIQUE Overwatch shooters that can hit any tile along the path.
  // A shooter's reaction is consumed after firing once, so each unique shooter
  // represents one reaction burned (spec 15).
  const uniqueShooters = new Set();
  for (const [px, py] of entry.path) {
    const shooters = collectOverwatchShooters(grid, units, enemy.id, px, py);
    for (const s of shooters) uniqueShooters.add(s.id);
  }
  const reactionsConsumed = uniqueShooters.size;
  if (reactionsConsumed === 0) return null;

  // Pursuit value: closer to nearest player is better.
  const nearest = Math.min(...players.map((p) => gridDistance(entry, p)));
  const pursuitValue = (14 - nearest) * BAIT_WEIGHTS.pursuitValue;

  // Advancing check (spec 20): don't bait if the move retreats from players
  // for a marginal reaction count.
  const currentNearest = Math.min(...players.map((p) => gridDistance(enemy, p)));
  const advancing = currentNearest - nearest; // positive = getting closer
  let retreatPenalty = 0;
  if (advancing < 0) {
    // Moving away from players — only worth it for 2+ reactions (spec 20).
    if (reactionsConsumed < 2) return null;
    retreatPenalty = BAIT_WEIGHTS.retreatPenalty * Math.abs(advancing);
  }

  // Isolation pressure (spec 25): target soldiers with fewer nearby allies.
  let nearestPlayer = players[0];
  let nd = gridDistance(entry, nearestPlayer);
  for (const p of players) {
    const d = gridDistance(entry, p);
    if (d < nd) { nd = d; nearestPlayer = p; }
  }
  const allyCount = nearbyAllyCount(units, nearestPlayer, nearestPlayer.id);
  const isolationPressure = (3 - Math.min(3, allyCount)) * BAIT_WEIGHTS.isolationPressure;

  // Melee reach potential: can Flash Claw reach melee from this tile next turn?
  const meleeReach = nd <= enemy.movement ? BAIT_WEIGHTS.meleeReachPotential : 0;

  // Allied route benefit: burning reactions opens safer routes for allies.
  const alliedRouteBenefit = reactionsConsumed * BAIT_WEIGHTS.alliedRouteBenefit;

  const score =
    reactionsConsumed * BAIT_WEIGHTS.overwatchReactionsConsumed +
    pursuitValue +
    isolationPressure +
    meleeReach +
    alliedRouteBenefit -
    retreatPenalty;

  return { score, reactionsConsumed, nearest, advancing };
}

// Flash Claw's special-ability decision. Returns a move decision when a useful
// Overwatch-baiting route exists, or null to fall through to the generic flow
// (which handles melee attacks and pursuit movement).
export function decideFlashClawAction(grid, units, enemy) {
  if (!enemy || !enemy.alive || enemy.ap <= 0) return null;

  const players = playersOf(units);
  if (players.length === 0) return null;

  // If adjacent to a player, prefer melee — let the generic flow's bestAttackFrom
  // handle it (spec 26). The melee weapon (range 1) only finds adjacent targets.
  const weapon = getUnitWeapon(enemy);
  if (weapon && enemy.ap >= weapon.apCost) {
    for (const p of players) {
      if (attackIsValid(grid, enemy, p)) return null;
    }
  }

  // No active Overwatch to bait — fall through to generic pursuit.
  const overwatchers = activeOverwatchers(units);
  if (overwatchers.length === 0) return null;

  const reachable = computeReachable(grid, units, enemy, getMovementRange(enemy));
  if (reachable.size === 0) return null;

  let best = null;
  let bestScore = BAIT_WEIGHTS.minBaitScore;

  for (const [, entry] of reachable) {
    const result = scoreBaitTile(grid, units, enemy, entry, overwatchers, players);
    if (!result) continue;
    if (result.score > bestScore) {
      bestScore = result.score;
      best = {
        entry,
        reactionsConsumed: result.reactionsConsumed,
        reason: `flash advance · ${result.reactionsConsumed} reaction${result.reactionsConsumed === 1 ? '' : 's'}`,
      };
    }
  }

  if (!best) return null;
  return { type: 'move', entry: best.entry, reason: best.reason };
}