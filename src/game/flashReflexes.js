// Flash Reflexes — Flash Claw's signature passive (Implementation 3.4.2).
//
// Flash Claw takes 0 damage from attacks triggered specifically by Overwatch /
// reaction fire. The reaction itself still fires, consumes ammo, and consumes
// the prepared reaction — but HP damage is 0 and no damage-linked secondary
// effects (Armor Shred, cover damage, hit-based statuses) are applied.
//
// This is PASSIVE DEFINITION DATA (declared on the archetype), not persistent
// unit state. It does not need save/load — a rebuilt Flash Claw always has it.
//
// Immunity scope (spec 11): applies ONLY to Overwatch / reaction-fire sources.
// Normal Player Phase attacks, class abilities, Grenades, Rockets, Mines,
// Commander effects, environmental damage, melee attacks, and status damage
// all deal full damage to Flash Claw.

// Archetypes that carry the Flash Reflexes passive.
const FLASH_REFLEXES_ARCHETYPES = new Set(['flash_claw']);

// Does this unit have the Flash Reflexes passive?
export function hasFlashReflexes(unit) {
  return !!unit && FLASH_REFLEXES_ARCHETYPES.has(unit.archetype);
}

// Display metadata for inspection / Tactical Lens (spec 31-32).
export const FLASH_REFLEXES_INFO = {
  id: 'flash_reflexes',
  name: 'Flash Reflexes',
  shortLabel: 'OVERWATCH IMMUNE',
  desc: 'Immune to damage from Overwatch-triggered attacks. Overwatch still fires and consumes the reaction.',
};