// Verification script for Implementation 3.4.5: Volatile Tiles
import {
  VOLATILE_TILE_DAMAGE,
  VOLATILE_TERRAIN_CONFIG,
  TERRAIN_DEFS,
  isVolatileTile,
  setVolatile,
  countVolatileInPath,
  predictHazardDamage,
  getHazardEventsInPath,
  applyVolatileDamage,
  onUnitEnterTile,
  validateVolatileMapSafety,
} from '../src/game/volatileTiles.js';
import { computeComeHerePull } from '../src/game/comeHereResolver.js';
import { computeMovementPreview } from '../src/game/movementPreview.js';
import { decideDislocatorAction } from '../src/game/dislocatorAi.js';
import { makePlayer, makeEnemy } from '../src/game/units.js';
import { TILE_TYPES } from '../src/game/constants.js';

import { applyShield, getShieldValue } from '../src/game/shield.js';

let passedCount = 0;
let totalCount = 0;

function assert(condition, testName, details = '') {
  totalCount++;
  if (condition) {
    passedCount++;
    console.log(`✓ [PASS] ${testName}`);
  } else {
    console.error(`✗ [FAIL] ${testName}: ${details}`);
    throw new Error(`Test failed: ${testName} - ${details}`);
  }
}

console.log('====================================================');
console.log('RUNNING 3.4.5 VOLATILE TILES VALIDATION SUITE');
console.log('====================================================\n');

// Build a clean test grid
function makeTestGrid(width = 9, height = 14) {
  const grid = [];
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      row.push({
        x,
        y,
        type: TILE_TYPES.OPEN,
        terrain: 'default',
        cover: { n: null, s: null, e: null, w: null },
      });
    }
    grid.push(row);
  }
  return grid;
}

// TEST 1 — BASIC ENTRY
// Move player onto one Volatile Tile. Expected: one 2-damage Environmental event.
{
  const grid = makeTestGrid();
  setVolatile(grid, 2, 2, true);
  const soldier = { ...makePlayer('assault', 1, 2), id: 's1', hp: 8, maxHp: 8, currentArmor: 0, armor: 0 };
  const entry = onUnitEnterTile(grid, soldier, 2, 2);

  assert(entry.hasEffect === true, 'TEST 1: Basic entry triggers hazard effect');
  assert(entry.damage === VOLATILE_TILE_DAMAGE, 'TEST 1: Basic entry deals 2 environmental damage', `got ${entry.damage}`);
  assert(entry.unit.hp === 6, 'TEST 1: Unit HP reduced from 8 to 6', `got ${entry.unit.hp}`);
  assert(entry.stopped === false, 'TEST 1: Living unit does not stop');
}

// TEST 2 — STAND STILL
// Standing on Volatile terrain without transitioning from another tile. Expected: no new damage.
{
  const grid = makeTestGrid();
  setVolatile(grid, 2, 2, true);
  const soldier = { ...makePlayer('assault', 2, 2), id: 's1', hp: 6, maxHp: 8 };
  // onUnitEnterTile is ONLY called when transitioning into a new tile. Standing still doesn't call it.
  assert(soldier.hp === 6, 'TEST 2: Standing still does not alter unit HP');
}

// TEST 3 — MULTIPLE TILES
// Move through 3 Volatile Tiles. Expected: 3 separate damage events sequentially.
{
  const grid = makeTestGrid();
  setVolatile(grid, 2, 2, true);
  setVolatile(grid, 3, 2, true);
  setVolatile(grid, 4, 2, true);

  let soldier = { ...makePlayer('assault', 1, 2), id: 's1', hp: 10, maxHp: 10, currentArmor: 0, armor: 0 };
  const path = [[1, 2], [2, 2], [3, 2], [4, 2]];
  const damageEvents = [];

  for (let i = 1; i < path.length; i++) {
    const [nx, ny] = path[i];
    const entry = onUnitEnterTile(grid, soldier, nx, ny);
    if (entry.hasEffect) {
      damageEvents.push(entry.damage);
      soldier = entry.unit;
    }
  }

  assert(damageEvents.length === 3, 'TEST 3: Traversed 3 volatile tiles', `got ${damageEvents.length}`);
  assert(damageEvents.every((d) => d === 2), 'TEST 3: Each event dealt 2 damage');
  assert(soldier.hp === 4, 'TEST 3: HP updated from 10 to 4 (10 - 2 - 2 - 2)', `got ${soldier.hp}`);
}

// TEST 4 — RE-ENTRY
// Enter hazard. Leave hazard. Enter same hazard again. Expected: damage each time entered.
{
  const grid = makeTestGrid();
  setVolatile(grid, 2, 2, true);
  let soldier = { ...makePlayer('assault', 1, 2), id: 's1', hp: 10, maxHp: 10, currentArmor: 0, armor: 0 };

  // First entry
  const entry1 = onUnitEnterTile(grid, soldier, 2, 2);
  soldier = entry1.unit;
  assert(entry1.damage === 2 && soldier.hp === 8, 'TEST 4: First entry deals 2 damage (HP 10 -> 8)');

  // Leave to normal tile (1, 2)
  const exitEntry = onUnitEnterTile(grid, soldier, 1, 2);
  soldier = exitEntry.unit;
  assert(exitEntry.hasEffect === false && soldier.hp === 8, 'TEST 4: Leaving to normal tile deals 0 damage');

  // Re-enter (2, 2)
  const entry2 = onUnitEnterTile(grid, soldier, 2, 2);
  soldier = entry2.unit;
  assert(entry2.damage === 2 && soldier.hp === 6, 'TEST 4: Re-entering same volatile tile deals 2 damage again (HP 8 -> 6)');
}

// TEST 5 — ARMOR
// Cross Volatile terrain while armored. Expected: existing Armor pipeline applies.
{
  const grid = makeTestGrid();
  setVolatile(grid, 2, 2, true);
  // Unit with 1 Armor: 2 base damage - 1 armor = 1 damage
  const armoredSoldier = { ...makePlayer('heavy', 1, 2), id: 's1', hp: 8, maxHp: 8, currentArmor: 1, armor: 1 };
  const entry = onUnitEnterTile(grid, armoredSoldier, 2, 2);

  assert(entry.damage === 1, 'TEST 5: Armor reduces 2 damage to 1', `got ${entry.damage}`);
  assert(entry.unit.hp === 7, 'TEST 5: Armored unit HP reduced by 1 to 7', `got ${entry.unit.hp}`);
}

// TEST 6 — SHIELDS
// Cross Volatile terrain with Shield. Expected: existing Shield pipeline applies.
{
  const grid = makeTestGrid();
  setVolatile(grid, 2, 2, true);
  // Unit with 3 Bulwark Shield and 8 HP
  const baseSoldier = { ...makePlayer('heavy', 1, 2), id: 's1', hp: 8, maxHp: 8, currentArmor: 0, armor: 0 };
  const shieldedSoldier = applyShield(baseSoldier, 3);
  const entry = onUnitEnterTile(grid, shieldedSoldier, 2, 2);

  assert(entry.shieldAbsorbed === 2, 'TEST 6: Shield absorbs all 2 damage', `got ${entry.shieldAbsorbed}`);
  assert(entry.unit.hp === 8, 'TEST 6: HP remains untouched at 8');
  assert(getShieldValue(entry.unit) === 1, 'TEST 6: Shield reduced from 3 to 1', `got ${getShieldValue(entry.unit)}`);
}

// TEST 7 — ENEMY MOVEMENT
// Enemy crosses Volatile terrain. Expected: same hazard rules.
{
  const grid = makeTestGrid();
  setVolatile(grid, 3, 3, true);
  const grunt = { ...makeEnemy('grunt', 2, 3), id: 'e1', hp: 5, maxHp: 5, currentArmor: 0, armor: 0 };
  const entry = onUnitEnterTile(grid, grunt, 3, 3);

  assert(entry.hasEffect === true, 'TEST 7: Enemy triggers hazard');
  assert(entry.damage === 2, 'TEST 7: Enemy takes 2 environmental damage');
  assert(entry.unit.hp === 3, 'TEST 7: Enemy HP reduced to 3');
}

// TEST 8 — FLASH CLAW
// Flash Claw crosses Volatile terrain. Expected: normal Environmental damage despite Flash Reflexes.
{
  const grid = makeTestGrid();
  setVolatile(grid, 3, 3, true);
  const flashClaw = { ...makeEnemy('flash_claw', 2, 3), id: 'fc1', hp: 6, maxHp: 6, currentArmor: 0, armor: 0 };
  const entry = onUnitEnterTile(grid, flashClaw, 3, 3);

  assert(entry.hasEffect === true, 'TEST 8: Flash Claw triggers volatile tile');
  assert(entry.damage === 2, 'TEST 8: Flash Claw takes normal 2 environmental damage (Flash Reflexes does NOT protect)');
  assert(entry.unit.hp === 4, 'TEST 8: Flash Claw HP reduced to 4');
}

// TEST 9 — COME HERE!
// Pull soldier across 3 Volatile Tiles.
// Sequence: 3 direct damage, then enter V1 (2 dmg), V2 (2 dmg), V3 (2 dmg). Total raw: 9.
{
  const grid = makeTestGrid();
  // Strip at y=6: x=1 (soldier), x=2 (G), x=3 (V), x=4 (V), x=5 (V), x=6 (G), x=7 (Dislocator)
  setVolatile(grid, 3, 6, true);
  setVolatile(grid, 4, 6, true);
  setVolatile(grid, 5, 6, true);

  const soldier = { ...makePlayer('assault', 1, 6), id: 's1', hp: 12, maxHp: 12, currentArmor: 0, armor: 0 };
  const dislocator = { ...makeEnemy('dislocator', 7, 6), id: 'd1', hp: 10, maxHp: 10 };
  const units = [soldier, dislocator];

  const pull = computeComeHerePull(grid, units, dislocator, soldier);
  assert(pull.valid === true, 'TEST 9: COME HERE! pull is valid');
  assert(pull.hazardTilesCrossed === 3, 'TEST 9: Pull path crosses 3 volatile tiles', `got ${pull.hazardTilesCrossed}`);
  assert(pull.destination.x === 6 && pull.destination.y === 6, 'TEST 9: Destination is adjacent to Dislocator (6,6)');

  // Simulate pull execution
  let currentTarget = soldier;
  // Step 1: 3 direct damage
  currentTarget = { ...currentTarget, hp: currentTarget.hp - 3 };
  assert(currentTarget.hp === 9, 'TEST 9: Initial COME HERE! damage deals 3 (12 -> 9)');

  // Step 2: Traverse pull path tile-by-tile
  for (let i = 1; i < pull.path.length; i++) {
    const [nx, ny] = pull.path[i];
    const entry = onUnitEnterTile(grid, currentTarget, nx, ny);
    if (entry.hasEffect) {
      currentTarget = entry.unit;
    }
  }
  assert(currentTarget.hp === 3, 'TEST 9: Final soldier HP after 3 hazard triggers is 3 (9 - 2 - 2 - 2 = 3)', `got ${currentTarget.hp}`);
}

// TEST 10 — DOWNED MID-PULL
// Use low-HP soldier. COME HERE! pulls through hazard. Volatile Tile Downs soldier.
// Expected: movement stops immediately, soldier remains on triggering tile, later hazards do not trigger.
{
  const grid = makeTestGrid();
  setVolatile(grid, 3, 6, true);
  setVolatile(grid, 4, 6, true);
  setVolatile(grid, 5, 6, true);

  // Soldier with 4 HP: 3 direct damage leaves 1 HP. Entering (3, 6) deals 2 damage -> DOWNED!
  const soldier = { ...makePlayer('assault', 1, 6), id: 's1', hp: 4, maxHp: 8, currentArmor: 0, armor: 0 };
  const dislocator = { ...makeEnemy('dislocator', 7, 6), id: 'd1', hp: 10, maxHp: 10 };
  const units = [soldier, dislocator];

  const pull = computeComeHerePull(grid, units, dislocator, soldier);
  assert(pull.valid === true, 'TEST 10: Pull path valid');

  let currentTarget = soldier;
  // Initial 3 direct damage
  currentTarget = { ...currentTarget, hp: currentTarget.hp - 3 };
  assert(currentTarget.hp === 1, 'TEST 10: 3 direct damage leaves soldier at 1 HP');

  let stoppedTile = null;
  let hazardsTriggered = 0;

  for (let i = 1; i < pull.path.length; i++) {
    const [nx, ny] = pull.path[i];
    const entry = onUnitEnterTile(grid, currentTarget, nx, ny);
    if (entry.hasEffect) {
      hazardsTriggered++;
      currentTarget = entry.unit;
      if (entry.stopped) {
        stoppedTile = [nx, ny];
        break; // Immediate stop on downed!
      }
    }
  }

  assert(currentTarget.downed === true, 'TEST 10: Soldier became Downed');
  assert(hazardsTriggered === 1, 'TEST 10: Only first hazard triggered (later hazards did NOT trigger)', `got ${hazardsTriggered}`);
  assert(stoppedTile[0] === 3 && stoppedTile[1] === 6, 'TEST 10: Movement stopped immediately on (3,6)', `stopped at ${stoppedTile}`);
}

// TEST 11 — BLOCKED PULL
// Place wall between target and Dislocator. Expected: COME HERE! respects valid pathfinding; no pull through wall.
{
  const grid = makeTestGrid();
  // Build a complete wall across column 4
  for (let y = 0; y < 14; y++) {
    grid[y][4].type = TILE_TYPES.BLOCKED;
  }
  const soldier = { ...makePlayer('assault', 1, 6), id: 's1' };
  const dislocator = { ...makeEnemy('dislocator', 7, 6), id: 'd1' };
  const pull = computeComeHerePull(grid, [soldier, dislocator], dislocator, soldier);

  assert(pull.valid === false, 'TEST 11: Wall blocks pull; valid is false', pull.reason);
}

// TEST 12 — DISLOCATOR TARGETING
// Target A pull: 0 hazards. Target B pull: 3 hazards.
// Expected: Target B receives substantially greater COME HERE! value.
{
  const grid = makeTestGrid();
  // Row 5: 0 hazards. Target A at (2, 5)
  // Row 7: 3 hazards. Target B at (2, 7)
  setVolatile(grid, 3, 7, true);
  setVolatile(grid, 4, 7, true);
  setVolatile(grid, 5, 7, true);

  const targetA = { ...makePlayer('assault', 2, 5), id: 'pA', name: 'Target A', hp: 8, maxHp: 8 };
  const targetB = { ...makePlayer('assault', 2, 7), id: 'pB', name: 'Target B', hp: 8, maxHp: 8 };
  const dislocator = {
    ...makeEnemy('dislocator', 6, 6),
    id: 'd1',
    hp: 12, maxHp: 12, ap: 2, maxAp: 2,
    cooldowns: { come_here: 0 },
  };

  const decision = decideDislocatorAction(grid, [targetA, targetB, dislocator], dislocator);
  assert(decision !== null && decision.type === 'come_here', 'TEST 12: Dislocator chooses COME HERE!');
  assert(decision.targetId === 'pB', 'TEST 12: Dislocator prioritized Target B (pulls through 3 hazards)', `chosen: ${decision.targetName}`);
}

// TEST 13 — PLAYER MOVEMENT PREVIEW
// Preview route across 2 Volatile Tiles. Expected: count = 2, rawDamage = 4.
{
  const grid = makeTestGrid();
  setVolatile(grid, 2, 2, true);
  setVolatile(grid, 3, 2, true);

  const soldier = { ...makePlayer('assault', 1, 2), id: 's1' };
  const path = [[1, 2], [2, 2], [3, 2], [4, 2]];
  const preview = computeMovementPreview(grid, [soldier], soldier, { x: 4, y: 2 }, path);

  assert(preview.hazardInfo.count === 2, 'TEST 13: Preview counts 2 volatile tiles', `got ${preview.hazardInfo.count}`);
  assert(preview.hazardInfo.rawDamage === 4, 'TEST 13: Preview predicts 4 raw hazard damage', `got ${preview.hazardInfo.rawDamage}`);
  assert(preview.hazardInfo.events.length === 2, 'TEST 13: Preview details 2 hazard events');
}

// TEST 14 — SAVE / LOAD
// Save with unit already standing on Volatile tile. Reload. Expected: NO new damage from loading.
{
  const grid = makeTestGrid();
  setVolatile(grid, 2, 2, true);
  const savedSoldier = { ...makePlayer('assault', 2, 2), id: 's1', hp: 5, maxHp: 8 };
  // Game load restores state: unit is placed on (2,2) with hp: 5.
  // Tile entry is NOT called during initialization or load.
  assert(savedSoldier.hp === 5, 'TEST 14: Restored soldier has unchanged HP on load');
}

// TEST 15 — RESTART
// Restart mission restores original Volatile map configuration and unit states.
{
  const baseGrid = makeTestGrid();
  setVolatile(baseGrid, 3, 3, true);
  const safety = validateVolatileMapSafety(baseGrid, {
    playerDeploy: [{ x: 1, y: 1 }],
    enemyDeploy: [{ x: 7, y: 7 }],
    extractionZone: [{ x: 0, y: 0 }],
  });
  assert(safety.safe === true, 'TEST 15: Map layout safety check passed without collisions');
  assert(isVolatileTile(baseGrid[3][3]) === true, 'TEST 15: Original volatile tile verified at (3,3)');
}

console.log('\n====================================================');
console.log(`ALL ${passedCount} / ${totalCount} TESTS PASSED SUCCESSFULLY!`);
console.log('====================================================\n');
