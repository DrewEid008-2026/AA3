// Development-only enemy Commander inspector. Visible only when debug mode is
// active. Shows profile, budget, per-phase limit, skills with uses/cooldowns,
// pending effects, transaction state, and last execution result. Provides
// controls to force commands, simulate duplicate execution, spend/reset budget,
// force a commander, run AI evaluation, and tune AI overrides.
//
// NOT exposed to players.

import React from 'react';
import { Bug, RotateCcw, Minus, Crosshair, Copy, Play, Brain } from 'lucide-react';
import { getCommanderSkill } from '@/game/commanderSkills';
import { getAllEnemyCommanderIdsForDebug } from '@/game/enemyCommanders';

export default function EnemyCommanderDebugPanel({
  debug,
  profile,
  displayProfile,
  battleState,
  budgetCurrent,
  budgetMax,
  assignmentSource,
  assignmentValid,
  assignmentReason,
  devOverride,
  lastExecutionResult,
  lastEvaluation,
  aiOverrides,
  onSetDevOverride,
  onSpendCommandPoint,
  onResetBudget,
  onForceCommand,
  onSimulateDuplicate,
  onTriggerActionWindow,
  onRunEvaluation,
  onSetHoldThreshold,
  onSetReserveBias,
  onSetInvalidateTarget,
  units,
}) {
  if (!debug) return null;

  const devIds = getAllEnemyCommanderIdsForDebug();
  const knownSkills = profile ? (profile.skillIds || []).map((id) => getCommanderSkill(id)).filter(Boolean) : [];
  const forceableSkills = knownSkills.filter((s) => ['DEV_ENEMY_MARK', 'DEV_ENEMY_AP_BOOST', 'DEV_ENEMY_TILE', 'DEV_ENEMY_GLOBAL', 'DEV_ENEMY_AREA_TARGET', 'vexar_tactical_advance'].includes(s.id));
  const playerUnits = (units || []).filter((u) => u.team === 'player' && u.alive);

  return (
    <div className="absolute bottom-2 left-2 z-30 w-72 max-h-[80vh] overflow-y-auto rounded-lg bg-slate-950/95 border border-fuchsia-700/50 shadow-xl text-[10px] font-mono text-slate-300">
      <div className="flex items-center gap-1.5 px-2 py-1.5 bg-fuchsia-950/40 border-b border-fuchsia-800/40 sticky top-0">
        <Bug className="w-3 h-3 text-fuchsia-400" />
        <span className="font-bold text-fuchsia-300 tracking-wide">ENEMY COMMANDER</span>
      </div>

      <div className="p-2 space-y-2">
        {/* Assignment source */}
        <div className="space-y-0.5">
          <div className="text-fuchsia-400 font-bold">ASSIGNMENT</div>
          <div>source: <span className="text-amber-300">{assignmentSource}</span></div>
          <div>valid: <span className={assignmentValid ? 'text-emerald-400' : 'text-rose-400'}>{String(assignmentValid)}</span></div>
          {assignmentReason && <div className="text-rose-400">reason: {assignmentReason}</div>}
          <div>devOverride: <span className="text-amber-300">{devOverride === null ? 'null (mission field)' : devOverride}</span></div>
        </div>

        {/* Force override */}
        <div className="space-y-1">
          <div className="text-fuchsia-400 font-bold">FORCE COMMANDER</div>
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => onSetDevOverride(null)}
              className={`px-1.5 py-0.5 rounded border text-[9px] ${devOverride === null ? 'bg-fuchsia-800 border-fuchsia-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'}`}
            >
              MISSION
            </button>
            <button
              onClick={() => onSetDevOverride('NONE')}
              className={`px-1.5 py-0.5 rounded border text-[9px] ${devOverride === 'NONE' ? 'bg-rose-800 border-rose-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'}`}
            >
              NONE
            </button>
            {devIds.map((id) => (
              <button
                key={id}
                onClick={() => onSetDevOverride(id)}
                className={`px-1.5 py-0.5 rounded border text-[9px] ${devOverride === id ? 'bg-fuchsia-800 border-fuchsia-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'}`}
              >
                {id}
              </button>
            ))}
          </div>
        </div>

        {!profile ? (
          <div className="text-slate-500 italic py-2 text-center">No hostile commander assigned.</div>
        ) : (
          <>
            {/* Profile */}
            <div className="space-y-0.5">
              <div className="text-fuchsia-400 font-bold">PROFILE</div>
              <div>id: <span className="text-amber-300">{profile.commanderId}</span></div>
              <div>name: {displayProfile.displayName}</div>
              <div>title: {displayProfile.title}</div>
              <div>doctrine: {profile.doctrine}</div>
              <div>budget: {profile.commandBudget}</div>
              <div>max/phase: {profile.maxCommandsPerEnemyPhase}</div>
              <div>minScore: {profile.minimumCommandScore ?? '—'}</div>
              <div>reserveBias: {profile.reserveBias ?? '—'}</div>
              <div>emergencyBias: {profile.emergencyBias ?? '—'}</div>
              <div>chapters: [{(profile.allowedChapters || []).join(', ')}]</div>
              <div>missionTypes: {profile.allowedMissionTypes ? `[${profile.allowedMissionTypes.join(', ')}]` : 'ALL'}</div>
              <div>isDev: {String(profile.isDev)}</div>
            </div>

            {/* Budget */}
            <div className="space-y-1">
              <div className="text-fuchsia-400 font-bold">COMMAND BUDGET</div>
              <div className="flex items-center gap-2">
                <span className={`text-lg font-black ${budgetCurrent <= 0 ? 'text-rose-500' : 'text-amber-300'}`}>{budgetCurrent} / {budgetMax}</span>
                {battleState && (
                  <span className="text-slate-500">phase: {battleState.commandsUsedThisEnemyPhase}/{profile.maxCommandsPerEnemyPhase}</span>
                )}
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => onSpendCommandPoint(1)}
                  disabled={budgetCurrent <= 0}
                  className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-900/60 border border-amber-700/50 text-amber-300 disabled:opacity-40"
                >
                  <Minus className="w-2.5 h-2.5" /> Spend 1
                </button>
                <button
                  onClick={onResetBudget}
                  className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300"
                >
                  <RotateCcw className="w-2.5 h-2.5" /> Reset
                </button>
              </div>
            </div>

            {/* Skills */}
            <div className="space-y-0.5">
              <div className="text-fuchsia-400 font-bold">SKILLS</div>
              {knownSkills.length === 0 ? (
                <div className="text-slate-500 italic">none</div>
              ) : (
                knownSkills.map((s) => (
                  <div key={s.id} className="pl-1 border-l border-slate-700">
                    <div className="text-amber-300">{s.id}</div>
                    <div className="text-slate-500">
                      cp: {s.enemyCommandPointCost ?? 0} | uses: {s.usesPerMission ?? '∞'} | cd: {s.cooldown ?? 0}
                      {s.aiMetadata?.baseValue != null && ` | base: ${s.aiMetadata.baseValue}`}
                    </div>
                    {battleState && (
                      <div className="text-slate-600">
                        → usesLeft: {battleState.usesRemainingBySkillId?.[s.id] ?? '∞'} | cdLeft: {battleState.cooldownsBySkillId?.[s.id] ?? 0}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Dev-marked tracking */}
            {battleState?.devMarkedUnitIds?.length > 0 && (
              <div className="space-y-0.5">
                <div className="text-fuchsia-400 font-bold">DEV-MARKED</div>
                <div className="text-slate-500">{battleState.devMarkedUnitIds.length} soldier(s) marked</div>
              </div>
            )}

            {/* AI Evaluation */}
            <div className="space-y-1">
              <div className="text-fuchsia-400 font-bold">AI EVALUATION</div>
              <button
                onClick={onRunEvaluation}
                className="flex items-center gap-1 w-full px-1.5 py-1 rounded bg-violet-900/60 border border-violet-700/50 text-violet-300"
              >
                <Brain className="w-2.5 h-2.5" /> Run Evaluation (no execute)
              </button>

              {/* AI Overrides */}
              <div className="space-y-0.5 pl-1 border-l border-slate-700">
                <div className="text-slate-500">HOLD threshold: <span className="text-amber-300">{aiOverrides?.holdThreshold ?? profile.minimumCommandScore ?? '—'}</span></div>
                <input
                  type="number"
                  placeholder="override threshold"
                  value={aiOverrides?.holdThreshold ?? ''}
                  onChange={(e) => onSetHoldThreshold(e.target.value)}
                  className="w-full px-1 py-0.5 bg-slate-900 border border-slate-700 text-slate-300 text-[9px]"
                />
                <div className="text-slate-500">reserveBias: <span className="text-amber-300">{aiOverrides?.reserveBias ?? profile.reserveBias ?? '—'}</span></div>
                <input
                  type="number"
                  step="0.1"
                  placeholder="override reserveBias"
                  value={aiOverrides?.reserveBias ?? ''}
                  onChange={(e) => onSetReserveBias(e.target.value)}
                  className="w-full px-1 py-0.5 bg-slate-900 border border-slate-700 text-slate-300 text-[9px]"
                />
                <div className="text-slate-500">invalidate target:</div>
                <select
                  value={aiOverrides?.invalidateTargetId ?? ''}
                  onChange={(e) => onSetInvalidateTarget(e.target.value || null)}
                  className="w-full px-1 py-0.5 bg-slate-900 border border-slate-700 text-slate-300 text-[9px]"
                >
                  <option value="">none</option>
                  {playerUnits.map((u) => (
                    <option key={u.id} value={u.id}>{u.name || u.class || u.id}</option>
                  ))}
                </select>
              </div>

              {/* Last evaluation result */}
              {lastEvaluation && (
                <div className="space-y-0.5 pl-1 border-l border-violet-700/50">
                  <div className={lastEvaluation.shouldAct ? 'text-emerald-400' : 'text-amber-400'}>
                    {lastEvaluation.shouldAct ? `ACT: ${lastEvaluation.skillId}` : 'HOLD'}
                  </div>
                  <div className="text-slate-500">score: {lastEvaluation.score} / threshold: {lastEvaluation.holdThreshold}</div>
                  <div className="text-slate-500">{lastEvaluation.reason}</div>
                  {lastEvaluation.shouldAct && lastEvaluation.breakdown?.length > 0 && (
                    <div className="space-y-0.5">
                      <div className="text-violet-400 font-bold">BREAKDOWN</div>
                      {lastEvaluation.breakdown.map((b, i) => (
                        <div key={i} className="text-slate-500">
                          {b.label}: <span className={b.value >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{b.value >= 0 ? '+' : ''}{b.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {lastEvaluation.candidates?.length > 0 && (
                    <div className="space-y-0.5">
                      <div className="text-violet-400 font-bold">CANDIDATES ({lastEvaluation.candidates.length})</div>
                      {lastEvaluation.candidates.slice(0, 8).map((c, i) => (
                        <div key={i} className="text-slate-600">
                          {c.skillId}: <span className={c.score >= (lastEvaluation.holdThreshold) ? 'text-emerald-500' : 'text-slate-500'}>{c.score}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Pending effects */}
            <div className="space-y-0.5">
              <div className="text-fuchsia-400 font-bold">PENDING EFFECTS</div>
              <div>{battleState?.pendingCommanderEffects?.length || 0} pending</div>
            </div>

            {/* Transaction state */}
            <div className="space-y-0.5">
              <div className="text-fuchsia-400 font-bold">TRANSACTION</div>
              <div>activeTxId: <span className="text-amber-300">{battleState?.activeTransactionId || 'null'}</span></div>
            </div>

            {/* Execution controls */}
            <div className="space-y-1">
              <div className="text-fuchsia-400 font-bold">EXECUTE</div>
              <button
                onClick={onTriggerActionWindow}
                className="flex items-center gap-1 w-full px-1.5 py-1 rounded bg-violet-900/60 border border-violet-700/50 text-violet-300"
              >
                <Play className="w-2.5 h-2.5" /> Trigger Action Window
              </button>
              <div className="flex flex-wrap gap-1">
                {forceableSkills.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => onForceCommand(s.id)}
                    className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded border ${s.isDev ? 'bg-rose-900/60 border-rose-700/50 text-rose-300' : 'bg-amber-900/60 border-amber-700/50 text-amber-300'}`}
                  >
                    <Crosshair className="w-2.5 h-2.5" /> {s.isDev ? s.id.replace('DEV_ENEMY_', '') : s.name}
                  </button>
                ))}
              </div>
              <button
                onClick={onSimulateDuplicate}
                className="flex items-center gap-1 w-full px-1.5 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300"
              >
                <Copy className="w-2.5 h-2.5" /> Simulate Duplicate
              </button>
            </div>

            {/* Last execution result */}
            {lastExecutionResult && (
              <div className="space-y-0.5">
                <div className="text-fuchsia-400 font-bold">LAST RESULT</div>
                {lastExecutionResult.duplicateTest ? (
                  <>
                    <div className={lastExecutionResult.message.includes('BLOCKED') ? 'text-emerald-400' : 'text-rose-400'}>
                      {lastExecutionResult.message}
                    </div>
                    <div className="text-slate-500">1st: {lastExecutionResult.first?.ok ? 'OK' : lastExecutionResult.first?.result}</div>
                    <div className="text-slate-500">2nd: {lastExecutionResult.second?.ok ? 'OK' : lastExecutionResult.second?.result}</div>
                  </>
                ) : (
                  <>
                    <div className={lastExecutionResult.ok ? 'text-emerald-400' : 'text-rose-400'}>
                      {lastExecutionResult.ok ? 'SUCCESS' : lastExecutionResult.result}
                    </div>
                    {lastExecutionResult.skillId && <div className="text-slate-500">skill: {lastExecutionResult.skillId}</div>}
                    {lastExecutionResult.cost != null && <div className="text-slate-500">cost: {lastExecutionResult.cost} CP</div>}
                    {lastExecutionResult.targetApBefore != null && (
                      <div className="text-amber-300">target AP: {lastExecutionResult.targetApBefore} → {lastExecutionResult.targetApAfter}</div>
                    )}
                    {lastExecutionResult.message && <div className="text-slate-500">msg: {lastExecutionResult.message}</div>}
                    {lastExecutionResult.transactionId && <div className="text-slate-600">tx: {lastExecutionResult.transactionId.slice(-12)}</div>}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}