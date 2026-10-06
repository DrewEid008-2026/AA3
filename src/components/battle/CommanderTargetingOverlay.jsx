import React from 'react';
import { Crown, X } from 'lucide-react';
import { getCommanderTargetingInstruction } from '@/game/commanderSkills';

// Banner shown during Commander targeting mode. Displays the active skill
// name, targeting instruction, and a CANCEL button. Positioned below the
// TopHud so it doesn't obscure the battlefield.
//
// Visual identity: violet/purple command insignia + dashed border pattern,
// distinct from normal movement/attack/ability targeting.
export default function CommanderTargetingOverlay({ skillId, onCancel }) {
  const instruction = getCommanderTargetingInstruction(skillId);

  return (
    <div className="absolute top-0 left-0 right-0 z-30 flex justify-center px-2 pt-1 pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-950/95 border-2 border-dashed border-violet-500/70 shadow-lg shadow-violet-900/30 max-w-full">
        <Crown className="w-4 h-4 text-violet-400 shrink-0" />
        <div className="min-w-0 flex flex-col">
          <span className="text-[9px] font-black tracking-wider uppercase text-violet-300 leading-none">
            Commander Targeting
          </span>
          <span className="text-[11px] text-white font-bold tracking-wide truncate leading-tight mt-0.5">
            {instruction}
          </span>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="ml-1 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-rose-500/60 bg-rose-600/80 text-white text-[10px] font-bold tracking-wide uppercase active:scale-95 touch-manipulation shrink-0"
        >
          <X className="w-3 h-3" />
          Cancel
        </button>
      </div>
    </div>
  );
}