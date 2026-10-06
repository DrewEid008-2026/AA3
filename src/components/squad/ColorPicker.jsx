import React from 'react';
import { X, Check } from 'lucide-react';
import { ICON_COLORS } from '@/game/iconColors';

// Simple color selector using a curated set of readable colors. The selected
// color is applied as the soldier's icon background. Class icons and labels
// remain readable independently — color is not the only class indicator.
export default function ColorPicker({ currentColor, onSelect, onClose }) {
  const colors = Object.values(ICON_COLORS);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 w-[280px] max-w-[90vw]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-bold text-sm tracking-wide uppercase">Icon Color</h3>
          <button onClick={onClose} className="text-slate-400 active:scale-95">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {colors.map((c) => {
            const isSelected = currentColor === c.key;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => onSelect(c.key)}
                className={`relative aspect-square rounded-lg flex items-center justify-center transition touch-manipulation active:scale-95 ${
                  isSelected ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-900' : 'ring-1 ring-slate-600'
                }`}
                style={{ backgroundColor: c.hex }}
                aria-label={c.name}
              >
                {isSelected && <Check className="w-5 h-5 text-white drop-shadow" strokeWidth={3} />}
              </button>
            );
          })}
        </div>
        <div className="mt-3 text-[10px] text-slate-500 text-center">
          Color is cosmetic — class icons remain visible.
        </div>
      </div>
    </div>
  );
}