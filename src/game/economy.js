// Universal tier-based economy. Weapons and armor share the same pricing
// structure — cost is derived entirely from technology tier, not from item
// family or armor weight. Within a tier, all weapons cost the same and all
// armor costs the same. This makes future economy rebalancing a single-table
// change.
//
// Utilities and Squad Improvements have their own individual prices and are
// NOT part of the tier economy.

// Cost to Respec a soldier (rebuild class + skill tree). Data-driven so it can
// be rebalanced independently. Only credits are charged — never Alien Materials,
// Power Cores, XP, or equipment.
export const RESPEC_COST = 100;

export const TIER_COSTS = {
  0: { credits: 100, alienMaterials: 0, powerCores: 0, nanoCubes: 0 },
  1: { credits: 200, alienMaterials: 10, powerCores: 0, nanoCubes: 0 },
  2: { credits: 300, alienMaterials: 10, powerCores: 1, nanoCubes: 0 },
  3: { credits: 300, alienMaterials: 0, powerCores: 1, nanoCubes: 1 },
};

export const TIER_LABELS = {
  0: 'CONVENTIONAL',
  1: 'LASER',
  2: 'PLASMA',
  3: 'NANO',
};

export const TIER_SHORT = { 0: 'T0', 1: 'T1', 2: 'T2', 3: 'T3' };

// Centralized helper to get equipment tier label
export function getEquipmentTierLabel(tier) {
  return TIER_LABELS[tier] || `TIER ${tier}`;
}

// Centralized helper to get equipment tier short tag
export function getEquipmentTierShort(tier) {
  return TIER_SHORT[tier] || `T${tier}`;
}

// Purchase cost for a technology tier.
export function getTierCost(tier) {
  return TIER_COSTS[tier] || TIER_COSTS[0];
}

// Check if a save can afford a cost object. Returns { canAfford, missing }.
// `save` is the campaign object { credits, alien_materials, powerCores }.
export function checkAffordability(save, cost) {
  const credits = save?.credits ?? 0;
  const alienMaterials = save?.alien_materials ?? 0;
  const powerCores = save?.powerCores ?? 0;
  const nanoCubes = save?.nanoCubes ?? 0;
  const missing = {};
  if (credits < (cost.credits || 0)) missing.credits = cost.credits - credits;
  if (alienMaterials < (cost.alienMaterials || 0)) missing.alienMaterials = cost.alienMaterials - alienMaterials;
  if (powerCores < (cost.powerCores || 0)) missing.powerCores = cost.powerCores - powerCores;
  if (nanoCubes < (cost.nanoCubes || 0)) missing.nanoCubes = cost.nanoCubes - nanoCubes;
  return { canAfford: Object.keys(missing).length === 0, missing };
}

// Get the purchase cost for any item. Weapons and armor derive cost from
// their technology tier; utilities use their own individual credit cost.
export function getItemCost(item) {
  if (!item) return { credits: 0, alienMaterials: 0, powerCores: 0, nanoCubes: 0 };
  if (item.category === 'utility') {
    return { credits: item.cost || 0, alienMaterials: 0, powerCores: 0, nanoCubes: 0 };
  }
  return getTierCost(item.tier || 0);
}

// Human-readable missing-resources message for insufficient funds.
export function missingResourcesText(missing) {
  const parts = [];
  if (missing.credits) parts.push(`NEED ${missing.credits} MORE CREDITS`);
  if (missing.alienMaterials) parts.push(`NEED ${missing.alienMaterials} MORE ALIEN MATERIALS`);
  if (missing.powerCores) parts.push('POWER CORE REQUIRED');
  if (missing.nanoCubes) parts.push(missing.nanoCubes === 1 ? 'NANO CUBE REQUIRED' : `NEED ${missing.nanoCubes} MORE NANO CUBES`);
  return parts.join(' · ');
}