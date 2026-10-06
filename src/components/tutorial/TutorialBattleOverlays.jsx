import React from 'react';
import TutorialPanel from './TutorialPanel';
import TutorialDebugPanel from './TutorialDebugPanel';

// TutorialBattleOverlays — renders the tutorial panel and debug panel.
// The highlight layer is rendered INSIDE Battlefield (via the
// `tutorialHighlights` prop) so it shares the same percentage-based coordinate
// system as the grid tiles.
//
// Props:
//   tutorial — the useTutorial hook return value
//   debug    — whether dev debug mode is on
export default function TutorialBattleOverlays({ tutorial, debug }) {
  const { active, currentStep } = tutorial;

  if (!active) return null;

  return (
    <>
      <TutorialPanel
        step={currentStep}
        hintVisible={tutorial.hintVisible}
        hint={tutorial.hint}
        onContinue={tutorial.continueTutorial}
        onDismissHint={tutorial.dismissHint}
        stepIndex={tutorial.stepIndex}
        totalSteps={tutorial.totalSteps}
      />
      <TutorialDebugPanel
        debug={debug}
        active={active}
        currentStep={currentStep}
        stepIndex={tutorial.stepIndex}
        totalSteps={tutorial.totalSteps}
        onJump={tutorial.debugJump}
        onSkip={tutorial.debugSkip}
        onRestart={tutorial.debugRestart}
        onJumpToFinal={tutorial.debugJumpToFinal}
        onComplete={tutorial.debugComplete}
      />
    </>
  );
}