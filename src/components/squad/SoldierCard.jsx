import React from 'react';
import { Shield, HeartCrack, ChevronRight, Plus, Crosshair, Star } from 'lucide-react';
import { getSkillNode } from '@/game/skillTrees';
import { getAvailableSelections } from '@/game/skillTrees';
import { getItem, getEffectiveMaxHp } from '@/game/equipment';
import { getWeapon } from '@/game/weapons';
import { getArmorValue } from '@/game/armor';
import { getSoldierIconColorHex } from '@/game/iconColors';
import { getSoldierIconComponent } from '@/game/soldierIcons';
import { getClassPortrait } from '@/game/artAssets';

const CLASS_COLORS = {
  assault: { border: 'border-green-500/50', text: 'text-green-300', bg: 'bg-green-950/40' },
  heavy: { border: 'border-red-500/50', text: 'text-red-300', bg: 'bg-red-950/40' },
  support: { border: 'border-rose-500/50', text: 'text-rose-300', bg: 'bg-rose-950/40' },
  engineer: { border: 'border-violet-500/50', text: 'text-violet-300', bg: 'bg-violet-950/40' },
  marksman: { border: 'border-purple-500/50', text: 'text-purple-300', bg: 'bg-purple-950/40' },
};

const TIER_COLORS = { 0: 'text-slate-400', 1: 'text-cyan-400', 2: 'text-fuchsia-400', 3: 'text-emerald-400' };

function EquipSlotButton({ icon: Icon, iconColor, label, name, badge, badgeColor, onClick, empty = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="p-1.5 sm:p-2 rounded-lg bg-slate-900/90 hover:bg-slate-800 active:scale-95 border border-slate-700/80 hover:border-slate-500 transition text-left flex flex-col justify-between min-h-[46px] group touch-manipulation"
      title={`Change ${label}`}
    >
      <div className="flex items-center justify-between w-full">
        <span className="flex items-center gap-1 text-[9px] font-bold text-slate-400 group-hover:text-slate-200 uppercase tracking-wider">
          <Icon className={`w-3 h-3 ${iconColor} shrink-0`} />
          {label}
        </span>
        {badge && (
          <span className={`text-[8px] font-extrabold uppercase ${badgeColor || 'text-slate-500'}`}>
            {badge}
          </span>
        )}
      </div>
      <div className={`text-[11px] font-bold truncate w-full mt-0.5 ${empty ? 'text-slate-500 italic' : 'text-slate-100'}`}>
        {name}
      </div>
    </button>
  );
}

// Compact soldier card for the Squad screen. Shows identity, HP, XP, and
// equipment at a glance. Injured soldiers show a rose INJURED badge and 0 HP.
// Tapping MANAGE opens the bio/medical/skills panel.
// Tapping Weapon, Armor, or Utility buttons opens the quick-equip modal directly.
export default function SoldierCard({ soldier, onManage, onOpenEquipSlot }) {
  const Icon = getSoldierIconComponent(soldier);
  const colors = CLASS_COLORS[soldier.class] || CLASS_COLORS.assault;
  const injured = !!soldier.injured;
  const effMaxHp = getEffectiveMaxHp(soldier);
  const lowHp = !injured && soldier.current_hp <= effMaxHp * 0.3;
  const wounded = !injured && soldier.current_hp < effMaxHp;
  const unspent = getAvailableSelections(soldier);

  const armor = soldier.equipped_armor ? getItem(soldier.equipped_armor) : null;
  const util = soldier.equipped_utility ? getItem(soldier.equipped_utility) : null;
  const weaponKey = soldier.equipped_weapon || null;
  const weapon = weaponKey ? getWeapon(weaponKey) : null;
  const weaponName = weapon?.name || 'NONE';
  const armorValue = getArmorValue(soldier);

  const iconColorHex = getSoldierIconColorHex(soldier);

  return (
    <div className={`rounded-lg border ${injured ? 'border-rose-900/50 bg-rose-950/20' : `${colors.border} ${colors.bg}`} p-3`}>
      <div className="flex items-center gap-3">
        <div
          className={`relative w-10 h-10 rounded-md flex items-center justify-center shrink-0 overflow-hidden border border-white/10 ${injured ? 'opacity-50 grayscale' : ''}`}
          style={{ backgroundColor: iconColorHex || '#0a0a0a' }}
        >
          <Icon className={`w-5 h-5 ${injured ? 'text-rose-400' : 'text-white'}`} strokeWidth={2.5} />
          <img
            src={getClassPortrait(soldier.class)}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`font-bold text-sm tracking-wide ${injured ? 'text-rose-400' : 'text-white'}`}>
              {soldier.name}
            </span>
            {injured ? (
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-900/60 text-rose-400">
                Injured
              </span>
            ) : (
              <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}>
                Lv. {soldier.level}
              </span>
            )}
          </div>
          <div className="text-[11px] text-neutral-400 capitalize">{soldier.class}</div>
        </div>
        <button
          type="button"
          onClick={() => onManage(soldier)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-neutral-900 border text-[10px] font-bold tracking-wide uppercase active:scale-95 transition touch-manipulation shrink-0 ${
            unspent > 0 ? 'border-bio/60 text-bio' : 'border-neutral-700 text-neutral-300'
          }`}
        >
          Manage
          {unspent > 0 && (
            <span className="inline-flex items-center justify-center min-w-[14px] h-[14px] px-1 rounded-full bg-bio text-bio-foreground text-[8px] font-black leading-none">
              {unspent}
            </span>
          )}
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {injured ? (
        <>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-rose-400">
            <HeartCrack className="w-3 h-3" /> 0 / {effMaxHp} HP — Treatment Required
          </div>
          <div className="mt-2.5 grid grid-cols-3 gap-1.5">
            <EquipSlotButton
              icon={Crosshair}
              iconColor="text-cyan-400"
              label="WPN"
              name={weaponName}
              badge={weapon ? `T${weapon.tier}` : 'T0'}
              badgeColor={TIER_COLORS[weapon?.tier] || 'text-slate-400'}
              onClick={(e) => {
                e.stopPropagation();
                onOpenEquipSlot?.(soldier, 'weapon');
              }}
            />
            <EquipSlotButton
              icon={Shield}
              iconColor="text-blue-400"
              label="ARM"
              name={armor?.name || 'Standard'}
              badge={`${armorValue} ARM`}
              badgeColor="text-blue-300"
              onClick={(e) => {
                e.stopPropagation();
                onOpenEquipSlot?.(soldier, 'armor');
              }}
            />
            <EquipSlotButton
              icon={Plus}
              iconColor="text-emerald-400"
              label="UTIL"
              name={util?.name || 'Empty'}
              empty={!util}
              badge={util ? 'Equipped' : '+ Equip'}
              badgeColor={util ? 'text-emerald-400' : 'text-amber-400'}
              onClick={(e) => {
                e.stopPropagation();
                onOpenEquipSlot?.(soldier, 'utility');
              }}
            />
          </div>
        </>
      ) : (
        <>
          <div className="mt-2 grid grid-cols-3 gap-x-3 gap-y-1 text-[10px]">
            <div>
              <span className="text-neutral-500">HP </span>
              <span className={`font-bold ${lowHp ? 'text-rose-400' : wounded ? 'text-blood' : 'text-white'}`}>
                {soldier.current_hp}/{effMaxHp}
              </span>
            </div>
            <div>
              <span className="text-neutral-500">ARMOR </span>
              <span className="text-white font-bold">{armorValue}</span>
            </div>
            <div>
              <span className="text-neutral-500">XP </span>
              <span className="text-white font-bold">{soldier.xp}</span>
            </div>
          </div>

          <div className="mt-1.5 h-1.5 rounded-full bg-neutral-800 overflow-hidden">
            <div
              className={`h-full rounded-full ${lowHp ? 'bg-rose-500' : wounded ? 'bg-blood' : 'bg-bio'}`}
              style={{ width: `${Math.max(0, (soldier.current_hp / effMaxHp) * 100)}%` }}
            />
          </div>

          <div className="mt-2.5 grid grid-cols-3 gap-1.5">
            <EquipSlotButton
              icon={Crosshair}
              iconColor="text-cyan-400"
              label="WPN"
              name={weaponName}
              badge={weapon ? `T${weapon.tier}` : 'T0'}
              badgeColor={TIER_COLORS[weapon?.tier] || 'text-slate-400'}
              onClick={(e) => {
                e.stopPropagation();
                onOpenEquipSlot?.(soldier, 'weapon');
              }}
            />
            <EquipSlotButton
              icon={Shield}
              iconColor="text-blue-400"
              label="ARM"
              name={armor?.name || 'Standard'}
              badge={`${armorValue} ARM`}
              badgeColor="text-blue-300"
              onClick={(e) => {
                e.stopPropagation();
                onOpenEquipSlot?.(soldier, 'armor');
              }}
            />
            <EquipSlotButton
              icon={Plus}
              iconColor="text-emerald-400"
              label="UTIL"
              name={util?.name || 'Empty'}
              empty={!util}
              badge={util ? 'Equipped' : '+ Equip'}
              badgeColor={util ? 'text-emerald-400' : 'text-amber-400'}
              onClick={(e) => {
                e.stopPropagation();
                onOpenEquipSlot?.(soldier, 'utility');
              }}
            />
          </div>

          {Array.isArray(soldier.upgrades) && soldier.upgrades.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {soldier.upgrades.map((id) => {
                const node = getSkillNode(soldier.class, id);
                if (!node) return null;
                return (
                  <span
                    key={id}
                    className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-neutral-900 text-neutral-300 border border-neutral-700"
                  >
                    {node.name}
                  </span>
                );
              })}
            </div>
          )}

          {unspent > 0 && (
            <div className="mt-1.5 inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-bio">
              <Star className="w-2.5 h-2.5" fill="currentColor" />
              Skill Available
            </div>
          )}
        </>
      )}
    </div>
  );
}