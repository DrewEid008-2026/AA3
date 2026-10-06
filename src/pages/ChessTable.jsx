import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Crown, Lock, Store, Bug, RotateCcw } from 'lucide-react';
import { loadSoldiers, loadPlayerSave, debugSetChessBoard } from '@/game/persistence';
import { isChessBoardUnlocked } from '@/game/squadUpgrades';

// Chess Table — a playful, no-stakes soldier minigame unlocked by the Chess
// Board squad improvement. The board "speaks" to the selected soldier by name;
// each PLAY! press rolls a fresh 1–10 integer (6–10 = WIN, 1–5 = LOSE) and the
// board responds with teasing dialogue. No resources, no rewards, no combat
// effects — pure QoL. The selected soldier is read fresh from the save on
// every visit so renames are reflected immediately and identity never goes
// stale. Debug controls (?debug=1) allow forcing rolls and toggling the unlock.

const GREETINGS = [
  "Ready to play, {name}? Let's see what you've got.",
  "{name}, think you can handle the board?",
  "Well, {name}... ready to prove yourself?",
  "Come on, {name}. Let's see if you're man enough.",
];

const WIN_MSG = 'That was amazing! Can you handle another round?';
const LOSE_MSG = 'You could do better than that.';

function rollDice() {
  // Uniform integer 1..10 inclusive.
  return Math.floor(Math.random() * 10) + 1;
}

function pickGreeting(name) {
  const line = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
  return line.replace(/\{name\}/g, name || 'Soldier');
}

export default function ChessTable() {
  const { soldierId } = useParams();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const debug = search.get('debug') === '1';

  const [soldier, setSoldier] = useState(null);
  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState('');
  const [result, setResult] = useState(null); // { roll, win }
  const [rolling, setRolling] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [soldiers, save] = await Promise.all([loadSoldiers(), loadPlayerSave()]);
      if (!alive) return;
      const s = soldiers.find((x) => x.id === soldierId) || null;
      setSoldier(s);
      setUnlocked(isChessBoardUnlocked(save));
      setGreeting(pickGreeting(s?.name));
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [soldierId]);

  const play = (forced) => {
    if (rolling) return;
    setRolling(true);
    const roll = forced != null ? forced : rollDice();
    // Brief suspense beat before the result lands.
    setTimeout(() => {
      setResult({ roll, win: roll > 5 });
      setRolling(false);
    }, 220);
  };

  const debugToggleUnlock = async () => {
    const next = !unlocked;
    await debugSetChessBoard(next);
    setUnlocked(next);
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-700 border-t-amber-400 rounded-full animate-spin" />
      </div>
    );
  }

  // Locked safety net: never show a broken page. This triggers only if the
  // upgrade is not purchased (direct URL access before buying).
  if (!unlocked) {
    return (
      <div className="min-h-[100dvh] bg-slate-950 flex flex-col items-center justify-center px-6 text-center gap-4">
        <Lock className="w-10 h-10 text-slate-600" />
        <div className="text-slate-300 font-black text-base tracking-[0.15em] uppercase">Chess Board — Locked</div>
        <div className="text-slate-500 text-xs max-w-xs">
          Purchase Chess Board in Armory → Squad Improvements to unlock the Chess Table.
        </div>
        <div className="flex gap-2 mt-2">
          <button
            type="button"
            onClick={() => navigate('/armory')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 text-white text-xs font-bold tracking-wide uppercase active:scale-95 transition touch-manipulation"
          >
            <Store className="w-3.5 h-3.5" /> Go to Armory
          </button>
          <button
            type="button"
            onClick={() => navigate('/squad')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold tracking-wide uppercase border border-slate-700 active:scale-95 transition touch-manipulation"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
        </div>
      </div>
    );
  }

  if (!soldier) {
    return (
      <div className="min-h-[100dvh] bg-slate-950 flex flex-col items-center justify-center px-6 text-center gap-3">
        <div className="text-slate-400 text-sm">Soldier not found.</div>
        <button
          type="button"
          onClick={() => navigate('/squad')}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold tracking-wide uppercase border border-slate-700 active:scale-95 transition touch-manipulation"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Squad
        </button>
      </div>
    );
  }

  const dialogue = result ? (result.win ? WIN_MSG : LOSE_MSG) : greeting;

  return (
    <div className="min-h-[100dvh] bg-slate-950 flex flex-col">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-slate-800 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/squad')}
          className="text-slate-300 active:scale-95 touch-manipulation"
          aria-label="Back to Soldier"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-white font-black text-sm tracking-[0.15em] uppercase">Chess Table</div>
          <div className="text-[10px] text-slate-500 tracking-wide">Soldier: {soldier.name}</div>
        </div>
        <Crown className="w-5 h-5 text-amber-400" />
      </div>

      {/* Board + dialogue */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-4 gap-4">
        <ChessBoard result={result} rolling={rolling} />

        {/* Dialogue bubble */}
        <div className="w-full max-w-sm rounded-xl border border-amber-700/40 bg-amber-950/20 px-4 py-3">
          <div className="text-[9px] uppercase tracking-widest text-amber-400/80 mb-1 flex items-center gap-1">
            <Crown className="w-3 h-3" /> Chess Board
          </div>
          <div className="text-slate-200 text-sm leading-snug italic">"{dialogue}"</div>
        </div>

        {/* Result */}
        <div className="h-16 flex items-center justify-center">
          {result && !rolling && (
            <div className="flex flex-col items-center">
              <div className="flex items-baseline gap-1">
                <span className={`font-black text-3xl tracking-wider ${result.win ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {result.roll}
                </span>
                <span className="text-slate-500 font-bold text-lg">/ 10</span>
              </div>
              <div className={`text-xs font-black tracking-[0.2em] uppercase ${result.win ? 'text-emerald-400' : 'text-rose-400'}`}>
                {result.win ? 'Win' : 'Lose'}
              </div>
            </div>
          )}
          {rolling && (
            <div className="w-8 h-8 border-4 border-slate-700 border-t-amber-400 rounded-full animate-spin" />
          )}
        </div>
      </div>

      {/* PLAY! */}
      <div className="shrink-0 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-1">
        <button
          type="button"
          onClick={() => play()}
          disabled={rolling}
          className="w-full max-w-sm mx-auto py-4 rounded-xl bg-amber-500 text-slate-900 text-base font-black tracking-[0.2em] uppercase active:scale-95 transition touch-manipulation disabled:opacity-60"
        >
          {rolling ? '...' : 'Play!'}
        </button>
      </div>

      {/* Debug panel — not exposed to players (only with ?debug=1) */}
      {debug && (
        <div className="shrink-0 mx-4 mb-3 rounded-lg border border-slate-700 bg-slate-900/80 p-2.5">
          <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-2">
            <Bug className="w-3 h-3" /> Debug
          </div>
          <div className="text-[10px] text-slate-500 mb-2 font-mono">Soldier ID: {soldier.id}</div>
          <div className="flex flex-wrap gap-1.5">
            <DebugBtn label="Roll 1" onClick={() => play(1)} />
            <DebugBtn label="Roll 5" onClick={() => play(5)} />
            <DebugBtn label="Roll 6" onClick={() => play(6)} />
            <DebugBtn label="Roll 10" onClick={() => play(10)} />
            <DebugBtn label={unlocked ? 'Lock Board' : 'Unlock Board'} onClick={debugToggleUnlock} />
            <DebugBtn label="Reset" onClick={() => setResult(null)} icon={RotateCcw} />
          </div>
        </div>
      )}
    </div>
  );
}

// Stylized 8×8 chess board. Pure visual — no legal moves, no pieces with
// function. A center badge shows the latest roll result; a faint king glyph
// sits in each back rank for character.
function ChessBoard({ result, rolling }) {
  return (
    <div className="relative w-full max-w-xs aspect-square rounded-lg overflow-hidden border-2 border-amber-900/60 shadow-xl">
      <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
        {Array.from({ length: 64 }, (_, i) => {
          const x = i % 8;
          const y = Math.floor(i / 8);
          const dark = (x + y) % 2 === 1;
          const backRank = y === 0 || y === 7;
          return (
            <div
              key={i}
              className={`flex items-center justify-center ${dark ? 'bg-amber-800/80' : 'bg-amber-100/90'}`}
            >
              {backRank && (
                <span className={`text-lg leading-none select-none ${dark ? 'text-amber-100/30' : 'text-amber-800/30'}`}>
                  ♛
                </span>
              )}
            </div>
          );
        })}
      </div>
      {/* Center result overlay */}
      {result && !rolling && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-black backdrop-blur-sm border-2 ${
            result.win
              ? 'bg-emerald-950/70 border-emerald-400 text-emerald-300'
              : 'bg-rose-950/70 border-rose-400 text-rose-300'
          }`}>
            {result.roll}
          </div>
        </div>
      )}
    </div>
  );
}

function DebugBtn({ label, onClick, icon: Icon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 px-2 py-1 rounded text-[9px] font-bold tracking-wide uppercase bg-slate-800 text-slate-300 border border-slate-700 active:scale-95 transition touch-manipulation"
    >
      {Icon && <Icon className="w-2.5 h-2.5" />}
      {label}
    </button>
  );
}