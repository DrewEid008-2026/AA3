import React from 'react';
import { Zap, ChevronRight } from 'lucide-react';
import { getEnemyCommanderProfile, getEnemyCommanderDisplayProfile } from '@/game/enemyCommanders';

// One-time Chapter 3 title card. Shown the first time the player opens Mission
// Select with Chapter 3 selected. Announces that the enemy now fields the same
// command skills the player has. Dismissed via "Begin"; never repeats (the
// ch3CommanderIntroShown flag is persisted by the caller).
export default function Ch3CommanderIntroCard({ onBegin }) {
  const profile = getEnemyCommanderProfile('vexar_huntsmaster');
  const display = profile ? getEnemyCommanderDisplayProfile(profile) : null;
  const portraitColor = display?.presentationData?.portraitColor || '#dc2626';
  const glyph = display?.presentationData?.portraitGlyph || 'crosshair';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 px-4">
      <div className="w-full max-w-sm flex flex-col items-center text-center">
        {/* Glyph */}
        <div
          className="flex items-center justify-center w-20 h-20 rounded-xl border-2 border-rose-500/60 mb-4"
          style={{ backgroundColor: `${portraitColor}22` }}
        >
          <span className="text-4xl leading-none" style={{ color: portraitColor }}>
            {glyph === 'crosshair' ? '🎯' : glyph === 'skull' ? '☠' : glyph === 'bug' ? '🐛' : '⚔'}
          </span>
        </div>

        {/* Headline */}
        <div className="text-[11px] font-black tracking-[0.35em] text-rose-500 uppercase mb-1">
          Enemy Command Detected
        </div>
        <div className="text-white font-black text-xl tracking-wide leading-tight">
          They Have Noticed Us
        </div>

        {/* Body */}
        <p className="text-slate-300 text-sm leading-relaxed mt-4">
          Alien forces have begun deploying <span className="text-rose-300 font-bold">Commanders</span> of their own — strategic leaders who direct the battlefield from off-map using the same <span className="text-amber-300 font-bold">Command Skills</span> you wield.
        </p>
        <p className="text-slate-400 text-[12px] leading-relaxed mt-2">
          They are not physical units. They cannot be attacked directly. But they will spend Command Points to outmaneuver you. Study them. Plan around them.
        </p>

        {/* Commander reveal */}
        {display && (
          <div className="mt-4 w-full rounded-lg bg-slate-900/80 border border-rose-800/50 px-4 py-3">
            <div className="text-[9px] font-bold tracking-[0.2em] text-rose-400 uppercase">First Hostile Commander</div>
            <div className="text-white font-black text-base tracking-wide mt-0.5">{display.displayName}</div>
            <div className="text-rose-300 font-bold text-xs tracking-wide">{display.title}</div>
            <div className="flex items-center justify-center gap-1 mt-1.5 text-[10px] text-slate-400">
              <Zap className="w-3 h-3 text-amber-400" />
              <span>{display.commandBudget} Command Points per mission</span>
            </div>
          </div>
        )}

        {/* Begin button */}
        <button
          type="button"
          onClick={onBegin}
          className="mt-5 w-full py-3 rounded-lg bg-rose-700 text-white text-xs font-bold tracking-widest uppercase active:scale-95 transition touch-manipulation inline-flex items-center justify-center gap-2"
        >
          Begin
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}