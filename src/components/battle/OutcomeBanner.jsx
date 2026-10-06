import React from 'react';

// Minimal end-of-battle overlay. Victory or defeat only — no campaign rewards.
export default function OutcomeBanner({ outcome, onRestart }) {
  const victory = outcome === 'victory';
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-sm">
      <div
        className={`text-2xl sm:text-3xl font-black tracking-[0.18em] ${
          victory ? 'text-emerald-400' : 'text-rose-500'
        }`}
      >
        {victory ? 'MISSION COMPLETE' : 'SQUAD ELIMINATED'}
      </div>
      <div className="mt-1 text-[11px] font-mono tracking-widest text-slate-400">
        {victory ? 'ALL HOSTILES NEUTRALIZED' : 'NO OPERATIVES REMAIN'}
      </div>
      <button
        onClick={onRestart}
        className="mt-5 px-5 py-2 rounded-md bg-slate-100 text-slate-900 text-xs font-bold tracking-widest active:scale-95 transition"
      >
        RESTART BATTLE
      </button>
    </div>
  );
}