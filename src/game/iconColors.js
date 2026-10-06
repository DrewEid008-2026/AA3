// Curated icon color palette for soldier customization. Each color has a hex
// value (used via inline style for dynamic application) and a display name.
// The class icon and label remain the primary class indicator — icon color is
// a secondary cosmetic layer for distinguishing same-class soldiers.

export const ICON_COLORS = {
  red: { key: 'red', name: 'Red', hex: '#ef4444' },
  orange: { key: 'orange', name: 'Orange', hex: '#f97316' },
  yellow: { key: 'yellow', name: 'Yellow', hex: '#eab308' },
  green: { key: 'green', name: 'Green', hex: '#22c55e' },
  cyan: { key: 'cyan', name: 'Cyan', hex: '#06b6d4' },
  blue: { key: 'blue', name: 'Blue', hex: '#3b82f6' },
  purple: { key: 'purple', name: 'Purple', hex: '#a855f7' },
  white: { key: 'white', name: 'White', hex: '#cbd5e1' },
};

export const ICON_COLOR_KEYS = Object.keys(ICON_COLORS);

// Class-default icon colors (distinct per class from the available palette).
const CLASS_DEFAULTS = {
  assault: 'green',
  heavy: 'red',
  support: 'red',
  engineer: 'purple',
  marksman: 'purple',
};

export function getDefaultIconColor(cls) {
  return CLASS_DEFAULTS[cls] || 'blue';
}

export function getIconColor(key) {
  return ICON_COLORS[key] || null;
}

export function getIconColorHex(key) {
  return ICON_COLORS[key]?.hex || null;
}

export function getSoldierIconColorHex(soldier) {
  if (!soldier || !soldier.icon_color) return null;
  return getIconColorHex(soldier.icon_color);
}