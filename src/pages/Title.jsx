import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getContinueSlot, loadCampaign } from '@/game/saveSlots';
import { getCombatSpeed, setCombatSpeed } from '@/game/preferences';
import OptionsOverlay from '@/components/OptionsOverlay';
import TitleBackground from '@/components/TitleBackground';

const TITLE_LOGO_URL = 'https://base44.app/api/apps/6abf3ad0bb5a43583580b9e3/files/mp/public/6abf3ad0bb5a43583580b9e3/1e39312df_blue08_bulletholes_alpha.png';

// "Aliens, again." title screen — the front door to the game. Displays the
// title art and a vertical menu of primary actions. The menu is data-driven so
// future options (Settings, Codex, Credits) can be added by extending the
// items array without redesigning the screen.
export default function Title() {
  const navigate = useNavigate();
  const [continueSlot, setContinueSlot] = useState(null);
  const [busy, setBusy] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [combatSpeed, setCombatSpeedState] = useState(getCombatSpeed);

  const handleCombatSpeedChange = (speed) => {
    setCombatSpeed(speed);
    setCombatSpeedState(speed);
  };

  useEffect(() => {
    setContinueSlot(getContinueSlot());
  }, []);

  const handleContinue = () => {
    if (continueSlot == null || busy) return;
    setBusy(true);
    loadCampaign(continueSlot);
    navigate('/squad');
  };

  const handleNewGame = () => {
    if (busy) return;
    navigate('/new-game');
  };

  const handleLoadGame = () => {
    if (busy) return;
    navigate('/load-game');
  };

  const handleOpenOptions = () => {
    if (busy) return;
    setOptionsOpen(true);
  };

  // Data-driven menu — extend this array to add future options.
  const menuItems = [
    {
      id: 'continue',
      label: 'Continue',
      onClick: handleContinue,
      disabled: continueSlot == null || busy,
      variant: 'primary',
    },
    {
      id: 'new-game',
      label: 'New Game',
      onClick: handleNewGame,
      disabled: busy,
      variant: 'default',
    },
    {
      id: 'options',
      label: 'Options',
      onClick: handleOpenOptions,
      disabled: busy,
      variant: 'default',
    },
    {
      id: 'load-game',
      label: 'Load Game',
      onClick: handleLoadGame,
      disabled: busy,
      variant: 'default',
    },
  ];

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-neutral-950">
      {/* One static epic background per app session, chosen in rotation.
         No slideshow — a single image holds for the whole session with a
         slow Ken Burns zoom. */}
      <TitleBackground />

      {/* Top dark fade — masks baked-in titles in the cycling key art so only
         the overlaid bullet-holes logo reads as the title. */}
      <div className="absolute inset-x-0 top-0 h-[28%] bg-gradient-to-b from-neutral-950 via-neutral-950/70 to-transparent pointer-events-none z-10" />

      {/* Bullet-holes alpha logo — transparent PNG overlay, ~68% width,
         centered, near the top. Stable above the cycling backgrounds. */}
      <div className="absolute top-[8%] left-1/2 -translate-x-1/2 w-[68%] z-10 pointer-events-none">
        <img
          src={TITLE_LOGO_URL}
          alt="Aliens, again."
          className="w-full h-auto object-contain select-none"
          draggable={false}
        />
      </div>

      {/* Extra scrim over the bottom third so the menu buttons always read
          cleanly over the art's dark ground zone. */}
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-neutral-950 via-neutral-950/80 to-transparent pointer-events-none z-10" />

      {/* Primary menu — pinned to the bottom third over the dark zone.
          Stable above the cycling background; buttons stay tappable at all
          times. */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] z-20">
        <div className="relative w-full max-w-sm space-y-3">
          {menuItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              disabled={item.disabled}
              className={`w-full py-4 rounded-lg text-sm font-bold tracking-[0.15em] uppercase transition touch-manipulation ${
                item.disabled
                  ? 'bg-neutral-950/60 text-neutral-600 border border-neutral-800 cursor-not-allowed'
                  : item.variant === 'primary'
                    ? 'bg-bio text-bio-foreground border border-bio hover:bg-bio/90 active:scale-95'
                    : 'bg-neutral-950/80 text-white border border-neutral-700 hover:border-bio/60 hover:text-bio active:scale-95'
              }`}
            >
              {item.label}
            </button>
          ))}
          {continueSlot == null && (
            <p className="text-center text-neutral-600 text-[10px] tracking-wide -mt-1">No saved game</p>
          )}
        </div>
      </div>

      {optionsOpen && (
        <OptionsOverlay
          mode="title"
          onClose={() => setOptionsOpen(false)}
          combatSpeed={combatSpeed}
          onCombatSpeedChange={handleCombatSpeedChange}
        />
      )}
    </div>
  );
}