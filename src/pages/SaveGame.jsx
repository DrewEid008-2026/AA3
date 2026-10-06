import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Trash2, AlertTriangle, Check } from 'lucide-react';
import { getManualSlotMetas, isSlotOccupied, saveToManualSlot, deleteManualSlot, getSlotMeta, AUTO_SLOT } from '@/game/saveSlots';
import SaveSlotCard from '@/components/SaveSlotCard';

// Save Game screen — copies the current auto-save campaign to one of five
// manual save slots. Occupied slots require an overwrite confirmation. Manual
// slots can also be deleted. The auto-save itself cannot be saved to or
// deleted here — it is managed automatically by the campaign.
export default function SaveGame() {
  const navigate = useNavigate();
  const [metas, setMetas] = useState([]);
  const [autoMeta, setAutoMeta] = useState(null);
  const [confirmSlot, setConfirmSlot] = useState(null);
  const [deleteSlot, setDeleteSlot] = useState(null);
  const [busy, setBusy] = useState(false);
  const [savedFlash, setSavedFlash] = useState(null);

  const refresh = () => {
    setMetas(getManualSlotMetas());
    setAutoMeta(getSlotMeta(AUTO_SLOT));
  };

  useEffect(() => {
    refresh();
  }, []);

  const doSave = (slot) => {
    setBusy(true);
    saveToManualSlot(slot);
    setBusy(false);
    refresh();
    setSavedFlash(slot);
    setTimeout(() => setSavedFlash(null), 1500);
  };

  const handleSave = (slot) => {
    if (busy) return;
    if (isSlotOccupied(slot)) {
      setConfirmSlot(slot);
    } else {
      doSave(slot);
    }
  };

  const handleConfirmOverwrite = () => {
    if (confirmSlot == null) return;
    const slot = confirmSlot;
    setConfirmSlot(null);
    doSave(slot);
  };

  const handleDeleteConfirm = () => {
    if (deleteSlot == null) return;
    deleteManualSlot(deleteSlot);
    setDeleteSlot(null);
    refresh();
  };

  // No active campaign — nothing to save.
  if (!autoMeta || !autoMeta.occupied) {
    return (
      <div className="h-[100dvh] bg-slate-950 flex flex-col overflow-hidden">
        <div className="shrink-0 px-4 py-4 border-b border-slate-800 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex items-center gap-1 text-slate-400 text-xs font-bold tracking-wide uppercase active:scale-95 touch-manipulation"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <h1 className="text-white font-black text-lg tracking-wider uppercase">Save Game</h1>
        </div>
        <div className="flex-1 flex items-center justify-center px-6">
          <p className="text-slate-500 text-sm text-center">
            No active campaign to save. Start or load a campaign first.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-slate-950 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 py-4 border-b border-slate-800 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex items-center gap-1 text-slate-400 text-xs font-bold tracking-wide uppercase active:scale-95 touch-manipulation"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="text-white font-black text-lg tracking-wider uppercase">Save Game</h1>
      </div>

      {/* Slot list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 pb-4">
        <p className="text-slate-500 text-[11px] px-1 mb-1">
          Auto-save is your live campaign. Save a snapshot to a manual slot below.
        </p>
        {autoMeta && (
          <SaveSlotCard meta={autoMeta}>
            <div className="text-[10px] text-amber-300/80 font-bold tracking-wide uppercase">
              Current Campaign · Auto-Saved
            </div>
          </SaveSlotCard>
        )}
        <div className="h-px bg-slate-800 my-1" />
        {metas.map((m) => (
          <div key={m.slot} className="relative">
            {savedFlash === m.slot && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-emerald-600/90 pointer-events-none">
                <span className="inline-flex items-center gap-1 text-white font-bold text-sm tracking-wide uppercase">
                  <Check className="w-4 h-4" /> Saved
                </span>
              </div>
            )}
            <SaveSlotCard meta={m}>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleSave(m.slot)}
                  disabled={busy}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-bold tracking-wide uppercase transition touch-manipulation disabled:opacity-50 ${
                    m.occupied
                      ? 'bg-amber-600/80 text-white active:scale-95'
                      : 'bg-amber-600 text-white active:scale-95'
                  }`}
                >
                  {m.occupied ? 'Overwrite' : 'Save Here'}
                </button>
                {m.occupied && (
                  <button
                    type="button"
                    onClick={() => setDeleteSlot(m.slot)}
                    disabled={busy}
                    className="px-3 py-2.5 rounded-lg text-xs font-bold tracking-wide uppercase bg-slate-800 text-rose-400 border border-slate-700 active:scale-95 transition touch-manipulation disabled:opacity-50"
                    aria-label="Delete save"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </SaveSlotCard>
          </div>
        ))}
      </div>

      {/* Overwrite confirmation */}
      {confirmSlot != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 max-w-sm w-full">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              <h2 className="text-white font-bold text-base">Overwrite Save {confirmSlot}?</h2>
            </div>
            <p className="text-slate-400 text-xs mb-5">
              The existing campaign in this slot will be replaced with your current progress. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmSlot(null)}
                className="flex-1 py-3 rounded-lg border border-slate-600 bg-slate-800 text-slate-300 text-xs font-bold tracking-wide uppercase active:scale-95 touch-manipulation"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmOverwrite}
                className="flex-1 py-3 rounded-lg border border-amber-400 bg-amber-600 text-white text-xs font-bold tracking-wide uppercase active:scale-95 touch-manipulation"
              >
                Overwrite
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteSlot != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 max-w-sm w-full">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
              <h2 className="text-white font-bold text-base">Delete Save {deleteSlot}?</h2>
            </div>
            <p className="text-slate-400 text-xs mb-5">
              This save will be permanently removed. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteSlot(null)}
                className="flex-1 py-3 rounded-lg border border-slate-600 bg-slate-800 text-slate-300 text-xs font-bold tracking-wide uppercase active:scale-95 touch-manipulation"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="flex-1 py-3 rounded-lg border border-rose-400 bg-rose-600 text-white text-xs font-bold tracking-wide uppercase active:scale-95 touch-manipulation"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}