// Universal armor system: 4 technology tiers × 3 weight classes = 12 player armors.
// Any class can equip any armor. Armor provides flat damage reduction and a
// movement modifier — it no longer increases Max HP.
//
// FINAL ARMOR = Tier BaseArmor + WeightArmorModifier (or per-item stat overrides)
// MOVEMENT MODIFIER = WeightMovementModifier (or per-item stat overrides)
//
// Armor reduces eligible incoming damage by a flat amount (minimum 1 damage
// for a valid damaging attack). Armor applies AFTER cover/flanking and all
// offensive skill modifiers, BEFORE shield absorption.
//
// Damage eligibility is controlled by the caller via `affectedByArmor`:
//   - Weapon attacks, Breach, Shock Strike, Grenade, Shock Mine: eligible (default)
//   - Burning, Plasma Strike, environmental hazards: NOT eligible (opt out)

// --- Technology Tiers (base armor value) ---
export const ARMOR_TIERS = {
  body:    { tier: 0, key: 'body',    name: 'Body',    baseArmor: 1 },
  infused: { tier: 1, key: 'infused', name: 'Infused', baseArmor: 2 },
  powered: { tier: 2, key: 'powered', name: 'Powered', baseArmor: 3 },
  nano:    { tier: 3, key: 'nano',    name: 'Nano',    baseArmor: 4 },
};

// --- Weight Classes (armor modifier + movement modifier) ---
export const ARMOR_WEIGHTS = {
  light:  { weight: 'light',  name: 'Light',  armorModifier: -1, movementModifier:  1 },
  medium: { weight: 'medium', name: 'Medium', armorModifier:  0, movementModifier:  0 },
  heavy:  { weight: 'heavy',  name: 'Heavy',  armorModifier:  1, movementModifier: -1 },
};

// --- Build all 12 armor items (4 tiers × 3 weight classes) ---
// Architecture supports per-item stat overrides (e.g. for Implementation 3.5.3 Nano specialization).
export const ARMOR_ITEMS = {
  // Tier 0: Body Armor
  light_body: {
    id: 'light_body',
    name: 'Light Body Armor',
    category: 'armor',
    tier: 0,
    weightClass: 'light',
    tierArmorBonus: 1,
    weightArmorModifier: -1,
    finalArmor: 0,
    movementModifier: 1,
    cost: 0,
    alienMaterialCost: 0,
    description: 'Armor 0, Move +1.',
  },
  medium_body: {
    id: 'medium_body',
    name: 'Medium Body Armor',
    category: 'armor',
    tier: 0,
    weightClass: 'medium',
    tierArmorBonus: 1,
    weightArmorModifier: 0,
    finalArmor: 1,
    movementModifier: 0,
    cost: 0,
    alienMaterialCost: 0,
    description: 'Armor 1, Move 0.',
  },
  heavy_body: {
    id: 'heavy_body',
    name: 'Heavy Body Armor',
    category: 'armor',
    tier: 0,
    weightClass: 'heavy',
    tierArmorBonus: 1,
    weightArmorModifier: 1,
    finalArmor: 2,
    movementModifier: -1,
    cost: 0,
    alienMaterialCost: 0,
    description: 'Armor 2, Move -1.',
  },

  // Tier 1: Infused Armor
  light_infused: {
    id: 'light_infused',
    name: 'Light Infused Armor',
    category: 'armor',
    tier: 1,
    weightClass: 'light',
    tierArmorBonus: 2,
    weightArmorModifier: -1,
    finalArmor: 1,
    movementModifier: 1,
    cost: 0,
    alienMaterialCost: 0,
    description: 'Armor 1, Move +1.',
  },
  medium_infused: {
    id: 'medium_infused',
    name: 'Medium Infused Armor',
    category: 'armor',
    tier: 1,
    weightClass: 'medium',
    tierArmorBonus: 2,
    weightArmorModifier: 0,
    finalArmor: 2,
    movementModifier: 0,
    cost: 0,
    alienMaterialCost: 0,
    description: 'Armor 2, Move 0.',
  },
  heavy_infused: {
    id: 'heavy_infused',
    name: 'Heavy Infused Armor',
    category: 'armor',
    tier: 1,
    weightClass: 'heavy',
    tierArmorBonus: 2,
    weightArmorModifier: 1,
    finalArmor: 3,
    movementModifier: -1,
    cost: 0,
    alienMaterialCost: 0,
    description: 'Armor 3, Move -1.',
  },

  // Tier 2: Powered Armor
  light_powered: {
    id: 'light_powered',
    name: 'Light Powered Armor',
    category: 'armor',
    tier: 2,
    weightClass: 'light',
    tierArmorBonus: 3,
    weightArmorModifier: -1,
    finalArmor: 2,
    movementModifier: 1,
    cost: 0,
    alienMaterialCost: 0,
    description: 'Armor 2, Move +1.',
  },
  medium_powered: {
    id: 'medium_powered',
    name: 'Medium Powered Armor',
    category: 'armor',
    tier: 2,
    weightClass: 'medium',
    tierArmorBonus: 3,
    weightArmorModifier: 0,
    finalArmor: 3,
    movementModifier: 0,
    cost: 0,
    alienMaterialCost: 0,
    description: 'Armor 3, Move 0.',
  },
  heavy_powered: {
    id: 'heavy_powered',
    name: 'Heavy Powered Armor',
    category: 'armor',
    tier: 2,
    weightClass: 'heavy',
    tierArmorBonus: 3,
    weightArmorModifier: 1,
    finalArmor: 4,
    movementModifier: -1,
    cost: 0,
    alienMaterialCost: 0,
    description: 'Armor 4, Move -1.',
  },

  // Tier 3: Nano Armor
  // Light Nano intentionally breaks the "+1 Armor" progression: retains 2 Armor
  // (same as Light Powered) and gains +1 additional Move (+2 Move total) for mobility specialization.
  // Medium gains +1 Armor (4 Armor, 0 Move). Heavy gains +1 Armor (5 Armor, -1 Move).
  light_nano_armor: {
    id: 'light_nano_armor',
    name: 'Light Nano Armor',
    category: 'armor',
    tier: 3,
    weightClass: 'light',
    tierArmorBonus: 3,
    weightArmorModifier: -1,
    finalArmor: 2,
    movementModifier: 2,
    cost: 0,
    alienMaterialCost: 0,
    description: 'Armor 2, Move +2. Nano-weave mobility specialization.',
  },
  medium_nano_armor: {
    id: 'medium_nano_armor',
    name: 'Medium Nano Armor',
    category: 'armor',
    tier: 3,
    weightClass: 'medium',
    tierArmorBonus: 4,
    weightArmorModifier: 0,
    finalArmor: 4,
    movementModifier: 0,
    cost: 0,
    alienMaterialCost: 0,
    description: 'Armor 4, Move 0. High-density nano lattice balanced protection.',
  },
  heavy_nano_armor: {
    id: 'heavy_nano_armor',
    name: 'Heavy Nano Armor',
    category: 'armor',
    tier: 3,
    weightClass: 'heavy',
    tierArmorBonus: 4,
    weightArmorModifier: 1,
    finalArmor: 5,
    movementModifier: -1,
    cost: 0,
    alienMaterialCost: 0,
    description: 'Armor 5, Move -1. Maximum composite nano-barrier protection.',
  },
};

// Legacy armor ID aliases — old saves reference these. Map to canonical IDs so
// getArmor() never returns null during migration.
const LEGACY_ARMOR_ALIASES = {
  tactical_vest: 'medium_body',    // was +1 HP → Medium Body (Armor 1, Move 0)
  reinforced_armor: 'heavy_body',   // was +2 HP → Heavy Body  (Armor 2, Move -1)
  light_body_armor: 'light_body',
  medium_body_armor: 'medium_body',
  heavy_body_armor: 'heavy_body',
  light_infused_armor: 'light_infused',
  medium_infused_armor: 'medium_infused',
  heavy_infused_armor: 'heavy_infused',
  light_powered_armor: 'light_powered',
  medium_powered_armor: 'medium_powered',
  heavy_powered_armor: 'heavy_powered',
  light_nano: 'light_nano_armor',
  medium_nano: 'medium_nano_armor',
  heavy_nano: 'heavy_nano_armor',
  light_nano_armor: 'light_nano_armor',
  medium_nano_armor: 'medium_nano_armor',
  heavy_nano_armor: 'heavy_nano_armor',
};

export function getArmor(id) {
  if (!id) return null;
  if (ARMOR_ITEMS[id]) return ARMOR_ITEMS[id];
  const alias = LEGACY_ARMOR_ALIASES[id];
  return alias ? ARMOR_ITEMS[alias] || null : null;
}

// Centralized helper to get armor stats
export function getArmorStats(itemId) {
  const armor = getArmor(itemId);
  if (!armor) return { id: '', name: '', armor: 0, movementModifier: 0, tier: 0, weightClass: 'medium' };
  return {
    id: armor.id,
    name: armor.name,
    armor: armor.finalArmor,
    movementModifier: armor.movementModifier,
    tier: armor.tier,
    weightClass: armor.weightClass,
  };
}

export function getArmorIds() {
  return Object.keys(ARMOR_ITEMS);
}

// Resolve a soldier's equipped armor to a valid armor item (handles legacy IDs).
export function getSoldierArmor(soldier) {
  if (!soldier || !soldier.equipped_armor) return null;
  return getArmor(soldier.equipped_armor);
}

// Flat armor value for a soldier (0 if no armor or legacy alias resolves).
export function getArmorValue(soldier) {
  const armor = getSoldierArmor(soldier);
  return armor ? armor.finalArmor : 0;
}

// Movement modifier from a soldier's equipped armor (0 if none).
export function getArmorMovementModifier(soldier) {
  const armor = getSoldierArmor(soldier);
  return armor ? armor.movementModifier : 0;
}