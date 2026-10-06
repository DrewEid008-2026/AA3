import { enterDowned } from './downed';

// Reusable status-effect framework. Statuses live as an array on each unit
// (unit.statuses) so any number can coexist. Each status carries its type,
// source, and a turnsRemaining counter decremented at its defined tick point.
//
// All combat conditions (Suppressed, Burning, Stunned, Marked) share this one
// architecture: a STATUS_DEFS entry with display metadata + mechanical
// modifiers + a tick point, plus generic helpers that read those defs. Adding
// a new status means adding a def, not branching combat/AI code.

export const STATUS_TYPES = {
  SUPPRESSED: 'suppressed',
  BURNING: 'burning',
  STUNNED: 'stunned',
  MARKED: 'marked',
  SHIELDED: 'shielded',
  DISRUPTED: 'disrupted',
};

// Phase boundaries at which statuses tick or activate. Passed in by Battle.jsx
// at the relevant transition so timing is defined in one place.
//   'end_enemy_phase'   — end of the enemy phase (Suppressed on enemies)
//   'end_player_phase'  — end of the player phase (Burning on players)
//   'start_player_phase'— start of the player phase (Stunned on players)
//   'start_enemy_phase' — start of the enemy phase (Stunned on enemies)
// 'end_owner_phase' / 'start_owner_phase' are resolved against the unit's team
// so Burning/Stunned tick at the affected unit's own phase boundary.
export const STATUS_TIMING = {
  END_ENEMY_PHASE: 'end_enemy_phase',
  END_PLAYER_PHASE: 'end_player_phase',
  START_PLAYER_PHASE: 'start_player_phase',
  START_ENEMY_PHASE: 'start_enemy_phase',
};

// Status definitions: display metadata + mechanical modifiers + when to tick.
export const STATUS_DEFS = {
  suppressed: {
    name: 'Suppressed',
    icon: 'suppressed',
    shortDesc: '-2 attack damage. Cannot Overwatch.',
    // Flat penalty to the affected unit's outgoing damaging attacks.
    damageDealtPenalty: 2,
    blocksOverwatch: true,
    // Decrement at the end of each Enemy Phase; removed at 0.
    tickAt: 'end_enemy_phase',
  },
  burning: {
    name: 'Burning',
    icon: 'burning',
    shortDesc: 'Take 1 damage after each action.',
    // Damage dealt to the bearer after each meaningful action.
    actionDamage: 1,
    // Ticks once per the bearer's own phase (duration decrements once per
    // activation, even though the damage triggers per action).
    tickAt: 'end_owner_phase',
  },
  stunned: {
    name: 'Stunned',
    icon: 'stunned',
    shortDesc: '-1 AP next activation.',
    // Reduces the bearer's starting AP by this much at the start of their next
    // activation, then is removed. Does NOT block Overwatch.
    apPenalty: 1,
    // Consumed at the start of the bearer's next phase (not counted down).
    tickAt: 'start_owner_phase',
  },
  marked: {
    name: 'Marked',
    icon: 'marked',
    shortDesc: 'Next damaging attack deals +2 damage.',
    // Bonus applied to the next damaging attack against this unit, then removed.
    incomingDamageBonus: 2,
    // No tickAt: Marked is consumed by a damaging attack, not by a timer.
  },
  // SHIELDED (Bulwark Energy Shield): absorbs damage before HP. No tickAt —
  // persists until fully depleted or the mission ends. The shield value lives
  // on the status as `shieldValue` (see shield.js). Not a timed status.
  shielded: {
    name: 'Shielded',
    icon: 'shielded',
    shortDesc: 'Absorbs incoming damage before HP.',
    // No tickAt: shield is consumed by damage, not by a timer.
  },
  // DISRUPTED (Disruptor Disruption Beam): abilities cost +1 AP. Lasts through
  // the end of the affected soldier's next Player Phase. Applied during the
  // Enemy Phase; ticks at the owner's end-phase boundary (end_player_phase for
  // player units), which the Battle loop calls at the start of the next Enemy
  // Phase — so the player gets exactly one full Player Phase under its effect.
  disrupted: {
    name: 'Disrupted',
    icon: 'disrupted',
    shortDesc: 'Abilities cost +1 AP until end of next Player Phase.',
    // Flat AP penalty added to every class/utility ability cost.
    abilityApPenalty: 1,
    tickAt: 'end_owner_phase',
  },
};

export function hasStatus(unit, type) {
  return !!(unit && unit.statuses && unit.statuses.some((s) => s.type === type));
}

export function getStatuses(unit, type) {
  if (!unit || !unit.statuses) return [];
  return unit.statuses.filter((s) => s.type === type);
}

// Total flat damage-dealt penalty from all statuses on the unit (e.g. -2 from
// Suppressed). Returns 0 if none.
export function damageDealtPenalty(unit) {
  if (!unit || !unit.statuses) return 0;
  let pen = 0;
  for (const s of unit.statuses) {
    const def = STATUS_DEFS[s.type];
    if (def && def.damageDealtPenalty) {
      pen += s.penalty != null ? s.penalty : def.damageDealtPenalty;
    }
  }
  return pen;
}

// +2 (or 0) added to the next damaging attack against this target, from Marked.
export function markedBonus(target) {
  if (!target || !target.statuses) return 0;
  for (const s of target.statuses) {
    const def = STATUS_DEFS[s.type];
    if (def && def.incomingDamageBonus) return def.incomingDamageBonus;
  }
  return 0;
}

// 1 (or 0) damage dealt to the bearer after each action, from Burning.
export function burningDamage(unit) {
  if (!unit || !unit.statuses) return 0;
  for (const s of unit.statuses) {
    const def = STATUS_DEFS[s.type];
    if (def && def.actionDamage) return def.actionDamage;
  }
  return 0;
}

// 1 (or 0) starting-AP reduction at activation start, from Stunned.
export function stunApPenalty(unit) {
  if (!unit || !unit.statuses) return 0;
  for (const s of unit.statuses) {
    const def = STATUS_DEFS[s.type];
    if (def && def.apPenalty) return def.apPenalty;
  }
  return 0;
}

// +1 (or 0) AP added to every class/utility ability cost, from Disrupted.
export function abilityApPenalty(unit) {
  if (!unit || !unit.statuses) return 0;
  for (const s of unit.statuses) {
    const def = STATUS_DEFS[s.type];
    if (def && def.abilityApPenalty) return def.abilityApPenalty;
  }
  return 0;
}

// Apply (or refresh) a status. Does not stack: refreshing keeps the longer
// remaining duration (so re-Burning extends to the longer window, never x2).
// Returns a NEW unit object; safe to use inside setUnits maps.
export function applyStatus(unit, type, { source = null, turnsRemaining = 1, penalty = null } = {}) {
  const def = STATUS_DEFS[type];
  if (!def) return unit;
  const statuses = (unit.statuses || []).slice();
  const idx = statuses.findIndex((s) => s.type === type);
  if (idx >= 0) {
    const existing = statuses[idx];
    statuses[idx] = {
      ...existing,
      turnsRemaining: Math.max(existing.turnsRemaining, turnsRemaining),
      penalty: penalty != null ? penalty : existing.penalty,
    };
  } else {
    statuses.push({ type, source, turnsRemaining, penalty });
  }
  return { ...unit, statuses };
}

// Remove Marked from a unit (after a damaging attack consumed it). Returns a
// NEW unit, or the same ref if the unit wasn't marked.
export function consumeMarked(unit) {
  if (!unit || !unit.statuses) return unit;
  if (!hasStatus(unit, STATUS_TYPES.MARKED)) return unit;
  const next = unit.statuses.filter((s) => s.type !== STATUS_TYPES.MARKED);
  return { ...unit, statuses: next };
}

// Remove all of the given status types from a unit. Returns a new unit, or the
// same reference if none of the types were present. Used by Rally (Command
// cleanses Suppressed + Marked from the target).
export function removeStatuses(unit, types) {
  if (!unit || !unit.statuses || !types || types.length === 0) return unit;
  const set = new Set(types);
  const next = unit.statuses.filter((s) => !set.has(s.type));
  if (next.length === unit.statuses.length) return unit;
  return { ...unit, statuses: next };
}

// Decrement turnsRemaining for statuses that tick at the given phase boundary
// and drop those that reach 0. 'end_owner_phase' resolves to the unit's own
// team boundary. Returns a new unit, or the same reference if nothing changed.
function tickMatches(def, unit, boundary) {
  if (def.tickAt === 'end_owner_phase') {
    return (
      (unit.team === 'player' && boundary === STATUS_TIMING.END_PLAYER_PHASE) ||
      (unit.team === 'enemy' && boundary === STATUS_TIMING.END_ENEMY_PHASE)
    );
  }
  return def.tickAt === boundary;
}

export function tickStatuses(unit, phaseBoundary) {
  if (!unit || !unit.statuses || unit.statuses.length === 0) return unit;
  let changed = false;
  const next = [];
  for (const s of unit.statuses) {
    const def = STATUS_DEFS[s.type];
    if (!def || !def.tickAt || !tickMatches(def, unit, phaseBoundary)) {
      next.push(s);
      continue;
    }
    const turnsRemaining = s.turnsRemaining - 1;
    changed = true;
    if (turnsRemaining > 0) next.push({ ...s, turnsRemaining });
  }
  if (!changed) return unit;
  return { ...unit, statuses: next };
}

// Resolve start-of-activation statuses. Stunned reduces the unit's starting AP
// (clamped at 0) and is then removed — it affects exactly one activation.
// 'start_owner_phase' resolves to the unit's own team boundary. Returns a new
// unit, or the same ref if nothing changed.
export function applyActivationStart(unit, phaseBoundary) {
  if (!unit || !unit.alive || !hasStatus(unit, STATUS_TYPES.STUNNED)) return unit;
  const isOwner =
    (unit.team === 'player' && phaseBoundary === STATUS_TIMING.START_PLAYER_PHASE) ||
    (unit.team === 'enemy' && phaseBoundary === STATUS_TIMING.START_ENEMY_PHASE);
  if (!isOwner) return unit;
  const penalty = stunApPenalty(unit);
  const ap = Math.max(0, unit.ap - penalty);
  const statuses = unit.statuses.filter((s) => s.type !== STATUS_TYPES.STUNNED);
  return { ...unit, ap, statuses };
}

// Reusable action-completion hook. Call after a unit performs a meaningful
// action (move, attack, reload, ability, overwatch). Currently: Burning deals
// `actionDamage` to the bearer. Does NOT trigger from UI-only interactions.
// Returns { unit, died, damage } — the caller writes `unit` to state and uses
// `died`/`damage` for popups and to cancel any queued action sequence.
export function applyActionCompletion(unit) {
  if (!unit || !unit.alive || unit.downed) return { unit, died: false, damage: 0 };
  const damage = burningDamage(unit);
  if (damage <= 0) return { unit, died: false, damage: 0 };
  const hp = Math.max(0, unit.hp - damage);
  if (hp <= 0 && unit.team === 'player') {
    return { unit: enterDowned(unit), died: false, damage, downed: true };
  }
  const died = hp <= 0;
  return { unit: { ...unit, hp, alive: died ? false : unit.alive }, died, damage };
}