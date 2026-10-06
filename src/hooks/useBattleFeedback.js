import { useCallback } from 'react';

// Extracted from Battle.jsx: the transient combat-feedback helpers (invalid-tile
// flash, attack feedback label, damage popups, status label). They depend on
// component-owned state setters and refs, which the caller passes in.
export function useBattleFeedback({
  setInvalidTile,
  invalidTimer,
  setAttackFeedback,
  feedbackTimer,
  setDamagePopups,
  popupId,
  FEEDBACK_MS,
  POPUP_MS,
}) {
  const flashInvalid = useCallback((tile) => {
    if (invalidTimer.current) clearTimeout(invalidTimer.current);
    setInvalidTile({ x: tile.x, y: tile.y });
    invalidTimer.current = setTimeout(() => setInvalidTile(null), 300);
  }, [setInvalidTile, invalidTimer]);

  const flashAttackFeedback = useCallback((x, y, text, tone = 'damage') => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    setAttackFeedback({ x, y, text, tone });
    feedbackTimer.current = setTimeout(() => setAttackFeedback(null), FEEDBACK_MS);
  }, [setAttackFeedback, feedbackTimer, FEEDBACK_MS]);

  const pushPopup = useCallback((x, y, amount, kill = false, tone = 'damage') => {
    const id = `pop_${popupId.current++}`;
    setDamagePopups((prev) => [...prev, { id, x, y, amount, kill, tone }]);
    setTimeout(() => setDamagePopups((prev) => prev.filter((p) => p.id !== id)), POPUP_MS);
  }, [setDamagePopups, popupId, POPUP_MS]);

  // Brief status-application label above a unit, then the compact icon takes
  // over on the token. Reuses the attack-feedback channel.
  const flashStatusLabel = useCallback((x, y, text, tone = 'status') => {
    flashAttackFeedback(x, y, text, tone);
  }, [flashAttackFeedback]);

  return { flashInvalid, flashAttackFeedback, pushPopup, flashStatusLabel };
}