import React, { useState, useMemo } from 'react';
import { getCurrentArmor, getBaseArmor } from '@/game/armorShred';
import { getHarvesterAiScores } from '@/game/harvesterAi';

// Development-only debug controls for The Harvester. Set HP, set Armor, reset
// cooldowns, force abilities, inspect pending hazard state, inspect Phase 2
// + Fabrication Sequence state, and view AI candidate scores (Part 43).
// Never shown to normal players — only rendered when the Battle debug flag is
// on AND the mission is the Harvester Pit boss.
export default function HarvesterDebugPanel({
  debug,
  isHarvesterMission,
  harvesterUnit,
  harvesterState,
  pendingTremor,
  pendingBeam,
  pendingCharge,
  onSetHp,
  onSetArmor,
  onResetCooldowns,
  onForceTremor,
  onForceBeam,
  onResolveHazard,
  onForcePhase2,
  onForceFabrication,
  onResetPhase1,
  onForceCharge,
  onResolveCharge,
  onForcePhase3,
  onResetPhase3,
  onForceMeltdown,
  onResolveMeltdown,
  onForceCoreDischarge,
  onResolveCoreDischarge,
  pendingMeltdown,
  pendingCoreDischarge,
  units,
  grid,
  onForceDefeat,
  onSimulateFirstClear,
  onSimulateReplay,
  onTestDuplicateCommit,
  nanoCubeInfo,
  commitState,
}) {
  const [open, setOpen] = useState(false);
  const [showAi, setShowAi] = useState(false);

  // AI candidate scores (Part 43) — dev-only inspection. Must be called before
  // any early return (rules of hooks).
  const aiScores = useMemo(() => {
    if (!showAi || !units || !grid || !harvesterUnit) return null;
    return getHarvesterAiScores(grid, units, harvesterUnit, {
      harvesterState,
      hasPendingTremor: !!pendingTremor,
      hasPendingBeam: !!pendingBeam,
      hasPendingCharge: !!pendingCharge,
    });
  }, [showAi, units, grid, harvesterUnit, harvesterState, pendingTremor, pendingBeam, pendingCharge]);

  if (!debug || !isHarvesterMission || !harvesterUnit) return null;

  const curArmor = getCurrentArmor(harvesterUnit);
  const baseArmor = getBaseArmor(harvesterUnit);

  const renderCandidate = (key, label, c) => (
    <div key={key} className={`rounded px-1 py-0.5 ${c.available ? 'bg-slate-800' : 'bg-slate-800/40 opacity-60'}`}>
      <div className="flex justify-between">
        <span className="text-amber-200 font-bold">{label}</span>
        <span className="text-slate-300">{c.available ? Math.round(c.score) : '—'}</span>
      </div>
      <div className="text-slate-400 text-[8px]">{c.reason}</div>
      {c.available && c.details && Object.keys(c.details).length > 0 && (
        <div className="text-slate-500 text-[7px] mt-0.5">
          {Object.entries(c.details).map(([k, v]) => `${k}:${v}`).join(' · ')}
        </div>
      )}
    </div>
  );

  return (
    <div className="absolute right-3 bottom-16 z-[40] pointer-events-auto max-w-[210px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-[9px] font-mono font-bold text-amber-200 bg-slate-900/90 border border-amber-700/60 rounded px-2 py-1 mb-1"
      >
        {open ? '▼' : '▶'} HARVESTER DEBUG
      </button>
      {open && (
        <div className="text-[9px] font-mono text-amber-100 bg-slate-900/95 border border-amber-700/60 rounded px-2 py-1.5 space-y-1.5 max-h-[70vh] overflow-y-auto">
          {/* Stats readout */}
          <div className="border-b border-slate-700 pb-1">
            <div>HP: {harvesterUnit.hp}/{harvesterUnit.maxHp}</div>
            <div>ARMOR: {curArmor}/{baseArmor}</div>
            <div>AP: {harvesterUnit.ap}/{harvesterUnit.maxAp}</div>
            <div>PHASE: {harvesterState?.bossPhase || '?'}</div>
            <div className={harvesterState?.phase2ConditionMet ? 'text-amber-300 font-bold' : 'text-slate-400'}>
              phase2ConditionMet: {String(harvesterState?.phase2ConditionMet || false)}
            </div>
            <div className={harvesterState?.fabricationSequenceTriggered ? 'text-fuchsia-300 font-bold' : 'text-slate-400'}>
              fabricationTriggered: {String(harvesterState?.fabricationSequenceTriggered || false)}
            </div>
            <div className={harvesterState?.phase2ReinforcementsSpawned ? 'text-emerald-300 font-bold' : 'text-slate-400'}>
              reinforcementsSpawned: {String(harvesterState?.phase2ReinforcementsSpawned || false)}
            </div>
          </div>

          {/* Pending hazard state */}
          <div className="border-b border-slate-700 pb-1">
            <div className="text-amber-300 font-bold">PENDING:</div>
            <div>Tremor: {pendingTremor ? `(${pendingTremor.centerX},${pendingTremor.centerY})` : 'none'}</div>
            <div>Beam: {pendingBeam ? `${pendingBeam.orientation} ${pendingBeam.index}` : 'none'}</div>
            <div>Charge: {pendingCharge ? `${pendingCharge.dir} →${pendingCharge.destinationX},${pendingCharge.destinationY}` : 'none'}</div>
            <div>Meltdown: {pendingMeltdown ? `${pendingMeltdown.length} zones` : 'none'}</div>
            <div>Core Discharge: {pendingCoreDischarge ? 'pending' : 'none'}</div>
            {(pendingTremor || pendingBeam) && (
              <button
                type="button"
                onClick={onResolveHazard}
                className="mt-1 w-full text-[8px] bg-rose-700 text-white rounded px-1 py-0.5 active:scale-95"
              >
                RESOLVE HAZARD NOW
              </button>
            )}
            {pendingCharge && (
              <button
                type="button"
                onClick={onResolveCharge}
                className="mt-1 w-full text-[8px] bg-rose-700 text-white rounded px-1 py-0.5 active:scale-95"
              >
                RESOLVE CHARGE NOW
              </button>
            )}
            {pendingMeltdown && (
              <button
                type="button"
                onClick={onResolveMeltdown}
                className="mt-1 w-full text-[8px] bg-rose-700 text-white rounded px-1 py-0.5 active:scale-95"
              >
                RESOLVE MELTDOWN NOW
              </button>
            )}
            {pendingCoreDischarge && (
              <button
                type="button"
                onClick={onResolveCoreDischarge}
                className="mt-1 w-full text-[8px] bg-rose-700 text-white rounded px-1 py-0.5 active:scale-95"
              >
                RESOLVE DISCHARGE NOW
              </button>
            )}
          </div>

          {/* AI score view (Part 43) */}
          <div className="border-b border-slate-700 pb-1">
            <button
              type="button"
              onClick={() => setShowAi((v) => !v)}
              className="w-full text-[8px] bg-cyan-800 text-cyan-100 rounded px-1 py-0.5 mb-1 active:scale-95"
            >
              {showAi ? '▼' : '▶'} AI SCORES
            </button>
            {showAi && aiScores && (
              <div className="space-y-0.5">
                {renderCandidate('siege_charge', 'Siege Charge', aiScores.candidates.siege_charge)}
                {renderCandidate('tremor_slam', 'Tremor Slam', aiScores.candidates.tremor_slam)}
                {renderCandidate('excavation_beam', 'Excavation Beam', aiScores.candidates.excavation_beam)}
                {renderCandidate('cannon', 'Cannon', aiScores.candidates.cannon)}
              </div>
            )}
          </div>

          {/* HP controls */}
          <div className="border-b border-slate-700 pb-1">
            <div className="text-amber-300 font-bold">SET HP:</div>
            <div className="flex gap-0.5 flex-wrap">
              {[34, 20, 10, 5, 1].map((hp) => (
                <button
                  key={hp}
                  type="button"
                  onClick={() => onSetHp(hp)}
                  className="px-1 py-0.5 bg-slate-700 text-amber-100 rounded active:scale-95"
                >
                  {hp}
                </button>
              ))}
            </div>
          </div>

          {/* Armor controls */}
          <div className="border-b border-slate-700 pb-1">
            <div className="text-amber-300 font-bold">SET ARMOR:</div>
            <div className="flex gap-0.5 flex-wrap">
              {[6, 4, 2, 0].map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => onSetArmor(a)}
                  className="px-1 py-0.5 bg-slate-700 text-amber-100 rounded active:scale-95"
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          {/* Cooldown + ability controls */}
          <div>
            <button
              type="button"
              onClick={onResetCooldowns}
              className="w-full text-[8px] bg-slate-700 text-amber-100 rounded px-1 py-0.5 mb-1 active:scale-95"
            >
              RESET COOLDOWNS
            </button>
            <button
              type="button"
              onClick={onForceTremor}
              className="w-full text-[8px] bg-orange-700 text-white rounded px-1 py-0.5 mb-1 active:scale-95"
            >
              FORCE TREMOR SLAM
            </button>
            <button
              type="button"
              onClick={onForceBeam}
              className="w-full text-[8px] bg-cyan-700 text-white rounded px-1 py-0.5 mb-1 active:scale-95"
            >
              FORCE EXCAVATION BEAM
            </button>
            <button
              type="button"
              onClick={onForcePhase2}
              className="w-full text-[8px] bg-amber-700 text-white rounded px-1 py-0.5 mb-1 active:scale-95"
            >
              FORCE PHASE 2 (ADVANCE)
            </button>
            <button
              type="button"
              onClick={onForceFabrication}
              className="w-full text-[8px] bg-fuchsia-700 text-white rounded px-1 py-0.5 mb-1 active:scale-95"
            >
              FORCE FABRICATION
            </button>
            <button
              type="button"
              onClick={onResetPhase1}
              className="w-full text-[8px] bg-slate-700 text-amber-100 rounded px-1 py-0.5 mb-1 active:scale-95"
            >
              RESET TO PHASE 1
            </button>
            <button
              type="button"
              onClick={onForceCharge}
              className="w-full text-[8px] bg-red-700 text-white rounded px-1 py-0.5 mb-1 active:scale-95"
            >
              FORCE SIEGE CHARGE
            </button>
            <div className="border-t border-slate-700 pt-1 mt-1">
              <div className="text-rose-300 font-bold mb-0.5">PHASE 3 (CORE FAILURE):</div>
              <button
                type="button"
                onClick={onForcePhase3}
                className="w-full text-[8px] bg-rose-800 text-white rounded px-1 py-0.5 mb-1 active:scale-95"
              >
                FORCE PHASE 3
              </button>
              <button
                type="button"
                onClick={onForceMeltdown}
                className="w-full text-[8px] bg-orange-800 text-white rounded px-1 py-0.5 mb-1 active:scale-95"
              >
                FORCE MELTDOWN ZONES
              </button>
              <button
                type="button"
                onClick={onForceCoreDischarge}
                className="w-full text-[8px] bg-fuchsia-800 text-white rounded px-1 py-0.5 mb-1 active:scale-95"
              >
                FORCE CORE DISCHARGE
              </button>
              <button
                type="button"
                onClick={onResetPhase3}
                className="w-full text-[8px] bg-slate-700 text-amber-100 rounded px-1 py-0.5 active:scale-95"
              >
                RESET TO PHASE 2
              </button>
            </div>
          </div>

          {/* Defeat & reward transaction controls */}
          <div className="border-t border-slate-700 pt-1 mt-1">
            <div className="text-rose-300 font-bold mb-0.5">DEFEAT & REWARDS:</div>
            <button
              type="button"
              onClick={onForceDefeat}
              className="w-full text-[8px] bg-rose-900 text-white rounded px-1 py-0.5 mb-1 active:scale-95"
            >
              FORCE DEFEAT (HP=0)
            </button>
            <button
              type="button"
              onClick={onSimulateFirstClear}
              className="w-full text-[8px] bg-emerald-800 text-white rounded px-1 py-0.5 mb-1 active:scale-95"
            >
              SIMULATE FIRST CLEAR
            </button>
            <button
              type="button"
              onClick={onSimulateReplay}
              className="w-full text-[8px] bg-teal-800 text-white rounded px-1 py-0.5 mb-1 active:scale-95"
            >
              SIMULATE REPLAY
            </button>
            <button
              type="button"
              onClick={onTestDuplicateCommit}
              className="w-full text-[8px] bg-slate-700 text-amber-100 rounded px-1 py-0.5 mb-1 active:scale-95"
            >
              TEST DUPLICATE COMMIT
            </button>
            <div className="text-slate-400 text-[8px]">
              commitState: {commitState ? 'COMMITTED' : 'idle'}
            </div>
            {nanoCubeInfo && (
              <div className="text-cyan-300 text-[8px] mt-0.5">
                <div>nanoCubes: +{nanoCubeInfo.earned} ({nanoCubeInfo.before}→{nanoCubeInfo.after})</div>
                <div>{nanoCubeInfo.isFirstClear ? 'FIRST CLEAR' : 'REPLAY'}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}