import React, { useEffect, useState, useCallback } from 'react';
import { Coins, Plus, Footprints, BriefcaseMedical, Users, Check, Lock, Crown, Crosshair, Shield, Cloud, FastForward, RefreshCw, Bomb, Pickaxe, BrickWall, Anchor } from 'lucide-react';
import { loadPlayerSave, buyItem, loadSoldiers, buySquadUpgrade, buyCommander } from '@/game/persistence';
import { getShopItems, ITEM_CATEGORIES } from '@/game/equipment';
import { SQUAD_UPGRADES, isUpgradePurchased, isUpgradeLocked, getMaxSquadSize } from '@/game/squadUpgrades';
import ResourceHeader from '@/components/armory/ResourceHeader';
import EquipmentCard from '@/components/armory/EquipmentCard';
import CommanderCard from '@/components/armory/CommanderCard';

const WEAPON_FAMILY_NAMES = { rifle: 'Rifle', shotgun: 'Shotgun', lmg: 'LMG', sniper_rifle: 'Sniper' };
const FAMILY_ORDER = ['rifle', 'shotgun', 'lmg', 'sniper_rifle'];
const WEIGHT_ORDER = { light: 0, medium: 1, heavy: 2 };

const UTILITY_ICONS = {
  ammo_rig: Plus,
  mobility_kit: Footprints,
  field_medkit: BriefcaseMedical,
  armor_piercing_rounds: Crosshair,
  reactive_plating: Shield,
  smoke_grenade: Cloud,
  sprint_harness: FastForward,
  auto_loader: RefreshCw,
  emergency_shield: Shield,
  grenade: Bomb,
  wall_charge: Pickaxe,
  insta_wall_cement: BrickWall,
  disruptor_hook: Anchor,
};

// Per-upgrade icon for the Squad Improvements section.
const UPGRADE_ICONS = {
  improvement1: Users,
  improvement2: Users,
  chess_board: Crown,
};

const SECTIONS = [
  { id: 'weapons', label: 'Weapons' },
  { id: 'armor', label: 'Armor' },
  { id: 'utilities', label: 'Utilities' },
  { id: 'squad', label: 'Squad' },
];

// Armory: tier-based equipment purchasing with Credits, Alien Materials, and
// Power Cores. Four sections (Weapons, Armor, Utilities, Squad Improvements)
// with lightweight filters. The persistent footer is provided by the
// BetweenMissionsLayout and remains fixed below the scrolling content.
export default function Armory() {
  const [save, setSave] = useState(null);
  const [soldiers, setSoldiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [section, setSection] = useState('weapons');
  const [weaponFilter, setWeaponFilter] = useState('all');
  const [armorFilter, setArmorFilter] = useState('all');
  const [feedback, setFeedback] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [p, s] = await Promise.all([loadPlayerSave(), loadSoldiers()]);
    setSave(p);
    setSoldiers(s);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Refresh when debug controls change data in the global DebugOverlay.
  useEffect(() => {
    const handler = () => load();
    window.addEventListener('debug-data-changed', handler);
    return () => window.removeEventListener('debug-data-changed', handler);
  }, [load]);

  const handleBuy = async (itemId) => {
    if (busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      const updated = await buyItem(itemId);
      setSave(updated);
      setFeedback({ type: 'ok', text: 'Unlocked' });
    } catch (e) {
      setFeedback({ type: 'err', text: e.message || 'Purchase failed' });
    }
    setTimeout(() => setFeedback(null), 2000);
    setBusy(false);
  };

  const handleBuyUpgrade = async (upgradeId) => {
    if (busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      const updated = await buySquadUpgrade(upgradeId);
      setSave(updated);
      setFeedback({ type: 'ok', text: 'Upgrade Purchased' });
    } catch (e) {
      setFeedback({ type: 'err', text: e.message || 'Purchase failed' });
    }
    setTimeout(() => setFeedback(null), 2000);
    setBusy(false);
  };

  const handleBuyCommander = async () => {
    if (busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      const updated = await buyCommander();
      setSave(updated);
      setFeedback({ type: 'ok', text: 'COMMANDER UNLOCKED' });
    } catch (e) {
      setFeedback({ type: 'err', text: e.message || 'Purchase failed' });
    }
    setTimeout(() => setFeedback(null), 2500);
    setBusy(false);
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-700 border-t-slate-300 rounded-full animate-spin" />
      </div>
    );
  }

  const allItems = getShopItems();
  const weaponItems = allItems
    .filter((i) => i.category === ITEM_CATEGORIES.WEAPON)
    .sort((a, b) => {
      const fa = FAMILY_ORDER.indexOf(a.family) ?? 99;
      const fb = FAMILY_ORDER.indexOf(b.family) ?? 99;
      if (fa !== fb) return fa - fb;
      return (a.tier || 0) - (b.tier || 0);
    });
  const armorItems = allItems
    .filter((i) => i.category === ITEM_CATEGORIES.ARMOR)
    .sort((a, b) => {
      const wa = WEIGHT_ORDER[a.weightClass] ?? 99;
      const wb = WEIGHT_ORDER[b.weightClass] ?? 99;
      if (wa !== wb) return wa - wb;
      return (a.tier || 0) - (b.tier || 0);
    });
  const utilItems = allItems.filter((i) => i.category === ITEM_CATEGORIES.UTILITY);
  const upgradeList = Object.values(SQUAD_UPGRADES);

  const filteredWeapons = weaponFilter === 'all'
    ? weaponItems
    : weaponItems.filter((w) => w.family === weaponFilter);
  const filteredArmor = armorFilter === 'all'
    ? armorItems
    : armorItems.filter((a) => a.weightClass === armorFilter);

  const maxSquad = getMaxSquadSize(save);

  return (
    <div className="h-[100dvh] bg-slate-950 flex flex-col overflow-hidden">
      {/* Title */}
      <div className="shrink-0 px-4 py-3 border-b border-slate-800">
        <h1 className="text-white font-black text-lg tracking-wider uppercase">Armory</h1>
      </div>

      {/* Resource header */}
      <ResourceHeader save={save} />

      {/* Section tabs */}
      <div className="shrink-0 flex border-b border-slate-800">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSection(s.id)}
            className={`flex-1 py-2.5 text-xs font-bold tracking-wide uppercase transition ${
              section === s.id
                ? 'text-white border-b-2 border-amber-500 bg-slate-900/40'
                : 'text-slate-500 border-b-2 border-transparent'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Filters (contextual) */}
      {section === 'weapons' && (
        <div className="shrink-0 flex gap-1.5 px-3 py-2 border-b border-slate-800/50 overflow-x-auto">
          {['all', ...FAMILY_ORDER].map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setWeaponFilter(f)}
              className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase transition touch-manipulation ${
                weaponFilter === f
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              {f === 'all' ? 'All' : WEAPON_FAMILY_NAMES[f]}
            </button>
          ))}
        </div>
      )}
      {section === 'armor' && (
        <div className="shrink-0 flex gap-1.5 px-3 py-2 border-b border-slate-800/50">
          {['all', 'light', 'medium', 'heavy'].map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setArmorFilter(f)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase transition touch-manipulation ${
                armorFilter === f
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 pb-20">
        {section === 'weapons' && filteredWeapons.map((item) => (
          <EquipmentCard key={item.id} item={item} save={save} soldiers={soldiers} onBuy={handleBuy} busy={busy} />
        ))}
        {section === 'armor' && filteredArmor.map((item) => (
          <EquipmentCard key={item.id} item={item} save={save} soldiers={soldiers} onBuy={handleBuy} busy={busy} />
        ))}
        {section === 'utilities' && utilItems.map((item) => (
          <UtilityCard key={item.id} item={item} save={save} onBuy={handleBuy} busy={busy} />
        ))}
        {section === 'squad' && (
          <>
            <CommanderCard save={save} busy={busy} onUnlock={handleBuyCommander} />
            {upgradeList.map((upgrade) => {
              const purchased = isUpgradePurchased(save, upgrade.id);
              const locked = isUpgradeLocked(save, upgrade.id);
              const canAfford = (save?.credits ?? 0) >= upgrade.cost;
              const UpgradeIcon = UPGRADE_ICONS[upgrade.id] || Users;
              const shortfall = Math.max(0, upgrade.cost - (save?.credits ?? 0));
              return (
                <div key={upgrade.id} className={`rounded-lg border p-3 ${
                  purchased ? 'border-emerald-600/50 bg-emerald-950/20' :
                  locked ? 'border-slate-800 bg-slate-900/30' :
                  'border-slate-700 bg-slate-900/60'
                }`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-md flex items-center justify-center shrink-0 ${
                      purchased ? 'bg-emerald-900/40' : locked ? 'bg-slate-800/50' : 'bg-slate-800'
                    }`}>
                      {purchased ? (
                        <Check className="w-5 h-5 text-emerald-400" />
                      ) : locked ? (
                        <Lock className="w-5 h-5 text-slate-600" />
                      ) : (
                        <UpgradeIcon className="w-5 h-5 text-slate-300" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-white font-bold text-sm tracking-wide">{upgrade.name}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{upgrade.desc}</div>
                      {locked && (
                        <div className="text-[10px] text-slate-600 mt-1">Requires {SQUAD_UPGRADES[upgrade.requires].name}</div>
                      )}
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between">
                    {purchased ? (
                      <span className="text-emerald-400 text-xs font-bold tracking-wide uppercase">Purchased</span>
                    ) : locked ? (
                      <span className="text-slate-600 text-xs font-bold tracking-wide uppercase">Locked</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-300 font-bold text-sm">
                        <Coins className="w-3.5 h-3.5" /> {upgrade.cost}
                      </span>
                    )}
                    {!purchased && !locked && (
                      <button
                        type="button"
                        onClick={() => handleBuyUpgrade(upgrade.id)}
                        disabled={!canAfford || busy}
                        className={`px-4 py-2 rounded-lg text-xs font-bold tracking-wide uppercase transition touch-manipulation ${
                          canAfford && !busy
                            ? 'bg-amber-600 text-white active:scale-95'
                            : 'bg-slate-800 text-slate-500 border border-slate-700 opacity-60'
                        }`}
                      >
                        Buy
                      </button>
                    )}
                  </div>
                  {!purchased && !locked && !canAfford && (
                    <div className="mt-1.5 text-[10px] font-bold text-rose-400 text-right">
                      Need {shortfall} more Credits
                    </div>
                  )}
                </div>
              );
            })}
            <div className="mt-2 px-1 text-[10px] text-slate-500">
              Current Capacity: {maxSquad} soldiers
            </div>
          </>
        )}
      </div>

      {/* Feedback toast */}
      {feedback && (
        <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg text-xs font-bold tracking-wide max-w-[90%] text-center ${
          feedback.type === 'ok' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
        }`}>
          {feedback.text}
        </div>
      )}
    </div>
  );
}

// Utility cards: unlock-based — one purchase makes it available to all soldiers.
function UtilityCard({ item, save, onBuy, busy }) {
  const unlocked = (save?.inventory || {})[item.id] > 0;
  const cost = item.cost || 0;
  const canAfford = (save?.credits ?? 0) >= cost;
  const Icon = UTILITY_ICONS[item.id] || Plus;

  return (
    <div className={`rounded-lg border p-3 ${unlocked ? 'border-emerald-600/50 bg-emerald-950/20' : 'border-slate-700 bg-slate-900/60'}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-slate-300" />
          <span className="text-white font-bold text-sm">{item.name}</span>
        </div>
        <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">UTILITY</span>
      </div>
      <div className="text-[11px] text-slate-400 mb-1">{item.description}</div>
      <div className="text-[10px] text-slate-500 mb-2">
        {item.missionUses ? <span className="text-slate-400">{item.missionUses} use/mission · </span> : null}
        {unlocked ? <span className="text-emerald-400 font-bold">Unlocked — equip on any soldier</span> : 'Not unlocked'}
      </div>
      <div className="flex items-center justify-between">
        {unlocked ? (
          <span className="inline-flex items-center gap-1 text-emerald-400 font-bold text-sm">
            <Check className="w-3.5 h-3.5" /> Unlocked
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-amber-300 font-bold text-sm">
            <Coins className="w-3.5 h-3.5" /> {cost}
          </span>
        )}
        {!unlocked && (
          <button
            type="button"
            onClick={() => onBuy(item.id)}
            disabled={!canAfford || busy}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold tracking-wide uppercase transition touch-manipulation ${
              canAfford && !busy
                ? 'bg-amber-600 text-white active:scale-95'
                : 'bg-slate-800 text-slate-500 border border-slate-700 opacity-60'
            }`}
          >
            {canAfford ? 'Unlock' : 'Need Credits'}
          </button>
        )}
      </div>
      {!unlocked && !canAfford && (
        <div className="mt-1.5 text-[10px] font-bold text-rose-400 text-right">
          Need {cost - (save?.credits ?? 0)} more Credits
        </div>
      )}
    </div>
  );
}