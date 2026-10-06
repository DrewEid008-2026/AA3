// Equipment system: item definitions, economy config, and modifier helpers.
// Equipment modifiers are calculated dynamically — never written into soldier
// base stats — so equipping/unequipping is always reversible. This keeps the
// model extensible for future Alien equipment that may cost Alien Materials
// or grant unusual abilities.
//
// Weapons are inventory items (category: WEAPON) that reference a weapon key
// in weapons.js. Combat stats come from getWeapon(itemId); the ITEMS entry
// only carries economy/ownership metadata. All classes can equip any player
// weapon — there are no class restrictions.

import { getWeapon, getPlayerWeaponIds, getStartingWeaponKey } from './weapons';
import { ARMOR_ITEMS, getArmor } from './armor';
import { getItemCost, checkAffordability, missingResourcesText, getTierCost, TIER_LABELS, TIER_SHORT, getEquipmentTierLabel, getEquipmentTierShort } from './economy';

export const ECONOMY = {
  MEDICAL_COST_PER_HP: 5,
};

export const ITEM_CATEGORIES = {
  ARMOR: 'armor',
  UTILITY: 'utility',
  WEAPON: 'weapon',
};

// Build weapon item entries from the universal weapon catalog. Each weapon
// item's `id` matches its weapon key so getWeapon(item.id) returns the combat
// stats. Cost is 0 for now (economy/pricing is a future phase).
function buildWeaponItems() {
  const items = {};
  for (const id of getPlayerWeaponIds()) {
    const w = getWeapon(id);
    if (!w) continue;
    items[id] = {
      id,
      name: w.name,
      category: ITEM_CATEGORIES.WEAPON,
      cost: 0,
      alienMaterialCost: 0,
      weaponKey: id,
      family: w.family,
      tier: w.tier,
      description: `${w.tierName} ${WEAPON_FAMILY_NAMES[w.family] || w.family}. Dmg ${w.damage}, Rng ${w.range}, Ammo ${w.ammo}.`,
    };
  }
  return items;
}

const WEAPON_FAMILY_NAMES = {
  rifle: 'Rifle',
  shotgun: 'Shotgun',
  lmg: 'LMG',
  sniper_rifle: 'Sniper Rifle',
};

// All conventional equipment + generated weapon items.
export const ITEMS = {
  ...buildWeaponItems(),
  ...ARMOR_ITEMS,
  ammo_rig: {
    id: 'ammo_rig',
    name: 'Ammo Rig',
    category: ITEM_CATEGORIES.UTILITY,
    cost: 60,
    alienMaterialCost: 0,
    ammoBonus: 1,
    description: '+1 maximum weapon ammo.',
  },
  mobility_kit: {
    id: 'mobility_kit',
    name: 'Mobility Kit',
    category: ITEM_CATEGORIES.UTILITY,
    cost: 80,
    alienMaterialCost: 0,
    movementBonus: 1,
    description: '+1 normal movement range.',
  },
  field_medkit: {
    id: 'field_medkit',
    name: 'Field Medkit',
    category: ITEM_CATEGORIES.UTILITY,
    cost: 70,
    alienMaterialCost: 0,
    grantsAbility: 'field_medkit',
    missionUses: 1,
    description: 'Grants Field Medkit: 1 use/mission, 1 AP, heals 3 HP to self or adjacent ally.',
  },
  // --- New tactical utilities (100 Credits each, no Alien Materials) ---
  armor_piercing_rounds: {
    id: 'armor_piercing_rounds',
    name: 'Armor Piercing Rounds',
    category: ITEM_CATEGORIES.UTILITY,
    cost: 100,
    alienMaterialCost: 0,
    armorPierce: 1,
    description: 'Basic weapon attacks ignore 1 Armor.',
  },
  reactive_plating: {
    id: 'reactive_plating',
    name: 'Reactive Plating',
    category: ITEM_CATEGORIES.UTILITY,
    cost: 100,
    alienMaterialCost: 0,
    reactivePlating: 2,
    description: 'First direct attack each Enemy Phase deals 2 less damage, minimum 1.',
  },
  smoke_grenade: {
    id: 'smoke_grenade',
    name: 'Smoke Grenade',
    category: ITEM_CATEGORIES.UTILITY,
    cost: 100,
    alienMaterialCost: 0,
    grantsAbility: 'smoke_grenade',
    missionUses: 1,
    description: '1 use/mission. Create temporary defensive Smoke in radius 1.',
  },
  sprint_harness: {
    id: 'sprint_harness',
    name: 'Sprint Harness',
    category: ITEM_CATEGORIES.UTILITY,
    cost: 100,
    alienMaterialCost: 0,
    grantsAbility: 'sprint_harness',
    missionUses: 1,
    description: '1 use/mission. Gain +3 normal movement this Player Phase.',
  },
  auto_loader: {
    id: 'auto_loader',
    name: 'Auto-Loader',
    category: ITEM_CATEGORIES.UTILITY,
    cost: 100,
    alienMaterialCost: 0,
    autoLoader: true,
    description: 'First Reload each mission costs 0 AP.',
  },
  emergency_shield: {
    id: 'emergency_shield',
    name: 'Emergency Shield',
    category: ITEM_CATEGORIES.UTILITY,
    cost: 100,
    alienMaterialCost: 0,
    grantsAbility: 'emergency_shield',
    missionUses: 1,
    description: '1 use/mission. Gain a 3-point Shield.',
  },
  grenade: {
    id: 'grenade',
    name: 'Grenade',
    category: ITEM_CATEGORIES.UTILITY,
    cost: 100,
    alienMaterialCost: 0,
    grantsAbility: 'grenade',
    missionUses: 1,
    description: '1 use/mission. Range 5. 3×3 blast, 3 damage, 6 terrain damage, 2 Armor Shred.',
  },
  // --- Terrain-manipulation utilities (100 Credits, 1 use/mission) ---
  wall_charge: {
    id: 'wall_charge',
    name: 'Wall Charge',
    category: ITEM_CATEGORIES.UTILITY,
    cost: 100,
    alienMaterialCost: 0,
    grantsAbility: 'wall_charge',
    missionUses: 1,
    description: 'Destroy an adjacent Siege-destructible wall and open a new route.',
  },
  insta_wall_cement: {
    id: 'insta_wall_cement',
    name: 'Insta-Wall Cement',
    category: ITEM_CATEGORIES.UTILITY,
    cost: 100,
    alienMaterialCost: 0,
    grantsAbility: 'insta_wall_cement',
    missionUses: 1,
    description: 'Create a wall within 3 tiles that blocks movement and line of sight.',
  },
  disruptor_hook: {
    id: 'disruptor_hook',
    name: 'Disruptor Hook',
    category: ITEM_CATEGORIES.UTILITY,
    universal: true,
    cost: 100,
    alienMaterialCost: 0,
    grantsAbility: 'disruptor_hook',
    missionUses: 1,
    apCost: 1,
    range: 5,
    description: 'Pull an enemy to the nearest valid tile adjacent to this soldier.',
  },
};

export function getItem(id) {
  if (!id) return null;
  if (ITEMS[id]) return ITEMS[id];
  const w = getWeapon(id);
  if (w && ITEMS[w.id]) return ITEMS[w.id];
  const a = getArmor(id);
  if (a && ITEMS[a.id]) return ITEMS[a.id];
  return null;
}

export function getShopItems() {
  return Object.values(ITEMS);
}

// --- Soldier weapon key resolution ---

// Returns the weapon key a soldier would use (equipped or class default).
// Used by movement calculation, combat preview, and unit creation.
export function getSoldierWeaponKey(soldier) {
  if (!soldier) return null;
  if (soldier.equipped_weapon) return soldier.equipped_weapon;
  return getStartingWeaponKey(soldier.class);
}

// --- Dynamic modifier helpers (never persisted into base stats) ---

// Effective max HP = soldier base max_hp (includes level bonuses) + equipped
// armor bonus. Used by the Squad screen and makePlayerFromSoldier.
export function getEffectiveMaxHp(soldier) {
  if (!soldier) return 8;
  return soldier.max_hp || 8;
}

// FINAL MOVEMENT = Base Movement + Weapon Modifier + Armor Modifier (future)
//               + Utility Modifier + Skill Modifier + Temporary Modifier
// Minimum 1 unless explicitly immobilized.
// `hypotheticalWeaponKey` overrides the equipped weapon for equip previews.
export function getEffectiveMovement(baseMovement, soldier, hypotheticalWeaponKey, hypotheticalArmorKey) {
  let mov = baseMovement;
  const wKey = hypotheticalWeaponKey || getSoldierWeaponKey(soldier);
  const weapon = wKey ? getWeapon(wKey) : null;
  if (weapon && weapon.movementModifier) mov += weapon.movementModifier;
  // Armor movement modifier (Light +1, Heavy -1, Medium 0)
  const aKey = hypotheticalArmorKey !== undefined ? hypotheticalArmorKey : soldier?.equipped_armor;
  const armor = aKey ? getArmor(aKey) : null;
  if (armor && armor.movementModifier) mov += armor.movementModifier;
  // Utility movement bonus (Mobility Kit +1)
  const util = soldier?.equipped_utility ? getItem(soldier.equipped_utility) : null;
  if (util && util.movementBonus) mov += util.movementBonus;
  return Math.max(1, mov);
}

// Effective max ammo = weapon base ammo (or override) + equipped Ammo Rig bonus.
// Used by makePlayerFromSoldier to set the weapon override.
export function getEffectiveAmmoBonus(soldier) {
  const util = soldier?.equipped_utility ? getItem(soldier.equipped_utility) : null;
  return (util && util.ammoBonus) ? util.ammoBonus : 0;
}

// Does the soldier have the Field Medkit equipped?
export function hasFieldMedkit(soldier) {
  return !!(soldier && soldier.equipped_utility === 'field_medkit');
}

// How many of an item are currently equipped across the roster?
export function countEquipped(soldiers, itemId, slot = null) {
  if (!soldiers) return 0;
  return soldiers.filter((s) => {
    if (slot) return s[slot] === itemId;
    return s.equipped_armor === itemId || s.equipped_utility === itemId || s.equipped_weapon === itemId;
  }).length;
}

// Available quantity = owned - currently equipped by others.
// All equipment (weapons, armor, utilities) are unlocks — once purchased
// (qty >= 1), any number of soldiers can equip them simultaneously.
export function getAvailableQuantity(inventory, soldiers, itemId) {
  const owned = (inventory || {})[itemId] || 0;
  if (owned <= 0) return 0;
  return 999; // unlocked — effectively unlimited
}

// Is an item unlocked (purchased)? All categories use unlock-based ownership.
export function isUnlocked(inventory, itemId) {
  const item = ITEMS[itemId];
  if (!item) return false;
  return ((inventory || {})[itemId] || 0) > 0;
}

// Medical cost for a given HP amount.
export function medicalCost(hp) {
  return hp * ECONOMY.MEDICAL_COST_PER_HP;
}

// Re-export armor helpers + economy + weapon helpers (single import surface for consumers)
export { getArmorValue, getArmorMovementModifier, getArmor, getArmorIds, getArmorStats } from './armor';
export { getWeaponTierBonus } from './weapons';
export { getItemCost, checkAffordability, missingResourcesText, getTierCost, TIER_LABELS, TIER_SHORT, getEquipmentTierLabel, getEquipmentTierShort };