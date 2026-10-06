import React from 'react';
import { AlertTriangle } from 'lucide-react';

// Brief "CORE FAILURE" transition banner shown when the Harvester enters
// Phase 3 (Part 3). Auto-dismisses after ~2s. Non-interactive. The exposed
// reactor glow intensifies — sparks, unstable energy pulses, damaged machinery.
export default function CoreFailureBanner({ visible }) {
  if (!visible) return null;
  return (
    <div className="absolute inset-0 z-[45] flex items-center justify-center pointer-events-none">
      <div className="flex flex-col items-center gap-1 animate-pulse">
        <div className="flex items-center gap-2 bg-slate-950/90 border-2 border-cyan-400/70 rounded-lg px-6 py-3 shadow-2xl">
          <AlertTriangle className="w-6 h-6 text-cyan-400" />
          <div className="flex flex-col">
            <span className="text-cyan-200 font-black text-base tracking-[0.15em] uppercase">
              Core Failure
            </span>
            <span className="text-orange-400 font-bold text-[10px] tracking-wider uppercase">
              Reactor Unstable
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}