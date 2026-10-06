// Execution handlers for Chapter 2 enemy special abilities: Bastion Mech
// BULLDOZE and Alien Fabricator FIELD REPAIR + HARDLIGHT COVER. Extracted from
// Battle.jsx to keep the page file manageable. The factory receives the
// shared battle context (state setters, refs, timing constants, the segment
// processor); each handler mutates the working state and returns
// { workGrid, work, died } so the enemy-phase loop can cancel queued actions
// on death. The Burning hook is applied at the end of each handler.
import { destroyLightCoverTile } from './bastion';
import { placeHardlightCover } from './fabricator';
import { resolveFlatDamage } from './combat';
import { resolveTargetDamage } from './enemyPhaseHelpers';
import {
  consumeMarked, applyStatus, applyActionCompletion, STATUS_TYPES,
} from './statuses';
import { getEnemyAbility } from './enemyAbilities';
import { animateSegment } from './battleAnimation';
import { computeComeHerePull } from './comeHereResolver';

export function createEnemyAbilityExecutor(ctx) {
  const {
    setUnits, setGrid, flashAttackFeedback, flashStatusLabel, pushPopup,
    setHitFlashId, hitTimer, sleep, processEnemySegment, tokenRefs,
    HIT_FLASH_MS, ENEMY_MOVE_PER_SEG, ENEMY_ABILITY_LABEL_MS,
    ENEMY_ATTACK_MS, ENEMY_STEP_MS,
  } = ctx;

  // Shared enemy Burning hook (same shape as the former inline helper).
  function applyEnemyBurning(work, enemyId) {
    const e = work.find((u) => u.id === enemyId);
    if (!e) return { work, died: false };
    const burn = applyActionCompletion(e);
    if (burn.damage <= 0) return { work, died: false };
    const next = work.map((u) => (u.id === enemyId ? burn.unit : u));
    pushPopup(e.x, e.y, burn.damage, burn.died, 'burn');
    if (burn.died) {
      setHitFlashId(enemyId);
      if (hitTimer.current) clearTimeout(hitTimer.current);
      hitTimer.current = setTimeout(() => setHitFlashId(null), HIT_FLASH_MS);
    }
    return { work: next, died: burn.died };
  }

  // BULLDOZE: straight-line charge destroying light cover; ram an adjacent
  // soldier for 3 + Stun (armor applies, cover ignored). Triggers per-segment
  // reactions (Overwatch / mines) like a normal move.
  async function executeBulldoze(workGrid, work, e, decision) {
    const ability = getEnemyAbility(decision.abilityId);
    flashAttackFeedback(e.x, e.y, ability.name.toUpperCase(), 'ability');
    await sleep(ENEMY_ABILITY_LABEL_MS);
    const path = decision.path;
    const el = tokenRefs.current[e.id];
    let died = false;
    for (let i = 1; i < path.length && !died; i++) {
      const [px, py] = path[i - 1];
      const [nx, ny] = path[i];
      await animateSegment(el, px, py, nx, ny, ENEMY_MOVE_PER_SEG);
      workGrid = destroyLightCoverTile(workGrid, nx, ny);
      setGrid(workGrid);
      work = work.map((u) => (u.id === e.id ? { ...u, x: nx, y: ny } : u));
      setUnits([...work]);
      const seg = await processEnemySegment(workGrid, work, e.id, nx, ny, false);
      workGrid = seg.workGrid; work = seg.work; died = seg.died;
    }
    if (died) return { workGrid, work, died: true };
    // Ram an adjacent soldier.
    if (decision.targetId) {
      const target = work.find((u) => u.id === decision.targetId);
      const bastion = work.find((u) => u.id === e.id);
      if (target && bastion && target.alive && !target.downed) {
        const r = resolveFlatDamage(ability.damage, bastion, target, { ignoreSuppressed: true });
        const tgtResult = resolveTargetDamage(consumeMarked(target), r.finalDamage);
        let tgtFinal = tgtResult.unit;
        if (tgtResult.downed) tgtFinal = { ...tgtFinal, missionDowned: true };
        if (tgtFinal.alive && !tgtFinal.downed) {
          tgtFinal = applyStatus(tgtFinal, STATUS_TYPES.STUNNED, { source: e.id, turnsRemaining: 1 });
        }
        work = work.map((u) => (u.id === target.id ? tgtFinal : u));
        setUnits([...work]);
        pushPopup(target.x, target.y, r.finalDamage, tgtResult.killed, 'damage');
        if (tgtResult.downed) flashAttackFeedback(target.x, target.y, 'DOWNED', 'status');
        else flashStatusLabel(target.x, target.y, 'STUNNED', 'status');
        setHitFlashId(target.id);
        if (hitTimer.current) clearTimeout(hitTimer.current);
        hitTimer.current = setTimeout(() => setHitFlashId(null), HIT_FLASH_MS);
        await sleep(ENEMY_ATTACK_MS);
      }
    }
    work = work.map((u) => (u.id === e.id ? { ...u, ap: Math.max(0, u.ap - ability.apCost), cooldowns: { ...u.cooldowns, [ability.id]: ability.cooldown } } : u));
    setUnits([...work]);
    await sleep(ENEMY_STEP_MS);
    const burn = applyEnemyBurning(work, e.id);
    return { workGrid, work: burn.work, died: burn.died };
  }

  // HARDLIGHT COVER: deploy alien directional cover on an adjacent tile.
  async function executeHardlightCover(workGrid, work, e, decision) {
    const ability = getEnemyAbility(decision.abilityId);
    flashAttackFeedback(e.x, e.y, ability.name.toUpperCase(), 'ability');
    await sleep(ENEMY_ABILITY_LABEL_MS);
    const hp = ability.barricadeHp ?? 5;
    workGrid = placeHardlightCover(workGrid, decision.x, decision.y, decision.dir, hp);
    setGrid(workGrid);
    const barriers = [...(e.hardlightBarriers || []), { x: decision.x, y: decision.y, dir: decision.dir }];
    work = work.map((u) => (u.id === e.id ? { ...u, ap: Math.max(0, u.ap - ability.apCost), cooldowns: { ...u.cooldowns, [ability.id]: ability.cooldown }, hardlightBarriers: barriers } : u));
    setUnits([...work]);
    flashStatusLabel(decision.x, decision.y, 'HARDLIGHT', 'status');
    await sleep(ENEMY_ATTACK_MS);
    const burn = applyEnemyBurning(work, e.id);
    return { workGrid, work: burn.work, died: burn.died };
  }

  // FIELD REPAIR: restore HP to a damaged mechanical ally (Bastion).
  async function executeFieldRepair(work, e, decision) {
    const ability = getEnemyAbility(decision.abilityId);
    const target = work.find((u) => u.id === decision.targetId);
    flashAttackFeedback(e.x, e.y, ability.name.toUpperCase(), 'ability');
    await sleep(ENEMY_ABILITY_LABEL_MS);
    const heal = ability.healing || 4;
    if (target && target.alive) {
      work = work.map((u) => {
        if (u.id === e.id) return { ...u, ap: Math.max(0, u.ap - ability.apCost), cooldowns: { ...u.cooldowns, [ability.id]: ability.cooldown } };
        if (u.id === target.id) return { ...u, hp: Math.min(u.maxHp, u.hp + heal) };
        return u;
      });
      setUnits([...work]);
      flashStatusLabel(target.x, target.y, `+${heal} HP`, 'status');
    } else {
      work = work.map((u) => (u.id === e.id ? { ...u, ap: Math.max(0, u.ap - ability.apCost), cooldowns: { ...u.cooldowns, [ability.id]: ability.cooldown } } : u));
      setUnits([...work]);
    }
    await sleep(ENEMY_ATTACK_MS);
    const burn = applyEnemyBurning(work, e.id);
    return { work: burn.work, died: burn.died };
  }

  // COME HERE! (Dislocator): deal 3 damage, then pull the target tile-by-tile
  // toward the Dislocator. Forced movement triggers mines (with Friendly Mines
  // check) but NOT Overwatch (spec 18). Validation happens before any
  // AP/cooldown/damage is spent (spec 13). If the damage downs/kills the target,
  // the pull is aborted (spec 14-15).
  async function executeComeHere(workGrid, work, e, decision) {
    const ability = getEnemyAbility(decision.abilityId);
    const target = work.find((u) => u.id === decision.targetId);
    if (!target || !target.alive || target.downed) {
      return { workGrid, work, died: false }; // invalid — no cost (spec 13)
    }

    // Re-validate the pull path (state may have changed since AI decision).
    const pull = computeComeHerePull(workGrid, work, e, target);
    if (!pull.valid) {
      return { workGrid, work, died: false }; // invalid — no cost (spec 13)
    }

    flashAttackFeedback(e.x, e.y, ability.name, 'ability');
    await sleep(ENEMY_ABILITY_LABEL_MS);

    // Step 2: Deal 3 damage via normal damage pipeline (spec 6).
    const r = resolveFlatDamage(ability.damage, e, target, { ignoreSuppressed: true });
    const tgtResult = resolveTargetDamage(consumeMarked(target), r.finalDamage);
    let tgtFinal = tgtResult.unit;
    if (tgtResult.downed) tgtFinal = { ...tgtFinal, missionDowned: true };

    work = work.map((u) => (u.id === target.id ? tgtFinal : u));
    setUnits([...work]);
    pushPopup(target.x, target.y, r.finalDamage, tgtResult.killed, 'damage');
    if (tgtResult.downed) flashAttackFeedback(target.x, target.y, 'DOWNED', 'status');
    setHitFlashId(target.id);
    if (hitTimer.current) clearTimeout(hitTimer.current);
    hitTimer.current = setTimeout(() => setHitFlashId(null), HIT_FLASH_MS);
    await sleep(ENEMY_ATTACK_MS);

    // Step 3: If target remains a valid movable unit, pull tile-by-tile (spec 6-8).
    // Forced movement triggers tile-entry events (mines) but NOT Overwatch (spec 18).
    let died = tgtResult.killed || tgtResult.downed;
    if (!died && pull.tilesMoved > 0) {
      const path = pull.path;
      const el = tokenRefs.current[target.id];
      for (let i = 1; i < path.length && !died; i++) {
        const [px, py] = path[i - 1];
        const [nx, ny] = path[i];
        await animateSegment(el, px, py, nx, ny, ENEMY_MOVE_PER_SEG);
        work = work.map((u) => (u.id === target.id ? { ...u, x: nx, y: ny } : u));
        setUnits([...work]);
        // Tile-entry events: mines only, no Overwatch (spec 9, 18, 19).
        // skipReactions=true ensures forced movement doesn't trigger Overwatch.
        const seg = await processEnemySegment(workGrid, work, target.id, nx, ny, false, true);
        workGrid = seg.workGrid; work = seg.work; died = seg.died;
      }
    }

    // Spend AP and set cooldown (only after successful execution).
    work = work.map((u) => (u.id === e.id ? {
      ...u,
      ap: Math.max(0, u.ap - ability.apCost),
      cooldowns: { ...u.cooldowns, [ability.id]: ability.cooldown },
    } : u));
    setUnits([...work]);
    await sleep(ENEMY_STEP_MS);

    const burn = applyEnemyBurning(work, e.id);
    return { workGrid, work: burn.work, died: burn.died };
  }

  // Dispatch a special-ability decision. Returns
  // { workGrid, work, died, handled }. `handled` is true for bulldoze /
  // hardlight_cover / field_repair / come_here; false otherwise (caller falls through).
  async function run(workGrid, work, e, decision) {
    if (decision.type === 'bulldoze') {
      const r = await executeBulldoze(workGrid, work, e, decision);
      return { ...r, handled: true };
    }
    if (decision.type === 'hardlight_cover') {
      const r = await executeHardlightCover(workGrid, work, e, decision);
      return { ...r, handled: true };
    }
    if (decision.type === 'ability' && decision.abilityId === 'field_repair') {
      const r = await executeFieldRepair(work, e, decision);
      return { workGrid, ...r, handled: true };
    }
    if (decision.type === 'come_here') {
      const r = await executeComeHere(workGrid, work, e, decision);
      return { ...r, handled: true };
    }
    return { workGrid, work, died: false, handled: false };
  }

  return { run, applyEnemyBurning };
}