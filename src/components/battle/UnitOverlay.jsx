import React, { forwardRef } from 'react';
import { GRID_WIDTH, GRID_HEIGHT } from '@/game/constants';
import UnitToken from './UnitToken';

// Units render in an absolutely-positioned overlay above the grid so movement
// can be animated independently of tile cells. Position is percentage-based
// (no measurement needed) and stays correct across viewport sizes.
const UnitOverlay = forwardRef(function UnitOverlay(
  { unit, selected, spent, targeting, badge, hitFlash, reactionFlash, escorting, extracted, threat, bossPhase, onTap },
  ref
) {
  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        left: `${((unit.x + 0.5) / GRID_WIDTH) * 100}%`,
        top: `${((unit.y + 0.5) / GRID_HEIGHT) * 100}%`,
        width: `${100 / GRID_WIDTH}%`,
        height: `${100 / GRID_HEIGHT}%`,
        transform: 'translate(-50%, -50%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <UnitToken
        unit={unit}
        selected={selected}
        spent={spent}
        targeting={targeting}
        badge={badge}
        hitFlash={hitFlash}
        reactionFlash={reactionFlash}
        escorting={escorting}
        extracted={extracted}
        threat={threat}
        bossPhase={bossPhase}
        onTap={onTap}
      />
    </div>
  );
});

export default UnitOverlay;