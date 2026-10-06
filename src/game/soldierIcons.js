// Soldier icon registry — a large curated set of lucide icons for cosmetic
// soldier customization. Each icon has a stable key, a display name, and the
// lucide component. Class defaults map each class to its base icon key so
// existing soldiers (no `icon` field) render unchanged.
//
// `getSoldierIconKey` / `getSoldierIconComponent` are the single source of truth
// used by BioPanel, SoldierCard, and the battle UnitToken (via unit creation).

import {
  Swords, Shield, Heart, Wrench, Crosshair,
  Skull, Zap, Target, Flame, Bomb, Rocket, Radar, Anchor, Hammer, Siren,
  Flag, Footprints, Eye, Atom, Bot, Factory, Cpu, CircuitBoard, Terminal,
  Radio, Orbit, Satellite, Cable, Ghost, Hexagon, Fingerprint, Gauge,
  Compass, Wind, Snowflake, Droplet, Waves, Moon, Sun, Cloud, Mountain,
  Sparkles, Gem, Star, Crown, Diamond, Triangle, Octagon, HelpCircle,
} from 'lucide-react';

// Ordered list for the picker. Class defaults come first so a fresh soldier
// sees its current icon at the top of the grid.
export const SOLDIER_ICONS = [
  { key: 'swords', name: 'Swords', Component: Swords },
  { key: 'shield', name: 'Shield', Component: Shield },
  { key: 'heart', name: 'Heart', Component: Heart },
  { key: 'wrench', name: 'Wrench', Component: Wrench },
  { key: 'crosshair', name: 'Crosshair', Component: Crosshair },
  { key: 'skull', name: 'Skull', Component: Skull },
  { key: 'zap', name: 'Bolt', Component: Zap },
  { key: 'target', name: 'Target', Component: Target },
  { key: 'flame', name: 'Flame', Component: Flame },
  { key: 'bomb', name: 'Bomb', Component: Bomb },
  { key: 'rocket', name: 'Rocket', Component: Rocket },
  { key: 'radar', name: 'Radar', Component: Radar },
  { key: 'anchor', name: 'Anchor', Component: Anchor },
  { key: 'hammer', name: 'Hammer', Component: Hammer },
  { key: 'siren', name: 'Siren', Component: Siren },
  { key: 'flag', name: 'Flag', Component: Flag },
  { key: 'footprints', name: 'Footprints', Component: Footprints },
  { key: 'eye', name: 'Eye', Component: Eye },
  { key: 'atom', name: 'Atom', Component: Atom },
  { key: 'bot', name: 'Bot', Component: Bot },
  { key: 'factory', name: 'Factory', Component: Factory },
  { key: 'cpu', name: 'CPU', Component: Cpu },
  { key: 'circuit_board', name: 'Circuit', Component: CircuitBoard },
  { key: 'terminal', name: 'Terminal', Component: Terminal },
  { key: 'radio', name: 'Radio', Component: Radio },
  { key: 'orbit', name: 'Orbit', Component: Orbit },
  { key: 'satellite', name: 'Satellite', Component: Satellite },
  { key: 'cable', name: 'Cable', Component: Cable },
  { key: 'ghost', name: 'Ghost', Component: Ghost },
  { key: 'hexagon', name: 'Hexagon', Component: Hexagon },
  { key: 'fingerprint', name: 'Fingerprint', Component: Fingerprint },
  { key: 'gauge', name: 'Gauge', Component: Gauge },
  { key: 'compass', name: 'Compass', Component: Compass },
  { key: 'wind', name: 'Wind', Component: Wind },
  { key: 'snowflake', name: 'Snowflake', Component: Snowflake },
  { key: 'droplet', name: 'Droplet', Component: Droplet },
  { key: 'waves', name: 'Waves', Component: Waves },
  { key: 'moon', name: 'Moon', Component: Moon },
  { key: 'sun', name: 'Sun', Component: Sun },
  { key: 'cloud', name: 'Cloud', Component: Cloud },
  { key: 'mountain', name: 'Mountain', Component: Mountain },
  { key: 'sparkles', name: 'Sparkles', Component: Sparkles },
  { key: 'gem', name: 'Gem', Component: Gem },
  { key: 'star', name: 'Star', Component: Star },
  { key: 'crown', name: 'Crown', Component: Crown },
  { key: 'diamond', name: 'Diamond', Component: Diamond },
  { key: 'triangle', name: 'Triangle', Component: Triangle },
  { key: 'octagon', name: 'Octagon', Component: Octagon },
];

// key → component map for fast lookups (UnitToken, etc.).
export const SOLDIER_ICON_COMPONENTS = Object.fromEntries(
  SOLDIER_ICONS.map((ic) => [ic.key, ic.Component])
);

// Class → default icon key (matches PLAYER_ARCHETYPES icons in unitTypes.js).
const CLASS_DEFAULT_ICON_KEYS = {
  assault: 'swords',
  heavy: 'rocket',
  support: 'heart',
  engineer: 'wrench',
  marksman: 'crosshair',
};

// Returns the effective icon key for a soldier: the custom override if set,
// otherwise the class default. Works on both soldier records (with `.class`)
// and battle units (with `.archetype`).
export function getSoldierIconKey(soldier) {
  if (!soldier) return null;
  if (soldier.icon) return soldier.icon;
  const cls = soldier.class || soldier.archetype;
  return CLASS_DEFAULT_ICON_KEYS[cls] || 'swords';
}

// Returns the lucide component for a soldier's effective icon.
export function getSoldierIconComponent(soldier) {
  return SOLDIER_ICON_COMPONENTS[getSoldierIconKey(soldier)] || HelpCircle;
}