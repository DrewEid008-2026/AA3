import React from 'react';

// Bright, brief notification overlay for chapter and boss unlocks. Dismissed
// by tapping anywhere or the Continue button. Does not permanently obstruct
// the interface — auto-dismisses after 6 seconds if ignored.
export default function ChapterNotification({ type, def, onDismiss }) {
  if (!def) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6"
      onClick={onDismiss}
    >
      <div
        className="max-w-sm w-full rounded-xl border bg-slate-900 p-5 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {type === 'chapter' ? (
          <>
            <div className="text-emerald-400 font-black text-sm tracking-widest uppercase animate-pulse">
              New Chapter Unlocked!
            </div>
            <div className="text-white font-black text-lg tracking-wide uppercase mt-2">
              Chapter {def.chapterNumber} — {def.title}
            </div>
            <div className="text-amber-300 font-bold text-xs tracking-wider uppercase mt-1">
              {def.subheading}
            </div>
            <p className="text-slate-300 text-[11px] mt-2 leading-snug">
              {def.flavorText}
            </p>
          </>
        ) : (
          <>
            <div className="text-fuchsia-400 font-black text-sm tracking-widest uppercase animate-pulse">
              Boss Located!
            </div>
            <div className="text-white font-black text-lg tracking-wide uppercase mt-2">
              {def.bossName}
            </div>
            <div className="text-fuchsia-300 font-bold text-xs mt-1">
              {def.bossSubheading}
            </div>
            <p className="text-slate-300 text-[11px] mt-2 leading-snug">
              {def.bossImplemented
                ? 'A powerful alien command signal has been identified.'
                : 'A powerful alien command signal has been identified. Encounter awaiting implementation.'}
            </p>
          </>
        )}
        <button
          type="button"
          onClick={onDismiss}
          className="mt-4 px-5 py-2 rounded-lg bg-amber-600 text-white text-xs font-bold tracking-widest uppercase active:scale-95 transition touch-manipulation"
        >
          Continue
        </button>
      </div>
    </div>
  );
}