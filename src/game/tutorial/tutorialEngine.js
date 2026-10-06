// Guided Combat Tutorial — engine core.
//
// Pure, framework-agnostic state machine for the tutorial step sequence. The
// React hook (useTutorial) wraps this; Battle.jsx feeds battle events in via
// recordAction. The engine never touches the DOM or React — it only advances
// tutorial state based on the action the player just performed.
//
// Design:
//   EXPLAIN (step body) → PLAYER DOES IT (requiredAction) → FEEDBACK (successText)
//   → NEXT CONCEPT (advance).
//
// Steps with no requiredAction are informational "Continue" steps — the player
// taps Continue to advance. Steps with a requiredAction wait for the player to
// perform that action using the REAL combat systems; no Continue button shown.
//
// Input restriction: each step declares allowedActions. While a step is active
// and has allowedActions, the hook blocks every action NOT in that list — so
// early steps can force "tap your soldier" without the player wandering off.

// Action types the engine understands. Battle.jsx maps its real events to these.
export const TUT_ACTION = {
  SELECT_UNIT: 'select_unit',           // payload: { unitId, team }
  SELECT_DESTINATION: 'select_destination', // payload: { x, y } — first tap (preview)
  CONFIRM_MOVE: 'confirm_move',         // payload: { unitId, x, y }
  SELECT_ENEMY: 'select_enemy',         // payload: { unitId }
  FIRE: 'fire',                         // payload: { attackerId, targetId, state }
  FLANK_ATTACK: 'flank_attack',          // payload: { attackerId, targetId, state:'flanked' }
  RELOAD: 'reload',                     // payload: { unitId }
  ABILITY: 'ability',                   // payload: { abilityId, unitId }
  GRENADE: 'grenade',                    // payload: { x, y }
  OVERWATCH: 'overwatch',               // payload: { unitId }
  OVERWATCH_ALL: 'overwatch_all',       // payload: {}
  END_PHASE: 'end_phase',               // payload: {}
  TACTICAL_LENS_ON: 'tactical_lens_on', // payload: {}
  COMMANDER_USE: 'commander_use',       // payload: { skillId }
  REVIVE: 'revive',                     // payload: { reviverId, targetId }
  SHRED_ARMOR: 'shred_armor',           // payload: { targetId, amount }
  DOWNED: 'downed',                     // payload: { unitId } — scripted event
  CONTINUE: 'continue',                 // informational step advance
};

export function createInitialTutorialState() {
  return {
    active: false,
    currentStepId: null,
    completedStepIds: [],
    awaitingPlayerAction: false,
    hintShown: false,
    lastInteractionAt: Date.now(),
    completed: false,
    startedAt: null,
  };
}

// Begin the tutorial from the first step.
export function startTutorial(steps) {
  const first = steps[0] || null;
  return {
    ...createInitialTutorialState(),
    active: true,
    currentStepId: first ? first.id : null,
    awaitingPlayerAction: !!(first && first.requiredAction),
    startedAt: Date.now(),
  };
}

export function getCurrentStep(steps, state) {
  if (!state.currentStepId) return null;
  return steps.find((s) => s.id === state.currentStepId) || null;
}

// Is a given action category permitted during the current step?
// Returns true when the tutorial is inactive/done, or the step declares no
// restriction (allowedActions empty → full freedom, used by the final fight).
export function isActionAllowed(steps, state, actionType) {
  if (!state.active || state.completed) return true;
  const step = getCurrentStep(steps, state);
  if (!step) return true;
  if (!step.allowedActions || step.allowedActions.length === 0) return true;
  return step.allowedActions.includes(actionType);
}

// Does this action satisfy the current step's requiredAction?
function matchesRequiredAction(required, actionType, payload) {
  if (required.type !== actionType) return false;
  if (required.filter) {
    for (const [key, value] of Object.entries(required.filter)) {
      if (payload[key] !== value) return false;
    }
  }
  return true;
}

// Record a battle event. If it satisfies the current step, complete + advance.
// Always refreshes the idle timer (resets the hint) and clears a shown hint.
export function recordAction(steps, state, actionType, payload = {}) {
  if (!state.active || state.completed) return state;
  const step = getCurrentStep(steps, state);
  if (!step) return state;
  const next = { ...state, lastInteractionAt: Date.now(), hintShown: false };

  if (step.requiredAction && matchesRequiredAction(step.requiredAction, actionType, payload)) {
    return completeCurrentStep(steps, next, step);
  }
  return next;
}

// Complete the current step and advance to the next. If the next step has no
// requiredAction AND autoAdvance, the hook auto-advances it via effect.
export function completeCurrentStep(steps, state, step) {
  if (state.completedStepIds.includes(step.id)) return state;
  const completedStepIds = [...state.completedStepIds, step.id];
  const idx = steps.findIndex((s) => s.id === step.id);
  const nextStep = steps[idx + 1] || null;
  return {
    ...state,
    completedStepIds,
    currentStepId: nextStep ? nextStep.id : null,
    awaitingPlayerAction: !!(nextStep && nextStep.requiredAction),
    completed: !nextStep,
  };
}

// Manual advance for informational (Continue) steps only. Steps with a
// requiredAction cannot be advanced by tapping Continue — the player must act.
export function advance(steps, state) {
  const step = getCurrentStep(steps, state);
  if (!step || step.requiredAction) return state;
  return completeCurrentStep(steps, state, step);
}

// Debug: jump directly to a step by id (does not mark skipped steps complete).
export function jumpToStep(steps, state, stepId) {
  const step = steps.find((s) => s.id === stepId);
  if (!step) return state;
  return {
    ...state,
    currentStepId: stepId,
    awaitingPlayerAction: !!step.requiredAction,
    hintShown: false,
    lastInteractionAt: Date.now(),
  };
}

// Debug: mark the current step complete without performing its action.
export function skipCurrentStep(steps, state) {
  const step = getCurrentStep(steps, state);
  if (!step) return state;
  return completeCurrentStep(steps, { ...state, lastInteractionAt: Date.now() }, step);
}

// Debug: restart the whole tutorial from the first step.
export function restartTutorial(steps) {
  return startTutorial(steps);
}

// Should the contextual hint be shown? True after `delayMs` of no interaction
// on a step that has an optionalHint and the player hasn't seen it yet.
export function shouldShowHint(state, now, delayMs = 8000) {
  if (!state.active || state.completed) return false;
  if (state.hintShown) return false;
  if (now - state.lastInteractionAt < delayMs) return false;
  return true;
}

export function markHintShown(state) {
  return { ...state, hintShown: true };
}

// Mark the tutorial fully complete (used by the final-fight success hook).
export function completeTutorial(state) {
  return { ...state, active: false, completed: true, currentStepId: null, awaitingPlayerAction: false };
}