// Reusable multi-chapter campaign definitions. Each Chapter is a data-driven
// config declaring its identity (title, subheading, flavor), mission
// parameters, boss, and unlock chain. Future chapters are added by appending
// to CHAPTER_DEFS — no UI or progression rewrite needed.
//
// Chapter STATE (progress, unlock, boss flags) lives in the save blob and is
// managed by chapter.js. This file holds only the static definitions.
import { MISSION_TYPES } from './constants';

export const CHAPTER_DEFS = [
  {
    chapterId: 'ch1',
    chapterNumber: 1,
    title: 'First Contact',
    subheading: 'Break the Command',
    flavorText:
      'Alien forces have established a command network in the region. Push through their operations, locate the source, and destroy the commander directing the invasion.',
    bossMissionId: 'chapter1_boss',
    bossName: 'Warden Prime',
    bossSubheading: 'Alien Command Nexus',
    bossImplemented: true,
    supportedMissionTypes: [
      MISSION_TYPES.ELIMINATION,
      MISSION_TYPES.EXTRACTION,
      MISSION_TYPES.RESCUE,
      MISSION_TYPES.SABOTAGE,
    ],
    supportedMapPool: null, // null = all maps
    enemyPool: null,        // null = all enemies
    missionsRequired: 10,
    nextChapterId: 'ch2',
  },
  {
    chapterId: 'ch2',
    chapterNumber: 2,
    title: 'Escalation',
    subheading: 'The Invasion Spreads',
    flavorText:
      'Warden Prime has fallen, but the alien presence is expanding. New signals are appearing beyond the Command Nexus, and resistance across the region is intensifying.',
    bossMissionId: 'chapter2_boss',
    bossName: 'The Harvester',
    bossSubheading: 'ALIEN SIEGE ENGINE',
    bossImplemented: true,
    nanoCubeReward: 1, // +1 Nano Cube per successful Boss victory (repeatable)
    supportedMissionTypes: [
      MISSION_TYPES.ELIMINATION,
      MISSION_TYPES.EXTRACTION,
      MISSION_TYPES.RESCUE,
      MISSION_TYPES.SABOTAGE,
    ],
    supportedMapPool: null,
    enemyPool: null,
    missionsRequired: 10,
    nextChapterId: 'ch3',
  },
  {
    chapterId: 'ch3',
    chapterNumber: 3,
    title: 'Adaptation',
    subheading: 'They Have Noticed Us',
    flavorText:
      'The destruction of the Harvester changed the invasion. Alien transmissions have shifted, specialized combat forms are appearing, and resistance operations are being met with disturbing precision. The enemy is no longer simply expanding. Something is beginning to to respond to us.',
    bossMissionId: 'chapter3_boss',
    bossName: 'Unknown Adaptive Entity',
    bossSubheading: 'Command source unidentified',
    bossImplemented: false,
    bossLockedStatus: 'NOT LOCATED',
    bossLocatedHeading: 'COMMAND SOURCE LOCATED',
    progressText: 'LOCATING ADAPTIVE COMMAND SOURCE',
    progressCompleteText: 'COMMAND SOURCE LOCATED',
    supportedMissionTypes: [
      MISSION_TYPES.ELIMINATION,
      MISSION_TYPES.EXTRACTION,
      MISSION_TYPES.RESCUE,
      MISSION_TYPES.SABOTAGE,
    ],
    supportedMapPool: null, // null = all maps (temporary: reuses existing pool)
    enemyPool: null,        // null = all enemies; Chapter 3 uses the weighted
                            // spawn framework in chapterEnemyPools.js which
                            // favors featured enemies (flash_claw, dislocator,
                            // executioner) once implemented.
    missionsRequired: 10,
    nextChapterId: null, // no Chapter 4 yet
  },
];

const DEFS_BY_ID = Object.fromEntries(CHAPTER_DEFS.map((c) => [c.chapterId, c]));

export function getChapterDef(chapterId) {
  return DEFS_BY_ID[chapterId] || null;
}

export function getAllChapterDefs() {
  return CHAPTER_DEFS;
}

// The chapter whose nextChapterId points to the given chapter — i.e. the
// prerequisite chapter. Used to show "Defeat X to unlock" on locked chapters.
export function getPrerequisiteChapterDef(chapterId) {
  return CHAPTER_DEFS.find((d) => d.nextChapterId === chapterId) || null;
}

// The highest-numbered unlocked chapter — used as the "active" chapter for
// save-slot metadata and default tab selection.
export function getActiveChapterDef(chapters) {
  let best = CHAPTER_DEFS[0];
  for (const def of CHAPTER_DEFS) {
    const st = chapters?.[def.chapterId];
    if (st && st.unlocked && def.chapterNumber >= best.chapterNumber) best = def;
  }
  return best;
}