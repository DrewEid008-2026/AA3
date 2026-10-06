import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Swords, Footprints, Heart, Bomb, ChevronRight, Lock } from 'lucide-react';
import { getMissionList, getBossMission } from '@/game/missions';
import { MISSION_TYPES } from '@/game/constants';
import { loadPlayerSave, clearChapterNewlyUnlocked, clearChapterBossNotification } from '@/game/persistence';
import { getAllChapterDefs, getChapterDef, getPrerequisiteChapterDef } from '@/game/chapters';
import { ensureMissionCommanderAssignment, getEnemyCommanderState, shouldShowCh3CommanderIntro, markCh3CommanderIntroShown } from '@/game/enemyCommanderAssignment';
import { getEnemyCommanderDisplayProfile, getEnemyCommanderProfile, getAllEnemyCommanderProfiles } from '@/game/enemyCommanders';
import ChapterProgressBar from '@/components/missions/ChapterProgressBar';
import CommanderTile from '@/components/missions/CommanderTile';
import Ch3CommanderIntroCard from '@/components/missions/Ch3CommanderIntroCard';
import EnemyCommanderPanel from '@/components/battle/EnemyCommanderPanel';
import BossCard from '@/components/missions/BossCard';
import ChapterTabBar from '@/components/missions/ChapterTabBar';
import ChapterHeader from '@/components/missions/ChapterHeader';
import ChapterNotification from '@/components/missions/ChapterNotification';

const TYPE_ICONS = {
  [MISSION_TYPES.ELIMINATION]: Swords,
  [MISSION_TYPES.EXTRACTION]: Footprints,
  [MISSION_TYPES.RESCUE]: Heart,
  [MISSION_TYPES.SABOTAGE]: Bomb,
};

const TYPE_ACCENTS = {
  [MISSION_TYPES.ELIMINATION]: { border: 'border-rose-500/50', glow: 'bg-rose-950/50', icon: 'text-rose-300', chip: 'bg-rose-500/20 text-rose-300' },
  [MISSION_TYPES.EXTRACTION]: { border: 'border-sky-500/50', glow: 'bg-sky-950/50', icon: 'text-sky-300', chip: 'bg-sky-500/20 text-sky-300' },
  [MISSION_TYPES.RESCUE]: { border: 'border-emerald-500/50', glow: 'bg-emerald-950/50', icon: 'text-emerald-300', chip: 'bg-emerald-500/20 text-emerald-300' },
  [MISSION_TYPES.SABOTAGE]: { border: 'border-orange-500/50', glow: 'bg-orange-950/50', icon: 'text-orange-300', chip: 'bg-orange-500/20 text-orange-300' },
};

const TYPE_LABELS = {
  [MISSION_TYPES.ELIMINATION]: 'Elimination',
  [MISSION_TYPES.EXTRACTION]: 'Extraction',
  [MISSION_TYPES.RESCUE]: 'Rescue',
  [MISSION_TYPES.SABOTAGE]: 'Sabotage',
};

export default function MissionSelect() {
  const [save, setSave] = useState(null);
  const [selectedChapterId, setSelectedChapterId] = useState('ch1');
  const [lockedNotice, setLockedNotice] = useState(null);
  const [chapterUnlockDef, setChapterUnlockDef] = useState(null);
  const [bossUnlockDef, setBossUnlockDef] = useState(null);
  const [showCh3Intro, setShowCh3Intro] = useState(false);
  const [bioProfile, setBioProfile] = useState(null);
  const clearTimer = useRef(null);

  const isDebug = typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('debug');

  const load = useCallback(async () => {
    const p = await loadPlayerSave();
    setSave(p);
    const chapters = p.chapters || {};

    // Ensure hostile Commander assignments for eligible Chapter 3 missions.
    // This evaluates the assignment rules (first encounter guarantee,
    // recurrence, anti-spam) and caches the result per mission instance.
    // Assignments persist until the mission instance ends (complete/abandon).
    const ecState = getEnemyCommanderState();
    const ch3Missions = getMissionList('ch3');
    for (const m of ch3Missions) {
      ensureMissionCommanderAssignment(m.id, m);
    }

    // Show chapter unlock notification if any chapter is newlyUnlocked.
    const newCh = getAllChapterDefs().find((d) => chapters[d.chapterId]?.newlyUnlocked);
    if (newCh) {
      setChapterUnlockDef(newCh);
      setSelectedChapterId(newCh.chapterId); // auto-highlight the new chapter
    } else {
      // Default to the highest unlocked chapter.
      let best = 'ch1';
      for (const d of getAllChapterDefs()) {
        if (chapters[d.chapterId]?.unlocked) best = d.chapterId;
      }
      setSelectedChapterId(best);
    }

    // Show boss unlock notification if any chapter's boss is newly unlocked.
    const bossCh = getAllChapterDefs().find((d) => chapters[d.chapterId]?.bossNewlyUnlocked);
    if (bossCh) setBossUnlockDef(bossCh);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Refresh when debug controls change data in the global DebugOverlay.
  useEffect(() => {
    const handler = () => load();
    window.addEventListener('debug-data-changed', handler);
    return () => window.removeEventListener('debug-data-changed', handler);
  }, [load]);

  // Show the Chapter 3 enemy commander intro title card on the first visit
  // (selected chapter is ch3, ch3 unlocked, intro flag not yet set).
  useEffect(() => {
    if (!save || selectedChapterId !== 'ch3') return;
    if (!save.chapters?.['ch3']?.unlocked) return;
    const ecState = getEnemyCommanderState();
    if (shouldShowCh3CommanderIntro(ecState)) {
      setShowCh3Intro(true);
    }
  }, [save, selectedChapterId]);

  const handleBeginCh3Intro = () => {
    setShowCh3Intro(false);
    markCh3CommanderIntroShown();
  };

  // Clear the NEW badge and boss notification for the selected chapter after
  // its content has rendered. Runs when the selected chapter changes or the
  // save refreshes. The persist call returns the updated save so the UI stays
  // in sync. Does not clear during unlock processing — only after the player
  // actually opens the chapter.
  useEffect(() => {
    if (!save?.chapters) return;
    const ch = save.chapters[selectedChapterId];
    if (!ch) return;
    let pending = null;
    if (ch.newlyUnlocked) {
      pending = clearChapterNewlyUnlocked(selectedChapterId);
    } else if (ch.bossNewlyUnlocked) {
      pending = clearChapterBossNotification(selectedChapterId);
    }
    if (pending) {
      if (clearTimer.current) clearTimeout(clearTimer.current);
      clearTimer.current = setTimeout(() => {
        pending.then(setSave).catch(() => {});
      }, 400);
    }
    return () => { if (clearTimer.current) clearTimeout(clearTimer.current); };
  }, [selectedChapterId, save]);

  const handleSelectTab = (def, unlocked) => {
    if (!unlocked) {
      // Locked chapter: show a brief locked notice, do not switch.
      setLockedNotice(def);
      setTimeout(() => setLockedNotice(null), 2500);
      return;
    }
    setSelectedChapterId(def.chapterId);
  };

  const handleDismissChapterUnlock = () => {
    setChapterUnlockDef(null);
  };

  const handleDismissBossUnlock = () => {
    setBossUnlockDef(null);
  };

  const chapters = save?.chapters || {};
  const selectedDef = getChapterDef(selectedChapterId);
  const selectedState = chapters[selectedChapterId] || null;
  const isChapterUnlocked = selectedState?.unlocked ?? selectedChapterId === 'ch1';
  const missions = isChapterUnlocked ? getMissionList(selectedChapterId) : [];
  const bossMission = isChapterUnlocked ? getBossMission(selectedChapterId) : null;
  const ch3Commanders = selectedChapterId === 'ch3'
    ? getAllEnemyCommanderProfiles().filter((p) => !p.isDev && p.allowedChapters?.includes('ch3'))
    : [];

  return (
    <div className="h-[100dvh] bg-slate-950 flex flex-col overflow-hidden">
      <div className="shrink-0 px-4 py-3 border-b border-slate-800">
        <h1 className="text-white font-black text-lg tracking-wider uppercase">Select Mission</h1>
        <p className="text-slate-500 text-[11px] mt-0.5">Choose an operation to deploy</p>
      </div>

      <ChapterTabBar
        chapters={chapters}
        selectedId={selectedChapterId}
        onSelect={handleSelectTab}
      />

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2.5 pb-4">
        {selectedDef && (
          <>
            <ChapterHeader def={selectedDef} state={selectedState} />

            {isChapterUnlocked ? (
              <>
                <ChapterProgressBar def={selectedDef} state={selectedState} />

                {/* Hostile commander tiles (Chapter 3 — full transparency) */}
                {selectedChapterId === 'ch3' && ch3Commanders.map((p) => (
                  <CommanderTile key={p.commanderId} profile={p} onTap={() => setBioProfile(p)} />
                ))}

                <BossCard def={selectedDef} state={selectedState} bossMission={bossMission} />

                {/* Standard missions */}
                {missions.map((m) => {
                  const Icon = TYPE_ICONS[m.type] || Swords;
                  const accent = TYPE_ACCENTS[m.type] || TYPE_ACCENTS[MISSION_TYPES.ELIMINATION];
                  // Hostile Commander assignment (transparent). Every Chapter 3
                  // mission is eligible. The assigned commander (or lack of one)
                  // is shown upfront — full transparency, no first-encounter mask.
                  const assignment = m.chapterId === 'ch3'
                    ? ensureMissionCommanderAssignment(m.id, m)
                    : null;
                  const activeCommanderId = assignment?.commanderId || null;
                  const activeCommanderProfile = activeCommanderId ? getEnemyCommanderProfile(activeCommanderId) : null;
                  const activeCommanderDisplay = activeCommanderProfile ? getEnemyCommanderDisplayProfile(activeCommanderProfile) : null;
                  return (
                    <Link key={m.id} to={`/deploy/${m.id}`} className="block">
                      <div className={`rounded-lg border ${accent.border} ${accent.glow} p-3 active:scale-[0.98] transition-transform`}>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-md bg-slate-900/80 flex items-center justify-center shrink-0">
                            <Icon className={`w-5 h-5 ${accent.icon}`} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-white font-bold text-sm tracking-wide">{m.title}</span>
                              <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${accent.chip}`}>
                                {TYPE_LABELS[m.type]}
                              </span>
                              {activeCommanderDisplay && (
                                <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-950/80 text-rose-400 border border-rose-700/50 flex items-center gap-1">
                                  <span className="text-rose-500">⚠</span> Hostile Commander
                                </span>
                              )}
                            </div>
                            <div className="text-slate-300 text-[11px] truncate mt-0.5">{m.objectiveText}</div>
                            {activeCommanderDisplay && (
                              <div className="text-[10px] text-rose-400 font-bold tracking-wide mt-0.5">
                                Active Commander: {activeCommanderDisplay.displayName}
                              </div>
                            )}
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
                        </div>
                        <div className="mt-2 flex items-center justify-between text-[10px]">
                          <div className="flex items-center gap-3 text-slate-400">
                            <span>Response: <span className="text-amber-300 font-semibold">{m.reinforcementRounds} rds</span></span>
                          </div>
                          <div className="flex items-center gap-3 text-slate-400">
                            <span>Reward: <span className="text-white font-semibold">{m.baseReward.credits}c</span></span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </>
            ) : (
              // Locked chapter content
              <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6 text-center">
                <Lock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <div className="text-slate-300 font-bold text-sm tracking-wide uppercase">
                  Chapter {selectedDef.chapterNumber} — Locked
                </div>
                <p className="text-slate-500 text-[11px] mt-1.5 leading-snug">
                  Defeat {getPrerequisiteChapterDef(selectedDef.chapterId)?.bossName || 'the previous Chapter Boss'} to unlock this chapter.
                </p>
              </div>
            )}
          </>
        )}

        {/* Debug inspector */}
        {isDebug && selectedDef && (
          <div className="rounded-lg border border-slate-700/50 bg-slate-900/60 p-3 text-[10px] font-mono text-slate-400 space-y-1">
            <div className="text-amber-400 font-bold uppercase tracking-wider text-[9px] mb-1">Debug — Chapter State</div>
            <div>selectedChapterId: {selectedChapterId}</div>
            {getAllChapterDefs().map((d) => {
              const st = chapters[d.chapterId] || {};
              return (
                <div key={d.chapterId} className="leading-tight">
                  {d.chapterId}: unlocked={String(st.unlocked)} new={String(st.newlyUnlocked)} {st.chapterProgressPercent ?? 0}% ({st.successfulMissionCount ?? 0}/10) bossU={String(st.bossUnlocked)} bossD={String(st.bossDefeated)} bossNew={String(st.bossNewlyUnlocked)}
                </div>
              );
            })}
            <div className="text-slate-500 mt-1">Mission chapterIds: {missions.map((m) => m.chapterId).join(', ') || 'none'}</div>
          </div>
        )}
      </div>

      <div className="h-[calc(4rem+env(safe-area-inset-bottom))]" />

      {/* Locked chapter notice (brief, non-blocking) */}
      {lockedNotice && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 px-4 py-3 rounded-lg bg-slate-900 border border-slate-700 shadow-xl text-center max-w-xs">
          <div className="text-slate-300 font-bold text-xs tracking-wide uppercase">
            Chapter {lockedNotice.chapterNumber} — Locked
          </div>
          <p className="text-slate-500 text-[10px] mt-1 leading-snug">
            Defeat {getPrerequisiteChapterDef(lockedNotice.chapterId)?.bossName || 'the previous Chapter Boss'} to unlock this chapter.
          </p>
        </div>
      )}

      {/* Chapter unlock notification */}
      {chapterUnlockDef && (
        <ChapterNotification type="chapter" def={chapterUnlockDef} onDismiss={handleDismissChapterUnlock} />
      )}

      {/* Boss unlock notification (shown after chapter unlock is dismissed) */}
      {bossUnlockDef && !chapterUnlockDef && (
        <ChapterNotification type="boss" def={bossUnlockDef} onDismiss={handleDismissBossUnlock} />
      )}

      {/* Chapter 3 enemy commander intro title card (first visit only) */}
      {showCh3Intro && (
        <Ch3CommanderIntroCard onBegin={handleBeginCh3Intro} />
      )}

      {/* Commander bio panel (from commander tile tap) */}
      {bioProfile && (
        <EnemyCommanderPanel
          displayProfile={getEnemyCommanderDisplayProfile(bioProfile)}
          budgetCurrent={bioProfile.commandBudget}
          budgetMax={bioProfile.commandBudget}
          onClose={() => setBioProfile(null)}
        />
      )}
    </div>
  );
}