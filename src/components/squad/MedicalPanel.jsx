import React from 'react';
import { Coins, X, HeartCrack, ShieldCheck } from 'lucide-react';
import { getEffectiveMaxHp, ECONOMY } from '@/game/equipment';

// Medical treatment panel. With automatic post-mission healing for survivors,
// this panel focuses on treating INJURED soldiers. An injured soldier requires
// full recovery (Max HP × 5 Credits) before becoming deployable. Ready soldiers
// at full HP simply show a "Ready" status.
export default function MedicalPanel({ soldier, credits, onTreatInjury, onClose }) {
  const effMaxHp = getEffectiveMaxHp(soldier);
  const injured = !!soldier.injured;

  if (!injured) {
    return (
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-bold text-sm tracking-wide">Medical</h3>
          <button onClick={onClose} className="text-slate-400 active:scale-95"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex items-center gap-2 py-4 text-emerald-400 text-sm">
          <ShieldCheck className="w-4 h-4" /> Ready — Full Health
        </div>
        <div className="text-slate-500 text-[10px] text-center">
          {soldier.name} is ready for deployment.
        </div>
      </div>
    );
  }

  const cost = effMaxHp * ECONOMY.MEDICAL_COST_PER_HP;
  const canAfford = (credits || 0) >= cost;

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-bold text-sm tracking-wide">Medical Treatment</h3>
        <button onClick={onClose} className="text-slate-400 active:scale-95"><X className="w-4 h-4" /></button>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <HeartCrack className="w-4 h-4 text-rose-500" />
        <span className="text-rose-400 font-bold text-sm tracking-wide uppercase">Injured</span>
      </div>

      <div className="flex items-center justify-between text-xs mb-3">
        <span className="text-slate-400">{soldier.name}</span>
        <span className="text-white font-bold">0 / {effMaxHp} HP</span>
      </div>

      <div className="rounded-lg bg-slate-900/60 border border-slate-700 p-3 mb-3">
        <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Full Recovery</div>
        <div className="flex items-center justify-between">
          <span className="text-white text-sm">Restore to {effMaxHp} HP</span>
          <span className="inline-flex items-center gap-1 text-amber-300 font-bold text-sm">
            <Coins className="w-3.5 h-3.5" /> {cost}
          </span>
        </div>
      </div>

      {canAfford ? (
        <button
          type="button"
          onClick={() => onTreatInjury()}
          className="w-full py-2.5 rounded-lg bg-emerald-600 text-white text-xs font-bold tracking-wide uppercase active:scale-95 transition touch-manipulation"
        >
          Treat Injury — {cost} Credits
        </button>
      ) : (
        <div className="py-3 text-rose-400 text-xs font-bold text-center">
          NOT ENOUGH CREDITS
        </div>
      )}
    </div>
  );
}