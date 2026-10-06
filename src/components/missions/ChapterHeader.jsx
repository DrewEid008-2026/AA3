import React from 'react';
import { Radar } from 'lucide-react';

// Compact chapter identity header: number, title, subheading, and short
// flavor text. Kept brief so mission content stays easy to reach on portrait.
//
// Chapter 3 (ADAPTATION) gets a subtle pulsing Radar icon to reinforce the
// "watchful / the enemy is responding" tone without redesigning the UI.
export default function ChapterHeader({ def, state }) {
  if (!def) return null;
  const isComplete = state?.bossDefeated;
  const isCh3 = def.chapterId === 'ch3';

  return (
    <div className="px-1 pt-2 pb-1">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Chapter {def.chapterNumber}
        </span>
        {isCh3 && (
          <Radar className="w-3.5 h-3.5 text-fuchsia-400 animate-pulse shrink-0" />
        )}
        {isComplete && (
          <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400">
            ✓ Complete
          </span>
        )}
      </div>
      <div className="text-white font-black text-base tracking-wide uppercase leading-tight">
        {def.title}
      </div>
      <div className={`font-bold text-[11px] tracking-wider uppercase ${
        isCh3 ? 'text-fuchsia-400' : 'text-amber-400'
      }`}>
        {def.subheading}
      </div>
      <p className="text-slate-400 text-[11px] mt-1 leading-snug">
        {def.flavorText}
      </p>
    </div>
  );
}