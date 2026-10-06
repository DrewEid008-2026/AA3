// Centralized deterministic combat logic. A valid attack always hits — no
// accuracy, no random misses, no crits. This module is attacker/target agnostic
// so it will also drive enemy attacks in a later phase.
import { TILE_TYPES } from './constants';
import { getWeapon } from './weapons';
import { damageDealtPenalty, markedBonus, hasStatus, STATUS_TYPES } from './statuses';
import { hasAmmo } from './ammo';
import { getSkillDamageBonus } from './skillEffects';
import { getShieldValue, getCoreShieldValue } from './shield';
import { getCurrentArmor } from './armorShred';
import { hasLonePrey, isIsolated, getLonePreyBonus } from './lonePrey';
import { doesEdgeBlockVisualLOS, getEdgeBetweenTiles } from './terrainEdges';

// Sprinting (an enemy's second move action) halves Overwatch reaction damage.
// Applied before the final round-down and minimum-1 clamp.
export const SPRINT_DAMAGE_MULTIPLIER = 0.5;

// Returns the unit's effective weapon, merging any per-unit upgrade overrides
// (e.g. Close Quarters +damage, Heavy Magazine +ammo) on top of the base def.
export function getUnitWeapon(unit) {
  if (!unit) return null;
  const base = getWeapon(unit.weaponKey);
  if (!base) return null;
  return unit.weaponOverride ? { ...base, ...unit.weaponOverride } : base;
}

// Chebyshev distance: consistent with 8-directional movement where a diagonal
// step counts as one tile.
export function gridDistance(a, b) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export function isInRange(attacker, target, weapon) {
  return gridDistance(attacker, target) <= weapon.range;
}

// Bresenham line tiles (inclusive of both endpoints).
function lineTiles(x0, y0, x1, y1) {
  const tiles = [];
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0;
  let y = y0;
  let guard = 0;
  while (guard++ < 1000) {
    tiles.push([x, y]);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
  return tiles;
}

// Basic line of sight: blocked by solid BLOCKED terrain and FULL_WALL / SIEGE_STRUCTURE edges.
// Cover objects (barricades, LOW_WALL) are low cover and do NOT block sight. Endpoints are not checked.
export function hasLineOfSight(grid, attacker, target, edges = null) {
  const edgeCollection = edges || grid?.edges || null;
  const tiles = lineTiles(attacker.x, attacker.y, target.x, target.y);
  for (let i = 1; i < tiles.length - 1; i++) {
    const [x, y] = tiles[i];
    if (!grid[y] || !grid[y][x]) return false;
    if (grid[y][x].type === TILE_TYPES.BLOCKED) return false;
    if (grid[y][x].smoke) return false;
  }
  if (edgeCollection) {
    for (let i = 0; i < tiles.length - 1; i++) {
      const [x1, y1] = tiles[i];
      const [x2, y2] = tiles[i + 1];
      const edge = getEdgeBetweenTiles({ x: x1, y: y1 }, { x: x2, y: y2 }, edgeCollection);
      if (edge && doesEdgeBlockVisualLOS(edge)) {
        return false;
      }
    }
  }
  return true;
}

export const ATTACK_REASONS = {
  DEAD_ATTACKER: 'dead_attacker',
  DEAD_TARGET: 'dead_target',
  WRONG_PHASE: 'wrong_phase',
  NO_AP: 'no_ap',
  SAME_TEAM: 'same_team',
  OUT_OF_RANGE: 'out_of_range',
  BLOCKED: 'blocked',
  BUSY: 'busy',
  NO_AMMO: 'no_ammo',
};

// Reusable validation. `busy` covers movement or attack resolution in progress.
export function validateAttack({ grid, phase, busy, attacker, target }) {
  if (!attacker || !target) return { valid: false, reason: ATTACK_REASONS.DEAD_ATTACKER };
  if (!attacker.alive) return { valid: false, reason: ATTACK_REASONS.DEAD_ATTACKER };
  if (!target.alive) return { valid: false, reason: ATTACK_REASONS.DEAD_TARGET };
  if (busy) return { valid: false, reason: ATTACK_REASONS.BUSY };
  if (phase !== 'player') return { valid: false, reason: ATTACK_REASONS.WRONG_PHASE };
  if (attacker.team === target.team) return { valid: false, reason: ATTACK_REASONS.SAME_TEAM };
  const weapon = getUnitWeapon(attacker);
  if (!weapon) return { valid: false, reason: ATTACK_REASONS.NO_AP };
  if (attacker.ap < weapon.apCost) return { valid: false, reason: ATTACK_REASONS.NO_AP };
  if (!hasAmmo(attacker)) return { valid: false, reason: ATTACK_REASONS.NO_AMMO };
  if (!isInRange(attacker, target, weapon)) return { valid: false, reason: ATTACK_REASONS.OUT_OF_RANGE };
  if (!hasLineOfSight(grid, attacker, target)) return { valid: false, reason: ATTACK_REASONS.BLOCKED };
  return { valid: true, reason: null };
}

export function getValidTargets(units, grid, attacker, phase, busy) {
  if (!attacker || !attacker.alive || busy || phase !== 'player') return [];
  const weapon = getUnitWeapon(attacker);
  if (!weapon || attacker.ap < weapon.apCost || !hasAmmo(attacker)) return [];
  return units
    .filter((u) => u.alive && u.team !== attacker.team)
    .filter((u) => validateAttack({ grid, phase, busy, attacker, target: u }).valid);
}

// Phase-agnostic attack validity — shared by the player UI and the enemy AI so
// both teams use one combat model (range + line of sight + AP + alive + team).
export function attackIsValid(grid, attacker, target) {
  if (!attacker || !target || !attacker.alive || !target.alive) return false;
  if (target.downed) return false; // enemies skip downed soldiers
  if (attacker.team === target.team) return false;
  const weapon = getUnitWeapon(attacker);
  if (!weapon) return false;
  if (attacker.ap < weapon.apCost) return false;
  if (!hasAmmo(attacker)) return false;
  if (!isInRange(attacker, target, weapon)) return false;
  if (!hasLineOfSight(grid, attacker, target)) return false;
  return true;
}

// All valid targets for an attacker on any phase. Used by the enemy AI.
export function getAttackTargets(grid, units, attacker) {
  if (!attacker || !attacker.alive) return [];
  return units.filter((u) => attackIsValid(grid, attacker, u));
}

export const COVER_MODIFIERS = { exposed: 1.0, covered: 0.5, flanked: 1.5 };
export const COVER_STATE_LABELS = { exposed: 'EXPOSED', covered: 'COVER', flanked: 'FLANKED' };

// Relevant cover sides for an attack from `attacker` to `target`.
// Cardinal attacks check one side; diagonal attacks (|dx| == |dy|) check both
// relevant sides so corner cover feels intuitive.
export function relevantCoverSides(attacker, target) {
  const dx = target.x - attacker.x;
  const dy = target.y - attacker.y;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  const sides = [];
  if (ax >= ay && dx !== 0) sides.push(dx > 0 ? 'w' : 'e'); // attacker W/E of target
  if (ay >= ax && dy !== 0) sides.push(dy > 0 ? 'n' : 's'); // attacker N/S of target
  return sides;
}

// Bidirectional cover: a barrier on an edge protects occupants on BOTH tiles
// sharing that edge whenever the barrier sits between the unit and the shooter.
// Cover is still stored per-tile-per-side, but evaluation checks both sides of
// the shared edge. `side` is the edge of the target tile facing the attacker.
export const OPPOSITE_DIR = { n: 's', s: 'n', e: 'w', w: 'e' };
export const NEIGHBOR_OFFSET = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };

// Does the shared edge in direction `side` of tile (tx,ty) have active cover?
// Checks the target's own cover on that side AND the neighbor tile's cover on
// the opposite-facing side (the other side of the same physical edge).
export function edgeHasActiveCover(grid, tx, ty, side) {
  const tile = grid[ty] && grid[ty][tx];
  if (!tile) return false;
  const own = tile.cover && tile.cover[side];
  if (own && !own.destroyed) return true;
  const [dx, dy] = NEIGHBOR_OFFSET[side];
  const neighbor = grid[ty + dy] && grid[ty + dy][tx + dx];
  if (!neighbor || !neighbor.cover) return false;
  const opp = neighbor.cover[OPPOSITE_DIR[side]];
  return !!(opp && !opp.destroyed);
}

// Locate the actual tile+side holding the active cover on the shared edge in
// direction `side` of the target. Prefers the target's own cover; falls back to
// the neighbor's opposite-side cover (bidirectional). Returns {x, y, side} or
// null. Used by cover damage so the correct barricade HP is decremented.
export function protectingCoverLocation(grid, tx, ty, side) {
  const tile = grid[ty] && grid[ty][tx];
  if (tile && tile.cover && tile.cover[side] && !tile.cover[side].destroyed) {
    return { x: tx, y: ty, side };
  }
  const [dx, dy] = NEIGHBOR_OFFSET[side];
  const nx = tx + dx;
  const ny = ty + dy;
  const neighbor = grid[ny] && grid[ny][nx];
  if (neighbor && neighbor.cover) {
    const oppSide = OPPOSITE_DIR[side];
    const opp = neighbor.cover[oppSide];
    if (opp && !opp.destroyed) return { x: nx, y: ny, side: oppSide };
  }
  return null;
}

// Dynamically derive cover state from attacker + target + battlefield. Never
// stored on the target: the same unit can be Covered for one attacker and
// Flanked for another simultaneously.
//
// Bidirectional: a barrier between the target and the attacker grants COVERED
// regardless of which tile "owns" the cover entry. A target with active cover on
// some adjacent edge but NOT on the edge between it and the attacker is FLANKED.
// A target with no adjacent cover at all is EXPOSED.
//
// Smoke (Smoke Grenade) provides a COVERED state when the target would
// otherwise be Exposed or Flanked (lacking physical protection). It does NOT
// improve existing valid physical Cover, and cover-ignoring attacks bypass it
// (they never call this function or use ignoreCover).
export function getCoverState(grid, attacker, target) {
  const tile = grid[target.y] && grid[target.y][target.x];
  if (!tile) return 'exposed';
  const hasCover = ['n', 's', 'e', 'w'].some((d) => edgeHasActiveCover(grid, target.x, target.y, d));
  let state;
  if (!hasCover) {
    state = 'exposed';
  } else {
    const sides = relevantCoverSides(attacker, target);
    if (sides.length === 0) state = 'exposed';
    else state = sides.some((d) => edgeHasActiveCover(grid, target.x, target.y, d)) ? 'covered' : 'flanked';
  }
  // Smoke supplies a defensive COVERED state for eligible direct attacks when
  // the occupant lacks physical protection. Does not create Flanked/Exposed
  // bonuses — only upgrades Exposed/Flanked to Covered.
  if (tile.smoke && (state === 'exposed' || state === 'flanked')) return 'covered';
  return state;
}

// Single source of truth for damage. Preview and resolution share this, so the
// number the player sees is always the number that is dealt.
// Order: base damage (with close-range penalty) → cover modifier (with Line Up
// ignoreCover) → sprint reduction (reactions) → attacker status penalties
// (Suppressed) → target Marked bonus → round down → clamp to minimum 1 for a
// valid damaging attack. `options.sprint` applies the Overwatch sprinting-target
// reduction. `options.ignoreCover` (Line Up) treats covered as exposed (1.0)
// but keeps the flanked bonus (1.5) when the target is genuinely flanked.
export function computeDamage(attacker, target, grid, options = {}) {
  const weapon = getUnitWeapon(attacker);
  // Trace: when options.trace is true, record each pipeline step so the
  // Detailed Targeting Info panel can display the exact calculation without
  // duplicating the formula. Purely additive — never changes final values.
  const trace = options.trace ? [] : null;
  const step = (label, type, value, detail) => { if (trace) trace.push({ label, type, value, detail }); };
  // Close-range penalty: weapons with closeRangeDamage use a lower base at
  // short distances (e.g. Precision Rifle: 5 → 3 at distance ≤ 2).
  // options.baseDamage overrides the weapon's base (used by Command Beam, which
  // uses normal cover/armor/shield resolution but a custom damage value).
  let baseDamage = options.baseDamage != null ? options.baseDamage : (weapon ? weapon.damage : 0);
  let closeRange = false;
  if (weapon && weapon.closeRangeDamage != null && weapon.closeRangeThreshold != null) {
    const dist = gridDistance(attacker, target);
    if (dist <= weapon.closeRangeThreshold) {
      baseDamage = weapon.closeRangeDamage;
      closeRange = true;
    }
  }
  step(closeRange ? 'Base (close range)' : 'Base Damage', 'base', baseDamage, weapon ? weapon.name : null);
  const state = getCoverState(grid, attacker, target);
  let modifier = COVER_MODIFIERS[state];
  // Line Up: ignore cover reduction (covered → 1.0), keep flanked bonus (1.5).
  if (options.ignoreCover && state === 'covered') {
    modifier = 1.0;
  }
  let dmg = baseDamage * modifier;
  if (state !== 'exposed' || options.ignoreCover) {
    const label = options.ignoreCover && state === 'covered'
      ? 'Line Up: ignore Cover'
      : `${COVER_STATE_LABELS[state]} ×${modifier}`;
    step(label, 'cover', Math.floor(dmg), state);
  }
  if (options.sprint) {
    dmg *= SPRINT_DAMAGE_MULTIPLIER;
    step('Sprint target ×0.5', 'sprint', Math.floor(dmg));
  }
  if (baseDamage > 0) {
    const penalty = damageDealtPenalty(attacker);
    if (penalty) {
      dmg -= penalty;
      step('Suppressed', 'penalty', Math.floor(dmg), `-${penalty}`);
    }
  }
  // Marked: +2 to the target, applied after attacker modifiers, before rounding.
  const marked = hasStatus(target, STATUS_TYPES.MARKED);
  const mBonus = marked ? markedBonus(target) : 0;
  if (mBonus && baseDamage > 0) {
    dmg += mBonus;
    step('Marked', 'bonus', Math.floor(dmg), `+${mBonus}`);
  }
  // Skill-tree damage bonuses (Shock Entry, Deadeye, Executioner, Sustained Fire,
  // Chain Hunter, Coordinated Strike). Centralized in skillEffects so preview
  // and resolution share one calculation.
  if (baseDamage > 0) {
    const skillBonus = getSkillDamageBonus(attacker, target, {
      kind: options.kind || 'basic',
      weapon,
      state,
      ignoreCover: !!options.ignoreCover,
    });
    if (skillBonus) {
      dmg += skillBonus;
      step('Skill bonus', 'bonus', Math.floor(dmg), `+${skillBonus}`);
    }
  }
  dmg = Math.floor(dmg);
  step('Round down', 'round', dmg);
  if (baseDamage > 0) dmg = Math.max(1, dmg);
  let finalDamage = dmg;
  // Armor: flat reduction (after all offensive modifiers, before shield).
  // Uses CURRENT battle Armor (reduced by Armor Shred), not base equipment Armor.
  // affectedByArmor defaults to true; callers opt out for environmental/status damage.
  // Armor Piercing Rounds (utility): basic weapon attacks ignore 1 Armor.
  // The attacker's armorPierce reduces effective armor (min 0, never negative).
  const armor = getCurrentArmor(target);
  const affectedByArmor = options.affectedByArmor !== false;
  if (affectedByArmor && baseDamage > 0 && armor > 0) {
    const armorPierce = attacker.armorPierce || 0;
    const effectiveArmor = Math.max(0, armor - armorPierce);
    if (effectiveArmor > 0) {
      finalDamage = Math.max(1, finalDamage - effectiveArmor);
      step(armorPierce > 0 ? `Armor (pierce ${armorPierce})` : 'Armor', 'armor', finalDamage, `-${effectiveArmor}`);
    } else if (armorPierce > 0) {
      step('Armor Piercing Rounds', 'armor', finalDamage, `ignore ${armorPierce}`);
    }
  }
  // Lone Prey (Executioner passive): +2 final damage when the target has no
  // active friendly soldier within 2 tiles. Applied after Armor, before
  // shields (spec 9, 27). The base attack still goes through the normal Armor
  // pipeline — only the +2 is special. `options.units` must be provided for
  // the check to run; callers that omit it (e.g. reaction fire from players)
  // never trigger Lone Prey.
  let lonePrey = false;
  let lonePreyBonus = 0;
  if (options.units && hasLonePrey(attacker) && baseDamage > 0) {
    if (isIsolated(target, options.units)) {
      lonePrey = true;
      lonePreyBonus = getLonePreyBonus();
      finalDamage += lonePreyBonus;
      step('Lone Prey', 'bonus', finalDamage, `+${lonePreyBonus}`);
    }
  }
  // Bulwark Energy Shield absorbs before HP. The preview shows the actual HP
  // damage so the player sees what will land through all absorption layers.
  const bulwarkShield = getShieldValue(target);
  const shieldAbsorbed = Math.min(bulwarkShield, finalDamage);
  const afterBulwark = finalDamage - shieldAbsorbed;
  if (shieldAbsorbed > 0) step('Energy Shield', 'shield', afterBulwark, `-${shieldAbsorbed}`);
  // Core Shield (boss) absorbs after Bulwark Shield, before HP.
  const coreShield = getCoreShieldValue(target);
  const coreShieldAbsorbed = Math.min(coreShield, afterBulwark);
  const hpDamage = afterBulwark - coreShieldAbsorbed;
  if (coreShieldAbsorbed > 0) step('Core Shield', 'shield', hpDamage, `-${coreShieldAbsorbed}`);
  const hpAfter = Math.max(0, target.hp - hpDamage);
  step('HP damage', 'hp', hpDamage);
  const killed = hpAfter <= 0;
  return { state, baseDamage, modifier, closeRange, sprint: !!options.sprint, marked, markedBonus: mBonus, lonePrey, lonePreyBonus, finalDamage, armor, shield: bulwarkShield, shieldAbsorbed, coreShield, coreShieldAbsorbed, hpDamage, hpAfter, killed, weapon, trace };
}

// Flat-damage resolution for abilities that ignore cover/flanking (Breach,
// Grenade per target, Shock Strike, Incendiary Shot). Applies attacker Suppressed
// (unless ignoreSuppressed) and target Marked, then rounds and clamps to min 1.
// Returns the same shape as computeDamage so callers stay uniform.
export function resolveFlatDamage(baseDamage, attacker, target, { ignoreSuppressed = false, affectedByArmor = true, trace = false } = {}) {
  const steps = trace ? [] : null;
  const step = (label, type, value, detail) => { if (steps) steps.push({ label, type, value, detail }); };
  let dmg = baseDamage;
  step('Base Damage', 'base', dmg);
  if (baseDamage > 0 && !ignoreSuppressed) {
    const penalty = damageDealtPenalty(attacker);
    if (penalty) {
      dmg -= penalty;
      step('Suppressed', 'penalty', Math.floor(dmg), `-${penalty}`);
    }
  }
  const marked = hasStatus(target, STATUS_TYPES.MARKED);
  const mBonus = marked ? markedBonus(target) : 0;
  if (mBonus && baseDamage > 0) {
    dmg += mBonus;
    step('Marked', 'bonus', Math.floor(dmg), `+${mBonus}`);
  }
  dmg = Math.floor(dmg);
  step('Round down', 'round', dmg);
  if (baseDamage > 0) dmg = Math.max(1, dmg);
  let finalDamage = dmg;
  // Armor: flat reduction (after all offensive modifiers). Uses CURRENT battle
  // Armor (reduced by Armor Shred), not base equipment Armor.
  const armor = getCurrentArmor(target);
  if (affectedByArmor && baseDamage > 0 && armor > 0) {
    finalDamage = Math.max(1, finalDamage - armor);
    step('Armor', 'armor', finalDamage, `-${armor}`);
  }
  const hpAfter = Math.max(0, target.hp - finalDamage);
  const killed = hpAfter <= 0;
  return { marked, markedBonus: mBonus, finalDamage, armor, hpAfter, killed, trace: steps };
}

export function attackReasonText(reason) {
  switch (reason) {
    case ATTACK_REASONS.OUT_OF_RANGE: return 'OUT OF RANGE';
    case ATTACK_REASONS.BLOCKED: return 'BLOCKED';
    case ATTACK_REASONS.NO_AP: return 'NO AP';
    case ATTACK_REASONS.NO_AMMO: return 'NO AMMO';
    case ATTACK_REASONS.WRONG_PHASE: return 'NOT YOUR TURN';
    default: return 'INVALID';
  }
}