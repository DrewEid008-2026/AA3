import React from 'react';
import { Link } from 'react-router-dom';
import { Lock, Swords, CheckCircle2, ChevronRight, Hourglass } from 'lucide-react';

// Boss mission card shown on the Missions page. States:
//   - Locked: bossUnlocked = false. Shows a locked card with progress hint.
//   - Available (implemented): bossUnlocked, not defeated, bossImplemented.
//     Shows an ENGAGE button that navigates to the boss deploy screen.
//   - Available (placeholder): bossUnlocked, not defeated, !bossImplemented.
//     Shows a disabled "ENCOUNTER COMING SOON" state — no broken battle.
//   - Defeated: bossDefeated = true. Shows a completed state.
//
// The card is always visible (even when locked) to give the player a clear
// long-term goal. The boss is optional once unlocked.
export default function BossCard({ def, state, bossMission }) {
  if (!def || !state) return null;

  const defeated = state.bossDefeated;
  const unlocked = state.bossUnlocked;
  const implemented = def.bossImplemented;

  if (defeated) {
    // Boss is defeated but replayable for farming resources. Show the completed
    // state with a Replay link so the player can re-deploy for rewards.
    if (!implemented || !bossMission) {
      return (
        <div className="rounded-lg border border-amber-500/50 bg-amber-950/30 p-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-amber-900/50 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5 text-amber-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400/70">
                Chapter {def.chapterNumber} Boss
              </div>
              <div className="text-white font-bold text-sm tracking-wide">
                {def.bossName} — Defeated
              </div>
              <div className="text-amber-300/80 text-[11px] mt-0.5">
                Chapter Complete
              </div>
            </div>
          </div>
        </div>
      );
    }
    return (
      <Link to={`/deploy/${bossMission.id}`} className="block">
        <div className="rounded-lg border border-amber-500/50 bg-amber-950/30 p-3 active:scale-[0.98] transition-transform">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-amber-900/50 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5 text-amber-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400/70">
                ✓ Defeated · Replay Available
              </div>
              <div className="text-white font-bold text-sm tracking-wide">
                {def.bossName}
              </div>
              <div className="text-amber-300/80 text-[11px] mt-0.5">
                Reward: {def.nanoCubeReward ? `Nano Cube ×${def.nanoCubeReward}` : 'Power Core ×1'} · Replay Boss
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-amber-300 font-bold text-[10px] tracking-wider uppercase">
                Replay
              </span>
              <ChevronRight className="w-4 h-4 text-amber-400" />
            </div>
          </div>
        </div>
      </Link>
    );
  }

  if (!unlocked) {
    return (
      <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-3 opacity-80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-slate-800/80 flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5 text-slate-500" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Chapter {def.chapterNumber} Boss
            </div>
            <div className="text-slate-300 font-bold text-sm tracking-wide">
              Locked
            </div>
            <div className="text-slate-500 text-[11px] mt-0.5">
              {def.chapterNumber === 1
                ? 'Complete missions to locate the enemy command nexus'
                : 'Complete Chapter ' + def.chapterNumber + ' missions to locate the source of the new command signal'}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] text-slate-500">Progress</div>
            <div className="text-slate-300 font-bold text-sm">
              {state.chapterProgressPercent ?? 0}%
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Available — boss unlocked but not yet defeated

  // Placeholder boss (encounter not implemented): show a disabled card that
  // clearly communicates the encounter is coming soon. No deploy link.
  if (!implemented) {
    return (
      <div className="rounded-lg border border-fuchsia-500/50 bg-fuchsia-950/30 p-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-fuchsia-900/50 flex items-center justify-center shrink-0">
            <Hourglass className="w-5 h-5 text-fuchsia-300" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-fuchsia-400/70">
              Chapter {def.chapterNumber} Boss — Located
            </div>
            <div className="text-white font-bold text-sm tracking-wide">
              {def.bossName}
            </div>
            <div className="text-fuchsia-300/80 text-[11px] mt-0.5">
              {def.bossSubheading}
            </div>
            <div className="text-slate-400 text-[10px] mt-0.5">
              Boss encounter awaiting implementation.
            </div>
          </div>
          <div className="shrink-0">
            <span className="text-slate-500 font-bold text-[10px] tracking-wider uppercase">
              Coming Soon
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Implemented boss — link to deploy
  if (!bossMission) return null;

  return (
    <Link to={`/deploy/${bossMission.id}`} className="block">
      <div className="rounded-lg border border-fuchsia-500/50 bg-fuchsia-950/30 p-3 active:scale-[0.98] transition-transform">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-fuchsia-900/50 flex items-center justify-center shrink-0">
            <Swords className="w-5 h-5 text-fuchsia-300" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-fuchsia-400/70">
              Chapter {def.chapterNumber} Boss
            </div>
            <div className="text-white font-bold text-sm tracking-wide">
              {def.bossName}
            </div>
            <div className="text-fuchsia-300/80 text-[11px] mt-0.5">
              {def.bossSubheading}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-fuchsia-300 font-bold text-[10px] tracking-wider uppercase">
              Engage
            </span>
            <ChevronRight className="w-4 h-4 text-fuchsia-400" />
          </div>
        </div>
      </div>
    </Link>
  );
}