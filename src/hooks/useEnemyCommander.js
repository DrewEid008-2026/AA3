// Enemy Commander battle hook — owns the mission-local enemy Commander state
// for the Battle page, including the command execution pipeline.
//
// Responsibilities:
//   - resolve the hostile commander for the mission (mission field + dev override)
//   - initialize battle state from the profile (or restore from a saved snapshot)
//   - persist battle state to the campaign blob on change (save/load support)
//   - tick cooldowns + reset per-phase command count on phase transitions
//   - execute enemy Commander commands through the centralized transaction
//   - drive the player-facing command notification banner
//   - expose dev controls (force command, spend simulation, budget reset)
//   - clear state on terminal/restart so nothing leaks to the next mission
//
// Command execution flow (3.2.2):
//   evaluate → validate → lock → spend budget → resolve effect → update state → banner
//   The enemy phase runner calls processEnemyCommanderAction at the defined
//   action window (after pending effects, before normal enemy activations).

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  resolveEnemyCommanderForMission,
  getEnemyCommanderDisplayProfile,
} from '@/game/enemyCommanders';
import {
  createEnemyCommanderBattleState,
  resetEnemyCommanderBattleState,
  spendCommandPoints,
  getCommandBudgetCurrent,
  getCommandBudgetMax,
  canIssueCommandThisPhase,
  resetPhaseCommandCount,
  tickEnemyCooldowns,
  deserializeEnemyCommanderBattleState,
  saveEnemyCommanderBattleState,
  loadEnemyCommanderBattleState,
  clearEnemyCommanderBattleState,
} from '@/game/enemyCommanderBattleState';
import {
  executeEnemyCommanderSkillTransaction,
  generateEnemyTransactionId,
  ENEMY_COMMANDER_TX_RESULT,
} from '@/game/enemyCommanderTransactions';
import { evaluateEnemyCommanderActions } from '@/game/enemyCommanderAi';
import { getCommanderSkill, isValidCommanderTarget } from '@/game/commanderSkills';
import {
  getEnemyCommanderState,
  getMissionCommanderAssignment,
  shouldRecordEncounter,
  recordCommanderEncounter,
  incrementMissionsSinceVexar,
  shouldShowCommanderTutorial,
  markCommanderTutorialShown,
  clearMissionCommanderAssignment,
  writeEnemyCommanderState,
} from '@/game/enemyCommanderAssignment';

const BANNER_MS = 2800;
const COMMAND_BANNER_MS = 2000;

export function useEnemyCommander({ missionId, missionConfig, phase, isTerminal, debug, units, grid, GRID_WIDTH, GRID_HEIGHT, setUnits }) {
  const [profile, setProfile] = useState(null);
  const [battleState, setBattleState] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  // Command notification: { skillName, commanderName } or null. Shown briefly
  // when a hostile Commander executes a command during the Enemy Phase.
  const [commandNotification, setCommandNotification] = useState(null);
  // Last transaction result — for debug inspection.
  const [lastExecutionResult, setLastExecutionResult] = useState(null);
  // Last AI evaluation (decision + candidate breakdown) — for dev inspection.
  const [lastEvaluation, setLastEvaluation] = useState(null);
  // Dev override: null = use mission field, 'NONE' = force no commander,
  // '<commanderId>' = force that commander. Only set via the debug panel.
  const [devOverride, setDevOverride] = useState(null);
  // AI tuning overrides — dev-only. { holdThreshold, reserveBias, invalidateTargetId }
  const [aiOverrides, setAiOverrides] = useState(null);
  const aiOverridesRef = useRef(null);
  useEffect(() => { aiOverridesRef.current = aiOverrides; }, [aiOverrides]);
  const [assignmentSource, setAssignmentSource] = useState('none');
  const [assignmentValid, setAssignmentValid] = useState(true);
  const [assignmentReason, setAssignmentReason] = useState(null);
  // First-encounter tracking: true when this mission is the player's first
  // hostile Commander encounter (drives banner text + tutorial overlay).
  const [isFirstEncounter, setIsFirstEncounter] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [assignmentDebugReason, setAssignmentDebugReason] = useState(null);
  const encounterRecordedRef = useRef(false);

  const bannerTimer = useRef(null);
  const commandBannerTimer = useRef(null);
  const prevPhaseRef = useRef(phase);
  const firstEnemyPhaseRef = useRef(true);
  const battleStateRef = useRef(battleState);
  useEffect(() => { battleStateRef.current = battleState; }, [battleState]);
  const profileRef = useRef(profile);
  useEffect(() => { profileRef.current = profile; }, [profile]);

  // Transaction safety: committed transaction IDs (idempotency guard) + action lock.
  const committedTxIdsRef = useRef(new Set());
  const actionLockRef = useRef(false);

  const enemyCommanderActive = !!(profile && battleState);
  const displayProfile = profile ? getEnemyCommanderDisplayProfile(profile) : null;

  // --- Mission / override init ---
  useEffect(() => {
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    // Read the dynamic campaign assignment (from enemyCommanderAssignment.js).
    // This takes precedence over the static mission.hostileCommanderId field.
    const campaignAssignment = getMissionCommanderAssignment(missionId);
    const resolved = resolveEnemyCommanderForMission(missionConfig, { devOverride, campaignAssignment });
    setAssignmentSource(resolved.source);
    setAssignmentValid(resolved.valid);
    setAssignmentReason(resolved.reason || null);
    setAssignmentDebugReason(campaignAssignment?.reason || null);

    // --- Production encounter tracking (spec 3.2.6 §7, §23, §24) ---
    // Only production assignments (campaign_assignment source) record encounters
    // and update the anti-spam counter. Dev overrides bypass all production state.
    const isProduction = resolved.source !== 'dev_override';
    const isCh3Sabotage = missionConfig?.chapterId === 'ch3' && missionConfig?.type === 'sabotage';
    if (isProduction && isCh3Sabotage) {
      const ecState = getEnemyCommanderState();
      if (resolved.profile && !resolved.profile.isDev) {
        // Commander assigned to this mission.
        const commanderId = resolved.profile.commanderId;
        const wasEncountered = !!ecState.commanders[commanderId]?.encountered;
        const firstEncounter = !wasEncountered;
        if (shouldRecordEncounter(ecState, commanderId, missionId)) {
          const nextState = recordCommanderEncounter(ecState, commanderId, missionId);
          writeEnemyCommanderState(nextState);
        }
        setIsFirstEncounter(firstEncounter);
        // Show tutorial on first encounter only (spec §9, §42).
        if (firstEncounter && shouldShowCommanderTutorial(ecState)) {
          setShowTutorial(true);
        }
      } else {
        // No commander assigned — increment the anti-spam counter.
        const nextState = incrementMissionsSinceVexar(ecState);
        writeEnemyCommanderState(nextState);
        setIsFirstEncounter(false);
      }
    } else {
      setIsFirstEncounter(false);
    }
    encounterRecordedRef.current = true;

    if (!resolved.profile) {
      setProfile(null);
      setBattleState(null);
      setShowBanner(false);
      setCommandNotification(null);
      clearEnemyCommanderBattleState();
      return;
    }

    setProfile(resolved.profile);
    const savedSnapshot = loadEnemyCommanderBattleState(missionId);
    const restored = savedSnapshot ? deserializeEnemyCommanderBattleState(savedSnapshot, resolved.profile) : null;
    setBattleState(restored || createEnemyCommanderBattleState(resolved.profile));
    firstEnemyPhaseRef.current = true;
    prevPhaseRef.current = phase;
    setShowBanner(true);
    bannerTimer.current = setTimeout(() => setShowBanner(false), BANNER_MS);
    // Reset transaction tracking for this mission.
    committedTxIdsRef.current = new Set();
    actionLockRef.current = false;
    setLastExecutionResult(null);
    return () => {
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
      // Do NOT clear the assignment on unmount — it must persist through
      // save/load and temporary navigation (spec §4). The assignment is
      // cleared explicitly on terminal (mission complete/failed) and on
      // explicit abandon (clearOnExit). Restart does not unmount.
    };
  }, [missionId, devOverride]);

  // --- Persist battle state on change (save/load support) ---
  useEffect(() => {
    if (!profile || !battleState) return;
    saveEnemyCommanderBattleState(missionId, battleState);
  }, [battleState, profile, missionId]);

  // --- Phase transitions: cooldown tick + per-phase command reset ---
  useEffect(() => {
    if (phase === 'enemy' && prevPhaseRef.current !== 'enemy') {
      setBattleState((prev) => {
        if (!prev) return prev;
        let next = resetPhaseCommandCount(prev);
        if (firstEnemyPhaseRef.current) {
          firstEnemyPhaseRef.current = false;
        } else {
          next = tickEnemyCooldowns(next);
        }
        return next;
      });
    }
    prevPhaseRef.current = phase;
  }, [phase]);

  // --- Terminal cleanup ---
  // On mission complete/failed: clear both the battle state AND the cached
  // assignment so a replay re-evaluates (recurrence check). The battle state
  // must be cleared so a fresh attempt starts at full budget.
  useEffect(() => {
    if (isTerminal) {
      setPanelOpen(false);
      setCommandNotification(null);
      clearEnemyCommanderBattleState();
      clearMissionCommanderAssignment(missionId);
    }
  }, [isTerminal, missionId]);

  // --- Command notification banner ---
  const showCommandNotification = useCallback((skillName) => {
    if (commandBannerTimer.current) clearTimeout(commandBannerTimer.current);
    const commanderName = profileRef.current
      ? getEnemyCommanderDisplayProfile(profileRef.current)?.displayName || 'ENEMY COMMANDER'
      : 'ENEMY COMMANDER';
    setCommandNotification({ skillName, commanderName });
    commandBannerTimer.current = setTimeout(() => setCommandNotification(null), COMMAND_BANNER_MS);
  }, []);

  // --- Execute a single enemy Commander command (core transaction) ---
  // Called by processEnemyCommanderAction (auto-execution) and by debug force
  // buttons. Returns the raw transaction result.
  const executeEnemyCommand = useCallback((skillId, target, ctx = {}) => {
    if (actionLockRef.current) {
      return { ok: false, result: 'locked', skillId, message: 'Action lock held' };
    }
    actionLockRef.current = true;

    const transactionId = ctx.transactionId || generateEnemyTransactionId();
    const context = {
      profile: profileRef.current,
      battleState: battleStateRef.current,
      units: ctx.units || units,
      grid: ctx.grid || grid,
      GRID_WIDTH: ctx.GRID_WIDTH || GRID_WIDTH,
      GRID_HEIGHT: ctx.GRID_HEIGHT || GRID_HEIGHT,
      phase: ctx.phase || phase,
      committedTransactionIds: committedTxIdsRef.current,
      transactionId,
      allowAnyPhase: !!ctx.allowAnyPhase,
    };

    let result;
    try {
      result = executeEnemyCommanderSkillTransaction(skillId, target, context);
      if (result.ok) {
        committedTxIdsRef.current.add(transactionId);
        setBattleState(result.battleStateAfter);
        // Apply unit effect (e.g., Tactical Advance +1 AP) to game units. The
        // transaction owns the Command Budget; the hook owns unit mutation.
        // Idempotency: the transaction ID guard prevents duplicate execution,
        // so this block runs at most once per transaction.
        if (result.unitEffect?.type === 'ap_grant' && setUnits) {
          const targetUnit = (ctx.units || units).find((u) => u.id === result.unitEffect.unitId);
          if (targetUnit) {
            result.targetApBefore = targetUnit.ap;
            result.targetApAfter = targetUnit.ap + result.unitEffect.amount;
          }
          setUnits((prev) => prev.map((u) =>
            u.id === result.unitEffect.unitId
              ? { ...u, ap: u.ap + result.unitEffect.amount }
              : u
          ));
        }
      }
      setLastExecutionResult({ ...result, timestamp: Date.now() });
    } catch (e) {
      console.error('[Enemy Commander TX] Unhandled error:', e);
      result = { ok: false, result: ENEMY_COMMANDER_TX_RESULT.EFFECT_FAILED, transactionId, skillId, message: 'Command failed' };
      setLastExecutionResult({ ...result, timestamp: Date.now() });
    } finally {
      // Always release the action lock — no permanent soft-lock (spec §18).
      actionLockRef.current = false;
    }
    return result;
  }, [units, grid, GRID_WIDTH, GRID_HEIGHT, phase, setUnits]);

  // --- Process the Enemy Phase Commander action window ---
  // Called by the enemy phase runner at the defined action window point.
  // Evaluates the battlefield (tactical AI), executes the chosen command
  // through the atomic transaction, shows the banner, and sleeps briefly.
  //
  // Re-evaluation safety (spec §44-45): if the chosen target fails validation
  // at commit time (state changed between evaluation and execution), the AI
  // re-evaluates ONCE from the fresh battle state. If the second attempt also
  // fails, the Commander HOLDs — no infinite retry loops.
  const processEnemyCommanderAction = useCallback(async (currentUnits, currentGrid, gridW, gridH, sleepFn, extraCtx = {}) => {
    const prof = profileRef.current;
    const bs = battleStateRef.current;
    if (!prof || !bs) return null;

    const evalCtx = {
      units: currentUnits,
      grid: currentGrid,
      GRID_WIDTH: gridW,
      GRID_HEIGHT: gridH,
      missionConfig: extraCtx.missionConfig || missionConfig,
      turn: extraCtx.turn || 1,
      overrides: aiOverridesRef.current,
    };

    // First evaluation
    let decision = evaluateEnemyCommanderActions(prof, bs, evalCtx);
    setLastEvaluation(decision);

    if (!decision.shouldAct) return null;

    // First execution attempt
    let result = executeEnemyCommand(decision.skillId, decision.target, {
      units: currentUnits,
      grid: currentGrid,
      GRID_WIDTH: gridW,
      GRID_HEIGHT: gridH,
      phase: 'enemy',
    });

    // If the target was invalidated at commit time, re-evaluate once
    if (!result.ok && result.result === ENEMY_COMMANDER_TX_RESULT.INVALID_TARGET) {
      const freshBs = battleStateRef.current;
      const reDecision = evaluateEnemyCommanderActions(prof, freshBs, evalCtx);
      setLastEvaluation(reDecision);
      if (reDecision.shouldAct) {
        result = executeEnemyCommand(reDecision.skillId, reDecision.target, {
          units: currentUnits,
          grid: currentGrid,
          GRID_WIDTH: gridW,
          GRID_HEIGHT: gridH,
          phase: 'enemy',
        });
      } else {
        return null; // HOLD after re-evaluation
      }
    }

    if (result.ok) {
      const skill = getCommanderSkill(decision.skillId || result.skillId);
      showCommandNotification(skill?.name || decision.skillId);
      // Target feedback: brief floating text over the affected alien (§27).
      if (result.unitEffect?.type === 'ap_grant' && extraCtx.flashAttackFeedback) {
        const targetUnit = currentUnits.find((u) => u.id === result.unitEffect.unitId);
        if (targetUnit) {
          extraCtx.flashAttackFeedback(targetUnit.x, targetUnit.y, 'TACTICAL ADVANCE  +1 AP', 'status');
        }
      }
      // Combat log (§29).
      const targetUnit = result.target?.kind === 'unit'
        ? currentUnits.find((u) => u.id === result.target.unitId)
        : null;
      const cmdName = profileRef.current?.displayName || 'ENEMY COMMANDER';
      const skillName = skill?.name || decision.skillId;
      const targetName = targetUnit ? (targetUnit.name || targetUnit.class || 'unit') : '—';
      console.log(`[Enemy Commander] ${cmdName}: ${skillName} → ${targetName} (+1 AP)`);
      if (sleepFn) await sleepFn(COMMAND_BANNER_MS);
    }
    return result;
  }, [executeEnemyCommand, showCommandNotification, missionConfig]);

  // --- Lifecycle hooks called from Battle.jsx ---

  // Abandon/retreat cleanup: clears both the battle state and the cached
  // assignment so a new attempt re-evaluates from scratch. Called by the
  // Battle retreat handler before navigating away (spec §38).
  const clearOnExit = useCallback(() => {
    clearEnemyCommanderBattleState();
    clearMissionCommanderAssignment(missionId);
  }, [missionId]);

  const resetEnemyCommander = () => {
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    if (commandBannerTimer.current) clearTimeout(commandBannerTimer.current);
    clearEnemyCommanderBattleState();
    committedTxIdsRef.current = new Set();
    actionLockRef.current = false;
    setLastExecutionResult(null);
    setCommandNotification(null);
    if (profileRef.current) {
      setBattleState(resetEnemyCommanderBattleState(profileRef.current));
      firstEnemyPhaseRef.current = true;
      setShowBanner(true);
      bannerTimer.current = setTimeout(() => setShowBanner(false), BANNER_MS);
    } else {
      setBattleState(null);
      setShowBanner(false);
    }
    setPanelOpen(false);
  };

  // --- Tutorial dismiss ---
  // Marks the tutorial as shown (persisted) and hides the overlay. The
  // tutorial never repeats after this (spec §42).
  const handleDismissTutorial = useCallback(() => {
    setShowTutorial(false);
    const ecState = getEnemyCommanderState();
    const nextState = markCommanderTutorialShown(ecState);
    writeEnemyCommanderState(nextState);
  }, []);

  // --- Dev controls ---

  const handleSpendCommandPoint = (amount = 1) => {
    setBattleState((prev) => {
      if (!prev) return prev;
      const next = spendCommandPoints(prev, amount);
      return next || prev;
    });
  };

  const handleResetBudget = () => {
    setBattleState((prev) => {
      if (!prev) return prev;
      return { ...prev, commandBudgetCurrent: prev.commandBudgetMax };
    });
  };

  const handleSetDevOverride = (value) => {
    setDevOverride(value);
    setPanelOpen(false);
  };

  // Debug: force a specific dev command. Finds a valid target programmatically
  // (no player input required). Uses allowAnyPhase so it works during Player Phase.
  const handleForceCommand = (skillId) => {
    const prof = profileRef.current;
    const bs = battleStateRef.current;
    if (!prof || !bs) return;
    if (!prof.skillIds || !prof.skillIds.includes(skillId)) return;

    const skill = getCommanderSkill(skillId);
    if (!skill) return;

    // Find a valid target programmatically.
    let target = null;
    if (skill.targetType === 'global') {
      target = { kind: 'global' };
    } else if (skill.targetType === 'friendly_unit' || skill.targetType === 'enemy_unit' || skill.targetType === 'any_unit') {
      const battleState = { units: units || [], grid: grid || [], GRID_WIDTH, GRID_HEIGHT };
      const validUnit = (units || []).find((u) => {
        if (!u.alive) return false;
        return isValidCommanderTarget(skillId, { kind: 'unit', unitId: u.id }, battleState).valid;
      });
      if (validUnit) target = { kind: 'unit', unitId: validUnit.id };
    } else if (skill.targetType === 'tile' || skill.targetType === 'area' || skill.targetType === 'friendly_area' || skill.targetType === 'enemy_area') {
      target = { kind: 'tile', x: 0, y: 0 };
    }

    if (!target) return;

    const result = executeEnemyCommand(skillId, target, { allowAnyPhase: true });
    if (result.ok) {
      showCommandNotification(skill?.name || skillId);
    }
  };

  // Debug: simulate duplicate execution — call the transaction twice with the
  // same transaction ID. The second call must be rejected by the idempotency guard.
  const handleSimulateDuplicate = () => {
    const prof = profileRef.current;
    const bs = battleStateRef.current;
    if (!prof || !bs) return;

    const txId = generateEnemyTransactionId();
    const target = { kind: 'global' };
    const ctx = {
      units, grid, GRID_WIDTH, GRID_HEIGHT,
      phase: 'enemy',
      allowAnyPhase: true,
      transactionId: txId,
    };

    const r1 = executeEnemyCommand('DEV_ENEMY_GLOBAL', target, ctx);
    const r2 = executeEnemyCommand('DEV_ENEMY_GLOBAL', target, ctx);
    setLastExecutionResult({
      duplicateTest: true,
      first: r1,
      second: r2,
      message: r1.ok && !r2.ok ? 'DUPLICATE BLOCKED ✓' : 'DUPLICATE TEST FAILED',
      timestamp: Date.now(),
    });
  };

  // Debug: trigger the Commander action window manually (simulates the enemy
  // phase runner calling processEnemyCommanderAction).
  const handleTriggerActionWindow = () => {
    processEnemyCommanderAction(units, grid, GRID_WIDTH, GRID_HEIGHT, null, { missionConfig });
  };

  // Debug: run AI evaluation WITHOUT executing. Stores the full decision +
  // candidate breakdown in state for the dev inspector to display.
  const handleRunEvaluation = () => {
    const prof = profileRef.current;
    const bs = battleStateRef.current;
    if (!prof || !bs) return;
    const decision = evaluateEnemyCommanderActions(prof, bs, {
      units, grid, GRID_WIDTH, GRID_HEIGHT,
      missionConfig, turn: 1,
      overrides: aiOverridesRef.current,
    });
    setLastEvaluation(decision);
  };

  // Debug: override the HOLD threshold (null = use profile default).
  const handleSetHoldThreshold = (value) => {
    setAiOverrides((prev) => {
      const next = { ...(prev || {}) };
      if (value == null || value === '') delete next.holdThreshold;
      else next.holdThreshold = Number(value);
      return Object.keys(next).length === 0 ? null : next;
    });
  };

  // Debug: override reserveBias (null = use profile default).
  const handleSetReserveBias = (value) => {
    setAiOverrides((prev) => {
      const next = { ...(prev || {}) };
      if (value == null || value === '') delete next.reserveBias;
      else next.reserveBias = Number(value);
      return Object.keys(next).length === 0 ? null : next;
    });
  };

  // Debug: set the invalidate-target override (null = clear). Forces the AI's
  // chosen unit target to fail at commit time, testing the one-shot
  // re-evaluation path.
  const handleSetInvalidateTarget = (unitId) => {
    setAiOverrides((prev) => {
      const next = { ...(prev || {}) };
      if (!unitId) delete next.invalidateTargetId;
      else next.invalidateTargetId = unitId;
      return Object.keys(next).length === 0 ? null : next;
    });
  };

  return {
    // state
    profile,
    displayProfile,
    battleState,
    enemyCommanderActive,
    assignmentSource,
    assignmentValid,
    assignmentReason,
    // budget
    budgetCurrent: getCommandBudgetCurrent(battleState),
    budgetMax: getCommandBudgetMax(battleState),
    // ui
    showBanner,
    commandNotification,
    panelOpen,
    setPanelOpen,
    isFirstEncounter,
    showTutorial,
    handleDismissTutorial,
    assignmentDebugReason,
    // lifecycle
    resetEnemyCommander,
    clearOnExit,
    // execution
    executeEnemyCommand,
    processEnemyCommanderAction,
    lastExecutionResult,
    // ai evaluation (dev)
    lastEvaluation,
    aiOverrides,
    handleRunEvaluation,
    handleSetHoldThreshold,
    handleSetReserveBias,
    handleSetInvalidateTarget,
    // dev
    devOverride,
    handleSetDevOverride,
    handleSpendCommandPoint,
    handleResetBudget,
    handleForceCommand,
    handleSimulateDuplicate,
    handleTriggerActionWindow,
    canIssueCommandThisPhase: (skillId) => {
      const skill = getCommanderSkill(skillId);
      if (!skill || !profile) return false;
      return canIssueCommandThisPhase(battleState, profile, skill.enemyCommandPointCost || 1);
    },
  };
}