// Guided Combat Tutorial — highlight target parsing.
//
// A highlight target is a short string the presentation layer resolves to a
// pulse/outline on a real UI element or battlefield token. Keeping the format
// as a string lets steps stay data-only (no JSX in the step table).
//
// Formats:
//   'unit:<unitId>'      — pulse a unit token on the battlefield
//   'tile:<x>,<y>'       — pulse a map tile (reachable destination, cover, etc.)
//   'ui:<controlId>'     — pulse a HUD control
//
// UI control ids (must match ids the highlight layer knows how to find):
//   attack, reload, overwatch, ability:<abilityId>, utility, overwatch_all,
//   end_turn, lens, commander, ap_display, fire

export const HIGHLIGHT_KINDS = {
  UNIT: 'unit',
  TILE: 'tile',
  UI: 'ui',
};

export function parseHighlightTarget(target) {
  if (!target || typeof target !== 'string') return null;
  if (target.startsWith('unit:')) return { kind: HIGHLIGHT_KINDS.UNIT, id: target.slice(5) };
  if (target.startsWith('tile:')) {
    const rest = target.slice(5);
    const [xStr, yStr] = rest.split(',');
    const x = Number(xStr);
    const y = Number(yStr);
    if (Number.isNaN(x) || Number.isNaN(y)) return null;
    return { kind: HIGHLIGHT_KINDS.TILE, x, y };
  }
  if (target.startsWith('ui:')) return { kind: HIGHLIGHT_KINDS.UI, id: target.slice(3) };
  return null;
}

// Resolve all highlight targets for a step into a list of parsed targets.
export function resolveHighlights(step) {
  if (!step || !step.highlightTargets) return [];
  return step.highlightTargets.map(parseHighlightTarget).filter(Boolean);
}