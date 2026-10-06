// Archetype definitions. Stats live here so balance changes don't touch
// components. Each player archetype has a `startingWeapon` (the default
// loadout — NOT a restriction; any class can equip any player weapon).
// `movement` is the base movement before weapon/equipment modifiers.
// Enemy archetypes reference a weapon key (see weapons.js).

import { getStartingWeaponKey } from './weapons';

export const PLAYER_ARCHETYPES = {
  assault: {
    name: 'Assault',
    role: 'Aggressive short-range unit',
    startingWeapon: 'shotgun',
    movement: 5,
    icon: 'swords',
  },
  heavy: {
    name: 'Heavy',
    role: 'Damage and battlefield control',
    startingWeapon: 'lmg',
    movement: 5,
    icon: 'shield',
  },
  support: {
    name: 'Support',
    role: 'Utility and team support',
    startingWeapon: 'rifle',
    movement: 5,
    icon: 'heart',
  },
  engineer: {
    name: 'Engineer',
    role: 'Battlefield construction and area control',
    startingWeapon: 'rifle',
    movement: 5,
    icon: 'wrench',
  },
  marksman: {
    name: 'Marksman',
    role: 'Long-range sight-line control',
    startingWeapon: 'sniper_rifle',
    movement: 5,
    icon: 'crosshair',
  },
};

export const ENEMY_ARCHETYPES = {
  grunt: {
    name: 'Grunt',
    role: 'Standard infantry',
    behavior: 'Cautious ranged fighter',
    weapon: 'enemy_rifle',
    movement: 5,
    hp: 6,
    icon: 'skull',
    powerCoreReward: 0,
    alienMaterialReward: 1,
    nanoCubeReward: 0,
  },
  rusher: {
    name: 'Rusher',
    role: 'Fast aggressive unit',
    behavior: 'Aggressive close-range attacker',
    weapon: 'close_assault',
    movement: 5,
    hp: 8,
    icon: 'zap',
    powerCoreReward: 0,
    alienMaterialReward: 1,
    nanoCubeReward: 0,
  },
  support: {
    name: 'Enemy Support',
    role: 'Support unit',
    behavior: 'Back-line support attacker',
    weapon: 'light_rifle',
    movement: 5,
    hp: 6,
    icon: 'shield',
    powerCoreReward: 0,
    alienMaterialReward: 1,
    nanoCubeReward: 0,
  },
  // Reserved for future deployment.
  gunner: {
    name: 'Gunner',
    role: 'Suppressive fire unit',
    weapon: 'enemy_lmg',
    movement: 3,
    hp: 6,
    icon: 'crosshair',
    powerCoreReward: 0,
    alienMaterialReward: 1,
  },
  // --- New alien archetypes ---
  bulwark: {
    name: 'Bulwark',
    role: 'Frontline Tank',
    behavior: 'Aggressive frontline tank that advances to absorb damage and shield allies',
    weapon: 'bulwark_beam',
    movement: 4,
    hp: 10,
    icon: 'bulwark',
    powerCoreReward: 0,
    alienMaterialReward: 1,
    nanoCubeReward: 0,
  },
  stalker: {
    name: 'Stalker',
    role: 'Mobile Flanker',
    behavior: 'Flanks from unexpected angles',
    weapon: 'stalker_carbine',
    movement: 7,
    hp: 6,
    icon: 'stalker',
    powerCoreReward: 0,
    alienMaterialReward: 1,
    nanoCubeReward: 0,
  },
  disruptor: {
    name: 'Disruptor',
    role: 'Ability Disruption',
    behavior: 'Disrupts soldier class abilities',
    weapon: 'disruptor_beam',
    movement: 5,
    hp: 7,
    icon: 'disruptor',
    powerCoreReward: 0,
    alienMaterialReward: 1,
    nanoCubeReward: 0,
  },
  artillery: {
    name: 'Artillery',
    role: 'Area Denial',
    behavior: 'Bombards clustered positions',
    weapon: 'artillery_beam',
    movement: 4,
    hp: 7,
    icon: 'artillery',
    powerCoreReward: 0,
    alienMaterialReward: 1,
  },
  // --- Chapter 2: Bastion Mech (armored assault / siege) ---
  // A big, slow alien combat mech. Armor 4 makes raw weapon damage matter —
  // low-damage weapons still hit for the minimum-1, but high-damage builds
  // and Laser weapons feel valuable. Its BULLDOZE ability destroys light cover
  // and rams soldiers. It does not take cover; it destroys yours.
  bastion: {
    name: 'Bastion Mech',
    role: 'Armored Assault / Siege Unit',
    behavior: 'Deliberate armored advance; breaks defensive positions',
    weapon: 'bastion_cannon',
    movement: 3,
    hp: 16,
    armor: 4,
    icon: 'bot',
    mechanical: true,
    powerCoreReward: 0,
    alienMaterialReward: 2,
    nanoCubeReward: 0,
  },
  // --- Chapter 2: Alien Fabricator (battlefield technician / engineer) ---
  // The alien equivalent of an Engineer. Not individually terrifying, but it
  // reshapes the battlefield: repairs mechanical allies (Bastion) and deploys
  // hardlight directional cover. Creates target-priority tension.
  fabricator: {
    name: 'Alien Fabricator',
    role: 'Battlefield Technician / Support',
    behavior: 'Repairs mechs and constructs alien cover',
    weapon: 'fabricator_beam',
    movement: 5,
    hp: 8,
    armor: 1,
    icon: 'factory',
    powerCoreReward: 0,
    alienMaterialReward: 2,
    nanoCubeReward: 0,
  },
  // --- Chapter 1 Boss ---
  warden_prime: {
    name: 'Warden Prime',
    role: 'Alien Commander',
    behavior: 'Boss — Chapter 1 Commander',
    weapon: 'warden_beam',
    movement: 4,
    hp: 26,
    armor: 2,
    icon: 'crown',
    powerCoreReward: 1,
    alienMaterialReward: 0,
    nanoCubeReward: 0,
  },
  // --- Chapter 2 Boss: The Harvester ---
  // ALIEN SIEGE / EXCAVATION MACHINE. A massive armored fortress. Phase 1
  // identity is ARMOR 6 — no Core Shield, no invulnerability. The player can
  // damage it immediately, but heavily armored attacks are inefficient until
  // its Armor is Shredded. HP 34, Move 3, AP 2. Weapon: Heavy Plasma Cannon
  // (range 7, damage 6). noCoreShield prevents the Warden-style Core Shield
  // from being allocated in makeUnit.
  harvester: {
    name: 'The Harvester',
    role: 'Alien Siege / Excavation Machine',
    behavior: 'Boss — Chapter 2',
    weapon: 'harvester_cannon',
    movement: 3,
    hp: 34,
    armor: 6,
    icon: 'box',
    noCoreShield: true,
    powerCoreReward: 0,
    alienMaterialReward: 0,
    nanoCubeReward: 0,
  },
  // --- Chapter 3: Flash Claw — Overwatch Breaker / Fast Melee Pursuit ---
  // A lean, fast alien predator (Move 9) designed to burn player Overwatch
  // reactions before allied units advance, then pursue isolated soldiers as
  // a melee hunter. Melee-only (Flash Claw Strike, range 1, damage 4). Tier 3-
  // equivalent Light armor (Armor 2 = Powered base 3 + Light -1) keeps it
  // durable without making it a tank. Flash Reflexes (passive) makes it immune
  // to damage from Overwatch / reaction fire — the reaction still fires and is
  // consumed, but Flash Claw takes 0 HP damage (see flashReflexes.js).
  flash_claw: {
    name: 'Flash Claw',
    role: 'Overwatch Breaker',
    behavior: 'Fast melee pursuit; burns Overwatch reactions',
    weapon: 'flash_claw_strike',
    movement: 9,
    hp: 7,
    armor: 2,
    icon: 'wind',
    passives: ['flash_reflexes'],
    powerCoreReward: 0,
    alienMaterialReward: 1,
    nanoCubeReward: 0,
  },
  // --- Chapter 3: Dislocator — Formation Breaker / Forced Movement ---
  // A tactical alien unit equipped with a gravity/tractor-style device. Its
  // signature ability COME HERE! deals 3 damage and pulls a target soldier
  // tile-by-tile toward the Dislocator, stopping at the nearest valid adjacent
  // tile. This pulls soldiers out of formation, out of cover, and into
  // isolated positions where other enemies (Flash Claw, Rusher, Executioner)
  // can exploit the disruption. Tier 3-equivalent Medium armor (Armor 3 =
  // Powered base 3 + Medium 0). HP 9, Move 5, AP 2. Beam Rifle: range 6,
  // damage 3. COME HERE!: range 5, damage 3, cooldown 3 (see enemyAbilities.js
  // + comeHereResolver.js + dislocatorAi.js).
  dislocator: {
    name: 'Dislocator',
    role: 'Formation Breaker',
    behavior: 'Pulls soldiers out of formation and cover',
    weapon: 'dislocator_beam',
    movement: 5,
    hp: 9,
    armor: 3,
    icon: 'dislocator',
    powerCoreReward: 0,
    alienMaterialReward: 1,
    nanoCubeReward: 0,
  },
  // --- Chapter 3: Executioner — Isolated-Target Hunter / Ranged Finisher ---
  // A ranged hunter that punishes soldiers who become separated from their
  // squad. Its Lone Prey passive adds +2 final damage when the target has no
  // active friendly soldier within 2 tiles (spec 9). The bonus is applied
  // after the normal Armor/defense pipeline — the base attack still goes
  // through Armor and Cover normally (spec 27). Tier 3-equivalent Medium
  // armor (Armor 3 = Powered base 3 + Medium 0). HP 9, Move 5, AP 2.
  // Execution Beam Rifle: range 7, damage 3. The Executioner has no active
  // ability — it is a pure ranged hunter. Its AI (executionerAi.js) strongly
  // prefers isolated targets but does not blindly choose terrible isolated
  // targets over overwhelmingly better normal targets (spec 18).
  executioner: {
    name: 'Executioner',
    role: 'Isolated-Target Hunter',
    behavior: 'Ranged hunter; punishes separated soldiers',
    weapon: 'executioner_beam',
    movement: 5,
    hp: 9,
    armor: 3,
    icon: 'executioner',
    passives: ['lone_prey'],
    powerCoreReward: 0,
    alienMaterialReward: 1,
    nanoCubeReward: 0,
  },
  // --- Boss objective structure ---
  power_relay: {
    name: 'Power Relay',
    role: 'Boss Objective Structure',
    behavior: 'Linked to Warden Prime',
    weapon: null,
    movement: 0,
    hp: 6,
    armor: 0,
    icon: 'atom',
    powerCoreReward: 0,
    alienMaterialReward: 0,
    nanoCubeReward: 0,
  },
};

export function getArchetype(team, key) {
  return team === 'player' ? PLAYER_ARCHETYPES[key] : ENEMY_ARCHETYPES[key];
}

// Starting weapon for a player class (delegates to weapons.js).
export function getStartingWeapon(cls) {
  return getStartingWeaponKey(cls);
}