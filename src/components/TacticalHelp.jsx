import React from 'react';

// Compact, mobile-readable rules reference. Concise by design — not a full
// codex. Reused by the Options overlay in both combat and between-mission
// contexts so there is one source of help text.
const SECTIONS = [
  {
    title: 'AP — Action Points',
    body: 'Each unit has AP (usually 2). Moving, attacking, abilities, and reloading all cost AP. When all your units are spent, end your turn.',
  },
  {
    title: 'Movement',
    body: 'Tap a reachable tile to preview a move, then confirm. Units move in 8 directions; one tile costs 1 AP. You cannot end a move on an occupied tile.',
  },
  {
    title: 'Cover',
    body: 'Directional cover (N/S/E/W) reduces damage from attacks coming from that side by half. Cover degrades as it is hit and can be destroyed.',
  },
  {
    title: 'Exposed',
    body: 'A target with no relevant cover takes full damage. Open ground is always exposed.',
  },
  {
    title: 'Flanked',
    body: 'A target whose cover does not face the attacker takes +50% damage. Position attacks from the unprotected side to flank.',
  },
  {
    title: 'Overwatch',
    body: 'A unit on Overwatch fires automatically at enemies that move through its line of sight. Sprinting (an enemy\'s second move) halves reaction damage.',
  },
  {
    title: 'Ammo & Reload',
    body: 'Weapons have limited magazines. Spend 1 AP to reload. An empty weapon cannot attack. Overwatch consumes ammo on each reaction shot.',
  },
  {
    title: 'Downed',
    body: 'A player unit at 0 HP enters Downed instead of dying. A downed unit bleeds out over turns. An adjacent ally can revive it (1 AP).',
  },
  {
    title: 'Injured',
    body: 'If a soldier bleeds out, they become Injured after the mission. Injured soldiers cannot deploy until treated in the Squad screen.',
  },
  {
    title: 'Suppressed',
    body: 'Reduced attack damage and cannot enter Overwatch. Wears off at the end of the enemy phase.',
  },
  {
    title: 'Burning',
    body: 'Takes 1 damage after each meaningful action. Wears off over the bearer\'s turns.',
  },
  {
    title: 'Stunned',
    body: 'Reduces the bearer\'s starting AP by 1 on their next activation, then is removed.',
  },
  {
    title: 'Marked',
    body: 'The next damaging attack against this unit deals +2 damage, then the mark is consumed.',
  },
];

export default function TacticalHelp({ onClose }) {
  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <div className="text-white font-bold text-sm tracking-wide uppercase">Tactical Help</div>
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1 rounded bg-slate-800 text-slate-300 text-xs font-bold tracking-wide uppercase active:scale-95 touch-manipulation"
        >
          Back
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {SECTIONS.map((s) => (
          <div key={s.title} className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
            <div className="text-amber-300 font-bold text-xs tracking-wide uppercase mb-1">{s.title}</div>
            <div className="text-slate-300 text-[13px] leading-snug">{s.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}