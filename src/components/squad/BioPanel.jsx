import React, { useState } from 'react';
import { X, Palette, Shapes, Edit3, UserX, HeartCrack, RotateCw, Coins, Crown, Lock } from 'lucide-react';
import { MAX_LEVEL, xpForNextLevel } from '@/game/progression';
import { getIconColor, getSoldierIconColorHex } from '@/game/iconColors';
import { RESPEC_COST } from '@/game/economy';
import RenameDialog from './RenameDialog';
import ColorPicker from './ColorPicker';
import IconPicker from './IconPicker';
import { getSoldierIconComponent } from '@/game/soldierIcons';
import DismissDialog from './DismissDialog';
import RespecDialog from './RespecDialog';

const CLASS_NAMES = { assault: 'Assault', heavy: 'Heavy', support: 'Support', engineer: 'Engineer', marksman: 'Marksman' };

// Bio tab: shows persistent soldier information (name, class, level, kills, XP,
// icon color, condition). Contains Change Name, Change Icon Color, Respec
// Soldier, Chess Board, and Dismiss Soldier controls. Respec sits with the
// management controls; Dismiss is at the very bottom, clearly separated as
// destructive. The Chess Board button opens the Chess Table minigame when the
// Chess Board squad improvement is purchased; otherwise it shows a locked hint.
export default function BioPanel({ soldier, onRename, onColorChange, onIconChange, onRespec, credits, chessBoardUnlocked, onOpenChess, onDismiss, onClose }) {
  const [showRename, setShowRename] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showRespec, setShowRespec] = useState(false);
  const [showDismiss, setShowDismiss] = useState(false);

  const Icon = getSoldierIconComponent(soldier);
  const isMaxLevel = soldier.level >= MAX_LEVEL;
  const xpNeeded = isMaxLevel ? null : xpForNextLevel(soldier.level);
  const iconColorHex = getSoldierIconColorHex(soldier);
  const iconColorName = getIconColor(soldier.icon_color)?.name || '—';
  const totalKills = (soldier.personal_kills || 0) + (soldier.elite_kills || 0);

  const handleRename = (newName) => {
    onRename(newName);
    setShowRename(false);
  };

  const handleColorSelect = (color) => {
    onColorChange(color);
    setShowColorPicker(false);
  };

  const handleIconSelect = (iconKey) => {
    onIconChange(iconKey);
    setShowIconPicker(false);
  };

  const handleDismiss = () => {
    onDismiss();
    setShowDismiss(false);
  };

  const handleRespec = (newClass) => {
    onRespec(newClass);
    setShowRespec(false);
  };

  return (
    <div className="p-4 pb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-bold text-sm tracking-wide uppercase">Bio</h3>
        <button onClick={onClose} className="text-slate-400 active:scale-95"><X className="w-4 h-4" /></button>
      </div>

      {/* Identity header */}
      <div className="flex items-center gap-3 mb-4 rounded-lg bg-slate-900/60 border border-slate-700 p-3">
        <div
          className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: iconColorHex || '#334155' }}
        >
          <Icon className="w-6 h-6 text-white" strokeWidth={2.5} />
        </div>
        <div className="min-w-0">
          <div className="text-white font-bold text-base tracking-wide">{soldier.name}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] text-slate-400">{CLASS_NAMES[soldier.class] || soldier.class}</span>
            {soldier.injured ? (
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-900/60 text-rose-400 flex items-center gap-0.5">
                <HeartCrack className="w-2.5 h-2.5" /> Injured
              </span>
            ) : (
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-950/40 text-emerald-400">
                Ready
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <StatBox label="Level" value={isMaxLevel ? 'MAX' : soldier.level} />
        <StatBox label="Career Kills" value={totalKills} />
        <StatBox
          label={isMaxLevel ? 'XP' : `XP → Lv ${soldier.level + 1}`}
          value={isMaxLevel ? '—' : `${soldier.xp} / ${xpNeeded}`}
        />
        <StatBox label="Icon Color" value={iconColorName} />
      </div>

      {/* XP bar (non-max only) */}
      {!isMaxLevel && xpNeeded > 0 && (
        <div className="mb-4">
          <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-amber-400 transition-all"
              style={{ width: `${Math.min(100, (soldier.xp / xpNeeded) * 100)}%` }}
            />
          </div>
          <div className="text-[10px] text-slate-500 mt-1 text-center">
            {xpNeeded - soldier.xp} XP to next level
          </div>
        </div>
      )}

      {/* Customization controls */}
      <div className="space-y-2 mb-4">
        <button
          type="button"
          onClick={() => setShowRename(true)}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-300 text-xs font-bold tracking-wide uppercase active:scale-95 transition touch-manipulation"
        >
          <Edit3 className="w-3.5 h-3.5 text-amber-400" />
          Change Name
        </button>
        <button
          type="button"
          onClick={() => setShowColorPicker(true)}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-300 text-xs font-bold tracking-wide uppercase active:scale-95 transition touch-manipulation"
        >
          <Palette className="w-3.5 h-3.5 text-amber-400" />
          Change Icon Color
        </button>
        <button
          type="button"
          onClick={() => setShowIconPicker(true)}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-300 text-xs font-bold tracking-wide uppercase active:scale-95 transition touch-manipulation"
        >
          <Shapes className="w-3.5 h-3.5 text-amber-400" />
          Change Icon
        </button>
        <button
          type="button"
          onClick={() => setShowRespec(true)}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-300 text-xs font-bold tracking-wide uppercase active:scale-95 transition touch-manipulation"
        >
          <RotateCw className="w-3.5 h-3.5 text-amber-400" />
          Respec Soldier
        </button>
        <div className="flex items-center justify-center gap-1 text-[9px] text-slate-500 -mt-1">
          <Coins className="w-3 h-3" /> Respec Cost: {RESPEC_COST} Credits
        </div>

        {/* Chess Board — opens Chess Table minigame when unlocked. Visible for
            all classes and both READY and INJURED soldiers. Locked state shows
            a hint pointing to the Armory instead of navigating. */}
        {chessBoardUnlocked ? (
          <button
            type="button"
            onClick={onOpenChess}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-amber-950/30 border border-amber-700/50 text-amber-300 text-xs font-bold tracking-wide uppercase active:scale-95 transition touch-manipulation"
          >
            <Crown className="w-3.5 h-3.5 text-amber-400" />
            Chess Board
          </button>
        ) : (
          <div className="w-full">
            <div className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-800/30 border border-slate-800 text-slate-600 text-xs font-bold tracking-wide uppercase">
              <Lock className="w-3.5 h-3.5" />
              Chess Board — Locked
            </div>
            <div className="text-[9px] text-slate-600 mt-1 px-1">
              Purchase Chess Board in Armory → Squad Improvements
            </div>
          </div>
        )}
      </div>

      {/* Dismiss — clearly separated at the bottom */}
      <div className="pt-4 border-t border-slate-800">
        <button
          type="button"
          onClick={() => setShowDismiss(true)}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-rose-950/30 border border-rose-900/50 text-rose-400 text-xs font-bold tracking-wide uppercase active:scale-95 transition touch-manipulation"
        >
          <UserX className="w-3.5 h-3.5" />
          Dismiss Soldier
        </button>
      </div>

      {showRename && (
        <RenameDialog
          currentName={soldier.name}
          onSave={handleRename}
          onCancel={() => setShowRename(false)}
        />
      )}
      {showColorPicker && (
        <ColorPicker
          currentColor={soldier.icon_color}
          onSelect={handleColorSelect}
          onClose={() => setShowColorPicker(false)}
        />
      )}
      {showIconPicker && (
        <IconPicker
          currentIcon={soldier.icon}
          onSelect={handleIconSelect}
          onClose={() => setShowIconPicker(false)}
        />
      )}
      {showDismiss && (
        <DismissDialog
          soldier={soldier}
          onConfirm={handleDismiss}
          onCancel={() => setShowDismiss(false)}
        />
      )}
      {showRespec && (
        <RespecDialog
          soldier={soldier}
          credits={credits ?? 0}
          onConfirm={handleRespec}
          onClose={() => setShowRespec(false)}
        />
      )}
    </div>
  );
}

function StatBox({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-900/60 border border-slate-700 p-2.5">
      <div className="text-[9px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-white font-bold text-sm mt-0.5">{value}</div>
    </div>
  );
}