import React from 'react';
import { Crosshair, Shield, Plus, Check, X, Trash2 } from 'lucide-react';
import { getItem, getShopItems, ITEM_CATEGORIES, getEffectiveMovement } from '@/game/equipment';
import { getWeapon } from '@/game/weapons';
import { getArmor, getArmorValue } from '@/game/armor';
import { getSoldierIconComponent } from '@/game/soldierIcons';
import { getSoldierIconColorHex } from '@/game/iconColors';

const TIER_LABELS = { 0: 'T0 Conventional', 1: 'T1 Laser', 2: 'T2 Plasma', 3: 'T3 Nano' };
const TIER_COLORS = { 0: 'text-slate-400', 1: 'text-cyan-400', 2: 'text-fuchsia-400', 3: 'text-emerald-400' };
const ARMOR_TIER_LABELS = { 0: 'T0 Body', 1: 'T1 Infused', 2: 'T2 Powered', 3: 'T3 Nano' };

function StatDelta({ label, value, delta }) {
  const deltaColor = delta > 0 ? 'text-emerald-400 font-bold' : delta < 0 ? 'text-rose-400 font-bold' : 'text-slate-500';
  const deltaStr = delta > 0 ? ` (+${delta})` : delta < 0 ? ` (${delta})` : '';
  return (
    <span className="text-slate-400 text-[10px]">
      {label} <b className="text-slate-100">{value}</b>
      {delta !== 0 && <span className={deltaColor}>{deltaStr}</span>}
    </span>
  );
}

export default function QuickEquipModal({
  soldier,
  slot,
  inventory = {},
  onEquip,
  onUnequip,
  onChangeSlot,
  onClose,
  busy = false,
}) {
  if (!soldier) return null;

  const Icon = getSoldierIconComponent(soldier);
  const iconColorHex = getSoldierIconColorHex(soldier);

  const weaponItems = getShopItems().filter((i) => i.category === ITEM_CATEGORIES.WEAPON);
  const armorItems = getShopItems().filter((i) => i.category === ITEM_CATEGORIES.ARMOR);
  const utilItems = getShopItems().filter((i) => i.category === ITEM_CATEGORIES.UTILITY);

  const equippedWeaponKey = soldier.equipped_weapon || null;
  const equippedWeapon = equippedWeaponKey ? getWeapon(equippedWeaponKey) : null;
  const equippedArmorId = soldier.equipped_armor || null;
  const equippedArmor = equippedArmorId ? getArmor(equippedArmorId) : null;
  const equippedUtilId = soldier.equipped_utility || null;
  const equippedUtil = equippedUtilId ? getItem(equippedUtilId) : null;

  const currentMove = getEffectiveMovement(5, soldier);
  const currentDmg = equippedWeapon?.damage ?? 0;
  const currentRange = equippedWeapon?.range ?? 0;
  const currentAmmo = equippedWeapon?.ammo ?? 0;
  const currentArmorVal = getArmorValue(soldier);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full sm:max-w-lg bg-slate-900 border-t sm:border border-slate-700 sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[85dvh] overflow-hidden animate-in fade-in slide-in-from-bottom duration-200">
        {/* Header with Soldier Identity */}
        <div className="p-3.5 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 border border-white/10"
              style={{ backgroundColor: iconColorHex || '#1e293b' }}
            >
              <Icon className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm text-white truncate">{soldier.name}</span>
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                  Lv. {soldier.level}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 capitalize">
                {soldier.class} • Fast Equip
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white bg-slate-800/60 active:scale-95 transition"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Slot Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-900/90 shrink-0">
          <button
            type="button"
            onClick={() => onChangeSlot('weapon')}
            className={`flex-1 py-2.5 px-2 flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider transition border-b-2 ${
              slot === 'weapon'
                ? 'text-cyan-400 border-cyan-400 bg-cyan-950/20'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5 shrink-0" />
            <span>Weapon</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeSlot('armor')}
            className={`flex-1 py-2.5 px-2 flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider transition border-b-2 ${
              slot === 'armor'
                ? 'text-blue-400 border-blue-400 bg-blue-950/20'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5 shrink-0" />
            <span>Armor</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeSlot('utility')}
            className={`flex-1 py-2.5 px-2 flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider transition border-b-2 ${
              slot === 'utility'
                ? 'text-emerald-400 border-emerald-400 bg-emerald-950/20'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span>Utility</span>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-2">
          {slot === 'weapon' && (
            <WeaponList
              soldier={soldier}
              inventory={inventory}
              weaponItems={weaponItems}
              currentWeaponKey={equippedWeaponKey}
              currentDmg={currentDmg}
              currentRange={currentRange}
              currentAmmo={currentAmmo}
              currentMove={currentMove}
              onSelect={(id) => onEquip('equipped_weapon', id)}
              busy={busy}
            />
          )}

          {slot === 'armor' && (
            <ArmorList
              soldier={soldier}
              inventory={inventory}
              armorItems={armorItems}
              currentArmorId={equippedArmorId}
              currentArmorValue={currentArmorVal}
              currentMove={currentMove}
              onSelect={(id) => onEquip('equipped_armor', id)}
              busy={busy}
            />
          )}

          {slot === 'utility' && (
            <UtilityList
              soldier={soldier}
              inventory={inventory}
              utilItems={utilItems}
              currentUtilId={equippedUtilId}
              onSelect={(id) => onEquip('equipped_utility', id)}
              onUnequip={() => onUnequip('equipped_utility')}
              busy={busy}
            />
          )}
        </div>

        {/* Footer Done Action */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/80 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider active:scale-95 transition touch-manipulation"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function WeaponList({
  soldier,
  inventory,
  weaponItems,
  currentWeaponKey,
  currentDmg,
  currentRange,
  currentAmmo,
  currentMove,
  onSelect,
  busy,
}) {
  const available = weaponItems.filter((item) => {
    const owned = (inventory || {})[item.id] || 0;
    return owned > 0 || item.id === currentWeaponKey;
  });

  if (available.length === 0) {
    return (
      <div className="text-center text-slate-500 text-xs py-8">
        No unlocked weapons available. Purchase new weapons in the Armory.
      </div>
    );
  }

  const familyOrder = ['rifle', 'shotgun', 'lmg', 'sniper_rifle'];
  available.sort((a, b) => {
    const fa = familyOrder.indexOf(a.family) ?? 99;
    const fb = familyOrder.indexOf(b.family) ?? 99;
    if (fa !== fb) return fa - fb;
    return (a.tier || 0) - (b.tier || 0);
  });

  return (
    <div className="space-y-2">
      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
        Tap a weapon to equip instantly
      </div>

      {available.map((item) => {
        const w = getWeapon(item.id);
        if (!w) return null;
        const isEquipped = item.id === currentWeaponKey;
        const newMove = getEffectiveMovement(5, soldier, item.id);
        const dDmg = w.damage - currentDmg;
        const dRange = w.range - currentRange;
        const dAmmo = (w.ammo ?? 0) - currentAmmo;
        const dMove = newMove - currentMove;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => !isEquipped && !busy && onSelect(item.id)}
            disabled={isEquipped || busy}
            className={`w-full text-left rounded-xl border p-3 transition touch-manipulation flex flex-col justify-between ${
              isEquipped
                ? 'border-emerald-500/70 bg-emerald-950/30 ring-1 ring-emerald-500/30'
                : 'border-slate-700 bg-slate-800/60 hover:bg-slate-800 hover:border-slate-500 active:scale-[0.99]'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">{w.name}</span>
                <span className={`text-[9px] font-bold uppercase ${TIER_COLORS[w.tier] || 'text-slate-400'}`}>
                  {TIER_LABELS[w.tier]}
                </span>
              </div>
              {isEquipped ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40">
                  <Check className="w-3 h-3 stroke-[3]" /> Equipped
                </span>
              ) : (
                <span className="text-[10px] font-bold text-cyan-400 group-hover:underline">
                  Equip
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 pt-2 border-t border-slate-700/50">
              <StatDelta label="DMG" value={w.damage} delta={dDmg} />
              <StatDelta label="RNG" value={w.range} delta={dRange} />
              <StatDelta label="AMMO" value={w.ammo ?? 0} delta={dAmmo} />
              <StatDelta label="MOVE" value={newMove} delta={dMove} />
            </div>
          </button>
        );
      })}
    </div>
  );
}

function ArmorList({
  soldier,
  inventory,
  armorItems,
  currentArmorId,
  currentArmorValue,
  currentMove,
  onSelect,
  busy,
}) {
  const available = armorItems.filter((item) => {
    const owned = (inventory || {})[item.id] || 0;
    return owned > 0 || item.id === currentArmorId;
  });

  if (available.length === 0) {
    return (
      <div className="text-center text-slate-500 text-xs py-8">
        No unlocked armor available. Purchase new armor in the Armory.
      </div>
    );
  }

  const weightOrder = { light: 0, medium: 1, heavy: 2 };
  available.sort((a, b) => {
    if ((a.tier || 0) !== (b.tier || 0)) return (a.tier || 0) - (b.tier || 0);
    return (weightOrder[a.weightClass] ?? 99) - (weightOrder[b.weightClass] ?? 99);
  });

  return (
    <div className="space-y-2">
      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
        Tap an armor suit to equip instantly
      </div>

      {available.map((item) => {
        const armor = getArmor(item.id);
        if (!armor) return null;
        const isEquipped = item.id === currentArmorId;
        const newMove = getEffectiveMovement(5, soldier, undefined, item.id);
        const dArmor = armor.finalArmor - currentArmorValue;
        const dMove = newMove - currentMove;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => !isEquipped && !busy && onSelect(item.id)}
            disabled={isEquipped || busy}
            className={`w-full text-left rounded-xl border p-3 transition touch-manipulation flex flex-col justify-between ${
              isEquipped
                ? 'border-emerald-500/70 bg-emerald-950/30 ring-1 ring-emerald-500/30'
                : 'border-slate-700 bg-slate-800/60 hover:bg-slate-800 hover:border-slate-500 active:scale-[0.99]'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">{armor.name}</span>
                <span className={`text-[9px] font-bold uppercase ${TIER_COLORS[armor.tier] || 'text-slate-400'}`}>
                  {ARMOR_TIER_LABELS[armor.tier]}
                </span>
              </div>
              {isEquipped ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40">
                  <Check className="w-3 h-3 stroke-[3]" /> Equipped
                </span>
              ) : (
                <span className="text-[10px] font-bold text-blue-400">
                  Equip
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 pt-2 border-t border-slate-700/50">
              <StatDelta label="ARMOR" value={armor.finalArmor} delta={dArmor} />
              <StatDelta label="MOVE" value={newMove} delta={dMove} />
            </div>
          </button>
        );
      })}
    </div>
  );
}

function UtilityList({
  soldier: _soldier,
  inventory,
  utilItems,
  currentUtilId,
  onSelect,
  onUnequip,
  busy,
}) {
  const available = utilItems.filter((item) => {
    const owned = (inventory || {})[item.id] || 0;
    return owned > 0 || item.id === currentUtilId;
  });

  const renderDescription = (item) => {
    if (item.ammoBonus) return `Ammo +${item.ammoBonus}`;
    if (item.movementBonus) return `Movement +${item.movementBonus}`;
    if (item.armorPierce) return `Ignore ${item.armorPierce} Armor`;
    if (item.reactivePlating) return `-${item.reactivePlating} damage from first hit per phase`;
    if (item.autoLoader) return 'First Reload costs 0 AP';
    if (item.grantsAbility === 'smoke_grenade') return 'Grants Smoke Grenade (1 per mission)';
    if (item.grantsAbility === 'sprint_harness') return 'Grants Sprint Harness (+3 move, 1 per mission)';
    if (item.grantsAbility === 'emergency_shield') return 'Grants Emergency Shield (+3 shield, 1 per mission)';
    if (item.grantsAbility === 'grenade') return 'Grants Fragmentation Grenade (3×3 blast, 1 per mission)';
    if (item.grantsAbility === 'field_medkit') return 'Grants Field Medkit (revive downed ally)';
    if (item.grantsAbility === 'disruptor_hook') return 'Grants Disruptor Hook (pull enemy, 1 per mission)';
    return item.description;
  };

  return (
    <div className="space-y-2">
      {/* Unequip / Clear button if an item is equipped */}
      {currentUtilId && (
        <button
          type="button"
          onClick={() => !busy && onUnequip()}
          disabled={busy}
          className="w-full py-2 px-3 rounded-lg border border-rose-800/60 bg-rose-950/30 hover:bg-rose-900/40 text-rose-300 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition active:scale-98 touch-manipulation"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Unequip / Clear Slot
        </button>
      )}

      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
        Tap a utility item to equip instantly
      </div>

      {available.map((item) => {
        const isEquipped = item.id === currentUtilId;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => !isEquipped && !busy && onSelect(item.id)}
            disabled={isEquipped || busy}
            className={`w-full text-left rounded-xl border p-3 transition touch-manipulation flex flex-col justify-between ${
              isEquipped
                ? 'border-emerald-500/70 bg-emerald-950/30 ring-1 ring-emerald-500/30'
                : 'border-slate-700 bg-slate-800/60 hover:bg-slate-800 hover:border-slate-500 active:scale-[0.99]'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-sm font-bold text-white">{item.name}</span>
              {isEquipped ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40">
                  <Check className="w-3 h-3 stroke-[3]" /> Equipped
                </span>
              ) : (
                <span className="text-[10px] font-bold text-emerald-400">
                  Equip
                </span>
              )}
            </div>

            <div className="text-xs text-slate-300 mt-1.5">
              {renderDescription(item)}
            </div>
          </button>
        );
      })}

      {available.length === 0 && (
        <div className="text-center text-slate-500 text-xs py-8">
          No utility items unlocked. Purchase in the Armory.
        </div>
      )}
    </div>
  );
}
