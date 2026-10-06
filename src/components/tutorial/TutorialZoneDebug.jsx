import React from 'react';
import { MapPin, Shield, Skull, Eye, Zap, Flag, CheckCircle, RotateCcw } from 'lucide-react';
import { ZONE_START_STEPS } from '@/game/tutorial/tutorialZones';

// TutorialZoneDebug — dev-only panel for testing the handcrafted Tutorial's
// zone progression. Provides quick-jump buttons for each zone, plus scripted
// event triggers. Hidden from players (only renders when debug is true and
// the tutorial is active).
//
// Props:
//   debug          — whether dev debug mode is on
//   tutorial       — the useTutorial hook return (for debugJump)
//   tutorialMission — the useTutorialMission hook return (for resetTutorialMission)
const ZONE_LABELS = [
  { zone: 1, label: 'Zone 1 — Movement', icon: MapPin },
  { zone: 2, label: 'Zone 2 — Attack', icon: Shield },
  { zone: 3, label: 'Zone 3 — Armor', icon: Shield },
  { zone: 4, label: 'Zone 4 — Abilities', icon: Zap },
  { zone: 5, label: 'Zone 5 — Overwatch', icon: Eye },
  { zone: 6, label: 'Zone 6 — Final', icon: Flag },
];

export default function TutorialZoneDebug({ debug, tutorial, tutorialMission }) {
  if (!debug || !tutorial?.active) return null;

  const handleZoneJump = (zone) => {
    const stepId = ZONE_START_STEPS[zone];
    if (stepId) tutorial.debugJump(stepId);
  };

  return (
    <div className="absolute top-20 right-2 z-40 w-44 rounded-lg border border-neutral-700 bg-neutral-950/95 p-2 space-y-1.5 shadow-2xl">
      <div className="text-[9px] font-black tracking-wider uppercase text-tech px-1 pb-1 border-b border-neutral-800">
        Tutorial Zones
      </div>
      {ZONE_LABELS.map(({ zone, label, icon: Icon }) => (
        <button
          key={zone}
          type="button"
          onClick={() => handleZoneJump(zone)}
          className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded bg-neutral-900 border border-neutral-700 text-neutral-300 text-[10px] font-bold tracking-wide uppercase active:scale-95 touch-manipulation"
        >
          <Icon className="w-3 h-3 shrink-0 text-tech" />
          {label}
        </button>
      ))}
      <div className="border-t border-neutral-800 pt-1.5 space-y-1.5">
        <button
          type="button"
          onClick={() => tutorial.debugJump('tut_downed_event')}
          className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded bg-rose-950/40 border border-rose-800/60 text-rose-200 text-[10px] font-bold tracking-wide uppercase active:scale-95 touch-manipulation"
        >
          <Skull className="w-3 h-3 shrink-0" />
          Force Downed
        </button>
        <button
          type="button"
          onClick={() => tutorial.debugJumpToFinal()}
          className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded bg-neutral-900 border border-neutral-700 text-neutral-300 text-[10px] font-bold tracking-wide uppercase active:scale-95 touch-manipulation"
        >
          <Flag className="w-3 h-3 shrink-0 text-bio" />
          Start Final
        </button>
        <button
          type="button"
          onClick={() => { tutorial.debugRestart(); tutorialMission?.resetTutorialMission(); }}
          className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded bg-neutral-900 border border-neutral-700 text-neutral-300 text-[10px] font-bold tracking-wide uppercase active:scale-95 touch-manipulation"
        >
          <RotateCcw className="w-3 h-3 shrink-0" />
          Restart Tutorial
        </button>
        <button
          type="button"
          onClick={() => tutorial.debugComplete()}
          className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded bg-bio/20 border border-bio/60 text-bio text-[10px] font-bold tracking-wide uppercase active:scale-95 touch-manipulation"
        >
          <CheckCircle className="w-3 h-3 shrink-0" />
          Complete
        </button>
      </div>
    </div>
  );
}