// Data-driven enemy special abilities. Each enemy archetype gains at most one
// special ability for now, giving it a stronger identity without complexity.
// Definitions mirror the player ability shape (apCost, cooldown, range, etc.)
// so the AI and Battle layer read them generically.
//
// Enemy cooldowns live on unit.cooldowns (same field as player abilities) and
// decrement once per Enemy Phase. Dead enemies skip cooldown processing.
import { gridDistance, hasLineOfSight } from './combat';
import { STATUS_TYPES } from './statuses';
import { SHIELD_VALUE } from './shield';
import { PLASMA_STRIKE } from './plasmaStrike';

export const ENEMY_ABILITIES = {
  // Grunt — support-style debuff. Marks a player so allies deal +2.
  mark_target: {
    id: 'mark_target',
    name: 'Mark Target',
    archetype: 'grunt',
    apCost: 1,
    cooldown: 3,
    range: 6,
    requiresLOS: true,
    appliesStatus: STATUS_TYPES.MARKED,
    damage: 0,
    desc: 'Apply Marked to a player in sight. Allies deal +2 to them.',
  },
  // Rusher — adjacent control. Fixed 3 + Stun, ignores cover/flanking.
  shock_strike: {
    id: 'shock_strike',
    name: 'Shock Strike',
    archetype: 'rusher',
    apCost: 1,
    cooldown: 3,
    range: 1,
    requiresLOS: false,
    damage: 3,
    ignoreCover: true,
    appliesStatus: STATUS_TYPES.STUNNED,
    desc: 'Adjacent strike. 3 damage + Stunned. Ignores cover.',
  },
  // Support — damage over time. 1 now + Burning for 2 turns.
  incendiary_shot: {
    id: 'incendiary_shot',
    name: 'Incendiary Shot',
    archetype: 'support',
    apCost: 1,
    cooldown: 3,
    range: 7,
    requiresLOS: true,
    damage: 1,
    ignoreCover: true,
    appliesStatus: STATUS_TYPES.BURNING,
    statusDuration: 2,
    desc: 'Range 7, LOS. 1 damage + Burning (2 turns).',
  },
  // Bulwark — Energy Shield. Shields self or an adjacent ally (absorbs 4 dmg).
  energy_shield: {
    id: 'energy_shield',
    name: 'Energy Shield',
    archetype: 'bulwark',
    apCost: 1,
    cooldown: 3,
    range: 1, // self or adjacent ally
    requiresLOS: false,
    damage: 0,
    targetType: 'ally_or_self', // self or adjacent enemy-team unit
    shieldValue: SHIELD_VALUE,
    appliesStatus: STATUS_TYPES.SHIELDED,
    desc: 'Shield self or adjacent ally. Absorbs 4 damage. No stacking.',
  },
  // Stalker — Phase Step. 0-AP evasive reposition up to 3 tiles (relaxed path).
  phase_step: {
    id: 'phase_step',
    name: 'Phase Step',
    archetype: 'stalker',
    apCost: 0,
    cooldown: 3,
    range: 3,
    requiresLOS: false,
    damage: 0,
    targetType: 'phase_step', // special movement, not a unit target
    desc: '0 AP. Reposition up to 3 tiles, passing through units. Triggers Overwatch.',
  },
  // Disruptor — Disruption Beam. 1 damage + Disrupted (abilities cost +1 AP).
  disruption_beam: {
    id: 'disruption_beam',
    name: 'Disruption Beam',
    archetype: 'disruptor',
    apCost: 1,
    cooldown: 3,
    range: 7,
    requiresLOS: true,
    damage: 1,
    ignoreCover: true,
    appliesStatus: STATUS_TYPES.DISRUPTED,
    statusDuration: 1,
    desc: 'Range 7, LOS. 1 damage + Disrupted (abilities cost +1 AP).',
  },
  // Artillery — Plasma Strike. Delayed area blast (center 5, adjacent 3).
  plasma_strike: {
    id: 'plasma_strike',
    name: 'Plasma Strike',
    archetype: 'artillery',
    apCost: 1,
    cooldown: 3,
    range: 8,
    requiresLOS: true,
    damage: 0, // damage is delayed; see plasmaStrike.js
    targetType: 'tile', // targets a battlefield tile, not a unit
    centerDamage: PLASMA_STRIKE.centerDamage,
    adjacentDamage: PLASMA_STRIKE.adjacentDamage,
    radius: PLASMA_STRIKE.radius,
    desc: 'Mark a tile. Detonates next Enemy Phase. Center 5, adjacent 3. Ignores cover.',
  },
  // --- Chapter 2: Bastion Mech — BULLDOZE ---
  // Straight-line charge up to 4 tiles in a cardinal direction. Destroys light
  // cover (barricades / engineer barricades / hardlight) along the path; walls
  // stop it. If it ends adjacent to a soldier, rams for 3 + Stunned (armor
  // applies, cover ignored). targetType 'bulldoze' — the AI builds the path.
  bulldoze: {
    id: 'bulldoze',
    name: 'Bulldoze',
    archetype: 'bastion',
    apCost: 1,
    cooldown: 3,
    range: 4,
    requiresLOS: false,
    damage: 3,
    affectedByArmor: true,
    appliesStatus: STATUS_TYPES.STUNNED,
    targetType: 'bulldoze',
    desc: 'Charge up to 4 tiles in a line, destroying light cover. Ram an adjacent soldier: 3 + Stunned. Armor applies. Walls block.',
  },
  // --- Chapter 2: Alien Fabricator — FIELD REPAIR ---
  // Restore 4 HP to a mechanical ally (Bastion Mech) within range 5. Creates
  // target-priority tension: kill the mech or kill the thing repairing it.
  field_repair: {
    id: 'field_repair',
    name: 'Field Repair',
    archetype: 'fabricator',
    apCost: 1,
    cooldown: 2,
    range: 5,
    requiresLOS: false,
    damage: 0,
    healing: 4,
    targetType: 'mechanical_ally',
    desc: 'Restore 4 HP to a damaged mechanical ally (Bastion Mech). Range 5.',
  },
  // --- Chapter 2: Alien Fabricator — HARDLIGHT COVER ---
  // Deploy alien directional cover on an adjacent tile. HP 5. Max 2 active per
  // Fabricator. Does not block movement or LOS — only modifies damage.
  hardlight_cover: {
    id: 'hardlight_cover',
    name: 'Hardlight Cover',
    archetype: 'fabricator',
    apCost: 1,
    cooldown: 3,
    range: 1,
    requiresLOS: false,
    damage: 0,
    targetType: 'hardlight_cover',
    barricadeHp: 5,
    maxActive: 2,
    desc: 'Deploy alien directional cover on an adjacent tile. HP 5. Max 2 active. Does not block movement or LOS.',
  },
  // --- Chapter 1 Boss: Warden Prime abilities ---
  // Command Beam — coordinated mark. 4 damage + Marked. Uses normal cover/armor/shield
  // resolution (not flat damage). BEAM presentation. The Warden uses this to set up
  // follow-up attacks from Grunts, Bulwark, and reinforcements.
  command_beam: {
    id: 'command_beam',
    name: 'Command Beam',
    archetype: 'warden_prime',
    apCost: 1,
    cooldown: 2,
    range: 7,
    requiresLOS: true,
    damage: 4,
    usesNormalDamageResolution: true, // cover/armor/shields apply (not flat damage)
    appliesStatus: STATUS_TYPES.MARKED,
    presentation: 'beam',
    desc: 'Range 7, LOS. 4 damage + Marked. Normal cover resolution. Cooldown 2.',
  },
  // Beam Sweep — delayed full-lane attack. Marks a full row or column; detonates
  // at the beginning of the following Enemy Phase for 6 damage. Ignores cover,
  // armor applies. Max 1 pending at a time.
  beam_sweep: {
    id: 'beam_sweep',
    name: 'Beam Sweep',
    archetype: 'warden_prime',
    apCost: 1,
    cooldown: 3,
    range: 0, // not a unit-targeted ability — targets a full lane
    requiresLOS: false,
    damage: 0, // damage is delayed; see beamSweep.js
    targetType: 'beam_sweep', // special: targets a full row or column
    sweepDamage: 6,
    desc: 'Marks a full row or column. Fires next Enemy Phase for 6 damage. Ignores Cover. Armor applies.',
  },
  // --- Chapter 2 Boss: The Harvester abilities ---
  // TREMOR SLAM — delayed 3×3 area attack. 1 AP, cooldown 3. Marks a 3×3 area;
  // detonates at the beginning of the following Enemy Phase for 4 Environmental
  // damage (ignores Armor + Cover) + 6 terrain damage to normal Cover. Cannot
  // destroy Siege map tiles. Max 1 major pending hazard at a time.
  tremor_slam: {
    id: 'tremor_slam',
    name: 'Tremor Slam',
    archetype: 'harvester',
    apCost: 1,
    cooldown: 3,
    range: 0, // not unit-targeted — targets a 3×3 area
    requiresLOS: false,
    damage: 0, // damage is delayed + environmental (see tremorSlam.js)
    targetType: 'tremor_slam',
    tremorDamage: 4,
    terrainDamage: 6,
    desc: '3×3 area. Detonates next Enemy Phase. 4 Environmental damage (ignores Armor/Cover). 6 terrain damage to Cover. Cannot destroy Siege tiles.',
  },
  // EXCAVATION BEAM — delayed straight-line cutting attack. 1 AP, cooldown 3.
  // Marks a full row or column; detonates at the beginning of the following
  // Enemy Phase for 5 Direct Energy damage (Armor applies, Cover reduction
  // IGNORED) + 8 terrain damage to normal Cover. Cannot destroy Siege map tiles.
  // Max 1 major pending hazard at a time.
  excavation_beam: {
    id: 'excavation_beam',
    name: 'Excavation Beam',
    archetype: 'harvester',
    apCost: 1,
    cooldown: 3,
    range: 0, // targets a full row or column
    requiresLOS: false,
    damage: 0, // damage is delayed (see excavationBeam.js)
    targetType: 'excavation_beam',
    beamDamage: 5,
    terrainDamage: 8,
    desc: 'Row or column. Detonates next Enemy Phase. 5 Direct Energy damage (ignores Cover reduction, Armor applies). 8 terrain damage to Cover. Cannot destroy Siege tiles.',
  },
  // SIEGE CHARGE — The Harvester's signature Phase 2 ability. 1 AP, cooldown 3.
  // Marks a straight orthogonal line (max 5 tiles); detonates at the beginning
  // of the following Enemy Phase. Destroys Siege map tiles + normal Cover in
  // the path, Downs standing soldiers (ignores Armor/Shield/HP), and moves the
  // Harvester to the destination. Telegraphs one full Player Phase in advance.
  // Only available in PHASE_2_ADVANCE. Max 1 major pending hazard at a time.
  siege_charge: {
    id: 'siege_charge',
    name: 'Siege Charge',
    archetype: 'harvester',
    apCost: 1,
    cooldown: 3,
    range: 0, // targets a direction + path, not a unit
    requiresLOS: false,
    damage: 0, // collision downs soldiers directly (see siegeCharge.js)
    targetType: 'siege_charge',
    maxRange: 5,
    desc: 'Straight line (max 5). Detonates next Enemy Phase. Destroys walls + cover. Downs soldiers in path (ignores Armor). Moves Harvester to destination.',
  },
  // --- Chapter 3: Dislocator — COME HERE! ---
  // Forced-movement ability. 1 AP, cooldown 3, range 5, LOS. Deals 3 damage
  // (armor applies, cover ignored) and pulls the target tile-by-tile toward
  // the Dislocator, stopping at the nearest valid adjacent tile. The pull
  // traverses every tile (forced movement, NOT teleport) and triggers
  // tile-entry events (mines, future Volatile Tiles) but NOT Overwatch. If
  // the damage downs/kills the target, the pull is aborted (spec 14-15). If
  // no valid adjacent tile or pull path exists, the ability is invalid — no
  // AP/cooldown/damage is spent (spec 13). See comeHereResolver.js for path
  // computation and dislocatorAi.js for AI scoring.
  come_here: {
    id: 'come_here',
    name: 'COME HERE!',
    archetype: 'dislocator',
    apCost: 1,
    cooldown: 3,
    range: 5,
    requiresLOS: true,
    damage: 3,
    targetType: 'come_here',
    affectedByArmor: true,
    desc: 'Deals 3 damage and pulls a target to the nearest valid adjacent tile.',
  },
  // Phase Shift — Phase 2 tactical reposition. 0 AP, range 4. Passes through
  // units and low cover but NOT structural walls. Triggers Overwatch. Only
  // available in PHASE_2_ADVANCE.
  phase_shift: {
    id: 'phase_shift',
    name: 'Phase Shift',
    archetype: 'warden_prime',
    apCost: 0,
    cooldown: 3,
    range: 4,
    requiresLOS: false,
    damage: 0,
    targetType: 'phase_shift', // special movement, like Stalker Phase Step
    desc: '0 AP. Reposition up to 4 tiles, passing through units. Triggers Overwatch. Phase 2 only.',
  },
};

export function getEnemyAbility(id) {
  return ENEMY_ABILITIES[id] || null;
}

export function getEnemyAbilityForArchetype(archetype) {
  return Object.values(ENEMY_ABILITIES).find((a) => a.archetype === archetype) || null;
}

// Cooldown helpers (shared field with player abilities: unit.cooldowns).
export function getEnemyCooldown(unit, abilityId) {
  return (unit && unit.cooldowns && unit.cooldowns[abilityId]) || 0;
}

export function isEnemyAbilityReady(unit, abilityId) {
  return getEnemyCooldown(unit, abilityId) === 0;
}

// Can the enemy activate this ability right now (alive + AP + cooldown)?
export function canEnemyUseAbility(unit, ability) {
  if (!unit || !unit.alive) return false;
  if (!ability) return false;
  if (unit.ap < ability.apCost) return false;
  return isEnemyAbilityReady(unit, ability.id);
}

// Valid player targets for an enemy ability (range + LOS + alive + enemy team).
export function getEnemyAbilityTargets(grid, units, enemy, ability) {
  return units.filter((u) => {
    if (!u.alive || u.team === enemy.team) return false;
    if (u.downed) return false; // skip downed soldiers
    if (gridDistance(enemy, u) > ability.range) return false;
    if (ability.requiresLOS && !hasLineOfSight(grid, enemy, u)) return false;
    return true;
  });
}

// Valid ally targets for the Bulwark's Energy Shield: self or adjacent living
// enemy-team units. The Bulwark can always shield itself.
export function getShieldTargets(units, enemy, ability) {
  const targets = units.filter((u) => {
    if (!u.alive || u.team !== enemy.team) return false;
    if (u.id === enemy.id) return true; // self is always valid
    if (gridDistance(enemy, u) > ability.range) return false;
    return true;
  });
  return targets;
}

// Valid center tiles for the Artillery's Plasma Strike: any non-blocked tile
// within Chebyshev range with LOS. The AI scores these by cluster value.
export function getPlasmaStrikeTiles(grid, enemy, ability) {
  const tiles = [];
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const t = grid[y][x];
      if (!t || t.type === 'blocked') continue;
      if (Math.max(Math.abs(x - enemy.x), Math.abs(y - enemy.y)) > ability.range) continue;
      if (ability.requiresLOS && !hasLineOfSight(grid, enemy, { x, y })) continue;
      tiles.push({ x, y });
    }
  }
  return tiles;
}

// Decrement all of an enemy unit's ability cooldowns by 1 (clamp 0). Called
// once per Enemy Phase. Returns a new unit, or the same ref if unchanged.
export function tickEnemyCooldowns(unit) {
  if (!unit || !unit.cooldowns) return unit;
  let changed = false;
  const cd = {};
  for (const [k, v] of Object.entries(unit.cooldowns)) {
    const nv = Math.max(0, v - 1);
    if (nv !== v) changed = true;
    cd[k] = nv;
  }
  return changed ? { ...unit, cooldowns: cd } : unit;
}