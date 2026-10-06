import React from 'react';
import { Crown, X, Crosshair, Coins, Gem, Zap, Globe, Users, Square, Hexagon, Box, AlertTriangle, Clock, Ban } from 'lucide-react';
import { COMMANDER_TARGET_TYPES, canAffordCommanderSkill, COMMANDER_SKILL_STATUS } from '@/game/commanderSkills';

// Modal panel listing unlocked Commander skills. Shows live campaign resources
// at the top, exact costs on each card, and disables unaffordable skills so the
// player cannot enter targeting only to discover the cost cannot be paid.

const TARGET_TYPE_ICONS = {
  [COMMANDER_TARGET_TYPES.GLOBAL]: Globe,
  [COMMANDER_TARGET_TYPES.FRIENDLY_UNIT]: Users,
  [COMMANDER_TARGET_TYPES.ENEMY_UNIT]: Crosshair,
  [COMMANDER_TARGET_TYPES.ANY_UNIT]: Users,
  [COMMANDER_TARGET_TYPES.TILE]: Square,
  [COMMANDER_TARGET_TYPES.AREA]: Hexagon,
  [COMMANDER_TARGET_TYPES.FRIENDLY_AREA]: Hexagon,
  [COMMANDER_TARGET_TYPES.ENEMY_AREA]: Hexagon,
};

const TARGET_TYPE_LABELS = {
  [COMMANDER_TARGET_TYPES.GLOBAL]: 'GLOBAL',
  [COMMANDER_TARGET_TYPES.FRIENDLY_UNIT]: 'FRIENDLY',
  [COMMANDER_TARGET_TYPES.ENEMY_UNIT]: 'ENEMY',
  [COMMANDER_TARGET_TYPES.ANY_UNIT]: 'ANY UNIT',
  [COMMANDER_TARGET_TYPES.TILE]: 'TILE',
  [COMMANDER_TARGET_TYPES.AREA]: 'AREA',
  [COMMANDER_TARGET_TYPES.FRIENDLY_AREA]: 'FRIENDLY AREA',
  [COMMANDER_TARGET_TYPES.ENEMY_AREA]: 'ENEMY AREA',
};

// Resource bar at the top of the panel. Shows live campaign balances.
function ResourceBar({ resources }) {
  if (!resources) return null;
  const items = [
    { icon: Coins, label: resources.credits ?? 0, cls: 'text-amber-300' },
    { icon: Gem, label: resources.alien_materials ?? 0, cls: 'text-cyan-300' },
    { icon: Zap, label: resources.powerCores ?? 0, cls: 'text-fuchsia-300' },
    { icon: Box, label: resources.nanoCubes ?? 0, cls: 'text-emerald-300' },
  ];
  return (
    <div className="flex items-center justify-center gap-3 px-3 py-2 rounded-md bg-slate-900/80 border border-slate-700/50">
      {items.map((it, i) => (
        <span key={i} className={`inline-flex items-center gap-1 text-[11px] font-bold ${it.cls}`}>
          <it.icon className="w-3.5 h-3.5" /> {it.label}
        </span>
      ))}
    </div>
  );
}

// Cost badge for a skill card. Shows all nonzero resource costs.
function CostBadge({ cost }) {
  const parts = [];
  if (cost.credits > 0) parts.push({ icon: Coins, label: cost.credits, cls: 'text-amber-300' });
  if (cost.alienMaterials > 0) parts.push({ icon: Gem, label: cost.alienMaterials, cls: 'text-cyan-300' });
  if (cost.powerCores > 0) parts.push({ icon: Zap, label: cost.powerCores, cls: 'text-fuchsia-300' });
  if (cost.nanoCubes > 0) parts.push({ icon: Box, label: cost.nanoCubes, cls: 'text-emerald-300' });
  if (parts.length === 0) return <span className="text-[10px] text-slate-500 font-mono">FREE</span>;
  return (
    <div className="flex items-center gap-2">
      {parts.map((p, i) => (
        <span key={i} className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${p.cls}`}>
          <p.icon className="w-3 h-3" /> {p.label}
        </span>
      ))}
    </div>
  );
}

// Status badge for a skill card. Uses the centralized canUseCommanderSkill
// status to show the highest-priority restriction (§18 priority order).
function StatusBadge({ status, statusLabel, cooldownRemaining, usesRemaining }) {
  const config = {
    [COMMANDER_SKILL_STATUS.AVAILABLE]: { cls: 'text-emerald-400', icon: null },
    [COMMANDER_SKILL_STATUS.INSUFFICIENT_RESOURCES]: { cls: 'text-rose-400', icon: AlertTriangle },
    [COMMANDER_SKILL_STATUS.ON_COOLDOWN]: { cls: 'text-orange-400', icon: Clock },
    [COMMANDER_SKILL_STATUS.NO_USES]: { cls: 'text-slate-400', icon: Ban },
    [COMMANDER_SKILL_STATUS.NO_VALID_TARGETS]: { cls: 'text-amber-400', icon: AlertTriangle },
    [COMMANDER_SKILL_STATUS.WRONG_PHASE]: { cls: 'text-slate-500', icon: Clock },
    [COMMANDER_SKILL_STATUS.SYSTEM_UNAVAILABLE]: { cls: 'text-slate-500', icon: Ban },
  };
  const c = config[status] || config[COMMANDER_SKILL_STATUS.AVAILABLE];
  const Icon = c.icon;
  let label = statusLabel;
  if (status === COMMANDER_SKILL_STATUS.ON_COOLDOWN && cooldownRemaining > 0) {
    label = `COOLDOWN: ${cooldownRemaining}`;
  }
  if (status === COMMANDER_SKILL_STATUS.NO_USES && usesRemaining != null) {
    label = `NO USES (${usesRemaining} LEFT)`;
  }
  return (
    <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider ${c.cls}`}>
      {Icon && <Icon className="w-2.5 h-2.5" />} {label}
    </span>
  );
}

export default function CommanderSkillsPanel({ skills, resources, onSelect, onClose, disabled, getSkillStatus }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/85 backdrop-blur-sm">
      <div className="w-full max-w-md sm:rounded-xl bg-slate-950 border border-violet-700/60 shadow-2xl max-h-[80dvh] flex flex-col">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-violet-800/50">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-violet-400" />
            <span className="text-white font-black text-sm tracking-wider uppercase">Commander Skills</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={disabled}
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 active:scale-95 touch-manipulation disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live campaign resources */}
        <div className="shrink-0 px-3 pt-3">
          <ResourceBar resources={resources} />
        </div>

        {/* Skill list */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
          {skills.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              No Commander skills available.
            </div>
          ) : (
            skills.map((skill) => {
              const Icon = TARGET_TYPE_ICONS[skill.targetType] || Crosshair;
              const cost = skill.resourceCosts || { credits: 0, alienMaterials: 0, powerCores: 0, nanoCubes: 0 };
              const status = getSkillStatus ? getSkillStatus(skill.id) : null;
              const canUse = status ? status.canUse : (resources ? canAffordCommanderSkill(skill.id, resources).canAfford : true);
              const isDisabled = disabled || !canUse;
              const statusLabel = status ? status.statusLabel : (canUse ? 'AVAILABLE' : 'INSUFFICIENT');
              const insufficientLabel = status?.status === COMMANDER_SKILL_STATUS.INSUFFICIENT_RESOURCES ? status.reason : '';
              return (
                <button
                  key={skill.id}
                  type="button"
                  onClick={() => onSelect(skill)}
                  disabled={isDisabled}
                  className={`w-full text-left rounded-lg border p-3 active:scale-[0.98] transition-transform touch-manipulation disabled:opacity-60 disabled:cursor-not-allowed ${
                    canUse
                      ? 'border-violet-700/50 bg-violet-950/20'
                      : 'border-rose-800/40 bg-rose-950/20'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-md flex items-center justify-center shrink-0 ${canUse ? 'bg-violet-900/40' : 'bg-rose-900/30'}`}>
                      <Icon className={`w-5 h-5 ${canUse ? 'text-violet-300' : 'text-rose-300'}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white font-bold text-sm tracking-wide">{skill.name}</span>
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300">
                          {TARGET_TYPE_LABELS[skill.targetType] || skill.targetType}
                        </span>
                        {skill.isDev && (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                            DEV
                          </span>
                        )}
                      </div>
                      <div className="text-slate-400 text-[11px] mt-0.5 leading-snug">{skill.desc}</div>
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <CostBadge cost={cost} />
                        {status ? (
                          <StatusBadge
                            status={status.status}
                            statusLabel={statusLabel}
                            cooldownRemaining={status.cooldownRemaining}
                            usesRemaining={status.usesRemaining}
                          />
                        ) : canUse ? (
                          <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400">AVAILABLE</span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider text-rose-400">
                            <AlertTriangle className="w-2.5 h-2.5" /> INSUFFICIENT
                          </span>
                        )}
                      </div>
                      {insufficientLabel && (
                        <div className="mt-1 text-[9px] font-bold text-rose-400/80">{insufficientLabel}</div>
                      )}
                      {skill.timingType === 'delayed' && (
                        <div className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-orange-300">Delayed</div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="shrink-0 px-4 py-2.5 border-t border-slate-800 text-center">
          <span className="text-[10px] text-slate-500 tracking-wide">
            Commander skills act independently — no soldier AP required.
          </span>
        </div>
      </div>
    </div>
  );
}