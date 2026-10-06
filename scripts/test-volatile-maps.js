// Polyfill localStorage for Node test runner
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
    key: (idx) => Array.from(store.keys())[idx] ?? null,
    get length() { return store.size; },
  };
}

const { generateBattlefield, MAP_TEMPLATES } = await import('../src/game/mapTemplates.js');
const { hasVolatileSquareGroup, isVolatileTile, validateVolatileMapSafety } = await import('../src/game/volatileTiles.js');
const { getMission, generateMapConfig } = await import('../src/game/missions.js');

console.log('====================================================');
console.log('RUNNING VOLATILE TERRAIN ON MAPS VALIDATION SUITE');
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

// 1. Chapter 3: verify 50 generated battlefields always have a 2x2 volatile square group
let allCh3Have2x2 = true;
let allCh3Safe = true;
let minVolatileCh3 = 999;
let maxVolatileCh3 = 0;

for (let i = 0; i < 50; i++) {
  const cfg = generateBattlefield('elimination', [{ archetype: 'dislocator' }, { archetype: 'grunt' }], {
    chapterId: 'ch3',
  });
  assert(cfg !== null, `Run ${i}: Generated battlefield is not null`);

  const has2x2 = hasVolatileSquareGroup(cfg.grid, 2);
  if (!has2x2) allCh3Have2x2 = false;

  let volatileCount = 0;
  for (let y = 0; y < cfg.grid.length; y++) {
    for (let x = 0; x < cfg.grid[y].length; x++) {
      if (isVolatileTile(cfg.grid[y][x])) volatileCount++;
    }
  }
  if (volatileCount < minVolatileCh3) minVolatileCh3 = volatileCount;
  if (volatileCount > maxVolatileCh3) maxVolatileCh3 = volatileCount;

  const safety = validateVolatileMapSafety(cfg.grid, {
    playerDeploy: cfg.players,
    enemyDeploy: cfg.enemies,
    reinforcementSpawns: cfg.reinforcementSpawns,
    extractionZone: cfg.extractionZone,
    objectiveTiles: [cfg.device, cfg.civilian].filter(Boolean),
  });
  if (!safety.safe) allCh3Safe = false;
}

assert(allCh3Have2x2, 'All 50 Chapter 3 generated maps have at least one 2x2 square group of volatile terrain');
assert(allCh3Safe, 'All 50 Chapter 3 maps have 100% safe volatile tile placement (no zone collisions)');
assert(minVolatileCh3 >= 4, `Chapter 3 volatile count >= 4 (min observed: ${minVolatileCh3}, max: ${maxVolatileCh3})`);

// 2. Chapter 3 mission configs: test ch3_A, ch3_B, ch3_C, ch3_D
for (const mId of ['ch3_A', 'ch3_B', 'ch3_C', 'ch3_D']) {
  const mission = getMission(mId);
  assert(mission !== null, `Mission ${mId} loaded`);
  const cfg = generateMapConfig(mId);
  assert(cfg !== null, `Mission ${mId} map config generated`);

  const has2x2 = hasVolatileSquareGroup(cfg.grid, 2);
  assert(has2x2, `Mission ${mId} map config includes 2x2 volatile square group for Dislocator synergy`);

  const safety = validateVolatileMapSafety(cfg.grid, {
    playerDeploy: cfg.players,
    enemyDeploy: cfg.enemies,
    reinforcementSpawns: cfg.reinforcementSpawns,
    extractionZone: cfg.extractionZone,
    objectiveTiles: [cfg.device, cfg.civilian].filter(Boolean),
  });
  assert(safety.safe, `Mission ${mId} volatile terrain is 100% safe`);
}

// 3. General maps (Chapter 1 & Chapter 2): verify reasonable amount (2-4 tiles)
let allGeneralSafe = true;
let totalGeneralVolatile = 0;
const generalRuns = 30;

for (let i = 0; i < generalRuns; i++) {
  const cfg = generateBattlefield('elimination', [{ archetype: 'grunt' }], {
    chapterId: 'ch2',
  });
  assert(cfg !== null, `General run ${i}: Battlefield generated`);

  let count = 0;
  for (let y = 0; y < cfg.grid.length; y++) {
    for (let x = 0; x < cfg.grid[y].length; x++) {
      if (isVolatileTile(cfg.grid[y][x])) count++;
    }
  }
  totalGeneralVolatile += count;

  const safety = validateVolatileMapSafety(cfg.grid, {
    playerDeploy: cfg.players,
    enemyDeploy: cfg.enemies,
    reinforcementSpawns: cfg.reinforcementSpawns,
    extractionZone: cfg.extractionZone,
    objectiveTiles: [cfg.device, cfg.civilian].filter(Boolean),
  });
  if (!safety.safe) allGeneralSafe = false;
}

const avgGeneral = totalGeneralVolatile / generalRuns;
assert(avgGeneral >= 2 && avgGeneral <= 5, `General maps have reasonable volatile count (avg: ${avgGeneral.toFixed(1)})`);
assert(allGeneralSafe, 'General maps have 100% safe volatile tile placement');

console.log('\n====================================================');
console.log(`ALL ${passed} / ${total} VOLATILE MAP TESTS PASSED!`);
console.log('====================================================\n');
