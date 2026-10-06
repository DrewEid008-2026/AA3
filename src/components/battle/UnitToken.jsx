import React from 'react';
import {
  Swords, Shield, Heart, HeartCrack, Zap, Crosshair, HelpCircle, VolumeX, Eye,
  Star, UserRound, Footprints, Ban, Hexagon, Ghost, Radio, Orbit, Crown, Magnet, Target,
} from 'lucide-react';
import { TEAMS } from '@/game/constants';
import { STATUS_DEFS } from '@/game/statuses';
import { isInOverwatch } from '@/game/reactions';
import { getShieldValue } from '@/game/shield';
import { getIconColorHex } from '@/game/iconColors';
import { getCurrentArmor } from '@/game/armorShred';
import { SOLDIER_ICON_COMPONENTS } from '@/game/soldierIcons';

// Enemy-specific icon keys not in the soldier registry.
const ENEMY_ICONS = {
  bulwark: Hexagon,
  stalker: Ghost,
  disruptor: Radio,
  artillery: Orbit,
  dislocator: Magnet,
  executioner: Target,
};

// Merged icon registry: all soldier icons + enemy-specific keys.
const ICONS = { ...SOLDIER_ICON_COMPONENTS, ...ENEMY_ICONS };

// Shape per player class for at-a-glance silhouette distinction.
const PLAYER_SHAPES = {
  assault: 'rounded-full',
  heavy: 'rounded-md',
  support: 'rounded-full',
  engineer: 'rounded-md',
  marksman: 'rounded-full',
};

// Accent border per player class (second channel of distinction).
const PLAYER_ACCENT = {
  assault: 'border-sky-200',
  heavy: 'border-indigo-200',
  support: 'border-emerald-200',
  engineer: 'border-amber-200',
  marksman: 'border-violet-200',
};

// Background color per player class (third channel of distinction).
const PLAYER_BG = {
  assault: 'bg-sky-500',
  heavy: 'bg-indigo-500',
  support: 'bg-emerald-500',
  engineer: 'bg-amber-500',
  marksman: 'bg-violet-500',
};

// Targeting badge tones → ring + badge colors. Shared by attack and abilities.
const TONE = {
  flank: { ring: 'ring-rose-400 shadow-[0_0_14px_rgba(244,63,94,0.95)]', badge: 'bg-rose-500 text-white', icon: Swords },
  cover: { ring: 'ring-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.9)]', badge: 'bg-amber-500 text-slate-900', icon: Shield },
  expose: { ring: 'ring-slate-300 shadow-[0_0_12px_rgba(203,213,225,0.7)]', badge: 'bg-slate-800/90 text-white', icon: null },
  suppress: { ring: 'ring-violet-400 shadow-[0_0_14px_rgba(167,139,250,0.95)]', badge: 'bg-violet-500 text-white', icon: VolumeX },
  heal: { ring: 'ring-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.95)]', badge: 'bg-emerald-500 text-white', icon: Heart },
  command: { ring: 'ring-cyan-400 shadow-[0_0_14px_rgba(34,211,238,0.95)]', badge: 'bg-cyan-500 text-slate-900', icon: Zap },
  grenade: { ring: 'ring-orange-400 shadow-[0_0_14px_rgba(251,146,60,0.95)]', badge: 'bg-orange-500 text-white', icon: null },
  blocked: { ring: 'ring-slate-500 shadow-[0_0_10px_rgba(100,116,139,0.5)]', badge: 'bg-slate-600 text-slate-200', icon: Ban },
  shield: { ring: 'ring-cyan-400 shadow-[0_0_14px_rgba(34,211,238,0.95)]', badge: 'bg-cyan-500 text-slate-900', icon: Hexagon },
  lined_up: { ring: 'ring-cyan-400 shadow-[0_0_14px_rgba(34,211,238,0.95)]', badge: 'bg-cyan-500 text-slate-900', icon: Crosshair },
  close: { ring: 'ring-slate-400 shadow-[0_0_10px_rgba(148,163,184,0.6)]', badge: 'bg-slate-600 text-white', icon: null },
};

// Small status icon shown near the token for active statuses.
const STATUS_ICON = { suppressed: VolumeX, shielded: Shield, disrupted: Zap };

export default function UnitToken({ unit, selected, spent, targeting, badge, hitFlash, reactionFlash, escorting, extracted, threat, bossPhase, onTap }) {
  const Icon = ICONS[unit.icon] || HelpCircle;
  const isPlayer = unit.team === TEAMS.PLAYER;

  const isElite = !!unit.elite;
  const isBoss = !!unit.isBoss;
  // Phase 2 visual: the Warden shifts from fuchsia (fortified) to amber
  // (aggressive) so the player can read the transition at a glance.
  const isBossPhase2 = isBoss && bossPhase === 'PHASE_2_ADVANCE';
  // Phase 3 visual: the Warden becomes unstable — orange/red glow + pulsing
  // energy. This is the final phase, visually distinct from Phase 1/2.
  const isBossPhase3 = isBoss && bossPhase === 'PHASE_3_OVERLOAD';
  const shape = isPlayer ? PLAYER_SHAPES[unit.archetype] || 'rounded-full' : 'rounded-full';
  const accent = isPlayer
    ? (PLAYER_ACCENT[unit.archetype] || 'border-sky-200')
    : isElite ? 'border-amber-300' : 'border-rose-200';
  const bg = isPlayer
    ? (PLAYER_BG[unit.archetype] || 'bg-sky-500')
    : isBoss
      ? (isBossPhase3 ? 'bg-orange-900' : isBossPhase2 ? 'bg-amber-800' : 'bg-fuchsia-800')
      : isElite
        ? 'bg-rose-800'
        : 'bg-rose-500';
  // Player icon color overrides the class-based background when set.
  const iconColorHex = isPlayer && unit.iconColor ? getIconColorHex(unit.iconColor) : null;

  const tone = badge ? TONE[badge.tone] || TONE.expose : null;
  const ring = targeting && tone
    ? `ring-4 ${tone.ring} z-20`
    : selected
      ? 'ring-4 ring-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.9)] z-20'
      : spent
        ? 'ring-2 ring-slate-400/50'
        : isBoss
          ? (isBossPhase3
            ? 'ring-4 ring-orange-400 shadow-[0_0_20px_rgba(251,146,60,0.9)] z-20 animate-pulse'
            : isBossPhase2
              ? 'ring-4 ring-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.8)] z-20'
              : 'ring-4 ring-fuchsia-400 shadow-[0_0_16px_rgba(217,70,239,0.7)] z-20')
          : isElite
            ? 'ring-2 ring-amber-400/70 shadow-[0_0_8px_rgba(251,191,36,0.4)]'
            : 'ring-2 ring-white/40';

  const spentTreatment = spent ? 'opacity-60 saturate-50' : '';
  const downedTreatment = unit.downed ? 'grayscale opacity-50' : '';
  const hpPct = unit.maxHp > 0 ? Math.max(0, unit.hp) / unit.maxHp : 0;
  const hpColor = hpPct > 0.5 ? 'bg-emerald-400' : hpPct > 0.25 ? 'bg-amber-400' : 'bg-rose-500';

  const statuses = unit.statuses || [];

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onTap(unit);
      }}
      style={iconColorHex ? { pointerEvents: 'auto', backgroundColor: iconColorHex } : { pointerEvents: 'auto' }}
      className={`relative flex items-center justify-center ${shape} ${iconColorHex ? '' : bg} ${accent} ${ring} ${spentTreatment} ${downedTreatment}
        border-2 w-[82%] h-[82%] transition-transform duration-150
        ${selected ? 'scale-105' : 'active:scale-95'} ${hitFlash ? 'animate-pulse' : ''}
        cursor-pointer touch-manipulation`}
      aria-label={`${unit.name}${selected ? ' (selected)' : ''}${targeting ? ' (target)' : ''}`}
    >
      {unit.downed ? (
        <HeartCrack className="w-[55%] h-[55%] text-rose-300" strokeWidth={2.5} />
      ) : (
        <Icon className="w-[55%] h-[55%] text-white" strokeWidth={2.5} />
      )}

      {/* Targeting badge: ability/attack preview (damage, KILL, +HP, SUPP, +1 AP). */}
      {targeting && badge && (
        <span
          className={`absolute -top-2 left-1/2 -translate-x-1/2 z-30 whitespace-nowrap text-[9px] font-black tracking-wide px-1.5 py-0.5 rounded shadow flex items-center gap-0.5 ${tone.badge}`}
        >
          {tone.icon && <tone.icon className="w-2.5 h-2.5" />}
          {badge.label}
        </span>
      )}

      {/* Active status indicators (top-left). */}
      {statuses.length > 0 && (
        <span className="absolute -top-1.5 -left-1.5 z-20 flex flex-col items-center gap-0.5">
          {statuses.map((s) => {
            const SIcon = STATUS_ICON[s.type];
            if (!SIcon) return null;
            const tone = s.type === 'shielded'
              ? 'bg-cyan-500 border-cyan-200'
              : s.type === 'disrupted'
                ? 'bg-fuchsia-600 border-fuchsia-200'
                : 'bg-violet-600 border-violet-200';
            return (
              <span
                key={s.type}
                className={`flex items-center justify-center w-3.5 h-3.5 rounded-full ${tone} border shadow`}
                title={STATUS_DEFS[s.type]?.name || s.type}
              >
                <SIcon className="w-2.5 h-2.5 text-white" />
              </span>
            );
          })}
        </span>
      )}

      {/* Shield value badge (bottom-right) — Bulwark Energy Shield. */}
      {getShieldValue(unit) > 0 && (
        <span
          className="absolute -bottom-1 -right-1 z-20 flex items-center justify-center w-4 h-4 rounded-full bg-cyan-400 border border-cyan-100 shadow text-[8px] font-black text-cyan-900"
          title={`Shield: ${getShieldValue(unit)}`}
        >
          {getShieldValue(unit)}
        </span>
      )}

      {/* Hit flash */}
      {hitFlash && (
        <span className="absolute inset-0 rounded-inherit bg-rose-400/40 pointer-events-none" />
      )}

      {/* Overwatch indicator: subtle eye while prepared, bright flash when it
          fires. Shown while prepared OR during the reaction flash (firing
          consumes overwatch, so the flash must render independently). */}
      {(isInOverwatch(unit) || reactionFlash) && (
        <span
          className={`absolute -top-1.5 -right-1.5 z-20 flex items-center justify-center w-3.5 h-3.5 rounded-full border shadow transition-transform ${
            reactionFlash
              ? 'bg-amber-300 border-amber-100 scale-125 shadow-[0_0_10px_rgba(252,211,77,0.95)] animate-pulse'
              : 'bg-amber-600 border-amber-200'
          }`}
          title="Overwatch"
        >
          <Eye className="w-2.5 h-2.5 text-white" strokeWidth={2.5} />
        </span>
      )}

      {/* Elite rank marker (gold star, top-center) */}
      {isElite && (
        <span
          className="absolute -top-2 left-1/2 -translate-x-1/2 z-20 flex items-center justify-center w-4 h-4 rounded-full bg-amber-400 border border-amber-100 shadow-[0_0_8px_rgba(251,191,36,0.8)]"
          title="Elite"
        >
          <Star className="w-2.5 h-2.5 text-amber-900" fill="currentColor" />
        </span>
      )}

      {/* Boss rank marker (crown, top-center) — Warden Prime. Shifts from
          fuchsia (Phase 1 Fortified) to amber (Phase 2 Advance) to signal the
          transition to an aggressive commander. */}
      {isBoss && (
        <span
          className={`absolute -top-2 left-1/2 -translate-x-1/2 z-20 flex items-center justify-center w-4 h-4 rounded-full border ${
            isBossPhase3
              ? 'bg-orange-500 border-orange-200 shadow-[0_0_12px_rgba(251,146,60,0.95)] animate-pulse'
              : isBossPhase2
                ? 'bg-amber-500 border-amber-200 shadow-[0_0_10px_rgba(251,191,36,0.9)]'
                : 'bg-fuchsia-500 border-fuchsia-200 shadow-[0_0_10px_rgba(217,70,239,0.9)]'
          }`}
          title={isBossPhase3 ? 'Boss — Phase 3 Core Overload' : isBossPhase2 ? 'Boss — Phase 2 Advance' : 'Boss — Phase 1 Fortified'}
        >
          <Crown className="w-2.5 h-2.5 text-white" fill="currentColor" />
        </span>
      )}

      {/* Escorting indicator (carrying civilian, bottom-right) */}
      {escorting && (
        <span
          className="absolute -bottom-1 -right-1 z-20 flex items-center justify-center w-4 h-4 rounded-full bg-amber-300 border border-amber-50 shadow"
          title="Escorting civilian"
        >
          <UserRound className="w-2.5 h-2.5 text-amber-900" />
        </span>
      )}

      {/* Extracted indicator (bottom-left) */}
      {extracted && (
        <span
          className="absolute -bottom-1 -left-1 z-20 flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500 border border-emerald-200 shadow"
          title="Extracted"
        >
          <Footprints className="w-2.5 h-2.5 text-white" />
        </span>
      )}

      {/* Threat indicator: this enemy can attack the preview destination */}
      {threat && (
        <span
          className="absolute -bottom-2 left-1/2 -translate-x-1/2 z-20 flex items-center justify-center w-4 h-4 rounded-full bg-orange-500 border border-orange-200 shadow"
          title="Can attack this position"
        >
          <Crosshair className="w-2.5 h-2.5 text-white" />
        </span>
      )}

      {/* Bleed-out counter for downed player units */}
      {unit.downed && (
        <span className="absolute -top-2 left-1/2 -translate-x-1/2 z-30 whitespace-nowrap text-[8px] font-black tracking-wide px-1.5 py-0.5 rounded shadow bg-rose-600 text-white">
          {unit.bleedOut}
        </span>
      )}

      {/* HP bar (shown for both teams; enemies rely on this for HP visibility) */}
      <span className="absolute bottom-0 left-0 right-0 h-[14%] rounded-b-inherit overflow-hidden bg-black/30">
        <span
          className={`block h-full ${hpColor} transition-all`}
          style={{ width: `${hpPct * 100}%` }}
        />
      </span>

      {/* Armor pips — small yellow circles below the HP bar, one per current
          Armor point. Removed immediately when Armor Shred reduces current Armor. */}
      {getCurrentArmor(unit) > 0 && (
        <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-0.5">
          {Array.from({ length: getCurrentArmor(unit) }).map((_, i) => (
            <span key={i} className="w-1.5 h-1.5 rounded-full bg-yellow-400 shadow-[0_0_3px_rgba(250,204,21,0.7)]" />
          ))}
        </span>
      )}
    </button>
  );
}