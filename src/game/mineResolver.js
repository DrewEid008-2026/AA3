// Mine deployment resolution — extracted from Battle.jsx to keep the page
// file under the size limit. Handles single Explosive Mine + Minefield (3×3)
// placement, immediate detonation when placed on an occupied tile, and
// Friendly Mines (L8) immunity for allied occupants.
import { createMine, triggerMine } from './engineer';
import { getAbilityApCost, hasSkill } from './skillEffects';
import { GRID_WIDTH, GRID_HEIGHT } from './constants';

// Compute the candidate tiles for a mine placement (single or 3×3 minefield).
// Skips out-of-bounds, blocked, and the Engineer's own tile.
export function getMinefieldTiles(grid, unit, target, fieldMode) {
  const tiles = [];
  if (fieldMode) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const mx = target.x + dx;
        const my = target.y + dy;
        if (mx < 0 || mx >= GRID_WIDTH || my < 0 || my >= GRID_HEIGHT) continue;
        const t = grid[my] && grid[my][mx];
        if (!t || t.type === 'blocked') continue;
        if (mx === unit.x && my === unit.y) continue;
        tiles.push({ x: mx, y: my });
      }
    }
  } else {
    tiles.push({ x: target.x, y: target.y });
  }
  return tiles;
}

// Resolve a mine deployment. Creates mines on candidate tiles, immediately
// detonates any mine placed on an occupied tile (enemy → always; friendly →
// only if the owner lacks Friendly Mines). Returns:
//   { persistMines, detonations, atkFinal, fieldMode }
// detonations = [{ mine, occupantId, result }] where result is from triggerMine.
// atkFinal is the updated caster (AP spent, cooldown set). The caller applies
// the Burning hook and commits state.
export function resolveMineDeploy({ grid, units, caster, target, mineAbility }) {
  const fieldMode = hasSkill(caster, 'mine_field');
  const ownerHasFriendlyMines = hasSkill(caster, 'friendly_mines');
  const apCost = getAbilityApCost(caster, mineAbility);
  const candidateTiles = getMinefieldTiles(grid, caster, target, fieldMode);

  const persistMines = [];
  const detonations = [];
  for (const ct of candidateTiles) {
    const mine = createMine(ct.x, ct.y, caster.id, mineAbility.damage);
    const occupant = units.find((u) => u.alive && u.x === ct.x && u.y === ct.y);
    if (occupant) {
      const isFriendly = occupant.team === caster.team;
      if (isFriendly && ownerHasFriendlyMines) {
        // Friendly Mines: mine stays under the friendly unit, no detonation.
        persistMines.push(mine);
      } else {
        // Immediate detonation (enemy occupant, or friendly fire pre-Friendly Mines).
        const r = triggerMine(occupant, mine);
        detonations.push({ mine, occupantId: occupant.id, result: r });
      }
    } else {
      persistMines.push(mine);
    }
  }

  const atkFinal = {
    ...caster,
    ap: Math.max(0, caster.ap - apCost),
    cooldowns: { ...caster.cooldowns, shock_mine: mineAbility.cooldown },
    // Consume one mine charge per placement (single mine or Minefield = 1 charge).
    abilityUses: { ...caster.abilityUses, shock_mine: (caster.abilityUses?.shock_mine || 0) + 1 },
    reaction: null,
  };

  return { persistMines, detonations, atkFinal, fieldMode };
}