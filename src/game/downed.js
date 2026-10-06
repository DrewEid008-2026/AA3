// Downed / Revive state for player soldiers. Player units at 0 HP enter a
// Downed state instead of dying immediately. A Downed unit remains on the
// battlefield, cannot act, and has a 3-Player-Phase bleed-out timer. Any
// living adjacent ally can Revive for 1 AP (restores 3 HP, 0 AP remainder).

export const BLEED_OUT_START = 3;
export const REVIVE_HP = 3;

export function isDowned(unit) {
  return !!(unit && unit.downed);
}

// Can the unit perform any action? Downed units cannot act.
export function canAct(unit) {
  return !!(unit && unit.alive && !unit.downed);
}

// Enter downed state: clear all combat statuses, set bleed-out counter, zero AP.
// Returns a NEW unit.
export function enterDowned(unit) {
  return {
    ...unit,
    hp: 0,
    downed: true,
    bleedOut: BLEED_OUT_START,
    ap: 0,
    reaction: null,
    statuses: [], // clear Burning, Marked, Suppressed, Stunned
  };
}

// Revive a downed unit: clear downed/bleed-out, set HP, 0 AP for this phase.
// `recovering` (default true) blocks Command until the next Player Phase;
// Stabilize clears it so a revived ally can be Commanded the same phase.
// Returns a NEW unit.
export function reviveUnit(unit, hp = REVIVE_HP, recovering = true) {
  return {
    ...unit,
    hp,
    downed: false,
    bleedOut: null,
    ap: 0,
    recovering,
    statuses: [],
  };
}

// Tick bleed-out at the start of each Player Phase. Returns { unit, died }.
// When the counter would move below 1, the soldier dies permanently.
export function tickBleedOut(unit) {
  if (!unit || !unit.downed || !unit.alive) return { unit, died: false };
  const newBleed = unit.bleedOut - 1;
  if (newBleed < 1) {
    // Bleed-out expired: unit leaves tactical participation (alive=false on the
    // battlefield) but does NOT die permanently. bleedOutExpired flags this for
    // the mission commit to set the soldier to INJURED instead of KIA.
    return { unit: { ...unit, downed: false, alive: false, bleedOut: 0, bleedOutExpired: true }, died: true };
  }
  return { unit: { ...unit, bleedOut: newBleed }, died: false };
}

// Apply damage to a target. Player units at 0 HP enter Downed state instead of
// dying. Enemy units die normally. Downed units don't take further damage
// (enemies skip them, Burning is cleared on downed). Returns a NEW unit.
export function applyDamageToTarget(target, damage) {
  if (!target || !target.alive || target.downed) return target;
  const hp = Math.max(0, target.hp - damage);
  if (hp <= 0) {
    if (target.team === 'player') {
      return enterDowned(target);
    }
    return { ...target, hp: 0, alive: false };
  }
  return { ...target, hp };
}