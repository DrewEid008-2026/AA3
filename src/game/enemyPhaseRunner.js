// Factory for the enemy phase runner. Extracted from Battle.jsx to keep the
// component under the file-size limit. The factory takes a context object
// with all the state setters, refs, helpers, and values the enemy phase
// needs, and returns the async `runEnemyPhase` function.
//
// All game-logic imports live here so Battle.jsx doesn't need to pass them.

import { TEAMS, MISSION_STATES } from './constants';
import { decideEnemyAction } from './ai';
import { computeDamage, resolveFlatDamage, getUnitWeapon } from './combat';
import { resolveTargetDamage } from './enemyPhaseHelpers';
import { hasStatus, STATUS_TYPES, STATUS_DEFS, STATUS_TIMING, tickStatuses, applyActivationStart, applyStatus, consumeMarked } from './statuses';
import { getEnemyAbility, tickEnemyCooldowns } from './enemyAbilities';
import { getIncomingDamageReduction, consumeIncomingReductions, resetSkillStateForPlayerPhase } from './skillEffects';
import { expireReactions, isInOverwatch } from './reactions';
import { clearSmoke } from './smoke';
import { tickBleedOut } from './downed';
import { damageProtectingCover, countNewlyDestroyedCover } from './cover';
import { reloadUnit, consumeAmmo, hasAmmo } from './ammo';
import { applyShield } from './shield';
import { createBeamSweep, detonateBeamSweep, BEAM_SWEEP } from './beamSweep';
import { createOverloadHazards, detonateOverloadHazards, OVERLOAD_DAMAGE } from './overloadHazard';
import { createPlasmaStrike, detonatePlasmaStrike } from './plasmaStrike';
import { createTremorSlam, detonateTremorSlam, detonateTremorTerrain, TREMOR } from './tremorSlam';
import { createExcavationBeam, detonateExcavationBeam, detonateBeamTerrain, EXCAVATION_BEAM } from './excavationBeam';
import {
  createSiegeCharge, getChargePathKeys,
  destroyChargePathTerrain, applyChargeCollisions, isChargeValid,
} from './siegeCharge';
import {
  createMeltdownZones, detonateMeltdownZones, getMeltdownTileKeys,
} from './meltdownZones';
import { detonateCoreDischarge, getCoreDischargeTileKeys, CORE_DISCHARGE_DAMAGE,
} from './coreDischarge';
import { shouldGenerateMeltdownZones, markCoreDischargeUsed } from './harvesterState';
import { BOSS_PHASES, getRelayStatus, regenerateBossShield, shouldSpawnPhase2Reinforcements, markPhase2ReinforcementsSpawned, shouldGenerateOverloadHazards } from './bossState';
import { spawnReinforcementWave, spawnPhase2Reinforcements, spawnFabricationReinforcements } from './reinforcements';
import { shouldSpawnFabricationReinforcements, markFabricationReinforcementsSpawned } from './harvesterState';
import { getTremorTileKeys } from './tremorSlam';
import { getBeamTileKeys } from './excavationBeam';
import { isObjectiveSecured, getMissionMapConfig, getReinforcementWaveForMission } from './missions';
import { createSegmentProcessor } from './enemySegmentProcessor';
import { createEnemyAbilityExecutor } from './enemyAbilityExecutor';
import { PRESENTATION_TYPES, getWeaponPresentation, getShotTiming, getWeaponVisualProfile } from './attackPresentation';
import { BUBBLE } from './actionBubbles';
import { animateSegment } from './battleAnimation';
import { clearRelocate, clearLineUp } from './marksman';

export function createEnemyPhaseRunner(ctx) {
  const {
    setUnits, setGrid, setPhase, setTurn, setMissionRuntime,
    setBeamSweeps, setOverloadHazards, setPlasmaStrikes,
    setBossState, setHarvesterState, setSelectedUnitId, setAttackMode, setAbilityTargeting,
    setActiveShot, setHitFlashId, setReactionFlashId, setLastReaction, setLastEnemyDecision,
    setPendingTremor, setPendingBeam, setPendingCharge, setMines,
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
  } = ctx;

  return async function runEnemyPhase() {
    setSelectedUnitId(null);
    setAttackMode(false);
    setAbilityTargeting(null);
    setPhase('enemy');

    let work = units.map((u) => ({ ...u }));
    let workGrid = grid;

    // --- End of Player Phase (just ended) ---
    work = work.map((u) => tickStatuses(u, STATUS_TIMING.END_PLAYER_PHASE));
    work = work.map((u) => { const nu = clearRelocate(clearLineUp(u)); return nu.sprintHarnessActive ? { ...nu, sprintHarnessActive: false } : nu; });

    // --- Start of Enemy Phase ---
    work = work.map((u) => { const nu = u.team === TEAMS.ENEMY && u.alive ? { ...u, ap: u.maxAp } : u; return nu.reactivePlating ? { ...nu, reactivePlatingAvailable: true } : nu; });
    work = work.map((u) => applyActivationStart(u, STATUS_TIMING.START_ENEMY_PHASE));
    work = work.map((u) => (u.team === TEAMS.ENEMY && u.alive ? tickEnemyCooldowns(u) : u));
    setUnits([...work]);
    await sleep(160);

    // Segment processor (mine + Overwatch + Pin Down) — created early so the
    // Siege Charge resolution can use it for per-tile Overwatch reactions.
    const processEnemySegment = createSegmentProcessor({
      minesRef, setUnits, setMines, setHitFlashId, setReactionFlashId,
      setActiveShot, setGrid, setLastReaction, pushPopup, flashAttackFeedback,
      hitTimer, reactionTimer, shotId, sleep, debug,
      REACTION_MS, REACTION_FLASH_MS, HIT_FLASH_MS,
    });

    // --- Harvester defeat guard (Parts 22, 50) ---
    // If the Harvester is dead at the start of the Enemy Phase (killed during
    // the Player Phase), cancel ALL pending Harvester hazards and skip their
    // detonation. The markHarvesterDefeated effect in Battle.jsx already
    // cleared the React state; this local flag guards the ref-based checks
    // below (refs may not have flushed yet within this async run).
    let harvesterDefeatedThisPhase = false;
    if (isHarvesterMission) {
      const harvesterAlive = work.some((u) => u.isBoss && u.archetype === 'harvester' && u.alive);
      if (!harvesterAlive) {
        harvesterDefeatedThisPhase = true;
        if (pendingTremorRef.current) setPendingTremor(null);
        if (pendingBeamRef.current) setPendingBeam(null);
        if (pendingChargeRef.current) setPendingCharge(null);
        if (pendingMeltdownRef.current) setPendingMeltdown(null);
        if (pendingCoreDischargeRef.current) setPendingCoreDischarge(null);
      }
    }

    // Core Shield regeneration at the beginning of each Enemy Phase.
    if (isBossMission) {
      const boss = work.find((u) => u.isBoss && u.alive);
      if (boss) {
        const rStatus = getRelayStatus(work);
        const activeRelays = rStatus.total - rStatus.destroyed;
        const regenEnabled = bossStateRef.current.bossShieldRegenerationEnabled;
        const { unit: regenBoss, regenAmount } = regenerateBossShield(boss, activeRelays, regenEnabled);
        if (regenAmount > 0) {
          work = work.map((u) => (u.id === boss.id ? regenBoss : u));
          setUnits([...work]);
          flashAttackFeedback(boss.x, boss.y, `SHIELD +${regenAmount}`, 'status');
          await sleep(300);
        }
      }
    }

    // Detonate pending Beam Sweeps (Warden Prime) at the start of the Enemy Phase.
    if (beamSweepsRef.current.length > 0) {
      for (const sweep of beamSweepsRef.current) {
        const lx = sweep.orientation === 'row' ? 4 : sweep.index;
        const ly = sweep.orientation === 'row' ? sweep.index : 7;
        flashAttackFeedback(lx, ly, 'BEAM SWEEP', 'ability');
        await sleep(ENEMY_ABILITY_LABEL_MS);
        const warden = work.find((u) => u.isBoss && u.alive);
        for (const hit of detonateBeamSweep(sweep, work)) {
          const t = work.find((u) => u.id === hit.unitId); if (!t) continue;
          const r = resolveFlatDamage(BEAM_SWEEP.damage, warden || {}, t, { affectedByArmor: true });
          const res = resolveTargetDamage(consumeMarked(t), r.finalDamage);
          let tf = res.unit; if (res.downed) tf = { ...tf, missionDowned: true };
          work = work.map((u) => (u.id === t.id ? tf : u));
          pushPopup(t.x, t.y, r.finalDamage, res.killed, 'damage');
          if (res.downed) flashAttackFeedback(t.x, t.y, 'DOWNED', 'status');
          setHitFlashId(t.id);
          if (hitTimer.current) clearTimeout(hitTimer.current);
          hitTimer.current = setTimeout(() => setHitFlashId(null), HIT_FLASH_MS);
        }
        setUnits([...work]); await sleep(ENEMY_ATTACK_MS);
      }
      setBeamSweeps([]);
    }

    // Detonate pending Overload hazards (Phase 3 Core Overload) at the start of
    // the Enemy Phase.
    if (overloadHazardsRef.current.length > 0) {
      for (const hazard of overloadHazardsRef.current) {
        flashAttackFeedback(hazard.x, hazard.y, 'OVERLOAD', 'ability');
        await sleep(ENEMY_ABILITY_LABEL_MS);
        const hits = detonateOverloadHazards([hazard], work);
        for (const hit of hits) {
          const target = work.find((u) => u.id === hit.unitId);
          if (!target) continue;
          const result = resolveTargetDamage(target, OVERLOAD_DAMAGE);
          let tf = result.unit;
          if (result.downed) tf = { ...tf, missionDowned: true };
          work = work.map((u) => (u.id === target.id ? tf : u));
          pushPopup(hazard.x, hazard.y, OVERLOAD_DAMAGE, result.killed, 'damage');
          if (result.downed) flashAttackFeedback(hazard.x, hazard.y, 'DOWNED', 'status');
          setHitFlashId(target.id);
          if (hitTimer.current) clearTimeout(hitTimer.current);
          hitTimer.current = setTimeout(() => setHitFlashId(null), HIT_FLASH_MS);
        }
        setUnits([...work]);
        await sleep(ENEMY_ATTACK_MS);
      }
      setOverloadHazards([]);
    }

    // --- The Harvester (Chapter 2 Boss): detonate pending hazards ---
    // Tremor Slam: 3×3 area, 4 Environmental damage (no armor/cover), 6 terrain
    // damage to destructible tiles. Excavation Beam: row/column, 5 direct damage
    // (armor applies, cover ignored), 8 terrain damage. Both telegraph one
    // phase in advance and detonate at the start of the next Enemy Phase.
    if (isHarvesterMission && pendingTremorRef.current && !harvesterDefeatedThisPhase) {
      try {
      const tremor = pendingTremorRef.current;
      flashAttackFeedback(tremor.centerX, tremor.centerY, 'TREMOR SLAM', 'ability');
      await sleep(ENEMY_ABILITY_LABEL_MS);
      const harvester = work.find((u) => u.isBoss && u.alive);
      for (const hit of detonateTremorSlam(tremor, work)) {
        const t = work.find((u) => u.id === hit.unitId); if (!t) continue;
        const r = resolveFlatDamage(TREMOR.damage, harvester || {}, t, { affectedByArmor: false });
        const res = resolveTargetDamage(consumeMarked(t), r.finalDamage);
        let tf = res.unit; if (res.downed) tf = { ...tf, missionDowned: true };
        work = work.map((u) => (u.id === t.id ? tf : u));
        pushPopup(t.x, t.y, r.finalDamage, res.killed, 'damage');
        if (res.downed) flashAttackFeedback(t.x, t.y, 'DOWNED', 'status');
        setHitFlashId(t.id);
        if (hitTimer.current) clearTimeout(hitTimer.current);
        hitTimer.current = setTimeout(() => setHitFlashId(null), HIT_FLASH_MS);
      }
      workGrid = detonateTremorTerrain(tremor, workGrid).grid; setGrid(workGrid);
      setUnits([...work]); await sleep(ENEMY_ATTACK_MS);
      setPendingTremor(null);
      } catch (err) { console.error('[Enemy Phase] Tremor Slam detonation failed:', err); setPendingTremor(null); }
    }
    if (isHarvesterMission && pendingBeamRef.current && !harvesterDefeatedThisPhase) {
      try {
      const beam = pendingBeamRef.current;
      flashAttackFeedback(beam.orientation === 'row' ? 4 : beam.index, beam.orientation === 'row' ? beam.index : 7, 'EXCAVATION BEAM', 'ability');
      await sleep(ENEMY_ABILITY_LABEL_MS);
      const harvester = work.find((u) => u.isBoss && u.alive);
      for (const hit of detonateExcavationBeam(beam, work)) {
        const t = work.find((u) => u.id === hit.unitId); if (!t) continue;
        const r = resolveFlatDamage(EXCAVATION_BEAM.damage, harvester || {}, t, { affectedByArmor: true, ignoreCover: true });
        const res = resolveTargetDamage(consumeMarked(t), r.finalDamage);
        let tf = res.unit; if (res.downed) tf = { ...tf, missionDowned: true };
        work = work.map((u) => (u.id === t.id ? tf : u));
        pushPopup(t.x, t.y, r.finalDamage, res.killed, 'damage');
        if (res.downed) flashAttackFeedback(t.x, t.y, 'DOWNED', 'status');
        setHitFlashId(t.id);
        if (hitTimer.current) clearTimeout(hitTimer.current);
        hitTimer.current = setTimeout(() => setHitFlashId(null), HIT_FLASH_MS);
      }
      workGrid = detonateBeamTerrain(beam, workGrid).grid; setGrid(workGrid);
      setUnits([...work]); await sleep(ENEMY_ATTACK_MS);
      setPendingBeam(null);
      } catch (err) { console.error('[Enemy Phase] Excavation Beam detonation failed:', err); setPendingBeam(null); }
    }

    // --- Siege Charge detonation (The Harvester Phase 2) ---
    // Destroys Siege map tiles + normal cover in the path, downs standing
    // soldiers (ignores Armor/Shield/HP), and moves the Harvester to the
    // destination. Telegraphed one full Player Phase in advance.
    if (isHarvesterMission && pendingChargeRef.current && !harvesterDefeatedThisPhase) {
      try {
      const charge = pendingChargeRef.current;
      const harvester = work.find((u) => u.id === charge.sourceId && u.alive);
      if (harvester && isChargeValid(charge, work)) {
        flashAttackFeedback(harvester.x, harvester.y, 'SIEGE CHARGE', 'ability');
        await sleep(ENEMY_ABILITY_LABEL_MS);

        // 1. Destroy terrain (Siege tiles + cover) along the path (atomic —
        //    these are "already-resolved path effects" that stay even if the
        //    Harvester dies mid-charge).
        const terrainResult = destroyChargePathTerrain(workGrid, charge);
        workGrid = terrainResult.grid; setGrid(workGrid);
        if (terrainResult.destroyedTileCount > 0 || terrainResult.destroyedCoverCount > 0) {
          showCoverDestroyed(terrainResult.destroyedCoverCount + terrainResult.destroyedTileCount);
        }

        // 2. Down standing soldiers in the path (catastrophic collision, atomic).
        const collisionResult = applyChargeCollisions(work, charge);
        work = collisionResult.units;
        for (const d of collisionResult.downed) {
          pushPopup(d.x, d.y, 'DOWNED', true, 'damage');
          flashAttackFeedback(d.x, d.y, 'DOWNED', 'status');
          setHitFlashId(d.unitId);
          if (hitTimer.current) clearTimeout(hitTimer.current);
          hitTimer.current = setTimeout(() => setHitFlashId(null), HIT_FLASH_MS);
        }
        setUnits([...work]);

        // 3. Move the Harvester tile-by-tile with Overwatch reactions. Mines
        //    trigger per-tile via processEnemySegment (Stun does NOT cancel
        //    the charge — only death stops it). If the Harvester dies
        //    mid-charge, stop at the death point without rolling back the
        //    already-resolved terrain destruction and collisions above.
        const el = tokenRefs.current[harvester.id];
        const pathTiles = charge.pathTiles || [];
        let lastX = harvester.x, lastY = harvester.y;
        let chargeDied = false;
        for (let i = 0; i < pathTiles.length; i++) {
          const tile = pathTiles[i];
          if (el) {
            await animateSegment(el, lastX, lastY, tile.x, tile.y, ENEMY_MOVE_PER_SEG);
          }
          work = work.map((u) => (u.id === harvester.id ? { ...u, x: tile.x, y: tile.y } : u));
          setUnits([...work]);
          const seg = await processEnemySegment(workGrid, work, harvester.id, tile.x, tile.y, false);
          workGrid = seg.workGrid; work = seg.work;
          if (seg.died) { chargeDied = true; break; }
          lastX = tile.x; lastY = tile.y;
        }
        if (chargeDied) { await sleep(ENEMY_STEP_MS); }
        else { await sleep(ENEMY_ATTACK_MS); }
      }
      setPendingCharge(null);
      } catch (err) { console.error('[Enemy Phase] Siege Charge detonation failed:', err); setPendingCharge(null); }
    }

    // --- The Harvester Phase 3: detonate pending Meltdown Zones ---
    // Environmental hazards from the failing reactor. 4 damage, ignores Armor
    // and Cover (Part 15). Harvester is immune to its own venting (Part 40).
    // Other aliens take damage too (Part 18). Does not destroy terrain (Part 17).
    if (isHarvesterMission && pendingMeltdownRef.current && pendingMeltdownRef.current.length > 0 && !harvesterDefeatedThisPhase) {
      try {
      const zones = pendingMeltdownRef.current;
      const harvester = work.find((u) => u.isBoss && u.alive);
      const harvId = harvester ? harvester.id : null;
      flashAttackFeedback(zones[0].x, zones[0].y, 'MELTDOWN', 'ability');
      await sleep(ENEMY_ABILITY_LABEL_MS);
      const hits = detonateMeltdownZones(zones, work, harvId);
      for (const hit of hits) {
        const t = work.find((u) => u.id === hit.unitId);
        if (!t) continue;
        // Environmental damage: ignores Armor and Cover (Part 15).
        const res = resolveTargetDamage(t, hit.damage);
        let tf = res.unit;
        if (res.downed) tf = { ...tf, missionDowned: true };
        work = work.map((u) => (u.id === t.id ? tf : u));
        pushPopup(t.x, t.y, hit.damage, res.killed, 'damage');
        if (res.downed) flashAttackFeedback(t.x, t.y, 'DOWNED', 'status');
        setHitFlashId(t.id);
        if (hitTimer.current) clearTimeout(hitTimer.current);
        hitTimer.current = setTimeout(() => setHitFlashId(null), HIT_FLASH_MS);
      }
      setUnits([...work]);
      await sleep(ENEMY_ATTACK_MS);
      setPendingMeltdown(null);
      } catch (err) { console.error('[Enemy Phase] Meltdown Zones detonation failed:', err); setPendingMeltdown(null); }
    }

    // --- The Harvester Phase 3: detonate pending Core Discharge ---
    // One-time direct energy attack. 6 damage (Armor applies, Cover ignored,
    // Shields apply — Part 28/29). 6 terrain damage to normal Cover (Part 30).
    // Does NOT destroy Siege tiles (Part 31). Harvester is immune.
    if (isHarvesterMission && pendingCoreDischargeRef.current && !harvesterDefeatedThisPhase) {
      try {
      const discharge = pendingCoreDischargeRef.current;
      const harvester = work.find((u) => u.id === discharge.sourceId && u.alive);
      if (harvester) {
        flashAttackFeedback(harvester.x, harvester.y, 'CORE DISCHARGE', 'ability');
        await sleep(ENEMY_ABILITY_LABEL_MS);
        const { hits, grid: newGrid } = detonateCoreDischarge(discharge, work, workGrid);
        workGrid = newGrid; setGrid(workGrid);
        for (const hit of hits) {
          const t = work.find((u) => u.id === hit.unitId);
          if (!t) continue;
          // Direct energy: Armor applies, Cover ignored (Part 28/29).
          const r = resolveFlatDamage(CORE_DISCHARGE_DAMAGE, harvester, t, { affectedByArmor: true, ignoreCover: true });
          const res = resolveTargetDamage(consumeMarked(t), r.finalDamage);
          let tf = res.unit;
          if (res.downed) tf = { ...tf, missionDowned: true };
          work = work.map((u) => (u.id === t.id ? tf : u));
          pushPopup(t.x, t.y, r.finalDamage, res.killed, 'damage');
          if (res.downed) flashAttackFeedback(t.x, t.y, 'DOWNED', 'status');
          setHitFlashId(t.id);
          if (hitTimer.current) clearTimeout(hitTimer.current);
          hitTimer.current = setTimeout(() => setHitFlashId(null), HIT_FLASH_MS);
        }
        setUnits([...work]);
        await sleep(ENEMY_ATTACK_MS);
      }
      setPendingCoreDischarge(null);
      } catch (err) { console.error('[Enemy Phase] Core Discharge detonation failed:', err); setPendingCoreDischarge(null); }
    }

    // --- The Harvester: Fabrication Sequence (Phase 2 one-time reinforcements) ---
    // Fires once at the start of the first Enemy Phase after Phase 2 begins.
    // Spawns 1 Fabricator + 1 Hardened Grunt in the two predefined Pit zones,
    // using CURRENT battlefield geometry (Siege destruction, occupied tiles,
    // pending hazards all respected). Never repeats (Part 11).
    if (isHarvesterMission && shouldSpawnFabricationReinforcements(harvesterStateRef.current)) {
      const cfg = getMissionMapConfig(missionId);
      const zones = cfg?.phase2ReinforcementZones;
      if (zones) {
        // Gather pending-hazard tiles so reinforcements avoid spawning on a
        // tile that will detonate this phase (Part 34).
        const hazardKeys = new Set();
        if (pendingTremorRef.current) for (const k of getTremorTileKeys(pendingTremorRef.current)) hazardKeys.add(k);
        if (pendingBeamRef.current) for (const k of getBeamTileKeys(pendingBeamRef.current)) hazardKeys.add(k);
        if (pendingChargeRef.current) for (const k of getChargePathKeys(pendingChargeRef.current)) hazardKeys.add(k);
        // Harvester footprint — its own tile.
        const harv = work.find((u) => u.isBoss && u.alive && u.archetype === 'harvester');
        const bossFootprint = harv ? [{ x: harv.x, y: harv.y }] : [];

        showActionBubble(harv?.id, 'FABRICATION SEQUENCE!');
        flashAttackFeedback(4, 1, 'FABRICATION SEQUENCE', 'ability');
        await sleep(ENEMY_ABILITY_LABEL_MS);

        const result = spawnFabricationReinforcements(workGrid, work, zones,
          { civilian: civilianRef.current, device: deviceRef.current },
          { pendingHazardKeys: hazardKeys, bossFootprint }
        );
        if (result.newUnits.length > 0) {
          work = [...work, ...result.newUnits];
          setUnits([...work]);
          for (const log of result.logs) {
            // Brief feedback at the spawn tile (Part 45 combat log).
            const sp = result.newUnits.find((u) => u.name && log.startsWith(u.name.split(' ')[0]));
            const tile = sp || result.newUnits[0];
            flashAttackFeedback(tile.x, tile.y, log.toUpperCase().replace('.', ''), 'status');
          }
          await sleep(ENEMY_STEP_MS);
        }
      }
      setHarvesterState((prev) => markFabricationReinforcementsSpawned(prev));
    }

    // Warden Prime Phase 2 reinforcements (stalker + rusher) — unchanged.
    if (isBossMission && !isHarvesterMission && shouldSpawnPhase2Reinforcements(bossStateRef.current)) {
      const cfg = getMissionMapConfig(missionId);
      const zones = cfg?.phase2ReinforcementZones;
      if (zones) {
        const ne = spawnPhase2Reinforcements(grid, work, zones, { civilian: civilianRef.current, device: deviceRef.current });
        if (ne.length > 0) { work = [...work, ...ne]; setUnits([...work]); flashAttackFeedback(4, 0, 'REINFORCEMENTS!', 'ability'); await sleep(ENEMY_STEP_MS); }
      }
      setBossState((prev) => markPhase2ReinforcementsSpawned(prev));
    }

    // Detonate pending Plasma Strikes (Artillery) at the start of the Enemy Phase.
    if (plasmaStrikesRef.current.length > 0) {
      for (const strike of plasmaStrikesRef.current) {
        flashAttackFeedback(strike.x, strike.y, 'PLASMA STRIKE', 'ability');
        await sleep(ENEMY_ABILITY_LABEL_MS);
        const hits = detonatePlasmaStrike(strike, work);
        for (const hit of hits) {
          const target = work.find((u) => u.id === hit.unitId);
          if (!target) continue;
          const result = resolveTargetDamage(target, hit.damage);
          work = work.map((u) => (u.id === target.id ? result.unit : u));
          pushPopup(target.x, target.y, hit.damage, result.killed, 'damage');
          if (result.downed) flashAttackFeedback(target.x, target.y, 'DOWNED', 'status');
          setHitFlashId(target.id);
          if (hitTimer.current) clearTimeout(hitTimer.current);
          hitTimer.current = setTimeout(() => setHitFlashId(null), HIT_FLASH_MS);
        }
        setUnits([...work]);
        await sleep(ENEMY_ATTACK_MS);
      }
      setPlasmaStrikes([]);
    }

    // --- Enemy Commander action window (3.2.2) ---
    // After all pending beginning-of-Enemy-Phase effects resolve and before
    // normal enemy unit activations. The hostile Commander may issue one legal
    // command (dev auto-execution). Commander actions are separate from alien
    // activations — they do NOT consume alien AP, ammo, or weapon range.
    if (processEnemyCommanderAction) {
      try {
        const cmdResult = await processEnemyCommanderAction(work, workGrid, GRID_WIDTH, GRID_HEIGHT, sleep, { turn, missionConfig, flashAttackFeedback });
        // Apply the Commander's unit effect to the local work array so
        // subsequent alien activations see the bonus AP (spec §12: existing
        // alien AI must reevaluate and use the extra action). processEnemyCommanderAction
        // already called setUnits internally, but work is a separate local copy.
        if (cmdResult?.ok && cmdResult.unitEffect?.type === 'ap_grant') {
          work = work.map((u) =>
            u.id === cmdResult.unitEffect.unitId
              ? { ...u, ap: u.ap + cmdResult.unitEffect.amount }
              : u
          );
          setUnits([...work]);
        }
      } catch (err) {
        console.error('[Enemy Phase] Enemy Commander action window failed:', err);
      }
    }

    const enemyAbilityExec = createEnemyAbilityExecutor({
      setUnits, setGrid, flashAttackFeedback, flashStatusLabel, pushPopup,
      setHitFlashId, hitTimer, sleep, processEnemySegment, tokenRefs,
      HIT_FLASH_MS, ENEMY_MOVE_PER_SEG, ENEMY_ABILITY_LABEL_MS,
      ENEMY_ATTACK_MS, ENEMY_STEP_MS,
    });

    const enemyOrder = work.filter((u) => u.team === TEAMS.ENEMY && u.alive);
    // Activation priority (spec 19): Flash Claw acts before slower or more
    // valuable allied units when active player Overwatch exists, so it can
    // burn reactions before allies advance. Only reorders when there are
    // active Overwatch reactions AND Flash Claws in the activation queue.
    const hasPlayerOverwatch = work.some(
      (u) => u.alive && u.team === TEAMS.PLAYER && isInOverwatch(u) && hasAmmo(u)
    );
    if (hasPlayerOverwatch && enemyOrder.some((u) => u.archetype === 'flash_claw')) {
      const flashClaws = enemyOrder.filter((u) => u.archetype === 'flash_claw');
      const others = enemyOrder.filter((u) => u.archetype !== 'flash_claw');
      enemyOrder.length = 0;
      enemyOrder.push(...flashClaws, ...others);
    }

    for (const enemy of enemyOrder) {
      let moveCount = 0;
      let guard = 0;
      while (guard++ < 6) {
        const e = work.find((u) => u.id === enemy.id);
        if (!e || !e.alive || e.ap <= 0) break;
        if (!work.some((u) => u.team === TEAMS.PLAYER && u.alive)) break;

        const decision = decideEnemyAction(workGrid, work, e, {
          bossState: bossStateRef.current,
          hasPendingBeamSweep: beamSweepsRef.current.length > 0,
          harvesterState: harvesterStateRef.current,
          hasPendingTremor: !!pendingTremorRef.current,
          hasPendingBeam: !!pendingBeamRef.current,
          hasPendingCharge: !!pendingChargeRef.current,
          hasPendingCoreDischarge: !!pendingCoreDischargeRef.current,
          pendingMeltdownKeys: pendingMeltdownRef.current ? getMeltdownTileKeys(pendingMeltdownRef.current) : new Set(),
        });
        if (debug) setLastEnemyDecision({ name: e.name, archetype: e.archetype, ...decision });
        if (decision.type === 'end') break;

        if (decision.type === 'attack') {
          const target = work.find((u) => u.id === decision.targetId);
          if (!target) break;
          const isBossPhase3 = e.isBoss && bossStateRef.current.bossPhase === BOSS_PHASES.PHASE_3_OVERLOAD;
          const o = isBossPhase3
            ? computeDamage(e, target, workGrid, { baseDamage: getUnitWeapon(e).damage + 1, units: work })
            : computeDamage(e, target, workGrid, { units: work });
          const enemyWeapon = getUnitWeapon(e);
          const ePres = getWeaponPresentation(enemyWeapon);
          const eTiming = getShotTiming(ePres);
          const eProfile = getWeaponVisualProfile(enemyWeapon);
          const eShotId = ++shotId.current;
          setActiveShot({
            id: eShotId, from: { x: e.x, y: e.y }, to: { x: target.x, y: target.y },
            presentation: ePres, profile: eProfile, phase: 'travel',
          });
          showActionBubble(e.id, BUBBLE.ATTACKING);
          await sleep(eTiming.travel);
          const reduction = getIncomingDamageReduction(workGrid, work, e, target);
          const reducedDamage = Math.max(1, o.finalDamage - reduction);
          const tgtResult = resolveTargetDamage(consumeMarked(target), reducedDamage);
          let tgtFinal = tgtResult.unit;
          if (tgtResult.downed) tgtFinal = { ...tgtFinal, missionDowned: true };
          if (reduction > 0) tgtFinal = consumeIncomingReductions(tgtFinal);
          work = work.map((u) => {
            if (u.id === e.id) return { ...consumeAmmo(u), ap: Math.max(0, u.ap - 1) };
            if (u.id === target.id) return tgtFinal;
            return u;
          });
          setUnits([...work]);
          setActiveShot((prev) => (prev && prev.id === eShotId ? { ...prev, phase: 'impact' } : prev));
          pushPopup(target.x, target.y, reducedDamage, tgtResult.killed, 'damage');
          if (o.lonePrey) flashAttackFeedback(target.x, target.y, 'LONE PREY', 'status');
          if (tgtResult.downed) flashAttackFeedback(target.x, target.y, 'DOWNED', 'status');
          setHitFlashId(target.id);
          if (hitTimer.current) clearTimeout(hitTimer.current);
          hitTimer.current = setTimeout(() => setHitFlashId(null), HIT_FLASH_MS);
          if (o.state === 'covered') {
            const bg = workGrid; workGrid = damageProtectingCover(workGrid, e, target, 1); setGrid(workGrid);
            const cd = countNewlyDestroyedCover(bg, workGrid); if (cd) showCoverDestroyed(cd);
          }
          await sleep(eTiming.impact);
          setActiveShot(null);
          if (hasStatus(work.find((u) => u.id === e.id), STATUS_TYPES.BURNING)) {
            const burn = applyEnemyBurning(work, e.id);
            work = burn.work; setUnits([...work]);
            if (burn.died) { await sleep(ENEMY_STEP_MS); break; }
          }
        } else if (decision.type === 'ability') {
          const ability = getEnemyAbility(decision.abilityId);
          const target = work.find((u) => u.id === decision.targetId);
          if (!ability || !target) break;
          showActionBubble(e.id, ability.name.toUpperCase() + '!');
          if (ability.id === 'field_repair') {
            const r = await enemyAbilityExec.run(workGrid, work, e, decision);
            work = r.work; setUnits([...work]);
            if (r.died) { await sleep(ENEMY_STEP_MS); break; }
            continue;
          }
          flashAttackFeedback(e.x, e.y, ability.name.toUpperCase(), 'ability');
          await sleep(ENEMY_ABILITY_LABEL_MS);
          if (ability.id === 'energy_shield') {
            work = work.map((u) => {
              if (u.id === e.id) return { ...u, ap: Math.max(0, u.ap - ability.apCost), cooldowns: { ...u.cooldowns, [ability.id]: ability.cooldown } };
              if (u.id === target.id) return applyShield(u, ability.shieldValue, e.id);
              return u;
            });
            setUnits([...work]);
            flashStatusLabel(target.x, target.y, 'SHIELDED', 'status');
            await sleep(ENEMY_ATTACK_MS);
            if (hasStatus(work.find((u) => u.id === e.id), STATUS_TYPES.BURNING)) {
              const burn = applyEnemyBurning(work, e.id);
              work = burn.work; setUnits([...work]);
              if (burn.died) { await sleep(ENEMY_STEP_MS); break; }
            }
            continue;
          }
          const isRangedAbilityShot = ability.damage > 0 && (ability.range || 0) > 1;
          let abTiming = null;
          let abShotId = null;
          if (isRangedAbilityShot) {
            const abPres = PRESENTATION_TYPES.BEAM;
            abTiming = getShotTiming(abPres);
            const abProfile = getWeaponVisualProfile({ presentation: abPres });
            abShotId = ++shotId.current;
            setActiveShot({
              id: abShotId, from: { x: e.x, y: e.y }, to: { x: target.x, y: target.y },
              presentation: abPres, profile: abProfile, phase: 'travel',
            });
            await sleep(abTiming.travel);
          }
          const ignoreSupp = ability.id === 'shock_strike';
          let dmg = 0;
          let tgtResult = null;
          let abilityReduction = 0;
          if (ability.damage > 0) {
            const r = ability.usesNormalDamageResolution
              ? { finalDamage: computeDamage(e, target, workGrid).finalDamage }
              : resolveFlatDamage(ability.damage, e, target, { ignoreSuppressed: ignoreSupp });
            abilityReduction = getIncomingDamageReduction(workGrid, work, e, target);
            dmg = Math.max(1, r.finalDamage - abilityReduction);
            tgtResult = resolveTargetDamage(consumeMarked(target), dmg);
          }
          work = work.map((u) => {
            if (u.id === e.id) {
              return { ...u, ap: Math.max(0, u.ap - ability.apCost), cooldowns: { ...u.cooldowns, [ability.id]: ability.cooldown } };
            }
            if (u.id === target.id) {
              let nu = tgtResult ? tgtResult.unit : u;
              if (tgtResult?.downed) nu = { ...nu, missionDowned: true };
              if (abilityReduction > 0) nu = consumeIncomingReductions(nu);
              if (nu.alive && !nu.downed && ability.appliesStatus) {
                nu = applyStatus(nu, ability.appliesStatus, { source: e.id, turnsRemaining: ability.statusDuration || 1 });
              }
              return nu;
            }
            return u;
          });
          setUnits([...work]);
          if (isRangedAbilityShot) {
            setActiveShot((prev) => (prev && prev.id === abShotId ? { ...prev, phase: 'impact' } : prev));
          }
          if (ability.damage > 0 && tgtResult) {
            pushPopup(target.x, target.y, dmg, tgtResult.killed, 'damage');
            if (tgtResult.downed) flashAttackFeedback(target.x, target.y, 'DOWNED', 'status');
            setHitFlashId(target.id);
            if (hitTimer.current) clearTimeout(hitTimer.current);
            hitTimer.current = setTimeout(() => setHitFlashId(null), HIT_FLASH_MS);
          }
          if (ability.appliesStatus && target.alive && !tgtResult?.downed) {
            const sname = STATUS_DEFS[ability.appliesStatus].name.toUpperCase();
            flashStatusLabel(target.x, target.y, sname, 'status');
          }
          if (debug) setLastEnemyDecision({ name: e.name, archetype: e.archetype, ...decision });
          if (isRangedAbilityShot) {
            await sleep(abTiming.impact);
            setActiveShot(null);
          } else {
            await sleep(ENEMY_ATTACK_MS);
          }
          if (hasStatus(work.find((u) => u.id === e.id), STATUS_TYPES.BURNING)) {
            const burn = applyEnemyBurning(work, e.id);
            work = burn.work; setUnits([...work]);
            if (burn.died) { await sleep(ENEMY_STEP_MS); break; }
          }
        } else if (decision.type === 'reload') {
          work = work.map((u) => (u.id === e.id ? { ...reloadUnit(u), ap: Math.max(0, u.ap - 1) } : u));
          setUnits([...work]);
          showActionBubble(e.id, BUBBLE.RELOADING);
          flashAttackFeedback(e.x, e.y, 'RELOAD', 'info');
          await sleep(ENEMY_STEP_MS);
          if (hasStatus(work.find((u) => u.id === e.id), STATUS_TYPES.BURNING)) {
            const burn = applyEnemyBurning(work, e.id);
            work = burn.work; setUnits([...work]);
            if (burn.died) { await sleep(ENEMY_STEP_MS); break; }
          }
        } else if (decision.type === 'move') {
          const isSprint = moveCount >= 1;
          moveCount += 1;
          const path = decision.entry.path;
          // Flash Claw moving through reaction fire shows "FLASH ADVANCE!"
          // (spec 33) instead of the generic MOVING bubble.
          const isFlashClawAdvancing = e.archetype === 'flash_claw' &&
            work.some((u) => u.alive && u.team === TEAMS.PLAYER && isInOverwatch(u) && hasAmmo(u));
          showActionBubble(e.id, isFlashClawAdvancing ? BUBBLE.FLASH_ADVANCE : BUBBLE.MOVING);
          const el = tokenRefs.current[e.id];
          let died = false;
          for (let i = 1; i < path.length && !died; i++) {
            const [px, py] = path[i - 1];
            const [nx, ny] = path[i];
            await animateSegment(el, px, py, nx, ny, ENEMY_MOVE_PER_SEG);
            work = work.map((u) => (u.id === e.id ? { ...u, x: nx, y: ny } : u));
            setUnits([...work]);
            const seg = await processEnemySegment(workGrid, work, e.id, nx, ny, isSprint);
            workGrid = seg.workGrid; work = seg.work; died = seg.died;
          }
          if (died) {
            setUnits([...work]);
            await sleep(ENEMY_STEP_MS);
            break;
          }
          work = work.map((u) => (u.id === e.id ? { ...u, ap: u.ap - 1 } : u));
          setUnits([...work]);
          await sleep(ENEMY_STEP_MS);
          if (hasStatus(work.find((u) => u.id === e.id), STATUS_TYPES.BURNING)) {
            const burn = applyEnemyBurning(work, e.id);
            work = burn.work; setUnits([...work]);
            if (burn.died) { await sleep(ENEMY_STEP_MS); break; }
          }
        } else if (decision.type === 'phase_step' || decision.type === 'phase_shift') {
          const ability = getEnemyAbility(decision.abilityId);
          if (!ability) break;
          showActionBubble(e.id, ability.name.toUpperCase() + '!');
          flashAttackFeedback(e.x, e.y, ability.name.toUpperCase(), 'ability');
          await sleep(ENEMY_ABILITY_LABEL_MS);
          const psPath = decision.entry.path;
          const psEl = tokenRefs.current[e.id];
          let psDied = false;
          for (let i = 1; i < psPath.length && !psDied; i++) {
            const [px, py] = psPath[i - 1];
            const [nx, ny] = psPath[i];
            await animateSegment(psEl, px, py, nx, ny, ENEMY_MOVE_PER_SEG);
            work = work.map((u) => (u.id === e.id ? { ...u, x: nx, y: ny } : u));
            setUnits([...work]);
            const seg = await processEnemySegment(workGrid, work, e.id, nx, ny, false);
            workGrid = seg.workGrid; work = seg.work; psDied = seg.died;
          }
          if (psDied) { setUnits([...work]); await sleep(ENEMY_STEP_MS); break; }
          work = work.map((u) => (u.id === e.id ? { ...u, cooldowns: { ...u.cooldowns, [ability.id]: ability.cooldown } } : u));
          setUnits([...work]);
          await sleep(ENEMY_STEP_MS);
          if (hasStatus(work.find((u) => u.id === e.id), STATUS_TYPES.BURNING)) {
            const burn = applyEnemyBurning(work, e.id);
            work = burn.work; setUnits([...work]);
            if (burn.died) { await sleep(ENEMY_STEP_MS); break; }
          }
        } else if (decision.type === 'plasma_strike') {
          const ability = getEnemyAbility(decision.abilityId);
          if (!ability) break;
          showActionBubble(e.id, ability.name.toUpperCase() + '!');
          flashAttackFeedback(e.x, e.y, ability.name.toUpperCase(), 'ability');
          await sleep(ENEMY_ABILITY_LABEL_MS);
          const strike = createPlasmaStrike(decision.x, decision.y, e.id);
          setPlasmaStrikes((prev) => [...prev, strike]);
          flashAttackFeedback(decision.x, decision.y, 'STRIKE INCOMING', 'ability');
          work = work.map((u) => (u.id === e.id ? { ...u, ap: Math.max(0, u.ap - ability.apCost), cooldowns: { ...u.cooldowns, [ability.id]: ability.cooldown } } : u));
          setUnits([...work]);
          await sleep(ENEMY_ATTACK_MS);
          if (hasStatus(work.find((u) => u.id === e.id), STATUS_TYPES.BURNING)) {
            const burn = applyEnemyBurning(work, e.id);
            work = burn.work; setUnits([...work]);
            if (burn.died) { await sleep(ENEMY_STEP_MS); break; }
          }
        } else if (decision.type === 'beam_sweep') {
          const ability = getEnemyAbility(decision.abilityId); if (!ability) break;
          showActionBubble(e.id, ability.name.toUpperCase() + '!');
          flashAttackFeedback(e.x, e.y, ability.name.toUpperCase(), 'ability');
          await sleep(ENEMY_ABILITY_LABEL_MS);
          setBeamSweeps((prev) => [...prev, createBeamSweep(decision.orientation, decision.index, e.id, turn)]);
          flashAttackFeedback(decision.orientation === 'row' ? 4 : decision.index, decision.orientation === 'row' ? decision.index : 7, 'SWEEP INCOMING', 'ability');
          work = work.map((u) => (u.id === e.id ? { ...u, ap: Math.max(0, u.ap - ability.apCost), cooldowns: { ...u.cooldowns, [ability.id]: ability.cooldown } } : u));
          setUnits([...work]); await sleep(ENEMY_ATTACK_MS);
          if (hasStatus(work.find((u) => u.id === e.id), STATUS_TYPES.BURNING)) { const burn = applyEnemyBurning(work, e.id); work = burn.work; setUnits([...work]); if (burn.died) { await sleep(ENEMY_STEP_MS); break; } }
        } else if (decision.type === 'tremor_slam') {
          // The Harvester: mark a 3×3 area — detonates next Enemy Phase.
          const ability = getEnemyAbility(decision.abilityId); if (!ability) break;
          showActionBubble(e.id, ability.name.toUpperCase() + '!');
          flashAttackFeedback(e.x, e.y, ability.name.toUpperCase(), 'ability');
          await sleep(ENEMY_ABILITY_LABEL_MS);
          setPendingTremor(createTremorSlam(decision.x, decision.y, e.id, turn));
          flashAttackFeedback(decision.x, decision.y, 'TREMOR INCOMING', 'ability');
          work = work.map((u) => (u.id === e.id ? { ...u, ap: Math.max(0, u.ap - ability.apCost), cooldowns: { ...u.cooldowns, [ability.id]: ability.cooldown } } : u));
          setUnits([...work]); await sleep(ENEMY_ATTACK_MS);
          if (hasStatus(work.find((u) => u.id === e.id), STATUS_TYPES.BURNING)) { const burn = applyEnemyBurning(work, e.id); work = burn.work; setUnits([...work]); if (burn.died) { await sleep(ENEMY_STEP_MS); break; } }
        } else if (decision.type === 'excavation_beam') {
          // The Harvester: mark a row/column — detonates next Enemy Phase.
          const ability = getEnemyAbility(decision.abilityId); if (!ability) break;
          showActionBubble(e.id, ability.name.toUpperCase() + '!');
          flashAttackFeedback(e.x, e.y, ability.name.toUpperCase(), 'ability');
          await sleep(ENEMY_ABILITY_LABEL_MS);
          setPendingBeam(createExcavationBeam(decision.orientation, decision.index, e.id, turn));
          flashAttackFeedback(decision.orientation === 'row' ? 4 : decision.index, decision.orientation === 'row' ? decision.index : 7, 'BEAM INCOMING', 'ability');
          work = work.map((u) => (u.id === e.id ? { ...u, ap: Math.max(0, u.ap - ability.apCost), cooldowns: { ...u.cooldowns, [ability.id]: ability.cooldown } } : u));
          setUnits([...work]); await sleep(ENEMY_ATTACK_MS);
          if (hasStatus(work.find((u) => u.id === e.id), STATUS_TYPES.BURNING)) { const burn = applyEnemyBurning(work, e.id); work = burn.work; setUnits([...work]); if (burn.died) { await sleep(ENEMY_STEP_MS); break; } }
        } else if (decision.type === 'siege_charge') {
          // The Harvester: lock a charge line — detonates next Enemy Phase.
          const ability = getEnemyAbility(decision.abilityId); if (!ability) break;
          showActionBubble(e.id, ability.name.toUpperCase() + '!');
          flashAttackFeedback(e.x, e.y, ability.name.toUpperCase(), 'ability');
          await sleep(ENEMY_ABILITY_LABEL_MS);
          setPendingCharge(createSiegeCharge(
            e.x, e.y, decision.dir, decision.pathTiles,
            { x: decision.destinationX, y: decision.destinationY },
            e.id, turn
          ));
          flashAttackFeedback(decision.destinationX, decision.destinationY, 'CHARGE INCOMING', 'ability');
          work = work.map((u) => (u.id === e.id ? { ...u, ap: Math.max(0, u.ap - ability.apCost), cooldowns: { ...u.cooldowns, [ability.id]: ability.cooldown } } : u));
          setUnits([...work]); await sleep(ENEMY_ATTACK_MS);
          if (hasStatus(work.find((u) => u.id === e.id), STATUS_TYPES.BURNING)) { const burn = applyEnemyBurning(work, e.id); work = burn.work; setUnits([...work]); if (burn.died) { await sleep(ENEMY_STEP_MS); break; } }
        } else if (decision.type === 'bulldoze' || decision.type === 'hardlight_cover') {
          { const ab = getEnemyAbility(decision.abilityId); if (ab) showActionBubble(e.id, ab.name.toUpperCase() + '!'); }
          const r = await enemyAbilityExec.run(workGrid, work, e, decision);
          workGrid = r.workGrid; work = r.work; setUnits([...work]);
          if (r.died) { await sleep(ENEMY_STEP_MS); break; }
        } else if (decision.type === 'come_here') {
          // COME HERE! — exact action label (spec 33). The ability name already
          // includes "!", so we don't add another one.
          { const ab = getEnemyAbility(decision.abilityId); if (ab) showActionBubble(e.id, ab.name); }
          const r = await enemyAbilityExec.run(workGrid, work, e, decision);
          workGrid = r.workGrid; work = r.work; setUnits([...work]);
          if (r.died) { await sleep(ENEMY_STEP_MS); break; }
        } else if (decision.type === 'core_discharge') {
          // The Harvester Phase 3: one-time Core Discharge — telegraphed, detonates
          // next Enemy Phase. Radius 2, 6 energy damage (Armor applies, Cover
          // ignored). Does not destroy Siege tiles.
          try {
            showActionBubble(e.id, 'CORE DISCHARGE!');
            flashAttackFeedback(e.x, e.y, 'CORE DISCHARGE', 'ability');
            await sleep(ENEMY_ABILITY_LABEL_MS);
            setPendingCoreDischarge(decision.discharge);
            flashAttackFeedback(e.x, e.y, 'DISCHARGE INCOMING', 'ability');
            setHarvesterState((prev) => markCoreDischargeUsed(prev));
            work = work.map((u) => (u.id === e.id ? { ...u, ap: 0 } : u));
            setUnits([...work]); await sleep(ENEMY_ATTACK_MS);
            if (hasStatus(work.find((u) => u.id === e.id), STATUS_TYPES.BURNING)) { const burn = applyEnemyBurning(work, e.id); work = burn.work; setUnits([...work]); if (burn.died) { await sleep(ENEMY_STEP_MS); break; } }
          } catch (err) {
            console.error('[Enemy Phase] Core Discharge execution failed:', err);
            setPendingCoreDischarge(null);
          }
        }
      }
    }

    // Phase 3 Core Overload: generate 2 new Overloaded tiles near the Warden.
    if (isBossMission && shouldGenerateOverloadHazards(bossStateRef.current)) {
      const boss = work.find((u) => u.isBoss && u.alive);
      if (boss) {
        const newHazards = createOverloadHazards(grid, work, boss, [], turn);
        if (newHazards.length > 0) {
          setOverloadHazards(newHazards);
          for (const h of newHazards) flashAttackFeedback(h.x, h.y, 'OVERLOAD', 'ability');
          await sleep(ENEMY_STEP_MS);
        }
      }
    }

    // The Harvester Phase 3 (CORE FAILURE): generate recurring Meltdown Zones.
    // 2-3 environmental hazard tiles near the Harvester that detonate next Enemy
    // Phase. Telegraphed for one full Player Phase (Part 13).
    if (isHarvesterMission) {
      const harvester = work.find((u) => u.isBoss && u.alive && u.archetype === 'harvester');
      if (harvester && shouldGenerateMeltdownZones(harvesterStateRef.current, true)) {
        try {
          // Gather all pending hazard tile keys for combined safety (Part 35).
          // pendingHazardKeys MUST be a Set — passing a number here was the
          // Phase 3 crash (isMeltdownPlacementSafe iterates it with for...of).
          const pendingHazardKeys = new Set();
          if (pendingTremorRef.current) for (const k of getTremorTileKeys(pendingTremorRef.current)) pendingHazardKeys.add(k);
          if (pendingBeamRef.current) for (const k of getBeamTileKeys(pendingBeamRef.current)) pendingHazardKeys.add(k);
          if (pendingChargeRef.current) for (const k of getChargePathKeys(pendingChargeRef.current)) pendingHazardKeys.add(k);
          if (pendingCoreDischargeRef.current) for (const k of getCoreDischargeTileKeys(pendingCoreDischargeRef.current)) pendingHazardKeys.add(k);
          const newZones = createMeltdownZones(workGrid, work, harvester, [], pendingHazardKeys, turn);
          if (newZones.length > 0) {
            setPendingMeltdown(newZones);
            for (const z of newZones) flashAttackFeedback(z.x, z.y, 'MELTDOWN', 'ability');
            await sleep(ENEMY_STEP_MS);
          }
        } catch (err) {
          console.error('[Enemy Phase] Meltdown Zone generation failed:', err);
          setPendingMeltdown(null);
        }
      }
    }

    // Status expiry: tick statuses that end with the enemy phase (Suppressed).
    work = work.map((u) => tickStatuses(u, 'end_enemy_phase'));

    const playersAlive = work.some((u) => u.team === TEAMS.PLAYER && u.alive);
    if (!playersAlive) {
      setUnits([...work]);
      setPhase('player');
      return;
    }

    // --- End of round: reinforcement check ---
    {
      const rt = missionRuntimeRef.current;
      if (missionConfig && rt && rt.state === MISSION_STATES.ACTIVE &&
          !rt.standardReinforcementSpawned && !rt.reinforcementCanceled &&
          rt.reinforcementCountdown > 0 &&
          !isObjectiveSecured(missionConfig, work, civilianRef.current, deviceRef.current, extractedIdsRef.current)) {
        const newCountdown = rt.reinforcementCountdown - 1;
        if (newCountdown <= 0) {
          const cfg = getMissionMapConfig(missionId);
          if (cfg) {
            const wave = getReinforcementWaveForMission(missionConfig);
            const newEnemies = spawnReinforcementWave(
              grid, work, wave, cfg.reinforcementSpawns,
              { civilian: civilianRef.current, device: deviceRef.current }
            );
            if (newEnemies.length > 0) {
              work = [...work, ...newEnemies];
              setUnits([...work]);
              flashAttackFeedback(4, 0, 'REINFORCEMENTS!', 'ability');
            }
          }
          setMissionRuntime((prev) => ({
            ...prev, reinforcementCountdown: 0, standardReinforcementSpawned: true,
          }));
        } else {
          setMissionRuntime((prev) => ({ ...prev, reinforcementCountdown: newCountdown }));
        }
      }
    }

    // New player phase: expire unused Overwatch, tick bleed-out, restore AP.
    work = expireReactions(work, TEAMS.PLAYER); workGrid = clearSmoke(workGrid); setGrid(workGrid);
    work = work.map((u) => {
      if (u.team === TEAMS.PLAYER && u.downed) {
        const r = tickBleedOut(u);
        if (r.died) flashAttackFeedback(u.x, u.y, 'BLEED OUT', 'status');
        return r.unit;
      }
      return u;
    });
    work = work.map((u) => {
      if (u.team !== TEAMS.PLAYER || !u.alive) return u;
      const nu = resetSkillStateForPlayerPhase({ ...u, ap: u.downed ? 0 : u.maxAp, recovering: false, momentumUsed: false });
      if (nu.coordinatedStrike) { const c = { ...nu }; delete c.coordinatedStrike; return c; }
      return nu;
    });
    work = work.map((u) => {
      if (u.team !== TEAMS.PLAYER || !u.alive || !u.cooldowns) return u;
      const cd = {};
      let changed = false;
      for (const [k, v] of Object.entries(u.cooldowns)) {
        const nv = Math.max(0, v - 1);
        if (nv !== v) changed = true;
        cd[k] = nv;
      }
      return changed ? { ...u, cooldowns: cd } : u;
    });
    setUnits([...work]);
    setTurn((t) => t + 1);
    setPhase('player');
  };
}