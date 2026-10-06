// Tutorial zone definitions — maps tutorial steps to zones, gates, and
// scripted enemy spawns. The zone controller hook (useTutorialMission) reads
// these to determine when to open gates, spawn enemies, and fire scripted
// events as the tutorial progresses.
//
// Zones are unlocked in order. Each zone has:
//   - startStep: the first tutorial step id for this zone
//   - gate: the gate that opens when the PREVIOUS zone completes (null for Zone 1)
//   - enemies: enemy spawn definitions for this zone
//   - players: additional player units that join (e.g., Heavy in Zone 3)

export const ZONE_START_STEPS = {
  1: 'tut_welcome',
  2: 'tut_attack_intro',
  3: 'tut_armor_intro',
  4: 'tut_ability_intro',
  5: 'tut_overwatch_intro',
  6: 'tut_commander_intro',
};

// Which gate opens when this zone starts (null = no gate, spawn-triggered).
export const GATE_FOR_ZONE = {
  2: null,  // Zone 2 is spawn-triggered from Zone 1 (no gate)
  3: 1,     // Gate 1 opens when Zone 3 starts
  4: 2,     // Gate 2 opens when Zone 4 starts
  5: 3,     // Gate 3 opens when Zone 5 starts
  6: 4,     // Gate 4 opens when Zone 6 starts
};

// Enemy spawns per zone. Each entry: { tutId, archetype, x, y, armor?, hp? }
export const ENEMIES_FOR_ZONE = {
  2: [
    { tutId: 'tut_grunt_1', archetype: 'grunt', x: 3, y: 11 },
    { tutId: 'tut_grunt_2', archetype: 'grunt', x: 6, y: 11 },
  ],
  3: [
    { tutId: 'tut_armored_1', archetype: 'bulwark', x: 4, y: 9, armor: 2, hp: 8 },
  ],
  4: [
    { tutId: 'tut_grunt_3', archetype: 'grunt', x: 5, y: 7 },
  ],
  5: [
    { tutId: 'tut_ow_enemy_1', archetype: 'rusher', x: 4, y: 4 },
    { tutId: 'tut_ow_enemy_2', archetype: 'grunt', x: 2, y: 3 },
  ],
  6: [
    { tutId: 'tut_final_grunt_1', archetype: 'grunt', x: 2, y: 0 },
    { tutId: 'tut_final_grunt_2', archetype: 'grunt', x: 6, y: 0 },
    { tutId: 'tut_final_rusher', archetype: 'rusher', x: 4, y: 0 },
    { tutId: 'tut_final_support', archetype: 'support', x: 4, y: 1 },
  ],
};

// Additional player units that join the squad per zone.
export const PLAYERS_FOR_ZONE = {
  3: [
    { tutId: 'tut_lmg_soldier', cls: 'heavy', x: 4, y: 10, name: 'Patch', ammo: 1 },
  ],
};

// Steps that trigger scripted events.
export const SCRIPTED_EVENTS = {
  // Force tut_soldier_1 to downed state at this step.
  downedEvent: 'tut_downed_event',
  // Grant temporary commander access at this step.
  commanderDemoStart: 'tut_commander_intro',
  // Remove commander access and clean up at this step.
  commanderDemoEnd: 'tut_victory',
};

// Get the zone number for a given step id. Returns the zone that contains
// the step (1-6), or null if unknown.
export function getZoneForStep(stepId) {
  if (!stepId) return null;
  const zones = Object.entries(ZONE_START_STEPS).sort((a, b) => Number(b[0]) - Number(a[0]));
  const stepIndex = getStepOrderIndex(stepId);
  for (const [zoneStr, startStep] of zones) {
    const startIndex = getStepOrderIndex(startStep);
    if (stepIndex >= startIndex) return Number(zoneStr);
  }
  return null;
}

// Ordered list of all tutorial step ids (for computing step order).
import { TUTORIAL_STEPS } from './tutorialSteps';
const STEP_ORDER = TUTORIAL_STEPS.map((s) => s.id);
function getStepOrderIndex(stepId) {
  return STEP_ORDER.indexOf(stepId);
}

// Get all zone start step ids in order.
export function getZoneStartSteps() {
  return Object.values(ZONE_START_STEPS);
}