// Grayed-out enemy Commander placeholder for the TopHud second row. Rendered
// in the same slot as EnemyCommanderHudButton when NO enemy Commander is
// assigned to the mission (all Chapter 1, Chapter 2, and boss missions).
// Same footprint as the active button but muted slate styling, a generic
// "no signal" glyph, and no name or budget pips. Non-interactive — purely
// communicates the absence of a hostile Commander.

import React from 'react';

export default function EnemyCommanderHudButtonAbsent() {
  return (
    <div
      aria-label="No enemy Commander"
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-700 bg-slate-800/80 text-slate-600 shrink-0 select-none"
    >
      {/* Dimmed glyph */}
      <span className="flex items-center justify-center w-5 h-5 rounded-sm border border-slate-600/50 shrink-0">
        <span className="text-xs leading-none opacity-50">☠</span>
      </span>
      {/* "No Commander" label */}
      <span className="flex flex-col items-start leading-tight min-w-0">
        <span className="text-[9px] font-bold tracking-wider uppercase text-slate-600">
          No Cmd
        </span>
        <span className="flex items-center gap-0.5 mt-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-700 border border-slate-600/40" />
          <span className="w-1.5 h-1.5 rounded-full bg-slate-700 border border-slate-600/40" />
        </span>
      </span>
    </div>
  );
}