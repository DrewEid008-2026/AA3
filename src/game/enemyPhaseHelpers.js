// Helper functions extracted from Battle.jsx to keep the page file manageable.
// These are pure functions that don't depend on component state.

import { TEAMS } from './constants';
import {
  gridDistance, hasLineOfSight, getUnitWeapon,
} from './combat';
import { hasAmmo } from './ammo';
import { isInOverwatch } from './reactions';
import { STATUS_TYPES } from './statuses';
import { hasSkill } from './skillEffects';
import { enterDowned } from './downed';
import { applyShieldToDamage, applyCoreShieldToDamage } from './shield';

// Living player Overwatch units with a valid shot at (tx,ty) against the moving
// enemy. Deterministic order (by unit id) so multi-unit reactions resolve
// consistently and stop early once the target dies.
export function collectOverwatchShooters(grid, units, targetId, tx, ty) {
  const target = units.find((u) => u.id === targetId);
  if (!target) return [];
  const shooters = units.filter((u) => {
    if (!u.alive || u.team !== TEAMS.PLAYER) return false;
    if (!isInOverwatch(u)) return false;
    if (!hasAmmo(u)) return false;
    const weapon = getUnitWeapon(u);
    if (!weapon) return false;
    const simTarget = { ...target, x: tx, y: ty };
    if (gridDistance(u, simTarget) > weapon.range) return false;
    if (!hasLineOfSight(grid, u, simTarget)) return false;
    return true;
  });
  return shooters.sort((a, b) => (a.id < b.id ? -1 : 1));
}

// Pin Down (Heavy Gunner L6): a Heavy with pin_down auto-fires a free reaction
// shot at a Suppressed enemy (suppressed by that heavy) that moves into a tile
// in range + LOS. Once per heavy per enemy per phase. No AP cost; costs 1 ammo.
export function collectPinDownShooters(grid, units, targetId, tx, ty) {
  const target = units.find((u) => u.id === targetId);
  if (!target || !target.alive) return [];
  if (!target.statuses || !target.statuses.some((s) => s.type === STATUS_TYPES.SUPPRESSED)) return [];
  const simTarget = { ...target, x: tx, y: ty };
  const shooters = units.filter((u) => {
    if (!u.alive || u.team !== TEAMS.PLAYER) return false;
    if (!hasSkill(u, 'pin_down')) return false;
    if (!hasAmmo(u)) return false;
    const ss = u.skillState || {};
    if (ss.pinDownFired && ss.pinDownFired[target.id]) return false;
    const supp = target.statuses.find((s) => s.type === STATUS_TYPES.SUPPRESSED && s.source === u.id);
    if (!supp) return false;
    const weapon = getUnitWeapon(u);
    if (!weapon) return false;
    if (gridDistance(u, simTarget) > weapon.range) return false;
    if (!hasLineOfSight(grid, u, simTarget)) return false;
    return true;
  });
  return shooters.sort((a, b) => (a.id < b.id ? -1 : 1));
}

// Unified damage resolution. Player units at 0 HP enter Downed state instead of
// dying; enemy units die normally. Shield (Bulwark) absorbs damage before HP.
// Returns { unit, killed, downed, shieldAbsorbed } so callers can fire popups,
// track kills, and update mission-local stats.
export function resolveTargetDamage(target, damage) {
  if (!target || !target.alive || target.downed) {
    return { unit: target, killed: false, downed: false, shieldAbsorbed: 0, coreShieldAbsorbed: 0 };
  }
  // Damage pipeline: Bulwark Energy Shield → Core Shield → HP.
  // Armor is applied upstream by computeDamage / resolveFlatDamage.
  const { unit: shielded, absorbed: bulwarkAbsorbed, hpDamage: afterBulwark } = applyShieldToDamage(target, damage);
  const { unit: coreShielded, absorbed: coreAbsorbed, hpDamage: finalHpDamage } = applyCoreShieldToDamage(shielded, afterBulwark);
  const hp = Math.max(0, coreShielded.hp - finalHpDamage);
  if (hp <= 0) {
    if (coreShielded.team === TEAMS.PLAYER) {
      return { unit: enterDowned(coreShielded), killed: false, downed: true, shieldAbsorbed: bulwarkAbsorbed, coreShieldAbsorbed: coreAbsorbed };
    }
    return { unit: { ...coreShielded, hp: 0, alive: false }, killed: true, downed: false, shieldAbsorbed: bulwarkAbsorbed, coreShieldAbsorbed: coreAbsorbed };
  }
  return { unit: { ...coreShielded, hp }, killed: false, downed: false, shieldAbsorbed: bulwarkAbsorbed, coreShieldAbsorbed: coreAbsorbed };
}