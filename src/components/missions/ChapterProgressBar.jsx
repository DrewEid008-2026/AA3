import React from 'react';

// Compact chapter progress tile. Displays the chapter number, a progress bar,
// the percentage, and the mission count toward the boss unlock. Visually
// strong but compact enough for portrait mobile.
//
// Chapter 3 (ADAPTATION) gets a subtle scanning-line overlay on the progress
// bar to reinforce the "surveillance / the enemy is watching" motif. The
// progress text label (e.g. "LOCATING ADAPTIVE COMMAND SOURCE") appears below
// the bar when the chapter def provides one.
export default function ChapterProgressBar({ def, state }) {
  if (!def || !state) return null;
  const percent = state.chapterProgressPercent ?? 0;
  const completed = state.successfulMissionCount ?? 0;
  const required = def.missionsRequired || 10;
  const isComplete = state.bossDefeated;
  const isCh3 = def.chapterId === 'ch3';

  const progressText = percent >= 100
    ? (def.progressCompleteText || def.progressText)
    : def.progressText;

  return (
    <div className={`rounded-lg border p-3 ${
      isComplete
        ? 'border-amber-500/50 bg-amber-950/30'
        : isCh3
          ? 'border-fuchsia-700/50 bg-fuchsia-950/20'
          : 'border-slate-700 bg-slate-900/80'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Chapter {def.chapterNumber}
          </span>
          <span className="text-white font-black text-sm tracking-wide">
            {def.title}
          </span>
        </div>
        {isComplete ? (
          <span className="text-amber-400 font-bold text-[10px] tracking-wider uppercase">
            ✓ Complete
          </span>
        ) : state.bossUnlocked ? (
          <span className="text-fuchsia-400 font-bold text-[10px] tracking-wider uppercase">
            {isCh3 ? 'Located' : 'Boss Unlocked'}
          </span>
        ) : null}
      </div>

      {/* Progress bar */}
      <div className="relative h-3 rounded-full bg-slate-800 overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${
            isComplete
              ? 'bg-amber-500'
              : state.bossUnlocked
                ? 'bg-fuchsia-500'
                : isCh3
                  ? 'bg-fuchsia-600'
                  : 'bg-sky-500'
          }`}
          style={{ width: `${percent}%` }}
        />
        {/* Chapter 3 scanning-line motif (surveillance feel) */}
        {isCh3 && !isComplete && (
          <div className="absolute inset-0 overflow-hidden rounded-full pointer-events-none">
            <div className="absolute inset-y-0 w-1/4 bg-gradient-to-r from-transparent via-fuchsia-300/25 to-transparent animate-scan" />
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[10px] text-slate-400 font-mono">
          {completed} / {required} {isCh3 ? 'Operations' : 'Missions'}
        </span>
        <span className={`text-sm font-black ${
          isComplete ? 'text-amber-400' : state.bossUnlocked ? 'text-fuchsia-400' : isCh3 ? 'text-fuchsia-400' : 'text-sky-400'
        }`}>
          {percent}%
        </span>
      </div>

      {/* Chapter-specific progress text (Part 26) */}
      {progressText && (
        <div className={`text-[9px] mt-1.5 text-center tracking-wider uppercase ${
          percent >= 100 ? 'text-fuchsia-300' : 'text-slate-500'
        }`}>
          {progressText}
        </div>
      )}
    </div>
  );
}