import React from 'react';
import { GRID_WIDTH, GRID_HEIGHT, MISSION_TYPES } from '@/game/constants';

// Read-only information overlay rendered above the battlefield while the
// Tactical Lens is active. Shows threat tint, inspected-unit weapon range,
// current lines of fire, objective emphasis, and known reinforcement entry
// areas. Nothing here mutates game state. All positioning is percentage-based
// so it scales with the battlefield container.
//
// Cover emphasis is handled separately in Tile.jsx (via the `coverEmphasis`
// prop) so the existing cover bars just become more prominent.

const center = (x, y) => ({
  left: `${((x + 0.5) / GRID_WIDTH) * 100}%`,
  top: `${((y + 0.5) / GRID_HEIGHT) * 100}%`,
});

function TileTints({ keys, className }) {
  if (!keys || keys.size === 0) return null;
  return (
    <div className="absolute inset-0 pointer-events-none z-[6]">
      {Array.from(keys).map((k) => {
        const [x, y] = k.split(',').map(Number);
        return (
          <span
            key={k}
            className={`absolute rounded-sm ${className}`}
            style={{
              left: `${(x / GRID_WIDTH) * 100}%`,
              top: `${(y / GRID_HEIGHT) * 100}%`,
              width: `${100 / GRID_WIDTH}%`,
              height: `${100 / GRID_HEIGHT}%`,
            }}
          />
        );
      })}
    </div>
  );
}

function LinesOfFire({ lines }) {
  if (!lines || lines.length === 0) return null;
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none z-[7]"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      {lines.map((l, i) => {
        const x1 = ((l.from.x + 0.5) / GRID_WIDTH) * 100;
        const y1 = ((l.from.y + 0.5) / GRID_HEIGHT) * 100;
        const x2 = ((l.to.x + 0.5) / GRID_WIDTH) * 100;
        const y2 = ((l.to.y + 0.5) / GRID_HEIGHT) * 100;
        const color = l.targetTeam === 'enemy' ? '#f43f5e' : '#38bdf8';
        return (
          <line
            key={i}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={color}
            strokeWidth={2}
            strokeDasharray="4 3"
            vectorEffect="non-scaling-stroke"
            opacity={0.85}
          />
        );
      })}
    </svg>
  );
}

function ObjectiveMarker({ x, y, children, ringClass }) {
  return (
    <div
      className="absolute pointer-events-none z-[6]"
      style={{ ...center(x, y), width: `${100 / GRID_WIDTH}%`, height: `${100 / GRID_HEIGHT}%`, transform: 'translate(-50%, -50%)' }}
    >
      <span className={`absolute inset-[8%] rounded-sm ring-2 ${ringClass}`} />
      {children}
    </div>
  );
}

export default function TacticalLensOverlay({
  threatTiles,
  showThreat,
  inspectedRangeTiles,
  linesOfFire,
  extractionZone,
  civilian,
  device,
  missionType,
  reinforcementSpawns,
  reinforcementCountdown,
  reinforcementCanceled,
  standardReinforcementSpawned,
  eliteActive,
  lensInspectedId,
  units,
  beamSweepTiles,
  overloadTiles,
}) {
  const showReinforcementArea = !reinforcementCanceled && !standardReinforcementSpawned && reinforcementCountdown > 0;
  return (
    <>
      {/* Beam Sweep incoming lane — highly visible fuchsia warning */}
      {beamSweepTiles && beamSweepTiles.size > 0 && (
        <>
          <TileTints keys={beamSweepTiles} className="bg-fuchsia-500/30 border border-fuchsia-400/60 animate-pulse" />
          <div className="absolute top-1 left-1/2 -translate-x-1/2 z-[8] pointer-events-none">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase text-fuchsia-200 bg-slate-950/85 border border-fuchsia-600/50 px-2 py-1 rounded animate-pulse">
              ◆ Beam Sweep Incoming
            </span>
          </div>
        </>
      )}

      {/* Overload hazard tiles — orange energy cracks (Phase 3 Core Overload).
          Distinct from Beam Sweep (fuchsia) and Plasma Strike (fuchsia blast). */}
      {overloadTiles && overloadTiles.size > 0 && (
        <>
          <TileTints keys={overloadTiles} className="bg-orange-500/25 border border-orange-400/60 animate-pulse" />
          <div className="absolute top-1 left-1/2 -translate-x-1/2 z-[8] pointer-events-none" style={{ top: `${beamSweepTiles && beamSweepTiles.size > 0 ? '28px' : '4px'}` }}>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase text-orange-200 bg-slate-950/85 border border-orange-600/50 px-2 py-1 rounded animate-pulse">
              ⚡ Overload — 3 Environmental Damage
            </span>
          </div>
        </>
      )}

      {/* Threat tint (current basic-weapon danger) */}
      {showThreat && (
        <TileTints keys={threatTiles} className="bg-rose-500/18 border border-rose-500/25" />
      )}

      {/* Inspected unit weapon range — distinct violet, drawn above threat */}
      <TileTints keys={inspectedRangeTiles} className="bg-violet-500/20 border border-violet-400/40" />

      {/* Current lines of fire for the inspected unit */}
      <LinesOfFire lines={linesOfFire} />

      {/* Objective emphasis */}
      {extractionZone && extractionZone.length > 0 && (
        <div className="absolute inset-0 pointer-events-none z-[6]">
          {extractionZone.map((t) => (
            <div
              key={`lex_${t.x}_${t.y}`}
              className="absolute"
              style={{
                ...center(t.x, t.y),
                width: `${100 / GRID_WIDTH}%`,
                height: `${100 / GRID_HEIGHT}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <span className="absolute inset-0 rounded-sm ring-2 ring-emerald-400/80 bg-emerald-400/10 animate-pulse" />
            </div>
          ))}
        </div>
      )}
      {civilian && !civilian.safe && (
        <ObjectiveMarker x={civilian.x} y={civilian.y} ringClass="ring-sky-400/80">
          <span className="absolute inset-0 rounded-sm bg-sky-400/10 animate-pulse" />
        </ObjectiveMarker>
      )}
      {device && !device.sabotaged && (
        <ObjectiveMarker x={device.x} y={device.y} ringClass="ring-amber-400/80">
          <span className="absolute inset-0 rounded-sm bg-amber-400/10 animate-pulse" />
        </ObjectiveMarker>
      )}
      {missionType === MISSION_TYPES.ELIMINATION && (
        <div className="absolute inset-0 pointer-events-none z-[6]">
          {units.filter((u) => u.team === 'enemy' && u.alive).map((u) => (
            <div
              key={`lenemy_${u.id}`}
              className="absolute"
              style={{
                ...center(u.x, u.y),
                width: `${100 / GRID_WIDTH}%`,
                height: `${100 / GRID_HEIGHT}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <span className={`absolute inset-[10%] rounded-sm ring-2 ${u.id === lensInspectedId ? 'ring-cyan-300' : 'ring-rose-400/70'}`} />
            </div>
          ))}
        </div>
      )}

      {/* Boss mission: Power Relay markers + Warden Core Shield indicator */}
      {missionType === MISSION_TYPES.BOSS && (
        <div className="absolute inset-0 pointer-events-none z-[6]">
          {/* Relay markers — active (fuchsia) vs destroyed (dark) */}
          {units.filter((u) => u.isBossObject).map((u) => (
            <div
              key={`lrelay_${u.id}`}
              className="absolute"
              style={{
                ...center(u.x, u.y),
                width: `${100 / GRID_WIDTH}%`,
                height: `${100 / GRID_HEIGHT}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <span className={`absolute inset-[8%] rounded-sm ring-2 ${u.alive ? 'ring-fuchsia-400/80 bg-fuchsia-400/10' : 'ring-slate-600/50 bg-slate-700/10'}`} />
              {!u.alive && (
                <span className="absolute inset-0 flex items-center justify-center text-[7px] font-bold uppercase text-slate-500">
                  Down
                </span>
              )}
            </div>
          ))}
          {/* Warden marker with Core Shield indicator */}
          {units.filter((u) => u.isBoss && u.alive).map((u) => (
            <div
              key={`lwarden_${u.id}`}
              className="absolute"
              style={{
                ...center(u.x, u.y),
                width: `${100 / GRID_WIDTH}%`,
                height: `${100 / GRID_HEIGHT}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <span className={`absolute inset-[8%] rounded-sm ring-2 ${u.id === lensInspectedId ? 'ring-cyan-300' : 'ring-cyan-400/70'} bg-cyan-400/10`} />
              {u.coreShield > 0 && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[7px] font-bold text-cyan-300 bg-slate-950/80 px-0.5 rounded whitespace-nowrap">
                  ◈{u.coreShield}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Known reinforcement entry area */}
      {showReinforcementArea && reinforcementSpawns && reinforcementSpawns.length > 0 && (
        <div className="absolute inset-0 pointer-events-none z-[6]">
          {reinforcementSpawns.map((t, i) => (
            <div
              key={`lrein_${i}`}
              className="absolute"
              style={{
                ...center(t.x, t.y),
                width: `${100 / GRID_WIDTH}%`,
                height: `${100 / GRID_HEIGHT}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <span className="absolute inset-[20%] rounded-full border-2 border-dashed border-amber-400/60" />
            </div>
          ))}
        </div>
      )}

      {/* Reinforcement countdown banner */}
      {showReinforcementArea && (
        <div className="absolute top-1 left-1/2 -translate-x-1/2 z-[8] pointer-events-none">
          <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase text-amber-200 bg-slate-950/85 border border-amber-600/50 px-2 py-1 rounded">
            Enemy Response — {reinforcementCountdown} {reinforcementCountdown === 1 ? 'Round' : 'Rounds'}
          </span>
        </div>
      )}
      {eliteActive && (
        <div className="absolute top-1 left-1/2 -translate-x-1/2 z-[8] pointer-events-none">
          <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase text-fuchsia-200 bg-slate-950/85 border border-fuchsia-600/50 px-2 py-1 rounded">
            Elite Response Active
          </span>
        </div>
      )}
    </>
  );
}