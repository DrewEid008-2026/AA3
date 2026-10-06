import React, { useMemo } from 'react';

// TitleBackground — one static epic background per app session.
// On each launch the next image in the rotation is chosen (persisted via a
// localStorage counter, wrapping after 10). That single image stays fixed for
// the whole session on the title screen — no slideshow, no crossfade, no
// interval. A slow Ken Burns zoom (scale 1.0 → 1.05 over 25s, then hold)
// keeps the still image feeling alive.
//
// Purely visual — pointer-events-none, sits behind the logo + menu overlays.

const TITLE_BACKGROUNDS = [
  'https://base44.app/api/apps/6abf3ad0bb5a43583580b9e3/files/mp/public/6abf3ad0bb5a43583580b9e3/d803bfc3d_scene01_titan_ribs_916.png',
  'https://base44.app/api/apps/6abf3ad0bb5a43583580b9e3/files/mp/public/6abf3ad0bb5a43583580b9e3/bba2a45f6_scene02_frozen_crash_916.png',
  'https://base44.app/api/apps/6abf3ad0bb5a43583580b9e3/files/mp/public/6abf3ad0bb5a43583580b9e3/6c1b51099_scene03_swarm_stormwall_916.png',
  'https://base44.app/api/apps/6abf3ad0bb5a43583580b9e3/files/mp/public/6abf3ad0bb5a43583580b9e3/727bba565_scene04_carrier_hive_916.png',
  'https://base44.app/api/apps/6abf3ad0bb5a43583580b9e3/files/mp/public/6abf3ad0bb5a43583580b9e3/115835097_scene05_cathedral_growth_916.png',
  'https://base44.app/api/apps/6abf3ad0bb5a43583580b9e3/files/mp/public/6abf3ad0bb5a43583580b9e3/ee934c344_scene06_canyon_spires_916.png',
  'https://base44.app/api/apps/6abf3ad0bb5a43583580b9e3/files/mp/public/6abf3ad0bb5a43583580b9e3/685268724_scene07_harbor_leviathan_916.png',
  'https://base44.app/api/apps/6abf3ad0bb5a43583580b9e3/files/mp/public/6abf3ad0bb5a43583580b9e3/fea8d466b_scene08_crop_circles_916.png',
  'https://base44.app/api/apps/6abf3ad0bb5a43583580b9e3/files/mp/public/6abf3ad0bb5a43583580b9e3/ea2acab77_scene09_overpass_camp_916.png',
  'https://base44.app/api/apps/6abf3ad0bb5a43583580b9e3/files/mp/public/6abf3ad0bb5a43583580b9e3/17536a18d_scene10_moon_eclipse_916.png',
];

const COUNTER_KEY = 'aliens_title_bg_counter';

// Pick the next background in the rotation, persisting the counter so each
// launch advances to the following scene (wrapping after 10).
function pickBackground() {
  let counter = 0;
  try {
    const raw = localStorage.getItem(COUNTER_KEY);
    if (raw != null) counter = parseInt(raw, 10) || 0;
  } catch (e) { /* localStorage unavailable */ }
  const idx = counter % TITLE_BACKGROUNDS.length;
  try {
    localStorage.setItem(COUNTER_KEY, String(counter + 1));
  } catch (e) { /* ignore */ }
  return TITLE_BACKGROUNDS[idx];
}

export default function TitleBackground() {
  // Pick once per mount (per app session on the title screen). useMemo with no
  // deps ensures a single selection for the component's lifetime.
  const url = useMemo(pickBackground, []);

  return (
    <div className="absolute inset-0 overflow-hidden bg-neutral-950 pointer-events-none select-none">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${url})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
          transformOrigin: 'center top',
          animation: 'titleKenBurns 25s ease-out forwards',
        }}
      />
    </div>
  );
}