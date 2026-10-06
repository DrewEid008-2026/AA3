import React from 'react';
import { Eye } from 'lucide-react';

// Compact transient feedback for the Overwatch All squad command. Shows the
// count of soldiers who entered Overwatch and a short list of skipped reasons.
// Auto-dismissed by the parent (Battle) via a timer — no internal timer here.
export default function OverwatchAllFeedback({ feedback }) {
  if (!feedback) return null;
  const { kind, count, skipped } = feedback;
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none px-8">
      <div className="flex flex-col items-center gap-1.5 bg-slate-900/95 border border-amber-500/60 rounded-lg px-5 py-3.5 shadow-2xl max-w-[88%]">
        <div className="flex items-center gap-1.5">
          <Eye className="w-4 h-4 text-amber-400" />
          <span className="text-amber-300 font-black text-sm tracking-wider uppercase">Overwatch All</span>
        </div>
        {kind === 'none' ? (
          <div className="text-slate-300 text-xs text-center">No soldiers can enter Overwatch</div>
        ) : (
          <>
            <div className="text-white text-sm font-bold text-center">
              {count} entered Overwatch
            </div>
            {skipped && skipped.length > 0 && (
              <div className="flex flex-col gap-0.5 text-[10px] text-slate-400 text-center mt-0.5">
                <div className="uppercase tracking-wider text-[9px] text-slate-500">Skipped</div>
                {skipped.map((s, i) => (
                  <div key={i} className="leading-tight">{s.name} — {s.reason}</div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}