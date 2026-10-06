import React from 'react';
import { ShieldAlert } from 'lucide-react';

// Brief "ARMOR BREACHED" transition banner shown when the Harvester enters
// Phase 2 (Part 4). Auto-dismisses after ~2s. Non-interactive.
export default function ArmorBreachBanner({ visible }) {
  if (!visible) return null;
  return (
    <div className="absolute inset-0 z-[45] flex items-center justify-center pointer-events-none">
      <div className="flex flex-col items-center gap-1 animate-pulse">
        <div className="flex items-center gap-2 bg-slate-950/90 border-2 border-amber-500/70 rounded-lg px-6 py-3 shadow-2xl">
          <ShieldAlert className="w-6 h-6 text-amber-400" />
          <div className="flex flex-col">
            <span className="text-amber-300 font-black text-base tracking-[0.15em] uppercase">
              Armor Breached
            </span>
            <span className="text-orange-400 font-bold text-[10px] tracking-wider uppercase">
              Advancing Harvester
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}