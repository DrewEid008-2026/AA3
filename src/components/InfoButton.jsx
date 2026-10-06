import React from 'react';
import { Info } from 'lucide-react';

// Small persistent info button for the top-right corner, placed between the
// Debug bug and the Options cog. Opens the REALLY-GOOD-HOLD-MY-HAND field
// manual. Styled to match DebugButton / OptionsButton exactly.
export default function InfoButton({ onClick, active }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Information"
      className={`p-1.5 rounded-md border touch-manipulation transition-colors ${
        active
          ? 'bg-amber-500/30 text-amber-200 border-amber-400/60'
          : 'bg-slate-800/80 text-slate-300 border-slate-600 active:bg-slate-700'
      }`}
    >
      <Info className="w-4 h-4" />
    </button>
  );
}