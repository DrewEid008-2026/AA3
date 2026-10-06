// Squad deployment capacity upgrades. Stored on PlayerSave as squad_upgrades.
// Default capacity is 3; Improvement 1 → 4; Improvement 2 → 5 (requires Imp 1).

export const BASE_SQUAD_SIZE = 3;

export const SQUAD_UPGRADES = {
  improvement1: {
    id: 'improvement1',
    name: 'Squad Size Improvement 1',
    desc: 'Expand squad deployment capacity to four soldiers.',
    cost: 250,
    requires: null,
  },
  improvement2: {
    id: 'improvement2',
    name: 'Squad Size Improvement 2',
    desc: 'Expand squad deployment capacity to five soldiers.',
    cost: 500,
    requires: 'improvement1',
  },
  // Chess Board — a playful QoL upgrade, not a squad-size improvement. One-time
  // purchase that unlocks the Chess Table minigame for every soldier. Stored on
  // squad_upgrades like the others so the existing purchase/lock/persist flow
  // applies; it does NOT affect getMaxSquadSize (which only reads imp1/imp2).
  chess_board: {
    id: 'chess_board',
    name: 'Chess Board',
    desc: 'Unlocks the Chess Table, where soldiers can test their luck against the board.',
    cost: 300,
    requires: null,
  },
};

// Chess Board unlock check — true when the Chess Board upgrade is purchased.
// Used by the soldier Bio/Manage menu to gate the Chess Table button.
export function isChessBoardUnlocked(save) {
  return !!(save?.squad_upgrades?.chess_board);
}

export function getMaxSquadSize(save) {
  const upgrades = save?.squad_upgrades || {};
  let size = BASE_SQUAD_SIZE;
  if (upgrades.improvement1) size = 4;
  if (upgrades.improvement2) size = 5;
  return size;
}

export function isUpgradePurchased(save, upgradeId) {
  return !!(save?.squad_upgrades?.[upgradeId]);
}

export function isUpgradeLocked(save, upgradeId) {
  const upgrade = SQUAD_UPGRADES[upgradeId];
  if (!upgrade) return true;
  if (isUpgradePurchased(save, upgradeId)) return false;
  if (upgrade.requires && !isUpgradePurchased(save, upgrade.requires)) return true;
  return false;
}