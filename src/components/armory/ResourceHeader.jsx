import React from 'react';
import { Coins, Gem, Zap, Box } from 'lucide-react';

// Compact 3-resource header for the Armory. Shows Credits, Alien Materials,
// and Power Cores. Values update immediately after purchases (driven by the
// `save` prop from the parent).
export default function ResourceHeader({ save }) {
  return (
    <div className="shrink-0 flex items-center gap-4 px-4 py-2.5 border-b border-slate-800 bg-slate-900/40">
      <span className="inline-flex items-center gap-1 text-amber-300 text-xs font-bold tracking-wide">
        <Coins className="w-3.5 h-3.5" /> {save?.credits ?? 0}
      </span>
      <span className="inline-flex items-center gap-1 text-emerald-300 text-xs font-bold tracking-wide">
        <Gem className="w-3.5 h-3.5" /> {save?.alien_materials ?? 0}
      </span>
      <span className="inline-flex items-center gap-1 text-fuchsia-300 text-xs font-bold tracking-wide">
        <Zap className="w-3.5 h-3.5" /> {save?.powerCores ?? 0}
      </span>
      <span className="inline-flex items-center gap-1 text-sky-300 text-xs font-bold tracking-wide">
        <Box className="w-3.5 h-3.5" /> {save?.nanoCubes ?? 0}
      </span>
    </div>
  );
}