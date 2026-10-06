import React from 'react';
import { motion } from 'framer-motion';
import { ShieldHalf } from 'lucide-react';

// Brief "Cover Destroyed" bubble shown for ~1s when one or more cover pieces
// are destroyed by an attack or grenade blast. Non-interactive; auto-dismissed
// by the parent clearing `coverDestroyed` after the timer elapses.
export default function CoverDestroyedBanner({ count, id }) {
  if (!count) return null;
  return (
    <div className="absolute left-1/2 -translate-x-1/2 top-3 z-30 pointer-events-none">
      <motion.div
        key={id}
        initial={{ opacity: 0, scale: 0.8, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-950/90 border border-orange-500/70 shadow-lg shadow-orange-900/40"
      >
        <ShieldHalf className="w-4 h-4 text-orange-400" />
        <span className="text-orange-200 font-bold text-xs tracking-wide uppercase whitespace-nowrap">
          Cover Destroyed{count > 1 ? ` ×${count}` : ''}
        </span>
      </motion.div>
    </div>
  );
}