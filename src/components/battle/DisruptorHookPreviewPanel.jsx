import React from 'react';
import { X, Anchor, AlertTriangle, Bomb, ChevronRight } from 'lucide-react';

export default function DisruptorHookPreviewPanel({ preview, onFire, onCancel }) {
  if (!preview) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/85 backdrop-blur-sm">
      <div className="w-full max-w-md max-h-[92dvh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-amber-600/60 bg-slate-950 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-slate-700 bg-slate-900/60">
          <div className="flex items-center gap-2">
            <Anchor className="w-4 h-4 text-amber-400" />
            <span className="text-white font-bold text-sm tracking-wide uppercase">
              Disruptor Hook Preview
            </span>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-md bg-slate-800 text-slate-300 active:scale-95 touch-manipulation hover:bg-slate-700"
            aria-label="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2.5">
          {/* Target */}
          <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-2.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Target</span>
              <span className="text-[10px] text-slate-400 font-mono">
                HP {preview.targetHp}/{preview.targetMaxHp} · Armor {preview.targetArmor}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white font-bold text-sm tracking-wide capitalize">
                {preview.targetName}
              </span>
              <span className="text-xs font-mono font-bold text-amber-400">
                0 Direct Damage
              </span>
            </div>
          </div>

          {/* Pull trajectory */}
          <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-2.5 space-y-1.5">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">
              Trajectory & Destination
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Pull Distance</span>
              <span className="text-slate-200 font-bold">{preview.pullDistance} tiles</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Final Position</span>
              <span className="text-emerald-400 font-bold">
                Adjacent ({preview.destination.x}, {preview.destination.y})
              </span>
            </div>
          </div>

          {/* Hazards & Environmental effects */}
          <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-2.5 space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
              Environmental Effects
            </div>

            {/* Volatile ground */}
            <div className="flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1.5 text-slate-300">
                <AlertTriangle className={`w-3.5 h-3.5 ${preview.hazardCount > 0 ? 'text-amber-400' : 'text-slate-500'}`} />
                Volatile Ground
              </span>
              {preview.hazardCount > 0 ? (
                <span className="text-rose-400 font-bold">
                  {preview.hazardCount} {preview.hazardCount === 1 ? 'tile' : 'tiles'} (-{preview.hazardDamage} HP predicted)
                </span>
              ) : (
                <span className="text-slate-500 font-mono">None</span>
              )}
            </div>

            {/* Mines */}
            <div className="flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1.5 text-slate-300">
                <Bomb className={`w-3.5 h-3.5 ${preview.willTriggerMine ? 'text-rose-400' : 'text-slate-500'}`} />
                Player Mines
              </span>
              {preview.willTriggerMine ? (
                <span className="text-rose-400 font-bold tracking-wide uppercase text-[11px] animate-pulse">
                  {preview.minesCount} Mine{preview.minesCount === 1 ? '' : 's'} · WILL TRIGGER!
                </span>
              ) : (
                <span className="text-slate-500 font-mono">None</span>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="shrink-0 flex items-center gap-2 p-3 border-t border-slate-700 bg-slate-900/80">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 px-4 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 text-xs font-bold uppercase tracking-wider active:scale-95 transition touch-manipulation hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onFire}
            className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wider shadow-lg shadow-amber-500/20 active:scale-95 transition touch-manipulation flex items-center justify-center gap-1"
          >
            Activate Hook (1 AP)
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
