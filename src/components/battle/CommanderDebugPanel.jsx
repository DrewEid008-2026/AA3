import React, { useState } from 'react';
import { Crown, FlaskConical, ShieldX, ShieldCheck, Plus, Minus, Coins, Gem, Zap, Box, History, RotateCcw, AlertOctagon } from 'lucide-react';
import {
  getDevCommanderSkillIds,
  getCommanderSkill,
  COMMANDER_TARGET_TYPES,
} from '@/game/commanderSkills';

// Development-only debug panel for Commander targeting + resource payment.
// Shown when debug mode is active. Lets the developer:
//   - inject/remove dev skills
//   - toggle COMMANDER_IMMUNE on units
//   - set each campaign resource to an exact value
//   - run each resource-cost dev command directly
//   - inspect transaction history + committed IDs
//   - simulate transaction failure (effect init fail → refund)
//   - reset battle-level transaction state
//
// NOT exposed to players.
export default function CommanderDebugPanel({
  debug,
  commanderUnlockedSkills,
  commanderTargeting,
  units,
  selectedUnitId,
  resources,
  transactionHistory,
  committedTxCount,
  onInjectDevSkills,
  onClearDevSkills,
  onToggleImmune,
  onSetResource,
  onRunDevSkill,
  onSimulateFail,
  onResetTxState,
  onUnlockTacticalAdvance,
  onRemoveTacticalAdvance,
  lastUnitEffect,
}) {
  const [showHistory, setShowHistory] = useState(false);
  if (!debug) return null;

  const devIds = getDevCommanderSkillIds();
  const hasDevSkills = devIds.every((id) => commanderUnlockedSkills.some((s) => s.id === id));
  const hasTacticalAdvance = commanderUnlockedSkills.some((s) => s.id === 'player_tactical_advance');
  const selectedUnit = units.find((u) => u.id === selectedUnitId);

  const activeSkill = commanderTargeting ? getCommanderSkill(commanderTargeting.skillId) : null;
  const validTargetCount = commanderTargeting ? (() => {
    const skill = activeSkill;
    if (!skill) return 0;
    if (skill.targetType === COMMANDER_TARGET_TYPES.GLOBAL) return 1;
    if ([COMMANDER_TARGET_TYPES.FRIENDLY_UNIT, COMMANDER_TARGET_TYPES.ENEMY_UNIT, COMMANDER_TARGET_TYPES.ANY_UNIT].includes(skill.targetType)) {
      return units.filter((u) => u.alive).length;
    }
    return 0;
  })() : 0;

  // Resource-cost dev skills for direct testing
  const paymentDevSkills = devIds.filter((id) => {
    const s = getCommanderSkill(id);
    return s && (s.resourceCosts.credits > 0 || s.resourceCosts.alienMaterials > 0 || s.resourceCosts.powerCores > 0 || s.resourceCosts.nanoCubes > 0);
  });

  const resourceControls = [
    { key: 'credits', icon: Coins, label: 'Credits', cls: 'text-amber-300' },
    { key: 'alien_materials', icon: Gem, label: 'Alien Mats', cls: 'text-cyan-300' },
    { key: 'powerCores', icon: Zap, label: 'Power Cores', cls: 'text-fuchsia-300' },
    { key: 'nanoCubes', icon: Box, label: 'Nano Cubes', cls: 'text-emerald-300' },
  ];

  return (
    <div className="rounded-lg border border-violet-700/40 bg-slate-900/60 p-3 text-[10px] font-mono text-slate-400 space-y-2 max-h-[60dvh] overflow-y-auto">
      <div className="text-violet-400 font-bold uppercase tracking-wider text-[9px] flex items-center gap-1">
        <Crown className="w-3 h-3" /> Commander Debug
      </div>

      {/* State inspector */}
      <div className="rounded bg-slate-950/50 border border-slate-700/50 p-2 leading-relaxed">
        <div>unlockedSkills: {commanderUnlockedSkills.length}</div>
        <div>ids: [{commanderUnlockedSkills.map((s) => s.id).join(', ')}]</div>
        <div className="mt-1">resources:</div>
        <div className="pl-2">
          <div>credits: {resources?.credits ?? '?'}</div>
          <div>alien_materials: {resources?.alien_materials ?? '?'}</div>
          <div>powerCores: {resources?.powerCores ?? '?'}</div>
          <div>nanoCubes: {resources?.nanoCubes ?? '?'}</div>
        </div>
        <div className="mt-1">committedTx: {committedTxCount}</div>
        {commanderTargeting ? (
          <>
            <div className="text-violet-300 mt-1">targeting:</div>
            <div>  skill: {commanderTargeting.skillId}</div>
            <div>  targetType: {activeSkill?.targetType || '?'}</div>
            <div>  validTargets: {validTargetCount}</div>
            <div>  txId: {commanderTargeting.transactionId || 'none'}</div>
            <div>  selectedTarget: {commanderTargeting.selectedTarget ? JSON.stringify(commanderTargeting.selectedTarget) : 'null'}</div>
          </>
        ) : (
          <div className="text-slate-500 mt-1">targeting: inactive</div>
        )}
      </div>

      {/* Dev skill injection */}
      <div className="flex flex-col gap-1">
        <div className="text-[9px] uppercase tracking-wider text-slate-500 flex items-center gap-1">
          <FlaskConical className="w-3 h-3" /> Dev Skills
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onInjectDevSkills}
            disabled={hasDevSkills}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded border border-violet-600/50 bg-violet-900/30 text-violet-200 text-[10px] font-bold active:scale-95 touch-manipulation disabled:opacity-50"
          >
            <Plus className="w-3 h-3" /> Inject
          </button>
          <button
            type="button"
            onClick={onClearDevSkills}
            disabled={!hasDevSkills}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded border border-slate-600 bg-slate-800 text-slate-300 text-[10px] font-bold active:scale-95 touch-manipulation disabled:opacity-50"
          >
            <Minus className="w-3 h-3" /> Remove
          </button>
        </div>
      </div>

      {/* Tactical Advance unlock/remove (production skill debug) */}
      <div className="flex flex-col gap-1">
        <div className="text-[9px] uppercase tracking-wider text-slate-500">Tactical Advance</div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onUnlockTacticalAdvance}
            disabled={hasTacticalAdvance}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded border border-emerald-600/50 bg-emerald-900/30 text-emerald-200 text-[10px] font-bold active:scale-95 touch-manipulation disabled:opacity-50"
          >
            <Plus className="w-3 h-3" /> Unlock
          </button>
          <button
            type="button"
            onClick={onRemoveTacticalAdvance}
            disabled={!hasTacticalAdvance}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded border border-slate-600 bg-slate-800 text-slate-300 text-[10px] font-bold active:scale-95 touch-manipulation disabled:opacity-50"
          >
            <Minus className="w-3 h-3" /> Remove
          </button>
        </div>
      </div>

      {/* Last unit effect (AP before/after inspection) */}
      {lastUnitEffect && (
        <div className="rounded bg-slate-950/50 border border-emerald-700/40 p-2 text-[9px] leading-relaxed">
          <div className="text-emerald-400 font-bold uppercase tracking-wider">Last Unit Effect</div>
          <div>type: {lastUnitEffect.type}</div>
          <div>target: {lastUnitEffect.targetName}</div>
          <div>AP: {lastUnitEffect.apBefore} → {lastUnitEffect.apAfter} (+{lastUnitEffect.amount})</div>
        </div>
      )}

      {/* Resource set controls */}
      <div className="flex flex-col gap-1">
        <div className="text-[9px] uppercase tracking-wider text-slate-500">Set Resources</div>
        {resourceControls.map((rc) => (
          <div key={rc.key} className="flex items-center gap-1">
            <rc.icon className={`w-3 h-3 ${rc.cls}`} />
            <span className="text-[9px] w-16">{rc.label}</span>
            <input
              type="number"
              defaultValue={resources?.[rc.key] ?? 0}
              key={`${rc.key}-${resources?.[rc.key] ?? 0}`}
              className="flex-1 w-12 px-1 py-0.5 rounded bg-slate-950 border border-slate-700 text-white text-[10px]"
              onChange={(e) => onSetResource(rc.key, parseInt(e.target.value, 10) || 0)}
            />
          </div>
        ))}
      </div>

      {/* Direct dev skill execution (payment test) */}
      {paymentDevSkills.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="text-[9px] uppercase tracking-wider text-slate-500">Run Payment Dev Skill</div>
          {paymentDevSkills.map((id) => {
            const s = getCommanderSkill(id);
            const cost = s.resourceCosts;
            const costStr = [
              cost.credits > 0 && `${cost.credits}C`,
              cost.alienMaterials > 0 && `${cost.alienMaterials}M`,
              cost.powerCores > 0 && `${cost.powerCores}P`,
              cost.nanoCubes > 0 && `${cost.nanoCubes}N`,
            ].filter(Boolean).join('/');
            return (
              <button
                key={id}
                type="button"
                onClick={() => onRunDevSkill(id)}
                className="flex items-center justify-between gap-1 px-2 py-1.5 rounded border border-violet-600/40 bg-violet-900/20 text-violet-200 text-[10px] font-bold active:scale-95 touch-manipulation"
              >
                <span>{s.name}</span>
                <span className="text-violet-400 font-mono">{costStr}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Immunity toggle */}
      <div className="flex flex-col gap-1">
        <div className="text-[9px] uppercase tracking-wider text-slate-500 flex items-center gap-1">
          <ShieldX className="w-3 h-3" /> Immunity Test
        </div>
        <button
          type="button"
          onClick={() => onToggleImmune(selectedUnitId)}
          disabled={!selectedUnit}
          className={`flex items-center gap-1.5 px-2 py-1.5 rounded border text-[10px] font-bold active:scale-95 touch-manipulation disabled:opacity-50 ${
            selectedUnit?.commanderImmune
              ? 'border-amber-500/60 bg-amber-900/30 text-amber-200'
              : 'border-slate-600 bg-slate-800 text-slate-300'
          }`}
        >
          {selectedUnit?.commanderImmune ? <ShieldCheck className="w-3 h-3" /> : <ShieldX className="w-3 h-3" />}
          {selectedUnit
            ? `${selectedUnit.commanderImmune ? 'Remove' : 'Apply'} IMMUNE on ${selectedUnit.name}`
            : 'Select a unit first'}
        </button>
      </div>

      {/* Transaction controls */}
      <div className="flex flex-col gap-1">
        <div className="text-[9px] uppercase tracking-wider text-slate-500 flex items-center gap-1">
          <AlertOctagon className="w-3 h-3" /> Transaction
        </div>
        <button
          type="button"
          onClick={onSimulateFail}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded border border-rose-600/50 bg-rose-900/30 text-rose-200 text-[10px] font-bold active:scale-95 touch-manipulation"
        >
          <AlertOctagon className="w-3 h-3" /> Simulate Fail (refund)
        </button>
        <button
          type="button"
          onClick={onResetTxState}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded border border-slate-600 bg-slate-800 text-slate-300 text-[10px] font-bold active:scale-95 touch-manipulation"
        >
          <RotateCcw className="w-3 h-3" /> Reset Tx State
        </button>
      </div>

      {/* Transaction history */}
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => setShowHistory((v) => !v)}
          className="text-[9px] uppercase tracking-wider text-slate-500 flex items-center gap-1 active:scale-95"
        >
          <History className="w-3 h-3" /> History ({transactionHistory?.length || 0}) {showHistory ? '▼' : '▶'}
        </button>
        {showHistory && transactionHistory && transactionHistory.length > 0 && (
          <div className="rounded bg-slate-950/50 border border-slate-700/50 p-2 space-y-1 max-h-32 overflow-y-auto">
            {transactionHistory.slice().reverse().map((tx, i) => (
              <div key={i} className={`text-[9px] ${tx.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                <span className="font-mono">{tx.transactionId?.slice(-8)}</span>
                {' '}
                <span className="font-bold">{tx.skillId}</span>
                {' '}
                <span>{tx.success ? 'OK' : `FAIL:${tx.failReason}`}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}