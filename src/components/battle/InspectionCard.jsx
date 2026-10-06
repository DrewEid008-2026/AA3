import React, { useState } from 'react';
import { X, Shield, Crosshair, Sparkles, Skull, Wind, Target, AlertTriangle } from 'lucide-react';
import { VOLATILE_TILE_DAMAGE } from '@/game/volatileTiles';

// Compact inspection card shown while the Tactical Lens is active. Renders
// either a unit (friendly or enemy) or a terrain tile. Status chips are
// tappable to expand a short description. Never navigates away from the
// battlefield and never mutates game state.

const STATUS_TONE = {
  suppressed: 'bg-violet-600/80 text-white',
  burning: 'bg-orange-600/80 text-white',
  stunned: 'bg-yellow-500/80 text-slate-900',
  marked: 'bg-rose-600/80 text-white',
};

function Stat({ label, value }) {
  return (
    <div className="flex flex-col items-center px-2 py-1 rounded-md bg-slate-800/70 border border-slate-700 min-w-[52px]">
      <span className="text-[9px] uppercase tracking-wider text-slate-400">{label}</span>
      <span className="text-white font-bold text-sm leading-tight">{value}</span>
    </div>
  );
}

function UnitInspection({ info }) {
  const [expanded, setExpanded] = useState(null);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {info.kind === 'enemy' ? (
          <Skull className="w-4 h-4 text-rose-400 shrink-0" />
        ) : (
          <Shield className="w-4 h-4 text-sky-400 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-white font-bold text-sm tracking-wide uppercase truncate flex items-center gap-1.5">
            {info.name}
            {info.elite && <span className="text-[9px] font-bold text-fuchsia-300 border border-fuchsia-500/50 px-1 rounded">ELITE</span>}
            {info.downed && <span className="text-[9px] font-bold text-rose-400">DOWNED</span>}
            {info.passives && info.passives.some((p) => p.shortLabel === 'OVERWATCH IMMUNE') && (
              <span className="text-[8px] font-bold text-cyan-300 border border-cyan-500/50 bg-cyan-950/40 px-1 rounded tracking-wider">OW IMMUNE</span>
            )}
            {info.passives && info.passives.some((p) => p.shortLabel === 'LONE PREY') && (
              <span className="text-[8px] font-bold text-rose-300 border border-rose-500/50 bg-rose-950/40 px-1 rounded tracking-wider">LONE PREY</span>
            )}
          </div>
          <div className="text-[11px] text-slate-400 truncate">{info.className} · {info.role}</div>
          {info.behavior && <div className="text-[10px] text-slate-500 truncate italic">{info.behavior}</div>}
        </div>
        <span className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded ${
          info.coverLabel === 'FLANKED' ? 'bg-rose-600/70 text-white'
            : info.coverLabel === 'COVER' ? 'bg-amber-600/70 text-white'
              : 'bg-slate-600/70 text-slate-200'
        }`}>
          {info.coverLabel}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <Stat label="HP" value={`${info.hp}/${info.maxHp}`} />
        <Stat label="AP" value={info.kind === 'enemy' ? '—' : `${info.ap}/${info.maxAp}`} />
        <Stat label="DMG" value={info.damage} />
        <Stat label="RNG" value={info.range} />
        {info.movement != null && <Stat label="Move" value={info.movement} />}
        {info.ammo != null && <Stat label="Ammo" value={info.maxAmmo === Infinity ? '∞' : `${info.ammo}/${info.maxAmmo}`} />}
      </div>

      <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
        <Crosshair className="w-3 h-3 text-slate-400" />
        <span>{info.weaponName}</span>
      </div>

      {info.statuses.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="text-[9px] uppercase tracking-wider text-slate-400">Statuses</div>
          <div className="flex flex-wrap gap-1.5">
            {info.statuses.map((s) => (
              <button
                key={s.type}
                type="button"
                onClick={() => setExpanded(expanded === s.type ? null : s.type)}
                className={`text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded ${STATUS_TONE[s.type] || 'bg-slate-700 text-slate-200'} active:scale-95 touch-manipulation`}
              >
                {s.name}{s.turnsRemaining != null ? ` (${s.turnsRemaining})` : ''}
              </button>
            ))}
          </div>
          {expanded && (
            <div className="text-[11px] text-slate-300 bg-slate-800/70 border border-slate-700 rounded px-2 py-1.5 leading-snug">
              {info.statuses.find((s) => s.type === expanded)?.shortDesc}
            </div>
          )}
        </div>
      )}

      {info.cooldowns.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="text-[9px] uppercase tracking-wider text-slate-400">Cooldowns</div>
          <div className="flex flex-wrap gap-1.5">
            {info.cooldowns.map((c) => (
              <span key={c.id} className="text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                {c.id.replace(/_/g, ' ')} · {c.remaining}
              </span>
            ))}
          </div>
        </div>
      )}

      {info.enemyAbility && (
        <div className="rounded-md border border-fuchsia-800/50 bg-fuchsia-950/30 px-2 py-1.5">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-fuchsia-300" />
            <span className="text-[11px] font-bold tracking-wide uppercase text-fuchsia-200">{info.enemyAbility.name}</span>
            <span className={`text-[9px] font-bold px-1 rounded ${info.enemyAbility.ready ? 'bg-emerald-600/70 text-white' : 'bg-slate-700 text-slate-300'}`}>
              {info.enemyAbility.ready ? 'Ready' : `CD ${info.enemyAbility.cooldownRemaining}`}
            </span>
          </div>
          <div className="text-[11px] text-slate-300 leading-snug mt-0.5">{info.enemyAbility.desc}</div>
        </div>
      )}

      {/* Player isolation status (spec 14): shows whether this soldier is
          currently isolated — vulnerable to Lone Prey. */}
      {info.kind === 'player' && !info.downed && (
        <div className={`rounded-md border px-2 py-1.5 ${
          info.isolated
            ? 'border-rose-800/50 bg-rose-950/30'
            : 'border-emerald-800/50 bg-emerald-950/30'
        }`}>
          <div className="flex items-center gap-1.5">
            <Target className={`w-3 h-3 ${info.isolated ? 'text-rose-300' : 'text-emerald-300'}`} />
            <span className={`text-[11px] font-bold tracking-wide uppercase ${
              info.isolated ? 'text-rose-200' : 'text-emerald-200'
            }`}>
              {info.isolated ? 'ISOLATED' : 'SUPPORTED'}
            </span>
            <span className="text-[10px] text-slate-400">
              {info.nearbyAllyCount} ally{info.nearbyAllyCount === 1 ? '' : 's'} within 2 tiles
            </span>
          </div>
          {info.isolated && (
            <div className="text-[10px] text-rose-300/80 leading-snug mt-0.5">
              Vulnerable to Lone Prey (+2 damage from Executioners)
            </div>
          )}
        </div>
      )}

      {info.passives && info.passives.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="text-[9px] uppercase tracking-wider text-slate-400">Passive</div>
          {info.passives.map((p) => {
            const PIcon = p.id === 'lone_prey' ? Target : Wind;
            const tone = p.id === 'lone_prey'
              ? { border: 'border-rose-800/50', bg: 'bg-rose-950/30', icon: 'text-rose-300', name: 'text-rose-200', label: 'text-rose-300', labelBorder: 'border-rose-500/50' }
              : { border: 'border-cyan-800/50', bg: 'bg-cyan-950/30', icon: 'text-cyan-300', name: 'text-cyan-200', label: 'text-cyan-300', labelBorder: 'border-cyan-500/50' };
            return (
              <div key={p.id} className={`rounded-md border ${tone.border} ${tone.bg} px-2 py-1.5`}>
                <div className="flex items-center gap-1.5">
                  <PIcon className={`w-3 h-3 ${tone.icon}`} />
                  <span className={`text-[11px] font-bold tracking-wide uppercase ${tone.name}`}>{p.name}</span>
                  <span className={`text-[8px] font-bold ${tone.label} border ${tone.labelBorder} px-1 rounded tracking-wider`}>{p.shortLabel}</span>
                </div>
                <div className="text-[11px] text-slate-300 leading-snug mt-0.5">{p.desc}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TerrainInspection({ label, coverInfo }) {
  const active = coverInfo.sides.filter((s) => !s.destroyed);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Shield className="w-4 h-4 text-amber-300 shrink-0" />
        <div className="text-white font-bold text-sm tracking-wide uppercase">{label}</div>
      </div>

      {/* Volatile Tile hazard info (spec 20, 21) */}
      {coverInfo.volatile && (
        <div className="rounded-md border border-emerald-500/50 bg-emerald-950/40 px-2 py-1.5">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <div className="text-[11px] font-bold tracking-wide uppercase text-emerald-300">
              VOLATILE TERRAIN
            </div>
          </div>
          <div className="text-[11px] text-slate-300 leading-snug mt-0.5">
            Entering this tile deals <span className="text-emerald-300 font-bold">{VOLATILE_TILE_DAMAGE} environmental damage</span>.
          </div>
        </div>
      )}

      {/* Siege-destructible map tile info (distinct from destructible Cover) */}
      {coverInfo.siegeDestructible && (
        <div className="rounded-md border border-rose-800/50 bg-rose-950/30 px-2 py-1.5">
          <div className="text-[11px] font-bold tracking-wide uppercase text-rose-300">
            {coverInfo.tileKindLabel}
          </div>
          <div className="text-[11px] text-slate-300 leading-snug mt-0.5">
            Impassable · Blocks LOS · <span className="text-rose-300 font-bold">SIEGE-DESTRUCTIBLE</span>
          </div>
        </div>
      )}
      {coverInfo.tileDestroyed && (
        <div className="text-[10px] text-slate-500">
          Structural tile destroyed — now open ground.
        </div>
      )}

      <div className="flex items-center gap-1.5 text-[11px]">
        {coverInfo.blocked ? (
          coverInfo.siegeDestructible ? null : (
            <span className="text-slate-400">Impassable terrain. Blocks line of sight.</span>
          )
        ) : active.length === 0 ? (
          <span className="text-slate-400">No active cover. Occupants are exposed.</span>
        ) : (
          <span className="text-slate-300">
            {coverInfo.destructible ? 'Destructible cover.' : 'Reinforced cover.'}
          </span>
        )}
      </div>
      {active.length > 0 && (
        <div className="flex flex-col gap-1">
          {active.map((s) => (
            <div key={s.dir} className="flex items-center justify-between text-[11px] bg-slate-800/70 border border-slate-700 rounded px-2 py-1">
              <span className="text-slate-300 font-bold tracking-wide uppercase">{s.label}</span>
              <span className="text-slate-400">HP {s.hp}/{s.maxHp}</span>
            </div>
          ))}
        </div>
      )}
      {coverInfo.sides.some((s) => s.destroyed) && (
        <div className="text-[10px] text-slate-500">Some cover on this tile is destroyed.</div>
      )}
    </div>
  );
}

export default function InspectionCard({ inspection, onClose }) {
  if (!inspection) return null;
  return (
    <div className="absolute left-2 right-2 bottom-2 z-[35] pointer-events-auto">
      <div className="rounded-xl border border-slate-600 bg-slate-950/95 backdrop-blur-sm shadow-2xl px-3 py-3">
        <div className="flex items-start justify-between mb-1">
          <div className="text-[9px] uppercase tracking-wider text-cyan-300 font-bold">Tactical Lens</div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md bg-slate-800 text-slate-300 active:scale-95 touch-manipulation"
            aria-label="Close inspection"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        {inspection.kind === 'unit'
          ? <UnitInspection info={inspection.info} />
          : <TerrainInspection label={inspection.label} coverInfo={inspection.coverInfo} />}
      </div>
    </div>
  );
}