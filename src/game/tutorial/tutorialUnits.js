// Temporary Tutorial units — creates tactical units for the tutorial mission.
// These are NOT persistent campaign soldiers. They use simple Tier 1 gear and
// have tutorial-specific ids (tut_soldier_1, etc.) so the highlight layer can
// find them. Any injuries/results from the tutorial do NOT persist into the
// campaign.

import { makePlayer, makeEnemy } from '../units';
import { getItem } from '../equipment';
import { TUTORIAL_PLAYER_STARTS } from './tutorialMap';

// Create a tutorial player unit with a specific tutorial id, class, position,
// and optional utility item. The unit's `id` is set to the tutorial id so the
// highlight layer (which matches by u.id) can find it.
export function createTutorialPlayer(tutId, cls, x, y, opts = {}) {
  const unit = makePlayer(cls, x, y);
  unit.id = tutId;
  unit.tutIds = [tutId];
  unit.soldierId = tutId;  // for mission commit (which we skip for tutorials)
  unit.name = opts.name || tutId;
  unit.callsign = opts.callsign || '';
  // Downed / Revive state (mission-local)
  unit.downed = false;
  unit.bleedOut = null;
  unit.recovering = false;
  unit.momentumUsed = false;
  // Mission-local statistics
  unit.missionKills = 0;
  unit.missionEliteKills = 0;
  unit.missionDowned = false;
  unit.missionRevives = 0;
  // Apply utility item (e.g., grenade) using the real equipment system.
  if (opts.utility) {
    const util = getItem(opts.utility);
    if (util && util.grantsAbility) {
      unit.equipmentAbilities = [util.grantsAbility];
    }
  }
  // Override ammo if specified (e.g., Heavy starts with 1 ammo for reload lesson)
  if (opts.ammo != null) {
    unit.ammo = opts.ammo;
  }
  return unit;
}

// Create a tutorial enemy unit with a specific tutorial id.
export function createTutorialEnemy(tutId, archetype, x, y, opts = {}) {
  const enemy = makeEnemy(archetype, x, y, opts);
  enemy.id = tutId;
  enemy.tutIds = [tutId];
  // Override armor / hp if specified (for the armored enemy lesson)
  if (opts.armor != null) {
    enemy.armor = opts.armor;
    enemy.currentArmor = opts.armor;
  }
  if (opts.hp != null) {
    enemy.hp = opts.hp;
    enemy.maxHp = opts.hp;
  }
  return enemy;
}

// Create the initial tutorial player units (2 soldiers at the start).
export function createInitialTutorialUnits() {
  return TUTORIAL_PLAYER_STARTS.map((p) =>
    createTutorialPlayer(p.tutId, p.cls, p.x, p.y, { name: p.name, utility: p.utility })
  );
}

// Create a tutorial player unit from a zone-join definition (e.g., Heavy in Zone 3).
export function createTutorialPlayerFromDef(def) {
  return createTutorialPlayer(def.tutId, def.cls, def.x, def.y, {
    name: def.name,
    utility: def.utility,
    ammo: def.ammo,
  });
}

// Create a tutorial enemy unit from a zone spawn definition.
export function createTutorialEnemyFromDef(def) {
  return createTutorialEnemy(def.tutId, def.archetype, def.x, def.y, {
    armor: def.armor,
    hp: def.hp,
  });
}