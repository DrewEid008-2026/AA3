import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { TILE_TYPES } from '@/game/constants';
import { isVolatileTile } from '@/game/volatileTiles';

// Cover bars: drawn on the tile edge that the cover protects. Literal classes only.
const COVER_POS = {
  n: 'top-0 left-0 right-0 h-[18%] rounded-t',
  s: 'bottom-0 left-0 right-0 h-[18%] rounded-b',
  e: 'top-0 bottom-0 right-0 w-[18%] rounded-r',
  w: 'top-0 bottom-0 left-0 w-[18%] rounded-l',
};

function CoverBar({ side, data, emphasis }) {
  const pos = COVER_POS[side];
  if (data.destroyed) {
    return (
      <span
        className={`absolute ${pos} bg-slate-600/25 bg-[repeating-linear-gradient(45deg,rgba(100,116,139,0.3)_0_3px,transparent_3px_6px)]`}
      />
    );
  }
  const ratio = data.maxHp > 0 ? data.hp / data.maxHp : 1;
  const cls = ratio < 1
    ? 'bg-amber-700/75 shadow-[0_0_3px_rgba(180,83,9,0.4)]'
    : 'bg-amber-500/90 shadow-[0_0_4px_rgba(245,158,11,0.6)]';
  const emphCls = emphasis ? ' ring-1 ring-amber-300/70 brightness-125' : '';
  return <span className={`absolute ${pos} ${cls}${emphCls}`} />;
}

function CoverBars({ cover, emphasis }) {
  if (!cover) return null;
  return (
    <>
      {cover.n && <CoverBar side="n" data={cover.n} emphasis={emphasis} />}
      {cover.s && <CoverBar side="s" data={cover.s} emphasis={emphasis} />}
      {cover.e && <CoverBar side="e" data={cover.e} emphasis={emphasis} />}
      {cover.w && <CoverBar side="w" data={cover.w} emphasis={emphasis} />}
    </>
  );
}

// Tile highlight kinds (movement, dash, enemy target, ally target, grenade
// impact, blast). One per tile; drawn under the unit overlay.
const HIGHLIGHT = {
  move: 'absolute inset-[14%] rounded-sm border border-sky-400/80 bg-sky-400/20 pointer-events-none',
  dash: 'absolute inset-[14%] rounded-sm border-2 border-cyan-300/90 bg-cyan-400/25 pointer-events-none',
  target: 'absolute inset-[6%] rounded-sm border-2 border-rose-400/80 bg-rose-500/10 pointer-events-none',
  ally: 'absolute inset-[6%] rounded-sm border-2 border-emerald-400/80 bg-emerald-500/10 pointer-events-none',
  grenade: 'absolute inset-[8%] rounded-sm border-2 border-dashed border-orange-400/80 bg-orange-500/10 pointer-events-none',
  blast: 'absolute inset-0 rounded-sm border-2 border-orange-400/90 bg-orange-500/30 pointer-events-none',
  // Commander targeting — distinct violet/purple command theme, dashed pattern.
  commander_valid: 'absolute inset-[8%] rounded-sm border-2 border-dashed border-violet-400/70 bg-violet-500/8 pointer-events-none',
  commander_invalid: 'absolute inset-[8%] rounded-sm border border-slate-500/40 bg-slate-900/50 pointer-events-none',
  commander_selected: 'absolute inset-[4%] rounded-sm border-2 border-violet-300 bg-violet-500/25 pointer-events-none',
  commander_area: 'absolute inset-0 rounded-sm border border-violet-400/50 bg-violet-500/15 pointer-events-none',
};

export default function Tile({ tile, highlight, isSelectedTile, isInvalid, coverEmphasis, onTileTap }) {
  const isBlocked = tile.type === TILE_TYPES.BLOCKED;
  // Siege-destructible map tiles are BLOCKED with a distinct, heavier look so
  // players can tell them apart from normal indestructible walls. Destroyed
  // tiles are now OPEN ground with a subtle rubble texture.
  const isSiegeTile = !!(tile.isDestructibleTile && tile.currentTileState === 'intact');
  const isDestroyedTile = !!(tile.isDestructibleTile && tile.currentTileState === 'destroyed');
  const isVolatile = !isBlocked && isVolatileTile(tile);

  const bgClass = isBlocked
    ? isSiegeTile
      // Siege wall: darker, tighter hatching, red-tinged ring — reads as heavy
      // structural geometry that is distinct from a normal wall.
      ? 'bg-slate-900 bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.06)_0_4px,transparent_4px_8px)] ring-1 ring-inset ring-rose-900/50'
      : 'bg-slate-800 bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.04)_0_6px,transparent_6px_12px)]'
    : isDestroyedTile
      // Rubble: open ground with a subtle crosshatch — mechanically walkable.
      ? 'bg-slate-700/30 bg-[repeating-linear-gradient(90deg,rgba(120,113,108,0.22)_0_3px,transparent_3px_7px),repeating-linear-gradient(0deg,rgba(120,113,108,0.16)_0_3px,transparent_3px_7px)]'
      : isVolatile
        // Volatile: toxic-green energized ground with fractured cracks and a
        // pulsing warning glow. Extremely readable on portrait phone (spec 22):
        // bright color + hazard icon + texture + pulse, never color alone.
        ? 'bg-emerald-950/40 bg-[repeating-linear-gradient(45deg,rgba(16,185,129,0.18)_0_2px,transparent_2px_5px)] ring-1 ring-inset ring-emerald-400/40 animate-pulse'
        : 'bg-slate-700/30';

  return (
    <div
      onClick={() => onTileTap(tile)}
      className={[
        'relative flex items-center justify-center select-none touch-manipulation',
        'border border-slate-700/40',
        bgClass,
        isSelectedTile ? 'bg-amber-400/10' : '',
      ].join(' ')}
    >
      <CoverBars cover={tile.cover} emphasis={coverEmphasis} />

      {/* Smoke Grenade overlay — translucent fog, does not obscure units */}
      {tile.smoke && (
        <span className="absolute inset-0 rounded-sm bg-slate-300/25 border border-slate-200/20 pointer-events-none">
          <span className="absolute inset-0 rounded-sm bg-[radial-gradient(circle,rgba(203,213,225,0.35)_0%,rgba(148,163,184,0.15)_70%)]" />
        </span>
      )}

      {/* Volatile Tile hazard icon — centered warning triangle (spec 22) */}
      {isVolatile && (
        <span className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1]">
          <AlertTriangle className="w-[42%] h-[42%] text-emerald-400/80 drop-shadow-[0_0_3px_rgba(16,185,129,0.6)]" />
        </span>
      )}

      {/* Highlight (movement / dash / target / ally / grenade / blast) */}
      {highlight && <span className={HIGHLIGHT[highlight]} />}

      {/* Selected unit's tile */}
      {isSelectedTile && (
        <span className="absolute inset-0 ring-2 ring-inset ring-amber-400/60 pointer-events-none" />
      )}

      {/* Invalid-tap feedback */}
      {isInvalid && (
        <span className="absolute inset-[14%] rounded-sm border border-rose-500/90 bg-rose-500/25 animate-pulse pointer-events-none" />
      )}
    </div>
  );
}