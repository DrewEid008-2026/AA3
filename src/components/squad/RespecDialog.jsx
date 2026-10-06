import React, { useState } from 'react';
import { X, Swords, Shield, Heart, Wrench, Crosshair, Coins, Check, RotateCw, Info } from 'lucide-react';
import { RESPEC_COST } from '@/game/economy';
import { totalSkillPointsByLevel, countSelectedSkills } from '@/game/skillTrees';

const CLASSES = [
  { id: 'assault', name: 'Assault', icon: Swords },
  { id: 'heavy', name: 'Heavy', icon: Shield },
  { id: 'support', name: 'Support', icon: Heart },
  { id: 'engineer', name: 'Engineer', icon: Wrench },
  { id: 'marksman', name: 'Marksman', icon: Crosshair },
];

// Respec Soldier — a compact, mobile-friendly multi-step flow:
//   Step 1: explanation   Step 2: choose class   Step 3: confirm + commit
// The dialog may always be opened for inspection; the final CONFIRM RESPEC
// button is disabled when the player cannot afford the cost, and the
// shortfall is shown ("Need X more Credits"). No state changes until confirm.
export default function RespecDialog({ soldier, credits, onConfirm, onClose }) {
  const [step, setStep] = useState(1);
  const [selectedClass, setSelectedClass] = useState(soldier.class);

  const canAfford = credits >= RESPEC_COST;
  const shortfall = Math.max(0, RESPEC_COST - credits);
  const currentSkills = countSelectedSkills(soldier);
  const pointsAfter = totalSkillPointsByLevel(soldier.level || 1);
  const isSameClass = selectedClass === soldier.class;

  const handleConfirm = () => {
    if (!canAfford) return;
    onConfirm(selectedClass);
  };

  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-slate-950/85 backdrop-blur-sm px-4 py-6 overflow-y-auto">
      <div className="w-full max-w-sm rounded-xl border border-slate-600 bg-slate-900 p-4 my-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="text-amber-400 font-black text-xs tracking-widest uppercase">
            Respec Soldier
          </div>
          <button onClick={onClose} className="text-slate-400 active:scale-95 touch-manipulation">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* STEP 1 — Explanation */}
        {step === 1 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-4 h-4 text-sky-400" />
              <span className="text-white font-bold text-sm">{soldier.name}</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-snug mb-2">
              Respec allows this soldier to choose a class again and rebuild their Skill Tree.
            </p>
            <ul className="text-[10px] text-slate-400 space-y-1 mb-3">
              <li className="flex items-start gap-1.5"><Check className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" /> Level and XP are preserved.</li>
              <li className="flex items-start gap-1.5"><Check className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" /> All selected skills are refunded.</li>
              <li className="flex items-start gap-1.5"><Check className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" /> Equipment is preserved.</li>
              <li className="flex items-start gap-1.5"><Check className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" /> Career statistics are preserved.</li>
            </ul>
            <div className="flex items-center justify-between rounded-md bg-slate-800/60 border border-slate-700 px-2.5 py-1.5 mb-3">
              <span className="text-[10px] uppercase tracking-wider text-slate-400">Cost</span>
              <span className="inline-flex items-center gap-1 text-amber-300 font-bold text-xs">
                <Coins className="w-3.5 h-3.5" /> {RESPEC_COST} Credits
              </span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-lg border border-slate-600 bg-slate-800 text-slate-300 text-xs font-bold tracking-wide uppercase active:scale-95 transition touch-manipulation"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex-1 py-2.5 rounded-lg bg-amber-500 text-slate-900 text-xs font-bold tracking-wide uppercase active:scale-95 transition touch-manipulation"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* STEP 2 — Class selection */}
        {step === 2 && (
          <div>
            <div className="text-white font-bold text-sm mb-1">Select Class</div>
            <div className="text-[10px] text-slate-500 mb-3">
              Current class may be selected again to rebuild skills.
            </div>
            <div className="space-y-1.5 mb-3">
              {CLASSES.map((c) => {
                const Icon = c.icon;
                const active = selectedClass === c.id;
                const current = soldier.class === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedClass(c.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left active:scale-95 transition touch-manipulation ${
                      active
                        ? 'border-amber-400 bg-amber-950/40'
                        : 'border-slate-700 bg-slate-800/40'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${active ? 'text-amber-300' : 'text-slate-400'}`} />
                    <span className={`font-bold text-xs tracking-wide uppercase ${active ? 'text-white' : 'text-slate-300'}`}>
                      {c.name}
                    </span>
                    {current && (
                      <span className="ml-auto text-[8px] font-bold uppercase tracking-wider text-slate-500 border border-slate-600 px-1.5 py-0.5 rounded">
                        Current
                      </span>
                    )}
                    {active && <Check className="w-4 h-4 text-amber-400 ml-auto" />}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 py-2.5 rounded-lg border border-slate-600 bg-slate-800 text-slate-300 text-xs font-bold tracking-wide uppercase active:scale-95 transition touch-manipulation"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="flex-1 py-2.5 rounded-lg bg-amber-500 text-slate-900 text-xs font-bold tracking-wide uppercase active:scale-95 transition touch-manipulation"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* STEP 3 — Confirmation */}
        {step === 3 && (
          <div>
            <div className="text-white font-bold text-sm mb-2">Confirm Respec</div>
            <div className="space-y-1.5 mb-3">
              <Row label="Soldier" value={soldier.name} />
              <Row label="Current Class" value={cap(soldier.class)} />
              <Row
                label="New Class"
                value={cap(selectedClass)}
                highlight={isSameClass ? 'same' : 'change'}
              />
              <Row label="Level" value={soldier.level} />
              <Row label="Current Skills" value={currentSkills} />
              <Row label="Skill Points After Respec" value={pointsAfter} highlight="points" />
              <div className="flex items-center justify-between rounded-md bg-slate-800/60 border border-slate-700 px-2.5 py-1.5">
                <span className="text-[10px] uppercase tracking-wider text-slate-400">Cost</span>
                <span className={`inline-flex items-center gap-1 font-bold text-xs ${canAfford ? 'text-amber-300' : 'text-rose-400'}`}>
                  <Coins className="w-3.5 h-3.5" /> {RESPEC_COST} Credits
                </span>
              </div>
              {!canAfford && (
                <div className="text-[10px] font-bold text-rose-400 text-center">
                  Need {shortfall} more Credits
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex-1 py-2.5 rounded-lg border border-slate-600 bg-slate-800 text-slate-300 text-xs font-bold tracking-wide uppercase active:scale-95 transition touch-manipulation"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!canAfford}
                className="flex-1 py-2.5 rounded-lg bg-amber-500 text-slate-900 text-xs font-bold tracking-wide uppercase active:scale-95 transition touch-manipulation disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5"
              >
                <RotateCw className="w-3.5 h-3.5" /> Confirm Respec
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, highlight }) {
  const valueClass = highlight === 'change'
    ? 'text-amber-300'
    : highlight === 'points'
      ? 'text-emerald-400'
      : 'text-white';
  return (
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-slate-400 uppercase tracking-wider">{label}</span>
      <span className={`font-bold ${valueClass}`}>{value}</span>
    </div>
  );
}

function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}