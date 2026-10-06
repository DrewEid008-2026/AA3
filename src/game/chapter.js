// Chapter progression: multi-chapter state model + progression rules.
//
// State shape (campaign.chapters):
//   { ch1: { unlocked, newlyUnlocked, chapterProgressPercent,
//            successfulMissionCount, bossUnlocked, bossDefeated,
//            bossNewlyUnlocked, completed },
//     ch2: { ... },
//     ch3: { ... } }
//
// The static chapter definitions (title, boss, mission pool) live in
// chapters.js. This file owns the dynamic per-save state.
//
// Progression rules:
//   - Each successful standard mission adds +10% to the chapter it was
//     launched from (tracked via missionConfig.chapterId).
//   - At 100% (10 missions), the chapter boss unlocks.
//   - Boss defeat sets bossDefeated and unlocks the next chapter.
//   - Progress caps at 100%; further missions award resources/XP but no more
//     chapter progress.
//   - Boss failure does not reset progress; the boss stays unlocked.

import { getChapterDef } from './chapters';

export const CHAPTERS = {
  ch1: { id: 'ch1', number: 1, name: 'Chapter 1', bossMissionId: 'chapter1_boss', missionsRequired: 10 },
};

export const CHAPTER_PROGRESS_PER_MISSION = 10; // percent
export const CHAPTER_PROGRESS_CAP = 100; // percent

// --- Legacy single-chapter shape (backward compat for old code paths) ---

export function createDefaultChapter() {
  return {
    chapterId: 'ch1',
    chapterNumber: 1,
    chapterProgressPercent: 0,
    successfulMissionsThisChapter: 0,
    bossUnlocked: false,
    bossDefeated: false,
  };
}

export function getChapterConfig(chapterId) {
  return CHAPTERS[chapterId] || CHAPTERS.ch1;
}

// --- Multi-chapter state ---

// Per-chapter progress state. `unlocked` defaults to false; Chapter 1 is
// always unlocked (passed true at creation). `completed` is reserved for
// future use — a chapter is only "complete" when its boss is defeated (which
// also sets bossDefeated). Standard missions never set completed.
export function createDefaultChapterState(unlocked = false) {
  return {
    unlocked,
    newlyUnlocked: false,
    chapterProgressPercent: 0,
    successfulMissionCount: 0,
    bossUnlocked: false,
    bossDefeated: false,
    bossNewlyUnlocked: false,
    completed: false,
  };
}

export function createDefaultChaptersState() {
  return {
    ch1: createDefaultChapterState(true), // Chapter 1 always unlocked
    ch2: createDefaultChapterState(false),
    ch3: createDefaultChapterState(false),
  };
}

// Migrate saves to the multi-chapter model. Always ensures every chapter def
// has corresponding state, adding missing chapters with appropriate unlock
// state. Preserves all existing progress. If the previous chapter's boss was
// already defeated, the next chapter is unlocked and marked newlyUnlocked so
// the player is notified on next visit. Idempotent: existing chapter state is
// preserved (new fields like `completed` default in from createDefault).
export function migrateChaptersState(campaign) {
  const existing = campaign.chapters || {};
  const chapters = {};

  // ch1: from legacy single-chapter shape or existing state
  if (existing.ch1) {
    chapters.ch1 = { ...createDefaultChapterState(true), ...existing.ch1 };
  } else {
    const old = campaign.chapter || createDefaultChapter();
    chapters.ch1 = {
      unlocked: true,
      newlyUnlocked: false,
      chapterProgressPercent: old.chapterProgressPercent || 0,
      successfulMissionCount: old.successfulMissionsThisChapter || 0,
      bossUnlocked: old.bossUnlocked || false,
      bossDefeated: old.bossDefeated || false,
      bossNewlyUnlocked: false,
      completed: false,
    };
  }

  // ch2: from existing or new. Unlock if ch1 boss defeated.
  if (existing.ch2) {
    chapters.ch2 = { ...createDefaultChapterState(false), ...existing.ch2 };
  } else {
    chapters.ch2 = createDefaultChapterState(false);
    if (chapters.ch1.bossDefeated) {
      chapters.ch2.unlocked = true;
      chapters.ch2.newlyUnlocked = true;
    }
  }

  // ch3: from existing or new (v10 migration). Unlock if ch2 boss defeated.
  if (existing.ch3) {
    chapters.ch3 = { ...createDefaultChapterState(false), ...existing.ch3 };
  } else {
    chapters.ch3 = createDefaultChapterState(false);
    if (chapters.ch2?.bossDefeated) {
      chapters.ch3.unlocked = true;
      chapters.ch3.newlyUnlocked = true;
    }
  }

  return chapters;
}

export function getChapterState(chapters, chapterId) {
  if (!chapters) return null;
  return chapters[chapterId] || null;
}

// Apply progression for a completed mission to the specified chapter.
// Standard missions: +10% (capped, unlocks boss at 100%). Boss missions: set
// bossDefeated. Returns the updated chapters object (immutable).
export function applyChapterProgressForChapter(chapters, chapterId, isBoss = false) {
  const next = { ...chapters };
  const ch = { ...(next[chapterId] || createDefaultChapterState(chapterId !== 'ch1')) };
  if (isBoss) {
    ch.bossDefeated = true;
    ch.bossNewlyUnlocked = false;
  } else {
    if (ch.chapterProgressPercent < CHAPTER_PROGRESS_CAP) {
      ch.successfulMissionCount = (ch.successfulMissionCount || 0) + 1;
      ch.chapterProgressPercent = Math.min(
        CHAPTER_PROGRESS_CAP,
        ch.successfulMissionCount * CHAPTER_PROGRESS_PER_MISSION
      );
      if (ch.chapterProgressPercent >= CHAPTER_PROGRESS_CAP && !ch.bossUnlocked) {
        ch.bossUnlocked = true;
        ch.bossNewlyUnlocked = true;
      }
    }
  }
  next[chapterId] = ch;
  return next;
}

// After a boss defeat, unlock the next chapter (if any) and mark it
// newlyUnlocked so the player sees a NEW badge + notification.
export function unlockNextChapter(chapters, chapterId) {
  const def = getChapterDef(chapterId);
  if (!def || !def.nextChapterId) return chapters;
  const next = { ...chapters };
  const nextId = def.nextChapterId;
  const nextCh = { ...(next[nextId] || createDefaultChapterState(false)) };
  if (!nextCh.unlocked) {
    nextCh.unlocked = true;
    nextCh.newlyUnlocked = true;
  }
  next[nextId] = nextCh;
  return next;
}

export function clearNewlyUnlocked(chapters, chapterId) {
  if (!chapters || !chapters[chapterId] || !chapters[chapterId].newlyUnlocked) return chapters;
  return { ...chapters, [chapterId]: { ...chapters[chapterId], newlyUnlocked: false } };
}

export function clearBossNewlyUnlocked(chapters, chapterId) {
  if (!chapters || !chapters[chapterId] || !chapters[chapterId].bossNewlyUnlocked) return chapters;
  return { ...chapters, [chapterId]: { ...chapters[chapterId], bossNewlyUnlocked: false } };
}

// Legacy: apply progress to a single flat chapter object. Kept for backward
// compat with any code that still uses the old shape. Now finalizes boss
// defeat (sets bossDefeated = true) — required for Chapter 2 unlock.
export function applyChapterProgress(chapter, isBoss = false) {
  const ch = { ...chapter };
  if (isBoss) {
    ch.bossDefeated = true;
    return ch;
  }
  if (ch.chapterProgressPercent < CHAPTER_PROGRESS_CAP) {
    ch.successfulMissionsThisChapter = (ch.successfulMissionsThisChapter || 0) + 1;
    ch.chapterProgressPercent = Math.min(
      CHAPTER_PROGRESS_CAP,
      ch.successfulMissionsThisChapter * CHAPTER_PROGRESS_PER_MISSION
    );
    if (ch.chapterProgressPercent >= CHAPTER_PROGRESS_CAP) {
      ch.bossUnlocked = true;
    }
  }
  return ch;
}