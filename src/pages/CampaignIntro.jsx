import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Rocket, GraduationCap, Swords, ChevronRight } from 'lucide-react';
import GameLogo from '@/components/GameLogo';

// Campaign intro — shown once after the player confirms a New Game. Establishes
// tone, explains the premise, and offers a Tutorial On/Off choice before the
// campaign begins. LET'S GO! routes to the tutorial stub or the Missions tab.
export default function CampaignIntro() {
  const navigate = useNavigate();
  const [tutorial, setTutorial] = useState(true);

  const handleGo = () => {
    navigate(tutorial ? '/tutorial' : '/missions');
  };

  return (
    <div className="h-[100dvh] bg-neutral-950 flex flex-col overflow-hidden">
      {/* Scrollable narrative */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto px-5 pt-10 pb-6">
          {/* Title block */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-bio/15 border border-bio/40 mb-4">
              <Rocket className="w-7 h-7 text-bio" />
            </div>
            <GameLogo className="w-64 mx-auto h-auto" />
            <p className="text-tech font-bold text-[11px] tracking-[0.35em] uppercase mt-2">
              Fast Squad Tactics
            </p>
          </div>

          {/* Narrative */}
          <div className="space-y-4 text-neutral-300 text-[13px] leading-relaxed">
            <p>
              Blah blah blah. The world is under attack by aliens.
            </p>
            <p>
              You know the drill.
            </p>
            <p>
              Ships in the sky. Weird technology. Very unfriendly visitors.
              Governments overwhelmed. Humanity in danger.
            </p>
            <p>
              And somehow, once again, <span className="text-white font-bold">YOU</span> are the one
              expected to fix all of this.
            </p>
            <p className="text-neutral-500 italic">No pressure.</p>
            <p>
              Fortunately, we are skipping the part where everyone stands around a command room
              talking for forty-five minutes.
            </p>
            <p>
              <span className="text-bio font-bold">Aliens, again.</span> is about getting you into the fight.
            </p>
            <ul className="space-y-1.5 pl-1">
              <li className="flex items-start gap-2"><span className="text-bio mt-0.5">▸</span> Fast turn-based battles.</li>
              <li className="flex items-start gap-2"><span className="text-bio mt-0.5">▸</span> Small tactical maps.</li>
              <li className="flex items-start gap-2"><span className="text-bio mt-0.5">▸</span> Dangerous decisions.</li>
              <li className="flex items-start gap-2"><span className="text-bio mt-0.5">▸</span> Very little waiting around.</li>
            </ul>
            <p>
              Move your squad. Break their cover. Blow holes through the battlefield. Use abilities.
              Get flanked. Return the favor.
            </p>
            <p>
              You will run into increasingly strange alien forces, battlefield commanders who are
              actively trying to ruin your day, giant war machines, destructible environments, and
              plenty of situations where the &lsquo;correct tactical solution&rsquo; is whatever
              ridiculous plan somehow works.
            </p>
            <p className="text-white font-semibold">
              Cheese the enemy. Abuse the terrain. Build ridiculous soldiers. Spend resources.
            </p>
          </div>
        </div>
      </div>

      {/* Tutorial choice + LET'S GO */}
      <div className="shrink-0 border-t border-neutral-800 bg-neutral-950/95 px-5 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        <p className="text-neutral-500 text-[10px] font-bold tracking-[0.2em] uppercase mb-2.5 text-center">
          Before you deploy
        </p>
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          <button
            type="button"
            onClick={() => setTutorial(true)}
            className={`flex flex-col items-center gap-1.5 py-3.5 rounded-lg border transition touch-manipulation ${
              tutorial
                ? 'bg-tech/15 border-tech/70 text-tech'
                : 'bg-neutral-900 border-neutral-700 text-neutral-400 active:scale-[0.98]'
            }`}
          >
            <GraduationCap className="w-5 h-5" />
            <span className="text-[11px] font-bold tracking-wide uppercase">Tutorial</span>
            <span className="text-[9px] tracking-wide uppercase opacity-70">On</span>
          </button>
          <button
            type="button"
            onClick={() => setTutorial(false)}
            className={`flex flex-col items-center gap-1.5 py-3.5 rounded-lg border transition touch-manipulation ${
              !tutorial
                ? 'bg-blood/15 border-blood/70 text-blood'
                : 'bg-neutral-900 border-neutral-700 text-neutral-400 active:scale-[0.98]'
            }`}
          >
            <Swords className="w-5 h-5" />
            <span className="text-[11px] font-bold tracking-wide uppercase">Tutorial</span>
            <span className="text-[9px] tracking-wide uppercase opacity-70">Off</span>
          </button>
        </div>

        <button
          type="button"
          onClick={handleGo}
          className="w-full py-4 rounded-lg bg-bio text-bio-foreground text-sm font-black tracking-[0.2em] uppercase border border-bio active:scale-[0.98] touch-manipulation flex items-center justify-center gap-2"
        >
          Let&rsquo;s Go!
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}