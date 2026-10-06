// Armor Shred: a persistent battle-only reduction to Current Armor. Base /
// calculated Armor (from equipment + archetype + skills) is never modified —
// only the battle-local `currentArmor` field is reduced. Current Armor starts
// equal to base Armor (set when the unit is created) and restores to full on
// mission start / restart because units are rebuilt fresh each battle.
//
// Data-driven: `getAttackArmorShred(ability, weapon)` returns the Shred amount
// for an attack. Explosive-tagged abilities apply 2; LMG-family weapons apply 1.
// An explicit `ability.armorShred` overrides the tag-based default so future
// skills, Utilities, and enemy abilities can define their own values.

// Base/calculated Armor — the permanent value from equipment + archetype.
export function getBaseArmor(unit) {
  return (unit && unit.armor) || 0;
}

// Current battle Armor — what damage calculations actually use. Falls back to
// base Armor when currentArmor hasn't been set (safety for any unmigrated unit).
export function getCurrentArmor(unit) {
  if (!unit) return 0;
  return unit.currentArmor != null ? unit.currentArmor : (unit.armor || 0);
}

// Apply Armor Shred to a single unit. Returns a new unit with reduced Current
// Armor (min 0). Excess Shred is lost. Does NOT affect Shields, Cover, or
// terrain. No-op if the unit is already at 0 Armor.
export function applyArmorShred(unit, amount) {
  if (!unit || !amount || amount <= 0) return unit;
  const current = getCurrentArmor(unit);
  const newArmor = Math.max(0, current - amount);
  if (newArmor === current) return unit;
  return { ...unit, currentArmor: newArmor };
}

// Apply Armor Shred to a units array from a Map<unitId, amount>. Returns a new
// array; units not in the map are unchanged.
export function applyArmorShredBatch(units, shredMap) {
  if (!shredMap || shredMap.size === 0) return units;
  return units.map((u) => {
    const amt = shredMap.get(u.id);
    return amt ? applyArmorShred(u, amt) : u;
  });
}

// Data-driven Shred amount for an attack. Priority:
//   1. Explicit `ability.armorShred` (future skills / Utilities / enemy attacks)
//   2. `ability.damageTags` includes 'explosive' → 2
//   3. `weapon.family === 'lmg'` → 1
//   4. 0 (no Shred)
export function getAttackArmorShred(ability, weapon) {
  if (ability && ability.armorShred != null) return ability.armorShred;
  if (ability && ability.damageTags && ability.damageTags.includes('explosive')) return 2;
  if (weapon && weapon.family === 'lmg') return 1;
  return 0;
}