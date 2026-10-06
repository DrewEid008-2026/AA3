import React, { useMemo, useState } from 'react';
import { GRID_WIDTH, GRID_HEIGHT } from '@/game/constants';
import { getMissionMapConfig } from '@/game/missions';

// Development-only visualization for THE HARVESTER PIT boss arena.
// Renders data-only placeholders (future Siege Charge lanes, reinforcement
// zones, Tremor 3x3 areas, Excavation Beam lanes, Meltdown zone, and the boss
// footprint) over the battlefield so the arena's future-boss support can be
// verified before the Harvester's behavior is implemented.
//
// Toggleable layers via small buttons. Never shown to normal players — only
// rendered when the Battle debug flag is on AND the mission uses the
// Harvester Pit map. Reads the cached map config directly so no Battle.jsx
// plumbing changes are required.

const HARVESTER_PIT_ID = 'harvester_pit_ch2';

const tileCenter = (x, y) => ({
  left: `${((x + 0.5) / GRID_WIDTH) * 100}%`,
  top: `${((y + 0.5) / GRID_HEIGHT) * 100}%`,
});

const tileBox = (x, y) => ({
  ...tileCenter(x, y),
  width: `${100 / GRID_WIDTH}%`,
  height: `${100 / GRID_HEIGHT}%`,
  transform: 'translate(-50%, -50%)',
});

export default function HarvesterPitDevOverlay({ missionConfig }) {
  const [show, setShow] = useState(true);
  const [layer, setLayer] = useState('all'); // all | charge | reinforce | tremor | beam | meltdown | boss

  const cfg = useMemo(() => {
    if (!missionConfig) return null;
    const c = getMissionMapConfig(missionConfig.id);
    return c && c.mapId === HARVESTER_PIT_ID ? c : null;
  }, [missionConfig]);

  if (!cfg) return null;

  const on = (l) => layer === 'all' || layer === l;

  return (
    <div className="absolute right-3 top-24 z-40 pointer-events-auto">
      <div className="text-[9px] font-mono text-lime-200 bg-slate-900/90 border border-lime-700/60 rounded px-2 py-1.5 max-w-[62%]">
        <div className="flex items-center gap-1 mb-1">
          <span className="text-lime-300 font-bold">HARVESTER PIT DEV</span>
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="px-1 py-0.5 rounded bg-lime-700/70 text-white active:scale-95"
          >
            {show ? 'HIDE' : 'SHOW'}
          </button>
        </div>
        {show && (
          <>
            <div className="flex flex-wrap gap-0.5 mb-1">
              {['all', 'charge', 'reinforce', 'tremor', 'beam', 'meltdown', 'boss'].map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLayer(l)}
                  className={`px-1 py-0.5 rounded text-[8px] ${layer === l ? 'bg-lime-500 text-slate-900' : 'bg-slate-700 text-lime-200 active:scale-95'}`}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="text-[8px] text-slate-400">
              Charge: {cfg.siegeChargeLanes?.length || 0} · Tremor: {cfg.tremorAreas?.length || 0} · Beam: {cfg.beamLanes?.length || 0} · Reinforce: {Object.keys(cfg.phase2ReinforcementZones || {}).length}
            </div>
          </>
        )}
      </div>

      {show && (
        <div className="absolute inset-0 pointer-events-none">
          {/* Boss footprint */}
          {on('boss') && cfg.bossSpawn && (
            <div
              className="absolute border-2 border-dashed border-fuchsia-400/80 bg-fuchsia-500/15 rounded-sm flex items-center justify-center"
              style={tileBox(cfg.bossSpawn.x, cfg.bossSpawn.y)}
            >
              <span className="text-[7px] font-mono text-fuchsia-200">BOSS</span>
            </div>
          )}

          {/* Reinforcement zones */}
          {on('reinforce') && cfg.phase2ReinforcementZones &&
            Object.entries(cfg.phase2ReinforcementZones).map(([name, tiles]) =>
              tiles.map((t) => (
                <div
                  key={`rf_${name}_${t.x}_${t.y}`}
                  className="absolute border border-cyan-400/70 bg-cyan-500/20 rounded-sm flex items-center justify-center"
                  style={tileBox(t.x, t.y)}
                >
                  <span className="text-[6px] font-mono text-cyan-200">RF</span>
                </div>
              ))
            )}

          {/* Tremor 3x3 areas */}
          {on('tremor') && (cfg.tremorAreas || []).map((a, i) => (
            <div
              key={`tm_${i}`}
              className="absolute border-2 border-orange-400/70 bg-orange-500/10 rounded-sm"
              style={tileBox(a.center.x, a.center.y)}
            >
              <span className="absolute inset-0 flex items-center justify-center text-[7px] font-mono text-orange-200">3×3</span>
            </div>
          ))}

          {/* Meltdown zone */}
          {on('meltdown') && (cfg.meltdownZone || []).map((t, i) => (
            <div
              key={`md_${i}`}
              className="absolute border border-red-500/80 bg-red-500/20 rounded-sm flex items-center justify-center"
              style={tileBox(t.x, t.y)}
            >
              <span className="text-[6px] font-mono text-red-200">MD</span>
            </div>
          ))}

          {/* Siege Charge lanes (straight lines) */}
          {on('charge') && (cfg.siegeChargeLanes || []).map((lane) => {
            const a = tileCenter(lane.from.x, lane.from.y);
            const b = tileCenter(lane.to.x, lane.to.y);
            return (
              <svg
                key={`sc_${lane.id}`}
                className="absolute inset-0 w-full h-full"
                style={{ overflow: 'visible' }}
                preserveAspectRatio="none"
                viewBox="0 0 100 100"
              >
                <line
                  x1={parseFloat(a.left)} y1={parseFloat(a.top)}
                  x2={parseFloat(b.left)} y2={parseFloat(b.top)}
                  stroke="rgba(244,63,94,0.55)" strokeWidth="0.8" strokeDasharray="2 1.5"
                />
              </svg>
            );
          })}

          {/* Excavation Beam lanes */}
          {on('beam') && (cfg.beamLanes || []).map((lane) => {
            const a = tileCenter(lane.from.x, lane.from.y);
            const b = tileCenter(lane.to.x, lane.to.y);
            return (
              <svg
                key={`bm_${lane.id}`}
                className="absolute inset-0 w-full h-full"
                style={{ overflow: 'visible' }}
                preserveAspectRatio="none"
                viewBox="0 0 100 100"
              >
                <line
                  x1={parseFloat(a.left)} y1={parseFloat(a.top)}
                  x2={parseFloat(b.left)} y2={parseFloat(b.top)}
                  stroke="rgba(56,189,248,0.5)" strokeWidth="0.6" strokeDasharray="1.5 1.5"
                />
              </svg>
            );
          })}
        </div>
      )}
    </div>
  );
}