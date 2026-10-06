import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Trash2, AlertTriangle } from 'lucide-react';
import { getAllSlotMeta, loadCampaign, getActiveSlot, deleteManualSlot } from '@/game/saveSlots';
import SaveSlotCard from '@/components/SaveSlotCard';

// Load Game screen — shows the auto-save slot and all five manual save slots.
// Occupied slots can be loaded; manual slots can also be deleted. The auto-save
// slot cannot be deleted from here (it is managed by the campaign itself).
export default function LoadGame() {
  const navigate = useNavigate();
  const [metas, setMetas] = useState([]);
  const [activeSlot, setActiveSlot] = useState(null);
  const [busy, setBusy] = useState(false);
  const [deleteSlot, setDeleteSlot] = useState(null);

  const refresh = () => {
    setMetas(getAllSlotMeta());
    setActiveSlot(getActiveSlot());
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleLoad = (slot) => {
    if (busy) return;
    setBusy(true);
    const ok = loadCampaign(slot);
    if (ok) {
      navigate('/squad');
    } else {
      setBusy(false);
    }
  };

  const handleDeleteConfirm = () => {
    if (deleteSlot == null) return;
    deleteManualSlot(deleteSlot);
    setDeleteSlot(null);
    refresh();
  };

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
        <h1 className="text-white font-black text-lg tracking-wider uppercase">Load Game</h1>
      </div>

      {/* Slot list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 pb-4">
        {metas.map((m) => (
          <SaveSlotCard key={m.slot} meta={m} activeSlot={activeSlot}>
            {m.occupied && !m.error && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleLoad(m.slot)}
                  disabled={busy}
                  className="flex-1 py-2.5 rounded-lg text-xs font-bold tracking-wide uppercase bg-amber-600 text-white active:scale-95 transition touch-manipulation disabled:opacity-50"
                >
                  Load
                </button>
                {!m.isAuto && (
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
            )}
          </SaveSlotCard>
        ))}
      </div>

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