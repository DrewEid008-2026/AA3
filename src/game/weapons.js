// Universal weapon system: 4 families × 3 technology tiers = 12 player weapons.
// Any class can equip any player weapon. Class identity comes from abilities
// and skill trees, not forced weapon assignments.
//
// Weapon stats are DATA-DRIVEN from family base stats + tier damage bonus:
//   FINAL BASE DAMAGE = Family Base Damage + Tier Damage Bonus
// Tier only improves damage — range, ammo, terrain damage, and movement
// modifier stay constant within a family across all tiers.
//
// `presentation` classifies how an attack from this weapon is shown visually
// (ballistic vs beam). Player weapons are no longer universally ballistic —
// Laser and Plasma tiers use beam presentation. See attackPresentation.js.
//
// `ammo` is magazine capacity (attacks before reload). Omit for unlimited.
// `movementModifier` reduces normal Move range (applied dynamically, never
// baked into base movement). LMG and Sniper Rifle impose -2 movement.

// --- Weapon Families (base stats) ---
export const WEAPON_FAMILIES = {
  rifle: {
    family: 'rifle',
    name: 'Rifle',
    baseDamage: 3,
    range: 7,
    ammo: 3,
    terrainDamage: 2,
    movementModifier: 0,
  },
  shotgun: {
    family: 'shotgun',
    name: 'Shotgun',
    baseDamage: 5,
    range: 4,
    ammo: 2,
    terrainDamage: 3,
    movementModifier: 0,
  },
  lmg: {
    family: 'lmg',
    name: 'LMG',
    baseDamage: 4,
    range: 6,
    ammo: 5,
    terrainDamage: 3,
    movementModifier: -2,
  },
  sniper_rifle: {
    family: 'sniper_rifle',
    name: 'Sniper Rifle',
    baseDamage: 4,
    range: 10,
    ammo: 2,
    terrainDamage: 2,
    movementModifier: -2,
    closeRangeDamage: 2,       // reduced damage at close range (≤ threshold)
    closeRangeThreshold: 2,
  },
};

// --- Technology Tiers (damage bonus + presentation) ---
// Tier 0 Conventional (+0 damage)
// Tier 1 Laser (+1 damage)
// Tier 2 Plasma (+2 damage)
// Tier 3 Nano (+3 damage)
export const WEAPON_TIERS = {
  conventional: { tier: 0, key: 'conventional', name: 'Conventional', damageBonus: 0, presentation: 'ballistic' },
  laser:        { tier: 1, key: 'laser',        name: 'Laser',        damageBonus: 1, presentation: 'beam' },
  plasma:       { tier: 2, key: 'plasma',       name: 'Plasma',       damageBonus: 2, presentation: 'beam' },
  nano:         { tier: 3, key: 'nano',         name: 'Nano',         damageBonus: 3, presentation: 'beam' },
};

// Centralized helper to get weapon tier damage bonus
export function getWeaponTierBonus(tier) {
  const entry = Object.values(WEAPON_TIERS).find((t) => t.tier === tier);
  return entry ? entry.damageBonus : Math.max(0, tier || 0);
}

// Build a single player weapon definition from family + tier.
function buildPlayerWeapon(familyKey, tierKey) {
  const f = WEAPON_FAMILIES[familyKey];
  const t = WEAPON_TIERS[tierKey];
  const id = tierKey === 'conventional' ? familyKey : `${tierKey}_${familyKey}`;
  const name = `${t.name} ${f.name}`;
  const damage = f.baseDamage + t.damageBonus;
  const def = {
    id,
    name,
    type: familyKey,       // family key (used for presentation overrides + skill checks)
    family: familyKey,
    tier: t.tier,
    tierName: t.name,
    range: f.range,
    damage,
    apCost: 1,
    ammo: f.ammo,
    reloadApCost: 1,
    terrainDamage: f.terrainDamage,
    movementModifier: f.movementModifier,
    presentation: t.presentation,
    isPlayerWeapon: true,
  };
  if (f.closeRangeDamage != null) {
    def.closeRangeDamage = f.closeRangeDamage + t.damageBonus;
    def.closeRangeThreshold = f.closeRangeThreshold;
  }
  return def;
}

// --- Generate all 16 universal player weapons (4 families × 4 tiers) ---
const PLAYER_WEAPONS = {};
for (const fKey of Object.keys(WEAPON_FAMILIES)) {
  for (const tKey of Object.keys(WEAPON_TIERS)) {
    const w = buildPlayerWeapon(fKey, tKey);
    PLAYER_WEAPONS[w.id] = w;
  }
}

// --- Old weapon key migration aliases ---
// Old saves may reference these keys. They map to canonical IDs so
// getWeapon() never returns null during migration.
const LEGACY_ALIASES = {
  heavy_rifle: 'lmg',
  carbine: 'rifle',
  precision_rifle: 'sniper_rifle',
  conventional_rifle: 'rifle',
  conventional_shotgun: 'shotgun',
  conventional_lmg: 'lmg',
  conventional_sniper: 'sniper_rifle',
  conventional_sniper_rifle: 'sniper_rifle',
  plasma_sniper: 'plasma_sniper_rifle',
  nano_sniper: 'nano_sniper_rifle',
  laser_sniper: 'laser_sniper_rifle',
};

export const WEAPONS = {
  ...PLAYER_WEAPONS,

  // --- Enemy weapons (beam, unchanged) ---
  enemy_rifle: {
    name: 'Rifle', type: 'rifle', family: 'rifle', tier: 0,
    range: 6, damage: 3, apCost: 1, ammo: 3, reloadApCost: 1, presentation: 'beam',
  },
  close_assault: {
    name: 'Close Assault', type: 'close_assault', family: 'close_assault', tier: 0,
    range: 2, damage: 5, apCost: 1, ammo: 3, reloadApCost: 1, presentation: 'beam',
  },
  light_rifle: {
    name: 'Light Rifle', type: 'light_rifle', family: 'light_rifle', tier: 0,
    range: 7, damage: 2, apCost: 1, ammo: 3, reloadApCost: 1, presentation: 'beam',
  },
  enemy_smg: {
    name: 'SMG', type: 'smg', family: 'smg', tier: 0,
    range: 3, damage: 3, apCost: 1, ammo: 3, reloadApCost: 1, presentation: 'beam',
  },
  enemy_lmg: {
    name: 'LMG', type: 'lmg', family: 'lmg', tier: 0,
    range: 6, damage: 4, apCost: 1, ammo: 3, reloadApCost: 1, presentation: 'beam',
  },
  // --- New alien archetypes (beam) ---
  bulwark_beam: {
    name: 'Bulwark Beam', type: 'bulwark_beam', family: 'bulwark_beam', tier: 0,
    range: 5, damage: 3, apCost: 1, ammo: 3, reloadApCost: 1, presentation: 'beam',
  },
  stalker_carbine: {
    name: 'Stalker Beam Carbine', type: 'stalker_carbine', family: 'stalker_carbine', tier: 0,
    range: 5, damage: 3, apCost: 1, ammo: 3, reloadApCost: 1, presentation: 'beam',
  },
  disruptor_beam: {
    name: 'Disruptor Beam', type: 'disruptor_beam', family: 'disruptor_beam', tier: 0,
    range: 7, damage: 2, apCost: 1, ammo: 3, reloadApCost: 1, presentation: 'beam',
  },
  artillery_beam: {
    name: 'Artillery Beam', type: 'artillery_beam', family: 'artillery_beam', tier: 0,
    range: 6, damage: 2, apCost: 1, ammo: 3, reloadApCost: 1, presentation: 'beam',
  },
  // --- Chapter 2 enemy weapons (beam) ---
  // Bastion Heavy Plasma Cannon: long-range, high damage. Armor 4 makes the
  // Bastion durable; the cannon makes it dangerous at range.
  bastion_cannon: {
    name: 'Heavy Plasma Cannon', type: 'bastion_cannon', family: 'bastion_cannon', tier: 1,
    range: 6, damage: 5, apCost: 1, ammo: 4, reloadApCost: 1, presentation: 'beam',
  },
  // Fabricator Beam: weak personal weapon. The Fabricator's threat is its
  // support abilities, not its damage.
  fabricator_beam: {
    name: 'Fabricator Beam', type: 'fabricator_beam', family: 'fabricator_beam', tier: 0,
    range: 6, damage: 2, apCost: 1, ammo: 3, reloadApCost: 1, presentation: 'beam',
  },
  // --- Chapter 3: Flash Claw Strike (melee) ---
  // Melee-only attack. Range 1 (adjacent), damage 4. Unlimited ammo (no ammo
  // field → Infinity). Uses beam presentation (existing enemy convention).
  flash_claw_strike: {
    name: 'Flash Claw Strike', type: 'flash_claw_strike', family: 'flash_claw_strike', tier: 0,
    range: 1, damage: 4, apCost: 1, reloadApCost: 1, presentation: 'beam',
  },
  // --- Chapter 3: Dislocator Beam Rifle ---
  // Standard ranged attack. Range 6, damage 3. The Dislocator's threat is its
  // COME HERE! forced-movement ability, not its raw damage.
  dislocator_beam: {
    name: 'Beam Rifle', type: 'dislocator_beam', family: 'dislocator_beam', tier: 0,
    range: 6, damage: 3, apCost: 1, ammo: 3, reloadApCost: 1, presentation: 'beam',
  },
  // --- Chapter 3: Executioner Execution Beam Rifle ---
  // Standard ranged attack. Range 7, damage 3. The Executioner's threat comes
  // from its Lone Prey passive (+2 final damage vs isolated targets), not
  // raw weapon damage. Long range (7) lets it hunt from a distance.
  executioner_beam: {
    name: 'Execution Beam', type: 'executioner_beam', family: 'executioner_beam', tier: 0,
    range: 7, damage: 3, apCost: 1, ammo: 3, reloadApCost: 1, presentation: 'beam',
  },
  // --- Boss weapon ---
  warden_beam: {
    name: 'Warden Beam', type: 'warden_beam', family: 'warden_beam', tier: 0,
    range: 7, damage: 5, apCost: 1, ammo: 4, reloadApCost: 1, presentation: 'beam',
  },
  // --- Chapter 2 Boss: The Harvester — Heavy Plasma Cannon ---
  // Direct Energy. Range 7, damage 6. Uses normal Cover/Exposed/Flanked/Armor/
  // Shield rules. No automatic cover ignore.
  harvester_cannon: {
    name: 'Heavy Plasma Cannon', type: 'harvester_cannon', family: 'harvester_cannon', tier: 1,
    range: 7, damage: 6, apCost: 1, ammo: 4, reloadApCost: 1, presentation: 'beam',
  },
  // --- Elite enemy weapons ---
  elite_rifle: {
    name: 'Elite Rifle', type: 'rifle', family: 'rifle', tier: 0,
    range: 6, damage: 4, apCost: 1, ammo: 3, reloadApCost: 1, presentation: 'beam',
  },
  elite_close_assault: {
    name: 'Elite Close Assault', type: 'close_assault', family: 'close_assault', tier: 0,
    range: 2, damage: 6, apCost: 1, ammo: 3, reloadApCost: 1, presentation: 'beam',
  },
  elite_light_rifle: {
    name: 'Elite Light Rifle', type: 'light_rifle', family: 'light_rifle', tier: 0,
    range: 7, damage: 3, apCost: 1, ammo: 3, reloadApCost: 1, presentation: 'beam',
  },
};

export function getWeapon(weaponKey) {
  if (!weaponKey) return null;
  if (WEAPONS[weaponKey]) return WEAPONS[weaponKey];
  const alias = LEGACY_ALIASES[weaponKey];
  return alias ? WEAPONS[alias] || null : null;
}

// --- Weapon family / tier helpers ---

export function getWeaponFamily(weapon) {
  return weapon ? weapon.family : null;
}

export function getWeaponTier(weapon) {
  return weapon ? weapon.tier : null;
}

export function getWeaponMovementModifier(weapon) {
  return weapon ? (weapon.movementModifier || 0) : 0;
}

// All player weapon IDs (for inventory population / debug).
export function getPlayerWeaponIds() {
  return Object.keys(PLAYER_WEAPONS);
}

// Starting weapon key for a class (default loadout, not a restriction).
export function getStartingWeaponKey(cls) {
  const STARTING = { assault: 'shotgun', heavy: 'lmg', support: 'rifle', engineer: 'rifle', marksman: 'sniper_rifle' };
  return STARTING[cls] || 'rifle';
}