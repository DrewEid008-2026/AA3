// Compact enemy Commander button for the TopHud second row. Sits beside the
// player Commander (Cmd) button so both commander icons are side-by-side in the
// header. Rose-themed to distinguish from the violet player Cmd button.
// Shows a portrait glyph, truncated name, and Command Budget pips. Tapping
// opens the EnemyCommanderPanel modal. Hidden entirely when no enemy
// Commander is assigned to the mission.

import React from 'react';

export default function EnemyCommanderHudButton({ displayProfile, budgetCurrent, budgetMax, onTap }) {
  if (!displayProfile) return null;
  const portraitColor = displayProfile.presentationData?.portraitColor || '#dc2626';
  const glyph = displayProfile.presentationData?.portraitGlyph || 'skull';
  const exhausted = budgetCurrent <= 0;
  const max = Math.max(1, budgetMax || 1);
  const current = Math.max(0, Math.min(max, budgetCurrent || 0));

  const pips = Array.from({ length: max }, (_, i) => i < current);

  return (
    <button
      type="button"
      onClick={onTap}
      aria-label="Enemy Commander info"
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border bg-rose-950/60 border-rose-600/60 text-rose-200 active:bg-rose-900/60 touch-manipulation transition-colors shrink-0"
    >
      {/* Portrait glyph */}
      <span
        className="flex items-center justify-center w-5 h-5 rounded-sm border border-rose-500/40 shrink-0"
        style={{ backgroundColor: `${portraitColor}22` }}
      >
        <span className="text-xs leading-none" style={{ color: portraitColor }}>
          {glyph === 'bug' ? '🐛' : glyph === 'skull' ? '☠' : '⚔'}
        </span>
      </span>
      {/* Name + budget pips */}
      <span className="flex flex-col items-start leading-tight min-w-0">
        <span className="text-[9px] font-bold tracking-wider uppercase text-rose-300 max-w-[64px] truncate">
          {displayProfile.displayName}
        </span>
        <span className="flex items-center gap-0.5 mt-0.5">
          {pips.map((filled, i) => (
            <span
              key={i}
              className={`w-1.5 h-1.5 rounded-full ${filled ? 'bg-rose-400' : 'bg-rose-900/70 border border-rose-800/60'}`}
            />
          ))}
          {exhausted && (
            <span className="text-[8px] font-bold tracking-wider uppercase text-rose-600 ml-1">EXH</span>
          )}
        </span>
      </span>
    </button>
  );
}