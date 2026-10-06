// Elite enemy stat overrides. Elite enemies reuse the existing archetype AI
// (grunt / rusher / support) and abilities — their challenge comes from
// stronger stats and weapons, not new behaviour. The `archetype` key stays
// the same so AI_PARAMS and getEnemyAbilityForArchetype work unchanged.

export const ELITE_STATS = {
  grunt: {
    name: 'Elite Grunt',
    hp: 9,
    weapon: 'elite_rifle',
    movement: 5,
  },
  rusher: {
    name: 'Elite Rusher',
    hp: 11,
    weapon: 'elite_close_assault',
    movement: 5,
  },
  support: {
    name: 'Elite Support',
    hp: 8,
    weapon: 'elite_light_rifle',
    movement: 5,
  },
};

// One Elite Response squad: 1 Elite Grunt, 1 Elite Rusher, 1 Elite Support.
export const ELITE_SQUAD = [
  { archetype: 'grunt' },
  { archetype: 'rusher' },
  { archetype: 'support' },
];

export function getEliteStats(archetypeKey) {
  return ELITE_STATS[archetypeKey] || null;
}