// Grenade blast resolution, extracted from Battle.jsx so the page stays under
// the size limit and the same logic serves both the fast (blast-preview) flow
// and the Detailed Targeting Info FIRE commit. Uses the real combat calculators
// (resolveFlatDamage / resolveTargetDamage / damageCoverTile) — no duplication.
import { getBlastTiles, getGrenadeAffectedEnemies } from './abilities';
import { resolveFlatDamage } from './combat';
import { resolveTargetDamage } from './enemyPhaseHelpers';
import { consumeMarked } from './statuses';
import { damageCoverTile, countNewlyDestroyedCover } from './cover';
import { applyArmorShred, getAttackArmorShred } from './armorShred';

// Compute the deterministic blast data (keys, affected units, per-target
// damage) without mutating anything. Shared by the preview and the commit.
export function computeGrenadeBlast(grid, units, caster, x, y, ability) {
  const radius = ability.areaRadius;
  const keys = new Set(getBlastTiles(grid, x, y, radius).map((t) => `${t.x},${t.y}`));
  const affected = getGrenadeAffectedEnemies(units, x, y, radius);
  const grenadeDamage = ability.damage ?? 3;
  const perTarget = new Map(affected.map((e) => [e.id, resolveFlatDamage(grenadeDamage, caster, e)]));
  return {
    keys,
    enemyIds: new Set(affected.map((e) => e.id)),
    affected,
    perTarget,
    grenadeDamage,
    terrainDamage: ability.terrainDamage ?? 2,
    radius,
    abilityId: ability.id,
    armorShred: getAttackArmorShred(ability, null),
    cooldown: ability.cooldown || 0,
  };
}

// Apply the blast: update units + grid, fire popups, clear blast preview.
// `blast` is the data from computeGrenadeBlast. Caller has already set
// blastPreview/resolving as needed; this finishes the resolution.
export function applyGrenadeBlast({
  caster, blast, grid, setUnits, setGrid, setBlastPreview, setResolving,
  pushPopup, flashAttackFeedback, withBurning, onCoverDestroyed,
}) {
  const { keys, affected, perTarget, terrainDamage, abilityId, armorShred } = blast;
  let totalKills = 0;
  let totalEliteKills = 0;
  const targetUpdates = new Map();
  const shredMap = new Map();
  for (const e of affected) {
    const r = perTarget.get(e.id);
    const tgtResult = resolveTargetDamage(consumeMarked(e), r.finalDamage);
    let finalUnit = tgtResult.unit;
    // Armor Shred: apply after damage resolves (damage uses pre-Shred Armor).
    if (armorShred > 0 && finalUnit.alive) {
      finalUnit = applyArmorShred(finalUnit, armorShred);
      shredMap.set(e.id, armorShred);
    }
    targetUpdates.set(e.id, { ...tgtResult, unit: finalUnit });
    if (tgtResult.killed) {
      totalKills++;
      if (e.elite) totalEliteKills++;
    }
  }
  setUnits((prev) =>
    prev.map((u) => {
      if (u.id === caster.id) {
        let c = withBurning(
          { ...u, ap: Math.max(0, u.ap - 1), abilityUses: { ...u.abilityUses, [abilityId]: (u.abilityUses?.[abilityId] || 0) + 1 }, cooldowns: { ...u.cooldowns, [abilityId]: blast.cooldown }, reaction: null },
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
      if (targetUpdates.has(u.id)) return targetUpdates.get(u.id).unit;
      return u;
    })
  );
  for (const e of affected) {
    const r = perTarget.get(e.id);
    const tgtResult = targetUpdates.get(e.id);
    pushPopup(e.x, e.y, r.finalDamage, tgtResult.killed, 'damage');
    if (tgtResult.downed) flashAttackFeedback(e.x, e.y, 'DOWNED', 'status');
    if (shredMap.has(e.id)) flashAttackFeedback(e.x, e.y, `ARMOR -${armorShred}`, 'status');
  }
  if (totalKills > 0 && caster.upgrades?.level2 === 'momentum' && !caster.momentumUsed) {
    pushPopup(caster.x, caster.y, 1, false, 'ap');
  }
  // Cover-destroyed bubble. Guarded so a missing `grid` skips the bubble
  // instead of throwing before the preview/resolving cleanup below — the
  // freeze that left the explosion-area highlight stuck on screen.
  if (grid) {
    let simGrid = grid;
    for (const k of keys) {
      const [bx, by] = k.split(',').map(Number);
      simGrid = damageCoverTile(simGrid, bx, by, terrainDamage);
    }
    const destroyedCount = countNewlyDestroyedCover(grid, simGrid);
    if (destroyedCount > 0 && onCoverDestroyed) onCoverDestroyed(destroyedCount);
  }
  setGrid((prev) => {
    let g = prev;
    for (const k of keys) {
      const [bx, by] = k.split(',').map(Number);
      g = damageCoverTile(g, bx, by, terrainDamage);
    }
    return g;
  });
  setBlastPreview(null);
  setResolving(false);
}