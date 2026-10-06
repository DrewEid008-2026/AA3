import React from 'react';
import { ChevronRight, Lightbulb, X } from 'lucide-react';

// TutorialPanel — the compact instructional message panel.
//
// Sits in the upper area so it never blocks the bottom tactical controls. For
// action-based steps (requiredAction present) it shows the instruction and
// waits — no Continue button. For informational steps it shows a Continue
// button. The hint appears below after idle time (Section U).
//
// Props:
//   step        — current tutorial step object (or null when inactive)
//   hintVisible — show the contextual hint strip
//   hint        — hint text
//   onContinue  — advance an informational step
//   onDismissHint
//   stepIndex / totalSteps — progress indicator
export default function TutorialPanel({
  step,
  hintVisible,
  hint,
  onContinue,
  onDismissHint,
  stepIndex,
  totalSteps,
}) {
  if (!step) return null;

  const isVictory = step.id === 'tut_victory';
  const isActionStep = !!step.requiredAction;
  const showContinue = !isActionStep && !step.autoAdvance && !isVictory;

  return (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-md pointer-events-auto">
      <div className="rounded-xl border-2 border-bio/70 bg-neutral-950/95 shadow-2xl shadow-bio/20 overflow-hidden">
        {/* Progress bar */}
        <div className="h-0.5 bg-neutral-800">
          <div
            className="h-full bg-bio transition-all duration-300"
            style={{ width: `${totalSteps > 0 ? ((stepIndex + 1) / totalSteps) * 100 : 0}%` }}
          />
        </div>

        <div className="px-4 pt-3 pb-3">
          {/* Title */}
          <div className="flex items-start gap-2 mb-1.5">
            <div className="text-[9px] font-black tracking-wider uppercase text-bio shrink-0 mt-0.5">
              TUT
            </div>
            <h2 className="text-white font-black text-sm tracking-wide uppercase leading-tight flex-1">
              {step.title}
            </h2>
          </div>

          {/* Body */}
          <p className="text-neutral-300 text-[13px] leading-snug mb-2.5">
            {step.body}
          </p>

          {/* Action prompt or Continue */}
          {isActionStep && (
            <div className="flex items-center gap-1.5 text-bio text-[11px] font-bold tracking-wider uppercase">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-bio animate-pulse" />
              Awaiting your action
            </div>
          )}

          {showContinue && (
            <button
              type="button"
              onClick={onContinue}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-bio/60 bg-bio/15 text-bio text-xs font-bold tracking-wide uppercase active:scale-95 touch-manipulation transition"
            >
              Continue
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {isVictory && step.completionAction === 'start_campaign' && (
            <button
              type="button"
              onClick={onContinue}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-lg border-2 border-amber-400 bg-amber-500 text-neutral-950 text-sm font-black tracking-[0.15em] uppercase active:scale-95 touch-manipulation transition shadow-lg shadow-amber-500/30"
            >
              Start Campaign
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Contextual hint (Section U) */}
        {hintVisible && hint && (
          <div className="flex items-start gap-2 px-4 py-2 bg-amber-500/10 border-t border-amber-500/30">
            <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-[9px] font-black tracking-wider uppercase text-amber-400 mb-0.5">Need a hand?</div>
              <div className="text-amber-100 text-[11px] leading-snug">{hint}</div>
            </div>
            <button
              type="button"
              onClick={onDismissHint}
              className="p-1 rounded text-amber-400/60 active:scale-90 touch-manipulation shrink-0"
              aria-label="Dismiss hint"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}