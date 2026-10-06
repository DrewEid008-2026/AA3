import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Factory } from 'lucide-react';

// Brief "FABRICATION SEQUENCE" announcement shown once when the Harvester's
// Phase 2 reinforcements enter the Pit (Part 7). Auto-dismisses after ~2.2s.
// Non-interactive — does not block input. Sequenced AFTER the Armor Breach
// banner so the two transitions never overlap (Part 8).
export default function FabricationSequenceBanner({ visible }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!visible) { setShow(false); return; }
    // Brief delay so it follows the Armor Breach banner cleanly (Part 2, 8).
    const t1 = setTimeout(() => setShow(true), 150);
    const t2 = setTimeout(() => setShow(false), 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [visible]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="absolute inset-0 z-[44] flex items-center justify-center pointer-events-none"
        >
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-2 bg-slate-950/92 border-2 border-fuchsia-500/70 rounded-lg px-6 py-3 shadow-2xl">
              <Factory className="w-6 h-6 text-fuchsia-400" />
              <div className="flex flex-col">
                <span className="text-fuchsia-300 font-black text-base tracking-[0.18em] uppercase">
                  Fabrication Sequence
                </span>
                <span className="text-fuchsia-400/80 font-bold text-[10px] tracking-wider uppercase">
                  Reinforcements Online
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}