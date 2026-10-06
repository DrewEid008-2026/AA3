// Lone Prey — Executioner's signature passive (Implementation 3.4.4).
//
// When the Executioner damages a player soldier with NO active friendly
// soldier within 2 tiles (Chebyshev distance, including diagonals), it deals
// +2 final damage. The bonus is applied after the normal Armor/defense
// pipeline — the base attack still goes through Armor and Cover normally
// (spec 9, 27). Only the +2 is special.
//
// This is PASSIVE DEFINITION DATA (declared on the archetype), not persistent
// unit state. It does not need save/load — a rebuilt Executioner always has
// it. Isolation is derived from current battlefield positions and
// recalculated dynamically (spec 30-31).
//
// Exclusions (spec 7): the target itself, Downed soldiers, Holo-Decoys,
// neutral entities, objectives (boss objects), and civilians (no team field)
// are NOT counted as nearby allies. Only standing, active friendly soldiers
// within 2 tiles provide support.

import { gridDistance } from './combat';

// Archetypes that carry the Lone Prey passive.
const LONE_PREY_ARCHETYPES = new Set(['executioner']);

// The flat bonus added to final damage when Lone Prey activates (spec 9).
const LONE_PREY_BONUS = 2;

// The support radius in tiles (Chebyshev distance). 2 or less = supported;
// more than 2 = isolated (spec 29).
const LONE_PREY_RADIUS = 2;

// Does this unit have the Lone Prey passive?
export function hasLonePrey(unit) {
  return !!unit && LONE_PREY_ARCHETYPES.has(unit.archetype);
}

// The flat +2 bonus value.
export function getLonePreyBonus() {
  return LONE_PREY_BONUS;
}

// Count active friendly soldiers within `radius` tiles of the target using the
// game's standard Chebyshev distance (gridDistance from combat.js — the single
// authoritative distance helper, spec 8).
//
// Excludes: the target itself, Downed soldiers, boss objects (objectives),
// and holo-decoys. Civilians are excluded naturally — they have no `team`
// field and thus never match `u.team === target.team`.
export function countNearbyAllies(target, units, radius = LONE_PREY_RADIUS) {
  if (!target || !target.alive || target.downed) return 0;
  return units.filter(
    (u) =>
      u.alive &&
      u.team === target.team &&
      !u.downed &&
      u.id !== target.id &&
      !u.isBossObject &&
      !u.isHoloDecoy &&
      gridDistance(target, u) <= radius
  ).length;
}

// A target is ISOLATED when no active friendly soldier is within 2 tiles
// (spec 7, 29). Distance > 2 = isolated; 2 or less = supported.
export function isIsolated(target, units, radius = LONE_PREY_RADIUS) {
  if (!target || !target.alive || target.downed) return false;
  return countNearbyAllies(target, units, radius) === 0;
}

// Display metadata for inspection / Tactical Lens (spec 13).
export const LONE_PREY_INFO = {
  id: 'lone_prey',
  name: 'Lone Prey',
  shortLabel: 'LONE PREY',
  desc: 'Deals +2 final damage to soldiers with no active ally within 2 tiles.',
  icon: 'target',
  tone: 'rose',
};