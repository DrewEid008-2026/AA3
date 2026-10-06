import React from 'react';
import { X, Check } from 'lucide-react';
import { SOLDIER_ICONS } from '@/game/soldierIcons';

// Icon selector — a large scrollable grid of lucide icons. Mirrors ColorPicker
// layout. The current icon is highlighted with an amber ring + check. Free,
// cosmetic only — the class name remains the primary class indicator.
export default function IconPicker({ currentIcon, onSelect, onClose }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 w-[300px] max-w-[90vw]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-bold text-sm tracking-wide uppercase">Icon</h3>
          <button onClick={onClose} className="text-slate-400 active:scale-95">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-6 gap-1.5 max-h-[320px] overflow-y-auto pr-1">
          {SOLDIER_ICONS.map((ic) => {
            const isSelected = currentIcon === ic.key;
            const Ico = ic.Component;
            return (
              <button
                key={ic.key}
                type="button"
                onClick={() => onSelect(ic.key)}
                className={`relative aspect-square rounded-lg flex items-center justify-center transition touch-manipulation active:scale-95 bg-slate-800 ${
                  isSelected ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-900' : 'ring-1 ring-slate-700'
                }`}
                aria-label={ic.name}
              >
                <Ico className="w-5 h-5 text-white" strokeWidth={2.5} />
                {isSelected && <Check className="absolute top-0.5 right-0.5 w-3 h-3 text-amber-400" strokeWidth={3} />}
              </button>
            );
          })}
        </div>
        <div className="mt-3 text-[10px] text-slate-500 text-center">
          Icon is cosmetic — class is still shown by name.
        </div>
      </div>
    </div>
  );
}