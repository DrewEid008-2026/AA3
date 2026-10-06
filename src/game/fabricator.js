// Alien Fabricator support logic: FIELD REPAIR (heal a mechanical ally) and
// HARDLIGHT COVER (deploy alien directional cover). Hardlight barriers reuse
// the engineer barricade architecture — they are directional cover objects on
// the grid, tracked per-Fabricator with a max-active limit. They do not block
// movement or LOS (no system cover does); they only modify incoming damage.
import { COVER_TYPES } from './constants';

const SIDES = ['n', 's', 'e', 'w'];

// Mechanical archetypes are valid Field Repair targets. Currently the Bastion
// Mech. Add future mechs here.
export function isMechanical(archetype) {
  return archetype === 'bastion';
}

// Best damaged mechanical ally within Field Repair range. Priority: most
// missing HP. Returns the ally unit or null.
export function pickRepairTarget(units, fabricator, ability) {
  const candidates = units.filter((u) => {
    if (!u.alive || u.team !== fabricator.team || u.id === fabricator.id) return false;
    if (!isMechanical(u.archetype)) return false;
    if (u.hp >= u.maxHp) return false; // only damaged
    if (Math.max(Math.abs(u.x - fabricator.x), Math.abs(u.y - fabricator.y)) > ability.range) return false;
    return true;
  });
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => (b.maxHp - b.hp) - (a.maxHp - a.hp));
  return candidates[0];
}

// Place a hardlight directional cover object on a tile. Returns a new grid.
export function placeHardlightCover(grid, x, y, dir, hp) {
  const newGrid = grid.map((r) => r.slice());
  const row = newGrid[y];
  const tile = row && row[x];
  if (!tile) return grid;
  newGrid[y] = row.slice();
  newGrid[y][x] = {
    ...tile,
    cover: {
      ...tile.cover,
      [dir]: {
        type: COVER_TYPES.HARDLIGHT,
        hp,
        maxHp: hp,
        destroyed: false,
      },
    },
    destructible: true,
  };
  return newGrid;
}

// Count active (non-destroyed) hardlight barriers deployed by this Fabricator.
export function countActiveHardlight(grid, unit) {
  if (!unit || !unit.hardlightBarriers) return 0;
  return unit.hardlightBarriers.filter((b) => {
    const tile = grid[b.y] && grid[b.y][b.x];
    if (!tile || !tile.cover || !tile.cover[b.dir]) return false;
    return !tile.cover[b.dir].destroyed;
  }).length;
}

// Can the Fabricator deploy another hardlight barrier? Max-active limit.
export function canDeployHardlight(grid, unit, ability) {
  return countActiveHardlight(grid, unit) < (ability.maxActive ?? 2);
}