import React from 'react';
import { Settings } from 'lucide-react';

// Small persistent gear button for the top-right corner. Sized to be tappable
// on mobile without competing with tactical information. The active state is
// used when the overlay is open.
export default function OptionsButton({ onClick, active }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Options"
      className={`p-1.5 rounded-md border touch-manipulation transition-colors ${
        active
          ? 'bg-amber-500/30 text-amber-200 border-amber-400/60'
          : 'bg-slate-800/80 text-slate-300 border-slate-600 active:bg-slate-700'
      }`}
    >
      <Settings className="w-4 h-4" />
    </button>
  );
}