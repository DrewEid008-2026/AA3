import React from 'react';
import { GRID_WIDTH, GRID_HEIGHT } from '@/game/constants';

// Civilian entity for Rescue missions. Rendered as a distinct non-combat token.
// Not targetable, does not block movement. When escorted, the token is hidden
// (an indicator on the escort's token takes over). When safe, hidden entirely.
export default function CivilianToken({ civilian }) {
  if (!civilian || civilian.safe || civilian.escortId) return null;

  const left = `${((civilian.x + 0.5) / GRID_WIDTH) * 100}%`;
  const top = `${((civilian.y + 0.5) / GRID_HEIGHT) * 100}%`;

  return (
    <div
      className="absolute pointer-events-none z-10"
      style={{ left, top, transform: 'translate(-50%, -50%)' }}
    >
      <div className="w-[68%] h-[68%] max-w-[34px] max-h-[34px] rounded-full bg-amber-300 border-2 border-amber-50 shadow-[0_0_8px_rgba(252,211,77,0.5)] flex items-center justify-center">
        <svg viewBox="0 0 24 24" className="w-[55%] h-[55%]" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="7" r="4" />
          <path d="M5.5 21a8.38 8.38 0 0 1 13 0" />
        </svg>
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[7px] font-black tracking-wider text-amber-950 bg-amber-200 px-1 rounded whitespace-nowrap">
          CIV
        </span>
      </div>
    </div>
  );
}