import React from 'react';
import { Crown, Check, AlertTriangle, Coins, Gem, Zap, Box, Clock } from 'lucide-react';

// Commander preview + confirmation panel. Shows after a valid target is
// selected. Displays skill name, target, affected area/units, predicted
// effect, exact resource cost, current resource balance, and
// CONFIRM COMMAND / CANCEL buttons.
//
// CANCEL returns to targeting mode (does not close targeting entirely for
// non-GLOBAL skills). CONFIRM calls the transaction handler which performs
// full revalidation before deducting any resources.

const RESOURCE_META = [
  { key: 'credits', icon: Coins, label: 'Credits', cls: 'text-amber-300' },
  { key: 'alienMaterials', icon: Gem, label: 'Alien Mats', cls: 'text-cyan-300' },
  { key: 'powerCores', icon: Zap, label: 'Power Cores', cls: 'text-fuchsia-300' },
  { key: 'nanoCubes', icon: Box, label: 'Nano Cubes', cls: 'text-emerald-300' },
];

// Map resourceCosts key → campaign resource key for balance lookup.
const COST_TO_BALANCE = {
  credits: 'credits',
  alienMaterials: 'alien_materials',
  powerCores: 'powerCores',
  nanoCubes: 'nanoCubes',
};

function CostBalanceRow({ cost, resources }) {
  const rows = RESOURCE_META.filter((m) => cost[m.key] > 0);
  if (rows.length === 0) {
    return (
      <div className="text-[10px] font-mono text-slate-500">
        COST: FREE
      </div>
    );
  }
  return (
    <div className="rounded-md bg-slate-900/60 border border-slate-700/50 px-2.5 py-2 space-y-1">
      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Cost</div>
      {rows.map((m) => {
        const balanceKey = COST_TO_BALANCE[m.key];
        const balance = resources ? (resources[balanceKey] ?? 0) : 0;
        const need = cost[m.key];
        const enough = balance >= need;
        return (
          <div key={m.key} className="flex items-center justify-between">
            <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${m.cls}`}>
              <m.icon className="w-3.5 h-3.5" /> {need} {m.label}
            </span>
            <span className={`text-[10px] font-mono ${enough ? 'text-slate-400' : 'text-rose-400'}`}>
              have {balance}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function CommanderPreviewPanel({ preview, resources, onConfirm, onCancel }) {
  if (!preview) return null;

  const canConfirm = preview.canConfirm;
  const isHighValue = preview.requiresHighValueConfirmation;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-30 px-2 pb-1 pointer-events-none">
      <div className="pointer-events-auto rounded-lg bg-slate-950/95 border-2 border-violet-600/70 shadow-2xl shadow-violet-900/40 p-3 max-w-md mx-auto">
        {/* Header: skill name + target */}
        <div className="flex items-center gap-2 mb-2">
          <Crown className="w-4 h-4 text-violet-400 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-black tracking-wider uppercase text-violet-300 leading-none">
              Commander Preview
            </div>
            <div className="text-white font-bold text-sm tracking-wide truncate leading-tight mt-0.5">
              {preview.skillName}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[9px] uppercase tracking-wider text-slate-400">Target</div>
            <div className="text-white font-bold text-xs truncate max-w-[120px]">{preview.targetLabel}</div>
          </div>
        </div>

        {/* Affected units (area skills) */}
        {preview.affectedUnits.length > 0 && (
          <div className="mb-2 rounded-md bg-slate-900/60 border border-slate-700/50 px-2 py-1.5">
            <div className="text-[9px] uppercase tracking-wider text-slate-400 mb-1">
              Affected ({preview.affectedUnits.length})
            </div>
            <div className="flex flex-wrap gap-1">
              {preview.affectedUnits.slice(0, 6).map((u) => (
                <span
                  key={u.id}
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    u.team === 'player' ? 'bg-sky-900/50 text-sky-300' : 'bg-rose-900/50 text-rose-300'
                  }`}
                >
                  {u.name}
                </span>
              ))}
              {preview.affectedUnits.length > 6 && (
                <span className="text-[10px] text-slate-400 px-1.5 py-0.5">
                  +{preview.affectedUnits.length - 6} more
                </span>
              )}
            </div>
            {preview.friendlyUnits.length > 0 && (
              <div className="mt-1 flex items-center gap-1 text-[9px] font-bold text-amber-300">
                <AlertTriangle className="w-2.5 h-2.5" />
                Friendly fire: {preview.friendlyUnits.length} ally unit{preview.friendlyUnits.length === 1 ? '' : 's'} affected
              </div>
            )}
          </div>
        )}

        {/* Effect text */}
        <div className="text-[11px] text-slate-300 leading-snug mb-2">{preview.effectText}</div>

        {/* Timing indicator */}
        {preview.timingType === 'delayed' && (
          <div className="mb-2">
            <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-orange-300">
              <Clock className="w-3 h-3" /> Effect resolves later
            </span>
          </div>
        )}

        {/* High-value warning (Power Core / Nano Cube costs) */}
        {isHighValue && canConfirm && (
          <div className="mb-2 flex items-start gap-1.5 text-[10px] font-bold text-amber-300 bg-amber-950/40 border border-amber-700/50 rounded px-2 py-1.5">
            <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
            <span>High-value resource — confirm carefully.</span>
          </div>
        )}

        {/* Cost + balance */}
        <div className="mb-2.5">
          <CostBalanceRow cost={preview.resourceCosts} resources={resources} />
        </div>

        {/* Block reason */}
        {!canConfirm && preview.blockReason && (
          <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold text-rose-300 bg-rose-950/50 border border-rose-700/50 rounded px-2 py-1">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            {preview.blockReason}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 rounded-lg border border-slate-600 bg-slate-800 text-slate-300 text-xs font-bold tracking-wide uppercase active:scale-95 transition touch-manipulation"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm}
            className={`flex-[2] py-3 rounded-lg border text-xs font-bold tracking-wide uppercase transition touch-manipulation flex items-center justify-center gap-1.5 ${
              canConfirm
                ? 'border-violet-300 bg-violet-600 text-white active:bg-violet-700'
                : 'border-slate-700 bg-slate-800 text-slate-600 cursor-not-allowed'
            }`}
          >
            <Check className="w-4 h-4" />
            Confirm Command
          </button>
        </div>
      </div>
    </div>
  );
}