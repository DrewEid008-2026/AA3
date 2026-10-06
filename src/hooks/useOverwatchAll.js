import { useMemo, useRef, useState } from 'react';
import { TEAMS } from '@/game/constants';
import {
  canEnterOverwatch, enterOverwatch, isInOverwatch, isOverwatchBlocked, OVERWATCH_AP_COST,
} from '@/game/reactions';
import { hasAmmo } from '@/game/ammo';

// OVERWATCH ALL: squad-wide command. Every eligible deployed player soldier
// enters Overwatch using the exact same per-unit logic as the individual
// Overwatch command (enterOverwatch + withBurning). Ineligible soldiers are
// skipped without blocking the rest. Does not end the Player Phase.
//
// Returns:
//   feedback          — transient { kind, count, skipped, id } for the UI, or null
//   eligibleCount      — number of soldiers currently able to enter Overwatch
//   handleOverwatchAll — squad command handler
//   reset              — clears feedback + resolving lock (call on battle reset)
export function useOverwatchAll({
  units, phase, inputLocked, busy,
  withBurning, setUnits, setAttackMode, setAbilityTargeting,
  showActionBubble,
}) {
  const [feedback, setFeedback] = useState(null);
  const feedbackTimer = useRef(null);
  const resolvingRef = useRef(false);

  const eligibleCount = useMemo(() => {
    if (phase !== 'player' || inputLocked) return 0;
    return units.filter((u) => u.team === TEAMS.PLAYER && u.alive && canEnterOverwatch(u, phase)).length;
  }, [units, phase, inputLocked]);

  const showFeedback = (fb) => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    setFeedback(fb);
    feedbackTimer.current = setTimeout(() => setFeedback(null), 2500);
  };

  const handleOverwatchAll = () => {
    if (phase !== 'player' || busy || inputLocked) return;
    if (resolvingRef.current) return;

    const playerUnits = units.filter((u) => u.team === TEAMS.PLAYER && u.alive);
    const eligible = playerUnits.filter((u) => canEnterOverwatch(u, phase));

    if (eligible.length === 0) {
      showFeedback({ kind: 'none', id: Date.now() });
      return;
    }

    resolvingRef.current = true;
    setAttackMode(false);
    setAbilityTargeting(null);

    // Build skipped reasons for feedback.
    const skipped = [];
    for (const u of playerUnits) {
      if (canEnterOverwatch(u, phase)) continue;
      let reason = 'Ineligible';
      if (isInOverwatch(u)) reason = 'Overwatch';
      else if (u.ap < OVERWATCH_AP_COST) reason = 'No AP';
      else if (!hasAmmo(u)) reason = 'No Ammo';
      else if (isOverwatchBlocked(u)) reason = 'Suppressed';
      skipped.push({ name: u.name, reason });
    }

    // Apply the same per-unit logic as individual Overwatch (enterOverwatch +
    // withBurning) for each eligible soldier. Computed outside setUnits so
    // withBurning's side effects (popups) fire once per unit.
    const updates = new Map();
    for (const u of eligible) {
      const entered = enterOverwatch(u);
      updates.set(u.id, withBurning(entered, u.x, u.y));
    }
    setUnits((prev) => prev.map((u) => updates.get(u.id) || u));

    // Stagger bubbles slightly so overlapping units stay readable.
    if (showActionBubble) {
      for (let i = 0; i < eligible.length; i++) {
        setTimeout(() => showActionBubble(eligible[i].id, 'OVERWATCH!'), i * 60);
      }
    }

    showFeedback({ kind: 'ok', count: eligible.length, skipped, id: Date.now() });
    setTimeout(() => { resolvingRef.current = false; }, 350);
  };

  const reset = () => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    setFeedback(null);
    resolvingRef.current = false;
  };

  return { feedback, eligibleCount, handleOverwatchAll, reset };
}