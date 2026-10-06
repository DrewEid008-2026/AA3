import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GRID_WIDTH, GRID_HEIGHT } from '@/game/constants';

// Lightweight visual feedback when a destructible map tile is destroyed.
// Renders a brief expanding debris burst + flash at each destroyed tile,
// then fades out. No physics — purely cosmetic. The tile itself already
// changed to open ground (with a rubble texture) in the Tile component.
export default function SiegeDestructionOverlay({ fx }) {
  if (!fx || fx.length === 0) return null;
  return (
    <div className="absolute inset-0 pointer-events-none z-[12]">
      <AnimatePresence>
        {fx.map((f) => {
          const left = `${((f.x + 0.5) / GRID_WIDTH) * 100}%`;
          const top = `${((f.y + 0.5) / GRID_HEIGHT) * 100}%`;
          return (
            <motion.div
              key={f.id}
              initial={{ opacity: 0.95, scale: 0.3 }}
              animate={{ opacity: 0, scale: 2.4 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.65, ease: 'easeOut' }}
              className="absolute"
              style={{
                left, top,
                width: `${100 / GRID_WIDTH}%`,
                height: `${100 / GRID_HEIGHT}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              {/* Expanding shock ring */}
              <div className="absolute inset-0 rounded-full border-2 border-orange-300/70 bg-orange-500/25" />
              {/* Inner flash core */}
              <motion.div
                className="absolute inset-[20%] rounded-full bg-orange-400/60"
                initial={{ opacity: 0.9 }}
                animate={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}