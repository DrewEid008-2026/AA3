import React from 'react';
import { Radio, CheckCircle2 } from 'lucide-react';
import { GRID_WIDTH, GRID_HEIGHT } from '@/game/constants';

// Objective Device for Sabotage missions. Stationary mission object — a player
// unit adjacent to it can SABOTAGE for 1 AP. Visually distinct from units and
// terrain. Turns grey when sabotaged.
export default function DeviceToken({ device }) {
  if (!device) return null;

  const left = `${((device.x + 0.5) / GRID_WIDTH) * 100}%`;
  const top = `${((device.y + 0.5) / GRID_HEIGHT) * 100}%`;
  const sabotaged = device.sabotaged;

  return (
    <div
      className="absolute pointer-events-none z-10"
      style={{ left, top, transform: 'translate(-50%, -50%)' }}
    >
      <div className={`w-[72%] h-[72%] max-w-[36px] max-h-[36px] rounded-md border-2 flex items-center justify-center transition-colors ${
        sabotaged
          ? 'bg-slate-700 border-slate-500 opacity-60'
          : 'bg-orange-600 border-orange-300 shadow-[0_0_10px_rgba(251,146,60,0.5)] animate-pulse'
      }`}>
        {sabotaged ? (
          <CheckCircle2 className="w-[50%] h-[50%] text-slate-400" />
        ) : (
          <Radio className="w-[50%] h-[50%] text-white" strokeWidth={2.5} />
        )}
      </div>
    </div>
  );
}