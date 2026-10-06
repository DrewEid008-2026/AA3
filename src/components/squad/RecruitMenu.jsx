import React from 'react';
import { Swords, Shield, Heart, Wrench, Crosshair, X, UserPlus } from 'lucide-react';
import { PLAYER_ARCHETYPES } from '@/game/unitTypes';

const CLASS_ICONS = {
  assault: Swords,
  heavy: Shield,
  support: Heart,
  engineer: Wrench,
  marksman: Crosshair,
};

const CLASS_DESCRIPTIONS = {
  assault: 'Close-range aggression and mobility',
  heavy: 'Suppression and demolition',
  support: 'Healing and squad command',
  engineer: 'Fortification and battlefield control',
  marksman: 'Precision and repositioning',
};

const CLASS_ACCENT = {
  assault: 'border-sky-600/50 bg-sky-950/30 active:bg-sky-900/40',
  heavy: 'border-indigo-600/50 bg-indigo-950/30 active:bg-indigo-900/40',
  support: 'border-emerald-600/50 bg-emerald-950/30 active:bg-emerald-900/40',
  engineer: 'border-amber-600/50 bg-amber-950/30 active:bg-amber-900/40',
  marksman: 'border-violet-600/50 bg-violet-950/30 active:bg-violet-900/40',
};

const CLASS_ICON_COLOR = {
  assault: 'text-sky-400',
  heavy: 'text-indigo-400',
  support: 'text-emerald-400',
  engineer: 'text-amber-400',
  marksman: 'text-violet-400',
};

// Compact portrait-friendly recruitment menu. Lists all playable classes as
// large touch-friendly selections. Tapping a class creates the soldier
// immediately (recruiting is free — no resource confirmation needed).
export default function RecruitMenu({ onSelectClass, onClose }) {
  const classes = Object.keys(PLAYER_ARCHETYPES);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-slate-900 border-t border-slate-700 rounded-t-xl max-h-[80dvh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-amber-400" />
            <h3 className="text-white font-bold text-sm tracking-wide uppercase">Select New Recruit's Class</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 active:scale-95">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-3 space-y-2">
          {classes.map((cls) => {
            const Icon = CLASS_ICONS[cls];
            return (
              <button
                key={cls}
                type="button"
                onClick={() => onSelectClass(cls)}
                className={`w-full flex items-center gap-3 rounded-lg border p-3 transition touch-manipulation active:scale-[0.98] ${CLASS_ACCENT[cls]}`}
              >
                <div className="w-10 h-10 rounded-md bg-slate-900/80 flex items-center justify-center shrink-0">
                  <Icon className={`w-5 h-5 ${CLASS_ICON_COLOR[cls]}`} />
                </div>
                <div className="text-left min-w-0">
                  <div className="text-white font-bold text-sm tracking-wide uppercase">{PLAYER_ARCHETYPES[cls].name}</div>
                  <div className="text-[11px] text-slate-400">{CLASS_DESCRIPTIONS[cls]}</div>
                </div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 ml-auto shrink-0">
                  Free
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}