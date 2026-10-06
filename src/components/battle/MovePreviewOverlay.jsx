import React from 'react';
import { GRID_WIDTH, GRID_HEIGHT } from '@/game/constants';
import { Shield, AlertTriangle } from 'lucide-react';
import { isVolatileTile } from '@/game/volatileTiles';

const tileCenter = (x, y) => ({
  left: `${((x + 0.5) / GRID_WIDTH) * 100}%`,
  top: `${((y + 0.5) / GRID_HEIGHT) * 100}%`,
});

const TILE_W = `${100 / GRID_WIDTH}%`;
const TILE_H = `${100 / GRID_HEIGHT}%`;

// Renders the movement preview visuals: weapon range tint, path dots,
// destination marker with ghost soldier, and directional cover indicators.
// All purely visual — no game state is altered by this overlay.
export default function MovePreviewOverlay({ movePreview, previewData, grid }) {
  if (!movePreview) return null;
  const { path, toX, toY } = movePreview;
  const { rangeTiles, destCover, hazardInfo } = previewData || { rangeTiles: null, destCover: null, hazardInfo: null };

  // Intermediate path tiles (exclude start and destination)
  const intermediate = path.slice(1, -1);

  return (
    <div className="absolute inset-0 pointer-events-none z-[6]">
      {/* Weapon range tint (subtle — does not overpower cover/enemies/path) */}
      {rangeTiles && Array.from(rangeTiles).map((k) => {
        const [x, y] = k.split(',').map(Number);
        return (
          <div
            key={`rng_${k}`}
            className="absolute rounded-sm bg-violet-400/5 border border-violet-300/10"
            style={{ ...tileCenter(x, y), width: TILE_W, height: TILE_H, transform: 'translate(-50%, -50%)' }}
          />
        );
      })}

      {/* Path dots on intermediate tiles — volatile tiles get a hazard marker */}
      {intermediate.map(([x, y], i) => {
        const isVolatile = grid && grid[y] && grid[y][x] && isVolatileTile(grid[y][x]);
        return (
          <div
            key={`path_${i}`}
            className="absolute flex items-center justify-center"
            style={{ ...tileCenter(x, y), width: TILE_W, height: TILE_H, transform: 'translate(-50%, -50%)' }}
          >
            {isVolatile ? (
              <div className="w-[52%] h-[52%] rounded-full bg-emerald-950/90 border-2 border-emerald-300 text-emerald-200 flex items-center justify-center shadow-[0_0_10px_rgba(16,185,129,0.8)] animate-pulse ring-2 ring-emerald-500/50">
                <AlertTriangle className="w-[65%] h-[65%] text-emerald-300" />
              </div>
            ) : (
              <div className="w-[24%] h-[24%] rounded-full bg-sky-400/70 border border-sky-200/80 shadow-[0_0_4px_rgba(56,189,248,0.5)]" />
            )}
          </div>
        );
      })}

      {/* Hazard warning banner (spec 18-19) — shown above the destination */}
      {hazardInfo && hazardInfo.count > 0 && (
        <div
          className="absolute z-[7] -translate-x-1/2 -translate-y-full"
          style={{ ...tileCenter(toX, toY), left: `calc(${((toX + 0.5) / GRID_WIDTH) * 100}% )`, top: `calc(${((toY - 0.35) / GRID_HEIGHT) * 100}%)` }}
        >
          <div className="px-2.5 py-1 rounded-md bg-emerald-950/95 border border-emerald-400/80 shadow-2xl whitespace-nowrap backdrop-blur-sm">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-emerald-400 shrink-0 animate-bounce" />
              <div className="flex flex-col text-left leading-tight">
                <div className="text-emerald-300 font-bold text-[9px] tracking-wider uppercase">
                  MOVE: {path.length - 1} TILES · VOLATILE: {hazardInfo.count} {hazardInfo.count === 1 ? 'TILE' : 'TILES'}
                </div>
                <div className="text-emerald-400 font-extrabold text-[10px] tracking-wide uppercase">
                  HAZARD DAMAGE: {hazardInfo.rawDamage} RAW
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Destination marker + ghost soldier + cover indicators */}
      {(() => {
        const isDestVolatile = grid && grid[toY] && grid[toY][toX] && isVolatileTile(grid[toY][toX]);
        return (
          <div
            className="absolute"
            style={{ ...tileCenter(toX, toY), width: TILE_W, height: TILE_H, transform: 'translate(-50%, -50%)' }}
          >
            {/* Destination ring */}
            <div
              className={`absolute inset-[8%] rounded-sm border-2 ${
                isDestVolatile
                  ? 'border-emerald-300 bg-emerald-950/40 shadow-[0_0_14px_rgba(16,185,129,0.8)] ring-1 ring-emerald-400'
                  : 'border-sky-300 bg-sky-400/15 shadow-[0_0_10px_rgba(56,189,248,0.5)]'
              }`}
            />

            {/* Ghost soldier — translucent projected position */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className={`w-[58%] h-[58%] rounded-full border-2 border-dashed flex items-center justify-center ${
                  isDestVolatile
                    ? 'bg-emerald-500/20 border-emerald-300/80'
                    : 'bg-sky-500/20 border-sky-300/70'
                }`}
              >
                <div
                  className={`w-[35%] h-[35%] rounded-full ${
                    isDestVolatile ? 'bg-emerald-400/50' : 'bg-sky-400/40'
                  }`}
                />
              </div>
            </div>

            {/* Volatile icon on destination if destination is volatile */}
            {isDestVolatile && (
              <span className="absolute top-0.5 right-0.5 z-10">
                <AlertTriangle className="w-3 h-3 text-emerald-300 drop-shadow-[0_0_4px_rgba(16,185,129,0.9)]" />
              </span>
            )}

            {/* Directional cover indicators (N/S/E/W shields) */}
            {destCover?.n && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-[30%] z-10">
                <Shield className="w-2.5 h-2.5 text-sky-300" fill="currentColor" fillOpacity={0.3} />
              </span>
            )}
            {destCover?.s && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-[30%] z-10">
                <Shield className="w-2.5 h-2.5 text-sky-300" fill="currentColor" fillOpacity={0.3} />
              </span>
            )}
            {destCover?.e && (
              <span className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-[30%] z-10">
                <Shield className="w-2.5 h-2.5 text-sky-300" fill="currentColor" fillOpacity={0.3} />
              </span>
            )}
            {destCover?.w && (
              <span className="absolute top-1/2 left-0 -translate-y-1/2 -translate-x-[30%] z-10">
                <Shield className="w-2.5 h-2.5 text-sky-300" fill="currentColor" fillOpacity={0.3} />
              </span>
            )}
          </div>
        );
      })()}
    </div>
  );
}