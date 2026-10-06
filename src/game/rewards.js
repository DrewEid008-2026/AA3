// Reward data structures. Three resources exist: Credits (conventional),
// Alien Materials (advanced — recovered from defeated enemies), and Power
// Cores (rare, from specific enemies). Values are data-driven so they can be
// rebalanced without touching display code.
//
// Alien Materials are NO LONGER part of fixed mission rewards. They come
// primarily from enemy defeats (1 per enemy via alienMaterialReward). Power
// Cores come from designated enemy types via the powerCoreReward archetype
// field. Credits remain the fixed mission-completion reward.

export const STANDARD_BASE_REWARD = {
  credits: 100,
  alienMaterials: 0,
  powerCores: 0,
};

export const STANDARD_ELITE_BONUS = {
  credits: 75,
  alienMaterials: 0,
  powerCores: 0,
};

// Sum a base reward and an elite bonus into a single total.
export function totalReward(base, elite) {
  return {
    credits: (base?.credits || 0) + (elite?.credits || 0),
    alienMaterials: (base?.alienMaterials || 0) + (elite?.alienMaterials || 0),
    powerCores: (base?.powerCores || 0) + (elite?.powerCores || 0),
  };
}