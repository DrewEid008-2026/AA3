// Eleven handcrafted tactical map templates + controlled procedural variation.
//
// Each template defines intentional tactical geometry (permanent walls, lanes,
// cover clusters, deployment zones, objective/extraction/reinforcement zones).
// Generation randomizes only APPROVED elements (variable cover slots, enemy
// starting positions, objective/civilian/extraction/reinforcement location)
// using a deterministic seeded RNG so a given seed always reproduces the same
// battlefield. Core geometry is never randomized.
//
// Coordinate convention (matches maps.js):
//   X: 0 (left) .. 8 (right)   Y: 0 (top, enemy) .. 13 (bottom, player)
//
// Cover semantics: { x, y, dir, type } places a directional cover object on the
// `dir` edge of tile (x,y). 'barricade' = weak (hp 3), 'wall' = reinforced (hp 6).
// Permanent walls are BLOCKED tiles (block movement + LOS). Cover never blocks
// movement or LOS — it only provides directional protection.
import { GRID_WIDTH as W, GRID_HEIGHT as H, TILE_TYPES, COVER_TYPES, COVER_HP, MISSION_TYPES } from './constants';
import { populateVolatileHazards, validateVolatileMapSafety } from './volatileTiles';
import { createTerrainEdge, cloneEdges } from './terrainEdges';

const OPEN = TILE_TYPES.OPEN;
const BLOCKED = TILE_TYPES.BLOCKED;
const DIRS8 = [
  [0, -1], [0, 1], [-1, 0], [1, 0],
  [-1, -1], [1, -1], [-1, 1], [1, 1],
];

const DEFAULT_ARCHETYPES = ['assault', 'heavy', 'support', 'engineer', 'marksman'];

// --- Seeded RNG (mulberry32) ---
// Deterministic: the same seed always produces the same sequence.
function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  return function rng() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function shuffle(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Weighted pick. `options` may include null (no cover). `weights` optional.
function weightedPick(rng, options, weights) {
  if (!options || options.length === 0) return null;
  if (!weights) return options[Math.floor(rng() * options.length)];
  const total = weights.reduce((s, w) => s + w, 0);
  let r = rng() * total;
  for (let i = 0; i < options.length; i++) {
    r -= weights[i];
    if (r <= 0) return options[i];
  }
  return options[options.length - 1];
}

function randomSeed() {
  return Math.floor(Math.random() * 0x7fffffff) + 1;
}

// --- Grid construction ---

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

function buildGridFromTemplate(template, rng) {
  const grid = [];
  for (let y = 0; y < H; y++) {
    const row = [];
    for (let x = 0; x < W; x++) {
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
  for (const { x, y } of template.blocked) {
    if (grid[y] && grid[y][x]) grid[y][x].type = BLOCKED;
  }
  // Siege-destructible map tiles: BLOCKED tiles that can be obliterated by
  // explicitly authorized attacks. They block movement + LOS while intact and
  // become OPEN ground when destroyed (binary, no HP).
  for (const s of template.siegeTiles || []) {
    const tile = grid[s.y] && grid[s.y][s.x];
    if (!tile) continue;
    tile.type = BLOCKED;
    tile.isDestructibleTile = true;
    tile.tileDestructionClass = 'siege';
    tile.destroyedReplacementTileType = OPEN;
    tile.currentTileState = 'intact';
    tile.tileKind = s.kind || 'heavy_wall';
  }
  for (const c of template.cover) {
    applyCover(grid, c.x, c.y, c.dir, c.type);
  }
  // Volatile Tiles (Chapter 3 environmental hazard): mark individual tiles as
  // hazardous. Volatile tiles are traversable, do not block LOS, and deal
  // environmental damage on entry. See volatileTiles.js.
  for (const v of template.volatileTiles || []) {
    const tile = grid[v.y] && grid[v.y][v.x];
    if (tile && tile.type === OPEN) tile.volatile = true;
  }
  for (const slot of template.variableSlots) {
    const choice = weightedPick(rng, slot.options, slot.weights);
    if (choice) applyCover(grid, slot.x, slot.y, slot.dir, choice);
  }

  // Auto-mark interior BLOCKED tiles as Siege-destructible unless the template
  // opts out (e.g. the dev siege-test arena keeps its explicit indestructible
  // pillars). Outer-border tiles (x=0/W-1, y=0/H-1) stay permanent. Tiles
  // already marked destructible (explicit siegeTiles) are left untouched.
  if (template.autoSiegeInterior !== false) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const tile = grid[y][x];
        if (tile.type !== BLOCKED) continue;
        if (x === 0 || x === W - 1 || y === 0 || y === H - 1) continue;
        if (tile.isDestructibleTile) continue;
        tile.isDestructibleTile = true;
        tile.tileDestructionClass = 'siege';
        tile.destroyedReplacementTileType = OPEN;
        tile.currentTileState = 'intact';
        tile.tileKind = 'heavy_wall';
      }
    }
  }

  // Edge-based terrain container (Implementation 3.6.1)
  grid.edges = {};
  if (Array.isArray(template.edges)) {
    for (const e of template.edges) {
      const edge = createTerrainEdge(e);
      grid.edges[edge.id] = edge;
    }
  }

  return grid;
}

function isOpen(grid, x, y) {
  if (y < 0 || y >= H || x < 0 || x >= W) return false;
  return grid[y][x].type === OPEN;
}

// --- Path validation (BFS over open tiles, 8-dir, no corner cutting) ---

function hasPath(grid, start, target) {
  if (!start || !target) return false;
  if (!isOpen(grid, start.x, start.y)) return false;
  if (!isOpen(grid, target.x, target.y)) return false;
  if (start.x === target.x && start.y === target.y) return true;
  const seen = new Set([`${start.x},${start.y}`]);
  const queue = [start];
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
      if (nx === target.x && ny === target.y) return true;
      seen.add(k);
      queue.push({ x: nx, y: ny });
    }
  }
  return false;
}

// Can any of `starts` reach any of `targets`?
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

// --- Placement helpers ---

function findOpenTile(grid, zone, occupied, rng) {
  const shuffled = shuffle(rng, zone);
  for (const t of shuffled) {
    if (!isOpen(grid, t.x, t.y)) continue;
    if (occupied.has(`${t.x},${t.y}`)) continue;
    return t;
  }
  return null;
}

// For sabotage: device tile must have at least one adjacent open interaction tile.
function findDeviceTile(grid, zone, occupied, rng) {
  const shuffled = shuffle(rng, zone);
  for (const t of shuffled) {
    if (!isOpen(grid, t.x, t.y)) continue;
    if (occupied.has(`${t.x},${t.y}`)) continue;
    const hasAdjacent = DIRS8.some(([dx, dy]) => isOpen(grid, t.x + dx, t.y + dy));
    if (hasAdjacent) return t;
  }
  return null;
}

function pickPlayerTiles(grid, zone, count, occupied, rng) {
  const shuffled = shuffle(rng, zone);
  const out = [];
  for (const t of shuffled) {
    if (out.length >= count) break;
    if (!isOpen(grid, t.x, t.y)) continue;
    if (occupied.has(`${t.x},${t.y}`)) continue;
    out.push({ x: t.x, y: t.y });
  }
  return out;
}

function pickEnemyTiles(grid, zone, count, blocked, rng) {
  const shuffled = shuffle(rng, zone);
  const out = [];
  for (const t of shuffled) {
    if (out.length >= count) break;
    if (!isOpen(grid, t.x, t.y)) continue;
    if (blocked.has(`${t.x},${t.y}`)) continue;
    out.push({ x: t.x, y: t.y });
  }
  return out;
}

// --- The six map templates ---

export const MAP_TEMPLATES = [
  // ===== MAP 1 — CENTRAL STRONGHOLD =====
  {
    mapId: 'central_stronghold',
    displayName: 'Central Stronghold',
    density: 'moderate',
    supportsMissions: ['elimination', 'sabotage', 'rescue', 'extraction'],
    blocked: [
      { x: 1, y: 3 }, { x: 7, y: 3 }, { x: 1, y: 10 }, { x: 7, y: 10 },
    ],
    cover: [
      { x: 3, y: 6, dir: 'n', type: 'wall' }, { x: 4, y: 6, dir: 'n', type: 'wall' }, { x: 5, y: 6, dir: 'n', type: 'wall' },
      { x: 3, y: 7, dir: 's', type: 'wall' }, { x: 4, y: 7, dir: 's', type: 'wall' }, { x: 5, y: 7, dir: 's', type: 'wall' },
      { x: 4, y: 6, dir: 'e', type: 'wall' }, { x: 4, y: 7, dir: 'w', type: 'wall' },
      { x: 2, y: 4, dir: 'n', type: 'barricade' }, { x: 6, y: 4, dir: 'n', type: 'barricade' },
      { x: 2, y: 9, dir: 's', type: 'barricade' }, { x: 6, y: 9, dir: 's', type: 'barricade' },
      { x: 4, y: 2, dir: 's', type: 'barricade' }, { x: 4, y: 11, dir: 'n', type: 'barricade' },
    ],
    variableSlots: [
      { x: 3, y: 5, dir: 'n', options: ['barricade', null] },
      { x: 5, y: 5, dir: 'n', options: ['barricade', null] },
      { x: 3, y: 8, dir: 's', options: ['barricade', null] },
      { x: 5, y: 8, dir: 's', options: ['barricade', null] },
      { x: 1, y: 6, dir: 'n', options: ['wall', null] },
      { x: 7, y: 6, dir: 's', options: ['wall', null] },
      { x: 1, y: 7, dir: 's', options: ['wall', null] },
      { x: 7, y: 7, dir: 'n', options: ['wall', null] },
    ],
    playerDeployZone: [
      { x: 1, y: 13 }, { x: 2, y: 13 }, { x: 3, y: 13 }, { x: 4, y: 13 }, { x: 5, y: 13 }, { x: 6, y: 13 }, { x: 7, y: 13 },
      { x: 0, y: 13 }, { x: 8, y: 13 }, { x: 2, y: 12 }, { x: 6, y: 12 },
    ],
    enemyDeployZone: [
      { x: 2, y: 2 }, { x: 4, y: 2 }, { x: 6, y: 2 }, { x: 3, y: 2 }, { x: 5, y: 2 },
      { x: 3, y: 3 }, { x: 5, y: 3 }, { x: 0, y: 3 }, { x: 8, y: 3 },
      { x: 2, y: 4 }, { x: 4, y: 4 }, { x: 6, y: 4 },
    ],
    objectiveZones: [
      { x: 4, y: 5 }, { x: 4, y: 8 }, { x: 3, y: 6 }, { x: 5, y: 7 }, { x: 4, y: 6 }, { x: 4, y: 7 },
    ],
    civilianZones: [
      { x: 4, y: 8 }, { x: 3, y: 8 }, { x: 5, y: 8 }, { x: 4, y: 9 }, { x: 3, y: 9 }, { x: 5, y: 9 },
    ],
    extractionZones: [
      [{ x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 }, { x: 3, y: 1 }, { x: 4, y: 1 }, { x: 5, y: 1 }],
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
      [{ x: 6, y: 0 }, { x: 7, y: 0 }, { x: 8, y: 0 }, { x: 6, y: 1 }, { x: 7, y: 1 }, { x: 8, y: 1 }],
    ],
    reinforcementZones: [
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 6, y: 0 }, { x: 7, y: 0 }, { x: 8, y: 0 }, { x: 0, y: 1 }, { x: 8, y: 1 }],
      [{ x: 0, y: 2 }, { x: 0, y: 3 }, { x: 0, y: 4 }],
      [{ x: 8, y: 2 }, { x: 8, y: 3 }, { x: 8, y: 4 }],
    ],
    eliteSpawnZone: [
      { x: 2, y: 0 }, { x: 6, y: 0 }, { x: 3, y: 0 }, { x: 5, y: 0 },
      { x: 2, y: 1 }, { x: 6, y: 1 }, { x: 3, y: 1 }, { x: 5, y: 1 },
    ],
  },

  // ===== MAP 2 — TWO LANES =====
  {
    mapId: 'two_lanes',
    displayName: 'Two Lanes',
    density: 'moderate',
    supportsMissions: ['elimination', 'extraction', 'sabotage', 'rescue'],
    blocked: [
      { x: 4, y: 2 }, { x: 4, y: 3 }, { x: 4, y: 4 },
      { x: 4, y: 7 }, { x: 4, y: 8 }, { x: 4, y: 9 },
    ],
    cover: [
      { x: 2, y: 5, dir: 'n', type: 'barricade' }, { x: 6, y: 5, dir: 'n', type: 'barricade' },
      { x: 2, y: 9, dir: 's', type: 'barricade' }, { x: 6, y: 9, dir: 's', type: 'barricade' },
      { x: 1, y: 6, dir: 'e', type: 'barricade' }, { x: 3, y: 6, dir: 'w', type: 'barricade' },
      { x: 5, y: 6, dir: 'e', type: 'barricade' }, { x: 7, y: 6, dir: 'w', type: 'barricade' },
      { x: 2, y: 3, dir: 'n', type: 'barricade' }, { x: 6, y: 3, dir: 'n', type: 'barricade' },
      { x: 2, y: 11, dir: 's', type: 'barricade' }, { x: 6, y: 11, dir: 's', type: 'barricade' },
      { x: 4, y: 5, dir: 'e', type: 'barricade' }, { x: 4, y: 6, dir: 'w', type: 'barricade' },
    ],
    variableSlots: [
      { x: 1, y: 4, dir: 'n', options: ['barricade', null] },
      { x: 7, y: 4, dir: 'n', options: ['barricade', null] },
      { x: 1, y: 8, dir: 's', options: ['barricade', null] },
      { x: 7, y: 8, dir: 's', options: ['barricade', null] },
      { x: 3, y: 7, dir: 'e', options: ['wall', null] },
      { x: 5, y: 7, dir: 'w', options: ['wall', null] },
      { x: 2, y: 6, dir: 'n', options: ['barricade', null] },
      { x: 6, y: 6, dir: 'n', options: ['barricade', null] },
    ],
    playerDeployZone: [
      { x: 0, y: 13 }, { x: 1, y: 13 }, { x: 2, y: 13 }, { x: 3, y: 13 },
      { x: 5, y: 13 }, { x: 6, y: 13 }, { x: 7, y: 13 }, { x: 8, y: 13 },
      { x: 1, y: 12 }, { x: 2, y: 12 }, { x: 6, y: 12 }, { x: 7, y: 12 },
    ],
    enemyDeployZone: [
      { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 },
      { x: 5, y: 2 }, { x: 6, y: 2 }, { x: 7, y: 2 }, { x: 8, y: 2 },
      { x: 0, y: 3 }, { x: 3, y: 3 }, { x: 5, y: 3 }, { x: 8, y: 3 },
    ],
    objectiveZones: [
      { x: 2, y: 5 }, { x: 6, y: 5 }, { x: 2, y: 6 }, { x: 6, y: 6 }, { x: 4, y: 5 }, { x: 4, y: 6 },
    ],
    civilianZones: [
      { x: 2, y: 5 }, { x: 6, y: 5 }, { x: 2, y: 6 }, { x: 6, y: 6 }, { x: 1, y: 5 }, { x: 7, y: 5 },
    ],
    extractionZones: [
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
      [{ x: 6, y: 0 }, { x: 7, y: 0 }, { x: 8, y: 0 }, { x: 6, y: 1 }, { x: 7, y: 1 }, { x: 8, y: 1 }],
    ],
    reinforcementZones: [
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
      [{ x: 5, y: 0 }, { x: 6, y: 0 }, { x: 7, y: 0 }, { x: 8, y: 0 }, { x: 7, y: 1 }, { x: 8, y: 1 }],
      [{ x: 0, y: 7 }, { x: 0, y: 8 }],
      [{ x: 8, y: 7 }, { x: 8, y: 8 }],
    ],
    eliteSpawnZone: [
      { x: 0, y: 0 }, { x: 3, y: 0 }, { x: 5, y: 0 }, { x: 8, y: 0 },
      { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 6, y: 1 }, { x: 7, y: 1 },
    ],
  },

  // ===== MAP 3 — OPEN KILL ZONE =====
  {
    mapId: 'open_kill_zone',
    displayName: 'Open Kill Zone',
    density: 'sparse',
    supportsMissions: ['elimination', 'extraction', 'sabotage'],
    blocked: [
      { x: 2, y: 4 }, { x: 6, y: 4 }, { x: 2, y: 9 }, { x: 6, y: 9 },
    ],
    cover: [
      { x: 4, y: 2, dir: 's', type: 'barricade' },
      { x: 4, y: 11, dir: 'n', type: 'barricade' },
      { x: 1, y: 6, dir: 'n', type: 'barricade' }, { x: 7, y: 6, dir: 's', type: 'barricade' },
      { x: 3, y: 7, dir: 'n', type: 'barricade' }, { x: 5, y: 7, dir: 's', type: 'barricade' },
    ],
    variableSlots: [
      { x: 3, y: 3, dir: 'n', options: ['barricade', null] },
      { x: 5, y: 3, dir: 'n', options: ['barricade', null] },
      { x: 3, y: 10, dir: 's', options: ['barricade', null] },
      { x: 5, y: 10, dir: 's', options: ['barricade', null] },
      { x: 4, y: 6, dir: 'e', options: ['wall', null] },
      { x: 4, y: 7, dir: 'w', options: ['wall', null] },
    ],
    playerDeployZone: [
      { x: 1, y: 13 }, { x: 2, y: 13 }, { x: 3, y: 13 }, { x: 4, y: 13 }, { x: 5, y: 13 }, { x: 6, y: 13 }, { x: 7, y: 13 },
      { x: 3, y: 12 }, { x: 5, y: 12 },
    ],
    enemyDeployZone: [
      { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 }, { x: 5, y: 2 }, { x: 6, y: 2 }, { x: 7, y: 2 },
      { x: 2, y: 3 }, { x: 4, y: 3 }, { x: 6, y: 3 }, { x: 3, y: 3 }, { x: 5, y: 3 },
    ],
    objectiveZones: [
      { x: 4, y: 5 }, { x: 4, y: 8 }, { x: 3, y: 6 }, { x: 5, y: 7 }, { x: 4, y: 6 }, { x: 4, y: 7 },
    ],
    civilianZones: [
      { x: 4, y: 8 }, { x: 3, y: 8 }, { x: 5, y: 8 }, { x: 4, y: 7 },
    ],
    extractionZones: [
      [{ x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 }, { x: 3, y: 1 }, { x: 4, y: 1 }, { x: 5, y: 1 }],
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
      [{ x: 6, y: 0 }, { x: 7, y: 0 }, { x: 8, y: 0 }, { x: 6, y: 1 }, { x: 7, y: 1 }, { x: 8, y: 1 }],
    ],
    reinforcementZones: [
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 6, y: 0 }, { x: 7, y: 0 }, { x: 8, y: 0 }, { x: 0, y: 1 }, { x: 8, y: 1 }],
      [{ x: 0, y: 6 }, { x: 0, y: 7 }],
      [{ x: 8, y: 6 }, { x: 8, y: 7 }],
    ],
    eliteSpawnZone: [
      { x: 2, y: 0 }, { x: 6, y: 0 }, { x: 3, y: 0 }, { x: 5, y: 0 },
      { x: 2, y: 1 }, { x: 6, y: 1 }, { x: 3, y: 1 }, { x: 5, y: 1 },
    ],
  },

  // ===== MAP 4 — DENSE RUINS =====
  {
    mapId: 'dense_ruins',
    displayName: 'Dense Ruins',
    density: 'dense',
    supportsMissions: ['elimination', 'rescue', 'sabotage', 'extraction'],
    blocked: [
      { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 6, y: 2 }, { x: 7, y: 2 },
      { x: 1, y: 5 }, { x: 7, y: 5 },
      { x: 3, y: 7 }, { x: 5, y: 7 },
      { x: 1, y: 9 }, { x: 7, y: 9 },
      { x: 2, y: 11 }, { x: 6, y: 11 },
    ],
    cover: [
      { x: 3, y: 3, dir: 'n', type: 'barricade' }, { x: 5, y: 3, dir: 'n', type: 'barricade' },
      { x: 3, y: 4, dir: 's', type: 'barricade' }, { x: 5, y: 4, dir: 's', type: 'barricade' },
      { x: 4, y: 6, dir: 'n', type: 'wall' }, { x: 4, y: 6, dir: 's', type: 'wall' },
      { x: 4, y: 10, dir: 'n', type: 'wall' }, { x: 4, y: 10, dir: 's', type: 'wall' },
      { x: 2, y: 6, dir: 'e', type: 'barricade' }, { x: 6, y: 6, dir: 'w', type: 'barricade' },
      { x: 3, y: 9, dir: 'n', type: 'barricade' }, { x: 5, y: 9, dir: 'n', type: 'barricade' },
      { x: 3, y: 10, dir: 's', type: 'barricade' }, { x: 5, y: 10, dir: 's', type: 'barricade' },
      { x: 0, y: 4, dir: 'e', type: 'barricade' }, { x: 8, y: 4, dir: 'w', type: 'barricade' },
      { x: 0, y: 8, dir: 'e', type: 'barricade' }, { x: 8, y: 8, dir: 'w', type: 'barricade' },
      { x: 4, y: 3, dir: 's', type: 'barricade' }, { x: 4, y: 4, dir: 'n', type: 'barricade' },
    ],
    variableSlots: [
      { x: 2, y: 4, dir: 'n', options: ['barricade', 'wall', null] },
      { x: 6, y: 4, dir: 'n', options: ['barricade', 'wall', null] },
      { x: 2, y: 8, dir: 's', options: ['barricade', 'wall', null] },
      { x: 6, y: 8, dir: 's', options: ['barricade', 'wall', null] },
      { x: 4, y: 5, dir: 'e', options: ['barricade', null] },
      { x: 4, y: 8, dir: 'w', options: ['barricade', null] },
      { x: 3, y: 6, dir: 'e', options: ['wall', null] },
      { x: 5, y: 6, dir: 'w', options: ['wall', null] },
      { x: 1, y: 7, dir: 'n', options: ['barricade', null] },
      { x: 7, y: 7, dir: 'n', options: ['barricade', null] },
      { x: 4, y: 9, dir: 'e', options: ['barricade', null] },
      { x: 4, y: 9, dir: 'w', options: ['barricade', null] },
    ],
    playerDeployZone: [
      { x: 0, y: 13 }, { x: 1, y: 13 }, { x: 3, y: 13 }, { x: 4, y: 13 }, { x: 5, y: 13 }, { x: 7, y: 13 }, { x: 8, y: 13 },
      { x: 3, y: 12 }, { x: 4, y: 12 }, { x: 5, y: 12 },
    ],
    enemyDeployZone: [
      { x: 0, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 }, { x: 5, y: 2 }, { x: 8, y: 2 },
      { x: 3, y: 3 }, { x: 4, y: 3 }, { x: 5, y: 3 }, { x: 0, y: 3 }, { x: 8, y: 3 },
      { x: 3, y: 4 }, { x: 5, y: 4 },
    ],
    objectiveZones: [
      { x: 4, y: 6 }, { x: 4, y: 7 }, { x: 3, y: 6 }, { x: 5, y: 6 }, { x: 4, y: 5 }, { x: 4, y: 8 },
    ],
    civilianZones: [
      { x: 4, y: 6 }, { x: 3, y: 6 }, { x: 5, y: 6 }, { x: 4, y: 7 }, { x: 3, y: 7 }, { x: 5, y: 7 },
    ],
    extractionZones: [
      [{ x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 }, { x: 3, y: 1 }, { x: 4, y: 1 }, { x: 5, y: 1 }],
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
      [{ x: 6, y: 0 }, { x: 7, y: 0 }, { x: 8, y: 0 }, { x: 6, y: 1 }, { x: 7, y: 1 }, { x: 8, y: 1 }],
    ],
    reinforcementZones: [
      [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 }, { x: 8, y: 0 }, { x: 0, y: 1 }, { x: 8, y: 1 }],
      [{ x: 0, y: 6 }, { x: 0, y: 7 }],
      [{ x: 8, y: 6 }, { x: 8, y: 7 }],
    ],
    eliteSpawnZone: [
      { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 }, { x: 0, y: 0 }, { x: 8, y: 0 },
      { x: 3, y: 1 }, { x: 5, y: 1 }, { x: 4, y: 1 },
    ],
  },

  // ===== MAP 5 — CROSSROADS =====
  {
    mapId: 'crossroads',
    displayName: 'Crossroads',
    density: 'moderate',
    supportsMissions: ['elimination', 'extraction', 'rescue', 'sabotage'],
    blocked: [
      { x: 1, y: 3 }, { x: 7, y: 3 }, { x: 1, y: 10 }, { x: 7, y: 10 },
    ],
    cover: [
      { x: 4, y: 5, dir: 'n', type: 'barricade' }, { x: 4, y: 5, dir: 's', type: 'barricade' },
      { x: 4, y: 8, dir: 'n', type: 'barricade' }, { x: 4, y: 8, dir: 's', type: 'barricade' },
      { x: 3, y: 6, dir: 'e', type: 'wall' }, { x: 5, y: 6, dir: 'w', type: 'wall' },
      { x: 3, y: 7, dir: 'e', type: 'wall' }, { x: 5, y: 7, dir: 'w', type: 'wall' },
      { x: 2, y: 6, dir: 'n', type: 'barricade' }, { x: 6, y: 6, dir: 'n', type: 'barricade' },
      { x: 2, y: 7, dir: 's', type: 'barricade' }, { x: 6, y: 7, dir: 's', type: 'barricade' },
      { x: 4, y: 2, dir: 's', type: 'barricade' }, { x: 4, y: 11, dir: 'n', type: 'barricade' },
      { x: 0, y: 6, dir: 'e', type: 'barricade' }, { x: 8, y: 6, dir: 'w', type: 'barricade' },
    ],
    variableSlots: [
      { x: 3, y: 4, dir: 'n', options: ['barricade', null] },
      { x: 5, y: 4, dir: 'n', options: ['barricade', null] },
      { x: 3, y: 9, dir: 's', options: ['barricade', null] },
      { x: 5, y: 9, dir: 's', options: ['barricade', null] },
      { x: 2, y: 5, dir: 'e', options: ['wall', null] },
      { x: 6, y: 5, dir: 'w', options: ['wall', null] },
      { x: 2, y: 8, dir: 'e', options: ['wall', null] },
      { x: 6, y: 8, dir: 'w', options: ['wall', null] },
      { x: 4, y: 6, dir: 'e', options: ['barricade', null] },
      { x: 4, y: 7, dir: 'w', options: ['barricade', null] },
    ],
    playerDeployZone: [
      { x: 1, y: 13 }, { x: 2, y: 13 }, { x: 3, y: 13 }, { x: 4, y: 13 }, { x: 5, y: 13 }, { x: 6, y: 13 }, { x: 7, y: 13 },
      { x: 3, y: 12 }, { x: 4, y: 12 }, { x: 5, y: 12 },
    ],
    enemyDeployZone: [
      { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 }, { x: 5, y: 2 }, { x: 6, y: 2 },
      { x: 0, y: 2 }, { x: 8, y: 2 }, { x: 3, y: 3 }, { x: 5, y: 3 }, { x: 4, y: 3 },
    ],
    objectiveZones: [
      { x: 4, y: 6 }, { x: 4, y: 7 }, { x: 3, y: 6 }, { x: 5, y: 7 }, { x: 4, y: 5 }, { x: 4, y: 8 },
    ],
    civilianZones: [
      { x: 4, y: 6 }, { x: 4, y: 7 }, { x: 3, y: 6 }, { x: 5, y: 7 }, { x: 4, y: 8 },
    ],
    extractionZones: [
      [{ x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 }, { x: 3, y: 1 }, { x: 4, y: 1 }, { x: 5, y: 1 }],
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
      [{ x: 6, y: 0 }, { x: 7, y: 0 }, { x: 8, y: 0 }, { x: 6, y: 1 }, { x: 7, y: 1 }, { x: 8, y: 1 }],
    ],
    reinforcementZones: [
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 6, y: 0 }, { x: 7, y: 0 }, { x: 8, y: 0 }, { x: 0, y: 1 }, { x: 8, y: 1 }],
      [{ x: 0, y: 6 }, { x: 0, y: 7 }],
      [{ x: 8, y: 6 }, { x: 8, y: 7 }],
    ],
    eliteSpawnZone: [
      { x: 2, y: 0 }, { x: 6, y: 0 }, { x: 3, y: 0 }, { x: 5, y: 0 },
      { x: 2, y: 1 }, { x: 6, y: 1 }, { x: 3, y: 1 }, { x: 5, y: 1 },
    ],
  },

  // ===== MAP 6 — BROKEN CORRIDOR =====
  {
    mapId: 'broken_corridor',
    displayName: 'Broken Corridor',
    density: 'moderate',
    supportsMissions: ['rescue', 'sabotage', 'extraction', 'elimination'],
    blocked: [
      { x: 2, y: 2 }, { x: 2, y: 3 },
      { x: 6, y: 4 }, { x: 6, y: 5 },
      { x: 2, y: 7 }, { x: 2, y: 8 },
      { x: 6, y: 9 }, { x: 6, y: 10 },
    ],
    cover: [
      { x: 4, y: 3, dir: 's', type: 'barricade' }, { x: 4, y: 4, dir: 'n', type: 'barricade' },
      { x: 3, y: 5, dir: 'e', type: 'barricade' }, { x: 5, y: 5, dir: 'w', type: 'barricade' },
      { x: 4, y: 8, dir: 's', type: 'barricade' }, { x: 4, y: 9, dir: 'n', type: 'barricade' },
      { x: 1, y: 6, dir: 'e', type: 'barricade' }, { x: 7, y: 6, dir: 'w', type: 'barricade' },
      { x: 3, y: 9, dir: 'e', type: 'barricade' }, { x: 5, y: 9, dir: 'w', type: 'barricade' },
      { x: 4, y: 2, dir: 's', type: 'barricade' }, { x: 4, y: 11, dir: 'n', type: 'barricade' },
    ],
    variableSlots: [
      { x: 3, y: 3, dir: 'n', options: ['barricade', null] },
      { x: 5, y: 4, dir: 'n', options: ['barricade', null] },
      { x: 3, y: 7, dir: 's', options: ['barricade', null] },
      { x: 5, y: 8, dir: 's', options: ['barricade', null] },
      { x: 1, y: 4, dir: 'e', options: ['wall', null] },
      { x: 7, y: 5, dir: 'w', options: ['wall', null] },
      { x: 1, y: 9, dir: 'e', options: ['wall', null] },
      { x: 7, y: 10, dir: 'w', options: ['wall', null] },
      { x: 4, y: 5, dir: 'e', options: ['barricade', null] },
      { x: 4, y: 10, dir: 'w', options: ['barricade', null] },
    ],
    playerDeployZone: [
      { x: 1, y: 13 }, { x: 2, y: 13 }, { x: 3, y: 13 }, { x: 4, y: 13 }, { x: 5, y: 13 }, { x: 6, y: 13 }, { x: 7, y: 13 },
      { x: 3, y: 12 }, { x: 4, y: 12 }, { x: 5, y: 12 },
    ],
    enemyDeployZone: [
      { x: 3, y: 2 }, { x: 4, y: 2 }, { x: 5, y: 2 }, { x: 6, y: 2 }, { x: 0, y: 2 }, { x: 8, y: 2 },
      { x: 3, y: 3 }, { x: 4, y: 3 }, { x: 5, y: 3 }, { x: 0, y: 3 }, { x: 8, y: 3 }, { x: 1, y: 3 }, { x: 7, y: 3 },
    ],
    objectiveZones: [
      { x: 4, y: 6 }, { x: 4, y: 7 }, { x: 3, y: 6 }, { x: 5, y: 7 }, { x: 4, y: 5 }, { x: 4, y: 8 },
    ],
    civilianZones: [
      { x: 4, y: 6 }, { x: 4, y: 7 }, { x: 3, y: 6 }, { x: 5, y: 7 }, { x: 4, y: 5 },
    ],
    extractionZones: [
      [{ x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 }, { x: 3, y: 1 }, { x: 4, y: 1 }, { x: 5, y: 1 }],
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
      [{ x: 6, y: 0 }, { x: 7, y: 0 }, { x: 8, y: 0 }, { x: 6, y: 1 }, { x: 7, y: 1 }, { x: 8, y: 1 }],
    ],
    reinforcementZones: [
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 6, y: 0 }, { x: 7, y: 0 }, { x: 8, y: 0 }],
      [{ x: 0, y: 5 }, { x: 0, y: 6 }],
      [{ x: 8, y: 7 }, { x: 8, y: 8 }],
    ],
    eliteSpawnZone: [
      { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 }, { x: 0, y: 0 }, { x: 8, y: 0 },
      { x: 3, y: 1 }, { x: 5, y: 1 }, { x: 4, y: 1 },
    ],
  },

  // ===== MAP 7 — IMPACT SITE (Crashed Flying Saucer) =====
  // A disc-shaped alien craft has crashed into the battlefield. The hull ring
  // (blocked) forms the saucer silhouette with breach points at top/bottom
  // (x=4,y=4 and x=4,y=9). The interior contains alien consoles and panels.
  // Three routes: LEFT OUTER (x=0-1, open debris), CENTER HULL (through
  // breaches into the saucer interior), RIGHT OUTER (x=7-8, open debris).
  // Routes reconnect above (y=0-3) and below (y=10-13) the wreck.
  {
    mapId: 'impact_site',
    displayName: 'Impact Site',
    density: 'moderate',
    supportsMissions: ['elimination', 'extraction', 'rescue', 'sabotage'],
    blocked: [
      { x: 3, y: 4 }, { x: 5, y: 4 },
      { x: 2, y: 5 }, { x: 6, y: 5 },
      { x: 2, y: 6 }, { x: 6, y: 6 },
      { x: 2, y: 7 }, { x: 6, y: 7 },
      { x: 2, y: 8 }, { x: 6, y: 8 },
      { x: 3, y: 9 }, { x: 5, y: 9 },
    ],
    cover: [
      { x: 4, y: 6, dir: 'n', type: 'wall' }, { x: 4, y: 6, dir: 's', type: 'wall' },
      { x: 3, y: 7, dir: 'n', type: 'barricade' },
      { x: 5, y: 7, dir: 'n', type: 'barricade' },
      { x: 1, y: 4, dir: 'n', type: 'barricade' }, { x: 7, y: 4, dir: 'n', type: 'barricade' },
      { x: 0, y: 6, dir: 'e', type: 'barricade' }, { x: 8, y: 6, dir: 'w', type: 'barricade' },
      { x: 1, y: 9, dir: 's', type: 'barricade' }, { x: 7, y: 9, dir: 's', type: 'barricade' },
      { x: 3, y: 2, dir: 's', type: 'barricade' }, { x: 5, y: 2, dir: 's', type: 'barricade' },
      { x: 3, y: 11, dir: 'n', type: 'barricade' }, { x: 5, y: 11, dir: 'n', type: 'barricade' },
    ],
    variableSlots: [
      { x: 3, y: 5, dir: 'n', options: ['barricade', null] },
      { x: 5, y: 5, dir: 'n', options: ['barricade', null] },
      { x: 3, y: 8, dir: 's', options: ['barricade', null] },
      { x: 5, y: 8, dir: 's', options: ['barricade', null] },
      { x: 0, y: 4, dir: 'n', options: ['barricade', null] },
      { x: 8, y: 4, dir: 'n', options: ['barricade', null] },
      { x: 0, y: 9, dir: 's', options: ['barricade', null] },
      { x: 8, y: 9, dir: 's', options: ['barricade', null] },
    ],
    playerDeployZone: [
      { x: 0, y: 13 }, { x: 1, y: 13 }, { x: 2, y: 13 }, { x: 3, y: 13 }, { x: 4, y: 13 },
      { x: 5, y: 13 }, { x: 6, y: 13 }, { x: 7, y: 13 }, { x: 8, y: 13 },
      { x: 2, y: 12 }, { x: 6, y: 12 },
    ],
    enemyDeployZone: [
      { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 }, { x: 5, y: 2 }, { x: 6, y: 2 },
      { x: 0, y: 3 }, { x: 2, y: 3 }, { x: 4, y: 3 }, { x: 6, y: 3 }, { x: 8, y: 3 },
      { x: 1, y: 3 }, { x: 3, y: 3 }, { x: 5, y: 3 }, { x: 7, y: 3 },
    ],
    objectiveZones: [
      { x: 4, y: 6 }, { x: 4, y: 7 }, { x: 3, y: 6 }, { x: 5, y: 6 }, { x: 4, y: 5 }, { x: 4, y: 8 },
    ],
    civilianZones: [
      { x: 4, y: 6 }, { x: 4, y: 7 }, { x: 3, y: 6 }, { x: 5, y: 7 }, { x: 4, y: 5 }, { x: 4, y: 8 },
      { x: 1, y: 5 }, { x: 7, y: 5 },
    ],
    extractionZones: [
      [{ x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 }, { x: 3, y: 1 }, { x: 4, y: 1 }, { x: 5, y: 1 }],
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
      [{ x: 6, y: 0 }, { x: 7, y: 0 }, { x: 8, y: 0 }, { x: 6, y: 1 }, { x: 7, y: 1 }, { x: 8, y: 1 }],
    ],
    reinforcementZones: [
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 6, y: 0 }, { x: 7, y: 0 }, { x: 8, y: 0 }, { x: 0, y: 1 }, { x: 8, y: 1 }],
      [{ x: 0, y: 4 }, { x: 0, y: 5 }],
      [{ x: 8, y: 4 }, { x: 8, y: 5 }],
    ],
    eliteSpawnZone: [
      { x: 2, y: 0 }, { x: 4, y: 0 }, { x: 6, y: 0 }, { x: 3, y: 1 }, { x: 5, y: 1 },
    ],
  },

  // ===== MAP 8 — LAST STOP (Abandoned Gas Station) =====
  // A roadside gas station overtaken during the invasion. The convenience
  // store (blocked walls, x=1-3 / y=5-8) has an entrance at (3,7). Fuel pumps
  // sit in the center (x=5). Abandoned vehicles and roadside barriers cover
  // the right side. Three routes: STORE (left, through/around building),
  // PUMP/PARKING (center, open with pump cover), ROADSIDE (right, vehicles).
  // Routes reconnect above (y=0-4) and below (y=9-13) the structures.
  {
    mapId: 'last_stop',
    displayName: 'Last Stop',
    density: 'moderate',
    supportsMissions: ['elimination', 'extraction', 'rescue', 'sabotage'],
    blocked: [
      { x: 1, y: 5 }, { x: 2, y: 5 }, { x: 3, y: 5 },
      { x: 1, y: 8 }, { x: 2, y: 8 }, { x: 3, y: 8 },
      { x: 1, y: 6 }, { x: 1, y: 7 }, { x: 3, y: 6 },
    ],
    cover: [
      { x: 2, y: 6, dir: 'n', type: 'barricade' },
      { x: 3, y: 7, dir: 'e', type: 'barricade' },
      { x: 5, y: 5, dir: 'n', type: 'barricade' },
      { x: 5, y: 6, dir: 's', type: 'barricade' },
      { x: 5, y: 7, dir: 'n', type: 'barricade' },
      { x: 7, y: 4, dir: 'n', type: 'barricade' },
      { x: 7, y: 9, dir: 's', type: 'barricade' },
      { x: 8, y: 6, dir: 'w', type: 'barricade' },
      { x: 4, y: 2, dir: 's', type: 'barricade' },
      { x: 0, y: 3, dir: 'e', type: 'barricade' },
      { x: 8, y: 3, dir: 'w', type: 'barricade' },
    ],
    variableSlots: [
      { x: 2, y: 7, dir: 'n', options: ['barricade', null] },
      { x: 4, y: 6, dir: 'n', options: ['barricade', null] },
      { x: 6, y: 4, dir: 'n', options: ['barricade', null] },
      { x: 6, y: 9, dir: 's', options: ['barricade', null] },
      { x: 0, y: 6, dir: 'e', options: ['barricade', null] },
      { x: 8, y: 9, dir: 'w', options: ['barricade', null] },
    ],
    playerDeployZone: [
      { x: 0, y: 13 }, { x: 1, y: 13 }, { x: 2, y: 13 }, { x: 3, y: 13 }, { x: 4, y: 13 },
      { x: 5, y: 13 }, { x: 6, y: 13 }, { x: 7, y: 13 }, { x: 8, y: 13 },
      { x: 2, y: 12 }, { x: 4, y: 12 }, { x: 6, y: 12 },
    ],
    enemyDeployZone: [
      { x: 2, y: 2 }, { x: 4, y: 2 }, { x: 6, y: 2 },
      { x: 0, y: 3 }, { x: 2, y: 3 }, { x: 4, y: 3 }, { x: 6, y: 3 }, { x: 8, y: 3 },
      { x: 1, y: 3 }, { x: 3, y: 3 }, { x: 5, y: 3 }, { x: 7, y: 3 },
    ],
    objectiveZones: [
      { x: 5, y: 5 }, { x: 5, y: 7 }, { x: 2, y: 6 }, { x: 7, y: 6 }, { x: 4, y: 3 },
    ],
    civilianZones: [
      { x: 2, y: 6 }, { x: 2, y: 7 }, { x: 7, y: 5 }, { x: 7, y: 8 }, { x: 5, y: 8 },
    ],
    extractionZones: [
      [{ x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 }, { x: 3, y: 1 }, { x: 4, y: 1 }, { x: 5, y: 1 }],
      [{ x: 0, y: 10 }, { x: 1, y: 10 }, { x: 2, y: 10 }, { x: 0, y: 11 }, { x: 1, y: 11 }, { x: 2, y: 11 }],
      [{ x: 6, y: 10 }, { x: 7, y: 10 }, { x: 8, y: 10 }, { x: 6, y: 11 }, { x: 7, y: 11 }, { x: 8, y: 11 }],
    ],
    reinforcementZones: [
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 7, y: 0 }, { x: 8, y: 0 }, { x: 0, y: 1 }, { x: 8, y: 1 }],
      [{ x: 0, y: 4 }, { x: 0, y: 5 }],
      [{ x: 8, y: 4 }, { x: 8, y: 5 }],
    ],
    eliteSpawnZone: [
      { x: 2, y: 0 }, { x: 4, y: 0 }, { x: 6, y: 0 }, { x: 3, y: 1 }, { x: 5, y: 1 },
    ],
  },

  // ===== MAP 9 — HARVEST (Cornfield Farmstead) =====
  // A rural farmstead. Barn (left, x=1-3 / y=5-8, entrance at 3,7) and farmhouse
  // (right, x=5-7 / y=5-8, entrance at 5,7) flank corn rows (x=4, cover lines).
  // Fences line the field edges. Three routes: BARN/FENCE (left, mixed
  // building + light cover), CORNFIELD (center, broken sightlines through corn),
  // FARMHOUSE (right, structured cover). Routes reconnect above and below.
  {
    mapId: 'harvest',
    displayName: 'Harvest',
    density: 'moderate',
    supportsMissions: ['elimination', 'extraction', 'rescue', 'sabotage'],
    blocked: [
      { x: 1, y: 5 }, { x: 2, y: 5 }, { x: 3, y: 5 },
      { x: 1, y: 8 }, { x: 2, y: 8 }, { x: 3, y: 8 },
      { x: 1, y: 6 }, { x: 1, y: 7 }, { x: 3, y: 6 },
      { x: 5, y: 5 }, { x: 6, y: 5 }, { x: 7, y: 5 },
      { x: 5, y: 8 }, { x: 6, y: 8 }, { x: 7, y: 8 },
      { x: 7, y: 6 }, { x: 7, y: 7 }, { x: 5, y: 6 },
    ],
    cover: [
      { x: 4, y: 3, dir: 'n', type: 'barricade' }, { x: 4, y: 4, dir: 's', type: 'barricade' },
      { x: 4, y: 9, dir: 'n', type: 'barricade' }, { x: 4, y: 10, dir: 's', type: 'barricade' },
      { x: 0, y: 4, dir: 'e', type: 'barricade' }, { x: 8, y: 4, dir: 'w', type: 'barricade' },
      { x: 0, y: 9, dir: 'e', type: 'barricade' }, { x: 8, y: 9, dir: 'w', type: 'barricade' },
      { x: 6, y: 6, dir: 'n', type: 'barricade' }, { x: 6, y: 7, dir: 's', type: 'barricade' },
      { x: 2, y: 6, dir: 'n', type: 'barricade' },
    ],
    variableSlots: [
      { x: 4, y: 6, dir: 'n', options: ['barricade', null] },
      { x: 4, y: 7, dir: 's', options: ['barricade', null] },
      { x: 3, y: 4, dir: 'n', options: ['barricade', null] },
      { x: 5, y: 4, dir: 'n', options: ['barricade', null] },
      { x: 3, y: 9, dir: 's', options: ['barricade', null] },
      { x: 5, y: 9, dir: 's', options: ['barricade', null] },
    ],
    playerDeployZone: [
      { x: 0, y: 13 }, { x: 1, y: 13 }, { x: 2, y: 13 }, { x: 3, y: 13 }, { x: 4, y: 13 },
      { x: 5, y: 13 }, { x: 6, y: 13 }, { x: 7, y: 13 }, { x: 8, y: 13 },
      { x: 2, y: 12 }, { x: 4, y: 12 }, { x: 6, y: 12 },
    ],
    enemyDeployZone: [
      { x: 2, y: 2 }, { x: 4, y: 2 }, { x: 6, y: 2 },
      { x: 0, y: 3 }, { x: 2, y: 3 }, { x: 4, y: 3 }, { x: 6, y: 3 }, { x: 8, y: 3 },
      { x: 1, y: 3 }, { x: 3, y: 3 }, { x: 5, y: 3 }, { x: 7, y: 3 },
    ],
    objectiveZones: [
      { x: 4, y: 6 }, { x: 4, y: 7 }, { x: 2, y: 6 }, { x: 6, y: 6 }, { x: 4, y: 4 },
    ],
    civilianZones: [
      { x: 2, y: 6 }, { x: 2, y: 7 }, { x: 6, y: 6 }, { x: 6, y: 7 }, { x: 4, y: 8 }, { x: 4, y: 5 },
    ],
    extractionZones: [
      [{ x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 }, { x: 3, y: 1 }, { x: 4, y: 1 }, { x: 5, y: 1 }],
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
      [{ x: 6, y: 0 }, { x: 7, y: 0 }, { x: 8, y: 0 }, { x: 6, y: 1 }, { x: 7, y: 1 }, { x: 8, y: 1 }],
    ],
    reinforcementZones: [
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 7, y: 0 }, { x: 8, y: 0 }, { x: 0, y: 1 }, { x: 8, y: 1 }],
      [{ x: 0, y: 5 }, { x: 0, y: 6 }],
      [{ x: 8, y: 5 }, { x: 8, y: 6 }],
    ],
    eliteSpawnZone: [
      { x: 2, y: 0 }, { x: 4, y: 0 }, { x: 6, y: 0 }, { x: 3, y: 1 }, { x: 5, y: 1 },
    ],
  },

  // ===== MAP 10 — GRIDLOCK (Highway Pileup) =====
  // A failed-evacuation highway. An overturned semitrailer (blocked 3x2 at
  // x=3-5 / y=6-7) is the central sight blocker and route-shaping obstacle.
  // Cars (cover) dot the traffic lanes. Three+ forward routes (left lane
  // x=0-2, right lane x=6-8, with cross-lane gaps between cars) reconnect
  // above (y=0-5) and below (y=8-13) the trailer.
  {
    mapId: 'gridlock',
    displayName: 'Gridlock',
    density: 'moderate',
    supportsMissions: ['elimination', 'extraction', 'rescue', 'sabotage'],
    blocked: [
      { x: 3, y: 6 }, { x: 4, y: 6 }, { x: 5, y: 6 },
      { x: 3, y: 7 }, { x: 4, y: 7 }, { x: 5, y: 7 },
    ],
    cover: [
      { x: 1, y: 3, dir: 'n', type: 'barricade' }, { x: 4, y: 3, dir: 'n', type: 'barricade' }, { x: 7, y: 3, dir: 'n', type: 'barricade' },
      { x: 2, y: 5, dir: 'n', type: 'barricade' }, { x: 6, y: 5, dir: 'n', type: 'barricade' },
      { x: 1, y: 9, dir: 's', type: 'barricade' }, { x: 4, y: 9, dir: 's', type: 'barricade' }, { x: 7, y: 9, dir: 's', type: 'barricade' },
      { x: 2, y: 11, dir: 's', type: 'barricade' }, { x: 6, y: 11, dir: 's', type: 'barricade' },
      { x: 0, y: 4, dir: 'e', type: 'barricade' }, { x: 8, y: 4, dir: 'w', type: 'barricade' },
      { x: 0, y: 10, dir: 'e', type: 'barricade' }, { x: 8, y: 10, dir: 'w', type: 'barricade' },
      { x: 2, y: 6, dir: 'e', type: 'barricade' }, { x: 6, y: 6, dir: 'w', type: 'barricade' },
      { x: 2, y: 7, dir: 'e', type: 'barricade' }, { x: 6, y: 7, dir: 'w', type: 'barricade' },
    ],
    variableSlots: [
      { x: 3, y: 5, dir: 'n', options: ['barricade', null] },
      { x: 5, y: 5, dir: 'n', options: ['barricade', null] },
      { x: 3, y: 9, dir: 's', options: ['barricade', null] },
      { x: 5, y: 9, dir: 's', options: ['barricade', null] },
      { x: 0, y: 7, dir: 'e', options: ['barricade', null] },
      { x: 8, y: 7, dir: 'w', options: ['barricade', null] },
    ],
    playerDeployZone: [
      { x: 0, y: 13 }, { x: 1, y: 13 }, { x: 2, y: 13 }, { x: 3, y: 13 }, { x: 4, y: 13 },
      { x: 5, y: 13 }, { x: 6, y: 13 }, { x: 7, y: 13 }, { x: 8, y: 13 },
      { x: 2, y: 12 }, { x: 4, y: 12 }, { x: 6, y: 12 },
    ],
    enemyDeployZone: [
      { x: 1, y: 2 }, { x: 3, y: 2 }, { x: 5, y: 2 }, { x: 7, y: 2 },
      { x: 0, y: 3 }, { x: 2, y: 3 }, { x: 4, y: 3 }, { x: 6, y: 3 }, { x: 8, y: 3 },
      { x: 1, y: 3 }, { x: 3, y: 3 }, { x: 5, y: 3 }, { x: 7, y: 3 },
    ],
    objectiveZones: [
      { x: 4, y: 5 }, { x: 4, y: 9 }, { x: 2, y: 6 }, { x: 6, y: 6 }, { x: 4, y: 3 },
    ],
    civilianZones: [
      { x: 2, y: 5 }, { x: 6, y: 5 }, { x: 2, y: 9 }, { x: 6, y: 9 }, { x: 4, y: 8 }, { x: 4, y: 4 },
    ],
    extractionZones: [
      [{ x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 }, { x: 3, y: 1 }, { x: 4, y: 1 }, { x: 5, y: 1 }],
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
      [{ x: 6, y: 0 }, { x: 7, y: 0 }, { x: 8, y: 0 }, { x: 6, y: 1 }, { x: 7, y: 1 }, { x: 8, y: 1 }],
    ],
    reinforcementZones: [
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 7, y: 0 }, { x: 8, y: 0 }, { x: 0, y: 1 }, { x: 8, y: 1 }],
      [{ x: 0, y: 5 }, { x: 0, y: 6 }],
      [{ x: 8, y: 5 }, { x: 8, y: 6 }],
    ],
    eliteSpawnZone: [
      { x: 2, y: 0 }, { x: 4, y: 0 }, { x: 6, y: 0 }, { x: 3, y: 1 }, { x: 5, y: 1 },
    ],
  },

  // ===== MAP 11 — THE DIG (Alien Excavation Site) =====
  // Aliens are actively excavating. A central diamond-shaped pit (blocked,
  // impassable, x=3-5 / y=6-7 + x=4 / y=5,8) shapes the battlefield. Drilling
  // machinery and alien consoles surround the pit. Three routes: LEFT
  // WORKSITE (x=0-2, machinery cover), RIGHT WORKSITE (x=6-8, different
  // cover), CENTRAL PRESSURE AREA (narrow paths along pit edge at y=5 and
  // y=8). Routes reconnect above (y=0-4) and below (y=9-13) the pit.
  {
    mapId: 'the_dig',
    displayName: 'The Dig',
    density: 'moderate',
    supportsMissions: ['elimination', 'extraction', 'rescue', 'sabotage'],
    blocked: [
      { x: 4, y: 5 },
      { x: 3, y: 6 }, { x: 4, y: 6 }, { x: 5, y: 6 },
      { x: 3, y: 7 }, { x: 4, y: 7 }, { x: 5, y: 7 },
      { x: 4, y: 8 },
    ],
    cover: [
      { x: 2, y: 6, dir: 'e', type: 'barricade' }, { x: 6, y: 6, dir: 'w', type: 'barricade' },
      { x: 2, y: 7, dir: 'e', type: 'barricade' }, { x: 6, y: 7, dir: 'w', type: 'barricade' },
      { x: 0, y: 4, dir: 'n', type: 'barricade' }, { x: 1, y: 3, dir: 'n', type: 'barricade' },
      { x: 8, y: 4, dir: 'n', type: 'barricade' }, { x: 7, y: 3, dir: 'n', type: 'barricade' },
      { x: 0, y: 9, dir: 's', type: 'barricade' }, { x: 8, y: 9, dir: 's', type: 'barricade' },
      { x: 4, y: 3, dir: 's', type: 'barricade' }, { x: 4, y: 10, dir: 'n', type: 'barricade' },
    ],
    variableSlots: [
      { x: 1, y: 6, dir: 'n', options: ['barricade', null] },
      { x: 7, y: 6, dir: 'n', options: ['barricade', null] },
      { x: 1, y: 7, dir: 's', options: ['barricade', null] },
      { x: 7, y: 7, dir: 's', options: ['barricade', null] },
      { x: 2, y: 5, dir: 'n', options: ['barricade', null] },
      { x: 6, y: 5, dir: 'n', options: ['barricade', null] },
    ],
    playerDeployZone: [
      { x: 0, y: 13 }, { x: 1, y: 13 }, { x: 2, y: 13 }, { x: 3, y: 13 }, { x: 4, y: 13 },
      { x: 5, y: 13 }, { x: 6, y: 13 }, { x: 7, y: 13 }, { x: 8, y: 13 },
      { x: 2, y: 12 }, { x: 4, y: 12 }, { x: 6, y: 12 },
    ],
    enemyDeployZone: [
      { x: 2, y: 2 }, { x: 4, y: 2 }, { x: 6, y: 2 },
      { x: 0, y: 3 }, { x: 2, y: 3 }, { x: 4, y: 3 }, { x: 6, y: 3 }, { x: 8, y: 3 },
      { x: 1, y: 3 }, { x: 3, y: 3 }, { x: 5, y: 3 }, { x: 7, y: 3 },
    ],
    objectiveZones: [
      { x: 4, y: 3 }, { x: 4, y: 10 }, { x: 2, y: 6 }, { x: 6, y: 6 }, { x: 2, y: 7 }, { x: 6, y: 7 },
    ],
    civilianZones: [
      { x: 2, y: 6 }, { x: 6, y: 6 }, { x: 2, y: 7 }, { x: 6, y: 7 }, { x: 4, y: 4 }, { x: 4, y: 9 },
    ],
    extractionZones: [
      [{ x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 }, { x: 3, y: 1 }, { x: 4, y: 1 }, { x: 5, y: 1 }],
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
      [{ x: 6, y: 0 }, { x: 7, y: 0 }, { x: 8, y: 0 }, { x: 6, y: 1 }, { x: 7, y: 1 }, { x: 8, y: 1 }],
    ],
    reinforcementZones: [
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 7, y: 0 }, { x: 8, y: 0 }, { x: 0, y: 1 }, { x: 8, y: 1 }],
      [{ x: 0, y: 5 }, { x: 0, y: 6 }],
      [{ x: 8, y: 5 }, { x: 8, y: 6 }],
    ],
    eliteSpawnZone: [
      { x: 2, y: 0 }, { x: 4, y: 0 }, { x: 6, y: 0 }, { x: 3, y: 1 }, { x: 5, y: 1 },
    ],
  },

  // ===== MAP 12 — SIEGE TEST ARENA (Dev Only) =====
  // Development-only map for validating the destructible-map-tile system.
  // NOT in normal mission rotation (devOnly: true). Access via the Map
  // Debug Panel → force map → "siege_test".
  //
  // Layout: open flanks (x=0-2, x=6-8) allow mission completion without siege.
  // Center contains:
  //   - Indestructible structural walls (x=1, y=3-4) — cannot be destroyed
  //   - Heavy Wall row (x=3-5, y=5) + sides (x=3,5 / y=6) — Siege-destructible
  //   - Rock Outcrop row (x=3-5, y=7) — Siege-destructible
  //   - Normal barricade cover near the siege area
  // Units deploy on both sides (player y=13, enemy y=0).
  {
    mapId: 'siege_test',
    displayName: 'Siege Test Arena',
    density: 'sparse',
    supportsMissions: ['elimination'],
    devOnly: true,
    autoSiegeInterior: false,
    blocked: [
      // Indestructible structural walls (arena boundary pillars)
      { x: 1, y: 3 }, { x: 1, y: 4 },
    ],
    siegeTiles: [
      // Heavy Wall row (center, y=5)
      { x: 3, y: 5, kind: 'heavy_wall' },
      { x: 4, y: 5, kind: 'heavy_wall' },
      { x: 5, y: 5, kind: 'heavy_wall' },
      // Heavy Wall sides (y=6, leaving x=4 open for cover)
      { x: 3, y: 6, kind: 'heavy_wall' },
      { x: 5, y: 6, kind: 'heavy_wall' },
      // Rock Outcrop row (y=7)
      { x: 3, y: 7, kind: 'rock_outcrop' },
      { x: 4, y: 7, kind: 'rock_outcrop' },
      { x: 5, y: 7, kind: 'rock_outcrop' },
    ],
    cover: [
      // Normal destructible cover near the siege area
      { x: 4, y: 6, dir: 'n', type: 'barricade' },
      { x: 2, y: 9, dir: 'n', type: 'barricade' },
      { x: 6, y: 9, dir: 'n', type: 'barricade' },
      { x: 4, y: 10, dir: 'n', type: 'barricade' },
    ],
    variableSlots: [],
    playerDeployZone: [
      { x: 2, y: 13 }, { x: 4, y: 13 }, { x: 6, y: 13 },
      { x: 3, y: 13 }, { x: 5, y: 13 },
    ],
    enemyDeployZone: [
      { x: 2, y: 0 }, { x: 4, y: 0 }, { x: 6, y: 0 },
      { x: 3, y: 0 }, { x: 5, y: 0 },
    ],
    objectiveZones: [],
    civilianZones: [],
    extractionZones: [],
    reinforcementZones: [
      [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 0, y: 1 }, { x: 8, y: 1 }],
    ],
    eliteSpawnZone: [
      { x: 4, y: 0 },
    ],
  },

  // ===== MAP 13 — VOLATILE TEST STRIP (Dev Only) =====
  // Development-only map for validating the Volatile Tile hazard system. NOT
  // in normal mission rotation (devOnly: true). Access via the Map Debug
  // Panel → force map → "volatile_test".
  //
  // Layout: a simple open arena with a 3-tile volatile strip across the center
  // (y=7, x=3-5). Player deploys at the bottom (y=13), enemy deploys at the
  // top (y=0). A Dislocator can be spawned to test COME HERE! pulls across the
  // volatile strip. Use this to verify each volatile tile triggers
  // independently and that COME HERE! processes every crossed tile.
  {
    mapId: 'volatile_test',
    displayName: 'Volatile Test Strip',
    density: 'sparse',
    supportsMissions: ['elimination'],
    devOnly: true,
    autoSiegeInterior: false,
    blocked: [],
    volatileTiles: [
      { x: 3, y: 7 }, { x: 4, y: 7 }, { x: 5, y: 7 },
    ],
    cover: [
      { x: 2, y: 5, dir: 'n', type: 'barricade' },
      { x: 6, y: 5, dir: 'n', type: 'barricade' },
      { x: 2, y: 9, dir: 's', type: 'barricade' },
      { x: 6, y: 9, dir: 's', type: 'barricade' },
    ],
    variableSlots: [],
    playerDeployZone: [
      { x: 2, y: 13 }, { x: 4, y: 13 }, { x: 6, y: 13 },
      { x: 3, y: 13 }, { x: 5, y: 13 },
    ],
    enemyDeployZone: [
      { x: 2, y: 0 }, { x: 4, y: 0 }, { x: 6, y: 0 },
      { x: 3, y: 0 }, { x: 5, y: 0 },
    ],
    objectiveZones: [],
    civilianZones: [],
    extractionZones: [],
    reinforcementZones: [
      [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 0, y: 1 }, { x: 8, y: 1 }],
    ],
    eliteSpawnZone: [
      { x: 4, y: 0 },
    ],
  },
];

export function getMapTemplate(mapId) {
  return MAP_TEMPLATES.find((t) => t.mapId === mapId) || null;
}

export function getCompatibleMapIds(missionType) {
  return MAP_TEMPLATES.filter((t) => t.supportsMissions.includes(missionType)).map((t) => t.mapId);
}

// --- Single generation attempt ---

function tryGenerate(template, missionType, enemyComposition, seed, squadSize, options = {}) {
  const rng = makeRng(seed);
  const grid = buildGridFromTemplate(template, rng);
  const occupied = new Set(); // tiles reserved by objective/civilian

  // Objective device (sabotage)
  let device = null;
  if (missionType === MISSION_TYPES.SABOTAGE) {
    const tile = findDeviceTile(grid, template.objectiveZones, occupied, rng);
    if (!tile) return { valid: false, reason: 'No valid device tile' };
    device = { x: tile.x, y: tile.y, sabotaged: false };
    occupied.add(`${tile.x},${tile.y}`);
  }

  // Civilian (rescue)
  let civilian = null;
  if (missionType === MISSION_TYPES.RESCUE) {
    const tile = findOpenTile(grid, template.civilianZones, occupied, rng);
    if (!tile) return { valid: false, reason: 'No valid civilian tile' };
    civilian = { x: tile.x, y: tile.y };
    occupied.add(`${tile.x},${tile.y}`);
  }

  // Extraction zone (extraction + rescue)
  let extractionZone = null;
  if (missionType === MISSION_TYPES.EXTRACTION || missionType === MISSION_TYPES.RESCUE) {
    const region = pick(rng, template.extractionZones);
    extractionZone = region.filter((t) => isOpen(grid, t.x, t.y)).map((t) => ({ ...t }));
    if (extractionZone.length === 0) return { valid: false, reason: 'No valid extraction zone' };
  }

  // Reinforcement zone
  const reinRegion = pick(rng, template.reinforcementZones);
  const reinforcementSpawns = reinRegion.filter((t) => isOpen(grid, t.x, t.y)).map((t) => ({ ...t }));
  if (reinforcementSpawns.length === 0) return { valid: false, reason: 'No valid reinforcement zone' };

  // Player deployment (up to 5)
  const playerCount = Math.min(squadSize || 5, 5);
  const playerTiles = pickPlayerTiles(grid, template.playerDeployZone, playerCount, occupied, rng);
  if (playerTiles.length === 0) return { valid: false, reason: 'No valid player spawns' };
  const players = playerTiles.map((t, i) => ({
    x: t.x, y: t.y, archetype: DEFAULT_ARCHETYPES[i % DEFAULT_ARCHETYPES.length],
  }));

  // Enemy deployment
  const enemyBlocked = new Set(occupied);
  for (const t of playerTiles) enemyBlocked.add(`${t.x},${t.y}`);
  if (extractionZone) for (const t of extractionZone) enemyBlocked.add(`${t.x},${t.y}`);
  if (device) enemyBlocked.add(`${device.x},${device.y}`);
  const enemyCount = enemyComposition.length;
  const enemyTiles = pickEnemyTiles(grid, template.enemyDeployZone, enemyCount, enemyBlocked, rng);
  if (enemyTiles.length < enemyCount) return { valid: false, reason: 'Not enough enemy spawns' };
  // Preserve the full enemy composition entry (archetype + flags like
  // hardened / elite / isBoss) so mission unit creation reads them.
  const enemies = enemyComposition.map((e, i) => ({
    ...e, x: enemyTiles[i].x, y: enemyTiles[i].y,
  }));

  // Elite spawns
  const eliteSpawns = template.eliteSpawnZone.filter((t) => isOpen(grid, t.x, t.y)).map((t) => ({ ...t }));

  // --- Route validation ---
  const playerStarts = playerTiles;
  if (device && !reachableAny(grid, playerStarts, [device])) {
    return { valid: false, reason: 'Device unreachable' };
  }
  if (civilian && !reachableAny(grid, playerStarts, [civilian])) {
    return { valid: false, reason: 'Civilian unreachable' };
  }
  if (extractionZone && !reachableAny(grid, playerStarts, extractionZone)) {
    return { valid: false, reason: 'Extraction unreachable' };
  }
  if (civilian && extractionZone && !reachableAny(grid, [civilian], extractionZone)) {
    return { valid: false, reason: 'No escort path to extraction' };
  }

  // Procedural volatile hazards:
  // - Reasonable amount on maps in general (2-4 tiles).
  // - On Chapter 3: ALWAYS includes at least one 2x2 square group for Dislocator synergy.
  populateVolatileHazards(
    grid,
    {
      playerDeploy: playerTiles,
      enemyDeploy: enemyTiles,
      eliteSpawns,
      reinforcementSpawns,
      extractionZone,
      device,
      civilian,
    },
    options,
    rng
  );

  // Validate layout safety: ensures volatile tiles never overlap deploy or objective zones.
  validateVolatileMapSafety(grid, {
    playerDeploy: playerTiles,
    enemyDeploy: enemyTiles,
    eliteSpawns,
    reinforcementSpawns,
    extractionZone,
    objectiveTiles: [device, civilian].filter(Boolean),
  });

  return {
    valid: true,
    mapId: template.mapId,
    mapName: template.displayName,
    density: template.density,
    seed,
    grid,
    edges: grid.edges || {},
    initialEdges: cloneEdges(grid.edges || {}),
    players,
    enemies,
    extractionZone,
    civilian,
    device,
    reinforcementSpawns,
    eliteSpawns,
    supportsMissions: template.supportsMissions,
    selectedObjectiveZone: device ? `${device.x},${device.y}` : null,
    selectedCivilianZone: civilian ? `${civilian.x},${civilian.y}` : null,
    selectedExtractionZone: extractionZone ? extractionZone.length : 0,
    selectedReinforcementZone: reinforcementSpawns.length,
    playerDeployTiles: playerTiles.map((t) => `${t.x},${t.y}`),
    enemyDeployTiles: enemyTiles.map((t) => `${t.x},${t.y}`),
  };
}

// Pick a template, honoring forceMapId and anti-repeat vs previousMapId.
function pickTemplate(compatible, previousMapId, forceMapId, allowRepeat, seedIndex) {
  if (forceMapId) {
    // Search ALL templates (including devOnly) so the siege test arena can be forced.
    const t = MAP_TEMPLATES.find((m) => m.mapId === forceMapId);
    if (t) return t;
  }
  const pool = (previousMapId && !allowRepeat && compatible.length > 1)
    ? compatible.filter((m) => m.mapId !== previousMapId)
    : compatible;
  // Deterministic template selection: when a seed is provided, derive the
  // template index from the seed so the same seed always reproduces the same
  // battlefield (restart / save restore). Random generation omits seedIndex.
  if (seedIndex != null) return pool[seedIndex % pool.length];
  return pool[Math.floor(Math.random() * pool.length)];
}

// --- Public generation API ---
//
// options:
//   seed         — exact seed (deterministic; used for restart). If omitted, a
//                  random seed is generated.
//   previousMapId— last map id, used to reduce back-to-back repetition.
//   forceMapId   — force a specific template (debug).
//   squadSize    — number of player deployment positions to generate (≤5).
//   chapterId    — chapter identifier (e.g. 'ch3' enforces guaranteed 2x2 volatile square).
//
// Returns a battlefield config object (with .grid) or null if no compatible map.
export function generateBattlefield(missionType, enemyComposition, options = {}) {
  // Dev-only maps (siege test arena) are excluded from random rotation but
  // can still be forced via forceMapId (see pickTemplate).
  const compatible = MAP_TEMPLATES.filter((t) => t.supportsMissions.includes(missionType) && !t.devOnly);
  if (compatible.length === 0) return null;
  const { seed, previousMapId, forceMapId, squadSize } = options;

  // Deterministic (restart / forced seed): single attempt with the exact seed.
  // The template index is derived from the seed so the same seed reproduces the
  // same battlefield even without a stored mapId (forceMapId still overrides).
  if (seed != null) {
    const template = pickTemplate(compatible, previousMapId, forceMapId, true, seed);
    const result = tryGenerate(template, missionType, enemyComposition, seed, squadSize, options);
    if (result.valid) return result;
    // A restart seed that was previously valid always reproduces; if it somehow
    // fails, fall through to random retry below.
  }

  // Random generation: try up to 30 seeds across compatible maps.
  for (let attempt = 0; attempt < 30; attempt++) {
    const template = pickTemplate(compatible, previousMapId, forceMapId, attempt >= 5);
    const s = randomSeed();
    const result = tryGenerate(template, missionType, enemyComposition, s, squadSize, options);
    if (result.valid) return result;
  }

  // Last-resort fallback: first compatible map, seed 1, relaxed.
  const fallback = tryGenerate(compatible[0], missionType, enemyComposition, 1, squadSize, options);
  if (fallback.valid) return fallback;
  return null;
}