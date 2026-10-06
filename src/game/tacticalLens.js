// Pure computation for the Tactical Lens information overlay. All functions are
// read-only — they never mutate game state. Reuse existing LOS / range / cover
// helpers so Lens data always matches real combat calculations.
//
// Performance: these run only when the Lens opens or the inspected unit / board
// changes (Battle.jsx memoizes them). Each scans the 9x14 grid once per enemy.
import { GRID_WIDTH, GRID_HEIGHT, TILE_TYPES, TEAMS } from './constants';
import {
  getUnitWeapon, gridDistance, hasLineOfSight, getCoverState, COVER_STATE_LABELS,
  OPPOSITE_DIR, NEIGHBOR_OFFSET,
} from './combat';
import { hasAmmo, getAmmo, getMaxAmmo } from './ammo';
import { STATUS_DEFS } from './statuses';
import { getEnemyAbilityForArchetype } from './enemyAbilities';
import { getShieldValue, getCoreShieldValue } from './shield';
import { PLAYER_ARCHETYPES, ENEMY_ARCHETYPES } from './unitTypes';
import { isSiegeDestructibleTile, isDestroyedTile, getTileKindLabel } from './tileDestruction';
import { hasFlashReflexes, FLASH_REFLEXES_INFO } from './flashReflexes';
import { hasLonePrey, LONE_PREY_INFO, countNearbyAllies } from './lonePrey';
import { isVolatileTile } from './volatileTiles';

const DIR_LABELS = { n: 'North', s: 'South', e: 'East', w: 'West' };

function iterOpenTiles(grid, fn) {
  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      const tile = grid[y] && grid[y][x];
      if (!tile || tile.type === TILE_TYPES.BLOCKED) continue;
      fn(x, y, tile);
    }
  }
}

// Threat: every tile an alive enemy could hit with a basic weapon attack from
// its CURRENT position (range + LOS + has ammo). No future movement, no
// abilities, no grenades — current basic-weapon danger only.
export function computeThreatTiles(grid, units) {
  const threatened = new Set();
  for (const e of units) {
    if (!e || !e.alive || e.team !== TEAMS.ENEMY) continue;
    const weapon = getUnitWeapon(e);
    if (!weapon || !hasAmmo(e)) continue;
    iterOpenTiles(grid, (x, y) => {
      if (gridDistance(e, { x, y }) > weapon.range) return;
      if (!hasLineOfSight(grid, e, { x, y })) return;
      threatened.add(`${x},${y}`);
    });
  }
  return threatened;
}

// Weapon range tiles for a single inspected unit (range + LOS). Used to
// visualize one enemy's (or friendly's) current basic-weapon coverage.
export function computeUnitRangeTiles(grid, unit) {
  const tiles = new Set();
  if (!unit || !unit.alive) return tiles;
  const weapon = getUnitWeapon(unit);
  if (!weapon) return tiles;
  iterOpenTiles(grid, (x, y) => {
    if (gridDistance(unit, { x, y }) > weapon.range) return;
    if (!hasLineOfSight(grid, unit, { x, y })) return;
    tiles.add(`${x},${y}`);
  });
  return tiles;
}

// Current valid lines of fire for an inspected unit to opposite-team targets
// (range + LOS + alive). Only drawn for the inspected unit, never all units.
export function computeLinesOfFire(grid, units, unit) {
  if (!unit || !unit.alive) return [];
  const weapon = getUnitWeapon(unit);
  if (!weapon) return [];
  const lines = [];
  for (const t of units) {
    if (!t || !t.alive || t.team === unit.team) continue;
    if (t.downed) continue;
    if (gridDistance(unit, t) > weapon.range) continue;
    if (!hasLineOfSight(grid, unit, t)) continue;
    lines.push({ from: { x: unit.x, y: unit.y }, to: { x: t.x, y: t.y }, targetId: t.id, targetTeam: t.team });
  }
  return lines;
}

// Directional cover info for a tile (for terrain inspection). Bidirectional:
// includes cover on the tile's own edges AND cover on adjacent neighbor tiles
// that faces this tile (the other side of a shared edge), since both protect an
// occupant of this tile.
export function getCoverInfo(grid, x, y) {
  const tile = grid[y] && grid[y][x];
  if (!tile) return null;
  const sides = [];
  if (tile.cover) {
    for (const d of ['n', 's', 'e', 'w']) {
      const c = tile.cover[d];
      if (c) sides.push({ dir: d, label: DIR_LABELS[d], hp: c.hp, maxHp: c.maxHp, destroyed: c.destroyed, type: c.type, fromNeighbor: false });
    }
  }
  // Neighbor-facing cover (the other side of a shared edge) also protects this tile.
  for (const d of ['n', 's', 'e', 'w']) {
    const [dx, dy] = NEIGHBOR_OFFSET[d];
    const neighbor = grid[y + dy] && grid[y + dy][x + dx];
    if (!neighbor || !neighbor.cover) continue;
    const opp = neighbor.cover[OPPOSITE_DIR[d]];
    if (opp) sides.push({ dir: d, label: `${DIR_LABELS[d]} (adjacent)`, hp: opp.hp, maxHp: opp.maxHp, destroyed: opp.destroyed, type: opp.type, fromNeighbor: true });
  }
  const activeSides = sides.filter((s) => !s.destroyed);
  return {
    x, y,
    blocked: tile.type === TILE_TYPES.BLOCKED,
    destructible: !!tile.destructible || activeSides.some((s) => s.type !== 'wall'),
    sides,
    hasActiveCover: activeSides.length > 0,
    // Destructible Map Tile info (distinct from destructible Cover).
    siegeDestructible: isSiegeDestructibleTile(tile),
    tileDestroyed: isDestroyedTile(tile),
    tileKindLabel: getTileKindLabel(tile),
    // Volatile Tile hazard info (spec 21, 23).
    volatile: isVolatileTile(tile),
  };
}

export function getTerrainLabel(coverInfo) {
  if (!coverInfo) return 'Open';
  if (coverInfo.blocked) return 'Blocked Terrain';
  if (coverInfo.volatile) return 'VOLATILE';
  if (!coverInfo.hasActiveCover) return 'Open Ground';
  const active = coverInfo.sides.filter((s) => !s.destroyed);
  const maxHp = Math.max(...active.map((s) => s.maxHp));
  if (maxHp >= 6) return 'Reinforced Cover';
  if (maxHp >= 4) return 'Cover';
  return 'Weak Cover';
}

// Cover state for a unit relative to its nearest opponent — gives the player a
// quick "how am I protected right now" read in the inspection card.
function nearestOpponentCoverState(grid, units, unit) {
  const opponents = units.filter((u) => u.alive && u.team !== unit.team && !u.downed);
  if (opponents.length === 0) return 'exposed';
  let nearest = opponents[0];
  let nd = gridDistance(unit, nearest);
  for (const o of opponents) {
    const d = gridDistance(unit, o);
    if (d < nd) { nd = d; nearest = o; }
  }
  return getCoverState(grid, nearest, unit);
}

// Full inspection info for a unit (friendly or enemy). The InspectionCard
// renders this; statuses are included with their descriptions so the card can
// show tooltips without importing status defs itself.
export function getUnitInspectInfo(unit, grid, units) {
  if (!unit) return null;
  const weapon = getUnitWeapon(unit);
  const isPlayer = unit.team === TEAMS.PLAYER;
  const archetype = isPlayer ? PLAYER_ARCHETYPES[unit.class] : ENEMY_ARCHETYPES[unit.archetype];
  const coverState = nearestOpponentCoverState(grid, units, unit);
  const statuses = (unit.statuses || []).map((s) => ({
    type: s.type,
    name: STATUS_DEFS[s.type]?.name || s.type,
    shortDesc: STATUS_DEFS[s.type]?.shortDesc || '',
    turnsRemaining: s.turnsRemaining,
  }));
  const cooldowns = unit.cooldowns
    ? Object.entries(unit.cooldowns).filter(([, v]) => v > 0).map(([k, v]) => ({ id: k, remaining: v }))
    : [];
  let enemyAbility = null;
  if (!isPlayer) {
    const ab = getEnemyAbilityForArchetype(unit.archetype);
    if (ab) {
      const cd = unit.cooldowns?.[ab.id] || 0;
      enemyAbility = { name: ab.name, desc: ab.desc, cooldownRemaining: cd, ready: cd === 0 };
    }
  }
  // Passives (spec 31-32): Flash Reflexes for Flash Claw, Lone Prey for
  // Executioner. Displayed in the inspection card and summarized as short
  // labels in the Tactical Lens.
  const passives = [];
  if (!isPlayer && hasFlashReflexes(unit)) {
    passives.push({ ...FLASH_REFLEXES_INFO });
  }
  if (!isPlayer && hasLonePrey(unit)) {
    passives.push({ ...LONE_PREY_INFO });
  }
  // Isolation state (spec 14): show whether a player soldier is currently
  // isolated (no active ally within 2 tiles). Used by the inspection card to
  // warn the player about Lone Prey vulnerability. Recalculated dynamically
  // from current battlefield positions (spec 30-31).
  let isolated = false;
  let nearbyAllyCount = 0;
  if (isPlayer && !unit.downed) {
    nearbyAllyCount = countNearbyAllies(unit, units);
    isolated = nearbyAllyCount === 0;
  }
  return {
    kind: isPlayer ? 'player' : 'enemy',
    unitId: unit.id,
    name: unit.name,
    role: unit.role || archetype?.role || '',
    className: archetype?.name || unit.class || unit.archetype,
    hp: unit.hp,
    maxHp: unit.maxHp,
    ap: unit.ap,
    maxAp: unit.maxAp,
    downed: !!unit.downed,
    weaponName: weapon?.name || '—',
    damage: weapon?.damage ?? 0,
    range: weapon?.range ?? 0,
    ammo: weapon ? getAmmo(unit) : null,
    maxAmmo: weapon ? getMaxAmmo(unit) : null,
    movement: archetype?.movement ?? null,
    behavior: archetype?.behavior || archetype?.role || '',
    statuses,
    cooldowns,
    coverState,
    coverLabel: COVER_STATE_LABELS[coverState],
    elite: !!unit.elite,
    shield: getShieldValue(unit),
    coreShield: getCoreShieldValue(unit),
    coreShieldMax: unit.coreShieldMax || 0,
    isBoss: !!unit.isBoss,
    isBossObject: !!unit.isBossObject,
    armor: unit.armor || 0,
    armorName: unit.armorName || null,
    armorMovementModifier: unit.armorMovementModifier || 0,
    finalMovement: unit.movement,
    enemyAbility,
    passives,
    isolated,
    nearbyAllyCount,
  };
}