import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GRID_WIDTH, GRID_HEIGHT } from '@/game/constants';

// Action text bubbles — small speech-style bubbles that appear briefly above
// a unit when it performs an action. One per unit; dead/missing units are
// skipped so bubbles clean up automatically on death. Units near the top edge
// show the bubble below to avoid clipping.
export default function ActionBubbleOverlay({ units, actionBubbles }) {
  if (!actionBubbles || actionBubbles.size === 0) return null;

  const tileH = 100 / GRID_HEIGHT;
  const visible = units.filter((u) => u.alive && !u.isBossObject && actionBubbles.has(u.id));

  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      <AnimatePresence>
        {visible.map((u) => {
          const bubble = actionBubbles.get(u.id);
          const atTop = u.y <= 1;
          const topPct = atTop
            ? ((u.y + 0.5) / GRID_HEIGHT) * 100 + tileH * 0.7
            : ((u.y + 0.5) / GRID_HEIGHT) * 100 - tileH * 0.7;
          // Clamp left so the bubble stays on-screen at edge columns.
          const rawLeft = ((u.x + 0.5) / GRID_WIDTH) * 100;
          const leftPct = Math.max(15, Math.min(85, rawLeft));
          return (
            <motion.div
              key={bubble.id}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="absolute"
              style={{ left: `${leftPct}%`, top: `${topPct}%`, transform: 'translate(-50%, -50%)' }}
            >
              <div className="relative">
                <div className="bg-slate-900/95 text-white text-[10px] font-bold tracking-wide px-2 py-1 rounded-lg shadow-lg border border-slate-600 text-center max-w-[130px] leading-tight whitespace-normal break-words">
                  {bubble.message}
                </div>
                <div
                  className={`absolute left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900/95 border-slate-600 rotate-45 ${
                    atTop ? '-top-1 border-t border-l' : '-bottom-1 border-r border-b'
                  }`}
                />
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}