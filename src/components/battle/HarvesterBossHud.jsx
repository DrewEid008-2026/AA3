import React from 'react';
import { Crown, Heart, Shield } from 'lucide-react';
import { getCurrentArmor, getBaseArmor } from '@/game/armorShred';
import { HARVESTER_PHASE_LABELS } from '@/game/harvesterState';

// Distinct Boss HUD for The Harvester. Displays HP, Armor (with pips), and the
// current Phase label. Shown only on Harvester Pit boss missions. Does NOT
// show future Phase 2/3 details (Part 9).
export default function HarvesterBossHud({ harvesterUnit, harvesterState }) {
  if (!harvesterUnit || !harvesterUnit.alive) return null;
  const phase = harvesterState?.bossPhase || 'PHASE_1_ARMORED';
  const phaseLabel = HARVESTER_PHASE_LABELS[phase] || 'ARMORED HARVESTER';
  const hpPct = harvesterUnit.maxHp > 0 ? Math.max(0, harvesterUnit.hp) / harvesterUnit.maxHp : 0;
  const hpColor = hpPct > 0.5 ? 'bg-emerald-400' : hpPct > 0.25 ? 'bg-amber-400' : 'bg-rose-500';
  const curArmor = getCurrentArmor(harvesterUnit);
  const baseArmor = getBaseArmor(harvesterUnit);

  return (
    <div className="absolute left-1/2 -translate-x-1/2 top-1 z-[36] pointer-events-none w-[90%] max-w-[340px]">
      <div className="rounded-lg border border-amber-700/60 bg-slate-950/90 backdrop-blur-sm shadow-xl px-2.5 py-1.5">
        {/* Header: name + phase */}
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-white font-black text-xs tracking-wide uppercase truncate">
              THE HARVESTER
            </span>
          </div>
          <span className="text-[9px] font-bold tracking-wider uppercase text-amber-300 bg-amber-950/60 border border-amber-700/50 px-1.5 py-0.5 rounded shrink-0">
            {phaseLabel}
          </span>
        </div>

        {/* HP bar */}
        <div className="flex items-center gap-1.5 mb-1">
          <Heart className="w-3 h-3 text-rose-400 shrink-0" />
          <div className="flex-1 h-2.5 rounded-full bg-black/40 overflow-hidden border border-slate-700">
            <div
              className={`h-full ${hpColor} transition-all duration-300`}
              style={{ width: `${hpPct * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-bold text-white tabular-nums shrink-0 min-w-[48px] text-right">
            {harvesterUnit.hp}/{harvesterUnit.maxHp}
          </span>
        </div>

        {/* Armor bar + pips */}
        <div className="flex items-center gap-1.5">
          <Shield className="w-3 h-3 text-yellow-400 shrink-0" />
          <span className="text-[9px] font-bold text-yellow-300 uppercase tracking-wider shrink-0">
            Armor
          </span>
          <div className="flex items-center gap-0.5 flex-1">
            {baseArmor > 0 && Array.from({ length: baseArmor }).map((_, i) => (
              <span
                key={i}
                className={`w-2 h-2 rounded-full border border-yellow-600/50 ${
                  i < curArmor
                    ? 'bg-yellow-400 shadow-[0_0_3px_rgba(250,204,21,0.7)]'
                    : 'bg-slate-700/60'
                }`}
              />
            ))}
          </div>
          <span className="text-[10px] font-bold text-yellow-300 tabular-nums shrink-0 min-w-[32px] text-right">
            {curArmor}/{baseArmor}
          </span>
        </div>
      </div>
    </div>
  );
}