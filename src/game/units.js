import { TEAMS, DEFAULT_UNIT_STATS } from './constants';
import { getArchetype } from './unitTypes';
import { getWeapon } from './weapons';
import { getEliteStats } from './elite';
import { getHardenedStats } from './hardened';
import { getItem, getEffectiveMovement, getSoldierWeaponKey, getArmor } from './equipment';
import { CORE_SHIELD_MAX } from './bossState';
import { getSoldierIconKey } from './soldierIcons';

let idCounter = 0;
const nextId = (prefix) => `${prefix}_${idCounter++}`;

// Build a single unit by merging archetype stats with defaults. Weapon stats
// are derived from the structured weapon definition, not hardcoded here.
// `options.elite` overrides HP/weapon/name with the elite variant while keeping
// the base `archetype` key (so AI and abilities work unchanged).
export function makeUnit(id, team, archetypeKey, x, y, options = {}) {
  const arch = getArchetype(team, archetypeKey);
  if (!arch) throw new Error(`Unknown archetype: ${archetypeKey} for team ${team}`);

  const elite = !!options.elite;
  const hardened = !!options.hardened;
  const eliteStats = elite ? getEliteStats(archetypeKey) : null;
  const hardenedStats = hardened ? getHardenedStats(archetypeKey) : null;

  const maxHp = eliteStats
    ? eliteStats.hp
    : (hardenedStats ? hardenedStats.hp : (arch.hp ?? DEFAULT_UNIT_STATS.maxHp));
  const weaponKey = eliteStats ? eliteStats.weapon : (arch.startingWeapon || arch.weapon);
  const weapon = getWeapon(weaponKey);
  // Hardened variants keep the base weapon but deal +damageBonus (applied via
  // a per-unit weaponOverride so getUnitWeapon reads it transparently).
  const hardenedDamageBonus = hardenedStats ? (hardenedStats.damageBonus || 0) : 0;

  // Boss flags: isBoss marks the Warden (the mission objective). isBossObject
  // marks Power Relays (destructible structures that don't act in AI).
  const isBoss = !!options.isBoss;
  const isBossObject = !!options.isBossObject;
  // The Harvester (noCoreShield) has NO Core Shield — its defense is ARMOR.
  const bossHasCoreShield = isBoss && !isBossObject && !arch.noCoreShield;

  return {
    id,
    name: eliteStats ? eliteStats.name : (hardenedStats ? hardenedStats.name : arch.name),
    team,
    archetype: archetypeKey,
    elite,
    hardened,
    isBoss,
    isBossObject,
    role: arch.role,
    x,
    y,

    // Vitals
    hp: maxHp,
    maxHp,
    ap: isBossObject ? 0 : DEFAULT_UNIT_STATS.maxAp,
    maxAp: isBossObject ? 0 : DEFAULT_UNIT_STATS.maxAp,
    alive: true,

    // Movement
    movement: eliteStats ? eliteStats.movement : arch.movement,

    // Combat profile (denormalized from weapon for convenience; source of truth
    // is weapons.js via getUnitWeapon)
    weaponKey,
    weaponName: weapon ? weapon.name : null,
    weaponType: weapon ? weapon.type : null,
    weaponRange: weapon ? weapon.range : null,
    damage: weapon ? (weapon.damage + hardenedDamageBonus) : null,
    attackCost: weapon ? weapon.apCost : 1,
    // Hardened damage bonus is applied through weaponOverride so getUnitWeapon
    // (used by computeDamage) reads the bumped damage transparently.
    ...(hardenedDamageBonus > 0 && weapon ? { weaponOverride: { damage: weapon.damage + hardenedDamageBonus } } : {}),

    icon: arch.icon,

    // Phase 6: ability cooldowns (per-ability turns remaining), per-mission
    // ability uses, and active status effects (see statuses.js).
    cooldowns: {},
    abilityUses: {},
    statuses: [],

    // Phase 7: weapon ammunition (current/max) and reaction state (Overwatch).
    // Unlimited weapons (no `ammo` field) are treated as Infinity by ammo.js.
    ammo: weapon && weapon.ammo != null ? weapon.ammo : Infinity,
    reaction: null,

    // Armor: flat damage reduction. Enemies use archetype armor (Warden = 2,
    // Bastion = 4); Hardened variants override with their armor budget. Players
    // get armor from equipment. Boss objects (relays) have 0 armor.
    // currentArmor is the battle-local value that Armor Shred reduces; it starts
    // equal to base armor and resets when the unit is rebuilt (mission start /
    // restart). Base `armor` is never modified by Shred.
    armor: hardenedStats ? (hardenedStats.armor || 0) : (arch.armor || 0),
    currentArmor: hardenedStats ? (hardenedStats.armor || 0) : (arch.armor || 0),

    // Core Shield (boss only) — separate durability pool from HP and Armor.
    // Absorbs damage after Armor and Bulwark Shield, before HP. Relays have none.
    // The Harvester (noCoreShield) has NO Core Shield — its defense is ARMOR.
    coreShield: bossHasCoreShield ? CORE_SHIELD_MAX : 0,
    coreShieldMax: bossHasCoreShield ? CORE_SHIELD_MAX : 0,

    // UI state (transient)
    selected: false,
  };
}

// Convenience factories that handle ID generation.
export function makePlayer(archetypeKey, x, y) {
  return makeUnit(nextId('p'), TEAMS.PLAYER, archetypeKey, x, y);
}

// Apply persistent upgrade modifications to a tactical unit. Weapon and ability
// overrides are stored on the unit so getUnitWeapon / getUnitAbility read them
// transparently. Does not mutate global class defaults.
function applyUpgrades(unit) {
  // Skills are stored as an array of ids (freedom-first tree). Each bonus is
  // gated by the unit's current class so a Respec that changes class removes
  // all old-class effects automatically — old skill ids simply don't match.
  const upgrades = Array.isArray(unit.upgrades) ? unit.upgrades : [];
  const has = (id) => upgrades.includes(id);
  const cls = unit.archetype;
  const weapon = getWeapon(unit.weaponKey);
  const family = weapon ? weapon.family : null;
  const weaponOverride = {};
  const abilityOverride = {};

  // --- Weapon-specific skill bonuses ---
  // These apply ONLY when the equipped weapon matches the skill's weapon
  // family. A soldier can own the skill but equips a different weapon — the
  // bonus is inactive. General abilities remain usable regardless of weapon.

  // Close Quarters (Assault L2): Shotgun-family damage +1.
  if (has('close_quarters') && cls === 'assault' && family === 'shotgun') {
    weaponOverride.damage = (weapon?.damage || 0) + 1;
  }
  // Heavy Magazine (Heavy L2): LMG-family ammo +1.
  if (has('heavy_magazine') && cls === 'heavy' && family === 'lmg') {
    weaponOverride.ammo = (weapon?.ammo || 0) + 1;
  }

  // --- Ability upgrades ---
  if (has('rapid_breach') && cls === 'assault') {
    abilityOverride.breach = { cooldown: 1 };
  }
  if (has('long_dash') && cls === 'assault') {
    abilityOverride.dash = { range: 7 };
  }
  if (has('tactical_command') && cls === 'support') {
    abilityOverride.command = { cooldown: 2 };
  }
  if (has('field_medic') && cls === 'support') {
    abilityOverride.heal = { healing: 6 };
  }
  if (has('rapid_recovery') && cls === 'support') {
    abilityOverride.heal = { ...(abilityOverride.heal || {}), cooldown: 2 };
  }
  if (has('extended_command') && cls === 'support') {
    abilityOverride.command = { ...(abilityOverride.command || {}), range: 7 };
  }

  // --- Heavy Demolitions upgrades (Launch Rocket) ---
  // Bigger Boom (L2): Rocket blast area 3×3 → 5×5 (areaRadius 1 → 2).
  if (has('bigger_boom') && cls === 'heavy') {
    abilityOverride.launch_rocket = { ...(abilityOverride.launch_rocket || {}), areaRadius: 2 };
  }
  // More Boom (L4): +1 Rocket use per battle (1 → 2).
  if (has('more_boom') && cls === 'heavy') {
    abilityOverride.launch_rocket = { ...(abilityOverride.launch_rocket || {}), usesPerMission: 2 };
  }
  // Further Boom (L6): Rocket range 5 → 10.
  if (has('further_boom') && cls === 'heavy') {
    abilityOverride.launch_rocket = { ...(abilityOverride.launch_rocket || {}), range: 10 };
  }
  // Stronger Boom (L8): Rocket unit damage 3 → 5 (terrain damage stays 4).
  if (has('stronger_boom') && cls === 'heavy') {
    abilityOverride.launch_rocket = { ...(abilityOverride.launch_rocket || {}), damage: 5 };
  }
  // --- Engineer upgrades (new tiers) ---
  if (has('reinforced_construction') && cls === 'engineer') {
    abilityOverride.deploy_barricade = { ...(abilityOverride.deploy_barricade || {}), barricadeHp: 6 };
  }
  if (has('rapid_deployment') && cls === 'engineer') {
    abilityOverride.deploy_barricade = { ...(abilityOverride.deploy_barricade || {}), cooldown: 2 };
  }
  // Remote Placement (L4): Explosive Mine placement range 5 → 7.
  if (has('remote_placement') && cls === 'engineer') {
    abilityOverride.shock_mine = { ...(abilityOverride.shock_mine || {}), range: 7 };
  }
  // Overcharged Mine (L6): Explosive Mine damage 2 → 4.
  if (has('overcharged_mine') && cls === 'engineer') {
    abilityOverride.shock_mine = { ...(abilityOverride.shock_mine || {}), damage: 4 };
  }
  // Extended Works (L6): max active barricades 2 → 3.
  if (has('extended_works') && cls === 'engineer') {
    abilityOverride.deploy_barricade = { ...(abilityOverride.deploy_barricade || {}), maxActive: 3 };
  }
  // Instant Fortification (L10 capstone): Deploy Barricade 0 AP, cooldown 1.
  if (has('instant_fortification') && cls === 'engineer') {
    abilityOverride.deploy_barricade = { ...(abilityOverride.deploy_barricade || {}), apCost: 0, cooldown: 1 };
  }
  // Agent Provocateur (L10 capstone): Explosive Mine placement 0 AP.
  if (has('agent_provocateur') && cls === 'engineer') {
    abilityOverride.shock_mine = { ...(abilityOverride.shock_mine || {}), apCost: 0 };
  }

  // --- Marksman upgrades (new tiers) ---
  // High-Caliber Rounds (L2): Sniper Rifle-family damage +1.
  if (has('high_caliber_rounds') && cls === 'marksman' && family === 'sniper_rifle') {
    weaponOverride.damage = (weapon?.damage || 0) + 1;
  }
  // Extended Magazine (L2): Sniper Rifle-family ammo +1.
  if (has('extended_magazine') && cls === 'marksman' && family === 'sniper_rifle') {
    weaponOverride.ammo = (weapon?.ammo || 0) + 1;
  }
  if (has('rapid_reposition') && cls === 'marksman') {
    abilityOverride.relocate = { cooldown: 2 };
  }
  if (has('patient_aim') && cls === 'marksman') {
    abilityOverride.line_up = { cooldown: 1 };
  }
  // Snap Shooter (L6 Hunter): remove the Sniper Rifle-family close-range
  // penalty by raising closeRangeDamage to the normal damage value.
  if (has('snap_shooter') && cls === 'marksman' && family === 'sniper_rifle') {
    const baseDmg = weaponOverride.damage ?? (weapon?.damage || 5);
    weaponOverride.closeRangeDamage = baseDmg;
  }
  // Long Relocate (L8 Hunter): Relocate range 3 → 5.
  if (has('long_relocate') && cls === 'marksman') {
    abilityOverride.relocate = { ...(abilityOverride.relocate || {}), range: 5 };
  }
  // Perfect Shot (L10 capstone): Line Up 0 AP.
  if (has('perfect_shot') && cls === 'marksman') {
    abilityOverride.line_up = { ...(abilityOverride.line_up || {}), apCost: 0 };
  }

  if (Object.keys(weaponOverride).length > 0) {
    unit.weaponOverride = weaponOverride;
    if (weaponOverride.damage != null) unit.damage = weaponOverride.damage;
    if (weaponOverride.ammo != null) unit.ammo = weaponOverride.ammo;
  }
  if (Object.keys(abilityOverride).length > 0) {
    unit.abilityOverride = abilityOverride;
  }
  return unit;
}

// Create a tactical player unit from a persistent soldier record. The unit
// inherits HP, level, upgrades, and identity from the soldier. The equipped
// weapon (universal — any class, any player weapon) overrides the archetype
// default. AP, cooldowns, ammo, and battle statuses are mission-local.
export function makePlayerFromSoldier(soldier, x, y) {
  const unit = makePlayer(soldier.class, x, y);
  // Universal weapon: use the soldier's equipped weapon, or the class default.
  const weaponKey = getSoldierWeaponKey(soldier) || unit.weaponKey;
  const weapon = getWeapon(weaponKey);
  unit.weaponKey = weaponKey;
  unit.weaponName = weapon ? weapon.name : null;
  unit.weaponType = weapon ? weapon.type : null;
  unit.weaponRange = weapon ? weapon.range : null;
  unit.damage = weapon ? weapon.damage : null;
  unit.ammo = weapon && weapon.ammo != null ? weapon.ammo : Infinity;

  unit.soldierId = soldier.id;
  unit.name = soldier.name;
  unit.callsign = soldier.callsign;
  unit.hp = soldier.current_hp;
  unit.maxHp = soldier.max_hp;
  unit.level = soldier.level;
  unit.xp = soldier.xp;
  unit.upgrades = Array.isArray(soldier.upgrades) ? soldier.upgrades : [];
  unit.iconColor = soldier.icon_color || null;
  unit.icon = getSoldierIconKey(soldier);
  // Downed / Revive state (mission-local)
  unit.downed = false;
  unit.bleedOut = null;
  unit.recovering = false;
  unit.momentumUsed = false;
  // Mission-local statistics (committed at mission end)
  unit.missionKills = 0;
  unit.missionEliteKills = 0;
  unit.missionDowned = false;
  unit.missionRevives = 0;
  applyUpgrades(unit);
  applyEquipment(unit, soldier);
  // currentArmor starts at the final equipped armor value (after equipment
  // overrides). Armor Shred reduces this during battle; it resets on rebuild.
  unit.currentArmor = unit.armor;
  return unit;
}

// Apply equipped equipment modifiers to a tactical unit. Modifiers are dynamic
// — they adjust the unit's combat stats without touching the soldier's base
// data. Weapon movement modifier + Armor maxHp + Mobility Kit movement + Ammo
// Rig ammo + Field Medkit ability. The movement calculation follows:
//   FINAL = Base + Weapon Mod + Armor Mod (future) + Utility Mod
// Minimum 1 (unless explicitly immobilized by a future status).
function applyEquipment(unit, soldier) {
  // Armor: flat damage reduction (no longer adds Max HP)
  const armorItem = getArmor(soldier.equipped_armor);
  unit.armor = armorItem ? armorItem.finalArmor : 0;
  unit.armorName = armorItem ? armorItem.name : null;
  unit.armorMovementModifier = armorItem ? armorItem.movementModifier : 0;

  // Weapon movement modifier + Armor movement modifier + Utility movement bonus.
  // unit.movement is the archetype base (5); getEffectiveMovement adds all
  // equipment modifiers dynamically.
  unit.movement = getEffectiveMovement(unit.movement, soldier);

  // Utility items (ammo bonus + ability grant + passive combat flags).
  // Mission-local utility state (reactivePlatingAvailable, autoLoaderUsed,
  // sprintHarnessActive) is initialized here so it resets every mission and on
  // restart — makePlayerFromSoldier builds a fresh unit each time.
  unit.utilityId = soldier.equipped_utility || null;
  const util = soldier.equipped_utility ? getItem(soldier.equipped_utility) : null;
  if (util) {
    if (util.ammoBonus) {
      const weapon = getWeapon(unit.weaponKey);
      if (weapon && weapon.ammo != null) {
        unit.weaponOverride = unit.weaponOverride || {};
        const baseAmmo = unit.weaponOverride.ammo ?? weapon.ammo;
        unit.weaponOverride.ammo = baseAmmo + util.ammoBonus;
        unit.ammo = unit.weaponOverride.ammo;
      }
    }
    if (util.grantsAbility) {
      unit.equipmentAbilities = [util.grantsAbility];
    }
    // Armor Piercing Rounds: basic weapon attacks ignore 1 Armor (read by computeDamage).
    if (util.armorPierce) unit.armorPierce = util.armorPierce;
    // Reactive Plating: first direct attack each Enemy Phase reduced by 2.
    if (util.reactivePlating) {
      unit.reactivePlating = util.reactivePlating;
      unit.reactivePlatingAvailable = true;
    }
    // Auto-Loader: first Reload each mission costs 0 AP.
    if (util.autoLoader) {
      unit.autoLoader = true;
      unit.autoLoaderUsed = false;
    }
  }
  return unit;
}

export function makeEnemy(archetypeKey, x, y, options = {}) {
  return makeUnit(nextId('e'), TEAMS.ENEMY, archetypeKey, x, y, options);
}

// Create a boss object unit (Power Relay). Boss objects are enemy-team units
// with isBossObject = true. They have HP and can be targeted/destroyed, but
// have no weapon, no movement, and 0 AP — they never act in the enemy phase.
// The `bossObjectId` identifies which relay this is ('relayA' or 'relayB').
export function makeBossObject(obj) {
  const unit = makeEnemy('power_relay', obj.x, obj.y, { isBossObject: true });
  unit.bossObjectId = obj.id;
  unit.hp = obj.hp;
  unit.maxHp = obj.hp;
  return unit;
}

// Civilian entity for Rescue missions. Not a combat unit: no HP/AP/weapon, does
// not block movement, and is not targeted by enemy AI. After Rescue it attaches
// to an escorting player unit and tracks their position.
export function makeCivilian(x, y) {
  return {
    id: nextId('civ'),
    x,
    y,
    rescued: false,
    escortId: null,
    safe: false,
  };
}

// Initial deployment for the test battlefield.
// Player: 3 units on the bottom row. Enemy: 3 grunts, 1 rusher, 1 support.
export function createInitialUnits() {
  const units = [
    // Player team (bottom, y = 13)
    makeUnit(nextId('p'), TEAMS.PLAYER, 'assault', 4, 13),
    makeUnit(nextId('p'), TEAMS.PLAYER, 'heavy', 2, 13),
    makeUnit(nextId('p'), TEAMS.PLAYER, 'support', 6, 13),

    // Enemy team (top, y = 0..1)
    makeUnit(nextId('e'), TEAMS.ENEMY, 'grunt', 2, 0),
    makeUnit(nextId('e'), TEAMS.ENEMY, 'grunt', 6, 0),
    makeUnit(nextId('e'), TEAMS.ENEMY, 'grunt', 4, 0),
    makeUnit(nextId('e'), TEAMS.ENEMY, 'rusher', 4, 1),
    makeUnit(nextId('e'), TEAMS.ENEMY, 'support', 1, 1),
  ];
  return units;
}

export function getUnitAt(units, x, y) {
  return units.find((u) => u.alive && u.x === x && u.y === y) || null;
}