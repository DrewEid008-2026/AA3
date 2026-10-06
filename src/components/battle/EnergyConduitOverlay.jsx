import React from 'react';
import { GRID_WIDTH, GRID_HEIGHT } from '@/game/constants';

// Energy Conduit Overlay — draws visible energy connections between each
// active Power Relay and the Warden Prime. When a relay is destroyed, its
// conduit disappears. This is a visual-only layer; it does NOT implement
// shield regeneration or any mechanical effect (that belongs to Phase 2).
//
// The conduit is rendered as a pulsing gradient line from the relay to the
// Warden, using an SVG layer positioned over the battlefield.
export default function EnergyConduitOverlay({ relays, warden }) {
  if (!warden || !warden.alive) return null;

  const activeRelays = (relays || []).filter((r) => r.alive);
  if (activeRelays.length === 0) return null;

  // Convert grid coordinates to percentage positions (0-100) for SVG.
  const toPct = (x, y) => ({
    x: ((x + 0.5) / GRID_WIDTH) * 100,
    y: ((y + 0.5) / GRID_HEIGHT) * 100,
  });

  const wardenPct = toPct(warden.x, warden.y);

  return (
    <svg
      className="absolute inset-0 pointer-events-none z-[7]"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ width: '100%', height: '100%' }}
    >
      <defs>
        <linearGradient id="conduit-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#d946ef" stopOpacity="0.7" />
          <stop offset="50%" stopColor="#a855f7" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#d946ef" stopOpacity="0.7" />
        </linearGradient>
      </defs>
      {activeRelays.map((relay) => {
        const relayPct = toPct(relay.x, relay.y);
        return (
          <line
            key={relay.bossObjectId || `${relay.x},${relay.y}`}
            x1={`${relayPct.x}`}
            y1={`${relayPct.y}`}
            x2={`${wardenPct.x}`}
            y2={`${wardenPct.y}`}
            stroke="url(#conduit-gradient)"
            strokeWidth="0.8"
            strokeDasharray="2 1.5"
            vectorEffect="non-scaling-stroke"
            opacity="0.6"
            style={{
              filter: 'drop-shadow(0 0 2px rgba(217,70,239,0.6))',
            }}
          >
            <animate
              attributeName="stroke-dashoffset"
              from="3.5"
              to="0"
              dur="0.8s"
              repeatCount="indefinite"
            />
          </line>
        );
      })}
    </svg>
  );
}