// Centralized runtime skill-effect helpers for Level 2–10 skill trees.
// This module is the single source of truth for skill-driven combat modifiers
// so checks are NOT scattered across UI/Battle files. It is intentionally
// dependency-free from combat.js (avoids a circular import): it reads unit
// fields directly and inlines the small bits of positional logic it needs.
//
// Three categories of help live here:
//   1. Outgoing damage bonuses (getSkillDamageBonus) — called by computeDamage
//      and getBreachOutcome so preview + resolution stay identical.
//   2. Temporary per-phase skill state (unit.skillState) + phase reset.
//   3. Kill triggers, ability AP overrides, and incoming-damage reduction.

import { COVER_TYPES } from './constants';
import { applyStatus, STATUS_TYPES, abilityApPenalty } from './statuses';

// --- Skill membership ---
export function hasSkill(unit, id) {
  if (!unit || !unit.upgrades) return false;
  return Object.values(unit.upgrades).includes(id);
}

// --- Outgoing damage bonuses ---
// ctx: { kind: 'basic'|'breach', weapon, state, ignoreCover, isGrenade }
// `state` is the cover state computed by the caller ('exposed'|'covered'|'flanked').
// Returns extra damage to add AFTER cover/suppressed/marked, BEFORE floor/clamp.
export function getSkillDamageBonus(attacker, target, ctx) {
  if (!attacker) return 0;
  const ss = attacker.skillState || {};
  let bonus = 0;

  // Shock Entry (Assault Breacher L6): post-Dash, next Shotgun-family/Breach +2.
  if (hasSkill(attacker, 'shock_entry') && ss.shockEntryReady) {
    const isShotgun = ctx.weapon && ctx.weapon.family === 'shotgun';
    if (ctx.kind === 'breach' || isShotgun) bonus += 2;
  }
  // Deadeye (Marksman Sharpshooter L6): Line Up vs a covered target +2.
  if (hasSkill(attacker, 'deadeye') && ctx.ignoreCover && ctx.state === 'covered') {
    bonus += 2;
  }
  // Executioner (Marksman Sharpshooter L8): Sniper Rifle-family vs ≤50% HP target +2.
  if (
    hasSkill(attacker, 'executioner') &&
    ctx.weapon && ctx.weapon.family === 'sniper_rifle' &&
    target && target.maxHp > 0 && target.hp <= target.maxHp * 0.5
  ) {
    bonus += 2;
  }
  // Sustained Fire (Heavy Gunner L8): exactly the 2nd LMG-family attack vs the
  // same target this phase gains +2 (count === 1 means 1 prior attack made).
  if (
    hasSkill(attacker, 'sustained_fire') &&
    ctx.weapon && ctx.weapon.family === 'lmg' &&
    ss.sustainedFireCount === 1 && ss.sustainedFireTargetId === (target && target.id)
  ) {
    bonus += 2;
  }
  // Chain Hunter (Marksman Hunter L10): +2 next Sniper Rifle-family attack after a relocate-kill.
  if (
    hasSkill(attacker, 'chain_hunter') && ss.chainHunterBonus &&
    ctx.weapon && ctx.weapon.family === 'sniper_rifle'
  ) {
    bonus += 2;
  }
  // Coordinated Strike (Support Commander L8): the buffed ally's next attack +2.
  if (attacker.coordinatedStrike) bonus += 2;

  return bonus;
}

// --- Temporary per-phase skill state ---
export const DEFAULT_SKILL_STATE = {
  shockEntryReady: false,     // Assault Breacher L6
  evasiveActive: false,       // Assault Vanguard L6
  evasiveUsed: false,
  hitAndRunAvailable: false,  // Assault Vanguard L8
  hitAndRunUsed: false,
  executionWindowUsed: false, // Assault Breacher L8
  roomClearerReady: false,    // Assault Breacher L10
  roomClearerUsed: false,
  blitzUsed: false,           // Assault Vanguard L10
  sustainedFireTargetId: null,// Heavy Gunner L8
  sustainedFireCount: 0,
  sustainedFireResetOnNewTarget: false,
  lockdownUsed: false,        // Heavy Gunner L10
  pinDownFired: {},            // Heavy Gunner L6 — enemyId -> true
  commandNetworkUsed: false,  // Support Commander L10
  longRelocateProtect: false, // Marksman Hunter L8
  longRelocateUsed: false,
  chainHunterBonus: false,    // Marksman Hunter L10
  chainHunterRefreshed: false,
  relocateUsedThisPhase: false,
  tilesMovedThisPhase: 0,     // Assault Vanguard L6 (Evasive Advance)
};

export function getSkillState(unit) {
  return { ...DEFAULT_SKILL_STATE, ...((unit && unit.skillState) || {}) };
}

export function setSkillState(unit, patch) {
  return { ...unit, skillState: { ...getSkillState(unit), ...patch } };
}

// Reset all per-Player-Phase skill state. Called when a new Player Phase begins.
export function resetSkillStateForPlayerPhase(unit) {
  if (!unit || !unit.skillState) return unit;
  // Keep only fields that persist across phases (none currently — all are per-phase).
  return { ...unit, skillState: { ...DEFAULT_SKILL_STATE } };
}

// --- Movement tracking (Evasive Advance) ---
// Call after any player movement (move/dash/relocate). `tiles` = path length.
export function onPlayerMove(unit, tiles) {
  if (!unit || !unit.team || unit.team !== 'player') return unit;
  const ss = getSkillState(unit);
  const newCount = (ss.tilesMovedThisPhase || 0) + tiles;
  const patch = { tilesMovedThisPhase: newCount };
  // Evasive Advance: moving 5+ tiles activates damage reduction.
  if (hasSkill(unit, 'evasive_advance') && newCount >= 5 && !ss.evasiveUsed && !ss.evasiveActive) {
    patch.evasiveActive = true;
  }
  return setSkillState(unit, patch);
}

// --- Dash → Shock Entry ---
export function onDashUsed(unit) {
  if (!hasSkill(unit, 'shock_entry')) return unit;
  return setSkillState(unit, { shockEntryReady: true });
}

// Consume Shock Entry after a Shotgun/Breach attack.
export function consumeShockEntry(unit) {
  if (!unit.skillState || !unit.skillState.shockEntryReady) return unit;
  return setSkillState(unit, { shockEntryReady: false });
}

// --- Sustained Fire tracking ---
// Call before/after an LMG-family basic attack. `targetId` = the attacked unit.
// Returns a new unit with updated sustained-fire tracking.
export function trackSustainedFire(unit, targetId, isLmgFamily) {
  if (!hasSkill(unit, 'sustained_fire') || !isLmgFamily) return unit;
  const ss = getSkillState(unit);
  if (ss.sustainedFireTargetId === targetId) {
    // Same target: this is the 2nd+ attack; increment count (bonus applies at >=1
    // meaning the 2nd attack). Reset count after the 2nd so a 3rd doesn't keep it.
    return setSkillState(unit, { sustainedFireCount: ss.sustainedFireCount + 1 });
  }
  // New target: reset tracking to this target, count starts at 0 (first attack).
  return setSkillState(unit, { sustainedFireTargetId: targetId, sustainedFireCount: 0 });
}

// Reset sustained fire when a different action breaks the chain (move/ability).
export function resetSustainedFire(unit) {
  if (!unit.skillState || unit.skillState.sustainedFireTargetId == null) return unit;
  return setSkillState(unit, { sustainedFireTargetId: null, sustainedFireCount: 0 });
}

// --- Relocate tracking (Chain Hunter) ---
export function onRelocateUsed(unit) {
  const ss = getSkillState(unit);
  return setSkillState(unit, { relocateUsedThisPhase: true, relocateAvailable: true });
}

// --- Kill triggers ---
// ctx: { weapon, isBreach, distance }
// Returns { unit, apBonus, popups } — caller writes `unit` and fires popups.
export function applyKillEffects(attacker, target, ctx) {
  if (!attacker) return { unit: attacker, apBonus: 0, popups: [] };
  let u = attacker;
  const ss = getSkillState(u);
  let apBonus = 0;
  const popups = [];

  // Execution Window (Assault Breacher L8): first close kill per phase → +1 AP.
  if (hasSkill(u, 'execution_window') && !ss.executionWindowUsed && (ctx.distance ?? 99) <= 2) {
    ss.executionWindowUsed = true;
    apBonus += 1;
    popups.push({ kind: 'ap', amount: 1 });
  }
  // Blitz (Assault Vanguard L10): first kill per phase → refresh Dash cooldown.
  if (hasSkill(u, 'blitz') && !ss.blitzUsed) {
    ss.blitzUsed = true;
    if (u.cooldowns && u.cooldowns.dash > 0) {
      u = { ...u, cooldowns: { ...u.cooldowns, dash: 0 } };
      popups.push({ kind: 'status', text: 'DASH READY' });
    }
  }
  // Room Clearer (Assault Breacher L10): Breach kill → next Shotgun 0 AP.
  if (hasSkill(u, 'room_clearer') && ctx.isBreach && !ss.roomClearerUsed) {
    ss.roomClearerReady = true;
    ss.roomClearerUsed = true;
  }
  // Chain Hunter (Marksman Hunter L10): after Relocate, first kill → refresh + bonus.
  if (hasSkill(u, 'chain_hunter') && ss.relocateUsedThisPhase && !ss.chainHunterRefreshed) {
    ss.chainHunterRefreshed = true;
    ss.chainHunterBonus = true;
    if (u.cooldowns && u.cooldowns.relocate > 0) {
      u = { ...u, cooldowns: { ...u.cooldowns, relocate: 0 } };
    }
    popups.push({ kind: 'status', text: 'CHAIN HUNTER' });
  }
  if (apBonus > 0) u = { ...u, ap: u.ap + apBonus };
  return { unit: { ...u, skillState: ss }, apBonus, popups };
}

// Consume the Chain Hunter damage bonus after a Precision Rifle attack.
export function consumeChainHunterBonus(unit) {
  if (!unit.skillState || !unit.skillState.chainHunterBonus) return unit;
  return setSkillState(unit, { chainHunterBonus: false });
}

// Consume Coordinated Strike after a damaging attack.
export function consumeCoordinatedStrike(unit) {
  if (!unit || !unit.coordinatedStrike) return unit;
  const next = { ...unit };
  delete next.coordinatedStrike;
  return next;
}

// --- Ability AP overrides (Lockdown, Command Network, Perfect Shot, Instant Fortification) ---
// `ability` is the resolved ability object (from getUnitAbility) with an apCost.
// Disrupted (Disruptor) adds +1 AP to every ability AFTER skill calculations —
// so a 0-AP skill (e.g. Command Network, Perfect Shot) becomes 1 AP. Basic move,
// attack, and reload are NOT abilities and keep their normal costs.
export function getAbilityApCost(unit, ability) {
  if (!ability) return 1;
  const ss = unit && unit.skillState ? unit.skillState : {};
  let cost;
  if (ability.id === 'suppress' && hasSkill(unit, 'lockdown') && !ss.lockdownUsed) cost = 0;
  else if (ability.id === 'command' && hasSkill(unit, 'command_network') && !ss.commandNetworkUsed) cost = 0;
  else if (ability.id === 'line_up' && hasSkill(unit, 'perfect_shot')) cost = 0;
  else if (ability.id === 'deploy_barricade' && hasSkill(unit, 'instant_fortification')) cost = 0;
  else if (ability.id === 'shock_mine' && hasSkill(unit, 'agent_provocateur')) cost = 0;
  else if (ability.id === 'launch_rocket' && hasSkill(unit, 'compensated_anarchists')) cost = 0;
  else cost = ability.apCost;
  // Disrupted applies after the final skill calculation.
  cost += abilityApPenalty(unit);
  return cost;
}

// Mark a once-per-phase ability use (for the 0-AP-first-use capstones).
export function markAbilityUsed(unit, abilityId) {
  if (!unit || !unit.skillState) return unit;
  const ss = { ...unit.skillState };
  let changed = false;
  if (abilityId === 'suppress' && hasSkill(unit, 'lockdown') && !ss.lockdownUsed) { ss.lockdownUsed = true; changed = true; }
  if (abilityId === 'command' && hasSkill(unit, 'command_network') && !ss.commandNetworkUsed) { ss.commandNetworkUsed = true; changed = true; }
  return changed ? { ...unit, skillState: ss } : unit;
}

// --- Incoming damage reduction (Evasive Advance, Long Relocate, Hardpoint) ---
// Returns total flat reduction for an incoming attack against `target` from `attacker`.
// Caller applies min-1 clamp after.
export function getIncomingDamageReduction(grid, units, attacker, target) {
  if (!target || target.team !== 'player') return 0;
  let reduction = 0;
  const ss = target.skillState || {};

  // Evasive Advance (Assault Vanguard L6): first hit after moving 5+ tiles.
  if (hasSkill(target, 'evasive_advance') && ss.evasiveActive && !ss.evasiveUsed) {
    reduction += 2;
  }
  // Long Relocate (Marksman Hunter L8): first hit after Relocate.
  if (hasSkill(target, 'long_relocate') && ss.longRelocateProtect && !ss.longRelocateUsed) {
    reduction += 2;
  }
  // Hardpoint (Engineer Fortifier L8): ally protected by this Engineer's barricade.
  reduction += getHardpointReduction(grid, units, attacker, target);
  // Reactive Plating (utility): first direct attack each Enemy Phase reduced
  // by 2. Only applies to direct attacks (this function is only called for
  // enemy basic attacks and damaging abilities — not Burning/Overload/hazards).
  if (target.reactivePlating && target.reactivePlatingAvailable) {
    reduction += target.reactivePlating;
  }
  return reduction;
}

// Apply (consume) the one-shot reductions after an incoming hit lands.
export function consumeIncomingReductions(target) {
  if (!target) return target;
  let next = target;
  let changed = false;
  if (target.skillState) {
    const ss = { ...target.skillState };
    if (ss.evasiveActive && !ss.evasiveUsed) { ss.evasiveUsed = true; ss.evasiveActive = false; changed = true; }
    if (ss.longRelocateProtect && !ss.longRelocateUsed) { ss.longRelocateUsed = true; ss.longRelocateProtect = false; changed = true; }
    if (changed) next = { ...next, skillState: ss };
  }
  // Reactive Plating: consumed after reducing one valid attack (once per Enemy Phase).
  if (target.reactivePlatingAvailable) {
    next = { ...next, reactivePlatingAvailable: false };
    changed = true;
  }
  return changed ? next : target;
}

// Hardpoint: returns 1 if an allied Engineer with 'hardpoint' has a deployed
// barricade that is the relevant protecting cover for this attack.
function getHardpointReduction(grid, units, attacker, target) {
  if (!grid || !target || !attacker) return 0;
  const sides = relevantSides(attacker, target);
  if (sides.length === 0) return 0;
  const tile = grid[target.y] && grid[target.y][target.x];
  if (!tile || !tile.cover) return 0;
  // Find allied engineers with hardpoint whose barricade protects this side.
  for (const u of units) {
    if (!u || !u.alive || u.team !== target.team) continue;
    if (!hasSkill(u, 'hardpoint') || !u.barricades) continue;
    for (const side of sides) {
      const c = tile.cover[side];
      if (!c || c.destroyed || c.type !== COVER_TYPES.ENGINEER_BARRICADE) continue;
      if (u.barricades.some((b) => b.x === target.x && b.y === target.y && b.dir === side)) {
        return 1;
      }
    }
  }
  return 0;
}

// Inline copy of combat.relevantCoverSides (avoids importing combat.js).
function relevantSides(attacker, target) {
  const dx = target.x - attacker.x;
  const dy = target.y - attacker.y;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  const sides = [];
  if (ax >= ay && dx !== 0) sides.push(dx > 0 ? 'w' : 'e');
  if (ay >= ax && dy !== 0) sides.push(dy > 0 ? 'n' : 's');
  return sides;
}

// --- Shatter (Heavy Demolitions L8) ---
// Given the grid BEFORE and AFTER a cover-damaging effect, return enemy unit ids
// that were protected by a cover side that was destroyed in this change and are
// valid Mark candidates. The caller applies Marked.
export function getShatterMarks(oldGrid, newGrid, units, attacker) {
  if (!hasSkill(attacker, 'shatter') || !oldGrid || !newGrid) return [];
  const marks = [];
  for (let y = 0; y < newGrid.length; y++) {
    for (let x = 0; x < newGrid[y].length; x++) {
      const oldTile = oldGrid[y] && oldGrid[y][x];
      const newTile = newGrid[y] && newGrid[y][x];
      if (!oldTile || !newTile || !oldTile.cover || !newTile.cover) continue;
      for (const dir of ['n', 's', 'e', 'w']) {
        const oc = oldTile.cover[dir];
        const nc = newTile.cover[dir];
        if (!oc || oc.destroyed) continue;
        if (!nc || !nc.destroyed) continue; // was active, now destroyed
        // This side was destroyed. Find enemies protected by it.
        for (const e of units) {
          if (!e || !e.alive || e.team === attacker.team) continue;
          if (e.x !== x || e.y !== y) continue;
          // Was this side relevant protection for some attacker? Use direction:
          // the cover protects from attacks coming from `dir` side. Mark if the
          // enemy occupied this tile.
          if (!marks.includes(e.id)) marks.push(e.id);
        }
      }
    }
  }
  return marks;
}

// Apply Marked to a list of enemy unit ids. Returns a new units array.
export function applyShatterMarks(units, enemyIds, sourceId) {
  if (!enemyIds || enemyIds.length === 0) return units;
  return units.map((u) => {
    if (!u || !u.alive || !enemyIds.includes(u.id)) return u;
    if (u.team === 'player') return u;
    return applyStatus(u, STATUS_TYPES.MARKED, { source: sourceId, turnsRemaining: 1 });
  });
}

// --- Pin Down (Heavy Gunner L6) ---
// Does this heavy have a Pin Down shot available against a moving suppressed enemy?
// `enemy` must be suppressed with source === heavy.id, heavy has ammo + LOS + range.
export function canPinDown(grid, heavy, enemy, weapon, hasAmmoFn, losFn, distFn) {
  if (!hasSkill(heavy, 'pin_down')) return false;
  if (!heavy.alive || !enemy.alive) return false;
  const ss = heavy.skillState || {};
  if (ss.pinDownFired && ss.pinDownFired[enemy.id]) return false;
  // Enemy must be suppressed by this heavy.
  if (!enemy.statuses) return false;
  const supp = enemy.statuses.find((s) => s.type === STATUS_TYPES.SUPPRESSED && s.source === heavy.id);
  if (!supp) return false;
  if (!weapon || !hasAmmoFn(heavy)) return false;
  if (distFn(heavy, enemy) > weapon.range) return false;
  if (!losFn(grid, heavy, enemy)) return false;
  return true;
}

export function markPinDownFired(heavy, enemyId) {
  if (!hasSkill(heavy, 'pin_down')) return heavy;
  const ss = getSkillState(heavy);
  return setSkillState(heavy, { pinDownFired: { ...ss.pinDownFired, [enemyId]: true } });
}

// --- Heal modifiers (Emergency Medicine, Lifeline, Stabilize) ---
// Emergency Medicine: target at ≤50% Max HP → +2 range, +2 healing.
export function getEmergencyHealRangeBonus(caster, target) {
  if (!hasSkill(caster, 'emergency_medicine')) return 0;
  if (!target || target.maxHp <= 0) return 0;
  return target.hp <= target.maxHp * 0.5 ? 2 : 0;
}

export function getEmergencyHealBonus(caster, target) {
  if (!hasSkill(caster, 'emergency_medicine')) return 0;
  if (!target || target.maxHp <= 0) return 0;
  return target.hp <= target.maxHp * 0.5 ? 2 : 0;
}

// Stabilize: a revived ally may receive Command this phase (recovering cleared).
export function stabilizeAllowsCommand(caster) {
  return hasSkill(caster, 'stabilize');
}

// Lifeline: bonus HP when healing a Downed ally. Revive is now a universal
// property of healing (any heal/medkit can target a Downed ally); Lifeline
// adds extra HP on top of the heal amount.
export const LIFELINE_REVIVE_BONUS = 2;
export function getLifelineReviveBonus(caster) {
  return hasSkill(caster, 'lifeline') ? LIFELINE_REVIVE_BONUS : 0;
}

// --- Rally (Support Commander L6) ---
export function hasRally(caster) {
  return hasSkill(caster, 'rally');
}

// --- Remote Placement (Engineer Saboteur L4) ---
// Base Explosive Mine placement range is 5; Remote Placement raises it to 7.
export function getMinePlacementRange(unit) {
  return hasSkill(unit, 'remote_placement') ? 7 : 5;
}