// Five-slot save system with complete campaign isolation.
// Each slot is a self-contained JSON blob in localStorage — a separate key per
// slot so data can never leak between campaigns. The active slot is tracked in
// its own key so persistence.js knows which campaign to read/write.
//
// Save schema (per slot):
//   { saveVersion, slot, createdAt, lastPlayedAt, campaign: { credits,
//     alien_materials, inventory, squad_upgrades, soldiers, missionProgress,
//     campaignStats } }
//
// Mid-mission tactical state is intentionally NOT saved in this phase — the
// schema reserves space for it (campaign.missionProgress / future fields) but
// only between-mission campaign state is persisted for now.

import { getMaxSquadSize } from './squadUpgrades';
import { computeUnspentSelections, totalSkillPointsByLevel, getSkillNodes } from './skillTrees';
import { getStartingWeaponKey } from './weapons';
import { getItem, ITEM_CATEGORIES } from './equipment';
import { createDefaultChapter, createDefaultChaptersState, migrateChaptersState } from './chapter';
import { getDefaultIconColor } from './iconColors';
import { generateRandomName, generateUniqueSoldierId } from './names';
import { createDefaultCommander, normalizeCommander } from './commander';
import { deduplicateSkillIds } from './commanderSkills';
import { createDefaultEnemyCommanderState } from './enemyCommanderAssignment';

export const SAVE_VERSION = 11;
export const NUM_SAVE_SLOTS = 5;
export const AUTO_SLOT = 0;

const SLOT_KEY = (slot) => `xcontact_slot_${slot}`;
const ACTIVE_KEY = 'xcontact_active_slot';

// Convert legacy level-keyed upgrades ({ level2: 'id', ... }) to the freedom-
// first array model (['id', ...]) so multiple skills per level can coexist.
// Idempotent: arrays and empty values pass through unchanged.
function migrateUpgrades(upgrades) {
  if (!upgrades) return [];
  if (Array.isArray(upgrades)) return upgrades;
  return Object.values(upgrades).filter(Boolean);
}

// --- Roster defaults (shared with persistence.js) ---

const BASE_HP = { assault: 8, heavy: 8, support: 8, engineer: 8, marksman: 8 };

export const INITIAL_ROSTER = [
  { soldier_id: 'viper', name: 'Viper', callsign: 'Viper', class: 'assault' },
  { soldier_id: 'badger', name: 'Badger', callsign: 'Badger', class: 'heavy' },
  { soldier_id: 'patch', name: 'Patch', callsign: 'Patch', class: 'support' },
  { soldier_id: 'wrench', name: 'Wrench', callsign: 'Wrench', class: 'engineer' },
  { soldier_id: 'eagle', name: 'Eagle', callsign: 'Eagle', class: 'marksman' },
];

export function newSoldierRecord(s) {
  return {
    soldier_id: s.soldier_id,
    name: s.name,
    callsign: s.callsign,
    class: s.class,
    level: 1,
    xp: 0,
    current_hp: BASE_HP[s.class] ?? 8,
    max_hp: BASE_HP[s.class] ?? 8,
    alive: true,
    injured: false,
    injuries_sustained: 0,
    missions_participated: 0,
    missions_survived: 0,
    personal_kills: 0,
    elite_kills: 0,
    times_downed: 0,
    revives_performed: 0,
    upgrades: [],
    available_skill_selections: 0,
    kill_progress: 0,
    equipped_weapon: getStartingWeaponKey(s.class),
    equipped_armor: 'medium_body',
    equipped_utility: null,
    icon_color: getDefaultIconColor(s.class),
  };
}

// Create a recruit soldier record. Recruits start at Level 1, 0 XP, no skill
// selections, READY, full base HP, and NO equipment (weapon/armor/utility all
// null). They must be equipped using existing owned Armory inventory.
export function createRecruitSoldierRecord(cls, name, soldierId) {
  const baseHp = BASE_HP[cls] ?? 8;
  return {
    soldier_id: soldierId,
    name: name,
    callsign: name,
    class: cls,
    level: 1,
    xp: 0,
    current_hp: baseHp,
    max_hp: baseHp,
    alive: true,
    injured: false,
    injuries_sustained: 0,
    missions_participated: 0,
    missions_survived: 0,
    personal_kills: 0,
    elite_kills: 0,
    times_downed: 0,
    revives_performed: 0,
    upgrades: [],
    available_skill_selections: 0,
    kill_progress: 0,
    equipped_weapon: null,
    equipped_armor: null,
    equipped_utility: null,
    icon_color: getDefaultIconColor(cls),
  };
}

// Re-export name generators for use by persistence.js recruit flow.
export { generateRandomName, generateUniqueSoldierId };

// --- Slot primitives ---

function readSlotRaw(slot) {
  const raw = localStorage.getItem(SLOT_KEY(slot));
  if (raw == null) return null;
  return JSON.parse(raw);
}

function writeSlotRaw(slot, data) {
  localStorage.setItem(SLOT_KEY(slot), JSON.stringify(data));
}

// Safe read — never throws. Returns { data, error }.
function readSlotSafe(slot) {
  try {
    const data = readSlotRaw(slot);
    return { data, error: false };
  } catch (e) {
    console.error(`[SaveSlots] Slot ${slot} corrupt:`, e);
    return { data: null, error: true };
  }
}

// --- Active slot ---

export function getActiveSlot() {
  const raw = localStorage.getItem(ACTIVE_KEY);
  if (raw == null) return null;
  const n = parseInt(raw, 10);
  if (isNaN(n) || n < 0 || n > NUM_SAVE_SLOTS) return null;
  return n;
}

export function setActiveSlot(slot) {
  if (slot == null) {
    localStorage.removeItem(ACTIVE_KEY);
  } else {
    localStorage.setItem(ACTIVE_KEY, String(slot));
  }
}

export function clearActiveSlot() {
  localStorage.removeItem(ACTIVE_KEY);
}

// One-time migration from the old slot model (active slot 1-5) to the auto-save
// model (active slot 0). Copies the old active slot's data to slot 0 so existing
// campaigns continue seamlessly. The old slot's data is preserved as a manual
// save. Idempotent: once ACTIVE_KEY is "0", this is a no-op.
function migrateToAutoSave() {
  if (typeof localStorage === 'undefined') return;
  const raw = localStorage.getItem(ACTIVE_KEY);
  if (raw == null) return;
  const n = parseInt(raw, 10);
  if (n >= 1 && n <= NUM_SAVE_SLOTS) {
    const oldData = readSlotRaw(n);
    if (oldData && !readSlotRaw(AUTO_SLOT)) {
      writeSlotRaw(AUTO_SLOT, { ...oldData, slot: AUTO_SLOT, lastPlayedAt: new Date().toISOString() });
    }
    setActiveSlot(AUTO_SLOT);
  }
}
migrateToAutoSave();

// --- Campaign creation / loading ---

// Starting weapon inventory for a new campaign. Each soldier's class starting
// weapon is added to the inventory so equipping/unequipping works physically.
// Support and Engineer both start with a Rifle, so the roster owns 2 Rifles.
function buildStartingWeaponInventory(soldiers) {
  const inv = {};
  for (const s of soldiers) {
    const wKey = getStartingWeaponKey(s.class);
    inv[wKey] = 1; // unlocked — available to all soldiers
  }
  return inv;
}

// Starting armor inventory: 5 Medium Body Armor (one per starting soldier).
// Higher-tier armor must be purchased from the Armory.
function buildStartingArmorInventory() {
  return { medium_body: 1 }; // unlocked — available to all soldiers
}

export function createDefaultCampaign() {
  const soldiers = INITIAL_ROSTER.map(newSoldierRecord);
  return {
    credits: 0,
    alien_materials: 0,
    powerCores: 0,
    nanoCubes: 0,
    inventory: {
      ...buildStartingWeaponInventory(soldiers),
      ...buildStartingArmorInventory(),
    },
    squad_upgrades: {},
    commander: createDefaultCommander(),
    soldiers,
    chapter: createDefaultChapter(),
    chapters: createDefaultChaptersState(),
    enemyCommanderState: createDefaultEnemyCommanderState(),
    squadSkillNotification: false,
    missionProgress: { completedMissions: [] },
    // Persisted weighted-composition results keyed by missionId so generated
    // enemy lists survive reload / tab switch / restart (chapterEnemyPools.js).
    missionCompositions: {},
    campaignStats: {
      missionsCompleted: 0,
      totalKills: 0,
      totalEliteKills: 0,
      totalCreditsEarned: 0,
      totalAlienMaterialsEarned: 0,
      totalPowerCoresEarned: 0,
    },
    tierCorrectionV14Applied: true,
  };
}

// Create a new campaign in a slot, overwriting any existing data. Sets the
// slot as active and returns the full save object.
export function createNewCampaign() {
  const now = new Date().toISOString();
  const save = {
    saveVersion: SAVE_VERSION,
    slot: AUTO_SLOT,
    createdAt: now,
    lastPlayedAt: now,
    campaign: createDefaultCampaign(),
  };
  writeSlotRaw(AUTO_SLOT, save);
  setActiveSlot(AUTO_SLOT);
  return save;
}

// Load a slot's campaign into active context. Touches lastPlayedAt. Returns
// the save object, or null if the slot is empty/corrupt.
export function loadCampaign(slot) {
  const { data, error } = readSlotSafe(slot);
  if (error || !data) return null;
  const campaign = migrateCampaign(data.campaign);
  const now = new Date().toISOString();
  // Touch the source slot's lastPlayedAt (for manual slots).
  if (slot !== AUTO_SLOT) {
    writeSlotRaw(slot, { ...data, campaign, lastPlayedAt: now });
  }
  // Copy into the auto-save slot and set it active.
  const save = {
    ...data,
    slot: AUTO_SLOT,
    campaign,
    createdAt: data.createdAt || now,
    lastPlayedAt: now,
  };
  writeSlotRaw(AUTO_SLOT, save);
  setActiveSlot(AUTO_SLOT);
  return save;
}

// Save the current auto-save (slot 0) campaign to a manual slot (1-5). Preserves
// the original creation date if the slot was already occupied.
export function saveToManualSlot(slot) {
  if (slot === AUTO_SLOT) return false;
  const { data } = readSlotSafe(AUTO_SLOT);
  if (!data) return false;
  const existing = readSlotRaw(slot);
  const now = new Date().toISOString();
  writeSlotRaw(slot, {
    ...data,
    slot,
    createdAt: existing?.createdAt || now,
    lastPlayedAt: now,
  });
  return true;
}

// Delete a manual save slot (1-5). Cannot delete the auto-save slot.
export function deleteManualSlot(slot) {
  if (slot === AUTO_SLOT) return;
  localStorage.removeItem(SLOT_KEY(slot));
}

export function isSlotOccupied(slot) {
  const { data, error } = readSlotSafe(slot);
  return !error && data != null;
}

export function getSlotData(slot) {
  return readSlotSafe(slot);
}

// --- Metadata (lightweight, for title / load-game screens) ---

export function getSlotMeta(slot) {
  const { data, error } = readSlotSafe(slot);
  if (error) {
    return {
      slot,
      isAuto: slot === AUTO_SLOT,
      slotLabel: slot === AUTO_SLOT ? 'AUTO' : `SAVE ${slot}`,
      occupied: false,
      error: true,
      createdAt: null,
      lastPlayedAt: null,
      credits: 0,
      alienMaterials: 0,
      squadSize: 3,
      readyCount: 0,
      injuredCount: 0,
      progressMarker: 'SAVE DATA ERROR',
    };
  }
  if (!data) {
    return { slot, isAuto: slot === AUTO_SLOT, slotLabel: slot === AUTO_SLOT ? 'AUTO' : `SAVE ${slot}`, occupied: false, error: false };
  }
  const c = data.campaign || {};
  const soldiers = c.soldiers || [];
  const readyCount = soldiers.filter((s) => s.alive !== false && !s.injured).length;
  const injuredCount = soldiers.filter((s) => s.injured).length;
  const squadSize = getMaxSquadSize({ squad_upgrades: c.squad_upgrades || {} });
  const missionsCompleted = (c.missionProgress?.completedMissions || []).length;
  const chapters = migrateChaptersState(c);
  let activeCh = chapters.ch1 || {};
  let activeNum = 1;
  for (const [cid, st] of Object.entries(chapters)) {
    if (st && st.unlocked) {
      const num = parseInt(cid.replace('ch', ''), 10) || 1;
      if (num >= activeNum) { activeCh = st; activeNum = num; }
    }
  }
  const chapterProgress = activeCh.chapterProgressPercent || 0;
  const bossDefeated = !!activeCh.bossDefeated;
  const progressMarker = bossDefeated
    ? `Chapter ${activeNum} Complete`
    : `Chapter ${activeNum} · ${chapterProgress}%`;
  return {
    slot,
    isAuto: slot === AUTO_SLOT,
    slotLabel: slot === AUTO_SLOT ? 'AUTO' : `SAVE ${slot}`,
    occupied: true,
    error: false,
    createdAt: data.createdAt,
    lastPlayedAt: data.lastPlayedAt,
    credits: c.credits || 0,
    alienMaterials: c.alien_materials || 0,
    powerCores: c.powerCores || 0,
    nanoCubes: c.nanoCubes || 0,
    squadSize,
    readyCount,
    injuredCount,
    chapterProgress,
    bossDefeated,
    progressMarker,
  };
}

export function getAllSlotMeta() {
  const metas = [];
  metas.push(getSlotMeta(AUTO_SLOT));
  for (let i = 1; i <= NUM_SAVE_SLOTS; i++) {
    metas.push(getSlotMeta(i));
  }
  return metas;
}

// Returns only the 5 manual save slots (1-5), excluding the auto-save slot.
export function getManualSlotMetas() {
  const metas = [];
  for (let i = 1; i <= NUM_SAVE_SLOTS; i++) {
    metas.push(getSlotMeta(i));
  }
  return metas;
}

// Quick Save target: the most recently used manual slot (1-5). Falls back to
// slot 1 when no manual slot is occupied. Used by the Options overlay's
// Quick Save action so a single tap writes the active campaign without a
// slot-picker. Returns the slot number (always 1-5, never AUTO_SLOT).
export function getQuickSaveSlot() {
  let best = 1;
  let bestTime = 0;
  for (let i = 1; i <= NUM_SAVE_SLOTS; i++) {
    const { data, error } = readSlotSafe(i);
    if (error || !data) continue;
    const t = data.lastPlayedAt ? new Date(data.lastPlayedAt).getTime() : 0;
    if (t > bestTime) {
      bestTime = t;
      best = i;
    }
  }
  return best;
}

// Continue: the most recently played valid save slot (or null if all empty).
export function getContinueSlot() {
  // Auto-save is always the continue target when occupied.
  if (isSlotOccupied(AUTO_SLOT)) return AUTO_SLOT;
  let best = null;
  let bestTime = 0;
  for (let i = 1; i <= NUM_SAVE_SLOTS; i++) {
    const { data, error } = readSlotSafe(i);
    if (error || !data) continue;
    const t = data.lastPlayedAt ? new Date(data.lastPlayedAt).getTime() : 0;
    if (t > bestTime) {
      bestTime = t;
      best = i;
    }
  }
  return best;
}

// --- Save migration ---
// Ensures soldiers have available_skill_selections. Old saves (pre-skill-tree)
// compute it from level vs. already-chosen upgrades so existing progress is
// preserved without forcing a re-pick. Also migrates the Engineer Saboteur tree
// change: Overcharged Mine moved from Level 4 to Level 6. Existing selections
// are preserved (moved to the level6 key) and never awarded twice.
//
// Universal Weapon migration (v3): old saves have no equipped_weapon field.
// Each soldier is assigned their class starting weapon, and the starting
// weapons are added to the inventory (preserving existing inventory counts).
// Idempotent: skips soldiers already migrated.
function migrateCampaign(campaign) {
  if (!campaign) return campaign;
  let needsWeaponMigration = false;
  if (campaign.soldiers) {
    campaign.soldiers = campaign.soldiers.map((s) => {
      if (s == null) return s;
      let migrated = s;
      // Engineer Overcharged Mine migration: level4 → level6 (legacy level-keyed
      // format). Runs before the upgrade-format conversion below.
      if (migrated.class === 'engineer' && migrated.upgrades && migrated.upgrades.level4 === 'overcharged_mine') {
        const up = { ...migrated.upgrades };
        if (!up.level6) {
          up.level6 = 'overcharged_mine';
          delete up.level4;
          migrated = { ...migrated, upgrades: up };
        }
      }
      // Upgrade storage migration: legacy { level2: 'id', ... } → array of ids.
      // The freedom-first tree allows multiple skills per level, which the old
      // level-keyed object could not represent. Idempotent: arrays pass through.
      migrated = { ...migrated, upgrades: migrateUpgrades(migrated.upgrades) };
      // Engineer Saboteur rework: map replaced skill IDs to their successors so
      // existing progress is preserved (Chain Reaction → Friendly Mines,
      // Predator Mine → Agent Provocateur). remote_placement and
      // overcharged_mine keep the same IDs. Runs before the obsolete-skill
      // filter so mapped IDs survive.
      if (Array.isArray(migrated.upgrades) && migrated.class === 'engineer') {
        const SABOTEUR_MIGRATION = { chain_reaction: 'friendly_mines', predator_mine: 'agent_provocateur' };
        let changed = false;
        const mapped = migrated.upgrades.map((id) => {
          if (SABOTEUR_MIGRATION[id]) { changed = true; return SABOTEUR_MIGRATION[id]; }
          return id;
        });
        if (changed) {
          const seen = new Set();
          const dedup = [];
          for (const id of mapped) { if (!seen.has(id)) { seen.add(id); dedup.push(id); } }
          migrated = { ...migrated, upgrades: dedup };
        }
      }
      // Obsolete skill removal: filter out skill IDs that no longer exist in the
      // class tree (e.g. old Heavy Demolitions skills replaced by Launch Rocket).
      // Points are automatically refunded via computeUnspentSelections below.
      if (Array.isArray(migrated.upgrades) && migrated.upgrades.length > 0) {
        const validIds = new Set(getSkillNodes(migrated.class).map((n) => n.id));
        const filtered = migrated.upgrades.filter((id) => validIds.has(id));
        if (filtered.length !== migrated.upgrades.length) {
          migrated = { ...migrated, upgrades: filtered };
        }
      }
      if (migrated.available_skill_selections == null) {
        migrated = { ...migrated, available_skill_selections: computeUnspentSelections(migrated) };
      }
      // Dev-only over-selection flag (Part 51): an old save may have more
      // selected skills than its level permits under the new point budget.
      // Preserve the skills — never silently delete — but warn for review.
      const selected = Array.isArray(migrated.upgrades) ? migrated.upgrades.length : 0;
      const earned = totalSkillPointsByLevel(migrated.level || 1);
      if (selected > earned) {
        console.warn(`[SaveSlots] ${migrated.name || migrated.soldier_id} has ${selected} skills but only ${earned} permitted by level ${migrated.level} — preserved, not deleted.`);
      }
      // Universal Weapon migration: assign starting weapon if not set.
      if (!migrated.equipped_weapon) {
        needsWeaponMigration = true;
        migrated = { ...migrated, equipped_weapon: getStartingWeaponKey(migrated.class) };
      }
      return migrated;
    });
    // Add starting weapons to inventory for old saves that lacked them.
    if (needsWeaponMigration) {
      const startingInv = buildStartingWeaponInventory(campaign.soldiers);
      campaign.inventory = { ...(campaign.inventory || {}) };
      for (const [key, qty] of Object.entries(startingInv)) {
        campaign.inventory[key] = Math.max(campaign.inventory[key] || 0, qty);
      }
    }

    // --- Universal Armor migration (v4) ---
    // Convert old HP-based armor IDs to new universal armor and clamp HP
    // (old armor added HP, new armor doesn't).
    const ARMOR_MIGRATION_MAP = { tactical_vest: 'medium_body', reinforced_armor: 'heavy_body' };
    campaign.soldiers = campaign.soldiers.map((s) => {
      if (s == null) return s;
      let migrated = s;
      if (migrated.equipped_armor && ARMOR_MIGRATION_MAP[migrated.equipped_armor]) {
        migrated = { ...migrated, equipped_armor: ARMOR_MIGRATION_MAP[migrated.equipped_armor] };
      }
      if (migrated.current_hp > migrated.max_hp) {
        migrated = { ...migrated, current_hp: migrated.max_hp };
      }
      return migrated;
    });
    // Convert old armor inventory keys (preserve existing inventory).
    campaign.inventory = { ...(campaign.inventory || {}) };
    for (const [oldId, newId] of Object.entries(ARMOR_MIGRATION_MAP)) {
      if (campaign.inventory[oldId]) {
        campaign.inventory[newId] = (campaign.inventory[newId] || 0) + campaign.inventory[oldId];
        delete campaign.inventory[oldId];
      }
    }

    // --- Power Cores migration (v5) ---
    // Add powerCores field to existing saves (default 0). Power Cores are a
    // new rare resource required for Tier 3 equipment purchases.
    if (campaign.powerCores == null) {
      campaign.powerCores = 0;
    }

    // --- Chapter progression migration (v6) ---
    // Add chapter state to existing saves. Initialized to Chapter 1, 0%
    // progress, boss locked. Do NOT guess progress from unrelated statistics
    // (e.g. missionsCompleted) — the spec requires safe defaults.
    if (!campaign.chapter) {
      campaign.chapter = createDefaultChapter();
    }

    // --- Multi-chapter migration (v9) ---
    // Build the per-chapter state map from the legacy single chapter object.
    // Preserves all Chapter 1 progress. If Warden was already defeated,
    // unlocks Chapter 2 and marks it newlyUnlocked so the player is notified.
    campaign.chapters = migrateChaptersState(campaign);

    // --- Commander migration (v11) ---
    // Add the Commander state object to existing saves. Initialized locked
    // with an empty skill list. Does NOT auto-unlock, deduct credits, or
    // alter any existing campaign data (soldiers, chapters, resources).
    // Uses normalizeCommander for dedup + hasNewSkillNotification field.
    if (!campaign.commander) {
      campaign.commander = createDefaultCommander();
    } else {
      campaign.commander = normalizeCommander(campaign.commander);
    }
    // Auto-grant player_tactical_advance to existing Commander-unlocked saves.
    // Old saves created before this production skill get it once — no Credit
    // charge, no resource/soldier/chapter changes. Deduplicated by normalizeCommander.
    if (campaign.commander.unlocked && !campaign.commander.unlockedSkillIds.includes('player_tactical_advance')) {
      campaign.commander.unlockedSkillIds = deduplicateSkillIds([
        ...campaign.commander.unlockedSkillIds,
        'player_tactical_advance',
      ]);
      campaign.commander.hasNewSkillNotification = true;
    }

    // --- Enemy Commander state migration (v12) ---
    // Add the enemy Commander campaign state (encounter tracking, assignments,
    // tutorial flag, recurrence config). Initialized to safe defaults — no
    // commanders encountered, no assignments, production enabled.
    if (!campaign.enemyCommanderState) {
      campaign.enemyCommanderState = createDefaultEnemyCommanderState();
    } else {
      // Clear stale cached assignments from the old probabilistic system so the
      // deterministic mission-field mapping takes effect on next mission launch.
      // Assignments are re-derived deterministically from mission definitions, so
      // clearing is safe and idempotent.
      campaign.enemyCommanderState.assignments = {};
    }

    // --- Icon color migration (v7) ---
    // Add icon_color to existing soldiers. Uses class-based default. Does NOT
    // reset any existing data (kills, XP, level, skills are preserved).
    campaign.soldiers = campaign.soldiers.map((s) => {
      if (s == null) return s;
      if (!s.icon_color) {
        return { ...s, icon_color: getDefaultIconColor(s.class) };
      }
      return s;
    });

    // --- Unlock model migration (v8) ---
    // Weapons and armor are now unlocks (qty 1 = available to all soldiers).
    // Normalize any weapon/armor inventory entry > 0 to 1. Utilities stay
    // quantity-based and are not touched.
    campaign.inventory = { ...(campaign.inventory || {}) };
    for (const [key, qty] of Object.entries(campaign.inventory)) {
      const item = getItem(key);
      if (item && (item.category === ITEM_CATEGORIES.WEAPON || item.category === ITEM_CATEGORIES.ARMOR) && qty > 0) {
        campaign.inventory[key] = 1;
      }
    }

    // --- Level cap increase migration (v9) ---
    // Level cap raised from 10 to 20. Existing Level 10 soldiers are NOT
    // auto-leveled — they remain Level 10 and can now earn XP toward Level 11.
    // Any legitimately stored overflow XP (earned but unspendable under the old
    // cap) is preserved as-is and will be consumed by processLevelUps on the
    // next mission. No level, XP, skill, or HP values are fabricated or reset.
    // The available_skill_selections field is already recomputed from level by
    // computeUnspentSelections above, so it stays correct automatically.

    // --- Equipment Tier Correction: Restore Plasma as Tier 2 (v14) ---
    // One-time migration for legacy saves: revert mistaken Nano rename (where Plasma gear
    // was temporarily labeled or stored as Nano) back to legitimate Tier 2 Plasma / Powered gear.
    // Genuine Tier 3 Nano gear acquired in 3.5.2+ is preserved and never remapped.
    if (!campaign.tierCorrectionV14Applied) {
      const NANO_TO_PLASMA_MIGRATION = {
        // Weapons: revert to Tier 2 Plasma
        nano_rifle: 'plasma_rifle',
        nano_shotgun: 'plasma_shotgun',
        nano_lmg: 'plasma_lmg',
        nano_sniper_rifle: 'plasma_sniper_rifle',
        nano_sniper: 'plasma_sniper_rifle',
        // Armor: revert to Tier 2 Powered
        light_nano: 'light_powered',
        medium_nano: 'medium_powered',
        heavy_nano: 'heavy_powered',
        light_nano_armor: 'light_powered',
        medium_nano_armor: 'medium_powered',
        heavy_nano_armor: 'heavy_powered',
      };

      campaign.soldiers = campaign.soldiers.map((s) => {
        if (s == null) return s;
        let migrated = s;
        if (migrated.equipped_weapon && NANO_TO_PLASMA_MIGRATION[migrated.equipped_weapon]) {
          migrated = { ...migrated, equipped_weapon: NANO_TO_PLASMA_MIGRATION[migrated.equipped_weapon] };
        }
        if (migrated.equipped_armor && NANO_TO_PLASMA_MIGRATION[migrated.equipped_armor]) {
          migrated = { ...migrated, equipped_armor: NANO_TO_PLASMA_MIGRATION[migrated.equipped_armor] };
        }
        return migrated;
      });

      campaign.inventory = { ...(campaign.inventory || {}) };
      for (const [nanoId, plasmaId] of Object.entries(NANO_TO_PLASMA_MIGRATION)) {
        if (campaign.inventory[nanoId]) {
          campaign.inventory[plasmaId] = Math.max(campaign.inventory[plasmaId] || 0, campaign.inventory[nanoId]);
          delete campaign.inventory[nanoId];
        }
      }
      campaign.tierCorrectionV14Applied = true;
    }
  }
  return campaign;
}

// --- Active-campaign read/write (used by persistence.js) ---

export function readActiveCampaign() {
  const slot = getActiveSlot();
  if (slot == null) return null;
  const { data, error } = readSlotSafe(slot);
  if (error || !data) return null;
  return migrateCampaign(data.campaign);
}

export function writeActiveCampaign(campaign) {
  const slot = getActiveSlot();
  if (slot == null) return;
  const { data } = readSlotSafe(slot);
  if (!data) return;
  data.campaign = campaign;
  data.lastPlayedAt = new Date().toISOString();
  writeSlotRaw(slot, data);
}

// Update lastPlayedAt without changing campaign data.
export function touchActiveSave() {
  const slot = getActiveSlot();
  if (slot == null) return;
  const { data } = readSlotSafe(slot);
  if (!data) return;
  data.lastPlayedAt = new Date().toISOString();
  writeSlotRaw(slot, data);
}