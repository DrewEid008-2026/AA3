// THE HARVESTER PIT — the handcrafted Chapter 2 Boss battlefield.
//
// This map is NOT randomized and is NOT part of the standard mission map pool.
// It is a deliberately authored alien industrial excavation arena built around
// three tactically distinct approaches to an upper-center Harvester Platform.
//
// This phase builds ONLY the arena foundation. The Harvester's combat AI,
// attacks, phase transitions, Siege Charge, reinforcements, and rewards are
// NOT implemented here — they belong to later prompts. The map defines the
// space, the Siege-destructible structural tiles, the indestructible geometry,
// normal destructible cover, and data-only placeholders for future boss
// behavior (charge lanes, hazard regions, reinforcement zones, boss spawn).
//
// Coordinate convention (matches maps.js / bossMap.js):
//   X: 0 (left) .. 8 (right)   Y: 0 (top, Harvester platform) .. 13 (bottom, player)
//
// Cover semantics: { x, y, dir, type } places directional cover on the `dir`
// edge of tile (x,y). 'barricade' = weak (3 HP), 'wall' = reinforced (6 HP).
//
// Tile kinds:
//   - INDESTRUCTIBLE: permanent BLOCKED walls (arena edges, platform foundations).
//   - SIEGE-DESTRUCTIBLE: BLOCKED tiles obliterated only by explicitly authorized
//     attacks (future Siege Charge / dev Siege Test). Become OPEN when destroyed.
//     Normal weapons and explosives never destroy them.
//   - NORMAL COVER: directional barricades/walls with HP (existing cover system).

import { GRID_WIDTH, GRID_HEIGHT, TILE_TYPES, COVER_TYPES, COVER_HP, TILE_DESTRUCTION_CLASSES } from './constants';

const OPEN = TILE_TYPES.OPEN;
const BLOCKED = TILE_TYPES.BLOCKED;

// --- Map metadata ---
export const HARVESTER_PIT_MAP_ID = 'harvester_pit_ch2';
export const HARVESTER_PIT_MAP_NAME = 'The Harvester Pit';

// --- Indestructible structural tiles ---
// Define the arena frame and the Harvester Platform foundations. Future Siege
// Charge can never destroy these. They block movement + LOS permanently.
//   (0,0),(8,0)       — upper arena corners
//   (1,1),(7,1)       — Harvester Platform side walls (define the 5-wide platform)
//   (0,3),(8,3)       — upper excavation-edge pillars (break extreme flank LOS)
const INDESTRUCTIBLE_TILES = [
  { x: 0, y: 0 }, { x: 8, y: 0 },
  { x: 1, y: 1 }, { x: 7, y: 1 },
  { x: 0, y: 3 }, { x: 8, y: 3 },
];

// --- Siege-destructible structural tiles ---
// Reinforced alien structural blocks that separate the three routes. Intact =
// impassable, block LOS. Destroyed (by future Siege Charge / dev Siege Test) =
// OPEN ground, opening new lateral routes and firing lanes. Normal attacks and
// explosives cannot destroy these.
//
// Route dividers run vertically at x=2 (left/center divider) and x=6
// (center/right divider), broken by open junction rows at y=6 and y=9 that
// provide crossover at start. Destroying any divider tile opens an additional
// crossover at that row.
const SIEGE_TILES = [
  // Left / Center divider (x=2)
  { x: 2, y: 3 }, { x: 2, y: 4 }, { x: 2, y: 5 },
  { x: 2, y: 7 }, { x: 2, y: 8 },
  { x: 2, y: 10 },
  // Center / Right divider (x=6)
  { x: 6, y: 3 }, { x: 6, y: 4 }, { x: 6, y: 5 },
  { x: 6, y: 7 }, { x: 6, y: 8 },
  { x: 6, y: 10 },
];

// --- Normal destructible cover (directional) ---
// Distributed intentionally: forward cover, fallback cover, exposed gaps, long
// firing lanes. The arena becomes MORE open as the boss destroys terrain.
const COVER_PLACEMENTS = [
  // --- Harvester Platform south edge (reinforced, partially shields platform) ---
  { x: 3, y: 2, dir: 's', type: 'wall' },
  { x: 5, y: 2, dir: 's', type: 'wall' },
  { x: 4, y: 2, dir: 's', type: 'barricade' }, // weaker center gap

  // --- LEFT: Industrial Route (machinery-heavy, rich destructible cover) ---
  { x: 1, y: 3, dir: 'n', type: 'barricade' },
  { x: 0, y: 4, dir: 'n', type: 'wall' },      // reinforced machinery
  { x: 1, y: 5, dir: 'n', type: 'barricade' },
  { x: 0, y: 7, dir: 'n', type: 'wall' },      // mid-left reinforced
  { x: 1, y: 8, dir: 'n', type: 'barricade' },
  { x: 0, y: 9, dir: 'n', type: 'wall' },      // junction-left station
  { x: 1, y: 11, dir: 'n', type: 'barricade' },
  { x: 0, y: 12, dir: 'n', type: 'barricade' },

  // --- CENTER: Excavation Causeway (shortest, most exposed, minimal cover) ---
  { x: 4, y: 5, dir: 'n', type: 'barricade' },  // temporary mid cover
  { x: 4, y: 7, dir: 'n', type: 'barricade' },
  { x: 4, y: 10, dir: 'n', type: 'barricade' },

  // --- RIGHT: Service / Fabrication Route (workstations, cover pockets) ---
  { x: 7, y: 3, dir: 'n', type: 'barricade' },
  { x: 8, y: 4, dir: 'n', type: 'wall' },       // reinforced station
  { x: 7, y: 5, dir: 'n', type: 'barricade' },
  { x: 8, y: 7, dir: 'n', type: 'wall' },       // mid-right reinforced
  { x: 7, y: 8, dir: 'n', type: 'barricade' },
  { x: 8, y: 9, dir: 'n', type: 'wall' },        // junction-right station
  { x: 7, y: 11, dir: 'n', type: 'barricade' },
  { x: 8, y: 12, dir: 'n', type: 'barricade' },

  // --- Crossover junction cover (both junction rows) ---
  { x: 3, y: 6, dir: 'n', type: 'barricade' },
  { x: 5, y: 6, dir: 'n', type: 'barricade' },
  { x: 3, y: 9, dir: 'n', type: 'barricade' },
  { x: 5, y: 9, dir: 'n', type: 'barricade' },
];

// --- Player deployment zone (lower end, supports 3-5 soldiers) ---
// Ordered so the first 3 positions spread left/center/right; positions 4-5
// fill in the inner center for a full 5-squad deploy without stacking.
const PLAYER_DEPLOY_ZONE = [
  { x: 1, y: 13 }, { x: 4, y: 13 }, { x: 7, y: 13 },  // 3-squad spread
  { x: 3, y: 13 }, { x: 5, y: 13 },                    // 4-5 squad fill
  { x: 2, y: 12 }, { x: 6, y: 12 }, { x: 4, y: 12 },   // alternates
];

// --- Enemy spawns (placeholder — Harvester stats exist, AI is not implemented) ---
// The Harvester occupies the platform center. A Bulwark guards the center
// causeway top. Two Hardened Grunts flank the Harvester on the platform.
// No Power Relays, no invulnerability structures (Part 35).
const ENEMY_SPAWNS = [
  { archetype: 'harvester', x: 4, y: 1, isBoss: true },
  { archetype: 'bulwark', x: 4, y: 3 },
  { archetype: 'grunt', x: 2, y: 1, hardened: true },
  { archetype: 'grunt', x: 6, y: 1, hardened: true },
];

// --- Boss spawn placeholder (Part 33) ---
// Data-only. The Harvester unit itself is spawned via ENEMY_SPAWNS; this
// records the intended footprint / facing / movement area for future boss
// behavior without defining stats or abilities here.
export const BOSS_SPAWN = {
  bossSpawnId: 'harvester_primary',
  x: 4,
  y: 1,
  facing: 'south',
  footprint: [{ x: 4, y: 1 }],
  movementArea: 'platform', // x=2..6, y=1..2 (open platform interior)
};

// --- Phase 2 reinforcement zones (defined, NOT triggered this phase) ---
// Two zones: upper-left industrial, upper-right service/fabrication. They do
// not overlap player deployment, the boss footprint, or any structural tile,
// and remain valid after Siege destruction (all zone tiles are OPEN).
const REINFORCEMENT_ZONES = {
  upper_left: [{ x: 0, y: 4 }, { x: 1, y: 3 }, { x: 0, y: 5 }],
  upper_right: [{ x: 8, y: 4 }, { x: 7, y: 3 }, { x: 8, y: 5 }],
};

// Standard reinforcement spawns (config compatibility — boss mission has
// reinforcementRounds: 0, so these never fire; included for shape compatibility).
const REINFORCEMENT_SPAWNS = [
  ...REINFORCEMENT_ZONES.upper_left,
  ...REINFORCEMENT_ZONES.upper_right,
];

// --- Data-only future Siege Charge lanes (Part 19-20) ---
// Straight-line paths the future Harvester could charge along. Each lists the
// kind of terrain it crosses. NOT implemented — no charge ability exists yet.
// These give the future boss behavior designer ready-made, validated lanes.
const SIEGE_CHARGE_LANES = [
  { id: 'center_column', from: { x: 4, y: 1 }, to: { x: 4, y: 13 }, crosses: 'open ground + destructible cover' },
  { id: 'left_divider_smash', from: { x: 2, y: 1 }, to: { x: 2, y: 13 }, crosses: '6 left route divider siege walls' },
  { id: 'right_divider_smash', from: { x: 6, y: 1 }, to: { x: 6, y: 13 }, crosses: '6 right route divider siege walls' },
  { id: 'upper_row_charge', from: { x: 0, y: 4 }, to: { x: 8, y: 4 }, crosses: 'siege walls at x=2 and x=6 + cover' },
  { id: 'mid_junction_charge', from: { x: 0, y: 6 }, to: { x: 8, y: 6 }, crosses: 'open junction row' },
  { id: 'lower_junction_charge', from: { x: 0, y: 9 }, to: { x: 8, y: 9 }, crosses: 'open junction row' },
];

// --- Data-only future hazard regions (Part 29-32) ---
// Valid 3x3 Tremor Slam areas (all nine tiles OPEN at start), straight
// Excavation Beam lanes (rows/columns), and the Phase 3 Meltdown area near the
// platform. None of these are activated yet — the map merely reserves space.
const TREMOR_AREAS = [
  { center: { x: 4, y: 6 } },   // mid-center junction
  { center: { x: 4, y: 9 } },   // lower-center junction
  { center: { x: 4, y: 11 } },  // lower approach
  { center: { x: 4, y: 12 } },  // deploy-adjacent
];

const BEAM_LANES = [
  { id: 'column_x4', from: { x: 4, y: 1 }, to: { x: 4, y: 13 } }, // center column
  { id: 'column_x0', from: { x: 0, y: 1 }, to: { x: 0, y: 13 } }, // left edge
  { id: 'column_x8', from: { x: 8, y: 1 }, to: { x: 8, y: 13 } }, // right edge
  { id: 'row_y6', from: { x: 0, y: 6 }, to: { x: 8, y: 6 } },     // mid junction
  { id: 'row_y9', from: { x: 0, y: 9 }, to: { x: 8, y: 9 } },     // lower junction
  { id: 'row_y11', from: { x: 0, y: 11 }, to: { x: 8, y: 11 } },  // approach row
];

// Phase 3 Meltdown zone: open ground around the platform for 2-3 hazard tiles
// plus player repositioning. The platform interior (x=2..6, y=1..2) and the
// apron row (y=3 center) provide this space.
const MELTDOWN_ZONE = [
  { x: 3, y: 2 }, { x: 5, y: 2 }, { x: 4, y: 3 },
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

function applySiegeTile(grid, x, y, kind) {
  const tile = grid[y] && grid[y][x];
  if (!tile) return;
  tile.type = BLOCKED;
  tile.isDestructibleTile = true;
  tile.tileDestructionClass = TILE_DESTRUCTION_CLASSES.SIEGE;
  tile.destroyedReplacementTileType = OPEN;
  tile.currentTileState = 'intact';
  tile.tileKind = kind || 'alien_structural_block';
}

export function buildHarvesterPitGrid() {
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
        // Destructible Map Tile fields (distinct from destructible Cover).
        isDestructibleTile: false,
        tileDestructionClass: null,
        destroyedReplacementTileType: OPEN,
        currentTileState: 'intact',
        tileKind: null,
      });
    }
    grid.push(row);
  }

  // Indestructible structural walls.
  for (const { x, y } of INDESTRUCTIBLE_TILES) {
    if (grid[y] && grid[y][x]) grid[y][x].type = BLOCKED;
  }
  // Siege-destructible structural tiles.
  for (const { x, y } of SIEGE_TILES) {
    applySiegeTile(grid, x, y, 'alien_structural_block');
  }
  // Normal directional cover.
  for (const { x, y, dir, type } of COVER_PLACEMENTS) {
    applyCover(grid, x, y, dir, type);
  }

  // Tag terrain regions for future visual/inspection flavor (lightweight).
  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      const t = grid[y][x];
      if (t.type !== OPEN) continue;
      if (y <= 2 && x >= 2 && x <= 6) t.terrain = 'platform';
      else if (x <= 2) t.terrain = 'industrial';
      else if (x >= 6) t.terrain = 'fabrication';
      else t.terrain = 'excavation';
    }
  }

  return grid;
}

// --- Pathfinding validation (BFS over open tiles, 8-dir, no corner cutting) ---
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

// All open tiles reachable from the player deployment zone (full connectivity
// check — used to verify no route is accidentally sealed at start).
function reachableAllOpen(grid, starts) {
  const seen = new Set();
  const queue = [];
  for (const s of starts) {
    if (!isOpen(grid, s.x, s.y)) continue;
    const k = `${s.x},${s.y}`;
    if (!seen.has(k)) { seen.add(k); queue.push(s); }
  }
  let openCount = 0;
  for (let y = 0; y < GRID_HEIGHT; y++)
    for (let x = 0; x < GRID_WIDTH; x++)
      if (isOpen(grid, x, y)) openCount++;
  while (queue.length) {
    const { x, y } = queue.shift();
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
  return seen.size === openCount;
}

// --- Validate the Harvester Pit configuration ---
// Returns { valid, reason }. A failed validation is a development error.
export function validateHarvesterPit(grid) {
  if (!grid || grid.length !== GRID_HEIGHT || grid[0].length !== GRID_WIDTH) {
    return { valid: false, reason: 'Grid dimensions must be 9x14' };
  }

  // Player deployment tiles are open.
  for (const t of PLAYER_DEPLOY_ZONE) {
    if (!isOpen(grid, t.x, t.y)) return { valid: false, reason: `Player deploy tile (${t.x},${t.y}) is blocked` };
  }

  // Boss spawn is open.
  const boss = ENEMY_SPAWNS.find((e) => e.isBoss);
  if (!boss) return { valid: false, reason: 'No boss (Harvester) spawn defined' };
  if (!isOpen(grid, boss.x, boss.y)) return { valid: false, reason: 'Harvester spawn is blocked' };

  // Enemy spawns are open.
  for (const e of ENEMY_SPAWNS) {
    if (!isOpen(grid, e.x, e.y)) return { valid: false, reason: `Enemy spawn (${e.x},${e.y}) is blocked` };
  }

  // Reinforcement zones are open (and remain valid after Siege destruction —
  // none of these tiles are Siege-destructible).
  for (const zone of Object.values(REINFORCEMENT_ZONES)) {
    for (const t of zone) {
      if (!isOpen(grid, t.x, t.y)) return { valid: false, reason: `Reinforcement zone (${t.x},${t.y}) is blocked` };
    }
  }

  // No spawn overlaps.
  const allSpawns = [
    ...PLAYER_DEPLOY_ZONE.map((t) => ({ ...t, label: 'player' })),
    ...ENEMY_SPAWNS.map((e) => ({ x: e.x, y: e.y, label: 'enemy' })),
  ];
  const occupied = new Map();
  for (const s of allSpawns) {
    const k = `${s.x},${s.y}`;
    if (occupied.has(k)) {
      return { valid: false, reason: `Spawn overlap at (${s.x},${s.y}): ${occupied.get(k)} and ${s.label}` };
    }
    occupied.set(k, s.label);
  }

  // All three routes reach the Harvester platform from player deployment.
  const playerStarts = PLAYER_DEPLOY_ZONE.slice(0, 5);
  const platformTiles = [
    { x: 3, y: 2 }, { x: 4, y: 2 }, { x: 5, y: 2 }, // platform apron (y=2)
    { x: 3, y: 1 }, { x: 5, y: 1 },                 // platform flanks (boss at 4,1)
  ];
  if (!reachableAny(grid, playerStarts, platformTiles)) {
    return { valid: false, reason: 'No path from player deployment to Harvester platform' };
  }

  // Left route (x=0..1) reaches the platform.
  const leftStarts = playerStarts.filter((t) => t.x <= 2);
  if (!reachableAny(grid, leftStarts, [{ x: 2, y: 2 }])) {
    return { valid: false, reason: 'Left Industrial Route is sealed at start' };
  }
  // Center route (x=3..5) reaches the platform.
  const centerStarts = playerStarts.filter((t) => t.x >= 3 && t.x <= 5);
  if (!reachableAny(grid, centerStarts, [{ x: 4, y: 2 }])) {
    return { valid: false, reason: 'Center Excavation Causeway is sealed at start' };
  }
  // Right route (x=6..8) reaches the platform.
  const rightStarts = playerStarts.filter((t) => t.x >= 6);
  if (!reachableAny(grid, rightStarts, [{ x: 6, y: 2 }])) {
    return { valid: false, reason: 'Right Service Route is sealed at start' };
  }

  // Crossover: at least one junction row connects left to right without forcing
  // Siege destruction (the open junction rows at y=6 and y=9).
  const junctionLeft = [{ x: 0, y: 6 }];
  const junctionRight = [{ x: 8, y: 6 }];
  if (!reachableAny(grid, junctionLeft, junctionRight)) {
    return { valid: false, reason: 'No open crossover between left and right routes at start' };
  }

  // Boss platform is not walled in — at least 3 adjacent open tiles (room to move).
  const bossAdjacent = DIRS8.map(([dx, dy]) => ({ x: boss.x + dx, y: boss.y + dy }))
    .filter((t) => isOpen(grid, t.x, t.y));
  if (bossAdjacent.length < 3) {
    return { valid: false, reason: 'Harvester platform is too cramped — needs room for a large boss' };
  }

  // Every open tile is reachable from player deployment (no isolated pockets).
  if (!reachableAllOpen(grid, playerStarts)) {
    return { valid: false, reason: 'Map contains unreachable open tiles' };
  }

  // Tremor 3x3 areas are valid at start (all nine tiles open).
  for (const { center } of TREMOR_AREAS) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!isOpen(grid, center.x + dx, center.y + dy)) {
          return { valid: false, reason: `Tremor area around (${center.x},${center.y}) overlaps blocked terrain` };
        }
      }
    }
  }

  return { valid: true, reason: null };
}

// --- Build the full boss map config (compatible with the mission system) ---
export function getHarvesterPitConfig() {
  const grid = buildHarvesterPitGrid();
  const validation = validateHarvesterPit(grid);
  if (!validation.valid) {
    console.error(`[HarvesterPit] Validation failed: ${validation.reason}`);
    // Still return the config — the mission setup validation will surface a
    // setup error (development error, not a player failure).
  }

  const DEFAULT_ARCHETYPES = ['assault', 'heavy', 'support', 'engineer', 'marksman'];

  return {
    mapId: HARVESTER_PIT_MAP_ID,
    mapName: HARVESTER_PIT_MAP_NAME,
    density: 'boss',
    seed: null, // handcrafted — not seeded
    grid,
    players: PLAYER_DEPLOY_ZONE.slice(0, 5).map((t, i) => ({
      x: t.x, y: t.y, archetype: DEFAULT_ARCHETYPES[i % DEFAULT_ARCHETYPES.length],
    })),
    enemies: ENEMY_SPAWNS.map((e) => ({ ...e })),
    bossObjects: [], // No Power Relays / invulnerability structures (Part 35)
    extractionZone: null,
    civilian: null,
    device: null,
    reinforcementSpawns: REINFORCEMENT_SPAWNS.map((t) => ({ ...t })),
    eliteSpawns: [],
    phase2ReinforcementZones: REINFORCEMENT_ZONES,
    playerDeployTiles: PLAYER_DEPLOY_ZONE.map((t) => `${t.x},${t.y}`),
    enemyDeployTiles: ENEMY_SPAWNS.map((e) => `${e.x},${e.y}`),
    bossObjectTiles: [],
    isBossMap: true,
    // --- Harvester Pit-specific data (placeholders for future boss behavior) ---
    bossSpawn: BOSS_SPAWN,
    siegeChargeLanes: SIEGE_CHARGE_LANES,
    tremorAreas: TREMOR_AREAS,
    beamLanes: BEAM_LANES,
    meltdownZone: MELTDOWN_ZONE,
  };
}