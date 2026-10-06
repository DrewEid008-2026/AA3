import React from 'react';
import { Lock, CheckCircle2 } from 'lucide-react';
import { getAllChapterDefs } from '@/game/chapters';

// Horizontal scrollable chapter tab bar. Renders one tab per chapter
// definition (data-driven, supports future chapters). Each tab communicates
// its state: LOCKED, UNLOCKED, NEW, SELECTED, COMPLETE. Locked tabs are
// tappable but show a locked notice instead of selecting.
export default function ChapterTabBar({ chapters, selectedId, onSelect }) {
  const defs = getAllChapterDefs();

  return (
    <div className="shrink-0 border-b border-slate-800 bg-slate-900/40">
      <div className="flex gap-1.5 px-3 py-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {defs.map((def) => {
          const state = chapters?.[def.chapterId];
          const unlocked = state?.unlocked ?? def.chapterId === 'ch1';
          const isNew = state?.newlyUnlocked;
          const isComplete = state?.bossDefeated;
          const isSelected = selectedId === def.chapterId;

          return (
            <button
              key={def.chapterId}
              type="button"
              onClick={() => onSelect(def, unlocked)}
              className={`shrink-0 px-3 py-2.5 rounded-lg border text-xs font-bold tracking-wide uppercase transition touch-manipulation flex items-center gap-1.5 whitespace-nowrap ${
                isSelected
                  ? 'border-amber-500 bg-amber-950/40 text-amber-300'
                  : unlocked
                    ? 'border-slate-700 bg-slate-800/60 text-slate-300 active:scale-95'
                    : 'border-slate-800 bg-slate-900/40 text-slate-600'
              }`}
            >
              <span className="text-[9px] opacity-70">CH {def.chapterNumber}</span>
              <span>{def.title}</span>
              {isComplete && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
              {isNew && (
                <span className="text-[7px] font-black bg-emerald-500 text-white px-1 py-0.5 rounded animate-pulse leading-none">
                  NEW
                </span>
              )}
              {!unlocked && !isNew && <Lock className="w-3 h-3 text-slate-600" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}