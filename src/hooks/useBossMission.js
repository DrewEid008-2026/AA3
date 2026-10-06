import { useEffect, useRef } from 'react';
import { getRelayStatus, getBossUnit, CORE_SHIELD_MAX, triggerPhase2, triggerPhase3, defeatBoss } from '@/game/bossState';

// Phase 3 trigger threshold: Warden Prime has 26 HP. Phase 3 begins at 9 HP
// or lower (35%). Use <= so it triggers even if damage jumps past 9.
const PHASE_3_HP_THRESHOLD = 9;

// Boss mission relay-destruction, Core Shield-break detection, and Phase 2
// transition. Extracted from Battle.jsx to keep the page file manageable.
// Watches the live units array and fires battlefield messages + bossState
// transitions when relays die, the Core Shield drops to 0, or both relays are
// destroyed (triggering Phase 2 — WARDEN ADVANCING).
//
// Phase 2 transition fires EXACTLY ONCE: the phase2Triggered flag in bossState
// prevents re-entry even if the units array updates multiple times.
//
// Returns { resetBossRefs } — call on mission restart to reset the tracking refs.
export function useBossMission({ isBossMission, units, setBossState, setBossMessage, bossMessage }) {
  const prevRelayDestroyedRef = useRef(0);
  const prevBossShieldRef = useRef(CORE_SHIELD_MAX);
  const phase2AnnouncedRef = useRef(false);
  const phase3AnnouncedRef = useRef(false);
  const bossDefeatHandledRef = useRef(false);

  // Relay destruction + Core Shield break + Phase 2 transition. Runs after
  // every units change so relay deaths are detected immediately.
  useEffect(() => {
    if (!isBossMission) return;
    const status = getRelayStatus(units);

    if (status.destroyed > prevRelayDestroyedRef.current) {
      const destroyedRelays = units.filter((u) => u.isBossObject && !u.alive);
      const lastDestroyed = destroyedRelays[destroyedRelays.length - 1];
      const fxX = lastDestroyed?.x ?? 4;
      const fxY = lastDestroyed?.y ?? 1;

      if (status.destroyed === 1 && status.total >= 2) {
        setBossMessage({ text: 'POWER RELAY DESTROYED', subtext: 'Shield Network Still Active', x: fxX, y: fxY, tone: 'relay' });
      } else if (status.destroyed >= status.total) {
        // Both relays destroyed — trigger Phase 2 transition (once).
        setBossState((prev) => triggerPhase2(prev));
        setBossMessage({ text: 'SHIELD NETWORK OFFLINE', subtext: 'Core Shield can no longer regenerate.', x: fxX, y: fxY, tone: 'offline' });
        // Follow up with the major Phase 2 announcement after a brief delay.
        if (!phase2AnnouncedRef.current) {
          phase2AnnouncedRef.current = true;
          setTimeout(() => {
            setBossMessage({ text: 'WARDEN ADVANCING', subtext: 'Command defenses compromised.', x: fxX, y: fxY, tone: 'advance' });
          }, 1100);
        }
      }
    }
    prevRelayDestroyedRef.current = status.destroyed;

    const boss = getBossUnit(units);
    if (boss) {
      const currentShield = boss.coreShield || 0;
      if (prevBossShieldRef.current > 0 && currentShield === 0) {
        const regenPossible = status.total - status.destroyed > 0;
        setBossMessage({
          text: 'CORE SHIELD BROKEN',
          subtext: regenPossible ? 'May regenerate if network active' : '',
          x: boss.x, y: boss.y, tone: 'shield-break',
        });
      }
      prevBossShieldRef.current = currentShield;

      // Phase 3 trigger (Core Overload): Warden HP <= 9 and still alive.
      // Event order (Part 3): death is checked first (getBossUnit returns null
      // when dead), so if the Warden goes from >9 HP to 0 HP, defeatBoss fires
      // in the else branch below — Phase 3 never triggers.
      if (boss.hp <= PHASE_3_HP_THRESHOLD && !phase3AnnouncedRef.current) {
        phase3AnnouncedRef.current = true;
        setBossState((prev) => triggerPhase3(prev));
        setBossMessage({
          text: 'CORE OVERLOAD',
          subtext: 'Warden power systems are destabilizing.',
          x: boss.x, y: boss.y, tone: 'overload',
        });
      }
    } else {
      // Warden is dead (getBossUnit returns null when !alive). Boss defeat
      // takes priority over Phase 3 (Part 3). Fire once.
      if (!bossDefeatHandledRef.current) {
        bossDefeatHandledRef.current = true;
        setBossState((prev) => defeatBoss(prev));
      }
    }
  }, [units, isBossMission, setBossState, setBossMessage]);

  // Auto-clear boss messages after a brief delay.
  useEffect(() => {
    if (!bossMessage) return;
    const timer = setTimeout(() => setBossMessage(null), 1800);
    return () => clearTimeout(timer);
  }, [bossMessage, setBossMessage]);

  return {
    resetBossRefs: () => {
      prevRelayDestroyedRef.current = 0;
      prevBossShieldRef.current = CORE_SHIELD_MAX;
      phase2AnnouncedRef.current = false;
      phase3AnnouncedRef.current = false;
      bossDefeatHandledRef.current = false;
    },
  };
}