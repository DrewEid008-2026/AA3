import React, { useState } from 'react';
import { RotateCcw, Coins, Gem, Check, X, Star, HeartCrack, Sparkles, Zap, Skull, Heart, Box } from 'lucide-react';
import { MISSION_STATES, MISSION_TYPES } from '@/game/constants';
import { totalReward } from '@/game/rewards';
import { MAX_LEVEL } from '@/game/progression';

// End-of-mission result summary. Shows the objective outcome, credit reward,
// alien salvage from enemy defeats, elite response result, power cores, and
// per-soldier XP progression. Data-driven — all numbers come from the mission
// + runtime + commit results, not hardcoded.
//
// Victory screen flow has exactly two primary actions:
// 1. REPLAY SAME MISSION TYPE (generates a fresh mission instance of the same type)
// 2. RETURN TO BASE (returns to base squad/management screen)
export default function MissionResult({
  mission, runtime, soldierResults,
  powerCoresEarned = 0,
  alienMaterialsEarned = 0,
  baseAlienMaterials = 0,
  eliteAlienMaterials = 0,
  enemiesDefeated = 0,
  eliteEnemiesDefeated = 0,
  nanoCubesEarned = 0,
  nanoCubeTotalBefore = 0,
  nanoCubeTotalAfter = 0,
  isFirstClear = false,
  onReplaySameType, onReturnToBase, onRestart,
}) {
  const [isNavigating, setIsNavigating] = useState(false);
  const base = runtime.baseRewardSecured ? mission.baseReward : null;
  const elite = runtime.eliteRewardSecured ? mission.eliteBonus : null;
  const total = totalReward(base, elite);
  const isBoss = !!mission.isBoss;
  const isComplete = runtime.state === MISSION_STATES.COMPLETE;
  const actionsEnabled = !!soldierResults;

  const handleReplayClick = () => {
    if (isNavigating || !actionsEnabled) return;
    setIsNavigating(true);
    onReplaySameType?.();
  };

  const handleReturnToBaseClick = () => {
    if (isNavigating || !actionsEnabled) return;
    setIsNavigating(true);
    onReturnToBase?.();
  };

  const typeSupportText = (() => {
    if (isBoss) return 'REPLAY BOSS ENCOUNTER';
    switch (mission?.type) {
      case MISSION_TYPES.ELIMINATION:
        return 'NEW ELIMINATION MISSION';
      case MISSION_TYPES.EXTRACTION:
        return 'NEW EXTRACTION MISSION';
      case MISSION_TYPES.RESCUE:
        return 'NEW RESCUE MISSION';
      case MISSION_TYPES.SABOTAGE:
        return 'NEW SABOTAGE MISSION';
      default:
        return 'NEW MISSION';
    }
  })();

  let title, titleColor, subtitle;
  if (isBoss && isComplete) {
    const isCh1 = mission.chapterId === 'ch1';
    if (isCh1) {
      title = 'WARDEN DEFEATED';
      titleColor = 'text-amber-400';
      subtitle = 'Power Core Retrieved';
    } else if (isFirstClear) {
      title = 'CHAPTER 2 COMPLETE';
      titleColor = 'text-amber-400';
      subtitle = 'The Harvester Destroyed';
    } else {
      title = 'HARVESTER DEFEATED';
      titleColor = 'text-amber-400';
      subtitle = 'Nano Cube Recovered';
    }
  } else {
    switch (runtime.state) {
      case MISSION_STATES.COMPLETE:
        title = 'MISSION COMPLETE';
        titleColor = 'text-emerald-400';
        subtitle = elite ? 'Elite Response Defeated' : 'Objective Secured';
        break;
      case MISSION_STATES.PRIMARY_FAILED:
        title = 'MISSION FAILED';
        titleColor = 'text-rose-500';
        subtitle = 'Squad Eliminated';
        break;
      case MISSION_STATES.ELITE_RESPONSE_FAILED:
        title = 'ELITE RESPONSE FAILED';
        titleColor = 'text-amber-400';
        subtitle = 'Objective Secured · Squad Lost';
        break;
      default:
        title = 'MISSION COMPLETE';
        titleColor = 'text-emerald-400';
        subtitle = '';
    }
  }

  const showElite = runtime.eliteResponseAccepted || runtime.eliteResponseSpawned || runtime.eliteResponseDefeated || runtime.eliteRewardSecured;
  const showSalvage = runtime.baseRewardSecured;

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-sm px-4 py-6 overflow-y-auto">
      <div className={`text-xl sm:text-2xl font-black tracking-[0.15em] ${titleColor}`}>
        {title}
      </div>
      <div className="mt-1 text-[11px] font-mono tracking-widest text-slate-400">
        {subtitle}
      </div>

      <div className="mt-5 w-full max-w-xs space-y-3">
        {/* Primary objective + credit reward */}
        <div className="rounded-lg border border-slate-700 bg-slate-900/80 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-slate-400">Primary Objective</span>
            {runtime.baseRewardSecured ? (
              <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-bold"><Check className="w-3.5 h-3.5" /> Secured</span>
            ) : (
              <span className="inline-flex items-center gap-1 text-rose-400 text-xs font-bold"><X className="w-3.5 h-3.5" /> Failed</span>
            )}
          </div>
          {base && (
            <div className="mt-2 flex items-center gap-1.5 text-sm">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-white font-semibold">+{base.credits} Credits</span>
            </div>
          )}
        </div>

        {/* Alien Salvage — from enemy defeats */}
        {showSalvage ? (
          <div className="rounded-lg border border-emerald-700/50 bg-emerald-950/30 p-3">
            <div className="text-[10px] uppercase tracking-wider text-emerald-300/80 mb-1.5">Alien Salvage</div>
            <div className="flex items-center gap-1.5 text-sm">
              <Gem className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-white font-bold">+{baseAlienMaterials} Alien Materials</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
              <Skull className="w-3 h-3" />
              {enemiesDefeated} enem{enemiesDefeated === 1 ? 'y' : 'ies'} defeated
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Alien Salvage</div>
            <div className="text-slate-500 text-xs">No salvage recovered</div>
          </div>
        )}

        {/* Elite response */}
        {showElite && (
          <div className="rounded-lg border border-slate-700 bg-slate-900/80 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-slate-400">Elite Response</span>
              {runtime.eliteRewardSecured ? (
                <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-bold"><Check className="w-3.5 h-3.5" /> Defeated</span>
              ) : runtime.state === MISSION_STATES.ELITE_RESPONSE_FAILED ? (
                <span className="inline-flex items-center gap-1 text-rose-400 text-xs font-bold"><X className="w-3.5 h-3.5" /> Failed</span>
              ) : (
                <span className="text-slate-400 text-xs font-bold">Not Defeated</span>
              )}
            </div>
            {elite ? (
              <div className="mt-2 flex items-center gap-1.5 text-sm">
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-white font-semibold">+{elite.credits} Credits</span>
              </div>
            ) : (
              <div className="mt-2 text-[11px] text-slate-500">Bonus lost</div>
            )}
            {eliteEnemiesDefeated > 0 && (
              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
                <Skull className="w-3 h-3" />
                {eliteEnemiesDefeated} elite enem{eliteEnemiesDefeated === 1 ? 'y' : 'ies'} defeated
                {eliteAlienMaterials > 0 && (
                  <span className="text-emerald-400 font-semibold"> · +{eliteAlienMaterials} AM</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Total Alien Materials (base + elite salvage) */}
        {showSalvage && alienMaterialsEarned > 0 && (eliteAlienMaterials > 0 || showElite) && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-950/30 p-3">
            <div className="text-[10px] uppercase tracking-wider text-amber-300/80 mb-1.5">Total Alien Materials</div>
            <div className="flex items-center gap-1.5 text-white font-bold text-lg">
              <Gem className="w-4 h-4 text-emerald-400" /> {alienMaterialsEarned}
            </div>
          </div>
        )}

        {/* Power Cores (Special Recovery) — from designated enemy types */}
        {powerCoresEarned > 0 && (
          <div className="rounded-lg border border-fuchsia-500/30 bg-fuchsia-950/30 p-3">
            <div className="text-[10px] uppercase tracking-wider text-fuchsia-300/80 mb-1.5">Special Recovery</div>
            <div className="flex items-center gap-1.5 text-white font-bold text-lg">
              <Zap className="w-4 h-4 text-fuchsia-400" /> +{powerCoresEarned} Power Core{powerCoresEarned === 1 ? '' : 's'}
            </div>
          </div>
        )}

        {/* Nano Cube — Chapter 2 Boss reward (prominent, distinct from salvage) */}
        {nanoCubesEarned > 0 && (
          <div className="rounded-lg border-2 border-cyan-400/50 bg-gradient-to-br from-cyan-950/50 to-blue-950/50 p-3 shadow-lg shadow-cyan-500/10">
            <div className="text-[10px] uppercase tracking-wider text-cyan-300/80 mb-1.5 flex items-center gap-1">
              <Box className="w-3 h-3 text-cyan-400" />
              {isFirstClear ? 'Rare Technology Recovered' : 'Nano Cube Recovered'}
            </div>
            <div className="flex items-center gap-2 text-white font-bold text-lg">
              <Box className="w-5 h-5 text-cyan-300" fill="currentColor" />
              <span className="text-cyan-200">NANO CUBE +{nanoCubesEarned}</span>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-400">
              <span className="text-slate-500 font-mono">{nanoCubeTotalBefore}</span>
              <span className="text-cyan-400">→</span>
              <span className="text-cyan-200 font-bold font-mono">{nanoCubeTotalAfter}</span>
              <span className="text-slate-500 ml-1">total</span>
            </div>
            {isFirstClear && (
              <div className="mt-1.5 text-[10px] text-cyan-300/70 leading-snug">
                A rare alien fabrication core. Future Tier 4 Nano Technology will be built from this.
              </div>
            )}
          </div>
        )}

        {/* Soldier progression */}
        {soldierResults && soldierResults.length > 0 && (
          <div className="rounded-lg border border-slate-700 bg-slate-900/80 p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-2">Squad Progression</div>
            <div className="space-y-2">
              {soldierResults.map((r) => {
                const isMax = r.level >= MAX_LEVEL;
                return (
                  <div key={r.name} className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-bold tracking-wide ${r.injured ? 'text-rose-400' : 'text-white'}`}>
                      {r.name}
                    </span>
                    {r.injured && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider text-rose-400">
                        <HeartCrack className="w-3 h-3" /> Injured
                      </span>
                    )}
                    {r.leveledUp && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-400">
                        <Star className="w-2.5 h-2.5" fill="currentColor" /> LV {r.level}{isMax ? ' MAX' : ''}
                      </span>
                    )}
                    {r.leveledUp && r.hpAwarded > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-400">
                        <Heart className="w-2.5 h-2.5" fill="currentColor" /> +{r.hpAwarded} Max HP
                      </span>
                    )}
                    {r.skillAwarded > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-300">
                        <Sparkles className="w-2.5 h-2.5" fill="currentColor" /> +{r.skillAwarded} Skill Pt
                      </span>
                    )}
                    <span className="ml-auto text-[10px] text-slate-400">
                      {r.xpGained > 0 ? `+${r.xpGained} XP` : 'No XP'}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono w-16 text-right">
                      {isMax ? 'MAX' : `${r.xp} XP`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="mt-6 w-full max-w-xs space-y-2.5">
        {isComplete ? (
          <>
            <button
              type="button"
              onClick={handleReplayClick}
              disabled={isNavigating || !actionsEnabled}
              className="w-full flex flex-col items-center justify-center py-3.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-slate-950 font-black tracking-wider transition shadow-lg shadow-amber-500/20 disabled:opacity-50 touch-manipulation"
            >
              <span className="text-xs sm:text-sm uppercase tracking-widest font-black">
                REPLAY SAME MISSION TYPE
              </span>
              <span className="text-[9px] sm:text-[10px] font-mono tracking-wider opacity-85 uppercase mt-0.5">
                {typeSupportText}
              </span>
            </button>

            <button
              type="button"
              onClick={handleReturnToBaseClick}
              disabled={isNavigating || !actionsEnabled}
              className="w-full flex items-center justify-center py-3 px-4 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 active:scale-[0.98] text-slate-200 text-xs font-bold tracking-widest uppercase border border-slate-700 transition disabled:opacity-50 touch-manipulation"
            >
              RETURN TO BASE
            </button>
          </>
        ) : (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onRestart}
              disabled={isNavigating}
              className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-slate-100 text-slate-900 text-xs font-bold tracking-widest active:scale-95 transition disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" /> RESTART
            </button>
            <button
              type="button"
              onClick={handleReturnToBaseClick}
              disabled={isNavigating}
              className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-slate-800 text-slate-200 text-xs font-bold tracking-widest border border-slate-600 active:scale-95 transition disabled:opacity-50"
            >
              RETURN TO BASE
            </button>
          </div>
        )}
      </div>
    </div>
  );
}