import React from 'react';
import { Coins, Gem, Zap, Box, Check, Lock } from 'lucide-react';
import { getWeapon } from '@/game/weapons';
import { getArmor } from '@/game/armor';
import { getItemCost, checkAffordability, TIER_LABELS, TIER_SHORT } from '@/game/economy';

const TIER_COLORS = {
  0: { text: 'text-slate-300', bg: 'bg-slate-700', border: 'border-slate-600' },
  1: { text: 'text-cyan-300', bg: 'bg-cyan-900/60', border: 'border-cyan-700/60' },
  2: { text: 'text-fuchsia-300', bg: 'bg-fuchsia-900/60', border: 'border-fuchsia-700/60' },
  3: { text: 'text-emerald-300', bg: 'bg-emerald-900/60', border: 'border-emerald-700/60' },
};

// Shared card for weapons and armor. Weapons and armor are UNLOCKS — one
// purchase makes the item available to all soldiers for equipping. Shows full
// stats, unlock state, equipped count, and an Unlock button with clear
// missing-resource messaging when unaffordable.
export default function EquipmentCard({ item, save, soldiers, onBuy, busy }) {
  const cost = getItemCost(item);
  const { canAfford, missing } = checkAffordability(save, cost);
  const unlocked = ((save?.inventory || {})[item.id] || 0) > 0;
  const equipped = soldiers.filter(
    (s) => s.equipped_weapon === item.id || s.equipped_armor === item.id
  ).length;

  const isWeapon = item.category === 'weapon';
  const weapon = isWeapon ? getWeapon(item.id) : null;
  const armor = !isWeapon ? getArmor(item.id) : null;
  const tier = item.tier || 0;
  const tc = TIER_COLORS[tier] || TIER_COLORS[0];

  return (
    <div className={`rounded-lg border ${unlocked ? 'border-emerald-700/50' : tc.border} bg-slate-900/60 p-3`}>
      {/* Name + tier badge */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-white font-bold text-sm tracking-wide">{item.name}</span>
        <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${tc.bg} ${tc.text}`}>
          {TIER_SHORT[tier] || `T${tier}`} · {TIER_LABELS[tier] || `TIER ${tier}`}
        </span>
      </div>

      {/* Stats */}
      {weapon && (
        <div className="flex gap-3 text-[10px] text-slate-400 mb-1.5">
          <span>DMG <b className="text-slate-200">{weapon.damage}</b></span>
          <span>RNG <b className="text-slate-200">{weapon.range}</b></span>
          <span>AMMO <b className="text-slate-200">{weapon.ammo}</b></span>
          <span>MOVE <b className="text-slate-200">{weapon.movementModifier >= 0 ? '+' : ''}{weapon.movementModifier}</b></span>
        </div>
      )}
      {armor && (
        <div className="flex gap-3 text-[10px] text-slate-400 mb-1.5">
          <span>ARMOR <b className="text-slate-200">{armor.finalArmor}</b></span>
          <span>MOVE <b className="text-slate-200">{armor.movementModifier >= 0 ? '+' : ''}{armor.movementModifier}</b></span>
        </div>
      )}

      {/* Unlock state / equipped count */}
      <div className="text-[10px] mb-2">
        {unlocked ? (
          <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
            <Check className="w-3 h-3" /> Unlocked · Equipped by {equipped}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-slate-500">
            <Lock className="w-3 h-3" /> Not yet unlocked
          </span>
        )}
      </div>

      {/* Cost + Unlock / missing resources */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px]">
          <span className="inline-flex items-center gap-0.5 text-amber-300 font-bold">
            <Coins className="w-3 h-3" /> {cost.credits}
          </span>
          {cost.alienMaterials > 0 && (
            <span className="inline-flex items-center gap-0.5 text-emerald-300 font-bold">
              <Gem className="w-3 h-3" /> {cost.alienMaterials}
            </span>
          )}
          {cost.powerCores > 0 && (
            <span className="inline-flex items-center gap-0.5 text-fuchsia-300 font-bold">
              <Zap className="w-3 h-3" /> {cost.powerCores}
            </span>
          )}
          {cost.nanoCubes > 0 && (
            <span className="inline-flex items-center gap-0.5 text-sky-300 font-bold">
              <Box className="w-3 h-3" /> {cost.nanoCubes}
            </span>
          )}
        </div>
        {unlocked ? (
          <span className="text-[10px] font-bold tracking-wide uppercase text-emerald-400">Unlocked</span>
        ) : canAfford ? (
          <button
            type="button"
            onClick={() => onBuy(item.id)}
            disabled={busy}
            className="px-4 py-1.5 rounded-lg text-xs font-bold tracking-wide uppercase bg-amber-600 text-white active:scale-95 transition touch-manipulation disabled:opacity-50"
          >
            Unlock
          </button>
        ) : (
          <div className="text-right space-y-0.5">
            {missing.credits > 0 && (
              <div className="text-[9px] text-rose-400 font-bold">NEED {missing.credits} CR</div>
            )}
            {missing.alienMaterials > 0 && (
              <div className="text-[9px] text-rose-400 font-bold">NEED {missing.alienMaterials} AM</div>
            )}
            {missing.powerCores > 0 && (
              <div className="text-[9px] text-rose-400 font-bold">POWER CORE REQ</div>
            )}
            {missing.nanoCubes > 0 && (
              <div className="text-[9px] text-rose-400 font-bold">NANO CUBE REQ</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}