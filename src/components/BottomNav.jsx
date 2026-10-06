import React, { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Users, ShoppingBag, Swords } from 'lucide-react';
import { readActiveCampaign } from '@/game/saveSlots';
import { clearSquadSkillNotification } from '@/game/persistence';

const ITEMS = [
  { path: '/squad', label: 'Squad', icon: Users },
  { path: '/armory', label: 'Armory', icon: ShoppingBag },
  { path: '/missions', label: 'Missions', icon: Swords },
];

// Persistent between-mission footer navigation. Fixed to the viewport bottom so
// it remains visible regardless of page scroll position. Safe-area aware so it
// is not hidden behind iOS home indicators or Android navigation bars. Not
// shown during tactical combat (Battle route is outside the layout).
//
// A level-up pip appears on the Squad button when a soldier has an unspent
// skill selection and the campaign's squadSkillNotification flag is set. The
// flag is set during mission commit when a level-up grants a skill selection,
// and cleared when the player taps the Squad tab.
export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  // Recompute the pip on navigation. The flag is set during mission commit
  // (before returning to the between-mission screens) and cleared on Squad tap.
  const squadPip = useMemo(() => {
    const c = readActiveCampaign();
    if (!c || !c.squadSkillNotification) return false;
    return (c.soldiers || []).some((s) => (s.available_skill_selections || 0) > 0);
  }, [location.pathname]);

  const handleClick = (item) => {
    if (item.path === '/squad') clearSquadSkillNotification();
    navigate(item.path);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-neutral-950/95 backdrop-blur-sm border-t border-neutral-800 px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
      <div className="flex items-center gap-2">
        {ITEMS.map((item) => {
          const active = location.pathname === item.path ||
            (item.path === '/squad' && location.pathname === '/');
          return (
            <button
              key={item.path}
              type="button"
              onClick={() => handleClick(item)}
              className={`relative flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg text-[10px] font-bold tracking-wide uppercase transition touch-manipulation ${
                active
                  ? 'bg-tech/20 text-tech border border-tech/60'
                  : 'bg-neutral-900/50 text-neutral-500 border border-neutral-800 active:scale-95'
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
              {item.path === '/squad' && squadPip && (
                <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-bio ring-2 ring-neutral-950" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}