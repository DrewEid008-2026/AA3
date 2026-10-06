import React from 'react';
import { Bug } from 'lucide-react';

// Small persistent bug button for the top-right corner, placed next to the
// Options gear. Opens the debug controls overlay. Styled to match OptionsButton
// but tinted cyan so it's visually distinct from the settings cog.
export default function DebugButton({ onClick, active }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Debug"
      className={`p-1.5 rounded-md border touch-manipulation transition-colors ${
        active
          ? 'bg-cyan-500/30 text-cyan-200 border-cyan-400/60'
          : 'bg-slate-800/80 text-cyan-400 border-slate-600 active:bg-slate-700'
      }`}
    >
      <Bug className="w-4 h-4" />
    </button>
  );
}