// Generic reaction framework. A reaction is a prepared response that may
// trigger during the opposing team's phase (e.g. Overwatch fires during enemy
// movement). Reaction state lives on unit.reaction as { type, active }; a
// consumed or expired reaction is null.
//
// This is deliberately team-agnostic and type-driven so future reactions
// (enemy Overwatch, ready melee attacks, movement hazards) reuse the same
// trigger loop in Battle.jsx without per-type branching.
import { TEAMS } from './constants';
import { hasAmmo } from './ammo';
import { STATUS_DEFS } from './statuses';

export const REACTION_TYPES = {
  OVERWATCH: 'overwatch',
};

export const OVERWATCH_AP_COST = 1;

export function getReaction(unit) {
  return unit && unit.reaction ? unit.reaction : null;
}

export function isInOverwatch(unit) {
  const r = getReaction(unit);
  return !!r && r.type === REACTION_TYPES.OVERWATCH && r.active;
}

// Any status that blocks Overwatch (e.g. Suppressed). Generic over the status
// definitions so future suppressing effects work without editing this check.
export function isOverwatchBlocked(unit) {
  if (!unit || !unit.statuses) return false;
  return unit.statuses.some((s) => STATUS_DEFS[s.type] && STATUS_DEFS[s.type].blocksOverwatch);
}

// Can a player unit enter Overwatch right now?
export function canEnterOverwatch(unit, phase) {
  if (!unit || !unit.alive || unit.team !== TEAMS.PLAYER) return false;
  if (phase !== undefined && phase !== 'player') return false;
  if (isInOverwatch(unit)) return false;
  if (unit.ap < OVERWATCH_AP_COST) return false;
  if (!hasAmmo(unit)) return false;
  if (isOverwatchBlocked(unit)) return false;
  return true;
}

// Spend 1 AP and mark the unit as prepared. Returns a NEW unit.
export function enterOverwatch(unit) {
  return {
    ...unit,
    ap: Math.max(0, unit.ap - OVERWATCH_AP_COST),
    reaction: { type: REACTION_TYPES.OVERWATCH, active: true },
  };
}

// Clear any reaction (used when a unit takes any other action, cancelling the
// prepared shot). Returns a NEW unit, or the same ref if there was none.
export function clearReaction(unit) {
  if (!unit || !unit.reaction) return unit;
  return { ...unit, reaction: null };
}

// Expire all of a team's active reactions (e.g. unused Overwatch at the start
// of the next Player Phase). Does NOT refund AP — Overwatch is a commitment.
export function expireReactions(units, team) {
  return units.map((u) => (u.team === team && u.reaction ? { ...u, reaction: null } : u));
}