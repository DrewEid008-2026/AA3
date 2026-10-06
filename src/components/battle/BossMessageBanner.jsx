import React from 'react';

// Battlefield banner for boss mission events (relay destroyed, shield network
// offline, core shield broken). Non-blocking — does not interrupt gameplay.
// Auto-cleared by the useBossMission hook after a brief delay.
export default function BossMessageBanner({ message }) {
  if (!message) return null;
  const tone = message.tone || 'relay';
  const borderClass = tone === 'offline' ? 'border-emerald-500/70'
    : tone === 'shield-break' ? 'border-cyan-400/70'
    : tone === 'advance' ? 'border-amber-500/70'
    : tone === 'overload' ? 'border-orange-500/70'
    : 'border-fuchsia-500/70';
  const textClass = tone === 'offline' ? 'text-emerald-400'
    : tone === 'shield-break' ? 'text-cyan-300'
    : tone === 'advance' ? 'text-amber-400'
    : tone === 'overload' ? 'text-orange-400'
    : 'text-fuchsia-300';

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
      <div className={`text-center bg-slate-900/95 border-2 px-6 py-3 rounded-lg shadow-2xl ${borderClass}`}>
        <div className={`font-black text-sm tracking-[0.15em] uppercase ${textClass}`}>
          {message.text}
        </div>
        {message.subtext && (
          <div className="text-[10px] text-slate-400 mt-1">{message.subtext}</div>
        )}
      </div>
    </div>
  );
}