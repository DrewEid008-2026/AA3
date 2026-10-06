import React from 'react';
import { ChevronRight } from 'lucide-react';
import { getEnemyCommanderDisplayProfile } from '@/game/enemyCommanders';

// Compact tappable tile showing a hostile commander operating in the current
// chapter. Renders below the ChapterProgressBar on the Mission Select screen.
// Tapping opens the full bio panel (handled by the parent).
export default function CommanderTile({ profile, onTap }) {
  if (!profile) return null;
  const display = getEnemyCommanderDisplayProfile(profile);
  const portraitColor = display.presentationData?.portraitColor || '#dc2626';
  const glyph = display.presentationData?.portraitGlyph || 'crosshair';

  return (
    <button
      type="button"
      onClick={onTap}
      className="w-full rounded-lg border border-rose-700/50 bg-rose-950/20 p-3 active:scale-[0.98] transition-transform touch-manipulation text-left"
    >
      <div className="flex items-center gap-3">
        <div
          className="flex items-center justify-center w-10 h-10 rounded-md border border-rose-500/50 shrink-0"
          style={{ backgroundColor: `${portraitColor}22` }}
        >
          <span className="text-lg leading-none" style={{ color: portraitColor }}>
            {glyph === 'crosshair' ? '🎯' : glyph === 'skull' ? '☠' : glyph === 'bug' ? '🐛' : '⚔'}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold tracking-wider uppercase text-rose-400">Hostile Commander</span>
          </div>
          <div className="text-white font-black text-sm tracking-wide leading-tight">{display.displayName}</div>
          <div className="text-rose-300 font-bold text-[11px] tracking-wide">{display.title}</div>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
      </div>
    </button>
  );
}