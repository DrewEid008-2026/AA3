import { isInExtractionZone, isAdjacent } from '@/game/missions';

// Objective action handlers (EXTRACT, RESCUE, SABOTAGE, REVIVE) extracted from
// Battle.jsx. Each handler is the same logic that lived inline — no behavior
// change. The hook closes over the current values passed in, so handlers
// always see fresh state.
export function useObjectiveActions({
  inputLocked, selectedUnit,
  extractionZone, extractedIds, setExtractedIds,
  civilian, setCivilian,
  device, setDevice,
  withBurning, setUnits, flashAttackFeedback, pushPopup,
  showActionBubble,
}) {
  const handleExtract = () => {
    if (inputLocked || !selectedUnit) return;
    if (!isInExtractionZone(extractionZone, selectedUnit.x, selectedUnit.y)) return;
    if (extractedIds.has(selectedUnit.id)) return;
    setExtractedIds((prev) => new Set([...prev, selectedUnit.id]));
    flashAttackFeedback(selectedUnit.x, selectedUnit.y, 'EXTRACTED', 'status');
  };

  // RESCUE: 1 AP. Attach the civilian to the selected unit. The civilian
  // follows the escort until extracted or the escort dies. Burning triggers
  // after the action (Rescue counts as an action per the spec).
  const handleRescue = () => {
    if (inputLocked || !selectedUnit || !civilian || civilian.rescued || civilian.safe) return;
    if (!isAdjacent(selectedUnit, civilian)) return;
    if (selectedUnit.ap < 1) return;
    const finalUnit = withBurning(
      { ...selectedUnit, ap: Math.max(0, selectedUnit.ap - 1), reaction: null },
      selectedUnit.x, selectedUnit.y
    );
    setUnits((prev) => prev.map((u) => (u.id === selectedUnit.id ? finalUnit : u)));
    setCivilian((prev) => ({ ...prev, rescued: true, escortId: selectedUnit.id, x: selectedUnit.x, y: selectedUnit.y }));
    flashAttackFeedback(selectedUnit.x, selectedUnit.y, 'RESCUED', 'status');
  };

  // SABOTAGE: 1 AP. Destroy the objective device. Objective is secured
  // immediately (the useEffect detects device.sabotaged). Burning triggers.
  const handleSabotage = () => {
    if (inputLocked || !selectedUnit || !device || device.sabotaged) return;
    if (!isAdjacent(selectedUnit, device)) return;
    if (selectedUnit.ap < 1) return;
    const finalUnit = withBurning(
      { ...selectedUnit, ap: Math.max(0, selectedUnit.ap - 1), reaction: null },
      selectedUnit.x, selectedUnit.y
    );
    setUnits((prev) => prev.map((u) => (u.id === selectedUnit.id ? finalUnit : u)));
    setDevice((prev) => ({ ...prev, sabotaged: true }));
    flashAttackFeedback(device.x, device.y, 'SABOTAGED', 'status');
  };

  return { handleExtract, handleRescue, handleSabotage };
}