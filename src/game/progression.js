// XP thresholds, leveling, and upgrade definitions. All progression data is
// data-driven so balance changes never touch components.
//
// Level cap is 20. HP and Skill Selections are awarded ONLY at even levels
// (2, 4, 6, 8, 10, 12, 14, 16, 18, 20). Odd levels are XP milestones.
// A baseline Level 20 soldier has gained +10 Max HP (8 → 18 before armor).
// Existing Level 2–10 skill nodes remain; extra Skill Points from Levels 12–20
// can purchase any previously skipped existing skill.

import { SKILL_TREES, SKILL_AWARD_LEVELS } from './skillTrees';

export const MAX_LEVEL = 20;

// Levels at which a soldier gains +1 Max HP (and +1 current HP).
export const HP_AWARD_LEVELS = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20];

// XP required to advance FROM `level` TO `level+1`. Steadily increasing by +2
// per level. Level 20 is the cap — no threshold for 20 → 21.
export const XP_THRESHOLDS = {
  1: 4,   // L1 → L2
  2: 6,   // L2 → L3
  3: 8,   // L3 → L4
  4: 10,  // L4 → L5
  5: 12,  // L5 → L6
  6: 14,  // L6 → L7
  7: 16,  // L7 → L8
  8: 18,  // L8 → L9
  9: 20,  // L9 → L10
  10: 22, // L10 → L11
  11: 24, // L11 → L12
  12: 26, // L12 → L13
  13: 28, // L13 → L14
  14: 30, // L14 → L15
  15: 32, // L15 → L16
  16: 34, // L16 → L17
  17: 36, // L17 → L18
  18: 38, // L18 → L19
  19: 40, // L19 → L20
};

// XP awarded per source.
export const XP_REWARDS = {
  OBJECTIVE: 2,     // Primary objective secured (per living participant)
  ELITE: 1,         // Elite Response defeated (per living participant)
  KILLS_PER_XP: 3,  // Every 3 personal kills = 1 XP
};

export function xpForNextLevel(level) {
  return XP_THRESHOLDS[level] ?? Infinity;
}

export function canLevelUp(level, xp) {
  return level < MAX_LEVEL && xp >= xpForNextLevel(level);
}

// Does reaching this level grant +1 Max HP? Data-driven.
export function grantsHp(level) {
  return HP_AWARD_LEVELS.includes(level);
}

// Is this level the maximum level? Level 20 is MAX LEVEL.
export function isMaxLevel(level) {
  return (level || 1) >= MAX_LEVEL;
}

// Process sequential level-ups. Each crossed even level grants +1 Max HP and
// +1 current HP (no auto full-heal). Each crossed skill-award level grants a
// Skill Selection (handled by the caller via grantsSkillSelection). Excess XP
// carries toward the next level. Returns updated progression fields plus a
// leveledUp flag and the number of skill selections awarded by this level-up.
export function processLevelUps(soldier) {
  let { level, xp, max_hp, current_hp } = soldier;
  let leveledUp = false;
  let skillAwards = 0;
  let hpAwards = 0;
  while (canLevelUp(level, xp)) {
    xp -= xpForNextLevel(level);
    level += 1;
    leveledUp = true;
    if (grantsHp(level)) {
      max_hp += 1;
      current_hp += 1;
      hpAwards += 1;
    }
    if (grantsSkillSelection(level)) {
      skillAwards += 1;
    }
  }
  return { level, xp, max_hp, current_hp, leveledUp, skillAwards, hpAwards };
}

// Re-export so consumers that imported it from progression keep working.
export function grantsSkillSelection(level) {
  return SKILL_AWARD_LEVELS.includes(level);
}

// --- Upgrade / skill-node name lookup (for SoldierCard badges) ---
// Reads from the skill tree definitions so all 10 levels are covered without
// duplicating data. Returns [{ id, name }] for a given class + level tier.
export function getUpgradeChoices(cls, level) {
  const nodes = (SKILL_TREES[cls] && SKILL_TREES[cls].nodes) || [];
  return nodes
    .filter((n) => n.levelRequirement === level)
    .map((n) => ({ id: n.id, name: n.name, desc: n.description }));
}

export function hasUpgradeChoice(level) {
  return SKILL_AWARD_LEVELS.includes(level);
}

export function hasUpgrade(soldier, upgradeId) {
  if (!soldier || !soldier.upgrades) return false;
  return Object.values(soldier.upgrades).includes(upgradeId);
}

// Check if a unit (tactical) has an upgrade by id.
export function unitHasUpgrade(unit, upgradeId) {
  if (!unit || !unit.upgrades) return false;
  return Object.values(unit.upgrades).includes(upgradeId);
}