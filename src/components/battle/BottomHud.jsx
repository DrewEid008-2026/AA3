import React from 'react';
import { Swords, X, Hand, CheckCircle2, RefreshCw, HeartCrack, Check, Move } from 'lucide-react';
import { TEAMS } from '@/game/constants';
import { getUnitWeapon } from '@/game/combat';
import { getUnitAbilities } from '@/game/abilities';
import { getAmmo, getMaxAmmo, canReload, getReloadApCost } from '@/game/ammo';
import { getCurrentArmor, getBaseArmor } from '@/game/armorShred';
import AbilityButton from './AbilityButton';
import OverwatchButton from './OverwatchButton';

function ApDots({ current, max }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          className={`w-2.5 h-2.5 rounded-full ${i < current ? 'bg-amber-400' : 'bg-slate-600'}`}
        />
      ))}
    </div>
  );
}

function AmmoPips({ current, max }) {
  if (max === Infinity) return <span className="text-white font-bold text-sm leading-none">∞</span>;
  return (
    <div className="flex items-center justify-end gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${i < current ? 'bg-amber-400' : 'bg-slate-600'}`}
        />
      ))}
    </div>
  );
}

export default function BottomHud({
  selectedUnit,
  phase,
  attackMode,
  onAttackToggle,
  validTargetCount,
  activeAbility,
  onAbilityActivate,
  abilityTargetCount,
  onOverwatch,
  onReload,
  objectiveActions,
  movePreview,
  onConfirmMove,
  onCancelMovePreview,
  relocateAvailable,
  relocateMode,
  onStartRelocate,
  onSkipRelocate,
  onCancelRelocate,
}) {
  if (!selectedUnit) {
    return (
      <div className="shrink-0 px-4 py-3 bg-slate-900/95 border-t border-slate-700">
        <div className="flex items-center justify-center gap-2 text-slate-400 text-sm py-2">
          <Hand className="w-4 h-4" />
          <span>Tap a friendly unit to select it</span>
        </div>
      </div>
    );
  }

  // Downed units can't act — show a compact status bar instead of actions.
  if (selectedUnit.downed) {
    return (
      <div className="shrink-0 px-4 py-3 bg-slate-900/95 border-t border-slate-700">
        <div className="flex items-center justify-center gap-2 py-2">
          <HeartCrack className="w-4 h-4 text-rose-400" />
          <span className="text-rose-400 font-bold text-sm tracking-wide">DOWNED</span>
          <span className="text-rose-300 text-xs font-mono">Bleed Out: {selectedUnit.bleedOut}</span>
        </div>
      </div>
    );
  }

  const weapon = getUnitWeapon(selectedUnit);
  const isPlayer = selectedUnit.team === TEAMS.PLAYER;
  const hasAmmoNow = isPlayer && selectedUnit.alive && weapon ? getAmmo(selectedUnit) > 0 : false;
  const canAttack =
    isPlayer && phase === 'player' && selectedUnit.alive && weapon && selectedUnit.ap >= weapon.apCost && hasAmmoNow;
  const spent = isPlayer && selectedUnit.ap <= 0;
  const abilities = isPlayer ? getUnitAbilities(selectedUnit) : [];

  const ammoMax = weapon ? getMaxAmmo(selectedUnit) : 0;
  const ammoCur = weapon ? getAmmo(selectedUnit) : 0;
  const reloadable =
    isPlayer && phase === 'player' && selectedUnit.alive && canReload(selectedUnit) && selectedUnit.ap >= getReloadApCost(selectedUnit);

  return (
    <div className="shrink-0 px-3 py-2.5 bg-slate-900/95 border-t border-slate-700">
      <div className="flex items-center justify-between mb-2">
        <div className="min-w-0 flex items-center gap-2">
          <div className="min-w-0">
            <div className="text-white font-bold text-sm tracking-wide uppercase truncate">
              {selectedUnit.name}
            </div>
            <div className="text-[10px] text-slate-400 truncate">{selectedUnit.role}</div>
          </div>
          {spent && (
            <span className="inline-flex items-center gap-1 text-[9px] font-bold tracking-wider uppercase text-slate-400 bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded">
              <CheckCircle2 className="w-3 h-3" />
              Done
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[9px] uppercase tracking-wider text-slate-400">HP</div>
            <div className="text-white font-bold text-sm leading-none">
              {selectedUnit.hp}/{selectedUnit.maxHp}
            </div>
          </div>
          {(isPlayer || getBaseArmor(selectedUnit) > 0) && (
            <div className="text-right">
              <div className="text-[9px] uppercase tracking-wider text-slate-400">Armor</div>
              <div className="text-white font-bold text-sm leading-none">
                {getCurrentArmor(selectedUnit)}{getCurrentArmor(selectedUnit) < getBaseArmor(selectedUnit) && (
                  <span className="text-yellow-400">/{getBaseArmor(selectedUnit)}</span>
                )}
              </div>
            </div>
          )}
          <div className="text-right">
            <div className="text-[9px] uppercase tracking-wider text-slate-400 mb-1">AP</div>
            <ApDots current={Math.min(selectedUnit.ap, 3)} max={selectedUnit.maxAp} />
          </div>
          {weapon && (
            <button
              type="button"
              onClick={reloadable ? onReload : undefined}
              disabled={!reloadable}
              className={`text-right ${reloadable ? 'active:opacity-70' : 'cursor-default'}`}
              aria-label="Reload"
            >
              <div className="text-[9px] uppercase tracking-wider text-slate-400 flex items-center gap-0.5 justify-end">
                {reloadable && <RefreshCw className="w-2.5 h-2.5 text-amber-400" />}
                Ammo
              </div>
              <AmmoPips current={ammoCur} max={ammoMax} />
            </button>
          )}
        </div>
      </div>

      {/* Attack-mode preview strip */}
      {attackMode && weapon && (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-md bg-rose-950/60 border border-rose-700/60 px-2 py-1.5">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-rose-300/80">Attack Mode</div>
            <div className="text-white text-xs font-semibold truncate">
              {weapon.name} · DMG {weapon.damage} · {weapon.apCost} AP
            </div>
          </div>
          <div className="text-[10px] text-rose-200/80 text-right shrink-0">
            {validTargetCount > 0
              ? `${validTargetCount} target${validTargetCount === 1 ? '' : 's'}`
              : 'No targets'}
          </div>
        </div>
      )}

      {/* Ability-mode preview strip */}
      {activeAbility && (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-md bg-slate-800/80 border border-slate-600 px-2 py-1.5">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-slate-300">{activeAbility.name}</div>
            <div className="text-white text-xs font-semibold truncate">{activeAbility.desc}</div>
          </div>
          <div className="text-[10px] text-slate-200 text-right shrink-0">
            {activeAbility.targetType === 'tile_aoe'
              ? 'Tap impact tile'
              : activeAbility.targetType === 'tile'
                ? 'Tap adjacent tile'
                : activeAbility.targetType === 'barricade'
                  ? 'Tap tile, pick dir'
                  : abilityTargetCount > 0
                    ? `${abilityTargetCount} target${abilityTargetCount === 1 ? '' : 's'}`
                    : 'No targets'}
          </div>
        </div>
      )}

      {/* Movement preview confirm/cancel bar */}
      {movePreview && (
        <div className="mb-2 flex gap-2">
          <button
            type="button"
            onClick={onCancelMovePreview}
            className="flex-1 py-3 rounded-lg border border-slate-600 bg-slate-800 text-slate-300 text-xs font-bold tracking-wide uppercase active:scale-95 transition touch-manipulation"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirmMove}
            className="flex-[2] py-3 rounded-lg border border-sky-400 bg-sky-600 text-white text-xs font-bold tracking-wide uppercase active:scale-95 transition touch-manipulation flex items-center justify-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            Confirm Move · 1 AP
          </button>
        </div>
      )}

      {/* Relocate targeting cancel bar */}
      {relocateMode && (
        <div className="mb-2 flex gap-2">
          <button
            type="button"
            onClick={onCancelRelocate}
            className="flex-1 py-3 rounded-lg border border-slate-600 bg-slate-800 text-slate-300 text-xs font-bold tracking-wide uppercase active:scale-95 transition touch-manipulation"
          >
            Cancel Relocate
          </button>
        </div>
      )}

      {/* Contextual Relocate opportunity (after a kill) */}
      {relocateAvailable && !relocateMode && !movePreview && (
        <div className="mb-2 flex gap-2">
          <button
            type="button"
            onClick={onSkipRelocate}
            className="flex-1 py-3 rounded-lg border border-slate-600 bg-slate-800 text-slate-400 text-xs font-bold tracking-wide uppercase active:scale-95 transition touch-manipulation"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={onStartRelocate}
            className="flex-[2] py-3 rounded-lg border border-cyan-400 bg-cyan-600 text-white text-xs font-bold tracking-wide uppercase active:scale-95 transition touch-manipulation flex items-center justify-center gap-1.5"
          >
            <Move className="w-4 h-4" />
            Relocate · 0 AP
          </button>
        </div>
      )}

      {/* Contextual objective actions (EXTRACT, RESCUE, SABOTAGE) */}
      {objectiveActions && objectiveActions.length > 0 && (
        <div className="mb-2 flex gap-2">
          {objectiveActions.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={a.onClick}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-emerald-500/60 bg-emerald-600/20 text-emerald-200 text-xs font-bold tracking-wide uppercase active:scale-95 transition touch-manipulation"
            >
              <a.icon className="w-3.5 h-3.5" />
              {a.label}
              {a.apCost > 0 && <span className="text-emerald-400/70 text-[10px]">{a.apCost} AP</span>}
            </button>
          ))}
        </div>
      )}

      {/* Prominent reload button when out of ammo */}
      {isPlayer && weapon && !hasAmmoNow && reloadable && !attackMode && !activeAbility && !movePreview && (
        <button
          type="button"
          onClick={onReload}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-lg border-2 border-amber-400 bg-amber-500 text-slate-900 text-base font-black tracking-wide uppercase mb-2 active:scale-95 transition touch-manipulation animate-pulse shadow-lg shadow-amber-500/30"
        >
          <RefreshCw className="w-5 h-5" />
          Reload · {getReloadApCost(selectedUnit)} AP
        </button>
      )}

      {/* Primary Attack / Cancel button — large, thumb-friendly */}
      <button
        type="button"
        onClick={onAttackToggle}
        disabled={!canAttack && !attackMode}
        className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg border touch-manipulation transition-colors text-sm font-bold tracking-wide uppercase mb-2 ${
          attackMode
            ? 'bg-rose-600 text-white border-rose-300 active:bg-rose-700'
            : canAttack
              ? 'bg-rose-600/90 text-white border-rose-400/60 active:bg-rose-700'
              : 'bg-slate-800 text-slate-500 border-slate-700 opacity-60 cursor-not-allowed'
        }`}
      >
        {attackMode ? (
          <>
            <X className="w-4 h-4" /> Cancel
          </>
        ) : isPlayer && weapon && !hasAmmoNow ? (
          <>
            <Swords className="w-4 h-4" /> Attack · EMPTY
          </>
        ) : (
          <>
            <Swords className="w-4 h-4" /> Attack
          </>
        )}
      </button>

      {/* Class abilities + Overwatch slot */}
      <div className="grid grid-cols-3 gap-2">
        {abilities.map((a) => (
          <AbilityButton
            key={a.id}
            ability={a}
            unit={selectedUnit}
            phase={phase}
            active={activeAbility?.id === a.id}
            onActivate={() => onAbilityActivate(a.id)}
          />
        ))}
        <OverwatchButton
          unit={selectedUnit}
          phase={phase}
          onActivate={onOverwatch}
        />
      </div>
    </div>
  );
}