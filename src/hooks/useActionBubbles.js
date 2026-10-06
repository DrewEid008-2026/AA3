import { useRef, useState, useCallback } from 'react';

const BUBBLE_MS = 1000;

// Action Bubble presentation state. One bubble per unit at a time; a new
// message replaces the old one immediately (no stacking). Bubbles auto-clear
// after BUBBLE_MS. All state is transient — never persisted to save data.
export function useActionBubbles() {
  const [actionBubbles, setActionBubbles] = useState(new Map());
  const bubbleTimers = useRef(new Map());

  const showActionBubble = useCallback((unitId, message) => {
    if (!unitId || !message) return;
    const id = Date.now() + Math.random();
    setActionBubbles((prev) => {
      const next = new Map(prev);
      next.set(unitId, { message, id });
      return next;
    });
    const existing = bubbleTimers.current.get(unitId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      setActionBubbles((prev) => {
        if (!prev.has(unitId)) return prev;
        const next = new Map(prev);
        next.delete(unitId);
        return next;
      });
      bubbleTimers.current.delete(unitId);
    }, BUBBLE_MS);
    bubbleTimers.current.set(unitId, timer);
  }, []);

  const clearActionBubbles = useCallback(() => {
    for (const timer of bubbleTimers.current.values()) clearTimeout(timer);
    bubbleTimers.current.clear();
    setActionBubbles(new Map());
  }, []);

  return { actionBubbles, showActionBubble, clearActionBubbles };
}