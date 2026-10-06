import React, { useState } from 'react';
import { Crown, Coins } from 'lucide-react';
import { COMMANDER_COST } from '@/game/commander';

// Commander unlock card — rendered in the Armory Squad Improvements section.
// Distinct from squad-size upgrades: Commander has its own persistent state
// object and a confirmation dialog before purchase.
//
// States:
//   Locked  (affordable)  → amber card, UNLOCK button, confirmation dialog
//   Locked  (can't afford) → amber card, disabled UNLOCK, shortfall notice
//   Unlocked              → emerald card, status UNLOCKED, no purchase button
//
// The confirmation dialog lets the player cancel without spending anything.
// Rapid taps are safe: the parent's `busy` guard disables the button during
// the transaction, and buyCommander() itself rejects duplicate unlocks.
export default function CommanderCard({ save, busy, onUnlock }) {
  const [confirming, setConfirming] = useState(false);
  const unlocked = !!save?.commander?.unlocked;
  const credits = save?.credits ?? 0;
  const canAfford = credits >= COMMANDER_COST;

  // --- Unlocked state: no purchase button ---
  if (unlocked) {
    return (
      <div className="rounded-lg border border-emerald-600/50 bg-emerald-950/20 p-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-md flex items-center justify-center shrink-0 bg-emerald-900/40">
            <Crown className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-white font-bold text-sm tracking-wide">COMMANDER</span>
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                UNLOCKED
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
              Commander system unlocked. Commander skills will become available as they are acquired.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Locked state: available for purchase ---
  return (
    <>
      <div className="rounded-lg border border-amber-700/50 bg-amber-950/10 p-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-md flex items-center justify-center shrink-0 bg-amber-900/30">
            <Crown className="w-5 h-5 text-amber-400" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-white font-bold text-sm tracking-wide">COMMANDER</span>
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                AVAILABLE
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
              Unlocks strategic Commander capabilities that operate independently of individual soldiers.
            </div>
            <div className="text-[11px] text-slate-500 mt-1 leading-snug">
              Strategic battlefield command system.
            </div>
          </div>
        </div>
        <div className="mt-2.5 flex items-center justify-between">
          <span className="inline-flex items-center gap-1 text-amber-300 font-bold text-sm">
            <Coins className="w-3.5 h-3.5" /> {COMMANDER_COST}
          </span>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={!canAfford || busy}
            className={`px-4 py-2 rounded-lg text-xs font-bold tracking-wide uppercase transition touch-manipulation ${
              canAfford && !busy
                ? 'bg-amber-600 text-white active:scale-95'
                : 'bg-slate-800 text-slate-500 border border-slate-700 opacity-60'
            }`}
          >
            Unlock
          </button>
        </div>
        {!canAfford && (
          <div className="mt-1.5 text-[10px] font-bold text-rose-400 text-right">
            Need {COMMANDER_COST - credits} more Credits
          </div>
        )}
      </div>

      {/* Purchase confirmation — Cancel spends nothing */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm px-4">
          <div className="w-full max-w-xs rounded-xl border border-amber-700/60 bg-slate-950 shadow-2xl p-5">
            <div className="flex flex-col items-center text-center gap-3">
              <Crown className="w-8 h-8 text-amber-400" />
              <div className="text-white font-black text-sm tracking-wide uppercase">Unlock Commander?</div>
              <div className="text-slate-300 text-[13px] leading-snug">
                Cost: <span className="text-amber-300 font-bold">{COMMANDER_COST} Credits</span>
              </div>
              <div className="w-full flex gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  disabled={busy}
                  className="flex-1 py-3 rounded-lg border border-slate-600 bg-slate-800 text-slate-300 text-xs font-bold tracking-wide uppercase active:scale-95 touch-manipulation disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => { setConfirming(false); onUnlock(); }}
                  disabled={busy}
                  className="flex-1 py-3 rounded-lg border border-amber-300 bg-amber-500 text-slate-900 text-xs font-bold tracking-wide uppercase active:scale-95 touch-manipulation disabled:opacity-50"
                >
                  Unlock
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}