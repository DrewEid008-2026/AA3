// Slot-scoped campaign persistence. All reads/writes go to the active save
// slot's localStorage blob via saveSlots.js — every write is an autosave and
// updates lastPlayedAt automatically. Exported function signatures match the
// old entity-based API so consumers (Squad, Armory, Deploy, Battle) are
// unchanged. Soldiers use `soldier_id` as their `id` so it is stable, unique
// within a slot, and URL-safe for the deploy-selection query param.
import {
  INITIAL_ROSTER,
  newSoldierRecord,
  createRecruitSoldierRecord,
  generateRandomName,
  generateUniqueSoldierId,
  readActiveCampaign,
  writeActiveCampaign,
} from './saveSlots';
import { getItem, getEffectiveMaxHp, ECONOMY, getItemCost, checkAffordability, missingResourcesText } from './equipment';
import { RESPEC_COST } from './economy';
import { SQUAD_UPGRADES, getMaxSquadSize as computeMaxSquadSize } from './squadUpgrades';
import { COMMANDER_COST, createDefaultCommander, getCommanderState, normalizeCommander } from './commander';
import { deduplicateSkillIds, getCommanderSkill } from './commanderSkills';
import { applySkillSelection, totalSkillPointsByLevel, countSelectedSkills, grantsSkillSelection } from './skillTrees';
import { HP_AWARD_LEVELS, MAX_LEVEL, processLevelUps } from './progression';
import {
  createDefaultChapter,
  createDefaultChaptersState, migrateChaptersState,
  applyChapterProgressForChapter, unlockNextChapter,
  clearNewlyUnlocked, clearBossNewlyUnlocked,
  createDefaultChapterState,
} from './chapter';

// --- Soldiers ---

// Return the active campaign's soldiers with an `id` field (=== soldier_id)
// so consumers can use s.id uniformly.
export async function loadSoldiers() {
  const c = readActiveCampaign();
  if (!c) return [];
  return (c.soldiers || []).map((s) => ({ ...s, id: s.soldier_id }));
}

export async function ensureRoster() {
  return loadSoldiers();
}

// Persist updated soldier fields to the active campaign, matching by id.
export async function saveSoldiers(soldiers) {
  const c = readActiveCampaign();
  if (!c) return;
  const existing = c.soldiers || [];
  c.soldiers = existing.map((s) => {
    const u = soldiers.find((x) => x.id === s.soldier_id || x.soldier_id === s.soldier_id);
    if (!u) return s;
    return {
      ...s,
      level: u.level,
      xp: u.xp,
      current_hp: u.current_hp,
      max_hp: u.max_hp,
      alive: u.alive,
      injured: u.injured || false,
      injuries_sustained: u.injuries_sustained || 0,
      missions_participated: u.missions_participated,
      missions_survived: u.missions_survived,
      personal_kills: u.personal_kills,
      elite_kills: u.elite_kills,
      times_downed: u.times_downed,
      revives_performed: u.revives_performed,
      upgrades: u.upgrades,
      available_skill_selections: u.available_skill_selections || 0,
      kill_progress: u.kill_progress,
      equipped_weapon: u.equipped_weapon || null,
      equipped_armor: u.equipped_armor || null,
      equipped_utility: u.equipped_utility || null,
      name: u.name ?? s.name,
      callsign: u.callsign ?? s.callsign,
      icon_color: u.icon_color ?? s.icon_color,
      icon: u.icon ?? s.icon,
    };
  });
  writeActiveCampaign(c);
}

// --- Recruitment ---

// Recruit a new soldier of the given class. Free — no resource cost. The
// recruit starts at Level 1, 0 XP, no skill selections, READY, full base HP,
// and NO equipment. A random name is generated (preferring unused names).
// Returns the new soldier (with id).
export async function recruitSoldier(cls) {
  const c = readActiveCampaign();
  if (!c) throw new Error('No active campaign');
  const soldiers = c.soldiers || [];
  const existingIds = soldiers.map((s) => s.soldier_id);
  const existingNames = soldiers.map((s) => s.name);
  const soldierId = generateUniqueSoldierId(existingIds);
  const name = generateRandomName(existingNames);
  const record = createRecruitSoldierRecord(cls, name, soldierId);
  c.soldiers = [...soldiers, record];
  writeActiveCampaign(c);
  return { ...record, id: record.soldier_id };
}

// Rename a soldier. Updates both name and callsign so the change appears
// everywhere (squad, manage unit, deployment, tactical HUD, results, save).
// Soldier ID is the persistent identity — name is never used as a key.
export async function renameSoldier(soldierId, newName) {
  const c = readActiveCampaign();
  if (!c) throw new Error('No active campaign');
  const soldiers = c.soldiers || [];
  const soldier = soldiers.find((s) => s.soldier_id === soldierId);
  if (!soldier) throw new Error('Soldier not found');
  const updated = { ...soldier, name: newName, callsign: newName };
  c.soldiers = soldiers.map((s) => (s.soldier_id === soldierId ? updated : s));
  writeActiveCampaign(c);
  return { ...updated, id: updated.soldier_id };
}

// Change a soldier's icon color. Cosmetic only — no gameplay effect.
export async function setSoldierIconColor(soldierId, color) {
  const c = readActiveCampaign();
  if (!c) throw new Error('No active campaign');
  const soldiers = c.soldiers || [];
  const soldier = soldiers.find((s) => s.soldier_id === soldierId);
  if (!soldier) throw new Error('Soldier not found');
  const updated = { ...soldier, icon_color: color };
  c.soldiers = soldiers.map((s) => (s.soldier_id === soldierId ? updated : s));
  writeActiveCampaign(c);
  return { ...updated, id: updated.soldier_id };
}

// Change a soldier's icon. Cosmetic only — no gameplay effect. Free.
export async function setSoldierIcon(soldierId, iconKey) {
  const c = readActiveCampaign();
  if (!c) throw new Error('No active campaign');
  const soldiers = c.soldiers || [];
  const soldier = soldiers.find((s) => s.soldier_id === soldierId);
  if (!soldier) throw new Error('Soldier not found');
  const updated = { ...soldier, icon: iconKey };
  c.soldiers = soldiers.map((s) => (s.soldier_id === soldierId ? updated : s));
  writeActiveCampaign(c);
  return { ...updated, id: updated.soldier_id };
}

// Dismiss a soldier permanently. Equipment is automatically returned to
// available inventory (items are already owned; removing the soldier reduces
// the equipped count, making them available). The soldier's XP, level, skills,
// kills, and statistics are permanently removed. No resources are refunded.
// Atomic: all changes are committed in a single write.
export async function dismissSoldier(soldierId) {
  const c = readActiveCampaign();
  if (!c) throw new Error('No active campaign');
  c.soldiers = (c.soldiers || []).filter((s) => s.soldier_id !== soldierId);
  writeActiveCampaign(c);
}

// --- Skill tree ---

// Spend one available skill selection on a node. Validates via skillTrees
// (level, prerequisites, exclusivity, available points) before persisting.
// Returns the updated soldier (with id). Throws if the selection is invalid.
export async function selectSkill(soldierId, nodeId) {
  const c = readActiveCampaign();
  if (!c) throw new Error('No active campaign');
  const soldiers = c.soldiers || [];
  const soldier = soldiers.find((s) => s.soldier_id === soldierId);
  if (!soldier) throw new Error('Soldier not found');
  const updated = applySkillSelection({ ...soldier, id: soldier.soldier_id }, nodeId);
  c.soldiers = soldiers.map((s) => (s.soldier_id === soldier.soldier_id ? updated : s));
  writeActiveCampaign(c);
  return updated;
}

// --- Respec (rebuild class + skill tree) ---

// Respec a soldier: change class (or rebuild the same class) and refund all
// selected skills as available Skill Points. Costs RESPEC_COST credits, charged
// only on a successful commit. Atomic: verifies credits, deducts, clears
// skills, sets class, recomputes points, and persists in a single write.
//
// Preserves: id, name, icon color, level, XP, max/current HP, equipment, injury
// status, and all career statistics. Class change does not alter Max HP (it is
// level-based), so current HP is preserved (injured soldiers stay at 0 HP).
// Old-class skill effects are removed because applyUpgrades (units.js) gates
// every bonus by the unit's current class and the upgrades array is cleared.
export async function respecSoldier(soldierId, newClass) {
  const c = readActiveCampaign();
  if (!c) throw new Error('No active campaign');
  const soldiers = c.soldiers || [];
  const soldier = soldiers.find((s) => s.soldier_id === soldierId);
  if (!soldier) throw new Error('Soldier not found');
  if (!['assault', 'heavy', 'support', 'engineer', 'marksman'].includes(newClass)) {
    throw new Error('Invalid class');
  }
  // Verify credits before any mutation (atomic safety).
  if ((c.credits || 0) < RESPEC_COST) throw new Error('NOT ENOUGH CREDITS');

  const updated = {
    ...soldier,
    class: newClass,
    upgrades: [],
    available_skill_selections: totalSkillPointsByLevel(soldier.level || 1),
    // current_hp preserved as-is; clamp to max_hp defensively (class change
    // does not alter max_hp, so this is a no-op in practice).
    current_hp: Math.min(soldier.current_hp ?? 0, soldier.max_hp ?? 0),
  };

  c.soldiers = soldiers.map((s) => (s.soldier_id === soldierId ? updated : s));
  c.credits = (c.credits || 0) - RESPEC_COST;
  writeActiveCampaign(c);
  return {
    soldier: { ...updated, id: updated.soldier_id },
    save: makeSave(c),
  };
}

// Debug: restore all soldiers to default state.
export async function restoreTestRoster() {
  const c = readActiveCampaign();
  if (!c) return [];
  c.soldiers = INITIAL_ROSTER.map(newSoldierRecord);
  writeActiveCampaign(c);
  return c.soldiers.map((s) => ({ ...s, id: s.soldier_id }));
}

// --- Player save (credits, alien materials, inventory, squad upgrades) ---

export async function loadPlayerSave() {
  const c = readActiveCampaign();
  if (!c) return { id: 'active', credits: 0, alien_materials: 0, powerCores: 0, nanoCubes: 0, inventory: {}, squad_upgrades: {}, commander: createDefaultCommander(), chapter: createDefaultChapter(), chapters: createDefaultChaptersState() };
  return {
    id: 'active',
    credits: c.credits || 0,
    alien_materials: c.alien_materials || 0,
    powerCores: c.powerCores || 0,
    nanoCubes: c.nanoCubes || 0,
    inventory: c.inventory || {},
    squad_upgrades: c.squad_upgrades || {},
    commander: getCommanderState(c),
    chapter: c.chapter || createDefaultChapter(),
    chapters: migrateChaptersState(c),
  };
}

export async function savePlayerSave(save) {
  const c = readActiveCampaign();
  if (!c) return;
  c.credits = save.credits;
  c.alien_materials = save.alien_materials;
  c.powerCores = save.powerCores || 0;
  c.nanoCubes = save.nanoCubes || 0;
  c.inventory = save.inventory || {};
  c.squad_upgrades = save.squad_upgrades || {};
  c.commander = normalizeCommander(save.commander || c.commander);
  if (save.chapter) c.chapter = save.chapter;
  // NOTE: chapters state is managed solely by recordMissionCompletion and the
  // debug chapter functions — never overwritten here to avoid clobbering fresh
  // progress with a stale snapshot.
  writeActiveCampaign(c);
}

// Remember the last deployed soldier IDs so the next Deploy screen can
// preselect them — fewer taps between missions. Stored on the campaign blob.
export function getLastDeployedSoldierIds() {
  const c = readActiveCampaign();
  if (!c) return [];
  return Array.isArray(c.lastDeployedSoldierIds) ? c.lastDeployedSoldierIds : [];
}

export function setLastDeployedSoldierIds(ids) {
  const c = readActiveCampaign();
  if (!c) return;
  c.lastDeployedSoldierIds = Array.isArray(ids) ? ids : [];
  writeActiveCampaign(c);
}

// --- Equipment transactions ---

export async function buyItem(itemId) {
  const item = getItem(itemId);
  if (!item) throw new Error('Unknown item');
  const c = readActiveCampaign();
  if (!c) throw new Error('No active campaign');
  const cost = getItemCost(item);
  const { canAfford, missing } = checkAffordability(c, cost);
  if (!canAfford) throw new Error(missingResourcesText(missing));
  c.inventory = { ...(c.inventory || {}) };
  const targetId = item ? item.id : itemId;
  // All equipment is unlock-based — one purchase makes it available to all soldiers.
  if ((c.inventory[targetId] || 0) > 0) throw new Error('Already unlocked');
  c.inventory[targetId] = 1;
  c.credits = (c.credits || 0) - cost.credits;
  c.alien_materials = (c.alien_materials || 0) - cost.alienMaterials;
  c.powerCores = (c.powerCores || 0) - cost.powerCores;
  c.nanoCubes = (c.nanoCubes || 0) - (cost.nanoCubes || 0);
  writeActiveCampaign(c);
  return makeSave(c);
  }

export async function equipItem(soldierId, slot, itemId) {
  const c = readActiveCampaign();
  if (!c) throw new Error('No active campaign');
  const soldiers = c.soldiers || [];
  const soldier = soldiers.find((s) => s.soldier_id === soldierId);
  if (!soldier) throw new Error('Soldier not found');

  const item = getItem(itemId);
  const targetId = item ? item.id : itemId;
  // All equipment is unlock-based — any soldier can equip if unlocked.
  if ((c.inventory?.[targetId] || 0) <= 0 && (c.inventory?.[itemId] || 0) <= 0) throw new Error('Not unlocked');
  c.soldiers = soldiers.map((s) => (s.soldier_id === soldier.soldier_id ? { ...s, [slot]: targetId } : s));

  writeActiveCampaign(c);
  return { ...soldier, [slot]: itemId, id: soldier.soldier_id };
}

// Find which soldier currently has an item equipped in a given slot.
// Returns the soldier record or null. Used by the transfer confirmation UI.
export function getItemHolder(soldiers, slot, itemId) {
  return soldiers.find((s) => s[slot] === itemId) || null;
}

export async function unequipItem(soldierId, slot) {
  const c = readActiveCampaign();
  if (!c) throw new Error('No active campaign');
  const soldiers = c.soldiers || [];
  const soldier = soldiers.find((s) => s.soldier_id === soldierId);
  if (!soldier) throw new Error('Soldier not found');
  if (!soldier[slot]) return { ...soldier, id: soldier.soldier_id };

  const updated = { ...soldier, [slot]: null };

  c.soldiers = soldiers.map((s) => (s.soldier_id === soldier.soldier_id ? updated : s));
  writeActiveCampaign(c);
  return { ...updated, id: updated.soldier_id };
}

// --- Injury treatment ---

export async function treatInjury(soldierId) {
  const c = readActiveCampaign();
  if (!c) throw new Error('No active campaign');
  const soldiers = c.soldiers || [];
  const soldier = soldiers.find((s) => s.soldier_id === soldierId);
  if (!soldier) throw new Error('Soldier not found');
  if (!soldier.injured) throw new Error('Soldier is not injured');

  const effMaxHp = getEffectiveMaxHp(soldier);
  const cost = effMaxHp * ECONOMY.MEDICAL_COST_PER_HP;
  if ((c.credits || 0) < cost) throw new Error('NOT ENOUGH CREDITS');

  const updatedSoldier = { ...soldier, injured: false, current_hp: effMaxHp };
  c.soldiers = soldiers.map((s) => (s.soldier_id === soldier.soldier_id ? updatedSoldier : s));
  c.credits = c.credits - cost;
  writeActiveCampaign(c);
  return {
    soldier: { ...updatedSoldier, id: updatedSoldier.soldier_id },
    cost,
    save: {
      id: 'active',
      credits: c.credits,
      alien_materials: c.alien_materials || 0,
      powerCores: c.powerCores || 0,
      inventory: c.inventory || {},
      squad_upgrades: c.squad_upgrades || {},
    },
  };
}

// --- Squad size upgrades ---

export function getMaxSquadSize(save) {
  return computeMaxSquadSize(save);
}

export async function buySquadUpgrade(upgradeId) {
  const upgrade = SQUAD_UPGRADES[upgradeId];
  if (!upgrade) throw new Error('Unknown upgrade');
  const c = readActiveCampaign();
  if (!c) throw new Error('No active campaign');
  if (c.squad_upgrades?.[upgradeId]) throw new Error('Already purchased');
  if (upgrade.requires && !c.squad_upgrades?.[upgrade.requires]) throw new Error('LOCKED');
  if ((c.credits || 0) < upgrade.cost) throw new Error('NOT ENOUGH CREDITS');
  c.squad_upgrades = { ...(c.squad_upgrades || {}), [upgradeId]: true };
  c.credits = c.credits - upgrade.cost;
  writeActiveCampaign(c);
  return makeSave(c);
}

// --- Commander unlock ---

// Atomically unlock the Commander system. Verifies credits, deducts exactly
// COMMANDER_COST, sets commander.unlocked, and prevents duplicate processing.
// Rapid taps are safe: the unlocked guard throws before any deduction, and
// the read-check-write is synchronous (no await between read and write).
export async function buyCommander() {
  const c = readActiveCampaign();
  if (!c) throw new Error('No active campaign');
  if (c.commander?.unlocked) throw new Error('Already unlocked');
  if ((c.credits || 0) < COMMANDER_COST) throw new Error('NOT ENOUGH CREDITS');
  c.commander = { ...getCommanderState(c), unlocked: true };
  // Auto-unlock the first production player Commander Skill (Tactical Advance)
  // when the Commander system is purchased. Deduplicated — safe if already present.
  c.commander.unlockedSkillIds = deduplicateSkillIds([
    ...(c.commander.unlockedSkillIds || []),
    'player_tactical_advance',
  ]);
  c.commander.hasNewSkillNotification = true;
  c.credits = (c.credits || 0) - COMMANDER_COST;
  writeActiveCampaign(c);
  return makeSave(c);
}

// --- Mission completion (called from Battle.jsx after rewards commit) ---

export async function recordMissionCompletion(
  missionId,
  { totalKills = 0, totalEliteKills = 0, creditsEarned = 0, alienMaterialsEarned = 0, powerCoresEarned = 0, isBoss = false, chapterId = 'ch1' } = {}
) {
  const c = readActiveCampaign();
  if (!c) return;
  c.missionProgress = c.missionProgress || { completedMissions: [] };
  if (missionId && !c.missionProgress.completedMissions.includes(missionId)) {
    c.missionProgress.completedMissions.push(missionId);
  }
  c.campaignStats = c.campaignStats || {
    missionsCompleted: 0, totalKills: 0, totalEliteKills: 0,
    totalCreditsEarned: 0, totalAlienMaterialsEarned: 0,
  };
  c.campaignStats.missionsCompleted = (c.campaignStats.missionsCompleted || 0) + 1;
  c.campaignStats.totalKills = (c.campaignStats.totalKills || 0) + totalKills;
  c.campaignStats.totalEliteKills = (c.campaignStats.totalEliteKills || 0) + totalEliteKills;
  c.campaignStats.totalCreditsEarned = (c.campaignStats.totalCreditsEarned || 0) + creditsEarned;
  c.campaignStats.totalAlienMaterialsEarned =
    (c.campaignStats.totalAlienMaterialsEarned || 0) + alienMaterialsEarned;
  c.campaignStats.totalPowerCoresEarned =
    (c.campaignStats.totalPowerCoresEarned || 0) + powerCoresEarned;

  // Multi-chapter progression: apply +10% / bossDefeated to the chapter the
  // mission was launched from (missionChapterId). On boss defeat, unlock the
  // next chapter. Runs once per attempt (guarded by missionCommittedRef).
  c.chapters = migrateChaptersState(c);
  c.chapters = applyChapterProgressForChapter(c.chapters, chapterId, isBoss);
  if (isBoss) {
    c.chapters = unlockNextChapter(c.chapters, chapterId);
  }

  writeActiveCampaign(c);
}

// --- Debug controls ---

export async function setSoldierInjured(soldierId, injured) {
  const c = readActiveCampaign();
  if (!c) throw new Error('No active campaign');
  const soldiers = c.soldiers || [];
  const soldier = soldiers.find((s) => s.soldier_id === soldierId);
  if (!soldier) throw new Error('Soldier not found');
  const updated = injured
    ? { ...soldier, injured: true, current_hp: 0 }
    : { ...soldier, injured: false, current_hp: getEffectiveMaxHp(soldier) };
  c.soldiers = soldiers.map((s) => (s.soldier_id === soldier.soldier_id ? updated : s));
  writeActiveCampaign(c);
  return { ...updated, id: updated.soldier_id };
}

// Debug: set a soldier's Level directly. Recomputes max_hp from the level
// progression (base 8 + HP awards), clamps current_hp, and recomputes
// available_skill_selections from level vs. selected skills. Does NOT auto-
// level-up or fabricate XP — existing XP is preserved.
export async function debugSetSoldierLevel(soldierId, level) {
  const c = readActiveCampaign();
  if (!c) throw new Error('No active campaign');
  const soldiers = c.soldiers || [];
  const soldier = soldiers.find((s) => s.soldier_id === soldierId);
  if (!soldier) throw new Error('Soldier not found');
  const lvl = Math.max(1, Math.min(MAX_LEVEL, level));
  const maxHp = 8 + HP_AWARD_LEVELS.filter((l) => l <= lvl).length;
  const updated = {
    ...soldier,
    level: lvl,
    max_hp: maxHp,
    current_hp: soldier.injured ? 0 : Math.min(soldier.current_hp ?? maxHp, maxHp),
    available_skill_selections: Math.max(0, totalSkillPointsByLevel(lvl) - countSelectedSkills(soldier)),
  };
  c.soldiers = soldiers.map((s) => (s.soldier_id === soldier.soldier_id ? updated : s));
  writeActiveCampaign(c);
  return { ...updated, id: updated.soldier_id };
}

// Debug: grant XP to a soldier and process any resulting level-ups. Mirrors
// the missionCommit progression path so level-ups, HP awards, and skill
// awards are applied identically.
export async function debugGrantXp(soldierId, amount) {
  const c = readActiveCampaign();
  if (!c) throw new Error('No active campaign');
  const soldiers = c.soldiers || [];
  const soldier = soldiers.find((s) => s.soldier_id === soldierId);
  if (!soldier) throw new Error('Soldier not found');
  const s = { ...soldier, xp: (soldier.xp || 0) + amount };
  const oldLevel = s.level || 1;
  const lv = processLevelUps(s);
  s.level = lv.level;
  s.xp = lv.xp;
  s.max_hp = lv.max_hp;
  s.current_hp = soldier.injured ? 0 : lv.current_hp;
  let skillAwards = 0;
  for (let lvl = oldLevel + 1; lvl <= lv.level; lvl++) {
    if (grantsSkillSelection(lvl)) skillAwards++;
  }
  s.available_skill_selections = (soldier.available_skill_selections || 0) + skillAwards;
  c.soldiers = soldiers.map((x) => (x.soldier_id === soldier.soldier_id ? s : x));
  writeActiveCampaign(c);
  return { ...s, id: s.soldier_id };
}

export async function addCredits(amount) {
  const c = readActiveCampaign();
  if (!c) throw new Error('No active campaign');
  c.credits = Math.max(0, (c.credits || 0) + amount);
  writeActiveCampaign(c);
  return makeSave(c);
}

export async function addAlienMaterials(amount) {
  const c = readActiveCampaign();
  if (!c) throw new Error('No active campaign');
  c.alien_materials = Math.max(0, (c.alien_materials || 0) + amount);
  writeActiveCampaign(c);
  return makeSave(c);
}

export async function addPowerCores(amount) {
  const c = readActiveCampaign();
  if (!c) throw new Error('No active campaign');
  c.powerCores = Math.max(0, (c.powerCores || 0) + amount);
  writeActiveCampaign(c);
  return makeSave(c);
}

// Debug: give an item to the inventory without spending resources.
export async function giveItem(itemId, qty = 1) {
  const c = readActiveCampaign();
  if (!c) throw new Error('No active campaign');
  c.inventory = { ...(c.inventory || {}) };
  c.inventory[itemId] = 1; // unlock
  writeActiveCampaign(c);
  return makeSave(c);
}

export async function resetSquadUpgrades() {
  const c = readActiveCampaign();
  if (!c) throw new Error('No active campaign');
  c.squad_upgrades = {};
  writeActiveCampaign(c);
  return makeSave(c);
}

// Debug-only: directly toggle the Chess Board upgrade without spending credits.
// Used by the Chess Table debug panel (?debug=1) to test locked/unlocked states.
export async function debugSetChessBoard(unlocked) {
  const c = readActiveCampaign();
  if (!c) throw new Error('No active campaign');
  c.squad_upgrades = { ...(c.squad_upgrades || {}) };
  if (unlocked) c.squad_upgrades.chess_board = true;
  else delete c.squad_upgrades.chess_board;
  writeActiveCampaign(c);
  return makeSave(c);
}

// Debug-only: directly toggle the Commander unlock without spending credits.
// Used by the DebugOverlay to test locked/unlocked states and save migration.
export async function debugSetCommander(unlocked) {
  const c = readActiveCampaign();
  if (!c) throw new Error('No active campaign');
  c.commander = { ...getCommanderState(c), unlocked: !!unlocked };
  writeActiveCampaign(c);
  return makeSave(c);
}

// Debug-only: set Credits to an exact value. Used to test the Commander
// purchase at the exact threshold (0, 100) and insufficient-funds paths.
export async function debugSetCredits(amount) {
  const c = readActiveCampaign();
  if (!c) throw new Error('No active campaign');
  c.credits = Math.max(0, Math.round(amount));
  writeActiveCampaign(c);
  return makeSave(c);
}

// Debug-only: set Alien Materials to an exact value.
export async function debugSetAlienMaterials(amount) {
  const c = readActiveCampaign();
  if (!c) throw new Error('No active campaign');
  c.alien_materials = Math.max(0, Math.round(amount));
  writeActiveCampaign(c);
  return makeSave(c);
}

// Debug-only: set Power Cores to an exact value.
export async function debugSetPowerCores(amount) {
  const c = readActiveCampaign();
  if (!c) throw new Error('No active campaign');
  c.powerCores = Math.max(0, Math.round(amount));
  writeActiveCampaign(c);
  return makeSave(c);
}

// Debug-only: set Nano Cubes to an exact value.
export async function debugSetNanoCubes(amount) {
  const c = readActiveCampaign();
  if (!c) throw new Error('No active campaign');
  c.nanoCubes = Math.max(0, Math.round(amount));
  writeActiveCampaign(c);
  return makeSave(c);
}

// --- Commander skill unlock / remove (future API) ---

// Unlock a Commander skill permanently. Validates the skill exists and is
// marked playerAvailable. Deduplicates — adding an already-unlocked skill is
// a no-op (returns the current save). Sets hasNewSkillNotification so the
// Commander button can show a badge. Persists immediately.
//
// NOTE: This does NOT charge an unlockCost — that is a future Armory purchase
// flow. For now this is the internal API called by future purchase logic.
export async function unlockCommanderSkill(skillId) {
  const skill = getCommanderSkill(skillId);
  if (!skill) throw new Error('Unknown skill');
  if (skill.playerAvailable === false) throw new Error('Skill not available to players');
  const c = readActiveCampaign();
  if (!c) throw new Error('No active campaign');
  c.commander = normalizeCommander(c.commander || createDefaultCommander());
  if (c.commander.unlockedSkillIds.includes(skillId)) {
    return makeSave(c); // already unlocked — no-op
  }
  c.commander.unlockedSkillIds = deduplicateSkillIds([...c.commander.unlockedSkillIds, skillId]);
  c.commander.hasNewSkillNotification = true;
  writeActiveCampaign(c);
  return makeSave(c);
}

// Remove a Commander skill (dev/migration/deprecation only — never exposed to
// players). Silently no-op if the skill is not unlocked. Does NOT refund any
// unlock cost (future). Persists immediately.
export async function removeCommanderSkill(skillId) {
  const c = readActiveCampaign();
  if (!c) throw new Error('No active campaign');
  c.commander = normalizeCommander(c.commander || createDefaultCommander());
  c.commander.unlockedSkillIds = c.commander.unlockedSkillIds.filter((id) => id !== skillId);
  writeActiveCampaign(c);
  return makeSave(c);
}

// Clear the new-skill notification flag. Called when the player opens the
// Commander panel (the badge is consumed by viewing the skills list).
export async function clearCommanderNewSkillNotification() {
  const c = readActiveCampaign();
  if (!c) throw new Error('No active campaign');
  c.commander = normalizeCommander(c.commander || createDefaultCommander());
  if (!c.commander.hasNewSkillNotification) return makeSave(c);
  c.commander.hasNewSkillNotification = false;
  writeActiveCampaign(c);
  return makeSave(c);
}

// --- Squad level-up notification ---

// Set the squadSkillNotification flag on the active campaign. Set during
// mission commit when a level-up grants a skill selection. Synchronous write.
export function setSquadSkillNotification(value) {
  const c = readActiveCampaign();
  if (!c) return;
  c.squadSkillNotification = !!value;
  writeActiveCampaign(c);
}

// Clear the squadSkillNotification flag. Called when the player taps the Squad
// tab, consuming the pip. Synchronous write. No-op if the flag is already clear.
export function clearSquadSkillNotification() {
  const c = readActiveCampaign();
  if (!c) return;
  if (!c.squadSkillNotification) return;
  c.squadSkillNotification = false;
  writeActiveCampaign(c);
}

// --- Commander resource spending (atomic) ---

// Atomically deduct Commander Skill resource costs from the active campaign.
// Re-checks affordability (defense in depth) and clamps all resources to 0 —
// no Commander transaction can ever produce negative resources.
// cost = { credits, alienMaterials, powerCores, nanoCubes }
// Returns { ok, save } on success, or { ok: false, missing } if unaffordable.
export async function spendCommanderResources(cost) {
  const c = readActiveCampaign();
  if (!c) return { ok: false, missing: { credits: cost.credits || 0 } };
  const { canAfford, missing } = checkAffordability(c, cost);
  if (!canAfford) return { ok: false, missing };
  c.credits = Math.max(0, (c.credits || 0) - (cost.credits || 0));
  c.alien_materials = Math.max(0, (c.alien_materials || 0) - (cost.alienMaterials || 0));
  c.powerCores = Math.max(0, (c.powerCores || 0) - (cost.powerCores || 0));
  c.nanoCubes = Math.max(0, (c.nanoCubes || 0) - (cost.nanoCubes || 0));
  writeActiveCampaign(c);
  return { ok: true, save: makeSave(c) };
}

// Atomically refund Commander Skill resource costs to the active campaign.
// Used only as a safety net when effect initialization fails after payment.
// Adds resources back — never clamps downward.
export async function refundCommanderResources(cost) {
  const c = readActiveCampaign();
  if (!c) return { ok: false };
  c.credits = (c.credits || 0) + (cost.credits || 0);
  c.alien_materials = (c.alien_materials || 0) + (cost.alienMaterials || 0);
  c.powerCores = (c.powerCores || 0) + (cost.powerCores || 0);
  c.nanoCubes = (c.nanoCubes || 0) + (cost.nanoCubes || 0);
  writeActiveCampaign(c);
  return { ok: true, save: makeSave(c) };
}

// --- Chapter debug controls ---

// --- Multi-chapter debug controls ---
// These target a specific chapter by id. The legacy ch1-only wrappers below
// delegate to them for backward compat with existing Squad debug buttons.

export async function debugSetChapterProgress(chapterId, percent) {
  const c = readActiveCampaign();
  if (!c) throw new Error('No active campaign');
  c.chapters = migrateChaptersState(c);
  const clamped = Math.max(0, Math.min(100, percent));
  const ch = {
    ...(c.chapters[chapterId] || createDefaultChapterState(chapterId !== 'ch1')),
    chapterProgressPercent: clamped,
    successfulMissionCount: Math.round(clamped / 10),
    bossUnlocked: clamped >= 100,
  };
  c.chapters = { ...c.chapters, [chapterId]: ch };
  writeActiveCampaign(c);
  return makeSave(c);
}

export async function debugAddChapterProgress(chapterId, amount) {
  const c = readActiveCampaign();
  if (!c) throw new Error('No active campaign');
  c.chapters = migrateChaptersState(c);
  const cur = c.chapters[chapterId] || createDefaultChapterState(chapterId !== 'ch1');
  return debugSetChapterProgress(chapterId, Math.min(100, (cur.chapterProgressPercent || 0) + amount));
}

export async function debugUnlockChapter(chapterId) {
  const c = readActiveCampaign();
  if (!c) throw new Error('No active campaign');
  c.chapters = migrateChaptersState(c);
  c.chapters = {
    ...c.chapters,
    [chapterId]: { ...(c.chapters[chapterId] || createDefaultChapterState(false)), unlocked: true },
  };
  writeActiveCampaign(c);
  return makeSave(c);
}

export async function debugLockChapter(chapterId) {
  const c = readActiveCampaign();
  if (!c) throw new Error('No active campaign');
  c.chapters = migrateChaptersState(c);
  c.chapters = {
    ...c.chapters,
    [chapterId]: { ...(c.chapters[chapterId] || createDefaultChapterState(false)), unlocked: false, newlyUnlocked: false },
  };
  writeActiveCampaign(c);
  return makeSave(c);
}

export async function debugToggleNewBadge(chapterId) {
  const c = readActiveCampaign();
  if (!c) throw new Error('No active campaign');
  c.chapters = migrateChaptersState(c);
  const ch = c.chapters[chapterId] || createDefaultChapterState(false);
  c.chapters = { ...c.chapters, [chapterId]: { ...ch, newlyUnlocked: !ch.newlyUnlocked } };
  writeActiveCampaign(c);
  return makeSave(c);
}

export async function debugUnlockBoss(chapterId) {
  const c = readActiveCampaign();
  if (!c) throw new Error('No active campaign');
  c.chapters = migrateChaptersState(c);
  const ch = c.chapters[chapterId] || createDefaultChapterState(chapterId !== 'ch1');
  c.chapters = {
    ...c.chapters,
    [chapterId]: { ...ch, bossUnlocked: true, chapterProgressPercent: 100, successfulMissionCount: 10 },
  };
  writeActiveCampaign(c);
  return makeSave(c);
}

export async function debugMarkBossDefeated(chapterId) {
  const c = readActiveCampaign();
  if (!c) throw new Error('No active campaign');
  c.chapters = migrateChaptersState(c);
  c.chapters = applyChapterProgressForChapter(c.chapters, chapterId, true);
  c.chapters = unlockNextChapter(c.chapters, chapterId);
  writeActiveCampaign(c);
  return makeSave(c);
}

// Debug: directly set a chapter's bossDefeated flag without running the full
// mission-commit pipeline. Used by the Harvester debug panel to simulate
// first-clear (bossDefeated=false) vs replay (bossDefeated=true) before
// forcing a defeat. Preserves bossUnlocked + 100% progress.
export async function debugSetBossDefeatedFlag(chapterId, defeated) {
  const c = readActiveCampaign();
  if (!c) throw new Error('No active campaign');
  c.chapters = migrateChaptersState(c);
  const ch = c.chapters[chapterId] || createDefaultChapterState(chapterId !== 'ch1');
  c.chapters = {
    ...c.chapters,
    [chapterId]: { ...ch, bossDefeated: !!defeated, bossUnlocked: true, chapterProgressPercent: 100, successfulMissionCount: 10 },
  };
  writeActiveCampaign(c);
  return makeSave(c);
}

// Debug: reset a chapter's progress while preserving its unlock state.
// Used by the Chapter 3 debug controls to test progression from scratch.
export async function debugResetChapter(chapterId) {
  const c = readActiveCampaign();
  if (!c) throw new Error('No active campaign');
  c.chapters = migrateChaptersState(c);
  const existing = c.chapters[chapterId] || createDefaultChapterState(chapterId !== 'ch1');
  c.chapters = {
    ...c.chapters,
    [chapterId]: {
      ...existing,
      chapterProgressPercent: 0,
      successfulMissionCount: 0,
      bossUnlocked: false,
      bossDefeated: false,
      bossNewlyUnlocked: false,
      completed: false,
    },
  };
  writeActiveCampaign(c);
  return makeSave(c);
}

// Clear the NEW badge on a chapter (called when the player opens it).
export async function clearChapterNewlyUnlocked(chapterId) {
  const c = readActiveCampaign();
  if (!c) throw new Error('No active campaign');
  c.chapters = clearNewlyUnlocked(migrateChaptersState(c), chapterId);
  writeActiveCampaign(c);
  return makeSave(c);
}

// Clear the boss-unlocked notification flag on a chapter.
export async function clearChapterBossNotification(chapterId) {
  const c = readActiveCampaign();
  if (!c) throw new Error('No active campaign');
  c.chapters = clearBossNewlyUnlocked(migrateChaptersState(c), chapterId);
  writeActiveCampaign(c);
  return makeSave(c);
}

// --- Legacy ch1-only debug wrappers (backward compat) ---

export async function setChapterProgress(percent) {
  return debugSetChapterProgress('ch1', percent);
}

export async function addChapterProgress(amount) {
  return debugAddChapterProgress('ch1', amount);
}

export async function resetChapter() {
  const c = readActiveCampaign();
  if (!c) throw new Error('No active campaign');
  c.chapters = migrateChaptersState(c);
  c.chapters = { ...c.chapters, ch1: createDefaultChapterState(true) };
  writeActiveCampaign(c);
  return makeSave(c);
}

export async function unlockBoss() {
  return debugUnlockBoss('ch1');
}

export async function markBossDefeated() {
  return debugMarkBossDefeated('ch1');
}

// --- Comprehensive Debug Suite Helpers ---

export async function debugClearAllInventory() {
  const c = readActiveCampaign();
  if (!c) throw new Error('No active campaign');
  c.inventory = {};
  writeActiveCampaign(c);
  return makeSave(c);
}

export async function debugSetAllResources({ credits, alienMaterials, powerCores, nanoCubes } = {}) {
  const c = readActiveCampaign();
  if (!c) throw new Error('No active campaign');
  if (credits != null) c.credits = Math.max(0, Math.round(credits));
  if (alienMaterials != null) c.alien_materials = Math.max(0, Math.round(alienMaterials));
  if (powerCores != null) c.powerCores = Math.max(0, Math.round(powerCores));
  if (nanoCubes != null) c.nanoCubes = Math.max(0, Math.round(nanoCubes));
  writeActiveCampaign(c);
  return makeSave(c);
}

export async function debugLevelAllSoldiers(level) {
  const c = readActiveCampaign();
  if (!c) throw new Error('No active campaign');
  const lvl = Math.max(1, Math.min(MAX_LEVEL, level));
  const maxHp = 8 + HP_AWARD_LEVELS.filter((l) => l <= lvl).length;
  c.soldiers = (c.soldiers || []).map((s) => ({
    ...s,
    level: lvl,
    max_hp: maxHp,
    current_hp: s.injured ? 0 : maxHp,
    available_skill_selections: Math.max(0, totalSkillPointsByLevel(lvl) - countSelectedSkills(s)),
  }));
  writeActiveCampaign(c);
  return (c.soldiers || []).map((s) => ({ ...s, id: s.soldier_id }));
}

export async function debugHealAllSoldiers() {
  const c = readActiveCampaign();
  if (!c) throw new Error('No active campaign');
  c.soldiers = (c.soldiers || []).map((s) => ({
    ...s,
    injured: false,
    current_hp: s.max_hp,
  }));
  writeActiveCampaign(c);
  return (c.soldiers || []).map((s) => ({ ...s, id: s.soldier_id }));
}

export async function debugInjureAllSoldiers() {
  const c = readActiveCampaign();
  if (!c) throw new Error('No active campaign');
  c.soldiers = (c.soldiers || []).map((s) => ({
    ...s,
    injured: true,
    current_hp: 0,
  }));
  writeActiveCampaign(c);
  return (c.soldiers || []).map((s) => ({ ...s, id: s.soldier_id }));
}

export async function debugRespecSoldier(soldierId) {
  const c = readActiveCampaign();
  if (!c) throw new Error('No active campaign');
  const soldier = (c.soldiers || []).find((s) => s.soldier_id === soldierId);
  if (!soldier) throw new Error('Soldier not found');
  const updated = {
    ...soldier,
    upgrades: [],
    available_skill_selections: totalSkillPointsByLevel(soldier.level || 1),
  };
  c.soldiers = c.soldiers.map((s) => (s.soldier_id === soldierId ? updated : s));
  writeActiveCampaign(c);
  return { ...updated, id: updated.soldier_id };
}

export async function debugChangeSoldierClass(soldierId, newClass) {
  const c = readActiveCampaign();
  if (!c) throw new Error('No active campaign');
  const soldier = (c.soldiers || []).find((s) => s.soldier_id === soldierId);
  if (!soldier) throw new Error('Soldier not found');
  const updated = {
    ...soldier,
    class: newClass,
    archetype: newClass,
    upgrades: [],
    available_skill_selections: totalSkillPointsByLevel(soldier.level || 1),
  };
  c.soldiers = c.soldiers.map((s) => (s.soldier_id === soldierId ? updated : s));
  writeActiveCampaign(c);
  return { ...updated, id: updated.soldier_id };
}

export async function debugDismissSoldier(soldierId) {
  const c = readActiveCampaign();
  if (!c) throw new Error('No active campaign');
  if ((c.soldiers || []).length <= 1) throw new Error('Cannot dismiss the last soldier');
  c.soldiers = (c.soldiers || []).filter((s) => s.soldier_id !== soldierId);
  writeActiveCampaign(c);
  return (c.soldiers || []).map((s) => ({ ...s, id: s.soldier_id }));
}

export async function debugUnlockAllCommanderSkills() {
  const c = readActiveCampaign();
  if (!c) throw new Error('No active campaign');
  c.commander = {
    ...getCommanderState(c),
    unlocked: true,
    unlockedSkillIds: [
      'player_tactical_advance',
      'player_precision_strike',
      'player_rally',
      'player_overdrive',
      'player_supply_drop',
      'player_smoke_screen',
    ],
  };
  writeActiveCampaign(c);
  return makeSave(c);
}

export async function debugUnlockAllChaptersAndBosses() {
  const c = readActiveCampaign();
  if (!c) throw new Error('No active campaign');
  c.chapters = migrateChaptersState(c);
  for (const chId of ['ch1', 'ch2', 'ch3']) {
    c.chapters[chId] = {
      ...c.chapters[chId],
      unlocked: true,
      chapterProgressPercent: 100,
      successfulMissionCount: 10,
      bossUnlocked: true,
      bossDefeated: false,
    };
  }
  writeActiveCampaign(c);
  return makeSave(c);
}

export async function debugResetAllCampaignProgress() {
  const c = readActiveCampaign();
  if (!c) throw new Error('No active campaign');
  c.chapters = createDefaultChaptersState();
  c.missionProgress = { completedMissions: [] };
  writeActiveCampaign(c);
  return makeSave(c);
}

export async function debugUnlockAllSquadUpgrades() {
  const c = readActiveCampaign();
  if (!c) throw new Error('No active campaign');
  c.squad_upgrades = {};
  for (const up of Object.values(SQUAD_UPGRADES)) {
    c.squad_upgrades[up.id] = true;
  }
  writeActiveCampaign(c);
  return makeSave(c);
}

function makeSave(c) {
  return {
    id: 'active',
    credits: c.credits || 0,
    alien_materials: c.alien_materials || 0,
    powerCores: c.powerCores || 0,
    nanoCubes: c.nanoCubes || 0,
    inventory: c.inventory || {},
    squad_upgrades: c.squad_upgrades || {},
    commander: getCommanderState(c),
    chapter: c.chapter || createDefaultChapter(),
    chapters: migrateChaptersState(c),
  };
}