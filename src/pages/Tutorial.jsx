import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';

// Tutorial route — redirects to the handcrafted Tutorial mission
// (FIRST CONTACT). The tutorial is a real tactical battle on a dedicated
// handcrafted map with six teaching zones. It uses temporary soldiers and
// does not affect the campaign.
//
// This page is a thin redirect so the CampaignIntro's "Tutorial On" path
// (/tutorial) lands on the actual battle without changing the intro flow.
export default function Tutorial() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/battle/tutorial_first_contact', { replace: true });
  }, [navigate]);

  return (
    <div className="h-[100dvh] bg-neutral-950 flex flex-col items-center justify-center px-6 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-bio/15 border border-bio/40 mb-5">
        <GraduationCap className="w-8 h-8 text-bio" />
      </div>
      <h1 className="text-white font-black text-xl tracking-[0.15em] uppercase mb-2">
        First Contact
      </h1>
      <p className="text-neutral-400 text-xs leading-relaxed max-w-xs">
        Deploying to the tutorial mission...
      </p>
    </div>
  );
}