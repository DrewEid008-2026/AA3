import React from 'react';
import { GRID_WIDTH, GRID_HEIGHT } from '@/game/constants';
import { EDGE_TYPES, WALL_STATES } from '@/game/terrainEdges';

export default function TerrainEdgeOverlay({
  edges,
  debug = false,
  selectedEdgeId = null,
  onSelectEdge = null,
}) {
  if (!edges) return null;
  const edgeList = edges instanceof Map ? Array.from(edges.values()) : Object.values(edges);
  if (edgeList.length === 0) return null;

  const tileW = 100 / GRID_WIDTH;
  const tileH = 100 / GRID_HEIGHT;

  return (
    <div className="absolute inset-0 pointer-events-none z-[6]">
      {edgeList.map((edge) => {
        if (!edge) return null;
        const isHorizontal = edge.orientation === 'horizontal';
        const isSelected = selectedEdgeId === edge.id;

        // Determine edge positioning
        let leftPct = 0;
        let topPct = 0;
        let widthPct = 0;
        let heightPct = 0;

        if (isHorizontal) {
          // Horizontal edge sits between tileA.y and tileA.y + 1
          leftPct = edge.tileA.x * tileW;
          topPct = (edge.tileA.y + 1) * tileH;
          widthPct = tileW;
        } else {
          // Vertical edge sits between tileA.x and tileA.x + 1
          leftPct = (edge.tileA.x + 1) * tileW;
          topPct = edge.tileA.y * tileH;
          heightPct = tileH;
        }

        // Appearance based on edgeType and state
        const isFull = edge.state === WALL_STATES.FULL;
        const isLow = edge.state === WALL_STATES.LOW;
        const isOpen = edge.state === WALL_STATES.OPEN || edge.edgeType === EDGE_TYPES.OPEN;
        const isSiege = edge.edgeType === EDGE_TYPES.SIEGE_STRUCTURE;

        // If open and not in debug mode, do not render a heavy bar
        if (isOpen && !debug && !isSelected) return null;

        let barStyle = 'bg-slate-500';
        if (isSiege) {
          barStyle = 'bg-rose-950 border border-rose-500/80 shadow-[0_0_6px_rgba(244,63,94,0.4)]';
        } else if (isFull) {
          barStyle = 'bg-slate-200 border border-slate-400 shadow-[0_0_5px_rgba(255,255,255,0.3)]';
        } else if (isLow) {
          barStyle = 'bg-amber-600 border border-amber-400/80 shadow-[0_0_4px_rgba(245,158,11,0.4)]';
        } else if (isOpen) {
          barStyle = 'bg-slate-700/30 border border-dashed border-slate-500/40';
        }

        return (
          <div
            key={edge.id}
            onClick={(e) => {
              if (onSelectEdge) {
                e.stopPropagation();
                onSelectEdge(edge);
              }
            }}
            className={`absolute flex items-center justify-center transition-all ${
              onSelectEdge ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'
            }`}
            style={{
              left: `${leftPct}%`,
              top: `${topPct}%`,
              width: isHorizontal ? `${widthPct}%` : '8px',
              height: isHorizontal ? '8px' : `${heightPct}%`,
              transform: isHorizontal ? 'translateY(-50%)' : 'translateX(-50%)',
            }}
          >
            {/* Visual wall bar */}
            <div
              className={`w-full h-full rounded-sm ${barStyle} ${
                isSelected ? 'ring-2 ring-amber-300 ring-offset-1 ring-offset-black scale-110 z-10' : ''
              }`}
            />

            {/* Development badge when in debug mode or selected */}
            {(debug || isSelected) && (
              <div
                className={`absolute px-1 py-0.5 rounded text-[8px] font-mono leading-none whitespace-nowrap shadow-md z-20 ${
                  isSelected ? 'bg-amber-400 text-black font-bold' : 'bg-slate-900/90 text-slate-200 border border-slate-700'
                }`}
                style={{
                  transform: isHorizontal ? 'translateY(-14px)' : 'translateX(14px)',
                }}
              >
                {edge.id} [{edge.state}] {edge.currentHP != null ? `${edge.currentHP}/${edge.maxHP}` : 'SIEGE'}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
