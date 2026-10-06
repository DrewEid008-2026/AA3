import React from 'react';
import { ART } from '@/game/artAssets';

// Reusable splatter-brush "ALIENS, AGAIN." logo lockup. Renders the pre-generated
// noir logo image (white ink + green goo drip + red splatter + purple accents)
// so the same logo treatment appears wherever the game title shows in the UI.
//
// Props:
//   className — Tailwind classes for sizing/layout (the image fills its width)
//   alt — optional alt override
export default function GameLogo({ className = '', alt = 'Aliens, again.' }) {
  return (
    <img
      src={ART.title.logo}
      alt={alt}
      className={`object-contain select-none pointer-events-none ${className}`}
      draggable={false}
    />
  );
}