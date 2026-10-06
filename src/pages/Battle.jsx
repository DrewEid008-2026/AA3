import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { buildGrid } from '@/game/maps';
import { getUnitAt } from '@/game/units';
import { TEAMS, GRID_WIDTH, GRID_HEIGHT, MISSION_TYPES, MISSION_STATES } from '@/game/constants';
import { computeReachable, getMovementRange } from '@/game/pathfinding';
import {
  getValidTargets,
  validateAttack,
  computeDamage,
  getUnitWeapon,
  attackReasonText,
  gridDistance,
} from '@/game/combat';
import { hasAmmo, canReload, getReloadApCost, reloadUnit, consumeAmmo } from '@/game/ammo';
import { canEnterOverwatch, enterOverwatch } from '@/game/reactions';
import {
  TARGET_TYPES,
  getUnitAbility,
  canActivateAbility,
  getEnemyTargets,
  getAllyTargets,
  getHealTargets,
  getGrenadeImpactTiles,
  getBreachOutcome,
  getHealOutcome,
  getBarricadeTiles,
  getMineTiles,
} from '@/game/abilities';

import { resolveTargetDamage,
} from '@/game/enemyPhaseHelpers';
import { commitMissionResults as commitMissionResultsLogic } from '@/game/missionCommit';
import {
  applyStatus,
  consumeMarked,
  removeStatuses,
  STATUS_TYPES,
} from '@/game/statuses';
import {
  getMission, getMissionMapConfig, createMissionUnitsFromSoldiers,
  createMissionObjects, createInitialMissionRuntime, activateMissionRuntime,
  validateMissionSetup, isObjectiveSecured, isInExtractionZone, isAdjacent,
  ensureMapConfig, regenerateMapConfig, getCompatibleMaps,
  createReplayMissionInstance, generateMapConfig,
} from '@/game/missions';
import { readActiveCampaign } from '@/game/saveSlots';
import { getActiveChapterDef } from '@/game/chapters';
import { ELITE_SQUAD } from '@/game/elite';
import { spawnEliteSquad } from '@/game/reinforcements';
import { Footprints, Heart, Bomb, Flag } from 'lucide-react';
import Battlefield from '@/components/battle/Battlefield';
import TopHud from '@/components/battle/TopHud';
import BottomHud from '@/components/battle/BottomHud';
import PostObjectiveChoice from '@/components/battle/PostObjectiveChoice';
import MissionResult from '@/components/battle/MissionResult';
import {
  ensureRoster, loadPlayerSave, debugSetBossDefeatedFlag,
  getLastDeployedSoldierIds, setLastDeployedSoldierIds,
} from '@/game/persistence';
import { reviveUnit } from '@/game/downed';
import { damageProtectingCover, damageCoverTile, countNewlyDestroyedCover } from '@/game/cover';
import { computeMovementPreview } from '@/game/movementPreview';
import {
  deployBarricade as deployBarricadeLogic,
} from '@/game/engineer';
import { resolveMineDeploy } from '@/game/mineResolver';
import { createBurningHooks } from '@/game/burningHooks';
import { resolveSmokeGrenade, resolveSprintHarness, resolveEmergencyShield } from '@/game/utilityResolvers';
import { useTerrainUtility } from '@/hooks/useTerrainUtility';
import {
  hasLineUpOn,
  applyLineUp,
  clearLineUp,
  enableRelocate,
  clearRelocate,
  canRelocate,
  performRelocate,
} from '@/game/marksman';
import {
  getWeaponPresentation,
  getWeaponVisualProfile,
  getShotTiming,
} from '@/game/attackPresentation';
import { getCombatSpeed, setCombatSpeed, speedMultiplier } from '@/game/preferences';
import {
  hasSkill, getSkillState, setSkillState,
  onPlayerMove, onDashUsed, consumeShockEntry, applyKillEffects,
  consumeChainHunterBonus, consumeCoordinatedStrike,
  trackSustainedFire, resetSustainedFire,
  getAbilityApCost, markAbilityUsed,
  getShatterMarks, applyShatterMarks,
  getEmergencyHealBonus, getLifelineReviveBonus, stabilizeAllowsCommand,
  hasRally,
} from '@/game/skillEffects';
import {
  computeThreatTiles,
  computeUnitRangeTiles,
  computeLinesOfFire,
  getCoverInfo,
  getTerrainLabel,
  getUnitInspectInfo,
} from '@/game/tacticalLens';
import OptionsOverlay from '@/components/OptionsOverlay';
import MapIntroBanner from '@/components/battle/MapIntroBanner';
import TerrainUtilityPreviewPanel from '@/components/battle/TerrainUtilityPreviewPanel';
import { useSiegeTest } from '@/hooks/useSiegeTest';
import EnemyInfoTile from '@/components/battle/EnemyInfoTile';
import BattleDebugPanels from '@/components/battle/BattleDebugPanels';
import { createInitialBossState, getRelayStatus, getBossUnit, BOSS_PHASES } from '@/game/bossState';
import { createEnemyPhaseRunner } from '@/game/enemyPhaseRunner';
import { useHarvesterMission } from '@/hooks/useHarvesterMission';
import HarvesterBossHud from '@/components/battle/HarvesterBossHud';
import HarvesterDebugPanel from '@/components/battle/HarvesterDebugPanel';
import ArmorBreachBanner from '@/components/battle/ArmorBreachBanner';
import FabricationSequenceBanner from '@/components/battle/FabricationSequenceBanner';
import CoreFailureBanner from '@/components/battle/CoreFailureBanner';
import CoreCollapseOverlay from '@/components/battle/CoreCollapseOverlay';
import { useBossMission } from '@/hooks/useBossMission';
import { useBattleFeedback } from '@/hooks/useBattleFeedback';
import { useObjectiveActions } from '@/hooks/useObjectiveActions';
import { useOverwatchAll } from '@/hooks/useOverwatchAll';
import { useActionBubbles } from '@/hooks/useActionBubbles';
import { getAbilityBubbleMessage, BUBBLE } from '@/game/actionBubbles';
import BossMessageBanner from '@/components/battle/BossMessageBanner';
import AttackPreviewPanel from '@/components/battle/AttackPreviewPanel';
import DisruptorHookPreviewPanel from '@/components/battle/DisruptorHookPreviewPanel';
import BattleErrorBoundary from '@/components/battle/BattleErrorBoundary';
import CoverDestroyedBanner from '@/components/battle/CoverDestroyedBanner';
import OverwatchAllFeedback from '@/components/battle/OverwatchAllFeedback';
import { buildBasicAttackPreview, buildBreachAttackPreview, buildGrenadePreview, buildRocketPreview, buildDisruptorHookPreview } from '@/game/attackPreview';
import { computeGrenadeBlast, applyGrenadeBlast } from '@/game/grenadeResolver';
import { computeRocketBlast, applyRocketBlast } from '@/game/rocketResolver';
import { computeComeHerePull, processForcedMovementTileEntry } from '@/game/comeHereResolver';
import { animateSegment } from '@/game/battleAnimation';
import { computeUnitBadges } from '@/game/unitBadges';
import { getAttackArmorShred, applyArmorShred } from '@/game/armorShred';
import { createPlayerMovementProcessor } from '@/game/playerMovementProcessor';
import { getDetailedTargetingInfo } from '@/game/preferences';
import { loadCampaign, getContinueSlot } from '@/game/saveSlots';
import {
  COMMANDER_TARGET_TYPES,
  getCommanderSkill,
  getCommanderAffectedArea,
  isUnitValidCommanderTarget,
} from '@/game/commanderSkills';
import { useCommanderBattle } from '@/hooks/useCommanderBattle';
import { useEnemyCommander } from '@/hooks/useEnemyCommander';
import CommanderOverlays from '@/components/battle/CommanderOverlays';
import { useTutorial, TUT_ACTION } from '@/hooks/useTutorial';
import TutorialBattleOverlays from '@/components/tutorial/TutorialBattleOverlays';
import useTutorialMission from '@/hooks/useTutorialMission';
import TutorialFailureScreen from '@/components/tutorial/TutorialFailureScreen';
import TutorialZoneDebug from '@/components/tutorial/TutorialZoneDebug';

const FEEDBACK_MS = 600;
const POPUP_MS = 900;
const HIT_FLASH_MS = 280;
const ENEMY_ATTACK_MS = 280;   // pause after an enemy attack resolves
const ENEMY_STEP_MS = 90;       // brief beat between enemy actions
const ENEMY_MOVE_PER_SEG = 70;
const GRENADE_PREVIEW_MS = 450; // blast area shown before damage resolves
const REACTION_MS = 220;          // overwatch reaction pause (visual beat)
const REACTION_FLASH_MS = 360;    // overwatch firing indicator
const ENEMY_ABILITY_LABEL_MS = 240; // brief enemy ability name before resolving

// Combat speed scales presentation timing only. Never affects AP/damage/AI.
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms * speedMultiplier));

export default function Battle() {
  const { missionId } = useParams();
  const navigate = useNavigate();
  const missionConfig = getMission(missionId);
  const selectedSoldierIds = new URLSearchParams(window.location.search).get('s')?.split(',').filter(Boolean) || [];

  const [grid, setGrid] = useState(() => {
    const cfg = ensureMapConfig(missionId);
    return cfg ? cfg.grid : buildGrid();
  });
  const [mapConfig, setMapConfig] = useState(() => ensureMapConfig(missionId));
  const [showMapIntro, setShowMapIntro] = useState(true);
  const [soldiers, setSoldiers] = useState([]);
  const [loadingRoster, setLoadingRoster] = useState(true);
  const [units, setUnits] = useState([]);
  const missionObjects = useMemo(() => createMissionObjects(missionId), [missionId]);
  const [civilian, setCivilian] = useState(() => missionObjects.civilian);
  const [device, setDevice] = useState(() => missionObjects.device);
  const extractionZone = missionObjects.extractionZone;
  const [extractedIds, setExtractedIds] = useState(() => new Set());
  const [missionRuntime, setMissionRuntime] = useState(() => createInitialMissionRuntime(missionId));
  const [missionResults, setMissionResults] = useState(null);
  const [bossState, setBossState] = useState(() => createInitialBossState());
  const bossStateRef = useRef(bossState);
  useEffect(() => { bossStateRef.current = bossState; }, [bossState]);
  const [bossMessage, setBossMessage] = useState(null);
  const [attackPreview, setAttackPreview] = useState(null); // { preview, commit }
  const [coverDestroyed, setCoverDestroyed] = useState(null); // { count, id }
  const coverDestroyedTimer = useRef(null);

  const [selectedUnitId, setSelectedUnitId] = useState(null);
  const [turn, setTurn] = useState(1);
  const [phase, setPhase] = useState('player'); // 'player' | 'enemy'
  const [moving, setMoving] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [attackMode, setAttackMode] = useState(false);
  const [abilityTargeting, setAbilityTargeting] = useState(null); // null | { abilityId }
  const [blastPreview, setBlastPreview] = useState(null); // null | { keys:Set, enemyIds:Set, impactKey }
  const [movePreview, setMovePreview] = useState(null); // null | { unitId, fromX, fromY, toX, toY, path, apCost }
  const [invalidTile, setInvalidTile] = useState(null);
  const [attackFeedback, setAttackFeedback] = useState(null);
  const [mines, setMines] = useState([]);
  const [plasmaStrikes, setPlasmaStrikes] = useState([]); // pending Plasma Strike hazards
  const [beamSweeps, setBeamSweeps] = useState([]); // pending Beam Sweep hazards (max 1)
  const [overloadHazards, setOverloadHazards] = useState([]); // pending Overload hazards (Phase 3, max 2)
  const [barricadePending, setBarricadePending] = useState(null); // null | { x, y }
  const [relocateMode, setRelocateMode] = useState(false);
  const [activeShot, setActiveShot] = useState(null); // weapon-shot presentation (muzzle/tracer/impact)
  const [damagePopups, setDamagePopups] = useState([]);
  const [hitFlashId, setHitFlashId] = useState(null);
  const [debug, setDebug] = useState(false);
  const [lastAttack, setLastAttack] = useState(null);
  const [lastEnemyDecision, setLastEnemyDecision] = useState(null);
  const [reactionFlashId, setReactionFlashId] = useState(null);
  const [lastReaction, setLastReaction] = useState(null);
  const [showPostChoice, setShowPostChoice] = useState(false);
  const [showEliteIncoming, setShowEliteIncoming] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [combatSpeed, setCombatSpeedState] = useState(getCombatSpeed);
  const [lensActive, setLensActive] = useState(false);
  const [lensShowCover, setLensShowCover] = useState(true);
  const [lensShowThreat, setLensShowThreat] = useState(true);
  const [lensInspected, setLensInspected] = useState(null); // { kind:'unit', unitId } | { kind:'terrain', x, y } | null
  const [inspectedEnemyId, setInspectedEnemyId] = useState(null); // quick enemy inspection (no Lens required)
  const [commanderTutorialMode, setCommanderTutorialMode] = useState(false);


  const tokenRefs = useRef({});
  const invalidTimer = useRef(null);
  const feedbackTimer = useRef(null);
  const hitTimer = useRef(null);
  const popupId = useRef(0);
  const shotId = useRef(0);
  const blastTimer = useRef(null);
  const reactionTimer = useRef(null);
  const missionRuntimeRef = useRef(missionRuntime);
  useEffect(() => { missionRuntimeRef.current = missionRuntime; }, [missionRuntime]);
  const soldiersRef = useRef(soldiers);
  useEffect(() => { soldiersRef.current = soldiers; }, [soldiers]);
  const missionCommittedRef = useRef(false);
  const civilianRef = useRef(civilian);
  useEffect(() => { civilianRef.current = civilian; }, [civilian]);
  const deviceRef = useRef(device);
  useEffect(() => { deviceRef.current = device; }, [device]);
  const extractedIdsRef = useRef(extractedIds);
  useEffect(() => { extractedIdsRef.current = extractedIds; }, [extractedIds]);
  const minesRef = useRef(mines);
  useEffect(() => { minesRef.current = mines; }, [mines]);
  const plasmaStrikesRef = useRef(plasmaStrikes);
  useEffect(() => { plasmaStrikesRef.current = plasmaStrikes; }, [plasmaStrikes]);
  const beamSweepsRef = useRef(beamSweeps);
  useEffect(() => { beamSweepsRef.current = beamSweeps; }, [beamSweeps]);
  const overloadHazardsRef = useRef(overloadHazards);
  useEffect(() => { overloadHazardsRef.current = overloadHazards; }, [overloadHazards]);

  // Async roster loading: fetch persistent soldiers, create tactical units,
  // validate setup, then transition INITIALIZING → ACTIVE. Victory/failure
  // evaluation stays disabled until activation completes.
  useEffect(() => {
    setLoadingRoster(true);
    missionCommittedRef.current = false;
    setMissionResults(null);
    resetHarvester();
    // Re-enter INITIALIZING for this mission (clears any prior terminal state).
    setMissionRuntime(createInitialMissionRuntime(missionId));
    ensureRoster().then(async (s) => {
      setSoldiers(s);
      // Load Commander unlocked skills from the campaign save.
      try {
        const pSave = await loadPlayerSave();
        loadCommanderFromSave(pSave);
      } catch (e) {
        resetCommanderOnLoadError();
      }
      const cfg = ensureMapConfig(missionId);
      setMapConfig(cfg);
      setGrid(cfg ? cfg.grid : buildGrid());
      const newUnits = createMissionUnitsFromSoldiers(missionId, s, selectedSoldierIds);
      const objs = createMissionObjects(missionId);
      setUnits(newUnits);
      setCivilian(objs.civilian);
      setDevice(objs.device);
      setExtractedIds(new Set());
      setLoadingRoster(false);
      setShowMapIntro(true);
      setTimeout(() => setShowMapIntro(false), 2600);
      // Validate setup before activating. A failed validation is a config error,
      // never a player failure — the runtime stays in INITIALIZING with setupError.
      const rt = createInitialMissionRuntime(missionId);
      const check = validateMissionSetup(missionConfig, newUnits, objs.civilian, objs.device, objs.extractionZone, cfg?.grid, cfg);
      if (!check.valid) {
        console.error(`[Mission] Setup validation failed for ${missionId}: ${check.reason}`);
        setMissionRuntime({ ...rt, setupError: check.reason });
      } else {
        setMissionRuntime(activateMissionRuntime(rt));
      }
    });
  }, [missionId, missionConfig]);

  const busy = moving || resolving;
  const selectedUnit = units.find((u) => u.id === selectedUnitId) || null;
  const activeAbility = abilityTargeting && selectedUnit ? getUnitAbility(selectedUnit, abilityTargeting.abilityId) : null;

  const isTerminal = missionRuntime && [
    MISSION_STATES.COMPLETE, MISSION_STATES.PRIMARY_FAILED, MISSION_STATES.ELITE_RESPONSE_FAILED,
  ].includes(missionRuntime.state);
  const objectiveSecuredState = missionRuntime?.state === MISSION_STATES.OBJECTIVE_SECURED;
  const isInitializing = missionRuntime?.state === MISSION_STATES.INITIALIZING;
  const hasSetupError = !!(missionRuntime && missionRuntime.setupError);
  // Core Collapse presentation state. Declared here (above inputLocked) so the
  // binding exists when inputLocked references it — avoids a temporal-dead-zone
  // ReferenceError that crashed every battle render.
  const [showCoreCollapse, setShowCoreCollapse] = useState(false);
  const coreCollapsePlayedRef = useRef(false);

  // Battle feedback + Commander hooks must run before inputLocked and
  // tileHighlights, which reference commanderTargeting / commanderPanelOpen
  // during render. Declaring them here avoids a temporal-dead-zone crash.
  const { flashInvalid, flashAttackFeedback, pushPopup, flashStatusLabel } = useBattleFeedback({
    setInvalidTile, invalidTimer, setAttackFeedback, feedbackTimer, setDamagePopups, popupId, FEEDBACK_MS, POPUP_MS,
  });

  const {
    commanderUnlockedSkills, commanderSaveUnlocked,
    commanderPanelOpen, setCommanderPanelOpen,
    commanderTargeting, setCommanderTargeting,
    commanderFeedback, commanderResources, commanderTxHistory, committedTxCount,
    loadCommanderFromSave, resetCommanderOnLoadError, resetCommanderState, clearCommanderOnTerminal,
    handleOpenCommander, handleCommanderSkillSelect, handleCommanderTileSelect, handleCommanderUnitSelect,
    handleCommanderConfirm, handleCommanderCancelPreview, handleCommanderCancelTargeting,
    handleInjectDevSkills, handleClearDevSkills, handleToggleCommanderImmune,
    handleSetCommanderResource, handleRunDevSkill, handleSimulateTxFail, handleResetTxState,
    handleUnlockTacticalAdvance, handleRemoveTacticalAdvance, commanderLastUnitEffect,
    canUseCommanderSkill,
  } = useCommanderBattle({
    phase, busy, isTerminal, optionsOpen,
    units, grid, GRID_WIDTH, GRID_HEIGHT,
    missionId, turn,
    flashAttackFeedback,
    setUnits,
    tutorialMode: commanderTutorialMode,
  });

  // Guided Combat Tutorial (0.2.1) — framework wired here; map in 0.2.2.
  const tutorial = useTutorial({ enabled: !!missionConfig?.isTutorial, onComplete: () => { setCommanderTutorialMode(false); navigate('/missions'); } });
  const tutorialMission = useTutorialMission({ isTutorial: !!missionConfig?.isTutorial, tutorial, setGrid, setUnits, setCommanderTutorialMode });

  const { wallChargeTiles, instaWallTiles, tryWallCharge, tryInstaWall, debugShowSiege, setDebugShowSiege, debugShowInstaWall, setDebugShowInstaWall, debugGrantWallCharge, debugGrantInstaWall, debugRestoreUses, debugTileKeys } = useTerrainUtility({ activeAbility, selectedUnit, phase, busy, grid, units, missionConfig, civilian, device, extractionZone, mapConfig, setUnits, TARGET_TYPES, getLateCtx: () => ({ withBurning, openAttackPreview, showActionBubble, triggerSiegeFx, flashInvalid, flashAttackFeedback, getDetailedTargetingInfo, setGrid, setResolving, setAbilityTargeting }) });

  const inputLocked = busy || isTerminal || showPostChoice || objectiveSecuredState || isInitializing || hasSetupError || optionsOpen || !!attackPreview || showCoreCollapse || !!commanderTargeting || commanderPanelOpen;

  // Mission state machine: objective secured, defeat, elite defeated. Runs
  // after every units/civilian/device/extractedIds change so transitions fire
  // as soon as the condition is met — not only at end of round.
  // CRITICAL: evaluation is disabled during initialization. An empty temporary
  // units array (before roster load) must never count as victory or defeat.
  useEffect(() => {
    const rt = missionRuntimeRef.current;
    if (!rt || !missionConfig) return;
    if (isTerminal) return;
    // Initialization guard: do not evaluate victory/failure until the mission is
    // initialized, gameplay has started, and the state is ACTIVE or elite-active.
    if (!rt.missionInitialized || !rt.hasGameplayStarted) return;
    if (rt.state === MISSION_STATES.INITIALIZING) return;
    if (rt.setupError) return;

    const playersAlive = units.some((u) => u.team === TEAMS.PLAYER && u.alive);

    if (rt.state === MISSION_STATES.ACTIVE) {
      const skipVictory = missionConfig.isTutorial && tutorial.currentStep?.id !== 'tut_final_free_form';
      const secured = !skipVictory && isObjectiveSecured(missionConfig, units, civilian, device, extractedIds);
      if (secured) {
        // Boss missions skip the post-objective choice (no elite response) and
        // go straight to COMPLETE. The boss defeat is recorded during commit.
        if (missionConfig.isBoss || missionConfig.isTutorial) {
          setMissionRuntime((prev) => ({
            ...prev,
            state: MISSION_STATES.COMPLETE,
            baseRewardSecured: true,
            reinforcementCanceled: true,
          }));
          return;
        }
        setMissionRuntime((prev) => ({
          ...prev,
          state: MISSION_STATES.OBJECTIVE_SECURED,
          baseRewardSecured: true,
          reinforcementCanceled: true,
        }));
        setShowPostChoice(true);
        return;
      }
      if (!playersAlive) {
        setMissionRuntime((prev) => ({ ...prev, state: MISSION_STATES.PRIMARY_FAILED }));
        return;
      }
    }

    if (rt.state === MISSION_STATES.ELITE_RESPONSE_ACTIVE) {
      const eliteAlive = units.some((u) => u.team === TEAMS.ENEMY && u.alive && u.elite);
      if (!eliteAlive) {
        setMissionRuntime((prev) => ({
          ...prev,
          state: MISSION_STATES.COMPLETE,
          eliteResponseDefeated: true,
          eliteRewardSecured: true,
        }));
        return;
      }
      if (!playersAlive) {
        setMissionRuntime((prev) => ({ ...prev, state: MISSION_STATES.ELITE_RESPONSE_FAILED }));
        return;
      }
    }
  }, [units, civilian, device, extractedIds, missionConfig, isTerminal]);

  // If the escorting unit dies, drop the civilian at their tile so another
  // unit can re-rescue. Runs after any kill — player or enemy phase.
  useEffect(() => {
    if (!civilian || !civilian.escortId) return;
    const escort = units.find((u) => u.id === civilian.escortId);
    if (!escort || !escort.alive) {
      setCivilian((prev) => ({ ...prev, rescued: false, escortId: null }));
    }
  }, [units, civilian]);

  // Stop all targeting once the mission is in a terminal or secured state.
  useEffect(() => {
    if (isTerminal || showPostChoice) {
      setAttackMode(false);
      setAbilityTargeting(null);
      setAttackPreview(null);
      // Commander targeting state cleanup on mission end.
      clearCommanderOnTerminal();
    }
  }, [isTerminal, showPostChoice]);

  // Clear movement preview when entering other action modes, busy, or phase change.
  useEffect(() => {
    if (attackMode || abilityTargeting || busy || phase !== 'player' || isTerminal || showPostChoice || objectiveSecuredState || isInitializing || hasSetupError) {
      setMovePreview(null);
    }
  }, [attackMode, abilityTargeting, busy, phase, isTerminal, showPostChoice, objectiveSecuredState, isInitializing, hasSetupError]);

  // Clear movement preview when switching selected unit.
  useEffect(() => {
    setMovePreview(null);
  }, [selectedUnitId]);

  // Normal movement destinations. Hidden during attack/ability targeting.
  const reachable = useMemo(() => {
    if (!selectedUnit || phase !== 'player' || busy || attackMode || abilityTargeting || selectedUnit.ap <= 0) return new Map();
    const r = computeReachable(grid, units, selectedUnit, getMovementRange(selectedUnit));
    // Can't end a move on the civilian (unrescued) or device tile.
    if (civilian && !civilian.escortId && !civilian.safe) r.delete(`${civilian.x},${civilian.y}`);
    if (device && !device.sabotaged) r.delete(`${device.x},${device.y}`);
    return r;
  }, [grid, units, selectedUnit, phase, busy, attackMode, abilityTargeting, civilian, device]);

  // Tactical preview data from the hypothetical destination. Recalculates when
  // any relevant state changes (grid, units, selected unit, or preview target).
  const previewData = useMemo(() => {
    if (!movePreview || !selectedUnit) return null;
    const entry = reachable.get(`${movePreview.toX},${movePreview.toY}`);
    return computeMovementPreview(grid, units, selectedUnit, { x: movePreview.toX, y: movePreview.toY }, entry?.path);
  }, [movePreview, grid, units, selectedUnit, reachable]);

  // Valid attack targets for the selected unit in attack mode.
  const validTargets = useMemo(() => {
    if (!attackMode || !selectedUnit || phase !== 'player' || busy) return [];
    return getValidTargets(units, grid, selectedUnit, phase, busy);
  }, [attackMode, units, grid, selectedUnit, phase, busy]);

  // --- Ability targeting (shared framework) ---
  const dashReachable = useMemo(() => {
    if (!activeAbility || activeAbility.targetType !== TARGET_TYPES.DASH) return null;
    if (!selectedUnit || phase !== 'player' || busy) return null;
    const r = computeReachable(grid, units, selectedUnit, activeAbility.range);
    if (civilian && !civilian.escortId && !civilian.safe) r.delete(`${civilian.x},${civilian.y}`);
    if (device && !device.sabotaged) r.delete(`${device.x},${device.y}`);
    return r;
  }, [activeAbility, selectedUnit, phase, busy, grid, units, civilian, device]);

  const abilityEnemyTargets = useMemo(() => {
    if (!activeAbility || activeAbility.targetType !== TARGET_TYPES.ENEMY) return [];
    if (!selectedUnit || phase !== 'player' || busy) return [];
    return getEnemyTargets(grid, units, selectedUnit, activeAbility);
  }, [activeAbility, selectedUnit, phase, busy, grid, units]);

  const abilityAllyTargets = useMemo(() => {
    if (!activeAbility || activeAbility.targetType !== TARGET_TYPES.ALLY) return [];
    if (!selectedUnit || phase !== 'player' || busy) return [];
    return activeAbility.canTargetSelf
      ? getHealTargets(units, selectedUnit, activeAbility)
      : getAllyTargets(units, selectedUnit, activeAbility);
  }, [activeAbility, selectedUnit, phase, busy, units]);

  const grenadeImpactKeys = useMemo(() => {
    if (!activeAbility || activeAbility.targetType !== TARGET_TYPES.TILE_AOE) return null;
    if (!selectedUnit || phase !== 'player' || busy) return null;
    return new Set(getGrenadeImpactTiles(grid, selectedUnit, activeAbility).map((t) => `${t.x},${t.y}`));
  }, [activeAbility, selectedUnit, phase, busy, grid]);

  // Barricade placement tiles (Engineer): adjacent empty tiles where a barricade
  // can be deployed. Highlighted while the ability is active.
  const barricadeTiles = useMemo(() => {
    if (!activeAbility || activeAbility.targetType !== TARGET_TYPES.BARRICADE) return null;
    if (!selectedUnit || phase !== 'player' || busy) return null;
    return new Set(getBarricadeTiles(grid, units, selectedUnit, civilian, device).map((t) => `${t.x},${t.y}`));
  }, [activeAbility, selectedUnit, phase, busy, grid, units]);

  // Shock Mine placement tiles (Engineer): adjacent empty tiles where a mine can
  // be planted. Highlighted while the ability is active.
  const mineTiles = useMemo(() => {
    if (!activeAbility || activeAbility.targetType !== TARGET_TYPES.TILE) return null;
    if (!selectedUnit || phase !== 'player' || busy) return null;
    return new Set(getMineTiles(grid, units, selectedUnit, civilian, device).map((t) => `${t.x},${t.y}`));
  }, [activeAbility, selectedUnit, phase, busy, grid, units]);

  // Relocate destinations (Marksman): reachable tiles after a kill. 0 AP, free
  // reposition within normal movement range.
  // Relocate opportunity context: 'relocate' (Marksman, after a kill) or
  // 'hit_and_run' (Assault Vanguard L8, after damaging a Flanked enemy). Both
  // reuse the same relocateMode UI; the range and resolution differ.
  const relocateContext = useMemo(() => {
    if (!selectedUnit || phase !== 'player' || busy) return null;
    if (canRelocate(selectedUnit, getUnitAbility(selectedUnit, 'relocate'))) return 'relocate';
    const ss = getSkillState(selectedUnit);
    if (hasSkill(selectedUnit, 'hit_and_run') && ss.hitAndRunAvailable && !ss.hitAndRunUsed) return 'hit_and_run';
    return null;
  }, [selectedUnit, phase, busy, units]);

  const relocateReachable = useMemo(() => {
    if (!relocateMode || !selectedUnit || phase !== 'player' || busy) return null;
    const range = relocateContext === 'hit_and_run' ? 3 : getMovementRange(selectedUnit);
    const r = computeReachable(grid, units, selectedUnit, range);
    // Can't relocate onto occupied tiles or mission objects.
    r.delete(`${selectedUnit.x},${selectedUnit.y}`);
    if (civilian && !civilian.escortId && !civilian.safe) r.delete(`${civilian.x},${civilian.y}`);
    if (device && !device.sabotaged) r.delete(`${device.x},${device.y}`);
    return r;
  }, [relocateMode, relocateContext, selectedUnit, phase, busy, grid, units, civilian, device]);

  const abilityTargetCount = useMemo(() => {
    if (!activeAbility) return 0;
    switch (activeAbility.targetType) {
      case TARGET_TYPES.ENEMY: return abilityEnemyTargets.length;
      case TARGET_TYPES.ALLY: return abilityAllyTargets.length;
      case TARGET_TYPES.DASH: return dashReachable ? dashReachable.size : 0;
      case TARGET_TYPES.TILE_AOE: return grenadeImpactKeys ? grenadeImpactKeys.size : 0;
      case TARGET_TYPES.BARRICADE: return barricadeTiles ? barricadeTiles.size : 0;
      case TARGET_TYPES.TILE: return mineTiles ? mineTiles.size : 0;
      case TARGET_TYPES.WALL: return wallChargeTiles ? wallChargeTiles.size : 0;
      case TARGET_TYPES.GROUND: return instaWallTiles ? instaWallTiles.size : 0;
      default: return 0;
    }
  }, [activeAbility, abilityEnemyTargets, abilityAllyTargets, dashReachable, grenadeImpactKeys, barricadeTiles, mineTiles, wallChargeTiles, instaWallTiles]);

  // Per-unit preview badges (attack + abilities + grenade blast). A unit with a
  // badge is also a targeting ring. Logic extracted to src/game/unitBadges.js.
  const unitBadges = useMemo(
    () => computeUnitBadges({
      selectedUnit, attackMode, activeAbility,
      validTargets, abilityEnemyTargets, abilityAllyTargets,
      blastPreview, grid, movePreview, previewData,
    }),
    [selectedUnit, attackMode, activeAbility, validTargets, abilityEnemyTargets, abilityAllyTargets, blastPreview, grid, movePreview, previewData]
  );

  // Unified tile highlights (move / dash / enemy target / ally target / grenade / blast).
  const tileHighlights = useMemo(() => {
    const m = new Map();
    // Commander targeting owns the highlight layer when active — normal
    // movement/attack/ability highlights are suppressed.
    if (commanderTargeting) {
      const skill = getCommanderSkill(commanderTargeting.skillId);
      if (skill) {
        const battleState = { units, GRID_WIDTH, GRID_HEIGHT };
        // Unit targeting: highlight valid/invalid unit tiles
        if ([COMMANDER_TARGET_TYPES.FRIENDLY_UNIT, COMMANDER_TARGET_TYPES.ENEMY_UNIT, COMMANDER_TARGET_TYPES.ANY_UNIT].includes(skill.targetType)) {
          for (const u of units) {
            if (!u.alive) continue;
            const valid = isUnitValidCommanderTarget(commanderTargeting.skillId, u, battleState);
            m.set(`${u.x},${u.y}`, valid ? 'commander_valid' : 'commander_invalid');
          }
        }
        // Tile/area targeting: all battlefield tiles are valid centers
        if ([COMMANDER_TARGET_TYPES.TILE, COMMANDER_TARGET_TYPES.AREA, COMMANDER_TARGET_TYPES.FRIENDLY_AREA, COMMANDER_TARGET_TYPES.ENEMY_AREA].includes(skill.targetType)) {
          for (let x = 0; x < GRID_WIDTH; x++) {
            for (let y = 0; y < GRID_HEIGHT; y++) {
              m.set(`${x},${y}`, 'commander_valid');
            }
          }
        }
        // Selected target + area preview
        if (commanderTargeting.selectedTarget?.kind === 'tile') {
          const { x, y } = commanderTargeting.selectedTarget;
          m.set(`${x},${y}`, 'commander_selected');
          if (skill.radius > 0) {
            const area = getCommanderAffectedArea(commanderTargeting.skillId, x, y, GRID_WIDTH, GRID_HEIGHT);
            for (const t of area) {
              if (t.x === x && t.y === y) continue;
              m.set(`${t.x},${t.y}`, 'commander_area');
            }
          }
        }
      }
      return m;
    }
    if (reachable && !attackMode && !abilityTargeting) {
      for (const k of reachable.keys()) m.set(k, 'move');
    }
    if (dashReachable) for (const k of dashReachable.keys()) m.set(k, 'dash');
    if (attackMode && selectedUnit) {
      for (const t of validTargets) m.set(`${t.x},${t.y}`, 'target');
    } else if (abilityTargeting && activeAbility?.targetType === TARGET_TYPES.ENEMY) {
      for (const t of abilityEnemyTargets) m.set(`${t.x},${t.y}`, 'target');
    }
    if (abilityTargeting && activeAbility?.targetType === TARGET_TYPES.ALLY) {
      for (const t of abilityAllyTargets) m.set(`${t.x},${t.y}`, 'ally');
    }
    if (grenadeImpactKeys) for (const k of grenadeImpactKeys) if (!m.has(k)) m.set(k, 'grenade');
    if (barricadeTiles) for (const k of barricadeTiles) if (!m.has(k)) m.set(k, 'ally');
    if (mineTiles) for (const k of mineTiles) if (!m.has(k)) m.set(k, 'ally');
    if (wallChargeTiles) for (const k of wallChargeTiles) if (!m.has(k)) m.set(k, 'target');
    if (instaWallTiles) for (const k of instaWallTiles) if (!m.has(k)) m.set(k, 'ally');
    if (relocateReachable) for (const k of relocateReachable.keys()) if (!m.has(k)) m.set(k, 'dash');
    if (blastPreview) for (const k of blastPreview.keys) m.set(k, 'blast');
    if (debugTileKeys) for (const [k, v] of debugTileKeys) if (!m.has(k)) m.set(k, v);
    return m;
  }, [reachable, attackMode, abilityTargeting, activeAbility, dashReachable, validTargets, abilityEnemyTargets, abilityAllyTargets, grenadeImpactKeys, barricadeTiles, mineTiles, wallChargeTiles, instaWallTiles, relocateReachable, blastPreview, selectedUnit, commanderTargeting, units, debugTileKeys]);

  const allSpent = units
    .filter((u) => u.team === TEAMS.PLAYER && u.alive)
    .every((u) => u.ap <= 0);

  // --- Tactical Lens computations (read-only, memoized) ---
  // Recompute only when the Lens is open and the board / inspected target
  // changes — never on every animation frame.
  const lensThreatTiles = useMemo(() => {
    if (!lensActive || !lensShowThreat) return new Set();
    return computeThreatTiles(grid, units);
  }, [lensActive, lensShowThreat, grid, units]);

  const lensInspectedUnit = useMemo(() => {
    if (!lensInspected || lensInspected.kind !== 'unit') return null;
    return units.find((u) => u.id === lensInspected.unitId) || null;
  }, [lensInspected, units]);

  const lensInspectedRangeTiles = useMemo(() => {
    if (!lensActive || !lensInspectedUnit) return new Set();
    return computeUnitRangeTiles(grid, lensInspectedUnit);
  }, [lensActive, lensInspectedUnit, grid]);

  const lensLinesOfFire = useMemo(() => {
    if (!lensActive || !lensInspectedUnit) return [];
    return computeLinesOfFire(grid, units, lensInspectedUnit);
  }, [lensActive, lensInspectedUnit, grid, units]);

  const lensInspection = useMemo(() => {
    if (!lensActive || !lensInspected) return null;
    if (lensInspected.kind === 'unit') {
      const u = lensInspectedUnit;
      if (!u) return null;
      return { kind: 'unit', info: getUnitInspectInfo(u, grid, units) };
    }
    // terrain
    const coverInfo = getCoverInfo(grid, lensInspected.x, lensInspected.y);
    if (!coverInfo) return null;
    return { kind: 'terrain', coverInfo, label: getTerrainLabel(coverInfo) };
  }, [lensActive, lensInspected, lensInspectedUnit, grid, units]);

  // Quick enemy inspection (top-left tile, no Lens required). Resolves to the
  // living enemy unit or null. Stale ids (dead/extracted) are cleared below.
  const inspectedEnemy = useMemo(
    () =>
      inspectedEnemyId
        ? units.find((u) => u.id === inspectedEnemyId && u.alive && u.team === TEAMS.ENEMY) || null
        : null,
    [inspectedEnemyId, units]
  );

  // --- Boss mission: relay status + boss unit (for HUD, Battlefield, inspection) ---
  const isBossMission = !!(missionConfig && missionConfig.isBoss);
  const relayStatus = useMemo(
    () => isBossMission ? getRelayStatus(units) : null,
    [isBossMission, units]
  );
  const bossUnit = useMemo(
    () => isBossMission ? getBossUnit(units) : null,
    [isBossMission, units]
  );
  const bossUnitsForRender = useMemo(() => {
    if (!isBossMission) return null;
    return {
      relays: units.filter((u) => u.isBossObject),
      warden: bossUnit,
    };
  }, [isBossMission, units, bossUnit]);

  // Clear stale enemy inspection when the unit dies or the mission ends.
  useEffect(() => {
    if (inspectedEnemyId && !inspectedEnemy) setInspectedEnemyId(null);
  }, [inspectedEnemyId, inspectedEnemy]);

  // Clear enemy inspection when the mission enters a terminal / secured state.
  useEffect(() => {
    if (isTerminal || objectiveSecuredState || showPostChoice) setInspectedEnemyId(null);
  }, [isTerminal, objectiveSecuredState, showPostChoice]);

  // Boss mission: relay destruction + Core Shield break detection (extracted hook).
  const { resetBossRefs } = useBossMission({ isBossMission, units, setBossState, setBossMessage, bossMessage });

  // The Harvester (Chapter 2 Boss): mission-local state for Phase 1 testing.
  // Owns harvesterState, pending hazards (Tremor Slam + Excavation Beam), and
  // debug handlers. The enemy phase factory reads/writes these via refs.
  const {
    isHarvesterMission, harvesterState, setHarvesterState, harvesterStateRef,
    pendingTremor, setPendingTremor, pendingTremorRef,
    pendingBeam, setPendingBeam, pendingBeamRef,
    pendingCharge, setPendingCharge, pendingChargeRef,
    pendingMeltdown, setPendingMeltdown, pendingMeltdownRef,
    pendingCoreDischarge, setPendingCoreDischarge, pendingCoreDischargeRef,
    harvesterUnit, resetHarvester, checkPhase2Hook, checkPhase3Hook,
    cancelHarvesterHazards, markHarvesterDefeated,
    debugSetHp, debugSetArmor, debugResetCooldowns, debugForceTremor, debugForceBeam, debugResolveHazard,
    debugForcePhase2, debugForceFabrication, debugResetPhase1, debugForceCharge, debugResolveCharge,
    debugForcePhase3, debugResetPhase3, debugForceMeltdown, debugResolveMeltdown,
    debugForceCoreDischarge, debugResolveCoreDischarge,
  } = useHarvesterMission({ missionConfig, units, setUnits });

  // Harvester unit regardless of alive status. getHarvesterUnit (in the hook)
  // filters alive, returning null when the Harvester dies — so the defeat
  // effect below uses this any-status version to detect death.
  const harvesterUnitAny = useMemo(
    () => isHarvesterMission ? units.find((u) => u.isBoss && u.archetype === 'harvester') || null : null,
    [isHarvesterMission, units]
  );

  // Armor Breach banner: shows once when the Harvester transitions to Phase 2.
  // The Fabrication Sequence banner follows it (Part 2, 8 — sequenced, not stacked).
  const [showArmorBreach, setShowArmorBreach] = useState(false);
  const [showFabricationBanner, setShowFabricationBanner] = useState(false);
  const prevPhase2Triggered = useRef(false);
  useEffect(() => {
    if (!isHarvesterMission) return;
    const triggered = !!harvesterState?.phase2Triggered;
    if (triggered && !prevPhase2Triggered.current) {
      setShowArmorBreach(true);
      const t1 = setTimeout(() => setShowArmorBreach(false), 2000);
      // Fabrication banner follows after the breach banner (Part 2, 8).
      const t2 = setTimeout(() => setShowFabricationBanner(true), 1800);
      const t3 = setTimeout(() => setShowFabricationBanner(false), 4200);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }
    prevPhase2Triggered.current = triggered;
  }, [isHarvesterMission, harvesterState?.phase2Triggered]);

  // Core Failure banner: shows once when the Harvester transitions to Phase 3.
  const [showCoreFailure, setShowCoreFailure] = useState(false);
  const prevPhase3Triggered = useRef(false);
  useEffect(() => {
    if (!isHarvesterMission) return;
    const triggered = !!harvesterState?.phase3Triggered;
    if (triggered && !prevPhase3Triggered.current) {
      setShowCoreFailure(true);
      const t = setTimeout(() => setShowCoreFailure(false), 2400);
      return () => clearTimeout(t);
    }
    prevPhase3Triggered.current = triggered;
  }, [isHarvesterMission, harvesterState?.phase3Triggered]);

  // Boss defeat cleanup (Parts 33-35): when the Warden dies, clear all pending
  // boss hazards and deactivate surviving enemies (retreat — no rewards).
  useEffect(() => {
    if (isBossMission && bossState.bossPhase === BOSS_PHASES.DEFEATED) {
      setBeamSweeps([]); setOverloadHazards([]);
      setUnits(prev => prev.map(u => u.team === TEAMS.ENEMY && u.alive && !u.isBoss ? { ...u, alive: false, retreated: true } : u));
    }
  }, [isBossMission, bossState.bossPhase]);

  // The Harvester Phase 2 condition hook (Part 41): check after any units
  // change whether the Harvester's Current Armor has dropped to ≤ 2. Sets
  // phase2ConditionMet = true once. Does NOT transition the phase yet.
  useEffect(() => {
    if (isHarvesterMission) checkPhase2Hook();
  }, [isHarvesterMission, units, checkPhase2Hook]);

  // The Harvester Phase 3 condition hook (Part 55): check after any damage.
  // Hook only — does NOT transition the phase. Idempotent.
  useEffect(() => {
    if (isHarvesterMission) checkPhase3Hook();
  }, [isHarvesterMission, units, checkPhase3Hook]);

  // The Harvester defeat cleanup: when HP reaches 0, mark defeated and cancel
  // all pending hazards. Surviving enemies retreat (no rewards). Uses
  // harvesterUnitAny (alive or dead) since getHarvesterUnit filters alive.
  // Guarded by !harvesterState?.bossDefeated so it fires exactly once.
  useEffect(() => {
    if (isHarvesterMission && harvesterUnitAny && !harvesterUnitAny.alive && !harvesterState?.bossDefeated) {
      markHarvesterDefeated();
      setUnits(prev => prev.map(u => u.team === TEAMS.ENEMY && u.alive && !u.isBoss ? { ...u, alive: false, retreated: true } : u));
    }
  }, [isHarvesterMission, harvesterUnitAny, harvesterState?.bossDefeated, markHarvesterDefeated, setUnits]);

  // Core Collapse presentation: plays once when the Harvester is defeated,
  // before the result screen. ~2.5s full-screen flash, then hands off.
  // (showCoreCollapse + coreCollapsePlayedRef are declared above, near inputLocked.)
  useEffect(() => {
    if (isHarvesterMission && harvesterState?.bossDefeated && !coreCollapsePlayedRef.current) {
      coreCollapsePlayedRef.current = true;
      setShowCoreCollapse(true);
      const t = setTimeout(() => setShowCoreCollapse(false), 2500);
      return () => clearTimeout(t);
    }
  }, [isHarvesterMission, harvesterState?.bossDefeated]);

  // Enemy Commander hook — owns the mission-local hostile Commander state
  // (profile, Command Budget, uses, cooldowns) and the player-facing UI. See
  // src/hooks/useEnemyCommander.js. No command execution in this phase.
  const {
    profile: enemyCommanderProfile,
    displayProfile: enemyCommanderDisplay,
    battleState: enemyCommanderBattleState,
    enemyCommanderActive,
    assignmentSource: enemyCommanderSource,
    assignmentValid: enemyCommanderValid,
    assignmentReason: enemyCommanderReason,
    budgetCurrent: enemyBudgetCurrent,
    budgetMax: enemyBudgetMax,
    showBanner: showEnemyCommanderBanner,
    commandNotification: enemyCommanderNotification,
    panelOpen: enemyCommanderPanelOpen,
    setPanelOpen: setEnemyCommanderPanelOpen,
    isFirstEncounter: enemyCommanderFirstEncounter,
    showTutorial: showEnemyCommanderTutorial,
    handleDismissTutorial: handleDismissEnemyCommanderTutorial,
    assignmentDebugReason: enemyCommanderAssignmentReason,
    resetEnemyCommander,
    clearOnExit: clearEnemyCommanderOnExit,
    processEnemyCommanderAction,
    lastExecutionResult: enemyCommanderLastResult,
    lastEvaluation: enemyCommanderLastEvaluation,
    aiOverrides: enemyCommanderAiOverrides,
    handleRunEvaluation: handleRunEnemyEvaluation,
    handleSetHoldThreshold: handleSetEnemyHoldThreshold,
    handleSetReserveBias: handleSetEnemyReserveBias,
    handleSetInvalidateTarget: handleSetEnemyInvalidateTarget,
    devOverride: enemyCommanderDevOverride,
    handleSetDevOverride: handleSetEnemyCommanderDevOverride,
    handleSpendCommandPoint: handleSpendEnemyCommandPoint,
    handleResetBudget: handleResetEnemyBudget,
    handleForceCommand: handleForceEnemyCommand,
    handleSimulateDuplicate: handleSimulateEnemyDuplicate,
    handleTriggerActionWindow: handleTriggerEnemyActionWindow,
  } = useEnemyCommander({
    missionId, missionConfig, phase, isTerminal, debug,
    units, grid, GRID_WIDTH, GRID_HEIGHT,
    setUnits,
  });

  const {
    siegeTestMode, setSiegeTestMode, siegeDestructionFx, triggerSiegeFx,
    handleSiegeTestTileTap, resetSiegeTest,
  } = useSiegeTest({ grid, setGrid, busy, flashAttackFeedback });

  const { actionBubbles, showActionBubble, clearActionBubbles } = useActionBubbles();

  // Brief "Cover Destroyed" bubble when one or more cover pieces are destroyed
  // by an attack or grenade blast. Auto-dismisses after ~1s.
  const showCoverDestroyed = (count) => {
    if (coverDestroyedTimer.current) clearTimeout(coverDestroyedTimer.current);
    setCoverDestroyed({ count, id: Date.now() });
    coverDestroyedTimer.current = setTimeout(() => setCoverDestroyed(null), 1000);
  };

  // Burning action-completion hooks for both phases (player + enemy). Extracted
  // to a shared module so the logic lives once; drop-in replacements for the
  // former inline withBurning / applyEnemyBurning.
  const { withBurning, applyEnemyBurning } = createBurningHooks({
    pushPopup, setHitFlashId, hitTimer, HIT_FLASH_MS, flashAttackFeedback,
  });

  // Player movement processor: animates tile-by-tile and applies Volatile Tile
  // hazard damage at each step. Returns { finalX, finalY, stoppedEarly,
  // tilesTraversed, downed, killed, finalUnit }.
  const processPlayerPath = createPlayerMovementProcessor({
    tokenRefs, setUnits, pushPopup, flashAttackFeedback,
    setHitFlashId, hitTimer, sleep,
    HIT_FLASH_MS, REACTION_MS,
  });

  // Movement execution is separable from AP cost (future free/forced movement).
  const performMove = async (unit, entry) => {
    setMoving(true);
    showActionBubble(unit.id, BUBBLE.MOVING);
    const result = await processPlayerPath(unit, entry.path, grid);
    const tiles = Math.max(1, result.tilesTraversed);
    // Use finalUnit from the processor (has updated HP/x/y from volatile damage).
    const movedUnit = clearLineUp({ ...result.finalUnit, ap: unit.ap - 1, reaction: null });
    // Evasive Advance: track tiles moved this phase. Also reset Sustained Fire.
    const finalUnit = withBurning(onPlayerMove(resetSustainedFire(movedUnit), tiles), result.finalX, result.finalY);
    setUnits((prev) => prev.map((u) => (u.id === unit.id ? finalUnit : u)));
    setMoving(false);
    // If this unit is escorting the civilian, the civilian follows to the
    // new tile. If the new tile is in the extraction zone, the civilian is safe.
    if (civilianRef.current && civilianRef.current.escortId === unit.id && !civilianRef.current.safe) {
      setCivilian((prev) => {
        if (!prev || prev.escortId !== unit.id || prev.safe) return prev;
        const next = { ...prev, x: result.finalX, y: result.finalY };
        if (isInExtractionZone(extractionZone, result.finalX, result.finalY)) {
          return { ...next, safe: true, escortId: null };
        }
        return next;
      });
    }
  };

  // Deterministic attack resolution. No hit chance, no randomness.
  // Presentation is downstream of combat: the result is computed first, the
  // visual shot plays, then state changes apply at impact.
  const performAttack = async (attacker, target) => {
    const weapon = getUnitWeapon(attacker);
    if (!weapon) return;
    // Line Up (Marksman): active buff ignores cover on the next attack
    // against this specific target.
    const ignoreCover = hasLineUpOn(attacker, target);
    const o = computeDamage(attacker, target, grid, { ignoreCover }); // includes Marked bonus

    setResolving(true);
    setAttackMode(false);
    showActionBubble(attacker.id, BUBBLE.ATTACKING);

    setLastAttack({
      attacker: attacker.name,
      ax: attacker.x, ay: attacker.y,
      target: target.name, tx: target.x, ty: target.y,
      range: Math.max(Math.abs(attacker.x - target.x), Math.abs(attacker.y - target.y)),
      weaponRange: weapon.range,
      state: o.state, baseDamage: o.baseDamage, modifier: o.modifier,
      markedBonus: o.markedBonus, finalDamage: o.finalDamage, hpBefore: target.hp, hpAfter: o.hpAfter,
      killed: o.killed, apBefore: attacker.ap, apAfter: attacker.ap - weapon.apCost,
    });

    // --- Attack presentation: travel phase (muzzle flash + tracer/beam). ---
    // Visual only — no combat state changes until impact. Presentation type is
    // derived from the weapon (data-driven), never from team.
    const presentation = getWeaponPresentation(weapon);
    const shotTiming = getShotTiming(presentation);
    const shotProfile = getWeaponVisualProfile(weapon);
    const shotIdVal = ++shotId.current;
    setActiveShot({
      id: shotIdVal,
      from: { x: attacker.x, y: attacker.y },
      to: { x: target.x, y: target.y },
      presentation,
      profile: shotProfile,
      phase: 'travel',
    });
    await sleep(shotTiming.travel);

    // --- Impact: apply all combat state changes (existing deterministic rules). ---
    setActiveShot((prev) => (prev && prev.id === shotIdVal ? { ...prev, phase: 'impact' } : prev));

    // Room Clearer (Assault Breacher L10): Breach kill makes the next Shotgun 0 AP.
    const preSS = getSkillState(attacker);
    const roomClearerFree = weapon.family === 'shotgun' && preSS.roomClearerReady;
    const apCost = roomClearerFree ? 0 : weapon.apCost;
    // Attacker: spend ammo + AP, clear Line Up buff (only if this was the marked
    // target) + reaction, then Burning hook.
    let atkFinal = withBurning(
      { ...consumeAmmo(attacker), ap: Math.max(0, attacker.ap - apCost), reaction: null },
      attacker.x,
      attacker.y
    );
    if (roomClearerFree) atkFinal = setSkillState(atkFinal, { roomClearerReady: false });
    if (ignoreCover) atkFinal = clearLineUp(atkFinal);
    // Target: apply damage via unified resolver (player → downed, enemy → dead).
    const tgtResult = resolveTargetDamage(consumeMarked(target), o.finalDamage);
    // Armor Shred: LMG attacks shred 1 Armor after damage resolves (pre-Shred Armor used for damage).
    const shredAmt = getAttackArmorShred(null, weapon);
    const tgtFinal = (tgtResult.unit.alive && !tgtResult.unit.downed && shredAmt > 0)
      ? applyArmorShred(tgtResult.unit, shredAmt)
      : tgtResult.unit;
    // Track kills and momentum on the attacker.
    if (tgtResult.killed) {
      atkFinal = {
        ...atkFinal,
        missionKills: (atkFinal.missionKills || 0) + 1,
        missionEliteKills: (atkFinal.missionEliteKills || 0) + (target.elite ? 1 : 0),
      };
      if (atkFinal.upgrades?.level2 === 'momentum' && !atkFinal.momentumUsed) {
        atkFinal = { ...atkFinal, ap: atkFinal.ap + 1, momentumUsed: true };
        pushPopup(attacker.x, attacker.y, 1, false, 'ap');
      }
      // Relocate (Marksman level 2): enable a free reposition after a kill.
      if (atkFinal.upgrades?.level2 === 'relocate' && !atkFinal.relocateUsed) {
        atkFinal = enableRelocate(atkFinal, getUnitAbility(atkFinal, 'relocate'));
      }
      // Skill kill effects: Execution Window (+1 AP), Blitz (refresh Dash),
      // Room Clearer (ready), Chain Hunter (refresh + bonus).
      const killFx = applyKillEffects(atkFinal, target, { weapon, isBreach: false, distance: gridDistance(attacker, target) });
      atkFinal = killFx.unit;
      for (const p of killFx.popups) {
        if (p.kind === 'ap') pushPopup(attacker.x, attacker.y, p.amount, false, 'ap');
        else if (p.kind === 'status') flashAttackFeedback(attacker.x, attacker.y, p.text, 'status');
      }
    }
    // Consume one-shot skill bonuses that fired on this attack.
    if (weapon.family === 'shotgun') atkFinal = consumeShockEntry(atkFinal);
    if (weapon.family === 'sniper_rifle') atkFinal = consumeChainHunterBonus(atkFinal);
    atkFinal = consumeCoordinatedStrike(atkFinal);
    atkFinal = trackSustainedFire(atkFinal, target.id, weapon.family === 'lmg');
    // Hit and Run (Assault Vanguard L8): damaging a Flanked enemy enables a 3-tile reposition.
    if (o.state === 'flanked' && o.finalDamage > 0 && hasSkill(atkFinal, 'hit_and_run')) {
      const ss = getSkillState(atkFinal);
      if (!ss.hitAndRunUsed) atkFinal = setSkillState(atkFinal, { hitAndRunAvailable: true });
    }

    setUnits((prev) =>
      prev.map((u) => {
        if (u.id === attacker.id) return atkFinal;
        if (u.id === target.id) return tgtFinal;
        return u;
      })
    );

    // Shield hit feedback: show shield absorption (cyan) separately from HP damage.
    if (tgtResult.coreShieldAbsorbed > 0) {
      pushPopup(target.x, target.y, tgtResult.coreShieldAbsorbed, false, 'shield');
      if (o.hpDamage > 0) setTimeout(() => pushPopup(target.x, target.y, o.hpDamage, tgtResult.killed, 'damage'), 150);
    } else if (tgtResult.shieldAbsorbed > 0) {
      pushPopup(target.x, target.y, tgtResult.shieldAbsorbed, false, 'shield');
      if (o.hpDamage > 0) setTimeout(() => pushPopup(target.x, target.y, o.hpDamage, tgtResult.killed, 'damage'), 150);
    } else {
      pushPopup(target.x, target.y, o.finalDamage, tgtResult.killed, 'damage');
    }
    if (tgtResult.downed) flashAttackFeedback(target.x, target.y, 'DOWNED', 'status');
    if (shredAmt > 0 && tgtResult.unit.alive && !tgtResult.unit.downed) {
      flashAttackFeedback(target.x, target.y, `ARMOR -${shredAmt}`, 'status');
    }
    if (o.hpDamage > 0 || tgtResult.killed) {
      setHitFlashId(target.id);
      if (hitTimer.current) clearTimeout(hitTimer.current);
      hitTimer.current = setTimeout(() => setHitFlashId(null), HIT_FLASH_MS);
    }

    // Cover damage + Shatter (Heavy Demolitions L8): destroying cover that was
    // protecting an enemy Marks them. Compute before/after to detect destruction.
    let gridAfter = grid;
    if (o.state === 'covered' && !ignoreCover) gridAfter = damageProtectingCover(gridAfter, attacker, target, 1);
    if (weapon.terrainDamage && !ignoreCover) gridAfter = damageCoverTile(gridAfter, target.x, target.y, weapon.terrainDamage);
    if (gridAfter !== grid) {
      const shatterIds = getShatterMarks(grid, gridAfter, units, atkFinal);
      const cd = countNewlyDestroyedCover(grid, gridAfter); if (cd) showCoverDestroyed(cd);
      setGrid(gridAfter);
      if (shatterIds.length > 0) setUnits((prev) => applyShatterMarks(prev, shatterIds, atkFinal.id));
    }

    await sleep(shotTiming.impact);
    setActiveShot(null);
    tutorial.onEvent(TUT_ACTION.FIRE, { attackerId: attacker.id, targetId: target.id, state: o.state });
    if (o.state === 'flanked') tutorial.onEvent(TUT_ACTION.FLANK_ATTACK, { attackerId: attacker.id, targetId: target.id, state: 'flanked' });
    if (shredAmt > 0) tutorial.onEvent(TUT_ACTION.SHRED_ARMOR, { targetId: target.id, amount: shredAmt });
    setResolving(false);
  };

  // --- Ability resolution ---

  const performDash = async (unit, entry) => {
    setMoving(true);
    setAbilityTargeting(null);
    showActionBubble(unit.id, getAbilityBubbleMessage('dash'));
    const dashAbility = getUnitAbility(unit, 'dash');
    const result = await processPlayerPath(unit, entry.path, grid);
    const tiles = Math.max(1, result.tilesTraversed);
    // 0 AP cost — only position + cooldown change. Dash is still an action, so
    // the Burning hook fires even though no AP was spent. Shock Entry (L6
    // Breacher) readies a +2 damage bonus on the next Shotgun/Breach this phase.
    let dashUnit = clearLineUp({ ...result.finalUnit, cooldowns: { ...unit.cooldowns, dash: dashAbility.cooldown }, reaction: null });
    dashUnit = onDashUsed(onPlayerMove(resetSustainedFire(dashUnit), tiles));
    const finalUnit = withBurning(dashUnit, result.finalX, result.finalY);
    setUnits((prev) => prev.map((u) => (u.id === unit.id ? finalUnit : u)));
    setMoving(false);
    // Escorting civilian follows on dash too.
    if (civilianRef.current && civilianRef.current.escortId === unit.id && !civilianRef.current.safe) {
      setCivilian((prev) => {
        if (!prev || prev.escortId !== unit.id || prev.safe) return prev;
        const next = { ...prev, x: result.finalX, y: result.finalY };
        if (isInExtractionZone(extractionZone, result.finalX, result.finalY)) {
          return { ...next, safe: true, escortId: null };
        }
        return next;
      });
    }
  };

  const performBreach = (attacker, target) => {
    const breachAbility = getUnitAbility(attacker, 'breach');
    const o = getBreachOutcome(target, breachAbility.damage, attacker); // 8 (+Marked+skill) damage, ignores cover
    setResolving(true);
    setAbilityTargeting(null);
    showActionBubble(attacker.id, getAbilityBubbleMessage('breach'));
    let atkFinal = withBurning(
      { ...attacker, ap: Math.max(0, attacker.ap - 1), cooldowns: { ...attacker.cooldowns, breach: breachAbility.cooldown }, reaction: null },
      attacker.x,
      attacker.y
    );
    const tgtResult = resolveTargetDamage(consumeMarked(target), o.damage);
    const tgtFinal = tgtResult.unit;
    if (tgtResult.killed) {
      atkFinal = {
        ...atkFinal,
        missionKills: (atkFinal.missionKills || 0) + 1,
        missionEliteKills: (atkFinal.missionEliteKills || 0) + (target.elite ? 1 : 0),
      };
      if (atkFinal.upgrades?.level2 === 'momentum' && !atkFinal.momentumUsed) {
        atkFinal = { ...atkFinal, ap: atkFinal.ap + 1, momentumUsed: true };
        pushPopup(attacker.x, attacker.y, 1, false, 'ap');
      }
      const killFx = applyKillEffects(atkFinal, target, { isBreach: true, distance: gridDistance(attacker, target) });
      atkFinal = killFx.unit;
      for (const p of killFx.popups) {
        if (p.kind === 'ap') pushPopup(attacker.x, attacker.y, p.amount, false, 'ap');
        else if (p.kind === 'status') flashAttackFeedback(attacker.x, attacker.y, p.text, 'status');
      }
    }
    atkFinal = consumeShockEntry(atkFinal);
    atkFinal = consumeCoordinatedStrike(atkFinal);
    setUnits((prev) =>
      prev.map((u) => {
        if (u.id === attacker.id) return atkFinal;
        if (u.id === target.id) return tgtFinal;
        return u;
      })
    );
    pushPopup(target.x, target.y, o.damage, tgtResult.killed, 'damage');
    if (tgtResult.downed) flashAttackFeedback(target.x, target.y, 'DOWNED', 'status');
    setHitFlashId(target.id);
    if (hitTimer.current) clearTimeout(hitTimer.current);
    hitTimer.current = setTimeout(() => setHitFlashId(null), HIT_FLASH_MS);
    setResolving(false);
  };

  const performSuppress = (attacker, target) => {
    setResolving(true);
    setAbilityTargeting(null);
    const suppressAbility = getUnitAbility(attacker, 'suppress');
    const penalty = attacker.upgrades?.level4 === 'deep_suppression' ? 3 : 2;
    const suppressAp = getAbilityApCost(attacker, suppressAbility);
    const atkFinal = withBurning(
      markAbilityUsed({ ...attacker, ap: Math.max(0, attacker.ap - suppressAp), cooldowns: { ...attacker.cooldowns, suppress: suppressAbility.cooldown }, reaction: null }, 'suppress'),
      attacker.x,
      attacker.y
    );
    const tgtFinal = applyStatus(target, STATUS_TYPES.SUPPRESSED, { source: attacker.id, turnsRemaining: 1, penalty });
    setUnits((prev) =>
      prev.map((u) => {
        if (u.id === attacker.id) return atkFinal;
        if (u.id === target.id) return tgtFinal;
        return u;
      })
    );
    flashStatusLabel(target.x, target.y, 'SUPPRESSED', 'status');
    setResolving(false);
  };

  const performDisruptorHook = async (attacker, target, pull) => {
    if (!attacker || !target) return;
    const livePull = pull && pull.valid ? pull : computeComeHerePull(grid, units, attacker, target);
    if (!livePull || !livePull.valid) {
      flashAttackFeedback(target.x, target.y, 'NO PULL PATH', 'status');
      return;
    }

    setResolving(true);
    setAbilityTargeting(null);
    showActionBubble(attacker.id, getAbilityBubbleMessage('disruptor_hook') || 'HOOK!');

    const hookAbility = getUnitAbility(attacker, 'disruptor_hook');
    const apCost = hookAbility?.apCost ?? 1;

    let atkFinal = withBurning(
      {
        ...attacker,
        ap: Math.max(0, attacker.ap - apCost),
        abilityUses: {
          ...attacker.abilityUses,
          disruptor_hook: (attacker.abilityUses?.disruptor_hook || 0) + 1,
        },
        reaction: null,
      },
      attacker.x,
      attacker.y
    );

    setUnits((prev) => prev.map((u) => (u.id === attacker.id ? atkFinal : u)));
    flashAttackFeedback(attacker.x, attacker.y, 'DISRUPTOR HOOK', 'ability');
    await sleep(200);

    const path = livePull.path;
    const el = tokenRefs.current[target.id];
    let currentTarget = target;
    let stopped = false;

    for (let i = 1; i < path.length && !stopped; i++) {
      const [px, py] = path[i - 1];
      const [nx, ny] = path[i];

      await animateSegment(el, px, py, nx, ny, 85);

      currentTarget = { ...currentTarget, x: nx, y: ny };
      setUnits((prev) => prev.map((u) => (u.id === target.id ? currentTarget : u)));

      const step = processForcedMovementTileEntry({
        grid,
        unit: currentTarget,
        x: nx,
        y: ny,
        mines: minesRef.current,
        units,
      });

      currentTarget = step.unit;

      if (step.hasHazard) {
        setUnits((prev) => prev.map((u) => (u.id === target.id ? currentTarget : u)));
        pushPopup(nx, ny, step.hazardDamage, step.killed, 'damage');
        if (step.hazardDowned) flashAttackFeedback(nx, ny, 'DOWNED', 'status');
        else flashAttackFeedback(nx, ny, 'VOLATILE', 'status');
        setHitFlashId(target.id);
        if (hitTimer.current) clearTimeout(hitTimer.current);
        hitTimer.current = setTimeout(() => setHitFlashId(null), HIT_FLASH_MS);
        await sleep(REACTION_MS);
      }

      if (step.mineTriggered) {
        const mine = step.mineTriggered;
        minesRef.current = minesRef.current.filter((m) => m.id !== mine.id);
        setMines((prev) => prev.filter((m) => m.id !== mine.id));

        setUnits((prev) => prev.map((u) => (u.id === target.id ? currentTarget : u)));
        pushPopup(nx, ny, step.mineDamage, step.killed, 'damage');
        setHitFlashId(target.id);
        if (hitTimer.current) clearTimeout(hitTimer.current);
        hitTimer.current = setTimeout(() => setHitFlashId(null), HIT_FLASH_MS);
        if (!step.killed) flashAttackFeedback(nx, ny, 'STUNNED', 'status');
        await sleep(REACTION_MS);
      }

      if (step.stopped) {
        stopped = true;
      }
    }

    if (!currentTarget.alive && target.alive) {
      atkFinal = {
        ...atkFinal,
        missionKills: (atkFinal.missionKills || 0) + 1,
        missionEliteKills: (atkFinal.missionEliteKills || 0) + (target.elite ? 1 : 0),
      };
    }

    setUnits((prev) =>
      prev.map((u) => {
        if (u.id === attacker.id) return atkFinal;
        if (u.id === target.id) return currentTarget;
        return u;
      })
    );

    await sleep(100);
    setResolving(false);
  };

  const performHeal = (attacker, target) => {
    const healAbility = getUnitAbility(attacker, 'heal');
    // Emergency Medicine: +2 healing if target at ≤50% Max HP.
    const emergencyBonus = getEmergencyHealBonus(attacker, target);
    // Lifeline (Support Medic L10): +2 HP when healing a Downed ally.
    const lifelineBonus = getLifelineReviveBonus(attacker);
    const baseHealing = (healAbility.healing || 0) + emergencyBonus;
    setResolving(true);
    setAbilityTargeting(null);
    const isRevive = !!(target && target.downed);
    showActionBubble(attacker.id, isRevive ? BUBBLE.REVIVE : getAbilityBubbleMessage('heal'));
    const atkFinal = withBurning(
      { ...attacker, ap: Math.max(0, attacker.ap - 1), cooldowns: { ...attacker.cooldowns, heal: healAbility.cooldown }, reaction: null },
      attacker.x,
      attacker.y
    );
    // Healing a Downed ally revives them: HP set to the heal amount (+Lifeline),
    // capped at maxHp. Stabilize (L8) lets the revived ally be Commanded this
    // phase (recovering cleared).
    const reviveHp = Math.min(baseHealing + lifelineBonus, target.maxHp);
    const allowCommand = stabilizeAllowsCommand(attacker);
    setUnits((prev) =>
      prev.map((u) => {
        if (u.id === attacker.id) return atkFinal;
        if (u.id === target.id) {
          if (isRevive) return reviveUnit(u, reviveHp, !allowCommand);
          const o = getHealOutcome(u, baseHealing);
          return { ...u, hp: u.hp + o.heal };
        }
        return u;
      })
    );
    pushPopup(target.x, target.y, isRevive ? reviveHp : getHealOutcome(target, baseHealing).heal, false, 'heal');
    if (isRevive) flashAttackFeedback(target.x, target.y, 'REVIVED', 'status');
    if (isRevive) tutorial.onEvent(TUT_ACTION.REVIVE, { reviverId: attacker.id, targetId: target.id });
    setResolving(false);
  };

  const performCommand = (attacker, target) => {
    setResolving(true);
    setAbilityTargeting(null);
    const commandAbility = getUnitAbility(attacker, 'command');
    const commandAp = getAbilityApCost(attacker, commandAbility);
    const atkFinal = withBurning(
      markAbilityUsed({ ...attacker, ap: Math.max(0, attacker.ap - commandAp), cooldowns: { ...attacker.cooldowns, command: commandAbility.cooldown }, reaction: null }, 'command'),
      attacker.x,
      attacker.y
    );
    // Rally (Support Commander L6): Command cleanses Suppressed + Marked.
    // Coordinated Strike (L8): the buffed ally's next attack gains +2 damage.
    const hasRallySkill = hasRally(attacker);
    const hasCoordinated = hasSkill(attacker, 'coordinated_strike');
    setUnits((prev) =>
      prev.map((u) => {
        if (u.id === attacker.id) return atkFinal;
        if (u.id === target.id) {
          let nu = { ...u, ap: Math.min(3, u.ap + 1) }; // temp 3 AP this phase
          if (hasRallySkill) nu = removeStatuses(nu, [STATUS_TYPES.SUPPRESSED, STATUS_TYPES.MARKED]);
          if (hasCoordinated) nu = { ...nu, coordinatedStrike: true };
          return nu;
        }
        return u;
      })
    );
    pushPopup(target.x, target.y, 1, false, 'ap');
    if (hasRallySkill) flashAttackFeedback(target.x, target.y, 'CLEANSED', 'status');
    setResolving(false);
  };

  const tryGrenadeImpact = (x, y) => {
    if (!grenadeImpactKeys || !grenadeImpactKeys.has(`${x},${y}`)) { flashInvalid({ x, y }); return; }
    showActionBubble(selectedUnit.id, getAbilityBubbleMessage(activeAbility.id));
    tutorial.onEvent(TUT_ACTION.GRENADE, { x, y });
    if (activeAbility?.id === 'smoke_grenade') { resolveSmokeGrenade({ grid, setGrid, caster: selectedUnit, x, y, withBurning, setUnits, setResolving, setAbilityTargeting, flashAttackFeedback, flashInvalid, grenadeImpactKeys }); return; }
    const isRocket = activeAbility?.id === 'launch_rocket';
    const blast = (isRocket ? computeRocketBlast : computeGrenadeBlast)(grid, units, selectedUnit, x, y, activeAbility);
    const runBlast = () => {
      setAbilityTargeting(null); setBlastPreview({ ...blast, impactKey: `${x},${y}` }); setResolving(true);
      if (blastTimer.current) clearTimeout(blastTimer.current);
      blastTimer.current = setTimeout(() => (isRocket ? applyRocketBlast : applyGrenadeBlast)({ caster: selectedUnit, blast, grid, units, setUnits, setGrid, setBlastPreview, setResolving, pushPopup, flashAttackFeedback, withBurning, onCoverDestroyed: showCoverDestroyed }), GRENADE_PREVIEW_MS);
    };
    if (getDetailedTargetingInfo()) {
      openAttackPreview((isRocket ? buildRocketPreview : buildGrenadePreview)({ grid, units, caster: selectedUnit, x, y, ability: activeAbility }), runBlast);
      return;
    }
    runBlast();
  };

  const performFieldMedkit = (attacker, target) => {
    setResolving(true);
    setAbilityTargeting(null);
    const isRevive = !!(target && target.downed);
    const medkitHealing = 3;
    // Healing a Downed ally revives them: HP set to the medkit's heal amount,
    // capped at maxHp. Stabilize (L8) lets the revived ally be Commanded.
    const allowCommand = stabilizeAllowsCommand(attacker);
    showActionBubble(attacker.id, isRevive ? BUBBLE.REVIVE : getAbilityBubbleMessage('field_medkit'));
    const atkFinal = withBurning(
      { ...attacker, ap: Math.max(0, attacker.ap - 1), abilityUses: { ...attacker.abilityUses, field_medkit: (attacker.abilityUses?.field_medkit || 0) + 1 }, reaction: null },
      attacker.x, attacker.y
    );
    setUnits((prev) =>
      prev.map((u) => {
        if (u.id === attacker.id) return atkFinal;
        if (u.id === target.id) {
          if (isRevive) return reviveUnit(u, Math.min(medkitHealing, u.maxHp), !allowCommand);
          const o = getHealOutcome(u, medkitHealing);
          return { ...u, hp: u.hp + o.heal };
        }
        return u;
      })
    );
    pushPopup(target.x, target.y, isRevive ? medkitHealing : getHealOutcome(target, medkitHealing).heal, false, 'heal');
    if (isRevive) { flashAttackFeedback(target.x, target.y, 'REVIVED', 'status'); tutorial.onEvent(TUT_ACTION.REVIVE, { reviverId: attacker.id, targetId: target.id }); }
    setResolving(false);
  };

  // --- Marksman abilities ---

  // LINE UP: 1 AP. Mark a specific enemy target. The next standard attack
  // against that target ignores cover reduction. The buff is consumed by
  // performAttack when it hits the marked target.
  const performLineUp = (attacker, target) => {
    setResolving(true);
    setAbilityTargeting(null);
    const lineUpAbility = getUnitAbility(attacker, 'line_up');
    const atkFinal = withBurning(
      applyLineUp(attacker, target, lineUpAbility),
      attacker.x,
      attacker.y
    );
    setUnits((prev) => prev.map((u) => (u.id === attacker.id ? atkFinal : u)));
    flashAttackFeedback(target.x, target.y, 'LINE UP', 'status');
    setResolving(false);
  };

  // RELOCATE: 0 AP, free reposition after a kill. Animates the marksman to the
  // chosen tile and clears the relocate flag.
  const performRelocateMove = async (unit, tile) => {
    setMoving(true);
    setRelocateMode(false);
    showActionBubble(unit.id, getAbilityBubbleMessage('relocate'));
    const isHitAndRun = relocateContext === 'hit_and_run';
    // Simple direct path for relocate (free move, no pathfinding needed).
    const relocatePath = [[unit.x, unit.y], [tile.x, tile.y]];
    const result = await processPlayerPath(unit, relocatePath, grid);
    let finalUnit;
    if (isHitAndRun) {
      // Hit and Run: 0-AP reposition, consume the opportunity.
      finalUnit = setSkillState({ ...result.finalUnit, x: result.finalX, y: result.finalY, reaction: null }, { hitAndRunAvailable: false, hitAndRunUsed: true });
    } else {
      const relocateAbility = getUnitAbility(unit, 'relocate');
      finalUnit = performRelocate({ ...result.finalUnit, x: result.finalX, y: result.finalY }, { x: result.finalX, y: result.finalY }, relocateAbility);
    }
    setUnits((prev) => prev.map((u) => (u.id === unit.id ? finalUnit : u)));
    setMoving(false);
    // Escorting civilian follows on relocate too.
    if (civilianRef.current && civilianRef.current.escortId === unit.id && !civilianRef.current.safe) {
      setCivilian((prev) => {
        if (!prev || prev.escortId !== unit.id || prev.safe) return prev;
        const next = { ...prev, x: result.finalX, y: result.finalY };
        if (isInExtractionZone(extractionZone, result.finalX, result.finalY)) {
          return { ...next, safe: true, escortId: null };
        }
        return next;
      });
    }
  };

  // --- Engineer abilities ---

  // DEPLOY BARRICADE: 1 AP. After tile selection, show the orientation picker.
  // The picker calls back with a direction, which finalizes placement.
  const startBarricadePlacement = (tile) => {
    setBarricadePending({ x: tile.x, y: tile.y });
    setAbilityTargeting(null);
  };

  const performBarricadeDeploy = (direction) => {
    if (!barricadePending || !selectedUnit) return;
    const { x, y } = barricadePending;
    const barricadeAbility = getUnitAbility(selectedUnit, 'deploy_barricade');
    setBarricadePending(null);
    setResolving(true);
    showActionBubble(selectedUnit.id, getAbilityBubbleMessage('deploy_barricade'));
    // Apply the barricade to the grid + track on the unit (AP, cooldown, list).
    const { grid: newGrid, unit: deployedUnit } = deployBarricadeLogic(
      grid, selectedUnit, x, y, direction, barricadeAbility
    );
    setGrid(newGrid);
    const atkFinal = withBurning(deployedUnit, selectedUnit.x, selectedUnit.y);
    setUnits((prev) => prev.map((u) => (u.id === selectedUnit.id ? atkFinal : u)));
    flashAttackFeedback(x, y, 'BARRICADE', 'status');
    setResolving(false);
  };

  const cancelBarricadePlacement = () => {
    setBarricadePending(null);
  };

  // EXPLOSIVE MINE: placement + immediate detonation logic lives in
  // mineResolver.js (single mine + Minefield, occupied-tile detonation,
  // Friendly Mines immunity). AP cost is skill-driven (Agent Provocateur → 0).
  const performMineDeploy = (tile) => {
    if (!selectedUnit) return;
    const mineAbility = getUnitAbility(selectedUnit, 'shock_mine');
    setResolving(true);
    setAbilityTargeting(null);
    showActionBubble(selectedUnit.id, getAbilityBubbleMessage('shock_mine'));
    const { persistMines, detonations, atkFinal, fieldMode } = resolveMineDeploy({
      grid, units, caster: selectedUnit, target: tile, mineAbility,
    });
    setMines((prev) => [...prev, ...persistMines]);
    const burned = withBurning(atkFinal, selectedUnit.x, selectedUnit.y);
    setUnits((prev) => prev.map((u) => {
      if (u.id === selectedUnit.id) return burned;
      for (const { occupantId, result } of detonations) {
        if (u.id === occupantId) return result.unit;
      }
      return u;
    }));
    for (const { mine, occupantId, result } of detonations) {
      pushPopup(mine.x, mine.y, result.damage, result.killed, 'damage');
      flashAttackFeedback(mine.x, mine.y, result.killed ? 'ELIMINATED' : 'MINE!', 'status');
      setHitFlashId(occupantId);
      if (hitTimer.current) clearTimeout(hitTimer.current);
      hitTimer.current = setTimeout(() => setHitFlashId(null), HIT_FLASH_MS);
    }
    if (detonations.length === 0) {
      flashAttackFeedback(tile.x, tile.y, fieldMode ? 'MINEFIELD' : 'MINE', 'status');
    }
    setResolving(false);
  };

  const resolveAbility = (a, target) => {
    if (a.id !== 'breach' && a.id !== 'heal') showActionBubble(selectedUnit.id, getAbilityBubbleMessage(a.id));
    if (a.id === 'breach') {
      openAttackPreview(
        buildBreachAttackPreview({ grid, attacker: selectedUnit, target, ability: a }),
        () => performBreach(selectedUnit, target)
      );
    }
    else if (a.id === 'suppress') performSuppress(selectedUnit, target);
    else if (a.id === 'heal') performHeal(selectedUnit, target);
    else if (a.id === 'command') performCommand(selectedUnit, target);
    else if (a.id === 'field_medkit') performFieldMedkit(selectedUnit, target);
    else if (a.id === 'line_up') performLineUp(selectedUnit, target);
    else if (a.id === 'disruptor_hook') {
      const pull = computeComeHerePull(grid, units, selectedUnit, target);
      if (!pull.valid) {
        flashAttackFeedback(target.x, target.y, 'NO PULL PATH', 'status');
        return;
      }
      openAttackPreview(
        buildDisruptorHookPreview({ grid, attacker: selectedUnit, target, pull, mines: minesRef.current || mines }),
        () => performDisruptorHook(selectedUnit, target, pull)
      );
    }
  };

  // --- Phase 10: Objective actions (EXTRACT, RESCUE, SABOTAGE) ---

  // EXTRACT: 0 AP. Mark the unit as extracted. The objective check useEffect
  // detects when all living players are extracted and secures the objective.
  const { handleExtract, handleRescue, handleSabotage } = useObjectiveActions({
    inputLocked, selectedUnit,
    extractionZone, extractedIds, setExtractedIds,
    civilian, setCivilian, device, setDevice,
    withBurning, setUnits, flashAttackFeedback, pushPopup,
    showActionBubble,
  });

  // --- Mission commit (runs once when the mission enters a terminal state) ---

  const commitMissionResults = async () => {
    if (missionCommittedRef.current) return;
    missionCommittedRef.current = true;
    const rt = missionRuntimeRef.current;
    if (!rt || !missionConfig) return;
    const out = await commitMissionResultsLogic({
      soldiers: soldiersRef.current, units, missionRuntime: rt, missionConfig, missionId,
    });
    if (out) setMissionResults(out);
  };

  // Commit when the mission enters a terminal state (runs once via ref guard).
  // Rewards/XP never commit during initialization or from an invalid setup —
  // a setupError runtime stays in INITIALIZING and never reaches a terminal state.
  useEffect(() => {
    const rt = missionRuntimeRef.current;
    if (
      isTerminal &&
      !missionCommittedRef.current &&
      soldiers.length > 0 &&
      rt && rt.missionInitialized && !rt.setupError && !missionConfig?.isTutorial
    ) {
      commitMissionResults();
    }
  }, [isTerminal, soldiers.length, missionRuntime]);

  // Tutorial: when the final free-form fight ends (mission terminal), signal
  // victory so the engine advances to the TUTORIAL COMPLETE step.
  useEffect(() => {
    if (isTerminal && tutorial.active && tutorial.currentStep?.id === 'tut_final_free_form') tutorial.signalFinalVictory();
  }, [isTerminal, tutorial]);

  // Dev-facing lifecycle logging. Only fires in debug mode to avoid flooding
  // production. Logs meaningful mission state transitions for diagnosis.
  useEffect(() => {
    if (!debug || !missionRuntime) return;
    const tag = `[Mission ${missionRuntime.missionId}]`;
    console.log(`${tag} state=${missionRuntime.state} init=${missionRuntime.missionInitialized} play=${missionRuntime.hasGameplayStarted} round=${missionRuntime.round} P=${units.filter((u) => u.team === TEAMS.PLAYER && u.alive).length} E=${units.filter((u) => u.team === TEAMS.ENEMY && u.alive).length}${missionRuntime.setupError ? ` ERR=${missionRuntime.setupError}` : ''}`);
  }, [debug, missionRuntime, units]);

  const [isReplaying, setIsReplaying] = useState(false);

  // Return to base (squad & roster management)
  const handleReturnToBase = () => {
    navigate('/squad');
  };

  // Replay Same Mission Type: generates a NEW mission instance with the same
  // missionType, validates squad deployment health, and launches the battle.
  const handleReplaySameType = () => {
    if (isReplaying) return;
    setIsReplaying(true);

    // Boss encounters preserve existing boss replay flow
    if (missionConfig?.isBoss) {
      resetBattle();
      return;
    }

    const campaign = readActiveCampaign();
    // Resolve current campaign chapter context
    const currentChapterDef = getActiveChapterDef(campaign?.chapters);
    const chapterId = missionConfig?.chapterId || currentChapterDef?.chapterId || 'ch1';

    // Generate fresh mission instance with the same mission type
    const newMission = createReplayMissionInstance(missionConfig, chapterId);

    // Deployment validation: ensure no injured soldier is silently redeployed
    const freshSoldiers = campaign?.soldiers || [];
    const lastIds = getLastDeployedSoldierIds();
    const readySoldiers = freshSoldiers.filter((s) => s.alive && !s.injured && s.equipped_weapon);
    const readySet = new Set(readySoldiers.map((s) => s.soldier_id || s.id));
    const stillReadyIds = lastIds.filter((id) => readySet.has(id));
    const hadInjuryOrUnready = lastIds.some((id) => !readySet.has(id));

    // Generate fresh battlefield for the new mission instance
    generateMapConfig(newMission.id);

    // If any previously deployed soldier became injured/unready, or if no deployed soldiers are ready:
    // Route through Deploy screen for squad confirmation so injured soldiers are NEVER silently redeployed.
    if (hadInjuryOrUnready || stillReadyIds.length === 0) {
      setLastDeployedSoldierIds(stillReadyIds);
      navigate(`/deploy/${newMission.id}`);
    } else {
      // All soldiers remain ready: initialize fresh battle directly
      setLastDeployedSoldierIds(stillReadyIds);
      navigate(`/battle/${newMission.id}?s=${stillReadyIds.join(',')}`);
    }
  };

  // Detailed Targeting Info: opens a non-mutating preview panel before committing.
  // When the toggle is OFF, `commit` runs immediately (fast flow). FIRE runs commit;
  // CANCEL clears the panel without spending AP/ammo/cooldown/uses.
  const openAttackPreview = (preview, commit) => {
    if (!getDetailedTargetingInfo()) { commit(); return; }
    setAttackPreview({ preview, commit });
  };
  const handlePreviewFire = () => {
    const ap = attackPreview;
    if (!ap) return;
    setAttackPreview(null);
    ap.commit();
  };
  const handlePreviewCancel = () => setAttackPreview(null);

  // --- Post-objective choice ---

  // COMPLETE MISSION: end the battle, award the base reward. No elite spawns.
  const handleCompleteMission = () => {
    setShowPostChoice(false);
    setMissionRuntime((prev) => ({ ...prev, state: MISSION_STATES.COMPLETE }));
  };

  // CHALLENGE ELITE RESPONSE: spawn the elite squad immediately. They appear
  // on the board but don't act until the next Enemy Phase (AP is restored then).
  const handleChallengeElite = () => {
    setShowPostChoice(false);
    const cfg = getMissionMapConfig(missionId);
    if (!cfg) return;
    const eliteUnits = spawnEliteSquad(grid, units, ELITE_SQUAD, cfg.eliteSpawns, { civilian, device });
    if (eliteUnits.length > 0) {
      setUnits((prev) => [...prev, ...eliteUnits]);
    }
    setMissionRuntime((prev) => ({
      ...prev,
      state: MISSION_STATES.ELITE_RESPONSE_ACTIVE,
      eliteResponseAccepted: true,
      eliteResponseSpawned: true,
    }));
    setShowEliteIncoming(true);
    setTimeout(() => setShowEliteIncoming(false), 1500);
  };

  const handleAbilityActivate = (abilityId) => {
    if (phase !== 'player' || busy || inputLocked) return;
    if (!selectedUnit || selectedUnit.team !== TEAMS.PLAYER || !selectedUnit.alive) return;
    if (!canActivateAbility(selectedUnit, abilityId, phase)) return;
    // Toggle off if already active.
    if (abilityTargeting?.abilityId === abilityId) { setAbilityTargeting(null); return; }
    setAttackMode(false);
    // Instant utility abilities resolve immediately (no targeting needed).
    const instCtx = { caster: selectedUnit, withBurning, setUnits, setResolving, setAbilityTargeting, flashAttackFeedback };
    if (abilityId === 'sprint_harness') { showActionBubble(selectedUnit.id, getAbilityBubbleMessage('sprint_harness')); resolveSprintHarness(instCtx); return; }
    if (abilityId === 'emergency_shield') { showActionBubble(selectedUnit.id, getAbilityBubbleMessage('emergency_shield')); resolveEmergencyShield(instCtx); tutorial.onEvent(TUT_ACTION.ABILITY, { abilityId, unitId: selectedUnit.id }); return; }
    setAbilityTargeting({ abilityId });
    tutorial.onEvent(TUT_ACTION.ABILITY, { abilityId, unitId: selectedUnit.id });
  };

  const handleAttackToggle = () => {
    if (phase !== 'player' || busy || inputLocked) return;
    if (!selectedUnit || selectedUnit.team !== TEAMS.PLAYER) return;
    const weapon = getUnitWeapon(selectedUnit);
    if (!weapon) return;
    if (!attackMode && selectedUnit.ap < weapon.apCost) return;
    if (!attackMode && !hasAmmo(selectedUnit)) return;
    setAbilityTargeting(null);
    setAttackMode((m) => !m);
  };

  const handleOverwatch = () => {
    if (phase !== 'player' || busy || inputLocked) return;
    if (!selectedUnit || selectedUnit.team !== TEAMS.PLAYER || !selectedUnit.alive) return;
    if (!canEnterOverwatch(selectedUnit, phase)) return;
    setAttackMode(false);
    setAbilityTargeting(null);
    // Overwatch is an action: enter reaction state, then Burning hook. If the
    // burn kills the unit, its reaction state is cleared by death (alive=false).
    const entered = enterOverwatch(selectedUnit);
    const finalUnit = withBurning(entered, selectedUnit.x, selectedUnit.y);
    showActionBubble(selectedUnit.id, BUBBLE.OVERWATCH);
    setUnits((prev) => prev.map((u) => (u.id === selectedUnit.id ? finalUnit : u)));
    tutorial.onEvent(TUT_ACTION.OVERWATCH, { unitId: selectedUnit.id });
  };

  // OVERWATCH ALL: squad-wide command (see useOverwatchAll hook).
  const { overwatchAllFeedback, overwatchAllEligibleCount, handleOverwatchAll, reset: resetOverwatchAll } = useOverwatchAll({
    units, phase, inputLocked, busy, withBurning, setUnits, setAttackMode, setAbilityTargeting,
    showActionBubble,
  });

  const handleReload = () => {
    if (phase !== 'player' || busy || inputLocked) return;
    if (!selectedUnit || selectedUnit.team !== TEAMS.PLAYER || !selectedUnit.alive) return;
    const alFree = selectedUnit.autoLoader && !selectedUnit.autoLoaderUsed;
    if (!canReload(selectedUnit) || (!alFree && selectedUnit.ap < getReloadApCost(selectedUnit))) return;
    setAttackMode(false); setAbilityTargeting(null);
    const rap = alFree ? 0 : getReloadApCost(selectedUnit);
    const reloaded = { ...reloadUnit(selectedUnit), ap: Math.max(0, selectedUnit.ap - rap), reaction: null, ...(alFree && { autoLoaderUsed: true }) };
    showActionBubble(selectedUnit.id, BUBBLE.RELOADING);
    const finalUnit = withBurning(reloaded, selectedUnit.x, selectedUnit.y);
    setUnits((prev) => prev.map((u) => (u.id === selectedUnit.id ? finalUnit : u)));
    flashAttackFeedback(selectedUnit.x, selectedUnit.y, alFree ? 'RELOAD FREE' : 'RELOADED', 'info');
    tutorial.onEvent(TUT_ACTION.RELOAD, { unitId: selectedUnit.id });
  };

  const cancelMovePreview = () => {
    setMovePreview(null);
  };

  // Exit the Tactical Lens information mode. Selecting any movement/action
  // command exits the Lens cleanly before targeting begins — no AP is spent,
  // no action is performed from the Lens (the player taps again to act).
  const exitLens = () => {
    setLensActive(false);
    setLensInspected(null);
  };

  const handleToggleLens = () => {
    if (phase !== 'player' || busy || inputLocked) return;
    setLensActive((v) => !v);
    if (!lensActive) tutorial.onEvent(TUT_ACTION.TACTICAL_LENS_ON);
    setLensInspected(null);
  };

  // Tapping the mission/objective tile in the header focuses the current
  // objective by opening the Tactical Lens (which emphasizes the objective
  // marker, extraction zone, civilian, or device). Informational only.
  const handleObjectiveTap = () => {
    if (phase !== 'player' || busy || inputLocked) return;
    if (!lensActive) {
      setLensActive(true);
      setLensInspected(null);
    }
  };

  const handleCombatSpeedChange = (speed) => {
    setCombatSpeed(speed);
    setCombatSpeedState(speed);
  };

  // Relocate controls: the Marksman can reposition for free after a kill.
  const startRelocate = () => {
    if (!relocateContext) return;
    setAttackMode(false);
    setAbilityTargeting(null);
    setMovePreview(null);
    setRelocateMode(true);
  };

  const skipRelocate = () => {
    // Clear the opportunity without moving. Consumed whether used or skipped.
    if (selectedUnit) {
      if (relocateContext === 'hit_and_run') {
        const cleared = setSkillState(selectedUnit, { hitAndRunAvailable: false, hitAndRunUsed: true });
        setUnits((prev) => prev.map((u) => (u.id === selectedUnit.id ? cleared : u)));
      } else {
        const relocateAbility = getUnitAbility(selectedUnit, 'relocate');
        const cleared = clearRelocate({
          ...selectedUnit,
          cooldowns: { ...selectedUnit.cooldowns, relocate: relocateAbility?.cooldown || 3 },
        });
        setUnits((prev) => prev.map((u) => (u.id === selectedUnit.id ? cleared : u)));
      }
    }
    setRelocateMode(false);
  };

  const cancelRelocate = () => {
    setRelocateMode(false);
  };

  const confirmMove = async () => {
    if (!movePreview || !selectedUnit) return;
    const entry = reachable.get(`${movePreview.toX},${movePreview.toY}`);
    if (!entry) { setMovePreview(null); return; }
    tutorial.onEvent(TUT_ACTION.CONFIRM_MOVE, { unitId: selectedUnit.id, x: movePreview.toX, y: movePreview.toY });
    setMovePreview(null);
    await performMove(selectedUnit, entry);
  };

  const handleUnitTap = (unit) => {
    // Commander targeting owns input — checked before inputLocked.
    if (commanderTargeting) {
      if (phase !== 'player' || busy || isTerminal) return;
      handleCommanderUnitSelect(unit);
      return;
    }
    if (phase !== 'player' || busy || inputLocked) return;
    setMovePreview(null); // any unit tap cancels movement preview

    // Tactical Lens: tapping a unit inspects it (no AP, no action).
    if (lensActive) {
      if (unit.alive) setLensInspected({ kind: 'unit', unitId: unit.id });
      return;
    }

    // Relocate mode: tapping a friendly unit reselects; enemy/invalid cancels.
    if (relocateMode) {
      if (unit.team === TEAMS.PLAYER && unit.alive) { setSelectedUnitId(unit.id); return; }
      flashInvalid({ x: unit.x, y: unit.y });
      return;
    }

    if (abilityTargeting) {
      const a = activeAbility;
      // Grenade targets the tile under any tapped unit (self → cancel).
      if (a.targetType === TARGET_TYPES.TILE_AOE) {
        if (unit.id === selectedUnitId) { setAbilityTargeting(null); return; }
        tryGrenadeImpact(unit.x, unit.y);
        return;
      }
      // Dash: units aren't destinations. Self → cancel; friendly → switch.
      if (a.targetType === TARGET_TYPES.DASH) {
        if (unit.id === selectedUnitId) { setAbilityTargeting(null); return; }
        if (unit.team === TEAMS.PLAYER && unit.alive) { setSelectedUnitId(unit.id); setAbilityTargeting(null); return; }
        flashInvalid({ x: unit.x, y: unit.y });
        return;
      }
      // Barricade: can be placed on the Engineer's own tile or an ally's tile.
      if (a.targetType === TARGET_TYPES.BARRICADE) {
        if (barricadeTiles && barricadeTiles.has(`${unit.x},${unit.y}`)) {
          startBarricadePlacement({ x: unit.x, y: unit.y });
        } else if (unit.id === selectedUnitId) {
          setAbilityTargeting(null);
        } else if (unit.team === TEAMS.PLAYER && unit.alive) {
          setSelectedUnitId(unit.id); setAbilityTargeting(null);
        } else {
          flashInvalid({ x: unit.x, y: unit.y });
        }
        return;
      }
      // Mine: place on the tapped unit's tile (detonates immediately if enemy-
      // occupied, or friendly fire before Friendly Mines). Self → cancel.
      if (a.targetType === TARGET_TYPES.TILE) {
        if (unit.id === selectedUnitId) { setAbilityTargeting(null); return; }
        if (mineTiles && mineTiles.has(`${unit.x},${unit.y}`)) {
          performMineDeploy({ x: unit.x, y: unit.y });
        } else if (unit.team === TEAMS.PLAYER && unit.alive) {
          setSelectedUnitId(unit.id); setAbilityTargeting(null);
        } else {
          flashInvalid({ x: unit.x, y: unit.y });
        }
        return;
      }
      if (a.targetType === TARGET_TYPES.WALL || a.targetType === TARGET_TYPES.GROUND) {
        if (unit.id === selectedUnitId) { setAbilityTargeting(null); return; }
        if (unit.team === TEAMS.PLAYER && unit.alive) { setSelectedUnitId(unit.id); setAbilityTargeting(null); return; }
        flashInvalid({ x: unit.x, y: unit.y });
        return;
      }
      // Unit-targeting abilities.
      const selfCancel = unit.id === selectedUnitId && !(a.targetType === TARGET_TYPES.ALLY && a.canTargetSelf);
      if (selfCancel) { setAbilityTargeting(null); return; }

      if (a.targetType === TARGET_TYPES.ENEMY) {
        if (unit.team === TEAMS.PLAYER && unit.alive) { setSelectedUnitId(unit.id); setAbilityTargeting(null); return; }
        if (unit.team === TEAMS.ENEMY && unit.alive) {
          if (abilityEnemyTargets.some((t) => t.id === unit.id)) resolveAbility(a, unit);
          else flashAttackFeedback(unit.x, unit.y, 'INVALID');
        }
        return;
      }
      if (a.targetType === TARGET_TYPES.ALLY) {
        if (unit.team === TEAMS.ENEMY) { flashAttackFeedback(unit.x, unit.y, 'INVALID'); return; }
        if (unit.team === TEAMS.PLAYER && unit.alive) {
          if (abilityAllyTargets.some((t) => t.id === unit.id)) resolveAbility(a, unit);
          else if (unit.id === selectedUnitId) setAbilityTargeting(null);
          else { setSelectedUnitId(unit.id); setAbilityTargeting(null); }
        }
        return;
      }
      return;
    }

    if (attackMode) {
      if (unit.id === selectedUnitId) { setAttackMode(false); return; }
      if (unit.team === TEAMS.PLAYER && unit.alive) { setSelectedUnitId(unit.id); setAttackMode(false); return; }
      if (unit.team === TEAMS.ENEMY && unit.alive && selectedUnit) {
        tutorial.onEvent(TUT_ACTION.SELECT_ENEMY, { unitId: unit.id });
        const v = validateAttack({ grid, phase, busy, attacker: selectedUnit, target: unit });
        if (v.valid) {
          const ignoreCover = hasLineUpOn(selectedUnit, unit);
          openAttackPreview(
            buildBasicAttackPreview({ grid, attacker: selectedUnit, target: unit, ignoreCover }),
            () => performAttack(selectedUnit, unit)
          );
        } else flashAttackFeedback(unit.x, unit.y, attackReasonText(v.reason));
      }
      return;
    }

    // No targeting mode active: tapping a friendly unit selects it (and clears
    // any quick enemy inspection); tapping an enemy inspects it without
    // spending AP or attacking. The selected soldier stays selected.
    if (unit.team === TEAMS.PLAYER && unit.alive) {
      setSelectedUnitId(unit.id);
      setInspectedEnemyId(null);
      tutorial.onEvent(TUT_ACTION.SELECT_UNIT, { unitId: unit.id, team: 'player' });
    } else if (unit.team === TEAMS.ENEMY && unit.alive) {
      setInspectedEnemyId(unit.id);
    }
  };

  const handleTileTap = (tile) => {
    if (siegeTestMode) { if (busy) return; handleSiegeTestTileTap(tile); return; }
    // Commander targeting owns input — checked before inputLocked (which
    // includes commanderTargeting) so taps still route to Commander handlers.
    if (commanderTargeting) {
      if (phase !== 'player' || busy || isTerminal) return;
      const occupant = getUnitAt(units, tile.x, tile.y);
      if (occupant) { handleCommanderUnitSelect(occupant); return; }
      handleCommanderTileSelect(tile);
      return;
    }
    if (phase !== 'player' || busy || inputLocked) return;

    const occupant = getUnitAt(units, tile.x, tile.y);
    if (occupant) { handleUnitTap(occupant); return; }

    // Tactical Lens: tapping an empty tile inspects its terrain/cover.
    if (lensActive) {
      setLensInspected({ kind: 'terrain', x: tile.x, y: tile.y });
      return;
    }

    // Relocate mode: tap a reachable tile to reposition (0 AP).
    if (relocateMode) {
      const dest = relocateReachable?.get(`${tile.x},${tile.y}`);
      if (dest) performRelocateMove(selectedUnit, tile);
      else flashInvalid(tile);
      return;
    }

    if (abilityTargeting) {
      const a = activeAbility;
      if (a.targetType === TARGET_TYPES.DASH) {
        const entry = dashReachable?.get(`${tile.x},${tile.y}`);
        if (entry) performDash(selectedUnit, entry);
        else flashInvalid(tile);
      } else if (a.targetType === TARGET_TYPES.TILE_AOE) {
        tryGrenadeImpact(tile.x, tile.y);
      } else if (a.targetType === TARGET_TYPES.BARRICADE) {
        if (barricadeTiles && barricadeTiles.has(`${tile.x},${tile.y}`)) startBarricadePlacement(tile);
        else flashInvalid(tile);
      } else if (a.targetType === TARGET_TYPES.TILE) {
        if (mineTiles && mineTiles.has(`${tile.x},${tile.y}`)) performMineDeploy(tile);
        else flashInvalid(tile);
      } else if (a.targetType === TARGET_TYPES.WALL) {
        if (wallChargeTiles?.has(`${tile.x},${tile.y}`)) tryWallCharge(tile.x, tile.y); else flashInvalid(tile);
      } else if (a.targetType === TARGET_TYPES.GROUND) {
        if (instaWallTiles?.has(`${tile.x},${tile.y}`)) tryInstaWall(tile.x, tile.y); else flashInvalid(tile);
      } else {
        // unit-targeting ability: empty tap cancels
        setAbilityTargeting(null);
      }
      return;
    }

    if (attackMode) { setAttackMode(false); return; }

    // Tapping an empty tile with no targeting mode clears any quick enemy
    // inspection before resolving as a movement preview.
    setInspectedEnemyId(null);

    if (!selectedUnit || selectedUnit.ap <= 0) return;
    const entry = reachable.get(`${tile.x},${tile.y}`);
    if (entry) {
      // Second tap on the already-previewed destination = confirm the move.
      if (movePreview && movePreview.toX === tile.x && movePreview.toY === tile.y) {
        confirmMove();
        return;
      }
      // First tap = preview only. No AP spent, no occupancy change, no
      // Overwatch/Burning triggers — purely informational.
      setMovePreview({
        unitId: selectedUnit.id,
        fromX: selectedUnit.x,
        fromY: selectedUnit.y,
        toX: tile.x,
        toY: tile.y,
        path: entry.path,
        apCost: 1,
      });
      tutorial.onEvent(TUT_ACTION.SELECT_DESTINATION, { x: tile.x, y: tile.y });
      return;
    }
    flashInvalid(tile);
  };

  const resetBattle = () => {
    if (blastTimer.current) clearTimeout(blastTimer.current);
    if (reactionTimer.current) clearTimeout(reactionTimer.current);
    if (coverDestroyedTimer.current) clearTimeout(coverDestroyedTimer.current);
    setCoverDestroyed(null);
    resetOverwatchAll();
    clearActionBubbles();
    missionCommittedRef.current = false;
    setMissionResults(null);
    // Reset boss state for a fresh encounter attempt.
    setBossState(createInitialBossState());
    resetBossRefs();
    setBossMessage(null);
    resetHarvester();
    setShowArmorBreach(false);
    setShowFabricationBanner(false);
    prevPhase2Triggered.current = false;
    coreCollapsePlayedRef.current = false;
    setShowCoreCollapse(false);
    // Restart recreates the SAME battlefield: reuse the cached generated config
    // (same map + seed) so terrain, cover, and positions are identical.
    const cfg = ensureMapConfig(missionId);
    setMapConfig(cfg);
    setGrid(cfg ? cfg.grid : buildGrid());
    // Re-enter INITIALIZING first so the evaluation effect cannot fire against
    // partially cleared state during the reset transition.
    setMissionRuntime(createInitialMissionRuntime(missionId));
    const newUnits = createMissionUnitsFromSoldiers(missionId, soldiersRef.current, selectedSoldierIds);
    const objs = createMissionObjects(missionId);
    setUnits(newUnits);
    setCivilian(objs.civilian);
    setDevice(objs.device);
    setExtractedIds(new Set());
    // Validate and activate — same lifecycle as initial mission entry.
    const rt = createInitialMissionRuntime(missionId);
    const check = validateMissionSetup(missionConfig, newUnits, objs.civilian, objs.device, objs.extractionZone, cfg?.grid, cfg);
    if (!check.valid) {
      console.error(`[Mission] Setup validation failed on restart for ${missionId}: ${check.reason}`);
      setMissionRuntime({ ...rt, setupError: check.reason });
    } else {
      setMissionRuntime(activateMissionRuntime(rt));
    }
    setSelectedUnitId(null);
    setAttackMode(false);
    setAbilityTargeting(null);
    setBlastPreview(null);
    setMovePreview(null);
    setMines([]);
    setPlasmaStrikes([]);
    setBeamSweeps([]);
    setOverloadHazards([]);
    setPendingMeltdown(null);
    setPendingCoreDischarge(null);
    setBarricadePending(null);
    setRelocateMode(false);
    setActiveShot(null);
    setTurn(1);
    setPhase('player');
    setShowPostChoice(false);
    setShowEliteIncoming(false);
    // Commander targeting + transaction state cleanup on restart.
    resetCommanderState();
    // Enemy Commander battle state: full reset to mission-start (fresh budget).
    resetEnemyCommander();
    setLastAttack(null);
    setLastEnemyDecision(null);
    setLastReaction(null);
    setReactionFlashId(null);
    setDamagePopups([]);
    setHitFlashId(null);
    setDebugShowSiege(false);
    setDebugShowInstaWall(false);
    resetSiegeTest();
  };

  // Debug: regenerate procedural variation (new seed) and restart the battle.
  const handleRegenerateMap = () => {
    regenerateMapConfig(missionId);
    resetBattle();
  };

  // Debug: force a specific map template and restart the battle.
  const handleForceMap = (mapId) => {
    regenerateMapConfig(missionId, { forceMapId: mapId });
    resetBattle();
  };

  const compatibleMaps = useMemo(() => getCompatibleMaps(missionId), [missionId]);

  // Fast, readable enemy phase. Extracted into a factory module
  // (enemyPhaseRunner.js) to keep this file under the size limit. The factory
  // receives all state setters, refs, and helpers as a context object.
  const runEnemyPhase = useMemo(() => createEnemyPhaseRunner({
    setUnits, setGrid, setPhase, setTurn, setMissionRuntime,
    setBeamSweeps, setOverloadHazards, setPlasmaStrikes, setMines,
    setBossState, setHarvesterState, setSelectedUnitId, setAttackMode, setAbilityTargeting,
    setActiveShot, setHitFlashId, setReactionFlashId, setLastReaction, setLastEnemyDecision,
    setPendingTremor, setPendingBeam, setPendingCharge,
    setPendingMeltdown, setPendingCoreDischarge,
    applyEnemyBurning,
    missionRuntimeRef, bossStateRef,
    beamSweepsRef, overloadHazardsRef, plasmaStrikesRef,
    pendingTremorRef, pendingBeamRef, pendingChargeRef, harvesterStateRef,
    pendingMeltdownRef, pendingCoreDischargeRef,
    civilianRef, deviceRef, extractedIdsRef, minesRef,
    tokenRefs, hitTimer, reactionTimer, shotId,
    pushPopup, flashAttackFeedback, flashStatusLabel, showActionBubble,
    sleep, showCoverDestroyed,
    units, grid, missionId, missionConfig, isBossMission, isHarvesterMission, turn, debug,
    HIT_FLASH_MS, REACTION_MS, REACTION_FLASH_MS, ENEMY_ATTACK_MS, ENEMY_STEP_MS, ENEMY_MOVE_PER_SEG, ENEMY_ABILITY_LABEL_MS,
    processEnemyCommanderAction, GRID_WIDTH, GRID_HEIGHT,
  }), [
    units, grid, missionId, missionConfig, isBossMission, isHarvesterMission, turn, debug,
    missionRuntime, bossState, beamSweeps, overloadHazards, plasmaStrikes,
    pendingTremor, pendingBeam, pendingCharge, pendingMeltdown, pendingCoreDischarge, harvesterState,
  ]);

  const handleEndTurn = () => {
    if (phase !== 'player' || inputLocked) return;
    tutorial.onEvent(TUT_ACTION.END_PHASE);
    runEnemyPhase().catch((err) => {
      console.error(`[Enemy Phase] Error during mission ${missionId} turn ${turn}:`, err);
      setMoving(false);
      setResolving(false);
      setActiveShot(null);
      // Safety net: restore player AP so the player is never soft-locked with
      // 0 AP after an enemy phase error. The phase resets to 'player' regardless.
      setUnits((prev) => prev.map((u) =>
        u.team === TEAMS.PLAYER && u.alive && !u.downed
          ? { ...u, ap: u.maxAp }
          : u
      ));
      setPhase('player');
    });
  };

  // Contextual objective action buttons for the selected unit. Only shown when
  // the unit is in a position to perform a mission-specific action.
  const objectiveActions = useMemo(() => {
    if (!selectedUnit || phase !== 'player' || inputLocked || !missionConfig) return [];
    const actions = [];
    if (missionConfig.type === MISSION_TYPES.EXTRACTION &&
        isInExtractionZone(extractionZone, selectedUnit.x, selectedUnit.y) &&
        !extractedIds.has(selectedUnit.id)) {
      actions.push({ id: 'extract', label: 'Extract', icon: Footprints, apCost: 0, onClick: handleExtract });
    }
    if (missionConfig.type === MISSION_TYPES.RESCUE && civilian && !civilian.rescued && !civilian.safe &&
        isAdjacent(selectedUnit, civilian) && selectedUnit.ap >= 1) {
      actions.push({ id: 'rescue', label: 'Rescue', icon: Heart, apCost: 1, onClick: handleRescue });
    }
    if (missionConfig.type === MISSION_TYPES.SABOTAGE && device && !device.sabotaged &&
        isAdjacent(selectedUnit, device) && selectedUnit.ap >= 1) {
      actions.push({ id: 'sabotage', label: 'Sabotage', icon: Bomb, apCost: 1, onClick: handleSabotage });
    }
    return actions;
  }, [selectedUnit, phase, inputLocked, missionConfig, extractionZone, civilian, device, extractedIds]);

  if (!missionConfig || !missionRuntime) {
    return (
      <div className="flex items-center justify-center h-[100dvh] bg-slate-950 text-slate-400">
        <button onClick={() => navigate('/')} className="px-4 py-2 rounded bg-slate-800 text-white text-sm">
          Invalid mission — return to selection
        </button>
      </div>
    );
  }

  // Configuration error: setup validation failed. This is a development error,
  // never a player mission failure — no rewards commit and the player returns to
  // mission selection.
  if (hasSetupError) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 h-[100dvh] bg-slate-950 text-slate-300 px-6 text-center">
        <div className="text-rose-400 font-bold text-sm tracking-wide uppercase">Mission Setup Error</div>
        <div className="text-slate-400 text-xs">{missionRuntime.setupError}</div>
        <button onClick={() => navigate('/missions')} className="px-4 py-2 rounded bg-slate-800 text-white text-sm">
          Return to Mission Select
        </button>
      </div>
    );
  }

  return (
    <BattleErrorBoundary
      missionId={missionId}
      turn={turn}
      onRestart={resetBattle}
      onExit={() => navigate('/missions')}
    >
    <div className="flex flex-col h-[100dvh] w-full bg-slate-950 overflow-hidden">
      <TopHud
        turn={turn}
        phase={phase}
        missionType={missionConfig.type}
        enemyCount={units.filter((u) => u.team === TEAMS.ENEMY && u.alive).length}
        reinforcementCountdown={missionRuntime?.reinforcementCountdown ?? 0}
        standardReinforcementSpawned={missionRuntime?.standardReinforcementSpawned ?? false}
        reinforcementCanceled={missionRuntime?.reinforcementCanceled ?? false}
        objectiveSecured={objectiveSecuredState}
        allSpent={allSpent}
        debug={debug}
        lensActive={lensActive}
        isBossMission={isBossMission}
        relayStatus={relayStatus}
        bossShield={bossUnit?.coreShield ?? null}
        bossShieldMax={bossUnit?.coreShieldMax ?? null}
        bossPhase={isBossMission ? bossState.bossPhase : null}
        objectiveText={missionConfig.objectiveText}
        onToggleLens={handleToggleLens}
        onOpenOptions={() => setOptionsOpen(true)}
        onEndTurn={handleEndTurn}
        onToggleDebug={() => setDebug((d) => !d)}
        onObjectiveTap={handleObjectiveTap}
        onOverwatchAll={() => { handleOverwatchAll(); tutorial.onEvent(TUT_ACTION.OVERWATCH_ALL); }}
        overwatchAllEligibleCount={overwatchAllEligibleCount}
        overwatchAllDisabled={phase !== 'player' || inputLocked}
        commanderUnlocked={commanderSaveUnlocked && commanderUnlockedSkills.length > 0}
        commanderSkillCount={commanderUnlockedSkills.length}
        commanderTargetingActive={!!commanderTargeting}
        onOpenCommander={handleOpenCommander}
        enemyCommanderActive={enemyCommanderActive}
        enemyCommanderDisplay={enemyCommanderDisplay}
        enemyBudgetCurrent={enemyBudgetCurrent}
        enemyBudgetMax={enemyBudgetMax}
        onOpenEnemyCommander={() => setEnemyCommanderPanelOpen(true)}
      />

      <div className="relative flex-1 min-h-0 px-2 py-2">
        {(loadingRoster || isInitializing) && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/80">
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-4 border-slate-700 border-t-amber-400 rounded-full animate-spin" />
              <div className="text-slate-400 text-xs tracking-wide uppercase">Deploying Squad</div>
            </div>
          </div>
        )}
        <Battlefield
          grid={grid}
          tutorial={tutorial}
          units={units}
          selectedUnitId={selectedUnitId}
          tileHighlights={tileHighlights}
          invalidTile={invalidTile}
          attackFeedback={attackFeedback}
          damagePopups={damagePopups}
          hitFlashId={hitFlashId}
          reactionFlashId={reactionFlashId}
          unitBadges={unitBadges}
          extractionZone={extractionZone}
          civilian={civilian}
          device={device}
          extractedIds={extractedIds}
          movePreview={movePreview}
          previewData={previewData}
          mines={mines}
          plasmaStrikes={plasmaStrikes}
          barricadePending={barricadePending}
          activeShot={activeShot}
          lensActive={lensActive}
          lensShowCover={lensShowCover}
          lensShowThreat={lensShowThreat}
          lensThreatTiles={lensThreatTiles}
          lensInspectedRangeTiles={lensInspectedRangeTiles}
          lensLinesOfFire={lensLinesOfFire}
          lensInspectedId={lensInspected?.kind === 'unit' ? lensInspected.unitId : null}
          lensInspection={lensInspection}
          missionType={missionConfig.type}
          reinforcementSpawns={mapConfig?.reinforcementSpawns}
          reinforcementCountdown={missionRuntime?.reinforcementCountdown ?? 0}
          reinforcementCanceled={missionRuntime?.reinforcementCanceled ?? false}
          standardReinforcementSpawned={missionRuntime?.standardReinforcementSpawned ?? false}
          eliteActive={missionRuntime?.state === MISSION_STATES.ELITE_RESPONSE_ACTIVE}
          isBossMission={isBossMission}
          bossUnits={bossUnitsForRender}
          beamSweeps={beamSweeps}
          overloadHazards={overloadHazards}
          pendingTremor={isHarvesterMission ? pendingTremor : null}
          pendingBeam={isHarvesterMission ? pendingBeam : null}
          pendingCharge={isHarvesterMission ? pendingCharge : null}
          pendingMeltdown={isHarvesterMission ? pendingMeltdown : null}
          pendingCoreDischarge={isHarvesterMission ? pendingCoreDischarge : null}
          bossPhase={isBossMission ? bossState.bossPhase : null}
          onClearInspection={() => setLensInspected(null)}
          onBarricadeOrientation={performBarricadeDeploy}
          onCancelBarricade={cancelBarricadePlacement}
          onTileTap={handleTileTap}
          onUnitTap={handleUnitTap}
          tokenRefs={tokenRefs}
          actionBubbles={actionBubbles}
          siegeDestructionFx={siegeDestructionFx}
        />

        {/* Quick enemy inspection tile (top-left, no Lens required) */}
        <EnemyInfoTile
          enemy={inspectedEnemy}
          selectedUnit={selectedUnit}
          grid={grid}
          onClose={() => setInspectedEnemyId(null)}
          units={units}
          bossPhase={isBossMission ? bossState.bossPhase : null}
        />

        <TutorialBattleOverlays tutorial={tutorial} debug={debug} />
        <TutorialZoneDebug debug={debug} tutorial={tutorial} tutorialMission={tutorialMission} />

        <BattleDebugPanels
          debug={debug}
          selectedUnit={selectedUnit}
          reachable={reachable}
          lastAttack={lastAttack}
          attackMode={attackMode}
          validTargets={validTargets}
          grid={grid}
          setGrid={setGrid}
          lastEnemyDecision={lastEnemyDecision}
          lastReaction={lastReaction}
          missionRuntime={missionRuntime}
          setMissionRuntime={setMissionRuntime}
          missionConfig={missionConfig}
          missionId={missionId}
          units={units}
          setUnits={setUnits}
          device={device}
          setDevice={setDevice}
          civilian={civilian}
          setCivilian={setCivilian}
          extractionZone={extractionZone}
          extractedIds={extractedIds}
          setExtractedIds={setExtractedIds}
          phase={phase}
          setPhase={setPhase}
          turn={turn}
          setTurn={setTurn}
          mapConfig={mapConfig}
          setShowPostChoice={setShowPostChoice}
          compatibleMaps={compatibleMaps}
          onRegenerateMap={handleRegenerateMap}
          onForceMap={handleForceMap}
          onGrantWallCharge={debugGrantWallCharge}
          onGrantInstaWall={debugGrantInstaWall}
          onRestoreUses={debugRestoreUses}
          showSiegeTiles={debugShowSiege}
          onToggleShowSiege={() => setDebugShowSiege((v) => !v)}
          showInstaWallTiles={debugShowInstaWall}
          onToggleShowInstaWall={() => setDebugShowInstaWall((v) => !v)}
          isHarvesterMission={isHarvesterMission}
          harvesterUnit={harvesterUnit}
          harvesterState={harvesterState}
          onSetBossHp={debugSetHp}
          onSetBossArmor={debugSetArmor}
          onForceTremor={debugForceTremor}
          onForceBeam={debugForceBeam}
          onForcePhase2={debugForcePhase2}
          onForcePhase3={debugForcePhase3}
        />
      </div>

      <BottomHud
        selectedUnit={selectedUnit}
        phase={phase}
        attackMode={attackMode}
        onAttackToggle={handleAttackToggle}
        validTargetCount={validTargets.length}
        activeAbility={activeAbility}
        onAbilityActivate={handleAbilityActivate}
        abilityTargetCount={abilityTargetCount}
        onOverwatch={handleOverwatch}
        onReload={handleReload}
        objectiveActions={objectiveActions}
        movePreview={movePreview}
        onConfirmMove={confirmMove}
        onCancelMovePreview={cancelMovePreview}
        relocateAvailable={!!relocateContext}
        relocateMode={relocateMode}
        onStartRelocate={startRelocate}
        onSkipRelocate={skipRelocate}
        onCancelRelocate={cancelRelocate}
      />

      {showPostChoice && missionConfig && !missionConfig.isTutorial && (
        <PostObjectiveChoice
          mission={missionConfig}
          onComplete={handleCompleteMission}
          onChallenge={handleChallengeElite}
        />
      )}

      {showEliteIncoming && (
        <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
          <div className="text-amber-400 font-black text-lg tracking-[0.2em] uppercase bg-slate-900/90 border border-amber-500/50 px-6 py-3 rounded-lg shadow-2xl animate-pulse">
            Elite Response Incoming
          </div>
        </div>
      )}

      <BossMessageBanner message={bossMessage} />

      {isHarvesterMission && harvesterUnit && (
        <HarvesterBossHud
          harvesterUnit={harvesterUnit}
          harvesterState={harvesterState}
        />
      )}

      {isHarvesterMission && (
        <>
          <ArmorBreachBanner visible={showArmorBreach} />
          <FabricationSequenceBanner visible={showFabricationBanner} />
          <CoreFailureBanner visible={showCoreFailure} />
        </>
      )}

      <HarvesterDebugPanel
        debug={debug}
        isHarvesterMission={isHarvesterMission}
        harvesterUnit={harvesterUnit}
        harvesterState={harvesterState}
        pendingTremor={pendingTremor}
        pendingBeam={pendingBeam}
        pendingCharge={pendingCharge}
        onSetHp={debugSetHp}
        onSetArmor={debugSetArmor}
        onResetCooldowns={debugResetCooldowns}
        onForceTremor={debugForceTremor}
        onForceBeam={debugForceBeam}
        onResolveHazard={debugResolveHazard}
        onForcePhase2={debugForcePhase2}
        onForceFabrication={debugForceFabrication}
        onResetPhase1={debugResetPhase1}
        onForceCharge={debugForceCharge}
        onResolveCharge={debugResolveCharge}
        onForcePhase3={debugForcePhase3}
        onResetPhase3={debugResetPhase3}
        onForceMeltdown={debugForceMeltdown}
        onResolveMeltdown={debugResolveMeltdown}
        onForceCoreDischarge={debugForceCoreDischarge}
        onResolveCoreDischarge={debugResolveCoreDischarge}
        pendingMeltdown={pendingMeltdown}
        pendingCoreDischarge={pendingCoreDischarge}
        units={units}
        grid={grid}
        onForceDefeat={() => debugSetHp(0)}
        onSimulateFirstClear={async () => { await debugSetBossDefeatedFlag('ch2', false); debugSetHp(0); }}
        onSimulateReplay={async () => { await debugSetBossDefeatedFlag('ch2', true); debugSetHp(0); }}
        onTestDuplicateCommit={commitMissionResults}
        nanoCubeInfo={missionResults ? { earned: missionResults.nanoCubesEarned, before: missionResults.nanoCubeTotalBefore, after: missionResults.nanoCubeTotalAfter, isFirstClear: missionResults.isFirstClear } : null}
        commitState={missionCommittedRef.current}
      />

      {!loadingRoster && !isInitializing && showMapIntro && mapConfig && (
        <MapIntroBanner mapName={mapConfig.mapName} missionType={missionConfig.type} />
      )}

      {isTerminal && missionConfig?.isTutorial && missionRuntime?.state === MISSION_STATES.PRIMARY_FAILED && (<TutorialFailureScreen onRetry={() => { tutorial.debugRestart(); tutorialMission.resetTutorialMission(); resetBattle(); }} onReturn={() => navigate('/missions')} />)}
      {isTerminal && !showCoreCollapse && missionConfig && !missionConfig.isTutorial && missionRuntime && (
        <MissionResult
          mission={missionConfig}
          runtime={missionRuntime}
          soldierResults={missionResults?.results}
          powerCoresEarned={missionResults?.powerCoresEarned || 0}
          alienMaterialsEarned={missionResults?.alienMaterialsEarned || 0}
          baseAlienMaterials={missionResults?.baseAlienMaterials || 0}
          eliteAlienMaterials={missionResults?.eliteAlienMaterials || 0}
          enemiesDefeated={missionResults?.enemiesDefeated || 0}
          eliteEnemiesDefeated={missionResults?.eliteEnemiesDefeated || 0}
          nanoCubesEarned={missionResults?.nanoCubesEarned || 0}
          nanoCubeTotalBefore={missionResults?.nanoCubeTotalBefore || 0}
          nanoCubeTotalAfter={missionResults?.nanoCubeTotalAfter || 0}
          isFirstClear={missionResults?.isFirstClear || false}
          onRestart={resetBattle}
          onReplaySameType={handleReplaySameType}
          onReturnToBase={handleReturnToBase}
        />
      )}

      {showCoreCollapse && (
        <CoreCollapseOverlay onComplete={() => setShowCoreCollapse(false)} />
      )}

      {optionsOpen && (
        <OptionsOverlay
          mode="combat"
          combatSpeed={combatSpeed}
          onCombatSpeedChange={handleCombatSpeedChange}
          canRestart={!busy && !hasSetupError}
          onRestart={resetBattle}
          canRetreat={!busy && !isTerminal && !hasSetupError}
          onRetreat={() => { clearEnemyCommanderOnExit(); navigate('/missions'); }}
          onClose={() => setOptionsOpen(false)}
          onReturnToTitle={() => navigate('/')}
          onSaveGame={() => navigate('/save-game')}
          onLoadGame={() => navigate('/load-game')}
          onQuickLoad={() => { loadCampaign(getContinueSlot()); navigate('/squad'); }}
          canQuickLoad={getContinueSlot() != null}
        />
      )}

      <CoverDestroyedBanner count={coverDestroyed?.count} id={coverDestroyed?.id} />

      <OverwatchAllFeedback feedback={overwatchAllFeedback} />

      <CommanderOverlays
        commanderPanelOpen={commanderPanelOpen}
        setCommanderPanelOpen={setCommanderPanelOpen}
        commanderUnlockedSkills={commanderUnlockedSkills}
        commanderResources={commanderResources}
        handleCommanderSkillSelect={handleCommanderSkillSelect}
        canUseCommanderSkill={canUseCommanderSkill}
        commanderTargeting={commanderTargeting}
        handleCommanderCancelTargeting={handleCommanderCancelTargeting}
        handleCommanderConfirm={handleCommanderConfirm}
        handleCommanderCancelPreview={handleCommanderCancelPreview}
        commanderFeedback={commanderFeedback}
        debug={debug}
        selectedUnitId={selectedUnitId}
        units={units}
        grid={grid}
        commanderTxHistory={commanderTxHistory}
        committedTxCount={committedTxCount}
        handleInjectDevSkills={handleInjectDevSkills}
        handleClearDevSkills={handleClearDevSkills}
        handleToggleCommanderImmune={handleToggleCommanderImmune}
        handleSetCommanderResource={handleSetCommanderResource}
        handleRunDevSkill={handleRunDevSkill}
        handleSimulateTxFail={handleSimulateTxFail}
        handleResetTxState={handleResetTxState}
        handleUnlockTacticalAdvance={handleUnlockTacticalAdvance}
        handleRemoveTacticalAdvance={handleRemoveTacticalAdvance}
        commanderLastUnitEffect={commanderLastUnitEffect}
        enemyCommanderPanelOpen={enemyCommanderPanelOpen}
        setEnemyCommanderPanelOpen={setEnemyCommanderPanelOpen}
        enemyCommanderDisplay={enemyCommanderDisplay}
        enemyBudgetCurrent={enemyBudgetCurrent}
        enemyBudgetMax={enemyBudgetMax}
        showEnemyCommanderBanner={showEnemyCommanderBanner}
        enemyCommanderNotification={enemyCommanderNotification}
        enemyCommanderFirstEncounter={enemyCommanderFirstEncounter}
        showEnemyCommanderTutorial={showEnemyCommanderTutorial}
        handleDismissEnemyCommanderTutorial={handleDismissEnemyCommanderTutorial}
        enemyCommanderProfile={enemyCommanderProfile}
        enemyCommanderBattleState={enemyCommanderBattleState}
        enemyCommanderSource={enemyCommanderSource}
        enemyCommanderValid={enemyCommanderValid}
        enemyCommanderReason={enemyCommanderReason}
        enemyCommanderDevOverride={enemyCommanderDevOverride}
        enemyCommanderLastResult={enemyCommanderLastResult}
        enemyCommanderLastEvaluation={enemyCommanderLastEvaluation}
        enemyCommanderAiOverrides={enemyCommanderAiOverrides}
        handleSetEnemyCommanderDevOverride={handleSetEnemyCommanderDevOverride}
        handleSpendEnemyCommandPoint={handleSpendEnemyCommandPoint}
        handleResetEnemyBudget={handleResetEnemyBudget}
        handleForceEnemyCommand={handleForceEnemyCommand}
        handleSimulateEnemyDuplicate={handleSimulateEnemyDuplicate}
        handleTriggerEnemyActionWindow={handleTriggerEnemyActionWindow}
        handleRunEnemyEvaluation={handleRunEnemyEvaluation}
        handleSetEnemyHoldThreshold={handleSetEnemyHoldThreshold}
        handleSetEnemyReserveBias={handleSetEnemyReserveBias}
        handleSetEnemyInvalidateTarget={handleSetEnemyInvalidateTarget}
        tutorial={tutorial}
        TUT_ACTION={TUT_ACTION}
      />

      {attackPreview && (attackPreview.preview.kind === 'wall_charge' || attackPreview.preview.kind === 'insta_wall') ? (
        <TerrainUtilityPreviewPanel preview={attackPreview.preview} onFire={handlePreviewFire} onCancel={handlePreviewCancel} fireReason={null} />
      ) : attackPreview && attackPreview.preview.kind === 'disruptor_hook' ? (
        <DisruptorHookPreviewPanel preview={attackPreview.preview} onFire={handlePreviewFire} onCancel={handlePreviewCancel} />
      ) : attackPreview ? (
        <AttackPreviewPanel preview={attackPreview.preview} onFire={handlePreviewFire} onCancel={handlePreviewCancel} fireReason={null} />
      ) : null}
    </div>
    </BattleErrorBoundary>
  );
}