import React from 'react';
import { GRID_WIDTH, GRID_HEIGHT } from '@/game/constants';

// Core Shield visual indicator for the Warden Prime. Renders as a cyan energy
// ring around the boss token when Core Shield is active (coreShield > 0).
// When the shield is depleted, the ring disappears — the player can tell at a
// glance whether the shield is up or broken. This is a visual-only layer.
//
// Rendered above the units overlay (z-11) so the ring is visible on top of the
// Warden token. The ring is larger than the token so it extends beyond it.
export default function BossShieldBar({ warden, bossPhase }) {
  if (!warden || !warden.alive) return null;
  const shield = warden.coreShield || 0;
  const max = warden.coreShieldMax || 8;
  if (shield <= 0) return null;
  const pct = max > 0 ? shield / max : 0;

  // Phase 2 visual shift: the shield ring changes from cyan (Phase 1, regenerating)
  // to amber (Phase 2, no longer regenerating) so the player can see the
  // transition at a glance.
  const isPhase2 = bossPhase === 'PHASE_2_ADVANCE';
  const ringColor = isPhase2 ? 'border-amber-400/70' : 'border-cyan-400/70';
  const ringGlow = isPhase2
    ? 'shadow-[0_0_10px_rgba(251,191,36,0.45)]'
    : 'shadow-[0_0_10px_rgba(34,211,238,0.45)]';
  const fillColor = isPhase2 ? 'bg-amber-400/15' : 'bg-cyan-400/15';
  const badgeColor = isPhase2 ? 'text-amber-200' : 'text-cyan-200';

  const left = `${((warden.x + 0.5) / GRID_WIDTH) * 100}%`;
  const top = `${((warden.y + 0.5) / GRID_HEIGHT) * 100}%`;

  return (
    <div
      className="absolute pointer-events-none z-[11]"
      style={{ left, top, transform: 'translate(-50%, -50%)' }}
    >
      <div
        className={`relative flex items-center justify-center rounded-full border-2 ${ringColor} bg-amber-400/5 ${ringGlow} transition-opacity`}
        style={{ width: '92%', height: '92%', aspectRatio: '1 / 1' }}
      >
        {/* Shield value badge */}
        <span className={`absolute -top-3 left-1/2 -translate-x-1/2 text-[8px] font-black tracking-wider ${badgeColor} bg-slate-950/90 px-1 rounded whitespace-nowrap leading-none py-0.5`}>
          ◈ {shield}
        </span>
        {/* Shield fill arc (bottom) — visual strength indicator */}
        <span
          className="absolute bottom-0 left-0 right-0 rounded-b-full overflow-hidden"
          style={{ height: '100%' }}
        >
          <span
            className={`block w-full ${fillColor} transition-all`}
            style={{ height: `${pct * 100}%`, marginTop: `${(1 - pct) * 100}%` }}
          />
        </span>
      </div>
    </div>
  );
}