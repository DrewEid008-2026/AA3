import React from 'react';
import { ScanLine } from 'lucide-react';

// Direct tactical HUD toggle for the Tactical Lens information mode. Shown in
// the top bar so it is always reachable during combat (not buried in Options).
// The active state makes it obvious the Lens overlay is on.
export default function TacticalLensButton({ active, onToggle, disabled }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-label="Tactical Lens"
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-bold tracking-wider uppercase touch-manipulation transition-colors ${
        disabled
          ? 'bg-slate-800 text-slate-600 border-slate-700 cursor-not-allowed'
          : active
            ? 'bg-cyan-500/30 text-cyan-200 border-cyan-400/70'
            : 'bg-slate-800/80 text-slate-300 border-slate-600 active:bg-slate-700'
      }`}
    >
      <ScanLine className="w-3.5 h-3.5" />
      Lens
    </button>
  );
}