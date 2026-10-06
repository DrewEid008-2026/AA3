// Commander — persistent player strategic-command system. Stored on the
// campaign blob as `commander = { unlocked, unlockedSkillIds }`. Independent
// of squad-size improvements, chapter progression, soldier level/class, and
// equipment.
//
// This phase implements only the unlock foundation. Future prompts will
// expand the Commander object (skills, tactical button, targeting, resource
// costs) without restructuring saves — the object shape is stable.

// One-time unlock cost. Credits only — no Alien Materials, Power Cores, or
// Nano Cubes required.
export const COMMANDER_COST = 100;

// Fresh Commander state. Every new save and every migrated old save starts
// locked with an empty skill list. hasNewSkillNotification is a transient flag
// set when a new skill is unlocked — cleared when the player opens the
// Commander panel. Not critical for battle, but drives a future badge.
export function createDefaultCommander() {
  return { unlocked: false, unlockedSkillIds: [], hasNewSkillNotification: false };
}

// Normalize any Commander-shaped object into the canonical form. Defends
// against missing/extra fields from old or hand-edited saves. Never throws.
// Deduplicates unlockedSkillIds — duplicate entries are silently collapsed.
export function normalizeCommander(cmd) {
  if (!cmd) return createDefaultCommander();
  const rawIds = Array.isArray(cmd.unlockedSkillIds) ? cmd.unlockedSkillIds : [];
  const seen = new Set();
  const dedupedIds = [];
  for (const id of rawIds) {
    if (typeof id === 'string' && !seen.has(id)) {
      seen.add(id);
      dedupedIds.push(id);
    }
  }
  return {
    unlocked: !!cmd.unlocked,
    unlockedSkillIds: dedupedIds,
    hasNewSkillNotification: !!cmd.hasNewSkillNotification,
  };
}

// Read the Commander state from a save or campaign object. Returns the
// normalized Commander object (never throws, never null).
export function getCommanderState(save) {
  if (!save) return createDefaultCommander();
  return normalizeCommander(save.commander);
}

// Clean unlock check for future HUD/system gating: `if (isCommanderUnlocked(save))`.
// Reads defensively — missing commander defaults to locked.
export function isCommanderUnlocked(save) {
  return !!save?.commander?.unlocked;
}