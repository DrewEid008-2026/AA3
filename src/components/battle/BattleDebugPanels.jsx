import React, { useState } from 'react';
import {
  Bug, ChevronDown, ChevronUp, Target, Zap, User, AlertTriangle, Activity,
  Flag, Play, Skull, Award, AlertOctagon, UserCheck, Flame, RotateCcw, Heart, Shield,
  RefreshCw, MapPin, Pickaxe, BrickWall, Eye, EyeOff
} from 'lucide-react';
import { TEAMS, MISSION_STATES, TILE_TYPES } from '@/game/constants';
import { getUnitWeapon, computeDamage, COVER_STATE_LABELS } from '@/game/combat';
import { getAmmo, getMaxAmmo } from '@/game/ammo';
import { getMovementRange } from '@/game/pathfinding';
import { isInOverwatch } from '@/game/reactions';
import { applyShield } from '@/game/shield';
import { spawnReinforcementWave, spawnEliteSquad } from '@/game/reinforcements';
import { getReinforcementWaveForMission } from '@/game/missions';
import { isVolatileTile, setVolatile, VOLATILE_TILE_DAMAGE, predictHazardDamage } from '@/game/volatileTiles';
import { computeComeHerePull } from '@/game/comeHereResolver';
import { makePlayer, makeEnemy } from '@/game/units';
import HarvesterPitDevOverlay from './HarvesterPitDevOverlay';
import TerrainEdgeDebugPanel from './TerrainEdgeDebugPanel';

const ELITE_SQUAD = [
  { archetype: 'grunt' },
  { archetype: 'grunt' },
  { archetype: 'stalker' },
];

// Unified, mobile-first in-battle debug overlay.
// Consolidates modes, objectives, battle resources, unit inspection,
// hazards, map tools, and telemetry into a clean tabbed panel with vertical scrolling.
export default function BattleDebugPanels({
  debug,
  selectedUnit,
  reachable,
  lastAttack,
  attackMode,
  validTargets,
  grid,
  setGrid,
  lastEnemyDecision,
  lastReaction,
  missionRuntime,
  setMissionRuntime,
  missionConfig,
  missionId,
  units,
  setUnits,
  device,
  setDevice,
  civilian,
  setCivilian,
  extractionZone,
  extractedIds,
  setExtractedIds,
  phase,
  setPhase,
  turn,
  setTurn,
  mapConfig,
  setShowPostChoice,
  // Map tools
  compatibleMaps,
  onRegenerateMap,
  onForceMap,
  // Terrain utility tools
  onGrantWallCharge,
  onGrantInstaWall,
  onRestoreUses,
  showSiegeTiles,
  onToggleShowSiege,
  showInstaWallTiles,
  onToggleShowInstaWall,
  // Harvester boss tools
  isHarvesterMission,
  harvesterUnit,
  harvesterState,
  onSetBossHp,
  onSetBossArmor,
  onForceTremor,
  onForceBeam,
  onForcePhase2,
  onForcePhase3,
  edges,
  setEdges,
  selectedEdgeId,
  setSelectedEdgeId,
}) {
  const [minimized, setMinimized] = useState(false);
  const [activeTab, setActiveTab] = useState('modes'); // 'modes' | 'resources' | 'unit' | 'hazards' | 'edges' | 'telemetry'

  if (!debug) return null;

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
    const wave = getReinforcementWaveForMission(missionConfig);
    const newEnemies = spawnReinforcementWave(
      grid,
      units,
      wave,
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

  const handleAddUnitAp = (delta) => {
    if (!selectedUnit || !setUnits) return;
    setUnits((prev) =>
      prev.map((u) =>
        u.id === selectedUnit.id ? { ...u, ap: Math.max(0, Math.min(u.maxAp, (u.ap || 0) + delta)) } : u
      )
    );
  };

  // --- Hazard & Volatile Actions ---
  let volatileCount = 0;
  if (grid) {
    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < grid[y].length; x++) {
        if (isVolatileTile(grid[y][x])) volatileCount++;
      }
    }
  }

  const handleToggleSelectedTileVolatile = () => {
    if (!selectedUnit || !setGrid || !grid) return;
    const { x, y } = selectedUnit;
    const active = isVolatileTile(grid[y]?.[x]);
    const nextGrid = grid.map((row) => row.map((t) => ({ ...t })));
    setVolatile(nextGrid, x, y, !active);
    setGrid(nextGrid);
  };

  const handleSetupQaStrip = (soldierHp = 10) => {
    if (!setGrid || !setUnits || !grid) return;
    const testY = 6;
    const nextGrid = grid.map((row, y) =>
      row.map((t, x) => {
        const copy = { ...t };
        if (y === testY && x >= 1 && x <= 7) {
          copy.type = TILE_TYPES.OPEN;
          copy.cover = { n: null, s: null, e: null, w: null };
          if (x >= 3 && x <= 5) {
            copy.volatile = true;
            copy.terrain = 'volatile';
          } else {
            delete copy.volatile;
            copy.terrain = 'default';
          }
        }
        return copy;
      })
    );
    setGrid(nextGrid);

    const testSoldier = {
      ...makePlayer('assault', 1, testY),
      id: 'qa_soldier',
      name: `QA Operative (${soldierHp} HP)`,
      hp: soldierHp,
      maxHp: 10,
      currentArmor: 0,
      armor: 0,
      shield: 0,
      alive: true,
      downed: false,
    };
    const testDislocator = {
      ...makeEnemy('dislocator', 7, testY),
      id: 'qa_dislocator',
      name: 'QA Dislocator',
      hp: 12,
      maxHp: 12,
      ap: 2,
      maxAp: 2,
      alive: true,
      downed: false,
      cooldowns: { come_here: 0 },
    };

    const remainingUnits = units.filter((u) => u.y !== testY || u.x < 1 || u.x > 7);
    setUnits([...remainingUnits, testSoldier, testDislocator]);
  };

  const dislocator = units.find((u) => u.archetype === 'dislocator' && u.alive);
  const target = units.find((u) => u.team === TEAMS.PLAYER && u.alive && !u.downed);
  const pullInfo = dislocator && target && grid ? computeComeHerePull(grid, units, dislocator, target) : null;

  const w = selectedUnit ? getUnitWeapon(selectedUnit) : null;
  const am = selectedUnit ? getMaxAmmo(selectedUnit) : 0;
  const currentAmmo = selectedUnit ? getAmmo(selectedUnit) : 0;

  return (
    <>
      <HarvesterPitDevOverlay missionConfig={missionConfig} />

      {/* MINIMIZED FLOATING BUTTON: Compact pill on bottom-left, non-intrusive */}
      {minimized && (
        <button
          type="button"
          onClick={() => setMinimized(false)}
          className="fixed bottom-20 left-3 z-40 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-950/95 border border-cyan-500/80 text-cyan-300 text-[10px] font-bold uppercase shadow-2xl backdrop-blur-md active:scale-95 transition"
          aria-label="Open Debug Menu"
        >
          <Bug className="w-3.5 h-3.5 text-cyan-400" />
          <span>Debug Menu</span>
          <ChevronUp className="w-3 h-3 text-cyan-400" />
        </button>
      )}

      {/* EXPANDED TABBED DEBUG PANEL: Mobile-friendly sheet container */}
      {!minimized && (
        <div className="fixed top-12 left-2 right-2 sm:left-auto sm:right-3 bottom-20 sm:bottom-auto z-40 w-auto sm:w-[410px] sm:max-h-[76vh] flex flex-col rounded-xl border border-cyan-700/80 bg-slate-950/95 shadow-2xl backdrop-blur-md overflow-hidden text-slate-200 pointer-events-auto">
          {/* Header */}
          <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-slate-900/70">
            <div className="flex items-center gap-1.5">
              <Bug className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-bold text-xs text-cyan-300 uppercase tracking-wide">Battle Debug</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-amber-300 uppercase">
                {phase} · R{turn || 1}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setMinimized(true)}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
                title="Minimize Debug Menu"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Navigation Tabs at the top */}
          <div className="shrink-0 flex border-b border-slate-800 bg-slate-900/40 px-1 py-1 gap-1 overflow-x-auto text-[9px] font-bold uppercase tracking-wider scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveTab('modes')}
              className={`px-2 py-1 rounded flex items-center gap-1 whitespace-nowrap transition ${
                activeTab === 'modes' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Target className="w-3 h-3" /> Modes &amp; Obj
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('resources')}
              className={`px-2 py-1 rounded flex items-center gap-1 whitespace-nowrap transition ${
                activeTab === 'resources' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Zap className="w-3 h-3" /> Resources
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('unit')}
              className={`px-2 py-1 rounded flex items-center gap-1 whitespace-nowrap transition ${
                activeTab === 'unit' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <User className="w-3 h-3" /> Unit ({selectedUnit ? selectedUnit.name.split(' ')[0] : 'None'})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('hazards')}
              className={`px-2 py-1 rounded flex items-center gap-1 whitespace-nowrap transition ${
                activeTab === 'hazards' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <AlertTriangle className="w-3 h-3" /> Hazards &amp; Map
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('edges')}
              className={`px-2 py-1 rounded flex items-center gap-1 whitespace-nowrap transition ${
                activeTab === 'edges' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <BrickWall className="w-3 h-3 text-amber-400" /> Edges (3.6.1)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('telemetry')}
              className={`px-2 py-1 rounded flex items-center gap-1 whitespace-nowrap transition ${
                activeTab === 'telemetry' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Activity className="w-3 h-3" /> Telemetry
            </button>
          </div>

          {/* Scrollable Tab Content Body */}
          <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2.5 text-[9px] font-mono">
            {/* TAB 1: MODES & OBJECTIVES */}
            {activeTab === 'modes' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[8px] bg-slate-900/60 p-1.5 rounded border border-slate-800">
                  <span>Type: <strong className="text-cyan-300 uppercase">{missionConfig?.type || 'Standard'}</strong></span>
                  <span>State: <strong className="text-amber-300">{missionRuntime?.state}</strong></span>
                  <span>P/E: <strong className="text-white">{livingPlayers.length}/{livingEnemies.length}</strong></span>
                </div>

                {/* Device Sabotage / Capture */}
                {device && (
                  <div className="bg-slate-900/80 border border-slate-800 rounded p-2 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1 font-bold text-amber-300 uppercase">
                        <Flag className="w-3 h-3 text-amber-400" /> Device Sabotage Mode
                      </div>
                      <div className="text-[8px] text-slate-400">
                        At ({device.x},{device.y}) · Status: <span className={device.sabotaged ? 'text-emerald-400 font-bold' : 'text-slate-300'}>{device.sabotaged ? 'SABOTAGED / CAPTURED' : 'ACTIVE'}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleToggleSabotage}
                      className="px-2 py-1 bg-amber-600/70 hover:bg-amber-500 text-white rounded font-bold uppercase active:scale-95"
                    >
                      {device.sabotaged ? 'Reset' : 'Sabotage'}
                    </button>
                  </div>
                )}

                {/* Civilian Rescue */}
                {civilian && (
                  <div className="bg-slate-900/80 border border-slate-800 rounded p-2 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1 font-bold text-sky-300 uppercase">
                        <UserCheck className="w-3 h-3 text-sky-400" /> Civilian Rescue Mode
                      </div>
                      <div className="text-[8px] text-slate-400">
                        Status: <span className={civilian.rescued ? 'text-emerald-400 font-bold' : 'text-slate-300'}>{civilian.rescued ? 'RESCUED / SAFE' : 'WAITING'}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleToggleRescue}
                      className="px-2 py-1 bg-sky-600/70 hover:bg-sky-500 text-white rounded font-bold uppercase active:scale-95"
                    >
                      {civilian.rescued ? 'Reset' : 'Rescue'}
                    </button>
                  </div>
                )}

                {/* Extraction */}
                {extractionZone && (
                  <div className="bg-slate-900/80 border border-slate-800 rounded p-2 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1 font-bold text-emerald-300 uppercase">
                        <Play className="w-3 h-3 text-emerald-400" /> Extraction Mode
                      </div>
                      <div className="text-[8px] text-slate-400">
                        Extracted: {extractedIds?.size || 0} / {livingPlayers.length}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={handleExtractSelected}
                        disabled={!selectedUnit}
                        className="px-1.5 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white rounded font-bold uppercase active:scale-95"
                      >
                        Extract Sel
                      </button>
                      <button
                        type="button"
                        onClick={handleExtractAllPlayers}
                        className="px-1.5 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded font-bold uppercase active:scale-95"
                      >
                        Extract All
                      </button>
                    </div>
                  </div>
                )}

                {/* Elimination & Win / Fail */}
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={handleKillAllEnemies}
                    className="p-1.5 rounded bg-rose-950/70 border border-rose-700/60 hover:bg-rose-900 text-rose-200 font-bold uppercase flex items-center justify-center gap-1 active:scale-95"
                  >
                    <Skull className="w-3 h-3" /> Wipe Enemies ({livingEnemies.length})
                  </button>
                  <button
                    type="button"
                    onClick={handleInstantWin}
                    className="p-1.5 rounded bg-emerald-950/70 border border-emerald-700/60 hover:bg-emerald-900 text-emerald-200 font-bold uppercase flex items-center justify-center gap-1 active:scale-95"
                  >
                    <Award className="w-3 h-3" /> Instant Win
                  </button>
                </div>

                {/* Spawns */}
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={handleSpawnReinforcements}
                    className="p-1.5 rounded bg-amber-950/70 border border-amber-700/60 hover:bg-amber-900 text-amber-200 font-bold uppercase flex items-center justify-center gap-1 active:scale-95"
                  >
                    <Zap className="w-3 h-3" /> Force Reinforce
                  </button>
                  <button
                    type="button"
                    onClick={handleSpawnElite}
                    className="p-1.5 rounded bg-fuchsia-950/70 border border-fuchsia-700/60 hover:bg-fuchsia-900 text-fuchsia-200 font-bold uppercase flex items-center justify-center gap-1 active:scale-95"
                  >
                    <Flame className="w-3 h-3" /> Force Elite Wave
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleInstantFail}
                  className="w-full py-1 rounded bg-slate-900 border border-slate-700 hover:bg-rose-950 text-slate-400 hover:text-rose-300 font-bold uppercase flex items-center justify-center gap-1 active:scale-95"
                >
                  <AlertOctagon className="w-3 h-3" /> Trigger Mission Failure
                </button>

                {/* Boss Mission Controls (Harvester) */}
                {isHarvesterMission && harvesterUnit && (
                  <div className="rounded border border-amber-700/50 bg-slate-900/60 p-2 space-y-1.5">
                    <div className="text-[8px] font-bold text-amber-300 uppercase">The Harvester Boss Tools</div>
                    <div className="text-[8px] text-slate-400">
                      Phase: {harvesterState?.phase || 1} · HP: {harvesterUnit.hp}/{harvesterUnit.maxHp}
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {onForcePhase2 && (
                        <button
                          type="button"
                          onClick={onForcePhase2}
                          className="py-0.5 px-1 bg-amber-900/70 hover:bg-amber-800 text-amber-200 rounded font-bold"
                        >
                          Force Phase 2
                        </button>
                      )}
                      {onForcePhase3 && (
                        <button
                          type="button"
                          onClick={onForcePhase3}
                          className="py-0.5 px-1 bg-rose-900/70 hover:bg-rose-800 text-rose-200 rounded font-bold"
                        >
                          Force Phase 3
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {onSetBossHp && (
                        <button
                          type="button"
                          onClick={() => onSetBossHp(1)}
                          className="py-0.5 px-1 bg-slate-800 hover:bg-slate-700 text-rose-300 rounded font-bold"
                        >
                          Set Boss 1 HP
                        </button>
                      )}
                      {onSetBossHp && (
                        <button
                          type="button"
                          onClick={() => onSetBossHp(0)}
                          className="py-0.5 px-1 bg-slate-800 hover:bg-slate-700 text-rose-400 rounded font-bold"
                        >
                          Defeat Boss (0 HP)
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: SQUAD & RESOURCES */}
            {activeTab === 'resources' && (
              <div className="space-y-2">
                <div className="text-[8px] uppercase tracking-wider text-slate-400 font-bold">Squad-Wide Resource Refills</div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={handleRefillAllAp}
                    className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-cyan-700/60 text-cyan-300 font-bold uppercase flex items-center justify-center gap-1 active:scale-95"
                  >
                    <Zap className="w-3 h-3" /> Refill All AP (2)
                  </button>
                  <button
                    type="button"
                    onClick={handleRefillAllAmmo}
                    className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-amber-700/60 text-amber-300 font-bold uppercase flex items-center justify-center gap-1 active:scale-95"
                  >
                    <RotateCcw className="w-3 h-3" /> Max Ammo (All)
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={handleResetAllCooldowns}
                    className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-fuchsia-700/60 text-fuchsia-300 font-bold uppercase flex items-center justify-center gap-1 active:scale-95"
                  >
                    <RotateCcw className="w-3 h-3" /> Clear Cooldowns
                  </button>
                  <button
                    type="button"
                    onClick={handleHealSquad}
                    className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-emerald-700/60 text-emerald-300 font-bold uppercase flex items-center justify-center gap-1 active:scale-95"
                  >
                    <Heart className="w-3 h-3" /> Full Heal Squad
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleMaxDefenses}
                  className="w-full p-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-sky-600/70 text-sky-200 font-bold uppercase flex items-center justify-center gap-1 active:scale-95"
                >
                  <Shield className="w-3 h-3" /> Grant Shields (+4) &amp; Armor (+2)
                </button>

                {/* Phase & Round Controls */}
                <div className="border-t border-slate-800 pt-2 flex items-center justify-between text-[8px] bg-slate-900/60 p-2 rounded">
                  <span>Phase: <strong className="uppercase text-amber-300">{phase}</strong></span>
                  <button
                    type="button"
                    onClick={() => setPhase && setPhase((p) => (p === 'player' ? 'enemy' : 'player'))}
                    className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-600 active:scale-95 font-bold uppercase"
                  >
                    Switch Phase
                  </button>
                  <span>Round: <strong className="text-cyan-300">{turn}</strong></span>
                  <button
                    type="button"
                    onClick={() => setTurn && setTurn((t) => t + 1)}
                    className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-600 active:scale-95 font-bold uppercase"
                  >
                    +1 Round
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: SELECTED UNIT INSPECTOR */}
            {activeTab === 'unit' && (
              <div className="space-y-2">
                {selectedUnit ? (
                  <>
                    <div className="bg-slate-900/90 border border-slate-800 rounded p-2 text-[8px] space-y-1">
                      <div className="flex justify-between font-bold text-white text-[9px]">
                        <span>{selectedUnit.name}</span>
                        <span className="uppercase text-slate-400">{selectedUnit.team} · {selectedUnit.archetype || selectedUnit.class}</span>
                      </div>
                      <div className="flex justify-between text-slate-300 font-mono">
                        <span>HP: {selectedUnit.hp}/{selectedUnit.maxHp}</span>
                        <span>AP: {selectedUnit.ap}/{selectedUnit.maxAp}</span>
                        <span>Armor: {selectedUnit.armor || 0}</span>
                        <span>RNG: {getMovementRange(selectedUnit)}</span>
                      </div>
                      {w && (
                        <div className="text-slate-400 font-mono">
                          Weapon: {w.name} (R{w.range} D{w.damage} Ammo {currentAmmo}/{am === Infinity ? '∞' : am}{isInOverwatch(selectedUnit) ? ' · OW' : ''})
                        </div>
                      )}
                      {selectedUnit.downed && <div className="text-rose-400 font-bold uppercase">STATUS: DOWNED</div>}
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleModifyUnitHp(2)}
                        className="py-1 bg-emerald-950/70 border border-emerald-700 text-emerald-300 rounded font-bold active:scale-95 text-center"
                      >
                        +2 HP (Heal)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleModifyUnitHp(-2)}
                        className="py-1 bg-rose-950/70 border border-rose-700 text-rose-300 rounded font-bold active:scale-95 text-center"
                      >
                        -2 HP (Damage)
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleAddUnitAp(1)}
                        className="py-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 rounded font-bold active:scale-95 text-center"
                      >
                        +1 AP
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddUnitAp(-1)}
                        className="py-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 rounded font-bold active:scale-95 text-center"
                      >
                        -1 AP
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleToggleDownOrKill}
                      className="w-full py-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 rounded font-bold uppercase active:scale-95 text-center"
                    >
                      Toggle {selectedUnit.team === TEAMS.PLAYER ? 'Downed / Revived' : 'Kill / Revive'}
                    </button>
                  </>
                ) : (
                  <div className="text-slate-500 text-[9px] py-4 text-center border border-dashed border-slate-800 rounded">
                    Tap any unit on the battlefield to inspect &amp; modify its stats.
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: HAZARDS & MAP */}
            {activeTab === 'hazards' && (
              <div className="space-y-2">
                {/* Volatile Tiles */}
                <div className="flex items-center justify-between bg-slate-900/80 p-2 rounded border border-slate-800">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Volatile Tiles: {volatileCount}</span>
                  </div>
                  <span className="text-[8px] text-slate-400 font-mono">Dmg: {VOLATILE_TILE_DAMAGE} ENV</span>
                </div>

                {selectedUnit && (
                  <button
                    type="button"
                    onClick={handleToggleSelectedTileVolatile}
                    className="w-full py-1.5 px-2 rounded bg-emerald-900/60 hover:bg-emerald-800/80 border border-emerald-500/50 text-emerald-200 text-left font-bold active:scale-95 transition"
                  >
                    Toggle Tile ({selectedUnit.x},{selectedUnit.y}): {isVolatileTile(grid?.[selectedUnit.y]?.[selectedUnit.x]) ? 'Remove Volatile' : 'Set Volatile'}
                  </button>
                )}

                {/* QA Test Strip */}
                <div className="border border-slate-800 bg-slate-900/40 p-2 rounded space-y-1.5">
                  <div className="text-[8px] uppercase tracking-wider text-slate-400 font-bold">QA Test Strip (G G V V V G)</div>
                  <div className="text-[8px] text-slate-400 leading-tight">
                    Spawns Operative at (1,6) and Dislocator at (7,6) with 3 Volatile Tiles between them.
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleSetupQaStrip(10)}
                      className="flex-1 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-bold active:scale-95 text-center"
                    >
                      10 HP (Survive)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetupQaStrip(4)}
                      className="flex-1 py-1 rounded bg-rose-950/70 hover:bg-rose-900 border border-rose-600/70 text-rose-200 font-bold active:scale-95 text-center"
                    >
                      4 HP (Downed)
                    </button>
                  </div>
                </div>

                {pullInfo && (
                  <div className="bg-slate-900/90 border border-slate-800 p-2 rounded text-[8px] space-y-0.5">
                    <div className="text-cyan-300 font-bold">COME HERE! Pull Preview:</div>
                    <div>Valid: {pullInfo.valid ? 'YES' : 'NO'} · Dist: {pullInfo.tilesMoved || 0}</div>
                    <div className="text-emerald-300">
                      Hazards: {pullInfo.hazardTilesCrossed || 0} ({predictHazardDamage(pullInfo.path, grid)} Raw Dmg)
                    </div>
                  </div>
                )}

                {/* Terrain Utility Tools */}
                {(onGrantWallCharge || onGrantInstaWall) && (
                  <div className="border border-slate-800 bg-slate-900/40 p-2 rounded space-y-1.5">
                    <div className="text-[8px] uppercase tracking-wider text-amber-300 font-bold">Terrain Utilities (Wall Charge &amp; Cement)</div>
                    <div className="grid grid-cols-2 gap-1">
                      {onGrantWallCharge && (
                        <button
                          type="button"
                          onClick={onGrantWallCharge}
                          disabled={!selectedUnit}
                          className="py-1 px-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-amber-200 font-bold disabled:opacity-40 flex items-center justify-center gap-1"
                        >
                          <Pickaxe className="w-3 h-3" /> Grant Charge
                        </button>
                      )}
                      {onGrantInstaWall && (
                        <button
                          type="button"
                          onClick={onGrantInstaWall}
                          disabled={!selectedUnit}
                          className="py-1 px-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-amber-200 font-bold disabled:opacity-40 flex items-center justify-center gap-1"
                        >
                          <BrickWall className="w-3 h-3" /> Grant Wall
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {onToggleShowSiege && (
                        <button
                          type="button"
                          onClick={onToggleShowSiege}
                          className="py-1 px-1 rounded bg-slate-800 border border-slate-700 text-slate-300 text-[8px] flex items-center justify-center gap-1"
                        >
                          {showSiegeTiles ? <EyeOff className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
                          Siege Tiles
                        </button>
                      )}
                      {onToggleShowInstaWall && (
                        <button
                          type="button"
                          onClick={onToggleShowInstaWall}
                          className="py-1 px-1 rounded bg-slate-800 border border-slate-700 text-slate-300 text-[8px] flex items-center justify-center gap-1"
                        >
                          {showInstaWallTiles ? <EyeOff className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
                          Insta-Wall Tiles
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Map Metadata & Regenerator */}
                {mapConfig && (
                  <div className="border border-slate-800 bg-slate-900/40 p-2 rounded space-y-1.5">
                    <div className="text-[8px] uppercase tracking-wider text-cyan-300 font-bold">Map: {mapConfig.mapName} ({mapConfig.mapId})</div>
                    <div className="text-[8px] text-slate-400">Seed: {mapConfig.seed} · Density: {mapConfig.density}</div>
                    {onRegenerateMap && (
                      <button
                        type="button"
                        onClick={onRegenerateMap}
                        className="py-1 px-2 rounded bg-cyan-700/70 hover:bg-cyan-600 text-white font-bold flex items-center justify-center gap-1 active:scale-95"
                      >
                        <RefreshCw className="w-3 h-3" /> Regenerate Map Variation
                      </button>
                    )}
                    {compatibleMaps && compatibleMaps.length > 0 && onForceMap && (
                      <div className="flex flex-wrap gap-1 pt-1 border-t border-slate-800">
                        {compatibleMaps.map((mid) => (
                          <button
                            key={mid}
                            type="button"
                            onClick={() => onForceMap(mid)}
                            className={`px-1.5 py-0.5 rounded text-[8px] font-bold flex items-center gap-0.5 ${
                              mid === mapConfig.mapId
                                ? 'bg-cyan-500 text-slate-950 font-bold'
                                : 'bg-slate-800 text-cyan-200 border border-slate-700'
                            }`}
                          >
                            <MapPin className="w-2.5 h-2.5" /> {mid}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: TELEMETRY & INTEL */}
            {activeTab === 'telemetry' && (
              <div className="space-y-2 text-[8px]">
                {/* Mission Runtime Telemetry */}
                {missionRuntime && (
                  <div className="bg-slate-900/80 border border-slate-800 rounded p-2 space-y-0.5 text-cyan-200">
                    <div className="font-bold text-white text-[9px]">MISSION RUNTIME</div>
                    <div>State: {missionRuntime.state} · Round: {missionRuntime.round}</div>
                    <div>P/E: {livingPlayers.length}/{livingEnemies.length} · Elite Alive: {units.filter((u) => u.team === TEAMS.ENEMY && u.alive && u.elite).length}</div>
                    <div>Resp Countdown: {missionRuntime.reinforcementCountdown}{missionRuntime.standardReinforcementSpawned ? ' (spawned)' : ''}</div>
                    <div>Elite Resp: {missionRuntime.eliteResponseAccepted ? 'Accepted' : 'No'} {missionRuntime.eliteResponseSpawned ? '· Spawned' : ''}</div>
                  </div>
                )}

                {/* Last Attack Breakdown */}
                {lastAttack && (
                  <div className="bg-slate-900/80 border border-slate-800 rounded p-2 space-y-0.5 text-amber-200">
                    <div className="font-bold text-white text-[9px]">LAST ATTACK CALCULATION</div>
                    <div>{lastAttack.attacker} → {lastAttack.target} ({lastAttack.state})</div>
                    <div>Range: {lastAttack.range}/{lastAttack.weaponRange} · Dmg: {lastAttack.baseDamage} × {lastAttack.modifier} = {lastAttack.finalDamage}</div>
                    <div>HP: {lastAttack.hpBefore} → {lastAttack.hpAfter} {lastAttack.killed ? '· KILL' : ''}</div>
                  </div>
                )}

                {/* Last Enemy AI Decision */}
                {lastEnemyDecision && (
                  <div className="bg-slate-900/80 border border-slate-800 rounded p-2 space-y-0.5 text-fuchsia-200">
                    <div className="font-bold text-white text-[9px]">LAST ENEMY AI DECISION</div>
                    <div>{lastEnemyDecision.name}: {lastEnemyDecision.type}</div>
                    {lastEnemyDecision.reason && <div className="text-slate-400">Reason: {lastEnemyDecision.reason}</div>}
                  </div>
                )}

                {/* Last Reaction / Overwatch */}
                {lastReaction && (
                  <div className="bg-slate-900/80 border border-slate-800 rounded p-2 space-y-0.5 text-amber-200">
                    <div className="font-bold text-white text-[9px]">LAST OVERWATCH SHOT</div>
                    <div>{lastReaction.shooter} → {lastReaction.target} @ {lastReaction.tile}</div>
                    <div>R{lastReaction.range} · {lastReaction.state}{lastReaction.sprint ? ' SPRINT' : ''} · Dmg: {lastReaction.damage}{lastReaction.killed ? ' KILL' : ''}</div>
                  </div>
                )}

                {/* Valid Targets Breakdown in Attack Mode */}
                {attackMode && validTargets && validTargets.length > 0 && (
                  <div className="bg-slate-900/80 border border-slate-800 rounded p-2 space-y-0.5 text-rose-200">
                    <div className="font-bold text-white text-[9px]">VALID TARGETS DAMAGE ({validTargets.length})</div>
                    {validTargets.map((t) => {
                      const o = computeDamage(selectedUnit, t, grid);
                      return (
                        <div key={t.id} className="flex justify-between">
                          <span>{t.name} ({COVER_STATE_LABELS[o.state]})</span>
                          <span>Dmg: {o.finalDamage} {o.killed ? '· KILL' : ''}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 6: TERRAIN EDGES (Implementation 3.6.1) */}
            {activeTab === 'edges' && (
              <TerrainEdgeDebugPanel
                debug={debug}
                edges={edges || grid?.edges}
                setEdges={setEdges}
                selectedEdgeId={selectedEdgeId}
                setSelectedEdgeId={setSelectedEdgeId}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
