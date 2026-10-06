import React from 'react';
import { Coins, Gem, Users, HeartCrack, Clock, Zap } from 'lucide-react';

// Reusable save-slot card for the New Game and Load Game screens. Shows
// concise metadata for occupied slots, an EMPTY label for vacant ones, and a
// SAVE DATA ERROR state for corrupt slots. Action buttons are passed as
// children so each screen can supply its own (Start / Overwrite / Load).
export default function SaveSlotCard({ meta, activeSlot, children }) {
  const { slot, occupied, error } = meta;
  const isActive = activeSlot === slot;

  return (
    <div
      className={`rounded-lg border p-3 ${
        error
          ? 'border-rose-700/60 bg-rose-950/20'
          : meta.isAuto
            ? occupied
              ? 'border-amber-700/50 bg-amber-950/20'
              : 'border-amber-800/40 bg-amber-950/10'
            : occupied
              ? 'border-slate-700 bg-slate-900/60'
              : 'border-slate-800 bg-slate-900/30'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-white font-bold text-sm tracking-wide">{meta.slotLabel || `SAVE ${slot}`}</span>
          {meta.isAuto && (
            <span className="text-[8px] font-bold uppercase tracking-wider px-1 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
              Auto
            </span>
          )}
        </div>
        {isActive && (
          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
            Current
          </span>
        )}
      </div>

      {error ? (
        <div className="text-rose-400 text-xs font-bold tracking-wide uppercase py-2">
          Save Data Error
        </div>
      ) : occupied ? (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <Clock className="w-3 h-3" />
            <span>{formatDate(meta.lastPlayedAt)}</span>
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="inline-flex items-center gap-1 text-slate-300">
              <Users className="w-3 h-3" /> {meta.readyCount} Ready
            </span>
            {meta.injuredCount > 0 && (
              <span className="inline-flex items-center gap-1 text-rose-400">
                <HeartCrack className="w-3 h-3" /> {meta.injuredCount} Injured
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="inline-flex items-center gap-1 text-amber-300">
              <Coins className="w-3 h-3" /> {meta.credits}
            </span>
            <span className="inline-flex items-center gap-1 text-emerald-300">
              <Gem className="w-3 h-3" /> {meta.alienMaterials}
            </span>
            {meta.powerCores > 0 && (
              <span className="inline-flex items-center gap-1 text-fuchsia-300">
                <Zap className="w-3 h-3" /> {meta.powerCores}
              </span>
            )}
          </div>
          <div className="text-[10px] text-slate-500">{meta.progressMarker}</div>
        </div>
      ) : (
        <div className="text-slate-500 text-xs font-bold tracking-wide uppercase py-2">Empty</div>
      )}

      {children && <div className="mt-2.5">{children}</div>}
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}