// Handcrafted Tutorial battlefield — FIRST CONTACT.
// A fixed 9×14 grid with six teaching zones arranged vertically. The player
// starts at the bottom (y=13) and fights upward. Gates (full-width walls with
// passable tiles) between zones open as the tutorial progresses.
//
// Zone layout (y=0 top, y=13 bottom):
//   Zone 6  y=0-1    Commander demo + Final free-form fight
//   Gate 4  y=2      Opens after tut_overwatch_all_action
//   Zone 5  y=3-4    Overwatch / Downed / Revive / Lens / Overwatch All
//   Gate 3  y=5      Opens after tut_siege_note
//   Zone 4  y=6-7    Abilities / Grenade / Terrain Destruction
//   Gate 2  y=8      Opens after tut_reload_success
//   Zone 3  y=9      Armor / Shred / Reload
//   Gate 1  y=10     Opens after tut_flank_success
//   Zone 2  y=11     Attack / Flank (enemies spawn here, no gate from Zone 1)
//   Zone 1  y=12-13  Movement / Cover (player start)
//
// Cover semantics: { x, y, dir, type } — cover on the `dir` edge of tile (x,y),
// protects occupant from attacks from `dir`. n=north(top), s=south(bottom).

import { GRID_WIDTH, GRID_HEIGHT, TILE_TYPES, COVER_TYPES, COVER_HP } from '../constants';

export const TUTORIAL_MAP_ID = 'tutorial_first_contact';

// Gate rows: full-width walls with passable gate tiles.
// gateId → { y, gateXs } — the gate tiles that open when the gate unlocks.
export const TUTORIAL_GATES = {
  1: { y: 10, gateXs: [4] },     // Zone 2 → Zone 3
  2: { y: 8, gateXs: [3, 5] },   // Zone 3 → Zone 4
  3: { y: 5, gateXs: [4] },      // Zone 4 → Zone 5
  4: { y: 2, gateXs: [4] },      // Zone 5 → Zone 6
};

// Cover placements per zone. Designed to teach directional cover, flanking,
// and destructible terrain.
const COVER_PLACEMENTS = [
  // Zone 1 — cover for the movement/cover lesson
  { x: 3, y: 12, dir: 'n', type: 'barricade' },
  { x: 5, y: 12, dir: 'n', type: 'barricade' },
  { x: 4, y: 12, dir: 'n', type: 'barricade' },

  // Zone 2 — flank lesson. tut_grunt_2 at (6,11) has WEST cover.
  // Player attacks from west → COVERED; moves to east → FLANKED.
  { x: 6, y: 11, dir: 'w', type: 'barricade' },
  { x: 2, y: 11, dir: 'n', type: 'barricade' },

  // Zone 3 — armored enemy with south cover (protected from player approach)
  { x: 4, y: 9, dir: 's', type: 'wall' },
  { x: 2, y: 9, dir: 'n', type: 'barricade' },
  { x: 6, y: 9, dir: 'n', type: 'barricade' },

  // Zone 4 — destructible cover for grenade lesson
  { x: 5, y: 7, dir: 's', type: 'barricade' },  // protects tut_grunt_3 from south
  { x: 3, y: 7, dir: 'n', type: 'barricade' },
  { x: 4, y: 6, dir: 'n', type: 'barricade' },

  // Zone 5 — overwatch lane + cover for downed/revive
  { x: 4, y: 4, dir: 's', type: 'barricade' },
  { x: 2, y: 4, dir: 'n', type: 'barricade' },
  { x: 6, y: 4, dir: 'n', type: 'barricade' },
  { x: 4, y: 3, dir: 'n', type: 'barricade' },

  // Zone 6 — final fight cover
  { x: 3, y: 1, dir: 's', type: 'barricade' },
  { x: 5, y: 1, dir: 's', type: 'barricade' },
  { x: 2, y: 0, dir: 'n', type: 'barricade' },
  { x: 6, y: 0, dir: 'n', type: 'barricade' },
  { x: 4, y: 1, dir: 's', type: 'wall' },
];

// Player starting positions (Zone 1, bottom of map).
export const TUTORIAL_PLAYER_STARTS = [
  { tutId: 'tut_soldier_1', cls: 'assault', x: 3, y: 13, name: 'Viper', utility: 'grenade' },
  { tutId: 'tut_soldier_2', cls: 'support', x: 5, y: 13, name: 'Badger', utility: null },
];

// Build the handcrafted tutorial grid. All gate tiles start BLOCKED.
// Each gate tile is tagged with isTutorialGate + tutorialGateId so the zone
// controller can find and open them.
export function buildTutorialGrid() {
  const grid = [];
  for (let y = 0; y < GRID_HEIGHT; y++) {
    const row = [];
    for (let x = 0; x < GRID_WIDTH; x++) {
      row.push({
        x, y, type: TILE_TYPES.OPEN,
        cover: { n: null, s: null, e: null, w: null },
        terrain: 'default',
        objective: false,
        destructible: false,
        movementCost: 1,
        isDestructibleTile: false,
        tileDestructionClass: null,
        destroyedReplacementTileType: TILE_TYPES.OPEN,
        currentTileState: 'intact',
        tileKind: null,
      });
    }
    grid.push(row);
  }

  // Apply gate rows — full-width walls with passable gate tiles.
  for (const [gateIdStr, gate] of Object.entries(TUTORIAL_GATES)) {
    const gateId = Number(gateIdStr);
    for (let x = 0; x < GRID_WIDTH; x++) {
      const tile = grid[gate.y][x];
      tile.type = TILE_TYPES.BLOCKED;
      if (gate.gateXs.includes(x)) {
        tile.isTutorialGate = true;
        tile.tutorialGateId = gateId;
      }
    }
  }

  // Apply cover placements.
  for (const { x, y, dir, type } of COVER_PLACEMENTS) {
    const tile = grid[y] && grid[y][x];
    if (!tile) continue;
    const coverType = type || COVER_TYPES.BARRICADE;
    tile.cover[dir] = {
      type: coverType,
      hp: COVER_HP[coverType] ?? 3,
      maxHp: COVER_HP[coverType] ?? 3,
      destroyed: false,
    };
    tile.destructible = true;
  }

  return grid;
}

// Always return a FRESH config (never cached) so retry / restart gets a
// clean grid with all gates closed.
export function getTutorialMapConfig() {
  return {
    mapId: TUTORIAL_MAP_ID,
    mapName: 'First Contact',
    density: 'moderate',
    seed: null,
    grid: buildTutorialGrid(),
    players: TUTORIAL_PLAYER_STARTS.map((p) => ({ x: p.x, y: p.y, archetype: p.cls })),
    enemies: [],  // Enemies are spawned dynamically by the zone controller.
    extractionZone: null,
    civilian: null,
    device: null,
    reinforcementSpawns: [],
    eliteSpawns: [],
    isTutorial: true,
  };
}