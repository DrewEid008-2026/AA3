// Energy Shield (Bulwark) — damage absorption layer. A SHIELDED status stores a
// `shieldValue` that absorbs incoming damage before HP is reduced. The shield
// is NOT a timed status: it persists until fully depleted or the mission ends.
// Reapplying Energy Shield refreshes the value to the new amount (never stacks).
//
// Shield interacts with the existing damage pipeline at two points:
//   1. computeDamage (preview) — shows the HP damage the player will actually deal.
//   2. resolveTargetDamage (resolution) — consumes the shield and applies HP damage.
//
// Shield does NOT block status effects unless the underlying attack requires
// damage to apply (existing rules). It is a pure damage absorber.
import { STATUS_TYPES } from './statuses';

// Default shield value from the Bulwark's Energy Shield ability.
export const SHIELD_VALUE = 4;

// Current shield value on a unit (0 if unshielded or depleted).
export function getShieldValue(unit) {
  if (!unit || !unit.statuses) return 0;
  const s = unit.statuses.find((st) => st.type === STATUS_TYPES.SHIELDED);
  return s ? s.shieldValue || 0 : 0;
}

export function isShielded(unit) {
  return getShieldValue(unit) > 0;
}

// Apply or refresh a shield. Refreshing sets the value to `value` (does NOT stack
// with an existing shield). Returns a NEW unit object.
export function applyShield(unit, value = SHIELD_VALUE, source = null) {
  if (!unit) return unit;
  const statuses = (unit.statuses || []).slice();
  const idx = statuses.findIndex((s) => s.type === STATUS_TYPES.SHIELDED);
  if (idx >= 0) {
    statuses[idx] = { ...statuses[idx], shieldValue: value, source: source != null ? source : statuses[idx].source };
  } else {
    statuses.push({ type: STATUS_TYPES.SHIELDED, source, shieldValue: value });
  }
  return { ...unit, statuses };
}

// Absorb `incomingDamage` through the shield first. Returns:
//   { unit, absorbed, hpDamage }
// `unit` has the shield status updated (reduced or removed). `hpDamage` is the
// remaining damage that should reduce HP. Callers apply hpDamage to HP separately
// so downed/death logic stays in one place (resolveTargetDamage).
export function applyShieldToDamage(unit, incomingDamage) {
  const shield = getShieldValue(unit);
  if (shield <= 0 || incomingDamage <= 0) {
    return { unit, absorbed: 0, hpDamage: incomingDamage };
  }
  const absorbed = Math.min(shield, incomingDamage);
  const remaining = incomingDamage - absorbed;
  const newShield = shield - absorbed;
  let statuses;
  if (newShield > 0) {
    statuses = unit.statuses.map((s) =>
      s.type === STATUS_TYPES.SHIELDED ? { ...s, shieldValue: newShield } : s
    );
  } else {
    statuses = unit.statuses.filter((s) => s.type !== STATUS_TYPES.SHIELDED);
  }
  return { unit: { ...unit, statuses }, absorbed, hpDamage: remaining };
}

// --- Core Shield (Boss) ---
// Core Shield is a boss-specific damage absorption layer, separate from both
// Armor (flat reduction) and Bulwark Energy Shield (status-based). It absorbs
// damage AFTER Armor and Bulwark Shield, BEFORE HP. Stored as unit.coreShield.
// Non-boss units simply have no coreShield field → getCoreShieldValue returns 0.

export function getCoreShieldValue(unit) {
  return (unit && unit.coreShield) || 0;
}

// Absorb `incomingDamage` through Core Shield. Returns:
//   { unit, absorbed, hpDamage }
// `unit` has coreShield updated (reduced). `hpDamage` is the remaining damage
// that should reduce HP. Callers apply hpDamage to HP separately.
export function applyCoreShieldToDamage(unit, incomingDamage) {
  const shield = getCoreShieldValue(unit);
  if (shield <= 0 || incomingDamage <= 0) {
    return { unit, absorbed: 0, hpDamage: incomingDamage };
  }
  const absorbed = Math.min(shield, incomingDamage);
  const remaining = incomingDamage - absorbed;
  return { unit: { ...unit, coreShield: shield - absorbed }, absorbed, hpDamage: remaining };
}