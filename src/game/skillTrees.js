// Data-driven skill tree definitions for each soldier class. Each class has
// TWO named branches, each with a node at Levels 2, 4, 6, 8, and 10 (capstone).
//
// Node fields (data-driven, flexible for rebalancing):
//   id, name, description, effect, icon
//   levelRequirement — minimum soldier level to select
//   branchId          — which branch this node belongs to ('breacher', etc.)
//   tier              — vertical row (1..5), matches levelRequirement/2
//   position          — left-to-right order within a tier (0 = left branch)
//   exclusiveGroup   — mutually exclusive within a tier (one pick per level)
//   prerequisites     — node ids that must be learned first (capstones)
//   minimumBranchInvestment — # of prior same-branch skills required (L8 nodes)
//   capstone          — true for Level 10 nodes
//   skillPointCost    — always 1
//
// Storage model (freedom-first — multiple skills per level allowed):
//   soldier.upgrades = ['close_quarters', 'long_dash', 'rapid_breach', ...]
//   soldier.available_skill_selections = derived from level (kept in sync)
// Skills are stored as an array of ids so both skills at the same tier can be
// purchased. hasSkill/countSelectedSkills/branchInvestment all read via
// Object.values(upgrades), which works for both the array model and legacy
// level-keyed objects (migrated on load).

// Skill Points are awarded at every even level (2, 4, 6, 8, 10, 12, 14, 16, 18,
// 20). A Level 20 soldier has earned 10 total Skill Points — enough to purchase
// every existing skill in their class tree (10 nodes). No new Level 12–20 skill
// nodes exist yet; extra points can be spent on previously skipped existing
// skills or saved for future high-level skills.
export const SKILL_AWARD_LEVELS = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20];

// Does reaching this level grant a skill selection? Data-driven.
export function grantsSkillSelection(level) {
  return SKILL_AWARD_LEVELS.includes(level);
}

export const NODE_STATES = {
  PURCHASED: 'purchased',   // already learned
  AVAILABLE: 'available',   // level met + skill points available
  LOCKED: 'locked',         // level requirement not met
  NO_POINTS: 'no_points',   // level met but no skill points available
};

// --- Branch definitions ---
export const BRANCHES = {
  assault: [
    { id: 'breacher', name: 'Breacher', identity: 'Close-range burst damage and aggressive entry.' },
    { id: 'vanguard', name: 'Vanguard', identity: 'Mobility, flanking, and continuous forward pressure.' },
  ],
  heavy: [
    { id: 'gunner', name: 'Gunner', identity: 'Suppress enemies and dominate sustained firefights.' },
    { id: 'demolitions', name: 'Demolitions', identity: 'Launch Rocket upgrades — bigger blasts, more uses, double detonation.' },
  ],
  support: [
    { id: 'medic', name: 'Medic', identity: 'Prevent tactical collapse and restore wounded soldiers.' },
    { id: 'commander', name: 'Commander', identity: 'Create stronger turns for the entire squad.' },
  ],
  engineer: [
    { id: 'fortifier', name: 'Fortifier', identity: 'Create strong defensive positions and reshape squad cover.' },
    { id: 'saboteur', name: 'Saboteur', identity: 'Create dangerous areas that punish enemy movement.' },
  ],
  marksman: [
    { id: 'sharpshooter', name: 'Sharpshooter', identity: 'Deliberate precision and removing priority targets.' },
    { id: 'hunter', name: 'Hunter', identity: 'Mobile precision shooting and rapidly changing firing lanes.' },
  ],
};

// Helper to build a node concisely.
function node(id, name, description, effect, icon, levelRequirement, branchId, opts = {}) {
  return {
    id, name, description, effect, icon,
    levelRequirement,
    branchId,
    tier: levelRequirement / 2, // 2→1, 4→2, 6→3, 8→4, 10→5
    position: opts.position ?? 0,
    exclusiveGroup: opts.exclusiveGroup ?? `${branchId}_t${levelRequirement / 2}`,
    prerequisites: opts.prerequisites || null,
    minimumBranchInvestment: opts.minimumBranchInvestment || 0,
    capstone: !!opts.capstone,
    skillPointCost: 1,
  };
}

// --- Tree data ---
export const SKILL_TREES = {
  assault: {
    classId: 'assault',
    className: 'Assault',
    branches: BRANCHES.assault,
    baseAbilities: ['dash', 'breach'],
    nodes: [
      // Breacher (left)
      node('close_quarters', 'Close Quarters', 'Shotgun base damage 6 → 7.', 'Shotgun damage 6 → 7.', 'swords', 2, 'breacher', { position: 0 }),
      node('rapid_breach', 'Rapid Breach', 'Breach cooldown 2 → 1 turn.', 'Breach cooldown 2 → 1.', 'door', 4, 'breacher', { position: 0 }),
      node('shock_entry', 'Shock Entry', 'After using Dash, the next Shotgun attack or Breach this Player Phase gains +2 damage.', 'Post-Dash: next Shotgun/Breach +2 damage this phase.', 'zap', 6, 'breacher', { position: 0 }),
      node('execution_window', 'Execution Window', 'First kill each Player Phase against an enemy within 2 tiles refunds +1 AP.', 'First close kill per phase: +1 AP.', 'crosshair', 8, 'breacher', { position: 0, minimumBranchInvestment: 2 }),
      node('room_clearer', 'Room Clearer', 'Killing with Breach makes the next Shotgun attack this Player Phase cost 0 AP.', 'Breach kill → next Shotgun 0 AP this phase.', 'swords', 10, 'breacher', { position: 0, prerequisites: ['execution_window'], capstone: true }),
      // Vanguard (right)
      node('momentum', 'Momentum', 'First enemy kill each Player Phase grants +1 AP.', 'First kill per phase: +1 AP (once).', 'zap', 2, 'vanguard', { position: 1 }),
      node('long_dash', 'Long Dash', 'Dash range 5 → 7 tiles.', 'Dash range 5 → 7.', 'wind', 4, 'vanguard', { position: 1 }),
      node('evasive_advance', 'Evasive Advance', 'Moving 5+ tiles in a Player Phase reduces the next incoming attack by 2.', 'Move 5+ tiles → first hit -2 damage.', 'shield', 6, 'vanguard', { position: 1 }),
      node('hit_and_run', 'Hit and Run', 'After damaging a Flanked enemy, gain one optional 3-tile reposition (0 AP).', 'Damage a Flanked enemy → 3-tile reposition (0 AP).', 'footprints', 8, 'vanguard', { position: 1, minimumBranchInvestment: 2 }),
      node('blitz', 'Blitz', 'First kill each Player Phase refreshes Dash if on cooldown.', 'First kill per phase: refresh Dash cooldown.', 'wind', 10, 'vanguard', { position: 1, prerequisites: ['hit_and_run'], capstone: true }),
    ],
  },
  heavy: {
    classId: 'heavy',
    className: 'Heavy',
    branches: BRANCHES.heavy,
    baseAbilities: ['suppress', 'launch_rocket'],
    nodes: [
      // Gunner (left)
      node('heavy_magazine', 'Heavy Magazine', 'Heavy Rifle max ammo 4 → 5.', 'Heavy Rifle ammo 4 → 5.', 'package', 2, 'gunner', { position: 0 }),
      node('deep_suppression', 'Deep Suppression', 'Suppressed targets deal -3 damage instead of -2.', 'Suppressed penalty -2 → -3.', 'gauge', 4, 'gunner', { position: 0 }),
      node('pin_down', 'Pin Down', 'If a Suppressed enemy moves, auto-fire one reaction shot (no AP, 1 ammo).', 'Suppressed enemy moves → free reaction shot.', 'crosshair', 6, 'gunner', { position: 0 }),
      node('sustained_fire', 'Sustained Fire', 'Second Heavy Rifle attack vs the same target in a phase deals +2 damage.', '2nd attack vs same target: +2 damage.', 'flame', 8, 'gunner', { position: 0, minimumBranchInvestment: 2 }),
      node('lockdown', 'Lockdown', 'First Suppress each Player Phase costs 0 AP (cooldown still applies).', 'First Suppress per phase: 0 AP.', 'gauge', 10, 'gunner', { position: 0, prerequisites: ['sustained_fire'], capstone: true }),
      // Demolitions (right) — Launch Rocket upgrades
      node('bigger_boom', 'Bigger Boom', 'Launch Rocket blast area 3×3 → 5×5.', 'Rocket area 3×3 → 5×5.', 'expand', 2, 'demolitions', { position: 1 }),
      node('more_boom', 'More Boom', '+1 Launch Rocket use per battle (1 → 2).', 'Rocket uses 1 → 2 per battle.', 'package', 4, 'demolitions', { position: 1 }),
      node('further_boom', 'Further Boom', 'Launch Rocket range 5 → 10.', 'Rocket range 5 → 10.', 'wind', 6, 'demolitions', { position: 1 }),
      node('stronger_boom', 'Stronger Boom', 'Launch Rocket unit damage 3 → 5 (terrain damage stays 4).', 'Rocket damage 3 → 5.', 'flame', 8, 'demolitions', { position: 1, minimumBranchInvestment: 2 }),
      node('compensated_anarchists', 'Compensated Anarchists', 'Launch Rocket costs 0 AP instead of 1.', 'Launch Rocket: 1 AP → 0 AP.', 'bomb', 10, 'demolitions', { position: 1, capstone: true }),
    ],
  },
  support: {
    classId: 'support',
    className: 'Support',
    branches: BRANCHES.support,
    baseAbilities: ['heal', 'command'],
    nodes: [
      // Medic (left)
      node('field_medic', 'Field Medic', 'Heal 4 → 6 HP.', 'Heal 4 → 6 HP.', 'heart', 2, 'medic', { position: 0 }),
      node('rapid_recovery', 'Rapid Recovery', 'Heal cooldown 3 → 2 turns.', 'Heal cooldown 3 → 2.', 'heart', 4, 'medic', { position: 0 }),
      node('stabilize', 'Stabilize', 'Revived allies may receive Command the same phase (normally blocked until next phase).', 'Revived allies can be Commanded same phase.', 'heart', 6, 'medic', { position: 0 }),
      node('emergency_medicine', 'Emergency Medicine', 'Heal on a target at ≤50% Max HP gains +2 range and +2 healing.', 'Heal ≤50% HP target: +2 range, +2 healing.', 'heart', 8, 'medic', { position: 0, minimumBranchInvestment: 2 }),
      node('lifeline', 'Lifeline', 'Healing a Downed ally restores +2 HP (on top of the heal amount).', 'Revive heals +2 HP.', 'heart', 10, 'medic', { position: 0, prerequisites: ['emergency_medicine'], capstone: true }),
      // Commander (right)
      node('tactical_command', 'Tactical Command', 'Command cooldown 3 → 2 turns.', 'Command cooldown 3 → 2.', 'radio', 2, 'commander', { position: 1 }),
      node('extended_command', 'Extended Command', 'Command range 5 → 7 tiles.', 'Command range 5 → 7.', 'radio', 4, 'commander', { position: 1 }),
      node('rally', 'Rally', 'Command removes Suppressed and Marked from the target (still grants +1 AP).', 'Command clears Suppressed + Marked.', 'radio', 6, 'commander', { position: 1 }),
      node('coordinated_strike', 'Coordinated Strike', 'A Commanded ally gains +2 damage on their next attack this phase.', 'Commanded ally: +2 next attack damage.', 'swords', 8, 'commander', { position: 1, minimumBranchInvestment: 2 }),
      node('command_network', 'Command Network', 'First Command each Player Phase costs 0 AP (cooldown still applies).', 'First Command per phase: 0 AP.', 'radio', 10, 'commander', { position: 1, prerequisites: ['coordinated_strike'], capstone: true }),
    ],
  },
  engineer: {
    classId: 'engineer',
    className: 'Engineer',
    branches: BRANCHES.engineer,
    baseAbilities: ['deploy_barricade', 'shock_mine'],
    nodes: [
      // Fortifier (left)
      node('reinforced_construction', 'Reinforced Construction', 'Barricade HP 4 → 6.', 'Barricade HP 4 → 6.', 'shield', 2, 'fortifier', { position: 0 }),
      node('rapid_deployment', 'Rapid Deployment', 'Deploy Barricade cooldown 3 → 2 turns.', 'Deploy Barricade cooldown 3 → 2.', 'wrench', 4, 'fortifier', { position: 0 }),
      node('extended_works', 'Extended Works', 'Maximum active barricades 2 → 3 (this Engineer only).', 'Max active barricades 2 → 3.', 'shield', 6, 'fortifier', { position: 0 }),
      node('hardpoint', 'Hardpoint', 'Allies protected by this Engineer\'s barricade take -1 incoming damage.', 'Allied behind your barricade: -1 damage.', 'shield', 8, 'fortifier', { position: 0, minimumBranchInvestment: 2 }),
      node('instant_fortification', 'Instant Fortification', 'Deploy Barricade costs 0 AP, cooldown becomes 1 turn.', 'Deploy Barricade: 0 AP, 1 turn CD.', 'wrench', 10, 'fortifier', { position: 0, prerequisites: ['hardpoint'], capstone: true }),
      // Saboteur (right) — battlefield mine control progression
      node('mine_field', 'Minefield', 'Explosive Mine now places mines on the selected tile and every valid adjacent tile.', 'Explosive Mine: 1 mine → 3×3 minefield.', 'grid', 2, 'saboteur', { position: 1 }),
      node('remote_placement', 'Remote Placement', 'Mine placement range increases from 5 to 7.', 'Mine placement range 5 → 7.', 'crosshair', 4, 'saboteur', { position: 1 }),
      node('overcharged_mine', 'Overcharged Mine', 'Explosive Mine damage increases from 2 to 4.', 'Explosive Mine damage 2 → 4.', 'zap', 6, 'saboteur', { position: 1 }),
      node('friendly_mines', 'Friendly Mines', 'Your soldiers no longer trigger or take damage/status effects from mines placed by your squad.', 'Player soldiers immune to squad mines.', 'shield', 8, 'saboteur', { position: 1, minimumBranchInvestment: 2 }),
      node('agent_provocateur', 'Agent Provocateur', 'Placing Explosive Mines and Minefields costs 0 AP.', 'Mine placement: 0 AP.', 'wind', 10, 'saboteur', { position: 1, prerequisites: ['friendly_mines'], capstone: true }),
    ],
  },
  marksman: {
    classId: 'marksman',
    className: 'Marksman',
    branches: BRANCHES.marksman,
    baseAbilities: ['line_up', 'relocate'],
    nodes: [
      // Sharpshooter (left)
      node('high_caliber_rounds', 'High-Caliber Rounds', 'Precision Rifle normal-range damage 5 → 6 (close-range stays 3).', 'Precision Rifle damage 5 → 6.', 'crosshair', 2, 'sharpshooter', { position: 0 }),
      node('patient_aim', 'Patient Aim', 'Line Up cooldown 2 → 1 turn.', 'Line Up cooldown 2 → 1.', 'eye', 4, 'sharpshooter', { position: 0 }),
      node('deadeye', 'Deadeye', 'Line Up attack vs a covered target deals +2 damage.', 'Line Up vs covered: +2 damage.', 'crosshair', 6, 'sharpshooter', { position: 0 }),
      node('executioner', 'Executioner', 'Precision Rifle attacks vs enemies at ≤50% HP deal +2 damage.', 'Precision Rifle vs ≤50% HP: +2 damage.', 'swords', 8, 'sharpshooter', { position: 0, minimumBranchInvestment: 2 }),
      node('perfect_shot', 'Perfect Shot', 'Line Up costs 0 AP (cooldown still applies).', 'Line Up: 0 AP.', 'eye', 10, 'sharpshooter', { position: 0, prerequisites: ['executioner'], capstone: true }),
      // Hunter (right)
      node('extended_magazine', 'Extended Magazine', 'Precision Rifle ammo 2 → 3.', 'Precision Rifle ammo 2 → 3.', 'package', 2, 'hunter', { position: 1 }),
      node('rapid_reposition', 'Rapid Reposition', 'Relocate cooldown 3 → 2 turns.', 'Relocate cooldown 3 → 2.', 'wind', 4, 'hunter', { position: 1 }),
      node('snap_shooter', 'Snap Shooter', 'Remove the Precision Rifle close-range damage penalty.', 'No close-range damage penalty.', 'crosshair', 6, 'hunter', { position: 1 }),
      node('long_relocate', 'Long Relocate', 'Relocate range 3 → 5. After Relocate, first incoming hit -2 damage.', 'Relocate range 5; first hit after -2.', 'wind', 8, 'hunter', { position: 1, minimumBranchInvestment: 2 }),
      node('chain_hunter', 'Chain Hunter', 'After Relocate, first kill that phase refreshes Relocate and grants +2 next attack.', 'Post-Relocate kill: refresh Relocate, +2 next attack.', 'crosshair', 10, 'hunter', { position: 1, prerequisites: ['long_relocate'], capstone: true }),
    ],
  },
};

export function getSkillTree(cls) {
  return SKILL_TREES[cls] || null;
}

export function getSkillNodes(cls) {
  return (SKILL_TREES[cls] && SKILL_TREES[cls].nodes) || [];
}

export function getSkillNode(cls, nodeId) {
  return getSkillNodes(cls).find((n) => n.id === nodeId) || null;
}

export function getBranches(cls) {
  return (SKILL_TREES[cls] && SKILL_TREES[cls].branches) || [];
}

// Base class abilities displayed at the top of each Skill Tree (not purchasable).
export function getTreeBaseAbilities(cls) {
  return (SKILL_TREES[cls] && SKILL_TREES[cls].baseAbilities) || [];
}

// Tiers as [[tierNumber, [nodes sorted by position]], ...] sorted by tier.
export function getTiers(cls) {
  const nodes = getSkillNodes(cls);
  const tierMap = new Map();
  for (const n of nodes) {
    if (!tierMap.has(n.tier)) tierMap.set(n.tier, []);
    tierMap.get(n.tier).push(n);
  }
  for (const arr of tierMap.values()) arr.sort((a, b) => a.position - b.position);
  return [...tierMap.entries()].sort((a, b) => a[0] - b[0]);
}

export function hasSkill(soldier, nodeId) {
  if (!soldier || !soldier.upgrades) return false;
  return Object.values(soldier.upgrades).includes(nodeId);
}

// Total Skill Points a soldier has earned by reaching their current level.
// Awards occur at every even level (2, 4, 6, 8, 10, 12, 14, 16, 18, 20) — max
// 10 at Level 20. Derived from level so repeated Respec, save/load, and
// level-ups can never grant more than the level permits.
export function totalSkillPointsByLevel(level) {
  return SKILL_AWARD_LEVELS.filter((lvl) => (level || 1) >= lvl).length;
}

// Number of skills currently selected (each costs 1 Skill Point).
export function countSelectedSkills(soldier) {
  if (!soldier || !soldier.upgrades) return 0;
  return Object.values(soldier.upgrades).filter(Boolean).length;
}

// Available Skill Points = earned by level − selected skills. This is the
// single source of truth for purchase gating; the legacy stored
// `available_skill_selections` field is kept in sync but never trusted.
export function getAvailableSelections(soldier) {
  if (!soldier) return 0;
  const earned = totalSkillPointsByLevel(soldier.level || 1);
  const spent = countSelectedSkills(soldier);
  return Math.max(0, earned - spent);
}

// Count selected skills belonging to a given branch (display only — no gating).
export function branchInvestment(soldier, branchId) {
  if (!soldier || !soldier.upgrades || !branchId) return 0;
  const cls = soldier.class;
  const nodes = getSkillNodes(cls);
  const branchNodeIds = new Set(nodes.filter((n) => n.branchId === branchId).map((n) => n.id));
  return Object.values(soldier.upgrades).filter((id) => branchNodeIds.has(id)).length;
}

// Compute the node's display state. Freedom-first: a skill is purchasable when
// the soldier meets its Level requirement and has a Skill Point available.
// Prerequisites, exclusivity, and branch investment no longer restrict choice.
export function getNodeState(node, soldier) {
  if (!node || !soldier) return NODE_STATES.LOCKED;
  if (hasSkill(soldier, node.id)) return NODE_STATES.PURCHASED;
  if ((soldier.level || 1) < node.levelRequirement) return NODE_STATES.LOCKED;
  if (getAvailableSelections(soldier) <= 0) return NODE_STATES.NO_POINTS;
  return NODE_STATES.AVAILABLE;
}

// Human-readable reason for why a node is unavailable (null when available/purchased).
export function getNodeStateReason(node, soldier) {
  const state = getNodeState(node, soldier);
  if (state === NODE_STATES.PURCHASED) return null;
  if (state === NODE_STATES.AVAILABLE) return null;
  if (state === NODE_STATES.NO_POINTS) return 'No skill points available';
  // LOCKED — only the level gate remains.
  if ((soldier.level || 1) < node.levelRequirement) return `Requires Level ${node.levelRequirement}`;
  return 'Locked';
}

// Migration helper: compute unspent selections from level vs. already-chosen
// upgrades. Used when loading old saves that lack availableSkillSelections.
export function computeUnspentSelections(soldier) {
  if (!soldier) return 0;
  const awards = totalSkillPointsByLevel(soldier.level || 1);
  const spent = countSelectedSkills(soldier);
  return Math.max(0, awards - spent);
}

// Apply a skill selection. Returns a new soldier object. Throws if the node is
// not currently available (guards against rapid-tap duplicates and invalid states).
// Skills are stored as an array of ids so multiple skills at the same level can
// coexist (freedom-first tree).
export function applySkillSelection(soldier, nodeId) {
  const node = getSkillNode(soldier.class, nodeId);
  if (!node) throw new Error('Unknown skill');
  const state = getNodeState(node, soldier);
  if (state !== NODE_STATES.AVAILABLE) throw new Error(`Skill not available: ${state}`);
  const base = Array.isArray(soldier.upgrades) ? soldier.upgrades : [];
  const upgrades = [...base, nodeId];
  const available_skill_selections = getAvailableSelections({ ...soldier, upgrades });
  return { ...soldier, upgrades, available_skill_selections };
}