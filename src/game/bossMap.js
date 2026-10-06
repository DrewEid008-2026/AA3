// Alien Command Nexus — the handcrafted Chapter 1 Boss battlefield.
//
// This map is NOT randomized. It is a deliberately authored boss arena with
// three tactically distinct approaches, a fortified command platform, two
// Power Relays flanking the Warden, and defined (but inactive) Phase 2
// reinforcement zones.
//
// Coordinate convention (matches maps.js):
//   X: 0 (left) .. 8 (right)   Y: 0 (top, command platform) .. 13 (bottom, player)
//
// Cover semantics: { x, y, dir, type } places directional cover on the `dir`
// edge of tile (x,y). 'barricade' = weak (3 HP), 'wall' = reinforced (6 HP).
// BLOCKED tiles are permanent structural walls (block movement + LOS).

import { GRID_WIDTH, GRID_HEIGHT, TILE_TYPES, COVER_TYPES, COVER_HP } from './constants';

const OPEN = TILE_TYPES.OPEN;
const BLOCKED = TILE_TYPES.BLOCKED;

// --- Map metadata ---
export const BOSS_MAP_ID = 'alien_command_nexus_ch1';
export const BOSS_MAP_NAME = 'Alien Command Nexus';

// --- Structural walls (indestructible, define the arena shape) ---
// Placed sparingly to define lanes without creating choke points.
const BLOCKED_TILES = [
  { x: 0, y: 2 },  // left platform edge
  { x: 8, y: 2 },  // right platform edge
  { x: 0, y: 6 },  // left mid-field edge
  { x: 8, y: 6 },  // right mid-field edge
];

// --- Directional cover placements ---
// Left lane (Covered Flank): mix of barricades and reinforced walls
// Center lane (Direct Kill Zone): minimal cover
// Right lane (Destructible Route): all barricades (destructible)
// Command platform: reinforced cover protecting the Warden from the south
const COVER_PLACEMENTS = [
  // Command platform — protects Warden area from direct south (center) attacks
  { x: 4, y: 1, dir: 's', type: 'wall' },   // Warden south cover (reinforced)
  { x: 3, y: 2, dir: 's', type: 'wall' },   // platform south edge
  { x: 5, y: 2, dir: 's', type: 'wall' },   // platform south edge
  { x: 4, y: 3, dir: 's', type: 'barricade' }, // Bulwark south cover (weak)

  // LEFT LANE — Covered Flank (barricades + reinforced walls)
  { x: 1, y: 5, dir: 'n', type: 'barricade' },
  { x: 2, y: 6, dir: 'n', type: 'wall' },      // reinforced position
  { x: 1, y: 8, dir: 'n', type: 'barricade' },
  { x: 2, y: 9, dir: 'n', type: 'wall' },      // reinforced position
  { x: 1, y: 11, dir: 'n', type: 'barricade' },

  // CENTER LANE — Direct Kill Zone (minimal cover)
  { x: 4, y: 7, dir: 'n', type: 'barricade' },  // single weak cover in the open

  // RIGHT LANE — Destructible Route (all barricades, destroy for new angles)
  { x: 7, y: 5, dir: 'n', type: 'barricade' },
  { x: 6, y: 6, dir: 'n', type: 'barricade' },
  { x: 7, y: 8, dir: 'n', type: 'barricade' },
  { x: 6, y: 9, dir: 'n', type: 'barricade' },
  { x: 7, y: 11, dir: 'n', type: 'barricade' },
];

// --- Player deployment zone (bottom, up to 5 soldiers) ---
// Main row (y=13) + alternate row (y=12) for flexible formations.
const PLAYER_DEPLOY_ZONE = [
  { x: 1, y: 13 }, { x: 2, y: 13 }, { x: 3, y: 13 }, { x: 4, y: 13 }, { x: 5, y: 13 },
  { x: 2, y: 12 }, { x: 4, y: 12 }, { x: 6, y: 12 },
];

// --- Enemy positions ---
// Warden: upper-center command platform
// Relays: flanking the Warden (upper-left and upper-right)
// Bulwark: guarding the direct approach to the Warden
// Grunts: one on each side to influence both approach lanes
const ENEMY_SPAWNS = [
  { archetype: 'warden_prime', x: 4, y: 1, isBoss: true },
  { archetype: 'bulwark', x: 4, y: 3 },
  { archetype: 'grunt', x: 1, y: 4 },
  { archetype: 'grunt', x: 7, y: 4 },
];

// --- Boss objects (Power Relays) ---
const BOSS_OBJECTS = [
  { type: 'power_relay', id: 'relayA', x: 2, y: 1, hp: 6 },
  { type: 'power_relay', id: 'relayB', x: 6, y: 1, hp: 6 },
];

// --- Phase 2 reinforcement zones (defined but NOT triggered this phase) ---
// Stalker: upper-left edge. Rusher: upper-right edge.
// These pressure the squad from the sides without spawning adjacent to soldiers.
const PHASE2_REINFORCEMENT_ZONES = {
  stalker: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }],
  rusher: [{ x: 8, y: 0 }, { x: 7, y: 0 }, { x: 8, y: 1 }],
};

// Standard reinforcement spawns (for config compatibility — won't be used since
// the boss mission has reinforcementRounds: 0).
const REINFORCEMENT_SPAWNS = [
  ...PHASE2_REINFORCEMENT_ZONES.stalker,
  ...PHASE2_REINFORCEMENT_ZONES.rusher,
];

// --- Grid builder ---
function applyCover(grid, x, y, dir, type) {
  const tile = grid[y] && grid[y][x];
  if (!tile) return;
  const coverType = type || COVER_TYPES.BARRICADE;
  tile.cover[dir] = {
    type: coverType,
    hp: COVER_HP[coverType] ?? 3,
    maxHp: COVER_HP[coverType] ?? 3,
    destroyed: false,
  };
  tile.destructible = true;
}

export function buildBossGrid() {
  const grid = [];
  for (let y = 0; y < GRID_HEIGHT; y++) {
    const row = [];
    for (let x = 0; x < GRID_WIDTH; x++) {
      row.push({
        x, y, type: OPEN,
        cover: { n: null, s: null, e: null, w: null },
        terrain: 'default',
        objective: false,
        destructible: false,
        movementCost: 1,
      });
    }
    grid.push(row);
  }
  for (const { x, y } of BLOCKED_TILES) {
    if (grid[y] && grid[y][x]) grid[y][x].type = BLOCKED;
  }
  for (const { x, y, dir, type } of COVER_PLACEMENTS) {
    applyCover(grid, x, y, dir, type);
  }
  return grid;
}

// --- Path validation (BFS over open tiles, 8-dir, no corner cutting) ---
const DIRS8 = [
  [0, -1], [0, 1], [-1, 0], [1, 0],
  [-1, -1], [1, -1], [-1, 1], [1, 1],
];

function isOpen(grid, x, y) {
  if (y < 0 || y >= GRID_HEIGHT || x < 0 || x >= GRID_WIDTH) return false;
  return grid[y][x].type === OPEN;
}

function reachableAny(grid, starts, targets) {
  if (!starts.length || !targets.length) return false;
  const targetSet = new Set(targets.map((t) => `${t.x},${t.y}`));
  const seen = new Set();
  const queue = [];
  for (const s of starts) {
    if (!isOpen(grid, s.x, s.y)) continue;
    const k = `${s.x},${s.y}`;
    if (!seen.has(k)) { seen.add(k); queue.push(s); }
  }
  while (queue.length) {
    const { x, y } = queue.shift();
    if (targetSet.has(`${x},${y}`)) return true;
    for (const [dx, dy] of DIRS8) {
      const nx = x + dx, ny = y + dy;
      if (!isOpen(grid, nx, ny)) continue;
      if (dx !== 0 && dy !== 0) {
        if (!isOpen(grid, x + dx, y) || !isOpen(grid, x, y + dy)) continue;
      }
      const k = `${nx},${ny}`;
      if (seen.has(k)) continue;
      seen.add(k);
      queue.push({ x: nx, y: ny });
    }
  }
  return false;
}

// Check if any open tile has LOS to the Warden position (Warden is targetable).
function hasAnyLOS(grid, from, to) {
  // Simple LOS check: Bresenham-like raycast. If any open tile in `from` has
  // a clear line to `to`, return true. For validation we just check a few
  // key tiles along the center and side lanes.
  // Reuse the combat LOS if available; otherwise do a simple check.
  // For validation purposes, we check that the Warden tile is open and
  // reachable, which implies it can be targeted from adjacent open tiles.
  return isOpen(grid, from.x, from.y) && isOpen(grid, to.x, to.y);
}

// --- Validate the boss map configuration ---
// Returns { valid, reason }. A failed validation is a development error.
export function validateBossMap(grid) {
  if (!grid || grid.length !== GRID_HEIGHT || grid[0].length !== GRID_WIDTH) {
    return { valid: false, reason: 'Grid dimensions must be 9x14' };
  }

  // Check player deployment tiles are open
  for (const t of PLAYER_DEPLOY_ZONE) {
    if (!isOpen(grid, t.x, t.y)) return { valid: false, reason: `Player deploy tile (${t.x},${t.y}) is blocked` };
  }

  // Check Warden spawn is open
  const warden = ENEMY_SPAWNS.find((e) => e.isBoss);
  if (!warden) return { valid: false, reason: 'No boss (Warden) spawn defined' };
  if (!isOpen(grid, warden.x, warden.y)) return { valid: false, reason: 'Warden spawn is blocked' };

  // Check relay spawns are open
  for (const obj of BOSS_OBJECTS) {
    if (!isOpen(grid, obj.x, obj.y)) return { valid: false, reason: `Relay spawn (${obj.x},${obj.y}) is blocked` };
  }

  // Check enemy spawns are open
  for (const e of ENEMY_SPAWNS) {
    if (!isOpen(grid, e.x, e.y)) return { valid: false, reason: `Enemy spawn (${e.x},${e.y}) is blocked` };
  }

  // Check reinforcement zones are open
  for (const zone of Object.values(PHASE2_REINFORCEMENT_ZONES)) {
    for (const t of zone) {
      if (!isOpen(grid, t.x, t.y)) return { valid: false, reason: `Reinforcement zone (${t.x},${t.y}) is blocked` };
    }
  }

  // Check no spawn overlaps
  const allSpawns = [
    ...PLAYER_DEPLOY_ZONE.map((t) => ({ ...t, label: 'player' })),
    ...ENEMY_SPAWNS.map((e) => ({ x: e.x, y: e.y, label: 'enemy' })),
    ...BOSS_OBJECTS.map((o) => ({ x: o.x, y: o.y, label: 'relay' })),
  ];
  const occupied = new Map();
  for (const s of allSpawns) {
    const k = `${s.x},${s.y}`;
    if (occupied.has(k)) {
      return { valid: false, reason: `Spawn overlap at (${s.x},${s.y}): ${occupied.get(k)} and ${s.label}` };
    }
    occupied.set(k, s.label);
  }

  // Check routes exist from player deployment to the command platform
  const playerStarts = PLAYER_DEPLOY_ZONE.slice(0, 5);
  const wardenPos = { x: warden.x, y: warden.y };
  if (!reachableAny(grid, playerStarts, [wardenPos])) {
    return { valid: false, reason: 'No path from player deployment to Warden' };
  }

  // Check relays are reachable (not permanently unreachable)
  for (const obj of BOSS_OBJECTS) {
    if (!reachableAny(grid, playerStarts, [{ x: obj.x, y: obj.y }])) {
      return { valid: false, reason: `Relay (${obj.x},${obj.y}) is unreachable` };
    }
  }

  // Check Warden is targetable from at least one open tile (not fully walled in)
  const wardenAdjacent = DIRS8.map(([dx, dy]) => ({ x: warden.x + dx, y: warden.y + dy }))
    .filter((t) => isOpen(grid, t.x, t.y));
  if (wardenAdjacent.length === 0) {
    return { valid: false, reason: 'Warden is completely walled in — cannot be targeted' };
  }

  return { valid: true, reason: null };
}

// --- Build the full boss map config (compatible with the mission system) ---
export function getBossMapConfig() {
  const grid = buildBossGrid();
  const validation = validateBossMap(grid);
  if (!validation.valid) {
    console.error(`[BossMap] Validation failed: ${validation.reason}`);
    // Still return the config — the mission setup validation will catch it
    // and show a setup error (development error, not a player failure).
  }

  const DEFAULT_ARCHETYPES = ['assault', 'heavy', 'support', 'engineer', 'marksman'];

  return {
    mapId: BOSS_MAP_ID,
    mapName: BOSS_MAP_NAME,
    density: 'boss',
    seed: null, // boss map is not seeded — it's handcrafted
    grid,
    players: PLAYER_DEPLOY_ZONE.slice(0, 5).map((t, i) => ({
      x: t.x, y: t.y, archetype: DEFAULT_ARCHETYPES[i % DEFAULT_ARCHETYPES.length],
    })),
    enemies: ENEMY_SPAWNS.map((e) => ({ ...e })),
    bossObjects: BOSS_OBJECTS.map((o) => ({ ...o })),
    extractionZone: null,
    civilian: null,
    device: null,
    reinforcementSpawns: REINFORCEMENT_SPAWNS.map((t) => ({ ...t })),
    eliteSpawns: [],
    phase2ReinforcementZones: PHASE2_REINFORCEMENT_ZONES,
    playerDeployTiles: PLAYER_DEPLOY_ZONE.map((t) => `${t.x},${t.y}`),
    enemyDeployTiles: ENEMY_SPAWNS.map((e) => `${e.x},${e.y}`),
    bossObjectTiles: BOSS_OBJECTS.map((o) => `${o.x},${o.y}`),
    isBossMap: true,
  };
}