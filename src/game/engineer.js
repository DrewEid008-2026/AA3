// Engineer battlefield-control logic: barricade deployment and shock mine
// management. Barricades use the existing directional-cover architecture —
// they are grid cover objects, not a separate system. Mines are tracked as
// a separate list and trigger during enemy movement (like Overwatch reactions).
import { COVER_TYPES, COVER_HP } from './constants';
import { STATUS_TYPES, applyStatus } from './statuses';
import { resolveTargetDamage } from './enemyPhaseHelpers';

// Place a directional barricade cover object on a tile. Returns a new grid.
export function placeBarricadeCover(grid, x, y, dir, hp) {
  const newGrid = grid.map((r) => r.slice());
  const tile = newGrid[y] && newGrid[y][x];
  if (!tile) return grid;
  const coverType = COVER_TYPES.ENGINEER_BARRICADE;
  newGrid[y][x] = {
    ...tile,
    cover: {
      ...tile.cover,
      [dir]: {
        type: coverType,
        hp,
        maxHp: hp,
        destroyed: false,
      },
    },
    destructible: true,
  };
  return newGrid;
}

// Count active (non-destroyed) barricades deployed by this Engineer.
// Reads the grid to check whether each tracked barricade still exists.
export function countActiveBarricades(grid, unit) {
  if (!unit || !unit.barricades) return 0;
  return unit.barricades.filter((b) => {
    const tile = grid[b.y] && grid[b.y][b.x];
    if (!tile || !tile.cover || !tile.cover[b.dir]) return false;
    return !tile.cover[b.dir].destroyed;
  }).length;
}

// Can the Engineer deploy another barricade? Checks the max-active limit
// against the ability definition and the current grid state.
export function canDeployBarricade(grid, unit, ability) {
  const active = countActiveBarricades(grid, unit);
  return active < (ability.maxActive ?? 2);
}

// Resolve a barricade deployment: place cover on the grid, track it on the
// unit, spend AP, start cooldown. Returns { grid, unit } for the caller to
// commit. Does NOT handle the Burning hook — the caller does that.
export function deployBarricade(grid, unit, x, y, dir, ability) {
  const hp = ability.barricadeHp ?? COVER_HP[COVER_TYPES.ENGINEER_BARRICADE] ?? 4;
  const newGrid = placeBarricadeCover(grid, x, y, dir, hp);
  const barricades = [...(unit.barricades || []), { x, y, dir }];
  const newUnit = {
    ...unit,
    ap: Math.max(0, unit.ap - ability.apCost),
    cooldowns: { ...unit.cooldowns, [ability.id]: ability.cooldown },
    reaction: null,
    barricades,
  };
  return { grid: newGrid, unit: newUnit };
}

// --- Shock Mine management ---

// Create a mine object. The damage is determined at placement time so upgrade
// modifiers (Overcharged Mine) are baked in.
export function createMine(x, y, ownerId, damage) {
  return {
    id: `mine_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    x,
    y,
    ownerId,
    damage,
  };
}

// Resolve a mine trigger on an enemy. Returns { unit, killed, damage }.
// The mine deals flat damage (ignores cover/flanking) and applies Stunned if
// the enemy survives. The caller removes the mine from the mines list.
export function triggerMine(enemy, mine) {
  let damage = mine.damage;
  // Armor: flat reduction (mine is armor-eligible direct combat damage)
  const armor = enemy.armor || 0;
  if (armor > 0) {
    damage = Math.max(1, damage - armor);
  }
  // Resolve through the full damage pipeline (Bulwark Shield → Core Shield → HP).
  const result = resolveTargetDamage(enemy, damage);
  if (result.killed) {
    return { unit: result.unit, killed: true, damage };
  }
  const stunned = applyStatus(result.unit, STATUS_TYPES.STUNNED, {
    source: mine.ownerId,
    turnsRemaining: 1,
  });
  return { unit: stunned, killed: false, damage };
}