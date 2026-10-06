import React from 'react';
import { X, ChevronLeft } from 'lucide-react';

// REALLY-GOOD-HOLD-MY-HAND — the Aliens, again. field manual. A player-requested,
// full-screen scrollable information page opened from the Info icon on the
// Missions / Armory / Squad pages. Rendered as an overlay so the originating
// page stays mounted underneath and its state is preserved on close.
//
// Tone matches the New Campaign intro: casual, snarky, self-aware. Copy is
// broken into compact sections with amber emphasis on key phrases and a few
// lightweight tactical callouts. Built so future sections (Commander Skills,
// Armor Shred, directional cover, Bosses, enemy Commanders, advanced tactics)
// can be appended without restructuring.

function Section({ title, children }) {
  return (
    <section className="mb-7">
      <h2 className="text-amber-400 font-black text-[12px] tracking-[0.18em] uppercase mb-2.5">
        {title}
      </h2>
      <div className="text-slate-300 text-[13px] leading-relaxed space-y-2.5">
        {children}
      </div>
    </section>
  );
}

function Callout({ label, children }) {
  return (
    <div className="my-3 rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2.5">
      <div className="text-[10px] font-black tracking-[0.2em] uppercase text-cyan-300 mb-1">
        {label}
      </div>
      <div className="text-slate-300 text-[12px] leading-snug">{children}</div>
    </div>
  );
}

function Em({ children }) {
  return <span className="text-amber-300 font-bold">{children}</span>;
}

export default function FieldManualOverlay({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col">
      {/* Sticky header — title + close. Safe-area aware. */}
      <div className="shrink-0 flex items-center gap-2 px-3 pt-[calc(0.6rem+env(safe-area-inset-top))] pb-2.5 border-b border-slate-800 bg-slate-950/95">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back"
          className="p-1.5 rounded-md border border-slate-600 bg-slate-800 text-slate-300 active:scale-95 touch-manipulation"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-white font-black text-[13px] tracking-[0.12em] uppercase leading-tight truncate">
            Really-Good-Hold-My-Hand
          </div>
          <div className="text-slate-500 text-[10px] tracking-[0.15em] uppercase leading-tight">
            Field Manual (Kind Of.)
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="p-1.5 rounded-md border border-slate-600 bg-slate-800 text-slate-300 active:scale-95 touch-manipulation"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto px-5 pt-6 pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
          <p className="text-slate-300 text-[13px] leading-relaxed mb-7">
            Welcome to your sandbox of tactical mayhem.
          </p>

          <Section title="Your Sandbox">
            <p>The general idea is pretty simple:</p>
            <p>
              Equip your squad. Kill aliens. Gain experience. Collect resources.
              Make your squad better. Kill stronger aliens.
            </p>
            <p>Repeat until somebody runs out of aliens.</p>
          </Section>

          <Section title="What Should I Actually Be Doing?">
            <p>Upgrade your weapons.</p>
            <p>Upgrade your armor.</p>
            <p>Try the cool Utility items.</p>
            <p>Level your soldiers and experiment with their Skill Trees.</p>
            <p>
              And <Em>VERY IMPORTANT</Em>:
            </p>
            <p>
              <Em>UPGRADE YOUR SQUAD SIZE.</Em>
            </p>
            <p>Seriously.</p>
            <p>
              Bringing more soldiers into the fight turns out to be extremely
              useful. Who knew?
            </p>
            <Callout label="Tactical Advice">
              More soldiers generally means more options.
            </Callout>
          </Section>

          <Section title="Commander">
            <p>
              Buy the <Em>Commander</Em> upgrade.
            </p>
            <p>
              Commander abilities let you issue special battlefield orders outside
              your soldiers&rsquo; normal actions.
            </p>
            <p>
              Because apparently managing five armed professionals wasn&rsquo;t
              enough responsibility.
            </p>
          </Section>

          <Section title="Chess">
            <p>You can also play chess.</p>
            <p>Why?</p>
            <p>No reason.</p>
            <p>It&rsquo;s just there.</p>
          </Section>

          <Section title="Experiment">
            <p>
              <Em>For real though:</Em>
            </p>
            <p>
              <Em>Experiment.</Em>
            </p>
            <p>Level up. Try different squad combinations.</p>
            <p>
              Mix classes, weapons, armor, Utilities, and abilities. Everyone is
              strong in their own way, and there isn&rsquo;t supposed to be one
              magical &ldquo;correct&rdquo; squad.
            </p>
          </Section>

          <Section title="If Things Are Hard...">
            <p>Do easier missions.</p>
            <p>Make some Credits. Collect resources.</p>
            <p>Upgrade your weapons and armor. Level your soldiers.</p>
            <p>
              Then come back better equipped and significantly more annoyed.
            </p>
          </Section>

          <Section title="If Things Are Easy...">
            <p>Enjoy it.</p>
            <p>Seriously.</p>
            <p>
              Because as you progress through the campaign, the challenges keep
              coming. New aliens. Stronger enemies. Bosses. Enemy Commanders.
              More ways for your carefully constructed tactical masterpiece to
              immediately go sideways.
            </p>
          </Section>

          <Section title="Don't Panic About Failure">
            <p>
              <Em>Every mission can be replayed.</Em>
            </p>
            <p>
              <Em>Bosses can be replayed.</Em>
            </p>
            <p>
              You don&rsquo;t need to save-scum every bad decision. Progress only
              moves forward here.
            </p>
            <p>
              If a mission goes as badly as humanly possible, you&rsquo;re
              probably just going to spend a few Credits making your soldiers
              feel less terrible about themselves, patch them up, and send them
              right back out there.
            </p>
            <p>Failure should hurt. It shouldn&rsquo;t ruin your campaign.</p>
            <Callout label="Field Note">
              Losing a mission is not the end of your campaign. Injuries,
              healing costs, and spent Commander resources still apply — but
              your campaign keeps moving forward.
            </Callout>
          </Section>

          <Section title="Why Does This Game Exist?">
            <p>
              Aliens, again. is continuously being developed into the fast, fun
              strategy-tactics game I&rsquo;ve always wanted on my phone.
            </p>
            <p>I love games like:</p>
            <ul className="space-y-1 pl-1">
              <li>XCOM</li>
              <li>Jagged Alliance</li>
              <li>Mount &amp; Blade: Warband</li>
            </ul>
            <p>
              and all those other tactical games that somehow convince you that
              spending twenty minutes deciding whether to move three squares is
              a perfectly reasonable use of your evening.
            </p>
            <p>They&rsquo;re great.</p>
            <p>But that style of game doesn&rsquo;t always translate cleanly to mobile.</p>
            <p>I get it. You&rsquo;re busy. I&rsquo;m busy.</p>
            <p>
              Sometimes you want meaningful tactical decisions without needing to
              schedule an appointment with your own save file.
            </p>
          </Section>

          <Section title="So That's Aliens, again.">
            <p>Fast battles.</p>
            <p>Interesting decisions.</p>
            <p>Ridiculous builds.</p>
            <p>Destructible battlefields.</p>
            <p>Aliens trying to ruin your day.</p>
            <p>
              And enough systems to experiment with without making you wait
              forever between the fun parts.
            </p>
            <p>Cheers to fast, fun, turn-based tactics.</p>
            <p className="text-slate-400 italic pt-1">
              — Love,
              <br />
              The Aliens, again. Dev Team
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}