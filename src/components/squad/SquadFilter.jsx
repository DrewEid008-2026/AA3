import React from 'react';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'assault', label: 'Assault' },
  { key: 'heavy', label: 'Heavy' },
  { key: 'support', label: 'Support' },
  { key: 'engineer', label: 'Engineer' },
  { key: 'marksman', label: 'Marksman' },
];

// Horizontal scrollable chip row for class filtering. Selecting a class shows
// only that class; ALL shows the entire roster. Filter is display-only — it
// does not alter the persistent roster.
export default function SquadFilter({ active, onChange }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-3 px-3 scrollbar-hide">
      {FILTERS.map((f) => (
        <button
          key={f.key}
          type="button"
          onClick={() => onChange(f.key)}
          className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wide uppercase transition touch-manipulation active:scale-95 ${
            active === f.key
              ? 'bg-amber-500 text-slate-900'
              : 'bg-slate-800/60 text-slate-400 border border-slate-700'
          }`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}