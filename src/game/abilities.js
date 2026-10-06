// Data-driven player class abilities + a shared targeting framework.
// Abilities declare a `targetType`; the Battle layer and HUD key off that
// instead of per-ability branching, so adding a new ability or class doesn't
// require reconstructing the interaction model.
import { computeReachable } from './pathfinding';
import { gridDistance, hasLineOfSight } from './combat';
import { TEAMS } from './constants';
import { STATUS_TYPES, markedBonus } from './statuses';
import {
  getMinePlacementRange,
  getEmergencyHealRangeBonus, getSkillDamageBonus, getAbilityApCost,
} from './skillEffects';
import { getCurrentArmor } from './armorShred';
import { computeComeHerePull, isImmuneToForcedMovement } from './comeHereResolver';

export const TARGET_TYPES = {
  DASH: 'dash',         // movement destination via pathfinding
  ENEMY: 'enemy',       // single enemy unit (Breach, Suppress, Line Up)
  TILE_AOE: 'tile_aoe', // battlefield tile + blast radius (Grenade)
  ALLY: 'ally',         // single friendly unit (Heal, Command)
  TILE: 'tile',         // single adjacent tile (Shock Mine)
  BARRICADE: 'barricade', // adjacent tile + orientation (Deploy Barricade)
  WALL: 'wall',           // adjacent Siege-destructible wall tile (Wall Charge)
  GROUND: 'ground',       // empty ground tile within range (Insta-Wall Cement)
};

// Ability definitions. `cooldown` is in player turns (0 = no cooldown).
// `usesPerMission` (when set) limits uses per battle instead of cooldown.
export const ABILITIES = {
  // --- Assault ---
  dash: {
    id: 'dash',
    name: 'Dash',
    cls: 'assault',
    targetType: TARGET_TYPES.DASH,
    icon: 'dash',
    apCost: 0,
    cooldown: 3,
    range: 5,
    accent: 'sky',
    desc: 'Reposition up to 5 tiles. Costs 0 AP.',
  },
  breach: {
    id: 'breach',
    name: 'Breach',
    cls: 'assault',
    targetType: TARGET_TYPES.ENEMY,
    icon: 'breach',
    apCost: 1,
    cooldown: 2,
    range: 1,
    damage: 8,
    ignoreCover: true,
    accent: 'rose',
    desc: 'Adjacent strike. 8 damage, ignores cover and flanking.',
  },
  // --- Heavy ---
  suppress: {
    id: 'suppress',
    name: 'Suppress',
    cls: 'heavy',
    targetType: TARGET_TYPES.ENEMY,
    icon: 'suppress',
    apCost: 1,
    cooldown: 2,
    range: 6,
    requiresLOS: true,
    status: STATUS_TYPES.SUPPRESSED,
    accent: 'violet',
    desc: 'Range 6, LOS. Target deals -2 damage next enemy phase.',
  },
  launch_rocket: {
    id: 'launch_rocket',
    name: 'Launch Rocket',
    cls: 'heavy',
    targetType: TARGET_TYPES.TILE_AOE,
    icon: 'rocket',
    apCost: 1,
    cooldown: 1,
    range: 5,
    areaRadius: 1,
    damage: 3,
    terrainDamage: 4,
    ignoreCover: true,
    usesPerMission: 1,
    armorShred: 2,
    damageTags: ['explosive'],
    accent: 'orange',
    desc: 'Range 5, 3×3 blast. 3 damage, 4 terrain damage, 2 Armor Shred. 1 use per battle.',
  },
  // --- Support ---
  heal: {
    id: 'heal',
    name: 'Heal',
    cls: 'support',
    targetType: TARGET_TYPES.ALLY,
    icon: 'heal',
    apCost: 1,
    cooldown: 3,
    range: 5,
    healing: 4,
    canTargetSelf: true,
    accent: 'emerald',
    desc: 'Range 5. Restore up to 4 HP to an injured ally (incl. self).',
  },
  command: {
    id: 'command',
    name: 'Command',
    cls: 'support',
    targetType: TARGET_TYPES.ALLY,
    icon: 'command',
    apCost: 1,
    cooldown: 3,
    range: 5,
    accent: 'cyan',
    desc: 'Range 5. Ally gains +1 AP (max 3) for this phase.',
  },
  // --- Engineer ---
  deploy_barricade: {
    id: 'deploy_barricade',
    name: 'Deploy Barricade',
    cls: 'engineer',
    targetType: TARGET_TYPES.BARRICADE,
    icon: 'deploy_barricade',
    apCost: 1,
    cooldown: 3,
    range: 1, // adjacent tile
    maxActive: 2, // max 2 active barricades per Engineer
    barricadeHp: 4,
    accent: 'amber',
    desc: 'Place directional cover on an adjacent tile. Max 2 active. 4 HP.',
  },
  shock_mine: {
    id: 'shock_mine',
    name: 'Explosive Mine',
    cls: 'engineer',
    targetType: TARGET_TYPES.TILE,
    icon: 'shock_mine',
    apCost: 1,
    cooldown: 0,
    range: 5,
    damage: 2,
    usesPerMission: 2,
    accent: 'yellow',
    desc: 'Place a mine within 5 tiles. Enemies trigger it when entering or crossing the tile. 2 charges per mission.',
  },
  // --- Marksman ---
  line_up: {
    id: 'line_up',
    name: 'Line Up',
    cls: 'marksman',
    targetType: TARGET_TYPES.ENEMY,
    icon: 'line_up',
    apCost: 1,
    cooldown: 2,
    range: 10, // precision rifle range
    requiresLOS: true,
    accent: 'rose',
    desc: 'Mark a target. Next Precision Rifle attack ignores cover reduction.',
  },
  relocate: {
    id: 'relocate',
    name: 'Relocate',
    cls: 'marksman',
    targetType: TARGET_TYPES.DASH,
    icon: 'relocate',
    apCost: 0,
    cooldown: 3,
    range: 3,
    contextual: true, // only available after a kill — not a regular ability button
    accent: 'cyan',
    desc: 'After a kill, reposition up to 3 tiles for 0 AP. Optional.',
  },
  // --- Equipment-granted (not class-bound) ---
  field_medkit: {
    id: 'field_medkit',
    name: 'Field Medkit',
    cls: 'equipment',
    targetType: TARGET_TYPES.ALLY,
    icon: 'field_medkit',
    apCost: 1,
    cooldown: 0,
    range: 1,
    healing: 3,
    canTargetSelf: true,
    usesPerMission: 1,
    accent: 'emerald',
    desc: 'Restore 3 HP to self or adjacent ally. 1 use per mission.',
  },
  // --- New equipment-granted utilities ---
  smoke_grenade: {
    id: 'smoke_grenade',
    name: 'Smoke',
    cls: 'equipment',
    targetType: TARGET_TYPES.TILE_AOE,
    icon: 'smoke_grenade',
    apCost: 1,
    cooldown: 0,
    range: 5,
    areaRadius: 1,
    usesPerMission: 1,
    accent: 'slate',
    desc: 'Range 5, radius 1. Creates Smoke that provides Cover until next Player Phase. 1 use per mission.',
  },
  sprint_harness: {
    id: 'sprint_harness',
    name: 'Sprint',
    cls: 'equipment',
    targetType: null,
    instant: true,
    icon: 'sprint_harness',
    apCost: 0,
    cooldown: 0,
    usesPerMission: 1,
    accent: 'sky',
    desc: 'Gain +3 normal movement for this Player Phase. 1 use per mission.',
  },
  emergency_shield: {
    id: 'emergency_shield',
    name: 'Shield',
    cls: 'equipment',
    targetType: null,
    instant: true,
    icon: 'emergency_shield',
    apCost: 0,
    cooldown: 0,
    usesPerMission: 1,
    accent: 'cyan',
    desc: 'Gain a 3-point Shield that absorbs damage before HP. 1 use per mission.',
  },
  grenade: {
    id: 'grenade',
    name: 'Grenade',
    cls: 'equipment',
    targetType: TARGET_TYPES.TILE_AOE,
    icon: 'grenade',
    apCost: 1,
    cooldown: 0,
    range: 5,
    areaRadius: 1,
    damage: 3,
    terrainDamage: 6,
    armorShred: 2,
    usesPerMission: 1,
    damageTags: ['explosive'],
    accent: 'orange',
    desc: 'Range 5, 3×3 blast. 3 damage, 6 terrain damage, 2 Armor Shred. 1 use per mission.',
  },
  // --- Terrain-manipulation utilities ---
  wall_charge: {
    id: 'wall_charge',
    name: 'Wall Charge',
    cls: 'equipment',
    targetType: TARGET_TYPES.WALL,
    icon: 'wall_charge',
    apCost: 1,
    cooldown: 0,
    range: 1, // adjacent (4-cardinal)
    usesPerMission: 1,
    canDestroyMapTiles: true,
    tileDestructionClass: TILE_DESTRUCTION_CLASSES.SIEGE,
    accent: 'orange',
    desc: 'Destroy an adjacent Siege-destructible wall and open a new route. 1 use per mission.',
  },
  insta_wall_cement: {
    id: 'insta_wall_cement',
    name: 'Insta-Wall',
    cls: 'equipment',
    targetType: TARGET_TYPES.GROUND,
    icon: 'insta_wall_cement',
    apCost: 1,
    cooldown: 0,
    range: 3,
    usesPerMission: 1,
    accent: 'amber',
    desc: 'Create a wall within 3 tiles that blocks movement and line of sight. 1 use per mission.',
  },
  disruptor_hook: {
    id: 'disruptor_hook',
    name: 'Disruptor Hook',
    cls: 'equipment',
    targetType: TARGET_TYPES.ENEMY,
    icon: 'disruptor_hook',
    apCost: 1,
    cooldown: 0,
    range: 5,
    usesPerMission: 1,
    damage: 0,
    accent: 'amber',
    desc: 'Range 5. Pull an enemy to the nearest valid tile adjacent to this soldier. 1 use per mission.',
  },
};

// Base class abilities — the starting abilities each class receives
// automatically (not purchasable skill-tree nodes). Displayed at the top of each
// class Skill Tree so the player sees what the tree is building from.
export const BASE_CLASS_ABILITIES = {
  assault: ['dash', 'breach'],
  heavy: ['suppress', 'launch_rocket'],
  support: ['heal', 'command'],
  engineer: ['deploy_barricade', 'shock_mine'],
  marksman: ['line_up', 'relocate'],
};

export function getBaseAbilities(cls) {
  return BASE_CLASS_ABILITIES[cls] || [];
}

export function getAbility(id) {
  return ABILITIES[id] || null;
}

// Returns the effective ability for a unit, merging per-unit upgrade overrides
// (e.g. Rapid Breach cooldown, Long Dash range, Field Medic healing) on top of
// the base definition.
export function getUnitAbility(unit, abilityId) {
  const base = getAbility(abilityId);
  if (!base) return null;
  if (!unit || !unit.abilityOverride || !unit.abilityOverride[abilityId]) return base;
  return { ...base, ...unit.abilityOverride[abilityId] };
}

// Effective cooldown for an ability on this unit (accounts for upgrades).
export function getUnitAbilityCooldown(unit, abilityId) {
  const a = getUnitAbility(unit, abilityId);
  return a ? a.cooldown : 0;
}

export function getUnitAbilities(unit) {
  if (!unit || unit.team !== TEAMS.PLAYER) return [];
  const classAbilities = Object.values(ABILITIES)
    .filter((a) => a.cls === unit.archetype && !a.contextual)
    .map((a) => getUnitAbility(unit, a.id) || a);
  const equipAbilities = (unit.equipmentAbilities || []).map((id) => getUnitAbility(unit, id)).filter(Boolean);
  return [...classAbilities, ...equipAbilities];
}

// --- Cooldown / uses state (lives on the unit) ---

export function getCooldown(unit, abilityId) {
  return (unit && unit.cooldowns && unit.cooldowns[abilityId]) || 0;
}

export function getRemainingUses(unit, abilityId) {
  const a = getUnitAbility(unit, abilityId);
  if (!a || !a.usesPerMission) return Infinity;
  const used = (unit && unit.abilityUses && unit.abilityUses[abilityId]) || 0;
  return Math.max(0, a.usesPerMission - used);
}

export function isAbilityReady(unit, abilityId) {
  return getCooldown(unit, abilityId) === 0 && getRemainingUses(unit, abilityId) > 0;
}

// Can the unit activate this ability right now (alive + player phase + AP +
// cooldown + uses)? `phase` optional.
export function canActivateAbility(unit, abilityId, phase) {
  if (!unit || !unit.alive || unit.team !== TEAMS.PLAYER) return false;
  if (unit.downed) return false;
  if (phase !== undefined && phase !== 'player') return false;
  const a = getUnitAbility(unit, abilityId);
  if (!a) return false;
  // Use the Disrupted-adjusted cost so abilities the soldier can't afford are blocked.
  if (unit.ap < getAbilityApCost(unit, a)) return false;
  if (!isAbilityReady(unit, abilityId)) return false;
  // Equipment-granted abilities require the equipment to be present.
  if (a.cls === 'equipment' && !(unit.equipmentAbilities || []).includes(abilityId)) return false;
  return true;
}

// --- Targeting (shared framework) ---

// Dash destinations: normal pathfinding within `range`.
export function getDashDestinations(grid, units, unit, ability) {
  return computeReachable(grid, units, unit, ability.range);
}

// Single-enemy targets (Breach, Suppress, Disruptor Hook).
export function getEnemyTargets(grid, units, unit, ability) {
  return units.filter((u) => {
    if (!u.alive || u.team === unit.team) return false;
    if (gridDistance(unit, u) > ability.range) return false;
    if (ability.requiresLOS && !hasLineOfSight(grid, unit, u)) return false;
    if (ability.id === 'disruptor_hook') {
      if (isImmuneToForcedMovement(u)) return false;
      const pull = computeComeHerePull(grid, units, unit, u);
      if (!pull.valid) return false;
    }
    return true;
  });
}

// Ally targets for Command (any living, non-downed, non-recovering ally except
// self, in range). Recovering blocks Command until the next Player Phase.
export function getAllyTargets(units, unit, ability) {
  return units.filter((u) => {
    if (!u.alive || u.team !== unit.team) return false;
    if (u.id === unit.id) return false;
    if (u.downed) return false;
    if (u.recovering && ability.id === 'command') return false;
    if (gridDistance(unit, u) > ability.range) return false;
    return true;
  });
}

// Heal targets: injured allies in range (self allowed). With Lifeline (Support
// Medic L10), Downed allies are also valid targets (remote revive). Emergency
// Medicine (L8) extends range by +2 against targets at ≤50% Max HP.
export function getHealTargets(units, unit, ability) {
  return units.filter((u) => {
    if (!u.alive || u.team !== unit.team) return false;
    if (u.downed) {
      // Any healing ability can target a Downed ally (healing = revive).
      // Non-healing ally abilities use getAllyTargets, which excludes downed.
    } else if (u.hp >= u.maxHp) {
      return false; // not injured
    }
    const rangeBonus = getEmergencyHealRangeBonus(unit, u);
    if (gridDistance(unit, u) > ability.range + rangeBonus) return false;
    return true;
  });
}

// Grenade impact tiles: any non-blocked tile within Chebyshev range.
export function getGrenadeImpactTiles(grid, unit, ability) {
  const tiles = [];
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const t = grid[y][x];
      if (!t || t.type === 'blocked') continue;
      if (Math.max(Math.abs(x - unit.x), Math.abs(y - unit.y)) > ability.range) continue;
      tiles.push({ x, y });
    }
  }
  return tiles;
}

// Tiles covered by a blast at (ix, iy) within `radius` (Chebyshev).
export function getBlastTiles(grid, ix, iy, radius) {
  const tiles = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x = ix + dx;
      const y = iy + dy;
      if (grid[y] && grid[y][x]) tiles.push({ x, y });
    }
  }
  return tiles;
}

// Living enemies affected by a blast at (ix, iy) within `radius`.
export function getGrenadeAffectedEnemies(units, ix, iy, radius) {
  return units.filter(
    (u) =>
      u.alive &&
      u.team === TEAMS.ENEMY &&
      Math.max(Math.abs(u.x - ix), Math.abs(u.y - iy)) <= radius
  );
}

// --- Engineer: Barricade and Mine targeting ---

import { GRID_WIDTH, GRID_HEIGHT, TILE_TYPES, TILE_DESTRUCTION_CLASSES } from './constants';

// 8-directional offsets for adjacency checks
const ADJACENT_DIRS = [
  [0, -1], [0, 1], [-1, 0], [1, 0],
  [-1, -1], [1, -1], [-1, 1], [1, 1],
];

// Valid adjacent tiles for barricade placement: walkable, unoccupied, not
// blocked. Does not exclude tiles with existing cover (player can choose a
// different side). Excludes civilian/device tiles to avoid mission interference.
export function getBarricadeTiles(grid, units, unit, civilian, device) {
  const tiles = [];
  // Include the Engineer's own tile so they can build on the square they or an
  // ally currently occupy. Enemy-occupied tiles remain excluded.
  const dirs = [[0, 0], ...ADJACENT_DIRS];
  for (const [dx, dy] of dirs) {
    const nx = unit.x + dx;
    const ny = unit.y + dy;
    if (nx < 0 || nx >= GRID_WIDTH || ny < 0 || ny >= GRID_HEIGHT) continue;
    const tile = grid[ny] && grid[ny][nx];
    if (!tile || tile.type === TILE_TYPES.BLOCKED) continue;
    if (units.some((u) => u.alive && u.team !== unit.team && u.x === nx && u.y === ny)) continue;
    if (civilian && !civilian.rescued && civilian.x === nx && civilian.y === ny) continue;
    if (device && !device.sabotaged && device.x === nx && device.y === ny) continue;
    tiles.push({ x: nx, y: ny });
  }
  return tiles;
}

// Valid tiles for Shock Mine placement: walkable, unoccupied, not blocked, not
// on objective devices or unrescued civilians. Base range is adjacent (1 tile);
// Remote Placement (Engineer Saboteur L4) extends this to range 5 (Chebyshev).
// LOS is NOT required — the Engineer places at range without moving.
export function getMineTiles(grid, units, unit, civilian, device) {
  const tiles = [];
  const range = getMinePlacementRange(unit);
  for (let dy = -range; dy <= range; dy++) {
    for (let dx = -range; dx <= range; dx++) {
      if (dx === 0 && dy === 0) continue; // not on self
      const nx = unit.x + dx;
      const ny = unit.y + dy;
      if (nx < 0 || nx >= GRID_WIDTH || ny < 0 || ny >= GRID_HEIGHT) continue;
      if (Math.max(Math.abs(dx), Math.abs(dy)) > range) continue;
      const tile = grid[ny] && grid[ny][nx];
      if (!tile || tile.type === TILE_TYPES.BLOCKED) continue;
      // Occupied tiles are allowed — placing a mine under an enemy detonates it
      // immediately, and under a friendly follows Friendly Mines rules.
      if (civilian && !civilian.rescued && civilian.x === nx && civilian.y === ny) continue;
      if (device && !device.sabotaged && device.x === nx && device.y === ny) continue;
      tiles.push({ x: nx, y: ny });
    }
  }
  return tiles;
}

// --- Previews (deterministic; match resolution exactly) ---

export function getBreachOutcome(target, damage, attacker, { trace = false } = {}) {
  // Breach ignores cover/flanking; Marked on the target still adds +2. Skill
  // bonuses (Shock Entry, Coordinated Strike) apply via skillEffects.
  const steps = trace ? [] : null;
  const step = (label, type, value, detail) => { if (steps) steps.push({ label, type, value, detail }); };
  const base = damage ?? ABILITIES.breach.damage; // 8 (or override)
  let dmg = base;
  step('Base Damage', 'base', dmg);
  const mBonus = markedBonus(target);
  if (mBonus) {
    dmg += mBonus;
    step('Marked', 'bonus', dmg, `+${mBonus}`);
  }
  if (attacker) {
    const skillBonus = getSkillDamageBonus(attacker, target, { kind: 'breach', state: 'exposed' });
    if (skillBonus) {
      dmg += skillBonus;
      step('Skill bonus', 'bonus', dmg, `+${skillBonus}`);
    }
  }
  dmg = Math.max(1, dmg);
  // Armor: flat reduction (Breach is armor-eligible direct combat damage).
  // Uses CURRENT battle Armor (reduced by Armor Shred).
  const armor = getCurrentArmor(target);
  if (armor > 0) {
    dmg = Math.max(1, dmg - armor);
    step('Armor', 'armor', dmg, `-${armor}`);
  }
  const hpAfter = Math.max(0, target.hp - dmg);
  return { damage: dmg, hpAfter, killed: hpAfter <= 0, markedBonus: mBonus, trace: steps };
}

export function getHealOutcome(target, healing) {
  const h = healing ?? ABILITIES.heal.healing;
  const heal = Math.min(h, target.maxHp - target.hp);
  return { heal, hpAfter: target.hp + heal };
}