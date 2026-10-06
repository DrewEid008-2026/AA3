// NON-MUTATING COMBAT PREVIEW.
//
// Detailed Targeting Info asks: "If this exact action were committed right now,
// what deterministic results would occur?" It reuses the SAME combat calculators
// that resolve the real attack (computeDamage / resolveFlatDamage /
// getBreachOutcome / applyShieldToDamage / applyCoreShieldToDamage /
// damageProtectingCover / damageCoverTile) — never a second formula. Terrain
// damage is simulated on a cloned grid, then diffed, so the predicted terrain
// HP matches the real result exactly. No game state is altered.

import {
  computeDamage,
  resolveFlatDamage,
  getUnitWeapon,
  COVER_STATE_LABELS,
  attackIsValid,
  ATTACK_REASONS,
} from './combat';
import {
  getBreachOutcome,
  getGrenadeAffectedEnemies,
  getBlastTiles,
  getRemainingUses,
} from './abilities';
import {
  applyShieldToDamage,
  applyCoreShieldToDamage,
} from './shield';
import { damageProtectingCover, damageCoverTile } from './cover';
import { STATUS_DEFS } from './statuses';
import { TEAMS, COVER_HP } from './constants';
import { getAbilityApCost } from './skillEffects';
import { getCurrentArmor, getBaseArmor, getAttackArmorShred } from './armorShred';
import { isSiegeDestructibleTile, getTileKindLabel } from './tileDestruction';
import { wouldBlockMission } from './terrainUtility';
import { countVolatileInPath, predictHazardDamage } from './volatileTiles';

const COVER_TYPE_LABELS = {
  barricade: 'Barricade',
  wall: 'Wall',
  engineer_barricade: 'Engineer Barricade',
  hardlight: 'Hardlight Cover',
};

// Shallow-but-sufficient grid clone: copy each row and each tile object so cover
// mutations on the clone never touch the real grid.
function cloneGrid(grid) {
  return grid.map((row) => row.map((tile) => ({ ...tile, cover: tile.cover ? { ...tile.cover } : null })));
}

function coverMaxHp(side) {
  if (side && side.maxHp != null) return side.maxHp;
  // Fallback to type defaults if maxHp wasn't stored on the cover object.
  return side ? (COVER_HP[side.type] || 0) : 0;
}

// Diff cover sides between the original grid and the simulated grid, returning
// one terrain entry per cover side whose HP changed.
function diffTerrain(originalGrid, simulatedGrid) {
  const out = [];
  for (let y = 0; y < simulatedGrid.length; y++) {
    for (let x = 0; x < simulatedGrid[y].length; x++) {
      const oTile = originalGrid[y] && originalGrid[y][x];
      const sTile = simulatedGrid[y][x];
      if (!oTile || !sTile || !oTile.cover || !sTile.cover) continue;
      for (const dir of ['n', 's', 'e', 'w']) {
        const oc = oTile.cover[dir];
        const sc = sTile.cover[dir];
        if (!oc) continue;
        if (!sc) continue;
        if (oc.hp === sc.hp && oc.destroyed === sc.destroyed) continue;
        const currentHp = oc.hp;
        const maxHp = coverMaxHp(oc);
        const predictedHp = sc.hp;
        const terrainDamage = currentHp - predictedHp;
        out.push({
          x, y, dir,
          label: `${COVER_TYPE_LABELS[oc.type] || 'Cover'} (${dir.toUpperCase()})`,
          type: oc.type,
          currentHp,
          maxHp,
          terrainDamage,
          predictedHp,
          destroyed: sc.destroyed || predictedHp <= 0,
          providesCover: !oc.destroyed,
        });
      }
    }
  }
  return out;
}

// Simulate the terrain damage a basic attack would deal, matching performAttack
// exactly: protecting cover takes 1 (if covered, not ignored), then all cover
// on the target tile takes weapon.terrainDamage (if the weapon has it).
function simulateBasicTerrain(grid, attacker, target, o, weapon, ignoreCover) {
  let g = cloneGrid(grid);
  if (o.state === 'covered' && !ignoreCover) g = damageProtectingCover(g, attacker, target, 1);
  if (weapon && weapon.terrainDamage && !ignoreCover) g = damageCoverTile(g, target.x, target.y, weapon.terrainDamage);
  return diffTerrain(grid, g);
}

// Simulate grenade blast terrain damage: every cover side on every blast tile
// takes the grenade's terrainDamage.
function simulateGrenadeTerrain(grid, blastTiles, terrainDamage) {
  let g = cloneGrid(grid);
  for (const t of blastTiles) g = damageCoverTile(g, t.x, t.y, terrainDamage);
  return diffTerrain(grid, g);
}

// Relevant combat statuses for the target, for the status summary.
function statusSummary(target, coverState) {
  const out = [];
  if (coverState && coverState !== 'exposed') out.push({ label: COVER_STATE_LABELS[coverState], tone: coverState === 'flanked' ? 'flank' : 'cover' });
  if (!target || !target.statuses) return out;
  for (const s of target.statuses) {
    const def = STATUS_DEFS[s.type];
    if (!def) continue;
    out.push({ label: def.name, tone: 'status' });
  }
  if (target.coreShield > 0) out.push({ label: 'Core Shield', tone: 'shield' });
  return out;
}

// Derive the lethal outcome from predicted HP, respecting the Downed rule for
// player soldiers (player at 0 HP → DOWNED, not KILL).
function lethalResult(target, hpAfter) {
  const lethal = hpAfter <= 0;
  if (!lethal) return { lethal: false, killed: false, downed: false };
  if (target.team === TEAMS.PLAYER) return { lethal: true, killed: false, downed: true };
  return { lethal: true, killed: true, downed: false };
}

// Apply the shield layers to a post-armor damage value, reusing the exact
// functions resolveTargetDamage uses. Returns the same fields computeDamage
// returns for shields so the preview matches resolution.
function applyShieldLayers(target, postArmorDamage) {
  const { absorbed: shieldAbsorbed, hpDamage: afterBulwark } = applyShieldToDamage(target, postArmorDamage);
  const { absorbed: coreShieldAbsorbed, hpDamage: hpDamage } = applyCoreShieldToDamage(target, afterBulwark);
  return { shieldAbsorbed, coreShieldAbsorbed, hpDamage };
}

// --- Public builders ---

// Basic weapon attack (Rifle / Shotgun / LMG / Sniper, any tier).
export function buildBasicAttackPreview({ grid, attacker, target, ignoreCover = false }) {
  const weapon = getUnitWeapon(attacker);
  const o = computeDamage(attacker, target, grid, { ignoreCover, trace: true });
  const lethal = lethalResult(target, o.hpAfter);
  const terrain = simulateBasicTerrain(grid, attacker, target, o, weapon, ignoreCover);
  return {
    kind: 'basic',
    label: weapon ? weapon.name : 'Attack',
    weaponName: weapon ? weapon.name : null,
    attacker: { id: attacker.id, name: attacker.name, team: attacker.team },
    costs: {
      ap: weapon ? weapon.apCost : 1,
      ammo: 1,
    },
    affectedUnits: [{
      unitId: target.id,
      name: target.name,
      team: target.team,
      isFriendly: target.team === attacker.team,
      hp: target.hp,
      maxHp: target.maxHp,
      armor: target.armor || 0,
      coverState: o.state,
      statuses: statusSummary(target, o.state),
      baseDamage: o.baseDamage,
      trace: o.trace,
      finalDamage: o.finalDamage,
      shieldAbsorbed: o.shieldAbsorbed,
      coreShieldAbsorbed: o.coreShieldAbsorbed,
      hpDamage: o.hpDamage,
      predictedHp: o.hpAfter,
      ...lethal,
    }],
    affectedTerrain: terrain,
    validation: { valid: true, reason: null },
  };
}

// Breach ability (Assault). Breach ignores cover; Marked + skill bonuses apply.
export function buildBreachAttackPreview({ grid, attacker, target, ability }) {
  const baseDamage = ability.damage;
  const o = getBreachOutcome(target, baseDamage, attacker, { trace: true });
  // o.damage is post-armor, pre-shield. Apply shield layers for the real result.
  const { shieldAbsorbed, coreShieldAbsorbed, hpDamage } = applyShieldLayers(target, o.damage);
  const predictedHp = Math.max(0, target.hp - hpDamage);
  const lethal = lethalResult(target, predictedHp);
  const terrain = []; // Breach does not damage terrain.
  return {
    kind: 'breach',
    label: 'Breach',
    weaponName: null,
    abilityName: 'Breach',
    attacker: { id: attacker.id, name: attacker.name, team: attacker.team },
    costs: {
      ap: getAbilityApCost(attacker, ability),
      ammo: 0,
      cooldownAfter: ability.cooldown,
    },
    affectedUnits: [{
      unitId: target.id,
      name: target.name,
      team: target.team,
      isFriendly: target.team === attacker.team,
      hp: target.hp,
      maxHp: target.maxHp,
      armor: target.armor || 0,
      coverState: 'exposed',
      statuses: statusSummary(target, 'exposed'),
      baseDamage,
      trace: o.trace,
      finalDamage: o.damage,
      shieldAbsorbed,
      coreShieldAbsorbed,
      hpDamage,
      predictedHp,
      ...lethal,
    }],
    affectedTerrain: terrain,
    validation: { valid: true, reason: null },
  };
}

// Grenade AOE. Shows every affected enemy (and allies if friendly fire applies)
// plus every affected terrain object.
export function buildGrenadePreview({ grid, units, caster, x, y, ability }) {
  const radius = ability.areaRadius;
  const blastTiles = getBlastTiles(grid, x, y, radius);
  const grenadeDamage = ability.damage ?? 3;
  const terrainDamage = ability.terrainDamage ?? 2;
  const armorShred = getAttackArmorShred(ability, null);
  const affectedEnemies = getGrenadeAffectedEnemies(units, x, y, radius);

  const affectedUnits = affectedEnemies.map((e) => {
    const startArmor = getCurrentArmor(e);
    const baseArmor = getBaseArmor(e);
    const r = resolveFlatDamage(grenadeDamage, caster, e, { trace: true });
    const { shieldAbsorbed, coreShieldAbsorbed, hpDamage } = applyShieldLayers(e, r.finalDamage);
    const predictedHp = Math.max(0, e.hp - hpDamage);
    const lethal = lethalResult(e, predictedHp);
    const armorAfter = Math.max(0, startArmor - armorShred);
    return {
      unitId: e.id,
      name: e.name,
      team: e.team,
      isFriendly: e.team === caster.team,
      hp: e.hp,
      maxHp: e.maxHp,
      armor: startArmor,
      baseArmor,
      coverState: 'exposed',
      statuses: statusSummary(e, 'exposed'),
      baseDamage: grenadeDamage,
      trace: r.trace,
      finalDamage: r.finalDamage,
      shieldAbsorbed,
      coreShieldAbsorbed,
      hpDamage,
      predictedHp,
      armorShred,
      armorAfter,
      ...lethal,
    };
  });

  const terrain = simulateGrenadeTerrain(grid, blastTiles, terrainDamage);
  const usesRemaining = getRemainingUses(caster, ability.id);

  return {
    kind: 'grenade',
    label: 'Grenade',
    weaponName: null,
    abilityName: 'Grenade',
    attacker: { id: caster.id, name: caster.name, team: caster.team },
    impact: { x, y, radius },
    costs: {
      ap: 1,
      ammo: 0,
      usesRemaining,
    },
    affectedUnits,
    affectedTerrain: terrain,
    validation: { valid: true, reason: null },
  };
}

// Launch Rocket AOE preview. Simulates the explosion non-mutatingly so the
// preview exactly matches the committed result. Each affected unit shows
// damage, Armor Shred, and predicted Armor.
export function buildRocketPreview({ grid, units, caster, x, y, ability }) {
  const radius = ability.areaRadius;
  const blastTiles = getBlastTiles(grid, x, y, radius);
  const rocketDamage = ability.damage ?? 3;
  const terrainDamage = ability.terrainDamage ?? 4;
  const armorShred = ability.armorShred ?? 2;
  const affectedEnemies = getGrenadeAffectedEnemies(units, x, y, radius);

  const affectedUnits = affectedEnemies.map((e) => {
    const baseArmor = getBaseArmor(e);
    const startArmor = getCurrentArmor(e);
    // --- Stage 1 ---
    const r1 = resolveFlatDamage(rocketDamage, caster, e, { trace: true });
    const { unit: afterShield1, absorbed: sa1, hpDamage: afterBulwark1 } = applyShieldToDamage(e, r1.finalDamage);
    const { absorbed: csa1, hpDamage: hpDmg1 } = applyCoreShieldToDamage(afterShield1, afterBulwark1);
    const hp1 = Math.max(0, e.hp - hpDmg1);
    const armorAfter1 = Math.max(0, startArmor - armorShred);
    const stage1 = {
      damage: r1.finalDamage,
      hpDamage: hpDmg1,
      shieldAbsorbed: sa1,
      coreShieldAbsorbed: csa1,
      armorShred,
      armorBefore: startArmor,
      armorAfter: armorAfter1,
      hpAfter: hp1,
      trace: r1.trace,
    };
    const lethal = hp1 <= 0;
    const killed = lethal && e.team !== TEAMS.PLAYER;
    const downed = lethal && e.team === TEAMS.PLAYER;
    return {
      unitId: e.id,
      name: e.name,
      team: e.team,
      isFriendly: e.team === caster.team,
      hp: e.hp,
      maxHp: e.maxHp,
      armor: startArmor,
      baseArmor,
      coverState: 'exposed',
      statuses: statusSummary(e, 'exposed'),
      baseDamage: rocketDamage,
      finalDamage: hpDmg1,
      shieldAbsorbed: sa1,
      coreShieldAbsorbed: csa1,
      hpDamage: hpDmg1,
      predictedHp: hp1,
      armorShred,
      armorAfter: armorAfter1,
      stage1,
      ...{ lethal, killed, downed },
    };
  });

  // Terrain: simulate both stages on a cloned grid.
  let simGrid = cloneGrid(grid);
  for (const t of blastTiles) simGrid = damageCoverTile(simGrid, t.x, t.y, terrainDamage);
  const terrain = diffTerrain(grid, simGrid);

  const usesRemaining = getRemainingUses(caster, 'launch_rocket');

  return {
    kind: 'rocket',
    label: 'Launch Rocket',
    weaponName: null,
    abilityName: 'Launch Rocket',
    attacker: { id: caster.id, name: caster.name, team: caster.team },
    impact: { x, y, radius },
    costs: {
      ap: getAbilityApCost(caster, ability),
      ammo: 0,
      usesRemaining,
      cooldownAfter: ability.cooldown || 1,
    },
    affectedUnits,
    affectedTerrain: terrain,
    validation: { valid: true, reason: null },
  };
}

// --- Terrain-manipulation utility previews ---
//
// Wall Charge: TARGET WALL → WALL DESTROYED / OPEN GROUND / MOVEMENT OPEN /
// LOS OPEN. Non-mutating; reads the tile's Siege-destructible state.
export function buildWallChargePreview({ grid, caster, x, y, ability }) {
  const tile = grid[y] && grid[y][x];
  const valid = isSiegeDestructibleTile(tile);
  return {
    kind: 'wall_charge',
    label: 'Wall Charge',
    abilityName: 'Wall Charge',
    target: { x, y, tileKind: valid ? getTileKindLabel(tile) : 'Invalid' },
    result: valid
      ? { destroyed: true, becomesOpen: true, movementOpen: true, losOpen: true }
      : { destroyed: false, becomesOpen: false, movementOpen: false, losOpen: false },
    costs: {
      ap: getAbilityApCost(caster, ability),
      usesRemaining: getRemainingUses(caster, 'wall_charge'),
    },
    validation: { valid, reason: valid ? null : 'Not a Siege-destructible wall' },
  };
}

// Insta-Wall Cement: NEW WALL → BLOCKS MOVEMENT / BLOCKS LOS. Validates the
// tile is empty ground and the placement doesn't break mission connectivity.
export function buildInstaWallPreview({ grid, units, caster, x, y, ability, missionContext }) {
  const tile = grid[y] && grid[y][x];
  const isOpen = tile && tile.type === 'open';
  let reason = null;
  if (!isOpen) reason = 'Tile is not open ground';
  else if (wouldBlockMission(grid, units, x, y, missionContext.missionConfig, missionContext.civilian, missionContext.device, missionContext.extractionZone)) {
    reason = 'Would block the mission objective';
  }
  const valid = !reason;
  return {
    kind: 'insta_wall',
    label: 'Insta-Wall Cement',
    abilityName: 'Insta-Wall Cement',
    target: { x, y },
    result: { blocksMovement: true, blocksLOS: true },
    costs: {
      ap: getAbilityApCost(caster, ability),
      usesRemaining: getRemainingUses(caster, 'insta_wall_cement'),
    },
    validation: { valid, reason },
  };
}

// Disruptor Hook: pull enemy to nearest valid adjacent tile. Previews target,
// pull distance, final adjacent destination, volatile ground hazard damage,
// and whether any player mines will trigger.
export function buildDisruptorHookPreview({ grid, attacker, target, pull, mines }) {
  const hazardCount = countVolatileInPath(pull.path, grid);
  const hazardDamage = predictHazardDamage(pull.path, grid);
  const minesCrossed = (mines || []).filter((m) =>
    pull.path.slice(1).some(([px, py]) => px === m.x && py === m.y)
  );

  return {
    kind: 'disruptor_hook',
    label: 'Disruptor Hook',
    attacker,
    target,
    path: pull.path,
    destination: pull.destination,
    pullDistance: pull.tilesMoved,
    hazardCount,
    hazardDamage,
    minesCount: minesCrossed.length,
    willTriggerMine: minesCrossed.length > 0,
    targetName: target.name || target.archetype || 'Enemy',
    targetArchetype: target.archetype,
    targetHp: target.hp,
    targetMaxHp: target.maxHp,
    targetArmor: target.currentArmor ?? target.armor ?? 0,
  };
}

export { attackIsValid, ATTACK_REASONS };