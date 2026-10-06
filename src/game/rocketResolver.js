// Launch Rocket resolution. Reuses the same combat calculators as the grenade
// resolver (resolveFlatDamage / resolveTargetDamage / damageCoverTile /
// applyArmorShred) so preview and commit match exactly.
import { getBlastTiles, getGrenadeAffectedEnemies } from './abilities';
import { resolveFlatDamage } from './combat';
import { resolveTargetDamage } from './enemyPhaseHelpers';
import { consumeMarked } from './statuses';
import { damageCoverTile, countNewlyDestroyedCover } from './cover';
import { applyArmorShred } from './armorShred';
import { getAbilityApCost } from './skillEffects';

// Compute the first-stage blast data (non-mutating). Shared by the preview and
// the commit. `ability` is the effective Launch Rocket ability (with overrides).
export function computeRocketBlast(grid, units, caster, x, y, ability) {
  const radius = ability.areaRadius;
  const keys = new Set(getBlastTiles(grid, x, y, radius).map((t) => `${t.x},${t.y}`));
  const affected = getGrenadeAffectedEnemies(units, x, y, radius);
  const rocketDamage = ability.damage ?? 3;
  const perTarget = new Map(affected.map((e) => [e.id, resolveFlatDamage(rocketDamage, caster, e)]));
  return {
    keys,
    enemyIds: new Set(affected.map((e) => e.id)),
    affected,
    perTarget,
    rocketDamage,
    terrainDamage: ability.terrainDamage ?? 4,
    radius,
    impactX: x,
    impactY: y,
    abilityId: ability.id,
    armorShred: ability.armorShred ?? 2,
    cooldown: ability.cooldown || 1,
    range: ability.range,
    apCost: getAbilityApCost(caster, ability),
  };
}

// Apply one explosion stage to a working units array + working grid. Mutates
// `work` in place. Returns { kills, eliteKills }.
function applyStage({ work, workGrid, blast, stageDamage, stageTerrain, stageShred, pushPopup, flashAttackFeedback }) {
  const { keys, radius, impactX, impactY } = blast;
  // Re-evaluate affected units against the current working state (units that
  // died in the first stage are excluded — getGrenadeAffectedEnemies filters alive).
  const affected = getGrenadeAffectedEnemies(work, impactX, impactY, radius);
  let kills = 0;
  let eliteKills = 0;
  for (const e of affected) {
    const r = resolveFlatDamage(stageDamage, null, e);
    const tgtResult = resolveTargetDamage(consumeMarked(e), r.finalDamage);
    let finalUnit = tgtResult.unit;
    if (stageShred > 0 && finalUnit.alive) {
      finalUnit = applyArmorShred(finalUnit, stageShred);
    }
    const idx = work.findIndex((u) => u.id === e.id);
    if (idx >= 0) work[idx] = finalUnit;
    if (tgtResult.killed) {
      kills++;
      if (e.elite) eliteKills++;
    }
    pushPopup(e.x, e.y, r.finalDamage, tgtResult.killed, 'damage');
    if (tgtResult.downed) flashAttackFeedback(e.x, e.y, 'DOWNED', 'status');
    if (stageShred > 0 && finalUnit.alive) flashAttackFeedback(e.x, e.y, `ARMOR -${stageShred}`, 'status');
  }
  // Terrain damage on the working grid.
  let g = workGrid;
  for (const k of keys) {
    const [bx, by] = k.split(',').map(Number);
    g = damageCoverTile(g, bx, by, stageTerrain);
  }
  return { kills, eliteKills, workGrid: g };
}

// Apply the full Rocket blast (one or two explosions). Caller has already set
// blastPreview/resolving; this finishes the resolution and clears them.
// `units` is the current units array (passed from Battle.jsx).
export function applyRocketBlast({
  caster, blast, grid, units, setUnits, setGrid, setBlastPreview, setResolving,
  pushPopup, flashAttackFeedback, withBurning, onCoverDestroyed,
}) {
  const { rocketDamage, terrainDamage, armorShred, abilityId, cooldown, apCost } = blast;
  // Working copies so the second explosion sees the updated state.
  let work = units.map((u) => ({ ...u }));
  let workGrid = grid ? grid.map((r) => (r ? r.slice() : r)) : grid;
  let totalKills = 0;
  let totalEliteKills = 0;

  // --- First explosion ---
  const stage1 = applyStage({
    work, workGrid, blast,
    stageDamage: rocketDamage, stageTerrain: terrainDamage, stageShred: armorShred,
    pushPopup, flashAttackFeedback,
  });
  workGrid = stage1.workGrid;
  totalKills += stage1.kills;
  totalEliteKills += stage1.eliteKills;

  // --- Commit: update caster (AP, uses, cooldown, kills) + final units/grid ---
  setUnits((prev) =>
    prev.map((u) => {
      if (u.id === caster.id) {
        let c = withBurning(
          { ...u, ap: Math.max(0, u.ap - apCost), abilityUses: { ...u.abilityUses, [abilityId]: (u.abilityUses?.[abilityId] || 0) + 1 }, cooldowns: { ...u.cooldowns, [abilityId]: cooldown }, reaction: null },
          u.x, u.y
        );
        if (totalKills > 0) {
          c = { ...c, missionKills: (c.missionKills || 0) + totalKills, missionEliteKills: (c.missionEliteKills || 0) + totalEliteKills };
          if (c.upgrades?.level2 === 'momentum' && !c.momentumUsed) {
            c = { ...c, ap: c.ap + 1, momentumUsed: true };
          }
        }
        return c;
      }
      // Apply the working-state update for affected units.
      const w = work.find((x) => x.id === u.id);
      return w || u;
    })
  );

  // Cover-destroyed bubble (from both stages combined).
  if (grid) {
    const destroyedCount = countNewlyDestroyedCover(grid, workGrid);
    if (destroyedCount > 0 && onCoverDestroyed) onCoverDestroyed(destroyedCount);
  }
  setGrid(workGrid);
  setBlastPreview(null);
  setResolving(false);
}