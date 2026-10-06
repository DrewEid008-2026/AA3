import React, { useEffect, useState } from 'react';
import { MISSION_TYPES } from '@/game/constants';

const TYPE_LABELS = {
  [MISSION_TYPES.ELIMINATION]: 'ELIMINATION',
  [MISSION_TYPES.EXTRACTION]: 'EXTRACTION',
  [MISSION_TYPES.RESCUE]: 'RESCUE',
  [MISSION_TYPES.SABOTAGE]: 'SABOTAGE',
  [MISSION_TYPES.BOSS]: 'CHAPTER BOSS',
};

// Brief atmospheric banner shown when a mission loads: the map name and mission
// type. Auto-dismisses after a short delay. No confirmation, no interaction.
export default function MapIntroBanner({ mapName, missionType }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 2600);
    return () => clearTimeout(t);
  }, [mapName, missionType]);

  if (!visible) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="flex flex-col items-center gap-1 px-8 py-5 rounded-lg bg-slate-950/85 border border-slate-700 shadow-2xl animate-pulse">
        <div className="text-amber-400 font-black text-xl tracking-[0.25em] uppercase">
          {mapName || 'UNKNOWN'}
        </div>
        <div className="text-slate-300 text-[11px] font-bold tracking-[0.3em] uppercase">
          {TYPE_LABELS[missionType] || missionType}
        </div>
      </div>
    </div>
  );
}