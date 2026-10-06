// Enemy Commander info panel — opened by tapping the presence indicator.
// Informational only: shows identity (or hidden entity), title, doctrine,
// description, current/max Command Budget, and known Commander Skills (from
// the centralized skill definitions — never duplicated in profile data).
//
// No targeting, no preview, no confirm — those come in 3.2.2.

import React from 'react';
import { X, Zap } from 'lucide-react';
import { getCommanderSkill } from '@/game/commanderSkills';

export default function EnemyCommanderPanel({ displayProfile, budgetCurrent, budgetMax, onClose }) {
  if (!displayProfile) return null;
  const portraitColor = displayProfile.presentationData?.portraitColor || '#dc2626';
  const glyph = displayProfile.presentationData?.portraitGlyph || 'skull';
  const exhausted = budgetCurrent <= 0;

  const knownSkills = (displayProfile.skillIds || [])
    .map((id) => getCommanderSkill(id))
    .filter(Boolean);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl bg-slate-900 border-2 border-rose-700/60 shadow-2xl shadow-rose-900/40 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 p-3 bg-gradient-to-b from-rose-950/60 to-slate-900 border-b border-rose-800/40">
          <div
            className="flex items-center justify-center w-12 h-12 rounded-lg border border-rose-500/50 shrink-0"
            style={{ backgroundColor: `${portraitColor}22` }}
          >
            <span className="text-2xl leading-none" style={{ color: portraitColor }}>
              {glyph === 'bug' ? '🐛' : glyph === 'skull' ? '☠' : '⚔'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[9px] font-bold tracking-[0.2em] text-rose-400 uppercase">Enemy Commander</div>
            <div className="text-base font-black text-white leading-tight">{displayProfile.displayName}</div>
            <div className="text-xs font-bold text-rose-300 tracking-wide">{displayProfile.title}</div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 -mt-1 -mr-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-3 space-y-3 max-h-[60vh] overflow-y-auto">
          {/* Command Budget */}
          <div className="flex items-center justify-between rounded-lg bg-slate-950/60 border border-rose-900/40 px-3 py-2">
            <div className="flex items-center gap-2">
              <Zap className={`w-4 h-4 ${exhausted ? 'text-rose-600' : 'text-amber-400'}`} />
              <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Command Budget</span>
            </div>
            <div className={`font-mono font-black text-lg ${exhausted ? 'text-rose-500' : 'text-amber-300'}`}>
              {budgetCurrent} / {budgetMax}
            </div>
          </div>
          {exhausted && (
            <div className="text-[10px] text-rose-400/80 text-center -mt-1">
              Commander is present but exhausted — no commands remaining.
            </div>
          )}

          {/* Doctrine */}
          <div>
            <div className="text-[9px] font-bold tracking-[0.15em] text-slate-500 uppercase mb-0.5">Doctrine</div>
            <div className="text-xs text-slate-200">{displayProfile.doctrine}</div>
          </div>

          {/* Description */}
          <div>
            <div className="text-[9px] font-bold tracking-[0.15em] text-slate-500 uppercase mb-0.5">Intel</div>
            <div className="text-xs text-slate-300 leading-relaxed">{displayProfile.description}</div>
          </div>

          {/* Known Commands */}
          <div>
            <div className="text-[9px] font-bold tracking-[0.15em] text-slate-500 uppercase mb-1">Known Commands</div>
            {knownSkills.length === 0 ? (
              <div className="text-xs text-slate-500 italic">No known commands.</div>
            ) : (
              <div className="space-y-1.5">
                {knownSkills.map((skill) => (
                  <div key={skill.id} className="rounded-md bg-slate-950/50 border border-slate-800 px-2.5 py-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-rose-200">{skill.name}</span>
                      {skill.enemyCommandPointCost != null && (
                        <span className="flex items-center gap-0.5 text-[10px] font-mono font-bold text-amber-400">
                          <Zap className="w-3 h-3" /> {skill.enemyCommandPointCost}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 leading-snug mt-0.5">{skill.desc}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="text-[9px] text-slate-600 text-center pt-1 border-t border-slate-800/60">
            Off-map strategic leader — not a battlefield target.
          </div>
        </div>
      </div>
    </div>
  );
}