import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, AlertTriangle } from 'lucide-react';
import { isSlotOccupied, createNewCampaign, getSlotMeta, AUTO_SLOT } from '@/game/saveSlots';
import SaveSlotCard from '@/components/SaveSlotCard';

// New Game screen — starts a fresh campaign in the auto-save slot. If the
// auto-save already has a campaign, an overwrite confirmation is required so a
// single accidental tap can never destroy an existing campaign.
export default function NewGame() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [autoMeta, setAutoMeta] = useState(null);

  useEffect(() => {
    setAutoMeta(getSlotMeta(AUTO_SLOT));
  }, []);

  const startNewGame = () => {
    setBusy(true);
    createNewCampaign();
    navigate('/campaign-intro');
  };

  const handleStart = () => {
    if (busy) return;
    if (isSlotOccupied(AUTO_SLOT)) {
      setConfirmOverwrite(true);
    } else {
      startNewGame();
    }
  };

  return (
    <div className="h-[100dvh] bg-slate-950 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 py-4 border-b border-slate-800 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/')}
          disabled={busy}
          className="flex items-center gap-1 text-slate-400 text-xs font-bold tracking-wide uppercase active:scale-95 touch-manipulation disabled:opacity-50"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="text-white font-black text-lg tracking-wider uppercase">New Game</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <p className="text-slate-400 text-xs leading-relaxed">
          A new campaign begins in the <span className="text-cyan-300 font-bold">AUTO</span> save slot.
          Your progress is saved automatically as you play. Use the Save menu to copy
          your campaign to a manual save slot.
        </p>

        {autoMeta && autoMeta.occupied && (
          <div>
            <p className="text-rose-400 text-[11px] font-bold uppercase tracking-wide mb-2">
              Auto-save has an existing campaign
            </p>
            <SaveSlotCard meta={autoMeta} />
          </div>
        )}
      </div>

      {/* Start button */}
      <div className="shrink-0 px-4 py-4 border-t border-slate-800 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={handleStart}
          disabled={busy}
          className={`w-full py-4 rounded-lg text-sm font-bold tracking-[0.15em] uppercase transition touch-manipulation disabled:opacity-50 ${
            autoMeta?.occupied
              ? 'bg-rose-600 text-white border border-rose-500 active:scale-95'
              : 'bg-amber-600 text-white border border-amber-500 active:scale-95'
          }`}
        >
          {autoMeta?.occupied ? 'Overwrite & Start New' : 'Start New Campaign'}
        </button>
      </div>

      {/* Overwrite confirmation */}
      {confirmOverwrite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 max-w-sm w-full">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
              <h2 className="text-white font-bold text-base">Overwrite Auto-Save?</h2>
            </div>
            <p className="text-slate-400 text-xs mb-5">
              The existing campaign in the auto-save slot will be replaced. This cannot be undone.
              To preserve it, save it to a manual slot first.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmOverwrite(false)}
                className="flex-1 py-3 rounded-lg border border-slate-600 bg-slate-800 text-slate-300 text-xs font-bold tracking-wide uppercase active:scale-95 touch-manipulation"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={startNewGame}
                className="flex-1 py-3 rounded-lg border border-rose-400 bg-rose-600 text-white text-xs font-bold tracking-wide uppercase active:scale-95 touch-manipulation"
              >
                Overwrite
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}