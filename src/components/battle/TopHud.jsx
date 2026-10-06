import React from 'react';
import { Flag, Bug, ScanLine, Settings, AlertTriangle, Crosshair, Eye, Crown } from 'lucide-react';
import { MISSION_TYPES } from '@/game/constants';
import EnemyCommanderHudButton from '@/components/battle/EnemyCommanderHudButton';
import EnemyCommanderHudButtonAbsent from '@/components/battle/EnemyCommanderHudButtonAbsent';

// Compact two-row tile header. Row 1 carries mission + phase + End Turn.
// Row 2 carries the Tactical Lens tile (left) and the Options cog (right),
// keeping tactical controls reachable without crowding the mission line.
// Both rows stay shallow so the battlefield dominates portrait screens.

const MISSION_LABELS = {
  [MISSION_TYPES.ELIMINATION]: 'ELIMINATION',
  [MISSION_TYPES.EXTRACTION]: 'EXTRACTION',
  [MISSION_TYPES.RESCUE]: 'RESCUE',
  [MISSION_TYPES.SABOTAGE]: 'SABOTAGE',
};

const OBJECTIVE_SHORT = {
  [MISSION_TYPES.ELIMINATION]: 'Eliminate Hostiles',
  [MISSION_TYPES.EXTRACTION]: 'Extract Squad',
  [MISSION_TYPES.RESCUE]: 'Rescue Civilian',
  [MISSION_TYPES.SABOTAGE]: 'Destroy Device',
};

export default function TopHud({
  turn,
  phase,
  missionType,
  enemyCount,
  reinforcementCountdown,
  standardReinforcementSpawned,
  reinforcementCanceled,
  objectiveSecured,
  allSpent,
  debug,
  lensActive,
  isBossMission,
  relayStatus,
  bossShield,
  bossShieldMax,
  bossPhase,
  objectiveText,
  onToggleLens,
  onOpenOptions,
  onEndTurn,
  onToggleDebug,
  onObjectiveTap,
  onOverwatchAll,
  overwatchAllEligibleCount,
  overwatchAllDisabled,
  commanderUnlocked,
  commanderSkillCount,
  commanderTargetingActive,
  onOpenCommander,
  enemyCommanderActive,
  enemyCommanderDisplay,
  enemyBudgetCurrent,
  enemyBudgetMax,
  onOpenEnemyCommander,
}) {
  const isEnemy = phase === 'enemy';
  const showResponse =
    !standardReinforcementSpawned &&
    !reinforcementCanceled &&
    reinforcementCountdown > 0 &&
    !objectiveSecured;
  const missionLabel = isBossMission
    ? (bossPhase === 'PHASE_3_OVERLOAD' ? 'OVERLOAD' : bossPhase === 'PHASE_2_ADVANCE' ? 'ADVANCE' : 'BOSS')
    : (MISSION_LABELS[missionType] || 'MISSION');
  const objectiveLabel = isBossMission
    ? (objectiveText || 'Defeat the Boss')
    : (OBJECTIVE_SHORT[missionType] || '');
  const lensDisabled = isEnemy;

  return (
    <div className="shrink-0 bg-slate-900/90 border-b border-slate-700 select-none">
      {/* Row 1 — Mission information + battle state + End Turn */}
      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
        {/* Left: mission / objective tile (tap to focus objective via Lens) */}
        <button
          type="button"
          onClick={onObjectiveTap}
          className="flex flex-col items-start text-left min-w-0 max-w-[38%] active:opacity-70 touch-manipulation"
          aria-label="Focus objective"
        >
          <span
            className={`text-[10px] font-black tracking-wider uppercase leading-none ${
              objectiveSecured ? 'text-emerald-400'
                : isBossMission && bossPhase === 'PHASE_3_OVERLOAD' ? 'text-orange-400'
                : isBossMission && bossPhase === 'PHASE_2_ADVANCE' ? 'text-amber-300'
                : 'text-amber-300'
            }`}
          >
            {missionLabel}
          </span>
          <span className="text-[9px] text-slate-400 truncate w-full leading-tight mt-0.5">
            {objectiveSecured ? 'Objective Secured' : objectiveLabel}
          </span>
          {isBossMission && !objectiveSecured && relayStatus && (
            <div className="flex items-center gap-2 leading-tight mt-0.5">
              <span className="text-[9px] font-bold text-fuchsia-300">
                Relays {relayStatus.destroyed}/{relayStatus.total}
              </span>
              {bossShield != null && (
                <span className={`text-[9px] font-bold ${bossShield > 0 ? 'text-cyan-300' : 'text-slate-500'}`}>
                  ◈ {bossShield}
                </span>
              )}
            </div>
          )}
          {missionType === MISSION_TYPES.ELIMINATION && !objectiveSecured && !isBossMission && (
            <span className="text-[9px] font-bold text-rose-300 leading-tight mt-0.5">
              Hostiles: {enemyCount}
            </span>
          )}
        </button>

        {/* Center: phase + round + reinforcement pressure + debug */}
        <div className="flex items-center gap-1.5 justify-center min-w-0">
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded ${
              isEnemy ? 'bg-rose-700 text-white' : 'bg-sky-600 text-white'
            }`}
          >
            <Crosshair className="w-2.5 h-2.5" />
            {isEnemy ? 'Enemy' : 'Player'}
          </span>
          <span className="text-[10px] font-medium text-slate-300">R{turn}</span>
          {showResponse && (
            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold tracking-wider uppercase text-amber-300 bg-amber-950/60 border border-amber-700/50 px-1.5 py-0.5 rounded">
              <AlertTriangle className="w-2.5 h-2.5" />
              Resp {reinforcementCountdown}
            </span>
          )}
          {standardReinforcementSpawned && !objectiveSecured && (
            <span className="text-[9px] font-bold tracking-wider uppercase text-rose-300 bg-rose-950/60 border border-rose-700/50 px-1.5 py-0.5 rounded">
              Reinforced
            </span>
          )}
          <button
            type="button"
            onClick={onToggleDebug}
            className={`ml-0.5 p-1 rounded ${debug ? 'bg-amber-500/30 text-amber-300' : 'text-slate-500'}`}
            aria-label="Toggle debug info"
          >
            <Bug className="w-3 h-3" />
          </button>
        </div>

        {/* Right: End Turn (2x2 — larger, prominent) */}
        <button
          type="button"
          onClick={onEndTurn}
          disabled={isEnemy || objectiveSecured}
          className={`inline-flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold tracking-wider uppercase px-3 py-2 rounded-md border touch-manipulation transition-colors shrink-0 ${
            isEnemy || objectiveSecured
              ? 'bg-slate-800 text-slate-600 border-slate-700 cursor-not-allowed'
              : allSpent
                ? 'bg-amber-500 text-slate-900 border-amber-300 animate-pulse'
                : 'bg-slate-800 text-slate-200 border-slate-600 active:bg-slate-700'
          }`}
        >
          <Flag className="w-4 h-4" />
          End
        </button>
      </div>

      {/* Row 2 — Tactical control tiles (Lens + Options on the left) */}
      <div className="flex items-center gap-2 px-2.5 pb-1.5">
        <button
          type="button"
          onClick={onToggleLens}
          disabled={lensDisabled}
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border text-[10px] font-bold tracking-wider uppercase touch-manipulation transition-colors ${
            lensDisabled
              ? 'bg-slate-800 text-slate-600 border-slate-700 cursor-not-allowed'
              : lensActive
                ? 'bg-cyan-500/30 text-cyan-200 border-cyan-400/70'
                : 'bg-slate-800/80 text-slate-300 border-slate-600 active:bg-slate-700'
          }`}
        >
          <ScanLine className="w-3.5 h-3.5" />
          {lensActive ? 'Lens On' : 'Lens'}
        </button>

        <button
          type="button"
          onClick={onOverwatchAll}
          disabled={overwatchAllDisabled}
          aria-label="Overwatch All"
          className={`relative inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border text-[10px] font-bold tracking-wider uppercase touch-manipulation transition-colors ${
            overwatchAllDisabled
              ? 'bg-slate-800 text-slate-600 border-slate-700 cursor-not-allowed'
              : overwatchAllEligibleCount > 0
                ? 'bg-amber-500/20 text-amber-200 border-amber-400/70 active:bg-amber-500/30'
                : 'bg-slate-800/80 text-slate-500 border-slate-600'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          {overwatchAllEligibleCount > 0 && !overwatchAllDisabled && (
            <span className="inline-flex items-center justify-center min-w-[15px] h-3.5 px-1 rounded-full bg-amber-400 text-slate-900 text-[9px] font-black leading-none">
              {overwatchAllEligibleCount}
            </span>
          )}
        </button>

        {commanderUnlocked && commanderSkillCount > 0 && (
          <button
            type="button"
            onClick={onOpenCommander}
            disabled={commanderTargetingActive || isEnemy}
            aria-label="Commander Skills"
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border text-[10px] font-bold tracking-wider uppercase touch-manipulation transition-colors ${
              commanderTargetingActive
                ? 'bg-violet-500/30 text-violet-200 border-violet-400/70'
                : isEnemy
                  ? 'bg-slate-800 text-slate-600 border-slate-700 cursor-not-allowed'
                  : 'bg-violet-900/40 text-violet-200 border-violet-600/60 active:bg-violet-800/50'
            }`}
          >
            <Crown className="w-3.5 h-3.5" />
            Cmd
          </button>
        )}

        {enemyCommanderActive ? (
          <EnemyCommanderHudButton
            displayProfile={enemyCommanderDisplay}
            budgetCurrent={enemyBudgetCurrent}
            budgetMax={enemyBudgetMax}
            onTap={onOpenEnemyCommander}
          />
        ) : (
          <EnemyCommanderHudButtonAbsent />
        )}

        <button
          type="button"
          onClick={onOpenOptions}
          disabled={commanderTargetingActive}
          aria-label="Options"
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border text-[10px] font-bold tracking-wider uppercase touch-manipulation transition-colors ${
            commanderTargetingActive
              ? 'bg-slate-800 text-slate-600 border-slate-700 cursor-not-allowed'
              : 'bg-slate-800/80 text-slate-300 border-slate-600 active:bg-slate-700'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          Options
        </button>

        <div className="flex-1" />
      </div>
    </div>
  );
}