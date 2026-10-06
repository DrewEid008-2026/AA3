import React from 'react';
import { RefreshCw, MapPin } from 'lucide-react';

// Development-only map inspection + controls. Rendered only when the Battle
// debug flag is on. Shows the generated battlefield metadata (map id, name,
// seed, supported mission types, selected zones, deployment tiles) and
// exposes controls to regenerate the procedural variation or force a specific
// map template. Never shown in normal gameplay.
export default function MapDebugPanel({ config, missionId, onRegenerate, onForceMap, compatibleMaps }) {
  if (!config) return null;
  return (
    <div className="absolute left-3 top-20 z-40 text-[9px] font-mono text-cyan-100 bg-slate-900/90 border border-cyan-700/60 rounded px-2 py-1.5 max-w-[62%] pointer-events-auto">
      <div className="text-cyan-300 font-bold mb-0.5">MAP: {config.mapName} ({config.mapId})</div>
      <div>SEED: {config.seed}</div>
      <div>DENSITY: {config.density}</div>
      <div>SUPPORTS: {config.supportsMissions.join(', ')}</div>
      {config.selectedObjectiveZone && <div>OBJ: {config.selectedObjectiveZone}</div>}
      {config.selectedCivilianZone && <div>CIV: {config.selectedCivilianZone}</div>}
      <div>EXTRACT: {config.selectedExtractionZone || '—'} tiles</div>
      <div>REINFORCE: {config.selectedReinforcementZone} tiles</div>
      <div>PLAYER: {config.playerDeployTiles.join(' ')}</div>
      <div>ENEMY: {config.enemyDeployTiles.join(' ')}</div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        <button
          type="button"
          onClick={onRegenerate}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-700/70 text-white active:scale-95"
        >
          <RefreshCw className="w-2.5 h-2.5" /> Regenerate
        </button>
      </div>
      {compatibleMaps && compatibleMaps.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {compatibleMaps.map((mid) => (
            <button
              key={mid}
              type="button"
              onClick={() => onForceMap(mid)}
              className={`flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] ${
                mid === config.mapId
                  ? 'bg-cyan-500 text-slate-900'
                  : 'bg-slate-700 text-cyan-200 active:scale-95'
              }`}
            >
              <MapPin className="w-2 h-2" />
              {mid}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}