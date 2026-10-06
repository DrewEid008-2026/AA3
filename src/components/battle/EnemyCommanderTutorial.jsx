// One-time hostile Commander tutorial overlay. Shown on the player's FIRST
// hostile Commander encounter (any commander, not Vexar-specific). Explains
// the Commander system briefly, then dismisses. Persists the "shown" flag so
// it never repeats.
//
// Spec 3.2.6 §9, §42, §43:
//   - "Enemy Commanders influence the battlefield from off-map using a limited
//     Command Budget."
//   - Show once. Do not repeat.
//   - Reusable for future first hostile Commanders.

import React from 'react';
import { Zap, X } from 'lucide-react';

export default function EnemyCommanderTutorial({ displayProfile, budgetMax, onDismiss }) {
  if (!displayProfile) return null;
  const portraitColor = displayProfile.presentationData?.portraitColor || '#dc2626';
  const glyph = displayProfile.presentationData?.portraitGlyph || 'skull';

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/85 px-4">
      <div
        className="w-full max-w-sm rounded-xl bg-slate-900 border-2 border-rose-700/60 shadow-2xl shadow-rose-900/40 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 p-3 bg-gradient-to-b from-rose-950/60 to-slate-900 border-b border-rose-800/40">
          <div
            className="flex items-center justify-center w-12 h-12 rounded-lg border border-rose-500/50 shrink-0"
            style={{ backgroundColor: `${portraitColor}22` }}
          >
            <span className="text-2xl leading-none" style={{ color: portraitColor }}>
              {glyph === 'bug' ? '🐛' : glyph === 'skull' ? '☠' : glyph === 'crosshair' ? '🎯' : '⚔'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[9px] font-bold tracking-[0.2em] text-rose-400 uppercase">Hostile Commander Detected</div>
            <div className="text-base font-black text-white leading-tight">{displayProfile.displayName}</div>
            <div className="text-xs font-bold text-rose-300 tracking-wide">{displayProfile.title}</div>
          </div>
          <button onClick={onDismiss} className="text-slate-400 hover:text-white p-1 -mt-1 -mr-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          {/* Tutorial text */}
          <div className="text-center">
            <p className="text-sm text-slate-200 leading-relaxed">
              Enemy Commanders influence the battlefield from off-map using a limited <span className="text-amber-300 font-bold">Command Budget</span>.
            </p>
            <p className="text-[11px] text-slate-400 leading-relaxed mt-2">
              They are not physical units — they cannot be attacked directly. Instead, they spend Command Points to direct their forces with tactical superiority.
            </p>
          </div>

          {/* Command Budget display */}
          <div className="flex items-center justify-between rounded-lg bg-slate-950/60 border border-rose-900/40 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Command Budget</span>
            </div>
            <div className="font-mono font-black text-lg text-amber-300">
              {budgetMax} / {budgetMax}
            </div>
          </div>

          {/* Doctrine */}
          <div className="text-center">
            <div className="text-[9px] font-bold tracking-[0.15em] text-slate-500 uppercase mb-0.5">Doctrine</div>
            <div className="text-xs text-slate-300">{displayProfile.doctrine}</div>
          </div>

          {/* Continue button */}
          <button
            onClick={onDismiss}
            className="w-full py-2.5 rounded-lg bg-rose-700 text-white text-xs font-bold tracking-widest uppercase active:scale-95 transition touch-manipulation"
          >
            Acknowledge
          </button>
        </div>
      </div>
    </div>
  );
}