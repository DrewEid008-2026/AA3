import React from 'react';
import { motion } from 'framer-motion';
import { GRID_WIDTH, GRID_HEIGHT } from '@/game/constants';
import { PRESENTATION_TYPES } from '@/game/attackPresentation';

// Attack presentation overlay. Renders the active weapon-shot effect (muzzle
// flash + tracer/beam + impact burst) as an SVG layer in grid coordinates.
// Purely presentational — driven entirely by the `activeShot` prop. No combat
// logic, no state mutation. Battle.jsx owns the timing via sleeps and sets
// `phase` ('travel' → 'impact') so the impact burst lines up with the moment
// damage is applied.
//
// SVG viewBox matches the grid (9x14) with preserveAspectRatio="none"; the
// Battlefield container is aspect-[9/14] so cells are square and circles render
// without distortion. All sizes are in grid units (one cell = 1.0).
export default function AttackEffects({ activeShot }) {
  if (!activeShot) return null;
  return <ShotEffect shot={activeShot} />;
}

function ShotEffect({ shot }) {
  const { from, to, profile, phase } = shot;
  const presentation = shot.presentation;
  const isBeam = presentation === PRESENTATION_TYPES.BEAM;

  const fx = from.x + 0.5;
  const fy = from.y + 0.5;
  const tx = to.x + 0.5;
  const ty = to.y + 0.5;

  return (
    <svg
      viewBox={`0 0 ${GRID_WIDTH} ${GRID_HEIGHT}`}
      preserveAspectRatio="none"
      className="absolute inset-0 w-full h-full pointer-events-none z-[12]"
    >
      {/* Muzzle flash / emitter glow at the attacker origin.
          Appears instantly and fades — gives the shot a clear origin point. */}
      <motion.circle
        cx={fx}
        cy={fy}
        fill={profile.muzzleColor}
        initial={{ r: 0, opacity: 0 }}
        animate={{
          r: [0, profile.muzzleRadius * 1.35, profile.muzzleRadius * 0.5],
          opacity: [0, 1, 0],
        }}
        transition={{ duration: 0.2, times: [0, 0.35, 1], ease: 'easeOut' }}
      />

      {/* Beam outer glow — a wide, low-opacity halo around the core line.
          Ballistic shots skip this (kinetic tracers have no energy halo). */}
      {isBeam && (
        <motion.line
          x1={fx}
          y1={fy}
          x2={tx}
          y2={ty}
          stroke={profile.glowColor}
          strokeWidth={profile.tracerWidth * 3.2}
          strokeLinecap="round"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.4, 0] }}
          transition={{ duration: 0.34, times: [0, 0.25, 1], ease: 'easeOut' }}
        />
      )}

      {/* Main tracer / beam line. Ballistic = quick streak; beam = holds a
          touch longer for a directed-energy read. */}
      <motion.line
        x1={fx}
        y1={fy}
        x2={tx}
        y2={ty}
        stroke={profile.tracerColor}
        strokeWidth={profile.tracerWidth}
        strokeLinecap="round"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, isBeam ? 0.55 : 0] }}
        transition={{ duration: isBeam ? 0.34 : 0.22, times: [0, 0.25, 1], ease: 'easeOut' }}
      />

      {/* Bright inner core — gives the line a hot center. */}
      <motion.line
        x1={fx}
        y1={fy}
        x2={tx}
        y2={ty}
        stroke={profile.tracerCoreColor}
        strokeWidth={Math.max(0.02, profile.tracerWidth * 0.45)}
        strokeLinecap="round"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: isBeam ? 0.34 : 0.22, times: [0, 0.25, 1], ease: 'easeOut' }}
      />

      {/* Ballistic leading dot — a small projectile streak traveling from the
          muzzle to the target. Reinforces "bullet" feel. Beam has no projectile. */}
      {!isBeam && (
        <motion.circle
          r={Math.max(0.04, profile.tracerWidth * 1.3)}
          fill={profile.tracerCoreColor}
          initial={{ cx: fx, cy: fy, opacity: 0 }}
          animate={{ cx: [fx, tx], cy: [fy, ty], opacity: [0, 1, 0] }}
          transition={{ duration: 0.13, times: [0, 0.15, 1], ease: 'linear' }}
        />
      )}

      {/* Impact burst at the target. Only renders once the shot connects
          (phase === 'impact'), so it coincides with the damage popup / hit flash
          that Battle.jsx fires at the same moment. */}
      {phase === 'impact' && (
        <motion.circle
          cx={tx}
          cy={ty}
          fill={profile.impactColor}
          initial={{ r: 0, opacity: 0 }}
          animate={{
            r: [0, profile.impactRadius * 1.4, profile.impactRadius * 0.4],
            opacity: [0, 1, 0],
          }}
          transition={{ duration: 0.2, times: [0, 0.4, 1], ease: 'easeOut' }}
        />
      )}
    </svg>
  );
}