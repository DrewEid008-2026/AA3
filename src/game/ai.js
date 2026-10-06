// Simple, readable archetype AI. Decisions are computed one action at a time
// against the live board state the caller passes in, so kills and movement are
// seen by the very next decision — no stale state, no occupancy overlaps.
//
// The goal is readable tactical personalities, not optimal play. A player
// should be able to learn what each archetype is probably trying to do.
import { computeReachable, getMovementRange, computePhaseStepReachable } from './pathfinding';
import {
  attackIsValid,
  computeDamage,
  getCoverState,
  gridDistance,
  getUnitWeapon,
  relevantCoverSides,
} from './combat';
import { hasAmmo, getMaxAmmo } from './ammo';
import {
  canEnemyUseAbility,
  getEnemyAbility,
  getEnemyAbilityTargets,
  getEnemyAbilityForArchetype,
  getShieldTargets,
  getPlasmaStrikeTiles,
} from './enemyAbilities';
import { hasStatus, STATUS_TYPES } from './statuses';
import { getShieldValue, getCoreShieldValue } from './shield';
import { getCurrentArmor } from './armorShred';
import { GRID_WIDTH, GRID_HEIGHT } from './constants';
import { BOSS_PHASES } from './bossState';
import { countLightCoverOnTile } from './bastion';
import {
  pickRepairTarget, canDeployHardlight,
} from './fabricator';
import { decideHarvesterAction } from './harvesterAi';
import { decideFlashClawAction } from './flashClawAi';
import { decideDislocatorAction } from './dislocatorAi';
import { executionerBestAttack } from './executionerAi';
import { isVolatileTile, countVolatileInPath, VOLATILE_TILE_DAMAGE } from './volatileTiles';

// Tunable personality parameters. These drive weighted scoring, not hard
// rules, so behaviour stays easy to balance. flankWeight >= 1.0 marks
// archetypes that will skip a weak (covered) shot to manoeuvre for a flank.
export const AI_PARAMS = {
  grunt: {
    preferClose: true,
    proximityWeight: 0.5,
    coverWeight: 0.9,
    flankWeight: 0.6,
    moveMargin: 4,
  },
  rusher: {
    preferClose: true,
    proximityWeight: 1.4,
    coverWeight: 0.15,
    flankWeight: 1.2,
    moveMargin: 1,
  },
  support: {
    preferClose: false,
    proximityWeight: 0.7,
    coverWeight: 1.0,
    flankWeight: 0.25,
    moveMargin: 6,
  },
  // Bulwark — frontline tank / damage sponge.
  // Aggressively closes distance to the player squad to establish a forward frontline,
  // soak up incoming fire, and draw reactions/Overwatch. Values proximity over cover;
  // does not fear danger because its primary function is absorbing damage rather
  // than dealing high damage from the backline.
  bulwark: {
    preferClose: true,
    proximityWeight: 1.6,
    coverWeight: 0.15,
    flankWeight: 0.1,
    moveMargin: 1,
    frontlineTank: true,
  },
  // Stalker — mobile flanker. Strongly seeks flanking/exposed targets and
  // lateral angles. More aggressive and mobile than a Grunt.
  stalker: {
    preferClose: true,
    proximityWeight: 1.1,
    coverWeight: 0.3,
    flankWeight: 1.6,
    moveMargin: 1,
  },
  // Disruptor — ability-economy pressure. Keeps distance, targets ability users.
  disruptor: {
    preferClose: false,
    proximityWeight: 0.5,
    coverWeight: 0.8,
    flankWeight: 0.5,
    moveMargin: 5,
  },
  // Artillery — area denial. Stays behind the front line, avoids close contact.
  artillery: {
    preferClose: false,
    proximityWeight: -0.8, // negative: actively wants distance from players
    coverWeight: 1.1,
    flankWeight: 0.2,
    moveMargin: 5,
  },
  // Warden Prime — defensive commander. Stays near the Command Nexus, preserves
  // cover, avoids forward aggression. Takes good shots but doesn't chase. High
  // moveMargin means it only repositions for material improvements.
  warden_prime: {
    preferClose: false,
    proximityWeight: -0.6, // actively wants distance from players
    coverWeight: 1.5,
    flankWeight: 0.3,
    moveMargin: 8,
    commandZoneCenter: { x: 4, y: 1 },
    commandZoneRadius: 3,
    commandZoneWeight: 1.2,
  },
  // Warden Prime Phase 2 — Aggressive Commander. No longer anchors the Command
  // Nexus. Actively seeks firing lines, flanks, and closer engagement. Still
  // intelligent — doesn't blindly charge into melee. Lower moveMargin so it
  // repositions more readily.
  warden_prime_phase2: {
    preferClose: true,
    proximityWeight: 0.8,
    coverWeight: 0.7,
    flankWeight: 1.0,
    moveMargin: 3,
  },
  // Bastion Mech — deliberate armored siege unit. Slow; advances on defended
  // positions. It does not take cover (coverWeight 0), so it is fearless in the
  // open. High moveMargin means it only repositions for meaningful advances.
  bastion: {
    preferClose: true,
    proximityWeight: 1.0,
    coverWeight: 0.0,
    flankWeight: 0.3,
    moveMargin: 5,
  },
  // Alien Fabricator — battlefield technician. Stays near its mechs (ally
  // proximity), keeps modest distance from players, supports from cover.
  fabricator: {
    preferClose: false,
    proximityWeight: -0.3,
    coverWeight: 1.0,
    flankWeight: 0.2,
    moveMargin: 5,
    allyProximityWeight: 1.2,
  },
  // Warden Prime Phase 3 — Core Overload. Aggressive and unstable. Favors
  // offensive pressure even more heavily: closes distance, takes any shot,
  // and repositions readily. Still intelligent — doesn't suicide. The Warden
  // Beam deals 6 damage in Phase 3 (handled in Battle.jsx's attack resolution).
  warden_prime_phase3: {
    preferClose: true,
    proximityWeight: 1.2,
    coverWeight: 0.4,
    flankWeight: 1.3,
    moveMargin: 2,
  },
  // Flash Claw — fast melee pursuer / Overwatch breaker. Fearless (no cover
  // value), strongly aggressive, repositions readily. The generic flow handles
  // melee attacks (range 1 weapon) and pursuit movement; decideFlashClawAction
  // (called from decideAbilityAction) handles Overwatch-baiting moves.
  flash_claw: {
    preferClose: true,
    proximityWeight: 1.6,
    coverWeight: 0.0,
    flankWeight: 0.0,
    moveMargin: 1,
  },
  // Dislocator — formation breaker / forced movement. Keeps moderate distance
  // (it's a tactical unit, not a brawler), values cover, and repositions
  // readily to set up COME HERE! pulls. The generic flow handles the Beam
  // Rifle attack and repositioning; decideDislocatorAction (called from
  // decideAbilityAction) handles COME HERE! targeting.
  dislocator: {
    preferClose: false,
    proximityWeight: 0.4,
    coverWeight: 0.8,
    flankWeight: 0.3,
    moveMargin: 3,
  },
  // Executioner — isolated-target hunter / ranged finisher. Keeps moderate
  // distance (it's a ranged hunter, not a brawler), values cover, and
  // repositions readily to maintain LOS to isolated prey. The generic flow
  // handles the Execution Beam attack and repositioning; bestAttackFrom
  // delegates to executionerBestAttack for isolation-aware target selection.
  executioner: {
    preferClose: false,
    proximityWeight: 0.4,
    coverWeight: 0.8,
    flankWeight: 0.5,
    moveMargin: 3,
  },
};

const STATE_RANK = { flanked: 3, exposed: 2, covered: 1 };

function playersOf(units) {
  return units.filter((u) => u.alive && u.team === 'player' && !u.downed);
}

// Best valid attack from a simulated position. Ranks targets: lethal first,
// then flanked > exposed > covered. Returns { target, outcome, rank } or null.
function bestAttackFrom(grid, units, sim) {
  // Executioner uses isolation-aware target selection (spec 15-18). Delegates
  // to executionerBestAttack which passes `units` to computeDamage so the Lone
  // Prey +2 bonus is included in the damage calculation.
  if (sim.archetype === 'executioner') {
    return executionerBestAttack(grid, units, sim);
  }
  const weapon = getUnitWeapon(sim);
  if (!weapon || sim.ap < weapon.apCost || !hasAmmo(sim)) return null;
  let best = null;
  for (const p of playersOf(units)) {
    if (!attackIsValid(grid, sim, p)) continue;
    const o = computeDamage(sim, p, grid, { units });
    const rank = STATE_RANK[o.state] + (o.killed ? 1000 : 0);
    if (!best || rank > best.rank) best = { target: p, outcome: o, rank };
  }
  return best;
}

// Score a candidate tile for an enemy. Higher is better. The simulated AP is
// reduced by 1 so attack opportunities reflect what the unit can do AFTER
// spending the AP to move there.
function scoreTile(grid, units, enemy, tile, params) {
  const sim = { ...enemy, x: tile.x, y: tile.y, ap: enemy.ap - 1 };
  let score = 0;

  const atk = bestAttackFrom(grid, units, sim);
  if (atk) {
    score += 120;
    if (atk.outcome.killed) score += 1000;
    if (atk.outcome.state === 'flanked') score += 60 * params.flankWeight;
    else if (atk.outcome.state === 'exposed') score += 30 * params.flankWeight;
  }

  // Cover relevance: only count cover that actually protects from players.
  const players = playersOf(units);
  let protectedCount = 0;
  let danger = 0;
  for (const p of players) {
    const st = getCoverState(grid, p, sim); // is sim covered from this player?
    if (st === 'covered') protectedCount++;
    if (attackIsValid(grid, p, sim)) {
      // sim is shootable by this player from its current position
      if (st === 'exposed') danger += 2.2;
      else if (st === 'flanked') danger += 3.2;
      else danger += 1;
    }
  }
  score += (protectedCount / Math.max(1, players.length)) * 50 * params.coverWeight;
  score -= danger * 12 * params.coverWeight;

  // Proximity: rusher/grunt want closer; support wants distance.
  const nearest = Math.min(...players.map((p) => gridDistance(sim, p)));
  if (params.preferClose) score += (14 - nearest) * 4 * params.proximityWeight;
  else score += nearest * 3 * params.proximityWeight;

  // Frontline tank (Bulwark): strong incentive to be on the frontline
  // (within 2-3 tiles of the nearest player soldier) to screen allies and draw fire.
  if (params.frontlineTank) {
    if (nearest <= 3) score += 30;
    if (nearest <= 2) score += 20;
  }

  // Ally proximity: stay near other living enemies, especially damaged
  // ones, so the formation holds and shield coverage stays relevant.
  if (params.allyProximityWeight > 0) {
    const allies = units.filter((u) => u.alive && u.team === enemy.team && u.id !== enemy.id);
    if (allies.length > 0) {
      const nearestAlly = Math.min(...allies.map((a) => gridDistance(sim, a)));
      score += (8 - Math.min(8, nearestAlly)) * 5 * params.allyProximityWeight;
    }
  }

  // Command zone preference (Warden): penalize tiles far from the command nexus.
  // This is a soft preference, not a hard restriction — the Warden may leave
  // the zone when circumstances require it.
  if (params.commandZoneCenter) {
    const distFromZone = gridDistance(sim, params.commandZoneCenter);
    const radius = params.commandZoneRadius || 3;
    if (distFromZone > radius) {
      score -= (distFromZone - radius) * 8 * (params.commandZoneWeight || 1);
    }
  }

  // Volatile Tile hazard cost (spec 23-24): penalize destinations that require
  // crossing volatile tiles and ending on a volatile tile. The AI does NOT
  // treat volatile tiles as impassable — it weighs the expected damage against
  // the tactical value of the destination, taking current HP, Armor, and Shields
  // into account (spec 24).
  if (tile.path && tile.path.length > 1) {
    const hazardCount = countVolatileInPath(tile.path, grid);
    if (hazardCount > 0) {
      const armor = getCurrentArmor(enemy);
      const shield = getShieldValue(enemy) + getCoreShieldValue(enemy);
      const perTileDmg = Math.max(1, VOLATILE_TILE_DAMAGE - armor);
      const totalRawDmg = hazardCount * perTileDmg;
      const effectiveDmg = Math.max(0, totalRawDmg - shield);
      const effectiveHp = enemy.hp;

      if (effectiveDmg >= effectiveHp) {
        // Lethal route: heavy penalty to avoid dying in transit
        score -= 200;
      } else {
        const hpFrac = enemy.maxHp > 0 ? (effectiveHp - effectiveDmg) / enemy.maxHp : 0.5;
        score -= totalRawDmg * 8 * (1.2 - hpFrac * 0.6);
      }
    }
  }

  const destTile = grid[tile.y] && grid[tile.y][tile.x];
  if (isVolatileTile(destTile)) {
    const armor = getCurrentArmor(enemy);
    const perTileDmg = Math.max(1, VOLATILE_TILE_DAMAGE - armor);
    const hpFrac = enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 1;
    score -= perTileDmg * 12 * (1.5 - hpFrac * 0.8);
  }

  return score;
}

// Count other living enemies (besides `enemy`) that can attack a given player
// from current positions. Used by Grunts to decide if Marking is worth it.
function alliesAbleToAttack(grid, units, enemy, player) {
  let n = 0;
  for (const u of units) {
    if (!u.alive || u.team !== 'enemy' || u.id === enemy.id) continue;
    if (attackIsValid(grid, u, player)) n++;
  }
  return n;
}

// Bulwark — pick the best ally to shield. Priority: low-HP → Artillery →
// Support/Disruptor → exposed ally → self if threatened. Simple readable
// heuristics, not omniscient. Returns the target unit or null.
function pickShieldTarget(grid, units, enemy, ability) {
  const candidates = getShieldTargets(units, enemy, ability);
  if (candidates.length === 0) return null;
  const players = playersOf(units);

  const exposedTo = (ally) => {
    return players.filter((p) => attackIsValid(grid, p, ally)).length;
  };
  const isThreatened = (ally) => exposedTo(ally) > 0;

  let best = null;
  let bestScore = -1;
  for (const ally of candidates) {
    let score = 0;
    if (ally.id === enemy.id) {
      // Self: as a frontline tank, keeping Energy Shield active is paramount.
      // If unshielded, prioritize shielding self to absorb incoming frontline damage.
      if (getShieldValue(enemy) === 0) {
        score = isThreatened(ally) ? 45 : 30;
      } else {
        score = -10; // Already shielded, avoid wasteful refresh
      }
    } else {
      // Low-HP ally (≤50%) is the top priority.
      const hpFrac = ally.maxHp > 0 ? ally.hp / ally.maxHp : 1;
      if (hpFrac <= 0.5) score += 50;
      // Warden is tactically important — prioritize shielding the boss.
      if (ally.isBoss) score += 40;
      // Protect valuable back-line archetypes.
      if (ally.archetype === 'artillery') score += 30;
      if (ally.archetype === 'support' || ally.archetype === 'disruptor') score += 20;
      // Exposed allies need protection more.
      score += exposedTo(ally) * 8;
      // Don't re-shield an already-shielded ally (refresh is fine but lower priority).
      if (getShieldValue(ally) > 0) score -= 15;
    }
    if (score > bestScore) { bestScore = score; best = ally; }
  }
  // Only shield if there's a meaningful reason (score > 0).
  return bestScore > 0 ? best : null;
}

// Stalker — evaluate Phase Step destinations. Prefers tiles that create a
// flanking attack, gain LOS, or escape danger. Returns { entry, reason } or null.
function decidePhaseStep(grid, units, enemy, ability) {
  const reachable = computePhaseStepReachable(grid, units, enemy, ability.range);
  if (reachable.size === 0) return null;
  const params = AI_PARAMS.stalker;
  const players = playersOf(units);
  const currentScore = scoreTile(grid, units, enemy, { x: enemy.x, y: enemy.y }, params);
  let best = null;
  let bestScore = currentScore;
  for (const [, entry] of reachable) {
    const s = scoreTile(grid, units, enemy, entry, params);
    if (s > bestScore) { bestScore = s; best = entry; }
  }
  if (!best) return null;
  // Check if the new position offers a flanked/exposed attack the current one doesn't.
  const simAt = { ...enemy, x: best.x, y: best.y, ap: enemy.ap };
  const futureAtk = bestAttackFrom(grid, units, simAt);
  const reason = futureAtk
    ? `phase step → ${futureAtk.outcome.state}${futureAtk.outcome.killed ? ' · KILL' : ''}`
    : 'phase step (reposition)';
  return { entry: best, reason };
}

// Artillery — pick the best Plasma Strike center tile. Scores by the number of
// players in the blast (center + adjacent). Prefers 2+ targets. Returns
// { x, y, reason } or null.
function decidePlasmaStrikeTile(grid, units, enemy, ability) {
  const tiles = getPlasmaStrikeTiles(grid, enemy, ability);
  if (tiles.length === 0) return null;
  const players = playersOf(units);
  let best = null;
  let bestCount = 1; // require at least 2 players threatened
  for (const t of tiles) {
    let count = 0;
    for (const p of players) {
      const dist = Math.max(Math.abs(p.x - t.x), Math.abs(p.y - t.y));
      if (dist <= ability.radius) count++;
    }
    if (count > bestCount) { bestCount = count; best = t; }
  }
  if (!best) return null;
  return { x: best.x, y: best.y, count: bestCount, reason: `plasma strike · ${bestCount} targets` };
}

// --- Warden Prime boss AI ---
// The Warden has three abilities (Command Beam, Beam Sweep, Phase Shift) plus
// its basic Warden Beam. Phase 1 prioritizes defensive play + area denial.
// Phase 2 becomes aggressive, using Phase Shift to reposition + attack.

// Score each valid Beam Sweep lane (full row or column) by player count,
// wounded soldiers, and engineer presence. Returns { orientation, index, count,
// reason } or null if no lane has any meaningful target.
function decideBeamSweepLane(grid, units, enemy) {
  const players = playersOf(units);
  if (players.length === 0) return null;

  let best = null;
  let bestScore = 0; // require at least 1 player in the lane

  // Score rows (y = 0..13)
  for (let y = 0; y < GRID_HEIGHT; y++) {
    let count = 0, wounded = 0, hasEngineer = false;
    for (const p of players) {
      if (p.y === y) {
        count++;
        if (p.hp < p.maxHp) wounded++;
        if (p.archetype === 'engineer') hasEngineer = true;
      }
    }
    if (count === 0) continue;
    const score = count * 10 + wounded * 5 + (hasEngineer ? 3 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = { orientation: 'row', index: y, count, reason: `beam sweep · row ${y} · ${count} target${count === 1 ? '' : 's'}` };
    }
  }

  // Score columns (x = 0..8)
  for (let x = 0; x < GRID_WIDTH; x++) {
    let count = 0, wounded = 0, hasEngineer = false;
    for (const p of players) {
      if (p.x === x) {
        count++;
        if (p.hp < p.maxHp) wounded++;
        if (p.archetype === 'engineer') hasEngineer = true;
      }
    }
    if (count === 0) continue;
    const score = count * 10 + wounded * 5 + (hasEngineer ? 3 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = { orientation: 'column', index: x, count, reason: `beam sweep · col ${x} · ${count} target${count === 1 ? '' : 's'}` };
    }
  }

  return best;
}

// Pick the best Command Beam target. Prefers exposed/flanked/wounded soldiers
// that other enemies can exploit. Never Marks an already-Marked soldier. Uses
// readable heuristics, not omniscience. Returns the target unit (+ reason) or null.
function decideCommandBeamTarget(grid, units, enemy, ability) {
  const candidates = getEnemyAbilityTargets(grid, units, enemy, ability)
    .filter((p) => !hasStatus(p, STATUS_TYPES.MARKED));
  if (candidates.length === 0) return null;

  let best = null;
  let bestScore = 0;

  for (const p of candidates) {
    const state = getCoverState(grid, enemy, p);
    let score = 0;
    if (state === 'flanked') score += 40;
    else if (state === 'exposed') score += 30;
    else if (state === 'covered') score += 10;

    // Wounded bonus
    if (p.maxHp > 0 && p.hp <= p.maxHp * 0.5) score += 20;

    // Ally exploitation — is there another enemy who can attack this target?
    const allies = alliesAbleToAttack(grid, units, enemy, p);
    score += allies * 15;

    // Don't waste Command Beam when no reasonable follow-up exists (unless the
    // target is already wounded enough that the 4 damage itself is useful).
    if (allies === 0 && p.hp > 4) score -= 15;

    if (score > bestScore) { bestScore = score; best = { ...p, reason: `command beam ${p.name} · ${state}${allies > 0 ? ` · ${allies} ally${allies === 1 ? '' : 's'}` : ''}` }; }
  }

  return bestScore > 0 ? best : null;
}

// Evaluate Phase Shift destinations (Phase 2 only). Uses the same relaxed
// pathfinding as the Stalker's Phase Step (passes through units, not through
// structural walls). Prefers tiles that escape danger, gain LOS, or create
// stronger firing positions. Returns { entry, reason } or null.
function decidePhaseShiftDest(grid, units, enemy, ability) {
  const reachable = computePhaseStepReachable(grid, units, enemy, ability.range);
  if (reachable.size === 0) return null;
  const params = AI_PARAMS.warden_prime_phase2;
  const currentScore = scoreTile(grid, units, enemy, { x: enemy.x, y: enemy.y }, params);
  let best = null;
  let bestScore = currentScore + 5; // require a meaningful improvement
  for (const [, entry] of reachable) {
    const s = scoreTile(grid, units, enemy, entry, params);
    if (s > bestScore) { bestScore = s; best = entry; }
  }
  if (!best) return null;
  const simAt = { ...enemy, x: best.x, y: best.y, ap: enemy.ap };
  const futureAtk = bestAttackFrom(grid, units, simAt);
  const reason = futureAtk
    ? `phase shift → ${futureAtk.outcome.state}${futureAtk.outcome.killed ? ' · KILL' : ''}`
    : 'phase shift (reposition)';
  return { entry: best, reason };
}

// Warden-specific ability decision. Handles all three Warden abilities based on
// the current boss phase. Returns an ability action or null to fall through to
// the normal attack/move logic.
//
// Phase 1 priority: Beam Sweep > Command Beam > Warden Beam (fall through).
// Phase 2 priority: Phase Shift (0 AP, evaluate first) > Beam Sweep > Command
// Beam > Warden Beam (fall through).
function decideWardenAction(grid, units, enemy, context) {
  const bossState = context?.bossState;
  const phase = bossState?.bossPhase || BOSS_PHASES.PHASE_1_FORTIFIED;
  const isPhase2 = phase === BOSS_PHASES.PHASE_2_ADVANCE;
  const isPhase3 = phase === BOSS_PHASES.PHASE_3_OVERLOAD;
  const hasPendingBeamSweep = !!context?.hasPendingBeamSweep;

  // Phase Shift (Phase 2+ only) — 0 AP. Evaluate first since it's free; the
  // Warden can still attack or use another ability afterward this turn.
  // Phase 3 can still use Phase Shift for emergent hazard pressure.
  if (isPhase2 || isPhase3) {
    const phaseShift = getEnemyAbility('phase_shift');
    if (phaseShift && canEnemyUseAbility(enemy, phaseShift)) {
      const ps = decidePhaseShiftDest(grid, units, enemy, phaseShift);
      if (ps) {
        return { type: 'phase_shift', abilityId: 'phase_shift', entry: ps.entry, reason: ps.reason };
      }
    }
  }

  // Beam Sweep — 1 AP, cooldown 3. Max 1 pending at a time.
  const beamSweep = getEnemyAbility('beam_sweep');
  if (beamSweep && canEnemyUseAbility(enemy, beamSweep) && !hasPendingBeamSweep) {
    const lane = decideBeamSweepLane(grid, units, enemy);
    if (lane) {
      return { type: 'beam_sweep', abilityId: 'beam_sweep', orientation: lane.orientation, index: lane.index, reason: lane.reason };
    }
  }

  // Command Beam — 1 AP, cooldown 2. Skip if the Warden has a lethal basic shot
  // (kills beat coordination).
  const atk = bestAttackFrom(grid, units, enemy);
  if (atk && atk.outcome.killed) return null; // kill beats Command Beam

  const commandBeam = getEnemyAbility('command_beam');
  if (commandBeam && canEnemyUseAbility(enemy, commandBeam)) {
    const target = decideCommandBeamTarget(grid, units, enemy, commandBeam);
    if (target) {
      return {
        type: 'ability',
        abilityId: 'command_beam',
        targetId: target.id,
        targetName: target.name,
        damage: commandBeam.damage,
        reason: target.reason,
      };
    }
  }

  return null; // fall through to normal Warden Beam attack / reposition
}

// --- Chapter 2: Bastion Mech — BULLDOZE decision ---
// Scan the four cardinal directions for a straight-line charge up to `range`
// tiles. The path stops at walls (BLOCKED terrain) or any unit; light cover
// along the path is destroyed (scored). The Bastion may end adjacent to a
// soldier to ram (3 + Stun). Requires meaningful value: cover destroyed OR a
// ram target — otherwise fall through to advance + cannon fire.
function decideBulldoze(grid, units, enemy, ability) {
  const maxDist = ability.range;
  const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  const players = playersOf(units);
  if (players.length === 0) return null;
  let best = null;
  let bestScore = 0;
  for (const [dx, dy] of dirs) {
    let coverAlongPath = 0;
    for (let dist = 1; dist <= maxDist; dist++) {
      const nx = enemy.x + dx * dist;
      const ny = enemy.y + dy * dist;
      if (nx < 0 || ny < 0 || ny >= grid.length || nx >= grid[0].length) break;
      const tile = grid[ny][nx];
      if (!tile || tile.type === 'blocked') break; // wall stops the charge
      // Any living unit blocks the path — stop before it.
      const occ = units.find((u) => u.alive && u.x === nx && u.y === ny);
      if (occ) break;
      coverAlongPath += countLightCoverOnTile(grid, nx, ny);
      // Score this stop tile.
      let score = coverAlongPath * 15;
      // Ram target: a player adjacent to the final position.
      const ramTarget = players.find(
        (p) => Math.max(Math.abs(p.x - nx), Math.abs(p.y - ny)) === 1
      );
      if (ramTarget) {
        score += 60;
        if (ramTarget.maxHp > 0 && ramTarget.hp <= ramTarget.maxHp * 0.5) score += 15;
      }
      // Advancing toward players.
      const nearest = Math.min(...players.map((p) => Math.max(Math.abs(p.x - nx), Math.abs(p.y - ny))));
      score += (14 - nearest) * 3;
      if (score > bestScore) {
        bestScore = score;
        const path = [];
        for (let i = 0; i <= dist; i++) path.push([enemy.x + dx * i, enemy.y + dy * i]);
        best = {
          path,
          targetId: ramTarget ? ramTarget.id : null,
          coverAlongPath,
          reason: ramTarget
            ? `bulldoze → ram ${ramTarget.name}`
            : `bulldoze · ${coverAlongPath} cover`,
        };
      }
    }
  }
  if (!best) return null;
  // Require meaningful value: cover destroyed OR a ram target. Otherwise save
  // the cooldown and just advance + fire.
  if (best.coverAlongPath === 0 && !best.targetId) return null;
  return {
    type: 'bulldoze',
    abilityId: ability.id,
    path: best.path,
    targetId: best.targetId,
    reason: best.reason,
  };
}

// --- Chapter 2: Alien Fabricator — HARDLIGHT COVER placement ---
// Pick an adjacent tile + direction that best protects an exposed ally (or
// covers a threatened position) from players. Reuses relevantCoverSides so the
// facing matches the actual cover-resolution model. Returns { x, y, dir, reason }
// or null if no meaningful placement exists.
function decideHardlightPlacement(grid, units, enemy, ability) {
  const players = playersOf(units);
  if (players.length === 0) return null;
  let best = null;
  let bestScore = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const tx = enemy.x + dx;
      const ty = enemy.y + dy;
      if (ty < 0 || ty >= grid.length || tx < 0 || tx >= grid[0].length) continue;
      const tile = grid[ty][tx];
      if (!tile || tile.type === 'blocked') continue;
      // Don't place cover on a player-occupied tile (would protect the player).
      const occ = units.find((u) => u.alive && u.x === tx && u.y === ty);
      if (occ && occ.team === 'player') continue;
      const ally = occ && occ.team === 'enemy' ? occ : null;
      for (const dir of ['n', 's', 'e', 'w']) {
        let protectScore = 0;
        for (const p of players) {
          const sides = relevantCoverSides(p, { x: tx, y: ty });
          if (!sides.includes(dir)) continue;
          protectScore += 10;
          if (ally) {
            const st = getCoverState(grid, p, ally);
            if (st === 'exposed') protectScore += 25;
            else if (st === 'flanked') protectScore += 35;
            if (ally.maxHp > 0 && ally.hp <= ally.maxHp * 0.5) protectScore += 15;
          }
        }
        if (ally) protectScore += 5; // prefer protecting an ally on the tile
        if (protectScore > bestScore) {
          bestScore = protectScore;
          best = {
            x: tx,
            y: ty,
            dir,
            reason: ally ? `hardlight · shield ${ally.name}` : 'hardlight · fortify',
          };
        }
      }
    }
  }
  if (bestScore < 20) return null;
  return best;
}

// Alien Fabricator — dual-ability decision. Priority: Field Repair a damaged
// mechanical ally (Bastion) > deploy Hardlight Cover to protect an exposed ally
// > fall through to the basic Fabricator Beam attack / reposition.
function decideFabricatorAction(grid, units, enemy, context) {
  // FIELD REPAIR — top priority. Keeping a Bastion functioning is the
  // Fabricator's core identity.
  const repair = getEnemyAbility('field_repair');
  if (repair && canEnemyUseAbility(enemy, repair)) {
    const target = pickRepairTarget(units, enemy, repair);
    if (target) {
      return {
        type: 'ability',
        abilityId: 'field_repair',
        targetId: target.id,
        targetName: target.name,
        healing: repair.healing,
        reason: `repair ${target.name} · +${repair.healing} HP`,
      };
    }
  }
  // HARDLIGHT COVER — protect an exposed ally.
  const cover = getEnemyAbility('hardlight_cover');
  if (cover && canEnemyUseAbility(enemy, cover) && canDeployHardlight(grid, enemy, cover)) {
    const placement = decideHardlightPlacement(grid, units, enemy, cover);
    if (placement) {
      return {
        type: 'hardlight_cover',
        abilityId: 'hardlight_cover',
        x: placement.x,
        y: placement.y,
        dir: placement.dir,
        reason: placement.reason,
      };
    }
  }
  return null;
}

// Archetype-specific special-ability decision. Returns an ability action when it
// is preferred over a basic attack this step, or null to fall through to the
// normal attack/move logic. Each archetype gets at most one ability, so this
// stays a small, readable switch.
//
// Anti-spam rules are baked into target selection: never Mark an already-Marked
// unit, never Burn an already-Burning unit, never Stun an already-Stunned unit.
function decideAbilityAction(grid, units, enemy, context) {
  // Warden Prime has three abilities — handled by a dedicated boss AI function.
  if (enemy.archetype === 'warden_prime') {
    return decideWardenAction(grid, units, enemy, context);
  }
  // The Harvester (Chapter 2 Boss) has two delayed abilities + a basic cannon.
  // Handled by a dedicated boss AI function. Returns a full decision (including
  // basic attacks) — does not fall through to the generic logic.
  if (enemy.archetype === 'harvester') {
    return decideHarvesterAction(grid, units, enemy, context);
  }
  // Alien Fabricator has two abilities — handled by a dedicated support AI.
  if (enemy.archetype === 'fabricator') {
    return decideFabricatorAction(grid, units, enemy, context);
  }
  // Bastion Mech — BULLDOZE is a movement-type ability (the AI builds the
  // path). Falls through to advance + cannon fire when no good charge exists.
  if (enemy.archetype === 'bastion') {
    const bulldoze = getEnemyAbility('bulldoze');
    if (bulldoze && canEnemyUseAbility(enemy, bulldoze)) {
      const bd = decideBulldoze(grid, units, enemy, bulldoze);
      if (bd) return bd;
    }
    return null;
  }

  // Flash Claw — Overwatch-baiting move decision. Returns a move when a useful
  // bait route exists, or null to fall through to the generic flow (which
  // handles melee attacks via bestAttackFrom and pursuit movement via scoreTile).
  if (enemy.archetype === 'flash_claw') {
    return decideFlashClawAction(grid, units, enemy);
  }

  // Dislocator — COME HERE! forced-movement decision. Returns a come_here
  // action when the tactical value (isolation, cover break, allied follow-up)
  // exceeds the normal Beam Attack value, or null to fall through to the
  // generic flow (which handles the Beam Rifle attack and repositioning).
  if (enemy.archetype === 'dislocator') {
    return decideDislocatorAction(grid, units, enemy);
  }

  const ability = getEnemyAbilityForArchetype(enemy.archetype);
  if (!ability || !canEnemyUseAbility(enemy, ability)) return null;

  if (ability.id === 'mark_target') {
    // Grunt support: mark a visible player that an ally can exploit. Skip if
    // the grunt has a lethal shot of its own — kills beat support.
    const atk = bestAttackFrom(grid, units, enemy);
    if (atk && atk.outcome.killed) return null;
    const candidates = getEnemyAbilityTargets(grid, units, enemy, ability)
      .filter((p) => !hasStatus(p, STATUS_TYPES.MARKED))
      .map((p) => ({ p, allies: alliesAbleToAttack(grid, units, enemy, p) }))
      .filter((c) => c.allies > 0);
    if (candidates.length === 0) return null;
    // Prefer healthy targets with many allies able to follow up.
    candidates.sort((a, b) => (b.p.hp - a.p.hp) + (b.allies - a.allies) * 3);
    const best = candidates[0];
    return {
      type: 'ability',
      abilityId: ability.id,
      targetId: best.p.id,
      targetName: best.p.name,
      reason: `mark ${best.p.name} · ${best.allies} ally${best.allies === 1 ? '' : 's'}`,
    };
  }

  if (ability.id === 'shock_strike') {
    // Rusher control: adjacent strike for 3 + Stun. Prefer when the target is
    // not already stunned (the stun is the point). If no adjacent target, or
    // the target is already stunned, fall through to the basic attack.
    const candidates = getEnemyAbilityTargets(grid, units, enemy, ability)
      .filter((p) => !hasStatus(p, STATUS_TYPES.STUNNED));
    if (candidates.length === 0) return null;
    // Prefer the lowest-HP target the strike can pressure (stun matters more
    // on a unit that will survive to act next phase).
    candidates.sort((a, b) => b.hp - a.hp);
    const best = candidates[0];
    return {
      type: 'ability',
      abilityId: ability.id,
      targetId: best.id,
      targetName: best.name,
      damage: ability.damage,
      reason: `shock ${best.name} · 3 + STUN`,
    };
  }

  if (ability.id === 'incendiary_shot') {
    // Support DoT: 1 + Burning. Prefer against a healthy, unburned player that
    // will act multiple times. If the light rifle can kill, attack instead.
    const atk = bestAttackFrom(grid, units, enemy);
    if (atk && atk.outcome.killed) return null;
    const candidates = getEnemyAbilityTargets(grid, units, enemy, ability)
      .filter((p) => !hasStatus(p, STATUS_TYPES.BURNING) && p.hp >= 4);
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b.hp - a.hp);
    const best = candidates[0];
    return {
      type: 'ability',
      abilityId: ability.id,
      targetId: best.id,
      targetName: best.name,
      damage: ability.damage,
      reason: `incendiary ${best.name} · 1 + BURN`,
    };
  }

  if (ability.id === 'energy_shield') {
    // Bulwark: shield a priority ally (or self if threatened). Skip if no ally
    // needs it — the Bulwark attacks instead. Never idle behind a useless shield.
    const target = pickShieldTarget(grid, units, enemy, ability);
    if (!target) return null;
    return {
      type: 'ability',
      abilityId: ability.id,
      targetId: target.id,
      targetName: target.name,
      isSelf: target.id === enemy.id,
      reason: target.id === enemy.id ? 'shield self' : `shield ${target.name}`,
    };
  }

  if (ability.id === 'phase_step') {
    // Stalker: 0-AP evasive reposition to create a flank or escape. Only used
    // when it meaningfully improves the position. Falls through to normal
    // attack/move if no good phase step exists.
    const ps = decidePhaseStep(grid, units, enemy, ability);
    if (!ps) return null;
    return {
      type: 'phase_step',
      abilityId: ability.id,
      entry: ps.entry,
      reason: ps.reason,
    };
  }

  if (ability.id === 'disruption_beam') {
    // Disruptor: target a player with useful abilities. Prefer support/engineer/
    // heavy classes and targets not already disrupted. If the basic beam can
    // kill, attack instead — kills beat disruption.
    const atk = bestAttackFrom(grid, units, enemy);
    if (atk && atk.outcome.killed) return null;
    const classPriority = { support: 3, engineer: 3, heavy: 2, marksman: 1, assault: 1 };
    const candidates = getEnemyAbilityTargets(grid, units, enemy, ability)
      .filter((p) => !hasStatus(p, STATUS_TYPES.DISRUPTED))
      .map((p) => ({ p, pri: classPriority[p.archetype] || 0 }))
      .sort((a, b) => b.pri - a.pri || b.p.hp - a.p.hp);
    if (candidates.length === 0) return null;
    const best = candidates[0];
    return {
      type: 'ability',
      abilityId: ability.id,
      targetId: best.p.id,
      targetName: best.p.name,
      damage: ability.damage,
      reason: `disrupt ${best.p.name} · +1 AP`,
    };
  }

  if (ability.id === 'plasma_strike') {
    // Artillery: mark a clustered tile (2+ players). If no cluster exists, fall
    // through to the normal beam attack or reposition.
    const tile = decidePlasmaStrikeTile(grid, units, enemy, ability);
    if (!tile) return null;
    return {
      type: 'plasma_strike',
      abilityId: ability.id,
      x: tile.x,
      y: tile.y,
      reason: tile.reason,
    };
  }

  return null;
}

// Decide a single action for an enemy this step. The Battle loop calls this
// repeatedly until it returns 'end' or AP runs out.
export function decideEnemyAction(grid, units, enemy, context = {}) {
  if (!enemy || !enemy.alive || enemy.ap <= 0) {
    return { type: 'end', reason: 'no ap / dead' };
  }
  // Boss objects (Power Relays) never act — they are destructible structures.
  if (enemy.isBossObject) {
    return { type: 'end', reason: 'boss object' };
  }
  let params = AI_PARAMS[enemy.archetype] || AI_PARAMS.grunt;
  // Warden Phase 2/3: switch to aggressive AI params (no command zone anchor).
  // Phase 3 is even more aggressive than Phase 2.
  if (enemy.archetype === 'warden_prime') {
    const phase = context?.bossState?.bossPhase;
    if (phase === BOSS_PHASES.PHASE_3_OVERLOAD) params = AI_PARAMS.warden_prime_phase3;
    else if (phase === BOSS_PHASES.PHASE_2_ADVANCE) params = AI_PARAMS.warden_prime_phase2;
  }
  const players = playersOf(units);
  if (players.length === 0) return { type: 'end', reason: 'no players' };

  // Special ability (archetype-specific). Checked before the ammo gate because
  // abilities do not consume weapon ammo — an empty enemy can still Mark/Stun.
  const abilityAction = decideAbilityAction(grid, units, enemy, context);
  if (abilityAction) return abilityAction;

  // Out of ammo: cannot attack. Reload if a useful shot is available from the
  // current tile; otherwise reposition toward a shooting position, and only
  // reload as a last resort to be ready for the next phase.
  if (!hasAmmo(enemy)) {
    if (enemy.ap < 1) return { type: 'end', reason: 'empty · no ap' };
    const simReloaded = { ...enemy, ammo: getMaxAmmo(enemy) };
    const atk = bestAttackFrom(grid, units, simReloaded);
    if (atk && (atk.outcome.killed || atk.outcome.state !== 'covered' || enemy.ap < 2)) {
      return { type: 'reload', reason: 'reload → attack' };
    }
    const reachable = computeReachable(grid, units, enemy, getMovementRange(enemy));
    if (reachable.size > 0) {
      const currentScore = scoreTile(grid, units, simReloaded, { x: enemy.x, y: enemy.y }, params);
      let best = null;
      for (const [, entry] of reachable) {
        const s = scoreTile(grid, units, simReloaded, entry, params);
        if (!best || s > best.score) best = { entry, score: s };
      }
      if (best && best.score > currentScore + params.moveMargin) {
        return { type: 'move', entry: best.entry, reason: 'move (empty)' };
      }
    }
    return { type: 'reload', reason: 'reload (ready)' };
  }

  // 1. Attack if a useful target exists. High-flank archetypes will skip a
  //    merely covered shot (when they can still move) to seek a flank instead.
  const atk = bestAttackFrom(grid, units, enemy);
  const attackAction = atk
    ? {
        type: 'attack',
        targetId: atk.target.id,
        targetName: atk.target.name,
        state: atk.outcome.state,
        damage: atk.outcome.finalDamage,
        killed: atk.outcome.killed,
        reason: `attack ${atk.outcome.state}${atk.outcome.killed ? ' · KILL' : ''}`,
      }
    : null;

  if (atk) {
    // For Bulwark (frontline tank): if not yet on the front line (nearest player > 2)
    // and still has AP to advance (ap >= 2), advance toward the front line first
    // to establish frontline presence and soak damage rather than settling for a
    // low-impact ranged shot from the rear.
    const isBulwarkAdvancing =
      enemy.archetype === 'bulwark' &&
      enemy.ap >= 2 &&
      !atk.outcome.killed &&
      Math.min(...players.map((p) => gridDistance(enemy, p))) > 2;

    const worthAttacking =
      !isBulwarkAdvancing &&
      (atk.outcome.killed ||
       atk.outcome.state !== 'covered' ||
       params.flankWeight < 1.0 ||
       enemy.ap < 2);
    if (worthAttacking) return attackAction;
    // else fall through to movement to look for a better angle
  }

  // 2. Otherwise consider repositioning.
  const reachable = computeReachable(grid, units, enemy, getMovementRange(enemy));
  if (reachable.size === 0) return attackAction || { type: 'end', reason: 'nowhere to move' };

  const currentScore = scoreTile(grid, units, enemy, { x: enemy.x, y: enemy.y }, params);
  let best = null;
  for (const [, entry] of reachable) {
    const s = scoreTile(grid, units, enemy, entry, params);
    if (!best || s > best.score) best = { entry, score: s };
  }
  // No better position: take the skipped covered shot rather than idle.
  if (!best || best.score <= currentScore + params.moveMargin) {
    return attackAction || { type: 'end', reason: 'no improvement' };
  }

  const simAt = { ...enemy, x: best.entry.x, y: best.entry.y, ap: enemy.ap - 1 };
  const futureAtk = bestAttackFrom(grid, units, simAt);
  const reason = futureAtk
    ? `move to (${best.entry.x},${best.entry.y}) → ${futureAtk.outcome.state}${futureAtk.outcome.killed ? ' · KILL' : ''}`
    : `move to (${best.entry.x},${best.entry.y})`;

  return { type: 'move', entry: best.entry, reason };
}