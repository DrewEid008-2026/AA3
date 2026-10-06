import React from 'react';
import { X, Skull, ShieldHalf, Heart, Crosshair, Swords, AlertTriangle } from 'lucide-react';

// Detailed Targeting Info confirmation panel. Read-only preview of the
// deterministic attack result before the player commits via FIRE. Canceling
// spends nothing (no AP / ammo / cooldown / uses) — the parent keeps targeting.

const TONE_COLORS = {
  base: 'text-slate-200',
  cover: 'text-sky-300',
  flank: 'text-amber-300',
  penalty: 'text-rose-300',
  bonus: 'text-emerald-300',
  armor: 'text-slate-300',
  shield: 'text-cyan-300',
  round: 'text-slate-400',
  hp: 'text-rose-400',
  sprint: 'text-slate-300',
};

function StepRow({ step }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-[11px] leading-tight">
      <span className={`${TONE_COLORS[step.type] || 'text-slate-300'}`}>{step.label}</span>
      <span className="font-mono text-slate-200">{step.value}{step.detail ? <span className="text-slate-500"> ({step.detail})</span> : null}</span>
    </div>
  );
}

function UnitCard({ u, expanded }) {
  const friendly = u.isFriendly;
  const lethalLabel = u.killed ? 'KILL' : u.downed ? 'DOWNED' : null;
  return (
    <div className={`rounded-lg border p-2.5 ${
      friendly
        ? 'bg-sky-950/40 border-sky-700/60'
        : lethalLabel
          ? 'bg-rose-950/40 border-rose-700/60'
          : 'bg-slate-900/60 border-slate-700'
    }`}>
      {friendly && (
        <div className="flex items-center gap-1 mb-1 text-[10px] font-bold tracking-wider text-sky-300 uppercase">
          <AlertTriangle className="w-3 h-3" /> Friendly unit affected
        </div>
      )}
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${
          friendly ? 'bg-sky-800/60' : 'bg-rose-900/50'
        }`}>
          <Crosshair className={`w-5 h-5 ${friendly ? 'text-sky-300' : 'text-rose-300'}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-white font-bold text-sm tracking-wide truncate">{u.name}</div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <Heart className="w-3 h-3 text-rose-400" />
            <span>{u.hp}/{u.maxHp}</span>
            {u.armor > 0 && <span className="text-slate-300">· Armor {u.armor}</span>}
          </div>
        </div>
      </div>

      {u.statuses.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {u.statuses.map((s, i) => (
            <span key={i} className={`px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide uppercase ${
              s.tone === 'flank' ? 'bg-amber-500/20 text-amber-300'
                : s.tone === 'cover' ? 'bg-sky-500/20 text-sky-300'
                : s.tone === 'shield' ? 'bg-cyan-500/20 text-cyan-300'
                : 'bg-slate-700/60 text-slate-300'
            }`}>{s.label}</span>
          ))}
        </div>
      )}

      <div className="space-y-0.5 mb-1.5">
        <StepRow step={{ label: 'Base Damage', type: 'base', value: u.baseDamage }} />
        {u.trace && u.trace.map((s, i) => <StepRow key={i} step={s} />)}
      </div>

      <div className="flex items-center justify-between border-t border-slate-700/60 pt-1.5">
        <span className="text-[11px] font-bold tracking-wide text-slate-400 uppercase">Final HP Damage</span>
        <span className={`font-black text-base ${lethalLabel ? 'text-rose-400' : u.hpDamage === 0 ? 'text-slate-400' : 'text-white'}`}>
          {u.hpDamage === 0 && (u.shieldAbsorbed > 0 || u.coreShieldAbsorbed > 0) ? '0' : u.hpDamage}
          {lethalLabel && <span className="ml-1.5 text-rose-400">— {lethalLabel}</span>}
        </span>
      </div>
      <div className="flex items-center justify-between mt-0.5">
        <span className="text-[10px] text-slate-500 uppercase tracking-wide">Predicted HP</span>
        <span className="text-[11px] font-mono text-slate-300">{u.predictedHp} / {u.maxHp}</span>
      </div>
      {u.armorShred > 0 && (
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-[10px] text-yellow-500 uppercase tracking-wide">Armor Shred</span>
          <span className="text-[11px] font-mono text-yellow-400">−{u.armorShred} → {u.armorAfter}/{u.baseArmor}</span>
        </div>
      )}
    </div>
  );
}

function TerrainCard({ t }) {
  const destroyed = t.destroyed;
  return (
    <div className={`rounded-lg border p-2.5 ${destroyed ? 'bg-orange-950/40 border-orange-700/60' : 'bg-slate-900/60 border-slate-700'}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <ShieldHalf className={`w-3.5 h-3.5 ${destroyed ? 'text-orange-400' : 'text-slate-400'}`} />
        <span className="text-white font-bold text-xs tracking-wide">{t.label}</span>
      </div>
      <div className="flex items-center justify-between text-[11px] text-slate-300">
        <span>HP {t.currentHp}/{t.maxHp}</span>
        <span className="text-slate-400">Damage <span className="font-mono text-slate-200">{t.terrainDamage}</span></span>
      </div>
      <div className="flex items-center justify-between mt-0.5">
        <span className="text-[10px] text-slate-500 uppercase tracking-wide">After</span>
        <span className={`text-[11px] font-mono ${destroyed ? 'text-orange-400 font-bold' : 'text-slate-300'}`}>
          {Math.max(0, t.predictedHp)}/{t.maxHp}
          {destroyed && <span className="ml-1.5 font-bold">— DESTROYED</span>}
        </span>
      </div>
      {!destroyed && t.providesCover && (
        <div className="mt-1 text-[9px] text-sky-400/80 uppercase tracking-wide">Provides cover</div>
      )}
      {destroyed && (
        <div className="mt-1 text-[9px] text-orange-400 uppercase tracking-wide">Cover will be destroyed</div>
      )}
    </div>
  );
}

export default function AttackPreviewPanel({ preview, onFire, onCancel, fireReason }) {
  if (!preview) return null;
  const units = preview.affectedUnits || [];
  const terrain = preview.affectedTerrain || [];
  const costs = preview.costs || {};
  const isGrenade = preview.kind === 'grenade';
  const canFire = !fireReason;

  return (
    <div className="absolute inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/85 backdrop-blur-sm">
      <div className="w-full max-w-md max-h-[92dvh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-slate-700 bg-slate-900/60">
          <div className="flex items-center gap-2">
            <Swords className="w-4 h-4 text-amber-400" />
            <span className="text-white font-bold text-sm tracking-wide uppercase">
              {isGrenade ? 'Grenade Preview' : 'Attack Preview'}
            </span>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-md bg-slate-800 text-slate-300 active:scale-95 touch-manipulation"
            aria-label="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-2.5">
          {isGrenade && (
            <div className="text-center text-[11px] text-slate-400 uppercase tracking-wider">
              {units.length} Unit{units.length !== 1 ? 's' : ''} · {terrain.length} Terrain
            </div>
          )}

          {units.length > 0 && (
            <div className={isGrenade ? 'space-y-2' : ''}>
              {units.map((u) => <UnitCard key={u.unitId} u={u} />)}
            </div>
          )}

          {terrain.length > 0 && (
            <div>
              {!isGrenade && <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5 px-1">Terrain</div>}
              <div className="space-y-2">
                {terrain.map((t, i) => <TerrainCard key={i} t={t} />)}
              </div>
            </div>
          )}

          {units.length === 0 && terrain.length === 0 && (
            <div className="text-center text-slate-500 text-sm py-4">No targets affected.</div>
          )}
        </div>

        {/* Costs + actions */}
        <div className="shrink-0 px-3 py-2.5 border-t border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-center gap-3 text-[11px] text-slate-300 mb-2">
            {costs.ap != null && <span><span className="text-slate-500">AP</span> <span className="font-bold text-white">{costs.ap}</span></span>}
            {costs.ammo != null && costs.ammo > 0 && <span><span className="text-slate-500">Ammo</span> <span className="font-bold text-white">{costs.ammo}</span></span>}
            {costs.cooldownAfter != null && <span><span className="text-slate-500">CD</span> <span className="font-bold text-white">{costs.cooldownAfter}</span></span>}
            {costs.usesRemaining != null && costs.usesRemaining !== Infinity && <span><span className="text-slate-500">Uses</span> <span className="font-bold text-white">{costs.usesRemaining}</span></span>}
          </div>
          {fireReason && (
            <div className="text-center text-[11px] text-rose-400 mb-2 font-bold tracking-wide uppercase">{fireReason}</div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-3.5 rounded-lg border border-slate-600 bg-slate-800 text-slate-200 text-sm font-bold tracking-wide uppercase active:scale-95 touch-manipulation"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onFire}
              disabled={!canFire}
              className={`flex-[1.4] py-3.5 rounded-lg border text-base font-black tracking-[0.15em] uppercase active:scale-95 touch-manipulation flex items-center justify-center gap-2 ${
                canFire
                  ? 'bg-rose-600 text-white border-rose-400 shadow-lg shadow-rose-900/40'
                  : 'bg-slate-800 text-slate-600 border-slate-700 cursor-not-allowed'
              }`}
            >
              <Skull className="w-5 h-5" />
              Fire
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}