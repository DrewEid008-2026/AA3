import React from 'react';
import { X, Pickaxe, BrickWall, Ban } from 'lucide-react';

// Detailed Targeting Info preview for terrain-manipulation utilities (Wall
// Charge + Insta-Wall Cement). Read-only — the parent commits via FIRE.
// Canceling spends nothing (no AP / uses).
//
// Wall Charge preview: TARGET WALL → WALL DESTROYED / OPEN GROUND / MOVEMENT
// OPEN / LOS OPEN.
// Insta-Wall preview: NEW WALL → BLOCKS MOVEMENT / BLOCKS LOS. Invalid
// placements show a concise reason.

function ResultRow({ label, value, ok = true }) {
  return (
    <div className="flex items-center justify-between text-[11px] py-0.5">
      <span className="text-slate-400 uppercase tracking-wide">{label}</span>
      <span className={`font-bold tracking-wide ${ok ? 'text-emerald-300' : 'text-rose-300'}`}>{value}</span>
    </div>
  );
}

export default function TerrainUtilityPreviewPanel({ preview, onFire, onCancel, fireReason }) {
  if (!preview) return null;
  const isWall = preview.kind === 'wall_charge';
  const valid = preview.validation?.valid;
  const canFire = valid && !fireReason;
  const Icon = isWall ? Pickaxe : BrickWall;

  return (
    <div className="absolute inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/85 backdrop-blur-sm">
      <div className="w-full max-w-md max-h-[92dvh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-slate-700 bg-slate-900/60">
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-amber-400" />
            <span className="text-white font-bold text-sm tracking-wide uppercase">
              {preview.label || 'Terrain Preview'}
            </span>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-md bg-slate-800 text-slate-300 active:scale-95 touch-manipulation"
            aria-label="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2.5">
          {/* Target */}
          <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10px] uppercase tracking-wider text-slate-500">Target</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white font-bold text-sm tracking-wide">
                {isWall ? (preview.target?.tileKind || 'Wall') : 'Empty Ground'}
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                ({preview.target?.x}, {preview.target?.y})
              </span>
            </div>
          </div>

          {/* Result */}
          <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-2.5">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">Result</div>
            {!valid ? (
              <div className="flex items-center gap-1.5 text-rose-300 text-xs font-bold tracking-wide">
                <Ban className="w-3.5 h-3.5" />
                {preview.validation?.reason || 'Invalid placement'}
              </div>
            ) : isWall ? (
              <div className="space-y-0.5">
                <ResultRow label="Wall" value="DESTROYED" />
                <ResultRow label="Becomes" value="OPEN GROUND" />
                <ResultRow label="Movement" value="OPEN" />
                <ResultRow label="Line of Sight" value="OPEN" />
              </div>
            ) : (
              <div className="space-y-0.5">
                <ResultRow label="Tile" value="NEW WALL" />
                <ResultRow label="Movement" value="BLOCKED" />
                <ResultRow label="Line of Sight" value="BLOCKED" />
                <ResultRow label="Siege-Destructible" value="YES" />
              </div>
            )}
          </div>
        </div>

        {/* Costs + actions */}
        <div className="shrink-0 px-3 py-2.5 border-t border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-center gap-3 text-[11px] text-slate-300 mb-2">
            {preview.costs?.ap != null && (
              <span><span className="text-slate-500">AP</span> <span className="font-bold text-white">{preview.costs.ap}</span></span>
            )}
            {preview.costs?.usesRemaining != null && preview.costs.usesRemaining !== Infinity && (
              <span><span className="text-slate-500">Uses Left</span> <span className="font-bold text-white">{preview.costs.usesRemaining}</span></span>
            )}
          </div>
          {fireReason && (
            <div className="text-center text-[11px] text-rose-400 mb-2 font-bold tracking-wide uppercase">{fireReason}</div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-3.5 rounded-lg border border-slate-600 bg-slate-800 text-slate-200 text-sm font-bold tracking-wide uppercase active:scale-95 touch-manipulation"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onFire}
              disabled={!canFire}
              className={`flex-[1.4] py-3.5 rounded-lg border text-base font-black tracking-[0.15em] uppercase active:scale-95 touch-manipulation flex items-center justify-center gap-2 ${
                canFire
                  ? 'bg-amber-600 text-white border-amber-400 shadow-lg shadow-amber-900/40'
                  : 'bg-slate-800 text-slate-600 border-slate-700 cursor-not-allowed'
              }`}
            >
              {isWall ? <Pickaxe className="w-5 h-5" /> : <BrickWall className="w-5 h-5" />}
              {isWall ? 'Breach' : 'Build'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}