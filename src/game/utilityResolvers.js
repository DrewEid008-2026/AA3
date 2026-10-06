// Utility-item ability resolvers (Smoke Grenade, Sprint Harness, Emergency
// Shield). Extracted from Battle.jsx to keep the component lean. Each function
// takes the shared battle context and performs the ability deterministically.

import { addSmoke } from './smoke';
import { applyShield } from './shield';
import { getUnitAbility } from './abilities';

// SMOKE GRENADE: 1 AP. Target an empty tile within range 3. Creates a 3x3 smoke
// cloud that blocks Line of Sight through affected tiles. Smoke clears at the
// start of each new Player Phase. 1 use per mission.
export function resolveSmokeGrenade(ctx) {
  const { grid, setGrid, caster, x, y, withBurning, setUnits, setResolving, setAbilityTargeting, flashAttackFeedback, flashInvalid, grenadeImpactKeys } = ctx;
  if (!grenadeImpactKeys || !grenadeImpactKeys.has(`${x},${y}`)) {
    flashInvalid({ x, y });
    return;
  }
  const smokeAbility = getUnitAbility(caster, 'smoke_grenade');
  setAbilityTargeting(null);
  setResolving(true);
  const newGrid = addSmoke(grid, x, y, smokeAbility.areaRadius);
  setGrid(newGrid);
  const atkFinal = withBurning(
    { ...caster, ap: Math.max(0, caster.ap - 1), abilityUses: { ...caster.abilityUses, smoke_grenade: (caster.abilityUses?.smoke_grenade || 0) + 1 }, reaction: null },
    caster.x, caster.y
  );
  setUnits((prev) => prev.map((u) => (u.id === caster.id ? atkFinal : u)));
  flashAttackFeedback(x, y, 'SMOKE', 'status');
  setResolving(false);
}

// SPRINT HARNESS: 1 AP. Gain +3 movement until the end of this Player Phase.
// The bonus is consumed when the unit moves or when the phase ends. 1 use/mission.
export function resolveSprintHarness(ctx) {
  const { caster, withBurning, setUnits, setResolving, setAbilityTargeting, flashAttackFeedback } = ctx;
  setAbilityTargeting(null);
  setResolving(true);
  const atkFinal = withBurning(
    { ...caster, ap: Math.max(0, caster.ap - 1), abilityUses: { ...caster.abilityUses, sprint_harness: (caster.abilityUses?.sprint_harness || 0) + 1 }, sprintHarnessActive: true, reaction: null },
    caster.x, caster.y
  );
  setUnits((prev) => prev.map((u) => (u.id === caster.id ? atkFinal : u)));
  flashAttackFeedback(caster.x, caster.y, 'SPRINT +3', 'status');
  setResolving(false);
}

// EMERGENCY SHIELD: 1 AP. Gain a 3-point Shield that absorbs the next incoming
// damage. The shield persists until consumed or the mission ends. 1 use/mission.
export function resolveEmergencyShield(ctx) {
  const { caster, withBurning, setUnits, setResolving, setAbilityTargeting, flashAttackFeedback } = ctx;
  setAbilityTargeting(null);
  setResolving(true);
  const atkFinal = withBurning(
    applyShield({ ...caster, ap: Math.max(0, caster.ap - 1), abilityUses: { ...caster.abilityUses, emergency_shield: (caster.abilityUses?.emergency_shield || 0) + 1 }, reaction: null }, 3, caster.id),
    caster.x, caster.y
  );
  setUnits((prev) => prev.map((u) => (u.id === caster.id ? atkFinal : u)));
  flashAttackFeedback(caster.x, caster.y, 'SHIELD +3', 'status');
  setResolving(false);
}