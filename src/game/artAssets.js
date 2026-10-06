// Central art asset URLs for the "Aliens, again." noir comic art direction.
// All art is pre-generated and hosted — use these exact URLs.
// Accent palette: toxic green (alien/bio), blood red (heavy firepower/medical),
// deep purple (tech/precision).

export const ART = {
  icons: {
    // Borderless full-bleed black ink square — massive white negative-space
    // "A" with toxic green alien goo drip and a blood red splatter. Final app
    // icon. Matches the "Aliens, again." splatter title treatment.
    alienSkull:
      'https://media.base44.com/images/public/6abf3ad0bb5a43583580b9e3/aa00b918b_generated_image.png',
    soldierHelmet:
      'https://media.base44.com/images/public/6abf3ad0bb5a43583580b9e3/26fdd5751_generated_image.png',
  },
  title: {
    // Final key art — true 9:16 portrait key art for mobile. Splatter-brush
    // "ALIENS, AGAIN." logo sized with side margins at top; dark clean zone at
    // the bottom for menu buttons.
    titled:
      'https://media.base44.com/images/public/6abf3ad0bb5a43583580b9e3/4c5dacdd5_generated_image.png',
    // Standalone splatter-brush logo lockup on black — for headers/menus.
    logo:
      'https://media.base44.com/images/public/6abf3f6847c86713f968f15c/29acc53f8_generated_image.png',
    // Logo-less rooftop — use as settings/menu background.
    logoLess:
      'https://media.base44.com/images/public/6abf3ad0bb5a43583580b9e3/a45047c1b_generated_image.png',
  },
  portraits: {
    assault:
      'https://media.base44.com/images/public/6abf3ad0bb5a43583580b9e3/4d7947cf4_generated_image.png',
    sniper:
      'https://media.base44.com/images/public/6abf3ad0bb5a43583580b9e3/2634b5f7a_generated_image.png',
    medic:
      'https://media.base44.com/images/public/6abf3ad0bb5a43583580b9e3/3c6579b96_generated_image.png',
    heavy:
      'https://media.base44.com/images/public/6abf3ad0bb5a43583580b9e3/3d81f9f7e_generated_image.png',
  },
  tokens: {
    soldierSheet:
      'https://media.base44.com/images/public/6abf3ad0bb5a43583580b9e3/31ae91bd4_generated_image.png',
    alienSheet:
      'https://media.base44.com/images/public/6abf3ad0bb5a43583580b9e3/0ab118c9b_generated_image.png',
    statusMarkers:
      'https://media.base44.com/images/public/6abf3ad0bb5a43583580b9e3/5f0f9cb4c_generated_image.png',
  },
  textures: {
    crackedAsphalt:
      'https://media.base44.com/images/public/6abf3ad0bb5a43583580b9e3/bf0829923_generated_image.png',
    concreteRubble:
      'https://media.base44.com/images/public/6abf3ad0bb5a43583580b9e3/f9df10ba8_generated_image.png',
    alienInfested:
      'https://media.base44.com/images/public/6abf3ad0bb5a43583580b9e3/7478590fe_generated_image.png',
    gridOverlay:
      'https://media.base44.com/images/public/6abf3ad0bb5a43583580b9e3/ae1126145_generated_image.png',
    coverProps:
      'https://media.base44.com/images/public/6abf3ad0bb5a43583580b9e3/36d2914ac_generated_image.png',
  },
  equipment: {
    weaponLineup:
      'https://media.base44.com/images/public/6abf3ad0bb5a43583580b9e3/8ee4e1176_generated_image.png',
    armorLineup:
      'https://media.base44.com/images/public/6abf3ad0bb5a43583580b9e3/9fbb66380_generated_image.png',
    alienWarrior:
      'https://media.base44.com/images/public/6abf3ad0bb5a43583580b9e3/8942efe01_generated_image.png',
    vfxSheet:
      'https://media.base44.com/images/public/6abf3ad0bb5a43583580b9e3/601854224_generated_image.png',
  },
};

// Class → portrait mapping. Color coding matches gameplay:
//   assault  → green  (aggressive / bio)
//   marksman → purple (precision / tech)
//   support  → red    (medical)
//   heavy    → red    (heavy firepower)
//   engineer → green  (tech-adjacent fallback)
export const CLASS_PORTRAITS = {
  assault: ART.portraits.assault,
  marksman: ART.portraits.sniper,
  support: ART.portraits.medic,
  heavy: ART.portraits.heavy,
  engineer: ART.portraits.assault,
};

export function getClassPortrait(cls) {
  return CLASS_PORTRAITS[cls] || ART.portraits.assault;
}