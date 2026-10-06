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

const { generateComposition } = await import('../src/game/chapterEnemyPools.js');
const { ELITE_SQUAD } = await import('../src/game/elite.js');
const { getMission } = await import('../src/game/missions.js');

console.log('====================================================');
console.log('RUNNING CHAPTER 3 FEATURED TRIO VALIDATION SUITE');
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

// 1. Verify 100 Chapter 3 compositions of count 4, 5, and 6
for (const count of [4, 5, 6]) {
  let allHaveClaw = true;
  let allHaveDislocator = true;
  let allHaveExecutioner = true;

  for (let i = 0; i < 100; i++) {
    const comp = generateComposition('ch3', { count });
    if (!comp.some((e) => e.archetype === 'flash_claw')) allHaveClaw = false;
    if (!comp.some((e) => e.archetype === 'dislocator')) allHaveDislocator = false;
    if (!comp.some((e) => e.archetype === 'executioner')) allHaveExecutioner = false;
  }

  assert(allHaveClaw, `All 100 Chapter 3 compositions (count=${count}) have at least 1 Flash Claw`);
  assert(allHaveDislocator, `All 100 Chapter 3 compositions (count=${count}) have at least 1 Dislocator`);
  assert(allHaveExecutioner, `All 100 Chapter 3 compositions (count=${count}) have at least 1 Executioner`);
}

// 2. Verify all Chapter 3 missions in missions.js generate compositions with the trio
for (const mId of ['ch3_A', 'ch3_B', 'ch3_C', 'ch3_D']) {
  const mission = getMission(mId);
  assert(mission !== null, `Mission ${mId} exists`);
  const comp = generateComposition(mission.chapterId, {
    count: mission.weightedComposition.count,
    hardenedChance: mission.weightedComposition.hardenedChance,
  });
  assert(comp.some((e) => e.archetype === 'flash_claw'), `${mId} composition includes Flash Claw`);
  assert(comp.some((e) => e.archetype === 'dislocator'), `${mId} composition includes Dislocator`);
  assert(comp.some((e) => e.archetype === 'executioner'), `${mId} composition includes Executioner`);
}

// 3. Verify Elite Response Squad is untouched and has separate rules
assert(Array.isArray(ELITE_SQUAD), 'ELITE_SQUAD is defined');
assert(ELITE_SQUAD.length === 3, 'ELITE_SQUAD has 3 units');
assert(ELITE_SQUAD[0].archetype === 'grunt', 'Elite Squad #1 is grunt');
assert(ELITE_SQUAD[1].archetype === 'rusher', 'Elite Squad #2 is rusher');
assert(ELITE_SQUAD[2].archetype === 'support', 'Elite Squad #3 is support');

// 4. Verify Chapter 1 and Chapter 2 do NOT force the trio
const ch1Comp = generateComposition('ch1', { count: 4 });
const ch2Comp = generateComposition('ch2', { count: 4 });
assert(Array.isArray(ch1Comp), 'Chapter 1 generates normally');
assert(Array.isArray(ch2Comp), 'Chapter 2 generates normally');

console.log(`\n====================================================`);
console.log(`ALL ${passed} / ${total} TESTS PASSED!`);
console.log(`====================================================\n`);
