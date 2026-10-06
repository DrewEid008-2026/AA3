// Mission result commit logic extracted from Battle.jsx. Computes soldier
// progression (XP, level-ups, skill awards), saves soldiers + player resources,
// and records campaign progress. Returns { results, updatedSoldiers }.
import { saveSoldiers, loadPlayerSave, savePlayerSave, recordMissionCompletion, setSquadSkillNotification } from './persistence';
import { processLevelUps, XP_REWARDS } from './progression';
import { grantsSkillSelection } from './skillTrees';
import { getEffectiveMaxHp } from './equipment';
import { totalReward } from './rewards';
import { TEAMS } from './constants';
import { ENEMY_ARCHETYPES } from './unitTypes';
import { getChapterDef } from './chapters';

export async function commitMissionResults({
  soldiers, units, missionRuntime, missionConfig, missionId,
}) {
  const rt = missionRuntime;
  if (!rt || !missionConfig) return null;
  const updated = [];
  const results = [];

  for (const soldier of soldiers) {
    const unit = units.find((u) => u.soldierId === soldier.id);
    if (!unit) continue; // not deployed

    const s = { ...soldier };
    let xpGained = 0;
    let injured = false;

    // HP / injury state — no permanent death. Bleed-out expired → INJURED.
    if (!unit.alive && unit.bleedOutExpired) {
      s.injured = true;
      s.current_hp = 0;
      s.alive = true;
      s.injuries_sustained = (soldier.injuries_sustained || 0) + 1;
      injured = true;
    } else if (!unit.alive) {
      s.injured = true;
      s.current_hp = 0;
      s.alive = true;
      injured = true;
    } else {
      s.injured = false;
      s.current_hp = getEffectiveMaxHp(s);
    }

    // Statistics
    s.missions_participated = (soldier.missions_participated || 0) + 1;
    s.missions_survived = (soldier.missions_survived || 0) + (injured ? 0 : 1);
    s.personal_kills = (soldier.personal_kills || 0) + (unit.missionKills || 0);
    s.elite_kills = (soldier.elite_kills || 0) + (unit.missionEliteKills || 0);
    s.times_downed = (soldier.times_downed || 0) + (unit.missionDowned ? 1 : 0);
    s.revives_performed = (soldier.revives_performed || 0) + (unit.missionRevives || 0);

    // Mission XP — injured soldiers retain earned XP
    if (rt.baseRewardSecured) { s.xp = (soldier.xp || 0) + XP_REWARDS.OBJECTIVE; xpGained += XP_REWARDS.OBJECTIVE; }
    if (rt.eliteRewardSecured) { s.xp = s.xp + XP_REWARDS.ELITE; xpGained += XP_REWARDS.ELITE; }

    // Kill-based XP (persistent kill_progress)
    s.kill_progress = (soldier.kill_progress || 0) + (unit.missionKills || 0);
    while (s.kill_progress >= XP_REWARDS.KILLS_PER_XP) {
      s.xp = (s.xp || 0) + 1;
      xpGained += 1;
      s.kill_progress -= XP_REWARDS.KILLS_PER_XP;
    }

    // Level-ups
    const oldLevel = soldier.level || 1;
    const lv = processLevelUps(s);
    s.level = lv.level;
    s.xp = lv.xp;
    s.max_hp = lv.max_hp;
    s.current_hp = injured ? 0 : lv.current_hp;

    // Award skill selections for each skill-awarding level crossed.
    let skillAwards = 0;
    for (let lvl = oldLevel + 1; lvl <= lv.level; lvl++) {
      if (grantsSkillSelection(lvl)) skillAwards++;
    }
    s.available_skill_selections = (soldier.available_skill_selections || 0) + skillAwards;

    results.push({
      name: soldier.name, class: soldier.class, level: s.level,
      oldLevel, xp: s.xp, xpGained, leveledUp: lv.leveledUp, injured,
      skillAwarded: skillAwards, hpAwarded: lv.hpAwards,
      unspentSelections: s.available_skill_selections,
    });
    updated.push(s);
  }

  // Squad level-up pip: set the notification flag if any soldier earned a
  // skill selection this mission. Cleared when the player taps the Squad tab.
  if (results.some((r) => r.skillAwarded > 0)) {
    setSquadSkillNotification(true);
  }

  // Save soldiers
  await saveSoldiers(updated);

  // Count rewards from defeated enemies: Alien Materials (salvage) and Power
  // Cores. Each dead enemy contributes its configured reward exactly once —
  // this loop runs during the single mission-result commit (guarded by
  // missionCommittedRef in Battle.jsx), so no duplication is possible from
  // restart, reload, or replayed death animations. Elite and non-elite kills
  // are tracked separately for the result display.
  let powerCoresEarned = 0;
  let baseAlienMaterials = 0;
  let eliteAlienMaterials = 0;
  let enemiesDefeated = 0;
  let eliteEnemiesDefeated = 0;
  for (const unit of units) {
    // Skip retreated enemies (surviving allies of a defeated boss). These
    // were deactivated on boss defeat and do NOT award Alien Materials or XP.
    if (unit.team === TEAMS.ENEMY && !unit.alive && unit.archetype && !unit.retreated) {
      const archetype = ENEMY_ARCHETYPES[unit.archetype];
      if (unit.elite) {
        eliteEnemiesDefeated++;
        if (archetype?.alienMaterialReward) eliteAlienMaterials += archetype.alienMaterialReward;
      } else {
        enemiesDefeated++;
        if (archetype?.alienMaterialReward) baseAlienMaterials += archetype.alienMaterialReward;
      }
      if (archetype?.powerCoreReward) {
        powerCoresEarned += archetype.powerCoreReward;
      }
    }
  }
  const alienMaterialsEarned = baseAlienMaterials + eliteAlienMaterials;

  // Save player resources. Credits come from the fixed mission reward. Alien
  // Materials come from enemy defeats (salvage) — only committed if the base
  // objective was secured. A failed mission discards all pending salvage
  // (the squad did not extract/secure the battlefield).
  const total = totalReward(
    rt.baseRewardSecured ? missionConfig.baseReward : null,
    rt.eliteRewardSecured ? missionConfig.eliteBonus : null
  );
  const salvageToCommit = rt.baseRewardSecured ? alienMaterialsEarned : 0;

  // --- The Harvester (Chapter 2 Boss): Nano Cube reward ---
  // On a successful Harvester victory, award +1 Nano Cube (from the chapter
  // def's nanoCubeReward). Repeatable — no cap, no diminishing returns. First
  // clear is detected by reading the save's ch2.bossDefeated flag BEFORE
  // committing. Uses the same single-commit pass as credits/materials/cores
  // (guarded once per attempt by missionCommittedRef in Battle.jsx).
  let nanoCubesEarned = 0;
  let nanoCubeTotalBefore = 0;
  let nanoCubeTotalAfter = 0;
  let isFirstClear = false;
  const isHarvesterVictory = rt.baseRewardSecured
    && missionConfig.isBoss
    && missionConfig.bossMapId === 'harvester_pit_ch2';

  try {
    const save = await loadPlayerSave();
    nanoCubeTotalBefore = save.nanoCubes || 0;
    if (isHarvesterVictory) {
      const chDef = getChapterDef(missionConfig.chapterId || 'ch2');
      const reward = chDef?.nanoCubeReward || 0;
      if (reward > 0) {
        isFirstClear = !(save.chapters?.ch2?.bossDefeated);
        nanoCubesEarned = reward;
      }
    }
    nanoCubeTotalAfter = nanoCubeTotalBefore + nanoCubesEarned;
    await savePlayerSave({
      ...save,
      credits: (save.credits || 0) + total.credits,
      alien_materials: (save.alien_materials || 0) + salvageToCommit,
      powerCores: (save.powerCores || 0) + powerCoresEarned,
      nanoCubes: (save.nanoCubes || 0) + nanoCubesEarned,
    });
  } catch (e) { /* resource save is best-effort */ }

  // Record mission completion in the active save's campaign progress + stats.
  // Chapter progression (+10% for standard missions, bossDefeated for boss
  // missions) is applied inside recordMissionCompletion. This runs once per
  // mission attempt, so chapter progress is never applied twice.
  if (rt.baseRewardSecured) {
    const totalMissionKills = units.reduce((sum, u) => sum + (u.missionKills || 0), 0);
    const totalEliteKills = units.reduce((sum, u) => sum + (u.missionEliteKills || 0), 0);
    try {
      await recordMissionCompletion(missionId, {
        totalKills: totalMissionKills,
        totalEliteKills: totalEliteKills,
        creditsEarned: total.credits,
        alienMaterialsEarned: salvageToCommit,
        powerCoresEarned,
        isBoss: !!missionConfig.isBoss,
        chapterId: missionConfig.chapterId || 'ch1',
      });
    } catch (e) { /* campaign-stats save is best-effort */ }
  }

  return {
    results,
    updatedSoldiers: updated,
    powerCoresEarned,
    alienMaterialsEarned: salvageToCommit,
    baseAlienMaterials,
    eliteAlienMaterials,
    enemiesDefeated,
    eliteEnemiesDefeated,
    nanoCubesEarned,
    nanoCubeTotalBefore,
    nanoCubeTotalAfter,
    isFirstClear,
    hostileCommanderId: missionConfig?.hostileCommanderId || null,
  };
}