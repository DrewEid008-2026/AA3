import React from 'react';
import { AlertTriangle, ChevronRight, ArrowLeft } from 'lucide-react';

// Pre-deployment boss warning. Shown when the player taps ENGAGE on the Boss
// card, before the deployment screen. A concise reminder that the Boss is a
// major encounter and the player may return to standard missions instead.
export default function BossWarning({ missionTitle, onContinue, onBack }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 px-4">
      <div className="w-full max-w-sm rounded-xl border border-fuchsia-700/50 bg-slate-900 p-5 shadow-2xl">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-5 h-5 text-fuchsia-400" />
          <h2 className="text-white font-black text-base tracking-wider uppercase">
            Chapter Boss
          </h2>
        </div>

        <p className="text-slate-300 text-sm leading-relaxed mb-1">
          This is a major enemy encounter.
        </p>
        <p className="text-slate-400 text-xs leading-relaxed mb-4">
          You may return to standard missions and continue strengthening your squad if needed.
        </p>

        {missionTitle && (
          <div className="rounded-lg bg-fuchsia-950/30 border border-fuchsia-800/50 px-3 py-2 mb-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-fuchsia-400/70">
              Mission
            </div>
            <div className="text-white font-bold text-sm tracking-wide">
              {missionTitle}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 px-4 py-2.5 rounded-lg text-xs font-bold tracking-wider uppercase bg-slate-800 text-slate-300 border border-slate-700 active:scale-95 transition touch-manipulation"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-bold tracking-wider uppercase bg-fuchsia-600 text-white active:scale-95 transition touch-manipulation"
          >
            Continue
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}