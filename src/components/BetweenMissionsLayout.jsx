import React, { useState, useMemo } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import BottomNav from './BottomNav';
import OptionsButton from './OptionsButton';
import OptionsOverlay from './OptionsOverlay';
import DebugButton from './DebugButton';
import DebugOverlay from './DebugOverlay';
import InfoButton from './InfoButton';
import FieldManualOverlay from './FieldManualOverlay';
import { getActiveSlot, getSlotData, SAVE_VERSION, isSlotOccupied, AUTO_SLOT, getContinueSlot, loadCampaign, saveToManualSlot, getQuickSaveSlot } from '@/game/saveSlots';
import { getCombatSpeed, setCombatSpeed } from '@/game/preferences';

// Shared layout for between-mission screens (Squad, Armory, Missions). The
// fixed BottomNav lives here — outside each page's scrolling content — so it
// remains pinned to the viewport bottom at all times. Battle and Deploy routes
// are outside this layout and do not show the footer.
//
// A persistent Options button sits in the top-right corner. Between-mission
// Options shows Settings, Save Information, Tactical Help, and Return to Title
// (no Restart Mission — that is combat-only). Opening the overlay does not
// disturb the footer or any page state.
function formatLastSaved(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch (e) {
    return '—';
  }
}

export default function BetweenMissionsLayout() {
  const navigate = useNavigate();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [combatSpeed, setCombatSpeedState] = useState(getCombatSpeed());
  const [toast, setToast] = useState(null);

  const saveInfo = useMemo(() => {
    const slot = getActiveSlot();
    if (slot == null) return null;
    const { data } = getSlotData(slot);
    if (!data) return null;
    return {
      slot,
      lastSavedLabel: formatLastSaved(data.lastPlayedAt),
      saveVersion: data.saveVersion ?? SAVE_VERSION,
    };
  }, [optionsOpen]);

  const handleCombatSpeedChange = (speed) => {
    setCombatSpeed(speed);
    setCombatSpeedState(speed);
  };

  const handleReturnToTitle = () => {
    navigate('/');
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1600);
  };

  const handleQuickSave = () => {
    const slot = getQuickSaveSlot();
    saveToManualSlot(slot);
    setOptionsOpen(false);
    showToast(`Saved to Slot ${slot}`);
  };

  const handleQuickLoad = () => {
    const slot = getContinueSlot();
    if (slot == null) return;
    loadCampaign(slot);
    setOptionsOpen(false);
    navigate('/squad');
    showToast('Loaded');
  };

  const handleSaveGame = () => navigate('/save-game');
  const handleLoadGame = () => navigate('/load-game');

  return (
    <>
      <div className="fixed top-2 right-2 z-30 flex items-center gap-1.5">
        <DebugButton onClick={() => setDebugOpen(true)} active={debugOpen} />
        <InfoButton onClick={() => setInfoOpen(true)} active={infoOpen} />
        <OptionsButton onClick={() => setOptionsOpen(true)} active={optionsOpen} />
      </div>
      <Outlet />
      <BottomNav />
      {optionsOpen && (
        <OptionsOverlay
          mode="between"
          onClose={() => setOptionsOpen(false)}
          onReturnToTitle={handleReturnToTitle}
          combatSpeed={combatSpeed}
          onCombatSpeedChange={handleCombatSpeedChange}
          saveInfo={saveInfo}
          onSaveGame={handleSaveGame}
          onLoadGame={handleLoadGame}
          onQuickSave={handleQuickSave}
          onQuickLoad={handleQuickLoad}
          canQuickSave={isSlotOccupied(AUTO_SLOT)}
          canQuickLoad={getContinueSlot() != null}
        />
      )}
      {debugOpen && (
        <DebugOverlay onClose={() => setDebugOpen(false)} />
      )}
      {infoOpen && (
        <FieldManualOverlay onClose={() => setInfoOpen(false)} />
      )}
      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-20 z-50 pointer-events-none">
          <div className="px-4 py-2 rounded-lg bg-bio/90 text-bio-foreground text-xs font-bold tracking-wide uppercase shadow-lg">
            {toast}
          </div>
        </div>
      )}
    </>
  );
}