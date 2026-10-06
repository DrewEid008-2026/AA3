import React, { useState } from 'react';
import { Settings, Gauge, RotateCcw, HelpCircle, Home, X, ChevronRight, AlertTriangle, Save, Upload, Zap, Download, Flag } from 'lucide-react';
import { COMBAT_SPEEDS, COMBAT_SPEED_LABELS, getDetailedTargetingInfo, setDetailedTargetingInfo } from '@/game/preferences';
import TacticalHelp from './TacticalHelp';

// Clean overlay menu for meta controls. Context-aware: combat mode adds
// Combat Speed + Restart Mission; between-mission mode adds Save Information.
// Opening the overlay pauses tactical input (the caller locks input while it is
// open) but never spends AP, advances the turn, or triggers AI. Closing
// restores the prior game state exactly — nothing is committed here.
//
// Sub-views keep the component self-contained: main list, settings, combat
// speed, help, and confirm dialogs for restart / return-to-title.

function Row({ icon: Icon, label, sub, onClick, disabled, danger }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg border text-left touch-manipulation transition-colors ${
        disabled
          ? 'bg-neutral-900/50 text-neutral-600 border-neutral-800 cursor-not-allowed'
          : danger
            ? 'bg-rose-950/40 text-rose-200 border-rose-800/60 active:bg-rose-900/60'
            : 'bg-neutral-900/80 text-neutral-200 border-neutral-700 active:bg-neutral-700'
      }`}
    >
      <Icon className={`w-4 h-4 shrink-0 ${disabled ? 'text-neutral-600' : danger ? 'text-rose-400' : 'text-tech'}`} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold tracking-wide uppercase">{label}</div>
        {sub && <div className={`text-[11px] ${disabled ? 'text-slate-600' : 'text-slate-400'}`}>{sub}</div>}
      </div>
      {!disabled && <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />}
    </button>
  );
}

function ConfirmDialog({ title, body, cancelLabel, confirmLabel, onConfirm, onCancel, danger }) {
  return (
    <div className="flex flex-col items-center text-center gap-3 px-2">
      <AlertTriangle className={`w-7 h-7 ${danger ? 'text-rose-400' : 'text-tech'}`} />
      <div className="text-white font-bold text-sm tracking-wide uppercase">{title}</div>
      <div className="text-slate-300 text-[13px] leading-snug max-w-[260px]">{body}</div>
      <div className="w-full flex gap-2 mt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-3 rounded-lg border border-slate-600 bg-slate-800 text-slate-300 text-xs font-bold tracking-wide uppercase active:scale-95 touch-manipulation"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={`flex-1 py-3 rounded-lg border text-xs font-bold tracking-wide uppercase active:scale-95 touch-manipulation ${
            danger
              ? 'bg-blood text-blood-foreground border-blood'
              : 'bg-bio text-bio-foreground border-bio'
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}

function CombatSpeedPicker({ value, onChange }) {
  return (
    <div className="flex flex-col gap-2">
      {COMBAT_SPEEDS.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          className={`w-full flex items-center justify-between px-3 py-3 rounded-lg border touch-manipulation transition-colors ${
            value === s
              ? 'bg-tech/20 border-tech/70 text-tech'
              : 'bg-neutral-900/80 border-neutral-700 text-neutral-300 active:bg-neutral-700'
          }`}
        >
          <span className="text-sm font-bold tracking-wide uppercase">{COMBAT_SPEED_LABELS[s]}</span>
          {value === s && <span className="text-[10px] font-bold tracking-wider text-tech">ON</span>}
        </button>
      ))}
      <div className="text-[11px] text-slate-500 leading-snug px-1">
        Affects enemy movement, attack presentation, and combat pauses only. Never changes AP, damage, AI, or turn rules.
      </div>
    </div>
  );
}

function DetailedTargetingToggle({ value, onChange }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[11px] text-slate-400 leading-snug px-1">
        Shows full predicted damage, modifiers, affected targets, and terrain before confirming an attack.
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`flex-1 py-3 rounded-lg border touch-manipulation transition-colors ${
            value
              ? 'bg-tech/20 border-tech/70 text-tech'
              : 'bg-neutral-900/80 border-neutral-700 text-neutral-300 active:bg-neutral-700'
          }`}
        >
          <span className="text-sm font-bold tracking-wide uppercase">On</span>
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`flex-1 py-3 rounded-lg border touch-manipulation transition-colors ${
            !value
              ? 'bg-neutral-200/20 border-neutral-300/70 text-neutral-100'
              : 'bg-neutral-900/80 border-neutral-700 text-neutral-300 active:bg-neutral-700'
          }`}
        >
          <span className="text-sm font-bold tracking-wide uppercase">Off</span>
        </button>
      </div>
      <div className="text-[11px] text-slate-500 leading-snug px-1">
        Off keeps the faster one-tap attack flow.
      </div>
    </div>
  );
}

function SaveInfoPanel({ saveInfo }) {
  if (!saveInfo) {
    return <div className="text-neutral-400 text-sm">No active campaign save.</div>;
  }
  return (
    <div className="rounded-lg border border-neutral-700 bg-neutral-900/70 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-neutral-400">Save Slot</span>
        <span className="text-white font-bold text-sm">{saveInfo.slot === 0 ? 'AUTO' : `SAVE ${saveInfo.slot}`}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-neutral-400">Last Saved</span>
        <span className="text-neutral-200 text-sm">{saveInfo.lastSavedLabel}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-neutral-400">Save Version</span>
        <span className="text-neutral-200 text-sm">v{saveInfo.saveVersion}</span>
      </div>
    </div>
  );
}

export default function OptionsOverlay({
  mode,            // 'combat' | 'between' | 'title'
  onClose,
  onRestart,       // combat only
  onRetreat,        // combat only — abandon mission, no rewards
  onReturnToTitle,
  canRestart,      // combat only — whether restart is currently allowed
  canRetreat,      // combat only — whether retreat is currently allowed
  combatSpeed,     // combat only
  onCombatSpeedChange,
  saveInfo,        // between only
  onSaveGame,      // navigate to full Save screen
  onLoadGame,      // navigate to full Load screen
  onQuickSave,     // between only — write to most-recent manual slot
  onQuickLoad,     // load most-recent save + go to squad
  canQuickSave,    // between only — active campaign exists
  canQuickLoad,    // a loadable save exists
}) {
  const [view, setView] = useState('main'); // 'main' | 'settings' | 'speed' | 'targeting' | 'help' | 'confirmRestart' | 'confirmRetreat' | 'confirmReturn' | 'confirmSave' | 'confirmLoad'
  const [detailedTargeting, setDetailedTargeting] = useState(getDetailedTargetingInfo);

  const isCombat = mode === 'combat';
  const isTitle = mode === 'title';

  // In combat, leaving to Save/Load abandons the tactical attempt — confirm first.
  const handleSaveGame = () => {
    if (isCombat) setView('confirmSave');
    else { close(); onSaveGame && onSaveGame(); }
  };
  const handleLoadGame = () => {
    if (isCombat) setView('confirmLoad');
    else { close(); onLoadGame && onLoadGame(); }
  };
  const handleQuickSave = () => {
    if (isCombat) setView('confirmSave');
    else { onQuickSave && onQuickSave(); }
  };
  const handleQuickLoad = () => {
    if (isCombat) setView('confirmQuickLoad');
    else { close(); onQuickLoad && onQuickLoad(); }
  };

  const handleDetailedTargetingChange = (v) => {
    setDetailedTargeting(v);
    setDetailedTargetingInfo(v);
  };

  const close = () => {
    setView('main');
    onClose();
  };

  const titleFor = (v) => {
    switch (v) {
      case 'settings': return 'Settings';
      case 'speed': return 'Combat Speed';
      case 'targeting': return 'Detailed Targeting Info';
      case 'help': return 'Tactical Help';
      case 'confirmSave': return 'Leave to Save?';
      case 'confirmLoad': return 'Leave to Load?';
      case 'confirmQuickLoad': return 'Quick Load?';
      case 'confirmRetreat': return 'Retreat?';
      default: return 'Options';
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-neutral-950/85 backdrop-blur-sm px-4 py-6">
      <div className="w-full max-w-sm max-h-full flex flex-col rounded-xl border border-neutral-700 bg-neutral-950 shadow-2xl overflow-hidden">
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-neutral-700">
          <div className="text-white font-bold text-sm tracking-wide uppercase">{titleFor(view)}</div>
          <button
            type="button"
            onClick={close}
            className="p-1.5 rounded-md bg-neutral-800 text-neutral-300 active:scale-95 touch-manipulation"
            aria-label="Close options"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
          {view === 'main' && (
            <div className="flex flex-col gap-2">
              <Row icon={Settings} label="Settings" onClick={() => setView('settings')} />
              {!isTitle && (
                <>
                  <Row
                    icon={Save}
                    label="Save Game"
                    sub="Open the full save menu"
                    onClick={handleSaveGame}
                  />
                  <Row
                    icon={Upload}
                    label="Load Game"
                    sub="Open the full load menu"
                    onClick={handleLoadGame}
                  />
                  {!isCombat && (
                    <Row
                      icon={Zap}
                      label="Quick Save"
                      sub={canQuickSave ? 'Save to most recent slot' : 'No active campaign'}
                      onClick={canQuickSave ? handleQuickSave : undefined}
                      disabled={!canQuickSave}
                    />
                  )}
                  <Row
                    icon={Download}
                    label="Quick Load"
                    sub={isCombat
                      ? (canQuickLoad ? 'Abandon battle & resume' : 'No saved game')
                      : (canQuickLoad ? 'Resume most recent save' : 'No saved game')}
                    onClick={canQuickLoad ? handleQuickLoad : undefined}
                    disabled={!canQuickLoad}
                    danger={isCombat}
                  />
                </>
              )}
              {isCombat && (
                <Row
                  icon={Gauge}
                  label="Combat Speed"
                  sub={COMBAT_SPEED_LABELS[combatSpeed]}
                  onClick={() => setView('speed')}
                />
              )}
              <Row
                icon={Settings}
                label="Detailed Targeting Info"
                sub={detailedTargeting ? 'On' : 'Off'}
                onClick={() => setView('targeting')}
              />
              {isCombat && (
                <Row
                  icon={RotateCcw}
                  label="Restart Mission"
                  sub={canRestart ? 'Replay the battle from scratch' : 'Wait for animations to finish'}
                  onClick={canRestart ? () => setView('confirmRestart') : undefined}
                  disabled={!canRestart}
                />
              )}
              {isCombat && (
                <Row
                  icon={Flag}
                  label="Retreat"
                  sub={canRetreat ? 'Abandon mission — no rewards' : 'Available during active battle'}
                  onClick={canRetreat ? () => setView('confirmRetreat') : undefined}
                  disabled={!canRetreat}
                  danger
                />
              )}
              {!isCombat && !isTitle && saveInfo && (
                <Row icon={Settings} label="Save Information" onClick={() => setView('saveInfo')} />
              )}
              <Row icon={HelpCircle} label="Tactical Help" onClick={() => setView('help')} />
              {!isTitle && (
                <Row
                  icon={Home}
                  label="Return to Title"
                  onClick={() => setView('confirmReturn')}
                  danger
                />
              )}
            </div>
          )}

          {view === 'settings' && (
            <div className="flex flex-col gap-3">
              {isCombat && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-2">Combat</div>
                  <CombatSpeedPicker value={combatSpeed} onChange={onCombatSpeedChange} />
                </div>
              )}
              {!isCombat && (
                <CombatSpeedPicker value={combatSpeed} onChange={onCombatSpeedChange} />
              )}
              <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
                <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Coming Soon</div>
                <div className="text-[12px] text-neutral-500 leading-snug">
                  Audio, animation, accessibility, and display preferences will appear here in a future update.
                </div>
              </div>
            </div>
          )}

          {view === 'speed' && (
            <CombatSpeedPicker value={combatSpeed} onChange={onCombatSpeedChange} />
          )}

          {view === 'targeting' && (
            <DetailedTargetingToggle value={detailedTargeting} onChange={handleDetailedTargetingChange} />
          )}

          {view === 'saveInfo' && <SaveInfoPanel saveInfo={saveInfo} />}

          {view === 'help' && (
            <div className="-mx-4 -my-4 h-full">
              <TacticalHelp onClose={() => setView('main')} />
            </div>
          )}

          {view === 'confirmRestart' && (
            <ConfirmDialog
              title="Restart Mission?"
              body="The battle will reset to its starting state. Any rewards from this attempt are not forfeited — you can still earn them by completing the replay. Campaign progress before this mission is preserved."
              cancelLabel="Cancel"
              confirmLabel="Restart"
              danger
              onCancel={() => setView('main')}
              onConfirm={() => { close(); onRestart(); }}
            />
          )}

          {view === 'confirmRetreat' && (
            <ConfirmDialog
              title="Retreat?"
              body="Abandoning the mission withdraws your squad. No rewards will be given for this attempt. Campaign progress before this mission is preserved."
              cancelLabel="Stay"
              confirmLabel="Retreat"
              danger
              onCancel={() => setView('main')}
              onConfirm={() => { close(); onRetreat && onRetreat(); }}
            />
          )}

          {view === 'confirmReturn' && (
            <ConfirmDialog
              title="Return to Title?"
              body={isCombat
                ? 'Unsaved tactical progress may be lost. Campaign progress before this mission is preserved.'
                : 'You will exit to the title menu. Your campaign is saved.'}
              cancelLabel="Cancel"
              confirmLabel="Return"
              danger
              onCancel={() => setView('main')}
              onConfirm={() => { close(); onReturnToTitle(); }}
            />
          )}

          {view === 'confirmSave' && (
            <ConfirmDialog
              title="Leave to Save?"
              body="Leaving the battle forfeits your current tactical attempt. Campaign progress before this mission is preserved."
              cancelLabel="Stay"
              confirmLabel="Leave"
              danger
              onCancel={() => setView('main')}
              onConfirm={() => { close(); onSaveGame && onSaveGame(); }}
            />
          )}

          {view === 'confirmLoad' && (
            <ConfirmDialog
              title="Leave to Load?"
              body="Leaving the battle forfeits your current tactical attempt. You will go to the Load menu."
              cancelLabel="Stay"
              confirmLabel="Leave"
              danger
              onCancel={() => setView('main')}
              onConfirm={() => { close(); onLoadGame && onLoadGame(); }}
            />
          )}

          {view === 'confirmQuickLoad' && (
            <ConfirmDialog
              title="Quick Load?"
              body="The current battle will be abandoned. Your most recent save will load and you will return to the Squad screen."
              cancelLabel="Stay"
              confirmLabel="Load"
              danger
              onCancel={() => setView('main')}
              onConfirm={() => { close(); onQuickLoad && onQuickLoad(); }}
            />
          )}
        </div>

        {view !== 'help' && view !== 'confirmRestart' && view !== 'confirmRetreat' && view !== 'confirmReturn' && view !== 'confirmSave' && view !== 'confirmLoad' && view !== 'confirmQuickLoad' && view !== 'saveInfo' && view !== 'speed' && (
          <div className="shrink-0 px-4 py-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => (view === 'main' ? close() : setView('main'))}
              className="w-full py-2.5 rounded-lg border border-neutral-600 bg-neutral-800 text-neutral-300 text-xs font-bold tracking-wide uppercase active:scale-95 touch-manipulation"
              >
                {view === 'main' ? 'Close' : 'Back'}
              </button>
              </div>
              )}
              {(view === 'saveInfo' || view === 'speed') && (
              <div className="shrink-0 px-4 py-3 border-t border-neutral-800">
              <button
              type="button"
              onClick={() => setView('main')}
              className="w-full py-2.5 rounded-lg border border-neutral-600 bg-neutral-800 text-neutral-300 text-xs font-bold tracking-wide uppercase active:scale-95 touch-manipulation"
            >
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}