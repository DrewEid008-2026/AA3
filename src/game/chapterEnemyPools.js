// Chapter enemy spawn weighting framework.
//
// CORE RULE: Any standard enemy type may appear in any Chapter. Chapter
// identity comes from SPAWN WEIGHTS (frequency), not hard exclusivity.
// Featured enemies receive higher weights in their home chapter but remain
// capable of rare appearance outside it.
//
// This module is the single source of truth for:
//   - per-enemy, per-chapter spawn weights (CHAPTER_SPAWN_WEIGHTS)
//   - composition caps (ENEMY_CAPS) — specialist limits preserved
//   - featured enemy declarations (FEATURED_ENEMIES) — data-driven Chapter config
//   - weighted composition generation (generateComposition)
//   - debug inspection + simulation tooling
//   - future extension hooks (commander preference, map weight modifiers)
//
// Weight semantics:
//   0     = do not naturally select in that chapter
//   0.25  = rare
//   0.50  = uncommon
//   1.00  = normal (the default for any missing entry)
//   1.50  = favored
//   2.00  = strongly favored
//
// Missing entries default to 1.0 (DEFAULT_SPAWN_WEIGHT) so existing enemies
// remain valid everywhere without explicit configuration. Missing chapter
// keys also fall back to 1.0 — never crash or exclude unexpectedly.
//
// Featured enemy UNITS (stats, AI, abilities) live in unitTypes.js + their
// ability/AI modules. This registry only declares the Chapter relationship
// and spawn frequency. Unimplemented featured enemies (no archetype def yet)
// are skipped by the generator, so the framework can roll out before the
// unit implementations land (3.4.2-3.4.4).

import { ENEMY_ARCHETYPES } from './unitTypes';

// All spawnable enemy archetype keys that participate in weighted pools.
// Boss archetypes (warden_prime, harvester) and objective structures
// (power_relay) are excluded — they are mission-specific, never pooled.
export const POOLABLE_ENEMIES = [
  // Foundational infantry
  'grunt', 'rusher', 'support',
  // Specialized infantry
  'bulwark', 'stalker', 'disruptor', 'artillery',
  // Chapter 2 armored/tech escalation
  'bastion', 'fabricator',
  // Chapter 3 featured enemies (implemented in 3.4.2-3.4.4)
  'flash_claw', 'dislocator', 'executioner',
];

// Default spawn weight for any enemy/chapter combination that is not
// explicitly listed in CHAPTER_SPAWN_WEIGHTS. Preserves backward
// compatibility — existing enemies remain valid everywhere by default.
export const DEFAULT_SPAWN_WEIGHT = 1.0;

// Per-enemy, per-chapter spawn weights. Only DEVIATIONS from the 1.0 default
// are listed; missing entries default to DEFAULT_SPAWN_WEIGHT.
//
// Design intent:
//   ch1 — foundational infantry + light specials; no heavy armor (bastion/
//         fabricator are Chapter 2 escalation units, weight 0 here)
//   ch2 — full roster at normal frequency; featured enemies begin rare
//   ch3 — ADAPTATION: featured enemies strongly favored (1.4-1.6), existing
//         roster remains at normal frequency (1.0 default) so Chapter 3
//         still uses the broader enemy roster
export const CHAPTER_SPAWN_WEIGHTS = {
  ch1: {
    bastion: 0,        // Chapter 2 escalation unit — not in Chapter 1
    fabricator: 0,     // Chapter 2 escalation unit — not in Chapter 1
    flash_claw: 0.20,  // rare in Chapter 1
    dislocator: 0.20,  // rare in Chapter 1
    executioner: 0.20, // rare in Chapter 1
  },
  ch2: {
    flash_claw: 0.40,  // uncommon in Chapter 2
    dislocator: 0.40,  // uncommon in Chapter 2
    executioner: 0.40, // uncommon in Chapter 2
  },
  ch3: {
    flash_claw: 1.70,   // strongly favored in Chapter 3
    dislocator: 1.85,   // strongly favored in Chapter 3 — high battlefield prevalence
    executioner: 1.85,  // strongly favored in Chapter 3 — high battlefield prevalence
  },
};

// Per-enemy composition caps. Prevents weighting from producing multiple
// specialist units in a single composition. -1 = no cap. New featured-enemy
// caps can be added when their unit definitions exist (3.4.2-3.4.4).
export const ENEMY_CAPS = {
  artillery: 1,
  disruptor: 1,
  bulwark: 1,
  bastion: 1,
  fabricator: 1,
  flash_claw: 2, // Chapter 3 featured — max 2 per encounter (spec 37)
  dislocator: 2, // Chapter 3 featured — max 2 per encounter (spec 36)
  executioner: 2, // Chapter 3 featured — max 2 per encounter (spec 35)
};

// Featured enemy declarations. Data-driven Chapter configuration identifying
// which enemies are "featured" (identity-establishing) for each chapter.
// Featured enemies receive increased spawn weighting (above) and composition
// guarantees (generateComposition can ensure at least one appears).
//
// Future chapters define their own featured enemies using the same system:
//   ch4: { featuredEnemyIds: [...] }
export const FEATURED_ENEMIES = {
  ch3: ['flash_claw', 'dislocator', 'executioner'],
};

// --- Helpers ---

// Is this archetype key a featured enemy for the given chapter?
export function isFeaturedEnemy(archetypeKey, chapterId) {
  return (FEATURED_ENEMIES[chapterId] || []).includes(archetypeKey);
}

// Get the list of featured enemy archetype keys for a chapter.
export function getFeaturedEnemies(chapterId) {
  return (FEATURED_ENEMIES[chapterId] || []).slice();
}

// Is this archetype currently implemented (has a unit definition)?
// Unimplemented featured enemies are skipped by the generator so the framework
// can roll out before the unit implementations land.
export function isEnemyImplemented(archetypeKey) {
  return !!ENEMY_ARCHETYPES[archetypeKey];
}

// Get the spawn weight for an archetype in a chapter.
//   Missing chapter key  → 1.0 (never crash or exclude)
//   Missing enemy entry  → 1.0 (default)
//   Explicit 0           → 0 (do not naturally select)
//   Unimplemented enemy   → 0 (can't spawn broken units)
//   Debug allWeightsOne  → 1.0 for everything
export function getSpawnWeight(archetypeKey, chapterId, options = {}) {
  if (!isEnemyImplemented(archetypeKey)) return 0;
  if (options.allWeightsOne) return DEFAULT_SPAWN_WEIGHT;
  const chapterWeights = CHAPTER_SPAWN_WEIGHTS[chapterId];
  if (!chapterWeights) return DEFAULT_SPAWN_WEIGHT;
  if (archetypeKey in chapterWeights) return chapterWeights[archetypeKey];
  return DEFAULT_SPAWN_WEIGHT;
}

// Get the full weighted pool for a chapter: [{ archetype, weight }] for all
// implemented enemies with weight > 0. Used by the composition generator and
// by debug/tooling to inspect a chapter's available roster.
export function getChapterPool(chapterId, options = {}) {
  const out = [];
  for (const key of POOLABLE_ENEMIES) {
    const w = getSpawnWeight(key, chapterId, options);
    if (w > 0) out.push({ archetype: key, weight: w });
  }
  return out;
}

// Get the effective weight including commander/map modifiers (future hooks).
//   effectiveWeight = chapterWeight × commanderModifier × mapModifier
// Both modifiers default to 1.0 (no change). This architecture avoids
// rewriting the weighting system when Vexar integration (3.4.8) or map
// modifiers (3.4.6) arrive — they just pass a modifier here.
export function getEffectiveWeight(archetypeKey, chapterId, context = {}) {
  const base = getSpawnWeight(archetypeKey, chapterId, { allWeightsOne: context.allWeightsOne });
  if (base <= 0) return 0;
  const commanderMod = context.commanderPreferenceModifier || 1.0;
  const mapMod = context.mapWeightModifier || 1.0;
  return base * commanderMod * mapMod;
}

// --- Weighted selection ---

function weightedPick(pool, rng) {
  const total = pool.reduce((s, e) => s + e.weight, 0);
  if (total <= 0) return null;
  let r = rng() * total;
  for (const entry of pool) {
    r -= entry.weight;
    if (r <= 0) return entry.archetype;
  }
  return pool[pool.length - 1].archetype;
}

function makeEntry(archetype, hardenedChance, rng) {
  const entry = { archetype };
  if (hardenedChance > 0 && rng() < hardenedChance) entry.hardened = true;
  return entry;
}

function countArchetype(composition, archetype) {
  return composition.filter((e) => e.archetype === archetype).length;
}

function getCap(archetype) {
  return ENEMY_CAPS[archetype] ?? -1;
}

function underCap(composition, archetype) {
  const cap = getCap(archetype);
  return cap < 0 || countArchetype(composition, archetype) < cap;
}

// Generate an enemy composition for a chapter using the weighted pool.
// Returns an array of { archetype, hardened? } entries compatible with
// mission.enemies / generateBattlefield's enemyComposition parameter.
//
// VALIDATION FIRST: caps are checked BEFORE weighted selection — a unit
// blocked by a cap is removed from the candidate pool before drawing.
//
// options:
//   count              — number of enemies to generate (default 4)
//   guaranteeFeatured  — if true (default), ensures at least one implemented
//                        featured enemy appears when available
//   hardenedChance     — 0..1 probability of hardening each entry (default 0)
//   rng                — optional RNG function (defaults to Math.random)
//
// Debug overrides:
//   forceEnemy         — force a specific archetype into the first slot
//   disableFeatured    — skip the featured-enemy guarantee
//   allWeightsOne      — treat every enemy as weight 1.0 (flat distribution)
//
// Future hooks (not activated yet — architecture only):
//   commanderPreference — { preferredEnemyIds: [], modifier: 1.5 }
//   mapWeightModifier  — { [archetype]: modifier }
export function generateComposition(chapterId, options = {}) {
  const {
    count = 4,
    guaranteeFeatured = true,
    hardenedChance = 0,
    rng = Math.random,
    forceEnemy = null,
    disableFeatured = false,
    allWeightsOne = false,
    commanderPreference = null,
    mapWeightModifier = null,
  } = options;

  const pool = getChapterPool(chapterId, { allWeightsOne });
  if (pool.length === 0) return [];

  const composition = [];

  // Debug: force a specific enemy into the first slot.
  if (forceEnemy && isEnemyImplemented(forceEnemy) && underCap(composition, forceEnemy)) {
    composition.push(makeEntry(forceEnemy, hardenedChance, rng));
  }

  // Guarantee featured enemy appearances (if not disabled and implemented).
  // In Chapter 3, every match requires at least one Flash Claw, one Dislocator,
  // and one Executioner (unless count < 3 or disabled).
  if (chapterId === 'ch3' && guaranteeFeatured && !disableFeatured && count >= 3) {
    const requiredTrio = ['flash_claw', 'dislocator', 'executioner'].filter(isEnemyImplemented);
    // Shuffle the insertion order so they don't always occupy indices in identical sequence
    const shuffledTrio = requiredTrio.slice();
    for (let i = shuffledTrio.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffledTrio[i], shuffledTrio[j]] = [shuffledTrio[j], shuffledTrio[i]];
    }
    for (const archetype of shuffledTrio) {
      if (composition.length < count && underCap(composition, archetype)) {
        if (!composition.some((e) => e.archetype === archetype)) {
          composition.push(makeEntry(archetype, hardenedChance, rng));
        }
      }
    }
  } else {
    // Generic featured enemy guarantee for other chapters or custom options
    const targetFeatured = options.featuredCount ?? (guaranteeFeatured ? 1 : 0);
    if (targetFeatured > 0 && !disableFeatured && composition.length < count) {
      const featured = (FEATURED_ENEMIES[chapterId] || []).filter(isEnemyImplemented);
      if (featured.length > 0) {
        // Pick distinct featured enemies first if possible using Fisher-Yates shuffle
        const shuffled = featured.slice();
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        for (const pick of shuffled) {
          if (composition.filter((e) => isFeaturedEnemy(e.archetype, chapterId)).length >= targetFeatured) break;
          if (composition.length >= count) break;
          if (underCap(composition, pick)) {
            composition.push(makeEntry(pick, hardenedChance, rng));
          }
        }
      }
    }
  }

  // Build effective-weight pool with future commander/map modifiers.
  const effectivePool = pool.map((entry) => {
    let weight = entry.weight;
    if (commanderPreference?.preferredEnemyIds?.includes(entry.archetype)) {
      weight *= (commanderPreference.modifier || 1.0);
    }
    if (mapWeightModifier && mapWeightModifier[entry.archetype]) {
      weight *= mapWeightModifier[entry.archetype];
    }
    return { archetype: entry.archetype, weight };
  });

  // Fill remaining slots, respecting caps (validation-first).
  let guard = 0;
  while (composition.length < count && guard++ < 100) {
    const available = effectivePool.filter((e) => underCap(composition, e.archetype));
    if (available.length === 0) break;
    const pick = weightedPick(available, rng);
    if (!pick) break;
    composition.push(makeEntry(pick, hardenedChance, rng));
  }

  return composition;
}

// --- Debug inspection ---

// Inspect candidate weights for a chapter (debug tool). Returns a sorted list
// of all poolable enemies with their effective weight, cap, featured status,
// and implementation status. Used by the debug composition output (spec 24).
export function inspectCandidateWeights(chapterId, options = {}) {
  const pool = getChapterPool(chapterId, options);
  return pool.map((entry) => ({
    archetype: entry.archetype,
    name: ENEMY_ARCHETYPES[entry.archetype]?.name || entry.archetype,
    weight: entry.weight,
    cap: getCap(entry.archetype),
    featured: isFeaturedEnemy(entry.archetype, chapterId),
    implemented: isEnemyImplemented(entry.archetype),
  }));
}

// Format a debug composition report (spec 24). Shows the mission context,
// valid candidates with weights, and the selected composition.
export function formatCompositionReport(chapterId, missionLabel, composition, options = {}) {
  const candidates = inspectCandidateWeights(chapterId, options);
  const lines = [];
  lines.push(`MISSION: ${missionLabel || chapterId}`);
  lines.push('');
  lines.push('VALID CANDIDATES:');
  for (const c of candidates) {
    const capStr = c.cap > 0 ? ` (max ${c.cap})` : '';
    const featStr = c.featured ? ' [FEATURED]' : '';
    lines.push(`  ${c.name}: ${c.weight}${capStr}${featStr}`);
  }
  lines.push('');
  lines.push('SELECTED COMPOSITION:');
  if (!composition || composition.length === 0) {
    lines.push('  (none)');
  } else {
    for (const entry of composition) {
      const name = ENEMY_ARCHETYPES[entry.archetype]?.name || entry.archetype;
      const hardStr = entry.hardened ? ' (hardened)' : '';
      lines.push(`  ${name}${hardStr}`);
    }
  }
  return lines.join('\n');
}

// --- Simulation tool (dev-only) ---

// Generate N compositions and return distribution stats. Used to verify that
// featured enemies appear more frequently in Chapter 3, older enemies still
// appear regularly, and no single unit dominates excessively (spec 25-26).
export function simulateCompositions(chapterId, simulations, options = {}) {
  const results = [];
  for (let i = 0; i < simulations; i++) {
    results.push(generateComposition(chapterId, options));
  }
  const tally = {};
  let totalEntries = 0;
  for (const comp of results) {
    for (const entry of comp) {
      tally[entry.archetype] = (tally[entry.archetype] || 0) + 1;
      totalEntries++;
    }
  }
  const distribution = Object.entries(tally)
    .map(([archetype, appearances]) => ({
      archetype,
      name: ENEMY_ARCHETYPES[archetype]?.name || archetype,
      appearances,
      frequency: totalEntries > 0 ? appearances / totalEntries : 0,
      featured: isFeaturedEnemy(archetype, chapterId),
    }))
    .sort((a, b) => b.appearances - a.appearances);
  return {
    chapterId,
    simulations,
    compositionSize: options.count || 4,
    totalEntries,
    distribution,
    sampleCompositions: results.slice(0, 5),
  };
}