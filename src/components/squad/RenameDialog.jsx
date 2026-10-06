import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

// Simple rename interface. Shows the current name in an editable text field.
// Validation: non-empty, reasonable length (1-20 chars), trimmed. Duplicate
// names are allowed. Cancel preserves the original name.
export default function RenameDialog({ currentName, onSave, onCancel }) {
  const [name, setName] = useState(currentName || '');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const trimmed = name.trim();
  const isValid = trimmed.length >= 1 && trimmed.length <= 20;

  const handleSave = () => {
    if (!isValid) return;
    onSave(trimmed);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && isValid) handleSave();
    if (e.key === 'Escape') onCancel();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 w-[280px] max-w-[90vw]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-bold text-sm tracking-wide uppercase">Change Name</h3>
          <button onClick={onCancel} className="text-slate-400 active:scale-95">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Current Name</div>
        <div className="text-slate-300 text-sm mb-3">{currentName}</div>
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={20}
          placeholder="Enter new name"
          className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm focus:outline-none focus:border-amber-500 mb-3"
        />
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
            onClick={handleSave}
            disabled={!isValid}
            className="px-3 py-1.5 rounded-md text-xs font-bold tracking-wide uppercase bg-amber-600 text-white active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}