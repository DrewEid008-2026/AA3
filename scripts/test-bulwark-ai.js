import { decideEnemyAction, AI_PARAMS } from '../src/game/ai.js';
import { makePlayer, makeEnemy } from '../src/game/units.js';
import { TILE_TYPES } from '../src/game/constants.js';
import { applyShield } from '../src/game/shield.js';

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

console.log('====================================================');
console.log('RUNNING BULWARK AGGRESSIVE FRONTLINE AI TEST SUITE');
console.log('====================================================\n');

let passed = 0;
let total = 0;
function assert(cond, name, detail = '') {
  total++;
  if (cond) {
    passed++;
    console.log(`✓ [PASS] ${name}`);
  } else {
    console.error(`✗ [FAIL] ${name}: ${detail}`);
    throw new Error(`Failed: ${name}`);
  }
}

// 1. Check AI_PARAMS
assert(AI_PARAMS.bulwark.preferClose === true, 'Bulwark preferClose is true');
assert(AI_PARAMS.bulwark.proximityWeight >= 1.5, 'Bulwark proximityWeight is strong (>= 1.5)');
assert(AI_PARAMS.bulwark.coverWeight <= 0.2, 'Bulwark does not cower behind cover (coverWeight <= 0.2)');
assert(AI_PARAMS.bulwark.moveMargin <= 1, 'Bulwark moveMargin is low (<= 1) to advance readily');
assert(AI_PARAMS.bulwark.frontlineTank === true, 'Bulwark has frontlineTank enabled');

// 2. Bulwark advances to the front line when far from players
const grid = makeTestGrid();
const soldier = makePlayer('assault', 4, 10);
const bulwark = makeEnemy('bulwark', 4, 2); // 8 tiles away
bulwark.cooldowns = { energy_shield: 2 }; // shield on cooldown so we test movement
const units1 = [soldier, bulwark];

const action1 = decideEnemyAction(grid, units1, bulwark);
assert(action1.type === 'move', 'Bulwark moves when far from players', JSON.stringify(action1));
assert(action1.entry.y > bulwark.y, 'Bulwark moves forward toward players (y increases)', `Went to y=${action1.entry.y}`);

// 3. Bulwark prioritizes self-shielding when unshielded to soak damage
bulwark.cooldowns = {}; // shield ready
const action2 = decideEnemyAction(grid, units1, bulwark);
assert(action2.type === 'ability' && action2.abilityId === 'energy_shield', 'Bulwark activates Energy Shield to soak damage', JSON.stringify(action2));
assert(action2.isSelf === true, 'Bulwark shields itself when unshielded', JSON.stringify(action2));

// 4. Bulwark with shield active then advances
const shieldedBulwark = applyShield({ ...bulwark, ap: 2 }, 4);
const action3 = decideEnemyAction(grid, units1, shieldedBulwark);
assert(action3.type === 'move', 'Shielded Bulwark advances to front line', JSON.stringify(action3));
assert(action3.entry.y > bulwark.y, 'Shielded Bulwark moves forward', `Target y=${action3.entry.y}`);

// 5. Bulwark shields dying ally if adjacent ally is critical
const woundedGrunt = makeEnemy('grunt', 5, 2);
woundedGrunt.hp = 2; // low HP
woundedGrunt.maxHp = 6;
const unitsWithWounded = [soldier, bulwark, woundedGrunt];
const action4 = decideEnemyAction(grid, unitsWithWounded, bulwark);
assert(action4.type === 'ability' && action4.targetId === woundedGrunt.id, 'Bulwark shields critically wounded adjacent ally', JSON.stringify(action4));

// 6. Bulwark on front line (distance <= 2) attacks
const frontlineBulwark = makeEnemy('bulwark', 4, 9); // distance 1 from soldier at (4,10)
frontlineBulwark.cooldowns = { energy_shield: 2 };
const unitsFront = [soldier, frontlineBulwark];
const action5 = decideEnemyAction(grid, unitsFront, frontlineBulwark);
assert(action5.type === 'attack', 'Bulwark on the front line attacks player', JSON.stringify(action5));

console.log(`\n====================================================`);
console.log(`ALL ${passed} / ${total} BULWARK AI TESTS PASSED!`);
console.log(`====================================================\n`);
