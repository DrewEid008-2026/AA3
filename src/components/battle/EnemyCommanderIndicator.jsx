// Compact enemy Commander presence indicator. Rendered in the upper battlefield
// area when a hostile Commander is assigned to the mission. Shows the commander
// identity (or hidden entity), current/max Command Budget, and opens the info
// panel on tap. Stays visible even when the budget is exhausted (the commander
// is still present). Shows AVAILABLE / EXHAUSTED states. Portrait-mobile friendly.

import React from 'react';
import { ChevronDown } from 'lucide-react';

export default function EnemyCommanderIndicator({ displayProfile, budgetCurrent, budgetMax, commandsUsed, maxPerPhase, onTap }) {
  if (!displayProfile) return null;
  const exhausted = budgetCurrent <= 0;
  const commanding = (commandsUsed || 0) > 0 && (commandsUsed || 0) < (maxPerPhase || 1);
  const portraitColor = displayProfile.presentationData?.portraitColor || '#dc2626';
  const glyph = displayProfile.presentationData?.portraitGlyph || 'skull';

  return (
    <button
      onClick={onTap}
      className="absolute top-2 right-2 z-20 flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-slate-950/90 border border-rose-600/60 shadow-lg shadow-rose-900/30 active:scale-[0.98] transition-transform"
    >
      {/* Portrait glyph */}
      <div
        className="flex items-center justify-center w-7 h-7 rounded-sm border border-rose-500/40 shrink-0"
        style={{ backgroundColor: `${portraitColor}22` }}
      >
        <span className="text-base leading-none" style={{ color: portraitColor }}>
          {glyph === 'bug' ? '🐛' : glyph === 'skull' ? '☠' : '⚔'}
        </span>
      </div>
      <div className="flex flex-col items-start leading-tight">
        <div className="text-[8px] font-bold tracking-[0.15em] text-rose-400 uppercase">Enemy Commander</div>
        <div className="text-[10px] font-bold text-white truncate max-w-[120px]">
          {displayProfile.displayName}
        </div>
        <div className={`text-[9px] font-mono font-bold tracking-wide ${exhausted ? 'text-rose-500' : commanding ? 'text-violet-300' : 'text-amber-300'}`}>
          {exhausted
            ? `COMMAND 0 / ${budgetMax} — EXHAUSTED`
            : commanding
              ? `COMMAND: ${budgetCurrent} / ${budgetMax} — COMMANDING`
              : `COMMAND: ${budgetCurrent} / ${budgetMax}`}
        </div>
      </div>
      <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
    </button>
  );
}