import { GRID_WIDTH, GRID_HEIGHT, TILE_TYPES, COVER_TYPES, COVER_HP, TILE_DESTRUCTION_CLASSES } from './constants';

// One handcrafted test battlefield. No procedural generation yet.
//
// Coordinate convention:
//   X: 0 (left) .. 8 (right)
//   Y: 0 (top, enemy deployment) .. 13 (bottom, player deployment)
//
// Cover placement semantics:
//   { x, y, dir, type }  ->  a cover object on the `dir` edge of tile (x,y).
//   It protects an occupant of tile (x,y) from attacks coming from `dir`.
//   n = north (toward enemy), s = south (toward player), e = east, w = west.

const BLOCKED_TILES = [
  { x: 4, y: 6 }, // central obstruction (upper)
  { x: 4, y: 7 }, // central obstruction (lower)
  { x: 1, y: 3 }, // upper-left flank obstacle
  { x: 7, y: 3 }, // upper-right flank obstacle
  { x: 1, y: 10 }, // lower-left flank obstacle
  { x: 7, y: 10 }, // lower-right flank obstacle
];

const COVER_PLACEMENTS = [
  // Enemy-side frontline cover
  { x: 4, y: 2, dir: 's', type: 'barricade' },
  { x: 2, y: 4, dir: 'n', type: 'barricade' },
  { x: 6, y: 4, dir: 'n', type: 'barricade' },
  // Midfield cover (split around the central pillar, leaves left/right flanking)
  { x: 3, y: 5, dir: 'n', type: 'barricade' },
  { x: 5, y: 5, dir: 'n', type: 'barricade' },
  { x: 2, y: 8, dir: 'e', type: 'barricade' },
  { x: 6, y: 8, dir: 'w', type: 'barricade' },
  // Player-side cover
  { x: 3, y: 10, dir: 'n', type: 'barricade' },
  { x: 5, y: 10, dir: 'n', type: 'barricade' },

  // Enemy-occupied cover (so cover/flank is testable against enemies)
  { x: 4, y: 1, dir: 's', type: 'barricade' }, // rusher — south cover
  { x: 2, y: 0, dir: 's', type: 'barricade' }, // grunt — south cover

  // Corner cover (two edges) for diagonal behavior testing
  { x: 1, y: 6, dir: 'n', type: 'barricade' },
  { x: 1, y: 6, dir: 'w', type: 'barricade' },
  { x: 7, y: 6, dir: 'n', type: 'barricade' },
  { x: 7, y: 6, dir: 'e', type: 'barricade' },
];

export function buildGrid() {
  const grid = [];
  for (let y = 0; y < GRID_HEIGHT; y++) {
    const row = [];
    for (let x = 0; x < GRID_WIDTH; x++) {
      row.push({
        x,
        y,
        type: TILE_TYPES.OPEN,
        cover: { n: null, s: null, e: null, w: null },
        terrain: 'default',
        objective: false,
        destructible: false,
        movementCost: 1,
        // Destructible Map Tile fields (distinct from destructible Cover).
        isDestructibleTile: false,
        tileDestructionClass: null,
        destroyedReplacementTileType: TILE_TYPES.OPEN,
        currentTileState: 'intact',
        tileKind: null,
      });
    }
    grid.push(row);
  }

  for (const { x, y } of BLOCKED_TILES) {
    if (grid[y] && grid[y][x]) grid[y][x].type = TILE_TYPES.BLOCKED;
  }

  for (const { x, y, dir, type } of COVER_PLACEMENTS) {
    if (!grid[y] || !grid[y][x]) continue;
    const coverType = type || COVER_TYPES.BARRICADE;
    grid[y][x].cover[dir] = {
      type: coverType,
      hp: COVER_HP[coverType] ?? 3,
      maxHp: COVER_HP[coverType] ?? 3,
      destroyed: false,
    };
    grid[y][x].destructible = true;
  }

  // Auto-mark interior BLOCKED tiles as Siege-destructible (mirrors
  // mapTemplates.js). Outer-border tiles stay permanent.
  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      const tile = grid[y][x];
      if (tile.type !== TILE_TYPES.BLOCKED) continue;
      if (x === 0 || x === GRID_WIDTH - 1 || y === 0 || y === GRID_HEIGHT - 1) continue;
      if (tile.isDestructibleTile) continue;
      tile.isDestructibleTile = true;
      tile.tileDestructionClass = TILE_DESTRUCTION_CLASSES.SIEGE;
      tile.destroyedReplacementTileType = TILE_TYPES.OPEN;
      tile.currentTileState = 'intact';
      tile.tileKind = 'heavy_wall';
    }
  }

  // Edge-based terrain container (Implementation 3.6.1)
  grid.edges = {};

  return grid;
}

export function getTile(grid, x, y) {
  if (y < 0 || y >= GRID_HEIGHT || x < 0 || x >= GRID_WIDTH) return null;
  return grid[y][x];
}