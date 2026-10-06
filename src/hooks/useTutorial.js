import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { TUTORIAL_STEPS, getStepIndex } from '@/game/tutorial/tutorialSteps';
import {
  createInitialTutorialState,
  startTutorial,
  getCurrentStep,
  isActionAllowed,
  recordAction,
  advance,
  completeCurrentStep,
  jumpToStep,
  skipCurrentStep,
  restartTutorial,
  shouldShowHint,
  markHintShown,
  completeTutorial,
  TUT_ACTION,
} from '@/game/tutorial/tutorialEngine';

const HINT_DELAY_MS = 8000;
const AUTO_ADVANCE_MS = 1400;

// useTutorial — the React bridge between the tutorial engine and the battle.
//
// Battle.jsx calls:
//   tutorial.onEvent(actionType, payload)  — after any real action resolves
//   tutorial.isAllowed(actionType)        — to gate input before acting
//   tutorial.continue()                   — when the player taps Continue
//
// The hook owns: current step, hint timer, auto-advance for informational
// steps, debug controls (jump/skip/restart), and the completion flow.
//
// `enabled` gates whether the tutorial is active at all. When false, isAllowed
// always returns true and onEvent is a no-op — normal combat, no overhead.
export function useTutorial({ enabled, onComplete } = {}) {
  const [state, setState] = useState(() =>
    enabled ? startTutorial(TUTORIAL_STEPS) : createInitialTutorialState()
  );
  const [hintVisible, setHintVisible] = useState(false);
  const [tick, setTick] = useState(0); // forces hint re-evaluation
  const completeRef = useRef(onComplete);
  useEffect(() => { completeRef.current = onComplete; }, [onComplete]);

  // Re-enable: if `enabled` flips true, start the tutorial fresh.
  useEffect(() => {
    if (enabled && !state.active && !state.completed) {
      setState(startTutorial(TUTORIAL_STEPS));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const currentStep = useMemo(
    () => getCurrentStep(TUTORIAL_STEPS, state),
    [state.currentStepId, state.active, state.completed]
  );

  // Hint timer: re-check every 1s while waiting on an action step.
  useEffect(() => {
    if (!state.active || state.completed) return;
    if (!currentStep || !currentStep.optionalHint) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [state.active, state.completed, currentStep?.id]);

  // Evaluate hint visibility on each tick.
  useEffect(() => {
    if (!state.active || state.completed) { setHintVisible(false); return; }
    if (shouldShowHint(state, Date.now(), HINT_DELAY_MS)) {
      setHintVisible(true);
      setState((s) => markHintShown(s));
    }
  }, [tick, state.active, state.completed, state.lastInteractionAt, state.hintShown]);

  // Auto-advance informational steps (autoAdvance + no requiredAction).
  useEffect(() => {
    if (!state.active || state.completed) return;
    if (!currentStep || !currentStep.autoAdvance) return;
    if (currentStep.requiredAction) return;
    const t = setTimeout(() => {
      setState((s) => advance(TUTORIAL_STEPS, s));
    }, AUTO_ADVANCE_MS);
    return () => clearTimeout(t);
  }, [state.currentStepId, state.active, state.completed, currentStep?.id]);

  // Fire completion callback when the tutorial finishes.
  useEffect(() => {
    if (state.completed && completeRef.current) {
      completeRef.current();
    }
     
  }, [state.completed]);

  // --- Battle-facing API ---

  const onEvent = useCallback((actionType, payload = {}) => {
    if (!enabled) return;
    setState((s) => recordAction(TUTORIAL_STEPS, s, actionType, payload));
  }, [enabled]);

  const isAllowed = useCallback((actionType) => {
    if (!enabled) return true;
    return isActionAllowed(TUTORIAL_STEPS, state, actionType);
  }, [enabled, state]);

  const continueTutorial = useCallback(() => {
    setState((s) => advance(TUTORIAL_STEPS, s));
  }, []);

  const dismissHint = useCallback(() => {
    setHintVisible(false);
    setState((s) => ({ ...s, lastInteractionAt: Date.now() }));
  }, []);

  // --- Debug controls ---
  const debugJump = useCallback((stepId) => {
    setState((s) => jumpToStep(TUTORIAL_STEPS, s, stepId));
    setHintVisible(false);
  }, []);

  const debugSkip = useCallback(() => {
    setState((s) => skipCurrentStep(TUTORIAL_STEPS, s));
    setHintVisible(false);
  }, []);

  const debugRestart = useCallback(() => {
    setState(restartTutorial(TUTORIAL_STEPS));
    setHintVisible(false);
  }, []);

  const debugComplete = useCallback(() => {
    setState(completeTutorial);
  }, []);

  const debugJumpToFinal = useCallback(() => {
    setState((s) => jumpToStep(TUTORIAL_STEPS, s, 'tut_final_free_form'));
    setHintVisible(false);
  }, []);

  // Signal final-fight success (all required tutorial enemies defeated).
  // Completes the final step and triggers the victory flow.
  const signalFinalVictory = useCallback(() => {
    setState((s) => {
      if (s.currentStepId === 'tut_final_free_form') {
        const step = getCurrentStep(TUTORIAL_STEPS, s);
        if (step) return completeCurrentStep(TUTORIAL_STEPS, s, step);
      }
      return s;
    });
  }, []);

  const stepIndex = getStepIndex(state.currentStepId);
  const totalSteps = TUTORIAL_STEPS.length;

  return {
    active: state.active && enabled,
    completed: state.completed,
    currentStep,
    stepIndex,
    totalSteps,
    hintVisible,
    hint: currentStep?.optionalHint || null,
    // API
    onEvent,
    isAllowed,
    continueTutorial,
    dismissHint,
    signalFinalVictory,
    // Debug
    debugJump,
    debugSkip,
    debugRestart,
    debugComplete,
    debugJumpToFinal,
  };
}

export { TUT_ACTION };