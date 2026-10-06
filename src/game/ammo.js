// Lightweight weapon ammunition. Ammo is "attacks remaining before reload",
// not individual bullets. State lives on the unit (unit.ammo); the weapon
// definition owns the capacity (weapon.ammo) and reload AP cost.
//
// Unlimited weapons simply omit `ammo` (treated as Infinity) so the same
// code path serves both without special-casing at call sites.
import { getWeapon } from './weapons';

// Maximum ammo for a unit's equipped weapon. Accounts for weapon overrides
// (upgrades like Heavy Magazine, equipment like Ammo Rig). Infinity for
// unlimited weapons.
export function getMaxAmmo(unit) {
  if (!unit) return 0;
  const w = getWeapon(unit.weaponKey);
  if (!w) return 0;
  let ammo = w.ammo ?? Infinity;
  if (unit.weaponOverride && unit.weaponOverride.ammo != null) {
    ammo = unit.weaponOverride.ammo;
  }
  return ammo;
}

// Current ammo. Falls back to max when unset (fresh unit, before first read).
export function getAmmo(unit) {
  if (!unit) return 0;
  const max = getMaxAmmo(unit);
  if (max === Infinity) return Infinity;
  if (unit.ammo == null) return max;
  return unit.ammo;
}

export function hasAmmo(unit) {
  return getAmmo(unit) > 0;
}

export function isFullAmmo(unit) {
  const max = getMaxAmmo(unit);
  if (max === Infinity) return true;
  return getAmmo(unit) >= max;
}

// A unit may reload only when its finite weapon isn't already full.
export function canReload(unit) {
  if (!unit) return false;
  const max = getMaxAmmo(unit);
  if (max === Infinity) return false;
  return getAmmo(unit) < max;
}

// Reload AP cost. Auto-Loader (utility) makes the first reload each mission
// cost 0 AP; subsequent reloads cost the weapon's normal reloadApCost.
export function getReloadApCost(unit) {
  if (unit && unit.autoLoader && !unit.autoLoaderUsed) return 0;
  const w = getWeapon(unit.weaponKey);
  return w ? (w.reloadApCost ?? 1) : 1;
}

// Returns a NEW unit with ammo reduced by n (default 1). Unlimited weapons are
// unchanged. Clamps at 0. Safe inside setUnits maps.
export function consumeAmmo(unit, n = 1) {
  const max = getMaxAmmo(unit);
  if (max === Infinity) return unit;
  const cur = getAmmo(unit);
  return { ...unit, ammo: Math.max(0, cur - n) };
}

// Returns a NEW unit restored to full ammo.
export function reloadUnit(unit) {
  const max = getMaxAmmo(unit);
  if (max === Infinity) return unit;
  return { ...unit, ammo: max };
}