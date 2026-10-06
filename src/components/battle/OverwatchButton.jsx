import React from 'react';
import { Eye } from 'lucide-react';
import { TEAMS } from '@/game/constants';
import { hasAmmo } from '@/game/ammo';
import { isInOverwatch, canEnterOverwatch } from '@/game/reactions';
import { hasStatus, STATUS_TYPES } from '@/game/statuses';

// One-tap Overwatch: spend 1 AP, enter reaction state. No targeting.
// Mirrors AbilityButton's visual shape so it slots into the 3-col action grid.
export default function OverwatchButton({ unit, phase, onActivate }) {
  const isPlayer = unit.team === TEAMS.PLAYER;
  const inOverwatch = isInOverwatch(unit);
  const suppressed = hasStatus(unit, STATUS_TYPES.SUPPRESSED);
  const hasAmmoNow = hasAmmo(unit);
  const canAfford = unit.ap >= 1;
  const canActivate = canEnterOverwatch(unit, phase);

  let stateKey = 'ready';
  if (!isPlayer || phase !== 'player') stateKey = 'locked';
  else if (inOverwatch) stateKey = 'active';
  else if (suppressed) stateKey = 'suppressed';
  else if (!hasAmmoNow) stateKey = 'empty';
  else if (!canAfford) stateKey = 'noap';

  const dim = stateKey !== 'ready' && stateKey !== 'active';

  const handleTap = () => {
    if (canActivate) onActivate();
  };

  return (
    <button
      type="button"
      onClick={handleTap}
      className={`relative w-full flex flex-col items-center justify-center gap-0.5 py-2 rounded-lg border touch-manipulation select-none transition-colors ${
        stateKey === 'active'
          ? 'bg-amber-500 border-amber-300 text-slate-900 ring-2 ring-amber-300'
          : stateKey === 'ready'
            ? 'bg-amber-600 border-amber-300 text-white active:opacity-90'
            : 'bg-slate-800 text-slate-400 border-slate-700'
      } ${dim ? 'opacity-60' : ''}`}
      aria-label="Overwatch"
    >
      <Eye className="w-5 h-5" strokeWidth={2.2} />
      <span className="text-[10px] font-bold tracking-wide leading-none">Overwatch</span>

      <span className="absolute top-0.5 left-1 text-[8px] font-bold tracking-wide opacity-80">1AP</span>

      {stateKey === 'active' && (
        <span className="absolute inset-0 flex items-center justify-center bg-amber-900/30 rounded-lg">
          <span className="text-[10px] font-black text-amber-200 tracking-widest">READY</span>
        </span>
      )}
      {stateKey === 'empty' && (
        <span className="absolute bottom-0.5 right-1 text-[8px] font-bold text-rose-300/90 tracking-wide">EMPTY</span>
      )}
      {stateKey === 'noap' && (
        <span className="absolute bottom-0.5 right-1 text-[8px] font-bold text-amber-300/90 tracking-wide">NO AP</span>
      )}
      {stateKey === 'suppressed' && (
        <span className="absolute bottom-0.5 right-1 text-[8px] font-bold text-violet-300/90 tracking-wide">SUPP</span>
      )}
    </button>
  );
}