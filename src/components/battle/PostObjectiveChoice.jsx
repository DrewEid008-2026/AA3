import React from 'react';
import { Flag, Swords } from 'lucide-react';

// Compact bottom panel presented when the primary objective is secured.
// The player chooses to leave with the guaranteed base reward or stay and
// fight the Elite Response for a bonus. Not a full-screen modal — the
// battlefield stays visible behind it.
export default function PostObjectiveChoice({ mission, onComplete, onChallenge }) {
  return (
    <div className="absolute inset-0 z-40 flex items-end justify-center bg-slate-950/50 backdrop-blur-[2px] pointer-events-auto">
      <div className="w-full max-w-md px-3 pb-3">
        <div className="rounded-xl border border-emerald-500/40 bg-slate-900/95 shadow-2xl p-3.5">
          <div className="text-center mb-3">
            <div className="text-emerald-400 font-black text-base tracking-wider uppercase">
              Objective Secured
            </div>
            <div className="text-slate-400 text-[11px] mt-0.5">
              Base reward earned. Push your luck for more?
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onComplete}
              className="flex flex-col items-center gap-1 py-3 rounded-lg border border-sky-500/60 bg-sky-600/20 active:scale-95 transition touch-manipulation"
            >
              <Flag className="w-5 h-5 text-sky-300" />
              <span className="text-sky-200 font-bold text-[11px] tracking-wide uppercase">Complete</span>
              <span className="text-slate-400 text-[9px]">{mission.baseReward.credits}c · {mission.baseReward.alienMaterials}AM</span>
            </button>
            <button
              type="button"
              onClick={onChallenge}
              className="flex flex-col items-center gap-1 py-3 rounded-lg border border-amber-500/60 bg-amber-600/20 active:scale-95 transition touch-manipulation"
            >
              <Swords className="w-5 h-5 text-amber-300" />
              <span className="text-amber-200 font-bold text-[11px] tracking-wide uppercase">Challenge Elite</span>
              <span className="text-slate-400 text-[9px]">+{mission.eliteBonus.credits}c · +{mission.eliteBonus.alienMaterials}AM</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}