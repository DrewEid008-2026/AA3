import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { getActiveSlot } from '@/game/saveSlots';

// Guards campaign routes. If no active save slot is set, redirect to the title
// screen so the player must load or create a campaign first. Renders <Outlet />
// for nested routes when a campaign is active.
export default function CampaignGuard() {
  const active = getActiveSlot();
  if (active == null) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}