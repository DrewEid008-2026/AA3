import { useMemo, useState, useCallback } from 'react';
import { GRID_WIDTH, GRID_HEIGHT } from '@/game/constants';
import {
  getWallChargeTiles,
  getInstaWallTiles,
  resolveWallCharge,
  resolveInstaWallCement,
} from '@/game/terrainUtility';
import { buildWallChargePreview, buildInstaWallPreview } from '@/game/attackPreview';
import { getAbilityBubbleMessage } from '@/game/actionBubbles';

// Terrain-manipulation utility hook (Wall Charge + Insta-Wall Cement).
// Owns the targeting memos, resolution functions, debug state, and debug
// tile-highlight computation so Battle.jsx stays small.
//
// The hook is called early in the component (before abilityTargetCount /
// tileHighlights) so the memos are available there. Late-bound values
// (withBurning, openAttackPreview, showActionBubble, triggerSiegeFx, etc.)
// are provided via `getLateCtx` — a lazy getter evaluated only when the
// try-functions run (at tap time, well after those values are defined).
export function useTerrainUtility({
  activeAbility,
  selectedUnit,
  phase,
  busy,
  grid,
  units,
  missionConfig,
  civilian,
  device,
  extractionZone,
  mapConfig,
  setUnits,
  TARGET_TYPES,
  getLateCtx,
}) {
  // --- Targeting memos ---

  const wallChargeTiles = useMemo(() => {
    if (!activeAbility || activeAbility.targetType !== TARGET_TYPES.WALL) return null;
    if (!selectedUnit || phase !== 'player' || busy) return null;
    return new Set(getWallChargeTiles(grid, selectedUnit).map((t) => `${t.x},${t.y}`));
  }, [activeAbility, selectedUnit, phase, busy, grid, TARGET_TYPES]);

  const instaWallTiles = useMemo(() => {
    if (!activeAbility || activeAbility.targetType !== TARGET_TYPES.GROUND) return null;
    if (!selectedUnit || phase !== 'player' || busy) return null;
    const missionContext = {
      missionConfig,
      civilian,
      device,
      extractionZone,
      reinforcementSpawns: mapConfig?.reinforcementSpawns,
    };
    return new Set(getInstaWallTiles(grid, units, selectedUnit, missionContext).map((t) => `${t.x},${t.y}`));
  }, [activeAbility, selectedUnit, phase, busy, grid, units, missionConfig, civilian, device, extractionZone, mapConfig, TARGET_TYPES]);

  // --- Resolution (late-bound values resolved at call time via getLateCtx) ---

  const tryWallCharge = useCallback(
    (x, y) => {
      const ctx = getLateCtx();
      if (!wallChargeTiles || !wallChargeTiles.has(`${x},${y}`)) {
        ctx.flashInvalid({ x, y });
        return;
      }
      ctx.showActionBubble(selectedUnit.id, getAbilityBubbleMessage('wall_charge'));
      const commit = () =>
        resolveWallCharge({
          grid,
          setGrid: ctx.setGrid,
          caster: selectedUnit,
          x,
          y,
          withBurning: ctx.withBurning,
          setUnits,
          setResolving: ctx.setResolving,
          setAbilityTargeting: ctx.setAbilityTargeting,
          flashAttackFeedback: ctx.flashAttackFeedback,
          wallChargeTiles,
          triggerSiegeFx: ctx.triggerSiegeFx,
        });
      if (ctx.getDetailedTargetingInfo()) {
        ctx.openAttackPreview(
          buildWallChargePreview({ grid, caster: selectedUnit, x, y, ability: activeAbility }),
          commit
        );
        return;
      }
      commit();
    },
    [wallChargeTiles, selectedUnit, grid, activeAbility, setUnits, getLateCtx]
  );

  const tryInstaWall = useCallback(
    (x, y) => {
      const ctx = getLateCtx();
      if (!instaWallTiles || !instaWallTiles.has(`${x},${y}`)) {
        ctx.flashInvalid({ x, y });
        return;
      }
      ctx.showActionBubble(selectedUnit.id, getAbilityBubbleMessage('insta_wall_cement'));
      const missionContext = {
        missionConfig,
        civilian,
        device,
        extractionZone,
        reinforcementSpawns: mapConfig?.reinforcementSpawns,
      };
      const commit = () =>
        resolveInstaWallCement({
          grid,
          setGrid: ctx.setGrid,
          caster: selectedUnit,
          x,
          y,
          withBurning: ctx.withBurning,
          setUnits,
          setResolving: ctx.setResolving,
          setAbilityTargeting: ctx.setAbilityTargeting,
          flashAttackFeedback: ctx.flashAttackFeedback,
          instaWallTiles,
        });
      if (ctx.getDetailedTargetingInfo()) {
        ctx.openAttackPreview(
          buildInstaWallPreview({ grid, units, caster: selectedUnit, x, y, ability: activeAbility, missionContext }),
          commit
        );
        return;
      }
      commit();
    },
    [instaWallTiles, selectedUnit, grid, units, missionConfig, civilian, device, extractionZone, mapConfig, activeAbility, setUnits, getLateCtx]
  );

  // --- Debug ---

  const [debugShowSiege, setDebugShowSiege] = useState(false);
  const [debugShowInstaWall, setDebugShowInstaWall] = useState(false);

  // Debug tile highlights: a Map<"x,y", highlightType> merged into the
  // Battle's tileHighlights when either debug toggle is on.
  const debugTileKeys = useMemo(() => {
    const m = new Map();
    if (debugShowSiege) {
      for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
          const t = grid[y][x];
          if (t && t.isDestructibleTile && t.currentTileState === 'intact' && t.tileDestructionClass === 'siege') {
            m.set(`${x},${y}`, 'grenade');
          }
        }
      }
    }
    if (debugShowInstaWall && selectedUnit) {
      const ctx = {
        missionConfig,
        civilian,
        device,
        extractionZone,
        reinforcementSpawns: mapConfig?.reinforcementSpawns,
      };
      for (const t of getInstaWallTiles(grid, units, selectedUnit, ctx)) {
        const k = `${t.x},${t.y}`;
        if (!m.has(k)) m.set(k, 'ally');
      }
    }
    return m;
  }, [debugShowSiege, debugShowInstaWall, grid, selectedUnit, units, missionConfig, civilian, device, extractionZone, mapConfig]);

  // Grant a terrain utility ability to the selected unit (for testing without
  // the Armory) and reset its per-mission uses.
  const debugGrant = useCallback(
    (abilityId) => {
      if (!selectedUnit) return;
      setUnits((prev) =>
        prev.map((u) => {
          if (u.id !== selectedUnit.id) return u;
          const ea = new Set(u.equipmentAbilities || []);
          ea.add(abilityId);
          return { ...u, equipmentAbilities: [...ea], abilityUses: { ...u.abilityUses, [abilityId]: 0 } };
        })
      );
    },
    [selectedUnit, setUnits]
  );

  const debugGrantWallCharge = useCallback(() => debugGrant('wall_charge'), [debugGrant]);
  const debugGrantInstaWall = useCallback(() => debugGrant('insta_wall_cement'), [debugGrant]);

  const debugRestoreUses = useCallback(() => {
    if (!selectedUnit) return;
    setUnits((prev) =>
      prev.map((u) =>
        u.id === selectedUnit.id
          ? { ...u, abilityUses: { ...u.abilityUses, wall_charge: 0, insta_wall_cement: 0 } }
          : u
      )
    );
  }, [selectedUnit, setUnits]);

  return {
    wallChargeTiles,
    instaWallTiles,
    tryWallCharge,
    tryInstaWall,
    debugShowSiege,
    setDebugShowSiege,
    debugShowInstaWall,
    setDebugShowInstaWall,
    debugGrantWallCharge,
    debugGrantInstaWall,
    debugRestoreUses,
    debugTileKeys,
  };
}