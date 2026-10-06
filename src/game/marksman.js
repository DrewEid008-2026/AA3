// Marksman logic: Line Up target-lock and Relocate post-kill movement.
// Line Up is stored on the Marksman unit (not on the target) so it only
// benefits the Marksman who used it. Relocate is a contextual 0-AP reposition
// that becomes available after a basic-attack kill.

// Does this attacker have Line Up active on this specific target?
export function hasLineUpOn(attacker, target) {
  return !!(attacker && attacker.lineUp && target && attacker.lineUp.targetId === target.id);
}

// Apply Line Up: mark a target on the Marksman. Returns a new unit.
export function applyLineUp(unit, target, ability) {
  return {
    ...unit,
    ap: Math.max(0, unit.ap - ability.apCost),
    cooldowns: { ...unit.cooldowns, [ability.id]: ability.cooldown },
    reaction: null,
    lineUp: { targetId: target.id },
  };
}

// Clear Line Up from a unit (after attacking, moving, target death, or
// Player Phase end). Returns a new unit, or the same ref if not active.
export function clearLineUp(unit) {
  if (!unit || !unit.lineUp) return unit;
  return { ...unit, lineUp: null };
}

// Clear Line Up if the target id matches a dead unit. Used after kills.
export function clearLineUpIfTarget(unit, deadTargetId) {
  if (!unit || !unit.lineUp) return unit;
  if (unit.lineUp.targetId === deadTargetId) return { ...unit, lineUp: null };
  return unit;
}

// --- Relocate ---

// Can the Marksman Relocate right now? (available flag + cooldown 0)
export function canRelocate(unit, ability) {
  if (!unit || !unit.alive || unit.team !== 'player') return false;
  if (!unit.relocateAvailable) return false;
  if (!ability) return false;
  const cd = (unit.cooldowns && unit.cooldowns.relocate) || 0;
  return cd === 0;
}

// Mark Relocate as available (after a kill). Returns a new unit.
export function enableRelocate(unit, ability) {
  if (!unit || !ability) return unit;
  const cd = (unit.cooldowns && unit.cooldowns.relocate) || 0;
  if (cd > 0) return unit; // on cooldown — no relocate opportunity
  return { ...unit, relocateAvailable: true };
}

// Clear the Relocate opportunity (skip or end of phase). Returns a new unit.
export function clearRelocate(unit) {
  if (!unit || !unit.relocateAvailable) return unit;
  return { ...unit, relocateAvailable: false };
}

// Resolve Relocate: move to the destination, start cooldown, clear the flag.
// 0 AP cost. Returns a new unit. The caller handles the Burning hook and
// civilian escorting follow-up.
export function performRelocate(unit, entry, ability) {
  return {
    ...unit,
    x: entry.x,
    y: entry.y,
    cooldowns: { ...unit.cooldowns, relocate: ability.cooldown },
    relocateAvailable: false,
    lineUp: null, // movement cancels Line Up
    reaction: null,
  };
}