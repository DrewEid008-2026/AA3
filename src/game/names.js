// Random name generator for recruited soldiers. Uses a sufficiently varied pool
// so repeated recruits don't constantly receive the same few names. Prefers
// unused names from the pool when practical, but duplicate names are allowed
// (never cause recruitment failure).

const NAME_POOL = [
  'Alex', 'Morgan', 'Riley', 'Jordan', 'Casey', 'Cameron', 'Taylor',
  'Quinn', 'Avery', 'Dakota', 'Sage', 'Reese', 'Rowan', 'Skyler',
  'Drew', 'Jamie', 'Kendall', 'Parker', 'Blake', 'Devon',
  'Hayden', 'Kai', 'Marlowe', 'Phoenix', 'Remy', 'Scout',
  'Tatum', 'Wren', 'Zion', 'Arden',
  'Cole', 'Dax', 'Ezra', 'Finn', 'Gage', 'Hale',
  'Iris', 'Jude', 'Knox', 'Lyon', 'Mercer', 'Nico',
  'Onyx', 'Pax', 'Rune', 'Slade', 'Vance', 'Wells',
  'Yale', 'Zane', 'Bishop', 'Cliff', 'Dex', 'Eve',
  'Haven', 'Jett', 'Kit', 'Lance', 'Mace', 'Nash',
  'Oz', 'Reef', 'Trey', 'Vex', 'Wolf', 'Yale',
];

// Generate a random name, preferring one not already in use when practical.
export function generateRandomName(existingNames = []) {
  const used = new Set(existingNames.map((n) => n.toLowerCase()));
  const available = NAME_POOL.filter((n) => !used.has(n.toLowerCase()));
  const pool = available.length > 0 ? available : NAME_POOL;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Generate a unique soldier ID for a new recruit. Uses a timestamp + random
// suffix to guarantee uniqueness within a slot. The ID is URL-safe (used in
// the deploy-selection query param) and stable across saves.
export function generateUniqueSoldierId(existingIds = []) {
  const used = new Set(existingIds);
  let id;
  let attempts = 0;
  do {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 6);
    id = `recruit_${ts}_${rand}`;
    attempts++;
  } while (used.has(id) && attempts < 100);
  return id;
}