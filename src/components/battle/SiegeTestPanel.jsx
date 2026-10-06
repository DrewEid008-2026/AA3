import React from 'react';
import { Bomb, Route } from 'lucide-react';

// Development-only Siege Test panel. Shown in Battle when debug is active.
// Provides two modes for validating the destructible-map-tile system:
//   TAP  — tap a single Siege-destructible tile to destroy it
//   PATH — tap a start tile, then an end tile; destroys all siege tiles
//          along the Bresenham line between them (chain destruction)
// Normal gameplay is unaffected when no mode is active.
export default function SiegeTestPanel({ mode, onSetMode }) {
  const toggle = (m) => onSetMode(mode === m ? null : m);
  return (
    <div className="absolute top-2 left-2 z-30 flex flex-col gap-1.5 pointer-events-auto">
      <div className="text-[9px] uppercase tracking-wider text-rose-300 font-bold bg-slate-950/80 px-2 py-1 rounded border border-rose-800/50">
        Siege Test
      </div>
      <button
        type="button"
        onClick={() => toggle('single')}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[10px] font-bold tracking-wide uppercase touch-manipulation active:scale-95 border ${
          mode === 'single'
            ? 'bg-rose-600/80 text-white border-rose-400'
            : 'bg-slate-900/80 text-rose-300 border-rose-800/50'
        }`}
      >
        <Bomb className="w-3.5 h-3.5" />
        Tap Tile
      </button>
      <button
        type="button"
        onClick={() => toggle('path')}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[10px] font-bold tracking-wide uppercase touch-manipulation active:scale-95 border ${
          mode === 'path'
            ? 'bg-rose-600/80 text-white border-rose-400'
            : 'bg-slate-900/80 text-rose-300 border-rose-800/50'
        }`}
      >
        <Route className="w-3.5 h-3.5" />
        Path Line
      </button>
      {mode && (
        <div className="text-[9px] text-slate-400 bg-slate-950/80 px-2 py-1 rounded max-w-[140px] leading-tight">
          {mode === 'single'
            ? 'Tap a siege tile to destroy it.'
            : 'Tap start, then end tile. Destroys all siege tiles on the line.'}
        </div>
      )}
    </div>
  );
}