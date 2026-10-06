import React from 'react';
import { RotateCcw, ChevronRight } from 'lucide-react';

// TutorialFailureScreen — shown when the entire Tutorial squad is incapacitated.
// Per spec: "WELL. THAT COULD HAVE GONE BETTER." with Retry and Return buttons.
//
// Tutorial failure has NO permanent campaign penalty:
//   • No Credits deducted
//   • No permanent injuries
//   • No Chapter progress change
//   • No campaign loss recorded
//
// Retry resets the Tutorial battlefield + tutorial step state + temporary
// equipment + temporary Commander demo. Return routes to Missions.
export default function TutorialFailureScreen({ onRetry, onReturn }) {
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-neutral-950/95 px-6 text-center">
      <div className="text-blood font-black text-3xl tracking-[0.08em] uppercase mb-2">
        WELL.
      </div>
      <div className="text-neutral-400 font-bold text-sm tracking-[0.12em] uppercase mb-8">
        That could have gone better.
      </div>
      <div className="w-full max-w-xs space-y-3">
        <button
          type="button"
          onClick={onRetry}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-lg bg-bio text-bio-foreground text-sm font-black tracking-[0.15em] uppercase border border-bio active:scale-95 touch-manipulation"
        >
          <RotateCcw className="w-4 h-4" />
          Retry Tutorial
        </button>
        <button
          type="button"
          onClick={onReturn}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-lg bg-neutral-900 text-neutral-300 text-sm font-bold tracking-[0.15em] uppercase border border-neutral-700 active:scale-95 touch-manipulation"
        >
          Return to Campaign
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <p className="text-neutral-600 text-[10px] tracking-wide mt-6 max-w-xs">
        No credits lost. No injuries. No progress change. The tutorial costs nothing to retry.
      </p>
    </div>
  );
}