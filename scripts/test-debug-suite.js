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

// Verification script for the comprehensive debug tools & persistence helpers
const {
  loadPlayerSave,
  debugSetAllResources,
  debugLevelAllSoldiers,
  debugHealAllSoldiers,
  debugInjureAllSoldiers,
  debugRespecSoldier,
  debugChangeSoldierClass,
  debugUnlockAllCommanderSkills,
  debugUnlockAllChaptersAndBosses,
  debugResetAllCampaignProgress,
  debugUnlockAllSquadUpgrades,
  recruitSoldier,
} = await import('../src/game/persistence.js');
const { MAX_LEVEL } = await import('../src/game/progression.js');

const { createNewCampaign } = await import('../src/game/saveSlots.js');
createNewCampaign();

let passed = 0;
let total = 0;
function assert(cond, name, details = '') {
  total++;
  if (cond) {
    passed++;
    console.log(`✓ [PASS] ${name}`);
  } else {
    console.error(`✗ [FAIL] ${name}: ${details}`);
    throw new Error(`Failed: ${name}`);
  }
}

console.log('Testing Debug Suite Helpers...\n');

// 1. Resources testing
{
  const save = await debugSetAllResources({ credits: 5000, alienMaterials: 250, powerCores: 20, nanoCubes: 100 });
  assert(save.credits === 5000, 'Credits set to 5000');
  assert(save.alien_materials === 250, 'Alien materials set to 250');
  assert(save.powerCores === 20, 'Power cores set to 20');
  assert(save.nanoCubes === 100, 'Nano cubes set to 100');

  const zeroSave = await debugSetAllResources({ credits: 0, alienMaterials: 0, powerCores: 0, nanoCubes: 0 });
  assert(zeroSave.credits === 0, 'Poverty mode: credits 0');
  assert(zeroSave.alien_materials === 0, 'Poverty mode: materials 0');
}

// 2. Character Levels testing
{
  const soldiersL20 = await debugLevelAllSoldiers(MAX_LEVEL);
  assert(soldiersL20.every((s) => s.level === 20), 'Level all soldiers to 20');
  assert(soldiersL20.every((s) => s.max_hp === 18), 'Base Max HP at Lv20 is 18 (8 + 10 award levels)');

  const soldiersL1 = await debugLevelAllSoldiers(1);
  assert(soldiersL1.every((s) => s.level === 1), 'Reset all soldiers to Level 1');
  assert(soldiersL1.every((s) => s.max_hp === 8), 'Base Max HP at Lv1 is 8');
}

// 3. Health & Injuries
{
  const injured = await debugInjureAllSoldiers();
  assert(injured.every((s) => s.injured === true), 'Injure all soldiers');

  const healed = await debugHealAllSoldiers();
  assert(healed.every((s) => s.injured === false && s.current_hp === s.max_hp), 'Heal all soldiers to full');
}

// 4. Recruitment, Respec, Class Change
{
  const newSoldier = await recruitSoldier('scout');
  assert(newSoldier.class === 'scout' && newSoldier.level === 1, 'Recruit new scout at Lv1');

  const respec = await debugRespecSoldier(newSoldier.id);
  assert(respec.upgrades.length === 0, 'Respec clears all upgrades');

  const classChange = await debugChangeSoldierClass(newSoldier.id, 'heavy');
  assert(classChange.class === 'heavy', 'Class changed to heavy');
}

// 5. Chapters & Bosses
{
  const unlockedAll = await debugUnlockAllChaptersAndBosses();
  assert(unlockedAll.chapters.ch1.unlocked && unlockedAll.chapters.ch2.unlocked && unlockedAll.chapters.ch3.unlocked, 'All chapters unlocked');
  assert(unlockedAll.chapters.ch1.bossUnlocked && unlockedAll.chapters.ch2.bossUnlocked && unlockedAll.chapters.ch3.bossUnlocked, 'All bosses unlocked');

  const resetAll = await debugResetAllCampaignProgress();
  assert(resetAll.chapters.ch1.unlocked === true && resetAll.chapters.ch2.unlocked === false, 'Campaign progress reset');
}

// 6. Commander & Squad Upgrades
{
  const cmdSave = await debugUnlockAllCommanderSkills();
  assert(cmdSave.commander.unlocked === true && cmdSave.commander.unlockedSkillIds.length >= 6, 'All commander skills unlocked');

  const upSave = await debugUnlockAllSquadUpgrades();
  assert(Object.keys(upSave.squad_upgrades).length >= 3, 'All squad upgrades unlocked');
}

console.log(`\nALL ${passed} / ${total} DEBUG TESTS PASSED!`);
