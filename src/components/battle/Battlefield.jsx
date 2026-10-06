import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GRID_WIDTH, GRID_HEIGHT } from '@/game/constants';
import TutorialHighlightLayer from '@/components/tutorial/TutorialHighlightLayer';
import { resolveHighlights } from '@/game/tutorial/tutorialHighlights';
import Tile from './Tile';
import UnitOverlay from './UnitOverlay';
import CivilianToken from './CivilianToken';
import DeviceToken from './DeviceToken';
import MovePreviewOverlay from './MovePreviewOverlay';
import MineToken from './MineToken';
import BarricadeOrientationPicker from './BarricadeOrientationPicker';
import AttackEffects from './AttackEffects';
import TacticalLensOverlay from './TacticalLensOverlay';
import InspectionCard from './InspectionCard';
import PlasmaStrikeOverlay from './PlasmaStrikeOverlay';
import RelayToken from './RelayToken';
import EnergyConduitOverlay from './EnergyConduitOverlay';
import BossShieldBar from './BossShieldBar';
import BeamSweepOverlay from './BeamSweepOverlay';
import OverloadOverlay from './OverloadOverlay';
import TremorSlamOverlay from './TremorSlamOverlay';
import ExcavationBeamOverlay from './ExcavationBeamOverlay';
import SiegeChargeOverlay from './SiegeChargeOverlay';
import MeltdownZoneOverlay from './MeltdownZoneOverlay';
import CoreDischargeOverlay from './CoreDischargeOverlay';
import ActionBubbleOverlay from './ActionBubbleOverlay';
import SiegeDestructionOverlay from './SiegeDestructionOverlay';
import TerrainEdgeOverlay from './TerrainEdgeOverlay';
import { getBeamSweepTileKeys } from '@/game/beamSweep';
import { getOverloadTileKeys } from '@/game/overloadHazard';

// Pure presentation. Grid is the terrain/cover layer; units render in an overlay
// above it so movement can animate independently of tile cells. Mission objects
// (extraction zone, device, civilian) render between terrain and units.
export default function Battlefield({
  grid,
  units,
  selectedUnitId,
  tileHighlights,
  invalidTile,
  attackFeedback,
  damagePopups,
  hitFlashId,
  reactionFlashId,
  unitBadges,
  extractionZone,
  civilian,
  device,
  extractedIds,
  movePreview,
  previewData,
  mines,
  plasmaStrikes,
  barricadePending,
  activeShot,
  lensActive,
  lensShowCover,
  lensShowThreat,
  lensThreatTiles,
  lensInspectedRangeTiles,
  lensLinesOfFire,
  lensInspectedId,
  lensInspection,
  missionType,
  reinforcementSpawns,
  reinforcementCountdown,
  reinforcementCanceled,
  standardReinforcementSpawned,
  eliteActive,
  isBossMission,
  bossUnits,
  beamSweeps,
  overloadHazards,
  pendingTremor,
  pendingBeam,
  pendingCharge,
  pendingMeltdown,
  pendingCoreDischarge,
  bossPhase,
  onClearInspection,
  onBarricadeOrientation,
  onCancelBarricade,
  onTileTap,
  onUnitTap,
  tokenRefs,
  actionBubbles,
  siegeDestructionFx,
  tutorial,
  edges,
  debug,
  selectedEdgeId,
  onSelectEdge,
}) {
  const highlights = tileHighlights || new Map();
  const selectedUnit = units.find((u) => u.id === selectedUnitId) || null;
  const selPos = selectedUnit ? { x: selectedUnit.x, y: selectedUnit.y } : null;

  const tutorialHighlights = useMemo(
    () => (tutorial?.active && tutorial?.currentStep ? resolveHighlights(tutorial.currentStep) : []),
    [tutorial?.active, tutorial?.currentStep]
  );

  // Compute Beam Sweep warning tile set for the Tactical Lens overlay.
  const beamSweepTiles = beamSweeps && beamSweeps.length > 0
    ? new Set(beamSweeps.flatMap((s) => Array.from(getBeamSweepTileKeys(s))))
    : null;
  const overloadTiles = overloadHazards && overloadHazards.length > 0
    ? getOverloadTileKeys(overloadHazards)
    : null;

  const tileCenter = (x, y) => ({
    left: `${((x + 0.5) / GRID_WIDTH) * 100}%`,
    top: `${((y + 0.5) / GRID_HEIGHT) * 100}%`,
  });

  return (
    <div className="w-full h-full flex items-center justify-center">
      <div
        className="relative grid h-full aspect-[9/14] max-w-full"
        style={{
          gridTemplateColumns: `repeat(${GRID_WIDTH}, 1fr)`,
          gridTemplateRows: `repeat(${GRID_HEIGHT}, 1fr)`,
        }}
      >
        {grid.map((row) =>
          row.map((tile) => {
            const k = `${tile.x},${tile.y}`;
            return (
              <Tile
                key={k}
                tile={tile}
                highlight={highlights.get(k) || null}
                isSelectedTile={!!(selPos && selPos.x === tile.x && selPos.y === tile.y)}
                isInvalid={!!(invalidTile && invalidTile.x === tile.x && invalidTile.y === tile.y)}
                coverEmphasis={lensActive && lensShowCover}
                onTileTap={onTileTap}
              />
            );
          })
        )}

        {/* Edge-based terrain & walls overlay (Implementation 3.6.1) */}
        <TerrainEdgeOverlay
          edges={edges || grid?.edges}
          debug={debug}
          selectedEdgeId={selectedEdgeId}
          onSelectEdge={onSelectEdge}
        />

        {/* Extraction zone overlay (green tiles) */}
        {extractionZone && extractionZone.length > 0 && (
          <div className="absolute inset-0 pointer-events-none z-[5]">
            {extractionZone.map((t) => (
              <div
                key={`ext_${t.x}_${t.y}`}
                className="absolute"
                style={{
                  ...tileCenter(t.x, t.y),
                  width: `${100 / GRID_WIDTH}%`,
                  height: `${100 / GRID_HEIGHT}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <div className="w-full h-full border-2 border-emerald-400/50 bg-emerald-500/10 rounded-sm" />
              </div>
            ))}
          </div>
        )}

        {/* Movement preview overlay (path, destination, ghost, range, cover) */}
        <MovePreviewOverlay movePreview={movePreview} previewData={previewData} />

        {/* Weapon-shot presentation (muzzle flash, tracer/beam, impact) */}
        <AttackEffects activeShot={activeShot} />

        {/* Tactical Lens information overlay (read-only) */}
        {lensActive && (
          <TacticalLensOverlay
            threatTiles={lensThreatTiles}
            showThreat={lensShowThreat}
            inspectedRangeTiles={lensInspectedRangeTiles}
            linesOfFire={lensLinesOfFire}
            extractionZone={extractionZone}
            civilian={civilian}
            device={device}
            missionType={missionType}
            reinforcementSpawns={reinforcementSpawns}
            reinforcementCountdown={reinforcementCountdown}
            reinforcementCanceled={reinforcementCanceled}
            standardReinforcementSpawned={standardReinforcementSpawned}
            eliteActive={eliteActive}
            lensInspectedId={lensInspectedId}
            units={units}
            beamSweepTiles={beamSweepTiles}
            overloadTiles={overloadTiles}
          />
        )}

        {/* Inspection card (unit or terrain) while the Lens is active */}
        {lensActive && (
          <InspectionCard inspection={lensInspection} onClose={onClearInspection} />
        )}

        {/* Shock Mine markers */}
        {mines && mines.map((mine) => (
          <MineToken key={mine.id} mine={mine} />
        ))}

        {/* Pending Plasma Strike hazard areas */}
        <PlasmaStrikeOverlay plasmaStrikes={plasmaStrikes} />

        {/* Pending Beam Sweep warning lane (visible without Tactical Lens) */}
        <BeamSweepOverlay beamSweeps={beamSweeps} />

        {/* Pending Overload hazard tiles (Phase 3, visible without Lens) */}
        <OverloadOverlay hazards={overloadHazards} />

        {/* Harvester hazard warnings (Tremor Slam + Excavation Beam + Siege Charge) */}
        <TremorSlamOverlay pendingTremor={pendingTremor} />
        <ExcavationBeamOverlay pendingBeam={pendingBeam} />
        <SiegeChargeOverlay pendingCharge={pendingCharge} />
        <MeltdownZoneOverlay pendingMeltdown={pendingMeltdown} />
        <CoreDischargeOverlay pendingCoreDischarge={pendingCoreDischarge} />

        {/* Barricade orientation picker (after tile selection) */}
        {barricadePending && (
          <BarricadeOrientationPicker
            tile={barricadePending}
            onPick={onBarricadeOrientation}
            onCancel={onCancelBarricade}
          />
        )}

        {/* Mission objects (device, civilian) — below units */}
        <div className="absolute inset-0 pointer-events-none z-[8]">
          <DeviceToken device={device} />
          <CivilianToken civilian={civilian} />
        </div>

        {/* Boss mission: Energy conduits + Power Relay tokens + Core Shield */}
        {isBossMission && bossUnits && (
          <>
            <EnergyConduitOverlay
              relays={bossUnits.relays}
              warden={bossUnits.warden}
            />
            {bossUnits.relays.map((relay) => (
              <RelayToken key={relay.bossObjectId || relay.id} relay={relay} />
            ))}
            <BossShieldBar warden={bossUnits.warden} bossPhase={bossPhase} />
          </>
        )}

        {/* Units overlay (pointer-events none except on tokens themselves) */}
        <div className="absolute inset-0 pointer-events-none z-10">
          {units.filter((u) => u.alive && !u.isBossObject).map((u) => {
            const badge = unitBadges ? unitBadges.get(u.id) : null;
            return (
              <UnitOverlay
                key={u.id}
                ref={(el) => {
                  tokenRefs.current[u.id] = el;
                }}
                unit={u}
                selected={u.id === selectedUnitId}
                spent={u.team === 'player' && u.ap <= 0}
                targeting={!!badge}
                badge={badge}
                hitFlash={hitFlashId === u.id}
                reactionFlash={reactionFlashId === u.id}
                escorting={!!(civilian && civilian.escortId === u.id)}
                extracted={!!(extractedIds && extractedIds.has(u.id))}
                threat={!!(previewData && previewData.threatIds.has(u.id))}
                bossPhase={u.isBoss ? bossPhase : null}
                onTap={onUnitTap}
              />
            );
          })}
        </div>

        {/* Action text bubbles above acting units */}
        <ActionBubbleOverlay units={units} actionBubbles={actionBubbles} />

        {/* Destructible map tile destruction visual feedback */}
        <SiegeDestructionOverlay fx={siegeDestructionFx} />

        {/* Invalid-target / ability feedback label (positioned above the tile) */}
        {attackFeedback && (
          <div
            className="absolute pointer-events-none z-40"
            style={{ ...tileCenter(attackFeedback.x, attackFeedback.y) }}
          >
            <span
              className={`block -translate-x-1/2 -translate-y-1/2 text-[10px] font-black tracking-wide px-2 py-0.5 rounded shadow whitespace-nowrap ${
                attackFeedback.tone === 'heal'
                  ? 'text-white bg-emerald-600/90'
                  : attackFeedback.tone === 'info'
                    ? 'text-white bg-slate-700/90'
                    : attackFeedback.tone === 'status'
                      ? 'text-white bg-violet-600/90'
                      : attackFeedback.tone === 'ability'
                        ? 'text-white bg-fuchsia-600/90'
                        : attackFeedback.tone === 'burn'
                          ? 'text-white bg-orange-600/90'
                          : 'text-white bg-rose-600/90'
              }`}
            >
              {attackFeedback.text}
            </span>
          </div>
        )}

        {/* Damage / heal / AP popups */}
        <AnimatePresence>
          {damagePopups.map((p) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 0 }}
              animate={{ opacity: 1, y: -34 }}
              exit={{ opacity: 0, y: -52 }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              className="absolute pointer-events-none z-40"
              style={tileCenter(p.x, p.y)}
            >
              <span
                className={`block -translate-x-1/2 -translate-y-1/2 text-[12px] font-black tracking-wide px-1.5 py-0.5 rounded shadow whitespace-nowrap ${
                  p.tone === 'heal'
                    ? 'text-white bg-emerald-600'
                    : p.tone === 'ap'
                      ? 'text-slate-900 bg-cyan-400'
                      : p.tone === 'burn'
                        ? 'text-white bg-orange-600'
                        : p.tone === 'shield'
                          ? 'text-cyan-100 bg-cyan-600/90'
                          : p.kill
                            ? 'text-white bg-rose-600'
                            : 'text-rose-200 bg-slate-900/85'
                }`}
              >
                {p.tone === 'heal'
                  ? `+${p.amount}`
                  : p.tone === 'ap'
                    ? `+${p.amount} AP`
                    : p.tone === 'shield'
                      ? `◈${p.amount}`
                      : p.kill
                        ? `-${p.amount} KILL`
                        : `-${p.amount}`}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>

        {tutorialHighlights.length > 0 && (
          <TutorialHighlightLayer highlights={tutorialHighlights} units={units} />
        )}
      </div>
    </div>
  );
}