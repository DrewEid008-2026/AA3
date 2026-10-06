// Enemy Commander banners. Three modes:
//   1. First encounter intro (mission start): "HOSTILE COMMAND SIGNAL DETECTED"
//      + commander name + title. Shown on the player's first hostile Commander
//      encounter. The tutorial overlay follows this banner.
//   2. Repeat intro (mission start): "HOSTILE COMMANDER" + commander name +
//      title. Shown on subsequent encounters. No tutorial.
//   3. Command (enemy phase): "ENEMY COMMAND" + skill name + commander name.
// All are brief, non-blocking, and auto-dismiss (managed by the hook).

import React from 'react';

export default function EnemyCommanderBanner({ visible, displayProfile, commandNotification, isFirstEncounter }) {
  // Command notification takes priority when set.
  if (commandNotification) {
    return (
      <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
        <div className="flex flex-col items-center gap-1 px-6 py-4 rounded-xl bg-slate-950/92 border-2 border-rose-600/70 shadow-2xl shadow-rose-900/50">
          <div className="text-[10px] font-black tracking-[0.3em] text-rose-500 uppercase">
            Enemy Command
          </div>
          <div className="text-lg font-black text-white tracking-wide">
            {commandNotification.skillName}
          </div>
          <div className="text-xs font-bold text-rose-300 tracking-[0.15em] uppercase">
            {commandNotification.commanderName}
          </div>
        </div>
      </div>
    );
  }

  // Intro banner (mission start).
  if (!visible || !displayProfile) return null;
  const heading = isFirstEncounter ? 'Hostile Command Signal Detected' : 'Hostile Commander';
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
      <div className="flex flex-col items-center gap-1 px-6 py-4 rounded-xl bg-slate-950/92 border-2 border-rose-700/70 shadow-2xl shadow-rose-900/50 animate-pulse">
        <div className="text-[10px] font-black tracking-[0.3em] text-rose-500 uppercase">
          {heading}
        </div>
        <div className="text-lg font-black text-white tracking-wide">
          {displayProfile.displayName}
        </div>
        {displayProfile.title && displayProfile.title !== 'CLASSIFIED' && (
          <div className="text-xs font-bold text-rose-300 tracking-[0.15em] uppercase">
            {displayProfile.title}
          </div>
        )}
        {isFirstEncounter && (
          <div className="text-[10px] text-slate-400 tracking-wide mt-1">
            Alien command activity detected.
          </div>
        )}
      </div>
    </div>
  );
}