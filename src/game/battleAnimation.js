// Animation helpers for the battle enemy phase. Extracted from Battle.jsx to
// keep the page file manageable. Both use the live `speedMultiplier` binding
// from preferences so combat speed affects presentation timing.
import { GRID_WIDTH, GRID_HEIGHT } from './constants';
import { speedMultiplier } from './preferences';

// Animate a single tile-to-tile segment of a unit's move. Used by the enemy
// phase so reaction fire can interleave between segments.
export async function animateSegment(el, px, py, nx, ny, perSeg) {
  if (!el) return;
  const anim = el.animate(
    [
      { left: `${((px + 0.5) / GRID_WIDTH) * 100}%`, top: `${((py + 0.5) / GRID_HEIGHT) * 100}%` },
      { left: `${((nx + 0.5) / GRID_WIDTH) * 100}%`, top: `${((ny + 0.5) / GRID_HEIGHT) * 100}%` },
    ],
    { duration: perSeg * speedMultiplier, easing: 'linear', fill: 'forwards' }
  );
  await anim.finished;
  el.style.left = `${((nx + 0.5) / GRID_WIDTH) * 100}%`;
  el.style.top = `${((ny + 0.5) / GRID_HEIGHT) * 100}%`;
  anim.cancel();
}

// Shared movement animation along a path (used by move, dash, and enemy move).
export async function animateAlongPath(el, path, perSeg = 85, minDur = 220, maxDur = 700) {
  if (!el || !path || path.length < 2) return;
  const keyframes = path.map(([x, y]) => ({
    left: `${((x + 0.5) / 9) * 100}%`,
    top: `${((y + 0.5) / 14) * 100}%`,
  }));
  const segments = Math.max(1, path.length - 1);
  const duration = Math.min(maxDur, Math.max(minDur, segments * perSeg)) * speedMultiplier;
  const anim = el.animate(keyframes, { duration, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' });
  await anim.finished;
  const [fx, fy] = path[path.length - 1];
  el.style.left = `${((fx + 0.5) / 9) * 100}%`;
  el.style.top = `${((fy + 0.5) / 14) * 100}%`;
  anim.cancel();
}