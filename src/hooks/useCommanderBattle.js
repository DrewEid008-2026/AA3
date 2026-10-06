// Commander battle hook — encapsulates all Commander state, handlers, and the
// resource payment transaction flow for the Battle page.
//
// Extracted from Battle.jsx to keep that file under the size limit. The hook
// owns:
//   - Commander unlock/skill state (loaded from campaign save)
//   - Live campaign resources (refreshed after each transaction)
//   - Targeting state (skill selection, target selection, transaction ID)
//   - The full confirm → transaction → payment → effect pipeline
//   - Debug controls (resource set, dev skill run, fail simulation, reset)
//   - Transaction history + committed-ID idempotency guard
//
// Battle.jsx passes in the battle state (units, grid, phase, etc.) and receives
// back everything needed for input handling, tile highlights, and JSX rendering.

import { useState, useRef, useEffect } from 'react';
import { loadPlayerSave, unlockCommanderSkill, removeCommanderSkill } from '@/game/persistence';
import { debugSetCredits, debugSetAlienMaterials, debugSetPowerCores, debugSetNanoCubes } from '@/game/persistence';
import {
  COMMANDER_TARGET_TYPES,
  getCommanderSkill,
  getCommanderSkillsByIds,
  getDevCommanderSkillIds,
  isValidCommanderTarget,
  canUseCommanderSkill,
} from '@/game/commanderSkills';
import {
  executeCommanderSkillTransaction,
  generateTransactionId,
  createTransactionHistoryEntry,
  COMMANDER_TX_RESULT,
} from '@/game/commanderTransactions';
import { isCommanderUnlocked } from '@/game/commander';
import {
  createCommanderBattleState,
  decrementUses,
  setCooldown,
  tickCooldowns,
  getUsesRemaining,
  getCooldownRemaining,
} from '@/game/commanderBattleState';

export function useCommanderBattle({
  phase, busy, isTerminal, optionsOpen,
  units, grid, GRID_WIDTH, GRID_HEIGHT,
  missionId, turn,
  flashAttackFeedback,
  setUnits,
  tutorialMode,
}) {
  // --- State ---
  const [commanderUnlockedSkills, setCommanderUnlockedSkills] = useState([]);
  const [commanderSaveUnlocked, setCommanderSaveUnlocked] = useState(false);
  const [commanderPanelOpen, setCommanderPanelOpen] = useState(false);
  const [commanderTargeting, setCommanderTargeting] = useState(null); // { skillId, selectedTarget, transactionId }
  const [commanderFeedback, setCommanderFeedback] = useState(null);
  const [commanderResources, setCommanderResources] = useState(null);
  const [commanderTxHistory, setCommanderTxHistory] = useState([]);
  // Last unit effect applied by a Commander command — for debug inspection (AP before/after).
  const [commanderLastUnitEffect, setCommanderLastUnitEffect] = useState(null);
  // Battle-use state: uses-per-mission + cooldowns. Transient — never persisted.
  const [commanderBattleState, setCommanderBattleState] = useState(() => createCommanderBattleState([]));

  // --- Tutorial mode: inject Tactical Advance in-memory (never persists) ---
  useEffect(() => {
    if (tutorialMode) {
      setCommanderSaveUnlocked(true);
      setCommanderUnlockedSkills(getCommanderSkillsByIds(['player_tactical_advance']));
      setCommanderResources({ credits: 100, alien_materials: 0, powerCores: 0, nanoCubes: 0 });
    }
  }, [tutorialMode]);

  // --- Refs ---
  const commanderFeedbackTimer = useRef(null);
  const commanderActionLockRef = useRef(false);
  const commanderCommittedTxIdsRef = useRef(new Set());
  const commanderSimulateFailRef = useRef(false);
  const commanderBattleStateRef = useRef(commanderBattleState);
  useEffect(() => { commanderBattleStateRef.current = commanderBattleState; }, [commanderBattleState]);
  // Track the previous phase to detect Player Phase transitions for cooldown tick.
  const prevPhaseRef = useRef(phase);
  // Track whether at least one Player Phase has occurred (skip tick on the first).
  const firstPlayerPhaseRef = useRef(true);

  // --- Feedback ---
  const showCommanderFeedback = (text) => {
    if (commanderFeedbackTimer.current) clearTimeout(commanderFeedbackTimer.current);
    setCommanderFeedback({ text, id: Date.now() });
    commanderFeedbackTimer.current = setTimeout(() => setCommanderFeedback(null), 2500);
  };

  // --- Resource refresh ---
  const refreshCommanderResources = async () => {
    try {
      const pSave = await loadPlayerSave();
      setCommanderResources(pSave);
    } catch (e) { /* keep stale */ }
  };

  // --- Phase-end cooldown tick ---
  // Fires when a new Player Phase begins (phase transitions to 'player'). The
  // very first Player Phase of the mission is skipped (no cooldowns to tick).
  // Cooldowns tick down by 1 — a skill used on Turn 1 with cooldown 2 is ready
  // on Turn 4 (ticks on Turn 2 and Turn 3 player-phase starts).
  useEffect(() => {
    if (phase === 'player' && prevPhaseRef.current !== 'player') {
      if (firstPlayerPhaseRef.current) {
        firstPlayerPhaseRef.current = false;
      } else {
        setCommanderBattleState((prev) => tickCooldowns(prev));
      }
    }
    prevPhaseRef.current = phase;
  }, [phase]);

  // --- Load from save (called from roster loading effect) ---
  const loadCommanderFromSave = async (pSave) => {
    setCommanderSaveUnlocked(isCommanderUnlocked(pSave));
    setCommanderResources(pSave);
    const skills = getCommanderSkillsByIds(pSave?.commander?.unlockedSkillIds || []);
    setCommanderUnlockedSkills(skills);
    // Initialize battle-use state from the unlocked skill IDs.
    setCommanderBattleState(createCommanderBattleState(skills.map((s) => s.id)));
    // Reset phase tracking for this mission.
    firstPlayerPhaseRef.current = true;
    prevPhaseRef.current = phase;
  };

  const resetCommanderOnLoadError = () => {
    setCommanderSaveUnlocked(false);
    setCommanderResources(null);
    setCommanderUnlockedSkills([]);
    setCommanderBattleState(createCommanderBattleState([]));
  };

  // --- Reset (called from resetBattle) ---
  const resetCommanderState = () => {
    setCommanderTargeting(null);
    setCommanderPanelOpen(false);
    setCommanderFeedback(null);
    if (commanderFeedbackTimer.current) clearTimeout(commanderFeedbackTimer.current);
    commanderActionLockRef.current = false;
    commanderCommittedTxIdsRef.current = new Set();
    commanderSimulateFailRef.current = false;
    setCommanderTxHistory([]);
    // Reset battle-use state (uses + cooldowns + pending effects). Persistent
    // campaign resources already spent remain spent — only transient battle
    // state is cleared.
    setCommanderBattleState(createCommanderBattleState(commanderUnlockedSkills.map((s) => s.id)));
    firstPlayerPhaseRef.current = true;
  };

  // --- Terminal state cleanup ---
  const clearCommanderOnTerminal = () => {
    setCommanderTargeting(null);
    setCommanderPanelOpen(false);
    // Battle-use state is left intact until resetBattle — terminal cleanup only
    // clears active targeting/panel so the result screen is unobstructed.
  };

  // --- Panel open ---
  const handleOpenCommander = () => {
    if (phase !== 'player' || busy || isTerminal || optionsOpen) return;
    if (!commanderSaveUnlocked || commanderUnlockedSkills.length === 0) return;
    setCommanderPanelOpen(true);
  };

  // --- Skill select (enter targeting) ---
  const handleCommanderSkillSelect = (skill) => {
    setCommanderPanelOpen(false);
    // Full usability gate via canUseCommanderSkill — checks phase, unlock,
    // uses, cooldown, affordability, and valid targets. Defense in depth even
    // though the panel disables unusable skills.
    const status = canUseCommanderSkill(skill.id, {
      phase, commanderUnlocked: commanderSaveUnlocked,
      battleState: commanderBattleStateRef.current,
      campaignResources: commanderResources,
      units, grid, GRID_WIDTH, GRID_HEIGHT,
    });
    if (!status.canUse) {
      showCommanderFeedback(status.reason || status.statusLabel || 'CANNOT USE');
      return;
    }
    // Each skill selection gets a fresh transaction ID — the idempotency guard.
    const transactionId = generateTransactionId();
    if (skill.targetType === COMMANDER_TARGET_TYPES.GLOBAL) {
      setCommanderTargeting({ skillId: skill.id, selectedTarget: { kind: 'global' }, transactionId });
    } else {
      setCommanderTargeting({ skillId: skill.id, selectedTarget: null, transactionId });
    }
  };

  // --- Target selection ---
  const handleCommanderTileSelect = (tile) => {
    if (!commanderTargeting) return;
    const target = { kind: 'tile', x: tile.x, y: tile.y };
    const v = isValidCommanderTarget(commanderTargeting.skillId, target, { units, GRID_WIDTH, GRID_HEIGHT });
    if (v.valid) {
      setCommanderTargeting((prev) => ({ ...prev, selectedTarget: target }));
    } else {
      flashAttackFeedback(tile.x, tile.y, v.reason || 'INVALID');
    }
  };

  const handleCommanderUnitSelect = (unit) => {
    if (!commanderTargeting) return;
    const target = { kind: 'unit', unitId: unit.id };
    const v = isValidCommanderTarget(commanderTargeting.skillId, target, { units, GRID_WIDTH, GRID_HEIGHT });
    if (v.valid) {
      setCommanderTargeting((prev) => ({ ...prev, selectedTarget: target }));
    } else {
      flashAttackFeedback(unit.x, unit.y, v.reason || 'INVALID');
    }
  };

  // --- Confirm (full transaction) ---
  const handleCommanderConfirm = async () => {
    if (!commanderTargeting || !commanderTargeting.selectedTarget) return;
    // Tutorial mode: apply effect directly, no persistence.
    if (tutorialMode && commanderTargeting.skillId === 'player_tactical_advance' && commanderTargeting.selectedTarget?.kind === 'unit') {
      const targetUnit = units.find((u) => u.id === commanderTargeting.selectedTarget.unitId);
      if (targetUnit) {
        setUnits((prev) => prev.map((u) => (u.id === targetUnit.id ? { ...u, ap: u.ap + 1 } : u)));
        flashAttackFeedback(targetUnit.x, targetUnit.y, 'TACTICAL ADVANCE  +1 AP', 'status');
        showCommanderFeedback('TACTICAL ADVANCE — TUTORIAL (FREE)');
      }
      setCommanderTargeting(null);
      return;
    }
    // Action lock — primary guard against duplicate Confirm.
    if (commanderActionLockRef.current) return;
    commanderActionLockRef.current = true;

    const { skillId, selectedTarget, transactionId } = commanderTargeting;
    const context = {
      units, grid, GRID_WIDTH, GRID_HEIGHT,
      phase,
      commanderUnlocked: commanderSaveUnlocked,
      unlockedSkillIds: commanderUnlockedSkills.map((s) => s.id),
      campaignResources: commanderResources,
      transactionId,
      committedTransactionIds: commanderCommittedTxIdsRef.current,
      battleState: commanderBattleStateRef.current,
      missionId, turn,
      simulateFail: commanderSimulateFailRef.current,
    };

    let result;
    try {
      result = await executeCommanderSkillTransaction(skillId, selectedTarget, context);
    } catch (e) {
      console.error('[Commander TX] Unhandled error:', e);
      result = { ok: false, result: COMMANDER_TX_RESULT.EFFECT_INIT_FAILED, transactionId, skillId, message: 'COMMAND CANNOT BE EXECUTED' };
    }

    commanderActionLockRef.current = false;
    commanderSimulateFailRef.current = false; // one-shot

    // Record in transaction history (debug).
    const cost = result.cost || { credits: 0, alienMaterials: 0, powerCores: 0, nanoCubes: 0 };
    const histEntry = createTransactionHistoryEntry(transactionId, skillId, cost, missionId, turn, !!result.ok, result.ok ? null : result.result);
    setCommanderTxHistory((prev) => [...prev, histEntry]);

    if (result.ok) {
      // Success: commit the transaction ID, refresh resources, clear targeting.
      commanderCommittedTxIdsRef.current.add(transactionId);
      if (result.resourcesAfter) setCommanderResources(result.resourcesAfter);
      else await refreshCommanderResources();
      // Decrement uses-per-mission and set cooldown in battle-use state.
      let bs = commanderBattleStateRef.current;
      bs = decrementUses(bs, skillId);
      bs = setCooldown(bs, skillId);
      setCommanderBattleState(bs);
      showCommanderFeedback(result.message || 'COMMAND EXECUTED');
      setCommanderTargeting(null);
      // Apply the unit effect (e.g., Tactical Advance +1 AP) to game units.
      // The transaction owns the resource payment; the hook owns unit mutation.
      // Idempotency: the transaction ID guard + action lock prevent duplicate
      // application, so this block runs at most once per confirmed command.
      if (result.unitEffect?.type === 'ap_grant') {
        const targetUnit = units.find((u) => u.id === result.unitEffect.unitId);
        if (targetUnit) {
          const apBefore = targetUnit.ap;
          const apAfter = apBefore + result.unitEffect.amount;
          setUnits((prev) => prev.map((u) =>
            u.id === result.unitEffect.unitId
              ? { ...u, ap: apAfter }
              : u
          ));
          // Target feedback: brief floating text over the affected soldier (§25).
          flashAttackFeedback(targetUnit.x, targetUnit.y, `TACTICAL ADVANCE  +${result.unitEffect.amount} AP`, 'status');
          // Combat log (§45).
          console.log(`[Commander] TACTICAL ADVANCE: ${targetUnit.name} gains +${result.unitEffect.amount} AP (AP ${apBefore} → ${apAfter}). Cost: ${cost.credits} Credits`);
          // Debug inspection (§46).
          setCommanderLastUnitEffect({
            type: result.unitEffect.type,
            unitId: result.unitEffect.unitId,
            amount: result.unitEffect.amount,
            targetName: targetUnit.name,
            apBefore,
            apAfter,
            timestamp: Date.now(),
          });
        }
      }
    } else {
      // Failure: no resources deducted (transaction function handles refund).
      const msg = result.message || 'COMMAND CANNOT BE EXECUTED';
      showCommanderFeedback(msg);
      if (result.result === COMMANDER_TX_RESULT.INVALID_TARGET || result.result === COMMANDER_TX_RESULT.UNAFFORDABLE) {
        const skill = getCommanderSkill(skillId);
        if (skill?.targetType === COMMANDER_TARGET_TYPES.GLOBAL) {
          setCommanderTargeting(null);
        } else {
          setCommanderTargeting((prev) => ({ ...prev, selectedTarget: null }));
        }
      } else {
        setCommanderTargeting(null);
      }
    }
  };

  // --- Cancel ---
  const handleCommanderCancelPreview = () => {
    if (!commanderTargeting) return;
    const skill = getCommanderSkill(commanderTargeting.skillId);
    if (skill?.targetType === COMMANDER_TARGET_TYPES.GLOBAL) {
      setCommanderTargeting(null);
    } else {
      setCommanderTargeting((prev) => ({ ...prev, selectedTarget: null }));
    }
  };

  const handleCommanderCancelTargeting = () => {
    setCommanderTargeting(null);
  };

  // --- Debug: dev skill injection ---
  const handleInjectDevSkills = () => {
    const devIds = getDevCommanderSkillIds();
    const existingIds = new Set(commanderUnlockedSkills.map((s) => s.id));
    const toAdd = devIds.filter((id) => !existingIds.has(id));
    if (toAdd.length > 0) {
      const allIds = [...commanderUnlockedSkills.map((s) => s.id), ...toAdd];
      setCommanderUnlockedSkills(getCommanderSkillsByIds(allIds));
    }
  };

  const handleClearDevSkills = () => {
    const devIds = new Set(getDevCommanderSkillIds());
    setCommanderUnlockedSkills((prev) => prev.filter((s) => !devIds.has(s.id)));
  };

  // --- Debug: immunity toggle ---
  const handleToggleCommanderImmune = (unitId) => {
    if (!unitId) return;
    setUnits((prev) => prev.map((u) => (u.id === unitId ? { ...u, commanderImmune: !u.commanderImmune } : u)));
  };

  // --- Debug: set resource ---
  const handleSetCommanderResource = async (key, amount) => {
    try {
      if (key === 'credits') await debugSetCredits(amount);
      else if (key === 'alien_materials') await debugSetAlienMaterials(amount);
      else if (key === 'powerCores') await debugSetPowerCores(amount);
      else if (key === 'nanoCubes') await debugSetNanoCubes(amount);
      await refreshCommanderResources();
    } catch (e) { /* ignore */ }
  };

  // --- Debug: run dev skill directly ---
  const handleRunDevSkill = (skillId) => {
    const skill = getCommanderSkill(skillId);
    if (!skill) return;
    setCommanderTargeting({ skillId, selectedTarget: { kind: 'global' }, transactionId: generateTransactionId() });
  };

  // --- Debug: simulate fail ---
  const handleSimulateTxFail = () => {
    commanderSimulateFailRef.current = true;
    showCommanderFeedback('NEXT CONFIRM WILL FAIL (refund test)');
  };

  // --- Debug: reset tx state ---
  const handleResetTxState = () => {
    commanderCommittedTxIdsRef.current = new Set();
    setCommanderTxHistory([]);
    commanderActionLockRef.current = false;
    commanderSimulateFailRef.current = false;
    showCommanderFeedback('TX STATE RESET');
  };

  // --- Debug: unlock/remove Tactical Advance (production skill) ---
  // Persists to the campaign save immediately, then refreshes the in-memory
  // skill list. Used for testing without buying the Commander.
  const handleUnlockTacticalAdvance = async () => {
    try {
      await unlockCommanderSkill('player_tactical_advance');
      const pSave = await loadPlayerSave();
      setCommanderSaveUnlocked(isCommanderUnlocked(pSave));
      setCommanderResources(pSave);
      setCommanderUnlockedSkills(getCommanderSkillsByIds(pSave?.commander?.unlockedSkillIds || []));
      showCommanderFeedback('TACTICAL ADVANCE UNLOCKED');
    } catch (e) {
      showCommanderFeedback(e.message || 'UNLOCK FAILED');
    }
  };

  const handleRemoveTacticalAdvance = async () => {
    try {
      await removeCommanderSkill('player_tactical_advance');
      const pSave = await loadPlayerSave();
      setCommanderSaveUnlocked(isCommanderUnlocked(pSave));
      setCommanderResources(pSave);
      setCommanderUnlockedSkills(getCommanderSkillsByIds(pSave?.commander?.unlockedSkillIds || []));
      showCommanderFeedback('TACTICAL ADVANCE REMOVED');
    } catch (e) {
      showCommanderFeedback(e.message || 'REMOVE FAILED');
    }
  };

  return {
    // state
    commanderUnlockedSkills,
    commanderSaveUnlocked,
    commanderPanelOpen, setCommanderPanelOpen,
    commanderTargeting, setCommanderTargeting,
    commanderFeedback,
    commanderResources,
    commanderTxHistory,
    commanderBattleState,
    committedTxCount: commanderCommittedTxIdsRef.current.size,
    // loaders/reset
    loadCommanderFromSave,
    resetCommanderOnLoadError,
    resetCommanderState,
    clearCommanderOnTerminal,
    refreshCommanderResources,
    // handlers
    handleOpenCommander,
    handleCommanderSkillSelect,
    handleCommanderTileSelect,
    handleCommanderUnitSelect,
    handleCommanderConfirm,
    handleCommanderCancelPreview,
    handleCommanderCancelTargeting,
    // debug handlers
    handleInjectDevSkills,
    handleClearDevSkills,
    handleToggleCommanderImmune,
    handleSetCommanderResource,
    handleRunDevSkill,
    handleSimulateTxFail,
    handleResetTxState,
    handleUnlockTacticalAdvance,
    handleRemoveTacticalAdvance,
    commanderLastUnitEffect,
    // battle-use helpers (for UI status display)
    getUsesRemaining: (skillId) => getUsesRemaining(commanderBattleState, skillId),
    getCooldownRemaining: (skillId) => getCooldownRemaining(commanderBattleState, skillId),
    canUseCommanderSkill: (skillId) => canUseCommanderSkill(skillId, {
      phase, commanderUnlocked: commanderSaveUnlocked,
      battleState: commanderBattleState,
      campaignResources: commanderResources,
      units, grid, GRID_WIDTH, GRID_HEIGHT,
    }),
  };
}