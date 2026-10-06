// Per-unit preview badges (attack + abilities + grenade blast + movement
// preview). Extracted from Battle.jsx so that file stays under the size limit.
// Pure function returning a Map<unitId, { label, tone }>).
import { computeDamage } from './combat';
import { getBreachOutcome, getHealOutcome, getUnitAbility, TARGET_TYPES } from './abilities';
import { getEmergencyHealBonus, getLifelineReviveBonus } from './skillEffects';

export function computeUnitBadges({
  selectedUnit, attackMode, activeAbility,
  validTargets, abilityEnemyTargets, abilityAllyTargets,
  blastPreview, grid, movePreview, previewData,
}) {
  const m = new Map();
  if (!selectedUnit) return m;
  if (attackMode) {
    for (const t of validTargets) {
      const o = computeDamage(selectedUnit, t, grid);
      const hasShields = o.shieldAbsorbed > 0 || o.coreShieldAbsorbed > 0;
      const tone = hasShields ? 'shield' : (o.state === 'flanked' ? 'flank' : o.state === 'covered' ? 'cover' : 'expose');
      const label = o.killed
        ? `KILL ${o.hpDamage}`
        : hasShields && o.hpDamage === 0 ? 'SHIELD' : `${o.hpDamage < o.finalDamage ? o.hpDamage : o.finalDamage}`;
      m.set(t.id, { label, tone });
    }
  } else if (activeAbility) {
    const a = activeAbility;
    if (a.targetType === TARGET_TYPES.ENEMY) {
      for (const t of abilityEnemyTargets) {
        if (a.id === 'breach') {
          const o = getBreachOutcome(t, getUnitAbility(selectedUnit, 'breach').damage);
          m.set(t.id, { label: o.killed ? `KILL ${o.damage}` : `${o.damage}`, tone: 'flank' });
        } else if (a.id === 'suppress') {
          m.set(t.id, { label: 'SUPP', tone: 'suppress' });
        } else if (a.id === 'line_up') {
          // Line Up: cover-bypass shot. Show damage with ignoreCover applied.
          const o = computeDamage(selectedUnit, t, grid, { ignoreCover: true });
          m.set(t.id, { label: o.killed ? `KILL ${o.finalDamage}` : `${o.finalDamage}`, tone: 'flank' });
        }
      }
    } else if (a.targetType === TARGET_TYPES.ALLY) {
      for (const t of abilityAllyTargets) {
        if (a.id === 'heal') {
          const healAbility = getUnitAbility(selectedUnit, 'heal');
          const emergencyBonus = getEmergencyHealBonus(selectedUnit, t);
          // Lifeline: +2 HP when healing a Downed ally (revive).
          const lifelineBonus = t.downed ? getLifelineReviveBonus(selectedUnit) : 0;
          const rawHeal = (healAbility.healing || 0) + emergencyBonus + lifelineBonus;
          const o = getHealOutcome(t, rawHeal);
          m.set(t.id, { label: t.downed ? `REVIVE ${o.heal}` : `+${o.heal}`, tone: 'heal' });
        } else if (a.id === 'field_medkit') {
          const o = getHealOutcome(t, 3);
          m.set(t.id, { label: t.downed ? `REVIVE ${o.heal}` : `+${o.heal}`, tone: 'heal' });
        } else if (a.id === 'command') {
          m.set(t.id, { label: '+1 AP', tone: 'command' });
        }
      }
    }
  }
  // Movement preview target badges: hypothetical combat info from the preview
  // destination. Uses the same computeDamage as real attacks.
  if (movePreview && previewData && !attackMode && !activeAbility) {
    for (const t of previewData.targetInfos) {
      const tone = t.state === 'flanked' ? 'flank' : t.state === 'covered' ? 'cover' : t.state === 'blocked' ? 'blocked' : 'expose';
      const label = t.state === 'blocked' ? 'BLOCKED' : t.killed ? `KILL ${t.damage}` : `${t.damage}`;
      m.set(t.unitId, { label, tone });
    }
  }
  // Grenade blast preview: tag every affected enemy with its exact damage
  // (3 + Marked if applicable) so the player sees the real number.
  if (blastPreview) {
    for (const id of blastPreview.enemyIds) {
      const r = blastPreview.perTarget ? blastPreview.perTarget.get(id) : null;
      const dmg = r ? r.finalDamage : 3;
      const killed = r ? r.killed : false;
      m.set(id, { label: killed ? `KILL ${dmg}` : `${dmg}`, tone: 'grenade' });
    }
  }
  return m;
}