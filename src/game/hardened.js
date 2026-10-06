// Chapter 2 "Hardened" enemy stat overrides. Hardened enemies reuse the base
// archetype's AI and abilities — their challenge comes from tougher stats
// (roughly +2 HP, +1 damage where appropriate, +1 Armor selectively), not new
// behaviour. The `archetype` key stays the same so AI_PARAMS and
// getEnemyAbilityForArchetype work unchanged. This mirrors the Elite system.
//
// Design budget: ~2-3 improvements per archetype. Flat Armor is strong, so it
// is granted selectively (not to every enemy).

export const HARDENED_STATS = {
  grunt:     { name: 'Hardened Grunt',     hp: 8,  damageBonus: 1, armor: 1 },
  rusher:    { name: 'Hardened Rusher',    hp: 10, damageBonus: 1, armor: 0 },
  support:   { name: 'Hardened Support',   hp: 8,  damageBonus: 1, armor: 1 },
  bulwark:   { name: 'Hardened Bulwark',   hp: 12, damageBonus: 0, armor: 2 },
  stalker:   { name: 'Hardened Stalker',   hp: 8,  damageBonus: 1, armor: 0 },
  disruptor: { name: 'Hardened Disruptor', hp: 9,  damageBonus: 0, armor: 1 },
  artillery: { name: 'Hardened Artillery', hp: 9,  damageBonus: 1, armor: 0 },
  // Chapter 3 featured enemy — keeps Tier 3-equivalent Light armor (2).
  flash_claw: { name: 'Hardened Flash Claw', hp: 9, damageBonus: 1, armor: 2 },
  // Chapter 3 featured enemy — keeps Tier 3-equivalent Medium armor (3).
  dislocator: { name: 'Hardened Dislocator', hp: 11, damageBonus: 1, armor: 3 },
  // Chapter 3 featured enemy — keeps Tier 3-equivalent Medium armor (3).
  executioner: { name: 'Hardened Executioner', hp: 11, damageBonus: 1, armor: 3 },
};

export function getHardenedStats(archetypeKey) {
  return HARDENED_STATS[archetypeKey] || null;
}