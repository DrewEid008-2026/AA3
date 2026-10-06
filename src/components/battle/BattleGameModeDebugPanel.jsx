import React, { useState } from 'react';
import { Target, Flag, Shield, Zap, Skull, Heart, RotateCcw, Award, Play, AlertOctagon, UserCheck, Flame } from 'lucide-react';
import { TEAMS, MISSION_STATES } from '@/game/constants';
import { applyShield } from '@/game/shield';
import { spawnReinforcementWave, spawnEliteSquad } from '@/game/reinforcements';
import { STANDARD_REINFORCEMENT_WAVE } from '@/game/missions';

const ELITE_SQUAD = [
  { archetype: 'grunt' },
  { archetype: 'grunt' },
  { archetype: 'stalker' },
];

// In-battle comprehensive Game Mode, Capture Objectives, and Battle Resources Debug Panel.
// Only visible when debug=true. Provides instant testing for capturing objectives,
// mission modes (Sabotage, Rescue, Extraction, Elimination, Boss), AP/Ammo/Health/Armor
// resources, and unit status manipulation.
export default function BattleGameModeDebugPanel({
  missionConfig,
  missionRuntime,
  setMissionRuntime,
  device,
  setDevice,
  civilian,
  setCivilian,
  extractionZone,
  extractedIds,
  setExtractedIds,
  units,
  setUnits,
  selectedUnit,
  phase,
  setPhase,
  turn,
  setTurn,
  mapConfig,
  grid,
  setShowPostChoice,
}) {
  const [collapsed, setCollapsed] = useState(true);
  const [activeTab, setActiveTab] = useState('modes'); // 'modes' | 'resources' | 'unit'

  const players = units.filter((u) => u.team === TEAMS.PLAYER);
  const livingPlayers = players.filter((u) => u.alive && !u.downed);
  const enemies = units.filter((u) => u.team === TEAMS.ENEMY);
  const livingEnemies = enemies.filter((u) => u.alive);

  // --- Objective & Mode Actions ---
  const handleToggleSabotage = () => {
    if (!setDevice) return;
    setDevice((prev) => (prev ? { ...prev, sabotaged: !prev.sabotaged } : prev));
  };

  const handleToggleRescue = () => {
    if (!setCivilian) return;
    setCivilian((prev) => (prev ? { ...prev, rescued: !prev.rescued, safe: !prev.safe } : prev));
  };

  const handleExtractSelected = () => {
    if (!selectedUnit || !setExtractedIds) return;
    setExtractedIds((prev) => {
      const next = new Set(prev);
      if (next.has(selectedUnit.id)) next.delete(selectedUnit.id);
      else next.add(selectedUnit.id);
      return next;
    });
  };

  const handleExtractAllPlayers = () => {
    if (!setExtractedIds) return;
    const allLivingIds = livingPlayers.map((u) => u.id);
    setExtractedIds(new Set(allLivingIds));
  };

  const handleKillAllEnemies = () => {
    if (!setUnits) return;
    setUnits((prev) =>
      prev.map((u) => (u.team === TEAMS.ENEMY ? { ...u, alive: false, hp: 0 } : u))
    );
  };

  const handleInstantWin = () => {
    if (!setMissionRuntime) return;
    if (missionConfig?.isBoss || missionConfig?.isTutorial) {
      setMissionRuntime((prev) => ({
        ...prev,
        state: MISSION_STATES.COMPLETE,
        baseRewardSecured: true,
        reinforcementCanceled: true,
      }));
    } else {
      setMissionRuntime((prev) => ({
        ...prev,
        state: MISSION_STATES.OBJECTIVE_SECURED,
        baseRewardSecured: true,
        reinforcementCanceled: true,
      }));
      if (setShowPostChoice) setShowPostChoice(true);
    }
  };

  const handleInstantFail = () => {
    if (!setMissionRuntime) return;
    setMissionRuntime((prev) => ({
      ...prev,
      state: MISSION_STATES.PRIMARY_FAILED,
    }));
  };

  const handleSpawnReinforcements = () => {
    if (!mapConfig || !grid || !setUnits || !setMissionRuntime) return;
    const spawns = mapConfig.reinforcementSpawns || [];
    const newEnemies = spawnReinforcementWave(
      grid,
      units,
      STANDARD_REINFORCEMENT_WAVE,
      spawns,
      { device, civilian }
    );
    if (newEnemies.length > 0) {
      setUnits((prev) => [...prev, ...newEnemies]);
      setMissionRuntime((prev) => ({
        ...prev,
        reinforcementCountdown: 0,
        standardReinforcementSpawned: true,
      }));
    }
  };

  const handleSpawnElite = () => {
    if (!mapConfig || !grid || !setUnits || !setMissionRuntime) return;
    const spawns = mapConfig.eliteSpawns || mapConfig.reinforcementSpawns || [];
    const newElites = spawnEliteSquad(grid, units, ELITE_SQUAD, spawns, { device, civilian });
    if (newElites.length > 0) {
      setUnits((prev) => [...prev, ...newElites]);
      setMissionRuntime((prev) => ({
        ...prev,
        state: MISSION_STATES.ELITE_RESPONSE_ACTIVE,
        eliteResponseSpawned: true,
        eliteResponseAccepted: true,
      }));
    }
  };

  // --- Battle Resources Actions ---
  const handleRefillAllAp = () => {
    if (!setUnits) return;
    setUnits((prev) =>
      prev.map((u) => (u.team === TEAMS.PLAYER && u.alive ? { ...u, ap: u.maxAp } : u))
    );
  };

  const handleRefillAllAmmo = () => {
    if (!setUnits) return;
    setUnits((prev) =>
      prev.map((u) => (u.team === TEAMS.PLAYER && u.alive ? { ...u, ammo: u.maxAmmo } : u))
    );
  };

  const handleResetAllCooldowns = () => {
    if (!setUnits) return;
    setUnits((prev) =>
      prev.map((u) => (u.team === TEAMS.PLAYER && u.alive ? { ...u, cooldowns: {} } : u))
    );
  };

  const handleHealSquad = () => {
    if (!setUnits) return;
    setUnits((prev) =>
      prev.map((u) =>
        u.team === TEAMS.PLAYER ? { ...u, alive: true, downed: false, hp: u.maxHp } : u
      )
    );
  };

  const handleMaxDefenses = () => {
    if (!setUnits) return;
    setUnits((prev) =>
      prev.map((u) => {
        if (u.team !== TEAMS.PLAYER || !u.alive) return u;
        const withShield = applyShield(u, 4);
        return {
          ...withShield,
          currentArmor: Math.max(withShield.currentArmor || 0, 2),
          armor: Math.max(withShield.armor || 0, 2),
        };
      })
    );
  };

  // --- Selected Unit Actions ---
  const handleModifyUnitHp = (delta) => {
    if (!selectedUnit || !setUnits) return;
    setUnits((prev) =>
      prev.map((u) => {
        if (u.id !== selectedUnit.id) return u;
        const nextHp = Math.max(0, Math.min(u.maxHp, (u.hp || 0) + delta));
        const isDead = nextHp === 0;
        const isDowned = isDead && u.team === TEAMS.PLAYER;
        return {
          ...u,
          hp: nextHp,
          alive: isDowned ? true : !isDead,
          downed: isDowned,
        };
      })
    );
  };

  const handleToggleDownOrKill = () => {
    if (!selectedUnit || !setUnits) return;
    setUnits((prev) =>
      prev.map((u) => {
        if (u.id !== selectedUnit.id) return u;
        if (u.team === TEAMS.PLAYER) {
          return {
            ...u,
            downed: !u.downed,
            hp: u.downed ? u.maxHp : 0,
          };
        }
        return {
          ...u,
          alive: !u.alive,
          hp: u.alive ? 0 : u.maxHp,
        };
      })
    );
  };

  const handleTogglePhase = () => {
    if (!setPhase) return;
    setPhase((p) => (p === 'player' ? 'enemy' : 'player'));
  };

  const handleAdvanceRound = () => {
    if (!setTurn) return;
    setTurn((t) => t + 1);
  };

  return (
    <div className="absolute right-3 top-16 z-40 text-[9px] font-mono bg-slate-950/95 border border-cyan-500/70 rounded-md p-2 max-w-[280px] shadow-2xl text-slate-200 pointer-events-auto">
      {/* Header with Collapsible Toggle */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-700/80 pb-1 mb-1.5">
        <div className="flex items-center gap-1 font-bold text-cyan-300 uppercase tracking-wide">
          <Target className="w-3 h-3 text-cyan-400" />
          Battle Debug Tools
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="text-cyan-400 hover:text-white px-1 text-[8px] bg-slate-800 border border-slate-700 rounded"
        >
          {collapsed ? 'EXPAND' : 'HIDE'}
        </button>
      </div>

      {!collapsed && (
        <div className="flex flex-col gap-2">
          {/* Navigation Tabs */}
          <div className="flex gap-1 border-b border-slate-800 pb-1 text-[8px]">
            <button
              type="button"
              onClick={() => setActiveTab('modes')}
              className={`flex-1 py-0.5 rounded font-bold uppercase ${
                activeTab === 'modes' ? 'bg-cyan-700 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              Mode &amp; Obj
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('resources')}
              className={`flex-1 py-0.5 rounded font-bold uppercase ${
                activeTab === 'resources' ? 'bg-cyan-700 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              Resources
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('unit')}
              className={`flex-1 py-0.5 rounded font-bold uppercase ${
                activeTab === 'unit' ? 'bg-cyan-700 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              Unit ({selectedUnit ? selectedUnit.name.split(' ')[0] : 'None'})
            </button>
          </div>

          {/* TAB 1: MODES & OBJECTIVES */}
          {activeTab === 'modes' && (
            <div className="flex flex-col gap-1.5">
              <div className="text-[8px] text-slate-400">
                Mode: <span className="text-cyan-300 font-bold uppercase">{missionConfig?.type || 'Standard'}</span> · State: <span className="text-amber-300">{missionRuntime?.state}</span>
              </div>

              {/* Sabotage / Capture Game Mode */}
              {device && (
                <div className="bg-slate-900/80 border border-slate-800 rounded p-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-1 text-[8px]">
                    <Flag className="w-3 h-3 text-amber-400" />
                    <span>Device Sabotage:</span>
                    <span className={device.sabotaged ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                      {device.sabotaged ? 'CAPTURED' : 'ACTIVE'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleSabotage}
                    className="px-1.5 py-0.5 bg-amber-600/60 hover:bg-amber-500/80 text-white rounded text-[8px] active:scale-95"
                  >
                    {device.sabotaged ? 'Reset' : 'Capture/Sabotage'}
                  </button>
                </div>
              )}

              {/* Rescue Game Mode */}
              {civilian && (
                <div className="bg-slate-900/80 border border-slate-800 rounded p-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-1 text-[8px]">
                    <UserCheck className="w-3 h-3 text-sky-400" />
                    <span>Civilian Status:</span>
                    <span className={civilian.rescued ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                      {civilian.rescued ? 'RESCUED' : 'WAITING'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleRescue}
                    className="px-1.5 py-0.5 bg-sky-600/60 hover:bg-sky-500/80 text-white rounded text-[8px] active:scale-95"
                  >
                    {civilian.rescued ? 'Reset' : 'Rescue Civilian'}
                  </button>
                </div>
              )}

              {/* Extraction Game Mode */}
              {extractionZone && (
                <div className="bg-slate-900/80 border border-slate-800 rounded p-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-1 text-[8px]">
                    <Play className="w-3 h-3 text-emerald-400" />
                    <span>Extracted: {extractedIds?.size || 0}/{livingPlayers.length}</span>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={handleExtractSelected}
                      disabled={!selectedUnit}
                      className="px-1 py-0.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white rounded text-[8px] active:scale-95"
                    >
                      Extract Sel
                    </button>
                    <button
                      type="button"
                      onClick={handleExtractAllPlayers}
                      className="px-1 py-0.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-[8px] active:scale-95"
                    >
                      Extract All
                    </button>
                  </div>
                </div>
              )}

              {/* Elimination & Wave Controls */}
              <div className="grid grid-cols-2 gap-1 mt-0.5">
                <button
                  type="button"
                  onClick={handleKillAllEnemies}
                  className="px-1.5 py-1 rounded bg-rose-950/70 border border-rose-700/60 hover:bg-rose-900 text-rose-200 text-[8px] flex items-center justify-center gap-1 active:scale-95"
                >
                  <Skull className="w-2.5 h-2.5" /> Wipe Enemies ({livingEnemies.length})
                </button>
                <button
                  type="button"
                  onClick={handleInstantWin}
                  className="px-1.5 py-1 rounded bg-emerald-950/70 border border-emerald-700/60 hover:bg-emerald-900 text-emerald-200 text-[8px] flex items-center justify-center gap-1 active:scale-95"
                >
                  <Award className="w-2.5 h-2.5" /> Instant Win
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={handleSpawnReinforcements}
                  className="px-1.5 py-1 rounded bg-amber-950/70 border border-amber-700/60 hover:bg-amber-900 text-amber-200 text-[8px] flex items-center justify-center gap-1 active:scale-95"
                >
                  <Zap className="w-2.5 h-2.5" /> Force Reinforce
                </button>
                <button
                  type="button"
                  onClick={handleSpawnElite}
                  className="px-1.5 py-1 rounded bg-fuchsia-950/70 border border-fuchsia-700/60 hover:bg-fuchsia-900 text-fuchsia-200 text-[8px] flex items-center justify-center gap-1 active:scale-95"
                >
                  <Flame className="w-2.5 h-2.5" /> Force Elite Wave
                </button>
              </div>

              <button
                type="button"
                onClick={handleInstantFail}
                className="w-full px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 hover:bg-rose-950 text-slate-400 hover:text-rose-300 text-[8px] flex items-center justify-center gap-1 active:scale-95"
              >
                <AlertOctagon className="w-2.5 h-2.5" /> Trigger Mission Failure
              </button>
            </div>
          )}

          {/* TAB 2: SQUAD BATTLE RESOURCES */}
          {activeTab === 'resources' && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[8px] uppercase tracking-wider text-slate-400 font-bold">Squad-Wide Resource Refills</span>
              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={handleRefillAllAp}
                  className="px-1.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-cyan-700/50 text-cyan-300 text-[8px] flex items-center justify-center gap-1 active:scale-95"
                >
                  <Zap className="w-2.5 h-2.5" /> Refill All AP (2)
                </button>
                <button
                  type="button"
                  onClick={handleRefillAllAmmo}
                  className="px-1.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-amber-700/50 text-amber-300 text-[8px] flex items-center justify-center gap-1 active:scale-95"
                >
                  <RotateCcw className="w-2.5 h-2.5" /> Max Ammo (All)
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={handleResetAllCooldowns}
                  className="px-1.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-fuchsia-700/50 text-fuchsia-300 text-[8px] flex items-center justify-center gap-1 active:scale-95"
                >
                  <RotateCcw className="w-2.5 h-2.5" /> Clear Cooldowns
                </button>
                <button
                  type="button"
                  onClick={handleHealSquad}
                  className="px-1.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-emerald-700/50 text-emerald-300 text-[8px] flex items-center justify-center gap-1 active:scale-95"
                >
                  <Heart className="w-2.5 h-2.5" /> Full Heal Squad
                </button>
              </div>

              <button
                type="button"
                onClick={handleMaxDefenses}
                className="w-full px-1.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-sky-600/60 text-sky-200 text-[8px] flex items-center justify-center gap-1 active:scale-95"
              >
                <Shield className="w-2.5 h-2.5" /> Grant Energy Shield (+4) &amp; Armor (+2)
              </button>

              <div className="border-t border-slate-800 pt-1 flex items-center justify-between text-[8px]">
                <span>Phase: <strong className="uppercase text-amber-300">{phase}</strong></span>
                <button
                  type="button"
                  onClick={handleTogglePhase}
                  className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 active:scale-95"
                >
                  Switch Phase
                </button>
                <span>Round: <strong className="text-cyan-300">{turn}</strong></span>
                <button
                  type="button"
                  onClick={handleAdvanceRound}
                  className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 active:scale-95"
                >
                  +1 Round
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: SELECTED UNIT MANIPULATION */}
          {activeTab === 'unit' && (
            <div className="flex flex-col gap-1.5">
              {selectedUnit ? (
                <>
                  <div className="bg-slate-900/90 border border-slate-800 rounded p-1.5 text-[8px] flex flex-col gap-0.5">
                    <div className="flex justify-between font-bold text-white">
                      <span>{selectedUnit.name}</span>
                      <span className="uppercase text-slate-400">{selectedUnit.team} · {selectedUnit.archetype || selectedUnit.class}</span>
                    </div>
                    <div>HP: {selectedUnit.hp}/{selectedUnit.maxHp} · AP: {selectedUnit.ap}/{selectedUnit.maxAp} · Armor: {selectedUnit.armor || 0}</div>
                    {selectedUnit.downed && <div className="text-rose-400 font-bold">STATUS: DOWNED</div>}
                  </div>

                  <div className="grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      onClick={() => handleModifyUnitHp(2)}
                      className="px-1.5 py-0.5 bg-emerald-950/70 border border-emerald-700 text-emerald-300 rounded text-[8px] active:scale-95"
                    >
                      +2 HP
                    </button>
                    <button
                      type="button"
                      onClick={() => handleModifyUnitHp(-2)}
                      className="px-1.5 py-0.5 bg-rose-950/70 border border-rose-700 text-rose-300 rounded text-[8px] active:scale-95"
                    >
                      -2 HP (Damage)
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleToggleDownOrKill}
                    className="w-full px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 rounded text-[8px] active:scale-95"
                  >
                    Toggle {selectedUnit.team === TEAMS.PLAYER ? 'Downed / Revived' : 'Kill / Revive'}
                  </button>
                </>
              ) : (
                <div className="text-slate-500 text-[8px] py-3 text-center">
                  Select a unit on the battlefield to inspect &amp; modify its stats.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
