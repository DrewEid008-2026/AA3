// The Harvester — Phase 1 + Phase 2 AI.
//
// Phase 1 (ARMORED HARVESTER): a SLOW ARMORED ARTILLERY PLATFORM. Stays near
// its upper platform, attacks vulnerable targets, punishes clusters with
// Tremor Slam, destroys cover/lanes with Excavation Beam, uses the Heavy
// Plasma Cannon otherwise.
//
// Phase 2 (ADVANCING HARVESTER): an AGGRESSIVE MOBILE SIEGE MACHINE (Parts
// 14-33). Scores ALL available actions — Siege Charge, Tremor Slam,
// Excavation Beam, Heavy Plasma Cannon — and picks the strongest tactical
// value rather than using a fixed priority (Part 24). Movement considers
// future Charge setup (Part 20). Downed soldiers are deprioritized (Part 41).
// Allied units are avoided in Charge paths (Part 33).
//
// Pending hazard limit (Part 25): max ONE major pending Harvester attack at a
// time. While one is pending, the Harvester may still move + Cannon but cannot
// schedule another major attack (Part 26).
//
// The AI is readable, not omniscient. It scores opportunities with simple
// heuristics and falls through to the basic attack when nothing is compelling.

import { computeReachable, getMovementRange } from './pathfinding';
import {
  attackIsValid,
  computeDamage,
  gridDistance,
  getUnitWeapon,
} from './combat';
import { hasAmmo } from './ammo';
import {
  canEnemyUseAbility,
  getEnemyAbility,
} from './enemyAbilities';
import { GRID_WIDTH, GRID_HEIGHT, TILE_TYPES } from './constants';
import { isInPhase1DefenseZone, HARVESTER_PHASES } from './harvesterState';
import { computeChargePath, CHARGE_DIRS } from './siegeCharge';
import { isSiegeDestructibleTile } from './tileDestruction';
import {
  createCoreDischarge,
  getCoreDischargeTileKeys,
  isCoreDischargeSafeWithMeltdown,
  CORE_DISCHARGE_RADIUS,
} from './coreDischarge';

function playersOf(units) {
  return units.filter((u) => u.alive && u.team === 'player' && !u.downed);
}

// --- Tremor Slam scoring ---

// Score a 3×3 Tremor Slam area centered at (cx, cy). Higher = better.
// Prefers: multiple player soldiers (cluster punishment — Part 22), engineer
// hardpoints/Barricades, valuable cover. Avoids empty zones and needless
// alien friendly-fire (Part 22).
function scoreTremorArea(grid, units, enemy, cx, cy) {
  let score = 0;
  let playerCount = 0;
  let coverCount = 0;
  let barricadeCount = 0;
  let allyCount = 0;

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) return -1; // OOB
      const tile = grid[y][x];
      if (tile.type === TILE_TYPES.BLOCKED) return -1; // overlaps a wall/siege tile

      const occ = units.find((u) => u.alive && u.team === 'player' && !u.downed && u.x === x && u.y === y);
      if (occ) {
        playerCount++;
        score += 100;
        if (occ.maxHp > 0 && occ.hp <= occ.maxHp * 0.5) score += 20; // wounded
        if (occ.archetype === 'engineer') score += 15; // hardpoint
      }

      const ally = units.find((u) => u.alive && u.team === 'enemy' && u.id !== enemy.id && u.x === x && u.y === y);
      if (ally) {
        allyCount++;
        score -= 30; // discourage destroying allies
      }

      if (tile.cover) {
        for (const d of ['n', 's', 'e', 'w']) {
          const c = tile.cover[d];
          if (c && !c.destroyed) {
            coverCount++;
            if (c.type === 'barricade') { barricadeCount++; score += 6; }
            else score += 8; // wall/reinforced
          }
        }
      }
    }
  }

  // Cluster punishment: bonus for 2+ soldiers in the zone (Part 22).
  if (playerCount >= 2) score += 40 * playerCount;
  if (playerCount >= 3) score += 30;

  // Require at least some value: a player OR significant cover (Part 23)
  if (playerCount === 0 && coverCount < 2) return -1;
  if (allyCount > 1 && playerCount === 0) return -1;

  return score;
}

// Pick the best 3×3 Tremor Slam area within range. Returns { x, y, score,
// reason, details } or null.
// Tremor Slam is disabled for the Harvester: the AI never selects it, so
// Siege Charge, Excavation Beam, Cannon and Core Discharge are used instead.
export const TREMOR_SLAM_ENABLED = true;

export function decideTremorSlamArea(grid, units, enemy) {
  if (!TREMOR_SLAM_ENABLED) return null;
  let best = null;
  let bestScore = 0;
  const maxRange = 8;
  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      const dist = Math.max(Math.abs(x - enemy.x), Math.abs(y - enemy.y));
      if (dist > maxRange || dist < 1) continue;
      const s = scoreTremorArea(grid, units, enemy, x, y);
      if (s > bestScore) {
        bestScore = s;
        const players = playersOf(units);
        const inArea = players.filter((p) => Math.max(Math.abs(p.x - x), Math.abs(p.y - y)) <= 1).length;
        best = {
          x, y, score: s,
          reason: `tremor · ${inArea} target${inArea === 1 ? '' : 's'}`,
          details: { players: inArea },
        };
      }
    }
  }
  return best;
}

// --- Excavation Beam scoring ---

// Score an Excavation Beam lane (row or column). Higher = better.
// Prefers lanes with: player soldiers, valuable cover to destroy (Part 23),
// engineer hardpoints, protected firing lines. Avoids lanes with many allies.
function scoreBeamLane(grid, units, enemy, orientation, index) {
  let score = 0;
  let playerCount = 0;
  let coverCount = 0;
  let allyCount = 0;

  const tiles = orientation === 'row'
    ? Array.from({ length: GRID_WIDTH }, (_, x) => ({ x, y: index }))
    : Array.from({ length: GRID_HEIGHT }, (_, y) => ({ x: index, y }));

  for (const t of tiles) {
    const tile = grid[t.y][t.x];
    const occ = units.find((u) => u.alive && u.team === 'player' && !u.downed && u.x === t.x && u.y === t.y);
    if (occ) {
      playerCount++;
      score += 80;
      if (occ.archetype === 'engineer') score += 15;
      if (occ.archetype === 'marksman') score += 10; // protected marksman (Part 23)
    }
    const ally = units.find((u) => u.alive && u.team === 'enemy' && u.id !== enemy.id && u.x === t.x && u.y === t.y);
    if (ally) { allyCount++; score -= 20; }
    if (tile.cover) {
      for (const d of ['n', 's', 'e', 'w']) {
        const c = tile.cover[d];
        if (c && !c.destroyed) { coverCount++; score += c.type === 'wall' ? 6 : 4; }
      }
    }
  }

  // Cover-heavy route bonus (Part 23)
  if (coverCount >= 4) score += 15;
  if (playerCount === 0 && coverCount < 3) return -1;
  if (allyCount > 2 && playerCount === 0) return -1;
  return score;
}

// Pick the best Excavation Beam lane. Returns { orientation, index, score,
// reason, details } or null.
export function decideBeamLane(grid, units, enemy) {
  let best = null;
  let bestScore = 0;
  for (let y = 0; y < GRID_HEIGHT; y++) {
    const s = scoreBeamLane(grid, units, enemy, 'row', y);
    if (s > bestScore) {
      bestScore = s;
      const count = playersOf(units).filter((p) => p.y === y).length;
      best = {
        orientation: 'row', index: y, score: s,
        reason: `beam · row ${y} · ${count} target${count === 1 ? '' : 's'}`,
        details: { players: count },
      };
    }
  }
  for (let x = 0; x < GRID_WIDTH; x++) {
    const s = scoreBeamLane(grid, units, enemy, 'column', x);
    if (s > bestScore) {
      bestScore = s;
      const count = playersOf(units).filter((p) => p.x === x).length;
      best = {
        orientation: 'column', index: x, score: s,
        reason: `beam · col ${x} · ${count} target${count === 1 ? '' : 's'}`,
        details: { players: count },
      };
    }
  }
  return best;
}

// --- Heavy Plasma Cannon scoring ---

// Best valid basic attack (Heavy Plasma Cannon) from a simulated position.
function bestAttackFrom(grid, units, sim) {
  const weapon = getUnitWeapon(sim);
  if (!weapon || sim.ap < weapon.apCost || !hasAmmo(sim)) return null;
  let best = null;
  for (const p of playersOf(units)) {
    if (!attackIsValid(grid, sim, p)) continue;
    const o = computeDamage(sim, p, grid);
    const rank = (o.state === 'flanked' ? 3 : o.state === 'exposed' ? 2 : 1) + (o.killed ? 1000 : 0);
    if (!best || rank > best.rank) best = { target: p, outcome: o, rank };
  }
  return best;
}

// Score a Cannon attack on a target. Returns { score, reason, details }.
function scoreCannonAttack(grid, units, enemy) {
  const atk = bestAttackFrom(grid, units, enemy);
  if (!atk) return null;
  const o = atk.outcome;
  let score = 50; // baseline: a valid shot is always worth something
  score += o.finalDamage * 8;
  if (o.killed) score += 200;
  if (o.state === 'flanked') score += 30;
  else if (o.state === 'exposed') score += 15;
  if (atk.target.maxHp > 0 && atk.target.hp <= atk.target.maxHp * 0.5) score += 20; // wounded
  return {
    target: atk.target,
    outcome: o,
    score,
    reason: `plasma cannon · ${o.state}${o.killed ? ' · KILL' : ''}`,
    details: { damage: o.finalDamage, killed: o.killed, state: o.state },
  };
}

// --- Movement scoring ---

// Score a candidate tile for the Harvester. Higher = better. Strongly prefers
// the Phase 1 defense zone (near the platform). Only repositions for material
// improvements (high moveMargin).
function scoreHarvesterTile(grid, units, enemy, tile) {
  const sim = { ...enemy, x: tile.x, y: tile.y, ap: enemy.ap - 1 };
  let score = 0;

  if (isInPhase1DefenseZone(tile.x, tile.y)) score += 60;
  else score -= 30;

  const atk = bestAttackFrom(grid, units, sim);
  if (atk) {
    score += 80;
    if (atk.outcome.killed) score += 500;
    if (atk.outcome.state === 'flanked') score += 40;
    else if (atk.outcome.state === 'exposed') score += 25;
  }
  return score;
}

// Score a candidate tile for Phase 2 movement. No defense zone preference —
// the Harvester is an aggressive mobile siege machine (Part 14). Prefers
// closing distance, getting LOS, threatening wounded soldiers, and setting up
// future Siege Charge lanes (Part 20).
function scorePhase2Tile(grid, units, enemy, tile) {
  const sim = { ...enemy, x: tile.x, y: tile.y, ap: enemy.ap - 1 };
  let score = 0;

  // Attack opportunity from this tile
  const atk = bestAttackFrom(grid, units, sim);
  if (atk) {
    score += 80;
    if (atk.outcome.killed) score += 500;
    if (atk.outcome.state === 'flanked') score += 40;
    else if (atk.outcome.state === 'exposed') score += 25;
  }

  // Closing distance to nearest player (Part 28)
  const players = playersOf(units);
  if (players.length > 0) {
    const nearest = Math.min(...players.map((p) => Math.max(Math.abs(p.x - tile.x), Math.abs(p.y - tile.y))));
    score += Math.max(0, 15 - nearest * 2);
  }

  // Future Siege Charge setup (Part 20): bonus for tiles with long open lanes
  // that could become strong Charge paths next turn.
  let bestLaneLen = 0;
  for (const dir of CHARGE_DIRS) {
    const pd = computeChargePath(grid, tile.x, tile.y, dir);
    if (pd.path.length > bestLaneLen) bestLaneLen = pd.path.length;
  }
  if (bestLaneLen >= 4) score += 12; // good future Charge lane

  // Avoid self-trapping (Part 29): penalize tiles with very few open neighbors.
  let openNeighbors = 0;
  for (const [dx, dy] of [[0,-1],[0,1],[-1,0],[1,0],[-1,-1],[1,-1],[-1,1],[1,1]]) {
    const nx = tile.x + dx, ny = tile.y + dy;
    if (ny < 0 || ny >= GRID_HEIGHT || nx < 0 || nx >= GRID_WIDTH) continue;
    if (grid[ny][nx].type === TILE_TYPES.BLOCKED) continue;
    const occ = units.find((u) => u.alive && u.x === nx && u.y === ny);
    if (!occ) openNeighbors++;
  }
  if (openNeighbors <= 1) score -= 25; // dead-end / trapped

  return score;
}

// --- Siege Charge scoring (Parts 16-20, 33) ---

// Score a Siege Charge path for tactical value. Higher = better.
// Considers: soldiers threatened (Part 17), Siege tiles destroyed (Part 18),
// cover/Barricades destroyed, route opened (Part 18), final Harvester position
// value (Part 19), allied units in path (Part 33 — avoid).
function scoreChargePath(grid, units, enemy, dir, pathData) {
  const { path, destination, stoppedAtIndestructible } = pathData;
  if (path.length === 0) return { score: -1, details: {} };

  let score = 0;
  let soldiersHit = 0;
  let siegeTiles = 0;
  let coverSides = 0;
  let barricadeSides = 0;
  let alliedInPath = 0;

  const keys = new Set(path.map((t) => `${t.x},${t.y}`));

  for (const t of path) {
    const tile = grid[t.y][t.x];
    if (isSiegeDestructibleTile(tile)) {
      siegeTiles++;
      score += 35;
    }
    if (tile.cover) {
      for (const d of ['n', 's', 'e', 'w']) {
        const c = tile.cover[d];
        if (c && !c.destroyed) {
          coverSides++;
          if (c.type === 'barricade') { barricadeSides++; score += 6; }
          else score += 5; // reinforced/wall
        }
      }
    }
    const occ = units.find((u) => u.alive && u.team === 'player' && !u.downed && u.x === t.x && u.y === t.y);
    if (occ) {
      soldiersHit++;
      score += 120; // downing a soldier is the highest value (Part 17)
      if (occ.maxHp > 0 && occ.hp <= occ.maxHp * 0.5) score += 30;
    }
    // Allied unit in path — discourage (Part 33)
    const ally = units.find((u) => u.alive && u.team === 'enemy' && u.id !== enemy.id && u.x === t.x && u.y === t.y);
    if (ally) { alliedInPath++; score -= 40; }
  }

  // Require at least some tactical value (Part 16): a soldier, significant
  // terrain, OR a meaningful route.
  if (soldiersHit === 0 && siegeTiles === 0 && coverSides < 2) {
    return { score: -1, details: {} };
  }

  // Route-creation value (Part 18): destroying Siege walls opens new routes.
  // Each Siege wall destroyed is already +35; add a route bonus when 2+ walls
  // fall (meaningful shortcut).
  if (siegeTiles >= 2) score += 15;
  if (siegeTiles >= 4) score += 15;

  // Final position value (Part 19)
  const players = playersOf(units);
  if (players.length > 0) {
    const nearestDist = Math.min(...players.map((p) => Math.max(Math.abs(p.x - destination.x), Math.abs(p.y - destination.y))));
    const currentDist = Math.min(...players.map((p) => Math.max(Math.abs(p.x - enemy.x), Math.abs(p.y - enemy.y))));
    if (nearestDist < currentDist) score += 15; // closing distance
    if (nearestDist <= 3) score += 20; // in pressure range

    // Cannon LOS from destination (Part 19): bonus if the destination has a
    // valid attack on a wounded/exposed soldier.
    const simAtDest = { ...enemy, x: destination.x, y: destination.y, ap: 1 };
    const atk = bestAttackFrom(grid, units, simAtDest);
    if (atk) {
      score += 25;
      if (atk.outcome.killed) score += 40;
      if (atk.outcome.state === 'flanked') score += 15;
    }
  }

  // Penalize suicidal / useless destinations (Part 19): trapped or dead-end.
  if (stoppedAtIndestructible && path.length === 0) score -= 50;
  let destOpenNeighbors = 0;
  for (const [dx, dy] of [[0,-1],[0,1],[-1,0],[1,0],[-1,-1],[1,-1],[-1,1],[1,1]]) {
    const nx = destination.x + dx, ny = destination.y + dy;
    if (ny < 0 || ny >= GRID_HEIGHT || nx < 0 || nx >= GRID_WIDTH) continue;
    if (grid[ny][nx].type === TILE_TYPES.BLOCKED) continue;
    destOpenNeighbors++;
  }
  if (destOpenNeighbors <= 1) score -= 30; // isolated corner / dead end

  // Allied unit collision at destination (Part 33): strongly avoid.
  const allyAtDest = units.find((u) => u.alive && u.team === 'enemy' && u.id !== enemy.id && u.x === destination.x && u.y === destination.y);
  if (allyAtDest) score -= 80;

  return {
    score,
    details: { soldiersHit, siegeTiles, coverSides, barricadeSides, alliedInPath },
  };
}

// Pick the best Siege Charge direction + path. Returns { dir, path,
// destination, score, reason, details } or null.
function decideSiegeChargePath(grid, units, enemy) {
  let best = null;
  let bestScore = 0;
  for (const dir of CHARGE_DIRS) {
    const pathData = computeChargePath(grid, enemy.x, enemy.y, dir);
    if (pathData.path.length === 0) continue;
    const r = scoreChargePath(grid, units, enemy, dir, pathData);
    if (r.score > bestScore) {
      bestScore = r.score;
      const soldiers = playersOf(units);
      const keys = new Set(pathData.path.map((t) => `${t.x},${t.y}`));
      const hit = soldiers.filter((p) => keys.has(`${p.x},${p.y}`)).length;
      const reason = `siege charge · ${dir} · ${pathData.path.length} tiles · ${hit} target${hit === 1 ? '' : 's'}`;
      best = {
        dir, path: pathData.path, destination: pathData.destination,
        score: r.score, reason, details: r.details,
      };
    }
  }
  return best;
}

// --- Core Discharge scoring (Phase 3, Parts 24-39) ---

// Score a Core Discharge from the Harvester's current position. Higher = better.
// Valuable when: multiple soldiers near the Harvester, a high-value soldier is
// adjacent, the player has formed a close-range cluster, or nearby cover can be
// destroyed (Part 39). One-time use — only available if coreDischargeUsed is
// false and no other major attack is pending (Part 34).
function scoreCoreDischarge(grid, units, enemy, meltdownKeys) {
  const discharge = createCoreDischarge(enemy, grid, 0);
  const keys = getCoreDischargeTileKeys(discharge);
  if (keys.size === 0) return null;

  let score = 0;
  let soldiersInZone = 0;
  let adjacentSoldiers = 0;
  let coverInZone = 0;

  for (const u of units) {
    if (!u.alive || u.team !== 'player' || u.downed) continue;
    const dist = Math.max(Math.abs(u.x - enemy.x), Math.abs(u.y - enemy.y));
    if (dist <= CORE_DISCHARGE_RADIUS) {
      soldiersInZone++;
      score += 120;
      if (u.maxHp > 0 && u.hp <= u.maxHp * 0.5) score += 30; // wounded
      if (dist <= 1) adjacentSoldiers++;
    }
  }

  // Cluster bonus (Part 39): multiple soldiers in the blast zone.
  if (soldiersInZone >= 2) score += 40 * soldiersInZone;
  if (soldiersInZone >= 3) score += 50;
  if (adjacentSoldiers >= 1) score += 30; // Assault/shotgun pressure (Part 27)

  // Cover destruction value (Part 30): normal cover in the blast zone.
  for (const t of discharge.tiles) {
    const tile = grid[t.y] && grid[t.y][t.x];
    if (!tile || !tile.cover) continue;
    if (isSiegeDestructibleTile(tile)) continue; // Part 31
    for (const d of ['n', 's', 'e', 'w']) {
      const c = tile.cover[d];
      if (c && !c.destroyed) { coverInZone++; score += 5; }
    }
  }

  // Require at least one soldier in the zone (Part 39 — don't waste it).
  if (soldiersInZone === 0) return null;

  // Hazard combination safety (Part 36): verify the player has escape routes.
  if (meltdownKeys && meltdownKeys.size > 0) {
    if (!isCoreDischargeSafeWithMeltdown(grid, keys, meltdownKeys, units)) {
      return null; // unsafe overlap — pick a different action
    }
  }

  return {
    discharge,
    score,
    reason: `core discharge · ${soldiersInZone} target${soldiersInZone === 1 ? '' : 's'} · ${coverInZone} cover`,
    details: { soldiersInZone, adjacentSoldiers, coverInZone },
  };
}

// --- Debug AI score view (Part 43) ---
//
// Returns a breakdown of all candidate actions + their scores for dev-only
// inspection. Never exposed to players.
export function getHarvesterAiScores(grid, units, enemy, context = {}) {
  const hasPendingHazard = !!(context.hasPendingTremor || context.hasPendingBeam || context.hasPendingCharge || context.hasPendingCoreDischarge);
  const phase = context?.harvesterState?.bossPhase || HARVESTER_PHASES.PHASE_1_ARMORED;
  const phase2 = phase === HARVESTER_PHASES.PHASE_2_ADVANCE;
  const phase3 = phase === HARVESTER_PHASES.PHASE_3_CORE_FAILURE;
  const meltdownKeys = context.pendingMeltdownKeys || new Set();

  const scores = {
    phase,
    phase2,
    hasPendingHazard,
    candidates: {},
    chosen: null,
  };

  // Siege Charge
  const chargeAb = getEnemyAbility('siege_charge');
  const chargeReady = chargeAb && canEnemyUseAbility(enemy, chargeAb) && !hasPendingHazard && (phase2 || phase3);
  if (chargeReady) {
    const path = decideSiegeChargePath(grid, units, enemy);
    scores.candidates.siege_charge = path
      ? { available: true, score: path.score, reason: path.reason, details: path.details }
      : { available: true, score: 0, reason: 'no valid charge lane', details: {} };
  } else {
    scores.candidates.siege_charge = { available: false, score: 0, reason: chargeReady === false && hasPendingHazard ? 'hazard pending' : 'cooldown / phase 1', details: {} };
  }

  // Tremor Slam
  const tremorAb = getEnemyAbility('tremor_slam');
  const tremorReady = tremorAb && canEnemyUseAbility(enemy, tremorAb) && !hasPendingHazard;
  if (tremorReady) {
    const area = decideTremorSlamArea(grid, units, enemy);
    scores.candidates.tremor_slam = area
      ? { available: true, score: area.score, reason: area.reason, details: area.details }
      : { available: true, score: 0, reason: TREMOR_SLAM_ENABLED ? 'no cluster' : 'disabled', details: {} };
  } else {
    scores.candidates.tremor_slam = { available: false, score: 0, reason: hasPendingHazard ? 'hazard pending' : 'cooldown', details: {} };
  }

  // Excavation Beam
  const beamAb = getEnemyAbility('excavation_beam');
  const beamReady = beamAb && canEnemyUseAbility(enemy, beamAb) && !hasPendingHazard;
  if (beamReady) {
    const lane = decideBeamLane(grid, units, enemy);
    scores.candidates.excavation_beam = lane
      ? { available: true, score: lane.score, reason: lane.reason, details: lane.details }
      : { available: true, score: 0, reason: 'no lane', details: {} };
  } else {
    scores.candidates.excavation_beam = { available: false, score: 0, reason: hasPendingHazard ? 'hazard pending' : 'cooldown', details: {} };
  }

  // Cannon
  const cannon = scoreCannonAttack(grid, units, enemy);
  scores.candidates.cannon = cannon
    ? { available: true, score: cannon.score, reason: cannon.reason, details: cannon.details }
    : { available: false, score: 0, reason: 'no valid target / no ammo', details: {} };

  // Core Discharge (Phase 3 only)
  const coreDischargeAvailable = phase3 && !context?.harvesterState?.coreDischargeUsed && !hasPendingHazard;
  if (coreDischargeAvailable) {
    const cd = scoreCoreDischarge(grid, units, enemy, meltdownKeys);
    scores.candidates.core_discharge = cd
      ? { available: true, score: cd.score, reason: cd.reason, details: cd.details }
      : { available: true, score: 0, reason: 'no soldiers in zone / unsafe overlap', details: {} };
  } else {
    scores.candidates.core_discharge = {
      available: false, score: 0,
      reason: !phase3 ? 'not phase 3' : context?.harvesterState?.coreDischargeUsed ? 'already used' : 'hazard pending',
      details: {},
    };
  }

  return scores;
}

// --- Main decision ---

// The Harvester's action decision (Phase 1 + Phase 2). Returns a decision object
// (same shape as decideEnemyAction) or null to fall through to the generic
// attack/move logic in ai.js.
export function decideHarvesterAction(grid, units, enemy, context = {}) {
  const hasPendingHazard = !!(context.hasPendingTremor || context.hasPendingBeam || context.hasPendingCharge || context.hasPendingCoreDischarge);
  const phase = context?.harvesterState?.bossPhase || HARVESTER_PHASES.PHASE_1_ARMORED;
  const phase3 = phase === HARVESTER_PHASES.PHASE_3_CORE_FAILURE;
  const meltdownKeys = context.pendingMeltdownKeys || new Set();

  // --- Phase 3: CORE FAILURE (Parts 37-38) ---
  // Aggressive but unstable. Scores all available actions including Core
  // Discharge. Harvester does NOT move while Core Discharge is pending (Part 33).
  if (phase3) {
    // Part 33: if Core Discharge is pending, don't move — still allow Cannon.
    if (context.hasPendingCoreDischarge) {
      const cannon = scoreCannonAttack(grid, units, enemy);
      if (cannon) {
        return {
          type: 'attack',
          targetId: cannon.target.id,
          targetName: cannon.target.name,
          state: cannon.outcome.state,
          damage: cannon.outcome.finalDamage,
          killed: cannon.outcome.killed,
          reason: cannon.reason,
        };
      }
      return { type: 'end', reason: 'core discharge pending' };
    }

    const candidates = [];

    // Core Discharge (Part 24, 38 P3): one-time, high-value close-range blast.
    if (!context?.harvesterState?.coreDischargeUsed && !hasPendingHazard) {
      const cd = scoreCoreDischarge(grid, units, enemy, meltdownKeys);
      if (cd) {
        candidates.push({
          kind: 'core_discharge',
          score: cd.score,
          decision: {
            type: 'core_discharge',
            abilityId: 'core_discharge',
            discharge: cd.discharge,
            reason: cd.reason,
          },
        });
      }
    }

    // Siege Charge (P4)
    const chargeAb = getEnemyAbility('siege_charge');
    if (chargeAb && canEnemyUseAbility(enemy, chargeAb) && !hasPendingHazard) {
      const path = decideSiegeChargePath(grid, units, enemy);
      if (path) {
        candidates.push({
          kind: 'siege_charge',
          score: path.score,
          decision: {
            type: 'siege_charge', abilityId: 'siege_charge',
            dir: path.dir, pathTiles: path.path,
            destinationX: path.destination.x, destinationY: path.destination.y,
            reason: path.reason,
          },
        });
      }
    }

    // Tremor Slam (P5)
    const tremor = getEnemyAbility('tremor_slam');
    if (tremor && canEnemyUseAbility(enemy, tremor) && !hasPendingHazard) {
      const area = decideTremorSlamArea(grid, units, enemy);
      if (area) {
        candidates.push({
          kind: 'tremor_slam',
          score: area.score,
          decision: { type: 'tremor_slam', abilityId: 'tremor_slam', x: area.x, y: area.y, reason: area.reason },
        });
      }
    }

    // Excavation Beam (P5)
    const beam = getEnemyAbility('excavation_beam');
    if (beam && canEnemyUseAbility(enemy, beam) && !hasPendingHazard) {
      const lane = decideBeamLane(grid, units, enemy);
      if (lane) {
        candidates.push({
          kind: 'excavation_beam',
          score: lane.score,
          decision: { type: 'excavation_beam', abilityId: 'excavation_beam', orientation: lane.orientation, index: lane.index, reason: lane.reason },
        });
      }
    }

    // Heavy Plasma Cannon (P6)
    const cannon = scoreCannonAttack(grid, units, enemy);
    if (cannon) {
      candidates.push({
        kind: 'attack',
        score: cannon.score,
        decision: {
          type: 'attack', targetId: cannon.target.id, targetName: cannon.target.name,
          state: cannon.outcome.state, damage: cannon.outcome.finalDamage,
          killed: cannon.outcome.killed, reason: cannon.reason,
        },
      });
    }

    // Pick the strongest candidate (Part 38 — not a rigid script).
    if (candidates.length > 0) {
      candidates.sort((a, b) => b.score - a.score);
      const best = candidates[0];
      if (best.score > 0) return best.decision;
    }

    // P7: Move aggressively (same as Phase 2).
    const reachable = computeReachable(grid, units, enemy, getMovementRange(enemy));
    if (reachable.size === 0) return { type: 'end', reason: 'nowhere to move' };
    const currentScore = scorePhase2Tile(grid, units, enemy, { x: enemy.x, y: enemy.y });
    let bestMove = null;
    for (const [, entry] of reachable) {
      const s = scorePhase2Tile(grid, units, enemy, entry);
      if (!bestMove || s > bestMove.score) bestMove = { entry, score: s };
    }
    if (bestMove && bestMove.score > currentScore + 10) {
      return { type: 'move', entry: bestMove.entry, reason: 'advance (core failure)' };
    }
    return { type: 'end', reason: 'holding position' };
  }

  // --- Phase 2: ADVANCING HARVESTER (Parts 14-33) ---
  // Score all available actions and pick the strongest (Part 24). No hardcoded
  // priority — Charge is not always first.
  if (phase === HARVESTER_PHASES.PHASE_2_ADVANCE) {
    const candidates = [];

    // Siege Charge
    const chargeAb = getEnemyAbility('siege_charge');
    if (chargeAb && canEnemyUseAbility(enemy, chargeAb) && !hasPendingHazard) {
      const path = decideSiegeChargePath(grid, units, enemy);
      if (path) {
        candidates.push({
          kind: 'siege_charge',
          score: path.score,
          decision: {
            type: 'siege_charge',
            abilityId: 'siege_charge',
            dir: path.dir,
            pathTiles: path.path,
            destinationX: path.destination.x,
            destinationY: path.destination.y,
            reason: path.reason,
          },
        });
      }
    }

    // Tremor Slam
    const tremor = getEnemyAbility('tremor_slam');
    if (tremor && canEnemyUseAbility(enemy, tremor) && !hasPendingHazard) {
      const area = decideTremorSlamArea(grid, units, enemy);
      if (area) {
        candidates.push({
          kind: 'tremor_slam',
          score: area.score,
          decision: { type: 'tremor_slam', abilityId: 'tremor_slam', x: area.x, y: area.y, reason: area.reason },
        });
      }
    }

    // Excavation Beam
    const beam = getEnemyAbility('excavation_beam');
    if (beam && canEnemyUseAbility(enemy, beam) && !hasPendingHazard) {
      const lane = decideBeamLane(grid, units, enemy);
      if (lane) {
        candidates.push({
          kind: 'excavation_beam',
          score: lane.score,
          decision: { type: 'excavation_beam', abilityId: 'excavation_beam', orientation: lane.orientation, index: lane.index, reason: lane.reason },
        });
      }
    }

    // Heavy Plasma Cannon (Part 21 — reliable fallback, not mandatory)
    const cannon = scoreCannonAttack(grid, units, enemy);
    if (cannon) {
      candidates.push({
        kind: 'attack',
        score: cannon.score,
        decision: {
          type: 'attack',
          targetId: cannon.target.id,
          targetName: cannon.target.name,
          state: cannon.outcome.state,
          damage: cannon.outcome.finalDamage,
          killed: cannon.outcome.killed,
          reason: cannon.reason,
        },
      });
    }

    // Pick the strongest candidate (Part 24).
    if (candidates.length > 0) {
      candidates.sort((a, b) => b.score - a.score);
      const best = candidates[0];
      // Only act if the best score is meaningfully positive.
      if (best.score > 0) return best.decision;
    }

    // P5: Move aggressively — consider future Charge setup (Part 20).
    const reachable = computeReachable(grid, units, enemy, getMovementRange(enemy));
    if (reachable.size === 0) return { type: 'end', reason: 'nowhere to move' };
    const currentScore = scorePhase2Tile(grid, units, enemy, { x: enemy.x, y: enemy.y });
    let bestMove = null;
    for (const [, entry] of reachable) {
      const s = scorePhase2Tile(grid, units, enemy, entry);
      if (!bestMove || s > bestMove.score) bestMove = { entry, score: s };
    }
    if (bestMove && bestMove.score > currentScore + 10) {
      return { type: 'move', entry: bestMove.entry, reason: 'advance (aggressive)' };
    }
    return { type: 'end', reason: 'holding position' };
  }

  // --- Phase 1: ARMORED HARVESTER (original logic) ---
  if (phase !== HARVESTER_PHASES.PHASE_1_ARMORED) return null;

  // P2: Tremor Slam — strong multi-target cluster / hardpoint.
  // Max 1 pending hazard (Part 25).
  const tremor = getEnemyAbility('tremor_slam');
  if (tremor && canEnemyUseAbility(enemy, tremor) && !hasPendingHazard) {
    const area = decideTremorSlamArea(grid, units, enemy);
    if (area) {
      return { type: 'tremor_slam', abilityId: 'tremor_slam', x: area.x, y: area.y, reason: area.reason };
    }
  }

  // P3: Excavation Beam — valuable straight-line lane.
  const beam = getEnemyAbility('excavation_beam');
  if (beam && canEnemyUseAbility(enemy, beam) && !hasPendingHazard) {
    const lane = decideBeamLane(grid, units, enemy);
    if (lane) {
      return { type: 'excavation_beam', abilityId: 'excavation_beam', orientation: lane.orientation, index: lane.index, reason: lane.reason };
    }
  }

  // P4: Heavy Plasma Cannon — fall through to the generic attack logic.
  const atk = bestAttackFrom(grid, units, enemy);
  if (atk) {
    return {
      type: 'attack',
      targetId: atk.target.id,
      targetName: atk.target.name,
      state: atk.outcome.state,
      damage: atk.outcome.finalDamage,
      killed: atk.outcome.killed,
      reason: `plasma cannon · ${atk.outcome.state}${atk.outcome.killed ? ' · KILL' : ''}`,
    };
  }

  // P5: Reposition modestly if it materially improves future actions.
  const reachable = computeReachable(grid, units, enemy, getMovementRange(enemy));
  if (reachable.size === 0) return { type: 'end', reason: 'nowhere to move' };

  const currentScore = scoreHarvesterTile(grid, units, enemy, { x: enemy.x, y: enemy.y });
  let best = null;
  for (const [, entry] of reachable) {
    if (!isInPhase1DefenseZone(entry.x, entry.y) && gridDistance(enemy, entry) > 2) continue;
    const s = scoreHarvesterTile(grid, units, enemy, entry);
    if (!best || s > best.score) best = { entry, score: s };
  }
  if (best && best.score > currentScore + 15) {
    return { type: 'move', entry: best.entry, reason: 'reposition (defense zone)' };
  }

  return { type: 'end', reason: 'holding position' };
}