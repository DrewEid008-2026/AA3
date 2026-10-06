import React, { useRef, useState } from 'react';
import { Zap, Sword, Crosshair, Bomb, Heart, Flag, Eye, Info, BriefcaseMedical, Shield, Move, Cloud, FastForward, Rocket, Pickaxe, BrickWall, Anchor } from 'lucide-react';
import { getCooldown, getRemainingUses, canActivateAbility } from '@/game/abilities';

const ICONS = {
  dash: Zap,
  breach: Sword,
  suppress: Crosshair,
  grenade: Bomb,
  launch_rocket: Rocket,
  heal: Heart,
  command: Flag,
  overwatch: Eye,
  field_medkit: BriefcaseMedical,
  deploy_barricade: Shield,
  shock_mine: Zap,
  line_up: Crosshair,
  relocate: Move,
  smoke_grenade: Cloud,
  sprint_harness: FastForward,
  emergency_shield: Shield,
  wall_charge: Pickaxe,
  insta_wall_cement: BrickWall,
  disruptor_hook: Anchor,
};

// Accent → Tailwind classes (literal strings so the build keeps them).
const ACCENT = {
  sky: { on: 'bg-sky-600 border-sky-300 text-white', ring: 'ring-sky-300' },
  rose: { on: 'bg-rose-600 border-rose-300 text-white', ring: 'ring-rose-300' },
  violet: { on: 'bg-violet-600 border-violet-300 text-white', ring: 'ring-violet-300' },
  orange: { on: 'bg-orange-600 border-orange-300 text-white', ring: 'ring-orange-300' },
  emerald: { on: 'bg-emerald-600 border-emerald-300 text-white', ring: 'ring-emerald-300' },
  cyan: { on: 'bg-cyan-600 border-cyan-300 text-white', ring: 'ring-cyan-300' },
  amber: { on: 'bg-amber-600 border-amber-300 text-white', ring: 'ring-amber-300' },
  yellow: { on: 'bg-yellow-600 border-yellow-300 text-white', ring: 'ring-yellow-300' },
  slate: { on: 'bg-slate-700 border-slate-500 text-slate-200', ring: 'ring-slate-400' },
};

const HOLD_MS = 450;
const INFO_MS = 4200;

// One ability slot. Quick tap activates (or targets) the ability; press-and-hold
// (or a tap when unavailable) opens a short info popover. Cooldown / uses / AP
// state is shown on the button itself — no modal.
export default function AbilityButton({ ability, unit, phase, active, onActivate }) {
  const Icon = ICONS[ability.icon] || Eye;
  const accent = ACCENT[ability.accent] || ACCENT.slate;
  const [showInfo, setShowInfo] = useState(false);
  const holdTimer = useRef(null);
  const hideTimer = useRef(null);
  const longPressed = useRef(false);

  const locked = !!ability.disabled;
  const cooldown = locked ? 0 : getCooldown(unit, ability.id);
  const uses = !locked && ability.usesPerMission ? getRemainingUses(unit, ability.id) : null;
  const canAfford = !locked && unit.ap >= (ability.apCost || 0);
  const canActivate = !locked && canActivateAbility(unit, ability.id, phase);

  let stateKey = 'ready';
  if (locked) stateKey = 'locked';
  else if (uses !== null && uses <= 0) stateKey = 'used';
  else if (cooldown > 0) stateKey = 'cooldown';
  else if (!canAfford) stateKey = 'noap';
  else if (phase !== 'player') stateKey = 'locked';

  const openInfo = () => {
    setShowInfo(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowInfo(false), INFO_MS);
  };

  const onPointerDown = () => {
    longPressed.current = false;
    holdTimer.current = setTimeout(() => {
      longPressed.current = true;
      openInfo();
    }, HOLD_MS);
  };
  const onPointerUp = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    if (longPressed.current) return; // hold already opened info
    if (canActivate) onActivate();
    else openInfo(); // tap an unavailable ability → show why
  };
  const cancelHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
  };

  const dim = stateKey !== 'ready' && stateKey !== 'active';

  return (
    <div className="relative">
      <button
        type="button"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerLeave={cancelHold}
        onPointerCancel={cancelHold}
        className={`relative w-full flex flex-col items-center justify-center gap-0.5 py-2 rounded-lg border touch-manipulation select-none transition-colors ${
          active
            ? `${accent.on} ring-2 ${accent.ring}`
            : stateKey === 'ready'
              ? `${accent.on} active:opacity-90`
              : 'bg-slate-800 text-slate-400 border-slate-700'
        } ${dim ? 'opacity-60' : ''}`}
        aria-label={ability.name}
      >
        <Icon className="w-5 h-5" strokeWidth={2.2} />
        <span className="text-[10px] font-bold tracking-wide leading-none">{ability.name}</span>

        {/* AP cost pip */}
        {!locked && (
          <span className="absolute top-0.5 left-1 text-[8px] font-bold tracking-wide opacity-80">
            {ability.apCost}AP
          </span>
        )}

        {/* State overlay */}
        {stateKey === 'cooldown' && (
          <span className="absolute inset-0 flex items-center justify-center bg-slate-900/70 rounded-lg">
            <span className="text-lg font-black text-white leading-none">{cooldown}</span>
          </span>
        )}
        {stateKey === 'used' && (
          <span className="absolute inset-0 flex items-center justify-center bg-slate-900/70 rounded-lg">
            <span className="text-[10px] font-black text-slate-300 tracking-widest">USED</span>
          </span>
        )}
        {stateKey === 'noap' && (
          <span className="absolute bottom-0.5 right-1 text-[8px] font-bold text-amber-300/90 tracking-wide">
            NO AP
          </span>
        )}
        {/* Grenade uses remaining */}
        {uses !== null && uses > 0 && (
          <span className="absolute top-0.5 right-1 text-[8px] font-bold text-white/90">
            ×{uses}
          </span>
        )}
      </button>

      {/* Info popover */}
      {showInfo && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-50 w-44 max-w-[80vw] pointer-events-auto"
          onClick={() => setShowInfo(false)}
        >
          <div className="bg-slate-900/95 border border-slate-600 rounded-md px-2.5 py-2 shadow-xl">
            <div className="flex items-center gap-1.5 mb-1">
              <Icon className="w-3.5 h-3.5 text-white" />
              <span className="text-white font-bold text-xs tracking-wide">{ability.name}</span>
              <Info className="w-3 h-3 text-slate-400 ml-auto" />
            </div>
            <p className="text-[10px] text-slate-300 leading-snug mb-1.5">{ability.desc}</p>
            <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[9px] text-slate-400 font-semibold tracking-wide">
              {ability.apCost !== undefined && <span>AP {ability.apCost}</span>}
              {ability.cooldown > 0 && <span>CD {ability.cooldown}</span>}
              {ability.range && <span>RNG {ability.range}</span>}
              {ability.damage && <span>DMG {ability.damage}</span>}
              {ability.healing && <span>HEAL {ability.healing}</span>}
              {ability.usesPerMission && <span>×{ability.usesPerMission}/mission</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}