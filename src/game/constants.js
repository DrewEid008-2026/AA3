// Central balance + configuration values for the tactical game.
// Tweak these freely — presentation components read from here, not from hardcoded literals.

export const GRID_WIDTH = 9;   // columns (X: 0..8)
export const GRID_HEIGHT = 14; // rows    (Y: 0..13) — Y=0 is enemy side (top), Y=13 is player side (bottom)

export const TEAMS = {
  PLAYER: 'player',
  ENEMY: 'enemy',
};

export const TILE_TYPES = {
  OPEN: 'open',
  BLOCKED: 'blocked',
};

// Destructible Map Tile destruction classes. Only attacks/abilities with a
// matching class (or canDestroyMapTiles: true) may destroy these tiles.
// Normal attacks never destroy map tiles regardless of damage or terrain damage.
export const TILE_DESTRUCTION_CLASSES = {
  SIEGE: 'siege',
};

// Cover is directional. A cover object sits on one edge of a tile and protects
// an occupant of that tile from attacks originating from that direction.
export const COVER_DIRECTIONS = ['n', 's', 'e', 'w'];

export const COVER_TYPES = {
  BARRICADE: 'barricade',
  WALL: 'wall',
  ENGINEER_BARRICADE: 'engineer_barricade',
  HARDLIGHT: 'hardlight',
};

// Default cover durability (used by future destructible-cover system).
export const COVER_HP = {
  barricade: 3,
  wall: 6,
  engineer_barricade: 4,
  hardlight: 5,
};

// Prototype baseline stats (see design doc "INITIAL PLAYER STATS").
export const DEFAULT_UNIT_STATS = {
  maxHp: 8,
  maxAp: 2,
  movement: 5,
};

// Future combat constants — declared now so balance lives in one place.
export const COMBAT = {
  MOVE_COST: 1,        // AP for a normal move
  MOVE_DISTANCE: 5,   // tiles per normal move
  SPRINT_COST: 2,     // AP for a sprint
  SPRINT_DISTANCE: 10,
  COVER_DAMAGE_REDUCTION: 0.5,   // future: cover reduces incoming damage ~50%
  FLANK_DAMAGE_BONUS: 0.5,       // future: flanking adds ~+50% damage
};

// --- Phase 10: Mission framework ---

export const MISSION_TYPES = {
  ELIMINATION: 'elimination',
  EXTRACTION: 'extraction',
  RESCUE: 'rescue',
  SABOTAGE: 'sabotage',
  BOSS: 'boss',
};

// Mission state machine. The state determines which outcome screen to show
// and whether the base/elite rewards are earned.
// INITIALIZING is the pre-gameplay state: battlefield data is being created and
// victory/failure evaluation is disabled. The mission transitions to ACTIVE
// only after setup is validated and the first Player Phase is ready to begin.
export const MISSION_STATES = {
  INITIALIZING: 'initializing',
  ACTIVE: 'active',
  OBJECTIVE_SECURED: 'objective_secured',
  ELITE_RESPONSE_ACTIVE: 'elite_response_active',
  COMPLETE: 'complete',
  PRIMARY_FAILED: 'primary_failed',
  ELITE_RESPONSE_FAILED: 'elite_response_failed',
};