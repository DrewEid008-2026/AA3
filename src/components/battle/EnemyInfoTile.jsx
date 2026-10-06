import React, { useState } from 'react';
import { X, Skull, Crosshair, Zap, Shield, Crown, Atom } from 'lucide-react';
import { ENEMY_ARCHETYPES } from '@/game/unitTypes';
import { getUnitWeapon, getCoverState, COVER_STATE_LABELS } from '@/game/combat';
import { STATUS_DEFS } from '@/game/statuses';
import { getEnemyAbilityForArchetype } from '@/game/enemyAbilities';
import { getShieldValue } from '@/game/shield';
import { getCurrentArmor, getBaseArmor } from '@/game/armorShred';
import { getRelayStatus, CORE_SHIELD_REGEN, getRelayRegenerationState } from '@/game/bossState';

// Format armor as "current/base" when current < base, else just the number.
function armorLabel(unit) {
  const cur = getCurrentArmor(unit);
  const base = getBaseArmor(unit);
  return cur < base ? `${cur}/${base}` : `${cur}`;
}

// Compact enemy information tile shown in the top-left of the battlefield
// when the player taps an enemy during normal Player Phase (no Lens required).
// Read-only: never spends AP, attacks, or changes turn state. The selected
// player unit remains selected for actions — this is inspection only.

const STATUS_TONE = {
  suppressed: 'bg-violet-600/80 text-white',
  burning: 'bg-orange-600/80 text-white',
  stunned: 'bg-yellow-500/80 text-slate-900',
  marked: 'bg-rose-600/80 text-white',
  shielded: 'bg-cyan-500/80 text-slate-900',
  disrupted: 'bg-fuchsia-600/80 text-white',
};

const COVER_TONE = {
  FLANKED: 'bg-rose-600/80 text-white',
  COVER: 'bg-amber-600/80 text-white',
  EXPOSED: 'bg-slate-600/80 text-slate-200',
};

function Chip({ label, value }) {
  return (
    <div className="flex flex-col items-center px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-700 min-w-[38px]">
      <span className="text-[8px] uppercase tracking-wider text-slate-400 leading-none">{label}</span>
      <span className="text-white font-bold text-[11px] leading-tight mt-0.5">{value}</span>
    </div>
  );
}

export default function EnemyInfoTile({ enemy, selectedUnit, grid, onClose, units, bossPhase }) {
  const [expanded, setExpanded] = useState(null);
  if (!enemy) return null;

  const weapon = getUnitWeapon(enemy);
  const archetype = ENEMY_ARCHETYPES[enemy.archetype];
  const ability = getEnemyAbilityForArchetype(enemy.archetype);

  // Cover state relative to the currently selected player unit, so the player
  // sees how their active soldier's shot would land.
  let coverLabel = null;
  if (selectedUnit && selectedUnit.alive && selectedUnit.team === 'player') {
    const state = getCoverState(grid, selectedUnit, enemy);
    coverLabel = COVER_STATE_LABELS[state];
  }

  const statuses = (enemy.statuses || []).map((s) => ({
    type: s.type,
    name: STATUS_DEFS[s.type]?.name || s.type,
    shortDesc: STATUS_DEFS[s.type]?.shortDesc || '',
    turnsRemaining: s.turnsRemaining,
  }));

  // --- Boss object (Power Relay) inspection ---
  if (enemy.isBossObject) {
    const relayStatus = units ? getRelayStatus(units) : { destroyed: 0, total: 2 };
    return (
      <div className="absolute left-2 top-2 z-[35] pointer-events-auto max-w-[200px]">
        <div className="rounded-lg border border-fuchsia-800/50 bg-slate-950/95 backdrop-blur-sm shadow-xl px-2.5 py-2">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div className="min-w-0 flex items-center gap-1.5">
              <Atom className="w-3.5 h-3.5 text-fuchsia-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-white font-bold text-xs tracking-wide uppercase truncate">
                  Power Relay
                </div>
                <div className="text-[9px] text-slate-400 truncate">Boss Objective Structure</div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-0.5 rounded bg-slate-800 text-slate-400 active:scale-95 touch-manipulation shrink-0"
              aria-label="Close relay info"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          <div className="flex items-center gap-1 mb-1.5">
            <Chip label="HP" value={`${enemy.hp}/${enemy.maxHp}`} />
            <Chip label="ARMOR" value={armorLabel(enemy)} />
          </div>

          <div className="flex items-center justify-between gap-1.5 mb-1.5">
            <span className={`text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded ${
              enemy.alive
                ? 'bg-fuchsia-600/80 text-white'
                : 'bg-slate-700 text-slate-400'
            }`}>
              {enemy.alive ? 'ACTIVE' : 'DESTROYED'}
            </span>
            <span className="text-[9px] text-slate-400">
              Relays {relayStatus.destroyed}/{relayStatus.total}
            </span>
          </div>

          <div className="text-[10px] text-slate-300 leading-snug">
            Maintains Warden Prime's Core Shield network.
          </div>
        </div>
      </div>
    );
  }

  // --- Boss (Warden Prime) inspection ---
  const isBoss = !!enemy.isBoss;
  const relayStatus = isBoss && units ? getRelayStatus(units) : null;

  return (
    <div className="absolute left-2 top-2 z-[35] pointer-events-auto max-w-[200px]">
      <div className={`rounded-lg border ${isBoss ? 'border-fuchsia-600/60' : 'border-rose-800/50'} bg-slate-950/95 backdrop-blur-sm shadow-xl px-2.5 py-2`}>
        {/* Header: name + archetype behavior */}
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="min-w-0 flex items-center gap-1.5">
            {isBoss ? (
              <Crown className="w-3.5 h-3.5 text-fuchsia-400 shrink-0" />
            ) : (
              <Skull className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            )}
            <div className="min-w-0">
              <div className="text-white font-bold text-xs tracking-wide uppercase truncate flex items-center gap-1">
                {enemy.name}
                {isBoss && (
                  <span className="text-[8px] font-bold text-fuchsia-300 border border-fuchsia-500/50 px-0.5 rounded">
                    BOSS
                  </span>
                )}
                {enemy.elite && !isBoss && (
                  <span className="text-[8px] font-bold text-fuchsia-300 border border-fuchsia-500/50 px-0.5 rounded">
                    ELITE
                  </span>
                )}
              </div>
              {archetype && (
                <div className="text-[9px] text-slate-400 truncate">{archetype.behavior || archetype.role}</div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-0.5 rounded bg-slate-800 text-slate-400 active:scale-95 touch-manipulation shrink-0"
            aria-label="Close enemy info"
          >
            <X className="w-3 h-3" />
          </button>
        </div>

        {/* HP + core stats */}
        <div className="flex items-center gap-1 mb-1.5">
          <Chip label="HP" value={`${enemy.hp}/${enemy.maxHp}`} />
          {getShieldValue(enemy) > 0 && (
            <div className="flex flex-col items-center px-1.5 py-0.5 rounded bg-cyan-900/80 border border-cyan-600 min-w-[38px]">
              <span className="text-[8px] uppercase tracking-wider text-cyan-300 leading-none flex items-center gap-0.5">
                <Shield className="w-2 h-2" />SHLD</span>
              <span className="text-cyan-200 font-bold text-[11px] leading-tight mt-0.5">{getShieldValue(enemy)}</span>
            </div>
          )}
          {isBoss && enemy.coreShield != null && (
            <div className="flex flex-col items-center px-1.5 py-0.5 rounded bg-blue-950/80 border border-blue-500 min-w-[38px]">
              <span className="text-[8px] uppercase tracking-wider text-blue-300 leading-none">CORE</span>
              <span className="text-blue-200 font-bold text-[11px] leading-tight mt-0.5">{enemy.coreShield}</span>
            </div>
          )}
          {getCurrentArmor(enemy) > 0 && (
            <Chip label="ARMOR" value={armorLabel(enemy)} />
          )}
          <Chip label="DMG" value={isBoss && bossPhase && bossPhase.includes('PHASE_3') ? 6 : (weapon?.damage ?? 0)} />
          <Chip label="RNG" value={weapon?.range ?? 0} />
          <Chip label="MOVE" value={archetype?.movement ?? 5} />
        </div>

        {/* Weapon + cover state */}
        <div className="flex items-center justify-between gap-1.5 mb-1.5">
          <div className="flex items-center gap-1 text-[10px] text-slate-300 min-w-0">
            <Crosshair className="w-2.5 h-2.5 text-slate-400 shrink-0" />
            <span className="truncate">{weapon?.name || '—'}</span>
          </div>
          {coverLabel && (
            <span
              className={`text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded shrink-0 ${
                COVER_TONE[coverLabel] || 'bg-slate-600/80 text-slate-200'
              }`}
            >
              {coverLabel}
            </span>
          )}
        </div>

        {/* Boss phase + relay status + Core Shield info + abilities (Warden only) */}
        {isBoss && (
          <div className="space-y-1 mb-1.5">
            <div className="flex items-center justify-between gap-1.5">
              {bossPhase && (
                <span className={`text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded ${
                  bossPhase.includes('PHASE_3')
                    ? 'text-orange-300 bg-orange-950/60 border border-orange-600/50'
                    : bossPhase.includes('PHASE_2')
                      ? 'text-amber-300 bg-amber-950/60 border border-amber-700/50'
                      : 'text-fuchsia-300 bg-fuchsia-950/60 border border-fuchsia-800/50'
                }`}>
                  {bossPhase.includes('PHASE_1') ? 'FORTIFIED' : bossPhase.includes('PHASE_2') ? 'ADVANCE' : bossPhase.includes('PHASE_3') ? 'CORE OVERLOAD' : bossPhase.replace(/_/g, ' ')}
                </span>
              )}
              {relayStatus && (
                <span className="text-[9px] text-slate-400">
                  Relays: {relayStatus.total - relayStatus.destroyed} Active
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-1.5">
              <span className={`text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded ${
                units && getRelayRegenerationState(units) === 'ACTIVE'
                  ? 'text-cyan-300 bg-cyan-950/60 border border-cyan-800/50'
                  : 'text-slate-500 bg-slate-800/60 border border-slate-700'
              }`}>
                Regen: {units ? getRelayRegenerationState(units) : 'ACTIVE'}
              </span>
              {relayStatus && relayStatus.total - relayStatus.destroyed === 0 && (
                <span className="text-[9px] font-bold text-amber-400">Offline</span>
              )}
            </div>
            {/* Core Shield description (Phase 1) */}
            {bossPhase && bossPhase.includes('PHASE_1') && (
              <div className="text-[9px] text-slate-400 leading-snug bg-slate-800/50 rounded px-1.5 py-1">
                <span className="text-cyan-300 font-bold">POWERED CORE</span> — Active Relays restore {CORE_SHIELD_REGEN} Core Shield at the start of each Enemy Phase. Destroy both to stop regeneration.
              </div>
            )}
            {/* Phase 2 transition note */}
            {bossPhase && bossPhase.includes('PHASE_2') && !bossPhase.includes('PHASE_3') && (
              <div className="text-[9px] text-slate-400 leading-snug bg-amber-950/30 border border-amber-800/30 rounded px-1.5 py-1">
                <span className="text-amber-300 font-bold">AGGRESSIVE COMMANDER</span> — Defenses compromised. Shield regen offline. Warden now actively hunts the squad.
              </div>
            )}
            {/* Phase 3 Core Overload note */}
            {bossPhase && bossPhase.includes('PHASE_3') && (
              <div className="text-[9px] text-slate-400 leading-snug bg-orange-950/30 border border-orange-700/40 rounded px-1.5 py-1">
                <span className="text-orange-300 font-bold">CORE OVERLOAD</span> — Creates 2 telegraphed unstable tiles each cycle. They detonate next Enemy Phase for 3 Environmental damage. Armor does not reduce it.
              </div>
            )}
            {/* Warden abilities */}
            <div className="space-y-0.5">
              <div className="rounded border border-fuchsia-800/40 bg-fuchsia-950/20 px-1.5 py-1">
                <div className="flex items-center gap-1">
                  <Zap className="w-2.5 h-2.5 text-fuchsia-300" />
                  <span className="text-[10px] font-bold tracking-wide uppercase text-fuchsia-200">Command Beam</span>
                  <span className="text-[8px] text-slate-400 ml-auto">Dmg 4 · Rng 7 · CD 2</span>
                </div>
                <div className="text-[9px] text-slate-300 leading-snug mt-0.5">4 damage + Marked. Normal cover resolution.</div>
              </div>
              <div className="rounded border border-fuchsia-800/40 bg-fuchsia-950/20 px-1.5 py-1">
                <div className="flex items-center gap-1">
                  <Zap className="w-2.5 h-2.5 text-fuchsia-300" />
                  <span className="text-[10px] font-bold tracking-wide uppercase text-fuchsia-200">Beam Sweep</span>
                  <span className="text-[8px] text-slate-400 ml-auto">Dmg 6 · CD 3</span>
                </div>
                <div className="text-[9px] text-slate-300 leading-snug mt-0.5">Marks a full row or column. Fires next Enemy Phase for 6 damage. Ignores Cover. Armor applies.</div>
              </div>
              {bossPhase && (bossPhase.includes('PHASE_2') || bossPhase.includes('PHASE_3')) && (
                <div className="rounded border border-amber-700/40 bg-amber-950/20 px-1.5 py-1">
                  <div className="flex items-center gap-1">
                    <Zap className="w-2.5 h-2.5 text-amber-300" />
                    <span className="text-[10px] font-bold tracking-wide uppercase text-amber-200">Phase Shift</span>
                    <span className="text-[8px] text-slate-400 ml-auto">0 AP · Rng 4 · CD 3</span>
                  </div>
                  <div className="text-[9px] text-slate-300 leading-snug mt-0.5">Short tactical reposition. Passes through units. Triggers Overwatch.</div>
                </div>
              )}
              {/* Core Overload passive (Phase 3) */}
              {bossPhase && bossPhase.includes('PHASE_3') && (
                <div className="rounded border border-orange-600/40 bg-orange-950/20 px-1.5 py-1">
                  <div className="flex items-center gap-1">
                    <Zap className="w-2.5 h-2.5 text-orange-300" />
                    <span className="text-[10px] font-bold tracking-wide uppercase text-orange-200">Core Overload</span>
                    <span className="text-[8px] text-slate-400 ml-auto">Passive</span>
                  </div>
                  <div className="text-[9px] text-slate-300 leading-snug mt-0.5">2 unstable tiles each cycle. Detonate next Enemy Phase for 3 Environmental damage.</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Status chips (tappable for short description) */}
        {statuses.length > 0 && (
          <div className="flex flex-col gap-1 mb-1.5">
            <div className="flex flex-wrap gap-1">
              {statuses.map((s) => (
                <button
                  key={s.type}
                  type="button"
                  onClick={() => setExpanded(expanded === s.type ? null : s.type)}
                  className={`text-[9px] font-bold tracking-wide uppercase px-1.5 py-0.5 rounded ${
                    STATUS_TONE[s.type] || 'bg-slate-700 text-slate-200'
                  } active:scale-95 touch-manipulation`}
                >
                  {s.name}
                  {s.turnsRemaining != null ? ` (${s.turnsRemaining})` : ''}
                </button>
              ))}
            </div>
            {expanded && (
              <div className="text-[10px] text-slate-300 bg-slate-800/70 border border-slate-700 rounded px-1.5 py-1 leading-snug">
                {statuses.find((s) => s.type === expanded)?.shortDesc}
              </div>
            )}
          </div>
        )}

        {/* Known special ability */}
        {ability && !isBoss && (
          <div className="rounded border border-fuchsia-800/50 bg-fuchsia-950/30 px-1.5 py-1">
            <div className="flex items-center gap-1">
              <Zap className="w-2.5 h-2.5 text-fuchsia-300" />
              <span className="text-[10px] font-bold tracking-wide uppercase text-fuchsia-200">
                {ability.name}
              </span>
            </div>
            <div className="text-[9px] text-slate-300 leading-snug mt-0.5">{ability.desc}</div>
          </div>
        )}
      </div>
    </div>
  );
}