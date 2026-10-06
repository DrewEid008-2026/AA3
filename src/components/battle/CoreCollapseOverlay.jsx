import React, { useEffect, useState } from 'react';

// Full-screen Core Collapse presentation played once when The Harvester is
// defeated. Presentation-only: no damage, no terrain destruction, no Downed
// states. ~2.5s of CSS animation (white-hot core flash, screen shake,
// collapsing silhouette, energy pulse ring), then calls onComplete so the
// result screen can take over. Preserves the battlefield's final destruction
// state behind it — does not regenerate the map.
const DURATION_MS = 2500;

export default function CoreCollapseOverlay({ onComplete }) {
  const [phase, setPhase] = useState('flash'); // flash → collapse → pulse → done

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('collapse'), 700);
    const t2 = setTimeout(() => setPhase('pulse'), 1500);
    const t3 = setTimeout(() => {
      setPhase('done');
      if (onComplete) onComplete();
    }, DURATION_MS);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onComplete]);

  return (
    <div
      className="absolute inset-0 z-[60] flex items-center justify-center overflow-hidden pointer-events-none"
      style={{
        animation: phase === 'flash' || phase === 'collapse'
          ? 'coreShake 0.5s ease-in-out infinite'
          : 'none',
      }}
    >
      {/* Dark backdrop */}
      <div
        className="absolute inset-0 bg-slate-950"
        style={{
          opacity: phase === 'flash' ? 0.85 : phase === 'collapse' ? 0.92 : 1,
          transition: 'opacity 0.4s ease-out',
        }}
      />

      {/* White-hot core flash */}
      <div
        className="absolute rounded-full"
        style={{
          width: phase === 'flash' ? '120vmax' : '40vmax',
          height: phase === 'flash' ? '120vmax' : '40vmax',
          background: 'radial-gradient(circle, rgba(255,248,220,1) 0%, rgba(255,180,80,0.9) 30%, rgba(255,120,40,0.4) 55%, transparent 75%)',
          opacity: phase === 'flash' ? 1 : phase === 'collapse' ? 0.6 : 0,
          transition: 'width 0.7s ease-out, height 0.7s ease-out, opacity 0.5s ease-out',
        }}
      />

      {/* Collapsing silhouette — a dark mass that shrinks and falls */}
      {phase !== 'flash' && (
        <div
          className="absolute rounded-full"
          style={{
            width: phase === 'pulse' ? '8vmax' : '24vmax',
            height: phase === 'pulse' ? '8vmax' : '24vmax',
            background: 'radial-gradient(circle, rgba(20,10,5,1) 0%, rgba(40,20,10,0.95) 50%, rgba(60,30,15,0.6) 80%, transparent 100%)',
            opacity: phase === 'pulse' ? 0.8 : 1,
            transform: phase === 'collapse' ? 'translateY(8vmax) scale(0.7)' : 'translateY(0) scale(1)',
            transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1), height 0.8s cubic-bezier(0.4, 0, 0.2, 1), transform 0.8s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.5s ease-out',
            boxShadow: '0 0 60px 20px rgba(255,100,40,0.5)',
          }}
        />
      )}

      {/* Energy pulse ring */}
      {phase === 'pulse' && (
        <div
          className="absolute rounded-full border-4 border-amber-400/70"
          style={{
            width: '10vmax',
            height: '10vmax',
            animation: 'corePulseRing 0.9s ease-out forwards',
          }}
        />
      )}

      {/* Title text */}
      <div
        className="relative z-10 text-center"
        style={{
          opacity: phase === 'flash' ? 0 : phase === 'collapse' ? 1 : phase === 'pulse' ? 0.7 : 0,
          transition: 'opacity 0.4s ease-out',
        }}
      >
        <div className="text-amber-300 font-black text-xl sm:text-2xl tracking-[0.25em] uppercase">
          Harvester
        </div>
        <div className="text-amber-500 font-black text-lg sm:text-xl tracking-[0.3em] uppercase mt-1">
          Core Collapse
        </div>
      </div>

      <style>{`
        @keyframes coreShake {
          0%, 100% { transform: translate(0, 0); }
          25% { transform: translate(-3px, 2px); }
          50% { transform: translate(2px, -3px); }
          75% { transform: translate(-2px, -1px); }
        }
        @keyframes corePulseRing {
          0% { width: 10vmax; height: 10vmax; opacity: 0.9; border-width: 4px; }
          100% { width: 80vmax; height: 80vmax; opacity: 0; border-width: 1px; }
        }
      `}</style>
    </div>
  );
}