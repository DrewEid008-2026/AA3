import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, RotateCw, Coins, Gem, Zap, Package,
  Heart, HeartCrack, Crown, Users, Target, Shield, Skull,
  Award, Play, Layers, Trash2, ArrowUpCircle
} from 'lucide-react';
import {
  ensureRoster, restoreTestRoster, loadPlayerSave,
  setSoldierInjured, addCredits, addAlienMaterials, addPowerCores, giveItem, resetSquadUpgrades,
  debugUnlockChapter, debugLockChapter,
  debugSetChapterProgress, debugUnlockBoss, debugMarkBossDefeated,
  debugSetSoldierLevel, debugGrantXp,
  debugSetCommander, debugSetCredits,
  debugSetAlienMaterials, debugSetPowerCores, debugSetNanoCubes,
  debugClearAllInventory, debugSetAllResources,
  debugLevelAllSoldiers, debugHealAllSoldiers, debugInjureAllSoldiers,
  debugRespecSoldier, debugChangeSoldierClass, debugDismissSoldier,
  debugUnlockAllCommanderSkills, debugUnlockAllChaptersAndBosses,
  debugResetAllCampaignProgress, debugUnlockAllSquadUpgrades,
  recruitSoldier,
} from '@/game/persistence';
import { getShopItems, getEffectiveMaxHp } from '@/game/equipment';
import { getAvailableSelections, totalSkillPointsByLevel } from '@/game/skillTrees';
import { xpForNextLevel, MAX_LEVEL } from '@/game/progression';
import { getPlayerWeaponIds, getWeapon, getWeaponTierBonus } from '@/game/weapons';
import { ARMOR_ITEMS, getArmorStats } from '@/game/armor';
import { getTierCost } from '@/game/economy';
import CompositionDebugPanel from '@/components/debug/CompositionDebugPanel';

const DEBUG_EVENT = 'debug-data-changed';

function notifyDataChanged() {
  window.dispatchEvent(new Event(DEBUG_EVENT));
}

const PLAYER_CLASSES = ['assault', 'heavy', 'sniper', 'scout'];

export default function DebugOverlay({ onClose }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('resources'); // 'resources' | 'characters' | 'modes' | 'commander' | 'composition'
  const [soldiers, setSoldiers] = useState([]);
  const [save, setSave] = useState(null);
  const [busy, setBusy] = useState(false);
  const [customCredits, setCustomCredits] = useState('');
  const [customMaterials, setCustomMaterials] = useState('');
  const [customCores, setCustomCores] = useState('');
  const [customCubes, setCustomCubes] = useState('');

  const load = useCallback(async () => {
    const [s, p] = await Promise.all([ensureRoster(), loadPlayerSave()]);
    setSoldiers(s);
    setSave(p);
  }, []);

  useEffect(() => { load(); }, [load]);

  const refresh = async () => {
    await load();
    notifyDataChanged();
  };

  const wrap = async (fn) => {
    setBusy(true);
    try { await fn(); } catch (e) { console.error('[Debug]', e); }
    await refresh();
    setBusy(false);
  };

  const handleClose = () => {
    notifyDataChanged();
    onClose();
  };

  // --- Resource Actions ---
  const handleSetCredits = (val) => wrap(async () => { setSave(await debugSetCredits(val)); });
  const handleAddCredits = (val) => wrap(async () => { setSave(await addCredits(val)); });
  const handleSetMaterials = (val) => wrap(async () => { setSave(await debugSetAlienMaterials(val)); });
  const handleAddMaterials = (val) => wrap(async () => { setSave(await addAlienMaterials(val)); });
  const handleSetCores = (val) => wrap(async () => { setSave(await debugSetPowerCores(val)); });
  const handleAddCores = (val) => wrap(async () => { setSave(await addPowerCores(val)); });
  const handleSetCubes = (val) => wrap(async () => { setSave(await debugSetNanoCubes(val)); });

  const handleMaxAllResources = () => wrap(async () => {
    setSave(await debugSetAllResources({
      credits: 99999,
      alienMaterials: 500,
      powerCores: 50,
      nanoCubes: 200,
    }));
  });

  const handleClearAllResources = () => wrap(async () => {
    setSave(await debugSetAllResources({
      credits: 0,
      alienMaterials: 0,
      powerCores: 0,
      nanoCubes: 0,
    }));
  });

  // --- Inventory & Items Actions ---
  const handleGiveAllItems = () => wrap(async () => {
    for (const item of getShopItems()) await giveItem(item.id, 1);
  });

  const handleGiveAllWeapons = () => wrap(async () => {
    for (const id of getPlayerWeaponIds()) await giveItem(id, 1);
  });

  const handleGiveAllArmor = () => wrap(async () => {
    for (const id of Object.keys(ARMOR_ITEMS)) await giveItem(id, 1);
  });

  const handleClearInventory = () => wrap(async () => {
    setSave(await debugClearAllInventory());
  });

  const handleUnlockSquadUpgrades = () => wrap(async () => {
    setSave(await debugUnlockAllSquadUpgrades());
  });

  const handleResetSquadUpgrades = () => wrap(async () => {
    setSave(await resetSquadUpgrades());
  });

  // --- Character & Roster Actions ---
  const handleLevelAll = (lvl) => wrap(async () => {
    const updated = await debugLevelAllSoldiers(lvl);
    setSoldiers(updated);
  });

  const handleHealAll = () => wrap(async () => {
    const updated = await debugHealAllSoldiers();
    setSoldiers(updated);
  });

  const handleInjureAll = () => wrap(async () => {
    const updated = await debugInjureAllSoldiers();
    setSoldiers(updated);
  });

  const handleRestoreTestRoster = () => wrap(async () => {
    await restoreTestRoster();
  });

  const handleRecruit = (cls) => wrap(async () => {
    const s = await recruitSoldier(cls);
    setSoldiers((prev) => [...prev, s]);
  });

  const handleSetSoldierLevel = (id, lvl) => wrap(async () => {
    const updated = await debugSetSoldierLevel(id, lvl);
    setSoldiers((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  });

  const handleGrantSoldierXp = (id, amount) => wrap(async () => {
    const updated = await debugGrantXp(id, amount);
    setSoldiers((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  });

  const handleFillXpToLevel = (soldier) => wrap(async () => {
    if (soldier.level >= MAX_LEVEL) return;
    const required = xpForNextLevel(soldier.level);
    const needed = Math.max(1, required - (soldier.xp || 0));
    const updated = await debugGrantXp(soldier.id, needed);
    setSoldiers((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  });

  const handleToggleSoldierInjured = (id, currentInjured) => wrap(async () => {
    const updated = await setSoldierInjured(id, !currentInjured);
    setSoldiers((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  });

  const handleRespecSoldier = (id) => wrap(async () => {
    const updated = await debugRespecSoldier(id);
    setSoldiers((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  });

  const handleChangeClass = (id, newCls) => wrap(async () => {
    const updated = await debugChangeSoldierClass(id, newCls);
    setSoldiers((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  });

  const handleDismissSoldier = (id) => wrap(async () => {
    const updated = await debugDismissSoldier(id);
    setSoldiers(updated);
  });

  // --- Chapter Actions ---
  const handleSetChapterPercent = (chId, pct) => wrap(async () => {
    setSave(await debugSetChapterProgress(chId, pct));
  });

  const handleUnlockChapter = (chId) => wrap(async () => {
    setSave(await debugUnlockChapter(chId));
  });

  const handleLockChapter = (chId) => wrap(async () => {
    setSave(await debugLockChapter(chId));
  });

  const handleUnlockBoss = (chId) => wrap(async () => {
    setSave(await debugUnlockBoss(chId));
  });

  const handleDefeatBoss = (chId) => wrap(async () => {
    setSave(await debugMarkBossDefeated(chId));
  });

  const handleResetChapter = (chId) => wrap(async () => {
    setSave(await debugResetChapter(chId));
  });

  const handleUnlockAllChapters = () => wrap(async () => {
    setSave(await debugUnlockAllChaptersAndBosses());
  });

  const handleResetCampaign = () => wrap(async () => {
    setSave(await debugResetAllCampaignProgress());
  });

  // --- Commander Actions ---
  const handleToggleCommander = (unlocked) => wrap(async () => {
    setSave(await debugSetCommander(unlocked));
  });

  const handleUnlockAllCommanderSkills = () => wrap(async () => {
    setSave(await debugUnlockAllCommanderSkills());
  });

  // --- Direct Game Mode Launchers ---
  const handleLaunchMission = (missionId) => {
    notifyDataChanged();
    onClose();
    const deploySoldiers = soldiers.slice(0, 4).map((s) => s.id).join(',');
    navigate(`/battle/${missionId}?s=${deploySoldiers}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md px-2 py-4 sm:p-6">
      <div className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-xl border border-cyan-700/60 bg-slate-950 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyan-400" />
            <div>
              <div className="text-cyan-300 font-bold text-sm tracking-wide uppercase">Tactical Debug Suite</div>
              <div className="text-[10px] text-slate-400 font-mono">
                Credits: <span className="text-amber-300 font-bold">{save?.credits ?? 0}</span> · Mats: <span className="text-emerald-300 font-bold">{save?.alien_materials ?? 0}</span> · Cores: <span className="text-fuchsia-300 font-bold">{save?.powerCores ?? 0}</span> · Cubes: <span className="text-sky-300 font-bold">{save?.nanoCubes ?? 0}</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 active:scale-95 touch-manipulation transition"
            aria-label="Close debug"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="shrink-0 flex border-b border-slate-800 bg-slate-900/40 px-2 py-1 gap-1 overflow-x-auto text-[10px] font-bold uppercase tracking-wider">
          <button
            type="button"
            onClick={() => setActiveTab('resources')}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 whitespace-nowrap transition ${
              activeTab === 'resources' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Coins className="w-3 h-3" /> Resources &amp; Gear
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('characters')}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 whitespace-nowrap transition ${
              activeTab === 'characters' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Users className="w-3 h-3" /> Characters (1..20)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('modes')}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 whitespace-nowrap transition ${
              activeTab === 'modes' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Target className="w-3 h-3" /> Game Modes &amp; Ch
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('commander')}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 whitespace-nowrap transition ${
              activeTab === 'commander' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Crown className="w-3 h-3" /> Commander
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('composition')}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 whitespace-nowrap transition ${
              activeTab === 'composition' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Skull className="w-3 h-3" /> Enemy Pools
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-4">
          {/* TAB 1: RESOURCES & INVENTORY */}
          {activeTab === 'resources' && (
            <div className="space-y-4">
              {/* Quick Macro Buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={handleMaxAllResources}
                  disabled={busy}
                  className="px-2.5 py-2 rounded-lg bg-emerald-950/70 border border-emerald-600/70 hover:bg-emerald-900 text-emerald-200 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-95 transition"
                >
                  <Award className="w-3.5 h-3.5" /> Max All Resources
                </button>
                <button
                  type="button"
                  onClick={handleClearAllResources}
                  disabled={busy}
                  className="px-2.5 py-2 rounded-lg bg-rose-950/70 border border-rose-700/60 hover:bg-rose-900 text-rose-200 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-95 transition"
                >
                  <RotateCw className="w-3.5 h-3.5" /> Poverty Mode (0 All)
                </button>
                <button
                  type="button"
                  onClick={handleGiveAllItems}
                  disabled={busy}
                  className="px-2.5 py-2 rounded-lg bg-cyan-950/70 border border-cyan-600/70 hover:bg-cyan-900 text-cyan-200 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-95 transition"
                >
                  <Package className="w-3.5 h-3.5" /> Give All Items
                </button>
                <button
                  type="button"
                  onClick={handleClearInventory}
                  disabled={busy}
                  className="px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-300 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-95 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear Inventory
                </button>
              </div>

              {/* Resource 1: CREDITS */}
              <div className="rounded-lg border border-amber-800/40 bg-slate-900/60 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300 uppercase">
                    <Coins className="w-4 h-4" /> Credits: {save?.credits ?? 0}
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      placeholder="Custom"
                      value={customCredits}
                      onChange={(e) => setCustomCredits(e.target.value)}
                      className="w-20 px-2 py-0.5 bg-slate-950 border border-slate-700 rounded text-[10px] text-white"
                    />
                    <button
                      type="button"
                      onClick={() => { if (customCredits !== '') handleSetCredits(Number(customCredits)); }}
                      className="px-2 py-0.5 bg-amber-700 text-white rounded text-[9px] font-bold"
                    >
                      Set
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {[0, 100, 500, 2500, 10000, 50000].map((amt) => (
                    <button
                      key={`c_${amt}`}
                      type="button"
                      onClick={() => handleSetCredits(amt)}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-200 border border-slate-700 text-[9px] font-bold font-mono active:scale-95"
                    >
                      ={amt}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleAddCredits(500)}
                    className="px-2 py-1 rounded bg-amber-950/60 border border-amber-700/60 text-amber-300 text-[9px] font-bold font-mono active:scale-95"
                  >
                    +500
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddCredits(2500)}
                    className="px-2 py-1 rounded bg-amber-950/60 border border-amber-700/60 text-amber-300 text-[9px] font-bold font-mono active:scale-95"
                  >
                    +2500
                  </button>
                </div>
              </div>

              {/* Resource 2: ALIEN MATERIALS */}
              <div className="rounded-lg border border-emerald-800/40 bg-slate-900/60 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300 uppercase">
                    <Gem className="w-4 h-4" /> Alien Materials: {save?.alien_materials ?? 0}
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      placeholder="Custom"
                      value={customMaterials}
                      onChange={(e) => setCustomMaterials(e.target.value)}
                      className="w-20 px-2 py-0.5 bg-slate-950 border border-slate-700 rounded text-[10px] text-white"
                    />
                    <button
                      type="button"
                      onClick={() => { if (customMaterials !== '') handleSetMaterials(Number(customMaterials)); }}
                      className="px-2 py-0.5 bg-emerald-700 text-white rounded text-[9px] font-bold"
                    >
                      Set
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {[0, 10, 50, 100, 500].map((amt) => (
                    <button
                      key={`m_${amt}`}
                      type="button"
                      onClick={() => handleSetMaterials(amt)}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-200 border border-slate-700 text-[9px] font-bold font-mono active:scale-95"
                    >
                      ={amt}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleAddMaterials(10)}
                    className="px-2 py-1 rounded bg-emerald-950/60 border border-emerald-700/60 text-emerald-300 text-[9px] font-bold font-mono active:scale-95"
                  >
                    +10
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddMaterials(50)}
                    className="px-2 py-1 rounded bg-emerald-950/60 border border-emerald-700/60 text-emerald-300 text-[9px] font-bold font-mono active:scale-95"
                  >
                    +50
                  </button>
                </div>
              </div>

              {/* Resource 3: POWER CORES & NANO CUBES */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Power Cores */}
                <div className="rounded-lg border border-fuchsia-800/40 bg-slate-900/60 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-fuchsia-300 uppercase">
                      <Zap className="w-4 h-4" /> Power Cores: {save?.powerCores ?? 0}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {[0, 1, 5, 20, 50].map((amt) => (
                      <button
                        key={`pc_${amt}`}
                        type="button"
                        onClick={() => handleSetCores(amt)}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-fuchsia-200 border border-slate-700 text-[9px] font-bold font-mono active:scale-95"
                      >
                        ={amt}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => handleAddCores(1)}
                      className="px-2 py-1 rounded bg-fuchsia-950/60 border border-fuchsia-700/60 text-fuchsia-300 text-[9px] font-bold font-mono active:scale-95"
                    >
                      +1
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddCores(5)}
                      className="px-2 py-1 rounded bg-fuchsia-950/60 border border-fuchsia-700/60 text-fuchsia-300 text-[9px] font-bold font-mono active:scale-95"
                    >
                      +5
                    </button>
                  </div>
                </div>

                {/* Nano Cubes */}
                <div className="rounded-lg border border-sky-800/40 bg-slate-900/60 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-sky-300 uppercase">
                      <Layers className="w-4 h-4" /> Nano Cubes: {save?.nanoCubes ?? 0}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {[0, 10, 50, 200, 500].map((amt) => (
                      <button
                        key={`nc_${amt}`}
                        type="button"
                        onClick={() => handleSetCubes(amt)}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-200 border border-slate-700 text-[9px] font-bold font-mono active:scale-95"
                      >
                        ={amt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Specific Item & Squad Upgrade Granters */}
              <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 space-y-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Inventory &amp; Squad Upgrades</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={handleGiveAllWeapons}
                    className="px-2 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[9px] font-bold uppercase tracking-wider border border-slate-700 active:scale-95"
                  >
                    + All 16 Weapons (T0–T3)
                  </button>
                  <button
                    type="button"
                    onClick={handleGiveAllArmor}
                    className="px-2 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[9px] font-bold uppercase tracking-wider border border-slate-700 active:scale-95"
                  >
                    + All 12 Armor Sets (T0–T3)
                  </button>
                  <button
                    type="button"
                    onClick={handleUnlockSquadUpgrades}
                    className="px-2 py-1.5 rounded bg-amber-950/60 hover:bg-amber-900 text-amber-200 text-[9px] font-bold uppercase tracking-wider border border-amber-700/60 active:scale-95"
                  >
                    Unlock All Upgrades
                  </button>
                  <button
                    type="button"
                    onClick={handleResetSquadUpgrades}
                    className="px-2 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 text-[9px] font-bold uppercase tracking-wider border border-slate-700 active:scale-95"
                  >
                    Reset Upgrades
                  </button>
                </div>
              </div>

              {/* Equipment Tier Inspection (Section 25 Development Support) */}
              <div className="rounded-lg border border-cyan-800/40 bg-slate-900/40 p-3 space-y-2">
                <div className="text-[10px] font-bold text-cyan-300 uppercase tracking-wider flex items-center justify-between">
                  <span>Equipment Tier Inspection (Authoritative T0–T3)</span>
                  <span className="text-[9px] text-slate-500 font-mono">16 Weapons · 12 Armors</span>
                </div>

                {/* Weapons Table */}
                <div className="overflow-x-auto max-h-48 border border-slate-800 rounded bg-slate-950/50">
                  <table className="w-full text-left text-[9px] font-mono text-slate-300 border-collapse">
                    <thead className="bg-slate-900 text-[8px] uppercase tracking-wider text-slate-400 sticky top-0">
                      <tr>
                        <th className="p-1.5 border-b border-slate-800">ITEM ID</th>
                        <th className="p-1.5 border-b border-slate-800">FAMILY</th>
                        <th className="p-1.5 border-b border-slate-800">TIER</th>
                        <th className="p-1.5 border-b border-slate-800">BASE</th>
                        <th className="p-1.5 border-b border-slate-800">BONUS</th>
                        <th className="p-1.5 border-b border-slate-800">FINAL DMG</th>
                        <th className="p-1.5 border-b border-slate-800">RNG</th>
                        <th className="p-1.5 border-b border-slate-800">AMMO</th>
                        <th className="p-1.5 border-b border-slate-800">MOVE</th>
                        <th className="p-1.5 border-b border-slate-800">TERRAIN / TRAITS</th>
                        <th className="p-1.5 border-b border-slate-800 text-right">OWNED</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {getPlayerWeaponIds().map((id) => {
                        const w = getWeapon(id);
                        if (!w) return null;
                        const owned = (save?.inventory || {})[id] || 0;
                        const bonus = getWeaponTierBonus(w.tier);
                        const base = w.damage - bonus;
                        const traits = [];
                        if (w.family === 'lmg') traits.push('Shred 1');
                        if (w.closeRangeDamage != null) traits.push(`Close ${w.closeRangeDamage}`);
                        return (
                          <tr key={id} className="hover:bg-slate-800/30">
                            <td className="p-1.5 text-cyan-400 font-bold">{id}</td>
                            <td className="p-1.5 capitalize text-slate-400">{w.family}</td>
                            <td className="p-1.5 font-bold">
                              <span className={w.tier === 3 ? 'text-emerald-400' : w.tier === 2 ? 'text-fuchsia-400' : w.tier === 1 ? 'text-cyan-400' : 'text-slate-400'}>
                                Tier {w.tier}
                              </span>
                            </td>
                            <td className="p-1.5 text-slate-400">{base}</td>
                            <td className="p-1.5 text-amber-300">+{bonus}</td>
                            <td className="p-1.5 font-bold text-slate-100">{w.damage}</td>
                            <td className="p-1.5 text-slate-400">{w.range}</td>
                            <td className="p-1.5 text-slate-400">{w.ammo}</td>
                            <td className="p-1.5 text-slate-400">{w.movementModifier >= 0 ? `+${w.movementModifier}` : w.movementModifier}</td>
                            <td className="p-1.5 text-slate-400">Trn {w.terrainDamage}{traits.length > 0 ? ` · ${traits.join(', ')}` : ''}</td>
                            <td className="p-1.5 text-right font-bold text-slate-300">{owned}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Armor Table */}
                <div className="overflow-x-auto max-h-48 border border-slate-800 rounded bg-slate-950/50 mt-2">
                  <table className="w-full text-left text-[9px] font-mono text-slate-300 border-collapse">
                    <thead className="bg-slate-900 text-[8px] uppercase tracking-wider text-slate-400 sticky top-0">
                      <tr>
                        <th className="p-1.5 border-b border-slate-800">ITEM ID</th>
                        <th className="p-1.5 border-b border-slate-800">DISPLAY NAME</th>
                        <th className="p-1.5 border-b border-slate-800">TIER</th>
                        <th className="p-1.5 border-b border-slate-800">WEIGHT</th>
                        <th className="p-1.5 border-b border-slate-800">ARMOR</th>
                        <th className="p-1.5 border-b border-slate-800">MOVE</th>
                        <th className="p-1.5 border-b border-slate-800">COST</th>
                        <th className="p-1.5 border-b border-slate-800 text-right">OWNED</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {Object.keys(ARMOR_ITEMS).map((id) => {
                        const a = getArmorStats(id);
                        const owned = (save?.inventory || {})[id] || 0;
                        const cost = getTierCost(a.tier);
                        return (
                          <tr key={id} className="hover:bg-slate-800/30">
                            <td className="p-1.5 text-cyan-400 font-bold">{id}</td>
                            <td className="p-1.5 text-slate-200">{a.name}</td>
                            <td className="p-1.5 font-bold">
                              <span className={a.tier === 3 ? 'text-emerald-400' : a.tier === 2 ? 'text-fuchsia-400' : a.tier === 1 ? 'text-cyan-400' : 'text-slate-400'}>
                                Tier {a.tier}
                              </span>
                            </td>
                            <td className="p-1.5 capitalize text-slate-400">{a.weightClass}</td>
                            <td className="p-1.5 text-blue-300">{a.armor} Armor</td>
                            <td className="p-1.5 text-slate-400">{a.movementModifier >= 0 ? `+${a.movementModifier}` : a.movementModifier}</td>
                            <td className="p-1.5 text-slate-400 font-mono text-[8px]">{cost.credits}cr{cost.alienMaterials ? ` ${cost.alienMaterials}am` : ''}{cost.powerCores ? ` ${cost.powerCores}core` : ''}{cost.nanoCubes ? ` ${cost.nanoCubes}cube` : ''}</td>
                            <td className="p-1.5 text-right font-bold text-slate-300">{owned}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CHARACTERS & LEVELS */}
          {activeTab === 'characters' && (
            <div className="space-y-4">
              {/* Batch Actions Header */}
              <div className="rounded-lg border border-cyan-800/40 bg-slate-900/60 p-3 space-y-2">
                <div className="text-[10px] font-bold text-cyan-300 uppercase tracking-wider flex items-center justify-between">
                  <span>Squad-Wide Actions ({soldiers.length} Soldiers)</span>
                  <button
                    type="button"
                    onClick={handleRestoreTestRoster}
                    className="text-[9px] text-slate-400 hover:text-white underline font-mono"
                  >
                    Restore Test Roster
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleLevelAll(MAX_LEVEL)}
                    className="px-2 py-1.5 bg-amber-950/70 border border-amber-700/60 hover:bg-amber-900 text-amber-300 rounded text-[9px] font-bold uppercase tracking-wider active:scale-95 flex items-center justify-center gap-1"
                  >
                    <ArrowUpCircle className="w-3 h-3" /> All Level 20
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLevelAll(1)}
                    className="px-2 py-1.5 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 rounded text-[9px] font-bold uppercase tracking-wider active:scale-95 flex items-center justify-center gap-1"
                  >
                    <RotateCw className="w-3 h-3" /> All Level 1
                  </button>
                  <button
                    type="button"
                    onClick={handleHealAll}
                    className="px-2 py-1.5 bg-emerald-950/70 border border-emerald-700/60 hover:bg-emerald-900 text-emerald-300 rounded text-[9px] font-bold uppercase tracking-wider active:scale-95 flex items-center justify-center gap-1"
                  >
                    <Heart className="w-3 h-3" /> Heal Entire Squad
                  </button>
                  <button
                    type="button"
                    onClick={handleInjureAll}
                    className="px-2 py-1.5 bg-rose-950/70 border border-rose-700/60 hover:bg-rose-900 text-rose-300 rounded text-[9px] font-bold uppercase tracking-wider active:scale-95 flex items-center justify-center gap-1"
                  >
                    <HeartCrack className="w-3 h-3" /> Injure Entire Squad
                  </button>
                </div>

                {/* Recruit New Soldier */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between flex-wrap gap-1">
                  <span className="text-[9px] text-slate-400 uppercase font-bold">Recruit New Soldier:</span>
                  <div className="flex gap-1">
                    {PLAYER_CLASSES.map((cls) => (
                      <button
                        key={`rec_${cls}`}
                        type="button"
                        onClick={() => handleRecruit(cls)}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-[8px] font-bold uppercase tracking-wider active:scale-95"
                      >
                        + {cls}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Per-Soldier Comprehensive Cards */}
              <div className="space-y-3">
                {soldiers.map((s) => {
                  const reqXp = xpForNextLevel(s.level);
                  const maxHp = getEffectiveMaxHp(s);
                  const availableSp = getAvailableSelections(s);
                  const totalSp = totalSkillPointsByLevel(s.level);

                  return (
                    <div key={s.id} className="rounded-lg border border-slate-700/80 bg-slate-900/80 p-3 space-y-2.5">
                      {/* Soldier Identity Header */}
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleSoldierInjured(s.id, s.injured)}
                            className={`p-1 rounded text-[9px] font-bold flex items-center gap-1 border ${
                              s.injured
                                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                                : 'bg-rose-950/80 text-rose-300 border-rose-700'
                            }`}
                          >
                            {s.injured ? <Heart className="w-3 h-3" /> : <HeartCrack className="w-3 h-3" />}
                            {s.injured ? 'HEAL' : 'INJURE'}
                          </button>
                          <div>
                            <div className="text-white font-bold text-xs flex items-center gap-1.5">
                              <span>{s.name}</span>
                              <span className="text-[9px] px-1.5 py-0.2 rounded uppercase bg-slate-800 text-cyan-300 border border-slate-700 font-mono">
                                {s.class || s.archetype}
                              </span>
                              {s.injured && (
                                <span className="text-[8px] font-bold px-1 bg-rose-950 text-rose-300 border border-rose-800 rounded">
                                  INJURED
                                </span>
                              )}
                            </div>
                            <div className="text-[9px] text-slate-400 font-mono">
                              HP: {s.current_hp}/{maxHp} · Level {s.level}/{MAX_LEVEL} · XP: {s.xp}/{reqXp === Infinity ? 'MAX' : reqXp} · SP: {availableSp}/{totalSp}
                            </div>
                          </div>
                        </div>

                        {/* Fast Actions: Free Respec & Class Change */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleRespecSoldier(s.id)}
                            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 text-[8px] font-bold uppercase active:scale-95"
                          >
                            Free Respec
                          </button>
                          {soldiers.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleDismissSoldier(s.id)}
                              className="p-1 rounded bg-slate-900 hover:bg-rose-950 text-slate-500 hover:text-rose-400 border border-slate-800"
                              title="Dismiss soldier"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Level Controls (1..20) */}
                      <div className="space-y-1.5 bg-slate-950/60 p-2 rounded border border-slate-800">
                        <div className="flex items-center justify-between text-[9px] font-bold uppercase text-slate-400">
                          <span>Set Level (1 to {MAX_LEVEL}):</span>
                          <div className="flex items-center gap-1 font-mono">
                            <button
                              type="button"
                              onClick={() => handleSetSoldierLevel(s.id, Math.max(1, s.level - 1))}
                              disabled={s.level <= 1}
                              className="px-1.5 py-0.5 rounded bg-slate-800 disabled:opacity-40 text-white font-bold"
                            >
                              -1
                            </button>
                            <span className="text-amber-300 font-bold px-1">Lv {s.level}</span>
                            <button
                              type="button"
                              onClick={() => handleSetSoldierLevel(s.id, Math.min(MAX_LEVEL, s.level + 1))}
                              disabled={s.level >= MAX_LEVEL}
                              className="px-1.5 py-0.5 rounded bg-slate-800 disabled:opacity-40 text-white font-bold"
                            >
                              +1
                            </button>
                          </div>
                        </div>

                        {/* Direct Level Presets (complete range) */}
                        <div className="flex flex-wrap gap-1">
                          {[1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20].map((lvl) => (
                            <button
                              key={`sl_${s.id}_${lvl}`}
                              type="button"
                              onClick={() => handleSetSoldierLevel(s.id, lvl)}
                              className={`px-1.5 py-0.5 rounded text-[8px] font-bold font-mono active:scale-95 transition ${
                                s.level === lvl
                                  ? 'bg-amber-500 text-slate-950 border border-amber-300'
                                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                              }`}
                            >
                              {lvl}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* XP Manipulation */}
                      <div className="flex items-center justify-between flex-wrap gap-1 text-[8px]">
                        <span className="text-slate-400 uppercase font-bold">XP Controls:</span>
                        <div className="flex gap-1 font-mono">
                          <button
                            type="button"
                            onClick={() => handleGrantSoldierXp(s.id, 1)}
                            className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-200 border border-slate-700 active:scale-95"
                          >
                            +1 XP
                          </button>
                          <button
                            type="button"
                            onClick={() => handleGrantSoldierXp(s.id, 5)}
                            className="px-1.5 py-0.5 bg-sky-950/70 border border-sky-700 text-sky-300 rounded active:scale-95 font-bold"
                          >
                            +5 XP
                          </button>
                          <button
                            type="button"
                            onClick={() => handleGrantSoldierXp(s.id, 10)}
                            className="px-1.5 py-0.5 bg-sky-950/70 border border-sky-700 text-sky-300 rounded active:scale-95 font-bold"
                          >
                            +10 XP
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFillXpToLevel(s)}
                            disabled={s.level >= MAX_LEVEL}
                            className="px-2 py-0.5 bg-amber-950/70 border border-amber-700 text-amber-300 rounded active:scale-95 font-bold uppercase disabled:opacity-40"
                          >
                            Fill to Level Up
                          </button>
                        </div>
                      </div>

                      {/* Class Switcher */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[8px]">
                        <span className="text-slate-500 uppercase font-bold">Switch Class:</span>
                        <div className="flex gap-1">
                          {PLAYER_CLASSES.map((cls) => (
                            <button
                              key={`cls_${s.id}_${cls}`}
                              type="button"
                              onClick={() => handleChangeClass(s.id, cls)}
                              disabled={(s.class || s.archetype) === cls}
                              className={`px-1.5 py-0.5 rounded uppercase font-bold tracking-wider ${
                                (s.class || s.archetype) === cls
                                  ? 'bg-cyan-900 text-cyan-200 border border-cyan-600'
                                  : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700'
                              }`}
                            >
                              {cls}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: GAME MODES & CHAPTERS */}
          {activeTab === 'modes' && (
            <div className="space-y-4">
              {/* Campaign Global Macro */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleUnlockAllChapters}
                  className="px-3 py-2 rounded-lg bg-emerald-950/70 border border-emerald-600/70 hover:bg-emerald-900 text-emerald-200 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <Award className="w-3.5 h-3.5" /> Unlock All Chapters &amp; Bosses
                </button>
                <button
                  type="button"
                  onClick={handleResetCampaign}
                  className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 hover:bg-rose-950 text-slate-400 hover:text-rose-300 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <RotateCw className="w-3.5 h-3.5" /> Reset Campaign Progress
                </button>
              </div>

              {/* Direct Game Mode Launchers */}
              <div className="rounded-lg border border-cyan-700/60 bg-slate-900/60 p-3 space-y-2">
                <div className="text-[10px] font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5 text-cyan-400" />
                  Instant Game Mode Launchers (Direct to Battle)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleLaunchMission('D')}
                    className="p-2 rounded bg-amber-950/60 border border-amber-700/60 hover:bg-amber-900/80 text-amber-200 text-left active:scale-95 transition"
                  >
                    <div className="text-[10px] font-bold uppercase">Sabotage / Device Capture Mode</div>
                    <div className="text-[8px] text-slate-400">Mission D · Capture/Sabotage Objective Device</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleLaunchMission('C')}
                    className="p-2 rounded bg-sky-950/60 border border-sky-700/60 hover:bg-sky-900/80 text-sky-200 text-left active:scale-95 transition"
                  >
                    <div className="text-[10px] font-bold uppercase">Civilian Rescue Mode</div>
                    <div className="text-[8px] text-slate-400">Mission C · Escort &amp; Rescue Civilian</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleLaunchMission('B')}
                    className="p-2 rounded bg-emerald-950/60 border border-emerald-700/60 hover:bg-emerald-900/80 text-emerald-200 text-left active:scale-95 transition"
                  >
                    <div className="text-[10px] font-bold uppercase">Extraction Mode</div>
                    <div className="text-[8px] text-slate-400">Mission B · Navigate to Extraction Zone</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleLaunchMission('A')}
                    className="p-2 rounded bg-rose-950/60 border border-rose-700/60 hover:bg-rose-900/80 text-rose-200 text-left active:scale-95 transition"
                  >
                    <div className="text-[10px] font-bold uppercase">Elimination Mode</div>
                    <div className="text-[8px] text-slate-400">Mission A · Clean Sweep all hostile forces</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleLaunchMission('chapter1_boss')}
                    className="p-2 rounded bg-fuchsia-950/60 border border-fuchsia-700/60 hover:bg-fuchsia-900/80 text-fuchsia-200 text-left active:scale-95 transition"
                  >
                    <div className="text-[10px] font-bold uppercase">Boss 1: Warden Prime</div>
                    <div className="text-[8px] text-slate-400">Handcrafted Alien Command Nexus</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleLaunchMission('ch2_boss')}
                    className="p-2 rounded bg-violet-950/60 border border-violet-700/60 hover:bg-violet-900/80 text-violet-200 text-left active:scale-95 transition"
                  >
                    <div className="text-[10px] font-bold uppercase">Boss 2: The Harvester</div>
                    <div className="text-[8px] text-slate-400">Handcrafted Harvester Pit (Phases 1-3)</div>
                  </button>
                </div>
              </div>

              {/* Chapters 1, 2, 3 Controls */}
              {['ch1', 'ch2', 'ch3'].map((chId) => {
                const chState = save?.chapters?.[chId] || {};
                const name = chId === 'ch1' ? 'Chapter 1: The Frontier' : chId === 'ch2' ? 'Chapter 2: The Harvester' : 'Chapter 3: Deep Sector';
                return (
                  <div key={chId} className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-white uppercase">
                      <span>{name} ({chId.toUpperCase()})</span>
                      <span className="text-[9px] font-mono text-slate-400">
                        {chState.unlocked ? (
                          <span className="text-emerald-400">UNLOCKED ({chState.chapterProgressPercent || 0}%)</span>
                        ) : (
                          <span className="text-slate-500">LOCKED</span>
                        )}
                        {chState.bossUnlocked && ' · BOSS UNLOCKED'}
                        {chState.bossDefeated && ' · DEFEATED'}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {chState.unlocked ? (
                        <button
                          type="button"
                          onClick={() => handleLockChapter(chId)}
                          disabled={chId === 'ch1'}
                          className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-rose-300 border border-slate-700 text-[8px] font-bold uppercase disabled:opacity-40"
                        >
                          Lock Chapter
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleUnlockChapter(chId)}
                          className="px-2 py-0.5 rounded bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 border border-emerald-700 text-[8px] font-bold uppercase"
                        >
                          Unlock Chapter
                        </button>
                      )}

                      {[0, 25, 50, 75, 100].map((pct) => (
                        <button
                          key={`${chId}_p_${pct}`}
                          type="button"
                          onClick={() => handleSetChapterPercent(chId, pct)}
                          className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[8px] font-bold font-mono border border-slate-700 active:scale-95"
                        >
                          {pct}%
                        </button>
                      ))}

                      <button
                        type="button"
                        onClick={() => handleUnlockBoss(chId)}
                        className="px-2 py-0.5 rounded bg-fuchsia-950/70 hover:bg-fuchsia-900 text-fuchsia-300 border border-fuchsia-700 text-[8px] font-bold uppercase active:scale-95"
                      >
                        Unlock Boss
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDefeatBoss(chId)}
                        className="px-2 py-0.5 rounded bg-amber-950/70 hover:bg-amber-900 text-amber-300 border border-amber-700 text-[8px] font-bold uppercase active:scale-95"
                      >
                        Mark Defeated
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResetChapter(chId)}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700 text-[8px] font-bold uppercase active:scale-95"
                      >
                        Reset Ch
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 4: COMMANDER & SQUAD */}
          {activeTab === 'commander' && (
            <div className="space-y-3">
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-amber-300 uppercase">
                  <div className="flex items-center gap-1.5">
                    <Crown className="w-4 h-4" /> Commander State
                  </div>
                  <span className={save?.commander?.unlocked ? 'text-emerald-400' : 'text-slate-500'}>
                    {save?.commander?.unlocked ? 'UNLOCKED' : 'LOCKED'}
                  </span>
                </div>

                <div className="text-[9px] font-mono text-slate-400 bg-slate-950 p-2 rounded border border-slate-800 leading-relaxed">
                  <div>Unlocked Skills: {JSON.stringify(save?.commander?.unlockedSkillIds || [])}</div>
                  <div>Credits Available: <strong className="text-amber-300">{save?.credits ?? 0}</strong></div>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => handleToggleCommander(!save?.commander?.unlocked)}
                    className="px-2.5 py-1 rounded bg-amber-950/70 hover:bg-amber-900 text-amber-200 border border-amber-700 text-[9px] font-bold uppercase active:scale-95"
                  >
                    {save?.commander?.unlocked ? 'Lock Commander' : 'Unlock Commander'}
                  </button>
                  <button
                    type="button"
                    onClick={handleUnlockAllCommanderSkills}
                    className="px-2.5 py-1 rounded bg-cyan-950/70 hover:bg-cyan-900 text-cyan-200 border border-cyan-700 text-[9px] font-bold uppercase active:scale-95"
                  >
                    Unlock All Skills
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetCredits(0)}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[9px] font-bold uppercase active:scale-95"
                  >
                    Set Credits 0
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetCredits(100)}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[9px] font-bold uppercase active:scale-95"
                  >
                    Set Credits 100
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: ENEMY COMPOSITION */}
          {activeTab === 'composition' && (
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
              <CompositionDebugPanel />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-4 py-2.5 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <span className="text-[9px] text-slate-500 font-mono">
            Debug updates persist automatically to active slot.
          </span>
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-1.5 rounded-lg border border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold tracking-wide uppercase active:scale-95 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
