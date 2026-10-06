import React, { useState } from 'react';
import { Bug, SkipForward, RotateCcw, Flag, FastForward } from 'lucide-react';
import { TUTORIAL_STEPS } from '@/game/tutorial/tutorialSteps';

// TutorialDebugPanel — development-only controls for the tutorial.
// Hidden from production players (rendered only when `debug` is true).
//
// Controls:
//   - Jump to any step (dropdown)
//   - Skip current step (mark complete without performing)
//   - Restart tutorial from the beginning
//   - Jump to final free-form fight
//   - Mark tutorial complete (test victory flow)
//   - Current step info: id, required action, allowed actions
export default function TutorialDebugPanel({
  debug,
  active,
  currentStep,
  stepIndex,
  totalSteps,
  onJump,
  onSkip,
  onRestart,
  onJumpToFinal,
  onComplete,
}) {
  const [open, setOpen] = useState(false);
  if (!debug || !active) return null;

  return (
    <div className="absolute bottom-2 left-2 z-50 max-w-[240px]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-bio/50 bg-neutral-950/90 text-bio text-[10px] font-bold tracking-wider uppercase active:scale-95 touch-manipulation"
      >
        <Bug className="w-3.5 h-3.5" />
        Tut Debug
      </button>

      {open && (
        <div className="mt-1.5 rounded-lg border border-neutral-700 bg-neutral-950/95 shadow-2xl p-2.5 space-y-2">
          {/* Current step info */}
          <div className="rounded border border-neutral-800 bg-neutral-900/60 p-2">
            <div className="text-[9px] font-black tracking-wider uppercase text-neutral-400 mb-1">
              Step {stepIndex + 1}/{totalSteps}
            </div>
            <div className="text-white text-[11px] font-bold truncate">{currentStep?.id}</div>
            <div className="text-neutral-400 text-[10px] mt-0.5">
              {currentStep?.requiredAction
                ? `requires: ${currentStep.requiredAction.type}`
                : currentStep?.autoAdvance
                  ? 'auto-advance'
                  : 'continue'}
            </div>
            {currentStep?.allowedActions?.length > 0 && (
              <div className="text-bio text-[9px] mt-0.5 leading-tight">
                allows: {currentStep.allowedActions.join(', ')}
              </div>
            )}
          </div>

          {/* Jump to step */}
          <div>
            <div className="text-[9px] font-bold tracking-wider uppercase text-neutral-400 mb-1">Jump to step</div>
            <select
              value={currentStep?.id || ''}
              onChange={(e) => onJump(e.target.value)}
              className="w-full text-[11px] bg-neutral-900 border border-neutral-700 text-white rounded px-1.5 py-1"
            >
              {TUTORIAL_STEPS.map((s, i) => (
                <option key={s.id} value={s.id}>
                  {i + 1}. {s.id}
                </option>
              ))}
            </select>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-1.5">
            <DebugBtn icon={SkipForward} label="Skip Step" onClick={onSkip} />
            <DebugBtn icon={RotateCcw} label="Restart" onClick={onRestart} />
            <DebugBtn icon={FastForward} label="Final Fight" onClick={onJumpToFinal} />
            <DebugBtn icon={Flag} label="Complete" onClick={onComplete} />
          </div>
        </div>
      )}
    </div>
  );
}

function DebugBtn({ icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center gap-1 py-1.5 rounded border border-neutral-700 bg-neutral-800 text-neutral-200 text-[10px] font-bold tracking-wide uppercase active:scale-95 touch-manipulation"
    >
      <Icon className="w-3 h-3" />
      {label}
    </button>
  );
}