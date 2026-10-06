import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  createInitialHarvesterState,
  checkPhase2Condition,
  checkPhase3Condition,
  defeatHarvester,
  getHarvesterUnit,
  HARVESTER_PHASES,
  PHASE_2_MOVEMENT,
} from '@/game/harvesterState';
import { createTremorSlam, getTremorTileKeys } from '@/game/tremorSlam';
import { createExcavationBeam, getBeamTileKeys } from '@/game/excavationBeam';
import {
  computeChargePath,
  createSiegeCharge,
  getChargePathKeys,
  CHARGE_DIRS,
} from '@/game/siegeCharge';
import {
  createMeltdownZones,
} from '@/game/meltdownZones';
import {
  createCoreDischarge,
  getCoreDischargeTileKeys,
} from '@/game/coreDischarge';

// Encapsulates The Harvester's mission-local state: phase, pending hazards
// (Tremor Slam + Excavation Beam), and the Phase 2 condition hook. Also
// provides debug handlers (Part 60). Keeps Battle.jsx thin by owning all
// Harvester-specific state + refs.
//
// The enemy-phase detonation logic lives in Battle.jsx (it needs the async
// `work` array), but this hook provides the refs and setters it reads/writes.
export function useHarvesterMission({ missionConfig, units, setUnits }) {
  const isHarvesterMission = useMemo(
    () => !!(missionConfig && missionConfig.isBoss && missionConfig.bossMapId === 'harvester_pit_ch2'),
    [missionConfig]
  );

  const [harvesterState, setHarvesterState] = useState(createInitialHarvesterState());
  const [pendingTremor, setPendingTremor] = useState(null);
  const [pendingBeam, setPendingBeam] = useState(null);
  const [pendingCharge, setPendingCharge] = useState(null);
  const [pendingMeltdown, setPendingMeltdown] = useState(null); // array of zone objects
  const [pendingCoreDischarge, setPendingCoreDischarge] = useState(null); // single object

  const harvesterStateRef = useRef(harvesterState);
  useEffect(() => { harvesterStateRef.current = harvesterState; }, [harvesterState]);
  const pendingTremorRef = useRef(pendingTremor);
  useEffect(() => { pendingTremorRef.current = pendingTremor; }, [pendingTremor]);
  const pendingBeamRef = useRef(pendingBeam);
  useEffect(() => { pendingBeamRef.current = pendingBeam; }, [pendingBeam]);
  const pendingChargeRef = useRef(pendingCharge);
  useEffect(() => { pendingChargeRef.current = pendingCharge; }, [pendingCharge]);
  const pendingMeltdownRef = useRef(pendingMeltdown);
  useEffect(() => { pendingMeltdownRef.current = pendingMeltdown; }, [pendingMeltdown]);
  const pendingCoreDischargeRef = useRef(pendingCoreDischarge);
  useEffect(() => { pendingCoreDischargeRef.current = pendingCoreDischarge; }, [pendingCoreDischarge]);

  const harvesterUnit = useMemo(
    () => isHarvesterMission ? getHarvesterUnit(units) : null,
    [isHarvesterMission, units]
  );

  // Reset all Harvester state for a fresh encounter (initial entry + restart).
  const resetHarvester = useCallback(() => {
    setHarvesterState(createInitialHarvesterState());
    setPendingTremor(null);
    setPendingBeam(null);
    setPendingCharge(null);
    setPendingMeltdown(null);
    setPendingCoreDischarge(null);
  }, []);

  // Phase 2 condition hook: check after any damage to the Harvester. Triggers
  // the actual phase transition (bossPhase → PHASE_2_ADVANCE, Move 3 → 5)
  // exactly once when Current Armor ≤ 2. Lethal edge case: HP 0 → no transition.
  // Also chains the Phase 3 condition check (HP ≤ 10).
  const checkPhase2Hook = useCallback(() => {
    if (!isHarvesterMission || !harvesterUnit) return;
    const prev = harvesterStateRef.current;
    const next = checkPhase2Condition(prev, harvesterUnit);
    const nextWithP3 = checkPhase3Condition(next, harvesterUnit);
    if (nextWithP3 !== prev) {
      setHarvesterState(nextWithP3);
      // Phase 2: increase movement 3 → 5 (Part 7).
      if (nextWithP3.phase2Triggered && !prev.phase2Triggered) {
        setUnits((u) => u.map((x) =>
          x.id === harvesterUnit.id ? { ...x, movement: PHASE_2_MOVEMENT } : x
        ));
      }
      // Phase 3: ensure MOVE 5 (Part 5). If Phase 2 was skipped (Armor still
      // high but HP ≤ 10), set movement to 5 now.
      if (nextWithP3.phase3Triggered && !prev.phase3Triggered) {
        setUnits((u) => u.map((x) =>
          x.id === harvesterUnit.id ? { ...x, movement: PHASE_2_MOVEMENT } : x
        ));
      }
    }
  }, [isHarvesterMission, harvesterUnit, setUnits]);

  // Phase 3 condition hook: check after any damage. Triggers the actual
  // transition (bossPhase → PHASE_3_CORE_FAILURE) exactly once when HP ≤ 10.
  // Death priority (Part 2): HP 0 → no transition. Idempotent.
  const checkPhase3Hook = useCallback(() => {
    if (!isHarvesterMission || !harvesterUnit) return;
    const prev = harvesterStateRef.current;
    const next = checkPhase3Condition(prev, harvesterUnit);
    if (next !== prev) {
      setHarvesterState(next);
      // Ensure MOVE 5 if Phase 2 was skipped (Part 5).
      if (next.phase3Triggered && !prev.phase3Triggered) {
        setUnits((u) => u.map((x) =>
          x.id === harvesterUnit.id ? { ...x, movement: PHASE_2_MOVEMENT } : x
        ));
      }
    }
  }, [isHarvesterMission, harvesterUnit, setUnits]);

  // Cancel all pending hazards (call on Harvester defeat — Parts 22, 50).
  const cancelHarvesterHazards = useCallback(() => {
    setPendingTremor(null);
    setPendingBeam(null);
    setPendingCharge(null);
    setPendingMeltdown(null);
    setPendingCoreDischarge(null);
  }, []);

  // Mark the Harvester as defeated (call when HP reaches 0).
  const markHarvesterDefeated = useCallback(() => {
    setHarvesterState((prev) => defeatHarvester(prev));
    cancelHarvesterHazards();
  }, [cancelHarvesterHazards]);

  // --- Debug handlers (Part 60) ---
  const debugSetHp = useCallback((hp) => {
    if (!harvesterUnit) return;
    const clamped = Math.max(0, Math.min(harvesterUnit.maxHp, hp));
    setUnits((prev) => prev.map((u) =>
      u.id === harvesterUnit.id ? { ...u, hp: clamped, alive: clamped > 0 } : u
    ));
  }, [harvesterUnit, setUnits]);

  const debugSetArmor = useCallback((armor) => {
    if (!harvesterUnit) return;
    const base = harvesterUnit.armor || 6;
    const clamped = Math.max(0, Math.min(base, armor));
    setUnits((prev) => prev.map((u) =>
      u.id === harvesterUnit.id ? { ...u, currentArmor: clamped } : u
    ));
    // Trigger phase 2 hook check after armor change.
    setTimeout(() => checkPhase2Hook(), 0);
  }, [harvesterUnit, setUnits, checkPhase2Hook]);

  const debugResetCooldowns = useCallback(() => {
    if (!harvesterUnit) return;
    setUnits((prev) => prev.map((u) =>
      u.id === harvesterUnit.id ? { ...u, cooldowns: {} } : u
    ));
  }, [harvesterUnit, setUnits]);

  const debugForceTremor = useCallback(() => {
    if (!harvesterUnit) return;
    // Target the best cluster near the players (simple: center on the densest
    // player cluster). For dev testing, just pick the first player's area.
    const players = units.filter((u) => u.alive && u.team === 'player' && !u.downed);
    if (players.length === 0) return;
    // Center on the median player position.
    const sorted = [...players].sort((a, b) => a.x - b.x);
    const cx = sorted[Math.floor(sorted.length / 2)].x;
    const cy = players[0].y;
    setPendingTremor(createTremorSlam(cx, cy, harvesterUnit.id, 0));
  }, [harvesterUnit, units]);

  const debugForceBeam = useCallback(() => {
    if (!harvesterUnit) return;
    const players = units.filter((u) => u.alive && u.team === 'player' && !u.downed);
    if (players.length === 0) return;
    // Pick the row or column with the most players.
    const rowCounts = {};
    const colCounts = {};
    for (const p of players) {
      rowCounts[p.y] = (rowCounts[p.y] || 0) + 1;
      colCounts[p.x] = (colCounts[p.x] || 0) + 1;
    }
    let bestRow = -1, bestRowCount = 0;
    for (const [y, c] of Object.entries(rowCounts)) {
      if (c > bestRowCount) { bestRowCount = c; bestRow = Number(y); }
    }
    let bestCol = -1, bestColCount = 0;
    for (const [x, c] of Object.entries(colCounts)) {
      if (c > bestColCount) { bestColCount = c; bestCol = Number(x); }
    }
    if (bestRowCount >= bestColCount && bestRow >= 0) {
      setPendingBeam(createExcavationBeam('row', bestRow, harvesterUnit.id, 0));
    } else if (bestCol >= 0) {
      setPendingBeam(createExcavationBeam('column', bestCol, harvesterUnit.id, 0));
    }
  }, [harvesterUnit, units]);

  const debugResolveHazard = useCallback(() => {
    // Mark the pending hazard as resolved (clear it). The actual damage
    // resolution happens in the enemy phase; this just clears the telegraph
    // for dev testing without waiting for the next enemy phase.
    setPendingTremor(null);
    setPendingBeam(null);
    setPendingCharge(null);
  }, []);

  // --- Phase 2 + Siege Charge debug controls (Part 58) ---

  // Force Phase 2 transition immediately (sets Armor to 2 + triggers transition
  // + queues the Fabrication Sequence).
  const debugForcePhase2 = useCallback(() => {
    if (!harvesterUnit) return;
    setUnits((u) => u.map((x) =>
      x.id === harvesterUnit.id ? { ...x, currentArmor: 2, movement: PHASE_2_MOVEMENT } : x
    ));
    setHarvesterState((prev) => ({
      ...prev,
      phase2ConditionMet: true,
      phase2Triggered: true,
      fabricationSequenceTriggered: true,
      bossPhase: HARVESTER_PHASES.PHASE_2_ADVANCE,
    }));
  }, [harvesterUnit, setUnits]);

  // Force the Fabrication Sequence to spawn next Enemy Phase (dev testing).
  const debugForceFabrication = useCallback(() => {
    setHarvesterState((prev) => ({
      ...prev,
      phase2Triggered: true,
      fabricationSequenceTriggered: true,
      phase2ReinforcementsSpawned: false,
      bossPhase: HARVESTER_PHASES.PHASE_2_ADVANCE,
    }));
  }, []);

  // Reset to Phase 1 (Armor 6, Move 3, clear pending hazards).
  const debugResetPhase1 = useCallback(() => {
    if (!harvesterUnit) return;
    const base = harvesterUnit.armor || 6;
    setUnits((u) => u.map((x) =>
      x.id === harvesterUnit.id ? { ...x, currentArmor: base, movement: 3 } : x
    ));
    setHarvesterState(createInitialHarvesterState());
    setPendingTremor(null);
    setPendingBeam(null);
    setPendingCharge(null);
  }, [harvesterUnit, setUnits]);

  // Force a Siege Charge in the best available direction.
  const debugForceCharge = useCallback(() => {
    if (!harvesterUnit) return;
    // Pick the direction with the most soldiers in the path.
    let best = null;
    for (const dir of CHARGE_DIRS) {
      const pathData = computeChargePath(units, harvesterUnit.x, harvesterUnit.y, dir);
      if (pathData.path.length === 0) continue;
      const keys = new Set(pathData.path.map((t) => `${t.x},${t.y}`));
      const hits = units.filter((u) => u.alive && u.team === 'player' && !u.downed && keys.has(`${u.x},${u.y}`)).length;
      if (!best || hits > best.hits || (hits === best.hits && pathData.path.length > best.pathLen)) {
        best = { dir, path: pathData.path, destination: pathData.destination, hits, pathLen: pathData.path.length };
      }
    }
    if (!best) return;
    setPendingCharge(createSiegeCharge(
      harvesterUnit.x, harvesterUnit.y, best.dir, best.path, best.destination, harvesterUnit.id, 0
    ));
  }, [harvesterUnit, units]);

  // Resolve the pending Siege Charge immediately (clear it for dev testing).
  const debugResolveCharge = useCallback(() => {
    setPendingCharge(null);
  }, []);

  // --- Phase 3 debug controls (Part 51) ---

  // Force Phase 3 (Core Failure) transition immediately.
  const debugForcePhase3 = useCallback(() => {
    if (!harvesterUnit) return;
    setUnits((u) => u.map((x) =>
      x.id === harvesterUnit.id ? { ...x, movement: PHASE_2_MOVEMENT } : x
    ));
    setHarvesterState((prev) => ({
      ...prev,
      phase3ConditionMet: true,
      phase3Triggered: true,
      bossPhase: HARVESTER_PHASES.PHASE_3_CORE_FAILURE,
    }));
  }, [harvesterUnit, setUnits]);

  // Reset to Phase 2 (clear Phase 3 state + pending Meltdown/Core Discharge).
  const debugResetPhase3 = useCallback(() => {
    setHarvesterState((prev) => ({
      ...prev,
      phase3ConditionMet: false,
      phase3Triggered: false,
      coreDischargeUsed: false,
      bossPhase: HARVESTER_PHASES.PHASE_2_ADVANCE,
    }));
    setPendingMeltdown(null);
    setPendingCoreDischarge(null);
  }, []);

  // Create Meltdown Zones immediately (dev testing).
  const debugForceMeltdown = useCallback(() => {
    if (!harvesterUnit) return;
    // Gather pending hazard keys for combined safety.
    const hazardKeys = new Set();
    if (pendingTremorRef.current) for (const k of getTremorTileKeys(pendingTremorRef.current)) hazardKeys.add(k);
    if (pendingBeamRef.current) for (const k of getBeamTileKeys(pendingBeamRef.current)) hazardKeys.add(k);
    if (pendingChargeRef.current) for (const k of getChargePathKeys(pendingChargeRef.current)) hazardKeys.add(k);
    if (pendingCoreDischargeRef.current) for (const k of getCoreDischargeTileKeys(pendingCoreDischargeRef.current)) hazardKeys.add(k);
    const zones = createMeltdownZones(units, units, harvesterUnit, pendingMeltdownRef.current, hazardKeys, 0);
    if (zones.length > 0) setPendingMeltdown(zones);
  }, [harvesterUnit, units]);

  // Resolve pending Meltdown Zones immediately (clear for dev testing).
  const debugResolveMeltdown = useCallback(() => {
    setPendingMeltdown(null);
  }, []);

  // Force Core Discharge (schedule it at the Harvester's current position).
  const debugForceCoreDischarge = useCallback(() => {
    if (!harvesterUnit) return;
    setPendingCoreDischarge(createCoreDischarge(harvesterUnit, units, 0));
  }, [harvesterUnit, units]);

  // Resolve pending Core Discharge immediately (clear for dev testing).
  const debugResolveCoreDischarge = useCallback(() => {
    setPendingCoreDischarge(null);
  }, []);

  return {
    isHarvesterMission,
    harvesterState,
    setHarvesterState,
    harvesterStateRef,
    pendingTremor,
    setPendingTremor,
    pendingTremorRef,
    pendingBeam,
    setPendingBeam,
    pendingBeamRef,
    pendingCharge,
    setPendingCharge,
    pendingChargeRef,
    pendingMeltdown,
    setPendingMeltdown,
    pendingMeltdownRef,
    pendingCoreDischarge,
    setPendingCoreDischarge,
    pendingCoreDischargeRef,
    harvesterUnit,
    resetHarvester,
    checkPhase2Hook,
    checkPhase3Hook,
    cancelHarvesterHazards,
    markHarvesterDefeated,
    // Debug
    debugSetHp,
    debugSetArmor,
    debugResetCooldowns,
    debugForceTremor,
    debugForceBeam,
    debugResolveHazard,
    debugForcePhase2,
    debugForceFabrication,
    debugResetPhase1,
    debugForceCharge,
    debugResolveCharge,
    debugForcePhase3,
    debugResetPhase3,
    debugForceMeltdown,
    debugResolveMeltdown,
    debugForceCoreDischarge,
    debugResolveCoreDischarge,
  };
}