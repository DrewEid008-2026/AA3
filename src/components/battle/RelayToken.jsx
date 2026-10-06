import React from 'react';
import { Atom } from 'lucide-react';
import { GRID_WIDTH, GRID_HEIGHT } from '@/game/constants';

// Power Relay token — a boss objective structure. Renders differently from
// standard unit tokens: a distinct alien structure shape with an ACTIVE or
// DESTROYED visual state. Active relays glow with an energy pulse; destroyed
// relays appear cracked and darkened.
//
// Relays are rendered in a separate layer from the units overlay so they
// remain visible even when destroyed (alive = false).
export default function RelayToken({ relay, wardenPos }) {
  if (!relay) return null;
  const destroyed = !relay.alive;
  const hpPct = relay.maxHp > 0 ? Math.max(0, relay.hp) / relay.maxHp : 0;

  const left = `${((relay.x + 0.5) / GRID_WIDTH) * 100}%`;
  const top = `${((relay.y + 0.5) / GRID_HEIGHT) * 100}%`;

  return (
    <div
      className="absolute pointer-events-none z-[9]"
      style={{ left, top, transform: 'translate(-50%, -50%)' }}
    >
      <div
        className={`relative flex items-center justify-center rounded-lg border-2 w-[78%] h-[78%] transition-all ${
          destroyed
            ? 'bg-slate-800 border-slate-600 opacity-50 grayscale'
            : 'bg-fuchsia-900/80 border-fuchsia-400/80 shadow-[0_0_12px_rgba(217,70,239,0.5)] animate-pulse'
        }`}
        style={{ aspectRatio: '1 / 1' }}
      >
        <Atom
          className={`w-[55%] h-[55%] ${destroyed ? 'text-slate-600' : 'text-fuchsia-300'}`}
          strokeWidth={2.5}
        />

        {/* HP bar (only when active) */}
        {!destroyed && (
          <span className="absolute bottom-0 left-0 right-0 h-[14%] rounded-b-lg overflow-hidden bg-black/30">
            <span
              className={`block h-full transition-all ${hpPct > 0.5 ? 'bg-fuchsia-400' : hpPct > 0.25 ? 'bg-amber-400' : 'bg-rose-500'}`}
              style={{ width: `${hpPct * 100}%` }}
            />
          </span>
        )}

        {/* Destroyed overlay */}
        {destroyed && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="text-[8px] font-black tracking-wider uppercase text-slate-500">
              Down
            </span>
          </span>
        )}
      </div>
    </div>
  );
}