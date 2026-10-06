// Attack presentation pipeline — the visual/feedback layer for weapon shots.
//
// This module is purely presentational. It never changes damage, hit logic,
// range, cover, AP, or any combat rule. Combat results come from the existing
// deterministic rules (combat.js); presentation is downstream of resolution.
//
// Weapons declare a `presentation` family (see weapons.js). This module maps a
// weapon to its presentation type, per-weapon visual tuning (tracer width,
// color, recoil), and timing constants. The visual component
// (AttackEffects.jsx) consumes these to render muzzle flash, tracer/beam, and
// impact effects. New presentation families (explosive, melee, electrical,
// psionic, alien biological) can be added by extending PRESENTATION_TYPES and
// the timing/profile tables — the architecture is not boxed into two cases.

// Extensible presentation family registry. Add new families here as the game
// grows (e.g. EXPLOSIVE: 'explosive', MELEE: 'melee'). Each family should get a
// matching entry in SHOT_TIMING and a visual treatment in AttackEffects.jsx.
export const PRESENTATION_TYPES = {
  BALLISTIC: 'ballistic',
  BEAM: 'beam',
};

export const DEFAULT_PRESENTATION = PRESENTATION_TYPES.BALLISTIC;

// Resolve a weapon's presentation family. Falls back to the default so a
// weapon with no explicit field still renders. Never infer from team — the
// data model owns the classification so future exceptions just work.
export function getWeaponPresentation(weapon) {
  if (!weapon) return DEFAULT_PRESENTATION;
  const p = weapon.presentation;
  if (!p) return DEFAULT_PRESENTATION;
  return p;
}

// Timing for each presentation family (ms). `travel` is the projectile/beam
// lead-in before impact; `impact` is the post-impact settle. Total shot time
// is travel + impact. Both stay well under 1s to keep combat fast.
export const SHOT_TIMING = {
  ballistic: { travel: 130, impact: 130 },
  beam: { travel: 170, impact: 150 },
};

export function getShotTiming(presentation) {
  return SHOT_TIMING[presentation] || SHOT_TIMING[DEFAULT_PRESENTATION];
}

// Total duration of a shot presentation (travel + impact). Callers that need to
// await the full effect before releasing control use this.
export function getShotDuration(presentation) {
  const t = getShotTiming(presentation);
  return t.travel + t.impact;
}

// Per-weapon visual tuning within a presentation family. Subtle flavor only —
// one ballistic family with small per-weapon differences, not five systems.
// `tracerWidth` is in SVG-grid units (viewBox 9x14). `recoil` flags a brief
// attacker shake. Colors are Tailwind-ish hex used directly in SVG strokes.
const BALLISTIC_PROFILE_DEFAULT = {
  tracerWidth: 0.06,
  tracerColor: '#fde68a', // amber-200
  tracerCoreColor: '#ffffff',
  muzzleColor: '#fbbf24', // amber-400
  muzzleRadius: 0.32,
  impactColor: '#fcd34d', // amber-300
  impactRadius: 0.3,
  recoil: false,
};

// Per-weapon ballistic flavor, keyed by weapon family. Shotgun = chunky/wide,
// LMG = solid + recoil, Rifle = standard, Sniper = crisp/thin. Subtle
// differences only. Also keeps legacy weapon type keys for backward compat.
const BALLISTIC_OVERRIDES = {
  shotgun: {
    tracerWidth: 0.11,
    tracerColor: '#fcd34d',
    muzzleRadius: 0.42,
    impactRadius: 0.38,
    impactColor: '#f59e0b',
    recoil: true,
  },
  lmg: {
    tracerWidth: 0.08,
    tracerColor: '#fde68a',
    muzzleRadius: 0.36,
    recoil: true,
  },
  heavy_rifle: {  // legacy alias
    tracerWidth: 0.08,
    tracerColor: '#fde68a',
    muzzleRadius: 0.36,
    recoil: true,
  },
  rifle: {
    tracerWidth: 0.055,
    tracerColor: '#fef3c7',
  },
  carbine: {  // legacy alias
    tracerWidth: 0.055,
    tracerColor: '#fef3c7',
  },
  sniper_rifle: {
    tracerWidth: 0.04,
    tracerColor: '#ffffff',
    tracerCoreColor: '#bae6fd',
    muzzleRadius: 0.28,
    impactRadius: 0.24,
  },
  precision_rifle: {  // legacy alias
    tracerWidth: 0.04,
    tracerColor: '#ffffff',
    tracerCoreColor: '#bae6fd',
    muzzleRadius: 0.28,
    impactRadius: 0.24,
  },
};

// One consistent beam style for all alien ranged weapons. Cyan-green energy.
const BEAM_PROFILE_DEFAULT = {
  tracerWidth: 0.09,
  tracerColor: '#22d3ee', // cyan-400
  tracerCoreColor: '#ecfeff', // cyan-50
  glowColor: '#06b6d4', // cyan-500
  muzzleColor: '#67e8f9', // cyan-300
  muzzleRadius: 0.34,
  impactColor: '#22d3ee',
  impactRadius: 0.34,
  recoil: false,
};

// Merge a weapon's base family profile with any per-weapon overrides.
export function getWeaponVisualProfile(weapon) {
  if (!weapon) return BALLISTIC_PROFILE_DEFAULT;
  const presentation = getWeaponPresentation(weapon);
  if (presentation === PRESENTATION_TYPES.BEAM) {
    return BEAM_PROFILE_DEFAULT;
  }
  const override = BALLISTIC_OVERRIDES[weapon.type] || {};
  return { ...BALLISTIC_PROFILE_DEFAULT, ...override };
}

// Audio hook placeholders. No sound system is wired yet, but the presentation
// pipeline exposes these family names so a future audio layer can trigger the
// right sound per shot. Battle.jsx does not call these — they are documented
// here for the future audio integration to consume.
export const SHOT_AUDIO_FAMILIES = {
  ballistic: { fire: 'ballistic_fire', impact: 'impact_ballistic' },
  beam: { fire: 'beam_fire', impact: 'impact_beam' },
};

export function getShotAudioFamily(presentation) {
  return SHOT_AUDIO_FAMILIES[presentation] || SHOT_AUDIO_FAMILIES[DEFAULT_PRESENTATION];
}