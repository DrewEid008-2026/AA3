import { useEffect, useRef, useCallback } from 'react';
import { enterDowned } from '@/game/downed';
import { TEAMS } from '@/game/constants';
import {
  getZoneForStep, GATE_FOR_ZONE, ENEMIES_FOR_ZONE, PLAYERS_FOR_ZONE,
  SCRIPTED_EVENTS, ZONE_START_STEPS,
} from '@/game/tutorial/tutorialZones';
import { TUTORIAL_GATES } from '@/game/tutorial/tutorialMap';
import { createTutorialPlayerFromDef, createTutorialEnemyFromDef } from '@/game/tutorial/tutorialUnits';

// useTutorialMission — the zone controller for the handcrafted Tutorial.
//
// Watches the tutorial step (from useTutorial) and manages all tutorial-specific
// battle state as the player progresses through the six teaching zones:
//
//   • Opens gates (unblocks gate tiles) when a zone advances.
//   • Spawns scripted enemies for each zone.
//   • Adds player units (e.g., Heavy in Zone 3) when a zone opens.
//   • Retreats surviving enemies from the previous zone (keeps the board clean).
//   • Fires the scripted Downed event (forces tut_soldier_1 to 0 HP).
//   • Grants / removes temporary Commander access for the Tactical Advance demo.
//   • Refreshes player AP at action steps so the player never gets stuck.
//
// All modifications use the real combat state (setGrid / setUnits) — no fake
// mechanics. The hook is a no-op when isTutorial is false.
//
// Battle.jsx calls:
//   const tutorialMission = useTutorialMission({ isTutorial, tutorial, setGrid, ... });
//   tutorialMission.resetTutorialMission()  — on retry
export function useTutorialMission({
  isTutorial, tutorial, setGrid, setUnits,
  setCommanderTutorialMode,
}) {
  // Track the last processed step so each transition fires exactly once.
  const processedStepRef = useRef(null);
  // Track which zones have had their enemies spawned (idempotency).
  const spawnedZonesRef = useRef(new Set());

  // Reset all tutorial mission state (called on retry / restart).
  const resetTutorialMission = useCallback(() => {
    processedStepRef.current = null;
    spawnedZonesRef.current = new Set();
    setCommanderTutorialMode(false);
  }, [setCommanderTutorialMode]);

  // Open a gate by setting its gate tiles to OPEN (non-mutating).
  const openGate = useCallback((gateId) => {
    const gate = TUTORIAL_GATES[gateId];
    if (!gate) return;
    setGrid((prev) => prev.map((row, y) => {
      if (y !== gate.y) return row;
      return row.map((tile) => {
        if (tile.isTutorialGate && tile.tutorialGateId === gateId) {
          return { ...tile, type: 'open', isTutorialGate: false };
        }
        return tile;
      });
    }));
  }, [setGrid]);

  // Spawn enemies for a zone (idempotent via spawnedZonesRef).
  const spawnEnemies = useCallback((zone) => {
    if (spawnedZonesRef.current.has(zone)) return;
    spawnedZonesRef.current.add(zone);
    const defs = ENEMIES_FOR_ZONE[zone];
    if (!defs) return;
    const newEnemies = defs.map((def) => createTutorialEnemyFromDef(def));
    setUnits((prev) => [...prev, ...newEnemies]);
  }, [setUnits]);

  // Add player units for a zone (e.g., Heavy joins in Zone 3).
  const addPlayers = useCallback((zone) => {
    const defs = PLAYERS_FOR_ZONE[zone];
    if (!defs) return;
    // Idempotent: only add if not already present.
    setUnits((prev) => {
      const existing = new Set(prev.map((u) => u.id));
      const toAdd = defs.filter((d) => !existing.has(d.tutId));
      if (toAdd.length === 0) return prev;
      return [...prev, ...toAdd.map((d) => createTutorialPlayerFromDef(d))];
    });
  }, [setUnits]);

  // Retreat surviving enemies from a completed zone (they withdraw).
  const retreatZoneEnemies = useCallback((zone) => {
    const defs = ENEMIES_FOR_ZONE[zone];
    if (!defs) return;
    const ids = new Set(defs.map((d) => d.tutId));
    setUnits((prev) => prev.map((u) => {
      if (u.team === TEAMS.ENEMY && u.alive && ids.has(u.id)) {
        return { ...u, alive: false, retreated: true };
      }
      return u;
    }));
  }, [setUnits]);

  // Scripted Downed event: force tut_soldier_1 to 0 HP → Downed state.
  const fireDownedEvent = useCallback(() => {
    setUnits((prev) => prev.map((u) => {
      if (u.id === 'tut_soldier_1' && u.alive && !u.downed) {
        return enterDowned({ ...u, hp: 0, missionDowned: true });
      }
      return u;
    }));
  }, [setUnits]);

  // Refresh all living player units' AP to max (keeps the tutorial flowing).
  const refreshAP = useCallback(() => {
    setUnits((prev) => prev.map((u) => {
      if (u.team === TEAMS.PLAYER && u.alive && !u.downed) {
        return { ...u, ap: u.maxAp };
      }
      return u;
    }));
  }, [setUnits]);

  // Main processing effect — fires on each step transition.
  useEffect(() => {
    if (!isTutorial || !tutorial.active || tutorial.completed) return;
    const stepId = tutorial.currentStep?.id;
    if (!stepId || stepId === processedStepRef.current) return;
    processedStepRef.current = stepId;

    const zone = getZoneForStep(stepId);

    // Zone-start processing: open gate, spawn enemies, add players, retreat previous.
    if (zone && ZONE_START_STEPS[zone] === stepId) {
      if (GATE_FOR_ZONE[zone] != null) {
        openGate(GATE_FOR_ZONE[zone]);
      }
      if (ENEMIES_FOR_ZONE[zone]) {
        spawnEnemies(zone);
      }
      if (PLAYERS_FOR_ZONE[zone]) {
        addPlayers(zone);
      }
      // Retreat enemies from the previous zone (keep the board clean).
      if (zone > 2 && ENEMIES_FOR_ZONE[zone - 1]) {
        retreatZoneEnemies(zone - 1);
      }
    }

    // Scripted events.
    if (stepId === SCRIPTED_EVENTS.downedEvent) {
      fireDownedEvent();
    }
    if (stepId === SCRIPTED_EVENTS.commanderDemoStart) {
      setCommanderTutorialMode(true);
    }
    if (stepId === SCRIPTED_EVENTS.commanderDemoEnd) {
      setCommanderTutorialMode(false);
    }

    // AP refresh at action steps so the player never gets stuck.
    if (tutorial.currentStep?.requiredAction) {
      refreshAP();
    }
  }, [
    tutorial.currentStep?.id, isTutorial, tutorial.active, tutorial.completed,
    tutorial.currentStep,
    openGate, spawnEnemies, addPlayers, retreatZoneEnemies, fireDownedEvent, refreshAP,
    setCommanderTutorialMode,
  ]);

  return { resetTutorialMission };
}

export default useTutorialMission;