import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

// Destructive confirmation dialog for soldier dismissal. Clearly states the
// consequences: permanent removal, equipment returned to inventory, cannot
// be undone. Cancel preserves the soldier.
export default function DismissDialog({ soldier, onConfirm, onCancel }) {
  if (!soldier) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70">
      <div className="bg-slate-900 border border-rose-800/60 rounded-xl p-4 w-[300px] max-w-[90vw]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <h3 className="text-rose-400 font-bold text-sm tracking-wide uppercase">Dismiss {soldier.name}?</h3>
          </div>
          <button onClick={onCancel} className="text-slate-400 active:scale-95">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="text-[11px] text-slate-400 leading-relaxed mb-4 space-y-1.5">
          <p>This soldier will be permanently removed from your roster.</p>
          <p>Their equipment will be returned to inventory.</p>
          <p className="text-rose-400/80">This cannot be undone.</p>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-md text-xs font-bold tracking-wide uppercase bg-slate-800 text-slate-300 border border-slate-700 active:scale-95"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-3 py-1.5 rounded-md text-xs font-bold tracking-wide uppercase bg-rose-600 text-white active:scale-95"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}