import { ITEMS } from './equipment';
import { getAbility } from './abilities';

// Fixed messages for non-ability actions. Movement and basic attack have no
// exclamation (ongoing states); everything else is an exclaimed action.
export const BUBBLE = {
  MOVING: 'MOVING',
  ATTACKING: 'ATTACKING',
  RELOADING: 'RELOADING!',
  OVERWATCH: 'OVERWATCH!',
  REVIVE: 'REVIVE!',
  FLASH_ADVANCE: 'FLASH ADVANCE!', // Flash Claw moving through reaction fire (spec 33)
};

// Returns the action bubble message for an ability activation.
// Class abilities use the ability's display name; equipment-granted abilities
// use the owning item's full name (e.g. "Smoke Grenade" not "Smoke").
// Structured so a future implementation can swap in a message library.
export function getAbilityBubbleMessage(abilityId) {
  const ability = getAbility(abilityId);
  if (!ability) return null;
  let name = ability.name;
  if (ability.cls === 'equipment') {
    const item = Object.values(ITEMS).find((i) => i.grantsAbility === abilityId);
    if (item) name = item.name;
  }
  return name.toUpperCase() + '!';
}