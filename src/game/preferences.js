// Global game preferences (not save-specific). Stored in a single localStorage
// key so they persist across missions and sessions. Combat Speed is the only
// supported setting in this phase; the structure allows future settings
// (audio, animation, accessibility, display) to be added without changing
// callers — just add a field here and a getter/setter.

const PREF_KEY = 'xcontact_prefs';

export const COMBAT_SPEEDS = ['normal', 'fast', 'very_fast'];

// Presentation multiplier applied to combat animation durations and pauses.
// 1 = normal, 0.6 = fast, 0.3 = very fast. Affects timing only — never AP,
// damage, AI, cooldowns, or movement distance.
export const SPEED_MULTIPLIERS = {
  normal: 1,
  fast: 0.6,
  very_fast: 0.3,
};

export const COMBAT_SPEED_LABELS = {
  normal: 'Normal',
  fast: 'Fast',
  very_fast: 'Very Fast',
};

// Live multiplier read by the combat presentation layer (Battle.jsx sleep /
// animation helpers). Reassigned by setCombatSpeed so in-flight and future
// timing reads always see the current value via the ESM live binding.
export let speedMultiplier = 1;

function readPrefs() {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

function writePrefs(prefs) {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  } catch (e) { /* ignore quota / privacy errors */ }
}

export function getCombatSpeed() {
  const prefs = readPrefs();
  const speed = prefs.combatSpeed || 'normal';
  return COMBAT_SPEEDS.includes(speed) ? speed : 'normal';
}

export function setCombatSpeed(speed) {
  if (!COMBAT_SPEEDS.includes(speed)) return;
  const prefs = readPrefs();
  prefs.combatSpeed = speed;
  writePrefs(prefs);
  speedMultiplier = SPEED_MULTIPLIERS[speed];
}

// Detailed Targeting Info: when ON, selecting a valid attack target opens a
// full predicted-damage preview before committing. Default ON for new and
// migrated saves. Not campaign progression — a normal player preference.
export function getDetailedTargetingInfo() {
  const prefs = readPrefs();
  const v = prefs.detailedTargetingInfo;
  if (v === undefined || v === null) return true; // default ON, safe migration
  return !!v;
}

export function setDetailedTargetingInfo(enabled) {
  const prefs = readPrefs();
  prefs.detailedTargetingInfo = !!enabled;
  writePrefs(prefs);
}

// Initialize the live multiplier from stored prefs on module load.
speedMultiplier = SPEED_MULTIPLIERS[getCombatSpeed()];